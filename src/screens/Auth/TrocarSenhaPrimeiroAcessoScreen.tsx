import { useState, FormEvent } from 'react';
import { Lock, ShieldCheck, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { trocarSenhaPrimeiroAcesso } from '../../services/auth/auth.service';
import { UsuarioAuth } from '../../types';
import BotaoVoltar from '../../components/BotaoVoltar';

interface TrocarSenhaProps {
  email: string;
  onSenhaAlterada: (usuario: UsuarioAuth) => void;
  onCancelar: () => void;
}

export default function TrocarSenhaPrimeiroAcessoScreen({
  email,
  onSenhaAlterada,
  onCancelar
}: TrocarSenhaProps) {
  const [senhaTemporaria, setSenhaTemporaria] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSalvar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!senhaTemporaria || !novaSenha || !confirmarSenha) {
      setErro('Preencha todos os campos obrigatórios!');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErro('A nova senha e a confirmação não coincidem!');
      return;
    }

    if (novaSenha.length < 12) {
      setErro('A nova senha deve possuir pelo menos 12 caracteres.');
      return;
    }

    setCarregando(true);
    const resp = await trocarSenhaPrimeiroAcesso(email, senhaTemporaria, novaSenha);
    setCarregando(false);

    if (resp.sucesso && resp.usuario) {
      onSenhaAlterada(resp.usuario);
    } else {
      setErro(resp.mensagem || 'Senha temporária incorreta.');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 sm:p-8 space-y-6">
        <div>
          <BotaoVoltar onVoltar={onCancelar} />
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-3xl mx-auto border border-amber-200">
            🔐
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Primeiro Acesso — Bem-vindo!
          </h2>
          <p className="text-xs text-slate-600">
            Por política de segurança do escritório MURADE, você deve cadastrar sua senha exclusiva e definitiva antes de entrar.
          </p>
          <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100 text-[11px] font-mono text-indigo-900 font-bold">
            Conta: {email}
          </div>
        </div>

        {erro && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleSalvar} className="space-y-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Senha temporária (fornecida pelo administrador)
              </label>
              <input
                type="text"
                required
                value={senhaTemporaria}
                onChange={(e) => setSenhaTemporaria(e.target.value)}
                placeholder="Senha temporária recebida do administrador"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono bg-white outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Sua Nova Senha (definitiva e pessoal)
              </label>
              <input
                type="password"
                required
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo de 12 caracteres"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Confirme a Nova Senha
              </label>
              <input
                type="password"
                required
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="submit"
              disabled={carregando}
              className="w-full py-3.5 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 transition-all"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{carregando ? 'Atualizando Senha...' : 'Salvar Senha e Acessar'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onCancelar}
              className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
            >
              Voltar ao Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
