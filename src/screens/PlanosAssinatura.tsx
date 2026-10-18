import { useState } from 'react';
import { Sparkles, Building2, ArrowRight, ShieldCheck } from 'lucide-react';
import { PLANOS } from '../config/planos';
import { PlanoConfig } from '../types';
import BotaoVoltar from '../components/BotaoVoltar';

export default function PlanosAssinatura() {
  const [frequencia, setFrequencia] = useState<'mensal' | 'anual'>('mensal');
  const [modalAberto, setModalAberto] = useState(false);
  const [planoEmCheckout, setPlanoEmCheckout] = useState<PlanoConfig | null>(null);

  const iniciarAssinatura = (plano: PlanoConfig) => {
    setPlanoEmCheckout(plano);
    setModalAberto(true);
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
          Valores de referência. A contratação e a cobrança online não estão disponíveis.
        </p>
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 max-w-2xl mx-auto">Nenhum pagamento é processado nesta tela. Os limites não são aplicados por um serviço central e os recursos oficiais descritos dependem de integrações ainda pendentes.</p>

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
          const isAtivo = false;
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
                    {frequencia === 'anual' ? 'Valor anual de referência, sem cobrança' : 'Valor mensal de referência, sem cobrança'}
                  </p>
                </div>

                <div className="pt-3 space-y-2">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    RECURSOS / LIMITAÇÕES ATUAIS:
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
                      <span>Ver disponibilidade</span>
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
          const isAtivo = false;
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
                    {frequencia === 'anual' ? 'Valor anual de referência, sem cobrança' : 'Valor mensal de referência, sem cobrança'}
                  </p>
                </div>

                <div className="pt-3 space-y-2">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    RECURSOS / LIMITAÇÕES ATUAIS:
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
                      <span>Ver disponibilidade</span>
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
          const isAtivo = false;
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
                    {frequencia === 'anual' ? 'Valor anual de referência, sem cobrança' : 'Valor mensal de referência, sem cobrança'}
                  </p>
                </div>

                <div className="pt-3 space-y-2">
                  <p className="text-xs font-bold text-[#e8eaf6] uppercase tracking-wider">
                    RECURSOS / LIMITAÇÕES ATUAIS:
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
                      <span>Ver disponibilidade</span>
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
                  Contratação do plano {planoEmCheckout.nome}
                </h3>
                <p className="text-xs text-slate-500">Checkout indisponível</p>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600"><span>Plano selecionado:</span><strong className="text-slate-900">{planoEmCheckout.nome}</strong></div>
                <div className="flex justify-between text-slate-600"><span>Periodicidade de referência:</span><strong className="text-slate-900 capitalize">{frequencia}</strong></div>
                <div className="flex justify-between text-slate-600"><span>Preço de referência:</span><strong className="text-slate-900">R$ {(frequencia === 'mensal' ? planoEmCheckout.valorMensal : planoEmCheckout.valorAnual).toFixed(2).replace('.', ',')}</strong></div>
              </div>
              <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
                Não há provedor de pagamento conectado. Nenhuma cobrança será feita, nenhum plano será ativado e os limites não serão alterados. Não use dados bancários ou faça Pix com base nesta tela.
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => setModalAberto(false)} className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold">Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
