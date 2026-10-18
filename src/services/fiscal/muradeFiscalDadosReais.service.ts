
import { normalizarCnpj, validarCnpj, validarCpf } from '../cnpj/cnpjValidation';
import { chaveNfeTemDigitoValido } from './chaveNfe.service';

/**
 * Conferências puramente estruturais de documentos locais.
 * Não consulta SEFAZ/SERPRO e nunca deve ser usada como prova de autenticidade.
 */

const FONTES_DE_TESTE_EXPLICITAS = new Set(['simulacao', 'mock', 'dados_teste', 'gerador_falso']);

type DocumentoLocal = Record<string, unknown> & {
  chaveAcesso?: string;
  cnpj?: string;
  cpf?: string;
  fonte?: string;
  valorTotal?: number;
};

export class FiltroDadosReais {
  /** Confere apenas identificadores e valor básico; não valida estrutura nem autenticidade fiscal. */
  static verificar(dados: DocumentoLocal | null | undefined) {
    if (!dados) return null;
    const fonte = String(dados.fonte || '').trim().toLowerCase();
    if (FONTES_DE_TESTE_EXPLICITAS.has(fonte)) return null;

    const cnpjInformado = String(dados.cnpj || '').trim();
    const cpfInformado = String(dados.cpf || '').trim();
    const cnpj = normalizarCnpj(cnpjInformado);
    const cpf = cpfInformado.replace(/\D/g, '');
    const cnpjValido = Boolean(cnpj) && validarCnpj(cnpj);
    const cpfValido = Boolean(cpf) && validarCpf(cpf);
    const temChave = Boolean(dados.chaveAcesso);
    const chaveValida = temChave && chaveNfeTemDigitoValido(String(dados.chaveAcesso));

    if ((cnpjInformado && !cnpjValido) || (cpfInformado && !cpfValido)) return null;
    if (temChave && !chaveValida) return null;
    if (!temChave && !cnpjValido && !cpfValido) return null;
    if (dados.valorTotal !== undefined && (typeof dados.valorTotal !== 'number' || !Number.isFinite(dados.valorTotal) || dados.valorTotal < 0)) return null;

    return {
      ...dados,
      identificacaoBasicaConferida: true,
      origemVerificada: false,
      respostaAutenticada: false,
      autenticidadeConfirmada: false
    };
  }

  /** Campos enviados pelo navegador não comprovam chamada autenticada ao órgão. */
  static conexaoEhReal(_resposta: unknown): boolean {
    return false;
  }
}

export class RobosMurade {
  readonly nome = 'MURADE — CONFERÊNCIA ESTRUTURAL LOCAL';

  async conferirNotas(listaNotas: DocumentoLocal[]) {
    const conferidas = listaNotas.map(nota => ({
      chave: String(nota.chaveAcesso || ''),
      identificacaoBasicaConferida: Boolean(FiltroDadosReais.verificar(nota)),
      autenticidadeConfirmada: false as const
    }));
    const identificacoesConferidas = conferidas.filter(nota => nota.identificacaoBasicaConferida).length;
    return {
      total: listaNotas.length,
      identificacoesBasicasConferidas: identificacoesConferidas,
      identificacoesBasicasInvalidas: listaNotas.length - identificacoesConferidas,
      origemOficialConfirmada: false as const,
      conferidas,
      resumo: 'Conferência local de identificadores básicos concluída. Não valida o XML, não consulta órgão oficial e não confirma autenticidade.'
    };
  }

  async conferirValores(dados: DocumentoLocal) {
    const documento = FiltroDadosReais.verificar(dados);
    if (!documento) {
      return { erro: 'Documento local com estrutura inválida ou identificação ausente.', origemOficialConfirmada: false as const };
    }
    return {
      status: 'IDENTIFICACAO_BASICA_LOCAL' as const,
      dados: documento,
      origemOficialConfirmada: false as const,
      observacao: 'Apenas identificadores básicos foram conferidos. XML, origem, autorização, valores e tratamento tributário não foram validados contra a SEFAZ.'
    };
  }

  async compararSistemas(dadosExternos: DocumentoLocal[], dadosMurade: DocumentoLocal[]) {
    const mapaMurade = new Map(dadosMurade.filter(item => item.chaveAcesso).map(item => [String(item.chaveAcesso), item]));
    const resultado = { iguais: 0, divergencias: 0, semCorrespondencia: 0, detalhes: [] as Array<Record<string, unknown>> };
    for (const externo of dadosExternos) {
      const chave = String(externo.chaveAcesso || '');
      const interno = mapaMurade.get(chave);
      if (!chave || !interno) {
        resultado.semCorrespondencia++;
        resultado.detalhes.push({ chave: chave || null, status: 'SEM_CORRESPONDENCIA' });
        continue;
      }
      const valorExterno = Number(externo.valorTotal);
      const valorMurade = Number(interno.valorTotal);
      if (!Number.isFinite(valorExterno) || !Number.isFinite(valorMurade)) {
        resultado.semCorrespondencia++;
        resultado.detalhes.push({ chave, status: 'VALOR_INDISPONIVEL' });
      } else if (Math.round(valorExterno * 100) === Math.round(valorMurade * 100)) {
        resultado.iguais++;
        resultado.detalhes.push({ chave, status: 'IGUAL', valor: valorExterno });
      } else {
        resultado.divergencias++;
        resultado.detalhes.push({ chave, status: 'DIVERGENCIA', externo: valorExterno, murade: valorMurade, diferenca: valorExterno - valorMurade });
      }
    }
    return { ...resultado, origemOficialConfirmada: false as const };
  }
}

export const sistema = new RobosMurade();
