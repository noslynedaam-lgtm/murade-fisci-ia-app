import test from 'node:test';
import assert from 'node:assert/strict';
import { decidirAcessoConsulta } from './acessoConsulta';

const T = '11111111-1111-4111-8111-111111111111';
const info = (o: Partial<{ nome: string; cnpj: string | null; donoDoSistema: boolean }> = {}) => ({ nome: 'Escritório A', cnpj: '11111111000191', donoDoSistema: false, ...o });

test('dono do sistema (administrador): como sempre, sem CNPJ de escritório nem origem', () => {
  assert.deepEqual(decidirAcessoConsulta({ ehAdmin: true, tenantId: T, vinculado: true, info: null }), { ok: true });
});
test('escritório cliente com CNPJ cadastrado: consulta com o CNPJ dele e a cobrança vai para o escritório', () => {
  assert.deepEqual(decidirAcessoConsulta({ ehAdmin: false, tenantId: T, vinculado: true, info: info() }), { ok: true, escritorioCnpj: '11111111000191', escritorio: { id: T, nome: 'Escritório A' } });
});
test('escritório cliente SEM CNPJ cadastrado: nada é consultado nem cobrado (409)', () => {
  const r: any = decidirAcessoConsulta({ ehAdmin: false, tenantId: T, vinculado: true, info: info({ cnpj: null }) });
  assert.equal(r.ok, false); assert.equal(r.http, 409); assert.match(r.mensagem, /CNPJ do escritório/); assert.match(r.mensagem, /Nada foi consultado nem cobrado/);
});
test('quem não é dono/administrador do escritório (ou é de outro escritório) não consulta (403)', () => {
  const r: any = decidirAcessoConsulta({ ehAdmin: false, tenantId: T, vinculado: false, info: info() });
  assert.equal(r.ok, false); assert.equal(r.http, 403);
});
test('banco ainda sem a atualização 016: indisponível (503), nunca consulta sem saber o CNPJ', () => {
  assert.equal((decidirAcessoConsulta({ ehAdmin: false, tenantId: T, vinculado: true, info: null }) as any).http, 503);
});
test('escritório do próprio dono do sistema usa o CNPJ do contratante (sem origem separada)', () => {
  assert.deepEqual(decidirAcessoConsulta({ ehAdmin: false, tenantId: T, vinculado: true, info: info({ donoDoSistema: true, cnpj: null }) }), { ok: true });
});
