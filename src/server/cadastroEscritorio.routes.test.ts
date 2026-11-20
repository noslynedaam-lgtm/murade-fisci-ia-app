import assert from 'node:assert/strict';
import { test } from 'node:test';
import { situacaoDoCadastro, urlCadastroDP } from './cadastroEscritorio.routes';
import { kitFiscoIA } from './agenteFiscoIA';

test('cadastro do escritório no Fisco IA: sem CNPJ avisa e manda para o DP; dono do sistema não precisa', () => {
  const sem = situacaoDoCadastro({ name: 'Esc', office_cnpj: null, is_platform_owner: false });
  assert.equal(sem.cnpj, null); assert.match(sem.avisos[0], /cadastro do escritório no DP/);
  assert.deepEqual(situacaoDoCadastro({ name: 'Esc', office_cnpj: '11222333000181', is_platform_owner: false }).avisos, []);
  assert.deepEqual(situacaoDoCadastro({ name: 'Dono', office_cnpj: null, is_platform_owner: true }).avisos, []);
  assert.equal(urlCadastroDP({}), 'https://murade-dp.onrender.com/#cadastro-escritorio');
  assert.equal(urlCadastroDP({ MURADE_DP_URL: 'https://dp.exemplo.com/' }), 'https://dp.exemplo.com/#cadastro-escritorio');
});

test('a Agente do Fisco IA tem a ferramenta (só leitura) do cadastro do escritório', () => {
  const f = kitFiscoIA.ferramentas.find((x) => x.declaracao.name === 'situacao_cadastro_escritorio');
  assert.ok(f); assert.equal(f!.tipo, 'leitura');
  assert.match(kitFiscoIA.instrucao, /Cadastro do escritório: é feito uma vez no DP/);
});
