// Aviso diário (20h, horário de Brasília) das consultas COBRADAS do Serpro, para o dono conferir antes de cobrar.
// Só lê o que já foi registrado em cada empresa; não faz consulta nenhuma ao Serpro e não cobra nada.
import { comContextoTenant, obterPoolBanco } from './persistence';
import { emailConfigurado, enviarEmail } from './emailMurade';
import { cicloDe, montarExtrato, type EmpresaConsumo, type EventoConsumo, type OperacaoSerpro } from '../services/serpro/consumoSerpro';
import { CATALOGO_SERVICOS } from '../services/serpro/integraContador';

const PAPEIS = ['OWNER', 'ADMIN'];
const dataSP = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const horaSP = (d: Date) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(d));
const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Para onde vai o aviso: MURADE_AVISO_EMAIL ou, se não houver, o primeiro login com @ do MURADE_DONO_SISTEMA. */
export function destinoDoAviso(env: Record<string, string | undefined> = process.env): string | null {
  const direto = env.MURADE_AVISO_EMAIL?.trim();
  if (direto && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(direto)) return direto;
  const dono = (env.MURADE_DONO_SISTEMA || '').split(',').map((x) => x.trim()).find((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  return dono || null;
}

/** Janela de envio: das 20h às 21h59 de Brasília (o robô confere de tempos em tempos e envia uma vez por dia). */
export function dentroDaJanelaDeEnvio(agora: Date): boolean { const h = horaSP(agora); return h === 20 || h === 21; }

export function montarTextoAviso(dia: string, cobradas: EventoConsumo[]): { assunto: string; texto: string } {
  const porEsc = new Map<string, { nome: string; total: number; itens: EventoConsumo[] }>();
  for (const v of cobradas) {
    const e = porEsc.get(v.escritorioId) ?? { nome: v.escritorio, total: 0, itens: [] };
    e.total += v.valor; e.itens.push(v); porEsc.set(v.escritorioId, e);
  }
  const total = cobradas.reduce((s, v) => s + v.valor, 0);
  const [a, m, d] = dia.split('-');
  const linhas: string[] = [`Consultas COBRADAS do Serpro em ${d}/${m}/${a}: ${cobradas.length} (total ${reais(total)}).`, ''];
  for (const e of [...porEsc.values()].sort((x, y) => y.total - x.total)) {
    linhas.push(`${e.nome} — ${reais(e.total)}`);
    for (const v of e.itens) linhas.push(`  • ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', timeStyle: 'short' }).format(new Date(v.em))} · ${v.nome} (${v.cnpj}) · ${v.servico} · ${reais(v.valor)}`);
    linhas.push('');
  }
  linhas.push('O detalhe de cada consulta do ciclo (21 a 20) está no Fisco IA, em Consulta oficial > Consumo do Serpro. Confira com a fatura do Serpro antes de cobrar.');
  return { assunto: `Serpro: ${cobradas.length} consulta(s) cobrada(s) em ${d}/${m} — ${reais(total)}`, texto: linhas.join('\n') };
}

/** Lê, em todos os escritórios do dono, as consultas cobradas do dia. */
export async function coletarCobradasDoDia(dia: string): Promise<EventoConsumo[]> {
  const pool = obterPoolBanco();
  if (!pool) return [];
  const admins = await pool.query("SELECT id FROM fiscoia.users WHERE active = true AND (is_admin = true OR account_type = 'ADMIN') ORDER BY id LIMIT 20");
  const vistos = new Set<string>(); const eventos: EventoConsumo[] = [];
  const operacao = (k: string): OperacaoSerpro => CATALOGO_SERVICOS[k]?.operacao ?? 'Consultar';
  for (const u of admins.rows) {
    const userId = String(u.id);
    const client = await pool.connect(); let tenants: string[] = [];
    try {
      await client.query('BEGIN'); await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      tenants = (await client.query('SELECT tenant_id FROM fiscoia.tenant_memberships WHERE user_id = $1 AND role = ANY($2::text[])', [userId, PAPEIS])).rows.map((r) => String(r.tenant_id));
      await client.query('COMMIT');
    } catch { await client.query('ROLLBACK').catch(() => undefined); } finally { client.release(); }
    for (const tenantId of tenants) {
      if (vistos.has(tenantId)) continue; vistos.add(tenantId);
      const r = await comContextoTenant(userId, tenantId, async (c) => {
        const q = await c.query("SELECT id, cnpj, legal_name, metadata->'serproCota'->'consultas' AS consultas FROM fiscoia.companies WHERE tenant_id = $1 AND metadata ? 'serproCota'", [tenantId]);
        return q.rows.map((x): EmpresaConsumo => ({ id: String(x.id), cnpj: String(x.cnpj), nome: String(x.legal_name), consultas: Array.isArray(x.consultas) ? x.consultas : [] }));
      }, PAPEIS);
      if (!r.autorizado || !('resultado' in r) || !r.resultado) continue;
      const ex = montarExtrato(r.resultado, cicloDe(new Date(`${dia}T12:00:00-03:00`)), operacao);
      for (const v of ex.eventos) if (v.cobrada && dataSP(new Date(v.em)) === dia) eventos.push(v);
    }
  }
  return eventos.sort((a, b) => a.em.localeCompare(b.em));
}

let ultimoDiaEnviado = '';
/** Rotina do robô: uma vez por dia, na janela das 20h, envia o resumo por e-mail se houve cobrança. Devolve o texto do resultado. */
export async function rodarAvisoCobrancas(agora = new Date(), env: Record<string, string | undefined> = process.env): Promise<string> {
  if (!dentroDaJanelaDeEnvio(agora)) return 'Aguardando as 20h para o resumo do dia.';
  const dia = dataSP(agora);
  if (ultimoDiaEnviado === dia) return 'Resumo de hoje já enviado.';
  const destino = destinoDoAviso(env);
  if (!destino || !emailConfigurado()) return 'Resumo não enviado: configure o e-mail (EMAIL_FROM e RESEND_API_KEY ou SMTP) e o destino (MURADE_AVISO_EMAIL) no Render.';
  const cobradas = await coletarCobradasDoDia(dia);
  if (!cobradas.length) { ultimoDiaEnviado = dia; return `Sem consultas cobradas em ${dia}; nada a avisar.`; }
  const { assunto, texto } = montarTextoAviso(dia, cobradas);
  await enviarEmail(destino, assunto, texto);
  ultimoDiaEnviado = dia;
  return `Resumo enviado para ${destino}: ${cobradas.length} consulta(s) cobrada(s).`;
}
