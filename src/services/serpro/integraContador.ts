/**
 * Integra Contador (SERPRO) — peças puras e testáveis, sem rede.
 * ATENÇÃO: formato do pedido segue a documentação pública do Integra Contador, mas
 * ainda NÃO foi validado contra o SERPRO real (depende das chaves do contrato).
 * Cada consulta é cobrada pelo SERPRO, então tudo aqui passa por trava de custo.
 */
import { normalizarCnpj, validarCnpj } from '../cnpj/cnpjValidation';

export interface ServicoIntegra {
  chave: string;
  descricao: string;
  idSistema: string;
  idServico: string;
  versaoSistema: string;
  /** Endpoint do gateway: Consultar, Apoiar, Emitir, Declarar */
  operacao: 'Consultar' | 'Emitir' | 'Apoiar' | 'Declarar';
  /** Campos que o serviço exige dentro de "dados" (o formulário pede ao usuário). */
  campos?: { nome: string; rotulo: string; exemplo: string; opcional?: boolean }[];
}

/** Catálogo editável: ajuste os códigos conforme o contrato assim que as chaves chegarem. */
export const CATALOGO_SERVICOS: Record<string, ServicoIntegra> = {
  situacaoFiscal: { chave: 'situacaoFiscal', descricao: 'Situação fiscal / pendências do contribuinte', idSistema: 'SITFIS', idServico: 'SOLICITARPROTOCOLO91', versaoSistema: '2.0', operacao: 'Apoiar' },
  declaracoesSimples: { chave: 'declaracoesSimples', descricao: 'Simples Nacional: declarações do ano (PGDAS-D)', idSistema: 'PGDASD', idServico: 'CONSDECLARACAO13', versaoSistema: '1.0', operacao: 'Consultar', campos: [{ nome: 'anoCalendario', rotulo: 'Ano-calendário', exemplo: '2026' }] },
  guiasPagas: { chave: 'guiasPagas', descricao: 'Simples Nacional: extrato de um DAS (informe o número do DAS)', idSistema: 'PGDASD', idServico: 'CONSEXTRATO16', versaoSistema: '1.0', operacao: 'Consultar', campos: [{ nome: 'numeroDas', rotulo: 'Número do DAS', exemplo: '07202636999999999' }] },
  // DCTFWeb (Integra Contador). Exemplo de requisição do GERARGUIA31 informado do catálogo oficial: versaoSistema "1.0" e dados {categoria, anoPA, mesPA}.
  // Pendente de confirmar no primeiro teste real: versão e endpoint de CONSRECIBO32/CONSDECCOMPLETA33 e o endpoint (Emitir) de GERARGUIA31.
  dctfwebRecibo: { chave: 'dctfwebRecibo', descricao: 'DCTFWeb: consultar recibo de entrega (mês ou 13º)', idSistema: 'DCTFWEB', idServico: 'CONSRECIBO32', versaoSistema: '1.0', operacao: 'Consultar', campos: [{ nome: 'categoria', rotulo: 'Categoria (ex.: GERAL_MENSAL ou GERAL_13o_SALARIO)', exemplo: 'GERAL_MENSAL' }, { nome: 'anoPA', rotulo: 'Ano da apuração', exemplo: '2026' }, { nome: 'mesPA', rotulo: 'Mês da apuração (não use no 13º)', exemplo: '09', opcional: true }] },
  dctfwebDeclaracao: { chave: 'dctfwebDeclaracao', descricao: 'DCTFWeb: consultar a declaração completa', idSistema: 'DCTFWEB', idServico: 'CONSDECCOMPLETA33', versaoSistema: '1.0', operacao: 'Consultar', campos: [{ nome: 'categoria', rotulo: 'Categoria (ex.: GERAL_MENSAL ou GERAL_13o_SALARIO)', exemplo: 'GERAL_MENSAL' }, { nome: 'anoPA', rotulo: 'Ano da apuração', exemplo: '2026' }, { nome: 'mesPA', rotulo: 'Mês da apuração (não use no 13º)', exemplo: '09', opcional: true }] },
  // CONSXMLDECLARACAO38: exemplo oficial informado (versão 1.0). numeroReciboEntrega é opcional: sem ele, vem a declaração mais recente. Resposta: dados = {"XMLStringBase64": "..."}.
  dctfwebXml: { chave: 'dctfwebXml', descricao: 'DCTFWeb: consultar o XML da declaração (valores por tributo)', idSistema: 'DCTFWEB', idServico: 'CONSXMLDECLARACAO38', versaoSistema: '1.0', operacao: 'Consultar', campos: [{ nome: 'categoria', rotulo: 'Categoria (ex.: GERAL_MENSAL ou GERAL_13o_SALARIO)', exemplo: 'GERAL_MENSAL' }, { nome: 'anoPA', rotulo: 'Ano da apuração', exemplo: '2026' }, { nome: 'mesPA', rotulo: 'Mês da apuração (não use no 13º)', exemplo: '09', opcional: true }, { nome: 'numeroReciboEntrega', rotulo: 'Número do recibo (vazio = declaração mais recente)', exemplo: '24688', opcional: true }] },
  dctfwebGuia: { chave: 'dctfwebGuia', descricao: 'DCTFWeb: gerar a guia de arrecadação (DARF)', idSistema: 'DCTFWEB', idServico: 'GERARGUIA31', versaoSistema: '1.0', operacao: 'Emitir', campos: [{ nome: 'categoria', rotulo: 'Categoria (ex.: GERAL_MENSAL ou GERAL_13o_SALARIO)', exemplo: 'GERAL_MENSAL' }, { nome: 'anoPA', rotulo: 'Ano da apuração', exemplo: '2026' }, { nome: 'mesPA', rotulo: 'Mês da apuração (não use no 13º)', exemplo: '09', opcional: true }] },
};

export interface PedidoIntegra {
  contratante: { numero: string; tipo: 2 };
  autorPedidoDados: { numero: string; tipo: 2 };
  contribuinte: { numero: string; tipo: 2 };
  pedidoDados: { idSistema: string; idServico: string; versaoSistema: string; dados: string };
}

export function montarPedido(servico: ServicoIntegra, cnpjContratante: string, cnpjContribuinte: string, dados: Record<string, unknown> = {}): PedidoIntegra {
  const contratante = normalizarCnpj(cnpjContratante);
  const contribuinte = normalizarCnpj(cnpjContribuinte);
  if (!validarCnpj(contratante)) throw new Error('CNPJ do escritório (contratante) inválido.');
  if (!validarCnpj(contribuinte)) throw new Error('CNPJ do cliente inválido.');
  return {
    contratante: { numero: contratante, tipo: 2 },
    autorPedidoDados: { numero: contratante, tipo: 2 },
    contribuinte: { numero: contribuinte, tipo: 2 },
    pedidoDados: { idSistema: servico.idSistema, idServico: servico.idServico, versaoSistema: servico.versaoSistema, dados: JSON.stringify(dados) },
  };
}

/** Trava de custo: limite de consultas pagas por empresa e por dia, e interruptor geral. */
export class ControleCusto {
  private usos = new Map<string, number>();
  constructor(private limiteDiarioPorEmpresa: number, private habilitado: boolean, private agora: () => Date = () => new Date()) {}

  private chaveDia(cnpj: string): string {
    return `${this.agora().toISOString().slice(0, 10)}:${normalizarCnpj(cnpj)}`;
  }

  verificar(cnpj: string): { pode: boolean; motivo?: string; restantes: number } {
    if (!this.habilitado) return { pode: false, motivo: 'Consultas pagas desligadas (SERPRO_CONSULTAS_HABILITADAS não está "true").', restantes: 0 };
    const usadas = this.usos.get(this.chaveDia(cnpj)) ?? 0;
    const restantes = Math.max(0, this.limiteDiarioPorEmpresa - usadas);
    if (restantes <= 0) return { pode: false, motivo: `Limite diário de ${this.limiteDiarioPorEmpresa} consulta(s) paga(s) para esta empresa atingido.`, restantes: 0 };
    return { pode: true, restantes };
  }

  registrar(cnpj: string): void {
    const k = this.chaveDia(cnpj);
    this.usos.set(k, (this.usos.get(k) ?? 0) + 1);
    const hoje = this.agora().toISOString().slice(0, 10);
    for (const chave of this.usos.keys()) if (!chave.startsWith(hoje)) this.usos.delete(chave);
  }
}

export interface ProntidaoSerpro {
  pronto: boolean;
  itens: { chave: string; ok: boolean; descricao: string }[];
}

export function avaliarProntidao(env: Record<string, string | undefined>): ProntidaoSerpro {
  const tem = (n: string) => Boolean(env[n]?.trim());
  const cnpj = normalizarCnpj(env.SERPRO_CONTRATANTE_CNPJ ?? '');
  const itens = [
    { chave: 'consumer', ok: tem('SERPRO_PRODUCAO_CONSUMER_KEY') && tem('SERPRO_PRODUCAO_CONSUMER_SECRET'), descricao: 'Consumer Key e Secret de produção (Integra Contador)' },
    { chave: 'contratante', ok: validarCnpj(cnpj), descricao: 'SERPRO_CONTRATANTE_CNPJ: CNPJ do escritório contratante' },
    { chave: 'certificado', ok: tem('SERPRO_CERT_PFX_BASE64') && tem('SERPRO_CERT_PFX_SENHA'), descricao: 'Certificado e-CNPJ do escritório (SERPRO_CERT_PFX_BASE64 e SERPRO_CERT_PFX_SENHA)' },
    { chave: 'habilitado', ok: env.SERPRO_CONSULTAS_HABILITADAS === 'true', descricao: 'Interruptor de consultas pagas (SERPRO_CONSULTAS_HABILITADAS=true)' },
  ];
  return { pronto: itens.every(i => i.ok), itens };
}

export interface ResultadoOficial {
  fonte: 'SERPRO';
  consultadoEm: string;
  servico: string;
  /** Resposta bruta do SERPRO, guardada para auditoria e conferência */
  bruto: unknown;
}

export function compararComFiscal(oficial: { debitos?: number; guiasPagas?: number } | null, fiscal: { debitos?: number; guiasPagas?: number } | null) {
  if (!oficial) return { status: 'sem_dado_oficial' as const, divergencias: [] as string[] };
  const divergencias: string[] = [];
  if (fiscal && oficial.debitos !== undefined && fiscal.debitos !== undefined && oficial.debitos !== fiscal.debitos) {
    divergencias.push(`Débitos: oficial ${oficial.debitos} × Fiscal ${fiscal.debitos}`);
  }
  if (fiscal && oficial.guiasPagas !== undefined && fiscal.guiasPagas !== undefined && oficial.guiasPagas !== fiscal.guiasPagas) {
    divergencias.push(`Guias pagas: oficial ${oficial.guiasPagas} × Fiscal ${fiscal.guiasPagas}`);
  }
  return { status: divergencias.length ? ('divergente' as const) : ('conferido' as const), divergencias };
}
