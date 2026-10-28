import { Router } from 'express';
import https from 'node:https';
import { prepararPfx, pfxDeVariavel } from './pfxCompat';
import { obterUsuarioDaSessao } from './auth.routes';
import { CATALOGO_SERVICOS, avaliarProntidao, montarPedido } from '../services/serpro/integraContador';
import { acharPdfBase64, lerProtocoloSitfis } from '../services/serpro/resultadoSerpro';
import { avaliarCota, decidirConsulta, registrarConsulta, type CotaEmpresa, type OrigemConsulta } from '../services/serpro/cotaSemanal';
import { comContextoTenant, obterPoolBanco } from './persistence';
import { normalizarCnpj, validarCnpj } from '../services/cnpj/cnpjValidation';
import { cicloDe, montarExtrato, extratoParaCsv, type EmpresaConsumo, type OperacaoSerpro } from '../services/serpro/consumoSerpro';
import { tokenValido } from './agentesEntreSistemas';

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
  return res.json({ ...avaliarProntidao(process.env), servicos: Object.values(CATALOGO_SERVICOS).map(s => ({ chave: s.chave, descricao: s.descricao, campos: s.campos ?? [] })) });
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

interface EntradaConsulta { userId: string; tenantId: string; companyId: string; servico: string; dados?: Record<string, unknown>; confirmarCusto: boolean; escritorio?: OrigemConsulta }
const resp = (status: number, corpo: unknown) => ({ status, corpo });

/** Núcleo da consulta paga: mesma regra de cota/custo para a tela do Fisco IA e para a ponte do DP. */
async function executarConsulta(e: EntradaConsulta): Promise<{ status: number; corpo: unknown }> {
  try {
    const servico = CATALOGO_SERVICOS[e.servico];
    if (!servico) return resp(400, { mensagem: 'Serviço desconhecido.' });
    const { tenantId, companyId } = e;
    if (!UUID.test(tenantId) || !UUID.test(companyId)) return resp(400, { mensagem: 'Escritório ou empresa inválidos.' });
    const prontidao = avaliarProntidao(process.env);
    if (!prontidao.pronto) return resp(503, { consultado: false, mensagem: 'Integração SERPRO ainda não está completa. Nada foi consultado nem cobrado.', faltando: prontidao.itens.filter(i => !i.ok).map(i => i.descricao) });
    const confirmouCusto = e.confirmarCusto;
    // "dados" só aceita os campos do serviço, com texto curto e seguro.
    const dadosEntrada: Record<string, string> = {};
    for (const campo of servico.campos ?? []) {
      const valor = String(e.dados?.[campo.nome] ?? '').trim();
      if (!/^[0-9A-Za-z./-]{1,40}$/.test(valor)) return resp(400, { mensagem: `Informe o campo "${campo.rotulo}" (letras e números, sem espaços).` });
      dadosEntrada[campo.nome] = valor;
    }

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
    try { pedido = montarPedido(servico, process.env.SERPRO_CONTRATANTE_CNPJ!, previa.resultado.cnpj, dadosEntrada); }
    catch (e) { return resp(400, { mensagem: e instanceof Error ? e.message : 'Pedido inválido.' }); }

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
      headers: { Authorization: `Bearer ${tokens.access_token}`, jwt_token: tokens.jwt_token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo) },
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
  const r = await executarConsulta({ userId: user.id, tenantId: String(req.body?.tenantId ?? ''), companyId: String(req.body?.companyId ?? ''), servico: String(req.body?.servico ?? ''), dados: req.body?.dados, confirmarCusto: req.body?.confirmarCusto === true });
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
    return res.json({ cadastrada: Boolean(e), cota, servicos: Object.values(CATALOGO_SERVICOS).map(s => ({ chave: s.chave, descricao: s.descricao, campos: s.campos ?? [] })) });
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
    const e = await localizarEmpresaDaDona(cnpj, { razaoSocial, escritorio });
    if (!e) return res.status(503).json({ consultado: false, mensagem: 'Não foi possível registrar a empresa para controle da cota. Nada foi consultado nem cobrado.' });
    const r = await executarConsulta({ userId: e.userId, tenantId: e.tenantId, companyId: e.companyId, servico: String(req.body?.servico ?? ''), dados: req.body?.dados, confirmarCusto: req.body?.confirmarCusto === true, escritorio });
    return res.status(r.status).json(r.corpo);
  } catch { return res.status(503).json({ consultado: false, mensagem: 'Falha ao consultar o SERPRO. Nenhum dado foi inventado.' }); }
});

export default router;
