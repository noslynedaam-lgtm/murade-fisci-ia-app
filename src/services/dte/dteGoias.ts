/**
 * DT-e de Goiás (Domicílio Tributário Eletrônico da Secretaria de Estado da Economia): guia oficial para o contador e checklist por empresa.
 * Só fonte oficial: Perguntas e Respostas do DT-e (goias.gov.br/economia), "Sobre o DTE", RCTE (Decreto nº 4.852/97, arts. 99-A a 99-H,
 * incluídos pelo Decreto nº 7.688/2012) e IN nº 1.124/2012-GSF. As perguntas citadas (P1, P14...) são as da página oficial.
 *
 * O sistema NÃO lê a caixa do DT-e sozinho: não há serviço oficial (API) para isso, o acesso é só pelo portal com certificado digital,
 * e abrir a comunicação dá ciência formal (IN 1.124/2012, art. 12), o que começa a contar prazo para o cliente.
 * Peças puras: sem rede e sem banco.
 */

export const LINKS_DTE = {
  painel: 'https://dte.sefaz.go.gov.br/dte/web/https/painelControle.jsf',
  credenciamento: 'https://dte.sefaz.go.gov.br/dte/web/https/credenciamento.jsf',
  perguntas: 'https://goias.gov.br/economia/domicilio-tributario-eletronico-dte-perguntas-e-respostas/',
  sobre: 'https://goias.gov.br/economia/sobre-o-dte/',
  decreto7688: 'https://appasp.economia.go.gov.br/legislacao/arquivos/DECRETOS/D_07688.htm',
  in1124: 'https://appasp.economia.go.gov.br/legislacao/arquivos/secretario/IN/IN_1124_2012.htm',
} as const;
export const EMAIL_REMETENTE_DTE = 'dte.economia@goias.gov.br';
export const CONTATO_DTE = { email: 'dte.economia@goias.gov.br', telefone: '(62) 3309-6950' };

export interface PassoGuia { titulo: string; itens: string[]; fonte: string; link: string }

export const GUIA_DTE: PassoGuia[] = [
  {
    titulo: '1. O que é e quem precisa',
    itens: [
      'O DT-e é a caixa postal eletrônica da Secretaria da Economia de Goiás, onde chegam as comunicações oficiais, inclusive notificações e intimações.',
      'É obrigatório para os contribuintes do ICMS (inclusive substituto tributário de outro estado inscrito em Goiás) e para optantes do Simples Nacional credenciados a emitir NF-e, NFC-e ou CT-e.',
      'É facultativo (pode se credenciar, mas não é obrigado) para o MEI, para quem tem inscrição estadual mas não é contribuinte do ICMS (ex.: construtora) e para o produtor rural ou extrator que não emite NF-e nem tem inscrição centralizada.',
      'O credenciamento vale para todos os estabelecimentos da empresa; cada estabelecimento tem a sua caixa postal.',
    ],
    fonte: 'Perguntas e Respostas do DT-e (P2, P6, P9, P10, P12, P13, P24); RCTE, arts. 99-A a 99-D; IN nº 1.124/2012-GSF, art. 3º',
    link: LINKS_DTE.perguntas,
  },
  {
    titulo: '2. Credenciar a empresa (feito com o certificado DA EMPRESA)',
    itens: [
      'O DT-e só abre com certificado digital ICP-Brasil; não há acesso sem certificado.',
      'O credenciamento é feito com o e-CNPJ de um dos estabelecimentos da própria empresa, na página de credenciamento do DT-e.',
      'NÃO serve o e-CPF do contador, o e-CNPJ do escritório contábil nem o e-CPF do sócio para credenciar.',
      'Empresa baixada ou suspensa no cadastro de Goiás, mas com CNPJ ativo na Receita Federal, também deve se credenciar.',
    ],
    fonte: 'Perguntas e Respostas do DT-e (P1, P4, P5, P22, P26); RCTE, art. 99-E',
    link: LINKS_DTE.credenciamento,
  },
  {
    titulo: '3. Cadastrar o e-mail do escritório para receber os avisos do cliente',
    itens: [
      'Cada estabelecimento aceita UM e-mail de aviso. Ele é informado e pode ser trocado a qualquer momento na funcionalidade de credenciamento do DT-e (entrando com o e-CNPJ da empresa).',
      'Para o escritório receber os avisos de cada cliente: entre no credenciamento com o e-CNPJ da empresa cliente e informe o e-mail do escritório. Como só cabe um e-mail, combine com o cliente (ele deixa de receber o aviso no e-mail dele).',
      'O aviso chega no dia em que a correspondência é postada. Se não chegar: confira o endereço, se a caixa de e-mail não está cheia e coloque ' + EMAIL_REMETENTE_DTE + ' nos remetentes confiáveis.',
      'O e-mail é só um aviso: não receber a mensagem não pode ser alegado como desconhecimento, e ler o e-mail não substitui a ciência na caixa postal.',
    ],
    fonte: 'Perguntas e Respostas do DT-e (P19, P20, P21); IN nº 1.124/2012-GSF, art. 14',
    link: LINKS_DTE.perguntas,
  },
  {
    titulo: '4. Procuração do DT-e para o escritório (é feita DENTRO do DT-e)',
    itens: [
      'A procuração eletrônica da Receita Federal (e-CAC) NÃO vale para o DT-e de Goiás. A procuração precisa ser cadastrada no próprio DT-e.',
      'Quem dá a procuração é a empresa já credenciada, entrando no DT-e com o certificado de qualquer estabelecimento dela (o sistema deixa escolher o outorgante), na parte de procuração eletrônica. O guia oficial não descreve as telas: o nome do menu pode mudar.',
      'Na procuração, indique o CPF ou CNPJ do procurador (o contador ou o escritório) e os poderes: amplo (todas as caixas postais), restrito (uma ou algumas) ou particularizado (só certos tipos de comunicação). Substabelecer só é possível se a procuração permitir.',
      'O contador procurador NÃO precisa se credenciar: entra no DT-e com o próprio e-CPF ou e-CNPJ e acessa a caixa postal de cada cliente que deu procuração, vendo as mensagens do período de vigência. As mensagens não vão para a caixa do procurador.',
      'Não há limite de procuradores por estabelecimento. O sócio com e-CPF acessa a caixa da empresa sem procuração (mas não credencia).',
    ],
    fonte: 'Perguntas e Respostas do DT-e (P5, P14 a P18, P23); RCTE, art. 99-F; IN nº 1.124/2012-GSF, arts. 7º a 9º',
    link: LINKS_DTE.perguntas,
  },
  {
    titulo: '5. Ciência e prazos (por que conferir sempre)',
    itens: [
      'Abrir a comunicação na caixa postal dá ciência formal do conteúdo.',
      'Se ninguém abrir, considera-se a ciência 10 dias depois da postagem. A partir daí os prazos correm, mesmo sem leitura.',
      'Por isso: e-mail do escritório cadastrado, procuração em dia e conferência frequente da caixa de cada cliente.',
    ],
    fonte: 'IN nº 1.124/2012-GSF, arts. 12 e 13; RCTE, art. 99-H',
    link: LINKS_DTE.in1124,
  },
];

export const POR_QUE_SEM_LEITURA_AUTOMATICA = [
  'A Secretaria da Economia não oferece serviço oficial (API) para sistemas lerem a caixa do DT-e: o acesso é só pelo portal, com certificado digital.',
  'Um robô entrando no portal com o certificado do cliente teria de guardar e usar o certificado para isso, e abrir uma mensagem dá ciência formal (começa a contar prazo para o cliente) sem ninguém do escritório ter lido.',
  'Por isso o Fisco IA não entra no DT-e: ele guarda o checklist de cada empresa, avisa o que falta (e-mail, procuração, credenciamento) e lembra a equipe de conferir a caixa.',
];

export const ESTADOS_ITEM = ['tem', 'nao_tem', 'nao_se_aplica'] as const;
export type EstadoItemDte = typeof ESTADOS_ITEM[number];
export const ROTULO_ESTADO: Record<EstadoItemDte, string> = { tem: 'Tem', nao_tem: 'Não tem', nao_se_aplica: 'Não se aplica' };
export const ITENS_CHECKLIST = [
  { campo: 'credenciada', rotulo: 'Empresa credenciada no DT-e', tarefa: 'Credenciar a empresa no DT-e de Goiás (com o e-CNPJ da empresa)' },
  { campo: 'emailAvisos', rotulo: 'E-mail do escritório cadastrado para os avisos', tarefa: 'Cadastrar o e-mail do escritório no credenciamento do DT-e de Goiás' },
  { campo: 'procuracao', rotulo: 'Procuração do DT-e para o escritório', tarefa: 'Pedir ao cliente a procuração eletrônica do DT-e de Goiás para o escritório' },
] as const;
export type CampoChecklist = typeof ITENS_CHECKLIST[number]['campo'];

export interface ChecklistDte {
  empresaId: string; empresa: string; cnpj: string; uf: string | null;
  credenciada: EstadoItemDte | null; emailAvisos: EstadoItemDte | null; procuracao: EstadoItemDte | null;
  revisarEm: string | null; obs: string | null; atualizadoEm: string;
}

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const estadoOuNulo = (v: unknown) => v === null || (ESTADOS_ITEM as readonly unknown[]).includes(v);
function dataValida(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Motivo da recusa, ou null. A chave é o id da empresa. */
export function validarChecklist(chave: string, dados: unknown): string | null {
  if (!UUID.test(chave)) return 'Empresa inválida.';
  if (!obj(dados) || dados.empresaId !== chave) return 'Checklist inválido.';
  if (typeof dados.empresa !== 'string' || dados.empresa.length > 200 || typeof dados.cnpj !== 'string' || dados.cnpj.length > 20) return 'Empresa do checklist inválida.';
  if (dados.uf !== null && (typeof dados.uf !== 'string' || !/^[A-Z]{2}$/.test(dados.uf))) return 'UF inválida.';
  if (!estadoOuNulo(dados.credenciada) || !estadoOuNulo(dados.emailAvisos) || !estadoOuNulo(dados.procuracao)) return 'Marque tem, não tem ou não se aplica.';
  if (dados.revisarEm !== null && !dataValida(dados.revisarEm)) return 'Data do lembrete inválida.';
  if (dados.obs !== null && (typeof dados.obs !== 'string' || dados.obs.length > 500)) return 'Observação inválida.';
  if (typeof dados.atualizadoEm !== 'string' || !Number.isFinite(Date.parse(dados.atualizadoEm))) return 'Data inválida.';
  return null;
}

/** Itens que ainda pedem ação (marcados "não tem" ou ainda não respondidos) de uma empresa. */
export function pendenciasDoChecklist(c: Pick<ChecklistDte, CampoChecklist>): { campo: CampoChecklist; rotulo: string; tarefa: string; situacao: 'nao_tem' | 'sem_resposta' }[] {
  return ITENS_CHECKLIST.filter((i) => c[i.campo] === 'nao_tem' || c[i.campo] === null || c[i.campo] === undefined)
    .map((i) => ({ campo: i.campo, rotulo: i.rotulo, tarefa: i.tarefa, situacao: c[i.campo] === 'nao_tem' ? 'nao_tem' as const : 'sem_resposta' as const }));
}

/** Resumo do escritório: empresas de GO, quantas completas, faltando cada item, sem resposta e lembretes vencidos. hoje = AAAA-MM-DD. */
export function resumoDte(empresasGo: { id: string }[], checklists: unknown[], hoje: string) {
  const mapa = new Map<string, Record<string, unknown>>();
  for (const c of checklists) if (obj(c) && typeof c.empresaId === 'string') mapa.set(c.empresaId, c);
  let completas = 0; let semResposta = 0; let revisaoVencida = 0;
  const faltando: Record<CampoChecklist, number> = { credenciada: 0, emailAvisos: 0, procuracao: 0 };
  for (const e of empresasGo) {
    const c = mapa.get(e.id);
    if (!c) { semResposta += 1; continue; }
    const p = pendenciasDoChecklist(c as any);
    if (p.length === 0) completas += 1;
    for (const x of p) if (x.situacao === 'nao_tem') faltando[x.campo] += 1;
    if (p.some((x) => x.situacao === 'sem_resposta')) semResposta += 1;
    if (dataValida(c.revisarEm) && (c.revisarEm as string) <= hoje) revisaoVencida += 1;
  }
  return { empresasGo: empresasGo.length, completas, semResposta, faltando, revisaoVencida };
}

/** Data AAAA-MM-DD somando dias (para o lembrete de revisão). */
export function somarDias(hoje: string, dias: number): string {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
