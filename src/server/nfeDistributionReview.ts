import { chaveNfeTemDigitoValido } from '../services/fiscal/chaveNfe.service';
import { normalizarCnpj } from '../services/cnpj/cnpjValidation';

export type NfeDistributionFinding = {
  code: string;
  severity: 'ERRO' | 'ATENCAO';
  message: string;
  esperado?: string;
  encontrado?: string;
  diferenca?: string;
};

function tag(xml: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`<(?:(?:[A-Za-z_][\\w.-]*):)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${escaped}\\s*>`, 'i').exec(xml);
  return match?.[1]?.replace(/<[^>]*>/g, '').trim() ?? '';
}

function block(xml: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const open = new RegExp(`<((?:[A-Za-z_][\\w.-]*:)?${escaped})\\b([^>]*)>`, 'i').exec(xml);
  if (!open) return null;
  const close = new RegExp(`<\\/${open[1]}\\s*>`, 'i').exec(xml.slice(open.index + open[0].length));
  return close ? xml.slice(open.index + open[0].length, open.index + open[0].length + close.index) : null;
}

function cents(raw: string): bigint | null {
  if (!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function formatCents(value: bigint): string {
  const sinal = value < 0n ? '-' : '';
  const absoluto = value < 0n ? -value : value;
  return `${sinal}${absoluto / 100n}.${String(absoluto % 100n).padStart(2, '0')}`;
}

/** Checks structural consistency only. It does not calculate tax liability or replace SEFAZ validation. */
export function revisarNfeDistribuida(xml: string, expectedCompanyCnpj: string) {
  const findings: NfeDistributionFinding[] = [];
  const inf = block(xml, 'infNFe');
  if (!inf) {
    return { status: 'REVISAR' as const, findings: [{ code: 'INFNFE_AUSENTE', severity: 'ERRO' as const, message: 'O XML recebido não contém infNFe completo.' }] };
  }

  const openInf = new RegExp(`<((?:[A-Za-z_][\\w.-]*:)?infNFe)\\b([^>]*)>`, 'i').exec(xml);
  const id = openInf?.[2].match(/\bId\s*=\s*(["'])NFe([0-9A-Z]{44})\1/i)?.[2]?.toUpperCase() ?? '';
  const protocolKey = tag(xml, 'chNFe').toUpperCase();
  const key = id || protocolKey;
  if (!key || !chaveNfeTemDigitoValido(key)) findings.push({ code: 'CHAVE_INVALIDA', severity: 'ERRO', message: 'A chave da NF-e está ausente ou tem dígito verificador inválido.' });
  if (id && protocolKey && id !== protocolKey) findings.push({ code: 'CHAVE_PROTOCOLO_DIVERGENTE', severity: 'ERRO', message: 'A chave em infNFe diverge da chave no protocolo do XML.' });

  const ide = block(inf, 'ide') ?? '';
  const emit = block(inf, 'emit') ?? '';
  const cnpj = normalizarCnpj(tag(emit, 'CNPJ'));
  const expectedCnpj = normalizarCnpj(expectedCompanyCnpj);
  const modelo = tag(ide, 'mod');
  const serie = tag(ide, 'serie');
  const numero = tag(ide, 'nNF');
  const emissao = (tag(ide, 'dhEmi') || tag(ide, 'dEmi')).slice(0, 10);
  if (key && /^[0-9A-Z]{44}$/.test(key)) {
    if (cnpj && key.slice(6, 20) !== cnpj) findings.push({ code: 'CNPJ_CHAVE_DIVERGENTE', severity: 'ERRO', message: 'O CNPJ do emitente diverge do CNPJ embutido na chave.' });
    if (modelo && key.slice(20, 22) !== modelo) findings.push({ code: 'MODELO_CHAVE_DIVERGENTE', severity: 'ERRO', message: 'O modelo do XML diverge do modelo embutido na chave.' });
    if (/^\d{1,3}$/.test(serie) && key.slice(22, 25) !== serie.padStart(3, '0')) findings.push({ code: 'SERIE_CHAVE_DIVERGENTE', severity: 'ERRO', message: 'A série do XML diverge da série embutida na chave.' });
    if (/^\d{1,9}$/.test(numero) && key.slice(25, 34) !== numero.padStart(9, '0')) findings.push({ code: 'NUMERO_CHAVE_DIVERGENTE', severity: 'ERRO', message: 'O número do XML diverge do número embutido na chave.' });
    if (/^\d{4}-\d{2}-\d{2}$/.test(emissao) && key.slice(2, 6) !== `${emissao.slice(2, 4)}${emissao.slice(5, 7)}`) findings.push({ code: 'DATA_CHAVE_DIVERGENTE', severity: 'ERRO', message: 'O mês/ano de emissão diverge da data embutida na chave.' });
    if (key.slice(6, 20) !== expectedCnpj && cnpj === expectedCnpj) findings.push({ code: 'EMPRESA_CHAVE_DIVERGENTE', severity: 'ERRO', message: 'A chave da nota não corresponde ao CNPJ da empresa emitente consultada.' });
  }

  const total = block(inf, 'ICMSTot');
  const declaredProducts = total ? cents(tag(total, 'vProd')) : null;
  const details = [...inf.matchAll(/<(?:[A-Za-z_][\w.-]*:)?det\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?det\s*>/gi)];
  if (details.length && declaredProducts !== null) {
    let sum = 0n;
    let complete = true;
    for (const detail of details) {
      const product = block(detail[1], 'prod');
      const amount = product ? cents(tag(product, 'vProd')) : null;
      if (amount === null) { complete = false; break; }
      sum += amount;
    }
    if (!complete) findings.push({ code: 'TOTAL_ITENS_INCOMPLETO', severity: 'ATENCAO', message: 'Não foi possível ler o vProd de todos os itens para comparar com o total.' });
    else if (sum !== declaredProducts) findings.push({
      code: 'SOMA_ITENS_DIVERGENTE', severity: 'ERRO',
      message: `A soma de vProd dos ${details.length} itens diverge do vProd total do XML: itens ${formatCents(sum)}; total ${formatCents(declaredProducts)}; diferença ${formatCents(sum - declaredProducts)}.`,
      encontrado: formatCents(sum), esperado: formatCents(declaredProducts), diferenca: formatCents(sum - declaredProducts),
    });
  } else {
    findings.push({ code: 'COMPARACAO_ITENS_INDISPONIVEL', severity: 'ATENCAO', message: 'O XML não trouxe itens e total de produtos suficientes para comparar a soma.' });
  }

  const protocol = block(xml, 'infProt');
  const protocolStatus = protocol ? tag(protocol, 'cStat') : '';
  const protocolNumber = protocol ? tag(protocol, 'nProt') : '';
  if (!protocol || !['100', '150'].includes(protocolStatus) || !/^\d{1,20}$/.test(protocolNumber)) {
    findings.push({ code: 'AUTORIZACAO_NAO_CONFIRMADA', severity: 'ATENCAO', message: 'O XML não apresenta protocolo/cStat de autorização reconhecido; mantenha a nota pendente de conferência.' });
  }

  return { status: findings.some((item) => item.severity === 'ERRO') ? 'REVISAR' as const : findings.length ? 'PENDENTE' as const : 'SEM_ALERTA_ESTRUTURAL' as const, findings };
}
