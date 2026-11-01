// Voz humana (Gemini "Kore") com reserva na voz do navegador. Uma fala por vez; dá para interromper.
let audioAtual: HTMLAudioElement | null = null;
let sequencia = 0;
let falandoFlag = false;

export const humanaFalando = (): boolean => falandoFlag || Boolean(typeof window !== 'undefined' && window.speechSynthesis?.speaking);

export function pararHumana(): void {
  sequencia += 1;
  falandoFlag = false;
  if (audioAtual) { try { audioAtual.pause(); } catch { /* ignora */ } audioAtual = null; }
  try { window.speechSynthesis?.cancel(); } catch { /* ignora */ }
}

function dividirEmTrechos(texto: string): string[] {
  const trechos: string[] = [];
  let atual = '';
  for (const frase of texto.split(/(?<=[.!?:;])\s+/)) {
    if ((atual + ' ' + frase).length > (trechos.length === 0 ? 220 : 700) && atual) { trechos.push(atual.trim()); atual = frase; }
    else atual = atual ? `${atual} ${frase}` : frase;
  }
  if (atual.trim()) trechos.push(atual.trim());
  return trechos;
}

async function buscarAudio(trecho: string): Promise<string | null> {
  try {
    const resp = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ text: trecho }) });
    if (!resp.ok) return null;
    const dados = await resp.json();
    return dados?.audio ? `data:${dados.mimeType || 'audio/wav'};base64,${dados.audio}` : null;
  } catch { return null; }
}

function falarNoNavegador(texto: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    const vozes = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('pt'));
    const masculina = /daniel|antonio|ant[oô]nio|felipe|ricardo|male|jorge|diego/i;
    const feminina = /maria|francisca|luciana|camila|vit[oó]ria|thalita|female|google portugu/i;
    const voz = vozes.find((v) => feminina.test(v.name)) || vozes.find((v) => !masculina.test(v.name));
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    u.rate = 0.95;
    if (voz) u.voice = voz;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export async function falarHumana(texto: string, aoTerminar?: () => void): Promise<void> {
  pararHumana();
  const minha = sequencia;
  const trechos = dividirEmTrechos(texto.trim());
  if (!trechos.length) { aoTerminar?.(); return; }
  falandoFlag = true;
  try {
    let proximo = buscarAudio(trechos[0]);
    for (let i = 0; i < trechos.length; i += 1) {
      const src = await proximo;
      if (minha !== sequencia) return;
      if (i + 1 < trechos.length) proximo = buscarAudio(trechos[i + 1]);
      if (!src) { await falarNoNavegador(trechos.slice(i).join(' ')); break; }
      await new Promise<void>((resolve) => {
        const audio = new Audio(src);
        audioAtual = audio;
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
      if (minha !== sequencia) return;
    }
  } finally {
    if (minha === sequencia) { falandoFlag = false; audioAtual = null; aoTerminar?.(); }
  }
}
