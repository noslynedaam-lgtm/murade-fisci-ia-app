import { Router, type Request, type Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { pbkdf2 as pbkdf2Callback } from 'node:crypto';
import { obterPoolBanco } from './persistence';
import { emailConfigurado, enviarEmail } from './emailMurade';
import { normalizarCnpj, validarCnpj } from '../services/cnpj/cnpjValidation';

const pbkdf2 = promisify(pbkdf2Callback);
const router = Router();
const COOKIE_NAME = 'fiscoia_session';
const SESSION_SECONDS = 8 * 60 * 60;
const SESSION_LONGA_SECONDS = 90 * 24 * 60 * 60;
/** Celular/tablet: a senha é pedida só no primeiro acesso (sessão de 90 dias), a menos que a pessoa ligue "pedir senha ao abrir". */
export function ehCelularUA(ua: string): boolean { return /Android|iPhone|iPad|iPod|Mobile/i.test(ua || ''); }
function exigeSenhaAoAbrir(req: Request): boolean { return /(?:^|;\s*)murade_exigir_senha=1(?:;|$)/.test(req.headers.cookie || ''); }
export function duracaoSessao(req: Request): number { return ehCelularUA(String(req.headers['user-agent'] || '')) && !exigeSenhaAoAbrir(req) ? SESSION_LONGA_SECONDS : SESSION_SECONDS; }
const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_HASH_PREFIX = 'pbkdf2-sha256$';
const DUMMY_PASSWORD_HASH = `${PASSWORD_HASH_PREFIX}210000$00112233445566778899aabbccddeeff$${'00'.repeat(32)}`;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function dataCivilValida(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

type PublicUser = {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  cpfCnpj?: string;
  crc?: string;
  idPlano: 'basico' | 'profissional' | 'empresarial';
  nomePlano: string;
  dataVencimento: string;
  primeiroAcesso: boolean;
  ativo: boolean;
  ehAdmin: boolean;
  tipo: 'ADMIN' | 'CONTADOR';
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function cookieFlags(): string {
  return `Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

function definirCookie(res: Response, token: string, segundos: number = SESSION_SECONDS): void {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${segundos}; ${cookieFlags()}`);
}

function limparCookie(res: Response): void {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Max-Age=0; ${cookieFlags()}`);
}

function lerCookie(req: Request, nome: string): string | null {
  const item = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${nome}=`));
  if (!item) return null;
  try { return decodeURIComponent(item.slice(nome.length + 1)); } catch { return null; }
}

function usuarioPublico(row: Record<string, unknown>): PublicUser {
  const ehAdmin = row.is_admin === true || row.account_type === 'ADMIN';
  return {
    id: String(row.id),
    nome: String(row.display_name),
    email: String(row.email),
    telefone: typeof row.phone === 'string' ? row.phone : undefined,
    cpfCnpj: typeof row.tax_id === 'string' ? row.tax_id : undefined,
    crc: typeof row.crc === 'string' ? row.crc : undefined,
    idPlano: row.plan_id === 'profissional' || row.plan_id === 'empresarial' ? row.plan_id : 'basico',
    nomePlano: String(row.plan_name || 'Básico'),
    dataVencimento: row.expires_on instanceof Date ? row.expires_on.toISOString().slice(0, 10) : String(row.expires_on || ''),
    primeiroAcesso: row.must_change_password === true,
    ativo: row.active === true,
    ehAdmin,
    tipo: ehAdmin ? 'ADMIN' : 'CONTADOR',
  };
}

async function verificarHash(armazenado: unknown, senha: string): Promise<boolean> {
  if (typeof armazenado !== 'string' || !armazenado.startsWith(PASSWORD_HASH_PREFIX)) return false;
  const [, iteracoesText, saltHex, hashHex] = armazenado.split('$');
  const iteracoes = Number(iteracoesText);
  if (!Number.isInteger(iteracoes) || iteracoes < 100_000 || iteracoes > 1_000_000
    || !/^(?:[0-9a-f]{2}){16,64}$/i.test(saltHex || '')
    || !/^(?:[0-9a-f]{2}){32}$/i.test(hashHex || '')) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const recebido = await pbkdf2(senha, Buffer.from(saltHex, 'hex'), iteracoes, esperado.length, 'sha256');
  return timingSafeEqual(esperado, recebido);
}

async function criarHash(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const digest = await pbkdf2(senha, salt, PASSWORD_ITERATIONS, 32, 'sha256');
  return `${PASSWORD_HASH_PREFIX}${PASSWORD_ITERATIONS}$${salt.toString('hex')}$${Buffer.from(digest).toString('hex')}`;
}

/** O app não é dono das tabelas: as políticas RLS só mostram a equipe do escritório quando app.tenant_id está definido. */
async function definirEscritorioDoResponsavel(client: { query: (sql: string, params?: unknown[]) => Promise<unknown> }, userId: string) {
  await client.query(
    `SELECT set_config('app.tenant_id', COALESCE((SELECT tenant_id::text FROM fiscoia.tenant_memberships WHERE user_id = $1::uuid AND role IN ('OWNER', 'ADMIN') ORDER BY (role = 'OWNER') DESC LIMIT 1), ''), true)`,
    [userId],
  );
}

/** Consulta sob a identidade do usuário: as políticas RLS de vínculos exigem app.user_id na transação. */
async function consultarComoUsuario(pool: NonNullable<ReturnType<typeof obterPoolBanco>>, userId: string, sql: string, params: unknown[]) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    await definirEscritorioDoResponsavel(client, userId);
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
  finally { client.release(); }
}

let cnpjEscritorioAplicado: boolean | null = null;
/** True quando a migração 016 (CNPJ do escritório) já foi aplicada. */
async function cnpjEscritorioDisponivel(pool: NonNullable<ReturnType<typeof obterPoolBanco>>): Promise<boolean> {
  if (cnpjEscritorioAplicado === true) return true;
  try {
    const r = await pool.query("SELECT to_regprocedure('fiscoia.platform_set_office_cnpj(uuid, uuid, text)') IS NOT NULL AS ok");
    cnpjEscritorioAplicado = r.rows[0]?.ok === true;
  } catch { cnpjEscritorioAplicado = false; }
  return cnpjEscritorioAplicado;
}

let limiteUsuariosAplicado: boolean | null = null;
/** True quando a migração 013 (limite de usuários por escritório) já foi aplicada. */
async function limiteUsuariosDisponivel(pool: NonNullable<ReturnType<typeof obterPoolBanco>>): Promise<boolean> {
  if (limiteUsuariosAplicado === true) return true;
  try {
    const r = await pool.query("SELECT to_regprocedure('fiscoia.office_user_limit_reached(uuid)') IS NOT NULL AS ok");
    limiteUsuariosAplicado = r.rows[0]?.ok === true;
  } catch { limiteUsuariosAplicado = false; }
  return limiteUsuariosAplicado;
}

let funcoesEscritoriosAplicadas: boolean | null = null;
/** True quando a migração 012 (escritórios contratantes) já foi aplicada no banco. */
async function escritoriosDisponiveis(pool: NonNullable<ReturnType<typeof obterPoolBanco>>): Promise<boolean> {
  if (funcoesEscritoriosAplicadas === true) return true;
  try {
    const r = await pool.query("SELECT to_regprocedure('fiscoia.user_is_blocked(uuid)') IS NOT NULL AS ok");
    funcoesEscritoriosAplicadas = r.rows[0]?.ok === true;
  } catch { funcoesEscritoriosAplicadas = false; }
  return funcoesEscritoriosAplicadas;
}

/** Conta de escritório bloqueado pelo dono do sistema (falta de pagamento): não entra. */
async function usuarioDeEscritorioBloqueado(pool: NonNullable<ReturnType<typeof obterPoolBanco>>, userId: unknown, ehAdmin: boolean): Promise<boolean> {
  if (ehAdmin || !(await escritoriosDisponiveis(pool))) return false;
  try {
    const r = await pool.query('SELECT fiscoia.user_is_blocked($1::uuid) AS bloqueado', [userId]);
    return r.rows[0]?.bloqueado === true;
  } catch { return false; }
}

async function obterSessao(req: Request): Promise<{ tokenHash: string; user: PublicUser; passwordHash: string } | null> {
  const pool = obterPoolBanco();
  const token = lerCookie(req, COOKIE_NAME);
  if (!pool || !token || token.length > 512) return null;
  const result = await pool.query(
    `SELECT s.token_sha256, u.*
       FROM fiscoia.auth_sessions s
       JOIN fiscoia.users u ON u.id = s.user_id
      WHERE s.token_sha256 = $1 AND s.revoked_at IS NULL
        AND s.expires_at > now() AND u.active = true
      LIMIT 1`,
    [hashToken(token)],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  if (await usuarioDeEscritorioBloqueado(pool, row.id, row.is_admin === true || row.account_type === 'ADMIN')) return null;
  return { tokenHash: String(row.token_sha256), user: usuarioPublico(row), passwordHash: String(row.password_hash) };
}

/** Identificador não reversível da sessão e dados mínimos do usuário, para a Agente IA. */
export async function obterIdentidadeAgente(req: Request): Promise<{ sessaoHash: string; userId: string; nome: string } | null> {
  const session = await obterSessao(req);
  return session ? { sessaoHash: session.tokenHash.slice(0, 32), userId: session.user.id, nome: session.user.nome } : null;
}

/** Identidade pública da sessão, compartilhada com rotas protegidas por tenant. */
export async function obterUsuarioDaSessao(req: Request): Promise<PublicUser | null> {
  const session = await obterSessao(req);
  return session?.user ?? null;
}

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});

router.post('/login', async (req, res) => {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const rate = rateLimits.get(ip);
  const current = !rate || now >= rate.resetAt ? { count: 0, resetAt: now + 15 * 60_000 } : rate;
  if (rateLimits.size > 1000) {
    for (const [key, value] of rateLimits) if (now >= value.resetAt) rateLimits.delete(key);
    if (rateLimits.size > 1000) rateLimits.clear();
  }
  current.count += 1;
  rateLimits.set(ip, current);
  if (current.count > 10) return res.status(429).json({ mensagem: 'Muitas tentativas. Aguarde 15 minutos.' });

  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Autenticação central indisponível: banco permanente não configurado.' });
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
  if (!email || email.length > 254 || !senha || senha.length > 1024) {
    return res.status(400).json({ mensagem: 'Informe e-mail e senha.' });
  }

  try {
    const result = await pool.query('SELECT * FROM fiscoia.users WHERE email = $1 LIMIT 1', [email]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    // Mantém o custo PBKDF2 também quando o e-mail não existe, reduzindo
    // diferenças de tempo que poderiam revelar quais contas estão cadastradas.
    const senhaValida = await verificarHash(row?.password_hash ?? DUMMY_PASSWORD_HASH, senha);
    // A resposta é igual para conta inexistente, senha incorreta ou conta suspensa.
    if (!row || row.active !== true || !senhaValida || await usuarioDeEscritorioBloqueado(pool, row.id, row.is_admin === true || row.account_type === 'ADMIN')) {
      return res.status(401).json({ mensagem: 'E-mail ou senha incorretos.' });
    }
    const rawToken = randomBytes(32).toString('base64url');
    const duracao = duracaoSessao(req);
    await pool.query(
      `INSERT INTO fiscoia.auth_sessions (user_id, token_sha256, expires_at)
       VALUES ($1, $2, now() + ($3 * interval '1 second'))`,
      [row.id, hashToken(rawToken), duracao],
    );
    definirCookie(res, rawToken, duracao);
    rateLimits.delete(ip);
    return res.json({ sucesso: true, usuario: usuarioPublico(row) });
  } catch {
    return res.status(503).json({ mensagem: 'Autenticação central indisponível. Verifique banco e migrações.' });
  }
});

router.get('/session', async (req, res) => {
  if (!obterPoolBanco()) return res.status(503).json({ autenticado: false, mensagem: 'Banco permanente não configurado.' });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ autenticado: false });
    return res.json({ autenticado: true, usuario: session.user });
  } catch {
    return res.status(503).json({ autenticado: false, mensagem: 'Não foi possível validar a sessão no banco.' });
  }
});

router.patch('/profile', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const telefone = typeof req.body?.telefone === 'string' ? req.body.telefone.trim() : '';
  const crc = typeof req.body?.crc === 'string' ? req.body.crc.trim().toUpperCase() : '';
  const taxId = typeof req.body?.cpfCnpj === 'string' ? req.body.cpfCnpj.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  if (nome.length < 2 || nome.length > 160) return res.status(400).json({ mensagem: 'Informe um nome entre 2 e 160 caracteres.' });
  if (telefone.length > 40 || crc.length > 40) return res.status(400).json({ mensagem: 'Telefone ou CRC excede o tamanho permitido.' });
  if (taxId && !(/^[0-9]{11}$/.test(taxId) || /^[A-Z0-9]{14}$/.test(taxId))) {
    return res.status(400).json({ mensagem: 'Informe CPF com 11 caracteres ou CNPJ com 14 caracteres.' });
  }
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const result = await pool.query(
      `UPDATE fiscoia.users
          SET display_name = $1, phone = NULLIF($2, ''), crc = NULLIF($3, ''), tax_id = NULLIF($4, ''), updated_at = now()
        WHERE id = $5 AND active = true RETURNING *`,
      [nome, telefone, crc, taxId, session.user.id],
    );
    if (!result.rowCount) return res.status(401).json({ mensagem: 'Conta indisponível.' });
    return res.json({ sucesso: true, usuario: usuarioPublico(result.rows[0] as Record<string, unknown>) });
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível salvar o perfil no banco central.' });
  }
});

router.post('/change-password', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const senhaAtual = typeof req.body?.senhaAtual === 'string' ? req.body.senhaAtual : '';
  const novaSenha = typeof req.body?.novaSenha === 'string' ? req.body.novaSenha : '';
  if (novaSenha.length < 12 || novaSenha.length > 1024) return res.status(400).json({ mensagem: 'A nova senha deve ter entre 12 e 1024 caracteres.' });

  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    if (!(await verificarHash(session.passwordHash, senhaAtual))) return res.status(401).json({ mensagem: 'Senha atual incorreta.' });
    const novoHash = await criarHash(novaSenha);
    const client = await pool.connect();
    let changed;
    try {
      await client.query('BEGIN');
      changed = await client.query(
        `UPDATE fiscoia.users SET password_hash = $1, must_change_password = false, updated_at = now()
          WHERE id = $2 AND active = true RETURNING *`,
        [novoHash, session.user.id],
      );
      if (!changed.rowCount) {
        await client.query('ROLLBACK');
        return res.status(401).json({ mensagem: 'Conta indisponível.' });
      }
      await client.query(
        `UPDATE fiscoia.auth_sessions SET revoked_at = now()
          WHERE user_id = $1 AND token_sha256 <> $2 AND revoked_at IS NULL`,
        [session.user.id, session.tokenHash],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    return res.json({
      sucesso: true,
      mensagem: 'Senha alterada; as outras sessões foram encerradas.',
      usuario: usuarioPublico(changed.rows[0] as Record<string, unknown>),
    });
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível alterar a senha no banco.' });
  }
});

// Quem pode ver e gerar convites/equipe: o dono do sistema e o responsável (OWNER/ADMIN) do escritório. Equipe comum não.
router.get('/equipe/permissao', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ podeGerenciar: false });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ podeGerenciar: false });
    if (session.user.ehAdmin) return res.json({ podeGerenciar: true });
    const r = await consultarComoUsuario(pool, session.user.id, `SELECT 1 FROM fiscoia.tenant_memberships WHERE user_id = $1 AND role IN ('OWNER', 'ADMIN') LIMIT 1`, [session.user.id]);
    return res.json({ podeGerenciar: Boolean(r.rows[0]) });
  } catch { return res.status(503).json({ podeGerenciar: false }); }
});

router.get('/users', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const result = await consultarComoUsuario(pool, session.user.id,
      `SELECT u.id, u.display_name, u.email, u.crc, u.plan_id, u.active, u.is_admin, u.must_change_password, m.role
         FROM fiscoia.tenant_memberships mine
         JOIN fiscoia.tenant_memberships m ON m.tenant_id = mine.tenant_id
         JOIN fiscoia.users u ON u.id = m.user_id
        WHERE mine.user_id = $1 AND mine.role IN ('OWNER', 'ADMIN')
        ORDER BY u.display_name, u.email`,
      [session.user.id],
    );
    return res.json({ contas: result.rows.map((row) => ({
      id: String(row.id), nome: String(row.display_name), email: String(row.email),
      crc: typeof row.crc === 'string' ? row.crc : '',
      tipo: row.role === 'OWNER' || row.role === 'ADMIN' ? 'ADMIN' : 'CONTADOR',
      papel: String(row.role),
      ehAdmin: row.is_admin === true,
      ativo: row.active === true,
      primeiroAcesso: row.must_change_password === true,
      plano: row.plan_id,
    })) });
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível carregar as contas centrais.' });
  }
});

router.post('/users', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });

    const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const telefone = typeof req.body?.telefone === 'string' ? req.body.telefone.trim().slice(0, 40) : null;
    const taxIdRaw = typeof req.body?.cpfCnpj === 'string' ? req.body.cpfCnpj.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
    const crc = typeof req.body?.crc === 'string' ? req.body.crc.trim().slice(0, 40) : null;
    const planId = req.body?.idPlano;
    const expiresOn = typeof req.body?.dataVencimento === 'string' ? req.body.dataVencimento : '';
    if (nome.length < 2 || nome.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ mensagem: 'Nome ou e-mail inválido.' });
    }
    if (!['basico', 'profissional', 'empresarial'].includes(planId)) return res.status(400).json({ mensagem: 'Plano inválido.' });
    if (taxIdRaw && !(/^[0-9]{11}$/.test(taxIdRaw) || /^[A-Z0-9]{14}$/.test(taxIdRaw))) {
      return res.status(400).json({ mensagem: 'CPF/CNPJ inválido.' });
    }
    if (expiresOn && !dataCivilValida(expiresOn)) return res.status(400).json({ mensagem: 'Data de vencimento inválida.' });

    const membership = await consultarComoUsuario(pool, session.user.id,
      `SELECT tenant_id FROM fiscoia.tenant_memberships
        WHERE user_id = $1 AND role IN ('OWNER', 'ADMIN')
        ORDER BY (role = 'OWNER') DESC LIMIT 1`,
      [session.user.id],
    );
    if (!membership.rows[0]) return res.status(403).json({ mensagem: session.user.ehAdmin ? 'Conta administrativa sem escritório proprietário configurado.' : 'Somente o responsável do escritório cadastra a equipe.' });

    if (await limiteUsuariosDisponivel(pool)) {
      const cheio = await pool.query('SELECT fiscoia.office_user_limit_reached($1::uuid) AS limite', [membership.rows[0].tenant_id]);
      if (cheio.rows[0]?.limite != null) return res.status(409).json({ mensagem: `O plano deste escritório permite ${cheio.rows[0].limite} usuário(s) (dono incluso) e todos já estão em uso. Fale com o fornecedor para ampliar.` });
    }
    const planNames: Record<string, string> = { basico: 'Básico', profissional: 'Profissional', empresarial: 'Empresarial' };
    const convite = randomBytes(32).toString('base64url');
    const passwordHash = await criarHash(randomBytes(48).toString('base64url'));
    const appUrl = (process.env.APP_URL || 'https://murade-fisco-ia.onrender.com').replace(/\/$/, '');
    let conviteBase: URL;
    try {
      conviteBase = new URL(appUrl);
      if (conviteBase.protocol !== 'https:' && process.env.NODE_ENV === 'production') throw new Error('APP_URL must use HTTPS');
    } catch {
      return res.status(503).json({ mensagem: 'Convites indisponíveis: configure uma URL pública HTTPS válida no APP_URL.' });
    }
    // O fragmento não é enviado em requisições HTTP nem em cabeçalhos Referer.
    conviteBase.hash = new URLSearchParams({ convite }).toString();
    const hashConvite = hashToken(convite);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.user_id', $1, true)", [session.user.id]);
      await definirEscritorioDoResponsavel(client, session.user.id);
      const inserted = await client.query(
        `INSERT INTO fiscoia.users
           (email, password_hash, display_name, phone, tax_id, crc, plan_id, plan_name, expires_on, must_change_password, account_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, '')::date, true, 'CONTADOR')
         RETURNING *`,
        [email, passwordHash, nome, telefone, taxIdRaw || null, crc, planId, planNames[planId], expiresOn],
      );
      await client.query(
        "INSERT INTO fiscoia.tenant_memberships (tenant_id, user_id, role) VALUES ($1, $2, 'CONTADOR')",
        [membership.rows[0].tenant_id, inserted.rows[0].id],
      );
      await client.query(
        `UPDATE fiscoia.password_reset_tokens SET consumed_at = now()
          WHERE user_id = $1 AND consumed_at IS NULL`,
        [inserted.rows[0].id],
      );
      await client.query(
        `INSERT INTO fiscoia.password_reset_tokens (token_sha256, user_id, purpose, expires_at)
         VALUES ($1, $2, 'FIRST_ACCESS', now() + interval '30 days')`,
        [hashConvite, inserted.rows[0].id],
      );
      await client.query('COMMIT');
      return res.status(201).json({
        sucesso: true,
        mensagem: 'Conta criada no servidor. Envie o link de uso único ao usuário; ele expira em 30 dias. Nenhum e-mail foi enviado.',
        conviteUrl: conviteBase.toString(),
        usuario: usuarioPublico(inserted.rows[0] as Record<string, unknown>),
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        return res.status(409).json({ mensagem: 'Já existe uma conta com este e-mail.' });
      }
      throw error;
    } finally {
      client.release();
    }
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível criar a conta no banco.' });
  }
});


router.post('/users/:id/block', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const id = String(req.params.id || '');
  const bloqueado = req.body?.bloqueado === true;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ mensagem: 'Identificador de usuário inválido.' });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.user_id', $1, true)", [session.user.id]);
      await definirEscritorioDoResponsavel(client, session.user.id);
      const membership = await client.query(
        `SELECT mine.tenant_id FROM fiscoia.tenant_memberships mine
          WHERE mine.user_id=$1 AND mine.role IN ('OWNER','ADMIN')
          ORDER BY (mine.role='OWNER') DESC LIMIT 1`,
        [session.user.id],
      );
      if (!membership.rows[0]) { await client.query('ROLLBACK'); return res.status(403).json({ mensagem: 'Somente o responsável do escritório pode gerenciar a equipe.' }); }
      const target = await client.query(
        `SELECT m.role FROM fiscoia.tenant_memberships m
          JOIN fiscoia.users u ON u.id=m.user_id
          WHERE m.tenant_id=$1 AND m.user_id=$2
          FOR UPDATE OF m,u`,
        [membership.rows[0].tenant_id, id],
      );
      if (!target.rows[0] || target.rows[0].role !== 'CONTADOR') { await client.query('ROLLBACK'); return res.status(404).json({ mensagem: 'Membro não encontrado neste escritório.' }); }
      await client.query('UPDATE fiscoia.users SET active=$1,updated_at=now() WHERE id=$2', [!bloqueado, id]);
      if (bloqueado) await client.query('UPDATE fiscoia.auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [id]);
      await client.query('COMMIT');
      return res.json({ sucesso: true, bloqueado });
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
    finally { client.release(); }
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível atualizar o acesso do membro.' });
  }
});

router.delete('/users/:id', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const id = String(req.params.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ mensagem: 'Identificador de usuário inválido.' });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.user_id', $1, true)", [session.user.id]);
      await definirEscritorioDoResponsavel(client, session.user.id);
      const membership = await client.query(
        `SELECT mine.tenant_id FROM fiscoia.tenant_memberships mine
          WHERE mine.user_id=$1 AND mine.role IN ('OWNER','ADMIN')
          ORDER BY (mine.role='OWNER') DESC LIMIT 1`,
        [session.user.id],
      );
      if (!membership.rows[0]) { await client.query('ROLLBACK'); return res.status(403).json({ mensagem: 'Somente o responsável do escritório pode gerenciar a equipe.' }); }
      const target = await client.query(
        `SELECT m.role FROM fiscoia.tenant_memberships m
          JOIN fiscoia.users u ON u.id=m.user_id
          WHERE m.tenant_id=$1 AND m.user_id=$2
          FOR UPDATE OF m,u`,
        [membership.rows[0].tenant_id, id],
      );
      if (!target.rows[0] || target.rows[0].role !== 'CONTADOR') { await client.query('ROLLBACK'); return res.status(404).json({ mensagem: 'Membro não encontrado neste escritório.' }); }
      await client.query('DELETE FROM fiscoia.tenant_memberships WHERE tenant_id=$1 AND user_id=$2', [membership.rows[0].tenant_id, id]);
      await client.query('UPDATE fiscoia.users SET active=EXISTS(SELECT 1 FROM fiscoia.tenant_memberships WHERE user_id=$1),updated_at=now() WHERE id=$1', [id]);
      await client.query('UPDATE fiscoia.auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [id]);
      await client.query("UPDATE fiscoia.password_reset_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL", [id]);
      await client.query('COMMIT');
      return res.json({ sucesso: true, mensagem: 'Membro removido do escritório. A conta e os dados foram preservados.' });
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
    finally { client.release(); }
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível remover o membro.' });
  }
});

router.post('/users/:id/excluir', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const id = String(req.params.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ mensagem: 'Identificador de usuário inválido.' });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.user_id', $1, true)", [session.user.id]);
      await definirEscritorioDoResponsavel(client, session.user.id);
      const membership = await client.query(
        `SELECT tenant_id FROM fiscoia.tenant_memberships WHERE user_id=$1 AND role IN ('OWNER','ADMIN') ORDER BY (role='OWNER') DESC LIMIT 1`, [session.user.id]);
      if (!membership.rows[0]) { await client.query('ROLLBACK'); return res.status(403).json({ mensagem: 'Somente o responsável do escritório pode gerenciar a equipe.' }); }
      const target = await client.query(
        `SELECT m.role FROM fiscoia.tenant_memberships m JOIN fiscoia.users u ON u.id=m.user_id WHERE m.tenant_id=$1 AND m.user_id=$2 FOR UPDATE OF m,u`,
        [membership.rows[0].tenant_id, id]);
      if (!target.rows[0] || target.rows[0].role !== 'CONTADOR') { await client.query('ROLLBACK'); return res.status(404).json({ mensagem: 'Membro não encontrado neste escritório.' }); }
      await client.query('DELETE FROM fiscoia.tenant_memberships WHERE tenant_id=$1 AND user_id=$2', [membership.rows[0].tenant_id, id]);
      await client.query('UPDATE fiscoia.auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [id]);
      const outros = await client.query('SELECT 1 FROM fiscoia.tenant_memberships WHERE user_id=$1 LIMIT 1', [id]);
      if (outros.rowCount) { await client.query('COMMIT'); return res.json({ sucesso: true, excluido: false, mensagem: 'Removido deste escritório (a conta também pertence a outro escritório e foi preservada).' }); }
      await client.query('SAVEPOINT apagar');
      try {
        await client.query('DELETE FROM fiscoia.password_reset_tokens WHERE user_id=$1', [id]);
        await client.query('DELETE FROM fiscoia.auth_sessions WHERE user_id=$1', [id]);
        await client.query('DELETE FROM fiscoia.users WHERE id=$1', [id]);
        await client.query('COMMIT');
        return res.json({ sucesso: true, excluido: true, mensagem: 'Conta excluída.' });
      } catch {
        await client.query('ROLLBACK TO SAVEPOINT apagar');
        await client.query('SAVEPOINT liberar_email');
        try {
          // Libera o e-mail: a conta fica bloqueada com outro endereço e o e-mail original pode receber convite novo.
          await client.query("UPDATE fiscoia.users SET active=false, email=left(email, 60) || '#removido-' || extract(epoch from now())::bigint::text, updated_at=now() WHERE id=$1", [id]);
        } catch {
          await client.query('ROLLBACK TO SAVEPOINT liberar_email');
          await client.query('UPDATE fiscoia.users SET active=false, updated_at=now() WHERE id=$1', [id]);
        }
        await client.query('COMMIT');
        return res.json({ sucesso: true, excluido: false, mensagem: 'O histórico impediu apagar a conta por completo; ela ficou sem acesso e o e-mail está livre para um novo cadastro.' });
      }
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
    finally { client.release(); }
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível excluir o usuário.' });
  }
});

router.post('/users/:id/reset-link', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const id = String(req.params.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ mensagem: 'Identificador de usuário inválido.' });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    const appUrl = (process.env.APP_URL || 'https://murade-fisco-ia.onrender.com').replace(/\/$/, '');
    let linkBase: URL;
    try { linkBase = new URL(appUrl); if (process.env.NODE_ENV === 'production' && linkBase.protocol !== 'https:') throw new Error('HTTPS obrigatório'); }
    catch { return res.status(503).json({ mensagem: 'Links indisponíveis: configure uma URL HTTPS válida no APP_URL.' }); }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.user_id', $1, true)", [session.user.id]);
      await definirEscritorioDoResponsavel(client, session.user.id);
      const manager = await client.query(
        `SELECT tenant_id FROM fiscoia.tenant_memberships
          WHERE user_id=$1 AND role IN ('OWNER','ADMIN')
          ORDER BY (role='OWNER') DESC LIMIT 1`,
        [session.user.id],
      );
      if (!manager.rows[0]) { await client.query('ROLLBACK'); return res.status(403).json({ mensagem: 'Somente o responsável do escritório pode gerenciar a equipe.' }); }
      const target = await client.query(
        `SELECT u.id,u.must_change_password,u.active,m.role FROM fiscoia.tenant_memberships m
          JOIN fiscoia.users u ON u.id=m.user_id
          WHERE m.tenant_id=$1 AND m.user_id=$2
          FOR UPDATE OF m,u`,
        [manager.rows[0].tenant_id, id],
      );
      if (!target.rows[0] || target.rows[0].role !== 'CONTADOR') { await client.query('ROLLBACK'); return res.status(404).json({ mensagem: 'Membro não encontrado neste escritório.' }); }
      if (target.rows[0].active !== true) { await client.query('ROLLBACK'); return res.status(409).json({ mensagem: 'Desbloqueie o membro antes de gerar um link de acesso.' }); }
      const token = randomBytes(32).toString('base64url');
      const purpose = target.rows[0].must_change_password === true ? 'FIRST_ACCESS' : 'PASSWORD_RESET';
      const tokenHash = hashToken(token);
      await client.query("UPDATE fiscoia.password_reset_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL", [id]);
      await client.query(
        `INSERT INTO fiscoia.password_reset_tokens (token_sha256,user_id,purpose,expires_at)
         VALUES ($1,$2,$3,now()+($4 * interval '1 hour'))`,
        [tokenHash,id,purpose,purpose === 'FIRST_ACCESS' ? 720 : 24], // convite de primeiro acesso: 30 dias; nova senha: 24 h
      );
      await client.query('COMMIT');
      linkBase.hash = new URLSearchParams({ redefinir: token }).toString();
      return res.status(201).json({ sucesso: true, link: linkBase.toString(), expiraEmHoras: purpose === 'FIRST_ACCESS' ? 720 : 24, primeiroAcesso: purpose === 'FIRST_ACCESS' });
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
    finally { client.release(); }
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível gerar o link de acesso.' });
  }
});

const tentativasEsqueciSenha = new Map<string, number[]>();
router.post('/esqueci-senha', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const email = typeof req.body?.login === 'string' ? req.body.login.trim().toLowerCase() : (typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '');
  const resposta = { sucesso: true, mensagem: 'Se este e-mail estiver cadastrado, enviamos um link para criar a nova senha. Confira também a caixa de spam.' };
  if (!emailConfigurado()) return res.status(503).json({ sucesso: false, mensagem: 'A recuperação por e-mail ainda não foi ativada neste sistema. Peça ao responsável do escritório para gerar um link de nova senha.', motivo: 'A recuperação por e-mail ainda não foi ativada neste sistema. Peça ao responsável do escritório para gerar um link de nova senha.' });
  const agora = Date.now();
  for (const k of [`ip:${req.ip || 'x'}`, `em:${email}`]) {
    const l = (tentativasEsqueciSenha.get(k) || []).filter((t) => agora - t < 15 * 60_000);
    if (l.length >= (k.startsWith('ip:') ? 10 : 3)) return res.status(429).json({ sucesso: false, motivo: 'Muitas tentativas. Aguarde alguns minutos.', mensagem: 'Muitas tentativas. Aguarde alguns minutos.' });
    l.push(agora); tentativasEsqueciSenha.set(k, l);
  }
  if (tentativasEsqueciSenha.size > 5000) tentativasEsqueciSenha.clear();
  const pool = obterPoolBanco();
  if (!pool || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.json(resposta);
  try {
    const appUrl = (process.env.APP_URL || 'https://murade-fisco-ia.onrender.com').replace(/\/$/, '');
    const linkBase = new URL(appUrl);
    const u = await pool.query('SELECT id FROM fiscoia.users WHERE lower(email)=$1 AND active=true', [email]);
    if (u.rows[0]) {
      const token = randomBytes(32).toString('base64url');
      await pool.query("UPDATE fiscoia.password_reset_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL", [u.rows[0].id]);
      await pool.query("INSERT INTO fiscoia.password_reset_tokens (token_sha256,user_id,purpose,expires_at) VALUES ($1,$2,'PASSWORD_RESET',now()+interval '24 hours')", [hashToken(token), u.rows[0].id]);
      linkBase.hash = new URLSearchParams({ redefinir: token }).toString();
      await enviarEmail(email, 'Murade Fisco IA: criar nova senha', `Olá!\n\nRecebemos um pedido para criar uma nova senha no Murade Fisco IA.\nAbra o link abaixo (vale 24 horas e só pode ser usado uma vez):\n\n${linkBase.toString()}\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.`);
    }
  } catch (e) { console.error('Falha na recuperação de senha:', e instanceof Error ? e.message : e); }
  return res.json(resposta);
});

router.post('/accept-invite', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Autenticação central indisponível: banco permanente não configurado.' });
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return res.status(400).json({ mensagem: 'Link de convite inválido ou incompleto.' });
  if (senha.length < 12 || senha.length > 1024) return res.status(400).json({ mensagem: 'A senha precisa ter entre 12 e 1024 caracteres.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const invite = await client.query(
      `SELECT t.user_id, u.*
         FROM fiscoia.password_reset_tokens t
         JOIN fiscoia.users u ON u.id = t.user_id
        WHERE t.token_sha256 = $1 AND t.purpose IN ('FIRST_ACCESS', 'PASSWORD_RESET')
          AND t.consumed_at IS NULL AND t.expires_at > now() AND u.active = true
        FOR UPDATE OF t, u`,
      [hashToken(token)],
    );
    const row = invite.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      await client.query('ROLLBACK');
      return res.status(400).json({ mensagem: 'Este convite expirou, já foi usado ou não é válido. Peça um novo link ao administrador.' });
    }
    const passwordHash = await criarHash(senha);
    await client.query(
      `UPDATE fiscoia.users SET password_hash = $1, must_change_password = false, updated_at = now() WHERE id = $2`,
      [passwordHash, row.user_id],
    );
    await client.query('UPDATE fiscoia.password_reset_tokens SET consumed_at = now() WHERE token_sha256 = $1', [hashToken(token)]);
    await client.query('UPDATE fiscoia.auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [row.user_id]);
    const sessionToken = randomBytes(32).toString('base64url');
    const duracaoConvite = duracaoSessao(req);
    await client.query(
      `INSERT INTO fiscoia.auth_sessions (user_id, token_sha256, expires_at)
       VALUES ($1, $2, now() + ($3 * interval '1 second'))`,
      [row.user_id, hashToken(sessionToken), duracaoConvite],
    );
    await client.query('COMMIT');
    definirCookie(res, sessionToken, duracaoConvite);
    return res.json({ sucesso: true, mensagem: 'Senha criada. Acesso liberado.', usuario: usuarioPublico({ ...row, must_change_password: false }) });
  } catch {
    await client.query('ROLLBACK').catch(() => undefined);
    return res.status(503).json({ mensagem: 'Não foi possível concluir o convite no banco.' });
  } finally {
    client.release();
  }
});

// Recuperação da administradora (dona do sistema) quando ela perde a senha e o e-mail do sistema não está ativo.
// Só funciona se existir FISCOIA_CHAVE_RECUPERACAO no Render (frase secreta que só a dona conhece). Sem ela, fica desligada.
const tentativasRecuperacao: number[] = [];
const tentativasRecuperacaoPorIp = new Map<string, number[]>();
router.post('/recuperar-admin', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  // Tolera espaço/quebra de linha nas pontas e aspas coladas junto com o valor.
  const limparChave = (v: string) => v.trim().replace(/^["']+|["']+$/g, '').trim();
  const chaveEsperada = limparChave(process.env.FISCOIA_CHAVE_RECUPERACAO || '');
  if (chaveEsperada.length < 16) return res.status(503).json({ mensagem: 'A recuperação de administradora está desligada. Cadastre FISCOIA_CHAVE_RECUPERACAO (mínimo 16 caracteres) no Render.' });
  const agora = Date.now();
  const recentes = tentativasRecuperacao.filter((t) => agora - t < 60 * 60_000);
  tentativasRecuperacao.length = 0; tentativasRecuperacao.push(...recentes);
  const ipChave = req.ip || 'x';
  const doIp = (tentativasRecuperacaoPorIp.get(ipChave) || []).filter((t) => agora - t < 15 * 60_000);
  if (doIp.length >= 5 || recentes.length >= 15) return res.status(429).json({ mensagem: 'Muitas tentativas. Aguarde 15 minutos.' });
  doIp.push(agora); tentativasRecuperacaoPorIp.set(ipChave, doIp); tentativasRecuperacao.push(agora);
  if (tentativasRecuperacaoPorIp.size > 2000) tentativasRecuperacaoPorIp.clear();
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const chave = typeof req.body?.chave === 'string' ? req.body.chave : '';
  const novaSenha = typeof req.body?.novaSenha === 'string' ? req.body.novaSenha : '';
  if (!email || email.length > 254 || !chave || chave.length > 512) return res.status(400).json({ mensagem: 'Informe o e-mail e a chave de recuperação.' });
  if (novaSenha.length < 12 || novaSenha.length > 1024) return res.status(400).json({ mensagem: 'A nova senha precisa ter entre 12 e 1024 caracteres.' });
  const a = createHash('sha256').update(limparChave(chave)).digest();
  const b = createHash('sha256').update(chaveEsperada).digest();
  const chaveRecebida = limparChave(chave);
  if (!timingSafeEqual(a, b)) return res.status(401).json({ mensagem: `A chave de recuperação não confere com a cadastrada no Render (recebi ${chaveRecebida.length} caracteres). Confira o valor da variável FISCOIA_CHAVE_RECUPERACAO.` });
  try {
    const passwordHash = await criarHash(novaSenha);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const atualizado = await client.query(
        `UPDATE fiscoia.users SET password_hash = $1, must_change_password = false, updated_at = now()
          WHERE lower(email) = $2 AND active = true AND (is_admin = true OR account_type = 'ADMIN') RETURNING id`,
        [passwordHash, email],
      );
      if (!atualizado.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ mensagem: 'A chave está correta, mas não existe uma conta de administradora ativa com este e-mail.' }); }
      await client.query('UPDATE fiscoia.auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [atualizado.rows[0].id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    console.warn('Recuperação de administradora usada: senha redefinida e sessões encerradas.');
    return res.json({ sucesso: true, mensagem: 'Senha redefinida. Entre com a nova senha. Depois, apague FISCOIA_CHAVE_RECUPERACAO do Render.' });
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível redefinir a senha no banco.' });
  }
});

router.post('/users/reset-password', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    if (!session.user.ehAdmin) return res.status(403).json({ mensagem: 'Apenas administrador central pode redefinir contas.' });
    const target = await pool.query(
      `SELECT u.id FROM fiscoia.tenant_memberships mine
         JOIN fiscoia.tenant_memberships target_membership ON target_membership.tenant_id = mine.tenant_id
         JOIN fiscoia.users u ON u.id = target_membership.user_id
        WHERE mine.user_id = $1 AND mine.role IN ('OWNER', 'ADMIN') AND u.email = $2
        LIMIT 1`,
      [session.user.id, email],
    );
    if (!target.rows[0]) return res.status(404).json({ mensagem: 'Conta não encontrada neste escritório.' });
    const senhaTemporaria = randomBytes(18).toString('base64url');
    const passwordHash = await criarHash(senhaTemporaria);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE fiscoia.users SET password_hash = $1, must_change_password = true, updated_at = now()
          WHERE id = $2 AND active = true RETURNING id`,
        [passwordHash, target.rows[0].id],
      );
      if (!updated.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ mensagem: 'Conta não encontrada ou inativa neste escritório.' });
      }
      await client.query(
        'UPDATE fiscoia.auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [target.rows[0].id],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    return res.json({
      sucesso: true,
      mensagem: 'Senha temporária gerada; entregue-a ao usuário por canal seguro. Ela será exigida no próximo acesso.',
      senhaTemporaria,
    });
  } catch {
    return res.status(503).json({ mensagem: 'Não foi possível redefinir a senha no banco.' });
  }
});

// ---- Dono do sistema: contrata e bloqueia escritórios (sem acesso às empresas deles) ----
router.get('/escritorios', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    if (!session.user.ehAdmin) return res.status(403).json({ mensagem: 'Somente o dono do sistema consulta os escritórios.' });
    if (!(await escritoriosDisponiveis(pool))) return res.json({ disponivel: false, escritorios: [], mensagem: 'A migração 012 (escritórios contratantes) ainda não foi aplicada no banco.' });
    const r = await pool.query('SELECT * FROM fiscoia.platform_list_offices($1::uuid)', [session.user.id]);
    const limites = new Map<string, number | null>();
    if (await limiteUsuariosDisponivel(pool)) {
      const l = await pool.query('SELECT * FROM fiscoia.platform_list_office_limits($1::uuid)', [session.user.id]);
      for (const row of l.rows) limites.set(String(row.id), row.max_users == null ? null : Number(row.max_users));
    }
    const cnpjs = new Map<string, string | null>();
    if (await cnpjEscritorioDisponivel(pool)) {
      const c = await pool.query('SELECT * FROM fiscoia.platform_list_office_cnpjs($1::uuid)', [session.user.id]);
      for (const row of c.rows) cnpjs.set(String(row.id), row.office_cnpj ? String(row.office_cnpj) : null);
    }
    return res.json({ disponivel: true, escritorios: r.rows.map((row) => ({
      id: String(row.id), nome: String(row.name), responsavel: row.owner_email ? String(row.owner_email) : '',
      limiteUsuarios: limites.get(String(row.id)) ?? null, cnpj: cnpjs.get(String(row.id)) ?? null,
      usuarios: Number(row.users), bloqueado: row.blocked_at != null, criadoEm: new Date(row.created_at).toISOString(),
    })) });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível listar os escritórios.' }); }
});

router.post('/escritorios', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    if (!session.user.ehAdmin) return res.status(403).json({ mensagem: 'Somente o dono do sistema contrata escritórios.' });
    if (!(await escritoriosDisponiveis(pool))) return res.status(409).json({ mensagem: 'Aplique primeiro a migração 012 (npm run db:migrate) para habilitar escritórios contratantes.' });
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    // Só o e-mail é obrigatório (igual ao DP e ao Contábil): a contadora completa o nome e o CRC em "Minha Conta".
    const nomeInformado = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
    const escritorioInformado = typeof req.body?.nomeEscritorio === 'string' ? req.body.nomeEscritorio.trim() : '';
    const prefixo = email.split('@')[0] || email;
    const nome = nomeInformado || prefixo;
    const nomeEscritorio = escritorioInformado || `Escritório ${prefixo}`;
    const planId = ['basico', 'profissional', 'empresarial'].includes(req.body?.idPlano) ? req.body.idPlano : 'profissional';
    const expiresOn = typeof req.body?.dataVencimento === 'string' ? req.body.dataVencimento : '';
    if (nomeEscritorio.length < 2 || nomeEscritorio.length > 160 || nome.length < 2 || nome.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ mensagem: 'Informe um e-mail válido.' });
    }
    if (expiresOn && !dataCivilValida(expiresOn)) return res.status(400).json({ mensagem: 'Data de vencimento inválida.' });
    const planNames: Record<string, string> = { basico: 'Básico', profissional: 'Profissional', empresarial: 'Empresarial' };
    const convite = randomBytes(32).toString('base64url');
    const passwordHash = await criarHash(randomBytes(48).toString('base64url'));
    let conviteBase: URL;
    try {
      conviteBase = new URL((process.env.APP_URL || 'https://murade-fisco-ia.onrender.com').replace(/\/$/, ''));
      if (conviteBase.protocol !== 'https:' && process.env.NODE_ENV === 'production') throw new Error('APP_URL must use HTTPS');
    } catch { return res.status(503).json({ mensagem: 'Convites indisponíveis: configure uma URL pública HTTPS válida no APP_URL.' }); }
    conviteBase.hash = new URLSearchParams({ convite }).toString();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO fiscoia.users (email, password_hash, display_name, plan_id, plan_name, expires_on, must_change_password, account_type)
         VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::date, true, 'CONTADOR') RETURNING *`,
        [email, passwordHash, nome, planId, planNames[planId], expiresOn],
      );
      const criado = await client.query('SELECT fiscoia.platform_create_office($1::uuid, $2, $3::uuid) AS id', [session.user.id, nomeEscritorio, inserted.rows[0].id]);
      // Escritório novo já nasce com 3 usuários (dono + 2); o limite pode ser mudado depois pelo dono do sistema.
      if (await limiteUsuariosDisponivel(pool)) await client.query('SELECT fiscoia.platform_set_office_limit($1::uuid, $2::uuid, 3)', [session.user.id, criado.rows[0].id]);
      await client.query(`INSERT INTO fiscoia.password_reset_tokens (token_sha256, user_id, purpose, expires_at) VALUES ($1, $2, 'FIRST_ACCESS', now() + interval '30 days')`, [hashToken(convite), inserted.rows[0].id]);
      await client.query('COMMIT');
      return res.status(201).json({ sucesso: true, conviteUrl: conviteBase.toString(), mensagem: 'Escritório criado. Envie o link de uso único ao responsável; ele expira em 30 dias.' });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') return res.status(409).json({ mensagem: 'Já existe uma conta com este e-mail.' });
      throw error;
    } finally { client.release(); }
  } catch { return res.status(503).json({ mensagem: 'Não foi possível criar o escritório.' }); }
});

router.post('/escritorios/:id/bloqueio', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const id = String(req.params.id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ mensagem: 'Escritório inválido.' });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    if (!session.user.ehAdmin) return res.status(403).json({ mensagem: 'Somente o dono do sistema bloqueia escritórios.' });
    if (!(await escritoriosDisponiveis(pool))) return res.status(409).json({ mensagem: 'A migração 012 ainda não foi aplicada no banco.' });
    const r = await pool.query('SELECT fiscoia.platform_set_office_blocked($1::uuid, $2::uuid, $3::boolean) AS ok', [session.user.id, id, req.body?.bloqueado === true]);
    if (r.rows[0]?.ok !== true) return res.status(404).json({ mensagem: 'Escritório não encontrado.' });
    return res.json({ sucesso: true, bloqueado: req.body?.bloqueado === true, dadosPreservados: true });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '22023') return res.status(409).json({ mensagem: 'O escritório da própria conta administradora não pode ser bloqueado.' });
    return res.status(503).json({ mensagem: 'Não foi possível alterar o bloqueio.' });
  }
});

// CNPJ do escritório contratante: autor do pedido nas consultas ao Serpro (as empresas dele autorizam ESTE CNPJ no e-CAC). Só o dono do sistema.
router.post('/escritorios/:id/cnpj', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const id = String(req.params.id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ mensagem: 'Escritório inválido.' });
  const bruto = req.body?.cnpj; const vazio = bruto === null || String(bruto ?? '').trim() === '';
  const cnpj = vazio ? null : normalizarCnpj(String(bruto));
  if (cnpj !== null && !validarCnpj(cnpj)) return res.status(400).json({ mensagem: 'CNPJ inválido. Confira os números.' });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    if (!session.user.ehAdmin) return res.status(403).json({ mensagem: 'Somente o dono do sistema define o CNPJ do escritório.' });
    if (!(await cnpjEscritorioDisponivel(pool))) return res.status(409).json({ mensagem: 'O banco do Fisco IA ainda não recebeu a atualização 016 (CNPJ do escritório). Ela precisa ser aplicada pela tarefa privada de migração do banco (npm run db:migrate); a migração automática está desligada neste serviço.' });
    const r = await pool.query('SELECT fiscoia.platform_set_office_cnpj($1::uuid, $2::uuid, $3::text) AS ok', [session.user.id, id, cnpj]);
    if (r.rows[0]?.ok !== true) return res.status(404).json({ mensagem: 'Escritório não encontrado.' });
    return res.json({ sucesso: true, cnpj });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '22023') return res.status(409).json({ mensagem: 'O escritório da própria conta administradora usa o CNPJ do contratante.' });
    return res.status(503).json({ mensagem: 'Não foi possível salvar o CNPJ do escritório.' });
  }
});

router.post('/escritorios/:id/limite', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const id = String(req.params.id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ mensagem: 'Escritório inválido.' });
  const bruto = req.body?.limite; const limite = bruto === null ? null : Number(bruto);
  if (limite !== null && (!Number.isInteger(limite) || limite < 1 || limite > 1000)) return res.status(400).json({ mensagem: 'Informe um limite de 1 a 1000 usuários (ou vazio para sem limite).' });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    if (!session.user.ehAdmin) return res.status(403).json({ mensagem: 'Somente o dono do sistema define o limite de usuários.' });
    if (!(await limiteUsuariosDisponivel(pool))) return res.status(409).json({ mensagem: 'Aplique primeiro a migração 013 (npm run db:migrate) para habilitar o limite de usuários.' });
    const r = await pool.query('SELECT fiscoia.platform_set_office_limit($1::uuid, $2::uuid, $3::integer) AS ok', [session.user.id, id, limite]);
    if (r.rows[0]?.ok !== true) return res.status(404).json({ mensagem: 'Escritório não encontrado.' });
    return res.json({ sucesso: true, limite });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '22023') return res.status(409).json({ mensagem: 'O escritório da própria conta administradora não tem limite.' });
    return res.status(503).json({ mensagem: 'Não foi possível definir o limite.' });
  }
});

// Dono do sistema: excluir escritório inteiro ou uma conta que impede novo cadastro do e-mail. Nada fica bloqueado: o e-mail volta a ficar livre.
async function exclusaoDisponivel(pool: NonNullable<ReturnType<typeof obterPoolBanco>>): Promise<boolean> {
  try { const r = await pool.query("SELECT to_regprocedure('fiscoia.platform_delete_office(uuid,uuid)') IS NOT NULL AS ok"); return r.rows[0]?.ok === true; } catch { return false; }
}
const AVISO_MIGRACAO_015 = 'A exclusão ainda depende da atualização 015 do banco (npm run db:migrate). Depois dela o botão passa a funcionar.';

router.post('/escritorios/:id/excluir', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const id = String(req.params.id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ mensagem: 'Escritório inválido.' });
  if (req.body?.confirmar !== true) return res.status(400).json({ mensagem: 'Confirme a exclusão do escritório.' });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    if (!session.user.ehAdmin) return res.status(403).json({ mensagem: 'Somente o dono do sistema exclui escritórios.' });
    if (!(await exclusaoDisponivel(pool))) return res.status(409).json({ mensagem: AVISO_MIGRACAO_015 });
    const r = await pool.query('SELECT * FROM fiscoia.platform_delete_office($1::uuid, $2::uuid)', [session.user.id, id]);
    const x = r.rows[0];
    if (!x || x.encontrado !== true) return res.status(404).json({ mensagem: 'Escritório não encontrado.' });
    return res.json({ sucesso: true, contasApagadas: Number(x.apagadas), contasSemAcesso: Number(x.sem_acesso), mensagem: Number(x.sem_acesso) ? 'Escritório excluído. Algumas contas têm histórico e ficaram sem acesso, com o e-mail liberado para novo cadastro.' : 'Escritório excluído. Os e-mails já podem ser cadastrados de novo.' });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '22023') return res.status(409).json({ mensagem: 'O escritório da própria conta administradora não pode ser excluído.' });
    return res.status(503).json({ mensagem: 'Não foi possível excluir o escritório.' });
  }
});

router.post('/contas/resumo', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254) return res.status(400).json({ mensagem: 'Informe o e-mail.' });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    if (!session.user.ehAdmin) return res.status(403).json({ mensagem: 'Somente o dono do sistema consulta contas.' });
    if (!(await exclusaoDisponivel(pool))) return res.status(409).json({ mensagem: AVISO_MIGRACAO_015 });
    const r = await pool.query('SELECT * FROM fiscoia.platform_account_summary($1::uuid, $2)', [session.user.id, email]);
    const x = r.rows[0];
    if (!x) return res.json({ existe: false });
    return res.json({ existe: true, id: String(x.id), administrador: x.is_admin === true, ativa: x.active === true, escritorios: Number(x.offices), donoDeEscritorio: x.is_owner === true, ehVoce: String(x.id) === session.user.id });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível consultar a conta.' }); }
});

router.post('/contas/excluir', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254) return res.status(400).json({ mensagem: 'Informe o e-mail.' });
  if (req.body?.confirmar !== true) return res.status(400).json({ mensagem: 'Confirme a exclusão da conta.' });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    if (!session.user.ehAdmin) return res.status(403).json({ mensagem: 'Somente o dono do sistema exclui contas.' });
    if (!(await exclusaoDisponivel(pool))) return res.status(409).json({ mensagem: AVISO_MIGRACAO_015 });
    const alvo = await pool.query('SELECT * FROM fiscoia.platform_account_summary($1::uuid, $2)', [session.user.id, email]);
    if (!alvo.rows[0]) return res.status(404).json({ mensagem: 'Conta não encontrada: o e-mail já está livre.' });
    const r = await pool.query('SELECT fiscoia.platform_delete_account($1::uuid, $2::uuid) AS resultado', [session.user.id, alvo.rows[0].id]);
    return res.json({ sucesso: true, semAcesso: r.rows[0]?.resultado === 'sem_acesso' });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '22023') return res.status(409).json({ mensagem: error instanceof Error ? error.message : 'Esta conta não pode ser excluída aqui.' });
    return res.status(503).json({ mensagem: 'Não foi possível excluir a conta.' });
  }
});

/** Liga/desliga "manter conectado" na sessão atual (celular). Desligado = volta a pedir senha em 8 horas. */
router.post('/manter-conectado', async (req, res) => {
  const pool = obterPoolBanco();
  const token = lerCookie(req, COOKIE_NAME);
  try {
    const session = pool && token ? await obterSessao(req) : null;
    if (!pool || !token || !session) return res.status(401).json({ sucesso: false, mensagem: 'Entre no sistema primeiro.' });
    const ativo = req.body?.ativo === true;
    if (ativo && !ehCelularUA(String(req.headers['user-agent'] || ''))) return res.status(400).json({ sucesso: false, mensagem: 'Esta opção vale só para celular e tablet.' });
    const segundos = ativo ? SESSION_LONGA_SECONDS : SESSION_SECONDS;
    await pool.query("UPDATE fiscoia.auth_sessions SET expires_at = now() + ($2 * interval '1 second') WHERE token_sha256 = $1 AND revoked_at IS NULL", [session.tokenHash, segundos]);
    definirCookie(res, token, segundos);
    return res.json({ sucesso: true, manterConectado: ativo });
  } catch {
    return res.status(503).json({ sucesso: false, mensagem: 'Não foi possível salvar agora.' });
  }
});

router.post('/logout', async (req, res) => {
  const pool = obterPoolBanco();
  const token = lerCookie(req, COOKIE_NAME);
  limparCookie(res);
  if (pool && token && token.length <= 512) {
    try {
      await pool.query('UPDATE fiscoia.auth_sessions SET revoked_at = now() WHERE token_sha256 = $1 AND revoked_at IS NULL', [hashToken(token)]);
    } catch {
      return res.status(503).json({ mensagem: 'Cookie encerrado neste navegador; o banco não confirmou a revogação da sessão.' });
    }
  }
  return res.json({ sucesso: true });
});

export default router;
