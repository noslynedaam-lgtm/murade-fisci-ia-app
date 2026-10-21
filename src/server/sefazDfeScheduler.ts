import { comContextoTenant, obterPoolBanco } from './persistence';
import { consultarDfePeloWorker } from './sefazDistribution.routes';

const TICK_MS = 60_000;
const MIN_INTERVAL_MINUTES = 61;
const ROLES = ['OWNER', 'ADMIN', 'CONTADOR'];
const MAX_USERS = 200;

interface DueCompany {
  userId: string;
  tenantId: string;
  companyId: string;
}

let running = false;

async function findDueCompany(): Promise<DueCompany | null> {
  const pool = obterPoolBanco();
  if (!pool) return null;
  const users = await pool.query(
    'SELECT id FROM fiscoia.users WHERE active = true ORDER BY id LIMIT $1',
    [MAX_USERS],
  );
  const seenTenants = new Set<string>();
  for (const row of users.rows) {
    const userId = String(row.id);
    const client = await pool.connect();
    let tenantIds: string[] = [];
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      const memberships = await client.query(
        'SELECT tenant_id FROM fiscoia.tenant_memberships WHERE user_id=$1 AND role=ANY($2::text[])',
        [userId, ROLES],
      );
      tenantIds = memberships.rows.map((membership) => String(membership.tenant_id));
      await client.query('COMMIT');
    } catch {
      await client.query('ROLLBACK').catch(() => undefined);
    } finally {
      client.release();
    }

    for (const tenantId of tenantIds) {
      if (seenTenants.has(tenantId)) continue;
      seenTenants.add(tenantId);
      const scoped = await comContextoTenant(userId, tenantId, async (db) => {
        const due = await db.query(
          `SELECT c.id, c.cnpj
             FROM fiscoia.companies c
             JOIN fiscoia.company_fiscal_certificates cert
               ON cert.tenant_id=c.tenant_id AND cert.company_id=c.id
             LEFT JOIN fiscoia.fiscal_dfe_cursors cur
               ON cur.tenant_id=c.tenant_id AND cur.company_id=c.id
            WHERE c.tenant_id=$1 AND c.archived_at IS NULL
              AND c.metadata->>'sefazDfeAutomatica'='true'
              AND (cur.blocked_until IS NULL OR cur.blocked_until <= now())
              AND (cur.last_request_at IS NULL
                   OR cur.last_request_at <= now() - make_interval(mins => $2))
            ORDER BY cur.last_request_at NULLS FIRST, c.id
            LIMIT 1`,
          [tenantId, MIN_INTERVAL_MINUTES],
        );
        const company = due.rows[0];
        return company ? {
          userId,
          tenantId,
          companyId: String(company.id),
        } satisfies DueCompany : null;
      }, ROLES);
      if (scoped.autorizado && scoped.resultado) return scoped.resultado;
    }
  }
  return null;
}

export async function executarConsultaAutomaticaSefaz(): Promise<void> {
  if (running || process.env.FISCOIA_SEFAZ_AUTO_DOWNLOAD === '0' || !obterPoolBanco()) return;
  running = true;
  try {
    const company = await findDueCompany();
    if (!company) return;
    const result = await consultarDfePeloWorker(company.userId, company.tenantId, company.companyId);
    if (result.status >= 400) {
      console.warn(`Consulta automática SEFAZ não concluída para empresa ${company.companyId}: HTTP ${result.status}.`);
      return;
    }
    const body = result.corpo as { cStat?: number; documentosNovos?: number } | undefined;
    console.log(`Consulta automática SEFAZ concluída para empresa ${company.companyId}: cStat ${body?.cStat ?? 'indisponível'}, novos ${body?.documentosNovos ?? 0}.`);
  } catch {
    console.error('Falha no agendador de consulta automática SEFAZ.');
  } finally {
    running = false;
  }
}

export function iniciarConsultaAutomaticaSefaz(): void {
  if (process.env.FISCOIA_SEFAZ_AUTO_DOWNLOAD === '0') {
    console.warn('Consulta automática SEFAZ desligada por configuração.');
    return;
  }
  if (!obterPoolBanco()) {
    console.warn('Consulta automática SEFAZ desabilitada: banco permanente não configurado.');
    return;
  }
  const primeira = setTimeout(() => void executarConsultaAutomaticaSefaz(), 90_000);
  primeira.unref();
  const repeticao = setInterval(() => void executarConsultaAutomaticaSefaz(), TICK_MS);
  repeticao.unref();
  console.log('Consulta automática SEFAZ habilitada para empresas com opt-in e A1 ativo: uma empresa por minuto, cada CNPJ no mínimo a cada 61 minutos.');
}
