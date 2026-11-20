import test from 'node:test';
import assert from 'node:assert/strict';
import { montarRelatorioCliente, textoWhatsApp, numeroWhatsApp, linkWhatsApp, validarConfigRelatorio, lerConfigRelatorio, dataBr, type EntradaRelatorio } from './relatorioCliente';
import { gerarPdfRelatorio, dimensoesJpeg, paraWinAnsi, quebrarLinhas, larguraTexto } from './pdfRelatorio';

const BASE: EntradaRelatorio = {
  hoje: '2026-11-20', escritorio: { nome: 'Murad Contabilidade', telefone: '(62) 3333-0000', email: null, rodape: null }, empresa: { nome: 'Gela Tudo Ltda', cnpj: '11222333000181' },
  situacaoFiscal: null, caixaPostal: null, caixaLista: null, parcelamentos: null, certidoes: [], certificado: null,
};
const CERT_OK = [{ tipo: 'federal', rotulo: 'CND Federal (Receita Federal + PGFN)', cor: 'verde' as const, texto: 'em dia', validade: '2027-01-10' }];

test('sem nada guardado: cinza, nada inventado, pendências só internas', () => {
  const r = montarRelatorioCliente(BASE);
  assert.equal(r.geral.cor, 'cinza');
  assert.ok(r.pendencias.every((p) => !p.paraCliente));
  assert.ok(r.secoes.every((s) => s.cor === 'cinza'));
});

test('tudo regular: verde e com a data da consulta guardada', () => {
  const r = montarRelatorioCliente({ ...BASE, situacaoFiscal: { situacao: 'regular', consultadoEm: '2026-11-18T15:00:00Z' }, caixaPostal: { novas: 0, consultadoEm: '2026-11-18T15:00:00Z' },
    parcelamentos: { modalidades: ['PARCSN'], atrasadas: [], consultadoEm: '2026-11-18T15:00:00Z' }, certidoes: CERT_OK, certificado: { validade: '2027-06-01', dias: 193 } });
  assert.equal(r.geral.cor, 'verde');
  assert.match(r.secoes.find((s) => s.id === 'situacao')!.linhas[0].texto, /18\/11\/2026.*não apontou pendências/);
  assert.equal(r.pendencias.filter((p) => p.paraCliente).length, 0);
});

test('pendências: situação fiscal, certidão vencida, parcela atrasada, Caixa Postal e certificado viram itens com código fixo', () => {
  const r = montarRelatorioCliente({ ...BASE,
    situacaoFiscal: { situacao: 'pendente', consultadoEm: '2026-09-01T13:00:00Z' },
    caixaPostal: { novas: 1, consultadoEm: '2026-11-18T12:00:00Z' },
    caixaLista: { quantidade: 2, naoLidas: 1, consultadoEm: '2026-11-18T12:00:00Z', naoLidasAssuntos: [{ assunto: 'Termo de Exclusão', enviadaEm: '10/11/2026' }] },
    parcelamentos: { modalidades: ['PARCSN'], atrasadas: [{ nomeModalidade: 'Parcelamento do Simples (ordinário)', parcela: '09/2026', valor: 312.45 }], consultadoEm: '2026-11-18T12:00:00Z' },
    certidoes: [...CERT_OK, { tipo: 'estadual', rotulo: 'CND Estadual (SEFAZ)', cor: 'vermelho', texto: 'vencida há 3 dia(s)', validade: '2026-11-17' }, { tipo: 'municipal', rotulo: 'CND Municipal (Prefeitura)', cor: 'cinza', texto: 'ainda não buscada', validade: null }],
    certificado: { validade: '2026-11-15', dias: -5 } });
  assert.equal(r.geral.cor, 'vermelho');
  const cod = r.pendencias.map((p) => p.codigo);
  for (const c of ['sitfis-pendente', 'certidao-estadual', 'parcelas-atraso', 'caixa-postal', 'certificado-a1', 'certidao-municipal']) assert.ok(cod.includes(c), c);
  assert.equal(r.pendencias.find((p) => p.codigo === 'certidao-municipal')!.paraCliente, false);
  assert.equal(r.pendencias[0].gravidade, 'alta');
  assert.match(r.secoes.find((s) => s.id === 'situacao')!.linhas[0].texto, /tem 80 dias/);
  const caixa = r.secoes.find((s) => s.id === 'caixa')!;
  assert.ok(caixa.linhas.some((l) => /Termo de Exclusão/.test(l.texto)));
  assert.match(caixa.explicacao, /NÃO abriu/);
  assert.ok(r.secoes.find((s) => s.id === 'parcelamentos')!.linhas.some((l) => /R\$\s?312,45/.test(l.texto)));
});

test('WhatsApp: texto com empresa, CNPJ formatado e pontos de atenção; número com 55; link wa.me', () => {
  const r = montarRelatorioCliente({ ...BASE, certidoes: [{ tipo: 'fgts', rotulo: 'CRF - Regularidade do FGTS', cor: 'amarelo', texto: 'vence em 5 dia(s)', validade: '2026-11-25' }] });
  const t = textoWhatsApp(r);
  assert.match(t, /Gela Tudo Ltda \(CNPJ 11\.222\.333\/0001-81\)/);
  assert.match(t, /CRF - Regularidade do FGTS: vence em 5 dia/);
  assert.equal(numeroWhatsApp('(62) 99999-0000'), '5562999990000');
  assert.equal(numeroWhatsApp('5562999990000'), '5562999990000');
  assert.equal(numeroWhatsApp('123'), null);
  assert.ok(linkWhatsApp('5562999990000', 'a b').startsWith('https://wa.me/5562999990000?text=a%20b'));
  assert.ok(linkWhatsApp(null, 'x').startsWith('https://wa.me/?text='));
});

test('configuração: só JPEG pequeno como logo, e-mail válido', () => {
  assert.equal(validarConfigRelatorio({ nomeExibido: 'X', telefone: null, email: null, rodape: null, logoJpegBase64: null }), null);
  assert.match(String(validarConfigRelatorio({ logoJpegBase64: 'iVBORw0KGgo=' })), /JPEG/);
  assert.match(String(validarConfigRelatorio({ logoJpegBase64: '/9j/' + 'A'.repeat(200_001) })), /grande/);
  assert.match(String(validarConfigRelatorio({ email: 'sem-arroba' })), /E-mail/);
  assert.equal(lerConfigRelatorio({ email: 'ruim' }).email, null);
  assert.equal(dataBr('2026-11-20'), '20/11/2026');
});

function jpegMinimo(): Buffer {
  // SOI + SOF0 (altura 20, largura 40, 3 componentes) + EOI: só para testar a leitura do cabeçalho.
  return Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x14, 0x00, 0x28, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);
}

test('PDF: estrutura válida (xref aponta para cada objeto), páginas numeradas, acentos em WinAnsi e logo JPEG', () => {
  const r = montarRelatorioCliente({ ...BASE, situacaoFiscal: { situacao: 'pendente', consultadoEm: '2026-11-18T12:00:00Z' },
    caixaLista: { quantidade: 60, naoLidas: 60, consultadoEm: '2026-11-18T12:00:00Z', naoLidasAssuntos: Array.from({ length: 8 }, (_, i) => ({ assunto: `Comunicação ${i} — ação necessária`, enviadaEm: '01/11/2026' })) }, certidoes: CERT_OK });
  const pdf = gerarPdfRelatorio(r, jpegMinimo());
  const s = pdf.toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4'));
  assert.ok(s.trimEnd().endsWith('%%EOF'));
  const xref = Number(/startxref\n(\d+)/.exec(s)![1]);
  assert.ok(s.slice(xref).startsWith('xref'));
  const entradas = [...s.slice(xref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
  entradas.forEach((off, i) => assert.ok(s.slice(off).startsWith(`${i + 1} 0 obj`), `objeto ${i + 1}`));
  assert.match(s, /\/Subtype \/Image \/Width 40 \/Height 20 \/ColorSpace \/DeviceRGB/);
  assert.match(s, /P\\341gina 1 de \d/);
  assert.match(s, /Situa\\347\\343o fiscal/);
  const semLogo = gerarPdfRelatorio(r, Buffer.from('não é jpeg')).toString('latin1');
  assert.ok(!/\/Subtype \/Image/.test(semLogo), 'logo inválido é ignorado, o PDF sai mesmo assim');
});

test('PDF: peças de texto', () => {
  assert.deepEqual(paraWinAnsi('ção—•☃'), [0xe7, 0xe3, 0x6f, 0x97, 0x95, 63]);
  assert.equal(larguraTexto('A', 10), 6.67);
  assert.ok(quebrarLinhas('palavra '.repeat(40), 10, 100).every((l) => larguraTexto(l, 10) <= 100));
  assert.deepEqual(dimensoesJpeg(jpegMinimo()), { largura: 40, altura: 20, componentes: 3 });
  assert.equal(dimensoesJpeg(Buffer.from('xx')), null);
});
