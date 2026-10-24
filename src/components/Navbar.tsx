import { useState, useEffect, useRef } from 'react';
import { 
  Building2, FileSpreadsheet, FileCheck, Bot, CreditCard, 
  Crown, LayoutDashboard, Shield, ChevronDown, 
  CalendarCheck, LogOut, User, FileText, Video, Menu, Receipt,
  MoreVertical, Settings, Key, RefreshCw, Calendar, Bell, Users, Database, HelpCircle, X, ExternalLink,
  ShieldCheck, ClipboardCheck, Lock, Unlock
} from 'lucide-react';
import { PLANOS } from '../config/planos';
import { UsuarioAuth } from '../types';
import { ehUsuarioAdmin } from '../config/Permissoes';
import SeletorEmpresaGlobal from './SeletorEmpresaGlobal';
import LicencaBadge from './LicencaBadge';
import ModalCertificadoEmpresa from '../screens/Empresas/ModalCertificadoEmpresa';
import { useEmpresa } from '../context/EmpresaContext';
import ModalConfiguracoesSistema from './ModalConfiguracoesSistema';
import ModalAcessoAdmin from './ModalAcessoAdmin';
import SimboloContabil from './SimboloContabil';
import { useProntidaoSerpro } from './useProntidaoSerpro';

interface NavbarProps {
  abaAtiva: string;
  onSelecionarAba: (aba: string) => void;
  planoAtivoId: 'basico' | 'profissional' | 'empresarial';
  onMudarPlano: (planoId: 'basico' | 'profissional' | 'empresarial') => void;
  usuarioAtual?: UsuarioAuth | null;
  onLogout?: () => void;
  onAbrirPortal?: () => void;
  onToggleMenuLateral?: () => void;
  onAbrirEmails?: () => void;
  adminDesbloqueado?: boolean;
  visaoAdminAtiva?: boolean;
  onDesbloquearAdmin?: () => void;
  onBloquearAdmin?: () => void;
  onAlternarVisaoAdmin?: (visaoAdmin: boolean) => void;
}

export default function Navbar({ 
  abaAtiva, 
  onSelecionarAba, 
  planoAtivoId, 
  onMudarPlano,
  usuarioAtual,
  onLogout,
  onAbrirPortal,
  onToggleMenuLateral,
  onAbrirEmails,
  adminDesbloqueado = false,
  visaoAdminAtiva = false,
  onDesbloquearAdmin,
  onBloquearAdmin,
  onAlternarVisaoAdmin
}: NavbarProps) {
  const { empresaAtiva: empresaAtivaLicenca, empresas: empresasDoContexto } = useEmpresa() as any;
  const prontidaoSerpro = useProntidaoSerpro();
  const faltamSerpro = prontidaoSerpro ? prontidaoSerpro.itens.filter(i => !i.ok) : null;
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [menuConfigAberto, setMenuConfigAberto] = useState(false);
  const [modalConfigAberto, setModalConfigAberto] = useState(false);
  const [modalAdminAberto, setModalAdminAberto] = useState(false);
  const { empresaAtiva, selecionarEmpresa, salvarNovaEmpresa } = useEmpresa();
  const [certModalAberto, setCertModalAberto] = useState(false);
  // Verde só quando o servidor confirma o A1 guardado no cofre; senão laranja (igual ao Fiscal).
  const [certNoServidor, setCertNoServidor] = useState<boolean | null>(null);
  useEffect(() => {
    const idC = (empresaAtiva as any)?.idCentral; const tenant = (empresaAtiva as any)?.tenantIdCentral;
    if (!idC || !tenant) { setCertNoServidor(false); return; }
    let ativo = true;
    setCertNoServidor(null);
    fetch(`/api/companies/${encodeURIComponent(idC)}/fiscal-certificate/status?tenantId=${encodeURIComponent(tenant)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => r.json().catch(() => ({})).then((d) => { if (ativo) setCertNoServidor(r.ok && d.cadastradoNoServidor === true); }))
      .catch(() => { if (ativo) setCertNoServidor(false); });
    return () => { ativo = false; };
  }, [(empresaAtiva as any)?.idCentral, (empresaAtiva as any)?.tenantIdCentral, certModalAberto]);
  const certOk = certNoServidor === true;
  const [avisoCert, setAvisoCert] = useState('');
  const [opcaoConfigAtiva, setOpcaoConfigAtiva] = useState<string>('certificado');

  const refMenuConfig = useRef<HTMLDivElement>(null);
  const refBtnConfig = useRef<HTMLButtonElement>(null);

  const planoAtual = PLANOS[planoAtivoId.toUpperCase()] || PLANOS.EMPRESARIAL;
  // Apenas considera Admin ativo se tiver sido explicitamente desbloqueado com senha
  const estaAdminAtivo = Boolean(adminDesbloqueado && visaoAdminAtiva);

  // Fecha o menu de 3 pontinhos ao clicar fora
  useEffect(() => {
    function handleClickFora(event: MouseEvent) {
      if (
        menuConfigAberto &&
        refMenuConfig.current &&
        !refMenuConfig.current.contains(event.target as Node) &&
        refBtnConfig.current &&
        !refBtnConfig.current.contains(event.target as Node)
      ) {
        setMenuConfigAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, [menuConfigAberto]);

  // Permite que qualquer botão do sistema abra a janela de senha do admin
  useEffect(() => {
    const handleAbrirJanelaSenha = () => {
      setModalAdminAberto(true);
    };
    window.addEventListener('abrir_modal_senha_admin', handleAbrirJanelaSenha);
    return () => window.removeEventListener('abrir_modal_senha_admin', handleAbrirJanelaSenha);
  }, []);

  const abrirCertificado = () => {
    setMenuConfigAberto(false);
    if (!empresaAtiva) { setAvisoCert('Escolha ou cadastre uma empresa para colocar o certificado digital.'); window.setTimeout(() => setAvisoCert(''), 5000); return; }
    setCertModalAberto(true);
  };
  useEffect(() => {
    const abrir = () => abrirCertificado();
    window.addEventListener('murade_abrir_certificado', abrir);
    return () => window.removeEventListener('murade_abrir_certificado', abrir);
  });
  const handleAbrirOpcaoConfig = (opcao: string) => {
    if (opcao === 'certificado') { abrirCertificado(); return; }
    setOpcaoConfigAtiva(opcao);
    setMenuConfigAberto(false);
    setModalConfigAberto(true);
  };

  // 🔒 Define os itens de navegação superior respeitando o perfil:
  // - Murade Master (Admin Desbloqueado e na visão admin): vê Painel Murade + Planos
  // - Cliente / Contador: Início, Empresas, Fiscal, CND, Guias, Procuração, IA Fiscal, Vídeo Aulas, Minha Conta (100% LIMPO)
  const itensNav = [
    { id: 'dashboard', rotulo: 'Início', icone: LayoutDashboard },
    { id: 'empresas', rotulo: 'Empresas', icone: Building2 },
    { id: 'agenda', rotulo: 'Fiscal', icone: CalendarCheck },
    { id: 'cnd', rotulo: 'CND', icone: ShieldCheck },
    { id: 'dctfweb', rotulo: 'Guias', icone: Receipt },
    { id: 'procuracao', rotulo: 'Procuração', icone: FileCheck },
    { id: 'iaFiscal', rotulo: 'IA Fiscal', icone: Bot },
    { id: 'videoAulas', rotulo: 'Vídeo Aulas', icone: Video },
    { id: 'minhaConta', rotulo: 'Minha Conta', icone: User },
    ...(estaAdminAtivo ? [
      { id: 'planos', rotulo: 'Planos', icone: CreditCard },
      { id: 'admin', rotulo: '👑 Painel MURADE', icone: Crown, destaque: true }
    ] : [])
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {usuarioAtual && (
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 bg-slate-950 px-4 py-1 text-xs text-white">
          <span>Conta: <strong>{usuarioAtual.nome}</strong> · {Array.isArray(empresasDoContexto) ? empresasDoContexto.length : 0} empresa(s) autorizada(s)</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" id="btn-certificado-barra" onClick={abrirCertificado} title="Colocar ou atualizar o certificado digital A1 da empresa ativa" className={`flex items-center gap-1.5 rounded px-3 py-1 font-semibold cursor-pointer ${certOk ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-amber-600 hover:bg-amber-700'}`}><Lock className="w-3 h-3" />{certOk ? `Certificado ${empresaAtiva?.certificado?.tipo || 'A1'}` : certNoServidor === null ? 'Verificando…' : 'Colocar Certificado'}</button>
            <button type="button" onClick={() => onSelecionarAba(estaAdminAtivo ? 'admin' : 'minhaConta')} className="rounded bg-white/15 px-3 py-1 hover:bg-white/25 cursor-pointer">Usuários e licenças</button>
            {onLogout && <button type="button" onClick={onLogout} className="rounded bg-white/15 px-3 py-1 hover:bg-white/25 cursor-pointer">Sair</button>}
          </div>
        </div>
      )}
      {/* Barra de Status do Sistema */}
      <div className="bg-slate-900 text-slate-300 text-[11px] py-1.5 px-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
          <span className="font-black text-white tracking-wide">Murade Fisco IA</span>
          <span className="text-slate-500">•</span>
          <span className="hidden sm:inline">Ferramentas de apoio fiscal com IA</span>
          <span className="text-slate-500 hidden sm:inline">•</span>
          <strong className="text-[#F2D26E] font-bold">Ambiente de gestão MURADE</strong>
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-slate-400 text-[11px]">
          {usuarioAtual ? (
            <span className="text-slate-300 flex items-center gap-1.5 mr-1">
              <User className={`w-3.5 h-3.5 ${estaAdminAtivo ? 'text-amber-400' : 'text-indigo-400'}`} />
              <span className="hidden sm:inline">Conectado:</span> 
              <strong className="text-white truncate max-w-[140px] sm:max-w-[200px]">{usuarioAtual.nome}</strong>
              {estaAdminAtivo ? (
                <span className="bg-amber-400/20 text-amber-300 px-1.5 py-0.2 rounded text-[9px] font-black uppercase">
                  MASTER
                </span>
              ) : (
                <span className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase">
                  CLIENTE
                </span>
              )}
            </span>
          ) : (
            <span className="hidden lg:inline">Capacidade: <strong>Até 500 CNPJs</strong></span>
          )}

          {/* Badges de Conexão SERPRO & e-CAC */}
          <button
            type="button"
            onClick={() => onSelecionarAba('serpro')}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900 transition-all cursor-pointer shadow-xs"
            title={faltamSerpro && faltamSerpro.length > 0 ? `Falta configurar no servidor: ${faltamSerpro.map(i => i.descricao).join('; ')}` : faltamSerpro ? 'Variáveis do SERPRO presentes no servidor. A autenticação é testada na tela Integração SERPRO.' : 'A conexão com o SERPRO ainda não foi validada pelo sistema'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${faltamSerpro && faltamSerpro.length === 0 ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            <span className="font-bold text-[10px] tracking-wide">{faltamSerpro ? (faltamSerpro.length === 0 ? 'SERPRO: configurado' : `SERPRO: faltam ${faltamSerpro.length} item(ns)`) : 'SERPRO: Não validado'}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelecionarAba('procuracao')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900 transition-all cursor-pointer shadow-xs"
            title="A integração com e-CAC ainda não foi validada pelo sistema"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span className="font-bold text-[10px] tracking-wide">e-CAC: Não validado</span>
          </button>
        </div>
      </div>

      {/* Barra Principal */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between min-h-16 py-1 gap-x-3 gap-y-1">
          {/* Botão Hambúrguer para Menu Lateral + Logo & Marca */}
          <div className="flex items-center gap-2 sm:gap-3">
            {onToggleMenuLateral && (
              <button
                type="button"
                id="btn-toggle-menu-lateral"
                onClick={onToggleMenuLateral}
                title="Abrir/Fechar Menu Lateral"
                className="p-2 text-slate-700 hover:text-indigo-900 bg-slate-100 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <div 
              onClick={() => onSelecionarAba('dashboard')}
              className="flex items-center gap-2.5 cursor-pointer select-none group"
            >
              {/* 🏛️ SÍMBOLO CONTÁBIL (Colunas + Cobra + Cifrão) NO LUGAR DO ESCUDO */}
              <SimboloContabil tamanho="md" comBrilho={true} />

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Murade Fisco IA</span>
                </div>
                <p className="text-[10.5px] text-slate-500 -mt-0.5 font-medium hidden sm:block">
                  Ferramentas de apoio fiscal com IA
                </p>
              </div>
            </div>

            {onAbrirPortal && (
              <button
                type="button"
                onClick={onAbrirPortal}
                className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-900 hover:bg-indigo-100"
                title="Abrir portal com os sistemas liberados para esta conta"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Meus sistemas
              </button>
            )}

            {/* ✅ OS 3 PONTINHOS — CONFIGURAÇÕES DO SISTEMA */}
            <div className="relative">
              <button
                type="button"
                id="btn-config"
                ref={refBtnConfig}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuConfigAberto(!menuConfigAberto);
                }}
                className="p-1.5 text-slate-500 hover:text-indigo-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-xl leading-none font-bold select-none"
                title="Configurações do Sistema (3 Pontinhos)"
              >
                <span>⋮</span>
              </button>

              {/* MENU QUE ABRE AO CLICAR NOS 3 PONTINHOS */}
              {menuConfigAberto && (
                <div
                  id="menu-config"
                  ref={refMenuConfig}
                  className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800"
                >
                  <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider">⚙️ Configurações</h4>
                    </div>
                    <button
                      type="button"
                      id="fechar-config"
                      onClick={() => setMenuConfigAberto(false)}
                      className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-xs text-white cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="p-1.5 space-y-0.5 max-h-[380px] overflow-y-auto">
                    {[
                      { id: 'certificado', rotulo: '🔐 Certificado Digital' },
                      { id: 'conexao', rotulo: '🔌 Conexão com SERPRO / e-CAC' },
                      { id: 'empresa', rotulo: '🏢 Dados da Empresa Principal' },
                      { id: 'agenda', rotulo: '📅 Calendário e Prazos' },
                      { id: 'notificacoes', rotulo: '🔔 Notificações e Alertas' },
                      { id: 'usuario', rotulo: '👤 Usuários e Permissões' },
                      { id: 'backup', rotulo: '💾 Backup e Exportação' },
                      { id: 'atualizacao', rotulo: '🔄 Atualização do Sistema' },
                      { id: 'ajuda', rotulo: '❓ Ajuda e Suporte' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        data-opcao={item.id}
                        onClick={() => handleAbrirOpcaoConfig(item.id)}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:text-indigo-900 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <span>{item.rotulo}</span>
                      </button>
                    ))}

                    {onAbrirEmails && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuConfigAberto(false);
                          onAbrirEmails();
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:text-indigo-900 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <span>📬 Histórico de E-mails do Sistema</span>
                      </button>
                    )}

                    <div className="border-t border-slate-100 pt-1 mt-1">
                      <a
                        href="/fiscoia-v1/index.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-left px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer flex items-center justify-between"
                      >
                        <span>🖥️ Abrir fiscoia-v1 (HTML)</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Links de Navegação Desktop (Respeitam as permissões) */}
          <nav className="hidden xl:flex items-center gap-1">
            {itensNav.map((item) => {
              const Icone = item.icone;
              const isAtivo = abaAtiva === item.id || (item.id === 'dctfweb' && (abaAtiva === 'guiasINSS' || abaAtiva === 'consultaGuias'));
              return (
                <button
                  key={item.id}
                  id={`nav-link-${item.id}`}
                  onClick={() => onSelecionarAba(item.id)}
                  className={`px-2.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isAtivo
                      ? item.destaque
                        ? 'bg-amber-100 text-amber-950 border border-amber-300'
                        : 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                      : item.destaque
                      ? 'text-amber-800 hover:bg-amber-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icone className={`w-3.5 h-3.5 ${isAtivo ? 'text-indigo-600' : 'text-slate-500'}`} />
                  <span>{item.rotulo}</span>
                </button>
              );
            })}
          </nav>

          {/* Ações Direitas: Seletor de Empresa Global, Seletor de Plano & Sessão */}
          <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
            {/* 🏢 Seletor de Empresa Selecionada em TODAS as partes */}
            <SeletorEmpresaGlobal onCadastrarNova={() => onSelecionarAba('cadastro-empresa')} />
            <LicencaBadge cnpj={empresaAtivaLicenca?.cnpj} />

            {/* 🔐 Certificado digital da empresa ativa (igual ao Fiscal) */}
            <button
              type="button"
              id="btn-certificado-topo"
              onClick={abrirCertificado}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white font-bold text-xs cursor-pointer transition-colors shadow-xs ${certOk ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-amber-600 hover:bg-amber-700'}`}
              title="Colocar ou atualizar o certificado digital A1 da empresa ativa"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{certOk ? `Certificado ${empresaAtiva?.certificado?.tipo || 'A1'}` : certNoServidor === null ? 'Verificando…' : 'Colocar Certificado'}</span>
            </button>

            {/* Seletor de Nível / Visualizador de Plano */}
            <div className="relative hidden sm:block">
              <button
                type="button"
                id="btn-seletor-plano-ativo"
                onClick={() => setDropdownAberto(!dropdownAberto)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs cursor-pointer transition-colors"
              >
                <div className="text-left">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">Perfil local</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1">
                    {planoAtual.nome} · assinatura não verificada
                  </span>
                </div>
                {estaAdminAtivo && <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </button>

              {estaAdminAtivo && dropdownAberto && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 block">
                    Alternar Nível de Permissão (Murade):
                  </span>
                  {(['basico', 'profissional', 'empresarial'] as const).map((pId) => {
                    const pInfo = PLANOS[pId.toUpperCase()];
                    return (
                      <button
                        key={pId}
                        onClick={() => {
                          onMudarPlano(pId);
                          setDropdownAberto(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-between ${
                          planoAtivoId === pId 
                            ? 'bg-indigo-50 font-bold text-indigo-900' 
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div>
                          <span className="block font-semibold">{pInfo.nome}</span>
                          <span className="text-[10px] text-slate-400">Até {pInfo.maxCnpjs} CNPJs</span>
                        </div>
                        {planoAtivoId === pId && <span className="text-emerald-600 font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 🔐 JANELINHA / CONTROLE DE ACESSO DO ADMINISTRADOR */}
            {!adminDesbloqueado ? (
              <button
                type="button"
                id="btn-janelinha-admin-senha"
                onClick={() => setModalAdminAberto(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 hover:text-indigo-900 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Acesso exclusivo da Diretoria Murade com senha"
              >
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Acesso Admin</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 p-1 rounded-xl shadow-2xs">
                <button
                  type="button"
                  id="btn-toggle-visao-admin"
                  onClick={() => {
                    if (onAlternarVisaoAdmin) onAlternarVisaoAdmin(!visaoAdminAtiva);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    visaoAdminAtiva 
                      ? 'bg-amber-400 text-slate-950 font-black shadow-2xs' 
                      : 'bg-white text-slate-700 hover:bg-amber-100 border border-amber-200'
                  }`}
                  title="Alternar entre visualização do Administrador e visualização limpa do Cliente"
                >
                  {visaoAdminAtiva ? (
                    <>
                      <Crown className="w-3.5 h-3.5 text-slate-950" />
                      <span className="hidden md:inline">👑 Painel Master</span>
                      <span className="md:hidden">👑 Master</span>
                    </>
                  ) : (
                    <>
                      <User className="w-3.5 h-3.5 text-indigo-700" />
                      <span className="hidden md:inline">👁️ Visão Cliente</span>
                      <span className="md:hidden">👁️ Cliente</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="btn-config-senha-admin"
                  onClick={() => setModalAdminAberto(true)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-amber-100/80 transition-colors cursor-pointer text-xs"
                  title="Configurar senha ou opções do administrador"
                >
                  <Key className="w-3.5 h-3.5 text-amber-700" />
                </button>

                <button
                  type="button"
                  id="btn-bloquear-admin"
                  onClick={() => {
                    if (onBloquearAdmin) onBloquearAdmin();
                  }}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                  title="Bloquear Acesso Admin e voltar 100% para a visão do cliente"
                >
                  <Lock className="w-3.5 h-3.5 text-rose-600" />
                </button>
              </div>
            )}

            {onLogout && (
              <button
                type="button"
                id="btn-navbar-logout"
                onClick={onLogout}
                title="Desconectar ou Trocar de Conta"
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Navegação Mobile com rolagem horizontal para telas menores */}
        <div className="xl:hidden flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-100 scrollbar-none">
          {itensNav.map((item) => {
            const Icone = item.icone;
            const isAtivo = abaAtiva === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelecionarAba(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  isAtivo 
                    ? item.destaque 
                      ? 'bg-amber-400 text-slate-950 font-black' 
                      : 'bg-indigo-600 text-white' 
                    : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                }`}
              >
                <Icone className="w-3.5 h-3.5" />
                <span>{item.rotulo}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal de Configurações do Sistema */}
      <ModalConfiguracoesSistema
        aberto={modalConfigAberto}
        onFechar={() => setModalConfigAberto(false)}
        abaInicial={opcaoConfigAtiva}
        usuarioAtual={usuarioAtual}
        onNavegar={(destino) => {
          onSelecionarAba(destino);
          setModalConfigAberto(false);
        }}
      />

      {/* 🔐 Janelinha de Acesso com Senha do Administrador Master (Restrito Murade) */}
      <ModalAcessoAdmin
        aberto={modalAdminAberto}
        onFechar={() => setModalAdminAberto(false)}
        adminDesbloqueado={adminDesbloqueado}
        onDesbloquear={() => {
          if (onDesbloquearAdmin) onDesbloquearAdmin();
        }}
        onBloquear={() => {
          if (onBloquearAdmin) onBloquearAdmin();
        }}
        onNavegarAdmin={(aba) => {
          onSelecionarAba(aba);
        }}
      />
      {avisoCert && <div role="alert" className="fixed top-16 right-4 z-[200] rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold px-4 py-2 shadow-lg">{avisoCert}</div>}
      {certModalAberto && empresaAtiva && (
        <ModalCertificadoEmpresa
          empresa={empresaAtiva}
          onFechar={() => setCertModalAberto(false)}
          onSalvarCertificado={async (atualizada) => {
            const salva = salvarNovaEmpresa(atualizada);
            if (!salva) throw new Error('O certificado foi confirmado no servidor, mas a referência local não pôde ser atualizada. Atualize a tela; ele permanece salvo no servidor.');
            selecionarEmpresa(salva);
            setCertModalAberto(false);
          }}
          onAbrirCadastroCompleto={() => { setCertModalAberto(false); onSelecionarAba('empresas'); }}
        />
      )}
    </header>

  );
}
