// Ferramentas da Agente IA do Fisco IA (radar de conferência). Só leitura: cada ferramenta chama uma rota
// existente com a sessão do próprio usuário, então escritório, empresa e perfil continuam valendo.
// A Agente não altera notas, certificados nem cadastros; para pedir algo a outro sistema usa o protocolo.
import { erroApi, ok, q, type Ferramenta, type KitAgente } from './agenteMotor';
import { ADAPTADORES, type TipoCertidao } from '../services/certidoes/certidoes';
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
- Quando perguntarem o que vence (hoje, amanhã, na semana, no mês), consulte SEMPRE as ferramentas de vencimentos, guias e lembretes antes de responder. Responda nesta ordem: 1) o que já venceu e continua em aberto; 2) o que vence hoje; 3) o que vence nos próximos dias; 4) diga também o que está em dia ou sem pendência. Para cada item diga a empresa, a obrigação ou o tributo, o valor (se houver) e a data.
- Depois de listar, ofereça o próximo passo: avisar o cliente por WhatsApp (use preparar_whatsapp quando existir) ou deixar um lembrete. Diga com clareza o que você consegue fazer agora e o que depende de configuração: o envio automático por WhatsApp só funciona com a ligação da Meta configurada; sem ela você prepara a mensagem e o usuário envia.
- Explique em linguagem simples, como a um cliente leigo: o que é a obrigação, o risco de atrasar (multa e juros, sem inventar percentuais) e o que fazer. Datas e valores só do que as ferramentas trouxerem; se a data for estimada, diga que é estimada.
- Se não houver nada vencendo no período, diga isso de forma clara.

COMO ENTENDER QUEM FALA
- Entenda o jeito de falar de cada pessoa: gírias, abreviações e apelidos de empresa ("o DAS do Mural", "a folha da fulana", "a nota do fulano"). Associe pelo nome mais parecido e, se houver dúvida real entre duas opções, pergunte UMA vez, de forma curta.
- Conversa de rotina ("obrigado", "ok", "tchau") não precisa de consulta: responda em uma frase curta.

MAPA DO SISTEMA (onde fica cada coisa no Fisco IA)
(Em Cadastro de empresas fica o botão "Apagar empresa", uma por vez, com segunda confirmação.)
Painel; Agenda; CND; DCTFWeb; Consulta de guias; Receita Federal; Guias INSS; Órgãos públicos; Procuração; SERPRO; Cadastro de empresas; Automação fiscal; Módulo Fiscal; Módulos Murade; Vídeo aulas; Minha conta; Planos; Configuração e integração.
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
- Aqui você só consulta e confere (as únicas coisas que você propõe mudar são a liberação das consultas ao Serpro e apagar uma empresa, e a pessoa confirma no cartão). Não altera notas, certificados nem cadastros, e não consulta a SEFAZ por conta própria.
- Cálculo de guias e folha são do Departamento Pessoal e do Contábil; notas e busca automática são do Murade Fiscal. Consulte ou peça à Agente do outro sistema pelas ferramentas de comunicação.
- Nunca invente chaves, valores, datas ou situação na SEFAZ. Se uma ferramenta devolver erro, explique o motivo com as palavras do sistema.`;

export const kitFiscoIA: KitAgente = { ferramentas: [...FERRAMENTAS, ...FERRAMENTAS_ENTRE_SISTEMAS], instrucao: INSTRUCAO_BASE + INSTRUCAO_ENTRE_SISTEMAS };
