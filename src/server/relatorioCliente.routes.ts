// Relatório para o cliente (PDF com o nome e o logo do escritório), conferência das tarefas da equipe e do DT-e de Goiás.
// Tudo aqui só LÊ o que já está guardado: nenhuma rota consulta o Serpro, a SEFAZ ou o DT-e, e nada gasta crédito.
// A Caixa Postal entra só pela lista já guardada (assunto e data); nenhuma mensagem é aberta.
import { Router } from 'express';
import { obterUsuarioDaSessao } from './auth.routes';
import { comContextoTenant } from './persistence';
import { ADAPTADORES, TIPOS_CERTIDAO, hojeBrasilia, type TipoCertidao } from '../services/certidoes/certidoes';
import { montarPainel, type CertidaoParaPainel } from '../services/certidoes/painelCertidoes';
import { NOME_MODALIDADE, diasAte, mesAtualBrasilia, parcelasAtrasadas } from '../services/serpro/carteiraFiscal';
import { lerConfigRelatorio, linkWhatsApp, montarRelatorioCliente, numeroWhatsApp, textoWhatsApp, type RelatorioCliente } from '../services/relatorio/relatorioCliente';
import { gerarPdfRelatorio } from '../services/relatorio/pdfRelatorio';
import { contarTarefas } from '../services/escritorio/tarefasEquipe';
import { CONTATO_DTE, GUIA_DTE, LINKS_DTE, POR_QUE_SEM_LEITURA_AUTOMATICA, pendenciasDoChecklist, resumoDte } from '../services/dte/dteGoias';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const router = Router();

async function usuario(req: any, res: any, tenantId: string) {
  const user = await obterUsuarioDaSessao(req).catch(() => null);
  if (!user) { res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' }); return null; }
  if (!UUID.test(tenantId)) { res.status(400).json({ mensagem: 'Escritório inválido.' }); return null; }
  return user;
}

type Montado = { relatorio: RelatorioCliente; logo: Buffer | null; telefoneEmpresa: string | null };
/** Junta, para UMA empresa, o que já está guardado e monta o relatório. Nulo = empresa não encontrada; false = sem acesso. */
export async function montarRelatorioDaEmpresa(userId: string, tenantId: string, companyId: string): Promise<Montado | null | false> {
  const r = await comContextoTenant(userId, tenantId, async (c) => {
    const emp = (await c.query(`SELECT id, cnpj, legal_name, state, municipality, metadata->>'telefone' AS telefone FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 AND archived_at IS NULL`, [companyId, tenantId])).rows[0];
    if (!emp) return null;
    const tenant = (await c.query('SELECT name FROM fiscoia.tenants WHERE id = $1', [tenantId])).rows[0];
    const ult = (await c.query(
      `SELECT DISTINCT ON (tipo, COALESCE(modalidade, '')) tipo, modalidade, situacao, novas_mensagens,
              CASE WHEN tipo IN ('parcelamento_parcelas', 'caixa_postal_lista') THEN resumo ELSE NULL END AS resumo, consultado_em
         FROM fiscoia.serpro_resultados WHERE tenant_id = $1 AND company_id = $2 AND tipo IN ('situacao_fiscal', 'caixa_postal_novas', 'caixa_postal_lista', 'parcelamento_parcelas')
        ORDER BY tipo, COALESCE(modalidade, ''), consultado_em DESC`, [tenantId, companyId])).rows;
    const cert = (await c.query(`SELECT DISTINCT ON (tipo, situacao IN ('emitida','registrada_manualmente')) id, company_id, tipo, situacao, resultado, numero, origem, to_char(emissao,'YYYY-MM-DD') AS emissao, to_char(validade,'YYYY-MM-DD') AS validade, created_at
        FROM fiscoia.certidoes WHERE tenant_id = $1 AND company_id = $2 ORDER BY tipo, situacao IN ('emitida','registrada_manualmente'), created_at DESC`, [tenantId, companyId])).rows;
    const a1 = (await c.query(`SELECT to_char(valid_until, 'YYYY-MM-DD') AS validade FROM fiscoia.company_fiscal_certificates WHERE tenant_id = $1 AND company_id = $2`, [tenantId, companyId])).rows[0];
    const cfg = (await c.query(`SELECT dados FROM fiscoia.dados_escritorio WHERE tenant_id = $1 AND colecao = 'relatorio_cliente' AND chave = 'config'`, [tenantId])).rows[0];
    return { emp, tenant, ult, cert, a1, cfg };
  });
  if (!r.autorizado) return false;
  if (!r.resultado) return null;
  const { emp, tenant, ult, cert, a1, cfg } = r.resultado;
  const hoje = hojeBrasilia();
  const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);
  const config = lerConfigRelatorio(cfg?.dados);
  const sit = ult.find((u: any) => u.tipo === 'situacao_fiscal');
  const novas = ult.find((u: any) => u.tipo === 'caixa_postal_novas');
  const lista = ult.find((u: any) => u.tipo === 'caixa_postal_lista');
  const parc = ult.filter((u: any) => u.tipo === 'parcelamento_parcelas');
  const mes = mesAtualBrasilia();
  const certidoes: CertidaoParaPainel[] = cert.map((x: any) => ({ id: String(x.id), companyId: String(x.company_id), tipo: x.tipo, situacao: x.situacao, resultado: x.resultado ?? null, numero: x.numero ?? null, emissao: x.emissao ?? null, validade: x.validade ?? null, origem: x.origem, criadaEm: new Date(x.created_at).toISOString() }));
  const painel = montarPainel([{ id: String(emp.id), nome: String(emp.legal_name), cnpj: String(emp.cnpj), uf: emp.state ?? null, municipio: emp.municipality ?? null }], certidoes, hoje);
  const linhaCert = painel.linhas[0];
  const mensagens: any[] = Array.isArray(lista?.resumo?.mensagens) ? lista.resumo.mensagens : [];
  const relatorio = montarRelatorioCliente({
    hoje,
    escritorio: { nome: config.nomeExibido ?? String(tenant?.name ?? 'Escritório de contabilidade'), telefone: config.telefone, email: config.email, rodape: config.rodape },
    empresa: { nome: String(emp.legal_name), cnpj: String(emp.cnpj) },
    situacaoFiscal: sit ? { situacao: sit.situacao ?? null, consultadoEm: iso(sit.consultado_em) } : null,
    caixaPostal: novas ? { novas: novas.novas_mensagens === null ? null : Number(novas.novas_mensagens), consultadoEm: iso(novas.consultado_em) } : null,
    caixaLista: lista ? { quantidade: Number(lista.resumo?.quantidade ?? 0), naoLidas: Number(lista.resumo?.naoLidas ?? 0), consultadoEm: iso(lista.consultado_em),
      naoLidasAssuntos: mensagens.filter((m) => m && m.lida === false).map((m) => ({ assunto: String(m.assunto ?? '').slice(0, 160), enviadaEm: String(m.enviadaEm ?? '') })) } : null,
    parcelamentos: parc.length ? { modalidades: parc.map((u: any) => NOME_MODALIDADE[String(u.modalidade ?? '')] ?? String(u.modalidade ?? '')),
      atrasadas: parc.flatMap((u: any) => parcelasAtrasadas(u.resumo?.parcelas, mes).map((a) => ({ ...a, nomeModalidade: NOME_MODALIDADE[String(u.modalidade ?? '')] ?? String(u.modalidade ?? '') }))),
      consultadoEm: iso(parc.map((u: any) => u.consultado_em).sort().pop()) } : null,
    certidoes: TIPOS_CERTIDAO.map((t: TipoCertidao) => ({ tipo: t, rotulo: ADAPTADORES[t].rotulo, cor: linhaCert.certidoes[t].cor, texto: linhaCert.certidoes[t].texto, validade: linhaCert.certidoes[t].validade })),
    certificado: a1 ? { validade: a1.validade ?? null, dias: a1.validade ? diasAte(hoje, a1.validade) : null } : null,
  });
  let logo: Buffer | null = null;
  if (config.logoJpegBase64) { try { logo = Buffer.from(config.logoJpegBase64, 'base64'); } catch { logo = null; } }
  return { relatorio, logo, telefoneEmpresa: emp.telefone ? String(emp.telefone) : null };
}

// Prévia do relatório (o que vai no PDF), pendências para virar tarefa e o texto do WhatsApp. Gratuito.
router.get('/relatorio-cliente', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.query.tenantId ?? ''); const companyId = String(req.query.companyId ?? '');
  const user = await usuario(req, res, tenantId); if (!user) return;
  if (!UUID.test(companyId)) return res.status(400).json({ mensagem: 'Empresa inválida.' });
  try {
    const m = await montarRelatorioDaEmpresa(user.id, tenantId, companyId);
    if (m === false) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!m) return res.status(404).json({ mensagem: 'Empresa não encontrada.' });
    const texto = textoWhatsApp(m.relatorio);
    const numero = numeroWhatsApp(m.telefoneEmpresa);
    return res.json({ relatorio: m.relatorio, temLogo: Boolean(m.logo), whatsapp: { numero, texto, link: linkWhatsApp(numero, texto) }, observacao: 'Feito com as consultas já guardadas; nenhuma consulta nova foi feita.' });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível montar o relatório agora. Se o sistema acabou de ser atualizado, aguarde alguns minutos.' }); }
});

// O PDF do relatório, para baixar ou compartilhar. Gratuito.
router.get('/relatorio-cliente/pdf', async (req, res) => {
  const tenantId = String(req.query.tenantId ?? ''); const companyId = String(req.query.companyId ?? '');
  const user = await usuario(req, res, tenantId); if (!user) return;
  if (!UUID.test(companyId)) return res.status(400).json({ mensagem: 'Empresa inválida.' });
  try {
    const m = await montarRelatorioDaEmpresa(user.id, tenantId, companyId);
    if (m === false) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!m) return res.status(404).json({ mensagem: 'Empresa não encontrada.' });
    const pdf = gerarPdfRelatorio(m.relatorio, m.logo);
    const nome = `relatorio-fiscal-${m.relatorio.empresa.cnpj.replace(/[^A-Za-z0-9]/g, '')}-${m.relatorio.hoje}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${req.query.baixar === '1' ? 'attachment' : 'inline'}; filename="${nome}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(pdf);
  } catch { return res.status(503).json({ mensagem: 'Não foi possível gerar o PDF agora.' }); }
});

/** Lê tarefas e checklist do DT-e do escritório e as empresas de Goiás. */
async function lerTarefasEDte(userId: string, tenantId: string) {
  return comContextoTenant(userId, tenantId, async (c) => {
    const empresas = (await c.query(`SELECT id, cnpj, legal_name, state FROM fiscoia.companies WHERE tenant_id = $1 AND archived_at IS NULL ORDER BY legal_name LIMIT 2000`, [tenantId])).rows;
    const itens = (await c.query(`SELECT colecao, chave, dados FROM fiscoia.dados_escritorio WHERE tenant_id = $1 AND colecao IN ('tarefas_equipe', 'dte_go') LIMIT 20000`, [tenantId])).rows;
    return { empresas, itens };
  });
}

// Guia oficial do DT-e de Goiás e o checklist de cada empresa. Não entra no DT-e.
router.get('/dte-goias', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.query.tenantId ?? '');
  const user = await usuario(req, res, tenantId); if (!user) return;
  try {
    const r = await lerTarefasEDte(user.id, tenantId);
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    const empresas = (r.resultado?.empresas ?? []).map((e: any) => ({ id: String(e.id), cnpj: String(e.cnpj), nome: String(e.legal_name), uf: e.state ? String(e.state).trim().toUpperCase() : null }));
    const checklists = (r.resultado?.itens ?? []).filter((i: any) => i.colecao === 'dte_go').map((i: any) => i.dados);
    const ativos = new Set(empresas.map((e) => e.id));
    return res.json({
      hoje: hojeBrasilia(), guia: GUIA_DTE, porQueSemLeituraAutomatica: POR_QUE_SEM_LEITURA_AUTOMATICA, links: LINKS_DTE, contato: CONTATO_DTE,
      empresas, checklists: checklists.filter((c: any) => ativos.has(String(c?.empresaId))),
      resumo: resumoDte(empresas.filter((e) => e.uf === 'GO'), checklists, hojeBrasilia()),
    });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível ler o checklist do DT-e agora.' }); }
});

/** "Rodar agora" do conferidor de tarefas e DT-e para o escritório da pessoa. Só lê. */
router.post('/tarefas-dte/conferir', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.body?.tenantId ?? '');
  const user = await usuario(req, res, tenantId); if (!user) return;
  try {
    const r = await lerTarefasEDte(user.id, tenantId);
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    const hoje = hojeBrasilia();
    const empresas = r.resultado?.empresas ?? [];
    const nomes = new Map(empresas.map((e: any) => [String(e.id), String(e.legal_name)]));
    const tarefas = (r.resultado?.itens ?? []).filter((i: any) => i.colecao === 'tarefas_equipe').map((i: any) => i.dados);
    const checklists = (r.resultado?.itens ?? []).filter((i: any) => i.colecao === 'dte_go').map((i: any) => i.dados).filter((c: any) => nomes.has(String(c?.empresaId)));
    const t = contarTarefas(tarefas, hoje);
    const alertas: string[] = [];
    for (const x of tarefas) if (x && x.concluida !== true && typeof x.prazo === 'string' && x.prazo < hoje) alertas.push(`Tarefa atrasada (prazo ${x.prazo.split('-').reverse().join('/')}): ${x.titulo}${x.empresa ? ` — ${x.empresa}` : ''}.`);
    for (const c of checklists) {
      for (const p of pendenciasDoChecklist(c)) if (p.situacao === 'nao_tem') alertas.push(`DT-e Goiás: ${nomes.get(String(c.empresaId))} — ${p.rotulo}: não tem.`);
      if (typeof c.revisarEm === 'string' && c.revisarEm <= hoje) alertas.push(`DT-e Goiás: ${nomes.get(String(c.empresaId))} — lembrete de conferir a caixa do DT-e (${c.revisarEm.split('-').reverse().join('/')}).`);
    }
    const go = empresas.filter((e: any) => String(e.state ?? '').trim().toUpperCase() === 'GO').map((e: any) => ({ id: String(e.id) }));
    const resumo = resumoDte(go, checklists, hoje);
    if (resumo.semResposta) alertas.push(`DT-e Goiás: ${resumo.semResposta} empresa(s) de Goiás com o checklist ainda sem resposta.`);
    return res.json({ conferidoEm: new Date().toISOString(), tarefas: t, dte: resumo, alertas, mensagem: alertas.length ? `${alertas.length} ponto(s) de atenção.` : 'Tudo em ordem: nenhuma tarefa atrasada e nada faltando no DT-e.' });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível conferir agora.' }); }
});

export default router;
