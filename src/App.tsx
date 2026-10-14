import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MenuLateral from './components/MenuLateral';
import DashboardFiscal from './screens/Dashboard/DashboardFiscal';
import AgendaFiscalScreen from './screens/AgendaFiscal/AgendaFiscalScreen';
import GuiasINSSScreen from './screens/GuiasINSSScreen';
import ConsultaGuiasReceita from './screens/ConsultaGuiasReceita';
import ProcuracaoScreen from './screens/Procuracao/ProcuracaoScreen';
import EmpresasScreen from './screens/Empresas/EmpresasScreen';
import PlanosAssinatura from './screens/PlanosAssinatura';
import AdminDashboard from './screens/AdminMurade/AdminDashboard';
import VideoAulasScreen from './screens/VideoAulas/VideoAulasScreen';
import MinhaContaScreen from './screens/MinhaConta/MinhaContaScreen';
import LoginScreen from './screens/Auth/LoginScreen';
import TrocarSenhaPrimeiroAcessoScreen from './screens/Auth/TrocarSenhaPrimeiroAcessoScreen';
import RecuperarSenhaScreen from './screens/Auth/RecuperarSenhaScreen';
import RedefinirSenhaScreen from './screens/Auth/RedefinirSenhaScreen';
import CadastroEmpresaScreen from './screens/CadastroEmpresa';
import GeracaoGuiasScreen from './screens/GeracaoGuiasScreen';
import SerproHomologacaoScreen from './screens/Serpro/SerproHomologacaoScreen';
import CNDScreen from './screens/CND/CNDScreen';
import OrgaosPublicosScreen from './screens/OrgaosPublicos/OrgaosPublicosScreen';
import PainelStatusEmpresas from './screens/Dashboard/PainelStatusEmpresas';
import { ConfiguracaoIntegracaoScreen } from './screens/Configuracao/ConfiguracaoIntegracaoScreen';
import { AutomacaoFiscalScreen } from './screens/AutomacaoFiscal/AutomacaoFiscalScreen';
import { ModuloFiscalScreen } from './screens/Fiscal/ModuloFiscalScreen';
import { ModulosMuradeScreen } from './screens/ModulosMuradeScreen';
import { IaMuradVozScreen } from './screens/IaVoz/IaMuradVozScreen';
import { ModalCalculadoraFiscal } from './components/ModalCalculadoraFiscal';
import { PainelAnimadoLateral } from './components/PainelAnimadoLateral';
import { obterSessaoAtual, logout, obterEmailsEnviados, EmailEnviadoLog } from './services/auth/auth.service';
import { UsuarioAuth, EmpresaDados } from './types';
import { ehUsuarioAdmin, TIPOS_USUARIO } from './config/Permissoes';
import { AlertCircle, ShieldCheck, Mail, LogIn, Key, X, ShieldAlert, ClipboardCheck } from 'lucide-react';
import { NavigationProvider } from './context/NavigationContext';

export default function App() {
  const [abaAtiva, setAbaAtiva] = useState<string>('dashboard');
  const [planoAtivoId, setPlanoAtivoId] = useState<'basico' | 'profissional' | 'empresarial'>('empresarial');
  const [mostrarAvisoVencimento, setMostrarAvisoVencimento] = useState(false);
  const [avisoRestricaoAdmin, setAvisoRestricaoAdmin] = useState<string | null>(null);
  const [empresaParaGuias, setEmpresaParaGuias] = useState<EmpresaDados | null>(null);

  // Estados do Menu Lateral que se esconde sozinho
  const [menuLateralAbertoMobile, setMenuLateralAbertoMobile] = useState(false);
  const [menuLateralRecolhidoDesktop, setMenuLateralRecolhidoDesktop] = useState(false);

  // Estados de Autenticação & Sessão
  const [usuarioAtual, setUsuarioAtual] = useState<UsuarioAuth | null>(() => {
    // Inicializa com a sessão salva ou Master Admin Murade limpo
    const salvo = obterSessaoAtual();
    if (salvo) return salvo;
    return {
      id: 'user-admin',
      nome: 'Diretoria Murad Master',
      email: 'noslyneda.murad@gmail.com',
      telefone: '',
      cpfCnpj: '',
      crc: '',
      idPlano: 'empresarial',
      nomePlano: 'Plano Empresarial (Até 500 CNPJs)',
      dataVencimento: '31/12/2030',
      primeiroAcesso: false,
      ativo: true,
      ehAdmin: true,
      tipo: 'ADMIN'
    };
  });

  const [modoAuth, setModoAuth] = useState<'app' | 'login' | 'primeiro_acesso' | 'recuperar' | 'redefinir'>('app');
  const [emailPrimeiroAcesso, setEmailPrimeiroAcesso] = useState('');
  const [emailRecuperacao, setEmailRecuperacao] = useState('');
  const [tokenRedefinicao, setTokenRedefinicao] = useState('');
  const [modalEmailsAberto, setModalEmailsAberto] = useState(false);
  const [emailsEnviados, setEmailsEnviados] = useState<EmailEnviadoLog[]>([]);

  // Estado da Calculadora Fiscal Flutuante e Módulo Fiscal Completo
  const [modalCalculadoraAberto, setModalCalculadoraAberto] = useState(false);
  const [subAbaFiscal, setSubAbaFiscal] = useState<'saida' | 'entrada' | 'baixa' | 'apuracao' | 'calculadora'>('saida');

  // 🔐 CONTROLE DO ACESSO ADMIN MASTER (Oculto do Cliente por padrão)
  const [adminDesbloqueado, setAdminDesbloqueado] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('murade_admin_desbloqueado') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [visaoAdminAtiva, setVisaoAdminAtiva] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('murade_admin_visao_ativa') === 'true';
    } catch (e) {
      return false;
    }
  });

  // Somente considera o modo Admin como ativo se a senha tiver sido validada E a visão estiver em Admin
  const estaAdminAtivo = Boolean(adminDesbloqueado && visaoAdminAtiva);
  const isAdmin = estaAdminAtivo;

  const handleDesbloquearAdmin = () => {
    setAdminDesbloqueado(true);
    setVisaoAdminAtiva(true);
    try {
      sessionStorage.setItem('murade_admin_desbloqueado', 'true');
      sessionStorage.setItem('murade_admin_visao_ativa', 'true');
    } catch (e) {}
  };

  const handleBloquearAdmin = () => {
    setAdminDesbloqueado(false);
    setVisaoAdminAtiva(false);
    try {
      sessionStorage.removeItem('murade_admin_desbloqueado');
      sessionStorage.removeItem('murade_admin_visao_ativa');
    } catch (e) {}
    // Se o usuário estiver numa aba exclusiva de admin, volta imediatamente para o início do cliente
    const abasExclusivasMurade = ['admin', 'admin_faturamento', 'admin_bloqueio', 'admin_precos', 'planos'];
    if (abasExclusivasMurade.includes(abaAtiva)) {
      setAbaAtiva('dashboard');
    }
  };

  const handleAlternarVisaoAdmin = (novaVisao: boolean) => {
    setVisaoAdminAtiva(novaVisao);
    try {
      sessionStorage.setItem('murade_admin_visao_ativa', String(novaVisao));
    } catch (e) {}
    if (!novaVisao) {
      const abasExclusivasMurade = ['admin', 'admin_faturamento', 'admin_bloqueio', 'admin_precos', 'planos'];
      if (abasExclusivasMurade.includes(abaAtiva)) {
        setAbaAtiva('dashboard');
      }
    }
  };

  useEffect(() => {
    if (modalEmailsAberto) {
      setEmailsEnviados(obterEmailsEnviados());
    }
  }, [modalEmailsAberto]);

  // Navegação com proteção estrita de acesso e suporte abrangente a aliases
  const handleNavegacao = (novaAba: string) => {
    if (!novaAba) {
      setAbaAtiva('dashboard');
      return;
    }

    const d = novaAba.toLowerCase().replace(/[-_]/g, '');
    let destino = novaAba;

    if (d === 'calculadora' || d === 'calculadorafiscal') {
      setModalCalculadoraAberto(true);
      return;
    }

    if (['dctfweb', 'consultaguias', 'guiasreceita', 'receita', 'rfb', 'ecac'].includes(d)) {
      destino = 'dctfweb';
    } else if (['guiasinss', 'inss', 'esocial', 'previdencia'].includes(d)) {
      destino = 'guiasINSS';
    } else if (['cnd', 'certidoes', 'certidoesnegativas', 'pgfn'].includes(d)) {
      destino = 'cnd';
    } else if (['guias', 'geracaoguias', 'fgts', 'fgtsdigital', 'caixa', 'mte'].includes(d)) {
      destino = 'guias';
    } else if (['serpro', 'integracontador', 'homologacao'].includes(d)) {
      destino = 'serpro';
    } else if (['procuracao', 'procuracaoecac'].includes(d)) {
      destino = 'procuracao';
    } else if (['orgaospublicos', 'orgaos', 'portalorgaos'].includes(d)) {
      destino = 'orgaos_publicos';
    } else if (['agenda', 'agendafiscal'].includes(d)) {
      destino = 'agenda';
    } else if (['empresas', 'clientes', 'listarempresas'].includes(d)) {
      destino = 'empresas';
    } else if (['cadastroempresa', 'cadastrarempresa', 'novaempresa'].includes(d)) {
      destino = 'cadastro-empresa';
    } else if (['inicio', 'dashboard', 'home'].includes(d)) {
      destino = 'dashboard';
    } else if (['conta', 'minhaconta', 'perfil', 'usuario'].includes(d)) {
      destino = 'minhaConta';
    } else if (['videoaulas', 'tutoriais', 'aulas', 'videos'].includes(d)) {
      destino = 'videoAulas';
    } else if (['ia', 'iafiscal', 'iavoz', 'voz', 'vozmurad', 'elevenlabs'].includes(d)) {
      destino = 'iaVoz';
    } else if (['configuracao', 'integracao', 'config'].includes(d)) {
      destino = 'configuracao';
    } else if (['automacao', 'automacaofiscal', 'fiasco', 'robo'].includes(d)) {
      destino = 'automacaoFiscal';
    } else if (['fiscal', 'modulofiscal', 'nfesaida', 'nfeentrada', 'baixanotas', 'apuracao'].includes(d)) {
      if (d === 'nfesaida') setSubAbaFiscal('saida');
      else if (d === 'nfeentrada') setSubAbaFiscal('entrada');
      else if (d === 'baixanotas') setSubAbaFiscal('baixa');
      else if (d === 'apuracao') setSubAbaFiscal('apuracao');
      else setSubAbaFiscal('saida');
      destino = 'fiscal';
    }

    const abasExclusivasMurade = ['admin', 'admin_faturamento', 'admin_bloqueio', 'admin_precos', 'admin_senhas', 'admin_seguranca', 'planos'];
    if (abasExclusivasMurade.includes(destino) && !estaAdminAtivo) {
      setAvisoRestricaoAdmin('⚠️ Acesso restrito! O Painel Murade e módulos administrativos exigem validação com senha pelo botão "Acesso Admin".');
      setAbaAtiva('dashboard');
      setTimeout(() => setAvisoRestricaoAdmin(null), 5000);
      return;
    }
    setAvisoRestricaoAdmin(null);
    setAbaAtiva(destino);
  };

  // Handlers de Auth
  const handleLoginSucesso = (usuario: UsuarioAuth) => {
    setUsuarioAtual(usuario);
    setPlanoAtivoId(usuario.idPlano);
    setModoAuth('app');
    setAbaAtiva('dashboard');
  };

  const handleLogout = () => {
    logout();
    setUsuarioAtual(null);
    setModoAuth('login');
  };

  const handlePedirPrimeiroAcesso = (email: string) => {
    setEmailPrimeiroAcesso(email);
    setModoAuth('primeiro_acesso');
  };

  const handleSenhaAlteradaPrimeiroAcesso = (usuario: UsuarioAuth) => {
    setUsuarioAtual(usuario);
    setPlanoAtivoId(usuario.idPlano);
    setModoAuth('app');
  };

  const handleAbrirRedefinicao = (token: string) => {
    setTokenRedefinicao(token);
    setModoAuth('redefinir');
  };

  // 🔑 Fluxos de Autenticação Especiais (Acessíveis mesmo sem sessão de usuário ativa)
  if (modoAuth === 'recuperar') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans">
        <main className="flex-1 flex items-center justify-center p-4">
          <RecuperarSenhaScreen
            emailInicial={emailRecuperacao}
            onVoltarLogin={() => setModoAuth('login')}
            onAbrirRedefinicao={handleAbrirRedefinicao}
          />
        </main>
        <footer className="py-4 text-center text-xs text-slate-400">
          FISCOIA © 2026 • Administrado por MURADE
        </footer>
      </div>
    );
  }

  if (modoAuth === 'redefinir') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans">
        <main className="flex-1 flex items-center justify-center p-4">
          <RedefinirSenhaScreen
            token={tokenRedefinicao}
            onVoltarLogin={() => setModoAuth('login')}
          />
        </main>
        <footer className="py-4 text-center text-xs text-slate-400">
          FISCOIA © 2026 • Administrado por MURADE
        </footer>
      </div>
    );
  }

  if (modoAuth === 'primeiro_acesso') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans">
        <main className="flex-1 flex items-center justify-center p-4">
          <TrocarSenhaPrimeiroAcessoScreen
            email={emailPrimeiroAcesso || usuarioAtual?.email || ''}
            onSenhaAlterada={handleSenhaAlteradaPrimeiroAcesso}
            onCancelar={() => setModoAuth('login')}
          />
        </main>
        <footer className="py-4 text-center text-xs text-slate-400">
          FISCOIA © 2026 • Administrado por MURADE
        </footer>
      </div>
    );
  }

  // Se não houver usuário logado ou estiver explicitamente em modo login
  if (modoAuth === 'login' || !usuarioAtual) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans">
        <div className="p-4 flex items-center justify-between max-w-5xl mx-auto w-full">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>FISCOIA • Portal de Acesso do Contador</span>
          </div>

          <button
            type="button"
            onClick={() => setModalEmailsAberto(true)}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-indigo-700 hover:bg-indigo-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Ver E-mails Enviados pelo Sistema</span>
          </button>
        </div>

        <main className="flex-1 flex items-center justify-center p-4">
          <LoginScreen
            onLoginSucesso={handleLoginSucesso}
            onPedirPrimeiroAcesso={handlePedirPrimeiroAcesso}
            onEsqueciSenha={(emailDigitado) => {
              if (emailDigitado) setEmailRecuperacao(emailDigitado);
              setModoAuth('recuperar');
            }}
          />
        </main>

        <footer className="py-4 text-center text-xs text-slate-400">
          FISCOIA © 2026 • Administrado por MURADE
        </footer>

        {/* Modal de E-mails Enviados pelo Sistema */}
        {modalEmailsAberto && (
          <ModalEmailsEnviados
            emails={emailsEnviados}
            onFechar={() => setModalEmailsAberto(false)}
            onTestarRedefinicao={(tok) => {
              setModalEmailsAberto(false);
              handleAbrirRedefinicao(tok);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <NavigationProvider abaAtual={abaAtiva} onMudarAba={handleNavegacao}>
      <div id="fiscoia-app" className="min-h-screen bg-slate-50 text-slate-900 flex font-sans antialiased">
        {/* 📱💻 Menu Lateral que se esconde sozinho */}
        <MenuLateral
          abaAtiva={abaAtiva}
          onSelecionarAba={handleNavegacao}
          usuarioAtual={usuarioAtual}
          onLogout={handleLogout}
          abertoMobile={menuLateralAbertoMobile}
          onFecharMobile={() => setMenuLateralAbertoMobile(false)}
          recolhidoDesktop={menuLateralRecolhidoDesktop}
          onAlternarRecolhidoDesktop={() => setMenuLateralRecolhidoDesktop(!menuLateralRecolhidoDesktop)}
          adminDesbloqueado={adminDesbloqueado}
          visaoAdminAtiva={visaoAdminAtiva}
          onAlternarVisaoAdmin={handleAlternarVisaoAdmin}
          onAbrirJanelaSenhaAdmin={() => {
            window.dispatchEvent(new CustomEvent('abrir_modal_senha_admin'));
          }}
          onBloquearAdmin={handleBloquearAdmin}
        />

        {/* Área Principal de Conteúdo */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Navbar Superior com Toggle do Menu Lateral e Janelinha de Senha Admin */}
          <Navbar
            abaAtiva={abaAtiva}
            onSelecionarAba={handleNavegacao}
            planoAtivoId={planoAtivoId}
            onMudarPlano={setPlanoAtivoId}
            usuarioAtual={usuarioAtual}
            onLogout={handleLogout}
            onAbrirEmails={() => setModalEmailsAberto(true)}
            adminDesbloqueado={adminDesbloqueado}
            visaoAdminAtiva={visaoAdminAtiva}
            onDesbloquearAdmin={handleDesbloquearAdmin}
            onBloquearAdmin={handleBloquearAdmin}
            onAlternarVisaoAdmin={handleAlternarVisaoAdmin}
            onToggleMenuLateral={() => {
              if (window.innerWidth >= 768) {
                setMenuLateralRecolhidoDesktop(!menuLateralRecolhidoDesktop);
              } else {
                setMenuLateralAbertoMobile(!menuLateralAbertoMobile);
              }
            }}
          />

          {/* Alerta de Restrição Administrativa */}
          {avisoRestricaoAdmin && (
            <div className="bg-rose-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between border-b border-rose-700 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-300" />
                <span>{avisoRestricaoAdmin}</span>
              </div>
              <button
                onClick={() => setAvisoRestricaoAdmin(null)}
                className="text-white hover:text-rose-200 p-1 text-xs cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Banner de Aviso de Vencimento / Bloqueio Automático (configurável) */}
          {mostrarAvisoVencimento && (
            <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-semibold flex items-center justify-between border-b border-amber-600">
              <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
                <AlertCircle className="w-4 h-4 text-slate-950 shrink-0" />
                <span>
                  <strong>Aviso Financeiro:</strong> Sua mensalidade vence em 7 dias. O bloqueio automático de CNPJs ocorre após 5 dias de atraso.
                </span>
              </div>
              <button
                onClick={() => setMostrarAvisoVencimento(false)}
                className="text-slate-950 hover:text-white p-1 text-xs cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Conteúdo Principal */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
            {abaAtiva === 'dashboard' && (
              <DashboardFiscal
                planoAtivoId={planoAtivoId}
                onNavegar={handleNavegacao}
              />
            )}

            {abaAtiva === 'conformidade' && (
              <div className="space-y-5">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <ClipboardCheck className="w-6 h-6 text-indigo-600" />
                      Relatório de Conformidade de Todas as Empresas
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                      Visualização horizontal completa da carteira: Envio de dados, transmissão DCTFWeb e emissão de CNDs de cada cliente.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleNavegacao('dashboard')}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      ← Início
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavegacao('cadastro-empresa')}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
                    >
                      + Cadastrar Cliente
                    </button>
                  </div>
                </div>

                <PainelStatusEmpresas onNavegar={handleNavegacao} />
              </div>
            )}

            {abaAtiva === 'agenda' && (
              <AgendaFiscalScreen />
            )}

            {abaAtiva === 'cnd' && (
              <CNDScreen 
                onVoltar={() => handleNavegacao('dashboard')} 
                onNavegar={handleNavegacao}
              />
            )}

            {(abaAtiva === 'dctfweb' || abaAtiva === 'consultaGuias' || abaAtiva === 'consulta-guias' || abaAtiva === 'rfb' || abaAtiva === 'receita') && (
              <ConsultaGuiasReceita
                onVoltar={() => handleNavegacao('dashboard')}
              />
            )}

            {(abaAtiva === 'guiasINSS' || abaAtiva === 'guias-inss' || abaAtiva === 'inss') && (
              <GuiasINSSScreen
                onVoltar={() => handleNavegacao('dashboard')}
              />
            )}

            {(abaAtiva === 'orgaos_publicos' || abaAtiva === 'orgaos') && (
              <OrgaosPublicosScreen
                onVoltar={() => handleNavegacao('dashboard')}
                onNavegar={handleNavegacao}
              />
            )}

            {abaAtiva === 'procuracao' && (
              <ProcuracaoScreen
                planoAtivoId={planoAtivoId}
                onIrParaPlanos={() => handleNavegacao(isAdmin ? 'planos' : 'minhaConta')}
              />
            )}

            {abaAtiva === 'serpro' && (
              <SerproHomologacaoScreen
                onVoltar={() => handleNavegacao('dashboard')}
                onNavegar={(destino) => handleNavegacao(destino)}
              />
            )}

            {abaAtiva === 'guias' && (
              <GeracaoGuiasScreen
                empresaInicial={empresaParaGuias || undefined}
                onVoltar={() => handleNavegacao('dashboard')}
              />
            )}

            {abaAtiva === 'cadastro-empresa' && (
              <CadastroEmpresaScreen
                onVoltar={() => handleNavegacao('empresas')}
                onEmpresaSalva={() => handleNavegacao('empresas')}
              />
            )}

            {abaAtiva === 'empresas' && (
              <EmpresasScreen
                maxCnpjs={planoAtivoId === 'empresarial' ? 500 : planoAtivoId === 'profissional' ? 100 : 50}
                onIrParaGuias={(emp) => {
                  setEmpresaParaGuias(emp);
                  handleNavegacao('guias');
                }}
              />
            )}

            {abaAtiva === 'videoAulas' && (
              <VideoAulasScreen />
            )}

            {abaAtiva === 'minhaConta' && (
              <MinhaContaScreen 
                usuario={usuarioAtual}
                onAtualizarUsuario={setUsuarioAtual}
              />
            )}

            {/* 👑 ROTAS ADMINISTRATIVAS MURADE (Protegidas) */}
            {isAdmin && abaAtiva === 'planos' && (
              <PlanosAssinatura
                planoAtivoId={planoAtivoId}
                onSelecionarPlano={(novoPlano) => setPlanoAtivoId(novoPlano)}
              />
            )}

            {isAdmin && abaAtiva === 'admin' && (
              <AdminDashboard abaInicial="visao_geral" />
            )}

            {isAdmin && abaAtiva === 'admin_faturamento' && (
              <AdminDashboard abaInicial="financeiro" />
            )}

            {isAdmin && abaAtiva === 'admin_bloqueio' && (
              <AdminDashboard abaInicial="usuarios" filtroInicial="BLOQUEADO" />
            )}

            {isAdmin && abaAtiva === 'admin_precos' && (
              <AdminDashboard abaInicial="planos" />
            )}

            {isAdmin && (abaAtiva === 'admin_senhas' || abaAtiva === 'admin_seguranca') && (
              <AdminDashboard abaInicial="seguranca" />
            )}

            {(abaAtiva === 'configuracao' || abaAtiva === 'integracao') && (
              isAdmin ? (
                <ConfiguracaoIntegracaoScreen
                  onVoltar={() => handleNavegacao('dashboard')}
                />
              ) : (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 max-w-lg mx-auto mt-12 space-y-4 shadow-sm">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Acesso Restrito ao Administrador</h3>
                  <p className="text-sm text-slate-500">
                    As conexões e integrações internas do sistema MURADE operam nos bastidores e são restritas ao Administrador Master (MURADE_CONFIG: adminVisaTudo).
                  </p>
                  <button 
                    onClick={() => handleNavegacao('dashboard')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 cursor-pointer"
                  >
                    Voltar ao Início
                  </button>
                </div>
              )
            )}

            {(abaAtiva === 'automacaoFiscal' || abaAtiva === 'automacao') && (
              <AutomacaoFiscalScreen
                onVoltar={() => handleNavegacao('dashboard')}
                onNavegar={handleNavegacao}
              />
            )}

            {abaAtiva === 'fiscal' && (
              <ModuloFiscalScreen
                abaInicial={subAbaFiscal}
                onVoltar={() => handleNavegacao('dashboard')}
              />
            )}

            {abaAtiva === 'modulos' && <ModulosMuradeScreen />}

            {(abaAtiva === 'iaVoz' || abaAtiva === 'vozMurad' || abaAtiva === 'voz') && (
              <IaMuradVozScreen
                usuario={usuarioAtual}
                onVoltar={() => handleNavegacao('dashboard')}
              />
            )}

            {/* 🛡️ Fallback de segurança contra telas em branco: se nenhuma rota coincidir, renderiza o Início / Dashboard */}
            {![
              'dashboard', 'agenda', 'cnd', 'dctfweb', 'consultaGuias', 'consulta-guias', 'rfb', 'receita',
              'guiasINSS', 'guias-inss', 'inss', 'orgaos_publicos', 'orgaos', 'procuracao', 'serpro',
              'guias', 'cadastro-empresa', 'empresas', 'videoAulas', 'minhaConta', 'planos', 'admin',
              'admin_faturamento', 'admin_bloqueio', 'admin_precos', 'configuracao', 'integracao',
              'automacaoFiscal', 'automacao', 'fiscal', 'iaVoz', 'modulos'
            ].includes(abaAtiva) && (
              <DashboardFiscal
                planoAtivoId={planoAtivoId}
                onNavegar={handleNavegacao}
              />
            )}
          </main>

          {/* 🤖🧠 PAINEL ANIMADO LATERAL — Robô + Agente + Certificado + Monitor no canto direito */}
          {usuarioAtual && (
            <PainelAnimadoLateral
              visivel={true}
              onAbrirAutomacao={() => handleNavegacao('automacaoFiscal')}
              onAbrirCalculadora={() => setModalCalculadoraAberto(true)}
            />
          )}

          {/* 🧮 MODAL DA CALCULADORA FISCAL GLOBAL (27 UFs) */}
          <ModalCalculadoraFiscal
            aberto={modalCalculadoraAberto}
            onFechar={() => setModalCalculadoraAberto(false)}
          />

          {/* Modal de E-mails Disparados */}
          {modalEmailsAberto && (
            <ModalEmailsEnviados
              emails={emailsEnviados}
              onFechar={() => setModalEmailsAberto(false)}
              onTestarRedefinicao={(tok) => {
                setModalEmailsAberto(false);
                handleAbrirRedefinicao(tok);
              }}
            />
          )}

          {/* Rodapé Oficial MURADE */}
          <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 mt-auto">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-700" />
                <span className="font-bold text-slate-800">FISCOIA — Compliance Fiscal & Previdenciário</span>
              </div>

              <div>
                <span>Administração Master: <strong className="text-indigo-900">MURADE</strong> • Suporte a até 500 CNPJs</span>
              </div>

              <div className="text-[11px] text-slate-400">
                Padrão DCTFWeb / Receita Federal • Webservice RFB e-CAC • Permissões RBAC Ativas
              </div>
            </div>
          </footer>
        </div>
      </div>
    </NavigationProvider>
  );
}

// Sub-componente para inspecionar e-mails enviados pelo sistema
function ModalEmailsEnviados({
  emails,
  onFechar,
  onTestarRedefinicao
}: {
  emails: EmailEnviadoLog[];
  onFechar: () => void;
  onTestarRedefinicao: (token: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col animate-in fade-in duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <Mail className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Caixa de E-mails Transacionais do Sistema
              </h3>
              <p className="text-xs text-slate-500">
                Histórico e registros dos e-mails de boas-vindas, senhas provisórias e links de recuperação enviados aos contadores.
              </p>
            </div>
          </div>

          <button
            onClick={onFechar}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {emails.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400 space-y-2">
              <Mail className="w-8 h-8 text-slate-300 mx-auto" />
              <p>Nenhum e-mail disparado nesta sessão ainda.</p>
              <p className="text-[11px] text-slate-400">
                Cadastre um contador no Painel MURADE ou clique em "Esqueci minha senha" para gerar um e-mail.
              </p>
            </div>
          ) : (
            emails.map((em) => (
              <div
                key={em.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-slate-900">{em.assunto}</span>
                  <span className="text-[11px] text-slate-400 font-mono">{em.dataEnvio}</span>
                </div>

                <div className="text-[11px] text-slate-600">
                  <span>Destinatário: </span>
                  <strong className="font-mono text-indigo-700">{em.para}</strong>
                </div>

                <pre className="p-3 bg-white rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {em.corpo.trim()}
                </pre>

                {em.link && (
                  <div className="pt-1 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const token = em.link?.split('token=')[1] || '';
                        onTestarRedefinicao(token);
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Abrir este Link de Redefinição Direto
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="pt-2 border-t border-slate-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>
  );
}
