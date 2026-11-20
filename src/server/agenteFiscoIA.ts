// Ferramentas da Agente IA do Fisco IA (radar de conferência). Só leitura: cada ferramenta chama uma rota
// existente com a sessão do próprio usuário, então escritório, empresa e perfil continuam valendo.
// A Agente não altera notas, certificados nem cadastros; para pedir algo a outro sistema usa o protocolo.
import { erroApi, ok, q, type Ferramenta, type KitAgente } from './agenteMotor';
import { ADAPTADORES, type TipoCertidao } from '../services/certidoes/certidoes';
import { FERRAMENTAS_ENTRE_SISTEMAS, INSTRUCAO_ENTRE_SISTEMAS } from './ferramentasEntreSistemas';
import { VALOR_CONSULTA_COBRADA } from '../services/serpro/consumoSerpro';

/** Consultas ao Serpro que a Agente pode propor (sem campos a preencher, e nenhuma dá ciência de intimação). */
const SERVICOS_CONSULTA_AGENTE = new Set(['situacaoFiscal', 'caixaPostalNovas', 'caixaPostalLista', ...['parcsn', 'parcsnEsp', 'parcmei', 'parcmeiEsp', 'pertsn', 'pertmei', 'relpsn'].flatMap((m) => [`${m}Pedidos`, `${m}Parcelas`])]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const idDe = (v: unknown): string | null => (typeof v === 'string' && UUID.test(v.trim()) ? v.trim() : null);
const props = {
  tenantId: { type: 'STRING', description: 'Id do escritório (UUID). Obtenha em listar_escritorios.' },
  companyId: { type: 'STRING', description: 'Id da empresa (UUID). Obtenha em listar_empresas.' },
};

const FERRAMENTAS: Ferramenta[] = [
  {
    tipo: 'leitura',
    declaracao: { name: 'listar_escritorios', description: 'Lista os escritórios do usuário e o papel dele em cada um.', parameters: { type: 'OBJECT', properties: {} } },
    async executar(ctx) {
      const r = await ctx.chamarApi('GET', '/api/tenants');
      return ok(r) ? { escritorios: r.corpo?.tenants || [] } : erroApi(r);
    },
  },
  {
    tipo: 'leitura',
    declaracao: { name: 'listar_empresas', description: 'Lista as empresas ativas de um escritório (id, CNPJ, razão social, UF, regime).', parameters: { type: 'OBJECT', properties: { tenantId: props.tenantId }, required: ['tenantId'] } },
    async executar(ctx, args) {
      const tenantId = idDe(args.tenantId); if (!tenantId) return { erro: 'Informe o id do escritório.' };
      const r = await ctx.chamarApi('GET', `/api/companies?tenantId=${q(tenantId)}`);
      if (!ok(r)) return erroApi(r);
      return { empresas: (r.corpo?.empresas || []).map((e: any) => ({ id: e.id, cnpj: e.cnpj, razaoSocial: e.legal_name, uf: e.state, municipio: e.municipality, regime: e.tax_regime })) };
    },
  },
  {
    tipo: 'leitura',
    declaracao: { name: 'conferir_periodo', description: 'Roda a conferência (radar) de um período: compara as notas guardadas no Fisco IA com as do Murade Fiscal e aponta divergências. Só leitura.', parameters: { type: 'OBJECT', properties: { tenantId: props.tenantId, companyId: props.companyId, desde: { type: 'STRING', description: 'Data inicial AAAA-MM-DD.' }, ate: { type: 'STRING', description: 'Data final AAAA-MM-DD.' } }, required: ['tenantId', 'companyId', 'desde', 'ate'] } },
    async executar(ctx, args) {
      const tenantId = idDe(args.tenantId); const companyId = idDe(args.companyId);
      if (!tenantId || !companyId) return { erro: 'Informe escritório e empresa.' };
      if (!DATA.test(String(args.desde)) || !DATA.test(String(args.ate))) return { erro: 'Informe as datas no formato AAAA-MM-DD.' };
      const r = await ctx.chamarApi('GET', `/api/companies/${q(companyId)}/conferencia?tenantId=${q(tenantId)}&desde=${q(String(args.desde))}&ate=${q(String(args.ate))}`);
      return ok(r) ? r.corpo : erroApi(r);
    },
  },
  {
    tipo: 'leitura',
    declaracao: { name: 'status_sefaz_dfe', description: 'Estado da integração com a SEFAZ da empresa: certificado, último NSU, última resposta, bloqueios e quantidade de documentos guardados.', parameters: { type: 'OBJECT', properties: { tenantId: props.tenantId, companyId: props.companyId }, required: ['tenantId', 'companyId'] } },
    async executar(ctx, args) {
      const tenantId = idDe(args.tenantId); const companyId = idDe(args.companyId);
      if (!tenantId || !companyId) return { erro: 'Informe escritório e empresa.' };
      const r = await ctx.chamarApi('GET', `/api/companies/${q(companyId)}/sefaz-dfe/status?tenantId=${q(tenantId)}`);
      return ok(r) ? r.corpo : erroApi(r);
    },
  },
  {
    tipo: 'leitura',
    declaracao: { name: 'status_certificado', description: 'Informa se há certificado A1 cadastrado para a empresa (sem mostrar conteúdo nem senha).', parameters: { type: 'OBJECT', properties: { tenantId: props.tenantId, companyId: props.companyId }, required: ['tenantId', 'companyId'] } },
    async executar(ctx, args) {
      const tenantId = idDe(args.tenantId); const companyId = idDe(args.companyId);
      if (!tenantId || !companyId) return { erro: 'Informe escritório e empresa.' };
      const r = await ctx.chamarApi('GET', `/api/companies/${q(companyId)}/fiscal-certificate/status?tenantId=${q(tenantId)}`);
      return ok(r) ? r.corpo : erroApi(r);
    },
  },
  {
    tipo: 'leitura',
    declaracao: { name: 'resumo_documentos', description: 'Resume as últimas notas guardadas da empresa no Fisco IA (quantidade por situação e tipo, valor total e as mais recentes).', parameters: { type: 'OBJECT', properties: { tenantId: props.tenantId, companyId: props.companyId }, required: ['tenantId', 'companyId'] } },
    async executar(ctx, args) {
      const tenantId = idDe(args.tenantId); const companyId = idDe(args.companyId);
      if (!tenantId || !companyId) return { erro: 'Informe escritório e empresa.' };
      const r = await ctx.chamarApi('GET', `/api/companies/${q(companyId)}/fiscal-documents?tenantId=${q(tenantId)}&limit=100`);
      if (!ok(r)) return erroApi(r);
      const docs: any[] = r.corpo?.documentos || r.corpo?.documents || (Array.isArray(r.corpo) ? r.corpo : []);
      const porSituacao: Record<string, number> = {}; const porTipo: Record<string, number> = {};
      for (const d of docs) { porSituacao[d.status ?? 'sem situação'] = (porSituacao[d.status ?? 'sem situação'] || 0) + 1; porTipo[d.tipo ?? 'sem tipo'] = (porTipo[d.tipo ?? 'sem tipo'] || 0) + 1; }
      return {
        consultados: docs.length, aviso: docs.length >= 100 ? 'Mostrando só os 100 mais recentes; pode haver mais.' : undefined,
        porSituacao, porTipo, valorTotal: docs.reduce((s, d) => s + Number(d.valorTotal ?? d.total ?? 0), 0),
        maisRecentes: docs.slice(0, 8).map((d) => ({ tipo: d.tipo, emissao: d.emissao ?? d.dataEmissao, valor: d.valorTotal ?? d.total, situacao: d.status })),
      };
    },
  },
  {
    tipo: 'leitura',
    declaracao: { name: 'ver_liberacoes_serpro', description: 'Mostra quais empresas estão liberadas (ou travadas) para a consulta ao Serpro e quais pediram liberação. Só o dono do sistema (conta administradora) enxerga. Use busca para achar uma empresa, CNPJ ou escritório.', parameters: { type: 'OBJECT', properties: { busca: { type: 'STRING', description: 'Parte do nome da empresa, do CNPJ ou do escritório (opcional).' } } } },
    async executar(ctx, args) {
      const busca = typeof args.busca === 'string' ? args.busca.replace(/[^\p{L}\p{N} .\-/]/gu, '').trim().slice(0, 60) : '';
      const r = await ctx.chamarApi('GET', `/api/serpro/liberacoes${busca ? `?busca=${q(busca)}` : ''}`);
      if (!ok(r)) return erroApi(r);
      const linhas: any[] = r.corpo?.empresas || [];
      return { total: linhas.length, aguardandoLiberacao: linhas.filter((l) => !l.liberada && l.pediuEm).length, empresas: linhas.slice(0, 40).map((l) => ({ id: l.empresaId, empresa: l.nome, cnpj: l.cnpj, escritorio: l.escritorio, situacao: l.liberada ? 'liberada' : l.pediuEm ? 'travada, pediu liberação' : 'travada' })), aviso: linhas.length > 40 ? 'Mostrando 40; refine a busca.' : undefined };
    },
  },
  {
    tipo: 'acao',
    declaracao: { name: 'liberar_consulta_serpro', description: 'Propõe LIBERAR ou voltar a TRAVAR a consulta ao Serpro de UMA empresa (a consulta grátis da semana só vale para empresa liberada). Uma empresa por vez. Descubra o id em ver_liberacoes_serpro. O dono confirma no cartão; só a conta administradora consegue.', parameters: { type: 'OBJECT', properties: { empresaId: { type: 'STRING', description: 'Id da empresa (UUID), vindo de ver_liberacoes_serpro.' }, liberar: { type: 'BOOLEAN', description: 'true para liberar, false para travar de novo.' } }, required: ['empresaId', 'liberar'] } },
    async preparar(ctx, args) {
      const empresaId = idDe(args.empresaId); if (!empresaId) return { erro: 'Informe a empresa pelo id; use ver_liberacoes_serpro para achar.' };
      if (typeof args.liberar !== 'boolean') return { erro: 'Diga se é para liberar ou travar.' };
      const r = await ctx.chamarApi('GET', '/api/serpro/liberacoes');
      if (!ok(r)) return erroApi(r);
      const l = (r.corpo?.empresas || []).find((x: any) => x.empresaId === empresaId);
      if (!l) return { erro: 'Empresa não encontrada na lista de liberações. Busque pelo nome em ver_liberacoes_serpro.' };
      const acao = args.liberar ? 'Liberar' : 'Travar';
      return {
        cnpj: String(l.cnpj || '').replace(/\D/g, ''), params: { empresaId, liberar: args.liberar },
        titulo: `${acao} consulta ao Serpro: ${l.nome}`,
        descricao: [`Empresa: ${l.nome} (CNPJ ${l.cnpj})`, `Escritório: ${l.escritorio}`, args.liberar ? 'Depois de liberar, esta empresa pode usar a consulta grátis da semana e as pagas.' : 'Depois de travar, esta empresa não consulta mais o Serpro.'],
        aviso: args.liberar ? 'A consulta grátis da semana passa a ser custo seu para esta empresa.' : undefined,
        resumo: `${acao} consulta ao Serpro de ${l.nome}`,
      };
    },
    async executar(ctx, params) {
      const r = await ctx.chamarApi('POST', `/api/serpro/liberacoes/${q(String(params.empresaId))}`, { liberada: params.liberar === true });
      return ok(r) ? { sucesso: true, mensagem: params.liberar ? 'Consulta ao Serpro liberada para a empresa.' : 'Consulta ao Serpro travada para a empresa.' } : { sucesso: false, mensagem: String(erroApi(r).erro) };
    },
  },
  {
    tipo: 'acao',
    declaracao: { name: 'apagar_empresa', description: 'Propõe APAGAR o cadastro de UMA empresa em Fiscal, DP, Contábil e Fisco IA (as notas e os documentos ficam guardados; o CNPJ pode ser cadastrado de novo depois). Só use depois de o usuário confirmar, falando, o NOME e o CNPJ da empresa nesta conversa. Uma empresa por vez; nunca "apagar todas". Descubra os ids em listar_escritorios e listar_empresas. O usuário ainda confirma no cartão; só proprietário ou administrador do escritório consegue.', parameters: { type: 'OBJECT', properties: { tenantId: props.tenantId, companyId: props.companyId }, required: ['tenantId', 'companyId'] } },
    async preparar(ctx, args) {
      const tenantId = idDe(args.tenantId); const companyId = idDe(args.companyId);
      if (!tenantId || !companyId) return { erro: 'Informe o escritório e a empresa pelo id; use listar_escritorios e listar_empresas para achar. Apago uma empresa por vez.' };
      const r = await ctx.chamarApi('GET', `/api/companies?tenantId=${q(tenantId)}`);
      if (!ok(r)) return erroApi(r);
      const e = (r.corpo?.empresas || []).find((x: any) => x.id === companyId);
      if (!e) return { erro: 'Empresa não encontrada neste escritório (ou já apagada).' };
      const cnpj = String(e.cnpj || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      return {
        cnpj, params: { tenantId, companyId }, irreversivel: true,
        titulo: `Apagar empresa: ${e.legal_name}`,
        descricao: [`Empresa: ${e.legal_name} (CNPJ ${e.cnpj})`, 'O cadastro sai do Fiscal, do DP, do Contábil e do Fisco IA.', 'Notas, documentos e certificados ficam guardados. Você pode cadastrar o CNPJ de novo depois.'],
        aviso: 'Apaga o cadastro nos quatro sistemas. Confira o nome e o CNPJ antes de confirmar.',
        resumo: `Apagar o cadastro de ${e.legal_name} (CNPJ ${e.cnpj}) em Fiscal, DP, Contábil e Fisco IA`,
      };
    },
    async executar(ctx, params) {
      const r = await ctx.chamarApi('POST', `/api/companies/${q(String(params.companyId))}/excluir`, { tenantId: params.tenantId });
      if (!ok(r)) return { sucesso: false, mensagem: String(erroApi(r).erro) };
      const c = r.corpo?.cascata;
      return c?.situacao === 'ok'
        ? { sucesso: true, mensagem: 'Empresa apagada em Fiscal, DP, Contábil e Fisco IA. Notas e documentos continuam guardados.' }
        : { sucesso: true, mensagem: `Empresa apagada só no Fisco IA (notas e documentos continuam guardados). ATENÇÃO: ${c?.mensagem || 'não foi possível avisar os outros sistemas.'}` };
    },
  },
  {
    tipo: 'leitura',
    declaracao: { name: 'ver_certidoes_vencendo', description: 'Mostra as certidões guardadas (CND federal, estadual, municipal, CRF do FGTS, CNDT) que já venceram ou vencem em até 30 dias, por empresa. Só lê o que já está guardado; não consulta nenhum órgão e não gasta nada.', parameters: { type: 'OBJECT', properties: { tenantId: props.tenantId }, required: ['tenantId'] } },
    async executar(ctx, args) {
      const tenantId = idDe(args.tenantId); if (!tenantId) return { erro: 'Informe o id do escritório.' };
      const r = await ctx.chamarApi('GET', `/api/certidoes/vencendo?tenantId=${q(tenantId)}`);
      if (!ok(r)) return erroApi(r);
      const lista: any[] = r.corpo?.certidoes || [];
      return { hoje: r.corpo?.hoje, total: lista.length, certidoes: lista.slice(0, 40).map((c) => ({ empresa: c.empresa, certidao: c.rotuloTipo, uf: c.uf, municipio: c.municipio, numero: c.numero, validade: c.validade, situacao: c.situacaoTexto })), aviso: lista.length > 40 ? 'Mostrando 40; há mais.' : undefined, observacao: 'Só entram certidões já guardadas no sistema; certidão nunca registrada não aparece aqui.' };
    },
  },
  {
    tipo: 'acao',
    declaracao: { name: 'consultar_certidao', description: 'Propõe CONSULTAR a certidão de UMA empresa no órgão. Hoje só a CND federal (Receita Federal + PGFN) tem consulta automática, e ela é PAGA pelo Serpro: por isso só roda depois de a pessoa confirmar o custo no cartão. Estadual, municipal, FGTS e trabalhista não têm consulta automática: nesses casos a ferramenta devolve o portal para a pessoa emitir. Uma empresa e um tipo por vez.', parameters: { type: 'OBJECT', properties: { tenantId: props.tenantId, companyId: props.companyId, tipo: { type: 'STRING', description: 'federal, estadual, municipal, fgts ou trabalhista.' } }, required: ['tenantId', 'companyId', 'tipo'] } },
    async preparar(ctx, args) {
      const tenantId = idDe(args.tenantId); const companyId = idDe(args.companyId);
      if (!tenantId || !companyId) return { erro: 'Informe o escritório e a empresa pelos ids; use listar_escritorios e listar_empresas.' };
      const tipo = String(args.tipo || '').trim().toLowerCase();
      const adaptador = (ADAPTADORES as Record<string, (typeof ADAPTADORES)[TipoCertidao]>)[tipo];
      if (!adaptador) return { erro: 'Tipo inválido. Use federal, estadual, municipal, fgts ou trabalhista.' };
      if (adaptador.modo === 'manual') return { erro: `${adaptador.rotulo}: ${adaptador.como}${adaptador.portalOficial ? ` Portal oficial: ${adaptador.portalOficial}` : ' Abra o portal do órgão da UF ou do município da empresa na tela CND / Certidões.'} Nada foi consultado nem cobrado.` };
      const r = await ctx.chamarApi('GET', `/api/companies?tenantId=${q(tenantId)}`);
      if (!ok(r)) return erroApi(r);
      const e = (r.corpo?.empresas || []).find((x: any) => x.id === companyId);
      if (!e) return { erro: 'Empresa não encontrada neste escritório.' };
      return {
        cnpj: String(e.cnpj || '').replace(/\D/g, ''), params: { tenantId, companyId, tipo },
        titulo: `Consultar ${adaptador.rotulo}: ${e.legal_name}`,
        descricao: [`Empresa: ${e.legal_name} (CNPJ ${e.cnpj})`, `Órgão: ${adaptador.orgao}`, 'Consulta paga pelo Serpro (produto "Consulta CND"), cobrada por consulta conforme o contrato.', 'O resultado fica guardado na tela CND / Certidões, com validade exatamente como o órgão informar.'],
        aviso: 'Ao confirmar, a consulta é feita agora e pode ser cobrada.',
        resumo: `Consultar ${adaptador.rotulo} de ${e.legal_name}`,
      };
    },
    async executar(ctx, params) {
      const r = await ctx.chamarApi('POST', '/api/certidoes/consultar', { tenantId: params.tenantId, companyId: params.companyId, tipo: params.tipo, confirmarCusto: true });
      if (!ok(r)) return { sucesso: false, mensagem: String(erroApi(r).erro) };
      const c = r.corpo?.certidao;
      const detalhe = c?.validade ? ` Número de controle ${c.numero ?? 'não informado'}, emitida em ${c.emissao ?? 'data não informada'}, válida até ${c.validade}.` : '';
      return { sucesso: r.corpo?.situacao === 'emitida', mensagem: `${r.corpo?.mensagem || 'Consulta concluída.'}${detalhe}`, detalhes: c ? { situacao: c.situacao, validade: c.validade, numero: c.numero } : undefined };
    },
  },
  {
    tipo: 'leitura',
    declaracao: { name: 'ver_carteira_fiscal', description: 'Painel da carteira do escritório com o que JÁ FOI consultado e guardado (sem custo): por empresa, situação fiscal (regular, pendente, a conferir ou sem consulta) com a data, mensagens novas na Caixa Postal, parcela de parcelamento em atraso e vencimento do certificado A1. Não consulta o Serpro.', parameters: { type: 'OBJECT', properties: { tenantId: props.tenantId, so: { type: 'STRING', description: 'Opcional: "pendentes" para listar só as que pedem atenção.' } }, required: ['tenantId'] } },
    async executar(ctx, args) {
      const tenantId = idDe(args.tenantId); if (!tenantId) return { erro: 'Informe o id do escritório.' };
      const r = await ctx.chamarApi('GET', `/api/carteira-fiscal?tenantId=${q(tenantId)}`);
      if (!ok(r)) return erroApi(r);
      const lista: any[] = (r.corpo?.empresas || []).filter((e: any) => args.so !== 'pendentes' || e.geral === 'pendente' || e.geral === 'atencao');
      return {
        hoje: r.corpo?.hoje, totais: r.corpo?.totais,
        empresas: lista.slice(0, 40).map((e) => ({ id: e.companyId, empresa: e.nome, cnpj: e.cnpj, situacaoGeral: e.geral,
          situacaoFiscal: e.situacaoFiscal ? `${e.situacaoFiscal.situacao}${e.situacaoFiscal.origem === 'lida_do_pdf' ? ' (lida do PDF)' : e.situacaoFiscal.origem === 'marcada_pela_pessoa' ? ' (marcada pela pessoa)' : ''}, consulta de ${String(e.situacaoFiscal.consultadoEm || '').slice(0, 10)}` : 'sem consulta guardada',
          caixaPostal: e.caixaPostal ? `${e.caixaPostal.novas ? 'tem mensagem nova' : 'sem mensagem nova'} (consulta de ${String(e.caixaPostal.consultadoEm || '').slice(0, 10)})` : 'sem consulta guardada',
          parcelasAtrasadas: (e.parcelamentos?.atrasadas || []).map((a: any) => `${a.nomeModalidade} ${a.parcela}`), certificado: e.certificado?.situacaoTexto ?? 'sem certificado A1 cadastrado' })),
        aviso: lista.length > 40 ? 'Mostrando 40; há mais.' : undefined,
        observacao: 'São as últimas consultas GUARDADAS, com a data de cada uma; não é consulta de hoje. Situação "lida do PDF" é leitura automática do relatório: confirme no PDF. Parcela atrasada = parcela de mês anterior que ainda aparecia como disponível para emitir.',
      };
    },
  },
  ...(['situacao', 'caixa', 'parcelamentos'] as const).map((grupo): Ferramenta => ({
    tipo: 'leitura',
    declaracao: {
      name: grupo === 'situacao' ? 'ver_situacao_fiscal_guardada' : grupo === 'caixa' ? 'ver_caixa_postal_guardada' : 'ver_parcelamentos_guardados',
      description: grupo === 'situacao' ? 'Mostra as situações fiscais (SITFIS) já consultadas e guardadas de UMA empresa, com data e se foi lida do PDF ou marcada pela pessoa. Sem custo; não consulta o Serpro.'
        : grupo === 'caixa' ? 'Mostra o que já foi consultado e guardado da Caixa Postal da Receita de UMA empresa (se havia mensagem nova e a lista de mensagens com assunto e data). Sem custo; não abre mensagem (abrir conta como ciência).'
          : 'Mostra os parcelamentos (Simples, MEI, PERT, RELP) já consultados e guardados de UMA empresa: pedidos, detalhes e parcelas para emitir, com aviso de parcela de mês anterior ainda em aberto. Sem custo.',
      parameters: { type: 'OBJECT', properties: { tenantId: props.tenantId, companyId: props.companyId }, required: ['tenantId', 'companyId'] },
    },
    async executar(ctx, args) {
      const tenantId = idDe(args.tenantId); const companyId = idDe(args.companyId);
      if (!tenantId || !companyId) return { erro: 'Informe escritório e empresa; use listar_escritorios e listar_empresas.' };
      const r = await ctx.chamarApi('GET', `/api/carteira-fiscal/empresa?tenantId=${q(tenantId)}&companyId=${q(companyId)}&grupo=${grupo}`);
      if (!ok(r)) return erroApi(r);
      const res: any[] = r.corpo?.resultados || [];
      if (!res.length) return { empresa: r.corpo?.empresa, resultados: [], observacao: 'Nada guardado ainda para esta empresa. Uma consulta nova pode ter custo (use pedir_consulta_receita, que mostra o custo antes).' };
      return { empresa: r.corpo?.empresa, resultados: res.slice(0, 15).map((x) => ({ tipo: x.tipo, modalidade: x.nomeModalidade, consultadoEm: x.consultadoEm, situacao: x.situacao, origemSituacao: x.origemSituacao, novasMensagens: x.novasMensagens, temPdf: x.temPdf, resumo: x.resumo, atrasadas: x.atrasadas })), observacao: r.corpo?.observacao };
    },
  })),
  {
    tipo: 'leitura',
    declaracao: { name: 'ver_certificados_vencendo', description: 'Mostra os certificados A1 das empresas do escritório que já venceram ou vencem em até 30 dias (e os sem validade registrada). A validade é lida do próprio arquivo. Sem custo.', parameters: { type: 'OBJECT', properties: { tenantId: props.tenantId }, required: ['tenantId'] } },
    async executar(ctx, args) {
      const tenantId = idDe(args.tenantId); if (!tenantId) return { erro: 'Informe o id do escritório.' };
      const r = await ctx.chamarApi('GET', `/api/certificados/vencendo?tenantId=${q(tenantId)}`);
      if (!ok(r)) return erroApi(r);
      return { hoje: r.corpo?.hoje, cadastrados: r.corpo?.cadastrados, total: r.corpo?.total, certificados: (r.corpo?.certificados || []).slice(0, 40).map((c: any) => ({ empresa: c.empresa, validade: c.validade, situacao: c.situacaoTexto })) };
    },
  },
  {
    tipo: 'leitura',
    declaracao: { name: 'ver_agenda_fiscal', description: 'Mostra os lembretes da Agenda Fiscal do escritório (guardados no servidor, os mesmos que toda a equipe vê): vencidos, de hoje e os próximos 30 dias. Os lembretes são cadastrados pela equipe; não são obrigações consultadas em órgão oficial.', parameters: { type: 'OBJECT', properties: { tenantId: props.tenantId }, required: ['tenantId'] } },
    async executar(ctx, args) {
      const tenantId = idDe(args.tenantId); if (!tenantId) return { erro: 'Informe o id do escritório.' };
      const r = await ctx.chamarApi('GET', `/api/escritorio/dados?tenantId=${q(tenantId)}&colecao=agenda_lembretes`);
      if (!ok(r)) return erroApi(r);
      const hoje = Date.parse(`${ctx.hoje}T00:00:00Z`);
      const itens = (r.corpo?.itens || []).map((i: any) => i.dados).filter((l: any) => l && l.concluido !== true && /^\d{4}-\d{2}-\d{2}$/.test(String(l.dataVencimento)))
        .map((l: any) => ({ empresa: l.empresa, titulo: l.titulo, vencimento: l.dataVencimento, dias: Math.round((Date.parse(`${l.dataVencimento}T00:00:00Z`) - hoje) / 86_400_000) }))
        .filter((l: any) => l.dias <= 30).sort((a: any, b: any) => a.dias - b.dias);
      return { hoje: ctx.hoje, vencidos: itens.filter((l: any) => l.dias < 0), vencemHoje: itens.filter((l: any) => l.dias === 0), proximos: itens.filter((l: any) => l.dias > 0).slice(0, 30), observacao: 'Lembretes cadastrados pela equipe; confira a data no órgão.' };
    },
  },
  {
    tipo: 'leitura',
    declaracao: { name: 'conferir_carteira_agora', description: 'Roda agora a conferência do escritório sobre o que já está guardado (situação fiscal pendente ou a conferir, Caixa Postal com mensagem nova, parcela atrasada, certificado A1 vencendo e lembretes vencidos da Agenda). Sem custo; não consulta o Serpro.', parameters: { type: 'OBJECT', properties: { tenantId: props.tenantId }, required: ['tenantId'] } },
    async executar(ctx, args) {
      const tenantId = idDe(args.tenantId); if (!tenantId) return { erro: 'Informe o id do escritório.' };
      const r = await ctx.chamarApi('POST', '/api/carteira-fiscal/conferir', { tenantId });
      if (!ok(r)) return erroApi(r);
      return { mensagem: r.corpo?.mensagem, alertas: (r.corpo?.alertas || []).slice(0, 40), totais: r.corpo?.totais };
    },
  },
  {
    tipo: 'acao',
    declaracao: { name: 'pedir_consulta_receita', description: 'Propõe UMA consulta NOVA ao Serpro (Integra Contador) para UMA empresa: situacaoFiscal, caixaPostalNovas (há mensagens novas?), caixaPostalLista (lista das não lidas) ou a lista de pedidos/parcelas de um parcelamento (parcsnPedidos, parcsnParcelas, parcmeiPedidos, parcmeiParcelas, pertsnPedidos, pertsnParcelas, pertmeiPedidos, pertmeiParcelas, relpsnPedidos, relpsnParcelas, parcsnEspPedidos, parcsnEspParcelas, parcmeiEspPedidos, parcmeiEspParcelas). Pode ter CUSTO: o cartão mostra se entra na consulta grátis da semana ou quanto custa, e só roda depois de a pessoa confirmar. O resultado fica guardado na carteira. Antes, veja se o resultado guardado já basta (ver_*_guardada).', parameters: { type: 'OBJECT', properties: { tenantId: props.tenantId, companyId: props.companyId, servico: { type: 'STRING', description: 'Um dos serviços listados na descrição.' } }, required: ['tenantId', 'companyId', 'servico'] } },
    async preparar(ctx, args) {
      const tenantId = idDe(args.tenantId); const companyId = idDe(args.companyId);
      if (!tenantId || !companyId) return { erro: 'Informe o escritório e a empresa pelos ids; use listar_escritorios e listar_empresas.' };
      const servico = String(args.servico || '').trim();
      if (!SERVICOS_CONSULTA_AGENTE.has(servico)) return { erro: 'Serviço não disponível por voz. Use situacaoFiscal, caixaPostalNovas, caixaPostalLista ou a lista de pedidos/parcelas de um parcelamento.' };
      const [emp, cota, pront] = await Promise.all([
        ctx.chamarApi('GET', `/api/companies?tenantId=${q(tenantId)}`),
        ctx.chamarApi('GET', `/api/serpro/consultas/${q(companyId)}?tenantId=${q(tenantId)}`),
        ctx.chamarApi('GET', '/api/serpro/prontidao'),
      ]);
      if (!ok(emp)) return erroApi(emp);
      const e = (emp.corpo?.empresas || []).find((x: any) => x.id === companyId);
      if (!e) return { erro: 'Empresa não encontrada neste escritório.' };
      if (!ok(cota)) return erroApi(cota);
      if (cota.corpo?.liberada === false) return { erro: 'A consulta ao Serpro ainda não foi liberada para esta empresa pelo fornecedor do sistema. Nada foi consultado nem cobrado.' };
      const descricao = (pront.corpo?.servicos || []).find((x: any) => x.chave === servico)?.descricao || servico;
      const cobrada = cota.corpo?.proximaConsultaCobrada === true;
      const custo = cobrada ? `CUSTO: R$ ${Number(VALOR_CONSULTA_COBRADA).toFixed(2).replace('.', ',')}, cobrado por fora da mensalidade (a consulta grátis desta semana já foi usada).` : 'Sem custo: entra na consulta grátis desta semana da empresa.';
      return {
        cnpj: String(e.cnpj || '').replace(/\D/g, ''), params: { tenantId, companyId, servico, cobrada },
        titulo: `Consultar no Serpro: ${descricao}`,
        descricao: [`Empresa: ${e.legal_name} (CNPJ ${e.cnpj})`, custo, servico === 'situacaoFiscal' ? 'A situação fiscal leva alguns segundos (protocolo e relatório em PDF).' : 'Consulta oficial pelo Integra Contador.', 'O resultado fica guardado na carteira fiscal, com a data.'],
        aviso: cobrada ? 'Ao confirmar, a consulta é feita agora e será cobrada.' : 'Ao confirmar, a consulta é feita agora e usa a consulta grátis da semana desta empresa.',
        resumo: `Consulta Serpro ${servico} de ${e.legal_name} (${cobrada ? 'cobrada' : 'grátis da semana'})`,
      };
    },
    async executar(ctx, params) {
      const dados = params.servico === 'caixaPostalLista' ? { statusLeitura: '2', indicadorPagina: '0' } : {};
      // confirmarCusto só vai como "sim" quando o cartão mostrou o custo. Se a cota grátis acabou entre o cartão e o clique, o servidor para e nada é cobrado.
      const r = await ctx.chamarApi('POST', '/api/serpro/consulta', { tenantId: params.tenantId, companyId: params.companyId, servico: params.servico, dados, confirmarCusto: params.cobrada === true });
      if (r.status === 402) return { sucesso: false, mensagem: 'A consulta grátis desta semana foi usada enquanto o cartão estava aberto. Nada foi consultado nem cobrado. Peça de novo para eu mostrar o custo.' };
      if (!ok(r) || r.corpo?.consultado !== true) return { sucesso: false, mensagem: String(erroApi(r).erro) };
      return { sucesso: true, mensagem: `Consulta feita no Serpro${r.corpo?.cobradaAparte ? ' (cobrada)' : ' (grátis da semana)'}.${r.corpo?.guardado === true ? ' Resultado guardado na carteira fiscal.' : r.corpo?.guardado === false ? ' ATENÇÃO: o resultado não pôde ser guardado na carteira.' : ''}` };
    },
  },
  {
    tipo: 'leitura',
    declaracao: { name: 'seguranca_login', description: 'Mostra a segurança do login das últimas 24 horas: senhas e códigos errados, bloqueios por excesso de tentativas, códigos de emergência usados, quantas contas têm o código de segurança ligado e se o dono do sistema está com ele ligado. Só o dono do sistema vê. Só lê; não bloqueia nem libera ninguém.', parameters: { type: 'OBJECT', properties: {} } },
    async executar(ctx) {
      const r = await ctx.chamarApi('GET', '/api/auth/2fa/resumo');
      if (!ok(r)) return erroApi(r);
      return { situacao: r.corpo?.texto, alerta: r.corpo?.alerta === true, numeros: r.corpo?.resumo, donosSemCodigo: r.corpo?.donosSemCodigo };
    },
  },
  {
    tipo: 'acao',
    declaracao: { name: 'redefinir_codigo_usuario', description: 'Propõe redefinir o código de segurança de um usuário que perdeu o celular: o código é desligado, ele sai de todos os aparelhos e entra de novo só com a senha (depois pode ligar o código outra vez). O dono do sistema pode redefinir qualquer usuário; o responsável de um escritório, só os da própria equipe.', parameters: { type: 'OBJECT', properties: { email: { type: 'STRING', description: 'E-mail de quem perdeu o celular.' } }, required: ['email'] } },
    async preparar(_ctx, args) {
      const email = String(args.email || '').trim().toLowerCase();
      if (email.length < 5 || email.length > 254 || !/^[a-z0-9._%+\-]+@[a-z0-9.\-]+$/.test(email)) return { erro: 'Informe o e-mail de quem perdeu o celular.' };
      return { cnpj: '', params: { email }, titulo: 'Redefinir código de segurança', descricao: [`Usuário ${email}`, 'O código de segurança dele é desligado e ele sai de todos os aparelhos. Entra de novo só com a senha e pode ligar o código outra vez.'], aviso: 'Confirme que é mesmo a pessoa quem pediu (por exemplo, por telefone), porque quem tiver só a senha passa a entrar sem o código até ele ligar de novo.', resumo: `Redefinir código de segurança de ${email}` };
    },
    async executar(ctx, params) {
      const r = await ctx.chamarApi('POST', '/api/auth/2fa/redefinir', params);
      if (!ok(r)) return { sucesso: false, mensagem: String(erroApi(r).erro) };
      return { sucesso: true, mensagem: r.corpo?.aviso || 'Código redefinido.' };
    },
  },
  {
    tipo: 'leitura',
    declaracao: { name: 'status_robos', description: 'Mostra se os robôs do Fisco IA estão ativos, a missão de cada um, quando rodaram pela última vez e erros.', parameters: { type: 'OBJECT', properties: {} } },
    async executar(ctx) {
      const r = await ctx.chamarApi('GET', '/api/robos/status');
      return ok(r) ? { robos: r.corpo?.robos, servidor: r.corpo?.servidor } : erroApi(r);
    },
  },
  {
    tipo: 'leitura',
    declaracao: { name: 'consultar_legislacao', description: 'Responde dúvida fiscal/tributária pesquisando fontes oficiais.', parameters: { type: 'OBJECT', properties: { pergunta: { type: 'STRING', description: 'A dúvida completa.' } }, required: ['pergunta'] } },
    async executar(ctx, args) {
      const pergunta = typeof args.pergunta === 'string' ? args.pergunta.trim().slice(0, 3900) : '';
      if (!pergunta) return { erro: 'Informe a pergunta.' };
      const r = await ctx.chamarApi('POST', '/api/ia-fiscal/consultar', { pergunta, historico: [] });
      if (!ok(r) || typeof r.corpo?.resposta !== 'string') return erroApi(r);
      return { resposta: r.corpo.resposta, referencia: r.corpo.referencia, fontes: r.corpo.fontesWeb || [] };
    },
  },
];

const INSTRUCAO_BASE = `Você é a Agente IA do Murade Fisco IA (radar de conferência), em português do Brasil, com tom calmo, direto e prático. Respostas curtas.

COMO RESPONDER (suas respostas são lidas em voz alta)
- Escreva em texto simples: sem asteriscos, negrito, tabelas, marcadores, # ou emojis.
- Quando perguntarem o que existe no sistema (empresas, funcionários, notas, guias), responda com os DADOS REAIS que a ferramenta devolveu: diga quantos são e, para cada um, o nome e o número completo, com todos os dígitos (por exemplo: "Você tem 1 empresa: Murad Contabilidade, CNPJ 40.957.233/0001-00.").
- Se a consulta não trouxer nada, diga claramente que não há nenhum cadastrado. Se o pedido pertence a outro sistema (Fiscal, DP, Contábil ou Fisco IA), diga a qual.
- Nunca esconda o CNPJ com asteriscos nem responda de forma genérica: use a ferramenta e entregue o que ela devolveu.

VENCIMENTOS E ALERTAS (seja atenta, proativa e inteligente)
- Certidões (CND): para saber o que venceu ou vence, use ver_certidoes_vencendo. Para consultar, use consultar_certidao: só a CND federal tem consulta automática, é PAGA e só roda depois de a pessoa confirmar no cartão; antes de propor, diga em voz alta que é paga e pergunte se quer consultar. Estadual, municipal, FGTS e trabalhista são emitidas pela pessoa no portal do órgão. Nunca diga que uma certidão está regular sem o resultado guardado pelo sistema; validade só a que o órgão informou.
- Carteira fiscal (sem custo): para "como está a carteira", "quem está pendente", "situação fiscal da empresa X", "tem mensagem na Caixa Postal", "parcela atrasada", use ver_carteira_fiscal e ver_situacao_fiscal_guardada / ver_caixa_postal_guardada / ver_parcelamentos_guardados. Diga SEMPRE a data da consulta guardada; nunca apresente como situação de hoje. "Lida do PDF" é leitura automática: diga para confirmar no PDF. Para conferir tudo agora, use conferir_carteira_agora.
- Consulta NOVA ao Serpro só com pedir_consulta_receita (uma empresa e um serviço por vez): antes diga em voz alta se é grátis ou quanto custa e pergunte se quer consultar; a pessoa ainda confirma no cartão. Consulta em lote de várias empresas é feita na tela SERPRO (botão "Consultar a carteira"), que mostra o total antes. Abrir mensagem da Caixa Postal conta como ciência: isso só na tela, nunca por você.
- Certificado A1: use ver_certificados_vencendo. Agenda Fiscal: use ver_agenda_fiscal.
- Quando perguntarem o que vence (hoje, amanhã, na semana, no mês), consulte SEMPRE as ferramentas de vencimentos, guias e lembretes antes de responder. Responda nesta ordem: 1) o que já venceu e continua em aberto; 2) o que vence hoje; 3) o que vence nos próximos dias; 4) diga também o que está em dia ou sem pendência. Para cada item diga a empresa, a obrigação ou o tributo, o valor (se houver) e a data.
- Depois de listar, ofereça o próximo passo: avisar o cliente por WhatsApp (use preparar_whatsapp quando existir) ou deixar um lembrete. Diga com clareza o que você consegue fazer agora e o que depende de configuração: o envio automático por WhatsApp só funciona com a ligação da Meta configurada; sem ela você prepara a mensagem e o usuário envia.
- Explique em linguagem simples, como a um cliente leigo: o que é a obrigação, o risco de atrasar (multa e juros, sem inventar percentuais) e o que fazer. Datas e valores só do que as ferramentas trouxerem; se a data for estimada, diga que é estimada.
- Se não houver nada vencendo no período, diga isso de forma clara.

COMO ENTENDER QUEM FALA
- Entenda o jeito de falar de cada pessoa: gírias, abreviações e apelidos de empresa ("o DAS do Mural", "a folha da fulana", "a nota do fulano"). Associe pelo nome mais parecido e, se houver dúvida real entre duas opções, pergunte UMA vez, de forma curta.
- Conversa de rotina ("obrigado", "ok", "tchau") não precisa de consulta: responda em uma frase curta.

MAPA DO SISTEMA (onde fica cada coisa no Fisco IA)
(Em Cadastro de empresas fica o botão "Apagar empresa", uma por vez, com segunda confirmação.)
Painel; Agenda; CND; DCTFWeb; Consulta de guias; Receita Federal; Guias INSS; Órgãos públicos; Procuração; SERPRO (com a Carteira fiscal e o botão "Consultar a carteira"); Cadastro de empresas; Automação fiscal; Módulo Fiscal; Módulos Murade; Vídeo aulas; Minha conta; Planos; Configuração e integração.
Quando perguntarem "onde eu faço X", diga o nome da tela. Não invente telas que não estão nesta lista.

COMO TRABALHAR
- Para saber qualquer coisa do sistema (escritórios, empresas, conferência, SEFAZ, certificado, notas guardadas, robôs), use as ferramentas de consulta. Nunca responda de memória sobre dados do cliente.
- Se há um único escritório, use-o. Se há várias empresas e o usuário não disse qual, pergunte. Para conferência, peça o período se ele não disse.
- Para dúvidas de legislação, regra ou prazo, use consultar_legislacao e repasse as fontes oficiais.

LIBERAÇÃO DAS CONSULTAS AO SERPRO (só o dono do sistema)
- Toda empresa de escritório cliente começa travada: nem a consulta grátis da semana funciona até o dono liberar aquela empresa. Quando o dono pedir "libera/trava a consulta da empresa X", use ver_liberacoes_serpro (busca pelo nome) e depois liberar_consulta_serpro com o id; ele confirma no cartão. Uma empresa por vez; não existe "liberar todas".
- Quando perguntarem quem está esperando liberação, use ver_liberacoes_serpro e diga quantas e quais.

APAGAR EMPRESA (por voz ou texto)
- Quando pedirem para apagar/excluir uma empresa: descubra a empresa com listar_escritorios e listar_empresas, diga o NOME e o CNPJ completos e pergunte "Confirma apagar o cadastro da empresa X, CNPJ Y, no Fiscal, DP, Contábil e Fisco IA? As notas e os documentos ficam guardados." Só use apagar_empresa depois que a pessoa responder que sim, falando ou escrevendo, NESTA conversa. Depois ela ainda confirma no cartão.
- Uma empresa por vez. Se pedirem "apagar todas", recuse e explique que é uma de cada vez, com confirmação. Se o resultado disser que os outros sistemas não confirmaram, repita esse aviso com clareza.

LIMITES (diga com clareza quando o pedido bater neles)
- Aqui você só consulta e confere (as únicas ações que você propõe são a liberação das consultas ao Serpro, apagar uma empresa, consultar a CND federal e pedir uma consulta nova ao Serpro, e a pessoa confirma no cartão). Não altera notas, certificados nem cadastros, e não consulta a SEFAZ por conta própria.
- Cálculo de guias e folha são do Departamento Pessoal e do Contábil; notas e busca automática são do Murade Fiscal. Consulte ou peça à Agente do outro sistema pelas ferramentas de comunicação.
- Nunca invente chaves, valores, datas ou situação na SEFAZ. Se uma ferramenta devolver erro, explique o motivo com as palavras do sistema.`;

export const kitFiscoIA: KitAgente = { ferramentas: [...FERRAMENTAS, ...FERRAMENTAS_ENTRE_SISTEMAS], instrucao: INSTRUCAO_BASE + INSTRUCAO_ENTRE_SISTEMAS };
