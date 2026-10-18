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

export function IaMuradVozScreen({ usuario, onVoltar }: IaMuradVozScreenProps) {
  const usuarioLogado = usuario || obterSessaoAtual();
  const isAdmin = ehUsuarioAdmin(usuarioLogado);

  const [falando, setFalando] = useState(false);
  const [textoPersonalizado, setTextoPersonalizado] = useState(
    "Esta é uma demonstração de síntese de voz. Nenhuma consulta fiscal foi realizada."
  );
  const [configVoz, setConfigVoz] = useState<ConfigVozMurad>(obterConfigVoz());
  const [modalConfigAberto, setModalConfigAberto] = useState(false);

  // Config ElevenLabs
  const [voiceIdInput, setVoiceIdInput] = useState(configVoz.voiceId);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [msgSucessoConfig, setMsgSucessoConfig] = useState<string | null>(null);
  const [elevenLabsConfigurado, setElevenLabsConfigurado] = useState<boolean | null>(null);
  const [avisoReproducao, setAvisoReproducao] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/voz/health').then(res => res.ok ? res.json() : null)
      .then((status: { provedorConfigurado?: boolean } | null) => setElevenLabsConfigurado(status?.provedorConfigurado ?? false))
      .catch(() => setElevenLabsConfigurado(false));
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

    setAvisoReproducao(null);
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
        setAvisoReproducao('ElevenLabs não conseguiu gerar o áudio. O navegador pode usar a voz local como alternativa.');
        setFalando(false);
      }
    );
  };

  const handleSalvarChave = (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoConfig(true);
    const atualizado = salvarConfigVoz({ voiceId: voiceIdInput });
    setConfigVoz(atualizado);
    setSalvandoConfig(false);
    setMsgSucessoConfig('Preferência de voz salva neste navegador. A chave ElevenLabs, se configurada, deve ficar somente no servidor.');
    setTimeout(() => setMsgSucessoConfig(null), 3500);

    if ((window as any).LOG_MURADE) {
      (window as any).LOG_MURADE(
        'sucesso',
        'Preferência de voz atualizada',
        `Voz selecionada: ${voiceIdInput}. Nenhuma chave foi enviada ou validada.`
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
                  <span className="hidden sm:inline">Configurar voz</span>
                </button>

              </>
            )}

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>{elevenLabsConfigurado === null ? 'Verificando voz...' : elevenLabsConfigurado ? 'ElevenLabs configurado no servidor' : 'Voz local do navegador; ElevenLabs não configurado'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
        {isAdmin && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            Planos pagos e checkout de voz não estão disponíveis. Nenhum pagamento, assinatura ou limite é ativado nesta tela.
          </div>
        )}

        {/* ===== CABEÇALHO HERO ===== */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-4 bg-gradient-to-tr from-blue-100 via-indigo-100 to-purple-100 rounded-3xl text-3xl shadow-inner">
            🎙️
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            IA Murade — Demonstração de voz
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Teste a síntese de fala do navegador. A voz premium só funciona quando o provedor está configurado no servidor.
          </p>
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3.5 py-1 rounded-full text-xs font-bold shadow-xs">
              <Zap className="w-3.5 h-3.5 text-yellow-300" />
              <span>{elevenLabsConfigurado ? 'ElevenLabs no servidor' : 'Síntese local do navegador'}</span>
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
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
              Se ElevenLabs estiver configurado, este texto será enviado ao provedor para gerar áudio. Não digite informações fiscais ou pessoais de clientes.
            </p>
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
                  <span>Ouvir amostra de voz</span>
                </>
              )}
            </button>
            {avisoReproducao && <p role="status" className="text-xs text-amber-800">{avisoReproducao}</p>}

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
                  Reproduzindo fala gerada por {elevenLabsConfigurado ? 'ElevenLabs' : 'síntese do navegador'}...
                </span>
              </div>
            )}

            {/* Exemplos Rápidos de Uso Contábil e Fiscal */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
              <span className="text-[11px] font-bold text-slate-400 mr-1">Testar frases:</span>
              {[
                { label: 'Demonstração fiscal', texto: 'Demonstração de voz: nenhuma guia ou situação fiscal foi consultada.' },
                { label: 'Demonstração de prazo', texto: 'Demonstração de voz: confira os vencimentos no portal oficial antes de agir.' },
                { label: 'Demonstração de certidão', texto: 'Demonstração de voz: nenhuma certidão foi emitida ou consultada.' },
                { label: 'Boas-vindas', texto: 'Olá. Esta tela testa a reprodução de voz e não consulta dados fiscais.' }
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
                <span>ElevenLabs via servidor (opcional)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                A chave fica no servidor. Se ELEVENLABS_API_KEY não estiver configurada, a demonstração usa a síntese de voz disponível no navegador.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="text-emerald-600 font-black">✅</span>
                <span>Reprodução de amostra</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Esta tela converte apenas o texto digitado em áudio. Ela não lê balancetes nem acompanha pendências automaticamente.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="text-emerald-600 font-black">✅</span>
                <span>Fala de respostas da assistente</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                A integração com respostas da assistente ainda não está conectada nesta tela.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="text-emerald-600 font-black">✅</span>
                <span>Integração com os módulos</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Fiscal, Contábil e Departamento Pessoal ainda não enviam automaticamente textos para esta demonstração.
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

      {/* ===== MODAL DE CONFIGURAÇÃO ELEVENLABS (ADMINISTRADOR) ===== */}
      {isAdmin && modalConfigAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-sm sm:text-base">
                  Configurações de voz
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

              <p className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px]">
                Não informe chave secreta nesta tela. Para habilitar ElevenLabs, configure ELEVENLABS_API_KEY como variável de ambiente no servidor Render. Sem essa configuração, o sistema usa a síntese local do navegador.
              </p>

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
                  <strong className={elevenLabsConfigurado ? 'text-emerald-600' : 'text-amber-600'}>
                    {elevenLabsConfigurado === null ? 'Verificando servidor' : elevenLabsConfigurado ? 'ElevenLabs configurado no servidor' : 'Voz local; provedor não configurado'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Preferência salva:</span>
                  <strong className="text-blue-600">neste navegador</strong>
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
                  {salvandoConfig ? 'Salvando...' : 'Salvar preferência de voz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
