import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAppNavigation } from '../context/NavigationContext';

interface BotaoVoltarProps {
  cor?: string;
  onVoltar?: () => void;
  className?: string;
  mostrarTexto?: boolean;
}

export default function BotaoVoltar({ 
  cor = '#1a237e', 
  onVoltar,
  className = '',
  mostrarTexto = true
}: BotaoVoltarProps) {
  const { voltar, podeVoltar } = useAppNavigation();

  const handleClique = () => {
    if (onVoltar) {
      onVoltar();
    } else {
      voltar();
    }
  };

  return (
    <button
      type="button"
      id="btn-voltar-navegacao"
      onClick={handleClique}
      style={{ color: cor }}
      className={`inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl hover:bg-black/5 active:scale-95 transition-all cursor-pointer select-none font-semibold text-[15px] z-30 group ${className}`}
      title="Voltar para a tela anterior"
    >
      <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5 stroke-[2.5]" />
      {mostrarTexto && <span>Voltar</span>}
    </button>
  );
}
