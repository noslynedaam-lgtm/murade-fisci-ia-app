import { useState } from 'react';
import { ArrowUpRight, Blocks, ExternalLink, ShieldCheck } from 'lucide-react';
import { MODULOS_MURADE, ModuloMurade } from '../config/modulosMurade';

export function ModulosMuradeScreen() {
  const [moduloAtivo, setModuloAtivo] = useState<ModuloMurade | null>(null);

  return (
    <main className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-[#102a56] to-[#1e40af] p-6 text-white shadow-lg">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-white/10 p-3"><Blocks className="h-7 w-7" aria-hidden="true" /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">Ambiente Murade</p>
            <h1 className="mt-1 text-2xl font-bold">Módulos do escritório</h1>
            <p className="mt-2 max-w-3xl text-sm text-blue-100">
              Acesse Fiscal, Contábil e Departamento Pessoal por esta central. Cada módulo abre dentro do painel quando o servidor permite, ou pode ser aberto em uma nova aba.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Módulos Murade">
        {MODULOS_MURADE.map((modulo) => {
          const ativo = moduloAtivo?.id === modulo.id;
          return (
            <article key={modulo.id} className={`rounded-2xl border bg-white p-5 shadow-sm transition ${ativo ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}>
              <h2 className="font-bold text-slate-900">{modulo.nome}</h2>
              <p className="mt-2 min-h-10 text-sm text-slate-600">{modulo.descricao}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setModuloAtivo(ativo ? null : modulo)}
                  className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  {ativo ? 'Fechar módulo' : 'Abrir no painel'}
                </button>
                <a
                  href={modulo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Nova aba <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </article>
          );
        })}
      </section>

      {moduloAtivo && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="font-semibold text-slate-900">{moduloAtivo.nome}</div>
            <a href={moduloAtivo.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline">
              Abrir em nova aba <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          <iframe
            key={moduloAtivo.id}
            title={moduloAtivo.nome}
            src={moduloAtivo.url}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-[min(72vh,900px)] w-full bg-slate-50"
          />
        </section>
      )}

      <aside className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <p>
          Esta central reúne o acesso aos módulos. Os cadastros, notas, folha e sessões continuam em cada sistema; a sincronização de dados entre eles ainda não está ativa.
        </p>
      </aside>
    </main>
  );
}
