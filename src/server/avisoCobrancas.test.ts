import test from 'node:test';
import assert from 'node:assert/strict';
import { destinoDoAviso, dentroDaJanelaDeEnvio, montarTextoAviso, rodarAvisoCobrancas } from './avisoCobrancas';

test('destino do aviso: variável própria ou o login com e-mail do dono', () => {
  assert.equal(destinoDoAviso({ MURADE_AVISO_EMAIL: 'a@b.com' }), 'a@b.com');
  assert.equal(destinoDoAviso({ MURADE_DONO_SISTEMA: 'admin, dono@x.com' }), 'dono@x.com');
  assert.equal(destinoDoAviso({ MURADE_AVISO_EMAIL: 'invalido' }), null);
  assert.equal(destinoDoAviso({}), null);
});

test('janela de envio: só entre 20h e 21h59 de Brasília', () => {
  assert.equal(dentroDaJanelaDeEnvio(new Date('2026-10-28T23:05:00Z')), true);  // 20:05 em Brasília
  assert.equal(dentroDaJanelaDeEnvio(new Date('2026-10-29T00:59:00Z')), true);  // 21:59
  assert.equal(dentroDaJanelaDeEnvio(new Date('2026-10-28T22:59:00Z')), false); // 19:59
  assert.equal(dentroDaJanelaDeEnvio(new Date('2026-10-29T01:00:00Z')), false); // 22:00
});

test('texto do aviso lista escritório, empresa, serviço e valor', () => {
  const t = montarTextoAviso('2026-10-28', [
    { em: '2026-10-28T15:00:00Z', escritorio: 'ana@x.com', escritorioId: 'o1', cnpj: '11222333000181', nome: 'ACME', servico: 'dctfwebGuia', cobrada: true, valor: 0.32 },
    { em: '2026-10-28T16:00:00Z', escritorio: 'ana@x.com', escritorioId: 'o1', cnpj: '11222333000181', nome: 'ACME', servico: 'situacaoFiscal', cobrada: true, valor: 0.24 },
  ]);
  assert.match(t.assunto, /2 consulta\(s\) cobrada\(s\) em 28\/10/); assert.match(t.assunto, /0,56/);
  assert.match(t.texto, /ana@x\.com — R\$\s?0,56/); assert.match(t.texto, /ACME \(11222333000181\) · dctfwebGuia/);
});

test('fora da janela ou sem e-mail configurado, nada é enviado e o motivo é dito', async () => {
  assert.match(await rodarAvisoCobrancas(new Date('2026-10-28T15:00:00Z'), {}), /Aguardando as 20h/);
  assert.match(await rodarAvisoCobrancas(new Date('2026-10-28T23:10:00Z'), {}), /configure o e-mail/);
});
