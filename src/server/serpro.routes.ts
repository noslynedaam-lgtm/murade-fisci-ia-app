import { Router } from 'express';
import https from 'node:https';
import { obterUsuarioDaSessao } from './auth.routes';
import { CATALOGO_SERVICOS, avaliarProntidao, montarPedido } from '../services/serpro/integraContador';
import { avaliarCota, decidirConsulta, registrarConsulta, type CotaEmpresa } from '../services/serpro/cotaSemanal';
import { comContextoTenant } from './persistence';

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

function chamarHttps(url: string, opcoes: https.RequestOptions, corpo: string): Promise<{ status: number; texto: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { ...opcoes, timeout: 20_000 }, resposta => {
      const partes: Buffer[] = [];
      resposta.on('data', c => partes.push(c));
      resposta.on('end', () => resolve({ status: resposta.statusCode ?? 0, texto: Buffer.concat(partes).toString('utf8') }));
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
  return res.json({ ...avaliarProntidao(process.env), servicos: Object.values(CATALOGO_SERVICOS).map(s => ({ chave: s.chave, descricao: s.descricao })) });
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

// Consulta paga (Integra Contador). Recusa tudo enquanto a prontidão não estiver completa.
router.post('/consulta', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    if (!user.ehAdmin) return res.status(403).json({ mensagem: 'Somente a conta administradora.' });
    const servico = CATALOGO_SERVICOS[String(req.body?.servico ?? '')];
    if (!servico) return res.status(400).json({ mensagem: 'Serviço desconhecido.' });
    const tenantId = String(req.body?.tenantId ?? '');
    const companyId = String(req.body?.companyId ?? '');
    if (!UUID.test(tenantId) || !UUID.test(companyId)) return res.status(400).json({ mensagem: 'Escritório ou empresa inválidos.' });
    const prontidao = avaliarProntidao(process.env);
    if (!prontidao.pronto) return res.status(503).json({ consultado: false, mensagem: 'Integração SERPRO ainda não está completa. Nada foi consultado nem cobrado.', faltando: prontidao.itens.filter(i => !i.ok).map(i => i.descricao) });
    const confirmouCusto = req.body?.confirmarCusto === true;

    // 1) Confere a cota da empresa sem gastar nada.
    const previa = await comContextoTenant(user.id, tenantId, async client => {
      const q = await client.query('SELECT cnpj, metadata FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 AND archived_at IS NULL', [companyId, tenantId]);
      return q.rows[0] ? { cnpj: String(q.rows[0].cnpj), cota: (q.rows[0].metadata?.serproCota as CotaEmpresa | undefined) ?? { consultas: [] } } : null;
    }, PAPEIS_CONSULTA);
    if (!previa.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!('resultado' in previa)) return res.status(403).json({ mensagem: 'Somente proprietário ou administrador pode fazer consultas oficiais.' });
    if (!previa.resultado) return res.status(404).json({ mensagem: 'Empresa não encontrada.' });
    const decisao = decidirConsulta(previa.resultado.cota, confirmouCusto);
    if (decisao.liberada === false) return res.status(402).json({ consultado: false, exigeConfirmacao: true, cota: avaliarCota(previa.resultado.cota), mensagem: decisao.mensagem });
    let pedido;
    try { pedido = montarPedido(servico, process.env.SERPRO_CONTRATANTE_CNPJ!, previa.resultado.cnpj, req.body?.dados ?? {}); }
    catch (e) { return res.status(400).json({ mensagem: e instanceof Error ? e.message : 'Pedido inválido.' }); }

    const pfx = Buffer.from(process.env.SERPRO_CERT_PFX_BASE64!, 'base64');
    const basic = Buffer.from(`${process.env.SERPRO_PRODUCAO_CONSUMER_KEY}:${process.env.SERPRO_PRODUCAO_CONSUMER_SECRET}`).toString('base64');
    const auth = await chamarHttps('https://autenticacao.sapi.serpro.gov.br/authenticate', {
      method: 'POST', pfx, passphrase: process.env.SERPRO_CERT_PFX_SENHA,
      headers: { Authorization: `Basic ${basic}`, 'Role-Type': 'TERCEIROS', 'Content-Type': 'application/x-www-form-urlencoded' },
    }, 'grant_type=client_credentials');
    if (auth.status !== 200) return res.status(502).json({ consultado: false, mensagem: 'SERPRO recusou a autenticação do escritório (chaves ou certificado). Nada foi cobrado.', statusGateway: auth.status });
    const tokens = JSON.parse(auth.texto) as { access_token?: string; jwt_token?: string };
    if (!tokens.access_token || !tokens.jwt_token) return res.status(502).json({ consultado: false, mensagem: 'Resposta de autenticação inesperada.' });

    const corpo = JSON.stringify(pedido);
    // 2) Reserva a consulta (com trava de linha) imediatamente antes da chamada: a tentativa pode ser cobrada.
    const reserva = await comContextoTenant(user.id, tenantId, async client => {
      const q = await client.query('SELECT metadata FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [companyId, tenantId]);
      const atual = (q.rows[0]?.metadata?.serproCota as CotaEmpresa | undefined) ?? { consultas: [] };
      const dec = decidirConsulta(atual, confirmouCusto);
      if (dec.liberada === false) return { ok: false as const, cota: avaliarCota(atual) };
      const nova = registrarConsulta(atual, dec.cobrada, servico.chave);
      await client.query(`UPDATE fiscoia.companies SET metadata = jsonb_set(metadata, '{serproCota}', $3::jsonb, true), updated_at = now() WHERE id = $1 AND tenant_id = $2`, [companyId, tenantId, JSON.stringify(nova)]);
      return { ok: true as const, cobrada: dec.cobrada, cota: avaliarCota(nova) };
    }, PAPEIS_CONSULTA);
    if (!reserva.autorizado || !('resultado' in reserva) || !reserva.resultado) return res.status(503).json({ consultado: false, mensagem: 'Não foi possível registrar a consulta. Nada foi cobrado.' });
    if (reserva.resultado.ok === false) return res.status(402).json({ consultado: false, exigeConfirmacao: true, cota: reserva.resultado.cota, mensagem: 'Limite gratuito da semana atingido. Confirme o custo para prosseguir.' });
    const r = await chamarHttps(`${GATEWAY_BY_ENVIRONMENT.producao}/integra-contador/v1/${servico.operacao}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.access_token}`, jwt_token: tokens.jwt_token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo) },
    }, corpo);
    let bruto: unknown = r.texto;
    try { bruto = JSON.parse(r.texto); } catch { /* mantém texto */ }
    if (r.status < 200 || r.status >= 300) return res.status(502).json({ consultado: true, statusGateway: r.status, mensagem: 'SERPRO respondeu com erro (verifique procuração do cliente no e-CAC).', bruto });
    return res.json({ consultado: true, cobradaAparte: reserva.resultado.cobrada, cota: reserva.resultado.cota, fonte: 'SERPRO', servico: servico.chave, consultadoEm: new Date().toISOString(), bruto });
  } catch {
    return res.status(503).json({ consultado: false, mensagem: 'Falha ao consultar o SERPRO. Nenhum dado foi inventado.' });
  }
});

export default router;
