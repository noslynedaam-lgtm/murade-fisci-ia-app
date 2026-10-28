import React, { useEffect, useMemo, useState } from 'react';
import CotaConsultasSerpro from './CotaConsultasSerpro';
import ConsumoSerproMensal from './ConsumoSerproMensal';
import { acharPdfBase64, declaracoesParaCsv, lerDeclaracoes, lerDetalheCaixaPostal, lerIndicadorNovasCaixaPostal, lerListaCaixaPostal, lerDetalheParcsn, lerPagamentoParcsn, lerParcelasParaGerarParcsn, lerPedidosParcsn, type LinhaDeclaracao } from '../services/serpro/resultadoSerpro';

interface Campo { nome: string; rotulo: string; exemplo: string; opcional?: boolean }
interface Prontidao { pronto: boolean; itens: { chave: string; ok: boolean; descricao: string }[]; servicos: { chave: string; descricao: string; campos?: Campo[] }[] }
interface Resposta { ok: boolean; titulo: string; texto: string; bruto?: unknown; relatorio?: unknown; servico?: string; consultadoEm?: string }

const reaisPS = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

function baixarCsv(linhas: LinhaDeclaracao[], nome: string) {
  const blob = new Blob([declaracoesParaCsv(linhas)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function pdfDeBase64(b64: string): Blob {
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'application/pdf' });
}

function imprimir(linhas: LinhaDeclaracao[], empresa: string, quando: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  const corpo = linhas.map(l => `<tr><td>${esc(l.periodo)}</td><td>${esc(l.numero)}</td><td>${esc(l.tipo)}</td><td>${esc(l.transmitidoEm)}</td><td>${esc(l.das)}</td></tr>`).join('');
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Declarações PGDAS-D</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#0f172a}h1{font-size:20px}p{font-size:13px;color:#475569}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#e2e8f0}</style><h1>Simples Nacional · declarações transmitidas (PGDAS-D)</h1><p>${esc(empresa)}<br>Fonte: SERPRO / Receita Federal · Consultado em ${esc(quando)}</p><table><thead><tr><th>Período</th><th>Nº da declaração</th><th>Tipo</th><th>Transmitida em</th><th>DAS</th></tr></thead><tbody>${corpo}</tbody></table>`);
  w.document.close(); w.focus(); w.print();
}

/** Consulta oficial real ao SERPRO (Integra Contador) para a empresa ativa. Só a conta administradora; o servidor trava o custo. */
export default function ConsultaRealSerpro({ companyId, tenantId, razaoSocial, cnpj }: { companyId?: string; tenantId?: string; razaoSocial?: string; cnpj?: string }) {
  const [prontidao, setProntidao] = useState<Prontidao | null>(null);
  const [servico, setServico] = useState('');
  const [dados, setDados] = useState<Record<string, string>>({ anoCalendario: String(new Date().getFullYear()), statusLeitura: '2', indicadorPagina: '0' });
  const [carregando, setCarregando] = useState(false);
  const [exigeConfirmar, setExigeConfirmar] = useState<string | null>(null);
  const [exigeCiencia, setExigeCiencia] = useState<string | null>(null);
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [mostrarTecnico, setMostrarTecnico] = useState(false);
  const [versaoCota, setVersaoCota] = useState(0);

  useEffect(() => {
    let ativo = true;
    fetch('/api/serpro/prontidao', { credentials: 'same-origin', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Prontidao) => { if (ativo) { setProntidao(d); setServico(s => s || d.servicos[0]?.chave || ''); } })
      .catch(() => { if (ativo) setProntidao(null); });
    return () => { ativo = false; };
  }, []);

  const pdfBase64 = useMemo(() => (resposta?.ok ? acharPdfBase64(resposta.relatorio) : null), [resposta]);
  const listaCP = useMemo(() => (resposta?.ok && resposta.servico === 'caixaPostalLista' ? lerListaCaixaPostal(resposta.bruto) : null), [resposta]);
  const detalheCP = useMemo(() => (resposta?.ok && resposta.servico === 'caixaPostalDetalhe' ? lerDetalheCaixaPostal(resposta.bruto) : null), [resposta]);
  const novasCP = useMemo(() => (resposta?.ok && resposta.servico === 'caixaPostalNovas' ? lerIndicadorNovasCaixaPostal(resposta.bruto) : null), [resposta]);
  const pedidosPS = useMemo(() => (resposta?.ok && (resposta.servico === 'parcsnPedidos' || resposta.servico === 'parcsnEspPedidos' || resposta.servico === 'parcmeiPedidos') ? lerPedidosParcsn(resposta.bruto) : null), [resposta]);
  const detalhePS = useMemo(() => (resposta?.ok && (resposta.servico === 'parcsnDetalhe' || resposta.servico === 'parcsnEspDetalhe' || resposta.servico === 'parcmeiDetalhe') ? lerDetalheParcsn(resposta.bruto) : null), [resposta]);
  const pagamentoPS = useMemo(() => (resposta?.ok && (resposta.servico === 'parcsnPagamento' || resposta.servico === 'parcsnEspPagamento' || resposta.servico === 'parcmeiPagamento') ? lerPagamentoParcsn(resposta.bruto) : null), [resposta]);
  const parcelasPS = useMemo(() => (resposta?.ok && (resposta.servico === 'parcsnParcelas' || resposta.servico === 'parcsnEspParcelas' || resposta.servico === 'parcmeiParcelas') ? lerParcelasParaGerarParcsn(resposta.bruto) : null), [resposta]);
  const pdfDas = useMemo(() => (resposta?.ok && (resposta.servico === 'parcsnDas' || resposta.servico === 'parcsnEspDas' || resposta.servico === 'parcmeiDas') ? acharPdfBase64(resposta.bruto) : null), [resposta]);
  const linhas = useMemo(() => (resposta?.ok && resposta.servico === 'declaracoesSimples' ? lerDeclaracoes(resposta.bruto) : null), [resposta]);

  if (!companyId || !tenantId) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">Selecione uma empresa já cadastrada no Fisco IA (banco permanente) para fazer a consulta oficial ao SERPRO.</div>;
  }

  function prepararConsulta(chave: string, novos: Record<string, string>) { setServico(chave); setDados(d => ({ ...d, ...novos })); setResposta(null); }

  function abrirMensagem(isn: string) {
    setServico('caixaPostalDetalhe'); setDados(d => ({ ...d, isn }));
    setExigeCiencia('Abrir esta mensagem pelo sistema conta como CIÊNCIA da intimação e passa a contar os prazos, igual a abrir no e-CAC. Só abra se for o momento certo. Esta consulta usa a cota de consultas da empresa.');
  }

  async function consultar(confirmarCusto: boolean, confirmarCiencia = false) {
    setCarregando(true); setExigeCiencia(null); setResposta(null); setMostrarTecnico(false);
    try {
      const r = await fetch('/api/serpro/consulta', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servico, tenantId, companyId, confirmarCusto, confirmarCiencia, dados }),
      });
      const d = await r.json().catch(() => ({})) as { consultado?: boolean; exigeConfirmacao?: boolean; mensagem?: string; faltando?: string[]; bruto?: unknown; relatorio?: unknown; cabecalhos?: unknown; statusGateway?: number; consultadoEm?: string };
      if (r.status === 409 && (d as { exigeCiencia?: boolean }).exigeCiencia) { setExigeCiencia(d.mensagem || 'Abrir esta mensagem conta como ciência da intimação.'); return; }
      if (r.status === 402 && d.exigeConfirmacao) { setExigeConfirmar(d.mensagem || 'Esta consulta será cobrada à parte pelo SERPRO (contrato: cerca de R$ 0,24 por consulta).'); return; }
      setExigeConfirmar(null);
      if (r.status === 401) setResposta({ ok: false, titulo: 'Sua sessão venceu', texto: 'Saia e entre de novo no Fisco IA e repita a consulta.' });
      else if (r.ok && d.consultado) setResposta({ ok: true, titulo: 'Consulta feita no SERPRO', texto: 'Resposta oficial da Receita/SERPRO. Nada foi inventado ou alterado no sistema.', bruto: d.bruto, relatorio: d.relatorio, servico, consultadoEm: d.consultadoEm });
      else setResposta({ ok: false, titulo: 'Consulta não concluída', texto: [d.mensagem, d.faltando?.length ? `Falta: ${d.faltando.join('; ')}` : '', d.statusGateway ? `(resposta do SERPRO: HTTP ${d.statusGateway})` : ''].filter(Boolean).join(' ') || `Erro HTTP ${r.status}.`, bruto: d.bruto || d.cabecalhos ? { resposta: d.bruto || '(sem corpo na resposta)', cabecalhos: d.cabecalhos } : undefined });
      setVersaoCota(v => v + 1);
    } catch {
      setResposta({ ok: false, titulo: 'Consulta não concluída', texto: 'Não foi possível falar com o servidor. Nada foi consultado.' });
    } finally { setCarregando(false); }
  }

  const campos = prontidao?.servicos.find(s => s.chave === servico)?.campos ?? [];
  const faltando = prontidao?.itens.filter(i => !i.ok) ?? [];
  const quando = resposta?.consultadoEm ? new Date(resposta.consultadoEm).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
  const nomeArquivo = `declaracoes-pgdasd-${(cnpj || companyId).replace(/\D/g, '')}-${dados.anoCalendario || ''}.csv`;
  type Msgs = { mensagens?: { codigo?: string; texto?: string }[] };
  const brutoMsgs = resposta?.bruto as (Msgs & { resposta?: Msgs }) | undefined;
  const mensagensSerpro = brutoMsgs?.mensagens ?? brutoMsgs?.resposta?.mensagens;
  const nomeBase = `${(cnpj || companyId).replace(/\D/g, '')}-${new Date().toISOString().slice(0, 10)}`;
  const tituloServico = prontidao?.servicos.find(sv => sv.chave === resposta?.servico)?.descricao ?? 'Consulta SERPRO';

  return (
    <section className="rounded-2xl border border-indigo-200 bg-white p-4 sm:p-6 space-y-4 shadow-xs text-slate-900">
      <header>
        <h2 className="text-lg sm:text-xl font-black">Consulta oficial (SERPRO / Receita Federal)</h2>
        <p className="text-sm text-slate-700 mt-1">{razaoSocial || 'Empresa ativa'}{cnpj ? ` · ${cnpj}` : ''}</p>
        <p className="text-xs text-slate-600 mt-1">Usa as chaves e o certificado do escritório no servidor. Só a conta administradora. Para empresas clientes, é preciso procuração no e-CAC. A primeira consulta da semana por empresa é gratuita no controle do sistema; as seguintes pedem a sua confirmação (contrato: R$ 0,24 por consulta).</p>
      </header>

      {faltando.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <strong>Ainda falta configurar no Render:</strong>
          <ul className="list-disc ml-5 mt-1">{faltando.map(i => <li key={i.chave}>{i.descricao}</li>)}</ul>
        </div>
      )}

      <CotaConsultasSerpro key={versaoCota} companyId={companyId} tenantId={tenantId} />
      <ConsumoSerproMensal key={`c${versaoCota}`} tenantId={tenantId} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm font-bold text-slate-800 gap-1">Tipo de consulta
          <select value={servico} onChange={e => setServico(e.target.value)} className="px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl min-w-64">
            {(prontidao?.servicos ?? []).map(s => <option key={s.chave} value={s.chave}>{s.descricao}</option>)}
          </select>
        </label>
        {campos.map(c => (
          <label key={c.nome} className="flex flex-col text-sm font-bold text-slate-800 gap-1">{c.rotulo}
            <input value={dados[c.nome] ?? ''} onChange={e => setDados(d => ({ ...d, [c.nome]: e.target.value }))} placeholder={c.exemplo} className="px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl w-52" />
          </label>
        ))}
        <button type="button" disabled={carregando || !servico || faltando.length > 0 || campos.some(c => !c.opcional && !(dados[c.nome] ?? '').trim())} onClick={() => consultar(false)}
          className="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white rounded-xl text-sm font-black cursor-pointer">
          {carregando ? 'Consultando…' : 'Fazer consulta'}
        </button>
      </div>

      {exigeConfirmar && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 space-y-3" role="alertdialog">
          <p>{exigeConfirmar}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => consultar(true, servico === 'caixaPostalDetalhe')} className="px-4 py-2 bg-amber-700 text-white rounded-lg font-bold cursor-pointer">Confirmo o custo e quero consultar</button>
            <button type="button" onClick={() => setExigeConfirmar(null)} className="px-4 py-2 bg-white border border-slate-300 rounded-lg font-bold cursor-pointer">Cancelar</button>
          </div>
        </div>
      )}

      {exigeCiencia && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-950 space-y-3" role="alertdialog">
          <p><strong>Atenção — ciência da intimação.</strong> {exigeCiencia}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => consultar(false, true)} className="px-4 py-2 bg-red-700 text-white rounded-lg font-bold cursor-pointer">Entendo e quero abrir a mensagem</button>
            <button type="button" onClick={() => setExigeCiencia(null)} className="px-4 py-2 bg-white border border-slate-300 rounded-lg font-bold cursor-pointer">Cancelar</button>
          </div>
        </div>
      )}

      {resposta && !resposta.ok && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-950" role="status">
          <strong>{resposta.titulo}.</strong> {resposta.texto}
          {mensagensSerpro?.map((m, i) => <p key={i} className="mt-2 font-semibold">{m.texto}</p>)}
          {resposta.bruto !== undefined && (
            <div className="mt-3">
              <button type="button" onClick={() => setMostrarTecnico(v => !v)} className="text-xs font-bold underline cursor-pointer">{mostrarTecnico ? 'Esconder' : 'Ver'} detalhes técnicos</button>
              {mostrarTecnico && <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white border border-red-200 p-3 text-xs">{JSON.stringify(resposta.bruto, null, 2)}</pre>}
            </div>
          )}
        </div>
      )}

      {resposta?.ok && (
        <div className="space-y-4" role="status">
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-black text-base">{resposta.titulo}</p>
            <p className="mt-1">{tituloServico} · {razaoSocial || 'empresa ativa'} · {quando}</p>
            <p className="mt-1 text-xs">{resposta.texto}</p>
            {mensagensSerpro?.map((m, i) => m.texto && <p key={i} className="mt-1 text-xs">Aviso do SERPRO: {m.texto}</p>)}
          </div>

          {resposta.servico === 'situacaoFiscal' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="font-black text-base">Relatório de Situação Fiscal</p>
              {pdfBase64 ? (
                <>
                  <p className="text-sm text-slate-700">O relatório oficial da Receita Federal está pronto em PDF. Nele constam as pendências e a situação do contribuinte.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => window.open(URL.createObjectURL(pdfDeBase64(pdfBase64)), '_blank')} className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-sm font-bold cursor-pointer">Abrir relatório (PDF)</button>
                    <button type="button" onClick={() => baixarArquivo(pdfDeBase64(pdfBase64), `situacao-fiscal-${nomeBase}.pdf`)} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold cursor-pointer">Baixar PDF</button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-amber-900">O SERPRO aceitou o pedido e gerou o protocolo, mas o relatório em PDF ainda não veio nesta tentativa. Aguarde alguns segundos e consulte de novo (a tela abaixo mostra a resposta técnica).</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => baixarArquivo(new Blob([JSON.stringify({ empresa: razaoSocial, cnpj, consultadoEm: resposta.consultadoEm, resposta: resposta.bruto, relatorio: resposta.relatorio }, null, 2)], { type: 'application/json' }), `consulta-serpro-${nomeBase}.json`)} className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-sm font-bold cursor-pointer">Baixar resposta completa (.json)</button>
          </div>

          {pedidosPS && (
            <div className="space-y-2">
              <p className="text-sm font-bold">{pedidosPS.length} pedido(s) de parcelamento.</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left text-slate-700"><tr><th className="p-3">Nº</th><th className="p-3">Pedido em</th><th className="p-3">Situação</th><th className="p-3">Desde</th><th className="p-3"></th></tr></thead>
                  <tbody>{pedidosPS.map((p, i) => (
                    <tr key={`${p.numero}-${i}`} className="border-t border-slate-100"><td className="p-3 font-mono">{p.numero}</td><td className="p-3">{p.pedidoEm}</td><td className="p-3 font-bold">{p.situacao}</td><td className="p-3">{p.situacaoEm || '—'}</td>
                      <td className="p-3"><button type="button" onClick={() => prepararConsulta(resposta?.servico === 'parcsnEspPedidos' ? 'parcsnEspDetalhe' : resposta?.servico === 'parcmeiPedidos' ? 'parcmeiDetalhe' : 'parcsnDetalhe', { numeroParcelamento: p.numero })} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer">Preparar detalhe</button></td></tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="text-xs text-slate-600">O botão só preenche o número; o detalhe usa uma nova consulta (cota da semana) quando você clicar em "Fazer consulta".</p>
            </div>
          )}

          {parcelasPS && (
            <div className="space-y-2">
              <p className="text-sm font-bold">{parcelasPS.length} parcela(s) disponível(is) para emitir o DAS.</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left text-slate-700"><tr><th className="p-3">Parcela</th><th className="p-3">Valor</th><th className="p-3"></th></tr></thead>
                  <tbody>{parcelasPS.map((p, i) => (
                    <tr key={`${p.parcela}-${i}`} className="border-t border-slate-100"><td className="p-3 font-bold">{p.parcela}</td><td className="p-3">{p.valor === null ? '—' : reaisPS(p.valor)}</td>
                      <td className="p-3"><button type="button" onClick={() => prepararConsulta(resposta?.servico === 'parcsnEspParcelas' ? 'parcsnEspDas' : resposta?.servico === 'parcmeiParcelas' ? 'parcmeiDas' : 'parcsnDas', { parcelaParaEmitir: p.parcela.split('/').reverse().join('') })} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer">Preparar DAS</button></td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {pdfDas && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="font-black text-base">DAS do parcelamento</p>
              <p className="text-sm text-slate-700">Confira valor e vencimento no PDF antes de pagar.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => window.open(URL.createObjectURL(pdfDeBase64(pdfDas)), '_blank')} className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-sm font-bold cursor-pointer">Abrir DAS (PDF)</button>
                <button type="button" onClick={() => baixarArquivo(pdfDeBase64(pdfDas), `das-parcelamento-${nomeBase}.pdf`)} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold cursor-pointer">Baixar PDF</button>
              </div>
            </div>
          )}

          {detalhePS && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="font-black text-base">Parcelamento nº {detalhePS.numero} — {detalhePS.situacao}</p>
              <p className="text-xs text-slate-600">Pedido em {detalhePS.pedidoEm}{detalhePS.situacaoEm ? ` · situação desde ${detalhePS.situacaoEm}` : ''}{detalhePS.alteracoesDivida ? ` · ${detalhePS.alteracoesDivida} alteração(ões) de dívida (veja a resposta técnica)` : ''}</p>
              {detalhePS.consolidacao && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-lg bg-white border border-slate-200 p-2"><div className="text-xs font-bold">Total consolidado</div><div className="font-black">{detalhePS.consolidacao.valorTotal === null ? '—' : reaisPS(detalhePS.consolidacao.valorTotal)}</div></div>
                  <div className="rounded-lg bg-white border border-slate-200 p-2"><div className="text-xs font-bold">Parcelas</div><div className="font-black">{detalhePS.consolidacao.quantidadeParcelas ?? '—'}</div></div>
                  <div className="rounded-lg bg-white border border-slate-200 p-2"><div className="text-xs font-bold">1ª parcela</div><div className="font-black">{detalhePS.consolidacao.primeiraParcela === null ? '—' : reaisPS(detalhePS.consolidacao.primeiraParcela)}</div></div>
                  <div className="rounded-lg bg-white border border-slate-200 p-2"><div className="text-xs font-bold">Parcela básica</div><div className="font-black">{detalhePS.consolidacao.parcelaBasica === null ? '—' : reaisPS(detalhePS.consolidacao.parcelaBasica)}</div></div>
                </div>
              )}
              {detalhePS.pagamentos.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-left text-slate-700"><tr><th className="p-3">Parcela</th><th className="p-3">Vencimento do DAS</th><th className="p-3">Arrecadado em</th><th className="p-3">Valor pago</th><th className="p-3"></th></tr></thead>
                    <tbody>{detalhePS.pagamentos.map((p, i) => (
                      <tr key={`${p.mes}-${i}`} className="border-t border-slate-100"><td className="p-3 font-bold">{p.mes}</td><td className="p-3">{p.vencimentoDas || '—'}</td><td className="p-3">{p.arrecadadoEm || '—'}</td><td className="p-3">{p.valorPago === null ? '—' : reaisPS(p.valorPago)}</td>
                        <td className="p-3"><button type="button" onClick={() => prepararConsulta(resposta?.servico === 'parcsnEspDetalhe' ? 'parcsnEspPagamento' : resposta?.servico === 'parcmeiDetalhe' ? 'parcmeiPagamento' : 'parcsnPagamento', { numeroParcelamento: detalhePS.numero, anoMesParcela: p.mes.split('/').reverse().join('') })} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer">Preparar detalhe do pagamento</button></td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {pagamentoPS && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
              <p className="font-black text-base">Pagamento da parcela {pagamentoPS.parcela} do parcelamento {pagamentoPS.parcelamento}</p>
              <p>DAS nº {pagamentoPS.numeroDas || '—'} · vencimento {pagamentoPS.vencimento || '—'} · pago em {pagamentoPS.pagoEm || '—'} · {pagamentoPS.bancoAgencia || 'banco não informado'} · arrecadado {pagamentoPS.valorArrecadado === null ? '—' : reaisPS(pagamentoPS.valorArrecadado)}</p>
              {pagamentoPS.debitos.map((d, i) => (
                <div key={i} className="rounded-lg bg-white border border-slate-200 p-2">
                  <p className="text-xs font-bold">Débito de {d.periodo || '—'}{d.processo ? ` · processo ${d.processo}` : ''}</p>
                  {d.itens.map((it, j) => <p key={j} className="text-xs">{it.tributo}: principal {it.principal === null ? '—' : reaisPS(it.principal)} · multa {it.multa === null ? '—' : reaisPS(it.multa)} · juros {it.juros === null ? '—' : reaisPS(it.juros)} · total {it.total === null ? '—' : reaisPS(it.total)}{it.ente ? ` · ${it.ente}` : ''}</p>)}
                </div>
              ))}
            </div>
          )}

          {novasCP !== null && (
            <div className={`rounded-xl border p-4 text-sm ${novasCP === 0 ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-amber-300 bg-amber-50 text-amber-950'}`}>
              <p className="font-black text-base">{novasCP === 0 ? 'Nenhuma mensagem nova na Caixa Postal.' : novasCP === 1 ? 'Há 1 mensagem nova na Caixa Postal.' : 'Há mensagens novas na Caixa Postal.'}</p>
              {novasCP !== 0 && <p className="mt-1">Use "Caixa Postal: lista de mensagens" para ver o assunto de cada uma. Ver a lista não dá ciência; só abrir a mensagem dá.</p>}
            </div>
          )}

          {listaCP && (
            <div className="space-y-3">
              <p className="text-sm font-bold">{listaCP.quantidade} mensagem(ns) nesta página{listaCP.ultimaPagina ? ' (última página)' : ''}.{listaCP.proximaPagina ? ` Para ver mais, use a página 1 com o ponteiro ${listaCP.proximaPagina}.` : ''}</p>
              <p className="text-xs text-slate-600">A lista não dá ciência. Só o botão "Abrir" pede confirmação e conta como ciência da intimação.</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left text-slate-700"><tr><th className="p-3">Enviada em</th><th className="p-3">Assunto</th><th className="p-3">Origem</th><th className="p-3">Situação</th><th className="p-3"></th></tr></thead>
                  <tbody>
                    {listaCP.mensagens.map((m, i) => (
                      <tr key={`${m.isn}-${i}`} className="border-t border-slate-100">
                        <td className="p-3 whitespace-nowrap">{m.enviadaEm}</td>
                        <td className="p-3">{m.assunto}{m.relevante ? <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-900">relevante</span> : null}</td>
                        <td className="p-3">{m.origem || '—'}</td>
                        <td className="p-3">{m.lida === true ? `Lida${m.dataLeitura ? ` em ${m.dataLeitura}` : ''}` : m.lida === false ? 'Não lida' : '—'}</td>
                        <td className="p-3"><button type="button" onClick={() => abrirMensagem(m.isn)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer">Abrir (dá ciência)</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {detalheCP && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <p className="font-black text-base">{detalheCP.assunto}</p>
              <p className="text-xs text-slate-600">Enviada em {detalheCP.enviadaEm} · {detalheCP.origem || 'origem não informada'}{detalheCP.cienciaEm ? ` · ciência em ${detalheCP.cienciaEm}` : ''}{detalheCP.validade ? ` · validade ${detalheCP.validade}` : ''}</p>
              <pre className="whitespace-pre-wrap break-words text-sm bg-white border border-slate-200 rounded-lg p-3">{detalheCP.corpo || 'Sem texto.'}</pre>
            </div>
          )}

          {linhas && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-600">Declarações encontradas</p><p className="text-2xl font-black">{linhas.length}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-600">Períodos</p><p className="text-2xl font-black">{new Set(linhas.map(l => l.periodo)).size}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-600">Retificadoras</p><p className="text-2xl font-black">{linhas.filter(l => /retific/i.test(l.tipo)).length}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-600">Consultado em</p><p className="text-sm font-black">{quando}</p></div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => baixarCsv(linhas, nomeArquivo)} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold cursor-pointer">Baixar para Excel (.csv)</button>
                <button type="button" onClick={() => imprimir(linhas, `${razaoSocial || ''} ${cnpj || ''}`.trim(), quando)} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold cursor-pointer">Imprimir / salvar em PDF</button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left text-slate-700">
                    <tr><th className="p-3">Período</th><th className="p-3">Nº da declaração</th><th className="p-3">Tipo</th><th className="p-3">Transmitida em</th><th className="p-3">DAS</th></tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, i) => (
                      <tr key={`${l.numero}-${i}`} className="border-t border-slate-100">
                        <td className="p-3 font-bold">{l.periodo}</td>
                        <td className="p-3 font-mono text-xs sm:text-sm">{l.numero}</td>
                        <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${/retific/i.test(l.tipo) ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>{l.tipo}</span></td>
                        <td className="p-3">{l.transmitidoEm}</td>
                        <td className="p-3">{l.das}{l.dasPago === true ? ' · pago' : l.dasPago === false ? ' · em aberto' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-600">Esta consulta não fica guardada no sistema: para guardar, use os botões acima.</p>
            </>
          )}

          <button type="button" onClick={() => setMostrarTecnico(v => !v)} className="text-xs font-bold text-indigo-800 underline cursor-pointer">{mostrarTecnico ? 'Esconder' : 'Ver'} resposta técnica completa</button>
          {mostrarTecnico && <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs">{typeof resposta.bruto === 'string' ? resposta.bruto : JSON.stringify(resposta.bruto, null, 2)}</pre>}
        </div>
      )}
    </section>
  );
}
