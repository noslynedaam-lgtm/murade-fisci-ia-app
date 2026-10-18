import { EmpresaDados } from '../../types';

export interface EscritorioCentral {
  id: string;
  nome: string;
  papel: 'OWNER' | 'ADMIN' | 'CONTADOR' | 'OPERADOR' | 'LEITURA';
}

const ESCRITORIO_ATIVO_KEY = 'fiscoia_escritorio_ativo_sessao';

async function requisicao<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor de empresas. Confira a conexão e tente novamente.');
  }
  const data = await response.json().catch(() => null) as ({ mensagem?: string } & T) | null;
  if (!response.ok) {
    throw new Error(data?.mensagem || `O servidor recusou a operação (HTTP ${response.status}).`);
  }
  if (!data) throw new Error('O servidor retornou uma resposta inválida.');
  return data;
}

export async function listarEscritoriosCentrais(): Promise<EscritorioCentral[]> {
  const result = await requisicao<{ tenants?: EscritorioCentral[] }>('/api/tenants');
  if (!Array.isArray(result.tenants)) throw new Error('A resposta do servidor não trouxe os escritórios da conta.');
  return result.tenants;
}

export async function criarEscritorioCentral(nome: string): Promise<EscritorioCentral> {
  const result = await requisicao<{ tenant?: EscritorioCentral }>('/api/tenants', {
    method: 'POST',
    body: JSON.stringify({ nome }),
  });
  if (!result.tenant?.id || !result.tenant.nome) throw new Error('O servidor não confirmou a criação do escritório.');
  return result.tenant;
}

export interface EmpresaCentralRegistro {
  id: string;
  cnpj: string;
  legal_name: string;
  state?: string | null;
  municipality?: string | null;
  tax_regime?: string | null;
  metadata?: Record<string, string> | null;
}

export async function listarEmpresasCentrais(tenantId: string): Promise<EmpresaCentralRegistro[]> {
  const result = await requisicao<{ empresas?: EmpresaCentralRegistro[] }>(
    `/api/companies?tenantId=${encodeURIComponent(tenantId)}`,
  );
  if (!Array.isArray(result.empresas)) throw new Error('A resposta do servidor não trouxe as empresas do escritório.');
  return result.empresas;
}

export function lerEscritorioAtivo(): string {
  try { return sessionStorage.getItem(ESCRITORIO_ATIVO_KEY) || ''; }
  catch { return ''; }
}

export function salvarEscritorioAtivo(tenantId: string): void {
  try {
    sessionStorage.setItem(ESCRITORIO_ATIVO_KEY, tenantId);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fiscoia_escritorio_atualizado'));
  }
  catch { throw new Error('Não foi possível manter o escritório selecionado nesta sessão do navegador.'); }
}

export async function salvarEmpresaCentral(
  empresa: Partial<EmpresaDados>,
  tenantId: string,
  serverCompanyId?: string,
): Promise<{ id: string; cnpj: string }> {
  if (!tenantId) throw new Error('Selecione o escritório antes de salvar a empresa.');
  const body = {
    tenantId,
    cnpj: empresa.cnpj || '',
    razaoSocial: empresa.razaoSocial || '',
    estado: empresa.uf || '',
    municipio: empresa.cidade || '',
    regimeTributario: empresa.regimeTributario || '',
    nomeFantasia: empresa.nomeFantasia || '',
    inscricaoEstadual: empresa.inscricaoEstadual || '',
    inscricaoMunicipal: empresa.inscricaoMunicipal || '',
    cnaePrincipal: empresa.cnaePrincipal || '',
    telefone: empresa.telefone || '',
    email: empresa.email || '',
    endereco: empresa.endereco || empresa.logradouro || '',
    logradouro: empresa.logradouro || empresa.endereco || '',
    numero: empresa.numero || '',
    bairro: empresa.bairro || '',
    cep: empresa.cep || '',
    responsavelLegal: empresa.responsavelLegal || '',
    cpfResponsavel: empresa.cpfResponsavel || '',
    nomeContador: empresa.nomeContador || '',
    crcContador: empresa.crcContador || '',
    cpfContador: empresa.cpfContador || '',
    telefoneContador: empresa.telefoneContador || '',
    emailContador: empresa.emailContador || '',
  };
  const result = serverCompanyId
    ? await requisicao<{ empresa?: { id: string; cnpj: string } }>(`/api/companies/${encodeURIComponent(serverCompanyId)}`, {
      method: 'PUT', body: JSON.stringify(body),
    })
    : await requisicao<{ empresa?: { id: string; cnpj: string } }>('/api/companies', {
      method: 'POST', body: JSON.stringify(body),
    });
  if (!result.empresa?.id || !result.empresa.cnpj) throw new Error('O servidor não confirmou o cadastro da empresa.');
  return result.empresa;
}

export async function arquivarEmpresaCentral(companyId: string, tenantId: string): Promise<void> {
  if (!companyId || !tenantId) throw new Error('Escritório e empresa são necessários para arquivar o cadastro central.');
  const result = await requisicao<{ empresa?: { id: string }; documentosPreservados?: boolean }>(
    `/api/companies/${encodeURIComponent(companyId)}`,
    { method: 'DELETE', body: JSON.stringify({ tenantId }) },
  );
  if (result.empresa?.id !== companyId || result.documentosPreservados !== true) {
    throw new Error('O servidor não confirmou o arquivamento com preservação dos documentos.');
  }
}
