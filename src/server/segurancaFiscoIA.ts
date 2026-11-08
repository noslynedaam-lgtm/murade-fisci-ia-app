import type { Request, Response, NextFunction } from 'express';
import { obterPoolBanco } from './persistence';
import { lerChaveMestra, tem2faAtivo, type Consultar } from './segurancaLogin';

/** Tabelas: fiscoia.seg_login_falhas, seg_eventos_seguranca, seg_2fa, seg_dispositivos_confiaveis (migração 018). */
export const PREFIXO_SEGURANCA_FISCOIA = 'fiscoia.seg';
export const EMISSOR_2FA = 'Murade Fisco IA';

export const consultarSeguranca: Consultar = async (sql, params) => {
  const pool = obterPoolBanco();
  if (!pool) throw new Error('Banco permanente não configurado.');
  return pool.query(sql, params as unknown[]) as unknown as ReturnType<Consultar>;
};

export function chaveMestra2fa(): Buffer | null { return lerChaveMestra(process.env.FISCOIA_DATA_ENCRYPTION_KEY); }
export function obrigatorio2faDono(): boolean {
  return Boolean(chaveMestra2fa()) && String(process.env.MURADE_2FA_OBRIGATORIO_DONO || '').trim().toLowerCase() !== 'nao';
}

let tabelasOk = false;
let tabelasConferidasEm = 0;
/**
 * As tabelas nascem só pela migração 018. Enquanto ela não rodou, o login continua com o bloqueio antigo e
 * o código de segurança não é exigido de ninguém (nada quebra). Resultado "sim" fica guardado; "não" é conferido de novo a cada 30 s.
 */
export async function segurancaDisponivel(): Promise<boolean> {
  if (tabelasOk) return true;
  const pool = obterPoolBanco();
  if (!pool) return false;
  if (Date.now() - tabelasConferidasEm < 30_000) return false;
  tabelasConferidasEm = Date.now();
  try {
    const r = await pool.query(`SELECT to_regclass('fiscoia.seg_login_falhas') IS NOT NULL AND to_regclass('fiscoia.seg_eventos_seguranca') IS NOT NULL
      AND to_regclass('fiscoia.seg_2fa') IS NOT NULL AND to_regclass('fiscoia.seg_dispositivos_confiaveis') IS NOT NULL AS ok`);
    tabelasOk = r.rows[0]?.ok === true;
  } catch { tabelasOk = false; }
  return tabelasOk;
}
/** Só para testes. */
export function reiniciarConferenciaSeguranca(): void { tabelasOk = false; tabelasConferidasEm = 0; }

/** Rotas que o dono sem código ainda pode usar: ligar o código, sair e a própria sessão. */
export const ROTAS_LIVRES_SEM_CODIGO = /^(GET|POST) \/api\/auth\/(2fa(\/[a-z]+)?|logout|manter-conectado|session|login)$/;

const ativoEmMemoria = new Map<string, number>();

/**
 * O dono (conta administradora) sem código de segurança só consegue ligar o código ou sair; o resto do sistema responde 403.
 * Fica de fora quando: a função não está disponível (sem chave ou sem migração), a exigência foi desligada por
 * MURADE_2FA_OBRIGATORIO_DONO=nao, ou a requisição não traz sessão (chamadas entre sistemas têm credencial própria).
 */
export function criarBarreiraDoDono(obterDonoDaSessao: (req: Request) => Promise<{ id: string; ehAdmin: boolean } | null>) {
  return async function exigirCodigoDoDono(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!obrigatorio2faDono() || !/(?:^|;\s*)fiscoia_session=/.test(req.headers.cookie || '')) { next(); return; }
      const chave = `${req.method} /api${req.path}`.replace(/\/+$/, '');
      if (ROTAS_LIVRES_SEM_CODIGO.test(chave)) { next(); return; }
      if (!(await segurancaDisponivel())) { next(); return; }
      const dono = await obterDonoDaSessao(req);
      if (!dono || !dono.ehAdmin) { next(); return; }
      const validoAte = ativoEmMemoria.get(dono.id) || 0;
      if (validoAte > Date.now()) { next(); return; }
      if (await tem2faAtivo(consultarSeguranca, PREFIXO_SEGURANCA_FISCOIA, dono.id)) { ativoEmMemoria.set(dono.id, Date.now() + 30_000); next(); return; }
      res.status(403).json({ sucesso: false, mensagem: 'Ligue o código de segurança para continuar.', precisaAtivar2fa: true });
    } catch {
      // Falha ao conferir não derruba o sistema: segue como estava (a barreira é um reforço, não a única porta).
      next();
    }
  };
}
export function esquecerAtivoEmMemoria(userId: string): void { ativoEmMemoria.delete(userId); }
