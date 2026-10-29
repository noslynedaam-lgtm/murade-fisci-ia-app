// Quem pode consultar a Receita (Serpro) dentro do Fisco IA e com qual CNPJ de autor.
// - Dono do sistema (administrador): como sempre; o CNPJ de autor é o do contratante.
// - Escritório cliente: só o dono/administrador do PRÓPRIO escritório, e só com o CNPJ do escritório cadastrado pelo dono do sistema;
//   a cobrança vai para o escritório. Sem CNPJ cadastrado, nada é consultado nem cobrado.
export interface InfoEscritorio { nome: string; cnpj: string | null; donoDoSistema: boolean }
export type DecisaoAcesso =
  | { ok: true; escritorio?: { id: string; nome: string }; escritorioCnpj?: string }
  | { ok: false; http: number; mensagem: string };

export function decidirAcessoConsulta(p: { ehAdmin: boolean; tenantId: string; vinculado: boolean; info: InfoEscritorio | null }): DecisaoAcesso {
  if (p.ehAdmin) return { ok: true };
  if (!p.vinculado) return { ok: false, http: 403, mensagem: 'Somente o dono ou o administrador do escritório consulta a Receita.' };
  if (!p.info) return { ok: false, http: 503, mensagem: 'Consulta à Receita temporariamente indisponível neste escritório. Nada foi consultado nem cobrado.' };
  if (p.info.donoDoSistema) return { ok: true };
  if (!p.info.cnpj) return { ok: false, http: 409, mensagem: 'O CNPJ do escritório ainda não foi cadastrado pelo fornecedor do sistema. Peça o cadastro para liberar as consultas à Receita. Nada foi consultado nem cobrado.' };
  return { ok: true, escritorioCnpj: p.info.cnpj, escritorio: { id: p.tenantId, nome: p.info.nome } };
}
