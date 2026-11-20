// Painel das certidões por empresa: as 5 certidões (federal, estadual, municipal, FGTS, trabalhista) em verde / amarelo / vermelho
// (cinza = ainda não buscada), os próximos vencimentos e a FILA do que buscar (usada pelo robô preparador e pelo botão "Buscar agora").
// Só lê o que já está guardado; nada aqui consulta órgão nem inventa validade.
import { TIPOS_CERTIDAO, faixaDeVencimento, type ResultadoCertidao, type SituacaoCertidao, type TipoCertidao } from './certidoes';

export type CorCertidao = 'verde' | 'amarelo' | 'vermelho' | 'cinza';

/** Tipos que o fluxo semiautomático cobre (a federal segue na consulta própria, paga, só no clique). */
export const TIPOS_SEMIAUTOMATICOS: TipoCertidao[] = ['estadual', 'municipal', 'fgts', 'trabalhista'];

/** Quantos dias antes do vencimento a certidão fica amarela e entra na fila de busca. CRF vale cerca de 30 dias; as outras, 60 a 180. */
export const DIAS_AVISO: Record<TipoCertidao, number> = { federal: 15, estadual: 15, municipal: 15, fgts: 7, trabalhista: 15 };

export interface CertidaoParaPainel {
  id: string; companyId: string; tipo: TipoCertidao; situacao: SituacaoCertidao; resultado?: ResultadoCertidao | null;
  numero: string | null; emissao: string | null; validade: string | null; criadaEm: string; temPdf?: boolean; origem?: string;
}
export interface EmpresaParaPainel { id: string; nome: string; cnpj: string; uf: string | null; municipio: string | null }
export interface EstadoCertidao {
  tipo: TipoCertidao; cor: CorCertidao; texto: string; validade: string | null; dias: number | null; numero: string | null;
  resultado: ResultadoCertidao | null; certidaoId: string | null; temPdf: boolean; buscar: boolean;
}

const UTIL: SituacaoCertidao[] = ['emitida', 'registrada_manualmente'];

/** A certidão que vale para a empresa naquele tipo: a mais recente utilizável; se não houver, a mais recente de qualquer situação. */
export function certidaoVigente(lista: CertidaoParaPainel[], companyId: string, tipo: TipoCertidao): CertidaoParaPainel | undefined {
  const doTipo = lista.filter((c) => c.companyId === companyId && c.tipo === tipo).sort((a, b) => (a.criadaEm < b.criadaEm ? 1 : -1));
  return doTipo.find((c) => UTIL.includes(c.situacao)) ?? doTipo[0];
}

export function estadoDaCertidao(tipo: TipoCertidao, c: CertidaoParaPainel | undefined, hoje: string): EstadoCertidao {
  const base = { tipo, validade: c?.validade ?? null, numero: c?.numero ?? null, resultado: c?.resultado ?? null, certidaoId: c?.id ?? null, temPdf: c?.temPdf === true };
  if (!c) return { ...base, cor: 'cinza', texto: 'ainda não buscada', dias: null, buscar: true };
  if (c.situacao === 'nao_emitida') return { ...base, cor: 'vermelho', texto: 'não emitida pelo órgão (há pendência)', dias: null, buscar: true };
  if (!UTIL.includes(c.situacao)) return { ...base, cor: 'cinza', texto: 'consulta não concluída', dias: null, buscar: true };
  const { faixa, dias } = faixaDeVencimento(c.validade, hoje);
  if (faixa === 'vencida') return { ...base, cor: 'vermelho', texto: `vencida há ${Math.abs(dias ?? 0)} dia(s)`, dias, buscar: true };
  if (c.resultado === 'positiva') return { ...base, cor: 'vermelho', texto: 'positiva (há débitos)', dias, buscar: dias !== null && dias <= DIAS_AVISO[tipo] };
  if (faixa === 'sem_validade') return { ...base, cor: 'amarelo', texto: 'sem validade informada', dias: null, buscar: false };
  if (dias !== null && dias <= DIAS_AVISO[tipo]) return { ...base, cor: 'amarelo', texto: dias === 0 ? 'vence hoje' : `vence em ${dias} dia(s)`, dias, buscar: true };
  if (c.resultado === 'positiva_efeito_negativa') return { ...base, cor: 'amarelo', texto: 'positiva com efeito de negativa (vale como negativa)', dias, buscar: false };
  return { ...base, cor: 'verde', texto: 'em dia', dias, buscar: false };
}

const PESO: Record<CorCertidao, number> = { vermelho: 0, amarelo: 1, cinza: 2, verde: 3 };

export interface LinhaPainel { empresa: EmpresaParaPainel; certidoes: Record<TipoCertidao, EstadoCertidao>; pior: CorCertidao; aBuscar: TipoCertidao[] }

export function montarPainel(empresas: EmpresaParaPainel[], certidoes: CertidaoParaPainel[], hoje: string) {
  const linhas: LinhaPainel[] = empresas.map((empresa) => {
    const estados = Object.fromEntries(TIPOS_CERTIDAO.map((t) => [t, estadoDaCertidao(t, certidaoVigente(certidoes, empresa.id, t), hoje)])) as Record<TipoCertidao, EstadoCertidao>;
    const pior = TIPOS_CERTIDAO.map((t) => estados[t].cor).sort((a, b) => PESO[a] - PESO[b])[0];
    return { empresa, certidoes: estados, pior, aBuscar: TIPOS_SEMIAUTOMATICOS.filter((t) => estados[t].buscar) };
  }).sort((a, b) => PESO[a.pior] - PESO[b.pior] || a.empresa.nome.localeCompare(b.empresa.nome, 'pt-BR'));
  const proximosVencimentos = linhas.flatMap((l) => TIPOS_CERTIDAO.map((t) => ({ empresa: l.empresa.nome, companyId: l.empresa.id, tipo: t, ...l.certidoes[t] })))
    .filter((x) => x.validade && x.dias !== null && x.dias <= 30)
    .sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0))
    .slice(0, 50);
  const contagem = { verde: 0, amarelo: 0, vermelho: 0, cinza: 0 } as Record<CorCertidao, number>;
  for (const l of linhas) for (const t of TIPOS_CERTIDAO) contagem[l.certidoes[t].cor] += 1;
  return { hoje, linhas, proximosVencimentos, contagem, totalABuscar: linhas.reduce((s, l) => s + l.aBuscar.length, 0) };
}

// ---------------------------------------------------------------------------------------------
// Robô preparador: roda UMA vez por noite (1h às 5h de Brasília), uma conta por vez, e só conta o que falta buscar.
// ---------------------------------------------------------------------------------------------
export function horaBrasilia(agora: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(agora)) % 24;
}
export function devePrepararAgora(agora: Date, ultimaData: string | null, hoje: string): boolean {
  const h = horaBrasilia(agora);
  return h >= 1 && h < 5 && ultimaData !== hoje;
}
