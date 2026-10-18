import { EmpresaDados } from '../../types';
import { normalizarCnpj } from '../cnpj/cnpjValidation';

const STORAGE_KEY = 'fiscoia_empresas_list';

export type ResultadoLeituraEmpresas =
  | { ok: true; empresas: EmpresaDados[] }
  | { ok: false; erro: string };

export function lerEmpresas(): ResultadoLeituraEmpresas {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ok: true, empresas: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return true;
      const empresa = item as Record<string, unknown>;
      const certificado = empresa.certificado;
      return typeof empresa.id !== 'string'
        || typeof empresa.cnpj !== 'string'
        || typeof empresa.razaoSocial !== 'string'
        || (certificado != null && (typeof certificado !== 'object' || Array.isArray(certificado)));
    })) {
      return { ok: false, erro: 'O cadastro local de empresas está em formato inválido. Nenhum registro foi substituído.' };
    }
    const empresasSeguras = (parsed as EmpresaDados[]).map(empresa => {
      if (!empresa.certificado) return empresa;
      const certificado = { ...empresa.certificado };
      if ('senha' in certificado || certificado.ativo || certificado.valido) {
        delete (certificado as typeof certificado & { senha?: string }).senha;
        certificado.ativo = false;
        certificado.valido = false;
      }
      return { ...empresa, certificado };
    });
    const rawSeguro = JSON.stringify(empresasSeguras);
    if (raw !== rawSeguro) {
      try {
        // Remove senhas/status legados persistidos, não apenas da cópia em memória.
        localStorage.setItem(STORAGE_KEY, rawSeguro);
      } catch {
        return { ok: false, erro: 'O cadastro contém dados legados de certificado que não puderam ser removidos do armazenamento local. Nenhum registro foi substituído.' };
      }
    }
    return { ok: true, empresas: empresasSeguras };
  } catch (err) {
    console.error('Erro ao ler empresas do localStorage:', err);
    return { ok: false, erro: 'Não foi possível ler o cadastro local de empresas. Os dados armazenados foram preservados.' };
  }
}

export function obterEmpresas(): EmpresaDados[] {
  const resultado = lerEmpresas();
  if ('erro' in resultado) throw new Error(resultado.erro);
  return resultado.empresas;
}

export function salvarEmpresa(empresa: Partial<EmpresaDados>): EmpresaDados {
  const lista = obterEmpresas();
  const id = empresa.id || `emp-${Date.now()}`;
  const index = lista.findIndex(e => e.id === id);
  const cnpjNormalizado = normalizarCnpj(empresa.cnpj || '');

  if (index >= 0) {
    const cnpjAnterior = normalizarCnpj(lista[index].cnpj || '');
    if (cnpjAnterior && cnpjNormalizado && cnpjAnterior !== cnpjNormalizado) {
      throw new Error('O CNPJ identifica a empresa e não pode ser trocado neste cadastro, pois notas, certificado e histórico local estão vinculados a ele. Cadastre a nova empresa separadamente para manter os dados isolados.');
    }
  }

  if (cnpjNormalizado && lista.some((item, itemIndex) => itemIndex !== index
    && normalizarCnpj(item.cnpj || '') === cnpjNormalizado)) {
    throw new Error('Este CNPJ já está cadastrado. Cada empresa precisa ter seu próprio cadastro para evitar misturar certificados e dados fiscais.');
  }
  
  const novaEmpresa: EmpresaDados = {
    id,
    idCentral: empresa.idCentral || (index >= 0 ? lista[index].idCentral : undefined),
    tenantIdCentral: empresa.tenantIdCentral || (index >= 0 ? lista[index].tenantIdCentral : undefined),
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
    statusCND: empresa.statusCND || 'NAO_CONSULTADA',
    envioDadosMes: empresa.envioDadosMes,
    dataEnvioDados: empresa.dataEnvioDados,
    envioDCTFWeb: empresa.envioDCTFWeb,
    dataEnvioDCTFWeb: empresa.dataEnvioDCTFWeb,
    reciboDCTFWeb: empresa.reciboDCTFWeb,
    motivoPendenciaCND: empresa.motivoPendenciaCND,
    procuracaoAtiva: empresa.procuracaoAtiva ?? false,
    certificado: empresa.certificado
  };

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


