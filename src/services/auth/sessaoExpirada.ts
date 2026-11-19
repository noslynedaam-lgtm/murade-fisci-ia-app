/**
 * Tratamento central de sessão expirada (HTTP 401).
 *
 * Regras: 401 nunca apaga dado local (empresas, XMLs, certificados) e nunca é
 * mostrado como "0 empresas". O app só troca para a tela de login com aviso.
 * Esta função não altera a duração da sessão (90 dias no celular).
 */
export const EVENTO_SESSAO_EXPIRADA = 'fiscoia_sessao_expirada';
export const MENSAGEM_SESSAO_EXPIRADA =
  'Sua sessão acabou. Entre de novo para continuar. Nenhuma empresa nem documento foi apagado.';

/** Intervalo entre rechecagens automáticas da sessão enquanto a aba está aberta. */
export const INTERVALO_RECHECAGEM_MS = 4 * 60 * 1000;
/** Tempo mínimo de aba escondida para recarregar os dados ao voltar o foco. */
export const ESCONDIDA_MINIMO_MS = 30 * 1000;

export class ErroSessaoExpirada extends Error {
  readonly sessaoExpirada = true;
  constructor(mensagem: string = MENSAGEM_SESSAO_EXPIRADA) {
    super(mensagem);
    this.name = 'ErroSessaoExpirada';
  }
}

export function ehErroSessaoExpirada(erro: unknown): erro is ErroSessaoExpirada {
  return erro instanceof ErroSessaoExpirada;
}

/** 401 = sessão inválida/expirada. 403 = sem permissão (sessão válida): NÃO é expiração. */
export function statusIndicaSessaoExpirada(status: number): boolean {
  return status === 401;
}

/** Avisa o App (uma única vez por rajada) que alguma chamada recebeu 401. */
let ultimoAviso = 0;
export function avisarSessaoExpirada(agora: number = Date.now()): void {
  if (typeof window === 'undefined') return;
  if (agora - ultimoAviso < 1000) return;
  ultimoAviso = agora;
  window.dispatchEvent(new CustomEvent(EVENTO_SESSAO_EXPIRADA));
}

export type AcaoSessao = 'sessao_valida' | 'sessao_expirada' | 'indisponivel';

/**
 * Decide o que fazer com o resultado de validarSessaoCentral():
 * - autenticado -> sessão válida (recarregar dados);
 * - não autenticado e sem mensagem de erro (401 limpo) -> expirada (mostrar login);
 * - não autenticado com mensagem (rede/servidor fora) -> indisponível: NÃO derruba o usuário.
 */
export function decidirAcaoSessao(resultado: { autenticado: boolean; mensagem?: string }): AcaoSessao {
  if (resultado.autenticado) return 'sessao_valida';
  return resultado.mensagem ? 'indisponivel' : 'sessao_expirada';
}

export type EstadoLista = 'ok' | 'sessao_expirada' | 'erro';

/** Falha ao carregar a lista central nunca vira lista vazia silenciosa. */
export function classificarFalhaLista(erro: unknown): EstadoLista {
  return ehErroSessaoExpirada(erro) ? 'sessao_expirada' : 'erro';
}

/** Decide se a rechecagem periódica/de foco deve rodar agora. */
export function deveRechecarSessao(p: {
  agora: number;
  ultimaChecagem: number;
  abaVisivel: boolean;
  motivo: 'foco' | 'intervalo';
  escondidaDesde?: number | null;
}): boolean {
  if (!p.abaVisivel) return false;
  if (p.motivo === 'intervalo') return p.agora - p.ultimaChecagem >= INTERVALO_RECHECAGEM_MS - 1000;
  const tempoEscondida = p.escondidaDesde != null ? p.agora - p.escondidaDesde : Infinity;
  return tempoEscondida >= ESCONDIDA_MINIMO_MS || p.agora - p.ultimaChecagem >= ESCONDIDA_MINIMO_MS;
}
