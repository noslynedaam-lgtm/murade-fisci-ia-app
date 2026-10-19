import { useEffect, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, Calculator, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react';

type Sistema = { id: string; nome: string; tipo: 'interno' | 'externo'; ssoAtivo: boolean };

type PortalSistemasMuradeProps = {
  onAbrirFiscoIa: () => void;
  onSair: () => void;
};

export default function PortalSistemasMurade({ onAbrirFiscoIa, onSair }: PortalSistemasMuradeProps) {
  const [sistemas, setSistemas] = useState<Sistema[]>([
    { id: 'murade-fisco-ia', nome: 'Murade Fisco IA', tipo: 'interno', ssoAtivo: true },
  ]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void fetch('/api/sso/apps', { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.erro || 'Não foi possível carregar os sistemas autorizados.');
        return body as { sistemas?: Sistema[] };
      })
      .then((body) => {
        if (!ativo) return;
        const autorizados = Array.isArray(body.sistemas) ? body.sistemas : [];
        const fiscoIa = autorizados.find((sistema) => sistema.id === 'murade-fisco-ia')
          || { id: 'murade-fisco-ia', nome: 'Murade Fisco IA', tipo: 'interno' as const, ssoAtivo: true };
        setSistemas([fiscoIa, ...autorizados.filter((sistema) => sistema.id !== fiscoIa.id)]);
      })
      .catch((error: unknown) => {
        if (ativo) setErro(error instanceof Error ? error.message : 'Não foi possível carregar os sistemas autorizados.');
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">Portal Murade</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Meus sistemas</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Entre no Fisco IA ou confira os outros módulos liberados para sua conta.</p>
          </div>
          <button type="button" onClick={onSair} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </header>

        {erro && <div role="status" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">{erro} O acesso ao Fisco IA continua disponível.</div>}

        <section aria-label="Sistemas da conta" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sistemas.map((sistema) => {
            const interno = sistema.id === 'murade-fisco-ia';
            const Icon = interno ? Calculator : BriefcaseBusiness;
            return (
              <article key={sistema.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${interno ? 'border-indigo-200' : 'border-slate-200'}`}>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${interno ? 'bg-indigo-900 text-amber-300' : 'bg-slate-100 text-slate-600'}`}><Icon className="h-5 w-5" /></div>
                <h2 className="mt-4 text-lg font-bold text-slate-900">{sistema.nome}</h2>
                {interno ? (
                  <>
                    <p className="mt-1 text-sm text-slate-600">Compliance fiscal e ferramentas do Fisco IA.</p>
                    <button type="button" onClick={onAbrirFiscoIa} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-950">
                      Abrir sistema <ArrowRight className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-slate-600">Acesso concedido para esta conta.</p>
                    <p className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900">
                      <ShieldCheck className="h-3.5 w-3.5" /> Login único ainda em integração
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">A conexão segura deste módulo ainda está sendo preparada. O cartão não abre uma sessão falsa nem altera o acesso local existente.</p>
                  </>
                )}
              </article>
            );
          })}
        </section>

        {carregando && <p role="status" className="mt-5 inline-flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando permissões dos sistemas…</p>}
        {!carregando && !erro && sistemas.length === 1 && <p className="mt-5 text-sm text-slate-500">Nenhum outro sistema foi liberado para esta conta.</p>}

        <div className="mt-8 flex items-start gap-2 rounded-xl border border-slate-200 bg-white/70 p-4 text-xs leading-relaxed text-slate-600">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          <p>Este portal lista apenas concessões registradas no servidor. A liberação de um sistema não substitui as permissões de empresa e função verificadas dentro de cada módulo.</p>
        </div>
      </div>
    </main>
  );
}
