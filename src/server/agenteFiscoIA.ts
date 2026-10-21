// Ferramentas da Agente IA do Fisco IA (radar de conferência). Só leitura: cada ferramenta chama uma rota
// existente com a sessão do próprio usuário, então escritório, empresa e perfil continuam valendo.
// A Agente não altera notas, certificados nem cadastros; para pedir algo a outro sistema usa o protocolo.
import { erroApi, ok, q, type Ferramenta, type KitAgente } from './agenteMotor';
import { FERRAMENTAS_ENTRE_SISTEMAS, INSTRUCAO_ENTRE_SISTEMAS } from './ferramentasEntreSistemas';

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

COMO TRABALHAR
- Para saber qualquer coisa do sistema (escritórios, empresas, conferência, SEFAZ, certificado, notas guardadas, robôs), use as ferramentas de consulta. Nunca responda de memória sobre dados do cliente.
- Se há um único escritório, use-o. Se há várias empresas e o usuário não disse qual, pergunte. Para conferência, peça o período se ele não disse.
- Para dúvidas de legislação, regra ou prazo, use consultar_legislacao e repasse as fontes oficiais.

LIMITES (diga com clareza quando o pedido bater neles)
- Aqui você só consulta e confere. Não altera notas, certificados nem cadastros, e não consulta a SEFAZ por conta própria.
- Cálculo de guias e folha são do Departamento Pessoal e do Contábil; notas e busca automática são do Murade Fiscal. Consulte ou peça à Agente do outro sistema pelas ferramentas de comunicação.
- Nunca invente chaves, valores, datas ou situação na SEFAZ. Se uma ferramenta devolver erro, explique o motivo com as palavras do sistema.`;

export const kitFiscoIA: KitAgente = { ferramentas: [...FERRAMENTAS, ...FERRAMENTAS_ENTRE_SISTEMAS], instrucao: INSTRUCAO_BASE + INSTRUCAO_ENTRE_SISTEMAS };
