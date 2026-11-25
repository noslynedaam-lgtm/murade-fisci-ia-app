// ==========================================================
// 🎤 IA MURAD — SERVIÇO DE VOZ NATURAL HUMANA & ELEVENLABS
// ==========================================================

export interface ConfigVozMurad {
  voiceId: string;
}

import { registrarParador } from '../../utils/agenteParar';
import { aplicarVozNatural, textoParaFala } from '../../utils/vozHumana';

// v2: todos voltam para a voz grátis do aparelho (a v1 vinha com voz paga como padrão).
const STORAGE_KEY = 'murade_ia_voz_config_v2';
try { if (typeof localStorage !== 'undefined') localStorage.removeItem('murade_ia_voz_config_v1'); } catch { /* ignora */ }

export const VOZES_PREDEFINIDAS = [
  { id: 'native_pt_br', nome: 'Voz grátis do aparelho (a mais natural, escolhida em Voz da assistente)', tipo: 'Navegador' },
  { id: '21m00Tcm4TlvDq8ikWAM', nome: 'Voz Brasileira Natural (Feminina Suave)', tipo: 'ElevenLabs' },
  { id: 'AZnzlk1XvdvUeBnXmlld', nome: 'Voz Executiva Murad (Masculina Clara)', tipo: 'ElevenLabs' },
  { id: 'EXAVITQu4vr4xnSDxMaL', nome: 'Voz Contadora Amigável (Feminina)', tipo: 'ElevenLabs' },
];

export function obterConfigVoz(): ConfigVozMurad {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo) {
      const config = JSON.parse(salvo) as Partial<ConfigVozMurad> & { apiKeyElevenLabs?: string };
      // Chaves guardadas por versões antigas ficam descartadas; credenciais pertencem ao servidor.
      if (config.apiKeyElevenLabs) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(CONFIG_VOZ_PADRAO));
      }
      return { ...CONFIG_VOZ_PADRAO, voiceId: config.voiceId || CONFIG_VOZ_PADRAO.voiceId };
    }
  } catch (e) {
    console.error('Erro ao ler config de voz:', e);
  }

  return CONFIG_VOZ_PADRAO;
}

// Padrão: voz grátis do aparelho. A voz paga (ElevenLabs) só se a pessoa escolher e o dono ligar VOZ_PREMIUM no servidor.
const CONFIG_VOZ_PADRAO: ConfigVozMurad = { voiceId: 'native_pt_br' };

export function salvarConfigVoz(config: Partial<ConfigVozMurad>): ConfigVozMurad {
  const atual = obterConfigVoz();
  const novo: ConfigVozMurad = { ...atual, ...config };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novo));
  } catch (e) {
    console.error('Erro ao salvar config de voz:', e);
  }
  return novo;
}

/**
 * Reproduz áudio com fala humana brasileira.
 * Usa a chave do servidor para solicitar áudio premium; sem configuração, usa a voz nativa do navegador.
 */
export async function falarTextoNatural(
  texto: string,
  onInicio?: () => void,
  onFim?: () => void,
  onError?: (err: any) => void
): Promise<void> {
  const config = obterConfigVoz();

  if (config.voiceId !== 'native_pt_br') {
    try {
      const resposta = await fetch('/api/voz/sintetizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, vozId: config.voiceId })
      });

      if (!resposta.ok) {
        const erro = await resposta.json().catch(() => ({}));
        throw new Error(erro.erro || `Síntese indisponível (${resposta.status}).`);
      }

      const audioBlob = await resposta.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioAtual = audio;
      onInicio?.();

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        audioAtual = null;
        onFim?.();
      };

      audio.onerror = (e) => {
        URL.revokeObjectURL(audioUrl);
        audioAtual = null;
        console.warn('Erro ao tocar áudio ElevenLabs, usando fallback nativo:', e);
        fallbackNativo(texto, onInicio, onFim, onError);
      };

      await audio.play();
      return;
    } catch (erro) {
      console.warn('Falha no ElevenLabs, utilizando síntese vocal nativa brasileira:', erro);
      onError?.(erro);
    }
  }

  // Fallback / Modo nativo brasileiro
  fallbackNativo(texto, onInicio, onFim, onError);
}

let timerFalaNativa: ReturnType<typeof setTimeout> | null = null;
let audioAtual: HTMLAudioElement | null = null;

function fallbackNativo(
  texto: string,
  onInicio?: () => void,
  onFim?: () => void,
  onError?: (err: any) => void
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onError?.(new Error('Navegador sem suporte a síntese de voz.'));
    return;
  }

  // Limpa agendamento pendente anterior
  if (timerFalaNativa) {
    clearTimeout(timerFalaNativa);
    timerFalaNativa = null;
  }

  try {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
  } catch (e) {
    // Ignora erro em cancelamento prévio
  }

  // Pequeno timeout para permitir que o motor de áudio Chromium/WebKit libere a fila
  timerFalaNativa = setTimeout(() => {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      // Garante despausa no Chrome caso o motor esteja travado
      window.speechSynthesis.resume();

      // Mesma voz natural da Agente (a pt-BR mais natural do aparelho ou a escolhida em "Voz da assistente").
      const utterance = aplicarVozNatural(new SpeechSynthesisUtterance(textoParaFala(texto) || texto));

      utterance.onstart = () => {
        onInicio?.();
      };

      utterance.onend = () => {
        onFim?.();
      };

      utterance.onerror = (e: any) => {
        const erroCodigo = e?.error;
        // Cancelamento intencional ou interrupção (usuário clicou parar ou nova frase)
        if (erroCodigo === 'canceled' || erroCodigo === 'interrupted') {
          onFim?.();
          return;
        }

        console.warn('Aviso na síntese de voz nativa:', erroCodigo || e);
        onFim?.();
        onError?.(e);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Falha ao acionar síntese vocal:', err);
      onFim?.();
      onError?.(err);
    }
  }, 40);
}

// A central do "para" (dito, digitado, botão PARAR ou Esc) também corta esta voz.
registrarParador({
  id: 'voz-ia-murad',
  ativo: () => audioAtual !== null && !audioAtual.paused,
  parar: () => { const tocava = audioAtual !== null || timerFalaNativa !== null; pararVoz(); return tocava ? {} : false; },
});

export function pararVoz() {
  if (audioAtual) {
    audioAtual.pause();
    audioAtual.src = '';
    audioAtual = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    if (timerFalaNativa) {
      clearTimeout(timerFalaNativa);
      timerFalaNativa = null;
    }
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      // Ignora erro ao cancelar
    }
  }
}
