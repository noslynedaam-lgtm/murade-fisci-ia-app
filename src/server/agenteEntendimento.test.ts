import test from 'node:test';
import assert from 'node:assert/strict';
import { REGRAS_DE_ENTENDIMENTO, contextoDeRespostaCurta } from './agenteEntendimento';

const oferta = [{ papel: 'ia' as const, texto: 'A folha de outubro da Padaria Sol está pronta. Quer que eu avise o cliente por WhatsApp?' }];

test('"sim" curto prende a conversa ao que a Agente ofereceu', () => {
  for (const m of ['sim', 'Sim!', 'pode', 'Pode fazer', 'quero', 'isso mesmo', 'sim quero ajuda para isso']) {
    const nota = contextoDeRespostaCurta(m, oferta);
    assert.match(nota, /Padaria Sol/, m);
    assert.match(nota, /Não mude de assunto/, m);
  }
});

test('"não" curto cancela o que foi oferecido', () => {
  for (const m of ['não', 'nao precisa', 'deixa quieto', 'melhor não']) {
    assert.match(contextoDeRespostaCurta(m, oferta), /RECUSOU/, m);
  }
});

test('sem oferta anterior, ou pedido novo e longo, não injeta nada', () => {
  assert.equal(contextoDeRespostaCurta('sim', []), '');
  assert.equal(contextoDeRespostaCurta('sim', [{ papel: 'ia', texto: 'Folha calculada.' }]), '');
  assert.equal(contextoDeRespostaCurta('quais empresas vencem a guia do FGTS amanhã de manhã cedo', oferta), '');
  assert.equal(contextoDeRespostaCurta('folha', oferta), '');
  assert.equal(contextoDeRespostaCurta('', oferta), '');
});

test('só a última mensagem da Agente conta, e o texto é limitado', () => {
  const h = [{ papel: 'ia' as const, texto: 'Assunto antigo. Quer ver?' }, { papel: 'usuario' as const, texto: 'não' }, { papel: 'ia' as const, texto: `${'x'.repeat(900)} Quer que eu imprima as guias?` }];
  const nota = contextoDeRespostaCurta('sim', h);
  assert.match(nota, /imprima as guias/);
  assert.doesNotMatch(nota, /Assunto antigo/);
  assert.ok(nota.length < 1000);
});

test('regras pedem para perguntar quando não entendeu e para guiar passo a passo', () => {
  assert.match(REGRAS_DE_ENTENDIMENTO, /Não entendi direito\. Pode repetir\?/);
  assert.match(REGRAS_DE_ENTENDIMENTO, /nome exato da tela e do botão/);
  assert.match(REGRAS_DE_ENTENDIMENTO, /NÃO adivinhe/);
});
