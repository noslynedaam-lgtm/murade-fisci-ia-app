/** Regras para CNPJ numérico e alfanumérico (DV módulo 11, Receita Federal). */
export function normalizarCnpj(valor: string): string {
  return String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14);
}

export function formatarCnpj(valor: string): string {
  const limpo = normalizarCnpj(valor);
  if (limpo.length <= 2) return limpo;
  if (limpo.length <= 5) return `${limpo.slice(0, 2)}.${limpo.slice(2)}`;
  if (limpo.length <= 8) return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5)}`;
  if (limpo.length <= 12) return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}/${limpo.slice(8)}`;
  return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}/${limpo.slice(8, 12)}-${limpo.slice(12, 14)}`;
}

function calcularDigito(base: string, pesos: number[]): number {
  const soma = [...base].reduce((total, caractere, indice) => total + (caractere.charCodeAt(0) - 48) * pesos[indice], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function validarCnpj(valor: string): boolean {
  const cnpj = normalizarCnpj(valor);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^([A-Z0-9])\1+$/.test(cnpj)) return false;
  const primeiro = calcularDigito(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = calcularDigito(`${cnpj.slice(0, 12)}${primeiro}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${primeiro}${segundo}`);
}

/** Valida CPF numérico, aceitando pontuação comum de formulário. */
export function validarCpf(valor: string): boolean {
  const cpf = String(valor ?? '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const calcularDigito = (base: string, pesoInicial: number) => {
    const soma = [...base].reduce((total, digito, indice) => total + Number(digito) * (pesoInicial - indice), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calcularDigito(cpf.slice(0, 9), 10) === Number(cpf[9])
    && calcularDigito(cpf.slice(0, 10), 11) === Number(cpf[10]);
}
