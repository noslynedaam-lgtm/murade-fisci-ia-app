import { useState, useEffect, useRef, useCallback } from 'react';
import { falarRespostasLigado } from '../utils/agenteParar';
import { aplicarVozNatural, assinarVozes, humanaFalando, pararHumana, textoParaFala, vozDaAssistenteAgora, vozesDaAssistente } from '../utils/vozHumana';
import { criarMicrofone, microfoneSuportado, type Microfone } from '../utils/microfoneChat';

// Declaração de tipos para Web Speech API
interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
    length: number;
  };
  resultIndex: number;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface WebSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

interface UseVozProps {
  onTextoReconhecido?: (texto: string) => void;
  onFalaFinalizada?: () => void;
  lingua?: string;
  velocidadeInicial?: number;
}

export function useVoz({
  onTextoReconhecido,
  onFalaFinalizada,
  lingua = 'pt-BR',
  velocidadeInicial = 1.0,
}: UseVozProps = {}) {
  const [ouvindo, setOuvindo] = useState(false);
  const [falando, setFalando] = useState(false);
  const [suportado, setSuportado] = useState(true);
  const [transcricaoParcial, setTranscricaoParcial] = useState('');
  const [erroVoz, setErroVoz] = useState<string | null>(null);

  // Controle de velocidade dinâmica configurável (padrão normal: 1.0)
  const [velocidade, setVelocidade] = useState<number>(velocidadeInicial);

  // Lista de vozes e voz ativa masculina Fisco IA
  const [vozesDisponiveis, setVozesDisponiveis] = useState<SpeechSynthesisVoice[]>([]);
  const [nomeVozAtiva, setNomeVozAtiva] = useState<string>('');

  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const isStartedRef = useRef(false);

  // Callbacks refs para sempre terem a versão mais recente sem recriar eventos
  const onTextoReconhecidoRef = useRef(onTextoReconhecido);
  onTextoReconhecidoRef.current = onTextoReconhecido;

  const onFalaFinalizadaRef = useRef(onFalaFinalizada);
  onFalaFinalizadaRef.current = onFalaFinalizada;

  const velocidadeRef = useRef(velocidade);
  velocidadeRef.current = velocidade;

  // Vozes em português do aparelho e a voz em uso: a mesma "Voz da assistente" de todos os sistemas
  // (a mais natural do aparelho, ou a que a pessoa escolheu). Nunca voz de outro idioma.
  const carregarVozesMasculinas = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    setVozesDisponiveis(vozesDaAssistente());
    const voz = vozDaAssistenteAgora();
    if (voz) setNomeVozAtiva(voz.name);
  }, []);

  // Carregar vozes do navegador com listener onvoiceschanged
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      carregarVozesMasculinas();
      // As vozes chegam com atraso: atualiza quando o navegador avisar ou quando a pessoa escolher outra.
      return assinarVozes(carregarVozesMasculinas);
    }
    return undefined;
  }, [carregarVozesMasculinas]);

  // Microfone (igual nos 5 sistemas): um clique liga, texto parcial enquanto fala, o silêncio (Configurações de voz,
  // padrão 2,5 s) desliga e envia; clicar de novo envia na hora; religa se o navegador cortar antes; sem eco da voz.
  const micRef = useRef<Microfone | null>(null);
  if (!micRef.current) {
    micRef.current = criarMicrofone({
      lingua,
      aoMudarEstado: (o) => {
        isStartedRef.current = o;
        setOuvindo(o);
        if (o) setErroVoz(null); else setTranscricaoParcial('');
      },
      aoParcial: (texto) => setTranscricaoParcial(texto),
      aoEnviar: (texto) => { onTextoReconhecidoRef.current?.(texto.trim()); },
      aoErro: (mensagem) => setErroVoz(mensagem),
      antesDeOuvir: () => {
        try { window.speechSynthesis?.cancel(); } catch { /* ignora */ }
        pararHumana();
        setFalando(false);
      },
      assistenteFalando: () => humanaFalando(),
    });
  }

  useEffect(() => {
    setSuportado(microfoneSuportado());
    return () => {
      micRef.current?.destruir();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Iniciar escuta (um clique). O parâmetro antigo de "manter conversa" continua aceito: cada escuta é uma pergunta.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const iniciarEscuta = useCallback((_manterConversa = false) => {
    setErroVoz(null);
    micRef.current?.ligar();
  }, []);

  // Parar escuta. enviar=true: envia o que já foi dito (segundo clique no microfone).
  const pararEscuta = useCallback((enviar = false) => {
    micRef.current?.parar(enviar);
  }, []);

  // Sintetizar voz masculina — velocidade configurada pelo usuário.
  const falarTexto = useCallback((texto: string, callbackFinal?: () => void) => {
    // "Falar as respostas" desligado (configuração da Agente): só o texto aparece.
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !falarRespostasLigado()) {
      if (callbackFinal) callbackFinal();
      return;
    }

    // Cancelar fala anterior
    window.speechSynthesis.cancel();

    // Sem markdown, emojis e links; valores em reais, datas e siglas do jeito que se fala.
    const textoLimpo = textoParaFala(texto);

    if (!textoLimpo) {
      if (callbackFinal) callbackFinal();
      return;
    }

    try {
      const fala = new SpeechSynthesisUtterance();
      fala.text = textoLimpo;
      // Mesma voz natural da Agente (a mais natural do aparelho ou a escolhida em "Voz da assistente"), tom 1,0.
      aplicarVozNatural(fala);
      fala.volume = 1;
      // Usa a velocidade selecionada no controle de voz.
      fala.rate = velocidadeRef.current || 1.0;

      fala.onstart = () => {
        setFalando(true);
      };

      fala.onend = () => {
        setFalando(false);
        if (callbackFinal) callbackFinal();
        if (onFalaFinalizadaRef.current) onFalaFinalizadaRef.current();
      };

      fala.onerror = (e) => {
        console.warn('Aviso no sintetizador de voz:', e);
        setFalando(false);
        if (callbackFinal) callbackFinal();
        if (onFalaFinalizadaRef.current) onFalaFinalizadaRef.current();
      };

      // Desbloqueia fila e fala
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(fala);
    } catch (err) {
      console.error('Erro ao falar texto:', err);
      setFalando(false);
      if (callbackFinal) callbackFinal();
    }
  }, []);

  // Parar fala
  const pararFala = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setFalando(false);
  }, []);

  // Testar voz do Fisco IA ao vivo com a velocidade calibrada
  const testarVozDrBenny = useCallback((textoPersonalizado?: string) => {
    falarTexto(
      textoPersonalizado ||
      'Olá, quem fala é o Fisco IA. O que você deseja?'
    );
  }, [falarTexto]);

  return {
    ouvindo,
    falando,
    suportado,
    transcricaoParcial,
    erroVoz,
    nomeVozAtiva,
    velocidade,
    setVelocidade,
    iniciarEscuta,
    pararEscuta,
    falarTexto,
    pararFala,
    testarVozDrBenny,
    // Retrocompatibilidade
    testarVozDrBeni: testarVozDrBenny,
    testarVozFeminina: testarVozDrBenny,
  };
}
