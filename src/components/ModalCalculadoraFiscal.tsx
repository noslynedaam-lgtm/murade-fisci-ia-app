import { useState, useId, useEffect } from 'react';
import { 
  Calculator, 
  X, 
  Percent, 
  Receipt, 
  Check, 
  Copy, 
  RotateCcw,
  Sparkles, 
  ArrowRight
} from 'lucide-react';
import { FISCOIA_FISCAL, UF, RegimeTributario } from '../services/fiscal/fiscoiaFiscal.service';
import { useEmpresa } from '../context/EmpresaContext';

interface ModalCalculadoraFiscalProps {
  aberto: boolean;
  onFechar: () => void;
}

export function ModalCalculadoraFiscal({ aberto, onFechar }: ModalCalculadoraFiscalProps) {
  const { empresaAtiva } = useEmpresa();
  const [abaCalculo, setAbaCalculo] = useState<'icms' | 'piscofins' | 'simples' | 'reforma'>('icms');
  const [copiado, setCopiado] = useState(false);
  const baseId = useId();

  // Estados ICMS
  const [ufOrigem, setUfOrigem] = useState<UF>('GO');
  const [ufDestino, setUfDestino] = useState<UF>('GO');
  const [saidaIcms, setSaidaIcms] = useState<string>('50000');
  const [entradaIcms, setEntradaIcms] = useState<string>('20000');

  // Estados PIS/COFINS
  const [regimePis, setRegimePis] = useState<RegimeTributario>('PRESUMIDO');
  const [basePis, setBasePis] = useState<string>('100000');

  // Estados Simples Nacional
  const [faturamentoSimples, setFaturamentoSimples] = useState<string>('350000');

  // Estados Reforma Tributária
  const [baseReforma, setBaseReforma] = useState<string>('100000');

  // Sincroniza automaticamente com o regime e UF da empresa ativa
  useEffect(() => {
    if (aberto && empresaAtiva) {
      if (empresaAtiva.uf && Object.keys(FISCOIA_FISCAL.ALIQ_ICMS).includes(empresaAtiva.uf.toUpperCase())) {
        const uf = empresaAtiva.uf.toUpperCase() as UF;
        setUfOrigem(uf);
        setUfDestino(uf);
      }
      const reg = empresaAtiva.regimeTributario?.toUpperCase();
      if (reg === 'SIMPLES') {
        setAbaCalculo('simples');
        setRegimePis('SIMPLES');
      } else if (reg === 'LUCRO_REAL' || reg === 'REAL') {
        setRegimePis('REAL');
      } else if (reg === 'LUCRO_PRESUMIDO' || reg === 'PRESUMIDO') {
        setRegimePis('PRESUMIDO');
      }
    }
  }, [aberto, empresaAtiva]);

  if (!aberto) return null;

  // Cálculos ICMS
  const vSaida = parseFloat(saidaIcms.replace(/\D/g, '')) || 0;
  const vEntrada = parseFloat(entradaIcms.replace(/\D/g, '')) || 0;
  const aliqIcmsAplicada = ufOrigem === ufDestino 
    ? FISCOIA_FISCAL.ALIQ_ICMS[ufOrigem] 
    : FISCOIA_FISCAL.ALIQ_ICMS.interestadual;
  const resultadoIcms = FISCOIA_FISCAL.CALCULADORA_FISCAL.calcularICMS(vSaida, vEntrada, aliqIcmsAplicada);

  // Cálculos PIS/COFINS
  const vBasePis = parseFloat(basePis.replace(/\D/g, '')) || 0;
  const resultadoPisCofins = FISCOIA_FISCAL.CALCULADORA_FISCAL.calcularPisCofins(vBasePis, regimePis);

  // Cálculos Simples Nacional
  const vFatSimples = parseFloat(faturamentoSimples.replace(/\D/g, '')) || 0;
  const resultadoSimples = FISCOIA_FISCAL.CALCULADORA_FISCAL.calcularSimples(vFatSimples);

  // Cálculos Reforma IBS/CBS
  const vBaseReforma = parseFloat(baseReforma.replace(/\D/g, '')) || 0;
  const resultadoReforma = FISCOIA_FISCAL.CALCULADORA_FISCAL.calcularIBS_CBS(vBaseReforma);

  const copiarResultado = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const listaUfs = Object.keys(FISCOIA_FISCAL.ALIQ_ICMS).filter(u => u !== 'interestadual') as UF[];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in"
      onClick={onFechar}
    >
      <div 
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border-2 border-blue-500 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO DA CALCULADORA */}
        <div className="p-4 bg-gradient-to-r from-[#0F2B5B] via-[#165DFF] to-[#722ED1] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs border border-white/20">
              <Calculator className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="text-sm font-black tracking-wide flex items-center gap-2">
                <span>🧮 CALCULADORA FISCAL</span>
                <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full">
                  FISCOIA 3.2.1
                </span>
              </div>
              <div className="text-[11px] text-blue-100">
                ICMS 27 UFs • PIS/COFINS • Simples Nacional • Reforma IBS/CBS
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            className="p-2 rounded-xl text-blue-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ABAS DA CALCULADORA */}
        <div className="flex items-center gap-1.5 p-2.5 bg-slate-100 border-b border-slate-200 overflow-x-auto">
          {[
            { id: 'icms', rotulo: '⚖️ ICMS (27 UFs)' },
            { id: 'piscofins', rotulo: '📊 PIS / COFINS' },
            { id: 'simples', rotulo: '🧾 Simples Nacional' },
            { id: 'reforma', rotulo: '🏛️ IBS + CBS (Reforma)' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAbaCalculo(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                abaCalculo === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.rotulo}
            </button>
          ))}
        </div>

        {/* CORPO DE CÁLCULO */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* ======================= MODO ICMS ======================= */}
          {abaCalculo === 'icms' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 leading-relaxed">
                <strong>Alíquotas do Brasil Inteiro:</strong> Alíquota interna de cada estado aplicada em operações internas ({ufOrigem}: {FISCOIA_FISCAL.ALIQ_ICMS[ufOrigem]}%). Em operações interestaduais ({ufOrigem} ➔ {ufDestino}), alíquota interestadual padrão de <strong>12%</strong>.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${baseId}-uf-origem`} className="font-bold text-slate-700 block mb-1">UF Origem</label>
                  <select
                    id={`${baseId}-uf-origem`}
                    value={ufOrigem}
                    onChange={(e) => setUfOrigem(e.target.value as UF)}
                    className="w-full p-2 rounded-lg border border-slate-300 font-bold text-slate-800 bg-white"
                  >
                    {listaUfs.map(uf => (
                      <option key={uf} value={uf}>{uf} ({FISCOIA_FISCAL.ALIQ_ICMS[uf]}%)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor={`${baseId}-uf-destino`} className="font-bold text-slate-700 block mb-1">UF Destino</label>
                  <select
                    id={`${baseId}-uf-destino`}
                    value={ufDestino}
                    onChange={(e) => setUfDestino(e.target.value as UF)}
                    className="w-full p-2 rounded-lg border border-slate-300 font-bold text-slate-800 bg-white"
                  >
                    {listaUfs.map(uf => (
                      <option key={uf} value={uf}>{uf} ({FISCOIA_FISCAL.ALIQ_ICMS[uf]}%)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${baseId}-saida-icms`} className="font-bold text-slate-700 block mb-1">Valor Saídas / Vendas (R$)</label>
                  <input
                    id={`${baseId}-saida-icms`}
                    type="text"
                    value={saidaIcms}
                    onChange={(e) => setSaidaIcms(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold"
                    placeholder="50000"
                  />
                </div>

                <div>
                  <label htmlFor={`${baseId}-entrada-icms`} className="font-bold text-slate-700 block mb-1">Valor Entradas / Compras (R$)</label>
                  <input
                    id={`${baseId}-entrada-icms`}
                    type="text"
                    value={entradaIcms}
                    onChange={(e) => setEntradaIcms(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold"
                    placeholder="20000"
                  />
                </div>
              </div>

              {/* CARD DE RESULTADO ICMS */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-800">Demonstrativo de ICMS</span>
                  <span className="font-mono text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-black">
                    Alíquota: {resultadoIcms.aliquota}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold">ICMS Débito (Saídas)</div>
                    <div className="text-sm font-bold text-slate-900 font-mono">
                      R$ {resultadoIcms.debito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold">ICMS Crédito (Entradas)</div>
                    <div className="text-sm font-bold text-emerald-600 font-mono">
                      R$ {resultadoIcms.credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="p-2 bg-blue-50 border border-blue-300 rounded-lg">
                    <div className="text-[10px] text-blue-900 font-bold">ICMS a Recolher</div>
                    <div className="text-sm font-black text-blue-700 font-mono">
                      R$ {resultadoIcms.aPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => copiarResultado(`ICMS ${ufOrigem}->${ufDestino}: Débito R$ ${resultadoIcms.debito.toFixed(2)} | Crédito R$ ${resultadoIcms.credito.toFixed(2)} | A Pagar R$ ${resultadoIcms.aPagar.toFixed(2)}`)}
                  className="w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiado ? 'Copiado para Área de Transferência!' : 'Copiar Resultado'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================= MODO PIS/COFINS ======================= */}
          {abaCalculo === 'piscofins' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${baseId}-regime-tributario`} className="font-bold text-slate-700 block mb-1">Regime Tributário</label>
                  <select
                    id={`${baseId}-regime-tributario`}
                    value={regimePis}
                    onChange={(e) => setRegimePis(e.target.value as RegimeTributario)}
                    className="w-full p-2 rounded-lg border border-slate-300 font-bold text-slate-800 bg-white"
                  >
                    <option value="SIMPLES">Simples Nacional (PIS/COFINS inclusos no DAS)</option>
                    <option value="PRESUMIDO">Lucro Presumido (Cumulativo: PIS 0,65% | COFINS 3,00%)</option>
                    <option value="REAL">Lucro Real (Não-Cumulativo: PIS 1,65% | COFINS 7,60%)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={`${baseId}-base-pis-cofins`} className="font-bold text-slate-700 block mb-1">Faturamento Bruto / Base (R$)</label>
                  <input
                    id={`${baseId}-base-pis-cofins`}
                    type="text"
                    value={basePis}
                    onChange={(e) => setBasePis(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold"
                    placeholder="100000"
                  />
                </div>
              </div>

              {/* CARD DE RESULTADO PIS/COFINS */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-800">
                    Apuração {regimePis === 'PRESUMIDO' ? 'Lucro Presumido' : 'Lucro Real'}
                  </span>
                  <span className="font-mono text-[11px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-black">
                    Alíquota Total: {(resultadoPisCofins.aliqPIS + resultadoPisCofins.aliqCOFINS).toFixed(2)}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold">PIS ({resultadoPisCofins.aliqPIS}%)</div>
                    <div className="text-sm font-bold text-slate-900 font-mono">
                      R$ {resultadoPisCofins.PIS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold">COFINS ({resultadoPisCofins.aliqCOFINS}%)</div>
                    <div className="text-sm font-bold text-slate-900 font-mono">
                      R$ {resultadoPisCofins.COFINS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="p-2 bg-purple-50 border border-purple-300 rounded-lg">
                    <div className="text-[10px] text-purple-900 font-bold">Total PIS + COFINS</div>
                    <div className="text-sm font-black text-purple-700 font-mono">
                      R$ {resultadoPisCofins.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => copiarResultado(`PIS/COFINS (${regimePis}): Base R$ ${resultadoPisCofins.valorBase.toFixed(2)} | PIS R$ ${resultadoPisCofins.PIS.toFixed(2)} | COFINS R$ ${resultadoPisCofins.COFINS.toFixed(2)} | Total R$ ${resultadoPisCofins.total.toFixed(2)}`)}
                  className="w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiado ? 'Copiado!' : 'Copiar Resultado'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================= MODO SIMPLES NACIONAL ======================= */}
          {abaCalculo === 'simples' && (
            <div className="space-y-4">
              <div>
                <label htmlFor={`${baseId}-fat-simples`} className="font-bold text-slate-700 block mb-1">Faturamento Bruto Anual RBT12 (R$)</label>
                <input
                  id={`${baseId}-fat-simples`}
                  type="text"
                  value={faturamentoSimples}
                  onChange={(e) => setFaturamentoSimples(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono font-bold text-sm"
                  placeholder="350000"
                />
              </div>

              {/* CARD DE RESULTADO SIMPLES */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                  <span className="font-bold text-emerald-900">Faixa do Simples Nacional Enquadrada</span>
                  <span className="font-mono text-xs bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-black">
                    Alíquota Nominal: {resultadoSimples.aliquota}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                    <div className="text-[10px] text-slate-500 font-semibold">Limite Superior da Faixa</div>
                    <div className="text-sm font-bold text-slate-800 font-mono">
                      R$ {resultadoSimples.limiteFaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="p-2.5 bg-emerald-100/70 border border-emerald-300 rounded-lg">
                    <div className="text-[10px] text-emerald-900 font-bold">DAS Mensal Estimado</div>
                    <div className="text-base font-black text-emerald-800 font-mono">
                      R$ {resultadoSimples.DAS_Mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-emerald-800 bg-emerald-100/50 p-2 rounded-lg leading-relaxed">
                  💡 No Simples Nacional, <strong>não há crédito de ICMS</strong> (CST 90 padrão) e os impostos federais (PIS, COFINS, IRPJ, CSLL e CPP) já estão unificados na guia única do DAS.
                </div>
              </div>
            </div>
          )}

          {/* ======================= MODO REFORMA TRIBUTÁRIA ======================= */}
          {abaCalculo === 'reforma' && (
            <div className="space-y-4">
              <div>
                <label htmlFor={`${baseId}-base-reforma`} className="font-bold text-slate-700 block mb-1">Valor da Operação de Bens ou Serviços (R$)</label>
                <input
                  id={`${baseId}-base-reforma`}
                  type="text"
                  value={baseReforma}
                  onChange={(e) => setBaseReforma(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono font-bold text-sm"
                  placeholder="100000"
                />
              </div>

              {/* CARD DE RESULTADO REFORMA */}
              <div className="p-4 bg-gradient-to-br from-sky-50 to-purple-50 border border-indigo-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                  <span className="font-bold text-indigo-950">Novo Modelo Tributário Nacional</span>
                  <span className="font-mono text-xs bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded font-black">
                    IBS 12% + CBS 9% = 21%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-white rounded-lg border border-sky-300">
                    <div className="text-[10px] text-sky-800 font-bold">IBS (Substitui ICMS/ISS)</div>
                    <div className="text-sm font-black text-sky-700 font-mono">
                      R$ {resultadoReforma.IBS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="p-2 bg-white rounded-lg border border-purple-300">
                    <div className="text-[10px] text-purple-800 font-bold">CBS (Substitui PIS/COFINS)</div>
                    <div className="text-sm font-black text-purple-700 font-mono">
                      R$ {resultadoReforma.CBS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="p-2 bg-gradient-to-r from-sky-100 to-purple-100 border border-indigo-300 rounded-lg">
                    <div className="text-[10px] text-indigo-950 font-bold">Carga Total IVA Dual</div>
                    <div className="text-sm font-black text-indigo-900 font-mono">
                      R$ {resultadoReforma.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-indigo-900 bg-white/80 p-2.5 rounded-lg leading-relaxed border border-indigo-200">
                  ⚡ <strong>Crédito Financeiro Pleno:</strong> Sob o novo IVA Dual brasileiro, todo tributo pago nas etapas anteriores gera crédito imediato no split payment eletrônico do SERPRO 2.0.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ DO MODAL */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            FiscoIA v3.2.1 • Atualizado com alíquotas oficiais de todas as 27 UFs
          </span>
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
