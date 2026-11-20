import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellPlus, BookOpen, ClipboardPlus, ExternalLink, Info, Loader2, Mailbox, RefreshCw } from 'lucide-react';
import { useEmpresa } from '../../context/EmpresaContext';
import { lerEscritorioAtivo } from '../../services/empresas/empresasCentral.service';
import { ESTADOS_ITEM, ITENS_CHECKLIST, ROTULO_ESTADO, pendenciasDoChecklist, somarDias, type ChecklistDte, type EstadoItemDte, type PassoGuia } from '../../services/dte/dteGoias';
import { chaveTarefa, novaTarefa, type TarefaEquipe } from '../../services/escritorio/tarefasEquipe';
import { gravarColecao, lerTarefas } from '../../services/escritorio/tarefasCliente';
import TarefasEquipe from '../../components/TarefasEquipe';
import BotaoVoltar from '../../components/BotaoVoltar';

interface EmpresaDte { id: string; cnpj: string; nome: string; uf: string | null }
interface Resposta {
  hoje: string; guia: PassoGuia[]; porQueSemLeituraAutomatica: string[]; links: Record<string, string>; contato: { email: string; telefone: string };
  empresas: EmpresaDte[]; checklists: ChecklistDte[];
  resumo: { empresasGo: number; completas: number; semResposta: number; faltando: Record<string, number>; revisaoVencida: number };
}
const BOTAO: Record<EstadoItemDte, string> = { tem: 'bg-emerald-600 text-white border-emerald-600', nao_tem: 'bg-rose-600 text-white border-rose-600', nao_se_aplica: 'bg-slate-600 text-white border-slate-600' };
const dataBr = (d: string | null | undefined) => (d ? d.split('-').reverse().join('/') : '');

/**
 * DT-e de Goiás: guia oficial passo a passo para o contador (e-mail do escritório para os avisos, procuração feita no próprio DT-e)
 * e checklist por empresa (tem / não tem / não se aplica), com lembrete de conferir a caixa e tarefa para a equipe.
 * O sistema NÃO entra no DT-e nem lê a caixa (sem API oficial; abrir mensagem dá ciência).
 */
export default function DteGoiasScreen({ onVoltar }: { onVoltar?: () => void }) {
  const { empresaAtiva } = useEmpresa();
  const tenantId = empresaAtiva?.tenantIdCentral || lerEscritorioAtivo();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; lista?: string[] } | null>(null);
  const [soGoias, setSoGoias] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [tarefas, setTarefas] = useState<TarefaEquipe[]>([]);
  const [verGuia, setVerGuia] = useState(true);

  const carregar = useCallback(async () => {
    if (!tenantId) return;
    setErro(null);
    try {
      const r = await fetch(`/api/dte-goias?tenantId=${encodeURIComponent(tenantId)}`, { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setDados(d as Resposta); else setErro((d as { mensagem?: string }).mensagem || 'Não foi possível carregar.');
    } catch { setErro('Sem conexão com o servidor.'); }
    try { setTarefas(await lerTarefas(tenantId)); } catch { /* só para não duplicar tarefa */ }
  }, [tenantId]);
  useEffect(() => { void carregar(); }, [carregar]);

  const mapa = useMemo(() => new Map((dados?.checklists ?? []).map((c) => [c.empresaId, c])), [dados]);
  const lista = useMemo(() => (dados?.empresas ?? []).filter((e) => !soGoias || e.uf === 'GO'), [dados, soGoias]);
  const atual = (e: EmpresaDte): ChecklistDte => mapa.get(e.id) ?? { empresaId: e.id, empresa: e.nome, cnpj: e.cnpj, uf: e.uf && /^[A-Z]{2}$/.test(e.uf) ? e.uf : null, credenciada: null, emailAvisos: null, procuracao: null, revisarEm: null, obs: null, atualizadoEm: new Date().toISOString() };

  async function salvar(e: EmpresaDte, mudanca: Partial<ChecklistDte>) {
    if (!tenantId) return;
    setSalvando(e.id); setAviso(null);
    const novo: ChecklistDte = { ...atual(e), ...mudanca, empresa: e.nome, cnpj: e.cnpj, atualizadoEm: new Date().toISOString() };
    try {
      await gravarColecao(tenantId, 'dte_go', [{ chave: e.id, dados: novo }]);
      setDados((d) => (d ? { ...d, checklists: [...d.checklists.filter((c) => c.empresaId !== e.id), novo] } : d));
    } catch (er) { setAviso({ texto: er instanceof Error ? er.message : 'Não foi possível salvar.' }); }
    finally { setSalvando(null); }
  }

  async function criarTarefa(e: EmpresaDte, campo: string, titulo: string) {
    if (!tenantId) return;
    try {
      const t = novaTarefa({ origem: 'dte_go', titulo: `${titulo} — ${e.nome}`.slice(0, 200), empresaId: e.id, empresa: e.nome, cnpj: e.cnpj, codigo: campo });
      await gravarColecao(tenantId, 'tarefas_equipe', [{ chave: t.id, dados: t }]);
      setTarefas(await lerTarefas(tenantId));
      setAviso({ texto: 'Tarefa criada na lista "Tarefas da equipe".' });
    } catch (er) { setAviso({ texto: er instanceof Error ? er.message : 'Não foi possível criar a tarefa.' }); }
  }

  async function criarLembrete(e: EmpresaDte, data: string) {
    if (!tenantId) return;
    const id = `dte-${e.id}-${data}`;
    const lembrete = { id, empresaId: e.id, empresa: e.nome, cnpj: e.cnpj, titulo: 'Conferir a caixa postal do DT-e de Goiás', dataVencimento: data, alertas: [0], concluido: false, criadoEm: new Date().toISOString() };
    try {
      await gravarColecao(tenantId, 'agenda_lembretes', [{ chave: id, dados: lembrete }]);
      await salvar(e, { revisarEm: data });
      setAviso({ texto: `Lembrete criado na Agenda para ${dataBr(data)}. Ele aparece na Agenda na próxima atualização da tela.` });
    } catch (er) { setAviso({ texto: er instanceof Error ? er.message : 'Não foi possível criar o lembrete.' }); }
  }

  async function conferirAgora() {
    if (!tenantId) return;
    try {
      const r = await fetch('/api/tarefas-dte/conferir', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId }) });
      const d = await r.json().catch(() => ({})) as { mensagem?: string; alertas?: string[] };
      setAviso({ texto: d.mensagem || (r.ok ? 'Conferido.' : 'Não foi possível conferir.'), lista: d.alertas });
    } catch { setAviso({ texto: 'Sem conexão com o servidor.' }); }
  }

  if (!tenantId) return <p className="p-4 text-sm">Escolha um escritório para ver o DT-e de Goiás.</p>;
  const tarefaAberta = (empresaId: string, campo: string) => tarefas.some((t) => t.id === chaveTarefa('dte_go', empresaId, campo, '') && !t.concluida);

  return (
    <div className="max-w-5xl mx-auto p-2 sm:p-4 space-y-3 text-slate-900">
      {onVoltar && <BotaoVoltar onVoltar={onVoltar} />}
      <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Mailbox className="w-6 h-6 text-indigo-700" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black">DT-e Goiás — Domicílio Tributário Eletrônico</h1>
            <p className="text-xs text-slate-600">Caixa postal da Secretaria da Economia de Goiás. Guia oficial, checklist por empresa e lembretes.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <a href={dados?.links.painel ?? 'https://dte.sefaz.go.gov.br/dte/web/https/painelControle.jsf'} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg bg-indigo-600 text-white font-bold flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5" />Abrir o DT-e (com certificado)</a>
          <a href={dados?.links.credenciamento ?? 'https://dte.sefaz.go.gov.br/dte/web/https/credenciamento.jsf'} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg border border-slate-300 font-bold flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5" />Credenciamento e e-mail</a>
          <a href={dados?.links.perguntas ?? 'https://goias.gov.br/economia/domicilio-tributario-eletronico-dte-perguntas-e-respostas/'} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg border border-slate-300 font-bold flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />Perguntas e respostas oficiais</a>
          <button type="button" onClick={() => void conferirAgora()} className="px-3 py-2 rounded-lg border border-slate-300 font-bold flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" />Conferir agora</button>
        </div>
        {aviso && (
          <div role="status" className="rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-xs text-indigo-950">{aviso.texto}
            {aviso.lista && aviso.lista.length > 0 && <ul className="mt-1 list-disc pl-4 space-y-0.5">{aviso.lista.slice(0, 40).map((l, i) => <li key={i}>{l}</li>)}</ul>}
          </div>
        )}
        {erro && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900">{erro}</p>}
      </section>

      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 space-y-1">
        <p className="font-bold flex items-center gap-1"><Info className="w-4 h-4" />Por que o sistema não lê a caixa do DT-e sozinho</p>
        <ul className="list-disc pl-4 space-y-0.5">{(dados?.porQueSemLeituraAutomatica ?? []).map((t, i) => <li key={i}>{t}</li>)}</ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 space-y-2">
        <button type="button" onClick={() => setVerGuia((v) => !v)} className="font-black text-base flex items-center gap-1"><BookOpen className="w-5 h-5 text-indigo-700" />Passo a passo para o contador {verGuia ? '▲' : '▼'}</button>
        {verGuia && (dados?.guia ?? []).map((g) => (
          <div key={g.titulo} className="rounded-xl border border-slate-200 p-2.5 text-xs space-y-1">
            <p className="font-bold text-sm">{g.titulo}</p>
            <ul className="list-disc pl-4 space-y-0.5">{g.itens.map((t, i) => <li key={i}>{t}</li>)}</ul>
            <p className="text-[11px] text-slate-600">Fonte oficial: <a className="underline" href={g.link} target="_blank" rel="noreferrer">{g.fonte}</a></p>
          </div>
        ))}
        {verGuia && dados && <p className="text-[11px] text-slate-600">Dúvidas na Secretaria da Economia: {dados.contato.email} · {dados.contato.telefone}.</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-black text-base">Checklist por empresa</h2>
            {dados && <p className="text-xs text-slate-600">{dados.resumo.empresasGo} empresa(s) de Goiás: {dados.resumo.completas} completa(s), {dados.resumo.semResposta} com item sem resposta, {dados.resumo.faltando.procuracao ?? 0} sem procuração, {dados.resumo.faltando.emailAvisos ?? 0} sem o e-mail do escritório, {dados.resumo.revisaoVencida} lembrete(s) vencido(s).</p>}
          </div>
          <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={soGoias} onChange={(e) => setSoGoias(e.target.checked)} />Só empresas de Goiás</label>
        </div>
        {!dados && !erro && <p className="text-xs flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" />Carregando…</p>}
        {dados && lista.length === 0 && <p className="text-xs text-slate-600">{soGoias ? 'Nenhuma empresa com UF GO no cadastro. Desmarque "Só empresas de Goiás" para ver todas.' : 'Nenhuma empresa cadastrada.'}</p>}
        <ul className="space-y-2">
          {lista.map((e) => {
            const c = atual(e);
            const pend = pendenciasDoChecklist(c);
            const vencido = c.revisarEm && dados && c.revisarEm <= dados.hoje;
            return (
              <li key={e.id} className={`rounded-xl border p-2.5 text-xs space-y-2 ${pend.some((p) => p.situacao === 'nao_tem') || vencido ? 'border-rose-300 bg-rose-50/50' : pend.length ? 'border-amber-200 bg-amber-50/40' : 'border-emerald-200 bg-emerald-50/40'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm break-words min-w-0">{e.nome}</span>
                  <span className="text-slate-600">{e.cnpj}{e.uf ? ` · ${e.uf}` : ''}</span>
                  {salvando === e.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                </div>
                {ITENS_CHECKLIST.map((item) => (
                  <div key={item.campo} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-full sm:w-64 font-semibold">{item.rotulo}</span>
                    {ESTADOS_ITEM.map((est) => (
                      <button key={est} type="button" aria-pressed={c[item.campo] === est} disabled={salvando === e.id} onClick={() => void salvar(e, { [item.campo]: est } as Partial<ChecklistDte>)}
                        className={`px-2.5 py-1.5 rounded-lg border font-bold ${c[item.campo] === est ? BOTAO[est] : 'bg-white border-slate-300 text-slate-700'}`}>{ROTULO_ESTADO[est]}</button>
                    ))}
                    {c[item.campo] === 'nao_tem' && (tarefaAberta(e.id, item.campo)
                      ? <span className="text-emerald-800 font-bold">tarefa criada</span>
                      : <button type="button" onClick={() => void criarTarefa(e, item.campo, item.tarefa)} className="px-2 py-1.5 rounded-lg bg-indigo-600 text-white font-bold flex items-center gap-1"><ClipboardPlus className="w-3.5 h-3.5" />Criar tarefa</button>)}
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="w-full sm:w-64 font-semibold flex items-center gap-1">{vencido && <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />}Lembrete de conferir a caixa</span>
                  <input type="date" value={c.revisarEm ?? ''} onChange={(ev) => void salvar(e, { revisarEm: ev.target.value || null })} className="px-2 py-1.5 rounded-lg border border-slate-300" aria-label={`Data do lembrete de ${e.nome}`} />
                  {dados && [7, 15, 30].map((d) => <button key={d} type="button" onClick={() => void criarLembrete(e, somarDias(dados.hoje, d))} className="px-2 py-1.5 rounded-lg border border-slate-300 font-bold flex items-center gap-1"><BellPlus className="w-3.5 h-3.5" />+{d} dias na Agenda</button>)}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <TarefasEquipe />
    </div>
  );
}
