// Registro de funcionamento dos robôs do servidor do DP.
//
// Os robôs de verdade são as rotinas agendadas em server.ts. Este módulo só (1) impede que a mesma
// rotina rode duas vezes ao mesmo tempo e (2) guarda quando cada uma rodou pela última vez, para a
// IA e a tela mostrarem o estado real. Nada aqui inventa atividade: robô sem rotina agendada
// aparece como "aguardando configuração".

export type EstadoRobo = 'ativo' | 'parado' | 'aguardando_configuracao';

export interface DefinicaoRoboDP {
  id: string;
  nome: string;
  posto: 'coletor' | 'calculador' | 'conferidor' | 'integrador';
  missao: string;
  /** Intervalo da rotina, em ms. Ausente quando não há rotina agendada. */
  intervaloMs?: number;
  /** Explica por que o robô não tem rotina agendada. */
  motivoSemRotina?: string;
}

interface RegistroRobo extends DefinicaoRoboDP {
  executando: boolean;
  execucoes: number;
  falhas: number;
  puladasPorSobreposicao: number;
  ultimaExecucao: string | null;
  ultimaDuracaoMs: number | null;
  ultimoErro: string | null;
  ultimoErroEm: string | null;
}

const iniciadoEm = new Date();
const robos = new Map<string, RegistroRobo>();

export function registrarRobo(definicao: DefinicaoRoboDP): void {
  const existente = robos.get(definicao.id);
  if (existente) {
    Object.assign(existente, definicao);
    return;
  }
  robos.set(definicao.id, {
    ...definicao,
    executando: false,
    execucoes: 0,
    falhas: 0,
    puladasPorSobreposicao: 0,
    ultimaExecucao: null,
    ultimaDuracaoMs: null,
    ultimoErro: null,
    ultimoErroEm: null,
  });
}

/**
 * Executa a rotina do robô sem sobreposição. Se a rodada anterior ainda não terminou, esta é
 * pulada e contada. Erros ficam registrados e não derrubam o processo.
 */
export async function executarRobo<T>(id: string, rotina: () => Promise<T>): Promise<T | undefined> {
  const robo = robos.get(id);
  if (!robo) return rotina();
  if (robo.executando) {
    robo.puladasPorSobreposicao += 1;
    return undefined;
  }
  robo.executando = true;
  const inicio = Date.now();
  try {
    const resultado = await rotina();
    robo.execucoes += 1;
    return resultado;
  } catch (erro: any) {
    robo.falhas += 1;
    robo.ultimoErro = String(erro?.message || 'Falha sem mensagem.').slice(0, 300);
    robo.ultimoErroEm = new Date().toISOString();
    throw erro;
  } finally {
    robo.ultimaDuracaoMs = Date.now() - inicio;
    robo.ultimaExecucao = new Date().toISOString();
    robo.executando = false;
  }
}

function estadoDe(robo: RegistroRobo, agora: number): EstadoRobo {
  if (!robo.intervaloMs) return 'aguardando_configuracao';
  if (robo.executando) return 'ativo';
  if (!robo.ultimaExecucao) {
    // Recém-iniciado: dá tempo de três intervalos antes de considerar parado.
    return agora - iniciadoEm.getTime() <= robo.intervaloMs * 3 ? 'ativo' : 'parado';
  }
  return agora - Date.parse(robo.ultimaExecucao) <= robo.intervaloMs * 3 ? 'ativo' : 'parado';
}

export function statusRobos(agora = Date.now()) {
  return {
    servidor: {
      iniciadoEm: iniciadoEm.toISOString(),
      // Valor baixo indica que o serviço acabou de (re)iniciar, por exemplo ao acordar do plano gratuito.
      tempoLigadoSegundos: Math.floor((agora - iniciadoEm.getTime()) / 1000),
    },
    robos: [...robos.values()].map((robo) => ({
      id: robo.id,
      nome: robo.nome,
      posto: robo.posto,
      missao: robo.missao,
      estado: estadoDe(robo, agora),
      executando: robo.executando,
      intervaloSegundos: robo.intervaloMs ? Math.round(robo.intervaloMs / 1000) : null,
      ultimaExecucao: robo.ultimaExecucao,
      ultimaDuracaoMs: robo.ultimaDuracaoMs,
      execucoes: robo.execucoes,
      falhas: robo.falhas,
      puladasPorSobreposicao: robo.puladasPorSobreposicao,
      ultimoErro: robo.ultimoErro,
      ultimoErroEm: robo.ultimoErroEm,
      motivoSemRotina: robo.intervaloMs ? null : (robo.motivoSemRotina || null),
    })),
  };
}

/** Somente para testes. */
export function limparRobosParaTeste(): void {
  robos.clear();
}
