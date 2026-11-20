import test from 'node:test';
import assert from 'node:assert/strict';
import { chaveTarefa, contarTarefas, novaTarefa, validarTarefa } from './tarefasEquipe';
import { validarItem, ehColecao } from './dadosEscritorio';

const E = '11111111-1111-4111-8111-111111111111';
test('tarefa da pendência tem chave fixa (não duplica); manual tem chave única', () => {
  assert.equal(chaveTarefa('relatorio_cliente', E, 'certidao-estadual', 'x'), `rc-${E}-certidao-estadual`);
  assert.equal(chaveTarefa('dte_go', E, 'procuracao', 'x'), `dte-${E}-procuracao`);
  assert.notEqual(novaTarefa({ origem: 'manual', titulo: 'abc' }).id, novaTarefa({ origem: 'manual', titulo: 'abc' }).id);
  const t = novaTarefa({ origem: 'relatorio_cliente', titulo: '  Renovar  ', empresaId: E, codigo: 'certificado-a1', prazo: '2026-02-30' });
  assert.equal(t.prazo, null); assert.equal(t.titulo, 'Renovar');
  assert.equal(validarTarefa(t.id, t), null);
  assert.equal(validarItem('tarefas_equipe', t.id, t), null);
});
test('validação e contagem', () => {
  const t = novaTarefa({ origem: 'manual', titulo: 'Fazer X', prazo: '2026-11-19' });
  assert.match(String(validarTarefa(t.id, { ...t, titulo: 'x' })), /3 a 200/);
  assert.match(String(validarTarefa(t.id, { ...t, origem: 'robo' })), /Origem/);
  assert.match(String(validarTarefa('outra', t)), /inválida/);
  assert.deepEqual(contarTarefas([t, { ...t, prazo: '2026-11-20' }, { ...t, concluida: true }], '2026-11-20'), { abertas: 2, atrasadas: 1, hoje: 1, concluidas: 1 });
});
test('coleções novas do escritório aceitas; antigas continuam iguais', () => {
  for (const c of ['relatorio_cliente', 'tarefas_equipe', 'dte_go', 'agenda_lembretes', 'compliance_status', 'guias_receita']) assert.ok(ehColecao(c), c);
  assert.equal(validarItem('relatorio_cliente', 'config', { nomeExibido: 'X' }), null);
  assert.match(String(validarItem('relatorio_cliente', 'outra', {})), /Configuração/);
  assert.match(String(validarItem('dte_go', 'abc', {})), /Empresa/);
});
