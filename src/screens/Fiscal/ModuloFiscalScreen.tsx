import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, 
  Upload, 
  Download, 
  Calculator, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Receipt, 
  Search, 
  Filter, 
  RefreshCw, 
  FileText, 
  DollarSign, 
  Building2, 
  Calendar,
  Check,
  Percent,
  Plus,
  ShieldCheck,
  Ban
} from 'lucide-react';
import { 
  FISCOIA_FISCAL, 
  NotaFiscalItem, 
  RegimeTributario, 
  UF,
  ResumoTributosInformados,
  lerNotasFiscaisEmpresa,
  salvarNotasFiscaisEmpresa,
  notificarAtualizacaoDadosFiscais,
  vencimentoInformadoPassou,
  obterValorPagoInformado,
  registrarPagamentoInformado
} from '../../services/fiscal/fiscoiaFiscal.service';
import { ModalCalculadoraFiscal } from '../../components/ModalCalculadoraFiscal';
import { ConsultaSefazDfePanel } from '../../components/ConsultaSefazDfePanel';
import { useEmpresa } from '../../context/EmpresaContext';
import { conferirNotasRadar, exportarRelatorioRadarCsv, importarXmlNfe, mesclarRevisaoEstrutural, NotaRadar, validarListaNotasRadar } from '../../services/fiscal/radarFiscal.service';
import {
  apagarArquivoFiscalPendenteLocal,
  apagarXmlFiscalLocal,
  apagarXmlsFiscaisEmpresa,
  listarArquivosFiscaisPendentesEmpresa,
  obterArquivoFiscalPendenteLocal,
  obterXmlFiscalLocal,
  obterXmlFiscalPorChaveEmpresa,
  salvarArquivoFiscalPendenteLocal,
  salvarXmlFiscalLocal,
  type ArquivoFiscalPendenteResumo
} from '../../services/fiscal/xmlFiscalStorage.service';
import { lerLivroFiscalEmpresa, lerRadarFiscalEmpresa, marcarMigracaoLivroCnpjConcluida, marcarMigracaoRadarCnpjConcluida } from '../../services/fiscal/empresaFiscalStorage.service';

interface ModuloFiscalScreenProps {
  onVoltar?: () => void;
  abaInicial?: 'saida' | 'entrada' | 'baixa' | 'apuracao' | 'calculadora';
}

const hojeLocalISO = () => {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
};

const rotuloStatusPagamentoLocal = (nota: NotaFiscalItem) => {
  const vencimentoPassou = vencimentoInformadoPassou(nota.dataVencimento);
  if (nota.status === 'PAGA_INFORMADA') return 'PAGAMENTO TOTAL INFORMADO';
  if (nota.status === 'PAGAMENTO_PARCIAL_INFORMADO') {
    return `PAGAMENTO PARCIAL INFORMADO · R$ ${(nota.valorPago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${vencimentoPassou ? ' · VENCIMENTO PASSOU' : ''}`;
  }
  if (nota.status === 'PAGA') return `STATUS ANTIGO NÃO VERIFICADO${vencimentoPassou ? ' · VENCIMENTO PASSOU' : ''}`;
  return vencimentoPassou ? 'VENCIMENTO INFORMADO PASSOU' : 'PENDENTE';
};

const classeStatusPagamentoLocal = (nota: NotaFiscalItem) => {
  if (nota.status === 'PAGA_INFORMADA' || nota.status === 'PAGAMENTO_PARCIAL_INFORMADO') return 'bg-blue-100 text-blue-800 border border-blue-300';
  if (vencimentoInformadoPassou(nota.dataVencimento)) return 'bg-rose-100 text-rose-800 border border-rose-300';
  return 'bg-amber-100 text-amber-800 border border-amber-300';
};

type CampoTributoInformado = 'ICMS' | 'PIS' | 'COFINS';

const formatarMoedaInformada = (valor: number) => Number.isFinite(valor)
  ? `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  : 'Não informado';

const formatarTotalInformado = (nota: NotaFiscalItem) =>
  nota.camposNumericosIndisponiveis?.includes('VNF') ? 'Não informado' : formatarMoedaInformada(nota.valorTotal);

const formatarTributoInformado = (nota: NotaFiscalItem, campo: CampoTributoInformado, valor: number) => {
  if (nota.camposNumericosIndisponiveis?.includes(campo) || !Number.isFinite(valor)) return 'Não informado';
  return formatarMoedaInformada(valor);
};

const lerValorMoeda = (entrada: string) => {
  const limpo = entrada.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  const formatoBrasileiro = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
  const formatoDecimalPonto = /^\d+\.\d{1,2}$/;
  if (!formatoBrasileiro.test(limpo) && !formatoDecimalPonto.test(limpo)) return Number.NaN;
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : 0;
};

export function ModuloFiscalScreen({ 
  onVoltar,
  abaInicial = 'saida'
}: ModuloFiscalScreenProps) {
  const { empresaAtiva, salvarNovaEmpresa, selecionarEmpresa } = useEmpresa();
  const [abaAtiva, setAbaAtiva] = useState<'radar' | 'saida' | 'entrada' | 'baixa' | 'apuracao' | 'calculadora'>(abaInicial);
  const [modalCalcAberta, setModalCalcAberta] = useState(false);

  // Mapeamento bidirecional entre o regime da Empresa e o motor do Módulo Fiscal
  const mapEmpresaRegimeToFiscal = (r?: string): RegimeTributario => {
    if (!r) return 'SIMPLES';
    const clean = r.toUpperCase();
    if (clean === 'LUCRO_REAL' || clean === 'REAL') return 'REAL';
    if (clean === 'LUCRO_PRESUMIDO' || clean === 'PRESUMIDO') return 'PRESUMIDO';
    return 'SIMPLES';
  };

  const mapFiscalRegimeToEmpresa = (r: RegimeTributario): 'SIMPLES' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL' => {
    if (r === 'REAL') return 'LUCRO_REAL';
    if (r === 'PRESUMIDO') return 'LUCRO_PRESUMIDO';
    return 'SIMPLES';
  };

  // Inicializa regime com base na empresa ativa salva ou na preferência gravada
  const getRegimeInicial = (): RegimeTributario => {
    if (empresaAtiva?.id) {
      let salvoEmpresa: string | null = null;
      try { salvoEmpresa = localStorage.getItem(`fiscoia_regime_fiscal_${empresaAtiva.id}`); } catch { /* Usa os dados da empresa como fallback. */ }
      if (salvoEmpresa === 'SIMPLES' || salvoEmpresa === 'REAL' || salvoEmpresa === 'PRESUMIDO') {
        return salvoEmpresa as RegimeTributario;
      }
      if (empresaAtiva.regimeTributario) {
        return mapEmpresaRegimeToFiscal(empresaAtiva.regimeTributario);
      }
    }
    return 'SIMPLES';
  };

  // Dados em memória inicializados com o banco de notas do serviço
  const [notasSaida, setNotasSaida] = useState<NotaFiscalItem[]>([]);
  const [notasEntrada, setNotasEntrada] = useState<NotaFiscalItem[]>([]);
  const [ufFiltro, setUfFiltro] = useState<UF>(() => {
    if (empresaAtiva?.uf && FISCOIA_FISCAL.UFS.includes(empresaAtiva.uf.toUpperCase() as UF)) {
      return empresaAtiva.uf.toUpperCase() as UF;
    }
    return 'GO';
  });
  const [regimeFiltro, setRegimeFiltro] = useState<RegimeTributario>(getRegimeInicial);
  const [termoBusca, setTermoBusca] = useState('');
  const [notasRadar, setNotasRadar] = useState<NotaRadar[]>([]);
  const [erroLeituraRadar, setErroLeituraRadar] = useState<string | null>(null);
  const [radarEmpresaId, setRadarEmpresaId] = useState<string | null>(null);
  const [estadoSincronizacaoCentral, setEstadoSincronizacaoCentral] = useState<string | null>(null);
  const [sincronizandoFiscalCentral, setSincronizandoFiscalCentral] = useState(false);
  const [cursorSyncFiscal, setCursorSyncFiscal] = useState<string | null>(null);
  const [versaoDocumentosCentrais, setVersaoDocumentosCentrais] = useState(0);
  const [periodoSyncDesde, setPeriodoSyncDesde] = useState(() => `${hojeLocalISO().slice(0, 7)}-01`);
  const [periodoSyncAte, setPeriodoSyncAte] = useState(hojeLocalISO);
  const [filtroRadar, setFiltroRadar] = useState('');
  const [filtroPeriodoRadar, setFiltroPeriodoRadar] = useState('');
  const [mensagemRadar, setMensagemRadar] = useState('');
  const [ultimaConferenciaRadar, setUltimaConferenciaRadar] = useState<string | null>(null);
  const [arquivosPendentes, setArquivosPendentes] = useState<ArquivoFiscalPendenteResumo[]>([]);
  const [arquivosPendentesEmpresaId, setArquivosPendentesEmpresaId] = useState<string | null>(null);
  const [erroArquivosPendentes, setErroArquivosPendentes] = useState<string | null>(null);
  const inputXmlRef = useRef<HTMLInputElement>(null);
  const empresaAtivaIdRef = useRef<string | null>(empresaAtiva?.id ?? null);

  useEffect(() => {
    let atual = true;
    const empresaId = empresaAtiva?.id;
    setArquivosPendentes([]);
    setArquivosPendentesEmpresaId(null);
    setErroArquivosPendentes(null);
    if (!empresaId) return () => { atual = false; };
    void listarArquivosFiscaisPendentesEmpresa(empresaId).then(arquivos => {
      if (!atual) return;
      setArquivosPendentes(arquivos);
      setArquivosPendentesEmpresaId(empresaId);
    }).catch(error => {
      if (!atual) return;
      setErroArquivosPendentes(error instanceof Error ? error.message : 'Não foi possível ler os arquivos pendentes.');
      setArquivosPendentesEmpresaId(empresaId);
    });
    return () => { atual = false; };
  }, [empresaAtiva?.id]);

  // Sincroniza automaticamente quando a empresaAtiva mudar
  useEffect(() => {
    if (empresaAtiva) {
      let reg: RegimeTributario = 'SIMPLES';
      let salvo: string | null = null;
      try { salvo = localStorage.getItem(`fiscoia_regime_fiscal_${empresaAtiva.id}`); } catch { /* Usa o regime salvo no cadastro local. */ }
      if (salvo === 'SIMPLES' || salvo === 'REAL' || salvo === 'PRESUMIDO') {
        reg = salvo as RegimeTributario;
      } else if (empresaAtiva.regimeTributario) {
        reg = mapEmpresaRegimeToFiscal(empresaAtiva.regimeTributario);
      }
      setRegimeFiltro(reg);

      if (empresaAtiva.uf && FISCOIA_FISCAL.UFS.includes(empresaAtiva.uf.toUpperCase() as UF)) {
        setUfFiltro(empresaAtiva.uf.toUpperCase() as UF);
      }
    }
  }, [empresaAtiva?.id, empresaAtiva?.regimeTributario, empresaAtiva?.uf]);

  // Mensagem de notificação
  const [alerta, setAlerta] = useState<{ tipo: 'sucesso' | 'info'; texto: string } | null>(null);

  // O regime é gravado no cadastro local da empresa; não há sincronização com servidor.
  const handleAlterarRegime = (novoRegime: RegimeTributario) => {
    const nomes = {
      SIMPLES: 'Simples Nacional',
      PRESUMIDO: 'Lucro Presumido',
      REAL: 'Lucro Real'
    };

    if (!empresaAtiva) {
      setAlerta({ tipo: 'info', texto: 'Selecione uma empresa para salvar o regime no cadastro local.' });
      return;
    }

    try {
      const regEmpresa = mapFiscalRegimeToEmpresa(novoRegime);
      const empAtualizada = { ...empresaAtiva, regimeTributario: regEmpresa };
      const salva = salvarNovaEmpresa(empAtualizada);
      selecionarEmpresa(salva);
      setRegimeFiltro(novoRegime);
      setAlerta({ tipo: 'info', texto: `Regime ${nomes[novoRegime]} salvo no cadastro local de ${empresaAtiva.razaoSocial}. Este navegador não sincroniza o dado com outros dispositivos.` });
    } catch (erro) {
      setAlerta({ tipo: 'info', texto: erro instanceof Error ? `Não foi possível salvar o regime. ${erro.message}` : 'Não foi possível salvar o regime; os dados anteriores foram preservados.' });
    }

    setTimeout(() => setAlerta(null), 4000);
  };

  // Estados da Baixa de Notas
  const [notaSelecionadaParaBaixa, setNotaSelecionadaParaBaixa] = useState<NotaFiscalItem | null>(null);
  const [empresaIdNotaBaixa, setEmpresaIdNotaBaixa] = useState<string | null>(null);
  const [valorPagoInput, setValorPagoInput] = useState<string>('');
  const [dataPagoInput, setDataPagoInput] = useState<string>(hojeLocalISO());

  const fecharModalBaixa = () => {
    setNotaSelecionadaParaBaixa(null);
    setEmpresaIdNotaBaixa(null);
  };

  useEffect(() => {
    if (empresaIdNotaBaixa && empresaIdNotaBaixa !== empresaAtiva?.id) {
      fecharModalBaixa();
      setAlerta({ tipo: 'info', texto: 'A empresa ativa mudou. O lançamento de pagamento foi cancelado e nada foi salvo.' });
    }
  }, [empresaAtiva?.id, empresaIdNotaBaixa]);

  // Cada livro fiscal local fica isolado pela empresa ativa neste navegador.
  useLayoutEffect(() => {
    if (!empresaAtiva?.id) {
      setNotasSaida([]);
      setNotasEntrada([]);
      return;
    }
    const empresaId = empresaAtiva.id;
    const leitura = lerLivroFiscalEmpresa(empresaId, empresaAtiva.cnpj);
    if ('erro' in leitura) {
      setNotasSaida([]);
      setNotasEntrada([]);
      setMensagemRadar(`Livro fiscal local indisponível (${leitura.erro}). Os dados armazenados foram preservados e não foram tratados como livro vazio.`);
      return;
    }
    const salvas = leitura.notas;
    const migrarXmlLocalNaoVerificado = (nota: NotaFiscalItem): nota is NotaFiscalItem & { origemArquivo: string } =>
      Boolean(nota.origemArquivo);
    const xmlsLegados = [...salvas.saidas, ...salvas.entradas].filter(migrarXmlLocalNaoVerificado);
    if (!xmlsLegados.length) {
      if (leitura.fonteChave && leitura.fonteChave !== empresaId) {
        if (!salvarNotasFiscaisEmpresa(empresaId, salvas)) {
          setNotasSaida(salvas.saidas);
          setNotasEntrada(salvas.entradas);
          setMensagemRadar('Dados fiscais antigos foram encontrados pela chave CNPJ, mas não puderam ser copiados para o ID atual. A origem antiga foi preservada.');
          return;
        }
        if (!marcarMigracaoLivroCnpjConcluida(empresaId)) {
          setNotasSaida(salvas.saidas);
          setNotasEntrada(salvas.entradas);
          setMensagemRadar('Livro fiscal copiado para a chave atual, mas não foi possível registrar o fim da migração. A origem antiga foi preservada.');
          return;
        }
        setMensagemRadar('Livro fiscal legado encontrado pelo CNPJ e copiado para o cadastro atual. A cópia antiga foi preservada como referência local.');
      }
      setNotasSaida(salvas.saidas);
      setNotasEntrada(salvas.entradas);
      return;
    }

    try {
      const chaveRadar = `fiscoia_radar_xml_${empresaId}`;
      const leituraRadar = lerRadarFiscalEmpresa(empresaId, empresaAtiva.cnpj);
      if (leituraRadar.erro) throw new Error(leituraRadar.erro);
      const radarAtual = leituraRadar.notas;
      const chavesRadar = new Set(radarAtual.map(nota => nota.chave).filter(Boolean));
      const notasMigradas: NotaRadar[] = xmlsLegados
        .filter(nota => !nota.chave || !chavesRadar.has(nota.chave))
        .map(nota => {
          const antiga = nota as NotaFiscalItem & { situacaoProtocolo?: string; codigoProtocolo?: string; numeroProtocolo?: string };
          const protocoloDeclarado = antiga.situacaoProtocolo === 'AUTORIZADA_NO_XML' || Boolean(antiga.codigoProtocolo || antiga.numeroProtocolo);
          return {
            ...nota,
            origemArquivo: nota.origemArquivo,
            origemVerificada: false,
            situacaoProtocolo: protocoloDeclarado ? 'PROTOCOLO_DECLARADO_NO_XML' : 'SEM_PROTOCOLO',
            codigoProtocolo: antiga.codigoProtocolo,
            numeroProtocolo: antiga.numeroProtocolo,
            ocorrencias: [{ severidade: 'ATENCAO', codigo: 'MIGRADA_PARA_REVISAO', mensagem: 'XML legado movido do livro para o Radar: o arquivo não teve assinatura nem origem oficial verificadas.' }]
          };
        });
      const radarAtualizado = [...notasMigradas, ...radarAtual];
      localStorage.setItem(chaveRadar, JSON.stringify(radarAtualizado));
      if (leituraRadar.fonteChave && leituraRadar.fonteChave !== empresaId && !marcarMigracaoRadarCnpjConcluida(empresaId)) {
        throw new Error('não foi possível registrar o fim da migração do Radar legado');
      }
      const novasSaidas = salvas.saidas.filter(nota => !migrarXmlLocalNaoVerificado(nota));
      const novasEntradas = salvas.entradas.filter(nota => !migrarXmlLocalNaoVerificado(nota));
      if (!salvarNotasFiscaisEmpresa(empresaId, { saidas: novasSaidas, entradas: novasEntradas })) {
        notificarAtualizacaoDadosFiscais();
        setNotasSaida(salvas.saidas);
        setNotasEntrada(salvas.entradas);
        setMensagemRadar('A cópia de segurança dos XMLs foi criada no Radar, mas não foi possível concluir a retirada dos registros não verificados do livro. Revise o armazenamento local.');
        return;
      }
      if (leitura.fonteChave && leitura.fonteChave !== empresaId && !marcarMigracaoLivroCnpjConcluida(empresaId)) {
        setNotasSaida(novasSaidas);
        setNotasEntrada(novasEntradas);
        setMensagemRadar('Os dados fiscais foram copiados, mas não foi possível marcar a migração antiga como concluída. Confira o Radar e a chave CNPJ legada antes de novas mudanças.');
        return;
      }
      setNotasSaida(novasSaidas);
      setNotasEntrada(novasEntradas);
      setMensagemRadar(`${xmlsLegados.length} XML(s) antigo(s) movido(s) do livro para o Radar, preservando os dados para revisão. A assinatura e a autorização oficial não foram verificadas.`);
    } catch {
      setNotasSaida(salvas.saidas);
      setNotasEntrada(salvas.entradas);
      setMensagemRadar('Não foi possível migrar os XMLs antigos com segurança. Nenhum registro foi removido do livro local.');
    }
  }, [empresaAtiva?.id, empresaAtiva?.cnpj]);

  useLayoutEffect(() => {
    // Guarda a empresa efetivamente selecionada para callbacks de importação assíncronos.
    empresaAtivaIdRef.current = empresaAtiva?.id ?? null;
    setErroLeituraRadar(null);
    setUltimaConferenciaRadar(null);
    setMensagemRadar('');
    if (!empresaAtiva?.id) { setNotasRadar([]); setRadarEmpresaId(null); return; }
    try {
      const leitura = lerRadarFiscalEmpresa(empresaAtiva.id, empresaAtiva.cnpj);
      if (leitura.erro) throw new Error(leitura.erro);
      if (leitura.fonteChave && leitura.fonteChave !== empresaAtiva.id) {
        localStorage.setItem(`fiscoia_radar_xml_${empresaAtiva.id}`, JSON.stringify(leitura.notas));
        if (!marcarMigracaoRadarCnpjConcluida(empresaAtiva.id)) throw new Error('não foi possível registrar o fim da migração legada');
      }
      setNotasRadar(leitura.notas);
      setRadarEmpresaId(empresaAtiva.id);
    } catch (error) {
      setNotasRadar([]);
      setRadarEmpresaId(empresaAtiva.id);
      setErroLeituraRadar(error instanceof Error ? error.message : 'não foi possível ler os registros salvos');
    }
  }, [empresaAtiva?.id, empresaAtiva?.cnpj]);

  const radarPronto = Boolean(empresaAtiva?.id && radarEmpresaId === empresaAtiva.id);
  const arquivosPendentesVisiveis = arquivosPendentesEmpresaId === empresaAtiva?.id ? arquivosPendentes : [];

  const salvarNotasRadar = (novas: NotaRadar[]) => {
    if (!empresaAtiva?.id || empresaAtivaIdRef.current !== empresaAtiva.id || radarEmpresaId !== empresaAtiva.id) return false;
    if (erroLeituraRadar) return false;
    try {
      validarListaNotasRadar(novas);
      localStorage.setItem(`fiscoia_radar_xml_${empresaAtiva.id}`, JSON.stringify(novas));
      setNotasRadar(novas);
      setErroLeituraRadar(null);
      notificarAtualizacaoDadosFiscais();
      return true;
    } catch (error) {
      console.error('Não foi possível salvar os XMLs do Radar neste navegador:', error);
      return false;
    }
  };

  const sincronizarDocumentosMuradeFiscal = async () => {
    const empresa = empresaAtiva;
    if (!empresa?.idCentral || !empresa.tenantIdCentral) {
      setMensagemRadar('Vincule esta empresa a um cadastro central antes de sincronizar com o Murade Fiscal.');
      return;
    }
    if (!periodoSyncDesde || !periodoSyncAte || periodoSyncDesde > periodoSyncAte) {
      setMensagemRadar('Informe um período válido para a sincronização.');
      return;
    }
    if (!window.confirm(`Consultar no Murade Fiscal os documentos armazenados para o CNPJ ${empresa.cnpj}, de ${periodoSyncDesde} a ${periodoSyncAte}? Os XMLs válidos serão gravados como pendentes de revisão no Fisco IA. Nenhum lançamento ou envio oficial será feito.`)) return;

    setSincronizandoFiscalCentral(true);
    setMensagemRadar('Consultando o Murade Fiscal e validando documentos completos…');
    try {
      const resposta = await fetch(`/api/companies/${encodeURIComponent(empresa.idCentral)}/fiscal-source-sync`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-FiscoIA-Tenant-Id': empresa.tenantIdCentral },
        body: JSON.stringify({ confirmarSincronizacao: true, desde: periodoSyncDesde, ate: periodoSyncAte, ...(cursorSyncFiscal ? { cursor: cursorSyncFiscal } : {}) }),
      });
      const resultado = await resposta.json().catch(() => ({}));
      if (!resposta.ok || resultado?.sucesso !== true) {
        throw new Error(resultado?.mensagem || 'A integração não confirmou a sincronização.');
      }
      setCursorSyncFiscal(typeof resultado.proximoCursor === 'string' ? resultado.proximoCursor : null);
      setVersaoDocumentosCentrais(versao => versao + 1);
      setMensagemRadar(`${resultado.mensagem} Consultados: ${resultado.consultados}; novos: ${resultado.importados}; já existentes: ${resultado.repetidos}; sem XML completo: ${resultado.semXmlCompleto}; recusados: ${resultado.rejeitados}${resultado.podeHaverMais ? '. Há mais documentos no período; repita a sincronização para continuar.' : '.'}${Array.isArray(resultado.avisos) && resultado.avisos.length ? ` Avisos: ${resultado.avisos.join(' ')}` : ''}`);
      notificarAtualizacaoDadosFiscais();
    } catch (error) {
      setMensagemRadar(error instanceof Error ? error.message : 'Não foi possível sincronizar com o Murade Fiscal.');
    } finally {
      setSincronizandoFiscalCentral(false);
    }
  };

  // Reidrata no Radar desta sessão os XMLs já persistidos no PostgreSQL,
  // mantendo a lista local como cache e nunca alterando documentos existentes.
  useEffect(() => {
    const empresa = empresaAtiva;
    if (!radarPronto || !empresa?.idCentral || !empresa.tenantIdCentral || erroLeituraRadar) {
      setEstadoSincronizacaoCentral(null);
      return;
    }
    let cancelado = false;
    const atual = () => !cancelado && empresaAtivaIdRef.current === empresa.id;
    const sincronizar = async () => {
      setEstadoSincronizacaoCentral('Consultando documentos fiscais guardados no servidor…');
      try {
        const query = new URLSearchParams({ tenantId: empresa.tenantIdCentral!, limit: '100' });
        const resposta = await fetch(`/api/companies/${encodeURIComponent(empresa.idCentral!)}/fiscal-documents?${query}`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        const resultado = await resposta.json().catch(() => ({}));
        if (!resposta.ok || !Array.isArray(resultado?.documentos)) {
          throw new Error(resultado?.mensagem || 'a lista central não pôde ser carregada');
        }
        if (!atual()) return;
        const leitura = lerRadarFiscalEmpresa(empresa.id, empresa.cnpj);
        if (leitura.erro) throw new Error(leitura.erro);
        const porChave = new Map(leitura.notas.map(nota => [nota.chave, nota]));
        let recuperadas = 0;
        let semLeitor = 0;
        let revisoesMescladas = 0;
        for (const documento of resultado.documentos as Array<{
          id: string; chave: string; tipo: string; direcao: string | null; xmlDisponivel: boolean;
          revisaoEstrutural?: { findings?: Array<{ code?: unknown; severity?: unknown; message?: unknown }> } | null;
        }>) {
          if (!atual()) return;
          if (!documento.xmlDisponivel) continue;
          if (documento.tipo !== 'NFE' && documento.tipo !== 'NFCE') { semLeitor += 1; continue; }
          const notaExistente = porChave.get(documento.chave);
          if (notaExistente && documento.revisaoEstrutural) {
            const notaAtualizada = mesclarRevisaoEstrutural(notaExistente, documento.revisaoEstrutural);
            if (notaAtualizada !== notaExistente) {
              porChave.set(documento.chave, notaAtualizada);
              revisoesMescladas += 1;
            }
          }
          const xmlLocalExistente = await obterXmlFiscalPorChaveEmpresa(empresa.id, documento.chave);
          if (xmlLocalExistente) continue;
          const url = `/api/companies/${encodeURIComponent(empresa.idCentral!)}/fiscal-documents/${encodeURIComponent(documento.id)}/xml?tenantId=${encodeURIComponent(empresa.tenantIdCentral!)}`;
          const xmlResponse = await fetch(url, { credentials: 'include', headers: { Accept: 'application/xml' } });
          if (!xmlResponse.ok) throw new Error('não foi possível recuperar um XML central; nenhum dado existente foi substituído');
          const xml = await xmlResponse.text();
          const nota = importarXmlNfe(xml, 'XML recuperado do PostgreSQL', empresa.cnpj || '', regimeFiltro, ufFiltro);
          if (nota.chave !== documento.chave || (documento.direcao && nota.tipo !== documento.direcao)) {
            throw new Error('a identidade do XML recuperado diverge dos metadados centrais; o conteúdo foi preservado');
          }
          const xmlLocalId = await salvarXmlFiscalLocal({ empresaId: empresa.id, chave: nota.chave, nomeArquivo: `${nota.chave}.xml`, conteudo: xml });
          const existente = porChave.get(nota.chave);
          if (existente) {
            const preservada = mesclarRevisaoEstrutural({ ...existente, xmlLocalId }, documento.revisaoEstrutural);
            porChave.set(nota.chave, preservada);
            if (preservada !== existente) revisoesMescladas += 1;
          } else {
            nota.xmlLocalId = xmlLocalId;
            porChave.set(nota.chave, mesclarRevisaoEstrutural(nota, documento.revisaoEstrutural));
          }
          recuperadas += 1;
        }
        if (!atual()) return;
        if (recuperadas || revisoesMescladas) {
          const merge = validarListaNotasRadar([...porChave.values()]);
          if (!salvarNotasRadar(merge)) throw new Error('o Radar não pôde salvar as cópias recuperadas neste navegador');
        }
        const quantidade = (resultado.documentos as unknown[]).length;
        setEstadoSincronizacaoCentral(`Armazenamento central consultado: ${quantidade} documento(s), ${recuperadas} XML(s) recuperado(s), ${revisoesMescladas} revisão(ões) estrutural(is) atualizada(s) neste Radar${semLeitor ? `; ${semLeitor} documento(s) sem leitor neste Radar` : ''}. Todos continuam pendentes de revisão; consulta/autorização SEFAZ não foi realizada.`);
      } catch (error) {
        if (atual()) setEstadoSincronizacaoCentral(`Não foi possível concluir a leitura do armazenamento central. Os dados locais foram preservados. ${error instanceof Error ? error.message : ''}`.trim());
      }
    };
    void sincronizar();
    return () => { cancelado = true; };
  }, [radarPronto, empresaAtiva?.id, empresaAtiva?.idCentral, empresaAtiva?.tenantIdCentral, empresaAtiva?.cnpj, erroLeituraRadar, versaoDocumentosCentrais]);

  const recarregarArquivosPendentes = async (empresaId: string) => {
    const arquivos = await listarArquivosFiscaisPendentesEmpresa(empresaId);
    if (empresaAtiva?.id === empresaId) {
      setArquivosPendentes(arquivos);
      setArquivosPendentesEmpresaId(empresaId);
      setErroArquivosPendentes(null);
    }
  };

  const baixarArquivoPendente = async (arquivo: ArquivoFiscalPendenteResumo) => {
    try {
      const registro = await obterArquivoFiscalPendenteLocal(arquivo.id, arquivo.empresaId);
      if (!registro) throw new Error('O arquivo original não foi encontrado neste navegador.');
      const url = URL.createObjectURL(registro.conteudo);
      const link = document.createElement('a');
      link.href = url;
      link.download = registro.nomeArquivo.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'documento-fiscal';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMensagemRadar(`Download do original ${registro.nomeArquivo} solicitado ao navegador. O arquivo continua pendente de interpretação.`);
    } catch (error) {
      setMensagemRadar(error instanceof Error ? error.message : 'Não foi possível recuperar o arquivo original.');
    }
  };

  const excluirArquivoPendente = async (arquivo: ArquivoFiscalPendenteResumo) => {
    const nomeEmpresa = empresaAtiva?.id === arquivo.empresaId ? empresaAtiva.razaoSocial : `empresa ${arquivo.empresaId}`;
    if (!window.confirm(`Excluir o original "${arquivo.nomeArquivo}" de ${nomeEmpresa}, guardado localmente? Esta ação não pode ser desfeita.`)) return;
    try {
      await apagarArquivoFiscalPendenteLocal(arquivo.id, arquivo.empresaId);
      await recarregarArquivosPendentes(arquivo.empresaId);
      notificarAtualizacaoDadosFiscais();
      setMensagemRadar(`Arquivo pendente ${arquivo.nomeArquivo} excluído deste navegador.`);
    } catch (error) {
      setMensagemRadar(error instanceof Error ? error.message : 'Não foi possível excluir o arquivo pendente.');
    }
  };

  const handleImportarXmlRadar = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!empresaAtiva?.id) { setMensagemRadar('Selecione uma empresa cadastrada antes de importar XML.'); return; }
    if (!radarPronto) {
      setMensagemRadar('Importação aguardando a leitura do Radar da empresa selecionada. Tente novamente em instantes.');
      if (inputXmlRef.current) inputXmlRef.current.value = '';
      return;
    }
    if (erroLeituraRadar) {
      setMensagemRadar(`Importação bloqueada: a lista atual do Radar não pôde ser validada (${erroLeituraRadar}). Limpe o Radar desta empresa somente se aceitar apagar a lista ilegível e os XMLs locais.`);
      if (inputXmlRef.current) inputXmlRef.current.value = '';
      return;
    }
    const empresaId = empresaAtiva.id;
    const empresaCnpj = empresaAtiva.cnpj ?? '';
    const regimeEmpresa = regimeFiltro;
    const ufEmpresa = ufFiltro;
    const importadas: NotaRadar[] = [];
    const erros: string[] = [];
    const preservados: string[] = [];
    let persistidasNoPostgres = 0;
    let radarPersistido = [...notasRadar];
    const leituraLivro = lerNotasFiscaisEmpresa(empresaId);
    if ('erro' in leituraLivro) {
      setMensagemRadar(`Importação interrompida: não foi possível ler o livro fiscal local (${leituraLivro.erro}). Nenhum XML foi salvo.`);
      if (inputXmlRef.current) inputXmlRef.current.value = '';
      return;
    }
    const livrosSalvos = leituraLivro.notas;
    const chavesNoLivro = new Set([...livrosSalvos.saidas, ...livrosSalvos.entradas].map(n => n.chave).filter(Boolean));
    for (const file of Array.from(files)) {
      if (empresaAtivaIdRef.current !== empresaId) {
        setMensagemRadar('Importação cancelada porque a empresa selecionada mudou. Nenhum arquivo restante foi associado à nova empresa.');
        if (inputXmlRef.current) inputXmlRef.current.value = '';
        return;
      }
      try {
        if (!/\.xml$/i.test(file.name)) {
          const motivo = 'Formato recebido, mas ainda sem leitor neste Radar. Nenhum lançamento ou classificação fiscal foi feito.';
          try {
            await salvarArquivoFiscalPendenteLocal({ empresaId, nomeArquivo: file.name, motivo, arquivo: file });
            preservados.push(file.name);
          } catch (error) {
            erros.push(`${file.name}: formato não interpretado e o original não pôde ser preservado (${error instanceof Error ? error.message : 'falha no armazenamento local'}).`);
          }
          continue;
        }
        if (file.size > 25 * 1024 * 1024) {
          erros.push(`${file.name}: arquivo acima do limite local de 25 MB; não foi lido nem salvo.`);
          continue;
        }
        const xml = await file.text();
        if (empresaAtivaIdRef.current !== empresaId) {
          setMensagemRadar('Importação cancelada porque a empresa selecionada mudou durante a leitura. O arquivo não foi associado à empresa nova.');
          if (inputXmlRef.current) inputXmlRef.current.value = '';
          return;
        }
        const nota = importarXmlNfe(xml, file.name, empresaCnpj, regimeEmpresa, ufEmpresa);
        const duplicadaNoRadar = Boolean(nota.chave && radarPersistido.some(n => n.chave === nota.chave));
        const duplicadaNoLivro = Boolean(nota.chave && chavesNoLivro.has(nota.chave));
        if (duplicadaNoRadar) {
          const original = await obterXmlFiscalPorChaveEmpresa(empresaId, nota.chave);
          if (original && original.conteudo !== xml) {
            const motivo = 'A chave já existe no Radar com conteúdo diferente. O XML anterior foi preservado e este arquivo foi separado para revisão.';
            await salvarArquivoFiscalPendenteLocal({ empresaId, nomeArquivo: file.name, motivo, arquivo: file });
            preservados.push(file.name);
            continue;
          }
          erros.push(`${file.name}: ${original ? 'XML idêntico já importado' : 'chave já existe no Radar'}; nenhum registro foi duplicado.`);
          continue;
        }
        if (empresaAtiva.idCentral && empresaAtiva.tenantIdCentral
          && !nota.ocorrencias.some(ocorrencia => ocorrencia.severidade === 'ERRO')) {
          try {
            const resposta = await fetch(`/api/companies/${encodeURIComponent(empresaAtiva.idCentral)}/fiscal-documents`, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/xml',
                'X-FiscoIA-Tenant-Id': empresaAtiva.tenantIdCentral,
              },
              body: xml,
            });
            const resultado = await resposta.json().catch(() => ({}));
            if (!resposta.ok || resultado?.documento?.status !== 'PENDING_REVIEW' || resultado?.xmlCriptografadoNoPostgreSQL !== true) {
              erros.push(`${file.name}: o XML não foi confirmado no banco permanente (${resultado?.mensagem || 'resposta inválida do servidor'}). A cópia local será mantida separadamente.`);
            } else {
              persistidasNoPostgres += 1;
            }
          } catch {
            erros.push(`${file.name}: não foi possível confirmar o armazenamento permanente. A cópia local será mantida separadamente.`);
          }
        }
        let xmlLocalId: string;
        try {
          xmlLocalId = await salvarXmlFiscalLocal({ empresaId, chave: nota.chave, nomeArquivo: file.name, conteudo: xml });
        } catch (error) {
          const motivo = error instanceof Error ? error.message : 'chave já associada a outro XML';
          await salvarArquivoFiscalPendenteLocal({ empresaId, nomeArquivo: file.name, motivo: `Conflito de chave NF-e: ${motivo}`, arquivo: file });
          preservados.push(file.name);
          continue;
        }
        nota.xmlLocalId = xmlLocalId;
        if (empresaAtivaIdRef.current !== empresaId || !salvarNotasRadar([nota, ...radarPersistido])) {
          try {
            await apagarXmlFiscalLocal(xmlLocalId);
            erros.push(`${file.name}: XML removido do armazenamento porque não foi possível registrar o documento no Radar.`);
          } catch {
            erros.push(`${file.name}: não foi possível atualizar o Radar nem remover o XML original isolado do armazenamento local (ID ${xmlLocalId}).`);
          }
          continue;
        }
        radarPersistido = [nota, ...radarPersistido];
        importadas.push(nota);
        if (duplicadaNoLivro) {
          erros.push(`${file.name}: a chave já existe no livro local; o XML foi mantido no Radar para revisão.`);
        } else if (nota.situacaoProtocolo === 'PROTOCOLO_DECLARADO_NO_XML' || nota.situacaoProtocolo === 'AUTORIZADA_NO_XML') {
          erros.push(`${file.name}: protocolo consta no XML, mas não foi autenticado. O documento ficou somente no Radar e não alterou o livro fiscal.`);
        } else {
          erros.push(`${file.name}: documento mantido somente no Radar; resposta/autorização não confirmada no XML.`);
        }
      } catch (error) {
        const motivoErro = error instanceof Error ? error.message : 'falha de leitura';
        if (motivoErro.includes('não consta como emitente nem destinatário')) {
          erros.push(`${file.name}: o CNPJ da empresa selecionada não consta no documento; não foi associado nem armazenado nesta empresa.`);
          continue;
        }
        try {
          const motivo = `Leitura não concluída: ${motivoErro}. O original foi guardado para revisão; não houve lançamento fiscal.`;
          await salvarArquivoFiscalPendenteLocal({ empresaId, nomeArquivo: file.name, motivo, arquivo: file });
          preservados.push(file.name);
        } catch (erroArmazenamento) {
          erros.push(`${file.name}: falha de leitura (${motivoErro}) e o original não pôde ser preservado (${erroArmazenamento instanceof Error ? erroArmazenamento.message : 'falha no armazenamento local'}).`);
        }
      }
    }
    if (preservados.length) {
      try {
        await recarregarArquivosPendentes(empresaId);
        notificarAtualizacaoDadosFiscais();
      }
      catch (error) { erros.push(`Os arquivos foram recebidos, mas a lista não pôde ser atualizada (${error instanceof Error ? error.message : 'erro local'}).`); }
    }
    if (empresaAtivaIdRef.current !== empresaId) {
      if (inputXmlRef.current) inputXmlRef.current.value = '';
      return;
    }
    const resumoPostgres = persistidasNoPostgres
      ? `${persistidasNoPostgres} XML(s) também persistido(s), criptografado(s), no PostgreSQL e mantido(s) pendente(s) de revisão. `
      : 'Nenhum XML foi confirmado no PostgreSQL; as cópias interpretadas permanecem apenas neste navegador. ';
    setMensagemRadar(`${importadas.length} NF-e/NFC-e interpretada(s) e salva(s) no Radar local; ${preservados.length} arquivo(s) preservado(s) como pendente(s) de interpretação. ${resumoPostgres}Nada foi transmitido, autenticado ou escriturado. Formatos pendentes não foram classificados como notas.${erros.length ? ` ${erros.join(' ')}` : ''}`);
    if (inputXmlRef.current) inputXmlRef.current.value = '';
  };

  const baixarXmlRadarLocal = async (nota: NotaRadar) => {
    if (!nota.xmlLocalId) {
      setMensagemRadar(`O XML original de ${nota.origemArquivo} não está disponível neste navegador. Registros migrados de versões anteriores guardam apenas os dados extraídos.`);
      return;
    }
    try {
      const registro = await obterXmlFiscalLocal(nota.xmlLocalId);
      if (!registro) throw new Error('O original não foi encontrado no armazenamento deste navegador.');
      const blob = new Blob([registro.conteudo], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const nomeSeguro = registro.nomeArquivo.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'nota-fiscal.xml';
      link.download = nomeSeguro;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMensagemRadar(`Download do XML ${nomeSeguro} solicitado ao navegador a partir do armazenamento local.`);
    } catch (error) {
      setMensagemRadar(error instanceof Error ? error.message : 'Não foi possível recuperar o XML original deste navegador.');
    }
  };

  const limparRadarDaEmpresa = async () => {
    if (!empresaAtiva?.id) return;
    if (!radarPronto) {
      setMensagemRadar('Aguarde a leitura do Radar da empresa selecionada antes de apagá-lo.');
      return;
    }
    if (!window.confirm('Apagar os documentos do Radar, os XMLs originais e todos os arquivos pendentes guardados neste navegador para esta empresa? Esta ação não pode ser desfeita.')) return;
    if (erroLeituraRadar) {
      const chaveRadar = `fiscoia_radar_xml_${empresaAtiva.id}`;
      let conteudoAnterior: string | null = null;
      try {
        conteudoAnterior = localStorage.getItem(chaveRadar);
        localStorage.removeItem(chaveRadar);
        await apagarXmlsFiscaisEmpresa(empresaAtiva.id);
        setNotasRadar([]);
        setErroLeituraRadar(null);
        setRadarEmpresaId(empresaAtiva.id);
        setMensagemRadar('A lista ilegível do Radar, os XMLs originais e os arquivos pendentes locais foram apagados para esta empresa.');
      } catch (error) {
        try {
          if (conteudoAnterior !== null) localStorage.setItem(chaveRadar, conteudoAnterior);
        } catch {}
        setMensagemRadar(`Não foi possível confirmar a limpeza completa. O conteúdo anterior do Radar foi restaurado quando possível. ${error instanceof Error ? error.message : ''}`.trim());
      }
      return;
    }
    if (!salvarNotasRadar([])) {
      setMensagemRadar('Não foi possível limpar a lista do Radar neste navegador.');
      return;
    }
    try {
      await apagarXmlsFiscaisEmpresa(empresaAtiva.id);
      setMensagemRadar('Documentos do Radar, XMLs originais e arquivos pendentes locais apagados para esta empresa.');
    } catch (error) {
      if (salvarNotasRadar(notasRadar)) {
        setMensagemRadar(`Não foi possível apagar todos os documentos locais; a lista do Radar foi restaurada para evitar perda dos registros. ${error instanceof Error ? error.message : ''}`.trim());
      } else {
        setNotasRadar(notasRadar);
        setMensagemRadar(`Falha ao excluir XMLs e ao restaurar o Radar no armazenamento. Os registros ainda estão visíveis nesta sessão; exporte o relatório antes de sair. ${error instanceof Error ? error.message : ''}`.trim());
      }
    }
  };

  const notasRadarVisiveis = radarPronto ? notasRadar : [];
  const radarResumoDisponivel = radarPronto && !erroLeituraRadar;
  const resultadoRadar = conferirNotasRadar(notasRadarVisiveis);
  const listaRadarFiltrada = notasRadarVisiveis.filter(n => {
    const termo = filtroRadar.trim().toLowerCase();
    const busca = !termo || [n.numero, n.chave, n.clienteOuFornecedor, n.cnpjParceiro, n.cfop].some(v => String(v ?? '').toLowerCase().includes(termo));
    const periodo = !filtroPeriodoRadar || n.dataEmissao.startsWith(filtroPeriodoRadar);
    return busca && periodo;
  });
  const quantidadeComAlerta = notasRadarVisiveis.filter(n => (resultadoRadar.get(n.chave || `${n.origemArquivo}-${n.numero}`) ?? []).length > 0).length;

  const executarConferenciaRadar = useCallback(() => {
    if (!empresaAtiva?.id || radarEmpresaId !== empresaAtiva.id) {
      setMensagemRadar('Conferência aguardando a leitura do Radar da empresa selecionada.');
      return;
    }
    let documentos = notasRadar;
    if (empresaAtiva?.id) {
      try {
        const salvo = localStorage.getItem(`fiscoia_radar_xml_${empresaAtiva.id}`);
        documentos = salvo ? validarListaNotasRadar(JSON.parse(salvo)) : [];
        if (salvo !== JSON.stringify(notasRadar)) setNotasRadar(documentos);
        setErroLeituraRadar(null);
      } catch {
        setErroLeituraRadar('formato inválido ou campos essenciais corrompidos');
        setMensagemRadar('Conferência interrompida: não foi possível ler os dados locais do Radar. A lista atual foi preservada; não foi inferida ausência de documentos.');
        return;
      }
    }
    const achados = conferirNotasRadar(documentos);
    const alertas = documentos.reduce((total, n) => total + (achados.get(n.chave || `${n.origemArquivo}-${n.numero}`)?.length ?? 0), 0);
    setUltimaConferenciaRadar(new Date().toLocaleString('pt-BR'));
    if (alertas > 0) {
      setMensagemRadar(`Robô Radar: encontrei ${alertas} alerta(s) em ${documentos.length} XML(s) importado(s). Revise a coluna Conferência.`);
    }
    else if (documentos.length) {
      setMensagemRadar(`Robô Radar: conferi ${documentos.length} XML(s) importado(s); nenhum alerta estrutural encontrado. A origem oficial não foi consultada.`);
    } else setMensagemRadar('Robô Radar: não há XML importado para analisar. Consulta a portais oficiais indisponível neste ambiente.');
  }, [empresaAtiva?.id, notasRadar, radarEmpresaId]);

  // Estimativa local do período atual com notas cuja data de emissão corresponde ao mês.
  const dataPeriodoApuracao = new Date();
  const mesApuracao = String(dataPeriodoApuracao.getMonth() + 1).padStart(2, '0');
  const anoApuracao = String(dataPeriodoApuracao.getFullYear());
  const periodoApuracao = `${anoApuracao}-${mesApuracao}`;
  const saidasPeriodo = notasSaida.filter(n => n.dataEmissao?.startsWith(periodoApuracao));
  const entradasPeriodo = notasEntrada.filter(n => n.dataEmissao?.startsWith(periodoApuracao));
  const resumoAtual: ResumoTributosInformados = FISCOIA_FISCAL.resumirTributosInformados(
    saidasPeriodo,
    entradasPeriodo,
    mesApuracao,
    anoApuracao
  );

  const abrirRegistroPagamento = (nota: NotaFiscalItem) => {
    if (!empresaAtiva?.id) {
      setAlerta({ tipo: 'info', texto: 'Selecione uma empresa antes de registrar um pagamento.' });
      return;
    }
    const jaInformado = obterValorPagoInformado(nota);
    const restante = Math.max(0, nota.valorTotal - jaInformado);
    setNotaSelecionadaParaBaixa(nota);
    setEmpresaIdNotaBaixa(empresaAtiva.id);
    setValorPagoInput(restante.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setDataPagoInput(hojeLocalISO());
  };

  // Registrar baixa de nota
  const handleConfirmarBaixa = () => {
    if (!notaSelecionadaParaBaixa) return;
    if (!empresaAtiva?.id || empresaIdNotaBaixa !== empresaAtiva.id) {
      fecharModalBaixa();
      setAlerta({ tipo: 'info', texto: 'A nota selecionada pertence a outra empresa. Selecione a empresa correta e tente novamente; nada foi salvo.' });
      return;
    }
    const v = lerValorMoeda(valorPagoInput);
    const dataPagamento = /^\d{4}-\d{2}-\d{2}$/.test(dataPagoInput) ? new Date(`${dataPagoInput}T12:00:00`) : null;
    const dataValida = Boolean(dataPagamento && !Number.isNaN(dataPagamento.getTime())
      && dataPagamento.getFullYear() === Number(dataPagoInput.slice(0, 4))
      && dataPagamento.getMonth() + 1 === Number(dataPagoInput.slice(5, 7))
      && dataPagamento.getDate() === Number(dataPagoInput.slice(8, 10)));
    if (!Number.isFinite(v) || v <= 0 || !dataValida || !Number.isFinite(notaSelecionadaParaBaixa.valorTotal) || notaSelecionadaParaBaixa.valorTotal <= 0) {
      setAlerta({ tipo: 'info', texto: 'Informe um valor positivo em formato monetário válido, uma data existente e confirme que a nota tem total válido.' });
      return;
    }
    if (!Number.isFinite(saldoInformadoRestante) || saldoInformadoRestante <= 0 || v > saldoInformadoRestante + 0.009) {
      setAlerta({
        tipo: 'info',
        texto: `O valor informado excede o saldo local restante de R$ ${Math.max(0, saldoInformadoRestante || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Nenhuma informação foi salva.`
      });
      return;
    }
    const listaBase = notaSelecionadaParaBaixa.tipo === 'SAIDA' ? notasSaida : notasEntrada;
    const indiceNota = listaBase.findIndex(n => n.tipo === notaSelecionadaParaBaixa.tipo && (
      n === notaSelecionadaParaBaixa || Boolean(notaSelecionadaParaBaixa.chave && n.chave === notaSelecionadaParaBaixa.chave)
    ));
    if (indiceNota < 0) {
      setAlerta({ tipo: 'info', texto: 'A nota selecionada não foi encontrada no livro atual. Nenhum pagamento foi salvo.' });
      return;
    }
    let notaAtualizada: NotaFiscalItem;
    try {
      notaAtualizada = registrarPagamentoInformado(listaBase[indiceNota], v, dataPagoInput);
    } catch (error) {
      setAlerta({ tipo: 'info', texto: `${error instanceof Error ? error.message : 'Não foi possível validar o pagamento local.'} Nenhuma informação foi salva.` });
      return;
    }
    const listaAtualizada = listaBase.map((nota, indice) => indice === indiceNota ? notaAtualizada : nota);
    const saidasAtualizadas = notaSelecionadaParaBaixa.tipo === 'SAIDA' ? listaAtualizada : notasSaida;
    const entradasAtualizadas = notaSelecionadaParaBaixa.tipo === 'ENTRADA' ? listaAtualizada : notasEntrada;
    const valorAcumulado = notaAtualizada.valorPago ?? 0;
    const pagamentoCompleto = notaAtualizada.status === 'PAGA_INFORMADA';
    if (!salvarNotasFiscaisEmpresa(empresaAtiva.id, { saidas: saidasAtualizadas, entradas: entradasAtualizadas })) {
      setAlerta({ tipo: 'info', texto: 'Não foi possível salvar o registro de pagamento neste navegador.' });
      return;
    }
    setNotasSaida(saidasAtualizadas);
    setNotasEntrada(entradasAtualizadas);

    setAlerta({
      tipo: 'info',
      texto: `${pagamentoCompleto ? 'Pagamento total' : `Pagamento parcial (R$ ${valorAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de R$ ${notaSelecionadaParaBaixa.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`} da nota nº ${notaSelecionadaParaBaixa.numero} informado manualmente e salvo neste navegador. Banco e SEFAZ não foram consultados.`
    });
    fecharModalBaixa();
    setTimeout(() => setAlerta(null), 4000);
  };

  // Notas vencidas
  const notasVencidas = FISCOIA_FISCAL.BAIXA_NOTAS.verificarVencidas([...notasSaida, ...notasEntrada]);
  const valorJaInformado = notaSelecionadaParaBaixa
    ? obterValorPagoInformado(notaSelecionadaParaBaixa)
    : 0;
  const saldoInformadoRestante = notaSelecionadaParaBaixa
    ? Math.max(0, notaSelecionadaParaBaixa.valorTotal - valorJaInformado)
    : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-16">
      {/* CABEÇALHO */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onVoltar && (
            <button
              type="button"
              onClick={onVoltar}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-[#0F2B5B] flex items-center gap-2">
                <span>🇧🇷 MURADE FISCAL — ROTINAS LOCAIS</span>
              </h1>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-blue-300">
                v3.2.1
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Notas importadas • Conferência local • Resumo de campos fiscais • Calculadora manual
            </p>
          </div>
        </div>

        {/* BOTÃO EM DESTAQUE: CALCULADORA FISCAL */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setModalCalcAberta(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition-all hover:scale-105 cursor-pointer border border-amber-300"
          >
            <Calculator className="w-4 h-4 text-slate-950" />
            <span>🧮 ABRIR CALCULADORA FISCAL</span>
          </button>
        </div>
      </div>

      {/* ESTADO DE CONEXÃO: NÃO APRESENTAR VALIDAÇÃO LOCAL COMO CONSULTA OFICIAL */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0F2B5B] to-slate-800 text-white p-3.5 rounded-2xl border border-slate-500/40 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-white tracking-wide">
                MURADE FISCAL — CONFERÊNCIA DE XML
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded-full font-mono font-bold border border-amber-400/30">
                Consulta oficial: não conectada
              </span>
            </div>
            <p className="text-[11px] text-emerald-100/80 mt-0.5">
              Importe documentos da empresa e confira estrutura, duplicidades e campos para revisão. A conferência local não autentica a origem na SEFAZ.
            </p>
          </div>
        </div>

      </div>

      {/* NOTIFICAÇÃO */}
      {alerta && (
        <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 shadow-xs ${
          alerta.tipo === 'sucesso' 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
            : 'bg-blue-50 border-blue-300 text-blue-900'
        }`}>
          {alerta.tipo === 'sucesso' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />}
          <span>{alerta.texto}</span>
        </div>
      )}

      {/* BARRA DE NAVEGAÇÃO ENTRE ABAS DO FISCAL */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'radar', rotulo: '🛡️ Radar / Conferência', count: !empresaAtiva?.id ? 'sem empresa' : !radarPronto ? 'carregando' : erroLeituraRadar ? 'falha de leitura' : quantidadeComAlerta ? `${quantidadeComAlerta} alertas` : notasRadarVisiveis.length },
            { id: 'saida', rotulo: '📤 NFe de Saída', count: notasSaida.length },
            { id: 'entrada', rotulo: '📥 NFe de Entrada', count: notasEntrada.length },
            { id: 'baixa', rotulo: '✅ Pagamentos e Vencimentos', badge: notasVencidas.length > 0 ? `${notasVencidas.length} Vencidas` : undefined },
            { id: 'apuracao', rotulo: '⚖️ Resumo dos XMLs' },
            { id: 'calculadora', rotulo: '🧮 Calculadora Fiscal', destaque: true }
          ].map(tab => {
            const ativa = abaAtiva === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAbaAtiva(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  ativa
                    ? 'bg-[#165DFF] text-white shadow-sm'
                    : tab.destaque
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{tab.rotulo}</span>
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${ativa ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-black bg-rose-100 text-rose-800 border border-rose-300">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* SELETORES GLOBAIS DE UF E REGIME VINCULADOS À EMPRESA */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
          {empresaAtiva && (
            <div className="hidden md:flex items-center gap-1.5 bg-indigo-50/80 px-2.5 py-1.5 rounded-xl border border-indigo-200">
              <Building2 className="w-3.5 h-3.5 text-indigo-700" />
              <span className="font-bold text-indigo-950 truncate max-w-[150px]" title={empresaAtiva.razaoSocial}>
                {empresaAtiva.razaoSocial}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-slate-400 font-bold">UF:</span>
            <select
              value={ufFiltro}
              onChange={(e) => setUfFiltro(e.target.value as UF)}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
            >
              {FISCOIA_FISCAL.UFS.map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border-2 border-indigo-300 shadow-2xs">
            <span className="text-indigo-950 font-extrabold">Regime:</span>
            <select
              value={regimeFiltro}
              onChange={(e) => handleAlterarRegime(e.target.value as RegimeTributario)}
              className="bg-transparent font-black text-indigo-900 outline-none cursor-pointer"
              title="Selecione para configurar e salvar automaticamente o regime fiscal desta empresa"
            >
              <option value="SIMPLES">Simples Nacional</option>
              <option value="PRESUMIDO">Lucro Presumido</option>
              <option value="REAL">Lucro Real</option>
            </select>
            <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5" title="Regime salvo no cadastro local desta empresa, neste navegador; não sincroniza com outros dispositivos">
              <Check className="w-2.5 h-2.5 text-amber-700" /> Local
            </span>
          </div>
        </div>
      </div>

      {abaAtiva === 'radar' && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-[#0F2B5B]">Radar fiscal — conferência de documentos</h2>
              <p className="text-xs text-slate-600 mt-1 max-w-3xl">O Radar interpreta XML de NF-e modelo 55 e NFC-e modelo 65. Outros arquivos selecionados ficam guardados nesta fila local, separados por empresa, até existir um leitor compatível.</p>
              <p className="text-[11px] text-amber-800 mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2">A conferência do Radar local analisa os arquivos importados. A consulta oficial, quando configurada, aparece no painel azul abaixo e precisa de confirmação explícita. Uma resposta da distribuição não substitui manifestação, escrituração ou revisão do contador.</p>
              <p className="text-[11px] text-slate-700 mt-2 bg-slate-50 border border-slate-200 rounded-lg p-2">A Distribuição DF-e pode fornecer documentos e eventos de interesse do CNPJ. O XML completo depende das regras de distribuição e manifestação. Este serviço não entrega, por si só, as notas emitidas pela própria empresa; notas de saída precisam vir do emissor/ERP ou de outra fonte autorizada. <a href="https://www.nfe.fazenda.gov.br/Portal/exibirArquivo.aspx?AspxAutoDetectCookieSupport=1&amp;conteudo=Enkznb1F1SM%3D" target="_blank" rel="noreferrer" className="font-semibold underline">Regras oficiais</a>.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 p-1">
                <label className="sr-only" htmlFor="fiscoia-sync-desde">Data inicial da sincronização</label>
                <input id="fiscoia-sync-desde" aria-label="Data inicial da sincronização" type="date" value={periodoSyncDesde} onChange={e => { setPeriodoSyncDesde(e.target.value); setCursorSyncFiscal(null); }} className="max-w-32 rounded border border-indigo-200 bg-white px-1.5 py-1 text-[10px]" />
                <span className="text-[10px] text-indigo-800">até</span>
                <label className="sr-only" htmlFor="fiscoia-sync-ate">Data final da sincronização</label>
                <input id="fiscoia-sync-ate" aria-label="Data final da sincronização" type="date" value={periodoSyncAte} onChange={e => { setPeriodoSyncAte(e.target.value); setCursorSyncFiscal(null); }} className="max-w-32 rounded border border-indigo-200 bg-white px-1.5 py-1 text-[10px]" />
                <button type="button" onClick={() => void sincronizarDocumentosMuradeFiscal()} disabled={!empresaAtiva?.idCentral || !empresaAtiva?.tenantIdCentral || sincronizandoFiscalCentral} className="px-2 py-1.5 rounded-md bg-indigo-700 text-white text-[10px] font-bold disabled:opacity-50">
                  <RefreshCw className={`w-3 h-3 inline mr-1 ${sincronizandoFiscalCentral ? 'animate-spin' : ''}`} />{sincronizandoFiscalCentral ? 'Sincronizando…' : cursorSyncFiscal ? 'Continuar sincronização' : 'Trazer do Murade Fiscal'}
                </button>
              </div>
              <button type="button" onClick={executarConferenciaRadar} className="px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold">Conferir agora</button>
              <input ref={inputXmlRef} type="file" multiple className="hidden" onChange={e => void handleImportarXmlRadar(e.target.files)} />
              <button type="button" onClick={() => inputXmlRef.current?.click()} disabled={!empresaAtiva?.id || !radarPronto || Boolean(erroLeituraRadar)} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50"><Upload className="w-3.5 h-3.5 inline mr-1"/>Importar documentos</button>
              <button type="button" onClick={() => {
                const blob = new Blob([exportarRelatorioRadarCsv(listaRadarFiltrada, resultadoRadar)], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `radar-fiscal-${empresaAtiva?.cnpj ?? 'empresa'}.csv`; a.click(); URL.revokeObjectURL(url);
              }} disabled={!listaRadarFiltrada.length} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold disabled:opacity-50"><Download className="w-3.5 h-3.5 inline mr-1"/>Exportar CSV</button>
            </div>
          </div>
          <ConsultaSefazDfePanel companyId={empresaAtiva?.idCentral} tenantId={empresaAtiva?.tenantIdCentral} cnpj={empresaAtiva?.cnpj} />
          {!radarPronto && empresaAtiva?.id && <div role="status" className="text-xs bg-slate-50 text-slate-700 border border-slate-200 p-3 rounded-lg">Carregando o Radar da empresa selecionada. As listas de outras empresas ficam ocultas até a leitura terminar.</div>}
          {radarPronto && erroLeituraRadar && <div role="alert" className="text-xs bg-rose-50 text-rose-900 border border-rose-200 p-3 rounded-lg"><strong>Radar local indisponível:</strong> {erroLeituraRadar}. Os registros não foram substituídos. Importe novamente somente depois de corrigir ou limpar explicitamente esta lista.</div>}
          {radarPronto && estadoSincronizacaoCentral && <div role="status" className={`text-xs border p-3 rounded-lg ${estadoSincronizacaoCentral.startsWith('Não foi possível') ? 'bg-amber-50 text-amber-950 border-amber-300' : 'bg-sky-50 text-sky-950 border-sky-200'}`}>{estadoSincronizacaoCentral}</div>}
          {erroArquivosPendentes && arquivosPendentesEmpresaId === empresaAtiva?.id && <div role="alert" className="text-xs bg-rose-50 text-rose-900 border border-rose-200 p-3 rounded-lg"><strong>Fila de arquivos pendentes indisponível:</strong> {erroArquivosPendentes}</div>}
          {mensagemRadar && <div role="status" className="text-xs bg-blue-50 text-blue-900 border border-blue-200 p-3 rounded-lg">{mensagemRadar}</div>}
          {arquivosPendentesVisiveis.length > 0 && <section className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2" aria-label="Arquivos fiscais pendentes de interpretação">
            <div><h3 className="text-sm font-bold text-amber-950">Arquivos recebidos, pendentes de interpretação ({arquivosPendentesVisiveis.length})</h3><p className="text-[11px] text-amber-900">Estes originais não são notas escrituradas nem documentos conferidos. Baixe para abrir em outro sistema ou exclua quando não precisar mais.</p></div>
            <div className="overflow-x-auto rounded-lg border border-amber-200 bg-white"><table className="w-full text-left text-xs"><thead className="bg-amber-100 text-amber-950"><tr><th className="p-2">Arquivo</th><th className="p-2">Tamanho</th><th className="p-2">Motivo</th><th className="p-2 text-right">Ações</th></tr></thead><tbody className="divide-y divide-amber-100">{arquivosPendentesVisiveis.map(arquivo => <tr key={arquivo.id} className="align-top"><td className="p-2"><strong>{arquivo.nomeArquivo}</strong><div className="text-[10px] text-slate-500">{arquivo.tipoMime} · recebido {new Date(arquivo.importadoEm).toLocaleString('pt-BR')}</div></td><td className="p-2 whitespace-nowrap">{(arquivo.tamanho / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KB</td><td className="p-2 min-w-64">{arquivo.motivo}</td><td className="p-2 text-right whitespace-nowrap"><button type="button" onClick={() => void baixarArquivoPendente(arquivo)} className="rounded border px-2 py-1 font-semibold text-blue-800">Baixar original</button> <button type="button" onClick={() => void excluirArquivoPendente(arquivo)} className="rounded border border-rose-200 px-2 py-1 font-semibold text-rose-800">Excluir</button></td></tr>)}</tbody></table></div>
          </section>}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-50 border rounded-lg p-3">
            <div><strong className="text-slate-800">Monitor automático da carteira</strong><span className="text-slate-500"> · a verificação automática e as notificações são centralizadas no aviso fixo inferior; rodam a cada 5 minutos enquanto o Murade estiver aberto e analisam somente dados locais</span><div className="text-slate-500 mt-0.5">Última conferência manual desta empresa: {ultimaConferenciaRadar ?? 'ainda não executada com sucesso'}</div></div>
            <span className="px-3 py-1.5 rounded-lg border bg-white font-bold text-slate-600">Consulta oficial sob demanda</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border"><div className="text-[11px] text-slate-500">XML importados</div><strong className="text-xl">{radarResumoDisponivel ? notasRadarVisiveis.length : '—'}</strong></div>
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100"><div className="text-[11px] text-rose-700">Documentos com alertas</div><strong className="text-xl text-rose-800">{radarResumoDisponivel ? quantidadeComAlerta : '—'}</strong></div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100"><div className="text-[11px] text-amber-800">Chaves repetidas</div><strong className="text-xl text-amber-900">{radarResumoDisponivel ? Array.from(resultadoRadar.values()).filter(lista => lista.some(i => i.codigo === 'CHAVE_DUPLICADA')).length : '—'}</strong></div>
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100"><div className="text-[11px] text-indigo-800">Empresa</div><strong className="text-sm text-indigo-950">{empresaAtiva?.razaoSocial ?? 'Selecione uma empresa'}</strong></div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex items-center gap-2 px-3 py-2 border rounded-lg flex-1"><Search className="w-4 h-4 text-slate-400"/><input aria-label="Pesquisar documentos" className="outline-none text-xs w-full" placeholder="Pesquisar número, chave, parceiro, CNPJ ou CFOP" value={filtroRadar} onChange={e => setFiltroRadar(e.target.value)}/></label>
            <label className="flex items-center gap-2 px-3 py-2 border rounded-lg text-xs text-slate-600"><Calendar className="w-4 h-4"/><input aria-label="Filtrar por mês" type="month" value={filtroPeriodoRadar} onChange={e => setFiltroPeriodoRadar(e.target.value)} className="outline-none"/></label>
            <button type="button" onClick={() => void limparRadarDaEmpresa()} disabled={!radarPronto || (!notasRadarVisiveis.length && !arquivosPendentesVisiveis.length && !erroLeituraRadar)} className="px-3 py-2 border border-rose-200 text-rose-700 rounded-lg text-xs font-bold disabled:opacity-50">{erroLeituraRadar ? 'Limpar Radar ilegível e documentos locais' : 'Apagar Radar e documentos locais'}</button>
          </div>
          {!empresaAtiva?.id && <p className="text-xs text-rose-700">Selecione uma empresa para usar o Radar por CNPJ.</p>}
          {listaRadarFiltrada.length ? <div className="overflow-x-auto border rounded-xl"><table className="w-full text-left text-xs"><thead className="bg-slate-50"><tr>{['Emissão','Documento','Direção','Parceiro','CFOP','Total','Conferência'].map(t => <th key={t} className="p-3">{t}</th>)}</tr></thead><tbody className="divide-y">{listaRadarFiltrada.map((n, index) => {
            const issues = resultadoRadar.get(n.chave || `${n.origemArquivo}-${n.numero}`) ?? [];
            const statusProtocolo = n.situacaoProtocolo ?? 'SEM_PROTOCOLO';
            const protocoloDeclarado = statusProtocolo === 'PROTOCOLO_DECLARADO_NO_XML' || statusProtocolo === 'AUTORIZADA_NO_XML';
            const respostaNegativa = statusProtocolo === 'RESPOSTA_NAO_AUTORIZADA_NO_XML' || statusProtocolo === 'NAO_AUTORIZADA_NO_XML';
            const textoProtocolo = protocoloDeclarado
              ? `XML declara cStat ${n.codigoProtocolo || 'ausente'} e nProt; não autenticados`
              : respostaNegativa
                ? `Arquivo contém resposta sem código de autorização (cStat ${n.codigoProtocolo || 'ausente'}); não verificada`
                : 'Sem protocolo no arquivo';
            const totalIndisponivel = n.camposNumericosIndisponiveis?.includes('VNF');
            return <tr key={`${n.chave}-${index}`} className="align-top"><td className="p-3 whitespace-nowrap">{n.dataEmissao}</td><td className="p-3"><strong>{n.numero}</strong><div className="text-[10px] text-slate-600">{n.modeloDocumento === '65' ? 'NFC-e · modelo 65' : n.modeloDocumento === '55' ? 'NF-e · modelo 55' : 'Modelo não registrado'}</div><div className="font-mono text-[10px] text-slate-500">{n.chave || 'Sem chave'}</div></td><td className="p-3">{n.tipo}</td><td className="p-3">{n.clienteOuFornecedor}<div className="text-[10px] text-slate-500">{n.tipoDocumentoParceiro ? `${n.tipoDocumentoParceiro}: ` : ''}{n.cnpjParceiro || 'Documento não informado'}</div></td><td className="p-3">{n.cfop || '—'}</td><td className="p-3 whitespace-nowrap">{totalIndisponivel ? <span className="text-amber-800">Não disponível</span> : `R$ ${n.valorTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}`}</td><td className="p-3 min-w-56">{issues.length ? <ul className="space-y-1">{issues.map((i,j) => <li key={`${i.codigo}-${j}`} className={i.severidade === 'ERRO' ? 'text-rose-700' : 'text-amber-800'}>{i.severidade}: {i.mensagem}</li>)}</ul> : <span className="text-slate-700">Sem inconsistências estruturais locais</span>}<div className={`text-[10px] mt-1 ${respostaNegativa ? 'text-rose-700' : 'text-amber-800'}`}>Protocolo: {textoProtocolo}</div><div className="text-[10px] text-slate-400 mt-1">Origem: arquivo XML local • assinatura, autenticidade e autorização oficial não verificadas</div><button type="button" onClick={() => void baixarXmlRadarLocal(n)} className="mt-2 px-2 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50">{n.xmlLocalId ? 'Baixar XML original' : 'Original não armazenado'}</button></td></tr>;
          })}</tbody></table></div> : <div className="text-center text-xs text-slate-500 py-10 border border-dashed rounded-xl">{!radarPronto ? 'Carregando os registros desta empresa…' : notasRadarVisiveis.length ? 'Nenhum documento corresponde aos filtros.' : 'Nenhum XML importado para esta empresa. Importe arquivos XML para iniciar a conferência.'}</div>}
        </section>
      )}

      {/* ======================= ABA 1: NFE DE SAÍDA ======================= */}
      {abaAtiva === 'saida' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>📤 Notas Fiscais Eletrônicas de Saída</span>
                <span className="text-xs font-normal text-slate-500">({notasSaida.length} notas no período)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Exibe notas de saída importadas para esta empresa. Tributos são valores informados nos registros/XMLs, sem validação de alíquota ou apuração; emissão e consulta oficial não estão conectadas.
              </p>
            </div>

            <span role="status" className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px] font-bold shrink-0">
              Busca automática de saída não conectada · importe XML do emissor/ERP
            </span>
          </div>

          {/* TABELA DE SAÍDAS */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Nº / Série</th>
                  <th className="p-3">Cliente / Destinatário</th>
                  <th className="p-3">UF Destino</th>
                  <th className="p-3">Valor Total registrado</th>
                  <th className="p-3">ICMS informado</th>
                  <th className="p-3">PIS/COFINS informados</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {notasSaida.map((nf, index) => (
                  <tr key={`${nf.tipo}:${nf.chave || `${nf.numero}-${nf.serie}-${nf.dataEmissao}`}:${index}`} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-900">
                      <div>#{nf.numero} (s.{nf.serie})</div>
                      <div className="text-[10px] text-slate-400 font-normal">{nf.dataEmissao}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{nf.clienteOuFornecedor}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{nf.cnpjParceiro}</div>
                    </td>
                    <td className="p-3 font-mono">
                      <span className="bg-slate-100 px-2 py-0.5 rounded font-bold">{nf.ufDestino}</span>
                    </td>
                    <td className="p-3 font-bold font-mono text-slate-900">
                      {formatarTotalInformado(nf)}
                    </td>
                    <td className="p-3 font-mono">
                      <div className="font-bold text-blue-700">{formatarTributoInformado(nf, 'ICMS', nf.ICMS_valor)}</div>
                      <div className="text-[10px] text-slate-400">CST: {nf.ICMS_cst || 'não informado'} · alíquota não conferida</div>
                    </td>
                    <td className="p-3 font-mono">
                      <div className="text-slate-800 font-semibold">PIS: {formatarTributoInformado(nf, 'PIS', nf.PIS_valor)}</div>
                      <div className="text-[10px] text-slate-400">COFINS: {formatarTributoInformado(nf, 'COFINS', nf.COFINS_valor)}</div>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${classeStatusPagamentoLocal(nf)}`}>
                        {rotuloStatusPagamentoLocal(nf)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {nf.status !== 'PAGA_INFORMADA' ? (
                        <button
                          type="button"
                          onClick={() => abrirRegistroPagamento(nf)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Registrar pagamento
                        </button>
                      ) : (
                        <span className="text-[11px] text-blue-700 font-semibold">Pagamento informado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================= ABA 2: NFE DE ENTRADA ======================= */}
      {abaAtiva === 'entrada' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>📥 Notas Fiscais Eletrônicas de Entrada (Compras)</span>
                <span className="text-xs font-normal text-slate-500">({notasEntrada.length} notas no período)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Exibe notas de entrada importadas para esta empresa. Tributos são valores informados nos registros/XMLs; direito a crédito, alíquotas e deduções não são apurados ou validados.
              </p>
            </div>

            <span role="status" className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px] font-bold shrink-0">
              Distribuição DF-e ainda não conectada · importe XML para revisar localmente
            </span>
          </div>

          {/* TABELA DE ENTRADAS */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Nº / Série</th>
                  <th className="p-3">Fornecedor / Emitente</th>
                  <th className="p-3">UF Origem</th>
                  <th className="p-3">Valor Total registrado</th>
                  <th className="p-3">ICMS informado</th>
                  <th className="p-3">PIS/COFINS informados</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {notasEntrada.map((nf, index) => (
                  <tr key={`${nf.tipo}:${nf.chave || `${nf.numero}-${nf.serie}-${nf.dataEmissao}`}:${index}`} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-900">
                      <div>#{nf.numero} (s.{nf.serie})</div>
                      <div className="text-[10px] text-slate-400 font-normal">{nf.dataEmissao}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{nf.clienteOuFornecedor}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{nf.cnpjParceiro}</div>
                    </td>
                    <td className="p-3 font-mono">
                      <span className="bg-slate-100 px-2 py-0.5 rounded font-bold">{nf.ufOrigem}</span>
                    </td>
                    <td className="p-3 font-bold font-mono text-slate-900">
                      {formatarTotalInformado(nf)}
                    </td>
                    <td className="p-3 font-mono">
                      <div className="font-bold text-emerald-600">{formatarTributoInformado(nf, 'ICMS', nf.ICMS_valor)}</div>
                      <div className="text-[10px] text-slate-400">CST: {nf.ICMS_cst || 'não informado'} · crédito não apurado</div>
                    </td>
                    <td className="p-3 font-mono">
                      <div className="text-emerald-700 font-semibold">PIS: {formatarTributoInformado(nf, 'PIS', nf.PIS_valor)}</div>
                      <div className="text-[10px] text-slate-400">COFINS: {formatarTributoInformado(nf, 'COFINS', nf.COFINS_valor)} · créditos não apurados</div>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${classeStatusPagamentoLocal(nf)}`}>
                        {rotuloStatusPagamentoLocal(nf)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {nf.status !== 'PAGA_INFORMADA' && (
                        <button
                          type="button"
                          onClick={() => abrirRegistroPagamento(nf)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Registrar pagamento
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================= ABA 3: BAIXA DE NOTAS ======================= */}
      {abaAtiva === 'baixa' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-5 animate-in fade-in">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>✅ Pagamentos informados e vencimentos locais</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhamento local dos vencimentos informados. Pagamentos são registrados manualmente e não são confirmados pelo banco.
            </p>
          </div>

          {/* ALERTA DE VENCIDAS */}
          {notasVencidas.length > 0 && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-3 text-xs text-rose-900">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-sm font-black">Atenção: {notasVencidas.length} vencimento(s) informado(s) no passado!</strong>
                <p className="mt-0.5">
                  Confira as datas e o pagamento com a empresa. O sistema não consultou banco ou órgão oficial.
                </p>
              </div>
            </div>
          )}

          {/* LISTAGEM DE NOTAS PARA BAIXA */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800">Notas sem pagamento informado neste navegador</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...notasSaida, ...notasEntrada].filter(n => n.status !== 'PAGA_INFORMADA').map((nf, index) => (
                <div key={`${nf.tipo}:${nf.chave || `${nf.numero}-${nf.serie}-${nf.dataEmissao}`}:${index}`} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{nf.tipo === 'SAIDA' ? '📤 Saída' : '📥 Entrada'}</span>
                      <span>#{nf.numero}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${classeStatusPagamentoLocal(nf)}`}>
                        {rotuloStatusPagamentoLocal(nf)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{nf.clienteOuFornecedor}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Vencimento: {nf.dataVencimento || 'N/D'} • Total: R$ {nf.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => abrirRegistroPagamento(nf)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer transition-colors shrink-0"
                  >
                    Registrar pagamento
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================= ABA 4: APURAÇÃO FISCAL ======================= */}
      {abaAtiva === 'apuracao' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                Período: {resumoAtual.periodo} • {ufFiltro}
              </span>
              <h2 className="text-base font-black text-[#0F2B5B] mt-1">
                ⚖️ Resumo de campos tributários dos XMLs locais
              </h2>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500 font-semibold block">Regime cadastrado</span>
              <span className="text-xs font-black text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 inline-flex items-center gap-1">
                {regimeFiltro === 'SIMPLES' ? 'Simples Nacional' : regimeFiltro === 'REAL' ? 'Lucro Real' : 'Lucro Presumido'}
                <span className="font-normal">· não validado</span>
              </span>
            </div>
          </div>

          <div role="note" className="text-xs text-amber-950 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Valores somados dos campos numéricos do livro local, separados por saída e entrada. {resumoAtual.camposInvalidos ? `${resumoAtual.camposInvalidos} campo(s) inválido(s) ou fora da faixa segura foram omitidos; o resumo está parcial. ` : ''}Não há compensação, validação de incidência ou apuração legal; não representa tributo devido nem guia oficial.
          </div>

          {/* CARDS DE APURAÇÃO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* CARD ICMS */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">ICMS (Estadual)</span>
                <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">Campos informados</span>
              </div>
              <div className="text-xs space-y-1 text-slate-600 font-mono">
                <div className="flex justify-between">
                  <span>ICMS informado nas saídas:</span>
                  <strong>R$ {resumoAtual.totalSaida.ICMS.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>ICMS informado nas entradas:</span>
                  <strong>R$ {resumoAtual.totalEntrada.ICMS.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* CARD PIS */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">PIS (Federal)</span>
                <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold">Campos informados</span>
              </div>
              <div className="text-xs space-y-1 text-slate-600 font-mono">
                <div className="flex justify-between">
                  <span>PIS informado nas saídas:</span>
                  <strong>R$ {resumoAtual.totalSaida.PIS.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>PIS informado nas entradas:</span>
                  <strong>R$ {resumoAtual.totalEntrada.PIS.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* CARD COFINS */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">COFINS (Federal)</span>
                <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold">Campos informados</span>
              </div>
              <div className="text-xs space-y-1 text-slate-600 font-mono">
                <div className="flex justify-between">
                  <span>COFINS informado nas saídas:</span>
                  <strong>R$ {resumoAtual.totalSaida.COFINS.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>COFINS informado nas entradas:</span>
                  <strong>R$ {resumoAtual.totalEntrada.COFINS.toFixed(2)}</strong>
                </div>
              </div>
            </div>
          </div>

              {/* Contagem local de documentos considerados */}
          <div className="p-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <div className="text-xs text-blue-200 font-bold uppercase tracking-wider">
              Documentos considerados em {resumoAtual.periodo}
              </div>
              <div className="text-xl font-black font-mono mt-0.5">
                {saidasPeriodo.length} saída(s) · {entradasPeriodo.length} entrada(s)
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setAlerta({
                  tipo: 'info',
              texto: 'Esta tela apenas resume campos dos XMLs locais. A emissão e a apuração oficial não estão conectadas; nenhuma guia foi calculada ou transmitida.'
                });
              }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-sm"
            >
              Aviso: emissão oficial não conectada
            </button>
          </div>
        </div>
      )}

      {/* ======================= ABA 5: CALCULADORA FISCAL EMBUTIDA ======================= */}
      {abaAtiva === 'calculadora' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-[#0F2B5B] flex items-center gap-2">
                <span>🧮 CALCULADORA FISCAL EMBUTIDA</span>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-full border border-amber-300">
                  Brasil Inteiro
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Calculadora aritmética com valores e alíquotas informados manualmente. Não há tabela legal automática validada.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setModalCalcAberta(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
            >
              Abrir em Janela Flutuante
            </button>
          </div>

          <div role="note" className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-950">
            Percentuais de ICMS, PIS/COFINS, Simples e IBS/CBS não são inferidos pelo Murade. Use a janela de cálculo e informe as alíquotas confirmadas para a operação. Resultado é apenas multiplicação aritmética; não constitui apuração fiscal nem valor a recolher.
          </div>
        </div>
      )}

      {/* MODAL PARA REGISTRO DE BAIXA */}
      {notaSelecionadaParaBaixa && empresaIdNotaBaixa === empresaAtiva?.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-900 text-sm">
                Registrar pagamento informado — Nota #{notaSelecionadaParaBaixa.numero}
              </h3>
              <button 
                onClick={fecharModalBaixa}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-slate-700">
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-950">
                Este registro apenas atualiza o livro local desta empresa. Não consulta banco, não confirma quitação e não altera o status na SEFAZ.
              </p>
              <div>
                <span className="text-[11px] text-slate-400 block">Parceiro</span>
                <strong className="text-slate-900">{notaSelecionadaParaBaixa.clienteOuFornecedor}</strong>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 border border-slate-200 p-2 text-[11px]">
                <div><span className="block text-slate-500">Total da nota</span><strong>R$ {notaSelecionadaParaBaixa.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
                <div><span className="block text-slate-500">Parcelas informadas</span><strong>R$ {valorJaInformado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
                <div><span className="block text-slate-500">Saldo restante</span><strong>R$ {saldoInformadoRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Valor desta parcela (R$)</label>
                  <input
                    type="text"
                    value={valorPagoInput}
                    onChange={(e) => setValorPagoInput(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold block mb-1">Data Pagamento</label>
                  <input
                    type="date"
                    value={dataPagoInput}
                    onChange={(e) => setDataPagoInput(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={fecharModalBaixa}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarBaixa}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
              >
                Salvar informação de pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DA CALCULADORA FISCAL FLUTUANTE */}
      <ModalCalculadoraFiscal
        aberto={modalCalcAberta}
        onFechar={() => setModalCalcAberta(false)}
      />
    </div>
  );
}
