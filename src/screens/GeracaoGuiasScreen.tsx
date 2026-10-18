import { useState, useEffect } from 'react';
import BotaoVoltar from '../components/BotaoVoltar';
import { EmpresaDados } from '../types';
import { useEmpresa } from '../context/EmpresaContext';
import SeletorEmpresaGlobal from '../components/SeletorEmpresaGlobal';
import { DollarSign, AlertCircle, Check, Building2, FileText } from 'lucide-react';

interface GeracaoGuiasScreenProps {
  empresaInicial?: EmpresaDados;
  onVoltar?: () => void;
}


export default function GeracaoGuiasScreen({ empresaInicial, onVoltar }: GeracaoGuiasScreenProps) {
  const { empresas, empresaAtiva, selecionarEmpresa, salvarNovaEmpresa } = useEmpresa();
  const [empresaSelecionada, setEmpresaSelecionada] = useState<EmpresaDados | null>(
    empresaInicial || empresaAtiva || (empresas.length > 0 ? empresas[0] : null)
  );

  const handleAlterarRegimeEmpresa = (novoRegime: 'SIMPLES' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL') => {
    if (!empresaSelecionada) return;
    const atualizada: EmpresaDados = { ...empresaSelecionada, regimeTributario: novoRegime };
    const salva = salvarNovaEmpresa(atualizada);
    if (!salva) {
      setToastNotificacao('Não foi possível salvar o regime da empresa. Os dados anteriores foram preservados.');
      setTimeout(() => setToastNotificacao(null), 4500);
      return;
    }
    selecionarEmpresa(salva);
    setEmpresaSelecionada(salva);
    const nomes = {
      SIMPLES: 'Simples Nacional',
      LUCRO_PRESUMIDO: 'Lucro Presumido',
      LUCRO_REAL: 'Lucro Real'
    };
    setToastNotificacao(`Regime da empresa "${empresaSelecionada.razaoSocial}" salvo como ${nomes[novoRegime]}. O sistema ainda não calcula nem emite guias oficiais.`);
    setTimeout(() => setToastNotificacao(null), 4500);
  };



  const [toastNotificacao, setToastNotificacao] = useState<string | null>(null);

  useEffect(() => {
    if (empresaInicial) {
      setEmpresaSelecionada(empresaInicial);
    } else if (empresaAtiva) {
      setEmpresaSelecionada(empresaAtiva);
    } else if (empresas.length > 0) {
      setEmpresaSelecionada(empresas[0]);
    } else {
      setEmpresaSelecionada(null);
    }
  }, [empresaInicial, empresaAtiva, empresas]);

  // A ação não inventa tributos, vencimentos nem códigos de pagamento sem consultar a fonte oficial.
  const handleGerarGuias = () => {
    setToastNotificacao('Nenhuma guia foi gerada. Este ambiente não consulta PGDAS-D, DCTFWeb, FGTS Digital, SEFAZ ou prefeitura e não possui dados suficientes para calcular tributos com segurança. Gere e pague apenas guias emitidas pelo portal oficial após a conferência do contador.');
    setTimeout(() => setToastNotificacao(null), 7000);
  };

  return (
    <div className="max-w-4xl mx-auto pb-16 px-4 sm:px-6">
      {/* Botão de Voltar */}
      <div className="mb-4">
        <BotaoVoltar onVoltar={onVoltar} />
      </div>

      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2.5 rounded-2xl bg-[#e8eaf6] text-[#1a237e]">
                <FileText className="w-6 h-6" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1a237e] tracking-tight">
                🧾 Geração de Guias
              </h1>
            </div>
            <div className="mt-2">
              {empresaSelecionada ? (
                <>
                  <p className="text-base sm:text-lg font-bold text-slate-800">
                    {empresaSelecionada.razaoSocial}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    {empresaSelecionada.cnpj}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Regime:
                    </span>
                    {(['SIMPLES', 'LUCRO_PRESUMIDO', 'LUCRO_REAL'] as const).map(reg => {
                      const ativo = (empresaSelecionada.regimeTributario || 'SIMPLES') === reg;
                      const labels = {
                        SIMPLES: 'Simples Nacional',
                        LUCRO_PRESUMIDO: 'Lucro Presumido',
                        LUCRO_REAL: 'Lucro Real'
                      };
                      return (
                        <button
                          key={reg}
                          type="button"
                          onClick={() => handleAlterarRegimeEmpresa(reg)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                            ativo
                              ? 'bg-[#1a237e] text-white shadow-xs ring-2 ring-[#1a237e]/30'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                          }`}
                          title={`Clique para configurar e salvar esta empresa no ${labels[reg]}`}
                        >
                          {ativo && <Check className="w-3 h-3 text-emerald-400" />}
                          {labels[reg]}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-sm font-bold text-amber-800">
                  Nenhuma empresa selecionada. Por favor, cadastre ou selecione uma empresa ao lado.
                </p>
              )}
            </div>
          </div>

          {/* Seletor Global de Empresa */}
          <div className="self-start sm:self-auto space-y-1">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Selecionar Empresa:
            </span>
            <SeletorEmpresaGlobal tamanho="medio" />
          </div>
        </div>
      </div>

      {/* Toast Notificação */}
      {toastNotificacao && (
        <div role="status" className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-900 text-sm shadow-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
          <span className="font-semibold">{toastNotificacao}</span>
        </div>
      )}

      {/* EMISSÃO OFICIAL — INTEGRAÇÃO AINDA NÃO CONFIGURADA */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200 shadow-sm mb-6 space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-amber-100 pb-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><DollarSign className="w-5 h-5 text-amber-700" />Guias fiscais oficiais</h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300">Integração pendente</span>
        </div>
        <p className="text-sm text-slate-700">Este sistema não está conectado ao PGDAS-D, DCTFWeb, FGTS Digital, SEFAZ ou prefeitura. Nenhum cálculo, vencimento, código de barras, linha digitável ou guia oficial é produzido aqui.</p>
        <p className="text-xs text-slate-600">Para tornar a emissão real, é necessário integrar cada serviço oficial com autenticação autorizada, dados fiscais da empresa e regras atualizadas. Até lá, emita e confira as guias no portal correspondente.</p>
        <button type="button" onClick={handleGerarGuias} className="w-full py-3 px-6 rounded-2xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-sm">Verificar disponibilidade — não emite guia</button>
      </div>
    </div>
  );
}
