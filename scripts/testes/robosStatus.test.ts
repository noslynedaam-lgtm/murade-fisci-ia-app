import test from 'node:test';
import assert from 'node:assert/strict';
import { executarRobo, registrarRobo, statusRobos } from '../../src/server/robosStatus';

function definirRobo(id: string) {
  registrarRobo({
    id,
    nome: 'Robô de teste',
    posto: 'integrador',
    missao: 'Validar o estado observado.',
    intervaloMs: 60_000,
  });
}

function estado(id: string) {
  return statusRobos().robos.find((robo) => robo.id === id)?.estado;
}

test('robô agendado sem execução concluída não aparece ativo', () => {
  const id = 'status-sem-execucao';
  definirRobo(id);
  assert.equal(estado(id), 'parado');
});

test('falha fica parada até uma nova execução bem-sucedida', async () => {
  const id = 'status-falha-e-recuperacao';
  definirRobo(id);

  await executarRobo(id, async () => 'ok');
  assert.equal(estado(id), 'ativo');

  await assert.rejects(() => executarRobo(id, async () => {
    throw new Error('falha de teste');
  }));
  assert.equal(estado(id), 'parado');

  await executarRobo(id, async () => 'recuperado');
  assert.equal(estado(id), 'ativo');
});
