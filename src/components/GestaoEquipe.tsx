import { useCallback, useEffect, useState } from 'react';
import { definirBloqueioMembro, excluirMembroEquipe, gerarLinkAcessoMembro, listarEquipeEscritorio, MembroEquipe, removerMembroEquipe } from '../services/auth/auth.service';

// Mesma tela de equipe dos demais sistemas Murade (Fiscal, Contábil, DP, Agente): convites pendentes + usuários.
export default function GestaoEquipe() {
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [linkPorMembro, setLinkPorMembro] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState('');
  const linkReparo = `${window.location.origin}/reparar.html`;

  const carregar = useCallback(async () => {
    try { setMembros(await listarEquipeEscritorio()); setErro(''); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível consultar a equipe.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const executar = async (acao: () => Promise<string | void>, confirmar?: string) => {
    if (confirmar && !window.confirm(confirmar)) return;
    setErro(''); setMensagem('');
    try { const m = await acao(); if (m) setMensagem(m); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível concluir.'); }
  };
  const gerarLink = (m: MembroEquipe) => executar(async () => { const r = await gerarLinkAcessoMembro(m.id); setLinkPorMembro((a) => ({ ...a, [m.id]: r.link })); });

  const equipe = membros.filter((m) => m.papel === 'CONTADOR');
  const pendentes = equipe.filter((m) => m.primeiroAcesso && m.ativo);
  const usuarios = equipe.filter((m) => !(m.primeiroAcesso && m.ativo));
  const LinkCaixa = ({ id }: { id: string }) => linkPorMembro[id] ? (
    <div className="mt-2 break-all rounded-lg border border-green-300 bg-green-50 p-3 text-sm"><strong>Link (24 horas):</strong> <a className="text-blue-800 underline" href={linkPorMembro[id]}>{linkPorMembro[id]}</a>
      <button type="button" className="ml-2 rounded bg-green-800 px-2 py-1 text-white" onClick={async () => { await navigator.clipboard.writeText(linkPorMembro[id]); setCopiado(id); }}>{copiado === id ? 'Copiado' : 'Copiar'}</button></div>
  ) : null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-1 font-semibold">Equipe do escritório</h3>
      <p className="mb-2 text-xs text-slate-600">Quem está na equipe acessa o escritório de qualquer computador, com a própria conta.</p>
      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><strong>Aplicativo instalado travou ou ficou desatualizado?</strong> Não precisa reenviar convite nem instalar de novo. Mande este link para a pessoa abrir uma vez; o usuário, a senha e os dados dela continuam iguais: <a className="break-all text-blue-800 underline" href="/reparar.html">{linkReparo}</a> <button type="button" className="ml-2 rounded bg-blue-800 px-2 py-1 text-white" onClick={() => void navigator.clipboard.writeText(linkReparo)}>Copiar</button></div>
      {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
      {mensagem && <p role="status" className="mt-2 text-sm text-green-800">{mensagem}</p>}
      {carregando ? <p className="mt-3 text-sm text-slate-500">Carregando equipe…</p> : (<>
        <div className="mt-3"><p className="text-xs font-semibold text-slate-700">Convites pendentes (valem 24 horas)</p>
          {pendentes.length === 0 && <p className="border-t py-2 text-sm text-slate-500">Nenhum convite pendente.</p>}
          {pendentes.map((m) => <div key={m.id} className="border-t py-2 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span>{m.email}</span><span className="flex gap-3">
            <button className="text-blue-800 hover:underline" onClick={() => void gerarLink(m)}>Reenviar (novo link)</button>
            <button className="text-red-700 hover:underline" onClick={() => void executar(() => excluirMembroEquipe(m.id), `Cancelar o convite de ${m.email}? O link deixa de funcionar.`)}>Cancelar convite</button></span></div><LinkCaixa id={m.id} /></div>)}
        </div>
        <div className="mt-3"><p className="text-xs font-semibold text-slate-700">Usuários da equipe</p>
          {usuarios.length === 0 && <p className="border-t py-2 text-sm text-slate-500">Nenhum usuário na equipe ainda.</p>}
          {usuarios.map((m) => <div key={m.id} className="border-t py-2 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span>{m.email}{!m.ativo && <em className="ml-2 text-xs text-amber-700">bloqueado</em>}</span><span className="flex flex-wrap gap-3">
            {m.ativo && <button className="text-blue-800 hover:underline" onClick={() => void gerarLink(m)}>Nova senha (gerar link)</button>}
            <button className="text-amber-700 hover:underline" onClick={() => void executar(() => definirBloqueioMembro(m.id, m.ativo), m.ativo ? `Bloquear ${m.email}? Ele sai na hora e não entra até você desbloquear.` : undefined)}>{m.ativo ? 'Bloquear' : 'Desbloquear'}</button>
            <button className="text-slate-700 hover:underline" onClick={() => void executar(() => removerMembroEquipe(m.id), `Tirar ${m.email} da equipe? Ele perde o acesso às empresas do escritório; nada é apagado.`)}>Tirar da equipe</button>
            <button className="text-red-700 hover:underline" onClick={() => void executar(() => excluirMembroEquipe(m.id), `EXCLUIR ${m.email}? A conta é apagada e não tem volta. Os dados das empresas não são apagados.`)}>Excluir</button></span></div><LinkCaixa id={m.id} /></div>)}
        </div></>)}
    </section>
  );
}
