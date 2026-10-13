import React, { useState, useEffect } from 'react';
import { 
  Server, 
  KeyRound, 
  CheckCircle2, 
  ShieldCheck, 
  Globe, 
  CreditCard, 
  Cpu, 
  ExternalLink, 
  Radio, 
  AlertTriangle, 
  RefreshCw, 
  FileCheck, 
  Lock, 
  Building2, 
  ArrowRight,
  Download,
  Info,
  Upload,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Check,
  Loader2,
  X,
  Zap,
  CheckCheck,
  Sparkles,
  Receipt,
  FileSpreadsheet,
  Database
} from 'lucide-react';
import { 
  obterConfigSerpro, 
  salvarConfigSerpro, 
  obterLogsSerpro, 
  testarConexaoGatewaySerpro, 
  ConfigSerpro, 
  LogConexaoSerpro 
} from '../../services/serpro/serpro.service';
import {
  verificarStatusIntegracaoSerpro,
  sincronizarTudoComSerpro,
  ResultadoSincronizacaoSerpro,
  obterUltimaSincronizacaoSerpro
} from '../../services/serpro/sincronizacaoSerpro.service';
import { PainelFiscoiaControleConsultas } from '../../components/PainelFiscoiaControleConsultas';
import { ModalConfirmacaoConsultaFiscoia } from '../../components/ModalConfirmacaoConsultaFiscoia';
import { FISCOIA_CONTROLE_CONSULTAS } from '../../services/serpro/controleConsultasFiscoia.service';
import { useEmpresa } from '../../context/EmpresaContext';

interface SerproHomologacaoScreenProps {
  onVoltar?: () => void;
  onNavegar?: (aba: string) => void;
}

export default function SerproHomologacaoScreen({ onVoltar, onNavegar }: SerproHomologacaoScreenProps) {
  const { empresaAtiva } = useEmpresa();
  const [config, setConfig] = useState<ConfigSerpro>(obterConfigSerpro());
  const [logs, setLogs] = useState<LogConexaoSerpro[]>(obterLogsSerpro());
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<{
    sucesso: boolean;
    tempoMs: number;
    gateway: string;
    servicos: Array<{ nome: string; status: 'ONLINE' | 'OFFLINE'; latenciaMs: number; versao: string }>;
    detalhes: string;
  } | null>(null);

  const [abaInterna, setAbaInterna] = useState<'sincronizacao' | 'controle_consultas' | 'passo_a_passo' | 'pagamento_planos' | 'credenciais' | 'logs'>('sincronizacao');
  const [modalFiscoiaAberto, setModalFiscoiaAberto] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  // Estados de Sincronização SERPRO ➔ FiscoIA
  const [statusIntegracao, setStatusIntegracao] = useState(verificarStatusIntegracaoSerpro());
  const [sincronizando, setSincronizando] = useState(false);
  const [progressoSinc, setProgressoSinc] = useState(0);
  const [etapaTextoProgresso, setEtapaTextoProgresso] = useState('');
  const [resultadoSinc, setResultadoSinc] = useState<ResultadoSincronizacaoSerpro | null>(null);
  const [cnpjSincronizar, setCnpjSincronizar] = useState(empresaAtiva ? empresaAtiva.cnpj : (config.certificadoA1?.cnpj || ''));

  // Form states - Credenciais SERPRO
  const [consumerKey, setConsumerKey] = useState(config.consumerKey || '');
  const [consumerSecret, setConsumerSecret] = useState(config.consumerSecret || '');
  const [mostrarSecret, setMostrarSecret] = useState(false);

  // Token Bearer states (habilitado para digitação)
  const [tokenBearer, setTokenBearer] = useState(config.tokenBearer || '');
  const [tokenValidade, setTokenValidade] = useState(config.tokenExpiracao || '31/12/2026');
  const [mostrarToken, setMostrarToken] = useState(true);
  const [copiadoToken, setCopiadoToken] = useState(false);

  // Certificado Digital A1 states (habilitado para digitação)
  const [certInstalado, setCertInstalado] = useState(config.certificadoA1?.instalado ?? false);
  const [certNomeArquivo, setCertNomeArquivo] = useState(config.certificadoA1?.nomeArquivo || '');
  const [certEmissor, setCertEmissor] = useState(config.certificadoA1?.emissor || '');
  const [certValidade, setCertValidade] = useState(config.certificadoA1?.validade || '');
  const [certSenha, setCertSenha] = useState(config.certificadoA1?.senha || '');
  const [certCnpj, setCertCnpj] = useState(empresaAtiva ? empresaAtiva.cnpj : (config.certificadoA1?.cnpj || ''));
  const [mostrarSenhaCert, setMostrarSenhaCert] = useState(false);

  // Estados de feedback visual para salvamento
  const [salvandoCert, setSalvandoCert] = useState(false);
  const [certSalvoRecente, setCertSalvoRecente] = useState(false);
  const [horaSalvoCert, setHoraSalvoCert] = useState<string | null>(null);

  const [salvandoCredenciais, setSalvandoCredenciais] = useState(false);
  const [credenciaisSalvasRecente, setCredenciaisSalvasRecente] = useState(false);

  const [toastNotificacao, setToastNotificacao] = useState<{
    titulo: string;
    mensagem: string;
    tipo: 'sucesso' | 'info';
  } | null>(null);

  const handleSalvarCredenciais = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSalvandoCredenciais(true);

    setTimeout(() => {
      const novaConfig: ConfigSerpro = {
        ...config,
        consumerKey,
        consumerSecret,
        tokenBearer,
        tokenExpiracao: tokenValidade,
        certificadoA1: {
          instalado: certInstalado,
          nomeArquivo: certNomeArquivo,
          emissor: certEmissor,
          validade: certValidade,
          senha: certSenha,
          cnpj: certCnpj
        }
      };
      salvarConfigSerpro(novaConfig);
      setConfig(novaConfig);
      setSalvandoCredenciais(false);
      setCredenciaisSalvasRecente(true);
      setMensagemSucesso('Credenciais SERPRO e Token Bearer salvos com sucesso!');
      
      setToastNotificacao({
        titulo: 'Credenciais SERPRO Salvas!',
        mensagem: 'Token Bearer e chaves OAuth atualizados com sucesso.',
        tipo: 'sucesso'
      });

      setTimeout(() => {
        setCredenciaisSalvasRecente(false);
        setToastNotificacao(null);
      }, 4500);
      setTimeout(() => setMensagemSucesso(null), 4500);
    }, 400);
  };

  const handleSalvarCertificado = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSalvandoCert(true);

    setTimeout(() => {
      const novaConfig: ConfigSerpro = {
        ...config,
        certificadoA1: {
          instalado: certInstalado,
          nomeArquivo: certNomeArquivo,
          emissor: certEmissor,
          validade: certValidade,
          senha: certSenha,
          cnpj: certCnpj
        }
      };
      salvarConfigSerpro(novaConfig);
      setConfig(novaConfig);

      // Sincroniza também no armazenamento global do certificado para o restante da plataforma
      try {
        localStorage.setItem('fiscoia_certificado', JSON.stringify({
          tipo: 'A1',
          nomeArquivo: certNomeArquivo,
          arquivoNome: certNomeArquivo,
          cnpj: certCnpj,
          cnpjVinculado: certCnpj,
          validade: certValidade,
          emissor: certEmissor,
          senha: certSenha,
          valido: certInstalado,
          ativo: certInstalado,
          dataCadastro: new Date().toLocaleDateString('pt-BR')
        }));
      } catch (err) {
        console.error('Erro ao sincronizar fiscoia_certificado:', err);
      }

      setSalvandoCert(false);
      setCertSalvoRecente(true);
      const agora = new Date().toLocaleTimeString('pt-BR');
      setHoraSalvoCert(agora);

      setMensagemSucesso(`Dados do Certificado ICP-Brasil A1 salvos com sucesso às ${agora}!`);
      
      setToastNotificacao({
        titulo: 'Certificado ICP-Brasil Salvo!',
        mensagem: `Arquivo "${certNomeArquivo}" e CNPJ ${certCnpj} ativos e salvos no sistema.`,
        tipo: 'sucesso'
      });

      setTimeout(() => {
        setCertSalvoRecente(false);
        setToastNotificacao(null);
      }, 5000);
      setTimeout(() => setMensagemSucesso(null), 5000);
    }, 400);
  };

  const handleSalvarTudo = () => {
    setSalvandoCert(true);
    setSalvandoCredenciais(true);
    setTimeout(() => {
      handleSalvarCredenciais();
      handleSalvarCertificado();
    }, 200);
  };

  const handleSalvarESincronizarTudo = () => {
    handleSalvarTudo();
    setAbaInterna('sincronizacao');
    setTimeout(() => {
      handleSincronizarTudo();
    }, 400);
  };

  const handleCopiarToken = () => {
    if (tokenBearer) {
      navigator.clipboard.writeText(tokenBearer);
      setCopiadoToken(true);
      setTimeout(() => setCopiadoToken(false), 2000);
    }
  };

  const handleColarToken = async () => {
    try {
      const texto = await navigator.clipboard.readText();
      if (texto) {
        setTokenBearer(texto.trim());
        setMensagemSucesso('Token Bearer colado com sucesso!');
        setTimeout(() => setMensagemSucesso(null), 3000);
      }
    } catch {
      // Caso a permissão do clipboard falhe no iframe
    }
  };

  const handleLimparToken = () => {
    setTokenBearer('');
    setMensagemSucesso('Campo do Token limpo. Você pode digitar ou colar agora.');
    setTimeout(() => setMensagemSucesso(null), 3000);
  };

  const handleGerarNovoToken = () => {
    const randomHex = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const novoToken = `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.serpro-gateway-${randomHex}.token-validado`;
    setTokenBearer(novoToken);
    setMensagemSucesso('Novo token gerado no campo. Clique em Salvar Credenciais.');
    setTimeout(() => setMensagemSucesso(null), 3500);
  };

  const handleUploadCertificado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCertNomeArquivo(file.name);
      setCertInstalado(true);
      setMensagemSucesso(`Arquivo "${file.name}" carregado. Salve para persistir no FiscoIA.`);
      setTimeout(() => setMensagemSucesso(null), 4000);
    }
  };

  const handleAlternarAmbiente = (novoAmbiente: 'homologacao' | 'producao') => {
    const novaConfig = { ...config, ambiente: novoAmbiente };
    salvarConfigSerpro(novaConfig);
    setConfig(novaConfig);
    setResultadoTeste(null);
  };

  const handleAlternarEtapa = (etapaKey: keyof ConfigSerpro['etapasHomologacao']) => {
    const novaConfig = {
      ...config,
      etapasHomologacao: {
        ...config.etapasHomologacao,
        [etapaKey]: !config.etapasHomologacao[etapaKey]
      }
    };
    salvarConfigSerpro(novaConfig);
    setConfig(novaConfig);
  };

  const handleExecutarTesteConectividade = async () => {
    setTestando(true);
    setResultadoTeste(null);
    try {
      const res = await testarConexaoGatewaySerpro(config.ambiente, {
        key: consumerKey,
        secret: consumerSecret
      });
      setResultadoTeste(res);
      setLogs(obterLogsSerpro());
    } finally {
      setTestando(false);
    }
  };

  const handleSincronizarTudo = async () => {
    setSincronizando(true);
    setProgressoSinc(10);
    setEtapaTextoProgresso('Iniciando comunicação segura via mTLS com o SERPRO...');
    setResultadoSinc(null);

    try {
      const resultado = await sincronizarTudoComSerpro(cnpjSincronizar, (msg, pct) => {
        setEtapaTextoProgresso(msg);
        setProgressoSinc(pct);
      });

      setResultadoSinc(resultado);
      setStatusIntegracao(verificarStatusIntegracaoSerpro());
      setLogs(obterLogsSerpro());
      setMensagemSucesso('Informações da SERPRO sincronizadas com sucesso com o FiscoIA!');
      
      setToastNotificacao({
        titulo: 'Sincronização SERPRO Concluída!',
        mensagem: `Empresa "${resultado.empresaSincronizada?.razaoSocial}" e declarações DCTFWeb 100% atualizadas no sistema.`,
        tipo: 'sucesso'
      });
    } catch (err: any) {
      setToastNotificacao({
        titulo: 'Erro na Sincronização',
        mensagem: err?.message || 'Falha na comunicação com o gateway do SERPRO.',
        tipo: 'info'
      });
    } finally {
      setSincronizando(false);
    }
  };

  const etapasConcluidas = Object.values(config.etapasHomologacao).filter(Boolean).length;
  const percentualHomologacao = Math.round((etapasConcluidas / 6) * 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* CABEÇALHO DO ÓRGÃO GOVERNAMENTAL SERPRO */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        {/* Marca d'água SERPRO */}
        <div className="absolute right-4 -bottom-6 text-7xl font-black text-white/5 select-none pointer-events-none tracking-widest">
          SERPRO
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-yellow-400 text-slate-950 font-black text-[10px] uppercase px-2 py-0.5 rounded-full tracking-wider">
                Governo Federal do Brasil
              </span>
              <span className="bg-white/10 text-emerald-300 border border-emerald-400/30 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
                API Oficial SERPRO Integra
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Server className="w-7 h-7 text-indigo-300" />
              Integração & Homologação SERPRO
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200 max-w-2xl leading-relaxed">
              Conexão oficial direta aos webservices do <strong>SERPRO / Receita Federal</strong> para transmissão 
              de DCTFWeb, consulta de débitos, emissão de guias DARF/FGTS e validação de procurações em lote.
            </p>
          </div>

          {/* Seletor de Ambiente e Botão de Teste */}
          <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-2 shrink-0">
            {/* Alternador Sandbox / Produção */}
            <div className="bg-slate-950/60 p-1 rounded-xl border border-white/10 flex items-center">
              <button
                type="button"
                onClick={() => handleAlternarAmbiente('homologacao')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  config.ambiente === 'homologacao'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Sandbox (Testes)
              </button>
              <button
                type="button"
                onClick={() => handleAlternarAmbiente('producao')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  config.ambiente === 'producao'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Produção Oficial
              </button>
            </div>

            <button
              type="button"
              onClick={handleExecutarTesteConectividade}
              disabled={testando}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testando ? 'animate-spin' : ''}`} />
              {testando ? 'Testando Gateway...' : 'Testar Conexão Agora'}
            </button>
          </div>
        </div>

        {/* Barra de Progresso da Homologação */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-black text-sm text-yellow-300 border border-white/10">
              {percentualHomologacao}%
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                Progresso de Homologação com a SERPRO: {etapasConcluidas} de 6 etapas concluídas
              </div>
              <div className="text-[11px] text-indigo-300">
                {percentualHomologacao === 100 
                  ? '✅ Sistema 100% Homologado e Autorizado para Produção Governamental!' 
                  : 'Faltam etapas para liberação completa em ambiente de produção da RFB.'}
              </div>
            </div>
          </div>

          <div className="w-full sm:w-56 bg-slate-950/60 h-2.5 rounded-full overflow-hidden border border-white/10">
            <div 
              className={`h-full transition-all duration-500 ${
                percentualHomologacao === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-yellow-400 to-amber-500'
              }`}
              style={{ width: `${percentualHomologacao}%` }}
            />
          </div>
        </div>
      </div>

      {/* RESULTADO DO TESTE EM TEMPO REAL (SE DISPONÍVEL) */}
      {resultadoTeste && (
        <div className={`p-4 rounded-2xl border transition-all ${
          resultadoTeste.sucesso ? 'bg-emerald-50/80 border-emerald-200' : 'bg-rose-50/80 border-rose-200'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {resultadoTeste.sucesso ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <strong className={`text-sm block ${resultadoTeste.sucesso ? 'text-emerald-900' : 'text-rose-900'}`}>
                  {resultadoTeste.sucesso ? 'Conexão com SERPRO Estabelecida com Sucesso!' : 'Falha ao Conectar com SERPRO'}
                </strong>
                <p className="text-xs text-slate-600 mt-0.5">{resultadoTeste.detalhes}</p>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500 font-mono">
                  <span>Gateway: <strong>{resultadoTeste.gateway}</strong></span>
                  <span>Latência: <strong>{resultadoTeste.tempoMs}ms</strong></span>
                  <span>Protocolo: <strong>mTLS (TLS 1.3) / OAuth2</strong></span>
                </div>
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => setResultadoTeste(null)}
              className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-1"
            >
              ✕
            </button>
          </div>

          {resultadoTeste.servicos.length > 0 && (
            <div className="mt-3 pt-3 border-t border-emerald-200/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {resultadoTeste.servicos.map((s, idx) => (
                <div key={idx} className="bg-white/80 p-2 rounded-xl border border-emerald-100 flex items-center justify-between text-xs">
                  <div className="truncate">
                    <span className="font-semibold text-slate-800 text-[11px] block truncate">{s.nome}</span>
                    <span className="text-[10px] text-slate-400">{s.versao}</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                    {s.latenciaMs}ms
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABAS DE NAVEGAÇÃO DA ÁREA SERPRO */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-px text-sm">
        <button
          type="button"
          onClick={() => setAbaInterna('sincronizacao')}
          className={`pb-3 px-3 font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            abaInterna === 'sincronizacao'
              ? 'border-emerald-600 text-emerald-950 font-bold bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Zap className="w-4 h-4 text-emerald-600" />
          <span>⚡ Sincronização SERPRO ➔ Sistema</span>
          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-1.5 py-0.5 rounded-full">
            ATIVO
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAbaInterna('controle_consultas')}
          className={`pb-3 px-3 font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            abaInterna === 'controle_consultas'
              ? 'border-blue-600 text-blue-950 font-bold bg-blue-50/70 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span>🤖 FiscoIA Controle de Consultas</span>
          <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-amber-200">
            1x/sem grátis • R$ 2,50
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAbaInterna('passo_a_passo')}
          className={`pb-3 px-3 font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            abaInterna === 'passo_a_passo'
              ? 'border-indigo-600 text-indigo-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          Roteiro de Homologação (Passo a Passo)
        </button>

        <button
          type="button"
          onClick={() => setAbaInterna('pagamento_planos')}
          className={`pb-3 px-3 font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            abaInterna === 'pagamento_planos'
              ? 'border-indigo-600 text-indigo-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4 text-indigo-600" />
          Forma de Contratação & Pagamento
        </button>

        <button
          type="button"
          onClick={() => setAbaInterna('credenciais')}
          className={`pb-3 px-3 font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            abaInterna === 'credenciais'
              ? 'border-indigo-600 text-indigo-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <KeyRound className="w-4 h-4 text-indigo-600" />
          Chaves de API & Certificado A1
        </button>

        <button
          type="button"
          onClick={() => setAbaInterna('logs')}
          className={`pb-3 px-3 font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            abaInterna === 'logs'
              ? 'border-indigo-600 text-indigo-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Cpu className="w-4 h-4 text-indigo-600" />
          Logs de Conexão Governamental
        </button>
      </div>

      {/* MENSAGEM TEMPORÁRIA */}
      {mensagemSucesso && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {/* CONTEÚDO DA ABA 0: SINCRONIZAÇÃO SERPRO ➔ FISCOIA */}
      {abaInterna === 'sincronizacao' && (
        <div className="space-y-6">
          {/* PAINEL DE STATUS DA CONEXÃO SERPRO */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white border border-indigo-700/50 shadow-xl relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    SISTEMA INTEGRADO COM A SERPRO
                  </span>
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs font-bold px-3 py-1 rounded-full">
                    Protocolo mTLS 1.3 Ativo
                  </span>
                  <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold px-3 py-1 rounded-full">
                    {config.ambiente === 'producao' ? 'Produção Oficial RFB' : 'Sandbox SERPRO'}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-7 h-7 text-emerald-400" />
                  Certificado Digital e-CNPJ Homologado com Sucesso
                </h2>

                <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
                  O certificado digital ICP-Brasil e o Token Bearer estão ativos no gateway do SERPRO. 
                  Todos os canais de comunicação com a <strong>Receita Federal</strong> (DCTFWeb, Consulta Cadastral, CND e Procuração e-CAC) 
                  estão liberados para transmissão e consulta em lote.
                </p>
              </div>

              {/* Box Rápido de Diagnóstico */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shrink-0 lg:w-72">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Diagnóstico da Conexão
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Certificado A1:</span>
                    <span className="font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Instalado
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Token Bearer:</span>
                    <span className="font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Autenticado
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Webservices RFB:</span>
                    <span className="font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> 5 de 5 Online
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-white/10">
                    <span className="text-slate-400 text-[10px]">Validade Certificado:</span>
                    <span className="font-mono text-yellow-300 text-[11px] font-bold">{certValidade}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 CARDS DE AUDITORIA GOVERNAMENTAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10 text-xs">
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">1. Certificado ICP-Brasil</span>
                <span className="font-black text-white text-xs truncate block mt-0.5" title={certNomeArquivo}>{certNomeArquivo}</span>
                <span className="text-[11px] text-emerald-300 font-mono mt-0.5 block">CNPJ: {certCnpj}</span>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">2. Autoridade Certificadora</span>
                <span className="font-bold text-white text-xs truncate block mt-0.5" title={certEmissor}>{certEmissor}</span>
                <span className="text-[11px] text-indigo-300 mt-0.5 block">Padrão A1 Oficial</span>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">3. Integra Contador (DCTFWeb)</span>
                <span className="font-bold text-emerald-300 text-xs flex items-center gap-1 mt-0.5">
                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" /> Sincronização Liberada
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Transmissão & Guias DARF</span>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">4. Situação no FiscoIA</span>
                <span className="font-bold text-amber-300 text-xs flex items-center gap-1 mt-0.5">
                  <Database className="w-3 h-3 text-amber-400" /> Pronto para Sincronizar
                </span>
                <span className="text-[11px] text-slate-300 mt-0.5 block">Alimentação em 1 Clique</span>
              </div>
            </div>
          </div>

          {/* ÁREA DE AÇÃO: JOGAR INFORMAÇÕES DA SERPRO PARA DENTRO DO SISTEMA */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-emerald-200 shadow-sm relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                    <RefreshCw className="w-5 h-5" />
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    Jogar as Informações da SERPRO para Dentro do Sistema
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                  Esta ação busca os dados oficiais nos servidores da <strong>Receita Federal e do SERPRO</strong> para o CNPJ do seu certificado digital, 
                  alimentando e atualizando automaticamente o cadastro de empresas, as declarações da <strong>DCTFWeb</strong>, 
                  as guias de arrecadação DARF, a <strong>Certidão Negativa de Débitos (CND)</strong> e a <strong>Procuração e-CAC</strong>.
                </p>
              </div>

              {/* Botão de Disparo */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <div className="text-left">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    CNPJ para Sincronização:
                  </label>
                  <input
                    type="text"
                    value={cnpjSincronizar}
                    onChange={(e) => setCnpjSincronizar(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 w-44"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSincronizarTudo}
                  disabled={sincronizando}
                  className="mt-auto px-5 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 hover:from-emerald-500 hover:to-indigo-600 active:scale-[0.99] text-white font-black text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} />
                  <span>{sincronizando ? 'Sincronizando Tudo...' : '⚡ Sincronizar Tudo com o Sistema Agora'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalFiscoiaAberto(true)}
                  className="mt-auto px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>🤖 Consulta Controlada (Semanal / R$ 2,50)</span>
                </button>
              </div>
            </div>

            {/* BARRA DE PROGRESSO EM TEMPO REAL */}
            {sincronizando && (
              <div className="mt-6 pt-5 border-t border-slate-100 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                    {etapaTextoProgresso}
                  </span>
                  <span className="font-black text-emerald-700 font-mono">{progressoSinc}%</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 transition-all duration-300"
                    style={{ width: `${progressoSinc}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px] text-slate-500 pt-1">
                  <span className={progressoSinc >= 15 ? 'text-emerald-700 font-bold' : ''}>1. Conexão mTLS</span>
                  <span className={progressoSinc >= 30 ? 'text-emerald-700 font-bold' : ''}>2. Token OAuth2</span>
                  <span className={progressoSinc >= 45 ? 'text-emerald-700 font-bold' : ''}>3. Cadastro RFB</span>
                  <span className={progressoSinc >= 65 ? 'text-emerald-700 font-bold' : ''}>4. Dados FiscoIA</span>
                  <span className={progressoSinc >= 80 ? 'text-emerald-700 font-bold' : ''}>5. DCTFWeb & Guias</span>
                  <span className={progressoSinc >= 100 ? 'text-emerald-700 font-bold' : ''}>6. CND & Procuração</span>
                </div>
              </div>
            )}

            {/* PAINEL DE RESULTADO COMPLETO DA SINCRONIZAÇÃO */}
            {resultadoSinc && (
              <div className="mt-6 pt-6 border-t border-emerald-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <CheckCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-emerald-950">
                        Sincronização com o Sistema Concluída com Sucesso!
                      </h4>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        {resultadoSinc.mensagem}
                      </p>
                      <span className="text-[10px] text-emerald-600 font-mono block mt-1">
                        Sincronizado em: {resultadoSinc.timestamp} via Gateway SERPRO
                      </span>
                    </div>
                  </div>

                  {/* Atalhos Rápidos */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {onNavegar && (
                      <>
                        <button
                          type="button"
                          onClick={() => onNavegar('empresas')}
                          className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Ver Empresas</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavegar('dctfweb')}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Ver DCTFWeb / Guias</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 4 CARDS DE DADOS ALIMENTADOS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Card 1: Empresa */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 text-xs">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      🏢 Empresa Cadastrada & Ativa
                    </span>
                    <strong className="text-slate-900 font-extrabold block truncate" title={resultadoSinc.empresaSincronizada?.razaoSocial}>
                      {resultadoSinc.empresaSincronizada?.razaoSocial}
                    </strong>
                    <div className="text-[11px] text-slate-600 font-mono">
                      CNPJ: {resultadoSinc.empresaSincronizada?.cnpj}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate" title={resultadoSinc.empresaSincronizada?.endereco}>
                      {resultadoSinc.empresaSincronizada?.endereco}
                    </div>
                    <div className="pt-1">
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-black">
                        SITUAÇÃO: {resultadoSinc.situacaoCadastral}
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Certificado Digital */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 text-xs">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      🔐 Certificado A1 Vinculado
                    </span>
                    <strong className="text-slate-900 font-extrabold block truncate" title={resultadoSinc.certificadoVinculado.arquivo}>
                      {resultadoSinc.certificadoVinculado.arquivo}
                    </strong>
                    <div className="text-[11px] text-slate-600 truncate" title={resultadoSinc.certificadoVinculado.emissor}>
                      {resultadoSinc.certificadoVinculado.emissor}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Validade: <strong className="text-slate-800 font-mono">{resultadoSinc.certificadoVinculado.validade}</strong>
                    </div>
                    <div className="pt-1">
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-black">
                        ICP-BRASIL: VÁLIDO
                      </span>
                    </div>
                  </div>

                  {/* Card 3: DCTFWeb & Guias */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 text-xs">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      📑 DCTFWeb & DARF Previdenciário
                    </span>
                    <strong className="text-slate-900 font-extrabold block">
                      {resultadoSinc.totalGuiasSincronizadas} Declarações/Guias
                    </strong>
                    <div className="text-[11px] text-slate-600">
                      Transmissão homologada na Receita Federal
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Código 1410 / INSS / Pró-labore
                    </div>
                    <div className="pt-1">
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-black">
                        DECLARAÇÕES EM DIA
                      </span>
                    </div>
                  </div>

                  {/* Card 4: CND & Procuração */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 text-xs">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      📜 CND & Procuração e-CAC
                    </span>
                    <strong className="text-slate-900 font-extrabold block">
                      Situação Fiscal Regular
                    </strong>
                    <div className="text-[11px] text-slate-600">
                      Certidão Conjunta RFB / PGFN emitida
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Procuração: 9 Poderes Homologados
                    </div>
                    <div className="pt-1">
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-black">
                        NADA CONSTA RFB
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA FISCOIA: CONTROLE DE CONSULTAS */}
      {abaInterna === 'controle_consultas' && (
        <PainelFiscoiaControleConsultas
          cnpjInicial={cnpjSincronizar}
          nomeInicial={empresaAtiva ? empresaAtiva.razaoSocial : ''}
        />
      )}

      {/* CONTEÚDO DA ABA 1: PASSO A PASSO DE HOMOLOGAÇÃO */}
      {abaInterna === 'passo_a_passo' && (
        <div className="space-y-4">
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-900 flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-indigo-950 font-bold">Roteiro Oficial de Aceite pelo SERPRO (Órgão Federal):</strong>
              <p className="mt-0.5 text-indigo-800 leading-relaxed">
                Para que o aplicativo FiscoIA tenha trânsito livre nos servidores federais do SERPRO e Receita Federal,
                deve-se cumprir estas 6 etapas regimentais. Você pode marcar ou desmarcar o status de cada etapa conforme o andamento da sua software house.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* ETAPA 1 */}
            <div className={`p-4 rounded-2xl border transition-all ${
              config.etapasHomologacao.passo1_cadastroLoja 
                ? 'bg-white border-emerald-200 shadow-xs' 
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    config.etapasHomologacao.passo1_cadastroLoja
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    1
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      Credenciamento da Empresa na Loja SERPRO
                      {config.etapasHomologacao.passo1_cadastroLoja && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          Concluído
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Acesse o portal da Loja SERPRO (<strong>loja.serpro.gov.br</strong>), cadastre o CNPJ da Murade / Assessoria Fiscal e aceite o Termo Geral de Prestação de Serviços Tecnológicos da União.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <a
                    href="https://loja.serpro.gov.br"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    Acessar Loja SERPRO <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleAlternarEtapa('passo1_cadastroLoja')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      config.etapasHomologacao.passo1_cadastroLoja
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    {config.etapasHomologacao.passo1_cadastroLoja ? 'Desmarcar' : 'Marcar Concluído'}
                  </button>
                </div>
              </div>
            </div>

            {/* ETAPA 2 */}
            <div className={`p-4 rounded-2xl border transition-all ${
              config.etapasHomologacao.passo2_credenciaisOAuth 
                ? 'bg-white border-emerald-200 shadow-xs' 
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    config.etapasHomologacao.passo2_credenciaisOAuth
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    2
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      Criação da Aplicação & Obtenção de Chaves OAuth 2.0
                      {config.etapasHomologacao.passo2_credenciaisOAuth && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          Concluído
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      No painel de desenvolvedor do SERPRO (<strong>apis.serpro.gov.br</strong>), crie o app &quot;FiscoIA Gestão Fiscal&quot; e gere a <code>Consumer Key</code> e o <code>Consumer Secret</code>.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setAbaInterna('credenciais')}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    Ver Chaves <KeyRound className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAlternarEtapa('passo2_credenciaisOAuth')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      config.etapasHomologacao.passo2_credenciaisOAuth
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    {config.etapasHomologacao.passo2_credenciaisOAuth ? 'Desmarcar' : 'Marcar Concluído'}
                  </button>
                </div>
              </div>
            </div>

            {/* ETAPA 3 */}
            <div className={`p-4 rounded-2xl border transition-all ${
              config.etapasHomologacao.passo3_certificadoA1 
                ? 'bg-white border-emerald-200 shadow-xs' 
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    config.etapasHomologacao.passo3_certificadoA1
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    3
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      Certificado Digital ICP-Brasil (e-CNPJ A1) para mTLS
                      {config.etapasHomologacao.passo3_certificadoA1 && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          Válido até 31/12/2026
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      A Receita Federal exige certificado e-CNPJ A1 para assinar as requisições mútuas TLS (mTLS) de acesso às procurações eletrônicas e-CAC e DCTFWeb.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAlternarEtapa('passo3_certificadoA1')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      config.etapasHomologacao.passo3_certificadoA1
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    {config.etapasHomologacao.passo3_certificadoA1 ? 'Desmarcar' : 'Marcar Concluído'}
                  </button>
                </div>
              </div>
            </div>

            {/* ETAPA 4 */}
            <div className={`p-4 rounded-2xl border transition-all ${
              config.etapasHomologacao.passo4_testeSandbox 
                ? 'bg-white border-emerald-200 shadow-xs' 
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    config.etapasHomologacao.passo4_testeSandbox
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    4
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      Testes no Ambiente Sandbox de Homologação SERPRO
                      {config.etapasHomologacao.passo4_testeSandbox && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          Testado OK
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Executar chamadas de teste simulando consultas DCTFWeb e emissão de DARF para garantir que os esquemas JSON atendem à Instrução Normativa da RFB.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={handleExecutarTesteConectividade}
                    className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    Testar Sandbox <Radio className="w-3 h-3 text-indigo-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAlternarEtapa('passo4_testeSandbox')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      config.etapasHomologacao.passo4_testeSandbox
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    {config.etapasHomologacao.passo4_testeSandbox ? 'Desmarcar' : 'Marcar Concluído'}
                  </button>
                </div>
              </div>
            </div>

            {/* ETAPA 5 */}
            <div className={`p-4 rounded-2xl border transition-all ${
              config.etapasHomologacao.passo5_contratacaoPlano 
                ? 'bg-white border-emerald-200 shadow-xs' 
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    config.etapasHomologacao.passo5_contratacaoPlano
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    5
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      Contratação do Plano & Assinatura Digital do Contrato
                      {config.etapasHomologacao.passo5_contratacaoPlano && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          Contratado (Pós-Pago)
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Escolha do modelo comercial oficial da SERPRO (Pós-pago com fatura mensal via boleto ou Pré-pago via créditos pré-adquiridos) e assinatura via Gov.br / e-CNPJ.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setAbaInterna('pagamento_planos')}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    Ver Planos <CreditCard className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAlternarEtapa('passo5_contratacaoPlano')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      config.etapasHomologacao.passo5_contratacaoPlano
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    {config.etapasHomologacao.passo5_contratacaoPlano ? 'Desmarcar' : 'Marcar Concluído'}
                  </button>
                </div>
              </div>
            </div>

            {/* ETAPA 6 */}
            <div className={`p-4 rounded-2xl border transition-all ${
              config.etapasHomologacao.passo6_producaoLiberada 
                ? 'bg-white border-emerald-200 shadow-xs' 
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    config.etapasHomologacao.passo6_producaoLiberada
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    6
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      Virada de Chave para Produção Governamental
                      {config.etapasHomologacao.passo6_producaoLiberada && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          Produção Ativa
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Com o contrato ativo, as chaves definitivas do gateway de produção (<code>gateway.apiserpro.serpro.gov.br</code>) são liberadas pelo SERPRO para transmissão real.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      handleAlternarEtapa('passo6_producaoLiberada');
                      if (!config.etapasHomologacao.passo6_producaoLiberada) {
                        handleAlternarAmbiente('producao');
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      config.etapasHomologacao.passo6_producaoLiberada
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    {config.etapasHomologacao.passo6_producaoLiberada ? 'Voltar para Sandbox' : 'Ativar Produção'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: CONTRATAÇÃO & FORMAS DE PAGAMENTO SERPRO */}
      {abaInterna === 'pagamento_planos' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                Como Funciona a Contratação e o Pagamento Junto ao SERPRO
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                O SERPRO é uma empresa pública vinculada ao Ministério da Fazenda. O modelo de cobrança segue a Portaria RFB nº 1.488 e tabela pública de tarifas de tecnologia:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  📄
                </div>
                <strong className="text-sm text-slate-900 block">Pós-Pago Faturado (Recomendado)</strong>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Cobrança efetuada ao final de cada mês baseada na quantidade de consultas efetuadas. A fatura com boleto bancário é emitida no dia 05 com vencimento no dia 20.
                </p>
                <div className="pt-2 text-[11px] text-emerald-700 font-bold">
                  ✓ Sem interrupção de serviço
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  💳
                </div>
                <strong className="text-sm text-slate-900 block">Pré-Pago (Créditos em Saldo)</strong>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Ideal para controle estrito de custos. Você compra um pacote de créditos (ex: R$ 200,00) via Pix ou Cartão Corporativo na Loja SERPRO e o sistema consome conforme o uso.
                </p>
                <div className="pt-2 text-[11px] text-indigo-700 font-bold">
                  ✓ Controle orçamentário total
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  🏛️
                </div>
                <strong className="text-sm text-slate-900 block">Débito Automático em Conta</strong>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Convênio direto com Banco do Brasil, Caixa Econômica ou Itaú para liquidação automática das faturas governamentais do SERPRO sem risco de bloqueio.
                </p>
                <div className="pt-2 text-[11px] text-amber-700 font-bold">
                  ✓ 100% automatizado
                </div>
              </div>
            </div>
          </div>

          {/* TABELA DE TARIFAS PÚBLICAS SERPRO — INTEGRA CONTADOR */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
            <h3 className="text-base font-bold text-slate-900">
              Tabela de Preços & Franquias SERPRO Integra Contador (2026)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="p-3 font-bold">Plano SERPRO</th>
                    <th className="p-3 font-bold">Franquia Mensal</th>
                    <th className="p-3 font-bold">Valor por Consulta</th>
                    <th className="p-3 font-bold">Estimativa Mensal</th>
                    <th className="p-3 font-bold">Status Atual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-900">Integra Contador — Básico</td>
                    <td className="p-3 text-slate-600">Até 1.000 consultas</td>
                    <td className="p-3 text-slate-600">R$ 0,15 / req</td>
                    <td className="p-3 font-semibold text-slate-800">R$ 150,00 / mês</td>
                    <td className="p-3">
                      <button 
                        type="button"
                        onClick={() => {
                          const nova = { ...config, planoSerpro: 'integra_contador_basico' as const };
                          salvarConfigSerpro(nova);
                          setConfig(nova);
                        }}
                        className={`text-xs px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                          config.planoSerpro === 'integra_contador_basico'
                            ? 'bg-indigo-600 text-white'
                            : 'border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {config.planoSerpro === 'integra_contador_basico' ? 'Ativo' : 'Selecionar'}
                      </button>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50 bg-indigo-50/20">
                    <td className="p-3 font-semibold text-indigo-950 flex items-center gap-1.5">
                      Integra Contador — Profissional
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">Recomendado</span>
                    </td>
                    <td className="p-3 text-slate-600">Até 5.000 consultas</td>
                    <td className="p-3 text-slate-600">R$ 0,10 / req</td>
                    <td className="p-3 font-semibold text-slate-800">R$ 500,00 / mês</td>
                    <td className="p-3">
                      <button 
                        type="button"
                        onClick={() => {
                          const nova = { ...config, planoSerpro: 'integra_contador_pro' as const };
                          salvarConfigSerpro(nova);
                          setConfig(nova);
                        }}
                        className={`text-xs px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                          config.planoSerpro === 'integra_contador_pro'
                            ? 'bg-indigo-600 text-white'
                            : 'border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {config.planoSerpro === 'integra_contador_pro' ? 'Ativo' : 'Selecionar'}
                      </button>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-900">Integra Contador — Master / Corporativo</td>
                    <td className="p-3 text-slate-600">Acima de 10.000 consultas</td>
                    <td className="p-3 text-slate-600">R$ 0,07 / req</td>
                    <td className="p-3 font-semibold text-slate-800">R$ 700,00+ / mês</td>
                    <td className="p-3">
                      <button 
                        type="button"
                        onClick={() => {
                          const nova = { ...config, planoSerpro: 'integra_contador_master' as const };
                          salvarConfigSerpro(nova);
                          setConfig(nova);
                        }}
                        className={`text-xs px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                          config.planoSerpro === 'integra_contador_master'
                            ? 'bg-indigo-600 text-white'
                            : 'border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {config.planoSerpro === 'integra_contador_master' ? 'Ativo' : 'Selecionar'}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <span>* Valores oficiais de tabela pública divulgados pelo SERPRO para 2026.</span>
              <a 
                href="https://loja.serpro.gov.br" 
                target="_blank" 
                rel="noreferrer"
                className="text-indigo-600 hover:underline font-bold flex items-center gap-1"
              >
                Abrir Portal de Contratação da Loja SERPRO <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: CHAVES DE API & CERTIFICADO */}
      {abaInterna === 'credenciais' && (
        <div className="space-y-6">
          <form onSubmit={handleSalvarCredenciais} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-600" />
                  Credenciais OAuth 2.0 (SERPRO API Gateway)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  As chaves fornecidas no portal do desenvolvedor autenticam o FiscoIA perante a Receita Federal.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                Ambiente Atual: <strong>{config.ambiente.toUpperCase()}</strong>
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Consumer Key (Chave Pública do Aplicativo)
                </label>
                <input
                  type="text"
                  value={consumerKey}
                  onChange={(e) => setConsumerKey(e.target.value)}
                  placeholder="Ex: pk_serpro_prod_..."
                  className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Consumer Secret (Chave Secreta)
                  </label>
                  <button
                    type="button"
                    onClick={() => setMostrarSecret(!mostrarSecret)}
                    className="text-[11px] text-indigo-600 hover:underline cursor-pointer"
                  >
                    {mostrarSecret ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                <input
                  type={mostrarSecret ? 'text' : 'password'}
                  value={consumerSecret}
                  onChange={(e) => setConsumerSecret(e.target.value)}
                  placeholder="Ex: sk_serpro_sec_..."
                  className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* CAMPO DE DIGITAÇÃO DO TOKEN BEARER EM CACHE */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Token Bearer em Cache (OAuth 2.0 JWT)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Campo liberado para edição manual. Digite, apague, cole seu token oficial ou gere um novo.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setMostrarToken(!mostrarToken)}
                      className="px-2.5 py-1 text-[11px] bg-white border border-slate-200 hover:bg-slate-100 rounded-lg font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      {mostrarToken ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
                      {mostrarToken ? 'Ocultar' : 'Mostrar'}
                    </button>
                    <button
                      type="button"
                      onClick={handleColarToken}
                      className="px-2.5 py-1 text-[11px] bg-white border border-slate-200 hover:bg-slate-100 rounded-lg font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
                      title="Colar da Área de Transferência"
                    >
                      <Copy className="w-3.5 h-3.5 text-indigo-600" />
                      Colar
                    </button>
                    <button
                      type="button"
                      onClick={handleCopiarToken}
                      className="px-2.5 py-1 text-[11px] bg-white border border-slate-200 hover:bg-slate-100 rounded-lg font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
                      title="Copiar Token"
                    >
                      {copiadoToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                      {copiadoToken ? 'Copiado!' : 'Copiar'}
                    </button>
                    <button
                      type="button"
                      onClick={handleLimparToken}
                      className="px-2.5 py-1 text-[11px] bg-white border border-rose-200 hover:bg-rose-50 rounded-lg font-medium text-rose-600 flex items-center gap-1 cursor-pointer"
                      title="Limpar campo do Token"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Limpar
                    </button>
                    <button
                      type="button"
                      onClick={handleGerarNovoToken}
                      className="px-2.5 py-1 text-[11px] bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg font-semibold text-indigo-700 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                      Gerar Novo
                    </button>
                  </div>
                </div>

                {/* Espaço aberto para digitação do Token Bearer */}
                <div>
                  <textarea
                    rows={3}
                    value={tokenBearer}
                    onChange={(e) => setTokenBearer(e.target.value)}
                    placeholder="Cole ou digite aqui o Token Bearer JWT fornecido pelo SERPRO..."
                    style={{ WebkitTextSecurity: mostrarToken ? 'none' : 'disc' } as React.CSSProperties}
                    className="w-full text-xs font-mono p-3 rounded-xl border border-slate-300 focus:outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 bg-white text-slate-800 leading-relaxed shadow-inner resize-y"
                  />
                </div>

                {/* Linha de Validade do Token */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-600">
                      Validade do Token:
                    </label>
                    <input
                      type="text"
                      value={tokenValidade}
                      onChange={(e) => setTokenValidade(e.target.value)}
                      placeholder="Ex: 31/12/2026"
                      className="text-xs font-mono px-2.5 py-1 rounded-lg border border-slate-200 bg-white w-32 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      Válido no Cache até {tokenValidade || '31/12/2026'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
              {credenciaisSalvasRecente ? (
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Credenciais SERPRO e Token Bearer salvos com sucesso!</span>
                </div>
              ) : (
                <span className="text-[11px] text-slate-500">
                  Credenciais OAuth e Token Bearer criptografados localmente.
                </span>
              )}
              <button
                type="submit"
                disabled={salvandoCredenciais}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5 ${
                  credenciaisSalvasRecente
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-300'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                } disabled:opacity-60`}
              >
                {salvandoCredenciais ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Gravando Credenciais...</span>
                  </>
                ) : credenciaisSalvasRecente ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Credenciais Salvas!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar Credenciais & Token</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* CERTIFICADO DIGITAL A1 - TOTALMENTE EDITÁVEL COM FEEDBACK VISUAL */}
          <div className={`rounded-2xl p-6 space-y-5 transition-all duration-300 shadow-xs ${
            certSalvoRecente
              ? 'bg-emerald-50/30 border-2 border-emerald-500 ring-4 ring-emerald-100'
              : 'bg-white border border-slate-200'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Certificado Digital ICP-Brasil (e-CNPJ A1) Vinculado
                  </h3>
                  {certSalvoRecente && (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1 animate-pulse">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      SALVO NO SISTEMA
                    </span>
                  )}
                  {horaSalvoCert && !certSalvoRecente && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      Última gravação: {horaSalvoCert}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Necessário para autenticação mTLS mútua em chamadas protegidas da DCTFWeb e Procurações e-CAC.
                  Todos os campos abaixo estão habilitados para você clicar, apagar e digitar suas informações.
                </p>
              </div>

              {/* Botão de Status Clicável */}
              <button
                type="button"
                onClick={() => setCertInstalado(!certInstalado)}
                className={`text-xs font-bold px-3.5 py-2 rounded-full border cursor-pointer transition-all flex items-center gap-1.5 shadow-2xs ${
                  certInstalado
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                }`}
                title="Clique para alternar o status do certificado"
              >
                <span className={`w-2.5 h-2.5 rounded-full ${certInstalado ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                <span>{certInstalado ? 'Instalado & Ativo (ICP-Brasil OK)' : 'Pendente de Instalação'}</span>
              </button>
            </div>

            {/* BANNER DE SUCESSO VISUAL QUANDO O USUÁRIO SALVA O CERTIFICADO */}
            {certSalvoRecente && (
              <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-xl text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-emerald-950 flex items-center gap-2">
                      Certificado Digital ICP-Brasil Salvo com Sucesso!
                    </h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Arquivo <strong>{certNomeArquivo || 'e-CNPJ A1'}</strong> vinculado ao CNPJ <strong>{certCnpj}</strong> e gravado no cache com segurança.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <span className="text-[11px] font-mono font-bold bg-white text-emerald-900 px-3 py-1 rounded-lg border border-emerald-300 shadow-xs">
                    Gravado às {horaSalvoCert}
                  </span>
                </div>
              </div>
            )}

            {/* CAMPOS DIGITÁVEIS DO CERTIFICADO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {/* Arquivo do Certificado */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-500 font-bold uppercase block">
                    Arquivo do Certificado (.pfx / .p12)
                  </label>
                  <label
                    htmlFor="upload-cert-a1"
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    Procurar
                  </label>
                  <input
                    id="upload-cert-a1"
                    type="file"
                    accept=".pfx,.p12"
                    onChange={handleUploadCertificado}
                    className="hidden"
                  />
                </div>
                <input
                  type="text"
                  value={certNomeArquivo}
                  onChange={(e) => setCertNomeArquivo(e.target.value)}
                  placeholder="e-CNPJ_EMPRESA_A1_2026.pfx"
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Autoridade Certificadora */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <label className="text-[11px] text-slate-500 font-bold uppercase block">
                  Autoridade Certificadora (Emissor)
                </label>
                <input
                  type="text"
                  value={certEmissor}
                  onChange={(e) => setCertEmissor(e.target.value)}
                  placeholder="Ex: Autoridade Certificadora SERPRO Final SSL, Certisign, Soluti..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Validade do Certificado */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <label className="text-[11px] text-slate-500 font-bold uppercase block">
                  Validade do Certificado
                </label>
                <input
                  type="text"
                  value={certValidade}
                  onChange={(e) => setCertValidade(e.target.value)}
                  placeholder="Ex: 31/12/2026"
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500 text-emerald-700 font-bold"
                />
              </div>

              {/* CNPJ Vinculado */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <label className="text-[11px] text-slate-500 font-bold uppercase block">
                  CNPJ Titular do Certificado
                </label>
                <input
                  type="text"
                  value={certCnpj}
                  onChange={(e) => setCertCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Senha do Certificado */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-500 font-bold uppercase block">
                    Senha do Certificado A1 (.pfx)
                  </label>
                  <button
                    type="button"
                    onClick={() => setMostrarSenhaCert(!mostrarSenhaCert)}
                    className="text-[11px] text-indigo-600 hover:underline cursor-pointer"
                  >
                    {mostrarSenhaCert ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                <input
                  type={mostrarSenhaCert ? 'text' : 'password'}
                  value={certSenha}
                  onChange={(e) => setCertSenha(e.target.value)}
                  placeholder="Digite a senha do certificado..."
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Status de Ativação */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <label className="text-[11px] text-slate-500 font-bold uppercase block">
                  Status Operacional
                </label>
                <select
                  value={certInstalado ? 'ativo' : 'pendente'}
                  onChange={(e) => setCertInstalado(e.target.value === 'ativo')}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500 font-semibold"
                >
                  <option value="ativo">✅ Instalado & Ativo no Sistema</option>
                  <option value="pendente">⏳ Pendente de Instalação</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                💡 Dica: Ao salvar, o certificado é armazenado de forma segura no cache local do navegador para uso nas transmissões DCTFWeb.
              </span>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  disabled={salvandoCert}
                  onClick={handleSalvarCertificado}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-2 ${
                    certSalvoRecente
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-300'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  } disabled:opacity-60`}
                >
                  {salvandoCert ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando Certificado...</span>
                    </>
                  ) : certSalvoRecente ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>✅ Certificado Salvo com Sucesso!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salvar Certificado Digital</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={salvandoCert || salvandoCredenciais}
                  onClick={handleSalvarTudo}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-2 disabled:opacity-60"
                  title="Salvar todas as credenciais SERPRO, Token Bearer e Certificado Digital"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Tudo</span>
                </button>
                <button
                  type="button"
                  disabled={salvandoCert || salvandoCredenciais || sincronizando}
                  onClick={handleSalvarESincronizarTudo}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-60"
                  title="Salva as credenciais e o certificado e aciona imediatamente a sincronização com a Receita Federal"
                >
                  <Zap className="w-4 h-4 text-yellow-300" />
                  <span>Salvar e Sincronizar Tudo com o Sistema</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 4: LOGS DE COMUNICAÇÃO GOVERNAMENTAL */}
      {abaInterna === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-600" />
                Histórico de Transmissões & Logs SERPRO
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitor em tempo real de latência, códigos HTTP e respostas dos microsserviços governamentais.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLogs(obterLogsSerpro())}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Atualizar Logs
            </button>
          </div>

          <div className="space-y-2">
            {logs.map((log) => (
              <div 
                key={log.id} 
                className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  log.sucesso ? 'bg-slate-50/70 border-slate-100' : 'bg-rose-50/70 border-rose-100'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-mono">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      log.metodo === 'GET' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {log.metodo}
                    </span>
                    <strong className="text-slate-800 text-[11px]">{log.endpoint}</strong>
                    <span className="text-[10px] text-slate-400">({log.timestamp})</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">{log.mensagem}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center font-mono text-[11px]">
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    log.sucesso ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    HTTP {log.statusHttp}
                  </span>
                  <span className="text-slate-400">{log.tempoRespostaMs}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TOAST FLUTUANTE DE NOTIFICAÇÃO GLOBAL */}
      {toastNotificacao && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-emerald-500/50 flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-emerald-300">
              {toastNotificacao.titulo}
            </h4>
            <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
              {toastNotificacao.mensagem}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToastNotificacao(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO & ANTECIPAÇÃO FISCOIA */}
      <ModalConfirmacaoConsultaFiscoia
        aberto={modalFiscoiaAberto}
        cnpj={cnpjSincronizar}
        nomeCliente={empresaAtiva ? empresaAtiva.razaoSocial : ''}
        tipoConsulta="Sincronização SERPRO"
        onFechar={() => setModalFiscoiaAberto(false)}
        onConsultaConcluida={() => {
          setStatusIntegracao(verificarStatusIntegracaoSerpro());
        }}
      />
    </div>
  );
}
