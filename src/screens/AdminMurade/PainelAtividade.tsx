import React, { useEffect, useState } from 'react';

// Atividade da equipe: o responsável do escritório vê quem alterou o quê, quando e em qual empresa.
type Atividade = { usuario: string; acao: string; cnpj: string | null; quando: string };

export default function PainelAtividade() {
  const [itens, setItens] = useState<Atividade[]>([]);
  const [usuario, setUsuario] = useState('');
  const [msg, setMsg] = useState('');
  const carregar = () => fetch(`/api/auth/atividade?limite=100${usuario ? `&usuario=${encodeURIComponent(usuario)}` : ''}`, { credentials: 'include', cache: 'no-store' })
    .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
    .then(({ ok, d }) => { if (!ok) throw new Error(d.mensagem || 'Falha.'); setItens(Array.isArray(d.atividades) ? d.atividades : []); setMsg(d.disponivel === false ? String(d.mensagem || '') : ''); })
    .catch((e) => { setItens([]); setMsg(e instanceof Error ? e.message : 'Falha.'); });
  useEffect(() => { void carregar(); }, []);
  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-1 font-semibold">Atividade da equipe</h3>
      <p className="mb-2 text-xs text-slate-600">Últimas alterações feitas por você e pela equipe: quem, o quê e quando. Fica guardado por 180 dias. Não mostra o conteúdo dos dados.</p>
      <form onSubmit={(e) => { e.preventDefault(); void carregar(); }} className="flex gap-2">
        <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Filtrar por usuário (e-mail)" className="min-w-0 flex-1 rounded-lg border p-2" />
        <button className="rounded-lg bg-slate-800 px-3 text-white">Filtrar</button>
      </form>
      {msg && <p role="alert" className="mt-2 text-sm text-red-700">{msg}</p>}
      {!msg && itens.length === 0 && <p className="mt-2 text-sm text-slate-500">Nenhuma atividade registrada ainda.</p>}
      {itens.length > 0 && <div className="mt-3 max-h-80 overflow-auto">{itens.map((a, i) => (
        <div key={i} className="border-t py-2 text-sm"><strong>{a.usuario}</strong> · {a.acao}{a.cnpj ? ` · empresa ${a.cnpj}` : ''}<span className="block text-xs text-slate-500">{new Date(a.quando).toLocaleString('pt-BR')}</span></div>
      ))}</div>}
    </div>
  );
}
