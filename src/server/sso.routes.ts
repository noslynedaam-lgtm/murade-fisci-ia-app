import { Router, type Request, type Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { obterPoolBanco } from './persistence';
import { obterUsuarioDaSessao } from './auth.routes';

const router = Router();
const ALLOWED_SCOPES = new Set(['email', 'profile']);
const CODE_TTL_SECONDS = 90;
const TOKEN_TTL_SECONDS = 600;

type Client = { clientId: string; clientSecret: string; redirectUris: string[]; name: string };

function clients(): Client[] {
  const raw = process.env.FISCOIA_OIDC_CLIENTS_JSON;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Client => {
      if (!item || typeof item !== 'object') return false;
      const value = item as Record<string, unknown>;
      return typeof value.clientId === 'string' && /^[A-Za-z0-9._-]{1,120}$/.test(value.clientId)
        && typeof value.clientSecret === 'string' && value.clientSecret.length >= 32
        && Array.isArray(value.redirectUris) && value.redirectUris.length > 0
        && value.redirectUris.every((uri) => typeof uri === 'string' && isSafeRedirect(uri))
        && typeof value.name === 'string' && value.name.length <= 100;
    });
  } catch {
    return [];
  }
}

function isSafeRedirect(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash;
  } catch { return false; }
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }

function validClientCredentials(req: Request): Client | null {
  const header = req.get('authorization') || '';
  if (!header.startsWith('Basic ')) return null;
  let decoded = '';
  try { decoded = Buffer.from(header.slice(6), 'base64').toString('utf8'); } catch { return null; }
  const separator = decoded.indexOf(':');
  if (separator < 1) return null;
  const id = decoded.slice(0, separator);
  const secret = decoded.slice(separator + 1);
  const client = clients().find((candidate) => candidate.clientId === id);
  return client && constantTimeEqual(client.clientSecret, secret) ? client : null;
}

function bearer(req: Request): string | null {
  const header = req.get('authorization') || '';
  const match = /^Bearer ([A-Za-z0-9_-]{40,200})$/.exec(header);
  return match?.[1] || null;
}

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

/** OAuth 2 Authorization Code endpoint. Client redirects must be exact allowlist matches. */
router.get('/authorize', async (req, res) => {
  const clientId = typeof req.query.client_id === 'string' ? req.query.client_id : '';
  const redirectUri = typeof req.query.redirect_uri === 'string' ? req.query.redirect_uri : '';
  const responseType = req.query.response_type;
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const challenge = typeof req.query.code_challenge === 'string' ? req.query.code_challenge : '';
  const method = req.query.code_challenge_method;
  const scopeText = typeof req.query.scope === 'string' ? req.query.scope : '';
  const client = clients().find((item) => item.clientId === clientId);
  // Do not redirect to an untrusted URI, even for errors.
  if (!client || !client.redirectUris.includes(redirectUri)) return res.status(400).json({ erro: 'Cliente ou URL de retorno não cadastrado.' });
  if (responseType !== 'code' || !/^[A-Za-z0-9_-]{43}$/.test(challenge) || method !== 'S256'
    || !/^[A-Za-z0-9_-]{16,512}$/.test(state)) {
    return res.status(400).json({ erro: 'Solicitação OAuth inválida. PKCE S256 e state são obrigatórios.' });
  }
  const scopes = [...new Set(scopeText.split(/\s+/).filter(Boolean))];
  if (scopes.some((scope) => !ALLOWED_SCOPES.has(scope))) {
    return res.status(400).json({ erro: 'Escopo solicitado inválido.' });
  }
  const user = await obterUsuarioDaSessao(req);
  if (!user) return res.status(401).json({ erro: 'Entre no portal Fisco IA e repita a autorização.' });
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ erro: 'Banco de autenticação indisponível.' });
  try {
    const grant = await pool.query(
      `SELECT 1 FROM fiscoia.auth_app_grants
        WHERE user_id = $1 AND client_id = $2 AND revoked_at IS NULL LIMIT 1`,
      [user.id, clientId],
    );
    if (!grant.rowCount) return res.status(403).json({ erro: 'Esta conta ainda não recebeu acesso a este sistema.' });
    const code = randomBytes(32).toString('base64url');
    await pool.query(
      `INSERT INTO fiscoia.sso_authorization_codes
        (code_sha256, user_id, client_id, redirect_uri, scope, code_challenge, state, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now() + ($8 * interval '1 second'))`,
      [digest(code), user.id, clientId, redirectUri, scopes.join(' '), challenge, state, CODE_TTL_SECONDS],
    );
    const target = new URL(redirectUri);
    target.searchParams.set('code', code);
    target.searchParams.set('state', state);
    return res.redirect(302, target.toString());
  } catch {
    return res.status(503).json({ erro: 'Não foi possível concluir a autorização.' });
  }
});

/** Exchanges a one-use authorization code for a short-lived opaque bearer token. */
router.post('/token', async (req, res) => {
  const client = validClientCredentials(req);
  if (!client) return res.status(401).json({ erro: 'Credenciais do cliente inválidas.' });
  if (req.body?.grant_type !== 'authorization_code') return res.status(400).json({ erro: 'grant_type não suportado.' });
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  const verifier = typeof req.body?.code_verifier === 'string' ? req.body.code_verifier : '';
  const redirectUri = typeof req.body?.redirect_uri === 'string' ? req.body.redirect_uri : '';
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(code) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)
    || !client.redirectUris.includes(redirectUri)) return res.status(400).json({ erro: 'Parâmetros de troca inválidos.' });
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ erro: 'Banco de autenticação indisponível.' });
  const expectedChallenge = createHash('sha256').update(verifier).digest('base64url');
  const accessToken = randomBytes(32).toString('base64url');
  try {
    const consumed = await pool.query(
      `UPDATE fiscoia.sso_authorization_codes c
          SET consumed_at = now()
        WHERE c.code_sha256 = $1 AND c.client_id = $2 AND c.redirect_uri = $3
          AND c.consumed_at IS NULL AND c.expires_at > now()
          AND c.code_challenge = $4
          AND EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = c.user_id AND u.active = true)
          AND EXISTS (SELECT 1 FROM fiscoia.auth_app_grants g
                       WHERE g.user_id = c.user_id AND g.client_id = c.client_id AND g.revoked_at IS NULL)
        RETURNING c.user_id, c.scope`,
      [digest(code), client.clientId, redirectUri, expectedChallenge],
    );
    if (!consumed.rowCount) return res.status(400).json({ erro: 'Código inválido, expirado, revogado ou já utilizado.' });
    const row = consumed.rows[0] as { user_id: string; scope: string };
    await pool.query(
      `INSERT INTO fiscoia.sso_access_tokens (token_sha256, user_id, client_id, scope, expires_at)
       VALUES ($1, $2, $3, $4, now() + ($5 * interval '1 second'))`,
      [digest(accessToken), row.user_id, client.clientId, row.scope, TOKEN_TTL_SECONDS],
    );
    return res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: TOKEN_TTL_SECONDS, scope: row.scope });
  } catch {
    return res.status(503).json({ erro: 'Não foi possível trocar o código por token.' });
  }
});

router.get('/userinfo', async (req, res) => {
  const token = bearer(req);
  if (!token) return res.status(401).json({ erro: 'Token Bearer inválido.' });
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ erro: 'Banco de autenticação indisponível.' });
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.display_name, t.scope
         FROM fiscoia.sso_access_tokens t
         JOIN fiscoia.users u ON u.id = t.user_id
         JOIN fiscoia.auth_app_grants g ON g.user_id = t.user_id AND g.client_id = t.client_id AND g.revoked_at IS NULL
        WHERE t.token_sha256 = $1 AND t.revoked_at IS NULL AND t.expires_at > now() AND u.active = true
        LIMIT 1`, [digest(token)],
    );
    if (!result.rowCount) return res.status(401).json({ erro: 'Token inválido, expirado ou revogado.' });
    const row = result.rows[0] as { id: string; email: string; display_name: string; scope: string };
    const scopes = new Set(row.scope.split(' '));
    return res.json({ sub: row.id, ...(scopes.has('email') ? { email: row.email } : {}),
      ...(scopes.has('profile') ? { name: row.display_name } : {}) });
  } catch { return res.status(503).json({ erro: 'Não foi possível validar o token.' }); }
});

router.post('/revoke', async (req, res) => {
  const client = validClientCredentials(req);
  if (!client) return res.status(401).json({ erro: 'Credenciais do cliente inválidas.' });
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (/^[A-Za-z0-9_-]{40,200}$/.test(token)) {
    const pool = obterPoolBanco();
    if (!pool) return res.status(503).json({ erro: 'Banco de autenticação indisponível.' });
    try {
      await pool.query(
        `UPDATE fiscoia.sso_access_tokens SET revoked_at = now()
          WHERE token_sha256 = $1 AND client_id = $2 AND revoked_at IS NULL`, [digest(token), client.clientId],
      );
    } catch { return res.status(503).json({ erro: 'Não foi possível revogar o token.' }); }
  }
  return res.status(200).end();
});

/** Lists authorized products for the signed-in central account. */
router.get('/apps', async (req, res) => {
  const user = await obterUsuarioDaSessao(req);
  if (!user) return res.status(401).json({ autenticado: false });
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ erro: 'Banco de autenticação indisponível.' });
  try {
    const granted = await pool.query(
      `SELECT client_id FROM fiscoia.auth_app_grants WHERE user_id = $1 AND revoked_at IS NULL ORDER BY client_id`, [user.id],
    );
    const configured = new Map(clients().map((client) => [client.clientId, { id: client.clientId, nome: client.name }]));
    const authorized = granted.rows
      .map((row) => configured.get(String(row.client_id)))
      .filter((client): client is { id: string; nome: string } => Boolean(client));
    return res.json({
      sistemas: [
        { id: 'murade-fisco-ia', nome: 'Murade Fisco IA', tipo: 'interno', ssoAtivo: true },
        ...authorized.map((client) => ({ ...client, tipo: 'externo', ssoAtivo: false })),
      ],
    });
  } catch { return res.status(503).json({ erro: 'Não foi possível carregar os sistemas autorizados.' }); }
});

/** Admin-only explicit grants. This never creates local company permissions. */
router.put('/apps/:clientId/users/:userId', async (req, res) => {
  const admin = await obterUsuarioDaSessao(req);
  if (!admin) return res.status(401).json({ erro: 'Sessão necessária.' });
  if (!admin.ehAdmin) return res.status(403).json({ erro: 'Apenas administrador central pode liberar sistemas.' });
  const { clientId, userId } = req.params;
  if (!clients().some((client) => client.clientId === clientId) || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return res.status(400).json({ erro: 'Sistema ou conta inválida.' });
  }
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ erro: 'Banco de autenticação indisponível.' });
  try {
    const result = await pool.query(
      `INSERT INTO fiscoia.auth_app_grants (user_id, client_id, granted_by, granted_at, revoked_at)
       SELECT id, $2, $3, now(), NULL FROM fiscoia.users WHERE id = $1 AND active = true
       ON CONFLICT (user_id, client_id) DO UPDATE SET granted_by = EXCLUDED.granted_by,
         granted_at = now(), revoked_at = NULL RETURNING user_id`, [userId, clientId, admin.id],
    );
    if (!result.rowCount) return res.status(404).json({ erro: 'Conta ativa não encontrada.' });
    return res.status(200).json({ sucesso: true });
  } catch { return res.status(503).json({ erro: 'Não foi possível liberar este sistema.' }); }
});

router.delete('/apps/:clientId/users/:userId', async (req, res) => {
  const admin = await obterUsuarioDaSessao(req);
  if (!admin) return res.status(401).json({ erro: 'Sessão necessária.' });
  if (!admin.ehAdmin) return res.status(403).json({ erro: 'Apenas administrador central pode revogar sistemas.' });
  const { clientId, userId } = req.params;
  if (!clients().some((client) => client.clientId === clientId) || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return res.status(400).json({ erro: 'Sistema ou conta inválida.' });
  }
  const pool = obterPoolBanco();
  if (!pool) return res.status(503).json({ erro: 'Banco de autenticação indisponível.' });
  try {
    await pool.query(
      `UPDATE fiscoia.auth_app_grants SET revoked_at = now()
        WHERE user_id = $1 AND client_id = $2 AND revoked_at IS NULL`, [userId, clientId],
    );
    await pool.query(
      `UPDATE fiscoia.sso_access_tokens SET revoked_at = now()
        WHERE user_id = $1 AND client_id = $2 AND revoked_at IS NULL`, [userId, clientId],
    );
    return res.status(200).json({ sucesso: true });
  } catch { return res.status(503).json({ erro: 'Não foi possível revogar este sistema.' }); }
});

export default router;
