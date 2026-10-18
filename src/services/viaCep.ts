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
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    } finally {
      window.clearTimeout(timeout);
    }
    if (!response.ok) {
      throw new Error(`Falha ao consultar CEP (${response.status})`);
    }

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Resposta inválida do ViaCEP.');
    }
    const json = payload as Record<string, unknown>;

    if (json.erro) {
      return {
        erro: true,
        mensagem: 'CEP não encontrado no ViaCEP.'
      };
    }

    const cepRetornado = String(json.cep ?? '').replace(/\D/g, '');
    if (cepRetornado !== cepLimpo) {
      throw new Error('O CEP retornado não corresponde ao consultado.');
    }

    const texto = (campo: unknown) => campo == null ? '' : String(campo);

    return {
      erro: false,
      dados: {
        cep: texto(json.cep),
        logradouro: texto(json.logradouro),
        complemento: texto(json.complemento),
        bairro: texto(json.bairro),
        localidade: texto(json.localidade),
        uf: texto(json.uf),
        ibge: texto(json.ibge),
        ddd: texto(json.ddd)
      }
    };
  } catch (err: unknown) {
    const msg = err instanceof Error && err.name === 'AbortError'
      ? 'A consulta ao ViaCEP excedeu o tempo limite.'
      : err instanceof Error ? err.message : 'Erro na conexão com ViaCEP';
    return {
      erro: true,
      mensagem: `Não foi possível buscar o endereço: ${msg}`
    };
  }
};
