import React, { useEffect, useState } from 'react';

interface Cota {
  limiteGratis: number; gratisUsadas: number; consultasNaSemana: number; cobradasNaSemana: number;
  gratisRestante: number; proximaConsultaCobrada: boolean; novaGratisEm: string; totalHistorico: number; mensagem: string;
}

/** Mostra quantas consultas oficiais (SERPRO) a empresa já fez, o limite grátis da semana e o aviso de cobrança. */
export default function CotaConsultasSerpro({ companyId, tenantId }: { companyId?: string; tenantId?: string }) {
  const [cota, setCota] = useState<Cota | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!companyId || !tenantId) return;
    let ativo = true;
    fetch(`/api/serpro/consultas/${encodeURIComponent(companyId)}?tenantId=${encodeURIComponent(tenantId)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { if (ativo) setCota(d); })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [companyId, tenantId]);

  if (!companyId || !tenantId || erro || !cota) return null;
  const data = cota.novaGratisEm.split('-').reverse().join('/');
  return (
    <div className={`rounded-2xl border p-3 text-xs ${cota.proximaConsultaCobrada ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}>
      <p className="font-bold">Consultas oficiais (SERPRO) · esta semana</p>
      <p className="mt-1">
        Gratuitas: {cota.gratisUsadas} de {cota.limiteGratis} usada(s) · Cobradas à parte: {cota.cobradasNaSemana} · Total no histórico: {cota.totalHistorico}
      </p>
      <p className="mt-1">{cota.mensagem} {cota.proximaConsultaCobrada && `Nova consulta gratuita a partir de ${data}.`}</p>
      <p className="mt-1 text-[11px] opacity-80">O limite é por empresa e não acumula para a semana seguinte.</p>
    </div>
  );
}
