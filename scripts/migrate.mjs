import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { getFiscoIaMigrationDatabaseUrl } from './postgres-config.mjs';

dotenv.config();

const { Pool } = pg;
let migrationDatabaseUrl;
try {
  migrationDatabaseUrl = getFiscoIaMigrationDatabaseUrl();
} catch (error) {
  console.error(`Migração cancelada: ${error instanceof Error ? error.message : 'credencial restrita não configurada.'}`);
  process.exit(1);
}

const migrationsDirectory = path.join(process.cwd(), 'db', 'migrations');
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/.test(file))
  .sort();
if (migrationFiles.length === 0) {
  console.error('Migração cancelada: nenhum arquivo de migração encontrado.');
  process.exit(1);
}
const pool = new Pool({
  connectionString: migrationDatabaseUrl,
  max: 1,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
});

try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('murade-fisco-ia-migrations'))");
    await client.query('CREATE SCHEMA IF NOT EXISTS fiscoia');
    await client.query(`
      CREATE TABLE IF NOT EXISTS fiscoia.schema_migrations (
        version text PRIMARY KEY,
        checksum char(64) NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const migrationFile of migrationFiles) {
      const migrationVersion = migrationFile.replace(/\.sql$/, '');
      const migrationSql = await readFile(path.join(migrationsDirectory, migrationFile), 'utf8');
      const checksum = createHash('sha256').update(migrationSql).digest('hex');
      const existing = await client.query(
        'SELECT checksum FROM fiscoia.schema_migrations WHERE version = $1',
        [migrationVersion],
      );

      if (existing.rows[0]) {
        if (existing.rows[0].checksum.trim() !== checksum) {
          throw new Error(`A migração ${migrationVersion} já foi aplicada com outro checksum; nenhuma alteração foi feita.`);
        }
        console.log(`Migração ${migrationVersion} já aplicada.`);
        continue;
      }

      await client.query(migrationSql);
      await client.query(
        'INSERT INTO fiscoia.schema_migrations (version, checksum) VALUES ($1, $2)',
        [migrationVersion, checksum],
      );
      console.log(`Migração ${migrationVersion} aplicada com sucesso.`);
    }
    await client.query('GRANT USAGE ON SCHEMA fiscoia TO fiscoia_runtime');
    await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA fiscoia TO fiscoia_runtime');
    await client.query('REVOKE INSERT, UPDATE, DELETE ON fiscoia.schema_migrations FROM fiscoia_runtime');
    await client.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA fiscoia TO fiscoia_runtime');
    // The CNPJ-wide SEFAZ quota crosses tenant boundaries by design. Keep its
    // raw request tables private; runtime may use only the guarded DB functions.
    await client.query('REVOKE ALL ON TABLE fiscoia.sefaz_dfe_global_request_attempts FROM PUBLIC, fiscoia_runtime');
    await client.query('REVOKE ALL ON TABLE fiscoia.sefaz_dfe_global_request_state FROM PUBLIC, fiscoia_runtime');
    await client.query('REVOKE ALL ON FUNCTION fiscoia.reserve_sefaz_dfe_request(text, uuid, uuid) FROM PUBLIC');
    await client.query('REVOKE ALL ON FUNCTION fiscoia.block_sefaz_dfe_cnpj(text, uuid, uuid, timestamptz) FROM PUBLIC');
    await client.query('GRANT EXECUTE ON FUNCTION fiscoia.reserve_sefaz_dfe_request(text, uuid, uuid) TO fiscoia_runtime');
    await client.query('GRANT EXECUTE ON FUNCTION fiscoia.block_sefaz_dfe_cnpj(text, uuid, uuid, timestamptz) TO fiscoia_runtime');
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA fiscoia
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fiscoia_runtime`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA fiscoia
      GRANT USAGE, SELECT ON SEQUENCES TO fiscoia_runtime`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  // Não imprimir o erro do driver: ele pode carregar host/usuário da conexão.
  console.error(error instanceof Error ? error.message : 'Falha ao aplicar migração PostgreSQL.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
