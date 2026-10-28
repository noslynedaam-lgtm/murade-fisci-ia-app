import React, { useState } from 'react';

// "Esqueci minha senha": a pessoa informa o e-mail e recebe um link de uso único para criar a nova senha.
export function EsqueciSenha({ loginInicial = '' }: { loginInicial?: string }) {
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState(loginInicial);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [modoAdmin, setModoAdmin] = useState(false);
  const [chave, setChave] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const recuperarAdmin = async () => {
    setMsg(''); setOk(false); setEnviando(true);
    try {
      const r = await fetch('/api/auth/recuperar-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim().toLowerCase(), chave, novaSenha }) });
      const d = await r.json().catch(() => ({}));
      setOk(r.ok && d.sucesso === true); setMsg(d.mensagem || 'Não foi possível redefinir agora.');
      if (r.ok && d.sucesso === true) { setChave(''); setNovaSenha(''); }
    } catch { setMsg('Sem conexão com o servidor. Tente de novo.'); } finally { setEnviando(false); }
  };
  const enviar = async () => {
    setMsg(''); setOk(false); setEnviando(true);
    try {
      const r = await fetch('/api/auth/esqueci-senha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: email.trim().toLowerCase() }) });
      const d = await r.json().catch(() => ({}));
      setOk(r.ok && d.sucesso === true); setMsg(d.mensagem || d.motivo || 'Não foi possível enviar agora.');
    } catch { setMsg('Sem conexão com o servidor. Tente de novo.'); } finally { setEnviando(false); }
  };
  if (!aberto) return <button type="button" onClick={() => { setAberto(true); setEmail(loginInicial); }} className="text-sm text-blue-800 underline">Esqueci minha senha</button>;
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="font-semibold text-slate-800">Recuperar senha por e-mail</p>
      <p className="text-xs text-slate-600">Digite o e-mail do seu usuário. Vamos enviar um link para você criar uma nova senha.</p>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu e-mail" className="w-full rounded-lg border border-slate-300 p-2 text-slate-900" />
      <div className="flex gap-2">
        <button type="button" disabled={enviando || !email.includes('@')} onClick={() => void enviar()} className="rounded-lg bg-slate-800 px-3 py-2 text-white disabled:opacity-60">{enviando ? 'Enviando…' : 'Enviar link'}</button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-lg border px-3 py-2">Fechar</button>
      </div>
      {!modoAdmin ? (
        <button type="button" onClick={() => setModoAdmin(true)} className="text-xs text-slate-600 underline">Sou a administradora do sistema e tenho a chave de recuperação</button>
      ) : (
        <div className="space-y-2 border-t border-slate-200 pt-2">
          <p className="text-xs text-slate-600">Use o e-mail da administradora, a chave de recuperação cadastrada no Render (FISCOIA_CHAVE_RECUPERACAO) e uma nova senha de pelo menos 12 caracteres.</p>
          <input type="password" autoComplete="off" value={chave} onChange={(e) => setChave(e.target.value)} placeholder="chave de recuperação" className="w-full rounded-lg border border-slate-300 p-2 text-slate-900" />
          <input type="password" autoComplete="new-password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="nova senha (mín. 12 caracteres)" className="w-full rounded-lg border border-slate-300 p-2 text-slate-900" />
          <button type="button" disabled={enviando || !email.includes('@') || !chave || novaSenha.length < 12} onClick={() => void recuperarAdmin()} className="rounded-lg bg-indigo-700 px-3 py-2 text-white disabled:opacity-60">{enviando ? 'Redefinindo…' : 'Redefinir senha da administradora'}</button>
        </div>
      )}
      {msg && <p role="status" className={ok ? 'text-green-800' : 'text-red-700'}>{msg}</p>}
    </div>
  );
}
