import { formatarCnpj, normalizarCnpj, validarCnpj } from './cnpjValidation';

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
  fonte?: 'BrasilAPI' | 'ReceitaWS';
  dados?: DadosEmpresaCNPJ;
}

export const formatarCnpjString = (v: string): string => {
  return formatarCnpj(v);
};

const campoTexto = (valor: unknown): string => valor == null ? '' : String(valor);

/**
 * Consulta dados cadastrais por meio de APIs públicas de terceiros (BrasilAPI e ReceitaWS).
 * Isso não é uma consulta autenticada ou garantia de atualização direta da Receita Federal.
 */
export const buscarDadosCNPJ = async (cnpj: string): Promise<RespostaConsultaCNPJ> => {
  const cnpjLimpo = normalizarCnpj(cnpj);

  if (!validarCnpj(cnpjLimpo)) {
    return { 
      sucesso: false, 
      mensagem: 'Informe um CNPJ válido com 14 caracteres e dígitos verificadores corretos.'
    };
  }

  // 1ª tentativa: provedor terceiro BrasilAPI. Não é conexão autenticada com a Receita Federal.
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let dados: Record<string, unknown> | null = null;
    try {
      const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(cnpjLimpo)}`, { signal: controller.signal });
      if (resposta.ok) {
        const json: unknown = await resposta.json();
        if (json && typeof json === 'object' && !Array.isArray(json)) dados = json as Record<string, unknown>;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (dados) {
      if (normalizarCnpj(String(dados.cnpj ?? '')) !== cnpjLimpo) throw new Error('O CNPJ retornado pela BrasilAPI não corresponde ao consultado.');

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
      const cnaeDescricao = campoTexto(dados.cnae_fiscal_descricao);
      const cnaeDesc = cnaeDescricao ? ` - ${cnaeDescricao}` : '';
      const cnaeFormatado = cnaeCode ? `${cnaeCode}${cnaeDesc}` : '';

      return {
        sucesso: true,
        fonte: 'BrasilAPI',
        dados: {
          razaoSocial: campoTexto(dados.razao_social),
          nomeFantasia: campoTexto(dados.nome_fantasia) || campoTexto(dados.razao_social),
          cnpj: cnpjLimpo,
          cnpjFormatado: formatarCnpjString(cnpjLimpo),
          endereco: campoTexto(dados.logradouro),
          numero: campoTexto(dados.numero),
          bairro: campoTexto(dados.bairro),
          cidade: campoTexto(dados.municipio),
          uf: campoTexto(dados.uf).toUpperCase(),
          cep: cepFormatado,
          telefone: telefoneStr,
          email: campoTexto(dados.email).toLowerCase(),
          cnaePrincipal: cnaeFormatado,
          situacaoCadastral: campoTexto(dados.descricao_situacao_cadastral)
        }
      };
    }
  } catch {
    // Continuar para fallback
  }

  // 2ª tentativa: provedor terceiro ReceitaWS. Também não equivale a consulta autenticada da RFB.
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let resposta: Response;
    try {
      resposta = await fetch(`https://www.receitaws.com.br/v1/cnpj/${encodeURIComponent(cnpjLimpo)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!resposta.ok) {
      throw new Error('Erro na resposta do servidor ReceitaWS');
    }

    const json: unknown = await resposta.json();
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('Resposta inválida da ReceitaWS.');
    const dados = json as Record<string, any>;

    if (dados.status === 'ERROR') {
      return { 
        sucesso: false, 
        mensagem: `O provedor terceiro ReceitaWS informou que não localizou o CNPJ${dados.message ? `: ${campoTexto(dados.message)}` : '.'} Isso não é uma consulta autenticada à Receita Federal.`
      };
    }
    if (normalizarCnpj(String(dados.cnpj || '')) !== cnpjLimpo) {
      return { sucesso: false, mensagem: 'O CNPJ retornado pela ReceitaWS não corresponde ao consultado. Confira e tente novamente.' };
    }

    const cepLimpo = dados.cep ? String(dados.cep).replace(/\D/g, '') : '';
    const cepFormatado = cepLimpo.length === 8 ? `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}` : cepLimpo;

    return {
      sucesso: true,
      fonte: 'ReceitaWS',
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
        situacaoCadastral: dados.situacao || ''
      }
    };
  } catch {
    return {
      sucesso: false,
      mensagem: 'Os provedores terceiros de consulta cadastral não responderam. Nenhuma consulta autenticada foi feita à Receita Federal; verifique a internet ou preencha os dados manualmente.'
    };
  }
};
