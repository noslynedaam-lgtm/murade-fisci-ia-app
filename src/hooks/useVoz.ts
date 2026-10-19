import { useState, useEffect, useRef, useCallback } from 'react';

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

  // Lista de vozes e voz ativa masculina Dr. Benny Gonçalves
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

  // Função para selecionar a melhor voz MASCULINA em português (Dr. Benny Gonçalves)
  const carregarVozesMasculinas = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const vozes = window.speechSynthesis.getVoices();
    if (!vozes || vozes.length === 0) return;

    // Filtra vozes em português
    const vozesPt = vozes.filter(
      (v) =>
        v.lang.toLowerCase() === 'pt-br' ||
        v.lang.toLowerCase().replace('_', '-') === 'pt-br' ||
        v.lang.toLowerCase().startsWith('pt')
    );

    setVozesDisponiveis(vozesPt.length > 0 ? vozesPt : vozes);

    // Prioridade para vozes masculinas naturais em português (Dr. Benny)
    const vozMasculina = vozesPt.find((v) => {
      const n = v.name.toLowerCase();
      return (
        n.includes('daniel') ||
        n.includes('felipe') ||
        n.includes('antonio') ||
        n.includes('rodrigo') ||
        n.includes('ricardo') ||
        n.includes('thiago') ||
        n.includes('male') ||
        n.includes('masculin') ||
        n.includes('homem') ||
        (n.includes('google') && n.includes('pt-br')) ||
        (n.includes('microsoft') && n.includes('pt-br') && !n.includes('maria') && !n.includes('francisca') && !n.includes('heloisa'))
      );
    }) || vozesPt[0];

    if (vozMasculina) {
      setNomeVozAtiva(vozMasculina.name);
    } else if (vozesPt.length > 0) {
      setNomeVozAtiva(vozesPt[0].name);
    }
  }, []);

  // Carregar vozes do navegador com listener onvoiceschanged
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      carregarVozesMasculinas();
      window.speechSynthesis.onvoiceschanged = () => {
        carregarVozesMasculinas();
      };
    }
  }, [carregarVozesMasculinas]);

  // Inicializar Web Speech API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const windowWithSpeech = window as any;
      const SpeechRecognition =
        windowWithSpeech.SpeechRecognition ||
        windowWithSpeech.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setSuportado(false);
      } else {
        try {
          const rec: WebSpeechRecognition = new SpeechRecognition();
          rec.continuous = false;
          rec.interimResults = true;
          rec.lang = lingua;

          rec.onstart = () => {
            isStartedRef.current = true;
            setOuvindo(true);
            setErroVoz(null);
          };

          rec.onresult = (event: SpeechRecognitionEventLike) => {
            let resultadoFinal = '';
            let resultadoIntermediario = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                resultadoFinal += event.results[i][0].transcript;
              } else {
                resultadoIntermediario += event.results[i][0].transcript;
              }
            }

            const textoAtual = resultadoFinal || resultadoIntermediario;
            setTranscricaoParcial(textoAtual);

            if (resultadoFinal && onTextoReconhecidoRef.current) {
              onTextoReconhecidoRef.current(resultadoFinal.trim());
            }
          };

          rec.onerror = (event: SpeechRecognitionErrorEventLike) => {
            console.warn('Evento onerror do SpeechRecognition:', event.error);
            isStartedRef.current = false;
            setOuvindo(false);

            if (event.error === 'aborted' || event.error === 'no-speech') {
              setErroVoz(null);
              return;
            }

            if (event.error === 'not-allowed') {
              setErroVoz('Permissão de microfone negada. Clique no ícone de permissões ao lado da barra de endereço e permita o microfone.');
            } else if (event.error === 'audio-capture') {
              setErroVoz('Nenhum microfone foi detectado no seu dispositivo.');
            } else if (event.error === 'network') {
              setErroVoz('Erro de conexão do microfone com o navegador.');
            } else {
              setErroVoz(`Aviso de voz: ${event.error}`);
            }
          };

          rec.onend = () => {
            isStartedRef.current = false;
            setOuvindo(false);
            setTranscricaoParcial('');
          };

          recognitionRef.current = rec;
        } catch (e) {
          console.error('Falha ao instanciar SpeechRecognition:', e);
          setSuportado(false);
        }
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [lingua]);

  // Iniciar escuta
  const iniciarEscuta = useCallback((manterConversa = false) => {
    setErroVoz(null);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    }
    setFalando(false);

    if (!recognitionRef.current) {
      setErroVoz('Reconhecimento de voz não suportado neste navegador. Recomendamos o Google Chrome.');
      return;
    }

    try {
      if (isStartedRef.current) {
        return;
      }
      recognitionRef.current.start();
    } catch (err: any) {
      try {
        recognitionRef.current.stop();
      } catch {}
      isStartedRef.current = false;
      setTimeout(() => {
        try {
          recognitionRef.current?.start();
        } catch (e) {}
      }, 200);
    }
  }, []);

  // Parar escuta
  const pararEscuta = useCallback(() => {
    if (recognitionRef.current && isStartedRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    isStartedRef.current = false;
    setOuvindo(false);
  }, []);

  // Sintetizar voz masculina — velocidade configurada pelo usuário.
  const falarTexto = useCallback((texto: string, callbackFinal?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (callbackFinal) callbackFinal();
      return;
    }

    // Cancelar fala anterior
    window.speechSynthesis.cancel();

    // Limpar texto de Markdown e símbolos
    const textoLimpo = texto
      .replace(/#{1,6}\s?/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\$\$?[^$]+\$\$?/g, '')
      .replace(/[-*•]\s+/g, '')
      .replace(/_{1,2}/g, '')
      .replace(/>\s?/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    if (!textoLimpo) {
      if (callbackFinal) callbackFinal();
      return;
    }

    try {
      const fala = new SpeechSynthesisUtterance();
      fala.text = textoLimpo;
      fala.lang = 'pt-BR';
      fala.volume = 1;
      // Usa a velocidade selecionada no controle de voz.
      fala.rate = velocidadeRef.current || 1.0;
      fala.pitch = 0.96; // Tom masculino firme e seguro (Dr. Beni Gonçalves)

      // Selecionar voz masculina no banco de vozes
      const vozes = window.speechSynthesis.getVoices();
      const vozesPt = vozes.filter(
        (v) =>
          v.lang.toLowerCase() === 'pt-br' ||
          v.lang.toLowerCase().replace('_', '-') === 'pt-br' ||
          v.lang.toLowerCase().startsWith('pt')
      );

      // Prioriza voz masculina (Dr. Beni)
      const vozMasculina = vozesPt.find((v) => {
        const n = v.name.toLowerCase();
        return (
          n.includes('daniel') ||
          n.includes('felipe') ||
          n.includes('antonio') ||
          n.includes('rodrigo') ||
          n.includes('ricardo') ||
          n.includes('thiago') ||
          n.includes('male') ||
          n.includes('masculin') ||
          n.includes('homem') ||
          (n.includes('google') && n.includes('pt-br')) ||
          (n.includes('microsoft') && n.includes('pt-br') && !n.includes('maria') && !n.includes('francisca') && !n.includes('heloisa'))
        );
      }) || vozesPt[0];

      if (vozMasculina) {
        fala.voice = vozMasculina;
      }

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

  // Testar voz do Dr. Benny Gonçalves ao vivo com a velocidade calibrada
  const testarVozDrBenny = useCallback((textoPersonalizado?: string) => {
    falarTexto(
      textoPersonalizado ||
      'Olá, eu sou o Dr. Benny Gonçalves. O que deseja?'
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
