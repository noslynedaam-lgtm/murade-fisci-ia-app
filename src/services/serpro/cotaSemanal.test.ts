import test from 'node:test';
import assert from 'node:assert/strict';
import { avaliarCota, decidirConsulta, registrarConsulta, semanaDe } from './cotaSemanal';

const seg = new Date('2026-10-19T15:00:00Z'); // segunda
const sex = new Date('2026-10-23T15:00:00Z');
const segSeguinte = new Date('2026-10-26T15:00:00Z');

test('semana começa na segunda (Brasília)', () => {
  assert.equal(semanaDe(seg), '2026-10-19');
  assert.equal(semanaDe(sex), '2026-10-19');
  assert.equal(semanaDe(new Date('2026-10-26T01:00:00Z')), '2026-10-19'); // ainda domingo à noite em Brasília
  assert.equal(semanaDe(segSeguinte), '2026-10-26');
});

test('primeira consulta é gratuita; segunda exige confirmação e é cobrada', () => {
  let cota = null as ReturnType<typeof registrarConsulta> | null;
  const d1 = decidirConsulta(cota, false, seg);
  assert.deepEqual(d1, { liberada: true, cobrada: false });
  cota = registrarConsulta(cota, false, 'situacaoFiscal', seg);
  assert.equal(avaliarCota(cota, sex).proximaConsultaCobrada, true);
  const d2 = decidirConsulta(cota, false, sex);
  assert.equal(d2.liberada, false);
  assert.deepEqual(decidirConsulta(cota, true, sex), { liberada: true, cobrada: true });
});

test('não acumula: nova semana volta a ter 1 gratuita', () => {
  const cota = registrarConsulta(null, false, 'x', seg);
  const st = avaliarCota(cota, segSeguinte);
  assert.equal(st.gratisRestante, 1);
  assert.equal(st.consultasNaSemana, 0);
  assert.equal(st.totalHistorico, 1);
});

test('limite é por empresa (cotas independentes)', () => {
  const a = registrarConsulta(null, false, 'x', seg);
  assert.equal(avaliarCota(a, sex).gratisRestante, 0);
  assert.equal(avaliarCota(null, sex).gratisRestante, 1);
});
