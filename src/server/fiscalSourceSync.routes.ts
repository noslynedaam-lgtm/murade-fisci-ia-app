import { Router } from 'express';
import { obterUsuarioDaSessao } from './auth.routes';
import { CHAVE_SYNC_FISCAL_INTERNA } from './fiscalDocuments.routes';
import { comContextoTenant, obterPoolBanco } from './persistence';
import { normalizarCnpj, validarCnpj } from '../services/cnpj/cnpjValidation';

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const DOCUMENTOS_POR_EXECUCAO = 100;
const MAX_PAGINAS = 20;
const FISCAL_URL_PADRAO = 'https://murade-fiscal-1.onrender.com';

function dataValida(value: unknown): value is string {
  if (typeof value !== 'string' || !DATA.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function obterUrlFiscal(): URL | null {
  try {
    const url = new URL(process.env.MURADE_FISCAL_SERVER_URL || FISCAL_URL_PADRAO);
    // The integration token is sent only to the owned Murade Fiscal service.
    if (url.protocol !== 'https:' || url.hostname !== 'murade-fiscal-1.onrender.com' || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

router.post('/companies/:companyId/fiscal-source-sync', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente indisponível; nenhuma sincronização foi executada.' });
  const tenantId = req.get('x-fiscoia-tenant-id') || '';
  const companyId = req.params.companyId;
  if (!UUID.test(tenantId) || !UUID.test(companyId)) return res.status(400).json({ mensagem: 'Escritório ou empresa inválidos.' });
  if (req.body?.confirmarSincronizacao !== true) {
    return res.status(400).json({ mensagem: 'Confirmação explícita necessária para consultar os documentos do Murade Fiscal.' });
  }
  const desde = req.body?.desde;
  const ate = req.body?.ate;
  if (!dataValida(desde) || !dataValida(ate) || desde > ate) {
    return res.status(400).json({ mensagem: 'Informe um período válido, com datas inicial e final no formato AAAA-MM-DD.' });
  }
  if (!process.env.MURADE_INTEGRATION_TOKEN?.trim()) {
    return res.status(503).json({ mensagem: 'Integração com o Murade Fiscal ainda não foi configurada no servidor.' });
  }
  const fiscalUrl = obterUrlFiscal();
  if (!fiscalUrl) return res.status(503).json({ mensagem: 'A URL segura do Murade Fiscal não está configurada corretamente.' });

  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const scoped = await comContextoTenant(user.id, tenantId, async (client) => {
      const result = await client.query(
        'SELECT cnpj FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 AND archived_at IS NULL LIMIT 1',
        [companyId, tenantId],
      );
      return result.rows[0] ? normalizarCnpj(String(result.rows[0].cnpj)) : null;
    }, ['OWNER', 'ADMIN', 'CONTADOR', 'OPERADOR']);
    if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!scoped.resultado) return res.status(403).json({ mensagem: 'Seu perfil não pode sincronizar documentos neste escritório.' });
    const cnpj = scoped.resultado;
    if (!validarCnpj(cnpj)) return res.status(422).json({ mensagem: 'O CNPJ cadastrado para a empresa não é válido; nenhum documento foi consultado.' });

    let cursor = typeof req.body?.cursor === 'string' && req.body.cursor.length <= 2048 ? req.body.cursor : '';
    let consultados = 0;
    let importados = 0;
    let repetidos = 0;
    let semXml = 0;
    let rejeitados = 0;
    let paginas = 0;
    let truncado = false;
    const avisos: string[] = [];
    const integrationToken = process.env.MURADE_INTEGRATION_TOKEN;

    for (; paginas < MAX_PAGINAS && consultados < DOCUMENTOS_POR_EXECUCAO; paginas += 1) {
      const sourceUrl = new URL('/api/integracao/fiscal/documentos', fiscalUrl);
      sourceUrl.searchParams.set('cnpj', cnpj);
      sourceUrl.searchParams.set('desde', desde);
      sourceUrl.searchParams.set('ate', ate);
      sourceUrl.searchParams.set('limite', String(Math.min(50, DOCUMENTOS_POR_EXECUCAO - consultados)));
      if (cursor) sourceUrl.searchParams.set('cursor', cursor);
      const sourceResponse = await fetch(sourceUrl, {
        headers: { Authorization: `Bearer ${integrationToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!sourceResponse.ok) {
        return res.status(sourceResponse.status === 401 || sourceResponse.status === 503 ? 503 : 502).json({
          mensagem: sourceResponse.status === 401
            ? 'A credencial entre Fisco IA e Murade Fiscal não foi aceita; nenhum dado desta página foi gravado.'
            : 'Murade Fiscal não concluiu a consulta; documentos já sincronizados foram preservados.',
          paginasProcessadas: paginas,
          importados,
          repetidos,
        });
      }
      const payload = await sourceResponse.json() as {
        sucesso?: boolean; cnpj?: string; documentos?: Array<Record<string, unknown>>;
        proximoCursor?: string | null; truncado?: boolean; avisos?: string[];
      };
      if (payload.sucesso !== true || normalizarCnpj(String(payload.cnpj || '')) !== cnpj || !Array.isArray(payload.documentos)) {
        return res.status(502).json({ mensagem: 'Resposta do Murade Fiscal inválida ou de outro CNPJ; esta página não foi importada.', paginasProcessadas: paginas, importados, repetidos });
      }
      if (Array.isArray(payload.avisos)) avisos.push(...payload.avisos.filter((item): item is string => typeof item === 'string').slice(0, 10));
      const documentos = payload.documentos;
      consultados += documentos.length;
      for (const documento of documentos) {
        if (normalizarCnpj(String(documento.cnpjEmpresa || '')) !== cnpj) { rejeitados += 1; continue; }
        const xml = typeof documento.xmlOriginal === 'string' ? documento.xmlOriginal : '';
        if (!xml.trim()) { semXml += 1; continue; }
        if (Buffer.byteLength(xml, 'utf8') > 25 * 1024 * 1024) { rejeitados += 1; continue; }

        // Reuse the same validated, encrypted, audited ingestion path as a manual XML upload.
        const appOrigin = `http://127.0.0.1:${Number(process.env.PORT || 3000)}`;
        const ingestResponse = await fetch(new URL(`/api/companies/${encodeURIComponent(companyId)}/fiscal-documents`, appOrigin), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml',
            'X-FiscoIA-Tenant-Id': tenantId,
            'X-FiscoIA-Internal-Sync': CHAVE_SYNC_FISCAL_INTERNA,
            ...(req.get('cookie') ? { Cookie: req.get('cookie')! } : {}),
          },
          body: xml,
          signal: AbortSignal.timeout(30_000),
        });
        const ingestResult = await ingestResponse.json().catch(() => ({})) as { repetido?: boolean; documento?: unknown };
        if (ingestResponse.ok && ingestResult.documento) {
          if (ingestResult.repetido) repetidos += 1;
          else importados += 1;
        } else if (ingestResponse.status === 409) {
          rejeitados += 1;
        } else {
          avisos.push(`Um documento foi preservado na origem, mas recusado na validação local (HTTP ${ingestResponse.status}).`);
          rejeitados += 1;
        }
      }
      cursor = typeof payload.proximoCursor === 'string' ? payload.proximoCursor : '';
      if (!cursor || documentos.length === 0) { truncado = payload.truncado === true; break; }
      if (consultados >= DOCUMENTOS_POR_EXECUCAO) { truncado = true; break; }
    }
    if (cursor && paginas >= MAX_PAGINAS) truncado = true;
    return res.json({
      sucesso: true,
      cnpj,
      periodo: { desde, ate },
      consultados,
      importados,
      repetidos,
      semXmlCompleto: semXml,
      rejeitados,
      paginas,
      podeHaverMais: truncado,
      proximoCursor: truncado ? cursor : null,
      avisos: [...new Set(avisos)].slice(0, 20),
      mensagem: 'Documentos completos validados foram armazenados como pendentes de revisão. Nenhum lançamento contábil ou envio oficial foi realizado.',
    });
  } catch {
    return res.status(502).json({ mensagem: 'Não foi possível concluir a sincronização com o Murade Fiscal. Os documentos já gravados foram preservados.' });
  }
});

export default router;
