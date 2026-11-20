// Botão VOLTAR do celular (gesto/botão do Android, voltar do navegador) dentro do sistema Murade.
// Pedido do dono (20/11/2026): o voltar volta para a TELA ANTERIOR do sistema em vez de fechar o aplicativo;
// se houver algo aberto por cima (menu do celular, janela, Agente IA, cartão), o primeiro voltar fecha isso;
// na tela inicial o primeiro voltar só avisa "Aperte voltar de novo para sair".
// Aqui fica só a decisão (sem React e sem tocar no navegador), para poder ser testada. O hook useVoltarCelular usa isto.

export const TEXTO_AVISO_SAIR = 'Aperte voltar de novo para sair';
/** Tempo do aviso "aperte de novo": um segundo voltar dentro dele sai do aplicativo. */
export const JANELA_SAIR_MS = 2000;
/** Troca de tela logo depois de um voltar é redirecionamento da própria tela (ex.: tela restrita volta ao início): substitui, não empilha. */
export const JANELA_REDIRECIONAMENTO_MS = 600;

/** Estado que o sistema guarda em cada entrada do histórico do navegador. "base" marca a primeira entrada (a de sair do app). */
export interface EstadoVoltar {
  murade: true;
  tela: string;
  /** Posição da entrada no histórico do sistema (0 = base). */
  n: number;
  base?: true;
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Lê o estado do histórico; devolve null quando a entrada não é do sistema (ex.: criada por link com #). */
export function lerEstadoVoltar(estado: unknown): EstadoVoltar | null {
  if (!ehObjeto(estado) || estado.murade !== true || typeof estado.tela !== 'string' || !estado.tela) return null;
  const n = typeof estado.n === 'number' && Number.isInteger(estado.n) && estado.n >= 0 ? estado.n : 0;
  return estado.base === true ? { murade: true, tela: estado.tela, n, base: true } : { murade: true, tela: estado.tela, n };
}

/** Monta o estado de uma tela. Com "existente", preserva o que outra parte do app guardou na mesma entrada (ex.: roteador). */
export function criarEstadoVoltar(tela: string, n: number, base = false, existente?: unknown): Record<string, unknown> {
  const resto: Record<string, unknown> = {};
  if (ehObjeto(existente)) {
    for (const [k, v] of Object.entries(existente)) if (k !== 'murade' && k !== 'tela' && k !== 'base' && k !== 'n') resto[k] = v;
  }
  return base ? { ...resto, murade: true, tela, n, base: true } : { ...resto, murade: true, tela, n };
}

/**
 * Ao abrir o sistema (ou entrar depois do login): o que gravar na entrada atual do histórico.
 * - Entrada que já é uma tela do sistema (recarregou a página): só atualiza para a tela que está aberta agora.
 * - Senão (abriu agora): vira a entrada "base", marcada como tela inicial. A tela atual é empilhada por cima dela
 *   (decidirEmpilhar), de modo que o primeiro voltar nunca fecha o app de cara, e quem abriu direto numa tela
 *   interna volta para a tela inicial.
 */
export function estadoAoAbrir(atual: unknown, telaAtual: string, telaInicial: string): Record<string, unknown> {
  const lido = lerEstadoVoltar(atual);
  if (lido && !lido.base) return criarEstadoVoltar(telaAtual, lido.n, false, atual);
  return criarEstadoVoltar(telaInicial, 0, true, atual);
}

export type AcaoEmpilhar = 'nada' | 'empilhar' | 'substituir' | 'voltar';

/**
 * A tela mudou (menu, botão, Agente, ou o próprio voltar): o que fazer com o histórico do navegador.
 * Nunca empilha duas vezes a mesma tela (re-render não cria entrada nova).
 * "telaAnterior" = tela da entrada logo abaixo (quando conhecida e não é a base): se a pessoa usou o "Voltar" da própria
 * tela e foi para ela, o histórico do navegador volta junto ('voltar') em vez de crescer A → B → A.
 */
export function decidirEmpilhar(
  atual: unknown,
  telaAtual: string,
  opcoes: { logoAposVoltar?: boolean; telasSemHistorico?: readonly string[]; telaAnterior?: string | null } = {},
): AcaoEmpilhar {
  if (!telaAtual || opcoes.telasSemHistorico?.includes(telaAtual)) return 'nada';
  const lido = lerEstadoVoltar(atual);
  if (!lido) return 'substituir'; // entrada criada fora do sistema (link com #): passa a ser desta tela, sem sobrar entrada vazia
  if (lido.base) return 'empilhar'; // a entrada base nunca é trocada: é ela que segura o "aperte de novo para sair"
  if (lido.tela === telaAtual) return 'nada';
  if (opcoes.logoAposVoltar) return 'substituir'; // a tela redirecionou sozinha logo após o voltar: não cria laço
  if (opcoes.telaAnterior && opcoes.telaAnterior === telaAtual) return 'voltar';
  return 'empilhar';
}

export type DecisaoVoltar =
  | { tipo: 'ignorar' }
  | { tipo: 'nada' }
  | { tipo: 'fechar-por-cima' }
  | { tipo: 'ir-para-tela'; tela: string }
  | { tipo: 'ir-para-inicial' }
  | { tipo: 'avisar-sair' };

/** A pessoa apertou voltar (evento popstate): o navegador já foi para a entrada "estado". O que o sistema faz. */
export function decidirVoltar(entrada: { estado: unknown; telaAtual: string; telaInicial: string; temPorCima: boolean }): DecisaoVoltar {
  const lido = lerEstadoVoltar(entrada.estado);
  if (!lido) return { tipo: 'ignorar' }; // não é do sistema (ex.: troca de # por link): deixa o app tratar como já tratava
  if (entrada.temPorCima) return { tipo: 'fechar-por-cima' };
  if (lido.base) return entrada.telaAtual === entrada.telaInicial ? { tipo: 'avisar-sair' } : { tipo: 'ir-para-inicial' };
  if (lido.tela === entrada.telaAtual) return { tipo: 'nada' };
  return { tipo: 'ir-para-tela', tela: lido.tela };
}

/** Janela de diálogo achada na tela (fora do controle do App): só tenta fechar uma vez a mesma, para nunca prender a pessoa. */
export function deveTentarFecharDialogo(encontrado: unknown, ultimoTentado: unknown): boolean {
  return encontrado != null && encontrado !== ultimoTentado;
}

// ---- Coisas abertas por cima (menu do celular, janelas, painel da Agente, cartões) ----
// Cada componente registra aqui enquanto está aberto; o voltar fecha o último aberto.
type ItemPorCima = { id: number; fechar: () => void };
const pilhaPorCima: ItemPorCima[] = [];
let proximoIdPorCima = 1;

/** Registra algo aberto por cima; devolve a função que tira o registro (chamar ao fechar/desmontar). */
export function registrarPorCima(fechar: () => void): () => void {
  const item: ItemPorCima = { id: proximoIdPorCima++, fechar };
  pilhaPorCima.push(item);
  return () => {
    const i = pilhaPorCima.findIndex((x) => x.id === item.id);
    if (i >= 0) pilhaPorCima.splice(i, 1);
  };
}

export function quantosPorCima(): number {
  return pilhaPorCima.length;
}

/** Fecha o último aberto por cima. Ele sai da lista mesmo se não fechar de verdade (o próximo voltar segue em frente: sem laço). */
export function fecharUltimoPorCima(): boolean {
  const item = pilhaPorCima.pop();
  if (!item) return false;
  try { item.fechar(); } catch { /* fechar nunca pode travar o voltar */ }
  return true;
}
