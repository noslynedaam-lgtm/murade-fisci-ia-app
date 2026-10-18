import { lerNotasFiscaisEmpresa, NotasFiscaisEmpresa, NotaFiscalItem } from './fiscoiaFiscal.service';
import { NotaRadar, validarListaNotasRadar } from './radarFiscal.service';

function chavesArmazenamentoEmpresa(empresaId: string, cnpj?: string): string[] {
  return [...new Set([empresaId, cnpj].map(valor => String(valor || '').trim()).filter(Boolean))];
}

function mesclarSemDuplicarEntreFontes<T>(atuais: T[], legadas: T[], identificador: (item: T) => string): T[] {
  const identificadoresAtuais = new Set(atuais.map(identificador));
  // Dedupe somente contra a fonte atual. Duplicatas internas de cada fonte
  // continuam visíveis para que o Radar possa apontá-las ao contador.
  return [...atuais, ...legadas.filter(item => !identificadoresAtuais.has(identificador(item)))];
}

function identificadorNota(item: NotaFiscalItem): string {
  return item.chave
    ? `chave:${item.chave}`
    : `sem-chave:${item.tipo}:${item.numero}:${item.serie}:${item.dataEmissao}:${item.origemArquivo || ''}`;
}

function usarChaveLegada(tipo: 'radar' | 'livro', empresaId: string): boolean {
  try { return localStorage.getItem(`fiscoia_migracao_${tipo}_cnpj_${empresaId}`) !== '1'; } catch { return true; }
}

export function marcarMigracaoRadarCnpjConcluida(empresaId: string): boolean {
  try { localStorage.setItem(`fiscoia_migracao_radar_cnpj_${empresaId}`, '1'); return true; } catch { return false; }
}

export function marcarMigracaoLivroCnpjConcluida(empresaId: string): boolean {
  try { localStorage.setItem(`fiscoia_migracao_livro_cnpj_${empresaId}`, '1'); return true; } catch { return false; }
}

export type ResultadoRadarEmpresa = {
  notas: NotaRadar[];
  erro?: string;
  existeFonte: boolean;
  fonteChave?: string;
};

/** Lê e combina o Radar atual e o legado, priorizando o registro atual em conflitos. */
export function lerRadarFiscalEmpresa(empresaId: string, cnpj?: string): ResultadoRadarEmpresa {
  const chaves = chavesArmazenamentoEmpresa(empresaId, usarChaveLegada('radar', empresaId) ? cnpj : undefined);
  const leituras: Array<{ chave: string; notas: NotaRadar[] }> = [];
  for (const chave of chaves) {
    try {
      const bruto = localStorage.getItem(`fiscoia_radar_xml_${chave}`);
      if (bruto === null) continue;
      const notas = validarListaNotasRadar(JSON.parse(bruto));
      leituras.push({ chave, notas });
    } catch {
      return { notas: [], erro: 'não foi possível ler a lista do Radar', existeFonte: false };
    }
  }
  const atuais = leituras.find(leitura => leitura.chave === empresaId)?.notas ?? [];
  const legado = leituras.find(leitura => leitura.chave !== empresaId);
  const notas = mesclarSemDuplicarEntreFontes(atuais, legado?.notas ?? [], item => item.chave || `sem-chave:${item.tipo}:${item.numero}:${item.serie}:${item.dataEmissao}:${item.origemArquivo}`);
  const legadoComDados = Boolean(legado?.notas.length);
  return {
    notas,
    existeFonte: notas.length > 0,
    ...(legadoComDados ? { fonteChave: legado!.chave } : {})
  };
}

/** Lê e combina o livro atual e o legado sem converter falhas em listas vazias. */
export function lerLivroFiscalEmpresa(empresaId: string, cnpj?: string): { notas: NotasFiscaisEmpresa; erro?: string; existeFonte: boolean; fonteChave?: string } {
  const chaves = chavesArmazenamentoEmpresa(empresaId, usarChaveLegada('livro', empresaId) ? cnpj : undefined);
  const leituras: Array<{ chave: string; notas: NotasFiscaisEmpresa }> = [];
  for (const chave of chaves) {
    const leitura = lerNotasFiscaisEmpresa(chave);
    if ('erro' in leitura) return { notas: { saidas: [], entradas: [] }, erro: leitura.erro, existeFonte: false };
    leituras.push({ chave, notas: leitura.notas });
  }
  const atuais = leituras.find(leitura => leitura.chave === empresaId)?.notas ?? { saidas: [], entradas: [] };
  const legado = leituras.find(leitura => leitura.chave !== empresaId);
  const combinar = (atuaisLista: NotaFiscalItem[], legadaLista: NotaFiscalItem[]) =>
    mesclarSemDuplicarEntreFontes(atuaisLista, legadaLista, identificadorNota);
  const notas = {
    saidas: combinar(atuais.saidas, legado?.notas.saidas ?? []),
    entradas: combinar(atuais.entradas, legado?.notas.entradas ?? [])
  };
  const legadoComDados = Boolean(legado && (legado.notas.saidas.length || legado.notas.entradas.length));
  return {
    notas,
    existeFonte: notas.saidas.length > 0 || notas.entradas.length > 0,
    ...(legadoComDados ? { fonteChave: legado!.chave } : {})
  };
}
