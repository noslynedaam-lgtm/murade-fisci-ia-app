// Certidões (CND) do Fisco IA: tipos, forma de consulta de cada tipo e regra de vencimento.
//
// Cada tipo tem um ADAPTADOR. Só o tipo "federal" tem consulta automática, pelo produto oficial "Consulta CND" do Serpro
// (certidão conjunta RFB + PGFN). Os demais não têm API oficial localizada e os portais pedem verificação humana (captcha) ou
// bloqueiam acesso automatizado: são SEMIAUTOMÁTICOS — o sistema copia o CNPJ e abre o portal certo, a pessoa emite, solta o PDF
// e o sistema lê o PDF e preenche número, situação e validade para ela só confirmar (leituraPdfCertidao.ts).
// Nada aqui inventa prazo de validade: a validade é a que o órgão informou (ou a que a pessoa digitou do documento emitido).
import { validarCnpj, normalizarCnpj } from '../cnpj/cnpjValidation';

export const TIPOS_CERTIDAO = ['federal', 'estadual', 'municipal', 'fgts', 'trabalhista'] as const;
export type TipoCertidao = typeof TIPOS_CERTIDAO[number];

export type ModoConsulta = 'automatica_paga' | 'semiautomatica';
export type SituacaoCertidao = 'emitida' | 'nao_emitida' | 'em_processamento' | 'indisponivel' | 'erro' | 'registrada_manualmente';
export type OrigemCertidao = 'consulta_serpro' | 'manual' | 'pdf_importado';

export interface AdaptadorCertidao {
  tipo: TipoCertidao;
  rotulo: string;
  orgao: string;
  modo: ModoConsulta;
  /** Texto para a tela: como a certidão é obtida. */
  como: string;
  /** Portal oficial para emissão pela pessoa. Estadual e municipal dependem da UF/município e vêm da lista de órgãos da tela. */
  portalOficial: string | null;
  /** Fontes oficiais que sustentam o que está escrito acima. */
  fontesOficiais: string[];
}

export const ADAPTADORES: Record<TipoCertidao, AdaptadorCertidao> = {
  federal: {
    tipo: 'federal', rotulo: 'CND Federal (Receita Federal + PGFN)', orgao: 'Receita Federal e Procuradoria-Geral da Fazenda Nacional', modo: 'automatica_paga',
    como: 'Consulta automática pelo produto "Consulta CND" do Serpro (certidão conjunta RFB/PGFN, sem intervenção humana). É paga por consulta e só roda quando a pessoa clica.',
    portalOficial: 'https://servicos.receitafederal.gov.br/servico/certidoes',
    fontesOficiais: ['https://www.gov.br/conecta/catalogo/apis/consultar-certidao-negativa-de-debito', 'https://www.store.serpro.gov.br/consulta-cnd'],
  },
  estadual: {
    tipo: 'estadual', rotulo: 'CND Estadual (SEFAZ)', orgao: 'Secretaria da Fazenda/Economia do estado', modo: 'semiautomatica',
    como: 'Sem API oficial aberta para consulta automática. O sistema copia o CNPJ e abre o portal da SEFAZ do estado; você emite lá, solta o PDF aqui e o sistema lê número, situação e validade para você só confirmar.',
    portalOficial: null, fontesOficiais: ['https://appasp.economia.go.gov.br/Legislacao/arquivos/SECRETARIO/IN/IN_1173_2013.htm'],
  },
  municipal: {
    tipo: 'municipal', rotulo: 'CND Municipal (Prefeitura)', orgao: 'Prefeitura do município', modo: 'semiautomatica',
    como: 'Sem API oficial aberta; o portal da Prefeitura de Goiânia pede os caracteres de uma imagem (captcha). O sistema copia o CNPJ e abre o portal; você emite, solta o PDF aqui e o sistema lê número, situação e validade.',
    portalOficial: null, fontesOficiais: ['https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00300f0.asp'],
  },
  fgts: {
    tipo: 'fgts', rotulo: 'CRF - Regularidade do FGTS', orgao: 'Caixa Econômica Federal', modo: 'semiautomatica',
    como: 'Sem API oficial aberta; a consulta da Caixa pede um código de imagem (captcha). O sistema copia o CNPJ e abre o portal; você emite o CRF, solta o PDF aqui e o sistema lê número, situação e validade.',
    portalOficial: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf', fontesOficiais: ['https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf'],
  },
  trabalhista: {
    tipo: 'trabalhista', rotulo: 'CNDT - Débitos Trabalhistas', orgao: 'Tribunal Superior do Trabalho (Justiça do Trabalho)', modo: 'semiautomatica',
    como: 'Emissão gratuita no portal do TST (CLT, art. 642-A), que pede os caracteres de uma imagem (captcha). O sistema copia o CNPJ e abre o portal; você emite, solta o PDF aqui e o sistema lê número, situação e validade (180 dias).',
    portalOficial: 'https://www.tst.jus.br/certidao', fontesOficiais: ['https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm'],
  },
};

/** Portais oficiais conhecidos por UF/município. Nenhum aceita o CNPJ pela URL: o sistema copia o CNPJ para a pessoa colar. */
const PORTAL_ESTADUAL: Record<string, string> = { GO: 'https://www.sefaz.go.gov.br/Certidao/Emissao/' };
const PORTAL_MUNICIPAL: Record<string, string> = { 'GO|goiania': 'https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00300f0.asp' };
export function portalDaCertidao(tipo: TipoCertidao, uf?: string | null, municipio?: string | null): string | null {
  if (tipo === 'estadual') return PORTAL_ESTADUAL[(uf ?? '').toUpperCase()] ?? null;
  if (tipo === 'municipal') {
    const m = (municipio ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    return PORTAL_MUNICIPAL[`${(uf ?? '').toUpperCase()}|${m}`] ?? null;
  }
  return ADAPTADORES[tipo].portalOficial;
}

/** Resultado escrito na certidão (para o painel verde/amarelo/vermelho). */
export type ResultadoCertidao = 'negativa' | 'positiva_efeito_negativa' | 'positiva';
export const ROTULO_RESULTADO: Record<ResultadoCertidao, string> = {
  negativa: 'Negativa (sem débitos)', positiva_efeito_negativa: 'Positiva com efeito de negativa (vale como negativa)', positiva: 'Positiva (há débitos)',
};
export const ehResultadoCertidao = (v: unknown): v is ResultadoCertidao => v === 'negativa' || v === 'positiva_efeito_negativa' || v === 'positiva';

export const ehTipoCertidao = (v: unknown): v is TipoCertidao => typeof v === 'string' && (TIPOS_CERTIDAO as readonly string[]).includes(v);

// ---------------------------------------------------------------------------------------------
// Datas (AAAA-MM-DD, calendário civil, sem fuso)
// ---------------------------------------------------------------------------------------------
export function dataIsoValida(d: unknown): d is string {
  const m = typeof d === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(d) : null;
  if (!m) return false;
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3];
}

export function diasEntre(deIso: string, ateIso: string): number {
  const f = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((f(ateIso) - f(deIso)) / 86_400_000);
}

/** Data de hoje no horário de Brasília (AAAA-MM-DD). */
export function hojeBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

// ---------------------------------------------------------------------------------------------
// Vencimento: avisos 30 / 15 / 7 dias antes e vencida
// ---------------------------------------------------------------------------------------------
export type FaixaVencimento = 'vencida' | 'vence_em_7' | 'vence_em_15' | 'vence_em_30' | 'em_dia' | 'sem_validade';

export function faixaDeVencimento(validade: string | null | undefined, hoje: string): { faixa: FaixaVencimento; dias: number | null } {
  if (!dataIsoValida(validade) || !dataIsoValida(hoje)) return { faixa: 'sem_validade', dias: null };
  const dias = diasEntre(hoje, validade);
  // Vale até o fim do dia da validade: no próprio dia ainda está válida (0 dia restante).
  if (dias < 0) return { faixa: 'vencida', dias };
  if (dias <= 7) return { faixa: 'vence_em_7', dias };
  if (dias <= 15) return { faixa: 'vence_em_15', dias };
  if (dias <= 30) return { faixa: 'vence_em_30', dias };
  return { faixa: 'em_dia', dias };
}

export interface CertidaoGuardada {
  id: string; companyId: string; empresa?: string; tipo: TipoCertidao; uf?: string | null; municipio?: string | null;
  situacao: SituacaoCertidao; numero: string | null; emissao: string | null; validade: string | null; criadaEm: string;
}

/**
 * Só a certidão MAIS RECENTE de cada empresa + tipo (+ UF/município) conta para o aviso: se já emitiu outra nova, a antiga vencida não alerta.
 * Certidões sem validade não geram aviso de vencimento.
 */
export function certidoesQueRequeremAtencao(lista: CertidaoGuardada[], hoje: string): Array<CertidaoGuardada & { faixa: FaixaVencimento; dias: number }> {
  const maisRecente = new Map<string, CertidaoGuardada>();
  for (const c of lista) {
    if (c.situacao !== 'emitida' && c.situacao !== 'registrada_manualmente') continue;
    const chave = [c.companyId, c.tipo, c.uf ?? '', c.municipio ?? ''].join('|');
    const atual = maisRecente.get(chave);
    if (!atual || c.criadaEm > atual.criadaEm) maisRecente.set(chave, c);
  }
  const ordem: Record<FaixaVencimento, number> = { vencida: 0, vence_em_7: 1, vence_em_15: 2, vence_em_30: 3, em_dia: 4, sem_validade: 5 };
  return [...maisRecente.values()]
    .map((c) => ({ ...c, ...faixaDeVencimento(c.validade, hoje) }))
    .filter((c): c is CertidaoGuardada & { faixa: FaixaVencimento; dias: number } => c.faixa !== 'em_dia' && c.faixa !== 'sem_validade' && c.dias !== null)
    .sort((a, b) => ordem[a.faixa] - ordem[b.faixa] || a.dias - b.dias);
}

export function textoDaFaixa(f: FaixaVencimento, dias: number | null): string {
  if (f === 'vencida') return `vencida há ${Math.abs(dias ?? 0)} dia(s)`;
  if (f === 'em_dia') return 'em dia';
  if (f === 'sem_validade') return 'sem validade informada';
  return dias === 0 ? 'vence hoje' : `vence em ${dias} dia(s)`;
}

// ---------------------------------------------------------------------------------------------
// Validação do que a pessoa digita no registro manual
// ---------------------------------------------------------------------------------------------
export interface EntradaManual { tipo: unknown; uf?: unknown; municipio?: unknown; numero?: unknown; emissao?: unknown; validade?: unknown; resultadoOrgao?: unknown; obs?: unknown }
export interface ManualValidado { tipo: TipoCertidao; uf: string | null; municipio: string | null; numero: string; emissao: string; validade: string; resultadoOrgao: string | null; obs: string | null }

const limpar = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);

export function validarRegistroManual(e: EntradaManual): { ok: true; valor: ManualValidado } | { ok: false; mensagem: string } {
  if (!ehTipoCertidao(e.tipo)) return { ok: false, mensagem: 'Tipo de certidão inválido.' };
  const numero = limpar(e.numero, 60);
  if (!numero) return { ok: false, mensagem: 'Informe o número ou código de controle que está no documento.' };
  if (!dataIsoValida(e.emissao)) return { ok: false, mensagem: 'Data de emissão inválida (use AAAA-MM-DD).' };
  if (!dataIsoValida(e.validade)) return { ok: false, mensagem: 'Data de validade inválida (use AAAA-MM-DD).' };
  if (e.validade < e.emissao) return { ok: false, mensagem: 'A validade não pode ser anterior à emissão.' };
  const uf = limpar(e.uf, 20).toUpperCase();
  if (uf && !/^[A-Z]{2}$/.test(uf)) return { ok: false, mensagem: 'UF inválida.' };
  return { ok: true, valor: { tipo: e.tipo, uf: uf || null, municipio: limpar(e.municipio, 80) || null, numero, emissao: e.emissao, validade: e.validade, resultadoOrgao: limpar(e.resultadoOrgao, 120) || null, obs: limpar(e.obs, 300) || null } };
}

export function cnpjConsultavel(cnpj: unknown): string | null {
  const n = normalizarCnpj(String(cnpj ?? ''));
  return validarCnpj(n) ? n : null;
}
