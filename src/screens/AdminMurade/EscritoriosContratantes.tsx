import { useEffect, useState, FormEvent } from 'react';

type Escritorio = { id: string; nome: string; responsavel: string; usuarios: number; limiteUsuarios?: number | null; bloqueado: boolean; criadoEm: string };

// Painel do dono do sistema: contrata e bloqueia escritórios. Só mostra dados de contratação;
// as empresas, notas e certificados de cada escritório ficam fora do alcance desta conta.
export default function EscritoriosContratantes() {
  const [lista, setLista] = useState<Escritorio[]>([]);
  const [disponivel, setDisponivel] = useState(true);
  const [aviso, setAviso] = useState('');
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');
  const [form, setForm] = useState({ nomeEscritorio: '', nome: '', email: '' });

  const carregar = () => fetch('/api/auth/escritorios', { credentials: 'same-origin', cache: 'no-store' })
    .then((r) => r.json())
    .then((d) => { setDisponivel(d.disponivel !== false); setAviso(d.mensagem || ''); setLista(Array.isArray(d.escritorios) ? d.escritorios : []); })
    .catch(() => setLista([]));
  useEffect(() => { void carregar(); }, []);

  const chamar = async (url: string, corpo: object) => {
    const r = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.mensagem || 'Não foi possível concluir.');
    return d;
  };
  const criar = async (e: FormEvent) => {
    e.preventDefault(); setMsg(''); setLink('');
    try { const d = await chamar('/api/auth/escritorios', form); setLink(d.conviteUrl); setForm({ nomeEscritorio: '', nome: '', email: '' }); await carregar(); }
    catch (c) { setMsg(c instanceof Error ? c.message : 'Falha.'); }
  };
  const definirLimite = async (x: Escritorio) => {
    const resp = window.prompt(`Quantos usuários o escritório ${x.nome} contratou (dono incluso)? Deixe vazio para sem limite.`, x.limiteUsuarios == null ? '' : String(x.limiteUsuarios));
    if (resp === null) return;
    try { await chamar(`/api/auth/escritorios/${encodeURIComponent(x.id)}/limite`, { limite: resp.trim() === '' ? null : Number(resp) }); await carregar(); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível definir o limite.'); }
  };
  const alternar = async (x: Escritorio) => {
    if (!window.confirm(x.bloqueado ? `Liberar o escritório ${x.nome}?` : `Bloquear o escritório ${x.nome}? Ninguém dele (equipe e clientes) consegue entrar; nada é apagado.`)) return;
    try { await chamar(`/api/auth/escritorios/${encodeURIComponent(x.id)}/bloqueio`, { bloqueado: !x.bloqueado }); await carregar(); }
    catch (c) { setMsg(c instanceof Error ? c.message : 'Falha.'); }
  };

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-slate-900">Escritórios contratantes</h2>
      <p className="mb-3 text-xs text-slate-600">Você contrata e bloqueia escritórios. Não tem acesso às empresas, notas ou certificados deles.</p>
      {!disponivel && <p role="alert" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{aviso || 'Recurso aguardando atualização do banco.'}</p>}
      <form onSubmit={criar} className="grid gap-2 md:grid-cols-4">
        <input required value={form.nomeEscritorio} onChange={(e) => setForm({ ...form, nomeEscritorio: e.target.value })} placeholder="Nome do escritório" className="rounded-lg border p-2" />
        <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do responsável" className="rounded-lg border p-2" />
        <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-mail do responsável" className="rounded-lg border p-2" />
        <button disabled={!disponivel} className="rounded-lg bg-slate-800 p-2 font-semibold text-white disabled:opacity-50">Criar escritório e gerar convite</button>
      </form>
      {link && <div className="mt-3 break-all rounded-lg border border-green-300 bg-green-50 p-3 text-sm"><strong>Link de uso único (30 dias):</strong> <a className="text-blue-800 underline" href={link}>{link}</a> <button type="button" className="ml-2 rounded bg-green-800 px-2 py-1 text-white" onClick={() => void navigator.clipboard.writeText(link)}>Copiar</button></div>}
      {msg && <p role="alert" className="mt-2 text-sm text-red-700">{msg}</p>}
      {lista.length > 0 && <div className="mt-4">{lista.map((x) => (
        <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2 text-sm">
          <span><strong>{x.nome}</strong> · {x.responsavel || 'sem responsável'} · {x.usuarios} de {x.limiteUsuarios ?? 'sem limite'} usuário(s) · {x.bloqueado ? <span className="font-semibold text-red-700">BLOQUEADO</span> : <span className="text-emerald-700">ativo</span>}</span>
          <button onClick={() => void definirLimite(x)} className="rounded bg-slate-700 px-3 py-1 text-white">Limite</button>
          <button onClick={() => void alternar(x)} className={x.bloqueado ? 'rounded bg-emerald-700 px-3 py-1 text-white' : 'rounded bg-red-700 px-3 py-1 text-white'}>{x.bloqueado ? 'Liberar' : 'Bloquear (falta de pagamento)'}</button>
        </div>))}</div>}
    </section>
  );
}
