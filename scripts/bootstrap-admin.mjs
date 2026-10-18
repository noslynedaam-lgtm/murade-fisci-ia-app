import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { pbkdf2 as pbkdf2Callback } from 'node:crypto';
import dotenv from 'dotenv';
import pg from 'pg';
import { getFiscoIaMigrationDatabaseUrl } from './postgres-config.mjs';

dotenv.config();
const pbkdf2 = promisify(pbkdf2Callback);
const { Pool } = pg;

const email = process.env.FISCOIA_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const name = process.env.FISCOIA_BOOTSTRAP_NAME?.trim();
const password = process.env.FISCOIA_BOOTSTRAP_PASSWORD;

let migrationDatabaseUrl;
try {
  migrationDatabaseUrl = getFiscoIaMigrationDatabaseUrl();
} catch (error) {
  console.error(`Bootstrap cancelado: ${error instanceof Error ? error.message : 'credencial restrita não configurada.'}`);
  process.exit(1);
}
if (!email || !name || !password) {
  console.error('Bootstrap cancelado: configure as três variáveis FISCOIA_BOOTSTRAP_* no ambiente seguro do serviço.');
  process.exit(1);
}
if (password.length < 16 || password.length > 1024) {
  console.error('Bootstrap cancelado: a senha inicial deve ter entre 16 e 1024 caracteres.');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || name.length < 2 || name.length > 160) {
  console.error('Bootstrap cancelado: e-mail ou nome inválido.');
  process.exit(1);
}

const pool = new Pool({ connectionString: migrationDatabaseUrl, max: 1, connectionTimeoutMillis: 5_000, statement_timeout: 15_000 });
try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('murade-fisco-ia-bootstrap-admin'))");
    const count = await client.query('SELECT count(*)::int AS total FROM fiscoia.users');
    if (Number(count.rows[0]?.total) !== 0) {
      throw new Error('Bootstrap cancelado: já existe pelo menos uma conta; nenhum usuário foi alterado.');
    }

    const salt = randomBytes(16);
    const digest = await pbkdf2(password, salt, 210_000, 32, 'sha256');
    const passwordHash = `pbkdf2-sha256$210000$${salt.toString('hex')}$${Buffer.from(digest).toString('hex')}`;
    const tenant = await client.query('INSERT INTO fiscoia.tenants (name) VALUES ($1) RETURNING id', [`Escritório de ${name}`]);
    const user = await client.query(
      `INSERT INTO fiscoia.users
         (email, password_hash, display_name, active, plan_id, plan_name, must_change_password, is_admin, account_type)
       VALUES ($1, $2, $3, true, 'empresarial', 'Empresarial', true, true, 'ADMIN')
       RETURNING id`,
      [email, passwordHash, name],
    );
    await client.query(
      "INSERT INTO fiscoia.tenant_memberships (tenant_id, user_id, role) VALUES ($1, $2, 'OWNER')",
      [tenant.rows[0].id, user.rows[0].id],
    );
    await client.query('COMMIT');
    console.log(`Administrador inicial criado para ${email}. A senha inicial deve ser trocada no primeiro acesso.`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Bootstrap do administrador falhou.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
