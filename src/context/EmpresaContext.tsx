import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { EmpresaDados } from '../types';
import { lerEmpresas, salvarEmpresa, removerEmpresa as removerEmpresaService } from '../services/empresas/empresas.service';
import { apagarTodosXmlsFiscaisLocais, apagarXmlsFiscaisEmpresa } from '../services/fiscal/xmlFiscalStorage.service';
import { normalizarCnpj } from '../services/cnpj/cnpjValidation';
import { arquivarEmpresaCentral, listarEmpresasCentrais, listarEscritoriosCentrais, lerEscritorioAtivo, salvarEscritorioAtivo } from '../services/empresas/empresasCentral.service';

interface EmpresaContextType {
  empresas: EmpresaDados[];
  empresaAtiva: EmpresaDados | null;
  erroEmpresas: string | null;
  selecionarEmpresa: (empresaOuId: EmpresaDados | string | null) => void;
  salvarNovaEmpresa: (empresa: Partial<EmpresaDados>) => EmpresaDados | null;
  removerEmpresa: (id: string) => Promise<boolean>;
  recarregarEmpresas: () => void;
  limparTodasEmpresas: () => Promise<boolean>;
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

const STORAGE_ACTIVE_KEY = 'fiscoia_empresa_ativa_id';
const STORAGE_AGENDA_KEY = 'murade_agenda_lembretes_locais_v1';
const STORAGE_MONITOR_KEY = 'fiscoia_monitor_carteira_assinaturas_v1';
const STORAGE_MONITOR_DOCUMENTOS_KEY = 'fiscoia_monitor_carteira_documentos_v1';

function limparMetadadosFiscaisLocais(empresa: EmpresaDados, removerDadosPorCnpj: boolean) {
  const id = empresa.id;
  const cnpj = normalizarCnpj(empresa.cnpj || '');
  [
    `fiscoia_notas_fiscais_${id}`,
    `fiscoia_radar_xml_${id}`,
    `fiscoia_regime_fiscal_${id}`,
    `fiscoia_radar_notificado_${id}`,
    `fiscoia_livro_notificados_${id}`
  ].forEach(chave => localStorage.removeItem(chave));

  if (cnpj && removerDadosPorCnpj) {
    localStorage.removeItem(`fiscoia_certificado_cliente_${cnpj}`);
    localStorage.removeItem(`fiscoia_guias_receita_${cnpj}`);
  }

  const prefixoNotificacao = `murade_agenda_notificado_${id}_`;
  const chavesNotificacao = Array.from({ length: localStorage.length }, (_, indice) => localStorage.key(indice))
    .filter((chave): chave is string => Boolean(chave?.startsWith(prefixoNotificacao)));
  chavesNotificacao.forEach(chave => localStorage.removeItem(chave));

  const agendaRaw = localStorage.getItem(STORAGE_AGENDA_KEY);
  if (agendaRaw) {
    const agenda: unknown = JSON.parse(agendaRaw);
    if (Array.isArray(agenda)) {
      localStorage.setItem(STORAGE_AGENDA_KEY, JSON.stringify(agenda.filter(item => item?.empresaId !== id)));
    }
  }

  const monitorRaw = localStorage.getItem(STORAGE_MONITOR_KEY);
  if (monitorRaw) {
    const assinaturas: unknown = JSON.parse(monitorRaw);
    if (Array.isArray(assinaturas)) {
      localStorage.setItem(STORAGE_MONITOR_KEY, JSON.stringify(assinaturas.filter(item => typeof item !== 'string' || !item.startsWith(`${id}:`))));
    }
  }

  const documentosRaw = localStorage.getItem(STORAGE_MONITOR_DOCUMENTOS_KEY);
  if (documentosRaw) {
    const documentos: unknown = JSON.parse(documentosRaw);
    if (Array.isArray(documentos)) {
      localStorage.setItem(STORAGE_MONITOR_DOCUMENTOS_KEY, JSON.stringify(documentos.filter(item => typeof item !== 'string' || !item.startsWith(`${id}:`))));
    }
  }
}

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresas, setEmpresas] = useState<EmpresaDados[]>([]);
  const [empresaAtiva, setEmpresaAtiva] = useState<EmpresaDados | null>(null);
  const [erroEmpresas, setErroEmpresas] = useState<string | null>(null);

  const carregar = async () => {
    try {
      const escritorios = await listarEscritoriosCentrais();
      if (!escritorios.length) throw new Error('Sua sessão ainda não está vinculada a um escritório no banco central.');
      let tenantId = lerEscritorioAtivo();
      if (!escritorios.some(item => item.id === tenantId)) {
        if (escritorios.length !== 1) {
          setEmpresas([]);
          setEmpresaAtiva(null);
          setErroEmpresas('Selecione o escritório no formulário de empresa para carregar a carteira correta.');
          return;
        }
        tenantId = escritorios[0].id;
        salvarEscritorioAtivo(tenantId);
      }

      const [registrosCentrais, resultadoLocal] = await Promise.all([
        listarEmpresasCentrais(tenantId),
        Promise.resolve(lerEmpresas()),
      ]);
      const locaisVinculados = 'erro' in resultadoLocal ? [] : resultadoLocal.empresas.filter(
        item => item.idCentral && item.tenantIdCentral === tenantId,
      );
      const lista: EmpresaDados[] = registrosCentrais.map((central) => {
        const local = locaisVinculados.find(item => item.idCentral === central.id);
        const metadata = central.metadata || {};
        return {
          ...local,
          id: local?.id || central.id,
          idCentral: central.id,
          tenantIdCentral: tenantId,
          cnpj: central.cnpj,
          razaoSocial: central.legal_name,
          nomeFantasia: metadata.nomeFantasia || local?.nomeFantasia,
          uf: central.state || '',
          cidade: central.municipality || '',
          regimeTributario: (central.tax_regime || 'SIMPLES') as EmpresaDados['regimeTributario'],
          inscricaoEstadual: metadata.inscricaoEstadual || '',
          inscricaoMunicipal: metadata.inscricaoMunicipal || '',
          cnaePrincipal: metadata.cnaePrincipal || '',
          telefone: metadata.telefone || '',
          email: metadata.email || '',
          endereco: metadata.endereco || metadata.logradouro || '',
          logradouro: metadata.logradouro || metadata.endereco || '',
          numero: metadata.numero || '',
          bairro: metadata.bairro || '',
          cep: metadata.cep || '',
          responsavelLegal: metadata.responsavelLegal || '',
          cpfResponsavel: metadata.cpfResponsavel || '',
          nomeContador: metadata.nomeContador || '',
          crcContador: metadata.crcContador || '',
          cpfContador: metadata.cpfContador || '',
          telefoneContador: metadata.telefoneContador || '',
          emailContador: metadata.emailContador || '',
        };
      });
      setEmpresas(lista);
      setErroEmpresas(null);
      const savedId = localStorage.getItem(STORAGE_ACTIVE_KEY);
      const encontrada = lista.find(item => item.id === savedId || item.idCentral === savedId);
      const proxima = encontrada || lista[0] || null;
      setEmpresaAtiva(proxima);
      if (proxima?.id) localStorage.setItem(STORAGE_ACTIVE_KEY, proxima.id);
      else localStorage.removeItem(STORAGE_ACTIVE_KEY);
    } catch (error) {
      // A carteira central é a fonte de verdade. Não exibe dados locais sem tenant
      // confirmado, evitando misturar empresas entre contas no mesmo navegador.
      setEmpresas([]);
      setEmpresaAtiva(null);
      setErroEmpresas(error instanceof Error ? error.message : 'Não foi possível carregar a carteira central de empresas.');
    }
  };

  useEffect(() => {
    void carregar();

    const handleAtualizacao = () => {
      void carregar();
    };

    window.addEventListener('fiscoia_empresa_atualizada', handleAtualizacao);
    window.addEventListener('fiscoia_auth_session_updated', handleAtualizacao);
    window.addEventListener('fiscoia_escritorio_atualizado', handleAtualizacao);
    window.addEventListener('storage', handleAtualizacao);

    return () => {
      window.removeEventListener('fiscoia_empresa_atualizada', handleAtualizacao);
      window.removeEventListener('fiscoia_auth_session_updated', handleAtualizacao);
      window.removeEventListener('fiscoia_escritorio_atualizado', handleAtualizacao);
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

  const salvarNovaEmpresa = (empresa: Partial<EmpresaDados>): EmpresaDados | null => {
    try {
      const salva = salvarEmpresa(empresa);
      const resultado = lerEmpresas();
      if ('erro' in resultado) throw new Error(resultado.erro);
      const salvaAtualizada = resultado.empresas.find(item => item.id === salva.id) || salva;
      if (salvaAtualizada.idCentral) {
        setErroEmpresas(null);
        if (salvaAtualizada.id) localStorage.setItem(STORAGE_ACTIVE_KEY, salvaAtualizada.id);
        void carregar();
      } else {
        // Cadastros locais legados ficam preservados no storage, mas não entram
        // na carteira autenticada sem vínculo central e tenant confirmado.
        setErroEmpresas('Este cadastro existe apenas neste navegador e não aparece na carteira permanente até ser sincronizado com o escritório.');
      }
      return salvaAtualizada;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Não foi possível salvar o cadastro da empresa.';
      setErroEmpresas(mensagem);
      console.error('Erro ao salvar empresa:', err);
      return null;
    }
  };

  const removerEmpresa = async (id: string): Promise<boolean> => {
    try {
      if (erroEmpresas) throw new Error(erroEmpresas);
      const leituraAtual = lerEmpresas();
      if ('erro' in leituraAtual) throw new Error(leituraAtual.erro);
      const listaAtual = leituraAtual.empresas;
      const empresa = listaAtual.find(item => item.id === id);
      if (!empresa) return false;
      if (empresa.idCentral) {
        if (!empresa.tenantIdCentral) throw new Error('O escritório central desta empresa não foi identificado; nenhum dado foi alterado.');
        await arquivarEmpresaCentral(empresa.idCentral, empresa.tenantIdCentral);
        // Retira apenas a referência local do cadastro arquivado. XMLs locais e
        // documentos permanentes ficam preservados; nenhum arquivo é apagado.
        removerEmpresaService(id);
        setErroEmpresas(null);
        if (empresaAtiva?.id === id) {
          localStorage.removeItem(STORAGE_ACTIVE_KEY);
          setEmpresaAtiva(null);
        }
        await carregar();
        return true;
      }
      const mesmoCnpjMantido = listaAtual.some(item => item.id !== id && normalizarCnpj(item.cnpj || '') === normalizarCnpj(empresa.cnpj || ''));
      await apagarXmlsFiscaisEmpresa(id);
      limparMetadadosFiscaisLocais(empresa, !mesmoCnpjMantido);
      removerEmpresaService(id);
      const resultado = lerEmpresas();
      if ('erro' in resultado) throw new Error(resultado.erro);
      const atualizada = resultado.empresas;
      setErroEmpresas(null);
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
      setErroEmpresas(err instanceof Error ? err.message : 'Não foi possível excluir a empresa.');
      void carregar();
      return false;
    }
  };

  const limparTodasEmpresas = async (): Promise<boolean> => {
    try {
      if (empresas.some(empresa => Boolean(empresa.idCentral))) {
        throw new Error('A limpeza em massa está bloqueada enquanto houver empresas da carteira central. Arquive cada cadastro individualmente.');
      }
      await apagarTodosXmlsFiscaisLocais();
      empresas.forEach(empresa => limparMetadadosFiscaisLocais(empresa, true));
      const prefixosFiscaisPorEmpresa = [
        'fiscoia_notas_fiscais_', 'fiscoia_radar_xml_', 'fiscoia_regime_fiscal_',
        'fiscoia_radar_notificado_', 'fiscoia_livro_notificados_',
        'fiscoia_certificado_cliente_', 'fiscoia_guias_receita_', 'murade_agenda_notificado_'
      ];
      const chavesFiscaisOrfas = Array.from({ length: localStorage.length }, (_, indice) => localStorage.key(indice))
        .filter((chave): chave is string => Boolean(chave && prefixosFiscaisPorEmpresa.some(prefixo => chave.startsWith(prefixo))));
      chavesFiscaisOrfas.forEach(chave => localStorage.removeItem(chave));
      localStorage.removeItem(STORAGE_AGENDA_KEY);
      localStorage.removeItem(STORAGE_MONITOR_KEY);
      localStorage.removeItem(STORAGE_MONITOR_DOCUMENTOS_KEY);
      localStorage.setItem('fiscoia_empresas_list', JSON.stringify([]));
      localStorage.removeItem(STORAGE_ACTIVE_KEY);
      localStorage.removeItem('fiscoia_certificado');
      localStorage.removeItem('fiscoia_cnd');
      setEmpresas([]);
      setEmpresaAtiva(null);
      setErroEmpresas(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fiscoia_empresa_atualizada'));
      }
      return true;
    } catch (err) {
      console.error('Não foi possível limpar todos os dados fiscais locais:', err);
      return false;
    }
  };

  return (
    <EmpresaContext.Provider
      value={{
        empresas,
        empresaAtiva,
        erroEmpresas,
        selecionarEmpresa,
        salvarNovaEmpresa,
        removerEmpresa,
        recarregarEmpresas: () => { void carregar(); },
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
      erroEmpresas: null,
      selecionarEmpresa: () => {},
      salvarNovaEmpresa: () => null,
      removerEmpresa: async () => false,
      recarregarEmpresas: () => {},
      limparTodasEmpresas: async () => false
    };
  }
  return context;
}
