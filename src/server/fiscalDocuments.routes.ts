import { createHash, randomBytes } from 'node:crypto';
import express, { Router } from 'express';
import { obterUsuarioDaSessao } from './auth.routes';
import { criptografarXml, descriptografarXml } from './encryption';
import { comContextoTenant, obterPoolBanco } from './persistence';
import { chaveNfeTemDigitoValido } from '../services/fiscal/chaveNfe.service';
import { normalizarCnpj, validarCnpj } from '../services/cnpj/cnpjValidation';

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CNPJ_FORMATADO = /^[A-Z0-9]{12}[0-9]{2}$/;
// Process-local capability used only by the server-to-server synchronization route.
export const CHAVE_SYNC_FISCAL_INTERNA = randomBytes(32).toString('base64url');
const analisarXml = express.text({ type: ['application/xml', 'text/xml'], limit: '25mb' });

function analisarCorpoXml(req: express.Request, res: express.Response, next: express.NextFunction): void {
  analisarXml(req, res, (error?: any) => {
    if (error?.type === 'entity.too.large') {
      res.status(413).json({ mensagem: 'O arquivo excede o limite de 25 MB; nenhum documento foi salvo.' });
      return;
    }
    if (error?.type === 'encoding.unsupported') {
      res.status(415).json({ mensagem: 'A codificação deste XML não é suportada.' });
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
}

function elementoXml(xml: string, nome: string): string {
  const elemento = new RegExp(`<((?:[A-Za-z_][\\w.-]*:)?${nome})\\b[^>]*>`, 'i').exec(xml);
  if (!elemento) return '';
  const inicio = elemento.index + elemento[0].length;
  const restante = xml.slice(inicio);
  const fechamento = new RegExp(`</${elemento[1]}\\s*>`, 'i').exec(restante);
  if (!fechamento) return '';
  return restante.slice(0, fechamento.index);
}

function lerTag(xml: string, nome: string): string {
  return elementoXml(xml, nome).replace(/<[^>]*>/g, '').trim();
}

function obterInfNfe(xml: string): { fragmento: string; chave: string } | null {
  const abertura = /<(?:[A-Za-z_][\w.-]*:)?infNFe\b([^>]*)>/i.exec(xml);
  if (!abertura) return null;
  const inicio = abertura.index + abertura[0].length;
  const restante = xml.slice(inicio);
  const nome = abertura[0].match(/^<((?:[A-Za-z_][\w.-]*:)?infNFe)\b/i)?.[1];
  if (!nome) return null;
  const fechamento = new RegExp(`</${nome}\\s*>`, 'i').exec(restante);
  if (!fechamento) return null;
  const id = /\bId\s*=\s*(["'])NFe([0-9A-Z]{44})\1/i.exec(abertura[1]);
  const fragmento = restante.slice(0, fechamento.index);
  const chaveProtocolo = lerTag(xml, 'chNFe');
  const chaveId = id?.[2]?.toUpperCase();
  const chaveRetorno = chaveProtocolo.toUpperCase();
  if (chaveId && chaveRetorno && chaveId !== chaveRetorno) return null;
  return { fragmento, chave: chaveId || chaveRetorno };
}

function dataIsoCivil(valor: string): string | null {
  const data = valor.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const [ano, mes, dia] = data.split('-').map(Number);
  const calendario = new Date(Date.UTC(ano, mes - 1, dia));
  return calendario.getUTCFullYear() === ano && calendario.getUTCMonth() === mes - 1 && calendario.getUTCDate() === dia
    ? data
    : null;
}

function decimalFiscal(valor: string): string | null {
  if (!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,2})?$/.test(valor)) return null;
  const [inteiro, fracao = ''] = valor.split('.');
  return `${inteiro}.${fracao.padEnd(2, '0')}`;
}

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});

/** Lista somente metadados; XML nunca sai junto com a listagem. Arquivadas continuam consultáveis. */
router.get('/companies/:companyId/fiscal-documents', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : '';
  const companyId = req.params.companyId;
  const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : '50';
  const limit = Number(limitRaw);
  if (!UUID.test(tenantId) || !UUID.test(companyId)) return res.status(400).json({ mensagem: 'Escritório ou empresa inválidos.' });
  if (!/^\d{1,3}$/.test(limitRaw) || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ mensagem: 'O limite deve ser um número entre 1 e 100.' });
  }
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const scoped = await comContextoTenant(user.id, tenantId, async (client) => {
      const company = await client.query(
        'SELECT id FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 LIMIT 1',
        [companyId, tenantId],
      );
      if (!company.rows[0]) return null;
      const documents = await client.query(
        `SELECT id, access_key, document_type, issued_on, total_amount, status, source, xml_sha256,
                metadata, created_at, (xml_ciphertext IS NOT NULL) AS has_xml
           FROM fiscoia.fiscal_documents
          WHERE tenant_id = $1 AND company_id = $2
          ORDER BY issued_on DESC NULLS LAST, created_at DESC
          LIMIT $3`,
        [tenantId, companyId, limit],
      );
      return documents.rows.map((row) => ({
        id: String(row.id), chave: String(row.access_key), tipo: String(row.document_type),
        dataEmissao: row.issued_on ? String(row.issued_on).slice(0, 10) : null,
        valorTotal: row.total_amount === null ? null : String(row.total_amount),
        status: String(row.status), origem: String(row.source),
        hashXml: row.xml_sha256 ? String(row.xml_sha256).trim() : null,
        direcao: row.metadata?.direction === 'SAIDA' || row.metadata?.direction === 'ENTRADA' ? row.metadata.direction : null,
        revisaoEstrutural: row.metadata?.revisaoEstrutural ?? null,
        criadoEm: row.created_at, xmlDisponivel: row.has_xml === true,
      }));
    });
    if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!scoped.resultado) return res.status(404).json({ mensagem: 'Empresa não encontrada neste escritório.' });
    return res.json({ documentos: scoped.resultado, limite: limit, maisRecentesPrimeiro: true });
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível listar os documentos persistidos.' });
  }
});

/** Entrega um XML apenas após sessão, associação ao tenant e vínculo exato com a empresa. */
router.get('/companies/:companyId/fiscal-documents/:documentId/xml', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : '';
  const { companyId, documentId } = req.params;
  if (!UUID.test(tenantId) || !UUID.test(companyId) || !UUID.test(documentId)) {
    return res.status(400).json({ mensagem: 'Escritório, empresa ou documento inválido.' });
  }
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const scoped = await comContextoTenant(user.id, tenantId, async (client) => {
      const result = await client.query(
        `SELECT access_key, xml_ciphertext, xml_nonce, xml_auth_tag, encryption_key_version
           FROM fiscoia.fiscal_documents
          WHERE id = $1 AND tenant_id = $2 AND company_id = $3
          LIMIT 1`,
        [documentId, tenantId, companyId],
      );
      const row = result.rows[0];
      if (!row) return null;
      if (!row.xml_ciphertext || !row.xml_nonce || !row.xml_auth_tag || !row.encryption_key_version) {
        return { indisponivel: true as const };
      }
      const xml = descriptografarXml(tenantId, companyId, {
        ciphertext: row.xml_ciphertext, nonce: row.xml_nonce,
        authTag: row.xml_auth_tag, keyVersion: String(row.encryption_key_version),
      });
      return { xml, chave: String(row.access_key) };
    });
    if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!scoped.resultado) return res.status(404).json({ mensagem: 'Documento não encontrado para esta empresa.' });
    if ('indisponivel' in scoped.resultado) return res.status(410).json({ mensagem: 'O XML original não está disponível; o registro foi preservado.' });
    res.type('application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${scoped.resultado.chave}.xml"`);
    return res.send(scoped.resultado.xml);
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível abrir o XML criptografado. O documento foi preservado.' });
  }
});

/** Recebe XML NF-e/NFC-e autenticado por sessão, protegido por empresa e cifrado antes de persistir. */
router.post(
  '/companies/:companyId/fiscal-documents',
  analisarCorpoXml,
  async (req, res) => {
    const pool = obterPoolBanco();
    if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
    const tenantId = req.get('x-fiscoia-tenant-id') || '';
    const companyId = req.params.companyId;
    if (!UUID.test(tenantId) || !UUID.test(companyId)) return res.status(400).json({ mensagem: 'Escritório ou empresa inválidos.' });
    if (typeof req.body !== 'string' || !req.body.trim()) return res.status(400).json({ mensagem: 'Envie o XML no corpo da requisição.' });

    const xml = req.body;
    const origemDocumento = req.get('x-fiscoia-internal-sync') === CHAVE_SYNC_FISCAL_INTERNA
      ? 'MURADE_FISCAL_SYNC'
      : 'LOCAL_XML_UPLOAD';
    if (Buffer.byteLength(xml, 'utf8') > 25 * 1024 * 1024) return res.status(413).json({ mensagem: 'XML acima do limite de 25 MB; nenhum documento foi salvo.' });
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) return res.status(422).json({ mensagem: 'XML com DTD ou entidade não suportada; nenhum documento foi salvo.' });

    const xmlSemComentarios = xml.replace(/<!--[\s\S]*?-->/g, '');
    const inf = obterInfNfe(xmlSemComentarios);
    if (!inf || !chaveNfeTemDigitoValido(inf.chave)) return res.status(422).json({ mensagem: 'O XML não contém uma chave NF-e/NFC-e válida; nenhum documento foi salvo.' });
    const ide = elementoXml(inf.fragmento, 'ide');
    const emit = elementoXml(inf.fragmento, 'emit');
    const dest = elementoXml(inf.fragmento, 'dest');
    const modelo = lerTag(ide, 'mod');
    const cnpjEmitente = normalizarCnpj(lerTag(emit, 'CNPJ'));
    const cnpjDestinatario = normalizarCnpj(lerTag(dest, 'CNPJ'));
    const numero = lerTag(ide, 'nNF');
    const serie = lerTag(ide, 'serie');
    const dataEmissao = dataIsoCivil(lerTag(ide, 'dhEmi') || lerTag(ide, 'dEmi'));
    const cnpjChave = inf.chave.slice(6, 20);
    if ((modelo !== '55' && modelo !== '65') || inf.chave.slice(20, 22) !== modelo
      || !validarCnpj(cnpjEmitente) || cnpjEmitente !== cnpjChave
      || !/^\d{1,9}$/.test(numero) || inf.chave.slice(25, 34) !== numero.padStart(9, '0')
      || !/^\d{1,3}$/.test(serie) || inf.chave.slice(22, 25) !== serie.padStart(3, '0')) {
      return res.status(422).json({ mensagem: 'Identificação, emitente ou chave do XML divergem; nenhum documento foi salvo.' });
    }
    if (dataEmissao && inf.chave.slice(2, 6) !== `${dataEmissao.slice(2, 4)}${dataEmissao.slice(5, 7)}`) {
      return res.status(422).json({ mensagem: 'A data de emissão diverge do mês/ano da chave; nenhum documento foi salvo.' });
    }
    const valorTotal = decimalFiscal(lerTag(elementoXml(inf.fragmento, 'ICMSTot'), 'vNF'));
    const documentoTipo = modelo === '55' ? 'NFE' : 'NFCE';
    const xmlHash = createHash('sha256').update(xml, 'utf8').digest('hex');

    try {
      const user = await obterUsuarioDaSessao(req);
      if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
      const scoped = await comContextoTenant(user.id, tenantId, async (client) => {
        const company = await client.query(
          'SELECT id, cnpj FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 AND archived_at IS NULL LIMIT 1',
          [companyId, tenantId],
        );
        if (!company.rows[0]) return { notFound: true as const };
        const cnpjEmpresa = String(company.rows[0].cnpj);
        const direcao = cnpjEmitente === cnpjEmpresa ? 'SAIDA' : cnpjDestinatario === cnpjEmpresa ? 'ENTRADA' : null;
        if (!CNPJ_FORMATADO.test(cnpjEmpresa) || !direcao) return { mismatch: true as const };

        const encrypted = criptografarXml(tenantId, companyId, xml);
        const existing = await client.query(
          `SELECT id, xml_sha256, document_type, issued_on, total_amount, metadata
             FROM fiscoia.fiscal_documents
            WHERE tenant_id = $1 AND company_id = $2 AND access_key = $3
            FOR UPDATE`,
          [tenantId, companyId, inf.chave],
        );
        const mesmoDocumento = (row: Record<string, any>) => row.xml_sha256 === xmlHash
            && row.document_type === documentoTipo
            && String(row.issued_on || '') === String(dataEmissao || '')
            && String(row.total_amount ?? '') === String(valorTotal ?? '')
            && row.metadata?.direction === direcao;
        if (existing.rows[0]) {
          const row = existing.rows[0];
          const mesmoConteudo = mesmoDocumento(row);
          return mesmoConteudo
            ? { id: String(row.id), repetido: true as const, direcao }
            : { conflito: true as const };
        }

        const inserted = await client.query(
          `INSERT INTO fiscoia.fiscal_documents
             (tenant_id, company_id, access_key, document_type, issued_on, total_amount, status, source,
              xml_ciphertext, xml_nonce, xml_auth_tag, encryption_key_version, xml_sha256, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, 'PENDING_REVIEW', $13, $7, $8, $9, $10, $11, $12::jsonb)
           ON CONFLICT (tenant_id, company_id, access_key) DO NOTHING
           RETURNING id`,
          [tenantId, companyId, inf.chave, documentoTipo, dataEmissao, valorTotal, encrypted.ciphertext,
            encrypted.nonce, encrypted.authTag, encrypted.keyVersion, xmlHash, JSON.stringify({ direction: direcao, source: origemDocumento }), origemDocumento],
        );
        if (!inserted.rowCount) {
          const concorrente = await client.query(
            `SELECT id, xml_sha256, document_type, issued_on, total_amount, metadata
               FROM fiscoia.fiscal_documents
              WHERE tenant_id = $1 AND company_id = $2 AND access_key = $3
              FOR UPDATE`,
            [tenantId, companyId, inf.chave],
          );
          const row = concorrente.rows[0];
          return row && mesmoDocumento(row)
            ? { id: String(row.id), repetido: true as const, direcao }
            : { conflito: true as const };
        }
        const id = String(inserted.rows[0].id);
        await client.query(
          `INSERT INTO fiscoia.audit_events (tenant_id, actor_user_id, event_type, entity_type, entity_id, details)
           VALUES ($1, $2, 'fiscal_document.stored', 'fiscal_document', $3, $4::jsonb)`,
          [tenantId, user.id, id, JSON.stringify({ accessKey: inf.chave, companyId, direction: direcao, source: origemDocumento })],
        );
        return { id, repetido: false as const, direcao };
      }, ['OWNER', 'ADMIN', 'CONTADOR', 'OPERADOR']);

      if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
      if (!scoped.resultado) return res.status(403).json({ mensagem: 'Seu perfil não pode receber documentos fiscais neste escritório.' });
      if ('notFound' in scoped.resultado) return res.status(404).json({ mensagem: 'Empresa ativa não encontrada neste escritório.' });
      if ('mismatch' in scoped.resultado) return res.status(422).json({ mensagem: 'O CNPJ da empresa selecionada não consta como emitente ou destinatário deste XML.' });
      if ('conflito' in scoped.resultado || 'conflict' in scoped.resultado) return res.status(409).json({ mensagem: 'Já existe esta chave com conteúdo ou metadados diferentes. O documento anterior foi preservado.' });
      return res.status(scoped.resultado.repetido ? 200 : 201).json({
        documento: { id: scoped.resultado.id, chave: inf.chave, tipo: documentoTipo, direcao: scoped.resultado.direcao, status: 'PENDING_REVIEW' },
        repetido: scoped.resultado.repetido,
        origem: origemDocumento,
        xmlCriptografadoNoPostgreSQL: true,
        origemAutenticada: false,
        consultaSefazRealizada: false,
      });
    } catch {
      return res.status(503).json({ mensagem: 'Não foi possível persistir o XML no armazenamento seguro. O conteúdo não foi confirmado no banco.' });
    }
  },
);

export default router;
