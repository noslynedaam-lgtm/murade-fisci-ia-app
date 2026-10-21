import { useState, useEffect, FormEvent } from 'react';
import { 
  Crown, Users, DollarSign, TrendingUp, AlertOctagon, Settings, 
  Bell, FileText, CheckCircle2, Search, ArrowUpRight, Lock, 
  Unlock, Send, Edit3, ShieldAlert, UserPlus, KeyRound, ShieldCheck, Eye, EyeOff, Shield
} from 'lucide-react';
import { PLANOS } from '../../config/planos';
import CadastroContadorScreen from './CadastroContadorScreen';
import EscritoriosContratantes from './EscritoriosContratantes';
import PainelAtividade from './PainelAtividade';
import BotaoVoltar from '../../components/BotaoVoltar';
import { obterSenhaAdmin, salvarNovaSenhaAdmin } from '../../components/ModalAcessoAdmin';
import { alterarSenhaDireta, listarContasParaAdmin } from '../../services/auth/auth.service';

interface ContadorUsuario {
  id: string;
  nome: string;
  email: string;
  crc: string;
  plano: 'basico' | 'profissional' | 'empresarial';
  cnpjsCadastrados: number;
  maxCnpjs: number;
  status: 'ATIVO' | 'BLOQUEADO' | 'PENDENTE';
  diasAtraso: number;
  valorMensalidade: number;
}

interface AdminDashboardProps {
  abaInicial?: 'visao_geral' | 'usuarios' | 'cadastrar' | 'financeiro' | 'planos' | 'comunicados' | 'seguranca';
  filtroInicial?: 'TODOS' | 'ATIVO' | 'BLOQUEADO';
}

export default function AdminDashboard({ abaInicial = 'visao_geral', filtroInicial = 'TODOS' }: AdminDashboardProps) {
  const [abaAtiva, setAbaAtiva] = useState<'visao_geral' | 'usuarios' | 'cadastrar' | 'financeiro' | 'planos' | 'comunicados' | 'seguranca'>(abaInicial);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'ATIVO' | 'BLOQUEADO'>(filtroInicial);

  // Estados para alteração de senhas
  const [listaContasAdmin, setListaContasAdmin] = useState<Array<{ id: string; nome: string; email: string; tipo: string; ehAdmin: boolean }>>([]);
  const [senhaAdminAtual, setSenhaAdminAtual] = useState('');
  const [novaSenhaAdmin, setNovaSenhaAdmin] = useState('');
  const [confirmaNovaSenhaAdmin, setConfirmaNovaSenhaAdmin] = useState('');
  const [mostrarSenhaAdmin, setMostrarSenhaAdmin] = useState(false);
  const [msgSucessoAdmin, setMsgSucessoAdmin] = useState<string | null>(null);
  const [msgErroAdmin, setMsgErroAdmin] = useState<string | null>(null);

  const [emailLoginSelecionado, setEmailLoginSelecionado] = useState('noslyneda.murad@gmail.com');
  const [msgSucessoLogin, setMsgSucessoLogin] = useState<string | null>(null);
  const [msgErroLogin, setMsgErroLogin] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    try {
      void listarContasParaAdmin().then((contas) => {
        if (!ativo) return;
        setListaContasAdmin(contas);
        if (contas.length > 0 && !contas.some(c => c.email.toLowerCase() === emailLoginSelecionado.toLowerCase())) {
          setEmailLoginSelecionado(contas[0].email);
        }
      }).catch((error: unknown) => {
        if (ativo) setMsgErroAdmin(error instanceof Error ? error.message : 'Não foi possível ler as contas do servidor.');
      });
    } catch (error) {
      setMsgErroAdmin(error instanceof Error ? error.message : 'Não foi possível ler as contas do servidor.');
    }
    return () => { ativo = false; };
  }, []);

  const handleSalvarSenhaAdmin = (e: FormEvent) => {
    e.preventDefault();
    setMsgSucessoAdmin(null);
    setMsgErroAdmin(null);

    const senhaCorreta = obterSenhaAdmin();
    if (senhaAdminAtual !== senhaCorreta) {
      setMsgErroAdmin('⚠️ Senha Master atual incorreta. Digite a senha correta para alterar.');
      return;
    }

    if (novaSenhaAdmin.length < 6) {
      setMsgErroAdmin('⚠️ A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (novaSenhaAdmin !== confirmaNovaSenhaAdmin) {
      setMsgErroAdmin('⚠️ A confirmação da nova senha não confere.');
      return;
    }

    salvarNovaSenhaAdmin(novaSenhaAdmin);
    setSenhaAdminAtual('');
    setNovaSenhaAdmin('');
    setConfirmaNovaSenhaAdmin('');
    setMsgSucessoAdmin('✅ Senha de Administrador Master alterada com sucesso! Guarde-a com segurança.');
  };

  const handleSalvarSenhaLogin = async (e: FormEvent) => {
    e.preventDefault();
    setMsgSucessoLogin(null);
    setMsgErroLogin(null);

    if (!emailLoginSelecionado) {
      setMsgErroLogin('⚠️ Selecione uma conta para alterar a senha.');
      return;
    }

    const res = await alterarSenhaDireta(emailLoginSelecionado, '');
    if (res.sucesso) {
      setMsgSucessoLogin(`✅ ${res.mensagem}${res.senhaTemporaria ? ` Senha temporária (exibida uma vez): ${res.senhaTemporaria}` : ''}`);
    } else {
      setMsgErroLogin(`⚠️ ${res.mensagem}`);
    }
  };

  useEffect(() => {
    if (abaInicial) setAbaAtiva(abaInicial);
  }, [abaInicial]);

  useEffect(() => {
    if (filtroInicial) setFiltroStatus(filtroInicial);
  }, [filtroInicial]);
  const [comunicadoEnviado, setComunicadoEnviado] = useState(false);
  const [textoComunicado, setTextoComunicado] = useState('');
  const [rascunhosComunicados, setRascunhosComunicados] = useState<Array<{ texto: string; criadoEm: string }>>(() => {
    try {
      return JSON.parse(localStorage.getItem('fiscoia_admin_comunicados_rascunho') || '[]');
    } catch {
      return [];
    }
  });
  const [mensagemPlanos, setMensagemPlanos] = useState<string | null>(null);

  // Valores de planos editáveis pelo admin
  const [valoresPlanos, setValoresPlanos] = useState(() => {
    const padrao = {
      basico: PLANOS.BASICO.valorMensal,
      profissional: PLANOS.PROFISSIONAL.valorMensal,
      empresarial: PLANOS.EMPRESARIAL.valorMensal
    };
    try {
      const salvo = typeof window !== 'undefined' ? localStorage.getItem('fiscoia_admin_precos_planos_local') : null;
      return salvo ? { ...padrao, ...JSON.parse(salvo) } : padrao;
    } catch {
      return padrao;
    }
  });

  // Operadores e Contadores Oficiais
  const [usuarios, setUsuarios] = useState<ContadorUsuario[]>([]);

  const toggleBloqueio = (userId: string) => {
    setUsuarios(usuarios.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          status: u.status === 'BLOQUEADO' ? 'ATIVO' : 'BLOQUEADO',
          diasAtraso: u.status === 'BLOQUEADO' ? 0 : u.diasAtraso
        };
      }
      return u;
    }));
  };

  const handleEnviarComunicado = (e: FormEvent) => {
    e.preventDefault();
    const texto = textoComunicado.trim();
    if (!texto) return;
    try {
      const atualizados = [{ texto, criadoEm: new Date().toISOString() }, ...rascunhosComunicados];
      localStorage.setItem('fiscoia_admin_comunicados_rascunho', JSON.stringify(atualizados));
      setRascunhosComunicados(atualizados);
      setComunicadoEnviado(true);
      setTextoComunicado('');
    } catch {
      setComunicadoEnviado(false);
    }
  };

  const handleSalvarValoresPlanos = () => {
    try {
      localStorage.setItem('fiscoia_admin_precos_planos_local', JSON.stringify(valoresPlanos));
      setMensagemPlanos('Valores salvos neste navegador para referência. Não alteram assinaturas nem cobranças.');
    } catch {
      setMensagemPlanos('Não foi possível salvar os valores neste navegador. Nenhuma cobrança foi alterada.');
    }
  };

  const usuariosFiltrados = usuarios.filter(u => {
    const bateTexto = u.nome.toLowerCase().includes(busca.toLowerCase()) || 
                      u.email.toLowerCase().includes(busca.toLowerCase()) ||
                      u.crc.toLowerCase().includes(busca.toLowerCase());
    const bateFiltro = filtroStatus === 'TODOS' ? true : u.status === filtroStatus;
    return bateTexto && bateFiltro;
  });

  return (
    <div id="admin-murade-screen" className="space-y-6 max-w-6xl mx-auto pb-12">
      <div>
        <BotaoVoltar />
      </div>

      {/* Header MURADE */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-xl border border-indigo-500/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-extrabold tracking-wider uppercase border border-amber-400/30">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Master Admin • MURADE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Painel de Gestão e Controle FISCOIA
          </h1>
          <p className="text-indigo-200 text-xs sm:text-sm max-w-xl">
            Gestão local de contas e configurações. Cobranças, assinaturas, notificações externas e bloqueios automáticos não estão conectados.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-3 bg-white/10 backdrop-blur-xs rounded-xl border border-white/10 text-right">
            <span className="text-[10px] text-indigo-300 uppercase tracking-wider block font-semibold">
              Bloqueio automático
            </span>
            <span className="text-sm font-bold text-amber-300">
              Não configurado
            </span>
          </div>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Contas de contador cadastradas localmente</span>
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-indigo-950">
            {listaContasAdmin.filter(conta => !conta.ehAdmin).length}
          </div>
          <p className="text-[11px] text-slate-500">
            Não indica assinatura ou acesso ativo em serviço externo
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Faturamento do Mês</span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono">
            Não conectado
          </div>
          <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Gateway de cobrança e dados financeiros não configurados
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Inadimplentes</span>
            <span className="p-2 rounded-lg bg-rose-50 text-rose-700">
              <AlertOctagon className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-600">
            Não disponível
          </div>
          <p className="text-[11px] text-rose-600 font-medium">
            Sem integração de pagamento ou bloqueio automático
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Capacidade Total</span>
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
              <Crown className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Não configurado
          </div>
          <p className="text-[11px] text-slate-500">
            Limites por plano não são aplicados por serviço central
          </p>
        </div>
      </div>

      {/* Tabs de Controle */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="flex items-center border-b border-slate-200 overflow-x-auto px-4 gap-2 bg-slate-50/50">
          <button
            onClick={() => setAbaAtiva('visao_geral')}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              abaAtiva === 'visao_geral'
                ? 'border-indigo-600 text-indigo-900 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Visão Geral & Atalhos</span>
          </button>
          <button
            onClick={() => setAbaAtiva('usuarios')}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              abaAtiva === 'usuarios'
                ? 'border-indigo-600 text-indigo-900 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Gerenciar Escritórios & Usuários</span>
          </button>
          <button
            onClick={() => setAbaAtiva('cadastrar')}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              abaAtiva === 'cadastrar'
                ? 'border-indigo-600 text-indigo-900 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
            <span>Cadastrar Novo Contador</span>
          </button>
          <button
            onClick={() => setAbaAtiva('financeiro')}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              abaAtiva === 'financeiro'
                ? 'border-indigo-600 text-indigo-900 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Financeiro & Cobrança</span>
          </button>
          <button
            onClick={() => setAbaAtiva('planos')}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              abaAtiva === 'planos'
                ? 'border-indigo-600 text-indigo-900 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configurar Planos e Valores</span>
          </button>
          <button
            onClick={() => setAbaAtiva('comunicados')}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              abaAtiva === 'comunicados'
                ? 'border-indigo-600 text-indigo-900 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Enviar Comunicados</span>
          </button>
          <button
            onClick={() => setAbaAtiva('seguranca')}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              abaAtiva === 'seguranca'
                ? 'border-indigo-600 text-indigo-900 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-500" />
            <span>Segurança & Senhas</span>
          </button>
        </div>

        <div className="p-6">
          {/* Aba: Visão Geral */}
          {abaAtiva === 'visao_geral' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div 
                  onClick={() => setAbaAtiva('usuarios')}
                  className="p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm cursor-pointer transition-all bg-slate-50/50 space-y-2"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">👥 Gerenciar Usuários</h4>
                  <p className="text-xs text-slate-500">
                    Acompanhe os escritórios cadastrados, CNPJs vinculados e status de bloqueio.
                  </p>
                </div>

                <div 
                  onClick={() => setAbaAtiva('financeiro')}
                  className="p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm cursor-pointer transition-all bg-slate-50/50 space-y-2"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">💰 Financeiro e Pagamentos</h4>
                  <p className="text-xs text-slate-500">
                    Integração de cobrança não configurada; esta área não envia avisos.
                  </p>
                </div>

                <div 
                  onClick={() => setAbaAtiva('planos')}
                  className="p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm cursor-pointer transition-all bg-slate-50/50 space-y-2"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">⚙️ Configurar Planos e Valores</h4>
                  <p className="text-xs text-slate-500">
                    Edite valores de referência salvos apenas neste navegador; não há cobrança conectada.
                  </p>
                </div>

                <div 
                  onClick={() => setAbaAtiva('seguranca')}
                  className="p-5 rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-sm cursor-pointer transition-all bg-slate-50/50 space-y-2"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">🔐 Segurança & Senhas</h4>
                  <p className="text-xs text-slate-500">
                    Altere a Senha Master de administrador e as senhas de login do FISCOIA com sigilo total.
                  </p>
                </div>
              </div>

              {/* Tabela Resumida de Alertas */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Avisos de cobrança e compliance</span>
                  </h4>
                </div>
                <p className="p-3 bg-white border border-amber-200 rounded-lg text-xs text-amber-900">
                  Não há fonte de cobrança, envio de notificações ou bloqueio automático conectada. Nenhum escritório foi marcado como inadimplente nesta tela.
                </p>
              </div>
            </div>
          )}

          {/* Aba: Gerenciar Usuários */}
          {abaAtiva === 'usuarios' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por contador, e-mail ou CRC..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value as any)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white outline-none"
                  >
                    <option value="TODOS">Todos os Status</option>
                    <option value="ATIVO">Ativos</option>
                    <option value="BLOQUEADO">Bloqueados</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setAbaAtiva('cadastrar')}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Novo Contador</span>
                  </button>
                </div>
              </div>

              {/* Tabela de Usuários */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-3">Contador / Escritório</th>
                      <th className="p-3">Plano</th>
                      <th className="p-3">CNPJs Usados</th>
                      <th className="p-3">Mensalidade</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Ação Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usuariosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-xs text-slate-600">
                          Nenhum cadastro de escritório com plano, CRC e cobrança está conectado. As contas de login locais não comprovam assinatura nem pagamentos.
                        </td>
                      </tr>
                    )}
                    {usuariosFiltrados.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80">
                        <td className="p-3">
                          <strong className="text-slate-900 block">{u.nome}</strong>
                          <span className="text-slate-500 text-[11px]">{u.email} • {u.crc}</span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                            u.plano === 'empresarial' ? 'bg-amber-100 text-amber-900' :
                            u.plano === 'profissional' ? 'bg-indigo-100 text-indigo-900' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {u.plano}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800">{u.cnpjsCadastrados}</span>
                            <span className="text-slate-400">/ {u.maxCnpjs}</span>
                          </div>
                          <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                            <div 
                              className="bg-indigo-600 h-full rounded-full" 
                              style={{ width: `${(u.cnpjsCadastrados / u.maxCnpjs) * 100}%` }}
                            />
                          </div>
                        </td>
                        <td className="p-3 font-mono font-semibold text-slate-800">
                          R$ {u.valorMensalidade.toFixed(2)}
                        </td>
                        <td className="p-3">
                          {u.status === 'ATIVO' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold">
                              <CheckCircle2 className="w-3 h-3" /> Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[11px] font-bold">
                              <Lock className="w-3 h-3" /> Bloqueado ({u.diasAtraso}d)
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => toggleBloqueio(u.id)}
                            className={`px-3 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                              u.status === 'BLOQUEADO'
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {u.status === 'BLOQUEADO' ? 'Desbloquear' : 'Bloquear'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Aba: Cadastrar Novo Contador */}
          {abaAtiva === 'cadastrar' && (
            <>
            <EscritoriosContratantes />
            <PainelAtividade />
            <CadastroContadorScreen onVoltar={() => setAbaAtiva('visao_geral')} />
            </>
          )}

          {/* Aba: Financeiro & Pagamentos */}
          {abaAtiva === 'financeiro' && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 space-y-2">
              <h3 className="font-bold text-amber-950">Financeiro sem integração</h3>
              <p className="text-xs text-amber-900">Este sistema não está conectado a gateway de pagamento, banco, serviço de cobrança nem envio de e-mail/WhatsApp. Não há valores de faturamento, Pix, contas em atraso ou notificações enviadas disponíveis para exibir.</p>
              <p className="text-xs text-amber-900">Para ativar essas funções será necessário configurar um provedor de pagamentos, armazenamento central e serviço de notificações no servidor.</p>
            </div>
          )}

          {/* Aba: Configurar Planos e Valores */}
          {abaAtiva === 'planos' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Valores de referência dos planos</h3>
                <p className="text-xs text-amber-800">Salvos neste navegador. Não há gateway de pagamento conectado e estes valores não alteram assinaturas nem cobranças.</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <strong className="text-sm text-slate-900 block">Plano Básico (até 50 CNPJs)</strong>
                    <span className="text-xs text-slate-500">Recursos disponíveis dependem de integrações ainda não configuradas.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-semibold">R$</span>
                    <input
                      type="number"
                      step="0.10"
                      value={valoresPlanos.basico}
                      onChange={(e) => setValoresPlanos({ ...valoresPlanos, basico: parseFloat(e.target.value) || 0 })}
                      className="w-28 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-white"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <strong className="text-sm text-slate-900 block">Plano Profissional (até 100 CNPJs)</strong>
                    <span className="text-xs text-slate-500">Recursos oficiais não estão conectados nesta versão.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-semibold">R$</span>
                    <input
                      type="number"
                      step="0.10"
                      value={valoresPlanos.profissional}
                      onChange={(e) => setValoresPlanos({ ...valoresPlanos, profissional: parseFloat(e.target.value) || 0 })}
                      className="w-28 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-white"
                    />
                  </div>
                </div>

                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-200 flex items-center justify-between">
                  <div>
                    <strong className="text-sm text-indigo-950 block">Plano Empresarial (até 500 CNPJs)</strong>
                    <span className="text-xs text-indigo-700">Transmissão e apuração oficiais não estão conectadas nesta versão.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-indigo-700 font-semibold">R$</span>
                    <input
                      type="number"
                      step="0.10"
                      value={valoresPlanos.empresarial}
                      onChange={(e) => setValoresPlanos({ ...valoresPlanos, empresarial: parseFloat(e.target.value) || 0 })}
                      className="w-28 px-3 py-1.5 border border-indigo-300 rounded-lg text-xs font-bold text-indigo-950 bg-white"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSalvarValoresPlanos}
                className="px-5 py-2.5 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                Salvar valores locais
              </button>
              {mensagemPlanos && <p role="status" className="text-xs text-amber-900">{mensagemPlanos}</p>}
            </div>
          )}

          {/* Aba: Enviar Comunicados */}
          {abaAtiva === 'comunicados' && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Rascunho de comunicado</h3>
                <p className="text-xs text-slate-500">O texto pode ser guardado neste navegador para revisão. Não há envio a escritórios, e-mail ou WhatsApp configurado.</p>
              </div>

              <form onSubmit={handleEnviarComunicado} className="space-y-3">
                <textarea
                  rows={4}
                  value={textoComunicado}
                  onChange={(e) => setTextoComunicado(e.target.value)}
                  placeholder="Escreva o comunicado para revisão local..."
                  className="w-full p-3.5 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    O rascunho ficará salvo somente neste navegador.
                  </span>
                  <button
                    type="submit"
                    disabled={!textoComunicado}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Salvar rascunho local</span>
                  </button>
                </div>
              </form>

              {comunicadoEnviado && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Rascunho salvo neste navegador. Nenhum escritório recebeu a mensagem.</span>
                </div>
              )}
              {rascunhosComunicados.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700">Rascunhos locais recentes</h4>
                  {rascunhosComunicados.slice(0, 5).map((rascunho, indice) => (
                    <article key={`${rascunho.criadoEm}-${indice}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                      <time className="block text-[10px] text-slate-500">{new Date(rascunho.criadoEm).toLocaleString('pt-BR')}</time>
                      <p className="mt-1 whitespace-pre-wrap text-slate-800">{rascunho.texto}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Aba: Segurança & Alteração de Senhas */}
          {abaAtiva === 'seguranca' && (
            <div className="space-y-6">
              <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-amber-500" />
                    <span>Gerenciamento de Senhas & Segurança</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure e altere a senha de Administrador Master e as credenciais de entrada no FISCOIA. Nenhuma senha fica visível publicamente.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Ambiente Protegido</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* CARD 1: Senha de Administrador Master (Acesso Restrito) */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
                    <div className="p-2.5 rounded-xl bg-amber-100 text-amber-900">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">
                        1. Senha do Administrador Master
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Usada no botão &quot;Acesso Admin&quot; para liberar o Painel Murade e módulos restritos.
                      </p>
                    </div>
                  </div>

                  {msgSucessoAdmin && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{msgSucessoAdmin}</span>
                    </div>
                  )}

                  {msgErroAdmin && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{msgErroAdmin}</span>
                    </div>
                  )}

                  <form onSubmit={handleSalvarSenhaAdmin} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Senha Master Atual: *
                      </label>
                      <input
                        type={mostrarSenhaAdmin ? 'text' : 'password'}
                        value={senhaAdminAtual}
                        onChange={(e) => setSenhaAdminAtual(e.target.value)}
                        placeholder="Digite sua senha atual de administrador..."
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Nova Senha de Administrador Master: *
                      </label>
                      <input
                        type={mostrarSenhaAdmin ? 'text' : 'password'}
                        value={novaSenhaAdmin}
                        onChange={(e) => setNovaSenhaAdmin(e.target.value)}
                        placeholder="Digite a nova senha (mínimo 6 caracteres)..."
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        required
                        minLength={6}
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Confirmar Nova Senha: *
                      </label>
                      <input
                        type={mostrarSenhaAdmin ? 'text' : 'password'}
                        value={confirmaNovaSenhaAdmin}
                        onChange={(e) => setConfirmaNovaSenhaAdmin(e.target.value)}
                        placeholder="Repita a nova senha..."
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        required
                        minLength={6}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => setMostrarSenhaAdmin(!mostrarSenhaAdmin)}
                        className="text-slate-500 hover:text-slate-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {mostrarSenhaAdmin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{mostrarSenhaAdmin ? 'Ocultar caracteres' : 'Exibir caracteres'}</span>
                      </button>

                      <button
                        type="submit"
                        className="px-4 py-2.5 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                      >
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                        <span>Salvar Senha Master</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* CARD 2: Senha de Entrada / Login no FISCOIA */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
                    <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-900">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">
                        2. Senha de Entrada / Login no FISCOIA
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Altere a senha de login da Diretoria Murade ou de operadores do sistema.
                      </p>
                    </div>
                  </div>

                  {msgSucessoLogin && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{msgSucessoLogin}</span>
                    </div>
                  )}

                  {msgErroLogin && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{msgErroLogin}</span>
                    </div>
                  )}

                  <form onSubmit={handleSalvarSenhaLogin} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Conta / E-mail para Alteração: *
                      </label>
                      <select
                        value={emailLoginSelecionado}
                        onChange={(e) => setEmailLoginSelecionado(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                      >
                        {listaContasAdmin.map(c => (
                          <option key={c.email} value={c.email}>
                            {c.nome} ({c.email}) {c.ehAdmin ? '👑 [ADMIN MASTER]' : '👤 [OPERADOR]'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-950">
                        O servidor gera uma senha temporária aleatória, encerra as sessões existentes e exige que a pessoa escolha uma nova senha no próximo acesso. A senha aparece uma única vez nesta confirmação; entregue-a por canal seguro.
                      </p>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                        <span>Gerar senha temporária</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Box de Política de Privacidade & Segurança */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-start gap-3">
                <Shield className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-950 space-y-1">
                  <h4 className="font-extrabold text-sm">Privacidade e Sigilo das Senhas</h4>
                  <p className="text-indigo-800 leading-relaxed">
                    Nenhuma senha é exibida na tela de login ou em modais públicos para outros usuários. Suas senhas são mantidas com segurança e você pode alterá-las sempre que desejar exclusivamente através deste painel administrativo.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
