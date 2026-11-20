// Certidões (CND) por empresa: consulta (hoje só a federal tem consulta automática), registro manual, histórico, vencimentos.
// Consulta paga SÓ por clique da pessoa (nunca por robô), com a mesma trava de liberação do dono do sistema usada nas consultas ao Serpro.
import { Router } from 'express';
import https from 'node:https';
import { obterUsuarioDaSessao } from './auth.routes';
import { comContextoTenant, obterPoolBanco } from './persistence';
import { empresaLiberada, infoDoEscritorio, pedirLiberacao } from './serpro.routes';
import { decidirAcessoConsulta, type DecisaoAcesso } from '../services/serpro/acessoConsulta';
import { decidirLiberacaoEmpresa } from '../services/serpro/liberacaoEmpresa';
import { ADAPTADORES, ROTULO_RESULTADO, TIPOS_CERTIDAO, certidoesQueRequeremAtencao, ehResultadoCertidao, ehTipoCertidao, hojeBrasilia, portalDaCertidao, textoDaFaixa, validarRegistroManual, type CertidaoGuardada, type SituacaoCertidao, type TipoCertidao } from '../services/certidoes/certidoes';
import { PDF_MAX_BYTES, lerCertidaoDoPdf } from '../services/certidoes/leituraPdfCertidao';
import { TIPOS_SEMIAUTOMATICOS, montarPainel, type CertidaoParaPainel, type EmpresaParaPainel } from '../services/certidoes/painelCertidoes';
import { consultarCndFederal, lerConfigCnd, type ChamadaHttp } from '../services/certidoes/consultaCndFederal';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAPEIS_CONSULTA = ['OWNER', 'ADMIN'];
const router = Router();

/** Chamada HTTPS real, só para o Serpro (a lista de hosts já foi validada em lerConfigCnd). */
const httpReal: ChamadaHttp = ({ url, metodo, cabecalhos, corpo }) => new Promise((resolve, reject) => {
  const u = new URL(url);
  const req = https.request({ method: metodo, hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, headers: { ...cabecalhos, 'Content-Length': Buffer.byteLength(corpo) }, timeout: 25_000 }, (r) => {
    const partes: Buffer[] = []; r.on('data', (c) => partes.push(c)); r.on('end', () => resolve({ status: r.statusCode ?? 0, texto: Buffer.concat(partes).toString('utf8') }));
  });
  req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', reject); req.end(corpo);
});
/** Permite testar o roteamento sem chamar o Serpro. */
export const dependencias = { http: httpReal as ChamadaHttp, env: process.env as Record<string, string | undefined> };

const linhaParaTela = (x: any) => ({
  id: String(x.id), companyId: String(x.company_id), tipo: x.tipo as TipoCertidao, uf: x.uf ?? null, municipio: x.municipio ?? null, origem: x.origem, situacao: x.situacao as SituacaoCertidao,
  numero: x.numero ?? null, emissao: x.emissao ? new Date(x.emissao).toISOString().slice(0, 10) : null, validade: x.validade ? new Date(x.validade).toISOString().slice(0, 10) : null,
  resultado: x.resultado ?? null, mensagem: x.mensagem ?? null, resultadoOrgao: x.resultado_orgao ?? null, codigoTipoOrgao: x.codigo_tipo_orgao ?? null, observacao: x.observacao ?? null, cobrada: x.cobrada === true, temPdf: x.tem_pdf === true, criadaEm: new Date(x.created_at).toISOString(),
});
// Datas do tipo date voltam do driver como Date à meia-noite LOCAL; por isso a leitura é feita como texto no SQL.
const COLUNAS = `id, company_id, tipo, uf, municipio, origem, situacao, resultado, numero, to_char(emissao,'YYYY-MM-DD') AS emissao, to_char(validade,'YYYY-MM-DD') AS validade, mensagem, resultado_orgao, codigo_tipo_orgao, observacao, cobrada, (pdf IS NOT NULL) AS tem_pdf, created_at`;

async function usuarioDoEscritorio(req: any, res: any, tenantId: string) {
  const user = await obterUsuarioDaSessao(req).catch(() => null);
  if (!user) { res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' }); return null; }
  if (!UUID.test(tenantId)) { res.status(400).json({ mensagem: 'Escritório inválido.' }); return null; }
  return user;
}

// Como cada tipo é obtido (para a tela montar os botões) e se a consulta automática está configurada neste servidor.
router.get('/certidoes/tipos', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const user = await obterUsuarioDaSessao(req).catch(() => null);
  if (!user) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
  return res.json({ tipos: TIPOS_CERTIDAO.map((t) => ADAPTADORES[t]), federalConfigurada: lerConfigCnd(dependencias.env) !== null });
});

router.get('/certidoes', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.query.tenantId ?? '');
  const user = await usuarioDoEscritorio(req, res, tenantId); if (!user) return;
  const companyId = req.query.companyId ? String(req.query.companyId) : null;
  if (companyId && !UUID.test(companyId)) return res.status(400).json({ mensagem: 'Empresa inválida.' });
  try {
    const r = await comContextoTenant(user.id, tenantId, async (c) => (await c.query(`SELECT ${COLUNAS} FROM fiscoia.certidoes WHERE tenant_id = $1 AND ($2::uuid IS NULL OR company_id = $2) ORDER BY created_at DESC LIMIT 500`, [tenantId, companyId])).rows);
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    return res.json({ certidoes: (r.resultado ?? []).map(linhaParaTela) });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível ler as certidões guardadas. Nada foi apagado.' }); }
});

/** Vencidas e vencendo em 30/15/7 dias (só a mais recente de cada empresa + tipo). Gratuito: só lê o que já está guardado. */
async function vencendoDoEscritorio(userId: string, tenantId: string) {
  const r = await comContextoTenant(userId, tenantId, async (c) => (await c.query(`SELECT c.id, c.company_id, co.legal_name AS empresa, c.tipo, c.uf, c.municipio, c.situacao, c.numero, to_char(c.emissao,'YYYY-MM-DD') AS emissao, to_char(c.validade,'YYYY-MM-DD') AS validade, c.created_at
      FROM fiscoia.certidoes c JOIN fiscoia.companies co ON co.id = c.company_id AND co.tenant_id = c.tenant_id AND co.archived_at IS NULL WHERE c.tenant_id = $1 ORDER BY c.created_at DESC LIMIT 2000`, [tenantId])).rows);
  if (!r.autorizado) return null;
  const lista: CertidaoGuardada[] = (r.resultado ?? []).map((x: any) => ({ id: String(x.id), companyId: String(x.company_id), empresa: String(x.empresa), tipo: x.tipo, uf: x.uf, municipio: x.municipio, situacao: x.situacao, numero: x.numero, emissao: x.emissao, validade: x.validade, criadaEm: new Date(x.created_at).toISOString() }));
  const hoje = hojeBrasilia();
  return certidoesQueRequeremAtencao(lista, hoje).map((c) => ({ id: c.id, companyId: c.companyId, empresa: c.empresa, tipo: c.tipo, rotuloTipo: ADAPTADORES[c.tipo].rotulo, uf: c.uf, municipio: c.municipio, numero: c.numero, validade: c.validade, faixa: c.faixa, dias: c.dias, situacaoTexto: textoDaFaixa(c.faixa, c.dias) }));
}
router.get('/certidoes/vencendo', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.query.tenantId ?? '');
  const user = await usuarioDoEscritorio(req, res, tenantId); if (!user) return;
  try {
    const v = await vencendoDoEscritorio(user.id, tenantId);
    if (!v) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    return res.json({ hoje: hojeBrasilia(), total: v.length, certidoes: v });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível conferir os vencimentos agora.' }); }
});
// "Rodar agora" do conferidor de vencimento: igual à rotina do robô, para o escritório do usuário. Só lê.
router.post('/certidoes/conferir-vencimentos', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.body?.tenantId ?? '');
  const user = await usuarioDoEscritorio(req, res, tenantId); if (!user) return;
  try {
    const v = await vencendoDoEscritorio(user.id, tenantId);
    if (!v) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    const vencidas = v.filter((x) => x.faixa === 'vencida').length;
    return res.json({ conferidoEm: new Date().toISOString(), total: v.length, vencidas, certidoes: v, mensagem: v.length === 0 ? 'Nenhuma certidão guardada vencida ou vencendo nos próximos 30 dias.' : `${vencidas} vencida(s) e ${v.length - vencidas} vencendo nos próximos 30 dias.` });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível conferir os vencimentos agora.' }); }
});

router.post('/certidoes/manual', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.body?.tenantId ?? ''); const companyId = String(req.body?.companyId ?? '');
  const user = await usuarioDoEscritorio(req, res, tenantId); if (!user) return;
  if (!UUID.test(companyId)) return res.status(400).json({ mensagem: 'Empresa inválida.' });
  const v = validarRegistroManual(req.body ?? {});
  if (v.ok === false) return res.status(400).json({ mensagem: v.mensagem });
  const d = v.valor;
  try {
    const r = await comContextoTenant(user.id, tenantId, async (c) => {
      const ok = await c.query('SELECT 1 FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 AND archived_at IS NULL', [companyId, tenantId]);
      if (!ok.rows[0]) return null;
      return (await c.query(`INSERT INTO fiscoia.certidoes (tenant_id, company_id, tipo, uf, municipio, origem, situacao, numero, emissao, validade, resultado_orgao, observacao, criado_por)
        VALUES ($1,$2,$3,$4,$5,'manual','registrada_manualmente',$6,$7,$8,$9,$10,$11) RETURNING ${COLUNAS}`, [tenantId, companyId, d.tipo, d.uf, d.municipio, d.numero, d.emissao, d.validade, d.resultadoOrgao, d.obs, user.id])).rows[0];
    });
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!r.resultado) return res.status(404).json({ mensagem: 'Empresa não encontrada.' });
    return res.status(201).json({ certidao: linhaParaTela(r.resultado) });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível guardar o registro.' }); }
});

router.get('/certidoes/:id/pdf', async (req, res) => {
  const tenantId = String(req.query.tenantId ?? '');
  const user = await usuarioDoEscritorio(req, res, tenantId); if (!user) return;
  if (!UUID.test(req.params.id)) return res.status(400).json({ mensagem: 'Certidão inválida.' });
  try {
    const r = await comContextoTenant(user.id, tenantId, async (c) => (await c.query('SELECT pdf FROM fiscoia.certidoes WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId])).rows[0]);
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!r.resultado?.pdf) return res.status(404).json({ mensagem: 'Esta certidão não tem PDF guardado.' });
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'inline; filename="certidao.pdf"'); res.setHeader('Cache-Control', 'no-store');
    return res.send(r.resultado.pdf);
  } catch { return res.status(503).json({ mensagem: 'Não foi possível abrir o PDF.' }); }
});

// Exclusão: UMA certidão por vez e com DUAS confirmações (a tela pede as duas). Só apaga o registro; nunca bloqueia CNPJ nem e-mail.
router.post('/certidoes/:id/excluir', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.body?.tenantId ?? '');
  const user = await usuarioDoEscritorio(req, res, tenantId); if (!user) return;
  if (!UUID.test(req.params.id)) return res.status(400).json({ mensagem: 'Certidão inválida.' });
  if (req.body?.confirmou !== true || req.body?.confirmouDeNovo !== true) return res.status(409).json({ mensagem: 'Para excluir, confirme duas vezes. Nada foi apagado.' });
  try {
    const r = await comContextoTenant(user.id, tenantId, async (c) => (await c.query('DELETE FROM fiscoia.certidoes WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId])).rowCount, PAPEIS_CONSULTA);
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!('resultado' in r)) return res.status(403).json({ mensagem: 'Somente proprietário ou administrador exclui certidões.' });
    return res.json({ excluida: (r.resultado ?? 0) > 0 });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível excluir agora. Nada foi apagado.' }); }
});

/** Consulta pelo órgão. Federal: Serpro "Consulta CND" (PAGA, só por clique, com confirmação de custo e trava de liberação). Outros: devolve "manual" + portal. */
router.post('/certidoes/consultar', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.body?.tenantId ?? ''); const companyId = String(req.body?.companyId ?? '');
  const user = await usuarioDoEscritorio(req, res, tenantId); if (!user) return;
  const tipo = req.body?.tipo;
  if (!ehTipoCertidao(tipo)) return res.status(400).json({ consultado: false, mensagem: 'Tipo de certidão inválido.' });
  const ad = ADAPTADORES[tipo];
  if (ad.modo !== 'automatica_paga') return res.status(200).json({ consultado: false, manual: true, portal: ad.portalOficial, mensagem: `${ad.rotulo}: ${ad.como} Nada foi consultado nem cobrado.` });
  if (!UUID.test(companyId)) return res.status(400).json({ consultado: false, mensagem: 'Empresa inválida.' });

  // Mesmas regras de acesso da consulta ao Serpro: dono do sistema, ou dono/administrador do próprio escritório com CNPJ cadastrado.
  let decisao: DecisaoAcesso;
  if (user.ehAdmin) decisao = decidirAcessoConsulta({ ehAdmin: true, tenantId, vinculado: true, info: null });
  else {
    try {
      const vinculo = await comContextoTenant(user.id, tenantId, async () => true, PAPEIS_CONSULTA);
      decisao = decidirAcessoConsulta({ ehAdmin: false, tenantId, vinculado: vinculo.autorizado, info: vinculo.autorizado ? await infoDoEscritorio(tenantId) : null });
    } catch { return res.status(503).json({ consultado: false, mensagem: 'Falha ao validar o escritório. Nada foi consultado nem cobrado.' }); }
  }
  if (decisao.ok === false) return res.status(decisao.http).json({ consultado: false, mensagem: decisao.mensagem });
  const escritorio = decisao.escritorio;

  try {
    const emp = await comContextoTenant(user.id, tenantId, async (c) => (await c.query('SELECT cnpj, legal_name FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 AND archived_at IS NULL', [companyId, tenantId])).rows[0], PAPEIS_CONSULTA);
    if (!emp.autorizado) return res.status(403).json({ consultado: false, mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!('resultado' in emp)) return res.status(403).json({ consultado: false, mensagem: 'Somente proprietário ou administrador pode fazer consultas oficiais.' });
    if (!emp.resultado) return res.status(404).json({ consultado: false, mensagem: 'Empresa não encontrada.' });
    const cnpj = String(emp.resultado.cnpj).replace(/\D/g, '');
    if (cnpj.length !== 14) return res.status(400).json({ consultado: false, mensagem: 'O CNPJ desta empresa está incompleto. Nada foi consultado nem cobrado.' });

    // Trava de liberação do dono do sistema (empresa por empresa, ou escritório inteiro): sem liberação, nada é consultado.
    const lib = decidirLiberacaoEmpresa({ exigirLiberacao: !user.ehAdmin && Boolean(escritorio), liberada: !user.ehAdmin && Boolean(escritorio) ? await empresaLiberada(companyId) : true });
    if (lib.ok === false) {
      if (lib.bloqueadaPorLiberacao) await pedirLiberacao(companyId);
      return res.status(lib.http).json({ consultado: false, bloqueadaPorLiberacao: lib.bloqueadaPorLiberacao, mensagem: lib.mensagem });
    }
    const config = lerConfigCnd(dependencias.env);
    if (!config) return res.status(503).json({ consultado: false, naoConfigurada: true, mensagem: 'A consulta automática da CND federal ainda não foi contratada/configurada neste servidor (produto "Consulta CND" do Serpro). Nada foi consultado nem cobrado. Emita pelo portal da Receita.', portal: ad.portalOficial });
    if (req.body?.confirmarCusto !== true) return res.status(402).json({ consultado: false, exigeConfirmacao: true, mensagem: 'Esta consulta é PAGA pelo Serpro (produto "Consulta CND", cobrada por consulta conforme o contrato). Confirme para consultar a CND federal desta empresa agora. Nada foi consultado nem cobrado ainda.' });

    // Chave de consulta demorada ainda válida (1 hora)? Reaproveita sem abrir consulta nova.
    const aberta = await comContextoTenant(user.id, tenantId, async (c) => (await c.query(`SELECT chave_consulta FROM fiscoia.certidoes WHERE tenant_id = $1 AND company_id = $2 AND tipo = 'federal' AND situacao = 'em_processamento' AND chave_consulta IS NOT NULL AND created_at > now() - interval '55 minutes' ORDER BY created_at DESC LIMIT 1`, [tenantId, companyId])).rows[0], PAPEIS_CONSULTA);
    const chaveAnterior = aberta.autorizado && 'resultado' in aberta ? (aberta.resultado?.chave_consulta ?? null) : null;

    const out = await consultarCndFederal({ cnpj, config, http: dependencias.http, chaveAnterior });
    const pdf = out.pdfBase64 ? Buffer.from(out.pdfBase64, 'base64') : null;
    const pdfOk = pdf && pdf.length > 0 && pdf.length <= 3_145_728 && pdf.subarray(0, 4).toString('latin1') === '%PDF' ? pdf : null;
    const gravado = await comContextoTenant(user.id, tenantId, async (c) => (await c.query(`INSERT INTO fiscoia.certidoes (tenant_id, company_id, tipo, uf, origem, situacao, numero, emissao, validade, mensagem, codigo_tipo_orgao, chave_consulta, cobrada, pdf, criado_por)
        VALUES ($1,$2,'federal',NULL,'consulta_serpro',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${COLUNAS}`, [tenantId, companyId, out.situacao, out.numero, out.emissao, out.validade, out.mensagem.slice(0, 400), out.codigoTipoCertidao, out.chave, out.cobrada, pdfOk, user.id])).rows[0], PAPEIS_CONSULTA);
    const certidao = gravado.autorizado && 'resultado' in gravado && gravado.resultado ? linhaParaTela(gravado.resultado) : null;
    console.log(`[certidoes] consulta federal: situacao=${out.situacao} cobrada=${out.cobrada}`);
    return res.status(200).json({ consultado: out.cobrada || out.statusOrgao !== null, situacao: out.situacao, mensagem: out.mensagem, cobrada: out.cobrada, certidao, guardada: certidao !== null, aviso: certidao ? undefined : 'A consulta foi feita, mas não foi possível guardar o resultado. Confira no Serpro antes de repetir.' });
  } catch { return res.status(503).json({ consultado: false, mensagem: 'Falha ao consultar. Nenhum dado foi inventado; confira o extrato do Serpro antes de repetir.' }); }
});

// ---------------------------------------------------------------------------------------------------------------------------
// Certidões SEMIAUTOMÁTICAS (estadual, municipal, CRF do FGTS, CNDT): a pessoa emite no portal e solta o PDF; o sistema lê e propõe.
// A CND federal NÃO passa por aqui (segue na consulta própria acima).
// ---------------------------------------------------------------------------------------------------------------------------
function pdfDoCorpo(v: unknown): Buffer | null {
  if (typeof v !== 'string' || v.length < 20 || v.length > Math.ceil(PDF_MAX_BYTES / 3) * 4 + 8) return null;
  const b = Buffer.from(v.replace(/^data:application\/pdf;base64,/, ''), 'base64');
  return b.length > 0 && b.length <= PDF_MAX_BYTES && b.subarray(0, 5).toString('latin1') === '%PDF-' ? b : null;
}
async function empresaDoEscritorio(userId: string, tenantId: string, companyId: string) {
  return comContextoTenant(userId, tenantId, async (c) => (await c.query('SELECT id, cnpj, legal_name, state, municipality FROM fiscoia.companies WHERE id = $1 AND tenant_id = $2 AND archived_at IS NULL', [companyId, tenantId])).rows[0] ?? null);
}

/** Lê o PDF solto pela pessoa e PROPÕE os campos. Não guarda nada. */
router.post('/certidoes/ler-pdf', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.body?.tenantId ?? ''); const companyId = String(req.body?.companyId ?? '');
  const user = await usuarioDoEscritorio(req, res, tenantId); if (!user) return;
  if (!UUID.test(companyId)) return res.status(400).json({ mensagem: 'Empresa inválida.' });
  const tipo = req.body?.tipo;
  if (!ehTipoCertidao(tipo) || !TIPOS_SEMIAUTOMATICOS.includes(tipo)) return res.status(400).json({ mensagem: 'Escolha a certidão estadual, municipal, CRF do FGTS ou CNDT. A CND federal segue pela consulta própria.' });
  const pdf = pdfDoCorpo(req.body?.pdfBase64);
  if (!pdf) return res.status(400).json({ mensagem: 'Arquivo inválido: solte o PDF da certidão (até 3 MB).' });
  try {
    const emp = await empresaDoEscritorio(user.id, tenantId, companyId);
    if (!emp.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!emp.resultado) return res.status(404).json({ mensagem: 'Empresa não encontrada.' });
    const leitura = lerCertidaoDoPdf(tipo, pdf, { cnpjEsperado: String(emp.resultado.cnpj), uf: emp.resultado.state });
    return res.json({ leitura, rotuloResultado: leitura.resultado ? ROTULO_RESULTADO[leitura.resultado] : null });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível ler o PDF agora. Preencha os campos olhando o documento.' }); }
});

/** Guarda a certidão do PDF depois que a pessoa CONFERIU os campos. O PDF é lido de novo aqui para conferir o CNPJ. */
router.post('/certidoes/importar-pdf', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.body?.tenantId ?? ''); const companyId = String(req.body?.companyId ?? '');
  const user = await usuarioDoEscritorio(req, res, tenantId); if (!user) return;
  if (!UUID.test(companyId)) return res.status(400).json({ mensagem: 'Empresa inválida.' });
  const tipo = req.body?.tipo;
  if (!ehTipoCertidao(tipo) || !TIPOS_SEMIAUTOMATICOS.includes(tipo)) return res.status(400).json({ mensagem: 'Escolha a certidão estadual, municipal, CRF do FGTS ou CNDT.' });
  if (req.body?.confirmou !== true) return res.status(409).json({ mensagem: 'Confira os campos e confirme para guardar. Nada foi guardado.' });
  const pdf = pdfDoCorpo(req.body?.pdfBase64);
  if (!pdf) return res.status(400).json({ mensagem: 'Arquivo inválido: solte o PDF da certidão (até 3 MB).' });
  const resultado = req.body?.resultado;
  if (!ehResultadoCertidao(resultado)) return res.status(400).json({ mensagem: 'Escolha a situação: negativa, positiva com efeito de negativa ou positiva.' });
  const v = validarRegistroManual({ tipo, numero: req.body?.numero, emissao: req.body?.emissao, validade: req.body?.validade, uf: req.body?.uf, municipio: req.body?.municipio, obs: req.body?.obs, resultadoOrgao: ROTULO_RESULTADO[resultado] });
  if (v.ok === false) return res.status(400).json({ mensagem: v.mensagem });
  try {
    const emp = await empresaDoEscritorio(user.id, tenantId, companyId);
    if (!emp.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    if (!emp.resultado) return res.status(404).json({ mensagem: 'Empresa não encontrada.' });
    const leitura = lerCertidaoDoPdf(tipo, pdf, { cnpjEsperado: String(emp.resultado.cnpj), uf: emp.resultado.state });
    if (leitura.cnpjConfere === 'nao') return res.status(409).json({ mensagem: `O CNPJ que está no PDF não é o de ${emp.resultado.legal_name}. Baixe a certidão da empresa certa. Nada foi guardado.` });
    const d = v.valor;
    const uf = d.uf ?? (tipo === 'estadual' || tipo === 'municipal' ? emp.resultado.state ?? null : null);
    const municipio = d.municipio ?? (tipo === 'municipal' ? emp.resultado.municipality ?? null : null);
    const obs = [leitura.validadeOrigem === 'calculada_pela_norma' && leitura.validade === d.validade ? `Validade calculada pela norma (${leitura.fonteValidade}), confirmada pela pessoa.` : null, d.obs].filter(Boolean).join(' ') || null;
    const r = await comContextoTenant(user.id, tenantId, async (c) => (await c.query(`INSERT INTO fiscoia.certidoes (tenant_id, company_id, tipo, uf, municipio, origem, situacao, resultado, numero, emissao, validade, resultado_orgao, observacao, pdf, criado_por)
        VALUES ($1,$2,$3,$4,$5,'pdf_importado','emitida',$6,$7,$8,$9,$10,$11,$12,$13) RETURNING ${COLUNAS}`, [tenantId, companyId, tipo, uf, municipio, resultado, d.numero, d.emissao, d.validade, d.resultadoOrgao, obs, pdf, user.id])).rows[0]);
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    return res.status(201).json({ certidao: linhaParaTela(r.resultado), mensagem: `${ADAPTADORES[tipo].rotulo} guardada, válida até ${d.validade.split('-').reverse().join('/')}.` });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível guardar a certidão. Nada foi guardado.' }); }
});

/** Painel do escritório: por empresa, as 5 certidões em verde/amarelo/vermelho (cinza = não buscada), próximos vencimentos e o que buscar. Só lê. */
router.get('/certidoes/painel', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = String(req.query.tenantId ?? '');
  const user = await usuarioDoEscritorio(req, res, tenantId); if (!user) return;
  const companyId = req.query.companyId ? String(req.query.companyId) : null;
  if (companyId && !UUID.test(companyId)) return res.status(400).json({ mensagem: 'Empresa inválida.' });
  try {
    const r = await comContextoTenant(user.id, tenantId, async (c) => {
      const emp = (await c.query('SELECT id, cnpj, legal_name, state, municipality FROM fiscoia.companies WHERE tenant_id = $1 AND archived_at IS NULL AND ($2::uuid IS NULL OR id = $2) ORDER BY legal_name LIMIT 2000', [tenantId, companyId])).rows;
      const cert = (await c.query(`SELECT DISTINCT ON (company_id, tipo, situacao IN ('emitida','registrada_manualmente')) id, company_id, tipo, situacao, resultado, numero, origem, to_char(emissao,'YYYY-MM-DD') AS emissao, to_char(validade,'YYYY-MM-DD') AS validade, (pdf IS NOT NULL) AS tem_pdf, created_at
          FROM fiscoia.certidoes WHERE tenant_id = $1 AND ($2::uuid IS NULL OR company_id = $2) ORDER BY company_id, tipo, situacao IN ('emitida','registrada_manualmente'), created_at DESC`, [tenantId, companyId])).rows;
      return { emp, cert };
    });
    if (!r.autorizado) return res.status(403).json({ mensagem: 'Este escritório não pertence à sua sessão.' });
    const empresas: EmpresaParaPainel[] = (r.resultado?.emp ?? []).map((e: any) => ({ id: String(e.id), nome: String(e.legal_name), cnpj: String(e.cnpj), uf: e.state ?? null, municipio: e.municipality ?? null }));
    const certidoes: CertidaoParaPainel[] = (r.resultado?.cert ?? []).map((x: any) => ({ id: String(x.id), companyId: String(x.company_id), tipo: x.tipo, situacao: x.situacao, resultado: x.resultado ?? null, numero: x.numero ?? null, emissao: x.emissao ?? null, validade: x.validade ?? null, temPdf: x.tem_pdf === true, origem: x.origem, criadaEm: new Date(x.created_at).toISOString() }));
    const painel = montarPainel(empresas, certidoes, hojeBrasilia());
    return res.json({ ...painel, portais: Object.fromEntries(empresas.map((e) => [e.id, Object.fromEntries(TIPOS_SEMIAUTOMATICOS.map((t) => [t, portalDaCertidao(t, e.uf, e.municipio)]))])) });
  } catch { return res.status(503).json({ mensagem: 'Não foi possível montar o painel das certidões agora.' }); }
});

export default router;
