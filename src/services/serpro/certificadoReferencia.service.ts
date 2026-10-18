import { normalizarCnpj, validarCnpj } from '../cnpj/cnpjValidation';

const CAMPOS_SENSIVEIS_LEGADOS = [
  'senha',
  'password',
  'consumerKey',
  'consumerSecret',
  'tokenBearer',
  'privateKey',
  'pfxBase64',
  'arquivoBase64',
  'conteudoArquivo'
] as const;

/** Lê apenas metadados de referência e apaga credenciais legadas da chave da empresa. */
export function lerReferenciaCertificadoEmpresa(cnpj: string): Record<string, unknown> | null {
  const cnpjLimpo = normalizarCnpj(cnpj);
  if (!validarCnpj(cnpjLimpo)) throw new Error('CNPJ inválido para ler a referência local do certificado.');
  const chave = `fiscoia_certificado_cliente_${cnpjLimpo}`;
  const salvo = localStorage.getItem(chave);
  if (salvo === null) return null;

  const referencia: unknown = JSON.parse(salvo);
  if (!referencia || typeof referencia !== 'object' || Array.isArray(referencia)) {
    throw new Error('A referência local do certificado tem formato inválido; nenhum dado foi alterado.');
  }

  const segura = { ...(referencia as Record<string, unknown>) };
  let contemSegredoLegado = false;
  for (const campo of CAMPOS_SENSIVEIS_LEGADOS) {
    if (campo in segura) {
      delete segura[campo];
      contemSegredoLegado = true;
    }
  }

  if (contemSegredoLegado) {
    try {
      localStorage.setItem(chave, JSON.stringify(segura));
    } catch {
      // A chave contém apenas metadados locais; remova-a se não puder sobrescrever
      // o valor antigo que pode incluir uma senha ou conteúdo de certificado.
      let removida = false;
      try {
        localStorage.removeItem(chave);
        removida = true;
      } catch { /* reporta abaixo se nem a remoção foi possível */ }
      throw new Error(removida
        ? 'A referência antiga continha dados sensíveis e foi removida. Cadastre novamente apenas os metadados, sem senha ou arquivo.'
        : 'A referência antiga contém dados sensíveis que não puderam ser limpos automaticamente. Remova os dados do site deste navegador antes de continuar.');
    }
  }
  return segura;
}
