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
