import React, { useState, useEffect, useRef } from 'react';
import { 
  Crown, LayoutDashboard, Building2, CalendarCheck, 
  FileText, FileCheck, Bot, Video, 
  User, DollarSign, ShieldAlert, Tag, 
  ChevronLeft, ChevronRight, X, LogOut, Receipt, CheckCircle2, Server,
  UserPlus, ShieldCheck, ClipboardCheck, Settings, Cpu, Calculator, Volume2,
  Key, Eye, EyeOff, RefreshCw, Lock, Unlock, Radio, LayoutGrid
} from 'lucide-react';
import { UsuarioAuth } from '../types';
import { TIPOS_USUARIO, ehUsuarioAdmin, obterMenuPermitido } from '../config/Permissoes';
import SimboloContabil from './SimboloContabil';
import { MURADE_CONFIG } from '../services/murade/muradeConfigIntegracoes.service';

interface MenuLateralProps {
  abaAtiva?: string;
  onSelecionarAba?: (aba: string) => void;
  navegarPara?: (aba: string) => void;
  usuarioAtual?: UsuarioAuth;
  usuarioLogado?: UsuarioAuth;
  onLogout?: () => void;
  abertoMobile?: boolean;
  onFecharMobile?: () => void;
  recolhidoDesktop?: boolean;
  onAlternarRecolhidoDesktop?: () => void;
  adminDesbloqueado?: boolean;
  visaoAdminAtiva?: boolean;
  onAlternarVisaoAdmin?: (visaoAdmin: boolean) => void;
  onAbrirJanelaSenhaAdmin?: () => void;
  onBloquearAdmin?: () => void;
}

export default function MenuLateral({
  abaAtiva = 'dashboard',
  onSelecionarAba,
  navegarPara,
  usuarioAtual,
  usuarioLogado,
  onLogout,
  abertoMobile = false,
  onFecharMobile,
  recolhidoDesktop = false,
  onAlternarRecolhidoDesktop,
  adminDesbloqueado = false,
  visaoAdminAtiva = false,
  onAlternarVisaoAdmin,
  onAbrirJanelaSenhaAdmin,
  onBloquearAdmin
}: MenuLateralProps) {
  const usuario = usuarioAtual || usuarioLogado || {
    id: '1',
    nome: 'Contador',
    email: 'contador@fiscoia.com.br',
    tipo: TIPOS_USUARIO.CONTADOR,
    ehAdmin: false
  };

  // Somente está no modo Admin se a senha tiver sido inserida E estiver com visão admin ligada
  const estaAdminAtivo = Boolean(adminDesbloqueado && visaoAdminAtiva);
  const isAdmin = estaAdminAtivo;

  // Estados dos serviços Murade 2026 para os controles na barra lateral esquerda
  const [monitorAberto, setMonitorAberto] = useState(false);
  const [certAberto, setCertAberto] = useState(false);
  const [certAtivo, setCertAtivo] = useState(false);

  // Refs para isolamento estrito de rolagem (evita que o scroll vaze para a tela principal)
  const asideMenuRef = useRef<HTMLElement>(null);
  const scrollMenuRef = useRef<HTMLDivElement>(null);

  // Isolação estrita do scroll do mouse na barra lateral (impede que role a outra barra/página lá fora)
  useEffect(() => {
    const asideEl = asideMenuRef.current;
    const scrollEl = scrollMenuRef.current;
    if (!asideEl) return;

    const handleWheelIsolado = (e: WheelEvent) => {
      const target = scrollEl;
      if (!target) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = target;
      const delta = e.deltaY;

      // Se todo o conteúdo cabe na altura atual, não há scroll no menu, portanto bloqueia propagação para fora
      if (scrollHeight <= clientHeight) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const atingiuTopo = delta < 0 && scrollTop <= 0;
      const atingiuFim = delta > 0 && Math.ceil(scrollTop + clientHeight) >= scrollHeight - 1;

      // Se atingiu o final ou o topo do menu, bloqueia para que a página lá fora permaneça 100% quieta!
      if (atingiuTopo || atingiuFim) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Adiciona listener não-passivo no aside para interceptar qualquer evento de roda no canto esquerdo
    asideEl.addEventListener('wheel', handleWheelIsolado, { passive: false });
    return () => {
      asideEl.removeEventListener('wheel', handleWheelIsolado);
    };
  }, []);

  useEffect(() => {
    const verificarStatus = () => {
      const painel = document.getElementById('painel-murade');
      const cert = document.getElementById('cert-murade');
      setMonitorAberto(painel ? painel.style.display !== 'none' : false);
      setCertAberto(cert ? cert.style.display !== 'none' : false);
      setCertAtivo(Boolean((window as any).CERTIFICADO_ATIVO));
    };

    verificarStatus();
    const interval = setInterval(verificarStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleMonitor = () => {
    if ((window as any).ABRIR_PAINEL_MURADE) {
      (window as any).ABRIR_PAINEL_MURADE();
      setMonitorAberto(true);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('abrir_painel_unificado', { detail: { aba: 'monitor' } }));
      setMonitorAberto(true);
    }
  };

  const toggleCertificado = () => {
    if ((window as any).ABRIR_CERTIFICADO_MURADE) {
      (window as any).ABRIR_CERTIFICADO_MURADE();
      setCertAberto(true);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('abrir_painel_unificado', { detail: { aba: 'cert' } }));
      setCertAberto(true);
    }
  };

  // Mapeamento bidirecional para compatibilidade total entre nomes amigáveis e IDs internos
  const MAPA_NOMES_PARA_IDS: Record<string, string> = {
    'Painel MURADE': 'admin',
    'Faturamento': 'admin_faturamento',
    'Bloqueio de Inadimplentes': 'admin_bloqueio',
    'Preços & Planos': 'admin_precos',
    'Início': 'dashboard',
    'Status Empresas': 'conformidade',
    'Relatório de Conformidade': 'conformidade',
    'Conformidade': 'conformidade',
    'Empresas': 'empresas',
    'Fiscal (Agenda)': 'agenda',
    'CND': 'cnd',
    'CND / Certidões': 'cnd',
    'Certidões': 'cnd',
    'Guias': 'dctfweb',
    'Guias DCTFWeb / Receita Federal': 'dctfweb',
    'DCTFWeb (Guias INSS)': 'dctfweb',
    'Procuração RFB': 'procuracao',
    'IA Fiscal': 'iaFiscal',
    'IA Murad Voz Natural': 'iaVoz',
    'IA Murade Voz Natural': 'iaVoz',
    'IA Voz': 'iaVoz',
    'Voz Murad': 'iaVoz',
    'Voz Murade': 'iaVoz',
    'Vídeo Aulas': 'videoAulas',
    'Minha Conta': 'minhaConta',
  };

  // Manipulador de clique no item de navegação
  const handleItemClick = (identificador: string) => {
    const idReal = MAPA_NOMES_PARA_IDS[identificador] || identificador;
    if (onSelecionarAba) {
      onSelecionarAba(idReal);
    } else if (navegarPara) {
      navegarPara(idReal);
    }

    // Se estiver no mobile, fecha automaticamente a gaveta ao clicar
    if (abertoMobile && onFecharMobile) {
      onFecharMobile();
    }
  };

  // Ícones associados a cada identificador
  const ICONES: Record<string, React.ElementType> = {
    admin: Crown,
    admin_faturamento: DollarSign,
    admin_bloqueio: ShieldAlert,
    admin_precos: Tag,
    dashboard: LayoutDashboard,
    modulos: LayoutGrid,
    conformidade: ClipboardCheck,
    empresas: Building2,
    agenda: CalendarCheck,
    cnd: ShieldCheck,
    dctfweb: Receipt,
    guias: FileText,
    procuracao: FileCheck,
    serpro: Server,
    iaFiscal: Bot,
    videoAulas: Video,
    minhaConta: User,
  };

  // Itens do menu permitidos conforme o perfil
  const itensMuradeAdmin = [
    { id: 'admin', rotulo: 'Painel MURADE', icone: Crown, admin: true },
    { id: 'automacaoFiscal', rotulo: 'Automação Fiscal', icone: Cpu, tag: 'Robô 2026', admin: true },
    { id: 'modulos', rotulo: 'Módulos Murade', icone: LayoutGrid, tag: 'Fiscal • Contábil • DP', admin: true },
    { id: 'fiscal', rotulo: 'NFe & Apuração', icone: Receipt, tag: 'v3.2.1', admin: true },
    { id: 'configuracao', rotulo: 'Config. Integração', icone: Settings, tag: '3 Sistemas', admin: true },
    { id: 'admin_faturamento', rotulo: 'Faturamento', icone: DollarSign, admin: true },
    { id: 'admin_bloqueio', rotulo: 'Bloqueio de Inadimplentes', icone: ShieldAlert, admin: true },
    { id: 'admin_precos', rotulo: 'Preços & Planos', icone: Tag, admin: true },
    { id: 'minhaConta', rotulo: 'Minha Conta', icone: User, admin: true },
    { id: 'calculadora', rotulo: 'Calculadora Fiscal', icone: Calculator, destaque: true, tag: 'DESTAQUE', admin: true },
    { id: 'iaVoz', rotulo: 'IA Murade Voz Natural', icone: Volume2, tag: 'ElevenLabs', destaque: true, admin: true },
    { id: 'videoAulas', rotulo: 'Vídeo Aulas', icone: Video, admin: true },
  ];

  // Configuração Murade para desvincular e ocultar integrações na visão do cliente
  const ocultarIntegracoes = MURADE_CONFIG.deveOcultarIntegracoes(isAdmin);

  const itensContador = [
    { id: 'dashboard', rotulo: 'Início', icone: LayoutDashboard },
    { id: 'automacaoFiscal', rotulo: 'Automação Fiscal', icone: Cpu, tag: 'Robô 2026' },
    { id: 'modulos', rotulo: 'Módulos Murade', icone: LayoutGrid, tag: 'Fiscal • Contábil • DP' },
    { id: 'cadastro-empresa', rotulo: 'Cadastrar Empresa', icone: UserPlus },
    { id: 'conformidade', rotulo: 'Relatório de Conformidade', icone: ClipboardCheck, tag: 'Empresas' },
    { id: 'empresas', rotulo: 'Clientes / Empresas', icone: Building2 },
    { id: 'fiscal', rotulo: 'NFe & Apuração', icone: Receipt, tag: 'v3.2.1' },
    { id: 'agenda', rotulo: 'Fiscal (Agenda)', icone: CalendarCheck },
    { id: 'cnd', rotulo: 'CND / Certidões', icone: ShieldCheck },
    { id: 'dctfweb', rotulo: 'Guias', icone: Receipt },
    ...(!ocultarIntegracoes ? [{ id: 'serpro', rotulo: 'Integração SERPRO', icone: Server }] : []),
    { id: 'procuracao', rotulo: 'Procuração RFB', icone: FileCheck },
    ...(!ocultarIntegracoes ? [{ id: 'configuracao', rotulo: 'Config. Integração', icone: Settings, tag: '3 Sistemas' }] : []),
    { id: 'minhaConta', rotulo: 'Minha Conta', icone: User },
    ...(isAdmin ? [{ id: 'admin', rotulo: 'Painel MURADE', icone: Crown, admin: true }] : []),
    { id: 'calculadora', rotulo: 'Calculadora Fiscal', icone: Calculator, destaque: true, tag: 'DESTAQUE' },
    { id: 'iaVoz', rotulo: 'IA Murade Voz Natural', icone: Volume2, tag: 'ElevenLabs', destaque: true },
    { id: 'videoAulas', rotulo: 'Vídeo Aulas', icone: Video },
  ];

  // Verifica se o item está ativo
  const verificarAtivo = (id: string) => {
    if (abaAtiva === id) return true;
    if (id === 'iaVoz' && (abaAtiva === 'iaVoz' || abaAtiva === 'vozMurad' || abaAtiva === 'voz')) return true;
    if (id === 'calculadora' && (abaAtiva === 'calculadora' || abaAtiva === 'calculadoraFiscal')) return true;
    if (id === 'fiscal' && (abaAtiva === 'fiscal' || abaAtiva === 'moduloFiscal' || abaAtiva === 'nfe_saida' || abaAtiva === 'nfe_entrada' || abaAtiva === 'baixa_notas' || abaAtiva === 'apuracao')) return true;
    if (id === 'automacaoFiscal' && (abaAtiva === 'automacaoFiscal' || abaAtiva === 'automacao' || abaAtiva === 'fiasco')) return true;
    if (id === 'configuracao' && (abaAtiva === 'configuracao' || abaAtiva === 'integracao')) return true;
    if (id === 'cadastro-empresa' && abaAtiva === 'cadastro-empresa') return true;
    if (id === 'serpro' && abaAtiva === 'serpro') return true;
    if (id === 'dctfweb' && (abaAtiva === 'guiasINSS' || abaAtiva === 'consultaGuias')) return true;
    if (id === 'admin' && abaAtiva.startsWith('admin') && !['admin_faturamento', 'admin_bloqueio', 'admin_precos'].includes(abaAtiva)) return true;
    return false;
  };

  return (
    <>
      {/* Backdrop para mobile ("se esconde sozinho ao clicar fora") */}
      {abertoMobile && onFecharMobile && (
        <div
          onClick={onFecharMobile}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* 🔵 BARRA LATERAL — AZUL ESCURO (#1e3a8a), 220px, MARCA D'ÁGUA MURAD */}
      <aside
        ref={asideMenuRef}
        id="menu-lateral-fiscoia"
        style={{
          backgroundColor: '#1e3a8a',
          boxShadow: '3px 0 10px rgba(15, 23, 42, 0.25)',
          borderRight: '1px solid rgba(255, 255, 255, 0.15)',
          overscrollBehavior: 'contain',
          overscrollBehaviorY: 'contain'
        }}
        className={`fixed md:sticky top-0 left-0 z-50 h-screen text-white flex flex-col transition-all duration-300 ease-in-out relative overflow-hidden select-none overscroll-contain ${
          // Largura no desktop: recolhido (w-16) vs expandido padrão 220px (w-[220px])
          recolhidoDesktop ? 'md:w-16' : 'md:w-[220px]'
        } ${
          // No mobile: gaveta de 220px que desliza e se esconde
          abertoMobile ? 'translate-x-0 w-[220px]' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* 💧 MARCA D'ÁGUA — MURADE, discreta ao fundo */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 100,
            left: 15,
            fontSize: '34px',
            fontWeight: 900,
            color: '#ffffff',
            opacity: 0.06,
            transform: 'rotate(-15deg)',
            letterSpacing: '5px',
            zIndex: 0,
            pointerEvents: 'none'
          }}
        >
          MURADE
        </div>

        {/* CABEÇALHO COM SETAS CLARAS DE ESTICAR / RECOLHER */}
        <div
          style={{
            padding: recolhidoDesktop && !abertoMobile ? '12px 6px' : '16px 14px 12px 14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
            position: 'relative',
            zIndex: 1
          }}
          className="shrink-0 flex items-center justify-between"
        >
          {/* Quando Recolhido: Botão proeminente COM SETA PARA A DIREITA para ESTICAR A BARRA DE VOLTA AO NORMAL */}
          {recolhidoDesktop && !abertoMobile ? (
            <div className="w-full flex flex-col items-center gap-2">
              <button
                type="button"
                id="btn-esticar-barra-lateral-topo"
                onClick={onAlternarRecolhidoDesktop}
                title="Clique aqui para esticar a barra lateral e voltar ao normal"
                className="w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg border-2 border-blue-400/80 transition-all hover:scale-105 cursor-pointer group"
              >
                <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <span className="text-[9px] text-indigo-200 font-bold tracking-tight text-center leading-tight">
                Esticar
              </span>
            </div>
          ) : (
            /* Quando Aberto: Logo e Seta para Recolher */
            <>
              <div 
                onClick={() => handleItemClick('dashboard')}
                className="cursor-pointer min-w-0 flex-1 flex items-center gap-2.5"
                title="Ir para o Início"
              >
                <SimboloContabil tamanho="md" comBrilho={true} />
                <div>
                  <h2 
                    style={{ 
                      fontSize: '17px', 
                      fontWeight: 900, 
                      color: '#ffffff',
                      lineHeight: 1.1,
                      letterSpacing: '-0.3px'
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <span>Murade Fisco IA</span>
                  </h2>
                  <p 
                    style={{ 
                      fontSize: '10px', 
                      color: '#c7d2fe', 
                      marginTop: '2px',
                      fontWeight: 500
                    }}
                  >
                    Compliance Fiscal com IA
                  </p>
                </div>
              </div>

              {/* Botão Fechar no Mobile */}
              {abertoMobile && onFecharMobile && (
                <button
                  onClick={onFecharMobile}
                  className="md:hidden p-1.5 text-white hover:bg-white/20 rounded-lg cursor-pointer"
                  title="Fechar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              )}

              {/* Seta para Recolher a Barra no Desktop */}
              {onAlternarRecolhidoDesktop && (
                <button
                  type="button"
                  id="btn-recolher-barra-lateral-topo"
                  onClick={onAlternarRecolhidoDesktop}
                  title="Recolher barra lateral"
                  className="hidden md:flex p-1.5 text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg cursor-pointer transition-all hover:scale-105 ml-1"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
              )}
            </>
          )}
        </div>

        {/* CABEÇALHO DO MENU */}
        {(!recolhidoDesktop || abertoMobile) && (
          <div 
            style={{
              backgroundColor: estaAdminAtivo ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '10px 12px',
              margin: '10px 8px 6px 8px',
              border: estaAdminAtivo ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
              position: 'relative',
              zIndex: 1
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffffff' }}>
              {estaAdminAtivo ? '👑 PAINEL MASTER' : 'MURADE FISCO IA'}
            </div>
            <div style={{ fontSize: '11px', color: estaAdminAtivo ? '#fde68a' : '#a5b4fc', marginTop: '2px' }}>
              {estaAdminAtivo ? 'Diretoria Executiva Murade' : 'Sistema de Gestão Contábil'}
            </div>
          </div>
        )}

        {/* 🔄 SELETOR DE VISÃO EXCLUSIVO (Aparece apenas quando o Administrador Master estiver desbloqueado) */}
        {adminDesbloqueado && (!recolhidoDesktop || abertoMobile) && (
          <div className="mx-2 mb-1 p-1 bg-white/10 rounded-xl flex gap-1 text-[11px] font-bold">
            <button
              type="button"
              id="menu-btn-alternar-para-cliente"
              onClick={() => onAlternarVisaoAdmin && onAlternarVisaoAdmin(false)}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                !visaoAdminAtiva 
                  ? 'bg-white text-slate-900 shadow-xs font-black' 
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title="Visualizar a tela exatamente como o cliente vê"
            >
              <span>👤 Cliente</span>
            </button>
            <button
              type="button"
              id="menu-btn-alternar-para-admin"
              onClick={() => onAlternarVisaoAdmin && onAlternarVisaoAdmin(true)}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                visaoAdminAtiva 
                  ? 'bg-amber-400 text-slate-950 shadow-xs font-black' 
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title="Visualizar os módulos de administração master"
            >
              <span>👑 Master</span>
            </button>
          </div>
        )}

        <div 
          style={{
            height: '1px',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            margin: '6px 12px'
          }} 
        />

        {/* LISTA DE ITENS DO MENU COM SCROLL ISOLADO */}
        <div 
          ref={scrollMenuRef}
          className="flex-1 overflow-y-auto overflow-x-hidden relative overscroll-contain"
          style={{ 
            zIndex: 1,
            overscrollBehavior: 'contain',
            overscrollBehaviorY: 'contain'
          }}
        >
          {estaAdminAtivo ? (
            /* 👑 SEÇÃO EXCLUSIVA MURADE (Apenas para o Administrador Master quando ativo) */
            <div>
              {(!recolhidoDesktop || abertoMobile) && (
                <div 
                  style={{ 
                    padding: '8px 16px 4px 16px',
                    fontSize: '10px', 
                    fontWeight: 800, 
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: '#fde68a'
                  }}
                  className="flex items-center justify-between"
                >
                  <span>Módulos Administrativos</span>
                  <span className="bg-amber-400 text-slate-950 text-[9px] px-1.5 py-0.2 rounded font-black">
                    Master
                  </span>
                </div>
              )}

              {itensMuradeAdmin.map((item) => {
                const Icone = item.icone;
                const isAtivo = verificarAtivo(item.id);
                const isDestaque = (item as any).destaque;
                const isIntegracao = item.id === 'configuracao' || item.id === 'serpro';
                const isDivisao = item.id === 'minhaConta';
                return (
                  <React.Fragment key={item.id}>
                    {isDivisao && (
                      <div 
                        style={{
                          height: '1px',
                          backgroundColor: 'rgba(255, 255, 255, 0.15)',
                          margin: '10px 14px 8px 14px'
                        }}
                      />
                    )}
                    <button
                      id={item.id === 'configuracao' ? 'aba-integracoes' : `menu-btn-${item.id}`}
                      data-integracao={isIntegracao ? "true" : undefined}
                      type="button"
                      onClick={() => handleItemClick(item.id)}
                      style={{
                        padding: '11px 12px',
                        margin: '2px 8px',
                        borderRadius: '8px',
                        backgroundColor: isAtivo 
                          ? '#3b82f6' 
                          : isDestaque 
                          ? 'rgba(245, 158, 11, 0.08)' 
                          : 'transparent',
                        border: isDestaque && !isAtivo ? '1px solid rgba(245, 158, 11, 0.25)' : 'none',
                        color: isAtivo ? '#ffffff' : isDestaque ? '#fef3c7' : '#e0e7ff',
                        width: 'calc(100% - 16px)',
                        boxShadow: isAtivo ? '0 4px 6px -1px rgba(0, 0, 0, 0.15)' : 'none'
                      }}
                      className={`flex items-center gap-2.5 text-left transition-all cursor-pointer hover:bg-white/10 ${isIntegracao ? 'integracao conexao sincronizacao' : ''} ${
                        isAtivo ? 'font-bold' : 'font-medium'
                      } ${recolhidoDesktop && !abertoMobile ? 'justify-center !mx-auto !w-12 !px-0' : ''}`}
                      title={item.rotulo}
                    >
                      <Icone 
                        className={`w-4 h-4 shrink-0 ${isAtivo ? 'text-white' : isDestaque ? 'text-amber-400' : 'text-[#a5b4fc]'}`} 
                      />
                      {(!recolhidoDesktop || abertoMobile) && (
                        <>
                          <span 
                            style={{ fontSize: '14px' }} 
                            className="truncate flex-1"
                          >
                            {item.rotulo}
                          </span>
                          {item.tag && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              isDestaque 
                                ? 'bg-amber-400 text-slate-950 font-black shadow-xs' 
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {item.tag}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            /* 👤 SEÇÃO DO CONTADOR (Itens de trabalho do cliente 100% isolados) */
            <div className="mt-1">
              {(!recolhidoDesktop || abertoMobile) && (
                <div 
                  style={{ 
                    padding: '8px 16px 4px 16px',
                    fontSize: '10px', 
                    fontWeight: 800, 
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: '#a5b4fc'
                  }}
                >
                  Trabalho Contábil
                </div>
              )}

            {itensContador.map((item) => {
              const Icone = item.icone;
              const isAtivo = verificarAtivo(item.id);
              const isDestaque = (item as any).destaque;
              const isDivisao = item.id === 'minhaConta';
              return (
                <React.Fragment key={item.id}>
                  {isDivisao && (
                    <div 
                      style={{
                        height: '1px',
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        margin: '10px 14px 8px 14px'
                      }}
                    />
                  )}
                  <button
                    key={item.id}
                    id={`menu-btn-${item.id}`}
                    type="button"
                    onClick={() => handleItemClick(item.id)}
                    style={{
                      padding: '11px 12px',
                      margin: '2px 8px',
                      borderRadius: '8px',
                      backgroundColor: isAtivo 
                        ? '#3b82f6' 
                        : isDestaque 
                        ? 'rgba(245, 158, 11, 0.15)' 
                        : 'transparent',
                      border: isDestaque && !isAtivo ? '1px solid rgba(245, 158, 11, 0.5)' : 'none',
                      color: isAtivo ? '#ffffff' : isDestaque ? '#fef3c7' : '#e0e7ff',
                      width: 'calc(100% - 16px)',
                      boxShadow: isAtivo ? '0 4px 6px -1px rgba(0, 0, 0, 0.15)' : 'none'
                    }}
                    className={`flex items-center gap-2.5 text-left transition-all cursor-pointer hover:bg-white/10 ${
                      isAtivo ? 'font-bold' : 'font-medium'
                    } ${recolhidoDesktop && !abertoMobile ? 'justify-center !mx-auto !w-12 !px-0' : ''}`}
                    title={item.rotulo}
                  >
                    <Icone 
                      className={`w-4 h-4 shrink-0 ${isAtivo ? 'text-white' : isDestaque ? 'text-amber-400' : 'text-[#a5b4fc]'}`} 
                    />
                    {(!recolhidoDesktop || abertoMobile) && (
                      <>
                        <span 
                          style={{ fontSize: '14px' }} 
                          className="truncate flex-1"
                        >
                          {item.rotulo}
                        </span>
                        {item.tag && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            isDestaque 
                              ? 'bg-amber-400 text-slate-950 font-black shadow-xs' 
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {item.tag}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
            {/* 🛡️ PAINEL MURADE 2026 NA LATERAL ESQUERDA (Monitor & Certificado) */}
            {(!recolhidoDesktop || abertoMobile) ? (
              <div className="mx-2 mt-3 mb-2 p-2.5 rounded-xl bg-slate-900/80 border border-blue-500/30 text-xs shadow-inner space-y-2">
                <div className="flex items-center justify-between text-[11px] font-black text-blue-300">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>MURADE FISCO IA</span>
                  </div>
                  <span className="text-[9px] bg-blue-900/60 text-blue-200 border border-blue-400/30 px-1.5 py-0.5 rounded font-bold">2026</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {/* Botão Certificado */}
                  <button
                    type="button"
                    onClick={toggleCertificado}
                    className={`px-2 py-1.5 rounded-lg font-bold flex items-center justify-between transition-all cursor-pointer text-[11px] ${
                      certAberto 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'bg-white/10 hover:bg-white/15 text-indigo-200'
                    }`}
                    title="Configurar Certificado Digital Serpro/Receita"
                  >
                    <span className="flex items-center gap-1">
                      <Key className="w-3.5 h-3.5 text-indigo-300" />
                      <span>Certificado</span>
                    </span>
                    <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                      certAtivo ? 'bg-emerald-500 text-white' : 'bg-amber-500/80 text-white'
                    }`}>
                      {certAtivo ? 'Ativo' : 'Pendente'}
                    </span>
                  </button>

                  {/* Botão Monitor */}
                  <button
                    type="button"
                    onClick={toggleMonitor}
                    className={`px-2 py-1.5 rounded-lg font-bold flex items-center justify-between transition-all cursor-pointer text-[11px] ${
                      monitorAberto 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'bg-white/10 hover:bg-white/15 text-blue-200'
                    }`}
                    title="Exibir/Ocultar Monitor em tempo real de Robô e Agente"
                  >
                    <span className="flex items-center gap-1">
                      <Bot className="w-3.5 h-3.5 text-blue-300" />
                      <span>Monitor</span>
                    </span>
                    <span className="text-[9px] bg-black/30 px-1 py-0.2 rounded font-semibold text-blue-200">
                      {monitorAberto ? 'Visível' : 'Oculto'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              /* Versão compacta com ícones quando barra recolhida */
              <div className="flex flex-col items-center gap-1.5 my-2 p-1 bg-slate-900/60 rounded-xl border border-blue-500/20">
                <button
                  type="button"
                  onClick={toggleCertificado}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${
                    certAtivo ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/10 text-amber-300 hover:bg-white/20'
                  }`}
                  title={certAtivo ? "Certificado Conectado" : "Certificado Pendente"}
                >
                  <Key className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleMonitor}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${
                    monitorAberto ? 'bg-blue-600 text-white' : 'bg-white/10 text-blue-300 hover:bg-white/20'
                  }`}
                  title="Monitor de Operações"
                >
                  <Bot className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
        </div>

        {/* RODAPÉ DO MENU: INFORMAÇÕES DO USUÁRIO & SAIR */}
        <div
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.15)',
            position: 'relative',
            zIndex: 1,
            padding: recolhidoDesktop && !abertoMobile ? '10px 6px' : '12px 14px'
          }}
          className="shrink-0 space-y-2"
        >
          {/* Botão de Esticar Barra no Rodapé quando recolhido */}
          {recolhidoDesktop && !abertoMobile && onAlternarRecolhidoDesktop && (
            <button
              type="button"
              id="btn-esticar-barra-lateral-rodape"
              onClick={onAlternarRecolhidoDesktop}
              title="Clique para esticar a barra lateral e voltar ao normal"
              className="w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-blue-600/40 hover:bg-blue-600 text-white border border-blue-400/40 transition-all hover:scale-105 cursor-pointer shadow-md"
            >
              <ChevronRight className="w-5 h-5 text-white" />
              <span className="text-[8px] font-bold mt-0.5">Esticar</span>
            </button>
          )}

          {(!recolhidoDesktop || abertoMobile) && (
            <div className="flex items-center justify-between text-[11px] text-[#a5b4fc] font-semibold px-1">
              <span className="truncate max-w-[130px]">{usuario.nome}</span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-300 font-bold">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Ativo
              </span>
            </div>
          )}

          {/* Botão Seta de Recolher Barra no Rodapé quando expandido */}
          {!recolhidoDesktop && !abertoMobile && onAlternarRecolhidoDesktop && (
            <button
              type="button"
              id="btn-recolher-barra-lateral-rodape"
              onClick={onAlternarRecolhidoDesktop}
              title="Recolher barra lateral"
              className="w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-indigo-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer border border-white/10"
            >
              <span className="flex items-center gap-1.5">
                <ChevronLeft className="w-4 h-4 text-white" />
                <span>Recolher Barra</span>
              </span>
              <span className="text-[10px] text-indigo-300 font-medium">Estreitar</span>
            </button>
          )}

          {/* Botão de Acesso Restrito / Bloqueio Admin */}
          {!adminDesbloqueado ? (
            onAbrirJanelaSenhaAdmin && (
              <button
                type="button"
                id="menu-btn-acesso-restrito-admin"
                onClick={onAbrirJanelaSenhaAdmin}
                title="Acesso Restrito do Administrador (com senha)"
                className={`w-full flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer border border-white/10 ${
                  recolhidoDesktop && !abertoMobile ? 'justify-center px-0' : ''
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {(!recolhidoDesktop || abertoMobile) && <span>Acesso Restrito</span>}
              </button>
            )
          ) : (
            onBloquearAdmin && (
              <button
                type="button"
                id="menu-btn-bloquear-admin-lateral"
                onClick={onBloquearAdmin}
                title="Bloquear Modo Administrador"
                className={`w-full flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold transition-colors cursor-pointer border border-rose-500/30 ${
                  recolhidoDesktop && !abertoMobile ? 'justify-center px-0' : ''
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                {(!recolhidoDesktop || abertoMobile) && <span>Bloquear Admin</span>}
              </button>
            )
          )}

          {onLogout && (
            <button
              type="button"
              id="menu-btn-logout"
              onClick={onLogout}
              title="Desconectar do Sistema"
              style={{ fontSize: '13px', color: '#fca5a5' }}
              className={`w-full flex items-center gap-2 py-2 px-2.5 rounded-lg hover:bg-white/10 font-bold transition-colors cursor-pointer ${
                recolhidoDesktop && !abertoMobile ? 'justify-center px-0' : ''
              }`}
            >
              <LogOut className="w-4 h-4 shrink-0 text-[#fca5a5]" />
              {(!recolhidoDesktop || abertoMobile) && <span>Sair do Sistema</span>}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
