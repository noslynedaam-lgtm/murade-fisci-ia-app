import { EmpresaDados } from '../../types';

const STORAGE_KEY = 'fiscoia_empresas_list';

export function obterEmpresas(): EmpresaDados[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.error('Erro ao ler empresas do localStorage:', err);
    return [];
  }
}

export function salvarEmpresa(empresa: Partial<EmpresaDados>): EmpresaDados {
  const lista = obterEmpresas();
  const id = empresa.id || `emp-${Date.now()}`;
  
  const novaEmpresa: EmpresaDados = {
    id,
    cnpj: empresa.cnpj || '',
    razaoSocial: empresa.razaoSocial || '',
    nomeFantasia: empresa.nomeFantasia || '',
    regimeTributario: (empresa.regimeTributario as any) || 'SIMPLES',
    inscricaoEstadual: empresa.inscricaoEstadual || '',
    inscricaoMunicipal: empresa.inscricaoMunicipal || '',
    cnaePrincipal: empresa.cnaePrincipal || '',
    telefone: empresa.telefone || '',
    email: empresa.email || '',
    endereco: empresa.endereco || empresa.logradouro || '',
    logradouro: empresa.logradouro || empresa.endereco || '',
    numero: empresa.numero || '',
    bairro: empresa.bairro || '',
    cidade: empresa.cidade || '',
    uf: (empresa.uf || '').toUpperCase(),
    cep: empresa.cep || '',
    responsavelLegal: empresa.responsavelLegal || '',
    cpfResponsavel: empresa.cpfResponsavel || '',
    nomeContador: empresa.nomeContador || '',
    crcContador: empresa.crcContador || '',
    cpfContador: empresa.cpfContador || '',
    telefoneContador: empresa.telefoneContador || '',
    emailContador: empresa.emailContador || '',
    statusCND: empresa.statusCND || 'REGULAR',
    envioDadosMes: empresa.envioDadosMes,
    dataEnvioDados: empresa.dataEnvioDados,
    envioDCTFWeb: empresa.envioDCTFWeb,
    dataEnvioDCTFWeb: empresa.dataEnvioDCTFWeb,
    reciboDCTFWeb: empresa.reciboDCTFWeb,
    motivoPendenciaCND: empresa.motivoPendenciaCND,
    procuracaoAtiva: empresa.procuracaoAtiva ?? true,
    certificado: empresa.certificado
  };

  const index = lista.findIndex(e => e.id === id);
  if (index >= 0) {
    lista[index] = novaEmpresa;
  } else {
    lista.unshift(novaEmpresa);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fiscoia_empresa_atualizada', { detail: novaEmpresa }));
  }
  return novaEmpresa;
}

export function removerEmpresa(id: string): void {
  const lista = obterEmpresas();
  const novaLista = lista.filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(novaLista));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fiscoia_empresa_atualizada'));
  }
}

export function limparTodasEmpresas(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  localStorage.removeItem('fiscoia_empresa_ativa_id');
  localStorage.removeItem('fiscoia_certificado');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fiscoia_empresa_atualizada'));
  }
}


