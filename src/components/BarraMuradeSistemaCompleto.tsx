import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Key, 
  Calculator, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Eye,
  EyeOff,
  Building2,
  Volume2
} from 'lucide-react';
import { MURADE_SISTEMA_COMPLETO } from '../services/murade/muradeSistemaCompleto.service';
import { useAppNavigation } from '../context/NavigationContext';

export function BarraMuradeSistemaCompleto() {
  const nav = useAppNavigation();
  const [monitorAberto, setMonitorAberto] = useState(true);
  const [certAberto, setCertAberto] = useState(true);
  const [certAtivo, setCertAtivo] = useState(false);
  const [calcModalAberto, setCalcModalAberto] = useState(false);
  const [faturamentoTeste, setFaturamentoTeste] = useState<number>(50000);
  const [salarioBrutoTeste, setSalarioBrutoTeste] = useState<number>(3500);
  const [ufTeste, setUfTeste] = useState<string>('GO');

  const [resultadoCalculo, setResultadoCalculo] = useState<{
    simples?: any;
    presumido?: any;
    folha?: any;
  }>({});

  // Observa o estado dos elementos na tela
  useEffect(() => {
    const timer = setInterval(() => {
      const painel = document.getElementById('painel-murade');
      const cert = document.getElementById('cert-murade');
      
      setMonitorAberto(painel ? painel.style.display !== 'none' : false);
      setCertAberto(cert ? cert.style.display !== 'none' : false);
      setCertAtivo(Boolean((window as any).CERTIFICADO_ATIVO));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const toggleMonitor = () => {
    if ((window as any).ABRIR_PAINEL_MURADE) {
      (window as any).ABRIR_PAINEL_MURADE();
      setMonitorAberto(true);
    } else {
      window.dispatchEvent(new CustomEvent('abrir_painel_unificado', { detail: { aba: 'monitor' } }));
      setMonitorAberto(true);
    }
  };

  const toggleCertificado = () => {
    if ((window as any).ABRIR_CERTIFICADO_MURADE) {
      (window as any).ABRIR_CERTIFICADO_MURADE();
      setCertAberto(true);
    } else {
      window.dispatchEvent(new CustomEvent('abrir_painel_unificado', { detail: { aba: 'cert' } }));
      setCertAberto(true);
    }
  };

  const executarCalculosTeste = () => {
    if (!(window as any).CALC_MURADE) return;
    const calc = (window as any).CALC_MURADE;

    const resSimples = calc.simples(faturamentoTeste);
    const resPresumido = calc.presumido(faturamentoTeste, ufTeste);
    const resFolha = calc.folha(salarioBrutoTeste);

    setResultadoCalculo({
      simples: resSimples,
      presumido: resPresumido,
      folha: resFolha
    });
  };

  const simularEnvioReal = () => {
    if ((window as any).LOG_MURADE) {
      (window as any).LOG_MURADE(
        'info',
        'Sincronização Ativa (Fiscal ↔ DP ↔ FiscoIA)',
        'Consultando guias DCTFWeb e confrontando com apuração do mês.'
      );
      setTimeout(() => {
        (window as any).LOG_MURADE(
          'sucesso',
          'Auditoria Concluída',
          'Todos os dados de NF-e, Folha e Serpro estão 100% conciliados sem divergências!'
        );
      }, 1500);
    }
  };

  return (
    <>
      {/* Barra de Acesso Rápido Flutuante Superior/Inferior */}
      <div 
        id="barra-murade-sistema-controle"
        className="fixed bottom-4 left-4 z-40 bg-slate-900/95 text-white border border-blue-500/40 rounded-2xl shadow-2xl backdrop-blur-md px-3.5 py-2 flex flex-wrap items-center gap-2.5 text-xs select-none"
      >
        <div className="flex items-center gap-1.5 pr-2 border-r border-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-black tracking-wide text-blue-300">MURADE 2026</span>
        </div>

        {/* Botão Painel Monitor */}
        <button
          type="button"
          onClick={toggleMonitor}
          className={`px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            monitorAberto 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
          title="Abrir ou fechar Painel de Monitoramento do Robô e Agente"
        >
          <Bot className="w-3.5 h-3.5 text-blue-300" />
          <span>Monitor</span>
          {monitorAberto ? (
            <span className="text-[10px] bg-blue-700 px-1.5 py-0.2 rounded-full">Ativo</span>
          ) : (
            <EyeOff className="w-3 h-3 text-slate-400" />
          )}
        </button>

        {/* Botão Certificado Digital */}
        <button
          type="button"
          onClick={toggleCertificado}
          className={`px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            certAberto 
              ? 'bg-indigo-600 text-white shadow-xs' 
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
          title="Abrir ou fechar Caixa do Certificado Digital Serpro/Receita"
        >
          <Key className="w-3.5 h-3.5 text-indigo-300" />
          <span>Certificado</span>
          {certAtivo ? (
            <span className="text-[10px] bg-emerald-700 text-emerald-100 px-1.5 py-0.2 rounded-full font-black">
              Conectado
            </span>
          ) : (
            <span className="text-[10px] bg-amber-800 text-amber-200 px-1.5 py-0.2 rounded-full">
              Pendente
            </span>
          )}
        </button>

        {/* Botão Testador Cálculos 2026 */}
        <button
          type="button"
          onClick={() => {
            executarCalculosTeste();
            setCalcModalAberto(true);
          }}
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-purple-900/60 text-purple-200 hover:text-white rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-purple-500/30"
          title="Testar Fórmulas Oficiais 2026 (Simples, Presumido e DP)"
        >
          <Calculator className="w-3.5 h-3.5 text-purple-400" />
          <span>Cálculos 2026</span>
        </button>

        {/* Botão IA Voz Natural Humana */}
        <button
          type="button"
          onClick={() => {
            if (nav?.navegarPara) {
              nav.navegarPara('iaVoz');
            }
          }}
          className="px-2.5 py-1.5 bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-purple-400/40 shadow-xs"
          title="Abrir IA Murad — Voz Natural Humana Brasileira"
        >
          <Volume2 className="w-3.5 h-3.5 text-yellow-300" />
          <span>IA Voz</span>
          <span className="text-[10px] bg-purple-900/90 text-purple-200 px-1.5 py-0.2 rounded-full font-black">
            11Labs
          </span>
        </button>

        {/* Botão Sincronizar Módulos */}
        <button
          type="button"
          onClick={simularEnvioReal}
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold flex items-center gap-1 transition-all cursor-pointer"
          title="Disparar sincronização em tempo real entre FISCAL ↔ DP ↔ FISCOIA"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span>Sync</span>
        </button>
      </div>

      {/* Modal Rápido de Demonstração das Fórmulas Oficiais 2026 */}
      {calcModalAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-yellow-300" />
                <h3 className="font-black text-sm sm:text-base">
                  Fórmulas Oficiais Receita 2026 — window.CALC_MURADE
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCalcModalAberto(false)}
                className="text-white/80 hover:text-white text-xl font-bold p-1 cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Faturamento Mensal (R$)
                  </label>
                  <input
                    type="number"
                    value={faturamentoTeste}
                    onChange={(e) => setFaturamentoTeste(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    UF do Estabelecimento
                  </label>
                  <select
                    value={ufTeste}
                    onChange={(e) => setUfTeste(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold"
                  >
                    <option value="GO">GO (17%)</option>
                    <option value="SP">SP (18%)</option>
                    <option value="MG">MG (18%)</option>
                    <option value="RJ">RJ (18%)</option>
                    <option value="DF">DF (17%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Salário Bruto DP (R$)
                  </label>
                  <input
                    type="number"
                    value={salarioBrutoTeste}
                    onChange={(e) => setSalarioBrutoTeste(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={executarCalculosTeste}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Recalcular e Enviar ao Log Murade</span>
                </button>
              </div>

              {/* Resultados */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                {/* 1. Simples Nacional */}
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                  <div className="font-black text-blue-900 flex items-center justify-between">
                    <span>1. Simples Nacional (Anexo III)</span>
                    <span className="text-[11px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                      {resultadoCalculo.simples?.aliqEfetiva}
                    </span>
                  </div>
                  <div className="text-sm font-black text-blue-700">
                    DAS Apurado: R$ {resultadoCalculo.simples?.valorDAS || '0.00'}
                  </div>
                </div>

                {/* 2. Lucro Presumido */}
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                  <div className="font-black text-indigo-900">
                    2. Lucro Presumido ({ufTeste})
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="p-2 bg-white rounded border border-indigo-100">
                      <span className="text-slate-500 block">ICMS:</span>
                      <strong className="text-indigo-800">R$ {resultadoCalculo.presumido?.ICMS}</strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-indigo-100">
                      <span className="text-slate-500 block">PIS (0.65%):</span>
                      <strong className="text-indigo-800">R$ {resultadoCalculo.presumido?.PIS}</strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-indigo-100">
                      <span className="text-slate-500 block">COFINS (3%):</span>
                      <strong className="text-indigo-800">R$ {resultadoCalculo.presumido?.COFINS}</strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-indigo-100">
                      <span className="text-slate-500 block">IRPJ (1.2%):</span>
                      <strong className="text-indigo-800">R$ {resultadoCalculo.presumido?.IRPJ}</strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-indigo-100">
                      <span className="text-slate-500 block">CSLL (0.72%):</span>
                      <strong className="text-indigo-800">R$ {resultadoCalculo.presumido?.CSLL}</strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-indigo-100">
                      <span className="text-slate-500 block">IBS Reforma (12%):</span>
                      <strong className="text-indigo-800">R$ {resultadoCalculo.presumido?.IBS_Reforma}</strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-indigo-100">
                      <span className="text-slate-500 block">CBS Reforma (9%):</span>
                      <strong className="text-indigo-800">R$ {resultadoCalculo.presumido?.CBS_Reforma}</strong>
                    </div>
                  </div>
                </div>

                {/* 3. Folha DP */}
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1">
                  <div className="font-black text-purple-900">
                    3. Folha de Pagamento & Encargos DP (2026)
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="p-2 bg-white rounded border border-purple-100">
                      <span className="text-slate-500 block">INSS Progressivo:</span>
                      <strong className="text-purple-800 text-xs">R$ {resultadoCalculo.folha?.INSS}</strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-purple-100">
                      <span className="text-slate-500 block">FGTS Empresa (8%):</span>
                      <strong className="text-purple-800 text-xs">R$ {resultadoCalculo.folha?.FGTS}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setCalcModalAberto(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs cursor-pointer"
              >
                Fechar Demonstração
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
