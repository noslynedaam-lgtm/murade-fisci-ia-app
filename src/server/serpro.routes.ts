import { Router } from 'express';
import { obterUsuarioDaSessao } from './auth.routes';

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

export default router;
