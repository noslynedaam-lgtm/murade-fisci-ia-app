/**
 * Espelho no servidor da Agenda Fiscal, do Relatório de Conformidade e das Guias (INSS/DCTFWeb).
 *
 * As telas continuam lendo e gravando no aparelho como sempre (funciona até sem internet), e este módulo leva tudo para o servidor
 * do escritório e traz o que a outra pessoa da equipe mudou. Na primeira abertura em cada aparelho, o que já estava só no navegador
 * é enviado (migração); se o servidor já tiver o mesmo item, vale o do servidor. Depois disso, cada item mudado aqui é enviado e o
 * que mudou lá é trazido; item apagado aqui é apagado lá. Item que o servidor recusar continua só neste aparelho e é reenviado.
 * Se os dados do aparelho estiverem ilegíveis, nada é enviado nem sobrescrito (os registros ficam preservados).
 */
import { diferencas } from './dadosEscritorio';
// Só estas três coleções têm cópia no navegador. As demais (relatório do cliente, tarefas, DT-e) são lidas direto do servidor.
type Colecao = 'agenda_lembretes' | 'compliance_status' | 'guias_receita';
import { lerEscritorioAtivo } from '../empresas/empresasCentral.service';

type Mapa = Record<string, unknown>;
interface Fonte { ler(): Mapa | null; escrever(m: Mapa): void; evento: string }

// Nomes iguais aos dos serviços de cada tela (lembrete.service, complianceEmpresas.service, guiasReceita.service).
const CHAVE_AGENDA = 'murade_agenda_lembretes_locais_v1';
const CHAVE_COMPLIANCE = 'fiscoia_compliance_empresas_status';
const PREFIXO_GUIAS = 'fiscoia_guias_receita_';
export const EVENTO_GUIAS_ATUALIZADAS = 'fiscoia_guias_receita_atualizadas';

const lerJson = (chave: string): unknown | undefined => { const raw = localStorage.getItem(chave); if (raw === null) return undefined; return JSON.parse(raw); };

const FONTES: Record<Colecao, Fonte> = {
  agenda_lembretes: {
    evento: 'murade_lembretes_fiscais_atualizados',
    ler() {
      try {
        const v = lerJson(CHAVE_AGENDA);
        if (v === undefined) return {};
        if (!Array.isArray(v)) return null;
        const m: Mapa = {};
        for (const l of v) { if (!l || typeof l !== 'object' || typeof (l as { id?: unknown }).id !== 'string') return null; m[(l as { id: string }).id] = l; }
        return m;
      } catch { return null; }
    },
    escrever(m) { localStorage.setItem(CHAVE_AGENDA, JSON.stringify(Object.values(m))); },
  },
  compliance_status: {
    evento: 'fiscoia_status_compliance_atualizado',
    ler() {
      try {
        const v = lerJson(CHAVE_COMPLIANCE);
        if (v === undefined) return {};
        return v && typeof v === 'object' && !Array.isArray(v) ? { ...(v as Mapa) } : null;
      } catch { return null; }
    },
    escrever(m) { localStorage.setItem(CHAVE_COMPLIANCE, JSON.stringify(m)); },
  },
  guias_receita: {
    evento: EVENTO_GUIAS_ATUALIZADAS,
    ler() {
      try {
        const m: Mapa = {};
        for (let i = 0; i < localStorage.length; i += 1) {
          const k = localStorage.key(i);
          if (!k || !k.startsWith(PREFIXO_GUIAS)) continue;
          const v = lerJson(k);
          if (!Array.isArray(v)) return null;
          m[k.slice(PREFIXO_GUIAS.length)] = v;
        }
        return m;
      } catch { return null; }
    },
    escrever(m) {
      const existentes: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) { const k = localStorage.key(i); if (k?.startsWith(PREFIXO_GUIAS)) existentes.push(k); }
      for (const k of existentes) if (!(k.slice(PREFIXO_GUIAS.length) in m)) localStorage.removeItem(k);
      for (const [cnpj, lista] of Object.entries(m)) localStorage.setItem(PREFIXO_GUIAS + cnpj, JSON.stringify(lista));
    },
  },
};
const COLECOES = Object.keys(FONTES) as Colecao[];

const chaveBase = (t: string, c: Colecao) => `fiscoia_espelho_base_${t}_${c}`;
function lerBase(t: string, c: Colecao): Mapa | null { try { const v = lerJson(chaveBase(t, c)); return v && typeof v === 'object' && !Array.isArray(v) ? v as Mapa : null; } catch { return null; } }
function gravarBase(t: string, c: Colecao, m: Mapa) { try { localStorage.setItem(chaveBase(t, c), JSON.stringify(m)); } catch { /* sem espaço: a próxima rodada trata como primeira vez, sem apagar nada */ } }

/** Junta o que está no servidor com o que mudou aqui. Primeira vez neste aparelho: envia só o que o servidor não tem e nunca apaga. */
export function mesclar(local: Mapa, remoto: Mapa, base: Mapa | null): { resultado: Mapa; gravar: { chave: string; dados: unknown }[]; apagar: string[] } {
  if (base === null) {
    const gravar = Object.entries(local).filter(([k]) => !(k in remoto)).map(([chave, dados]) => ({ chave, dados }));
    return { resultado: { ...local, ...remoto }, gravar, apagar: [] };
  }
  const { gravar, apagar } = diferencas(local, base);
  const resultado: Mapa = { ...remoto };
  for (const g of gravar) resultado[g.chave] = g.dados;
  for (const k of apagar) delete resultado[k];
  return { resultado, gravar, apagar: apagar.filter((k) => k in remoto) };
}

// De qual escritório são os dados que estão hoje no aparelho (quem usa mais de um escritório no mesmo navegador).
const chaveDono = (c: Colecao) => `fiscoia_espelho_dono_${c}`;
const lerDono = (c: Colecao) => { try { return localStorage.getItem(chaveDono(c)) || ''; } catch { return ''; } };
const gravarDono = (c: Colecao, t: string) => { try { localStorage.setItem(chaveDono(c), t); } catch { /* ignora */ } };

const rodando = new Set<string>();
async function sincronizar(tenantId: string, colecao: Colecao): Promise<void> {
  const trava = colecao;
  if (rodando.has(trava)) { pendente.add(colecao); return; }
  rodando.add(trava);
  try {
    const fonte = FONTES[colecao];
    // Os dados do aparelho são de OUTRO escritório: primeiro leva o que ficou pendente para o escritório certo; depois este
    // escritório entra só com o que está no servidor dele (nada de um escritório vai parar no outro).
    const dono = lerDono(colecao);
    const outroEscritorio = Boolean(dono) && dono !== tenantId;
    if (outroEscritorio && !(await sincronizarUma(dono, colecao, fonte, false))) return;
    await sincronizarUma(tenantId, colecao, fonte, outroEscritorio);
  } catch { /* falha de rede: tenta de novo na próxima rodada */ }
  finally {
    rodando.delete(trava);
    if (pendente.has(colecao)) { pendente.delete(colecao); agendar(colecao, 2_000); }
  }
}

/** Uma rodada para um escritório. "soServidor": o aparelho tinha dados de outro escritório, então vale só o que está no servidor. Devolve se concluiu. */
async function sincronizarUma(tenantId: string, colecao: Colecao, fonte: Fonte, soServidor: boolean): Promise<boolean> {
  {
    const local = fonte.ler();
    if (local === null) return false; // dados ilegíveis no aparelho: não envia nem sobrescreve nada
    const r = await fetch(`/api/escritorio/dados?tenantId=${encodeURIComponent(tenantId)}&colecao=${colecao}`, { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) return false;
    const remoto: Mapa = {};
    for (const i of ((await r.json()) as { itens?: { chave: string; dados: unknown }[] }).itens ?? []) remoto[i.chave] = i.dados;
    const base = lerBase(tenantId, colecao);
    const m = soServidor ? { resultado: remoto, gravar: [], apagar: [] } : mesclar(local, remoto, base);
    let recusados = new Set<string>();
    for (let i = 0; i < Math.max(m.gravar.length, m.apagar.length); i += 400) {
      const gravar = m.gravar.slice(i, i + 400); const apagar = m.apagar.slice(i, i + 400);
      if (!gravar.length && !apagar.length) continue;
      const s = await fetch('/api/escritorio/dados/sincronizar', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, colecao, gravar, apagar }) });
      if (!s.ok) return false; // sem servidor agora: tudo continua no aparelho e vai na próxima rodada
      const d = await s.json().catch(() => ({})) as { recusados?: { chave: string; motivo: string }[] };
      if (d.recusados?.length) { recusados = new Set([...recusados, ...d.recusados.map((x) => x.chave)]); console.warn(`[Fisco IA] ${d.recusados.length} registro(s) de ${colecao} ficaram só neste aparelho:`, d.recusados.slice(0, 5)); }
    }
    // O que mudou de verdade no aparelho só é regravado se for diferente (evita recarregar telas à toa).
    if (JSON.stringify(m.resultado) !== JSON.stringify(local)) {
      // Se a pessoa mexeu enquanto a sincronização corria, não pisa: a próxima rodada leva a mudança.
      if (JSON.stringify(fonte.ler()) !== JSON.stringify(local)) { pendente.add(colecao); return false; }
      fonte.escrever(m.resultado);
      window.dispatchEvent(new Event(fonte.evento));
    }
    const novaBase: Mapa = {};
    for (const [k, v] of Object.entries(m.resultado)) if (!recusados.has(k)) novaBase[k] = v;
    gravarBase(tenantId, colecao, novaBase);
    gravarDono(colecao, tenantId);
    return true;
  }
}

const pendente = new Set<Colecao>();
const timers = new Map<Colecao, number>();
function agendar(colecao: Colecao, ms: number) {
  if (typeof window === 'undefined') return;
  const t = timers.get(colecao); if (t) window.clearTimeout(t);
  timers.set(colecao, window.setTimeout(() => { timers.delete(colecao); const tenant = lerEscritorioAtivo(); if (tenant) void sincronizar(tenant, colecao); }, ms));
}

/** Os serviços das telas chamam isto depois de gravar no aparelho: em 1,5 s o item vai para o servidor. */
export function avisarMudancaLocal(colecao: Colecao): void { agendar(colecao, 1_500); }

/** Sincroniza agora as três coleções do escritório ativo (usado ao abrir e nos testes). */
export async function sincronizarEscritorioAgora(): Promise<void> {
  const tenant = lerEscritorioAtivo();
  if (tenant) for (const c of COLECOES) await sincronizar(tenant, c);
}

let iniciado = false;
/** Liga o espelho (uma vez por aba): sincroniza ao abrir, a cada 60 s, ao voltar para a aba e quando o escritório muda. */
export function iniciarEspelhoEscritorio(): () => void {
  if (iniciado || typeof window === 'undefined') return () => undefined;
  iniciado = true;
  const tudo = () => { const tenant = lerEscritorioAtivo(); if (tenant) for (const c of COLECOES) void sincronizar(tenant, c); };
  tudo();
  const intervalo = window.setInterval(tudo, 60_000);
  const foco = () => { if (document.visibilityState === 'visible') tudo(); };
  window.addEventListener('focus', foco);
  document.addEventListener('visibilitychange', foco);
  window.addEventListener('fiscoia_escritorio_atualizado', tudo);
  return () => { iniciado = false; window.clearInterval(intervalo); window.removeEventListener('focus', foco); document.removeEventListener('visibilitychange', foco); window.removeEventListener('fiscoia_escritorio_atualizado', tudo); };
}
