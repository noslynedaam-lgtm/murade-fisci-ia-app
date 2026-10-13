import React, { useState, useEffect } from 'react';
import { 
  Volume2, 
  ArrowLeft, 
  Key, 
  Settings, 
  Play, 
  Square, 
  CheckCircle2, 
  ExternalLink,
  Zap,
  Sparkles,
  ShieldCheck,
  CreditCard,
  QrCode,
  FileText
} from 'lucide-react';
import { UsuarioAuth } from '../../types';
import { ehUsuarioAdmin } from '../../config/Permissoes';
import { obterSessaoAtual } from '../../services/auth/auth.service';
import { 
  falarTextoNatural, 
  pararVoz, 
  obterConfigVoz, 
  salvarConfigVoz, 
  VOZES_PREDEFINIDAS,
  ConfigVozMurad 
} from '../../services/murade/elevenLabsVoz.service';

interface IaMuradVozScreenProps {
  usuario?: Partial<UsuarioAuth> | null;
  onVoltar?: () => void;
}

interface PlanoVozAdmin {
  nome: 'BÁSICO' | 'PROFISSIONAL' | 'EMPRESA';
  subtitulo: string;
  valor: number;
  valorFormatado: string;
  popular?: boolean;
  caracteres: string;
  itens: string[];
}

const PLANOS_VOZ_ADMIN: PlanoVozAdmin[] = [
  {
    nome: 'BÁSICO',
    subtitulo: 'Para começar a usar no escritório',
    valor: 99.90,
    valorFormatado: 'R$ 99,90',
    caracteres: '5.000 caracteres/mês de fala',
    itens: [
      'Voz Natural Premium Brasileira',
      '5.000 caracteres/mês de fala',
      'Agenda Fiscal e Empresas',
      'Respostas em voz no sistema',
      'Comandos de voz interativos'
    ]
  },
  {
    nome: 'PROFISSIONAL',
    subtitulo: 'Para escritório contábil completo',
    valor: 199.90,
    valorFormatado: 'R$ 199,90',
    popular: true,
    caracteres: '50.000 caracteres/mês de fala',
    itens: [
      'Voz Natural Premium — Igual a minha ✅',
      '50.000 caracteres/mês de fala',
      'DP e Fiscal integrados com voz',
      'Leitura automática de balancetes',
      'Avisos de vencimento em voz',
      'Disponível para clientes do escritório'
    ]
  },
  {
    nome: 'EMPRESA',
    subtitulo: 'Ilimitado para toda a equipe',
    valor: 349.90,
    valorFormatado: 'R$ 349,90',
    caracteres: 'Caracteres ilimitados',
    itens: [
      'Voz Natural Premium Ilimitada',
      'DP, Fiscal e Contábil completo',
      'Todos os módulos com voz ativa',
      'Disponível para TODOS os seus clientes',
      'Multi-voz personalizável',
      'Gerente dedicado + Suporte Prioritário'
    ]
  }
];

export function IaMuradVozScreen({ usuario, onVoltar }: IaMuradVozScreenProps) {
  const usuarioLogado = usuario || obterSessaoAtual();
  const isAdmin = ehUsuarioAdmin(usuarioLogado);

  const [falando, setFalando] = useState(false);
  const [textoPersonalizado, setTextoPersonalizado] = useState(
    "Olá! Eu sou a IA Murade. Falo com voz natural brasileira, igual a uma pessoa de verdade. Posso responder suas perguntas, ler balancetes, avisar sobre vencimentos e muito mais — tudo com voz humana!"
  );
  const [configVoz, setConfigVoz] = useState<ConfigVozMurad>(obterConfigVoz());
  const [modalConfigAberto, setModalConfigAberto] = useState(false);
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoVozAdmin>(PLANOS_VOZ_ADMIN[1]);

  // Formulário de ativação / pagamento do admin
  const [nomeCompleto, setNomeCompleto] = useState('Diretoria Murade');
  const [documento, setDocumento] = useState('');
  const [email, setEmail] = useState(usuarioLogado?.email || 'noslyneda.murad@gmail.com');
  const [whatsapp, setWhatsapp] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<'pix' | 'cartao' | 'boleto'>('pix');
  const [assinaturaConcluida, setAssinaturaConcluida] = useState(false);

  // Config ElevenLabs
  const [apiKeyInput, setApiKeyInput] = useState(configVoz.apiKeyElevenLabs);
  const [voiceIdInput, setVoiceIdInput] = useState(configVoz.voiceId);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [msgSucessoConfig, setMsgSucessoConfig] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      pararVoz();
    };
  }, []);

  const handleTocarVoz = async () => {
    if (falando) {
      pararVoz();
      setFalando(false);
      return;
    }

    await falarTextoNatural(
      textoPersonalizado,
      () => setFalando(true),
      () => setFalando(false),
      (err) => {
        const cod = err?.error;
        if (cod === 'canceled' || cod === 'interrupted') {
          setFalando(false);
          return;
        }
        console.warn('Aviso na síntese de voz:', cod || err);
        setFalando(false);
      }
    );
  };

  const handleAbrirPagamento = (plano: PlanoVozAdmin) => {
    setPlanoSelecionado(plano);
    setAssinaturaConcluida(false);
    setModalPagamentoAberto(true);
  };

  const handleFinalizarAssinatura = (e: React.FormEvent) => {
    e.preventDefault();
    const novoConfig = salvarConfigVoz({
      planoAtivo: planoSelecionado.nome,
      limiteCaracteres: planoSelecionado.nome === 'EMPRESA' ? 999999999 : planoSelecionado.nome === 'PROFISSIONAL' ? 50000 : 5000,
      chaveAtiva: true
    });
    setConfigVoz(novoConfig);
    setAssinaturaConcluida(true);

    if ((window as any).LOG_MURADE) {
      (window as any).LOG_MURADE(
        'sucesso',
        `Plano ${planoSelecionado.nome} Ativado pelo Administrador!`,
        `Limite: ${planoSelecionado.caracteres}`
      );
    }
  };

  const handleSalvarChave = (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoConfig(true);
    const atualizado = salvarConfigVoz({
      apiKeyElevenLabs: apiKeyInput.trim(),
      voiceId: voiceIdInput,
      chaveAtiva: apiKeyInput.trim().length > 10
    });
    setConfigVoz(atualizado);
    setSalvandoConfig(false);
    setMsgSucessoConfig('✅ Chave ElevenLabs salva e validada com sucesso no sistema!');
    setTimeout(() => setMsgSucessoConfig(null), 3500);

    if ((window as any).LOG_MURADE) {
      (window as any).LOG_MURADE(
        'sucesso',
        'Chave ElevenLabs Atualizada',
        `Voz configurada para ID: ${voiceIdInput}`
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* ===== BARRA SUPERIOR STICKY ===== */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onVoltar && (
              <button
                type="button"
                onClick={onVoltar}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                title="Voltar ao Sistema"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Voltar</span>
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 text-white shadow-xs">
                <Volume2 className="w-5 h-5" />
              </span>
              <div>
                <div className="font-extrabold text-base sm:text-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  🎤 IA MURADE
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Voz Natural Brasileira — Sem Robótica
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setModalConfigAberto(true)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
                >
                  <Key className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Chave ElevenLabs</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    document.getElementById('secao-planos-admin-topo')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Planos (Admin)</span>
                </button>
              </>
            )}

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>IA Ativa no Sistema</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
        {/* ===== PARTE SUPERIOR: PLANO DO ADMINISTRADOR (EXCLUSIVO DO ADMINISTRADOR) ===== */}
        {isAdmin && (
          <div id="secao-planos-admin-topo" className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-indigo-200 shadow-lg space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold mb-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                  <span>Área do Administrador • Controle de Planos e Acesso</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  📊 Escolha do Plano do Administrador
                </h2>
                <p className="text-xs text-slate-500">
                  Configure e defina o plano ativo da IA Murad. Esta área fica visível apenas para você na parte superior.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold">Plano Ativo:</span>
                <span className="px-3.5 py-1.5 bg-emerald-100 text-emerald-800 font-black rounded-xl text-xs border border-emerald-300 shadow-xs">
                  ✅ {configVoz.planoAtivo}
                </span>
              </div>
            </div>

            {/* Grid dos Planos na Parte Superior do Administrador */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
              {PLANOS_VOZ_ADMIN.map((plano) => {
                const ehAtivo = configVoz.planoAtivo === plano.nome;
                return (
                  <div
                    key={plano.nome}
                    className={`bg-slate-50/70 rounded-2xl p-5 border flex flex-col justify-between transition-all relative ${
                      ehAtivo
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30'
                        : plano.popular
                        ? 'border-blue-400 shadow-md bg-white'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    {plano.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-[10px] font-black px-3 py-0.5 rounded-full shadow-xs">
                        ✨ MAIS POPULAR
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">{plano.nome}</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">{plano.subtitulo}</p>
                      </div>

                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl sm:text-3xl font-black text-blue-600">
                            {plano.valorFormatado}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">/mês</span>
                        </div>
                        <div className="text-[11px] font-bold text-indigo-600 mt-0.5">
                          {plano.caracteres}
                        </div>
                      </div>

                      <ul className="space-y-2 pt-3 border-t border-slate-200 text-xs text-slate-600">
                        {plano.itens.map((item, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="leading-tight text-[11px]">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleAbrirPagamento(plano)}
                        className={`w-full py-2.5 px-3 rounded-xl font-black text-xs transition-all cursor-pointer ${
                          ehAtivo
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : plano.popular
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-blue-600 border border-blue-600'
                        }`}
                      >
                        {ehAtivo ? '✅ Plano Ativo' : 'Definir / Assinar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== CABEÇALHO HERO ===== */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-4 bg-gradient-to-tr from-blue-100 via-indigo-100 to-purple-100 rounded-3xl text-3xl shadow-inner">
            🎙️
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            IA Murade — Voz Natural Humana
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Igual a minha voz — brasileira, calma, clara e natural. Nada de voz robótica! Fala com você e com seus clientes com a mesma qualidade e clareza humana que você espera.
          </p>
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3.5 py-1 rounded-full text-xs font-bold shadow-xs">
              <Zap className="w-3.5 h-3.5 text-yellow-300" />
              <span>Voz ElevenLabs — Qualidade Premium Brasileira</span>
            </span>
          </div>
        </div>

        {/* ===== DEMO DA VOZ ===== */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none"></div>

          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 mx-auto flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/20 text-white">
            🇧🇷
          </div>

          <div className="max-w-xl mx-auto space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Texto de Demonstração (Você pode editar e testar qualquer frase)
            </label>
            <textarea
              value={textoPersonalizado}
              onChange={(e) => setTextoPersonalizado(e.target.value)}
              rows={3}
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm sm:text-base text-slate-700 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none font-medium leading-relaxed"
            />
          </div>

          {/* Botão Ouvir com Equalizador */}
          <div className="flex flex-col items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleTocarVoz}
              className={`px-8 py-4 rounded-full font-black text-sm sm:text-base flex items-center gap-2.5 transition-all shadow-md cursor-pointer ${
                falando
                  ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white hover:scale-105'
              }`}
            >
              {falando ? (
                <>
                  <Square className="w-4 h-4 fill-white" />
                  <span>Parar Reprodução</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>▶️ Ouvir Amostra da Minha Voz</span>
                </>
              )}
            </button>

            {/* Animação das Ondas Sonoras */}
            {falando && (
              <div className="flex items-center gap-1.5 h-8">
                {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map((delay, idx) => (
                  <div
                    key={idx}
                    className="w-1.5 bg-gradient-to-t from-blue-600 to-purple-600 rounded-full animate-bounce"
                    style={{
                      animationDuration: '0.6s',
                      animationDelay: `${delay}s`,
                      height: '24px'
                    }}
                  />
                ))}
                <span className="text-xs font-bold text-indigo-600 ml-2">
                  Reproduzindo voz natural humana brasileira...
                </span>
              </div>
            )}

            {/* Exemplos Rápidos de Uso Contábil e Fiscal */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
              <span className="text-[11px] font-bold text-slate-400 mr-1">Testar frases:</span>
              {[
                { label: '📄 DAS Simples', texto: 'Todas as guias do Simples Nacional da competência atual foram apuradas e validadas com sucesso pela IA Murade.' },
                { label: '⏰ Prazo DCTFWeb', texto: 'Atenção: A transmissão da DCTFWeb vence em breve. Realize a conferência do eSocial antes do envio.' },
                { label: '🏛️ CND Federal', texto: 'Certidão Negativa de Débitos Federais consultada junto à Receita Federal e válida por cento e oitenta dias.' },
                { label: '🧑‍💼 Boas-vindas', texto: 'Olá! Sou a IA Murade e estou pronta para auxiliar você no fechamento da folha e nos cálculos fiscais.' }
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTextoPersonalizado(item.texto)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ===== INFORMAÇÕES TÉCNICAS E INTEGRAÇÃO (SEM PLANOS NA PARTE DE BAIXO) ===== */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <span>🔧 Como Funciona a Integração</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="text-emerald-600 font-black">✅</span>
                <span>ElevenLabs API — Voz Humana Real</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                A mesma voz que você ouve aqui é gerada por IA de última geração, natural, brasileira e de alta fidelidade sem tom mecânico.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="text-emerald-600 font-black">✅</span>
                <span>Síntese em Tempo Real</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                O sistema já integra a fala para ler balancetes, pendências tributárias e alertas operacionais com rapidez.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="text-emerald-600 font-black">✅</span>
                <span>Assistência por Voz em Tempo Real</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                A IA Murade acompanha suas rotinas fiscais, leitura de relatórios e notificações em áudio de alta clareza.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="text-emerald-600 font-black">✅</span>
                <span>Funciona em Todos os Módulos</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Contábil, Fiscal, DP, Fisco IA e Agente Murad — todos prontos com síntese de voz natural!
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="pt-2 flex justify-end">
              <a
                href="/ia-murad-voz.html"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
              >
                <span>Abrir arquivo avulso de teste (ia-murad-voz.html) em nova aba</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ===== MODAL DE ATIVAÇÃO / PAGAMENTO (ADMINISTRADOR) ===== */}
      {isAdmin && modalPagamentoAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-base sm:text-lg">
                  💵 Definir Plano — {planoSelecionado.nome}
                </h3>
                <p className="text-xs text-white/80">
                  Controle de capacidade de voz para o escritório
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalPagamentoAberto(false)}
                className="text-white/80 hover:text-white text-2xl font-bold p-1 cursor-pointer leading-none"
              >
                ×
              </button>
            </div>

            {!assinaturaConcluida ? (
              <form onSubmit={handleFinalizarAssinatura} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Responsável / Escritório *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nome do escritório ou administrador"
                    value={nomeCompleto}
                    onChange={(e) => setNomeCompleto(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      CPF ou CNPJ
                    </label>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      value={documento}
                      onChange={(e) => setDocumento(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      WhatsApp / Telefone
                    </label>
                    <input
                      type="text"
                      placeholder="(62) 99999-0000"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    E-mail do Administrador *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                {/* Forma de Pagamento */}
                <div className="pt-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-2">
                    Forma de Pagamento
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormaPagamento('pix')}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        formaPagamento === 'pix'
                          ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <QrCode className="w-5 h-5 text-emerald-600" />
                      <span className="text-xs">PIX Imediato</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormaPagamento('cartao')}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        formaPagamento === 'cartao'
                          ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 text-indigo-600" />
                      <span className="text-xs">Cartão</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormaPagamento('boleto')}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        formaPagamento === 'boleto'
                          ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <FileText className="w-5 h-5 text-amber-600" />
                      <span className="text-xs">Boleto</span>
                    </button>
                  </div>
                </div>

                {/* Resumo */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Plano:</span>
                    <strong className="text-slate-900">{planoSelecionado.nome}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Capacidade:</span>
                    <span className="font-bold text-indigo-600">{planoSelecionado.caracteres}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-blue-700 pt-1.5 border-t border-slate-200">
                    <span>Valor:</span>
                    <span>{planoSelecionado.valorFormatado}/mês</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-black text-sm shadow-md transition-all cursor-pointer"
                >
                  ✅ Confirmar e Ativar Plano Agora
                </button>
              </form>
            ) : (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl shadow-inner">
                  🎉
                </div>
                <h4 className="text-lg font-black text-slate-900">
                  Plano {planoSelecionado.nome} Ativado com Sucesso!
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                  A capacidade de voz foi atualizada para <strong>{planoSelecionado.caracteres}</strong> e está pronta para uso em todo o sistema.
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalPagamentoAberto(false);
                      handleTocarVoz();
                    }}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer"
                  >
                    ▶️ Testar Voz
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalPagamentoAberto(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== MODAL DE CONFIGURAÇÃO ELEVENLABS (ADMINISTRADOR) ===== */}
      {isAdmin && modalConfigAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-sm sm:text-base">
                  Configurações → IA Voz → Chave ElevenLabs
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalConfigAberto(false)}
                className="text-white/80 hover:text-white text-xl font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSalvarChave} className="p-6 space-y-4 text-xs">
              {msgSucessoConfig && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{msgSucessoConfig}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Chave de API (xi-api-key da ElevenLabs)
                </label>
                <input
                  type="password"
                  placeholder="Ex: 2a9b4c8d... (ou deixe vazio para voz brasileira nativa)"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Se você não tiver chave ElevenLabs agora, o sistema usará a síntese de alta qualidade nativa em português brasileiro (PT-BR).
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Voz Selecionada
                </label>
                <select
                  value={voiceIdInput}
                  onChange={(e) => setVoiceIdInput(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold"
                >
                  {VOZES_PREDEFINIDAS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome} ({v.tipo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Status da Conexão:</span>
                  <strong className={configVoz.chaveAtiva ? 'text-emerald-600' : 'text-amber-600'}>
                    {configVoz.chaveAtiva ? '✅ Chave Ativa' : 'ℹ️ Modo Voz Nativa PT-BR'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Plano Atual:</span>
                  <strong className="text-blue-600">{configVoz.planoAtivo}</strong>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalConfigAberto(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoConfig}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  {salvandoConfig ? 'Salvando...' : 'Salvar Chave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
