// Nome de tratamento e saudação do dia da Agente IA do Fisco IA (regra fixa, sem chamar IA).
// Depende da migração 019 (fiscoia.users.nome_tratamento e ultima_saudacao). Sem ela, nada quebra:
// a leitura devolve "indisponível", a Agente não saúda e nada é gravado.
import type { Pool } from 'pg';
import { obterPoolBanco } from './persistence';
import { diaDeHoje } from './agenteSaudacao';

export interface PerfilSaudacao { nome: string | null; saudadoHoje: boolean; disponivel: boolean }

export function criarPerfilSaudacao(obterPool: () => Pool | null = obterPoolBanco) {
  let colunasOk = false;
  let conferidoEm = 0;

  /** Confere se as duas colunas existem. Depois de achar, não confere mais; se faltarem, volta a olhar a cada 30 s (migração aplicada sem reiniciar). */
  async function disponivel(): Promise<boolean> {
    if (colunasOk) return true;
    const pool = obterPool();
    if (!pool) return false;
    if (Date.now() - conferidoEm < 30_000) return false;
    conferidoEm = Date.now();
    try {
      const r = await pool.query(
        `SELECT count(*)::int AS n FROM information_schema.columns
          WHERE table_schema='fiscoia' AND table_name='users' AND column_name IN ('nome_tratamento','ultima_saudacao')`);
      colunasOk = Number(r.rows[0]?.n) === 2;
    } catch { colunasOk = false; }
    return colunasOk;
  }

  return {
    disponivel,
    /** Nunca lança erro: sem as colunas (ou sem banco), devolve disponivel=false. */
    async lerPerfil(userId: string): Promise<PerfilSaudacao> {
      const vazio: PerfilSaudacao = { nome: null, saudadoHoje: false, disponivel: false };
      try {
        if (!(await disponivel())) return vazio;
        const r = await obterPool()!.query(`SELECT nome_tratamento, ultima_saudacao::text AS ultima FROM fiscoia.users WHERE id=$1`, [userId]);
        const linha = r.rows[0];
        if (!linha) return vazio;
        return { nome: linha.nome_tratamento ? String(linha.nome_tratamento) : null, saudadoHoje: linha.ultima === diaDeHoje(), disponivel: true };
      } catch { return vazio; }
    },
    /** Devolve true se gravou; false se a migração 019 não está aplicada (nada é gravado). */
    async gravarNome(userId: string, nome: string): Promise<boolean> {
      try {
        if (!(await disponivel())) return false;
        const r = await obterPool()!.query(`UPDATE fiscoia.users SET nome_tratamento=$2 WHERE id=$1`, [userId, nome]);
        return (r.rowCount ?? 0) > 0;
      } catch { return false; }
    },
    /** Devolve true se marcou; false se a migração 019 não está aplicada. */
    async marcarSaudadoHoje(userId: string): Promise<boolean> {
      try {
        if (!(await disponivel())) return false;
        const r = await obterPool()!.query(`UPDATE fiscoia.users SET ultima_saudacao=$2::date WHERE id=$1`, [userId, diaDeHoje()]);
        return (r.rowCount ?? 0) > 0;
      } catch { return false; }
    },
  };
}

const padrao = criarPerfilSaudacao();
export const lerPerfilSaudacao = padrao.lerPerfil;
export const gravarNomeTratamento = padrao.gravarNome;
export const marcarSaudadoHoje = padrao.marcarSaudadoHoje;
