import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type EstadoChaveDados = 'nao_configurada' | 'invalida' | 'valida';

const ENV_KEY = 'FISCOIA_DATA_ENCRYPTION_KEY';
const ENV_KEY_VERSION = 'FISCOIA_DATA_ENCRYPTION_KEY_VERSION';
const BASE64_32_BYTE_KEY = /^[A-Za-z0-9+/]{43}=$/;

function obterChave(): Buffer {
  const encoded = process.env[ENV_KEY]?.trim();
  if (!encoded || !BASE64_32_BYTE_KEY.test(encoded)) {
    throw new Error('A chave de criptografia de dados do Fisco IA não está configurada corretamente no servidor.');
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) {
    throw new Error('A chave de criptografia de dados do Fisco IA precisa ser uma chave base64 canônica de 32 bytes.');
  }
  return key;
}

function validarVinculo(tenantId: string, companyId: string) {
  if (!tenantId || !companyId) throw new Error('Empresa e organização são obrigatórias para proteger o XML.');
}

export function estadoChaveDados(): EstadoChaveDados {
  if (!process.env[ENV_KEY]?.trim()) return 'nao_configurada';
  try { obterChave(); return 'valida'; }
  catch { return 'invalida'; }
}

export function criptografarXml(tenantId: string, companyId: string, xml: string) {
  validarVinculo(tenantId, companyId);
  if (typeof xml !== 'string' || !xml.trim()) throw new Error('O XML está vazio; nenhum dado foi criptografado.');

  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', obterChave(), nonce);
  cipher.setAAD(Buffer.from(`fiscoia:xml:${tenantId}:${companyId}`, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(xml, 'utf8'), cipher.final()]);
  const version = process.env[ENV_KEY_VERSION]?.trim() || 'v1';
  if (!/^[a-zA-Z0-9._-]{1,32}$/.test(version)) throw new Error('A versão da chave de criptografia tem formato inválido.');

  return { ciphertext, nonce, authTag: cipher.getAuthTag(), keyVersion: version };
}

export function descriptografarXml(
  tenantId: string,
  companyId: string,
  encrypted: { ciphertext: Buffer; nonce: Buffer; authTag: Buffer; keyVersion: string },
): string {
  validarVinculo(tenantId, companyId);
  if (encrypted.keyVersion !== (process.env[ENV_KEY_VERSION]?.trim() || 'v1')) {
    throw new Error('O XML usa outra versão de chave; ele não foi aberto. Configure a chave correspondente para leitura/rotação.');
  }
  if (encrypted.nonce.length !== 12 || encrypted.authTag.length !== 16) {
    throw new Error('Os metadados criptográficos do XML estão inválidos; o conteúdo foi preservado.');
  }

  const decipher = createDecipheriv('aes-256-gcm', obterChave(), encrypted.nonce);
  decipher.setAAD(Buffer.from(`fiscoia:xml:${tenantId}:${companyId}`, 'utf8'));
  decipher.setAuthTag(encrypted.authTag);
  return Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()]).toString('utf8');
}
