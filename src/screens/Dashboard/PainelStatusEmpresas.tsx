import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Search, 
  Filter, 
  FileText, 
  Receipt, 
  ShieldCheck, 
  ShieldAlert, 
  ArrowRight, 
  Printer, 
  Check, 
  X, 
  RefreshCw, 
  Plus, 
  ChevronRight,
  ExternalLink,
  Sparkles,
  HelpCircle,
  Eye,
  Table,
  LayoutGrid,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { EmpresaDados, StatusComplianceEmpresa } from '../../types';
import { useEmpresa } from '../../context/EmpresaContext';
import { normalizarCnpj } from '../../services/cnpj/cnpjValidation';
import { 
  obterStatusTodasEmpresas, 
  atualizarStatusCompliance,
  COMPETENCIA_PADRAO 
} from '../../services/compliance/complianceEmpresas.service';

interface PainelStatusEmpresasProps {
  onNavegar: (aba: string) => void;
}

type TipoFiltro = 
  | 'todas' 
  | 'todas_ok' 
  | 'com_pendencias' 
  | 'dados_enviados' 
  | 'dados_nao_enviados' 
  | 'dctfweb_enviadas' 
  | 'dctfweb_nao_enviadas' 
  | 'cnd_regular' 
  | 'cnd_nao_saiu';

export default function PainelStatusEmpresas({ onNavegar }: PainelStatusEmpresasProps) {
  const { empresas, empresaAtiva, selecionarEmpresa } = useEmpresa();
  const [competencia, setCompetencia] = useState<string>(COMPETENCIA_PADRAO);
  const [filtroAtivo, setFiltroAtivo] = useState<TipoFiltro>('todas');
  const [termoBusca, setTermoBusca] = useState<string>('');
  const [versaoEstado, setVersaoEstado] = useState<number>(0);
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);
  const [modoVisualizacao, setModoVisualizacao] = useState<'tabela_horizontal' | 'cards'>('tabela_horizontal');
  const [empresaSelecionadaModal, setEmpresaSelecionadaModal] = useState<EmpresaDados | null>(null);

  const mostrarToast = (msg: string) => {
    setToastMensagem(msg);
    setTimeout(() => setToastMensagem(null), 3000);
  };

  const registrarAtualizacaoManual = (
    empresa: EmpresaDados,
    updates: Partial<StatusComplianceEmpresa>,
    mensagemSucesso: string
  ) => {
    try {
      atualizarStatusCompliance(empresa, updates, competencia);
      setVersaoEstado(v => v + 1);
      mostrarToast(mensagemSucesso);
    } catch (error) {
      setVersaoEstado(v => v + 1);
      mostrarToast(error instanceof Error ? error.message : 'Não foi possível salvar o registro manual.');
    }
  };

  // Mapa de compliance para todas as empresas da carteira
  const resultadoCompliance = useMemo(() => {
    // dependemos de versaoEstado para forçar re-render quando atualizar
    return obterStatusTodasEmpresas(empresas, competencia);
  }, [empresas, competencia, versaoEstado]);
  const mapaCompliance = 'erro' in resultadoCompliance ? {} : resultadoCompliance.status;

  // Cálculos consolidados para os indicadores
  const estatisticas = useMemo(() => {
    let dadosEnviados = 0;
    let dadosNaoEnviados = 0;
    let dctfwebEnviadas = 0;
    let dctfwebNaoEnviadas = 0;
    let cndComNumeroInformado = 0;
    let cndSemNumeroInformado = 0;
    let checklistsInformadosCompletos = 0;
    let checklistsInformadosIncompletos = 0;

    empresas.forEach(emp => {
      const id = emp.id || emp.cnpj;
      const st = mapaCompliance[id];
      if (!st) return;

      if (st.dadosMesEnviados) {
        dadosEnviados++;
      } else {
        dadosNaoEnviados++;
      }

      if (st.dctfwebEnviada) {
        dctfwebEnviadas++;
      } else {
        dctfwebNaoEnviadas++;
      }

      if (st.cndEmitida) {
        cndComNumeroInformado++;
      } else {
        cndSemNumeroInformado++;
      }

      const checklistCompleto = st.dadosMesEnviados && st.dctfwebEnviada && st.cndEmitida;
      if (checklistCompleto) {
        checklistsInformadosCompletos++;
      } else {
        checklistsInformadosIncompletos++;
      }
    });

    return {
      total: empresas.length,
      dadosEnviados,
      dadosNaoEnviados,
      dctfwebEnviadas,
      dctfwebNaoEnviadas,
      cndComNumeroInformado,
      cndSemNumeroInformado,
      checklistsInformadosCompletos,
      checklistsInformadosIncompletos
    };
  }, [empresas, mapaCompliance]);

  // Alternar envio de dados do mês
  const handleAlternarDadosMes = (emp: EmpresaDados) => {
    const id = emp.id || emp.cnpj;
    const st = mapaCompliance[id];
    const novoValor = !st.dadosMesEnviados;
    registrarAtualizacaoManual(
      emp,
      {
        dadosMesEnviados: novoValor,
        dataEnvioDados: novoValor ? new Date().toLocaleString('pt-BR') : undefined
      },
      `Registro manual de recebimento atualizado para ${emp.razaoSocial}. Nenhum dado foi transmitido pelo sistema.`
    );
  };

  // Alternar envio de DCTFWeb
  const handleAlternarDCTFWeb = (emp: EmpresaDados) => {
    const id = emp.id || emp.cnpj;
    const st = mapaCompliance[id];
    const novoValor = !st.dctfwebEnviada;
    const recibo = novoValor ? window.prompt('Informe o número do recibo oficial da DCTFWeb já transmitida. O sistema não fará a transmissão:')?.trim() : '';
    if (novoValor && !recibo) return;
    registrarAtualizacaoManual(
      emp,
      {
        dctfwebEnviada: novoValor,
        dataEnvioDCTFWeb: novoValor ? new Date().toLocaleString('pt-BR') : undefined,
        reciboDCTFWeb: novoValor ? recibo : undefined
      },
      `Registro manual da DCTFWeb ${novoValor ? 'salvo com recibo informado' : 'removido'} para ${emp.razaoSocial}.`
    );
  };

  // Alternar status da CND
  const handleAlternarCND = (emp: EmpresaDados) => {
    const id = emp.id || emp.cnpj;
    const st = mapaCompliance[id];
    const novoValor = !st.cndEmitida;
    const numeroCertidao = novoValor ? window.prompt('Informe o código da certidão oficial emitida. O sistema não consulta nem emite CND:')?.trim() : '';
    if (novoValor && !numeroCertidao) return;
    registrarAtualizacaoManual(
      emp,
      {
        cndEmitida: novoValor,
        motivoCndNaoSaiu: novoValor ? `Certidão informada manualmente: ${numeroCertidao}` : 'Situação não verificada pelo sistema.'
      },
      `Registro manual da CND ${novoValor ? 'salvo' : 'removido'} para ${emp.razaoSocial}.`
    );
  };

  // Marcar todas da carteira como dados enviados
  const handleMarcarTodosDadosEnviados = () => {
    mostrarToast('Registre o recebimento real por empresa. Este painel não envia nem recebe documentos em lote.');
  };

  // Marcar todas as DCTFWeb como transmitidas
  const handleMarcarTodasDCTFWebEnviadas = () => {
    mostrarToast('Para registrar uma transmissão, abra cada empresa e informe o recibo oficial. Nenhum envio é feito por este painel.');
  };

  // Filtragem da lista
  const empresasFiltradas = useMemo(() => {
    return empresas.filter(emp => {
      const id = emp.id || emp.cnpj;
      const st = mapaCompliance[id];
      if (!st) return false;

      // Filtro de busca de texto
      if (termoBusca.trim()) {
        const t = normalizarCnpj(termoBusca);
        const tTexto = termoBusca.toLowerCase();
        const nomeMatch = (emp.razaoSocial || '').toLowerCase().includes(tTexto) ||
                          (emp.nomeFantasia || '').toLowerCase().includes(tTexto);
        const cnpjMatch = normalizarCnpj(emp.cnpj || '').includes(t);
        if (!nomeMatch && !cnpjMatch) return false;
      }

      // Filtro por categoria
      if (filtroAtivo === 'todas') return true;
      if (filtroAtivo === 'todas_ok') {
        return st.dadosMesEnviados && st.dctfwebEnviada && st.cndEmitida;
      }
      if (filtroAtivo === 'com_pendencias') {
        return !st.dadosMesEnviados || !st.dctfwebEnviada || !st.cndEmitida;
      }
      if (filtroAtivo === 'dados_enviados') return st.dadosMesEnviados;
      if (filtroAtivo === 'dados_nao_enviados') return !st.dadosMesEnviados;
      if (filtroAtivo === 'dctfweb_enviadas') return st.dctfwebEnviada;
      if (filtroAtivo === 'dctfweb_nao_enviadas') return !st.dctfwebEnviada;
      if (filtroAtivo === 'cnd_regular') return st.cndEmitida;
      if (filtroAtivo === 'cnd_nao_saiu') return !st.cndEmitida;

      return true;
    });
  }, [empresas, mapaCompliance, filtroAtivo, termoBusca]);

  const imprimirRelatorio = () => {
    window.print();
  };

  if ('erro' in resultadoCompliance) {
    return (
      <section className="bg-white rounded-3xl border border-rose-300 p-5 sm:p-7 shadow-sm space-y-4" role="alert">
        <div>
          <h2 className="text-xl font-black text-rose-950">Histórico de compliance indisponível</h2>
          <p className="mt-2 text-sm text-rose-900">{resultadoCompliance.erro}</p>
          <p className="mt-1 text-xs text-slate-700">O relatório foi suspenso para não mostrar status padrão como se fossem dados reais nem sobrescrever o histórico.</p>
        </div>
        <button type="button" onClick={() => setVersaoEstado(v => v + 1)} className="px-4 py-2 rounded-lg bg-indigo-700 text-white text-sm font-bold">Tentar ler novamente</button>
        <div className="border-t pt-3">
          <p className="text-xs font-bold text-slate-700">Empresas cadastradas (sem status de compliance carregado):</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">{empresas.map(empresa => <li key={empresa.id || empresa.cnpj}>{empresa.razaoSocial || 'Razão social não informada'} · {empresa.cnpj || 'CNPJ não informado'}</li>)}</ul>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-3xl border border-[#b3d4ff] p-5 sm:p-7 shadow-sm space-y-6">
      {/* Toast flutuante de notificação */}
      {toastMensagem && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1a237e] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMensagem}</span>
        </div>
      )}

      {/* ========================================================== */}
      {/* 🧭 CABEÇALHO DO RELATÓRIO CONSOLIDADO */}
      {/* ========================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-900 text-white rounded-xl shadow-xs">
              <Building2 className="w-5 h-5 text-amber-400" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#1a237e] tracking-tight">
              Relatório de Conformidade de Todas as Empresas
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            Controle manual da equipe. Não consulta a RFB/PGFN nem transmite declarações.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Competência */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-600">Competência:</span>
            <select
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-[#1a237e] text-xs cursor-pointer focus:outline-hidden"
            >
              <option value="09/2026">09/2026 (Setembro)</option>
              <option value="08/2026">08/2026 (Agosto)</option>
              <option value="07/2026">07/2026 (Julho)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={imprimirRelatorio}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Imprimir ou exportar relatório em PDF"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Imprimir Relatório</span>
          </button>

          <button
            type="button"
            onClick={() => onNavegar('cadastro-empresa')}
            className="px-3 py-2 bg-[#1a237e] hover:bg-[#121858] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-amber-300" />
            <span>Nova Empresa</span>
          </button>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 📊 PAINEL CONSOLIDADO — CARDS TOTALIZADORES INTERATIVOS */}
      {/* ========================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Envio de Dados no Mês */}
        <div
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
            filtroAtivo === 'dados_nao_enviados' || filtroAtivo === 'dados_enviados'
              ? 'ring-2 ring-indigo-600 bg-indigo-50/70 border-indigo-300 shadow-sm'
              : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
          }`}
          onClick={() => setFiltroAtivo(filtroAtivo === 'dados_nao_enviados' ? 'todas' : 'dados_nao_enviados')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              1. Envio de Dados no Mês
            </span>
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <FileText className="w-4 h-4" />
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div 
              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={(e) => { e.stopPropagation(); setFiltroAtivo('dados_enviados'); }}
              title="Filtrar empresas com recebimento de dados marcado manualmente."
            >
              <span className="text-xl font-black text-slate-800 block">
                {estatisticas.dadosEnviados}
              </span>
              <span className="text-[10px] font-bold text-emerald-800 uppercase">
                Recebimento informado
              </span>
            </div>

            <div 
              className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-center cursor-pointer hover:bg-rose-100/60 transition-colors"
              onClick={(e) => { e.stopPropagation(); setFiltroAtivo('dados_nao_enviados'); }}
              title="Filtrar empresas sem recebimento de dados registrado."
            >
              <span className="text-xl font-black text-[#c62828] block">
                {estatisticas.dadosNaoEnviados}
              </span>
              <span className="text-[10px] font-bold text-rose-800 uppercase">
                Sem recebimento informado
              </span>
            </div>
          </div>

          <div className="text-[11px] font-medium text-slate-500 text-center flex items-center justify-center gap-1">
            <span>Clique para filtrar empresas</span>
            <ChevronRight className="w-3 h-3 text-indigo-600" />
          </div>
        </div>

        {/* Card 2: Envio da DCTFWeb */}
        <div
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
            filtroAtivo === 'dctfweb_nao_enviadas' || filtroAtivo === 'dctfweb_enviadas'
              ? 'ring-2 ring-indigo-600 bg-indigo-50/70 border-indigo-300 shadow-sm'
              : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
          }`}
          onClick={() => setFiltroAtivo(filtroAtivo === 'dctfweb_nao_enviadas' ? 'todas' : 'dctfweb_nao_enviadas')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              2. DCTFWeb (Receita Federal)
            </span>
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Receipt className="w-4 h-4" />
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div 
              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={(e) => { e.stopPropagation(); setFiltroAtivo('dctfweb_enviadas'); }}
              title="Filtrar empresas com recibo DCTFWeb registrado manualmente; o sistema não verifica a transmissão."
            >
              <span className="text-xl font-black text-slate-800 block">
                {estatisticas.dctfwebEnviadas}
              </span>
              <span className="text-[10px] font-bold text-emerald-800 uppercase">
                Recibo informado
              </span>
            </div>

            <div 
              className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-center cursor-pointer hover:bg-rose-100/60 transition-colors"
              onClick={(e) => { e.stopPropagation(); setFiltroAtivo('dctfweb_nao_enviadas'); }}
              title="Filtrar empresas sem recibo DCTFWeb registrado; o sistema não consulta a transmissão."
            >
              <span className="text-xl font-black text-[#c62828] block">
                {estatisticas.dctfwebNaoEnviadas}
              </span>
              <span className="text-[10px] font-bold text-rose-800 uppercase">
                Sem recibo local
              </span>
            </div>
          </div>

          <div className="text-[11px] font-medium text-slate-500 text-center flex items-center justify-center gap-1">
            <span>Clique para filtrar empresas</span>
            <ChevronRight className="w-3 h-3 text-indigo-600" />
          </div>
        </div>

        {/* Card 3: CND — CND NÃO SAIU (Destaque Solicitado) */}
        <div
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
            filtroAtivo === 'cnd_nao_saiu' || filtroAtivo === 'cnd_regular'
              ? 'ring-2 ring-rose-600 bg-rose-50/70 border-rose-300 shadow-sm'
              : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
          }`}
          onClick={() => setFiltroAtivo(filtroAtivo === 'cnd_nao_saiu' ? 'todas' : 'cnd_nao_saiu')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              3. CND (Certidões de Débito)
            </span>
            <span className="p-2 bg-rose-50 text-rose-700 rounded-xl">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div 
              className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center cursor-pointer hover:bg-emerald-100/60 transition-colors"
              onClick={(e) => { e.stopPropagation(); setFiltroAtivo('cnd_regular'); }}
              title="Clique para ver empresas com número de certidão informado manualmente"
            >
              <span className="text-xl font-black text-[#2e7d32] block">
                {estatisticas.cndComNumeroInformado}
              </span>
              <span className="text-[10px] font-bold text-slate-700 uppercase">
                Número informado • não verificado
              </span>
            </div>

            <div 
              className={`rounded-xl p-2.5 text-center cursor-pointer transition-colors ${
                estatisticas.cndSemNumeroInformado > 0
                  ? 'bg-rose-100 border-2 border-rose-400 animate-pulse' 
                  : 'bg-slate-50 border border-slate-200'
              }`}
              onClick={(e) => { e.stopPropagation(); setFiltroAtivo('cnd_nao_saiu'); }}
              title="Clique para ver empresas sem número de certidão informado"
            >
              <span className="text-xl font-black text-[#c62828] block">
                {estatisticas.cndSemNumeroInformado}
              </span>
              <span className="text-[10px] font-black text-rose-900 uppercase">
                ⚠️ Sem registro local
              </span>
            </div>
          </div>

          <div className="text-[11px] font-medium text-rose-700 text-center flex items-center justify-center gap-1 font-bold">
            <span>Ver empresas sem número de certidão informado</span>
            <ChevronRight className="w-3 h-3 text-rose-700" />
          </div>
        </div>

        {/* Card 4: checklist de registros informados, não um atestado de conformidade */}
        <div
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
            filtroAtivo === 'todas_ok' || filtroAtivo === 'com_pendencias'
              ? 'ring-2 ring-indigo-600 bg-indigo-50/70 border-indigo-300 shadow-sm'
              : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
          }`}
          onClick={() => setFiltroAtivo(filtroAtivo === 'com_pendencias' ? 'todas' : 'com_pendencias')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              4. Checklist de registros informados
            </span>
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div 
              className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center cursor-pointer hover:bg-emerald-100/60 transition-colors"
              onClick={(e) => { e.stopPropagation(); setFiltroAtivo('todas_ok'); }}
              title="Ver empresas com os três registros manuais preenchidos; não representa validação fiscal."
            >
              <span className="text-xl font-black text-[#2e7d32] block">
                {estatisticas.checklistsInformadosCompletos}
              </span>
              <span className="text-[10px] font-bold text-slate-700 uppercase">
                Checklist preenchido • não verificado
              </span>
            </div>

            <div 
              className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center cursor-pointer hover:bg-amber-100/60 transition-colors"
              onClick={(e) => { e.stopPropagation(); setFiltroAtivo('com_pendencias'); }}
              title="Ver empresas com pelo menos um registro manual faltando."
            >
              <span className="text-xl font-black text-amber-900 block">
                {estatisticas.checklistsInformadosIncompletos}
              </span>
              <span className="text-[10px] font-bold text-amber-800 uppercase">
                Registro faltando
              </span>
            </div>
          </div>

          <div className="text-[11px] font-medium text-slate-500 text-center flex items-center justify-center gap-1">
            <span>Total: {estatisticas.total} empresas</span>
            <ChevronRight className="w-3 h-3 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 🔍 BARRA DE FILTROS & AÇÕES RÁPIDAS DO CONTADOR */}
      {/* ========================================================== */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Campo de Busca Rápida */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por Razão Social, Nome Fantasia ou CNPJ..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
            />
            {termoBusca && (
              <button
                type="button"
                onClick={() => setTermoBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Ações em Lote para o Contador e Seletor de Modo de Visualização */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Alternador de Visualização: Tabela Horizontal vs Cards */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setModoVisualizacao('tabela_horizontal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  modoVisualizacao === 'tabela_horizontal'
                    ? 'bg-white text-indigo-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Visualização Horizontal de Todas as Empresas (Tabela)"
              >
                <Table className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tabela Horizontal</span>
              </button>
              <button
                type="button"
                onClick={() => setModoVisualizacao('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  modoVisualizacao === 'cards'
                    ? 'bg-white text-indigo-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Visualização em Cards Detalhados"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
                <span>Cards</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleMarcarTodosDadosEnviados}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-indigo-200"
              title="Marcar todas as empresas como dados enviados no mês"
            >
              <Check className="w-3.5 h-3.5 text-indigo-600" />
              <span>Como registrar recebimento</span>
            </button>

            <button
              type="button"
              onClick={handleMarcarTodasDCTFWebEnviadas}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-200"
              title="O painel não transmite em lote; informe o recibo oficial em cada empresa"
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-600" />
              <span>Como registrar recibos</span>
            </button>
          </div>
        </div>

        {/* Abas e Filtros de Visualização ("Clicar e ver só as que não foram enviadas ou só as que foram enviadas") */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-thin">
          <button
            type="button"
            onClick={() => setFiltroAtivo('todas')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroAtivo === 'todas'
                ? 'bg-[#1a237e] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Todas as Empresas</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
              {estatisticas.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroAtivo('todas_ok')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroAtivo === 'todas_ok'
                ? 'bg-[#2e7d32] text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Checklist informado completo</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
              {estatisticas.checklistsInformadosCompletos}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroAtivo('com_pendencias')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroAtivo === 'com_pendencias'
                ? 'bg-[#c62828] text-white shadow-2xs'
                : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Registro manual faltando</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
              {estatisticas.checklistsInformadosIncompletos}
            </span>
          </button>

          <span className="text-slate-300">|</span>

          <button
            type="button"
            onClick={() => setFiltroAtivo('dados_nao_enviados')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroAtivo === 'dados_nao_enviados'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
              <span>📤 Sem recebimento informado</span>
            <span className="px-1.5 py-0.2 bg-rose-200 text-rose-900 rounded-full text-[10px]">
              {estatisticas.dadosNaoEnviados}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroAtivo('dados_enviados')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroAtivo === 'dados_enviados'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>📤 Recebimento de dados informado</span>
            <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded-full text-[10px]">
              {estatisticas.dadosEnviados}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroAtivo('dctfweb_nao_enviadas')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroAtivo === 'dctfweb_nao_enviadas'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>📑 Sem recibo informado</span>
            <span className="px-1.5 py-0.2 bg-rose-200 text-rose-900 rounded-full text-[10px]">
              {estatisticas.dctfwebNaoEnviadas}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroAtivo('dctfweb_enviadas')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroAtivo === 'dctfweb_enviadas'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>📑 Recibo informado manualmente</span>
            <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded-full text-[10px]">
              {estatisticas.dctfwebEnviadas}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroAtivo('cnd_nao_saiu')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroAtivo === 'cnd_nao_saiu'
                ? 'bg-rose-800 text-white shadow-2xs ring-2 ring-rose-500'
                : 'bg-rose-100 text-rose-900 hover:bg-rose-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>⚠️ Sem número de certidão informado</span>
            <span className="px-1.5 py-0.2 bg-rose-300 text-rose-950 rounded-full text-[10px]">
              {estatisticas.cndSemNumeroInformado}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 📋 LISTA VISUAL / TABELA CONSOLIDADA DAS EMPRESAS */}
      {/* ========================================================== */}
      {empresasFiltradas.length === 0 ? (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 mx-auto flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Nenhuma empresa encontrada com este filtro
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {filtroAtivo === 'cnd_nao_saiu'
                ? 'Não há empresas sem registro manual de certidão nesse filtro. A situação perante RFB/PGFN não foi consultada.'
                : filtroAtivo === 'todas_ok'
                ? 'Nenhuma empresa tem os três registros manuais preenchidos nesta competência. Isso não consulta obrigações oficiais.'
                : 'Ajuste os filtros ou a busca acima para localizar as empresas cadastradas.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setFiltroAtivo('todas'); setTermoBusca(''); }}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Ver Todas as Empresas
          </button>
        </div>
      ) : modoVisualizacao === 'tabela_horizontal' ? (
        /* ========================================================== */
        /* 📊 VISUALIZAÇÃO 1: TABELA HORIZONTAL COMPLETA DE TODAS AS EMPRESAS */
        /* ========================================================== */
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 px-1">
            <span>
              Exibindo <strong>{empresasFiltradas.length}</strong> de <strong>{empresas.length}</strong> empresas em formato horizontal
            </span>
            <span className="italic text-[11px] text-indigo-700 font-medium">
              💡 Clique no nome da empresa ou em "Informações" para ver ficha completa
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs border-collapse min-w-[980px]">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Empresa / CNPJ</th>
                  <th className="py-3.5 px-3">Regime</th>
                  <th className="py-3.5 px-3">1. Dados do Mês</th>
                  <th className="py-3.5 px-3">2. DCTFWeb</th>
                  <th className="py-3.5 px-3">3. CND RFB/PGFN</th>
                  <th className="py-3.5 px-3">Registros informados</th>
                  <th className="py-3.5 px-4 text-right">Informações & Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {empresasFiltradas.map((emp) => {
                  const id = emp.id || emp.cnpj;
                  const st = mapaCompliance[id] || {
                    dadosMesEnviados: false,
                    dctfwebEnviada: false,
                    cndEmitida: false
                  };
                  const checklistCompleto = st.dadosMesEnviados && st.dctfwebEnviada && st.cndEmitida;

                  return (
                    <tr 
                      key={id}
                      className={`hover:bg-indigo-50/40 transition-colors ${
                        !st.cndEmitida ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Empresa / CNPJ */}
                      <td className="py-3.5 px-4">
                        <div 
                          onClick={() => setEmpresaSelecionadaModal(emp)}
                          className="cursor-pointer group space-y-0.5"
                          title="Clique para ver ficha completa desta empresa"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-xs sm:text-sm">
                              {emp.razaoSocial}
                            </span>
                            <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                          </div>
                          {emp.nomeFantasia && (
                            <div className="text-[11px] text-slate-500 font-medium truncate max-w-xs">
                              {emp.nomeFantasia}
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                              {emp.cnpj}
                            </span>
                            <span>{emp.cidade || 'Goiânia'}-{emp.uf || 'GO'}</span>
                            {emp.procuracaoAtiva && (
                              <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                e-CAC
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Regime */}
                      <td className="py-3.5 px-3">
                        <span className="text-[10px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {emp.regimeTributario || 'SIMPLES'}
                        </span>
                      </td>

                      {/* 1. Dados do Mês */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1">
                          {st.dadosMesEnviados ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              <Check className="w-3 h-3 text-slate-600" />
                              Recebimento informado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              <Clock className="w-3 h-3 text-rose-600" />
                              Sem recebimento informado
                            </span>
                          )}
                          <div>
                            <button
                              type="button"
                              onClick={() => handleAlternarDadosMes(emp)}
                              className="text-[10px] text-indigo-700 hover:text-indigo-900 font-semibold underline cursor-pointer"
                            >
                              {st.dadosMesEnviados ? 'Remover registro manual' : 'Registrar recebimento'}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 2. DCTFWeb */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1">
                          {st.dctfwebEnviada ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              <Check className="w-3 h-3 text-slate-600" />
                              Recibo informado manualmente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Sem recibo informado
                            </span>
                          )}
                          <div>
                            <button
                              type="button"
                              onClick={() => handleAlternarDCTFWeb(emp)}
                              className="text-[10px] text-indigo-700 hover:text-indigo-900 font-semibold underline cursor-pointer"
                            >
                              {st.dctfwebEnviada ? 'Remover registro manual' : 'Registrar número do recibo'}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 3. CND RFB/PGFN */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1">
                          {st.cndEmitida ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              <ShieldCheck className="w-3 h-3 text-slate-600" />
                              Número informado • não verificado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-200 text-rose-950 ring-1 ring-rose-400">
                              <ShieldAlert className="w-3 h-3 text-rose-700" />
                              Sem registro local
                            </span>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAlternarCND(emp)}
                              className="text-[10px] text-indigo-700 hover:text-indigo-900 font-semibold underline cursor-pointer"
                            >
                              {st.cndEmitida ? 'Remover registro manual' : 'Registrar número da certidão'}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Diagnóstico Geral */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {checklistCompleto ? (
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 text-[11px] font-black inline-flex items-center gap-1 border border-slate-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
                            Registros manuais completos • não verificados
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl bg-rose-100 text-rose-900 text-[11px] font-black inline-flex items-center gap-1 border border-rose-300">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            Registro manual faltando
                          </span>
                        )}
                      </td>

                      {/* Informações & Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEmpresaSelecionadaModal(emp)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="Ver mais informações desta empresa"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Informações</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              selecionarEmpresa(emp);
                              onNavegar('dctfweb');
                            }}
                            className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            title="Acessar guias DCTFWeb desta empresa"
                          >
                            Guias
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              selecionarEmpresa(emp);
                              onNavegar('cnd');
                            }}
                            className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            title="Acessar certidões CND desta empresa"
                          >
                            CND
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Exibindo <strong>{empresasFiltradas.length}</strong> de <strong>{empresas.length}</strong> empresas cadastradas
            </span>
            <span className="italic text-[11px]">
              Dica: Clique em "Ver Informações" para abrir o prontuário completo da empresa
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {empresasFiltradas.map((emp) => {
              const id = emp.id || emp.cnpj;
              const st = mapaCompliance[id] || {
                dadosMesEnviados: false,
                dctfwebEnviada: false,
                    cndEmitida: false
              };

              const checklistCompleto = st.dadosMesEnviados && st.dctfwebEnviada && st.cndEmitida;

              return (
                <div
                  key={id}
                  className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all hover:shadow-md space-y-4 ${
                    checklistCompleto
                      ? 'border-slate-300 border-l-4 border-l-slate-500'
                      : !st.cndEmitida
                      ? 'border-rose-300 border-l-4 border-l-[#c62828] bg-rose-50/20'
                      : 'border-slate-200 border-l-4 border-l-amber-500'
                  }`}
                >
                  {/* Linha Superior: Dados da Empresa & Diagnóstico Geral */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setEmpresaSelecionadaModal(emp)}
                          className="text-base sm:text-lg font-black text-[#1a237e] hover:underline cursor-pointer text-left flex items-center gap-1.5"
                        >
                          <span>{emp.razaoSocial}</span>
                          <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
                        </button>
                        {emp.nomeFantasia && (
                          <span className="text-xs text-slate-500 font-medium">
                            ({emp.nomeFantasia})
                          </span>
                        )}
                        <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          {emp.cnpj}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                          {emp.regimeTributario || 'SIMPLES'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>Local: {emp.cidade || 'Goiânia'} - {emp.uf || 'GO'}</span>
                        {emp.procuracaoAtiva && (
                          <span className="text-slate-700 font-bold flex items-center gap-1" title="Procuração marcada no cadastro; não foi consultada no e-CAC.">
                            <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                            Procuração informada • não verificada
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Badge de Diagnóstico Global & Ação */}
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEmpresaSelecionadaModal(emp)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Informações</span>
                      </button>

                      {checklistCompleto ? (
                        <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 border border-slate-300 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                          <CheckCircle2 className="w-4 h-4 text-slate-600" />
                          <span>REGISTROS MANUAIS COMPLETOS • NÃO VERIFICADOS</span>
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 rounded-xl bg-rose-100 text-rose-900 border border-rose-300 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          <span>REGISTRO MANUAL FALTANDO</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Linha Central: Os 3 Status Requisitados pelo Usuário */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    {/* Status 1: Dados do Mês */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600 uppercase">
                          1. Dados do Mês
                        </span>
                        {st.dadosMesEnviados ? (
                          <span className="text-[10px] font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3 text-slate-600" />
                            Recebimento informado
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3 text-rose-600" />
                            Sem recebimento informado
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600">
                        {st.dadosMesEnviados
                          ? `Data informada: ${st.dataEnvioDados || 'não registrada'}`
                          : 'Aguardando envio do movimento mensal pelo cliente.'}
                      </p>

                      <button
                        type="button"
                        onClick={() => handleAlternarDadosMes(emp)}
                        className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          st.dadosMesEnviados
                            ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                        }`}
                      >
                        {st.dadosMesEnviados ? (
                          <span>Remover registro manual</span>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Registrar recebimento dos dados</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Status 2: DCTFWeb */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600 uppercase">
                          2. DCTFWeb
                        </span>
                        {st.dctfwebEnviada ? (
                          <span className="text-[10px] font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3 text-slate-600" />
                            Recibo informado manualmente
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Sem recibo informado
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600 truncate">
                        {st.dctfwebEnviada
                          ? `Recibo informado: ${st.reciboDCTFWeb || 'sem número'}`
                          : 'Sem registro local de recibo; situação oficial não consultada.'}
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAlternarDCTFWeb(emp)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            st.dctfwebEnviada
                              ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs'
                          }`}
                        >
                          {st.dctfwebEnviada ? 'Remover registro manual' : 'Registrar número do recibo'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            selecionarEmpresa(emp);
                            onNavegar('dctfweb');
                          }}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="Abrir consulta e geração de DARF DCTFWeb"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Abrir DCTFWeb</span>
                        </button>
                      </div>
                    </div>

                    {/* Status 3: CND — CND NÃO SAIU vs. SAIU */}
                    <div className={`p-3 rounded-xl border space-y-2 ${
                      !st.cndEmitida 
                        ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-400' 
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600 uppercase">
                          3. CND (Certidão Negativa)
                        </span>
                        {st.cndEmitida ? (
                          <span className="text-[10px] font-extrabold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-slate-600" />
                            Número informado • não verificado
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-rose-900 bg-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-rose-700" />
                            Sem registro local
                          </span>
                        )}
                      </div>

                      <p className={`text-[11px] ${!st.cndEmitida ? 'text-rose-900 font-bold' : 'text-slate-600'}`}>
                        {st.cndEmitida
                          ? `Número informado manualmente: ${st.motivoCndNaoSaiu || 'não registrado'}. Situação não verificada.`
                          : (st.motivoCndNaoSaiu || 'Certidão e situação fiscal não consultadas.')}
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAlternarCND(emp)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            st.cndEmitida
                              ? 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                          }`}
                        >
                          {st.cndEmitida ? 'Remover registro manual' : 'Registrar número da certidão'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            selecionarEmpresa(emp);
                            onNavegar('cnd');
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                            !st.cndEmitida
                              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs'
                              : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                          }`}
                          title="Abrir módulo de CND / Regularizar certidões"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Ver CND</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 🔍 MODAL DE DETALHES / INFORMAÇÕES COMPLETAS DA EMPRESA */}
      {/* ========================================================== */}
      {empresaSelecionadaModal && (() => {
        const emp = empresaSelecionadaModal;
        const id = emp.id || emp.cnpj;
        const st = mapaCompliance[id] || {
          dadosMesEnviados: false,
          dctfwebEnviada: false,
          cndEmitida: false
        };
        const checklistCompleto = st.dadosMesEnviados && st.dctfwebEnviada && st.cndEmitida;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 space-y-5 p-6 sm:p-8 relative">
              {/* Fechar */}
              <button
                type="button"
                onClick={() => setEmpresaSelecionadaModal(null)}
                className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                title="Fechar Detalhes"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Cabeçalho da Empresa */}
              <div className="space-y-2 pr-10">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                    Ficha Cadastral & Registros Locais
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    Competência {competencia}
                  </span>
                  {checklistCompleto ? (
                    <span className="text-xs font-black px-3 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
                      Registros manuais completos • não verificados
                    </span>
                  ) : (
                    <span className="text-xs font-black px-3 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      Registro manual faltando
                    </span>
                  )}
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  {emp.razaoSocial}
                </h2>
                {emp.nomeFantasia && (
                  <p className="text-sm text-slate-600 font-medium">
                    Nome Fantasia: {emp.nomeFantasia}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap font-mono">
                  <span>CNPJ: <strong className="text-slate-900">{emp.cnpj}</strong></span>
                  {emp.inscricaoEstadual && (
                    <span>IE: <strong className="text-slate-900">{emp.inscricaoEstadual}</strong></span>
                  )}
                  <span>Regime: <strong className="text-indigo-700">{emp.regimeTributario || 'Simples Nacional'}</strong></span>
                </div>
              </div>

              {/* Status dos 3 Pilares na Competência */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Diagnóstico Fiscal da Competência ({competencia})
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. Dados do Mês */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">
                      1. Dados do Mês
                    </span>
                    <div>
                      {st.dadosMesEnviados ? (
                        <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-slate-600" />
                          Recebimento informado
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-rose-600" />
                          Sem recebimento informado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {st.dadosMesEnviados
                        ? `Data informada: ${st.dataEnvioDados || 'não informada'}`
                        : 'Aguardando cliente enviar movimento.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAlternarDadosMes(emp)}
                      className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                    >
                      {st.dadosMesEnviados ? 'Remover registro manual' : 'Registrar recebimento'}
                    </button>
                  </div>

                  {/* 2. DCTFWeb */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">
                      2. DCTFWeb
                    </span>
                    <div>
                      {st.dctfwebEnviada ? (
                        <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-slate-600" />
                          Recibo informado manualmente
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Sem recibo informado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {st.dctfwebEnviada
                        ? `Recibo informado: ${st.reciboDCTFWeb || 'sem número'}`
                        : 'Sem registro local; consulta oficial indisponível.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAlternarDCTFWeb(emp)}
                      className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                    >
                      {st.dctfwebEnviada ? 'Remover registro manual' : 'Registrar número do recibo'}
                    </button>
                  </div>

                  {/* 3. CND RFB/PGFN */}
                  <div className={`p-3.5 rounded-xl border space-y-2 ${
                    !st.cndEmitida ? 'bg-rose-50/50 border-rose-300' : 'bg-white border-slate-200'
                  }`}>
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">
                      3. CND Federal/PGFN
                    </span>
                    <div>
                      {st.cndEmitida ? (
                        <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1 border border-slate-200">
                          <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                          Número informado • não verificado
                        </span>
                      ) : (
                        <span className="text-xs font-black text-rose-950 bg-rose-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1 ring-1 ring-rose-400">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
                          Sem registro local
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] ${!st.cndEmitida ? 'text-rose-800 font-bold' : 'text-slate-500'}`}>
                      {st.cndEmitida
                        ? `Número informado: ${st.motivoCndNaoSaiu || 'não registrado'}. Situação não verificada.`
                        : (st.motivoCndNaoSaiu || 'Certidão e situação fiscal não consultadas.')}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAlternarCND(emp)}
                      className={`w-full py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        st.cndEmitida 
                          ? 'bg-rose-100 hover:bg-rose-200 text-rose-800' 
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {st.cndEmitida ? 'Remover registro manual' : 'Registrar número da certidão'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Informações Cadastrais e Contato */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                    <MapPin className="w-4 h-4 text-indigo-600" />
                    <span>Localização & Endereço</span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <p><strong>Logradouro:</strong> {emp.logradouro || 'Avenida Central'}, {emp.numero || '100'}</p>
                    {emp.bairro && <p><strong>Bairro:</strong> {emp.bairro}</p>}
                    <p><strong>Cidade/UF:</strong> {emp.cidade || 'Goiânia'} - {emp.uf || 'GO'}</p>
                    {emp.cep && <p><strong>CEP:</strong> {emp.cep}</p>}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                    <Phone className="w-4 h-4 text-indigo-600" />
                    <span>Contatos & Responsável</span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <p><strong>Responsável:</strong> {emp.contatoResponsavel || 'Não informado'}</p>
                    <p><strong>Telefone:</strong> {emp.telefone || 'Não informado'}</p>
                    <p><strong>E-mail:</strong> {emp.email || 'Não informado'}</p>
                    <p><strong>CNAE:</strong> {emp.cnae || 'Não informado'}</p>
                  </div>
                </div>
              </div>

              {/* Barra de Ações Rápidas do Modal */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      selecionarEmpresa(emp);
                      setEmpresaSelecionadaModal(null);
                      onNavegar('dctfweb');
                    }}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Gerar / Ver Guias DCTFWeb</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      selecionarEmpresa(emp);
                      setEmpresaSelecionadaModal(null);
                      onNavegar('cnd');
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Consultar CND</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setEmpresaSelecionadaModal(null)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}
