import React, { useCallback, useEffect, useState } from 'react';
import { avisarSessaoExpirada, statusIndicaSessaoExpirada } from '../services/auth/sessaoExpirada';

interface Escritorio { escritorioId: string; nome: string; responsavel: string; empresas: number; liberado: boolean }
interface Linha { escritorioId: string; escritorio: string; empresaId: string; cnpj: string; nome: string; liberada: boolean; pediuEm: string | null; liberadaEm: string | null }

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Painel do dono: libera (ou volta a travar) a consulta ao SERPRO, uma empresa por vez. Só aparece para a conta administradora. */
export default function LiberacaoConsultaSerpro() {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [oculto, setOculto] = useState(false);
  const [salvando, setSalvando] = useState('');
  const [escritorios, setEscritorios] = useState<Escritorio[] | null>(null);
  const [erroEscritorios, setErroEscritorios] = useState('');

  const carregarEscritorios = useCallback(async () => {
    try {
      const r = await fetch('/api/serpro/liberacoes/escritorios', { credentials: 'same-origin', cache: 'no-store' });
      if (statusIndicaSessaoExpirada(r.status)) { avisarSessaoExpirada(); return; }
      if (r.status === 403) return;
      const j = await r.json();
      if (!r.ok) { setErroEscritorios(j.mensagem ?? 'Não foi possível carregar os escritórios.'); return; }
      setErroEscritorios(''); setEscritorios(j.escritorios as Escritorio[]);
    } catch { setErroEscritorios('Não foi possível carregar os escritórios.'); }
  }, []);
  useEffect(() => { void carregarEscritorios(); }, [carregarEscritorios]);

  const carregar = useCallback(async (termo: string) => {
    try {
      const r = await fetch(`/api/serpro/liberacoes?${new URLSearchParams(termo ? { busca: termo } : {})}`, { credentials: 'same-origin', cache: 'no-store' });
      if (statusIndicaSessaoExpirada(r.status)) { avisarSessaoExpirada(); return; } // sessão acabou: o App mostra o login; não esconde o painel
      if (r.status === 403) { setOculto(true); return; } // logado, mas não é o dono: painel fica escondido
      setOculto(false);
      const j = await r.json();
      if (!r.ok) { setErro(j.mensagem ?? 'Não foi possível carregar.'); return; }
      setErro(''); setLinhas(j.empresas as Linha[]);
    } catch { setErro('Não foi possível carregar a liberação das consultas.'); }
  }, []);

  useEffect(() => { const t = setTimeout(() => { void carregar(busca); }, 300); return () => clearTimeout(t); }, [busca, carregar]);

  // Sessão rechecada com sucesso (foco da aba / intervalo / novo login): recarrega o painel.
  useEffect(() => {
    const recarregar = () => { void carregarEscritorios(); void carregar(busca); };
    window.addEventListener('fiscoia_auth_session_updated', recarregar);
    return () => window.removeEventListener('fiscoia_auth_session_updated', recarregar);
  }, [carregar, carregarEscritorios, busca]);

  const alterar = async (l: Linha, liberada: boolean) => {
    if (liberada && !window.confirm(`Liberar a consulta ao SERPRO para ${l.nome} (${l.escritorio})? A consulta grátis da semana passa a valer só para esta empresa.`)) return;
    setSalvando(l.empresaId);
    try {
      const r = await fetch(`/api/serpro/liberacoes/${encodeURIComponent(l.empresaId)}`, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ liberada }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErro(j.mensagem ?? 'Não foi possível salvar.'); else { setErro(''); await carregar(busca); }
    } catch { setErro('Não foi possível salvar a liberação.'); }
    setSalvando('');
  };

  const alterarEscritorio = async (e: Escritorio, liberado: boolean) => {
    const pergunta = liberado
      ? `Liberar o escritório ${e.nome} POR INTEIRO?\n\nTodas as empresas dele (as de hoje e as que ele cadastrar depois) e todos os usuários dele passam a poder consultar o SERPRO sem pedir liberação. Cada consulta continua sendo feita só por clique e contada na cota.`
      : `Travar o escritório ${e.nome}?\n\nAs empresas dele voltam a depender da liberação empresa por empresa.`;
    if (!window.confirm(pergunta)) return;
    setSalvando(`esc-${e.escritorioId}`);
    try {
      const r = await fetch(`/api/serpro/liberacoes/escritorios/${encodeURIComponent(e.escritorioId)}`, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ liberado }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErroEscritorios(j.mensagem ?? 'Não foi possível salvar.'); else { setErroEscritorios(''); await carregarEscritorios(); await carregar(busca); }
    } catch { setErroEscritorios('Não foi possível salvar a liberação do escritório.'); }
    setSalvando('');
  };

  if (oculto) return null;
  const pedidos = (linhas ?? []).filter(l => !l.liberada && l.pediuEm).length;
  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-slate-900">Liberar consultas do SERPRO por empresa</h3>
          <p className="text-sm text-slate-700">Toda empresa de escritório cliente começa travada. A consulta (inclusive a grátis da semana) só funciona depois que você libera aquela empresa.</p>
        </div>
        <label className="flex flex-col text-xs font-bold text-slate-800 gap-1">Buscar empresa, CNPJ ou escritório
          <input value={busca} onChange={e => setBusca(e.target.value)} className="border border-slate-400 rounded-lg px-2 py-1 text-sm" placeholder="Digite para filtrar" />
        </label>
      </header>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
        <h4 className="text-sm font-extrabold text-slate-900">Liberar um escritório inteiro</h4>
        <p className="text-xs text-slate-700">Escritório liberado por inteiro: todas as empresas e todos os usuários dele consultam sem pedir liberação. As empresas dele não aparecem na lista de baixo.</p>
        {erroEscritorios && <p className="text-sm text-red-700">{erroEscritorios}</p>}
        {escritorios && escritorios.length === 0 && <p className="text-sm text-slate-700">Nenhum escritório cliente cadastrado.</p>}
        {escritorios && escritorios.length > 0 && (
          <ul className="space-y-1.5">{escritorios.map(e => (
            <li key={e.escritorioId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="min-w-0"><span className="font-semibold text-slate-900">{e.nome}</span> <span className="text-xs text-slate-600 break-all">{e.responsavel}</span> <span className="text-xs text-slate-600">· {e.empresas} empresa(s)</span></span>
              <span className="flex items-center gap-2">
                {e.liberado ? <span className="text-xs font-bold text-emerald-800">Liberado por inteiro</span> : <span className="text-xs text-slate-700">Empresa por empresa</span>}
                {e.liberado
                  ? <button disabled={salvando === `esc-${e.escritorioId}`} onClick={() => void alterarEscritorio(e, false)} className="rounded-lg border border-slate-400 text-slate-900 text-xs font-bold px-3 py-1.5 disabled:opacity-50">Travar</button>
                  : <button disabled={salvando === `esc-${e.escritorioId}`} onClick={() => void alterarEscritorio(e, true)} className="rounded-lg bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 disabled:opacity-50">Liberar escritório</button>}
              </span>
            </li>
          ))}</ul>
        )}
      </div>
      {pedidos > 0 && <p className="rounded-lg bg-amber-50 border border-amber-300 p-2 text-sm font-semibold text-amber-950">{pedidos} empresa(s) tentaram consultar e estão esperando sua liberação (aparecem primeiro).</p>}
      {erro && <p className="text-sm text-red-700">{erro}</p>}
      {linhas && linhas.length === 0 && <p className="text-sm text-slate-700">Nenhuma empresa encontrada.</p>}
      {linhas && linhas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-slate-300"><th className="py-1 pr-2">Escritório</th><th className="pr-2">Empresa</th><th className="pr-2">CNPJ</th><th className="pr-2">Situação</th><th className="text-right">Ação</th></tr></thead>
            <tbody>{linhas.map(l => (
              <tr key={l.empresaId} className="border-b border-slate-100">
                <td className="py-1 pr-2">{l.escritorio}</td>
                <td className="pr-2 font-semibold">{l.nome}</td>
                <td className="pr-2">{l.cnpj}</td>
                <td className="pr-2">{l.liberada ? <span className="font-bold text-emerald-800">Liberada{l.liberadaEm ? ` em ${dataHora(l.liberadaEm)}` : ''}</span> : l.pediuEm ? <span className="font-bold text-amber-900">Pediu em {dataHora(l.pediuEm)}</span> : <span className="text-slate-700">Travada</span>}</td>
                <td className="text-right">
                  {l.liberada
                    ? <button disabled={salvando === l.empresaId} onClick={() => void alterar(l, false)} className="rounded-lg border border-slate-400 text-slate-900 text-xs font-bold px-3 py-1.5 disabled:opacity-50">Travar</button>
                    : <button disabled={salvando === l.empresaId} onClick={() => void alterar(l, true)} className="rounded-lg bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 disabled:opacity-50">Liberar</button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
          {linhas.length >= 300 && <p className="text-xs text-slate-700 mt-1">Mostrando as primeiras 300; use a busca para achar outras.</p>}
        </div>
      )}
    </section>
  );
}
