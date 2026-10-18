import React, { useState, useEffect, useRef, FormEvent } from 'react';
import BotaoVoltar from '../components/BotaoVoltar';
import { salvarEmpresa } from '../services/empresas/empresas.service';
import { buscarCep } from '../services/viaCep';
import { buscarDadosCNPJ, formatarCnpjString } from '../services/cnpj/receitaFederal.service';
import { normalizarCnpj, validarCnpj } from '../services/cnpj/cnpjValidation';
import { criarEscritorioCentral, listarEmpresasCentrais, listarEscritoriosCentrais, salvarEmpresaCentral, lerEscritorioAtivo, salvarEscritorioAtivo, EscritorioCentral } from '../services/empresas/empresasCentral.service';
import { EmpresaDados } from '../types';
import { 
  Building2, FileText, Phone, MapPin, User, CheckCircle2, 
  AlertTriangle, Loader2, Sparkles, Search, Check, ShieldCheck,
  KeyRound, FileKey, UploadCloud, HardDrive, Lock, Shield,
  ChevronDown, ChevronUp, Award, RefreshCw
} from 'lucide-react';

const REGIMES_TRIBUTARIOS = [
  { id: 'SIMPLES', nome: 'Simples Nacional', desc: 'Guia Única DAS mensal' },
  { id: 'LUCRO_PRESUMIDO', nome: 'Lucro Presumido', desc: 'IRPJ/CSLL trimestrais + PIS/COFINS/ICMS' },
  { id: 'LUCRO_REAL', nome: 'Lucro Real', desc: 'Tributação sobre lucro líquido contábil' }
] as const;

interface NavigationLike {
  goBack: () => void;
}

interface CadastroEmpresaProps {
  navigation?: NavigationLike;
  onVoltar?: () => void;
  onEmpresaSalva?: (empresa: EmpresaDados) => void;
  empresaParaEditar?: EmpresaDados | null;
  focoCertificado?: boolean;
}

export default function CadastroEmpresaScreen({ 
  navigation, 
  onVoltar, 
  onEmpresaSalva,
  empresaParaEditar,
  focoCertificado = false
}: CadastroEmpresaProps) {
  const isEdicao = !!empresaParaEditar;

  const [empresa, setEmpresa] = useState({
    id: empresaParaEditar?.id || '',
    razaoSocial: empresaParaEditar?.razaoSocial || '',
    nomeFantasia: empresaParaEditar?.nomeFantasia || '',
    cnpj: empresaParaEditar?.cnpj || '',
    inscricaoEstadual: empresaParaEditar?.inscricaoEstadual || '',
    inscricaoMunicipal: empresaParaEditar?.inscricaoMunicipal || '',
    regimeTributario: (empresaParaEditar?.regimeTributario as any) || 'SIMPLES' as 'SIMPLES' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL',
    telefone: empresaParaEditar?.telefone || '',
    email: empresaParaEditar?.email || '',
    endereco: empresaParaEditar?.endereco || empresaParaEditar?.logradouro || '',
    numero: empresaParaEditar?.numero || '',
    bairro: empresaParaEditar?.bairro || '',
    cidade: empresaParaEditar?.cidade || '',
    uf: empresaParaEditar?.uf || '',
    cep: empresaParaEditar?.cep || '',
    cnaePrincipal: empresaParaEditar?.cnaePrincipal || '',
    responsavelLegal: empresaParaEditar?.responsavelLegal || '',
    cpfResponsavel: empresaParaEditar?.cpfResponsavel || '',
    nomeContador: empresaParaEditar?.nomeContador || '',
    crcContador: empresaParaEditar?.crcContador || '',
    cpfContador: empresaParaEditar?.cpfContador || '',
    telefoneContador: empresaParaEditar?.telefoneContador || '',
    emailContador: empresaParaEditar?.emailContador || ''
  });

  // 🔐 Espaço & Barra do Certificado Digital no Cadastro do Cliente
  const certInicial = empresaParaEditar?.certificado;
  const [temCertificado, setTemCertificado] = useState<boolean>(!!certInicial || !!focoCertificado);
  const [certTipo, setCertTipo] = useState<'A1' | 'A3'>(certInicial?.tipo || 'A1');
  const [certNomeArquivo, setCertNomeArquivo] = useState<string>(certInicial?.nomeArquivo || '');
  const [certValidade, setCertValidade] = useState<string>(certInicial?.validade || '');
  const [certEmissor, setCertEmissor] = useState<string>(certInicial?.emissor || '');

  const [escritoriosCentrais, setEscritoriosCentrais] = useState<EscritorioCentral[]>([]);
  const [escritorioAtivoId, setEscritorioAtivoId] = useState(lerEscritorioAtivo());
  const [carregandoEscritorios, setCarregandoEscritorios] = useState(true);
  const [erroEscritorios, setErroEscritorios] = useState<string | null>(null);
  const [mostrarNovoEscritorio, setMostrarNovoEscritorio] = useState(false);
  const [novoEscritorioNome, setNovoEscritorioNome] = useState('');
  const [criandoEscritorio, setCriandoEscritorio] = useState(false);

  const [carregando, setCarregando] = useState(false);
  const [consultandoCNPJ, setConsultandoCNPJ] = useState(false);
  const [cnpjConsultado, setCnpjConsultado] = useState(false);
  const [situacaoCadastral, setSituacaoCadastral] = useState<string | null>(null);

  const [mostrarOpcionais, setMostrarOpcionais] = useState(isEdicao);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState<string | null>(null);
  const consultaCepId = useRef(0);
  const consultaCnpjId = useRef(0);
  const [alertaInfo, setAlertaInfo] = useState<{ tipo: 'sucesso' | 'aviso' | 'erro'; titulo: string; mensagem: string } | null>(null);

  useEffect(() => {
    let ativo = true;
    void listarEscritoriosCentrais().then((lista) => {
      if (!ativo) return;
      setEscritoriosCentrais(lista);
      const salvo = lerEscritorioAtivo();
      const selecionado = lista.some(item => item.id === salvo) ? salvo : lista.length === 1 ? lista[0].id : '';
      setEscritorioAtivoId(selecionado);
      if (selecionado) salvarEscritorioAtivo(selecionado);
      setErroEscritorios(lista.length ? null : 'Sua conta não está vinculada a um escritório no servidor.');
    }).catch((error: unknown) => {
      if (ativo) setErroEscritorios(error instanceof Error ? error.message : 'Não foi possível carregar os escritórios da conta.');
    }).finally(() => {
      if (ativo) setCarregandoEscritorios(false);
    });
    return () => { ativo = false; };
  }, []);

  const handleCriarEscritorio = async () => {
    setCriandoEscritorio(true);
    setErroEscritorios(null);
    try {
      const tenant = await criarEscritorioCentral(novoEscritorioNome.trim());
      setEscritoriosCentrais(current => [...current, tenant]);
      setEscritorioAtivoId(tenant.id);
      salvarEscritorioAtivo(tenant.id);
      setNovoEscritorioNome('');
      setMostrarNovoEscritorio(false);
    } catch (error) {
      setErroEscritorios(error instanceof Error ? error.message : 'Não foi possível criar o escritório.');
    } finally {
      setCriandoEscritorio(false);
    }
  };

  // Carrega dados da contadora ativa / padrão
  const carregarDadosContadoraMinhaConta = () => {
    try {
      const rawCont = localStorage.getItem('fiscoia_contadora_padrao');
      const dados = rawCont ? JSON.parse(rawCont) : null;
      if (dados && (dados.nome || dados.crc)) {
        setEmpresa(prev => ({
          ...prev,
          nomeContador: dados.nome || prev.nomeContador,
          crcContador: dados.crc || prev.crcContador,
          cpfContador: dados.cpfCnpj || prev.cpfContador,
          telefoneContador: dados.telefone || prev.telefoneContador,
          emailContador: dados.email || prev.emailContador
        }));
        return;
      }
      const rawSessao = localStorage.getItem('fiscoia_user_session');
      if (rawSessao) {
        const u = JSON.parse(rawSessao);
        setEmpresa(prev => ({
          ...prev,
          nomeContador: u.nome || prev.nomeContador,
          crcContador: u.crc || prev.crcContador,
          cpfContador: u.cpfCnpj || prev.cpfContador,
          telefoneContador: u.telefone || prev.telefoneContador,
          emailContador: u.email || prev.emailContador
        }));
      }
    } catch {}
  };

  useEffect(() => {
    if (!isEdicao) {
      carregarDadosContadoraMinhaConta();
    }
  }, [isEdicao]);

  useEffect(() => {
    if (focoCertificado) {
      setTimeout(() => {
        const elem = document.getElementById('espaco-certificado-digital');
        if (elem) elem.scrollIntoView({ behavior: 'smooth' });
      }, 350);
    }
  }, [focoCertificado]);

  const handleLimparTudo = () => {
    consultaCnpjId.current += 1;
    setConsultandoCNPJ(false);
    setEmpresa({
      razaoSocial: '',
      nomeFantasia: '',
      cnpj: '',
      inscricaoEstadual: '',
      inscricaoMunicipal: '',
      regimeTributario: 'SIMPLES',
      telefone: '',
      email: '',
      endereco: '',
      numero: '',
      bairro: '',
      cidade: '',
      uf: '',
      cep: '',
      cnaePrincipal: '',
      responsavelLegal: '',
      cpfResponsavel: '',
      nomeContador: '',
      crcContador: '',
      cpfContador: '',
      telefoneContador: '',
      emailContador: ''
    });
    setCertNomeArquivo('');
    setCnpjConsultado(false);
    setSituacaoCadastral(null);
    setAlertaInfo({
      tipo: 'sucesso',
      titulo: '🧹 Formulário Limpo com Sucesso!',
      mensagem: 'Todos os campos foram zerados. Você já pode iniciar o cadastro da nova empresa e do CRC da contadora.'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const calcularDiasVencimento = (dataStr: string) => {
    if (!dataStr) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const data = new Date(dataStr + 'T00:00:00');
    const diffTime = data.getTime() - hoje.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const executarVoltar = () => {
    if (onVoltar) {
      onVoltar();
    } else if (navigation && typeof navigation.goBack === 'function') {
      navigation.goBack();
    }
  };

  // Formatação de CPF
  const formatarCpf = (valor: string) => {
    const limpo = valor.replace(/\D/g, '').slice(0, 11);
    if (limpo.length <= 3) return limpo;
    if (limpo.length <= 6) return `${limpo.slice(0, 3)}.${limpo.slice(3)}`;
    if (limpo.length <= 9) return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6)}`;
    return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9, 11)}`;
  };

  // Formatação de Telefone
  const formatarTelefone = (valor: string) => {
    const limpo = valor.replace(/\D/g, '').slice(0, 11);
    if (limpo.length <= 2) return limpo;
    if (limpo.length <= 6) return `(${limpo.slice(0, 2)}) ${limpo.slice(2)}`;
    if (limpo.length <= 10) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  };

  // Formatação de CEP
  const formatarCep = (valor: string) => {
    const limpo = valor.replace(/\D/g, '').slice(0, 8);
    if (limpo.length <= 5) return limpo;
    return `${limpo.slice(0, 5)}-${limpo.slice(5)}`;
  };

  // 🔍 BUSCA NA RECEITA FEDERAL
  const consultarCNPJ = async () => {
    const consultaAtual = ++consultaCnpjId.current;
    const cnpjNormalizado = normalizarCnpj(empresa.cnpj);
    if (!validarCnpj(cnpjNormalizado)) {
      setConsultandoCNPJ(false);
      setAlertaInfo({
        tipo: 'aviso',
        titulo: '⚠️ Atenção: CNPJ Incompleto',
        mensagem: 'Informe um CNPJ válido com 14 caracteres e dígitos verificadores corretos.'
      });
      return;
    }

    setConsultandoCNPJ(true);
    setAlertaInfo(null);
    try {
      const resultado = await buscarDadosCNPJ(cnpjNormalizado);
      if (consultaAtual !== consultaCnpjId.current || normalizarCnpj(empresa.cnpj) !== cnpjNormalizado) return;

      if (resultado.sucesso && resultado.dados) {
        const dados = resultado.dados;
        setEmpresa(prev => {
          if (normalizarCnpj(prev.cnpj) !== cnpjNormalizado) return prev;
          return {
            ...prev,
            cnpj: dados.cnpjFormatado || prev.cnpj,
            razaoSocial: dados.razaoSocial || prev.razaoSocial,
            nomeFantasia: dados.nomeFantasia || prev.nomeFantasia,
            endereco: dados.endereco || prev.endereco,
            numero: dados.numero || prev.numero,
            bairro: dados.bairro || prev.bairro,
            cidade: dados.cidade || prev.cidade,
            uf: dados.uf || prev.uf,
            cep: dados.cep || prev.cep,
            telefone: dados.telefone || prev.telefone,
            email: dados.email || prev.email,
            cnaePrincipal: dados.cnaePrincipal || prev.cnaePrincipal
          };
        });

        setCnpjConsultado(true);
        setSituacaoCadastral(dados.situacaoCadastral || 'NÃO INFORMADA');
        setAlertaInfo({
          tipo: 'sucesso',
          titulo: '✅ CNPJ Encontrado!',
          mensagem: `Dados recebidos do provedor terceiro ${resultado.fonte || 'de consulta cadastral'}. Situação informada pela fonte: ${dados.situacaoCadastral || 'não informada'}. Isso não é consulta autenticada da Receita Federal, não é consulta fiscal e não comprova regularidade; confira os campos antes de salvar.`
        });
      } else {
        setCnpjConsultado(false);
        setAlertaInfo({
          tipo: 'aviso',
          titulo: '⚠️ Consulta Não Concluída',
          mensagem: `${resultado.mensagem || 'Não foi possível consultar os dados automaticamente.'} Você pode preencher todos os dados da empresa manualmente.`
        });
      }
    } catch {
      if (consultaAtual === consultaCnpjId.current) {
        setCnpjConsultado(false);
        setAlertaInfo({ tipo: 'aviso', titulo: 'Consulta não concluída', mensagem: 'Os provedores cadastrais não responderam. Preencha os dados manualmente.' });
      }
    } finally {
      if (consultaAtual === consultaCnpjId.current) setConsultandoCNPJ(false);
    }
  };

  // Consulta automática de CEP (ViaCEP)
  const handleConsultarCep = async (cepInformado: string) => {
    const limpo = cepInformado.replace(/\D/g, '');
    if (limpo.length !== 8) {
      consultaCepId.current += 1;
      setBuscandoCep(false);
      setErroCep(null);
      return;
    }
    const consultaAtual = ++consultaCepId.current;
    setBuscandoCep(true);
    setErroCep(null);
    try {
      const resultado = await buscarCep(limpo);
      if (consultaAtual !== consultaCepId.current) return;
      if (resultado.erro || !resultado.dados) {
        setErroCep(resultado.mensagem || 'Não foi possível localizar o CEP. Preencha o endereço manualmente.');
        return;
      }
      const dados = resultado.dados;
      setEmpresa(prev => ({
        ...prev,
        endereco: dados.logradouro || prev.endereco,
        bairro: dados.bairro || prev.bairro,
        cidade: dados.localidade || prev.cidade,
        uf: (dados.uf || prev.uf).toUpperCase()
      }));
    } catch (e) {
      if (consultaAtual === consultaCepId.current) {
        setErroCep(e instanceof Error ? e.message : 'Falha na consulta ao ViaCEP. Preencha o endereço manualmente.');
      }
    } finally {
      if (consultaAtual === consultaCepId.current) setBuscandoCep(false);
    }
  };

  // 💾 SALVAR EMPRESA
  const handleSalvarEmpresa = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setAlertaInfo(null);

    // Validação
    if (!empresa.razaoSocial.trim() || !empresa.cnpj.trim()) {
      setAlertaInfo({
        tipo: 'erro',
        titulo: '⚠️ Preencha Razão Social e CNPJ!',
        mensagem: 'Os campos Razão Social e CNPJ são obrigatórios para emissão de guias e compliance fiscal.'
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const cnpjLimpo = normalizarCnpj(empresa.cnpj);
    if (!validarCnpj(cnpjLimpo)) {
      setAlertaInfo({
        tipo: 'erro',
        titulo: '⚠️ CNPJ Inválido',
        mensagem: 'O CNPJ deve conter 14 caracteres e dígitos verificadores válidos.'
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!escritorioAtivoId || !escritoriosCentrais.some(item => item.id === escritorioAtivoId)) {
      setAlertaInfo({
        tipo: 'erro',
        titulo: 'Selecione o escritório',
        mensagem: erroEscritorios || 'Escolha o escritório responsável antes de salvar a empresa no banco central.'
      });
      return;
    }

    setCarregando(true);

    try {
      const empresasCentrais = await listarEmpresasCentrais(escritorioAtivoId);
      const cnpjJaExistente = empresasCentrais.find(item => normalizarCnpj(item.cnpj) === cnpjLimpo);
      if (cnpjJaExistente && !isEdicao) {
        throw new Error('Este CNPJ já está cadastrado no escritório escolhido. Selecione o cadastro existente para editar.');
      }
      const registroCentral = await salvarEmpresaCentral(
        { ...empresa, razaoSocial: empresa.razaoSocial.toUpperCase() },
        escritorioAtivoId,
        empresaParaEditar?.idCentral || cnpjJaExistente?.id,
      );
      const dadosCertificado = temCertificado ? {
        tipo: certTipo,
        nomeArquivo: certNomeArquivo,
        validade: certValidade,
        emissor: certEmissor,
        ativo: false,
        valido: false,
        dataCadastro: new Date().toLocaleDateString('pt-BR')
      } : undefined;

      const empresaSalva = salvarEmpresa({
        ...empresa,
        id: empresaParaEditar?.id || empresa.id || undefined,
        idCentral: registroCentral.id,
        tenantIdCentral: escritorioAtivoId,
        razaoSocial: empresa.razaoSocial.toUpperCase(),
        logradouro: empresa.endereco,
        statusCND: empresaParaEditar?.statusCND || 'NAO_CONSULTADA',
        envioDadosMes: empresaParaEditar?.envioDadosMes,
        envioDCTFWeb: empresaParaEditar?.envioDCTFWeb,
        procuracaoAtiva: empresaParaEditar?.procuracaoAtiva ?? false,
        certificado: dadosCertificado
      });

      if (dadosCertificado) {
        try {
          localStorage.setItem('fiscoia_certificado_cliente_' + cnpjLimpo, JSON.stringify(dadosCertificado));
        } catch {
          // ignore
        }
      }

      // Aviso baseado na data declarada pelo usuário, não na leitura do certificado.
      let avisoCert = '';
      if (certValidade) {
        const diasCert = calcularDiasVencimento(certValidade);
        if (diasCert !== null) {
          if (diasCert < 0) avisoCert = 'A data de validade informada está no passado; o certificado não foi verificado.';
          else if (diasCert <= 30) avisoCert = `A data informada ocorre em ${diasCert} dias; o certificado não foi verificado.`;
        }
      }

      setCarregando(false);
      setAlertaInfo({
        tipo: 'sucesso',
        titulo: '✅ Empresa salva no servidor',
        mensagem: avisoCert
          ? `${empresa.razaoSocial} foi gravada no escritório ${escritoriosCentrais.find(item => item.id === escritorioAtivoId)?.nome || ''} e espelhada neste navegador. A validade do certificado é apenas a data informada pelo usuário. ${avisoCert}`
          : `${empresa.razaoSocial} (CNPJ: ${empresa.cnpj}) foi gravada no escritório ${escritoriosCentrais.find(item => item.id === escritorioAtivoId)?.nome || ''} e espelhada neste navegador.${dadosCertificado ? ' Os dados do certificado são apenas uma referência; arquivo, validade e acesso não foram enviados nem validados.' : ''}`
      });

      window.setTimeout(() => {
        if (onEmpresaSalva) onEmpresaSalva(empresaSalva);
        executarVoltar();
      }, 1300);
    } catch (error) {
      setCarregando(false);
      setAlertaInfo({
        tipo: 'erro',
        titulo: 'Erro ao Salvar',
        mensagem: error instanceof Error
          ? error.message
          : 'Ocorreu uma falha ao gravar os dados localmente. Tente novamente.'
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-16 px-4 sm:px-6">
      {/* Seta de Voltar — igual em todo o sistema */}
      <div className="mb-4">
        <BotaoVoltar onVoltar={executarVoltar} />
      </div>

      {/* Cabeçalho */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1a237e] tracking-tight">
                {isEdicao ? '✏️ Editar Cadastro de Empresa' : '🏢 Cadastro de Empresa'}
              </h1>
              {isEdicao && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200">
                  Modo Edição
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {isEdicao 
                ? `Altere dados de contato, endereço, contadora e certificado digital da ${empresa.razaoSocial || 'empresa'}.`
                : 'Digite o CNPJ; a consulta automática depende da disponibilidade da fonte cadastral'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            {!isEdicao && (
              <button
                type="button"
                onClick={handleLimparTudo}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition-colors cursor-pointer"
                title="Limpar todos os campos para preencher nova empresa do zero"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Limpar Formulário</span>
              </button>
            )}

            <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Consulta cadastral por provedores terceiros</span>
            </div>
          </div>
        </div>

        {/* Notificações e Alertas */}
        {alertaInfo && (
          <div className={`mt-5 p-4 rounded-2xl border flex items-start gap-3 text-sm animate-in fade-in ${
            alertaInfo.tipo === 'sucesso' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : alertaInfo.tipo === 'erro' 
              ? 'bg-rose-50 border-rose-200 text-rose-800' 
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            {alertaInfo.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : alertaInfo.tipo === 'erro' ? (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">{alertaInfo.titulo}</p>
              <p className="text-xs mt-0.5 leading-relaxed">{alertaInfo.mensagem}</p>
            </div>
          </div>
        )}
      </div>

      {/* 🔐 BARRA SUPERIOR DE CADASTRO DO CERTIFICADO DIGITAL */}
      <div 
        id="barra-certificado-digital-atalho"
        className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-blue-700/50"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-600/40 border border-blue-400/40 flex items-center justify-center text-blue-200 shrink-0">
            <KeyRound className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                Barra de Cadastro
              </span>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Certificado Digital do Cliente (A1 / A3)
              </h2>
            </div>
            <p className="text-xs text-blue-200/80 mt-0.5">
              {temCertificado 
                ? (certTipo === 'A1' ? 'Referência A1 — o arquivo não é enviado nem validado' : 'Referência A3 — token não conectado nesta aplicação')
                : 'Clique ao lado para vincular o certificado digital deste cliente'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => {
              setTemCertificado(!temCertificado);
              const elem = document.getElementById('espaco-certificado-digital');
              if (elem) elem.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
              temCertificado
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span>{temCertificado ? '🔐 Referência cadastrada' : '➕ Cadastrar referência'}</span>
          </button>

          <a
            href="#espaco-certificado-digital"
            onClick={(e) => {
              e.preventDefault();
              const elem = document.getElementById('espaco-certificado-digital');
              if (elem) elem.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3 py-2 rounded-xl bg-blue-800/80 hover:bg-blue-700 text-xs font-semibold text-blue-100 border border-blue-600/60 transition-all cursor-pointer"
          >
            Ir para o Espaço ↓
          </a>
        </div>
      </div>

      <form onSubmit={handleSalvarEmpresa} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label htmlFor="escritorio-central" className="mb-2 block text-sm font-bold text-slate-800">Escritório responsável — banco permanente</label>
          <select
            id="escritorio-central"
            value={escritorioAtivoId}
            disabled={carregandoEscritorios || Boolean(erroEscritorios)}
            onChange={(event) => {
              setEscritorioAtivoId(event.target.value);
              if (event.target.value) salvarEscritorioAtivo(event.target.value);
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800 disabled:bg-slate-100"
          >
            <option value="">{carregandoEscritorios ? 'Carregando escritórios...' : 'Selecione um escritório'}</option>
            {escritoriosCentrais.map(item => <option key={item.id} value={item.id}>{item.nome} · {item.papel}</option>)}
          </select>
          {erroEscritorios && <p className="mt-2 text-sm text-amber-800">{erroEscritorios}</p>}
          <p className="mt-2 text-xs text-slate-500">O cadastro só é confirmado após gravação no servidor. Arquivos e senhas de certificado não são enviados por este formulário.</p>
          <div className="mt-3">
            {!mostrarNovoEscritorio ? (
              <button type="button" onClick={() => setMostrarNovoEscritorio(true)} className="text-sm font-semibold text-blue-800 hover:text-blue-950">
                + Criar outro escritório
              </button>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={novoEscritorioNome}
                  onChange={event => setNovoEscritorioNome(event.target.value)}
                  maxLength={160}
                  placeholder="Nome do escritório"
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={criandoEscritorio || novoEscritorioNome.trim().length < 2}
                  onClick={() => void handleCriarEscritorio()}
                  className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {criandoEscritorio ? 'Criando...' : 'Criar e selecionar'}
                </button>
                <button type="button" onClick={() => setMostrarNovoEscritorio(false)} className="rounded-xl border px-4 py-2 text-sm">Cancelar</button>
              </div>
            )}
          </div>
        </section>
        {/* 📌 CNPJ + BUSCA — DESTAQUE */}
        <div className="bg-[#e8eaf6] rounded-2xl p-5 sm:p-6 border-2 border-[#1a237e] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm sm:text-base font-bold text-[#1a237e]">
              CNPJ * — Preencha e clique em BUSCAR
            </label>
            {situacaoCadastral && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 flex items-center gap-1 border border-amber-300">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Situação informada pela fonte: {situacaoCadastral} · não validada</span>
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <input
                id="cnpj"
                name="cnpj"
                type="text"
                required
                maxLength={18}
                value={empresa.cnpj}
                onChange={(e) => {
                  consultaCnpjId.current += 1;
                  setConsultandoCNPJ(false);
                  setEmpresa({ ...empresa, cnpj: formatarCnpjString(e.target.value) });
                  setCnpjConsultado(false);
                  setSituacaoCadastral(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    consultarCNPJ();
                  }
                }}
                placeholder="00.000.000/0000-00"
                className="w-full px-4 py-3 bg-white border-2 border-[#1a237e] rounded-xl text-base sm:text-lg font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a237e]/40 shadow-inner"
              />
            </div>

            <button
              type="button"
              onClick={consultarCNPJ}
              disabled={consultandoCNPJ}
              className="px-6 py-3 bg-[#1a237e] hover:bg-[#283593] disabled:opacity-60 text-white font-bold text-sm sm:text-base rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              {consultandoCNPJ ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Consultando base pública...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>🔍 Buscar</span>
                </>
              )}
            </button>
          </div>

          {cnpjConsultado ? (
            <p className="text-xs sm:text-sm text-amber-900 font-bold flex items-center gap-1.5 pt-1 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Dados recebidos de provedor terceiro — confira antes de salvar; não são uma consulta oficial ou fiscal</span>
            </p>
          ) : (
            <p className="text-xs text-slate-600">
              💡 A busca usa APIs públicas de terceiros e pode estar desatualizada. Ela não confirma situação fiscal; se falhar, preencha os campos manualmente.
            </p>
          )}
        </div>

        {/* 📋 DADOS PRINCIPAIS */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-[#e8eaf6]">
            <FileText className="w-5 h-5 text-[#1a237e]" />
            <h2 className="text-lg font-bold text-[#1a237e]">
              📋 Dados Principais
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Razão Social *
              </label>
              <input
                id="razaoSocial"
                name="razaoSocial"
                type="text"
                required
                value={empresa.razaoSocial}
                onChange={(e) => setEmpresa({ ...empresa, razaoSocial: e.target.value })}
                placeholder="Nome completo da empresa"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Inscrição Estadual (IE)
                </label>
                <input
                  id="inscricaoEstadual"
                  name="inscricaoEstadual"
                  type="text"
                  value={empresa.inscricaoEstadual}
                  onChange={(e) => setEmpresa({ ...empresa, inscricaoEstadual: e.target.value })}
                  placeholder="Isento ou Nº Estadual"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  UF (Estado) *
                </label>
                <input
                  id="uf"
                  name="uf"
                  type="text"
                  maxLength={2}
                  value={empresa.uf}
                  onChange={(e) => setEmpresa({ ...empresa, uf: e.target.value.toUpperCase() })}
                  placeholder="UF (ex: GO, SP)"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-center text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e] uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nome Fantasia
              </label>
              <input
                type="text"
                value={empresa.nomeFantasia}
                onChange={(e) => setEmpresa({ ...empresa, nomeFantasia: e.target.value })}
                placeholder="Nome de divulgação"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Regime Tributário *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {REGIMES_TRIBUTARIOS.map((regime) => {
                  const ativo = empresa.regimeTributario === regime.id;
                  return (
                    <button
                      key={regime.id}
                      type="button"
                      onClick={() => setEmpresa({ ...empresa, regimeTributario: regime.id })}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        ativo
                          ? 'bg-[#e8eaf6] border-[#1a237e] text-[#1a237e] font-bold shadow-sm ring-1 ring-[#1a237e]'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-sm font-bold flex items-center justify-between">
                        <span>{regime.nome}</span>
                        {ativo && <Check className="w-4 h-4 text-[#1a237e]" />}
                      </div>
                      <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                        {regime.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ✅ CADASTRO ATUALIZADO — SÓ AS 3 COISAS NECESSÁRIAS: SEM IE, SEM EMISSÃO DE NOTA */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-indigo-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-indigo-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200">
                  🎯 Simples & Essencial
                </span>
                <span className="text-xs text-slate-500 font-semibold">Sem IE · Sem Emissão de Notas</span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#1a237e] mt-1.5">
                Só as 3 Coisas Necessárias
              </h2>
            </div>
            <span className="text-xs text-slate-500 hidden sm:block">Foco em Tributação & Obrigações Fiscais</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1️⃣ INSCRIÇÃO MUNICIPAL */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                  1️⃣ 🏘️ Inscrição Municipal (IM)
                </label>
                <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                  Para calcular e pagar o ISS na Prefeitura.
                </p>
                <input
                  type="text"
                  maxLength={20}
                  value={empresa.inscricaoMunicipal}
                  onChange={(e) => setEmpresa({ ...empresa, inscricaoMunicipal: e.target.value })}
                  placeholder="Nº da Prefeitura — ISS"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                />
              </div>
            </div>

            {/* 2️⃣ CNAE */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                  2️⃣ 📊 CNAE Principal
                </label>
                <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                  Define a atividade e os impostos da empresa.
                </p>
                <input
                  type="text"
                  value={empresa.cnaePrincipal}
                  onChange={(e) => setEmpresa({ ...empresa, cnaePrincipal: e.target.value })}
                  placeholder="Código da Atividade (ex: 8211-3/00)"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                />
              </div>
            </div>

            {/* 3️⃣ CERTIFICADO DIGITAL VENCIMENTO */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                  3️⃣ 🔐 Data de validade informada
                </label>
                <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                  Data declarada manualmente; não é lida do arquivo nem consultada na Receita.
                </p>
                <input
                  type="date"
                  value={certValidade}
                  onChange={(e) => {
                    setCertValidade(e.target.value);
                    if (e.target.value) setTemCertificado(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                />
              </div>
              
              {/* Status do Certificado em tempo real */}
              <div className="mt-2.5 pt-2 border-t border-slate-200">
                {(() => {
                  if (!certValidade) {
                    return <span className="text-[11px] font-bold text-slate-400">⚪ Sem registro de vencimento</span>;
                  }
                  const dias = calcularDiasVencimento(certValidade);
                  if (dias === null) return null;
                  if (dias < 0) {
                    return <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">Data informada está no passado · não verificado</span>;
                  }
                  if (dias <= 30) {
                    return <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Data informada ocorre em {dias} dias · não verificado</span>;
                  }
                  return <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Data informada: {dias} dias até o vencimento (não validado)</span>;
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* 👩‍💼 DADOS DA CONTADORA RESPONSÁVEL & REGISTRO CRC */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                  👩‍💼 Contadora Responsável
                </span>
                <span className="text-xs text-slate-500 font-semibold">Conselho Regional de Contabilidade</span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#1a237e] mt-1.5 flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600" />
                <span>Dados do Contador(a) & CRC da Empresa</span>
              </h2>
            </div>
            
            <button
              type="button"
              onClick={carregarDadosContadoraMinhaConta}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-indigo-200 cursor-pointer transition-colors self-start sm:self-auto"
              title="Recarregar dados do perfil ativo em Minha Conta"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Puxar de Minha Conta</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Nome Completo da Contadora
              </label>
              <input
                type="text"
                value={empresa.nomeContador}
                onChange={(e) => setEmpresa({ ...empresa, nomeContador: e.target.value })}
                placeholder="Ex: Contadora Responsável"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                <span>Registro CRC da Contadora *</span>
              </label>
              <input
                type="text"
                value={empresa.crcContador}
                onChange={(e) => setEmpresa({ ...empresa, crcContador: e.target.value.toUpperCase() })}
                placeholder="Ex: CRC-GO 123456/O ou CRC-SP 000000/O"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono text-indigo-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                CPF da Contadora / CNPJ Escritório
              </label>
              <input
                type="text"
                value={empresa.cpfContador}
                onChange={(e) => setEmpresa({ ...empresa, cpfContador: e.target.value })}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Telefone / WhatsApp da Contabilidade
              </label>
              <input
                type="text"
                value={empresa.telefoneContador}
                onChange={(e) => setEmpresa({ ...empresa, telefoneContador: e.target.value })}
                placeholder="(00) 00000-0000"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                E-mail de Contato da Contadora
              </label>
              <input
                type="email"
                value={empresa.emailContador}
                onChange={(e) => setEmpresa({ ...empresa, emailContador: e.target.value })}
                placeholder="contato@contabilidade.com.br"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
              />
            </div>
          </div>
        </div>

        {/* 🔽 DADOS COMPLEMENTARES OPCIONAIS (RECOLHÍVEIS) */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setMostrarOpcionais(!mostrarOpcionais)}
            className="w-full p-4 flex items-center justify-between text-left text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {mostrarOpcionais ? '🔼 Ocultar Dados Opcionais' : '🔽 Exibir Dados Opcionais (Endereço, Contato e Responsável)'}
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                (Opcional — não obrigatório para o cadastro essencial)
              </span>
            </div>
            {mostrarOpcionais ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </button>

          {mostrarOpcionais && (
            <div className="p-6 border-t border-slate-200 bg-white space-y-6 animate-in fade-in">
              {/* 📞 CONTATO */}
              <div>
                <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
                  <Phone className="w-4 h-4 text-[#1a237e]" />
                  <h3 className="text-sm font-bold text-[#1a237e]">
                    Contato (Opcional)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Telefone / WhatsApp
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      value={empresa.telefone}
                      onChange={(e) => setEmpresa({ ...empresa, telefone: formatarTelefone(e.target.value) })}
                      placeholder="(00) 00000-0000"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={empresa.email}
                      onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })}
                      placeholder="empresa@email.com"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                    />
                  </div>
                </div>
              </div>

              {/* 📍 ENDEREÇO */}
              <div>
                <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
                  <MapPin className="w-4 h-4 text-[#1a237e]" />
                  <h3 className="text-sm font-bold text-[#1a237e]">
                    Endereço (Opcional)
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Logradouro
                    </label>
                    <input
                      type="text"
                      value={empresa.endereco}
                      onChange={(e) => setEmpresa({ ...empresa, endereco: e.target.value })}
                      placeholder="Rua, Av, etc."
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Número
                      </label>
                      <input
                        type="text"
                        value={empresa.numero}
                        onChange={(e) => setEmpresa({ ...empresa, numero: e.target.value })}
                        placeholder="Nº ou S/N"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Bairro
                      </label>
                      <input
                        type="text"
                        value={empresa.bairro}
                        onChange={(e) => setEmpresa({ ...empresa, bairro: e.target.value })}
                        placeholder="Bairro"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Cidade
                      </label>
                      <input
                        type="text"
                        value={empresa.cidade}
                        onChange={(e) => setEmpresa({ ...empresa, cidade: e.target.value })}
                        placeholder="Cidade"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        UF
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        value={empresa.uf}
                        onChange={(e) => setEmpresa({ ...empresa, uf: e.target.value.toUpperCase() })}
                        placeholder="UF"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 text-center font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        CEP
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          maxLength={9}
                          value={empresa.cep}
                          onChange={(e) => {
                            const formatted = formatarCep(e.target.value);
                            setEmpresa({ ...empresa, cep: formatted });
                            handleConsultarCep(formatted);
                          }}
                          placeholder="00000-000"
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                        />
                        {buscandoCep && (
                          <span className="absolute right-3 top-2.5 text-[#1a237e] animate-spin">
                            <Loader2 className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      {erroCep && <p role="status" className="mt-1 text-xs text-rose-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{erroCep}</p>}
                      <p className="mt-1 text-[10px] text-slate-500">Consulta ao ViaCEP. Confira o endereço retornado antes de salvar.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 👤 RESPONSÁVEL LEGAL */}
              <div>
                <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
                  <User className="w-4 h-4 text-[#1a237e]" />
                  <h3 className="text-sm font-bold text-[#1a237e]">
                    Responsável Legal (Opcional)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      value={empresa.responsavelLegal}
                      onChange={(e) => setEmpresa({ ...empresa, responsavelLegal: e.target.value })}
                      placeholder="Nome do sócio / administrador"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      CPF
                    </label>
                    <input
                      type="text"
                      maxLength={14}
                      value={empresa.cpfResponsavel}
                      onChange={(e) => setEmpresa({ ...empresa, cpfResponsavel: formatarCpf(e.target.value) })}
                      placeholder="000.000.000-00"
                      className="w-full px-4 py-2 font-mono bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 🔐 ESPAÇO DO CERTIFICADO DIGITAL NO CADASTRO DO CLIENTE */}
        <div 
          id="espaco-certificado-digital"
          className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-indigo-200 shadow-sm space-y-5 transition-all"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-indigo-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                <KeyRound className="w-5 h-5 text-indigo-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[#1a237e]">
                    🔐 Espaço do Certificado Digital do Cliente
                  </h2>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    ICP-Brasil
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Registre os dados de referência do certificado. Consultas ao SERPRO, DCTFWeb, e-CAC e procurações ainda não estão conectadas.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 select-none">
              <input 
                type="checkbox"
                checked={temCertificado}
                onChange={(e) => setTemCertificado(e.target.checked)}
                className="w-4 h-4 text-[#1a237e] rounded focus:ring-[#1a237e]"
              />
              <span>Vincular Certificado ao Cliente</span>
            </label>
          </div>

          {temCertificado ? (
            <div className="space-y-5 animate-in fade-in">
              {/* Seleção do Tipo de Certificado: A1 vs A3 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Tipo de Certificado Digital *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCertTipo('A1')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      certTipo === 'A1'
                        ? 'bg-blue-50/70 border-blue-600 text-blue-900 ring-2 ring-blue-600/30 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FileKey className={`w-5 h-5 shrink-0 mt-0.5 ${certTipo === 'A1' ? 'text-blue-700' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-sm font-bold flex items-center justify-between">
                        <span>Certificado A1 (Arquivo .PFX / .P12)</span>
                        {certTipo === 'A1' && <Check className="w-4 h-4 text-blue-700" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Referência de arquivo A1. Esta tela não instala, lê ou envia o certificado; automatização e consultas oficiais não estão conectadas.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCertTipo('A3')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      certTipo === 'A3'
                        ? 'bg-indigo-50/70 border-indigo-600 text-indigo-900 ring-2 ring-indigo-600/30 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <HardDrive className={`w-5 h-5 shrink-0 mt-0.5 ${certTipo === 'A3' ? 'text-indigo-700' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-sm font-bold flex items-center justify-between">
                        <span>Certificado A3 (Token USB / Cartão)</span>
                        {certTipo === 'A3' && <Check className="w-4 h-4 text-indigo-700" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        O token não é acessado por esta aplicação. Não informe o PIN.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Upload de Arquivo A1 ou Instrução A3 */}
              {certTipo === 'A1' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nome do arquivo do certificado (.pfx ou .p12) — não será enviado
                  </label>
                  <div className="relative border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 rounded-2xl p-5 text-center transition-colors">
                    <input
                      type="file"
                      accept=".pfx,.p12"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCertNomeArquivo(file.name);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                    {certNomeArquivo ? (
                      <div>
                        <span className="text-sm font-bold text-indigo-900 flex items-center justify-center gap-1.5">
                          <FileText className="w-4 h-4 text-indigo-600" />
                          {certNomeArquivo}
                        </span>
                        <p className="text-xs text-slate-500 mt-1">
                          Somente o nome foi selecionado; o conteúdo não foi carregado.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          Clique aqui para selecionar o arquivo .PFX ou .P12
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Selecione para registrar o nome. O arquivo não é lido nem transmitido.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl text-xs text-indigo-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-700" />
                    Referência do Token USB / Smartcard A3
                  </p>
                  <p className="text-slate-600">
                    O sistema ainda não acessa o token nem se conecta à Receita Federal. Não informe o PIN nesta tela.
                  </p>
                </div>
              )}

              {/* Datas e emissor informados pelo usuário */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Data de Validade
                  </label>
                  <input
                    type="date"
                    value={certValidade}
                    onChange={(e) => setCertValidade(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Data declarada pelo usuário; não validada pelo sistema.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Autoridade Certificadora
                  </label>
                  <input
                    type="text"
                    value={certEmissor}
                    onChange={(e) => setCertEmissor(e.target.value)}
                    placeholder="Ex: SERPRO, RFB, Certisign, Soluti"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Informação declarada pelo usuário; não validada pelo sistema.
                  </p>
                </div>
              </div>

              <div role="note" className="pt-2 flex items-start gap-3 bg-amber-50 p-4 rounded-2xl border border-amber-200 text-amber-950">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold block">Certificado e consulta oficial não validados</span>
                  <span className="text-[11px]">Este ambiente não envia o certificado nem testa acesso à Receita/SERPRO. A validade informada é apenas uma referência local.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500 text-center">
              Certificado digital opcional não vinculado no momento. Você poderá cadastrá-lo a qualquer instante no cadastro do cliente ou na tela de empresas.
            </div>
          )}

          {/* Rodapé informativo de conformidade */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
            <Lock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>
              <strong>Referência local:</strong> o arquivo e a senha não são enviados nem armazenados aqui. O nome, emissor e vencimento não provam validade; integração oficial ainda não configurada.
            </span>
          </div>
        </div>

        {/* 💾 BOTÃO SALVAR + LIMPAR */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            id="botaoSalvarEmpresa"
            type="submit"
            disabled={carregando}
            className="flex-1 w-full py-4 px-6 rounded-2xl bg-[#1a237e] hover:bg-[#283593] text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {carregando ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{isEdicao ? 'Salvando Alterações...' : 'Salvando Empresa...'}</span>
              </>
            ) : (
              <span>{isEdicao ? '💾 Salvar Alterações da Empresa' : '✅ Salvar Empresa'}</span>
            )}
          </button>

          <button
            type="button"
            onClick={handleLimparTudo}
            className="py-4 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm border border-slate-300 transition-colors cursor-pointer flex items-center justify-center gap-2 shrink-0"
            title="Limpar todos os campos e reiniciar"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Limpar Formulário</span>
          </button>
        </div>
      </form>
    </div>
  );
}
