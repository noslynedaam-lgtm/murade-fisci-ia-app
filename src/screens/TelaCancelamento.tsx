import BotaoVoltar from '../components/BotaoVoltar';
import { AlertTriangle, CreditCard } from 'lucide-react';

interface NavigationLike {
  navigate?: (screen: string) => void;
  goBack?: () => void;
}

interface TelaCancelamentoProps {
  navigation?: NavigationLike;
  onVoltar?: () => void;
  /** Mantido por compatibilidade; não é chamado sem serviço de assinaturas. */
  onCancelamentoConcluido?: () => void;
}

export default function TelaCancelamento({ navigation, onVoltar }: TelaCancelamentoProps) {
  const executarVoltar = () => {
    if (onVoltar) onVoltar();
    else if (navigation?.goBack) navigation.goBack();
    else navigation?.navigate?.('Dashboard');
  };

  return (
    <div className="max-w-2xl mx-auto pb-16 px-4 sm:px-6">
      <div className="mb-4"><BotaoVoltar onVoltar={executarVoltar} /></div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
        <h1 className="text-xl font-extrabold text-slate-900">Gerenciar assinatura</h1>
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <h2 className="flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5" /> Serviço de assinaturas não conectado</h2>
          <p className="mt-2 text-sm">Não há uma assinatura centralizada consultável neste ambiente. Esta tela não confirma contrato, período de fidelidade nem cancelamento.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="flex items-center gap-2 font-semibold"><CreditCard className="h-4 w-4" /> Nenhum cancelamento foi enviado</p>
          <p className="mt-1">Não é possível alterar uma cobrança ou assinatura por esta tela.</p>
        </div>
        <button type="button" onClick={executarVoltar} className="w-full rounded-xl bg-indigo-700 px-4 py-3 font-bold text-white hover:bg-indigo-800">
          Voltar
        </button>
      </section>
    </div>
  );
}
