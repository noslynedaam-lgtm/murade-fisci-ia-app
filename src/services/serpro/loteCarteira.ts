/**
 * "Consultar a carteira" em lote: a pessoa escolhe as empresas e o tipo, vê ANTES quanto vai custar e quanto entra na cota grátis
 * da semana, confirma, e o sistema faz uma consulta por vez pela rota normal (que confere de novo cota, custo e liberação).
 * Esta peça só calcula a estimativa; não consulta nada.
 */
import { CATALOGO_SERVICOS } from './integraContador';
import { avaliarCota, decidirConsulta, registrarConsulta, type CotaEmpresa } from './cotaSemanal';
import { PRECO_POR_OPERACAO, VALOR_CONSULTA_COBRADA } from './consumoSerpro';

export const SERVICOS_LOTE = ['situacaoFiscal', 'caixaPostalNovas'] as const;
export type ServicoLote = typeof SERVICOS_LOTE[number];
export const ehServicoLote = (v: unknown): v is ServicoLote => typeof v === 'string' && (SERVICOS_LOTE as readonly string[]).includes(v);
export const LIMITE_EMPRESAS_LOTE = 200;

export interface EmpresaLote { id: string; nome: string; cnpj: string; cota: CotaEmpresa; liberada: boolean }
export interface ItemLote { companyId: string; nome: string; cnpj: string; servico: ServicoLote; descricao: string; liberada: boolean; cobrada: boolean; valor: number }

/** Custo mínimo do Serpro por consulta (tabela do contrato). A situação fiscal faz no mínimo 2 chamadas: protocolo (Apoiar) e relatório (Emitir). */
export function custoSerproMinimo(servico: ServicoLote): number {
  if (servico === 'situacaoFiscal') return PRECO_POR_OPERACAO.Apoiar + PRECO_POR_OPERACAO.Emitir;
  return PRECO_POR_OPERACAO[CATALOGO_SERVICOS[servico].operacao];
}

/** Simula, na ordem em que vão rodar, quais consultas entram na cota grátis da semana e quais serão cobradas. */
export function estimarLote(empresas: EmpresaLote[], servicos: ServicoLote[], agora = new Date()) {
  const itens: ItemLote[] = [];
  const cotas: { companyId: string; nome: string; gratisRestante: number; novaGratisEm: string }[] = [];
  for (const e of empresas) {
    let cota = e.cota;
    const st = avaliarCota(cota, agora);
    cotas.push({ companyId: e.id, nome: e.nome, gratisRestante: st.gratisRestante, novaGratisEm: st.novaGratisEm });
    for (const s of servicos) {
      if (!e.liberada) { itens.push({ companyId: e.id, nome: e.nome, cnpj: e.cnpj, servico: s, descricao: CATALOGO_SERVICOS[s].descricao, liberada: false, cobrada: false, valor: 0 }); continue; }
      const d = decidirConsulta(cota, true, agora);
      const cobrada = d.liberada ? d.cobrada : true;
      cota = registrarConsulta(cota, cobrada, s, agora);
      itens.push({ companyId: e.id, nome: e.nome, cnpj: e.cnpj, servico: s, descricao: CATALOGO_SERVICOS[s].descricao, liberada: true, cobrada, valor: cobrada ? VALOR_CONSULTA_COBRADA : 0 });
    }
  }
  const validos = itens.filter((i) => i.liberada);
  const cobradas = validos.filter((i) => i.cobrada);
  return {
    itens, cotas,
    totais: {
      consultas: validos.length, gratis: validos.length - cobradas.length, cobradas: cobradas.length,
      valorTotal: Math.round(cobradas.reduce((s, i) => s + i.valor, 0) * 100) / 100,
      naoLiberadas: itens.length - validos.length,
      custoSerproMinimo: Math.round(validos.reduce((s, i) => s + custoSerproMinimo(i.servico), 0) * 100) / 100,
    },
  };
}
