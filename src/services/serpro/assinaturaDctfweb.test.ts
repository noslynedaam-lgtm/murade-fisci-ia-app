import test from 'node:test';
import assert from 'node:assert/strict';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { assinarDeclaracaoDctfweb, conferirAssinatura, lerCertificadoAssinante, montarDadosTransmissao, validarXmlParaAssinar, sha256Hex } from './assinaturaDctfweb';

function pfxDeTeste(cnpj = '11222333000181', senha = 'teste123', vencido = false): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey; cert.serialNumber = '01';
  const agora = Date.now();
  cert.validity.notBefore = new Date(agora - (vencido ? 400 : 1) * 86400000);
  cert.validity.notAfter = new Date(agora + (vencido ? -300 : 300) * 86400000);
  const attrs = [{ name: 'commonName', value: `ESCRITORIO TESTE LTDA:${cnpj}` }];
  cert.setSubject(attrs); cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], senha, { algorithm: '3des' });
  return Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary');
}

const XML = '<?xml version="1.0" encoding="utf-8"?><ProcDctf xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.serpro.gov.br/dctf/v1"><ConteudoDeclaracao id="id_16436"><tns1:DctfXml xsi:type="DctfXml_v3" versao="3.0" xmlns:tns1="http://www.serpro.gov.br/dctf/v1" xmlns="http://www.serpro.gov.br/dctf/v1" type="DctfXml_v3"><A000-DadosIdentificadoresContribuinte><inscContrib>11222333000181</inscContrib><perApuracao>062022</perApuracao></A000-DadosIdentificadoresContribuinte></tns1:DctfXml></ConteudoDeclaracao></ProcDctf>';
const cert = lerCertificadoAssinante(pfxDeTeste(), 'teste123');

test('lê o certificado e o CNPJ do titular', () => {
  assert.equal(cert.cnpj, '11222333000181');
  assert.throws(() => lerCertificadoAssinante(pfxDeTeste('11222333000181', 'x', true), 'x'), /vencido/);
  assert.throws(() => lerCertificadoAssinante(pfxDeTeste(), 'senha-errada'));
});

test('assina com os padrões exigidos e o XML sem assinatura continua idêntico', () => {
  const r = assinarDeclaracaoDctfweb(XML, cert, '11.222.333/0001-81');
  assert.equal(r.xmlAssinado.replace(/<ds:Signature[\s\S]*<\/ds:Signature>/, ''), XML);
  assert.match(r.xmlAssinado, /Algorithm="http:\/\/www.w3.org\/TR\/2001\/REC-xml-c14n-20010315"/);
  assert.match(r.xmlAssinado, /xmldsig-more#rsa-sha256/);
  assert.match(r.xmlAssinado, /xmlenc#sha256/);
  assert.match(r.xmlAssinado, /enveloped-signature/);
  assert.match(r.xmlAssinado, /URI="#id_16436"/);
  assert.equal((r.xmlAssinado.match(/<X509Certificate>/g) ?? []).length, 1);
  assert.ok(r.xmlAssinado.indexOf('</ConteudoDeclaracao>') < r.xmlAssinado.indexOf('<ds:Signature'));
  assert.equal(Buffer.from(r.base64, 'base64').toString('utf8'), r.xmlAssinado);
  assert.equal(r.hashOriginal, sha256Hex(XML));
  assert.equal(conferirAssinatura(r.xmlAssinado, XML, cert.certificadoPem), null);
});

test('verificação independente da assinatura', () => {
  const r = assinarDeclaracaoDctfweb(XML, cert);
  const v = new SignedXml({ publicCert: cert.certificadoPem });
  v.loadSignature(/<ds:Signature[\s\S]*<\/ds:Signature>/.exec(r.xmlAssinado)![0]);
  assert.equal(v.checkSignature(r.xmlAssinado), true);
});

test('detecta alteração do conteúdo assinado', () => {
  const r = assinarDeclaracaoDctfweb(XML, cert);
  const adulterado = r.xmlAssinado.replace('062022', '072022');
  assert.notEqual(conferirAssinatura(adulterado, XML, cert.certificadoPem), null);
});

test('recusa certificado de outro CNPJ, XML já assinado e XML estranho', () => {
  assert.throws(() => assinarDeclaracaoDctfweb(XML, cert, '00000000000191'), /não é do escritório/);
  const r = assinarDeclaracaoDctfweb(XML, cert);
  assert.throws(() => validarXmlParaAssinar(r.xmlAssinado), /já contém assinatura/);
  assert.throws(() => validarXmlParaAssinar('<a/>'), /ProcDctf/);
  assert.throws(() => validarXmlParaAssinar('<ProcDctf><x/></ProcDctf>'), /ConteudoDeclaracao/);
});

test('monta o campo dados da transmissão', () => {
  assert.deepEqual(montarDadosTransmissao({ categoria: 'GERAL_MENSAL', anoPA: '2026', mesPA: '09' }, 'QUJD'), { categoria: 'GERAL_MENSAL', anoPA: '2026', mesPA: '09', xmlAssinadoBase64: 'QUJD' });
  assert.deepEqual(montarDadosTransmissao({ categoria: 41, anoPA: '2026' }, 'QUJD'), { categoria: 41, anoPA: '2026', xmlAssinadoBase64: 'QUJD' });
});
