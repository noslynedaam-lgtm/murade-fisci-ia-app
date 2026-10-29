import assert from 'node:assert/strict';
import test from 'node:test';
import { duracaoSessao, ehCelularUA } from './auth.routes';

const req = (ua: string, cookie = '') => ({ header: (n: string) => (n.toLowerCase() === 'user-agent' ? ua : n.toLowerCase() === 'cookie' ? cookie : undefined), headers: { 'user-agent': ua, cookie } }) as never;
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36';
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0';

test('celular: senha só na primeira vez (90 dias)', () => {
  assert.equal(duracaoSessao(req(IPHONE)), 90 * 24 * 3600);
  assert.equal(duracaoSessao(req(ANDROID)), 90 * 24 * 3600);
});
test('computador continua com 8 horas', () => {
  assert.equal(duracaoSessao(req(PC)), 8 * 3600);
  assert.equal(ehCelularUA(PC), false);
});
test('celular com "pedir senha ao abrir" ligado volta a 8 horas', () => {
  assert.equal(duracaoSessao(req(IPHONE, 'a=b; murade_exigir_senha=1')), 8 * 3600);
  assert.equal(duracaoSessao(req(IPHONE, 'murade_exigir_senha=1; a=b')), 8 * 3600);
  assert.equal(duracaoSessao(req(IPHONE, 'xmurade_exigir_senha=1')), 90 * 24 * 3600);
});
