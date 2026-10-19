import { createHash } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { gunzipSync } from 'node:zlib';
import { Router } from 'express';
import { obterUsuarioDaSessao } from './auth.routes';
import { obterCertificadoFiscalDaEmpresa } from './companyCertificate.routes';
import { criptografarSegredoEmpresa, descriptografarSegredoEmpresa, criptografarXml } from './encryption';
import { comContextoTenant, obterPoolBanco } from './persistence';
import { chaveNfeTemDigitoValido } from '../services/fiscal/chaveNfe.service';
import { normalizarCnpj, validarCnpj } from '../services/cnpj/cnpjValidation';
import { revisarNfeDistribuida } from './nfeDistributionReview';

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NSU = /^\d{1,15}$/;
const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';
const ENDPOINTS = {
  producao: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  homologacao: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
} as const;
const MAX_SOAP_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const MAX_BATCH_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_SEFAZ_REQUEST_MS = 45_000;
const MIN_SEFAZ_REQUEST_GAP_MS = 60_000;

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});

function extrairTag(xml: string, nome: string): string {
  const escaped = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`<(?:(?:[A-Za-z_][\\w.-]*):)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${escaped}\\s*>`, 'i').exec(xml);
  return match?.[1]?.trim() || '';
}

function decodificarEntidadesBasicas(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function atributosDocZip(value: string) {
  const attrs = new Map<string, string>();
  for (const item of value.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*(["'])(.*?)\2/g)) attrs.set(item[1].toLowerCase(), item[3]);
  return attrs;
}

function validarNsu(value: string): string {
  const trimmed = value.trim();
  if (!NSU.test(trimmed)) throw new Error('A SEFAZ retornou um NSU inválido; a posição anterior foi preservada.');
  return BigInt(trimmed).toString();
}

function extrairChave(xml: string): string | null {
  const id = /<(?:[A-Za-z_][\w.-]*:)?infNFe\b[^>]*\bId\s*=\s*(["'])NFe([0-9A-Z]{44})\1/i.exec(xml);
  if (id) return id[2].toUpperCase();
  const value = extrairTag(xml, 'chNFe');
  return /^[0-9A-Z]{44}$/.test(value) ? value.toUpperCase() : null;
}

function extrairCpfCnpj(xml: string, parent: string): string {
  const content = extrairTag(xml, parent);
  const cnpj = extrairTag(content, 'CNPJ');
  return cnpj ? normalizarCnpj(cnpj) : extrairTag(content, 'CPF').replace(/\D/g, '');
}

function textoXml(xml: string, tag: string): string | null {
  const value = extrairTag(xml, tag);
  if (!value) return null;
  const decoded = decodificarEntidadesBasicas(value).trim();
  return decoded || null;
}

export function metadadosEvento(xml: string) {
  // procEventoNFe contém um infEvento no pedido e outro em retEvento.
  // Separar os blocos evita confundir dados informados no evento com o retorno SEFAZ.
  const evento = extrairTag(xml, 'evento');
  const infoPedido = extrairTag(evento, 'infEvento');
  const retornoEvento = extrairTag(xml, 'retEvento');
  const infoRetorno = extrairTag(retornoEvento, 'infEvento');
  const detalhe = extrairTag(infoPedido, 'detEvento');
  const chave = (textoXml(infoPedido, 'chNFe') || textoXml(xml, 'chNFe'))?.toUpperCase() || null;
  const chaveValida = chave && chaveNfeTemDigitoValido(chave) ? chave : null;
  const codigo = textoXml(infoPedido, 'tpEvento');
  const dataHora = textoXml(infoPedido, 'dhEvento');
  const seq = textoXml(infoPedido, 'nSeqEvento');
  const protocolo = textoXml(infoRetorno, 'nProt');
  const cStat = textoXml(infoRetorno, 'cStat');
  const motivo = textoXml(infoRetorno, 'xMotivo');
  return {
    codigoEvento: codigo && /^\d{6}$/.test(codigo) ? codigo : null,
    descricaoEvento: textoXml(detalhe, 'descEvento'),
    dataEvento: dataHora && /^\d{4}-\d{2}-\d{2}T/.test(dataHora) ? dataHora : null,
    sequenciaEvento: seq && /^\d{1,2}$/.test(seq) ? seq : null,
    protocoloEvento: protocolo && /^\d{1,20}$/.test(protocolo) ? protocolo : null,
    cStatEvento: cStat && /^\d{3}$/.test(cStat) ? cStat : null,
    motivoEvento: motivo,
    chave: chaveValida,
  };
}

function classificar(schema: string, xml: string, companyCnpj: string) {
  const lower = schema.toLowerCase();
  const tipo = lower.includes('evento') ? 'EVENTO'
    : lower.includes('resnfe') ? 'RESUMO_NFE'
      : lower.includes('procnfe') ? 'NFE_COMPLETA'
        : lower.includes('rescte') ? 'RESUMO_CTE'
          : lower.includes('proccte') ? 'CTE_COMPLETO' : 'OUTRO_DFE';
  const emitente = extrairCpfCnpj(xml, 'emit');
  const destinatario = extrairCpfCnpj(xml, 'dest');
  const direcao = emitente && emitente === companyCnpj ? 'SAIDA'
    : destinatario && destinatario === companyCnpj ? 'ENTRADA' : null;
  const valor = extrairTag(extrairTag(xml, 'ICMSTot'), 'vNF');
  const emissao = extrairTag(xml, 'dhEmi') || extrairTag(xml, 'dEmi');
  const date = /^\d{4}-\d{2}-\d{2}/.exec(emissao)?.[0] || null;
  const evento = tipo === 'EVENTO' ? metadadosEvento(xml) : null;
  const revisaoEstrutural = tipo === 'NFE_COMPLETA' ? revisarNfeDistribuida(xml, companyCnpj) : null;
  return { tipo, direcao, emitente: emitente || null, destinatario: destinatario || null,
    chave: evento?.chave || extrairChave(xml), valor: /^(?:0|[1-9]\d{0,13})(?:\.\d{1,2})?$/.test(valor) ? valor : null,
    emissao: date, ...(evento ? { evento } : {}), ...(revisaoEstrutural ? { revisaoEstrutural } : {}) };
}

function dataCivilValida(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : null;
}

function montarRequisicao(cnpj: string, ultNsu: string, ambiente: 'producao' | 'homologacao') {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const nsuPadded = ultNsu.padStart(15, '0');
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${tpAmb}</tpAmb>
          <CNPJ>${cnpj}</CNPJ>
          <distNSU><ultNSU>${nsuPadded}</ultNSU></distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap:Body>
</soap:Envelope>`;
}

function consultarSefaz(endpoint: string, pfx: Buffer, passphrase: string, body: string): Promise<{ status: number; xml: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    let settled = false;
    let totalTimeout: ReturnType<typeof setTimeout>;
    const finish = (error?: Error, result?: { status: number; xml: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(totalTimeout);
      if (error) reject(error);
      else resolve(result!);
    };
    const request = httpsRequest(url, {
      method: 'POST', pfx, passphrase, timeout: MAX_SEFAZ_REQUEST_MS,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `"${SOAP_ACTION}"`,
        Accept: 'text/xml', 'Content-Length': Buffer.byteLength(body, 'utf8'),
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      let total = 0;
      response.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > MAX_SOAP_BYTES) {
          response.destroy(new Error('A resposta da SEFAZ excedeu o tamanho máximo aceito.'));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      response.on('end', () => finish(undefined, { status: response.statusCode || 0, xml: Buffer.concat(chunks).toString('utf8') }));
      response.on('error', (error) => finish(error));
    });
    totalTimeout = setTimeout(() => request.destroy(new Error('Tempo total da consulta ao WebService da SEFAZ excedido.')), MAX_SEFAZ_REQUEST_MS);
    request.on('timeout', () => request.destroy(new Error('Tempo limite sem resposta do WebService da SEFAZ excedido.')));
    request.on('error', (error) => finish(error));
    request.end(body, 'utf8');
  });
}

export function lerRespostaSefaz(xml: string) {
  if (!xml.trim()) throw new Error('Resposta SOAP vazia.');
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('Resposta SOAP contém DTD/ENTITY não suportado.');
  const fault = extrairTag(xml, 'Fault');
  if (fault) throw new Error('O WebService da SEFAZ retornou uma falha SOAP.');
  const ret = extrairTag(xml, 'retDistDFeInt');
  if (!ret) throw new Error('A resposta não contém retDistDFeInt; o NSU não foi alterado.');
  const cStatRaw = extrairTag(ret, 'cStat');
  const cStat = Number(cStatRaw);
  if (!/^\d{3}$/.test(cStatRaw) || !Number.isInteger(cStat)) throw new Error('A resposta oficial não contém cStat válido; o NSU não foi alterado.');
  return {
    cStat,
    motivo: decodificarEntidadesBasicas(extrairTag(ret, 'xMotivo')).slice(0, 500),
    ultNsu: validarNsu(extrairTag(ret, 'ultNSU')),
    maxNsu: validarNsu(extrairTag(ret, 'maxNSU')),
    dhResp: extrairTag(ret, 'dhResp') || null,
    documentos: (() => {
      const matches = Array.from(ret.matchAll(/<(?:[A-Za-z_][\w.-]*:)?docZip\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?docZip\s*>/gi));
      if (matches.length > 100) throw new Error('A resposta excedeu o máximo de 100 documentos por lote; nenhum cursor foi avançado.');
      let totalBytes = 0;
      return matches.map((match) => {
        const attrs = atributosDocZip(match[1]);
        const nsu = validarNsu(attrs.get('nsu') || '');
        const schema = attrs.get('schema') || '';
        if (!/^[A-Za-z0-9_.-]{1,128}$/.test(schema)) throw new Error('Schema de documento recebido inválido; o lote não foi gravado.');
        const base64 = match[2].replace(/\s/g, '');
        if (!base64 || base64.length > Math.ceil(MAX_DOCUMENT_BYTES * 4 / 3) + 8) throw new Error('Documento compactado excede o limite; o lote não foi gravado.');
        const compressed = Buffer.from(base64, 'base64');
        if (!compressed.length || compressed.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, '')) {
          throw new Error('Conteúdo base64 de docZip inválido; o lote não foi gravado.');
        }
        const content = gunzipSync(compressed, { maxOutputLength: MAX_DOCUMENT_BYTES });
        totalBytes += content.length;
        if (totalBytes > MAX_BATCH_UNCOMPRESSED_BYTES) {
          content.fill(0);
          compressed.fill(0);
          throw new Error('O lote descompactado excedeu o limite de segurança; nenhum cursor foi avançado.');
        }
        let documentXml: string;
        try { documentXml = new TextDecoder('utf-8', { fatal: true }).decode(content); }
        catch { content.fill(0); throw new Error('Documento compactado não contém UTF-8 válido; o lote não foi gravado.'); }
        compressed.fill(0);
        if (!documentXml.trim() || /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(documentXml)) {
          content.fill(0);
          throw new Error('Documento XML vazio ou com DTD/entidade; o lote não foi gravado.');
        }
        const metadata = classificar(schema, documentXml, '');
        return { nsu, schema, documentXml, metadata };
      });
    })(),
  };
}

export function validarSequenciaDistribuicao(
  retorno: ReturnType<typeof lerRespostaSefaz>,
  ultimoNsuSalvo: string,
): void {
  const anterior = BigInt(validarNsu(ultimoNsuSalvo));
  const ult = BigInt(retorno.ultNsu);
  const max = BigInt(retorno.maxNsu);
  if (ult < anterior) throw new Error('A SEFAZ retornou ultNSU anterior à posição armazenada.');
  if (max < ult) throw new Error('A SEFAZ retornou maxNSU inferior a ultNSU.');
  if (retorno.cStat === 137 && (ult !== max || retorno.documentos.length !== 0)) {
    throw new Error('Resposta cStat 137 inconsistente com o lote/NSU.');
  }
  if (retorno.cStat === 138 && retorno.documentos.length === 0) {
    throw new Error('Resposta cStat 138 sem docZip.');
  }
  if (retorno.cStat !== 137 && retorno.cStat !== 138) return;
  const vistos = new Set<string>();
  let nsuAnteriorNoLote = anterior;
  for (const item of retorno.documentos) {
    const atual = BigInt(item.nsu);
    if (atual <= anterior || atual > ult || atual <= nsuAnteriorNoLote || vistos.has(item.nsu)) {
      throw new Error('NSU de docZip fora da sequência esperada.');
    }
    vistos.add(item.nsu);
    nsuAnteriorNoLote = atual;
  }
}

function idsValidos(tenantId: unknown, companyId: string): tenantId is string {
  return typeof tenantId === 'string' && UUID.test(tenantId) && UUID.test(companyId);
}

router.get('/companies/:companyId/sefaz-dfe/status', async (req, res) => {
  const tenantId = req.query.tenantId;
  const companyId = req.params.companyId;
  if (!idsValidos(tenantId, companyId)) return res.status(400).json({ mensagem: 'Escritório ou empresa inválidos.' });
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const scoped = await comContextoTenant(user.id, tenantId, async (client) => {
      const [company, certificate, cursor, count] = await Promise.all([
        client.query('SELECT id FROM fiscoia.companies WHERE id=$1 AND tenant_id=$2 AND archived_at IS NULL LIMIT 1', [companyId, tenantId]),
        client.query('SELECT uploaded_at, pfx_sha256 FROM fiscoia.company_fiscal_certificates WHERE tenant_id=$1 AND company_id=$2', [tenantId, companyId]),
        client.query('SELECT last_nsu, max_nsu, last_status, last_message, last_request_at, last_response_at, blocked_until, validated_certificate_sha256, certificate_validated_at FROM fiscoia.fiscal_dfe_cursors WHERE tenant_id=$1 AND company_id=$2', [tenantId, companyId]),
        client.query('SELECT count(*)::text AS total FROM fiscoia.fiscal_dfe_items WHERE tenant_id=$1 AND company_id=$2', [tenantId, companyId]),
      ]);
      if (!company.rows[0]) return null;
      const row = cursor.rows[0];
      return {
        certificadoCadastrado: Boolean(certificate.rows[0]),
        certificadoValidadoPelaSefaz: Boolean(row?.validated_certificate_sha256 && certificate.rows[0]
          && String(row.validated_certificate_sha256).trim() === String(certificate.rows[0].pfx_sha256).trim()),
        certificadoValidadoEm: row?.certificate_validated_at ?? null,
        consultaOficialAtiva: false,
        ambienteConfigurado: process.env.FISCOIA_SEFAZ_DFE_ENV === 'homologacao' ? 'homologacao' : 'producao',
        ultimoNsu: row ? String(row.last_nsu) : '0',
        maiorNsu: row ? String(row.max_nsu) : '0',
        ultimoStatusSefaz: row?.last_status ?? null,
        mensagemSefaz: row?.last_message ?? null,
        ultimaTentativaEm: row?.last_request_at ?? null,
        consultadoEm: row?.last_response_at ?? null,
        bloqueadoAte: row?.blocked_until ?? null,
        documentosPersistidos: String(count.rows[0]?.total || '0'),
        requerConfirmacao: true,
      };
    });
    if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!scoped.resultado) return res.status(404).json({ mensagem: 'Empresa ativa não encontrada neste escritório.' });
    return res.json(scoped.resultado);
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível consultar o estado da integração SEFAZ.' });
  }
});

/** Consulta um lote oficial por ação confirmada; não existe envio automático ao portal. */
router.post('/companies/:companyId/sefaz-dfe/consult', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = req.body?.tenantId;
  const companyId = req.params.companyId;
  if (!idsValidos(tenantId, companyId)) return res.status(400).json({ mensagem: 'Escritório ou empresa inválidos.' });
  if (req.body?.confirmarConsulta !== true) return res.status(428).json({ mensagem: 'Confirme explicitamente a consulta oficial. Nenhuma conexão foi iniciada.' });
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  let pfx: Buffer | null = null;
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const membership = await comContextoTenant(user.id, tenantId, async () => true, ['OWNER', 'ADMIN', 'CONTADOR']);
    if (!membership.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!('resultado' in membership)) return res.status(403).json({ mensagem: 'Seu perfil não pode iniciar uma consulta oficial da SEFAZ.' });
    const certificate = await obterCertificadoFiscalDaEmpresa(user.id, tenantId, companyId);
    if (!certificate) return res.status(409).json({ mensagem: 'Cadastre o certificado A1 desta empresa antes da consulta. Nenhuma conexão foi iniciada.' });
    pfx = certificate.pfx;
    const certificateFingerprint = createHash('sha256').update(pfx).digest('hex');
    const cnpjConsulta = normalizarCnpj(certificate.cnpj);
    if (!validarCnpj(cnpjConsulta)) return res.status(422).json({ mensagem: 'O CNPJ vinculado ao certificado não tem 14 posições ou dígitos verificadores válidos.' });

    // O lock da posição NSU serializa consultas concorrentes desta empresa. A transação
    // é curta e nunca atualiza NSU sem resposta oficial parseável e persistência completa.
    const scoped = await comContextoTenant(user.id, tenantId, async (client) => {
      const company = await client.query('SELECT cnpj FROM fiscoia.companies WHERE id=$1 AND tenant_id=$2 AND archived_at IS NULL LIMIT 1', [companyId, tenantId]);
      if (!company.rows[0]) return { kind: 'erro' as const, erro: 'Empresa ativa não encontrada neste escritório.' };
      if (normalizarCnpj(String(company.rows[0].cnpj)) !== cnpjConsulta) return { kind: 'erro' as const, erro: 'O CNPJ da credencial mudou; nenhum documento foi consultado.' };
      await client.query(
        `INSERT INTO fiscoia.fiscal_dfe_cursors (tenant_id, company_id) VALUES ($1,$2)
         ON CONFLICT (tenant_id, company_id) DO NOTHING`, [tenantId, companyId],
      );
      const locked = await client.query(
        'SELECT last_nsu, blocked_until, last_request_at FROM fiscoia.fiscal_dfe_cursors WHERE tenant_id=$1 AND company_id=$2 FOR UPDATE',
        [tenantId, companyId],
      );
      const cursor = locked.rows[0];
      const blockedUntil = cursor.blocked_until ? new Date(cursor.blocked_until).getTime() : 0;
      if (blockedUntil > Date.now()) return { kind: 'bloqueado' as const, ate: cursor.blocked_until };
      const lastRequest = cursor.last_request_at ? new Date(cursor.last_request_at).getTime() : 0;
      if (Date.now() - lastRequest < MIN_SEFAZ_REQUEST_GAP_MS) return { kind: 'ocupado' as const };

      // A cota e o bloqueio oficial são por CNPJ, inclusive se ele estiver
      // cadastrado em mais de um tenant. A função serializa e grava a reserva
      // antes de iniciar a chamada externa; falhas de rede também contam.
      const rate = await client.query(
        'SELECT allowed, retry_at, requests_in_window FROM fiscoia.reserve_sefaz_dfe_request($1, $2, $3)',
        [cnpjConsulta, tenantId, companyId],
      );
      if (rate.rows[0]?.allowed !== true) {
        const retryAt = rate.rows[0]?.retry_at || new Date(Date.now() + 60 * 60_000).toISOString();
        await client.query(
          'UPDATE fiscoia.fiscal_dfe_cursors SET blocked_until=$3, updated_at=now() WHERE tenant_id=$1 AND company_id=$2',
          [tenantId, companyId, retryAt],
        );
        return { kind: 'bloqueado' as const, ate: retryAt };
      }

      const ambiente = process.env.FISCOIA_SEFAZ_DFE_ENV === 'homologacao' ? 'homologacao' : 'producao';
      const endpoint = ENDPOINTS[ambiente];
      const requestXml = montarRequisicao(cnpjConsulta, String(cursor.last_nsu), ambiente);
      await client.query('UPDATE fiscoia.fiscal_dfe_cursors SET last_request_at=now(), updated_at=now() WHERE tenant_id=$1 AND company_id=$2', [tenantId, companyId]);

      // Persiste a reserva antes da rede. Se TLS, HTTP, parsing ou persistência falhar,
      // o rollback da resposta não pode apagar a hora da tentativa e permitir repetição imediata.
      await client.query(
        `INSERT INTO fiscoia.audit_events (tenant_id, actor_user_id, event_type, entity_type, entity_id, details)
         VALUES ($1,$2,'sefaz.dfe.consult_started','company',$3,$4::jsonb)`,
        [tenantId, user.id, companyId, JSON.stringify({ ambiente, ultNSU: String(cursor.last_nsu) })],
      );
      await client.query('COMMIT');
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.user_id', $1, true)", [user.id]);
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const cursorReaberto = await client.query(
        'SELECT last_nsu FROM fiscoia.fiscal_dfe_cursors WHERE tenant_id=$1 AND company_id=$2 FOR UPDATE',
        [tenantId, companyId],
      );
      if (!cursorReaberto.rows[0] || String(cursorReaberto.rows[0].last_nsu) !== String(cursor.last_nsu)) {
        return { kind: 'ocupado' as const };
      }

      let response: { status: number; xml: string };
      try { response = await consultarSefaz(endpoint, pfx!, certificate.passphrase, requestXml); }
      catch { throw new Error('Falha de transporte TLS com o WebService oficial. O NSU anterior foi preservado.'); }
      if (response.status < 200 || response.status >= 300) throw new Error(`O WebService oficial respondeu HTTP ${response.status}; a posição NSU foi preservada.`);

      let retorno;
      try { retorno = lerRespostaSefaz(response.xml); }
      catch (error) { throw error instanceof Error ? error : new Error('Resposta oficial inválida; posição NSU preservada.'); }
      if (retorno.cStat !== 137 && retorno.cStat !== 138) {
        const globalBlock = retorno.cStat === 656
          ? await client.query(
            'SELECT fiscoia.block_sefaz_dfe_cnpj($1, $2, $3, now() + interval \'1 hour\') AS blocked_until',
            [cnpjConsulta, tenantId, companyId],
          )
          : null;
        const bloqueadoAte = globalBlock?.rows[0]?.blocked_until || null;
        await client.query(
          `UPDATE fiscoia.fiscal_dfe_cursors
              SET last_status=$3, last_message=$4, last_response_at=now(),
                  blocked_until=$5, updated_at=now()
            WHERE tenant_id=$1 AND company_id=$2`,
          [tenantId, companyId, retorno.cStat, retorno.motivo || 'A SEFAZ não confirmou a distribuição; NSU preservado.', bloqueadoAte],
        );
        await client.query(
          `INSERT INTO fiscoia.audit_events (tenant_id, actor_user_id, event_type, entity_type, entity_id, details)
           VALUES ($1,$2,'sefaz.dfe.consultada','company',$3,$4::jsonb)`,
          [tenantId, user.id, companyId, JSON.stringify({ ambiente, cStat: retorno.cStat, documentosRecebidos: 0,
            ultNSUPreservado: String(cursor.last_nsu), maxNSUPreservado: String(cursor.max_nsu) })],
        );
        return { kind: 'concluido' as const, ambiente, cStat: retorno.cStat,
          mensagem: retorno.motivo || 'A SEFAZ não confirmou a distribuição; a posição NSU foi preservada.',
          documentosRecebidos: 0, documentosNovos: 0, ultimoNsu: String(cursor.last_nsu), maiorNsu: String(cursor.max_nsu),
          bloqueadoAte,
          consultadoEm: new Date().toISOString(),
          proximaAcao: retorno.cStat === 656 ? 'Consumo indevido: aguardar uma hora antes de nova consulta.' : 'Confira o cStat antes de tentar novamente.' };
      }
      // Direção usa os CNPJs do XML quando fornecidos e nunca infere participante ausente.
      for (const item of retorno.documentos) {
        item.metadata = classificar(item.schema, item.documentXml, cnpjConsulta);
      }

      const nsuAtual = BigInt(String(cursor.last_nsu));
      validarSequenciaDistribuicao(retorno, String(cursor.last_nsu));

      let novos = 0;
      let notasFiscalNormalizadas = 0;
      for (const item of retorno.documentos) {
        const digest = createHash('sha256').update(item.documentXml, 'utf8').digest('hex');
        const plaintext = Buffer.from(item.documentXml, 'utf8');
        let encrypted;
        try { encrypted = criptografarSegredoEmpresa(tenantId, companyId, plaintext); }
        finally { plaintext.fill(0); }
        const saved = await client.query(
          `INSERT INTO fiscoia.fiscal_dfe_items
             (tenant_id, company_id, document_nsu, schema_name, access_key, content_ciphertext, content_nonce, content_auth_tag,
              encryption_key_version, content_sha256, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
           ON CONFLICT (tenant_id, company_id, document_nsu) DO NOTHING RETURNING id`,
          [tenantId, companyId, item.nsu, item.schema, item.metadata.chave, encrypted.ciphertext, encrypted.nonce,
            encrypted.authTag, encrypted.keyVersion, digest, JSON.stringify({ ...item.metadata, origem: 'SEFAZ_DISTRIBUICAO_DFE' })],
        );
        if (saved.rowCount) novos += 1;
        else {
          const existing = await client.query(
            `SELECT content_sha256 FROM fiscoia.fiscal_dfe_items
              WHERE tenant_id=$1 AND company_id=$2 AND document_nsu=$3 LIMIT 1`,
            [tenantId, companyId, item.nsu],
          );
          const existingHash = existing.rows[0]?.content_sha256 ? String(existing.rows[0].content_sha256).trim() : '';
          if (existingHash !== digest) {
            throw new Error('O mesmo NSU já existe com conteúdo diferente. O lote foi recusado e a posição NSU não avançou.');
          }
        }

        // Só normaliza NF-e quando modelo, chave válida e participante estão
        // explícitos no XML. Resumos incompletos e eventos permanecem no arquivo DF-e.
        if ((item.metadata.tipo === 'NFE_COMPLETA' || item.metadata.tipo === 'RESUMO_NFE')
          && item.metadata.chave && chaveNfeTemDigitoValido(item.metadata.chave)
          && (item.metadata.direcao === 'ENTRADA' || item.metadata.direcao === 'SAIDA')) {
          const ide = extrairTag(item.documentXml, 'ide');
          const modelo = extrairTag(ide, 'mod');
          if (modelo === '55' || modelo === '65') {
            const fullXml = item.metadata.tipo === 'NFE_COMPLETA'
              ? criptografarXml(tenantId, companyId, item.documentXml)
              : null;
            const normalized = await client.query(
              `INSERT INTO fiscoia.fiscal_documents
                 (tenant_id, company_id, access_key, document_type, issued_on, total_amount, status, source,
                  xml_ciphertext, xml_nonce, xml_auth_tag, encryption_key_version, xml_sha256, metadata)
               VALUES ($1,$2,$3,$4,$5,$6,'PENDING_REVIEW','SEFAZ_DISTRIBUICAO_DFE',$7,$8,$9,$10,$11,$12::jsonb)
               ON CONFLICT (tenant_id, company_id, access_key) DO NOTHING RETURNING id`,
              [tenantId, companyId, item.metadata.chave, modelo === '55' ? 'NFE' : 'NFCE',
                dataCivilValida(item.metadata.emissao), item.metadata.valor, fullXml?.ciphertext ?? null,
                fullXml?.nonce ?? null, fullXml?.authTag ?? null, fullXml?.keyVersion ?? null,
                fullXml ? digest : null,
                JSON.stringify({ ...item.metadata, nsu: item.nsu, schema: item.schema,
                  direction: item.metadata.direcao, xmlCompletoDisponivel: Boolean(fullXml),
                  origemOficial: 'DISTRIBUICAO_DFE', statusConferencia: 'PENDENTE',
                  revisaoEstrutural: item.metadata.revisaoEstrutural ?? null })],
            );
            if (normalized.rowCount) notasFiscalNormalizadas += 1;
          }
        }
      }

      const mensagem = retorno.motivo || 'Resposta recebida da SEFAZ.';
      const bloqueio = retorno.cStat === 137 || retorno.cStat === 656;
      const globalBlock = bloqueio
        ? await client.query(
          'SELECT fiscoia.block_sefaz_dfe_cnpj($1, $2, $3, now() + interval \'1 hour\') AS blocked_until',
          [cnpjConsulta, tenantId, companyId],
        )
        : null;
      const bloqueadoAte = globalBlock?.rows[0]?.blocked_until || null;
      const cursorResult = await client.query(
        `UPDATE fiscoia.fiscal_dfe_cursors
            SET last_nsu=$3, max_nsu=$4, last_status=$5, last_message=$6, last_response_at=now(),
                blocked_until=$7,
                validated_certificate_sha256=COALESCE($8, validated_certificate_sha256),
                certificate_validated_at=CASE WHEN $8 IS NULL THEN certificate_validated_at ELSE now() END,
                updated_at=now()
          WHERE tenant_id=$1 AND company_id=$2 RETURNING last_nsu, max_nsu, blocked_until, last_response_at`,
        [tenantId, companyId, retorno.ultNsu, retorno.maxNsu, retorno.cStat, mensagem, bloqueadoAte,
          retorno.cStat === 137 || retorno.cStat === 138 ? certificateFingerprint : null],
      );
      await client.query(
        `INSERT INTO fiscoia.audit_events (tenant_id, actor_user_id, event_type, entity_type, entity_id, details)
         VALUES ($1,$2,'sefaz.dfe.consultada','company',$3,$4::jsonb)`,
        [tenantId, user.id, companyId, JSON.stringify({ ambiente, cStat: retorno.cStat, documentosRecebidos: retorno.documentos.length,
          documentosNovos: novos, notasFiscalNormalizadas, ultNSUAnterior: String(cursor.last_nsu), ultNSU: retorno.ultNsu, maxNSU: retorno.maxNsu })],
      );
      return {
        kind: 'concluido' as const,
        ambiente, cStat: retorno.cStat, mensagem,
        documentosRecebidos: retorno.documentos.length, documentosNovos: novos, notasFiscalNormalizadas,
        ultimoNsu: String(cursorResult.rows[0].last_nsu), maiorNsu: String(cursorResult.rows[0].max_nsu),
        bloqueadoAte: cursorResult.rows[0].blocked_until, consultadoEm: cursorResult.rows[0].last_response_at,
        proximaAcao: retorno.cStat === 137 ? 'Aguardar uma hora antes de nova consulta.'
          : retorno.cStat === 656 ? 'Consumo indevido: aguardar uma hora antes de nova consulta.'
            : retorno.cStat === 138 ? 'Lote persistido. Se ultNSU for inferior a maxNSU, consulte novamente para continuar a distribuição.'
              : 'Confira o cStat e o motivo retornados pela SEFAZ antes de tentar novamente.',
      };
    }, ['OWNER', 'ADMIN', 'CONTADOR']);
    if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!('resultado' in scoped)) return res.status(403).json({ mensagem: 'Seu perfil não pode iniciar uma consulta oficial da SEFAZ.' });
    if (!scoped.resultado) return res.status(404).json({ mensagem: 'Empresa não encontrada.' });
    if (scoped.resultado.kind === 'erro') return res.status(404).json({ mensagem: scoped.resultado.erro });
    if (scoped.resultado.kind === 'bloqueado') return res.status(429).json({ mensagem: 'Consulta suspensa até cumprir o intervalo indicado pela SEFAZ.', bloqueadoAte: scoped.resultado.ate });
    if (scoped.resultado.kind === 'ocupado') return res.status(429).json({ mensagem: 'Já há uma consulta recente em processamento. Aguarde antes de tentar novamente.' });
    return res.json({ sucesso: true, ...scoped.resultado,
      observacao: 'A resposta oficial foi persistida. Validação do certificado significa apenas que este A1 recebeu resposta válida da SEFAZ nesta consulta; não confirma autorização para outros serviços.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível concluir a consulta oficial. O NSU foi preservado.';
    return res.status(502).json({ sucesso: false, mensagem: message });
  } finally {
    pfx?.fill(0);
  }
});

router.get('/companies/:companyId/sefaz-dfe/items', async (req, res) => {
  const tenantId = req.query.tenantId;
  const companyId = req.params.companyId;
  if (!idsValidos(tenantId, companyId)) return res.status(400).json({ mensagem: 'Escritório ou empresa inválidos.' });
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const scoped = await comContextoTenant(user.id, tenantId, async (client) => {
      const result = await client.query(
        `SELECT i.id, i.document_nsu, i.schema_name, i.access_key, i.content_sha256, i.metadata, i.received_at,
                d.id AS related_document_id, d.status AS related_document_status
           FROM fiscoia.fiscal_dfe_items i
           LEFT JOIN fiscoia.fiscal_documents d
             ON d.tenant_id=i.tenant_id AND d.company_id=i.company_id
            AND d.access_key=i.access_key AND i.metadata->>'tipo'='EVENTO'
          WHERE i.tenant_id=$1 AND i.company_id=$2
          ORDER BY i.document_nsu DESC LIMIT 100`, [tenantId, companyId],
      );
      return result.rows.map((row) => ({ id: String(row.id), nsu: String(row.document_nsu), schema: row.schema_name,
        chave: row.access_key || null, hashXml: String(row.content_sha256).trim(), metadata: row.metadata, recebidoEm: row.received_at,
        notaVinculada: row.related_document_id ? { status: String(row.related_document_status) } : null }));
    });
    if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    return res.json({ documentos: scoped.resultado || [], limite: 100 });
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível listar os documentos distribuídos.' });
  }
});

router.get('/companies/:companyId/sefaz-dfe/items/:itemId/xml', async (req, res) => {
  const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : '';
  const { companyId, itemId } = req.params;
  if (!UUID.test(tenantId) || !UUID.test(companyId) || !UUID.test(itemId)) return res.status(400).json({ mensagem: 'Escritório, empresa ou documento inválido.' });
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const scoped = await comContextoTenant(user.id, tenantId, async (client) => {
      const result = await client.query(
        `SELECT document_nsu, content_ciphertext, content_nonce, content_auth_tag, encryption_key_version
           FROM fiscoia.fiscal_dfe_items WHERE id=$1 AND tenant_id=$2 AND company_id=$3 LIMIT 1`, [itemId, tenantId, companyId],
      );
      const row = result.rows[0];
      if (!row) return null;
      const content = descriptografarSegredoEmpresa(tenantId, companyId, {
        ciphertext: row.content_ciphertext, nonce: row.content_nonce, authTag: row.content_auth_tag,
        keyVersion: String(row.encryption_key_version),
      });
      return { content, nsu: String(row.document_nsu) };
    });
    if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!scoped.resultado) return res.status(404).json({ mensagem: 'Documento não encontrado.' });
    const xml = scoped.resultado.content.toString('utf8');
    scoped.resultado.content.fill(0);
    res.type('application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dfe-nsu-${scoped.resultado.nsu}.xml"`);
    return res.send(xml);
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível abrir o documento; o conteúdo criptografado foi preservado.' });
  }
});

export default router;
