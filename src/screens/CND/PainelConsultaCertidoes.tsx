import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileDown, History, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useEmpresa } from '../../context/EmpresaContext';
import { ADAPTADORES, ROTULO_RESULTADO, TIPOS_CERTIDAO, portalDaCertidao, type ResultadoCertidao, type TipoCertidao } from '../../services/certidoes/certidoes';
import BuscaCertidaoAssistida from './BuscaCertidaoAssistida';

interface Guardada {
  id: string; tipo: TipoCertidao; uf: string | null; municipio: string | null; origem: 'consulta_serpro' | 'manual' | 'pdf_importado'; situacao: string; resultado: ResultadoCertidao | null;
  numero: string | null; emissao: string | null; validade: string | null; mensagem: string | null; codigoTipoOrgao: string | null; temPdf: boolean; criadaEm: string; cobrada: boolean;
}
interface Vencendo { id: string; empresa: string; rotuloTipo: string; validade: string | null; faixa: string; situacaoTexto: string }

const ROTULO_SITUACAO: Record<string, string> = {
  emitida: 'Certidão emitida pelo órgão', nao_emitida: 'Não emitida (há pendência ou impedimento)', em_processamento: 'Em processamento no órgão',
  indisponivel: 'Órgão indisponível, tente de novo', erro: 'Consulta não concluída', registrada_manualmente: 'Registrada manualmente (não verificada pelo órgão)',
};
const br = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—');

/** Consulta de certidões por empresa: automática onde existe serviço oficial (federal, paga, só no clique), portal do órgão nos demais. */
export default function PainelConsultaCertidoes({ obterLink }: { obterLink: (tipo: TipoCertidao, uf?: string, cidade?: string) => string | undefined }) {
  const { empresas, empresaAtiva } = useEmpresa();
  const candidatas = useMemo(() => empresas.filter((e) => e.idCentral && e.tenantIdCentral), [empresas]);
  const [empresaId, setEmpresaId] = useState<string>('');
  const empresa = candidatas.find((e) => String(e.id) === empresaId) ?? candidatas.find((e) => e.id === empresaAtiva?.id) ?? candidatas[0];
  const [guardadas, setGuardadas] = useState<Guardada[]>([]);
  const [vencendo, setVencendo] = useState<Vencendo[] | null>(null);
  const [federalConfigurada, setFederalConfigurada] = useState<boolean | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro' | 'info'; texto: string } | null>(null);
  const [historico, setHistorico] = useState(false);
  const [buscarTipo, setBuscarTipo] = useState<TipoCertidao | null>(null);
  const tenantId = empresa?.tenantIdCentral; const companyId = empresa?.idCentral;

  const carregar = useCallback(async () => {
    if (!tenantId || !companyId) { setGuardadas([]); setVencendo(null); return; }
    setCarregando(true);
    try {
      const [a, b] = await Promise.all([
        fetch(`/api/certidoes?tenantId=${tenantId}&companyId=${companyId}`, { credentials: 'same-origin', cache: 'no-store' }),
        fetch(`/api/certidoes/vencendo?tenantId=${tenantId}`, { credentials: 'same-origin', cache: 'no-store' }),
      ]);
      if (a.ok) setGuardadas(((await a.json()) as { certidoes: Guardada[] }).certidoes); else setAviso({ tom: 'erro', texto: 'Não foi possível ler as certidões guardadas. Nada foi apagado.' });
      if (b.ok) setVencendo(((await b.json()) as { certidoes: Vencendo[] }).certidoes);
    } catch { setAviso({ tom: 'erro', texto: 'Sem conexão com o servidor. Nada foi alterado.' }); }
    finally { setCarregando(false); }
  }, [tenantId, companyId]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    fetch('/api/certidoes/tipos', { credentials: 'same-origin', cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => setFederalConfigurada(d ? d.federalConfigurada === true : null)).catch(() => setFederalConfigurada(null));
  }, []);

  async function consultarFederal() {
    if (!tenantId || !companyId) return;
    setConsultando(true); setConfirmar(false); setAviso(null);
    try {
      const r = await fetch('/api/certidoes/consultar', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, companyId, tipo: 'federal', confirmarCusto: true }) });
      const d = await r.json().catch(() => ({})) as { mensagem?: string; situacao?: string; aviso?: string };
      if (!r.ok) setAviso({ tom: 'erro', texto: d.mensagem || 'A consulta não foi feita. Nada foi cobrado.' });
      else setAviso({ tom: d.situacao === 'emitida' ? 'ok' : 'info', texto: `${d.mensagem || 'Consulta concluída.'}${d.aviso ? ` ${d.aviso}` : ''}` });
      await carregar();
    } catch { setAviso({ tom: 'erro', texto: 'Falha de conexão durante a consulta. Confira o extrato do Serpro antes de repetir.' }); }
    finally { setConsultando(false); }
  }

  async function conferirVencimentos() {
    if (!tenantId) return;
    setAviso(null);
    try {
      const r = await fetch('/api/certidoes/conferir-vencimentos', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId }) });
      const d = await r.json().catch(() => ({})) as { mensagem?: string; certidoes?: Vencendo[] };
      if (!r.ok) { setAviso({ tom: 'erro', texto: d.mensagem || 'Não foi possível conferir agora.' }); return; }
      setVencendo(d.certidoes ?? []); setAviso({ tom: (d.certidoes?.length ?? 0) > 0 ? 'info' : 'ok', texto: d.mensagem || 'Conferido.' });
    } catch { setAviso({ tom: 'erro', texto: 'Sem conexão com o servidor.' }); }
  }

  async function excluir(g: Guardada) {
    // Uma certidão por vez, com duas confirmações.
    if (!tenantId) return;
    if (!window.confirm(`Excluir este registro de certidão (${ADAPTADORES[g.tipo].rotulo}${g.numero ? `, nº ${g.numero}` : ''})? O documento no órgão não é alterado.`)) return;
    if (!window.confirm('Confirma de novo: excluir SOMENTE este registro? Não dá para desfazer.')) return;
    const r = await fetch(`/api/certidoes/${g.id}/excluir`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, confirmou: true, confirmouDeNovo: true }) });
    setAviso(r.ok ? { tom: 'ok', texto: 'Registro excluído.' } : { tom: 'erro', texto: 'Não foi possível excluir. Nada foi apagado.' });
    await carregar();
  }

  if (candidatas.length === 0) return null;
  const ultimaDe = (t: TipoCertidao) => guardadas.find((g) => g.tipo === t && g.situacao !== 'em_processamento') ?? guardadas.find((g) => g.tipo === t);
  const cor = { ok: 'border-emerald-300 bg-emerald-50 text-emerald-900', erro: 'border-rose-300 bg-rose-50 text-rose-900', info: 'border-amber-300 bg-amber-50 text-amber-950' };

  return (
    <section id="consulta-certidoes" className="bg-white rounded-xl border border-slate-200 shadow-xs p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5"><Search className="w-4 h-4 text-blue-600" />Consultar certidões</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="empresa-certidoes">Empresa</label>
          <select id="empresa-certidoes" value={String(empresa?.id ?? '')} onChange={(e) => { setEmpresaId(e.target.value); setAviso(null); }} className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 max-w-[16rem]">
            {candidatas.map((e) => <option key={e.id} value={String(e.id)}>{e.razaoSocial}</option>)}
          </select>
          <button type="button" onClick={() => void conferirVencimentos()} className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" />Conferir vencimentos agora</button>
        </div>
      </div>

      {vencendo && vencendo.length > 0 && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-950">
          <strong>{vencendo.length} certidão(ões) vencida(s) ou vencendo em até 30 dias neste escritório:</strong>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">{vencendo.slice(0, 8).map((v) => <li key={v.id}>{v.empresa} — {v.rotuloTipo}: {v.situacaoTexto} ({br(v.validade)})</li>)}</ul>
        </div>
      )}
      {aviso && <div role="status" className={`rounded-lg border p-2.5 text-xs ${cor[aviso.tom]}`}>{aviso.texto}</div>}

      <ul className="divide-y divide-slate-100">
        {TIPOS_CERTIDAO.map((t) => {
          const ad = ADAPTADORES[t]; const u = ultimaDe(t); const automatica = ad.modo === 'automatica_paga';
          const link = portalDaCertidao(t, empresa?.uf, empresa?.cidade) ?? obterLink(t, empresa?.uf, empresa?.cidade) ?? ad.portalOficial ?? undefined;
          return (
            <li key={t} className="py-2.5 flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900">{ad.rotulo}</p>
                  <p className="text-[11px] text-slate-500">{ad.orgao} · {automatica ? 'consulta automática (paga, só no clique)' : 'semiautomática: o sistema abre o portal e lê o PDF'}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {automatica && (
                    <button type="button" disabled={consultando || federalConfigurada === false} onClick={() => setConfirmar(true)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
                      {consultando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}Consultar agora
                    </button>
                  )}
                  {!automatica && <button type="button" onClick={() => setBuscarTipo(t)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"><Search className="w-3.5 h-3.5" />Buscar agora</button>}
                  {link && <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5" />Abrir portal</a>}
                </div>
              </div>
              {automatica && federalConfigurada === false && <p className="text-[11px] text-amber-800">A consulta automática ainda não foi contratada neste servidor (produto &quot;Consulta CND&quot; do Serpro). Use o portal da Receita por enquanto.</p>}
              {!automatica && <p className="text-[11px] text-slate-500">{ad.como}</p>}
              {u && (
                <div className="text-[11px] text-slate-700 bg-slate-50 rounded-lg p-2">
                  <p><strong>{u.resultado ? ROTULO_RESULTADO[u.resultado] : (ROTULO_SITUACAO[u.situacao] ?? u.situacao)}</strong> · {u.origem === 'pdf_importado' ? 'PDF lido e conferido em' : 'consultada em'} {br(u.criadaEm.slice(0, 10))}</p>
                  {u.mensagem && <p>{u.mensagem}</p>}
                  {(u.numero || u.validade) && <p>Número de controle: {u.numero ?? '—'} · Emissão: {br(u.emissao)} · Validade: {br(u.validade)}{u.codigoTipoOrgao ? ` · Tipo informado pelo órgão: código ${u.codigoTipoOrgao} (confira no PDF)` : ''}</p>}
                  {u.temPdf && tenantId && <a className="inline-flex items-center gap-1 font-bold text-blue-700 mt-0.5" href={`/api/certidoes/${u.id}/pdf?tenantId=${tenantId}`} target="_blank" rel="noopener noreferrer"><FileDown className="w-3.5 h-3.5" />Abrir PDF da certidão</a>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div>
        <button type="button" onClick={() => setHistorico((v) => !v)} className="text-xs font-bold text-slate-700 flex items-center gap-1"><History className="w-3.5 h-3.5" />{historico ? 'Ocultar histórico' : `Histórico desta empresa (${guardadas.length})`}</button>
        {historico && (
          <ul className="mt-2 space-y-1.5">
            {carregando && <li className="text-xs text-slate-500">Carregando...</li>}
            {!carregando && guardadas.length === 0 && <li className="text-xs text-slate-500">Nenhuma certidão guardada para esta empresa.</li>}
            {guardadas.map((g) => (
              <li key={g.id} className="text-[11px] border border-slate-200 rounded-lg p-2 flex items-start justify-between gap-2">
                <span>{ADAPTADORES[g.tipo].rotulo} · {ROTULO_SITUACAO[g.situacao] ?? g.situacao} · {g.origem === 'manual' ? 'manual' : g.origem === 'pdf_importado' ? 'PDF lido' : 'Serpro'} · nº {g.numero ?? '—'} · validade {br(g.validade)} · {br(g.criadaEm.slice(0, 10))}</span>
                <button type="button" aria-label="Excluir este registro" onClick={() => void excluir(g)} className="text-rose-600 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {buscarTipo && tenantId && companyId && empresa && (
        <BuscaCertidaoAssistida
          tenantId={tenantId} empresa={{ id: companyId, nome: empresa.razaoSocial, cnpj: empresa.cnpj || '', uf: empresa.uf || null, municipio: empresa.cidade || null }}
          tipos={[buscarTipo]} portais={{ [buscarTipo]: portalDaCertidao(buscarTipo, empresa.uf, empresa.cidade) ?? obterLink(buscarTipo, empresa.uf, empresa.cidade) ?? ADAPTADORES[buscarTipo].portalOficial }}
          onFechar={() => setBuscarTipo(null)} onGuardou={() => void carregar()}
        />
      )}

      {confirmar && (
        <div role="dialog" aria-modal="true" aria-labelledby="titulo-confirma-cnd" className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3">
          <div className="bg-white rounded-xl max-w-md w-full p-4 space-y-3 shadow-xl">
            <h3 id="titulo-confirma-cnd" className="text-sm font-extrabold text-slate-900">Consulta paga ao Serpro</h3>
            <p className="text-xs text-slate-700">Vai consultar a <strong>CND federal (Receita Federal + PGFN)</strong> de <strong>{empresa?.razaoSocial}</strong>. Esta consulta é <strong>paga pelo Serpro</strong> (produto &quot;Consulta CND&quot;, cobrada por consulta conforme o contrato). Se o órgão emitir, o resultado e o PDF ficam guardados aqui.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmar(false)} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300">Cancelar</button>
              <button type="button" onClick={() => void consultarFederal()} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white">Sim, consultar e cobrar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
