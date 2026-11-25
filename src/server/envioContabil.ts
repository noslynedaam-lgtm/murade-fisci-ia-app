// Fisco IA → Contábil: as guias (DAS do MEI), a dívida ativa e os parcelamentos que a pessoa consultou POR CLIQUE no Integra Contador
// viram pré-lançamentos no Murad Contábil, para a contadora conferir (mesmo padrão do Fiscal → Contábil).
//  - logo depois de guardar o resultado da consulta, o envio sai sozinho (sem custo: não consulta o Serpro de novo);
//  - o Robô de Envio ao Contábil (de 2 em 2 horas) reenvia o que ficou pendente, com erro ou de empresa que ainda não estava no Contábil;
//  - "Enviar agora" do escritório (tela SERPRO › Carteira fiscal e Agente IA) faz o mesmo só com o escritório da pessoa.
// Isolado por escritório (RLS): a pessoa só envia e só vê o que é do escritório dela; o robô usa funções próprias da conta administradora.
import { Router } from 'express';
import type { Pool } from 'pg';
import { obterUsuarioDaSessao } from './auth.routes';
import { comContextoTenant } from './persistence';
import { urlDoSistema } from './agentesEntreSistemas';
import { normalizarCnpj } from '../services/cnpj/cnpjValidation';
import { enviarItensAoContabil, itensParaContabil, resumoEnvioContabil, TIPOS_PARA_CONTABIL, type SituacaoEnvio } from '../services/serpro/paraContabil';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAPEIS = ['OWNER', 'ADMIN'];
const cfgContabil = () => ({ url: urlDoSistema('contabil'), token: process.env.MURADE_INTEGRATION_TOKEN?.trim() });
const SITUACOES_A_ENVIAR = "(r.contabil_situacao IS NULL OR r.contabil_situacao IN ('pendente', 'erro', 'sem_contabil'))";

/** Envia ao Contábil UM resultado guardado do escritório (chamado logo depois de guardar a consulta). Nunca lança exceção. */
export async function enviarResultadoAoContabil(userId: string, tenantId: string, resultadoId: string): Promise<{ situacao: SituacaoEnvio; mensagem: string; itens: number } | null> {
  try {
    const r = await comContextoTenant(userId, tenantId, async (c) => (await c.query(
      `SELECT r.id, r.tipo, r.modalidade, r.resumo, co.cnpj FROM fiscoia.serpro_resultados r JOIN fiscoia.companies co ON co.id = r.company_id AND co.tenant_id = r.tenant_id
        WHERE r.id = $1 AND r.tenant_id = $2 AND r.tipo = ANY($3::text[])`, [resultadoId, tenantId, [...TIPOS_PARA_CONTABIL]])).rows[0], PAPEIS);
    if (!r.autorizado || !('resultado' in r) || !r.resultado) return null;
    const x = r.resultado;
    const env = await enviarItensAoContabil(normalizarCnpj(String(x.cnpj)), itensParaContabil(x.tipo, x.modalidade, x.resumo), cfgContabil());
    await comContextoTenant(userId, tenantId, (c) => c.query(
      `UPDATE fiscoia.serpro_resultados SET contabil_situacao = $3, contabil_mensagem = left($4, 400), contabil_itens = $5,
              contabil_enviado_em = CASE WHEN $3 = 'enviado' THEN now() ELSE contabil_enviado_em END WHERE id = $1 AND tenant_id = $2`,
      [resultadoId, tenantId, env.situacao, env.mensagem, Math.min(env.itens, 32000)]), PAPEIS).catch(() => undefined);
    return env;
  } catch { return null; }
}

/** "Enviar agora" de um escritório: tudo o que ainda não foi enviado (ou deu erro). */
export async function enviarPendentesDoEscritorio(userId: string, tenantId: string): Promise<{ enviados: number; erros: number; semContabil: number; semItens: number; mensagens: string[] } | null> {
  const r = await comContextoTenant(userId, tenantId, async (c) => (await c.query(
    `SELECT r.id FROM fiscoia.serpro_resultados r WHERE r.tenant_id = $1 AND r.tipo = ANY($2::text[]) AND ${SITUACOES_A_ENVIAR} ORDER BY r.consultado_em LIMIT 100`,
    [tenantId, [...TIPOS_PARA_CONTABIL]])).rows.map((x: any) => String(x.id)), PAPEIS);
  if (!r.autorizado || !('resultado' in r)) return null;
  const t = { enviados: 0, erros: 0, semContabil: 0, semItens: 0, mensagens: [] as string[] };
  for (const id of r.resultado ?? []) {
    const e = await enviarResultadoAoContabil(userId, tenantId, id);
    if (!e) { t.erros += 1; continue; }
    if (e.situacao === 'enviado') t.enviados += 1; else if (e.situacao === 'sem_contabil') t.semContabil += 1; else if (e.situacao === 'sem_itens') t.semItens += 1; else { t.erros += 1; t.mensagens.push(e.mensagem); }
  }
  return t;
}

/** Robô de Envio ao Contábil (todos os escritórios). Só reenvia o que já foi consultado e guardado; não consulta o Serpro. */
export async function roboEnvioContabil(pool: Pool | null): Promise<string> {
  if (!pool) return 'Banco indisponível; nada enviado.';
  const adm = (await pool.query('SELECT id FROM fiscoia.users WHERE active = true AND is_admin = true ORDER BY id LIMIT 1').catch(() => ({ rows: [] as any[] }))).rows[0]?.id;
  if (!adm) return 'Sem conta administradora; nada enviado.';
  let linhas: any[];
  try { linhas = (await pool.query('SELECT * FROM fiscoia.platform_envios_contabil_pendentes($1::uuid, 200)', [adm])).rows; }
  catch { return 'Atualização 029 do banco ainda não aplicada; nada enviado.'; }
  const c = { enviados: 0, erros: 0, semContabil: 0, pendentes: 0 };
  for (const x of linhas) {
    const env = await enviarItensAoContabil(normalizarCnpj(String(x.cnpj)), itensParaContabil(x.tipo, x.modalidade, x.resumo), cfgContabil());
    // Empresa que continua fora do Contábil não muda de situação a cada rodada (evita escrita à toa).
    if (!(env.situacao === 'sem_contabil' && x.contabil_situacao === 'sem_contabil')) {
      await pool.query('SELECT fiscoia.platform_marcar_envio_contabil($1::uuid, $2::uuid, $3, $4, $5)', [adm, x.id, env.situacao, env.mensagem, Math.min(env.itens, 32000)]).catch(() => { c.pendentes += 1; });
    }
    if (env.situacao === 'enviado') c.enviados += 1; else if (env.situacao === 'sem_contabil') c.semContabil += 1; else if (env.situacao === 'erro') c.erros += 1;
  }
  const r = resumoEnvioContabil(c);
  if (r.alerta) throw new Error(r.texto);
  return r.texto;
}

// ------------------------------------------------------------------ rotas do escritório
const router = Router();
async function usuario(req: any, res: any, tenantId: string) {
  const user = await obterUsuarioDaSessao(req).catch(() => null);
  if (!user) { res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' }); return null; }
  if (!UUID.test(tenantId)) { res.status(400).json({ mensagem: 'Escritório inválido.' }); return null; }
  return user;
}

// Situação do envio ao Contábil do escritório (contagens e as últimas 20 consultas que vão ao Contábil). Sem custo.
router.get('/carteira-fiscal/envios-contabil', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.query.tenantId ?? '');
  const user = await usuario(req, res, tenantId); if (!user) return;
  try {
    const r = await comContextoTenant(user.id, tenantId, async (c) => (await c.query(
      `SELECT r.id, r.tipo, r.modalidade, r.contabil_situacao, r.contabil_mensagem, r.contabil_itens, r.contabil_enviado_em, r.consultado_em, co.legal_name
         FROM fiscoia.serpro_resultados r JOIN fiscoia.companies co ON co.id = r.company_id AND co.tenant_id = r.tenant_id
        WHERE r.tenant_id = $1 AND r.tipo = ANY($2::text[]) ORDER BY r.consultado_em DESC LIMIT 200`, [tenantId, [...TIPOS_PARA_CONTABIL]])).rows);
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    const linhas = (r.resultado ?? []) as any[];
    const conta = (s: string | null) => linhas.filter((x) => (x.contabil_situacao ?? null) === s).length;
    return res.json({
      totais: { enviados: conta('enviado'), erros: conta('erro'), semContabil: conta('sem_contabil'), semItens: conta('sem_itens'), pendentes: conta(null) + conta('pendente') },
      ultimos: linhas.slice(0, 20).map((x) => ({ id: String(x.id), empresa: String(x.legal_name), tipo: x.tipo, modalidade: x.modalidade, situacao: x.contabil_situacao ?? 'pendente', mensagem: x.contabil_mensagem ?? null, itens: x.contabil_itens ?? null, enviadoEm: x.contabil_enviado_em ? new Date(x.contabil_enviado_em).toISOString() : null, consultadoEm: new Date(x.consultado_em).toISOString() })),
    });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível ler os envios ao Contábil. Se o sistema acabou de ser atualizado, aguarde alguns minutos.' }); }
});

// "Enviar agora": manda ao Contábil o que o escritório já consultou e ainda não foi (ou deu erro). Não consulta o Serpro.
router.post('/carteira-fiscal/enviar-contabil', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.body?.tenantId ?? '');
  const user = await usuario(req, res, tenantId); if (!user) return;
  try {
    const t = await enviarPendentesDoEscritorio(user.id, tenantId);
    if (!t) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão (ou seu papel não permite enviar).' });
    const r = resumoEnvioContabil({ enviados: t.enviados, erros: t.erros, semContabil: t.semContabil, pendentes: 0 });
    return res.json({ ...t, mensagem: t.enviados + t.erros + t.semContabil + t.semItens === 0 ? 'Nada pendente de envio ao Contábil.' : r.texto });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível enviar agora.' }); }
});

export default router;
