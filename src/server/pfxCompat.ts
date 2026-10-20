import { createSecureContext } from 'node:tls';
import forge from 'node-forge';

export type ResultadoPfx =
  | { ok: true; pfx: Buffer; convertido: boolean }
  | { ok: false; motivo: 'senha' | 'formato'; detalhe?: string };

/**
 * Valida o A1 e, se for um PKCS#12 antigo (RC2/3DES legado que o OpenSSL 3 do Node recusa,
 * comum em certificados emitidos por várias AC), reempacota no formato aceito com a mesma senha.
 */
export function prepararPfx(pfx: Buffer, senha: string): ResultadoPfx {
  const cabecalhoDer = pfx.length > 4 && pfx[0] === 0x30;
  let erroNode = '';
  try {
    createSecureContext({ pfx, passphrase: senha });
    return { ok: true, pfx, convertido: false };
  } catch (e) { erroNode = e instanceof Error ? e.message : ''; }
  // O OpenSSL só chega a verificar a senha depois de reconhecer o arquivo: "mac verify failure" = senha errada.
  if (/mac verify|invalid password|bad decrypt/i.test(erroNode)) return { ok: false, motivo: 'senha' };
  if (!cabecalhoDer) return { ok: false, motivo: 'formato', detalhe: `o conteúdo decodificado (${pfx.length} bytes) não parece um arquivo PKCS#12; confira se a variável tem o .pfx em base64 puro, sem aspas, sem "data:" e sem ter sido convertido duas vezes` };

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
    return { ok: false, motivo: /password|MAC/i.test(msg) ? 'senha' : 'formato', detalhe: `erro do OpenSSL: ${erroNode.slice(0, 80)}; erro da conversão: ${msg.slice(0, 80)}` };
  }
}

/** Lê o .pfx guardado em variável de ambiente, tolerando aspas, quebras de linha e prefixo "data:". */
export function pfxDeVariavel(valor: string): Buffer {
  const limpo = valor.trim().replace(/^["']|["']$/g, '').replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  return Buffer.from(limpo, 'base64');
}
