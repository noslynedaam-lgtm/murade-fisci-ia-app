import React, { useEffect, useState } from 'react';
import CotaConsultasSerpro from './CotaConsultasSerpro';

interface Prontidao { pronto: boolean; itens: { chave: string; ok: boolean; descricao: string }[]; servicos: { chave: string; descricao: string }[] }

/** Consulta oficial real ao SERPRO (Integra Contador) para a empresa ativa. Só a conta administradora; o servidor trava o custo. */
export default function ConsultaRealSerpro({ companyId, tenantId, razaoSocial }: { companyId?: string; tenantId?: string; razaoSocial?: string }) {
  const [prontidao, setProntidao] = useState<Prontidao | null>(null);
  const [servico, setServico] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [exigeConfirmar, setExigeConfirmar] = useState<string | null>(null);
  const [resposta, setResposta] = useState<{ ok: boolean; titulo: string; texto: string; bruto?: unknown } | null>(null);
  const [versaoCota, setVersaoCota] = useState(0);

  useEffect(() => {
    let ativo = true;
    fetch('/api/serpro/prontidao', { credentials: 'same-origin', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Prontidao) => { if (ativo) { setProntidao(d); setServico(s => s || d.servicos[0]?.chave || ''); } })
      .catch(() => { if (ativo) setProntidao(null); });
    return () => { ativo = false; };
  }, []);

  if (!companyId || !tenantId) {
    return <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">Selecione uma empresa ativa (já cadastrada no Fisco IA) para fazer a consulta oficial.</div>;
  }

  async function consultar(confirmarCusto: boolean) {
    setCarregando(true); setResposta(null);
    try {
      const r = await fetch('/api/serpro/consulta', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servico, tenantId, companyId, confirmarCusto }),
      });
      const d = await r.json().catch(() => ({})) as { consultado?: boolean; exigeConfirmacao?: boolean; mensagem?: string; faltando?: string[]; bruto?: unknown; statusGateway?: number };
      if (r.status === 402 && d.exigeConfirmacao) { setExigeConfirmar(d.mensagem || 'Esta consulta será cobrada à parte pelo SERPRO.'); return; }
      setExigeConfirmar(null);
      if (r.ok && d.consultado) setResposta({ ok: true, titulo: 'Consulta feita no SERPRO', texto: 'Resposta oficial abaixo (nada foi inventado ou alterado no sistema).', bruto: d.bruto });
      else setResposta({ ok: false, titulo: 'Consulta não concluída', texto: [d.mensagem, d.faltando?.length ? `Falta: ${d.faltando.join('; ')}` : '', d.statusGateway ? `Resposta do SERPRO: HTTP ${d.statusGateway}` : ''].filter(Boolean).join(' · ') || `Erro HTTP ${r.status}.`, bruto: d.bruto });
      setVersaoCota(v => v + 1);
    } catch {
      setResposta({ ok: false, titulo: 'Consulta não concluída', texto: 'Não foi possível falar com o servidor. Nada foi consultado.' });
    } finally { setCarregando(false); }
  }

  const faltando = prontidao?.itens.filter(i => !i.ok) ?? [];
  return (
    <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3 text-sm text-slate-900">
      <div>
        <p className="font-black">Consulta oficial real (SERPRO) · {razaoSocial || 'empresa ativa'}</p>
        <p className="text-xs text-slate-700 mt-1">Usa as chaves e o certificado do escritório no servidor. Só a conta administradora. A empresa precisa ter dado procuração ao escritório no e-CAC. Primeira consulta da semana por empresa é gratuita no controle do sistema; as seguintes pedem a sua confirmação.</p>
      </div>
      {faltando.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
          <strong>Ainda falta configurar no Render:</strong>
          <ul className="list-disc ml-5 mt-1">{faltando.map(i => <li key={i.chave}>{i.descricao}</li>)}</ul>
        </div>
      )}
      <CotaConsultasSerpro key={versaoCota} companyId={companyId} tenantId={tenantId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-[11px] font-bold text-slate-700 gap-1">Tipo de consulta
          <select value={servico} onChange={e => setServico(e.target.value)} className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl min-w-56">
            {(prontidao?.servicos ?? []).map(s => <option key={s.chave} value={s.chave}>{s.descricao}</option>)}
          </select>
        </label>
        <button type="button" disabled={carregando || !servico || faltando.length > 0} onClick={() => consultar(false)}
          className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white rounded-xl text-xs font-black cursor-pointer">
          {carregando ? 'Consultando…' : 'Fazer consulta real'}
        </button>
      </div>
      {exigeConfirmar && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 space-y-2" role="alertdialog">
          <p>{exigeConfirmar}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => consultar(true)} className="px-3 py-2 bg-amber-700 text-white rounded-lg font-bold cursor-pointer">Confirmo o custo e quero consultar</button>
            <button type="button" onClick={() => setExigeConfirmar(null)} className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold cursor-pointer">Cancelar</button>
          </div>
        </div>
      )}
      {resposta && (
        <div className={`rounded-xl border p-3 text-xs ${resposta.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-red-300 bg-red-50 text-red-950'}`} role="status">
          <strong>{resposta.titulo}.</strong> {resposta.texto}
          {resposta.bruto !== undefined && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white/80 p-2 text-[11px]">{typeof resposta.bruto === 'string' ? resposta.bruto : JSON.stringify(resposta.bruto, null, 2)}</pre>}
        </div>
      )}
    </div>
  );
}
