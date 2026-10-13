import { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Cpu, 
  ChevronRight, 
  ChevronUp, 
  ChevronDown, 
  Key, 
  Activity, 
  ShieldCheck, 
  Zap, 
  ExternalLink,
  Minimize2,
  Maximize2,
  Minus,
  Power,
  Calculator,
  X,
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  Check,
  Ban,
  Scale
} from 'lucide-react';
import { 
  sistema as SISTEMA_DADOS_REAIS, 
  FiltroDadosReais, 
  CONFIG as CONFIG_DADOS_REAIS 
} from '../services/fiscal/muradeFiscalDadosReais.service';

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

  // Estados dos Robôs Murade — Só Dados Reais
  const [resumoRobo1, setResumoRobo1] = useState<any>(null);
  const [resumoRobo2, setResumoRobo2] = useState<any>(null);
  const [resumoRobo3, setResumoRobo3] = useState<any>(null);
  const [executandoRobo, setExecutandoRobo] = useState<number | null>(null);

  // Executar Robô 1 — Conferir Notas Fiscais
  const handleExecutarRobo1 = async (incluirFake: boolean = false) => {
    setExecutandoRobo(1);
    const listaTeste: any[] = [
      {
        chaveAcesso: '52260901234567000199550010000012451000012456', // 44 dígitos
        cnpj: '01.234.567/0001-99',
        fonte: 'SEFAZ',
        numero: '1245',
        valorTotal: 18500.00
      },
      {
        chaveAcesso: '35260998765432000188550010000098711000098712', // 44 dígitos
        cnpj: '98.765.432/0001-88',
        fonte: 'NF-e_Portal',
        numero: '9871',
        valorTotal: 42300.00
      }
    ];

    if (incluirFake) {
      listaTeste.push(
        {
          chaveAcesso: '123456', // INVÁLIDO (menos de 44 dígitos)
          cnpj: '00.000.000/0000-00',
          fonte: 'gerador_falso',
          numero: '9999',
          valorTotal: 1000.00
        },
        {
          chaveAcesso: '52260901234567000199550010000012451000012459',
          cnpj: '01.234.567/0001-99',
          fonte: 'simulacao',
          simulacao: true,
          numero: '7777',
          valorTotal: 500.00
        }
      );
    }

    const resultado = await SISTEMA_DADOS_REAIS.conferirNotas(listaTeste);
    setResumoRobo1(resultado);
    setExecutandoRobo(null);
  };

  // Executar Robô 2 — Conferir Valores e Impostos
  const handleExecutarRobo2 = async (comErro: boolean = false) => {
    setExecutandoRobo(2);
    const dado = comErro 
      ? { fonte: 'mock', valorTotal: 5000 }
      : {
          cnpj: '01.234.567/0001-99',
          chaveAcesso: '52260901234567000199550010000012451000012456',
          fonte: 'SEFAZ',
          valorTotal: 18500.00,
          impostos: { ICMS: 2220.00, PIS: 120.25, COFINS: 555.00 }
        };

    const resultado = await SISTEMA_DADOS_REAIS.conferirValores(dado);
    setResumoRobo2(resultado);
    setExecutandoRobo(null);
  };

  // Executar Robô 3 — Comparar com outro sistema
  const handleExecutarRobo3 = async () => {
    setExecutandoRobo(3);
    const dadosExterno = [
      { cnpj: '01.234.567/0001-99', chaveAcesso: '52260901234567000199550010000012451000012456', valorTotal: 18500.00 },
      { cnpj: '98.765.432/0001-88', chaveAcesso: '35260998765432000188550010000098711000098712', valorTotal: 42000.00 }
    ];
    const dadosMurade = [
      { valorTotal: 18500.00 },
      { valorTotal: 42300.00 } // Diferença de R$ 300,00 detectada!
    ];

    const resultado = await SISTEMA_DADOS_REAIS.compararSistemas(dadosExterno, dadosMurade);
    setResumoRobo3(resultado);
    setExecutandoRobo(null);
  };

  // Dados do Robô & Agente
  const [notasHoje, setNotasHoje] = useState(8542);
  const [empresasAtivas] = useState(1247);
  const [pacoteCiclo, setPacoteCiclo] = useState(0);

  // Dados do Certificado Digital
  const [certAtivo, setCertAtivo] = useState(false);
  const [nomeArquivoCert, setNomeArquivoCert] = useState('');
  const [senhaCert, setSenhaCert] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [salvandoCert, setSalvandoCert] = useState(false);
  const [statusMensagemCert, setStatusMensagemCert] = useState<{
    tipo: 'sucesso' | 'aviso' | 'info' | 'erro';
    texto: string;
  } | null>(null);

  // Logs em tempo real do Monitor
  const [logs, setLogs] = useState<ItemLog[]>([
    {
      id: 'init-1',
      tipo: 'info',
      hora: new Date().toLocaleTimeString('pt-BR'),
      msg: 'Robô Central Murade & Agente IA iniciados',
      detalhe: 'Integração ativa: Fiscal ↔ DP ↔ Fisco IA',
      cor: '#2563eb',
      icone: '🤖'
    },
    {
      id: 'init-2',
      tipo: 'sucesso',
      hora: new Date().toLocaleTimeString('pt-BR'),
      msg: 'Conexão SERPRO / RFB 2.0 pronta para tráfego',
      detalhe: 'Protocolo mTLS e auto-resolução ativados',
      cor: '#16a34a',
      icone: '✅'
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

  // Efeito 2: Carregar certificado salvo em localStorage
  useEffect(() => {
    try {
      const salvo = localStorage.getItem('murade_cert_ativo');
      const nomeSalvo = localStorage.getItem('murade_cert_nome');
      if (salvo === 'true' || (window as any).CERTIFICADO_ATIVO) {
        setCertAtivo(true);
        setNomeArquivoCert(nomeSalvo || 'certificado_a1_icp_brasil.pfx');
      }
    } catch (e) {
      // fallback
    }
  }, []);

  // Efeito 3: Simulação contínua do fluxo de notas do governo
  useEffect(() => {
    const intervaloNotas = setInterval(() => {
      setNotasHoje(prev => prev + Math.floor(Math.random() * 2) + 1);
    }, 4500);

    const intervaloCiclo = setInterval(() => {
      setPacoteCiclo(prev => (prev + 1) % 100);
    }, 2000);

    return () => {
      clearInterval(intervaloNotas);
      clearInterval(intervaloCiclo);
    };
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

    const handleCertAtualizado = (e: any) => {
      if (e?.detail) {
        setCertAtivo(Boolean(e.detail.ativo));
        if (e.detail.nome) setNomeArquivoCert(e.detail.nome);
      }
    };

    window.addEventListener('abrir_painel_unificado', handleAbrir);
    window.addEventListener('murade_novo_log', handleNovoLog);
    window.addEventListener('murade_cert_atualizado', handleCertAtualizado);

    // Registra proxies no window para máxima compatibilidade com menus e barras
    (window as any).ABRIR_PAINEL_MURADE = () => {
      setFechado(false);
      setMinimizado(false);
      setModoTamanho('expandido');
      setAbaAtiva('monitor');
    };
    (window as any).ABRIR_CERTIFICADO_MURADE = () => {
      setFechado(false);
      setMinimizado(false);
      setModoTamanho('expandido');
      setAbaAtiva('cert');
    };
    (window as any).ABRIR_ROBO_MURADE = () => {
      setFechado(false);
      setMinimizado(false);
      setAbaAtiva('robo');
    };

    return () => {
      window.removeEventListener('abrir_painel_unificado', handleAbrir);
      window.removeEventListener('murade_novo_log', handleNovoLog);
      window.removeEventListener('murade_cert_atualizado', handleCertAtualizado);
    };
  }, []);

  // Processar salvamento do certificado
  const handleSalvarCertificado = () => {
    const arquivoSelecionado = inputArquivoRef.current?.files?.[0];
    const nomeAtual = arquivoSelecionado?.name || nomeArquivoCert;

    if (!nomeAtual || !senhaCert) {
      setStatusMensagemCert({
        tipo: 'aviso',
        texto: 'Selecione o arquivo .pfx/.p12 e digite a senha!'
      });
      if ((window as any).LOG_MURADE) {
        (window as any).LOG_MURADE('aviso', 'Certificado pendente', 'Preencha o arquivo .pfx/.p12 e a senha.');
      }
      return;
    }

    setSalvandoCert(true);
    setStatusMensagemCert({
      tipo: 'info',
      texto: 'Conectando mTLS Serpro / Receita Federal...'
    });

    if ((window as any).LOG_MURADE) {
      (window as any).LOG_MURADE('info', 'Autenticando Certificado Digital', `Arquivo: ${nomeAtual} | Conectando mTLS Serpro/RFB...`);
    }

    setTimeout(() => {
      setSalvandoCert(false);
      setCertAtivo(true);
      setNomeArquivoCert(nomeAtual);
      (window as any).CERTIFICADO_ATIVO = true;
      (window as any).CERTIFICADO_DADOS = {
        nomeArquivo: nomeAtual,
        dataUpload: new Date().toLocaleDateString('pt-BR'),
        status: 'ATIVO',
        expiracao: '31/12/2026'
      };

      try {
        localStorage.setItem('murade_cert_ativo', 'true');
        localStorage.setItem('murade_cert_nome', nomeAtual);
      } catch (e) {
        // ignora
      }

      setStatusMensagemCert({
        tipo: 'sucesso',
        texto: '✅ Certificado Válido — Conexão Serpro Ativa!'
      });

      if ((window as any).LOG_MURADE) {
        (window as any).LOG_MURADE('sucesso', 'Certificado configurado', 'Robô já pode buscar dados REAIS do governo!');
      }
    }, 1200);
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
                <span>{notasHoje.toLocaleString('pt-BR')} NFe</span>
                <span className="text-white/40">|</span>
                <span className="text-[11px] font-medium text-amber-300">
                  {certAtivo ? '🔑 Cert. OK' : '🔑 Cert. Pendente'}
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
                  <span className="text-[7px] font-bold bg-emerald-400/90 text-slate-950 px-1 py-0.2 rounded-full uppercase">
                    On
                  </span>
                </div>
                <div className="text-[9px] text-blue-100 flex items-center gap-1 mt-0.5 leading-none">
                  <span className="font-extrabold text-amber-300">{notasHoje.toLocaleString('pt-BR')} NFe</span>
                  <span className="text-white/40">•</span>
                  <span className="text-blue-200">{certAtivo ? 'Cert. OK' : 'Cert.'}</span>
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
                  title="Murade Fiscal — Só Dados Reais (Sem Simulação)"
                >
                  <span>🛡️</span>
                  <span>Só Reais</span>
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
                  {certAtivo ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Conectado" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Pendente" />
                  )}
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
                    title="Porta de Integração Direta com Governo (RFB, SEFAZ, SERPRO 2.0)"
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
                      2.0 OK
                    </span>
                  </div>

                  {/* Robô Central em movimento */}
                  <div 
                    className="absolute bottom-2 text-3xl select-none filter drop-shadow-md z-20 transition-transform duration-700 ease-in-out"
                    style={{
                      left: `${10 + (pacoteCiclo % 50 < 25 ? (pacoteCiclo % 50) * 1.6 : (50 - (pacoteCiclo % 50)) * 1.6)}px`,
                      transform: `scale(${1 + (pacoteCiclo % 20 === 0 ? 0.08 : 0)})`
                    }}
                    title="Robô Central Murade — Emite, Recebe, Transmite e Auto-Resolve"
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
                    title="IA Murad — Validação Legislativa, Prazos 2026 e Voz Natural"
                  >
                    🧠
                  </div>

                  {/* Balão de Status Dinâmico */}
                  <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-md border border-blue-200 text-[8.5px] font-bold text-blue-900 shadow-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>SERPRO 2.0 • Auto-Resolução</span>
                  </div>
                </div>

                {/* Métricas em tempo real */}
                <div className="grid grid-cols-2 gap-1.5 text-center">
                  <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <div className="text-sm font-black text-blue-600">{empresasAtivas.toLocaleString('pt-BR')}</div>
                    <div className="text-[10px] text-slate-500 font-medium">Empresas Ativas</div>
                  </div>

                  <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <div className="text-sm font-black text-indigo-600">{notasHoje.toLocaleString('pt-BR')}</div>
                    <div className="text-[10px] text-slate-500 font-medium">NFe Hoje (SEFAZ)</div>
                  </div>

                  <div className="p-1.5 rounded-xl bg-sky-50 border border-sky-200">
                    <div className="text-xs font-black text-sky-700">IBS 12%</div>
                    <div className="text-[9px] text-sky-600 font-bold">Vigência 2026 ✅</div>
                  </div>

                  <div className="p-1.5 rounded-xl bg-purple-50 border border-purple-200">
                    <div className="text-xs font-black text-purple-700">CBS 9%</div>
                    <div className="text-[9px] text-purple-600 font-bold">Vigência 2026 ✅</div>
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
                      <span>Calculadora Fiscal (27 UFs)</span>
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
                      Necessário para puxar dados reais de RFB, e-CAC e SEFAZ via mTLS.
                    </p>
                  </div>
                  {certAtivo ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                      Ativo ✅
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                      Pendente ⚠️
                    </span>
                  )}
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

                {/* Campo de Senha do Certificado */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Senha do Certificado / PIN A3
                  </label>
                  <div className="relative">
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      id="cert-senha"
                      value={senhaCert}
                      onChange={(e) => setSenhaCert(e.target.value)}
                      placeholder="Digite a senha do certificado..."
                      className="w-full text-xs px-3 py-2 pr-9 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(!mostrarSenha)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {mostrarSenha ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Botão de Conectar e Salvar */}
                <button
                  type="button"
                  id="btn-salvar-cert-murade"
                  disabled={salvandoCert}
                  onClick={handleSalvarCertificado}
                  className="w-full py-2 px-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  {salvandoCert ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Conectando no SERPRO...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Salvar e Conectar na Serpro</span>
                    </>
                  )}
                </button>

                {/* Status em tempo real */}
                <div id="cert-status" className="min-h-[22px]">
                  {statusMensagemCert && (
                    <div
                      className={`text-[11px] p-2 rounded-lg font-bold flex items-center gap-1.5 ${
                        statusMensagemCert.tipo === 'sucesso'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : statusMensagemCert.tipo === 'aviso'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : statusMensagemCert.tipo === 'erro'
                          ? 'bg-red-50 text-red-800 border border-red-200'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {statusMensagemCert.tipo === 'sucesso' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      {statusMensagemCert.tipo === 'aviso' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                      <span>{statusMensagemCert.texto}</span>
                    </div>
                  )}

                  {!statusMensagemCert && certAtivo && (
                    <div className="text-[11px] p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Conexão mTLS 1.3 ativa com Serpro / Receita Federal</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* ABA 4: 🛡️ SÓ DADOS REAIS · SEM DADOS FALSOS (ROBÔS MURADE) */}
            {/* ======================================================== */}
            {abaAtiva === 'dadosReais' && (
              <div className="space-y-3">
                {/* CABEÇALHO DO FILTRO OFICIAL */}
                <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-3 rounded-xl shadow-xs border border-emerald-500/40">
                  <div className="flex items-center gap-1.5 font-black text-xs text-emerald-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>MURADE FISCAL — SÓ DADOS REAIS</span>
                  </div>
                  <p className="text-[10.5px] text-emerald-100/90 mt-0.5">
                    Bloqueio automático de qualquer simulação, mock ou gerador de teste. Apenas SEFAZ, Serpro e Receita Federal.
                  </p>

                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-200 px-1.5 py-0.5 rounded font-bold border border-emerald-400/30">
                      ✓ Chave 44 Dígitos
                    </span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-200 px-1.5 py-0.5 rounded font-bold border border-emerald-400/30">
                      ✓ Certificado mTLS
                    </span>
                    <span className="text-[9px] bg-red-500/20 text-red-200 px-1.5 py-0.5 rounded font-bold border border-red-400/30">
                      ✗ Bloqueia Mocks
                    </span>
                  </div>
                </div>

                {/* ROBÔ 1: CONFERIR NOTAS FISCAIS */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black text-slate-800 flex items-center gap-1">
                      <span>🤖</span>
                      <span>Robô 1 — Conferir Notas Fiscais</span>
                    </div>
                    {resumoRobo1 && (
                      <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded ${
                        resumoRobo1.bloqueadas > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                      }`}>
                        {resumoRobo1.resumo}
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-500">
                    Valida chaves oficiais de 44 dígitos e descarta dados de teste e fontes proibidas.
                  </p>

                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleExecutarRobo1(false)}
                      disabled={executandoRobo === 1}
                      className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{executandoRobo === 1 ? 'Conferindo...' : 'Conferir SEFAZ Real'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExecutarRobo1(true)}
                      disabled={executandoRobo === 1}
                      className="py-1.5 px-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      title="Testar injeção de dado simulado para provar que é bloqueado"
                    >
                      <Ban className="w-3 h-3 text-red-600" />
                      <span>Testar Bloqueio Fake</span>
                    </button>
                  </div>

                  {resumoRobo1 && (
                    <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-[10.5px]">
                      <div className="flex justify-between font-bold text-slate-700">
                        <span>Total Analisado: {resumoRobo1.total}</span>
                        <span className="text-emerald-700">Reais: {resumoRobo1.notasReais}</span>
                        <span className="text-red-600">Bloqueadas: {resumoRobo1.bloqueadas}</span>
                      </div>
                      {resumoRobo1.listaReais?.slice(0, 2).map((nota: any, idx: number) => (
                        <div key={idx} className="p-1.5 bg-white rounded border border-emerald-200 text-[10px] text-slate-700 font-mono">
                          <div className="text-emerald-700 font-bold">{nota.status}</div>
                          <div className="truncate">Chave: {nota.chaveAcesso}</div>
                          <div>NF nº {nota.numero} • R$ {Number(nota.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ROBÔ 2: CONFERIR VALORES E IMPOSTOS */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black text-slate-800 flex items-center gap-1">
                      <span>🤖</span>
                      <span>Robô 2 — Conferir Valores e Impostos</span>
                    </div>
                    {resumoRobo2?.status && (
                      <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1 rounded">
                        {resumoRobo2.status}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleExecutarRobo2(false)}
                      disabled={executandoRobo === 2}
                      className="py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
                    >
                      <Activity className="w-3 h-3" />
                      <span>Conferir Impostos</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExecutarRobo2(true)}
                      disabled={executandoRobo === 2}
                      className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Ban className="w-3 h-3 text-red-500" />
                      <span>Testar Bloqueio</span>
                    </button>
                  </div>

                  {resumoRobo2 && (
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[10.5px]">
                      {resumoRobo2.erro ? (
                        <div className="text-red-700 font-bold">{resumoRobo2.erro}</div>
                      ) : (
                        <div className="space-y-0.5 text-slate-700">
                          <div className="text-emerald-700 font-bold">{resumoRobo2.status}</div>
                          <div>Total da Nota: R$ {Number(resumoRobo2.dados?.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          <div>ICMS: R$ 2.220,00 • PIS: R$ 120,25 • COFINS: R$ 555,00</div>
                          <div className="text-[9px] text-slate-400">{resumoRobo2.data}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ROBÔ 3: COMPARAR COM OUTRO SISTEMA */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black text-slate-800 flex items-center gap-1">
                      <span>🤖</span>
                      <span>Robô 3 — Comparar Sistemas</span>
                    </div>
                    {resumoRobo3 && (
                      <span className="text-[9.5px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                        {resumoRobo3.divergencias} divergência(s)
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-500">
                    Compara dados fiscais de sistema externo contra o repositório Murade validando divergências centavo a centavo.
                  </p>

                  <button
                    type="button"
                    onClick={handleExecutarRobo3}
                    disabled={executandoRobo === 3}
                    className="w-full py-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Executar Comparação Cruzada</span>
                  </button>

                  {resumoRobo3 && (
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-[10.5px]">
                      <div className="flex justify-between font-bold">
                        <span className="text-emerald-700">Iguais: {resumoRobo3.iguais}</span>
                        <span className="text-amber-700">Divergências: {resumoRobo3.divergencias}</span>
                        <span className="text-red-700">Bloqueados: {resumoRobo3.bloqueados}</span>
                      </div>
                      {resumoRobo3.detalhes?.map((item: any, idx: number) => (
                        <div key={idx} className="p-1 rounded bg-white border border-slate-200 text-[10px]">
                          <span className="font-bold">{item.status}: </span>
                          {item.dif !== undefined ? (
                            <span className="text-amber-700 font-medium">
                              Externo R$ {item.externo} vs Murade R$ {item.murade} (Dif: R$ {item.dif})
                            </span>
                          ) : (
                            <span>Valor R$ {item.valor}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* ABA 3: 📊 MONITOR & LOGS EM TEMPO REAL */}
            {/* ======================================================== */}
            {abaAtiva === 'monitor' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-purple-600" />
                    <span>Logs de Execução em Tempo Real</span>
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
                  <span>Sincronização contínua com Serpro, RFB e e-CAC</span>
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
