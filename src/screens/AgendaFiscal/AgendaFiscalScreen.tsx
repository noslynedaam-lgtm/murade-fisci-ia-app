import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, format, isSameMonth, parseISO, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Bell, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, ShieldAlert } from 'lucide-react';
import { useEmpresa } from '../../context/EmpresaContext';
import { ItemAgendaFiscal } from '../../types';
import BotaoVoltar from '../../components/BotaoVoltar';
import SeletorEmpresaGlobal from '../../components/SeletorEmpresaGlobal';
import CardLembrete from './CardLembrete';
import {
  chaveNotificacaoLembrete,
  gerarAgenda,
  listarLembretesFiscais,
  LembreteFiscalLocal,
  salvarLembretesFiscais,
  verificarLembretesDoDia
} from '../../services/agenda/lembrete.service';

const hojeISO = () => {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
};
const SEM_LEMBRETES: LembreteFiscalLocal[] = [];

export default function AgendaFiscalScreen() {
  const { empresas, empresaAtiva } = useEmpresa();
  const [mesAtual, setMesAtual] = useState(() => startOfMonth(new Date()));
  const [agora, setAgora] = useState(() => new Date());
  const [leituraLembretes, setLeituraLembretes] = useState(() => listarLembretesFiscais());
  const lembretes: LembreteFiscalLocal[] = leituraLembretes.ok ? leituraLembretes.lembretes : SEM_LEMBRETES;
  const [filtro, setFiltro] = useState<'TODOS' | 'VENCIDOS' | 'HOJE' | 'URGENTES'>('TODOS');
  const [itemSelecionado, setItemSelecionado] = useState<ItemAgendaFiscal | null>(null);
  const [modalNovo, setModalNovo] = useState(false);
  const [empresaId, setEmpresaId] = useState(empresaAtiva?.id ?? empresaAtiva?.cnpj ?? '');
  const [titulo, setTitulo] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [diasAviso, setDiasAviso] = useState('10, 5, 2, 1, 0');
  const [mensagem, setMensagem] = useState('');
  const [permissaoNotificacao, setPermissaoNotificacao] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const avisosEmitidosNestaSessao = useRef(new Set<string>());

  const agendaCompleta = useMemo(() => {
    void agora;
    return gerarAgenda(lembretes);
  }, [lembretes, agora]);
  const lembretesDoDia = useMemo(() => verificarLembretesDoDia(agendaCompleta), [agendaCompleta]);
  const agendaMes = agendaCompleta.filter(item => isSameMonth(item.dataVencimento, mesAtual));
  const agendaFiltrada = agendaMes.filter(item => {
    if (filtro === 'TODOS') return true;
    if (item.status.texto === 'CONCLUÍDO') return false;
    if (filtro === 'VENCIDOS') return item.status.texto === 'VENCIDO';
    if (filtro === 'HOJE') return item.status.texto === 'HOJE';
    return item.diasParaVencer >= 0 && item.diasParaVencer <= 3;
  });
  const totalVencidos = agendaMes.filter(item => item.status.texto === 'VENCIDO').length;
  const totalUrgentes = agendaMes.filter(item => item.status.texto !== 'CONCLUÍDO' && item.diasParaVencer >= 0 && item.diasParaVencer <= 3).length;
  const totalPendentes = agendaMes.filter(item => item.status.texto !== 'CONCLUÍDO').length;

  const salvarLista = (novos: LembreteFiscalLocal[], sucesso: string) => {
    if (!leituraLembretes.ok) {
      setMensagem('Não é possível alterar a agenda porque a leitura falhou. Os dados existentes foram preservados.');
      return false;
    }
    if (!salvarLembretesFiscais(novos)) {
      setMensagem('Falha ao salvar. O navegador pode estar sem espaço ou com armazenamento bloqueado.');
      return false;
    }
    setLeituraLembretes({ ok: true, lembretes: novos });
    setMensagem(sucesso);
    return true;
  };

  const adicionarLembrete = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const empresa = empresas.find(item => (item.id ?? item.cnpj) === empresaId);
    const dataSelecionada = /^\d{4}-\d{2}-\d{2}$/.test(dataVencimento) ? parseISO(dataVencimento) : new Date(Number.NaN);
    if (!empresa || !titulo.trim() || Number.isNaN(dataSelecionada.getTime()) || format(dataSelecionada, 'yyyy-MM-dd') !== dataVencimento) {
      setMensagem('Informe a empresa, o nome do lembrete e uma data válida.');
      return;
    }
    const avisos: number[] = [];
    for (const textoAviso of diasAviso.split(',')) {
      const valor = Number(textoAviso.trim());
      if (Number.isInteger(valor) && valor >= 0 && valor <= 365 && !avisos.includes(valor)) avisos.push(valor);
    }
    avisos.sort((a, b) => b - a);
    const novo: LembreteFiscalLocal = {
      id: crypto.randomUUID(),
      empresaId,
      empresa: empresa.razaoSocial,
      cnpj: empresa.cnpj,
      titulo: titulo.trim(),
      dataVencimento,
      alertas: avisos,
      concluido: false,
      criadoEm: new Date().toISOString()
    };
    if (salvarLista([novo, ...lembretes], 'Lembrete local criado. A data foi informada por você e não foi validada em portal oficial.')) {
      setMesAtual(startOfMonth(parseISO(dataVencimento)));
      setModalNovo(false);
      setTitulo('');
      setDataVencimento('');
    }
  };

  const alternarConclusao = (id: string) => {
    const novos = lembretes.map(item => item.id === id ? { ...item, concluido: !item.concluido } : item);
    salvarLista(novos, 'Estado do lembrete atualizado neste navegador. Isso não confirma pagamento nem transmissão.');
  };

  const excluirLembrete = (id: string) => {
    if (!window.confirm('Apagar este lembrete local?')) return;
    const novos = lembretes.filter(item => item.id !== id);
    salvarLista(novos, 'Lembrete local apagado.');
  };

  const avisarPendencias = useCallback(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const leitura = listarLembretesFiscais();
    if ('erro' in leitura) {
      setLeituraLembretes(atual => atual.ok ? leitura : atual);
      setMensagem(leitura.erro);
      return;
    }
    const pendentes = verificarLembretesDoDia(gerarAgenda(leitura.lembretes));
    const hoje = new Date();
    for (const item of pendentes) {
      const key = chaveNotificacaoLembrete(item.id, hoje);
      let jaNotificado: boolean;
      try {
        jaNotificado = localStorage.getItem(key) === '1';
      } catch {
        setMensagem('Não foi possível verificar o histórico local dos avisos; notificações suspensas para evitar repetição.');
        return;
      }
      if (jaNotificado || avisosEmitidosNestaSessao.current.has(key)) continue;
      try {
        new Notification(`Lembrete local: ${item.empresa}`, {
          body: `${item.tipo} — ${item.diasParaVencer < 0 ? `${Math.abs(item.diasParaVencer)} dia(s) vencido` : item.diasParaVencer === 0 ? 'vence hoje' : `vence em ${item.diasParaVencer} dia(s)`}. Confira a data informada.`,
          tag: key
        });
        avisosEmitidosNestaSessao.current.add(key);
        try { localStorage.setItem(key, '1'); } catch {
          setMensagem('O lembrete foi exibido, mas o navegador não conseguiu salvar o histórico local do aviso. Ele não será repetido nesta sessão.');
        }
      } catch {
        setMensagem('O navegador não conseguiu exibir a notificação. O lembrete continua visível na agenda aberta.');
        return;
      }
    }
  }, []);

  useEffect(() => {
    avisarPendencias();
    const timer = window.setInterval(() => {
      setAgora(new Date());
      avisarPendencias();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [avisarPendencias, lembretes]);

  useEffect(() => {
    const recarregarSeAlterada = (event: StorageEvent) => {
      if (event.key === 'murade_agenda_lembretes_locais_v1') {
        setLeituraLembretes(listarLembretesFiscais());
      }
    };
    window.addEventListener('storage', recarregarSeAlterada);
    return () => window.removeEventListener('storage', recarregarSeAlterada);
  }, []);

  const ativarNotificacoes = async () => {
    if (!('Notification' in window)) {
      setPermissaoNotificacao('unsupported');
      setMensagem('Este navegador não oferece notificações. Os lembretes aparecem apenas na agenda aberta.');
      return;
    }
    const permissao = await Notification.requestPermission();
    setPermissaoNotificacao(permissao);
    if (permissao === 'granted') {
      setMensagem('Notificações deste navegador ativadas. Só funcionam enquanto a agenda estiver aberta; não enviam e-mail ou WhatsApp.');
      avisarPendencias();
    } else setMensagem('Permissão negada. Os lembretes continuam visíveis na agenda aberta.');
  };

  return (
    <div id="agenda-fiscal-screen" className="space-y-6 max-w-5xl mx-auto pb-12">
      <BotaoVoltar />
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2"><span className="p-2 rounded-lg bg-indigo-100 text-indigo-700"><CalendarIcon className="w-5 h-5" /></span><h1 className="text-2xl font-extrabold text-slate-900">Agenda Fiscal & Lembretes</h1></div>
          <p className="text-xs text-slate-600 mt-1">Lembretes manuais, salvos neste navegador. Não são prazos oficiais, consulta fiscal ou confirmação de pagamento.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeletorEmpresaGlobal tamanho="medio" />
          <button type="button" onClick={() => { setEmpresaId(empresaAtiva?.id ?? empresaAtiva?.cnpj ?? ''); setModalNovo(true); }} disabled={!empresas.length} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2"><Plus className="w-4 h-4" />Novo lembrete</button>
          <button type="button" onClick={() => void ativarNotificacoes()} disabled={permissaoNotificacao === 'granted' || permissaoNotificacao === 'unsupported'} className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2 disabled:opacity-60"><Bell className="w-4 h-4" />{permissaoNotificacao === 'granted' ? 'Avisos ativados' : 'Ativar avisos'}</button>
        </div>
      </header>

      {mensagem && <div role="status" className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-950 text-xs">{mensagem}</div>}
      {!leituraLembretes.ok && <div role="alert" className="p-3 rounded-lg border border-rose-300 bg-rose-50 text-rose-950 text-xs"><strong>Não foi possível ler os lembretes salvos.</strong><p className="mt-1">{leituraLembretes.erro} A agenda não será tratada como vazia e alterações estão suspensas para evitar substituir seus dados.</p></div>}
      <div role="note" className="flex gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-950 text-xs"><ShieldAlert className="w-4 h-4 shrink-0" /><span>O sistema não calcula vencimentos tributários nesta agenda. Cadastre as datas conferidas por você. Avisos do navegador são locais e param quando a página é fechada.</span></div>

      {lembretesDoDia.length > 0 && <section className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-3"><div className="flex items-center gap-2 text-amber-950 font-bold text-sm"><AlertTriangle className="w-4 h-4" />Lembretes que precisam de atenção ({lembretesDoDia.length})</div><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{lembretesDoDia.map(item => <button key={item.id} type="button" onClick={() => setItemSelecionado(item)} className="p-3 bg-white border border-amber-200 rounded-xl text-left text-xs"><strong className="block">{item.empresa}</strong><span>{item.tipo} · {item.diasParaVencer < 0 ? `${Math.abs(item.diasParaVencer)} dia(s) vencido` : item.diasParaVencer === 0 ? 'vence hoje' : `vence em ${item.diasParaVencer} dia(s)`}</span></button>)}</div></section>}

      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2"><button type="button" onClick={() => setMesAtual(current => addMonths(current, -1))} className="p-2 rounded-xl hover:bg-slate-100" aria-label="Mês anterior"><ChevronLeft className="w-5 h-5" /></button><div className="text-center min-w-[200px]"><span className="text-[10px] text-slate-400 font-bold uppercase block">Mês dos lembretes</span><span className="text-base font-extrabold text-indigo-950 capitalize">{format(mesAtual, 'MMMM / yyyy', { locale: ptBR })}</span></div><button type="button" onClick={() => setMesAtual(current => addMonths(current, 1))} className="p-2 rounded-xl hover:bg-slate-100" aria-label="Próximo mês"><ChevronRight className="w-5 h-5" /></button></div>
        <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 flex-wrap">{(['TODOS', 'VENCIDOS', 'HOJE', 'URGENTES'] as const).map(value => <button key={value} type="button" onClick={() => setFiltro(value)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filtro === value ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}>{value}</button>)}</div>
      </div>

      <div className="grid grid-cols-3 gap-3"><div className="bg-white border p-4 rounded-xl text-center"><div className="text-2xl font-black text-rose-600">{totalVencidos}</div><div className="text-xs text-slate-600">Lembretes vencidos</div></div><div className="bg-white border p-4 rounded-xl text-center"><div className="text-2xl font-black text-amber-600">{totalUrgentes}</div><div className="text-xs text-slate-600">Até 3 dias</div></div><div className="bg-white border p-4 rounded-xl text-center"><div className="text-2xl font-black text-indigo-700">{totalPendentes}</div><div className="text-xs text-slate-600">Lembretes pendentes</div></div></div>

      <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-sm font-bold">Lembretes cadastrados ({agendaFiltrada.length})</h2><span className="text-xs text-slate-500">Status calculado pela data digitada</span></div>{agendaFiltrada.length ? <div className="space-y-2">{agendaFiltrada.map(item => <CardLembrete key={item.id} item={item} onPress={setItemSelecionado} onConcluir={() => alternarConclusao(item.id)} onExcluir={() => excluirLembrete(item.id)} />)}</div> : <div className="bg-white border border-dashed rounded-2xl p-10 text-center space-y-2"><CalendarIcon className="w-8 h-8 text-slate-400 mx-auto" /><p className="text-sm font-bold text-slate-800">Nenhum lembrete neste mês e filtro.</p><p className="text-xs text-slate-500">Isso não indica ausência de obrigações. Cadastre um lembrete com a data conferida no portal correspondente.</p></div>}</section>

      {itemSelecionado && <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"><div className="flex justify-between"><div><span className="text-[10px] uppercase text-indigo-600">Lembrete local</span><h3 className="font-bold">{itemSelecionado.tipo}</h3></div><button type="button" onClick={() => setItemSelecionado(null)} aria-label="Fechar">✕</button></div><p className="text-sm">{itemSelecionado.empresa} · {itemSelecionado.cnpj}</p><p className="text-sm">Data informada: {format(itemSelecionado.dataVencimento, 'dd/MM/yyyy')}</p><p className="text-xs text-amber-900 bg-amber-50 p-3 rounded">Este registro não foi consultado em órgão público e não comprova pagamento ou entrega de declaração.</p><button type="button" onClick={() => setItemSelecionado(null)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs">Fechar</button></div></div>}

      {modalNovo && <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4"><form onSubmit={adicionarLembrete} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"><div className="flex justify-between items-center"><h2 className="font-bold text-lg">Novo lembrete local</h2><button type="button" onClick={() => setModalNovo(false)} aria-label="Fechar">✕</button></div><label className="block text-xs font-semibold">Empresa<select required value={empresaId} onChange={event => setEmpresaId(event.target.value)} className="mt-1 w-full border rounded-lg p-2 bg-white"><option value="">Selecione</option>{empresas.map(item => <option key={item.id ?? item.cnpj} value={item.id ?? item.cnpj}>{item.razaoSocial} · {item.cnpj}</option>)}</select></label><label className="block text-xs font-semibold">Descrição<input required maxLength={100} value={titulo} onChange={event => setTitulo(event.target.value)} placeholder="Ex.: conferir guia de ICMS" className="mt-1 w-full border rounded-lg p-2" /></label><label className="block text-xs font-semibold">Data conferida<input required type="date" value={dataVencimento} onChange={event => setDataVencimento(event.target.value)} className="mt-1 w-full border rounded-lg p-2" /></label><label className="block text-xs font-semibold">Avisar quantos dias antes (separados por vírgula)<input value={diasAviso} onChange={event => setDiasAviso(event.target.value)} placeholder="10, 5, 2, 1, 0" className="mt-1 w-full border rounded-lg p-2" /></label><p className="text-[11px] text-amber-900 bg-amber-50 rounded p-2">A data é fornecida por você. Não é calculada nem validada pela Murade.</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setModalNovo(false)} className="px-4 py-2 text-xs border rounded-lg">Cancelar</button><button type="submit" className="px-4 py-2 text-xs bg-indigo-600 text-white rounded-lg">Salvar neste navegador</button></div></form></div>}
    </div>
  );
}
