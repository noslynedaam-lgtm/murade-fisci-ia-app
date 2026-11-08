import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  base32Codificar, base32Decodificar, cifrarSegredo, codigoTotp, decifrarSegredo, gerarCodigosEmergencia, gerarSegredoTotp, hashCodigoEmergencia,
  lerChaveMestra, lerCookie, mascararIp, mascararLogin, mensagemDoResumo, uriOtpauth, verificarTotp, cookieAparelho,
} from './segurancaLogin';

// Segredo "12345678901234567890" (ASCII) dos exemplos oficiais da RFC 6238 (SHA-1); com 6 dígitos são os 6 últimos dos valores de 8.
const SEGREDO_RFC = base32Codificar(Buffer.from('12345678901234567890'));

test('TOTP: bate com os valores oficiais da RFC 6238', () => {
  const casos: Array<[number, string]> = [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130']];
  for (const [segundos, esperado] of casos) assert.equal(codigoTotp(SEGREDO_RFC, Math.floor(segundos / 30)), esperado, `t=${segundos}`);
});

test('base32: vai e volta, ignora espaços e minúsculas, recusa letra inválida', () => {
  for (let n = 1; n < 40; n++) { const dados = crypto.randomBytes(n); assert.deepEqual(base32Decodificar(base32Codificar(dados)), dados); }
  assert.equal(base32Codificar(Buffer.from('foobar')), 'MZXW6YTBOI');
  assert.deepEqual(base32Decodificar('mzxw 6ytb-oi'), Buffer.from('foobar'));
  assert.throws(() => base32Decodificar('MZXW1'), /inválido/i);
  assert.match(gerarSegredoTotp(), /^[A-Z2-7]{32}$/);
});

test('verificação: aceita o passo certo e um vizinho, recusa distante, recusa formato errado e repetição', () => {
  const agora = 1_700_000_000_000;
  const passo = Math.floor(agora / 30000);
  const ok = verificarTotp(SEGREDO_RFC, codigoTotp(SEGREDO_RFC, passo), agora);
  assert.deepEqual(ok, { ok: true, passo });
  assert.equal(verificarTotp(SEGREDO_RFC, codigoTotp(SEGREDO_RFC, passo - 1), agora).ok, true, 'relógio um pouco atrasado');
  assert.equal(verificarTotp(SEGREDO_RFC, codigoTotp(SEGREDO_RFC, passo + 1), agora).ok, true, 'relógio um pouco adiantado');
  assert.equal(verificarTotp(SEGREDO_RFC, codigoTotp(SEGREDO_RFC, passo + 3), agora).ok, false);
  assert.equal(verificarTotp(SEGREDO_RFC, codigoTotp(SEGREDO_RFC, passo - 3), agora).ok, false);
  assert.equal(verificarTotp(SEGREDO_RFC, '12345', agora).ok, false);
  assert.equal(verificarTotp(SEGREDO_RFC, 'abcdef', agora).ok, false);
  assert.equal(verificarTotp(SEGREDO_RFC, '', agora).ok, false);
  assert.equal(verificarTotp(SEGREDO_RFC, codigoTotp(SEGREDO_RFC, passo), agora, passo).ok, false, 'mesmo código não vale duas vezes');
  assert.equal(verificarTotp(SEGREDO_RFC, codigoTotp(SEGREDO_RFC, passo), agora, passo - 1).ok, true);
  const comEspaco = codigoTotp(SEGREDO_RFC, passo); assert.equal(verificarTotp(SEGREDO_RFC, `${comEspaco.slice(0, 3)} ${comEspaco.slice(3)}`, agora).ok, true);
});

test('uri do aplicativo: traz segredo, emissor, 6 dígitos e 30 s', () => {
  const uri = uriOtpauth('Murade Fiscal', 'maria@escritorio.com', 'ABCDEFGH');
  assert.match(uri, /^otpauth:\/\/totp\/Murade%20Fiscal%3Amaria%40escritorio\.com\?secret=ABCDEFGH&issuer=Murade%20Fiscal&algorithm=SHA1&digits=6&period=30$/);
});

test('segredo cifrado: volta igual, só abre com a mesma chave e o mesmo usuário, e adulteração é detectada', () => {
  const chave = crypto.randomBytes(32); const outra = crypto.randomBytes(32);
  const guardado = cifrarSegredo(chave, 'u1', 'ABCDEFGHIJKLMNOP');
  assert.equal(decifrarSegredo(chave, 'u1', guardado), 'ABCDEFGHIJKLMNOP');
  assert.ok(!guardado.includes('ABCDEFGH'), 'o segredo não aparece em claro');
  assert.throws(() => decifrarSegredo(outra, 'u1', guardado));
  assert.throws(() => decifrarSegredo(chave, 'u2', guardado), 'segredo de um usuário não abre para outro');
  const partes = guardado.split('.'); partes[3] = Buffer.from('x'.repeat(16)).toString('base64url');
  assert.throws(() => decifrarSegredo(chave, 'u1', partes.join('.')));
  assert.throws(() => decifrarSegredo(chave, 'u1', 'lixo'), /formato/i);
  assert.notEqual(cifrarSegredo(chave, 'u1', 'ABC'), cifrarSegredo(chave, 'u1', 'ABC'), 'cada gravação usa vetor novo');
});

test('chave-mestra: aceita hex ou base64 de 32 bytes e recusa o resto', () => {
  const bruta = crypto.randomBytes(32);
  assert.deepEqual(lerChaveMestra(bruta.toString('hex')), bruta);
  assert.deepEqual(lerChaveMestra(bruta.toString('base64')), bruta);
  assert.equal(lerChaveMestra('curta'), null);
  assert.equal(lerChaveMestra(''), null);
  assert.equal(lerChaveMestra(undefined), null);
});

test('códigos de emergência: 8 diferentes, formato xxxxx-xxxxx, hash estável e sem confundir maiúscula/hífen', () => {
  const codigos = gerarCodigosEmergencia();
  assert.equal(codigos.length, 8); assert.equal(new Set(codigos).size, 8);
  for (const c of codigos) assert.match(c, /^[a-z2-9]{5}-[a-z2-9]{5}$/);
  assert.equal(hashCodigoEmergencia(codigos[0]), hashCodigoEmergencia(codigos[0].toUpperCase().replace('-', ' ')));
  assert.notEqual(hashCodigoEmergencia(codigos[0]), hashCodigoEmergencia(codigos[1]));
});

test('máscaras: e-mail e IP nunca aparecem inteiros', () => {
  assert.equal(mascararLogin('Maria.Silva@escritorio.com'), 'ma***@escritorio.com');
  assert.equal(mascararLogin('beny'), 'be***');
  assert.equal(mascararLogin(''), '(vazio)');
  assert.equal(mascararIp('200.150.10.77'), '200.150.10.*');
  assert.equal(mascararIp('2804:14d:1:2:3:4:5:6'), '2804:14d:1::*');
  assert.equal(mascararIp(''), 'desconhecido');
});

test('cookie do aparelho: lê o cookie certo e grava com HttpOnly/SameSite (e Secure em produção)', () => {
  assert.equal(lerCookie('a=1; murade_aparelho=abc%2Fdef; b=2', 'murade_aparelho'), 'abc/def');
  assert.equal(lerCookie('a=1', 'murade_aparelho'), null);
  assert.equal(lerCookie(undefined, 'x'), null);
  assert.match(cookieAparelho('tok', true), /HttpOnly; SameSite=Lax; Secure$/);
  assert.doesNotMatch(cookieAparelho('tok', false), /Secure/);
});

test('resumo: avisa admin sem código, bloqueios e muitas falhas; fora isso, tudo em ordem', () => {
  const base = { dias: 1, senhasErradas: 2, codigosErrados: 0, bloqueios: 0, contasComCodigo: 3, emergenciaUsada: 0 };
  assert.equal(mensagemDoResumo(base, []).alerta, false);
  assert.match(mensagemDoResumo(base, []).texto, /^Tudo em ordem/);
  const a = mensagemDoResumo({ ...base, bloqueios: 2 }, ['dono@x.com']);
  assert.equal(a.alerta, true); assert.match(a.texto, /do\*\*\*@x\.com/); assert.match(a.texto, /2 bloqueio/);
  assert.equal(mensagemDoResumo({ ...base, senhasErradas: 40 }, []).alerta, true);
  assert.equal(mensagemDoResumo({ ...base, emergenciaUsada: 1 }, []).alerta, true);
});

const urlBanco = process.env.TEST_DATABASE_URL;

test('banco: bloqueio por aparelho e por usuário, guardado no banco e liberado ao vencer', { skip: !urlBanco }, async () => {
  const { Pool } = await import('pg');
  const m = await import('./segurancaLogin');
  const pool = new Pool({ connectionString: urlBanco });
  const q = (s: string, p?: unknown[]) => pool.query(s, p as any);
  const p = `t_${crypto.randomBytes(3).toString('hex')}`;
  try {
    await m.prepararSeguranca(q, p);
    await m.prepararSeguranca(q, p); // repetir não quebra
    assert.equal(await m.estaBloqueado(q, p, '1.1.1.1', 'ana'), false);
    for (let i = 1; i <= 7; i++) assert.equal(await m.registrarFalha(q, p, '1.1.1.1', 'ana'), false, `falha ${i}`);
    assert.equal(await m.registrarFalha(q, p, '1.1.1.1', 'ana'), true, '8ª falha do mesmo aparelho bloqueia');
    assert.equal(await m.estaBloqueado(q, p, '1.1.1.1', 'bia'), true, 'o aparelho bloqueado não tenta outra conta');
    assert.equal(await m.estaBloqueado(q, p, '2.2.2.2', 'bia'), false, 'outro aparelho, outra conta: livre');
    assert.equal(await m.estaBloqueado(q, p, '2.2.2.2', 'ana'), false, 'a conta ainda não passou do limite dela');
    // ataque vindo de muitos aparelhos contra a mesma conta
    for (let i = 0; i < 19; i++) await m.registrarFalha(q, p, `9.9.9.${i}`, 'caio');
    assert.equal(await m.estaBloqueado(q, p, '8.8.8.8', 'caio'), false, '19 falhas ainda não bloqueiam a conta');
    await m.registrarFalha(q, p, '9.9.9.200', 'caio');
    assert.equal(await m.estaBloqueado(q, p, '8.8.8.8', 'caio'), true, 'a 20ª bloqueia a conta, de qualquer aparelho');
    // sobrevive a "reinício": nada está na memória do processo, tudo na tabela
    const salvo = await q(`SELECT count(*)::int AS n FROM ${p}_login_falhas`);
    assert.ok(salvo.rows[0].n >= 3);
    // vence a janela → libera
    await q(`UPDATE ${p}_login_falhas SET ate = now() - interval '1 minute'`);
    assert.equal(await m.estaBloqueado(q, p, '1.1.1.1', 'ana'), false);
    assert.equal(await m.registrarFalha(q, p, '1.1.1.1', 'ana'), false, 'contagem recomeça do 1 depois que a janela venceu');
    // login certo limpa só o aparelho
    await m.registrarFalha(q, p, '3.3.3.3', 'dani');
    await m.limparFalhasDoAparelho(q, p, '3.3.3.3');
    const restou = await q(`SELECT chave FROM ${p}_login_falhas WHERE chave IN ('ip:3.3.3.3','usuario:dani')`);
    assert.deepEqual(restou.rows.map((r) => r.chave), ['usuario:dani']);
    // eventos gravados sem dado completo
    const ev = await q(`SELECT tipo, login, ip FROM ${p}_eventos_seguranca WHERE tipo='login_bloqueado' LIMIT 1`);
    assert.equal(ev.rows[0].login, 'an***'); assert.equal(ev.rows[0].ip, '1.1.1.*');
    const resumo = await m.resumirSeguranca(q, p, 1);
    assert.ok(resumo.bloqueios >= 1 && resumo.senhasErradas >= 20);
  } finally { await q(`DROP TABLE IF EXISTS ${p}_login_falhas, ${p}_eventos_seguranca, ${p}_2fa, ${p}_dispositivos_confiaveis`); await pool.end(); }
});

test('banco: ativar o código de segurança, entrar com ele, não repetir o mesmo, usar emergência uma vez, aparelho confiável', { skip: !urlBanco }, async () => {
  const { Pool } = await import('pg');
  const m = await import('./segurancaLogin');
  const pool = new Pool({ connectionString: urlBanco });
  const q = (s: string, p?: unknown[]) => pool.query(s, p as any);
  const p = `t_${crypto.randomBytes(3).toString('hex')}`;
  const chave = crypto.randomBytes(32);
  const agora = 1_800_000_000_000;
  try {
    await m.prepararSeguranca(q, p);
    assert.equal(await m.tem2faAtivo(q, p, 'u1'), false);
    const ini = await m.iniciarAtivacao2fa(q, p, chave, 'u1', 'ana@x.com', 'Murade Teste');
    assert.match(ini.uri, /^otpauth:\/\/totp\//);
    const guardado = (await q(`SELECT segredo_cifrado FROM ${p}_2fa WHERE user_id='u1'`)).rows[0].segredo_cifrado;
    assert.ok(!guardado.includes(ini.segredo), 'segredo guardado cifrado');
    assert.equal((await m.concluirAtivacao2fa(q, p, chave, 'u1', '000000', agora)).ok, false, 'código errado não ativa');
    assert.equal(await m.tem2faAtivo(q, p, 'u1'), false);
    const passo = Math.floor(agora / 30000);
    const ativ = await m.concluirAtivacao2fa(q, p, chave, 'u1', codigoTotp(ini.segredo, passo), agora);
    assert.equal(ativ.ok, true);
    if (!ativ.ok) return;
    assert.equal(ativ.codigosEmergencia.length, 8);
    assert.equal(await m.tem2faAtivo(q, p, 'u1'), true);
    const bruto = JSON.stringify((await q(`SELECT * FROM ${p}_2fa`)).rows);
    for (const c of ativ.codigosEmergencia) assert.ok(!bruto.includes(c), 'códigos de emergência guardados só como hash');
    await assert.rejects(() => m.iniciarAtivacao2fa(q, p, chave, 'u1', 'ana@x.com', 'X'), /já está ativo/);
    assert.equal((await m.concluirAtivacao2fa(q, p, chave, 'u1', codigoTotp(ini.segredo, passo + 1), agora)).ok, false, 'já ativo: não ativa de novo');
    // login: o mesmo código da ativação não vale de novo; o do passo seguinte vale uma vez
    assert.equal((await m.verificarSegundoFator(q, p, chave, 'u1', codigoTotp(ini.segredo, passo), agora)).ok, false, 'código já usado na ativação');
    const prox = codigoTotp(ini.segredo, passo + 1);
    assert.deepEqual(await m.verificarSegundoFator(q, p, chave, 'u1', prox, agora), { ok: true, via: 'celular' });
    assert.equal((await m.verificarSegundoFator(q, p, chave, 'u1', prox, agora)).ok, false, 'não repete');
    assert.equal((await m.verificarSegundoFator(q, p, chave, 'u2', prox, agora)).ok, false, 'outro usuário sem código ativo');
    // dois acertos ao mesmo tempo: só um passa
    const c2 = codigoTotp(ini.segredo, passo + 2);
    const par = await Promise.all([m.verificarSegundoFator(q, p, chave, 'u1', c2, agora + 60000), m.verificarSegundoFator(q, p, chave, 'u1', c2, agora + 60000)]);
    assert.equal(par.filter((r) => r.ok).length, 1, 'corrida: só uma tentativa vence');
    // emergência: vale uma vez
    const em = ativ.codigosEmergencia[3];
    assert.deepEqual(await m.verificarSegundoFator(q, p, chave, 'u1', em.toUpperCase(), agora), { ok: true, via: 'emergencia' });
    assert.equal((await m.verificarSegundoFator(q, p, chave, 'u1', em, agora)).ok, false, 'emergência gasta');
    assert.equal((await m.verificarSegundoFator(q, p, chave, 'u1', 'aaaaa-bbbbb', agora)).ok, false);
    assert.equal((await m.ler2fa(q, p, 'u1'))?.emergenciaRestantes, 7);
    // aparelho confiável
    const token = await m.criarAparelhoConfiavel(q, p, 'u1');
    assert.equal(await m.aparelhoConfiavel(q, p, 'u1', token), true);
    assert.equal(await m.aparelhoConfiavel(q, p, 'u2', token), false, 'aparelho é de um usuário só');
    assert.equal(await m.aparelhoConfiavel(q, p, 'u1', 'x'.repeat(30)), false);
    assert.equal(await m.aparelhoConfiavel(q, p, 'u1', null), false);
    await q(`UPDATE ${p}_dispositivos_confiaveis SET expira_em = now() - interval '1 second'`);
    assert.equal(await m.aparelhoConfiavel(q, p, 'u1', token), false, 'vencido não vale');
    const token2 = await m.criarAparelhoConfiavel(q, p, 'u1');
    // desativar apaga o segredo e os aparelhos
    await m.desativar2fa(q, p, 'u1');
    assert.equal(await m.tem2faAtivo(q, p, 'u1'), false);
    assert.equal(await m.aparelhoConfiavel(q, p, 'u1', token2), false, 'sem código ativo, aparelhos antigos são esquecidos');
  } finally { await q(`DROP TABLE IF EXISTS ${p}_login_falhas, ${p}_eventos_seguranca, ${p}_2fa, ${p}_dispositivos_confiaveis`); await pool.end(); }
});

test('banco: prefixo com schema próprio (schema.prefixo) cria as tabelas e a faxina remove o que venceu', { skip: !urlBanco }, async () => {
  const { Pool } = await import('pg');
  const m = await import('./segurancaLogin');
  const pool = new Pool({ connectionString: urlBanco });
  const q = (s: string, p?: unknown[]) => pool.query(s, p as any);
  const esquema = `sch_${crypto.randomBytes(3).toString('hex')}`; const p = `${esquema}.seg`;
  try {
    await q(`CREATE SCHEMA ${esquema}`);
    await m.prepararSeguranca(q, p);
    assert.equal((await q(`SELECT to_regclass('${p}_login_falhas') IS NOT NULL AS ok`)).rows[0].ok, true);
    await m.registrarFalha(q, p, '4.4.4.4', 'eva');
    assert.equal(await m.estaBloqueado(q, p, '4.4.4.4', 'eva'), false);
    await q(`INSERT INTO ${p}_login_falhas(chave, tentativas, ate) VALUES ('ip:velho', 3, now() - interval '3 days')`);
    await q(`INSERT INTO ${p}_eventos_seguranca(quando, tipo) VALUES (now() - interval '120 days', 'login_falhou')`);
    await m.limparSeguranca(q, p);
    assert.equal((await q(`SELECT count(*)::int AS n FROM ${p}_login_falhas WHERE chave='ip:velho'`)).rows[0].n, 0);
    assert.equal((await q(`SELECT count(*)::int AS n FROM ${p}_eventos_seguranca WHERE quando < now() - interval '100 days'`)).rows[0].n, 0);
    await assert.rejects(() => m.estaBloqueado(q, 'x;drop', 'a', 'b'), /Prefixo/);
  } finally { await q(`DROP SCHEMA IF EXISTS ${esquema} CASCADE`); await pool.end(); }
});
