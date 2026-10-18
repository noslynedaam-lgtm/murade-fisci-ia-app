// ==========================================================
// 🎤 IA MURAD — SERVIÇO DE VOZ NATURAL HUMANA & ELEVENLABS
// ==========================================================

export interface ConfigVozMurad {
  voiceId: string;
}

const STORAGE_KEY = 'murade_ia_voz_config_v1';

export const VOZES_PREDEFINIDAS = [
  { id: '21m00Tcm4TlvDq8ikWAM', nome: 'Voz Brasileira Natural (Feminina Suave)', tipo: 'ElevenLabs' },
  { id: 'AZnzlk1XvdvUeBnXmlld', nome: 'Voz Executiva Murade (Masculina Clara)', tipo: 'ElevenLabs' },
  { id: 'EXAVITQu4vr4xnSDxMaL', nome: 'Voz Contadora Amigável (Feminina)', tipo: 'ElevenLabs' },
  { id: 'native_pt_br', nome: 'Voz Sintetizada Nativa do Navegador (PT-BR)', tipo: 'Navegador' }
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

const CONFIG_VOZ_PADRAO: ConfigVozMurad = { voiceId: '21m00Tcm4TlvDq8ikWAM' };

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

      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      // Busca voz brasileira disponível no sistema
      const selecionarVoz = (): SpeechSynthesisVoice | null => {
        const vozes = window.speechSynthesis.getVoices();
        return (
          vozes.find(v => v.lang === 'pt-BR' || v.lang === 'pt_BR') ||
          vozes.find(v => v.lang.toLowerCase().startsWith('pt')) ||
          null
        );
      };

      const vozBrasileira = selecionarVoz();
      if (vozBrasileira) {
        utterance.voice = vozBrasileira;
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          const v = selecionarVoz();
          if (v) utterance.voice = v;
        };
      }

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
