/**
 * Assinatura digital da declaração DCTFWeb (serviço TRANSDECLARACAO310 do Integra Contador).
 * Segue a página "Transmitir Declaração" do Serpro: XMLDSig enveloped, RSA-SHA256, resumo SHA-256,
 * C14N 20010315 + transformação enveloped, só o certificado do usuário final, elemento assinado
 * "ConteudoDeclaracao" (referência "#id"). O certificado deve ser o do autor do pedido de dados.
 * Regra crítica: o XML assinado, sem a tag de assinatura, tem de ser idêntico caractere a caractere
 * ao XML recebido do CONSXMLDECLARACAO38 (a Receita compara por hash).
 */
import { createHash } from 'node:crypto';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

const DSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = `${DSIG_NS}enveloped-signature`;
const RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';

export const sha256Hex = (texto: string) => createHash('sha256').update(texto, 'utf8').digest('hex');

export interface CertificadoAssinante { chavePem: string; certificadoPem: string; cnpj: string | null; validoAte: Date; nome: string }

/** Extrai chave privada e certificado do titular (não-CA) de um .pfx/.p12. */
export function lerCertificadoAssinante(pfx: Buffer, senha: string, agora = new Date()): CertificadoAssinante {
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString('binary')));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);
  const chaves = [forge.pki.oids.pkcs8ShroudedKeyBag, forge.pki.oids.keyBag].flatMap(t => p12.getBags({ bagType: t })[t] ?? []);
  const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []).map(b => b.cert).filter((c): c is forge.pki.Certificate => Boolean(c));
  if (!chaves.length || !certs.length) throw new Error('O certificado A1 não contém chave privada e certificado compatíveis.');
  for (const bag of chaves) {
    const chave = bag.key as forge.pki.rsa.PrivateKey | undefined;
    if (!chave) continue;
    const cert = certs.find(c => {
      const pub = c.publicKey as forge.pki.rsa.PublicKey;
      return pub.n && chave.n && pub.n.compareTo(chave.n) === 0 && pub.e.compareTo(chave.e) === 0;
    });
    if (!cert) continue;
    if (agora < cert.validity.notBefore || agora > cert.validity.notAfter) throw new Error('O certificado A1 está vencido ou ainda não é válido.');
    const cn = String(cert.subject.getField('CN')?.value ?? '');
    const m = /:(\d{14})\b/.exec(cn) ?? /\b(\d{14})\b/.exec(cn);
    return { chavePem: forge.pki.privateKeyToPem(chave), certificadoPem: forge.pki.certificateToPem(cert), cnpj: m ? m[1] : null, validoAte: cert.validity.notAfter, nome: cn };
  }
  throw new Error('Nenhum certificado do arquivo corresponde à chave privada.');
}

const ID_CONTEUDO = /<ConteudoDeclaracao\b[^>]*\bid="([^"]+)"/;
const TAG_ASSINATURA = /<(?:\w+:)?Signature\b[\s\S]*?<\/(?:\w+:)?Signature>/;

/** Confere se o XML recebido do CONSXMLDECLARACAO38 está no formato esperado e ainda não assinado. */
export function validarXmlParaAssinar(xml: string): { id: string } {
  if (!xml || xml.length > 5_000_000) throw new Error('XML da declaração vazio ou grande demais.');
  if (!/<ProcDctf\b/.test(xml)) throw new Error('O XML recebido não é uma declaração DCTFWeb (ProcDctf não encontrado).');
  if (TAG_ASSINATURA.test(xml)) throw new Error('O XML já contém assinatura; assinatura dupla seria recusada pela Receita.');
  const m = ID_CONTEUDO.exec(xml);
  if (!m) throw new Error('O XML não tem o elemento ConteudoDeclaracao com atributo id.');
  return { id: m[1] };
}

export interface ResultadoAssinatura { xmlAssinado: string; base64: string; hashOriginal: string; cnpjCertificado: string | null }

/**
 * Assina o ConteudoDeclaracao e insere a assinatura como filha de ProcDctf (depois do ConteudoDeclaracao).
 * Depois de assinar, confere sozinho: assinatura válida e XML sem a assinatura idêntico ao original.
 */
export function assinarDeclaracaoDctfweb(xml: string, cert: CertificadoAssinante, cnpjAutorEsperado?: string): ResultadoAssinatura {
  validarXmlParaAssinar(xml);
  if (cnpjAutorEsperado && cert.cnpj && cert.cnpj !== cnpjAutorEsperado.replace(/\D/g, '')) {
    throw new Error('O certificado A1 não é do escritório que faz o pedido (autorPedidoDados). Nada foi assinado.');
  }
  const sig = new SignedXml({
    privateKey: cert.chavePem,
    publicCert: cert.certificadoPem,
    canonicalizationAlgorithm: C14N,
    signatureAlgorithm: RSA_SHA256,
    getKeyInfoContent: (args) => {
      const base64 = (args?.publicCert ?? cert.certificadoPem).toString().replace(/-----(BEGIN|END) CERTIFICATE-----|\s+/g, '');
      return `<X509Data><X509Certificate>${base64}</X509Certificate></X509Data>`;
    },
  });
  sig.addReference({
    xpath: "//*[local-name(.)='ConteudoDeclaracao']",
    transforms: [ENVELOPED, C14N],
    digestAlgorithm: SHA256,
  });
  sig.computeSignature(xml, { prefix: 'ds', location: { reference: "/*[local-name(.)='ProcDctf']", action: 'append' } });
  const xmlAssinado = sig.getSignedXml();
  const conferencia = conferirAssinatura(xmlAssinado, xml, cert.certificadoPem);
  if (conferencia) throw new Error(`Assinatura gerada não passou na conferência interna: ${conferencia}`);
  return { xmlAssinado, base64: Buffer.from(xmlAssinado, 'utf8').toString('base64'), hashOriginal: sha256Hex(xml), cnpjCertificado: cert.cnpj };
}

/** Devolve null se estiver tudo certo, ou o motivo da falha. */
export function conferirAssinatura(xmlAssinado: string, xmlOriginal: string, certificadoPem: string): string | null {
  const semAssinatura = xmlAssinado.replace(TAG_ASSINATURA, '');
  if (semAssinatura !== xmlOriginal) return 'o XML sem a assinatura não é idêntico ao recebido da Receita';
  const v = new SignedXml({ publicCert: certificadoPem });
  const m = TAG_ASSINATURA.exec(xmlAssinado);
  if (!m) return 'assinatura não encontrada';
  v.loadSignature(m[0].replace(/^<(\w+:)?Signature/, (s) => s));
  let ok = false;
  try { ok = v.checkSignature(xmlAssinado); } catch (e) { return e instanceof Error ? e.message : 'falha ao verificar'; }
  return ok ? null : 'assinatura inválida';
}

export function montarDadosTransmissao(dados: { categoria: string | number; anoPA: string; mesPA?: string; diaPA?: string; numProcReclamatoria?: string }, xmlAssinadoBase64: string): Record<string, unknown> {
  const { categoria, anoPA, mesPA, diaPA, numProcReclamatoria } = dados;
  return { categoria, anoPA, ...(mesPA ? { mesPA } : {}), ...(diaPA ? { diaPA } : {}), ...(numProcReclamatoria ? { numProcReclamatoria } : {}), xmlAssinadoBase64 };
}
