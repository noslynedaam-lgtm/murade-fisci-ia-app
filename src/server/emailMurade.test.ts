import assert from 'node:assert/strict';
import test from 'node:test';
import { LIMITE_EMAIL_DIARIO_PADRAO, limiteDiarioEmail, mascararEmail, reservarEnvioEmail, type ContadorEmail } from './emailMurade';

test('e-mail: limite padrão de 300 por dia e o dono pode mudar', () => {
  assert.equal(limiteDiarioEmail({}), LIMITE_EMAIL_DIARIO_PADRAO);
  assert.equal(limiteDiarioEmail({ EMAIL_LIMITE_DIARIO: '50' } as never), 50);
  assert.equal(limiteDiarioEmail({ EMAIL_LIMITE_DIARIO: 'abc' } as never), LIMITE_EMAIL_DIARIO_PADRAO);
  assert.equal(limiteDiarioEmail({ EMAIL_LIMITE_DIARIO: '0' } as never), LIMITE_EMAIL_DIARIO_PADRAO);
  assert.equal(limiteDiarioEmail({ EMAIL_LIMITE_DIARIO: '-5' } as never), LIMITE_EMAIL_DIARIO_PADRAO);
});

test('e-mail: para de enviar ao atingir o limite e não conta a tentativa recusada', () => {
  const c: ContadorEmail = { dia: '', tentativas: 0 };
  const agora = new Date('2026-11-07T15:00:00Z');
  assert.deepEqual(reservarEnvioEmail(c, agora, 2), { ok: true, numero: 1 });
  assert.deepEqual(reservarEnvioEmail(c, agora, 2), { ok: true, numero: 2 });
  assert.deepEqual(reservarEnvioEmail(c, agora, 2), { ok: false });
  assert.deepEqual(reservarEnvioEmail(c, agora, 2), { ok: false });
  assert.equal(c.tentativas, 2);
});

test('e-mail: a contagem zera na virada do dia em Brasília (não em UTC)', () => {
  const c: ContadorEmail = { dia: '', tentativas: 0 };
  assert.equal(reservarEnvioEmail(c, new Date('2026-11-07T20:00:00Z'), 1).ok, true); // 17h em Brasília
  assert.equal(reservarEnvioEmail(c, new Date('2026-11-08T01:00:00Z'), 1).ok, false); // 22h do mesmo dia em Brasília (já é dia 8 em UTC)
  assert.equal(reservarEnvioEmail(c, new Date('2026-11-08T03:30:00Z'), 1).ok, true); // 0h30 do dia 8 em Brasília
});

test('e-mail: o log mostra só o começo do endereço', () => {
  assert.equal(mascararEmail('maria.silva@escritorio.com.br'), 'ma***@escritorio.com.br');
  assert.equal(mascararEmail('semarroba'), '***');
});
