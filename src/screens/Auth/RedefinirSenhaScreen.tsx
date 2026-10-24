import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, LockKeyhole } from 'lucide-react';
import BotaoVoltar from '../../components/BotaoVoltar';
import { redefinirSenha } from '../../services/auth/auth.service';

interface RedefinirSenhaProps {
  token: string;
  onVoltarLogin: () => void;
}

export default function RedefinirSenhaScreen({ token, onVoltarLogin }: RedefinirSenhaProps) {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    setErro(''); setSucesso('');
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) { setErro('O link está incompleto ou inválido. Peça um novo ao responsável do escritório.'); return; }
    if (senha.length < 12 || senha.length > 1024) { setErro('A senha precisa ter entre 12 e 1024 caracteres.'); return; }
    if (senha !== confirmacao) { setErro('As senhas não coincidem.'); return; }
    setCarregando(true);
    const resultado = await redefinirSenha(token, senha);
    setCarregando(false);
    if (!resultado.sucesso) { setErro(resultado.mensagem); return; }
    setSucesso(resultado.mensagem);
    window.history.replaceState(null, '', window.location.pathname);
    window.setTimeout(() => window.location.reload(), 800);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
        <BotaoVoltar onVoltar={onVoltarLogin} />
        <div className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-800"><LockKeyhole className="h-7 w-7" /></div>
        <h1 className="mt-5 text-center text-2xl font-black text-slate-900">Defina sua senha do Fisco IA</h1>
        <p className="mt-2 text-center text-sm text-slate-600">Este link é individual, de uso único e tem prazo de validade.</p>
        {erro && <div role="alert" className="mt-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="h-5 w-5 shrink-0" />{erro}</div>}
        {sucesso && <div role="status" className="mt-5 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0" />{sucesso}</div>}
        <form className="mt-6 space-y-4" onSubmit={enviar}>
          <label className="block text-sm font-semibold text-slate-700">Nova senha
            <input type="password" required minLength={12} maxLength={1024} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Pelo menos 12 caracteres" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">Confirme a nova senha
            <input type="password" required minLength={12} maxLength={1024} autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Digite a mesma senha novamente" />
          </label>
          <button type="submit" disabled={carregando || Boolean(sucesso)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-900 px-4 py-3 font-bold text-white hover:bg-indigo-950 disabled:opacity-60">{carregando ? 'Salvando…' : 'Salvar senha e entrar'}</button>
        </form>
      </section>
    </main>
  );
}
