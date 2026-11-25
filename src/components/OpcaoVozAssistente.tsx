import React, { useEffect, useState } from 'react';
import { assinarAgente } from '../utils/agenteParar';
import { assinarVozes, definirVozDaAssistente, ouvirExemploDaVoz, pararHumana, vozAutomatica, vozEscolhidaPeloUsuario, vozesDaAssistente } from '../utils/vozHumana';
import { idDaVoz, nivelDaVoz, rotuloDaVoz } from '../utils/vozNaturalPtBr';
import { OPCOES_SILENCIO_MS, SILENCIO_PADRAO_MS, definirTempoSilencio, lerTempoSilencio, rotuloSilencio } from '../utils/microfoneChat';

// "Voz da assistente" (igual nos 5 sistemas Murad): lista as vozes em português DESTE aparelho, toca um exemplo e guarda a
// escolha por usuário neste aparelho. Padrão: automática — o sistema escolhe sozinho a voz mais natural. Tudo grátis.
// Também ajusta o tempo de silêncio do microfone dos chats (padrão 2,5 s): parou de falar esse tempo, a pergunta vai.
export function OpcaoVozAssistente({ className }: { className?: string }): React.ReactElement {
  const [vozes, setVozes] = useState<SpeechSynthesisVoice[]>(() => vozesDaAssistente());
  const [escolhida, setEscolhida] = useState<string>(() => vozEscolhidaPeloUsuario());
  const [tocando, setTocando] = useState(false);
  const [silencio, setSilencio] = useState<number>(() => lerTempoSilencio());
  const temSintese = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    const atualizar = () => { setVozes(vozesDaAssistente()); setEscolhida(vozEscolhidaPeloUsuario()); setSilencio(lerTempoSilencio()); };
    atualizar();
    // As vozes chegam com atraso em alguns aparelhos: confere de novo por alguns segundos.
    const tentativas = [300, 1000, 2500].map((ms) => window.setTimeout(atualizar, ms));
    const sairVozes = assinarVozes(atualizar);
    const sairAgente = assinarAgente(atualizar); // troca de usuário no mesmo aparelho
    return () => { tentativas.forEach((t) => window.clearTimeout(t)); sairVozes(); sairAgente(); };
  }, []);

  const automatica = vozAutomatica();
  const escolhidaExiste = !escolhida || vozes.some((v) => idDaVoz(v) === escolhida);
  const ouvir = () => {
    if (tocando) { pararHumana(); setTocando(false); return; }
    setTocando(true);
    void ouvirExemploDaVoz(escolhidaExiste ? escolhida : '', () => setTocando(false));
  };

  const caixa: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
  const linha: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 };
  const seletor: React.CSSProperties = { flex: '1 1 220px', minWidth: 0, minHeight: 44, padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', color: '#0F172A', fontSize: 14 };
  const botao: React.CSSProperties = { minHeight: 44, padding: '8px 14px', borderRadius: 8, border: '1px solid #0F2B5B', background: tocando ? '#0F2B5B' : '#fff', color: tocando ? '#fff' : '#0F2B5B', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
  const dica: React.CSSProperties = { display: 'block', fontSize: 12, opacity: 0.75 };

  return (
    <div className={className} style={caixa} data-opcao="voz-da-assistente">
      <label htmlFor="opcao-voz-assistente"><strong>Voz da assistente</strong></label>
      {!temSintese ? (
        <span style={dica}>Este navegador não tem voz. A Agente continua respondendo por escrito.</span>
      ) : (
        <>
          <div style={linha}>
            <select
              id="opcao-voz-assistente"
              value={escolhidaExiste ? escolhida : ''}
              onChange={(e) => { definirVozDaAssistente(e.target.value); setEscolhida(e.target.value); }}
              style={seletor}
              aria-describedby="opcao-voz-assistente-dica"
            >
              <option value="">{automatica ? `Automática (a mais natural): ${rotuloDaVoz(automatica)}` : 'Automática (a mais natural deste aparelho)'}</option>
              {vozes.map((v) => <option key={idDaVoz(v)} value={idDaVoz(v)}>{rotuloDaVoz(v)}</option>)}
            </select>
            <button type="button" onClick={ouvir} style={botao} aria-pressed={tocando}>{tocando ? 'Parar' : 'Ouvir exemplo'}</button>
          </div>
          <span id="opcao-voz-assistente-dica" style={dica}>
            {vozes.length === 0
              ? 'Este aparelho ainda não mostrou voz em português. No Android: Configurações › Idioma › Saída de texto para fala › Português (Brasil). No iPhone: Ajustes › Acessibilidade › Conteúdo Falado › Vozes › Português (Brasil).'
              : automatica && nivelDaVoz(automatica) < 3
                ? 'Voz grátis do aparelho, guardada só para você. Para uma voz mais humana: no computador use o navegador Edge (vozes Francisca e Thalita); no iPhone baixe a voz Luciana (Melhorada) em Ajustes › Acessibilidade › Conteúdo Falado.'
                : 'Voz grátis do próprio aparelho, guardada só para você. Na automática, o sistema escolhe sozinho a voz mais natural.'}
          </span>
        </>
      )}
      <label htmlFor="opcao-mic-silencio" style={{ marginTop: 4 }}><strong>Microfone: enviar depois de quanto silêncio</strong></label>
      <select
        id="opcao-mic-silencio"
        value={String(OPCOES_SILENCIO_MS.includes(silencio) ? silencio : SILENCIO_PADRAO_MS)}
        onChange={(e) => { const ms = Number(e.target.value); definirTempoSilencio(ms); setSilencio(ms); }}
        style={seletor}
        aria-describedby="opcao-mic-silencio-dica"
      >
        {OPCOES_SILENCIO_MS.map((ms) => <option key={ms} value={ms}>{rotuloSilencio(ms)}{ms === SILENCIO_PADRAO_MS ? ' (padrão)' : ''}</option>)}
      </select>
      <span id="opcao-mic-silencio-dica" style={dica}>Um clique no microfone liga; quando você para de falar por esse tempo, a pergunta é enviada. Clicar de novo envia na hora.</span>
    </div>
  );
}
