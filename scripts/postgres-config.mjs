/**
 * Credencial de runtime restrita. DATABASE_URL administrativa fica reservada
 * exclusivamente à rotina de provisionamento do schema compartilhado.
 */
export function getFiscoIaDatabaseConfig(env = process.env) {
  const host = env.FISCOIA_PGHOST?.trim();
  const database = env.FISCOIA_PGDATABASE?.trim();
  const user = env.FISCOIA_PGUSER?.trim();
  const password = env.FISCOIA_PGPASSWORD;
  if (!host || !database || !user || !password) {
    throw new Error('Configure as variáveis FISCOIA_PGHOST, FISCOIA_PGDATABASE, FISCOIA_PGUSER e FISCOIA_PGPASSWORD.');
  }

  const port = Number(env.FISCOIA_PGPORT || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('FISCOIA_PGPORT inválida.');
  }

  return {
    host,
    port,
    database,
    user,
    password,
    ...(env.FISCOIA_PGSSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
    options: '-c search_path=fiscoia,pg_catalog',
  };
}

export function getFiscoIaMigrationDatabaseUrl(env = process.env) {
  const url = env.FISCOIA_MIGRATION_DATABASE_URL?.trim();
  if (!url) {
    throw new Error('Configure FISCOIA_MIGRATION_DATABASE_URL somente na tarefa privada de migração/bootstrap.');
  }
  return url;
}
