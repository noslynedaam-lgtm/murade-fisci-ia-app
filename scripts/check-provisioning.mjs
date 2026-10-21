import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const adminConnectionString = process.env.DATABASE_URL?.trim();
if (!adminConnectionString) {
  console.error('Conferência cancelada: configure DATABASE_URL somente na tarefa privada de diagnóstico/provisionamento.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: adminConnectionString,
  max: 1,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
});

try {
  const admin = await pool.query(`
    SELECT current_database() AS database_name,
           current_user AS connected_role,
           has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_schema,
           EXISTS (
             SELECT 1 FROM pg_roles
             WHERE rolname = current_user AND (rolsuper OR rolcreaterole)
           ) AS can_create_role
  `);
  const database = admin.rows[0];
  console.log(`Conexão administrativa: banco=${database.database_name}; criar papel=${database.can_create_role}; criar schema=${database.can_create_schema}.`);

  const schemaResult = await pool.query(`
    SELECT n.nspname, pg_get_userbyid(n.nspowner) AS owner
    FROM pg_namespace n
    WHERE n.nspname = 'fiscoia'
  `);
  const schema = schemaResult.rows[0];
  console.log(schema
    ? `Schema fiscoia: existe; proprietário=${schema.owner}.`
    : 'Schema fiscoia: não existe.');

  const rolesResult = await pool.query(`
    SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
           rolinherit, rolreplication, rolbypassrls, rolconfig
    FROM pg_roles
    WHERE rolname IN ('fiscoia_runtime', 'fiscoia_schema_owner')
    ORDER BY rolname
  `);
  const roles = new Map(rolesResult.rows.map((role) => [String(role.rolname), role]));
  for (const name of ['fiscoia_runtime', 'fiscoia_schema_owner']) {
    const role = roles.get(name);
    if (!role) {
      console.log(`Papel ${name}: não existe.`);
      continue;
    }
    console.log(`Papel ${name}: existe; login=${role.rolcanlogin}; superuser=${role.rolsuper}; createdb=${role.rolcreatedb}; createrole=${role.rolcreaterole}; inherit=${role.rolinherit}; replication=${role.rolreplication}; bypassrls=${role.rolbypassrls}; config=${JSON.stringify(role.rolconfig || [])}.`);
  }

  const runtime = roles.get('fiscoia_runtime');
  if (runtime) {
    const elevatedAttributes = ['rolsuper', 'rolcreatedb', 'rolcreaterole', 'rolreplication', 'rolbypassrls']
      .filter((attribute) => runtime[attribute] === true);
    if (!runtime.rolcanlogin || elevatedAttributes.length) {
      console.log(`ATENÇÃO: papel runtime incompatível com uso seguro: login=${runtime.rolcanlogin}; atributos elevados=${elevatedAttributes.join(', ') || 'nenhum'}.`);
      process.exitCode = 1;
    }

    const memberships = await pool.query(`
      SELECT parent.rolname
      FROM pg_auth_members m
      JOIN pg_roles parent ON parent.oid = m.roleid
      JOIN pg_roles member ON member.oid = m.member
      WHERE member.rolname = 'fiscoia_runtime'
      ORDER BY parent.rolname
    `);
    console.log(`Associações de papel do runtime: ${memberships.rows.length ? memberships.rows.map((row) => row.rolname).join(', ') : 'nenhuma'}.`);
    if (memberships.rows.length) {
      console.log('ATENÇÃO: o runtime tem associação a outro papel. Revise e remova associações antes de conectá-lo à aplicação, pois podem permitir SET ROLE ou privilégios herdados.');
      process.exitCode = 1;
    }

    const databasePrivileges = await pool.query(`
      SELECT has_database_privilege('fiscoia_runtime', current_database(), 'CREATE') AS can_create_schema
    `);
    if (databasePrivileges.rows[0]?.can_create_schema) {
      console.log('ATENÇÃO: o runtime pode criar schemas no banco. Remova esse privilégio antes de usar o papel na aplicação.');
      process.exitCode = 1;
    }

    const schemaPrivileges = await pool.query(`
      SELECT n.nspname,
             has_schema_privilege('fiscoia_runtime', n.oid, 'USAGE') AS can_use,
             has_schema_privilege('fiscoia_runtime', n.oid, 'CREATE') AS can_create
      FROM pg_namespace n
      WHERE n.nspname <> 'information_schema'
        AND n.nspname NOT LIKE 'pg_%'
        AND (has_schema_privilege('fiscoia_runtime', n.oid, 'USAGE')
          OR has_schema_privilege('fiscoia_runtime', n.oid, 'CREATE'))
      ORDER BY n.nspname
    `);
    console.log('Privilégios efetivos de schema para fiscoia_runtime (inclui grants via PUBLIC):');
    for (const privilege of schemaPrivileges.rows) {
      console.log(`  ${privilege.nspname}: USAGE=${privilege.can_use}; CREATE=${privilege.can_create}.`);
    }

    const externalTablePrivileges = await pool.query(`
      SELECT n.nspname, c.relname,
             has_table_privilege('fiscoia_runtime', c.oid, 'SELECT') AS can_select,
             has_table_privilege('fiscoia_runtime', c.oid, 'INSERT') AS can_insert,
             has_table_privilege('fiscoia_runtime', c.oid, 'UPDATE') AS can_update,
             has_table_privilege('fiscoia_runtime', c.oid, 'DELETE') AS can_delete,
             has_table_privilege('fiscoia_runtime', c.oid, 'TRUNCATE') AS can_truncate
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname <> 'fiscoia'
        AND n.nspname <> 'information_schema'
        AND n.nspname NOT LIKE 'pg_%'
        AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
        AND (has_table_privilege('fiscoia_runtime', c.oid, 'SELECT')
          OR has_table_privilege('fiscoia_runtime', c.oid, 'INSERT')
          OR has_table_privilege('fiscoia_runtime', c.oid, 'UPDATE')
          OR has_table_privilege('fiscoia_runtime', c.oid, 'DELETE')
          OR has_table_privilege('fiscoia_runtime', c.oid, 'TRUNCATE'))
      ORDER BY n.nspname, c.relname
    `);
    if (externalTablePrivileges.rows.length) {
      console.log('ATENÇÃO: privilégios efetivos em objetos fora do schema fiscoia (inclui grants via PUBLIC):');
      for (const privilege of externalTablePrivileges.rows) {
        console.log(`  ${privilege.nspname}.${privilege.relname}: SELECT=${privilege.can_select}; INSERT=${privilege.can_insert}; UPDATE=${privilege.can_update}; DELETE=${privilege.can_delete}; TRUNCATE=${privilege.can_truncate}.`);
      }
      process.exitCode = 1;
    }
    const externalSequencePrivileges = await pool.query(`
      SELECT n.nspname, c.relname,
             has_sequence_privilege('fiscoia_runtime', c.oid, 'USAGE') AS can_use,
             has_sequence_privilege('fiscoia_runtime', c.oid, 'SELECT') AS can_select,
             has_sequence_privilege('fiscoia_runtime', c.oid, 'UPDATE') AS can_update
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname <> 'fiscoia'
        AND n.nspname <> 'information_schema'
        AND n.nspname NOT LIKE 'pg_%'
        AND c.relkind = 'S'
        AND (has_sequence_privilege('fiscoia_runtime', c.oid, 'USAGE')
          OR has_sequence_privilege('fiscoia_runtime', c.oid, 'SELECT')
          OR has_sequence_privilege('fiscoia_runtime', c.oid, 'UPDATE'))
      ORDER BY n.nspname, c.relname
    `);
    if (externalSequencePrivileges.rows.length) {
      console.log('ATENÇÃO: privilégios efetivos em sequências fora do schema fiscoia (inclui grants via PUBLIC):');
      for (const privilege of externalSequencePrivileges.rows) {
        console.log(`  ${privilege.nspname}.${privilege.relname}: USAGE=${privilege.can_use}; SELECT=${privilege.can_select}; UPDATE=${privilege.can_update}.`);
      }
      process.exitCode = 1;
    }
    const externalCreate = schemaPrivileges.rows.filter((row) => row.nspname !== 'fiscoia' && row.can_create === true);
    if (externalCreate.length) {
      console.log('ATENÇÃO: o runtime pode criar objetos fora do schema fiscoia. Não use esse papel na aplicação até corrigir o privilégio efetivo ou isolar o banco.');
      process.exitCode = 1;
    }

    const ledger = await pool.query(`
      SELECT to_regclass('fiscoia.schema_migrations') AS table_name
    `);
    if (ledger.rows[0]?.table_name) {
      const dml = await pool.query(`
        SELECT has_table_privilege('fiscoia_runtime', 'fiscoia.schema_migrations', 'SELECT') AS can_select,
               has_table_privilege('fiscoia_runtime', 'fiscoia.schema_migrations', 'INSERT') AS can_insert,
               has_table_privilege('fiscoia_runtime', 'fiscoia.schema_migrations', 'UPDATE') AS can_update,
               has_table_privilege('fiscoia_runtime', 'fiscoia.schema_migrations', 'DELETE') AS can_delete
      `);
      const access = dml.rows[0];
      console.log(`Ledger de migrações: leitura=${access.can_select}; inserir=${access.can_insert}; atualizar=${access.can_update}; excluir=${access.can_delete}.`);
      if (access.can_insert || access.can_update || access.can_delete) {
        console.log('ATENÇÃO: o runtime pode alterar o ledger de migrações. Revogue os privilégios de escrita antes de usar esse papel na aplicação.');
        process.exitCode = 1;
      }
    } else {
      console.log('Ledger de migrações: ainda não existe.');
    }
  }

  const anyReservedObject = Boolean(schema || roles.size);
  if (anyReservedObject) {
    console.log('Decisão: não execute db:provision-shared-role. Já existe schema ou papel reservado; inspecione a configuração existente antes de qualquer alteração.');
  } else if (database.can_create_role && database.can_create_schema) {
    console.log('Decisão: pré-requisitos de criação parecem presentes. O provisionamento continua sendo uma operação de escrita separada e transacional.');
  } else {
    console.log('Decisão: a credencial conectada não demonstrou os privilégios necessários para provisionar papel e schema.');
    process.exitCode = 1;
  }
} catch {
  console.error('Conferência do provisionamento falhou. Verifique conectividade e privilégios; nenhum dado foi alterado.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
