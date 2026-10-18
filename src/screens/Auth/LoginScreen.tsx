import { useState, FormEvent } from 'react';
import { Shield, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, Crown } from 'lucide-react';
import { login } from '../../services/auth/auth.service';
import { UsuarioAuth } from '../../types';
import { TIPOS_USUARIO, TipoUsuario } from '../../config/Permissoes';
import SimboloContabil from '../../components/SimboloContabil';

interface LoginScreenProps {
  onLoginSucesso: (usuario: UsuarioAuth) => void;
  onPedirPrimeiroAcesso: (email: string) => void;
  onEsqueciSenha: (emailAtual?: string) => void;
  mensagemSistema?: string | null;
}

export default function LoginScreen({
  onLoginSucesso,
  onPedirPrimeiroAcesso,
  onEsqueciSenha,
  mensagemSistema
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [notificacaoTipo, setNotificacaoTipo] = useState<{ tipo: 'ADMIN' | 'CONTADOR'; msg: string; subtitulo: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !senha) {
      setErro('⚠️ Preencha e-mail e senha!');
      return;
    }

    setCarregando(true);
    setErro(null);

    const resposta = await login(email, senha);
    setCarregando(false);

    if (resposta.precisaTrocarSenha) {
      // ⚠️ PRIMEIRO ACESSO → Vai direto para a troca obrigatória de senha
      onPedirPrimeiroAcesso(email);
      return;
    }

    if (resposta.sucesso && resposta.usuario) {
      const tipoUsuario: TipoUsuario = resposta.usuario.ehAdmin ? TIPOS_USUARIO.ADMIN : TIPOS_USUARIO.CONTADOR;
      const usuarioFinal: UsuarioAuth = {
        ...resposta.usuario,
        tipo: tipoUsuario,
        ehAdmin: tipoUsuario === TIPOS_USUARIO.ADMIN
      };

      if (tipoUsuario === TIPOS_USUARIO.ADMIN) {
        setNotificacaoTipo({
          tipo: 'ADMIN',
          msg: '👑 Bem-vindo, Administrador!',
          subtitulo: 'Sua conta foi validada pelo servidor.'
        });
      } else {
        setNotificacaoTipo({
          tipo: 'CONTADOR',
          msg: '✅ Bem-vindo ao FISCOIA!',
          subtitulo: 'Sua conta foi validada pelo servidor.'
        });
      }

      // Pequeno delay para exibir o feedback visual claro de quem é quem
      setTimeout(() => {
        onLoginSucesso(usuarioFinal);
      }, 700);
    } else {
      setErro(resposta.mensagem || 'E-mail ou senha incorretos.');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 w-full">
      <div className="bg-white rounded-3xl border border-indigo-100 shadow-2xl max-w-md w-full p-6 sm:p-8 space-y-6 relative overflow-hidden">
        {/* Faixa decorativa superior */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-800 via-indigo-600 to-amber-500"></div>

        {/* Logo & Marca */}
        <div className="text-center space-y-2 pt-2">
          <div className="flex justify-center">
            <SimboloContabil tamanho="xl" comBrilho={true} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
              <span>Murade Fisco IA</span>
            </h2>
            <p className="text-xs text-indigo-900 font-semibold mt-0.5">
              Compliance Fiscal com IA
            </p>
            <p role="note" className="text-[11px] text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg p-2 mt-3">Acesso validado no servidor, com sessão protegida por cookie seguro.</p>
          </div>
        </div>

        {/* Notificação de Quem Entrou (Admin Murade vs Contador) */}
        {notificacaoTipo && (
          <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in zoom-in-95 duration-200 ${
            notificacaoTipo.tipo === 'ADMIN'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-emerald-50 border-emerald-300 text-emerald-950'
          }`}>
            {notificacaoTipo.tipo === 'ADMIN' ? (
              <Crown className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <div>
              <strong className="block font-black text-sm">{notificacaoTipo.msg}</strong>
              <p className="text-[11px] leading-relaxed mt-0.5">{notificacaoTipo.subtitulo}</p>
            </div>
          </div>
        )}

        {/* Mensagem de Erro */}
        {erro && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-start gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-semibold">{erro}</span>
          </div>
        )}

        {mensagemSistema && !erro && (
          <div role="status" className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>{mensagemSistema}</span>
          </div>
        )}

        {/* Formulário de Login */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-600" />
              <span>E-mail</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@fiscoia.com.br ou seu e-mail"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 focus:bg-white font-medium"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Senha</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setErro('Recuperação por e-mail ainda não está configurada. Peça ao administrador para iniciar uma redefinição segura.');
                  onEsqueciSenha(email);
                }}
                className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline text-[11px]"
              >
                Esqueci minha senha
              </button>
            </div>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 focus:bg-white font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full py-3.5 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer transition-all disabled:opacity-50"
          >
            <Lock className="w-4 h-4 text-amber-400" />
            <span>{carregando ? 'Validando Acesso...' : 'Entrar'}</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </form>

        {/* Rodapé de Segurança */}
        <div className="pt-4 border-t border-slate-100 text-center space-y-1">
          <p className="text-[11px] text-slate-500 font-medium">
            Senhas verificadas pelo servidor · sessão em cookie HttpOnly
          </p>
          <p className="text-[10px] text-slate-400">
            Acesso confidencial restrito a operadores e contadores autorizados.
          </p>
        </div>
      </div>
    </div>
  );
}
