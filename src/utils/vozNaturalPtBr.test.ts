import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dataPorExtenso, dividirEmFrases, escolherVozNatural, nivelDaVoz, numeroPorExtenso, ordenarVozesPtBr, ordinalPorExtenso,
  prepararTextoParaFala as falar, reaisPorExtenso, rotuloDaVoz,
} from './vozNaturalPtBr';

// Voz natural da assistente: o MESMO teste nos 5 sistemas Murad (o módulo é copiado igual em cada um).

test('números por extenso (pt-BR)', () => {
  assert.equal(numeroPorExtenso(0), 'zero');
  assert.equal(numeroPorExtenso(1), 'um');
  assert.equal(numeroPorExtenso(14), 'quatorze');
  assert.equal(numeroPorExtenso(21), 'vinte e um');
  assert.equal(numeroPorExtenso(100), 'cem');
  assert.equal(numeroPorExtenso(101), 'cento e um');
  assert.equal(numeroPorExtenso(1000), 'mil');
  assert.equal(numeroPorExtenso(1001), 'mil e um');
  assert.equal(numeroPorExtenso(1200), 'mil e duzentos');
  assert.equal(numeroPorExtenso(1234), 'mil duzentos e trinta e quatro');
  assert.equal(numeroPorExtenso(2026), 'dois mil e vinte e seis');
  assert.equal(numeroPorExtenso(21000), 'vinte e um mil');
  assert.equal(numeroPorExtenso(1000000), 'um milhão');
  assert.equal(numeroPorExtenso(1200000), 'um milhão e duzentos mil');
  assert.equal(numeroPorExtenso(2500300), 'dois milhões quinhentos mil e trezentos');
  assert.equal(numeroPorExtenso(1, true), 'uma');
  assert.equal(numeroPorExtenso(22, true), 'vinte e duas');
});

test('reais por extenso', () => {
  assert.equal(reaisPorExtenso(1234, 56), 'mil duzentos e trinta e quatro reais e cinquenta e seis centavos');
  assert.equal(reaisPorExtenso(1, 0), 'um real');
  assert.equal(reaisPorExtenso(0, 1), 'um centavo');
  assert.equal(reaisPorExtenso(1000000, 0), 'um milhão de reais');
  assert.equal(falar('Valor: R$ 1.234,56'), 'Valor: mil duzentos e trinta e quatro reais e cinquenta e seis centavos.');
  assert.equal(falar('Total R$ 0,50.'), 'Total cinquenta centavos.');
  assert.equal(falar('Saldo de R$1.000.000,00.'), 'Saldo de um milhão de reais.');
  assert.equal(falar('Faturou R$ 50 mil.'), 'Faturou cinquenta mil reais.');
  assert.equal(falar('Faturou R$ 2,5 milhões.'), 'Faturou dois vírgula cinco milhões de reais.');
  assert.equal(falar('Diferença de -R$ 10,00.'), 'Diferença de menos dez reais.');
});

test('datas, competências e horas por extenso', () => {
  assert.equal(dataPorExtenso(1, 5, 2026), 'primeiro de maio de dois mil e vinte e seis');
  assert.equal(falar('Vence em 20/12/2026.'), 'Vence em vinte de dezembro de dois mil e vinte e seis.');
  assert.equal(falar('Vence em 01/02/26.'), 'Vence em primeiro de fevereiro de dois mil e vinte e seis.');
  assert.equal(falar('Data 2026-11-25.'), 'Data vinte e cinco de novembro de dois mil e vinte e seis.');
  assert.equal(falar('Competência 11/2026.'), 'Competência novembro de dois mil e vinte e seis.');
  assert.equal(falar('Até 20/12.'), 'Até vinte de dezembro.');
  assert.equal(falar('Às 14h30.'), 'Às quatorze horas e trinta.');
  assert.equal(falar('Às 9h.'), 'Às nove horas.');
  assert.equal(falar('Às 1h.'), 'Às uma hora.');
  assert.equal(falar('Às 08:00.'), 'Às oito horas.');
});

test('siglas faladas do jeito certo', () => {
  assert.equal(falar('Confira o CNPJ.'), 'Confira o cê ene pê jota.');
  assert.equal(falar('FGTS e INSS.'), 'efe gê tê esse e i ene esse esse.');
  assert.equal(falar('O DAS do MEI.'), 'O das do mei.');
  assert.equal(falar('Emita a NF-e e a NFS-e.'), 'Emita a nota fiscal eletrônica e a nota fiscal de serviço eletrônica.');
  assert.equal(falar('Envie ao eSocial.'), 'Envie ao é social.');
  assert.equal(falar('PGDAS-D transmitido.'), 'pê gê das dê transmitido.');
  assert.equal(falar('Retido o IRRF e o ICMS-ST.'), 'Retido o i erre erre efe e o i cê eme esse esse tê.');
  // Palavras comuns que parecem sigla não mudam.
  assert.equal(falar('Uma das empresas.'), 'Uma das empresas.');
  assert.equal(falar('Pago no 5º dia útil.'), 'Pago no quinto dia útil.');
});

test('ordinais, porcentagens, leis e abreviações', () => {
  assert.equal(ordinalPorExtenso(13), 'décimo terceiro');
  assert.equal(ordinalPorExtenso(2, true), 'segunda');
  assert.equal(falar('O 13º salário e a 1ª parcela.'), 'O décimo terceiro salário e a primeira parcela.');
  assert.equal(falar('Alíquota de 7,5%.'), 'Alíquota de sete vírgula cinco por cento.');
  assert.equal(falar('Lei nº 8.212/91, art. 22.'), 'Lei número oito mil duzentos e doze de noventa e um, artigo vinte e dois.');
  assert.equal(falar('LC 123/2006.'), 'LC cento e vinte e três de dois mil e seis.');
  assert.equal(falar('§ 1º do art. 3º.'), 'parágrafo primeiro do artigo terceiro.');
  assert.equal(falar('Empresa Exemplo LTDA.'), 'Empresa Exemplo limitada.');
  assert.equal(falar('Fator R = 28% → Anexo III.'), 'Fator R igual a vinte e oito por cento, Anexo três.');
  assert.equal(falar('Evento S-1200 no e-Social.'), 'Evento esse mil e duzentos no é social.');
  assert.equal(falar('Receita (RBT12) da safra 2025/2026.'), 'Receita, RBT doze, da safra dois mil e vinte e cinco barra dois mil e vinte e seis.');
  assert.equal(falar('Protocolo 1.2.202611.0000000123456789.'), 'Protocolo o número que está na tela.');
});

test('não lê markdown, emojis, links, e-mails, códigos nem números de documento', () => {
  assert.equal(falar('**Atenção:** veja https://www.gov.br/receita agora ✅'), 'Atenção: veja agora.');
  assert.equal(falar('## Resumo\n- Item um\n- Item dois'), 'Resumo. Item um. Item dois.');
  assert.equal(falar('Veja o [manual](https://x.com/a).'), 'Veja o manual.');
  assert.equal(falar('Rode isto:\n```js\nconsole.log(1)\n```\nPronto.'), 'Rode isto: Pronto.');
  assert.equal(falar('Escreva para contato@escritorio.com.br.'), 'Escreva para o e-mail que está na tela.');
  assert.equal(falar('Chave 35241112345678000190550010000012341000012345.'), 'Chave o número que está na tela.');
  assert.equal(falar('CNPJ 12.345.678/0001-90.'), 'cê ene pê jota um dois, três quatro cinco, seis sete oito, zero zero zero um, nove zero.');
  assert.equal(falar('🎉🎉 Pronto! 👍'), 'Pronto!');
  assert.equal(falar('| Imposto | Valor |\n|---|---|\n| DAS | R$ 10,00 |'), 'Imposto, Valor. das, dez reais.');
  assert.equal(falar(''), '');
  assert.equal(falar('ATENÇÃO: prazo curto.'), 'atenção: prazo curto.');
});

test('frases: divide com pausa natural, junta frase curta e quebra frase longa na vírgula', () => {
  assert.deepEqual(dividirEmFrases('Oi. Tudo bem? Hoje vence o das da empresa e precisamos conferir tudo com calma.'), ['Oi. Tudo bem? Hoje vence o das da empresa e precisamos conferir tudo com calma.']);
  const longa = `${'palavra '.repeat(30)}, ${'outra '.repeat(30)}.`;
  const partes = dividirEmFrases(longa, 220);
  assert.ok(partes.length >= 2 && partes.every((p) => p.length <= 220));
  assert.deepEqual(dividirEmFrases('Primeira frase comprida o bastante para ficar sozinha no trecho. Segunda frase também comprida o bastante.'), ['Primeira frase comprida o bastante para ficar sozinha no trecho.', 'Segunda frase também comprida o bastante.']);
});

const V = (name: string, lang = 'pt-BR', extra: Record<string, unknown> = {}) => ({ name, lang, voiceURI: name, ...extra });

test('escolha da voz: Natural do Edge > Google > alta qualidade do celular > qualquer pt-BR; nunca outro idioma', () => {
  const edge = [V('Microsoft Daniel - Portuguese (Brazil)'), V('Microsoft Maria - Portuguese (Brazil)'), V('Microsoft Antonio Online (Natural) - Portuguese (Brazil)'), V('Microsoft Thalita Online (Natural) - Portuguese (Brazil)'), V('Microsoft Francisca Online (Natural) - Portuguese (Brazil)'), V('Microsoft Aria Online (Natural) - English (United States)', 'en-US')];
  assert.equal(escolherVozNatural(edge)?.name, 'Microsoft Francisca Online (Natural) - Portuguese (Brazil)');
  assert.equal(escolherVozNatural(edge.filter((v) => !/Francisca/.test(v.name)))?.name, 'Microsoft Thalita Online (Natural) - Portuguese (Brazil)');
  const chrome = [V('Google US English', 'en-US'), V('Microsoft Maria - Portuguese (Brazil)'), V('Google português do Brasil')];
  assert.equal(escolherVozNatural(chrome)?.name, 'Google português do Brasil');
  const iphone = [V('Felipe'), V('Luciana'), V('Luciana (Melhorada)'), V('Eddy (Português (Brasil))'), V('Joana', 'pt-PT'), V('Samantha', 'en-US')];
  assert.equal(escolherVozNatural(iphone)?.name, 'Luciana (Melhorada)');
  const android = [V('pt-br-x-afs-local', 'pt_BR'), V('pt-br-x-afs-network', 'pt_BR', { localService: false }), V('en-us-x-sfg-network', 'en_US')];
  assert.equal(escolherVozNatural(android)?.name, 'pt-br-x-afs-network');
  // Só tem voz em inglês: nenhuma voz (o navegador usa a pt-BR do sistema, nunca lê português com sotaque de outro idioma).
  assert.equal(escolherVozNatural([V('Samantha', 'en-US'), V('Google US English', 'en-US')]), null);
  // pt-PT só entra se não houver pt-BR.
  assert.equal(escolherVozNatural([V('Joana', 'pt-PT')])?.name, 'Joana');
  assert.ok(ordenarVozesPtBr([...iphone]).every((v) => v.lang === 'pt-BR'));
  assert.equal(nivelDaVoz(V('Google US English', 'en-US')), -1);
});

test('escolha da voz: a escolha da pessoa vale se a voz existir neste aparelho', () => {
  const lista = [V('Google português do Brasil'), V('Microsoft Maria - Portuguese (Brazil)')];
  assert.equal(escolherVozNatural(lista, 'Microsoft Maria - Portuguese (Brazil)')?.name, 'Microsoft Maria - Portuguese (Brazil)');
  assert.equal(escolherVozNatural(lista, 'Voz de outro aparelho')?.name, 'Google português do Brasil');
  assert.equal(escolherVozNatural([V('Samantha', 'en-US')], 'Samantha'), null, 'escolha antiga em outro idioma não vale');
  assert.match(rotuloDaVoz(V('Microsoft Francisca Online (Natural) - Portuguese (Brazil)')), /^Francisca Online \(Natural\) — muito natural$/);
});
