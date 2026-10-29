import { useEffect, useState, FormEvent } from 'react';
import { confirmarNaTela, perguntarNaTela } from '../../utils/dialogoNaTela';

type Escritorio = { id: string; nome: string; responsavel: string; usuarios: number; limiteUsuarios?: number | null; cnpj?: string | null; bloqueado: boolean; criadoEm: string };

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
  const [conta, setConta] = useState<{ email: string; donoDeEscritorio: boolean; ehVoce: boolean; escritorios: number } | null>(null);
  const criar = async (e?: FormEvent) => {
    e?.preventDefault(); setMsg(''); setLink(''); setConta(null);
    try { const d = await chamar('/api/auth/escritorios', form); setLink(d.conviteUrl); setForm({ nomeEscritorio: '', nome: '', email: '' }); await carregar(); }
    catch (c) {
      const texto = c instanceof Error ? c.message : 'Falha.'; setMsg(texto);
      if (/já existe/i.test(texto)) {
        // Mostra o que é essa conta e oferece apagá-la, para o e-mail poder ser cadastrado de novo.
        try { const email = form.email.trim().toLowerCase(); const d = await chamar('/api/auth/contas/resumo', { email });
          if (d.existe) setConta({ email, donoDeEscritorio: d.donoDeEscritorio === true, ehVoce: d.ehVoce === true, escritorios: Number(d.escritorios || 0) }); } catch (x) { setMsg(x instanceof Error ? `${texto} ${x.message}` : texto); }
      }
    }
  };
  const excluirConta = async (c: { email: string }) => {
    if (!await confirmarNaTela(`EXCLUIR a conta ${c.email}? Ela perde o acesso e não tem volta. Os dados das empresas não são apagados. Depois o e-mail fica livre para cadastrar de novo.`)) return;
    try { await chamar('/api/auth/contas/excluir', { email: c.email, confirmar: true }); setConta(null); setMsg(''); await criar(); } catch (x) { setMsg(x instanceof Error ? x.message : 'Não foi possível excluir a conta.'); }
  };
  const excluir = async (x: Escritorio) => {
    if (!await confirmarNaTela(`EXCLUIR de vez o escritório ${x.nome}? As contas do responsável e da equipe são apagadas e não tem volta. Os e-mails ficam livres para cadastrar de novo.`)) return;
    if ((await perguntarNaTela(`Para confirmar, digite o nome do escritório: ${x.nome}`))?.trim().toLowerCase() !== x.nome.trim().toLowerCase()) { setMsg('Exclusão cancelada: o nome digitado não confere.'); return; }
    setMsg('');
    try { const d = await chamar(`/api/auth/escritorios/${encodeURIComponent(x.id)}/excluir`, { confirmar: true }); setMsg(d.mensagem || 'Escritório excluído.'); await carregar(); }
    catch (c) { setMsg(c instanceof Error ? c.message : 'Não foi possível excluir.'); }
  };
  const definirLimite = async (x: Escritorio) => {
    const resp = await perguntarNaTela(`Quantos usuários o escritório ${x.nome} contratou (dono incluso)? Deixe vazio para sem limite.`, x.limiteUsuarios == null ? '' : String(x.limiteUsuarios));
    if (resp === null) return;
    try { await chamar(`/api/auth/escritorios/${encodeURIComponent(x.id)}/limite`, { limite: resp.trim() === '' ? null : Number(resp) }); await carregar(); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível definir o limite.'); }
  };
  const definirCnpj = async (x: Escritorio) => {
    const resp = await perguntarNaTela(`CNPJ do escritório ${x.nome}. As empresas dele devem autorizar ESTE CNPJ no e-CAC (é ele que consulta a Receita). Se este escritório tiver outro CNPJ que não o seu, ele também precisa cadastrar o certificado e-CNPJ A1 dele no Murade Fiscal. Deixe vazio para NÃO liberar as consultas à Receita deste escritório.`, x.cnpj ?? '');
    if (resp === null) return;
    try { await chamar(`/api/auth/escritorios/${encodeURIComponent(x.id)}/cnpj`, { cnpj: resp.trim() === '' ? null : resp.trim() }); await carregar(); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível salvar o CNPJ.'); }
  };
  const alternar = async (x: Escritorio) => {
    if (!await confirmarNaTela(x.bloqueado ? `Liberar o escritório ${x.nome}?` : `Bloquear o escritório ${x.nome}? Ninguém dele (equipe e clientes) consegue entrar; nada é apagado.`)) return;
    try { await chamar(`/api/auth/escritorios/${encodeURIComponent(x.id)}/bloqueio`, { bloqueado: !x.bloqueado }); await carregar(); }
    catch (c) { setMsg(c instanceof Error ? c.message : 'Falha.'); }
  };

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-slate-900">Escritórios contratantes</h2>
      <p className="mb-3 text-xs text-slate-600">Você contrata e bloqueia escritórios. Não tem acesso às empresas, notas ou certificados deles.</p>
      {!disponivel && <p role="alert" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{aviso || 'Recurso aguardando atualização do banco.'}</p>}
      <form onSubmit={criar} className="grid gap-2 md:grid-cols-4">
        <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Usuário (e-mail) do dono do escritório" className="min-w-0 rounded-lg border p-2 md:col-span-3" />
        <button disabled={!disponivel} className="rounded-lg bg-slate-800 p-2 font-semibold text-white disabled:opacity-50">Gerar convite do escritório</button>
      </form>
      {link && <div className="mt-3 break-all rounded-lg border border-green-300 bg-green-50 p-3 text-sm"><strong>Link de uso único (30 dias):</strong> <a className="text-blue-800 underline" href={link}>{link}</a> <button type="button" className="ml-2 rounded bg-green-800 px-2 py-1 text-white" onClick={() => void navigator.clipboard.writeText(link)}>Copiar</button></div>}
      {msg && <p role="alert" className="mt-2 text-sm text-red-700">{msg}</p>}
      {conta && <div className="mt-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm">{conta.ehVoce ? <p>Esta é a sua própria conta; use outro e-mail para o escritório.</p> : conta.donoDeEscritorio ? <p>Este e-mail é dono de um escritório. Use o botão <strong>Excluir</strong> na lista abaixo para apagar o escritório inteiro e liberar o e-mail.</p> : <><p>Esta conta já existe{conta.escritorios ? ` e participa de ${conta.escritorios} escritório(s)` : ''}. Para cadastrar este e-mail como escritório, apague a conta antiga primeiro.</p><button type="button" onClick={() => void excluirConta(conta)} className="mt-2 rounded bg-red-700 px-3 py-1.5 font-semibold text-white">Excluir esta conta e liberar o e-mail</button></>}</div>}
      {lista.length > 0 && <div className="mt-4">{lista.map((x) => (
        <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2 text-sm">
          <span><strong>{x.nome}</strong> · {x.responsavel || 'sem responsável'} · {x.usuarios} de {x.limiteUsuarios ?? 'sem limite'} usuário(s) · {x.bloqueado ? <span className="font-semibold text-red-700">BLOQUEADO</span> : <span className="text-emerald-700">ativo</span>}</span>
          <button onClick={() => void definirLimite(x)} className="rounded bg-slate-700 px-3 py-1 text-white">Limite</button>
          <button onClick={() => void definirCnpj(x)} title="CNPJ do escritório: autor das consultas à Receita (Serpro)" className="rounded bg-slate-700 px-3 py-1 text-white">{x.cnpj ? `CNPJ ${x.cnpj}` : 'CNPJ do escritório'}</button>
          <button onClick={() => void alternar(x)} className={x.bloqueado ? 'rounded bg-emerald-700 px-3 py-1 text-white' : 'rounded bg-red-700 px-3 py-1 text-white'}>{x.bloqueado ? 'Liberar' : 'Bloquear (falta de pagamento)'}</button>
          <button onClick={() => void excluir(x)} className="rounded bg-red-900 px-3 py-1 font-semibold text-white">Excluir</button>
        </div>))}</div>}
    </section>
  );
}
