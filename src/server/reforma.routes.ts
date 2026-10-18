import { Router } from 'express';
import { obterUsuarioDaSessao } from './auth.routes';
import { comContextoTenant, obterPoolBanco } from './persistence';

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSAO_REGRAS = /^\d{4}\.\d{2}(?:\.\d{2})?$/;
const CAMPOS_TEXTO = ['receitaAnual', 'cargaAtual', 'comprasPotencialmenteCreditorias', 'percentualElegivel', 'setorReferencia', 'benchmarkSetor'] as const;
const CAMPOS_PERIODO = ['2026', '2027_2028', '2029_2032', '2033'] as const;
const REVISOES_VALIDAS = new Set(['PENDENTE', 'APLICA', 'NAO_APLICA']);
const IDS_LEI = new Set(['fase_teste', 'transicao_cbs', 'credito', 'simples', 'transicao_icms_iss', 'seletivo', 'integral']);

function validarCenario(input: unknown): input is Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  if (CAMPOS_TEXTO.some((campo) => typeof value[campo] !== 'string' || (value[campo] as string).length > 40)) return false;
  if (!value.aliquotasNovas || typeof value.aliquotasNovas !== 'object' || Array.isArray(value.aliquotasNovas)) return false;
  const aliquotas = value.aliquotasNovas as Record<string, unknown>;
  if (Object.keys(aliquotas).some((key) => !(CAMPOS_PERIODO as readonly string[]).includes(key))) return false;
  if (Object.values(aliquotas).some((item) => typeof item !== 'string' || item.length > 40)) return false;
  if (!value.revisoes || typeof value.revisoes !== 'object' || Array.isArray(value.revisoes)) return false;
  const revisoes = value.revisoes as Record<string, unknown>;
  if (Object.keys(revisoes).some((key) => !IDS_LEI.has(key))) return false;
  if (Object.values(revisoes).some((item) => typeof item !== 'string' || !REVISOES_VALIDAS.has(item))) return false;
  return Object.keys(value).every((key) => [...CAMPOS_TEXTO, 'aliquotasNovas', 'revisoes'].includes(key));
}

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});

router.get('/companies/:companyId/reforma-scenario', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : '';
  const companyId = req.params.companyId;
  if (!UUID.test(tenantId) || !UUID.test(companyId)) return res.status(400).json({ mensagem: 'Escritório ou empresa inválidos.' });
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const scoped = await comContextoTenant(user.id, tenantId, async (client) => {
      const result = await client.query(
        `SELECT scenario, rules_version, updated_at::text AS updated_at
           FROM fiscoia.company_reform_scenarios
          WHERE tenant_id = $1 AND company_id = $2`,
        [tenantId, companyId],
      );
      return result.rows[0] || null;
    });
    if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    return res.json({ cenario: scoped.resultado?.scenario ?? null, versaoRegras: scoped.resultado?.rules_version ?? null, atualizadoEm: scoped.resultado?.updated_at ?? null });
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível carregar o cenário permanente.' });
  }
});

router.put('/companies/:companyId/reforma-scenario', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId : '';
  const companyId = req.params.companyId;
  const rulesVersion = typeof req.body?.versaoRegras === 'string' ? req.body.versaoRegras : '';
  const scenario = req.body?.cenario;
  const expectedUpdatedAt = req.body?.versaoEsperada;
  if (!UUID.test(tenantId) || !UUID.test(companyId)) return res.status(400).json({ mensagem: 'Escritório ou empresa inválidos.' });
  if (!VERSAO_REGRAS.test(rulesVersion) || !validarCenario(scenario)) return res.status(400).json({ mensagem: 'Cenário inválido. Revise os campos e a versão das regras.' });
  if (expectedUpdatedAt !== null && (typeof expectedUpdatedAt !== 'string' || Number.isNaN(Date.parse(expectedUpdatedAt)))) {
    return res.status(400).json({ mensagem: 'Versão esperada do cenário inválida. Recarregue os dados antes de salvar.' });
  }
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const scoped = await comContextoTenant(user.id, tenantId, async (client) => {
      const company = await client.query(
        'SELECT id FROM fiscoia.companies WHERE tenant_id = $1 AND id = $2 AND archived_at IS NULL LIMIT 1',
        [tenantId, companyId],
      );
      if (!company.rows[0]) return null;
      const saved = expectedUpdatedAt === null
        ? await client.query(
          `INSERT INTO fiscoia.company_reform_scenarios (tenant_id, company_id, scenario, rules_version, updated_by)
           VALUES ($1, $2, $3::jsonb, $4, $5)
           ON CONFLICT (tenant_id, company_id) DO NOTHING
           RETURNING updated_at::text AS updated_at`,
          [tenantId, companyId, JSON.stringify(scenario), rulesVersion, user.id],
        )
        : await client.query(
          `UPDATE fiscoia.company_reform_scenarios
              SET scenario = $3::jsonb, rules_version = $4, updated_by = $5, updated_at = now()
            WHERE tenant_id = $1 AND company_id = $2 AND updated_at = $6::timestamptz
            RETURNING updated_at::text AS updated_at`,
          [tenantId, companyId, JSON.stringify(scenario), rulesVersion, user.id, expectedUpdatedAt],
        );
      if (!saved.rows[0]) return { conflito: true };
      await client.query(
        `INSERT INTO fiscoia.audit_events (tenant_id, actor_user_id, event_type, entity_type, entity_id, details)
         VALUES ($1, $2, 'reforma.scenario.saved', 'company_reform_scenario', $3, $4::jsonb)`,
        [tenantId, user.id, companyId, JSON.stringify({ rulesVersion })],
      );
      return { conflito: false as const, atualizadoEm: saved.rows[0].updated_at };
    }, ['OWNER', 'ADMIN', 'CONTADOR', 'OPERADOR']);
    if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!scoped.resultado) return res.status(403).json({ mensagem: 'Seu perfil não pode salvar cenários ou a empresa não está ativa neste escritório.' });
    if (scoped.resultado.conflito) return res.status(409).json({ conflito: true, mensagem: 'O cenário foi alterado em outra sessão depois do carregamento. As alterações atuais foram preservadas; recarregue antes de tentar novamente.' });
    return res.json({ salvo: true, atualizadoEm: scoped.resultado.atualizadoEm });
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível salvar o cenário permanente.' });
  }
});

export default router;
