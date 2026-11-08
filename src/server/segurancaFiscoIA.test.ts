// Teste de ponta a ponta do login seguro do Fisco IA: roda com um PostgreSQL de teste (DATABASE_URL) com as migrações 001 a 018 aplicadas.
// Sem DATABASE_URL, o teste é pulado.
import assert from 'node:assert/strict';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';

const TEM_BANCO = Boolean(process.env.DATABASE_URL);
process.env.FISCOIA_DATA_ENCRYPTION_KEY = process.env.FISCOIA_DATA_ENCRYPTION_KEY || randomBytes(32).toString('base64');
delete process.env.MURADE_2FA_OBRIGATORIO_DONO;

const SENHA = 'Senha-Forte-123';
const hashSenha = (senha: string) => { const sal = randomBytes(16); return `pbkdf2-sha256$210000$${sal.toString('hex')}$${pbkdf2Sync(senha, sal, 210_000, 32, 'sha256').toString('hex')}`; };

test('login seguro do Fisco IA (banco real)', { skip: !TEM_BANCO, timeout: 120_000 }, async (t) => {
  const { obterPoolBanco } = await import('./persistence');
  const auth = await import('./auth.routes');
  const seg = await import('./segurancaFiscoIA');
  const mod = await import('./segurancaLogin');
  const pool = obterPoolBanco()!;
  assert.ok(pool, 'pool do banco de teste');

  const sufixo = randomBytes(3).toString('hex');
  const email = (nome: string) => `${nome}.${sufixo}@teste.com`;
  const criar = async (nome: string, admin: boolean) => {
    const r = await pool.query(
      `INSERT INTO fiscoia.users (email, password_hash, display_name, active, plan_id, plan_name, must_change_password, is_admin, account_type)
       VALUES ($1, $2, $3, true, 'empresarial', 'Empresarial', false, $4, $5) RETURNING id`,
      [email(nome), hashSenha(SENHA), nome, admin, admin ? 'ADMIN' : 'CONTADOR']);
    return String(r.rows[0].id);
  };
  const donoId = await criar('dono', true);
  const funcId = await criar('func', false);
  const respId = await criar('resp', false);
  const membroId = await criar('membro', false);
  const tenant = await pool.query('INSERT INTO fiscoia.tenants (name) VALUES ($1) RETURNING id', [`Escritório ${sufixo}`]);
  await pool.query("INSERT INTO fiscoia.tenant_memberships (tenant_id, user_id, role) VALUES ($1,$2,'OWNER'),($1,$3,'CONTADOR')", [tenant.rows[0].id, respId, membroId]);

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api', seg.criarBarreiraDoDono(async (req) => { const u = await auth.obterUsuarioDaSessao(req); return u ? { id: u.id, ehAdmin: u.ehAdmin === true } : null; }));
  app.use('/api/auth', auth.default);
  app.get('/api/qualquer', (_req, res) => res.json({ ok: true }));
  const servidor = await new Promise<import('node:http').Server>((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(async () => {
    servidor.close();
    await pool.query('DELETE FROM fiscoia.users WHERE id = ANY($1::uuid[])', [[donoId, funcId, respId, membroId]]).catch(() => undefined);
    await pool.query('DELETE FROM fiscoia.tenants WHERE id = $1', [tenant.rows[0].id]).catch(() => undefined);
    await pool.query("DELETE FROM fiscoia.seg_2fa WHERE user_id = ANY($1::text[])", [[donoId, funcId, respId, membroId]]).catch(() => undefined);
    await pool.end().catch(() => undefined);
  });
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

  type Jarra = Map<string, string>;
  const chamar = async (jarra: Jarra, metodo: string, caminho: string, corpo?: unknown, ip = '10.0.0.1') => {
    const cookie = [...jarra].map(([k, v]) => `${k}=${v}`).join('; ');
    const r = await fetch(base + caminho, { method: metodo, headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...(cookie ? { cookie } : {}) }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    for (const linha of r.headers.getSetCookie()) { const [par] = linha.split(';'); const i = par.indexOf('='); const nome = par.slice(0, i); const valor = par.slice(i + 1); if (/Max-Age=0/i.test(linha) || valor === '') jarra.delete(nome); else jarra.set(nome, valor); }
    return { status: r.status, dados: await r.json().catch(() => ({})) as any };
  };
  const entrar = (jarra: Jarra, nome: string, extra: Record<string, unknown> = {}, senha = SENHA, ip = '10.0.0.1') => chamar(jarra, 'POST', '/api/auth/login', { email: email(nome), senha, ...extra }, ip);
  const limparFalhas = () => pool.query('DELETE FROM fiscoia.seg_login_falhas');
  const codigoAgora = (segredo: string, deslocamento = 0) => mod.codigoTotp(segredo, mod.passoDoInstante() + deslocamento);

  await limparFalhas();

  await t.test('funcionário comum entra só com a senha e não é barrado', async () => {
    const j: Jarra = new Map();
    const r = await entrar(j, 'func');
    assert.equal(r.status, 200);
    assert.equal(r.dados.doisFatoresDisponivel, true);
    assert.equal(r.dados.doisFatores, false);
    assert.equal(r.dados.precisaAtivar2fa, false);
    assert.equal((await chamar(j, 'GET', '/api/qualquer')).status, 200);
  });

  const jDono: Jarra = new Map();
  let segredoDono = '';
  let emergenciaDono: string[] = [];
  await t.test('dono sem código: só consegue ligar o código; o resto responde 403', async () => {
    const r = await entrar(jDono, 'dono');
    assert.equal(r.status, 200);
    assert.equal(r.dados.precisaAtivar2fa, true);
    const bloqueado = await chamar(jDono, 'GET', '/api/qualquer');
    assert.equal(bloqueado.status, 403);
    assert.equal(bloqueado.dados.precisaAtivar2fa, true);
    assert.equal((await chamar(jDono, 'GET', '/api/auth/session')).status, 200);
    const estado = await chamar(jDono, 'GET', '/api/auth/2fa');
    assert.equal(estado.dados.obrigatorio, true);
    assert.equal(estado.dados.ativo, false);
    const ini = await chamar(jDono, 'POST', '/api/auth/2fa/iniciar', {});
    assert.equal(ini.status, 200);
    assert.match(ini.dados.qr, /^data:image\/png;base64,/);
    segredoDono = ini.dados.segredo;
    const errado = await chamar(jDono, 'POST', '/api/auth/2fa/ativar', { codigo: '000000' });
    assert.equal(errado.status, 400);
    const certo = await chamar(jDono, 'POST', '/api/auth/2fa/ativar', { codigo: codigoAgora(segredoDono) });
    assert.equal(certo.status, 200);
    emergenciaDono = certo.dados.codigosEmergencia;
    assert.equal(emergenciaDono.length, 8);
    assert.equal((await chamar(jDono, 'GET', '/api/qualquer')).status, 200);
    assert.ok(jDono.has(mod.NOME_COOKIE_APARELHO), 'aparelho confiável gravado');
  });

  await t.test('dono não consegue desligar o código', async () => {
    const r = await chamar(jDono, 'POST', '/api/auth/2fa/desativar', { senha: SENHA, codigo: codigoAgora(segredoDono, 1) });
    assert.equal(r.status, 409);
  });

  await t.test('novo aparelho do dono: pede o código, recusa errado e repetido, aceita o novo', async () => {
    const j: Jarra = new Map();
    const semCodigo = await entrar(j, 'dono');
    assert.equal(semCodigo.status, 401);
    assert.equal(semCodigo.dados.precisaCodigo, true);
    assert.equal(j.has('fiscoia_session'), false);
    const errado = await entrar(j, 'dono', { codigo: '123456' });
    assert.equal(errado.status, 401);
    assert.equal(errado.dados.precisaCodigo, true);
    const repetido = await entrar(j, 'dono', { codigo: codigoAgora(segredoDono) }); // o passo atual já foi usado na ativação
    assert.equal(repetido.status, 401);
    const bom = await entrar(j, 'dono', { codigo: codigoAgora(segredoDono, 1), confiarAparelho: true });
    assert.equal(bom.status, 200);
    assert.equal(bom.dados.precisaAtivar2fa, false);
    assert.ok(j.has('fiscoia_session') && j.has(mod.NOME_COOKIE_APARELHO));
    // aparelho confiável: entra de novo só com a senha
    const j2: Jarra = new Map([[mod.NOME_COOKIE_APARELHO, j.get(mod.NOME_COOKIE_APARELHO)!]]);
    assert.equal((await entrar(j2, 'dono')).status, 200);
    // o mesmo código não vale de novo em aparelho desconhecido
    const j3: Jarra = new Map();
    assert.equal((await entrar(j3, 'dono', { codigo: codigoAgora(segredoDono, 1) })).status, 401);
  });

  await t.test('código de emergência vale uma vez só', async () => {
    const j: Jarra = new Map();
    const um = await entrar(j, 'dono', { codigo: emergenciaDono[0] });
    assert.equal(um.status, 200);
    const j2: Jarra = new Map();
    assert.equal((await entrar(j2, 'dono', { codigo: emergenciaDono[0] })).status, 401);
  });

  await t.test('bloqueio de tentativas fica no banco (por aparelho e por usuário)', async () => {
    await limparFalhas();
    const j: Jarra = new Map();
    let ultimo = 0;
    for (let i = 0; i < 8; i += 1) ultimo = (await entrar(j, 'func', {}, 'errada', '10.9.9.9')).status;
    assert.equal(ultimo, 429, 'a 8ª tentativa errada já bloqueia');
    assert.equal((await entrar(j, 'func', {}, SENHA, '10.9.9.9')).status, 429, 'mesmo com a senha certa, bloqueado');
    assert.equal((await entrar(new Map(), 'func', {}, SENHA, '10.8.8.8')).status, 200, 'outro aparelho, mesmo usuário, ainda entra (limite do usuário é 20)');
    const linhas = await pool.query("SELECT chave, tentativas FROM fiscoia.seg_login_falhas WHERE chave LIKE 'ip:10.9.9.9'");
    assert.equal(Number(linhas.rows[0]?.tentativas), 8);
    const eventos = await pool.query("SELECT tipo, login, ip FROM fiscoia.seg_eventos_seguranca WHERE tipo='login_bloqueado' ORDER BY id DESC LIMIT 1");
    assert.ok(eventos.rows[0]);
    assert.ok(!String(eventos.rows[0].login).includes('func.'), 'login mascarado no registro');
    await limparFalhas();
  });

  await t.test('funcionário liga e desliga o próprio código', async () => {
    const j: Jarra = new Map();
    await entrar(j, 'func');
    const ini = await chamar(j, 'POST', '/api/auth/2fa/iniciar', {});
    assert.equal((await chamar(j, 'POST', '/api/auth/2fa/ativar', { codigo: codigoAgora(ini.dados.segredo) })).status, 200);
    assert.equal((await chamar(j, 'GET', '/api/auth/2fa')).dados.ativo, true);
    assert.equal((await chamar(j, 'POST', '/api/auth/2fa/desativar', { senha: 'errada', codigo: codigoAgora(ini.dados.segredo, 1) })).status, 400);
    assert.equal((await chamar(j, 'POST', '/api/auth/2fa/desativar', { senha: SENHA, codigo: codigoAgora(ini.dados.segredo, 1) })).status, 200);
    assert.equal((await chamar(j, 'GET', '/api/auth/2fa')).dados.ativo, false);
    await limparFalhas();
  });

  await t.test('redefinir código: dono redefine qualquer um; responsável só a própria equipe', async () => {
    // membro e func ligam o código
    const ligar = async (nome: string) => { const j: Jarra = new Map(); await entrar(j, nome); const ini = await chamar(j, 'POST', '/api/auth/2fa/iniciar', {}); await chamar(j, 'POST', '/api/auth/2fa/ativar', { codigo: codigoAgora(ini.dados.segredo) }); return j; };
    const jMembro = await ligar('membro');
    await ligar('func');
    const jResp: Jarra = new Map(); await entrar(jResp, 'resp');
    const jPlano: Jarra = new Map(); await entrar(jPlano, 'func', { codigo: '1' }).catch(() => undefined);
    // quem não é responsável nem dono não redefine ninguém
    assert.equal((await chamar(jMembro, 'POST', '/api/auth/2fa/redefinir', { email: email('func') })).status, 403);
    // responsável não redefine fora da equipe
    assert.equal((await chamar(jResp, 'POST', '/api/auth/2fa/redefinir', { email: email('func') })).status, 403);
    // responsável redefine alguém da equipe: código some e a sessão do membro cai
    assert.equal((await chamar(jResp, 'POST', '/api/auth/2fa/redefinir', { email: email('membro') })).status, 200);
    assert.equal((await chamar(jMembro, 'GET', '/api/auth/session')).status, 401);
    assert.equal((await entrar(new Map(), 'membro')).status, 200, 'entra só com a senha depois de redefinido');
    // dono redefine qualquer um
    assert.equal((await chamar(jDono, 'POST', '/api/auth/2fa/redefinir', { email: email('func') })).status, 200);
    assert.equal((await entrar(new Map(), 'func')).status, 200);
    await limparFalhas();
  });

  await t.test('resumo de segurança: só o dono vê', async () => {
    const jf: Jarra = new Map(); await entrar(jf, 'func');
    assert.equal((await chamar(jf, 'GET', '/api/auth/2fa/resumo')).status, 403);
    const r = await chamar(jDono, 'GET', '/api/auth/2fa/resumo');
    assert.equal(r.status, 200);
    assert.equal(r.dados.disponivel, true);
    assert.equal(typeof r.dados.texto, 'string');
    assert.equal(Array.isArray(r.dados.donosSemCodigo), true);
  });

  await t.test('sem as tabelas novas (migração 018 ainda não rodou): login segue como antes e ninguém é barrado', async () => {
    await pool.query('ALTER TABLE fiscoia.seg_login_falhas RENAME TO seg_login_falhas_off');
    try {
      seg.reiniciarConferenciaSeguranca();
      const j: Jarra = new Map();
      const r = await entrar(j, 'func');
      assert.equal(r.status, 200);
      assert.equal(r.dados.doisFatoresDisponivel, false);
      const dono: Jarra = new Map();
      // o dono já tem código, então entra pelo aparelho confiável; o que importa é a barreira não derrubar nada
      assert.equal((await entrar(dono, 'dono', { codigo: emergenciaDono[1] })).status, 200);
      assert.equal((await chamar(dono, 'GET', '/api/qualquer')).status, 200);
      assert.equal((await chamar(j, 'GET', '/api/auth/2fa')).dados.disponivel, false);
      assert.equal((await chamar(j, 'POST', '/api/auth/2fa/iniciar', {})).status, 503);
    } finally {
      await pool.query('ALTER TABLE fiscoia.seg_login_falhas_off RENAME TO seg_login_falhas');
      seg.reiniciarConferenciaSeguranca();
    }
  });

  await t.test('MURADE_2FA_OBRIGATORIO_DONO=nao desliga a exigência', async () => {
    const j: Jarra = new Map();
    await entrar(j, 'func'); // aquece
    await pool.query('DELETE FROM fiscoia.seg_2fa WHERE user_id = $1', [donoId]);
    seg.esquecerAtivoEmMemoria(donoId);
    await pool.query('DELETE FROM fiscoia.seg_dispositivos_confiaveis WHERE user_id = $1', [donoId]);
    process.env.MURADE_2FA_OBRIGATORIO_DONO = 'nao';
    try {
      const d: Jarra = new Map();
      const r = await entrar(d, 'dono');
      assert.equal(r.status, 200);
      assert.equal(r.dados.precisaAtivar2fa, false);
      assert.equal((await chamar(d, 'GET', '/api/qualquer')).status, 200);
    } finally { delete process.env.MURADE_2FA_OBRIGATORIO_DONO; }
    const d2: Jarra = new Map(); await entrar(d2, 'dono');
    assert.equal((await chamar(d2, 'GET', '/api/qualquer')).status, 403, 'com a exigência de volta, o dono sem código é barrado');
  });
});
