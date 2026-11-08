// Segurança do login (igual nos sistemas Murade): código de segurança de 6 dígitos (TOTP, RFC 6238),
// códigos de emergência, aparelho confiável e bloqueio de tentativas guardado no banco.
// Tudo usa só o módulo "crypto" do Node: nenhuma biblioteca de terceiros para o código em si.
import crypto from 'node:crypto';

export type Consultar = (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;

// ===== Base32 e TOTP (RFC 4226 / RFC 6238) =====

const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const PASSO_SEGUNDOS = 30;
export const DIGITOS = 6;

export function base32Codificar(dados: Buffer): string {
  let bits = 0; let valor = 0; let saida = '';
  for (const byte of dados) {
    valor = (valor << 8) | byte; bits += 8;
    while (bits >= 5) { saida += ALFABETO_BASE32[(valor >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) saida += ALFABETO_BASE32[(valor << (5 - bits)) & 31];
  return saida;
}

export function base32Decodificar(texto: string): Buffer {
  const limpo = texto.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0; let valor = 0; const bytes: number[] = [];
  for (const letra of limpo) {
    const indice = ALFABETO_BASE32.indexOf(letra);
    if (indice < 0) throw new Error('Segredo inválido.');
    valor = (valor << 5) | indice; bits += 5;
    if (bits >= 8) { bytes.push((valor >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(bytes);
}

export function gerarSegredoTotp(): string { return base32Codificar(crypto.randomBytes(20)); }

export function passoDoInstante(agoraMs: number = Date.now()): number { return Math.floor(agoraMs / 1000 / PASSO_SEGUNDOS); }

/** Código de 6 dígitos para um passo de 30 s (HOTP com HMAC-SHA1, truncamento dinâmico). */
export function codigoTotp(segredoBase32: string, passo: number, digitos: number = DIGITOS): string {
  const contador = Buffer.alloc(8); contador.writeBigUInt64BE(BigInt(passo));
  const hmac = crypto.createHmac('sha1', base32Decodificar(segredoBase32)).update(contador).digest();
  const deslocamento = hmac[hmac.length - 1] & 0x0f;
  const numero = ((hmac[deslocamento] & 0x7f) << 24) | (hmac[deslocamento + 1] << 16) | (hmac[deslocamento + 2] << 8) | hmac[deslocamento + 3];
  return String(numero % 10 ** digitos).padStart(digitos, '0');
}

const iguaisSemVazar = (a: string, b: string) => { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

/** Aceita o passo atual e um para cada lado (relógio do celular um pouco fora). Recusa passo já usado (ultimoPasso). */
export function verificarTotp(segredoBase32: string, codigo: string, agoraMs: number = Date.now(), ultimoPasso: number | null = null): { ok: true; passo: number } | { ok: false } {
  const limpo = String(codigo || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(limpo)) return { ok: false };
  const atual = passoDoInstante(agoraMs);
  let achado: number | null = null;
  for (const passo of [atual - 1, atual, atual + 1]) {
    if (iguaisSemVazar(codigoTotp(segredoBase32, passo), limpo) && achado === null) achado = passo;
  }
  if (achado === null) return { ok: false };
  if (ultimoPasso !== null && achado <= ultimoPasso) return { ok: false };
  return { ok: true, passo: achado };
}

export function uriOtpauth(emissor: string, conta: string, segredo: string): string {
  const rotulo = encodeURIComponent(`${emissor}:${conta}`);
  return `otpauth://totp/${rotulo}?secret=${segredo}&issuer=${encodeURIComponent(emissor)}&algorithm=SHA1&digits=${DIGITOS}&period=${PASSO_SEGUNDOS}`;
}

// ===== Segredo guardado cifrado (AES-256-GCM, chave derivada da chave-mestra que o sistema já tem) =====

function chaveDoUsuario(chaveMestra: Buffer, usuarioId: string): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', chaveMestra, Buffer.from('murade-2fa-v1'), Buffer.from(usuarioId), 32));
}

export function cifrarSegredo(chaveMestra: Buffer, usuarioId: string, segredo: string): string {
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv('aes-256-gcm', chaveDoUsuario(chaveMestra, usuarioId), iv);
  cifra.setAAD(Buffer.from(`2fa:${usuarioId}`));
  const conteudo = Buffer.concat([cifra.update(segredo, 'utf8'), cifra.final()]);
  return ['v1', iv.toString('base64url'), cifra.getAuthTag().toString('base64url'), conteudo.toString('base64url')].join('.');
}

export function decifrarSegredo(chaveMestra: Buffer, usuarioId: string, cifrado: string): string {
  const [versao, iv, tag, conteudo] = String(cifrado).split('.');
  if (versao !== 'v1' || !iv || !tag || !conteudo) throw new Error('Segredo guardado em formato desconhecido.');
  const decifra = crypto.createDecipheriv('aes-256-gcm', chaveDoUsuario(chaveMestra, usuarioId), Buffer.from(iv, 'base64url'));
  decifra.setAAD(Buffer.from(`2fa:${usuarioId}`));
  decifra.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decifra.update(Buffer.from(conteudo, 'base64url')), decifra.final()]).toString('utf8');
}

/** Aceita a chave em hexadecimal (64 caracteres) ou base64 de 32 bytes — mesmo padrão das outras chaves-mestras dos sistemas. */
export function lerChaveMestra(valor: string | undefined | null): Buffer | null {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;
  if (/^[a-f0-9]{64}$/i.test(texto)) return Buffer.from(texto, 'hex');
  try { const chave = Buffer.from(texto, 'base64'); return chave.length === 32 ? chave : null; } catch { return null; }
}

// ===== Códigos de emergência (uso único) =====

const ALFABETO_EMERGENCIA = 'abcdefghjkmnpqrstuvwxyz23456789';
export function gerarCodigosEmergencia(quantidade = 8): string[] {
  const unico = (): string => {
    let texto = '';
    while (texto.length < 10) { const byte = crypto.randomBytes(1)[0]; if (byte < 248) texto += ALFABETO_EMERGENCIA[byte % ALFABETO_EMERGENCIA.length]; }
    return `${texto.slice(0, 5)}-${texto.slice(5)}`;
  };
  return Array.from({ length: quantidade }, unico);
}
export const normalizarCodigoEmergencia = (codigo: string) => String(codigo || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const hashCodigoEmergencia = (codigo: string) => crypto.createHash('sha256').update(`murade-2fa-emergencia:${normalizarCodigoEmergencia(codigo)}`).digest('hex');

// ===== Máscaras para o registro (nunca grava e-mail ou IP inteiro nos avisos) =====

export function mascararLogin(login: string): string {
  const texto = String(login || '').trim().toLowerCase();
  if (!texto) return '(vazio)';
  const [nome, dominio] = texto.split('@');
  const parte = `${nome.slice(0, 2)}***`;
  return dominio ? `${parte}@${dominio}` : parte;
}
export function mascararIp(ip: string): string {
  const texto = String(ip || '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(texto)) return texto.replace(/\.\d+$/, '.*');
  if (texto.includes(':')) return `${texto.split(':').slice(0, 3).join(':')}::*`;
  return texto ? '***' : 'desconhecido';
}

// ===== Banco: tabelas, bloqueio de tentativas, eventos, segundo fator, aparelhos =====

export const LIMITE_FALHAS_POR_IP = 8;
export const LIMITE_FALHAS_POR_USUARIO = 20;
export const JANELA_BLOQUEIO_MINUTOS = 15;
export const DIAS_APARELHO_CONFIAVEL = 90;

/** Prefixo das tabelas: `murade_fiscal` ou, quando o sistema usa schema próprio, `schema.prefixo` (ex.: `fiscoia.seg`). */
const prefixoValido = (p: string) => { if (!/^(?:[a-z][a-z0-9_]{1,30}\.)?[a-z][a-z0-9_]{2,40}$/.test(p)) throw new Error('Prefixo de tabela inválido.'); return p; };
/** Nome de índice nunca leva o schema na frente. */
const nomeIndice = (p: string, sufixo: string) => `${p.replace('.', '_')}_${sufixo}`;

export async function prepararSeguranca(c: Consultar, prefixo: string): Promise<void> {
  const p = prefixoValido(prefixo);
  await c(`
    CREATE TABLE IF NOT EXISTS ${p}_login_falhas (chave text PRIMARY KEY, tentativas integer NOT NULL DEFAULT 0, ate timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS ${p}_eventos_seguranca (id bigserial PRIMARY KEY, quando timestamptz NOT NULL DEFAULT now(), tipo text NOT NULL, login text, ip text);
    CREATE INDEX IF NOT EXISTS ${nomeIndice(p, 'eventos_seguranca_quando_idx')} ON ${p}_eventos_seguranca(quando DESC);
    CREATE TABLE IF NOT EXISTS ${p}_2fa (user_id text PRIMARY KEY, segredo_cifrado text NOT NULL, ativo boolean NOT NULL DEFAULT false, ultimo_passo bigint, emergencia text[] NOT NULL DEFAULT '{}', criado_em timestamptz NOT NULL DEFAULT now(), ativado_em timestamptz);
    CREATE TABLE IF NOT EXISTS ${p}_dispositivos_confiaveis (token_hash char(64) PRIMARY KEY, user_id text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(), expira_em timestamptz NOT NULL);
    CREATE INDEX IF NOT EXISTS ${nomeIndice(p, 'dispositivos_confiaveis_user_idx')} ON ${p}_dispositivos_confiaveis(user_id);
  `);
  await limparSeguranca(c, p);
}

/** Faxina: tentativas vencidas, aparelhos vencidos e eventos com mais de 90 dias. */
export async function limparSeguranca(c: Consultar, prefixo: string): Promise<void> {
  const p = prefixoValido(prefixo);
  await c(`
    DELETE FROM ${p}_login_falhas WHERE ate < now() - interval '1 day';
    DELETE FROM ${p}_dispositivos_confiaveis WHERE expira_em < now();
    DELETE FROM ${p}_eventos_seguranca WHERE quando < now() - interval '90 days';
  `);
}

export async function registrarEvento(c: Consultar, prefixo: string, tipo: string, login: string | null, ip: string | null): Promise<void> {
  const p = prefixoValido(prefixo);
  console.warn(`[segurança] ${tipo} usuário=${mascararLogin(login || '')} ip=${mascararIp(ip || '')}`);
  await c(`INSERT INTO ${p}_eventos_seguranca(tipo, login, ip) VALUES ($1, $2, $3)`, [tipo, login ? mascararLogin(login) : null, ip ? mascararIp(ip) : null]).catch(() => undefined);
}

const chavesDeBloqueio = (ip: string, login: string) => [`ip:${String(ip || 'desconhecido').slice(0, 64)}`, `usuario:${String(login || '').trim().toLowerCase().slice(0, 80)}`];

export async function estaBloqueado(c: Consultar, prefixo: string, ip: string, login: string): Promise<boolean> {
  const p = prefixoValido(prefixo);
  const [chaveIp, chaveUsuario] = chavesDeBloqueio(ip, login);
  const r = await c(`SELECT chave, tentativas FROM ${p}_login_falhas WHERE chave = ANY($1::text[]) AND ate > now()`, [[chaveIp, chaveUsuario]]);
  return r.rows.some((linha) => (linha.chave === chaveIp && Number(linha.tentativas) >= LIMITE_FALHAS_POR_IP) || (linha.chave === chaveUsuario && Number(linha.tentativas) >= LIMITE_FALHAS_POR_USUARIO));
}

/** Soma uma falha (senha ou código errado) para o aparelho e para o usuário. Devolve se, com ela, o bloqueio passou a valer. */
export async function registrarFalha(c: Consultar, prefixo: string, ip: string, login: string, tipo: 'login_falhou' | 'codigo_falhou' = 'login_falhou'): Promise<boolean> {
  const p = prefixoValido(prefixo);
  for (const chave of chavesDeBloqueio(ip, login)) {
    await c(`INSERT INTO ${p}_login_falhas(chave, tentativas, ate) VALUES ($1, 1, now() + ($2 * interval '1 minute'))
      ON CONFLICT (chave) DO UPDATE SET
        tentativas = CASE WHEN ${p}_login_falhas.ate > now() THEN ${p}_login_falhas.tentativas + 1 ELSE 1 END,
        ate = CASE WHEN ${p}_login_falhas.ate > now() THEN ${p}_login_falhas.ate ELSE now() + ($2 * interval '1 minute') END`, [chave, JANELA_BLOQUEIO_MINUTOS]);
  }
  await registrarEvento(c, p, tipo, login, ip);
  const bloqueou = await estaBloqueado(c, p, ip, login);
  if (bloqueou) await registrarEvento(c, p, 'login_bloqueado', login, ip);
  return bloqueou;
}

/** Login certo: zera só a contagem daquele aparelho. A do usuário segue até vencer, para não ser zerada por quem acertou a própria conta. */
export async function limparFalhasDoAparelho(c: Consultar, prefixo: string, ip: string): Promise<void> {
  const p = prefixoValido(prefixo);
  await c(`DELETE FROM ${p}_login_falhas WHERE chave = $1`, [chavesDeBloqueio(ip, '')[0]]);
}

export interface Estado2fa { ativo: boolean; ultimoPasso: number | null; emergenciaRestantes: number; segredoCifrado: string }

export async function ler2fa(c: Consultar, prefixo: string, usuarioId: string): Promise<Estado2fa | null> {
  const p = prefixoValido(prefixo);
  const r = await c(`SELECT segredo_cifrado, ativo, ultimo_passo, cardinality(emergencia) AS restantes FROM ${p}_2fa WHERE user_id = $1`, [usuarioId]);
  const linha = r.rows[0];
  return linha ? { ativo: linha.ativo === true, ultimoPasso: linha.ultimo_passo === null ? null : Number(linha.ultimo_passo), emergenciaRestantes: Number(linha.restantes), segredoCifrado: String(linha.segredo_cifrado) } : null;
}

export async function tem2faAtivo(c: Consultar, prefixo: string, usuarioId: string): Promise<boolean> {
  return (await ler2fa(c, prefixo, usuarioId))?.ativo === true;
}

/** Começa a ativação: gera um segredo novo (ainda inativo). Se já estiver ativo, não troca: a pessoa precisa desativar antes. */
export async function iniciarAtivacao2fa(c: Consultar, prefixo: string, chaveMestra: Buffer, usuarioId: string, conta: string, emissor: string): Promise<{ segredo: string; uri: string }> {
  const p = prefixoValido(prefixo);
  if (await tem2faAtivo(c, p, usuarioId)) throw new Error('O código de segurança já está ativo nesta conta.');
  const segredo = gerarSegredoTotp();
  await c(`INSERT INTO ${p}_2fa(user_id, segredo_cifrado, ativo) VALUES ($1, $2, false)
    ON CONFLICT (user_id) DO UPDATE SET segredo_cifrado = EXCLUDED.segredo_cifrado, ativo = false, ultimo_passo = NULL, emergencia = '{}', criado_em = now(), ativado_em = NULL`, [usuarioId, cifrarSegredo(chaveMestra, usuarioId, segredo)]);
  return { segredo, uri: uriOtpauth(emissor, conta, segredo) };
}

/** Confirma o primeiro código digitado, liga o segundo fator e devolve os códigos de emergência (só aparecem esta vez). */
export async function concluirAtivacao2fa(c: Consultar, prefixo: string, chaveMestra: Buffer, usuarioId: string, codigo: string, agoraMs: number = Date.now()): Promise<{ ok: true; codigosEmergencia: string[] } | { ok: false }> {
  const p = prefixoValido(prefixo);
  const estado = await ler2fa(c, p, usuarioId);
  if (!estado || estado.ativo) return { ok: false };
  const resultado = verificarTotp(decifrarSegredo(chaveMestra, usuarioId, estado.segredoCifrado), codigo, agoraMs, null);
  if (!resultado.ok) return { ok: false };
  const codigos = gerarCodigosEmergencia();
  const gravado = await c(`UPDATE ${p}_2fa SET ativo = true, ultimo_passo = $2, emergencia = $3::text[], ativado_em = now() WHERE user_id = $1 AND ativo = false`, [usuarioId, resultado.passo, codigos.map(hashCodigoEmergencia)]);
  if (!gravado.rowCount) return { ok: false };
  return { ok: true, codigosEmergencia: codigos };
}

/** Segundo fator do login: 6 dígitos do celular (cada um vale uma vez) ou um código de emergência (vale uma vez e é gasto). */
export async function verificarSegundoFator(c: Consultar, prefixo: string, chaveMestra: Buffer, usuarioId: string, codigo: string, agoraMs: number = Date.now()): Promise<{ ok: boolean; via?: 'celular' | 'emergencia' }> {
  const p = prefixoValido(prefixo);
  const estado = await ler2fa(c, p, usuarioId);
  if (!estado?.ativo) return { ok: false };
  const texto = String(codigo || '').trim();
  if (/^\d[\d\s]{4,}$/.test(texto)) {
    const resultado = verificarTotp(decifrarSegredo(chaveMestra, usuarioId, estado.segredoCifrado), texto, agoraMs, estado.ultimoPasso);
    if (!resultado.ok) return { ok: false };
    const gravado = await c(`UPDATE ${p}_2fa SET ultimo_passo = $2 WHERE user_id = $1 AND (ultimo_passo IS NULL OR ultimo_passo < $2)`, [usuarioId, resultado.passo]);
    return gravado.rowCount ? { ok: true, via: 'celular' } : { ok: false };
  }
  if (normalizarCodigoEmergencia(texto).length !== 10) return { ok: false };
  const gasto = await c(`UPDATE ${p}_2fa SET emergencia = array_remove(emergencia, $2) WHERE user_id = $1 AND $2 = ANY(emergencia)`, [usuarioId, hashCodigoEmergencia(texto)]);
  return gasto.rowCount ? { ok: true, via: 'emergencia' } : { ok: false };
}

export async function desativar2fa(c: Consultar, prefixo: string, usuarioId: string): Promise<void> {
  const p = prefixoValido(prefixo);
  await c(`DELETE FROM ${p}_2fa WHERE user_id = $1`, [usuarioId]);
  await c(`DELETE FROM ${p}_dispositivos_confiaveis WHERE user_id = $1`, [usuarioId]);
}

// ----- aparelho confiável: depois do primeiro código, o aparelho não pede de novo (cookie próprio, 90 dias) -----

export const NOME_COOKIE_APARELHO = 'murade_aparelho';
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export async function criarAparelhoConfiavel(c: Consultar, prefixo: string, usuarioId: string): Promise<string> {
  const p = prefixoValido(prefixo);
  const token = crypto.randomBytes(32).toString('base64url');
  await c(`INSERT INTO ${p}_dispositivos_confiaveis(token_hash, user_id, expira_em) VALUES ($1, $2, now() + ($3 * interval '1 day'))`, [hashToken(token), usuarioId, DIAS_APARELHO_CONFIAVEL]);
  return token;
}

export async function aparelhoConfiavel(c: Consultar, prefixo: string, usuarioId: string, token: string | null | undefined): Promise<boolean> {
  const p = prefixoValido(prefixo);
  if (!token || token.length < 20 || token.length > 100) return false;
  const r = await c(`UPDATE ${p}_dispositivos_confiaveis SET expira_em = now() + ($3 * interval '1 day') WHERE token_hash = $1 AND user_id = $2 AND expira_em > now()`, [hashToken(token), usuarioId, DIAS_APARELHO_CONFIAVEL]);
  return Boolean(r.rowCount);
}

export function lerCookie(cabecalho: string | undefined, nome: string): string | null {
  for (const parte of String(cabecalho || '').split(';')) {
    const [chave, ...resto] = parte.trim().split('=');
    if (chave === nome) return decodeURIComponent(resto.join('=')) || null;
  }
  return null;
}

export function cookieAparelho(token: string, seguro: boolean): string {
  return `${NOME_COOKIE_APARELHO}=${encodeURIComponent(token)}; Path=/; Max-Age=${DIAS_APARELHO_CONFIAVEL * 86400}; HttpOnly; SameSite=Lax${seguro ? '; Secure' : ''}`;
}

// ----- números para o robô conferidor e para a Agente IA (só leitura) -----

export interface ResumoSeguranca { dias: number; senhasErradas: number; codigosErrados: number; bloqueios: number; contasComCodigo: number; emergenciaUsada: number }

export async function resumirSeguranca(c: Consultar, prefixo: string, dias = 1): Promise<ResumoSeguranca> {
  const p = prefixoValido(prefixo);
  const r = await c(`SELECT
      count(*) FILTER (WHERE tipo = 'login_falhou')::int AS senhas,
      count(*) FILTER (WHERE tipo = 'codigo_falhou')::int AS codigos,
      count(*) FILTER (WHERE tipo = 'login_bloqueado')::int AS bloqueios,
      count(*) FILTER (WHERE tipo = 'codigo_emergencia_usado')::int AS emergencia
    FROM ${p}_eventos_seguranca WHERE quando > now() - ($1 * interval '1 day')`, [dias]);
  const contas = await c(`SELECT count(*)::int AS total FROM ${p}_2fa WHERE ativo = true`);
  const l = r.rows[0] || {};
  return { dias, senhasErradas: Number(l.senhas || 0), codigosErrados: Number(l.codigos || 0), bloqueios: Number(l.bloqueios || 0), emergenciaUsada: Number(l.emergencia || 0), contasComCodigo: Number(contas.rows[0]?.total || 0) };
}

export function mensagemDoResumo(r: ResumoSeguranca, donoSemCodigo: string[]): { alerta: boolean; texto: string } {
  const partes: string[] = [];
  if (donoSemCodigo.length) partes.push(`conta(s) de administrador sem código de segurança: ${donoSemCodigo.slice(0, 5).map(mascararLogin).join(', ')}`);
  if (r.bloqueios > 0) partes.push(`${r.bloqueios} bloqueio(s) de login por excesso de tentativas`);
  if (r.senhasErradas + r.codigosErrados >= 30) partes.push(`${r.senhasErradas} senha(s) e ${r.codigosErrados} código(s) errados em ${r.dias} dia(s)`);
  if (r.emergenciaUsada > 0) partes.push(`${r.emergenciaUsada} código(s) de emergência usado(s)`);
  const base = `${r.contasComCodigo} conta(s) com código de segurança; ${r.senhasErradas} senha(s) errada(s), ${r.codigosErrados} código(s) errado(s) e ${r.bloqueios} bloqueio(s) nas últimas ${r.dias * 24}h`;
  return partes.length ? { alerta: true, texto: `ATENÇÃO: ${partes.join('; ')}. (${base}.)` } : { alerta: false, texto: `Tudo em ordem: ${base}.` };
}
