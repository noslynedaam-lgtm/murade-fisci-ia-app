import React, { useState, useEffect } from 'react';
import BotaoVoltar from '../components/BotaoVoltar';
import { 
  Receipt, Calendar, AlertTriangle, CheckCircle2, 
  Search, Download, Printer, Copy, Check, QrCode, 
  ExternalLink, Building2, Clock, ShieldCheck, FileText,
  DollarSign, Sparkles, X, ChevronRight, RefreshCw, Barcode,
  Server
} from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import { formatarCnpj, normalizarCnpj, validarCnpj } from '../services/cnpj/cnpjValidation';
import SeletorEmpresaGlobal from '../components/SeletorEmpresaGlobal';
import { 
  consultarGuiasDiretoReceitaFederal
} from '../services/serpro/guiasReceita.service';

// ==========================================================
// 🖥️ TELA PRINCIPAL — GUIAS INSS / DCTFWeb
// ==========================================================
export default function GuiasINSSScreen({ navigation = null, onVoltar = null } = {}) {
  const { empresaAtiva, empresas } = useEmpresa();
  const [cnpj, setCnpj] = useState(empresaAtiva ? empresaAtiva.cnpj : '');
  const [razaoSocial, setRazaoSocial] = useState(empresaAtiva ? (empresaAtiva.razaoSocial || empresaAtiva.nomeFantasia) : '');
  const [guias, setGuias] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [consultado, setConsultado] = useState(false);
  const [erroLeituraGuias, setErroLeituraGuias] = useState(null);
  const [guiaSelecionadaModal, setGuiaSelecionadaModal] = useState(null);

  // Sincroniza quando o usuário altera a empresa ativa
  useEffect(() => {
    if (empresaAtiva) {
      setCnpj(empresaAtiva.cnpj || '');
      setRazaoSocial(empresaAtiva.razaoSocial || empresaAtiva.nomeFantasia || '');
      if (empresaAtiva.cnpj) {
        executarBuscaComCnpj(empresaAtiva.cnpj);
      }
    } else {
      setCnpj('');
      setRazaoSocial('');
      setGuias([]);
      setConsultado(false);
    }
  }, [empresaAtiva]);

  // Formata CNPJ enquanto digita
  const handleCnpjChange = (texto) => {
    setCnpj(formatarCnpj(texto));
  };

  const [infoOrigemRFB, setInfoOrigemRFB] = useState(null);

  const executarBuscaComCnpj = async (cnpjParaBuscar) => {
    const cnpjLimpo = normalizarCnpj(cnpjParaBuscar || '');
    if (!validarCnpj(cnpjLimpo)) return;

    setCarregando(true);
    setConsultado(false);
    setErroLeituraGuias(null);
    
    let resultado = await consultarGuiasDiretoReceitaFederal(
      cnpjLimpo,
      empresaAtiva ? empresaAtiva.regimeTributario : 'SIMPLES'
    );

    if (resultado.razaoSocial && !razaoSocial) {
      setRazaoSocial(resultado.razaoSocial);
    }

    setInfoOrigemRFB({
      fonte: resultado.fonteOrigem,
      timestamp: resultado.timestamp,
      situacao: resultado.situacaoCadastral || null
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const guiasCalculadas = resultado.guias
      .filter(g => g.categoria === 'DCTFWEB' || (g.tipo || '').toUpperCase().includes('INSS'))
      .map(guia => {
        const isPago = guia.statusPagamento === 'PAGO';
        const dataVencimento = new Date(guia.dataVencimento);
        dataVencimento.setHours(0, 0, 0, 0);
        const vencimentoValido = !Number.isNaN(dataVencimento.getTime());
        const situacao = isPago ? 'PAGO' : !vencimentoValido ? 'NAO_VERIFICADA' : dataVencimento < hoje ? 'EM_ATRASO' : 'EM_DIA';

        return {
          id: guia.id,
          competencia: guia.competencia,
          dataVencimento: guia.dataVencimento,
          valorPrincipal: Number(guia.valorOriginal) || 0,
          declaracao: guia.declaracao,
          reciboEntrega: guia.recibo,
          codigoReceita: guia.codigoReceita,
          tipo: guia.tipo,
          statusPagamento: guia.statusPagamento || 'NAO_PAGO',
          dataPagamento: guia.dataPagamento,
          valorPago: guia.valorPago ?? null,
          inssPatronal: guia.inssPatronal ?? null,
          inssSegurados: guia.inssSegurados ?? null,
          outrasEntidades: guia.outrasEntidades ?? null,
          numeroReferencia: guia.numeroReferencia || '',
          situacao
        };
      });

    setGuias(guiasCalculadas);
    setErroLeituraGuias(resultado.erroLeituraLocal || null);
    setConsultado(true);
    setCarregando(false);
  };

  const buscarGuias = async () => {
    const cnpjLimpo = normalizarCnpj(cnpj);
    if (!validarCnpj(cnpjLimpo)) {
      alert('Informe um CNPJ válido com 14 caracteres e dígitos verificadores corretos.');
      return;
    }

    executarBuscaComCnpj(cnpj);
  };

  // Carrega automaticamente a busca ao entrar se tiver CNPJ válido
  useEffect(() => {
    if (cnpj && validarCnpj(cnpj)) {
      buscarGuias();
    }
  }, []);

  const emitirGuia = (guia) => {
    setGuiaSelecionadaModal(guia);
  };

  const guiasNaoPagas = guias.filter(g => g.statusPagamento !== 'PAGO');
  const guiasEmDia = guiasNaoPagas.filter(g => g.situacao === 'EM_DIA');
  const guiasEmAtraso = guiasNaoPagas.filter(g => g.situacao === 'EM_ATRASO');
  const guiasComPagamentoInformado = guias.filter(g => g.statusPagamento === 'PAGO');

  return (
    <div className="min-h-screen bg-[#e0edff] text-slate-900 font-sans pb-16">
      {/* Barra de Retorno e Identificação de Navegação */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <BotaoVoltar onVoltar={onVoltar} cor="#1a237e" />
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/80 backdrop-blur-xs border border-[#b3d4ff] rounded-full text-xs font-bold text-[#1a237e] shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Controle local • consulta oficial não conectada</span>
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
            <span>📋 Guias INSS — DCTFWeb</span>
          </h1>
          <p className="text-sm font-medium text-[#5c6bc0]">
            Registros locais de guias previdenciárias; consulta oficial à Receita Federal/DCTFWeb não conectada
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
              <span>CNPJ da Empresa Contratante</span>
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
                id="btn-consultar-registros-locais"
                onClick={buscarGuias}
                disabled={carregando}
                className="px-6 py-3.5 bg-[#1a237e] hover:bg-[#0f1654] active:scale-98 text-white rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-60"
              >
                {carregando ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Carregando registros locais...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 text-amber-300" />
                    <span>Carregar registros locais</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">
                Empresa identificada: <strong className="text-slate-900">{razaoSocial || (empresaAtiva ? (empresaAtiva.razaoSocial || empresaAtiva.nomeFantasia) : 'Selecione ou informe um CNPJ')}</strong>
              </span>
              {infoOrigemRFB?.situacao && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                  ● Situação cadastral (base externa): {infoOrigemRFB.situacao}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
                <span className="text-amber-900 bg-amber-50 border border-amber-200 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Server className="w-3 h-3 text-indigo-600" />
                  <span>Consulta de guias RFB/SERPRO não conectada</span>
              </span>
              {infoOrigemRFB?.timestamp && (
                <span className="text-[11px] text-slate-500">
                  Registros locais carregados em: {infoOrigemRFB.timestamp}
                </span>
              )}
            </div>
          </div>
        </div>

        {erroLeituraGuias && (
          <div role="alert" className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-950 text-xs">
            <strong>Histórico local indisponível.</strong> {erroLeituraGuias} Contadores e situação não foram calculados a partir de uma lista vazia.
          </div>
        )}
        {consultado && !erroLeituraGuias && (
          <div className="space-y-6">
            {/* 🛡️ SITUAÇÃO FISCAL / PREVIDENCIÁRIA */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-700" />
                  <span>Situação Previdenciária:</span>
                </span>
                <span className="bg-amber-100 text-amber-950 text-xs font-bold px-3 py-1 rounded-xl border border-amber-300">
                  Consulta oficial indisponível; {guiasNaoPagas.length} registro(s) local(is) não pago(s), sem confirmação fiscal.
                </span>
              </div>

            </div>

            {/* 📊 RESUMO GERAL */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#b3d4ff] shadow-xs text-center">
                <span className="text-2xl sm:text-3xl font-extrabold text-[#1a237e] block">
                  {guias.length}
                </span>
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider mt-1 block">
                  Registros locais
                </span>
              </div>

              <div className="bg-[#e8f5e9] rounded-xl p-4 sm:p-5 border border-emerald-300 shadow-xs text-center">
                <span className="text-2xl sm:text-3xl font-extrabold text-[#2e7d32] block">
                  {guiasComPagamentoInformado.length}
                </span>
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider mt-1 block">
                  Pagamento informado manualmente
                </span>
              </div>

              <div className="bg-[#ffebee] rounded-xl p-4 sm:p-5 border border-rose-300 shadow-xs text-center">
                <span className="text-2xl sm:text-3xl font-extrabold text-[#c62828] block">
                  {guiasNaoPagas.length}
                </span>
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider mt-1 block">
                  Não pagas no controle local
                </span>
              </div>
            </div>

            {/* ⚠️ GUIAS EM ATRASO — PRIMEIRO, DESTAQUE! */}
            {guiasEmAtraso.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-black text-[#c62828] flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-[#c62828]" />
                    <span>⚠️ Vencimento passado — registro local</span>
                  </h2>
                  <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
                    {guiasEmAtraso.length} {guiasEmAtraso.length === 1 ? 'pendência' : 'pendências'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {guiasEmAtraso.map((guia) => (
                    <div
                      key={guia.id}
                      className="bg-white rounded-2xl p-5 border-l-4 border-l-[#c62828] border-y border-r border-slate-200 shadow-sm hover:shadow-md transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-[#1a237e]">
                            {guia.competencia}
                          </span>
                          <span className="text-[11px] font-bold text-slate-700 bg-[#e8eaf6] px-2 py-0.5 rounded-full">
                            {guia.tipo}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 font-semibold">
                          Cód. {guia.codigoReceita}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Vencimento Original:</span>
                          <strong className="text-slate-800 font-mono">
                            {guia.dataVencimento.toLocaleDateString('pt-BR')}
                          </strong>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span>Valor Original:</span>
                          <span className="font-semibold text-slate-800">
                            R$ {guia.valorPrincipal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-950">
                          Juros, multa e total atualizado não foram calculados. Consulte o Sicalc ou o portal oficial antes de pagar.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-[#1a237e] uppercase block">Principal informado no registro:</span>
                          <span className="text-[10px] text-slate-500">Não é valor atualizado para pagamento.</span>
                        </div>
                        <span className="text-xl font-black text-[#c62828]">
                          R$ {guia.valorPrincipal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <a href="https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/pagamentos-e-parcelamentos/darf-calculo-e-impressao-programa-sicalc-1" target="_blank" rel="noreferrer" className="w-full py-3 bg-[#1a237e] hover:bg-[#0f1654] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                          <ExternalLink className="w-4 h-4" />
                          <span>Calcular no Sicalc</span>
                        </a>
                        <button type="button" onClick={() => emitirGuia(guia)} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                          <FileText className="w-4 h-4" />
                          <span>Ver registro local</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ✅ GUIAS EM DIA */}
            {guiasEmDia.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-black text-[#2e7d32] flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#2e7d32]" />
                    <span>📅 Vencimento futuro — registro local</span>
                  </h2>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                    Sem cálculo de encargos
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {guiasEmDia.map((guia) => (
                    <div
                      key={guia.id}
                      className="bg-white rounded-2xl p-5 border-l-4 border-l-[#2e7d32] border-y border-r border-slate-200 shadow-sm hover:shadow-md transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-[#1a237e]">
                            {guia.competencia}
                          </span>
                          <span className="text-[11px] font-bold text-slate-700 bg-[#e8eaf6] px-2 py-0.5 rounded-full">
                            {guia.tipo}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                          No prazo (cálculo local)
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Data de Vencimento:</span>
                          <strong className="text-slate-800 font-mono">
                            {guia.dataVencimento.toLocaleDateString('pt-BR')}
                          </strong>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span>Declaração DCTFWeb:</span>
                          <span className="text-slate-700 font-medium truncate max-w-[200px]">
                            {guia.declaracao}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span>Composição informada:</span>
                          <span className="text-slate-800 font-semibold">
                            {guia.inssPatronal != null || guia.inssSegurados != null
                              ? `R$ ${((guia.inssPatronal || 0) + (guia.inssSegurados || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                              : 'não informada'}
                          </span>
                        </div>
                      </div>

                      {/* Linha Total Regular */}
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase">
                          Principal informado:
                        </span>
                        <span className="text-xl font-black text-[#2e7d32]">
                          R$ {guia.valorPrincipal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => emitirGuia(guia)}
                        className="w-full py-3 bg-[#2e7d32] hover:bg-[#1b5e20] active:scale-98 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Ver registro local</span>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 📜 HISTÓRICO LOCAL DE PAGAMENTOS INFORMADOS */}
            {guiasComPagamentoInformado.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-black text-[#1565c0] flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-[#1565c0]" />
                    <span>📜 PAGAMENTOS INFORMADOS — Histórico local DCTFWeb</span>
                  </h2>
                  <span className="text-xs font-bold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-200">
                    {guiasComPagamentoInformado.length} registro(s)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {guiasComPagamentoInformado.map((guia) => (
                    <div
                      key={guia.id}
                      className="bg-white rounded-2xl p-5 border-l-4 border-l-[#1565c0] border-y border-r border-slate-200 shadow-sm hover:shadow-md transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-[#1a237e]">
                            {guia.competencia}
                          </span>
                          <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                            {guia.tipo}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>PAGAMENTO INFORMADO</span>
                        </span>
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

                      <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">Valor informado como pago:</span>
                        <span className="text-lg font-black text-[#1565c0] font-mono">
                          R$ {guia.valorPrincipal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => emitirGuia(guia)}
                        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Ver registro local (não é comprovante)</span>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* ========================================================== */}
      {/* Prévia de cálculo local — não emite documento oficial */}
      {/* ========================================================== */}
      {guiaSelecionadaModal && (
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
                    Registro local da guia — não é DARF
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Consulta oficial não realizada • nenhum código pagável emitido
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setGuiaSelecionadaModal(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="border-2 border-rose-600 rounded-xl p-3 text-center text-sm font-black uppercase text-rose-700">REGISTRO LOCAL — NÃO É GUIA E NÃO DEVE SER USADO PARA PAGAMENTO</div>
            {/* Demonstrativo local */}
            <div className="border-2 border-slate-900 rounded-xl overflow-hidden text-xs bg-white shadow-xs">
              <div className="bg-slate-900 text-white p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider block text-amber-400">MURADE · CONTROLE LOCAL</span>
                  <span className="text-sm font-black">
                    Dados informados pela equipe
                  </span>
                </div>
                <span className="text-base font-black px-2.5 py-1 bg-white text-slate-900 rounded">
                  PRÉVIA
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-300">
                {/* Lado Esquerdo: Identificação do Contribuinte */}
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
                      Observações / Composição do Tributo
                    </span>
                    <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                      Recolhimento previdenciário conf. DCTFWeb Geral.<br />
                      {guiaSelecionadaModal.inssPatronal != null || guiaSelecionadaModal.inssSegurados != null || guiaSelecionadaModal.outrasEntidades != null
                        ? `Valores informados: patronal R$ ${guiaSelecionadaModal.inssPatronal?.toFixed(2) ?? '—'} • segurados R$ ${guiaSelecionadaModal.inssSegurados?.toFixed(2) ?? '—'} • terceiros R$ ${guiaSelecionadaModal.outrasEntidades?.toFixed(2) ?? '—'}`
                        : 'Composição por categoria não informada; detalhamento não calculado.'}
                    </p>
                  </div>
                </div>

                {/* Lado Direito: Campos Numéricos Oficiais */}
                <div className="divide-y divide-slate-300">
                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-600">02. PERÍODO DE APURAÇÃO</span>
                    <strong className="font-mono text-xs">{guiaSelecionadaModal.competencia}</strong>
                  </div>

                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-600">Código informado no registro local</span>
                    <strong className="font-mono text-xs text-indigo-900 font-black">{guiaSelecionadaModal.codigoReceita}</strong>
                  </div>

                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-600">Vencimento informado</span>
                    <strong className="font-mono text-xs">{guiaSelecionadaModal.dataVencimento.toLocaleDateString('pt-BR')}</strong>
                  </div>

                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-600">07. VALOR DO PRINCIPAL</span>
                    <span className="font-mono text-xs">
                      R$ {guiaSelecionadaModal.valorPrincipal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="p-2.5 flex justify-between items-center bg-amber-50">
                    <span className="text-[10px] font-bold text-amber-900">Multa, juros e total atualizado</span>
                    <strong className="text-xs text-amber-900">Não calculados</strong>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-rose-200 text-xs font-bold text-rose-800">Linha digitável, código de barras, Pix e autenticação não foram gerados. Para emitir ou atualizar valores, acesse o portal oficial/Sicalc.</div>
            </div>

            {/* Ações de Download e Impressão */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Prévia local; não transmitida nem autenticada pela RFB.</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir prévia</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGuiaSelecionadaModal(null);
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
    </div>
  );
}
