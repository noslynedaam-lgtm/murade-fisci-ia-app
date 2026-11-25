import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, FileText, Loader2, PlayCircle, RefreshCw, ShieldAlert, StopCircle } from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import { lerEscritorioAtivo } from '../services/empresas/empresasCentral.service';
import RelatorioClienteModal from './RelatorioClienteModal';
import EnvioContabilPainel from './EnvioContabilPainel';

type Geral = 'pendente' | 'atencao' | 'regular' | 'sem_consulta';
interface LinhaCarteira {
  companyId: string; cnpj: string; nome: string; geral: Geral;
  situacaoFiscal: { id: string; situacao: 'regular' | 'pendente' | 'a_conferir' | null; origem: string | null; temPdf: boolean; consultadoEm: string | null } | null;
  caixaPostal: { novas: number | null; consultadoEm: string | null } | null;
  caixaPostalLista: { quantidade: number; naoLidas: number; consultadoEm: string | null } | null;
  parcelamentos: { modalidades: string[]; atrasadas: { parcela: string; valor: number | null; nomeModalidade: string }[]; consultadoEm: string | null } | null;
  certificado: { validade: string | null; faixa: string | null; dias: number | null; situacaoTexto: string } | null;
}
interface Carteira { hoje: string; totais: { empresas: number; pendentes: number; atencao: number; regulares: number; semConsulta: number }; empresas: LinhaCarteira[] }
interface ItemLote { companyId: string; nome: string; servico: 'situacaoFiscal' | 'caixaPostalNovas'; descricao: string; liberada: boolean; cobrada: boolean; valor: number }
interface Estimativa { itens: ItemLote[]; totais: { consultas: number; gratis: number; cobradas: number; valorTotal: number; naoLiberadas: number; custoSerproMinimo?: number }; cotas: { companyId: string; nome: string; gratisRestante: number; novaGratisEm: string }[]; observacao: string }
interface ResultadoItem { item: ItemLote; ok: boolean; texto: string }

const COR: Record<Geral, string> = { pendente: 'border-rose-300 bg-rose-50', atencao: 'border-amber-300 bg-amber-50', regular: 'border-emerald-300 bg-emerald-50', sem_consulta: 'border-slate-200 bg-slate-50' };
const ROTULO: Record<Geral, string> = { pendente: 'Pendente', atencao: 'Atenção', regular: 'Regular', sem_consulta: 'Sem consulta' };
const data = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const SITUACAO: Record<string, string> = { regular: 'Regular', pendente: 'Com pendência', a_conferir: 'A conferir no PDF' };

/**
 * Carteira fiscal do escritório: o que já foi consultado no Serpro (situação fiscal, Caixa Postal, parcelamentos) e o certificado A1,
 * em verde/amarelo/vermelho, sem custo. "Consultar a carteira" faz consultas NOVAS só por clique, depois de mostrar o custo total.
 */
export default function CarteiraFiscal() {
  const { empresaAtiva } = useEmpresa();
  const tenantId = empresaAtiva?.tenantIdCentral || lerEscritorioAtivo();
  const [carteira, setCarteira] = useState<Carteira | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro' | 'info'; texto: string; lista?: string[] } | null>(null);
  const [filtro, setFiltro] = useState<'todas' | 'atencao'>('todas');
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [lote, setLote] = useState(false);
  const [servicos, setServicos] = useState({ situacaoFiscal: true, caixaPostalNovas: false });
  const [estimativa, setEstimativa] = useState<Estimativa | null>(null);
  const [cienteCusto, setCienteCusto] = useState(false);
  const [executando, setExecutando] = useState<{ feitos: number; total: number } | null>(null);
  const [resultados, setResultados] = useState<ResultadoItem[]>([]);
  const parar = React.useRef(false);
  const [relatorioDe, setRelatorioDe] = useState<{ companyId: string; nome: string } | null>(null);

  const carregar = useCallback(async () => {
    if (!tenantId) return;
    setCarregando(true);
    try {
      const r = await fetch(`/api/carteira-fiscal?tenantId=${encodeURIComponent(tenantId)}`, { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setCarteira(d as Carteira); else setAviso({ tom: 'erro', texto: (d as { mensagem?: string }).mensagem || 'Não foi possível montar a carteira.' });
    } catch { setAviso({ tom: 'erro', texto: 'Sem conexão com o servidor.' }); }
    finally { setCarregando(false); }
  }, [tenantId]);
  useEffect(() => { void carregar(); }, [carregar]);

  const visiveis = useMemo(() => (carteira?.empresas ?? []).filter((e) => filtro === 'todas' || e.geral === 'pendente' || e.geral === 'atencao'), [carteira, filtro]);

  async function conferirAgora() {
    if (!tenantId) return;
    setAviso(null);
    try {
      const r = await fetch('/api/carteira-fiscal/conferir', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId }) });
      const d = await r.json().catch(() => ({})) as { mensagem?: string; alertas?: string[] };
      setAviso(r.ok ? { tom: d.alertas?.length ? 'info' : 'ok', texto: d.mensagem || 'Conferido.', lista: d.alertas } : { tom: 'erro', texto: d.mensagem || 'Não foi possível conferir.' });
      await carregar();
    } catch { setAviso({ tom: 'erro', texto: 'Sem conexão com o servidor.' }); }
  }

  async function marcar(linha: LinhaCarteira, situacao: 'regular' | 'pendente') {
    if (!tenantId || !linha.situacaoFiscal) return;
    if (!window.confirm(`Marcar a situação fiscal de ${linha.nome} como ${situacao === 'regular' ? 'REGULAR' : 'COM PENDÊNCIA'}? Faça isso só depois de ler o PDF.`)) return;
    const r = await fetch(`/api/carteira-fiscal/resultado/${linha.situacaoFiscal.id}/marcar`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, situacao }) });
    setAviso(r.ok ? { tom: 'ok', texto: 'Marcação salva.' } : { tom: 'erro', texto: 'Não foi possível salvar a marcação.' });
    await carregar();
  }

  function alternar(id: string) { setSelecionadas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); setEstimativa(null); setCienteCusto(false); }

  async function estimar() {
    if (!tenantId) return;
    const lista = Object.entries(servicos).filter(([, v]) => v).map(([k]) => k);
    setEstimativa(null); setCienteCusto(false); setResultados([]);
    const r = await fetch('/api/serpro/lote/estimativa', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, companyIds: [...selecionadas], servicos: lista }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setEstimativa(d as Estimativa); else setAviso({ tom: 'erro', texto: (d as { mensagem?: string }).mensagem || 'Não foi possível calcular o custo. Nada foi consultado.' });
  }

  async function executar() {
    if (!tenantId || !estimativa) return;
    const itens = estimativa.itens.filter((i) => i.liberada);
    parar.current = false; setResultados([]); setExecutando({ feitos: 0, total: itens.length });
    const saida: ResultadoItem[] = [];
    for (const [n, item] of itens.entries()) {
      if (parar.current) { saida.push({ item, ok: false, texto: 'Não consultada: você parou o lote.' }); continue; }
      try {
        // Uma por vez, pela rota normal: ela confere de novo liberação, cota e custo. confirmarCusto só vai "sim" se a estimativa mostrou o custo.
        const r = await fetch('/api/serpro/consulta', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, companyId: item.companyId, servico: item.servico, dados: {}, confirmarCusto: item.cobrada }) });
        const d = await r.json().catch(() => ({})) as { consultado?: boolean; mensagem?: string; cobradaAparte?: boolean; guardado?: boolean };
        if (r.status === 402) saida.push({ item, ok: false, texto: 'Parou: a consulta grátis da semana já tinha sido usada. Nada foi consultado nem cobrado; calcule o custo de novo.' });
        else if (r.ok && d.consultado) saida.push({ item, ok: true, texto: `Consultada${d.cobradaAparte ? ' (cobrada)' : ' (grátis da semana)'}${d.guardado === false ? '; o resultado não pôde ser guardado' : ''}.` });
        else saida.push({ item, ok: false, texto: d.mensagem || `Não concluída (HTTP ${r.status}).` });
      } catch { saida.push({ item, ok: false, texto: 'Falha de conexão. Confira o extrato do Serpro antes de repetir.' }); }
      setResultados([...saida]); setExecutando({ feitos: n + 1, total: itens.length });
    }
    setExecutando(null); setEstimativa(null); setCienteCusto(false);
    await carregar();
  }

  if (!tenantId) return null;
  const tons = { ok: 'border-emerald-300 bg-emerald-50 text-emerald-900', erro: 'border-rose-300 bg-rose-50 text-rose-900', info: 'border-amber-300 bg-amber-50 text-amber-950' };
  const nenhumServico = !servicos.situacaoFiscal && !servicos.caixaPostalNovas;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 space-y-3 text-slate-900" aria-labelledby="titulo-carteira">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="titulo-carteira" className="text-base sm:text-lg font-black">Carteira fiscal do escritório</h2>
          <p className="text-xs text-slate-600">Mostra só o que já foi consultado e guardado, com a data. Ver esta tela não custa nada.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void conferirAgora()} className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" />Conferir agora (sem custo)</button>
          <button type="button" onClick={() => { setLote((v) => !v); setEstimativa(null); setResultados([]); }} className="text-xs font-bold px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"><PlayCircle className="w-3.5 h-3.5" />Consultar a carteira</button>
        </div>
      </div>

      {carteira && (
        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-900">{carteira.totais.pendentes} pendente(s)</span>
          <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-900">{carteira.totais.atencao} atenção</span>
          <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-900">{carteira.totais.regulares} regular(es)</span>
          <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-800">{carteira.totais.semConsulta} sem consulta</span>
          <label className="ml-auto flex items-center gap-1 font-normal text-slate-700"><input type="checkbox" checked={filtro === 'atencao'} onChange={(e) => setFiltro(e.target.checked ? 'atencao' : 'todas')} />Só as que pedem atenção</label>
        </div>
      )}
      {tenantId && <EnvioContabilPainel tenantId={tenantId} />}

      {aviso && (
        <div role="status" className={`rounded-lg border p-2.5 text-xs ${tons[aviso.tom]}`}>
          {aviso.texto}
          {aviso.lista && aviso.lista.length > 0 && <ul className="mt-1 list-disc pl-4 space-y-0.5">{aviso.lista.slice(0, 30).map((l, i) => <li key={i}>{l}</li>)}</ul>}
        </div>
      )}

      {lote && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-2 text-xs">
          <p className="font-bold text-sm">Consultar a carteira no Serpro (consulta nova, pode ter custo)</p>
          <p>1) Marque as empresas na lista abaixo ({selecionadas.size} marcada(s)). <button type="button" className="underline font-bold" onClick={() => { setSelecionadas(new Set((carteira?.empresas ?? []).map((e) => e.companyId))); setEstimativa(null); }}>Marcar todas</button> · <button type="button" className="underline font-bold" onClick={() => { setSelecionadas(new Set()); setEstimativa(null); }}>Desmarcar</button></p>
          <div className="flex flex-wrap gap-3">2) O que consultar:
            <label className="flex items-center gap-1"><input type="checkbox" checked={servicos.situacaoFiscal} onChange={(e) => { setServicos((s) => ({ ...s, situacaoFiscal: e.target.checked })); setEstimativa(null); }} />Situação fiscal (relatório em PDF)</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={servicos.caixaPostalNovas} onChange={(e) => { setServicos((s) => ({ ...s, caixaPostalNovas: e.target.checked })); setEstimativa(null); }} />Caixa Postal: há mensagens novas?</label>
          </div>
          <button type="button" disabled={!selecionadas.size || nenhumServico || Boolean(executando)} onClick={() => void estimar()} className="px-3 py-2 rounded-lg bg-slate-800 text-white font-bold disabled:opacity-40">3) Ver o custo antes (não consulta nada)</button>

          {estimativa && (
            <div className="rounded-lg border border-slate-300 bg-white p-2.5 space-y-1.5">
              <p className="font-bold">{estimativa.totais.consultas} consulta(s): {estimativa.totais.gratis} grátis (cota da semana) e {estimativa.totais.cobradas} cobrada(s) · Total: {reais(estimativa.totais.valorTotal)}</p>
              {estimativa.totais.naoLiberadas > 0 && <p className="text-amber-900">{estimativa.totais.naoLiberadas} consulta(s) de empresa ainda não liberada pelo fornecedor do sistema: não serão feitas.</p>}
              {typeof estimativa.totais.custoSerproMinimo === 'number' && <p className="text-slate-600">Custo mínimo estimado no Serpro (tabela do contrato): {reais(estimativa.totais.custoSerproMinimo)}. A situação fiscal faz pelo menos 2 chamadas (protocolo e relatório).</p>}
              <details><summary className="cursor-pointer font-bold">Ver empresa por empresa</summary>
                <ul className="mt-1 space-y-0.5">{estimativa.itens.map((i, k) => <li key={k}>{i.nome} — {i.servico === 'situacaoFiscal' ? 'Situação fiscal' : 'Caixa Postal (novas)'}: {!i.liberada ? 'não liberada' : i.cobrada ? reais(i.valor) : 'grátis'}</li>)}</ul>
              </details>
              <p className="text-slate-600">{estimativa.observacao}</p>
              {estimativa.totais.valorTotal > 0 && <label className="flex items-start gap-1.5 font-bold text-rose-900"><input type="checkbox" checked={cienteCusto} onChange={(e) => setCienteCusto(e.target.checked)} />Estou ciente: {estimativa.totais.cobradas} consulta(s) serão cobradas, total de {reais(estimativa.totais.valorTotal)}, por fora da mensalidade.</label>}
              <button type="button" disabled={estimativa.totais.consultas === 0 || (estimativa.totais.valorTotal > 0 && !cienteCusto) || Boolean(executando)} onClick={() => void executar()} className="px-3 py-2 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-40">4) Confirmar e consultar uma por uma</button>
            </div>
          )}

          {executando && (
            <p className="flex items-center gap-2 font-bold"><Loader2 className="w-4 h-4 animate-spin" />Consultando {executando.feitos} de {executando.total}… (a situação fiscal leva alguns segundos cada)
              <button type="button" onClick={() => { parar.current = true; }} className="ml-2 px-2 py-1 rounded border border-rose-300 text-rose-800 flex items-center gap-1"><StopCircle className="w-3.5 h-3.5" />Parar</button></p>
          )}
          {resultados.length > 0 && (
            <ul className="space-y-0.5">{resultados.map((r, k) => <li key={k} className={r.ok ? 'text-emerald-900' : 'text-rose-900'}>{r.item.nome} — {r.item.servico === 'situacaoFiscal' ? 'Situação fiscal' : 'Caixa Postal'}: {r.texto}</li>)}</ul>
          )}
        </div>
      )}

      {carregando && !carteira && <p className="text-xs text-slate-600 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" />Carregando a carteira…</p>}
      <ul className="space-y-2">
        {visiveis.map((e) => {
          const sf = e.situacaoFiscal;
          return (
            <li key={e.companyId} className={`rounded-xl border p-2.5 text-xs ${COR[e.geral]}`}>
              <div className="flex flex-wrap items-center gap-2">
                {lote && <input type="checkbox" aria-label={`Marcar ${e.nome}`} checked={selecionadas.has(e.companyId)} onChange={() => alternar(e.companyId)} />}
                <span className="font-bold text-sm min-w-0 break-words">{e.nome}</span>
                <span className="text-slate-600">{e.cnpj}</span>
                <button type="button" onClick={() => setRelatorioDe({ companyId: e.companyId, nome: e.nome })} className="ml-auto px-2 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-bold flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Gerar relatório</button>
                <span className={`px-2 py-0.5 rounded-full font-black ${e.geral === 'pendente' ? 'bg-rose-600 text-white' : e.geral === 'atencao' ? 'bg-amber-500 text-white' : e.geral === 'regular' ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-900'}`}>{ROTULO[e.geral]}</span>
              </div>
              <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                <p className="flex flex-wrap items-center gap-1">
                  {sf?.situacao === 'regular' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> : sf?.situacao === 'pendente' ? <ShieldAlert className="w-3.5 h-3.5 text-rose-700" /> : <CircleDashed className="w-3.5 h-3.5 text-slate-500" />}
                  <strong>Situação fiscal:</strong> {sf ? `${SITUACAO[sf.situacao ?? ''] ?? '—'} (consulta de ${data(sf.consultadoEm)}${sf.origem === 'lida_do_pdf' ? ', lida do PDF: confira' : sf.origem === 'marcada_pela_pessoa' ? ', marcada pela equipe' : ''})` : 'sem consulta guardada'}
                  {sf?.temPdf && <a className="underline font-bold flex items-center gap-0.5" href={`/api/carteira-fiscal/resultado/${sf.id}/pdf?tenantId=${encodeURIComponent(tenantId)}`} target="_blank" rel="noreferrer"><FileText className="w-3.5 h-3.5" />Abrir PDF</a>}
                  {sf && <><button type="button" className="underline" onClick={() => void marcar(e, 'regular')}>Marcar regular</button><button type="button" className="underline" onClick={() => void marcar(e, 'pendente')}>Marcar pendente</button></>}
                </p>
                <p><strong>Caixa Postal:</strong> {e.caixaPostal ? `${e.caixaPostal.novas ? 'TEM mensagem nova' : 'sem mensagem nova'} (consulta de ${data(e.caixaPostal.consultadoEm)})` : 'sem consulta guardada'}{e.caixaPostalLista ? ` · lista de ${data(e.caixaPostalLista.consultadoEm)}: ${e.caixaPostalLista.naoLidas} não lida(s)` : ''}</p>
                <p className="flex items-start gap-1">{(e.parcelamentos?.atrasadas.length ?? 0) > 0 && <AlertTriangle className="w-3.5 h-3.5 text-rose-700 shrink-0" />}<span><strong>Parcelamentos:</strong> {e.parcelamentos ? (e.parcelamentos.atrasadas.length ? e.parcelamentos.atrasadas.map((a) => `${a.nomeModalidade} ${a.parcela}${a.valor !== null ? ` (${reais(a.valor)})` : ''}`).join('; ') + ` ainda disponível(is) para emitir — indício de atraso, confira (consulta de ${data(e.parcelamentos.consultadoEm)})` : `nenhuma parcela de mês anterior em aberto (consulta de ${data(e.parcelamentos.consultadoEm)})`) : 'sem consulta guardada'}</span></p>
                <p><strong>Certificado A1:</strong> {e.certificado ? `${e.certificado.situacaoTexto}${e.certificado.validade ? ` (válido até ${e.certificado.validade.split('-').reverse().join('/')})` : ''}` : 'não cadastrado'}</p>
              </div>
            </li>
          );
        })}
      </ul>
      {relatorioDe && <RelatorioClienteModal tenantId={tenantId} companyId={relatorioDe.companyId} nome={relatorioDe.nome} onFechar={() => setRelatorioDe(null)} />}
      {carteira && visiveis.length === 0 && <p className="text-xs text-slate-600">{filtro === 'atencao' ? 'Nenhuma empresa pedindo atenção no que já está guardado.' : 'Nenhuma empresa cadastrada neste escritório.'}</p>}
    </section>
  );
}
