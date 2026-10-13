import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Server, 
  Receipt, 
  Users, 
  ShieldCheck, 
  X, 
  Loader2, 
  Sparkles,
  Database,
  ArrowRight,
  FileSpreadsheet,
  CheckCheck
} from 'lucide-react';
import { 
  FISCOIA_CONTROLE_CONSULTAS, 
  VerificacaoConsulta, 
  ResultadoConsultaControlada 
} from '../services/serpro/controleConsultasFiscoia.service';

interface ModalConfirmacaoConsultaFiscoiaProps {
  aberto: boolean;
  cnpj: string;
  nomeCliente: string;
  tipoConsulta?: string;
  onFechar: () => void;
  onConsultaConcluida?: (resultado: ResultadoConsultaControlada) => void;
}

export const ModalConfirmacaoConsultaFiscoia: React.FC<ModalConfirmacaoConsultaFiscoiaProps> = ({
  aberto,
  cnpj,
  nomeCliente,
  tipoConsulta = "Conferir Agora",
  onFechar,
  onConsultaConcluida
}) => {
  const [verificacao, setVerificacao] = useState<VerificacaoConsulta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConsultaControlada | null>(null);
  const [vendoCache, setVendoCache] = useState(false);
  const [abaVisualizacao, setAbaVisualizacao] = useState<'consulta' | 'relatorio_cliente'>('consulta');

  useEffect(() => {
    if (aberto && cnpj) {
      setResultado(null);
      setVendoCache(false);
      setAbaVisualizacao('consulta');
      const v = FISCOIA_CONTROLE_CONSULTAS.podeBuscarAgora(cnpj, nomeCliente);
      setVerificacao(v);
    }
  }, [aberto, cnpj, nomeCliente]);

  if (!aberto) return null;

  const dadosSalvos = FISCOIA_CONTROLE_CONSULTAS.obterDadosSalvos(cnpj);

  // Executa a busca real (seja grátis ou paga com confirmação)
  const handleConfirmar = async () => {
    setCarregando(true);
    try {
      const res = await FISCOIA_CONTROLE_CONSULTAS.confirmarEBuscar(cnpj, tipoConsulta);
      setResultado(res);
      if (onConsultaConcluida) {
        onConsultaConcluida(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  };

  // Ver dados salvos no cache sem cobrar nada
  const handleVerCache = () => {
    if (dadosSalvos && dadosSalvos.dados) {
      setResultado({
        sucesso: true,
        mensagem: "✅ Exibindo dados salvos em cache — Consulta 100% Gratuita e Ilimitada!",
        valorCobrado: 0,
        totalAcumulado: FISCOIA_CONTROLE_CONSULTAS.CLIENTES[cnpj.replace(/\D/g, '')]?.totalACobrarMes || 0,
        gratuito: true,
        dados: dadosSalvos.dados
      });
      setVendoCache(true);
    }
  };

  const relatorio = FISCOIA_CONTROLE_CONSULTAS.relatorioCliente(cnpj);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* CABEÇALHO */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black tracking-tight text-white">
                  FiscoIA — Sistema de Consulta Controlada
                </h2>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-400/30">
                  v1.0 Oficial
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {nomeCliente} • CNPJ: <span className="font-mono text-slate-300">{cnpj}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SUBMENU DE ABAS (CONSULTA / EXTRATO DO CLIENTE) */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 text-xs font-bold text-slate-600">
          <button
            type="button"
            onClick={() => setAbaVisualizacao('consulta')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              abaVisualizacao === 'consulta'
                ? 'border-blue-600 text-blue-700 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Consulta Serpro + Fiscal + DP</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaVisualizacao('relatorio_cliente')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              abaVisualizacao === 'relatorio_cliente'
                ? 'border-blue-600 text-blue-700 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Extrato de Cobrança do Cliente (R$)</span>
            {relatorio.totalConsultasExtras > 0 && (
              <span className="bg-amber-100 text-amber-900 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {relatorio.totalConsultasExtras}
              </span>
            )}
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {abaVisualizacao === 'relatorio_cliente' ? (
            /* VISUALIZAÇÃO: EXTRATO DO CLIENTE */
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 font-medium">Próxima Semana Grátis</div>
                  <div className="text-xs font-black text-slate-900 mt-1">
                    {relatorio.proximaAtualizacaoGratis}
                  </div>
                  <div className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Segunda 03:00h
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 font-medium">Consultas Extras no Mês</div>
                  <div className="text-sm font-black text-slate-900 mt-1">
                    {relatorio.totalConsultasExtras} consulta(s)
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    R$ 2,50 cada antecipação
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
                  <div className="text-amber-800 font-medium">Total na Mensalidade</div>
                  <div className="text-base font-black text-amber-950 mt-1">
                    {relatorio.totalACobrar}
                  </div>
                  <div className="text-[10px] text-amber-700 mt-1">
                    Será faturado na fatura do mês
                  </div>
                </div>
              </div>

              {/* LISTA DE CONSULTAS EXTRAS */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-3 bg-slate-100 border-b border-slate-200 font-bold text-slate-800 flex items-center justify-between">
                  <span>Histórico de Cobranças Deste Mês</span>
                  <span className="text-slate-500 text-[11px] font-normal">
                    {relatorio.detalheConsultas.length} registros
                  </span>
                </div>

                {relatorio.detalheConsultas.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="font-bold text-slate-700">Nenhuma cobrança extra este mês!</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Este cliente tem utilizado apenas as atualizações semanais gratuitas ou dados em cache.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {relatorio.detalheConsultas.map((item, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="font-bold text-slate-900">{item.descricao}</div>
                          <div className="text-[11px] text-slate-500">{item.dataHora}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-amber-700">
                            + R$ {item.valor.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400">Na mensalidade</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* VISUALIZAÇÃO: CONSULTA CONTROLADA */
            <div className="space-y-4">
              
              {/* REGRAS CLARAS NO TOPO */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-emerald-900">1x Por Semana Grátis</strong>
                    <span>Atualização na segunda às 03h</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-950 flex items-start gap-2">
                  <Database className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-blue-900">Dados Salvos</strong>
                    <span>Grátis e Ilimitado no Cache</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-950 flex items-start gap-2">
                  <DollarSign className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-amber-900">Antecipar Consulta</strong>
                    <span>R$ 2,50 cobrado na mensalidade</span>
                  </div>
                </div>
              </div>

              {/* SE AINDA NÃO EXECUTOU A BUSCA NESTA ABERTURA */}
              {!resultado && !carregando && verificacao && (
                <div className="space-y-4">
                  {verificacao.gratuito ? (
                    /* CENÁRIO 1: JÁ PASSOU DA SEMANA -> 100% GRÁTIS */
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-slate-800 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-900 font-black text-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span>{verificacao.mensagem}</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        O ciclo semanal foi renovado. A busca diretamente na SERPRO para o CNPJ{' '}
                        <strong className="text-slate-800">{cnpj}</strong> será processada sem nenhum custo adicional.
                      </p>
                      <div className="text-[11px] text-emerald-800 font-semibold pt-1">
                        Próxima renovação automática: {verificacao.proximaAtualizacao} (Segunda-feira 03:00h)
                      </div>
                    </div>
                  ) : (
                    /* CENÁRIO 2: ANTECIPAÇÃO ANTES DA SEMANA -> AVISO EXPLÍCITO COM CONFIRMAÇÃO */
                    <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-slate-800 space-y-3 shadow-xs">
                      <div className="flex items-center gap-2 text-amber-950 font-black text-sm">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <span>{verificacao.aviso}</span>
                      </div>

                      <div className="p-3 bg-white/80 rounded-xl border border-amber-200 space-y-2 text-xs">
                        <p className="text-slate-700">
                          A próxima atualização gratuita para este cliente está programada para{' '}
                          <strong>{verificacao.proximaAtualizacao}</strong> (em cerca de{' '}
                          <strong>{verificacao.diasRestantes} dia(s) e {verificacao.horasRestantes} hora(s)</strong>).
                        </p>

                        <div className="pt-2 border-t border-amber-100 flex items-center justify-between">
                          <div>
                            <span className="text-slate-500 font-medium">Custo da consulta antecipada:</span>
                            <div className="text-base font-black text-amber-800">
                              R$ {verificacao.custo.toFixed(2)}
                            </div>
                          </div>
                          <span className="text-[11px] bg-amber-100 text-amber-900 px-2 py-1 rounded-lg font-bold">
                            Cobrado na mensalidade
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-amber-900 font-medium">
                        ℹ️ Você pode consultar os <strong>dados salvos no cache gratuitamente</strong> sem antecipar a busca na SERPRO.
                      </p>
                    </div>
                  )}

                  {/* BOTÕES DE AÇÃO */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
                    {dadosSalvos && (
                      <button
                        type="button"
                        onClick={handleVerCache}
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
                      >
                        <Database className="w-4 h-4 text-blue-600" />
                        <span>💾 Consultar Dados Salvos (Grátis)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onFechar}
                      className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-300"
                    >
                      {verificacao.gratuito ? 'Cancelar' : '❌ Aguardar a semana grátis'}
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmar}
                      className={`px-4 py-2.5 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                        verificacao.gratuito 
                          ? 'bg-emerald-600 hover:bg-emerald-700' 
                          : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      {verificacao.gratuito ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Buscar Agora (Grátis)</span>
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-4 h-4" />
                          <span>Sim — Buscar e cobrar R$ 2,50</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ESTADO DE CARREGAMENTO */}
              {carregando && (
                <div className="py-12 text-center space-y-3">
                  <Loader2 className="w-9 h-9 text-blue-600 animate-spin mx-auto" />
                  <div className="text-sm font-bold text-slate-900">
                    Conectando com SERPRO + FISCAL + DP...
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Buscando certidões e débitos oficiais na Receita Federal, confrontando livros de entrada/saída e folha de pagamento.
                  </p>
                </div>
              )}

              {/* EXIBIÇÃO DO RESULTADO COMPLETO: SERPRO + FISCAL + DP */}
              {resultado && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* ALERTA DE SUCESSO / COBRANÇA */}
                  <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                    resultado.valorCobrado > 0 
                      ? 'bg-amber-50 border-amber-200 text-amber-900' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      {resultado.valorCobrado > 0 ? (
                        <DollarSign className="w-4 h-4 text-amber-600" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                      <span>{resultado.mensagem}</span>
                    </div>

                    {resultado.valorCobrado > 0 && (
                      <span className="font-mono font-black bg-amber-200/70 text-amber-950 px-2 py-0.5 rounded-md text-[11px]">
                        + R$ {resultado.valorCobrado.toFixed(2)} na fatura
                      </span>
                    )}
                  </div>

                  {/* ⚖️ O CORAÇÃO DO FISCOIA: COMPARAÇÃO DAS 3 FONTES */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2 font-black text-xs text-slate-900">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span>Comparação Automática das 3 Fontes (FiscoIA)</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {resultado.dados.dataHora}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      {/* FONTE 1: SERPRO */}
                      <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-200">
                        <div className="font-black text-blue-900 flex items-center gap-1.5 mb-1.5">
                          <Server className="w-3.5 h-3.5 text-blue-600" />
                          <span>1. SERPRO / RFB</span>
                        </div>
                        <div className="space-y-1 text-[11px] text-slate-600">
                          <div><strong>Fonte:</strong> Oficial Receita Federal</div>
                          <div><strong>Situação:</strong> Ativa (e-CAC)</div>
                          <div><strong>CND:</strong> Regular sem débitos</div>
                          <div className="text-blue-700 font-bold mt-1">DCTFWeb: 100% transmitida</div>
                        </div>
                      </div>

                      {/* FONTE 2: MURADE FISCAL */}
                      <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-200">
                        <div className="font-black text-purple-900 flex items-center gap-1.5 mb-1.5">
                          <Receipt className="w-3.5 h-3.5 text-purple-600" />
                          <span>2. MURADE FISCAL</span>
                        </div>
                        <div className="space-y-1 text-[11px] text-slate-600">
                          <div><strong>Livro:</strong> 12 saídas / 4 entradas</div>
                          <div><strong>Faturamento:</strong> R$ 84.500,00</div>
                          <div><strong>ICMS Apurado:</strong> R$ 6.320,00</div>
                          <div className="text-purple-700 font-bold mt-1">Livro Fiscal Fechado</div>
                        </div>
                      </div>

                      {/* FONTE 3: MURADE DP */}
                      <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200">
                        <div className="font-black text-emerald-900 flex items-center gap-1.5 mb-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-600" />
                          <span>3. MURADE DP</span>
                        </div>
                        <div className="space-y-1 text-[11px] text-slate-600">
                          <div><strong>Folha:</strong> 18 colaboradores</div>
                          <div><strong>INSS Folha:</strong> R$ 4.280,50</div>
                          <div><strong>FGTS:</strong> R$ 3.120,00</div>
                          <div className="text-emerald-700 font-bold mt-1">eSocial 100% Enviado</div>
                        </div>
                      </div>
                    </div>

                    {/* STATUS FINAL DE DIVERGÊNCIA */}
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900 font-bold">
                      <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{resultado.dados.comparacao.mensagem}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={onFechar}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Fechar e Continuar
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* RODAPÉ DO MODAL */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>Robô FiscoIA • Atualizações Semanais às Segundas 03:00h</span>
          <span>Valores auditáveis na fatura</span>
        </div>

      </div>
    </div>
  );
};
