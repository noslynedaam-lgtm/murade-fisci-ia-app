import { useState, useEffect } from 'react';
import BotaoVoltar from '../components/BotaoVoltar';
import { format } from 'date-fns';
import { registrarDisparoEmailGenerico } from '../services/auth/auth.service';
import { EmpresaDados, GuiaFiscal } from '../types';
import { useEmpresa } from '../context/EmpresaContext';
import SeletorEmpresaGlobal from '../components/SeletorEmpresaGlobal';
import { gerarLinhaDigitavelDARF } from '../services/serpro/guiasReceita.service';
import { 
  FileText, Calendar, DollarSign, CheckCircle2, ChevronDown, ChevronUp,
  Printer, Mail, AlertCircle, Building2, Download, ShieldCheck, X, Sparkles, Plus, Server, Check
} from 'lucide-react';

// TIPOS DE GUIAS E ALÍQUOTAS (Conforme especificação fiscal)
export const TIPOS_GUIAS = {
  DAS: {
    nome: 'DAS — Simples Nacional',
    sigla: 'DAS',
    diaVencimento: 20,
    aliquotaMinima: 0.06, // 6%
    descricao: 'Documento de Arrecadação do Simples Nacional'
  },
  DARF_INSS: {
    nome: 'DARF Previdenciário (DCTFWeb)',
    sigla: 'DARF-INSS',
    diaVencimento: 20,
    aliquota: 0.20, // 20% INSS empresa
    descricao: 'Documento de Arrecadação de Receitas Federais Previdenciário (Receita Federal)'
  },
  FGTS_DIGITAL: {
    nome: 'FGTS Digital (MTE / Pix)',
    sigla: 'FGTS Digital',
    diaVencimento: 20,
    aliquota: 0.08, // 8% FGTS
    descricao: 'Guia de Recolhimento do FGTS Digital via Pix (Vencimento unificado dia 20 - MTE/Caixa)'
  },
  DARF_IRPJ: {
    nome: 'DARF — IRPJ',
    sigla: 'DARF',
    diaVencimento: 30,
    aliquota: 0.15, // 15%
    descricao: 'Imposto de Renda Pessoa Jurídica'
  },
  DARF_CSLL: {
    nome: 'DARF — CSLL',
    sigla: 'DARF',
    diaVencimento: 30,
    aliquota: 0.09, // 9%
    descricao: 'Contribuição Social sobre Lucro Líquido'
  },
  ICMS: {
    nome: 'DAMSP — ICMS',
    sigla: 'ICMS',
    diaVencimento: 15,
    aliquota: 0.12, // 12% média
    descricao: 'Imposto sobre Circulação de Mercadorias e Serviços'
  },
  ISS: {
    nome: 'ISS',
    sigla: 'ISS',
    diaVencimento: 10,
    aliquota: 0.05, // 5%
    descricao: 'Imposto sobre Serviços'
  }
};

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
    salvarNovaEmpresa(atualizada);
    selecionarEmpresa(atualizada);
    setEmpresaSelecionada(atualizada);
    const nomes = {
      SIMPLES: 'Simples Nacional',
      LUCRO_PRESUMIDO: 'Lucro Presumido',
      LUCRO_REAL: 'Lucro Real'
    };
    setToastNotificacao(`✅ Regime da empresa "${empresaSelecionada.razaoSocial}" salvo como ${nomes[novoRegime]} com sucesso! As guias serão geradas com base neste regime.`);
    setTimeout(() => setToastNotificacao(null), 4500);
  };

  const [baseCalculo, setBaseCalculo] = useState<string>('50000');
  const [mesReferencia, setMesReferencia] = useState<string>(() => {
    try {
      return format(new Date(), 'MM/yyyy');
    } catch {
      return '10/2026';
    }
  });

  const [guiasGeradas, setGuiasGeradas] = useState<GuiaFiscal[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Modais de visualização / disparo
  const [guiaImpressao, setGuiaImpressao] = useState<GuiaFiscal | null>(null);
  const [modalEmail, setModalEmail] = useState<{ guia: GuiaFiscal; destinatario: string } | null>(null);
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

  // Calcular vencimento ajustando fim de semana (se sábado ou domingo, prorroga para dia útil seguinte)
  const calcularVencimento = (dia: number, mesAno: string): Date => {
    const partes = mesAno.split('/');
    const mes = parseInt(partes[0] || '1', 10);
    const ano = parseInt(partes[1] || '2026', 10);
    const data = new Date(ano, mes - 1, dia);

    // Se domingo = segunda (+1 dia); se sábado = segunda (+2 dias)
    if (data.getDay() === 0) data.setDate(data.getDate() + 1);
    if (data.getDay() === 6) data.setDate(data.getDate() + 2);
    return data;
  };

  // Gerar guias conforme regime tributário
  const handleGerarGuias = () => {
    if (!empresaSelecionada) {
      alert('⚠️ Por favor, selecione ou cadastre uma empresa primeiro!');
      return;
    }

    const valorBaseLimpo = parseFloat(baseCalculo.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (isNaN(valorBaseLimpo) || valorBaseLimpo <= 0) {
      alert('⚠️ Informe um valor válido para a base de cálculo / faturamento!');
      return;
    }

    setCarregando(true);

    setTimeout(() => {
      const novasGuias: GuiaFiscal[] = [];
      const cnpjLimpo = (empresaSelecionada.cnpj || '').replace(/\D/g, '');
      const refLimpa = mesReferencia.replace('/', '');
      const regime = empresaSelecionada.regimeTributario || 'SIMPLES';

      // 1. SIMPLES NACIONAL → apenas DAS
      if (regime === 'SIMPLES' || regime === 'MEI') {
        const tipo = TIPOS_GUIAS.DAS;
        const valorImposto = valorBaseLimpo * tipo.aliquotaMinima;
        const venc = calcularVencimento(tipo.diaVencimento, mesReferencia);
        const { linhaDigitavel } = gerarLinhaDigitavelDARF('1010', valorImposto, venc);
        novasGuias.push({
          id: `DAS_${cnpjLimpo}_${refLimpa}`,
          tipo: tipo.nome,
          sigla: tipo.sigla,
          descricao: tipo.descricao,
          valorBase: valorBaseLimpo,
          aliquota: tipo.aliquotaMinima * 100,
          valorImposto: valorImposto,
          vencimento: venc,
          referencia: mesReferencia,
          codigoBarra: linhaDigitavel
        });
      }

      // 2. LUCRO PRESUMIDO → ICMS + ISS + IRPJ + CSLL
      if (regime === 'LUCRO_PRESUMIDO') {
        // ICMS
        const icms = TIPOS_GUIAS.ICMS;
        const valorIcms = valorBaseLimpo * icms.aliquota;
        const vencIcms = calcularVencimento(icms.diaVencimento, mesReferencia);
        const { linhaDigitavel: ldIcms } = gerarLinhaDigitavelDARF('1200', valorIcms, vencIcms);
        novasGuias.push({
          id: `ICMS_${cnpjLimpo}_${refLimpa}`,
          tipo: icms.nome,
          sigla: icms.sigla,
          descricao: icms.descricao,
          valorBase: valorBaseLimpo,
          aliquota: icms.aliquota * 100,
          valorImposto: valorIcms,
          vencimento: vencIcms,
          referencia: mesReferencia,
          codigoBarra: ldIcms
        });

        // ISS
        const iss = TIPOS_GUIAS.ISS;
        const valorIss = valorBaseLimpo * iss.aliquota;
        const vencIss = calcularVencimento(iss.diaVencimento, mesReferencia);
        const { linhaDigitavel: ldIss } = gerarLinhaDigitavelDARF('1300', valorIss, vencIss);
        novasGuias.push({
          id: `ISS_${cnpjLimpo}_${refLimpa}`,
          tipo: iss.nome,
          sigla: iss.sigla,
          descricao: iss.descricao,
          valorBase: valorBaseLimpo,
          aliquota: iss.aliquota * 100,
          valorImposto: valorIss,
          vencimento: vencIss,
          referencia: mesReferencia,
          codigoBarra: ldIss
        });

        // IRPJ Presumido (15% sobre presunção de 32% = 4,8% total)
        const irpj = TIPOS_GUIAS.DARF_IRPJ;
        const basePresumidaIRPJ = valorBaseLimpo * 0.32;
        const valorIrpj = basePresumidaIRPJ * irpj.aliquota;
        const vencIrpj = calcularVencimento(irpj.diaVencimento, mesReferencia);
        const { linhaDigitavel: ldIrpj } = gerarLinhaDigitavelDARF('2088', valorIrpj, vencIrpj);
        novasGuias.push({
          id: `IRPJ_${cnpjLimpo}_${refLimpa}`,
          tipo: irpj.nome,
          sigla: irpj.sigla,
          descricao: `${irpj.descricao} (Presunção de 32% s/ receita)`,
          valorBase: basePresumidaIRPJ,
          aliquota: irpj.aliquota * 100,
          valorImposto: valorIrpj,
          vencimento: vencIrpj,
          referencia: mesReferencia,
          codigoBarra: ldIrpj
        });

        // CSLL Presumida (9% sobre presunção de 12% = 1,08% total)
        const csll = TIPOS_GUIAS.DARF_CSLL;
        const basePresumidaCSLL = valorBaseLimpo * 0.12;
        const valorCsll = basePresumidaCSLL * csll.aliquota;
        const vencCsll = calcularVencimento(csll.diaVencimento, mesReferencia);
        const { linhaDigitavel: ldCsll } = gerarLinhaDigitavelDARF('2372', valorCsll, vencCsll);
        novasGuias.push({
          id: `CSLL_${cnpjLimpo}_${refLimpa}`,
          tipo: csll.nome,
          sigla: csll.sigla,
          descricao: `${csll.descricao} (Presunção de 12% s/ receita)`,
          valorBase: basePresumidaCSLL,
          aliquota: csll.aliquota * 100,
          valorImposto: valorCsll,
          vencimento: vencCsll,
          referencia: mesReferencia,
          codigoBarra: ldCsll
        });
      }

      // 3. LUCRO REAL → ICMS + ISS + IRPJ + CSLL + DARF Previdenciário (DCTFWeb) + FGTS Digital
      if (regime === 'LUCRO_REAL') {
        const icms = TIPOS_GUIAS.ICMS;
        const valorIcms = valorBaseLimpo * icms.aliquota;
        const vencIcms = calcularVencimento(icms.diaVencimento, mesReferencia);
        const { linhaDigitavel: ldIcms } = gerarLinhaDigitavelDARF('1200', valorIcms, vencIcms);
        novasGuias.push({
          id: `ICMS_${cnpjLimpo}_${refLimpa}`,
          tipo: icms.nome,
          sigla: icms.sigla,
          descricao: icms.descricao,
          valorBase: valorBaseLimpo,
          aliquota: icms.aliquota * 100,
          valorImposto: valorIcms,
          vencimento: vencIcms,
          referencia: mesReferencia,
          codigoBarra: ldIcms
        });

        const iss = TIPOS_GUIAS.ISS;
        const valorIss = valorBaseLimpo * iss.aliquota;
        const vencIss = calcularVencimento(iss.diaVencimento, mesReferencia);
        const { linhaDigitavel: ldIss } = gerarLinhaDigitavelDARF('1300', valorIss, vencIss);
        novasGuias.push({
          id: `ISS_${cnpjLimpo}_${refLimpa}`,
          tipo: iss.nome,
          sigla: iss.sigla,
          descricao: iss.descricao,
          valorBase: valorBaseLimpo,
          aliquota: iss.aliquota * 100,
          valorImposto: valorIss,
          vencimento: vencIss,
          referencia: mesReferencia,
          codigoBarra: ldIss
        });

        const irpj = TIPOS_GUIAS.DARF_IRPJ;
        const valorIrpj = valorBaseLimpo * irpj.aliquota;
        const vencIrpj = calcularVencimento(irpj.diaVencimento, mesReferencia);
        const { linhaDigitavel: ldIrpj } = gerarLinhaDigitavelDARF('0220', valorIrpj, vencIrpj);
        novasGuias.push({
          id: `IRPJ_${cnpjLimpo}_${refLimpa}`,
          tipo: irpj.nome,
          sigla: irpj.sigla,
          descricao: `${irpj.descricao} (Lucro Real apurado)`,
          valorBase: valorBaseLimpo,
          aliquota: irpj.aliquota * 100,
          valorImposto: valorIrpj,
          vencimento: vencIrpj,
          referencia: mesReferencia,
          codigoBarra: ldIrpj
        });

        const csll = TIPOS_GUIAS.DARF_CSLL;
        const valorCsll = valorBaseLimpo * csll.aliquota;
        const vencCsll = calcularVencimento(csll.diaVencimento, mesReferencia);
        const { linhaDigitavel: ldCsll } = gerarLinhaDigitavelDARF('6012', valorCsll, vencCsll);
        novasGuias.push({
          id: `CSLL_${cnpjLimpo}_${refLimpa}`,
          tipo: csll.nome,
          sigla: csll.sigla,
          descricao: `${csll.descricao} (Lucro Real apurado)`,
          valorBase: valorBaseLimpo,
          aliquota: csll.aliquota * 100,
          valorImposto: valorCsll,
          vencimento: vencCsll,
          referencia: mesReferencia,
          codigoBarra: ldCsll
        });

        const darfInss = TIPOS_GUIAS.DARF_INSS;
        const valorDarf = valorBaseLimpo * darfInss.aliquota;
        const vencDarf = calcularVencimento(darfInss.diaVencimento, mesReferencia);
        const { linhaDigitavel: ldDarf } = gerarLinhaDigitavelDARF('1410', valorDarf, vencDarf);
        novasGuias.push({
          id: `DARF_INSS_${cnpjLimpo}_${refLimpa}`,
          tipo: darfInss.nome,
          sigla: darfInss.sigla,
          descricao: darfInss.descricao,
          valorBase: valorBaseLimpo,
          aliquota: darfInss.aliquota * 100,
          valorImposto: valorDarf,
          vencimento: vencDarf,
          referencia: mesReferencia,
          codigoBarra: ldDarf
        });

        const fgts = TIPOS_GUIAS.FGTS_DIGITAL;
        const valorFgts = valorBaseLimpo * fgts.aliquota;
        const vencFgts = calcularVencimento(fgts.diaVencimento, mesReferencia);
        const { linhaDigitavel: ldFgts } = gerarLinhaDigitavelDARF('8000', valorFgts, vencFgts);
        novasGuias.push({
          id: `FGTS_${cnpjLimpo}_${refLimpa}`,
          tipo: fgts.nome,
          sigla: fgts.sigla,
          descricao: fgts.descricao,
          valorBase: valorBaseLimpo,
          aliquota: fgts.aliquota * 100,
          valorImposto: valorFgts,
          vencimento: vencFgts,
          referencia: mesReferencia,
          codigoBarra: ldFgts
        });
      }

      setGuiasGeradas(novasGuias);
      setCarregando(false);
      setExpanded(novasGuias[0]?.id || null);
    }, 600);
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const formatarData = (data: Date | string) => {
    const d = new Date(data);
    return isNaN(d.getTime()) ? String(data) : format(d, 'dd/MM/yyyy');
  };

  const totalImpostos = guiasGeradas.reduce((soma, g) => soma + g.valorImposto, 0);

  const handleDispararEmail = (guia: GuiaFiscal, emailDestino: string) => {
    registrarDisparoEmailGenerico({
      para: emailDestino,
      assunto: `[FISCOIA] Guia de Recolhimento Fiscal — ${guia.tipo} (${guia.referencia})`,
      corpo: `Prezado cliente ${empresaSelecionada.razaoSocial},\n\nSegue a guia ${guia.tipo} referente ao período ${guia.referencia} com vencimento em ${formatarData(guia.vencimento)}.\n\nValor: ${formatarMoeda(guia.valorImposto)}\nLinha Digitável / Código de Barras:\n${guia.codigoBarra}\n\nAtenciosamente,\nFISCOIA Compliance Fiscal & Equipe Contábil`,
      tipo: 'ACESSO_INICIAL'
    });

    setModalEmail(null);
    setToastNotificacao(`Guia ${guia.sigla} enviada com sucesso para ${emailDestino}!`);
    setTimeout(() => setToastNotificacao(null), 4000);
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
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{toastNotificacao}</span>
        </div>
      )}

      {/* ÁREA DE CÁLCULO */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm mb-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#e8eaf6]">
          <h2 className="text-lg font-bold text-[#1a237e] flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#1a237e]" />
            <span>💰 Base de Cálculo & Período</span>
          </h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            Regras Fiscais 2026
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Mês de Referência</span>
            </label>
            <input
              type="text"
              value={mesReferencia}
              onChange={(e) => setMesReferencia(e.target.value)}
              placeholder="MM/AAAA"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
            />
            <p className="text-[11px] text-slate-400 mt-1">Ex: 10/2026 ou 09/2026</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-[#1a237e]" />
              <span>Valor do Faturamento / Base de Cálculo *</span>
            </label>
            <input
              type="text"
              value={baseCalculo}
              onChange={(e) => setBaseCalculo(e.target.value)}
              placeholder="R$ 0,00"
              className="w-full px-4 py-2.5 bg-[#e8eaf6] border-2 border-[#1a237e] rounded-xl text-lg font-extrabold text-[#1a237e] focus:bg-white focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">Receita bruta da competência para apuração automática</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGerarGuias}
          disabled={carregando}
          className="w-full py-4 px-6 rounded-2xl bg-[#1a237e] hover:bg-[#283593] text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {carregando ? (
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Processando Alíquotas e Guias...</span>
            </span>
          ) : (
            <span>📄 Gerar Guias Fiscais</span>
          )}
        </button>
      </div>

      {/* RESULTADO — GUIAS GERADAS */}
      {guiasGeradas.length > 0 && (
        <div className="space-y-4">
          {/* Totalizador */}
          <div className="bg-[#e8f5e9] border border-emerald-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-[#2e7d32]" />
              <span className="text-base font-bold text-[#2e7d32]">
                📋 {guiasGeradas.length} guias geradas com sucesso
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-emerald-800 uppercase font-bold tracking-wider block">
                Total Tributário a Recolher:
              </span>
              <span className="text-2xl font-black text-[#2e7d32]">
                {formatarMoeda(totalImpostos)}
              </span>
            </div>
          </div>

          {/* Lista de Guias */}
          <div className="space-y-3">
            {guiasGeradas.map((guia) => {
              const estaExpandido = expanded === guia.id;
              return (
                <div
                  key={guia.id}
                  className="bg-white rounded-2xl border-l-4 border-l-[#1a237e] border border-slate-200 shadow-sm p-4 sm:p-5 transition-all"
                >
                  <div
                    onClick={() => setExpanded(estaExpandido ? null : guia.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-indigo-100 text-[#1a237e]">
                          {guia.sigla}
                        </span>
                        <h3 className="text-base font-bold text-slate-900">{guia.tipo}</h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Ref: <strong>{guia.referencia}</strong> {guia.descricao && `• ${guia.descricao}`}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-left sm:text-right">
                        <div className="text-lg font-extrabold text-[#1a237e]">
                          {formatarMoeda(guia.valorImposto)}
                        </div>
                        <div className="text-xs font-semibold text-amber-600">
                          Venc: {formatarData(guia.vencimento)}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-600 p-1"
                        aria-label="Expandir detalhes"
                      >
                        {estaExpandido ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Detalhes Expansíveis */}
                  {estaExpandido && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-in fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 rounded-xl p-3 text-xs">
                        <div>
                          <span className="text-slate-500 block">Base de Cálculo:</span>
                          <span className="font-bold text-slate-900 text-sm">{formatarMoeda(guia.valorBase)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Alíquota Efetiva:</span>
                          <span className="font-bold text-slate-900 text-sm">{guia.aliquota.toFixed(2)}%</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Vencimento Ajustado (Dia Útil):</span>
                          <span className="font-bold text-amber-700 text-sm">{formatarData(guia.vencimento)}</span>
                        </div>
                      </div>

                      {/* Código de Barras */}
                      <div className="p-3 bg-slate-900 text-amber-300 rounded-xl font-mono text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-sans">
                            Linha Digitável / Código de Barras Bancário:
                          </span>
                          <span className="tracking-wider break-all">{guia.codigoBarra}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(guia.codigoBarra);
                            alert('Código de barras copiado para a área de transferência!');
                          }}
                          className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[11px] font-sans font-bold cursor-pointer shrink-0"
                        >
                          Copiar Código
                        </button>
                      </div>

                      {/* Botões de Ação: Emitir PDF & Enviar por E-mail */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setGuiaImpressao(guia)}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-[#e8eaf6] hover:bg-indigo-100 text-[#1a237e] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                          <span>📄 Emitir Guia em PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setModalEmail({ guia, destinatario: empresaSelecionada.email || 'contato@empresa.com.br' })}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-[#fff3e0] hover:bg-amber-100 text-[#e65100] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                          <span>📧 Enviar por E-mail</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL DE EMISSÃO DE PDF / IMPRESSÃO */}
      {guiaImpressao && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 text-[#1a237e]">
                <Printer className="w-6 h-6" />
                <h3 className="text-xl font-bold">Visualização do Documento de Arrecadação</h3>
              </div>
              <button
                onClick={() => setGuiaImpressao(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Guia Estilizada para Impressão */}
            <div className="border-2 border-slate-800 rounded-xl p-5 space-y-4 bg-white text-slate-900 font-sans">
              <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#1a237e] text-white flex items-center justify-center font-black text-xl">
                    BR
                  </div>
                  <div>
                    <h4 className="font-black text-base uppercase tracking-tight">{guiaImpressao.tipo}</h4>
                    <p className="text-[11px] text-slate-600">DOCUMENTO OFICIAL DE ARRECADAÇÃO FISCAL</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">VENCIMENTO</span>
                  <span className="text-lg font-black text-[#1a237e]">{formatarData(guiaImpressao.vencimento)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border-b border-slate-200 pb-3">
                <div>
                  <span className="text-slate-500 block text-[10px]">RAZÃO SOCIAL</span>
                  <strong className="truncate block">{empresaSelecionada.razaoSocial}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">CNPJ</span>
                  <strong className="font-mono">{empresaSelecionada.cnpj}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">COMPETÊNCIA</span>
                  <strong>{guiaImpressao.referencia}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">VALOR TOTAL</span>
                  <strong className="text-[#1a237e] text-sm">{formatarMoeda(guiaImpressao.valorImposto)}</strong>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Base de Cálculo Declarada:</span>
                  <span className="font-semibold">{formatarMoeda(guiaImpressao.valorBase)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Alíquota Aplicada:</span>
                  <span className="font-semibold">{guiaImpressao.aliquota.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Multa / Juros de Mora:</span>
                  <span className="font-semibold">R$ 0,00</span>
                </div>
                <div className="flex justify-between py-1 font-bold text-sm">
                  <span>Valor Líquido da Guia:</span>
                  <span className="text-[#1a237e]">{formatarMoeda(guiaImpressao.valorImposto)}</span>
                </div>
              </div>

              {/* Código de Barras Gráfico Simulado */}
              <div className="pt-3 border-t border-slate-200 text-center space-y-2">
                <p className="font-mono text-xs text-slate-800 tracking-widest">{guiaImpressao.codigoBarra}</p>
                <div className="h-12 w-full bg-[repeating-linear-gradient(90deg,#000,#000_2px,transparent_2px,transparent_4px)] opacity-90 rounded"></div>
                <p className="text-[10px] text-slate-500">
                  Autenticação Mecânica • Caixa Econômica Federal / Banco do Brasil / Internet Banking
                </p>
              </div>
            </div>

            {/* Ações da Modal */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setGuiaImpressao(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-5 py-2.5 rounded-xl bg-[#1a237e] hover:bg-[#283593] text-white font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Salvar PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ENVIO POR E-MAIL */}
      {modalEmail && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-[#e65100]">
                <Mail className="w-5 h-5" />
                <h3 className="text-lg font-bold">Enviar Guia por E-mail</h3>
              </div>
              <button
                onClick={() => setModalEmail(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                A guia <strong>{modalEmail.guia.tipo}</strong> ({formatarMoeda(modalEmail.guia.valorImposto)}) com vencimento em <strong>{formatarData(modalEmail.guia.vencimento)}</strong> será disparada com o PDF e a linha digitável.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  E-mail do Destinatário:
                </label>
                <input
                  type="email"
                  value={modalEmail.destinatario}
                  onChange={(e) => setModalEmail({ ...modalEmail, destinatario: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalEmail(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDispararEmail(modalEmail.guia, modalEmail.destinatario)}
                className="px-5 py-2 rounded-xl bg-[#e65100] hover:bg-[#bf360c] text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Confirmar Envio</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
