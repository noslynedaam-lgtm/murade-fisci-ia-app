// Dados compartilhados do escritório (Agenda Fiscal, Relatório de Conformidade, Guias INSS/DCTFWeb): ficam no servidor, por escritório,
// para a contadora e a funcionária verem a mesma coisa. Cada item é gravado separado, então uma pessoa não apaga o que a outra fez.
import { Router } from 'express';
import { obterUsuarioDaSessao } from './auth.routes';
import { comContextoTenant } from './persistence';
import { LIMITE_ITENS_POR_ENVIO, ehColecao, validarItem } from '../services/escritorio/dadosEscritorio';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const router = Router();

router.get('/escritorio/dados', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.query.tenantId ?? ''); const colecao = req.query.colecao;
  const user = await obterUsuarioDaSessao(req).catch(() => null);
  if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
  if (!UUID.test(tenantId) || !ehColecao(colecao)) return res.status(400).json({ mensagem: 'Escritório ou tipo de dado inválido.' });
  try {
    const r = await comContextoTenant(user.id, tenantId, async (c) => (await c.query('SELECT chave, dados, atualizado_em FROM fiscoia.dados_escritorio WHERE tenant_id = $1 AND colecao = $2 ORDER BY chave LIMIT 20000', [tenantId, colecao])).rows);
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    return res.json({ colecao, itens: (r.resultado ?? []).map((x: any) => ({ chave: String(x.chave), dados: x.dados, atualizadoEm: new Date(x.atualizado_em).toISOString() })) });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível ler os dados do escritório agora. Nada foi apagado.' }); }
});

// Grava e apaga itens (só os que mudaram). Item inválido é recusado sozinho; os demais são gravados.
router.post('/escritorio/dados/sincronizar', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.body?.tenantId ?? ''); const colecao = req.body?.colecao;
  const user = await obterUsuarioDaSessao(req).catch(() => null);
  if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
  if (!UUID.test(tenantId) || !ehColecao(colecao)) return res.status(400).json({ mensagem: 'Escritório ou tipo de dado inválido.' });
  const gravar = Array.isArray(req.body?.gravar) ? req.body.gravar as { chave?: unknown; dados?: unknown }[] : [];
  const apagar = Array.isArray(req.body?.apagar) ? (req.body.apagar as unknown[]).filter((k): k is string => typeof k === 'string') : [];
  if (gravar.length + apagar.length > LIMITE_ITENS_POR_ENVIO) return res.status(413).json({ mensagem: `Envie no máximo ${LIMITE_ITENS_POR_ENVIO} itens por vez.` });
  const recusados: { chave: string; motivo: string }[] = [];
  const validos = gravar.filter((g) => { const m = validarItem(colecao, g?.chave, g?.dados); if (m) recusados.push({ chave: String(g?.chave ?? '').slice(0, 120), motivo: m }); return !m; });
  try {
    const r = await comContextoTenant(user.id, tenantId, async (c) => {
      for (const g of validos) {
        await c.query(`INSERT INTO fiscoia.dados_escritorio (tenant_id, colecao, chave, dados, atualizado_em, atualizado_por) VALUES ($1,$2,$3,$4::jsonb, now(), $5)
          ON CONFLICT (tenant_id, colecao, chave) DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = now(), atualizado_por = EXCLUDED.atualizado_por`, [tenantId, colecao, g.chave, JSON.stringify(g.dados), user.id]);
      }
      let apagados = 0;
      if (apagar.length) apagados = (await c.query('DELETE FROM fiscoia.dados_escritorio WHERE tenant_id = $1 AND colecao = $2 AND chave = ANY($3::text[])', [tenantId, colecao, apagar])).rowCount ?? 0;
      return apagados;
    });
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    return res.json({ gravados: validos.length, apagados: r.resultado ?? 0, recusados });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível salvar no servidor agora. Os dados continuam neste aparelho e serão enviados de novo.' }); }
});

export default router;
