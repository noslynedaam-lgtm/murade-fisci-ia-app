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
  obterErroLeituraConfigSerpro,
  redefinirConfigSerproLocal,
  salvarConfigSerpro, 
  obterLogsSerpro, 
  testarConexaoGatewaySerpro, 
  ConfigSerpro, 
  LogConexaoSerpro 
} from '../../services/serpro/serpro.service';
import {
  verificarStatusIntegracaoSerpro,
  relatarIndisponibilidadeSerpro,
  ResultadoSincronizacaoSerpro,
  obterUltimaSincronizacaoSerpro
} from '../../services/serpro/sincronizacaoSerpro.service';
import { useEmpresa } from '../../context/EmpresaContext';

interface SerproHomologacaoScreenProps {
  onVoltar?: () => void;
  onNavegar?: (aba: string) => void;
}

export default function SerproHomologacaoScreen({ onVoltar, onNavegar }: SerproHomologacaoScreenProps) {
  const { empresaAtiva } = useEmpresa();
  const [config, setConfig] = useState<ConfigSerpro>(() => obterConfigSerpro());
  const [erroConfigLocal, setErroConfigLocal] = useState<string | null>(() => obterErroLeituraConfigSerpro());
  const [logs, setLogs] = useState<LogConexaoSerpro[]>(() => obterLogsSerpro());
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<{
    testado: boolean;
    sucesso: boolean;
    tempoMs: number;
    gateway: string;
    servicos: Array<{ nome: string; status: 'ONLINE' | 'OFFLINE'; latenciaMs: number; versao: string }>;
    detalhes: string;
  } | null>(null);

  const [abaInterna, setAbaInterna] = useState<'sincronizacao' | 'passo_a_passo' | 'pagamento_planos' | 'credenciais' | 'logs'>('sincronizacao');
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  // Estados de Sincronização SERPRO ➔ FiscoIA
  const [statusIntegracao, setStatusIntegracao] = useState(() => verificarStatusIntegracaoSerpro());
  const [resultadoSinc, setResultadoSinc] = useState<ResultadoSincronizacaoSerpro | null>(null);
  const [cnpjSincronizar, setCnpjSincronizar] = useState(empresaAtiva ? empresaAtiva.cnpj : (config.certificadoA1?.cnpj || ''));

  // Form states - Credenciais SERPRO
  const [consumerKey, setConsumerKey] = useState(config.consumerKey || '');
  const [consumerSecret, setConsumerSecret] = useState(config.consumerSecret || '');
  const [mostrarSecret, setMostrarSecret] = useState(false);

  // Token Bearer states (habilitado para digitação)
  const [tokenBearer, setTokenBearer] = useState(config.tokenBearer || '');
  const [tokenValidade, setTokenValidade] = useState(config.tokenExpiracao || '');
  const [mostrarToken, setMostrarToken] = useState(true);
  const [copiadoToken, setCopiadoToken] = useState(false);

  // Certificado Digital A1 states (habilitado para digitação)
  const [certNomeArquivo, setCertNomeArquivo] = useState(config.certificadoA1?.nomeArquivo || '');
  const [certSenha, setCertSenha] = useState('');
  const [arquivoA1, setArquivoA1] = useState<File | null>(null);
  const [statusA1Servidor, setStatusA1Servidor] = useState<{ carregando: boolean; cadastrado: boolean; mensagem: string }>({ carregando: false, cadastrado: false, mensagem: '' });
  const [mostrarSenhaCert, setMostrarSenhaCert] = useState(false);

  const [toastNotificacao, setToastNotificacao] = useState<{
    titulo: string;
    mensagem: string;
    tipo: 'sucesso' | 'info';
  } | null>(null);

  const handleSalvarCredenciais = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setConsumerSecret('');
    setTokenBearer('');
    setCertSenha('');
    setMensagemSucesso('As credenciais não foram armazenadas nesta tela. Configure o par OAuth como segredos no Render; o teste disponível verifica apenas a autenticação do gateway SERPRO.');
    setToastNotificacao({
      titulo: 'Credenciais não armazenadas',
      mensagem: 'Nenhuma chave ou senha foi salva pelo formulário. Configure os segredos no Render; o teste de gateway não valida acesso a APIs de produto.',
      tipo: 'info'
    });
  };

  const idsEmpresaFiscal = empresaAtiva?.idCentral && empresaAtiva?.tenantIdCentral
    ? { companyId: empresaAtiva.idCentral, tenantId: empresaAtiva.tenantIdCentral }
    : null;

  useEffect(() => {
    if (!idsEmpresaFiscal) {
      setStatusA1Servidor({ carregando: false, cadastrado: false, mensagem: 'Selecione uma empresa cadastrada no banco para vincular o certificado.' });
      return;
    }
    let cancelado = false;
    setStatusA1Servidor(atual => ({ ...atual, carregando: true, mensagem: '' }));
    fetch(`/api/companies/${encodeURIComponent(idsEmpresaFiscal.companyId)}/fiscal-certificate/status?tenantId=${encodeURIComponent(idsEmpresaFiscal.tenantId)}`, {
      credentials: 'same-origin', cache: 'no-store',
    }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.mensagem === 'string' ? data.mensagem : 'Não foi possível consultar o certificado no servidor.');
      if (!cancelado) setStatusA1Servidor({ carregando: false, cadastrado: data.cadastradoNoServidor === true, mensagem: data.cadastradoNoServidor === true ? `A1 cifrado no servidor desde ${new Date(data.recebidoEm).toLocaleString('pt-BR')}. Ainda não validado pela SEFAZ.` : 'Nenhum A1 cadastrado no servidor para esta empresa.' });
    }).catch(error => {
      if (!cancelado) setStatusA1Servidor({ carregando: false, cadastrado: false, mensagem: error instanceof Error ? error.message : 'Falha ao consultar o estado do certificado.' });
    });
    return () => { cancelado = true; };
  }, [empresaAtiva?.idCentral, empresaAtiva?.tenantIdCentral]);

  const handleSalvarCertificado = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!idsEmpresaFiscal || !arquivoA1 || !certSenha) {
      setMensagemSucesso('Selecione uma empresa, o arquivo A1 e informe a senha para continuar.');
      return;
    }
    if (arquivoA1.size > 5 * 1024 * 1024) {
      setMensagemSucesso('O arquivo A1 excede o limite de 5 MB. Nenhum dado foi enviado.');
      return;
    }
    setTestando(true);
    try {
      const pfxBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo A1.'));
        reader.onload = () => {
          if (!(reader.result instanceof ArrayBuffer)) return reject(new Error('Formato do arquivo A1 inválido.'));
          const bytes = new Uint8Array(reader.result);
          let binary = '';
          for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
          resolve(btoa(binary));
        };
        reader.readAsArrayBuffer(arquivoA1);
      });
      const response = await fetch(`/api/companies/${encodeURIComponent(idsEmpresaFiscal.companyId)}/fiscal-certificate`, {
        method: 'PUT', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: idsEmpresaFiscal.tenantId, pfxBase64, passphrase: certSenha }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.mensagem === 'string' ? data.mensagem : 'O servidor não confirmou o cadastro do A1.');
      setCertSenha('');
      setArquivoA1(null);
      setCertNomeArquivo('');
      setStatusA1Servidor({ carregando: false, cadastrado: true, mensagem: `${data.mensagem} Recebido em ${new Date(data.recebidoEm).toLocaleString('pt-BR')}.` });
      setToastNotificacao({ titulo: 'A1 salvo com proteção por empresa', mensagem: data.mensagem, tipo: 'sucesso' });
    } catch (error) {
      setToastNotificacao({ titulo: 'Certificado não confirmado', mensagem: error instanceof Error ? error.message : 'Falha ao enviar o A1 com segurança.', tipo: 'info' });
    } finally {
      setTestando(false);
    }
  };

  const handleVerificarConfiguracaoIntegracao = () => {
    setAbaInterna('sincronizacao');
    handleMostrarStatusIntegracao();
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
    setTokenBearer('');
    setMensagemSucesso('O token deve ser emitido pelo SERPRO. O sistema não pode gerar credenciais oficiais.');
  };

  const handleUploadCertificado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      if (!/\.(pfx|p12)$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
        setToastNotificacao({ titulo: 'Arquivo não aceito', mensagem: 'Selecione um arquivo .pfx/.p12 de até 5 MB.', tipo: 'info' });
        return;
      }
      setArquivoA1(file);
      setCertNomeArquivo(file.name);
    }
  };

  const handleAlternarAmbiente = (novoAmbiente: 'homologacao' | 'producao') => {
    const novaConfig = { ...config, ambiente: novoAmbiente };
    if (!salvarConfigSerpro(novaConfig)) {
      setErroConfigLocal(obterErroLeituraConfigSerpro());
      return;
    }
    setErroConfigLocal(null);
    setConfig(novaConfig);
    setResultadoTeste(null);
  };

  const handleRecriarConfigLocal = () => {
    const confirmado = window.confirm('Recriar somente as preferências SERPRO deste navegador? O ambiente e o checklist serão reiniciados. Cadastros de empresas e notas não serão alterados.');
    if (!confirmado) return;
    if (!redefinirConfigSerproLocal()) {
      setErroConfigLocal(obterErroLeituraConfigSerpro());
      return;
    }
    const padrao = obterConfigSerpro();
    setConfig(padrao);
    setErroConfigLocal(obterErroLeituraConfigSerpro());
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
    if (!salvarConfigSerpro(novaConfig)) {
      setErroConfigLocal(obterErroLeituraConfigSerpro());
      return;
    }
    setErroConfigLocal(null);
    setConfig(novaConfig);
  };

  const handleExecutarTesteConectividade = async () => {
    const ambienteTeste = config.ambiente === 'producao' ? 'produção' : 'homologação';
    const autorizado = window.confirm(
      `O servidor fará uma requisição OAuth ao gateway SERPRO de ${ambienteTeste}, usando as credenciais já configuradas como segredos no Render. Isso testa somente a autenticação do gateway; não consulta CNPJ, notas, guias nem outro serviço fiscal. Continuar?`,
    );
    if (!autorizado) return;
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

  const handleMostrarStatusIntegracao = () => {
    const resultado = relatarIndisponibilidadeSerpro();
    setResultadoSinc(resultado);
    setStatusIntegracao(verificarStatusIntegracaoSerpro());
    setLogs(obterLogsSerpro());
    setToastNotificacao({
      titulo: 'Integração indisponível',
      mensagem: resultado.mensagem,
      tipo: 'info'
    });
  };

  const etapasConcluidas = Object.values(config.etapasHomologacao).filter(Boolean).length;
  const percentualHomologacao = Math.round((etapasConcluidas / 6) * 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {erroConfigLocal && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Configuração local SERPRO não confirmada.</strong>
          <p className="mt-1">{erroConfigLocal}</p>
          <button type="button" onClick={handleRecriarConfigLocal} className="mt-2 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-100">
            Recriar preferências SERPRO locais
          </button>
        </div>
      )}
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
              <span className="bg-amber-400/10 text-amber-200 border border-amber-400/30 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Radio className="w-3 h-3 text-amber-300" />
                Integração não configurada
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Server className="w-7 h-7 text-indigo-300" />
              Integração & Homologação SERPRO
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200 max-w-2xl leading-relaxed">
              Área de configuração do SERPRO. Consultas e transmissões só serão habilitadas após implementar e validar a autenticação oficial no servidor.
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
                Preferência: Homologação
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
                Preferência: Produção
              </button>
            </div>

            <button
              type="button"
              onClick={handleExecutarTesteConectividade}
              disabled={testando}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testando ? 'animate-spin' : ''}`} />
              {testando ? 'Verificando configuração...' : 'Verificar configuração de conexão'}
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
                Checklist manual de preparação: {etapasConcluidas} de 6 itens marcados
              </div>
              <div className="text-[11px] text-indigo-300">
                {percentualHomologacao === 100
                  ? 'Checklist preenchido; isso não comprova acesso ou homologação oficial.'
                  : 'O checklist é apenas informativo; a homologação precisa ser confirmada no portal oficial.'}
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
          !resultadoTeste.testado ? 'bg-amber-50/80 border-amber-200' : resultadoTeste.sucesso ? 'bg-emerald-50/80 border-emerald-200' : 'bg-rose-50/80 border-rose-200'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {resultadoTeste.testado && resultadoTeste.sucesso ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${resultadoTeste.testado ? 'text-rose-600' : 'text-amber-600'}`} />
              )}
              <div>
                <strong className={`text-sm block ${!resultadoTeste.testado ? 'text-amber-900' : resultadoTeste.sucesso ? 'text-emerald-900' : 'text-rose-900'}`}>
                  {!resultadoTeste.testado ? 'Autenticação não testada' : resultadoTeste.sucesso ? 'OAuth do gateway confirmado' : 'Falha na autenticação do gateway'}
                </strong>
                <p className="text-xs text-slate-600 mt-0.5">{resultadoTeste.detalhes}</p>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500 font-mono">
                  <span>Gateway: <strong>{resultadoTeste.gateway}</strong></span>
                  {resultadoTeste.testado && <span>Latência: <strong>{resultadoTeste.tempoMs}ms</strong></span>}
                  <span>Etapa testada: <strong>OAuth do gateway</strong> (não valida acesso às APIs de produto)</span>
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
          <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-1.5 py-0.5 rounded-full">
            NÃO CONFIGURADO
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
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
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
                  <span className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    INTEGRAÇÃO NÃO CONFIGURADA
                  </span>
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs font-bold px-3 py-1 rounded-full">
                    OAuth do gateway não confirmado
                  </span>
                  <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold px-3 py-1 rounded-full">
                    {config.ambiente === 'producao' ? 'Produção Oficial RFB' : 'Sandbox SERPRO'}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <AlertTriangle className="w-7 h-7 text-amber-400" />
                  Acesso ao SERPRO ainda não validado
                </h2>

                <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
                  Não há uma conexão autenticada com o SERPRO configurada neste servidor.
                  Todos os canais de comunicação com a <strong>Receita Federal</strong> (DCTFWeb, Consulta Cadastral, CND e Procuração e-CAC) 
                  não estão liberados para transmissão ou consulta pelo sistema.
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
                    <span className="font-bold text-amber-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Não validado
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Token Bearer:</span>
                    <span className="font-bold text-amber-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Não configurado
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Webservices RFB:</span>
                    <span className="font-bold text-amber-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Sem teste real
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-white/10">
                    <span className="text-slate-400 text-[10px]">Validade Certificado:</span>
                    <span className="font-mono text-yellow-300 text-[11px] font-bold">Não validada</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 CARDS DE AUDITORIA GOVERNAMENTAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10 text-xs">
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">1. Certificado ICP-Brasil</span>
                <span className="font-bold text-amber-200 text-xs truncate block mt-0.5">Certificado não enviado nem validado</span>
                <span className="text-[11px] text-slate-300 mt-0.5 block">Nenhum certificado ativo nesta sessão</span>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">2. Autoridade Certificadora</span>
                <span className="font-bold text-amber-200 text-xs truncate block mt-0.5">Emissor não verificado</span>
                <span className="text-[11px] text-slate-300 mt-0.5 block">A validação oficial não está disponível</span>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">3. Integra Contador (DCTFWeb)</span>
                <span className="font-bold text-amber-200 text-xs flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="w-3 h-3 text-amber-300" /> Não configurado
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Transmissão & Guias DARF</span>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">4. Situação no FiscoIA</span>
                <span className="font-bold text-amber-300 text-xs flex items-center gap-1 mt-0.5">
                  <Database className="w-3 h-3 text-amber-400" /> Aguardando integração
                </span>
                    <span className="text-[11px] text-slate-300 mt-0.5 block">Integração ainda não configurada</span>
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
                  A sincronização real ainda não está disponível. O botão abaixo apenas informa esse estado e não consulta, transmite, cadastra ou altera dados.
                </p>
              </div>

              {/* Botão de Disparo */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <div className="text-left">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    CNPJ para consulta futura (não enviado):
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
                  onClick={handleMostrarStatusIntegracao}
                  className="mt-auto px-5 py-3 bg-slate-700 hover:bg-slate-800 active:scale-[0.99] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  title="Mostra o estado atual; não executa consulta oficial."
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Mostrar status da integração</span>
                </button>

              </div>
            </div>

            {/* PAINEL DE RESULTADO COMPLETO DA SINCRONIZAÇÃO */}
            {resultadoSinc && !resultadoSinc.sucesso && (
              <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="status">
                <strong>Consulta não realizada.</strong>
                <p className="mt-1">{resultadoSinc.mensagem}</p>
              </div>
            )}

          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 1: PASSO A PASSO DE HOMOLOGAÇÃO */}
      {abaInterna === 'passo_a_passo' && (
        <div className="space-y-4">
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-900 flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-indigo-950 font-bold">Checklist local de preparação para integração:</strong>
              <p className="mt-0.5 text-indigo-800 leading-relaxed">
                Use os itens para acompanhar tarefas da equipe. Marcar uma etapa aqui só registra sua confirmação neste navegador; não valida credenciais, contrato, certificado, homologação ou liberação nos portais oficiais.
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
                          Marcado por você; não verificado
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
                    {config.etapasHomologacao.passo1_cadastroLoja ? 'Desmarcar' : 'Marcar como feito'}
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
                          Marcado por você; não verificado
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
                    {config.etapasHomologacao.passo2_credenciaisOAuth ? 'Desmarcar' : 'Marcar como feito'}
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
                      Marcado manualmente; validade não verificada
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Os requisitos de certificado variam por serviço e contrato. O Murade ainda não recebe nem valida o arquivo; confirme as exigências no portal oficial do produto contratado.
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
                      {config.etapasHomologacao.passo3_certificadoA1 ? 'Desmarcar' : 'Marcar como feito'}
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
                          Checklist local; não comprova homologação oficial
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      O botão de verificação abaixo envia uma requisição OAuth ao gateway SERPRO do ambiente escolhido. Ele não chama APIs de CNPJ, notas, guias ou outros serviços fiscais. A resposta confirma apenas a autenticação do gateway; contrato e permissões do produto precisam ser conferidos separadamente.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={handleExecutarTesteConectividade}
                    className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    Testar OAuth do gateway <Radio className="w-3 h-3 text-indigo-500" />
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
                    {config.etapasHomologacao.passo4_testeSandbox ? 'Desmarcar' : 'Marcar como feito'}
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
                          Marcado por você; contrato não verificado
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
                    {config.etapasHomologacao.passo5_contratacaoPlano ? 'Desmarcar' : 'Marcar como feito'}
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
                          Preferência local; produção não liberada
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      A escolha de produção nesta tela altera somente uma preferência local. A liberação depende do contrato e da ativação oficial do SERPRO, que o Murade não verifica.
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
                    {config.etapasHomologacao.passo6_producaoLiberada ? 'Voltar para Sandbox' : 'Selecionar ambiente'}
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
                Contratação e preços do SERPRO
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Este painel não possui tabela de preços oficial nem dados do contrato da sua empresa. Consulte o produto e as condições vigentes diretamente no portal do SERPRO.
              </p>
            </div>
            <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
              Nenhum plano foi contratado ou ativado pelo Murade. A preferência abaixo, se selecionada, é apenas local e não muda preços, limites, credenciais nem contrato.
            </div>
          </div>

      {/* Informação comercial sem tabela de preços local */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
            <h3 className="text-base font-bold text-slate-900">
              Preferência de referência (não contratual)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="p-3 font-bold">Informação comercial</th>
                    <th className="p-3 font-bold">Situação neste painel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-3 text-slate-700">Preço, franquia, forma de pagamento e contratação do produto SERPRO</td>
                    <td className="p-3 text-slate-600">Não consultados nem contratados pelo Murade. Verifique no portal oficial.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <span>O Murade não processa contratação, pagamento nem consulta de tarifa oficial.</span>
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
          <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <strong>Não cole chaves ou tokens SERPRO aqui nem envie segredos pelo chat.</strong>
            <p className="mt-1">As chaves de produto SERPRO ficam somente como segredos no Render. O A1 pode ser enviado no campo próprio abaixo e salvo cifrado por empresa; isso, por si só, ainda não conecta nem consulta um órgão público.</p>
          </div>
          <fieldset disabled className="space-y-6 opacity-60">
          <form onSubmit={handleSalvarCredenciais} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-600" />
                  Credenciais OAuth 2.0 (SERPRO API Gateway)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Não digite credenciais aqui. O servidor usa somente os segredos configurados no Render; o teste abaixo verifica apenas o token OAuth do gateway.
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
                      Rascunho de Token Bearer (não armazenado)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Você pode colar para referência nesta tela. O token não é validado, enviado ou salvo.
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
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                      Token não validado nem armazenado
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Credenciais e token não são salvos. O backend ainda precisa de armazenamento seguro.
              </span>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Ver status do armazenamento</span>
              </button>
            </div>
          </form>
          </fieldset>

          {/* CERTIFICADO DIGITAL A1 - TOTALMENTE EDITÁVEL COM FEEDBACK VISUAL */}
          <div className="rounded-2xl p-6 space-y-5 bg-white border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Certificado Digital ICP-Brasil (e-CNPJ A1)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Necessário para chamadas oficiais que aceitem certificado digital. O A1 será cifrado no banco e vinculado à empresa selecionada.
                </p>
              </div>

              <span className={`text-xs font-bold px-3.5 py-2 rounded-full border ${statusA1Servidor.cadastrado ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300'}`}>
                {statusA1Servidor.carregando ? 'Consultando servidor…' : statusA1Servidor.cadastrado ? 'A1 salvo · SEFAZ não validada' : 'A1 não cadastrado no servidor'}
              </span>
            </div>

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
                  readOnly
                  placeholder="Selecione um arquivo .pfx ou .p12"
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Autoridade Certificadora */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <label className="text-[11px] text-slate-500 font-bold uppercase block">Empresa selecionada</label>
                <div className="rounded-lg border border-slate-200 bg-slate-100 p-2.5 font-semibold text-slate-700">{empresaAtiva?.razaoSocial || 'Nenhuma empresa ativa'}</div>
              </div>

              {/* Validade do Certificado */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <label className="text-[11px] text-slate-500 font-bold uppercase block">
                  Validade do Certificado
                </label>
                <div className="rounded-lg border border-slate-200 bg-slate-100 p-2.5 font-semibold text-slate-500">Será verificada numa conexão TLS; ainda não extraída do arquivo</div>
              </div>

              {/* CNPJ Vinculado */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <label className="text-[11px] text-slate-500 font-bold uppercase block">
                  CNPJ Titular do Certificado
                </label>
                <input
                  type="text"
                  value={empresaAtiva?.cnpj || ''}
                  readOnly
                  placeholder="Selecione uma empresa"
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-300 bg-slate-100 focus:outline-hidden focus:border-indigo-500"
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
                  value={statusA1Servidor.cadastrado ? 'armazenado' : 'pendente'}
                  disabled
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500 font-semibold"
                >
                  <option value="armazenado">Armazenado cifrado · não validado pela SEFAZ</option>
                  <option value="pendente">Pendente</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 max-w-xl">{statusA1Servidor.mensagem || 'Escolha a empresa, selecione o A1 e informe a senha. O sistema não guarda o arquivo no navegador e não consulta a SEFAZ ao salvar.'}</span>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleSalvarCertificado}
                  disabled={testando || !idsEmpresaFiscal || !arquivoA1 || !certSenha}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-2 bg-indigo-700 hover:bg-indigo-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  <span>{testando ? 'Salvando A1 cifrado…' : 'Salvar A1 nesta empresa'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleVerificarConfiguracaoIntegracao}
                  className="px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-2"
                  title="Mostra as etapas de integração. Não consulta SEFAZ nem SERPRO."
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Mostrar status da integração</span>
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
                Registro de chamadas SERPRO
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                O teste OAuth confirma somente a autenticação do gateway. Chamadas a APIs fiscais específicas e seu histórico ainda não estão implementados.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLogs(obterLogsSerpro())}
              disabled
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Histórico de APIs fiscais indisponível
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
            {!logs.length && (
              <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                Nenhuma chamada a API fiscal registrada. O teste OAuth do gateway não consulta dados de empresas nem envia certificado; token temporário e segredo não são exibidos ou armazenados.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOAST FLUTUANTE DE NOTIFICAÇÃO GLOBAL */}
      {toastNotificacao && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-amber-500/50 flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/30">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-amber-300">
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

    </div>
  );
}
