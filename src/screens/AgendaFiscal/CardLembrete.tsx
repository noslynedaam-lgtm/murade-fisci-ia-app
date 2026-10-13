import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Building2, AlertCircle, Clock } from 'lucide-react';
import { ItemAgendaFiscal } from '../../types';

interface CardLembreteProps {
  item: ItemAgendaFiscal;
  onPress?: (item: ItemAgendaFiscal) => void;
  key?: string | number;
}

export default function CardLembrete({ item, onPress }: CardLembreteProps) {
  const getBorderColor = () => {
    switch (item.status.texto) {
      case 'VENCIDO':
        return 'border-l-rose-600';
      case 'HOJE':
        return 'border-l-rose-500';
      case 'URGENTE':
        return 'border-l-amber-500';
      case 'ATENÇÃO':
        return 'border-l-amber-400';
      default:
        return 'border-l-emerald-600';
    }
  };

  const getStatusBadge = () => {
    switch (item.status.texto) {
      case 'VENCIDO':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'HOJE':
        return 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse';
      case 'URGENTE':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'ATENÇÃO':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div
      onClick={() => onPress?.(item)}
      className={`bg-white rounded-xl p-4 sm:p-5 border border-slate-200 border-l-4 ${getBorderColor()} shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}
    >
      {/* Lado Esquerdo */}
      <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
        <span className="text-2xl shrink-0 select-none p-1.5 bg-slate-50 rounded-lg border border-slate-100">
          {item.status.icone}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <h4 className="text-sm font-bold text-slate-900 truncate">
              {item.empresa}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50/70 px-2 py-0.5 rounded border border-indigo-100">
              {item.tipo}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              CNPJ: {item.cnpj}
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Vencimento: <strong>{format(new Date(item.dataVencimento), "dd/MM/yyyy (EEEE)", { locale: ptBR })}</strong></span>
          </p>
        </div>
      </div>

      {/* Lado Direito */}
      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 gap-1.5">
        <span
          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${getStatusBadge()} flex items-center gap-1`}
        >
          {item.status.texto}
        </span>

        <div className="text-xs font-medium text-slate-600 flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>
            {item.diasParaVencer === 0 ? (
              <strong className="text-rose-600 font-bold">VENCE HOJE!</strong>
            ) : item.diasParaVencer < 0 ? (
              <span className="text-rose-600 font-semibold">{Math.abs(item.diasParaVencer)} dias atrasado</span>
            ) : (
              <span>Faltam <strong>{item.diasParaVencer}</strong> dias</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
