import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Loader2, Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import { lerEscritorioAtivo } from '../services/empresas/empresasCentral.service';
import { novaTarefa, type TarefaEquipe } from '../services/escritorio/tarefasEquipe';
import { EVENTO_TAREFAS, gravarColecao, lerTarefas } from '../services/escritorio/tarefasCliente';

const ORIGEM: Record<string, string> = { manual: 'manual', relatorio_cliente: 'relatório do cliente', dte_go: 'DT-e Goiás', agente: 'Agente IA' };
const hojeLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const dataBr = (d: string | null | undefined) => (d ? d.split('-').reverse().join('/') : '');

/**
 * Tarefas da equipe do escritório: lista simples guardada no servidor (a contadora e a funcionária veem a mesma coisa).
 * Criar à mão, concluir, reabrir e apagar UMA por vez (com confirmação). As tarefas do relatório do cliente e do DT-e caem aqui.
 */
export default function TarefasEquipe() {
  const { empresaAtiva } = useEmpresa();
  const tenantId = empresaAtiva?.tenantIdCentral || lerEscritorioAtivo();
  const [tarefas, setTarefas] = useState<TarefaEquipe[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [verConcluidas, setVerConcluidas] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [prazo, setPrazo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!tenantId) return;
    setCarregando(true); setErro(null);
    try { setTarefas(await lerTarefas(tenantId)); } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar as tarefas.'); }
    finally { setCarregando(false); }
  }, [tenantId]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { const f = () => { void carregar(); }; window.addEventListener(EVENTO_TAREFAS, f); return () => window.removeEventListener(EVENTO_TAREFAS, f); }, [carregar]);

  const hoje = hojeLocal();
  const abertas = useMemo(() => tarefas.filter((t) => !t.concluida).sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999') || a.criadaEm.localeCompare(b.criadaEm)), [tarefas]);
  const concluidas = useMemo(() => tarefas.filter((t) => t.concluida).sort((a, b) => String(b.concluidaEm || '').localeCompare(String(a.concluidaEm || ''))), [tarefas]);

  async function salvar(t: TarefaEquipe) {
    if (!tenantId) return;
    setSalvando(true); setErro(null);
    try { await gravarColecao(tenantId, 'tarefas_equipe', [{ chave: t.id, dados: t }]); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setSalvando(false); }
  }
  async function criar() {
    if (titulo.trim().length < 3) { setErro('Escreva a tarefa (pelo menos 3 letras).'); return; }
    await salvar(novaTarefa({ origem: 'manual', titulo, prazo: prazo || null }));
    setTitulo(''); setPrazo('');
  }
  async function apagar(t: TarefaEquipe) {
    if (!tenantId) return;
    if (!window.confirm(`Apagar a tarefa "${t.titulo}"?`)) return;
    if (!window.confirm('Confirma de novo? A tarefa sai da lista de toda a equipe.')) return;
    try { await gravarColecao(tenantId, 'tarefas_equipe', [], [t.id]); await carregar(); } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível apagar.'); }
  }

  if (!tenantId) return null;
  const linha = (t: TarefaEquipe) => {
    const atrasada = !t.concluida && t.prazo && t.prazo < hoje;
    return (
      <li key={t.id} className={`rounded-lg border p-2 text-xs flex flex-wrap items-start gap-2 ${atrasada ? 'border-rose-300 bg-rose-50' : t.concluida ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-slate-200 bg-white'}`}>
        <div className="min-w-0 flex-1">
          <p className={`font-bold break-words ${t.concluida ? 'line-through' : ''}`}>{t.titulo}</p>
          <p className="text-[11px] text-slate-600">{t.empresa ? `${t.empresa} · ` : ''}{t.prazo ? `prazo ${dataBr(t.prazo)}${atrasada ? ' (atrasada)' : ''} · ` : ''}de {ORIGEM[t.origem] ?? t.origem}</p>
        </div>
        <div className="flex gap-1.5">
          {t.concluida
            ? <button type="button" disabled={salvando} onClick={() => void salvar({ ...t, concluida: false, concluidaEm: null })} className="px-2 py-1 rounded border border-slate-300 font-bold flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" />Reabrir</button>
            : <button type="button" disabled={salvando} onClick={() => void salvar({ ...t, concluida: true, concluidaEm: new Date().toISOString() })} className="px-2 py-1 rounded bg-emerald-600 text-white font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Feita</button>}
          <button type="button" aria-label={`Apagar a tarefa ${t.titulo}`} onClick={() => void apagar(t)} className="px-2 py-1 rounded border border-rose-200 text-rose-800"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </li>
    );
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 space-y-2 text-slate-900" aria-labelledby="titulo-tarefas">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="titulo-tarefas" className="text-base sm:text-lg font-black flex items-center gap-1.5"><ClipboardList className="w-5 h-5 text-indigo-700" />Tarefas da equipe</h2>
          <p className="text-xs text-slate-600">{abertas.length} em aberto{abertas.filter((t) => t.prazo && t.prazo < hoje).length ? `, ${abertas.filter((t) => t.prazo && t.prazo < hoje).length} atrasada(s)` : ''}. Toda a equipe vê a mesma lista.</p>
        </div>
        <button type="button" onClick={() => void carregar()} className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 flex items-center gap-1">{carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}Atualizar</button>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} placeholder="Nova tarefa (ex.: renovar certificado da empresa X)" className="flex-1 min-w-[12rem] px-2.5 py-2 rounded-lg border border-slate-300" aria-label="Nova tarefa" />
        <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="px-2 py-2 rounded-lg border border-slate-300" aria-label="Prazo (opcional)" />
        <button type="button" disabled={salvando} onClick={() => void criar()} className="px-3 py-2 rounded-lg bg-indigo-600 text-white font-bold flex items-center gap-1 disabled:opacity-40"><Plus className="w-3.5 h-3.5" />Criar tarefa</button>
      </div>
      {erro && <p role="alert" className="text-xs rounded-lg border border-rose-300 bg-rose-50 p-2 text-rose-900">{erro}</p>}
      <ul className="space-y-1.5">{abertas.map(linha)}</ul>
      {!carregando && abertas.length === 0 && <p className="text-xs text-slate-600">Nenhuma tarefa em aberto.</p>}
      {concluidas.length > 0 && (
        <div>
          <button type="button" className="text-xs underline font-bold" onClick={() => setVerConcluidas((v) => !v)}>{verConcluidas ? 'Esconder' : 'Ver'} as {concluidas.length} concluída(s)</button>
          {verConcluidas && <ul className="mt-1.5 space-y-1.5">{concluidas.slice(0, 100).map(linha)}</ul>}
        </div>
      )}
    </section>
  );
}
