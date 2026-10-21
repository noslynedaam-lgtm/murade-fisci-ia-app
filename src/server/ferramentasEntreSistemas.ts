// Ferramentas da Agente IA para falar com as Agentes dos outros sistemas Murade.
// Arquivo idêntico no DP, Fiscal e Contábil.
import { NOME_SISTEMA, SISTEMAS, type SistemaMurade } from './agentesEntreSistemas';
import type { Ferramenta } from './agenteMotor';

const SISTEMA_PROP = { type: 'STRING', description: 'Sistema de destino: dp (Departamento Pessoal), fiscal, contabil ou fiscoia (Fisco IA, conferência).', enum: ['dp', 'fiscal', 'contabil', 'fiscoia'] };
const sistemaDe = (v: unknown): SistemaMurade | null => (SISTEMAS.includes(v as SistemaMurade) ? (v as SistemaMurade) : null);
const cnpjOpc = (v: unknown) => { const d = String(v ?? '').replace(/\D/g, ''); return d.length === 14 ? d : null; };
const SEM_CENTRAL = { erro: 'A comunicação entre sistemas não está disponível nesta sessão.' };

export const FERRAMENTAS_ENTRE_SISTEMAS: Ferramenta[] = [
  {
    tipo: 'leitura',
    declaracao: {
      name: 'perguntar_a_outro_sistema',
      description: 'Pergunta (somente leitura) à Agente de outro sistema Murade, sem o usuário precisar abrir aquele sistema. Use consulta="robos" para saber se os robôs do outro sistema estão ativos e o que fazem; "resumo" para o estado geral. Pode não haver resposta se o outro sistema estiver dormindo ou fora do ar: diga isso com as palavras devolvidas.',
      parameters: { type: 'OBJECT', properties: { sistema: SISTEMA_PROP, consulta: { type: 'STRING', description: 'Nome da consulta: robos ou resumo.' }, cnpj: { type: 'STRING', description: 'CNPJ (opcional).' } }, required: ['sistema', 'consulta'] },
    },
    async executar(ctx, args) {
      if (!ctx.central) return SEM_CENTRAL;
      const s = sistemaDe(args.sistema);
      if (!s) return { erro: 'Sistema inválido. Use dp, fiscal, contabil ou fiscoia.' };
      const r = await ctx.central.perguntar(s, String(args.consulta || '').slice(0, 40), cnpjOpc(args.cnpj));
      return r.ok ? { sistema: NOME_SISTEMA[s], dados: r.dados } : { erro: r.erro };
    },
  },
  {
    tipo: 'acao',
    declaracao: {
      name: 'pedir_a_outro_sistema',
      description: 'Propõe enviar um PEDIDO à Agente de outro sistema (ex.: "o Fiscal precisa mandar as notas de entrada de abril da empresa X"). O pedido cai na caixa de pedidos de lá e só é atendido lá, por quem opera aquele sistema. Você nunca executa no outro sistema. Vira cartão de confirmação para o usuário.',
      parameters: { type: 'OBJECT', properties: { sistema: SISTEMA_PROP, texto: { type: 'STRING', description: 'O que está sendo pedido, completo e autoexplicativo.' }, cnpj: { type: 'STRING', description: 'CNPJ da empresa, se for o caso.' } }, required: ['sistema', 'texto'] },
    },
    async preparar(ctx, args) {
      if (!ctx.central) return SEM_CENTRAL;
      const s = sistemaDe(args.sistema); const texto = typeof args.texto === 'string' ? args.texto.trim() : '';
      if (!s) return { erro: 'Sistema inválido. Use dp, fiscal, contabil ou fiscoia.' };
      if (texto.length < 5 || texto.length > 1000) return { erro: 'Descreva o pedido (entre 5 e 1000 caracteres).' };
      const cnpj = cnpjOpc(args.cnpj);
      return { cnpj: cnpj || '', params: { sistema: s, texto, cnpj }, titulo: `Enviar pedido ao ${NOME_SISTEMA[s]}`, descricao: [texto], aviso: 'O pedido só será atendido quando alguém do outro sistema aceitar. Você acompanha o andamento aqui.', resumo: `Pedido ao ${NOME_SISTEMA[s]}: ${texto.slice(0, 120)}` };
    },
    async executar(ctx, params) {
      if (!ctx.central) return { sucesso: false, mensagem: SEM_CENTRAL.erro };
      const p = await ctx.central.pedir(params.sistema, params.texto, params.cnpj);
      return p.estado === 'enviado'
        ? { sucesso: true, mensagem: `Pedido entregue ao ${NOME_SISTEMA[p.para]} (protocolo ${p.id.slice(0, 8)}).` }
        : { sucesso: true, mensagem: `Pedido guardado (protocolo ${p.id.slice(0, 8)}), mas o ${NOME_SISTEMA[p.para]} não respondeu agora (${p.erro}). Vou reenviar automaticamente.` };
    },
  },
  {
    tipo: 'leitura',
    declaracao: {
      name: 'ver_pedidos_entre_sistemas',
      description: 'Lista os pedidos recebidos de outros sistemas (caixa de entrada) e os pedidos que este sistema enviou, com o andamento de cada um.',
      parameters: { type: 'OBJECT', properties: {} },
    },
    async executar(ctx) {
      if (!ctx.central) return SEM_CENTRAL;
      const f = (p: any) => ({ protocolo: p.id, de: NOME_SISTEMA[p.de as SistemaMurade], para: NOME_SISTEMA[p.para as SistemaMurade], cnpj: p.cnpj, texto: p.texto, estado: p.estado, resposta: p.resposta, tentativas: p.tentativas, erro: p.erro, atualizadoEm: p.atualizadoEm });
      return { recebidos: (await ctx.central.caixaDeEntrada(true)).map(f), enviados: (await ctx.central.enviados(false)).slice(0, 15).map(f) };
    },
  },
  {
    tipo: 'acao',
    declaracao: {
      name: 'responder_pedido_de_outro_sistema',
      description: 'Propõe responder um pedido recebido de outro sistema: aceitar (vai fazer), recusar ou marcar como concluído. Responder NÃO executa o trabalho pedido; o trabalho é feito pelas ferramentas deste sistema. Use o protocolo de ver_pedidos_entre_sistemas.',
      parameters: { type: 'OBJECT', properties: { protocolo: { type: 'STRING' }, estado: { type: 'STRING', enum: ['aceito', 'recusado', 'concluido'] }, resposta: { type: 'STRING', description: 'Mensagem curta para quem pediu.' } }, required: ['protocolo', 'estado', 'resposta'] },
    },
    async preparar(ctx, args) {
      if (!ctx.central) return SEM_CENTRAL;
      const protocolo = String(args.protocolo || ''); const estado = args.estado; const resposta = String(args.resposta || '').trim();
      if (!['aceito', 'recusado', 'concluido'].includes(estado)) return { erro: 'Estado inválido.' };
      if (!resposta) return { erro: 'Escreva a resposta para quem pediu.' };
      const aberto = (await ctx.central.caixaDeEntrada(true)).find((p) => p.id === protocolo || p.id.startsWith(protocolo) && protocolo.length >= 8);
      if (!aberto) return { erro: 'Pedido não encontrado entre os abertos.' };
      return { cnpj: aberto.cnpj || '', params: { id: aberto.id, estado, resposta }, titulo: `Responder pedido do ${NOME_SISTEMA[aberto.de]}: ${estado}`, descricao: [`Pedido: ${aberto.texto}`, `Resposta: ${resposta}`], resumo: `Resposta (${estado}) ao pedido ${aberto.id.slice(0, 8)}` };
    },
    async executar(ctx, params) {
      if (!ctx.central) return { sucesso: false, mensagem: SEM_CENTRAL.erro };
      const r = await ctx.central.responder(params.id, params.estado, params.resposta);
      return { sucesso: true, mensagem: r.avisado ? 'Resposta enviada a quem pediu.' : 'Resposta salva, mas o outro sistema não confirmou o recebimento agora; ele verá o andamento quando voltar.' };
    },
  },
];

export const INSTRUCAO_ENTRE_SISTEMAS = `
OUTROS SISTEMAS (Departamento Pessoal, Fiscal, Contábil — cada um tem a própria Agente)
- Se o usuário perguntar algo que é de outro sistema, use perguntar_a_outro_sistema (consultas: robos, resumo) em vez de mandá-lo abrir o outro sistema. Se falhar, diga o motivo e que ele pode tentar de novo.
- Se ele quiser que o outro sistema faça algo, use pedir_a_outro_sistema. Você não executa nada lá: o pedido vai para a caixa da Agente de lá e só é atendido por quem opera aquele sistema. Diga o protocolo e que ele acompanha em ver_pedidos_entre_sistemas.
- Quando houver pedidos recebidos, avise o usuário. Responder um pedido (responder_pedido_de_outro_sistema) não faz o trabalho; faça-o com as ferramentas deste sistema e depois marque como concluído.
- Nunca diga que o outro sistema fez algo sem o estado "concluido" no pedido.`;
