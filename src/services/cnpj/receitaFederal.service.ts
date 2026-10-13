export interface DadosEmpresaCNPJ {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cnpjFormatado: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  cnaePrincipal: string;
  situacaoCadastral: string;
}

export interface RespostaConsultaCNPJ {
  sucesso: boolean;
  mensagem?: string;
  dados?: DadosEmpresaCNPJ;
}

export const formatarCnpjString = (v: string): string => {
  const limpo = v.replace(/\D/g, '').slice(0, 14);
  if (limpo.length <= 2) return limpo;
  if (limpo.length <= 5) return `${limpo.slice(0, 2)}.${limpo.slice(2)}`;
  if (limpo.length <= 8) return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5)}`;
  if (limpo.length <= 12) return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}/${limpo.slice(8)}`;
  return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}/${limpo.slice(8, 12)}-${limpo.slice(12, 14)}`;
};

/**
 * Consulta dados cadastrais de empresa pelo CNPJ junto à Receita Federal
 * Utiliza APIs públicas e gratuitas (BrasilAPI e ReceitaWS) com fallback robusto
 */
export const buscarDadosCNPJ = async (cnpj: string): Promise<RespostaConsultaCNPJ> => {
  const cnpjLimpo = cnpj.replace(/\D/g, '');

  if (cnpjLimpo.length !== 14) {
    return { 
      sucesso: false, 
      mensagem: 'CNPJ precisa ter 14 dígitos!' 
    };
  }

  // 1ª Tentativa: BrasilAPI (Suporta CORS nativamente no navegador web, sem custo, base oficial Receita)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const resBrasilApi = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (resBrasilApi.ok) {
      const dados = await resBrasilApi.json();

      const cepLimpo = dados.cep ? String(dados.cep).replace(/\D/g, '') : '';
      const cepFormatado = cepLimpo.length === 8 ? `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}` : cepLimpo;

      let telefoneStr = '';
      if (dados.ddd_telefone_1) {
        const telDigits = String(dados.ddd_telefone_1).replace(/\D/g, '');
        if (telDigits.length >= 10) {
          telefoneStr = `(${telDigits.slice(0, 2)}) ${telDigits.slice(2)}`;
        } else {
          telefoneStr = String(dados.ddd_telefone_1);
        }
      }

      const cnaeCode = dados.cnae_fiscal ? String(dados.cnae_fiscal) : '';
      const cnaeDesc = dados.cnae_fiscal_descricao ? ` - ${dados.cnae_fiscal_descricao}` : '';
      const cnaeFormatado = cnaeCode ? `${cnaeCode}${cnaeDesc}` : '';

      return {
        sucesso: true,
        dados: {
          razaoSocial: dados.razao_social || '',
          nomeFantasia: dados.nome_fantasia || dados.razao_social || '',
          cnpj: cnpjLimpo,
          cnpjFormatado: formatarCnpjString(cnpjLimpo),
          endereco: dados.logradouro || '',
          numero: dados.numero || '',
          bairro: dados.bairro || '',
          cidade: dados.municipio || '',
          uf: (dados.uf || '').toUpperCase(),
          cep: cepFormatado,
          telefone: telefoneStr,
          email: (dados.email || '').toLowerCase(),
          cnaePrincipal: cnaeFormatado,
          situacaoCadastral: dados.descricao_situacao_cadastral || 'ATIVA'
        }
      };
    }
  } catch {
    // Continuar para fallback
  }

  // 2ª Tentativa: ReceitaWS
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const resposta = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpjLimpo}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!resposta.ok) {
      throw new Error('Erro na resposta do servidor ReceitaWS');
    }

    const dados = await resposta.json();

    if (dados.status === 'ERROR') {
      return { 
        sucesso: false, 
        mensagem: dados.message || 'CNPJ não encontrado na base da Receita Federal!' 
      };
    }

    const cepLimpo = dados.cep ? String(dados.cep).replace(/\D/g, '') : '';
    const cepFormatado = cepLimpo.length === 8 ? `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}` : cepLimpo;

    return {
      sucesso: true,
      dados: {
        razaoSocial: dados.nome || '',
        nomeFantasia: dados.fantasia || dados.nome || '',
        cnpj: cnpjLimpo,
        cnpjFormatado: formatarCnpjString(cnpjLimpo),
        endereco: dados.logradouro || '',
        numero: dados.numero || '',
        bairro: dados.bairro || '',
        cidade: dados.municipio || '',
        uf: (dados.uf || '').toUpperCase(),
        cep: cepFormatado,
        telefone: dados.telefone || '',
        email: (dados.email || '').toLowerCase(),
        cnaePrincipal: dados.atividade_principal?.[0]?.code 
          ? `${dados.atividade_principal[0].code} - ${dados.atividade_principal[0].text || ''}`
          : '',
        situacaoCadastral: dados.situacao || 'ATIVA'
      }
    };
  } catch {
    return {
      sucesso: false,
      mensagem: 'Erro ao consultar Receita Federal. Verifique a internet ou preencha os dados manualmente.'
    };
  }
};
