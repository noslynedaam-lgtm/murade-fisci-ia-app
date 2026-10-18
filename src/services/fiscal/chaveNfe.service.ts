/**
 * Valida a chave de acesso NF-e/NFC-e de 44 caracteres.
 * A partir da NT 2026.004, o campo CNPJ e a chave podem conter letras A-Z;
 * o módulo 11 usa o valor ASCII de cada caractere menos 48.
 */
export function chaveNfeTemDigitoValido(chaveEntrada: string): boolean {
  const chave = String(chaveEntrada ?? '').trim().toUpperCase();
  if (!/^[0-9A-Z]{44}$/.test(chave)) return false;

  let peso = 2;
  let soma = 0;
  for (let indice = 42; indice >= 0; indice -= 1) {
    soma += (chave.charCodeAt(indice) - 48) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const digito = resto === 0 || resto === 1 ? 0 : 11 - resto;
  return digito === Number(chave[43]);
}
