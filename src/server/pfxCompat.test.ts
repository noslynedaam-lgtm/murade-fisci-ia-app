import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepararPfx } from './pfxCompat';

const dir = mkdtempSync(join(tmpdir(), 'pfx-'));
const sh = (...a: string[]) => execFileSync('openssl', a, { cwd: dir, stdio: 'pipe' });
sh('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'k.pem', '-out', 'c.pem', '-days', '2', '-subj', '/CN=t');
sh('pkcs12', '-export', '-legacy', '-inkey', 'k.pem', '-in', 'c.pem', '-out', 'legacy.pfx', '-passout', 'pass:Senha123');
sh('pkcs12', '-export', '-inkey', 'k.pem', '-in', 'c.pem', '-out', 'modern.pfx', '-passout', 'pass:Senha123');

test('PFX moderno passa direto', () => {
  const r = prepararPfx(readFileSync(join(dir, 'modern.pfx')), 'Senha123');
  assert.equal(r.ok && r.convertido, false);
});
test('PFX legado é convertido', () => {
  const r = prepararPfx(readFileSync(join(dir, 'legacy.pfx')), 'Senha123');
  assert.equal(r.ok && r.convertido, true);
});
test('senha errada é identificada', () => {
  const r = prepararPfx(readFileSync(join(dir, 'legacy.pfx')), 'errada');
  assert.deepEqual(r, { ok: false, motivo: 'senha' });
});
