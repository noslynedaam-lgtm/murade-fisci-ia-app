import { UsuarioAuth, DadosCadastroContador } from '../../types';
import { PLANOS } from '../../config/planos';
import { TIPOS_USUARIO, ehUsuarioAdmin } from '../../config/Permissoes';

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

const STORAGE_USERS_KEY = 'fiscoia_usuarios_db_v2';
const STORAGE_EMAILS_KEY = 'fiscoia_emails_enviados_db';
const STORAGE_RESET_TOKENS = 'fiscoia_reset_tokens_db';

// Usuários iniciais do sistema (Apenas contas oficiais e limpas)
const USUARIOS_INICIAIS: Array<UsuarioAuth & { senhaHash: string }> = [
  {
    id: 'user-murad-master',
    nome: 'Diretoria Murad',
    email: 'noslyneda.murad@gmail.com',
    telefone: '',
    cpfCnpj: '',
    crc: '',
    idPlano: 'empresarial',
    nomePlano: 'Plano Empresarial (Até 500 CNPJs)',
    dataVencimento: '31/12/2030',
    primeiroAcesso: false,
    ativo: true,
    ehAdmin: true,
    tipo: 'ADMIN',
    senhaHash: 'murade2026'
  },
  {
    id: 'user-contador',
    nome: 'Contador Responsável',
    email: 'contador@murade.com.br',
    telefone: '',
    cpfCnpj: '',
    crc: '',
    idPlano: 'empresarial',
    nomePlano: 'Plano Empresarial (Até 500 CNPJs)',
    dataVencimento: '31/12/2030',
    primeiroAcesso: false,
    ativo: true,
    ehAdmin: false,
    tipo: 'CONTADOR',
    senhaHash: '123456'
  }
];

function obterUsuarios(): Array<UsuarioAuth & { senhaHash: string }> {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    let lista = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(lista) || lista.length === 0) {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(USUARIOS_INICIAIS));
      return USUARIOS_INICIAIS;
    }
    // Remove qualquer conta mock ou de teste anterior
    const filtrados = lista.filter((u: any) => {
      const n = ((u.nome || '') + ' ' + (u.email || '')).toUpperCase();
      return (
        !n.includes('CAMILA') &&
        !n.includes('NOGUEIRA') &&
        !n.includes('NORUEG') &&
        !n.includes('ROBERTO SILVEIRA') &&
        !n.includes('ALPHA') &&
        !n.includes('BETA')
      );
    });

    // Sanitiza qualquer resquício de CNPJ de exemplo ou Morad Contabilidade
    filtrados.forEach((u: any) => {
      if (u.cpfCnpj === '00.111.222/0001-33') u.cpfCnpj = '';
      if ((u.nome || '').includes('Morad Contabilidade')) u.nome = 'Diretoria Murad';
      if ((u.email || '').includes('moradcontabilidade.com.br')) u.email = 'noslyneda.murad@gmail.com';
    });

    if (filtrados.length === 0) {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(USUARIOS_INICIAIS));
      return USUARIOS_INICIAIS;
    }
    if (filtrados.length !== lista.length) {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(filtrados));
    }
    return filtrados;
  } catch {
    return USUARIOS_INICIAIS;
  }
}

function salvarUsuarios(usuarios: Array<UsuarioAuth & { senhaHash: string }>) {
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));
}

export function obterEmailsEnviados(): EmailEnviadoLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_EMAILS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function registrarEmail(log: EmailEnviadoLog) {
  const lista = obterEmailsEnviados();
  lista.unshift(log);
  localStorage.setItem(STORAGE_EMAILS_KEY, JSON.stringify(lista));
}

// 🛠️ GERA SENHA PROVISÓRIA AUTOMÁTICA
export function gerarSenhaProvisoria(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let senha = '';
  for (let i = 0; i < 8; i++) {
    senha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return senha;
}

// 🔐 CADASTRO DO CONTADOR — FEITO POR VOCÊ (MURADE)
export async function cadastrarContador(dados: DadosCadastroContador): Promise<{
  sucesso: boolean;
  mensagem: string;
  senhaProvisoria?: string;
  usuario?: UsuarioAuth;
}> {
  const usuarios = obterUsuarios();
  
  const existe = usuarios.find(u => u.email.toLowerCase() === dados.email.toLowerCase().trim());
  if (existe) {
    return { sucesso: false, mensagem: 'Este e-mail já está cadastrado no sistema!' };
  }

  const senhaProvisoria = gerarSenhaProvisoria();
  const infoPlano = PLANOS[dados.idPlano.toUpperCase()] || PLANOS.EMPRESARIAL;

  const novoUsuario: UsuarioAuth & { senhaHash: string } = {
    id: `user-${Date.now()}`,
    nome: dados.nome.trim(),
    email: dados.email.toLowerCase().trim(),
    telefone: dados.telefone,
    cpfCnpj: dados.cpfCnpj,
    crc: dados.crc,
    idPlano: dados.idPlano,
    nomePlano: infoPlano.nome,
    dataVencimento: dados.dataVencimento || '09/10/2026',
    primeiroAcesso: true, // ✅ Marca que precisa trocar senha
    ativo: true,
    ehAdmin: false,
    tipo: 'CONTADOR',
    senhaHash: senhaProvisoria
  };

  usuarios.push(novoUsuario);
  salvarUsuarios(usuarios);

  // 📧 Envia e-mail automático com os dados de acesso
  const corpoEmail = `
Olá ${dados.nome}!

Seu acesso ao sistema FISCOIA foi criado com sucesso pela equipe MURADE.

🔐 SEUS DADOS DE ACESSO:
Login (E-mail): ${dados.email}
Senha temporária: ${senhaProvisoria}

⚠️ IMPORTANTE:
Ao entrar pela PRIMEIRA VEZ, você SERÁ OBRIGADO a trocar sua senha por uma sua, exclusiva e definitiva!

📋 Plano Contratado: ${infoPlano.nome} (Até ${infoPlano.maxCnpjs} CNPJs)
💳 Data de Vencimento: ${dados.dataVencimento || '09/10/2026'}

Acesse agora: https://app.fiscoia.com.br/login

Atenciosamente,
Equipe MURADE
  `;

  registrarEmail({
    id: `email-${Date.now()}`,
    para: dados.email,
    assunto: '🎉 Seu acesso ao FISCOIA foi criado!',
    corpo: corpoEmail,
    dataEnvio: new Date().toLocaleString('pt-BR'),
    tipo: 'ACESSO_INICIAL',
    senhaProvisoria
  });

  return {
    sucesso: true,
    mensagem: 'Contador cadastrado e e-mail de acesso enviado com sucesso!',
    senhaProvisoria,
    usuario: novoUsuario
  };
}

// 🔑 LOGIN — EMAIL + SENHA
export async function login(email: string, senha: string): Promise<{
  sucesso: boolean;
  mensagem?: string;
  token?: string;
  precisaTrocarSenha?: boolean;
  usuario?: UsuarioAuth;
}> {
  const usuarios = obterUsuarios();
  const u = usuarios.find(item => item.email.toLowerCase() === email.toLowerCase().trim());

  if (!u) {
    return { sucesso: false, mensagem: 'E-mail ou senha incorretos' };
  }

  if (!u.ativo) {
    return { sucesso: false, mensagem: 'Acesso bloqueado por inadimplência ou suspensão. Entre em contato com MURADE.' };
  }

  if (u.senhaHash !== senha) {
    return { sucesso: false, mensagem: 'E-mail ou senha incorretos' };
  }

  const tipoCalc = (u.tipo || (ehUsuarioAdmin({ email: u.email, ehAdmin: u.ehAdmin }) ? TIPOS_USUARIO.ADMIN : TIPOS_USUARIO.CONTADOR)) as 'ADMIN' | 'CONTADOR';

  // ⚠️ SE FOR PRIMEIRO ACESSO → PEDE TROCA DE SENHA
  if (u.primeiroAcesso) {
    return {
      sucesso: true,
      precisaTrocarSenha: true,
      usuario: {
        id: u.id,
        nome: u.nome,
        email: u.email,
        telefone: u.telefone,
        cpfCnpj: u.cpfCnpj,
        crc: u.crc,
        idPlano: u.idPlano,
        nomePlano: u.nomePlano,
        dataVencimento: u.dataVencimento,
        primeiroAcesso: true,
        ativo: u.ativo,
        ehAdmin: tipoCalc === 'ADMIN',
        tipo: tipoCalc
      }
    };
  }

  const token = `jwt_fake_${u.id}_${Date.now()}`;
  localStorage.setItem('fiscoia_token', token);
  localStorage.setItem('fiscoia_user_session', JSON.stringify({ ...u, tipo: tipoCalc, ehAdmin: tipoCalc === 'ADMIN' }));

  return {
    sucesso: true,
    token,
    usuario: {
      id: u.id,
      nome: u.nome,
      email: u.email,
      telefone: u.telefone,
      cpfCnpj: u.cpfCnpj,
      crc: u.crc,
      idPlano: u.idPlano,
      nomePlano: u.nomePlano,
      dataVencimento: u.dataVencimento,
      primeiroAcesso: false,
      ativo: u.ativo,
      ehAdmin: tipoCalc === 'ADMIN',
      tipo: tipoCalc
    }
  };
}

// 🔐 TROCA DE SENHA — OBRIGATÓRIA NO PRIMEIRO ACESSO
export async function trocarSenhaPrimeiroAcesso(
  email: string,
  senhaTemporaria: string,
  novaSenha: string
): Promise<{ sucesso: boolean; mensagem: string; usuario?: UsuarioAuth }> {
  const usuarios = obterUsuarios();
  const idx = usuarios.findIndex(u => u.email.toLowerCase() === email.toLowerCase().trim());

  if (idx === -1) {
    return { sucesso: false, mensagem: 'Usuário não encontrado' };
  }

  if (usuarios[idx].senhaHash !== senhaTemporaria) {
    return { sucesso: false, mensagem: 'Senha temporária incorreta! Verifique o e-mail recebido.' };
  }

  if (novaSenha.length < 6) {
    return { sucesso: false, mensagem: 'A nova senha deve possuir no mínimo 6 caracteres!' };
  }

  usuarios[idx].senhaHash = novaSenha;
  usuarios[idx].primeiroAcesso = false;
  salvarUsuarios(usuarios);

  const token = `jwt_fake_${usuarios[idx].id}_${Date.now()}`;
  localStorage.setItem('fiscoia_token', token);
  localStorage.setItem('fiscoia_user_session', JSON.stringify(usuarios[idx]));

  return {
    sucesso: true,
    mensagem: 'Senha alterada com sucesso! Bem-vindo ao FISCOIA.',
    usuario: usuarios[idx]
  };
}

// 🔐 ALTERAÇÃO DIRETA DE SENHA PELO ADMINISTRADOR (Painel Master)
export function alterarSenhaDireta(
  email: string,
  novaSenha: string
): { sucesso: boolean; mensagem: string } {
  const usuarios = obterUsuarios();
  const idx = usuarios.findIndex(u => u.email.toLowerCase() === email.toLowerCase().trim());

  if (idx === -1) {
    return { sucesso: false, mensagem: `Usuário "${email}" não foi encontrado no sistema.` };
  }

  if (!novaSenha || novaSenha.length < 6) {
    return { sucesso: false, mensagem: 'A nova senha deve possuir no mínimo 6 caracteres!' };
  }

  usuarios[idx].senhaHash = novaSenha;
  salvarUsuarios(usuarios);

  // Se for o usuário da sessão ativa, atualiza também a sessão salva
  try {
    const rawSessao = localStorage.getItem('fiscoia_user_session');
    if (rawSessao) {
      const sessaoAtual = JSON.parse(rawSessao);
      if (sessaoAtual.email?.toLowerCase() === email.toLowerCase().trim()) {
        localStorage.setItem('fiscoia_user_session', JSON.stringify({
          ...sessaoAtual,
          senhaHash: novaSenha
        }));
      }
    }
  } catch (e) {
    console.error('Erro ao atualizar sessão:', e);
  }

  return {
    sucesso: true,
    mensagem: `Senha de acesso para o usuário "${email}" atualizada com sucesso!`
  };
}

export function listarContasParaAdmin(): Array<{ id: string; nome: string; email: string; tipo: string; ehAdmin: boolean }> {
  const usuarios = obterUsuarios();
  return usuarios.map(u => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    tipo: u.tipo,
    ehAdmin: !!u.ehAdmin
  }));
}

// 🔑 ESQUECEU A SENHA — ELE MESMO PEDE NOVA
export async function recuperarSenha(email: string): Promise<{ sucesso: boolean; mensagem: string; linkSimulado?: string }> {
  const usuarios = obterUsuarios();
  const u = usuarios.find(item => item.email.toLowerCase() === email.toLowerCase().trim());

  if (!u) {
    return { sucesso: false, mensagem: 'E-mail não encontrado no sistema' };
  }

  const token = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const link = `https://app.fiscoia.com.br/redefinir-senha?token=${token}`;

  // Salva token
  let tokens: Record<string, { email: string; expiraEm: number }> = {};
  try {
    const raw = localStorage.getItem(STORAGE_RESET_TOKENS);
    if (raw) tokens = JSON.parse(raw);
  } catch {}
  tokens[token] = { email: u.email, expiraEm: Date.now() + 60 * 60 * 1000 };
  localStorage.setItem(STORAGE_RESET_TOKENS, JSON.stringify(tokens));

  // Envia e-mail
  registrarEmail({
    id: `email-${Date.now()}`,
    para: u.email,
    assunto: '🔑 Redefinição de Senha — FISCOIA',
    corpo: `
Olá ${u.nome},

Recebemos uma solicitação para redefinir sua senha de acesso ao FISCOIA.

Clique no link abaixo para criar uma nova senha:
${link}

⚠️ Este link expira em 1 hora.
    `,
    dataEnvio: new Date().toLocaleString('pt-BR'),
    tipo: 'RECUPERACAO_SENHA',
    link
  });

  return {
    sucesso: true,
    mensagem: 'Link de redefinição gerado e enviado para seu e-mail!',
    linkSimulado: link
  };
}

// 🔑 REDEFINIR SENHA — PELO LINK DO E-MAIL
export async function redefinirSenha(token: string, novaSenha: string): Promise<{ sucesso: boolean; mensagem: string }> {
  let tokens: Record<string, { email: string; expiraEm: number }> = {};
  try {
    const raw = localStorage.getItem(STORAGE_RESET_TOKENS);
    if (raw) tokens = JSON.parse(raw);
  } catch {}

  const item = tokens[token];
  if (!item || item.expiraEm < Date.now()) {
    return { sucesso: false, mensagem: 'Link de recuperação inválido ou expirado! Solicite um novo.' };
  }

  const usuarios = obterUsuarios();
  const idx = usuarios.findIndex(u => u.email.toLowerCase() === item.email.toLowerCase());
  if (idx === -1) {
    return { sucesso: false, mensagem: 'Usuário não encontrado' };
  }

  usuarios[idx].senhaHash = novaSenha;
  usuarios[idx].primeiroAcesso = false;
  salvarUsuarios(usuarios);

  delete tokens[token];
  localStorage.setItem(STORAGE_RESET_TOKENS, JSON.stringify(tokens));

  return { sucesso: true, mensagem: 'Senha redefinida com sucesso! Você já pode fazer login.' };
}

// 🚪 LOGOUT
export function logout(): { sucesso: boolean } {
  localStorage.removeItem('fiscoia_token');
  localStorage.removeItem('fiscoia_user_session');
  return { sucesso: true };
}

// Obter usuário logado atual na sessão
export function obterSessaoAtual(): UsuarioAuth | null {
  try {
    const raw = localStorage.getItem('fiscoia_user_session');
    if (!raw) return null;
    const session: UsuarioAuth = JSON.parse(raw);
    const n = ((session.nome || '') + ' ' + (session.email || '')).toUpperCase();
    if (
      n.includes('CAMILA') ||
      n.includes('NOGUEIRA') ||
      n.includes('NORUEG') ||
      n.includes('ROBERTO SILVEIRA') ||
      n.includes('ALPHA') ||
      n.includes('BETA')
    ) {
      // Limpa dados de simulação antigos e redefine para Murad Master limpo
      const limpa = USUARIOS_INICIAIS[0];
      localStorage.setItem('fiscoia_user_session', JSON.stringify(limpa));
      return limpa;
    }

    let alterado = false;
    if (session.cpfCnpj === '00.111.222/0001-33') {
      session.cpfCnpj = '';
      alterado = true;
    }
    if ((session.nome || '').includes('Morad Contabilidade')) {
      session.nome = 'Diretoria Murad';
      alterado = true;
    }
    if ((session.email || '').includes('moradcontabilidade.com.br')) {
      session.email = 'noslyneda.murad@gmail.com';
      alterado = true;
    }
    if (alterado) {
      localStorage.setItem('fiscoia_user_session', JSON.stringify(session));
    }

    return session;
  } catch {
    return null;
  }
}

// 💾 Atualizar Perfil do Usuário / Contadora Ativa
export function atualizarPerfilUsuario(usuarioAtualizado: UsuarioAuth): void {
  try {
    localStorage.setItem('fiscoia_user_session', JSON.stringify(usuarioAtualizado));
    const usuarios = obterUsuarios();
    const index = usuarios.findIndex(
      u => u.id === usuarioAtualizado.id || u.email.toLowerCase() === usuarioAtualizado.email.toLowerCase()
    );
    if (index >= 0) {
      usuarios[index] = {
        ...usuarios[index],
        nome: usuarioAtualizado.nome,
        email: usuarioAtualizado.email,
        telefone: usuarioAtualizado.telefone,
        cpfCnpj: usuarioAtualizado.cpfCnpj,
        crc: usuarioAtualizado.crc
      };
      salvarUsuarios(usuarios);
    }
  } catch (e) {
    console.error('Erro ao atualizar perfil do usuário:', e);
  }
}

// 🧹 Limpar Todos os Cadastros de Usuários Antigos
export function limparTodosOsCadastros(): void {
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(USUARIOS_INICIAIS));
  localStorage.setItem('fiscoia_user_session', JSON.stringify(USUARIOS_INICIAIS[0]));
}

export function registrarDisparoEmailGenerico(log: {
  para: string;
  assunto: string;
  corpo: string;
  tipo?: any;
}) {
  const lista = obterEmailsEnviados();
  lista.unshift({
    id: `email-${Date.now()}`,
    para: log.para,
    assunto: log.assunto,
    corpo: log.corpo,
    dataEnvio: new Date().toLocaleString('pt-BR'),
    tipo: log.tipo || 'ACESSO_INICIAL'
  });
  localStorage.setItem(STORAGE_EMAILS_KEY, JSON.stringify(lista));
}

