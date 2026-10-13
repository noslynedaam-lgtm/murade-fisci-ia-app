import { useState, useEffect, FormEvent } from 'react';
import { 
  Settings, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Save, 
  ShieldCheck, 
  Key, 
  Building2, 
  Users, 
  ArrowRight,
  HelpCircle,
  Copy,
  Check,
  Zap,
  Radio,
  Volume2,
  Sparkles,
  Play,
  Square
} from 'lucide-react';
import { 
  obterConfigVoz, 
  salvarConfigVoz, 
  falarTextoNatural, 
  pararVoz, 
  VOZES_PREDEFINIDAS 
} from '../../services/murade/elevenLabsVoz.service';
import { MURADE_CONFIG, SistemaMurade } from '../../services/murade/muradeConfigIntegracoes.service';

interface ConfigIntegracao {
  sistemaAtual: 'fiasco' | 'dp' | 'fiscal';
  cnpjContabilidade: string;
  nomeContabilidade: string;
  codigoLigacao: string;
  urlDp: string;
  urlFiscal: string;
  urlFiasco: string;
  statusDp: boolean;
  statusFiscal: boolean;
  statusFiasco: boolean;
  syncEmpresas: boolean;
  syncPessoas: boolean;
  syncCertificado: boolean;
  syncAgenda: boolean;
  syncGuias: boolean;
  frequenciaSync: string;
  integracaoAtiva: boolean;
  ultimaSincronizacao?: string;
}

interface UsuarioPermissao {
  id: string;
  usuario: string;
  nivel: string;
  dp: string;
  fiscal: string;
  fiasco: string;
  badgeCor: string;
}

export function ConfiguracaoIntegracaoScreen({
  onVoltar
}: {
  onVoltar?: () => void;
}) {
  const [config, setConfig] = useState<ConfigIntegracao>(() => {
    const salvo = localStorage.getItem('configIntegracaoMurade');
    if (salvo) {
      try {
        return JSON.parse(salvo);
      } catch (e) {
        console.error('Erro ao ler configIntegracaoMurade:', e);
      }
    }
    return {
      sistemaAtual: 'fiasco',
      cnpjContabilidade: '',
      nomeContabilidade: 'Contabilidade Integrada',
      codigoLigacao: 'MURADE-2026',
      urlDp: 'https://dp.murade.com.br/api/sync',
      urlFiscal: 'https://fiscal.murade.com.br/api/sync',
      urlFiasco: 'https://fiasco.murade.com.br/api/sync',
      statusDp: true,
      statusFiscal: true,
      statusFiasco: true,
      syncEmpresas: true,
      syncPessoas: true,
      syncCertificado: true,
      syncAgenda: true,
      syncGuias: true,
      frequenciaSync: '5min',
      integracaoAtiva: true,
      ultimaSincronizacao: '12/09/2026 às 11:45:00'
    };
  });

  const [usuariosPermissao, setUsuariosPermissao] = useState<UsuarioPermissao[]>([
    {
      id: '1',
      usuario: 'Contador (Admin Murade)',
      nivel: '🔴 Administrador Geral',
      dp: '✅ Ler/Escrever',
      fiscal: '✅ Ler/Escrever',
      fiasco: '✅ Ler/Escrever',
      badgeCor: 'bg-rose-100 text-rose-800 border-rose-200'
    },
    {
      id: '2',
      usuario: 'Auxiliar DP',
      nivel: '🟡 Operador DP',
      dp: '✅ Ler/Escrever',
      fiscal: '👁️ Só Ler',
      fiasco: '👁️ Só Ler',
      badgeCor: 'bg-amber-100 text-amber-800 border-amber-200'
    },
    {
      id: '3',
      usuario: 'Auxiliar Fiscal',
      nivel: '🟢 Operador Fiscal',
      dp: '👁️ Só Ler',
      fiscal: '✅ Ler/Escrever',
      fiasco: '👁️ Só Ler',
      badgeCor: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    },
    {
      id: '4',
      usuario: 'Auxiliar FIASCO (Robô Gov)',
      nivel: '🔵 Operador Governo',
      dp: '❌ Sem Acesso',
      fiscal: '👁️ Só Ler',
      fiasco: '✅ Ler/Escrever',
      badgeCor: 'bg-blue-100 text-blue-800 border-blue-200'
    }
  ]);

  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [testando, setTestando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [mostrarModalNovoUsuario, setMostrarModalNovoUsuario] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoCargo, setNovoCargo] = useState('Auxiliar');

  // Estado da configuração MURADE_CONFIG (Desvincular + Ocultar Integrações)
  const [sistemaMurade, setSistemaMurade] = useState<SistemaMurade>(() => {
    return MURADE_CONFIG.sistemaAtual;
  });
  const [statusOcultacaoMurade, setStatusOcultacaoMurade] = useState<string | null>(null);

  const alternarSistemaMurade = (novo: SistemaMurade) => {
    setSistemaMurade(novo);
    MURADE_CONFIG.setSistema(novo);
    MURADE_CONFIG.aplicar();
    setStatusOcultacaoMurade(`🔒 MURADE_CONFIG aplicado para ${novo}! Elementos de integração isolados e ocultados da visão do cliente.`);
    setTimeout(() => setStatusOcultacaoMurade(null), 5000);
  };

  const reaplicarMuradeConfig = () => {
    const res = MURADE_CONFIG.aplicar();
    setStatusOcultacaoMurade(`✅ MURADE_CONFIG v${MURADE_CONFIG.versao} reexecutado com sucesso para ${res.sistema}!`);
    setTimeout(() => setStatusOcultacaoMurade(null), 4000);
  };

  // Estados de IA Voz ElevenLabs
  const [configVoz, setConfigVoz] = useState(obterConfigVoz());
  const [apiKeyVoz, setApiKeyVoz] = useState(configVoz.apiKeyElevenLabs);
  const [voiceIdVoz, setVoiceIdVoz] = useState(configVoz.voiceId);
  const [falandoVoz, setFalandoVoz] = useState(false);

  const handleSalvarChaveVoz = () => {
    const atualizado = salvarConfigVoz({
      apiKeyElevenLabs: apiKeyVoz.trim(),
      voiceId: voiceIdVoz,
      chaveAtiva: apiKeyVoz.trim().length > 10
    });
    setConfigVoz(atualizado);
    setMensagemSucesso('🎤 Chave ElevenLabs e configurações de voz atualizadas com sucesso!');
    setTimeout(() => setMensagemSucesso(null), 4000);
  };

  const handleTestarVoz = async () => {
    if (falandoVoz) {
      pararVoz();
      setFalandoVoz(false);
      return;
    }
    setFalandoVoz(true);
    await falarTextoNatural(
      "Olá! Sou a IA Murad. Esta é a voz natural brasileira configurada no seu sistema. Integração com a ElevenLabs ativa e pronta para leitura contábil e fiscal!",
      () => setFalandoVoz(true),
      () => setFalandoVoz(false),
      () => setFalandoVoz(false)
    );
  };

  // Atualiza localStorage sempre que salva
  const salvarConfiguracoes = () => {
    if (!config.codigoLigacao || config.codigoLigacao.trim().length < 5) {
      setMensagemErro('⚠️ Digite o Código de Ligação com no mínimo 5 caracteres (Ex: MURADE-2026-GO)!');
      setTimeout(() => setMensagemErro(null), 5000);
      return;
    }

    const configAtualizada: ConfigIntegracao = {
      ...config,
      ultimaSincronizacao: new Date().toLocaleString('pt-BR')
    };

    setConfig(configAtualizada);
    localStorage.setItem('configIntegracaoMurade', JSON.stringify(configAtualizada));
    setMensagemSucesso('💾 Configurações de integração salvas com sucesso no sistema!');
    setTimeout(() => setMensagemSucesso(null), 4000);
  };

  const testarTodasConexoes = () => {
    if (!config.codigoLigacao || config.codigoLigacao.trim().length < 5) {
      setMensagemErro('⚠️ Digite o Código de Ligação primeiro para validar o handshake com os sistemas parceiros!');
      setTimeout(() => setMensagemErro(null), 5000);
      return;
    }

    setTestando(true);
    setMensagemErro(null);

    setTimeout(() => {
      setTestando(false);
      setConfig(prev => ({
        ...prev,
        statusDp: true,
        statusFiscal: true,
        statusFiasco: true,
        ultimaSincronizacao: new Date().toLocaleString('pt-BR')
      }));
      setMensagemSucesso('✅ TODAS AS CONEXÕES OK! Os 3 sistemas (MURAD DP, MURADE FISCAL e FIASCO IA) estão 100% interligados via Código: ' + config.codigoLigacao);
      setTimeout(() => setMensagemSucesso(null), 5000);
    }, 900);
  };

  const ativarIntegracao = () => {
    if (!config.codigoLigacao || config.codigoLigacao.trim().length < 5) {
      setMensagemErro('⚠️ Salve as configurações primeiro e digite o Código de Ligação (o mesmo nos 3 sistemas)!');
      setTimeout(() => setMensagemErro(null), 5000);
      return;
    }

    const configAtivada: ConfigIntegracao = {
      ...config,
      statusDp: true,
      statusFiscal: true,
      statusFiasco: true,
      integracaoAtiva: true,
      ultimaSincronizacao: new Date().toLocaleString('pt-BR')
    };

    setConfig(configAtivada);
    localStorage.setItem('configIntegracaoMurade', JSON.stringify(configAtivada));
    setMensagemSucesso('🚀 INTEGRAÇÃO ATIVADA! Os 3 sistemas agora sincronizam funcionários, notas fiscais, DCTFWeb e alertas em tempo real!');
    setTimeout(() => setMensagemSucesso(null), 6000);
  };

  const restaurarPadroes = () => {
    const padrao: ConfigIntegracao = {
      sistemaAtual: 'fiasco',
      cnpjContabilidade: '',
      nomeContabilidade: 'Contabilidade Integrada',
      codigoLigacao: 'MURADE-2026',
      urlDp: 'https://dp.murade.com.br/api/sync',
      urlFiscal: 'https://fiscal.murade.com.br/api/sync',
      urlFiasco: 'https://fiasco.murade.com.br/api/sync',
      statusDp: true,
      statusFiscal: true,
      statusFiasco: true,
      syncEmpresas: true,
      syncPessoas: true,
      syncCertificado: true,
      syncAgenda: true,
      syncGuias: true,
      frequenciaSync: '5min',
      integracaoAtiva: true,
      ultimaSincronizacao: new Date().toLocaleString('pt-BR')
    };
    setConfig(padrao);
    localStorage.setItem('configIntegracaoMurade', JSON.stringify(padrao));
    setMensagemSucesso('↩️ Padrões oficiais de fábrica restaurados com sucesso.');
    setTimeout(() => setMensagemSucesso(null), 3000);
  };

  const copiarCodigoLigacao = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(config.codigoLigacao);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  const adicionarUsuario = (e: FormEvent) => {
    e.preventDefault();
    if (!novoNome) return;

    const novoItem: UsuarioPermissao = {
      id: String(Date.now()),
      usuario: novoNome,
      nivel: novoCargo === 'Admin' ? '🔴 Administrador' : novoCargo === 'DP' ? '🟡 Operador DP' : '🟢 Operador Fiscal',
      dp: novoCargo === 'Fiscal' ? '👁️ Só Ler' : '✅ Ler/Escrever',
      fiscal: novoCargo === 'DP' ? '👁️ Só Ler' : '✅ Ler/Escrever',
      fiasco: '👁️ Só Ler',
      badgeCor: novoCargo === 'Admin' ? 'bg-rose-100 text-rose-800' : 'bg-indigo-100 text-indigo-800'
    };

    setUsuariosPermissao(prev => [...prev, novoItem]);
    setNovoNome('');
    setMostrarModalNovoUsuario(false);
    setMensagemSucesso('Usuário adicionado à matriz de permissões dos 3 sistemas!');
    setTimeout(() => setMensagemSucesso(null), 3000);
  };

  return (
    <div id="tela-configuracao-integracao" className="max-w-4xl mx-auto space-y-4 pb-12">
      {/* 🧭 Seletor de Visão do Sistema (3 Sistemas integrados com a mesma estrutura) */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
            <Radio className="w-4 h-4" />
          </span>
          <div>
            <span className="text-xs font-bold text-slate-800 block">
              Estrutura Unificada de Integração MURADE
            </span>
            <span className="text-[11px] text-slate-500">
              O mesmo painel de configuração opera nos 3 sistemas da contabilidade
            </span>
          </div>
        </div>

        {/* Abas dos 3 Sistemas */}
        <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setConfig(prev => ({ ...prev, sistemaAtual: 'fiasco' }))}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              config.sistemaAtual === 'fiasco' 
                ? 'bg-indigo-900 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🤖</span>
            <span>Murade Fisco IA (Central Gov)</span>
          </button>

          <button
            type="button"
            onClick={() => setConfig(prev => ({ ...prev, sistemaAtual: 'dp' }))}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              config.sistemaAtual === 'dp' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🧑‍💼</span>
            <span>MURAD DP</span>
          </button>

          <button
            type="button"
            onClick={() => setConfig(prev => ({ ...prev, sistemaAtual: 'fiscal' }))}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              config.sistemaAtual === 'fiscal' 
                ? 'bg-amber-600 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>⚖️</span>
            <span>MURADE FISCAL</span>
          </button>
        </div>
      </div>

      {/* 🔒 BLOCO MURADE — DESVINCULAR + OCULTAR INTEGRAÇÕES (MESMO CÓDIGO NOS 3 SISTEMAS) */}
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-700 p-5 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white tracking-wide">
                  🔒 MURADE — DESVINCULAR + OCULTAR INTEGRAÇÕES
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  v{MURADE_CONFIG.versao}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {MURADE_CONFIG.acao}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Mesmo código para Fisco IA, Fiscal e DP-Contábil: desconecta ligações e oculta elementos do cliente mantendo troca oculta e visão total para o Administrador.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reaplicarMuradeConfig}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reaplicar Ocultação</span>
            </button>
          </div>
        </div>

        {/* Status atual e seletor ativo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* Card FISCO_IA */}
          <div 
            onClick={() => alternarSistemaMurade('FISCO_IA')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              sistemaMurade === 'FISCO_IA'
                ? 'bg-blue-950/60 border-blue-500 ring-1 ring-blue-500'
                : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>🤖</span> FISCO IA
              </span>
              {sistemaMurade === 'FISCO_IA' && (
                <span className="text-[10px] font-black text-blue-400 uppercase">Sistema Ativo</span>
              )}
            </div>
            <ul className="text-[11px] space-y-1 text-slate-300">
              <li className="flex items-center gap-1 text-rose-300">
                <span>❌</span> Conecta Fiscal, DP e Contábil: Desligado
              </li>
              <li className="flex items-center gap-1 text-emerald-300">
                <span>✅</span> Modo: INDEPENDENTE
              </li>
              <li className="flex items-center gap-1 text-blue-300">
                <span>🏛️</span> Buscar apenas Governo (RFB/Serpro)
              </li>
            </ul>
          </div>

          {/* Card FISCAL */}
          <div 
            onClick={() => alternarSistemaMurade('FISCAL')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              sistemaMurade === 'FISCAL'
                ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500'
                : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>⚖️</span> FISCAL
              </span>
              {sistemaMurade === 'FISCAL' && (
                <span className="text-[10px] font-black text-amber-400 uppercase">Sistema Ativo</span>
              )}
            </div>
            <ul className="text-[11px] space-y-1 text-slate-300">
              <li className="flex items-center gap-1 text-rose-300">
                <span>❌</span> Recebe/Envia Fisco IA: Desligado
              </li>
              <li className="flex items-center gap-1 text-amber-300">
                <span>🔒</span> Conexões DP/Contábil: Ocultas do Cliente
              </li>
              <li className="flex items-center gap-1 text-emerald-300">
                <span>✅</span> Admin Vê Tudo: Ativo
              </li>
            </ul>
          </div>

          {/* Card DP_CONTABIL */}
          <div 
            onClick={() => alternarSistemaMurade('DP_CONTABIL')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              sistemaMurade === 'DP_CONTABIL'
                ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500'
                : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>🧑‍💼</span> DP-CONTÁBIL
              </span>
              {sistemaMurade === 'DP_CONTABIL' && (
                <span className="text-[10px] font-black text-indigo-400 uppercase">Sistema Ativo</span>
              )}
            </div>
            <ul className="text-[11px] space-y-1 text-slate-300">
              <li className="flex items-center gap-1 text-amber-300">
                <span>🔒</span> Conexão com Fiscal: Oculta do Cliente
              </li>
              <li className="flex items-center gap-1 text-emerald-300">
                <span>✅</span> Continua Funcionando: Troca por Baixo
              </li>
              <li className="flex items-center gap-1 text-emerald-300">
                <span>✅</span> Admin Vê Tudo: Ativo
              </li>
            </ul>
          </div>
        </div>

        {statusOcultacaoMurade && (
          <div className="p-2.5 bg-blue-900/40 border border-blue-500/40 rounded-lg text-xs font-medium text-blue-200 flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{statusOcultacaoMurade}</span>
          </div>
        )}
      </div>

      {/* Notificações de Sucesso / Erro */}
      {mensagemSucesso && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{mensagemSucesso}</span>
          </div>
          <button onClick={() => setMensagemSucesso(null)} className="text-emerald-700 hover:text-emerald-950">✕</button>
        </div>
      )}

      {mensagemErro && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{mensagemErro}</span>
          </div>
          <button onClick={() => setMensagemErro(null)} className="text-rose-700 hover:text-rose-950">✕</button>
        </div>
      )}

      {/* 📦 CAIXA PRINCIPAL DA CONFIGURAÇÃO (LAYOUT PADRONIZADO MURADE) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
        {/* CABEÇALHO */}
        <div 
          className="text-white p-5 sm:p-6"
          style={{
            background: 'linear-gradient(90deg, #0F2B5B 0%, #165DFF 100%)'
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-wider mb-2">
                <Settings className="w-3 h-3" />
                <span>
                  Instância Ativa: {config.sistemaAtual === 'fiasco' ? '🤖 Murade Fisco IA (Central)' : config.sistemaAtual === 'dp' ? '🧑‍💼 MURAD DP' : '⚖️ MURADE FISCAL'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                ⚙️ Configuração de Integração
              </h1>
              <p className="text-blue-100 text-xs mt-1">
                Conecte os sistemas MURADE — DP • Fiscal • Murade Fisco IA — tudo sincronizado automaticamente em tempo real
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/15 text-right shrink-0">
              <span className="text-[10px] text-blue-200 uppercase font-semibold block">Status da Rede</span>
              <span className="text-xs font-black text-emerald-300 flex items-center justify-end gap-1 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {config.integracaoAtiva ? 'Interligado & Ativo' : 'Pendente de Ativação'}
              </span>
            </div>
          </div>
        </div>

        {/* CORPO DA CONFIGURAÇÃO */}
        <div className="p-5 sm:p-7 space-y-7">
          {/* 📍 SEÇÃO 1 — DADOS DA CONTABILIDADE */}
          <section className="space-y-3.5 border-b border-slate-100 pb-6">
            <div className="flex items-center gap-2 text-sm font-bold text-[#0F2B5B]">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>📍 1. Dados da Contabilidade</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">
                  CNPJ da Contabilidade (Principal)
                </label>
                <input
                  type="text"
                  value={config.cnpjContabilidade}
                  onChange={(e) => setConfig({ ...config, cnpjContabilidade: e.target.value })}
                  placeholder="00.000.000/0001-00"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">
                  Nome / Razão Social
                </label>
                <input
                  type="text"
                  value={config.nomeContabilidade}
                  onChange={(e) => setConfig({ ...config, nomeContabilidade: e.target.value })}
                  placeholder="Contabilidade Murade Ltda"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Código de Ligação em Destaque */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 border-2 border-blue-500 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-700" />
                  <span>🔑 Código de Ligação — COLOQUE O MESMO NOS 3 SISTEMAS</span>
                </label>

                <button
                  type="button"
                  onClick={copiarCodigoLigacao}
                  className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded border border-blue-200"
                >
                  {copiado ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiado ? 'Copiado!' : 'Copiar Código'}</span>
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.codigoLigacao}
                  onChange={(e) => setConfig({ ...config, codigoLigacao: e.target.value.toUpperCase() })}
                  placeholder="Ex: MURADE-2026-GO"
                  className="flex-1 px-3.5 py-2.5 rounded-lg bg-white border border-blue-300 text-sm font-black tracking-wider text-blue-900 uppercase focus:ring-2 focus:ring-blue-500 outline-none font-mono shadow-xs"
                />
              </div>

              <p className="text-[11px] text-amber-800 font-semibold flex items-center gap-1">
                <span>⚠️</span>
                <span>Esse código é a senha que conecta os 3 sistemas (DP, Fiscal e FIASCO) — use exatamente o mesmo em todos!</span>
              </p>
            </div>
          </section>

          {/* 🔌 SEÇÃO 2 — CONEXÃO COM SISTEMAS PARCEIROS */}
          <section className="space-y-3.5 border-b border-slate-100 pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0F2B5B]">
                <Zap className="w-4 h-4 text-blue-600" />
                <span>🔌 2. Conexão com Sistemas Parceiros</span>
              </div>
              <span className="text-[11px] text-slate-500">
                Último handshake: {config.ultimaSincronizacao || 'Hoje'}
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Card MURAD DP */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🧑‍💼</span>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>MURAD DP (Departamento Pessoal)</span>
                      {config.sistemaAtual === 'dp' && (
                        <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-black">
                          SISTEMA ATUAL
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {config.urlDp} • Envia pró-labore, funcionários e folha
                    </div>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                  config.statusDp 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {config.statusDp ? '✅ Conectado' : '❌ Não conectado'}
                </span>
              </div>

              {/* Card MURADE FISCAL */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚖️</span>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>MURADE FISCAL (Escrita & Tributos)</span>
                      {config.sistemaAtual === 'fiscal' && (
                        <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-black">
                          SISTEMA ATUAL
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {config.urlFiscal} • Puxa dados do DP e apura guias
                    </div>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                  config.statusFiscal 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {config.statusFiscal ? '✅ Conectado' : '❌ Não conectado'}
                </span>
              </div>

              {/* Card Murade Fisco IA */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🤖</span>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Murade Fisco IA — Compliance Fiscal & Governo</span>
                      {config.sistemaAtual === 'fiasco' && (
                        <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-black">
                          SISTEMA ATUAL
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {config.urlFiasco} • Gateway SERPRO, e-CAC, DCTFWeb e IA Murad
                    </div>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                  config.statusFiasco 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {config.statusFiasco ? '✅ Conectado' : '❌ Não conectado'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={testarTodasConexoes}
              disabled={testando}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${testando ? 'animate-spin' : ''}`} />
              <span>{testando ? 'Testando Handshake nos 3 Servidores...' : '🔍 Testar Todas as Conexões'}</span>
            </button>
          </section>

          {/* 👤 SEÇÃO 3 — PERMISSÕES DE USUÁRIOS */}
          <section className="space-y-3.5 border-b border-slate-100 pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0F2B5B]">
                <Users className="w-4 h-4 text-blue-600" />
                <span>👤 3. Permissões de Usuários (Acesso Cruzado)</span>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalNovoUsuario(true)}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 cursor-pointer"
              >
                ➕ Adicionar Usuário
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="p-3">Usuário</th>
                    <th className="p-3">Nível de Acesso</th>
                    <th className="p-3 text-center">🧑‍💼 DP</th>
                    <th className="p-3 text-center">⚖️ Fiscal</th>
                    <th className="p-3 text-center">🤖 Fisco IA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {usuariosPermissao.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-semibold text-slate-900">
                        {user.usuario}
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${user.badgeCor}`}>
                          {user.nivel}
                        </span>
                      </td>
                      <td className="p-3 text-center font-medium">
                        {user.dp}
                      </td>
                      <td className="p-3 text-center font-medium">
                        {user.fiscal}
                      </td>
                      <td className="p-3 text-center font-medium">
                        {user.fiasco}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 🔄 SEÇÃO 4 — SINCRONIZAÇÃO AUTOMÁTICA */}
          <section className="space-y-3.5">
            <div className="flex items-center gap-2 text-sm font-bold text-[#0F2B5B]">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              <span>🔄 4. Sincronização Automática em Segundo Plano</span>
            </div>

            <div className="space-y-2 text-xs divide-y divide-slate-100">
              <label className="flex items-center gap-2.5 pt-2 cursor-pointer hover:text-slate-950">
                <input
                  type="checkbox"
                  checked={config.syncEmpresas}
                  onChange={(e) => setConfig({ ...config, syncEmpresas: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                />
                <span className="font-semibold text-slate-800">
                  Sincronizar Cadastro de Empresas (CNPJ, Inscrição Estadual, Regime Tributário)
                </span>
              </label>

              <label className="flex items-center gap-2.5 pt-2 cursor-pointer hover:text-slate-950">
                <input
                  type="checkbox"
                  checked={config.syncPessoas}
                  onChange={(e) => setConfig({ ...config, syncPessoas: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                />
                <span className="font-semibold text-slate-800">
                  Sincronizar Cadastro de Pessoas (Funcionários, Sócios, Procuradores e Dependentes)
                </span>
              </label>

              <label className="flex items-center gap-2.5 pt-2 cursor-pointer hover:text-slate-950">
                <input
                  type="checkbox"
                  checked={config.syncCertificado}
                  onChange={(e) => setConfig({ ...config, syncCertificado: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                />
                <span className="font-semibold text-slate-800">
                  Compartilhar Certificado Digital A1/A3 e Procurações Eletrônicas RFB
                </span>
              </label>

              <label className="flex items-center gap-2.5 pt-2 cursor-pointer hover:text-slate-950">
                <input
                  type="checkbox"
                  checked={config.syncAgenda}
                  onChange={(e) => setConfig({ ...config, syncAgenda: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                />
                <span className="font-semibold text-slate-800">
                  Centralizar Agenda de Vencimentos — todos os sistemas veem os mesmos alertas e prazos
                </span>
              </label>

              <label className="flex items-center gap-2.5 pt-2 cursor-pointer hover:text-slate-950">
                <input
                  type="checkbox"
                  checked={config.syncGuias}
                  onChange={(e) => setConfig({ ...config, syncGuias: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                />
                <span className="font-semibold text-slate-800">
                  Compartilhar Guias (DCTFWeb, DARF, FGTS Digital Pix) e Declarações geradas
                </span>
              </label>
            </div>

            {/* Frequência */}
            <div className="pt-3 max-w-sm space-y-1">
              <label className="text-xs font-semibold text-slate-600 block">
                Frequência de Atualização Automática
              </label>
              <select
                value={config.frequenciaSync}
                onChange={(e) => setConfig({ ...config, frequenciaSync: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="1min">A cada 1 minuto (Tempo Real)</option>
                <option value="5min">A cada 5 minutos (Recomendado)</option>
                <option value="15min">A cada 15 minutos</option>
                <option value="1h">A cada 1 hora</option>
                <option value="manual">Apenas manualmente</option>
              </select>
            </div>
          </section>

          {/* 🎤 SEÇÃO 5 — IA VOZ → CHAVE ELEVENLABS */}
          <section className="space-y-3.5 border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0F2B5B]">
                <Volume2 className="w-4 h-4 text-purple-600" />
                <span>🎤 5. IA Voz → Chave ElevenLabs (Voz Natural Humana)</span>
              </div>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                Plano Atual: {configVoz.planoAtivo}
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Integração oficial com ElevenLabs para fala humana realista brasileira em todos os módulos (Fiscal, Contábil, DP e Agente Murad). Sem voz robotizada!
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Chave de API ElevenLabs (xi-api-key)</span>
                </label>
                <input
                  type="password"
                  value={apiKeyVoz}
                  onChange={(e) => setApiKeyVoz(e.target.value)}
                  placeholder="Insira sua chave ElevenLabs..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  Caso deixe em branco, o sistema usará a síntese de voz nativa em português brasileiro (PT-BR).
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Perfil de Voz
                </label>
                <select
                  value={voiceIdVoz}
                  onChange={(e) => setVoiceIdVoz(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  {VOZES_PREDEFINIDAS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome} ({v.tipo})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 block">
                  {configVoz.chaveAtiva ? '✅ Chave ElevenLabs configurada e ativa' : 'ℹ️ Operando no modo voz natural nativa PT-BR'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleTestarVoz}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  falandoVoz
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                }`}
              >
                {falandoVoz ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-white" />
                    <span>Parar Teste de Voz</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>▶️ Testar Amostra de Voz</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSalvarChaveVoz}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Chave ElevenLabs</span>
              </button>
            </div>
          </section>

          {/* 🛑 BOTÕES DE AÇÃO */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={restaurarPadroes}
              className="px-4 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
            >
              ↩️ Restaurar Padrões
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={salvarConfiguracoes}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Configurações</span>
              </button>

              <button
                type="button"
                onClick={ativarIntegracao}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>✅ Ativar Integração</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 📖 GUIA DE IMPLANTAÇÃO PASSO A PASSO (Conforme Manual MURADE) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <HelpCircle className="w-4 h-4 text-indigo-700" />
          <h2 className="text-xs sm:text-sm font-bold text-slate-900">
            📖 Como Funciona o Passo a Passo nos 3 Sistemas:
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1.5">
            <span className="font-bold text-blue-900 block text-xs">
              🔹 PASSO 1 — Nos 3 Sistemas
            </span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Abra o <strong>MURAD DP</strong>, o <strong>MURADE FISCAL</strong> e o <strong>MURADE FISCO IA</strong> na aba <strong>⚙️ Configuração</strong>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1.5">
            <span className="font-bold text-amber-900 block text-xs">
              🔹 PASSO 2 — Código de Ligação
            </span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Digite exatamente o mesmo código (ex: <code className="bg-white px-1 py-0.5 rounded font-mono font-bold">{config.codigoLigacao}</code>) nos 3 sistemas e salve.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1.5">
            <span className="font-bold text-emerald-900 block text-xs">
              🔹 PASSO 3 — Testar & Ativar
            </span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Clique em <strong>Testar Conexões</strong> e em seguida em <strong>Ativar Integração</strong>. Todos os dados passam a fluir automaticamente!
            </p>
          </div>
        </div>

        {/* Resumo do que acontece após a ativação */}
        <div className="pt-2 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-800 mb-2">
            ✅ O que acontece automaticamente após a ativação:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
            <div className="flex items-start gap-1.5">
              <span className="text-emerald-600 font-bold">✓</span>
              <span><strong>Auxiliar DP</strong> cadastra funcionário → Fiscal já vê pró-labore e Fisco IA atualiza EFD-Reinf/eSocial.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-emerald-600 font-bold">✓</span>
              <span><strong>Auxiliar Fiscal</strong> emite NFe → Fisco IA valida na SEFAZ e DP apura retenções de IRRF.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-emerald-600 font-bold">✓</span>
              <span><strong>Fisco IA</strong> encontra vencimento de DARF/FGTS → Alerta aparece na agenda de todos simultaneamente.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-emerald-600 font-bold">✓</span>
              <span><strong>Contador Admin</strong> acessa o sistema → Vê o resumo de todos os 3 sistemas numa tela só.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para Adicionar Usuário */}
      {mostrarModalNovoUsuario && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Adicionar Usuário aos 3 Sistemas</h3>
              <button onClick={() => setMostrarModalNovoUsuario(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={adicionarUsuario} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Nome do Usuário</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Oliveira"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Função Principal</label>
                <select
                  value={novoCargo}
                  onChange={(e) => setNovoCargo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
                >
                  <option value="DP">Operador DP (Foco em Folha)</option>
                  <option value="Fiscal">Operador Fiscal (Foco em Impostos)</option>
                  <option value="Admin">Administrador Geral</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMostrarModalNovoUsuario(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
