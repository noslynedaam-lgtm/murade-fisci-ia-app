import React from 'react';
import { 
  Monitor, Share2, Sparkles, CheckCircle2, 
  FileText, ShieldCheck, Download, ExternalLink,
  Laptop, Search, Filter, Lock
} from 'lucide-react';
import { PedacinhoVideo } from '../types';
import IndicadorSetaClique from './IndicadorSetaClique';

interface SimuladorPCProps {
  pedacinho: PedacinhoVideo;
  onAvancar?: () => void;
}

export default function SimuladorPC({ pedacinho, onAvancar }: SimuladorPCProps) {
  const { telaSimulada, alvoClique } = pedacinho;

  return (
    <div className="flex flex-col items-center justify-center relative select-none w-full max-w-4xl mx-auto">
      {/* Moldura do Computador / Navegador Desktop */}
      <div className="w-full bg-slate-900 rounded-2xl border-4 border-slate-700 shadow-2xl overflow-hidden ring-4 ring-slate-950/40">
        {/* Barra Superior da Janela do Navegador no PC */}
        <div className="bg-slate-950 px-4 py-2.5 flex items-center justify-between border-b border-slate-800 text-xs">
          {/* Botões da Janela (Estilo Mac/PC) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            </div>
            {/* Aba do Navegador */}
            <div className="ml-3 px-3 py-1 bg-slate-800 text-slate-200 rounded-t-lg font-medium text-[11px] flex items-center gap-2 border-t border-x border-slate-700">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              <span>FiscoIA • Painel do Contador PC</span>
            </div>
          </div>

          {/* Barra de Endereço URL com Cadeado Seguro */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-lg border border-slate-700 text-[11px] text-slate-300 font-mono w-72 max-w-xs truncate">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>https://app.fiscoia.com.br/{telaSimulada.toLowerCase()}</span>
          </div>

          {/* Badge Indicador de Modo PC */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-300 bg-indigo-950/80 px-2.5 py-0.5 rounded-md border border-indigo-500/30">
            <Laptop className="w-3.5 h-3.5 text-indigo-400" />
            <span>MODO PC / DESKTOP</span>
          </div>
        </div>

        {/* ESTRUTURA DO APLICATIVO NO COMPUTADOR (SIDEBAR + CONTEÚDO AMPLO) */}
        <div className="flex h-[420px] sm:h-[460px] bg-slate-100 text-slate-900 relative overflow-hidden">
          {/* Seta Indicando onde Clicar no PC */}
          {alvoClique && (
            <IndicadorSetaClique 
              alvo={alvoClique} 
              modo="pc" 
              onCliqueAlvo={onAvancar}
            />
          )}

          {/* Mini Barra Lateral do PC (Desktop Sidebar) */}
          <div className="w-44 bg-slate-900 text-white p-3 hidden md:flex flex-col justify-between shrink-0 border-r border-slate-800 select-none">
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                  F
                </div>
                <span className="font-black text-xs tracking-tight text-white">FISCOIA PC</span>
              </div>

              {/* Menu de Navegação no PC */}
              <div className="space-y-1 text-[11px]">
                <div className={`px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer ${
                  telaSimulada === 'INICIO' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}>
                  <span>📊 Início</span>
                </div>

                <div 
                  onClick={onAvancar}
                  className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between cursor-pointer transition-all ${
                    telaSimulada === 'DCTFWEB' 
                      ? 'bg-indigo-600 text-white font-bold ring-2 ring-amber-400' 
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>📋 DCTFWeb</span>
                  <span className="text-[9px] bg-emerald-500 text-slate-950 font-black px-1 rounded">2026</span>
                </div>

                <div className={`px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer ${
                  telaSimulada === 'GUIAS' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}>
                  <span>💳 Guias DARF</span>
                </div>

                <div className={`px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer ${
                  telaSimulada === 'SERPRO' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}>
                  <span>🔌 SERPRO Gateway</span>
                </div>

                <div className={`px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer ${
                  telaSimulada === 'PROCURACAO' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}>
                  <span>📜 Procurações</span>
                </div>

                <div className={`px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer ${
                  telaSimulada === 'IA_CHAT' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}>
                  <span>🤖 IA Fiscal</span>
                </div>
              </div>
            </div>

            {/* Perfil do Contador no PC */}
            <div className="bg-slate-800/80 p-2 rounded-xl text-[10px] text-slate-300 border border-slate-700">
              <span className="text-slate-400 block font-semibold">Operador PC:</span>
              <strong className="text-white">Murade Assessoria</strong>
            </div>
          </div>

          {/* ÁREA PRINCIPAL DO PC COM RESOLUÇÃO AMPLA */}
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3 bg-slate-50 relative">
            {/* TELA DE LOGIN PC */}
            {telaSimulada === 'LOGIN' && (
              <div className="max-w-md mx-auto my-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl mx-auto shadow-md">
                  F
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Acesso ao FiscoIA Desktop</h3>
                  <p className="text-xs text-slate-500">Insira suas credenciais ou utilize seu Certificado A1</p>
                </div>
                <div className="space-y-2 text-left text-xs">
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                    contato@murade.com.br
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                    ••••••••••••••••
                  </div>
                  <button
                    type="button"
                    onClick={onAvancar}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-500 transition-all ring-2 ring-amber-400 cursor-pointer"
                  >
                    Entrar no Sistema
                  </button>
                </div>
              </div>
            )}

            {/* TELA DE INÍCIO PC */}
            {telaSimulada === 'INICIO' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Painel Geral de Obrigações Fiscais</h3>
                    <p className="text-xs text-slate-500">Competência de Setembro de 2026 • Visão Geral Desktop</p>
                  </div>
                  <button 
                    type="button"
                    onClick={onAvancar}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl ring-2 ring-amber-400 cursor-pointer"
                  >
                    Filtrar Vencimentos Dia 20
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] text-slate-400 font-bold block">TOTAL APURADO</span>
                    <div className="text-base font-black text-indigo-950">R$ 58.420,10</div>
                    <span className="text-[10px] text-emerald-600 font-semibold">✓ 18 declarações</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border-2 border-amber-400 shadow-2xs">
                    <span className="text-[11px] text-slate-400 font-bold block">DARF DIA 20</span>
                    <div className="text-base font-black text-rose-600">R$ 14.850,20</div>
                    <span className="text-[10px] text-amber-700 font-semibold">Pendente de Transmissão</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] text-slate-400 font-bold block">STATUS SERPRO</span>
                    <div className="text-base font-black text-emerald-600">Conectado</div>
                    <span className="text-[10px] text-slate-500 font-semibold">Latência: 120ms</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs font-bold text-slate-800 block mb-2">Empresas com Vencimento Próximo</span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div>
                        <strong className="text-slate-900 block">Empresa Exemplo (Demonstração)</strong>
                        <span className="text-[10px] text-slate-500">CNPJ: 00.000.000/0000-00</span>
                      </div>
                      <span className="text-rose-600 font-bold">Vence em 20/09</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TELA DE DCTFWEB NO PC */}
            {telaSimulada === 'DCTFWEB' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">DCTFWeb Previdenciária & Fiscais</h3>
                    <p className="text-xs text-slate-500">Transmissão em lote e conferência com a Receita Federal</p>
                  </div>
                  <button
                    type="button"
                    onClick={onAvancar}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm ring-2 ring-amber-400 cursor-pointer"
                  >
                    Transmitir DCTFWeb
                  </button>
                </div>

                {/* Tabela Desktop */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 text-[10px] font-bold uppercase">
                      <tr>
                        <th className="p-2.5">Razão Social</th>
                        <th className="p-2.5">CNPJ</th>
                        <th className="p-2.5">Valor DARF</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">Empresa Exemplo (Demonstração)</td>
                        <td className="p-2.5 text-slate-500 font-mono text-[11px]">00.000.000/0000-00</td>
                        <td className="p-2.5 font-black text-indigo-950">R$ 4.250,00</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                            Pronto p/ Envio
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={onAvancar}
                            className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold ring-2 ring-amber-400 cursor-pointer"
                          >
                            Transmitir Agora
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TELA DE GUIAS NO PC */}
            {telaSimulada === 'GUIAS' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900">Visualização de Guia DARF Oficial</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onAvancar}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold ring-2 ring-amber-400 cursor-pointer"
                    >
                      Copiar Pix Copia e Cola
                    </button>
                    <button
                      type="button"
                      onClick={onAvancar}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 ring-2 ring-amber-400 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Enviar WhatsApp
                    </button>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Documento de Arrecadação</span>
                      <strong className="block text-sm text-slate-900">DARF Previdenciário (DCTFWeb)</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Valor Total</span>
                      <div className="text-base font-black text-indigo-700">R$ 2.450,80</div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl font-mono text-[11px] text-slate-700 border border-slate-200 break-all">
                    Linha Digitável: 85800000002-4 45080182202-6 60920261012-8 34567890123-0
                  </div>
                </div>
              </div>
            )}

            {/* TELA DE SERPRO NO PC */}
            {telaSimulada === 'SERPRO' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Integração Governamental SERPRO</h3>
                    <p className="text-xs text-slate-500">Conexão direta com os servidores oficiais da Receita Federal</p>
                  </div>
                  <button
                    type="button"
                    onClick={onAvancar}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold ring-2 ring-amber-400 cursor-pointer"
                  >
                    Testar Conexão Agora
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                    <strong className="text-slate-800 block">Serviços Habilitados:</strong>
                    <div className="space-y-1 text-slate-600">
                      <div className="flex justify-between">
                        <span>Integra Contador (DCTFWeb)</span>
                        <span className="text-emerald-700 font-bold">100% Online</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Consulta CNPJ e Cadastros</span>
                        <span className="text-emerald-700 font-bold">100% Online</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Certidões Negativas CND</span>
                        <span className="text-emerald-700 font-bold">100% Online</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-950 text-white p-3 rounded-xl shadow-2xs space-y-2">
                    <strong className="text-yellow-400 block">Status da Conexão Desktop:</strong>
                    <div className="text-sm font-bold">Gateway Oficial Ativo</div>
                    <div className="text-xs text-indigo-200 font-mono">Latência Média: 110 ms</div>
                  </div>
                </div>
              </div>
            )}

            {/* TELA DE PROCURAÇÃO NO PC */}
            {telaSimulada === 'PROCURACAO' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900">Gestão de Procurações Eletrônicas RFB</h3>
                  <button
                    type="button"
                    onClick={onAvancar}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold ring-2 ring-amber-400 cursor-pointer"
                  >
                    Validar Procuração
                  </button>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-slate-900 text-sm">Empresa Exemplo (Demonstração)</strong>
                      <span className="text-slate-500 block">CNPJ: 00.000.000/0000-00</span>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[11px]">
                      Ativa no e-CAC
                    </span>
                  </div>
                  <div className="text-slate-600 text-[11px]">
                    Poderes: DCTFWeb, Transmissão Folha, Certidões Negativas e Parcelamentos.
                  </div>
                </div>
              </div>
            )}

            {/* TELA DE IA CHAT NO PC */}
            {telaSimulada === 'IA_CHAT' && (
              <div className="space-y-3">
                <h3 className="text-sm font-black text-slate-900">Assistente Jurídico e Fiscal FiscoIA</h3>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 text-xs">
                  <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-indigo-900">
                    <strong>Pergunta do Contador:</strong>
                    <p className="mt-0.5">&quot;Qual o prazo de entrega da DCTFWeb de Setembro e penalidades?&quot;</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-800 space-y-1">
                    <span className="font-bold text-indigo-700 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Análise da Legislação em Tempo Real:
                    </span>
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      O prazo de transmissão da DCTFWeb é até o dia 20 do mês seguinte à apuração. Em caso de atraso, incide a MAED (Multa por Atraso na Entrega da Declaração) com valor mínimo legal de R$ 200 para pessoas jurídicas inativas e R$ 500 nos demais casos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onAvancar}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold ring-2 ring-amber-400 cursor-pointer"
                  >
                    Enviar Consulta Fiscal
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DICA DE CLIQUE NO PC */}
      <div className="mt-3 text-center text-xs text-slate-400">
        🖱️ <strong>Mouse no Computador:</strong> A seta amarela indica o botão ou menu onde você deve clicar no monitor.
      </div>
    </div>
  );
}
