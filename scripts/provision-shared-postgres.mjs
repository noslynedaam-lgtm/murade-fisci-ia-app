import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const adminConnectionString = process.env.DATABASE_URL?.trim();
const runtimePassword = process.env.FISCOIA_PGPASSWORD;

if (!adminConnectionString || !runtimePassword || runtimePassword.length < 32) {
  console.error('Provisionamento cancelado: configure DATABASE_URL administrativa e FISCOIA_PGPASSWORD (mínimo 32 caracteres) no ambiente privado da tarefa.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: adminConnectionString,
  max: 1,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
});

try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('murade-fisco-ia-shared-schema-provision'))");

    const permission = await client.query(`
      SELECT role.rolsuper OR role.rolcreaterole AS can_create_role
      FROM pg_roles AS role
      WHERE role.rolname = current_user
    `);
    if (!permission.rows[0]?.can_create_role) {
      throw new Error('A credencial administrativa do PostgreSQL não pode criar usuário restrito.');
    }

    const existingSchema = await client.query(
      "SELECT nspname FROM pg_namespace WHERE nspname = 'fiscoia'",
    );
    const existingRoles = await client.query(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('fiscoia_runtime', 'fiscoia_schema_owner')",
    );
    if (existingSchema.rowCount || existingRoles.rowCount) {
      throw new Error('Provisionamento cancelado: o schema fiscoia ou um dos papéis exclusivos já existe. Nenhuma senha ou dado foi alterado.');
    }

    await client.query('CREATE ROLE fiscoia_schema_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION');
    const createRole = await client.query(
      `SELECT format(
         'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION PASSWORD %L',
         'fiscoia_runtime', $1
       ) AS statement`,
      [runtimePassword],
    );
    await client.query(createRole.rows[0].statement);

    const currentDatabase = await client.query('SELECT current_database() AS name');
    const databaseName = currentDatabase.rows[0]?.name;
    const grantConnect = await client.query(
      "SELECT format('GRANT CONNECT ON DATABASE %I TO %I', $1, 'fiscoia_runtime') AS statement",
      [databaseName],
    );
    await client.query(grantConnect.rows[0].statement);
    await client.query('CREATE SCHEMA fiscoia AUTHORIZATION fiscoia_schema_owner');
    await client.query('REVOKE ALL ON SCHEMA public FROM fiscoia_runtime');
    const grantMigrationRole = await client.query(
      "SELECT format('GRANT fiscoia_schema_owner TO %I', current_user) AS statement",
    );
    await client.query(grantMigrationRole.rows[0].statement);
    await client.query("ALTER ROLE fiscoia_runtime SET search_path = fiscoia, pg_catalog");
    await client.query('COMMIT');

    console.log('Schema fiscoia criado com proprietário sem login e usuário de runtime separado. O runtime não recebeu privilégios de DDL, superusuário, criação de banco, criação de papéis ou acesso a outros schemas.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error(error instanceof Error ? error.message : 'Provisionamento do schema restrito falhou.');
    process.exitCode = 1;
  } finally {
    client.release();
  }
} catch {
  console.error('Provisionamento não conseguiu conectar ao PostgreSQL administrativo; detalhes da conexão foram omitidos.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
