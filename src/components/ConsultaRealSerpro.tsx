import React, { useEffect, useMemo, useState } from 'react';
import CotaConsultasSerpro from './CotaConsultasSerpro';
import { declaracoesParaCsv, lerDeclaracoes, type LinhaDeclaracao } from '../services/serpro/resultadoSerpro';

interface Campo { nome: string; rotulo: string; exemplo: string }
interface Prontidao { pronto: boolean; itens: { chave: string; ok: boolean; descricao: string }[]; servicos: { chave: string; descricao: string; campos?: Campo[] }[] }
interface Resposta { ok: boolean; titulo: string; texto: string; bruto?: unknown; servico?: string; consultadoEm?: string }

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

function baixarCsv(linhas: LinhaDeclaracao[], nome: string) {
  const blob = new Blob([declaracoesParaCsv(linhas)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function imprimir(linhas: LinhaDeclaracao[], empresa: string, quando: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  const corpo = linhas.map(l => `<tr><td>${esc(l.periodo)}</td><td>${esc(l.numero)}</td><td>${esc(l.tipo)}</td><td>${esc(l.transmitidoEm)}</td><td>${esc(l.das)}</td></tr>`).join('');
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Declarações PGDAS-D</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#0f172a}h1{font-size:20px}p{font-size:13px;color:#475569}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#e2e8f0}</style><h1>Simples Nacional · declarações transmitidas (PGDAS-D)</h1><p>${esc(empresa)}<br>Fonte: SERPRO / Receita Federal · Consultado em ${esc(quando)}</p><table><thead><tr><th>Período</th><th>Nº da declaração</th><th>Tipo</th><th>Transmitida em</th><th>DAS</th></tr></thead><tbody>${corpo}</tbody></table>`);
  w.document.close(); w.focus(); w.print();
}

/** Consulta oficial real ao SERPRO (Integra Contador) para a empresa ativa. Só a conta administradora; o servidor trava o custo. */
export default function ConsultaRealSerpro({ companyId, tenantId, razaoSocial, cnpj }: { companyId?: string; tenantId?: string; razaoSocial?: string; cnpj?: string }) {
  const [prontidao, setProntidao] = useState<Prontidao | null>(null);
  const [servico, setServico] = useState('');
  const [dados, setDados] = useState<Record<string, string>>({ anoCalendario: String(new Date().getFullYear()) });
  const [carregando, setCarregando] = useState(false);
  const [exigeConfirmar, setExigeConfirmar] = useState<string | null>(null);
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [mostrarTecnico, setMostrarTecnico] = useState(false);
  const [versaoCota, setVersaoCota] = useState(0);

  useEffect(() => {
    let ativo = true;
    fetch('/api/serpro/prontidao', { credentials: 'same-origin', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Prontidao) => { if (ativo) { setProntidao(d); setServico(s => s || d.servicos[0]?.chave || ''); } })
      .catch(() => { if (ativo) setProntidao(null); });
    return () => { ativo = false; };
  }, []);

  const linhas = useMemo(() => (resposta?.ok && resposta.servico === 'declaracoesSimples' ? lerDeclaracoes(resposta.bruto) : null), [resposta]);

  if (!companyId || !tenantId) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">Selecione uma empresa já cadastrada no Fisco IA (banco permanente) para fazer a consulta oficial ao SERPRO.</div>;
  }

  async function consultar(confirmarCusto: boolean) {
    setCarregando(true); setResposta(null); setMostrarTecnico(false);
    try {
      const r = await fetch('/api/serpro/consulta', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servico, tenantId, companyId, confirmarCusto, dados }),
      });
      const d = await r.json().catch(() => ({})) as { consultado?: boolean; exigeConfirmacao?: boolean; mensagem?: string; faltando?: string[]; bruto?: unknown; statusGateway?: number; consultadoEm?: string };
      if (r.status === 402 && d.exigeConfirmacao) { setExigeConfirmar(d.mensagem || 'Esta consulta será cobrada à parte pelo SERPRO (contrato: cerca de R$ 0,24 por consulta).'); return; }
      setExigeConfirmar(null);
      if (r.status === 401) setResposta({ ok: false, titulo: 'Sua sessão venceu', texto: 'Saia e entre de novo no Fisco IA e repita a consulta.' });
      else if (r.ok && d.consultado) setResposta({ ok: true, titulo: 'Consulta feita no SERPRO', texto: 'Resposta oficial da Receita/SERPRO. Nada foi inventado ou alterado no sistema.', bruto: d.bruto, servico, consultadoEm: d.consultadoEm });
      else setResposta({ ok: false, titulo: 'Consulta não concluída', texto: [d.mensagem, d.faltando?.length ? `Falta: ${d.faltando.join('; ')}` : '', d.statusGateway ? `Resposta do SERPRO: HTTP ${d.statusGateway}` : ''].filter(Boolean).join(' · ') || `Erro HTTP ${r.status}.`, bruto: d.bruto });
      setVersaoCota(v => v + 1);
    } catch {
      setResposta({ ok: false, titulo: 'Consulta não concluída', texto: 'Não foi possível falar com o servidor. Nada foi consultado.' });
    } finally { setCarregando(false); }
  }

  const campos = prontidao?.servicos.find(s => s.chave === servico)?.campos ?? [];
  const faltando = prontidao?.itens.filter(i => !i.ok) ?? [];
  const quando = resposta?.consultadoEm ? new Date(resposta.consultadoEm).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
  const nomeArquivo = `declaracoes-pgdasd-${(cnpj || companyId).replace(/\D/g, '')}-${dados.anoCalendario || ''}.csv`;
  const mensagensSerpro = (resposta?.bruto as { mensagens?: { codigo?: string; texto?: string }[] } | undefined)?.mensagens;

  return (
    <section className="rounded-2xl border border-indigo-200 bg-white p-4 sm:p-6 space-y-4 shadow-xs text-slate-900">
      <header>
        <h2 className="text-lg sm:text-xl font-black">Consulta oficial (SERPRO / Receita Federal)</h2>
        <p className="text-sm text-slate-700 mt-1">{razaoSocial || 'Empresa ativa'}{cnpj ? ` · ${cnpj}` : ''}</p>
        <p className="text-xs text-slate-600 mt-1">Usa as chaves e o certificado do escritório no servidor. Só a conta administradora. Para empresas clientes, é preciso procuração no e-CAC. A primeira consulta da semana por empresa é gratuita no controle do sistema; as seguintes pedem a sua confirmação (contrato: R$ 0,24 por consulta).</p>
      </header>

      {faltando.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <strong>Ainda falta configurar no Render:</strong>
          <ul className="list-disc ml-5 mt-1">{faltando.map(i => <li key={i.chave}>{i.descricao}</li>)}</ul>
        </div>
      )}

      <CotaConsultasSerpro key={versaoCota} companyId={companyId} tenantId={tenantId} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm font-bold text-slate-800 gap-1">Tipo de consulta
          <select value={servico} onChange={e => setServico(e.target.value)} className="px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl min-w-64">
            {(prontidao?.servicos ?? []).map(s => <option key={s.chave} value={s.chave}>{s.descricao}</option>)}
          </select>
        </label>
        {campos.map(c => (
          <label key={c.nome} className="flex flex-col text-sm font-bold text-slate-800 gap-1">{c.rotulo}
            <input value={dados[c.nome] ?? ''} onChange={e => setDados(d => ({ ...d, [c.nome]: e.target.value }))} placeholder={c.exemplo} className="px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl w-52" />
          </label>
        ))}
        <button type="button" disabled={carregando || !servico || faltando.length > 0 || campos.some(c => !(dados[c.nome] ?? '').trim())} onClick={() => consultar(false)}
          className="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white rounded-xl text-sm font-black cursor-pointer">
          {carregando ? 'Consultando…' : 'Fazer consulta'}
        </button>
      </div>

      {exigeConfirmar && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 space-y-3" role="alertdialog">
          <p>{exigeConfirmar}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => consultar(true)} className="px-4 py-2 bg-amber-700 text-white rounded-lg font-bold cursor-pointer">Confirmo o custo e quero consultar</button>
            <button type="button" onClick={() => setExigeConfirmar(null)} className="px-4 py-2 bg-white border border-slate-300 rounded-lg font-bold cursor-pointer">Cancelar</button>
          </div>
        </div>
      )}

      {resposta && !resposta.ok && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-950" role="status">
          <strong>{resposta.titulo}.</strong> {resposta.texto}
          {mensagensSerpro?.map((m, i) => <p key={i} className="mt-2 font-semibold">{m.texto}</p>)}
        </div>
      )}

      {resposta?.ok && (
        <div className="space-y-4" role="status">
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">
            <strong>{resposta.titulo}.</strong> {resposta.texto}
            {mensagensSerpro?.[0]?.texto && <span className="block mt-1 text-xs">Mensagem do SERPRO: {mensagensSerpro[0].texto}</span>}
          </div>

          {linhas && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-600">Declarações encontradas</p><p className="text-2xl font-black">{linhas.length}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-600">Períodos</p><p className="text-2xl font-black">{new Set(linhas.map(l => l.periodo)).size}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-600">Retificadoras</p><p className="text-2xl font-black">{linhas.filter(l => /retific/i.test(l.tipo)).length}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-600">Consultado em</p><p className="text-sm font-black">{quando}</p></div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => baixarCsv(linhas, nomeArquivo)} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold cursor-pointer">Baixar para Excel (.csv)</button>
                <button type="button" onClick={() => imprimir(linhas, `${razaoSocial || ''} ${cnpj || ''}`.trim(), quando)} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold cursor-pointer">Imprimir / salvar em PDF</button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left text-slate-700">
                    <tr><th className="p-3">Período</th><th className="p-3">Nº da declaração</th><th className="p-3">Tipo</th><th className="p-3">Transmitida em</th><th className="p-3">DAS</th></tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, i) => (
                      <tr key={`${l.numero}-${i}`} className="border-t border-slate-100">
                        <td className="p-3 font-bold">{l.periodo}</td>
                        <td className="p-3 font-mono text-xs sm:text-sm">{l.numero}</td>
                        <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${/retific/i.test(l.tipo) ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>{l.tipo}</span></td>
                        <td className="p-3">{l.transmitidoEm}</td>
                        <td className="p-3">{l.das}{l.dasPago === true ? ' · pago' : l.dasPago === false ? ' · em aberto' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-600">Esta consulta não fica guardada no sistema: para guardar, use os botões acima.</p>
            </>
          )}

          <button type="button" onClick={() => setMostrarTecnico(v => !v)} className="text-xs font-bold text-indigo-800 underline cursor-pointer">{mostrarTecnico ? 'Esconder' : 'Ver'} resposta técnica completa</button>
          {(mostrarTecnico || !linhas) && <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs">{typeof resposta.bruto === 'string' ? resposta.bruto : JSON.stringify(resposta.bruto, null, 2)}</pre>}
        </div>
      )}
    </section>
  );
}
