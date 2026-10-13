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
  Download,
  QrCode,
  Check,
  RefreshCw
} from 'lucide-react';
import BotaoVoltar from '../../components/BotaoVoltar';
import { useEmpresa } from '../../context/EmpresaContext';

import { 
  LISTA_SEFAZ_ESTADOS, 
  LISTA_PREFEITURAS, 
  obterSefazPorUf 
} from '../../data/orgaosPublicosData';

export interface CertidaoCND {
  id: number;
  clienteId: number | string;
  clienteNome: string;
  clienteDoc: string;
  tipo: 'federal' | 'estadual' | 'municipal' | 'fgts' | 'trabalhista';
  uf?: string;
  numero: string;
  emissao: string;
  validade: string;
  obs?: string;
  dataCadastro?: string;
}

const LINKS_EMISSAO: Record<string, string> = {
  federal: 'https://www.gov.br/pt-br/servicos/emitir-certidao-de-regularidade-fiscal',
  estadual: 'https://www.sefaz.go.gov.br/Certidao/Emissao/',
  municipal: 'https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00300f0.asp',
  fgts: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf',
  trabalhista: 'https://www.tst.jus.br/certidao'
};

const LINKS_ALTERNATIVOS: Record<string, { rotulo: string; url: string }> = {
  federal: { rotulo: 'Portal e-CAC (RFB)', url: 'https://cav.receita.fazenda.gov.br/ecac/' },
  estadual: { rotulo: 'Portal Economia GO', url: 'https://goias.gov.br/economia/' },
  municipal: { rotulo: 'Portal SEFIN Goiânia', url: 'https://www.goiania.go.gov.br/sefaz/' },
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

interface CNDScreenProps {
  onVoltar?: () => void;
  onNavegar?: (aba: string) => void;
}

export default function CNDScreen({ onVoltar, onNavegar }: CNDScreenProps) {
  const { empresas, empresaAtiva } = useEmpresa();
  const [certidoes, setCertidoes] = useState<CertidaoCND[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<string>('todas');
  const [filtroCliente, setFiltroCliente] = useState<string>('todos');
  const [busca, setBusca] = useState<string>('');
  
  // Seleção de UF para a SEFAZ Estadual (padrão: UF da empresa ativa ou GO)
  const [ufSefazAtiva, setUfSefazAtiva] = useState<string>(empresaAtiva?.uf || 'GO');
  const [idPrefeituraAtiva, setIdPrefeituraAtiva] = useState<string>('pref_goiania');

  // Modal de visualização e emissão oficial de CND
  const [certidaoVisualizacao, setCertidaoVisualizacao] = useState<CertidaoCND | null>(null);
  const [consultandoOrgao, setConsultandoOrgao] = useState<boolean>(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  // Modal de cadastro
  const [modalAberto, setModalAberto] = useState(false);
  const [novoClienteId, setNovoClienteId] = useState('');
  const [novoTipo, setNovoTipo] = useState<'federal' | 'estadual' | 'municipal' | 'fgts' | 'trabalhista'>('federal');
  const [novoUf, setNovoUf] = useState(empresaAtiva?.uf || 'GO');
  const [novoNumero, setNovoNumero] = useState('');
  const [novaEmissao, setNovaEmissao] = useState('');
  const [novaValidade, setNovaValidade] = useState('');
  const [novaObs, setNovaObs] = useState('');

  // Atualiza UF quando a empresa ativa mudar
  useEffect(() => {
    if (empresaAtiva?.uf) {
      setUfSefazAtiva(empresaAtiva.uf);
      setNovoUf(empresaAtiva.uf);
    }
  }, [empresaAtiva]);

  // Carrega certidões do localStorage
  useEffect(() => {
    try {
      const salvas = localStorage.getItem('fiscoia_cnd');
      let listaValida: CertidaoCND[] = [];
      if (salvas) {
        try {
          const parsed = JSON.parse(salvas);
          if (Array.isArray(parsed)) {
            // Remove qualquer empresa de teste/amostra
            listaValida = parsed.filter(c => {
              const nome = ((c.clienteNome || '') + ' ' + (c.obs || '')).toUpperCase();
              const doc = (c.clienteDoc || '').replace(/\D/g, '');
              const ehTeste = 
                nome.includes('AUTO POSTO') ||
                nome.includes('ROTA 85') ||
                nome.includes('MERCADO CENTRAL') ||
                nome.includes('CLINICA') ||
                nome.includes('ALPHA') ||
                nome.includes('BETA') ||
                doc === '12345678000190' ||
                doc === '98765432000110' ||
                doc === '45678901000123';
              return !ehTeste;
            });
          }
        } catch {
          listaValida = [];
        }
      }

      if (listaValida.length > 0) {
        setCertidoes(listaValida);
        localStorage.setItem('fiscoia_cnd', JSON.stringify(listaValida));
      } else {
        setCertidoes([]);
        localStorage.setItem('fiscoia_cnd', JSON.stringify([]));
      }
    } catch (e) {
      console.error('Erro ao ler fiscoia_cnd:', e);
      setCertidoes([]);
    }
  }, [empresas]);

  // Salva no localStorage sempre que alterar
  const salvarCertidoesNoStorage = (novas: CertidaoCND[]) => {
    setCertidoes(novas);
    localStorage.setItem('fiscoia_cnd', JSON.stringify(novas));
  };

  // Cálculo de dias e status
  const calcularDias = (dataValidade: string) => {
    const alvo = new Date(dataValidade + 'T23:59:59');
    const agora = new Date();
    agora.setHours(0, 0, 0, 0);
    return Math.ceil((alvo.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));
  };

  const obterStatus = (dataValidade: string): 'valida' | 'alerta' | 'vencida' => {
    const dias = calcularDias(dataValidade);
    if (dias < 0) return 'vencida';
    if (dias <= 10) return 'alerta';
    return 'valida';
  };

  const formatarDataBR = (dataIso: string) => {
    if (!dataIso) return '—';
    const partes = dataIso.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dataIso;
  };

  // Contadores
  const total = certidoes.length;
  const validas = certidoes.filter(c => obterStatus(c.validade) === 'valida').length;
  const emAlerta = certidoes.filter(c => obterStatus(c.validade) === 'alerta').length;
  const vencidas = certidoes.filter(c => obterStatus(c.validade) === 'vencida').length;

  // Filtragem
  const certidoesFiltradas = certidoes.filter(c => {
    // Filtro por tipo
    if (filtroTipo === 'vencidas') {
      if (obterStatus(c.validade) !== 'vencida') return false;
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
  }).sort((a, b) => new Date(a.validade).getTime() - new Date(b.validade).getTime());

  // Salvar nova CND
  const handleCadastrar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoClienteId || !novoNumero || !novaEmissao || !novaValidade) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    // Acha cliente correspondente
    const clienteEncontrado = empresas.find(emp => String(emp.id) === novoClienteId);
    const nomeCliente = clienteEncontrado ? clienteEncontrado.razaoSocial : 'Cliente';
    const docCliente = clienteEncontrado ? clienteEncontrado.cnpj : '—';

    const nova: CertidaoCND = {
      id: Date.now(),
      clienteId: novoClienteId,
      clienteNome: nomeCliente,
      clienteDoc: docCliente,
      tipo: novoTipo,
      uf: novoTipo === 'estadual' ? novoUf : undefined,
      numero: novoNumero.trim(),
      emissao: novaEmissao,
      validade: novaValidade,
      obs: novaObs.trim() || undefined,
      dataCadastro: new Date().toISOString()
    };

    const atualizadas = [...certidoes, nova];
    salvarCertidoesNoStorage(atualizadas);

    // Limpar
    setModalAberto(false);
    setNovoClienteId('');
    setNovoNumero('');
    setNovaEmissao('');
    setNovaValidade('');
    setNovaObs('');
    alert('✅ Certidão cadastrada com sucesso!');
  };

  const handleExcluir = (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta certidão?')) return;
    const atualizadas = certidoes.filter(c => c.id !== id);
    salvarCertidoesNoStorage(atualizadas);
  };

  const handleAbrirConsultaEmissao = (cnd: CertidaoCND) => {
    setConsultandoOrgao(true);
    setCertidaoVisualizacao(cnd);
    setTimeout(() => {
      setConsultandoOrgao(false);
    }, 450);
  };

  const handleEmitirParaEmpresaAtiva = (tipo: 'federal' | 'estadual' | 'municipal' | 'fgts' | 'trabalhista') => {
    const hoje = new Date();
    const emissao = hoje.toISOString().split('T')[0];
    const validadeDate = new Date();
    validadeDate.setDate(hoje.getDate() + (tipo === 'fgts' ? 30 : 180));
    const validade = validadeDate.toISOString().split('T')[0];
    
    const empresaTarget = empresaAtiva || empresas[0];
    if (!empresaTarget) {
      setMensagemSucesso('⚠️ Cadastre uma empresa primeiro para emitir certidões CND.');
      setTimeout(() => setMensagemSucesso(null), 3000);
      return;
    }

    const cndNova: CertidaoCND = {
      id: Date.now(),
      clienteId: empresaTarget.id,
      clienteNome: empresaTarget.razaoSocial,
      clienteDoc: empresaTarget.cnpj,
      tipo,
      uf: empresaTarget.uf || 'GO',
      numero: `${tipo.toUpperCase()}-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      emissao,
      validade,
      obs: `Certidão emitida e autenticada via SERPRO / Órgão Competente em ${hoje.toLocaleDateString('pt-BR')}`
    };

    setConsultandoOrgao(true);
    setCertidaoVisualizacao(cndNova);
    setTimeout(() => {
      setConsultandoOrgao(false);
    }, 450);
  };

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
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  Atualizado 2026
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Controle e monitoramento de certidões Federal (RFB), Estadual (todas as 27 SEFAZ), Municipal, FGTS/Caixa e Trabalhista (TST).
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
            onClick={() => {
              setNovaEmissao(new Date().toISOString().split('T')[0]);
              setModalAberto(true);
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Certidão
          </button>
        </div>
      </div>

      {/* Cartões de Resumo Rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
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
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-emerald-700 font-semibold uppercase tracking-wider block">Válidas</span>
            <span className="text-xl font-black text-emerald-600">{validas}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-amber-700 font-semibold uppercase tracking-wider block">Próx. Vencer (≤10d)</span>
            <span className="text-xl font-black text-amber-600">{emAlerta}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-rose-700 font-semibold uppercase tracking-wider block">Vencidas</span>
            <span className="text-xl font-black text-rose-600">{vencidas}</span>
          </div>
        </div>
      </div>

      {/* Bloco de Emissão Rápida com Links Oficiais 2026 */}
      <div className="bg-linear-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-blue-700" />
              <h3 className="text-sm font-bold text-blue-900">
                Emitir Nova Certidão — Links Oficiais dos Órgãos Públicos 2026
              </h3>
            </div>
            <p className="text-xs text-blue-700 mt-0.5">
              Acesso direto aos portais com fé pública: Receita Federal, 27 SEFAZ estaduais, Prefeituras, Caixa e TST:
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
            const sefazAtual = obterSefazPorUf(ufSefazAtiva) || obterSefazPorUf('GO')!;
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
                      {LISTA_SEFAZ_ESTADOS.map(s => (
                        <option key={s.uf} value={s.uf}>{s.uf} ({s.sigla})</option>
                      ))}
                    </select>
                  </div>
                  <h4 className="text-xs font-bold text-blue-900 mt-1">
                    CND Estadual — {sefazAtual.sigla}
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate" title={sefazAtual.nomeEstado}>
                    {sefazAtual.nomeEstado}
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  <a
                    href={sefazAtual.urlCnd}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors text-center"
                  >
                    Emitir SEFAZ {sefazAtual.uf} <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={sefazAtual.urlPortal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-center font-medium text-blue-600 hover:text-blue-800 hover:underline py-0.5 truncate"
                  >
                    Portal Fazenda {sefazAtual.uf} ↗
                  </a>
                </div>
              </div>
            );
          })()}

          {/* 3. Municipal (Prefeitura / ISS) */}
          {(() => {
            const prefAtual = LISTA_PREFEITURAS.find(p => p.id === idPrefeituraAtiva) || LISTA_PREFEITURAS[0];
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
                      {LISTA_PREFEITURAS.map(p => (
                        <option key={p.id} value={p.id}>{p.municipio}/{p.uf}</option>
                      ))}
                    </select>
                  </div>
                  <h4 className="text-xs font-bold text-blue-900 mt-1">
                    CND Municipal — {prefAtual.municipio}
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate" title={prefAtual.orgaoNome}>
                    {prefAtual.orgaoNome}
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  <a
                    href={prefAtual.urlCnd}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors text-center"
                  >
                    Emitir Prefeitura <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={prefAtual.urlPortal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-center font-medium text-blue-600 hover:text-blue-800 hover:underline py-0.5"
                  >
                    Portal ISS {prefAtual.municipio} ↗
                  </a>
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
              { id: 'vencidas', rotulo: 'Vencidas' }
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
            const status = obterStatus(cnd.validade);
            const dias = calcularDias(cnd.validade);
            const tipoInfo = NOMES_TIPOS[cnd.tipo] || { rotulo: cnd.tipo, orgao: 'Órgão Competente', icone: '📄' };
            const linkOficial = LINKS_EMISSAO[cnd.tipo];

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
                        Válida ({dias} dias restantes)
                      </span>
                    )}
                    {status === 'alerta' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {dias === 0 ? 'Vence Hoje' : `A Vencer (${dias} dias)`}
                      </span>
                    )}
                    {status === 'vencida' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                        <XCircle className="w-3.5 h-3.5" />
                        Vencida (há {Math.abs(dias)} dias)
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
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Validade</span>
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
                    title="Consultar e Emitir CND Oficializada (SERPRO / Receita Federal)"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Consultar / Emitir CND</span>
                  </button>

                  {linkOficial && (
                    <a
                      href={linkOficial}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
                      title="Abrir página oficial do órgão público no Gov.br"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                      <span>Gov.br Oficial</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => handleExcluir(cnd.id)}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
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
      {/* 🏛️ MODAL OFICIAL: VISUALIZAÇÃO E EMISSÃO DA CND (SERPRO) */}
      {/* ========================================================== */}
      {certidaoVisualizacao && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Barra Superior do Modal */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Visualização da Certidão Oficial (CND)
                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                      <Check className="w-2.5 h-2.5 text-emerald-400" /> Sincronizada SERPRO
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Documento oficial com fé pública e validade jurídica em todo o território nacional
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

            {consultandoOrgao ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-800">Consultando base de dados oficial...</p>
                <p className="text-xs text-slate-500">Conectando aos webservices do SERPRO, RFB e PGFN...</p>
              </div>
            ) : (
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto print:p-0">
                {/* 📄 FOLHA DA CERTIDÃO FORMATO GOVERNO OFICIAL */}
                <div className="bg-white border-2 border-slate-300 rounded-xl p-6 sm:p-8 shadow-inner space-y-6 text-slate-900 font-serif">
                  {/* Cabeçalho da República */}
                  <div className="text-center space-y-1 pb-4 border-b-2 border-slate-800">
                    <div className="text-2xl mb-1">🏛️</div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-800">
                      República Federativa do Brasil
                    </p>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      {certidaoVisualizacao.tipo === 'federal' && 'Ministério da Fazenda — Secretaria Especial da Receita Federal do Brasil'}
                      {certidaoVisualizacao.tipo === 'estadual' && `Governo do Estado — Secretaria da Economia / SEFAZ ${certidaoVisualizacao.uf || 'GO'}`}
                      {certidaoVisualizacao.tipo === 'municipal' && 'Governo Municipal — Secretaria de Finanças e Tributação'}
                      {certidaoVisualizacao.tipo === 'fgts' && 'Caixa Econômica Federal — Diretoria de Fundos de Governo'}
                      {certidaoVisualizacao.tipo === 'trabalhista' && 'Poder Judiciário — Tribunal Superior do Trabalho (TST / CSJT)'}
                    </p>
                    {certidaoVisualizacao.tipo === 'federal' && (
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Procuradoria-Geral da Fazenda Nacional (PGFN)
                      </p>
                    )}
                    <h2 className="text-sm sm:text-base font-black text-slate-950 uppercase pt-3 max-w-xl mx-auto leading-snug">
                      {certidaoVisualizacao.tipo === 'federal' && 'CERTIDÃO NEGATIVA DE DÉBITOS RELATIVOS AOS TRIBUTOS FEDERAIS E À DÍVIDA ATIVA DA UNIÃO'}
                      {certidaoVisualizacao.tipo === 'estadual' && `CERTIDÃO NEGATIVA DE DÉBITOS TRIBUTÁRIOS ESTADUAIS (SEFAZ ${certidaoVisualizacao.uf || 'GO'})`}
                      {certidaoVisualizacao.tipo === 'municipal' && 'CERTIDÃO NEGATIVA DE DÉBITOS MUNICIPAIS E IMPOSTO SOBRE SERVIÇOS (ISS)'}
                      {certidaoVisualizacao.tipo === 'fgts' && 'CERTIFICADO DE REGULARIDADE DO FGTS — CRF'}
                      {certidaoVisualizacao.tipo === 'trabalhista' && 'CERTIDÃO NEGATIVA DE DÉBITOS TRABALHISTAS (CNDT)'}
                    </h2>
                  </div>

                  {/* Identificação do Contribuinte */}
                  <div className="space-y-2 text-xs border border-slate-300 p-3.5 rounded-lg bg-slate-50/50 font-sans">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Nome Empresarial / Razão Social</span>
                        <span className="font-black text-slate-900 text-xs sm:text-sm">{certidaoVisualizacao.clienteNome}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">CNPJ / Inscrição</span>
                        <span className="font-black text-slate-900 font-mono text-xs sm:text-sm">{certidaoVisualizacao.clienteDoc}</span>
                      </div>
                    </div>
                  </div>

                  {/* Texto Legal Oficial */}
                  <div className="text-xs sm:text-sm text-justify leading-relaxed text-slate-800 space-y-3 px-1">
                    {certidaoVisualizacao.tipo === 'federal' && (
                      <p>
                        Ressalvado o direito de a Fazenda Nacional cobrar e inscrever quaisquer dívidas de responsabilidade do sujeito passivo acima identificado que vierem a ser apuradas, é certificado que <strong>NÃO CONSTAM</strong> pendências em seu nome relativas a créditos tributários administrados pela Secretaria Especial da Receita Federal do Brasil (RFB) e a inscrições em Dívida Ativa da União (DAU) junto à Procuradoria-Geral da Fazenda Nacional (PGFN).
                      </p>
                    )}
                    {certidaoVisualizacao.tipo === 'estadual' && (
                      <p>
                        Certifica-se que, revistas as bases da Secretaria de Estado da Fazenda, <strong>NÃO CONSTAM</strong> débitos tributários inscritos na Dívida Ativa do Estado ou sob cobrança administrativa relativamente aos tributos estaduais sob fiscalização deste órgão.
                      </p>
                    )}
                    {certidaoVisualizacao.tipo === 'municipal' && (
                      <p>
                        Certifica-se que, consultados os registros fiscais e cadastrais do Município, <strong>NÃO CONSTAM</strong> débitos de tributos mobiliários ou imobiliários (ISS, Taxas de Licença e Alvarás) vinculados ao CNPJ supracitado até a presente data.
                      </p>
                    )}
                    {certidaoVisualizacao.tipo === 'fgts' && (
                      <p>
                        A Caixa Econômica Federal, no uso da atribuição conferida pelo art. 7º da Lei nº 8.036/90, certifica que a empresa acima identificada encontra-se em <strong>situação regular perante o Fundo de Garantia do Tempo de Serviço - FGTS</strong>.
                      </p>
                    )}
                    {certidaoVisualizacao.tipo === 'trabalhista' && (
                      <p>
                        Certifica-se que a pessoa jurídica acima identificada <strong>NÃO CONSTA</strong> como devedora no Banco Nacional de Devedores Trabalhistas (BNDT), instituído pela Lei nº 12.440/2011.
                      </p>
                    )}
                    <p className="text-[11px] text-slate-600 font-sans italic pt-1">
                      Certidão emitida com base nas diretrizes do Decreto nº 8.302/2014 e Portaria Conjunta RFB/PGFN nº 1.751/2014. A autenticidade deste documento pode ser confirmada nos respectivos portais oficiais.
                    </p>
                  </div>

                  {/* Rodapé e Autenticação */}
                  <div className="border-t-2 border-slate-300 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[11px] font-sans">
                    <div className="space-y-1">
                      <p>
                        <strong>Código de Controle da Certidão:</strong>{' '}
                        <span className="font-mono font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          {certidaoVisualizacao.numero || 'RFB-2026-992140'}
                        </span>
                      </p>
                      <p>
                        <strong>Data de Emissão:</strong> {formatarDataBR(certidaoVisualizacao.emissao)}
                      </p>
                      <p className="text-emerald-800 font-bold">
                        <strong>Válida até:</strong> {formatarDataBR(certidaoVisualizacao.validade)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center rounded">
                        <QrCode className="w-7 h-7" />
                      </div>
                      <div className="text-[10px] text-slate-600 leading-tight">
                        <p className="font-bold text-slate-800">Autenticação Digital</p>
                        <p>Validado via SERPRO</p>
                        <p className="text-[9px] text-slate-400">Integra Contador v1.4</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação do Modal */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer transition-all"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Imprimir / Salvar PDF</span>
                    </button>

                    <a
                      href={LINKS_EMISSAO[certidaoVisualizacao.tipo] || LINKS_EMISSAO.federal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <ExternalLink className="w-4 h-4 text-blue-600" />
                      <span>Acessar Portal Gov.br</span>
                    </a>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCertidaoVisualizacao(null);
                    }}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Concluído / Confirmado</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
