import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { getFiscoIaMigrationDatabaseUrl } from './postgres-config.mjs';

dotenv.config();

const { Pool } = pg;
const migrationsDirectory = path.join(process.cwd(), 'db', 'migrations');
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/.test(file))
  .sort();

if (migrationFiles.length === 0) {
  console.error('Conferência cancelada: nenhum arquivo de migração encontrado.');
  process.exit(1);
}

let migrationDatabaseUrl;
try {
  migrationDatabaseUrl = getFiscoIaMigrationDatabaseUrl();
} catch (error) {
  console.error(`Conferência cancelada: ${error instanceof Error ? error.message : 'credencial administrativa não configurada.'}`);
  process.exit(1);
}

const localChecksums = new Map();
for (const file of migrationFiles) {
  const sql = await readFile(path.join(migrationsDirectory, file), 'utf8');
  localChecksums.set(file.replace(/\.sql$/, ''), createHash('sha256').update(sql).digest('hex'));
}

const pool = new Pool({
  connectionString: migrationDatabaseUrl,
  max: 1,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
});

try {
  const result = await pool.query(`
    SELECT to_regclass('fiscoia.schema_migrations') AS migration_table
  `);
  if (!result.rows[0]?.migration_table) {
    console.log(`Schema de migrações ausente: 0/${migrationFiles.length} aplicadas; nenhuma alteração foi feita.`);
    process.exitCode = 1;
  } else {
    const appliedResult = await pool.query(`
      SELECT version, checksum
      FROM fiscoia.schema_migrations
      ORDER BY version
    `);
    const applied = new Map(appliedResult.rows.map((row) => [String(row.version), String(row.checksum).trim()]));
    let pending = 0;
    let mismatched = 0;
    let unknown = 0;

    for (const [version, checksum] of localChecksums) {
      const actual = applied.get(version);
      if (!actual) {
        pending += 1;
        console.log(`PENDENTE  ${version}`);
      } else if (actual !== checksum) {
        mismatched += 1;
        console.log(`CHECKSUM DIVERGENTE  ${version}`);
      } else {
        console.log(`APLICADA  ${version}`);
      }
    }

    for (const version of applied.keys()) {
      if (!localChecksums.has(version)) {
        unknown += 1;
        console.log(`VERSÃO SEM ARQUIVO LOCAL  ${version}`);
      }
    }

    const matched = localChecksums.size - pending - mismatched;
    console.log(`Resumo: ${matched}/${localChecksums.size} aplicadas com checksum correspondente; ${pending} pendentes; ${mismatched} divergentes; ${unknown} sem arquivo local.`);
    if (pending || mismatched || unknown) process.exitCode = 1;
  }
} catch {
  console.error('Conferência falhou ao consultar PostgreSQL. Verifique conectividade e permissões; nenhum dado foi alterado.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
