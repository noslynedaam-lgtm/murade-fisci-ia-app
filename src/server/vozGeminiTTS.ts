import type { Express, Request, Response, RequestHandler } from 'express';

/**
 * Voz humana (Gemini TTS, voz feminina "Kore"): calma, elegante e natural.
 * Só para usuários autenticados (gasta a chave Gemini). Cache e limite por IP para não gastar à toa.
 * Se a cota acabar, responde 429 e o navegador usa a voz local como reserva.
 */
const cacheVoz = new Map<string, string>();
const usoPorIp = new Map<string, { total: number; ate: number }>();
let vozPausadaAte = 0;

const ESTILO = 'Speak as a calm, warm, elegant and soft-spoken Brazilian Portuguese woman, a professional and kind consultant. Natural unhurried pace, gentle pauses and soft breaths between sentences, never rushed, never robotic.';

export function registrarRotaVozGemini(
  app: Express,
  opcoes: { obterIA: () => any | null; autorizar: (req: Request) => boolean | Promise<boolean>; antes?: RequestHandler[] },
): void {
  app.post('/api/tts', ...(opcoes.antes || []), async (req: Request, res: Response) => {
    try {
      // Trava de custo: a voz premium gasta a chave e só funciona se o dono ligar VOZ_PREMIUM=ligada no servidor.
      if (process.env.VOZ_PREMIUM !== 'ligada') return res.status(403).json({ error: 'Voz premium desligada; usando a voz econômica do navegador.' });
      if (!(await opcoes.autorizar(req))) return res.status(401).json({ error: 'Entre no sistema para usar a voz.' });
      const texto = typeof req.body?.text === 'string' ? req.body.text : '';
      if (!texto.trim()) return res.status(400).json({ error: 'Texto não fornecido para síntese de voz.' });
      const ia = opcoes.obterIA();
      if (!ia) return res.status(503).json({ error: 'Serviço de IA não configurado no servidor.' });

      const ip = String(req.ip || req.socket.remoteAddress || 'ip');
      const agora = Date.now();
      const uso = usoPorIp.get(ip);
      if (!uso || uso.ate < agora) usoPorIp.set(ip, { total: 1, ate: agora + 60_000 });
      else if (++uso.total > 40) return res.status(429).json({ error: 'Muitos pedidos de voz em pouco tempo.' });

      const limpo = texto
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/https?:\/\/[^\s)]+/g, 'o link na tela')
        .replace(/[*`_~>|]/g, ' ')
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1500);
      const chave = `Kore|${limpo}`;
      const guardado = cacheVoz.get(chave);
      if (guardado) return res.json({ success: true, audio: guardado, mimeType: 'audio/wav', cache: true });
      if (Date.now() < vozPausadaAte) return res.status(429).json({ error: 'Cota da voz esgotada; usando a voz do navegador.' });

      const pedir = (modelo: string) => ia.models.generateContent({
        model: modelo,
        contents: [{ role: 'user', parts: [{ text: limpo, speechMetadata: { style: ESTILO } }] }],
        config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } },
      });
      let resposta;
      try { resposta = await pedir(process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts'); }
      catch { resposta = await pedir('gemini-3.8-flash-lite-tts'); }

      const audio = resposta?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audio) return res.status(502).json({ error: 'Nenhum áudio gerado.' });
      cacheVoz.set(chave, audio);
      if (cacheVoz.size > 60) cacheVoz.delete(cacheVoz.keys().next().value as string);
      return res.json({ success: true, audio, mimeType: 'audio/wav' });
    } catch (erro: any) {
      console.error('Falha na voz humana (/api/tts):', erro?.message || erro);
      if (/429|quota|RESOURCE_EXHAUSTED/i.test(String(erro?.message || erro))) {
        vozPausadaAte = Date.now() + 60_000;
        return res.status(429).json({ error: 'Cota da voz esgotada; usando a voz do navegador.' });
      }
      return res.status(502).json({ error: 'Não foi possível gerar a voz agora.' });
    }
  });
}
