import BotaoVoltar from '../components/BotaoVoltar';
import { AlertTriangle, CreditCard, ShieldCheck } from 'lucide-react';

interface NavigationLike {
  navigate?: (screen: string) => void;
  goBack?: () => void;
}

interface TelaContratacaoProps {
  navigation?: NavigationLike;
  onVoltar?: () => void;
  /** Mantido por compatibilidade; não é chamado sem uma contratação real. */
  onSucesso?: () => void;
  planoNome?: string;
  planoValor?: string;
}

export default function TelaContratacao({
  navigation,
  onVoltar,
  planoNome = 'Empresarial',
  planoValor = 'R$ 599,90/mês'
}: TelaContratacaoProps) {
  const executarVoltar = () => {
    if (onVoltar) onVoltar();
    else if (navigation?.goBack) navigation.goBack();
    else navigation?.navigate?.('Dashboard');
  };

  return (
    <div className="max-w-3xl mx-auto pb-16 px-4 sm:px-6">
      <div className="mb-4"><BotaoVoltar onVoltar={executarVoltar} /></div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-indigo-50 p-3 text-indigo-700"><ShieldCheck className="h-6 w-6" /></span>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Planos Murade</h1>
            <p className="text-sm text-slate-600">{planoNome} · valor de referência: {planoValor}</p>
          </div>
        </div>

        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <h2 className="flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5" /> Contratação online indisponível</h2>
          <p className="mt-2 text-sm">Este ambiente não está conectado a um provedor de pagamento ou serviço central de assinaturas. Nenhum plano foi contratado ou ativado, nenhuma cobrança foi feita e nenhum período de fidelidade foi iniciado.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="flex items-center gap-2 font-semibold"><CreditCard className="h-4 w-4" /> Sem processamento de pagamento</p>
          <p className="mt-1">Os limites e recursos não são alterados por esta tela. Os valores exibidos são apenas informativos.</p>
        </div>

        <button type="button" onClick={executarVoltar} className="w-full rounded-xl bg-indigo-700 px-4 py-3 font-bold text-white hover:bg-indigo-800">
          Voltar
        </button>
      </section>
    </div>
  );
}
