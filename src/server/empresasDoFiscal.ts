import type { PoolClient } from 'pg';
import { comContextoTenant, obterPoolBanco } from './persistence';
import { urlDoSistema } from './agentesEntreSistemas';
import { validarCnpj, normalizarCnpj } from '../services/cnpj/cnpjValidation';

// Robô Fiscal → Fisco IA (empresas). Toda empresa cadastrada no Murade Fiscal passa a existir no Fisco IA, no escritório certo.
// Regras de segurança:
// - A empresa vai para o escritório CLIENTE que a tem no Fiscal. O dono do sistema enxerga todas as empresas no Fiscal, mas só
//   recebe aqui as que são só dele. Empresa que está em dois escritórios clientes fica de fora (ambígua).
// - O escritório do Fiscal (login) só é ligado ao escritório do Fisco IA cujo PROPRIETÁRIO (OWNER) tem o mesmo e-mail.
//   Sem correspondência, nada é criado (nunca joga empresa de um escritório no de outro).
// - Só cria o que não existe. Nunca altera cadastro existente e nunca recria empresa que foi arquivada/excluída aqui.
// - Conserto: empresa que ESTE robô criou no escritório errado (marcada origem "murade-fiscal") é retirada de lá. Empresa
//   cadastrada à mão, ou com certificado guardado, nunca é tocada.
export interface EscritorioDoFiscal { login: string; donoSistema: boolean; cnpj?: string }
export interface EmpresaDoFiscal { cnpj: string; razaoSocial: string; uf: string; cidade: string; regime: string; status: string; escritorio: string; escritorioDonoSistema: boolean; escritorios: EscritorioDoFiscal[] | null }
export interface ResultadoEmpresasFiscal { lidas: number; criadas: number; jaExistiam: number; semEscritorio: number; invalidas: number; ambiguas: number; retiradas: number; cnpjPreenchidos: number; avisos: string[]; erro?: string }

const MAX_CRIAR_POR_RODADA = 300;

export async function lerEmpresasDoFiscal(env: Record<string, string | undefined> = process.env, buscar: typeof fetch = fetch): Promise<EmpresaDoFiscal[]> {
  const token = env.MURADE_INTEGRATION_TOKEN?.trim();
  if (!token) throw new Error('MURADE_INTEGRATION_TOKEN não configurado.');
  const r = await buscar(`${urlDoSistema('fiscal', env)}/api/integracao/fiscal/empresas`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || j?.sucesso !== true || !Array.isArray(j.empresas)) throw new Error(`O Murade Fiscal não entregou a lista de empresas (HTTP ${r.status}).`);
  return j.empresas.map((e: any) => ({
    cnpj: normalizarCnpj(String(e?.cnpj ?? '')), razaoSocial: String(e?.razaoSocial ?? '').trim(), uf: String(e?.uf ?? '').trim().toUpperCase(),
    cidade: String(e?.cidade ?? '').trim(), regime: String(e?.regime ?? '').trim(), status: String(e?.status ?? ''), escritorio: String(e?.escritorio ?? '').trim().toLowerCase(),
    escritorioDonoSistema: e?.escritorioDonoSistema === true,
    escritorios: Array.isArray(e?.escritorios) ? e.escritorios.map((x: any) => { const cnpj = normalizarCnpj(String(x?.cnpj ?? '')); return { login: String(x?.login ?? '').trim().toLowerCase(), donoSistema: x?.donoSistema === true, ...(cnpj && validarCnpj(cnpj) ? { cnpj } : {}) }; }).filter((x: EscritorioDoFiscal) => x.login) : null,
  }));
}

/** De qual escritório (login do Fiscal) é a empresa. null = não dá para saber com segurança (nada é criado nem retirado). */
export function escritorioAlvo(e: Pick<EmpresaDoFiscal, 'escritorio' | 'escritorioDonoSistema' | 'escritorios'>): { login: string } | { motivo: 'ambigua' | 'sem_escritorio' } {
  if (e.escritorios === null) {
    // Fiscal ainda sem a lista completa de escritórios: só dá para confiar quando o único escritório informado é um cliente.
    return e.escritorio && !e.escritorioDonoSistema ? { login: e.escritorio } : { motivo: 'ambigua' };
  }
  const clientes = [...new Set(e.escritorios.filter((x) => !x.donoSistema).map((x) => x.login))];
  if (clientes.length === 1) return { login: clientes[0] };
  if (clientes.length > 1) return { motivo: 'ambigua' };
  const donos = [...new Set(e.escritorios.filter((x) => x.donoSistema).map((x) => x.login))];
  return donos.length === 1 ? { login: donos[0] } : { motivo: 'sem_escritorio' };
}

type Pool = NonNullable<ReturnType<typeof obterPoolBanco>>;
async function escritorioDoDono(pool: Pool, login: string): Promise<{ userId: string; tenantId: string } | null> {
  // E-mail igual; se não houver, aceita a conta do Fisco IA criada só com o nome antes do "@" (login sem domínio).
  let u = (await pool.query('SELECT id FROM fiscoia.users WHERE email = $1 AND active = true LIMIT 1', [login]).catch(() => ({ rows: [] as any[] }))).rows[0];
  if (!u && login.includes('@')) u = (await pool.query('SELECT id FROM fiscoia.users WHERE email = $1 AND active = true LIMIT 1', [login.split('@')[0]]).catch(() => ({ rows: [] as any[] }))).rows[0];
  if (!u) return null;
  const userId = String(u.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const m = (await client.query("SELECT tenant_id FROM fiscoia.tenant_memberships WHERE user_id = $1 AND role = 'OWNER' ORDER BY created_at LIMIT 1", [userId])).rows[0];
    await client.query('COMMIT');
    return m ? { userId, tenantId: String(m.tenant_id) } : null;
  } catch { await client.query('ROLLBACK').catch(() => undefined); return null; }
  finally { client.release(); }
}

/** Retira do escritório as empresas que este robô criou lá por engano (o Fiscal diz que são de OUTRO escritório). */
async function retirarCriadasNoEscritorioErrado(c: PoolClient, tenantId: string, cnpjsDeOutro: Set<string>): Promise<number> {
  if (cnpjsDeOutro.size === 0) return 0;
  const q = await c.query(
    `SELECT co.id, co.cnpj FROM fiscoia.companies co
      WHERE co.tenant_id = $1 AND co.metadata->>'origem' = 'murade-fiscal'
        AND NOT EXISTS (SELECT 1 FROM fiscoia.company_fiscal_certificates ce WHERE ce.company_id = co.id AND ce.tenant_id = co.tenant_id)`, [tenantId]);
  let n = 0;
  for (const linha of q.rows) {
    if (!cnpjsDeOutro.has(String(linha.cnpj).trim())) continue;
    await c.query('SAVEPOINT retirar');
    try { await c.query('DELETE FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2', [linha.id, tenantId]); await c.query('RELEASE SAVEPOINT retirar'); n += 1; }
    catch { await c.query('ROLLBACK TO SAVEPOINT retirar'); }
  }
  return n;
}

export async function sincronizarEmpresasDoFiscal(env: Record<string, string | undefined> = process.env, buscar: typeof fetch = fetch): Promise<ResultadoEmpresasFiscal> {
  const out: ResultadoEmpresasFiscal = { lidas: 0, criadas: 0, jaExistiam: 0, semEscritorio: 0, invalidas: 0, ambiguas: 0, retiradas: 0, cnpjPreenchidos: 0, avisos: [] };
  const pool = obterPoolBanco();
  if (!pool) return { ...out, erro: 'Banco permanente não configurado.' };
  let empresas: EmpresaDoFiscal[];
  try { empresas = await lerEmpresasDoFiscal(env, buscar); } catch (e: any) { return { ...out, erro: String(e?.message || 'Falha ao ler o Fiscal.').slice(0, 200) }; }
  out.lidas = empresas.length;
  const porLogin = new Map<string, EmpresaDoFiscal[]>();
  const alvoPorCnpj = new Map<string, string>(); // CNPJ → login do escritório certo (só quando se sabe com segurança)
  const logins = new Set<string>();
  for (const e of empresas) {
    for (const x of e.escritorios ?? []) logins.add(x.login);
    if (e.escritorio) logins.add(e.escritorio);
    if (!validarCnpj(e.cnpj)) { out.invalidas += 1; continue; }
    const alvo = escritorioAlvo(e);
    if ('motivo' in alvo) { if (alvo.motivo === 'ambigua') out.ambiguas += 1; else out.semEscritorio += 1; continue; }
    alvoPorCnpj.set(e.cnpj, alvo.login);
    if (e.status === 'Bloqueada') continue;
    if (e.razaoSocial.length < 2 || e.razaoSocial.length > 240) { out.invalidas += 1; continue; }
    porLogin.set(alvo.login, [...(porLogin.get(alvo.login) ?? []), e]);
  }
  let criadasNaRodada = 0;
  for (const login of logins) {
    const lista = porLogin.get(login) ?? [];
    const alvo = await escritorioDoDono(pool, login);
    if (!alvo) { out.semEscritorio += lista.length; continue; }
    const { userId, tenantId } = alvo;
    const deOutro = new Set([...alvoPorCnpj].filter(([, dono]) => dono !== login).map(([cnpj]) => cnpj));
    const r = await comContextoTenant(userId, tenantId, async (c) => {
      const retiradas = await retirarCriadasNoEscritorioErrado(c, tenantId, deOutro);
      const ja = new Set((await c.query('SELECT cnpj FROM fiscoia.companies WHERE tenant_id = $1', [tenantId])).rows.map((x: any) => String(x.cnpj).trim()));
      let criadas = 0, existiam = 0;
      for (const e of lista) {
        if (ja.has(e.cnpj)) { existiam += 1; continue; }
        if (criadasNaRodada >= MAX_CRIAR_POR_RODADA) break;
        await c.query(
          `INSERT INTO fiscoia.companies (tenant_id, cnpj, legal_name, state, municipality, tax_regime, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT DO NOTHING`,
          [tenantId, e.cnpj, e.razaoSocial, /^[A-Z]{2}$/.test(e.uf) ? e.uf : null, e.cidade || null, e.regime || null, JSON.stringify({ origem: 'murade-fiscal' })]);
        criadas += 1; criadasNaRodada += 1;
      }
      return { criadas, existiam, retiradas };
    }, ['OWNER']);
    if (r.autorizado && r.resultado) { out.criadas += r.resultado.criadas; out.jaExistiam += r.resultado.existiam; out.retiradas += r.resultado.retiradas; } else out.semEscritorio += lista.length;
  }
  try { await sincronizarCnpjDosEscritorios(pool, empresas, out); } catch (e: any) { out.avisos.push(`CNPJ dos escritórios não sincronizado: ${String(e?.message || 'falha').slice(0, 120)}`); }
  ultimoResultado = { em: new Date().toISOString(), ...out };
  return out;
}

/** Escritórios (tenants) para os quais o Fiscal informou CNPJ na última rodada; só para a mensagem do 409 (nunca para decidir acesso). */
const informadoPeloFiscal = new Set<string>();
export function fiscalInformouCnpjDoEscritorio(tenantId: string): boolean { return informadoPeloFiscal.has(tenantId); }

export interface TenantSemCnpj { id: string; name: string; ownerEmail: string }

/**
 * CNPJ do escritório (Fiscal → Fisco IA). Só PREENCHE o que está vazio, para o escritório cliente cujo proprietário (OWNER) tem o mesmo
 * e-mail do login do Fiscal. Nunca sobrescreve (divergência só vira aviso), nunca toca o escritório do dono do sistema e, sem a
 * migração 023 no banco, apenas avisa. Escritório cliente sem CNPJ e sem correspondência no Fiscal também vira aviso (conferidor).
 */
export async function sincronizarCnpjDosEscritorios(pool: Pool, empresas: EmpresaDoFiscal[], out: ResultadoEmpresasFiscal): Promise<void> {
  // login do Fiscal → CNPJ informado (null = Fiscal informou CNPJs diferentes para o mesmo login: ambíguo, não preenche).
  const cnpjPorLogin = new Map<string, string | null>(); const donos = new Set<string>(); const logins = new Set<string>();
  for (const e of empresas) for (const x of e.escritorios ?? []) {
    logins.add(x.login); if (x.donoSistema) donos.add(x.login);
    if (!x.cnpj) continue;
    const atual = cnpjPorLogin.get(x.login);
    cnpjPorLogin.set(x.login, atual === undefined || atual === x.cnpj ? x.cnpj : null);
  }
  let semFuncao = false;
  informadoPeloFiscal.clear();
  const tratados = new Map<string, string | null | undefined>(); // tenant que corresponde a um login do Fiscal → CNPJ informado por ele
  for (const login of logins) {
    if (donos.has(login)) continue;
    const alvo = await escritorioDoDono(pool, login);
    if (!alvo) continue;
    const cnpj = cnpjPorLogin.get(login);
    tratados.set(alvo.tenantId, cnpj);
    if (cnpj) informadoPeloFiscal.add(alvo.tenantId);
    if (cnpj === null) { out.avisos.push(`O Fiscal informou CNPJs diferentes para ${login}; nada foi preenchido.`); continue; }
    if (!cnpj) continue;
    let info: any;
    try { info = (await pool.query('SELECT * FROM fiscoia.tenant_office_info($1::uuid)', [alvo.tenantId])).rows[0]; } catch { continue; }
    if (!info || info.is_platform_owner === true) continue;
    const atual = info.office_cnpj ? normalizarCnpj(String(info.office_cnpj)) : '';
    if (atual) { if (atual !== cnpj) out.avisos.push(`O CNPJ do escritório ${login} no Fisco IA (${atual}) difere do informado pelo Fiscal (${cnpj}); mantido o do Fisco IA.`); continue; }
    if (semFuncao) continue;
    try {
      const r = await pool.query('SELECT fiscoia.platform_fill_office_cnpj_from_integration($1::uuid, $2::text) AS ok', [alvo.tenantId, cnpj]);
      if (r.rows[0]?.ok === true) out.cnpjPreenchidos += 1;
    } catch (e: any) {
      if (e?.code === '42883') { semFuncao = true; out.avisos.push('A atualização 023 do banco (CNPJ do escritório pelo Fiscal) ainda não foi aplicada (npm run db:migrate); nada foi preenchido.'); }
      else if (e?.code !== '22023') out.avisos.push(`Não foi possível preencher o CNPJ do escritório ${login}.`);
    }
  }
  // Conferidor: escritório cliente sem CNPJ e sem correspondência no Fiscal.
  let semCnpj: TenantSemCnpj[] = [];
  try { semCnpj = (await pool.query('SELECT * FROM fiscoia.integration_offices_without_cnpj()')).rows.map((x: any) => ({ id: String(x.id), name: String(x.name), ownerEmail: String(x.owner_email ?? '') })); } catch { return; }
  for (const t of semCnpj) {
    if (!tratados.has(t.id)) out.avisos.push(`O escritório ${t.name} está sem CNPJ no Fisco IA e não tem correspondência no Fiscal (e-mail do proprietário ${t.ownerEmail || 'desconhecido'}): cadastre em Painel MURADE → Escritórios contratantes.`);
    else if (!semFuncao && tratados.get(t.id) === undefined) out.avisos.push(`O escritório ${t.name} está sem CNPJ no Fisco IA e o Fiscal também não tem o CNPJ dele: cadastre no Fiscal (Usuários e empresas → CNPJ do escritório) ou em Painel MURADE → Escritórios contratantes.`);
  }
}

let ultimoResultado: (ResultadoEmpresasFiscal & { em: string }) | null = null;
export function ultimoResultadoEmpresasFiscal() { return ultimoResultado; }

let emExecucao = false;
export async function executarEmpresasDoFiscal(): Promise<string> {
  if (emExecucao) return 'Já em execução.';
  emExecucao = true;
  try {
    const r = await sincronizarEmpresasDoFiscal();
    if (r.erro) throw new Error(r.erro);
    return `${r.lidas} empresa(s) lida(s) do Fiscal; ${r.criadas} criada(s) no Fisco IA, ${r.jaExistiam} já existiam, ${r.semEscritorio} sem escritório correspondente (e-mail do dono diferente), ${r.ambiguas} sem dono certo (em mais de um escritório), ${r.invalidas} inválida(s)${r.retiradas ? `, ${r.retiradas} retirada(s) do escritório errado` : ''}${r.cnpjPreenchidos ? `; CNPJ de ${r.cnpjPreenchidos} escritório(s) preenchido(s) a partir do Fiscal` : ''}.${r.avisos.length ? ` AVISOS: ${r.avisos.join(' | ')}` : ''}`;
  } finally { emExecucao = false; }
}
