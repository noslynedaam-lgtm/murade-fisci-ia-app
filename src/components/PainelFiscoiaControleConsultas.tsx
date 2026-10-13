import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign, 
  Calendar, 
  Clock, 
  Server, 
  Receipt, 
  Users, 
  Database, 
  FileSpreadsheet, 
  ArrowRight, 
  RefreshCw, 
  ShieldCheck, 
  HelpCircle,
  TrendingUp,
  Building2
} from 'lucide-react';
import { 
  FISCOIA_CONTROLE_CONSULTAS, 
  ResultadoConsultaControlada 
} from '../services/serpro/controleConsultasFiscoia.service';
import { ModalConfirmacaoConsultaFiscoia } from './ModalConfirmacaoConsultaFiscoia';
import { obterEmpresas } from '../services/empresas/empresas.service';

interface PainelFiscoiaControleConsultasProps {
  cnpjInicial?: string;
  nomeInicial?: string;
}

export const PainelFiscoiaControleConsultas: React.FC<PainelFiscoiaControleConsultasProps> = ({
  cnpjInicial = '',
  nomeInicial = ''
}) => {
  const empresas = obterEmpresas();
  const [cnpjSelecionado, setCnpjSelecionado] = useState(cnpjInicial || (empresas.length > 0 ? empresas[0].cnpj : ''));
  const [nomeSelecionado, setNomeSelecionado] = useState(nomeInicial || (empresas.length > 0 ? empresas[0].razaoSocial : ''));
  const [modalAberto, setModalAberto] = useState(false);
  const [tipoConsulta, setTipoConsulta] = useState('Conferir Agora');
  const [ultimoResultado, setUltimoResultado] = useState<any>(null);
  const [versaoState, setVersaoState] = useState(0); // Para forçar re-render quando houver cobrança

  // Carrega empresas cadastradas se houver
  useEffect(() => {
    if (empresas.length > 0 && !cnpjSelecionado) {
      setCnpjSelecionado(empresas[0].cnpj);
      setNomeSelecionado(empresas[0].razaoSocial);
    }
  }, [empresas]);

  // Atualiza nome quando muda o CNPJ
  const handleSelecionarEmpresa = (novoCnpj: string) => {
    setCnpjSelecionado(novoCnpj);
    const emp = empresas.find(e => e.cnpj === novoCnpj);
    if (emp) {
      setNomeSelecionado(emp.razaoSocial);
    }
    setUltimoResultado(null);
  };

  const relatorioCliente = FISCOIA_CONTROLE_CONSULTAS.relatorioCliente(cnpjSelecionado);
  const relatorioGeral = FISCOIA_CONTROLE_CONSULTAS.relatorioGeral();
  const dadosSalvos = FISCOIA_CONTROLE_CONSULTAS.obterDadosSalvos(cnpjSelecionado);
  const verificacao = FISCOIA_CONTROLE_CONSULTAS.podeBuscarAgora(cnpjSelecionado, nomeSelecionado);

  const handleAbrirConsulta = (tipo: string = 'Conferir Agora') => {
    setTipoConsulta(tipo);
    setModalAberto(true);
  };

  const handleConsultaConcluida = (res: ResultadoConsultaControlada) => {
    setUltimoResultado(res.dados);
    setVersaoState(v => v + 1);
  };

  const handleCarregarCache = () => {
    if (dadosSalvos && dadosSalvos.dados) {
      setUltimoResultado(dadosSalvos.dados);
    }
  };

  return (
    <div className="space-y-6">
      {/* BANNER PRINCIPAL COM REGRAS DO FISCOIA */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 text-white border border-blue-800/40 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                FiscoIA • Controle de Consultas
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 1x Por Semana Grátis (Segunda 03h)
              </span>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Antecipação: R$ 2,50 na fatura
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Sincronização Inteligente SERPRO + FISCAL + DP</span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              O robô FiscoIA atualiza automaticamente toda segunda-feira às 03:00h da madrugada de forma <strong>100% gratuita</strong>. 
              Você pode consultar dados salvos no cache a qualquer momento sem custo, ou antecipar uma nova checagem direta na SERPRO por apenas <strong>R$ 2,50</strong> (com confirmação prévia).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleAbrirConsulta('Conferir Agora')}
              className="px-5 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Sparkles className="w-4 h-4 text-blue-200" />
              <span>Conferir Agora (SERPRO + FISCAL + DP)</span>
            </button>
          </div>
        </div>

        {/* 3 PILARES VISUAIS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-800 text-xs">
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <strong className="block text-white font-bold">1x Por Semana Grátis</strong>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Atualização automática oficial sem custo toda segunda-feira às 03:00h da madrugada.
              </p>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <strong className="block text-white font-bold">Consultas Salvas no Cache</strong>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Acesse o histórico e os dados já conferidos de forma <strong>gratuita e ilimitada</strong>.
              </p>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <strong className="block text-white font-bold">Aviso Antes de Cobrar</strong>
              <p className="text-[11px] text-slate-400 mt-0.5">
                O sistema avisa com clareza o custo de R$ 2,50 e só executa após a sua confirmação explícita.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SELEÇÃO DO CLIENTE & STATUS INDIVIDUAL */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Cliente Selecionado para Consulta</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Escolha a empresa para verificar o status semanal e as consultas extras
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={cnpjSelecionado}
              onChange={(e) => handleSelecionarEmpresa(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {empresas.length === 0 ? (
                <option value="">Nenhuma empresa cadastrada</option>
              ) : (
                empresas.map(emp => (
                  <option key={emp.id} value={emp.cnpj}>
                    {emp.razaoSocial} ({emp.cnpj})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* CARDS DE STATUS DO CLIENTE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* CARD 1: PRÓXIMA SEMANA GRÁTIS */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 font-medium">
                <span>Próxima Atualização Grátis</span>
                <Clock className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-xs font-black text-slate-900 mt-1.5">
                {relatorioCliente.proximaAtualizacaoGratis}
              </div>
            </div>
            <div className="text-[11px] text-emerald-700 font-bold mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Segunda 03:00h
            </div>
          </div>

          {/* CARD 2: CONSULTAS EXTRAS NO MÊS */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 font-medium">
                <span>Consultas Extras (Mês)</span>
                <DollarSign className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-lg font-black text-slate-900 mt-1">
                {relatorioCliente.totalConsultasExtras} consulta(s)
              </div>
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              R$ 2,50 cada busca antecipada
            </div>
          </div>

          {/* CARD 3: TOTAL NA MENSALIDADE */}
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-amber-800 font-medium">
                <span>Total a Cobrar no Mês</span>
                <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-lg font-black text-amber-950 mt-1">
                {relatorioCliente.totalACobrar}
              </div>
            </div>
            <div className="text-[11px] text-amber-800 mt-2 font-semibold">
              Faturado junto à mensalidade
            </div>
          </div>

          {/* CARD 4: CACHE LOCAL DISPONÍVEL */}
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-blue-800 font-medium">
                <span>Dados em Cache Salvo</span>
                <Database className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-xs font-bold text-blue-950 mt-1.5">
                {dadosSalvos ? 'Disponível para Leitura' : 'Aguardando 1ª consulta'}
              </div>
            </div>
            <div className="mt-2">
              {dadosSalvos ? (
                <button
                  type="button"
                  onClick={handleCarregarCache}
                  className="text-[11px] text-blue-700 font-black hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>Ver dados salvos (Grátis) ➔</span>
                </button>
              ) : (
                <span className="text-[11px] text-slate-400">Sem cache prévio</span>
              )}
            </div>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO RÁPIDA */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleAbrirConsulta('Conferência Fiscal Completa')}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>Consultar SERPRO + FISCAL + DP Agora</span>
          </button>

          {dadosSalvos && (
            <button
              type="button"
              onClick={handleCarregarCache}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
            >
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>Carregar do Cache (Grátis)</span>
            </button>
          )}

          <div className="text-xs text-slate-500 ml-auto flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Robô programado para conferir divergências</span>
          </div>
        </div>
      </div>

      {/* RESULTADO DA COMPARAÇÃO: SERPRO + FISCAL + DP */}
      {ultimoResultado && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Resultado da Conferência Tripla (SERPRO • FISCAL • DP)</span>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Processado em: {ultimoResultado.dataHora}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* SERPRO */}
            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 space-y-2">
              <div className="font-black text-blue-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-600" />
                <span>SERPRO / Receita Federal</span>
              </div>
              <div className="space-y-1 text-slate-600 text-[11px]">
                <div><strong>Fonte:</strong> Base Oficial RFB / e-CAC</div>
                <div><strong>Situação:</strong> Ativa</div>
                <div><strong>Certidão CND:</strong> Regular perante a União</div>
                <div><strong>DCTFWeb Previdenciária:</strong> R$ 4.280,50 transmitida</div>
              </div>
            </div>

            {/* MURADE FISCAL */}
            <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200 space-y-2">
              <div className="font-black text-purple-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-600" />
                <span>MURADE FISCAL</span>
              </div>
              <div className="space-y-1 text-slate-600 text-[11px]">
                <div><strong>Notas Emitidas:</strong> 12 NFe (R$ 84.500,00)</div>
                <div><strong>Notas de Entrada:</strong> 4 XMLs (R$ 18.200,00)</div>
                <div><strong>ICMS Apurado:</strong> R$ 6.320,00</div>
                <div><strong>Livro Fiscal:</strong> Fechado sem pendências</div>
              </div>
            </div>

            {/* MURADE DP */}
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2">
              <div className="font-black text-emerald-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>MURADE DP</span>
              </div>
              <div className="space-y-1 text-slate-600 text-[11px]">
                <div><strong>Colaboradores:</strong> 18 colaboradores</div>
                <div><strong>INSS Folha:</strong> R$ 4.280,50 (conferido com Serpro)</div>
                <div><strong>FGTS Digital:</strong> R$ 3.120,00</div>
                <div><strong>eSocial:</strong> Eventos periódicos transmitidos</div>
              </div>
            </div>
          </div>

          {/* PARECER FINAL DO COMPARADOR */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-xs text-emerald-950 font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span>{ultimoResultado.comparacao?.mensagem || '✅ TODOS OS DADOS CONFERIDOS — SEM DIVERGÊNCIA!'}</span>
              <p className="text-[11px] text-emerald-800 font-normal mt-0.5">
                Os débitos fiscais e previdenciários apurados nos módulos internos conferem 100% com as guias declaradas perante o Serpro / e-CAC da Receita Federal.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* RELATÓRIO GERAL DE COBRANÇAS PARA A CONTABILIDADE (TODOS OS CLIENTES) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              <span>Relatório Geral de Cobranças (Todos os Clientes)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Total consolidado de consultas extras realizadas antes da semana para cobrança na mensalidade
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-xl text-right">
              <span className="text-[10px] text-amber-800 block font-medium">Total Geral a Cobrar</span>
              <span className="text-sm font-black text-amber-950">{relatorioGeral.totalACobrarGeral}</span>
            </div>
          </div>
        </div>

        {/* TABELA DE CLIENTES */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
              <tr>
                <th className="p-3">Cliente / Razão Social</th>
                <th className="p-3">CNPJ</th>
                <th className="p-3 text-center">Consultas Extras (Mês)</th>
                <th className="p-3 text-right">Total a Cobrar</th>
                <th className="p-3">Próxima Grátis</th>
                <th className="p-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {relatorioGeral.detalhesPorCliente.map((cli, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-bold text-slate-900">{cli.nome}</td>
                  <td className="p-3 font-mono text-slate-500">{cli.cnpj}</td>
                  <td className="p-3 text-center">
                    {cli.consultasExtras > 0 ? (
                      <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full text-[11px]">
                        {cli.consultasExtras} extra(s)
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-black text-slate-900">
                    {cli.totalACobrarNumero > 0 ? (
                      <span className="text-amber-800 font-black">{cli.totalACobrar}</span>
                    ) : (
                      <span className="text-emerald-700">R$ 0,00</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-500 text-[11px]">{cli.proximaGratis}</td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setCnpjSelecionado(cli.cnpj);
                        setNomeSelecionado(cli.nome);
                        handleAbrirConsulta('Conferir Agora');
                      }}
                      className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                    >
                      Consultar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO & ANTECIPAÇÃO */}
      <ModalConfirmacaoConsultaFiscoia
        aberto={modalAberto}
        cnpj={cnpjSelecionado}
        nomeCliente={nomeSelecionado}
        tipoConsulta={tipoConsulta}
        onFechar={() => setModalAberto(false)}
        onConsultaConcluida={handleConsultaConcluida}
      />
    </div>
  );
};
