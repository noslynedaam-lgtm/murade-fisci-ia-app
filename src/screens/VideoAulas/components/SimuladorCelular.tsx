import React from 'react';
import { Share2, Sparkles } from 'lucide-react';
import { PedacinhoVideo } from '../types';
import IndicadorSetaClique from './IndicadorSetaClique';

interface SimuladorCelularProps {
  pedacinho: PedacinhoVideo;
  onAvancar?: () => void;
}

export default function SimuladorCelular({ pedacinho, onAvancar }: SimuladorCelularProps) {
  const { telaSimulada, alvoClique } = pedacinho;

  return (
    <div className="flex flex-col items-center justify-center relative select-none">
      {/* Moldura do Celular Android */}
      <div className="w-[290px] sm:w-[320px] bg-slate-950 rounded-[44px] p-3 border-4 border-slate-700 shadow-2xl relative overflow-hidden ring-4 ring-slate-900/50">
        {/* Notch / Câmera Frontal */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-900 rounded-full flex items-center justify-center gap-2 z-30">
          <div className="w-2 h-2 rounded-full bg-slate-950 border border-slate-800" />
          <div className="w-6 h-1 rounded-full bg-slate-800" />
        </div>

        {/* Tela do Smartphone */}
        <div className="bg-white rounded-[34px] overflow-hidden text-slate-900 flex flex-col h-[500px] sm:h-[530px] relative border border-slate-800">
          {/* Barra de Status do Android */}
          <div className="bg-blue-950 text-white px-4 pt-4 pb-2 text-[10px] font-bold flex items-center justify-between select-none">
            <span>12:30</span>
            <div className="flex items-center gap-1.5 text-[9px]">
              <span>5G</span>
              <span>📶</span>
              <span>98% 🔋</span>
            </div>
          </div>

          {/* Topo do App no Android */}
          <div className="bg-blue-900 text-white px-3 py-2 flex items-center justify-between border-b border-blue-950">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-indigo-500 flex items-center justify-center text-[10px] font-black">
                F
              </div>
              <span className="font-extrabold text-xs tracking-tight">FISCOIA Mobile</span>
            </div>
            <span className="text-[9px] bg-yellow-400 text-slate-950 px-1.5 py-0.5 rounded font-black">
              CELULAR
            </span>
          </div>

          {/* ÁREA DE CONTEÚDO DA TELA SIMULADA */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs bg-slate-50 relative">
            {/* SETA ANIMADA INDICANDO ONDE CLICAR NO CELULAR */}
            {alvoClique && (
              <IndicadorSetaClique 
                alvo={alvoClique} 
                modo="mobile" 
                onCliqueAlvo={onAvancar}
              />
            )}

            {/* TELAS SIMULADAS */}
            {telaSimulada === 'LOGIN' && (
              <div className="space-y-3 pt-6 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                  F
                </div>
                <div>
                  <strong className="text-slate-900 text-sm block">Acesso ao FiscoIA</strong>
                  <span className="text-[11px] text-slate-500">Pronto para uso no Android</span>
                </div>
                <div className="space-y-2 text-left pt-2">
                  <div className="bg-white p-2 rounded-xl border border-slate-200 text-[11px]">
                    contato@murade.com.br
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200 text-[11px] text-slate-400">
                    ••••••••••••
                  </div>
                  <button 
                    type="button"
                    onClick={onAvancar}
                    className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs ring-2 ring-amber-400 cursor-pointer"
                  >
                    Entrar no Sistema
                  </button>
                </div>
              </div>
            )}

            {telaSimulada === 'INICIO' && (
              <div className="space-y-2">
                <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-3 rounded-xl shadow-xs space-y-1">
                  <span className="text-[10px] text-indigo-200 uppercase font-bold">Resumo Fiscal 2026</span>
                  <div className="text-sm font-black">Murade Assessoria</div>
                  <div className="text-[10px] text-emerald-300 font-semibold">● 14 empresas regulares</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block">DCTFWeb</span>
                    <strong className="text-xs text-indigo-950">R$ 14.850,20</strong>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block">DARF Dia 20</span>
                    <strong className="text-xs text-emerald-700">Emitido ✓</strong>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-xl border-2 border-amber-400 shadow-2xs space-y-1">
                  <strong className="text-[11px] text-slate-800 block">Vencimento Próximo</strong>
                  <div className="flex items-center justify-between text-[10px] text-slate-600">
                    <span>INSS Folha Mensal</span>
                    <span className="text-rose-600 font-bold">20/09/2026</span>
                  </div>
                </div>
              </div>
            )}

            {telaSimulada === 'DCTFWEB' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <strong className="text-xs text-slate-800">Declarações DCTFWeb</strong>
                  <span className="text-[10px] text-indigo-600 font-bold">Set/2026</span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border-2 border-amber-400 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <strong className="text-slate-900">Empresa Exemplo (Demonstração)</strong>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[9px]">
                      Transmitida
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">DARF: R$ 4.250,00</div>
                  <button 
                    type="button"
                    onClick={onAvancar}
                    className="w-full py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    Transmitir DCTFWeb
                  </button>
                </div>
              </div>
            )}

            {telaSimulada === 'GUIAS' && (
              <div className="space-y-2">
                <strong className="text-xs text-slate-800 block">Guias & Impostos</strong>
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-900">DARF Previdenciário</span>
                    <span className="font-bold text-indigo-700">R$ 2.450,80</span>
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    85800000002-4 45080182202-6...
                  </div>
                  <div className="space-y-1.5">
                    <button 
                      type="button"
                      onClick={onAvancar}
                      className="w-full py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg ring-2 ring-amber-400 cursor-pointer"
                    >
                      Copiar Pix Copia e Cola
                    </button>
                    <button 
                      type="button"
                      onClick={onAvancar}
                      className="w-full py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 ring-2 ring-amber-400 cursor-pointer"
                    >
                      <Share2 className="w-2.5 h-2.5" /> Enviar por WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            )}

            {telaSimulada === 'SERPRO' && (
              <div className="space-y-2">
                <div className="bg-indigo-950 text-white p-2.5 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-yellow-400 font-bold uppercase">SERPRO Integra</span>
                    <span className="text-emerald-400 font-semibold">● Online</span>
                  </div>
                  <strong className="text-xs block">Gateway Oficial 2026</strong>
                  <div className="text-[9px] text-indigo-200 font-mono">Latência: 125ms</div>
                </div>

                <button
                  type="button"
                  onClick={onAvancar}
                  className="w-full py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold ring-2 ring-amber-400 cursor-pointer"
                >
                  Testar Conexão Agora
                </button>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1 text-[10px] shadow-2xs">
                  <span className="font-bold text-slate-800 block">Serviços Ativos:</span>
                  <div className="flex justify-between text-slate-600">
                    <span>Integra Contador (DCTFWeb)</span>
                    <span className="text-emerald-700 font-bold">OK</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Consulta CNPJ Receita</span>
                    <span className="text-emerald-700 font-bold">OK</span>
                  </div>
                </div>
              </div>
            )}

            {telaSimulada === 'PROCURACAO' && (
              <div className="space-y-2">
                <strong className="text-xs text-slate-800 block">Procurações e-CAC</strong>
                <div className="bg-white p-2.5 rounded-xl border-2 border-amber-400 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <strong className="text-slate-900">Empresa Exemplo (Demonstração)</strong>
                    <span className="text-emerald-700 bg-emerald-50 px-1 rounded text-[9px] font-bold">Válida</span>
                  </div>
                  <div className="text-[10px] text-slate-500">Poderes: DCTFWeb, e-CAC, CND</div>
                  <button
                    type="button"
                    onClick={onAvancar}
                    className="w-full py-1 bg-indigo-600 text-white rounded text-[10px] font-bold"
                  >
                    Validar Procuração
                  </button>
                </div>
              </div>
            )}

            {telaSimulada === 'IA_CHAT' && (
              <div className="space-y-2">
                <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100 text-[11px] text-indigo-900">
                  <strong>Pergunta Fiscal:</strong>
                  <p className="mt-0.5">&quot;Qual o prazo de entrega da DCTFWeb de Setembro?&quot;</p>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200 text-[11px] text-slate-800 space-y-1 shadow-2xs">
                  <span className="font-bold text-indigo-700 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Resposta IA Fiscal:
                  </span>
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    Vencimento no dia 20. Se for domingo ou feriado, antecipa-se para o dia útil anterior.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onAvancar}
                  className="w-full py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold ring-2 ring-amber-400 cursor-pointer"
                >
                  Enviar Consulta Fiscal
                </button>
              </div>
            )}
          </div>

          {/* Barra de Navegação Inferior do Android */}
          <div className="bg-slate-950 text-slate-400 px-6 py-2 flex items-center justify-around text-xs border-t border-slate-800 select-none">
            <span className="hover:text-white cursor-pointer">◀</span>
            <span className="hover:text-white cursor-pointer">●</span>
            <span className="hover:text-white cursor-pointer">■</span>
          </div>
        </div>
      </div>

      {/* DICA DE TOQUE MOBILE */}
      <div className="mt-3 max-w-xs text-center text-xs text-slate-400">
        👆 <strong>Toque no Celular:</strong> A seta amarela indica o ponto exato de toque na tela do smartphone.
      </div>
    </div>
  );
}
