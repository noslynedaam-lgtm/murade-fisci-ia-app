import React, { useState } from 'react';
import { mudarTamanhoLetra, tamanhoLetraAtual, NIVEIS_LETRA } from '../utils/tamanhoLetra';

// Três botõezinhos: A- (diminui), A+ (aumenta) e voltar ao padrão. Ocupam pouco espaço, cabem na barra do topo e na do rodapé do celular.
export const BotoesTamanhoLetra: React.FC<{ escuro?: boolean }> = ({ escuro = true }) => {
  const [nivel, setNivel] = useState(tamanhoLetraAtual());
  const classe = escuro ? 'rounded bg-white/15 px-2 py-0.5 hover:bg-white/25 disabled:opacity-40' : 'rounded bg-slate-200 px-2 py-0.5 hover:bg-slate-300 disabled:opacity-40';
  const min = NIVEIS_LETRA[0];
  const max = NIVEIS_LETRA[NIVEIS_LETRA.length - 1];
  return (
    <span className="inline-flex items-center gap-1" role="group" aria-label="Tamanho da letra">
      <button type="button" className={classe} disabled={nivel <= min} onClick={() => setNivel(mudarTamanhoLetra(-1))} aria-label="Diminuir a letra" title="Diminuir a letra">A-</button>
      <button type="button" className={classe} disabled={nivel >= max} onClick={() => setNivel(mudarTamanhoLetra(1))} aria-label="Aumentar a letra" title="Aumentar a letra">A+</button>
    </span>
  );
};
