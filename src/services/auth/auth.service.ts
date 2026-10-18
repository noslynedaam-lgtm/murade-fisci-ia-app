import { UsuarioAuth, DadosCadastroContador } from '../../types';

export interface EmailEnviadoLog {
  id: string;
  para: string;
  assunto: string;
  corpo: string;
  dataEnvio: string;
  tipo: 'ACESSO_INICIAL' | 'RECUPERACAO_SENHA';
  link?: string;
  senhaProvisoria?: string;
}

const STORAGE_EMAILS_KEY = 'fiscoia_emails_enviados_db';

/** Apenas registros locais antigos para compatibilidade visual; não representam e-mails enviados. */
export function obterEmailsEnviados(): EmailEnviadoLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_EMAILS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is EmailEnviadoLog =>
      item && typeof item === 'object' &&
      item.tipo !== 'ACESSO_INICIAL' && item.tipo !== 'RECUPERACAO_SENHA' &&
      typeof item.id === 'string' && typeof item.para === 'string' &&
      typeof item.assunto === 'string' && typeof item.corpo === 'string' &&
      typeof item.dataEnvio === 'string'
    );
  } catch {
    return [];
  }
}

async function requisicaoAuthCentral<T>(caminho: string, init?: RequestInit): Promise<{ ok: boolean; status: number; dados: T | null }> {
  try {
    const resposta = await fetch(`/api/auth/${caminho}`, {
      ...init,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      cache: 'no-store',
    });
    const dados = await resposta.json().catch(() => null) as T | null;
    return { ok: resposta.ok, status: resposta.status, dados };
  } catch {
    return { ok: false, status: 0, dados: null };
  }
}

/** Cookies HttpOnly não podem nem devem ser lidos pelo navegador. */
export function obterSessaoAtual(): UsuarioAuth | null {
  return null;
}

export async function validarSessaoCentral(): Promise<{ autenticado: boolean; usuario?: UsuarioAuth; mensagem?: string }> {
  const resultado = await requisicaoAuthCentral<{ autenticado?: boolean; usuario?: UsuarioAuth; mensagem?: string }>('session');
  if (resultado.ok && resultado.dados?.autenticado && resultado.dados.usuario) {
    return { autenticado: true, usuario: resultado.dados.usuario };
  }
  if (resultado.status === 401) return { autenticado: false };
  return {
    autenticado: false,
    mensagem: resultado.dados?.mensagem || 'Não foi possível validar sua sessão no servidor. Confira a conexão e tente novamente.',
  };
}

export async function login(email: string, senha: string): Promise<{
  sucesso: boolean;
  mensagem?: string;
  precisaTrocarSenha?: boolean;
  usuario?: UsuarioAuth;
}> {
  const resultado = await requisicaoAuthCentral<{ sucesso?: boolean; usuario?: UsuarioAuth; mensagem?: string }>('login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });
  if (!resultado.ok || !resultado.dados?.usuario) {
    return { sucesso: false, mensagem: resultado.dados?.mensagem || (resultado.status === 0
      ? 'Não foi possível conectar ao servidor de autenticação.'
      : 'E-mail ou senha incorretos.') };
  }
  return {
    sucesso: true,
    precisaTrocarSenha: resultado.dados.usuario.primeiroAcesso,
    usuario: resultado.dados.usuario,
  };
}

export async function trocarSenhaPrimeiroAcesso(
  _email: string,
  senhaTemporaria: string,
  novaSenha: string,
): Promise<{ sucesso: boolean; mensagem: string; usuario?: UsuarioAuth }> {
  const resultado = await requisicaoAuthCentral<{ sucesso?: boolean; mensagem?: string; usuario?: UsuarioAuth }>('change-password', {
    method: 'POST',
    body: JSON.stringify({ senhaAtual: senhaTemporaria, novaSenha }),
  });
  if (!resultado.ok || !resultado.dados?.usuario) {
    return { sucesso: false, mensagem: resultado.dados?.mensagem || 'Não foi possível alterar a senha no servidor.' };
  }
  return { sucesso: true, mensagem: resultado.dados.mensagem || 'Senha alterada no servidor.', usuario: resultado.dados.usuario };
}

export async function logout(): Promise<{ sucesso: boolean; mensagem?: string }> {
  const resultado = await requisicaoAuthCentral<{ sucesso?: boolean; mensagem?: string }>('logout', {
    method: 'POST',
    body: '{}',
  });
  return resultado.ok
    ? { sucesso: true }
    : { sucesso: false, mensagem: resultado.dados?.mensagem || 'O servidor não confirmou o encerramento da sessão.' };
}

/** Troca a senha da conta autenticada no servidor; não altera credenciais locais. */
export async function alterarSenhaContaLocal(_email: string, senhaAtual: string, novaSenha: string): Promise<{ sucesso: boolean; mensagem: string }> {
  const resultado = await requisicaoAuthCentral<{ sucesso?: boolean; mensagem?: string }>('change-password', {
    method: 'POST',
    body: JSON.stringify({ senhaAtual, novaSenha }),
  });
  if (resultado.ok && resultado.dados?.sucesso) {
    return { sucesso: true, mensagem: resultado.dados.mensagem || 'Senha alterada no servidor.' };
  }
  return { sucesso: false, mensagem: resultado.dados?.mensagem || 'Não foi possível alterar a senha no servidor.' };
}

export async function cadastrarContador(dados: DadosCadastroContador): Promise<{
  sucesso: boolean; mensagem: string; senhaProvisoria?: string; usuario?: UsuarioAuth;
}> {
  const resultado = await requisicaoAuthCentral<{
    sucesso?: boolean; mensagem?: string; senhaProvisoria?: string; usuario?: UsuarioAuth;
  }>('users', { method: 'POST', body: JSON.stringify(dados) });
  if (!resultado.ok || !resultado.dados?.sucesso || !resultado.dados.usuario) {
    return { sucesso: false, mensagem: resultado.dados?.mensagem || 'Não foi possível criar a conta central.' };
  }
  return {
    sucesso: true,
    mensagem: resultado.dados.mensagem || 'Conta central criada.',
    senhaProvisoria: resultado.dados.senhaProvisoria,
    usuario: resultado.dados.usuario,
  };
}

export async function listarContasParaAdmin(): Promise<Array<{ id: string; nome: string; email: string; tipo: string; ehAdmin: boolean }>> {
  const resultado = await requisicaoAuthCentral<{ contas?: Array<{ id: string; nome: string; email: string; tipo: string; ehAdmin: boolean }>; mensagem?: string }>('users');
  if (!resultado.ok || !Array.isArray(resultado.dados?.contas)) {
    throw new Error(resultado.dados?.mensagem || 'Não foi possível carregar as contas do servidor.');
  }
  return resultado.dados.contas;
}

export async function alterarSenhaDireta(email: string, _novaSenha: string): Promise<{
  sucesso: boolean; mensagem: string; senhaTemporaria?: string;
}> {
  const resultado = await requisicaoAuthCentral<{ sucesso?: boolean; mensagem?: string; senhaTemporaria?: string }>('users/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  if (!resultado.ok || !resultado.dados?.sucesso) {
    return { sucesso: false, mensagem: resultado.dados?.mensagem || 'Não foi possível redefinir a senha no servidor.' };
  }
  return {
    sucesso: true,
    mensagem: resultado.dados.mensagem || 'Senha temporária criada.',
    senhaTemporaria: resultado.dados.senhaTemporaria,
  };
}

export async function recuperarSenha(email: string): Promise<{ sucesso: boolean; mensagem: string; linkSimulado?: string }> {
  void email;
  return {
    sucesso: false,
    mensagem: 'A recuperação automática de senha ainda não está configurada. Peça ao administrador para redefinir seu acesso pelo painel seguro.'
  };
}

export async function redefinirSenha(token: string, novaSenha: string): Promise<{ sucesso: boolean; mensagem: string }> {
  void token;
  void novaSenha;
  return {
    sucesso: false,
    mensagem: 'Este link não redefine a senha da conta do servidor. Peça ao administrador para redefinir seu acesso pelo painel seguro.'
  };
}

export async function atualizarPerfilUsuario(usuarioAtualizado: UsuarioAuth): Promise<{ sucesso: boolean; mensagem: string; usuario?: UsuarioAuth }> {
  const resultado = await requisicaoAuthCentral<{ sucesso?: boolean; mensagem?: string; usuario?: UsuarioAuth }>('profile', {
    method: 'PATCH',
    body: JSON.stringify({
      nome: usuarioAtualizado.nome,
      telefone: usuarioAtualizado.telefone || '',
      cpfCnpj: usuarioAtualizado.cpfCnpj || '',
      crc: usuarioAtualizado.crc || '',
    }),
  });
  if (!resultado.ok || !resultado.dados?.sucesso || !resultado.dados.usuario) {
    return { sucesso: false, mensagem: resultado.dados?.mensagem || 'Não foi possível salvar o perfil no servidor.' };
  }
  return { sucesso: true, mensagem: 'Perfil salvo no servidor.', usuario: resultado.dados.usuario };
}
