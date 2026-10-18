import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Printer, ShieldAlert } from 'lucide-react';
import { useEmpresa } from '../../context/EmpresaContext';
import { FONTES_OFICIAIS_REFORMA, ITENS_LEI, REGRAS_REVISADAS_EM, VERSAO_REGRAS } from '../../data/reformaTributariaRegras';

type PerfilSimulacao = {
  receitaAnual: string;
  cargaAtual: string;
  aliquotasNovas: Record<string, string>;
  comprasPotencialmenteCreditorias: string;
  percentualElegivel: string;
  setorReferencia: string;
  benchmarkSetor: string;
  revisoes: Record<string, 'PENDENTE' | 'APLICA' | 'NAO_APLICA'>;
};

const PERIODOS = [
  { id: '2026', rotulo: '2026 · teste' },
  { id: '2027_2028', rotulo: '2027–2028' },
  { id: '2029_2032', rotulo: '2029–2032' },
  { id: '2033', rotulo: '2033 · modelo integral' },
];
const STORAGE_PREFIX = 'fiscoia_reforma_estimativa_v1';
const vazio: PerfilSimulacao = {
  receitaAnual: '', cargaAtual: '', aliquotasNovas: {}, comprasPotencialmenteCreditorias: '',
  percentualElegivel: '', setorReferencia: '', benchmarkSetor: '', revisoes: {},
};
const temDadosNoPerfil = (perfil: PerfilSimulacao) => Boolean(
  perfil.receitaAnual || perfil.cargaAtual || perfil.comprasPotencialmenteCreditorias
  || perfil.percentualElegivel || perfil.setorReferencia || perfil.benchmarkSetor
  || Object.keys(perfil.aliquotasNovas).length || Object.keys(perfil.revisoes).length,
);
const lerPercentual = (valor: string) => valor.trim() === '' ? null : (/^\d{1,3}(?:[.,]\d{1,4})?$/.test(valor.trim()) ? Number(valor.replace(',', '.')) : null);
const lerValor = (valor: string) => valor.trim() === '' ? null : (/^(?:\d{1,12}|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(valor.trim()) ? Number(valor.replace(/\./g, '').replace(',', '.')) : null);
const percentualInvalido = (valor: string) => valor.trim() !== '' && (lerPercentual(valor) === null || lerPercentual(valor)! > 100);
const valorMonetarioInvalido = (valor: string) => valor.trim() !== '' && lerValor(valor) === null;
const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const regimeNome = (regime?: string) => ({ SIMPLES: 'Simples Nacional', PRESUMIDO: 'Lucro Presumido', REAL: 'Lucro Real' }[regime || ''] || regime || 'Regime não cadastrado');

type ResultadoCarregamento = { perfil: PerfilSimulacao; originalInvalido: string };

function carregar(empresaId: string): ResultadoCarregamento {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${empresaId}`);
    if (!raw) return { perfil: vazio, originalInvalido: '' };
    const parsed = JSON.parse(raw) as PerfilSimulacao;
    const camposTexto = ['receitaAnual', 'cargaAtual', 'comprasPotencialmenteCreditorias', 'percentualElegivel', 'setorReferencia', 'benchmarkSetor'] as const;
    const camposValidos = parsed && typeof parsed === 'object'
      && camposTexto.every(campo => typeof (parsed as PerfilSimulacao)[campo] === 'string')
      && parsed.aliquotasNovas && typeof parsed.aliquotasNovas === 'object'
      && Object.values(parsed.aliquotasNovas).every(valor => typeof valor === 'string')
      && parsed.revisoes && typeof parsed.revisoes === 'object'
      && Object.values(parsed.revisoes).every(valor => ['PENDENTE', 'APLICA', 'NAO_APLICA'].includes(valor));
    if (!camposValidos) return { perfil: vazio, originalInvalido: raw };
    return { perfil: { ...vazio, ...parsed, aliquotasNovas: parsed.aliquotasNovas, revisoes: parsed.revisoes }, originalInvalido: '' };
  } catch {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}:${empresaId}`);
      return { perfil: vazio, originalInvalido: raw || '' };
    } catch { return { perfil: vazio, originalInvalido: '' }; }
  }
}

export function ReformaTributariaScreen() {
  const { empresaAtiva, empresas, selecionarEmpresa } = useEmpresa();
  const [perfil, setPerfil] = useState<PerfilSimulacao>(vazio);
  const [salvo, setSalvo] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');
  const [alterado, setAlterado] = useState(false);
  const [relatorioGeradoEm, setRelatorioGeradoEm] = useState('');
  const [originalInvalido, setOriginalInvalido] = useState('');
  const [erroRecuperacao, setErroRecuperacao] = useState('');
  const [erroCarregamento, setErroCarregamento] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState('');
  const [versaoRegrasSalva, setVersaoRegrasSalva] = useState<string | null>(null);
  const [itensConferidosNaVersaoAtual, setItensConferidosNaVersaoAtual] = useState<Set<string>>(() => new Set());
  const [versaoCenario, setVersaoCenario] = useState<string | null>(null);
  const [origemCenario, setOrigemCenario] = useState<'BANCO' | 'LOCAL' | 'RASCUNHO' | 'VAZIO'>('VAZIO');
  const empresaKey = empresaAtiva ? `${empresaAtiva.tenantIdCentral || 'local'}:${empresaAtiva.idCentral || empresaAtiva.id}` : '';
  const tenantId = empresaAtiva?.tenantIdCentral || '';
  const companyId = empresaAtiva?.idCentral || '';

  useEffect(() => {
    let ativo = true;
    const carregado = empresaKey ? carregar(empresaKey) : { perfil: vazio, originalInvalido: '' };
    setPerfil(vazio);
    setOriginalInvalido(carregado.originalInvalido);
    setSalvo(false);
    setErroSalvar('');
    setErroRecuperacao('');
    setErroCarregamento('');
    setAtualizadoEm('');
    setVersaoRegrasSalva(null);
    setItensConferidosNaVersaoAtual(new Set());
    setVersaoCenario(null);
    setOrigemCenario(temDadosNoPerfil(carregado.perfil) ? 'LOCAL' : 'VAZIO');
    setAlterado(false);
    if (!tenantId || !companyId) {
      setPerfil(carregado.perfil);
      if (temDadosNoPerfil(carregado.perfil)) setAlterado(true);
      if (empresaKey) setErroCarregamento('Esta empresa não está vinculada à carteira permanente. O cenário local não será tratado como dado sincronizado.');
      return () => { ativo = false; };
    }
    setCarregando(true);
    void fetch(`/api/companies/${encodeURIComponent(companyId)}/reforma-scenario?tenantId=${encodeURIComponent(tenantId)}`, { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof body.mensagem === 'string' ? body.mensagem : 'Não foi possível carregar o cenário do banco permanente.');
        if (!ativo) return;
        if (body.cenario) {
          setPerfil({ ...vazio, ...body.cenario, aliquotasNovas: body.cenario.aliquotasNovas || {}, revisoes: body.cenario.revisoes || {} });
          setOrigemCenario('BANCO');
          setVersaoRegrasSalva(typeof body.versaoRegras === 'string' ? body.versaoRegras : null);
          setAtualizadoEm(typeof body.atualizadoEm === 'string' ? new Date(body.atualizadoEm).toLocaleString('pt-BR') : '');
          setVersaoCenario(typeof body.atualizadoEm === 'string' ? body.atualizadoEm : null);
        } else {
          setPerfil(carregado.perfil);
          setVersaoCenario(null);
          if (temDadosNoPerfil(carregado.perfil)) setAlterado(true);
        }
      })
      .catch((error: unknown) => {
        if (!ativo) return;
        setPerfil(carregado.perfil);
        setOrigemCenario(temDadosNoPerfil(carregado.perfil) ? 'LOCAL' : 'VAZIO');
        if (temDadosNoPerfil(carregado.perfil)) setAlterado(true);
        setErroCarregamento(error instanceof Error ? `${error.message} Os dados exibidos vêm apenas da cópia local e precisam ser salvos no banco para ficarem permanentes.` : 'Falha ao acessar o banco permanente. Os dados exibidos vêm apenas da cópia local.');
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [empresaKey]);

  const persistirPerfil = (chaveEmpresa: string, dados: PerfilSimulacao, rawOriginal: string) => {
    try {
      if (rawOriginal) {
        const chaveRecuperacao = `${STORAGE_PREFIX}:recuperacao:${chaveEmpresa}`;
        if (!localStorage.getItem(chaveRecuperacao)) localStorage.setItem(chaveRecuperacao, rawOriginal);
      }
      localStorage.setItem(`${STORAGE_PREFIX}:${chaveEmpresa}`, JSON.stringify(dados));
      setOriginalInvalido('');
      setErroRecuperacao('');
      return true;
    } catch {
      setErroRecuperacao('Não foi possível preservar a cópia original do cenário. O cenário novo não foi salvo por cima dela.');
      return false;
    }
  };

  const baixarRecuperacao = () => {
    if (!originalInvalido) return;
    const arquivo = new Blob([originalInvalido], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fiscoia-reforma-cenario-original-corrompido.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const atualizar = <K extends keyof PerfilSimulacao>(campo: K, valor: PerfilSimulacao[K]) => {
    setPerfil(atual => ({ ...atual, [campo]: valor }));
    setOrigemCenario('RASCUNHO');
    setSalvo(false);
    setAlterado(true);
  };
  const entradasInvalidas = [
    valorMonetarioInvalido(perfil.receitaAnual) && 'Receita anual',
    percentualInvalido(perfil.cargaAtual) && 'Carga atual',
    valorMonetarioInvalido(perfil.comprasPotencialmenteCreditorias) && 'Compras potencialmente creditáveis',
    percentualInvalido(perfil.percentualElegivel) && 'Percentual elegível',
    percentualInvalido(perfil.benchmarkSetor) && 'Referência setorial',
    ...PERIODOS.filter(periodo => percentualInvalido(perfil.aliquotasNovas[periodo.id] || '')).map(periodo => `Alíquota ${periodo.rotulo}`),
  ].filter(Boolean) as string[];
  const temEntradaInvalida = entradasInvalidas.length > 0;
  const receita = lerValor(perfil.receitaAnual);
  const cargaAtual = lerPercentual(perfil.cargaAtual);
  const cenarios = useMemo(() => PERIODOS.map(periodo => {
    const aliquotaNova = lerPercentual(perfil.aliquotasNovas[periodo.id] || '');
    if (temEntradaInvalida || receita === null || cargaAtual === null || aliquotaNova === null || cargaAtual > 100 || aliquotaNova > 100) return { ...periodo, aliquotaNova, atual: null as number | null, novo: null as number | null, diferenca: null as number | null };
    const atual = receita * cargaAtual / 100;
    const novo = receita * aliquotaNova / 100;
    return { ...periodo, aliquotaNova, atual, novo, diferenca: novo - atual };
  }), [receita, cargaAtual, perfil.aliquotasNovas, temEntradaInvalida]);
  const pendenciaCenario = (item: typeof cenarios[number]) => temEntradaInvalida
    ? 'Corrija os campos numéricos inválidos.'
    : receita === null ? 'Informe a receita anual confirmada.'
      : cargaAtual === null ? 'Informe a carga efetiva atual confirmada.'
        : item.aliquotaNova === null ? 'Informe a alíquota hipotética deste período.' : '';
  const impactoInicial = cenarios[cenarios.length - 1]?.diferenca;
  const classificacao = impactoInicial === null || impactoInicial === undefined ? 'PENDENTE DE DADOS' : Math.abs(impactoInicial) < 0.01 ? 'NEUTRO NO CENÁRIO BRUTO' : impactoInicial > 0 ? 'AUMENTO BRUTO ESTIMADO' : 'REDUÇÃO BRUTA ESTIMADA';
  const creditosPotenciais = useMemo(() => {
    const compras = lerValor(perfil.comprasPotencialmenteCreditorias);
    const elegivel = lerPercentual(perfil.percentualElegivel);
    const taxa = lerPercentual(perfil.aliquotasNovas['2033'] || '');
    if (temEntradaInvalida || compras === null || elegivel === null || taxa === null || elegivel > 100 || taxa > 100) return null;
    return compras * elegivel / 100 * taxa / 100;
  }, [perfil.comprasPotencialmenteCreditorias, perfil.percentualElegivel, perfil.aliquotasNovas, temEntradaInvalida]);
  const pendenciasCredito = [
    temEntradaInvalida && 'Corrija os campos numéricos inválidos.',
    lerValor(perfil.comprasPotencialmenteCreditorias) === null && 'Informe compras potencialmente creditáveis.',
    lerPercentual(perfil.percentualElegivel) === null && 'Confirme a parcela elegível após análise profissional.',
    lerPercentual(perfil.aliquotasNovas['2033'] || '') === null && 'Informe a alíquota hipotética de 2033.',
  ].filter(Boolean);
  const diferencaSetor = (() => {
    const benchmark = lerPercentual(perfil.benchmarkSetor);
    if (temEntradaInvalida || impactoInicial === null || impactoInicial === undefined || receita === null || !receita || benchmark === null || benchmark > 100) return null;
    return impactoInicial / receita * 100 - benchmark;
  })();

  const baseDesatualizada = Boolean(versaoRegrasSalva && versaoRegrasSalva !== VERSAO_REGRAS);
  const todosItensConferidosNaVersaoAtual = ITENS_LEI.every(item => itensConferidosNaVersaoAtual.has(item.id));

  const salvarPerfil = async (confirmarRevisaoAtual = false) => {
    if (!tenantId || !companyId) {
      setErroSalvar('Não foi possível confirmar o vínculo permanente desta empresa. Nenhum cenário foi sincronizado.');
      return false;
    }
    if (baseDesatualizada && confirmarRevisaoAtual && !todosItensConferidosNaVersaoAtual) {
      setErroSalvar('Confira cada item da base legal atual antes de confirmar a revisão deste cenário.');
      return false;
    }
    const versaoParaSalvar = baseDesatualizada && !confirmarRevisaoAtual ? versaoRegrasSalva! : VERSAO_REGRAS;
    try {
      const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}/reforma-scenario`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ tenantId, versaoRegras: versaoParaSalvar, versaoEsperada: versaoCenario, cenario: perfil }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.mensagem === 'string' ? body.mensagem : 'O banco não confirmou o salvamento.');
      const data = typeof body.atualizadoEm === 'string' ? body.atualizadoEm : new Date().toISOString();
      setVersaoCenario(data);
      setVersaoRegrasSalva(versaoParaSalvar);
      setAtualizadoEm(new Date(data).toLocaleString('pt-BR'));
      // Mantém uma cópia local recuperável depois da confirmação do servidor.
      persistirPerfil(empresaKey, perfil, originalInvalido);
      setSalvo(true);
      setAlterado(false);
      setOrigemCenario('BANCO');
      setErroSalvar('');
      setErroCarregamento('');
      if (confirmarRevisaoAtual) setItensConferidosNaVersaoAtual(new Set());
      return true;
    } catch (error) {
      setSalvo(false);
      setErroSalvar(error instanceof Error ? error.message : 'Não foi possível salvar no banco permanente.');
      return false;
    }
  };

  const trocarEmpresa = (id: string) => {
    if (alterado) {
      setErroSalvar('Salve o cenário no banco permanente antes de trocar de empresa. As alterações atuais foram mantidas.');
      return;
    }
    selecionarEmpresa(id || null);
  };

  const atualizarAliquota = (periodo: string, valor: string) => {
    setPerfil(atual => ({ ...atual, aliquotasNovas: { ...atual.aliquotasNovas, [periodo]: valor } }));
    setOrigemCenario('RASCUNHO');
    setSalvo(false);
    setAlterado(true);
  };

  const atualizarRevisao = (itemId: string, valor: 'PENDENTE' | 'APLICA' | 'NAO_APLICA') => {
    setPerfil(atual => ({ ...atual, revisoes: { ...atual.revisoes, [itemId]: valor } }));
    setOrigemCenario('RASCUNHO');
    setSalvo(false);
    setAlterado(true);
  };

  const imprimirRelatorio = async () => {
    if (!empresaKey) return;
    try {
      if (!(await salvarPerfil())) return;
      setSalvo(true);
      setAlterado(false);
      setErroSalvar('');
      setRelatorioGeradoEm(new Date().toLocaleString('pt-BR'));
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      window.print();
    } catch {
      setSalvo(false);
      setErroSalvar('Não foi possível salvar o cenário neste navegador. O relatório não foi aberto para evitar exportar dados que poderiam ser perdidos.');
    }
  };
  const barras = cenarios.filter(item => item.atual !== null && item.novo !== null);
  const escalaMaxima = Math.max(1, ...barras.flatMap(item => [item.atual || 0, item.novo || 0]));

  return <div className="reforma-relatorio space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
      <div>
        <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Módulo de planejamento · versão de regras {VERSAO_REGRAS}</div>
        <h2 className="mt-1 text-xl font-black text-slate-900">Reforma Tributária — análise por empresa</h2>
        <p className="mt-1 max-w-3xl text-xs text-slate-600">Use parâmetros confirmados pelo contador para montar cenários. O sistema não presume alíquotas, créditos, redução ou aumento de carga.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => void salvarPerfil()} disabled={!tenantId || !companyId || carregando} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-900 disabled:opacity-50">Salvar cenário nesta empresa</button>
        <button type="button" onClick={imprimirRelatorio} disabled={!tenantId || !companyId || carregando} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Printer className="mr-1 inline h-3.5 w-3.5"/>Exportar relatório PDF</button>
      </div>
    </div>
    {salvo && <p role="status" className="text-xs text-emerald-800 print:hidden">Cenário salvo e confirmado no banco permanente da empresa selecionada.</p>}
    {!salvo && origemCenario === 'LOCAL' && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950 print:hidden">Cenário recuperado deste navegador. Ainda não está sincronizado com o banco permanente; salve após confirmar a conexão.</p>}
    {origemCenario === 'RASCUNHO' && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950 print:hidden">Há alterações não salvas. Elas só serão enviadas ao banco quando você clicar em “Salvar cenário nesta empresa”.</p>}
    {carregando && <p role="status" className="text-xs text-slate-600 print:hidden">Carregando cenário permanente da empresa…</p>}
    {atualizadoEm && <p className="text-xs text-slate-500 print:hidden">Último salvamento confirmado no banco: {atualizadoEm}.</p>}
    {baseDesatualizada && <div role="alert" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950"><p><strong>Este cenário foi salvo com a base legal {versaoRegrasSalva}; a versão atual é {VERSAO_REGRAS}.</strong> As respostas antigas continuam visíveis, mas não foram revalidadas. Salvar ou exportar mantém registrada a versão antiga. O sistema ainda não mantém versões históricas completas dos cenários.</p><p className="print:hidden">Para atualizar a versão registrada, confira a fonte e marque cada item da lista como revisado na versão atual. Só então habilitaremos a confirmação explícita.</p><button type="button" onClick={() => void salvarPerfil(true)} disabled={!todosItensConferidosNaVersaoAtual || carregando} className="rounded-lg border border-amber-500 bg-white px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 print:hidden">Confirmar revisão da base atual ({itensConferidosNaVersaoAtual.size}/{ITENS_LEI.length})</button></div>}
    {erroCarregamento && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950 print:hidden">{erroCarregamento}</p>}
    {erroSalvar && <p role="alert" className="text-xs text-rose-800 print:hidden">{erroSalvar}</p>}
    {originalInvalido && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 print:hidden"><span>O cenário salvo anteriormente está ilegível. O conteúdo original continua preservado; antes de salvar um novo cenário, o sistema guardará uma cópia de recuperação.</span><button type="button" onClick={baixarRecuperacao} className="rounded border border-amber-500 px-2 py-1 font-bold">Baixar cópia original</button></div>}
    {erroRecuperacao && <p role="alert" className="text-xs text-rose-800 print:hidden">{erroRecuperacao}</p>}
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
      <strong className="flex items-center gap-2"><ShieldAlert className="h-4 w-4"/>Estimativa gerencial, não é apuração nem orientação fiscal oficial.</strong>
      <p className="mt-1">Valores dependem de classificação fiscal por operação, regime efetivo, legislação aplicável e validação profissional. O módulo não emite guias e não consulta automaticamente os portais.</p>
    </div>

    <section className="rounded-xl border bg-white p-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700 print:hidden">Empresa
          <select value={empresaAtiva?.id || ''} onChange={e => trocarEmpresa(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm" aria-label="Empresa para análise da Reforma Tributária">
            <option value="">Selecione uma empresa</option>{empresas.map(empresa => <option key={empresa.id} value={empresa.id}>{empresa.razaoSocial || empresa.nomeFantasia || empresa.cnpj} · {empresa.cnpj}</option>)}
          </select>
        </label>
        <div className="rounded-lg bg-slate-50 p-3 text-xs"><span className="text-slate-500">Regime cadastrado</span><div className="mt-1 font-bold">{empresaAtiva ? regimeNome(empresaAtiva.regimeTributario) : 'Selecione uma empresa'}</div><div className="mt-1 text-slate-500">CNAE: {empresaAtiva?.cnaePrincipal || 'não cadastrado'} · UF: {empresaAtiva?.uf || 'não cadastrada'}</div></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 print:hidden">
        <label className="text-xs font-semibold">Receita anual usada na simulação (R$)<input disabled={!empresaKey} inputMode="decimal" value={perfil.receitaAnual} onChange={e => atualizar('receitaAnual', e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="Informe valor confirmado"/></label>
        <label className="text-xs font-semibold">Carga efetiva atual informada (%)<input disabled={!empresaKey} inputMode="decimal" value={perfil.cargaAtual} onChange={e => atualizar('cargaAtual', e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="Informe percentual confirmado"/></label>
        <label className="text-xs font-semibold">Compras potencialmente creditáveis (R$)<input disabled={!empresaKey} inputMode="decimal" value={perfil.comprasPotencialmenteCreditorias} onChange={e => atualizar('comprasPotencialmenteCreditorias', e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="Não inferido pelo sistema"/></label>
        <label className="text-xs font-semibold">Parcela de compras confirmada como elegível (%)<input disabled={!empresaKey} inputMode="decimal" value={perfil.percentualElegivel} onChange={e => atualizar('percentualElegivel', e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="Validar item por item"/></label>
      </div>
      {entradasInvalidas.length > 0 && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900">Estimativa suspensa para campos com formato inválido: {entradasInvalidas.join(', ')}. Use percentuais entre 0 e 100 e valores monetários não negativos no formato brasileiro.</p>}
      <p className="text-[11px] text-slate-500">Os dados fiscais da empresa ajudam a identificar regime, atividade e UF; faturamento, carga efetiva, compras e elegibilidade de crédito precisam ser confirmados e preenchidos. Nenhum dado ausente vira zero.</p>
    </section>

    <section className="hidden print:block rounded-lg border border-slate-300 p-3 text-xs">
      <h3 className="mb-2 font-black">Parâmetros informados para esta simulação</h3>
      <table className="w-full border-collapse text-left"><tbody>
        <tr><th className="border p-1">Receita anual</th><td className="border p-1">{receita === null ? 'Pendente' : moeda(receita)}</td><th className="border p-1">Carga efetiva atual</th><td className="border p-1">{cargaAtual === null ? 'Pendente' : `${cargaAtual}%`}</td></tr>
        <tr><th className="border p-1">Compras potencialmente creditáveis</th><td className="border p-1">{lerValor(perfil.comprasPotencialmenteCreditorias) === null ? 'Pendente' : moeda(lerValor(perfil.comprasPotencialmenteCreditorias)!)}</td><th className="border p-1">Parcela elegível informada</th><td className="border p-1">{lerPercentual(perfil.percentualElegivel) === null ? 'Pendente' : `${lerPercentual(perfil.percentualElegivel)}%`}</td></tr>
        <tr><th className="border p-1">Setor de referência</th><td className="border p-1">{perfil.setorReferencia || 'Pendente'}</td><th className="border p-1">Benchmark informado</th><td className="border p-1">{lerPercentual(perfil.benchmarkSetor) === null ? 'Pendente' : `${lerPercentual(perfil.benchmarkSetor)}%`}</td></tr>
      </tbody></table>
      <h4 className="mb-1 mt-3 font-bold">Cenários por período</h4>
      <table className="w-full border-collapse text-left"><thead><tr><th className="border p-1">Período</th><th className="border p-1">Alíquota atual</th><th className="border p-1">Hipótese nova</th><th className="border p-1">Atual bruto</th><th className="border p-1">Novo bruto</th><th className="border p-1">Diferença</th></tr></thead><tbody>
        {cenarios.map(item => <tr key={item.id}><td className="border p-1">{item.rotulo}</td><td className="border p-1">{cargaAtual === null ? 'Pendente' : `${cargaAtual}%`}</td><td className="border p-1">{item.aliquotaNova === null ? 'Pendente' : `${item.aliquotaNova}%`}</td><td className="border p-1">{item.atual === null ? 'Pendente' : moeda(item.atual)}</td><td className="border p-1">{item.novo === null ? 'Pendente' : moeda(item.novo)}</td><td className="border p-1">{item.diferenca === null ? 'Pendente' : moeda(item.diferenca)}</td></tr>)}
      </tbody></table>
    </section>

    <section className="grid gap-3 md:grid-cols-3">
      <article className={`rounded-xl border p-4 ${classificacao.includes('AUMENTO') ? 'border-rose-300 bg-rose-50' : classificacao.includes('REDUÇÃO') ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
        <div className="text-[10px] font-bold uppercase text-slate-500">Impacto bruto · cenário 2033 · antes de créditos</div><div className="mt-2 text-sm font-black">{classificacao}</div><div className="mt-1 text-xs">{impactoInicial == null ? pendenciaCenario(cenarios[cenarios.length - 1]) : `${moeda(impactoInicial)} por ano, conforme os parâmetros informados; não inclui créditos potenciais.`}</div>
      </article>
      <article className="rounded-xl border border-sky-200 bg-sky-50 p-4"><div className="text-[10px] font-bold uppercase text-slate-500">Crédito potencial simulado</div><div className="mt-2 text-lg font-black text-sky-900">{creditosPotenciais === null ? 'Pendente de dados' : moeda(creditosPotenciais)}</div><div className="mt-1 text-[11px] text-slate-600">Estimativa aritmética com base e elegibilidade informadas, sem validar direito ao crédito.</div>{creditosPotenciais === null && pendenciasCredito.length > 0 && <ul className="mt-2 list-disc pl-4 text-[10px] text-slate-700">{pendenciasCredito.map(item => <li key={item}>{item}</li>)}</ul>}</article>
      <article className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-[10px] font-bold uppercase text-slate-500">Comparativo setorial</div><div className="mt-2 text-sm font-black">{diferencaSetor === null ? 'Sem referência comparável' : `${diferencaSetor > 0 ? '+' : ''}${diferencaSetor.toFixed(2)} p.p. vs. referência informada`}</div><div className="mt-1 text-[11px] text-slate-600">Sem base estatística setorial conectada. Você pode informar uma referência externa abaixo.</div></article>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div><h3 className="text-sm font-black">Cenários antes × depois</h3><p className="text-[11px] text-slate-500">Comparação bruta (receita × percentual informado), antes de créditos. Alíquota nova é hipótese preenchida pelo usuário; sem ela, o resultado fica pendente.</p></div>
        <div className="grid gap-2 sm:grid-cols-2 print:hidden">{PERIODOS.map(periodo => <label key={periodo.id} className="text-xs font-semibold">Alíquota efetiva combinada hipotética · {periodo.rotulo} (%)<input disabled={!empresaKey} inputMode="decimal" value={perfil.aliquotasNovas[periodo.id] || ''} onChange={e => atualizarAliquota(periodo.id, e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="Informe cenário validado"/></label>)}</div>
        <div className="space-y-3 pt-2" aria-label="Gráfico estimado de comparação">
          {cenarios.map(item => <div key={item.id} className="space-y-1"><div className="flex justify-between text-[11px]"><span className="font-semibold">{item.rotulo}</span><span>{item.atual === null || item.novo === null ? 'Pendente' : `${item.diferenca! > 0 ? '🔴' : item.diferenca! < 0 ? '🟢' : '🟡'} ${moeda(item.diferenca!)}`}</span></div>{item.atual === null && <div className="text-[10px] text-amber-800">{pendenciaCenario(item)}</div>}<div className="space-y-1"><div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-slate-500" style={{ width: item.atual === null ? '0%' : `${Math.max(1, item.atual / escalaMaxima * 100)}%` }}/></div><div className="h-2 rounded bg-slate-100"><div className={`h-2 rounded ${item.diferenca === null ? 'bg-slate-300' : item.diferenca > 0 ? 'bg-rose-500' : item.diferenca < 0 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: item.novo === null ? '0%' : `${Math.max(1, item.novo / escalaMaxima * 100)}%` }}/></div></div><div className="text-[10px] text-slate-500">Atual (cinza) · cenário novo (cor indicadora)</div></div>)}
        </div>
      </div>
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <h3 className="text-sm font-black">Créditos e comparação por setor</h3>
        <div className="rounded-lg border border-slate-200 p-3 text-xs"><strong>Créditos</strong><p className="mt-1 text-slate-600">A elegibilidade depende da operação, do item, do regime e das vedações legais. O painel calcula apenas compras × percentual elegível informado × alíquota hipotética de 2033. Não conclui direito, saldo aproveitável ou valor a recuperar.</p></div>
        <label className="block text-xs font-semibold print:hidden">Setor/CNAE usado como referência<input disabled={!empresaKey} value={perfil.setorReferencia} onChange={e => atualizar('setorReferencia', e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder={empresaAtiva?.cnaePrincipal || 'Informe setor ou CNAE'}/></label>
        <label className="block text-xs font-semibold print:hidden">Carga de referência setorial (%) — dado externo fornecido por você<input disabled={!empresaKey} inputMode="decimal" value={perfil.benchmarkSetor} onChange={e => atualizar('benchmarkSetor', e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="Sem base setorial automática"/></label>
        <p className="text-[11px] text-slate-500">O sistema não possui uma base estatística de empresas comparáveis; não exibe médias inventadas. A comparação só aparece quando a referência é informada.</p>
      </div>
    </section>

    <section className="rounded-xl border bg-white p-4 space-y-3">
      <div><h3 className="text-sm font-black">Análise item por item · roteiro de revisão</h3><p className="text-[11px] text-slate-500">Marque cada item após conferência profissional. A marcação organiza a análise, mas não representa parecer jurídico ou fiscal.</p></div>
      <div className="space-y-2">{ITENS_LEI.map(item => <article key={item.id} className="rounded-lg border border-indigo-100 p-3 text-xs">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><span className="font-bold text-indigo-800">{item.vigencia}</span><h4 className="mt-1 font-black text-slate-900">{item.titulo}</h4></div><label className="text-[11px] font-semibold print:hidden">Revisão desta empresa<select disabled={!empresaKey} value={perfil.revisoes[item.id] || 'PENDENTE'} onChange={e => atualizarRevisao(item.id, e.target.value as 'PENDENTE' | 'APLICA' | 'NAO_APLICA')} className="ml-2 rounded border p-1"><option value="PENDENTE">Pendente de análise</option><option value="APLICA">Aplica — confirmado</option><option value="NAO_APLICA">Não se aplica — confirmado</option></select></label><span className="hidden print:inline text-[11px] font-semibold">Revisão: {perfil.revisoes[item.id] === 'APLICA' ? 'Aplica — confirmado' : perfil.revisoes[item.id] === 'NAO_APLICA' ? 'Não se aplica — confirmado' : 'Pendente de análise'}</span></div>
        {baseDesatualizada && <label className="mt-2 flex items-center gap-2 rounded bg-amber-50 p-2 text-[11px] font-semibold text-amber-950 print:hidden"><input type="checkbox" checked={itensConferidosNaVersaoAtual.has(item.id)} onChange={event => setItensConferidosNaVersaoAtual(atual => { const proximo = new Set(atual); if (event.target.checked) proximo.add(item.id); else proximo.delete(item.id); return proximo; })}/>Conferi este item na base {VERSAO_REGRAS}</label>}
        <p className="mt-2 text-slate-700"><strong>O que muda:</strong> {item.mudanca}</p><p className="mt-1 text-slate-700"><strong>Impacto a verificar:</strong> {item.efeito}</p><p className="mt-1 text-[10px] text-slate-500">Referência legal: {item.referencia}</p><a className="mt-1 inline-block break-all text-[10px] font-semibold text-blue-800 underline" href={item.fonte.url} target="_blank" rel="noreferrer">Fonte oficial: {item.fonte.titulo} <span className="hidden print:inline">({item.fonte.url})</span><ExternalLink className="inline h-3 w-3 print:hidden"/></a>
      </article>)}</div>
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-[11px] text-sky-950">
        <strong>Base legal versionada · revisão em {new Date(`${REGRAS_REVISADAS_EM}T12:00:00`).toLocaleDateString('pt-BR')} · versão {VERSAO_REGRAS}.</strong>
        <p className="mt-1">Cada resumo abaixo aponta para sua fonte oficial. A base não se atualiza sozinha: mudanças só entram após revisão humana das fontes e publicação de uma nova versão. Confira sempre o texto e a vigência no portal oficial antes de decidir ou transmitir obrigações.</p>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs print:hidden">
        <a className="font-semibold text-blue-800 underline" href={FONTES_OFICIAIS_REFORMA.legislacao.url} target="_blank" rel="noreferrer">Legislação da Receita Federal <ExternalLink className="inline h-3 w-3"/></a>
        <a className="font-semibold text-blue-800 underline" href={FONTES_OFICIAIS_REFORMA.cronograma.url} target="_blank" rel="noreferrer">Cronograma oficial da transição <ExternalLink className="inline h-3 w-3"/></a>
        <a className="font-semibold text-blue-800 underline" href={FONTES_OFICIAIS_REFORMA.orientacoes.url} target="_blank" rel="noreferrer">Orientações e documentos fiscais <ExternalLink className="inline h-3 w-3"/></a>
        <a className="font-semibold text-blue-800 underline" href={FONTES_OFICIAIS_REFORMA.simples.url} target="_blank" rel="noreferrer">Regras Simples Nacional e IBS/CBS <ExternalLink className="inline h-3 w-3"/></a>
        <a className="font-semibold text-blue-800 underline" href="https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214compilado.htm" target="_blank" rel="noreferrer">LC 214/2025 compilada <ExternalLink className="inline h-3 w-3"/></a>
        <a className="font-semibold text-blue-800 underline" href="https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/manuais/reforma-tributaria-do-consumo" target="_blank" rel="noreferrer">Manuais oficiais da RTC <ExternalLink className="inline h-3 w-3"/></a>
      </div>
    </section>

    <footer className="hidden print:block border-t pt-3 text-[10px] text-slate-600">Relatório de simulação do Fisco IA · Gerado em {relatorioGeradoEm || 'data/hora indisponível'} · Base legal atual do módulo: {VERSAO_REGRAS} (revisada em {new Date(`${REGRAS_REVISADAS_EM}T12:00:00`).toLocaleDateString('pt-BR')}) · Versão registrada para este cenário: {versaoRegrasSalva || 'ainda não salva'} · Empresa: {empresaAtiva?.razaoSocial || 'não selecionada'} · CNPJ: {empresaAtiva?.cnpj || 'não informado'} · Regime: {regimeNome(empresaAtiva?.regimeTributario)}. Receita anual informada: {receita === null ? 'pendente' : moeda(receita)} · Carga atual: {cargaAtual === null ? 'pendente' : `${cargaAtual}%`}. Itens da lei pendentes de revisão: {ITENS_LEI.filter(item => (perfil.revisoes[item.id] || 'PENDENTE') === 'PENDENTE').length}. Valores estimados e dependentes de validação profissional; não constituem cálculo oficial nem guia de recolhimento.</footer>
    <style>{`@page { size: A4; margin: 14mm; } @media print { body * { visibility: hidden !important; } .reforma-relatorio, .reforma-relatorio * { visibility: visible !important; } .reforma-relatorio { position: absolute; left: 0; top: 0; width: 100%; margin: 0 !important; color: #111827; background: #fff; font-size: 10pt; } .reforma-relatorio section, .reforma-relatorio article { box-shadow: none !important; break-inside: avoid; page-break-inside: avoid; } .reforma-relatorio .grid { display: block !important; } .reforma-relatorio button { display: none !important; } .reforma-relatorio a { color: #111827 !important; } .reforma-relatorio footer { margin-top: 12px; } }`}</style>
  </div>;
}
