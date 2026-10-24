import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, Check, Pause, Play, RefreshCw, X } from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import { conferirNotasRadar } from '../services/fiscal/radarFiscal.service';
import { classificarVencimentoInformado, EVENTO_DADOS_FISCAIS_ATUALIZADOS, NotaFiscalItem } from '../services/fiscal/fiscoiaFiscal.service';
import { definirMonitorPendenciasAtivo, EVENTO_MONITOR_PENDENCIAS_ATUALIZADO, monitorPendenciasAtivo } from '../services/fiscal/monitorPendenciasFiscal.service';
import { lerLivroFiscalEmpresa, lerRadarFiscalEmpresa } from '../services/fiscal/empresaFiscalStorage.service';
import { obterGuiasSalvas } from '../services/serpro/guiasReceita.service';
import { EVENTO_LEMBRETES_FISCAIS_ATUALIZADOS, gerarAgenda, listarLembretesFiscais, verificarLembretesDoDia } from '../services/agenda/lembrete.service';
import { MODULOS_MURADE } from '../config/modulosMurade';
import { normalizarCnpj } from '../services/cnpj/cnpjValidation';
import { chaveNfeTemDigitoValido } from '../services/fiscal/chaveNfe.service';
import { EVENTO_CND_LOCAL_ATUALIZADA, lerCndsLocaisParaMonitor } from '../services/cnd/cndMonitor.service';
import { listarArquivosFiscaisPendentesEmpresa } from '../services/fiscal/xmlFiscalStorage.service';

const STORAGE_KEY = 'fiscoia_monitor_carteira_assinaturas_v1';
const DOCUMENTOS_STORAGE_KEY = 'fiscoia_monitor_carteira_documentos_v1';
const INTERVALO_VERIFICACAO = 5 * 60 * 1000;
const INTERVALO_SAUDE_MODULOS = 10 * 60 * 1000;

type EstadoServico = { id: string; nome: string; estado: 'disponivel' | 'sem_confirmacao'; detalhe: string; verificadoEm: Date; ultimoSucessoEm: Date | null };
type HistoricoSaudeServico = { falhasConsecutivas: number; ultimoSucessoEm: Date | null; indisponibilidadeNotificada: boolean };

type EstadoMonitor = {
  totalEmpresas: number;
  empresasComDados: number;
  assinaturas: string[];
  documentos: string[];
  totalRadar: number;
  totalLivro: number;
  arquivosPendentes: number;
  guiasAbertas: number;
  lembretesAtivos: number;
  cndRegistradas: number;
  cndVencidas: number;
  cndProximas: number;
  pendencias: number;
  falhasLeitura: string[];
  semDadosLocais: string[];
};

function conferirLivro(nota: NotaFiscalItem): string[] {
  const problemas: string[] = [];
  if (!chaveNfeTemDigitoValido(nota.chave || '')) problemas.push('chave ausente ou inválida');
  if (!nota.cfop) problemas.push('CFOP ausente');
  if (nota.camposNumericosIndisponiveis?.includes('VNF') || !Number.isFinite(nota.valorTotal) || nota.valorTotal <= 0) {
    problemas.push('valor total ausente, inválido ou não positivo');
  }
  for (const [nome, valor] of [['ICMS', nota.ICMS_valor], ['PIS', nota.PIS_valor], ['COFINS', nota.COFINS_valor]] as const) {
    if (nota.camposNumericosIndisponiveis?.includes(nome) || !Number.isFinite(valor) || valor < 0) {
      problemas.push(`${nome} ausente ou inválido na origem`);
    }
  }
  return problemas;
}

function dataIsoLocal(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function descreverPendencia(assinatura: string, empresas: ReturnType<typeof useEmpresa>['empresas']): string {
  const partes = assinatura.split(':');
  const id = partes[0];
  const tipo = partes[1];
  const empresa = empresas.find(item => item.id === id || item.cnpj === id);
  const nome = empresa?.razaoSocial || empresa?.cnpj || 'Empresa';
  if (tipo === 'guia' || tipo === 'vencimento') {
    const situacao = tipo === 'guia' ? partes[3] : partes[2];
    return `${nome}: vencimento local ${situacao === 'VENCIDA' ? 'passou' : 'nos próximos dias'}`;
  }
  if (tipo === 'arquivo_pendente') {
    let arquivo = 'documento';
    try { arquivo = decodeURIComponent(partes[2] || '') || arquivo; } catch { /* mantém rótulo genérico */ }
    return `${nome}: arquivo ${arquivo} aguarda interpretação; não foi lançado nem conferido`;
  }
  if (tipo === 'lembrete') {
    const dias = Number(partes[3]);
    let titulo = 'lembrete manual';
    try { titulo = decodeURIComponent(partes[4] || '') || titulo; } catch { /* mantém rótulo genérico */ }
    return `${nome}: ${titulo}${dias < 0 ? ` vencido há ${Math.abs(dias)} dia(s)` : dias === 0 ? ' vence hoje' : ` vence em ${dias} dia(s)`}`;
  }
  if (tipo === 'cnd') {
    const tipoCnd: Record<string, string> = { federal: 'CND federal', estadual: 'CND estadual', municipal: 'CND municipal', fgts: 'CRF/FGTS', trabalhista: 'CNDT' };
    const nome = tipoCnd[partes[4]] || 'certidão';
    const dias = Number(partes[3]);
    if (partes[2] === 'validade_invalida') return `${nome}: validade cadastrada inválida; revisar o registro local`;
    if (partes[2] === 'vencida') return `${nome}: validade informada venceu há ${Math.abs(dias)} dia(s)`;
    return `${nome}: ${dias === 0 ? 'validade informada vence hoje' : `validade informada vence em ${dias} dia(s)`}`;
  }
  return `${nome}: dado fiscal local para revisar`;
}

function resumoPendencias(assinaturas: string[], empresas: ReturnType<typeof useEmpresa>['empresas']): string {
  const descricoes = [...new Set(assinaturas.map(item => descreverPendencia(item, empresas)))];
  const visiveis = descricoes.slice(0, 3).join('; ');
  return descricoes.length > 3 ? `${visiveis}; e mais ${descricoes.length - 3}` : visiveis;
}

async function assinaturaPendencias(empresaId: string, empresas: ReturnType<typeof useEmpresa>['empresas']) {
  // Algumas carteiras antigas só possuem CNPJ. Use a mesma chave que a tela
  // de automação usa para não ignorar empresas sem id legado.
  const empresa = empresas.find(item => item.id === empresaId || (!item.id && item.cnpj === empresaId));
  if (!empresa) return { totalEmpresas: 0, empresasComDados: 0, assinaturas: [], documentos: [], totalRadar: 0, totalLivro: 0, arquivosPendentes: 0, guiasAbertas: 0, lembretesAtivos: 0, cndRegistradas: 0, cndVencidas: 0, cndProximas: 0, pendencias: 0, falhasLeitura: [], semDadosLocais: [] } satisfies EstadoMonitor;

  const radarAtual = lerRadarFiscalEmpresa(empresaId, empresa.cnpj);
  const radar = radarAtual.notas;
  const problemasRadar = conferirNotasRadar(radar);
  const livro = lerLivroFiscalEmpresa(empresaId, empresa.cnpj);
  const notasLivro = [...livro.notas.entradas, ...livro.notas.saidas];
  let guias = [] as NonNullable<ReturnType<typeof obterGuiasSalvas>>;
  let erroGuias: string | undefined;
  try {
    guias = obterGuiasSalvas(empresa.cnpj) ?? [];
    if (guias.some(guia => Number.isNaN(guia.dataVencimento.getTime()))) {
      throw new Error('há guia com data de vencimento inválida');
    }
  } catch (erro) {
    erroGuias = erro instanceof Error ? erro.message : 'não foi possível ler as guias locais';
  }
  let lembretesDaEmpresa: ReturnType<typeof gerarAgenda> = [];
  let erroLembretes: string | undefined;
  try {
    const leituraLembretes = listarLembretesFiscais();
    if ('erro' in leituraLembretes) throw new Error(leituraLembretes.erro);
    const chavesEmpresa = new Set([empresa.id, empresa.cnpj].filter((valor): valor is string => Boolean(valor)));
    const cnpjEmpresa = normalizarCnpj(empresa.cnpj || '');
    const lembretes = leituraLembretes.lembretes.filter(item =>
      chavesEmpresa.has(item.empresaId) || (cnpjEmpresa && normalizarCnpj(item.cnpj) === cnpjEmpresa)
    );
    lembretesDaEmpresa = gerarAgenda(lembretes);
  } catch (erro) {
    erroLembretes = erro instanceof Error ? erro.message : 'não foi possível ler os lembretes fiscais locais';
  }
  const leituraCnd = lerCndsLocaisParaMonitor(empresa);
  const certidoesDaEmpresa = leituraCnd.ok ? leituraCnd.certidoes : [];
  let arquivosPendentes = [] as Awaited<ReturnType<typeof listarArquivosFiscaisPendentesEmpresa>>;
  let erroArquivosPendentes: string | undefined;
  try {
    arquivosPendentes = await listarArquivosFiscaisPendentesEmpresa(empresaId);
  } catch (erro) {
    erroArquivosPendentes = erro instanceof Error ? erro.message : 'não foi possível ler os arquivos fiscais pendentes';
  }
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const assinaturas: string[] = [];
  const documentos = new Set<string>();

  for (const nota of radar) {
    const chave = nota.chave || `${nota.origemArquivo}-${nota.numero}`;
    documentos.add(`${empresaId}:${nota.chave || `${nota.origemArquivo}:${nota.numero}:${nota.serie}:${nota.dataEmissao}`}`);
    for (const ocorrencia of problemasRadar.get(chave) ?? []) {
      assinaturas.push(`${empresaId}:radar:${chave}:${ocorrencia.codigo}`);
    }
  }

  for (const arquivo of arquivosPendentes) {
    assinaturas.push(`${empresaId}:arquivo_pendente:${encodeURIComponent(arquivo.nomeArquivo)}:${encodeURIComponent(arquivo.id)}`);
  }

  for (const nota of notasLivro) {
    const chave = nota.chave || nota.numero || 'sem-identificador';
    documentos.add(`${empresaId}:${nota.chave || `livro:${nota.numero}:${nota.serie}:${nota.dataEmissao}`}`);
    for (const problema of conferirLivro(nota)) {
      assinaturas.push(`${empresaId}:livro:${chave}:${problema}`);
    }
    if (nota.status !== 'PAGA_INFORMADA') {
      const situacao = classificarVencimentoInformado(nota.dataVencimento, hoje);
      if (situacao) assinaturas.push(`${empresaId}:vencimento:${situacao}:${chave}:${nota.dataVencimento}`);
    }
  }

  const guiasAbertas = guias.filter(guia => guia.statusPagamento !== 'PAGO');
  for (const guia of guiasAbertas) {
    const situacao = classificarVencimentoInformado(dataIsoLocal(guia.dataVencimento), hoje);
    if (situacao) assinaturas.push(`${empresaId}:guia:${guia.id}:${situacao}:${dataIsoLocal(guia.dataVencimento)}`);
  }
  for (const lembrete of verificarLembretesDoDia(lembretesDaEmpresa)) {
    assinaturas.push(`${empresaId}:lembrete:${lembrete.id}:${lembrete.diasParaVencer}:${encodeURIComponent(lembrete.tipo)}`);
  }
  for (const cnd of certidoesDaEmpresa) {
    if (cnd.situacao !== 'no_prazo') {
      assinaturas.push(`${empresaId}:cnd:${cnd.situacao}:${cnd.diasParaVencer ?? 'na'}:${cnd.tipo}:${encodeURIComponent(cnd.id)}`);
    }
  }

  return {
    totalEmpresas: 1,
    empresasComDados: radar.length + notasLivro.length + guias.length + arquivosPendentes.length > 0 ? 1 : 0,
    assinaturas,
    documentos: [...documentos],
    totalRadar: radar.length,
    totalLivro: notasLivro.length,
    arquivosPendentes: arquivosPendentes.length,
    guiasAbertas: guiasAbertas.length,
    lembretesAtivos: lembretesDaEmpresa.filter(item => item.status.texto !== 'CONCLUÍDO').length,
    cndRegistradas: certidoesDaEmpresa.length,
    cndVencidas: certidoesDaEmpresa.filter(item => item.situacao === 'vencida').length,
    cndProximas: certidoesDaEmpresa.filter(item => item.situacao === 'proxima').length,
    pendencias: assinaturas.length,
    falhasLeitura: [radarAtual.erro, livro.erro, erroGuias, erroLembretes, erroArquivosPendentes, 'erro' in leituraCnd ? leituraCnd.erro : undefined].filter((erro): erro is string => Boolean(erro)).map(erro => `${empresa.razaoSocial || empresa.cnpj}: ${erro}`),
    semDadosLocais: !radarAtual.erro && !livro.erro && !erroGuias && !erroLembretes && !erroArquivosPendentes && leituraCnd.ok && !radarAtual.existeFonte && !livro.existeFonte && arquivosPendentes.length === 0 && guias.length === 0 && certidoesDaEmpresa.length === 0 && lembretesDaEmpresa.length === 0
      ? [empresa.razaoSocial || empresa.cnpj]
      : []
  } satisfies EstadoMonitor;
}

export function MonitorPendenciasFiscal() {
  const { empresas, erroEmpresas } = useEmpresa();
  const [estado, setEstado] = useState<EstadoMonitor>({ totalEmpresas: 0, empresasComDados: 0, assinaturas: [], documentos: [], totalRadar: 0, totalLivro: 0, arquivosPendentes: 0, guiasAbertas: 0, lembretesAtivos: 0, cndRegistradas: 0, cndVencidas: 0, cndProximas: 0, pendencias: 0, falhasLeitura: [], semDadosLocais: [] });
  const [aviso, setAviso] = useState<string | null>(null);
  // O painel pode ser recolhido para não ficar preso na tela; a escolha é lembrada neste navegador.
  const [recolhido, setRecolhido] = useState<boolean>(() => {
    try { return localStorage.getItem('fiscoia_monitor_recolhido') === '1'; } catch { return false; }
  });
  const alternarRecolhido = (valor: boolean) => {
    setRecolhido(valor);
    try { localStorage.setItem('fiscoia_monitor_recolhido', valor ? '1' : '0'); } catch { /* sem armazenamento */ }
  };
  const [ativo, setAtivo] = useState(monitorPendenciasAtivo);
  const [ultimaConferencia, setUltimaConferencia] = useState<Date | null>(null);
  const [saudeModulos, setSaudeModulos] = useState<EstadoServico[]>([]);
  const [permissaoNotificacao, setPermissaoNotificacao] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const primeiraVerificacao = useRef(true);
  const verificacaoEmCurso = useRef(false);
  const verificacaoSaudeEmCurso = useRef(false);
  const historicoSaudeServicos = useRef(new Map<string, HistoricoSaudeServico>());

  const verificarSaudeModulos = useCallback(async () => {
    if (verificacaoSaudeEmCurso.current) return;
    verificacaoSaudeEmCurso.current = true;
    try {
    const resultados = await Promise.all(MODULOS_MURADE.map(async servico => {
      const controlador = new AbortController();
      const timeout = window.setTimeout(() => controlador.abort(), 8000);
      try {
        const resposta = await fetch(new URL(servico.healthPath, servico.url), {
          headers: { Accept: 'application/json' },
          signal: controlador.signal
        });
        const tipo = resposta.headers.get('content-type') || '';
        if (!resposta.ok || !tipo.includes('application/json')) {
          return { id: servico.id, nome: servico.nome, estado: 'sem_confirmacao' as const, detalhe: `HTTP ${resposta.status} em ${servico.healthPath}; sem confirmação de saúde.` };
        }
        const dados = await resposta.json() as { status?: string };
        return dados.status === 'ok'
          ? { id: servico.id, nome: servico.nome, estado: 'disponivel' as const, detalhe: `Endpoint ${servico.healthPath} respondeu status ok.` }
          : { id: servico.id, nome: servico.nome, estado: 'sem_confirmacao' as const, detalhe: `Resposta de ${servico.healthPath} sem status ok.` };
      } catch {
        return { id: servico.id, nome: servico.nome, estado: 'sem_confirmacao' as const, detalhe: 'Sem confirmação: rede, CORS, timeout ou endpoint indisponível.' };
      } finally {
        window.clearTimeout(timeout);
      }
    }));

    const verificadoEm = new Date();
    const estadosComHistorico: EstadoServico[] = [];
    for (const resultado of resultados) {
      const anterior = historicoSaudeServicos.current.get(resultado.id) ?? {
        falhasConsecutivas: 0,
        ultimoSucessoEm: null,
        indisponibilidadeNotificada: false
      };
      if (resultado.estado === 'disponivel') {
        if (anterior.falhasConsecutivas >= 2 && anterior.indisponibilidadeNotificada && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('Murade — serviço voltou a responder', {
              body: `${resultado.nome}: ${resultado.detalhe}`,
              tag: `murade-health-${resultado.id}`
            });
          } catch { /* O estado permanece visível no monitor. */ }
        }
        const historico = { falhasConsecutivas: 0, ultimoSucessoEm: verificadoEm, indisponibilidadeNotificada: false };
        historicoSaudeServicos.current.set(resultado.id, historico);
        estadosComHistorico.push({ ...resultado, verificadoEm, ultimoSucessoEm: historico.ultimoSucessoEm });
        continue;
      }

      const falhasConsecutivas = anterior.falhasConsecutivas + 1;
      const notificar = anterior.ultimoSucessoEm !== null && falhasConsecutivas >= 2 && !anterior.indisponibilidadeNotificada;
      const historico = {
        falhasConsecutivas,
        ultimoSucessoEm: anterior.ultimoSucessoEm,
        indisponibilidadeNotificada: anterior.indisponibilidadeNotificada || notificar
      };
      historicoSaudeServicos.current.set(resultado.id, historico);
      estadosComHistorico.push({ ...resultado, verificadoEm, ultimoSucessoEm: historico.ultimoSucessoEm });
      if (notificar && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Murade — serviço sem confirmação', {
            body: `${resultado.nome}: ${falhasConsecutivas} verificações seguidas sem resposta confirmada. Pode ser rede, CORS ou endpoint; isso não prova que o serviço esteja fora do ar.`,
            tag: `murade-health-${resultado.id}`
          });
        } catch { /* O estado permanece visível no monitor. */ }
      }
    }
    setSaudeModulos(estadosComHistorico);
    } finally {
      verificacaoSaudeEmCurso.current = false;
    }
  }, []);

  const verificar = useCallback(async () => {
    if (verificacaoEmCurso.current) return;
    verificacaoEmCurso.current = true;
    try {
    if (erroEmpresas) {
      setAviso(`Monitoramento suspenso: ${erroEmpresas} A carteira não foi tratada como vazia e o histórico do monitor foi preservado.`);
      return;
    }
    const empresasComId = empresas.filter(empresa => Boolean(empresa.id || empresa.cnpj));
    const resultados = await Promise.all(empresasComId.map(empresa => assinaturaPendencias(empresa.id || empresa.cnpj, empresas)));
    const atual = resultados.flatMap(resultado => resultado.assinaturas);
    const documentosAtuais = [...new Set(resultados.flatMap(resultado => resultado.documentos))];
    const falhasLeitura = resultados.flatMap(resultado => resultado.falhasLeitura);
    const radar = resultados.reduce((total, resultado) => total + resultado.totalRadar, 0);
    const livro = resultados.reduce((total, resultado) => total + resultado.totalLivro, 0);
    const arquivosPendentes = resultados.reduce((total, resultado) => total + resultado.arquivosPendentes, 0);
    const guiasAbertas = resultados.reduce((total, resultado) => total + resultado.guiasAbertas, 0);
    const lembretesAtivos = resultados.reduce((total, resultado) => total + resultado.lembretesAtivos, 0);
    const cndRegistradas = resultados.reduce((total, resultado) => total + resultado.cndRegistradas, 0);
    const cndVencidas = resultados.reduce((total, resultado) => total + resultado.cndVencidas, 0);
    const cndProximas = resultados.reduce((total, resultado) => total + resultado.cndProximas, 0);
    const semDadosLocais = resultados.flatMap(resultado => resultado.semDadosLocais);
    const empresasComDados = resultados.filter(resultado => resultado.totalRadar + resultado.totalLivro + resultado.arquivosPendentes > 0).length;
    const resumo: EstadoMonitor = { totalEmpresas: empresasComId.length, empresasComDados, assinaturas: atual, documentos: documentosAtuais, totalRadar: radar, totalLivro: livro, arquivosPendentes, guiasAbertas, lembretesAtivos, cndRegistradas, cndVencidas, cndProximas, pendencias: atual.length, falhasLeitura, semDadosLocais };
    setEstado(resumo);
    setUltimaConferencia(new Date());

    if (falhasLeitura.length) {
      setAviso(`Monitoramento incompleto: ${falhasLeitura.join('; ')}. O histórico foi preservado e nenhuma pendência foi marcada como resolvida.`);
      return;
    }

    let anterior: string[] | null = null;
    let documentosAnteriores: string[] | null = null;
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      if (salvo !== null) {
        const historicoParseado: unknown = JSON.parse(salvo);
        if (Array.isArray(historicoParseado) && historicoParseado.every(item => typeof item === 'string')) {
          // Compatibilidade com a primeira versão, que guardava só as assinaturas.
          anterior = historicoParseado;
          const docsLegados = localStorage.getItem(DOCUMENTOS_STORAGE_KEY);
          const docsParseados: unknown = docsLegados ? JSON.parse(docsLegados) : null;
          if (docsLegados !== null && (!Array.isArray(docsParseados) || !docsParseados.every(item => typeof item === 'string'))) {
            throw new Error('formato do histórico de documentos inválido');
          }
          documentosAnteriores = Array.isArray(docsParseados) ? docsParseados : null;
        } else if (historicoParseado && typeof historicoParseado === 'object' && !Array.isArray(historicoParseado)) {
          const historico = historicoParseado as { assinaturas?: unknown; documentos?: unknown };
          if (!Array.isArray(historico.assinaturas) || !historico.assinaturas.every(item => typeof item === 'string')
            || !Array.isArray(historico.documentos) || !historico.documentos.every(item => typeof item === 'string')) {
            throw new Error('formato do histórico do monitor inválido');
          }
          anterior = historico.assinaturas;
          documentosAnteriores = historico.documentos;
        } else {
          throw new Error('formato do histórico do monitor inválido');
        }
      }
      // Um único setItem evita gravar as assinaturas sem os documentos ou vice-versa.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ assinaturas: atual, documentos: documentosAtuais }));
    } catch {
      setAviso('Não foi possível salvar o estado do monitor neste navegador.');
      return;
    }

    if (primeiraVerificacao.current) {
      if (!empresasComId.length) {
        setAviso('Monitor local ativo, mas ainda não há empresas cadastradas para conferir.');
        primeiraVerificacao.current = false;
      } else if (atual.length) {
        const texto = `Encontrei ${atual.length} item(ns) local(is) para revisar em ${empresasComId.length} empresa(s). ${resumoPendencias(atual, empresas)}. A conferência usa apenas dados locais e não confirma obrigações ou transmissões nos portais.`;
        setAviso(texto);
        if (anterior === null && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Murade Fiscal — itens para revisar', {
            body: `${texto} A conferência usa apenas os dados locais e não acessou portais oficiais.`,
            tag: 'murade-fiscal-pendencias-iniciais'
          });
        }
        primeiraVerificacao.current = false;
      } else if (semDadosLocais.length) {
        setAviso(`Conferência incompleta: ${semDadosLocais.length} empresa(s) ainda não têm notas importadas no Radar ou no livro local. Nenhum portal foi consultado.`);
        primeiraVerificacao.current = false;
      } else {
        setAviso('Conferência local concluída: nenhuma inconsistência estrutural foi encontrada nos XMLs e notas importados que este navegador conseguiu ler. Isso não confirma que não existam notas ausentes, obrigações pendentes ou avisos nos portais oficiais.');
        primeiraVerificacao.current = false;
      }
    }
    if (anterior === null) {
      return;
    }

    const conjuntoAnterior = new Set(anterior);
    const conjuntoAtual = new Set(atual);
    const novas = atual.filter(item => !conjuntoAnterior.has(item));
    const removidas = anterior.filter(item => !conjuntoAtual.has(item));
    if (novas.length) {
      const texto = `${novas.length} nova(s) pendência(s) detectada(s) nos dados locais: ${resumoPendencias(novas, empresas)}. A conferência não acessou portais oficiais.`;
      setAviso(texto);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Murade Fiscal — pendência para revisar', {
          body: `${texto} A consulta não acessou portais oficiais.`,
          tag: 'murade-fiscal-pendencias-carteira'
        });
      }
    } else if (removidas.length) {
      const texto = `${removidas.length} pendência(s) deixou(aram) de aparecer localmente. Confira antes de considerar resolvida.`;
      setAviso(texto);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Murade Fiscal — dados locais atualizados', {
          body: texto,
          tag: 'murade-fiscal-pendencias-atualizadas'
        });
      }
    }

    if (documentosAnteriores !== null) {
      const conjuntoDocumentosAnterior = new Set(documentosAnteriores);
      const documentosNovos = documentosAtuais.filter(item => !conjuntoDocumentosAnterior.has(item));
      if (documentosNovos.length) {
        const texto = `${documentosNovos.length} novo(s) documento(s) local(is) detectado(s). Isso não confirma download nem consulta à SEFAZ.`;
        if (!novas.length && !removidas.length) setAviso(texto);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Murade Fiscal — novos registros locais', {
            body: texto,
            tag: 'murade-fiscal-documentos-locais-novos'
          });
        }
      }
    }
    } catch (err) {
      console.error('Falha inesperada no monitor fiscal local:', err);
      setAviso('Não foi possível concluir a conferência local. O histórico anterior foi preservado e nenhum resultado oficial foi presumido.');
    } finally {
      verificacaoEmCurso.current = false;
    }
  }, [empresas, erroEmpresas]);

  const alternarMonitor = () => {
    const proximo = !ativo;
    if (!definirMonitorPendenciasAtivo(proximo)) {
      setAviso('Não foi possível alterar o monitor neste navegador.');
      return;
    }
    setAtivo(proximo);
    setAviso(proximo
      ? 'Monitor local ativado. Ele confere dados salvos neste navegador enquanto o Murade estiver aberto.'
      : 'Monitor local pausado. Nenhuma conferência automática será feita até reativá-lo.');
  };

  const ativarNotificacoes = async () => {
    if (!('Notification' in window)) {
      setPermissaoNotificacao('unsupported');
      setAviso('Este navegador não oferece notificações. Os avisos continuam visíveis dentro do Murade.');
      return;
    }
    try {
      const permissao = await Notification.requestPermission();
      setPermissaoNotificacao(permissao);
      if (permissao !== 'granted') {
        setAviso('O navegador não autorizou notificações. Os avisos continuam visíveis dentro do Murade.');
        return;
      }

      setAviso('Notificações do navegador ativadas para pendências locais. Nenhum portal oficial foi consultado.');
      if (estado.assinaturas.length) {
        const texto = `Há ${estado.assinaturas.length} item(ns) local(is) para revisar: ${resumoPendencias(estado.assinaturas, empresas)}. Esta conferência não consultou portais oficiais.`;
        try {
          new Notification('Murade Fiscal — itens locais para revisar', {
            body: texto,
            tag: 'murade-fiscal-pendencias-carteira'
          });
        } catch { /* O resumo continua visível no painel do monitor. */ }
      }
    } catch {
      setAviso('Não foi possível solicitar notificações neste navegador. Os avisos continuam visíveis dentro do Murade.');
    }
  };

  useEffect(() => {
    const sincronizarEstado = () => setAtivo(monitorPendenciasAtivo());
    window.addEventListener(EVENTO_MONITOR_PENDENCIAS_ATUALIZADO, sincronizarEstado);
    window.addEventListener('storage', sincronizarEstado);
    if (!ativo) return () => {
      window.removeEventListener(EVENTO_MONITOR_PENDENCIAS_ATUALIZADO, sincronizarEstado);
      window.removeEventListener('storage', sincronizarEstado);
    };
    verificar();
    void verificarSaudeModulos();
    const timer = window.setInterval(verificar, INTERVALO_VERIFICACAO);
    const timerSaude = window.setInterval(() => void verificarSaudeModulos(), INTERVALO_SAUDE_MODULOS);
    const aoRetornar = () => {
      if (document.visibilityState === 'visible') verificar();
    };
    window.addEventListener('fiscoia_empresa_atualizada', verificar);
    window.addEventListener(EVENTO_DADOS_FISCAIS_ATUALIZADOS, verificar);
    window.addEventListener(EVENTO_LEMBRETES_FISCAIS_ATUALIZADOS, verificar);
    window.addEventListener(EVENTO_CND_LOCAL_ATUALIZADA, verificar);
    window.addEventListener('storage', verificar);
    document.addEventListener('visibilitychange', aoRetornar);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(timerSaude);
      window.removeEventListener(EVENTO_MONITOR_PENDENCIAS_ATUALIZADO, sincronizarEstado);
      window.removeEventListener('storage', sincronizarEstado);
      window.removeEventListener('fiscoia_empresa_atualizada', verificar);
      window.removeEventListener(EVENTO_DADOS_FISCAIS_ATUALIZADOS, verificar);
      window.removeEventListener(EVENTO_LEMBRETES_FISCAIS_ATUALIZADOS, verificar);
      window.removeEventListener(EVENTO_CND_LOCAL_ATUALIZADA, verificar);
      window.removeEventListener('storage', verificar);
      document.removeEventListener('visibilitychange', aoRetornar);
    };
  }, [verificar, verificarSaudeModulos, ativo]);

  if (recolhido) {
    return (
      <button
        type="button"
        onClick={() => alternarRecolhido(false)}
        className="fixed bottom-16 right-3 z-[60] inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-950 shadow-md hover:bg-amber-100"
        aria-label="Abrir o painel do robô de conferência"
        title="Abrir o painel do robô de conferência"
      >
        <Bell className="h-3.5 w-3.5 text-amber-700" /> Robô de conferência
      </button>
    );
  }

  return (
    <aside className="fixed bottom-3 right-3 left-3 sm:left-auto sm:bottom-5 sm:right-5 z-[100] sm:max-w-sm max-h-[55vh] overflow-y-auto rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-xl" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        {estado.pendencias ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /> : <Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-bold">Robô de conferência local · {erroEmpresas ? 'suspenso' : ativo ? 'ativo' : 'pausado'}</div>
          {aviso && <p className="mt-1 text-xs">{aviso}</p>}
          <p className="mt-1 text-[11px] text-amber-800">Carteira: {estado.totalEmpresas} empresa(s) · {estado.empresasComDados} com registros locais · {estado.arquivosPendentes} arquivo(s) aguardando interpretação · {estado.guiasAbertas} guia(s) marcada(s) em aberto · {estado.lembretesAtivos} lembrete(s) ativo(s) · {estado.cndRegistradas} CND(s) cadastrada(s), {estado.cndVencidas} vencida(s) e {estado.cndProximas} próxima(s), por datas informadas · {estado.semDadosLocais.length} sem dados locais · {estado.falhasLeitura.length} falha(s) de leitura. {estado.totalRadar} XML(s) no Radar · {estado.totalLivro} nota(s) no livro · {estado.pendencias} alerta(s) local(is). A validade da CND não foi consultada no órgão emissor.</p>
          <p className="mt-1 text-[10px] text-amber-800">Última conferência: {ultimaConferencia ? ultimaConferencia.toLocaleTimeString('pt-BR') : 'ainda não realizada'} · Atualiza a cada 5 min com o sistema aberto.</p>
          <p className="mt-1 rounded border border-amber-300 bg-white/70 p-2 text-[10px] font-medium text-amber-950">Busca de notas em portais: não conectada. O robô só revisa XMLs e notas já salvos neste navegador; ele não consegue identificar documentos que ainda não foram importados nem consultar SEFAZ, Receita ou outros sites.</p>
          <p className="mt-1 text-[10px] text-amber-900">
            Módulos Murade: {saudeModulos.length ? saudeModulos.map(servico => `${servico.nome.replace('Murade ', '')} ${servico.estado === 'disponivel' ? 'respondendo' : `sem confirmação${servico.ultimoSucessoEm ? ` (última resposta ${servico.ultimoSucessoEm.toLocaleTimeString('pt-BR')})` : ' (sem resposta confirmada nesta sessão)'}`}`).join(' · ') : 'checando'}.
            {' '}Health check a cada 10 min; não confere portais oficiais nem sincronização fiscal.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={verificar} className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-1 text-[10px] font-bold"><RefreshCw className="h-3 w-3"/> Conferir agora</button>
            <button type="button" onClick={() => void verificarSaudeModulos()} className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-1 text-[10px] font-bold"><RefreshCw className="h-3 w-3"/> Verificar módulos</button>
            <button type="button" onClick={alternarMonitor} className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-1 text-[10px] font-bold">{ativo ? <Pause className="h-3 w-3"/> : <Play className="h-3 w-3"/>}{ativo ? 'Pausar' : 'Ativar'}</button>
            {permissaoNotificacao === 'granted'
              ? <span className="inline-flex items-center gap-1 px-1 py-1 text-[10px]"><Check className="h-3 w-3"/> Notificações ativas</span>
              : permissaoNotificacao === 'unsupported'
                ? <span className="px-1 py-1 text-[10px]">Notificações indisponíveis</span>
                : <button type="button" onClick={() => void ativarNotificacoes()} className="rounded border border-amber-300 bg-white px-2 py-1 text-[10px] font-bold">Ativar notificações</button>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setAviso(null); alternarRecolhido(true); }}
          className="rounded p-1 text-amber-800 hover:bg-amber-100"
          aria-label="Fechar painel do robô de conferência"
          title="Fechar (você pode reabrir pelo botão no canto da tela)"
        ><X className="h-4 w-4" /></button>
      </div>
    </aside>
  );
}
