import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Link2, LockKeyhole, ShieldCheck, Trash2, Unlock, Users } from 'lucide-react';
import { definirBloqueioMembro, gerarLinkAcessoMembro, listarEquipeEscritorio, MembroEquipe, removerMembroEquipe } from '../services/auth/auth.service';

export default function GestaoEquipe() {
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [linkPorMembro, setLinkPorMembro] = useState<Record<string, { link: string; primeiroAcesso: boolean }>>({});
  const [copiado, setCopiado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      setMembros(await listarEquipeEscritorio());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível consultar a equipe.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const link = async (m: MembroEquipe) => {
    setErro(''); setMensagem('');
    try {
      const resultado = await gerarLinkAcessoMembro(m.id);
      setLinkPorMembro((atual) => ({ ...atual, [m.id]: resultado }));
      setMensagem(resultado.primeiroAcesso ? 'Novo link de primeiro acesso gerado.' : 'Link seguro para redefinir a senha gerado.');
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível gerar o link.'); }
  };

  const alternar = async (m: MembroEquipe) => {
    setErro(''); setMensagem('');
    try { await definirBloqueioMembro(m.id, m.ativo); await carregar(); setMensagem(m.ativo ? 'Acesso bloqueado.' : 'Acesso desbloqueado.'); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível alterar o acesso.'); }
  };

  const remover = async (m: MembroEquipe) => {
    if (!window.confirm(`Remover ${m.email} deste escritório? O acesso será encerrado e os dados da conta serão preservados.`)) return;
    setErro(''); setMensagem('');
    try { await removerMembroEquipe(m.id); setLinkPorMembro((atual) => { const novo={...atual}; delete novo[m.id]; return novo; }); await carregar(); setMensagem('Membro removido; os dados foram preservados.'); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível remover o membro.'); }
  };

  const equipe = membros.filter((m) => m.papel === 'CONTADOR');
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Users className="h-5 w-5 text-indigo-700" />
        <h2 className="text-sm font-black text-slate-900">Equipe do escritório</h2>
      </div>
      <p className="mt-3 text-xs text-slate-600">O responsável do escritório pode bloquear ou remover membros e emitir um link individual de acesso ou redefinição de senha. Links expiram em 24 horas e só podem ser usados uma vez.</p>
      {erro && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{erro}</p>}
      {mensagem && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{mensagem}</p>}
      {carregando ? <p className="mt-4 text-xs text-slate-500">Carregando equipe…</p> : (
        equipe.length ? <div className="mt-3 divide-y divide-slate-100">
          {equipe.map((m) => (
            <div key={m.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{m.nome}</p>
                  <p className="truncate text-xs text-slate-500">{m.email} · {m.ativo ? 'Ativo' : 'Bloqueado'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void alternar(m)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold">
                    {m.ativo ? <LockKeyhole size={14} /> : <Unlock size={14} />}{m.ativo ? 'Bloquear' : 'Desbloquear'}
                  </button>
                  <button type="button" disabled={!m.ativo} onClick={() => void link(m)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50">
                    <Link2 size={14} />{m.ativo ? 'Gerar link de acesso/senha' : 'Desbloqueie para gerar link'}
                  </button>
                  <button type="button" onClick={() => void remover(m)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700">
                    <Trash2 size={14} />Remover
                  </button>
                </div>
              </div>
              {linkPorMembro[m.id] && (
                <div className="mt-2 break-all rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-slate-800">
                  <p className="font-semibold">{linkPorMembro[m.id].primeiroAcesso ? 'Link de primeiro acesso:' : 'Link de redefinição de senha:'}</p>
                  <a className="mt-1 block text-blue-800 underline" href={linkPorMembro[m.id].link}>{linkPorMembro[m.id].link}</a>
                  <button type="button" onClick={async () => { await navigator.clipboard.writeText(linkPorMembro[m.id].link); setCopiado(m.id); }} className="mt-2 inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-white">
                    {copiado === m.id ? <Check size={13} /> : <Copy size={13} />}{copiado === m.id ? 'Copiado' : 'Copiar link'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div> : <p className="mt-4 text-xs text-slate-500"><ShieldCheck className="mr-1 inline h-4 w-4" />Nenhum membro da equipe cadastrado neste escritório.</p>
      )}
    </section>
  );
}
