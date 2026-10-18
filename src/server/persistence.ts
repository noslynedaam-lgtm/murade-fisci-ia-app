import { Pool, type PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export type EstadoBanco = 'nao_configurado' | 'conectado' | 'indisponivel';
export type EstadoSchema = 'nao_verificado' | 'migracoes_pendentes' | 'migrado' | 'indisponivel';
const MIGRACOES_ESPERADAS = [
  '001_multiempresa_base',
  '002_auth_account_profile',
  '003_archive_companies',
  '004_reforma_company_scenarios',
  '005_reforma_rules_version_day',
];

const connectionString = process.env.DATABASE_URL?.trim();
let pool: Pool | null = null;

if (connectionString) {
  pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 3_000,
  });

  // Registra apenas o estado: mensagens de erro do driver podem conter metadados
  // de conexão e nunca devem ser enviadas ao log público da aplicação.
  pool.on('error', () => {
    console.error('A conexão ociosa com PostgreSQL foi interrompida.');
  });
}

export function obterPoolBanco(): Pool | null {
  return pool;
}

/** Confirma uma ida e volta real ao PostgreSQL sem devolver detalhes do segredo. */
export async function verificarBancoPermanente(): Promise<EstadoBanco> {
  if (!pool) return 'nao_configurado';

  try {
    await pool.query('SELECT 1');
    return 'conectado';
  } catch {
    return 'indisponivel';
  }
}

/** Confere a trilha de migrações sem revelar detalhes da conexão. */
export async function verificarSchema(): Promise<{ estado: EstadoSchema; aplicadas: number; esperadas: number }> {
  if (!pool) return { estado: 'nao_verificado', aplicadas: 0, esperadas: 0 };
  try {
    const table = await pool.query("SELECT to_regclass('fiscoia.schema_migrations') AS migration_table");
    if (!table.rows[0]?.migration_table) {
      return { estado: 'migracoes_pendentes', aplicadas: 0, esperadas: MIGRACOES_ESPERADAS.length };
    }
    const result = await pool.query("SELECT version FROM fiscoia.schema_migrations ORDER BY version");
    const appliedVersions = new Set(result.rows.map((row) => String(row.version)));
    const applied = MIGRACOES_ESPERADAS.filter((version) => appliedVersions.has(version)).length;
    const expected = MIGRACOES_ESPERADAS.length;
    return {
      estado: applied === expected ? 'migrado' : 'migracoes_pendentes',
      aplicadas: applied,
      esperadas: expected,
    };
  } catch {
    return { estado: 'indisponivel', aplicadas: 0, esperadas: MIGRACOES_ESPERADAS.length };
  }
}

/** Executa consultas empresariais com contexto de usuário/tenant limitado à transação. */
export async function comContextoTenant<T>(
  userId: string,
  tenantId: string,
  operation: (client: PoolClient) => Promise<T>,
  papeisPermitidos?: string[],
): Promise<{ autorizado: false } | { autorizado: true; papel: string; resultado?: T }> {
  if (!pool) throw new Error('Banco permanente não configurado.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const membership = await client.query(
      `SELECT role FROM fiscoia.tenant_memberships WHERE tenant_id = $1 AND user_id = $2 LIMIT 1`,
      [tenantId, userId],
    );
    if (!membership.rows[0]) {
      await client.query('ROLLBACK');
      return { autorizado: false };
    }
    const papel = String(membership.rows[0].role);
    if (papeisPermitidos && !papeisPermitidos.includes(papel)) {
      await client.query('ROLLBACK');
      return { autorizado: true, papel };
    }
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const resultado = await operation(client);
    await client.query('COMMIT');
    return { autorizado: true, papel, resultado };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
