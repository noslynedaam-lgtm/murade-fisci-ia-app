// Credenciais do SERPRO POR ESCRITÓRIO. Regras:
//  - a credencial global (variáveis de ambiente) só vale para o escritório do dono do sistema ou quando o DP, já tendo conferido modo/vagas, pede "global";
//  - escritório com credencial própria usa SÓ a dele (cifrada, por escritório); nunca é devolvida inteira, nunca vai para log;
//  - sem credencial utilizável = recusa (fail-closed), antes de reservar cota ou chamar o SERPRO.
import { criptografarCredencialEscritorio, descriptografarCredencialEscritorio } from '../../server/encryption';
import { prepararPfx, pfxDeVariavel } from '../../server/pfxCompat';
import { normalizarCnpj, validarCnpj } from '../cnpj/cnpjValidation';

export interface CredencialSerpro { consumerKey: string; consumerSecret: string; contratanteCnpj: string; pfxBase64: string; pfxSenha: string; origem: 'global' | 'propria' }
export type Consulta = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };

export type DecisaoFonte = { ok: true; fonte: 'global' | 'propria' } | { ok: false; http: number; mensagem: string };
/** Qual credencial usar. `viaPonte` = pedido do DP (credencial de integração), que já decidiu modo teste/efetivo e vagas. */
export function decidirFonteCredencial(p: { dono: boolean; pedida?: unknown; viaPonte: boolean; propriaExiste: boolean; liberadoPeloDono?: boolean }): DecisaoFonte {
  if (p.dono) return { ok: true, fonte: 'global' };
  // Escritório que o dono liberou por inteiro (hoje, o da contadora do dono) e que não cadastrou credencial própria usa a
  // credencial do dono. Quem tem credencial própria continua usando a própria. Só a conta administradora libera um escritório.
  if (p.liberadoPeloDono === true && !p.propriaExiste && p.pedida !== 'propria') return { ok: true, fonte: 'global' };
  const pedida = p.pedida === 'global' || p.pedida === 'propria' ? p.pedida : undefined;
  if (pedida === 'global') return p.viaPonte ? { ok: true, fonte: 'global' } : { ok: false, http: 403, mensagem: 'A credencial do dono do sistema não vale para este escritório. Nada foi consultado nem cobrado.' };
  if (pedida === 'propria' || (!p.viaPonte && !pedida)) {
    return p.propriaExiste ? { ok: true, fonte: 'propria' } : { ok: false, http: 409, mensagem: 'Contrate o Integra Contador com o e-CNPJ do seu escritório e informe as credenciais. Nada foi consultado nem cobrado.' };
  }
  return { ok: false, http: 403, mensagem: 'Este escritório não está liberado para consultas pagas. Nada foi consultado nem cobrado.' };
}

export function credencialGlobal(env: Record<string, string | undefined>): CredencialSerpro | null {
  const k = env.SERPRO_PRODUCAO_CONSUMER_KEY?.trim(), s = env.SERPRO_PRODUCAO_CONSUMER_SECRET?.trim(), c = env.SERPRO_CONTRATANTE_CNPJ?.trim(), p = env.SERPRO_CERT_PFX_BASE64?.trim();
  if (!k || !s || !c || !p || !env.SERPRO_CERT_PFX_SENHA) return null;
  return { consumerKey: k, consumerSecret: s, contratanteCnpj: c, pfxBase64: p, pfxSenha: env.SERPRO_CERT_PFX_SENHA, origem: 'global' };
}

let preparada = new WeakSet<Consulta>();
async function tabela(db: Consulta) {
  if (preparada.has(db)) return;
  // A tabela nasce pela migração 025. Aqui só tenta criar (bancos antigos); sem permissão, segue: se a tabela existir, a consulta funciona.
  try {
  await db.query(`CREATE TABLE IF NOT EXISTS serpro_credenciais_escritorio (escritorio_id text PRIMARY KEY, contratante_cnpj text NOT NULL, segredo bytea NOT NULL, nonce bytea NOT NULL, auth_tag bytea NOT NULL, key_version text NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now())`);
  } catch { /* sem permissão de criar: a migração cuida */ }
  preparada.add(db);
}
export function validarEscritorioId(id: unknown): string | null { const s = String(id ?? ''); return /^[A-Za-z0-9._-]{1,64}$/.test(s) ? s : null; }

export interface EntradaCredencial { consumerKey: string; consumerSecret: string; contratanteCnpj: string; certPfxBase64: string; certSenha: string }
export function validarEntradaCredencial(e: EntradaCredencial): { ok: true; cnpj: string } | { ok: false; mensagem: string } {
  const cnpj = normalizarCnpj(String(e.contratanteCnpj ?? ''));
  if (!validarCnpj(cnpj)) return { ok: false, mensagem: 'CNPJ contratante inválido.' };
  if (String(e.consumerKey ?? '').trim().length < 8 || String(e.consumerSecret ?? '').trim().length < 8) return { ok: false, mensagem: 'Consumer Key e Consumer Secret parecem incompletos.' };
  if (!e.certSenha) return { ok: false, mensagem: 'Informe a senha do certificado.' };
  const p = prepararPfx(pfxDeVariavel(String(e.certPfxBase64 ?? '')), String(e.certSenha));
  if (p.ok === false) return { ok: false, mensagem: 'Não foi possível abrir o certificado e-CNPJ (arquivo .pfx ou senha incorretos).' };
  return { ok: true, cnpj };
}
export async function guardarCredencial(db: Consulta, escritorioId: string, e: EntradaCredencial): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  const v = validarEntradaCredencial(e); if (v.ok === false) return v;
  const blob = Buffer.from(JSON.stringify({ k: e.consumerKey.trim(), s: e.consumerSecret.trim(), c: v.cnpj, p: String(e.certPfxBase64).trim(), w: e.certSenha }), 'utf8');
  const cif = criptografarCredencialEscritorio(escritorioId, blob);
  await tabela(db);
  await db.query(`INSERT INTO serpro_credenciais_escritorio (escritorio_id, contratante_cnpj, segredo, nonce, auth_tag, key_version) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (escritorio_id) DO UPDATE SET contratante_cnpj=EXCLUDED.contratante_cnpj, segredo=EXCLUDED.segredo, nonce=EXCLUDED.nonce, auth_tag=EXCLUDED.auth_tag, key_version=EXCLUDED.key_version, atualizado_em=now()`,
  [escritorioId, v.cnpj, cif.ciphertext, cif.nonce, cif.authTag, cif.keyVersion]);
  return { ok: true };
}
export async function removerCredencial(db: Consulta, escritorioId: string): Promise<boolean> {
  await tabela(db); const r = await db.query('DELETE FROM serpro_credenciais_escritorio WHERE escritorio_id=$1 RETURNING escritorio_id', [escritorioId]); return r.rows.length > 0;
}
/** Só "existe ou não" (nunca o conteúdo). */
export async function credencialExiste(db: Consulta, escritorioId: string): Promise<boolean> {
  await tabela(db); return (await db.query('SELECT 1 FROM serpro_credenciais_escritorio WHERE escritorio_id=$1', [escritorioId])).rows.length > 0;
}
export async function carregarCredencial(db: Consulta, escritorioId: string): Promise<CredencialSerpro | null> {
  await tabela(db);
  const r = (await db.query('SELECT segredo, nonce, auth_tag, key_version FROM serpro_credenciais_escritorio WHERE escritorio_id=$1', [escritorioId])).rows[0];
  if (!r) return null;
  try {
    const j = JSON.parse(descriptografarCredencialEscritorio(escritorioId, { ciphertext: Buffer.from(r.segredo), nonce: Buffer.from(r.nonce), authTag: Buffer.from(r.auth_tag), keyVersion: String(r.key_version) }).toString('utf8'));
    return { consumerKey: j.k, consumerSecret: j.s, contratanteCnpj: j.c, pfxBase64: j.p, pfxSenha: j.w, origem: 'propria' };
  } catch { return null; }
}
