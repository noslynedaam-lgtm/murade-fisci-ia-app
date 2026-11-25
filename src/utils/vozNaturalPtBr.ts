// Voz natural da assistente (grátis, do próprio aparelho) — MESMO arquivo nos 5 sistemas Murad
// (DP, Fiscal, Contábil, Fisco IA e Agente IA). Mudou aqui? Copie igual para os outros quatro.
//
// Este módulo não toca no navegador: só escolhe a voz numa lista e prepara o texto para ser falado.
// Assim dá para testar no servidor (números, datas, siglas) e o comportamento é o mesmo em todo lugar.

/** Velocidade e tom que soam naturais nas vozes do aparelho (Edge Natural, Google, iPhone e Android). */
export const VELOCIDADE_NATURAL = 1.0;
export const TOM_NATURAL = 1.0;

// ---------------------------------------------------------------------------------------------
// 1) Escolha da voz
// ---------------------------------------------------------------------------------------------

/** O que interessa de uma voz do navegador (SpeechSynthesisVoice cabe aqui). */
export interface VozDoAparelho {
  name: string;
  lang: string;
  voiceURI?: string;
  localService?: boolean;
  default?: boolean;
}

const idioma = (v: VozDoAparelho): string => String(v.lang || '').toLowerCase().replace('_', '-');
export const ehVozPortugues = (v: VozDoAparelho): boolean => idioma(v) === 'pt' || idioma(v).startsWith('pt-');
export const ehVozPtBr = (v: VozDoAparelho): boolean => idioma(v) === 'pt-br' || (idioma(v) === 'pt' && /brasil|brazil/i.test(v.name));
export const idDaVoz = (v: VozDoAparelho): string => v.voiceURI || v.name;

// Vozes "de brincadeira" do iPhone/Mac (soam caricatas): só se não houver outra.
const CARICATA = /\b(eddy|flo|grandma|grandpa|vov[óoô]|reed|rocko|sandy|shelley|bad news|bells|boing|bubbles|jester|organ|superstar|trinoids|whisper|wobble|zarvox)\b/i;
const MASCULINA = /\b(antonio|antônio|daniel|felipe|ricardo|donato|f[aá]bio|humberto|j[uú]lio|nicolau|val[eé]rio|thiago|rodrigo|duarte|cristiano|male|masculin[ao])\b/i;
const FEMININA = /\b(francisca|thalita|luciana|maria|fernanda|vit[oó]ria|let[ií]cia|camila|raquel|brenda|giovanna|leila|manuela|yara|elza|helena|heloisa|isabela|joana|catarina|female|feminin[ao])\b/i;

/**
 * Nível de naturalidade (maior = mais humana):
 * 4 = "Natural"/"Online (Natural)" do Edge/Windows (Francisca, Thalita);
 * 3 = "Google português do Brasil" (Chrome);
 * 2 = alta qualidade do iPhone/Android ("Enhanced", "Premium", "Melhorada", voz de rede) — grátis, do próprio sistema;
 * 1 = qualquer outra em português; 0 = caricata; -1 = outro idioma (nunca usada para ler português).
 */
export function nivelDaVoz(v: VozDoAparelho): number {
  if (!ehVozPortugues(v)) return -1;
  const nome = String(v.name || '');
  if (CARICATA.test(nome)) return 0;
  if (/\b(natural|neural)\b/i.test(nome) || (/microsoft/i.test(nome) && /\bonline\b/i.test(nome))) return 4;
  if (/\bgoogle\b/i.test(nome)) return 3;
  if (/enhanced|premium|melhorad|aprimorad|avan[cç]ad|alta qualidade|high[- ]quality|network|wavenet|studio|-x-[a-z]+-network/i.test(nome)) return 2;
  return 1;
}

/** Pontos para ordenar: pt-BR sempre antes de pt-PT; dentro do nível, voz feminina (a Agente) antes. */
export function pontosDaVoz(v: VozDoAparelho): number {
  const nivel = nivelDaVoz(v);
  if (nivel < 0) return -1;
  let p = nivel * 100 + (ehVozPtBr(v) ? 1000 : 0);
  const nome = String(v.name || '');
  if (/francisca/i.test(nome)) p += 30;
  else if (/thalita/i.test(nome)) p += 25;
  else if (FEMININA.test(nome)) p += 15;
  if (MASCULINA.test(nome) && !/female|feminin/i.test(nome)) p -= 20;
  if (v.localService === false && nivel <= 2) p += 5; // voz de rede costuma ser melhor que a local
  return p;
}

/**
 * Vozes em português deste aparelho, da mais natural para a menos natural.
 * Havendo alguma pt-BR, só entram as pt-BR. Voz de outro idioma nunca entra.
 */
export function ordenarVozesPtBr<T extends VozDoAparelho>(vozes: readonly T[] | null | undefined): T[] {
  const vistos = new Set<string>();
  const pt = (vozes || []).filter((v) => {
    if (!v || !ehVozPortugues(v)) return false;
    const id = idDaVoz(v);
    if (vistos.has(id)) return false;
    vistos.add(id);
    return true;
  });
  const br = pt.filter(ehVozPtBr);
  const lista = br.length ? br : pt;
  return lista
    .map((v, i) => ({ v, i, p: pontosDaVoz(v) }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .map((x) => x.v);
}

/** A voz a usar: a escolhida pela pessoa (se ainda existir neste aparelho) ou a mais natural. */
export function escolherVozNatural<T extends VozDoAparelho>(vozes: readonly T[] | null | undefined, escolhida?: string | null): T | null {
  const lista = ordenarVozesPtBr(vozes);
  if (escolhida) {
    const achada = lista.find((v) => idDaVoz(v) === escolhida || v.name === escolhida);
    if (achada) return achada;
  }
  return lista[0] || null;
}

/** Nome curto e explicação, para a lista em Configurações. */
export function rotuloDaVoz(v: VozDoAparelho): string {
  const nome = String(v.name || '')
    .replace(/^Microsoft\s+/i, '')
    .replace(/\s*-\s*Portuguese.*$/i, '')
    .replace(/\s*\(Portugu[eê]s.*\)$/i, '')
    .trim() || v.name;
  const nivel = nivelDaVoz(v);
  const tipo = nivel === 4 ? 'muito natural' : nivel === 3 ? 'natural' : nivel === 2 ? 'alta qualidade' : nivel === 0 ? 'caricata' : 'padrão do aparelho';
  const pais = ehVozPtBr(v) ? '' : ' · português de Portugal';
  return `${nome} — ${tipo}${pais}`;
}

// ---------------------------------------------------------------------------------------------
// 2) Números por extenso (português do Brasil)
// ---------------------------------------------------------------------------------------------

const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const ESCALAS: [string, string][] = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões'], ['trilhão', 'trilhões']];

function ateMil(n: number, feminino: boolean): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c) partes.push(feminino && c > 1 ? CENTENAS[c].replace(/os$/, 'as') : CENTENAS[c]);
  if (resto) {
    if (resto < 20) partes.push(UNIDADES[resto]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  let txt = partes.join(' e ');
  if (feminino) txt = txt.replace(/\bum$/, 'uma').replace(/\bdois$/, 'duas');
  return txt;
}

/** 1234 → "mil duzentos e trinta e quatro"; feminino: 2 → "duas" (horas). Até trilhões. */
export function numeroPorExtenso(valor: number, feminino = false): string {
  if (!Number.isFinite(valor)) return '';
  if (valor < 0) return `menos ${numeroPorExtenso(-valor, feminino)}`;
  let n = Math.floor(valor);
  if (n === 0) return 'zero';
  if (n >= 1e15) return String(n).split('').map((d) => UNIDADES[Number(d)]).join(' ');
  const grupos: number[] = [];
  while (n > 0) { grupos.push(n % 1000); n = Math.floor(n / 1000); }
  const naoZeros = grupos.map((g, i) => (g ? i : -1)).filter((i) => i >= 0);
  const ultimo = naoZeros[0]; // grupo de menor ordem que não é zero
  const pedacos: string[] = [];
  for (let i = grupos.length - 1; i >= 0; i -= 1) {
    const g = grupos[i];
    if (!g) continue;
    let txt: string;
    if (i === 0) txt = ateMil(g, feminino);
    else if (i === 1) txt = g === 1 ? 'mil' : `${ateMil(g, feminino)} mil`;
    else txt = `${ateMil(g, false)} ${g === 1 ? ESCALAS[i][0] : ESCALAS[i][1]}`;
    if (pedacos.length && i === ultimo && (g < 100 || g % 100 === 0)) pedacos.push('e');
    pedacos.push(txt);
  }
  return pedacos.join(' ');
}

/** "1.234,56" → 1234.56 (formato brasileiro). Devolve null se não for número. */
function lerNumeroBr(txt: string): { inteiro: number; decimais: string } | null {
  const limpo = txt.replace(/\s/g, '');
  const m = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?$/.exec(limpo);
  if (!m) return null;
  return { inteiro: Number(m[1].replace(/\./g, '')), decimais: m[2] || '' };
}

function decimalPorExtenso(inteiro: number, decimais: string): string {
  const base = numeroPorExtenso(inteiro);
  if (!decimais || /^0+$/.test(decimais)) return base;
  const zeros = /^0*/.exec(decimais)?.[0].length || 0;
  const resto = decimais.slice(zeros);
  const falaDecimais = [...Array(zeros).fill('zero'), resto.length > 3 ? resto.split('').map((d) => UNIDADES[Number(d)]).join(' ') : numeroPorExtenso(Number(resto))].join(' ');
  return `${base} vírgula ${falaDecimais}`;
}

/** R$ 1.234,56 → "mil duzentos e trinta e quatro reais e cinquenta e seis centavos". */
export function reaisPorExtenso(inteiro: number, centavos: number): string {
  const partes: string[] = [];
  if (inteiro > 0) {
    const ext = numeroPorExtenso(inteiro);
    // "um milhão de reais", "dois bilhões de reais"
    const de = inteiro >= 1e6 && inteiro % 1e6 === 0 ? ' de' : '';
    partes.push(`${ext}${de} ${inteiro === 1 ? 'real' : 'reais'}`);
  }
  if (centavos > 0) partes.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  if (!partes.length) return 'zero real';
  return partes.join(' e ');
}

const ORD_UNID = ['', 'primeir', 'segund', 'terceir', 'quart', 'quint', 'sext', 'sétim', 'oitav', 'non'];
const ORD_DEZ = ['', 'décim', 'vigésim', 'trigésim', 'quadragésim', 'quinquagésim', 'sexagésim', 'septuagésim', 'octogésim', 'nonagésim'];
const ORD_CEM = ['', 'centésim', 'ducentésim', 'tricentésim', 'quadringentésim', 'quingentésim', 'sexcentésim', 'septingentésim', 'octingentésim', 'noningentésim'];
/** 13 → "décimo terceiro" (ou "décima terceira"). De 1 a 999. */
export function ordinalPorExtenso(n: number, feminino = false): string {
  if (!Number.isInteger(n) || n < 1 || n > 999) return numeroPorExtenso(n, feminino);
  const f = feminino ? 'a' : 'o';
  const partes = [ORD_CEM[Math.floor(n / 100)], ORD_DEZ[Math.floor((n % 100) / 10)], ORD_UNID[n % 10]].filter(Boolean);
  return partes.map((p) => p + f).join(' ');
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const diaPorExtenso = (d: number): string => (d === 1 ? 'primeiro' : numeroPorExtenso(d));
const anoCompleto = (a: string): number => (a.length === 2 ? (Number(a) < 70 ? 2000 + Number(a) : 1900 + Number(a)) : Number(a));
/** 25/11/2026 → "vinte e cinco de novembro de dois mil e vinte e seis". */
export function dataPorExtenso(dia: number, mes: number, ano?: number): string {
  const base = `${diaPorExtenso(dia)} de ${MESES[mes - 1]}`;
  return ano === undefined ? base : `${base} de ${numeroPorExtenso(ano)}`;
}

// ---------------------------------------------------------------------------------------------
// 3) Siglas e abreviações, do jeito que se fala
// ---------------------------------------------------------------------------------------------

// Siglas soletradas e siglas lidas como palavra. Só em MAIÚSCULAS (para "das", "mei" etc. comuns não mudarem).
const SIGLAS: [RegExp, string][] = [
  [/\bPGDAS-D\b/g, 'pê gê das dê'],
  [/\bPGDAS\b/g, 'pê gê das'],
  [/\bDASN-SIMEI\b/g, 'dasn simei'],
  [/\bDAS-MEI\b/g, 'das mei'],
  [/\bNFS-?e\b/gi, 'nota fiscal de serviço eletrônica'],
  [/\bNFC-?e\b/gi, 'nota fiscal de consumidor eletrônica'],
  [/\bNF-?e\b/gi, 'nota fiscal eletrônica'],
  [/\bCT-?e\b/gi, 'cê tê é'],
  [/\bMDF-?e\b/gi, 'eme dê efe é'],
  [/\bEFD-Reinf\b/gi, 'é efe dê reinf'],
  [/\bEFD-ICMS\/IPI\b/gi, 'é efe dê i cê eme esse i pê i'],
  [/\bEFD\s+ICMS\/IPI\b/gi, 'é efe dê i cê eme esse i pê i'],
  [/\bEFD-Contribui[çc][õo]es\b/gi, 'é efe dê contribuições'],
  [/\bICMS-ST\b/g, 'i cê eme esse esse tê'],
  [/\bDCTFWeb\b/gi, 'dê cê tê efe web'],
  [/\be-?social\b/gi, 'é social'],
  [/\bCNPJs\b/g, 'cê ene pê jotas'],
  [/\bCNPJ\b/g, 'cê ene pê jota'],
  [/\bCPFs\b/g, 'cê pê efes'],
  [/\bCPF\b/g, 'cê pê efe'],
  [/\bFGTS\b/g, 'efe gê tê esse'],
  [/\bINSS\b/g, 'i ene esse esse'],
  [/\bIRRF\b/g, 'i erre erre efe'],
  [/\bIRPJ\b/g, 'i erre pê jota'],
  [/\bIRPF\b/g, 'i erre pê efe'],
  [/\bICMS\b/g, 'i cê eme esse'],
  [/\bIPI\b/g, 'i pê i'],
  [/\bISSQN\b/g, 'i esse esse quê ene'],
  [/\bISS\b/g, 'i esse esse'],
  [/\bCSLL\b/g, 'cê esse ele ele'],
  [/\bIBS\b/g, 'i bê esse'],
  [/\bCBS\b/g, 'cê bê esse'],
  [/\bDCTF\b/g, 'dê cê tê efe'],
  [/\bDEFIS\b/g, 'defis'],
  [/\bECD\b/g, 'é cê dê'],
  [/\bECF\b/g, 'é cê efe'],
  [/\bEFD\b/g, 'é efe dê'],
  [/\bGPS\b/g, 'gê pê esse'],
  [/\bGFIP\b/g, 'gefip'],
  [/\bCLT\b/g, 'cê ele tê'],
  [/\bCTPS\b/g, 'cê tê pê esse'],
  [/\bCRC\b/g, 'cê erre cê'],
  [/\bCNH\b/g, 'cê ene agá'],
  [/\bCNAE\b/g, 'cnae'],
  [/\bCFOP\b/g, 'cê efe ó pê'],
  [/\bCST\b/g, 'cê esse tê'],
  [/\bNCM\b/g, 'ene cê eme'],
  [/\bCEST\b/g, 'cest'],
  [/\bDIFAL\b/g, 'difal'],
  [/\bDARF\b/g, 'darf'],
  [/\bDAE\b/g, 'dae'],
  [/\bDAS\b/g, 'das'],
  [/\bMEI\b/g, 'mei'],
  [/\bEPP\b/g, 'é pê pê'],
  [/\bPIS\b/g, 'pis'],
  [/\bPASEP\b/g, 'pasep'],
  [/\bCOFINS\b/g, 'cofins'],
  [/\bRAIS\b/g, 'rais'],
  [/\bDIRF\b/g, 'dirf'],
  [/\bCAGED\b/g, 'caged'],
  [/\bSPED\b/g, 'sped'],
  [/\bSEFAZ\b/g, 'sefaz'],
  [/\bSERPRO\b/g, 'serpro'],
  [/\bRFB\b/g, 'erre efe bê'],
  [/\bPGFN\b/g, 'pê gê efe ene'],
  [/\bASO\b/g, 'aso'],
  [/\bEPI\b/g, 'é pê i'],
  [/\bSST\b/g, 'esse esse tê'],
  [/\bPPP\b/g, 'pê pê pê'],
  [/\bCAT\b/g, 'cat'],
  [/\bDSR\b/g, 'dê esse erre'],
  [/\bPLR\b/g, 'pê ele erre'],
  [/\bVT\b/g, 'vale-transporte'],
  [/\bVR\b/g, 'vale-refeição'],
  [/\bDP\b/g, 'dê pê'],
  [/\bRH\b/g, 'erre agá'],
  [/\bUF\b/g, 'u efe'],
  [/\bCEP\b/g, 'cep'],
  [/\bPIX\b/gi, 'pix'],
  [/\bPDF\b/g, 'pê dê efe'],
  [/\bXML\b/g, 'xis eme ele'],
  [/\bIA\b/g, 'i a'],
  [/\bLTDA\b/gi, 'limitada'],
  [/\bEIRELI\b/gi, 'eireli'],
];

const ABREVIACOES: [RegExp, string][] = [
  [/\bS\/A\b/g, 'esse a'],
  [/\bS\.A\./g, 'esse a'],
  [/\bn\.?\s?[º°]\s?(?=\d)/gi, 'número '],
  [/\bn[º°]s\.?/gi, 'números'],
  [/\bn\.?[º°]\.?/gi, 'número'],
  [/\barts\.\s?/gi, 'artigos '],
  [/\bart\.\s?/gi, 'artigo '],
  [/\bincs?\.\s?/gi, 'inciso '],
  [/§§\s?/g, 'parágrafos '],
  [/§\s?(?=\d)/g, 'parágrafo '],
  [/§\s?[úu]nico/gi, 'parágrafo único'],
  [/§/g, 'parágrafo'],
  [/\bSra\.\s?/g, 'senhora '],
  [/\bSr\.\s?/g, 'senhor '],
  [/\bDra\.\s?/g, 'doutora '],
  [/\bDr\.\s?/g, 'doutor '],
  [/\betc\./gi, 'etcétera.'],
  [/\bp\.\s?ex\.\s?/gi, 'por exemplo, '],
  [/\bex\.:\s?/gi, 'exemplo: '],
  [/\bex\.\s?/gi, 'exemplo: '],
  [/\bobs\.:?\s?/gi, 'observação: '],
  [/\baprox\.\s?/gi, 'aproximadamente '],
  [/\btel\.:?\s?/gi, 'telefone '],
  [/\bp[áa]g\.\s?/gi, 'página '],
  [/\bvs\.?\s/gi, 'versus '],
  [/\bqtde?\.?\b/gi, 'quantidade'],
  [/\bp\/\s?/gi, 'para '],
  [/\bc\/\s?/gi, 'com '],
  [/\bs\/\s?(?=[a-zà-ú])/gi, 'sem '],
  [/\bcompet\.\s?/gi, 'competência '],
  [/\bref\.\s?/gi, 'referência '],
  [/\bvenc\.\s?/gi, 'vencimento '],
];

function romanoParaNumero(r: string): number {
  const valores: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 };
  const s = r.toUpperCase();
  let total = 0;
  for (let i = 0; i < s.length; i += 1) {
    const v = valores[s[i]]; const prox = valores[s[i + 1]] || 0;
    if (!v) return 0;
    total += v < prox ? -v : v;
  }
  return total > 0 && total < 90 ? total : 0;
}

// ---------------------------------------------------------------------------------------------
// 4) Texto pronto para falar
// ---------------------------------------------------------------------------------------------

const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{FE0E}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu;
const SETAS_E_SIMBOLOS = /[←→↑↓↔⇒⇐⇔➜➔➡⬅►▶◀▸▹•●○◦▪▫■□★☆✓✔✗✘✕✖☐☑☒…‣⁃]/g;

/** Números de documento (CNPJ, CPF, chave, telefone): lidos dígito por dígito, em grupos; muito longos não são lidos. */
function falarDigitos(grupos: string[]): string {
  return grupos.filter(Boolean).map((g) => g.split('').map((d) => UNIDADES[Number(d)]).join(' ')).join(', ');
}

/**
 * Deixa o texto pronto para a voz: tira markdown, emojis, links e códigos; escreve por extenso valores em reais,
 * datas, horas, porcentagens e ordinais; fala as siglas do jeito certo (CNPJ = "cê ene pê jota", DAS = "das").
 */
export function prepararTextoParaFala(texto: string): string {
  let t = String(texto ?? '');
  if (!t.trim()) return '';

  // --- Markdown, código, links e emojis ---
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/```[\s\S]*$/g, ' '); // bloco de código que não fechou
  t = t.replace(/`([^`\n]*)`/g, '$1');
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  t = t.replace(/\[([^\]]+)\]\((?:https?:|mailto:|\/|#)[^)]*\)/g, '$1');
  t = t.replace(/<\/?[a-z][^>]*>/gi, ' ');
  t = t.replace(/\b(?:https?:\/\/|www\.)[^\s<>()]+/gi, ' ');
  t = t.replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, 'o e-mail que está na tela');
  t = t.replace(EMOJI, ' ');
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  t = t.replace(/^\s*>\s?/gm, '');
  t = t.replace(/^\s*[-*+•]\s+/gm, '');
  t = t.replace(/^\s*\d{1,2}[.)]\s+(?=\D)/gm, '');
  t = t.replace(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/gm, ''); // linha separadora de tabela
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
  t = t.replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, '$1$2');
  t = t.replace(/~~([^~]+)~~/g, '$1');

  // --- Linhas viram frases (lista e tabela ganham pausa) ---
  t = t.split(/\r?\n/).map((l) => l.replace(/\|/g, ', ').replace(/\s+/g, ' ').trim()).filter((l) => l && !/^[,\s]+$/.test(l))
    .map((l) => l.replace(/^,\s*/, '').replace(/\s*,\s*$/, ''))
    .map((l) => (/[.!?:;,]$/.test(l) ? l : `${l}.`)).join(' ');

  // --- Números de documento e códigos longos ---
  t = t.replace(/\b(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})-(\d{2})\b/g, (_m, a, b, c, d, e) => falarDigitos([a, b, c, d, e]));
  t = t.replace(/\b(\d{3})\.(\d{3})\.(\d{3})-(\d{2})\b/g, (_m, a, b, c, d) => falarDigitos([a, b, c, d]));
  // Código com vários pontos que não é milhar (protocolo, versão, recibo): não lê.
  t = t.replace(/(?<!\d|\d\.)\d+(?:\.\d+){2,}(?!\d|\.\d)/g, (m) => (/^\d{1,3}(?:\.\d{3})+$/.test(m) ? m : 'o número que está na tela'));
  t = t.replace(/\b\d{4}(?:[ .]\d{4}){3,}\b|\b\d{15,}\b/g, 'o número que está na tela');
  t = t.replace(/\(?\b(\d{2})\)?\s?(9?\d{4})-(\d{4})\b/g, (_m, a, b, c) => falarDigitos([a, b, c]));
  t = t.replace(/(?<![\d.,])\d{9,14}(?![\d.,])/g, (m) => falarDigitos(m.match(/.{1,3}/g) || [m]));

  // --- Abreviações (antes de quebrar em frases, para o ponto não virar pausa) ---
  for (const [re, fala] of ABREVIACOES) t = t.replace(re, fala);

  // --- Valores em reais ---
  t = t.replace(/(-\s?)?R\$\s?(-\s?)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?(\s?(?:mil|milh(?:ão|ões)|bilh(?:ão|ões))\b)?/g,
    (_m, neg1, neg2, inteiro, cent, escala) => {
      const negativo = Boolean(neg1 || neg2);
      const n = Number(String(inteiro).replace(/\./g, ''));
      let fala: string;
      if (escala) {
        const esc = String(escala).trim();
        const base = cent ? decimalPorExtenso(n, cent) : numeroPorExtenso(n);
        fala = `${base} ${esc}${esc === 'mil' ? '' : ' de'} reais`;
      } else {
        const c = cent ? Number(cent.length === 1 ? `${cent}0` : cent) : 0;
        fala = reaisPorExtenso(n, c);
      }
      return `${negativo ? 'menos ' : ''}${fala}`;
    });

  // --- Datas e horas ---
  t = t.replace(/\b(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+Z?)?\b/g, (m, a, me, d) => {
    const dia = Number(d); const mes = Number(me);
    return dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 ? dataPorExtenso(dia, mes, Number(a)) : m;
  });
  t = t.replace(/(?<![\d.,/])(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?![\d/])/g, (m, d, me, a) => {
    const dia = Number(d); const mes = Number(me);
    return dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 ? dataPorExtenso(dia, mes, anoCompleto(a)) : m;
  });
  // Competência: 11/2026 → "novembro de dois mil e vinte e seis"
  t = t.replace(/(?<![\d.,/])(\d{1,2})\/(\d{4})(?![\d/])/g, (m, me, a) => {
    const mes = Number(me);
    return mes >= 1 && mes <= 12 ? `${MESES[mes - 1]} de ${numeroPorExtenso(Number(a))}` : m;
  });
  // Dia e mês: 20/12 → "vinte de dezembro" (mês com dois dígitos, para não confundir com fração)
  t = t.replace(/(?<![\d.,/])(\d{1,2})\/(\d{2})(?![\d/])/g, (m, d, me) => {
    const dia = Number(d); const mes = Number(me);
    return dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 ? dataPorExtenso(dia, mes) : m;
  });
  // Período: 2025/2026 → "dois mil e vinte e cinco barra dois mil e vinte e seis"
  t = t.replace(/(?<![\d.,/])((?:19|20)\d{2})\/((?:19|20)\d{2})(?![\d/])/g, (_m, a, b) => `${numeroPorExtenso(Number(a))} barra ${numeroPorExtenso(Number(b))}`);
  // Número de lei/norma: 8.212/91 → "oito mil duzentos e doze de noventa e um"; 123/2006 → "... de dois mil e seis"
  t = t.replace(/(?<![\d.,/])(\d{1,3}(?:\.\d{3})+|\d+)\/(\d{4}|\d{2})(?![\d/])/g, (_m, n, a) => `${numeroPorExtenso(Number(String(n).replace(/\./g, '')))} de ${numeroPorExtenso(Number(a))}`);
  t = t.replace(/\b([01]?\d|2[0-3])(?:h|:)([0-5]\d)(?:min)?\b/g, (_m, h, mi) => {
    const hora = Number(h); const min = Number(mi);
    const fh = `${numeroPorExtenso(hora, true)} ${hora === 1 ? 'hora' : 'horas'}`;
    return min ? `${fh} e ${numeroPorExtenso(min)}` : fh;
  });
  t = t.replace(/\b([01]?\d|2[0-4])h\b/g, (_m, h) => `${numeroPorExtenso(Number(h), true)} ${Number(h) === 1 ? 'hora' : 'horas'}`);

  // Evento do eSocial e da Reinf: S-1200 → "esse mil e duzentos"; R-2010 → "erre dois mil e dez".
  t = t.replace(/\b([SR])-(\d{4})\b/g, (_m, l, n) => `${l === 'S' ? 'esse' : 'erre'} ${numeroPorExtenso(Number(n))}`);
  // Algarismo romano depois de anexo, inciso, capítulo etc.: "Anexo III" → "Anexo três".
  t = t.replace(/\b(anexo|anexos|inciso|incisos|cap[ií]tulo|t[ií]tulo|se[çc][ãa]o|livro|parte|fase)\s+([IVXL]{1,6})\b/gi, (m, p, r) => {
    const n = romanoParaNumero(r);
    return n ? `${p} ${numeroPorExtenso(n)}` : m;
  });
  // Letra grudada em número (RBT12, certificado A1): separa para ler a letra e o número.
  t = t.replace(/\b([A-Za-z]{1,4})(\d{1,3})\b/g, '$1 $2');

  // --- Porcentagem, ordinais e números ---
  t = t.replace(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s?%/g, (_m, i, d) => `${decimalPorExtenso(Number(String(i).replace(/\./g, '')), d || '')} por cento`);
  t = t.replace(/\b(\d{1,3})\s?([ºª°])(?!\s?[CF]\b)/g, (_m, n, s) => ordinalPorExtenso(Number(n), s === 'ª'));
  t = t.replace(/(?<![\d,])(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(?![\d])/g, (m, i, d) => {
    const lido = lerNumeroBr(d ? `${i},${d}` : i);
    if (!lido) return m;
    return decimalPorExtenso(lido.inteiro, lido.decimais);
  });

  // --- Siglas ---
  for (const [re, fala] of SIGLAS) t = t.replace(re, fala);
  // Palavra toda em maiúsculas (ex.: "ATENÇÃO", "IMPORTANTE"): fala como palavra, não letra por letra.
  t = t.replace(/\b[A-ZÀ-Ý]{5,}\b/g, (m) => m.toLowerCase());

  // --- Símbolos que não se leem ---
  t = t.replace(SETAS_E_SIMBOLOS, ', ');
  t = t.replace(/\s(?:->|=>|-->|<-)\s?/g, ', ');
  t = t.replace(/\s[-–—]+\s/g, ', ');
  t = t.replace(/[–—]/g, ', ');
  t = t.replace(/\s&\s/g, ' e ');
  t = t.replace(/\s\+\s/g, ' mais ');
  t = t.replace(/\s=\s/g, ' igual a ');
  t = t.replace(/[()[\]{}]/g, ', ');
  t = t.replace(/["“”‘’«»]/g, '');
  t = t.replace(/(?<=\S)\/(?=\S)/g, ' ');
  t = t.replace(/[#*_~`|<>\\^]/g, ' ');
  t = t.replace(/\.{2,}/g, '.');

  // --- Pontuação e espaços ---
  t = t.replace(/\s+/g, ' ');
  t = t.replace(/\s+([,.;:!?])/g, '$1');
  t = t.replace(/([,;:])(?:\s*[,;:])+/g, '$1');
  t = t.replace(/,\s*([.!?])/g, '$1');
  t = t.replace(/([.!?])\s*[,;:]+/g, '$1');
  t = t.replace(/([.!?])(?:\s*[.])+/g, '$1');
  t = t.replace(/^[\s,.;:]+/, '');
  return t.trim();
}

/**
 * Divide o texto em frases curtas para falar uma de cada vez (pausa natural entre elas).
 * Frase muito curta junta com a seguinte; frase longa quebra na vírgula.
 */
export function dividirEmFrases(texto: string, maximo = 220): string[] {
  const frases: string[] = [];
  for (const bruta of String(texto || '').split(/(?<=[.!?;:])\s+/)) {
    let resto = bruta.trim();
    while (resto.length > maximo) {
      let corte = resto.lastIndexOf(', ', maximo);
      if (corte < maximo / 3) corte = resto.lastIndexOf(' ', maximo);
      if (corte < 20) corte = maximo;
      frases.push(resto.slice(0, corte + 1).trim());
      resto = resto.slice(corte + 1).trim();
    }
    if (resto) frases.push(resto);
  }
  const juntas: string[] = [];
  for (const f of frases) {
    const ult = juntas.length - 1;
    if (ult >= 0 && juntas[ult].length < 40 && (juntas[ult] + ' ' + f).length <= maximo) juntas[ult] = `${juntas[ult]} ${f}`;
    else juntas.push(f);
  }
  return juntas.filter((f) => /[\p{L}\p{N}]/u.test(f));
}

/** Frase do botão "Ouvir exemplo" (mostra valores, datas e siglas sendo lidos do jeito certo). */
export const FRASE_EXEMPLO_VOZ = 'Olá! Esta é a minha voz. O DAS de 11/2026 vence em 20/12/2026, no valor de R$ 1.234,56. O FGTS e o INSS já estão conferidos.';
