import React, { useState } from 'react';
import { MousePointerClick, CheckCircle2, Navigation } from 'lucide-react';
import { AlvoClique } from '../types';

interface IndicadorSetaCliqueProps {
  alvo: AlvoClique;
  modo: 'mobile' | 'pc';
  onCliqueAlvo?: () => void;
}

export default function IndicadorSetaClique({ alvo, modo, onCliqueAlvo }: IndicadorSetaCliqueProps) {
  const [clicado, setClicado] = useState(false);

  const posicao = modo === 'mobile' ? alvo.posicaoMobile : alvo.posicaoPC;
  const direcao = posicao.direcaoSeta || 'cima';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setClicado(true);
    if (onCliqueAlvo) {
      onCliqueAlvo();
    }
    setTimeout(() => {
      setClicado(false);
    }, 1800);
  };

  // Rotação da seta baseada na direção
  const getRotacaoSeta = () => {
    switch (direcao) {
      case 'baixo':
        return 'rotate-180';
      case 'esquerda':
        return '-rotate-90';
      case 'direita':
        return 'rotate-90';
      case 'cima':
      default:
        return 'rotate-0';
    }
  };

  return (
    <div
      style={{ top: posicao.top, left: posicao.left }}
      className="absolute -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-auto select-none transition-all duration-300"
      onClick={handleClick}
    >
      {/* PONTO CENTRAL COM ANEL PULSANTE DE RADAR */}
      <div className="relative flex flex-col items-center group cursor-pointer">
        {/* Anel Pulsante (Ping) */}
        <span className="absolute -top-1 w-8 h-8 rounded-full bg-amber-400 opacity-75 animate-ping" />
        <span className="absolute -top-0.5 w-6 h-6 rounded-full bg-amber-500 opacity-50 animate-pulse" />

        {/* Hotspot Central */}
        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 border-2 border-slate-950 shadow-lg relative z-10 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
        </div>

        {/* SETA ANIMADA APONTANDO */}
        <div className={`mt-1 flex flex-col items-center animate-bounce ${getRotacaoSeta()}`}>
          <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[12px] border-b-amber-400 drop-shadow-md" />
          <div className="w-2.5 h-4 bg-amber-400 rounded-b-xs shadow-xs" />
        </div>

        {/* BADGE EXPLICATIVO FLUTUANTE (CLIQUE AQUI) */}
        <div className="mt-2 bg-slate-950/95 border-2 border-amber-400 text-white px-2.5 py-1 rounded-xl shadow-2xl flex items-center gap-1.5 backdrop-blur-md whitespace-nowrap min-w-max animate-in fade-in zoom-in-95 duration-200">
          {clicado ? (
            <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-black">
              <CheckCircle2 className="w-3.5 h-3.5 animate-spin" />
              <span>✓ Clicado com sucesso!</span>
            </div>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black text-[10px] shrink-0">
                {alvo.passoNumero}
              </div>
              <div className="text-left">
                <div className="text-[10px] text-amber-300 font-black uppercase tracking-wider flex items-center gap-1">
                  <MousePointerClick className="w-3 h-3 text-amber-400 animate-pulse" />
                  <span>👉 CLIQUE AQUI:</span>
                </div>
                <div className="text-[11px] font-extrabold text-white leading-tight">
                  {alvo.textoAcao}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Dica da Ação */}
        {!clicado && alvo.explicacaoClique && (
          <div className="hidden group-hover:block absolute top-full mt-1 bg-amber-950/90 border border-amber-500/40 text-amber-200 text-[10px] px-2 py-1 rounded-lg shadow-xl max-w-xs text-center z-50">
            {alvo.explicacaoClique}
          </div>
        )}
      </div>
    </div>
  );
}
