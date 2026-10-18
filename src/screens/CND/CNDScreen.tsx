import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Plus, 
  ExternalLink, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Building2, 
  FileText, 
  Filter,
  X,
  Search,
  Printer,
} from 'lucide-react';
import BotaoVoltar from '../../components/BotaoVoltar';
import { useEmpresa } from '../../context/EmpresaContext';
import { EVENTO_CND_LOCAL_ATUALIZADA } from '../../services/cnd/cndMonitor.service';

import { 
  LISTA_SEFAZ_ESTADOS, 
  LISTA_PREFEITURAS, 
  obterSefazPorUf,
  obterPrefeituraPorNomeOuUf,
  obterPrefeituraPorMunicipioEUf
} from '../../data/orgaosPublicosData';

export interface CertidaoCND {
  id: number;
  clienteId: number | string;
  clienteNome: string;
  clienteDoc: string;
  tipo: 'federal' | 'estadual' | 'municipal' | 'fgts' | 'trabalhista';
  uf?: string;
  municipio?: string;
  numero: string;
  emissao: string;
  validade: string;
  obs?: string;
  dataCadastro?: string;
}

const LINKS_EMISSAO: Record<string, string> = {
  federal: 'https://servicos.receitafederal.gov.br/servico/certidoes',
  fgts: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf',
  trabalhista: 'https://www.tst.jus.br/certidao'
};

const LINKS_ALTERNATIVOS: Record<string, { rotulo: string; url: string }> = {
  federal: { rotulo: 'Portal e-CAC (RFB)', url: 'https://cav.receita.fazenda.gov.br/ecac/' },
  fgts: { rotulo: 'FGTS Digital (Pix)', url: 'https://fgtsdigital.sistema.gov.br' },
  trabalhista: { rotulo: 'Portal TST / BNDT', url: 'https://www.tst.jus.br' }
};

const NOMES_TIPOS: Record<string, { rotulo: string; orgao: string; icone: string }> = {
  federal: { rotulo: 'CND Federal (RFB + INSS)', orgao: 'Receita Federal & PGFN (e-CAC)', icone: '🏛️' },
  estadual: { rotulo: 'CND Estadual — SEFAZ', orgao: 'Secretaria da Fazenda Estadual', icone: '🏢' },
  municipal: { rotulo: 'CND Municipal — Prefeitura', orgao: 'Prefeitura Municipal / ISS', icone: '🏘️' },
  fgts: { rotulo: 'CRF — FGTS', orgao: 'Caixa Econômica Federal', icone: '💰' },
  trabalhista: { rotulo: 'CNDT — Débitos Trabalhistas', orgao: 'Tribunal Superior do Trabalho (TST)', icone: '⚖️' }
};

function dataIsoValida(data: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!partes) return false;
  const [, ano, mes, dia] = partes;
  const dataCivil = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  return dataCivil.getUTCFullYear() === Number(ano)
    && dataCivil.getUTCMonth() === Number(mes) - 1
    && dataCivil.getUTCDate() === Number(dia);
}

function hojeIsoLocal(data = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

interface CNDScreenProps {
  onVoltar?: () => void;
  onNavegar?: (aba: string) => void;
}

export default function CNDScreen({ onVoltar, onNavegar }: CNDScreenProps) {
  const { empresas, empresaAtiva } = useEmpresa();
  const [certidoes, setCertidoes] = useState<CertidaoCND[]>([]);
  const [erroArmazenamento, setErroArmazenamento] = useState<string | null>(null);
  const [mensagemStatus, setMensagemStatus] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>('todas');
  const [filtroCliente, setFiltroCliente] = useState<string>('todos');
  const [busca, setBusca] = useState<string>('');
  
  // Abre o órgão da empresa ativa quando os dados cadastrais permitem identificá-lo.
  const [ufSefazAtiva, setUfSefazAtiva] = useState<string>(empresaAtiva?.uf?.toUpperCase() || '');
  const prefeituraInicial = empresaAtiva?.cidade && empresaAtiva?.uf
    ? obterPrefeituraPorMunicipioEUf(empresaAtiva.cidade, empresaAtiva.uf)?.id || ''
    : '';
  const [idPrefeituraAtiva, setIdPrefeituraAtiva] = useState<string>(prefeituraInicial);

  // Visualização local do registro; a emissão ocorre no portal externo.
  const [certidaoVisualizacao, setCertidaoVisualizacao] = useState<CertidaoCND | null>(null);

  // Modal de cadastro
  const [modalAberto, setModalAberto] = useState(false);
  const [novoClienteId, setNovoClienteId] = useState('');
  const [novoTipo, setNovoTipo] = useState<'federal' | 'estadual' | 'municipal' | 'fgts' | 'trabalhista'>('federal');
  const [novoUf, setNovoUf] = useState(empresaAtiva?.uf || '');
  const [novoNumero, setNovoNumero] = useState('');
  const [novaEmissao, setNovaEmissao] = useState('');
  const [novaValidade, setNovaValidade] = useState('');
  const [novaObs, setNovaObs] = useState('');

  // Atualiza UF quando a empresa ativa mudar
  useEffect(() => {
    const uf = empresaAtiva?.uf?.toUpperCase() || '';
    setUfSefazAtiva(uf);
    setNovoUf(uf);
    const prefeitura = empresaAtiva?.cidade && uf
      ? obterPrefeituraPorMunicipioEUf(empresaAtiva.cidade, uf)
      : undefined;
    setIdPrefeituraAtiva(prefeitura?.id || '');
  }, [empresaAtiva]);

  // Carrega os registros locais sem apagar dados desconhecidos ou registros de empresas reais.
  useEffect(() => {
    try {
      const salvas = localStorage.getItem('fiscoia_cnd');
      if (salvas === null) {
        setCertidoes([]);
        setErroArmazenamento(null);
        return;
      }
      const parsed: unknown = JSON.parse(salvas);
      if (!Array.isArray(parsed) || parsed.some((item) => !item || typeof item !== 'object' || Array.isArray(item)
        || !['number', 'string'].includes(typeof item.id) || !['number', 'string'].includes(typeof item.clienteId)
        || typeof item.clienteNome !== 'string' || typeof item.clienteDoc !== 'string'
        || !['federal', 'estadual', 'municipal', 'fgts', 'trabalhista'].includes(item.tipo)
        || typeof item.numero !== 'string' || typeof item.emissao !== 'string' || typeof item.validade !== 'string')) {
        throw new Error('O cadastro local tem formato inválido. Os dados foram preservados; exporte ou recupere uma cópia antes de editar.');
      }
      setCertidoes(parsed as CertidaoCND[]);
      setErroArmazenamento(null);
    } catch (e) {
      console.error('Erro ao ler fiscoia_cnd:', e);
      setErroArmazenamento(e instanceof SyntaxError
        ? 'Os registros locais de certidões estão corrompidos. Foram preservados e não serão sobrescritos.'
        : e instanceof Error ? e.message : 'Não foi possível ler as certidões. Os dados existentes foram preservados.');
    }
  }, [empresas]);

  // Confirma a persistência antes de atualizar a interface.
  const salvarCertidoesNoStorage = (novas: CertidaoCND[]): boolean => {
    try {
      localStorage.setItem('fiscoia_cnd', JSON.stringify(novas));
      setCertidoes(novas);
      window.dispatchEvent(new Event(EVENTO_CND_LOCAL_ATUALIZADA));
      setErroArmazenamento(null);
      setMensagemStatus(null);
      return true;
    } catch {
      setErroArmazenamento('Não foi possível salvar as alterações neste navegador. Os registros anteriores continuam preservados.');
      return false;
    }
  };

  // Cálculo de dias e status
  const calcularDias = (dataValidade: string): number | null => {
    if (!dataIsoValida(dataValidade)) return null;
    const agora = new Date();
    const hojeCivilUtc = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const validadeCivilUtc = Date.UTC(Number(dataValidade.slice(0, 4)), Number(dataValidade.slice(5, 7)) - 1, Number(dataValidade.slice(8, 10)));
    return Math.round((validadeCivilUtc - hojeCivilUtc) / 86_400_000);
  };

  const obterStatus = (certidao: Pick<CertidaoCND, 'emissao' | 'validade'>): 'valida' | 'alerta' | 'vencida' | 'invalida' => {
    if (!dataIsoValida(certidao.emissao) || !dataIsoValida(certidao.validade)) return 'invalida';
    const dias = calcularDias(certidao.validade);
    if (dias === null) return 'invalida';
    if (dias < 0) return 'vencida';
    if (dias <= 10) return 'alerta';
    return 'valida';
  };

  const formatarDataBR = (dataIso: string) => {
    if (!dataIso) return '—';
    if (!dataIsoValida(dataIso)) return `${dataIso} (data inválida)`;
    const partes = dataIso.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dataIso;
  };

  // Contadores
  const total = certidoes.length;
  const validas = certidoes.filter(c => obterStatus(c) === 'valida').length;
  const emAlerta = certidoes.filter(c => obterStatus(c) === 'alerta').length;
  const vencidas = certidoes.filter(c => obterStatus(c) === 'vencida').length;
  const datasInvalidas = certidoes.filter(c => obterStatus(c) === 'invalida').length;

  // Filtragem
  const certidoesFiltradas = certidoes.filter(c => {
    // Filtro por tipo
    if (filtroTipo === 'vencidas') {
      if (obterStatus(c) !== 'vencida') return false;
    } else if (filtroTipo !== 'todas') {
      if (c.tipo !== filtroTipo) return false;
    }

    // Filtro por cliente
    if (filtroCliente !== 'todos') {
      if (String(c.clienteId) !== filtroCliente) return false;
    }

    // Busca textual
    if (busca.trim()) {
      const b = busca.toLowerCase();
      const bateNome = c.clienteNome.toLowerCase().includes(b);
      const bateDoc = c.clienteDoc.includes(b);
      const bateNum = c.numero.toLowerCase().includes(b);
      if (!bateNome && !bateDoc && !bateNum) return false;
    }

    return true;
  }).sort((a, b) => {
    const validadeA = dataIsoValida(a.validade) ? Date.parse(`${a.validade}T00:00:00`) : Number.MAX_SAFE_INTEGER;
    const validadeB = dataIsoValida(b.validade) ? Date.parse(`${b.validade}T00:00:00`) : Number.MAX_SAFE_INTEGER;
    return validadeA - validadeB;
  });

  // Salvar nova CND
  const handleCadastrar = (e: React.FormEvent) => {
    e.preventDefault();
    if (erroArmazenamento) return;
    if (!novoClienteId || !novoNumero || !novaEmissao || !novaValidade) {
      setMensagemStatus('Preencha empresa, número e datas de emissão e validade.');
      return;
    }
    if (!dataIsoValida(novaEmissao) || !dataIsoValida(novaValidade)) {
      setMensagemStatus('Informe datas válidas no calendário. Nenhum registro foi salvo.');
      return;
    }
    if (novaValidade < novaEmissao) {
      setMensagemStatus('A validade informada não pode ser anterior à emissão. Nenhum registro foi salvo.');
      return;
    }

    // Acha cliente correspondente
    const clienteEncontrado = empresas.find(emp => String(emp.id) === novoClienteId);
    if (!clienteEncontrado) {
      setMensagemStatus('A empresa selecionada não está mais disponível. Atualize o cadastro e tente novamente.');
      return;
    }
    const nomeCliente = clienteEncontrado ? clienteEncontrado.razaoSocial : 'Cliente';
    const docCliente = clienteEncontrado ? clienteEncontrado.cnpj : '—';

    const nova: CertidaoCND = {
      id: Date.now(),
      clienteId: novoClienteId,
      clienteNome: nomeCliente,
      clienteDoc: docCliente,
      tipo: novoTipo,
      uf: novoTipo === 'estadual' ? novoUf : novoTipo === 'municipal' ? clienteEncontrado.uf : undefined,
      municipio: novoTipo === 'municipal' ? clienteEncontrado.cidade : undefined,
      numero: novoNumero.trim(),
      emissao: novaEmissao,
      validade: novaValidade,
      obs: novaObs.trim() || undefined,
      dataCadastro: new Date().toISOString()
    };

    const atualizadas = [...certidoes, nova];
    if (!salvarCertidoesNoStorage(atualizadas)) return;

    // Limpar
    setModalAberto(false);
    setNovoClienteId('');
    setNovoNumero('');
    setNovaEmissao('');
    setNovaValidade('');
    setNovaObs('');
    setMensagemStatus('Registro local salvo neste navegador. A certidão e sua validade não foram verificadas pelo órgão emissor.');
  };

  const handleExcluir = (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta certidão?')) return;
    const atualizadas = certidoes.filter(c => c.id !== id);
    if (salvarCertidoesNoStorage(atualizadas)) setMensagemStatus('Registro local removido. Nenhum documento foi alterado no órgão emissor.');
  };

  const handleAbrirConsultaEmissao = (cnd: CertidaoCND) => {
    setCertidaoVisualizacao(cnd);
  };

  const obterLinkPortalCnd = (cnd: CertidaoCND): string | undefined => {
    if (cnd.tipo === 'estadual') return obterSefazPorUf(cnd.uf || '')?.urlCnd;
    if (cnd.tipo === 'municipal') {
      const empresa = empresas.find(item => String(item.id) === String(cnd.clienteId));
      const uf = cnd.uf || empresa?.uf;
      const prefeitura = obterPrefeituraPorNomeOuUf(cnd.municipio || empresa?.cidade || '');
      if (!prefeitura || !uf || prefeitura.uf.toUpperCase() !== uf.toUpperCase()) return undefined;
      return prefeitura?.urlCnd;
    }
    return LINKS_EMISSAO[cnd.tipo];
  };
  const linkPortalVisualizacao = certidaoVisualizacao ? obterLinkPortalCnd(certidaoVisualizacao) : undefined;

  return (
    <div id="cnd-screen" className="space-y-6 max-w-6xl mx-auto pb-16">
      {onVoltar && (
        <div>
          <BotaoVoltar onVoltar={onVoltar} />
        </div>
      )}

      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-blue-100 text-blue-700 shadow-xs">
              <ShieldCheck className="w-7 h-7" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                CND — Certidões Negativas de Débitos
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Registro manual de certidões e cálculo da validade informada. O sistema não consulta nem valida certidões nos órgãos.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavegar && (
            <button
              type="button"
              onClick={() => onNavegar('orgaos_publicos')}
              className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Building2 className="w-4 h-4 text-indigo-600" />
              Central de Órgãos Públicos
            </button>
          )}
          <button
            type="button"
            disabled={Boolean(erroArmazenamento)}
            onClick={() => {
              setNovaEmissao(hojeIsoLocal());
              setModalAberto(true);
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Certidão
          </button>
        </div>
      </div>

      {erroArmazenamento && (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          <strong>Armazenamento local indisponível.</strong> {erroArmazenamento} Edições e exclusões estão suspensas para evitar perda dos registros.
        </div>
      )}
      {mensagemStatus && (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
          {mensagemStatus}
        </div>
      )}

      {/* Cartões de Resumo Rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-slate-100 text-slate-700 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Total CNDs</span>
            <span className="text-xl font-black text-slate-900">{total}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-rose-700 font-semibold uppercase tracking-wider block">Data inválida</span>
            <span className="text-xl font-black text-rose-600">{datasInvalidas}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-emerald-700 font-semibold uppercase tracking-wider block">Prazo informado ativo</span>
            <span className="text-xl font-black text-emerald-600">{validas}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-amber-700 font-semibold uppercase tracking-wider block">Validade informada ≤10d</span>
            <span className="text-xl font-black text-amber-600">{emAlerta}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-rose-700 font-semibold uppercase tracking-wider block">Datas informadas vencidas</span>
            <span className="text-xl font-black text-rose-600">{vencidas}</span>
          </div>
        </div>
      </div>

      {/* Atalhos para emissão nos portais oficiais */}
      <div className="bg-linear-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-blue-700" />
              <h3 className="text-sm font-bold text-blue-900">
                Emitir Nova Certidão — atalhos para portais oficiais
              </h3>
            </div>
            <p className="text-xs text-blue-700 mt-0.5">
              Os botões abaixo abrem os sites dos órgãos. A emissão acontece no portal oficial, fora do Murade:
            </p>
          </div>

          {onNavegar && (
            <button
              type="button"
              onClick={() => onNavegar('orgaos_publicos')}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 underline"
            >
              Ver todos os órgãos ↗
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Federal RFB/INSS */}
          <div className="p-3.5 bg-white hover:bg-blue-50/40 border border-blue-200 rounded-xl flex flex-col justify-between transition-all group shadow-2xs">
            <div>
              <span className="text-base">🏛️</span>
              <h4 className="text-xs font-bold text-blue-900 mt-1">
                CND Federal (RFB/INSS)
              </h4>
              <p className="text-[11px] text-slate-500">Receita Federal & PGFN — Gov.br</p>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              <a
                href={LINKS_EMISSAO.federal}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors text-center"
              >
                Emitir CND Federal <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={LINKS_ALTERNATIVOS.federal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-center font-medium text-blue-600 hover:text-blue-800 hover:underline py-0.5"
              >
                Opção 2: Portal e-CAC (RFB) ↗
              </a>
            </div>
          </div>

          {/* 2. Estadual SEFAZ (Dinâmica por Estado) */}
          {(() => {
            const sefazAtual = obterSefazPorUf(ufSefazAtiva);
            return (
              <div className="p-3.5 bg-white hover:bg-blue-50/40 border border-blue-200 rounded-xl flex flex-col justify-between transition-all group shadow-2xs">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-base">🏢</span>
                    <select
                      value={ufSefazAtiva}
                      onChange={(e) => setUfSefazAtiva(e.target.value)}
                      className="text-[11px] font-bold bg-blue-50 border border-blue-200 text-blue-900 rounded px-1.5 py-0.5 cursor-pointer focus:outline-none"
                      title="Selecione o estado para emissão da CND Estadual"
                    >
                      <option value="">Selecione a UF</option>
                      {LISTA_SEFAZ_ESTADOS.map(s => (
                        <option key={s.uf} value={s.uf}>{s.uf} ({s.sigla})</option>
                      ))}
                    </select>
                  </div>
                  <h4 className="text-xs font-bold text-blue-900 mt-1">
                    {sefazAtual ? `CND Estadual — ${sefazAtual.sigla}` : 'CND Estadual — selecione a UF da empresa'}
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate" title={sefazAtual?.nomeEstado || 'A UF precisa estar cadastrada na empresa ou ser selecionada'}>
                    {sefazAtual?.nomeEstado || 'Sem UF confirmada'}
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  {sefazAtual ? <>
                    <a href={sefazAtual.urlCnd} target="_blank" rel="noopener noreferrer" className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors text-center">
                      Abrir serviço / portal {sefazAtual.uf} <ExternalLink className="w-3 h-3" />
                    </a>
                    <a href={sefazAtual.urlPortal} target="_blank" rel="noopener noreferrer" className="text-[10px] text-center font-medium text-blue-600 hover:text-blue-800 hover:underline py-0.5 truncate">
                      Portal Fazenda {sefazAtual.uf} ↗
                    </a>
                  </> : <p className="rounded-lg bg-amber-50 p-2 text-[10px] text-amber-800">Nenhum portal será aberto até selecionar uma UF válida.</p>}
                </div>
              </div>
            );
          })()}

          {/* 3. Municipal (Prefeitura / ISS) */}
          {(() => {
            const prefeituraDaEmpresa = empresaAtiva?.cidade && empresaAtiva?.uf
              ? obterPrefeituraPorMunicipioEUf(empresaAtiva.cidade, empresaAtiva.uf)
              : undefined;
            const prefAtual = LISTA_PREFEITURAS.find(p => p.id === idPrefeituraAtiva) || prefeituraDaEmpresa;
            return (
              <div className="p-3.5 bg-white hover:bg-blue-50/40 border border-blue-200 rounded-xl flex flex-col justify-between transition-all group shadow-2xs">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-base">🏘️</span>
                    <select
                      value={idPrefeituraAtiva}
                      onChange={(e) => setIdPrefeituraAtiva(e.target.value)}
                      className="text-[11px] font-bold bg-blue-50 border border-blue-200 text-blue-900 rounded px-1.5 py-0.5 cursor-pointer focus:outline-none max-w-[110px] truncate"
                      title="Selecione o município"
                    >
                      <option value="">Selecione o município</option>
                      {LISTA_PREFEITURAS.map(p => (
                        <option key={p.id} value={p.id}>{p.municipio}/{p.uf}</option>
                      ))}
                    </select>
                  </div>
                  <h4 className="text-xs font-bold text-blue-900 mt-1">
                    {prefAtual ? `CND Municipal — ${prefAtual.municipio}` : 'CND Municipal — portal não mapeado'}
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate" title={prefAtual?.orgaoNome || 'A lista atual cobre apenas municípios mapeados; informe a prefeitura da empresa manualmente'}>
                    {prefAtual?.orgaoNome || `${empresaAtiva?.cidade || 'Município'}${empresaAtiva?.uf ? `/${empresaAtiva.uf}` : ''} ainda não tem portal verificado nesta lista.`}
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  {prefAtual ? <>
                    <a href={prefAtual.urlCnd} target="_blank" rel="noopener noreferrer" className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors text-center">
                      Abrir serviço / portal <ExternalLink className="w-3 h-3" />
                    </a>
                    <a href={prefAtual.urlPortal} target="_blank" rel="noopener noreferrer" className="text-[10px] text-center font-medium text-blue-600 hover:text-blue-800 hover:underline py-0.5">
                      Portal ISS {prefAtual.municipio} ↗
                    </a>
                  </> : <p className="rounded-lg bg-amber-50 p-2 text-[10px] text-amber-800">Não há portal municipal verificado para esta cidade nesta lista.</p>}
                </div>
              </div>
            );
          })()}

          {/* 4. FGTS CRF (Caixa Econômica) */}
          <div className="p-3.5 bg-white hover:bg-blue-50/40 border border-blue-200 rounded-xl flex flex-col justify-between transition-all group shadow-2xs">
            <div>
              <span className="text-base">💰</span>
              <h4 className="text-xs font-bold text-blue-900 mt-1">
                CRF — FGTS Regularidade
              </h4>
              <p className="text-[11px] text-slate-500">Caixa Econômica Federal</p>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              <a
                href={LINKS_EMISSAO.fgts}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors text-center"
              >
                Acessar Caixa CRF <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://fgtsdigital.sistema.gov.br"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-center font-medium text-blue-600 hover:text-blue-800 hover:underline py-0.5"
              >
                FGTS Digital (Pix) ↗
              </a>
            </div>
          </div>

          {/* 5. Trabalhista CNDT (TST) */}
          <div className="p-3.5 bg-white hover:bg-blue-50/40 border border-blue-200 rounded-xl flex flex-col justify-between transition-all group shadow-2xs">
            <div>
              <span className="text-base">⚖️</span>
              <h4 className="text-xs font-bold text-blue-900 mt-1">
                CNDT — Débitos Trabalhistas
              </h4>
              <p className="text-[11px] text-slate-500">Tribunal Superior do Trabalho (TST)</p>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              <a
                href={LINKS_EMISSAO.trabalhista}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors text-center"
              >
                Emitir CNDT / TST <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-[10px] text-center text-slate-400 py-0.5">Banco de Devedores BNDT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Abas de Tipos */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'todas', rotulo: 'Todas' },
              { id: 'federal', rotulo: 'Federal' },
              { id: 'estadual', rotulo: 'Estadual (SEFAZ)' },
              { id: 'municipal', rotulo: 'Municipal' },
              { id: 'fgts', rotulo: 'FGTS / CRF' },
              { id: 'trabalhista', rotulo: 'Trabalhista (TST)' },
              { id: 'vencidas', rotulo: 'Data informada vencida' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltroTipo(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filtroTipo === f.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {f.rotulo}
              </button>
            ))}
          </div>

          {/* Filtro por Cliente */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 shrink-0">
              Cliente:
            </label>
            <select
              value={filtroCliente}
              onChange={e => setFiltroCliente(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="todos">Todos os Clientes</option>
              {empresas.map(emp => (
                <option key={emp.id} value={String(emp.id)}>
                  {emp.razaoSocial}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Input de Busca */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por cliente, CNPJ ou número do protocolo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Lista de CNDs */}
      <div className="space-y-3">
        {certidoesFiltradas.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">Nenhuma certidão encontrada</p>
            <p className="text-xs text-slate-400 mt-1">
              Ajuste os filtros ou cadastre uma nova certidão clicando no botão acima.
            </p>
          </div>
        ) : (
          certidoesFiltradas.map(cnd => {
            const status = obterStatus(cnd);
            const dias = calcularDias(cnd.validade);
            const tipoInfo = NOMES_TIPOS[cnd.tipo] || { rotulo: cnd.tipo, orgao: 'Órgão Competente', icone: '📄' };
            const linkOficial = obterLinkPortalCnd(cnd);

            return (
              <div
                key={cnd.id}
                className={`bg-white rounded-xl p-4 sm:p-5 border shadow-2xs transition-all hover:shadow-xs ${
                  status === 'valida'
                    ? 'border-slate-200 border-l-4 border-l-emerald-500'
                    : status === 'alerta'
                    ? 'border-amber-200 border-l-4 border-l-amber-500 bg-amber-50/20'
                    : 'border-rose-200 border-l-4 border-l-rose-500 bg-rose-50/20'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl">{tipoInfo.icone}</span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{tipoInfo.rotulo}</h4>
                      <p className="text-xs font-semibold text-blue-700">
                        {cnd.clienteNome} <span className="text-slate-400 font-normal">({cnd.clienteDoc})</span>
                      </p>
                    </div>
                  </div>

                  <div>
                    {status === 'valida' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Validade informada · {dias} dia(s) restante(s)
                      </span>
                    )}
                    {status === 'alerta' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {dias === 0 ? 'Data informada: vence hoje' : `Data informada: vence em ${dias} dia(s)`}
                      </span>
                    )}
                    {status === 'vencida' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                        <XCircle className="w-3.5 h-3.5" />
                        Data informada vencida (há {Math.abs(dias ?? 0)} dia(s))
                      </span>
                    )}
                    {status === 'invalida' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Data de emissão/validade inválida; revise o registro
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Nº / Protocolo</span>
                    <span className="font-bold text-slate-800 font-mono">{cnd.numero}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Emissão</span>
                    <span className="font-semibold text-slate-800">{formatarDataBR(cnd.emissao)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Validade informada</span>
                    <span className="font-bold text-slate-800">{formatarDataBR(cnd.validade)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Órgão Emissor</span>
                    <span className="font-medium text-slate-600 truncate block">{tipoInfo.orgao}</span>
                  </div>
                </div>

                {cnd.obs && (
                  <p className="text-xs text-slate-600 mt-2 bg-blue-50/50 p-2 rounded-md border border-blue-100/60">
                    📝 <strong>Observação:</strong> {cnd.obs}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-slate-100 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleAbrirConsultaEmissao(cnd)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    title="Visualizar o registro local informado; não consulta nem emite certidão"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Ver registro local</span>
                  </button>

                  {linkOficial && (
                    <a
                      href={linkOficial}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
                      title="Abrir portal emissor informado para esta certidão"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                      <span>Portal emissor</span>
                    </a>
                  )}

                  <button
                    type="button"
                    disabled={Boolean(erroArmazenamento)}
                    onClick={() => handleExcluir(cnd.id)}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Excluir certidão da listagem"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Cadastrar Certidão */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-blue-100 text-blue-700">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <h3 className="text-base font-bold text-slate-900">Cadastrar Nova Certidão CND</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCadastrar} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cliente / Empresa *
                </label>
                <select
                  required
                  value={novoClienteId}
                  onChange={e => setNovoClienteId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione o cliente...</option>
                  {empresas.map(emp => (
                    <option key={emp.id} value={String(emp.id)}>
                      {emp.razaoSocial} — {emp.cnpj}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo de Certidão *
                  </label>
                  <select
                    value={novoTipo}
                    onChange={e => setNovoTipo(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="federal">🏛️ CND Federal (RFB + INSS)</option>
                    <option value="estadual">🏢 CND Estadual — SEFAZ</option>
                    <option value="municipal">🏘️ CND Municipal — Prefeitura</option>
                    <option value="fgts">💰 CRF — FGTS Regularidade</option>
                    <option value="trabalhista">⚖️ CNDT — Débitos Trabalhistas (TST)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nº / Protocolo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: RFB-2026-99120"
                    value={novoNumero}
                    onChange={e => setNovoNumero(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {novoTipo === 'estadual' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estado / SEFAZ do Registro *
                  </label>
                  <select
                    value={novoUf}
                    onChange={e => setNovoUf(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    {LISTA_SEFAZ_ESTADOS.map(s => (
                      <option key={s.uf} value={s.uf}>
                        {s.uf} — {s.sigla} ({s.nomeEstado})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Data de Emissão *
                  </label>
                  <input
                    type="date"
                    required
                    value={novaEmissao}
                    onChange={e => setNovaEmissao(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Data de Validade *
                  </label>
                  <input
                    type="date"
                    required
                    value={novaValidade}
                    onChange={e => setNovaValidade(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais, pendências resolvidas ou notas..."
                  value={novaObs}
                  onChange={e => setNovaObs(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  Salvar Certidão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* Registro local de certidão informada pelo usuário */}
      {/* ========================================================== */}
      {certidaoVisualizacao && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Barra Superior do Modal */}
            <div className="no-print bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Registro local de certidão
                    <span className="bg-amber-500/20 text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                      Não consultada pelo sistema
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Os dados abaixo foram cadastrados localmente e não representam documento emitido pelo órgão.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCertidaoVisualizacao(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto print:p-0">
                <div id="cnd-print-report" className="bg-white border border-slate-300 rounded-xl p-6 sm:p-8 space-y-5 text-slate-900">
                  <div className="border-b border-slate-200 pb-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Relatório interno · cadastro manual</p>
                    <h2 className="text-lg font-bold text-slate-950 mt-1">Dados informados sobre certidão externa</h2>
                    <p className="text-xs text-slate-600 mt-1">Tipo: {NOMES_TIPOS[certidaoVisualizacao.tipo]?.rotulo || certidaoVisualizacao.tipo} · órgão emissor declarado: {NOMES_TIPOS[certidaoVisualizacao.tipo]?.orgao || 'não informado'}</p>
                  </div>

                  <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
                    <strong>Este relatório não é uma certidão.</strong> O Murade não consultou o órgão, não recebeu o documento e não validou autenticidade, regularidade ou validade. Confira os dados no portal emissor.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div><span className="block text-[10px] font-bold uppercase text-slate-500">Empresa informada</span><span className="font-semibold">{certidaoVisualizacao.clienteNome}</span></div>
                    <div><span className="block text-[10px] font-bold uppercase text-slate-500">CNPJ / inscrição informada</span><span className="font-mono font-semibold">{certidaoVisualizacao.clienteDoc}</span></div>
                    <div><span className="block text-[10px] font-bold uppercase text-slate-500">Número / protocolo informado</span><span className="font-mono font-semibold">{certidaoVisualizacao.numero || 'Não informado'}</span></div>
                    <div><span className="block text-[10px] font-bold uppercase text-slate-500">Data de emissão informada</span><span>{formatarDataBR(certidaoVisualizacao.emissao)}</span></div>
                    <div><span className="block text-[10px] font-bold uppercase text-slate-500">Data de validade informada</span><span>{formatarDataBR(certidaoVisualizacao.validade)}</span></div>
                    {certidaoVisualizacao.dataCadastro && <div><span className="block text-[10px] font-bold uppercase text-slate-500">Registro criado no Murade</span><span>{new Date(certidaoVisualizacao.dataCadastro).toLocaleString('pt-BR')}</span></div>}
                  </div>

                  {certidaoVisualizacao.obs && <div className="border-t border-slate-200 pt-3 text-xs"><strong>Observação local:</strong> {certidaoVisualizacao.obs}</div>}
                </div>

                {/* Botões de Ação do Modal */}
                <div className="no-print flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer transition-all"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Imprimir / Salvar PDF</span>
                    </button>

                    {linkPortalVisualizacao && (
                      <a
                        href={linkPortalVisualizacao}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <ExternalLink className="w-4 h-4 text-blue-600" />
                        <span>Abrir portal emissor</span>
                      </a>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCertidaoVisualizacao(null);
                    }}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Fechar registro</span>
                  </button>
                </div>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}
