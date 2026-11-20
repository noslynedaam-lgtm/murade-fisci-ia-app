import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, LayoutGrid, Loader2, RefreshCw, Search } from 'lucide-react';
import { useEmpresa } from '../../context/EmpresaContext';
import { ADAPTADORES, TIPOS_CERTIDAO, type TipoCertidao } from '../../services/certidoes/certidoes';
import type { CorCertidao } from '../../services/certidoes/painelCertidoes';
import BuscaCertidaoAssistida, { type EmpresaBusca } from './BuscaCertidaoAssistida';

interface Estado { tipo: TipoCertidao; cor: CorCertidao; texto: string; validade: string | null; dias: number | null; buscar: boolean }
interface Linha { empresa: EmpresaBusca; certidoes: Record<TipoCertidao, Estado>; pior: CorCertidao; aBuscar: TipoCertidao[] }
interface Painel {
  hoje: string; linhas: Linha[]; contagem: Record<CorCertidao, number>; totalABuscar: number;
  proximosVencimentos: Array<{ empresa: string; companyId: string; tipo: TipoCertidao; texto: string; validade: string; cor: CorCertidao }>;
  portais: Record<string, Partial<Record<TipoCertidao, string | null>>>;
}

const CURTO: Record<TipoCertidao, string> = { federal: 'Federal', estadual: 'Estadual', municipal: 'Municipal', fgts: 'FGTS', trabalhista: 'Trabalhista' };
const COR: Record<CorCertidao, string> = {
  verde: 'bg-emerald-100 text-emerald-900 border-emerald-300', amarelo: 'bg-amber-100 text-amber-950 border-amber-300',
  vermelho: 'bg-rose-100 text-rose-900 border-rose-300', cinza: 'bg-slate-100 text-slate-600 border-slate-300',
};
const PONTO: Record<CorCertidao, string> = { verde: 'bg-emerald-500', amarelo: 'bg-amber-400', vermelho: 'bg-rose-500', cinza: 'bg-slate-400' };
const br = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—');
const SEMI: TipoCertidao[] = ['estadual', 'municipal', 'fgts', 'trabalhista'];

/** Painel do escritório: as 5 certidões de cada empresa em verde/amarelo/vermelho, próximos vencimentos e "Buscar agora". */
export default function PainelCertidoesEmpresas({ linkReserva }: { linkReserva?: (tipo: TipoCertidao, uf?: string, cidade?: string) => string | undefined }) {
  const { empresas, empresaAtiva } = useEmpresa();
  const escritorios = useMemo(() => [...new Set(empresas.map((e) => e.tenantIdCentral).filter((t): t is string => Boolean(t)))], [empresas]);
  const [escolhido, setEscolhido] = useState<string>('');
  const tenantId = (escolhido && escritorios.includes(escolhido) ? escolhido : null) ?? empresaAtiva?.tenantIdCentral ?? escritorios[0];
  const [painel, setPainel] = useState<Painel | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todas' | 'pendentes'>('pendentes');
  const [busca, setBusca] = useState<{ linha: Linha; tipos: TipoCertidao[] } | null>(null);

  const carregar = useCallback(async () => {
    if (!tenantId) return;
    setCarregando(true); setErro(null);
    try {
      const r = await fetch(`/api/certidoes/painel?tenantId=${tenantId}`, { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErro((d as { mensagem?: string }).mensagem || 'Não foi possível montar o painel.'); return; }
      setPainel(d as Painel);
    } catch { setErro('Sem conexão com o servidor.'); }
    finally { setCarregando(false); }
  }, [tenantId]);
  useEffect(() => { void carregar(); }, [carregar]);

  if (!tenantId) return null;
  const linhas = (painel?.linhas ?? []).filter((l) => filtro === 'todas' || l.pior !== 'verde');

  return (
    <section id="painel-certidoes" className="bg-white rounded-xl border border-slate-200 shadow-xs p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5"><LayoutGrid className="w-4 h-4 text-blue-600" />Certidões das empresas</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {escritorios.length > 1 && (
            <select aria-label="Escritório" value={tenantId} onChange={(e) => setEscolhido(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2 py-1.5">
              {escritorios.map((t) => <option key={t} value={t}>{`Escritório: ${empresas.find((e) => e.tenantIdCentral === t)?.razaoSocial ?? ''} e outras`}</option>)}
            </select>
          )}
          <select aria-label="Filtro" value={filtro} onChange={(e) => setFiltro(e.target.value as 'todas' | 'pendentes')} className="text-xs border border-slate-300 rounded-lg px-2 py-1.5">
            <option value="pendentes">Só o que pede atenção</option><option value="todas">Todas as empresas</option>
          </select>
          <button type="button" onClick={() => void carregar()} className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 flex items-center gap-1">
            {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}Atualizar
          </button>
        </div>
      </div>

      {painel && (
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {(['vermelho', 'amarelo', 'cinza', 'verde'] as CorCertidao[]).map((c) => (
            <span key={c} className={`px-2 py-0.5 rounded-full border font-bold ${COR[c]}`}>{painel.contagem[c]} {c === 'vermelho' ? 'vencidas/positivas' : c === 'amarelo' ? 'vencendo/atenção' : c === 'cinza' ? 'não buscadas' : 'em dia'}</span>
          ))}
          {painel.totalABuscar > 0 && <span className="px-2 py-0.5 rounded-full border border-blue-300 bg-blue-50 text-blue-900 font-bold">{painel.totalABuscar} para buscar</span>}
        </div>
      )}
      {erro && <div role="status" className="rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-900">{erro}</div>}

      {painel && painel.proximosVencimentos.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
          <p className="text-xs font-bold text-amber-950 flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" />Próximos vencimentos</p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-amber-950">
            {painel.proximosVencimentos.slice(0, 8).map((v) => <li key={`${v.companyId}-${v.tipo}`}><span className={`inline-block w-2 h-2 rounded-full mr-1 ${PONTO[v.cor]}`} />{v.empresa} — {CURTO[v.tipo]}: {v.texto} ({br(v.validade)})</li>)}
          </ul>
        </div>
      )}

      <ul className="divide-y divide-slate-100">
        {painel && linhas.length === 0 && <li className="py-2 text-xs text-slate-500">{filtro === 'pendentes' ? 'Nenhuma empresa com certidão pedindo atenção.' : 'Nenhuma empresa cadastrada.'}</li>}
        {linhas.map((l) => (
          <li key={l.empresa.id} className="py-2 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
            <div className="min-w-0 sm:w-56 shrink-0">
              <p className="text-xs font-bold text-slate-900 truncate">{l.empresa.nome}</p>
              <p className="text-[11px] text-slate-500">{l.empresa.cnpj}</p>
            </div>
            <div className="flex flex-wrap gap-1 flex-1">
              {TIPOS_CERTIDAO.map((t) => {
                const c = l.certidoes[t];
                return <span key={t} title={`${ADAPTADORES[t].rotulo}: ${c.texto}${c.validade ? ` (validade ${br(c.validade)})` : ''}`} className={`text-[11px] px-1.5 py-0.5 rounded-md border ${COR[c.cor]}`}>{CURTO[t]}{c.validade ? ` ${br(c.validade).slice(0, 5)}` : ''}</span>;
              })}
            </div>
            <button type="button" onClick={() => setBusca({ linha: l, tipos: l.aBuscar.length ? l.aBuscar : SEMI })} className="self-start sm:self-auto text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 shrink-0">
              <Search className="w-3.5 h-3.5" />Buscar agora{l.aBuscar.length ? ` (${l.aBuscar.length})` : ''}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-slate-500">Verde: em dia. Amarelo: vence logo, sem validade ou positiva com efeito de negativa. Vermelho: vencida, positiva ou não emitida. Cinza: ainda não buscada. Estadual, municipal, FGTS e trabalhista: o portal pede captcha, então o sistema abre o portal e lê o PDF que você baixar. A federal tem a consulta própria abaixo.</p>

      {busca && (
        <BuscaCertidaoAssistida
          tenantId={tenantId} empresa={busca.linha.empresa} tipos={busca.tipos} portais={painel?.portais[busca.linha.empresa.id] ?? {}} linkReserva={linkReserva}
          onFechar={() => { setBusca(null); void carregar(); }} onGuardou={() => undefined}
        />
      )}
    </section>
  );
}
