import { useState, FormEvent } from 'react';
import { Mail, KeyRound, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { recuperarSenha } from '../../services/auth/auth.service';
import BotaoVoltar from '../../components/BotaoVoltar';

interface RecuperarSenhaProps {
  emailInicial?: string;
  onVoltarLogin: () => void;
  onAbrirRedefinicao: (token: string) => void;
}

export default function RecuperarSenhaScreen({
  emailInicial = '',
  onVoltarLogin,
  onAbrirRedefinicao
}: RecuperarSenhaProps) {
  const [email, setEmail] = useState(emailInicial);
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [tokenGerado, setTokenGerado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErro('Digite seu e-mail cadastrado!');
      return;
    }

    setCarregando(true);
    setErro(null);
    const resp = await recuperarSenha(email);
    setCarregando(false);

    if (resp.sucesso) {
      setEnviado(true);
      if (resp.linkSimulado) {
        const urlParams = new URLSearchParams(resp.linkSimulado.split('?')[1]);
        setTokenGerado(urlParams.get('token') || 'tok_demo');
      }
    } else {
      setErro(resp.mensagem || 'E-mail não encontrado no sistema.');
    }
  };

  if (enviado) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 sm:p-8 space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl mx-auto border border-emerald-200">
            📧
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              E-mail Enviado!
            </h2>
            <p className="text-xs text-slate-600">
              Enviamos um link de redefinição de senha para:
            </p>
            <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100 text-xs font-bold text-indigo-950 font-mono">
              {email}
            </div>
            <p className="text-[11px] text-slate-400">
              Verifique sua caixa de entrada e também a caixa de spam. O link expira em 1 hora.
            </p>
          </div>

          {tokenGerado && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-left text-xs space-y-2">
              <span className="font-bold text-amber-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-amber-600" />
                <span>Link de Redefinição Gerado</span>
              </span>
              <p className="text-amber-900 text-[11px]">
                Você pode clicar no botão abaixo para redefinir sua senha com segurança:
              </p>
              <button
                type="button"
                onClick={() => onAbrirRedefinicao(tokenGerado)}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir Tela de Redefinição Agora</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onVoltarLogin}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            Voltar para o Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 sm:p-8 space-y-6">
        <div>
          <BotaoVoltar onVoltar={onVoltarLogin} />
        </div>

        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-3xl mx-auto border border-indigo-100">
            🔑
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Esqueceu sua senha?
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Digite o e-mail que você usa para acessar o sistema FISCOIA. Enviaremos as instruções para criar sua nova senha.
          </p>
        </div>

        {erro && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-600" />
              <span>Seu e-mail cadastrado</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contador@email.com"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full py-3.5 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 transition-all"
          >
            <Mail className="w-4 h-4 text-amber-400" />
            <span>{carregando ? 'Gerando Link...' : 'Enviar Link de Redefinição'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
