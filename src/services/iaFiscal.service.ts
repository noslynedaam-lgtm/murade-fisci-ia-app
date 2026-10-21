/**
 * Serviço de Integração com a IA Fiscal Oficial
 * Conecta ao endpoint da IA com pesquisa web e links de grounding governamentais quando encontrados.
 */

export interface MensagemHistorico {
  autor: 'usuario' | 'ia';
  texto: string;
}

export interface FonteWeb {
  uri: string;
  title: string;
}

export interface RespostaIAFiscal {
  sucesso: boolean;
  resposta: string;
  referencia: string;
  fontesWeb?: FonteWeb[];
  origem: string;
  erro?: string;
}

export async function consultarIAFiscal(
  pergunta: string,
  historico: MensagemHistorico[] = []
): Promise<RespostaIAFiscal> {
  try {
    const response = await fetch('/api/ia-fiscal/consultar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pergunta,
        historico,
      }),
    });

    if (!response.ok) {
      const erroData = await response.json().catch(() => ({}));
      throw new Error(erroData.erro || `Erro HTTP ${response.status} ao consultar IA fiscal.`);
    }

    const data: RespostaIAFiscal = await response.json();
    return data;
  } catch (error: any) {
    console.error('Falha ao comunicar com o servidor da IA Fiscal:', error);

    const isPrimeiraInteracao = historico.filter(h => h.autor === 'usuario').length === 0;
    const prefixo = isPrimeiraInteracao ? 'Olá, quem fala é o Fisco IA. O que você deseja?\n\n' : '';

    return {
      sucesso: false,
      resposta: `${prefixo}Não consegui consultar uma fonte atual nesta tentativa. Não vou afirmar prazos, valores ou situação fiscal sem confirmação. Tente novamente mais tarde ou consulte o órgão oficial responsável.`,
      referencia: 'Consulta oficial não realizada',
      fontesWeb: [],
      origem: 'FONTE_NAO_CONSULTADA',
    };
  }
}
