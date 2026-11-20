import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ArmazemDeEtapas, LIMITE_PEDIDO_CARACTERES, REGRA_PEDIDO_LONGO, chaveDeEtapas, dividirEmEtapas, ehPedidoDeContinuar, limitarPedido, prepararPedido } from './agenteEtapas';
import { ArmazemAcoesPendentes, conversar, type ModeloIA } from './agenteMotor';

// Modelo de mentira: guarda o que recebeu e responde "feito".
function modeloFalso() {
  const recebidos: Array<{ instrucao: string; ultima: string }> = [];
  const modelo: ModeloIA = async ({ instrucao, conteudos }) => {
    const ultima = conteudos[conteudos.length - 1]?.parts?.[0]?.text ?? '';
    recebidos.push({ instrucao, ultima });
    return { texto: 'Feito.', chamadas: [] };
  };
  return { modelo, recebidos };
}
const ctx = (login: string) => ({ sessaoHash: `sessao-${login}`, login, hoje: '2026-11-20', chamarApi: async () => ({ status: 200, corpo: {} }), registrar: () => {}, pendentes: new ArmazemAcoesPendentes(), kit: { ferramentas: [], instrucao: 'Você é a Agente.' } }) as any;

// O que a rota faz: prepara, conversa com o texto preparado e monta a resposta.
async function falar(armazem: ArmazemDeEtapas, login: string, mensagem: string, modelo: ModeloIA) {
  const pedido = prepararPedido(armazem, chaveDeEtapas('teste', 'escritorio-1', login, `sessao-${login}`), mensagem);
  const r = await conversar(ctx(login), modelo, pedido.mensagem, []);
  return { ...r, ...pedido.concluir(r.resposta) };
}

const paragrafo = (marca: string, n: number) => `${marca} ${'texto da carta com detalhes. '.repeat(Math.ceil(n / 29))}`.slice(0, n);

test('aceita até 500.000 caracteres; acima disso lê o começo e avisa (nunca recusa)', () => {
  assert.equal(limitarPedido('a'.repeat(LIMITE_PEDIDO_CARACTERES)).cortado, false);
  const r = limitarPedido('a'.repeat(600_000));
  assert.equal(r.cortado, true);
  assert.equal(r.texto.length, 500_000);
  assert.equal(r.tamanhoOriginal, 600_000);
});

test('mensagem de 40.000 caracteres vai por etapas: lista, etapa 1 e próximo', async () => {
  const { modelo, recebidos } = modeloFalso();
  const texto = Array.from({ length: 8 }, (_, i) => paragrafo(`PARAGRAFO${i + 1}`, 5_000)).join('\n\n');
  assert.ok(texto.length > 40_000);
  const r = await falar(new ArmazemDeEtapas(), 'ana', texto, modelo);
  assert.match(r.resposta, /dividi em \d+ partes/);
  assert.match(r.resposta, /Vou por etapa\./);
  assert.match(r.resposta, /Etapa 1 de \d+/);
  assert.match(r.resposta, /Próximo: 2\) .* — quer que eu siga\?/);
  assert.doesNotMatch(r.resposta, /grande demais|não consigo/i);
  assert.equal(r.etapas?.atual, 1);
  assert.match(recebidos[0].ultima, /\[ETAPA 1 DE/);
  assert.match(recebidos[0].ultima, /PARAGRAFO1/);
});

test('mensagem de 200.000 caracteres: no máximo 40 etapas e o modelo recebe só a etapa da vez', async () => {
  const { modelo, recebidos } = modeloFalso();
  const texto = Array.from({ length: 40 }, (_, i) => paragrafo(`BLOCO${i + 1}`, 5_000)).join('\n\n');
  assert.ok(texto.length >= 200_000);
  const r = await falar(new ArmazemDeEtapas(), 'ana', texto, modelo);
  assert.ok(r.etapas && r.etapas.total >= 2 && r.etapas.total <= 40);
  assert.ok(recebidos[0].ultima.length < 30_000, 'etapa enviada inteira, sem o texto todo junto');
  assert.doesNotMatch(recebidos[0].ultima, /BLOCO40/);
});

test('mensagem acima de 500.000 caracteres: responde e avisa que o resto não foi lido', async () => {
  const { modelo } = modeloFalso();
  const r = await falar(new ArmazemDeEtapas(), 'ana', 'x '.repeat(310_000), modelo);
  assert.equal(r.textoCortado, true);
  assert.match(r.resposta, /li só os primeiros 500\.000/);
  assert.match(r.resposta, /O resto não foi lido/);
});

test('carta com pedidos numerados: "Entendi N pedidos", e "próximo"/"sim" seguem com o texto original completo', async () => {
  const { modelo, recebidos } = modeloFalso();
  const armazem = new ArmazemDeEtapas();
  const item2 = `${paragrafo('Confira as notas de entrada', 9_500)} FIM-DO-ITEM-2`;
  const carta = `Prezada Agente,\nsegue o que preciso hoje.\n\n1) Calcule a folha de outubro da Padaria Sol.\n${paragrafo('detalhe', 1_200)}\n2) ${item2}\n3) Gere as guias do FGTS.\n\nObrigado.`;
  const r1 = await falar(armazem, 'ana', carta, modelo);
  assert.match(r1.resposta, /^Entendi 3 pedidos: 1\) Calcule a folha de outubro da Padaria Sol; 2\) Confira as notas de entrada.*; 3\) Gere as guias do FGTS\. Vou por etapa\./s);
  assert.match(r1.resposta, /Próximo: 2\) Confira as notas de entrada/);
  assert.match(recebidos[0].ultima, /Prezada Agente/, 'o começo da carta vai como contexto');

  const r2 = await falar(armazem, 'ana', 'próximo', modelo);
  assert.match(r2.resposta, /^Etapa 2 de 3/);
  assert.match(recebidos[1].ultima, /FIM-DO-ITEM-2/, 'a etapa usa o texto guardado, não o histórico cortado em 8.000');
  assert.match(r2.resposta, /Próximo: 3\) Gere as guias do FGTS/);

  const r3 = await falar(armazem, 'ana', 'sim', modelo);
  assert.match(r3.resposta, /^Etapa 3 de 3/);
  assert.match(r3.resposta, /essa foi a última etapa/);
  assert.equal(r3.etapas?.restantes, 0);

  const r4 = await falar(armazem, 'ana', 'próximo', modelo);
  assert.equal(r4.etapas, undefined, 'acabou: segue a conversa normal');
  assert.equal(recebidos[3].ultima.includes('[ETAPA'), false);
});

test('"sim" só continua logo depois da oferta; "continua" e "pode seguir" continuam sempre', async () => {
  const { modelo } = modeloFalso();
  const armazem = new ArmazemDeEtapas();
  const carta = `1) Primeiro pedido ${paragrafo('a', 800)}\n2) Segundo pedido ${paragrafo('b', 800)}\n3) Terceiro pedido ${paragrafo('c', 800)}\n4) Quarto pedido`;
  await falar(armazem, 'ana', carta, modelo);
  const outro = await falar(armazem, 'ana', 'quais empresas eu tenho no simples nacional hoje?', modelo);
  assert.equal(outro.etapas, undefined);
  const sim = await falar(armazem, 'ana', 'sim', modelo);
  assert.equal(sim.etapas, undefined, 'depois de outro assunto, "sim" não pula para a etapa');
  const cont = await falar(armazem, 'ana', 'continua', modelo);
  assert.equal(cont.etapas?.atual, 2);
  const seg = await falar(armazem, 'ana', 'pode seguir', modelo);
  assert.equal(seg.etapas?.atual, 3);
  for (const m of ['próximo', 'Próxima etapa', 'segue', 'pode continuar', 'ok, próximo']) assert.equal(ehPedidoDeContinuar(m, false), true, m);
  for (const m of ['sim', 'pode']) { assert.equal(ehPedidoDeContinuar(m, false), false, m); assert.equal(ehPedidoDeContinuar(m, true), true, m); }
  assert.equal(ehPedidoDeContinuar('segue abaixo a lista de funcionários que entraram este mês na empresa da Maria e do João', false), false);
});

test('isolamento: o "próximo" de um usuário nunca pega o texto de outro', async () => {
  const { modelo, recebidos } = modeloFalso();
  const armazem = new ArmazemDeEtapas();
  await falar(armazem, 'ana', `1) SEGREDO-DA-ANA ${paragrafo('a', 900)}\n2) outro ${paragrafo('b', 900)}\n3) mais um`, modelo);
  const r = await falar(armazem, 'bruno', 'próximo', modelo);
  assert.equal(r.etapas, undefined);
  assert.equal(recebidos[1].ultima.includes('SEGREDO-DA-ANA'), false);
  // Mesmo login em outro escritório também não mistura.
  const p = prepararPedido(armazem, chaveDeEtapas('teste', 'escritorio-2', 'ana', 'sessao-ana'), 'próximo');
  assert.equal(p.etapa, null);
  // A Ana continua de onde parou.
  const a = await falar(armazem, 'ana', 'próximo', modelo);
  assert.equal(a.etapas?.atual, 2);
});

test('plano guardado vence em algumas horas', () => {
  let agora = 0;
  const armazem = new ArmazemDeEtapas(() => agora);
  const p = prepararPedido(armazem, 'k', 'y'.repeat(20_000));
  p.concluir('ok');
  assert.equal(prepararPedido(armazem, 'k', 'próximo').etapa?.atual, 2);
  agora += 5 * 60 * 60_000;
  assert.equal(prepararPedido(armazem, 'k', 'próximo').etapa, null);
});

test('pedido curto e sem lista segue igual; sem chave de usuário nada é guardado', () => {
  const armazem = new ArmazemDeEtapas();
  const p = prepararPedido(armazem, 'k', 'quantas empresas eu tenho?');
  assert.equal(p.mensagem, 'quantas empresas eu tenho?');
  assert.equal(p.etapa, null);
  assert.equal(p.concluir('Você tem 3.').resposta, 'Você tem 3.');
  const semChave = prepararPedido(armazem, '', 'z'.repeat(40_000));
  assert.equal(semChave.etapa, null);
  assert.equal(armazem.tamanho(), 0);
});

test('lista numerada numa linha só (voz ou caixa de uma linha) também vira etapas', () => {
  const d = dividirEmEtapas(`Preciso de três coisas: 1) calcular a folha da Padaria Sol; 2) conferir as notas de outubro; 3) gerar o DAS. ${'detalhe '.repeat(200)}`);
  assert.equal(d.numerados, 3);
  assert.equal(d.etapas[0].titulo, 'calcular a folha da Padaria Sol');
  assert.match(d.preambulo, /três coisas/);
  // Valores e datas não viram itens.
  assert.equal(dividirEmEtapas('Paguei R$ 1.000,00 em 2026. Depois 2.500,00.').numerados, 0);
});

test('a instrução da Agente proíbe recusar por tamanho', async () => {
  assert.match(REGRA_PEDIDO_LONGO, /Nunca diga que o pedido é grande demais/);
  const { modelo, recebidos } = modeloFalso();
  await conversar(ctx('ana'), modelo, 'oi', []);
  assert.ok(recebidos[0].instrucao.includes(REGRA_PEDIDO_LONGO));
});

test('o servidor não devolve mais 413 por tamanho do pedido da Agente', () => {
  const server = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
  assert.doesNotMatch(server, /30\.000 caracteres/);
  assert.doesNotMatch(server, /length > 30000\)\s*\{?\s*return res\.status\(413\)/);
  assert.match(server, /prepararPedido\(/);
});
