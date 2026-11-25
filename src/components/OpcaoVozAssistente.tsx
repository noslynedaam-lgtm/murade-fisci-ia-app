import React, { useEffect, useState } from 'react';
import { assinarAgente } from '../utils/agenteParar';
import { ID_VOZ_HUMANA, ouvirExemploDaVoz, pararHumana } from '../utils/vozHumana';
import { OPCOES_SILENCIO_MS, SILENCIO_PADRAO_MS, definirTempoSilencio, lerTempoSilencio, rotuloSilencio } from '../utils/microfoneChat';

// "Voz da assistente": a Agente fala só com a voz humana (do servidor). A voz do aparelho (robótica) foi retirada a pedido do dono (25/11/2026).
// Também ajusta o tempo de silêncio do microfone dos chats (padrão 2,5 s): parou de falar esse tempo, a pergunta vai.
export function OpcaoVozAssistente({ className }: { className?: string }): React.ReactElement {
  const [tocando, setTocando] = useState(false);
  const [silencio, setSilencio] = useState<number>(() => lerTempoSilencio());

  useEffect(() => {
    const atualizar = () => setSilencio(lerTempoSilencio());
    atualizar();
    return assinarAgente(atualizar); // troca de usuário no mesmo aparelho
  }, []);

  const ouvir = () => {
    if (tocando) { pararHumana(); setTocando(false); return; }
    setTocando(true);
    void ouvirExemploDaVoz(ID_VOZ_HUMANA, () => setTocando(false));
  };

  const caixa: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
  const linha: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 };
  const seletor: React.CSSProperties = { flex: '1 1 220px', minWidth: 0, minHeight: 44, padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', color: '#0F172A', fontSize: 14 };
  const botao: React.CSSProperties = { minHeight: 44, padding: '8px 14px', borderRadius: 8, border: '1px solid #0F2B5B', background: tocando ? '#0F2B5B' : '#fff', color: tocando ? '#fff' : '#0F2B5B', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
  const dica: React.CSSProperties = { display: 'block', fontSize: 12, opacity: 0.75 };

  return (
    <div className={className} style={caixa} data-opcao="voz-da-assistente">
      <label htmlFor="opcao-voz-assistente"><strong>Voz da assistente</strong></label>
      <div style={linha}>
        <span id="opcao-voz-assistente" style={{ ...seletor, display: 'flex', alignItems: 'center', fontWeight: 700 }}>Voz humana Murad</span>
        <button type="button" onClick={ouvir} style={botao} aria-pressed={tocando}>{tocando ? 'Parar' : 'Ouvir exemplo'}</button>
      </div>
      <span id="opcao-voz-assistente-dica" style={dica}>
        A Agente fala só com a voz humana, igual no computador, no Android e no iPhone (a voz robótica do aparelho foi retirada). Precisa de internet; sem internet, a resposta aparece só escrita.
      </span>
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
