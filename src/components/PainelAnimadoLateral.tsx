import { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Cpu, 
  ChevronRight, 
  ChevronUp, 
  ChevronDown, 
  Key, 
  Activity, 
  Zap, 
  ExternalLink,
  Minimize2,
  Maximize2,
  Minus,
  Calculator,
  X,
  FileText,
  Upload,
  AlertTriangle,
  Trash2
} from 'lucide-react';

interface PainelAnimadoLateralProps {
  onAbrirAutomacao?: () => void;
  onAbrirCalculadora?: () => void;
  visivel?: boolean;
}

interface ItemLog {
  id: string;
  tipo: 'sucesso' | 'aviso' | 'erro' | 'info' | 'calculo';
  hora: string;
  msg: string;
  detalhe?: string;
  cor?: string;
  icone?: string;
}

export function PainelAnimadoLateral({
  onAbrirAutomacao,
  onAbrirCalculadora,
  visivel = true
}: PainelAnimadoLateralProps) {
  // Controle de exibição: subida suave ao abrir, fechamento e minimização
  const [subiuDevagar, setSubiuDevagar] = useState(false);
  const [fechado, setFechado] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  
  // Modo de tamanho: 'pequeno' (padrão compacto que sobe pequeno e devagar) ou 'expandido' (tela completa com abas)
  const [modoTamanho, setModoTamanho] = useState<'pequeno' | 'expandido'>('pequeno');
  
  // Aba ativa: 'robo' | 'cert' | 'monitor' | 'dadosReais'
  const [abaAtiva, setAbaAtiva] = useState<'robo' | 'cert' | 'monitor' | 'dadosReais'>('robo');

  // Dados do Robô & Agente
  const [pacoteCiclo, setPacoteCiclo] = useState(0);

  // Dados do Certificado Digital
  const [nomeArquivoCert, setNomeArquivoCert] = useState('');
  const [statusMensagemCert, setStatusMensagemCert] = useState<{
    tipo: 'aviso';
    texto: string;
  } | null>(null);

  // Logs em tempo real do Monitor
  const [logs, setLogs] = useState<ItemLog[]>([
    {
      id: 'init-1',
      tipo: 'info',
      hora: new Date().toLocaleTimeString('pt-BR'),
      msg: 'Painel local Murade aberto',
      detalhe: 'Nenhuma tarefa oficial foi iniciada por este painel.',
      cor: '#2563eb',
      icone: '🤖'
    },
    {
      id: 'init-2',
      tipo: 'info',
      hora: new Date().toLocaleTimeString('pt-BR'),
      msg: 'Integração oficial pendente',
      detalhe: 'SERPRO, RFB e SEFAZ não estão conectados neste painel.',
      cor: '#d97706',
      icone: '⚠️'
    }
  ]);

  const logRef = useRef<HTMLDivElement>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  // Efeito 1: Subida suave, lenta e gradual ("subir devagarzinho, suba pequena")
  useEffect(() => {
    const timerSubida = setTimeout(() => {
      setSubiuDevagar(true);
    }, 600);

    return () => clearTimeout(timerSubida);
  }, []);

  // Efeito visual decorativo; não representa tráfego nem conexão com órgãos.
  useEffect(() => {
    const intervaloCiclo = setInterval(() => {
      setPacoteCiclo(prev => (prev + 1) % 100);
    }, 2000);

    return () => clearInterval(intervaloCiclo);
  }, []);

  // Efeito 4: Auto-scroll do terminal de logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, abaAtiva]);

  // Efeito 5: Ouvintes globais para abertura sincronizada por aba
  useEffect(() => {
    const handleAbrir = (e: any) => {
      const aba = e?.detail?.aba || 'robo';
      setFechado(false);
      setMinimizado(false);
      setAbaAtiva(aba);
      if (aba === 'cert' || aba === 'monitor') {
        setModoTamanho('expandido');
      }
    };

    const handleNovoLog = (e: any) => {
      if (e?.detail) {
        setLogs(prev => [...prev.slice(-60), e.detail]);
      }
    };

    window.addEventListener('abrir_painel_unificado', handleAbrir);
    window.addEventListener('murade_novo_log', handleNovoLog);

    // Registra proxies no window para máxima compatibilidade com menus e barras
    (window as any).ABRIR_PAINEL_MURADE = () => {
      setFechado(false);
      setMinimizado(false);
      setModoTamanho('expandido');
      setAbaAtiva('monitor');
    };
    (window as any).ABRIR_CERTIFICADO_MURADE = () => {
      // O envio real do certificado A1 fica no botão da barra superior (Navbar); este painel era só informativo.
      window.dispatchEvent(new Event('murade_abrir_certificado'));
    };
    (window as any).ABRIR_ROBO_MURADE = () => {
      setFechado(false);
      setMinimizado(false);
      setAbaAtiva('robo');
    };

    return () => {
      window.removeEventListener('abrir_painel_unificado', handleAbrir);
      window.removeEventListener('murade_novo_log', handleNovoLog);
    };
  }, []);

  // Este painel não valida PKCS#12 nem estabelece conexão mTLS.
  const handleSalvarCertificado = () => {
    setNomeArquivoCert('');
    if (inputArquivoRef.current) inputArquivoRef.current.value = '';
    setStatusMensagemCert({
      tipo: 'aviso',
      texto: 'Validação e conexão mTLS não estão implementadas neste painel. Nenhum certificado foi enviado, salvo ou validado.'
    });
  };

  const handleLimparLogs = () => {
    setLogs([
      {
        id: 'limpo-' + Date.now(),
        tipo: 'info',
        hora: new Date().toLocaleTimeString('pt-BR'),
        msg: 'Logs limpos pelo operador',
        detalhe: 'Aguardando novas transmissões do Robô e Agente...',
        cor: '#64748b',
        icone: '🧹'
      }
    ]);
  };

  if (!visivel) return null;

  return (
    <>
      {/* Elementos proxy invisíveis no DOM para compatibilidade de busca de nós */}
      <div id="painel-murade" style={{ display: 'none' }} />
      <div id="cert-murade" style={{ display: 'none' }} />

      {/* CASO 1: TOTALMENTE FECHADO — Mostra botão discreto para reabrir no canto inferior direito */}
      {fechado ? (
        <button
          type="button"
          id="btn-reabrir-central-murade"
          onClick={() => {
            setFechado(false);
            setMinimizado(false);
          }}
          title="Abrir Central Murade (Robô, Certificado & Monitor)"
          className="fixed bottom-4 right-4 z-50 bg-white/95 hover:bg-white text-slate-800 hover:text-blue-700 px-3.5 py-2 rounded-2xl shadow-xl hover:shadow-2xl border-2 border-blue-500/80 flex items-center gap-2 cursor-pointer transition-all hover:scale-105 group backdrop-blur-xs text-xs font-bold"
        >
          <div className="relative">
            <span className="text-lg">🤖</span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-[10px] text-blue-600 font-extrabold uppercase tracking-wide">Murade Central</div>
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <span>Abrir Robô & Certificado</span>
              <ChevronUp className="w-3.5 h-3.5 text-blue-500 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        </button>
      ) : minimizado ? (
        /* CASO 2: MINIMIZADO — Cápsula elegante e compacta no canto inferior direito */
        <div
          id="capsula-central-murade-minimizada"
          className="fixed bottom-4 right-4 z-50 bg-gradient-to-r from-[#0F2B5B] via-[#165DFF] to-[#722ED1] text-white p-2.5 px-3.5 rounded-2xl shadow-2xl border-2 border-white/80 flex items-center gap-3 backdrop-blur-md transition-all duration-300"
        >
          <button
            type="button"
            onClick={() => setMinimizado(false)}
            className="flex items-center gap-2.5 text-left cursor-pointer hover:opacity-90"
            title="Expandir Central Murade"
          >
            <div className="relative">
              <span className="text-xl inline-block">🤖</span>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0F2B5B] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-blue-200">
                <span>Murade Central</span>
                <span className="bg-emerald-500 text-slate-900 text-[8px] font-black px-1 py-0.2 rounded-full">2026</span>
              </div>
              <div className="text-xs font-bold flex items-center gap-2">
                <span>Notas oficiais: não consultadas</span>
                <span className="text-white/40">|</span>
                <span className="text-[11px] font-medium text-amber-300">
                  🔑 Certificado não validado
                </span>
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1 border-l border-white/20 pl-2">
            <button
              type="button"
              onClick={() => setMinimizado(false)}
              title="Expandir painel"
              className="p-1 rounded-lg hover:bg-white/20 text-blue-100 hover:text-white transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setFechado(true)}
              title="Fechar painel"
              className="p-1 rounded-lg hover:bg-red-500/80 text-blue-100 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* CASO 3: ABERTO — Pequenininho só nessa lateralzinha, sem subir alto nem ficar grande */
        <aside
          id="painel-unificado-murade"
          className={`fixed bottom-2 right-2 z-50 overflow-hidden transition-all duration-300 ease-out transform ${
            modoTamanho === 'pequeno'
              ? 'w-auto max-w-[230px] bg-gradient-to-r from-[#0F2B5B] via-[#165DFF] to-[#722ED1] text-white rounded-xl shadow-md border border-white/30'
              : 'w-[290px] sm:w-[310px] max-h-[350px] bg-white rounded-xl border-2 border-blue-500 shadow-xl flex flex-col'
          } ${
            subiuDevagar 
              ? 'translate-y-0 opacity-100 scale-100' 
              : 'translate-y-1 opacity-0 scale-95 pointer-events-none'
          }`}
          style={{
            boxShadow: modoTamanho === 'pequeno'
              ? '0 4px 12px -2px rgba(22, 93, 255, 0.35), 0 2px 6px rgba(0,0,0,0.1)'
              : '0 8px 24px -4px rgba(22, 93, 255, 0.3), 0 4px 12px rgba(0,0,0,0.1)'
          }}
        >
          {modoTamanho === 'pequeno' ? (
            /* CASO MODO PEQUENO: Pequenininho só nessa lateralzinha (baixo, ultra-compacto e elegante) */
            <div className="flex items-center gap-1.5 px-2 py-1 select-none">
              {/* Robô com pulso verde */}
              <div className="relative flex items-center justify-center shrink-0">
                <span className="text-base inline-block leading-none">🤖</span>
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full border border-[#0F2B5B] animate-pulse" />
              </div>

              {/* Informações compactas */}
              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1 leading-tight">
                  <span className="text-[10px] font-black tracking-wide text-white">Robô Murade</span>
                    <span className="text-[7px] font-bold bg-amber-300 text-slate-950 px-1 py-0.2 rounded-full uppercase">
                    Local
                  </span>
                </div>
                <div className="text-[9px] text-blue-100 flex items-center gap-1 mt-0.5 leading-none">
                  <span className="font-extrabold text-amber-300">Sem consulta oficial</span>
                  <span className="text-white/40">•</span>
                  <span className="text-blue-200">Cert. pendente</span>
                </div>
              </div>

              {/* Controles discretos */}
              <div className="flex items-center gap-0.5 border-l border-white/20 pl-1 ml-auto shrink-0">
                <button
                  type="button"
                  id="btn-expandir-painel-murade"
                  onClick={() => setModoTamanho('expandido')}
                  title="Expandir tela (ver certificados e monitor)"
                  className="p-0.5 rounded hover:bg-white/20 text-blue-100 hover:text-white transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  id="btn-minimizar-painel-murade"
                  onClick={() => setMinimizado(true)}
                  title="Minimizar"
                  className="p-0.5 rounded hover:bg-white/20 text-blue-100 hover:text-white transition-colors cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  id="btn-desligar-fechar-murade"
                  onClick={() => setFechado(true)}
                  title="Fechar (X)"
                  className="p-0.5 rounded hover:bg-red-500/80 text-blue-100 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            /* CASO MODO EXPANDIDO: Tela completa com cabeçalho, abas, certificado digital e monitor */
            <>
              {/* CABEÇALHO PRINCIPAL DO PAINEL EXPANDIDO */}
              <div className="p-2.5 px-3 bg-gradient-to-r from-[#0F2B5B] via-[#165DFF] to-[#722ED1] text-white flex items-center justify-between select-none">
                <div className="flex items-center gap-2">
                  <span className="text-base">🤖</span>
                  <div>
                    <div className="text-xs font-black tracking-wide flex items-center gap-1.5 leading-tight">
                      <span>CENTRAL MURADE</span>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                    </div>
                    <div className="text-[10px] text-blue-100 font-medium leading-none">
                      Robô • Certificado • Monitor 2026
                    </div>
                  </div>
                </div>

                {/* BOTÕES DE CONTROLE: MINIMIZAR (-), EXPANDIR/ENCOLHER E DESLIGAR (X) */}
                <div className="flex items-center gap-1">
                  {onAbrirAutomacao && (
                    <button
                      type="button"
                      onClick={onAbrirAutomacao}
                      title="Abrir tela de automação completa"
                      className="p-1 rounded-lg hover:bg-white/20 text-blue-100 hover:text-white transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    id="btn-encolher-painel-murade"
                    onClick={() => setModoTamanho('pequeno')}
                    title="Encolher tela para modo pequeno"
                    className="p-1 rounded-lg hover:bg-white/20 text-blue-100 hover:text-white transition-colors cursor-pointer"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    id="btn-minimizar-painel-murade"
                    onClick={() => setMinimizado(true)}
                    title="Minimizar (reduzir no canto)"
                    className="p-1 rounded-lg hover:bg-white/20 text-blue-100 hover:text-white transition-colors cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    id="btn-desligar-fechar-murade"
                    onClick={() => setFechado(true)}
                    title="Desligar e fechar o robô (X)"
                    className="p-1 rounded-lg hover:bg-red-500/80 text-blue-100 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {/* BARRA DE NAVEGAÇÃO DE ABAS UNIFICADA */}
              <div className="flex items-center bg-slate-100 border-b border-slate-200 p-1 gap-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAbaAtiva('robo')}
                  className={`flex-1 py-1.5 px-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    abaAtiva === 'robo'
                      ? 'bg-white text-blue-700 shadow-xs border border-blue-200 font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span>🤖</span>
                  <span>Robô</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAbaAtiva('dadosReais')}
                  className={`flex-1 py-1.5 px-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    abaAtiva === 'dadosReais'
                      ? 'bg-white text-emerald-700 shadow-xs border border-emerald-300 font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                  title="Auditoria local de dados importados; não autentica origem nem consulta órgãos oficiais"
                >
                  <span>🛡️</span>
                  <span>Auditoria local</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAbaAtiva('cert')}
                  className={`flex-1 py-1.5 px-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    abaAtiva === 'cert'
                      ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200 font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span>🔑</span>
                  <span>Cert.</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Validação pendente; sem conexão" />
                </button>

                <button
                  type="button"
                  onClick={() => setAbaAtiva('monitor')}
                  className={`flex-1 py-1.5 px-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    abaAtiva === 'monitor'
                      ? 'bg-white text-purple-700 shadow-xs border border-purple-200 font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span>📊</span>
                  <span>Logs</span>
                  <span className="text-[9px] bg-purple-100 text-purple-800 px-1 rounded-full font-mono">
                    {logs.length}
                  </span>
                </button>
              </div>

          {/* CONTEÚDO DAS ABAS */}
          <div className="p-3 overflow-y-auto max-h-[460px] bg-slate-50/50">
            {/* ======================================================== */}
            {/* ABA 1: 🤖 ROBÔ CENTRAL & AGENTE IA */}
            {/* ======================================================== */}
            {abaAtiva === 'robo' && (
              <div className="space-y-2.5">
                {/* 🎬 ÁREA DE ANIMAÇÃO CÊNICA (Robô, Agente, Linhas de Dados e Porta do Governo) */}
                <div 
                  className="relative h-40 rounded-xl border border-blue-200 overflow-hidden shadow-inner"
                  style={{
                    background: 'linear-gradient(180deg, #F8FAFF 0%, #EDF4FF 50%, #E2EEFF 100%)'
                  }}
                >
                  {/* Grade de fundo */}
                  <div 
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      backgroundImage: 'linear-gradient(to right, #165DFF 1px, transparent 1px), linear-gradient(to bottom, #165DFF 1px, transparent 1px)',
                      backgroundSize: '16px 16px'
                    }}
                  />

                  {/* Linhas de dados luminosas */}
                  <div className="absolute top-7 left-4 right-14 h-[2px] bg-gradient-to-r from-emerald-500 via-amber-400 to-purple-600 rounded-full opacity-70 animate-pulse" />
                  <div className="absolute top-14 left-6 right-16 h-[2px] bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-500 rounded-full opacity-60" />
                  <div className="absolute top-21 left-3 right-12 h-[2px] bg-gradient-to-r from-purple-500 via-pink-400 to-amber-400 rounded-full opacity-75" />

                  {/* Pacotes de dados viajando */}
                  <div 
                    className="absolute top-[26px] w-2.5 h-2.5 bg-amber-400 rounded-xs shadow-[0_0_8px_#f59e0b] transition-all"
                    style={{
                      left: `${15 + ((pacoteCiclo * 2) % 65)}%`,
                      opacity: (pacoteCiclo % 10 === 0) ? 0.4 : 1
                    }}
                  />
                  <div 
                    className="absolute top-[54px] w-2.5 h-2.5 bg-cyan-400 rounded-xs shadow-[0_0_8px_#06b6d4] transition-all"
                    style={{
                      left: `${25 + (((pacoteCiclo + 30) * 2) % 55)}%`
                    }}
                  />
                  <div 
                    className="absolute top-[82px] w-2.5 h-2.5 bg-emerald-400 rounded-xs shadow-[0_0_8px_#10b981] transition-all"
                    style={{
                      left: `${10 + (((pacoteCiclo + 60) * 2) % 70)}%`
                    }}
                  />

                  {/* Porta do Governo 🇧🇷 */}
                  <div 
                    className="absolute top-4 right-2.5 w-10 h-18 bg-gradient-to-b from-sky-100 to-blue-200 border-2 border-blue-600 rounded-t-lg flex flex-col items-center justify-between p-1 z-10 shadow-md"
                    title="Ilustração visual; integração governamental não configurada"
                  >
                    <div className="flex items-center gap-0.5">
                      <span className="text-[11px]">🇧🇷</span>
                      <span className="text-[7px] font-black text-blue-900">GOV</span>
                    </div>
                    
                    <div 
                      className="w-full h-10 bg-gradient-to-b from-blue-400 to-blue-600 rounded-t-sm border border-blue-700 transition-transform origin-left"
                      style={{
                        transform: `perspective(120px) rotateY(${pacoteCiclo % 40 < 20 ? -45 : -5}deg)`
                      }}
                    >
                      <div className="w-1.5 h-1.5 bg-amber-300 rounded-full mt-4 ml-0.5 shadow-xs" />
                    </div>

                    <span className="text-[6.5px] font-bold text-emerald-800 bg-emerald-100 px-1 rounded">
                      Não conectado
                    </span>
                  </div>

                  {/* Robô Central em movimento */}
                  <div 
                    className="absolute bottom-2 text-3xl select-none filter drop-shadow-md z-20 transition-transform duration-700 ease-in-out"
                    style={{
                      left: `${10 + (pacoteCiclo % 50 < 25 ? (pacoteCiclo % 50) * 1.6 : (50 - (pacoteCiclo % 50)) * 1.6)}px`,
                      transform: `scale(${1 + (pacoteCiclo % 20 === 0 ? 0.08 : 0)})`
                    }}
                    title="Mascote ilustrativo; nenhuma emissão ou transmissão está ocorrendo"
                  >
                    🤖
                  </div>

                  {/* Agente IA Murad */}
                  <div 
                    className="absolute bottom-2 text-3xl select-none filter drop-shadow-md z-20 transition-transform duration-700 ease-in-out"
                    style={{
                      right: `${50 + (pacoteCiclo % 60 < 30 ? (pacoteCiclo % 60) * 1.1 : (60 - (pacoteCiclo % 60)) * 1.1)}px`,
                      transform: `scale(${1 + ((pacoteCiclo + 10) % 20 === 0 ? 0.08 : 0)})`
                    }}
                    title="Ilustração; consulta legislativa oficial indisponível"
                  >
                    🧠
                  </div>

                  {/* Balão de Status Dinâmico */}
                  <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-md border border-blue-200 text-[8.5px] font-bold text-blue-900 shadow-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>Ilustração • sem conexão ativa</span>
                  </div>
                </div>

                {/* Estado das fontes fiscais */}
                <div className="grid grid-cols-2 gap-1.5 text-center">
                  <div className="p-1.5 rounded-xl bg-sky-50 border border-sky-200">
                    <div className="text-xs font-black text-sky-700">IBS</div>
                    <div className="text-[9px] text-sky-600 font-bold">Taxa não configurada</div>
                  </div>

                  <div className="p-1.5 rounded-xl bg-purple-50 border border-purple-200">
                    <div className="text-xs font-black text-purple-700">CBS</div>
                    <div className="text-[9px] text-purple-600 font-bold">Taxa não configurada</div>
                  </div>
                </div>

                {/* Botões de Ação Rápida */}
                <div className="space-y-1.5 pt-0.5">
                  {onAbrirCalculadora && (
                    <button
                      type="button"
                      onClick={onAbrirCalculadora}
                      className="w-full py-1.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-amber-200"
                    >
                      <Calculator className="w-3.5 h-3.5 text-amber-600" />
                      <span>Calculadora com taxas manuais</span>
                    </button>
                  )}

                  {onAbrirAutomacao && (
                    <button
                      type="button"
                      onClick={onAbrirAutomacao}
                      className="w-full py-1.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer hover:shadow-md"
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Painel de Automação Completo</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* ABA 2: 🔑 CERTIFICADO DIGITAL (SERPRO / RECEITA) */}
            {/* ======================================================== */}
            {abaAtiva === 'cert' && (
              <div className="space-y-3 bg-white p-3 rounded-xl border border-indigo-100 shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                      <span>🔑</span>
                      <span>Certificado Digital A1 / A3</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      A integração segura no servidor não está configurada. Selecionar arquivo nesta tela não valida nem conecta o certificado.
                    </p>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">Validação indisponível</span>
                </div>

                {/* Upload do Arquivo (.pfx ou .p12) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Arquivo do Certificado (.pfx ou .p12)
                  </label>
                  <div className="relative">
                    <input
                      ref={inputArquivoRef}
                      type="file"
                      id="cert-arquivo"
                      accept=".pfx,.p12"
                      onChange={(e) => {
                        const arq = e.target.files?.[0];
                        if (arq) setNomeArquivoCert(arq.name);
                      }}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 file:cursor-pointer cursor-pointer border border-slate-200 rounded-lg p-1 bg-slate-50"
                    />
                  </div>
                  {nomeArquivoCert && (
                    <div className="mt-1 text-[11px] text-indigo-600 font-medium truncate flex items-center gap-1">
                      <FileText className="w-3 h-3 text-indigo-500 shrink-0" />
                      <span>{nomeArquivoCert}</span>
                    </div>
                  )}
                </div>

                {/* Ação informativa; não envia o certificado */}
                <button
                  type="button"
                  id="btn-salvar-cert-murade"
                  onClick={handleSalvarCertificado}
                  className="w-full py-2 px-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Validar indisponível — integração não configurada</span>
                </button>

                {/* Status em tempo real */}
                <div id="cert-status" className="min-h-[22px]">
                  {statusMensagemCert && (
                    <div
                      className={`text-[11px] p-2 rounded-lg font-bold flex items-center gap-1.5 ${
                        'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {statusMensagemCert.tipo === 'aviso' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                      <span>{statusMensagemCert.texto}</span>
                    </div>
                  )}

                  {!statusMensagemCert && <div className="text-[11px] p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">Sem conexão mTLS. O servidor ainda precisa de validação PKCS#12 e integração oficial configurada.</div>}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* ABA 4: 🛡️ AUDITORIA LOCAL DE DOCUMENTOS IMPORTADOS */}
            {/* ======================================================== */}
            {abaAtiva === 'dadosReais' && (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 text-amber-950 p-3 rounded-xl">
                  <div className="font-black text-xs">Robôs fiscais — estado real das integrações</div>
                  <p className="text-[10.5px] mt-1">Este painel não consulta SEFAZ, SERPRO ou Receita Federal. A leitura de XMLs locais e a auditoria estrutural estão no módulo de Automação Fiscal.</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-xs font-black text-slate-800">Auditoria local do Radar e do livro</div>
                  <p className="text-[10px] text-slate-600">A auditoria local confere apenas documentos já importados neste navegador. Ela não confirma autorização, assinatura digital, valores devidos ou consulta órgãos públicos.</p>
                  {onAbrirAutomacao ? (
                    <button type="button" onClick={onAbrirAutomacao} className="w-full py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-[11px] font-bold">Abrir painel de auditoria local</button>
                  ) : <div className="text-[10px] text-amber-900">Navegação para o painel de auditoria não configurada.</div>}
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1 text-[10px] text-slate-700">
                  <div className="font-bold">Operações ainda não conectadas</div>
                  <div>• Busca e download de notas: API oficial autenticada pendente.</div>
                  <div>• Validação de certificado e mTLS: integração de servidor pendente.</div>
                  <div>• Comparação com outro sistema: origem externa e credenciais pendentes.</div>
                </div>
              </div>
            )}
            {/* ABA 3: 📊 MONITOR DE EVENTOS LOCAIS */}
            {/* ======================================================== */}
            {abaAtiva === 'monitor' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-purple-600" />
                    <span>Eventos locais desta sessão</span>
                  </div>
                  <button
                    type="button"
                    id="btn-limpar-log-murade"
                    onClick={handleLimparLogs}
                    title="Limpar logs do monitor"
                    className="text-[11px] text-slate-500 hover:text-red-600 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-200/60 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Limpar</span>
                  </button>
                </div>

                {/* Console de logs com id="log-murade" para compatibilidade com window.LOG_MURADE */}
                <div
                  ref={logRef}
                  id="log-murade"
                  className="p-2.5 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 font-mono text-[11px] leading-relaxed max-h-[340px] overflow-y-auto shadow-inner space-y-2"
                >
                  {logs.map((l) => (
                    <div key={l.id} className="border-b border-slate-800/80 pb-1.5 last:border-b-0">
                      <div className="flex items-center gap-1.5 font-bold" style={{ color: l.cor || '#38bdf8' }}>
                        <span>{l.icone || '•'}</span>
                        <span className="text-slate-400 font-normal text-[10px]">{l.hora}</span>
                        <span>— {l.msg}</span>
                      </div>
                      {l.detalhe && (
                        <div className="text-slate-400 pl-4 text-[10.5px] mt-0.5 font-sans">
                          {l.detalhe}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1.5 pt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Nenhum tráfego ou sincronização com órgãos públicos</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
      )}
    </>
  );
}
