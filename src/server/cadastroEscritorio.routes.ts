// Cadastro do escritório visto do Fisco IA. O cadastro ÚNICO (dados, certificado A1 e-CNPJ e as procurações das empresas) é feito no
// Murade DP; o CNPJ chega ao Fiscal e o robô de empresas do Fisco IA preenche fiscoia.tenants.office_cnpj quando está vazio.
// O certificado do escritório NÃO é copiado para cá: a credencial do Serpro do escritório exige também o Consumer Key/Secret do
// contrato do Integra Contador e continua sendo informada pela ponte própria (credenciais cifradas por escritório).
// Esta rota só LÊ, e só para quem é membro do escritório.
import { Router } from 'express';
import { obterUsuarioDaSessao } from './auth.routes';
import { comContextoTenant } from './persistence';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const urlCadastroDP = (env: Record<string, string | undefined> = process.env) => `${(env.MURADE_DP_URL || 'https://murade-dp.onrender.com').replace(/\/$/, '')}/#cadastro-escritorio`;

export function situacaoDoCadastro(info: { name?: unknown; office_cnpj?: unknown; is_platform_owner?: unknown } | null | undefined) {
  const cnpj = info?.office_cnpj ? String(info.office_cnpj) : null;
  const dono = info?.is_platform_owner === true;
  const avisos: string[] = [];
  if (!cnpj && !dono) avisos.push('O Fisco IA ainda não tem o CNPJ do escritório. Faça o cadastro do escritório no DP (Configurações > Cadastro do escritório): ele chega ao Fiscal e o robô de empresas do Fisco IA preenche sozinho.');
  return { nome: info?.name ? String(info.name) : '', cnpj, donoDoSistema: dono, avisos };
}

const router = Router();
router.get('/escritorio/cadastro-situacao', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.query.tenantId ?? '');
  const user = await obterUsuarioDaSessao(req).catch(() => null);
  if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
  if (!UUID.test(tenantId)) return res.status(400).json({ mensagem: 'Escritório inválido.' });
  try {
    const r = await comContextoTenant(user.id, tenantId, async (c) => (await c.query('SELECT * FROM fiscoia.tenant_office_info($1::uuid)', [tenantId])).rows[0]);
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    return res.json({ ...situacaoDoCadastro(r.resultado), linkDP: urlCadastroDP() });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível ler agora.' }); }
});
export default router;
