/**
 * Resumos de referência para planejamento. Não substituem a leitura da lei nem
 * determinam incidência para uma empresa. Revisar as fontes oficiais antes de
 * alterar esta base e incrementar VERSAO_REGRAS quando publicar uma revisão.
 */
export type RegraReforma = {
  id: string;
  vigencia: string;
  referencia: string;
  titulo: string;
  mudanca: string;
  efeito: string;
  fonte: { titulo: string; url: string };
};

export const VERSAO_REGRAS = '2026.10.18';
export const REGRAS_REVISADAS_EM = '2026-10-18';

export const FONTES_OFICIAIS_REFORMA = {
  legislacao: {
    titulo: 'Legislação da Reforma Tributária do Consumo — Receita Federal',
    url: 'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/legislacao',
  },
  cronograma: {
    titulo: 'Entenda a Reforma Tributária do Consumo — Receita Federal',
    url: 'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/entenda',
  },
  orientacoes: {
    titulo: 'Orientações da Reforma Tributária do Consumo — Receita Federal',
    url: 'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-da-reforma-tributaria',
  },
  simples: {
    titulo: 'CGSN atualiza regras do Simples Nacional para adequação à Reforma — Receita Federal',
    url: 'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/agosto/cgsn-atualiza-regras-do-simples-nacional-para-adequacao-a-reforma-tributaria-do-consumo',
  },
  lei214: {
    titulo: 'Lei Complementar nº 214/2025 — texto compilado, Planalto',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214compilado.htm',
  },
} as const;

export const ITENS_LEI: RegraReforma[] = [
  {
    id: 'fase_teste', vigencia: '2026', referencia: 'LC 214/2025, art. 346 e alterações posteriores',
    titulo: 'Ano de teste CBS e IBS',
    mudanca: 'A legislação prevê alíquotas de teste de CBS (0,9%) e IBS (0,1%) em 2026, observadas as regras de compensação e as condições legais e acessórias vigentes.',
    efeito: 'Revisar emissão e escrituração dos documentos fiscais e acompanhar as orientações oficiais aplicáveis à atividade.',
    fonte: FONTES_OFICIAIS_REFORMA.cronograma,
  },
  {
    id: 'transicao_cbs', vigencia: '2027–2028', referencia: 'EC 132/2023 e LC 214/2025, regras de transição e alterações posteriores',
    titulo: 'CBS substitui PIS/COFINS; início da transição do IBS',
    mudanca: 'Começa a substituição de PIS/COFINS pela CBS e ocorre a fase inicial da transição do IBS, conforme legislação e cronograma oficiais atualizados.',
    efeito: 'Verificar parametrização fiscal, documentos e apropriação de créditos por operação e regime.',
    fonte: FONTES_OFICIAIS_REFORMA.cronograma,
  },
  {
    id: 'credito', vigencia: 'Conforme implantação do regime', referencia: 'LC 214/2025, arts. 47–51, com alterações posteriores',
    titulo: 'Créditos de IBS/CBS e vedações',
    mudanca: 'O crédito depende das condições legais, do regime e da operação; existem hipóteses sem crédito e regras específicas. Optantes do Simples que mantêm o recolhimento unificado não são tratados automaticamente como contribuintes do regime regular.',
    efeito: 'Classificar aquisição por aquisição e conferir o regime escolhido. Percentual informado no simulador não prova elegibilidade nem direito ao crédito.',
    fonte: FONTES_OFICIAIS_REFORMA.lei214,
  },
  {
    id: 'simples', vigencia: 'Opções para 2027 e períodos seguintes', referencia: 'LC 214/2025, art. 41; Resoluções CGSN 183/2025, 186/2026, 190/2026 e 191/2026',
    titulo: 'Simples: recolhimento unificado ou IBS/CBS regular',
    mudanca: 'Há regras de opção para recolhimento de IBS/CBS pelo regime regular, mantendo o Simples para os demais tributos. Períodos, prazos e procedimentos dependem dos atos vigentes do CGSN e da Receita Federal.',
    efeito: 'Comparar cadeia de clientes, créditos, compras e fluxo de caixa com profissional responsável; o sistema não recomenda nem altera a opção.',
    fonte: FONTES_OFICIAIS_REFORMA.simples,
  },
  {
    id: 'transicao_icms_iss', vigencia: '2029–2032', referencia: 'EC 132/2023 e LC 214/2025, regras de transição e alterações posteriores',
    titulo: 'Redução gradual de ICMS/ISS e avanço do IBS',
    mudanca: 'A transição de ICMS/ISS para IBS ocorre gradualmente de 2029 a 2032, com conclusão do novo modelo em 2033, conforme regras vigentes.',
    efeito: 'Mapear benefícios, operações por destino, contratos e preços; alíquotas efetivas dependem de legislação aplicável e da atividade.',
    fonte: FONTES_OFICIAIS_REFORMA.cronograma,
  },
  {
    id: 'seletivo', vigencia: 'A partir de 2027, conforme incidência legal', referencia: 'LC 214/2025, Livro II, com alterações posteriores',
    titulo: 'Imposto Seletivo',
    mudanca: 'Tributo federal aplicável a bens e serviços definidos em lei, conforme natureza do produto ou operação e regulamentação vigente.',
    efeito: 'Verificar classificação e enquadramento por item. O módulo não presume incidência com base apenas no CNAE geral.',
    fonte: FONTES_OFICIAIS_REFORMA.lei214,
  },
  {
    id: 'integral', vigencia: '2033', referencia: 'EC 132/2023 e LC 214/2025, com alterações posteriores',
    titulo: 'Novo modelo integral',
    mudanca: 'Conclusão da transição de ICMS/ISS para IBS e funcionamento do novo sistema conforme regras vigentes.',
    efeito: 'A carga final exige alíquotas aplicáveis, classificação por operação e créditos comprovados; este painel não calcula obrigação oficial.',
    fonte: FONTES_OFICIAIS_REFORMA.legislacao,
  },
];
