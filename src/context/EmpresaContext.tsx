import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { EmpresaDados } from '../types';
import { obterEmpresas, salvarEmpresa, removerEmpresa as removerEmpresaService } from '../services/empresas/empresas.service';

interface EmpresaContextType {
  empresas: EmpresaDados[];
  empresaAtiva: EmpresaDados | null;
  selecionarEmpresa: (empresaOuId: EmpresaDados | string | null) => void;
  salvarNovaEmpresa: (empresa: Partial<EmpresaDados>) => EmpresaDados;
  removerEmpresa: (id: string) => boolean;
  recarregarEmpresas: () => void;
  limparTodasEmpresas: () => void;
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

const STORAGE_ACTIVE_KEY = 'fiscoia_empresa_ativa_id';

// Limpeza imediata solicitada pelo usuário para deixar o sistema 100% zerado e pronto para novas empresas
const CHAVE_ZERAR = 'fiscoia_empresas_limpas_totalmente_v5';
if (typeof window !== 'undefined' && !localStorage.getItem(CHAVE_ZERAR)) {
  localStorage.setItem('fiscoia_empresas_list', JSON.stringify([]));
  localStorage.removeItem(STORAGE_ACTIVE_KEY);
  localStorage.removeItem('fiscoia_certificado');
  localStorage.removeItem('fiscoia_cnd');
  localStorage.removeItem('configIntegracaoMurade');
  
  // Sanitiza sessão e perfil para retirar qualquer dado antigo
  try {
    const rawSession = localStorage.getItem('fiscoia_user_session');
    if (rawSession) {
      const sess = JSON.parse(rawSession);
      if (sess.cpfCnpj === '00.111.222/0001-33') sess.cpfCnpj = '';
      if ((sess.nome || '').includes('Morad Contabilidade')) sess.nome = 'Diretoria Murad';
      localStorage.setItem('fiscoia_user_session', JSON.stringify(sess));
    }
    const rawContadora = localStorage.getItem('fiscoia_contadora_padrao');
    if (rawContadora) {
      const cont = JSON.parse(rawContadora);
      if (cont.cpfCnpj === '00.111.222/0001-33') cont.cpfCnpj = '';
      if ((cont.nome || '').includes('Morad Contabilidade')) cont.nome = '';
      localStorage.setItem('fiscoia_contadora_padrao', JSON.stringify(cont));
    }
  } catch {}

  localStorage.setItem(CHAVE_ZERAR, 'true');
}

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresas, setEmpresas] = useState<EmpresaDados[]>([]);
  const [empresaAtiva, setEmpresaAtiva] = useState<EmpresaDados | null>(null);

  const carregar = () => {
    const lista = obterEmpresas();
    setEmpresas(lista);

    const savedId = localStorage.getItem(STORAGE_ACTIVE_KEY);
    if (savedId) {
      const encontrada = lista.find(e => e.id === savedId);
      if (encontrada) {
        setEmpresaAtiva(encontrada);
        return;
      }
    }

    if (lista.length > 0) {
      setEmpresaAtiva(lista[0]);
      if (lista[0].id) {
        localStorage.setItem(STORAGE_ACTIVE_KEY, lista[0].id);
      }
    } else {
      setEmpresaAtiva(null);
      localStorage.removeItem(STORAGE_ACTIVE_KEY);
    }
  };

  useEffect(() => {
    carregar();

    const handleAtualizacao = () => {
      carregar();
    };

    window.addEventListener('fiscoia_empresa_atualizada', handleAtualizacao);
    window.addEventListener('storage', handleAtualizacao);

    return () => {
      window.removeEventListener('fiscoia_empresa_atualizada', handleAtualizacao);
      window.removeEventListener('storage', handleAtualizacao);
    };
  }, []);

  const selecionarEmpresa = (empresaOuId: EmpresaDados | string | null) => {
    if (!empresaOuId) {
      setEmpresaAtiva(null);
      localStorage.removeItem(STORAGE_ACTIVE_KEY);
      return;
    }

    if (typeof empresaOuId === 'string') {
      const encontrada = empresas.find(e => e.id === empresaOuId || e.cnpj === empresaOuId);
      if (encontrada) {
        setEmpresaAtiva(encontrada);
        if (encontrada.id) localStorage.setItem(STORAGE_ACTIVE_KEY, encontrada.id);
      }
    } else {
      setEmpresaAtiva(empresaOuId);
      if (empresaOuId.id) localStorage.setItem(STORAGE_ACTIVE_KEY, empresaOuId.id);
    }
  };

  const salvarNovaEmpresa = (empresa: Partial<EmpresaDados>): EmpresaDados => {
    const salva = salvarEmpresa(empresa);
    const atualizada = obterEmpresas();
    setEmpresas(atualizada);
    setEmpresaAtiva(salva);
    if (salva.id) {
      localStorage.setItem(STORAGE_ACTIVE_KEY, salva.id);
    }
    return salva;
  };

  const removerEmpresa = (id: string): boolean => {
    try {
      removerEmpresaService(id);
      const atualizada = obterEmpresas();
      setEmpresas(atualizada);

      if (empresaAtiva?.id === id) {
        const proxima = atualizada.length > 0 ? atualizada[0] : null;
        setEmpresaAtiva(proxima);
        if (proxima?.id) {
          localStorage.setItem(STORAGE_ACTIVE_KEY, proxima.id);
        } else {
          localStorage.removeItem(STORAGE_ACTIVE_KEY);
        }
      }
      return true;
    } catch (err) {
      console.error('Erro ao deletar empresa:', err);
      return false;
    }
  };

  const limparTodasEmpresas = () => {
    localStorage.setItem('fiscoia_empresas_list', JSON.stringify([]));
    localStorage.removeItem(STORAGE_ACTIVE_KEY);
    localStorage.removeItem('fiscoia_certificado');
    localStorage.removeItem('fiscoia_cnd');
    setEmpresas([]);
    setEmpresaAtiva(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fiscoia_empresa_atualizada'));
    }
  };

  return (
    <EmpresaContext.Provider
      value={{
        empresas,
        empresaAtiva,
        selecionarEmpresa,
        salvarNovaEmpresa,
        removerEmpresa,
        recarregarEmpresas: carregar,
        limparTodasEmpresas
      }}
    >
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa(): EmpresaContextType {
  const context = useContext(EmpresaContext);
  if (!context) {
    console.warn('useEmpresa acessado fora de um EmpresaProvider. Fornecendo estado seguro de fallback.');
    return {
      empresas: [],
      empresaAtiva: null,
      selecionarEmpresa: () => {},
      salvarNovaEmpresa: (dados) => ({
        id: `emp-${Date.now()}`,
        razaoSocial: dados.razaoSocial || '',
        cnpj: dados.cnpj || '',
        regimeTributario: dados.regimeTributario || 'SIMPLES',
        ...dados
      }),
      removerEmpresa: () => false,
      recarregarEmpresas: () => {},
      limparTodasEmpresas: () => {}
    };
  }
  return context;
}
