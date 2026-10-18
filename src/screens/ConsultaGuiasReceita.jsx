import React, { useState, useEffect, useRef } from 'react';
import BotaoVoltar from '../components/BotaoVoltar';
import { 
  Receipt, Calendar, AlertTriangle, CheckCircle2, 
  Search, Download, Printer, Copy, Check,
  Building2, Clock, ShieldCheck, FileText,
  DollarSign, Sparkles, X, ChevronRight, RefreshCw, Barcode,
  CheckCircle, ArrowUpRight, HelpCircle, Server, CheckCheck,
  Calculator, Filter, Trash2, PlusCircle,
  Edit3, ExternalLink
} from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import { formatarCnpj, normalizarCnpj, validarCnpj } from '../services/cnpj/cnpjValidation';
import SeletorEmpresaGlobal from '../components/SeletorEmpresaGlobal';
import { 
  consultarGuiasDiretoReceitaFederal, 
  salvarGuiasEmpresa, 
  adicionarGuiaReal,
  classificarPagamentoInformado,
  classificarCategoriaGuia
} from '../services/serpro/guiasReceita.service';

const dataHojeISO = () => {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
};

const interpretarDataCivilISO = (valor) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor || ''));
  if (!match) return null;
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  const data = new Date(ano, mes - 1, dia, 12);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia ? data : null;
};

const interpretarValorMonetario = (entrada) => {
  const texto = String(entrada || '').trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!texto) return null;
  const formatoBrasileiro = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
  const formatoDecimalPonto = /^\d+\.\d{1,2}$/;
  if (!formatoBrasileiro.test(texto) && !formatoDecimalPonto.test(texto)) return null;
  const normalizado = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : formatoBrasileiro.test(texto) && texto.includes('.')
      ? texto.replace(/\./g, '')
      : texto;
  const valor = Number(normalizado);
  return Number.isFinite(valor) && valor <= Number.MAX_SAFE_INTEGER ? valor : null;
};

// ==========================================================
// 🖥️ TELA PRINCIPAL — CONSULTA E GERENCIAMENTO
// ==========================================================
export default function ConsultaGuiasReceita({ onVoltar = null }) {
  const { empresaAtiva, empresas } = useEmpresa();
  const [cnpj, setCnpj] = useState(empresaAtiva ? empresaAtiva.cnpj : '');
  const [razaoSocial, setRazaoSocial] = useState(empresaAtiva ? (empresaAtiva.razaoSocial || empresaAtiva.nomeFantasia) : '');
  const [guias, setGuias] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [consultado, setConsultado] = useState(false);
  const [erroLeituraGuias, setErroLeituraGuias] = useState(null);
  const sequenciaConsultaRef = useRef(0);

  useEffect(() => () => {
    sequenciaConsultaRef.current += 1;
  }, []);

  // Sincroniza quando o usuário altera a empresa ativa no seletor global ou em qualquer tela
  useEffect(() => {
    if (empresaAtiva) {
      setCnpj(empresaAtiva.cnpj || '');
      setRazaoSocial(empresaAtiva.razaoSocial || empresaAtiva.nomeFantasia || '');
      setGuias([]);
      setConsultado(false);
      setErroLeituraGuias(null);
      setInfoOrigemReceita(null);
      if (empresaAtiva.cnpj) {
        executarBuscaComCnpj(empresaAtiva.cnpj);
      }
    } else {
      sequenciaConsultaRef.current += 1;
      setCnpj('');
      setRazaoSocial('');
      setGuias([]);
      setConsultado(false);
      setCarregando(false);
      setErroLeituraGuias(null);
      setInfoOrigemReceita(null);
    }
  }, [empresaAtiva]);

  // Estados de Modais
  const [guiaModalDarf, setGuiaModalDarf] = useState(null);
  const [modalConfirmacaoPaga, setModalConfirmacaoPaga] = useState(null);
  const [toastMensagem, setToastMensagem] = useState(null);

  // Formatação automática de CNPJ
  const handleCnpjChange = (texto) => {
    sequenciaConsultaRef.current += 1;
    setCnpj(formatarCnpj(texto));
    setRazaoSocial('');
    setGuias([]);
    setConsultado(false);
    setCarregando(false);
    setErroLeituraGuias(null);
    setInfoOrigemReceita(null);
  };

  const mostrarToast = (msg, tipo = 'sucesso') => {
    setToastMensagem({ texto: msg, tipo });
    setTimeout(() => setToastMensagem(null), 3500);
  };

  const [infoOrigemReceita, setInfoOrigemReceita] = useState(null);

  // Estados para Lançamento de Guia Real
  const [modalNovaGuia, setModalNovaGuia] = useState(false);
  const [novaGuiaCompetencia, setNovaGuiaCompetencia] = useState('');
  const [novaGuiaTipo, setNovaGuiaTipo] = useState('DARF Previdenciário (DCTFWeb)');
  const [novaGuiaCodigoReceita, setNovaGuiaCodigoReceita] = useState('');
  const [novaGuiaValor, setNovaGuiaValor] = useState('');
  const [novaGuiaVencimento, setNovaGuiaVencimento] = useState('');
  const [novaGuiaStatus, setNovaGuiaStatus] = useState('NAO_PAGO');

  // 🏛️ Modais de Certidão CND, Débito Previdenciário e Gestão de Contas da Empresa
  const [modalDebitosPrevidenciarios, setModalDebitosPrevidenciarios] = useState(false);
  const [modalContasEmpresa, setModalContasEmpresa] = useState(false);

  // ✏️ Modal para Ajustar/Editar Valor Real de Guia
  const [guiaParaEditar, setGuiaParaEditar] = useState(null);
  const [valorEditadoInput, setValorEditadoInput] = useState('');
  const [competenciaEditadaInput, setCompetenciaEditadaInput] = useState('');

  const executarBuscaComCnpj = async (cnpjParaBuscar) => {
    const cnpjLimpo = normalizarCnpj(cnpjParaBuscar || '');
    if (!validarCnpj(cnpjLimpo)) return;
    const sequenciaConsulta = ++sequenciaConsultaRef.current;

    setCarregando(true);
    setConsultado(false);
    setErroLeituraGuias(null);
    
    try {
      const resultado = await consultarGuiasDiretoReceitaFederal(
        cnpjLimpo,
        empresaAtiva && normalizarCnpj(empresaAtiva.cnpj) === cnpjLimpo ? empresaAtiva.regimeTributario : 'SIMPLES'
      );
      if (sequenciaConsulta !== sequenciaConsultaRef.current) return;

      const empresaEncontrada = empresas.find(item => normalizarCnpj(item.cnpj) === cnpjLimpo);
      setRazaoSocial(resultado.razaoSocial || empresaEncontrada?.razaoSocial || empresaEncontrada?.nomeFantasia || '');
      setInfoOrigemReceita({
        fonte: resultado.fonteOrigem,
        timestamp: resultado.timestamp,
        situacao: resultado.situacaoCadastral || null
      });
      setGuias(resultado.guias);
      setErroLeituraGuias(resultado.erroLeituraLocal || null);
      setConsultado(true);
    } catch {
      if (sequenciaConsulta !== sequenciaConsultaRef.current) return;
      setGuias([]);
      setErroLeituraGuias('Não foi possível concluir a leitura local. Tente consultar novamente; nenhum resultado anterior foi mantido.');
      setConsultado(true);
    } finally {
      if (sequenciaConsulta === sequenciaConsultaRef.current) setCarregando(false);
    }
  };

  const buscarGuias = async () => {
    const cnpjLimpo = normalizarCnpj(cnpj);
    if (!validarCnpj(cnpjLimpo)) {
      alert('Informe um CNPJ válido com 14 caracteres e dígitos verificadores corretos.');
      return;
    }

    executarBuscaComCnpj(cnpj);
  };

  const refazerGuia = (guia) => {
    setGuiaModalDarf(guia);
  };

  const confirmarMarcarComoPaga = (guia) => {
    setModalConfirmacaoPaga(guia);
  };

  const executarPagamento = () => {
    if (!modalConfirmacaoPaga) return;

    const referenciaPagamento = window.prompt('Informe a referência do comprovante de pagamento. O sistema não consulta o banco:')?.trim();
    if (!referenciaPagamento) return;
    const dataInformada = window.prompt('Informe a data real do pagamento (AAAA-MM-DD):', dataHojeISO())?.trim();
    const dataPagamento = interpretarDataCivilISO(dataInformada);
    if (!dataPagamento) {
      mostrarToast('Data inválida. Informe um dia existente no calendário no formato AAAA-MM-DD.', 'erro');
      return;
    }
    const valorPagoInformado = window.prompt('Informe o valor total efetivamente pago, conforme o comprovante (R$):', String(modalConfirmacaoPaga.valorOriginal || ''))?.trim();
    if (!valorPagoInformado) return;
    const valorPago = interpretarValorMonetario(valorPagoInformado);
    if (valorPago === null || valorPago <= 0) {
      mostrarToast('Valor inválido. Informe um valor completo, por exemplo 1.234,56.', 'erro');
      return;
    }

    const guiaAlvo = modalConfirmacaoPaga;
    const classificacaoPagamento = classificarPagamentoInformado(valorPago, Number(guiaAlvo.valorOriginal));
    if (classificacaoPagamento === 'INVALIDO') {
      mostrarToast('O valor da guia está fora do limite seguro para conferência. Corrija o registro antes de marcar pagamento.', 'erro');
      return;
    }
    if (classificacaoPagamento === 'PARCIAL') {
      mostrarToast('O valor informado é menor que o principal da guia. Ela continuará em aberto; pagamento parcial não é controlado nesta tela.', 'erro');
      return;
    }

    const atualizadas = guias.map(g => 
      g.id === guiaAlvo.id 
        ? { 
            ...g, 
            statusPagamento: 'PAGO', 
            dataPagamento,
            referenciaPagamento,
            valorPago
          }
        : g
    );

    const cnpjLimpo = normalizarCnpj(cnpj);
    if (!salvarGuiasEmpresa(cnpjLimpo, atualizadas.map(({ calculo, ...resto }) => resto))) {
      mostrarToast('Não foi possível salvar o pagamento informado. Os dados exibidos foram preservados.', 'erro');
      return;
    }
    setGuias(atualizadas);
    setModalConfirmacaoPaga(null);
    mostrarToast(`Registro manual de pagamento salvo para ${guiaAlvo.competencia}; nenhum banco foi consultado.`);
  };

  // Exclui individualmente um débito incorreto/inexistente
  const handleRemoverGuiaInexistente = (idGuia) => {
    const atualizadas = guias.filter(g => g.id !== idGuia);
    const cnpjLimpo = normalizarCnpj(cnpj);
    if (!salvarGuiasEmpresa(cnpjLimpo, atualizadas.map(({ calculo, ...resto }) => resto))) {
      mostrarToast('Não foi possível salvar a exclusão local. Os dados exibidos foram preservados.', 'erro');
      return;
    }
    setGuias(atualizadas);
    mostrarToast('✅ Débito incorreto excluído do registro da empresa.');
  };

  // Abre modal para ajustar valor real da guia (para refletir exatamente a contabilidade)
  const handleAbrirEdicaoGuia = (guia) => {
    setGuiaParaEditar(guia);
    setValorEditadoInput(String((guia.valorPago || guia.valorOriginal || 0).toFixed(2)).replace('.', ','));
    setCompetenciaEditadaInput(guia.competencia || '');
  };

  // Salva o valor real editado
  const handleSalvarEdicaoGuia = (e) => {
    e.preventDefault();
    if (!guiaParaEditar) return;
    const novoVal = parseFloat(valorEditadoInput.replace(/\./g, '').replace(',', '.'));
    if (isNaN(novoVal) || novoVal < 0) {
      alert('Informe um valor numérico válido!');
      return;
    }
    if (guiaParaEditar.statusPagamento === 'PAGO'
      && Math.round(novoVal * 100) !== Math.round(Number(guiaParaEditar.valorPago ?? guiaParaEditar.valorOriginal) * 100)) {
      alert('O principal não pode ser alterado enquanto há um pagamento integral informado. Remova e recadastre o registro com os dados corretos; este controle local não consulta o banco.');
      return;
    }
    const cnpjLimpo = normalizarCnpj(cnpj);
    const atualizadas = guias.map(g => {
      if (g.id === guiaParaEditar.id) {
        return {
          ...g,
          competencia: competenciaEditadaInput.trim() || g.competencia,
          valorOriginal: novoVal
        };
      }
      return g;
    });

    if (!salvarGuiasEmpresa(cnpjLimpo, atualizadas.map(({ calculo, ...resto }) => resto))) {
      mostrarToast('Não foi possível salvar a edição. Os dados exibidos foram preservados.', 'erro');
      return;
    }
    setGuias(atualizadas);
    setGuiaParaEditar(null);
    mostrarToast('Valor local atualizado. Nenhuma sincronização oficial foi realizada.');
  };

  // Exclui guia do histórico de pagas
  const handleExcluirGuiaPaga = (idGuia) => {
    if (!window.confirm('Deseja remover esta guia do histórico da empresa?')) return;
    const atualizadas = guias.filter(g => g.id !== idGuia);
    const cnpjLimpo = normalizarCnpj(cnpj);
    if (!salvarGuiasEmpresa(cnpjLimpo, atualizadas.map(({ calculo, ...resto }) => resto))) {
      mostrarToast('Não foi possível remover a guia do histórico local.', 'erro');
      return;
    }
    setGuias(atualizadas);
    mostrarToast('✅ Guia removida do histórico da empresa.');
  };

  // Remove registros locais; a consulta RFB/SERPRO não está conectada.
  const handleLimparValoresIncorretos = () => {
    if (!window.confirm('Remover os registros locais desta empresa? Esta ação não consulta a Receita Federal ou o SERPRO.')) return;
    const cnpjLimpo = normalizarCnpj(cnpj);
    try {
      localStorage.removeItem(`fiscoia_guias_receita_${cnpjLimpo}`);
    } catch {
      mostrarToast('Não foi possível remover os registros locais deste navegador.', 'erro');
      return;
    }
    executarBuscaComCnpj(cnpj);
    mostrarToast('Registros locais removidos. Consulta oficial indisponível.');
  };

  // Cadastra uma guia real informada pela contabilidade
  const handleSalvarNovaGuia = (e) => {
    e.preventDefault();
    const val = interpretarValorMonetario(novaGuiaValor);
    if (val === null || val <= 0) {
      alert('Informe um valor válido para a guia!');
      return;
    }
    const cnpjLimpo = normalizarCnpj(cnpj);
    const dataVenc = interpretarDataCivilISO(novaGuiaVencimento);
    if (!dataVenc) {
      mostrarToast('Data de vencimento inválida. Informe um dia existente no calendário.', 'erro');
      return;
    }
    let referenciaPagamento = '';
    let dataPagamento = null;
    if (novaGuiaStatus === 'PAGO') {
      referenciaPagamento = window.prompt('Informe a referência do comprovante. O sistema não consulta o banco:')?.trim() || '';
      if (!referenciaPagamento) return;
      const dataInformada = window.prompt('Informe a data real do pagamento (AAAA-MM-DD):', dataHojeISO())?.trim() || '';
      dataPagamento = interpretarDataCivilISO(dataInformada);
      if (!dataPagamento) {
        mostrarToast('Data inválida. Informe um dia existente no calendário no formato AAAA-MM-DD.', 'erro');
        return;
      }
    }

    const nova = {
      id: `RFB-MANUAL-${Date.now()}-${cnpjLimpo}`,
      competencia: novaGuiaCompetencia,
      declaracao: `Registro local informado pelo usuário: ${novaGuiaTipo}`,
      dataVencimento: dataVenc,
      valorOriginal: val,
      codigoReceita: novaGuiaCodigoReceita.trim(),
      tipo: novaGuiaTipo,
      statusPagamento: novaGuiaStatus,
      dataPagamento,
      valorPago: novaGuiaStatus === 'PAGO' ? val : null,
      referenciaPagamento: novaGuiaStatus === 'PAGO' ? referenciaPagamento : undefined,
      recibo: '',
      categoria: classificarCategoriaGuia(novaGuiaTipo),
      statusEnvioReceita: 'NAO_CONSULTADO'
    };

    let atualizadas;
    try {
      atualizadas = adicionarGuiaReal(cnpjLimpo, nova);
    } catch (error) {
      mostrarToast(error instanceof Error ? error.message : 'Não foi possível salvar o registro local.', 'erro');
      return;
    }
    setGuias(atualizadas);
    setModalNovaGuia(false);
    setNovaGuiaValor('');
    setNovaGuiaCodigoReceita('');
    mostrarToast(`Registro local da competência ${novaGuiaCompetencia} salvo. Nenhuma transmissão oficial foi feita.`);
  };

  // Filtros dos registros locais.
  const [abaFiltro, setAbaFiltro] = useState('TODAS');

  // Filtros
  const pagas = guias.filter(g => g.statusPagamento === 'PAGO');
  const naoPagas = guias.filter(g => g.statusPagamento === 'NAO_PAGO');
  const hojeSemHora = new Date();
  hojeSemHora.setHours(0, 0, 0, 0);
  const emAtraso = naoPagas.filter(g => {
    const vencimento = new Date(g.dataVencimento);
    vencimento.setHours(0, 0, 0, 0);
    return !Number.isNaN(vencimento.getTime()) && vencimento < hojeSemHora;
  });
  const emDia = naoPagas.filter(g => !emAtraso.includes(g));

  // Cálculos dinâmicos das obrigações da empresa
  const totalInssPendente = naoPagas
    .filter(g => (g.tipo || '').toLowerCase().includes('previdenci') || (g.tipo || '').toLowerCase().includes('inss'))
    .reduce((acc, g) => acc + (g.valorOriginal || 0), 0);

  const totalPendenteGeral = naoPagas.reduce((acc, g) => acc + (g.valorOriginal || 0), 0);

  return (
    <div className="min-h-screen bg-[#e0edff] text-slate-900 font-sans pb-16">
      {/* Toast flutuante */}
      {toastMensagem && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1a237e] text-white px-5 py-3 rounded-2xl shadow-xl border border-indigo-300 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMensagem.texto}</span>
        </div>
      )}

      {/* Barra de Retorno e Identificação de Navegação */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <BotaoVoltar onVoltar={onVoltar} cor="#1a237e" />
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/80 backdrop-blur-xs border border-[#b3d4ff] rounded-full text-xs font-bold text-[#1a237e] shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Controle local • consulta fiscal oficial não conectada</span>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 pt-2 space-y-6">
        {/* Cabeçalho da Tela */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1a237e] tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-indigo-900 text-white rounded-2xl shadow-sm">
              <Receipt className="w-6 h-6 text-amber-400" />
            </span>
            <span>📊 Controle local de guias</span>
          </h1>
          <p className="text-sm font-medium text-[#5c6bc0]">
            Registros locais informados pela equipe; consulta fiscal oficial indisponível
          </p>
        </div>

        {/* 🔍 CAIXA DE BUSCA POR CNPJ & SELEÇÃO DE EMPRESA */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#b3d4ff] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Empresa Ativa
              </span>
              <span className="text-sm sm:text-base font-extrabold text-slate-900">
                {empresaAtiva ? (empresaAtiva.nomeFantasia || empresaAtiva.razaoSocial) : 'Nenhuma empresa selecionada'}
              </span>
            </div>
            <SeletorEmpresaGlobal tamanho="medio" />
          </div>

          <div>
            <label className="block text-sm font-bold text-[#1a237e] mb-1.5 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#1a237e]" />
              <span>CNPJ da Empresa</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={cnpj}
                onChange={(e) => handleCnpjChange(e.target.value)}
                placeholder="00.000.000/0000-00"
                maxLength={18}
                className="flex-1 px-4 py-3.5 bg-[#f5f9ff] border-2 border-[#b3d4ff] rounded-xl text-lg font-mono font-bold text-[#1a237e] outline-none focus:border-[#1a237e] focus:bg-white transition-all shadow-inner"
              />
              <button
                type="button"
                id="btn-consultar-receita"
                onClick={buscarGuias}
                disabled={carregando}
                className="px-6 py-3.5 bg-[#1a237e] hover:bg-[#0f1654] active:scale-98 text-white rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-60"
              >
                {carregando ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Carregando dados...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 text-amber-300" />
                    <span>Atualizar dados cadastrais e registros locais</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">
                Contribuinte: <strong className="text-slate-900">{razaoSocial || (empresaAtiva ? (empresaAtiva.razaoSocial || empresaAtiva.nomeFantasia) : 'Informe ou selecione uma empresa acima')}</strong>
              </span>
              {infoOrigemReceita?.situacao && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                  ● Situação cadastral (base externa): {infoOrigemReceita.situacao}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-indigo-800 bg-indigo-50 border border-indigo-200 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Server className="w-3 h-3 text-indigo-600" />
                <span>Consulta fiscal SERPRO/RFB não conectada</span>
              </span>
              {infoOrigemReceita?.timestamp && (
                <span className="text-[11px] text-slate-500">
                  Dados cadastrais e registros carregados em: {infoOrigemReceita.timestamp}
                </span>
              )}
            </div>
          </div>
        </div>

        {erroLeituraGuias && (
          <div role="alert" className="mx-4 mt-4 p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-950 text-xs">
            <strong>Não foi possível ler o histórico local de guias.</strong> {erroLeituraGuias} Nenhum total ou status de pagamento foi presumido.
          </div>
        )}
        {consultado && !erroLeituraGuias && (
          <div role="status" className="mx-4 mt-4 p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-950 text-xs">
            Consulta de guias e débitos da Receita/SERPRO indisponível. Registros mostrados abaixo são locais e não confirmam regularidade fiscal.
          </div>
        )}
        {consultado && !erroLeituraGuias && (
          <div className="space-y-6">
            {/* 📊 RESUMO GERAL */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setAbaFiltro('TODAS')}
                className={`rounded-xl p-4 border text-center transition-all cursor-pointer ${
                  abaFiltro === 'TODAS'
                    ? 'bg-white border-[#1a237e] ring-2 ring-indigo-300 shadow-md'
                    : 'bg-white border-[#b3d4ff] hover:bg-slate-50 shadow-xs'
                }`}
              >
                <span className="text-2xl sm:text-3xl font-extrabold text-[#1a237e] block">
                  {guias.length}
                </span>
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider mt-1 block">
                  Total Guias
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAbaFiltro('PAGAS')}
                className={`rounded-xl p-4 border text-center transition-all cursor-pointer ${
                  abaFiltro === 'PAGAS'
                    ? 'bg-[#e8f5e9] border-emerald-600 ring-2 ring-emerald-300 shadow-md'
                    : 'bg-[#e8f5e9] border-emerald-300 hover:bg-emerald-100 shadow-xs'
                }`}
              >
                <span className="text-2xl sm:text-3xl font-extrabold text-[#2e7d32] block">
                  {pagas.length}
                </span>
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider mt-1 block">
                  ✅ Pagas
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAbaFiltro('NAO_PAGAS')}
                className={`rounded-xl p-4 border text-center transition-all cursor-pointer ${
                  abaFiltro === 'NAO_PAGAS'
                    ? 'bg-[#ffebee] border-rose-600 ring-2 ring-rose-300 shadow-md'
                    : 'bg-[#ffebee] border-rose-300 hover:bg-rose-100 shadow-xs'
                }`}
              >
                <span className="text-2xl sm:text-3xl font-extrabold text-[#c62828] block">
                  {naoPagas.length}
                </span>
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider mt-1 block">
                  ❌ Não Pagas ({emAtraso.length} atrasadas)
                </span>
              </button>

            </div>

            {/* 🛡️ BARRA DE AÇÕES CONTÁBEIS & CERTIDÕES */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-700" />
                    <span>Resumo dos registros locais:</span>
                </span>
                {naoPagas.length === 0 ? (
                  <span className="bg-amber-100 text-amber-950 text-xs font-bold px-3 py-1 rounded-xl border border-amber-300">Situação não verificada na Receita; nenhum débito local foi encontrado.</span>
                ) : (
                  <span className="bg-rose-100 text-rose-900 text-xs font-bold px-3 py-1 rounded-xl border border-rose-300 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>{naoPagas.length} guia(s) pendente(s) no controle local; situação oficial não verificada.</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setModalNovaGuia(true)}
                  className="px-3.5 py-1.5 bg-[#1a237e] hover:bg-[#0f1654] active:scale-98 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-amber-300" />
                  <span>➕ Registrar guia local</span>
                </button>
              </div>
            </div>

            {/* BARRA DE FILTROS INTERATIVA */}
            <div className="bg-white rounded-2xl p-2.5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1 pl-2 pr-1">
                  <Filter className="w-3.5 h-3.5 text-indigo-700" />
                  <span>Filtrar:</span>
                </span>
                
                <button
                  type="button"
                  onClick={() => setAbaFiltro('TODAS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    abaFiltro === 'TODAS'
                      ? 'bg-indigo-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Todas ({guias.length})
                </button>

                <button
                  type="button"
                  onClick={() => setAbaFiltro('NAO_PAGAS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    abaFiltro === 'NAO_PAGAS'
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  Não Pagas ({naoPagas.length})
                </button>

                <button
                  type="button"
                  onClick={() => setAbaFiltro('PAGAS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    abaFiltro === 'PAGAS'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  Pagas ({pagas.length})
                </button>

              </div>

              <div className="text-xs text-slate-500 font-medium px-2">
                Consulta oficial: <strong className="text-indigo-950 font-mono">indisponível</strong>
              </div>
            </div>

            {/* ⚠️ REGISTROS LOCAIS VENCIDOS */}
            {(abaFiltro === 'TODAS' || abaFiltro === 'NAO_PAGAS') && emAtraso.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-bold text-[#c62828] flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-[#c62828]" />
                    <span>⚠️ Registros locais com vencimento passado</span>
                  </h2>
                  <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200">
                    {emAtraso.length} pendente(s)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {emAtraso.map((guia) => (
                    <div
                      key={guia.id}
                      className="bg-white rounded-2xl p-5 border-l-4 border-l-[#c62828] border-y border-r border-slate-200 shadow-sm hover:shadow-md transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div>
                          <span className="text-lg font-black text-[#1a237e] block">
                            {guia.competencia}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {guia.tipo} · Cód. {guia.codigoReceita}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="bg-[#ffcdd2] text-[#c62828] text-xs font-bold px-2.5 py-1 rounded-md">
                            NÃO PAGO
                          </span>

                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600">
                        <p className="truncate font-medium text-slate-800">{guia.declaracao}</p>
                        <p className="font-semibold text-slate-800">
                          Vencimento Original: {guia.dataVencimento.toLocaleDateString('pt-BR')}
                        </p>

                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Valor principal informado:</span>
                          <span className="font-semibold text-slate-800 font-mono">
                            R$ {guia.valorOriginal.toFixed(2)}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-amber-200 text-[11px] text-amber-900">
                          Acréscimos e total atualizado não calculados. Use o Sicalc ou o portal oficial conforme o código da receita.
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <a
                          href="https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/pagamentos-e-parcelamentos/darf-calculo-e-impressao-programa-sicalc-1"
                          target="_blank"
                          rel="noreferrer"
                          className="py-2.5 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
                          <span>Acessar Sicalc</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => refazerGuia(guia)}
                          className="py-2.5 bg-[#c62828] hover:bg-[#a51d24] active:scale-98 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Ver registro local</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmarMarcarComoPaga(guia)}
                          className="py-2.5 bg-[#1565c0] hover:bg-[#0d47a1] active:scale-98 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Registrar pagamento integral informado</span>
                        </button>
                      </div>

                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => handleRemoverGuiaInexistente(guia.id)}
                          className="w-full py-1.5 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-700 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors border border-slate-200 hover:border-rose-300 cursor-pointer"
                          title="Remover este débito se a empresa já estiver quitada na contabilidade real"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                          <span>Débito Inexistente? Excluir desta empresa</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 📅 EM DIA — PENDENTES */}
            {(abaFiltro === 'TODAS' || abaFiltro === 'NAO_PAGAS') && emDia.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-bold text-[#2e7d32] flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#2e7d32]" />
                    <span>📅 Sem encargos estimados — registros locais</span>
                  </h2>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Sem encargos
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {emDia.map((guia) => (
                    <div
                      key={guia.id}
                      className="bg-white rounded-2xl p-5 border-l-4 border-l-[#2e7d32] border-y border-r border-slate-200 shadow-sm hover:shadow-md transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div>
                          <span className="text-lg font-black text-[#1a237e] block">
                            {guia.competencia}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {guia.tipo} · Cód. {guia.codigoReceita}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="bg-[#c8e6c9] text-[#2e7d32] text-xs font-bold px-2.5 py-1 rounded-md">
                            A VENCER
                          </span>

                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600">
                        <p className="truncate font-medium text-slate-800">{guia.declaracao}</p>
                        <p className="font-semibold text-slate-800">
                          Vencimento: {guia.dataVencimento.toLocaleDateString('pt-BR')}
                        </p>

                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">Valor a Pagar:</span>
                        <span className="text-lg font-black text-[#2e7d32] font-mono">
                          R$ {guia.valorOriginal.toFixed(2)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <a
                          href="https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/pagamentos-e-parcelamentos/darf-calculo-e-impressao-programa-sicalc-1"
                          target="_blank"
                          rel="noreferrer"
                          className="py-2.5 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
                          <span>Acessar Sicalc</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => refazerGuia(guia)}
                          className="py-2.5 bg-[#2e7d32] hover:bg-[#1b5e20] active:scale-98 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Ver registro local</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmarMarcarComoPaga(guia)}
                          className="py-2.5 bg-[#1565c0] hover:bg-[#0d47a1] active:scale-98 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Registrar pagamento integral informado</span>
                        </button>
                      </div>

                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => handleRemoverGuiaInexistente(guia.id)}
                          className="w-full py-1.5 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-700 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors border border-slate-200 hover:border-rose-300 cursor-pointer"
                          title="Remover este débito se a empresa já estiver quitada na contabilidade real"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                          <span>Débito Inexistente? Excluir desta empresa</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ✅ PAGAMENTOS INFORMADOS — HISTÓRICO LOCAL */}
            {(abaFiltro === 'TODAS' || abaFiltro === 'PAGAS') && pagas.length > 0 && (
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#1565c0] flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-[#1565c0]" />
                      <span>✅ Pagamentos informados — histórico local</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pagamentos informados no histórico local; sem sincronização com Receita Federal ou SERPRO
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-indigo-800 bg-indigo-100 px-2.5 py-1 rounded-full border border-indigo-200">
                      {pagas.length} pagamento(s) informado(s)
                    </span>
                    <button
                      type="button"
                      onClick={handleLimparValoresIncorretos}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                      title="Remover os registros locais desta empresa; isso não consulta Receita Federal ou SERPRO"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                      <span>Remover registros locais</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalNovaGuia(true)}
                      className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      title="Lançar pagamento real confirmado pela contabilidade"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Registrar pagamento informado</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pagas.map((guia) => (
                    <div
                      key={guia.id}
                      className="bg-[#f0f7ff] rounded-2xl p-5 border-l-4 border-l-[#1565c0] border-y border-r border-slate-200 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                        <div>
                          <span className="text-lg font-black text-[#1a237e] block">
                            {guia.competencia}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {guia.tipo} · Cód. {guia.codigoReceita}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="bg-[#bbdefb] text-[#1565c0] text-xs font-bold px-2.5 py-1 rounded-md">
                            Pagamento informado
                          </span>

                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600">
                        <p className="truncate font-medium">{guia.declaracao}</p>
                        <p className="text-slate-700">
                          Vencimento original: {guia.dataVencimento.toLocaleDateString('pt-BR')}
                        </p>

                        <p className="text-[#2e7d32] font-bold flex items-center gap-1 pt-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Data informada: {guia.dataPagamento ? new Date(guia.dataPagamento).toLocaleDateString('pt-BR') : 'não registrada'}</span>
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-indigo-100 flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-700">Valor informado como pago:</span>
                        <span className="text-lg font-black text-[#1565c0] font-mono">
                          R$ {(guia.valorPago || guia.valorOriginal).toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => refazerGuia(guia)}
                          className="flex-1 min-w-[130px] py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-200 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>Ver registro local</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAbrirEdicaoGuia(guia)}
                          className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors border border-blue-200 cursor-pointer"
                          title="Ajustar o valor exato pago por esta empresa"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Ajustar Valor</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExcluirGuiaPaga(guia.id)}
                          className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center justify-center transition-colors border border-rose-200 cursor-pointer"
                          title="Excluir guia incorreta do histórico da empresa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* ========================================================== */}
      {/* Registro local da guia; não representa documento de arrecadação */}
      {/* ========================================================== */}
      {guiaModalDarf && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-slate-300 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#1a237e] text-white flex items-center justify-center shadow-md">
                  <Receipt className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">
                    Registro local da guia — não é documento de pagamento
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {guiaModalDarf.tipo} • código informado: {guiaModalDarf.codigoReceita || 'não informado'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setGuiaModalDarf(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="border-2 border-rose-600 rounded-xl p-3 text-center text-sm font-black uppercase text-rose-700">NÃO É GUIA OFICIAL · NÃO PAGUE COM ESTA PRÉVIA</div>
            {/* Demonstrativo local, sem transmissão */}
            <div className="border-2 border-slate-900 rounded-xl overflow-hidden text-xs bg-white shadow-xs">
              <div className="bg-slate-900 text-white p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider block text-amber-400">
                    MURADE · CONTROLE LOCAL
                  </span>
                  <span className="text-sm font-black">
                    Registro informado pela equipe; não enviado ao órgão
                  </span>
                </div>
                <span className="text-base font-black px-2.5 py-1 bg-white text-slate-900 rounded">
                  LOCAL
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-300">
                {/* Lado Esquerdo */}
                <div className="p-4 space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      01. Nome / Razão Social
                    </span>
                    <strong className="text-slate-900 text-xs block">
                      {razaoSocial}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      03. CNPJ do Contribuinte
                    </span>
                    <strong className="font-mono text-slate-900 text-sm">
                      {cnpj}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Instruções de Pagamento
                    </span>
                    <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                      Este painel não emite guia. Consulte o Sicalc ou o portal oficial para calcular acréscimos e gerar o documento de pagamento.
                    </p>
                  </div>
                </div>

                {/* Lado Direito */}
                <div className="divide-y divide-slate-300">
                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-600">02. PERÍODO APURAÇÃO</span>
                    <strong className="font-mono text-xs">{guiaModalDarf.competencia}</strong>
                  </div>

                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-600">04. CÓDIGO RECEITA</span>
                    <strong className="font-mono text-xs text-indigo-900 font-black">{guiaModalDarf.codigoReceita || 'Não informado'}</strong>
                  </div>

                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-600">06. DATA VENCIMENTO</span>
                    <strong className="font-mono text-xs">
                      {guiaModalDarf.dataVencimento.toLocaleDateString('pt-BR')}
                    </strong>
                  </div>

                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-600">07. PRINCIPAL</span>
                    <span className="font-mono text-xs">
                      R$ {guiaModalDarf.valorOriginal.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 flex justify-between items-center bg-amber-50/50">
                    <span className="text-[10px] font-bold text-amber-900">08. MULTA</span>
                    <span className="font-mono text-xs font-bold text-amber-900">Não calculada</span>
                  </div>

                  <div className="p-2.5 flex justify-between items-center bg-amber-50/50">
                    <span className="text-[10px] font-bold text-amber-900">09. JUROS</span>
                    <span className="font-mono text-xs font-bold text-amber-900">Não calculados</span>
                  </div>

                  <div className="p-2.5 flex justify-between items-center bg-slate-100">
                    <span className="text-[11px] font-black text-slate-900">10. VALOR TOTAL</span>
                    <strong className="font-mono text-sm font-black text-slate-950">Consultar no Sicalc</strong>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-rose-200 text-xs font-semibold text-rose-800">Linha digitável, código de barras, autenticação e pagamento não foram gerados.</div>
            </div>

            {/* Ações */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Consulta oficial indisponível; esta é somente uma prévia local.</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGuiaModalDarf(null);
                  }}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md"
                >
                  <Download className="w-4 h-4 text-amber-300" />
                  <span>Fechar prévia</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* Modal para registro manual de pagamento */}
      {/* ========================================================== */}
      {modalConfirmacaoPaga && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Registrar pagamento informado
                </h3>
                <p className="text-xs text-slate-500">
                  Atualização de status na plataforma
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-600">Competência:</span>
                <strong className="text-slate-900">{modalConfirmacaoPaga.competencia}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Tipo de Guia:</span>
                <span className="text-slate-800">{modalConfirmacaoPaga.tipo}</span>
              </div>
              <div className="flex justify-between">
                  <span className="text-slate-600">Valor principal do registro:</span>
                <strong className="text-emerald-700 font-mono text-sm">
                  R$ {modalConfirmacaoPaga.valorOriginal.toFixed(2)}
                </strong>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Informe a referência do comprovante e a data real. O sistema não verifica o pagamento junto ao banco ou à Receita.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalConfirmacaoPaga(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Não, Cancelar
              </button>
              <button
                type="button"
                onClick={executarPagamento}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs cursor-pointer transition-all shadow-sm"
              >
                Registrar pagamento informado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* ➕ MODAL DE CADASTRO / LANÇAMENTO DE GUIA REAL */}
      {/* ========================================================== */}
      {modalNovaGuia && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-2xl">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Registrar guia informada
                  </h3>
                  <p className="text-xs text-slate-500">
                    Registro local; não transmite nem consulta o órgão
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalNovaGuia(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarNovaGuia} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Competência (MM/AAAA)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 08/2026"
                    value={novaGuiaCompetencia}
                    onChange={(e) => setNovaGuiaCompetencia(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    required
                    value={novaGuiaVencimento}
                    onChange={(e) => setNovaGuiaVencimento(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-indigo-600 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tipo de Documento / Guia
                </label>
                <select
                  value={novaGuiaTipo}
                  onChange={(e) => setNovaGuiaTipo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-600 outline-hidden"
                >
                  <option value="DARF Previdenciário (DCTFWeb)">DARF Previdenciário (DCTFWeb)</option>
                  <option value="DAS - Simples Nacional">DAS - Simples Nacional</option>
                  <option value="DARF IRPJ / CSLL">DARF IRPJ / CSLL (Lucro Presumido/Real)</option>
                  <option value="DARF PIS / COFINS">DARF PIS / COFINS (Cumulativo/Não-Cumulativo)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Código da receita (conforme documento oficial)</label>
                <input
                  type="text"
                  value={novaGuiaCodigoReceita}
                  onChange={(e) => setNovaGuiaCodigoReceita(e.target.value)}
                  placeholder="Informe o código que consta na guia"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-indigo-600 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Valor Original (R$)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 1250,50"
                    value={novaGuiaValor}
                    onChange={(e) => setNovaGuiaValor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Situação Atual
                  </label>
                  <select
                    value={novaGuiaStatus}
                    onChange={(e) => setNovaGuiaStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-600 outline-hidden"
                  >
                    <option value="PAGO">Pagamento informado como realizado (será solicitado comprovante)</option>
                    <option value="NAO_PAGO">⚠️ Em Aberto (A Pagar)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                💡 Registro local informado pela equipe. Nenhuma consulta ou transmissão oficial é feita.
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNovaGuia(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#1a237e] hover:bg-[#0f1654] text-white font-bold rounded-xl text-xs cursor-pointer transition-all shadow-sm"
                >
                  Salvar registro local
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 💼 MODAL: DÉBITOS PREVIDENCIÁRIOS (INSS) & DCTFWEB */}
      {/* ========================================================== */}
      {modalDebitosPrevidenciarios && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Débitos Previdenciários (INSS) & DCTFWeb
                  </h3>
                  <p className="text-xs text-slate-500">
                    {razaoSocial || (empresaAtiva ? empresaAtiva.razaoSocial : 'Empresa')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalDebitosPrevidenciarios(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Situação da consulta oficial:</span>
                  <span className="font-black text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                  {totalInssPendente === 0 ? 'NÃO CONSULTADA' : 'REGISTRO LOCAL PENDENTE'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-600 font-medium">Total de INSS em Aberto:</span>
                <span className="font-mono text-base font-black text-slate-900">
                  R$ {totalInssPendente.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-600 font-medium">Transmissão da DCTFWeb:</span>
                <span className="font-bold text-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Não verificada no sistema oficial
                </span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs leading-relaxed space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                Situação da integração SERPRO / e-CAC
              </p>
              <p className="text-[11px] text-blue-800">
                O serviço de consulta oficial não está conectado. Os dados exibidos são registros locais e não confirmam débitos, pagamentos ou entrega da DCTFWeb. Caso a empresa tenha contas para controle interno, utilize o botão abaixo.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setModalDebitosPrevidenciarios(false);
                  setNovaGuiaTipo('DARF Previdenciário (DCTFWeb)');
                  setNovaGuiaStatus('NAO_PAGO');
                  setModalNovaGuia(true);
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Adicionar registro previdenciário local</span>
              </button>

              <button
                type="button"
                onClick={() => setModalDebitosPrevidenciarios(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 💳 MODAL: GESTÃO DE CONTAS DA EMPRESA */}
      {/* ========================================================== */}
      {modalContasEmpresa && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-800 rounded-2xl">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Extrato de Contas da Empresa
                  </h3>
                  <p className="text-xs text-slate-500">
                    Controle de contas a pagar e débitos apurados
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalContasEmpresa(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-800 block">Principal local em aberto</span>
                <span className="text-2xl font-black text-indigo-950 font-mono">
                  R$ {totalPendenteGeral.toFixed(2)}
                </span>
              </div>
              <span className="text-xs font-bold text-indigo-700 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-2xs">
                {naoPagas.length} conta(s) pendente(s)
              </span>
            </div>

            {naoPagas.length === 0 ? (
              <div className="text-center py-6 space-y-2 bg-emerald-50 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-xs font-bold text-emerald-950">Nenhum registro local em aberto.</p>
                <p className="text-[11px] text-emerald-800 max-w-xs mx-auto">
                  A situação fiscal oficial não foi consultada. Se houver guias, registre-as abaixo para controle interno.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {naoPagas.map(item => (
                  <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{item.tipo || 'Obrigação Fiscal'}</p>
                      <p className="text-slate-500 text-[11px]">Competência {item.competencia} · Venc. {item.dataVencimento ? new Date(item.dataVencimento).toLocaleDateString('pt-BR') : '—'}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-black text-rose-700 block">
                        R$ {(item.valorOriginal || 0).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAbrirEdicaoGuia(item)}
                        className="text-[10px] text-blue-700 font-bold hover:underline"
                      >
                        Ajustar Valor
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setModalContasEmpresa(false);
                  setModalNovaGuia(true);
                }}
                className="w-full py-2.5 bg-[#1a237e] hover:bg-[#0f1654] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Adicionar conta local</span>
              </button>

              <button
                type="button"
                onClick={() => setModalContasEmpresa(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* ✏️ MODAL: AJUSTAR / EDITAR VALOR REAL DA GUIA */}
      {/* ========================================================== */}
      {guiaParaEditar && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Ajustar Valor Real da Guia
                  </h3>
                  <p className="text-xs text-slate-500">
                    Insira o valor exato apurado para esta empresa
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuiaParaEditar(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoGuia} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Guia / Obrigação
                </label>
                <input
                  type="text"
                  disabled
                  value={guiaParaEditar.tipo}
                  className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Competência
                  </label>
                  <input
                    type="text"
                    required
                    value={competenciaEditadaInput}
                    onChange={(e) => setCompetenciaEditadaInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-blue-600 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Valor Real (R$)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 150,00"
                    value={valorEditadoInput}
                    onChange={(e) => setValorEditadoInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-950 text-[11px] leading-relaxed">
                💡 O novo valor será salvo apenas neste navegador e usado nos resumos locais. Nenhuma alteração será enviada à Receita Federal ou ao SERPRO.
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGuiaParaEditar(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs cursor-pointer transition-all shadow-sm"
                >
                  Salvar Valor Real
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
