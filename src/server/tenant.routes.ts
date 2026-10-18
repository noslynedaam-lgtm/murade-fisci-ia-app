import { Router } from 'express';
import { obterUsuarioDaSessao } from './auth.routes';
import { comContextoTenant, obterPoolBanco } from './persistence';
import { validarCnpj } from '../services/cnpj/cnpjValidation';

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const METADATA_LIMITS: Record<string, number> = {
  nomeFantasia: 240, inscricaoEstadual: 40, inscricaoMunicipal: 40, cnaePrincipal: 40,
  telefone: 40, email: 254, endereco: 240, logradouro: 240, numero: 40, bairro: 120,
  cep: 12, responsavelLegal: 160, cpfResponsavel: 20, nomeContador: 160, crcContador: 40,
  cpfContador: 20, telefoneContador: 40, emailContador: 254,
};

function lerMetadataEmpresa(body: unknown): Record<string, string> {
  if (!body || typeof body !== 'object') return {};
  const source = body as Record<string, unknown>;
  const metadata: Record<string, string> = {};
  for (const [key, maxLength] of Object.entries(METADATA_LIMITS)) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) metadata[key] = value.trim().slice(0, maxLength);
  }
  return metadata;
}

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});

router.get('/tenants', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.user_id', $1, true)", [user.id]);
      const memberships = await client.query(
        'SELECT tenant_id, role FROM fiscoia.tenant_memberships WHERE user_id = $1 ORDER BY created_at, tenant_id',
        [user.id],
      );
      const tenants = [];
      for (const membership of memberships.rows) {
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [String(membership.tenant_id)]);
        const tenant = await client.query('SELECT id, name FROM fiscoia.tenants WHERE id = $1 LIMIT 1', [membership.tenant_id]);
        if (tenant.rows[0]) tenants.push({ id: String(tenant.rows[0].id), nome: String(tenant.rows[0].name), papel: membership.role });
      }
      await client.query('COMMIT');
      return res.json({ tenants });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível consultar os escritórios da sessão.' });
  }
});

router.post('/tenants', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  if (nome.length < 2 || nome.length > 160) return res.status(400).json({ mensagem: 'O nome do escritório deve ter entre 2 e 160 caracteres.' });
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    if (!user.ehAdmin) return res.status(403).json({ mensagem: 'Somente a conta administradora pode criar novos escritórios.' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tenant = await client.query('INSERT INTO fiscoia.tenants (name) VALUES ($1) RETURNING id, name', [nome]);
      await client.query(
        "INSERT INTO fiscoia.tenant_memberships (tenant_id, user_id, role) VALUES ($1, $2, 'OWNER')",
        [tenant.rows[0].id, user.id],
      );
      await client.query('COMMIT');
      return res.status(201).json({ tenant: { id: String(tenant.rows[0].id), nome: String(tenant.rows[0].name), papel: 'OWNER' } });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível criar o escritório no banco central.' });
  }
});

router.get('/companies', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : '';
  if (!UUID.test(tenantId)) return res.status(400).json({ mensagem: 'Informe um escritório válido.' });
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const scoped = await comContextoTenant(user.id, tenantId, async (client) => client.query(
      `SELECT id, cnpj, legal_name, state, municipality, tax_regime, metadata, created_at, updated_at
         FROM fiscoia.companies WHERE tenant_id = $1 AND archived_at IS NULL ORDER BY legal_name, cnpj`,
      [tenantId],
    ));
    if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    return res.json({ empresas: scoped.resultado.rows });
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível carregar as empresas do escritório.' });
  }
});

router.post('/companies', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId : '';
  const cnpj = typeof req.body?.cnpj === 'string' ? req.body.cnpj.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  const legalName = typeof req.body?.razaoSocial === 'string' ? req.body.razaoSocial.trim() : '';
  const state = typeof req.body?.estado === 'string' ? req.body.estado.trim().toUpperCase() : null;
  const municipality = typeof req.body?.municipio === 'string' ? req.body.municipio.trim() : null;
  const taxRegime = typeof req.body?.regimeTributario === 'string' ? req.body.regimeTributario.trim() : null;
  const metadata = lerMetadataEmpresa(req.body);
  if (!UUID.test(tenantId)) return res.status(400).json({ mensagem: 'Informe um escritório válido.' });
  if (!validarCnpj(cnpj) || legalName.length < 2 || legalName.length > 240) {
    return res.status(400).json({ mensagem: 'Informe uma razão social e um CNPJ com formato e dígitos verificadores válidos.' });
  }
  if (state && !/^[A-Z]{2}$/.test(state)) return res.status(400).json({ mensagem: 'Use a sigla de UF com duas letras.' });
  if (municipality && municipality.length > 120) return res.status(400).json({ mensagem: 'Município muito longo.' });
  if (taxRegime && taxRegime.length > 80) return res.status(400).json({ mensagem: 'Regime tributário muito longo.' });
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const scoped = await comContextoTenant(user.id, tenantId, async (client) => client.query(
      `INSERT INTO fiscoia.companies (tenant_id, cnpj, legal_name, state, municipality, tax_regime, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING id, cnpj, legal_name, state, municipality, tax_regime, metadata, created_at, updated_at`,
      [tenantId, cnpj, legalName, state || null, municipality || null, taxRegime || null, JSON.stringify(metadata)],
    ), ['OWNER', 'ADMIN']);
    if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!scoped.resultado) return res.status(403).json({ mensagem: 'Somente proprietário ou administrador pode cadastrar empresas.' });
    return res.status(201).json({ empresa: scoped.resultado.rows[0] });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return res.status(409).json({ mensagem: 'Este CNPJ já está cadastrado neste escritório.' });
    }
    return res.status(503).json({ mensagem: 'Não foi possível cadastrar a empresa no banco.' });
  }
});

router.put('/companies/:companyId', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId : '';
  const companyId = req.params.companyId;
  const legalName = typeof req.body?.razaoSocial === 'string' ? req.body.razaoSocial.trim() : '';
  const state = typeof req.body?.estado === 'string' ? req.body.estado.trim().toUpperCase() : null;
  const municipality = typeof req.body?.municipio === 'string' ? req.body.municipio.trim() : null;
  const taxRegime = typeof req.body?.regimeTributario === 'string' ? req.body.regimeTributario.trim() : null;
  const metadata = lerMetadataEmpresa(req.body);
  if (!UUID.test(tenantId) || !UUID.test(companyId)) return res.status(400).json({ mensagem: 'Escritório ou empresa inválidos.' });
  if (legalName.length < 2 || legalName.length > 240) return res.status(400).json({ mensagem: 'Razão social inválida.' });
  if (state && !/^[A-Z]{2}$/.test(state)) return res.status(400).json({ mensagem: 'Use a sigla de UF com duas letras.' });
  if (municipality && municipality.length > 120) return res.status(400).json({ mensagem: 'Município muito longo.' });
  if (taxRegime && taxRegime.length > 80) return res.status(400).json({ mensagem: 'Regime tributário muito longo.' });
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const scoped = await comContextoTenant(user.id, tenantId, async (client) => client.query(
      `UPDATE fiscoia.companies
          SET legal_name = $1, state = $2, municipality = $3, tax_regime = $4,
              metadata = $5::jsonb, updated_at = now()
        WHERE id = $6 AND tenant_id = $7 AND archived_at IS NULL
        RETURNING id, cnpj, legal_name, state, municipality, tax_regime, metadata, created_at, updated_at`,
      [legalName, state || null, municipality || null, taxRegime || null, JSON.stringify(metadata), companyId, tenantId],
    ), ['OWNER', 'ADMIN']);
    if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!scoped.resultado) return res.status(403).json({ mensagem: 'Somente proprietário ou administrador pode alterar empresas.' });
    if (!scoped.resultado.rowCount) return res.status(404).json({ mensagem: 'Empresa não encontrada neste escritório.' });
    return res.json({ empresa: scoped.resultado.rows[0] });
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível atualizar a empresa no banco.' });
  }
});

router.delete('/companies/:companyId', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId : '';
  const companyId = req.params.companyId;
  if (!UUID.test(tenantId) || !UUID.test(companyId)) return res.status(400).json({ mensagem: 'Escritório ou empresa inválidos.' });
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const scoped = await comContextoTenant(user.id, tenantId, async (client) => {
      const archived = await client.query(
        `UPDATE fiscoia.companies
            SET archived_at = now(), archived_by = $1, updated_at = now()
          WHERE id = $2 AND tenant_id = $3 AND archived_at IS NULL
          RETURNING id, cnpj, legal_name`,
        [user.id, companyId, tenantId],
      );
      if (archived.rowCount) {
        await client.query(
          `INSERT INTO fiscoia.audit_events (tenant_id, actor_user_id, event_type, entity_type, entity_id, details)
           VALUES ($1, $2, 'company.archived', 'company', $3, '{"documents_preserved":true}'::jsonb)`,
          [tenantId, user.id, companyId],
        );
      }
      return archived;
    }, ['OWNER', 'ADMIN']);
    if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!scoped.resultado) return res.status(403).json({ mensagem: 'Somente proprietário ou administrador pode arquivar empresas.' });
    if (!scoped.resultado.rowCount) return res.status(404).json({ mensagem: 'Empresa não encontrada ou já arquivada.' });
    return res.json({ empresa: scoped.resultado.rows[0], documentosPreservados: true });
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível arquivar a empresa. Nenhum documento fiscal foi apagado.' });
  }
});

router.post('/companies/:companyId/restore', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId : '';
  const companyId = req.params.companyId;
  if (!UUID.test(tenantId) || !UUID.test(companyId)) return res.status(400).json({ mensagem: 'Escritório ou empresa inválidos.' });
  try {
    const user = await obterUsuarioDaSessao(req);
    if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const scoped = await comContextoTenant(user.id, tenantId, async (client) => {
      const restored = await client.query(
        `UPDATE fiscoia.companies
            SET archived_at = NULL, archived_by = NULL, updated_at = now()
          WHERE id = $1 AND tenant_id = $2 AND archived_at IS NOT NULL
          RETURNING id, cnpj, legal_name`,
        [companyId, tenantId],
      );
      if (restored.rowCount) {
        await client.query(
          `INSERT INTO fiscoia.audit_events (tenant_id, actor_user_id, event_type, entity_type, entity_id, details)
           VALUES ($1, $2, 'company.restored', 'company', $3, '{}'::jsonb)`,
          [tenantId, user.id, companyId],
        );
      }
      return restored;
    }, ['OWNER', 'ADMIN']);
    if (!scoped.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!scoped.resultado) return res.status(403).json({ mensagem: 'Somente proprietário ou administrador pode restaurar empresas.' });
    if (!scoped.resultado.rowCount) return res.status(404).json({ mensagem: 'Empresa arquivada não encontrada neste escritório.' });
    return res.json({ empresa: scoped.resultado.rows[0] });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return res.status(409).json({ mensagem: 'Já existe uma empresa ativa com este CNPJ neste escritório.' });
    }
    return res.status(503).json({ mensagem: 'Não foi possível restaurar a empresa.' });
  }
});

export default router;
