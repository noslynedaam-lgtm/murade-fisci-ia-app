import { Router } from 'express';
import https from 'node:https';
import { prepararPfx, pfxDeVariavel } from './pfxCompat';
import { obterUsuarioDaSessao } from './auth.routes';
import { CATALOGO_SERVICOS, avaliarProntidao, montarPedido, validarDadosCaixaPostal, validarDadosDctfweb, validarDadosParcsn, validarDadosPgmei } from '../services/serpro/integraContador';
import { acharPdfBase64, lerProtocoloSitfis, lerXmlDeclaracao, lerReciboTransmissao } from '../services/serpro/resultadoSerpro';
import { avaliarCota, decidirConsulta, registrarConsulta, type CotaEmpresa, type OrigemConsulta } from '../services/serpro/cotaSemanal';
import { comContextoTenant, obterPoolBanco } from './persistence';
import { normalizarCnpj, validarCnpj } from '../services/cnpj/cnpjValidation';
import { cicloDe, montarExtrato, extratoParaCsv, type EmpresaConsumo, type OperacaoSerpro } from '../services/serpro/consumoSerpro';
import { tokenValido } from './agentesEntreSistemas';
import { buscarTokenProcurador, SemTokenProcurador } from './tokenProcuradorFiscal';
import { assinarDeclaracaoDctfweb, lerCertificadoAssinante, montarDadosTransmissao, sha256Hex } from '../services/serpro/assinaturaDctfweb';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAPEIS_CONSULTA = ['OWNER', 'ADMIN'];

const router = Router();
const GATEWAY_BY_ENVIRONMENT = {
  homologacao: 'https://gateway-val.apiserpro.serpro.gov.br',
  producao: 'https://gateway.apiserpro.serpro.gov.br',
} as const;

router.get('/config-status', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    if (!user.ehAdmin) return res.status(403).json({ mensagem: 'Somente a conta administradora pode consultar o estado das credenciais SERPRO.' });

    const statusDoAmbiente = (prefixo: 'SERPRO_VALIDACAO' | 'SERPRO_PRODUCAO') => {
      const consumerKeyConfigurada = Boolean(process.env[`${prefixo}_CONSUMER_KEY`]?.trim());
      const consumerSecretConfigurado = Boolean(process.env[`${prefixo}_CONSUMER_SECRET`]?.trim());
      return {
        consumerKeyConfigurada,
        consumerSecretConfigurado,
        prontoParaTeste: consumerKeyConfigurada && consumerSecretConfigurado,
      };
    };

    return res.json({
      validacao: statusDoAmbiente('SERPRO_VALIDACAO'),
      producao: statusDoAmbiente('SERPRO_PRODUCAO'),
      observacao: 'O estado indica somente se os segredos existem no servidor. Não confirma autenticação, contrato, escopos ou acesso a uma API de produto.',
    });
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível consultar o estado das credenciais SERPRO.' });
  }
});

// Leitura entre sistemas (token de integração): informa apenas SE os segredos existem. Nunca devolve valores.
router.get('/status-integracao', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!tokenValido(req.get('authorization'))) return res.status(401).json({ mensagem: 'Credencial de integração inválida.' });
  const tem = (n: string) => Boolean(process.env[n]?.trim());
  return res.json({
    producao: { consumerKey: tem('SERPRO_PRODUCAO_CONSUMER_KEY'), consumerSecret: tem('SERPRO_PRODUCAO_CONSUMER_SECRET') },
    certificadoEscritorio: tem('SERPRO_CERT_PFX_BASE64') && tem('SERPRO_CERT_PFX_SENHA'),
    cnpjContratante: tem('SERPRO_CONTRATANTE_CNPJ'),
    observacao: 'Indica só a presença das variáveis no servidor; não confirma contrato, escopos nem autenticação.',
  });
});

router.post('/token-check', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  const ambiente = req.body?.ambiente;
  if (ambiente !== 'homologacao' && ambiente !== 'producao') {
    return res.status(400).json({ mensagem: 'Selecione homologação ou produção.' });
  }

  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    if (!user.ehAdmin) return res.status(403).json({ mensagem: 'Somente a conta administradora pode testar a configuração SERPRO.' });

    const prefixo = ambiente === 'producao' ? 'SERPRO_PRODUCAO' : 'SERPRO_VALIDACAO';
    const consumerKey = process.env[`${prefixo}_CONSUMER_KEY`]?.trim();
    const consumerSecret = process.env[`${prefixo}_CONSUMER_SECRET`]?.trim();
    if (!consumerKey || !consumerSecret) {
      return res.status(503).json({
        testado: false,
        autenticado: false,
        ambiente,
        mensagem: `As variáveis ${prefixo}_CONSUMER_KEY e ${prefixo}_CONSUMER_SECRET ainda não estão configuradas no ambiente privado do serviço.`,
      });
    }

    // Integra Contador autentica em outro endereço e exige o e-CNPJ do escritório (mTLS).
    if (ambiente === 'producao' && process.env.SERPRO_CERT_PFX_BASE64?.trim() && process.env.SERPRO_CERT_PFX_SENHA) {
      try {
        const pfx = pfxDeVariavel(process.env.SERPRO_CERT_PFX_BASE64);
        const preparado = prepararPfx(pfx, process.env.SERPRO_CERT_PFX_SENHA);
        if (preparado.ok === false) {
          return res.status(502).json({ testado: true, autenticado: false, ambiente, mensagem: preparado.motivo === 'senha'
            ? 'A senha do certificado do escritório (SERPRO_CERT_PFX_SENHA) não abre o arquivo informado.'
              : `O conteúdo de SERPRO_CERT_PFX_BASE64 não pôde ser lido como certificado .pfx/.p12${preparado.detalhe ? ` (${preparado.detalhe})` : ''}.` });
        }
        const basic = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
        const inicio = Date.now();
        const auth = await chamarHttps('https://autenticacao.sapi.serpro.gov.br/authenticate', {
          method: 'POST', pfx: preparado.pfx, passphrase: process.env.SERPRO_CERT_PFX_SENHA,
          headers: { Authorization: `Basic ${basic}`, 'Role-Type': 'TERCEIROS', 'Content-Type': 'application/x-www-form-urlencoded' },
        }, 'grant_type=client_credentials');
        if (auth.status === 200) {
          let ok = false;
          try { const t = JSON.parse(auth.texto); ok = Boolean(t.access_token && t.jwt_token); } catch { /* formato inesperado */ }
          return ok
            ? res.json({ testado: true, autenticado: true, ambiente, expiraEmSegundos: 0, mensagem: 'Autenticação do Integra Contador confirmada (chaves + certificado do escritório). Nenhuma consulta paga foi feita.' })
            : res.status(502).json({ testado: true, autenticado: false, ambiente, mensagem: 'O SERPRO respondeu, mas sem o token esperado.' });
        }
        return res.status(502).json({ testado: true, autenticado: false, ambiente, statusGateway: auth.status, latenciaMs: Date.now() - inicio, mensagem: auth.status === 401 || auth.status === 403
          ? 'O SERPRO recusou a autenticação do Integra Contador. Confira se a Consumer Key/Secret são do contrato Integra Contador em produção (sem espaços) e se o certificado e-CNPJ é o do escritório contratante.'
          : 'O SERPRO não confirmou a autenticação do Integra Contador. Tente novamente mais tarde.' });
      } catch {
        return res.status(502).json({ testado: true, autenticado: false, ambiente, mensagem: 'Não foi possível completar a conexão segura (mTLS) com o SERPRO. Nenhum detalhe de credencial foi registrado.' });
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    let responseBody: string;
    try {
      response = await fetch(`${GATEWAY_BY_ENVIRONMENT[ambiente]}/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
        signal: controller.signal,
      });
      responseBody = await response.text();
    } catch {
      return res.status(502).json({
        testado: true,
        autenticado: false,
        ambiente,
        mensagem: 'Não foi possível completar a conexão TLS com o gateway SERPRO. Nenhum detalhe de credencial foi registrado.',
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const mensagem = response.status === 401
        ? 'O gateway recusou a autenticação. Confira as credenciais do ambiente escolhido e o contrato SERPRO.'
        : response.status === 403
          ? 'O gateway recusou o acesso para este contrato ou ambiente.'
          : response.status === 429
            ? 'O gateway aplicou limite temporário de requisições; aguarde antes de tentar novamente.'
            : 'O gateway não confirmou a autenticação. Consulte o status do produto SERPRO.';
      return res.status(502).json({ testado: true, autenticado: false, ambiente, statusGateway: response.status, mensagem });
    }

    let payload: { access_token?: unknown; expires_in?: unknown } | null = null;
    try { payload = JSON.parse(responseBody) as typeof payload; } catch { /* resposta não JSON não confirma OAuth */ }
    if (typeof payload?.access_token !== 'string' || !payload.access_token || !Number.isFinite(Number(payload.expires_in))) {
      return res.status(502).json({
        testado: true,
        autenticado: false,
        ambiente,
        statusGateway: response.status,
        mensagem: 'O gateway respondeu, mas não retornou o formato esperado de token. Nenhum token foi armazenado ou devolvido ao navegador.',
      });
    }

    // A credencial transitória é descartada aqui; não enviar token ou resposta bruta ao cliente.
    return res.json({
      testado: true,
      autenticado: true,
      ambiente,
      expiraEmSegundos: Number(payload.expires_in),
      mensagem: 'Autenticação OAuth do gateway confirmada. Isso ainda não valida acesso a uma API fiscal específica.',
    });
  } catch {
    return res.status(503).json({ testado: false, autenticado: false, ambiente, mensagem: 'Não foi possível verificar a configuração SERPRO.' });
  }
});

function chamarHttps(url: string, opcoes: https.RequestOptions, corpo: string): Promise<{ status: number; texto: string; cabecalhos: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { ...opcoes, timeout: 20_000 }, resposta => {
      const partes: Buffer[] = [];
      resposta.on('data', c => partes.push(c));
      resposta.on('end', () => resolve({ status: resposta.statusCode ?? 0, texto: Buffer.concat(partes).toString('utf8'), cabecalhos: Object.fromEntries(Object.entries(resposta.headers).filter(([k]) => /^(etag|content-type|retry-after|x-request-id|date)$/i.test(k)).map(([k, v]) => [k, String(v)])) }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(corpo);
  });
}

// Estado das credenciais para o painel: só diz o que falta, nunca devolve valores.
router.get('/prontidao', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const user = await obterUsuarioDaSessao(req).catch(() => null);
  if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
  return res.json({ ...avaliarProntidao(process.env), servicos: Object.values(CATALOGO_SERVICOS).filter(s => !s.soFluxoSeguro).map(s => ({ chave: s.chave, descricao: s.descricao, campos: s.campos ?? [], procuracao: s.procuracao ?? null, daCiencia: s.daCiencia === true })) });
});

// Quantas consultas a empresa já fez, limite e aviso (regra: 1 gratuita/semana por empresa, sem acúmulo).
router.get('/consultas/:companyId', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.query.tenantId ?? '');
  if (!UUID.test(req.params.companyId) || !UUID.test(tenantId)) return res.status(400).json({ mensagem: 'Escritório ou empresa inválidos.' });
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const r = await comContextoTenant(user.id, tenantId, async client => {
      const q = await client.query('SELECT metadata FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 AND archived_at IS NULL', [req.params.companyId, tenantId]);
      return q.rows[0] ? (q.rows[0].metadata?.serproCota as CotaEmpresa | undefined) ?? { consultas: [] } : null;
    });
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!('resultado' in r) || r.resultado === null || r.resultado === undefined) return res.status(404).json({ mensagem: 'Empresa não encontrada.' });
    return res.json(avaliarCota(r.resultado));
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível consultar o controle de consultas.' });
  }
});

// Extrato de consumo SERPRO do escritório no ciclo de cobrança (dia 21 → dia 20). Somente o dono (admin).
router.get('/consumo', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.query.tenantId ?? '');
  if (!UUID.test(tenantId)) return res.status(400).json({ mensagem: 'Escritório inválido.' });
  const ciclo = req.query.ciclo ? String(req.query.ciclo) : cicloDe(new Date());
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    if (!user.ehAdmin) return res.status(403).json({ mensagem: 'Somente a conta administradora vê o consumo para cobrança.' });
    const r = await comContextoTenant(user.id, tenantId, async client => {
      const q = await client.query(`SELECT id, cnpj, legal_name, metadata->'serproCota'->'consultas' AS consultas FROM fiscoia.companies WHERE tenant_id = $1 AND metadata ? 'serproCota'`, [tenantId]);
      return q.rows.map((x): EmpresaConsumo => ({ id: String(x.id), cnpj: String(x.cnpj), nome: String(x.legal_name), consultas: Array.isArray(x.consultas) ? x.consultas : [] }));
    }, PAPEIS_CONSULTA);
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!('resultado' in r)) return res.status(403).json({ mensagem: 'Somente proprietário ou administrador.' });
    const operacao = (chave: string): OperacaoSerpro => CATALOGO_SERVICOS[chave]?.operacao ?? 'Consultar';
    let extrato;
    try { extrato = montarExtrato(r.resultado, ciclo, operacao); } catch (e) { return res.status(400).json({ mensagem: e instanceof Error ? e.message : 'Ciclo inválido.' }); }
    if (req.query.formato === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="consumo-serpro-${ciclo}.csv"`);
      return res.send(extratoParaCsv(extrato));
    }
    return res.json(extrato);
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível montar o extrato de consumo.' });
  }
});

interface EntradaConsulta { userId: string; tenantId: string; companyId: string; servico: string; dados?: Record<string, unknown>; confirmarCusto: boolean; confirmarCiencia?: boolean; escritorio?: OrigemConsulta; escritorioCnpj?: string }
const resp = (status: number, corpo: unknown) => ({ status, corpo });

/** Núcleo da consulta paga: mesma regra de cota/custo para a tela do Fisco IA e para a ponte do DP. */
async function executarConsulta(e: EntradaConsulta): Promise<{ status: number; corpo: unknown }> {
  try {
    const servico = CATALOGO_SERVICOS[e.servico];
    if (!servico) return resp(400, { mensagem: 'Serviço desconhecido.' });
    if (servico.soFluxoSeguro) return resp(400, { mensagem: 'Este serviço altera dados na Receita e só roda pelo fluxo seguro de transmissão.' });
    if (servico.daCiencia && e.confirmarCiencia !== true) return resp(409, { consultado: false, exigeCiencia: true, mensagem: 'Abrir esta mensagem conta como CIÊNCIA da intimação e começa a contar os prazos, igual a abrir no e-CAC. Confirme que quer abrir. Nada foi consultado nem cobrado.' });
    const { tenantId, companyId } = e;
    if (!UUID.test(tenantId) || !UUID.test(companyId)) return resp(400, { mensagem: 'Escritório ou empresa inválidos.' });
    const prontidao = avaliarProntidao(process.env);
    if (!prontidao.pronto) return resp(503, { consultado: false, mensagem: 'Integração SERPRO ainda não está completa. Nada foi consultado nem cobrado.', faltando: prontidao.itens.filter(i => !i.ok).map(i => i.descricao) });
    const confirmouCusto = e.confirmarCusto;
    // "dados" só aceita os campos do serviço, com texto curto e seguro.
    const dadosEntrada: Record<string, string> = {};
    for (const campo of servico.campos ?? []) {
      const valor = String(e.dados?.[campo.nome] ?? '').trim();
      if (!valor && campo.opcional) continue;
      if (!/^[0-9A-Za-z._/-]{1,40}$/.test(valor)) return resp(400, { mensagem: `Informe o campo "${campo.rotulo}" (letras e números, sem espaços).` });
      dadosEntrada[campo.nome] = valor;
    }

    if (servico.idSistema === 'DCTFWEB') { const erroDados = validarDadosDctfweb(dadosEntrada); if (erroDados) return resp(400, { mensagem: erroDados }); }
    if (servico.idSistema === 'PGMEI') { const erroDados = validarDadosPgmei(servico.idServico, dadosEntrada); if (erroDados) return resp(400, { mensagem: erroDados }); }
    if (servico.idSistema === 'PARCSN' || servico.idSistema === 'PARCSN-ESP' || servico.idSistema === 'PARCMEI' || servico.idSistema === 'PERTMEI' || servico.idSistema === 'RELPSN' || servico.idSistema === 'PARCMEI-ESP' || servico.idSistema === 'PERTSN') { const erroDados = validarDadosParcsn(servico.idServico, dadosEntrada); if (erroDados) return resp(400, { mensagem: erroDados }); }
    if (servico.idSistema === 'CAIXAPOSTAL') { const erroDados = validarDadosCaixaPostal(servico.idServico, dadosEntrada); if (erroDados) return resp(400, { mensagem: erroDados }); }

    // 1) Confere a cota da empresa sem gastar nada.
    const previa = await comContextoTenant(e.userId, tenantId, async client => {
      const q = await client.query('SELECT cnpj, metadata FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 AND archived_at IS NULL', [companyId, tenantId]);
      return q.rows[0] ? { cnpj: String(q.rows[0].cnpj), cota: (q.rows[0].metadata?.serproCota as CotaEmpresa | undefined) ?? { consultas: [] }, sitfis: q.rows[0].metadata?.serproSitfis as { protocolo?: string; em?: string } | undefined } : null;
    }, PAPEIS_CONSULTA);
    if (!previa.autorizado) return resp(403, { mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!('resultado' in previa)) return resp(403, { mensagem: 'Somente proprietário ou administrador pode fazer consultas oficiais.' });
    if (!previa.resultado) return resp(404, { mensagem: 'Empresa não encontrada.' });
    const decisao = decidirConsulta(previa.resultado.cota, confirmouCusto);
    if (decisao.liberada === false) return resp(402, { consultado: false, exigeConfirmacao: true, cota: avaliarCota(previa.resultado.cota), mensagem: decisao.mensagem });
    let pedido;
    try { pedido = montarPedido(servico, process.env.SERPRO_CONTRATANTE_CNPJ!, previa.resultado.cnpj, dadosEntrada, e.escritorioCnpj ?? null); }
    catch (e) { return resp(400, { mensagem: e instanceof Error ? e.message : 'Pedido inválido.' }); }
    // Escritório cliente (autor diferente do contratante): precisa do token do procurador, pedido ao Fiscal ANTES de reservar cota ou chamar o Serpro.
    let tokenProcurador: string | null = null;
    if (e.escritorioCnpj && normalizarCnpj(e.escritorioCnpj) !== normalizarCnpj(process.env.SERPRO_CONTRATANTE_CNPJ || '')) {
      try { tokenProcurador = await buscarTokenProcurador(e.escritorioCnpj); }
      catch (err) { return resp(409, { consultado: false, mensagem: err instanceof SemTokenProcurador ? err.message : 'Não foi possível autorizar a consulta em nome do escritório. Nada foi consultado nem cobrado.' }); }
    }

    const preparadoPfx = prepararPfx(pfxDeVariavel(process.env.SERPRO_CERT_PFX_BASE64!), process.env.SERPRO_CERT_PFX_SENHA!);
    if (preparadoPfx.ok === false) return resp(503, { consultado: false, mensagem: 'O certificado do escritório no servidor não pôde ser aberto (senha ou formato). Nada foi consultado nem cobrado.' });
    const pfx = preparadoPfx.pfx;
    const basic = Buffer.from(`${process.env.SERPRO_PRODUCAO_CONSUMER_KEY}:${process.env.SERPRO_PRODUCAO_CONSUMER_SECRET}`).toString('base64');
    const auth = await chamarHttps('https://autenticacao.sapi.serpro.gov.br/authenticate', {
      method: 'POST', pfx, passphrase: process.env.SERPRO_CERT_PFX_SENHA,
      headers: { Authorization: `Basic ${basic}`, 'Role-Type': 'TERCEIROS', 'Content-Type': 'application/x-www-form-urlencoded' },
    }, 'grant_type=client_credentials');
    if (auth.status !== 200) return resp(502, { consultado: false, mensagem: 'SERPRO recusou a autenticação do escritório (chaves ou certificado). Nada foi cobrado.', statusGateway: auth.status });
    const tokens = JSON.parse(auth.texto) as { access_token?: string; jwt_token?: string };
    if (!tokens.access_token || !tokens.jwt_token) return resp(502, { consultado: false, mensagem: 'Resposta de autenticação inesperada.' });

    const corpo = JSON.stringify(pedido);
    // 2) Reserva a consulta (com trava de linha) imediatamente antes da chamada: a tentativa pode ser cobrada.
    const reserva = await comContextoTenant(e.userId, tenantId, async client => {
      const q = await client.query('SELECT metadata FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [companyId, tenantId]);
      const atual = (q.rows[0]?.metadata?.serproCota as CotaEmpresa | undefined) ?? { consultas: [] };
      const dec = decidirConsulta(atual, confirmouCusto);
      if (dec.liberada === false) return { ok: false as const, cota: avaliarCota(atual) };
      const nova = registrarConsulta(atual, dec.cobrada, servico.chave, new Date(), e.escritorio);
      await client.query(`UPDATE fiscoia.companies SET metadata = jsonb_set(metadata, '{serproCota}', $3::jsonb, true), updated_at = now() WHERE id = $1 AND tenant_id = $2`, [companyId, tenantId, JSON.stringify(nova)]);
      return { ok: true as const, cobrada: dec.cobrada, cota: avaliarCota(nova) };
    }, PAPEIS_CONSULTA);
    if (!reserva.autorizado || !('resultado' in reserva) || !reserva.resultado) return resp(503, { consultado: false, mensagem: 'Não foi possível registrar a consulta. Nada foi cobrado.' });
    if (reserva.resultado.ok === false) return resp(402, { consultado: false, exigeConfirmacao: true, cota: reserva.resultado.cota, mensagem: 'Limite gratuito da semana atingido. Confirme o custo para prosseguir.' });
    const r = await chamarHttps(`${GATEWAY_BY_ENVIRONMENT.producao}/integra-contador/v1/${servico.operacao}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.access_token}`, jwt_token: tokens.jwt_token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo), ...(tokenProcurador ? { autenticar_procurador_token: tokenProcurador } : {}) },
    }, corpo);
    let bruto: unknown = r.texto;
    try { bruto = JSON.parse(r.texto); } catch { /* mantém texto */ }
    const sitfis = servico.chave === 'situacaoFiscal';
    // 304 na situação fiscal: o SERPRO já tem uma solicitação recente; usa o protocolo guardado, se houver.
    let protocolo = sitfis ? lerProtocoloSitfis(bruto) : null;
    if (sitfis && r.status === 304 && !protocolo && previa.resultado.sitfis?.protocolo) protocolo = { protocolo: previa.resultado.sitfis.protocolo, esperaMs: 1000 };
    if (sitfis && r.status === 304 && !protocolo) {
      return resp(409, { consultado: true, statusGateway: 304, mensagem: 'O SERPRO informou que já existe uma solicitação recente de situação fiscal para esta empresa e não reenviou o protocolo. Aguarde alguns minutos e tente de novo.', bruto, cabecalhos: r.cabecalhos });
    }
    const geralOk = (r.status >= 200 && r.status < 300) || (sitfis && r.status === 304 && protocolo);
    if (!geralOk) {
      const motivo = r.status === 403 ? 'O SERPRO negou o acesso: confira a procuração do cliente no e-CAC.' : r.status === 400 ? 'O SERPRO recusou os dados do pedido.' : `O SERPRO respondeu com erro (HTTP ${r.status}).`;
      return resp(502, { consultado: true, statusGateway: r.status, mensagem: motivo, bruto, cabecalhos: r.cabecalhos });
    }
    // Situação fiscal tem duas etapas: protocolo (acima) e, após a espera, o relatório em PDF (Emitir).
    let relatorio: unknown = undefined;
    if (sitfis && protocolo) {
      const prot = protocolo;
      await comContextoTenant(e.userId, tenantId, async client => {
        await client.query(`UPDATE fiscoia.companies SET metadata = jsonb_set(metadata, '{serproSitfis}', $3::jsonb, true) WHERE id = $1 AND tenant_id = $2`, [companyId, tenantId, JSON.stringify({ protocolo: prot.protocolo, em: new Date().toISOString() })]);
      }, PAPEIS_CONSULTA).catch(() => undefined);
      {
        let espera = Math.min(Math.max(prot.esperaMs, 1000), 8000);
        for (let tentativa = 0; tentativa < 3; tentativa += 1) {
          await new Promise(ok => setTimeout(ok, espera));
          const pedido2 = { ...pedido, pedidoDados: { idSistema: 'SITFIS', idServico: 'RELATORIOSITFIS92', versaoSistema: '2.0', dados: JSON.stringify({ protocoloRelatorio: prot.protocolo }) } };
          const corpo2 = JSON.stringify(pedido2);
          const r2 = await chamarHttps(`${GATEWAY_BY_ENVIRONMENT.producao}/integra-contador/v1/Emitir`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokens.access_token}`, jwt_token: tokens.jwt_token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo2) },
          }, corpo2);
          let b2: unknown = r2.texto;
          try { b2 = JSON.parse(r2.texto); } catch { /* mantém texto */ }
          relatorio = { status: r2.status, ...(typeof b2 === 'object' && b2 !== null ? b2 as Record<string, unknown> : { texto: b2 }) };
          if (acharPdfBase64(b2)) break;
          const novaEspera = lerProtocoloSitfis(b2)?.esperaMs;
          if (r2.status >= 200 && r2.status < 300 && novaEspera) { espera = Math.min(Math.max(novaEspera, 1000), 8000); continue; }
          break;
        }
      }
    }
    return resp(200, { relatorio, consultado: true, cobradaAparte: reserva.resultado.cobrada, cota: reserva.resultado.cota, fonte: 'SERPRO', servico: servico.chave, consultadoEm: new Date().toISOString(), bruto });
  } catch {
    return resp(503, { consultado: false, mensagem: 'Falha ao consultar o SERPRO. Nenhum dado foi inventado.' });
  }
}



// Consulta paga (Integra Contador). Recusa tudo enquanto a prontidão não estiver completa.
router.post('/consulta', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let user;
  try { user = await obterUsuarioDaSessao(req); } catch { return res.status(503).json({ consultado: false, mensagem: 'Falha ao consultar o SERPRO. Nenhum dado foi inventado.' }); }
  if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
  if (!user.ehAdmin) return res.status(403).json({ mensagem: 'Somente a conta administradora.' });
  const r = await executarConsulta({ userId: user.id, tenantId: String(req.body?.tenantId ?? ''), companyId: String(req.body?.companyId ?? ''), servico: String(req.body?.servico ?? ''), dados: req.body?.dados, confirmarCiencia: req.body?.confirmarCiencia === true, confirmarCusto: req.body?.confirmarCusto === true });
  return res.status(r.status).json(r.corpo);
});

// ---- Ponte DP → Fisco IA (credencial de integração) ----
// O DP pede consulta de uma empresa pelo CNPJ. Só atende empresas cadastradas no Fisco IA da conta
// administradora (a dona); a regra de cota e de confirmação de custo é a mesma da tela.
async function localizarEmpresaDaDona(cnpj: string, criar?: { razaoSocial: string; escritorio?: OrigemConsulta }): Promise<{ userId: string; tenantId: string; companyId: string; cota: CotaEmpresa } | null> {
  const pool = obterPoolBanco();
  if (!pool) return null;
  const admins = await pool.query(`SELECT id FROM fiscoia.users WHERE active = true AND (is_admin = true OR account_type = 'ADMIN') ORDER BY id LIMIT 5`);
  for (const adm of admins.rows) {
    const userId = String(adm.id);
    const c = await pool.connect();
    let tenants: string[] = [];
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      const m = await c.query('SELECT tenant_id FROM fiscoia.tenant_memberships WHERE user_id = $1 AND role = ANY($2::text[])', [userId, PAPEIS_CONSULTA]);
      tenants = m.rows.map(x => String(x.tenant_id));
      await c.query('COMMIT');
    } catch { await c.query('ROLLBACK').catch(() => undefined); } finally { c.release(); }
    for (const tenantId of tenants) {
      const r = await comContextoTenant(userId, tenantId, async client => {
        const q = await client.query(`SELECT id, cnpj, metadata->'serproCota' AS cota FROM fiscoia.companies WHERE tenant_id = $1 AND archived_at IS NULL`, [tenantId]);
        const achou = q.rows.find(x => normalizarCnpj(String(x.cnpj)) === cnpj);
        return achou ? { companyId: String(achou.id), cota: (achou.cota as CotaEmpresa | null) ?? { consultas: [] } } : null;
      }, PAPEIS_CONSULTA);
      if (r.autorizado && 'resultado' in r && r.resultado) return { userId, tenantId, ...r.resultado };
    }
    // Empresa de escritório cliente (vem do DP): a conta central guarda o registro para controlar a cota
    // semanal por CNPJ. O registro nasce só quando a consulta é de fato pedida.
    if (criar && tenants[0]) {
      const tenantId = tenants[0];
      const nova = await comContextoTenant(userId, tenantId, async client => {
        const q = await client.query(
          `INSERT INTO fiscoia.companies (tenant_id, cnpj, legal_name, metadata) VALUES ($1, $2, $3, $4::jsonb)
           ON CONFLICT (tenant_id, cnpj) DO UPDATE SET updated_at = now() RETURNING id, metadata->'serproCota' AS cota`,
          [tenantId, cnpj, criar.razaoSocial.slice(0, 200) || cnpj, JSON.stringify({ origem: 'ponte-dp', ...(criar.escritorio ? { escritorioOrigem: criar.escritorio } : {}) })]);
        return { companyId: String(q.rows[0].id), cota: (q.rows[0].cota as CotaEmpresa | null) ?? { consultas: [] } };
      }, PAPEIS_CONSULTA);
      if (nova.autorizado && 'resultado' in nova && nova.resultado) return { userId, tenantId, ...nova.resultado };
    }
  }
  return null;
}

router.get('/ponte/cota', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.MURADE_INTEGRATION_TOKEN?.trim()) return res.status(503).json({ mensagem: 'Integração não configurada.' });
  if (!tokenValido(req.get('authorization'))) return res.status(401).json({ mensagem: 'Credencial de integração inválida.' });
  const cnpj = normalizarCnpj(String(req.query.cnpj ?? ''));
  if (!validarCnpj(cnpj)) return res.status(400).json({ mensagem: 'CNPJ inválido.' });
  try {
    const e = await localizarEmpresaDaDona(cnpj);
    // Empresa ainda sem registro central: tem a consulta grátis da semana inteira.
    const cota = avaliarCota(e ? e.cota : { consultas: [] });
    return res.json({ cadastrada: Boolean(e), cota, servicos: Object.values(CATALOGO_SERVICOS).filter(s => !s.soFluxoSeguro).map(s => ({ chave: s.chave, descricao: s.descricao, campos: s.campos ?? [], procuracao: s.procuracao ?? null, daCiencia: s.daCiencia === true })) });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível consultar a cota.' }); }
});

router.post('/ponte/consulta', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.MURADE_INTEGRATION_TOKEN?.trim()) return res.status(503).json({ consultado: false, mensagem: 'Integração não configurada.' });
  if (!tokenValido(req.get('authorization'))) return res.status(401).json({ consultado: false, mensagem: 'Credencial de integração inválida.' });
  const cnpj = normalizarCnpj(String(req.body?.cnpj ?? ''));
  if (!validarCnpj(cnpj)) return res.status(400).json({ consultado: false, mensagem: 'CNPJ inválido.' });
  try {
    const esc = req.body?.escritorio as { id?: unknown; nome?: unknown } | undefined;
    const escritorio: OrigemConsulta | undefined = esc && /^[A-Za-z0-9._-]{1,64}$/.test(String(esc.id ?? '')) ? { id: String(esc.id), nome: String(esc.nome ?? esc.id).replace(/[\u0000-\u001f<>]/g, '').slice(0, 80) || String(esc.id) } : undefined;
    const razaoSocial = String(req.body?.razaoSocial ?? '').replace(/[\u0000-\u001f<>]/g, '').trim();
    // CNPJ do escritório cliente (autor do pedido): só vale se válido; sem ele, vale o contratante (comportamento antigo)
    const bruto = normalizarCnpj(String((esc as { cnpj?: unknown } | undefined)?.cnpj ?? ''));
    const escritorioCnpj = bruto && validarCnpj(bruto) ? bruto : undefined;
    const e = await localizarEmpresaDaDona(cnpj, { razaoSocial, escritorio });
    if (!e) return res.status(503).json({ consultado: false, mensagem: 'Não foi possível registrar a empresa para controle da cota. Nada foi consultado nem cobrado.' });
    const r = await executarConsulta({ userId: e.userId, tenantId: e.tenantId, companyId: e.companyId, servico: String(req.body?.servico ?? ''), dados: req.body?.dados, confirmarCiencia: req.body?.confirmarCiencia === true, confirmarCusto: req.body?.confirmarCusto === true, escritorio, escritorioCnpj });
    return res.status(r.status).json(r.corpo);
  } catch { return res.status(503).json({ consultado: false, mensagem: 'Falha ao consultar o SERPRO. Nenhum dado foi inventado.' }); }
});

// ---- Uso do Serpro feito por OUTRO sistema (Fiscal): só registra, na mesma conta de cota e de cobrança ----
// A chamada ao Serpro já foi feita pelo sistema de origem; aqui só se conta (1 grátis/semana por empresa; o resto é cobrado).
const OPERACOES_USO = ['Consultar', 'Emitir', 'Apoiar', 'Declarar', 'Monitorar'] as const;
router.post('/ponte/uso', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.MURADE_INTEGRATION_TOKEN?.trim()) return res.status(503).json({ registrado: false, mensagem: 'Integração não configurada.' });
  if (!tokenValido(req.get('authorization'))) return res.status(401).json({ registrado: false, mensagem: 'Credencial de integração inválida.' });
  const cnpj = normalizarCnpj(String(req.body?.cnpj ?? ''));
  if (!validarCnpj(cnpj)) return res.status(400).json({ registrado: false, mensagem: 'CNPJ inválido.' });
  const operacao = OPERACOES_USO.find(o => o === req.body?.operacao);
  if (!operacao) return res.status(400).json({ registrado: false, mensagem: 'Operação inválida.' });
  const servico = String(req.body?.servico ?? '').replace(/[^A-Za-z0-9._ -]/g, '').slice(0, 80);
  if (!servico) return res.status(400).json({ registrado: false, mensagem: 'Serviço não informado.' });
  const esc = req.body?.escritorio as { id?: unknown; nome?: unknown } | undefined;
  const escritorio: OrigemConsulta | undefined = esc && /^[A-Za-z0-9._-]{1,64}$/.test(String(esc.id ?? '')) ? { id: String(esc.id), nome: String(esc.nome ?? esc.id).replace(/[\u0000-\u001f<>]/g, '').slice(0, 80) || String(esc.id) } : undefined;
  const razaoSocial = String(req.body?.razaoSocial ?? '').replace(/[\u0000-\u001f<>]/g, '').trim();
  const idUso = /^[A-Za-z0-9-]{8,64}$/.test(String(req.body?.idUso ?? '')) ? String(req.body.idUso) : undefined; // evita contar duas vezes se o envio for repetido
  const emBruto = Date.parse(String(req.body?.em ?? ''));
  const quando = Number.isFinite(emBruto) && emBruto <= Date.now() + 60_000 && emBruto > Date.now() - 45 * 86_400_000 ? new Date(emBruto) : new Date();
  try {
    const e = await localizarEmpresaDaDona(cnpj, { razaoSocial, escritorio });
    if (!e) return res.status(503).json({ registrado: false, mensagem: 'Não foi possível localizar a empresa para registrar o uso.' });
    const r = await comContextoTenant(e.userId, e.tenantId, async client => {
      const q = await client.query('SELECT metadata FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [e.companyId, e.tenantId]);
      const atual = (q.rows[0]?.metadata?.serproCota as CotaEmpresa | undefined) ?? { consultas: [] };
      if (idUso && atual.consultas.some(c => c.idUso === idUso)) return { cobrada: false, repetido: true as const };
      const cobrada = avaliarCota(atual, quando).proximaConsultaCobrada; // a chamada já ocorreu: não há o que "bloquear", só contar certo
      const nova = registrarConsulta(atual, cobrada, servico, quando, escritorio, operacao, idUso);
      await client.query(`UPDATE fiscoia.companies SET metadata = jsonb_set(metadata, '{serproCota}', $3::jsonb, true), updated_at = now() WHERE id = $1 AND tenant_id = $2`, [e.companyId, e.tenantId, JSON.stringify(nova)]);
      return { cobrada };
    }, PAPEIS_CONSULTA);
    if (!r.autorizado || !('resultado' in r) || !r.resultado) return res.status(503).json({ registrado: false, mensagem: 'Não foi possível gravar o uso.' });
    return res.json({ registrado: true, cobrada: r.resultado.cobrada, ...('repetido' in r.resultado ? { repetido: true } : {}) });
  } catch { return res.status(503).json({ registrado: false, mensagem: 'Falha ao gravar o uso.' }); }
});

// ---- Transmissão da DCTFWeb (TRANSDECLARACAO310) ----
// Fase "preparar": busca o XML da declaração em andamento (consulta) e devolve para conferência, com o hash.
// Fase "confirmar": só com hash conferido, custo confirmado e interruptor ligado; assina o MESMO XML e transmite.
const XML_PREPARADO = new Map<string, { xml: string; cnpj: string; categoria: string; anoPA: string; mesPA?: string; expira: number }>();
const VALIDADE_PREPARO_MS = 15 * 60 * 1000;
const limparPreparos = () => { const agora = Date.now(); for (const [k, v] of XML_PREPARADO) if (v.expira < agora) XML_PREPARADO.delete(k); };

router.post('/ponte/dctfweb/transmitir', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.MURADE_INTEGRATION_TOKEN?.trim()) return res.status(503).json({ mensagem: 'Integração não configurada.' });
  if (!tokenValido(req.get('authorization'))) return res.status(401).json({ mensagem: 'Credencial de integração inválida.' });
  const cnpj = normalizarCnpj(String(req.body?.cnpj ?? ''));
  if (!validarCnpj(cnpj)) return res.status(400).json({ mensagem: 'CNPJ inválido.' });
  const categoria = String(req.body?.categoria ?? '').trim();
  const anoPA = String(req.body?.anoPA ?? '').trim();
  const mesPA = String(req.body?.mesPA ?? '').trim() || undefined;
  const erroDados = validarDadosDctfweb({ categoria, anoPA, ...(mesPA ? { mesPA } : {}) });
  if (erroDados) return res.status(400).json({ mensagem: erroDados });
  const fase = String(req.body?.fase ?? '');
  const esc = req.body?.escritorio as { id?: unknown; nome?: unknown } | undefined;
  const escritorio: OrigemConsulta | undefined = esc && /^[A-Za-z0-9._-]{1,64}$/.test(String(esc.id ?? '')) ? { id: String(esc.id), nome: String(esc.nome ?? esc.id).replace(/[\u0000-\u001f<>]/g, '').slice(0, 80) || String(esc.id) } : undefined;
  try {
    const e = await localizarEmpresaDaDona(cnpj, { razaoSocial: String(req.body?.razaoSocial ?? '').replace(/[\u0000-\u001f<>]/g, '').trim(), escritorio });
    if (!e) return res.status(503).json({ mensagem: 'Não foi possível localizar a empresa para controle da cota. Nada foi feito.' });
    limparPreparos();

    if (fase === 'preparar') {
      const dados: Record<string, string> = { categoria, anoPA, ...(mesPA ? { mesPA } : {}) };
      const r = await executarConsulta({ userId: e.userId, tenantId: e.tenantId, companyId: e.companyId, servico: 'dctfwebXml', dados, confirmarCusto: req.body?.confirmarCusto === true, escritorio });
      if (r.status !== 200) return res.status(r.status).json(r.corpo);
      const xml = lerXmlDeclaracao((r.corpo as { bruto?: unknown }).bruto);
      if (!xml) return res.status(502).json({ preparada: false, mensagem: 'O SERPRO não devolveu o XML da declaração em andamento. Nada foi transmitido.' });
      const hashXml = sha256Hex(xml);
      XML_PREPARADO.set(hashXml, { xml, cnpj, categoria, anoPA, mesPA, expira: Date.now() + VALIDADE_PREPARO_MS });
      return res.json({ preparada: true, transmitida: false, hashXml, validoPorMinutos: VALIDADE_PREPARO_MS / 60000, xmlBase64: Buffer.from(xml, 'utf8').toString('base64'), cota: (r.corpo as { cota?: unknown }).cota, mensagem: 'XML obtido. Confira os valores e confirme para assinar e transmitir. Nada foi enviado à Receita.' });
    }

    if (fase !== 'confirmar') return res.status(400).json({ mensagem: 'Informe a fase: "preparar" ou "confirmar".' });
    if (process.env.SERPRO_DCTFWEB_TRANSMISSAO_HABILITADA !== 'true') return res.status(403).json({ transmitida: false, mensagem: 'A transmissão da DCTFWeb está desligada (SERPRO_DCTFWEB_TRANSMISSAO_HABILITADA não é "true"). Nada foi enviado.' });
    if (req.body?.confirmarCusto !== true || req.body?.confirmarTransmissao !== true) return res.status(402).json({ transmitida: false, exigeConfirmacao: true, mensagem: 'Confirme a transmissão (ela envia a declaração à Receita) e o custo de R$ 0,40 do serviço Declarar.' });
    const hash = String(req.body?.hashXml ?? '');
    const preparo = XML_PREPARADO.get(hash);
    if (!preparo || preparo.cnpj !== cnpj || preparo.categoria !== categoria || preparo.anoPA !== anoPA || (preparo.mesPA ?? '') !== (mesPA ?? '')) return res.status(409).json({ transmitida: false, mensagem: 'A conferência expirou ou não é desta declaração. Refaça a etapa de conferência. Nada foi enviado.' });
    const prontidao = avaliarProntidao(process.env);
    if (!prontidao.pronto) return res.status(503).json({ transmitida: false, mensagem: 'Integração SERPRO ainda não está completa. Nada foi enviado.', faltando: prontidao.itens.filter(i => !i.ok).map(i => i.descricao) });
    const preparadoPfx = prepararPfx(pfxDeVariavel(process.env.SERPRO_CERT_PFX_BASE64!), process.env.SERPRO_CERT_PFX_SENHA!);
    if (preparadoPfx.ok === false) return res.status(503).json({ transmitida: false, mensagem: 'O certificado do escritório no servidor não pôde ser aberto. Nada foi enviado.' });
    let assinado;
    try {
      const cert = lerCertificadoAssinante(preparadoPfx.pfx, process.env.SERPRO_CERT_PFX_SENHA!);
      assinado = assinarDeclaracaoDctfweb(preparo.xml, cert, process.env.SERPRO_CONTRATANTE_CNPJ);
    } catch (erro) { return res.status(422).json({ transmitida: false, mensagem: `${erro instanceof Error ? erro.message : 'Falha ao assinar.'} Nada foi enviado.` }); }

    const servico = CATALOGO_SERVICOS.dctfwebTransmitir;
    const pedido = montarPedido(servico, process.env.SERPRO_CONTRATANTE_CNPJ!, cnpj, montarDadosTransmissao({ categoria, anoPA, mesPA }, assinado.base64));
    const basic = Buffer.from(`${process.env.SERPRO_PRODUCAO_CONSUMER_KEY}:${process.env.SERPRO_PRODUCAO_CONSUMER_SECRET}`).toString('base64');
    const auth = await chamarHttps('https://autenticacao.sapi.serpro.gov.br/authenticate', {
      method: 'POST', pfx: preparadoPfx.pfx, passphrase: process.env.SERPRO_CERT_PFX_SENHA,
      headers: { Authorization: `Basic ${basic}`, 'Role-Type': 'TERCEIROS', 'Content-Type': 'application/x-www-form-urlencoded' },
    }, 'grant_type=client_credentials');
    if (auth.status !== 200) return res.status(502).json({ transmitida: false, mensagem: 'SERPRO recusou a autenticação do escritório. Nada foi enviado.', statusGateway: auth.status });
    const tokens = JSON.parse(auth.texto) as { access_token?: string; jwt_token?: string };
    if (!tokens.access_token || !tokens.jwt_token) return res.status(502).json({ transmitida: false, mensagem: 'Resposta de autenticação inesperada. Nada foi enviado.' });

    XML_PREPARADO.delete(hash); // uso único: cada confirmação vale para uma só transmissão
    // A tentativa pode ser cobrada: registra antes de chamar, sempre como cobrada (Declarar não tem cota gratuita).
    await comContextoTenant(e.userId, e.tenantId, async client => {
      const q = await client.query('SELECT metadata FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [e.companyId, e.tenantId]);
      const atual = (q.rows[0]?.metadata?.serproCota as CotaEmpresa | undefined) ?? { consultas: [] };
      const nova = registrarConsulta(atual, true, servico.chave, new Date(), escritorio);
      await client.query(`UPDATE fiscoia.companies SET metadata = jsonb_set(metadata, '{serproCota}', $3::jsonb, true), updated_at = now() WHERE id = $1 AND tenant_id = $2`, [e.companyId, e.tenantId, JSON.stringify(nova)]);
    }, PAPEIS_CONSULTA);
    const corpo = JSON.stringify(pedido);
    const r = await chamarHttps(`${GATEWAY_BY_ENVIRONMENT.producao}/integra-contador/v1/${servico.operacao}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.access_token}`, jwt_token: tokens.jwt_token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo) },
    }, corpo);
    let bruto: unknown = r.texto;
    try { bruto = JSON.parse(r.texto); } catch { /* mantém texto */ }
    const recibo = r.status >= 200 && r.status < 300 ? lerReciboTransmissao(bruto) : null;
    if (!recibo) {
      const mensagens = (bruto as { mensagens?: unknown })?.mensagens;
      return res.status(502).json({ transmitida: false, statusGateway: r.status, mensagem: r.status === 403 ? 'O SERPRO negou o acesso: confira a procuração 00103 (DCTFWeb) da empresa no e-CAC.' : 'O SERPRO não confirmou a transmissão. Confira o recibo no e-CAC antes de tentar de novo.', mensagens, hashXml: hash });
    }
    return res.json({ transmitida: true, numeroRecibo: recibo, hashXml: hash, transmitidaEm: new Date().toISOString(), mensagens: (bruto as { mensagens?: unknown })?.mensagens, mensagem: 'Declaração transmitida e recibo recebido.' });
  } catch { return res.status(503).json({ transmitida: false, mensagem: 'Falha ao transmitir. Confira no e-CAC se a declaração foi entregue antes de repetir.' }); }
});

export default router;
