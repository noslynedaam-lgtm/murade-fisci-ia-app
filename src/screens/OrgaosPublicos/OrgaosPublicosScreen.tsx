import React, { useState, useMemo } from 'react';
import { 
  Building2, ExternalLink, Search, CheckCircle2, ShieldCheck, 
  Server, Globe, MapPin, Copy, Check, Filter, ArrowUpRight,
  Info, RefreshCw, AlertCircle
} from 'lucide-react';
import BotaoVoltar from '../../components/BotaoVoltar';
import { useEmpresa } from '../../context/EmpresaContext';
import { 
  ORGAOS_FEDERAIS, 
  LISTA_SEFAZ_ESTADOS, 
  LISTA_PREFEITURAS, 
  ORGAOS_TRABALHISTAS,
  obterSefazPorUf,
  obterPrefeituraPorMunicipioEUf,
  SefazEstado,
  PrefeituraItem
} from '../../data/orgaosPublicosData';

interface OrgaosPublicosScreenProps {
  onVoltar?: () => void;
  onNavegar?: (aba: string) => void;
}

export default function OrgaosPublicosScreen({ onVoltar, onNavegar }: OrgaosPublicosScreenProps) {
  const { empresaAtiva } = useEmpresa();
  const [abaEsfera, setAbaEsfera] = useState<'todas' | 'federal' | 'estadual' | 'municipal' | 'trabalhista'>('todas');
  const [busca, setBusca] = useState('');
  const [ufFiltro, setUfFiltro] = useState<string>('TODOS');
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null);

  // SEFAZ do cliente ativo se houver
  const ufCliente = empresaAtiva?.uf?.trim().toUpperCase() || '';
  const sefazCliente = useMemo(() => obterSefazPorUf(ufCliente), [ufCliente]);
  const prefeituraCliente = useMemo(() => empresaAtiva
    ? obterPrefeituraPorMunicipioEUf(empresaAtiva.cidade || '', ufCliente)
    : undefined, [empresaAtiva, ufCliente]);

  const copiarLink = (url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setLinkCopiado(url);
    setTimeout(() => setLinkCopiado(null), 2000);
  };

  // Filtragem
  const sefazFiltradas = useMemo(() => {
    return LISTA_SEFAZ_ESTADOS.filter(s => {
      if (ufFiltro !== 'TODOS' && s.uf !== ufFiltro) return false;
      if (!busca.trim()) return true;
      const b = busca.toLowerCase();
      return (
        s.nomeEstado.toLowerCase().includes(b) ||
        s.sigla.toLowerCase().includes(b) ||
        s.uf.toLowerCase().includes(b) ||
        s.portalNome.toLowerCase().includes(b)
      );
    });
  }, [busca, ufFiltro]);

  const prefeiturasFiltradas = useMemo(() => {
    return LISTA_PREFEITURAS.filter(p => {
      if (ufFiltro !== 'TODOS' && p.uf !== ufFiltro) return false;
      if (!busca.trim()) return true;
      const b = busca.toLowerCase();
      return (
        p.municipio.toLowerCase().includes(b) ||
        p.orgaoNome.toLowerCase().includes(b) ||
        p.uf.toLowerCase().includes(b) ||
        p.descricao.toLowerCase().includes(b)
      );
    });
  }, [busca, ufFiltro]);

  const federaisFiltrados = useMemo(() => {
    if (!busca.trim()) return ORGAOS_FEDERAIS;
    const b = busca.toLowerCase();
    return ORGAOS_FEDERAIS.filter(f => 
      f.nome.toLowerCase().includes(b) ||
      f.sigla.toLowerCase().includes(b) ||
      f.descricao.toLowerCase().includes(b) ||
      f.servicosPrincipais.some(s => s.toLowerCase().includes(b))
    );
  }, [busca]);

  const trabalhistasFiltrados = useMemo(() => {
    if (!busca.trim()) return ORGAOS_TRABALHISTAS;
    const b = busca.toLowerCase();
    return ORGAOS_TRABALHISTAS.filter(t => 
      t.nome.toLowerCase().includes(b) ||
      t.sigla.toLowerCase().includes(b) ||
      t.descricao.toLowerCase().includes(b) ||
      t.servicosPrincipais.some(s => s.toLowerCase().includes(b))
    );
  }, [busca]);

  return (
    <div id="orgaos-publicos-screen" className="space-y-6 max-w-6xl mx-auto pb-16">
      {onVoltar && (
        <div>
          <BotaoVoltar onVoltar={onVoltar} />
        </div>
      )}

      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-[#1a237e] text-white shadow-sm">
              <Building2 className="w-7 h-7" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Central de Órgãos Públicos & Sistemas Governamentais
                </h1>
                <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2.5 py-0.5 rounded-full border border-slate-300">
                  Diretório de links
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Diretório de links para portais públicos. Abrir um portal não conecta nem autentica este sistema.
              </p>
            </div>
          </div>
        </div>

        {/* Status de Sincronismo Geral */}
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2">
          <Info className="w-4 h-4 text-amber-700 shrink-0" />
          <div className="text-left">
            <span className="text-[11px] font-bold text-amber-950 block leading-tight">
              Diretório de órgãos públicos
            </span>
            <span className="text-[10px] text-amber-900">
              Links cadastrados • disponibilidade não verificada
            </span>
          </div>
        </div>
      </div>

      {/* Card da Empresa Ativa (Destaque Inteligente) */}
      {empresaAtiva && (
        <div className="bg-linear-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-blue-800/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-white/10 text-blue-200 border border-white/20">
                🏢 Empresa Selecionada
              </span>
              <h3 className="font-extrabold text-base text-white">
                {empresaAtiva.razaoSocial}
              </h3>
            </div>
            <span className="text-xs text-blue-200 font-mono">
              CNPJ: <strong>{empresaAtiva.cnpj}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
            {/* Órgão Federal */}
            <div className="p-3 bg-white/10 rounded-xl border border-white/10 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-blue-300 font-bold uppercase block">🏛️ Esfera Federal</span>
                <strong className="text-sm text-white mt-0.5 block">Receita Federal & e-CAC</strong>
                <p className="text-[11px] text-slate-300 mt-1">DCTFWeb, DARF e CND Conjunta</p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                <a
                  href="https://cav.receita.fazenda.gov.br/ecac/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1"
                >
                  Abrir e-CAC <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
                <a
                  href="https://servicos.receitafederal.gov.br/servico/certidoes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-200 hover:underline"
                >
                  Abrir certidões ↗
                </a>
              </div>
            </div>

            {/* SEFAZ Estadual da Empresa */}
            <div className="p-3 bg-white/10 rounded-xl border border-white/10 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-blue-300 font-bold uppercase block">🏢 Esfera Estadual {ufCliente ? `(${ufCliente})` : ''}</span>
                <strong className="text-sm text-white mt-0.5 block">
                  {sefazCliente ? sefazCliente.sigla : ufCliente ? `SEFAZ-${ufCliente}` : 'UF não informada'}
                </strong>
                <p className="text-[11px] text-slate-300 mt-1">
                  {sefazCliente ? sefazCliente.portalNome : ufCliente ? `Secretaria da Fazenda de ${ufCliente}` : 'Informe a UF no cadastro da empresa'}
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                {sefazCliente ? <>
                  <a href={sefazCliente.urlCnd} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-emerald-300 hover:text-emerald-200 flex items-center gap-1">
                    Abrir portal estadual <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                  <a href={sefazCliente.urlPortal} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-200 hover:underline">Portal ↗</a>
                </> : <span className="text-[11px] text-amber-200">Link estadual indisponível sem UF cadastrada.</span>}
              </div>
            </div>

            {/* Prefeitura / Inscrição Municipal */}
            <div className="p-3 bg-white/10 rounded-xl border border-white/10 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-blue-300 font-bold uppercase block">🏘️ Esfera Municipal</span>
                <strong className="text-sm text-white mt-0.5 block">
                  {empresaAtiva.cidade ? `Prefeitura de ${empresaAtiva.cidade}` : 'Prefeitura Municipal'}
                </strong>
                <p className="text-[11px] text-slate-300 mt-1">
                  {empresaAtiva.inscricaoMunicipal ? `IM: ${empresaAtiva.inscricaoMunicipal}` : 'ISS e situação fiscal não consultados'}
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                {prefeituraCliente ? <>
                  <a href={prefeituraCliente.urlCnd} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-cyan-300 hover:text-cyan-200 flex items-center gap-1">
                    Abrir portal municipal <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                  <a href={prefeituraCliente.urlPortal} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-200 hover:underline">Portal ↗</a>
                </> : <span className="text-[11px] text-amber-200">Município sem link cadastrado. ISS não consultado.</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Abas por Esfera */}
        <div className="flex flex-wrap items-center gap-1 w-full md:w-auto">
          {[
            { id: 'todas', rotulo: 'Todos os Sistemas' },
            { id: 'federal', rotulo: '🏛️ Federal (Receita/e-CAC)' },
            { id: 'estadual', rotulo: '🏢 SEFAZ Estadual (27 UFs)' },
            { id: 'municipal', rotulo: '🏘️ Prefeituras / ISS' },
            { id: 'trabalhista', rotulo: '⚖️ Trabalhista / Caixa' }
          ].map(aba => (
            <button
              key={aba.id}
              type="button"
              onClick={() => setAbaEsfera(aba.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                abaEsfera === aba.id
                  ? 'bg-[#1a237e] text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {aba.rotulo}
            </button>
          ))}
        </div>

        {/* Busca e Seletor de Estado */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {(abaEsfera === 'estadual' || abaEsfera === 'municipal' || abaEsfera === 'todas') && (
            <select
              value={ufFiltro}
              onChange={(e) => setUfFiltro(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
            >
              <option value="TODOS">🌐 Todos os Estados</option>
              {LISTA_SEFAZ_ESTADOS.map(s => (
                <option key={s.uf} value={s.uf}>{s.uf} — {s.nomeEstado}</option>
              ))}
            </select>
          )}

          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar órgão, imposto ou serviço..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
            />
          </div>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL DIVIDIDO POR ESFERAS */}

      {/* 🏛️ 1. ESFERA FEDERAL */}
      {(abaEsfera === 'todas' || abaEsfera === 'federal') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏛️</span>
              <h2 className="text-lg font-bold text-slate-900">
                Sistemas e Órgãos Federais (Receita Federal, e-CAC, Simples & SERPRO)
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-semibold">{federaisFiltrados.length} sistemas</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {federaisFiltrados.map(orgao => (
              <div 
                key={orgao.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{orgao.icone}</span>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {orgao.sigla}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 mt-1">
                          {orgao.nome}
                        </h3>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      <ExternalLink className="w-3 h-3 text-slate-500" /> Link externo · sem verificação
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                    {orgao.descricao}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {orgao.servicosPrincipais.map((s, idx) => (
                      <span key={idx} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {orgao.urlEmissaoCnd && (
                      <a
                        href={orgao.urlEmissaoCnd}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        Emitir CND <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <a
                      href={orgao.urlPortalPrincipal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      Acessar Portal <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <button
                    type="button"
                    onClick={() => copiarLink(orgao.urlPortalPrincipal)}
                    title="Copiar URL Oficial"
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    {linkCopiado === orgao.urlPortalPrincipal ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🏢 2. ESFERA ESTADUAL (TODAS AS 27 SEFAZ) */}
      {(abaEsfera === 'todas' || abaEsfera === 'estadual') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏢</span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  SEFAZ Estaduais — Todas as 27 Unidades da Federação (ICMS & CND Estadual)
                </h2>
                <p className="text-xs text-slate-500">
                  Links listados para portais fazendários dos 26 estados e do Distrito Federal; o serviço de CND varia por UF.
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-semibold">{sefazFiltradas.length} de 27 estados</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {sefazFiltradas.map(sefaz => {
              const ehDoCliente = empresaAtiva?.uf === sefaz.uf;
              return (
                <div
                  key={sefaz.uf}
                  className={`rounded-2xl border p-4 shadow-xs flex flex-col justify-between transition-all ${
                    ehDoCliente 
                      ? 'bg-blue-50/50 border-blue-300 ring-2 ring-blue-500/20' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-[#1a237e] text-white">
                        {sefaz.uf}
                      </span>
                      {ehDoCliente && (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                          ⭐ Cliente Ativo
                        </span>
                      )}
                      <span className="text-[10px] text-slate-600 font-bold flex items-center gap-0.5">
                        <ExternalLink className="w-3 h-3" /> Link listado
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 mt-2">
                      {sefaz.sigla} — {sefaz.nomeEstado}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 truncate" title={sefaz.portalNome}>
                      {sefaz.portalNome}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-1.5">
                    <a
                      href={sefaz.urlCnd}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors text-center"
                    >
                      Abrir serviço / portal <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={sefaz.urlPortal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-1 px-2 text-center text-xs text-slate-600 hover:text-[#1a237e] hover:underline"
                    >
                      Acessar Portal Fazenda ↗
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 🏘️ 3. ESFERA MUNICIPAL (PREFEITURAS & ISS) */}
      {(abaEsfera === 'todas' || abaEsfera === 'municipal') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏘️</span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Prefeituras Municipais & Sistemas Tributários do ISS
                </h2>
                <p className="text-xs text-slate-500">
                  Emissão de CNDs de Tributos Mobiliários/Imobiliários e apuração do ISS municipal.
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-semibold">{prefeiturasFiltradas.length} capitais/municípios</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {prefeiturasFiltradas.map(pref => (
              <div 
                key={pref.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-900 text-white">
                        {pref.uf}
                      </span>
                      <strong className="text-sm text-slate-900">{pref.municipio}</strong>
                    </div>
                    <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                      Portal externo
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-700 mt-2">
                    {pref.orgaoNome}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {pref.descricao}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <a
                    href={pref.urlCnd}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    Abrir serviço / portal <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={pref.urlPortal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-slate-600 hover:text-[#1a237e] hover:underline"
                  >
                    Portal ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ⚖️ 4. TRABALHISTA, PREVIDENCIÁRIO & CAIXA */}
      {(abaEsfera === 'todas' || abaEsfera === 'trabalhista') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚖️</span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Órgãos Trabalhistas, Previdenciários & Caixa Econômica Federal
                </h2>
                <p className="text-xs text-slate-500">
                  Controle de CRF/FGTS, FGTS Digital, eSocial e Certidão Negativa de Débitos Trabalhistas (CNDT/TST).
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-semibold">{trabalhistasFiltrados.length} sistemas</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {trabalhistasFiltrados.map(trab => (
              <div 
                key={trab.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xl">{trab.icone}</span>
                    <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                      Portal externo
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mt-2">
                    {trab.nome}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {trab.descricao}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-1.5">
                  {trab.urlEmissaoCnd && (
                    <a
                      href={trab.urlEmissaoCnd}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors text-center"
                    >
                      Emitir Certidão / Consulta <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <a
                    href={trab.urlPortalPrincipal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-1 px-2 text-center text-xs text-slate-600 hover:text-[#1a237e] hover:underline"
                  >
                    Acessar Portal Oficial ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
