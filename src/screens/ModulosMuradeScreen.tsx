import { Blocks, ExternalLink, ShieldCheck } from 'lucide-react';
import { MODULOS_MURADE } from '../config/modulosMurade';

export function ModulosMuradeScreen() {
  return (
    <main className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-[#102a56] to-[#1e40af] p-6 text-white shadow-lg">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-white/10 p-3"><Blocks className="h-7 w-7" aria-hidden="true" /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">Ambiente Murade</p>
            <h1 className="mt-1 text-2xl font-bold">Módulos do escritório</h1>
            <p className="mt-2 max-w-3xl text-sm text-blue-100">
              Abra cada sistema de forma independente. A central continua disponível mesmo que outro módulo esteja fora do ar; cada endereço será aberto em uma nova aba.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Módulos Murade">
        {MODULOS_MURADE.map((modulo) => (
            <article key={modulo.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300">
              <h2 className="font-bold text-slate-900">{modulo.nome}</h2>
              <p className="mt-2 min-h-10 text-sm text-slate-600">{modulo.descricao}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={modulo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  Abrir módulo <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </article>
        ))}
      </section>

      <aside className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <p>
          Esta central reúne apenas os atalhos. Dados, certificados e sessões permanecem em cada sistema. A troca automática de dados entre Fiscal, Contábil e DP exige APIs e credenciais de integração que ainda não estão configuradas.
        </p>
      </aside>
    </main>
  );
}
