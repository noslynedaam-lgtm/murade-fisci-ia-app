// Conferência (radar) das notas de uma empresa: aponta o que não bate entre o
// acervo do Fisco IA, o Murade Fiscal e a própria chave de acesso. Só devolve
// ocorrências verificáveis; nunca preenche valores ausentes.

export type Direcao = 'SAIDA' | 'ENTRADA';
export type Severidade = 'ERRO' | 'ATENCAO' | 'INFO';

export interface DocumentoConferencia {
  chave: string;
  direcao: Direcao | null;
  emissao: string | null; // AAAA-MM-DD
  valor: number | null;
  status: string | null;
}

export interface DocumentoFiscalResumo {
  chave: string;
  emissao: string | null;
  valor: number | null;
  status: string | null;
}

export interface OcorrenciaConferencia {
  codigo:
    | 'CHAVE_INVALIDA'
    | 'EMITENTE_DIVERGE'
    | 'DATA_DIVERGE_CHAVE'
    | 'LACUNA_NUMERACAO'
    | 'FALTA_NO_FISCO_IA'
    | 'FALTA_NO_FISCAL'
    | 'VALOR_DIVERGENTE'
    | 'STATUS_DIVERGENTE'
    | 'AGUARDANDO_CONFIRMACAO';
  severidade: Severidade;
  mensagem: string;
  chaves: string[];
}

export interface ResultadoConferencia {
  resumo: { documentos: number; saidas: number; entradas: number; valorTotal: number; comparadoComFiscal: boolean };
  ocorrencias: OcorrenciaConferencia[];
}

const MAX_CHAVES_POR_OCORRENCIA = 50;
const MAX_NUMEROS_LACUNA = 500;
const STATUS_NAO_VALIDOS = /cancel|deneg|inutil/i;

function partesChave(chave: string) {
  if (!/^[0-9]{44}$/.test(chave)) return null;
  return {
    aamm: chave.slice(2, 6),
    cnpj: chave.slice(6, 20),
    modelo: chave.slice(20, 22),
    serie: chave.slice(22, 25),
    numero: Number(chave.slice(25, 34)),
  };
}

function limitar(chaves: string[]): string[] {
  return chaves.slice(0, MAX_CHAVES_POR_OCORRENCIA);
}

function faixas(numeros: number[]): string {
  const partes: string[] = [];
  let inicio = numeros[0];
  let anterior = numeros[0];
  for (const n of numeros.slice(1).concat([Number.NaN])) {
    if (n === anterior + 1) { anterior = n; continue; }
    partes.push(inicio === anterior ? String(inicio) : `${inicio}–${anterior}`);
    inicio = n;
    anterior = n;
  }
  return partes.join(', ');
}

export function conferirDocumentos(params: {
  cnpjEmpresa: string;
  documentos: DocumentoConferencia[];
  fiscal?: DocumentoFiscalResumo[] | null;
}): ResultadoConferencia {
  const { cnpjEmpresa, documentos } = params;
  const fiscal = params.fiscal ?? null;
  const ocorrencias: OcorrenciaConferencia[] = [];

  const invalidas: string[] = [];
  const emitenteDiverge: string[] = [];
  const dataDiverge: string[] = [];
  const pendentes: string[] = [];
  const gruposSaida = new Map<string, number[]>();

  for (const doc of documentos) {
    const partes = partesChave(doc.chave);
    if (!partes) { invalidas.push(doc.chave); continue; }
    if (doc.direcao === 'SAIDA') {
      if (partes.cnpj !== cnpjEmpresa) { emitenteDiverge.push(doc.chave); continue; }
      const grupo = `${partes.modelo}/${partes.serie}`;
      const lista = gruposSaida.get(grupo) ?? [];
      lista.push(partes.numero);
      gruposSaida.set(grupo, lista);
    }
    if (doc.emissao && /^\d{4}-\d{2}-\d{2}$/.test(doc.emissao)
      && `${doc.emissao.slice(2, 4)}${doc.emissao.slice(5, 7)}` !== partes.aamm) {
      dataDiverge.push(doc.chave);
    }
    if (doc.status === 'PENDING' || doc.status === 'PENDENTE') pendentes.push(doc.chave);
  }

  if (invalidas.length) {
    ocorrencias.push({ codigo: 'CHAVE_INVALIDA', severidade: 'ERRO', chaves: limitar(invalidas),
      mensagem: `${invalidas.length} nota(s) com chave de acesso que não tem 44 dígitos.` });
  }
  if (emitenteDiverge.length) {
    ocorrencias.push({ codigo: 'EMITENTE_DIVERGE', severidade: 'ERRO', chaves: limitar(emitenteDiverge),
      mensagem: `${emitenteDiverge.length} nota(s) de saída cuja chave não pertence ao CNPJ da empresa.` });
  }
  if (dataDiverge.length) {
    ocorrencias.push({ codigo: 'DATA_DIVERGE_CHAVE', severidade: 'ERRO', chaves: limitar(dataDiverge),
      mensagem: `${dataDiverge.length} nota(s) com data de emissão diferente do mês/ano da chave.` });
  }

  for (const [grupo, lista] of gruposSaida) {
    const numeros = [...new Set(lista)].sort((a, b) => a - b);
    if (numeros.length < 2) continue;
    const faltando: number[] = [];
    const existentes = new Set(numeros);
    for (let n = numeros[0] + 1; n < numeros[numeros.length - 1]; n += 1) {
      if (!existentes.has(n)) {
        faltando.push(n);
        if (faltando.length >= MAX_NUMEROS_LACUNA) break;
      }
    }
    if (faltando.length) {
      const [modelo, serie] = grupo.split('/');
      ocorrencias.push({ codigo: 'LACUNA_NUMERACAO', severidade: 'ATENCAO', chaves: [],
        mensagem: `Modelo ${modelo}, série ${Number(serie)}: faltam os números ${faixas(faltando)}${faltando.length >= MAX_NUMEROS_LACUNA ? ' (lista truncada)' : ''}. Pode ser nota ainda não baixada ou numeração inutilizada; confirme.` });
    }
  }

  if (pendentes.length) {
    ocorrencias.push({ codigo: 'AGUARDANDO_CONFIRMACAO', severidade: 'INFO', chaves: limitar(pendentes),
      mensagem: `${pendentes.length} nota(s) ainda aguardando confirmação oficial de situação.` });
  }

  if (fiscal) {
    const locais = new Map(documentos.map(doc => [doc.chave, doc]));
    const remotos = new Map(fiscal.map(doc => [doc.chave, doc]));
    const faltaAqui = [...remotos.keys()].filter(chave => !locais.has(chave));
    const faltaLa = [...locais.keys()].filter(chave => !remotos.has(chave));
    const valores: string[] = [];
    const status: string[] = [];
    for (const [chave, remoto] of remotos) {
      const local = locais.get(chave);
      if (!local) continue;
      if (remoto.valor != null && local.valor != null && Math.abs(remoto.valor - local.valor) > 0.009) valores.push(chave);
      if (remoto.status && STATUS_NAO_VALIDOS.test(remoto.status) && !(local.status && STATUS_NAO_VALIDOS.test(local.status))) status.push(chave);
    }
    if (faltaAqui.length) {
      ocorrencias.push({ codigo: 'FALTA_NO_FISCO_IA', severidade: 'ATENCAO', chaves: limitar(faltaAqui),
        mensagem: `${faltaAqui.length} nota(s) existem no Murade Fiscal e ainda não foram conferidas no Fisco IA.` });
    }
    if (faltaLa.length) {
      ocorrencias.push({ codigo: 'FALTA_NO_FISCAL', severidade: 'ATENCAO', chaves: limitar(faltaLa),
        mensagem: `${faltaLa.length} nota(s) estão no Fisco IA mas não aparecem no Murade Fiscal.` });
    }
    if (valores.length) {
      ocorrencias.push({ codigo: 'VALOR_DIVERGENTE', severidade: 'ERRO', chaves: limitar(valores),
        mensagem: `${valores.length} nota(s) com valor total diferente entre o Murade Fiscal e o Fisco IA.` });
    }
    if (status.length) {
      ocorrencias.push({ codigo: 'STATUS_DIVERGENTE', severidade: 'ERRO', chaves: limitar(status),
        mensagem: `${status.length} nota(s) canceladas, denegadas ou inutilizadas no Murade Fiscal, mas ainda válidas no Fisco IA.` });
    }
  }

  const ordem: Record<Severidade, number> = { ERRO: 0, ATENCAO: 1, INFO: 2 };
  ocorrencias.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);

  const centavos = documentos.reduce((soma, doc) => soma + Math.round((doc.valor ?? 0) * 100), 0);
  return {
    resumo: {
      documentos: documentos.length,
      saidas: documentos.filter(doc => doc.direcao === 'SAIDA').length,
      entradas: documentos.filter(doc => doc.direcao === 'ENTRADA').length,
      valorTotal: centavos / 100,
      comparadoComFiscal: fiscal !== null,
    },
    ocorrencias,
  };
}
