import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, LockKeyhole } from 'lucide-react';
import { aceitarConvite } from '../../services/auth/auth.service';
import type { UsuarioAuth } from '../../types';

type Props = {
  token: string;
  onConcluido: (usuario: UsuarioAuth) => void;
  onVoltarLogin: () => void;
};

export default function AceitarConviteScreen({ token, onConcluido, onVoltarLogin }: Props) {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErro(null);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      setErro('O link está incompleto ou inválido. Peça um novo convite ao administrador.');
      return;
    }
    if (senha.length < 12 || senha.length > 1024) {
      setErro('A senha precisa ter pelo menos 12 caracteres.');
      return;
    }
    if (senha !== confirmacao) {
      setErro('As senhas não coincidem.');
      return;
    }

    setCarregando(true);
    const resultado = await aceitarConvite(token, senha);
    setCarregando(false);
    if (resultado.sucesso && resultado.usuario) onConcluido(resultado.usuario);
    else setErro(resultado.mensagem);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-800">
          <LockKeyhole className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-center text-2xl font-black text-slate-900">Crie sua senha do Fisco IA</h1>
        <p className="mt-2 text-center text-sm text-slate-600">Este convite é de uso único e expira em 30 dias.</p>

        {erro && <div role="alert" className="mt-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="h-5 w-5 shrink-0" />{erro}</div>}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-slate-700">
            Nova senha
            <input type="password" required minLength={12} maxLength={1024} autoComplete="new-password" value={senha} onChange={(event) => setSenha(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Pelo menos 12 caracteres" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Confirme a senha
            <input type="password" required minLength={12} maxLength={1024} autoComplete="new-password" value={confirmacao} onChange={(event) => setConfirmacao(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Digite a mesma senha novamente" />
          </label>
          <button type="submit" disabled={carregando} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-900 px-4 py-3 font-bold text-white hover:bg-indigo-950 disabled:opacity-60">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />{carregando ? 'Validando convite…' : 'Salvar senha e entrar'}
          </button>
          <button type="button" onClick={onVoltarLogin} className="w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-800">Voltar ao login</button>
        </form>
      </section>
    </main>
  );
}
