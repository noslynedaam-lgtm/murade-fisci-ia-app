// Pedido longo por etapas (arquivo idêntico no Fiscal, DP, Contábil, Fisco IA e Agente IA).
//
// Regra do dono: a Agente IA NUNCA recusa um pedido por ser grande. A pessoa pode digitar uma carta: a Agente
// lista os pedidos ("Entendi 3 pedidos: 1) …, 2) …, 3) …. Vou por etapa."), faz a etapa 1 e oferece a próxima.
// "próximo", "continua", "segue", "pode seguir" (e "sim" logo depois da oferta) fazem a etapa seguinte com o
// TEXTO ORIGINAL guardado aqui no servidor — o histórico da conversa corta cada turno e não serve para isso.
//
// - Até 500.000 caracteres são lidos. Acima disso, os primeiros 500.000 são aceitos e a resposta avisa do resto.
// - O texto guardado fica só na memória do servidor, por algumas horas, numa chave por usuário/sessão
//   (nunca mistura usuários nem escritórios). Sem custo extra de IA: a divisão em etapas é feita aqui, sem modelo.

export const LIMITE_PEDIDO_CARACTERES = 500_000;
/** Acima disso o texto vai sempre por etapas (o histórico corta cada turno em 8.000). */
export const PEDIDO_LONGO_CARACTERES = 15_000;
const TAMANHO_PARTE = 12_000;
const ITEM_GRANDE_DEMAIS = 30_000;
const MAX_ETAPAS = 40;
const TEXTO_COMPLETO_JUNTO_ATE = 60_000;
const VALIDADE_PLANO_MS = 4 * 60 * 60_000;
const MAX_PLANOS = 500;
const MAX_CARACTERES_GUARDADOS = 40_000_000;

/** Anexada às instruções de todas as Agentes pelo motor (conversar). */
export const REGRA_PEDIDO_LONGO = `

PEDIDO LONGO OU COM VÁRIOS PEDIDOS (regra do dono do sistema)
- Nunca diga que o pedido é grande demais, longo demais, que não consegue ler, que não consegue fazer tudo ou que a pessoa precisa resumir ou anexar. Todo texto que chega até você é atendido, por etapas.
- Se a mensagem trouxer vários pedidos e NÃO vier marcada com [ETAPA ...], comece com a lista curta ("Entendi 3 pedidos: 1) …, 2) …, 3) …. Vou por etapa."), faça só o primeiro e termine com "Próximo: 2) … — quer que eu siga?".
- Quando a mensagem vier marcada com [ETAPA x DE n], o sistema guardou o texto completo e está conduzindo as etapas: faça somente aquela etapa, sem repetir a lista e sem perguntar se pode seguir (o sistema já mostra a lista e oferece a próxima sozinho).`;

export interface Etapa { titulo: string; texto: string }

interface PlanoDeEtapas {
  etapas: Etapa[];
  preambulo: string;
  textoCompleto: string;
  proxima: number;
  /** true logo depois de a Agente oferecer a próxima etapa: aí um "sim" curto também continua. */
  ofereceuProxima: boolean;
  expiraEmMs: number;
}

export class ArmazemDeEtapas {
  private planos = new Map<string, PlanoDeEtapas>();
  constructor(private agora: () => number = () => Date.now()) {}

  private limpar(): void {
    const t = this.agora();
    for (const [chave, p] of this.planos) if (p.expiraEmMs <= t) this.planos.delete(chave);
    // Proteção de memória: descarta os mais antigos (Map guarda a ordem de inserção).
    let total = [...this.planos.values()].reduce((s, p) => s + p.textoCompleto.length, 0);
    for (const [chave, p] of this.planos) {
      if (this.planos.size <= MAX_PLANOS && total <= MAX_CARACTERES_GUARDADOS) break;
      this.planos.delete(chave);
      total -= p.textoCompleto.length;
    }
  }

  guardar(chave: string, plano: Omit<PlanoDeEtapas, 'expiraEmMs'>): void {
    this.planos.delete(chave);
    this.planos.set(chave, { ...plano, expiraEmMs: this.agora() + VALIDADE_PLANO_MS });
    this.limpar();
  }

  obter(chave: string): PlanoDeEtapas | null {
    this.limpar();
    const p = this.planos.get(chave);
    if (!p) return null;
    p.expiraEmMs = this.agora() + VALIDADE_PLANO_MS;
    return p;
  }

  descartar(chave: string): void { this.planos.delete(chave); }
  tamanho(): number { this.limpar(); return this.planos.size; }
}

/** Chave do plano: sempre por usuário e sessão (nunca compartilhada entre pessoas). */
export function chaveDeEtapas(...partes: Array<string | number | null | undefined>): string {
  const ok = partes.map((p) => String(p ?? '').trim()).filter(Boolean);
  return ok.length ? ok.join('|') : '';
}

export function limitarPedido(texto: string): { texto: string; cortado: boolean; tamanhoOriginal: number } {
  const t = String(texto ?? '');
  if (t.length <= LIMITE_PEDIDO_CARACTERES) return { texto: t, cortado: false, tamanhoOriginal: t.length };
  return { texto: t.slice(0, LIMITE_PEDIDO_CARACTERES), cortado: true, tamanhoOriginal: t.length };
}

const milhar = (n: number) => n.toLocaleString('pt-BR');
export function avisoDeTextoCortado(tamanhoOriginal: number): string {
  return `Atenção: seu texto tinha ${milhar(tamanhoOriginal)} caracteres e eu li só os primeiros ${milhar(LIMITE_PEDIDO_CARACTERES)}. O resto não foi lido: mande o restante numa próxima mensagem que eu continuo dele.`;
}

function encurtar(texto: string, max = 80): string {
  const t = texto.replace(/\s+/g, ' ').trim().replace(/[\s,;:.\-–—]+$/, '');
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const espaco = corte.lastIndexOf(' ');
  return `${(espaco > max * 0.5 ? corte.slice(0, espaco) : corte).replace(/[\s,;:.\-–—]+$/, '')}…`;
}

// Item numerado no começo da linha: "1)", "1.", "1 -", "1:", "1º", "Pedido 1", "Item 2:", "Pergunta nº 3 -".
const ITEM_COM_PALAVRA = /^[ \t]*(?:pedido|item|tarefa|ponto|quest[aã]o|pergunta|assunto)\s*(?:n[º°o.]?\s*)?(\d{1,3})\s*(?:[).:\-–—]|[º°ª])?[ \t]*/i;
const ITEM_NUMERADO = /^[ \t]*(\d{1,3})\s*(?:[):\-–—]|\.(?!\d)|[º°ª][).:\-–—]?)[ \t]+(?=\S)/;

/** Acha os pedidos numerados em sequência (1, 2, 3...). Devolve os inícios de cada item no texto. */
function acharItensNumerados(texto: string): Array<{ inicio: number; inicioConteudo: number }> {
  const itens: Array<{ inicio: number; inicioConteudo: number }> = [];
  let esperado = 1;
  let pos = 0;
  for (const linha of texto.split('\n')) {
    const m = ITEM_COM_PALAVRA.exec(linha) || ITEM_NUMERADO.exec(linha);
    if (m && Number(m[1]) === esperado) {
      itens.push({ inicio: pos, inicioConteudo: pos + m[0].length });
      esperado += 1;
    }
    pos += linha.length + 1;
  }
  if (itens.length >= 2) return itens;
  // Tudo numa linha só (ditado por voz, ou colado numa caixa de uma linha que junta as linhas): "1) ... 2) ... 3) ...".
  // Aqui o ponto não vale como marcador ("item 3. Depois..." é fim de frase), só ")", "-", ":" e "º".
  const naLinha: Array<{ inicio: number; inicioConteudo: number }> = [];
  let esperadoNaLinha = 1;
  const re = /(?<![\d.,/])(\d{1,3})\s*(?:\)|[º°ª]?\s*[:\-–—]|[º°ª])[ \t]+(?=\S)/g;
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    if (Number(m[1]) !== esperadoNaLinha) continue;
    naLinha.push({ inicio: m.index, inicioConteudo: m.index + m[0].length });
    esperadoNaLinha += 1;
  }
  return naLinha.length >= 2 ? naLinha : itens;
}

/** Corta o texto em partes de até ~TAMANHO_PARTE, preferindo fim de parágrafo e depois fim de frase. */
export function partirPorTamanho(texto: string, alvo = TAMANHO_PARTE): string[] {
  const partes: string[] = [];
  let resto = texto.trim();
  while (resto.length > alvo) {
    const janela = resto.slice(0, alvo);
    let corte = janela.lastIndexOf('\n\n');
    if (corte < alvo * 0.5) corte = Math.max(janela.lastIndexOf('\n'), janela.lastIndexOf('. '), janela.lastIndexOf('? '), janela.lastIndexOf('! '));
    if (corte < alvo * 0.5) corte = janela.lastIndexOf(' ');
    if (corte < alvo * 0.5) corte = alvo - 1;
    partes.push(resto.slice(0, corte + 1).trim());
    resto = resto.slice(corte + 1).trim();
  }
  if (resto) partes.push(resto);
  return partes.filter(Boolean);
}

/** Divide o pedido em etapas: pelos itens numerados quando existem; senão, por tamanho. */
export function dividirEmEtapas(texto: string): { preambulo: string; etapas: Etapa[]; numerados: number } {
  const t = String(texto ?? '').replace(/\r\n?/g, '\n');
  const itens = acharItensNumerados(t);
  let preambulo = '';
  let etapas: Etapa[] = [];
  if (itens.length >= 2) {
    preambulo = t.slice(0, itens[0].inicio).trim();
    for (let i = 0; i < itens.length; i += 1) {
      const conteudo = t.slice(itens[i].inicioConteudo, i + 1 < itens.length ? itens[i + 1].inicio : t.length).trim();
      const titulo = encurtar(conteudo.split('\n').find((l) => l.trim()) || `pedido ${i + 1}`);
      if (conteudo.length > ITEM_GRANDE_DEMAIS) {
        const pedacos = partirPorTamanho(conteudo);
        pedacos.forEach((p, j) => etapas.push({ titulo: `${titulo} (parte ${j + 1} de ${pedacos.length})`, texto: p }));
      } else etapas.push({ titulo, texto: conteudo });
    }
  } else {
    etapas = partirPorTamanho(t).map((p) => ({ titulo: `parte que começa com “${encurtar(p, 60)}”`, texto: p }));
  }
  // Muitos itens pequenos: junta em grupos para não passar de MAX_ETAPAS.
  if (etapas.length > MAX_ETAPAS) {
    const grupo = Math.ceil(etapas.length / MAX_ETAPAS);
    const juntas: Etapa[] = [];
    for (let i = 0; i < etapas.length; i += grupo) {
      const bloco = etapas.slice(i, i + grupo);
      juntas.push({
        titulo: bloco.length === 1 ? bloco[0].titulo : `itens ${i + 1} a ${i + bloco.length} (${bloco[0].titulo}…)`,
        texto: bloco.map((e, j) => `${i + j + 1}) ${e.texto}`).join('\n\n'),
      });
    }
    etapas = juntas;
  }
  return { preambulo, etapas, numerados: itens.length };
}

/** O pedido vai por etapas? Texto longo sempre; lista numerada com 3+ itens (ou 2+ num texto já grande) também. */
export function precisaDeEtapas(texto: string, divisao = dividirEmEtapas(texto)): boolean {
  if (divisao.etapas.length < 2) return false;
  const n = texto.length;
  if (n > PEDIDO_LONGO_CARACTERES) return true;
  if (divisao.numerados >= 3 && n >= 1_500) return true;
  return divisao.numerados >= 2 && n > 8_000;
}

const normalizar = (texto: string) => String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const CONTINUAR = /^(?:(?:pode|podes|vamos|vai|bora|entao|ok|beleza|certo|sim)\s+)?(?:proximo|proxima|proxima etapa|proximo pedido|proximo item|continua|continue|continuar|continuando|segue|seguir|siga|pode seguir|pode continuar|avanca|avancar|manda o proximo|faz o proximo|faca o proximo|vai pro proximo|vai para o proximo|outra etapa|seguinte)\b/;
const SIM_CURTO = /^(sim|pode|quero|isso|ok|okay|certo|claro|vai|vamos|manda|bora|faz|faca|positivo|uhum|aham|ta bom|ta|tudo bem|com certeza|por favor|beleza|blz)\b/;

/** "próximo", "continua", "segue", "pode seguir" sempre continuam; "sim" curto só logo depois de a Agente oferecer a próxima. */
export function ehPedidoDeContinuar(mensagem: string, ofereceuProxima: boolean): boolean {
  const t = normalizar(mensagem);
  if (!t || t.split(' ').length > 12 || mensagem.length > 200) return false;
  if (CONTINUAR.test(t)) return true;
  return ofereceuProxima && SIM_CURTO.test(t) && t.split(' ').length <= 8;
}

function listaCurta(etapas: Etapa[], max = 15): string {
  const itens = etapas.slice(0, max).map((e, i) => `${i + 1}) ${e.titulo}`);
  const mais = etapas.length > max ? `; e mais ${etapas.length - max}` : '';
  return `${itens.join('; ')}${mais}`;
}

function mensagemDaEtapa(plano: PlanoDeEtapas, indice: number, falaDaPessoa: string): string {
  const n = plano.etapas.length;
  const etapa = plano.etapas[indice];
  const partes = [
    `[ETAPA ${indice + 1} DE ${n} — o sistema guardou o texto completo da pessoa e está conduzindo o pedido por etapas.]`,
    `Lista das etapas (só para você se situar; não repita): ${listaCurta(plano.etapas, 40)}.`,
    `Faça AGORA somente a etapa ${indice + 1}: ${etapa.titulo}. Não diga que o texto é grande, não recuse, não repita a lista e não pergunte se pode seguir: o sistema mostra a lista e oferece a próxima etapa sozinho.`,
  ];
  if (falaDaPessoa) partes.push(`A pessoa pediu para continuar dizendo: "${falaDaPessoa.slice(0, 200)}". Se ela acrescentou algum detalhe, siga o detalhe dentro desta etapa.`);
  if (plano.preambulo) partes.push(`--- COMEÇO DO TEXTO DA PESSOA (contexto de todas as etapas) ---\n${plano.preambulo.slice(0, 4_000)}\n--- FIM DO COMEÇO ---`);
  partes.push(`--- TEXTO DA ETAPA ${indice + 1} ---\n${etapa.texto}\n--- FIM DA ETAPA ${indice + 1} ---`);
  if (plano.textoCompleto.length <= TEXTO_COMPLETO_JUNTO_ATE) partes.push(`--- TEXTO COMPLETO DA PESSOA (só para consulta; responda apenas a etapa ${indice + 1}) ---\n${plano.textoCompleto}\n--- FIM DO TEXTO COMPLETO ---`);
  return partes.join('\n\n');
}

export interface InfoEtapas { atual: number; total: number; restantes: number }
export interface PedidoPreparado {
  /** O que vai para o modelo no lugar da mensagem crua. */
  mensagem: string;
  etapa: InfoEtapas | null;
  /** Monta a resposta final (lista, etapa, próximo, aviso de corte) e avança o plano. Chamar só se o modelo respondeu. */
  concluir(respostaDoModelo: string): { resposta: string; etapas?: InfoEtapas; textoCortado?: true };
}

/**
 * Prepara a mensagem da pessoa: corta acima de 500.000 (com aviso), continua uma etapa guardada ou cria o plano
 * de etapas de um pedido longo. Sem `chave` (sem usuário identificado) só corta e avisa, nunca guarda nada.
 */
export function prepararPedido(armazem: ArmazemDeEtapas, chave: string, bruto: string): PedidoPreparado {
  const lim = limitarPedido(String(bruto ?? '').trim());
  const aviso = lim.cortado ? avisoDeTextoCortado(lim.tamanhoOriginal) : '';
  const comAviso = (r: string) => (aviso ? `${r}\n\n${aviso}` : r);
  const plano = chave ? armazem.obter(chave) : null;

  const montarEtapa = (p: PlanoDeEtapas, indice: number, abertura: string): PedidoPreparado => {
    const total = p.etapas.length;
    return {
      mensagem: mensagemDaEtapa(p, indice, abertura ? '' : lim.texto),
      etapa: { atual: indice + 1, total, restantes: total - indice - 1 },
      concluir(respostaDoModelo) {
        const titulo = `Etapa ${indice + 1} de ${total} — ${p.etapas[indice].titulo}`;
        const restantes = total - indice - 1;
        p.proxima = Math.max(p.proxima, indice + 1);
        p.ofereceuProxima = restantes > 0;
        if (restantes === 0) armazem.descartar(chave);
        const fim = restantes > 0
          ? `Próximo: ${indice + 2}) ${p.etapas[indice + 1].titulo} — quer que eu siga?`
          : `Pronto: essa foi a última etapa (${total} de ${total}).`;
        const resposta = [abertura, titulo, String(respostaDoModelo || '').trim(), fim].filter(Boolean).join('\n\n');
        return { resposta: comAviso(resposta), etapas: { atual: indice + 1, total, restantes }, ...(lim.cortado ? { textoCortado: true as const } : {}) };
      },
    };
  };

  // 1) Continuar a etapa guardada.
  if (plano && plano.proxima < plano.etapas.length && ehPedidoDeContinuar(lim.texto, plano.ofereceuProxima)) {
    return montarEtapa(plano, plano.proxima, '');
  }
  if (plano) plano.ofereceuProxima = false; // assunto novo: "sim" deixa de valer como "próximo" (as palavras explícitas continuam valendo)

  // 2) Pedido novo longo ou com vários pedidos: guarda e começa pela etapa 1.
  const divisao = dividirEmEtapas(lim.texto);
  if (chave && precisaDeEtapas(lim.texto, divisao)) {
    const novo: Omit<PlanoDeEtapas, 'expiraEmMs'> = { etapas: divisao.etapas, preambulo: divisao.preambulo, textoCompleto: lim.texto, proxima: 0, ofereceuProxima: false };
    armazem.guardar(chave, novo);
    const guardado = armazem.obter(chave)!;
    const n = divisao.etapas.length;
    const abertura = divisao.numerados >= 2
      ? `Entendi ${n} pedidos: ${listaCurta(divisao.etapas)}. Vou por etapa.`
      : `Seu texto tem ${milhar(lim.texto.length)} caracteres. Para não deixar nada para trás, dividi em ${n} partes: ${listaCurta(divisao.etapas)}. Vou por etapa.`;
    return montarEtapa(guardado, 0, abertura);
  }

  // 3) Pedido comum (cortado, se passou do limite).
  return {
    mensagem: lim.texto,
    etapa: null,
    concluir: (respostaDoModelo) => ({ resposta: comAviso(String(respostaDoModelo || '').trim()), ...(lim.cortado ? { textoCortado: true as const } : {}) }),
  };
}
