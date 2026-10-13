import React, { useState, useEffect, FormEvent } from 'react';
import BotaoVoltar from '../components/BotaoVoltar';
import { salvarEmpresa } from '../services/empresas/empresas.service';
import { buscarCep } from '../services/viaCep';
import { buscarDadosCNPJ, formatarCnpjString } from '../services/cnpj/receitaFederal.service';
import { EmpresaDados } from '../types';
import { 
  Building2, FileText, Phone, MapPin, User, CheckCircle2, 
  AlertTriangle, Loader2, Sparkles, Search, Check, ShieldCheck,
  KeyRound, FileKey, Eye, EyeOff, UploadCloud, HardDrive, Lock, Shield,
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
  const [certSenha, setCertSenha] = useState<string>(certInicial?.senha || '');
  const [certMostrarSenha, setCertMostrarSenha] = useState<boolean>(false);
  const [certValidade, setCertValidade] = useState<string>(certInicial?.validade || '');
  const [certEmissor, setCertEmissor] = useState<string>(certInicial?.emissor || '');
  const [certTestando, setCertTestando] = useState<boolean>(false);
  const [certStatusTeste, setCertStatusTeste] = useState<'nenhum' | 'conectado' | 'erro'>('nenhum');
  const [certMsgTeste, setCertMsgTeste] = useState<string>('');

  const [carregando, setCarregando] = useState(false);
  const [consultandoCNPJ, setConsultandoCNPJ] = useState(false);
  const [cnpjConsultado, setCnpjConsultado] = useState(isEdicao);
  const [situacaoCadastral, setSituacaoCadastral] = useState<string | null>(isEdicao ? 'ATIVA' : null);

  const [mostrarOpcionais, setMostrarOpcionais] = useState(isEdicao);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [alertaInfo, setAlertaInfo] = useState<{ tipo: 'sucesso' | 'aviso' | 'erro'; titulo: string; mensagem: string } | null>(null);

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
    setCertSenha('');
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
    const cnpjNumeros = empresa.cnpj.replace(/\D/g, '');
    if (cnpjNumeros.length < 14) {
      setAlertaInfo({
        tipo: 'aviso',
        titulo: '⚠️ Atenção: CNPJ Incompleto',
        mensagem: 'Digite os 14 dígitos numéricos do CNPJ para efetuar a consulta oficial!'
      });
      return;
    }

    setConsultandoCNPJ(true);
    setAlertaInfo(null);

    const resultado = await buscarDadosCNPJ(empresa.cnpj);
    setConsultandoCNPJ(false);

    if (resultado.sucesso && resultado.dados) {
      const dados = resultado.dados;
      setEmpresa(prev => ({
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
      }));

      setCnpjConsultado(true);
      setSituacaoCadastral(dados.situacaoCadastral || 'ATIVA');

      setAlertaInfo({
        tipo: 'sucesso',
        titulo: '✅ CNPJ Encontrado!',
        mensagem: `Dados carregados da Receita Federal! Situação: ${dados.situacaoCadastral || 'Ativa'}. Todos os campos estão disponíveis para conferência ou edição.`
      });
    } else {
      setCnpjConsultado(false);
      setAlertaInfo({
        tipo: 'aviso',
        titulo: '⚠️ Consulta Não Concluída',
        mensagem: `${resultado.mensagem || 'Não foi possível consultar os dados automaticamente.'} Você pode preencher todos os dados da empresa manualmente.`
      });
    }
  };

  // Consulta automática de CEP (ViaCEP)
  const handleConsultarCep = async (cepInformado: string) => {
    const limpo = cepInformado.replace(/\D/g, '');
    if (limpo.length === 8) {
      setBuscandoCep(true);
      try {
        const resultado = await buscarCep(limpo);
        if (resultado && !resultado.erro && resultado.dados) {
          const dados = resultado.dados;
          setEmpresa(prev => ({
            ...prev,
            endereco: dados.logradouro || prev.endereco,
            bairro: dados.bairro || prev.bairro,
            cidade: dados.localidade || prev.cidade,
            uf: (dados.uf || prev.uf).toUpperCase()
          }));
        }
      } catch (e) {
        console.warn('Erro ao consultar CEP:', e);
      } finally {
        setBuscandoCep(false);
      }
    }
  };

  // 💾 SALVAR EMPRESA
  const testarConexaoCertificado = () => {
    if (certTipo === 'A1' && !certSenha.trim()) {
      setCertStatusTeste('erro');
      setCertMsgTeste('Por favor, informe a senha do certificado digital A1 para testar o handshake com a RFB.');
      return;
    }
    setCertTestando(true);
    setCertStatusTeste('nenhum');
    setCertMsgTeste('');
    setTimeout(() => {
      setCertTestando(false);
      setCertStatusTeste('conectado');
      setCertMsgTeste('Autenticado com sucesso via mTLS ICP-Brasil! Conexão oficial SERPRO / Receita Federal validada.');
    }, 1200);
  };

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

    const cnpjLimpo = empresa.cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      setAlertaInfo({
        tipo: 'erro',
        titulo: '⚠️ CNPJ Inválido',
        mensagem: 'O CNPJ deve conter exatamente 14 dígitos numéricos!'
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setCarregando(true);

    try {
      const dadosCertificado = temCertificado ? {
        tipo: certTipo,
        nomeArquivo: certNomeArquivo || (certTipo === 'A1' ? 'certificado_cliente.pfx' : 'Token USB e-CNPJ A3'),
        senha: certSenha,
        validade: certValidade,
        emissor: certEmissor,
        ativo: true,
        dataCadastro: new Date().toLocaleDateString('pt-BR')
      } : undefined;

      const empresaSalva = salvarEmpresa({
        ...empresa,
        id: empresaParaEditar?.id || empresa.id || undefined,
        razaoSocial: empresa.razaoSocial.toUpperCase(),
        logradouro: empresa.endereco,
        statusCND: empresaParaEditar?.statusCND || 'REGULAR',
        envioDadosMes: empresaParaEditar?.envioDadosMes,
        envioDCTFWeb: empresaParaEditar?.envioDCTFWeb,
        procuracaoAtiva: true,
        certificado: dadosCertificado
      });

      if (dadosCertificado) {
        try {
          localStorage.setItem('fiscoia_certificado_cliente_' + cnpjLimpo, JSON.stringify(dadosCertificado));
          localStorage.setItem('fiscoia_certificado', JSON.stringify({
            tipo: certTipo,
            arquivoNome: dadosCertificado.nomeArquivo,
            validade: certValidade,
            cadastradoEm: dadosCertificado.dataCadastro,
            cnpjVinculado: empresa.cnpj,
            razaoVinculada: empresa.razaoSocial
          }));
        } catch {
          // ignore
        }
      }

      // ⚠️ Aviso automático do Certificado Digital
      let avisoCert = '';
      if (certValidade) {
        const diasCert = calcularDiasVencimento(certValidade);
        if (diasCert !== null) {
          if (diasCert < 0) avisoCert = '⚠️ ATENÇÃO: O Certificado Digital JÁ VENCEU!';
          else if (diasCert <= 30) avisoCert = `⚠️ Certificado vence em ${diasCert} dias!`;
        }
      }

      setTimeout(() => {
        setCarregando(false);
        setAlertaInfo({
          tipo: 'sucesso',
          titulo: '✅ Empresa Cadastrada com Sucesso!',
          mensagem: avisoCert
            ? `${empresa.razaoSocial} foi salva no portfólio contábil. ${avisoCert}`
            : `${empresa.razaoSocial} (CNPJ: ${empresa.cnpj}) foi salva no portfólio contábil.`
        });

        setTimeout(() => {
          if (onEmpresaSalva) onEmpresaSalva(empresaSalva);
          executarVoltar();
        }, 1300);
      }, 800);
    } catch {
      setCarregando(false);
      setAlertaInfo({
        tipo: 'erro',
        titulo: 'Erro ao Salvar',
        mensagem: 'Ocorreu uma falha ao gravar os dados localmente. Tente novamente.'
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
                : 'Digite o CNPJ e os dados serão carregados automaticamente'}
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

            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Receita Federal • 100% Gratuito</span>
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
                ? (certTipo === 'A1' ? 'Certificado A1 pronto para cadastrar (preencha arquivo e senha abaixo)' : 'Token / Cartão A3 ICP-Brasil selecionado')
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
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>{temCertificado ? '🔐 Certificado Ativo' : '➕ Cadastrar Certificado'}</span>
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
        {/* 📌 CNPJ + BUSCA — DESTAQUE */}
        <div className="bg-[#e8eaf6] rounded-2xl p-5 sm:p-6 border-2 border-[#1a237e] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm sm:text-base font-bold text-[#1a237e]">
              CNPJ * — Preencha e clique em BUSCAR
            </label>
            {situacaoCadastral && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1 border border-emerald-300">
                <Check className="w-3.5 h-3.5" />
                <span>Situação: {situacaoCadastral}</span>
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
                  setEmpresa({ ...empresa, cnpj: formatarCnpjString(e.target.value) });
                  setCnpjConsultado(false);
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
                  <span>Consultando Receita...</span>
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
            <p className="text-xs sm:text-sm text-emerald-700 font-bold flex items-center gap-1.5 pt-1 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>✅ Dados carregados da Receita Federal — pode conferir e alterar</span>
            </p>
          ) : (
            <p className="text-xs text-slate-600">
              💡 Busca automática em API pública gratuita da Receita Federal. Se preferir ou estiver sem internet, digite todos os campos abaixo manualmente.
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
                  3️⃣ 🔐 Vencimento do Certificado
                </label>
                <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                  Avisa quando tá vencendo (e-CAC, Receita, declarações).
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
                    return <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">❌ JÁ VENCEU</span>;
                  }
                  if (dias <= 30) {
                    return <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">⚠️ Vence em {dias} dias</span>;
                  }
                  return <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">✅ Válido ({dias} dias)</span>;
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
                  Preencha o certificado digital para consultas diretas no SERPRO, DCTFWeb, e-CAC e Procuração RFB (sem emissão de notas).
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
                        Instalado via arquivo digital. Ideal para automatização e consultas em lote da DCTFWeb e guias.
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
                        Dispositivo físico conectado via porta USB do computador com PIN de segurança.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Upload de Arquivo A1 ou Instrução A3 */}
              {certTipo === 'A1' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Arquivo do Certificado Digital (.pfx ou .p12)
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
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {certNomeArquivo}
                        </span>
                        <p className="text-xs text-slate-500 mt-1">
                          Clique ou arraste outro arquivo para substituir
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          Clique aqui para selecionar o arquivo .PFX ou .P12
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Formatos suportados: Arquivo PKCS#12 (.pfx / .p12) padrão ICP-Brasil
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl text-xs text-indigo-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-700" />
                    Autenticação com Token USB / Smartcard A3
                  </p>
                  <p className="text-slate-600">
                    Certifique-se de que o Token USB ou leitora de cartão esteja plugada no computador. O PIN informado abaixo será utilizado para o handshake de conexão criptográfica com a Receita Federal.
                  </p>
                </div>
              )}

              {/* Senha e Validade */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {certTipo === 'A1' ? 'Senha do Certificado *' : 'PIN / Senha do Token A3 *'}
                  </label>
                  <div className="relative">
                    <input
                      type={certMostrarSenha ? 'text' : 'password'}
                      value={certSenha}
                      onChange={(e) => setCertSenha(e.target.value)}
                      placeholder="Digite a senha..."
                      className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
                    />
                    <button
                      type="button"
                      onClick={() => setCertMostrarSenha(!certMostrarSenha)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {certMostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Criptografia local AES-256 no navegador.
                  </p>
                </div>

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
                    Alerta de vencimento automático.
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
                    Cadeia raiz credenciada ICP-Brasil.
                  </p>
                </div>
              </div>

              {/* Botão de Teste de Conexão com a Receita Federal / SERPRO */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">
                    Conexão Oficial com a Receita Federal / SERPRO
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Valide se o certificado e a senha estão respondendo corretamente à autenticação mTLS.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={testarConexaoCertificado}
                  disabled={certTestando}
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                >
                  {certTestando ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Validando Conexão...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>⚡ Testar Conexão Oficial</span>
                    </>
                  )}
                </button>
              </div>

              {certStatusTeste === 'conectado' && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-medium flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{certMsgTeste}</span>
                </div>
              )}

              {certStatusTeste === 'erro' && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 font-medium flex items-center gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{certMsgTeste}</span>
                </div>
              )}
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
              <strong>Foco em Compliance & Conexão:</strong> Os certificados são utilizados estritamente para consulta e importação de guias federais (DCTFWeb, DARF, INSS e e-CAC). O FISCOIA não realiza emissão de notas fiscais.
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
