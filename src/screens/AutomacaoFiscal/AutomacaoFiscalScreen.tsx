import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import { 
  ArrowLeft, 
  Cpu, 
  Bot, 
  Zap, 
  Activity,
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  FileText, 
  Receipt, 
  Upload, 
  Mail, 
  Building2, 
  Calendar, 
  Key, 
  ShieldCheck, 
  Send, 
  HelpCircle, 
  Check, 
  Copy, 
  ExternalLink, 
  Sliders, 
  FileSpreadsheet,
  Clock,
  Calculator,
  CreditCard,
  ArrowRight,
  Sparkles,
  Ban
} from 'lucide-react';
import { FISCOIA_FISCAL, lerNotasFiscaisEmpresa, vencimentoInformadoPassou } from '../../services/fiscal/fiscoiaFiscal.service';
import { conferirNotasRadar } from '../../services/fiscal/radarFiscal.service';
import { chaveNfeTemDigitoValido } from '../../services/fiscal/chaveNfe.service';
import { lerLivroFiscalEmpresa, lerRadarFiscalEmpresa } from '../../services/fiscal/empresaFiscalStorage.service';
import { ModalCalculadoraFiscal } from '../../components/ModalCalculadoraFiscal';
import { useEmpresa } from '../../context/EmpresaContext';
import { MODULOS_MURADE } from '../../config/modulosMurade';
import { definirMonitorPendenciasAtivo, EVENTO_MONITOR_PENDENCIAS_ATUALIZADO, monitorPendenciasAtivo } from '../../services/fiscal/monitorPendenciasFiscal.service';
import { ReformaTributariaScreen } from './ReformaTributariaScreen';

interface StatusServicoFiscal {
  id: string;
  nome: string;
  url: string;
  estado: 'verificando' | 'disponivel' | 'sem_confirmacao';
  detalhe: string;
  verificadoEm?: string;
  ultimaRespostaConfirmadaEm?: string;
  falhasConsecutivas?: number;
}

interface HistoricoSaudeModulo {
  falhasConsecutivas: number;
  ultimaRespostaConfirmadaEm: string | null;
  indisponibilidadeNotificada: boolean;
}

interface ItemLogAutoResolucao {
  id: string;
  tipo: 'sucesso' | 'tentativa' | 'erro';
  titulo: string;
  detalhe: string;
  hora: string;
  cliente: string;
}

function lerHistoricoLocal(chave: string): { existe: boolean; valores: string[] } {
  const raw = localStorage.getItem(chave);
  if (raw === null) return { existe: false, valores: [] };
  let parseado: unknown;
  try {
    parseado = JSON.parse(raw);
  } catch {
    throw new Error(`histórico local corrompido (${chave})`);
  }
  if (!Array.isArray(parseado) || !parseado.every(item => typeof item === 'string')) {
    throw new Error(`formato inválido no histórico local (${chave})`);
  }
  return { existe: true, valores: parseado };
}

export function AutomacaoFiscalScreen({
  onVoltar,
  onNavegar
}: {
  onVoltar?: () => void;
  onNavegar?: (destino: string) => void;
}) {
  const { empresaAtiva, empresas } = useEmpresa();
  // Aba ativa dentro da tela de automação
  const [abaInterna, setAbaInterna] = useState<
    'automacao' | 'dadosReais' | 'reforma' | 'ocr' | 'ia' | 'comparador' | 'autoresolucao' | 'dctf' | 'calendario' | 'certificado'
  >('automacao');

  // Estados dos Robôs Murade — Só Dados Reais
  const [resumoRobo1, setResumoRobo1] = useState<any>(null);
  const [resumoRobo2, setResumoRobo2] = useState<any>(null);
  const [radarAtivo, setRadarAtivo] = useState(monitorPendenciasAtivo);
  const [ultimaAuditoriaRadar, setUltimaAuditoriaRadar] = useState<string | null>(null);
  const [alertasRadar, setAlertasRadar] = useState<string[]>([]);
  const [alertasLivroFiscal, setAlertasLivroFiscal] = useState<string[]>([]);
  const [monitorarServicos, setMonitorarServicos] = useState(true);
  const [statusServicos, setStatusServicos] = useState<StatusServicoFiscal[]>(() =>
    MODULOS_MURADE.map(servico => ({
      id: servico.id,
      nome: servico.nome,
      url: servico.url,
      estado: 'verificando',
      detalhe: 'Aguardando primeira verificação.'
    }))
  );
  const historicoSaudeModulos = useRef(new Map<string, HistoricoSaudeModulo>());
  const verificacaoServicosEmCurso = useRef(false);
  const [permissaoNotificacao, setPermissaoNotificacao] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  useEffect(() => {
    const sincronizarEstadoRadar = () => setRadarAtivo(monitorPendenciasAtivo());
    window.addEventListener(EVENTO_MONITOR_PENDENCIAS_ATUALIZADO, sincronizarEstadoRadar);
    window.addEventListener('storage', sincronizarEstadoRadar);
    sincronizarEstadoRadar();
    return () => {
      window.removeEventListener(EVENTO_MONITOR_PENDENCIAS_ATUALIZADO, sincronizarEstadoRadar);
      window.removeEventListener('storage', sincronizarEstadoRadar);
    };
  }, []);

  const handleExecutarRobo1 = () => {
    const empresasComId = empresas.filter(empresa => Boolean(empresa.id || empresa.cnpj));
    if (!empresasComId.length) {
      setResumoRobo1({ resumo: 'Nenhuma empresa cadastrada para verificar.', total: 0, alertas: 0, detalhes: [] });
      return;
    }
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const documentosPorEmpresa = empresasComId.map(empresa => {
        const id = empresa.id || empresa.cnpj;
        try {
          const radar = lerRadarFiscalEmpresa(id, empresa.cnpj);
          if (radar.erro) throw new Error(radar.erro);
          const notasRadar = radar.notas;
          const leituraLivro = lerLivroFiscalEmpresa(id, empresa.cnpj);
          if (leituraLivro.erro) throw new Error(leituraLivro.erro);
          const notasLivro = [...leituraLivro.notas.saidas, ...leituraLivro.notas.entradas];
          const ocorrencias = conferirNotasRadar(notasRadar);
          const detalhesRadar = notasRadar.flatMap(nota =>
            (ocorrencias.get(nota.chave || `${nota.origemArquivo}-${nota.numero}`) ?? []).map(item => ({
              empresa: empresa.razaoSocial,
              numero: nota.numero || 'sem número',
              chave: nota.chave || 'sem chave',
              mensagem: item.mensagem,
              severidade: item.severidade
            }))
          );
          const vencidas = FISCOIA_FISCAL.BAIXA_NOTAS.verificarVencidas(notasLivro, hoje);
          const proximas = FISCOIA_FISCAL.BAIXA_NOTAS.verificarVencimentosProximos(notasLivro, hoje);
          const detalhesVencimento = [
            ...vencidas.map(nota => ({
            empresa: empresa.razaoSocial,
            numero: nota.numero || 'sem número',
            chave: nota.chave || 'sem chave',
            mensagem: `Vencimento informado em ${nota.dataVencimento} passou; confirme a baixa.`,
            severidade: 'ATENCAO' as const
            })),
            ...proximas.map(nota => ({
              empresa: empresa.razaoSocial,
              numero: nota.numero || 'sem número',
              chave: nota.chave || 'sem chave',
              mensagem: `Vencimento informado em ${nota.dataVencimento} ocorre nos próximos 7 dias; confira o pagamento.`,
              severidade: 'ATENCAO' as const
            }))
          ];
          return {
            id, erro: null as string | null, documentos: notasRadar.length,
            chaves: notasRadar.map(nota => `${id}:${nota.chave || `${nota.origemArquivo}-${nota.numero}`}`),
            detalhes: [...detalhesRadar, ...detalhesVencimento],
            assinaturas: [...detalhesRadar.map(item => `${id}:${item.chave}:${item.mensagem}`),
              ...vencidas.map(nota => `${id}:VENCIDA:${nota.chave || nota.numero}:${nota.dataVencimento}`),
              ...proximas.map(nota => `${id}:PROXIMA:${nota.chave || nota.numero}:${nota.dataVencimento}`)]
          };
        } catch (error) {
          return { id, erro: `${empresa.razaoSocial || empresa.cnpj}: ${error instanceof Error ? error.message : 'falha de leitura'}`, documentos: 0, chaves: [], detalhes: [], assinaturas: [] };
        }
      });
      const falhas = documentosPorEmpresa.filter(item => item.erro);
      const lidas = documentosPorEmpresa.filter(item => !item.erro);
      const totalDocumentos = lidas.reduce((total, item) => total + item.documentos, 0);
      const todosDetalhes = lidas.flatMap(item => item.detalhes);
      const alertasLocais = lidas.flatMap(item => item.assinaturas);
      const chavesNotasAtuais = lidas.flatMap(item => item.chaves);
      if (falhas.length) {
        const mensagensFalha = falhas.map(item => item.erro as string);
        const detalhesFalha = falhas.map(item => {
          const empresa = empresasComId.find(candidata => (candidata.id || candidata.cnpj) === item.id);
          return {
            empresa: empresa?.razaoSocial || empresa?.cnpj || 'Empresa',
            numero: '—',
            chave: '—',
            mensagem: `Leitura não concluída: ${item.erro}`,
            severidade: 'ERRO' as const
          };
        });
        // Os alertas visíveis pertencem à última leitura completa. Não os
        // substitua por resultados parciais, pois isso esconderia achados das
        // empresas cuja leitura falhou e poderia parecer uma resolução.
        setResumoRobo1({
          empresas: empresasComId.length, empresasLidas: lidas.length, total: totalDocumentos,
          alertas: todosDetalhes.length, detalhes: [...todosDetalhes, ...detalhesFalha],
          resumo: `Conferência parcial: ${lidas.length}/${empresasComId.length} empresa(s) lida(s). ${mensagensFalha.join('; ')}. O histórico não foi atualizado.`
        });
        setUltimaAuditoriaRadar(new Date().toLocaleString('pt-BR'));
        return;
      }
      const chaveNotasVistas = 'fiscoia_radar_notas_vistas_carteira';
      const notasVistasAntes = lerHistoricoLocal(chaveNotasVistas);
      const notasAnteriores = new Set(notasVistasAntes.valores);
      const notasNovas = notasVistasAntes.existe
        ? chavesNotasAtuais.filter(chave => !notasAnteriores.has(chave))
        : [];
      const chaveAlertasNotificados = 'fiscoia_radar_notificados_carteira';
      const alertasAntes = lerHistoricoLocal(chaveAlertasNotificados);
      const anteriores = new Set(alertasAntes.valores);
      const novos = alertasLocais.filter(item => !anteriores.has(item));
      const resolvidos = alertasAntes.existe
        ? alertasAntes.valores.filter(item => !alertasLocais.includes(item)).length
        : 0;

      // Persistir todo o estado antes de anunciar uma conferência concluída.
      localStorage.setItem(chaveNotasVistas, JSON.stringify(chavesNotasAtuais));
      localStorage.setItem(chaveAlertasNotificados, JSON.stringify(alertasLocais));

      if (alertasLocais.length) {
        if (novos.length && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification('Radar fiscal — carteira de empresas', {
              body: `${novos.length} novo(s) achado(s) em dados locais. Portais oficiais não foram consultados.`,
              tag: 'radar-auto-carteira'
            });
          } catch { /* O relatório continua disponível dentro do aplicativo. */ }
        }
        if (resolvidos && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification('Radar fiscal — pendência local atualizada', {
              body: `${resolvidos} pendência(s) deixou(aram) de aparecer nos dados locais. Confira antes de considerar resolvida.`,
              tag: 'radar-auto-carteira-resolvidos'
            });
          } catch { /* O relatório continua disponível dentro do aplicativo. */ }
        }
        setAlertasRadar([
          ...todosDetalhes.map(item => `${item.empresa} · NF ${item.numero}: ${item.mensagem}`)
        ]);
      } else {
        setAlertasRadar([]);
      }
      if (notasNovas.length && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification('Radar fiscal — XML novo para revisar', {
            body: `${notasNovas.length} XML(s) novo(s) detectado(s) nos arquivos locais. O Radar não consultou nem autenticou a SEFAZ.`,
            tag: 'radar-xml-novo-carteira'
          });
        } catch { /* O relatório continua disponível dentro do aplicativo. */ }
      }
      setResumoRobo1({
        empresas: empresasComId.length,
        total: totalDocumentos,
        alertas: todosDetalhes.length,
        notasNovas: notasNovas.length,
        detalhes: todosDetalhes,
        resumo: totalDocumentos || todosDetalhes.length
          ? `Verificadas ${empresasComId.length} empresa(s): ${totalDocumentos} XML(s), ${todosDetalhes.length} alerta(s) local(is). Portais oficiais não consultados.`
          : `${empresasComId.length} empresa(s) cadastrada(s), sem XML no Radar ou vencimento informado para conferir. Isso não confirma ausência de obrigações.`
      });
      setUltimaAuditoriaRadar(new Date().toLocaleString('pt-BR'));
    } catch (error) {
      setResumoRobo1({ resumo: `Conferência parcial: não foi possível validar ou salvar o histórico local (${error instanceof Error ? error.message : 'erro desconhecido'}). Revise os dados; nenhum portal oficial foi consultado.` });
    }
  };

  const verificarServicosMurade = async () => {
    if (verificacaoServicosEmCurso.current) return null;
    verificacaoServicosEmCurso.current = true;
    try {
    const resultados = await Promise.all(MODULOS_MURADE.map(async servico => {
      const aborter = new AbortController();
      const timeout = window.setTimeout(() => aborter.abort(), 8000);
      try {
        const resposta = await fetch(new URL('/api/health', servico.url), {
          headers: { Accept: 'application/json' },
          signal: aborter.signal
        });
        const tipo = resposta.headers.get('content-type') || '';
        if (!resposta.ok || !tipo.includes('application/json')) {
          return {
            id: servico.id,
            nome: servico.nome,
            url: servico.url,
            estado: 'sem_confirmacao' as const,
            detalhe: `Health check respondeu HTTP ${resposta.status}, sem confirmação válida.`
          };
        }
        const dados = await resposta.json() as { status?: string };
        return dados.status === 'ok'
          ? { id: servico.id, nome: servico.nome, url: servico.url, estado: 'disponivel' as const, detalhe: 'Endpoint de saúde respondeu status ok.' }
          : { id: servico.id, nome: servico.nome, url: servico.url, estado: 'sem_confirmacao' as const, detalhe: 'Resposta sem status ok.' };
      } catch {
        return {
          id: servico.id,
          nome: servico.nome,
          url: servico.url,
          estado: 'sem_confirmacao' as const,
          detalhe: 'Sem confirmação (rede, CORS, timeout ou endpoint indisponível).'
        };
      } finally {
        window.clearTimeout(timeout);
      }
    }));

    const agora = new Date().toLocaleString('pt-BR');
    const atualizados: StatusServicoFiscal[] = resultados.map(resultado => {
      const anterior = historicoSaudeModulos.current.get(resultado.id) ?? {
        falhasConsecutivas: 0,
        ultimaRespostaConfirmadaEm: null,
        indisponibilidadeNotificada: false
      };
      if (resultado.estado === 'disponivel') {
        if (anterior.falhasConsecutivas >= 2 && anterior.indisponibilidadeNotificada && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification('Murade: serviço voltou a responder', {
              body: `${resultado.nome}: /api/health respondeu status ok novamente.`,
              tag: `murade-health-${resultado.id}`
            });
          } catch { /* O estado continua visível no painel. */ }
        }
        historicoSaudeModulos.current.set(resultado.id, {
          falhasConsecutivas: 0,
          ultimaRespostaConfirmadaEm: agora,
          indisponibilidadeNotificada: false
        });
        return { ...resultado, verificadoEm: agora, ultimaRespostaConfirmadaEm: agora, falhasConsecutivas: 0 };
      }

      const falhasConsecutivas = anterior.falhasConsecutivas + 1;
      const notificar = anterior.ultimaRespostaConfirmadaEm !== null && falhasConsecutivas >= 2 && !anterior.indisponibilidadeNotificada;
      historicoSaudeModulos.current.set(resultado.id, {
        falhasConsecutivas,
        ultimaRespostaConfirmadaEm: anterior.ultimaRespostaConfirmadaEm,
        indisponibilidadeNotificada: anterior.indisponibilidadeNotificada || notificar
      });
      if (notificar && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification('Murade: serviço sem confirmação', {
            body: `${resultado.nome}: ${falhasConsecutivas} verificações seguidas sem resposta confirmada. Rede, CORS ou timeout não comprovam indisponibilidade.`,
            tag: `murade-health-${resultado.id}`
          });
        } catch { /* O estado continua visível no painel. */ }
      }
      return {
        ...resultado,
        verificadoEm: agora,
        ultimaRespostaConfirmadaEm: anterior.ultimaRespostaConfirmadaEm ?? undefined,
        falhasConsecutivas
      };
    });
    setStatusServicos(atualizados);
    return resultados;
    } finally {
      verificacaoServicosEmCurso.current = false;
    }
  };

  const verificarDisponibilidadeAgora = async () => {
    const resultados = await verificarServicosMurade();
    if (!resultados) {
      setNotificacao({ tipo: 'info', texto: 'Já existe uma verificação técnica em andamento; aguarde o resultado exibido no painel.' });
      return;
    }
    const disponiveis = resultados.filter(resultado => resultado.estado === 'disponivel').length;
    setNotificacao({
      tipo: disponiveis === resultados.length ? 'sucesso' : 'alerta',
      texto: `Health check concluído: ${disponiveis}/${resultados.length} endpoints responderam. Isso confirma somente disponibilidade técnica, não integração nem sincronização fiscal.`
    });
  };

  useEffect(() => {
    if (!monitorarServicos) return;
    void verificarServicosMurade();
    const timer = window.setInterval(() => void verificarServicosMurade(), 10 * 60 * 1000);
    const aoRetornarParaPagina = () => {
      if (document.visibilityState === 'visible') void verificarServicosMurade();
    };
    document.addEventListener('visibilitychange', aoRetornarParaPagina);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', aoRetornarParaPagina);
    };
  }, [monitorarServicos]);

  const ativarNotificacoesRobos = async () => {
    if (typeof Notification === 'undefined') {
      setPermissaoNotificacao('unsupported');
      return;
    }
    const permissao = await Notification.requestPermission();
    setPermissaoNotificacao(permissao);
  };

  // Auditoria estrutural local de toda a carteira; não valida apuração legal nem consulta fonte oficial.
  const handleExecutarRobo2 = () => {
    const empresasComId = empresas.filter(empresa => Boolean(empresa.id || empresa.cnpj));
    if (!empresasComId.length) {
      setResumoRobo2({ erro: 'Nenhuma empresa cadastrada para auditar os livros locais.' });
      setAlertasLivroFiscal([]);
      return;
    }

    const resultados = empresasComId.map(empresa => {
      const idEmpresa = empresa.id || empresa.cnpj;
      const leitura = lerLivroFiscalEmpresa(idEmpresa, empresa.cnpj);
      if (leitura.erro) return { empresa, documentos: 0, inconsistencias: [], erro: leitura.erro, erroHistorico: null as string | null };
      const livro = leitura.notas;
      const documentos = [...livro.saidas, ...livro.entradas];
      const inconsistencias = documentos.flatMap(nota => {
        const problemas: string[] = [];
        if (!chaveNfeTemDigitoValido(nota.chave || '')) problemas.push('chave de acesso ausente ou inválida');
        if (!nota.cfop) problemas.push('CFOP ausente');
        if (nota.camposNumericosIndisponiveis?.includes('VNF') || !Number.isFinite(nota.valorTotal) || nota.valorTotal <= 0) problemas.push('valor total ausente, inválido ou não positivo');
        for (const [nome, valor] of [['ICMS', nota.ICMS_valor], ['PIS', nota.PIS_valor], ['COFINS', nota.COFINS_valor]] as const) {
          if (nota.camposNumericosIndisponiveis?.includes(nome) || !Number.isFinite(valor) || valor < 0) problemas.push(`${nome} ausente ou inválido na origem`);
        }
        return problemas.length
          ? [{ empresa: empresa.razaoSocial || empresa.cnpj || 'Empresa sem nome', numero: nota.numero, chave: nota.chave, problemas }]
          : [];
      });
      const assinaturaAtual = inconsistencias.map(item => `${item.chave || item.numero}:${item.problemas.join(',')}`);
      const chaveAvisos = `fiscoia_livro_notificados_${idEmpresa}`;
      let erroHistorico: string | null = null;
      try {
        const avisoAnterior = localStorage.getItem(chaveAvisos);
        const historicoParseado: unknown = avisoAnterior ? JSON.parse(avisoAnterior) : [];
        if (!Array.isArray(historicoParseado) || !historicoParseado.every(item => typeof item === 'string')) {
          throw new Error('formato do histórico de alertas inválido');
        }
        const assinaturaAnterior = historicoParseado as string[];
        const novasInconsistencias = assinaturaAtual.filter(item => !assinaturaAnterior.includes(item));
        const resolvidas = avisoAnterior
          ? assinaturaAnterior.filter(item => !assinaturaAtual.includes(item)).length
          : 0;
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            if (novasInconsistencias.length) new Notification(`Livro fiscal — ${empresa.razaoSocial || 'empresa'}`, {
              body: `${novasInconsistencias.length} nova(s) nota(s) com campos para revisão. Conferência local, sem validação tributária oficial.`,
              tag: `livro-fiscal-${idEmpresa}`
            });
            if (resolvidas) new Notification(`Livro fiscal — ${empresa.razaoSocial || 'empresa'}`, {
              body: `${resolvidas} inconsistência(s) deixou(aram) de aparecer nos dados locais. Confira antes de considerar resolvida.`,
              tag: `livro-fiscal-resolvido-${idEmpresa}`
            });
          } catch {
            erroHistorico = 'o navegador não conseguiu exibir uma notificação';
          }
        }
        localStorage.setItem(chaveAvisos, JSON.stringify(assinaturaAtual));
      } catch (error) {
        erroHistorico = error instanceof Error ? error.message : 'não foi possível atualizar o histórico local';
      }
      return { empresa, documentos: documentos.length, inconsistencias, erro: null as string | null, erroHistorico };
    });

    const lidas = resultados.filter(resultado => !resultado.erro);
    const falhas = resultados.filter(resultado => resultado.erro);
    const inconsistencias = lidas.flatMap(resultado => resultado.inconsistencias);
    const totalDocumentos = lidas.reduce((total, resultado) => total + resultado.documentos, 0);
    setAlertasLivroFiscal([
      ...inconsistencias.map(item => `${item.empresa} · NF ${item.numero || 'sem número'}: ${item.problemas.join('; ')}`),
      ...falhas.map(resultado => `${resultado.empresa.razaoSocial || resultado.empresa.cnpj}: livro não lido (${resultado.erro})`),
      ...lidas.filter(resultado => resultado.erroHistorico).map(resultado => `${resultado.empresa.razaoSocial || resultado.empresa.cnpj}: auditoria concluída, mas ${resultado.erroHistorico}; achados continuam visíveis.`)
    ]);
    setResumoRobo2({
      empresas: empresasComId.length,
      empresasLidas: lidas.length,
      empresasComFalha: falhas.length,
      total: totalDocumentos,
      inconsistencias,
      status: 'Conferência estrutural local da carteira',
      mensagem: falhas.length
        ? `Auditoria parcial: ${lidas.length}/${empresasComId.length} livro(s) lido(s), ${falhas.length} com falha. ${totalDocumentos} nota(s) revisada(s), ${inconsistencias.length} com campos para conferir.`
        : totalDocumentos
          ? `${totalDocumentos} nota(s) em ${lidas.length} empresa(s) revisada(s); ${inconsistencias.length} com campo(s) para conferir. Não foi validada regra fiscal oficial.`
          : `${lidas.length} empresa(s) verificada(s), sem notas nos livros locais. Isso não confirma ausência de documentos ou obrigações.`
    });
  };

  const handleAuditarFechamentoLocal = () => {
    if (!empresaAtiva?.id) {
      setNotificacao({ tipo: 'alerta', texto: 'Selecione uma empresa para verificar o livro local.' });
      return;
    }
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = String(hoje.getFullYear());
    const periodo = `${ano}-${mes}`;
    const leitura = lerNotasFiscaisEmpresa(empresaAtiva.id);
    if ('erro' in leitura) {
      setNotificacao({ tipo: 'alerta', texto: `Conferência não realizada: livro local indisponível (${leitura.erro}). Os dados foram preservados e não foram tratados como zero.` });
      return;
    }
    const livro = leitura.notas;
    const saidas = livro.saidas.filter(nota => nota.dataEmissao?.startsWith(periodo));
    const entradas = livro.entradas.filter(nota => nota.dataEmissao?.startsWith(periodo));
    const resumo = FISCOIA_FISCAL.resumirTributosInformados(saidas, entradas, mes, ano);
    setNotificacao({
      tipo: 'info',
      texto: `Conferência local ${resumo.periodo}: ${saidas.length} saída(s) e ${entradas.length} entrada(s). Campos tributários dos arquivos foram resumidos separadamente por operação. Nenhuma compensação ou apuração legal foi feita.`
    });
  };

  // Modal da Calculadora Fiscal
  const [modalCalculadoraAberto, setModalCalculadoraAberto] = useState(false);

  // Relógio da tela; não representa horário de consulta nem auditoria.
  const [horaLocal, setHoraLocal] = useState(() => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

  // Interruptores da Automação Fiscal (As 5 Etapas)
  // Mensagens de Sucesso / Alerta
  const [notificacao, setNotificacao] = useState<{ tipo: 'sucesso' | 'alerta' | 'info'; texto: string } | null>(null);

  // ----------------------------------------------------
  // ESTADOS DO RECURSO: REFORMA TRIBUTÁRIA IBS / CBS
  // ----------------------------------------------------
  // ----------------------------------------------------
  // ESTADOS DO RECURSO: OCR INTELIGENTE & XML E-MAIL
  // ----------------------------------------------------
  // ----------------------------------------------------
  // ESTADOS DO RECURSO: ASSISTENTE IA FISCAL
  // ----------------------------------------------------
  const [mensagensChat, setMensagensChat] = useState<Array<{ autor: 'usuario' | 'ia'; texto: string }>>([
    {
      autor: 'ia',
      texto: 'Olá. As consultas fiscais serão respondidas somente quando a fonte atual puder ser verificada. Se a conexão não estiver disponível, vou avisar.'
    }
  ]);
  const [perguntaInput, setPerguntaInput] = useState('');

  // ----------------------------------------------------
  // ESTADOS DO RECURSO: COMPARADOR DE REGIMES TRIBUTÁRIOS
  // ----------------------------------------------------

  // ----------------------------------------------------
  // LOGS DE AUTO-RESOLUÇÃO (Tenta 5x antes de avisar)
  // ----------------------------------------------------
  const [logsAutoResolucao] = useState<ItemLogAutoResolucao[]>([]);

  // Atualiza horário em tempo real
  useEffect(() => {
    const atualizar = () => {
      const d = new Date();
      setHoraLocal(d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    };
    atualizar();
    const interval = setInterval(atualizar, 60000);
    return () => clearInterval(interval);
  }, []);

  // Conferência permanece indisponível sem dados autenticados de origem.
  const handleConferirTudo = async () => {
    setNotificacao({
      tipo: 'alerta',
      texto: 'Conferência não realizada: não há dados autenticados da SEFAZ ou de outro sistema conectado.'
    });
  };

  // O OCR ainda não está conectado a um serviço de extração.
  const handleUploadOcr = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      e.target.value = '';
      setNotificacao({ tipo: 'alerta', texto: 'Arquivo não processado: o serviço de OCR ainda não está configurado.' });
    }
  };

  // Enviar pergunta para a IA
  const handleEnviarPergunta = async (texto?: string) => {
    const q = texto || perguntaInput.trim();
    if (!q) return;

    const novasMensagens = [...mensagensChat, { autor: 'usuario' as const, texto: q }];
    setMensagensChat(novasMensagens);
    setPerguntaInput('');

    try {
      const response = await fetch('/api/ia-fiscal/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // O servidor recebe somente o histórico anterior. A pergunta atual
        // vai no campo separado, como no chat fiscal principal.
        body: JSON.stringify({ pergunta: q, historico: mensagensChat })
      });
      const resultado = await response.json();
      setMensagensChat(prev => [...prev, {
        autor: 'ia',
        texto: response.ok && resultado.resposta
          ? `${resultado.resposta}${resultado.fontesWeb?.length ? `\n\nFontes: ${resultado.fontesWeb.map((fonte: { title?: string; uri: string }) => fonte.title || fonte.uri).join(', ')}` : ''}`
          : resultado.erro || resultado.resposta || 'Não consegui consultar uma fonte nesta tentativa. Não vou afirmar a regra sem confirmação.'
      }]);
    } catch {
      setMensagensChat(prev => [...prev, { autor: 'ia', texto: 'Não foi possível consultar o serviço agora. Nenhum prazo ou valor foi confirmado.' }]);
    }
  };

  // Cálculo de economia no comparador

  return (
    <div id="tela-automacao-fiscal-murade" className="max-w-6xl mx-auto space-y-5 pb-16">
      {/* 🧭 CABEÇALHO COM BOTÃO DE VOLTAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          {onVoltar && (
            <button
              type="button"
              onClick={onVoltar}
              title="Voltar para a tela anterior"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-[#0F2B5B] flex items-center gap-2">
                <span>🤖⚡ AUTOMAÇÃO FISCAL — MURADE FISCAL</span>
              </h1>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                Conexões pendentes
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Painel em modo independente. Emissão, consulta oficial, apuração e transmissão não estão conectadas.
            </p>
          </div>
        </div>

        {/* Ações e Status Geral do Robô */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setModalCalculadoraAberto(true)}
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold rounded-xl text-xs flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
          >
            <Calculator className="w-4 h-4 text-amber-600" />
            <span>Calculadora de estimativas</span>
          </button>

          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="font-black text-amber-800">INTEGRAÇÕES PENDENTES</span>
            </div>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-medium">
              Hora local: <strong className="text-slate-800">{horaLocal}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* NOTIFICAÇÃO DINÂMICA */}
      {notificacao && (
        <div 
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 shadow-xs animate-in fade-in ${
            notificacao.tipo === 'sucesso' 
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
              : notificacao.tipo === 'alerta' 
              ? 'bg-amber-50 border-amber-300 text-amber-900' 
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notificacao.tipo === 'sucesso' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {notificacao.tipo === 'alerta' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
            {notificacao.tipo === 'info' && <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 animate-spin" />}
            <span>{notificacao.texto}</span>
          </div>
          <button 
            onClick={() => setNotificacao(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 📑 NAVEGAÇÃO DE ABAS INTERNAS */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 pb-1 scrollbar-none">
        {[
          { id: 'automacao', rotulo: '🤖 Tarefas fiscais', icone: Cpu },
          { id: 'dadosReais', rotulo: '🛡️ Conferência (SEFAZ)', icone: ShieldCheck, badge: 'Não conectado' },
          { id: 'reforma', rotulo: '⚖️ Reforma IBS/CBS', icone: Receipt },
          { id: 'ocr', rotulo: '📸 OCR / XML E-mail', icone: Upload },
          { id: 'ia', rotulo: '🧠 Assistente IA', icone: Bot },
          { id: 'comparador', rotulo: '💰 Comparador de Regime', icone: FileSpreadsheet },
          { id: 'autoresolucao', rotulo: '🔧 Histórico de automação', icone: Zap },
          { id: 'dctf', rotulo: '📋 DCTF Web', icone: FileText },
          { id: 'calendario', rotulo: '📅 Calendário fiscal', icone: Calendar },
          { id: 'certificado', rotulo: '🔑 Certificado digital', icone: Key }
        ].map(tab => {
          const Icone = tab.icone;
          const ativa = abaInterna === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAbaInterna(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                ativa 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <Icone className="w-3.5 h-3.5" />
              <span>{tab.rotulo}</span>
              {tab.badge && (
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                  ativa ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* ABA 1: AUTOMAÇÃO FISCAL PRINCIPAL (OS 3 PAINÉIS + FILA + ALERTAS) */}
      {/* ============================================================== */}
      {abaInterna === 'automacao' && (
        <div className="space-y-5 animate-in fade-in">
          {/* BANNER DE INFORMAÇÃO */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-black">
                Painel de tarefas fiscais
              </h2>
              <p className="text-xs text-blue-200 mt-0.5">
                O Radar local confere XMLs e vencimentos periodicamente enquanto esta tela fica aberta. Busca oficial de notas, emissão e transmissão ainda não estão conectadas.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void verificarDisponibilidadeAgora()}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <span>Testar resposta técnica</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Resumo dos dados fiscais locais</h3>
                <p className="text-xs text-slate-600 mt-1">Os totais vêm do livro salvo neste navegador para a empresa ativa. Não representam consulta à SEFAZ nem apuração oficial.</p>
              </div>
              <button type="button" onClick={handleAuditarFechamentoLocal} disabled={!empresaAtiva?.id} className="px-3 py-2 bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-50">Conferir mês atual</button>
            </div>
            {empresaAtiva?.id ? (() => {
              const hoje = new Date();
              const periodo = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
              const leitura = lerNotasFiscaisEmpresa(empresaAtiva.id);
              if ('erro' in leitura) return <p className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs">Livro fiscal local indisponível ({leitura.erro}). Totais e pendências não podem ser apresentados; os dados armazenados foram preservados.</p>;
              const livro = leitura.notas;
              const saidas = livro.saidas.filter(nota => nota.dataEmissao?.startsWith(periodo));
              const entradas = livro.entradas.filter(nota => nota.dataEmissao?.startsWith(periodo));
              // `PAGA` é um estado legado sem comprovante. Só o registro manual
              // atual com valor integral pode retirar a nota das pendências locais.
              const pendentes = [...livro.saidas, ...livro.entradas].filter(nota => nota.status !== 'PAGA_INFORMADA');
              const vencidas = pendentes.filter(nota => vencimentoInformadoPassou(nota.dataVencimento, hoje));
              const resumo = FISCOIA_FISCAL.resumirTributosInformados(saidas, entradas, String(hoje.getMonth() + 1).padStart(2, '0'), String(hoje.getFullYear()));
              return <div className="space-y-2">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border"><div className="text-[11px] text-slate-600">Notas de saída no mês</div><strong>{saidas.length}</strong></div>
                  <div className="p-3 rounded-xl bg-slate-50 border"><div className="text-[11px] text-slate-600">Notas de entrada no mês</div><strong>{entradas.length}</strong></div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200"><div className="text-[11px] text-amber-900">Notas vencidas não baixadas</div><strong>{vencidas.length}</strong></div>
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200"><div className="text-[11px] text-blue-900">Campos informados: ICMS nas saídas / entradas</div><strong>R$ {resumo.totalSaida.ICMS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / R$ {resumo.totalEntrada.ICMS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
                </div>
                <p role="note" className="text-[10px] text-slate-600">{resumo.status} O resumo não é apuração legal.</p>
              </div>;
            })() : <p className="p-3 rounded-lg bg-amber-50 text-amber-900 text-xs">Selecione uma empresa para ver os registros locais.</p>}
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">Busca de notas, transmissão de NF-e, conciliação bancária, apuração legal e emissão de guias dependem de integrações externas ainda não configuradas.</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Monitor de resposta técnica dos módulos</h3>
                <p className="text-xs text-slate-600 mt-1">Consulta /api/health nos três serviços Murade a cada 10 minutos enquanto esta página estiver aberta. Isso não verifica portais governamentais nem sincroniza dados.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setMonitorarServicos(ativo => !ativo)} className="px-3 py-2 rounded-lg border text-xs font-bold">
                  {monitorarServicos ? 'Pausar monitoramento' : 'Retomar monitoramento'}
                </button>
                <button type="button" onClick={() => void verificarDisponibilidadeAgora()} className="px-3 py-2 rounded-lg bg-blue-700 text-white text-xs font-bold">Verificar agora</button>
                <button type="button" onClick={() => void ativarNotificacoesRobos()} disabled={permissaoNotificacao === 'granted' || permissaoNotificacao === 'unsupported'} className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs font-bold disabled:opacity-60">
                  {permissaoNotificacao === 'granted' ? 'Notificações ativadas' : permissaoNotificacao === 'unsupported' ? 'Notificações indisponíveis' : 'Ativar notificações'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {statusServicos.map(servico => (
                <div key={servico.id} className="p-3 rounded-xl border bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-xs text-slate-900">{servico.nome}</strong>
                    <span className={`text-[10px] font-bold ${servico.estado === 'disponivel' ? 'text-emerald-700' : 'text-amber-800'}`}>
                      {servico.estado === 'disponivel' ? 'Servidor respondeu' : servico.estado === 'verificando' ? 'Verificando' : 'Sem confirmação'}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600">{servico.detalhe}</div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    {servico.verificadoEm || 'Ainda não verificado'} · health check apenas
                    {servico.estado === 'sem_confirmacao' && servico.ultimaRespostaConfirmadaEm
                      ? ` · última resposta confirmada: ${servico.ultimaRespostaConfirmadaEm}`
                      : servico.estado === 'sem_confirmacao' ? ' · nenhuma resposta confirmada nesta sessão' : ''}
                    {servico.falhasConsecutivas ? ` · ${servico.falhasConsecutivas} falha(s) seguida(s)` : ''}
                  </div>
                </div>
              ))}
            </div>
            {alertasRadar.length > 0 && (
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50">
                <strong className="text-xs text-amber-950">Alertas do Radar — última conferência completa</strong>
                <ul className="mt-2 space-y-1 text-[11px] text-amber-900">{alertasRadar.map((alerta, indice) => <li key={`${indice}-${alerta}`}>{alerta}</li>)}</ul>
              </div>
            )}
            {alertasLivroFiscal.length > 0 && (
              <div className="p-3 rounded-xl border border-orange-200 bg-orange-50">
                <strong className="text-xs text-orange-950">Campos do livro que precisam de revisão</strong>
                <ul className="mt-2 space-y-1 text-[11px] text-orange-900">{alertasLivroFiscal.map((alerta, indice) => <li key={`${indice}-${alerta}`}>{alerta}</li>)}</ul>
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50/40 p-5 space-y-2">
            <h3 className="text-sm font-bold text-amber-950">Robôs fiscais — operações não executadas</h3>
            <p className="text-xs text-amber-900">Busca de notas, transmissão de NF-e, conciliação bancária, apuração oficial e emissão de guias não estão conectadas. Esta tela não executa nem agenda essas tarefas.</p>
            <p className="text-[11px] text-slate-700">Para iniciar essas operações, faltam APIs autenticadas dos órgãos e dos serviços Murade, certificado habilitado no servidor e integração bancária quando necessária.</p>
          </div>
          {/* ⚠️ ALERTAS — O QUE O CONTADOR PRECISA CONFERIR */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>🔔</span>
              <span>Avisos para Conferência — Contador</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-amber-50 border-l-4 border-amber-500 flex items-start gap-2.5">
                <span className="text-base">⚠️</span>
                <div>
                  <strong className="text-amber-900">Emissão SEFAZ não configurada</strong>
                  <p className="text-amber-800 mt-0.5">Esta tela não transmite notas à SEFAZ.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border-l-4 border-amber-500 flex items-start gap-2.5">
                <span className="text-base">⚠️</span>
                <div>
                  <strong className="text-amber-900">Consulta de notas de entrada não configurada</strong>
                  <p className="text-amber-800 mt-0.5">Nenhuma consulta à SEFAZ foi executada.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border-l-4 border-amber-500 flex items-start gap-2.5">
                <span className="text-base">⚠️</span>
                <div>
                  <strong className="text-amber-900">Baixas não validadas</strong>
                  <p className="text-amber-800 mt-0.5">Não há extrato bancário conectado nesta tela.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border-l-4 border-amber-500 flex items-start gap-2.5">
                <span className="text-base">⚖️</span>
                <div>
                  <strong className="text-amber-900">Apuração não executada</strong>
                  <p className="text-amber-800 mt-0.5">Não há documentos autenticados para calcular impostos.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border-l-4 border-amber-500 flex items-start gap-2.5">
                <span className="text-base">📅</span>
                <div>
                  <strong className="text-amber-900">Prazo de DCTFWeb não consultado</strong>
                  <p className="text-amber-800 mt-0.5">Consulte o portal oficial até que a fonte esteja configurada.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border-l-4 border-amber-500 flex items-start gap-2.5">
                <span className="text-base">⚖️</span>
                <div>
                  <strong className="text-amber-900">Prazo de ICMS não consultado</strong>
                  <p className="text-amber-700 mt-0.5">Nenhuma apuração foi executada. Consulte o calendário oficial e os dados da empresa.</p>
                </div>
              </div>
            </div>
          </div>

          {/* 🛑 BOTÕES DE AÇÃO OPERACIONAIS */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setAbaInterna('autoresolucao')}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              📋 Ver Histórico Completo
            </button>

            <button
              type="button"
              onClick={handleAuditarFechamentoLocal}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
            >
              Conferir dados locais
            </button>

            <button
              type="button"
              onClick={() => void verificarDisponibilidadeAgora()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <span>Verificar disponibilidade</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA OFICIAL: 🛡️ SÓ DADOS REAIS · SEM DADOS FALSOS (ROBÔS MURADE) */}
      {/* ============================================================== */}
      {abaInterna === 'dadosReais' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6 animate-in fade-in">
          {/* HEADER COM STATUS DE PROTEÇÃO */}
          <div className="bg-gradient-to-r from-slate-900 via-[#0F2B5B] to-emerald-950 text-white p-5 rounded-2xl border border-emerald-500/40 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>Conferência de origem dos dados fiscais</span>
                    <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full font-mono font-bold border border-emerald-400/30">
                      API SEFAZ NÃO CONFIGURADA
                    </span>
                  </h3>
                  <p className="text-xs text-emerald-100/85 mt-0.5">
                    O sistema verifica formato e rejeita exemplos conhecidos; isso não autentica a origem. A API oficial ainda não está conectada.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-mono text-xs font-bold">
                  Não conectado
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 text-xs">
              <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                <div className="text-[10px] text-slate-300">Bloquear Simulação</div>
                <div className="font-bold text-amber-300">Sem fonte autenticada</div>
              </div>
              <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                <div className="text-[10px] text-slate-300">Certificado Digital</div>
                <div className="font-bold text-amber-300">Não validado</div>
              </div>
              <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                <div className="text-[10px] text-slate-300">Chave NF-e</div>
                <div className="font-bold text-amber-300">Formato não comprova origem</div>
              </div>
              <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                <div className="text-[10px] text-slate-300">Origens Proibidas</div>
                <div className="font-bold text-red-400">Não verificado</div>
              </div>
            </div>
          </div>

          {/* OS 3 ROBÔS MURADE — SÓ DADOS REAIS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* ROBÔ 1 */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4 shadow-2xs flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-sm text-[#0F2B5B]">
                    <span className="text-base">🤖</span>
                    <span>Robô 1 — Conferir Notas</span>
                  </div>
                  {resumoRobo1 && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      resumoRobo1.alertas > 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-800 border border-slate-300'
                    }`}>
                      {resumoRobo1.resumo}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600">
                  Confere XMLs do Radar, notas do livro e vencimentos informados para todas as empresas cadastradas neste navegador. Avisa sobre novos achados locais; não consulta portais oficiais.
                </p>
                <div className="p-2 rounded-lg bg-slate-100 text-[11px] text-slate-700">
                  <div><strong>Robô local:</strong> {radarAtivo ? `ativo para ${empresas.length} empresa(s) enquanto o aplicativo estiver aberto` : 'pausado'}</div>
                  <div>Última conferência: {ultimaAuditoriaRadar || 'aguardando execução'}</div>
                  <div>{alertasRadar.length} alerta(s) da última conferência completa · {resumoRobo1?.notasNovas ?? 0} XML(s) novo(s) desde a conferência anterior</div>
                </div>
                <button type="button" onClick={() => {
                  const proximo = !radarAtivo;
                  if (!definirMonitorPendenciasAtivo(proximo)) {
                    setNotificacao({ tipo: 'alerta', texto: 'Não foi possível salvar o estado do monitor neste navegador.' });
                    return;
                  }
                  setRadarAtivo(proximo);
                }} className="text-xs text-blue-700 underline">
                  {radarAtivo ? 'Pausar verificação automática' : 'Retomar verificação automática'}
                </button>

                {resumoRobo1 && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-2 font-mono">
                    <div className="flex justify-between border-b pb-1 text-slate-700 font-sans font-bold">
                      <span>{resumoRobo1.empresas ?? 0} empresa(s) · {resumoRobo1.total ?? 0} XML(s) local(is)</span>
                      <span className="text-amber-800">Achados: {resumoRobo1.alertas ?? 0} · XMLs novos: {resumoRobo1.notasNovas ?? 0}</span>
                    </div>
                    {resumoRobo1.detalhes?.map((item: any, i: number) => (
                      <div key={`${item.chave}-${item.mensagem}-${i}`} className="p-2 rounded bg-amber-50 border border-amber-200 text-[11px]">
                        <div className="text-amber-900 font-bold">{item.severidade}: {item.empresa} · NF {item.numero}</div>
                        <div className="truncate text-slate-600">{item.chave}</div>
                        <div className="text-slate-800">{item.mensagem}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleExecutarRobo1}
                                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verificar carteira local</span>
                </button>
                <p className="text-[10px] text-slate-500">A origem e a autorização oficial dos XMLs não são validadas.</p>
              </div>
            </div>

            {/* ROBÔ 2 */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4 shadow-2xs flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-sm text-[#0F2B5B]">
                    <span className="text-base">🤖</span>
                    <span>Robô 2 — Conferir Valores</span>
                  </div>
                  {resumoRobo2?.status && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                      {resumoRobo2.status}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600">
                  Confere campos e valores registrados no livro local. Não determina imposto devido nem valida a regra fiscal da operação.
                </p>

                {resumoRobo2 && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1.5">
                    {resumoRobo2.erro ? (
                      <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-800 font-bold">
                        {resumoRobo2.erro}
                      </div>
                    ) : (
                      <div className="space-y-1 text-[11px] text-slate-700">
                        <div className="font-bold">{resumoRobo2.mensagem}</div>
                        {resumoRobo2.inconsistencias?.map((item: any, index: number) => (
                          <div key={`${item.chave}-${index}`} className="border-t pt-1">
                            NF {item.numero || 'sem número'} · {item.problemas.join('; ')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleExecutarRobo2}
                                    className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Activity className="w-4 h-4" />
                  <span>Auditar campos do livro</span>
                </button>
                <p className="text-[10px] text-slate-500">Auditoria estrutural local; não é apuração tributária.</p>
              </div>
            </div>

            {/* ROBÔ 3 */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4 shadow-2xs flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-sm text-[#0F2B5B]">
                    <span className="text-base">🤖</span>
                    <span>Robô 3 — Comparar Sistemas</span>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                    ERP não conectado
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Comparação indisponível: não há importador ou conexão de ERP configurados neste módulo.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200 text-xs font-bold text-amber-900">Aguardando integração de dados do ERP</div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 2: REFORMA TRIBUTÁRIA IBS + CBS (CONSULTA OFICIAL NÃO CONECTADA) */}
      {/* ============================================================== */}
      {abaInterna === 'reforma' && (
        <div className="animate-in fade-in"><ReformaTributariaScreen /></div>
      )}

      {/* ============================================================== */}
      {/* ABA 3: OCR INTELIGENTE & LEITOR XML DO E-MAIL */}
      {/* ============================================================== */}
      {abaInterna === 'ocr' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in">
          {/* MÓDULO 1: OCR INTELIGENTE */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>📸</span>
                <span>OCR fiscal — serviço não configurado</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                O processamento de imagens não está configurado. Arquivos selecionados não serão enviados ou lançados.
              </p>
            </div>

            <label className="border-2 border-dashed border-blue-400 hover:border-blue-600 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-blue-50/40 hover:bg-blue-50 transition-colors">
              <Upload className="w-8 h-8 text-blue-600 mb-2" />
              <span className="text-xs font-bold text-slate-800">
                OCR indisponível até configurar o serviço
              </span>
              <span className="text-[11px] text-slate-500 mt-1">
                Formatos suportados: PNG, JPG, PDF (até 15MB)
              </span>
              <input 
                type="file" 
                accept="image/*,.pdf" 
                onChange={handleUploadOcr}
                className="hidden" 
              />
            </label>

          </div>

          {/* MÓDULO 2: LEITOR XML POR E-MAIL */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>📧</span>
                <span>Leitor de XML por E-mail</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                A busca de XML por e-mail não está conectada.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              Monitoramento de e-mail indisponível: integração com provedor e agendamento no servidor não configurados. Nenhuma caixa postal foi acessada.
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 4: ASSISTENTE IA (LEGISLAÇÃO FISCAL 2026) */}
      {/* ============================================================== */}
      {abaInterna === 'ia' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 animate-in fade-in">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <span>🧠</span>
              <span>Assistente IA Fiscal — Legislação, Regimes e Prazos</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pergunte qualquer questão sobre contabilidade, DCTF Web, IBS/CBS, EFD e obrigações 2026.
            </p>
          </div>

          {/* CHAT CONTAINER */}
          <div className="h-80 overflow-y-auto p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
            {mensagensChat.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2 max-w-[85%] ${m.autor === 'usuario' ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
              >
                {m.autor === 'ia' && <span className="text-xl shrink-0">🧠</span>}
                <div
                  className={`p-3 rounded-2xl leading-relaxed whitespace-pre-line ${
                    m.autor === 'usuario' 
                      ? 'bg-blue-600 text-white rounded-br-none shadow-xs' 
                      : 'bg-white text-slate-800 rounded-bl-none border border-slate-200 shadow-2xs'
                  }`}
                >
                  {m.texto}
                </div>
                {m.autor === 'usuario' && <span className="text-xl shrink-0">👤</span>}
              </div>
            ))}
          </div>

          {/* FORMULÁRIO DE ENVIO */}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleEnviarPergunta(); }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={perguntaInput}
              onChange={(e) => setPerguntaInput(e.target.value)}
              placeholder="Digite sua dúvida sobre legislação ou prazos... (ex: 'Prazo ECD 2026?')"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar</span>
            </button>
          </form>

          {/* PERGUNTAS RÁPIDAS SUGERIDAS */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-500 block">💡 Perguntas Rápidas:</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Prazo de entrega da ECD 2026?',
                'Alíquota ICMS GO 2026',
                'Diferença Lucro Real x Presumido',
                'Obrigações do Simples Nacional',
                'Como funciona o DCTF Web em 2026?'
              ].map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleEnviarPergunta(sug)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer border border-slate-200"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 5: COMPARADOR DE REGIME TRIBUTÁRIO */}
      {/* ============================================================== */}
      {abaInterna === 'comparador' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5 animate-in fade-in">
          <div>
            <h3 className="text-sm sm:text-base font-black text-[#0F2B5B]">
              💰 Comparador de Regime Tributário — Simples vs Presumido vs Real
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              A comparação depende de dados contábeis, regime, atividade, UF e município. Não há cálculo validado neste painel.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">A integração e os dados necessários para comparar regimes ainda não estão configurados.</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                Simulação indisponível: informe dados contábeis completos e conecte regras tributárias atualizadas antes de comparar regimes.
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            Estimativas genéricas de alíquota foram removidas. Para comparar regimes, é necessário calcular com dados contábeis e regras específicas da empresa.
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 6: AUTO-RESOLUÇÃO (LOG DAS 5 TENTATIVAS) */}
      {/* ============================================================== */}
      {abaInterna === 'autoresolucao' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4 animate-in fade-in">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                <Zap className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  🔧 Histórico de automação
                </h3>
                <p className="text-xs text-slate-500">
                  Nenhum mecanismo de reconexão está ativo. Este histórico será preenchido quando uma integração real for implementada.
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
            {logsAutoResolucao.map(log => (
              <div key={log.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    {log.tipo === 'sucesso' && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-300">
                        ✅ RESOLVIDO
                      </span>
                    )}
                    {log.tipo === 'tentativa' && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-300">
                        🔄 RETRY 3/5
                      </span>
                    )}
                    <span className="font-bold text-slate-900">{log.titulo}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {log.detalhe} • <strong className="text-slate-700">{log.cliente}</strong>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-400 font-mono shrink-0">
                  {log.hora} (Hoje)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 7: DCTF WEB — acesso não configurado */}
      {/* ============================================================== */}
      {abaInterna === 'dctf' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5 animate-in fade-in">
          <div>
            <span className="text-[10px] font-black uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
              Não conectado
            </span>
            <h3 className="text-base font-black text-[#0F2B5B] mt-1">
              📋 DCTFWeb — consulta e transmissão não configuradas
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Este painel não envia declarações. Consulte o portal oficial até que a autenticação e o fluxo de transmissão sejam implementados.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h4 className="text-xs font-bold text-slate-800">Acesso à transmissão direta — indisponível</h4>
              
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">CNPJ da Empresa</label>
                <input
                  type="text"
                  placeholder="00.000.000/0001-00"
                value={empresaAtiva?.cnpj || ''}
                readOnly
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Competência</label>
                <input
                  type="month"
                  defaultValue={new Date().toISOString().slice(0, 7)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div role="status" className="w-full py-2.5 px-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold">
                Transmissão desativada — integração autenticada com e-CAC/Receita Federal não configurada.
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <h4 className="font-bold text-slate-800">Histórico de Transmissões RFB</h4>
              <div className="space-y-1.5 text-[11px]">
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 font-semibold">
                  Nenhum protocolo disponível. O histórico oficial não está conectado.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 8: CALENDÁRIO FISCAL (NOVOS PRAZOS 2026) */}
      {/* ============================================================== */}
      {abaInterna === 'calendario' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5 animate-in fade-in">
          <div>
            <h3 className="text-base font-black text-[#0F2B5B]">
              📅 Calendário de Obrigações — consulta oficial indisponível
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Nenhuma data de vencimento é exibida sem consulta a fonte oficial atualizada e consideração da obrigação e do período.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
            Conecte uma fonte oficial de calendário para consultar os prazos vigentes. Não há datas verificadas disponíveis neste painel.
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 9: CERTIFICADO DIGITAL (REGRAS SERPRO 2026) */}
      {/* ============================================================== */}
      {abaInterna === 'certificado' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5 animate-in fade-in">
          <div>
            <h3 className="text-base font-black text-[#0F2B5B]">
              🔑 Certificados digitais — status desta empresa
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Os certificados não são consultados pelo SERPRO neste painel. Gerencie o arquivo e a validade no cadastro da empresa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-900">Empresa ativa</h4>
              <p className="text-slate-700">{empresaAtiva?.razaoSocial || empresaAtiva?.nomeFantasia || 'Nenhuma empresa selecionada'}</p>
              <p className="text-slate-500">Validade e autorização oficial não foram verificadas aqui.</p>
              <div role="status" className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-900">
                Orientação de renovação indisponível neste painel. Consulte o canal oficial do emissor do certificado.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DA CALCULADORA FISCAL (27 UFs) */}
      <ModalCalculadoraFiscal
        aberto={modalCalculadoraAberto}
        onFechar={() => setModalCalculadoraAberto(false)}
      />

    </div>
  );
}
