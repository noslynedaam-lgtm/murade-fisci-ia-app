import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardPlus, Download, ExternalLink, FileText, Image as ImageIcon, Loader2, MessageCircle, Settings2, Share2, X } from 'lucide-react';
import { linkWhatsApp, numeroWhatsApp, type ConfigRelatorio, type Cor, type RelatorioCliente } from '../services/relatorio/relatorioCliente';
import { novaTarefa, chaveTarefa, type TarefaEquipe } from '../services/escritorio/tarefasEquipe';
import { gravarColecao, lerColecao, lerTarefas } from '../services/escritorio/tarefasCliente';

interface Props { tenantId: string; companyId: string; nome: string; onFechar: () => void }
interface Resposta { relatorio: RelatorioCliente; temLogo: boolean; whatsapp: { numero: string | null; texto: string; link: string }; observacao: string }

const FUNDO: Record<Cor, string> = { verde: 'border-emerald-300 bg-emerald-50 text-emerald-950', amarelo: 'border-amber-300 bg-amber-50 text-amber-950', vermelho: 'border-rose-300 bg-rose-50 text-rose-950', cinza: 'border-slate-200 bg-slate-50 text-slate-800' };
const PONTO: Record<Cor, string> = { verde: 'bg-emerald-600', amarelo: 'bg-amber-500', vermelho: 'bg-rose-600', cinza: 'bg-slate-400' };
const CONFIG_VAZIA: ConfigRelatorio = { nomeExibido: null, telefone: null, email: null, rodape: null, logoJpegBase64: null };

/** Converte a imagem escolhida (PNG, JPG, WebP) em JPEG pequeno, com fundo branco, para ir no PDF. */
async function imagemParaJpegBase64(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error('Não consegui abrir a imagem.')); i.src = url; });
    const escala = Math.min(1, 480 / img.width, 200 / img.height);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * escala)); c.height = Math.max(1, Math.round(img.height * escala));
    const g = c.getContext('2d'); if (!g) throw new Error('Não consegui preparar a imagem.');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.85, 0.7, 0.55]) {
      const b64 = c.toDataURL('image/jpeg', q).split(',')[1] ?? '';
      if (b64.length <= 190_000) return b64;
    }
    throw new Error('Imagem grande demais mesmo reduzida. Use um logo menor.');
  } finally { URL.revokeObjectURL(url); }
}

/**
 * Relatório para o cliente de UMA empresa: prévia, PDF (abrir, baixar, compartilhar), resumo pelo WhatsApp (link wa.me, sem custo)
 * e "Criar tarefa para a equipe" em cada pendência. Usa só as consultas guardadas: não faz consulta nova nem gasta crédito.
 */
export default function RelatorioClienteModal({ tenantId, companyId, nome, onFechar }: Props) {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [numero, setNumero] = useState('');
  const [tarefas, setTarefas] = useState<TarefaEquipe[]>([]);
  const [criando, setCriando] = useState<string | null>(null);
  const [compartilhando, setCompartilhando] = useState(false);
  const [verConfig, setVerConfig] = useState(false);
  const [config, setConfig] = useState<ConfigRelatorio>(CONFIG_VAZIA);
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const base = `tenantId=${encodeURIComponent(tenantId)}&companyId=${encodeURIComponent(companyId)}`;
  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const r = await fetch(`/api/relatorio-cliente?${base}`, { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErro((d as { mensagem?: string }).mensagem || 'Não foi possível montar o relatório.'); return; }
      setDados(d as Resposta);
      setNumero((n) => n || ((d as Resposta).whatsapp.numero ?? '').replace(/^55/, ''));
    } catch { setErro('Sem conexão com o servidor.'); }
    try { setTarefas(await lerTarefas(tenantId)); } catch { /* a lista de tarefas é só para não duplicar */ }
  }, [base, tenantId]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    void lerColecao<ConfigRelatorio>(tenantId, 'relatorio_cliente').then((l) => { const c = l.find((i) => i.chave === 'config'); if (c) setConfig({ ...CONFIG_VAZIA, ...c.dados }); }).catch(() => undefined);
  }, [tenantId]);
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, [onFechar]);

  const urlPdf = `/api/relatorio-cliente/pdf?${base}`;
  const nomeArquivo = dados ? `relatorio-fiscal-${dados.relatorio.empresa.cnpj.replace(/[^A-Za-z0-9]/g, '')}-${dados.relatorio.hoje}.pdf` : 'relatorio-fiscal.pdf';
  const podeCompartilharArquivo = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  async function compartilharPdf() {
    setCompartilhando(true); setAviso(null);
    try {
      const r = await fetch(urlPdf, { credentials: 'same-origin', cache: 'no-store' });
      if (!r.ok) throw new Error('Não foi possível gerar o PDF.');
      const arquivo = new File([await r.blob()], nomeArquivo, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [arquivo] })) await navigator.share({ files: [arquivo], title: `Relatório fiscal — ${nome}` });
      else setAviso('Este aparelho não compartilha arquivos direto. Use "Baixar PDF" e anexe na conversa.');
    } catch (e) { if ((e as { name?: string })?.name !== 'AbortError') setAviso(e instanceof Error ? e.message : 'Não foi possível compartilhar.'); }
    finally { setCompartilhando(false); }
  }

  function abrirWhatsApp() {
    if (!dados) return;
    const n = numeroWhatsApp(numero);
    if (numero.trim() && !n) { setAviso('Número inválido: use DDD + número (ex.: 62 99999-0000).'); return; }
    window.open(linkWhatsApp(n, dados.whatsapp.texto), '_blank', 'noopener,noreferrer');
    setAviso('O WhatsApp abriu com o resumo. O link não anexa o PDF: depois envie o PDF por "Compartilhar PDF" (celular) ou anexe o PDF baixado.');
  }

  async function criarTarefa(codigo: string, titulo: string) {
    if (!dados) return;
    setCriando(codigo); setAviso(null);
    try {
      const t = novaTarefa({ origem: 'relatorio_cliente', titulo: `${titulo} — ${dados.relatorio.empresa.nome}`.slice(0, 200), empresaId: companyId, empresa: dados.relatorio.empresa.nome, cnpj: dados.relatorio.empresa.cnpj, codigo });
      await gravarColecao(tenantId, 'tarefas_equipe', [{ chave: t.id, dados: t }]);
      setTarefas(await lerTarefas(tenantId));
      setAviso('Tarefa criada na lista "Tarefas da equipe".');
    } catch (e) { setAviso(e instanceof Error ? e.message : 'Não foi possível criar a tarefa.'); }
    finally { setCriando(null); }
  }

  async function escolherLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { setConfig((c) => ({ ...c, logoJpegBase64: null })); const b64 = await imagemParaJpegBase64(f); setConfig((c) => ({ ...c, logoJpegBase64: b64 })); }
    catch (er) { setAviso(er instanceof Error ? er.message : 'Não foi possível usar esta imagem.'); }
  }
  async function salvarConfig() {
    setSalvandoConfig(true); setAviso(null);
    const limpa = (v: string | null) => (v && v.trim() ? v.trim() : null);
    try {
      await gravarColecao(tenantId, 'relatorio_cliente', [{ chave: 'config', dados: { nomeExibido: limpa(config.nomeExibido), telefone: limpa(config.telefone), email: limpa(config.email), rodape: limpa(config.rodape), logoJpegBase64: config.logoJpegBase64 } }]);
      setAviso('Nome, contato e logo salvos. Valem para todos os relatórios do escritório.');
      await carregar();
    } catch (e) { setAviso(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setSalvandoConfig(false); }
  }

  const rel = dados?.relatorio;
  const abertaComChave = (codigo: string) => tarefas.find((t) => t.id === chaveTarefa('relatorio_cliente', companyId, codigo, '') && !t.concluida);

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/60 flex items-stretch sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-relatorio-cliente" onClick={onFechar}>
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl max-h-full overflow-y-auto text-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-700 shrink-0" />
          <h2 id="titulo-relatorio-cliente" className="font-black text-sm sm:text-base min-w-0 truncate">Relatório para o cliente — {nome}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="ml-auto p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-3 space-y-3 text-xs">
          {erro && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-2 text-rose-900">{erro}</p>}
          {!rel && !erro && <p className="flex items-center gap-1"><Loader2 className="w-4 h-4 animate-spin" />Montando o relatório…</p>}
          {rel && (
            <>
              <div className={`rounded-xl border p-3 ${FUNDO[rel.geral.cor]}`}>
                <p className="font-black text-sm">{rel.geral.titulo}</p>
                <p>{rel.geral.frase}</p>
                <p className="mt-1 text-[11px] opacity-80">{dados?.observacao}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <a href={urlPdf} target="_blank" rel="noreferrer" className="px-2 py-2 rounded-lg border border-slate-300 font-bold flex items-center justify-center gap-1"><ExternalLink className="w-3.5 h-3.5" />Abrir PDF</a>
                <a href={`${urlPdf}&baixar=1`} download={nomeArquivo} className="px-2 py-2 rounded-lg border border-slate-300 font-bold flex items-center justify-center gap-1"><Download className="w-3.5 h-3.5" />Baixar PDF</a>
                {podeCompartilharArquivo && <button type="button" disabled={compartilhando} onClick={() => void compartilharPdf()} className="px-2 py-2 rounded-lg border border-slate-300 font-bold flex items-center justify-center gap-1">{compartilhando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}Compartilhar PDF</button>}
                <button type="button" onClick={() => setVerConfig((v) => !v)} className="px-2 py-2 rounded-lg border border-slate-300 font-bold flex items-center justify-center gap-1"><Settings2 className="w-3.5 h-3.5" />Nome e logo</button>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 space-y-1.5">
                <p className="font-bold">Enviar o resumo pelo WhatsApp (sem custo)</p>
                <div className="flex flex-wrap gap-2">
                  <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="tel" placeholder="WhatsApp do cliente com DDD" aria-label="WhatsApp do cliente com DDD" className="flex-1 min-w-[10rem] px-2.5 py-2 rounded-lg border border-slate-300 bg-white" />
                  <button type="button" onClick={abrirWhatsApp} className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />Abrir no WhatsApp</button>
                </div>
                <p className="text-[11px] text-slate-600">{dados?.whatsapp.numero ? 'Número puxado do cadastro da empresa; confira.' : 'A empresa não tem telefone no cadastro: digite o número (ou deixe em branco e escolha o contato no WhatsApp).'} O link abre a conversa com o texto pronto; o PDF vai por "Compartilhar PDF" ou anexado.</p>
              </div>

              {aviso && <p role="status" className="rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-indigo-950">{aviso}</p>}

              {verConfig && (
                <div className="rounded-xl border border-slate-300 p-2.5 space-y-2">
                  <p className="font-bold">Nome, contato e logo do escritório (valem para todos os relatórios)</p>
                  <label className="block">Nome que aparece no relatório<input value={config.nomeExibido ?? ''} maxLength={120} onChange={(e) => setConfig({ ...config, nomeExibido: e.target.value })} placeholder="Em branco = nome do escritório no sistema" className="mt-0.5 w-full px-2.5 py-2 rounded-lg border border-slate-300" /></label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <label className="block">Telefone<input value={config.telefone ?? ''} maxLength={30} onChange={(e) => setConfig({ ...config, telefone: e.target.value })} className="mt-0.5 w-full px-2.5 py-2 rounded-lg border border-slate-300" /></label>
                    <label className="block">E-mail<input value={config.email ?? ''} maxLength={120} inputMode="email" onChange={(e) => setConfig({ ...config, email: e.target.value })} className="mt-0.5 w-full px-2.5 py-2 rounded-lg border border-slate-300" /></label>
                  </div>
                  <label className="block">Rodapé (endereço, CRC, recado)<input value={config.rodape ?? ''} maxLength={300} onChange={(e) => setConfig({ ...config, rodape: e.target.value })} className="mt-0.5 w-full px-2.5 py-2 rounded-lg border border-slate-300" /></label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-3 py-2 rounded-lg border border-slate-300 font-bold flex items-center gap-1 cursor-pointer"><ImageIcon className="w-3.5 h-3.5" />Escolher logo<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void escolherLogo(e)} /></label>
                    {config.logoJpegBase64 && <><img src={`data:image/jpeg;base64,${config.logoJpegBase64}`} alt="Logo do escritório" className="h-10 border border-slate-200 rounded" /><button type="button" className="underline" onClick={() => setConfig({ ...config, logoJpegBase64: null })}>Tirar o logo</button></>}
                  </div>
                  <button type="button" disabled={salvandoConfig} onClick={() => void salvarConfig()} className="px-3 py-2 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-40">{salvandoConfig ? 'Salvando…' : 'Salvar nome e logo'}</button>
                </div>
              )}

              {rel.pendencias.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-bold text-sm">Pendências ({rel.pendencias.filter((p) => p.paraCliente).length} vão no PDF do cliente)</p>
                  <ul className="space-y-1.5">
                    {rel.pendencias.map((p) => {
                      const existente = abertaComChave(p.codigo);
                      return (
                        <li key={p.codigo} className={`rounded-lg border p-2 flex flex-wrap items-start gap-2 ${p.gravidade === 'alta' ? 'border-rose-300 bg-rose-50' : p.gravidade === 'media' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                          <div className="min-w-0 flex-1"><p className="font-bold break-words">{p.tarefa}</p><p className="text-[11px] text-slate-600">{p.paraCliente ? 'Vai no PDF do cliente.' : 'Só para o escritório (não vai no PDF).'}</p></div>
                          {existente
                            ? <span className="px-2 py-1 rounded bg-white border border-emerald-300 text-emerald-800 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Tarefa já criada</span>
                            : <button type="button" disabled={criando === p.codigo} onClick={() => void criarTarefa(p.codigo, p.tarefa)} className="px-2 py-1 rounded bg-indigo-600 text-white font-bold flex items-center gap-1 disabled:opacity-40"><ClipboardPlus className="w-3.5 h-3.5" />Criar tarefa para a equipe</button>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="space-y-1.5">
                <p className="font-bold text-sm">O que vai no PDF</p>
                {rel.secoes.map((s) => (
                  <div key={s.id} className={`rounded-lg border p-2 ${FUNDO[s.cor]}`}>
                    <p className="font-bold flex items-center gap-1.5"><span className={`inline-block w-2.5 h-2.5 rounded-full ${PONTO[s.cor]}`} />{s.titulo}</p>
                    {s.linhas.map((l, i) => <p key={i} className="break-words">{l.texto}</p>)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
