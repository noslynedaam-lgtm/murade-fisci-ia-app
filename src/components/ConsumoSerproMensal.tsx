import React, { useEffect, useState } from 'react';

interface Linha { empresaId: string; cnpj: string; nome: string; consultas: number; gratuitas: number; cobradas: number; valorCobrado: number; custoAbsorvido: number }
interface Extrato { ciclo: string; de: string; ate: string; linhas: Linha[]; totalConsultas: number; totalGratuitas: number; totalCobradas: number; valorACobrar: number; custoAbsorvido: number }

const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dia = (iso: string) => iso.split('-').reverse().join('/');

/** Extrato mensal de consumo do SERPRO (só aparece para a conta administradora). */
export default function ConsumoSerproMensal({ tenantId }: { tenantId?: string }) {
  const [ciclo, setCiclo] = useState('');
  const [extrato, setExtrato] = useState<Extrato | null>(null);
  const [erro, setErro] = useState('');
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    let ativo = true;
    const q = new URLSearchParams({ tenantId, ...(ciclo ? { ciclo } : {}) });
    fetch(`/api/serpro/consumo?${q}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async r => {
        if (r.status === 403 || r.status === 401) { if (ativo) setOculto(true); return; }
        const j = await r.json();
        if (!ativo) return;
        if (!r.ok) { setErro(j.mensagem ?? 'Não foi possível carregar.'); return; }
        setErro(''); setExtrato(j as Extrato);
        if (!ciclo) setCiclo((j as Extrato).ciclo);
      })
      .catch(() => { if (ativo) setErro('Não foi possível carregar o consumo.'); });
    return () => { ativo = false; };
  }, [tenantId, ciclo]);

  if (!tenantId || oculto) return null;
  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-slate-900">Consumo do SERPRO para cobrança</h3>
          {extrato && <p className="text-sm text-slate-700">Ciclo {extrato.ciclo}: de {dia(extrato.de)} a {dia(extrato.ate)}</p>}
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col text-xs font-bold text-slate-800 gap-1">Mês de referência
            <input type="month" value={ciclo} onChange={e => setCiclo(e.target.value)} className="border border-slate-400 rounded-lg px-2 py-1 text-sm" />
          </label>
          {extrato && ciclo && (
            <a className="rounded-lg bg-slate-800 text-white text-sm font-bold px-3 py-2" href={`/api/serpro/consumo?${new URLSearchParams({ tenantId, ciclo, formato: 'csv' })}`}>Baixar Excel (.csv)</a>
          )}
        </div>
      </header>
      {erro && <p className="text-sm text-red-700">{erro}</p>}
      {extrato && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="rounded-lg bg-emerald-50 p-2"><div className="text-xs font-bold">A cobrar dos clientes</div><div className="text-lg font-extrabold">{reais(extrato.valorACobrar)}</div></div>
            <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs font-bold">Consultas no ciclo</div><div className="text-lg font-extrabold">{extrato.totalConsultas}</div></div>
            <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs font-bold">Cobradas</div><div className="text-lg font-extrabold">{extrato.totalCobradas}</div></div>
            <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs font-bold">Gratuitas (custo seu)</div><div className="text-lg font-extrabold">{extrato.totalGratuitas} · {reais(extrato.custoAbsorvido)}</div></div>
          </div>
          {extrato.linhas.length === 0 ? <p className="text-sm text-slate-700">Nenhuma consulta neste ciclo.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b border-slate-300"><th className="py-1 pr-2">Empresa</th><th className="pr-2">CNPJ</th><th className="pr-2 text-right">Consultas</th><th className="pr-2 text-right">Gratuitas</th><th className="pr-2 text-right">Cobradas</th><th className="text-right">A cobrar</th></tr></thead>
                <tbody>{extrato.linhas.map(l => (
                  <tr key={l.empresaId} className="border-b border-slate-100"><td className="py-1 pr-2 font-semibold">{l.nome}</td><td className="pr-2">{l.cnpj}</td><td className="pr-2 text-right">{l.consultas}</td><td className="pr-2 text-right">{l.gratuitas}</td><td className="pr-2 text-right">{l.cobradas}</td><td className="text-right font-bold">{reais(l.valorCobrado)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-600">Valores pelo contrato: consulta R$ 0,24 · emissão R$ 0,32 · declaração R$ 0,40. Confira com a fatura do SERPRO antes de lançar o boleto.</p>
        </>
      )}
    </section>
  );
}
