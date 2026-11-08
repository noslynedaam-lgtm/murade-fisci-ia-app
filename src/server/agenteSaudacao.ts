// Saudação e nome de tratamento da Agente IA Murade (arquivo idêntico em todos os sistemas).
// Tudo aqui é regra fixa, sem chamar IA: não gasta crédito.

const FUSO = 'America/Sao_Paulo';

/** "Bom dia" (5h até 11h59), "Boa tarde" (12h até 17h59) ou "Boa noite" (18h até 4h59), no horário de Brasília. */
export function saudacaoDoHorario(agora: Date = new Date()): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  const hora = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', hour12: false }).format(agora)) % 24;
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Data de hoje (AAAA-MM-DD) no horário de Brasília: base do "uma saudação por dia". */
export function diaDeHoje(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const NAO_E_NOME = new Set(['sim', 'nao', 'ok', 'okay', 'oi', 'ola', 'tchau', 'obrigado', 'obrigada', 'pode', 'quero', 'isso', 'certo', 'claro', 'bom', 'boa', 'dia', 'tarde', 'noite', 'para', 'espera', 'nada', 'ninguem', 'ai', 'eu', 'voce', 'meu', 'nome', 'quem']);

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Arruma um nome já separado: só letras, espaço, hífen e apóstrofo; 2 a 40 letras; cada palavra com inicial maiúscula. Devolve '' se não parecer nome. */
export function normalizarNomeTratamento(bruto: string): string {
  const limpo = String(bruto || '').replace(/[.,;:!?"“”()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!limpo || limpo.length > 40 || !/^[\p{L}][\p{L} '’-]*$/u.test(limpo)) return '';
  const palavras = limpo.split(' ');
  if (palavras.length > 3) return '';
  if (palavras.some((p) => NAO_E_NOME.has(semAcento(p)) && !PARTICULAS.has(semAcento(p)))) return '';
  if (palavras.every((p) => PARTICULAS.has(semAcento(p)))) return '';
  const nome = palavras.map((p, i) => (i > 0 && PARTICULAS.has(semAcento(p)) ? p.toLowerCase() : p.split(/(['’-])/).map((seg) => seg.charAt(0).toLocaleUpperCase('pt-BR') + seg.slice(1).toLocaleLowerCase('pt-BR')).join(''))).join(' ');
  return nome.replace(/[^\p{L}]/gu, '').length >= 2 ? nome : '';
}

/** Tira a moldura da frase ("meu nome é Herbert", "pode me chamar de Aldair", "sou o Vessiano") e devolve só o nome, ou '' se não for um nome. */
export function extrairNomeDaResposta(texto: string): string {
  let t = String(texto || '').trim();
  if (!t || t.length > 80) return '';
  t = t.replace(/^[\s,.!?]*(oi|ol[aá]|bom dia|boa tarde|boa noite|ei|e a[ií])[\s,.!?]+/i, '');
  t = t.replace(/^[\s,.!?]*(meu nome [eé]|o meu nome [eé]|me chamo|pode me chamar de|me chama de|me chame de|aqui [eé] (o|a)|aqui quem fala [eé] (o|a)?|eu sou (o|a)|sou (o|a)|eu sou|sou|[eé] (o|a)|nome [eé]|chamo)\s+/i, '');
  return normalizarNomeTratamento(t);
}

/** Frase de abertura do dia: "Bom dia, Herbert!" (ou sem nome, enquanto ela ainda não sabe). */
export function fraseDeSaudacao(nome: string | null | undefined, agora: Date = new Date()): string {
  const s = saudacaoDoHorario(agora);
  return nome ? `${s}, ${nome}!` : `${s}!`;
}
