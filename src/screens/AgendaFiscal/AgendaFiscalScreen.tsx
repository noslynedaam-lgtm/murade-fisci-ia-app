import { useState, useEffect, FormEvent } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, Bell, ChevronLeft, ChevronRight, 
  Filter, CheckCircle2, AlertTriangle, AlertCircle, Clock, 
  Settings, Check, Send, ShieldCheck, Building2, Plus
} from 'lucide-react';
import { gerarAgenda, verificarLembretesDoDia, configLembretes, EmpresaAgenda } from '../../services/agenda/lembrete.service';
import CardLembrete from './CardLembrete';
import BotaoVoltar from '../../components/BotaoVoltar';
import { ItemAgendaFiscal } from '../../types';
import { useEmpresa } from '../../context/EmpresaContext';
import SeletorEmpresaGlobal from '../../components/SeletorEmpresaGlobal';

export default function AgendaFiscalScreen() {
  const { empresas, empresaAtiva } = useEmpresa();
  const [mesAtual, setMesAtual] = useState(new Date(2026, 8, 1)); // Setembro/2026 (ou data atual)
  const [agenda, setAgenda] = useState<ItemAgendaFiscal[]>([]);
  const [lembretesDoDia, setLembretesDoDia] = useState<ItemAgendaFiscal[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<'TODOS' | 'VENCIDOS' | 'HOJE' | 'URGENTES'>('TODOS');
  const [itemSelecionado, setItemSelecionado] = useState<ItemAgendaFiscal | null>(null);
  const [mostrarConfigNotificacao, setMostrarConfigNotificacao] = useState(false);
  const [config, setConfig] = useState(configLembretes);
  const [notificacaoSalva, setNotificacaoSalva] = useState(false);

  // Mapeia empresas reais do contexto para a agenda fiscal
  const empresasParaMonitorar: EmpresaAgenda[] = empresas.map(emp => ({
    razaoSocial: emp.razaoSocial,
    cnpj: emp.cnpj,
    procuracaoValidade: '2026-12-31',
    cndValidade: '2026-12-31'
  }));

  const carregarAgenda = () => {
    setCarregando(true);
    if (empresasParaMonitorar.length === 0) {
      setAgenda([]);
      setLembretesDoDia([]);
      setCarregando(false);
      return;
    }
    const agendaCompleta = gerarAgenda(mesAtual, empresasParaMonitorar);
    setAgenda(agendaCompleta);
    setLembretesDoDia(verificarLembretesDoDia(agendaCompleta));
    setCarregando(false);
  };

  useEffect(() => {
    carregarAgenda();
  }, [mesAtual, empresas]);

  // Filtros
  const agendaFiltrada = agenda.filter(item => {
    if (filtro === 'TODOS') return true;
    if (filtro === 'VENCIDOS') return item.status.texto === 'VENCIDO';
    if (filtro === 'HOJE') return item.status.texto === 'HOJE';
    if (filtro === 'URGENTES') return item.diasParaVencer <= 3 && item.diasParaVencer >= 0;
    return true;
  });

  const mudarMes = (qtd: number) => {
    const novo = new Date(mesAtual);
    novo.setMonth(novo.getMonth() + qtd);
    setMesAtual(novo);
  };

  const totalVencidos = agenda.filter(i => i.status.texto === 'VENCIDO').length;
  const totalUrgentes = agenda.filter(i => i.diasParaVencer <= 3 && i.diasParaVencer >= 0).length;
  const totalNoPrazo = agenda.filter(i => i.status.texto === 'NO PRAZO').length;

  const salvarConfig = (e: FormEvent) => {
    e.preventDefault();
    setNotificacaoSalva(true);
    setTimeout(() => {
      setNotificacaoSalva(false);
      setMostrarConfigNotificacao(false);
    }, 1500);
  };

  return (
    <div id="agenda-fiscal-screen" className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <BotaoVoltar />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
              <CalendarIcon className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Agenda Fiscal & Lembretes de Vencimento
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controle automatizado de prazos da DCTFWeb/DARF, FGTS Digital, Simples Nacional (DAS), Procurações e CNDs (vencimento dia 20).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SeletorEmpresaGlobal tamanho="medio" />
          <button
            type="button"
            onClick={() => setMostrarConfigNotificacao(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Settings className="w-4 h-4 text-indigo-600" />
            <span>Configurar Lembretes</span>
          </button>
        </div>
      </div>

      {/* 🔔 Lembretes de Hoje / Alerta Imediato */}
      {lembretesDoDia.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 shadow-xs space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <span className="p-1.5 rounded-lg bg-amber-200/70 text-amber-900">
                <Bell className="w-4 h-4" />
              </span>
              <span>LEMBRETES DE HOJE ({lembretesDoDia.length} obrigações demandam atenção)</span>
            </div>
            <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
              Disparo Automático MURADE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
            {lembretesDoDia.map((item, i) => (
              <div
                key={i}
                onClick={() => setItemSelecionado(item)}
                className="p-3 bg-white/90 border border-amber-200 rounded-xl flex items-center justify-between text-xs cursor-pointer hover:bg-white transition-colors"
              >
                <div className="truncate pr-2">
                  <span className="font-bold text-slate-900 block truncate">{item.empresa}</span>
                  <span className="text-amber-800 font-semibold text-[11px]">⏰ {item.tipo}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] font-bold text-rose-700 block">
                    {item.diasParaVencer === 0 ? 'Vence HOJE!' : `Vence em ${item.diasParaVencer} dias`}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {format(new Date(item.dataVencimento), 'dd/MM/yyyy')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📅 Navegação do Mês & Seletor */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => mudarMes(-1)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            title="Mês Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="text-center min-w-[200px]">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Competência / Período
            </span>
            <span className="text-base font-extrabold text-indigo-950 capitalize">
              {format(mesAtual, 'MMMM / yyyy', { locale: ptBR })}
            </span>
          </div>

          <button
            type="button"
            onClick={() => mudarMes(1)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            title="Próximo Mês"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* 🔘 Filtros */}
        <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 flex-wrap">
          {(['TODOS', 'VENCIDOS', 'HOJE', 'URGENTES'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filtro === f 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 📊 Métricas Resumo */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div 
          onClick={() => setFiltro('VENCIDOS')}
          className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs text-center cursor-pointer hover:border-rose-300 transition-all"
        >
          <div className="text-2xl font-black text-rose-600">{totalVencidos}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Vencidos</div>
        </div>

        <div 
          onClick={() => setFiltro('URGENTES')}
          className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs text-center cursor-pointer hover:border-amber-300 transition-all"
        >
          <div className="text-2xl font-black text-amber-600">{totalUrgentes}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Urgentes (≤ 3 dias)</div>
        </div>

        <div 
          onClick={() => setFiltro('TODOS')}
          className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs text-center cursor-pointer hover:border-emerald-300 transition-all"
        >
          <div className="text-2xl font-black text-emerald-600">{totalNoPrazo}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">No Prazo</div>
        </div>
      </div>

      {/* 📋 Lista de Vencimentos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>📋 Vencimentos e Obrigações ({agendaFiltrada.length})</span>
          </h3>
          <span className="text-xs text-slate-500">
            Regra tributária federal com antecipação se feriado/fim de semana
          </span>
        </div>

        {agendaFiltrada.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-slate-800">Nenhum vencimento encontrado para o filtro selecionado!</p>
            <p className="text-xs text-slate-400">Todas as obrigações deste período estão regulares ou sem pendências.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {agendaFiltrada.map((item, i) => (
              <CardLembrete 
                key={i} 
                item={item} 
                onPress={(sel) => setItemSelecionado(sel)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal Detalhes do Vencimento */}
      {itemSelecionado && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-600">
                  Detalhes do Vencimento Fiscal
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {itemSelecionado.tipo}
                </h3>
              </div>
              <button
                onClick={() => setItemSelecionado(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="font-semibold text-slate-800 block">Empresa Contribuinte:</span>
                <p className="text-slate-900 font-bold">{itemSelecionado.empresa}</p>
                <p className="font-mono text-slate-500">CNPJ: {itemSelecionado.cnpj}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 block">Data de Vencimento:</span>
                  <strong className="text-slate-900 text-sm font-mono block mt-0.5">
                    {format(new Date(itemSelecionado.dataVencimento), 'dd/MM/yyyy')}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 block">Situação Atual:</span>
                  <strong className="text-rose-600 text-sm block mt-0.5">
                    {itemSelecionado.status.texto}
                  </strong>
                </div>
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-indigo-950">
                <strong className="block mb-1 font-bold">Dias de Alerta Configurados:</strong>
                <p className="text-[11px] text-indigo-800">
                  Notificações enviadas com {itemSelecionado.alertas.join(', ')} dias de antecedência para evitar multas moratórias perante a RFB/Caixa.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setItemSelecionado(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configuração dos Lembretes */}
      {mostrarConfigNotificacao && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Configuração de Lembretes</h3>
                <p className="text-xs text-slate-500">Canais de disparo dos avisos de vencimento</p>
              </div>
              <button
                onClick={() => setMostrarConfigNotificacao(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={salvarConfig} className="space-y-3.5 text-xs">
              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <div>
                  <span className="font-bold text-slate-900 block">Notificação no App (Push)</span>
                  <span className="text-[11px] text-slate-500">Exibir banner e avisos no painel principal</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.notificacaoApp}
                  onChange={(e) => setConfig({ ...config, notificacaoApp: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <div>
                  <span className="font-bold text-slate-900 block">E-mail Automático</span>
                  <span className="text-[11px] text-slate-500">Enviar resumo matinal para a equipe contábil</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.email}
                  onChange={(e) => setConfig({ ...config, email: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <div>
                  <span className="font-bold text-slate-900 block">WhatsApp MURADE Alert</span>
                  <span className="text-[11px] text-slate-500">Notificar o gestor fiscal por mensagem instantânea</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.whatsapp}
                  onChange={(e) => setConfig({ ...config, whatsapp: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Horário do Disparo Diário</label>
                <input
                  type="time"
                  value={config.horaLembrete}
                  onChange={(e) => setConfig({ ...config, horaLembrete: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg outline-none font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMostrarConfigNotificacao(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {notificacaoSalva ? <Check className="w-4 h-4" /> : null}
                  <span>{notificacaoSalva ? 'Configurações Salvas!' : 'Salvar Preferências'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
