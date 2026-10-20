import { Router } from 'express';
import { obterUsuarioDaSessao } from './auth.routes';
import { comContextoTenant, obterPoolBanco } from './persistence';
import { normalizarCnpj, validarCnpj } from '../services/cnpj/cnpjValidation';
import {
  conferirDocumentos,
  type DocumentoConferencia,
  type DocumentoFiscalResumo,
} from '../services/conferencia/conferenciaDocumentos';

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const FISCAL_URL_PADRAO = 'https://murade-fiscal-1.onrender.com';
const MAX_DOCUMENTOS = 20_000;
const POR_PAGINA = 500;
const MAX_PAGINAS = 20;

function dataValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !DATA.test(valor)) return false;
  const [a, m, d] = valor.split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
}

function urlFiscal(): URL | null {
  try {
    const url = new URL(process.env.MURADE_FISCAL_SERVER_URL || FISCAL_URL_PADRAO);
    // O token de integração só é enviado ao serviço Fiscal próprio.
    if (url.protocol !== 'https:' || url.hostname !== 'murade-fiscal-1.onrender.com' || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

async function listarResumoFiscal(cnpj: string, desde: string, ate: string): Promise<
  { ok: true; documentos: DocumentoFiscalResumo[]; parcial: boolean } | { ok: false; motivo: string }
> {
  const token = process.env.MURADE_INTEGRATION_TOKEN?.trim();
  if (!token) return { ok: false, motivo: 'A ligação com o Murade Fiscal ainda não foi configurada neste servidor (falta a credencial de integração).' };
  const base = urlFiscal();
  if (!base) return { ok: false, motivo: 'O endereço do Murade Fiscal não está configurado de forma segura.' };
  const documentos: DocumentoFiscalResumo[] = [];
  let cursor = '';
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
    const url = new URL('/api/integracao/fiscal/documentos', base);
    url.searchParams.set('cnpj', cnpj);
    url.searchParams.set('desde', desde);
    url.searchParams.set('ate', ate);
    url.searchParams.set('limite', String(POR_PAGINA));
    url.searchParams.set('resumo', '1');
    if (cursor) url.searchParams.set('cursor', cursor);
    let resposta: Response;
    try {
      resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
    } catch {
      return { ok: false, motivo: 'O Murade Fiscal não respondeu a tempo.' };
    }
    if (resposta.status === 401) return { ok: false, motivo: 'A credencial entre o Fisco IA e o Murade Fiscal não foi aceita.' };
    if (!resposta.ok) return { ok: false, motivo: `O Murade Fiscal respondeu com erro (HTTP ${resposta.status}).` };
    const corpo = await resposta.json().catch(() => null) as {
      sucesso?: boolean; cnpj?: string; resumo?: boolean; documentos?: Array<Record<string, unknown>>; proximoCursor?: string | null;
    } | null;
    if (!corpo || corpo.sucesso !== true || normalizarCnpj(String(corpo.cnpj || '')) !== cnpj || !Array.isArray(corpo.documentos)) {
      return { ok: false, motivo: 'Resposta do Murade Fiscal inválida ou de outro CNPJ.' };
    }
    if (corpo.resumo !== true) return { ok: false, motivo: 'O Murade Fiscal ainda não oferece a consulta resumida; atualize o serviço Fiscal.' };
    for (const item of corpo.documentos) {
      const chave = String(item.chaveAcesso || '').trim();
      if (!chave) continue;
      const valor = Number(item.valorTotal);
      documentos.push({
        chave,
        emissao: typeof item.dataEmissao === 'string' && DATA.test(item.dataEmissao) ? item.dataEmissao : null,
        valor: item.valorTotal == null || !Number.isFinite(valor) ? null : valor,
        status: typeof item.statusSefaz === 'string' ? item.statusSefaz : null,
      });
    }
    cursor = typeof corpo.proximoCursor === 'string' ? corpo.proximoCursor : '';
    if (!cursor) return { ok: true, documentos, parcial: false };
  }
  return { ok: true, documentos, parcial: true };
}

router.get('/companies/:companyId/conferencia', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente indisponível; nenhuma conferência foi feita.' });
  const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : '';
  const companyId = req.params.companyId;
  const desde = req.query.desde;
  const ate = req.query.ate;
  if (!UUID.test(tenantId) || !UUID.test(companyId)) return res.status(400).json({ mensagem: 'Escritório ou empresa inválidos.' });
  if (!dataValida(desde) || !dataValida(ate) || desde > ate) {
    return res.status(400).json({ mensagem: 'Informe um período válido, com datas inicial e final no formato AAAA-MM-DD.' });
  }
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const escopo = await comContextoTenant(user.id, tenantId, async (client) => {
      const empresa = await client.query(
        'SELECT cnpj FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 AND archived_at IS NULL LIMIT 1',
        [companyId, tenantId],
      );
      if (!empresa.rows[0]) return null;
      const linhas = await client.query(
        `SELECT access_key, issued_on, total_amount, status, metadata
           FROM fiscoia.fiscal_documents
          WHERE tenant_id = $1 AND company_id = $2 AND issued_on BETWEEN $3 AND $4
          ORDER BY issued_on, access_key
          LIMIT $5`,
        [tenantId, companyId, desde, ate, MAX_DOCUMENTOS + 1],
      );
      return { cnpj: normalizarCnpj(String(empresa.rows[0].cnpj)), linhas: linhas.rows };
    });
    if (!escopo.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!escopo.resultado) return res.status(404).json({ mensagem: 'Empresa não encontrada neste escritório.' });
    const { cnpj, linhas } = escopo.resultado;
    if (!validarCnpj(cnpj)) return res.status(422).json({ mensagem: 'O CNPJ cadastrado para a empresa não é válido; nada foi conferido.' });
    if (linhas.length > MAX_DOCUMENTOS) return res.status(422).json({ mensagem: 'Período grande demais para uma conferência; escolha um intervalo menor.' });

    const documentos: DocumentoConferencia[] = linhas.map((linha) => ({
      chave: String(linha.access_key).trim(),
      direcao: linha.metadata?.direction === 'SAIDA' || linha.metadata?.direction === 'ENTRADA' ? linha.metadata.direction : null,
      emissao: linha.issued_on ? String(linha.issued_on).slice(0, 10) : null,
      valor: linha.total_amount === null ? null : Number(linha.total_amount),
      status: linha.status ? String(linha.status) : null,
    }));

    const fiscal = await listarResumoFiscal(cnpj, desde, ate);
    const resultado = conferirDocumentos({
      cnpjEmpresa: cnpj,
      documentos,
      fiscal: fiscal.ok && !fiscal.parcial ? fiscal.documentos : null,
    });
    return res.json({
      sucesso: true,
      cnpj,
      periodo: { desde, ate },
      ...resultado,
      fiscal: fiscal.ok === true
        ? { disponivel: true, parcial: fiscal.parcial, documentos: fiscal.documentos.length,
            aviso: fiscal.parcial ? 'Período grande: a comparação com o Murade Fiscal não foi feita. Escolha um intervalo menor.' : null }
        : { disponivel: false, parcial: false, documentos: 0, aviso: (fiscal as { motivo: string }).motivo },
    });
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível concluir a conferência agora. Nenhum dado foi alterado.' });
  }
});

export default router;
