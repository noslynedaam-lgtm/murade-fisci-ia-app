import React, { useCallback, useEffect, useState } from 'react';

// Carteira fiscal › Envio ao Contábil: guias do DAS do MEI, dívida ativa e parcelamentos consultados por clique viram pré-lançamentos no
// Murad Contábil (a contadora confere lá, em Revisão das origens). "Enviar agora" reenvia o que ficou pendente; não consulta o Serpro.
interface Envios { totais: { enviados: number; erros: number; semContabil: number; semItens: number; pendentes: number }; ultimos: { id: string; empresa: string; tipo: string; situacao: string; mensagem: string | null; consultadoEm: string }[] }
const TIPO: Record<string, string> = { guia_das_mei: 'Guia do DAS (MEI)', divida_ativa_mei: 'Dívida ativa (MEI)', parcelamento_detalhe: 'Parcelamento' };
const SIT: Record<string, string> = { enviado: 'enviado', erro: 'erro', sem_contabil: 'empresa fora do Contábil', sem_itens: 'sem valor para lançar', pendente: 'pendente' };

export default function EnvioContabilPainel({ tenantId }: { tenantId: string }) {
  const [envios, setEnvios] = useState<Envios | null>(null);
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const carregar = useCallback(async () => {
    if (!tenantId) return;
    const r = await fetch(`/api/carteira-fiscal/envios-contabil?tenantId=${encodeURIComponent(tenantId)}`, { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
    if (r?.ok) setEnvios(await r.json());
  }, [tenantId]);
  useEffect(() => { void carregar(); }, [carregar]);
  async function enviarAgora() {
    setEnviando(true); setMsg('');
    try {
      const r = await fetch('/api/carteira-fiscal/enviar-contabil', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId }) });
      const d = await r.json().catch(() => ({})) as { mensagem?: string };
      setMsg(d.mensagem || (r.ok ? 'Enviado.' : 'Não foi possível enviar agora.'));
      await carregar();
    } catch { setMsg('Sem conexão com o servidor.'); } finally { setEnviando(false); }
  }
  if (!envios) return null;
  const t = envios.totais;
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-2 text-xs" data-painel="envio-contabil">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setAberto((v) => !v)} className="font-bold text-violet-900 text-left">Contábil: {t.enviados} enviado(s){t.pendentes ? `, ${t.pendentes} pendente(s)` : ''}{t.erros ? `, ${t.erros} com erro` : ''}{t.semContabil ? `, ${t.semContabil} de empresa fora do Contábil` : ''}</button>
        <button type="button" disabled={enviando} onClick={() => void enviarAgora()} className="rounded-lg border border-violet-400 bg-white px-2 py-1 font-bold text-violet-900 disabled:opacity-50" data-campo="enviar-contabil-agora">{enviando ? 'Enviando…' : 'Enviar ao Contábil agora'}</button>
      </div>
      {msg && <p className="mt-1 text-violet-900">{msg}</p>}
      {aberto && (
        <ul className="mt-1 divide-y divide-violet-100">
          {envios.ultimos.map((u) => <li key={u.id} className="py-1 flex flex-wrap justify-between gap-2"><span>{u.empresa} · {TIPO[u.tipo] || u.tipo} · {new Date(u.consultadoEm).toLocaleDateString('pt-BR')}</span><span className={u.situacao === 'erro' ? 'font-bold text-rose-700' : u.situacao === 'enviado' ? 'text-emerald-700' : 'text-slate-600'} title={u.mensagem || ''}>{SIT[u.situacao] || u.situacao}</span></li>)}
          {!envios.ultimos.length && <li className="py-1 text-slate-600">Nenhuma guia, dívida ativa ou parcelamento consultado ainda.</li>}
        </ul>
      )}
      <p className="mt-1 text-[11px] text-violet-800">Guias do DAS do MEI, dívida ativa e detalhe de parcelamento consultados aqui viram pré-lançamentos no Contábil, para conferir. O envio não consulta o Serpro de novo.</p>
    </div>
  );
}
