import { useState } from 'react';
import { 
  Check, Sparkles, Building2, CreditCard, QrCode, FileText, 
  ArrowRight, Zap, ShieldCheck 
} from 'lucide-react';
import { PLANOS } from '../config/planos';
import { PlanoConfig } from '../types';
import BotaoVoltar from '../components/BotaoVoltar';

interface PlanosAssinaturaProps {
  planoAtivoId: 'basico' | 'profissional' | 'empresarial' | string;
  onSelecionarPlano: (planoId: 'basico' | 'profissional' | 'empresarial') => void;
}

export default function PlanosAssinatura({ planoAtivoId, onSelecionarPlano }: PlanosAssinaturaProps) {
  const [frequencia, setFrequencia] = useState<'mensal' | 'anual'>('mensal');
  const [modalAberto, setModalAberto] = useState(false);
  const [planoEmCheckout, setPlanoEmCheckout] = useState<PlanoConfig | null>(null);
  const [metodoPagamento, setMetodoPagamento] = useState<'pix' | 'cartao' | 'boleto'>('pix');
  const [pagamentoConcluido, setPagamentoConcluido] = useState(false);

  const iniciarAssinatura = (plano: PlanoConfig) => {
    setPlanoEmCheckout(plano);
    setPagamentoConcluido(false);
    setModalAberto(true);
  };

  const confirmarPagamento = () => {
    if (planoEmCheckout) {
      onSelecionarPlano(planoEmCheckout.id);
      setPagamentoConcluido(true);
      setTimeout(() => {
        setModalAberto(false);
        setPagamentoConcluido(false);
      }, 1500);
    }
  };

  return (
    <div id="planos-screen" className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <BotaoVoltar />
      </div>

      {/* Cabeçalho */}
      <div className="text-center space-y-3 pt-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-700" />
          <span>Administrado por MURADE — Compliance & Gestão</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1a237e] tracking-tight">
          Escolha seu Plano
        </h1>
        <p className="text-slate-600 text-base max-w-xl mx-auto">
          Faturamento {frequencia === 'mensal' ? 'Mensal' : 'Anual com Desconto'}
        </p>

        {/* Toggle de Faturamento */}
        <div className="pt-2 flex items-center justify-center">
          <div className="bg-[#e8eaf6] p-1 rounded-full border border-indigo-100 inline-flex items-center gap-1 shadow-xs">
            <button
              type="button"
              id="btn-faturamento-mensal"
              onClick={() => setFrequencia('mensal')}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                frequencia === 'mensal'
                  ? 'bg-white text-[#1a237e] shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              id="btn-faturamento-anual"
              onClick={() => setFrequencia('anual')}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                frequencia === 'anual'
                  ? 'bg-indigo-700 text-white shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Anual</span>
              <span className="text-[#f57c00] font-extrabold text-xs">15% OFF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cards dos Planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 items-stretch">
        {/* 🟢 PLANO BÁSICO */}
        {(() => {
          const plano = PLANOS.BASICO;
          const isAtivo = planoAtivoId === plano.id;
          const valor = frequencia === 'mensal' ? plano.valorMensal : plano.valorAnual / 12;

          return (
            <div
              key={plano.id}
              id="card-plano-basico"
              className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative"
            >
              {isAtivo && (
                <div className="absolute top-4 right-4 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold rounded-md">
                  Plano Atual
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{plano.nome}</h3>
                  <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>Suporta até <strong className="text-slate-700">50 CNPJs</strong></span>
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-[#1a237e]">R$</span>
                    <span className="text-4xl font-extrabold text-[#1a237e] tracking-tight">
                      {valor.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-sm text-slate-500 font-normal">/mês</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {frequencia === 'anual' ? 'Cobrado anualmente com 15% de desconto' : 'Cobrado mensalmente sem carência'}
                  </p>
                </div>

                <div className="pt-3 space-y-2">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    O QUE ESTÁ INCLUSO:
                  </p>
                  <ul className="space-y-2.5">
                    {(plano.oQueEstaIncluido || plano.funcionalidades).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600">
                        <span className="text-emerald-600 font-bold text-sm shrink-0">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => iniciarAssinatura(plano)}
                  disabled={isAtivo}
                  className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    isAtivo
                      ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-default'
                      : 'bg-[#1a237e] hover:bg-[#121858] text-white shadow-sm'
                  }`}
                >
                  {isAtivo ? (
                    <span>Plano Ativado</span>
                  ) : (
                    <>
                      <span>Mudar para este Plano</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })()}

        {/* 🔵 PLANO PROFISSIONAL */}
        {(() => {
          const plano = PLANOS.PROFISSIONAL;
          const isAtivo = planoAtivoId === plano.id;
          const valor = frequencia === 'mensal' ? plano.valorMensal : plano.valorAnual / 12;

          return (
            <div
              key={plano.id}
              id="card-plano-profissional"
              className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative"
            >
              {isAtivo && (
                <div className="absolute top-4 right-4 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold rounded-md">
                  Plano Atual
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{plano.nome}</h3>
                  <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    <span>Suporta até <strong className="text-slate-700">100 CNPJs</strong></span>
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-[#1a237e]">R$</span>
                    <span className="text-4xl font-extrabold text-[#1a237e] tracking-tight">
                      {valor.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-sm text-slate-500 font-normal">/mês</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {frequencia === 'anual' ? 'Cobrado anualmente com 15% de desconto' : 'Cobrado mensalmente sem carência'}
                  </p>
                </div>

                <div className="pt-3 space-y-2">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    O QUE ESTÁ INCLUSO:
                  </p>
                  <ul className="space-y-2.5">
                    {(plano.oQueEstaIncluido || plano.funcionalidades).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600">
                        <span className="text-emerald-600 font-bold text-sm shrink-0">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => iniciarAssinatura(plano)}
                  disabled={isAtivo}
                  className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    isAtivo
                      ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-default'
                      : 'bg-[#2196f3] hover:bg-blue-600 text-white shadow-sm'
                  }`}
                >
                  {isAtivo ? (
                    <span>Plano Ativado</span>
                  ) : (
                    <>
                      <span>Mudar para este Plano</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })()}

        {/* 🔴 PLANO EMPRESARIAL — RECOMENDADO MURADE */}
        {(() => {
          const plano = PLANOS.EMPRESARIAL;
          const isAtivo = planoAtivoId === plano.id;
          const valor = frequencia === 'mensal' ? plano.valorMensal : plano.valorAnual / 12;

          return (
            <div
              key={plano.id}
              id="card-plano-empresarial"
              className="bg-[#1a237e] text-white rounded-2xl p-6 sm:p-7 shadow-xl shadow-indigo-950/25 flex flex-col justify-between relative border border-indigo-400/40"
            >
              {/* Faixa Recomendado */}
              <div className="absolute -top-3.5 right-6 px-4 py-1.5 bg-[#ff9800] text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-md flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>⭐ RECOMENDADO MURADE</span>
              </div>

              <div className="space-y-4 pt-1">
                <div>
                  <h3 className="text-2xl font-bold text-white">{plano.nome}</h3>
                  <p className="text-sm text-[#c5cae9] mt-1 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    <span>Suporta até <strong className="text-white">500 CNPJs</strong></span>
                  </p>
                </div>

                <div className="pt-2 border-t border-indigo-400/20">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-white">R$</span>
                    <span className="text-4xl font-extrabold text-white tracking-tight">
                      {valor.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-sm text-[#c5cae9] font-normal">/mês</span>
                  </div>
                  <p className="text-xs text-[#9fa8da] mt-1">
                    {frequencia === 'anual' ? 'Cobrado anualmente com 15% de desconto' : 'Cobrado mensalmente sem carência'}
                  </p>
                </div>

                <div className="pt-3 space-y-2">
                  <p className="text-xs font-bold text-[#e8eaf6] uppercase tracking-wider">
                    O QUE ESTÁ INCLUSO:
                  </p>
                  <ul className="space-y-2.5">
                    {(plano.oQueEstaIncluido || plano.funcionalidades).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-[#e8eaf6]">
                        <span className="text-[#81c784] font-bold text-sm shrink-0">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-indigo-400/20">
                <button
                  type="button"
                  onClick={() => iniciarAssinatura(plano)}
                  disabled={isAtivo}
                  className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    isAtivo
                      ? 'bg-white/20 text-white border border-white/30 cursor-default'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold shadow-md'
                  }`}
                >
                  {isAtivo ? (
                    <span>Plano Ativado</span>
                  ) : (
                    <>
                      <span>Mudar para este Plano</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Modal de Checkout / Pagamento */}
      {modalAberto && planoEmCheckout && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Assinar Plano {planoEmCheckout.nome}
                </h3>
                <p className="text-xs text-slate-500">Administrado por MURADE</p>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {pagamentoConcluido ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Plano Ativado com Sucesso!</h4>
                <p className="text-xs text-slate-600">
                  Sua conta agora opera no <strong>Plano {planoEmCheckout.nome}</strong> com capacidade para até <strong>{planoEmCheckout.maxCnpjs} CNPJs</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Resumo do Pedido */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Plano Contratado:</span>
                    <strong className="text-slate-900">{planoEmCheckout.nome} ({planoEmCheckout.maxCnpjs} CNPJs)</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Periodicidade:</span>
                    <strong className="text-slate-900 capitalize">{frequencia}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-200">
                    <span className="font-semibold text-slate-800">Total a Pagar:</span>
                    <strong className="text-sm font-extrabold text-[#1a237e]">
                      R$ {(frequencia === 'mensal' ? planoEmCheckout.valorMensal : planoEmCheckout.valorAnual).toFixed(2).replace('.', ',')}
                    </strong>
                  </div>
                </div>

                {/* Seleção do Método */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">Forma de Pagamento</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setMetodoPagamento('pix')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        metodoPagamento === 'pix'
                          ? 'border-[#1a237e] bg-indigo-50 text-[#1a237e] font-bold'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Pix</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetodoPagamento('cartao')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        metodoPagamento === 'cartao'
                          ? 'border-[#1a237e] bg-indigo-50 text-[#1a237e] font-bold'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Cartão</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetodoPagamento('boleto')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        metodoPagamento === 'boleto'
                          ? 'border-[#1a237e] bg-indigo-50 text-[#1a237e] font-bold'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>Boleto</span>
                    </button>
                  </div>
                </div>

                {metodoPagamento === 'pix' && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                    <p className="text-xs font-bold text-emerald-900">Chave Pix MURADE / FISCOIA</p>
                    <div className="bg-white p-2 rounded-lg font-mono text-xs text-slate-800 border border-emerald-100 select-all">
                      00020126580014br.gov.bcb.pix0136fiscoia-murade-pay@banco.com.br
                    </div>
                    <p className="text-[11px] text-emerald-700">Liberação imediata após a confirmação do pagamento.</p>
                  </div>
                )}

                {/* Botões de Confirmação */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalAberto(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    id="btn-confirmar-pagamento"
                    onClick={confirmarPagamento}
                    className="px-5 py-2.5 rounded-xl bg-[#1a237e] hover:bg-[#121858] text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Confirmar e Ativar Plano</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
