import React, { useState, useEffect } from 'react';
import { 
  PlayCircle, BookOpen, CheckCircle2, Clock, 
  Search, Video, Award, ChevronRight,
  Sparkles, Smartphone, Laptop,
  Play, Pause, Volume2, Layers, Check, Info, MousePointerClick
} from 'lucide-react';
import { Aula, PedacinhoVideo } from './types';
import { AULAS_CATALOGO } from './data';
import SimuladorCelular from './components/SimuladorCelular';
import SimuladorPC from './components/SimuladorPC';
import ControladorAudioIA from './components/ControladorAudioIA';

export default function VideoAulasScreen() {
  const [aulas, setAulas] = useState<Aula[]>(AULAS_CATALOGO);
  const [aulaAtiva, setAulaAtiva] = useState<Aula>(AULAS_CATALOGO[0]);
  const [pedacinhoAtivo, setPedacinhoAtivo] = useState<PedacinhoVideo>(AULAS_CATALOGO[0].pedacinhos[0]);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('TODAS');
  const [busca, setBusca] = useState('');
  
  // Dispositivo selecionado: Celular (Android) ou Computador (PC)
  const [dispositivo, setDispositivo] = useState<'CELULAR' | 'PC'>('CELULAR');
  
  // Player state
  const [reproduzindo, setReproduzindo] = useState(false);
  const [segundoAtual, setSegundoAtual] = useState(0);
  const [velocidade, setVelocidade] = useState<number>(1);
  const [notificacaoClique, setNotificacaoClique] = useState<string | null>(null);

  // Atualiza pedacinho quando troca a aula
  useEffect(() => {
    if (aulaAtiva.pedacinhos && aulaAtiva.pedacinhos.length > 0) {
      setPedacinhoAtivo(aulaAtiva.pedacinhos[0]);
      setSegundoAtual(0);
    }
    // Ajusta o dispositivo padrão sugerido pela aula, se houver
    if (aulaAtiva.dispositivoPrincipal === 'PC') {
      setDispositivo('PC');
    } else if (aulaAtiva.dispositivoPrincipal === 'CELULAR') {
      setDispositivo('CELULAR');
    }
  }, [aulaAtiva]);

  // Simulação de tempo de vídeo correndo quando em "play"
  useEffect(() => {
    let intervalo: NodeJS.Timeout;
    if (reproduzindo) {
      intervalo = setInterval(() => {
        setSegundoAtual(prev => {
          const prox = prev + 1;
          // Verifica se avançou de pedacinho
          if (aulaAtiva.pedacinhos) {
            const pedacoCorrespondente = [...aulaAtiva.pedacinhos]
              .reverse()
              .find(p => prox >= p.tempoSegundos);
            if (pedacoCorrespondente && pedacoCorrespondente.id !== pedacinhoAtivo.id) {
              setPedacinhoAtivo(pedacoCorrespondente);
            }
          }
          return prox;
        });
      }, 1000 / velocidade);
    }
    return () => clearInterval(intervalo);
  }, [reproduzindo, velocidade, aulaAtiva, pedacinhoAtivo]);

  const toggleConcluida = (id: string) => {
    setAulas(prev => prev.map(a => a.id === id ? { ...a, concluida: !a.concluida } : a));
  };

  const selecionarPedacinho = (pedaco: PedacinhoVideo) => {
    setPedacinhoAtivo(pedaco);
    setSegundoAtual(pedaco.tempoSegundos);
    setReproduzindo(true);
  };

  // Ao clicar na seta ou no botão indicado
  const handleAvancarPasso = () => {
    setNotificacaoClique(`Passo concluído: "${pedacinhoAtivo.alvoClique.textoAcao}"!`);
    setTimeout(() => {
      setNotificacaoClique(null);
    }, 2500);

    // Se houver próximo pedaço na aula, avança
    const indiceAtual = aulaAtiva.pedacinhos.findIndex(p => p.id === pedacinhoAtivo.id);
    if (indiceAtual < aulaAtiva.pedacinhos.length - 1) {
      const prox = aulaAtiva.pedacinhos[indiceAtual + 1];
      setTimeout(() => {
        selecionarPedacinho(prox);
      }, 800);
    }
  };

  const aulasFiltradas = aulas.filter(aula => {
    let atendeCategoria = true;
    if (categoriaFiltro === 'CELULAR') {
      atendeCategoria = aula.categoria === 'CELULAR' || aula.dispositivoPrincipal === 'CELULAR' || aula.dispositivoPrincipal === 'AMBOS';
    } else if (categoriaFiltro === 'PC') {
      atendeCategoria = aula.categoria === 'PC' || aula.dispositivoPrincipal === 'PC' || aula.dispositivoPrincipal === 'AMBOS';
    } else if (categoriaFiltro !== 'TODAS') {
      atendeCategoria = aula.categoria === categoriaFiltro;
    }

    const atendeBusca = busca === '' || 
      aula.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      aula.descricao.toLowerCase().includes(busca.toLowerCase()) ||
      aula.modulo.toLowerCase().includes(busca.toLowerCase()) ||
      aula.pedacinhos.some(p => p.titulo.toLowerCase().includes(busca.toLowerCase()));
    return atendeCategoria && atendeBusca;
  });

  const totalConcluidas = aulas.filter(a => a.concluida).length;
  const percentualConclusao = Math.round((totalConcluidas / aulas.length) * 100);

  // Formata segundos em MM:SS
  const formatarTempo = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${String(mins).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* BANNER PRINCIPAL DE TREINAMENTO: CELULAR + PC + ÁUDIO COM SETA */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-6 sm:p-7 text-white shadow-md relative overflow-hidden border border-indigo-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                Áudio Falando com a Voz da IA
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                <MousePointerClick className="w-3.5 h-3.5 text-amber-400" />
                Seta Indicando Onde Clicar
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Celular (Android) & PC</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Video className="w-7 h-7 text-indigo-400" />
              Vídeo Aulas Interativas: Celular & Computador (PC)
            </h1>

            <p className="text-xs sm:text-sm text-indigo-200 leading-relaxed">
              Assista com <strong>áudio narrado pela IA</strong>, alterne entre <strong>Celular</strong> e <strong>Computador (PC)</strong>, 
              e siga a <strong>seta amarela animada</strong> mostrando exatamente onde você deve clicar em cada etapa.
            </p>
          </div>

          {/* Progresso de Conclusão */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col items-center justify-center min-w-[200px] shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Certificado de Treinamento</span>
            </div>
            <div className="text-2xl font-black text-white">{percentualConclusao}%</div>
            <div className="w-full bg-slate-950/60 h-2 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-emerald-400 to-indigo-400 h-full transition-all duration-500"
                style={{ width: `${percentualConclusao}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-300 mt-2 font-medium">
              {totalConcluidas} de {aulas.length} aulas concluídas
            </span>
          </div>
        </div>
      </div>

      {/* FEEDBACK DE CLIQUE INTERATIVO */}
      {notificacaoClique && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between text-xs font-bold animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notificacaoClique}</span>
          </div>
          <span className="text-[11px] bg-emerald-800 px-2 py-0.5 rounded-md">
            Avançando automaticamente...
          </span>
        </div>
      )}

      {/* GRID PRINCIPAL: PLAYER (CELULAR / PC) + PLAYLIST */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA: SIMULADOR (CELULAR OU PC) + ÁUDIO IA + CAPÍTULOS (8 COLUNAS) */}
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* SELETOR DE DISPOSITIVO: OPÇÃO CELULAR vs OPÇÃO COMPUTADOR (PC) */}
            <div className="bg-slate-900 px-4 py-3.5 text-white flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                  Dispositivo de Demonstração:
                </span>
                
                {/* BOTÕES DE ESCOLHA: CELULAR vs PC */}
                <div className="bg-slate-950 p-1 rounded-xl flex items-center border border-white/10 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setDispositivo('CELULAR')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                      dispositivo === 'CELULAR'
                        ? 'bg-emerald-500 text-slate-950 shadow-md scale-102'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Opção Celular (Android)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDispositivo('PC')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                      dispositivo === 'PC'
                        ? 'bg-indigo-600 text-white shadow-md scale-102'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Laptop className="w-4 h-4" />
                    <span>Opção Computador (PC)</span>
                  </button>
                </div>
              </div>

              {/* Indicador do Passo com Seta */}
              <div className="inline-flex items-center gap-1.5 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/30 px-3 py-1 rounded-full font-bold">
                <MousePointerClick className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Passo {pedacinhoAtivo.alvoClique.passoNumero}: {pedacinhoAtivo.alvoClique.textoAcao}</span>
              </div>
            </div>

            {/* ÁREA DE EXIBIÇÃO VISUAL (MOCKUP CELULAR OU PC COM A SETA APONTANDO) */}
            <div className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6 flex flex-col items-center justify-center min-h-[480px]">
              {dispositivo === 'CELULAR' ? (
                <SimuladorCelular 
                  pedacinho={pedacinhoAtivo} 
                  onAvancar={handleAvancarPasso} 
                />
              ) : (
                <SimuladorPC 
                  pedacinho={pedacinhoAtivo} 
                  onAvancar={handleAvancarPasso} 
                />
              )}
            </div>

            {/* MÓDULO DE ÁUDIO FALANDO DA IA COM CONTROLES E TRANSCRIÇÃO */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-900">
              <ControladorAudioIA 
                textoParaFalar={pedacinhoAtivo.narracaoVoz}
                tituloPedacinho={pedacinhoAtivo.titulo}
                autoPlay={reproduzindo}
              />
            </div>

            {/* CONTROLES DE REPRODUÇÃO & TIMELINE */}
            <div className="bg-slate-950 px-4 py-3 text-white border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setReproduzindo(!reproduzindo)}
                    className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center cursor-pointer transition-colors shadow-sm"
                  >
                    {reproduzindo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>

                  <span className="font-mono text-xs text-slate-300">
                    {formatarTempo(segundoAtual)}
                  </span>
                </div>

                {/* Seletor de Velocidade */}
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-slate-400 mr-1">Velocidade:</span>
                  {[1, 1.25, 1.5, 2].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVelocidade(v)}
                      className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                        velocidade === v ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {v}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Barra de Progresso com Marcadores */}
              <div className="relative w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-emerald-400 to-indigo-500 h-full transition-all duration-200"
                  style={{ width: `${Math.min(100, (segundoAtual / 600) * 100)}%` }}
                />
              </div>
            </div>

            {/* LISTA DOS PEDACINHOS (CAPÍTULOS PRÁTICOS) */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Pedacinhos Desta Aula (Capítulos Passo a Passo):
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Clique em qualquer pedaço para saltar direto, ouvir a voz da IA e ver a seta no {dispositivo === 'CELULAR' ? 'celular' : 'computador'}.
                  </p>
                </div>
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">
                  {aulaAtiva.pedacinhos.length} partes
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {aulaAtiva.pedacinhos.map((pedaco, idx) => {
                  const isPedacoAtivo = pedaco.id === pedacinhoAtivo.id;
                  return (
                    <div
                      key={pedaco.id}
                      onClick={() => selecionarPedacinho(pedaco)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isPedacoAtivo
                          ? 'bg-indigo-50/95 border-indigo-400 ring-2 ring-indigo-200 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                          {pedaco.tempoInicio} • Passo {idx + 1}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {pedaco.duracao}
                        </span>
                      </div>
                      <strong className={`block text-xs font-bold truncate ${
                        isPedacoAtivo ? 'text-indigo-950' : 'text-slate-800'
                      }`}>
                        {pedaco.titulo}
                      </strong>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {pedaco.descricao}
                      </p>
                      <div className="mt-1.5 text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                        <MousePointerClick className="w-3 h-3 text-amber-600" />
                        <span>Seta: {pedaco.alvoClique.textoAcao}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* COLUNA DIREITA: GRADE DE AULAS COM FILTROS DE DISPOSITIVO (4 COLUNAS) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>Grade de Treinamentos</span>
            </h3>

            {/* Campo de Busca */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar aula, módulo ou assunto..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-hidden focus:border-indigo-600 focus:bg-white"
              />
            </div>

            {/* Filtros de Categoria e Dispositivo */}
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {[
                { id: 'TODAS', rotulo: 'Todas' },
                { id: 'CELULAR', rotulo: '📱 Celular (Android)' },
                { id: 'PC', rotulo: '💻 Computador (PC)' },
                { id: 'DCTFWEB', rotulo: 'DCTFWeb/DARF' },
                { id: 'FISCAL', rotulo: 'SERPRO' },
                { id: 'PROCURACAO', rotulo: 'Procuração' },
                { id: 'IA_COMPLIANCE', rotulo: 'IA Fiscal' }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoriaFiltro(cat.id)}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                    categoriaFiltro === cat.id
                      ? 'bg-indigo-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.rotulo}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Aulas */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden max-h-[640px] overflow-y-auto">
            {aulasFiltradas.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhuma aula encontrada para o filtro selecionado.
              </div>
            ) : (
              aulasFiltradas.map((aula, index) => {
                const isSelected = aulaAtiva.id === aula.id;
                return (
                  <div
                    key={aula.id}
                    onClick={() => {
                      setAulaAtiva(aula);
                      setReproduzindo(false);
                    }}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-50/80 border-l-4 border-indigo-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleConcluida(aula.id);
                      }}
                      className="mt-0.5 shrink-0"
                      title={aula.concluida ? 'Concluída' : 'Marcar como concluída'}
                    >
                      <CheckCircle2 className={`w-4 h-4 ${aula.concluida ? 'text-emerald-600 fill-emerald-100' : 'text-slate-300 hover:text-slate-400'}`} />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          Aula {index + 1}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {aula.duracao}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[10px] text-indigo-600 font-bold">
                          {aula.pedacinhos.length} partes
                        </span>
                      </div>
                      <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                        {aula.titulo}
                      </h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {aula.modulo}
                      </p>
                    </div>

                    <ChevronRight className={`w-4 h-4 shrink-0 mt-2 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
