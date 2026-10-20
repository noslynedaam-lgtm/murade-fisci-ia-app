import { createSecureContext } from 'node:tls';
import forge from 'node-forge';

export type ResultadoPfx =
  | { ok: true; pfx: Buffer; convertido: boolean }
  | { ok: false; motivo: 'senha' | 'formato' };

/**
 * Valida o A1 e, se for um PKCS#12 antigo (RC2/3DES legado que o OpenSSL 3 do Node recusa,
 * comum em certificados emitidos por várias AC), reempacota no formato aceito com a mesma senha.
 */
export function prepararPfx(pfx: Buffer, senha: string): ResultadoPfx {
  try {
    createSecureContext({ pfx, passphrase: senha });
    return { ok: true, pfx, convertido: false };
  } catch { /* tenta o caminho legado */ }

  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString('binary')));
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);
    const chaves = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]
      ?? p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? [];
    const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [])
      .map(b => b.cert).filter((c): c is forge.pki.Certificate => Boolean(c));
    const chave = chaves[0]?.key;
    if (!chave || certs.length === 0) return { ok: false, motivo: 'formato' };
    const novo = forge.pkcs12.toPkcs12Asn1(chave, certs, senha, { algorithm: '3des' });
    const der = Buffer.from(forge.asn1.toDer(novo).getBytes(), 'binary');
    createSecureContext({ pfx: der, passphrase: senha });
    return { ok: true, pfx: der, convertido: true };
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : '';
    return { ok: false, motivo: /password|MAC/i.test(msg) ? 'senha' : 'formato' };
  }
}
