import React, { useState } from 'react';
import { CheckCircle2, ClipboardCopy, ExternalLink, FileUp, Loader2, X } from 'lucide-react';
import { ADAPTADORES, ROTULO_RESULTADO, type ResultadoCertidao, type TipoCertidao } from '../../services/certidoes/certidoes';

export interface EmpresaBusca { id: string; nome: string; cnpj: string; uf: string | null; municipio: string | null }
interface Leitura {
  textoLido: boolean; resultado: ResultadoCertidao | null; numero: string | null; emissao: string | null; validade: string | null;
  validadeOrigem: 'lida_do_pdf' | 'calculada_pela_norma' | null; cnpjConfere: 'sim' | 'mesma_raiz' | 'nao' | 'nao_encontrado'; avisos: string[];
}
interface Props {
  tenantId: string; empresa: EmpresaBusca; tipos: TipoCertidao[]; portais: Partial<Record<TipoCertidao, string | null>>;
  linkReserva?: (tipo: TipoCertidao, uf?: string, cidade?: string) => string | undefined;
  onFechar: () => void; onGuardou: () => void;
}

const so = (c: string) => c.replace(/\D/g, '');
const mascara = (c: string) => { const d = so(c); return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : c; };
const lerArquivo = (f: File) => new Promise<string>((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, '')); r.onerror = () => erro(r.error); r.readAsDataURL(f); });

/** Uma certidão: copiar CNPJ + abrir portal → soltar o PDF → conferir o que o sistema leu → guardar. */
function PassoCertidao({ tenantId, empresa, tipo, portal, onGuardou }: { tenantId: string; empresa: EmpresaBusca; tipo: TipoCertidao; portal: string | undefined; onGuardou: () => void }) {
  const ad = ADAPTADORES[tipo];
  const [copiado, setCopiado] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [pdf, setPdf] = useState<string | null>(null);
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [campos, setCampos] = useState({ numero: '', emissao: '', validade: '', resultado: '' as ResultadoCertidao | '' });
  const [msg, setMsg] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [guardada, setGuardada] = useState(false);

  function abrirPortal() {
    // Copia o CNPJ ANTES de abrir a aba (com a página ainda em foco) e abre o portal dentro do mesmo clique (o navegador não bloqueia).
    const d = so(empresa.cnpj);
    setCopiado(`${mascara(d)} (digite-o se o colar não funcionar)`);
    navigator.clipboard?.writeText(d).then(() => setCopiado(`${mascara(d)} copiado`)).catch(() => undefined);
    if (portal) window.open(portal, '_blank', 'noopener,noreferrer');
  }

  async function receber(f: File | undefined) {
    if (!f) return;
    setMsg(null); setLeitura(null);
    if (f.type && f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setMsg({ tom: 'erro', texto: 'Solte o arquivo PDF da certidão.' }); return; }
    if (f.size > 3_145_728) { setMsg({ tom: 'erro', texto: 'O PDF passa de 3 MB.' }); return; }
    setLendo(true);
    try {
      const b64 = await lerArquivo(f); setPdf(b64);
      const r = await fetch('/api/certidoes/ler-pdf', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, companyId: empresa.id, tipo, pdfBase64: b64 }) });
      const d = await r.json().catch(() => ({})) as { leitura?: Leitura; mensagem?: string };
      if (!r.ok || !d.leitura) { setMsg({ tom: 'erro', texto: d.mensagem || 'Não foi possível ler o PDF. Preencha os campos olhando o documento.' }); setCampos({ numero: '', emissao: '', validade: '', resultado: '' }); setLeitura({ textoLido: false, resultado: null, numero: null, emissao: null, validade: null, validadeOrigem: null, cnpjConfere: 'nao_encontrado', avisos: [] }); return; }
      setLeitura(d.leitura);
      setCampos({ numero: d.leitura.numero ?? '', emissao: d.leitura.emissao ?? '', validade: d.leitura.validade ?? '', resultado: d.leitura.resultado ?? '' });
    } catch { setMsg({ tom: 'erro', texto: 'Falha ao ler o arquivo.' }); }
    finally { setLendo(false); }
  }

  async function guardar() {
    if (!pdf) return;
    if (!campos.numero || !campos.emissao || !campos.validade || !campos.resultado) { setMsg({ tom: 'erro', texto: 'Preencha número, situação, emissão e validade.' }); return; }
    setGuardando(true); setMsg(null);
    try {
      const r = await fetch('/api/certidoes/importar-pdf', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, companyId: empresa.id, tipo, pdfBase64: pdf, ...campos, confirmou: true }) });
      const d = await r.json().catch(() => ({})) as { mensagem?: string };
      if (!r.ok) { setMsg({ tom: 'erro', texto: d.mensagem || 'Não foi possível guardar. Nada foi guardado.' }); return; }
      setGuardada(true); setMsg({ tom: 'ok', texto: d.mensagem || 'Certidão guardada.' }); onGuardou();
    } catch { setMsg({ tom: 'erro', texto: 'Sem conexão. Nada foi guardado.' }); }
    finally { setGuardando(false); }
  }

  const entrada = 'w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5';
  return (
    <li className="border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold text-slate-900">{ad.rotulo}</p>
        {guardada && <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Guardada</span>}
      </div>
      {!guardada && (<>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={abrirPortal} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
            {portal ? <ExternalLink className="w-3.5 h-3.5" /> : <ClipboardCopy className="w-3.5 h-3.5" />}{portal ? '1. Copiar CNPJ e abrir portal' : '1. Copiar CNPJ'}
          </button>
          <label className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 flex items-center gap-1 cursor-pointer">
            <FileUp className="w-3.5 h-3.5" />2. Escolher o PDF baixado
            <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => { void receber(e.target.files?.[0]); e.currentTarget.value = ''; }} />
          </label>
        </div>
        {copiado && <p className="text-[11px] text-slate-600">CNPJ <strong>{copiado}</strong>. No portal, cole no campo do CNPJ, digite os caracteres da imagem e baixe o PDF.</p>}
        {!portal && <p className="text-[11px] text-amber-800">Portal deste órgão não cadastrado para {empresa.municipio || empresa.uf || 'esta empresa'}: abra pela tela Órgãos públicos.</p>}
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastando(false); void receber(e.dataTransfer.files?.[0]); }}
          className={`hidden sm:block rounded-lg border-2 border-dashed p-2 text-center text-[11px] ${arrastando ? 'border-blue-500 bg-blue-50' : 'border-slate-300 text-slate-500'}`}
        >Ou arraste o PDF para cá</div>
        {lendo && <p className="text-[11px] text-slate-600 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" />Lendo o PDF...</p>}
        {leitura && (
          <div className="bg-slate-50 rounded-lg p-2 space-y-2">
            <p className="text-[11px] font-bold text-slate-800">{leitura.textoLido ? '3. Confira o que o sistema leu do PDF e corrija se precisar:' : '3. Preencha olhando o documento:'}</p>
            {leitura.avisos.length > 0 && <ul className={`text-[11px] list-disc pl-4 ${leitura.cnpjConfere === 'nao' ? 'text-rose-800 font-bold' : 'text-amber-900'}`}>{leitura.avisos.map((a) => <li key={a}>{a}</li>)}</ul>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="text-[11px] text-slate-700">Situação
                <select className={entrada} value={campos.resultado} onChange={(e) => setCampos({ ...campos, resultado: e.target.value as ResultadoCertidao })}>
                  <option value="">Escolha...</option>
                  {(Object.keys(ROTULO_RESULTADO) as ResultadoCertidao[]).map((k) => <option key={k} value={k}>{ROTULO_RESULTADO[k]}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-slate-700">Número / código de controle
                <input className={entrada} value={campos.numero} maxLength={60} onChange={(e) => setCampos({ ...campos, numero: e.target.value })} />
              </label>
              <label className="text-[11px] text-slate-700">Emissão
                <input type="date" className={entrada} value={campos.emissao} onChange={(e) => setCampos({ ...campos, emissao: e.target.value })} />
              </label>
              <label className="text-[11px] text-slate-700">Validade{leitura.validadeOrigem === 'calculada_pela_norma' ? ' (calculada pela norma)' : ''}
                <input type="date" className={entrada} value={campos.validade} onChange={(e) => setCampos({ ...campos, validade: e.target.value })} />
              </label>
            </div>
            <button type="button" disabled={guardando || leitura.cnpjConfere === 'nao'} onClick={() => void guardar()} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
              {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}Confirmar e guardar
            </button>
          </div>
        )}
      </>)}
      {msg && <p role="status" className={`text-[11px] ${msg.tom === 'ok' ? 'text-emerald-800' : 'text-rose-800'}`}>{msg.texto}</p>}
    </li>
  );
}

/** Busca semiautomática das certidões de UMA empresa (estadual, municipal, CRF do FGTS, CNDT). */
export default function BuscaCertidaoAssistida({ tenantId, empresa, tipos, portais, linkReserva, onFechar, onGuardou }: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="titulo-busca-cert" className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-3">
      <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-3 sm:p-4 space-y-3 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 id="titulo-busca-cert" className="text-sm font-extrabold text-slate-900">Buscar certidões</h3>
            <p className="text-[11px] text-slate-600 truncate">{empresa.nome} · CNPJ {mascara(empresa.cnpj)}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onFechar} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[11px] text-slate-600">Os portais destes órgãos pedem os caracteres de uma imagem, então a emissão é sua: o sistema copia o CNPJ e abre o portal certo; você baixa o PDF e escolhe o arquivo aqui; o sistema lê número, situação e validade, e você só confirma.</p>
        <ul className="space-y-2">
          {tipos.map((t) => <React.Fragment key={t}><PassoCertidao tenantId={tenantId} empresa={empresa} tipo={t} portal={portais[t] ?? linkReserva?.(t, empresa.uf ?? undefined, empresa.municipio ?? undefined) ?? undefined} onGuardou={onGuardou} /></React.Fragment>)}
        </ul>
        <div className="flex justify-end"><button type="button" onClick={onFechar} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300">Fechar</button></div>
      </div>
    </div>
  );
}
