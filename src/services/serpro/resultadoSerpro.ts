/** Transforma a resposta bruta do SERPRO (PGDAS-D, declarações do ano) em linhas legíveis. Sem rede; nada é inventado. */
export interface LinhaDeclaracao {
  periodo: string;       // 06/2026
  numero: string;        // número da declaração
  tipo: string;          // Original / Retificadora
  transmitidoEm: string; // dd/mm/aaaa hh:mm
  malha: string;
  das: string;           // número do DAS ou —
  dasPago: boolean | null;
}

function dataHora(v: unknown): string {
  const s = String(v ?? '');
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?$/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : s || '—';
}
function periodo(v: unknown): string {
  const s = String(v ?? '');
  return /^\d{6}$/.test(s) ? `${s.slice(4)}/${s.slice(0, 4)}` : s || '—';
}

export function lerDeclaracoes(bruto: unknown): LinhaDeclaracao[] | null {
  let dados: unknown = (bruto as { dados?: unknown } | null)?.dados;
  if (typeof dados === 'string') { try { dados = JSON.parse(dados); } catch { return null; } }
  if (dados === undefined || dados === null || dados === '') return null;
  const anos = Array.isArray(dados) ? dados : [dados];
  const linhas: LinhaDeclaracao[] = [];
  for (const ano of anos as Record<string, unknown>[]) {
    const periodos = Array.isArray(ano?.periodos) ? ano.periodos as Record<string, unknown>[] : null;
    if (!periodos) return null;
    for (const p of periodos) {
      const operacoes = Array.isArray(p.operacoes) ? p.operacoes as Record<string, unknown>[] : [];
      for (const op of operacoes) {
        const idx = (op.indiceDeclaracao ?? {}) as Record<string, unknown>;
        const das = idx.indiceDas as Record<string, unknown> | null | undefined;
        linhas.push({
          periodo: periodo(p.periodoApuracao),
          numero: String(idx.numeroDeclaracao ?? '—'),
          tipo: String(op.tipoOperacao ?? '—'),
          transmitidoEm: dataHora(idx.dataHoraTransmissao),
          malha: String(idx.malha ?? '').trim(),
          das: das ? String(das.numeroDas ?? das.numero ?? 'Emitido') : '—',
          dasPago: das && typeof das.dasPago === 'boolean' ? das.dasPago : null,
        });
      }
    }
  }
  return linhas;
}

const aspas = (v: string) => `"${v.replace(/"/g, '""')}"`;
/** CSV com ponto e vírgula e BOM, para abrir direto no Excel brasileiro. */
export function declaracoesParaCsv(linhas: LinhaDeclaracao[]): string {
  const cab = ['Período', 'Nº da declaração', 'Tipo', 'Transmitida em', 'Malha', 'DAS', 'DAS pago'];
  const corpo = linhas.map(l => [l.periodo, l.numero, l.tipo, l.transmitidoEm, l.malha || '—', l.das, l.dasPago === null ? '—' : l.dasPago ? 'Sim' : 'Não']);
  return '﻿' + [cab, ...corpo].map(r => r.map(aspas).join(';')).join('\r\n');
}

function dadosComoObjeto(bruto: unknown): unknown {
  let d: unknown = (bruto as { dados?: unknown } | null)?.dados;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return null; } }
  return d;
}

/** Situação fiscal (SITFIS), etapa 1: o SERPRO devolve um protocolo e o tempo de espera em ms. */
export function lerProtocoloSitfis(bruto: unknown): { protocolo: string; esperaMs: number } | null {
  const d = dadosComoObjeto(bruto) as { protocoloRelatorio?: unknown; tempoEspera?: unknown } | null;
  if (!d || typeof d.protocoloRelatorio !== 'string' || !d.protocoloRelatorio) return null;
  const t = Number(d.tempoEspera);
  return { protocolo: d.protocoloRelatorio, esperaMs: Number.isFinite(t) && t > 0 ? t : 4000 };
}

/** Procura em qualquer ponto da resposta um PDF em base64 (começa com "JVBERi"). */
export function acharPdfBase64(valor: unknown, nivel = 0): string | null {
  if (nivel > 6 || valor === null || valor === undefined) return null;
  if (typeof valor === 'string') {
    if (/^JVBERi[A-Za-z0-9+/=\s]{100,}$/.test(valor)) return valor.replace(/\s/g, '');
    if (valor.startsWith('{') || valor.startsWith('[')) { try { return acharPdfBase64(JSON.parse(valor), nivel + 1); } catch { return null; } }
    return null;
  }
  if (Array.isArray(valor)) { for (const v of valor) { const r = acharPdfBase64(v, nivel + 1); if (r) return r; } return null; }
  if (typeof valor === 'object') { for (const v of Object.values(valor as Record<string, unknown>)) { const r = acharPdfBase64(v, nivel + 1); if (r) return r; } }
  return null;
}

/** CONSXMLDECLARACAO38: dados = {"XMLStringBase64": "..."}. Devolve o XML em texto (UTF-8) ou null. */
export function lerXmlDeclaracao(bruto: unknown): string | null {
  const d = dadosComoObjeto(bruto) as { XMLStringBase64?: unknown } | null;
  if (!d || typeof d.XMLStringBase64 !== 'string' || !d.XMLStringBase64) return null;
  const xml = Buffer.from(d.XMLStringBase64.replace(/\s/g, ''), 'base64').toString('utf8');
  return xml.includes('<ProcDctf') ? xml : null;
}

/** TRANSDECLARACAO310: dados = {"NumeroRecibo": 24781}. */
export function lerReciboTransmissao(bruto: unknown): string | null {
  const d = dadosComoObjeto(bruto) as { NumeroRecibo?: unknown } | null;
  return d && (typeof d.NumeroRecibo === 'number' || typeof d.NumeroRecibo === 'string') && String(d.NumeroRecibo) ? String(d.NumeroRecibo) : null;
}
