import { DadosViaCep } from '../types';

export interface RespostaViaCep {
  erro?: boolean;
  mensagem?: string;
  dados?: DadosViaCep;
}

export const buscarCep = async (cep: string): Promise<RespostaViaCep> => {
  const cepLimpo = cep.replace(/\D/g, '');

  if (cepLimpo.length !== 8) {
    return {
      erro: true,
      mensagem: 'CEP deve conter 8 dígitos numéricos'
    };
  }

  try {
    const url = `https://viacep.com.br/ws/${cepLimpo}/json/`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Falha ao consultar CEP (${response.status})`);
    }

    const json = await response.json();

    if (json.erro) {
      return {
        erro: true,
        mensagem: 'CEP não encontrado na base dos Correios'
      };
    }

    return {
      erro: false,
      dados: {
        cep: json.cep,
        logradouro: json.logradouro || '',
        complemento: json.complemento || '',
        bairro: json.bairro || '',
        localidade: json.localidade || '',
        uf: json.uf || '',
        ibge: json.ibge,
        ddd: json.ddd
      }
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro na conexão com ViaCEP';
    return {
      erro: true,
      mensagem: `Não foi possível buscar o endereço: ${msg}`
    };
  }
};
