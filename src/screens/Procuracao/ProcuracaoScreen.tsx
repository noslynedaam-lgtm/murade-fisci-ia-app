import { useState, useEffect } from 'react';
import { 
  FileCheck, Shield, Search, AlertTriangle,
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

  // A minuta local não concede poderes perante a RFB. Exija escolha explícita.
  const [poderesSelecionados, setPoderesSelecionados] = useState<string[]>([]);

  // Referências digitadas pelo usuário; nenhum certificado é carregado ou validado.
  const [tipoCertificado, setTipoCertificado] = useState<'' | 'E_CNPJ_A1' | 'E_CNPJ_A3' | 'E_CPF_A1' | 'E_CPF_A3'>('');
  const [autoridadeCertificadora, setAutoridadeCertificadora] = useState('');

  const [validade, setValidade] = useState('');
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
    mensagem: string;
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
    const res = gerarProcuração({ outorgante, outorgado, poderes: poderesSelecionados, validade });
    setProcuracaoGerada(res.procuracao);
    setEmitindo(false);
    setTimeout(() => document.getElementById('procuracao-gerada-box')?.scrollIntoView({ behavior: 'smooth' }), 100);
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
    link.download = `Minuta_Procuracao_Rascunho_${procuracaoGerada.numero}.txt`;
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

      {/* Minuta local; sem selo de homologação governamental */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-2 rounded-xl bg-indigo-900 text-amber-400 shadow-sm">
              <FileSignature className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
              <span>Procuração Eletrônica RFB & e-CAC</span>
              <span className="px-2.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold rounded-full flex items-center gap-1 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                <span>Integração não conectada</span>
              </span>
              <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-bold rounded-full flex items-center gap-1">
                <Award className="w-3 h-3 text-amber-700" />
                <span>Certificado não validado</span>
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Elabore uma minuta local para revisão; assinatura e registro devem ser feitos no serviço oficial.
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

      {/* Estado real da integração */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 rounded-2xl p-4 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-emerald-300">
                Minuta local • sem registro na Receita Federal
              </h3>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 rounded text-[10px] font-mono font-bold">
                IN RFB 2.066/2022
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Este módulo prepara um rascunho para revisão. Não assina, transmite ou registra procuração no e-CAC; use o portal oficial para conceder poderes.
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
            <span>Verificar conexão</span>
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
              O registro oficial de procuração não está integrado. Use o e-CAC para assinar e conceder poderes.
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
          <span className="text-[11px] text-amber-900 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            Consulta oficial não conectada
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
            <span>{consultandoRFB ? 'Verificando...' : 'Verificar disponibilidade'}</span>
          </button>
        </div>

        {resultadoRFB && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-extrabold bg-amber-700 text-white flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" />
                  <span>{resultadoRFB.homologadoGoverno ? 'HOMOLOGADO' : 'NÃO CONSULTADO'}</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-indigo-900 border border-indigo-200">
                  {resultadoRFB.sistemaHomologador}
                </span>
                <span className="text-slate-600 font-mono text-[11px]">Validade: <strong>{resultadoRFB.dataValidade}</strong></span>
              </div>
              <p className="text-amber-950 text-[11px]">{resultadoRFB.mensagem}</p>
            </div>
            <span className="text-[11px] text-slate-500 shrink-0">{resultadoRFB.dataConsulta ? `Consultado em: ${resultadoRFB.dataConsulta}` : 'Nenhuma consulta oficial foi realizada'}</span>
          </div>
        )}
      </div>

      {/* Seção 1: campos de referência, sem validação do arquivo */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-600" />
            <span>1. Dados de referência do certificado</span>
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-amber-800 font-semibold">
            <Shield className="w-4 h-4 text-amber-700" />
            <span>Certificado não carregado nem validado pelo sistema</span>
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
              <option value="">Selecione o tipo (referência)</option>
              <option value="E_CNPJ_A1">e-CNPJ A1 (Arquivo Digital / Nuvem)</option>
              <option value="E_CNPJ_A3">e-CNPJ A3 (Token USB / Cartão Físico)</option>
              <option value="E_CPF_A1">e-CPF A1 (Representante Legal)</option>
              <option value="E_CPF_A3">e-CPF A3 (Token / SmartCard)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Autoridade certificadora (referência)</label>
            <select
              value={autoridadeCertificadora}
              onChange={(e) => setAutoridadeCertificadora(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Selecione a autoridade (referência)</option>
              <option value="AC SERPRO RFB v5 (ICP-Brasil)">AC SERPRO RFB v5 (Oficial Receita Federal)</option>
              <option value="AC Certisign RFB G5">AC Certisign RFB G5 (ICP-Brasil)</option>
              <option value="AC Soluti Multipla v5">AC Soluti Multipla v5 (ICP-Brasil)</option>
              <option value="AC Valid RFB v5">AC Valid RFB v5 (ICP-Brasil)</option>
              <option value="AC Safeweb RFB">AC Safeweb RFB (ICP-Brasil)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Verificação do certificado</label>
            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-900">
              <span className="font-bold text-[11px] flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-amber-700" />
                <span>Não verificado</span>
              </span>
              <span className="font-mono text-[10px] text-slate-500">Arquivo não carregado</span>
            </div>
          </div>
        </div>
      </div>

      {/* Formulário para criar minuta local */}
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

        {/* Poderes desejados para minuta local; não são cadastrados na RFB */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>4. Poderes para a minuta local</span>
                <span className="text-xs text-indigo-600 font-normal">
                  ({poderesSelecionados.length} selecionados)
                </span>
              </h2>
              <button
                type="button"
                onClick={selecionarTodosPoderes}
                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-950 underline cursor-pointer"
              >
                Selecionar todos
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
            <p className="text-[11px] text-amber-800">A seleção só descreve o rascunho. Ela não cria nem altera procuração no e-CAC ou na Receita Federal.</p>
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
              <span>{emitindo ? 'Preparando rascunho...' : 'Criar minuta local (não registrada)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Minuta local */}
      {procuracaoGerada && (
        <div id="procuracao-gerada-box" className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-xl border border-slate-800 space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <span>Minuta local — pendente de assinatura e registro</span>
              </div>
              <h3 className="text-base font-bold text-white font-mono mt-1 flex items-center gap-2">
                <span>Identificador local: {procuracaoGerada.numero}</span>
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-200 border border-amber-500/30 text-[10px] rounded-full font-sans">
                  Rascunho
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Não assinada nem registrada no e-CAC.
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
                title="Baixar minuta local de procuração"
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
                <span>Imprimir minuta</span>
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
