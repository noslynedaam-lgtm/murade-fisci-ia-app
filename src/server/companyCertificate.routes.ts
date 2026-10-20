import { createHash } from 'node:crypto';
import { createSecureContext } from 'node:tls';
import { Router } from 'express';
import { prepararPfx } from './pfxCompat';
import { obterUsuarioDaSessao } from './auth.routes';
import { descriptografarSegredoEmpresa, criptografarSegredoEmpresa } from './encryption';
import { comContextoTenant, obterPoolBanco } from './persistence';

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PFX_BYTES = 5 * 1024 * 1024;
const ROLES_CAN_MANAGE_CERTIFICATE = ['OWNER', 'ADMIN'];

/** Descriptografa A1 apenas no servidor e dentro da autorização tenant/empresa. */
export async function obterCertificadoFiscalDaEmpresa(userId: string, tenantId: string, companyId: string) {
  const pool = obterPoolBanco();
  if (!pool) throw new Error('Banco permanente não configurado.');
  const scoped = await comContextoTenant(userId, tenantId, async (client) => {
    const result = await client.query(
      `SELECT c.pfx_ciphertext, c.pfx_nonce, c.pfx_auth_tag, c.encryption_key_version,
              co.cnpj, co.state
         FROM fiscoia.company_fiscal_certificates c
         JOIN fiscoia.companies co ON co.id = c.company_id AND co.tenant_id = c.tenant_id
        WHERE c.tenant_id = $1 AND c.company_id = $2 AND co.archived_at IS NULL LIMIT 1`,
      [tenantId, companyId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const segredo = descriptografarSegredoEmpresa(tenantId, companyId, {
      ciphertext: row.pfx_ciphertext, nonce: row.pfx_nonce,
      authTag: row.pfx_auth_tag, keyVersion: String(row.encryption_key_version),
    });
    try {
      const decoded = JSON.parse(segredo.toString('utf8')) as { pfxBase64?: unknown; passphrase?: unknown };
      if (typeof decoded.pfxBase64 !== 'string' || typeof decoded.passphrase !== 'string') {
        throw new Error('Formato interno do certificado inválido.');
      }
      return {
        pfx: Buffer.from(decoded.pfxBase64, 'base64'),
        passphrase: decoded.passphrase,
        cnpj: String(row.cnpj),
        uf: typeof row.state === 'string' ? row.state.trim().toUpperCase() : '',
      };
    } finally {
      segredo.fill(0);
    }
  });
  if (!scoped.autorizado) throw new Error('Este escritório não pertence à sua sessão.');
  return scoped.resultado ?? null;
}

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});

function lerIds(tenantId: unknown, companyId: string) {
  return typeof tenantId === 'string' && UUID.test(tenantId) && UUID.test(companyId)
    ? { tenantId, companyId }
    : null;
}

/** Retorna apenas existência e data; material criptográfico nunca é entregue ao navegador. */
router.get('/companies/:companyId/fiscal-certificate/status', async (req, res) => {
  const ids = lerIds(req.query.tenantId, req.params.companyId);
  if (!ids) return res.status(400).json({ mensagem: 'Escritório ou empresa inválidos.' });
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const scoped = await comContextoTenant(user.id, ids.tenantId, async (client) => {
      const result = await client.query(
        `SELECT c.uploaded_at, c.pfx_sha256
           FROM fiscoia.company_fiscal_certificates c
           JOIN fiscoia.companies co ON co.id = c.company_id AND co.tenant_id = c.tenant_id
          WHERE c.tenant_id = $1 AND c.company_id = $2 AND co.archived_at IS NULL LIMIT 1`,
        [ids.tenantId, ids.companyId],
      );
      const company = await client.query(
        'SELECT id FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 AND archived_at IS NULL LIMIT 1',
        [ids.companyId, ids.tenantId],
      );
      return { existe: Boolean(company.rows[0]), certificado: result.rows[0] || null };
    });
    if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!scoped.resultado?.existe) return res.status(404).json({ mensagem: 'Empresa ativa não encontrada neste escritório.' });
    const certificado = scoped.resultado.certificado;
    return res.json({
      cadastradoNoServidor: Boolean(certificado),
      fingerprint: certificado ? String(certificado.pfx_sha256).trim().slice(0, 12) : null,
      recebidoEm: certificado?.uploaded_at || null,
      certificadoValidadoPelaSefaz: false,
      consultaOficialAtiva: false,
      observacao: 'O cadastro protegido do A1 não significa que ele foi validado pela SEFAZ ou que uma consulta fiscal foi realizada.',
    });
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível consultar o estado do certificado.' });
  }
});

/** Armazena A1 cifrado por tenant+empresa; não registra senha, conteúdo ou nome do arquivo. */
router.put('/companies/:companyId/fiscal-certificate', async (req, res) => {
  const ids = lerIds(req.body?.tenantId, req.params.companyId);
  if (!ids) return res.status(400).json({ mensagem: 'Escritório ou empresa inválidos.' });
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });

  const pfxBase64 = typeof req.body?.pfxBase64 === 'string' ? req.body.pfxBase64.trim() : '';
  const passphrase = typeof req.body?.passphrase === 'string' ? req.body.passphrase : '';
  if (!pfxBase64 || pfxBase64.length > Math.ceil(MAX_PFX_BYTES * 4 / 3) + 8 || !passphrase || passphrase.length > 512) {
    return res.status(400).json({ mensagem: 'Selecione um A1 PKCS#12 de até 5 MB e informe sua senha. Nada foi armazenado.' });
  }
  const pfxOriginal = Buffer.from(pfxBase64, 'base64');
  if (!pfxOriginal.length || pfxOriginal.length > MAX_PFX_BYTES || pfxOriginal.toString('base64') !== pfxBase64) {
    pfxOriginal.fill(0);
    return res.status(400).json({ mensagem: 'O arquivo A1 não está em Base64 válido ou excede 5 MB. Nada foi armazenado.' });
  }
  // Verifica PKCS#12 e senha localmente; converte formatos antigos que o OpenSSL 3 recusa.
  const preparado = prepararPfx(pfxOriginal, passphrase);
  pfxOriginal.fill(0);
  if (preparado.ok === false) {
    return res.status(422).json({ mensagem: preparado.motivo === 'senha'
      ? 'A senha do arquivo A1 está incorreta. Nada foi armazenado.'
      : 'Não foi possível ler este arquivo como certificado A1 (.pfx/.p12). Nada foi armazenado.' });
  }
  const pfx = preparado.pfx;
  const pfxBase64Final = pfx.toString('base64');

  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const segredo = Buffer.from(JSON.stringify({ pfxBase64: pfxBase64Final, passphrase }), 'utf8');
    let encrypted: ReturnType<typeof criptografarSegredoEmpresa>;
    try {
      encrypted = criptografarSegredoEmpresa(ids.tenantId, ids.companyId, segredo);
    } finally {
      segredo.fill(0);
    }
    const fingerprint = createHash('sha256').update(pfx).digest('hex');

    const scoped = await comContextoTenant(user.id, ids.tenantId, async (client) => {
      const company = await client.query(
        'SELECT id FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 AND archived_at IS NULL LIMIT 1',
        [ids.companyId, ids.tenantId],
      );
      if (!company.rows[0]) return null;
      const stored = await client.query(
        `INSERT INTO fiscoia.company_fiscal_certificates
           (tenant_id, company_id, pfx_ciphertext, pfx_nonce, pfx_auth_tag, encryption_key_version, pfx_sha256, uploaded_by, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
         ON CONFLICT (tenant_id, company_id) DO UPDATE SET
           pfx_ciphertext = EXCLUDED.pfx_ciphertext,
           pfx_nonce = EXCLUDED.pfx_nonce,
           pfx_auth_tag = EXCLUDED.pfx_auth_tag,
           encryption_key_version = EXCLUDED.encryption_key_version,
           pfx_sha256 = EXCLUDED.pfx_sha256,
           uploaded_by = EXCLUDED.uploaded_by,
           uploaded_at = EXCLUDED.uploaded_at
         RETURNING uploaded_at`,
        [ids.tenantId, ids.companyId, encrypted.ciphertext, encrypted.nonce, encrypted.authTag,
          encrypted.keyVersion, fingerprint, user.id],
      );
      await client.query(
        `INSERT INTO fiscoia.audit_events (tenant_id, actor_user_id, event_type, entity_type, entity_id, details)
         VALUES ($1, $2, 'fiscal_certificate.stored', 'company', $3, $4::jsonb)`,
        [ids.tenantId, user.id, ids.companyId, JSON.stringify({ fingerprint: fingerprint.slice(0, 12), storage: 'AES-256-GCM', seFazValidated: false })],
      );
      return stored.rows[0];
    }, ROLES_CAN_MANAGE_CERTIFICATE);
    if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!('resultado' in scoped)) return res.status(403).json({ mensagem: 'Somente proprietário ou administrador pode cadastrar o certificado digital.' });
    if (scoped.resultado === null) return res.status(404).json({ mensagem: 'Empresa ativa não encontrada neste escritório.' });
    return res.status(201).json({
      cadastradoNoServidor: true,
      recebidoEm: scoped.resultado.uploaded_at,
      fingerprint: fingerprint.slice(0, 12),
      certificadoValidadoPelaSefaz: false,
      consultaOficialAtiva: false,
      mensagem: 'A1 recebido e cifrado no banco vinculado a esta empresa. Isso não valida o certificado na SEFAZ nem consulta notas.',
    });
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível armazenar o A1 com segurança. O sistema não confirmou o cadastro; tente novamente ou confira a chave de criptografia do servidor.' });
  } finally {
    pfx.fill(0);
  }
});

export default router;
