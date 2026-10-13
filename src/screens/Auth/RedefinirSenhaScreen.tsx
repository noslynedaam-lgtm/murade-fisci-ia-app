import { useState, FormEvent } from 'react';
import { Lock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { redefinirSenha } from '../../services/auth/auth.service';
import BotaoVoltar from '../../components/BotaoVoltar';

interface RedefinirSenhaProps {
  token: string;
  onVoltarLogin: () => void;
}

export default function RedefinirSenhaScreen({
  token,
  onVoltarLogin
}: RedefinirSenhaProps) {
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!novaSenha || !confirmarSenha) {
      setErro('Preencha todos os campos obrigatórios!');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem!');
      return;
    }

    if (novaSenha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres!');
      return;
    }

    setCarregando(true);
    const resp = await redefinirSenha(token, novaSenha);
    setCarregando(false);

    if (resp.sucesso) {
      setConcluido(true);
    } else {
      setErro(resp.mensagem || 'Link inválido ou expirado.');
    }
  };

  if (concluido) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 sm:p-8 space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl mx-auto border border-emerald-200">
            ✅
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Senha Alterada com Sucesso!
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sua nova senha foi salva nos servidores do FISCOIA. Agora você pode acessar sua conta normalmente.
            </p>
          </div>

          <button
            type="button"
            onClick={onVoltarLogin}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
          >
            <Lock className="w-4 h-4" />
            <span>Ir para o Login</span>
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
            🔐
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Criar Nova Senha
          </h2>
          <p className="text-xs text-slate-600">
            Digite e confirme sua nova senha de acesso ao FISCOIA.
          </p>
        </div>

        {erro && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Nova Senha
              </label>
              <input
                type="password"
                required
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Confirmar Nova Senha
              </label>
              <input
                type="password"
                required
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Digite a senha novamente"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full py-3.5 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 transition-all"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{carregando ? 'Salvando Senha...' : 'Salvar Nova Senha'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
