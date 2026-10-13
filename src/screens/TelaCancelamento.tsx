import React, { useState, useEffect } from 'react';
import BotaoVoltar from '../components/BotaoVoltar';
import { verificarCancelamento, obterDataContratacao, StatusCancelamento } from '../config/Fidelidade';
import { 
  ShieldAlert, ShieldCheck, Lock, Unlock, Calendar, 
  AlertCircle, CheckCircle2, ArrowLeft, RefreshCw 
} from 'lucide-react';

interface NavigationLike {
  navigate?: (screen: string) => void;
  goBack?: () => void;
}

interface TelaCancelamentoProps {
  navigation?: NavigationLike;
  onVoltar?: () => void;
  onCancelamentoConcluido?: () => void;
}

export default function TelaCancelamento({
  navigation,
  onVoltar,
  onCancelamentoConcluido
}: TelaCancelamentoProps) {
  const [dataContratacao, setDataContratacao] = useState<Date>(() => obterDataContratacao());
  const [status, setStatus] = useState<StatusCancelamento | null>(null);
  const [modalConfirmacao, setModalConfirmacao] = useState(false);
  const [cancelamentoEfetivado, setCancelamentoEfetivado] = useState(false);
  const [alertaBloqueio, setAlertaBloqueio] = useState<string | null>(null);

  useEffect(() => {
    const resultado = verificarCancelamento(dataContratacao);
    setStatus(resultado);
  }, [dataContratacao]);

  const executarVoltar = () => {
    if (onVoltar) {
      onVoltar();
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  const solicitarCancelamento = () => {
    if (!status?.podeCancelar) {
      setAlertaBloqueio(status?.mensagem || 'Período de fidelidade em vigor. Aguarde o prazo de 60 dias.');
      return;
    }

    setModalConfirmacao(true);
  };

  const confirmarCancelamento = () => {
    setModalConfirmacao(false);
    setCancelamentoEfetivado(true);
  };

  if (!status) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a237e]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-16 px-4 sm:px-6">
      {/* Seta de Voltar */}
      <div className="mb-4">
        <BotaoVoltar onVoltar={executarVoltar} />
      </div>

      <div className="text-center mb-8 space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1a237e] tracking-tight">
          ⚙️ Gerenciar Assinatura
        </h1>
        <p className="text-sm text-slate-600">
          Consulte o status do seu contrato e as condições de cancelamento do Fiscoia
        </p>
      </div>

      {cancelamentoEfetivado ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Cancelamento Solicitado com Sucesso
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Seu acesso aos módulos premium permanecerá ativo até o término do ciclo vigente. 
            Agradecemos por utilizar o Fiscoia!
          </p>
          <button
            type="button"
            onClick={() => {
              if (onCancelamentoConcluido) onCancelamentoConcluido();
              else executarVoltar();
            }}
            className="mt-4 px-6 py-3 bg-[#1a237e] text-white font-bold rounded-xl cursor-pointer hover:bg-[#283593] transition-all shadow-md"
          >
            Voltar ao Dashboard
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Caixa de Status — Bloqueado ou Liberado */}
          <div
            id="caixa-status-fidelidade"
            className={`rounded-2xl p-6 sm:p-8 border-2 transition-all text-center space-y-4 shadow-sm ${
              status.podeCancelar
                ? 'bg-[#e8f5e9] border-[#4caf50]'
                : 'bg-[#fff3e0] border-[#ff9800]'
            }`}
          >
            <div className="flex items-center justify-center">
              {status.podeCancelar ? (
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Unlock className="w-8 h-8" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-amber-100 text-[#e65100] flex items-center justify-center">
                  <Lock className="w-8 h-8" />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <h2 className={`text-lg sm:text-xl font-extrabold ${
                status.podeCancelar ? 'text-emerald-900' : 'text-[#e65100]'
              }`}>
                {status.podeCancelar ? '🔓 Cancelamento Liberado' : '🔒 Fidelidade de 60 Dias em Vigor'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-700 max-w-lg mx-auto leading-relaxed">
                {status.mensagem}
              </p>
            </div>

            {/* Informações detalhadas do período */}
            <div className="bg-white/80 rounded-xl p-4 text-xs sm:text-sm text-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-3 border border-black/5 text-left sm:text-center">
              <div>
                <span className="text-slate-500 block text-[11px] font-semibold uppercase">Data de Início</span>
                <strong className="text-slate-900 font-bold">
                  {status.dataContratacao.toLocaleDateString('pt-BR')}
                </strong>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px] font-semibold uppercase">Dias Decorridos</span>
                <strong className="text-slate-900 font-bold">
                  {status.diasPassados} de 60 dias
                </strong>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px] font-semibold uppercase">
                  {status.podeCancelar ? 'Liberado Em' : 'Liberação Em'}
                </span>
                <strong className="text-[#1a237e] font-bold">
                  {status.dataLiberacao.toLocaleDateString('pt-BR')}
                </strong>
              </div>
            </div>

            {/* Barra de Progresso da Fidelidade */}
            {!status.podeCancelar && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] font-bold text-amber-900">
                  <span>Início</span>
                  <span>Faltam {status.diasRestantes} dias</span>
                  <span>60 dias</span>
                </div>
                <div className="w-full h-3 bg-amber-200/80 rounded-full overflow-hidden p-0.5">
                  <div 
                    className="h-full bg-[#ff8f00] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round((status.diasPassados / 60) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Botão Cancelar Assinatura */}
          <div>
            <button
              type="button"
              id="btn-cancelar-assinatura"
              onClick={solicitarCancelamento}
              className={`w-full py-4 px-6 rounded-xl font-bold text-base sm:text-lg transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                status.podeCancelar
                  ? 'bg-[#c62828] hover:bg-[#b71c1c] text-white hover:shadow-lg'
                  : 'bg-[#9e9e9e] hover:bg-[#8d8d8d] text-white'
              }`}
            >
              {status.podeCancelar ? (
                <>
                  <Unlock className="w-5 h-5" />
                  <span>Cancelar Assinatura</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>🔒 Cancelamento Bloqueado (Fidelidade Ativa)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal de Alerta de Bloqueio */}
      {alertaBloqueio && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-amber-100 text-[#e65100] flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-extrabold text-[#e65100]">
              🔒 CANCELAMENTO BLOQUEADO
            </h3>

            <p className="text-sm text-slate-700 leading-relaxed">
              {alertaBloqueio}
            </p>

            <button
              type="button"
              onClick={() => setAlertaBloqueio(null)}
              className="w-full py-3 bg-[#1a237e] hover:bg-[#283593] text-white font-bold rounded-xl transition-all cursor-pointer shadow-md"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Cancelamento */}
      {modalConfirmacao && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-[#c62828] flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-extrabold text-slate-900">
              ⚠️ Confirmar Cancelamento?
            </h3>

            <p className="text-sm text-slate-600 leading-relaxed">
              Tem certeza? Seu período de fidelidade de 60 dias já foi cumprido. 
              Ao confirmar, seu acesso será encerrado ao final do ciclo pago atual.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalConfirmacao(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
              >
                Manter Assinatura
              </button>

              <button
                type="button"
                onClick={confirmarCancelamento}
                className="flex-1 py-3 bg-[#c62828] hover:bg-[#b71c1c] text-white font-bold rounded-xl transition-all cursor-pointer shadow-md"
              >
                Sim, Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
