import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, VolumeX, Play, Pause, RotateCcw, 
  Sparkles, Radio, Headphones, Mic 
} from 'lucide-react';

interface ControladorAudioIAProps {
  textoParaFalar: string;
  tituloPedacinho: string;
  autoPlay?: boolean;
}

export default function ControladorAudioIA({
  textoParaFalar,
  tituloPedacinho,
  autoPlay = false
}: ControladorAudioIAProps) {
  const [estaFalando, setEstaFalando] = useState(false);
  const [estaMudo, setEstaMudo] = useState(false);
  const [velocidade, setVelocidade] = useState<number>(1.0);
  const [suporteVoz, setSuporteVoz] = useState(true);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Verifica suporte ao SpeechSynthesis
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSuporteVoz(false);
    }
  }, []);

  // Para qualquer áudio anterior ao trocar de texto
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setEstaFalando(false);
    }
  }, [textoParaFalar]);

  // Executa fala
  const falarTexto = (texto: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    if (estaMudo) return;

    try {
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'pt-BR';
      utterance.rate = velocidade;
      utterance.pitch = 1.0;

      // Tenta encontrar uma voz em português
      const vozes = window.speechSynthesis.getVoices();
      const vozPt = vozes.find(v => v.lang.includes('pt-BR') || v.lang.includes('pt'));
      if (vozPt) {
        utterance.voice = vozPt;
      }

      utterance.onstart = () => {
        setEstaFalando(true);
      };

      utterance.onend = () => {
        setEstaFalando(false);
      };

      utterance.onerror = () => {
        setEstaFalando(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Erro ao reproduzir voz sintética:', err);
      setEstaFalando(false);
    }
  };

  const pararFala = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setEstaFalando(false);
    }
  };

  const toggleMudo = () => {
    if (!estaMudo) {
      pararFala();
      setEstaMudo(true);
    } else {
      setEstaMudo(false);
      falarTexto(textoParaFalar);
    }
  };

  const alternarFala = () => {
    if (estaFalando) {
      pararFala();
    } else {
      falarTexto(textoParaFalar);
    }
  };

  return (
    <div className="bg-slate-900/95 border border-indigo-500/30 rounded-2xl p-3.5 sm:p-4 text-white shadow-xl space-y-3">
      {/* CABEÇALHO DO ÁUDIO DA IA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              estaFalando 
                ? 'bg-gradient-to-tr from-indigo-500 to-emerald-400 text-slate-950 shadow-md ring-2 ring-emerald-400/50' 
                : 'bg-slate-800 text-slate-300'
            }`}>
              <Sparkles className="w-5 h-5" />
            </div>
            {estaFalando && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-white tracking-tight">
                Voz da IA Explicando
              </span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                estaFalando ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
              }`}>
                {estaFalando ? 'Falando Agora 🎙️' : 'Pronto para Falar'}
              </span>
            </div>
            <p className="text-[11px] text-indigo-200 truncate max-w-xs sm:max-w-md">
              Capítulo: <strong>{tituloPedacinho}</strong>
            </p>
          </div>
        </div>

        {/* ONDAS SONORAS ANIMADAS QUANDO ESTIVER FALANDO */}
        {estaFalando && (
          <div className="flex items-center gap-1 px-3 py-1 bg-emerald-950/60 border border-emerald-500/30 rounded-xl">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <div className="flex items-end gap-0.5 h-4">
              <span className="w-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:0ms] h-3" />
              <span className="w-1 bg-emerald-300 rounded-full animate-bounce [animation-delay:150ms] h-4" />
              <span className="w-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms] h-2" />
              <span className="w-1 bg-emerald-200 rounded-full animate-bounce [animation-delay:100ms] h-4" />
              <span className="w-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:200ms] h-3" />
            </div>
            <span className="text-[10px] font-mono text-emerald-300 ml-1 font-bold">Áudio Ativo</span>
          </div>
        )}

        {/* CONTROLES DE REPRODUÇÃO DO ÁUDIO */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={alternarFala}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
              estaFalando
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
            title={estaFalando ? 'Pausar áudio' : 'Ouvir explicação falada'}
          >
            {estaFalando ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pausar Voz</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Ouvir com Áudio</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => falarTexto(textoParaFalar)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
            title="Repetir Explicação Falada"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={toggleMudo}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              estaMudo
                ? 'bg-rose-900/60 text-rose-300 border border-rose-600/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
            title={estaMudo ? 'Ativar Som' : 'Silenciar'}
          >
            {estaMudo ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* LEGENDA / SUBTÍTULO SINCRONIZADO COM A VOZ */}
      <div className="bg-slate-950/80 rounded-xl p-2.5 border border-white/10 text-xs flex items-start gap-2.5">
        <Headphones className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block mb-0.5">
            Transcrição da Fala da IA (Siga a seta na tela):
          </span>
          <p className="text-slate-200 text-xs leading-relaxed italic">
            &quot;{textoParaFalar}&quot;
          </p>
        </div>
      </div>
    </div>
  );
}
