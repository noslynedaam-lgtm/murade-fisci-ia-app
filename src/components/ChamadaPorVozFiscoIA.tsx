import { useEffect, useRef, useState } from 'react';
import { falarHumana, pararHumana, humanaFalando } from '../utils/vozHumana';

/**
 * Assistente só por voz do Fisco IA. Diga "Fisco" (ou "Fisco IA") e peça.
 * Responde em voz e mostra um aviso rápido. Ações que precisam de confirmação aparecem no aviso
 * e são confirmadas na tela, nunca por voz.
 */
const textoParaFala = (t: string): string => String(t || '')
  .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1')
  .replace(/https?:\/\/\S+/g, 'o link na tela')
  .replace(/\b(\d{2})\.?(\d{3})\.?(\d{3})\/?(\d{4})-?(\d{2})\b/g, '$1, $2, $3, $4, $5')
  .replace(/\b(\d{3})\.(\d{3})\.(\d{3})-(\d{2})\b/g, '$1, $2, $3, $4')
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
  .replace(/^\s*[-*•]\s+/gm, '')
  .replace(/[*_`#>|~]/g, ' ')
  .replace(/\s*\n+\s*/g, '. ')
  .replace(/\s{2,}/g, ' ')
  .trim();
const textoSemMarcas = (t: string): string => String(t || '')
  .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1')
  .replace(/[*_`#>|~]/g, '')
  .replace(/[\u{1F000}-\u{1FAFF}\u{FE0F}]/gu, '')
  .trim();
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
  const janelaConversaRef = useRef(0);
  const pararRef = useRef<() => void>(() => {});

  const mostrar = (texto: string) => {
    const limpo = textoSemMarcas(texto);
    setAviso(limpo.length > 420 ? `${limpo.slice(0, 417)}…` : limpo);
    window.clearTimeout(tempoAvisoRef.current);
    tempoAvisoRef.current = window.setTimeout(() => setAviso(''), 14000);
  };

  const falar = (texto: string) => {
    const falado = textoParaFala(texto);
    textoFaladoRef.current = limparTextoVoz(falado);
    // Voz humana (feminina, calma). Se a cota acabar, usa a voz do navegador.
    void falarHumana(falado, () => { ultimaFalaRef.current = Date.now(); janelaConversaRef.current = Date.now() + 20000; });
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
  pararRef.current = () => { geracaoRef.current += 1; try { window.speechSynthesis?.cancel(); pararHumana(); } catch { /* ignora */ } aguardandoRef.current = false; setAviso(''); };
  const perguntarRef = useRef(perguntar);
  perguntarRef.current = perguntar;

  useEffect(() => {
    try { localStorage.setItem('murade_chamada_voz', ligada ? '1' : '0'); } catch { /* ignora */ }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!ligada || !SR) return;
    const limpar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const chamada = /\b(fisco|fisca|fisco ia)\b/;
    let ativo = true;
    let tempoComando: number | undefined;
    let rec: any;
    const iniciar = () => {
      if (!ativo) return;
      rec = new SR();
      rec.lang = 'pt-BR';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (ev: any) => {
        for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
          const ehFinal = ev.results[i].isFinal;
          const bruto = String(ev.results[i][0].transcript || '');
          const texto = limpar(bruto);
          if (!texto) continue;
          // "Para" / "espera": interrompe a fala e cancela o pedido em andamento.
          if (COMANDO_PARAR.test(texto)) { pararRef.current(); continue; }
          const faladas = new Set(textoFaladoRef.current.split(' '));
          const palavrasDita = texto.split(' ');
          const parecidoComFala = Boolean(textoFaladoRef.current) && palavrasDita.filter((w) => faladas.has(w)).length / palavrasDita.length >= 0.5;
          const falandoAgora = Boolean(humanaFalando());
          if (falandoAgora) {
            // Você falou por cima da resposta: ela para na hora e passa a te ouvir.
            if (palavrasDita.length >= 2 && !parecidoComFala) {
              window.speechSynthesis?.cancel(); pararHumana(); ultimaFalaRef.current = 0; textoFaladoRef.current = ''; janelaConversaRef.current = Date.now() + 20000;
            }
            if (!ehFinal || parecidoComFala || palavrasDita.length < 2) continue;
          } else {
            if (!ehFinal) continue;
            // Ignora o eco da própria voz logo depois de falar.
            if (Date.now() - ultimaFalaRef.current < 1500) continue;
            if (Date.now() - ultimaFalaRef.current < 15000 && textoFaladoRef.current && ('pois nao' === texto || (palavrasDita.length >= 2 && palavrasDita.filter((w) => faladas.has(w)).length / palavrasDita.length >= 0.75))) continue;
          }
          if (aguardandoRef.current || Date.now() < janelaConversaRef.current) {
            // Logo depois de uma resposta (20 s) a conversa continua sem precisar chamar de novo.
            if (/^(obrigad[oa]|valeu|ok|certo|beleza|tchau|tudo bem|ta bom)$/.test(texto) || (chamada.test(texto) && texto.split(' ').length <= 2)) continue;
            aguardandoRef.current = false;
            janelaConversaRef.current = 0;
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
      rec.onend = () => { if (ativo) window.setTimeout(iniciar, 150); };
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
        onClick={() => { if (ligada) pararRef.current(); setLigada((v) => !v); }}
        aria-pressed={ligada}
        className={`fixed bottom-3 right-3 z-[9999] flex h-9 min-w-[3.6rem] items-center justify-center gap-1 rounded-full border-2 px-2 text-xs font-bold shadow-lg transition active:scale-95 ${ligada ? 'border-emerald-400 bg-[#0a2342] text-white' : 'border-rose-300 bg-white/95 text-rose-700'}`}
        title={ligada ? 'Escutando. Toque para DESLIGAR a voz.' : 'Voz desligada. Toque para LIGAR.'}
        aria-label="Assistente Fisco IA por voz"
      >
        {ligada ? '👂 ligada' : '🔇 desligada'}
      </button>
    </>
  );
}
