// Regras de entendimento da Agente IA Murade (arquivo idêntico no DP, Fiscal, Contábil e Fisco IA).
// Objetivo: a Agente ouve até o fim, não adivinha, pergunta quando não entendeu e entende o "sim" curto
// como resposta ao que ELA mesma ofereceu, sem mudar de assunto.

export interface TurnoParaEntendimento { papel: 'usuario' | 'ia'; texto: string }

/** Anexado às instruções de TODAS as Agentes pelo motor (conversar). */
export const REGRAS_DE_ENTENDIMENTO = `

ENTENDER ANTES DE AGIR (regra mais importante da conversa)
- Ouça o pedido inteiro. Se o pedido veio confuso, cortado, com palavras soltas, ou parece erro do reconhecimento de voz (nome de empresa ou termo que não existe, frase sem sentido), NÃO adivinhe, NÃO consulte nada e NÃO prepare nenhuma ação. Diga só: "Não entendi direito. Pode repetir?" (pode acrescentar o que você captou, por exemplo: "Entendi a palavra folha, mas não o resto.").
- Resposta curta como "sim", "pode", "quero", "isso", "ok", "pode fazer" continua o ÚLTIMO assunto: faça exatamente o que você ofereceu ou perguntou na sua mensagem anterior. Nunca mude de assunto, nunca ofereça outra coisa no lugar e nunca comece outra tarefa por conta própria. Se a pessoa disse "sim" e acrescentou detalhes, siga os detalhes dela dentro desse mesmo assunto.
- "Não", "deixa", "deixa quieto" ou "melhor não": pare, não faça o que tinha oferecido e pergunte só se ela quer outra coisa.
- Se a pessoa corrigir ("não, eu quis dizer..."), obedeça à correção e abandone o que estava fazendo.
- Faça uma coisa de cada vez e só o que foi pedido. Se pediram duas coisas, faça a primeira, diga que a segunda fica para depois e pergunte se pode seguir.
- Se houver duas interpretações possíveis, pergunte UMA vez, de forma curta, qual é a certa.
- Nunca prepare ação que altera dados (cartão de confirmação) em cima de pedido que você não tem certeza de ter entendido.
- Quando a pessoa perguntar "onde eu faço X" ou "como faço X", responda em passos curtos e numerados na fala, dizendo o nome exato da tela e do botão: "Primeiro clique em Folha Mensal, no menu. Depois clique em Calcular." Não invente tela nem botão que não existe no mapa do sistema.
`;

const normalizar = (texto: string) => String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const PALAVRAS_SIM = /^(sim|pode|podes|quero|queria|isso|isso mesmo|exato|exatamente|ok|okay|certo|claro|vai|vamos|manda|manda ver|faz|faca|faz isso|aceito|bora|positivo|uhum|aham|ta bom|ta|tudo bem|com certeza|por favor)\b/;
const PALAVRAS_NAO = /^(nao|nao quero|deixa|deixa quieto|deixa pra la|melhor nao|nao precisa|negativo|esquece|cancela|cancelar)\b/;
const SINAL_DE_OFERTA = /(\?|quer que|posso|gostaria|deseja|prefere|se quiser|se preferir|quer ajuda|quer saber|quer ver|quer mais|me diga|confirma)/i;

/** Quando a mensagem é uma resposta curta ("sim", "pode", "não"), devolve a nota que prende a conversa ao último assunto da Agente. */
export function contextoDeRespostaCurta(mensagem: string, historico: TurnoParaEntendimento[] = []): string {
  const t = normalizar(mensagem);
  if (!t || t.split(' ').length > 8) return '';
  const afirmou = PALAVRAS_SIM.test(t);
  const negou = !afirmou && PALAVRAS_NAO.test(t);
  if (!afirmou && !negou) return '';
  const ultimaIA = [...historico].reverse().find((h) => h && h.papel === 'ia' && typeof h.texto === 'string' && h.texto.trim());
  if (!ultimaIA) return '';
  const texto = ultimaIA.texto.trim().replace(/\s+/g, ' ');
  if (!SINAL_DE_OFERTA.test(texto.slice(-400))) return '';
  const trecho = texto.length > 500 ? `…${texto.slice(-500)}` : texto;
  if (negou) {
    return `[Contexto da conversa: sua última mensagem foi: "${trecho}" A pessoa RECUSOU. Não faça o que tinha oferecido, não consulte nada e pergunte só, em uma frase, se ela quer outra coisa.]\n`;
  }
  return `[Contexto da conversa: sua última mensagem foi: "${trecho}" A pessoa respondeu de forma curta, continuando ESSE mesmo assunto. Faça apenas o que você ofereceu ou perguntou ali. Não mude de assunto, não ofereça outra coisa e não comece outra tarefa. Se não ficar claro a qual parte ela se refere, pergunte qual.]\n`;
}
