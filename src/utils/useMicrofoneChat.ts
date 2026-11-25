// Microfone dos chats em React (igual nos 5 sistemas Murad): um clique liga, para sozinho no silêncio e envia,
// clique de novo envia na hora, texto parcial na caixa, sem eco da assistente. Ver utils/microfoneChat.ts.
import { useEffect, useRef, useState } from 'react';
import { criarMicrofone, type Microfone } from './microfoneChat';
import { humanaFalando, pararHumana } from './vozHumana';

export interface OpcoesUseMicrofone {
  aoParcial?: (texto: string) => void;
  aoEnviar: (texto: string) => void;
  aoErro?: (mensagem: string, codigo: string) => void;
  aoMudarEstado?: (ouvindo: boolean) => void;
  /** Além de calar a assistente: o que mais parar antes de ouvir (ex.: outra voz da tela). */
  antesDeOuvir?: () => void;
}

export function useMicrofoneChat(op: OpcoesUseMicrofone): { ouvindo: boolean; alternar: () => void; ligar: () => boolean; parar: (enviar?: boolean) => void } {
  const opRef = useRef(op);
  opRef.current = op;
  const [ouvindo, setOuvindo] = useState(false);
  const micRef = useRef<Microfone | null>(null);
  if (!micRef.current) {
    micRef.current = criarMicrofone({
      aoMudarEstado: (o) => { setOuvindo(o); opRef.current.aoMudarEstado?.(o); },
      aoParcial: (t) => opRef.current.aoParcial?.(t),
      aoEnviar: (t) => opRef.current.aoEnviar(t),
      aoErro: (m, c) => opRef.current.aoErro?.(m, c),
      // Sem eco: a assistente para de falar quando a pessoa clica no microfone (o clique também a interrompe).
      antesDeOuvir: () => {
        try { window.speechSynthesis?.cancel(); } catch { /* ignora */ }
        pararHumana();
        opRef.current.antesDeOuvir?.();
      },
      assistenteFalando: () => humanaFalando(),
    });
  }
  useEffect(() => () => { micRef.current?.destruir(); }, []);
  return {
    ouvindo,
    alternar: () => micRef.current?.alternar(),
    ligar: () => micRef.current?.ligar() ?? false,
    parar: (enviar?: boolean) => micRef.current?.parar(enviar),
  };
}
