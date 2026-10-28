/**
 * Extrato de consumo SERPRO por escritório, para a cobrança mensal.
 * Deriva dos registros de cada empresa (companies.metadata.serproCota.consultas): sem tabela nova.
 * Ciclo do contrato: do dia 21 do mês anterior ao dia 20 do mês de referência (fuso de Brasília).
 * Preços por requisição (contrato): Consulta R$ 0,24 · Emissão R$ 0,32 · Declaração R$ 0,40.
 * "Apoiar" (pedido de protocolo) é tratado como consulta — confira na fatura real do SERPRO.
 */
import type { RegistroConsulta } from './cotaSemanal';

export type OperacaoSerpro = 'Consultar' | 'Emitir' | 'Apoiar' | 'Declarar' | 'Monitorar';
export const PRECO_POR_OPERACAO: Record<OperacaoSerpro, number> = { Consultar: 0.24, Apoiar: 0.24, Emitir: 0.32, Declarar: 0.4, /* PREÇO A CONFIRMAR: a página do INNOVAMSG63 não informa o valor; estimado igual ao de Consultar até o Serpro confirmar. */ Monitorar: 0.24 };

export interface EmpresaConsumo { id: string; cnpj: string; nome: string; consultas: RegistroConsulta[] }
export interface LinhaConsumo { escritorio: string; escritorioId: string; empresaId: string; cnpj: string; nome: string; consultas: number; gratuitas: number; cobradas: number; valorCobrado: number; custoAbsorvido: number }
export interface LinhaEscritorio { escritorioId: string; escritorio: string; empresas: number; consultas: number; gratuitas: number; cobradas: number; valorCobrado: number; custoAbsorvido: number }
export interface ExtratoConsumo { ciclo: string; de: string; ate: string; linhas: LinhaConsumo[]; porEscritorio: LinhaEscritorio[]; totalConsultas: number; totalGratuitas: number; totalCobradas: number; valorACobrar: number; custoAbsorvido: number }

const dataSP = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const arred = (n: number) => Math.round(n * 100) / 100;

/** Janela [de, ate] (AAAA-MM-DD, inclusiva) do ciclo "AAAA-MM". */
export function janelaDoCiclo(ciclo: string): { de: string; ate: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(ciclo);
  if (!m || +m[2] < 1 || +m[2] > 12) throw new Error('Ciclo inválido (use AAAA-MM).');
  const a = +m[1], mes = +m[2];
  const ant = mes === 1 ? { a: a - 1, m: 12 } : { a, m: mes - 1 };
  const p = (n: number) => String(n).padStart(2, '0');
  return { de: `${ant.a}-${p(ant.m)}-21`, ate: `${a}-${p(mes)}-20` };
}

/** Ciclo que contém a data (dia ≥ 21 pertence ao ciclo do mês seguinte). */
export function cicloDe(data: Date): string {
  const [a, m, d] = dataSP(data).split('-').map(Number);
  let ano = a, mes = m;
  if (d >= 21) { mes += 1; if (mes === 13) { mes = 1; ano += 1; } }
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

export const ESCRITORIO_DIRETO = { id: 'direto', nome: 'Fisco IA (direto)' };

export function montarExtrato(empresas: EmpresaConsumo[], ciclo: string, operacaoDoServico: (chave: string) => OperacaoSerpro): ExtratoConsumo {
  const { de, ate } = janelaDoCiclo(ciclo);
  // uma linha por (escritório, empresa): a mesma empresa pode ser consultada por escritórios diferentes
  const mapa = new Map<string, LinhaConsumo>();
  for (const e of empresas) {
    for (const c of e.consultas) {
      const dia = dataSP(new Date(c.em));
      if (dia < de || dia > ate) continue;
      const orig = c.escritorio ?? ESCRITORIO_DIRETO;
      const chave = `${orig.id}|${e.id}`;
      let l = mapa.get(chave);
      if (!l) { l = { escritorio: orig.nome, escritorioId: orig.id, empresaId: e.id, cnpj: e.cnpj, nome: e.nome, consultas: 0, gratuitas: 0, cobradas: 0, valorCobrado: 0, custoAbsorvido: 0 }; mapa.set(chave, l); }
      const preco = PRECO_POR_OPERACAO[operacaoDoServico(c.servico)] ?? PRECO_POR_OPERACAO.Consultar;
      l.consultas++;
      if (c.cobrada) { l.cobradas++; l.valorCobrado += preco; } else { l.gratuitas++; l.custoAbsorvido += preco; }
    }
  }
  const linhas = [...mapa.values()].map((l) => ({ ...l, valorCobrado: arred(l.valorCobrado), custoAbsorvido: arred(l.custoAbsorvido) }));
  linhas.sort((x, y) => x.escritorio.localeCompare(y.escritorio) || y.valorCobrado - x.valorCobrado || x.nome.localeCompare(y.nome));
  const porMapa = new Map<string, LinhaEscritorio & { _e: Set<string> }>();
  for (const l of linhas) {
    let o = porMapa.get(l.escritorioId);
    if (!o) { o = { escritorioId: l.escritorioId, escritorio: l.escritorio, empresas: 0, consultas: 0, gratuitas: 0, cobradas: 0, valorCobrado: 0, custoAbsorvido: 0, _e: new Set() }; porMapa.set(l.escritorioId, o); }
    o._e.add(l.empresaId); o.consultas += l.consultas; o.gratuitas += l.gratuitas; o.cobradas += l.cobradas; o.valorCobrado += l.valorCobrado; o.custoAbsorvido += l.custoAbsorvido;
  }
  const porEscritorio: LinhaEscritorio[] = [...porMapa.values()].map(({ _e, ...o }) => ({ ...o, empresas: _e.size, valorCobrado: arred(o.valorCobrado), custoAbsorvido: arred(o.custoAbsorvido) })).sort((x, y) => y.valorCobrado - x.valorCobrado || x.escritorio.localeCompare(y.escritorio));
  const soma = (f: (l: LinhaConsumo) => number) => linhas.reduce((s, l) => s + f(l), 0);
  return { ciclo, de, ate, linhas, porEscritorio, totalConsultas: soma(l => l.consultas), totalGratuitas: soma(l => l.gratuitas), totalCobradas: soma(l => l.cobradas), valorACobrar: arred(soma(l => l.valorCobrado)), custoAbsorvido: arred(soma(l => l.custoAbsorvido)) };
}

export function extratoParaCsv(x: ExtratoConsumo): string {
  const br = (n: number) => n.toFixed(2).replace('.', ',');
  const cab = ['Escritório', 'CNPJ', 'Empresa', 'Consultas', 'Gratuitas', 'Cobradas', 'Valor a cobrar (R$)', 'Custo absorvido (R$)'];
  const lin = x.linhas.map(l => [`"${l.escritorio.replace(/"/g, '""')}"`, l.cnpj, `"${l.nome.replace(/"/g, '""')}"`, l.consultas, l.gratuitas, l.cobradas, br(l.valorCobrado), br(l.custoAbsorvido)].join(';'));
  lin.push(['', '', 'TOTAL', x.totalConsultas, x.totalGratuitas, x.totalCobradas, br(x.valorACobrar), br(x.custoAbsorvido)].join(';'));
  return '﻿' + [cab.join(';'), ...lin].join('\r\n');
}
