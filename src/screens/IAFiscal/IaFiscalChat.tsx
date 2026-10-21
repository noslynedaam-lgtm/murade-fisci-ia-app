import { useState, useEffect, useRef } from 'react';
import { 
  Bot, Send, Sparkles, FileText,
  BookOpen, AlertTriangle, Lock, RefreshCw, ExternalLink,
  Building2, Mic, MicOff, Volume2, VolumeX,
  Radio, Play, Gauge, Key, Monitor, ExternalLink as ExtIcon
} from 'lucide-react';
import { VERIFICA_PERMISSAO } from '../../config/planos';
import BotaoVoltar from '../../components/BotaoVoltar';
import { useEmpresa } from '../../context/EmpresaContext';
import { consultarIAFiscal, FonteWeb } from '../../services/iaFiscal.service';
import { useVoz } from '../../hooks/useVoz';
import CertificadoDigitalModulo from './CertificadoDigitalModulo';
import EmissaoNotaFiscalModulo from './EmissaoNotaFiscalModulo';
import { CertificadoDigitalDados } from './typesCertificado';
import { lerReferenciaCertificadoEmpresa } from '../../services/serpro/certificadoReferencia.service';

interface AcaoAgenteCartao {
  id: string;
  titulo: string;
  descricao: string[];
  aviso: string | null;
  irreversivel: boolean;
  estado: 'pendente' | 'executando' | 'confirmada' | 'falhou' | 'recusada';
  resultado?: string;
}

interface MensagemChat {
  acoes?: AcaoAgenteCartao[];
  id: string;
  autor: 'usuario' | 'ia';
  texto: string;
  timestamp: string;
  referencia?: string;
  fontesWeb?: FonteWeb[];
  origem?: string;
}

interface IaFiscalChatProps {
  planoAtivoId: string;
  onIrParaPlanos: () => void;
}

export default function IaFiscalChat({ planoAtivoId, onIrParaPlanos }: IaFiscalChatProps) {
  const temPermissao = VERIFICA_PERMISSAO(planoAtivoId, 'iaFiscal');
  const { empresaAtiva } = useEmpresa();

  const [mensagens, setMensagens] = useState<MensagemChat[]>([
    {
      id: 'msg-1',
      autor: 'ia',
      texto: 'Olá, eu sou o Dr. Benny.\n\nPosso ajudar com dúvidas fiscais e trabalhistas. Quando a pergunta depender de uma regra atual, vou pesquisar e mostrar as fontes encontradas. Não tenho acesso automático a dados de SERPRO, SEFAZ, Receita ou e-CAC sem uma integração configurada.\n\n🎙️ Clique no microfone para falar comigo ou digite sua dúvida.',
      timestamp: 'Agora',
      referencia: 'Murade Fisco IA',
      origem: 'ASSISTENTE'
    }
  ]);

  const [inputTexto, setInputTexto] = useState('');
  const [pensando, setPensando] = useState(false);

  // Sub-abas do Módulo Oficial: Chat Dr. Benny Gonçalves, Certificado Digital e Tela Standalone FIASCO IA
  const [abaModulo, setAbaModulo] = useState<'chat' | 'certificado' | 'rascunho' | 'telaOficial'>('chat');
  const [certificado, setCertificado] = useState<CertificadoDigitalDados | null>(null);

  useEffect(() => {
    if (!empresaAtiva?.cnpj) {
      setCertificado(null);
      return;
    }
    try {
      const salva = lerReferenciaCertificadoEmpresa(empresaAtiva.cnpj);
      if (!salva) {
        setCertificado(null);
        return;
      }
      const referencia = salva as unknown as CertificadoDigitalDados;
      referencia.valido = false;
      setCertificado(referencia);
    } catch {
      setCertificado(null);
    }
  }, [empresaAtiva?.cnpj]);
  
  // Controle de modo contínuo de voz: fale, ele responde com áudio, e reabre o microfone automaticamente
  const [modoVozContinuo, setModoVozContinuo] = useState(false);
  const [respostaAudioAtiva, setRespostaAudioAtiva] = useState(true);

  // Referência para scroll automático
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Hook de reconhecimento e síntese de voz; começa na velocidade normal.
  const {
    ouvindo,
    falando,
    suportado: vozSuportada,
    transcricaoParcial,
    erroVoz,
    nomeVozAtiva,
    velocidade,
    setVelocidade,
    iniciarEscuta,
    pararEscuta,
    falarTexto,
    pararFala,
    testarVozDrBeni,
  } = useVoz({
    lingua: 'pt-BR',
    velocidadeInicial: 1.0,
    onTextoReconhecido: (textoFinal) => {
      if (textoFinal && textoFinal.trim()) {
        setInputTexto(textoFinal);
        enviarPergunta(textoFinal);
      }
    },
    onFalaFinalizada: () => {
      // Se o usuário está em modo contínuo de conversa, reativa o microfone automaticamente
      if (modoVozContinuo) {
        setTimeout(() => {
          iniciarEscuta(true);
        }, 600);
      }
    }
  });

  // Scroll sempre que chegar nova mensagem ou transcrição parcial
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [mensagens, pensando, transcricaoParcial]);

  // Sugestões rápidas — Dados Oficiais Dr. Benny
  const sugestoes = [
    'Qual o vencimento do FGTS Digital?',
    'Quando vencem FGTS, DCTFWeb, INSS e Simples Nacional?',
    'Qual o teto e as alíquotas do INSS?',
    'Quais as faixas e deduções do IRRF?',
    'Como funciona a conexão com o SERPRO e e-CAC?',
    'Quais as alíquotas de ICMS da SEFAZ e ISS municipal?'
  ];

  const enviarPergunta = async (texto: string) => {
    if (!texto.trim() || pensando) return;

    // Para qualquer escuta ou fala enquanto processa
    pararEscuta();
    pararFala();

    const p = texto.toLowerCase();
    const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const novaMsgUsuario: MensagemChat = {
      id: `msg-${Date.now()}`,
      autor: 'usuario',
      texto,
      timestamp: agoraHora
    };

    const historicoAtual = mensagens.map(m => ({ autor: m.autor, texto: m.texto }));
    setMensagens((prev) => [...prev, novaMsgUsuario]);
    setInputTexto('');

    // Atalhos imediatos para Certificado e Emissão de Notas
    if (p.includes('cadastrar certificado') || p === 'certificado' || p.includes('como cadastrar meu certificado')) {
      const respostaCert = 'A tela permite informar os dados do certificado, mas este ambiente ainda não recebe nem valida o arquivo ou a senha e não testa conexão com a SEFAZ. Não envie a senha do certificado por este chat. Para transmitir documentos, é necessário concluir uma integração segura no servidor.';
      const novaMsgIA: MensagemChat = {
        id: `ia-${Date.now()}`,
        autor: 'ia',
        texto: respostaCert,
        timestamp: agoraHora,
        referencia: 'Limitação funcional do sistema',
        origem: 'SISTEMA_CERTIFICADO'
      };
      setMensagens((prev) => [...prev, novaMsgIA]);
      if (respostaAudioAtiva) falarTexto(respostaCert);
      return;
    }

    if (p.includes('emitir nota') || p === 'nota fiscal' || p.includes('como emitir nota fiscal')) {
      if (!certificado?.valido) {
        const respostaSemCert = 'A emissão de NF-e ainda não está integrada à SEFAZ neste ambiente. O cadastro de um certificado na interface não libera transmissão nem comprova validade ou autorização.';
        const novaMsgIA: MensagemChat = {
          id: `ia-${Date.now()}`,
          autor: 'ia',
          texto: respostaSemCert,
          timestamp: agoraHora,
          referencia: 'Integração de emissão não configurada',
          origem: 'SISTEMA_CERTIFICADO'
        };
        setMensagens((prev) => [...prev, novaMsgIA]);
        if (respostaAudioAtiva) falarTexto(respostaSemCert);
        return;
      } else {
        const respostaComCert = 'Os dados apresentados no sistema não permitem confirmar que o certificado está válido ou conectado. A emissão e assinatura de NF-e não estão integradas à SEFAZ neste ambiente.';
        const novaMsgIA: MensagemChat = {
          id: `ia-${Date.now()}`,
          autor: 'ia',
          texto: respostaComCert,
          timestamp: agoraHora,
          referencia: 'Integração de emissão não configurada',
          origem: 'SISTEMA_CERTIFICADO'
        };
        setMensagens((prev) => [...prev, novaMsgIA]);
        if (respostaAudioAtiva) falarTexto(respostaComCert);
        return;
      }
    }

    setPensando(true);

    try {
      // Primeiro a Agente (consulta o sistema e conversa com os outros); se estiver indisponível, segue a consulta de sempre.
      try {
        const respAgente = await fetch('/api/ai/agente', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ message: texto, historico: historicoAtual.slice(-10).map((h) => ({ papel: h.autor, texto: h.texto })) }),
        });
        const dadosAgente = await respAgente.json().catch(() => ({}));
        if (respAgente.ok && typeof dadosAgente.resposta === 'string' && dadosAgente.resposta.trim()) {
          const acoes: AcaoAgenteCartao[] = Array.isArray(dadosAgente.acoes)
            ? dadosAgente.acoes.filter((a: any) => a && typeof a.id === 'string' && typeof a.titulo === 'string')
                .map((a: any) => ({ id: a.id, titulo: a.titulo, descricao: Array.isArray(a.descricao) ? a.descricao.map(String) : [], aviso: typeof a.aviso === 'string' ? a.aviso : null, irreversivel: a.irreversivel === true, estado: 'pendente' as const }))
            : [];
          setMensagens((prev) => [...prev, {
            id: `ia-${Date.now()}`, autor: 'ia', texto: dadosAgente.resposta,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            referencia: 'Agente IA: dados do próprio sistema', origem: 'AGENTE_IA', acoes,
          }]);
          if (respostaAudioAtiva) falarTexto(dadosAgente.resposta);
          return;
        }
      } catch { /* cai na consulta de sempre */ }
      const res = await consultarIAFiscal(texto, historicoAtual);

      const novaMsgIA: MensagemChat = {
        id: `ia-${Date.now()}`,
        autor: 'ia',
        texto: res.resposta,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        referencia: res.referencia,
        fontesWeb: res.fontesWeb,
        origem: res.origem
      };

      setMensagens((prev) => [...prev, novaMsgIA]);

      // Se a resposta por áudio estiver habilitada, Dr. Beni fala com sua voz masculina (1.15x)
      if (respostaAudioAtiva) {
        falarTexto(res.resposta);
      }
    } catch (err: any) {
      const respostaErro = 'Não consegui acessar a assistente agora e não realizei nenhuma consulta oficial. Tente novamente em alguns minutos.';
      const novaMsgIAErro: MensagemChat = {
        id: `ia-erro-${Date.now()}`,
        autor: 'ia',
        texto: respostaErro,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        referencia: 'Consulta não realizada'
      };
      setMensagens((prev) => [...prev, novaMsgIAErro]);
      if (respostaAudioAtiva) {
        falarTexto(respostaErro);
      }
    } finally {
      setPensando(false);
    }
  };

  const atualizarAcao = (acaoId: string, mudanca: Partial<AcaoAgenteCartao>) => {
    setMensagens((prev) => prev.map((m) => (m.acoes ? { ...m, acoes: m.acoes.map((a) => (a.id === acaoId ? { ...a, ...mudanca } : a)) } : m)));
  };
  const responderComoIA = (texto: string) => {
    setMensagens((prev) => [...prev, { id: `ia-${Date.now()}`, autor: 'ia', texto, timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), origem: 'AGENTE_IA' }]);
    if (respostaAudioAtiva) falarTexto(texto);
  };
  const confirmarAcaoAgente = async (acaoId: string) => {
    atualizarAcao(acaoId, { estado: 'executando' });
    try {
      const response = await fetch('/api/ai/agente/confirmar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ id: acaoId }) });
      const data = await response.json().catch(() => ({}));
      const mensagem = typeof data.mensagem === 'string' && data.mensagem ? data.mensagem : `O sistema respondeu com erro (HTTP ${response.status}).`;
      const deuCerto = response.ok && data.sucesso === true;
      atualizarAcao(acaoId, { estado: deuCerto ? 'confirmada' : 'falhou', resultado: mensagem });
      responderComoIA(deuCerto ? `Feito. ${mensagem}` : `Não foi feito. ${mensagem}`);
    } catch {
      atualizarAcao(acaoId, { estado: 'falhou', resultado: 'Sem resposta do servidor.' });
      responderComoIA('Não consegui falar com o servidor. Tente de novo.');
    }
  };
  const recusarAcaoAgente = async (acaoId: string) => {
    atualizarAcao(acaoId, { estado: 'recusada' });
    try {
      await fetch('/api/ai/agente/recusar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ id: acaoId }) });
    } catch { /* a ação expira sozinha em 15 minutos */ }
  };

  // Alternar microfone pelo botão
  const toggleMicrofone = () => {
    if (pensando) return;
    if (ouvindo) {
      pararEscuta();
    } else {
      pararFala();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.resume();
      }
      iniciarEscuta(modoVozContinuo);
    }
  };

  return (
    <div id="ia-fiscal-screen" className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <BotaoVoltar />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-900 text-amber-400 shadow-sm">
              <Bot className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                <span>Dr. Benny Gonçalves • FIASCO IA</span>
                <span className="px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold rounded-full flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-700" />
                  <span>Consultas oficiais não conectadas</span>
                </span>
                <span className="px-2 py-0.5 bg-indigo-100 border border-indigo-200 text-indigo-800 text-[10px] font-bold rounded-full flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-indigo-600" />
                  <span>Voz Masculina (1.15x)</span>
                </span>
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Converse por voz ou texto com o Dr. Benny Gonçalves sobre regras e vencimentos do FGTS Digital, DCTFWeb, INSS, IRRF, Simples Nacional e outros assuntos fiscais. Prazos atuais dependem de consulta a fonte oficial.
          </p>
        </div>

        {!temPermissao && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            <Lock className="w-4 h-4 text-amber-600" />
            <span>Disponível no Profissional e Empresarial</span>
          </div>
        )}
      </div>

      {/* Empresa Ativa no Contexto */}
      {empresaAtiva && (
        <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-3.5 flex items-center justify-between text-xs text-indigo-950">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-indigo-700 shrink-0" />
            <div>
              <span className="font-bold">Contexto Ativo:</span>{' '}
              <span className="font-semibold text-indigo-900">{empresaAtiva.razaoSocial}</span>
              <span className="font-mono text-slate-600 ml-1.5">({empresaAtiva.cnpj})</span>
              <span className="ml-2 px-1.5 py-0.5 bg-white rounded text-[10px] font-bold text-indigo-800 border border-indigo-200">
                Regime: {empresaAtiva.regimeTributario}
              </span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-amber-800 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Dados da empresa não enviados à IA</span>
          </div>
        </div>
      )}

      {!temPermissao && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              Módulo IA Fiscal Restrito
            </h3>
            <p className="text-xs text-amber-800">
              O assistente com IA conectada à legislação e órgãos públicos está disponível a partir do <strong>Plano Profissional</strong>.
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

      {/* 🗂️ SUB-ABAS DO MÓDULO IA FISCOIA */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setAbaModulo('chat')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            abaModulo === 'chat'
              ? 'bg-indigo-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>💬 Dr. Benny • FIASCO IA</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaModulo('certificado')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            abaModulo === 'certificado'
              ? 'bg-purple-800 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>🔐 Certificado Digital (Conexão Oficial)</span>
          {certificado?.valido ? (
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setAbaModulo('rascunho')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            abaModulo === 'rascunho'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Rascunho local</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaModulo('telaOficial')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            abaModulo === 'telaOficial'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Monitor className="w-4 h-4" />
          <span>🖥️ Tela Standalone FISCOIA (HTML)</span>
        </button>

        <a
          href="/fiscoia-v1/index.html"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          title="Abrir a tela oficial isolada em nova aba"
        >
          <span>Abrir fiscoia-v1</span>
          <ExtIcon className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* RENDERIZAÇÃO CONFORME A ABA SELECIONADA */}
      {abaModulo === 'certificado' && (
        <CertificadoDigitalModulo
          empresaAtiva={empresaAtiva ? { razaoSocial: empresaAtiva.razaoSocial, cnpj: empresaAtiva.cnpj } : null}
          onCertificadoAtualizado={(novo) => setCertificado(novo)}
          onFalar={falarTexto}
        />
      )}

      {abaModulo === 'telaOficial' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛡️</span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">FISCOIA v1.0.0 — Gestão Fiscal & Conexão SERPRO</h3>
                <p className="text-xs text-slate-500">Sem emissão de nota — foco em cadastro de clientes, integração oficial e conformidade.</p>
              </div>
            </div>
            <a
              href="/fiscoia-v1/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-indigo-900 text-white font-bold text-xs flex items-center gap-1 hover:bg-indigo-950"
            >
              <span>Tela Cheia</span>
              <ExtIcon className="w-3 h-3" />
            </a>
          </div>
          <iframe
            src="/fiscoia-v1/index.html"
            title="FISCOIA Oficial"
            className="w-full h-[750px] rounded-2xl border border-slate-200 shadow-inner"
          />
        </div>
      )}

      {abaModulo === 'rascunho' && (
        <EmissaoNotaFiscalModulo
          certificado={certificado}
          empresaEmitente={empresaAtiva ? {
            razaoSocial: empresaAtiva.razaoSocial,
            cnpj: empresaAtiva.cnpj,
            inscricaoEstadual: empresaAtiva.inscricaoEstadual,
            endereco: empresaAtiva.endereco || empresaAtiva.logradouro,
            uf: empresaAtiva.uf
          } : null}
          onIrParaCertificado={() => setAbaModulo('certificado')}
          onFalar={falarTexto}
        />
      )}

      {abaModulo === 'chat' && (
        <>
          {/* Card de Atalho para Conexão Oficial e Certificado */}
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Certificado digital · referência local</span>
              </div>
              <p className="text-xs text-slate-200">
                {certificado
                  ? `Referência cadastrada para ${certificado.razao} (${certificado.cnpj}). Arquivo, validade e conexão oficial não foram verificados.`
                  : 'O cadastro de referência não envia nem valida o arquivo e não conecta com SERPRO, e-CAC ou Receita Federal.'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setAbaModulo('certificado')}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{certificado ? 'Ver referência local' : 'Cadastrar referência'}</span>
              </button>
              <a
                href="/fiscoia-v1/index.html"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Abrir fiscoia-v1</span>
                <ExtIcon className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Barra de Controles de Voz do Dr. Benny Gonçalves */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-3 sm:p-4 text-white shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMicrofone}
            disabled={!vozSuportada || pensando}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm ${
              ouvindo
                ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse ring-4 ring-rose-400/40'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold'
            } disabled:opacity-50`}
            title={ouvindo ? 'Clique para parar de falar' : 'Clique e fale com o Dr. Benny Gonçalves'}
          >
            {ouvindo ? <Mic className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <div>
            <div className="text-xs font-bold flex items-center gap-1.5">
              <span>{ouvindo ? 'Dr. Benny está ouvindo você...' : falando ? 'Dr. Benny está falando com voz masculina (1.15x)...' : 'Fale com o Dr. Benny Gonçalves (Voz Masculina)'}</span>
              {ouvindo && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300 flex items-center gap-1.5 flex-wrap">
              <span>{ouvindo 
                ? 'Pode falar sua dúvida fiscal agora...' 
                : falando
                ? 'Ouvindo a resposta do Dr. Benny Gonçalves...'
                : 'Clique no microfone para falar com o Dr. Benny'}</span>
              {nomeVozAtiva && (
                <span className="text-[10px] px-1.5 py-0.2 bg-indigo-950 text-amber-300 rounded font-mono border border-indigo-700/50">
                  {nomeVozAtiva}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Alternadores: Conversa Contínua, Teste de Voz, Velocidade e Áudio */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          {/* Controle de Velocidade da Voz (Adiantar fala) */}
          <div className="flex items-center bg-indigo-950/70 border border-indigo-700/60 rounded-xl px-2 py-1 gap-1.5 text-xs">
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] text-slate-300 font-medium hidden sm:inline">Velocidade:</span>
            <div className="flex items-center gap-1">
              {[
                { label: 'Normal', val: 1.0 },
                { label: 'Dr. Benny (1.15x)', val: 1.15 },
                { label: 'Rápida', val: 1.30 }
              ].map((opcao) => (
                <button
                  key={opcao.label}
                  type="button"
                  onClick={() => setVelocidade(opcao.val)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                    Math.abs(velocidade - opcao.val) < 0.06
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-indigo-900/60'
                  }`}
                  title={`Definir ritmo de fala para ${opcao.label} (${opcao.val}x)`}
                >
                  {opcao.label}
                </button>
              ))}
            </div>
          </div>

          {/* Botão de Testar Voz Dr. Benny */}
          <button
            type="button"
            onClick={() => testarVozDrBeni()}
            disabled={falando}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-950 hover:bg-indigo-900 text-amber-300 border border-indigo-700 flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Clique para testar a voz masculina do Dr. Benny Gonçalves agora"
          >
            <Play className="w-3 h-3 text-amber-400" />
            <span>Testar Voz Dr. Benny</span>
          </button>

          {/* Botão de Diálogo Contínuo */}
          <button
            type="button"
            onClick={() => setModoVozContinuo(!modoVozContinuo)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              modoVozContinuo
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'bg-indigo-950/70 border border-indigo-700/60 text-slate-200 hover:bg-indigo-950'
            }`}
            title="Quando ativado, o Dr. Benny responde falando e já reabre o microfone para você continuar a conversa"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{modoVozContinuo ? 'Diálogo Contínuo: LIGADO' : 'Diálogo Contínuo: DESLIGADO'}</span>
          </button>

          {/* Botão de Áudio do Dr. Benny */}
          <button
            type="button"
            onClick={() => {
              if (falando) pararFala();
              setRespostaAudioAtiva(!respostaAudioAtiva);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              respostaAudioAtiva
                ? 'bg-indigo-950/90 border border-indigo-600 text-amber-300'
                : 'bg-indigo-950/50 border border-indigo-800 text-slate-400 hover:text-white'
            }`}
            title={respostaAudioAtiva ? 'Dr. Benny fala a resposta (Voz masculina 1.15x ativa)' : 'Dr. Benny não fala a resposta (Apenas texto)'}
          >
            {respostaAudioAtiva ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{respostaAudioAtiva ? 'Voz: Ativa' : 'Voz: Mudo'}</span>
          </button>

          {falando && (
            <button
              type="button"
              onClick={pararFala}
              className="px-2.5 py-1 rounded-lg bg-rose-500/80 hover:bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
            >
              Parar Fala
            </button>
          )}
        </div>
      </div>

      {/* Aviso de erro ou não suporte do microfone */}
      {erroVoz && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <span>{erroVoz}</span>
          <button
            type="button"
            onClick={() => toggleMicrofone()}
            className="font-bold underline text-rose-900 cursor-pointer ml-2"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Transcrição em tempo real enquanto o usuário fala */}
      {ouvindo && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-center gap-2 animate-pulse">
          <Mic className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="flex-1">
            <span className="font-bold">Ouvindo você:</span>{' '}
            <span className="italic">{transcricaoParcial || 'Fale sua dúvida com o Dr. Benny Gonçalves...'}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (transcricaoParcial.trim()) {
                enviarPergunta(transcricaoParcial.trim());
              } else {
                pararEscuta();
              }
            }}
            className="px-2 py-1 bg-amber-600 text-white rounded text-[11px] font-bold hover:bg-amber-700 cursor-pointer"
          >
            {transcricaoParcial.trim() ? 'Enviar Agora' : 'Cancelar'}
          </button>
        </div>
      )}

      {/* Caixa de Sugestões Rápidas */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Consultas Oficiais — Dr. Benny Gonçalves</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {sugestoes.map((sug, i) => (
            <button
              key={i}
              type="button"
              disabled={pensando || ouvindo}
              onClick={() => enviarPergunta(sug)}
              className="text-xs px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-900 hover:bg-indigo-50/50 transition-colors text-left cursor-pointer disabled:opacity-50"
            >
              {sug}
            </button>
          ))}
        </div>
      </div>

      {/* Área de Mensagens do Chat */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col h-[520px] justify-between">
        <div ref={chatScrollRef} className="overflow-y-auto space-y-4 pr-1">
          {mensagens.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.autor === 'usuario' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.autor === 'ia' && (
                <div className="w-8 h-8 rounded-full bg-indigo-950 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[88%] rounded-2xl p-4 text-xs space-y-2 ${
                  msg.autor === 'usuario'
                    ? 'bg-indigo-700 text-white rounded-tr-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-xs shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-4 text-[10px] opacity-80 pb-1 border-b border-black/5">
                  <span className="font-bold flex items-center gap-1">
                    {msg.autor === 'usuario' ? 'Você (Áudio/Texto)' : 'Dr. Benny Gonçalves • FIASCO IA'}
                  </span>
                  <div className="flex items-center gap-2">
                    {msg.autor === 'ia' && (
                      <button
                        type="button"
                        onClick={() => falarTexto(msg.texto)}
                        className="opacity-70 hover:opacity-100 hover:text-indigo-700 flex items-center gap-0.5 cursor-pointer"
                        title="Ouvir esta resposta com voz do Dr. Benny"
                      >
                        <Volume2 className="w-3 h-3 text-indigo-600" />
                        <span>Ouvir Voz</span>
                      </button>
                    )}
                    <span>{msg.timestamp}</span>
                  </div>
                </div>

                <div className="leading-relaxed whitespace-pre-wrap font-sans text-[12px] space-y-1">
                  {msg.texto}
                </div>

                {!!msg.acoes?.length && msg.acoes.map((a) => (
                  <div key={a.id} className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-slate-800">
                    <div className="text-[12px] font-bold">{a.titulo}</div>
                    {a.descricao.map((d, i) => <div key={i} className="text-[11px] mt-0.5">{d}</div>)}
                    {a.aviso && <div className="text-[11px] mt-1 font-semibold text-amber-800">{a.aviso}</div>}
                    {a.estado === 'pendente' && (
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => confirmarAcaoAgente(a.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1 rounded cursor-pointer">Confirmar</button>
                        <button type="button" onClick={() => recusarAcaoAgente(a.id)} className="bg-white border border-slate-300 text-slate-700 text-[11px] font-semibold px-3 py-1 rounded cursor-pointer">Cancelar</button>
                      </div>
                    )}
                    {a.estado === 'executando' && <div className="mt-2 text-[11px] font-semibold">Executando…</div>}
                    {a.estado === 'confirmada' && <div className="mt-2 text-[11px] font-bold text-emerald-700">Confirmada: {a.resultado}</div>}
                    {a.estado === 'falhou' && <div className="mt-2 text-[11px] font-bold text-rose-700">Não foi feito: {a.resultado}</div>}
                    {a.estado === 'recusada' && <div className="mt-2 text-[11px] font-semibold text-slate-500">Cancelada.</div>}
                  </div>
                ))}

                {/* Registro da consulta e fontes que a API realmente retornou */}
                {msg.autor === 'ia' && (
                  <div className="pt-2 border-t border-slate-200/80 space-y-1 text-[11px]">
                    {msg.referencia && (
                      <div className="font-bold text-indigo-900 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span>Fonte / status: {msg.referencia}</span>
                      </div>
                    )}

                    {msg.fontesWeb && msg.fontesWeb.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Fontes encontradas:</span>
                        {msg.fontesWeb.map((f, idx) => (
                          <a
                            key={idx}
                            href={f.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-700 hover:text-indigo-950 underline font-medium"
                          >
                            <span>{f.title}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {pensando && (
            <div className="flex gap-3 justify-start items-center text-xs text-slate-500 italic">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-indigo-100 flex items-center gap-2 text-indigo-900">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Dr. Benny Gonçalves está consultando a legislação e formulando a resposta...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input de Envio com Microfone Integrado */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviarPergunta(inputTexto);
          }}
          className="pt-3 border-t border-slate-100 flex items-center gap-2"
        >
          {/* Botão de Microfone direto na barra de input */}
          <button
            type="button"
            onClick={toggleMicrofone}
            disabled={pensando}
            className={`p-3 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              ouvindo
                ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-400'
                : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
            } disabled:opacity-50`}
            title={ouvindo ? 'Parar gravação' : 'Falar com o Dr. Benny pelo microfone'}
          >
            {ouvindo ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={inputTexto}
            disabled={pensando}
            onChange={(e) => setInputTexto(e.target.value)}
            placeholder={ouvindo ? 'Ouvindo sua voz...' : 'Digite sua dúvida ou use o microfone para falar com o Dr. Benny Gonçalves...'}
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-2xl text-xs outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all font-medium"
          />

          <button
            type="submit"
            disabled={!inputTexto.trim() || pensando}
            className="px-5 py-3 bg-indigo-900 hover:bg-indigo-950 active:scale-98 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm transition-all shrink-0"
          >
            <Send className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </form>
      </div>
      </>
      )}
    </div>
  );
}
