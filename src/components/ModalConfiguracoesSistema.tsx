import React, { useState, useEffect } from 'react';
import { 
  X, Settings, Key, ShieldCheck, Building2, Calendar, 
  Bell, Users, Database, RefreshCw, HelpCircle, 
  ExternalLink, CheckCircle2, Download, AlertTriangle, Save,
} from 'lucide-react';
import { UsuarioAuth } from '../types';

const CONFIG_LOCAL_KEY = 'murade_configuracoes_locais_v1';

interface ModalConfiguracoesSistemaProps {
  aberto: boolean;
  onFechar: () => void;
  abaInicial?: string;
  usuarioAtual?: UsuarioAuth | null;
  onNavegar?: (aba: string) => void;
}

export default function ModalConfiguracoesSistema({
  aberto,
  onFechar,
  abaInicial = 'certificado',
  usuarioAtual,
  onNavegar
}: ModalConfiguracoesSistemaProps) {
  const [opcaoAtiva, setOpcaoAtiva] = useState<string>(abaInicial);
  const [mensagemStatus, setMensagemStatus] = useState<string | null>(null);

  // Estados dos formulários de configuração
  const [certTipo, setCertTipo] = useState<'A1' | 'A3'>('A1');
  const [certArquivoNome, setCertArquivoNome] = useState<string>('');
  const [certValidade, setCertValidade] = useState<string>('');

  const [serproCnpj, setSerproCnpj] = useState<string>('');
  const [serproAmbiente, setSerproAmbiente] = useState<'producao' | 'homologacao'>('producao');

  const [empRazao, setEmpRazao] = useState<string>('');
  const [empCnpj, setEmpCnpj] = useState<string>('');
  const [empEndereco, setEmpEndereco] = useState<string>('');
  const [empTelefone, setEmpTelefone] = useState<string>('');

  const [mesRef, setMesRef] = useState<string>('2026-09');
  const [lembreteDias, setLembreteDias] = useState<string>('3');

  const [emailAlertas, setEmailAlertas] = useState<string>(usuarioAtual?.email || 'seuemail@fiscoia.com.br');
  const [whatsappAlertas, setWhatsappAlertas] = useState<string>('(11) 99999-9999');
  const [notifVencimento, setNotifVencimento] = useState<boolean>(true);
  const [notifGuias, setNotifGuias] = useState<boolean>(true);

  const [perfilSelecionado, setPerfilSelecionado] = useState<string>(
    usuarioAtual?.ehAdmin ? 'MASTER' : 'CONTADOR'
  );

  useEffect(() => {
    if (abaInicial) {
      setOpcaoAtiva(abaInicial);
    }
  }, [abaInicial]);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CONFIG_LOCAL_KEY);
      if (!salvo) return;
      const config: unknown = JSON.parse(salvo);
      if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Formato de configurações inválido.');
      const dados = config as Record<string, unknown>;
      if (dados.certTipo === 'A1' || dados.certTipo === 'A3') setCertTipo(dados.certTipo);
      if (typeof dados.certArquivoNome === 'string') setCertArquivoNome(dados.certArquivoNome);
      if (typeof dados.certValidade === 'string') setCertValidade(dados.certValidade);
      if (typeof dados.serproCnpj === 'string') setSerproCnpj(dados.serproCnpj);
      if (dados.serproAmbiente === 'producao' || dados.serproAmbiente === 'homologacao') setSerproAmbiente(dados.serproAmbiente);
      if (typeof dados.empRazao === 'string') setEmpRazao(dados.empRazao);
      if (typeof dados.empCnpj === 'string') setEmpCnpj(dados.empCnpj);
      if (typeof dados.empEndereco === 'string') setEmpEndereco(dados.empEndereco);
      if (typeof dados.empTelefone === 'string') setEmpTelefone(dados.empTelefone);
      if (typeof dados.mesRef === 'string') setMesRef(dados.mesRef);
      if (typeof dados.lembreteDias === 'string') setLembreteDias(dados.lembreteDias);
      if (typeof dados.emailAlertas === 'string') setEmailAlertas(dados.emailAlertas);
      if (typeof dados.whatsappAlertas === 'string') setWhatsappAlertas(dados.whatsappAlertas);
      if (typeof dados.notifVencimento === 'boolean') setNotifVencimento(dados.notifVencimento);
      if (typeof dados.notifGuias === 'boolean') setNotifGuias(dados.notifGuias);
      if (typeof dados.perfilSelecionado === 'string') setPerfilSelecionado(dados.perfilSelecionado);
    } catch {
      setMensagemStatus('Não foi possível ler as configurações locais. Nenhuma conexão oficial foi verificada.');
    }
  }, []);

  if (!aberto) return null;

  const handleSalvar = (titulo: string) => {
    const dados = {
      certTipo, certArquivoNome, certValidade, serproCnpj, serproAmbiente,
      empRazao, empCnpj, empEndereco, empTelefone, mesRef, lembreteDias,
      emailAlertas, whatsappAlertas, notifVencimento, notifGuias, perfilSelecionado
    };
    try {
      localStorage.setItem(CONFIG_LOCAL_KEY, JSON.stringify(dados));
      setMensagemStatus(`✅ ${titulo} salvo neste navegador. Isso não ativa nem testa uma conexão oficial.`);
    } catch {
      setMensagemStatus(`Não foi possível salvar ${titulo} neste navegador.`);
    }
    setTimeout(() => setMensagemStatus(null), 3500);
  };

  const handleBaixarBackup = () => {
    // Exporta apenas preferências de interface não sensíveis deste navegador.
    // Não chamar isso de backup do banco: os registros fiscais persistentes,
    // credenciais e certificados não são lidos nem incluídos neste arquivo.
    const dadosBackup = {
      sistema: 'FISCOIA v1.0.0',
      dataExportacao: new Date().toISOString(),
      tipo: 'preferencias-locais-nao-sensiveis',
      configuracoes: {
        mesRef,
        lembreteDias,
        notifVencimento,
        notifGuias,
        serproAmbiente,
      },
    };

    const blob = new Blob([JSON.stringify(dadosBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_fiscoia_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setMensagemStatus('Preferências locais exportadas. Este arquivo não é backup do banco e não contém empresas, notas, certificados ou credenciais.');
    setTimeout(() => setMensagemStatus(null), 3500);
  };

  const itensMenu = [
    { id: 'certificado', rotulo: 'Certificado Digital', icone: Key, badge: 'A1/A3' },
    { id: 'conexao', rotulo: 'Conexão SERPRO / e-CAC', icone: RefreshCw, badge: 'RFB' },
    { id: 'empresa', rotulo: 'Dados da Empresa', icone: Building2 },
    { id: 'agenda', rotulo: 'Calendário e Prazos', icone: Calendar },
    { id: 'notificacoes', rotulo: 'Notificações e Alertas', icone: Bell },
    { id: 'usuario', rotulo: 'Usuários e Permissões', icone: Users },
    { id: 'backup', rotulo: 'Backup e Exportação', icone: Database },
    { id: 'atualizacao', rotulo: 'Atualização do Sistema', icone: ShieldCheck, badge: 'v1.0.0' },
    { id: 'ajuda', rotulo: 'Ajuda e Suporte', icone: HelpCircle },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Menu de Configurações */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 flex items-center justify-between text-white border-b border-indigo-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 font-bold">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">Configurações do Sistema</h3>
                <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                  MURADE
                </span>
              </div>
              <p className="text-xs text-indigo-200">FISCOIA v1.0.0 • Conformidade Fiscal Inteligente</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/fiscoia-v1/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white rounded-lg text-xs font-semibold transition-colors"
              title="Abrir versão standalone fiscoia-v1 em nova aba"
            >
              <span>Abrir fiscoia-v1</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              id="btn-fechar-modal-config"
              onClick={onFechar}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Fechar Configurações"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback de sucesso */}
        {mensagemStatus && (
          <div className="bg-emerald-600 text-white text-xs font-bold px-6 py-2 flex items-center gap-2 animate-in slide-in-from-top duration-150">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{mensagemStatus}</span>
          </div>
        )}

        {/* Corpo: Navegação lateral de opções + Painel de conteúdo */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Menu Lateral de Opções */}
          <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-3 overflow-y-auto space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1 block">
              Módulos Configuráveis
            </span>
            {itensMenu.map((item) => {
              const Icone = item.icone;
              const ativo = opcaoAtiva === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setOpcaoAtiva(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                    ativo 
                      ? 'bg-indigo-900 text-white shadow-xs' 
                      : 'text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icone className={`w-4 h-4 ${ativo ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span>{item.rotulo}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      ativo ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Área de Conteúdo da Opção Selecionada */}
          <div className="flex-1 p-5 sm:p-6 overflow-y-auto bg-white">
            {/* 1. CERTIFICADO DIGITAL */}
            {opcaoAtiva === 'certificado' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Key className="w-5 h-5 text-indigo-700" />
                    Referência de Certificado — conexão não configurada
                  </h4>
                  <p className="text-xs text-slate-500">
                    Esta tela registra apenas nome e validade informada neste navegador. Não autentica nem consulta órgãos federais.
                  </p>
                </div>

                {/* A referência local não autentica serviços oficiais nem emite documentos. */}
                <div className="bg-amber-50 border-l-4 border-amber-500 p-3.5 rounded-r-xl text-xs text-amber-900 font-medium">
                  O arquivo e a senha não são enviados nem validados. Para cadastrar uma referência por empresa, use a Carteira de Clientes. SERPRO, e-CAC e SEFAZ não estão conectados nesta tela.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Certificado:</label>
                    <select
                      value={certTipo}
                      onChange={(e) => setCertTipo(e.target.value as 'A1' | 'A3')}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white font-medium"
                    >
                      <option value="A1">A1 — Arquivo de Software (.pfx / .p12)</option>
                      <option value="A3">A3 — Cartão Criptográfico / Token USB</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Validade do Certificado:</label>
                    <input
                      type="text"
                      value={certValidade}
                      onChange={(e) => setCertValidade(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-slate-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Arquivo do Certificado:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".pfx,.p12"
                      id="input-cert-file-modal"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          if (!/\.p(?:fx|12)$/i.test(e.target.files[0].name)) {
                            setMensagemStatus('Selecione um arquivo .pfx ou .p12. O arquivo não será enviado ou validado.');
                            e.target.value = '';
                            return;
                          }
                          setCertArquivoNome(e.target.files[0].name);
                        }
                      }}
                      className="text-xs p-2 border border-slate-300 rounded-lg w-full bg-slate-50"
                    />
                  </div>
                  {certArquivoNome && (
                    <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
                      Nome selecionado localmente: <strong>{certArquivoNome}</strong>. O conteúdo do arquivo não foi lido nem enviado.
                    </span>
                  )}
                </div>

                <div role="note" className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
                  Não informe a senha do certificado aqui. O servidor ainda não tem cofre seguro nem rotina de autenticação.
                </div>

                <div className="pt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSalvar('Referência local do certificado')}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar referência local</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onNavegar) {
                        onNavegar('empresas');
                        onFechar();
                      }
                    }}
                    className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer border border-indigo-200"
                  >
                    <span>Ir para Carteira de Clientes 👥</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. CONEXÃO COM SERPRO / E-CAC */}
            {opcaoAtiva === 'conexao' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-indigo-700" />
                    Integração SERPRO INTEGRA & Receita Federal
                  </h4>
                  <p className="text-xs text-slate-500">
                    Área de configuração. A conexão autenticada com SERPRO/e-CAC ainda não está implementada neste ambiente.
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0"></div>
                  <div className="text-xs text-amber-950 font-medium">
                    Status do SERPRO: <strong>não conectado</strong>. Nenhum teste de API foi executado e nenhuma credencial é armazenada por esta tela.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">CNPJ Principal da Integração:</label>
                    <input
                      type="text"
                      value={serproCnpj}
                      onChange={(e) => setSerproCnpj(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ambiente de Transmissão:</label>
                    <select
                      value={serproAmbiente}
                      onChange={(e) => setSerproAmbiente(e.target.value as 'producao' | 'homologacao')}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="producao">Produção Oficial (Receita Federal)</option>
                      <option value="homologacao">Homologação / Testes (Sandbox)</option>
                    </select>
                  </div>
                </div>

                <div role="note" className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
                  Credenciais de API não são solicitadas nem armazenadas pelo navegador. Para conectar, o serviço precisa ser configurado no servidor com as credenciais e o contrato SERPRO apropriados.
                </div>

                <div className="pt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSalvar('Preferências locais SERPRO')}
                    className="px-4 py-2.5 bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Salvar preferência local</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onNavegar) {
                        onNavegar('serpro');
                        onFechar();
                      }
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Ver Painel SERPRO Completo
                  </button>
                </div>
              </div>
            )}

            {/* 3. DADOS DA EMPRESA */}
            {opcaoAtiva === 'empresa' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-700" />
                    Dados da Empresa Administradora
                  </h4>
                  <p className="text-xs text-slate-500">
                    Informações exibidas nos relatórios de conformidade e cabeçalhos de procuração.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Razão Social:</label>
                    <input
                      type="text"
                      value={empRazao}
                      onChange={(e) => setEmpRazao(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">CNPJ:</label>
                    <input
                      type="text"
                      value={empCnpj}
                      onChange={(e) => setEmpCnpj(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Telefone de Contato:</label>
                    <input
                      type="text"
                      value={empTelefone}
                      onChange={(e) => setEmpTelefone(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Endereço Completo:</label>
                    <input
                      type="text"
                      value={empEndereco}
                      onChange={(e) => setEmpEndereco(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => handleSalvar('Dados Cadastrais')}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Dados Cadastrais</span>
                  </button>
                </div>
              </div>
            )}

            {/* 4. CALENDÁRIO E PRAZOS */}
            {opcaoAtiva === 'agenda' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-700" />
                    Prazos de Entrega e Calendário Fiscal
                  </h4>
                  <p className="text-xs text-slate-500">
                    Defina a antecedência dos avisos para DCTFWeb, DARF Previdenciário e FGTS Digital.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mês de Referência Padrão:</label>
                    <input
                      type="month"
                      value={mesRef}
                      onChange={(e) => setMesRef(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Avisar com Antecedência de:</label>
                    <select
                      value={lembreteDias}
                      onChange={(e) => setLembreteDias(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="1">1 dia antes do vencimento</option>
                      <option value="3">3 dias antes do vencimento (Recomendado)</option>
                      <option value="5">5 dias antes do vencimento</option>
                      <option value="7">7 dias antes do vencimento</option>
                    </select>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1">
                  <p className="font-bold text-indigo-950">📌 Regra Oficial da Receita Federal (2026):</p>
                  <p>• <strong>DCTFWeb / DARF Previdenciário:</strong> Vencimento até o dia 20 do mês subsequente.</p>
                  <p>• <strong>FGTS Digital:</strong> Vencimento até o dia 20 do mês subsequente.</p>
                  <p>• Se o dia 20 cair em final de semana ou feriado, o prazo antecipa para o dia útil anterior.</p>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => handleSalvar('Prazos e Alertas da Agenda')}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Configuração de Prazos</span>
                  </button>
                </div>
              </div>
            )}

            {/* 5. NOTIFICAÇÕES E ALERTAS */}
            {opcaoAtiva === 'notificacoes' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-indigo-700" />
                    Canais de Notificação & Alertas
                  </h4>
                  <p className="text-xs text-slate-500">
                    Escolha por onde a diretoria e os contadores recebem relatórios e alertas de débitos.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">E-mail para Alertas:</label>
                    <input
                      type="email"
                      value={emailAlertas}
                      onChange={(e) => setEmailAlertas(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp / SMS para Urgências:</label>
                    <input
                      type="tel"
                      value={whatsappAlertas}
                      onChange={(e) => setWhatsappAlertas(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifVencimento}
                      onChange={(e) => setNotifVencimento(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Receber resumo matinal diário de guias prestes a vencer</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifGuias}
                      onChange={(e) => setNotifGuias(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Notificar via e-mail assim que uma guia DCTFWeb for homologada pelo SERPRO</span>
                  </label>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => handleSalvar('Canais de Notificação')}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Notificações</span>
                  </button>
                </div>
              </div>
            )}

            {/* 6. USUÁRIOS E PERMISSÕES */}
            {opcaoAtiva === 'usuario' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-700" />
                    Usuários e Níveis de Permissão (RBAC)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Controle o acesso do Master Murade, Contadores Responsáveis e Assistentes.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Operador Ativo:</label>
                    <input
                      type="text"
                      defaultValue={usuarioAtual?.nome || 'MURADE (Acesso Master)'}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-slate-50 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nível de Permissão:</label>
                    <select
                      value={perfilSelecionado}
                      onChange={(e) => setPerfilSelecionado(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white font-bold"
                    >
                      <option value="MASTER">👑 Master Admin (Diretoria Murade - Acesso Total)</option>
                      <option value="CONTADOR">👤 Contador Responsável (Gestão de CNPJs)</option>
                      <option value="ASSISTENTE">📋 Assistente Fiscal (Somente Leitura e Emissão)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950">
                  <p className="font-bold">🛡️ Controle de Visibilidade:</p>
                  <p>O perfil <strong>Master Murade</strong> é o único habilitado a gerenciar faturamento, tabela de preços dos planos e bloqueio de clientes inadimplentes.</p>
                </div>

                <div className="pt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSalvar('Permissões de Usuário')}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Permissões</span>
                  </button>
                </div>
              </div>
            )}

            {/* 7. BACKUP E EXPORTAÇÃO */}
            {opcaoAtiva === 'backup' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-700" />
                    Backup e Exportação de Dados
                  </h4>
                  <p className="text-xs text-slate-500">
                    Exporte preferências deste navegador. O backup do banco de dados precisa ser configurado no provedor PostgreSQL.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <p className="text-xs text-slate-700">
                    Este recurso não exporta empresas, notas, guias, usuários, certificados nem dados do PostgreSQL. Ele baixa somente preferências locais não sensíveis. A cópia de segurança do banco ainda não está configurada por esta tela.
                  </p>
                  <a
                    href="https://render.com/docs/postgresql-backups"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 underline"
                  >
                    Ver recuperação e backups no Render <ExternalLink className="h-3 w-3" />
                  </a>
                  
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleBaixarBackup}
                      className="px-4 py-2.5 bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Download className="w-4 h-4" />
                      <span>Exportar Preferências Locais (JSON)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 8. ATUALIZAÇÃO DO SISTEMA */}
            {opcaoAtiva === 'atualizacao' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Versão e Atualização do Sistema
                  </h4>
                  <p className="text-xs text-slate-500">
                    Esta tela ainda não consulta versão de webservices nem notas técnicas oficiais.
                  </p>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <strong className="text-sm text-amber-950">Versão das integrações não verificada</strong>
                  </div>
                  <p className="text-xs text-amber-900">
                    • DCTFWeb e SERPRO não estão conectados neste ambiente.<br />
                    • Emissão de NF-e/NFS-e e assinatura ICP-Brasil não estão integradas.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMensagemStatus('A verificação de atualizações não está conectada. Nenhum servidor foi consultado.');
                      setTimeout(() => setMensagemStatus(null), 4000);
                    }}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Verificar atualização (indisponível)</span>
                  </button>
                </div>
              </div>
            )}

            {/* 9. AJUDA E SUPORTE */}
            {opcaoAtiva === 'ajuda' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-indigo-700" />
                    Suporte & Central de Ajuda MURADE
                  </h4>
                  <p className="text-xs text-slate-500">
                    Atendimento especializado para contadores e suporte com certificados e e-CAC.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <strong className="text-indigo-950 font-bold block">Canal Direto MURADE</strong>
                    <p className="text-slate-600">E-mail: <strong>suporte@fiscoia.com.br</strong></p>
                    <p className="text-slate-600">WhatsApp: <strong>(11) 99888-1122</strong></p>
                    <p className="text-slate-500 text-[11px]">Horário de atendimento: Segunda a Sexta, das 8h às 18h.</p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <strong className="text-indigo-950 font-bold block">Documentação Oficial</strong>
                    <p className="text-slate-600">• Manual do e-CAC e DCTFWeb</p>
                    <p className="text-slate-600">• Instruções para Procuração Eletrônica</p>
                    <p className="text-slate-600">• Vídeo aulas de treinamento passo a passo</p>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavegar) {
                        onNavegar('videoAulas');
                        onFechar();
                      }
                    }}
                    className="px-4 py-2.5 bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Assistir Vídeo Aulas
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onNavegar) {
                        onNavegar('iaVoz');
                        onFechar();
                      }
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Tirar Dúvida com a IA Murad (Voz Natural)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Administração Master: <strong className="text-indigo-950 font-bold">MURADE</strong></span>
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
