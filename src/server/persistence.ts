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
  '006_tenant_provisioning',
  '007_company_fiscal_certificate_vault',
  '008_sefaz_dfe_distribution',
  '009_sefaz_certificate_validation',
  '010_sefaz_dfe_global_cnpj_rate_limit',
  '011_central_sso_authorization',
  '012_platform_offices',
];

const hasScopedDatabaseConfig = Boolean(
  process.env.FISCOIA_PGHOST || process.env.FISCOIA_PGDATABASE
    || process.env.FISCOIA_PGUSER || process.env.FISCOIA_PGPASSWORD,
);
const scopedDatabaseComplete = Boolean(
  process.env.FISCOIA_PGHOST?.trim() && process.env.FISCOIA_PGDATABASE?.trim()
    && process.env.FISCOIA_PGUSER?.trim() && process.env.FISCOIA_PGPASSWORD,
);
const scopedDatabaseConfig = scopedDatabaseComplete
  ? {
      host: process.env.FISCOIA_PGHOST!.trim(),
      port: Number(process.env.FISCOIA_PGPORT || 5432),
      database: process.env.FISCOIA_PGDATABASE?.trim(),
      user: process.env.FISCOIA_PGUSER?.trim(),
      password: process.env.FISCOIA_PGPASSWORD!,
      ...(process.env.FISCOIA_PGSSL === 'true'
        ? { ssl: { rejectUnauthorized: true } }
        : {}),
      options: '-c search_path=fiscoia,pg_catalog',
    }
  : null;
// Em produção, DATABASE_URL nunca deve ser usado como credencial da aplicação:
// no PostgreSQL compartilhado ele normalmente é o proprietário com acesso a todos os schemas.
const localDevelopmentConnection = process.env.NODE_ENV !== 'production'
  && !hasScopedDatabaseConfig
  ? process.env.DATABASE_URL?.trim()
  : undefined;
let pool: Pool | null = null;

if ((hasScopedDatabaseConfig && scopedDatabaseComplete) || localDevelopmentConnection) {
  pool = new Pool({
    ...(scopedDatabaseConfig || { connectionString: localDevelopmentConnection }),
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
