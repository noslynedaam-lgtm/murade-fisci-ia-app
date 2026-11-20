// Carteira fiscal do escritório: resultado guardado das consultas Integra Contador JÁ FEITAS (situação fiscal com PDF, Caixa Postal,
// parcelamentos), painel verde/vermelho, histórico, vencimento do certificado A1 e a conferência "rodar agora".
// Tudo aqui só LÊ o que já está guardado: nenhuma rota deste arquivo consulta o Serpro nem gasta crédito.
// Consultas novas continuam saindo só por clique da pessoa, pela rota /api/serpro/consulta (com cota, custo e liberação).
import { Router } from 'express';
import { obterUsuarioDaSessao } from './auth.routes';
import { comContextoTenant } from './persistence';
import { descriptografarSegredoEmpresa } from './encryption';
import { lerValidadeEmissorPfx } from './pfxCompat';
import { hojeBrasilia } from '../services/certidoes/certidoes';
import { NOME_MODALIDADE, faixaCertificado, mesAtualBrasilia, parcelasAtrasadas, resultadoParaGuardar, situacaoGeral, textoFaixaCertificado, type SituacaoFiscal } from '../services/serpro/carteiraFiscal';
import { lembretesQuePedemAtencao } from '../services/escritorio/dadosEscritorio';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAPEIS_CONSULTA = ['OWNER', 'ADMIN'];
const TIPOS = ['situacao_fiscal', 'caixa_postal_lista', 'caixa_postal_novas', 'parcelamento_pedidos', 'parcelamento_detalhe', 'parcelamento_parcelas'] as const;
const router = Router();

/**
 * Guarda o resultado de uma consulta que ACABOU de ser feita (chamado pela rota do Serpro, depois da resposta oficial).
 * Nulo = serviço que não é guardado. Falso = não foi possível guardar (a consulta em si continua válida).
 */
export async function guardarResultadoConsulta(p: { userId: string; tenantId: string; companyId: string; servico: string; dados: Record<string, string>; bruto: unknown; relatorio: unknown; cobrada: boolean }): Promise<boolean | null> {
  let r;
  try { r = resultadoParaGuardar(p.servico, p.dados, p.bruto, p.relatorio); } catch { return false; }
  if (!r) return null;
  try {
    const g = await comContextoTenant(p.userId, p.tenantId, async (c) => (await c.query(
      `INSERT INTO fiscoia.serpro_resultados (tenant_id, company_id, tipo, servico, modalidade, resumo, situacao, situacao_origem, novas_mensagens, pdf, cobrada, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [p.tenantId, p.companyId, r.tipo, p.servico, r.modalidade, JSON.stringify(r.resumo), r.situacao, r.situacaoOrigem, r.novasMensagens, r.pdf, p.cobrada, p.userId])).rows[0]?.id, PAPEIS_CONSULTA);
    return g.autorizado && 'resultado' in g && Boolean(g.resultado);
  } catch { return false; } finally { r.pdf?.fill(0); }
}

async function usuario(req: any, res: any, tenantId: string) {
  const user = await obterUsuarioDaSessao(req).catch(() => null);
  if (!user) { res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' }); return null; }
  if (!UUID.test(tenantId)) { res.status(400).json({ mensagem: 'Escritório inválido.' }); return null; }
  return user;
}

/** Preenche a validade dos certificados A1 guardados antes desta atualização (lida do próprio arquivo cifrado). Sem rede e sem custo. */
async function preencherValidadeCertificados(userId: string, tenantId: string): Promise<void> {
  await comContextoTenant(userId, tenantId, async (c) => {
    const q = await c.query(`SELECT company_id, pfx_ciphertext, pfx_nonce, pfx_auth_tag, encryption_key_version FROM fiscoia.company_fiscal_certificates WHERE tenant_id = $1 AND valid_until IS NULL LIMIT 25`, [tenantId]);
    for (const row of q.rows) {
      let segredo: Buffer | null = null;
      try {
        segredo = descriptografarSegredoEmpresa(tenantId, String(row.company_id), { ciphertext: row.pfx_ciphertext, nonce: row.pfx_nonce, authTag: row.pfx_auth_tag, keyVersion: String(row.encryption_key_version) });
        const d = JSON.parse(segredo.toString('utf8')) as { pfxBase64?: unknown; passphrase?: unknown };
        if (typeof d.pfxBase64 !== 'string' || typeof d.passphrase !== 'string') continue;
        const pfx = Buffer.from(d.pfxBase64, 'base64');
        const v = lerValidadeEmissorPfx(pfx, d.passphrase);
        pfx.fill(0);
        if (v?.validade) await c.query('UPDATE fiscoia.company_fiscal_certificates SET valid_until = $3::date WHERE tenant_id = $1 AND company_id = $2 AND valid_until IS NULL', [tenantId, row.company_id, v.validade]);
      } catch { /* certificado que não abre fica sem validade; o conferidor conta como "sem validade registrada" */ } finally { segredo?.fill(0); }
    }
  }, PAPEIS_CONSULTA).catch(() => undefined);
}

async function certificadosDoEscritorio(userId: string, tenantId: string) {
  await preencherValidadeCertificados(userId, tenantId);
  const r = await comContextoTenant(userId, tenantId, async (c) => (await c.query(
    `SELECT f.company_id, co.legal_name, co.cnpj, to_char(f.valid_until, 'YYYY-MM-DD') AS validade
       FROM fiscoia.company_fiscal_certificates f JOIN fiscoia.companies co ON co.id = f.company_id AND co.tenant_id = f.tenant_id AND co.archived_at IS NULL
      WHERE f.tenant_id = $1`, [tenantId])).rows);
  if (!r.autorizado) return null;
  const hoje = hojeBrasilia();
  return (r.resultado ?? []).map((x: any) => {
    const f = faixaCertificado(hoje, x.validade ?? null);
    return { companyId: String(x.company_id), empresa: String(x.legal_name), cnpj: String(x.cnpj), validade: x.validade ?? null, faixa: f?.faixa ?? null, dias: f?.dias ?? null, situacaoTexto: x.validade ? (f ? textoFaixaCertificado(f) : 'em dia (mais de 30 dias)') : 'validade não registrada: cadastre o certificado de novo' };
  });
}

/** Monta o painel da carteira: a última consulta guardada de cada tipo, por empresa. Sem custo. */
export async function montarCarteira(userId: string, tenantId: string) {
  const r = await comContextoTenant(userId, tenantId, async (c) => {
    const empresas = (await c.query('SELECT id, cnpj, legal_name FROM fiscoia.companies WHERE tenant_id = $1 AND archived_at IS NULL ORDER BY legal_name LIMIT 2000', [tenantId])).rows;
    const ult = (await c.query(
      `SELECT DISTINCT ON (company_id, tipo, COALESCE(modalidade, '')) id, company_id, tipo, modalidade, situacao, situacao_origem, novas_mensagens,
              CASE WHEN tipo IN ('parcelamento_parcelas', 'caixa_postal_lista') THEN resumo ELSE NULL END AS resumo, (pdf IS NOT NULL) AS tem_pdf, consultado_em
         FROM fiscoia.serpro_resultados WHERE tenant_id = $1 AND tipo IN ('situacao_fiscal', 'caixa_postal_novas', 'caixa_postal_lista', 'parcelamento_parcelas')
        ORDER BY company_id, tipo, COALESCE(modalidade, ''), consultado_em DESC`, [tenantId])).rows;
    return { empresas, ult };
  });
  if (!r.autorizado || !r.resultado) return null;
  const mes = mesAtualBrasilia();
  const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);
  const certs = new Map(((await certificadosDoEscritorio(userId, tenantId)) ?? []).map((c) => [c.companyId, c]));
  const linhas = r.resultado.empresas.map((e: any) => {
    const deste = r.resultado!.ult.filter((u: any) => String(u.company_id) === String(e.id));
    const sit = deste.find((u: any) => u.tipo === 'situacao_fiscal');
    const novas = deste.find((u: any) => u.tipo === 'caixa_postal_novas');
    const lista = deste.find((u: any) => u.tipo === 'caixa_postal_lista');
    const parc = deste.filter((u: any) => u.tipo === 'parcelamento_parcelas');
    const atrasadas = parc.flatMap((u: any) => parcelasAtrasadas(u.resumo?.parcelas, mes).map((a) => ({ ...a, modalidade: String(u.modalidade ?? ''), nomeModalidade: NOME_MODALIDADE[String(u.modalidade ?? '')] ?? String(u.modalidade ?? ''), consultadoEm: iso(u.consultado_em) })));
    const cert = certs.get(String(e.id)) ?? null;
    const situacaoFiscal = (sit?.situacao ?? null) as SituacaoFiscal | null;
    return {
      companyId: String(e.id), cnpj: String(e.cnpj), nome: String(e.legal_name),
      situacaoFiscal: sit ? { id: String(sit.id), situacao: situacaoFiscal, origem: sit.situacao_origem ?? null, temPdf: sit.tem_pdf === true, consultadoEm: iso(sit.consultado_em) } : null,
      caixaPostal: novas ? { novas: novas.novas_mensagens === null ? null : Number(novas.novas_mensagens), consultadoEm: iso(novas.consultado_em) } : null,
      caixaPostalLista: lista ? { quantidade: Number(lista.resumo?.quantidade ?? 0), naoLidas: Number(lista.resumo?.naoLidas ?? 0), consultadoEm: iso(lista.consultado_em) } : null,
      parcelamentos: parc.length ? { modalidades: parc.map((u: any) => String(u.modalidade ?? '')), atrasadas, consultadoEm: iso(parc.map((u: any) => u.consultado_em).sort().pop()) } : null,
      certificado: cert ? { validade: cert.validade, faixa: cert.faixa, dias: cert.dias, situacaoTexto: cert.situacaoTexto } : null,
      geral: situacaoGeral({ situacaoFiscal, novasMensagens: novas?.novas_mensagens ?? null, atrasadas: atrasadas.length }),
    };
  });
  const conta = (g: string) => linhas.filter((l) => l.geral === g).length;
  return { hoje: hojeBrasilia(), totais: { empresas: linhas.length, pendentes: conta('pendente'), atencao: conta('atencao'), regulares: conta('regular'), semConsulta: conta('sem_consulta') }, empresas: linhas };
}

// Painel da carteira (verde/vermelho), só com o que já foi consultado. Gratuito.
router.get('/carteira-fiscal', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.query.tenantId ?? '');
  const user = await usuario(req, res, tenantId); if (!user) return;
  try {
    const c = await montarCarteira(user.id, tenantId);
    if (!c) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    return res.json(c);
  } catch { return res.status(503).json({ mensagem: 'Não foi possível montar a carteira agora. Se o sistema acabou de ser atualizado, aguarde alguns minutos.' }); }
});

// Histórico guardado de UMA empresa (sem o PDF; o PDF abre pela rota própria). Filtra por grupo: situacao, caixa ou parcelamentos.
router.get('/carteira-fiscal/empresa', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.query.tenantId ?? ''); const companyId = String(req.query.companyId ?? '');
  const user = await usuario(req, res, tenantId); if (!user) return;
  if (!UUID.test(companyId)) return res.status(400).json({ mensagem: 'Empresa inválida.' });
  const grupo = String(req.query.grupo ?? '');
  const tipos = grupo === 'situacao' ? ['situacao_fiscal'] : grupo === 'caixa' ? ['caixa_postal_novas', 'caixa_postal_lista'] : grupo === 'parcelamentos' ? ['parcelamento_pedidos', 'parcelamento_detalhe', 'parcelamento_parcelas'] : [...TIPOS];
  try {
    const r = await comContextoTenant(user.id, tenantId, async (c) => {
      const e = (await c.query('SELECT legal_name, cnpj FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2', [companyId, tenantId])).rows[0];
      if (!e) return null;
      const linhas = (await c.query(`SELECT id, tipo, servico, modalidade, resumo, situacao, situacao_origem, novas_mensagens, (pdf IS NOT NULL) AS tem_pdf, cobrada, consultado_em, situacao_marcada_em
          FROM fiscoia.serpro_resultados WHERE tenant_id = $1 AND company_id = $2 AND tipo = ANY($3::text[]) ORDER BY consultado_em DESC LIMIT 60`, [tenantId, companyId, tipos])).rows;
      return { e, linhas };
    });
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!r.resultado) return res.status(404).json({ mensagem: 'Empresa não encontrada.' });
    const mes = mesAtualBrasilia();
    return res.json({
      empresa: { nome: String(r.resultado.e.legal_name), cnpj: String(r.resultado.e.cnpj) },
      resultados: r.resultado.linhas.map((x: any) => ({
        id: String(x.id), tipo: x.tipo, servico: x.servico, modalidade: x.modalidade, nomeModalidade: x.modalidade ? (NOME_MODALIDADE[x.modalidade] ?? x.modalidade) : null,
        resumo: x.resumo, situacao: x.situacao, origemSituacao: x.situacao_origem, novasMensagens: x.novas_mensagens, temPdf: x.tem_pdf === true, cobrada: x.cobrada === true,
        consultadoEm: new Date(x.consultado_em).toISOString(), marcadaEm: x.situacao_marcada_em ? new Date(x.situacao_marcada_em).toISOString() : null,
        ...(x.tipo === 'parcelamento_parcelas' ? { atrasadas: parcelasAtrasadas(x.resumo?.parcelas, mes) } : {}),
      })),
      observacao: 'Resultados guardados das consultas já feitas. Para dados de hoje, faça uma nova consulta (pode ter custo).',
    });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível ler o histórico guardado.' }); }
});

router.get('/carteira-fiscal/resultado/:id/pdf', async (req, res) => {
  const tenantId = String(req.query.tenantId ?? '');
  const user = await usuario(req, res, tenantId); if (!user) return;
  if (!UUID.test(req.params.id)) return res.status(400).json({ mensagem: 'Resultado inválido.' });
  try {
    const r = await comContextoTenant(user.id, tenantId, async (c) => (await c.query('SELECT pdf FROM fiscoia.serpro_resultados WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId])).rows[0]);
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!r.resultado?.pdf) return res.status(404).json({ mensagem: 'Este resultado não tem PDF guardado.' });
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'inline; filename="situacao-fiscal.pdf"'); res.setHeader('Cache-Control', 'no-store');
    return res.send(r.resultado.pdf);
  } catch { return res.status(503).json({ mensagem: 'Não foi possível abrir o PDF.' }); }
});

// A pessoa leu o PDF e marca regular ou pendente (fica registrado quem marcou e quando). Não consulta nada.
router.post('/carteira-fiscal/resultado/:id/marcar', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.body?.tenantId ?? '');
  const user = await usuario(req, res, tenantId); if (!user) return;
  if (!UUID.test(req.params.id)) return res.status(400).json({ mensagem: 'Resultado inválido.' });
  const situacao = req.body?.situacao;
  if (situacao !== 'regular' && situacao !== 'pendente') return res.status(400).json({ mensagem: 'Marque como regular ou pendente.' });
  try {
    const r = await comContextoTenant(user.id, tenantId, async (c) => (await c.query(
      `UPDATE fiscoia.serpro_resultados SET situacao = $3, situacao_origem = 'marcada_pela_pessoa', situacao_marcada_por = $4, situacao_marcada_em = now()
        WHERE id = $1 AND tenant_id = $2 AND tipo = 'situacao_fiscal'`, [req.params.id, tenantId, situacao, user.id])).rowCount);
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!r.resultado) return res.status(404).json({ mensagem: 'Situação fiscal guardada não encontrada.' });
    return res.json({ ok: true, situacao });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível salvar a marcação.' }); }
});

// Vencimento do certificado A1 das empresas (lido do próprio arquivo). Gratuito.
router.get('/certificados/vencendo', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.query.tenantId ?? '');
  const user = await usuario(req, res, tenantId); if (!user) return;
  try {
    const lista = await certificadosDoEscritorio(user.id, tenantId);
    if (!lista) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    const atencao = lista.filter((c) => c.faixa !== null || c.validade === null).sort((a, b) => (a.dias ?? 9999) - (b.dias ?? 9999));
    return res.json({ hoje: hojeBrasilia(), total: atencao.length, certificados: atencao, cadastrados: lista.length });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível conferir os certificados agora.' }); }
});

/**
 * "Rodar agora" dos conferidores para o escritório da pessoa: carteira (situação fiscal pendente, Caixa Postal com mensagens novas,
 * parcela atrasada), certificado A1 (30/15/7 dias) e Agenda Fiscal (vencidos e de hoje). Só lê o que está guardado; não gasta nada.
 */
router.post('/carteira-fiscal/conferir', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.body?.tenantId ?? '');
  const user = await usuario(req, res, tenantId); if (!user) return;
  try {
    const c = await montarCarteira(user.id, tenantId);
    if (!c) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    const ag = await comContextoTenant(user.id, tenantId, async (cl) => (await cl.query(`SELECT dados FROM fiscoia.dados_escritorio WHERE tenant_id = $1 AND colecao = 'agenda_lembretes'`, [tenantId])).rows.map((x: any) => x.dados));
    const agenda = lembretesQuePedemAtencao(ag.autorizado ? ag.resultado ?? [] : [], c.hoje);
    const alertas: string[] = [];
    for (const e of c.empresas) {
      if (e.situacaoFiscal?.situacao === 'pendente') alertas.push(`${e.nome}: situação fiscal com pendência (consulta de ${e.situacaoFiscal.consultadoEm?.slice(0, 10)}).`);
      if (e.situacaoFiscal?.situacao === 'a_conferir') alertas.push(`${e.nome}: situação fiscal guardada a conferir no PDF.`);
      if ((e.caixaPostal?.novas ?? 0) > 0) alertas.push(`${e.nome}: Caixa Postal com mensagem(ns) nova(s) na última consulta.`);
      for (const a of e.parcelamentos?.atrasadas ?? []) alertas.push(`${e.nome}: ${a.nomeModalidade}, parcela ${a.parcela} ainda disponível para emitir (indício de atraso; confira).`);
      if (e.certificado?.faixa) alertas.push(`${e.nome}: certificado A1 ${e.certificado.situacaoTexto}.`);
    }
    for (const l of agenda) alertas.push(`Agenda: ${l.empresa} — ${l.titulo}: ${l.dias < 0 ? `vencido há ${Math.abs(l.dias)} dia(s)` : 'vence hoje'}.`);
    return res.json({ conferidoEm: new Date().toISOString(), totais: c.totais, alertas, mensagem: alertas.length ? `${alertas.length} ponto(s) de atenção encontrados no que já está guardado.` : 'Tudo em ordem no que já está guardado. Empresas sem consulta guardada não entram nesta conferência.' });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível conferir agora.' }); }
});

export default router;
