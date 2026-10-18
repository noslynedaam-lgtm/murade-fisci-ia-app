import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Download, RefreshCw, ShieldCheck } from 'lucide-react';

type DfeStatus = {
  certificadoCadastrado: boolean;
  certificadoValidadoPelaSefaz: boolean;
  certificadoValidadoEm: string | null;
  ambienteConfigurado: 'producao' | 'homologacao';
  ultimoNsu: string;
  maiorNsu: string;
  ultimoStatusSefaz: number | null;
  mensagemSefaz: string | null;
  consultadoEm: string | null;
  bloqueadoAte: string | null;
  documentosPersistidos: string;
};

type DfeItem = {
  id: string;
  nsu: string;
  schema: string;
  chave: string | null;
  hashXml: string;
  metadata: {
    tipo?: string;
    direcao?: string | null;
    evento?: {
      codigoEvento?: string | null;
      descricaoEvento?: string | null;
      dataEvento?: string | null;
      sequenciaEvento?: string | null;
      protocoloEvento?: string | null;
      cStatEvento?: string | null;
      motivoEvento?: string | null;
    };
    revisaoEstrutural?: {
      status?: 'SEM_ALERTA_ESTRUTURAL' | 'PENDENTE' | 'REVISAR';
      findings?: Array<{ code: string; severity: 'ERRO' | 'ATENCAO'; message: string }>;
    } | null;
  };
  recebidoEm: string;
};

export function ConsultaSefazDfePanel({ companyId, tenantId, cnpj }: { companyId?: string; tenantId?: string; cnpj?: string }) {
  const [status, setStatus] = useState<DfeStatus | null>(null);
  const [items, setItems] = useState<DfeItem[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [busy, setBusy] = useState(false);
  const pronto = Boolean(companyId && tenantId);

  const carregar = useCallback(async () => {
    if (!companyId || !tenantId) { setStatus(null); setItems([]); setBusy(false); return; }
    setBusy(true);
    try {
      const query = new URLSearchParams({ tenantId });
      const [statusResponse, itemsResponse] = await Promise.all([
        fetch(`/api/companies/${encodeURIComponent(companyId)}/sefaz-dfe/status?${query}`, { credentials: 'same-origin', cache: 'no-store' }),
        fetch(`/api/companies/${encodeURIComponent(companyId)}/sefaz-dfe/items?${query}`, { credentials: 'same-origin', cache: 'no-store' }),
      ]);
      const statusJson = await statusResponse.json().catch(() => ({}));
      const itemsJson = await itemsResponse.json().catch(() => ({}));
      if (!statusResponse.ok) throw new Error(statusJson?.mensagem || 'Não foi possível obter o estado da integração.');
      if (!itemsResponse.ok) throw new Error(itemsJson?.mensagem || 'Não foi possível listar os documentos recebidos.');
      setStatus(statusJson as DfeStatus);
      setItems(Array.isArray(itemsJson?.documentos) ? itemsJson.documentos as DfeItem[] : []);
      setMensagem('');
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Falha ao carregar o estado da Distribuição DF-e.');
    } finally { setBusy(false); }
  }, [companyId, tenantId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const consultar = async () => {
    if (!companyId || !tenantId || !status?.certificadoCadastrado) return;
    const ambiente = status.ambienteConfigurado === 'homologacao' ? 'homologação' : 'produção';
    const autorizou = window.confirm(
      `A próxima ação fará uma consulta autenticada ao WebService oficial da SEFAZ em ${ambiente}, usando o certificado A1 vinculado ao CNPJ ${cnpj || 'selecionado'} e o NSU salvo. A SEFAZ receberá uma requisição de consulta, mas o sistema não transmitirá notas nem eventos. Continuar?`,
    );
    if (!autorizou) return;
    setBusy(true);
    setMensagem('Consultando o WebService da SEFAZ e salvando a resposta…');
    try {
      const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}/sefaz-dfe/consult`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ tenantId, confirmarConsulta: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.mensagem || 'A consulta oficial não foi confirmada.');
      const resumo = `SEFAZ cStat ${data.cStat}: ${data.mensagem} Recebidos ${data.documentosRecebidos}; novos e persistidos ${data.documentosNovos}; NF-e estruturadas no acervo fiscal ${data.notasFiscalNormalizadas ?? 0}. NSU ${data.ultimoNsu} / máximo ${data.maiorNsu}. ${data.proximaAcao}`;
      await carregar();
      setMensagem(resumo);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'A consulta falhou. Nenhum NSU foi avançado sem resposta válida.');
    } finally { setBusy(false); }
  };

  const baixar = async (item: DfeItem) => {
    if (!companyId || !tenantId) return;
    try {
      setBusy(true);
      const query = new URLSearchParams({ tenantId });
      const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}/sefaz-dfe/items/${encodeURIComponent(item.id)}/xml?${query}`, {
        credentials: 'same-origin', cache: 'no-store',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.mensagem || 'Não foi possível abrir o XML guardado.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.chave ? `${item.chave}-${item.nsu}.xml` : `dfe-nsu-${item.nsu}.xml`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Não foi possível baixar o documento armazenado.');
    } finally { setBusy(false); }
  };

  return <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3" aria-label="Consulta oficial de documentos fiscais DF-e">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-64 flex-1">
        <h3 className="text-sm font-black text-blue-950"><ShieldCheck className="mr-1 inline h-4 w-4"/>Distribuição DF-e oficial da SEFAZ</h3>
        <p className="mt-1 text-[11px] text-blue-900">Consulta sob demanda com A1 no servidor. Cada chamada exige sua confirmação; documentos e eventos recebidos são guardados cifrados por empresa. A disponibilidade do XML completo depende das regras oficiais e do papel do CNPJ.</p>
        <p className="mt-1 text-[11px] font-semibold text-blue-900">Isto não busca as notas emitidas pela própria empresa: a saída do emitente precisa vir do sistema emissor ou de outra fonte autorizada.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={() => void carregar()} disabled={!pronto || busy} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-900 disabled:opacity-50"><RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`}/>Atualizar estado</button>
        <button type="button" onClick={() => void consultar()} disabled={!pronto || !status?.certificadoCadastrado || busy} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Consultar agora (com confirmação)</button>
      </div>
    </div>
    {!pronto && <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">Selecione uma empresa cadastrada na carteira central para consultar o estado oficial.</p>}
    {status && <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border bg-white p-2"><span className="text-slate-500">Certificado no servidor</span><div className="font-bold">{!status.certificadoCadastrado ? 'Falta cadastrar' : status.certificadoValidadoPelaSefaz ? 'Validado em consulta SEFAZ' : 'Cadastrado; ainda não validado'}</div><div className="text-[10px] text-slate-500">{status.certificadoValidadoEm ? `Resposta válida em ${new Date(status.certificadoValidadoEm).toLocaleString('pt-BR')}.` : 'Cadastro não significa validação SEFAZ.'}</div></div>
      <div className="rounded-lg border bg-white p-2"><span className="text-slate-500">Posição de distribuição</span><div className="font-bold">NSU {status.ultimoNsu} / {status.maiorNsu}</div></div>
      <div className="rounded-lg border bg-white p-2"><span className="text-slate-500">Última resposta oficial</span><div className="font-bold">{status.ultimoStatusSefaz ? `cStat ${status.ultimoStatusSefaz}` : 'Ainda não consultada'}</div><div className="text-[10px] text-slate-500">{status.consultadoEm ? new Date(status.consultadoEm).toLocaleString('pt-BR') : 'Sem resposta registrada'}</div></div>
      <div className="rounded-lg border bg-white p-2"><span className="text-slate-500">Arquivados neste sistema</span><div className="font-bold">{status.documentosPersistidos} DF-e / eventos</div><div className="text-[10px] text-slate-500">Ambiente: {status.ambienteConfigurado}</div></div>
    </div>}
    {status?.bloqueadoAte && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950"><AlertTriangle className="mr-1 inline h-4 w-4"/>A SEFAZ exige aguardar até {new Date(status.bloqueadoAte).toLocaleString('pt-BR')} antes de consultar novamente.</p>}
    {status?.ultimoStatusSefaz && status?.mensagemSefaz && <p className="text-xs text-slate-700">Último motivo informado pela SEFAZ: {status.mensagemSefaz}</p>}
    {mensagem && <p role="status" className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800">{mensagem}</p>}
    {items.length > 0 && <div className="overflow-x-auto rounded-lg border border-blue-200 bg-white">
      <table className="w-full text-left text-xs"><thead className="bg-blue-100 text-blue-950"><tr><th className="p-2">NSU</th><th className="p-2">Tipo / schema</th><th className="p-2">Conferência estrutural</th><th className="p-2">Direção identificada</th><th className="p-2">Chave</th><th className="p-2">Recebido</th><th className="p-2">Arquivo</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{items.map(item => <tr key={item.id}><td className="p-2 font-mono">{item.nsu}</td><td className="p-2">{item.metadata?.tipo || item.schema}<div className="text-[10px] text-slate-500">{item.schema}</div>{item.metadata?.evento && <div className="mt-1 max-w-64 text-[10px] text-amber-800">{item.metadata.evento.descricaoEvento || `Evento ${item.metadata.evento.codigoEvento || ''}`} · sequência {item.metadata.evento.sequenciaEvento || '—'}<br/>{item.metadata.evento.dataEvento ? new Date(item.metadata.evento.dataEvento).toLocaleString('pt-BR') : 'Data não identificada'}<br/>Retorno SEFAZ: cStat {item.metadata.evento.cStatEvento || 'não identificado'}{item.metadata.evento.motivoEvento ? ` — ${item.metadata.evento.motivoEvento}` : ''}{item.metadata.evento.protocoloEvento ? <><br/>Protocolo {item.metadata.evento.protocoloEvento}</> : null}<br/><span className="font-semibold">Confira o efeito do evento antes de atualizar a situação da nota.</span></div>}</td><td className="p-2"><span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${item.metadata?.revisaoEstrutural?.status === 'REVISAR' ? 'bg-red-100 text-red-800' : item.metadata?.revisaoEstrutural?.status === 'PENDENTE' ? 'bg-amber-100 text-amber-900' : item.metadata?.revisaoEstrutural?.status === 'SEM_ALERTA_ESTRUTURAL' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{item.metadata?.revisaoEstrutural?.status === 'REVISAR' ? 'Revisar divergência' : item.metadata?.revisaoEstrutural?.status === 'PENDENTE' ? 'Pendente' : item.metadata?.revisaoEstrutural?.status === 'SEM_ALERTA_ESTRUTURAL' ? 'Sem alerta estrutural' : 'Não executada'}</span>{item.metadata?.revisaoEstrutural?.findings?.map((finding, index) => <div key={`${finding.code}-${index}`} className={`mt-1 max-w-72 text-[10px] ${finding.severity === 'ERRO' ? 'text-red-800' : 'text-amber-800'}`}>{finding.message}</div>)}{item.metadata?.revisaoEstrutural && <div className="mt-1 max-w-72 text-[10px] text-slate-500">Conferência estrutural do XML; não substitui validação tributária ou consulta de autenticidade.</div>}</td><td className="p-2">{item.metadata?.direcao || 'Não identificado no XML'}</td><td className="p-2 font-mono">{item.chave || '—'}</td><td className="p-2">{new Date(item.recebidoEm).toLocaleString('pt-BR')}</td><td className="p-2"><button type="button" onClick={() => void baixar(item)} disabled={busy} className="rounded border border-blue-200 px-2 py-1 font-semibold text-blue-800 disabled:opacity-50"><Download className="mr-1 inline h-3 w-3"/>XML</button></td></tr>)}</tbody>
      </table>
    </div>}
  </section>;
}
