// ==========================================================
// 🎤 IA MURAD — SERVIÇO DE VOZ NATURAL HUMANA & ELEVENLABS
// ==========================================================

export interface ConfigVozMurad {
  apiKeyElevenLabs: string;
  voiceId: string;
  velocidade: number;
  planoAtivo: 'GRATIS' | 'BASICO' | 'PROFISSIONAL' | 'EMPRESA';
  caracteresUsadosMes: number;
  limiteCaracteres: number;
  chaveAtiva: boolean;
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
      return JSON.parse(salvo);
    }
  } catch (e) {
    console.error('Erro ao ler config de voz:', e);
  }

  return {
    apiKeyElevenLabs: '',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    velocidade: 1.0,
    planoAtivo: 'GRATIS',
    caracteresUsadosMes: 0,
    limiteCaracteres: 5000,
    chaveAtiva: false
  };
}

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
 * Se houver chave ElevenLabs, tenta consumir a API de alta fidelidade.
 * Se não houver ou falhar, utiliza Web Speech API com voz PT-BR nativa de alta clareza.
 */
export async function falarTextoNatural(
  texto: string,
  onInicio?: () => void,
  onFim?: () => void,
  onError?: (err: any) => void
): Promise<void> {
  const config = obterConfigVoz();

  // Se tiver chave ElevenLabs configurada
  if (config.apiKeyElevenLabs && config.apiKeyElevenLabs.trim().length > 10 && config.voiceId !== 'native_pt_br') {
    try {
      onInicio?.();
      const resposta = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': config.apiKeyElevenLabs.trim()
        },
        body: JSON.stringify({
          text: texto,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8
          }
        })
      });

      if (!resposta.ok) {
        throw new Error(`Erro ElevenLabs (${resposta.status}): ${await resposta.text()}`);
      }

      const audioBlob = await resposta.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        // Atualiza consumo de caracteres
        salvarConfigVoz({
          caracteresUsadosMes: config.caracteresUsadosMes + texto.length
        });
        onFim?.();
      };

      audio.onerror = (e) => {
        console.warn('Erro ao tocar áudio ElevenLabs, usando fallback nativo:', e);
        fallbackNativo(texto, onInicio, onFim, onError);
      };

      await audio.play();
      return;
    } catch (erro) {
      console.warn('Falha no ElevenLabs, utilizando síntese vocal nativa brasileira:', erro);
      // Fallback gracioso para a voz nativa do navegador
    }
  }

  // Fallback / Modo nativo brasileiro
  fallbackNativo(texto, onInicio, onFim, onError);
}

let timerFalaNativa: any = null;

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
