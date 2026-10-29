import { useState, FormEvent } from 'react';
import { 
  Building2, Plus, Search, CheckCircle2, AlertTriangle, 
  ShieldCheck, MapPin, Trash2, FileText, Check, AlertCircle, KeyRound, Edit3
} from 'lucide-react';
import BotaoVoltar from '../../components/BotaoVoltar';
import { EmpresaDados } from '../../types';
import { useEmpresa } from '../../context/EmpresaContext';
import CadastroEmpresaScreen from '../CadastroEmpresa';
import GeracaoGuiasScreen from '../GeracaoGuiasScreen';
import ModalCertificadoEmpresa from './ModalCertificadoEmpresa';
import { confirmarNaTela } from '../../utils/dialogoNaTela';

interface EmpresasScreenProps {
  maxCnpjs?: number;
  onIrParaGuias?: (empresa: EmpresaDados) => void;
}

export default function EmpresasScreen({ maxCnpjs = 500, onIrParaGuias }: EmpresasScreenProps) {
  const { empresas, empresaAtiva, erroEmpresas, selecionarEmpresa, removerEmpresa, salvarNovaEmpresa } = useEmpresa();
  const [busca, setBusca] = useState('');
  const [telaAtiva, setTelaAtiva] = useState<'lista' | 'novo' | 'editar' | 'guias'>('lista');
  const [empresaEmEdicao, setEmpresaEmEdicao] = useState<EmpresaDados | null>(null);
  const [focoCertificado, setFocoCertificado] = useState<boolean>(false);
  const [empresaCertificadoModal, setEmpresaCertificadoModal] = useState<EmpresaDados | null>(null);
  const [empresaSelecionadaGuias, setEmpresaSelecionadaGuias] = useState<EmpresaDados | null>(null);
  const [empresaParaDeletar, setEmpresaParaDeletar] = useState<EmpresaDados | null>(null);
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);

  const mostrarToast = (msg: string) => {
    setToastMensagem(msg);
    setTimeout(() => setToastMensagem(null), 3500);
  };

  const handleSalvarNovaEmpresa = (nova: EmpresaDados) => {
    const salva = salvarNovaEmpresa(nova);
    if (!salva) {
      mostrarToast('Não foi possível salvar. Os dados anteriores foram preservados; verifique o armazenamento local.');
      return;
    }
    selecionarEmpresa(salva);
    setTelaAtiva('lista');
    setEmpresaEmEdicao(null);
    mostrarToast(`Empresa "${salva.razaoSocial}" salva e selecionada com sucesso!`);
  };

  const handleEditarEmpresa = (emp: EmpresaDados, comFocoCertificado = false) => {
    setEmpresaEmEdicao(emp);
    setFocoCertificado(comFocoCertificado);
    setTelaAtiva('editar');
  };

  const handleAbrirModalCertificado = (emp: EmpresaDados) => {
    setEmpresaCertificadoModal(emp);
  };

  const handleSalvarCertificadoModal = async (empresaAtualizada: EmpresaDados) => {
    const salva = salvarNovaEmpresa(empresaAtualizada);
    if (!salva) {
      mostrarToast('Não foi possível salvar as alterações. Os dados anteriores foram preservados.');
      throw new Error('O A1 foi confirmado no cofre do servidor, mas a referência local não pôde ser sincronizada. Atualize a tela; o certificado permanece salvo no servidor.');
    }
    if (empresaAtiva?.id === empresaAtualizada.id) {
      selecionarEmpresa(salva);
    }
    setEmpresaCertificadoModal(null);
    mostrarToast(`A1 cifrado no servidor para "${empresaAtualizada.razaoSocial}". Validade e acesso oficial não foram verificados.`);
  };

  const confirmarExclusao = async () => {
    if (!empresaParaDeletar || !empresaParaDeletar.id) return;
    const nome = empresaParaDeletar.razaoSocial;
    const cadastroCentral = Boolean(empresaParaDeletar.idCentral);
    // Segunda confirmação, dentro da página (no celular ninguém apaga sem querer).
    const certeza = await confirmarNaTela(`EXCLUIR – ÚLTIMA CONFIRMAÇÃO\n\n${cadastroCentral ? 'Arquivar' : 'Apagar de verdade'} a empresa "${nome}"?${cadastroCentral ? '' : ' Isso não pode ser desfeito.'}`);
    if (!certeza) { setEmpresaParaDeletar(null); return; }
    const sucesso = await removerEmpresa(empresaParaDeletar.id);
    if (sucesso) {
      mostrarToast(cadastroCentral
        ? `Empresa "${nome}" arquivada. Os documentos fiscais permanentes foram preservados.`
        : `Empresa "${nome}" e os dados fiscais locais associados foram excluídos deste navegador.`);
    } else {
      mostrarToast('Não foi possível excluir a empresa e confirmar a limpeza dos XMLs locais. O cadastro foi preservado.');
    }
    setEmpresaParaDeletar(null);
  };

  const handleAbrirGuias = (emp: EmpresaDados) => {
    selecionarEmpresa(emp);
    if (onIrParaGuias) {
      onIrParaGuias(emp);
    } else {
      setEmpresaSelecionadaGuias(emp);
      setTelaAtiva('guias');
    }
  };

  if (telaAtiva === 'novo') {
    return (
      <CadastroEmpresaScreen
        onVoltar={() => setTelaAtiva('lista')}
        onEmpresaSalva={(nova) => handleSalvarNovaEmpresa(nova)}
      />
    );
  }

  if (telaAtiva === 'editar' && empresaEmEdicao) {
    return (
      <CadastroEmpresaScreen
        empresaParaEditar={empresaEmEdicao}
        focoCertificado={focoCertificado}
        onVoltar={() => {
          setEmpresaEmEdicao(null);
          setFocoCertificado(false);
          setTelaAtiva('lista');
        }}
        onEmpresaSalva={(atualizada) => {
          handleSalvarNovaEmpresa(atualizada);
        }}
      />
    );
  }

  if (telaAtiva === 'guias' && empresaSelecionadaGuias) {
    return (
      <GeracaoGuiasScreen
        empresaInicial={empresaSelecionadaGuias}
        onVoltar={() => setTelaAtiva('lista')}
      />
    );
  }

  const empresasFiltradas = empresas.filter(e => 
    e.razaoSocial.toLowerCase().includes(busca.toLowerCase()) ||
    e.cnpj.toLowerCase().includes(busca.toLowerCase()) ||
    (e.nomeFantasia && e.nomeFantasia.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div id="empresas-screen" className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Toast Notificação */}
      {toastMensagem && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMensagem}</span>
        </div>
      )}

      <div>
        <BotaoVoltar />
      </div>

      {erroEmpresas && (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          <strong>Não foi possível ler ou salvar o cadastro de empresas.</strong>
          <p className="mt-1">{erroEmpresas} Nenhuma lista vazia foi presumida.</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
              <Building2 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Gestão de Empresas & CNPJs
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controle local e seleção de empresas. Limite de referência do plano: {maxCnpjs} CNPJs; não é aplicado por serviço central.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-900">
            Cadastradas: <strong>{empresas.length}</strong> · referência: {maxCnpjs} CNPJs
          </div>
          {empresas.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const ativa = empresas.find(e => e.id === empresaAtiva?.id);
                if (!ativa) { mostrarToast('Escolha primeiro a empresa que você quer apagar (clique nela na lista).'); return; }
                setEmpresaParaDeletar(ativa);
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-300 hover:border-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Apaga somente a empresa ativa, com duas confirmações"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Apagar empresa</span>
            </button>
          )}
          <button
            type="button"
            id="btn-abrir-nova-empresa"
            onClick={() => setTelaAtiva('novo')}
            className="px-4 py-2 bg-[#1a237e] hover:bg-[#283593] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Empresa</span>
          </button>
        </div>
      </div>

      {/* Barra de Busca */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 ml-1" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar por CNPJ, Razão Social ou Nome Fantasia..."
          className="w-full text-xs outline-none text-slate-800 placeholder:text-slate-400"
        />
      </div>

      {/* Grid de Empresas ou Estado Vazio */}
      {empresasFiltradas.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {empresas.length === 0 ? 'Nenhuma empresa cadastrada no sistema' : 'Nenhuma empresa encontrada com este filtro'}
            </h3>
            <p className="text-xs text-slate-500">
              {empresas.length === 0 
                ? 'Todos os dados de demonstração foram limpos. Cadastre a sua primeira empresa para utilizar em Guias, Fiscal e DCTFWeb.' 
                : 'Tente buscar por outro termo ou limpe o campo de pesquisa.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTelaAtiva('novo')}
            className="px-5 py-2.5 bg-[#1a237e] hover:bg-[#283593] text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Nova Empresa</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {empresasFiltradas.map((emp) => {
            const isAtiva = empresaAtiva?.id === emp.id;
            return (
              <div
                key={emp.id}
                className={`bg-white rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between space-y-4 border ${
                  isAtiva
                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-md'
                    : 'border-slate-200 hover:border-indigo-200 hover:shadow-md'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {emp.regimeTributario?.replace('_', ' ')}
                        </span>
                        {isAtiva && (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-600 text-white flex items-center gap-1">
                            <Check className="w-3 h-3" /> Selecionada
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1.5 line-clamp-1">
                        {emp.razaoSocial}
                      </h3>
                      {emp.nomeFantasia && (
                        <p className="text-xs text-indigo-600 font-medium">{emp.nomeFantasia}</p>
                      )}
                    </div>
                    
                    {/* Ações de Edição e Exclusão no Topo do Card */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditarEmpresa(emp, false)}
                        className="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                        title="Editar cadastro completo desta empresa (contatos, endereço, contadora, etc.)"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setEmpresaParaDeletar(emp)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                        title="Excluir Empresa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 font-mono text-xs text-slate-700 space-y-1">
                    <div>CNPJ: <strong className="text-slate-900">{emp.cnpj}</strong></div>
                    {emp.inscricaoMunicipal && (
                      <div className="font-sans text-[11px] text-slate-600">
                        🏘️ <strong>IM:</strong> {emp.inscricaoMunicipal}
                      </div>
                    )}
                    {emp.cnaePrincipal && (
                      <div className="font-sans text-[11px] text-slate-600">
                        📊 <strong>CNAE:</strong> {emp.cnaePrincipal}
                      </div>
                    )}
                  </div>

                  {/* Endereço */}
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {emp.logradouro ? `${emp.logradouro}, ${emp.numero}` : emp.endereco || 'Endereço não informado'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Badges de Status */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs flex-wrap gap-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {emp.statusCND === 'REGULAR' ? (
                      <span title="Status informado no cadastro; não foi consultado nem validado no órgão." className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <AlertTriangle className="w-3 h-3" /> CND informada • não verificada
                      </span>
                    ) : emp.statusCND === 'PENDENCIA' || emp.statusCND === 'VENCIDA' ? (
                      <span title="Status informado no cadastro; confirme no portal oficial." className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <AlertTriangle className="w-3 h-3" /> Status CND informado: {emp.statusCND === 'VENCIDA' ? 'vencida' : 'pendência'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        <AlertTriangle className="w-3 h-3" /> CND não consultada
                      </span>
                    )}

                    {/* Referência local de validade; não indica validação do arquivo nem conexão. */}
                    {(() => {
                      if (emp.certificado?.servidorCadastrado === true) {
                        return (
                          <button type="button" onClick={() => handleAbrirModalCertificado(emp)} className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300" title="A1 armazenado cifrado no servidor; validade e acesso oficial não foram verificados.">
                            <ShieldCheck className="w-3.5 h-3.5" /> A1 cifrado no servidor
                          </button>
                        );
                      }
                      const validade = emp.certificado?.validade;
                      if (!validade) {
                        return (
                          <button
                            type="button"
                            onClick={() => handleAbrirModalCertificado(emp)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300 transition-all cursor-pointer shadow-2xs group"
                            title="Cadastre uma referência local. O arquivo e a conexão oficial não serão validados nesta tela."
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
                            <span>🔐 Sem referência local • Cadastrar</span>
                          </button>
                        );
                      }
                      const partesValidade = /^(\d{4})-(\d{2})-(\d{2})$/.exec(validade);
                      const anoValidade = partesValidade ? Number(partesValidade[1]) : NaN;
                      const mesValidade = partesValidade ? Number(partesValidade[2]) : NaN;
                      const diaValidade = partesValidade ? Number(partesValidade[3]) : NaN;
                      const data = new Date(anoValidade, mesValidade - 1, diaValidade);
                      const dataInformadaValida = Boolean(partesValidade
                        && data.getFullYear() === anoValidade
                        && data.getMonth() === mesValidade - 1
                        && data.getDate() === diaValidade);
                      if (!dataInformadaValida) {
                        return (
                          <button
                            type="button"
                            onClick={() => handleAbrirModalCertificado(emp)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 transition-colors cursor-pointer"
                            title="A data local está em formato inválido. Nenhum certificado foi validado."
                          >
                            <KeyRound className="w-3 h-3 text-rose-600" /> Data informada inválida • Corrigir
                          </button>
                        );
                      }
                      const hoje = new Date();
                      hoje.setHours(0, 0, 0, 0);
                      const dias = Math.ceil((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                      if (dias < 0) {
                        return (
                          <button
                            type="button"
                            onClick={() => handleAbrirModalCertificado(emp)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 transition-colors cursor-pointer"
                            title="A data de validade cadastrada passou; a validade criptográfica não foi verificada."
                          >
                            <KeyRound className="w-3 h-3 text-rose-600" /> ❌ Data cadastrada passou • Conferir
                          </button>
                        );
                      }
                      if (dias <= 30) {
                        return (
                          <button
                            type="button"
                            onClick={() => handleAbrirModalCertificado(emp)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition-colors cursor-pointer"
                            title={`Data de validade cadastrada para ${dias} dias; autenticidade não verificada.`}
                          >
                            <KeyRound className="w-3 h-3 text-amber-600" /> ⚠️ Data informada: {dias}d
                          </button>
                        );
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => handleAbrirModalCertificado(emp)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300 transition-colors cursor-pointer"
                          title="Data de validade cadastrada no futuro; autenticidade e validade criptográfica não foram verificadas."
                        >
                          <KeyRound className="w-3 h-3 text-slate-600" /> Data futura • não validada
                        </button>
                      );
                    })()}
                  </div>

                  {emp.procuracaoAtiva ? (
                    <span className="text-[11px] font-medium text-indigo-700 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Procuração informada
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">Sem Procuração</span>
                  )}
                </div>

                {/* Ações de Seleção, Edição e Acesso a Guias */}
                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      selecionarEmpresa(emp);
                      mostrarToast(`Empresa "${emp.razaoSocial}" selecionada para todas as telas!`);
                    }}
                    className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                      isAtiva 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-black' 
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isAtiva ? '✓ Empresa Ativa no Sistema' : 'Selecionar Esta Empresa'}</span>
                  </button>

                  {/* Atalhos Rápidos de Gestão: Certificado Digital & Editar Cadastro Completo */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleAbrirModalCertificado(emp)}
                      className="py-2 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-amber-200"
                      title="Cadastrar ou atualizar o Certificado Digital da empresa"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      <span>🔐 Certificado</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEditarEmpresa(emp, false)}
                      className="py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
                      title="Editar cadastro completo (contatos, endereço, contadora, etc.)"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                      <span>✏️ Editar Cadastro</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAbrirGuias(emp)}
                    className="w-full py-2 px-3 rounded-xl bg-[#e8eaf6] hover:bg-[#c5cae9] text-[#1a237e] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-[#c5cae9]"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>🧾 Gerar Guias Fiscais</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Rápido de Certificado Digital & Legalização */}
      {empresaCertificadoModal && (
        <ModalCertificadoEmpresa
          empresa={empresaCertificadoModal}
          onFechar={() => setEmpresaCertificadoModal(null)}
          onSalvarCertificado={handleSalvarCertificadoModal}
          onAbrirCadastroCompleto={() => {
            const emp = empresaCertificadoModal;
            setEmpresaCertificadoModal(null);
            handleEditarEmpresa(emp, true);
          }}
        />
      )}

      {/* Modal de Confirmação de Exclusão de Empresa */}
      {empresaParaDeletar && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-900">
                Excluir Empresa?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {empresaParaDeletar.idCentral ? (
                  <>
                    Arquivar <strong className="text-slate-900 font-semibold">{empresaParaDeletar.razaoSocial}</strong> (CNPJ: {empresaParaDeletar.cnpj}) da carteira. O cadastro continuará guardado no banco, e nenhum documento fiscal será apagado. Você poderá cadastrar novamente o CNPJ; restauração do cadastro antigo exige suporte administrativo.
                  </>
                ) : (
                  <>
                    Excluir <strong className="text-slate-900 font-semibold">{empresaParaDeletar.razaoSocial}</strong> (CNPJ: {empresaParaDeletar.cnpj}) também apagará o livro local, documentos do Radar, XMLs originais e lembretes desta empresa neste navegador. Esta ação não pode ser desfeita.
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEmpresaParaDeletar(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirmar-exclusao-empresa"
                onClick={() => void confirmarExclusao()}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-sm"
              >
                {empresaParaDeletar.idCentral ? 'Arquivar Empresa' : 'Sim, Excluir Empresa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
