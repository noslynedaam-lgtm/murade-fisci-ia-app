// Trava de liberação da consulta ao Serpro, EMPRESA POR EMPRESA.
// Escritório cliente e as pontes (DP/Fiscal) começam travados: nenhuma consulta, nem a gratuita da semana, sai sem o dono do sistema liberar aquela empresa.
// O dono do sistema consultando pela própria tela do Fisco IA não passa por esta trava.
// Se não der para saber se a empresa está liberada (banco indisponível ou atualização 017 não aplicada), a resposta é NÃO liberada: nunca gasta por engano.
export type DecisaoLiberacao =
  | { ok: true }
  | { ok: false; http: 403 | 503; bloqueadaPorLiberacao: boolean; mensagem: string };

export function decidirLiberacaoEmpresa(p: { exigirLiberacao: boolean; liberada: boolean | null }): DecisaoLiberacao {
  if (!p.exigirLiberacao) return { ok: true };
  if (p.liberada === true) return { ok: true };
  if (p.liberada === null) return { ok: false, http: 503, bloqueadaPorLiberacao: false, mensagem: 'Não foi possível conferir se a consulta ao Serpro está liberada para esta empresa. Por segurança, nada foi consultado nem cobrado.' };
  return { ok: false, http: 403, bloqueadaPorLiberacao: true, mensagem: 'A consulta ao Serpro ainda não foi liberada para esta empresa. Peça a liberação ao fornecedor do sistema. Nada foi consultado nem cobrado.' };
}
