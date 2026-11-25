import { useEffect, useRef, useState } from 'react';
import { EVENTO_MICROFONE_CHAT, microfoneDoChatAtivo } from '../utils/microfoneChat';
import { falarHumana, pararHumana, humanaFalando, ajustarVoz, bipRapido, prepararVoz, respostaRapida } from '../utils/vozHumana';
import { EVENTO_AGENTE_PAROU, agenteAgindo, continuarDeOndeParou, ehComandoContinuar, ehComandoParar, pararTudo, temParaRetomar, type ResultadoPararTudo } from '../utils/agenteParar';
import { BotaoPararAgente } from './BotaoPararAgente';

/**
 * Assistente só por voz do Fisco IA. Diga "Fisco" (ou "Fisco IA") e peça.
 * Responde em voz e mostra um aviso rápido. Ações que precisam de confirmação aparecem no aviso
 * e são confirmadas na tela, nunca por voz.
 */
const textoParaFala = (t: string): string => String(t || '')
  .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1')
  .replace(/https?:\/\/\S+/g, 'o link na tela')
  .replace(/\b(\d{2})\.?(\d{3})\.?(\d{3})\/?(\d{4})-?(\d{2})\b/g, (_m, a, b, c, d, e) => [a, b, c, d, e].map((g: string) => g.split('').join(' ')).join(', '))
  .replace(/\b(\d{3})\.(\d{3})\.(\d{3})-(\d{2})\b/g, (_m, a, b, c, d) => [a, b, c, d].map((g: string) => g.split('').join(' ')).join(', '))
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
// Nomes com que a pessoa chama a Agente antes do comando ("Fisco, para").
const NOMES_CHAMADA = ['fisco', 'fisca'];

export default function ChamadaPorVozFiscoIA() {
  const [ligada, setLigada] = useState<boolean>(() => {
    try { return localStorage.getItem('murade_chamada_voz') !== '0'; } catch { return false; }
  });
  const [aviso, setAviso] = useState('');
  const [micChat, setMicChat] = useState<boolean>(() => microfoneDoChatAtivo());
  useEffect(() => {
    const aoMudar = () => setMicChat(microfoneDoChatAtivo());
    window.addEventListener(EVENTO_MICROFONE_CHAT, aoMudar);
    return () => window.removeEventListener(EVENTO_MICROFONE_CHAT, aoMudar);
  }, []);
  const [suporta] = useState<boolean>(() => typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  const tempoAvisoRef = useRef<number | undefined>(undefined);
  const aguardandoRef = useRef(false);
  const ultimaFalaRef = useRef(0);
  const historicoRef = useRef<{ papel: 'usuario' | 'ia'; texto: string }[]>([]);
  const ocupadoRef = useRef(false);
  const aguardandoNomeRef = useRef(false);
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
    // Um pedido longo não é um nome: deixa de esperar o nome e segue a conversa normal.
    if (aguardandoNomeRef.current && pedido.trim().split(/\s+/).length > 8) aguardandoNomeRef.current = false;
    if (aguardandoNomeRef.current) {
      // A resposta é o nome da pessoa: o servidor grava (regra fixa, sem IA) e a conversa só continua depois.
      try {
        const rn = await fetch('/api/ai/agente/nome', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: pedido }), signal: AbortSignal.timeout(15_000) });
        const dn = await rn.json().catch(() => ({}));
        const frase = typeof dn?.frase === 'string' ? dn.frase : (typeof dn?.mensagem === 'string' ? dn.mensagem : 'Não entendi o nome. Pode repetir só o nome?');
        if (dn?.sucesso || dn?.indisponivel) aguardandoNomeRef.current = false;
        if (minhaGeracao === geracaoRef.current) { mostrar(frase); falar(frase); }
      } catch { aguardandoNomeRef.current = false; } finally { ocupadoRef.current = false; }
      return;
    }
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

  // Depois de parar ("para", botão PARAR ou Esc): só o texto "Ok, parei." (sem voz) e ela espera; a resposta a caminho não é falada.
  useEffect(() => {
    const aoParar = (ev: Event) => {
      const d = (ev as CustomEvent<ResultadoPararTudo & { origem?: string }>).detail;
      geracaoRef.current += 1; aguardandoRef.current = false; janelaConversaRef.current = 0;
      if (d?.origem === 'texto') { setAviso(''); return; } // digitado no chat: a resposta aparece lá
      mostrar(d?.frase || 'Ok, parei.');
    };
    window.addEventListener(EVENTO_AGENTE_PAROU, aoParar);
    return () => window.removeEventListener(EVENTO_AGENTE_PAROU, aoParar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Saudação do dia ("Bom dia, Herbert!") e pergunta do nome na primeira vez. Regra fixa no servidor: não gasta crédito de IA.
  useEffect(() => {
    if (!ligada) return;
    let cancelado = false;
    const t = window.setTimeout(async () => {
      try {
        const r = await fetch('/api/ai/agente/saudacao', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15_000) });
        const d = await r.json().catch(() => ({}));
        if (cancelado || !r.ok || !d?.sucesso || !d.saudar || typeof d.frase !== 'string') return;
        if (d.precisaNome) { aguardandoNomeRef.current = true; janelaConversaRef.current = Date.now() + 25000; }
        mostrar(d.frase);
        falar(d.frase);
      } catch { /* sem saudação, o resto funciona igual */ }
    }, 2500);
    return () => { cancelado = true; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { localStorage.setItem('murade_chamada_voz', ligada ? '1' : '0'); } catch { /* ignora */ }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    // Um microfone por vez: enquanto o microfone do chat ouve, a chamada por voz pausa.
    if (!ligada || !SR || micChat) return;
    const limpar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const chamada = /\b(fisco|fisca|fisco ia)\b/;
    let ativo = true;
    let tempoComando: number | undefined;
    const tempoPreparo = window.setTimeout(() => { void prepararVoz(); }, 2500);
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
          // "Para" / "chega" / "silêncio"...: para TUDO na hora, sem ir ao servidor.
          // Parcial também vale enquanto ela fala (barge-in): não espera a frase terminar.
          if (ehComandoParar(texto, NOMES_CHAMADA) && (ehFinal || agenteAgindo())) { aguardandoRef.current = false; pararTudo('voz'); continue; }
          if (ehFinal && temParaRetomar() && ehComandoContinuar(texto, NOMES_CHAMADA)) { continuarDeOndeParou(); continue; }
          // Enquanto ela fala, o microfone pega a voz dela: tudo o que não é "para" é ignorado.
          if (humanaFalando()) continue;
          // Pedidos de volume e velocidade: "aumenta a voz", "fala mais rápido"...
          if (ehFinal) { const confirmacao = ajustarVoz(texto); if (confirmacao) { falar(confirmacao); continue; } }
          const faladas = new Set(textoFaladoRef.current.split(' '));
          const palavrasDita = texto.split(' ');
          const parecidoComFala = Boolean(textoFaladoRef.current) && palavrasDita.filter((w) => faladas.has(w)).length / palavrasDita.length >= 0.5;
          {
            if (!ehFinal) continue;
            // Ignora o eco da própria voz logo depois de falar.
            if (Date.now() - ultimaFalaRef.current < 1500) continue;
            if (Date.now() - ultimaFalaRef.current < 15000 && textoFaladoRef.current && ('pois nao' === texto || (palavrasDita.length >= 2 && parecidoComFala && palavrasDita.filter((w) => faladas.has(w)).length / palavrasDita.length >= 0.75))) continue;
          }
          if (aguardandoRef.current || Date.now() < janelaConversaRef.current) {
            // Logo depois de uma resposta (20 s) a conversa continua sem precisar chamar de novo.
            const rapida = respostaRapida(texto); if (rapida) { janelaConversaRef.current = Date.now() + 20000; falar(rapida); continue; }
            if (chamada.test(texto) && texto.split(' ').length <= 2) continue;
            aguardandoRef.current = false;
            janelaConversaRef.current = 0;
            window.clearTimeout(tempoComando);
            void perguntarRef.current(bruto.trim());
          } else if (chamada.test(texto)) {
            const resto = bruto.replace(/^[\s,.!?]*(fisco ia|fisco)[\s,.!?:-]*/i, '').trim();
            if (resto.split(' ').length >= 3) void perguntarRef.current(resto);
            else {
              bipRapido(); falar('Pois não?');
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
    return () => { ativo = false; window.clearTimeout(tempoPreparo); window.clearTimeout(tempoComando); try { rec?.stop(); } catch { /* ignora */ } };
  }, [ligada, micChat]);

  if (!suporta) return null;
  return (
    <>
      {aviso && (
        <div role="status" onClick={() => setAviso('')} className="fixed bottom-14 right-3 z-[9999] max-w-[min(86vw,360px)] cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-xl" title="Toque para fechar">{aviso}</div>
      )}
      <div className="fixed bottom-3 right-3 z-[9999] flex items-center gap-1.5">
      <BotaoPararAgente compacto />
      <button
        type="button"
        onClick={() => { if (ligada) pararRef.current(); setLigada((v) => !v); }}
        aria-pressed={ligada}
        className={`flex h-9 min-w-[3.6rem] items-center justify-center gap-1 rounded-full border-2 px-2 text-xs font-bold shadow-lg transition active:scale-95 ${ligada ? 'border-emerald-400 bg-[#0a2342] text-white' : 'border-rose-300 bg-white/95 text-rose-700'}`}
        title={ligada ? 'Escutando. Toque para DESLIGAR a voz.' : 'Voz desligada. Toque para LIGAR.'}
        aria-label="Assistente Fisco IA por voz"
      >
        {ligada ? '👂 ligada' : '🔇 desligada'}
      </button>
      </div>
    </>
  );
}
