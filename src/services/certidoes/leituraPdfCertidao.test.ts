// Testes com PDFs MONTADOS aqui (nenhum acesso a portal de órgão). Cobrem PDF comprimido, fonte com ToUnicode em objeto comprimido
// (ObjStm), cadeias hexadecimais, e a leitura de número, situação, emissão, validade e CNPJ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { lerCMap, lerCertidaoDoPdf, lerCertidaoDoTexto, resultadoDoTexto, textoDoPdfCertidao, tipoDoTexto } from './leituraPdfCertidao';
import { ADAPTADORES, portalDaCertidao } from './certidoes';

const CNPJ = '11222333000181';

/** Monta um PDF mínimo. Cada objeto: dicionário + (opcional) fluxo, comprimido com Flate quando pedido. */
function montarPdf(objetos: Array<{ dic: string; fluxo?: Buffer | string; flate?: boolean }>): Buffer {
  const partes: Buffer[] = [Buffer.from('%PDF-1.5\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  objetos.forEach((o, i) => {
    if (o.fluxo === undefined) { partes.push(Buffer.from(`${i + 1} 0 obj\n${o.dic}\nendobj\n`, 'latin1')); return; }
    const bruto = Buffer.isBuffer(o.fluxo) ? o.fluxo : Buffer.from(o.fluxo, 'latin1');
    const dados = o.flate ? deflateSync(bruto) : bruto;
    const dic = o.dic.replace(/>>\s*$/, ` /Length ${dados.length}${o.flate ? ' /Filter /FlateDecode' : ''} >>`);
    partes.push(Buffer.from(`${i + 1} 0 obj\n${dic}\nstream\n`, 'latin1'), dados, Buffer.from('\nendstream\nendobj\n', 'latin1'));
  });
  partes.push(Buffer.from('trailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1'));
  return Buffer.concat(partes);
}
const esc = (s: string) => Buffer.from(s, 'latin1').toString('latin1').replace(/([()\\])/g, '\\$1');
/** PDF de uma página com fonte simples (WinAnsi), texto em linhas com Tj, conteúdo comprimido. */
function pdfSimples(linhas: string[]): Buffer {
  const conteudo = `BT /F1 10 Tf 50 800 Td ${linhas.map((l) => `(${esc(l)}) Tj 0 -14 Td`).join(' ')} ET`;
  return montarPdf([
    { dic: '<< /Type /Catalog /Pages 2 0 R >>' },
    { dic: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    { dic: '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>' },
    { dic: '<< >>', fluxo: conteudo, flate: true },
    { dic: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' },
  ]);
}

const CNDT_NEGATIVA = [
  'PODER JUDICIARIO', 'JUSTICA DO TRABALHO', 'CERTIDÃO NEGATIVA DE DÉBITOS TRABALHISTAS',
  'Nome: MURAL COMERCIO LTDA', 'CNPJ: 11.222.333/0001-81', 'Certidão nº: 81234567/2026',
  'Expedição: 20/11/2026, às 10:15:30', 'Validade: 18/05/2027 - 180 (cento e oitenta) dias, contados da data de sua expedição.',
  'Certifica-se que MURAL COMERCIO LTDA NÃO CONSTA como inadimplente no Banco Nacional de Devedores Trabalhistas.',
  'A certidão positiva com efeito de negativa é expedida quando houver débito garantido.',
];

test('CNDT negativa (PDF comprimido, fonte simples): número, situação, expedição, validade e CNPJ lidos do PDF', () => {
  const l = lerCertidaoDoPdf('trabalhista', pdfSimples(CNDT_NEGATIVA), { cnpjEsperado: CNPJ });
  assert.equal(l.textoLido, true);
  assert.equal(l.tipoDetectado, 'trabalhista');
  assert.equal(l.resultado, 'negativa', 'o título vem antes da observação do rodapé');
  assert.equal(l.numero, '81234567/2026');
  assert.equal(l.emissao, '2026-11-20');
  assert.equal(l.validade, '2027-05-18');
  assert.equal(l.validadeOrigem, 'lida_do_pdf');
  assert.equal(l.cnpjConfere, 'sim');
  assert.deepEqual(l.avisos, []);
});

test('fonte composta com ToUnicode guardada em objeto comprimido (ObjStm) e cadeias hexadecimais', () => {
  const texto = 'CERTIFICADO DE REGULARIDADE DO FGTS - CRF';
  const linhas = [texto, 'Inscrição: 11.222.333/0001-81', 'a empresa encontra-se em situação regular perante o Fundo de Garantia do Tempo de Serviço',
    'Validade: 10/11/2026 a 09/12/2026', 'Certificação Número: 2026111004502870577421', 'Informação obtida em 20/11/2026 10:00:00'];
  // Códigos de 2 bytes: cada caractere vira 0x0100 + posição dele no "alfabeto" deste PDF (como fazem os geradores com subconjunto de fonte).
  const alfabeto = [...new Set(linhas.join('').split(''))];
  const cod = (ch: string) => (0x100 + alfabeto.indexOf(ch)).toString(16).padStart(4, '0').toUpperCase();
  const conteudo = `BT /F2 9 Tf ${linhas.map((l, i) => `1 0 0 1 40 ${780 - i * 12} Tm [<${l.split('').map(cod).join('')}>] TJ`).join(' ')} ET`;
  const hex = (s: string) => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  const cmap = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap 1 begincodespacerange <0000> <FFFF> endcodespacerange
${alfabeto.length} beginbfchar
${alfabeto.map((c) => `<${cod(c)}> <${hex(c)}>`).join('\n')}
endbfchar endcmap CMapName currentdict /CMap defineresource pop end end`;
  // Objeto 8 (a fonte) só existe dentro do fluxo de objetos 6, como nos PDFs 1.5+.
  const fonte = '<< /Type /Font /Subtype /Type0 /BaseFont /ABCDEF+Arial /Encoding /Identity-H /ToUnicode 5 0 R >>';
  const objStm = `8 0 ${fonte}`;
  const pdf = montarPdf([
    { dic: '<< /Type /Catalog /Pages 2 0 R >>' },
    { dic: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    { dic: '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F2 8 0 R >> >> /Contents 4 0 R >>' },
    { dic: '<< >>', fluxo: conteudo, flate: true },
    { dic: '<< >>', fluxo: cmap, flate: true },
    { dic: `<< /Type /ObjStm /N 1 /First ${objStm.indexOf('<<')} >>`, fluxo: objStm, flate: true },
  ]);
  const t = textoDoPdfCertidao(pdf);
  assert.match(t, /CERTIFICADO DE REGULARIDADE DO FGTS/);
  const l = lerCertidaoDoPdf('fgts', pdf, { cnpjEsperado: CNPJ });
  assert.equal(l.resultado, 'negativa');
  assert.equal(l.validade, '2026-12-09', 'no CRF a validade é o FIM do período');
  assert.equal(l.numero, '2026111004502870577421');
  assert.equal(l.emissao, '2026-11-20');
  assert.equal(l.cnpjConfere, 'sim');
});

test('situação: positiva com efeito de negativa e positiva, pela primeira expressão do texto', () => {
  assert.equal(resultadoDoTexto('CERTIDÃO POSITIVA DE DÉBITOS TRABALHISTAS COM EFEITO DE NEGATIVA ... certidão negativa', 'trabalhista'), 'positiva_efeito_negativa');
  assert.equal(resultadoDoTexto('CERTIDÃO POSITIVA, COM EFEITOS DE NEGATIVA', 'estadual'), 'positiva_efeito_negativa');
  assert.equal(resultadoDoTexto('CERTIDÃO POSITIVA DE DÉBITOS TRABALHISTAS. Consta como inadimplente.', 'trabalhista'), 'positiva');
  assert.equal(resultadoDoTexto('Certidão Negativa de Débitos. Observação: certidão positiva é emitida quando...', 'municipal'), 'negativa');
  assert.equal(resultadoDoTexto('Documento qualquer sem expressão', 'municipal'), null);
});

test('qual certidão o PDF parece ser (aviso quando solta na linha errada)', () => {
  assert.equal(tipoDoTexto('Certidão Negativa de Débitos Trabalhistas'), 'trabalhista');
  assert.equal(tipoDoTexto('Certificado de Regularidade do FGTS'), 'fgts');
  assert.equal(tipoDoTexto('PREFEITURA DE GOIÂNIA certidão negativa ... dívida ativa'), 'municipal');
  assert.equal(tipoDoTexto('ESTADO DE GOIÁS SECRETARIA DE ESTADO DA ECONOMIA certidão de débito inscrito em dívida ativa'), 'estadual');
  assert.equal(tipoDoTexto('Receita Federal do Brasil e Procuradoria-Geral da Fazenda Nacional'), 'federal');
  const l = lerCertidaoDoTexto('estadual', CNDT_NEGATIVA.join(' '), { cnpjEsperado: CNPJ, uf: 'GO' });
  assert.ok(l.avisos.some((a) => /outra certidão \(trabalhista\)/.test(a)));
});

test('CNPJ do PDF: de outra empresa (bloqueia na tela), outro estabelecimento da mesma raiz (avisa) e ausente (avisa)', () => {
  const t = (cnpj: string) => `CERTIDÃO NEGATIVA DE DÉBITOS PREFEITURA CNPJ ${cnpj} Número da certidão: 123456 Emitida em 01/11/2026 Válida até 01/12/2026`;
  assert.equal(lerCertidaoDoTexto('municipal', t('99.888.777/0001-66'), { cnpjEsperado: CNPJ }).cnpjConfere, 'nao');
  const raiz = lerCertidaoDoTexto('municipal', t('11.222.333/0002-62'), { cnpjEsperado: CNPJ });
  assert.equal(raiz.cnpjConfere, 'mesma_raiz'); assert.ok(raiz.avisos.some((a) => /mesma raiz/.test(a)));
  const sem = lerCertidaoDoTexto('municipal', 'CERTIDÃO NEGATIVA DE DÉBITOS PREFEITURA Número da certidão: 123456 Emitida em 01/11/2026 Válida até 01/12/2026', { cnpjEsperado: CNPJ });
  assert.equal(sem.cnpjConfere, 'nao_encontrado'); assert.equal(sem.validade, '2026-12-01'); assert.equal(sem.emissao, '2026-11-01'); assert.equal(sem.numero, '123456');
});

test('validade pela norma só quando o PDF não traz: CNDT 180 dias; estadual de GO 60 dias; demais ficam para a pessoa', () => {
  const cndt = lerCertidaoDoTexto('trabalhista', 'CERTIDÃO NEGATIVA DE DÉBITOS TRABALHISTAS CNPJ: 11.222.333/0001-81 Certidão nº: 5555/2026 Expedição: 20/11/2026', { cnpjEsperado: CNPJ });
  assert.equal(cndt.validade, '2027-05-19'); assert.equal(cndt.validadeOrigem, 'calculada_pela_norma'); assert.match(String(cndt.fonteValidade), /642-A/);
  const go = lerCertidaoDoTexto('estadual', 'ESTADO DE GOIÁS CERTIDÃO NEGATIVA DE DÉBITOS dívida ativa CNPJ 11.222.333/0001-81 Código de controle: AB12CD34 Emitida em 20/11/2026', { cnpjEsperado: CNPJ, uf: 'GO' });
  assert.equal(go.validade, '2027-01-19'); assert.match(String(go.fonteValidade), /IN 405\/99-GSF/); assert.equal(go.numero, 'AB12CD34');
  const sp = lerCertidaoDoTexto('estadual', 'CERTIDÃO NEGATIVA DE DÉBITOS secretaria da fazenda CNPJ 11.222.333/0001-81 Emitida em 20/11/2026', { cnpjEsperado: CNPJ, uf: 'SP' });
  assert.equal(sp.validade, null); assert.ok(sp.avisos.some((a) => /Não achei a validade/.test(a)));
  const crf = lerCertidaoDoTexto('fgts', 'CERTIFICADO DE REGULARIDADE DO FGTS situação regular Informação obtida em 20/11/2026', {});
  assert.equal(crf.validade, null, 'CRF sem validade escrita não ganha prazo inventado');
});

test('PDF sem texto (imagem digitalizada) ou que não é PDF: nada inventado, a pessoa preenche', () => {
  const imagem = montarPdf([{ dic: '<< /Type /Catalog >>' }, { dic: '<< /Type /XObject /Subtype /Image /Width 1 /Height 1 >>', fluxo: Buffer.from([0, 0, 0]) }]);
  const l = lerCertidaoDoPdf('municipal', imagem, { cnpjEsperado: CNPJ });
  assert.equal(l.textoLido, false); assert.equal(l.resultado, null); assert.equal(l.validade, null); assert.equal(l.numero, null);
  assert.equal(textoDoPdfCertidao(Buffer.from('não é pdf')), '');
  assert.equal(lerCertidaoDoTexto('municipal', 'Data: 31/02/2026 Validade: 31/02/2026 CERTIDÃO NEGATIVA DE DÉBITOS prefeitura xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx').validade, null, 'data impossível não vira validade');
});

test('adaptadores: só a federal é automática; estadual, municipal, FGTS e CNDT são semiautomáticas com portal oficial', () => {
  for (const t of ['estadual', 'municipal', 'fgts', 'trabalhista'] as const) assert.equal(ADAPTADORES[t].modo, 'semiautomatica');
  assert.equal(ADAPTADORES.federal.modo, 'automatica_paga');
  assert.equal(portalDaCertidao('estadual', 'go', null), 'https://www.sefaz.go.gov.br/Certidao/Emissao/');
  assert.equal(portalDaCertidao('municipal', 'GO', 'Goiânia'), 'https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00300f0.asp');
  assert.equal(portalDaCertidao('municipal', 'GO', 'Anápolis'), null, 'sem portal cadastrado: a tela usa a lista de órgãos públicos');
  assert.equal(portalDaCertidao('estadual', 'SP', null), null);
  assert.match(String(portalDaCertidao('fgts')), /^https:\/\/consulta-crf\.caixa\.gov\.br\//);
  assert.match(String(portalDaCertidao('trabalhista')), /^https:\/\/www\.tst\.jus\.br\//);
});

test('CMap com faixa (bfrange) e destino em lista', () => {
  const m = lerCMap('begincodespacerange <00> <FF> endcodespacerange 2 beginbfrange <41> <43> <0061> <44> <45> [<00E7> <00E3>] endbfrange');
  assert.equal(m.bytes, 1);
  assert.equal([0x41, 0x42, 0x43, 0x44, 0x45].map((c) => m.mapa.get(c)).join(''), 'abcçã');
});
