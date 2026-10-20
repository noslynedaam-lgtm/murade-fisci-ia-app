import { useEffect, useState } from 'react';

export interface ProntidaoSerproUI { pronto: boolean; itens: { chave: string; ok: boolean; descricao: string }[] }

/** Estado real (só sim/não, sem valores) das variáveis do SERPRO no servidor. */
export function useProntidaoSerpro(): ProntidaoSerproUI | null {
  const [dados, setDados] = useState<ProntidaoSerproUI | null>(null);
  useEffect(() => {
    let ativo = true;
    fetch('/api/serpro/prontidao', { credentials: 'same-origin', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (ativo && d && Array.isArray(d.itens)) setDados(d); })
      .catch(() => { /* mantém "não validado" */ });
    return () => { ativo = false; };
  }, []);
  return dados;
}
