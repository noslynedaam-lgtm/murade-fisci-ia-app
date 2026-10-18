import { Router, type Request, type Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { pbkdf2 as pbkdf2Callback } from 'node:crypto';
import { obterPoolBanco } from './persistence';

const pbkdf2 = promisify(pbkdf2Callback);
const router = Router();
const COOKIE_NAME = 'fiscoia_session';
const SESSION_SECONDS = 8 * 60 * 60;
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

function definirCookie(res: Response, token: string): void {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${SESSION_SECONDS}; ${cookieFlags()}`);
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
  return { tokenHash: String(row.token_sha256), user: usuarioPublico(row), passwordHash: String(row.password_hash) };
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
    if (!row || row.active !== true || !senhaValida) {
      return res.status(401).json({ mensagem: 'E-mail ou senha incorretos.' });
    }
    const rawToken = randomBytes(32).toString('base64url');
    await pool.query(
      `INSERT INTO fiscoia.auth_sessions (user_id, token_sha256, expires_at)
       VALUES ($1, $2, now() + ($3 * interval '1 second'))`,
      [row.id, hashToken(rawToken), SESSION_SECONDS],
    );
    definirCookie(res, rawToken);
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

router.get('/users', async (req, res) => {
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ mensagem: 'Banco permanente não configurado.' });
  try {
    const session = await obterSessao(req);
    if (!session) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    if (!session.user.ehAdmin) return res.status(403).json({ mensagem: 'Apenas administrador central pode consultar contas.' });
    const result = await pool.query(
      `SELECT u.id, u.display_name, u.email, u.crc, u.plan_id, u.active, u.is_admin, m.role
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
      ehAdmin: row.is_admin === true,
      ativo: row.active === true,
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
    if (!session.user.ehAdmin) return res.status(403).json({ mensagem: 'Apenas administrador central pode cadastrar contas.' });

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

    const membership = await pool.query(
      `SELECT tenant_id FROM fiscoia.tenant_memberships
        WHERE user_id = $1 AND role IN ('OWNER', 'ADMIN')
        ORDER BY (role = 'OWNER') DESC LIMIT 1`,
      [session.user.id],
    );
    if (!membership.rows[0]) return res.status(403).json({ mensagem: 'Conta administrativa sem escritório proprietário configurado.' });

    const planNames: Record<string, string> = { basico: 'Básico', profissional: 'Profissional', empresarial: 'Empresarial' };
    const senhaProvisoria = randomBytes(18).toString('base64url');
    const passwordHash = await criarHash(senhaProvisoria);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
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
      await client.query('COMMIT');
      return res.status(201).json({
        sucesso: true,
        mensagem: 'Conta criada no servidor. Entregue a senha temporária por canal seguro; ela será exigida no primeiro acesso.',
        senhaProvisoria,
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
