// Nome de tratamento e saudação do dia da Agente IA do Fisco IA.
// Com PostgreSQL de teste (DATABASE_URL, migrações 001 a 018): aplica a 019 (idempotente) e confere gravação por usuário.
// Também cria um banco descartável SEM a migração 019 para provar que nada quebra enquanto ela não estiver em produção.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Pool } from 'pg';

const urlBanco = process.env.DATABASE_URL;

async function aplicarMigracao019(pool: Pool): Promise<void> {
  const sql = await readFile(new URL('../../db/migrations/019_agente_nome_saudacao.sql', import.meta.url), 'utf8');
  await pool.query(sql);
}

test('Fisco IA: nome e saudação do dia gravados por usuário (banco real, migração 019)', { skip: !urlBanco, timeout: 60_000 }, async () => {
  const { obterPoolBanco } = await import('./persistence');
  const { criarPerfilSaudacao } = await import('./agentePerfil');
  const pool = obterPoolBanco()!;
  assert.ok(pool, 'pool do banco de teste');
  await aplicarMigracao019(pool);
  await aplicarMigracao019(pool); // rodar duas vezes não pode dar erro
  const perfil = criarPerfilSaudacao(() => pool);
  const sufixo = randomBytes(3).toString('hex');
  const ids: string[] = [];
  for (const i of [0, 1]) {
    const r = await pool.query(`INSERT INTO fiscoia.users (email, password_hash, display_name) VALUES ($1,'x',$2) RETURNING id`, [`saud${i}.${sufixo}@teste.com`, `Saud ${i}`]);
    ids.push(String(r.rows[0].id));
  }
  try {
    assert.deepEqual(await perfil.lerPerfil(ids[0]), { nome: null, saudadoHoje: false, disponivel: true });
    assert.equal(await perfil.gravarNome(ids[0], 'Herbert'), true);
    assert.deepEqual(await perfil.lerPerfil(ids[0]), { nome: 'Herbert', saudadoHoje: false, disponivel: true });
    assert.equal(await perfil.marcarSaudadoHoje(ids[0]), true);
    assert.deepEqual(await perfil.lerPerfil(ids[0]), { nome: 'Herbert', saudadoHoje: true, disponivel: true });
    // O outro usuário não é afetado: cada pessoa tem o seu nome e a sua saudação.
    assert.deepEqual(await perfil.lerPerfil(ids[1]), { nome: null, saudadoHoje: false, disponivel: true });
    await perfil.gravarNome(ids[1], 'Aldair');
    assert.equal((await perfil.lerPerfil(ids[0])).nome, 'Herbert');
    assert.equal((await perfil.lerPerfil(ids[1])).nome, 'Aldair');
    // Dia seguinte: a saudação volta a valer.
    await pool.query(`UPDATE fiscoia.users SET ultima_saudacao = (current_date - 1) WHERE id=$1`, [ids[0]]);
    assert.equal((await perfil.lerPerfil(ids[0])).saudadoHoje, false);
    // Usuário que não existe: não grava nada e não quebra.
    assert.equal(await perfil.gravarNome(randomUUID(), 'Ninguém'), false);
    assert.equal((await perfil.lerPerfil(randomUUID())).disponivel, false);
  } finally {
    await pool.query('DELETE FROM fiscoia.users WHERE id = ANY($1::uuid[])', [ids]).catch(() => undefined);
    await pool.end().catch(() => undefined);
  }
});

test('Fisco IA: sem a migração 019 (ou sem banco) nada quebra: não saúda e não grava', { skip: !urlBanco, timeout: 60_000 }, async () => {
  const { criarPerfilSaudacao } = await import('./agentePerfil');
  // Sem banco configurado.
  const semBanco = criarPerfilSaudacao(() => null);
  assert.deepEqual(await semBanco.lerPerfil(randomUUID()), { nome: null, saudadoHoje: false, disponivel: false });
  assert.equal(await semBanco.gravarNome(randomUUID(), 'Herbert'), false);
  assert.equal(await semBanco.marcarSaudadoHoje(randomUUID()), false);

  // Banco descartável com a tabela de usuários como era antes da 019.
  const nome = `fisseg_sem019_${randomBytes(3).toString('hex')}`;
  const admin = new Pool({ connectionString: urlBanco });
  let pool: Pool | undefined;
  try {
    await admin.query(`CREATE DATABASE ${nome}`);
    const u = new URL(urlBanco!); u.pathname = `/${nome}`;
    pool = new Pool({ connectionString: u.toString() });
    await pool.query(`CREATE SCHEMA fiscoia; CREATE TABLE fiscoia.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, password_hash text NOT NULL, display_name text NOT NULL)`);
    const id = String((await pool.query(`INSERT INTO fiscoia.users (email, password_hash, display_name) VALUES ('a@teste.com','x','A') RETURNING id`)).rows[0].id);
    const perfil = criarPerfilSaudacao(() => pool!);
    assert.deepEqual(await perfil.lerPerfil(id), { nome: null, saudadoHoje: false, disponivel: false });
    assert.equal(await perfil.gravarNome(id, 'Herbert'), false);
    assert.equal(await perfil.marcarSaudadoHoje(id), false);
    // O usuário continua intacto (nada foi gravado nem alterado).
    assert.deepEqual((await pool.query('SELECT email, display_name FROM fiscoia.users WHERE id=$1', [id])).rows[0], { email: 'a@teste.com', display_name: 'A' });
    // Pool com erro de conexão também não lança.
    const quebrado = new Pool({ connectionString: 'postgresql://claude@127.0.0.1:1/nada', connectionTimeoutMillis: 500 });
    quebrado.on('error', () => undefined);
    const comErro = criarPerfilSaudacao(() => quebrado);
    assert.equal((await comErro.lerPerfil(id)).disponivel, false);
    assert.equal(await comErro.gravarNome(id, 'Herbert'), false);
    await quebrado.end().catch(() => undefined);
  } finally {
    await pool?.end().catch(() => undefined);
    await admin.query(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`).catch(() => undefined);
    await admin.end().catch(() => undefined);
  }
});
