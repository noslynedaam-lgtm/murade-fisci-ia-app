import type { NextFunction, Request, Response } from 'express';
import { obterPoolBanco } from './persistence';
import { obterUsuarioDaSessao } from './auth.routes';

// Atividade da equipe (só metadados). Depende da migração 014; sem ela, não registra nada e não atrapalha ninguém.
const IGNORAR = [/^\/api\/auth\/(login|logout|session|status|redeem|escritorios|atividade|forgot|reset)/, /^\/api\/sso\//, /^\/api\/health/];
const ROTULOS: Array<[RegExp, string]> = [
  [/auth\/users/, 'Alterou contas da equipe'], [/ai\/agente\/confirmar/, 'Confirmou uma ação sugerida pela IA'],
  [/certificado/, 'Alterou certificado digital'], [/sefaz|dfe/, 'Consultou/atualizou documentos na SEFAZ'], [/conferencia/, 'Alterou conferência'],
  [/empresa|company/, 'Alterou cadastro de empresa'], [/reforma/, 'Alterou dados da reforma tributária'],
];
function descrever(metodo: string, rota: string): string {
  const x = ROTULOS.find(([re]) => re.test(rota.toLowerCase()));
  return x ? x[1] : `${metodo === 'DELETE' ? 'Removeu' : metodo === 'POST' ? 'Registrou' : 'Alterou'} dados (${rota.replace(/^\/api\//, '').slice(0, 80)})`;
}
let disponivel: boolean | null = null;
async function atividadeDisponivel(): Promise<boolean> {
  if (disponivel === true) return true;
  const pool = obterPoolBanco(); if (!pool) return false;
  try { disponivel = (await pool.query("SELECT to_regprocedure('fiscoia.log_team_activity(uuid,text,text,text,text,integer)') IS NOT NULL AS ok")).rows[0]?.ok === true; } catch { disponivel = false; }
  return disponivel;
}

export function registrarAtividadeEquipe(req: Request, res: Response, next: NextFunction): void {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  res.on('finish', () => {
    void (async () => {
      try {
        if (res.statusCode >= 400) return;
        const rota = req.originalUrl.split('?')[0];
        if (IGNORAR.some((re) => re.test(rota))) return;
        const pool = obterPoolBanco(); if (!pool || !(await atividadeDisponivel())) return;
        const usuario = await obterUsuarioDaSessao(req); if (!usuario) return;
        const bruto = (req.body && typeof req.body === 'object' ? (req.body as any).cnpj : undefined) ?? (req.params as any)?.cnpj;
        const cnpj = typeof bruto === 'string' && bruto.replace(/[^0-9A-Za-z]/g, '').length === 14 ? bruto.replace(/[^0-9A-Za-z]/g, '').toUpperCase() : null;
        await pool.query('SELECT fiscoia.log_team_activity($1::uuid,$2,$3,$4,$5,$6)', [usuario.id, usuario.email, descrever(req.method, rota), rota, cnpj, res.statusCode]);
      } catch (erro) { console.error('Atividade da equipe não registrada:', erro instanceof Error ? erro.message : erro); }
    })();
  });
  next();
}

export async function listarAtividadeEquipe(req: Request, res: Response): Promise<void> {
  const pool = obterPoolBanco();
  if (!pool) { res.status(503).json({ mensagem: 'Banco permanente não configurado.' }); return; }
  try {
    const usuario = await obterUsuarioDaSessao(req);
    if (!usuario) { res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' }); return; }
    if (!(await atividadeDisponivel())) { res.json({ disponivel: false, atividades: [], mensagem: 'Aplique a migração 014 (npm run db:migrate) para ativar a atividade da equipe.' }); return; }
    const filtro = typeof req.query.usuario === 'string' ? req.query.usuario.trim() : '';
    const r = await pool.query('SELECT * FROM fiscoia.list_team_activity($1::uuid,$2,$3)', [usuario.id, filtro, Number(req.query.limite) || 100]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ disponivel: true, atividades: r.rows.map((x) => ({ usuario: String(x.login), acao: String(x.acao), cnpj: x.cnpj ? String(x.cnpj) : null, quando: new Date(x.created_at).toISOString() })) });
  } catch (erro) {
    if (typeof erro === 'object' && erro !== null && 'code' in erro && erro.code === '42501') { res.status(403).json({ mensagem: 'Somente o responsável do escritório consulta a atividade da equipe.' }); return; }
    res.status(503).json({ mensagem: 'Não foi possível carregar a atividade da equipe.' });
  }
}
