/** Indica quando uma resposta atual precisa de fonte governamental brasileira. */
export function perguntaExigeFonteOficial(pergunta: string): boolean {
  return /(prazo|vencimento|al[ií]quota|tribut|fiscal|imposto|\binss\b|\birrf\b|\bfgts\b|\bdctf\b|\besocial\b|e-?cac|serpro|sefaz|secretaria\s+(?:de\s+estado\s+)?da\s+fazenda|prefeitura|secretaria\s+municipal|\bmunic[ií]pio\b|\bestadual\b|\bmunicipal\b|\brfb\b|receita|\bcnd\b|certid[aã]o|situa[cç][aã]o|lei|obriga[cç][aã]o|guia|\bnf-?e\b|\bnfs-?e\b|notas? fiscais?|documento fiscal|icms|iss|ipi|pis|cofins|simples nacional|pgdas|sped|\becd\b|\becf\b|declara[cç][aã]o|e-?social)/i.test(pergunta);
}
