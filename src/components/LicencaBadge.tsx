import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';

type Licenca = { cadastrada: false } | { cadastrada: true; plano: string; vencimento: string; situacao: 'ativa' | 'vencida' | 'inativa' };
const planos: Record<string, string> = { P50: 'Plano 50', P100: 'Plano 100', P500: 'Plano 500' };
const data = (iso: string) => iso.split('-').reverse().join('/');

// Licença da empresa ativa, cadastrada e gerenciada no Murade DP. Nunca inventa: sem dado, avisa.
export default function LicencaBadge({ cnpj }: { cnpj: string | null | undefined }) {
  const [estado, setEstado] = useState<Licenca | null | undefined>(undefined);
  useEffect(() => {
    const limpo = String(cnpj || '').replace(/[^0-9A-Za-z]/g, '');
    if (limpo.length !== 14) { setEstado(undefined); return; }
    let vivo = true;
    setEstado(undefined);
    fetch(`/api/licenca?cnpj=${encodeURIComponent(limpo)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setEstado(d && d.licenca ? d.licenca : null); })
      .catch(() => { if (vivo) setEstado(null); });
    return () => { vivo = false; };
  }, [cnpj]);

  let texto = 'Selecione uma empresa';
  let cor = 'bg-slate-50 border-slate-200 text-slate-600';
  if (String(cnpj || '').replace(/[^0-9A-Za-z]/g, '').length === 14) {
    if (estado === undefined) texto = 'Consultando licença…';
    else if (estado === null) { texto = 'Licença indisponível'; cor = 'bg-amber-50 border-amber-300 text-amber-900'; }
    else if (!estado.cadastrada) { texto = 'Sem licença cadastrada'; cor = 'bg-amber-50 border-amber-300 text-amber-900'; }
    else if (estado.situacao === 'ativa') { texto = `${planos[estado.plano] || estado.plano} · até ${data(estado.vencimento)}`; cor = 'bg-emerald-50 border-emerald-300 text-emerald-900'; }
    else if (estado.situacao === 'vencida') { texto = `Licença vencida em ${data(estado.vencimento)}`; cor = 'bg-red-50 border-red-300 text-red-900'; }
    else { texto = 'Licença inativa'; cor = 'bg-red-50 border-red-300 text-red-900'; }
  }
  return null; // Selo de licença removido a pedido do dono do sistema.
  // eslint-disable-next-line no-unreachable
  return (
    <div role="button" tabIndex={0} onClick={() => window.open('https://murade-dp.onrender.com', '_blank', 'noopener,noreferrer')} className={`flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${cor}`} title="Licença da empresa — clique para abrir o Murade DP, onde ela é cadastrada">
      <KeyRound className="h-3.5 w-3.5 shrink-0" />
      <span className="max-w-[220px] truncate">{texto}</span>
    </div>
  );
}
