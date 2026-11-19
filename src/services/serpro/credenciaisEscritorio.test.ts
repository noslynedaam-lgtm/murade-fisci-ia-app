import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { carregarCredencial, credencialExiste, credencialGlobal, decidirFonteCredencial, guardarCredencial, removerCredencial, validarEscritorioId, type Consulta } from './credenciaisEscritorio';

process.env.FISCOIA_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
const dir = mkdtempSync(join(tmpdir(), 'cred-'));
const sh = (...a: string[]) => execFileSync('openssl', a, { cwd: dir, stdio: 'pipe' });
sh('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'k.pem', '-out', 'c.pem', '-days', '2', '-subj', '/CN=t');
sh('pkcs12', '-export', '-inkey', 'k.pem', '-in', 'c.pem', '-out', 'm.pfx', '-passout', 'pass:Senha123');
const PFX = readFileSync(join(dir, 'm.pfx')).toString('base64');
const entrada = { consumerKey: 'KEY-SEGREDO-123456', consumerSecret: 'SECRET-SEGREDO-123456', contratanteCnpj: '11.222.333/0001-81', certPfxBase64: PFX, certSenha: 'Senha123' };

function bancoFalso(): { db: Consulta; linhas: Map<string, any> } {
  const linhas = new Map<string, any>();
  const db: Consulta = { query: async (sql, p = []) => {
    if (/^\s*CREATE TABLE/i.test(sql)) return { rows: [] };
    if (/^\s*INSERT INTO serpro_credenciais_escritorio/i.test(sql)) { linhas.set(String(p[0]), { contratante_cnpj: p[1], segredo: p[2], nonce: p[3], auth_tag: p[4], key_version: p[5] }); return { rows: [] }; }
    if (/^\s*DELETE/i.test(sql)) { const ex = linhas.delete(String(p[0])); return { rows: ex ? [{ escritorio_id: p[0] }] : [] }; }
    if (/SELECT 1 FROM/i.test(sql)) return { rows: linhas.has(String(p[0])) ? [{}] : [] };
    if (/SELECT segredo/i.test(sql)) return { rows: linhas.has(String(p[0])) ? [linhas.get(String(p[0]))] : [] };
    throw new Error(`SQL inesperado: ${sql}`);
  } };
  return { db, linhas };
}

test('Fonte da credencial: global só para o dono ou quando o DP conferiu; escritório sem credencial própria nunca monta pedido com a global', () => {
  assert.deepEqual(decidirFonteCredencial({ dono: true, viaPonte: true, propriaExiste: false }), { ok: true, fonte: 'global' });
  assert.deepEqual(decidirFonteCredencial({ dono: false, pedida: 'global', viaPonte: true, propriaExiste: false }), { ok: true, fonte: 'global' }); // teste/efetivo-dono, decidido pelo DP
  assert.equal(decidirFonteCredencial({ dono: false, pedida: 'global', viaPonte: false, propriaExiste: false }).ok, false, 'tela do Fisco IA não pode pedir a global');
  assert.equal(decidirFonteCredencial({ dono: false, pedida: 'propria', viaPonte: true, propriaExiste: false }).ok, false);
  assert.deepEqual(decidirFonteCredencial({ dono: false, pedida: 'propria', viaPonte: true, propriaExiste: true }), { ok: true, fonte: 'propria' });
  assert.equal(decidirFonteCredencial({ dono: false, viaPonte: true, propriaExiste: true }).ok, false, 'DP antigo (sem dizer a credencial) = recusado');
  assert.equal(decidirFonteCredencial({ dono: false, viaPonte: false, propriaExiste: false }).ok, false);
  assert.deepEqual(decidirFonteCredencial({ dono: false, viaPonte: false, propriaExiste: true }), { ok: true, fonte: 'propria' });
});

test('Credencial própria: guarda cifrada, só diz "existe", abre só no uso, remove; dado inválido não grava nada', async () => {
  const { db, linhas } = bancoFalso();
  assert.equal(await credencialExiste(db, 'esc-1'), false);
  assert.equal((await guardarCredencial(db, 'esc-1', { ...entrada, certSenha: 'errada' })).ok, false);
  assert.equal((await guardarCredencial(db, 'esc-1', { ...entrada, contratanteCnpj: '123' })).ok, false);
  assert.equal(linhas.size, 0);
  assert.equal((await guardarCredencial(db, 'esc-1', entrada)).ok, true);
  const bruto = JSON.stringify([...linhas.values()].map((l) => [l.segredo.toString('latin1'), l.nonce.toString('hex')]));
  for (const segredo of ['KEY-SEGREDO', 'SECRET-SEGREDO', 'Senha123', PFX.slice(0, 40)]) assert.equal(bruto.includes(segredo), false, 'nada em claro no banco');
  assert.equal(await credencialExiste(db, 'esc-1'), true);
  const c = await carregarCredencial(db, 'esc-1'); assert.equal(c?.origem, 'propria'); assert.equal(c?.contratanteCnpj, '11222333000181'); assert.equal(c?.consumerKey, 'KEY-SEGREDO-123456');
  assert.equal(await carregarCredencial(db, 'esc-2'), null, 'outro escritório não enxerga');
  // blob de um escritório não abre como de outro
  linhas.set('esc-3', linhas.get('esc-1')); assert.equal(await carregarCredencial(db, 'esc-3'), null);
  assert.equal(await removerCredencial(db, 'esc-1'), true); assert.equal(await credencialExiste(db, 'esc-1'), false);
  assert.equal(validarEscritorioId('a/b'), null); assert.equal(validarEscritorioId('esc-1'), 'esc-1');
});

test('Credencial global: só com tudo preenchido', () => {
  assert.equal(credencialGlobal({}), null);
  assert.equal(credencialGlobal({ SERPRO_PRODUCAO_CONSUMER_KEY: 'k', SERPRO_PRODUCAO_CONSUMER_SECRET: 's', SERPRO_CONTRATANTE_CNPJ: '1', SERPRO_CERT_PFX_BASE64: 'p', SERPRO_CERT_PFX_SENHA: 'x' })?.origem, 'global');
});

test('As rotas de consulta e transmissão não leem credencial do ambiente por fora do resolvedor', () => {
  const src = readFileSync('src/server/serpro.routes.ts', 'utf8');
  // o ambiente só aparece no diagnóstico do dono (status/teste de autenticação), nas chaves de ligar/desligar e no resolvedor via credencialGlobal
  const usos = src.split('\n').map((l, i) => [i + 1, l] as const).filter(([, l]) => /process\.env\.SERPRO_(PRODUCAO_CONSUMER|CERT_PFX|CONTRATANTE)/.test(l));
  assert.ok(usos.every(([n]) => n < 120), `uso de credencial global fora do diagnóstico: linhas ${usos.map(([n]) => n).join(', ')}`);
  assert.match(src, /decidirFonteCredencial/); assert.equal((src.match(/resolverCredencial\(/g) || []).length >= 3, true);
  // as rotas da ponte de credenciais nunca devolvem o conteúdo
  const rotas = src.slice(src.indexOf("router.post('/ponte/escritorio/credenciais'"));
  assert.equal(/res\.json\(\{[^}]*(consumerKey|consumerSecret|certSenha|certPfxBase64)/.test(rotas), false);
  assert.equal(/console\.(log|error)\([^)]*(consumerKey|consumerSecret|certSenha)/.test(src), false);
});

test('escritório liberado por inteiro pelo dono usa a credencial do dono quando não tem a própria; com a própria, usa a própria', () => {
  assert.deepEqual(decidirFonteCredencial({ dono: false, viaPonte: false, propriaExiste: false, liberadoPeloDono: true }), { ok: true, fonte: 'global' });
  assert.deepEqual(decidirFonteCredencial({ dono: false, viaPonte: false, propriaExiste: true, liberadoPeloDono: true }), { ok: true, fonte: 'propria' });
  const naoLiberado = decidirFonteCredencial({ dono: false, viaPonte: false, propriaExiste: false, liberadoPeloDono: false });
  assert.equal(naoLiberado.ok, false);
  const pediuPropria = decidirFonteCredencial({ dono: false, pedida: 'propria', viaPonte: true, propriaExiste: false, liberadoPeloDono: true });
  assert.equal(pediuPropria.ok, false);
});

test('consulta: escritório liberado por inteiro OU empresa liberada pelo dono entram como liberadoPeloDono', async () => {
  const { readFileSync } = await import('node:fs');
  const s = readFileSync('src/server/serpro.routes.ts', 'utf8');
  assert.match(s, /const liberadoPeloDono = e\.donoDoSistema === true \? false : \(await tenantLiberado\(tenantId\)\) \|\| \(await escritorioLiberado\(e\.escritorio\?\.nome\)\) \|\| \(await empresaLiberada\(companyId\)\) === true;/);
});
