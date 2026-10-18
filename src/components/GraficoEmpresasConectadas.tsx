import { AlertTriangle, ArrowRight, Building2 } from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';

interface GraficoEmpresasConectadasProps {
  maxCnpjs: number;
  onNavegar: (aba: string) => void;
}

/** Mostra apenas empresas cadastradas. Não existe coleta de métricas de órgãos neste painel. */
export default function GraficoEmpresasConectadas({ maxCnpjs, onNavegar }: GraficoEmpresasConectadasProps) {
  const { empresas } = useEmpresa();
  const totalCadastradas = empresas.length;
  const percentualUso = maxCnpjs > 0 ? Math.min(100, Math.round((totalCadastradas / maxCnpjs) * 100)) : 0;

  return (
    <section id="grafico-empresas-conectadas" className="bg-white text-slate-900 rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-lg bg-indigo-50 text-indigo-700"><Building2 className="w-5 h-5" /></span>
          <div>
            <h2 className="text-sm font-bold">Empresas cadastradas neste navegador</h2>
            <p className="text-xs text-slate-500">O cadastro não indica conexão com SERPRO, e-CAC ou SEFAZ.</p>
          </div>
        </div>
        <button type="button" onClick={() => onNavegar('empresas')} className="text-xs font-bold px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-md border border-indigo-200 flex items-center gap-1">
          Ver empresas <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <div>
          <div className="flex items-baseline gap-2"><strong className="text-2xl">{totalCadastradas}</strong><span className="text-xs text-slate-500">de {maxCnpjs} do limite informado</span></div>
          <div className="text-xs text-slate-600 mt-1">{percentualUso}% do limite de cadastro</div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2"><div className="h-full bg-indigo-600 rounded-full" style={{ width: `${percentualUso}%` }} /></div>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Integrações governamentais e atividade automática não foram configuradas. Este painel não consulta nem sincroniza dados externos.</span>
        </div>
      </div>
    </section>
  );
}
