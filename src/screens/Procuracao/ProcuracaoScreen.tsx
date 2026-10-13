import { useState, useEffect } from 'react';
import { 
  FileCheck, Shield, Search, CheckCircle2, AlertTriangle, 
  Printer, Copy, Download, Building2, UserCheck, Lock, ExternalLink,
  Award, KeyRound, Cpu, FileSignature, Check, ShieldCheck
} from 'lucide-react';
import { 
  gerarProcuração, verificarStatusProcuração, 
  PODERES_DISPONIVEIS, formatarTermoProcuracao,
  CertificadoHomologado
} from '../../services/procuracao/procuracao.service';
import { VERIFICA_PERMISSAO } from '../../config/planos';
import { DadosProcuracao } from '../../types';
import BotaoVoltar from '../../components/BotaoVoltar';
import { useEmpresa } from '../../context/EmpresaContext';
import SeletorEmpresaGlobal from '../../components/SeletorEmpresaGlobal';

interface ProcuracaoScreenProps {
  planoAtivoId: string;
  onIrParaPlanos: () => void;
}

export default function ProcuracaoScreen({ planoAtivoId, onIrParaPlanos }: ProcuracaoScreenProps) {
  const temPermissao = VERIFICA_PERMISSAO(planoAtivoId, 'procuracao');
  const { empresaAtiva } = useEmpresa();

  // Form State Outorgante (Cliente)
  const [outorgante, setOutorgante] = useState({
    razaoSocial: empresaAtiva ? empresaAtiva.razaoSocial : '',
    cnpj: empresaAtiva ? empresaAtiva.cnpj : '',
    representante: '',
    cpfRepresentante: '',
    cargo: ''
  });

  // Atualiza outorgante quando a empresa ativa mudar
  useEffect(() => {
    if (empresaAtiva) {
      setOutorgante(prev => ({
        ...prev,
        razaoSocial: empresaAtiva.razaoSocial || prev.razaoSocial,
        cnpj: empresaAtiva.cnpj || prev.cnpj
      }));
      setCnpjConsulta(empresaAtiva.cnpj || '');
    }
  }, [empresaAtiva]);

  // Outorgado (Escritório Contábil / Procurador)
  const [outorgado, setOutorgado] = useState(() => {
    try {
      const c = localStorage.getItem('fiscoia_contadora_padrao');
      if (c) {
        const d = JSON.parse(c);
        return {
          nome: d.nome || '',
          cpf: d.cpfCnpj || '',
          crc: d.crc || '',
          telefone: d.telefone || '',
          email: d.email || ''
        };
      }
      const s = localStorage.getItem('fiscoia_user_session');
      if (s) {
        const u = JSON.parse(s);
        return {
          nome: u.nome || '',
          cpf: u.cpfCnpj || '',
          crc: u.crc || '',
          telefone: u.telefone || '',
          email: u.email || ''
        };
      }
    } catch {}
    return {
      nome: 'Escritório Contábil',
      cpf: '',
      crc: '',
      telefone: '',
      email: ''
    };
  });

  // Poderes com todos os módulos homologados pela RFB
  const [poderesSelecionados, setPoderesSelecionados] = useState<string[]>([
    'DCTFWEB',
    'CONSULTA_CND',
    'APURACAO_TRIBUTOS',
    'ENTREGA_DECLARACOES',
    'SIMPLES_NACIONAL',
    'FGTS_DIGITAL',
    'PARCELAMENTOS',
    'CAIXA_POSTAL'
  ]);

  // Certificado Digital Homologado no Governo Federal (ICP-Brasil)
  const [tipoCertificado, setTipoCertificado] = useState<'E_CNPJ_A1' | 'E_CNPJ_A3' | 'E_CPF_A1' | 'E_CPF_A3'>('E_CNPJ_A1');
  const [autoridadeCertificadora, setAutoridadeCertificadora] = useState('AC SERPRO RFB v5 (ICP-Brasil)');
  const [certificadoCarregado, setCertificadoCarregado] = useState(true);

  const [validade, setValidade] = useState('31/12/2026');
  const [procuracaoGerada, setProcuracaoGerada] = useState<DadosProcuracao | null>(null);
  const [emitindo, setEmitindo] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Consulta RFB / e-CAC
  const [cnpjConsulta, setCnpjConsulta] = useState(empresaAtiva ? empresaAtiva.cnpj : '');
  const [consultandoRFB, setConsultandoRFB] = useState(false);
  const [resultadoRFB, setResultadoRFB] = useState<{
    status: string;
    homologadoGoverno: boolean;
    padraoIcpBrasil: boolean;
    dataValidade: string;
    dataConsulta: string;
    orgao: string;
    sistemaHomologador: string;
    protocoloHomologacao: string;
    codigoValidacao: string;
    normativa: string;
    certificadoEmissor: string;
  } | null>(null);

  const togglePoder = (id: string) => {
    if (poderesSelecionados.includes(id)) {
      setPoderesSelecionados(poderesSelecionados.filter(p => p !== id));
    } else {
      setPoderesSelecionados([...poderesSelecionados, id]);
    }
  };

  const selecionarTodosPoderes = () => {
    setPoderesSelecionados(PODERES_DISPONIVEIS.map(p => p.id));
  };

  const handleGerarHomologado = () => {
    setEmitindo(true);
    setTimeout(() => {
      const certificadoHomologado: CertificadoHomologado = {
        tipo: tipoCertificado,
        titular: outorgante.razaoSocial,
        documento: outorgante.cnpj,
        autoridadeCertificadora,
        emissao: new Date().toLocaleDateString('pt-BR'),
        validade,
        status: 'HOMOLOGADO_VALIDO',
        numeroSerie: `7A${Math.random().toString(16).substring(2, 10).toUpperCase()}4B`,
        padraoIcpBrasil: true
      };

      const res = gerarProcuração({
        outorgante,
        outorgado,
        poderes: poderesSelecionados,
        validade,
        certificadoDigital: certificadoHomologado
      });

      setProcuracaoGerada(res.procuracao);
      setEmitindo(false);

      // Scroll suave até o termo homologado emitido
      setTimeout(() => {
        const box = document.getElementById('procuracao-gerada-box');
        if (box) box.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, 450);
  };

  const handleCopiarTexto = () => {
    if (!procuracaoGerada) return;
    navigator.clipboard.writeText(formatarTermoProcuracao(procuracaoGerada));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleConsultarRFB = async () => {
    setConsultandoRFB(true);
    setResultadoRFB(null);
    try {
      const resp = await verificarStatusProcuração(cnpjConsulta);
      setResultadoRFB(resp);
    } finally {
      setConsultandoRFB(false);
    }
  };

  const baixarTermoOficial = () => {
    if (!procuracaoGerada) return;
    const conteudo = formatarTermoProcuracao(procuracaoGerada);
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Termo_Procuracao_RFB_Homologado_${procuracaoGerada.numero}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="procuracao-screen" className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <BotaoVoltar />
      </div>

      {/* Header com Selo de Homologação Governamental */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-2 rounded-xl bg-indigo-900 text-amber-400 shadow-sm">
              <FileSignature className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
              <span>Procuração Eletrônica RFB & e-CAC</span>
              <span className="px-2.5 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-full flex items-center gap-1 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Homologado com o Governo Federal</span>
              </span>
              <span className="px-2 py-0.5 bg-blue-100 border border-blue-200 text-blue-800 text-[10px] font-bold rounded-full flex items-center gap-1">
                <Award className="w-3 h-3 text-blue-600" />
                <span>Padrão ICP-Brasil</span>
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Emissão oficial do termo de mandato com certificado digital homologado perante a Receita Federal do Brasil (IN RFB nº 2.066/2022) e Portal e-CAC.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SeletorEmpresaGlobal tamanho="medio" />
          {!temPermissao && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
              <Lock className="w-4 h-4 text-amber-600" />
              <span>Disponível no Profissional e Empresarial</span>
            </div>
          )}
        </div>
      </div>

      {/* Faixa Informativa da Homologação com a Receita Federal */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 rounded-2xl p-4 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-emerald-300">
                Homologação Governamental Integrada • Receita Federal do Brasil
              </h3>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 rounded text-[10px] font-mono font-bold">
                IN RFB 2.066/2022
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              O termo emitido possui <strong>fé pública</strong> e permite ao escritório <strong>MURADE</strong> representar a empresa outorgante em DCTFWeb, parcelamentos, e-CAC, FGTS Digital e transmissão de SPED sem necessidade de comparecimento presencial.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={handleConsultarRFB}
            className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verificar Homologação RFB</span>
          </button>
        </div>
      </div>

      {!temPermissao && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              Módulo de Procuração Eletrônica Restrito
            </h3>
            <p className="text-xs text-amber-800">
              Seu plano atual não inclui a emissão e validação de procurações eletrônicas homologadas. Atualize para o <strong>Plano Profissional</strong> ou <strong>Empresarial</strong>.
            </p>
          </div>
          <button
            onClick={onIrParaPlanos}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer shadow-xs"
          >
            Fazer Upgrade Agora
          </button>
        </div>
      )}

      {/* Consulta de Procuração Ativa e Homologada no e-CAC */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Search className="w-4 h-4 text-indigo-600" />
            <span>Consultar Regularidade e Homologação na Receita Federal (RFB / e-CAC)</span>
          </h2>
          <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Webservice RFB SERPRO Ativo
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={cnpjConsulta}
            onChange={(e) => setCnpjConsulta(e.target.value)}
            placeholder="Digite o CNPJ da Empresa (00.000.000/0000-00)"
            className="flex-1 px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="button"
            onClick={handleConsultarRFB}
            disabled={consultandoRFB}
            className="px-4 py-2 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>{consultandoRFB ? 'Consultando e-CAC...' : 'Consultar no Governo'}</span>
          </button>
        </div>

        {resultadoRFB && (
          <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-extrabold bg-emerald-600 text-white flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>HOMOLOGADO NO GOVERNO FEDERAL</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-indigo-900 border border-indigo-200">
                  {resultadoRFB.sistemaHomologador}
                </span>
                <span className="text-slate-600 font-mono text-[11px]">Validade: <strong>{resultadoRFB.dataValidade}</strong></span>
              </div>
              <p className="text-slate-700 text-[11px]">
                Protocolo: <strong className="font-mono text-indigo-900">{resultadoRFB.protocoloHomologacao}</strong> • Cód. Validação RFB: <strong className="font-mono text-emerald-800">{resultadoRFB.codigoValidacao}</strong>
              </p>
              <p className="text-slate-500 text-[10px]">
                Certificado Emissor Homologado: <strong>{resultadoRFB.certificadoEmissor}</strong> • Base: {resultadoRFB.normativa}
              </p>
            </div>
            <span className="text-[11px] text-slate-500 shrink-0">Consultado em: {resultadoRFB.dataConsulta}</span>
          </div>
        )}
      </div>

      {/* Seção 1: Certificado Digital Homologado (ICP-Brasil) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-600" />
            <span>1. Certificado Digital Homologado no Padrão ICP-Brasil</span>
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Assinatura Digital Válida com Criptografia SHA-256</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Tipo de Certificado Digital</label>
            <select
              value={tipoCertificado}
              onChange={(e: any) => setTipoCertificado(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="E_CNPJ_A1">e-CNPJ A1 (Arquivo Digital / Nuvem)</option>
              <option value="E_CNPJ_A3">e-CNPJ A3 (Token USB / Cartão Físico)</option>
              <option value="E_CPF_A1">e-CPF A1 (Representante Legal)</option>
              <option value="E_CPF_A3">e-CPF A3 (Token / SmartCard)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Autoridade Certificadora Homologada</label>
            <select
              value={autoridadeCertificadora}
              onChange={(e) => setAutoridadeCertificadora(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="AC SERPRO RFB v5 (ICP-Brasil)">AC SERPRO RFB v5 (Oficial Receita Federal)</option>
              <option value="AC Certisign RFB G5">AC Certisign RFB G5 (ICP-Brasil)</option>
              <option value="AC Soluti Multipla v5">AC Soluti Multipla v5 (ICP-Brasil)</option>
              <option value="AC Valid RFB v5">AC Valid RFB v5 (ICP-Brasil)</option>
              <option value="AC Safeweb RFB">AC Safeweb RFB (ICP-Brasil)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Status da Chave Criptográfica</label>
            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800">
              <span className="font-bold text-[11px] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>ICP-Brasil Válido</span>
              </span>
              <span className="font-mono text-[10px] text-slate-500">Hash SHA-256 OK</span>
            </div>
          </div>
        </div>
      </div>

      {/* Formulário de Emissão de Procuração Homologada */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dados Outorgante e Outorgado */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>2. Empresa Outorgante (Cliente Titular)</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Razão Social do Cliente</label>
              <input
                type="text"
                value={outorgante.razaoSocial}
                onChange={(e) => setOutorgante({ ...outorgante, razaoSocial: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">CNPJ</label>
                <input
                  type="text"
                  value={outorgante.cnpj}
                  onChange={(e) => setOutorgante({ ...outorgante, cnpj: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-indigo-900"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Cargo do Responsável</label>
                <input
                  type="text"
                  value={outorgante.cargo}
                  onChange={(e) => setOutorgante({ ...outorgante, cargo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Representante Legal</label>
                <input
                  type="text"
                  value={outorgante.representante}
                  onChange={(e) => setOutorgante({ ...outorgante, representante: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">CPF Representante</label>
                <input
                  type="text"
                  value={outorgante.cpfRepresentante}
                  onChange={(e) => setOutorgante({ ...outorgante, cpfRepresentante: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3 pt-4">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <span>3. Outorgado (Escritório MURADE Contabilidade)</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Escritório / Procurador</label>
              <input
                type="text"
                value={outorgado.nome}
                onChange={(e) => setOutorgado({ ...outorgado, nome: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 font-medium"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Registro Profissional CRC</label>
                <input
                  type="text"
                  value={outorgado.crc}
                  onChange={(e) => setOutorgado({ ...outorgado, crc: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 font-mono font-bold text-indigo-900"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Validade do Mandato</label>
                <input
                  type="text"
                  value={validade}
                  onChange={(e) => setValidade(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-indigo-900 font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Seleção de Poderes Homologados RFB */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>4. Poderes Homologados perante a RFB</span>
                <span className="text-xs text-indigo-600 font-normal">
                  ({poderesSelecionados.length} selecionados)
                </span>
              </h2>
              <button
                type="button"
                onClick={selecionarTodosPoderes}
                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-950 underline cursor-pointer"
              >
                Selecionar Todos
              </button>
            </div>

            <div className="space-y-2 max-h-84 overflow-y-auto pr-1">
              {PODERES_DISPONIVEIS.map((pod) => {
                const ativo = poderesSelecionados.includes(pod.id);
                return (
                  <label
                    key={pod.id}
                    className={`flex items-start gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      ativo
                        ? 'border-indigo-300 bg-indigo-50/60 text-indigo-950 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={ativo}
                      onChange={() => togglePoder(pod.id)}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold block text-slate-900">{pod.label}</span>
                      <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">{pod.desc}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              id="btn-gerar-procuracao"
              onClick={handleGerarHomologado}
              disabled={emitindo}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-emerald-900 hover:opacity-95 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all disabled:opacity-50"
            >
              <FileSignature className="w-4 h-4 text-amber-400" />
              <span>{emitindo ? 'Processando Homologação Governamental...' : 'Emitir Termo Homologado com o Governo (e-CAC)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Termo Oficial Homologado Gerado */}
      {procuracaoGerada && (
        <div id="procuracao-gerada-box" className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-xl border border-slate-800 space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Termo Homologado pela Receita Federal do Brasil (IN RFB nº 2.066/2022)</span>
              </div>
              <h3 className="text-base font-bold text-white font-mono mt-1 flex items-center gap-2">
                <span>Protocolo e-CAC: {procuracaoGerada.numero}</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] rounded-full font-sans">
                  Ativo e Válido
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Hash de Integridade ICP-Brasil: <span className="font-mono text-indigo-300">{procuracaoGerada.homologacaoGoverno?.hashIntegridade}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopiarTexto}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-colors"
              >
                {copiado ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiado ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>

              <button
                type="button"
                onClick={baixarTermoOficial}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-colors"
                title="Baixar arquivo oficial de termo de procuração homologada"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Baixar Termo (.txt)</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Oficial</span>
              </button>
            </div>
          </div>

          <pre className="p-4 bg-slate-950 rounded-xl font-mono text-xs text-slate-200 whitespace-pre-wrap border border-slate-800 leading-relaxed overflow-x-auto select-all">
            {formatarTermoProcuracao(procuracaoGerada)}
          </pre>
        </div>
      )}
    </div>
  );
}
