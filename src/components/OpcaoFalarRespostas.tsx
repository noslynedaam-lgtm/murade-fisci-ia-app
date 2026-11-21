import React, { useEffect, useState } from 'react';
import { assinarAgente, definirFalarRespostas, falarRespostasLigado } from '../utils/agenteParar';

// Opção da Agente "Falar as respostas": quem não quer voz desliga e passa a ver só o texto. Fica guardada por usuário neste aparelho.
export function OpcaoFalarRespostas({ className }: { className?: string }): React.ReactElement {
  const [ligado, setLigado] = useState<boolean>(() => falarRespostasLigado());
  useEffect(() => assinarAgente(() => setLigado(falarRespostasLigado())), []);
  return (
    <label className={className} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={ligado}
        onChange={(e) => { definirFalarRespostas(e.target.checked); setLigado(e.target.checked); }}
        style={{ width: 22, height: 22, accentColor: '#0F2B5B', cursor: 'pointer' }}
        aria-describedby="opcao-falar-respostas-dica"
      />
      <span>
        <strong>Falar as respostas</strong>
        <span id="opcao-falar-respostas-dica" style={{ display: 'block', fontSize: 12, opacity: 0.75 }}>
          {ligado ? 'Ligado: a Agente fala e escreve. Para ela parar na hora, diga ou digite "para", toque em PARAR ou aperte Esc.' : 'Desligado: a Agente só escreve, sem voz.'}
        </span>
      </span>
    </label>
  );
}
