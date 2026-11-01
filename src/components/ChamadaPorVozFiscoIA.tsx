import { useEffect, useRef, useState } from 'react';

/**
 * Assistente só por voz do Fisco IA. Diga "Fisco" (ou "Fisco IA") e peça.
 * Responde em voz e mostra um aviso rápido. Ações que precisam de confirmação aparecem no aviso
 * e são confirmadas na tela, nunca por voz.
 */
const limparTextoVoz = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const COMANDO_PARAR = /^(para|pare|parar|espera|espere|calma|silencio|cancela|cancelar|chega)( ja| agora| ai| por favor)?$/;

export default function ChamadaPorVozFiscoIA() {
  const [ligada, setLigada] = useState<boolean>(() => {
    try { return localStorage.getItem('murade_chamada_voz') !== '0'; } catch { return false; }
  });
  const [aviso, setAviso] = useState('');
  const [suporta] = useState<boolean>(() => typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  const tempoAvisoRef = useRef<number | undefined>(undefined);
  const aguardandoRef = useRef(false);
  const ultimaFalaRef = useRef(0);
  const historicoRef = useRef<{ papel: 'usuario' | 'ia'; texto: string }[]>([]);
  const ocupadoRef = useRef(false);
  const textoFaladoRef = useRef('');
  const geracaoRef = useRef(0);
  const pararRef = useRef<() => void>(() => {});

  const mostrar = (texto: string) => {
    setAviso(texto.length > 420 ? `${texto.slice(0, 417)}…` : texto);
    window.clearTimeout(tempoAvisoRef.current);
    tempoAvisoRef.current = window.setTimeout(() => setAviso(''), 14000);
  };

  const falar = (texto: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    textoFaladoRef.current = limparTextoVoz(texto);
    const fala = new SpeechSynthesisUtterance(texto.replace(/[#*`_]/g, ''));
    fala.lang = 'pt-BR';
    fala.onend = () => { ultimaFalaRef.current = Date.now(); };
    window.speechSynthesis.speak(fala);
  };

  const perguntar = async (pedido: string) => {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    const minhaGeracao = geracaoRef.current;
    try {
      const resp = await fetch('/api/ai/agente', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ message: pedido, historico: historicoRef.current.slice(-10) }),
        signal: AbortSignal.timeout(45_000),
      });
      const dados = await resp.json().catch(() => ({}));
      if (resp.ok && typeof dados.resposta === 'string' && dados.resposta.trim()) {
        historicoRef.current.push({ papel: 'usuario', texto: pedido }, { papel: 'ia', texto: dados.resposta });
        const temAcao = Array.isArray(dados.acoes) && dados.acoes.length > 0;
        const texto = temAcao ? `${dados.resposta} Há uma ação aguardando a sua confirmação na tela da IA.` : dados.resposta;
        if (minhaGeracao !== geracaoRef.current) return;
        mostrar(texto);
        falar(texto);
      } else {
        const erro = typeof dados.error === 'string' ? dados.error : 'Não consegui responder agora. Tente de novo.';
        mostrar(erro);
        falar(erro);
      }
    } catch {
      const erro = 'Não consegui falar com o servidor agora. Tente de novo.';
      mostrar(erro);
      falar(erro);
    } finally {
      ocupadoRef.current = false;
    }
  };
  pararRef.current = () => { geracaoRef.current += 1; try { window.speechSynthesis?.cancel(); } catch { /* ignora */ } aguardandoRef.current = false; setAviso(''); };
  const perguntarRef = useRef(perguntar);
  perguntarRef.current = perguntar;

  useEffect(() => {
    try { localStorage.setItem('murade_chamada_voz', ligada ? '1' : '0'); } catch { /* ignora */ }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!ligada || !SR) return;
    const limpar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const chamada = /\b(fisco|fisco ia)\b/;
    let ativo = true;
    let tempoComando: number | undefined;
    let rec: any;
    const iniciar = () => {
      if (!ativo) return;
      rec = new SR();
      rec.lang = 'pt-BR';
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (ev: any) => {
        for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
          if (!ev.results[i].isFinal) continue;
          const bruto = String(ev.results[i][0].transcript || '');
          const texto = limpar(bruto);
          if (!texto) continue;
          // "Para" / "espera": interrompe a fala e cancela o pedido em andamento.
          if (COMANDO_PARAR.test(texto)) { pararRef.current(); continue; }
          // Ignora o que o próprio sistema está falando (e o eco dele), para não se chamar sozinho.
          if (window.speechSynthesis?.speaking || Date.now() - ultimaFalaRef.current < 3000) continue;
          const faladas = new Set(textoFaladoRef.current.split(' '));
          const palavrasDita = texto.split(' ');
          if (Date.now() - ultimaFalaRef.current < 15000 && textoFaladoRef.current && (texto === 'pois nao' || (palavrasDita.length >= 2 && palavrasDita.filter((w) => faladas.has(w)).length / palavrasDita.length >= 0.75))) continue;
          if (aguardandoRef.current) {
            aguardandoRef.current = false;
            window.clearTimeout(tempoComando);
            void perguntarRef.current(bruto.trim());
          } else if (chamada.test(texto)) {
            const resto = bruto.replace(/^[\s,.!?]*(fisco ia|fisco)[\s,.!?:-]*/i, '').trim();
            if (resto.split(' ').length >= 3) void perguntarRef.current(resto);
            else {
              falar('Pois não?');
              aguardandoRef.current = true;
              tempoComando = window.setTimeout(() => { aguardandoRef.current = false; }, 12000);
            }
          }
        }
      };
      rec.onerror = (e: any) => { if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') { ativo = false; setLigada(false); } };
      rec.onend = () => { if (ativo) window.setTimeout(iniciar, 700); };
      try { rec.start(); } catch { /* já iniciado */ }
    };
    iniciar();
    return () => { ativo = false; window.clearTimeout(tempoComando); try { rec?.stop(); } catch { /* ignora */ } };
  }, [ligada]);

  if (!suporta) return null;
  return (
    <>
      {aviso && (
        <div role="status" onClick={() => setAviso('')} className="fixed bottom-14 right-3 z-[9999] max-w-[min(86vw,360px)] cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-xl" title="Toque para fechar">{aviso}</div>
      )}
      <button
        type="button"
        onClick={() => setLigada((v) => !v)}
        aria-pressed={ligada}
        className={`fixed bottom-3 right-3 z-[9999] flex h-9 w-9 items-center justify-center rounded-full border-2 text-base shadow-lg transition active:scale-95 ${ligada ? 'border-emerald-400 bg-[#0a2342] text-white' : 'border-slate-300 bg-white/90 text-slate-600'}`}
        title={ligada ? 'Escutando: diga "Fisco" e peça. Toque para desligar.' : 'Chamada por voz desligada. Toque para ligar.'}
        aria-label="Assistente Fisco IA por voz"
      >
        {ligada ? '👂' : '🎙️'}
      </button>
    </>
  );
}
