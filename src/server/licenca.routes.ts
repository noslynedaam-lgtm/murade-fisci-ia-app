import { Router } from 'express';
import { obterUsuarioDaSessao } from './auth.routes';

// Licença por empresa: cadastrada e gerenciada no Murade DP. Aqui só se LÊ (servidor a servidor).
const router = Router();

router.get('/licenca', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const user = await obterUsuarioDaSessao(req).catch(() => null);
  if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
  const cnpj = String(req.query.cnpj ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (cnpj.length !== 14) return res.status(400).json({ mensagem: 'CNPJ inválido.' });
  const base = (process.env.MURADE_DP_URL || 'https://murade-dp.onrender.com').replace(/\/$/, '');
  const token = process.env.MURADE_INTEGRATION_TOKEN;
  if (!token) return res.json({ indisponivel: true, motivo: 'Integração com o DP não configurada neste sistema.' });
  try {
    const r = await fetch(`${base}/api/integracao/licenca?cnpj=${encodeURIComponent(cnpj)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.json({ indisponivel: true, motivo: 'O DP não respondeu à consulta de licença.' });
    const dados = await r.json();
    return res.json({ licenca: dados.licenca });
  } catch {
    return res.json({ indisponivel: true, motivo: 'Não foi possível falar com o DP agora.' });
  }
});

export default router;
