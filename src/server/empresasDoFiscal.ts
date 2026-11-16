import { comContextoTenant, obterPoolBanco } from './persistence';
import { urlDoSistema } from './agentesEntreSistemas';
import { validarCnpj, normalizarCnpj } from '../services/cnpj/cnpjValidation';

// Robô Fiscal → Fisco IA (empresas). Toda empresa cadastrada no Murade Fiscal passa a existir no Fisco IA, no escritório certo.
// Regras de segurança:
// - O escritório do Fiscal (login) só é ligado ao escritório do Fisco IA cujo PROPRIETÁRIO (OWNER) tem exatamente o mesmo e-mail.
//   Se não houver correspondência, nada é criado (nunca joga empresa de um escritório no de outro).
// - Só cria o que não existe. Nunca altera cadastro existente e nunca reativa empresa que foi arquivada/excluída aqui.
// - Só dados cadastrais básicos. Empresa bloqueada no Fiscal não é criada.
export interface EmpresaDoFiscal { cnpj: string; razaoSocial: string; uf: string; cidade: string; regime: string; status: string; escritorio: string }
export interface ResultadoEmpresasFiscal { lidas: number; criadas: number; jaExistiam: number; semEscritorio: number; invalidas: number; erro?: string }

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
  }));
}

export async function sincronizarEmpresasDoFiscal(env: Record<string, string | undefined> = process.env, buscar: typeof fetch = fetch): Promise<ResultadoEmpresasFiscal> {
  const out: ResultadoEmpresasFiscal = { lidas: 0, criadas: 0, jaExistiam: 0, semEscritorio: 0, invalidas: 0 };
  const pool = obterPoolBanco();
  if (!pool) return { ...out, erro: 'Banco permanente não configurado.' };
  let empresas: EmpresaDoFiscal[];
  try { empresas = await lerEmpresasDoFiscal(env, buscar); } catch (e: any) { return { ...out, erro: String(e?.message || 'Falha ao ler o Fiscal.').slice(0, 200) }; }
  out.lidas = empresas.length;
  const porLogin = new Map<string, EmpresaDoFiscal[]>();
  for (const e of empresas) {
    if (e.status === 'Bloqueada') continue;
    if (!validarCnpj(e.cnpj) || e.razaoSocial.length < 2 || e.razaoSocial.length > 240) { out.invalidas += 1; continue; }
    porLogin.set(e.escritorio, [...(porLogin.get(e.escritorio) ?? []), e]);
  }
  let criadasNaRodada = 0;
  for (const [login, lista] of porLogin) {
    if (!login) { out.semEscritorio += lista.length; continue; }
    // Escritório do Fisco IA: o primeiro em que o dono (OWNER) tem este e-mail. (A leitura das filiações exige o contexto do usuário.)
    const alvo = await escritorioDoDono(pool, login);
    if (!alvo) { out.semEscritorio += lista.length; continue; }
    const userId = alvo.userId, tenantId = alvo.tenantId;
    const r = await comContextoTenant(userId, tenantId, async (c) => {
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
      return { criadas, existiam };
    }, ['OWNER']);
    if (r.autorizado && r.resultado) { out.criadas += r.resultado.criadas; out.jaExistiam += r.resultado.existiam; } else out.semEscritorio += lista.length;
  }
  return out;
}

async function escritorioDoDono(pool: NonNullable<ReturnType<typeof obterPoolBanco>>, email: string): Promise<{ userId: string; tenantId: string } | null> {
  const u = (await pool.query('SELECT id FROM fiscoia.users WHERE email = $1 AND active = true LIMIT 1', [email]).catch(() => ({ rows: [] as any[] }))).rows[0];
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

let emExecucao = false;
export async function executarEmpresasDoFiscal(): Promise<string> {
  if (emExecucao) return 'Já em execução.';
  emExecucao = true;
  try {
    const r = await sincronizarEmpresasDoFiscal();
    if (r.erro) throw new Error(r.erro);
    return `${r.lidas} empresa(s) lida(s) do Fiscal; ${r.criadas} criada(s) no Fisco IA, ${r.jaExistiam} já existiam, ${r.semEscritorio} sem escritório correspondente (e-mail do dono diferente), ${r.invalidas} inválida(s).`;
  } finally { emExecucao = false; }
}
