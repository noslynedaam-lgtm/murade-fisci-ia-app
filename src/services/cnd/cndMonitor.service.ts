import { normalizarCnpj } from '../cnpj/cnpjValidation';

const STORAGE_KEY_CND = 'fiscoia_cnd';
export const EVENTO_CND_LOCAL_ATUALIZADA = 'murade_cnd_local_atualizada';

type TipoCnd = 'federal' | 'estadual' | 'municipal' | 'fgts' | 'trabalhista';
type CndLocal = {
  id: string | number;
  clienteId: string | number;
  clienteNome: string;
  clienteDoc: string;
  tipo: TipoCnd;
  numero: string;
  emissao: string;
  validade: string;
};

export type CndParaMonitor = {
  id: string;
  tipo: TipoCnd;
  validade: string;
  diasParaVencer: number | null;
  situacao: 'vencida' | 'proxima' | 'validade_invalida' | 'no_prazo';
};

export type ResultadoLeituraCndMonitor =
  | { ok: true; certidoes: CndParaMonitor[] }
  | { ok: false; erro: string };

function dataCivilValida(valor: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!partes) return false;
  const [, ano, mes, dia] = partes;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  return data.getUTCFullYear() === Number(ano)
    && data.getUTCMonth() === Number(mes) - 1
    && data.getUTCDate() === Number(dia);
}

function diasAte(dataIso: string, agora = new Date()): number {
  const hoje = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const data = Date.UTC(Number(dataIso.slice(0, 4)), Number(dataIso.slice(5, 7)) - 1, Number(dataIso.slice(8, 10)));
  return Math.round((data - hoje) / 86_400_000);
}

/** Lê registros locais sem tratar dados corrompidos como uma lista vazia. */
export function lerCndsLocaisParaMonitor(empresa: { id?: string; cnpj: string }): ResultadoLeituraCndMonitor {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY_CND);
  } catch {
    return { ok: false, erro: 'o navegador bloqueou a leitura das certidões locais' };
  }
  if (raw === null) return { ok: true, certidoes: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, erro: 'o cadastro local de certidões está corrompido; nenhum registro foi presumido ausente' };
  }
  const tipos = new Set<TipoCnd>(['federal', 'estadual', 'municipal', 'fgts', 'trabalhista']);
  if (!Array.isArray(parsed) || parsed.some((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return true;
    const cnd = item as Record<string, unknown>;
    return !['number', 'string'].includes(typeof cnd.id)
      || !['number', 'string'].includes(typeof cnd.clienteId)
      || typeof cnd.clienteNome !== 'string'
      || typeof cnd.clienteDoc !== 'string'
      || typeof cnd.tipo !== 'string'
      || !tipos.has(cnd.tipo as TipoCnd)
      || typeof cnd.numero !== 'string'
      || typeof cnd.emissao !== 'string'
      || typeof cnd.validade !== 'string';
  })) {
    return { ok: false, erro: 'o cadastro local de certidões tem campos inválidos; nenhum registro foi presumido ausente' };
  }

  const idEmpresa = empresa.id || empresa.cnpj;
  const cnpjEmpresa = normalizarCnpj(empresa.cnpj);
  const cndsEmpresa = (parsed as CndLocal[]).filter(cnd =>
    String(cnd.clienteId) === idEmpresa
    || (cnpjEmpresa && normalizarCnpj(cnd.clienteDoc) === cnpjEmpresa)
  );
  return {
    ok: true,
    certidoes: cndsEmpresa.map(cnd => {
      const id = String(cnd.id);
      if (!dataCivilValida(cnd.emissao) || !dataCivilValida(cnd.validade) || cnd.validade < cnd.emissao) {
        return { id, tipo: cnd.tipo, validade: cnd.validade, diasParaVencer: null, situacao: 'validade_invalida' };
      }
      const dias = diasAte(cnd.validade);
      return {
        id,
        tipo: cnd.tipo,
        validade: cnd.validade,
        diasParaVencer: dias,
        situacao: dias < 0 ? 'vencida' : dias <= 10 ? 'proxima' : 'no_prazo'
      };
    })
  };
}
