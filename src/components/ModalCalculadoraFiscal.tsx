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

const parseValor = (raw: string) => {
  const semMoeda = raw.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!semMoeda) return 0;
  const formatoBrasileiro = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
  const formatoDecimalPonto = /^\d+\.\d{1,2}$/;
  if (!formatoBrasileiro.test(semMoeda) && !formatoDecimalPonto.test(semMoeda)) return Number.NaN;
  const normalizado = semMoeda.includes(',')
    ? semMoeda.replace(/\./g, '').replace(',', '.')
    : formatoBrasileiro.test(semMoeda) && semMoeda.includes('.')
      ? semMoeda.replace(/\./g, '')
      : semMoeda;
  const valor = Number(normalizado);
  return Number.isFinite(valor) && valor <= Number.MAX_SAFE_INTEGER ? valor : Number.NaN;
};
const parseAliquota = (raw: string) => {
  const texto = raw.trim();
  if (!texto) return 0;
  if (!/^\d+(?:[,.]\d{1,4})?$/.test(texto)) return Number.NaN;
  const valor = Number(texto.replace(',', '.'));
  return Number.isFinite(valor) && valor >= 0 && valor <= 100 ? valor : Number.NaN;
};
// Arredondamento monetário half-up com inteiros. A taxa é escalada a 1e6
// (100% = 1.000.000), preservando até quatro casas percentuais sem float drift.
const calcularDifalCentavos = (baseCentavos: number, origem: number, destino: number) => {
  const fatorTaxa = 1_000_000;
  const origemEscalada = Math.round(origem * 10_000);
  const destinoEscalada = Math.round(destino * 10_000);
  const diferencaEscalada = destinoEscalada - origemEscalada;
  if (diferencaEscalada <= 0) return null;
  const numerador = BigInt(baseCentavos) * BigInt(diferencaEscalada);
  return Number((numerador + BigInt(fatorTaxa / 2)) / BigInt(fatorTaxa));
};
const centavos = (valor: number) => Math.round(valor * 100);
const formatarReais = (valorCentavos: number) => (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ModalCalculadoraFiscal({ aberto, onFechar }: ModalCalculadoraFiscalProps) {
  const { empresaAtiva } = useEmpresa();
  const [abaCalculo, setAbaCalculo] = useState<'icms' | 'difal' | 'piscofins' | 'simples' | 'reforma'>('icms');
  const [copiado, setCopiado] = useState(false);
  const baseId = useId();

  // Estados ICMS
  const [ufOrigem, setUfOrigem] = useState<UF>('GO');
  const [ufDestino, setUfDestino] = useState<UF>('GO');
  const [saidaIcms, setSaidaIcms] = useState<string>('');
  const [entradaIcms, setEntradaIcms] = useState<string>('');
  const [aliquotaIcms, setAliquotaIcms] = useState<string>('');
  const [baseDifal, setBaseDifal] = useState<string>('');
  const [aliquotaOrigemDifal, setAliquotaOrigemDifal] = useState<string>('');
  const [aliquotaDestinoDifal, setAliquotaDestinoDifal] = useState<string>('');
  const [valorInformadoDifal, setValorInformadoDifal] = useState<string>('');

  // Estados PIS/COFINS
  const [regimePis, setRegimePis] = useState<RegimeTributario>('PRESUMIDO');
  const [basePis, setBasePis] = useState<string>('');
  const [aliquotaPis, setAliquotaPis] = useState<string>('');
  const [aliquotaCofins, setAliquotaCofins] = useState<string>('');

  // Estados Simples Nacional
  const [faturamentoSimples, setFaturamentoSimples] = useState<string>('');
  const [aliquotaEfetivaSimples, setAliquotaEfetivaSimples] = useState<string>('');

  // Estados Reforma Tributária
  const [baseReforma, setBaseReforma] = useState<string>('');
  const [aliquotaIbs, setAliquotaIbs] = useState<string>('');
  const [aliquotaCbs, setAliquotaCbs] = useState<string>('');

  // Sincroniza automaticamente com o regime e UF da empresa ativa
  useEffect(() => {
    if (aberto && empresaAtiva) {
      if (empresaAtiva.uf && FISCOIA_FISCAL.UFS.includes(empresaAtiva.uf.toUpperCase() as UF)) {
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
  const vSaida = parseValor(saidaIcms);
  const vEntrada = parseValor(entradaIcms);
  const aliqIcmsAplicada = parseAliquota(aliquotaIcms);
  const camposIcmsValidos = [vSaida, vEntrada, aliqIcmsAplicada].every(Number.isFinite);
  const resultadoIcms = FISCOIA_FISCAL.CALCULADORA_FISCAL.calcularICMS(vSaida, vEntrada, aliqIcmsAplicada);

  // DIFAL: resultado é apenas aritmético com base/alíquotas informadas. A tela
  // exige comparação com o valor de referência e mantém a validação legal pendente.
  const vBaseDifal = parseValor(baseDifal);
  const aliqOrigemDifal = parseAliquota(aliquotaOrigemDifal);
  const aliqDestinoDifal = parseAliquota(aliquotaDestinoDifal);
  const vInformadoDifal = parseValor(valorInformadoDifal);
  const dadosDifalCompletos = [vBaseDifal, aliqOrigemDifal, aliqDestinoDifal, vInformadoDifal].every(Number.isFinite)
    && baseDifal.trim() !== '' && aliquotaOrigemDifal.trim() !== ''
    && aliquotaDestinoDifal.trim() !== '' && valorInformadoDifal.trim() !== '';
  const difalCalculadoCentavos = dadosDifalCompletos ? calcularDifalCentavos(centavos(vBaseDifal), aliqOrigemDifal, aliqDestinoDifal) : null;
  const difalInformadoCentavos = dadosDifalCompletos ? centavos(vInformadoDifal) : null;
  const diferencaDifalCentavos = difalCalculadoCentavos !== null && difalInformadoCentavos !== null
    ? difalInformadoCentavos - difalCalculadoCentavos : null;

  // Cálculos PIS/COFINS
  const vBasePis = parseValor(basePis);
  const aliqPisAplicada = parseAliquota(aliquotaPis);
  const aliqCofinsAplicada = parseAliquota(aliquotaCofins);
  const camposPisCofinsValidos = [vBasePis, aliqPisAplicada, aliqCofinsAplicada].every(Number.isFinite);
  const resultadoPisCofins = FISCOIA_FISCAL.CALCULADORA_FISCAL.calcularPisCofins(vBasePis, aliqPisAplicada, aliqCofinsAplicada, regimePis);

  // Cálculos Simples Nacional
  const vFatSimples = parseValor(faturamentoSimples);
  const aliqEfetivaSimples = parseAliquota(aliquotaEfetivaSimples);
  const camposSimplesValidos = [vFatSimples, aliqEfetivaSimples].every(Number.isFinite);
  const resultadoSimples = FISCOIA_FISCAL.CALCULADORA_FISCAL.calcularSimples(vFatSimples, aliqEfetivaSimples);

  // Cálculos Reforma IBS/CBS
  const vBaseReforma = parseValor(baseReforma);
  const aliqIbsAplicada = parseAliquota(aliquotaIbs);
  const aliqCbsAplicada = parseAliquota(aliquotaCbs);
  const camposReformaValidos = [vBaseReforma, aliqIbsAplicada, aliqCbsAplicada].every(Number.isFinite);
  const resultadoReforma = FISCOIA_FISCAL.CALCULADORA_FISCAL.calcularIBS_CBS(vBaseReforma, aliqIbsAplicada, aliqCbsAplicada);

  const copiarResultado = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const listaUfs = FISCOIA_FISCAL.UFS;

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
            { id: 'difal', rotulo: '🧾 DIFAL' },
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
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 leading-relaxed">
                Informe a alíquota aplicável à operação conforme o documento fiscal e a regra vigente. UF de origem/destino são apenas referências; o sistema não determina alíquota, benefício, DIFAL ou crédito automaticamente.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                    <label htmlFor={`${baseId}-uf-origem`} className="font-bold text-slate-700 block mb-1">UF Origem (referência)</label>
                  <select
                    id={`${baseId}-uf-origem`}
                    value={ufOrigem}
                    onChange={(e) => setUfOrigem(e.target.value as UF)}
                    className="w-full p-2 rounded-lg border border-slate-300 font-bold text-slate-800 bg-white"
                  >
                    {listaUfs.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>

                <div>
                    <label htmlFor={`${baseId}-uf-destino`} className="font-bold text-slate-700 block mb-1">UF Destino (referência)</label>
                  <select
                    id={`${baseId}-uf-destino`}
                    value={ufDestino}
                    onChange={(e) => setUfDestino(e.target.value as UF)}
                    className="w-full p-2 rounded-lg border border-slate-300 font-bold text-slate-800 bg-white"
                  >
                    {listaUfs.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor={`${baseId}-aliquota-icms`} className="font-bold text-slate-700 block mb-1">Alíquota de ICMS (%) — informe a aplicável à operação</label>
                <input id={`${baseId}-aliquota-icms`} type="number" min="0" max="100" step="0.01" value={aliquotaIcms} onChange={e => setAliquotaIcms(e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold" placeholder="Ex.: 17,00" />
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
                    placeholder="Ex.: 10000,00"
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
                    placeholder="Ex.: 5000,00"
                  />
                </div>
              </div>

              {/* CARD DE RESULTADO ICMS */}
              {!camposIcmsValidos && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-900">Confira os campos: use valores em reais como 1.234,56 ou 1234.56 e alíquotas entre 0 e 100. Nenhuma estimativa foi calculada.</p>}
              {camposIcmsValidos && vSaida > 0 && aliqIcmsAplicada > 0 ? <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-800">Estimativa aritmética de ICMS</span>
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
                    <div className="text-[10px] text-slate-500 font-semibold">Entrada × mesma alíquota informada</div>
                    <div className="text-sm font-bold text-emerald-600 font-mono">
                      R$ {resultadoIcms.credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="p-2 bg-blue-50 border border-blue-300 rounded-lg">
                    <div className="text-[10px] text-blue-900 font-bold">Diferença aritmética, não imposto devido</div>
                    <div className="text-sm font-black text-blue-700 font-mono">
                      R$ {resultadoIcms.aPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => copiarResultado(`Estimativa aritmética de ICMS ${ufOrigem}->${ufDestino}: saída × alíquota R$ ${resultadoIcms.debito.toFixed(2)} | entrada × mesma alíquota R$ ${resultadoIcms.credito.toFixed(2)} | diferença R$ ${resultadoIcms.aPagar.toFixed(2)}. Não é apuração nem valor devido.`)}
                  className="w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiado ? 'Copiado para Área de Transferência!' : 'Copiar Resultado'}</span>
                </button>
              </div> : <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">Informe valor de saídas e alíquota para calcular uma estimativa manual. Créditos de entrada não são validados pela regra fiscal.</div>}
            </div>
          )}

          {abaCalculo === 'difal' && (
            <section className="space-y-4" aria-labelledby={`${baseId}-difal-title`}>
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 leading-relaxed">
                <strong id={`${baseId}-difal-title`}>Conferência aritmética do DIFAL — sempre pendente de validação legal.</strong>{' '}
                A Constituição define a diferença entre a alíquota interna do destino e a interestadual. A base e as alíquotas variam conforme operação, produto, UF, regime, benefícios e regra vigente; informe os valores confirmados para esta operação. Esta tela não consulta legislação estadual nem emite guia.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${baseId}-difal-origem-uf`} className="mb-1 block font-bold text-slate-700">UF de origem</label>
                  <select id={`${baseId}-difal-origem-uf`} value={ufOrigem} onChange={e => setUfOrigem(e.target.value as UF)} className="w-full rounded-lg border border-slate-300 bg-white p-2 font-bold text-slate-800">
                    {listaUfs.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${baseId}-difal-destino-uf`} className="mb-1 block font-bold text-slate-700">UF de destino</label>
                  <select id={`${baseId}-difal-destino-uf`} value={ufDestino} onChange={e => setUfDestino(e.target.value as UF)} className="w-full rounded-lg border border-slate-300 bg-white p-2 font-bold text-slate-800">
                    {listaUfs.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${baseId}-difal-base`} className="mb-1 block font-bold text-slate-700">Base de cálculo confirmada (R$)</label>
                  <input id={`${baseId}-difal-base`} inputMode="decimal" value={baseDifal} onChange={e => setBaseDifal(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 font-mono font-bold" placeholder="Ex.: 1.000,00" />
                </div>
                <div>
                  <label htmlFor={`${baseId}-difal-origem`} className="mb-1 block font-bold text-slate-700">Alíquota interestadual / origem (%)</label>
                  <input id={`${baseId}-difal-origem`} inputMode="decimal" value={aliquotaOrigemDifal} onChange={e => setAliquotaOrigemDifal(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 font-mono font-bold" placeholder="Informe a confirmada" />
                </div>
                <div>
                  <label htmlFor={`${baseId}-difal-destino`} className="mb-1 block font-bold text-slate-700">Alíquota interna / destino (%)</label>
                  <input id={`${baseId}-difal-destino`} inputMode="decimal" value={aliquotaDestinoDifal} onChange={e => setAliquotaDestinoDifal(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 font-mono font-bold" placeholder="Informe a confirmada" />
                </div>
                <div>
                  <label htmlFor={`${baseId}-difal-informado`} className="mb-1 block font-bold text-slate-700">Valor a conferir (R$)</label>
                  <input id={`${baseId}-difal-informado`} inputMode="decimal" value={valorInformadoDifal} onChange={e => setValorInformadoDifal(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 font-mono font-bold" placeholder="Valor da nota/guia" />
                </div>
              </div>
              {dadosDifalCompletos && (ufOrigem === ufDestino || difalCalculadoCentavos === null) && (
                <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 font-bold text-rose-900">PENDENTE: confira as UFs e as alíquotas. A alíquota de destino deve superar a interestadual para esta conferência aritmética.</p>
              )}
              {!dadosDifalCompletos && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 font-bold text-amber-900">PENDENTE — preencha base, alíquotas confirmadas e valor a conferir. Nenhum dado será presumido.</p>}
              {dadosDifalCompletos && difalCalculadoCentavos !== null && difalInformadoCentavos !== null && (
                <div className={`space-y-3 rounded-xl border p-4 ${diferencaDifalCentavos === 0 ? 'border-amber-300 bg-amber-50' : 'border-rose-300 bg-rose-50'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 pb-2">
                    <strong className="text-sm text-slate-900">Conferência do DIFAL — {ufOrigem} → {ufDestino}</strong>
                    <span role="status" className="rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-950">{diferencaDifalCentavos === 0 ? 'PENDENTE — revisão legal oficial' : 'PENDENTE — valor divergente'}</span>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                    <div className="rounded-lg border bg-white p-2"><dt className="text-[10px] text-slate-500">Base</dt><dd className="font-mono font-bold">{formatarReais(centavos(vBaseDifal))}</dd></div>
                    <div className="rounded-lg border bg-white p-2"><dt className="text-[10px] text-slate-500">Origem / interestadual</dt><dd className="font-mono font-bold">{aliqOrigemDifal}%</dd></div>
                    <div className="rounded-lg border bg-white p-2"><dt className="text-[10px] text-slate-500">Destino / interna</dt><dd className="font-mono font-bold">{aliqDestinoDifal}%</dd></div>
                    <div className="rounded-lg border border-blue-300 bg-blue-50 p-2"><dt className="text-[10px] text-blue-900">DIFAL calculado</dt><dd className="font-mono font-black text-blue-900">{formatarReais(difalCalculadoCentavos)}</dd></div>
                  </dl>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <p className="rounded-lg bg-white p-2">Valor informado: <strong className="font-mono">{formatarReais(difalInformadoCentavos)}</strong></p>
                    <p className="rounded-lg bg-white p-2">Diferença (informado − calculado): <strong className="font-mono">{formatarReais(diferencaDifalCentavos ?? 0)}</strong></p>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-700">Fórmula usada nesta conferência: base informada × (alíquota interna do destino − alíquota interestadual), arredondada uma vez para centavos (half-up). Qualquer diferença, inclusive R$ 0,01, mantém pendente. Mesmo se coincidir, confirme base, incidência, FCP, benefícios e regra estadual vigente antes de recolher.</p>
                </div>
              )}
            </section>
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
                    <option value="PRESUMIDO">Lucro Presumido</option>
                    <option value="REAL">Lucro Real</option>
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
                    placeholder="Ex.: 10000,00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label htmlFor={`${baseId}-aliquota-pis`} className="font-bold text-slate-700 block mb-1">Alíquota PIS (%)</label><input id={`${baseId}-aliquota-pis`} type="number" min="0" max="100" step="0.01" value={aliquotaPis} onChange={e => setAliquotaPis(e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold" placeholder="Informe a alíquota aplicável" /></div>
                <div><label htmlFor={`${baseId}-aliquota-cofins`} className="font-bold text-slate-700 block mb-1">Alíquota COFINS (%)</label><input id={`${baseId}-aliquota-cofins`} type="number" min="0" max="100" step="0.01" value={aliquotaCofins} onChange={e => setAliquotaCofins(e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold" placeholder="Informe a alíquota aplicável" /></div>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950">Estimativa aritmética manual. O sistema não valida regime de incidência, créditos, exclusões da base ou tratamento da operação.</div>

              {/* CARD DE RESULTADO PIS/COFINS */}
              {!camposPisCofinsValidos && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-900">Confira a base e as alíquotas: valores em reais devem estar entre 0 e o limite seguro, e percentuais entre 0 e 100. Nenhuma estimativa foi calculada.</p>}
              {camposPisCofinsValidos && vBasePis > 0 && aliqPisAplicada > 0 && aliqCofinsAplicada > 0 ? <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-800">
                    Estimativa aritmética — {regimePis === 'PRESUMIDO' ? 'Lucro Presumido informado' : regimePis === 'REAL' ? 'Lucro Real informado' : 'Simples Nacional informado'}
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
              </div> : <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">Informe a base e ambas as alíquotas para exibir a estimativa.</div>}
            </div>
          )}

          {/* ======================= MODO SIMPLES NACIONAL ======================= */}
          {abaCalculo === 'simples' && (
            <div className="space-y-4">
              <div>
                <label htmlFor={`${baseId}-fat-simples`} className="font-bold text-slate-700 block mb-1">Base de receita do mês (R$)</label>
                <input
                  id={`${baseId}-fat-simples`}
                  type="text"
                  value={faturamentoSimples}
                  onChange={(e) => setFaturamentoSimples(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono font-bold text-sm"
                  placeholder="Ex.: 10000,00"
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-aliquota-simples`} className="font-bold text-slate-700 block mb-1">Alíquota efetiva obtida no PGDAS-D (%)</label>
                <input id={`${baseId}-aliquota-simples`} type="number" min="0" max="100" step="0.01" value={aliquotaEfetivaSimples} onChange={e => setAliquotaEfetivaSimples(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 font-mono font-bold text-sm" placeholder="Informe a alíquota efetiva confirmada" />
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950">O DAS depende do anexo, RBT12, segregação de receitas, fator R e outras regras. Esta tela não calcula faixa nem consulta o PGDAS-D; só multiplica os valores informados.</div>

              {/* CARD DE RESULTADO SIMPLES */}
              {!camposSimplesValidos && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-900">Confira a base e a alíquota: use valor monetário válido e percentual entre 0 e 100. Nenhuma estimativa foi calculada.</p>}
              {camposSimplesValidos && vFatSimples > 0 && aliqEfetivaSimples > 0 ? <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                  <span className="font-bold text-emerald-900">Estimativa aritmética</span>
                  <span className="font-mono text-xs bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-black">
                    Alíquota informada: {resultadoSimples.aliquota}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                    <div className="text-[10px] text-slate-500 font-semibold">Base mensal informada</div>
                    <div className="text-sm font-bold text-slate-800 font-mono">
                      R$ {resultadoSimples.baseMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="p-2.5 bg-emerald-100/70 border border-emerald-300 rounded-lg">
                    <div className="text-[10px] text-emerald-900 font-bold">DAS Mensal Estimado</div>
                    <div className="text-base font-black text-emerald-800 font-mono">
                      R$ {resultadoSimples.DAS_Mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-emerald-800 bg-emerald-100/50 p-2 rounded-lg leading-relaxed">Resultado calculado apenas com os dados informados. Não é guia, apuração oficial nem confirmação do valor devido.</div>
              </div> : <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">Informe base mensal e alíquota efetiva do PGDAS-D para exibir uma estimativa aritmética.</div>}
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
                  placeholder="Ex.: 10000,00"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label htmlFor={`${baseId}-aliquota-ibs`} className="font-bold text-slate-700 block mb-1">Alíquota IBS (%)</label><input id={`${baseId}-aliquota-ibs`} type="number" min="0" max="100" step="0.01" value={aliquotaIbs} onChange={e => setAliquotaIbs(e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold" placeholder="Informe alíquota confirmada" /></div>
                <div><label htmlFor={`${baseId}-aliquota-cbs`} className="font-bold text-slate-700 block mb-1">Alíquota CBS (%)</label><input id={`${baseId}-aliquota-cbs`} type="number" min="0" max="100" step="0.01" value={aliquotaCbs} onChange={e => setAliquotaCbs(e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold" placeholder="Informe alíquota confirmada" /></div>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950">As alíquotas dependem da regra vigente, operação, destino, regime e período de transição. Esta ferramenta não as fornece nem valida o tributo devido.</div>

              {/* CARD DE RESULTADO REFORMA */}
              {!camposReformaValidos && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-900">Confira a base e as alíquotas: use valor monetário válido e percentuais entre 0 e 100. Nenhuma estimativa foi calculada.</p>}
              {camposReformaValidos && vBaseReforma > 0 && aliqIbsAplicada > 0 && aliqCbsAplicada > 0 ? <div className="p-4 bg-gradient-to-br from-sky-50 to-purple-50 border border-indigo-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                  <span className="font-bold text-indigo-950">Novo Modelo Tributário Nacional</span>
                  <span className="font-mono text-xs bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded font-black">
                    IBS {aliqIbsAplicada}% + CBS {aliqCbsAplicada}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-white rounded-lg border border-sky-300">
                    <div className="text-[10px] text-sky-800 font-bold">IBS aritmético estimado</div>
                    <div className="text-sm font-black text-sky-700 font-mono">
                      R$ {resultadoReforma.IBS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="p-2 bg-white rounded-lg border border-purple-300">
                    <div className="text-[10px] text-purple-800 font-bold">CBS aritmética estimada</div>
                    <div className="text-sm font-black text-purple-700 font-mono">
                      R$ {resultadoReforma.CBS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="p-2 bg-gradient-to-r from-sky-100 to-purple-100 border border-indigo-300 rounded-lg">
                    <div className="text-[10px] text-indigo-950 font-bold">Soma aritmética, não carga devida</div>
                    <div className="text-sm font-black text-indigo-900 font-mono">
                      R$ {resultadoReforma.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-indigo-900 bg-white/80 p-2.5 rounded-lg leading-relaxed border border-indigo-200">
                  Estimativa baseada somente na base e nas alíquotas digitadas. A tela não aplica regras de transição, reduções, créditos, destino ou apuração oficial.
                </div>
              </div> : <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">Informe a base e as alíquotas para exibir uma estimativa aritmética.</div>}
            </div>
          )}
        </div>

        {/* RODAPÉ DO MODAL */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            Ferramenta aritmética manual • sem consulta à legislação nem validação oficial de alíquotas
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
