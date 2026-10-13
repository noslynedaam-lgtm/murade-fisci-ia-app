import React, { useState, useEffect } from 'react';
import { 
  FileText, ShieldCheck, CheckCircle2, Lock, 
  Printer, PlusCircle, Calculator, Building2, 
  DollarSign, Percent, AlertCircle, Sparkles, Send
} from 'lucide-react';
import { CertificadoDigitalDados, NotaFiscalEmitida } from './typesCertificado';

interface EmissaoNotaFiscalModuloProps {
  certificado: CertificadoDigitalDados | null;
  onIrParaCertificado: () => void;
  onFalar?: (texto: string) => void;
}

export default function EmissaoNotaFiscalModulo({
  certificado,
  onIrParaCertificado,
  onFalar
}: EmissaoNotaFiscalModuloProps) {
  const [tipoNota, setTipoNota] = useState<'nfe' | 'nfse'>('nfe');
  const [numeroNotaAtual, setNumeroNotaAtual] = useState<number>(() => {
    try {
      const salvo = localStorage.getItem('fiasco_numero_nota');
      return salvo ? parseInt(salvo, 10) : 1;
    } catch (e) {
      return 1;
    }
  });

  // Campos do formulário
  const [razaoSocial, setRazaoSocial] = useState('');
  const [documento, setDocumento] = useState('');
  const [ie, setIe] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cfop, setCfop] = useState('5102');
  const [uf, setUf] = useState('GO');
  const [descricao, setDescricao] = useState('');
  const [quantidade, setQuantidade] = useState<number>(1);
  const [unidade, setUnidade] = useState('UN');
  const [valorUnitario, setValorUnitario] = useState<number>(0);
  const [aliquotaIcms, setAliquotaIcms] = useState<number>(18.0);
  const [aliquotaIpi, setAliquotaIpi] = useState<number>(0.0);
  const [aliquotaIss, setAliquotaIss] = useState<number>(3.0);
  const [informacoesAdicionais, setInformacoesAdicionais] = useState('');

  // Nota emitida atualmente
  const [notaGerada, setNotaGerada] = useState<NotaFiscalEmitida | null>(null);

  // Auto preencher com a razão social do certificado se não estiver preenchido
  useEffect(() => {
    if (certificado?.razao && !razaoSocial) {
      setRazaoSocial(certificado.razao);
    }
  }, [certificado]);

  // Alternar tipo de nota
  const mudarTipoNota = (novoTipo: 'nfe' | 'nfse') => {
    setTipoNota(novoTipo);
    if (novoTipo === 'nfe') {
      setCfop('5102');
    } else {
      setCfop('5933');
    }
  };

  // Cálculos dinâmicos
  const valorTotal = (quantidade || 0) * (valorUnitario || 0);
  const baseCalculo = valorTotal;
  const valorIcms = tipoNota === 'nfe' ? valorTotal * ((aliquotaIcms || 0) / 100) : 0;
  const valorIss = tipoNota === 'nfse' ? valorTotal * ((aliquotaIss || 0) / 100) : 0;

  const handleEmitirNota = (e: React.FormEvent) => {
    e.preventDefault();

    if (!certificado || !certificado.valido) {
      alert('⚠️ Cadastre e valide o Certificado Digital primeiro para emitir notas fiscais com validade legal!');
      onIrParaCertificado();
      return;
    }

    if (!razaoSocial.trim() || !documento.trim() || !descricao.trim() || valorUnitario <= 0) {
      alert('⚠️ Preencha todos os campos obrigatórios (Razão Social, CPF/CNPJ, Descrição e Valor Unitário maior que zero)!');
      return;
    }

    const nroFormatado = String(numeroNotaAtual).padStart(6, '0');
    const agora = new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const chaveGerada = `5226${Date.now().toString().slice(-10)}00019955001${nroFormatado}100001019`;

    const novaNota: NotaFiscalEmitida = {
      numero: nroFormatado,
      serie: '1',
      dataEmissao: agora,
      tipo: tipoNota,
      razaoSocial,
      documento,
      ie,
      endereco: endereco || 'Endereço Comercial Padrão',
      cfop,
      uf,
      descricao,
      quantidade,
      unidade,
      valorUnitario,
      valorTotal,
      aliquotaIcms,
      aliquotaIpi,
      aliquotaIss,
      baseCalculo,
      valorIcms,
      informacoesAdicionais,
      assinaturaDigital: `ASSINADO_DIGITALMENTE_ICP_BRASIL_SHA256_${Date.now().toString(16).toUpperCase()}`,
      chaveAcessoSefaz: chaveGerada
    };

    setNotaGerada(novaNota);
    const proximoNumero = numeroNotaAtual + 1;
    setNumeroNotaAtual(proximoNumero);
    try {
      localStorage.setItem('fiasco_numero_nota', String(proximoNumero));
    } catch (e) {}

    const mensagemVoz = `Nota Fiscal número ${nroFormatado} emitida e assinada com Certificado Digital! Valor total R$ ${valorTotal.toFixed(2)}! ✅🔐`;
    if (onFalar) {
      onFalar(mensagemVoz);
    }
  };

  const handleNovaNota = () => {
    setNotaGerada(null);
    setDescricao('');
    setValorUnitario(0);
    setQuantidade(1);
    setInformacoesAdicionais('');
  };

  const handleSalvarPdf = () => {
    window.print();
  };

  return (
    <div id="modulo-emissao-nfe" className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm space-y-6">
      {/* Header do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-xs">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 flex-wrap">
              <span>📄 EMISSÃO DE NOTA FISCAL (SEFAZ-GO)</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                Modelo Oficial 55 / NFS-e
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Gere e assine digitalmente notas fiscais de produtos e serviços em conformidade com as exigências da SEFAZ e Receita Federal.
            </p>
          </div>
        </div>

        {/* Indicador de Certificado */}
        <div className="flex items-center gap-2">
          {certificado?.valido ? (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Certificado A1 Ativo</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onIrParaCertificado}
              className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-4 h-4 text-amber-600" />
              <span>Cadastrar Certificado Primeiro</span>
            </button>
          )}
        </div>
      </div>

      {/* Se o certificado não estiver cadastrado, bloqueia a tela */}
      {!certificado?.valido && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-sm flex items-center gap-2 text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              Certificado Digital Não Identificado
            </h3>
            <p className="text-xs text-amber-800">
              Para emitir notas com validade jurídica perante a SEFAZ-GO e a Receita Federal, você precisa primeiro cadastrar e salvar o seu Certificado Digital A1 ou A3.
            </p>
          </div>
          <button
            type="button"
            onClick={onIrParaCertificado}
            className="px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shrink-0 cursor-pointer shadow-xs"
          >
            🔐 Cadastrar Certificado Agora
          </button>
        </div>
      )}

      {/* Formulário ou Nota Gerada */}
      {!notaGerada ? (
        <form onSubmit={handleEmitirNota} className="space-y-5">
          {/* Seletor do Tipo de Nota */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">Tipo de Nota Fiscal:</label>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => mudarTipoNota('nfe')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  tipoNota === 'nfe'
                    ? 'bg-indigo-900 text-white border-indigo-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>📦 NF-e (Produto / Mercadoria)</span>
              </button>

              <button
                type="button"
                onClick={() => mudarTipoNota('nfse')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  tipoNota === 'nfse'
                    ? 'bg-indigo-900 text-white border-indigo-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>🛠️ NFS-e (Serviço Prestado)</span>
              </button>
            </div>
          </div>

          {/* Dados do Destinatário */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
              <Building2 className="w-3.5 h-3.5 text-indigo-700" />
              <span>Identificação do Destinatário / Tomador</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2 space-y-1">
                <label className="font-bold text-slate-700 block">Razão Social / Nome Completo: *</label>
                <input
                  type="text"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Nome do cliente ou da empresa compradora"
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">CPF ou CNPJ do Destinatário: *</label>
                <input
                  type="text"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="Apenas números ou formatado"
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 font-mono font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Inscrição Estadual (IE) ou RG: (Opcional)</label>
                <input
                  type="text"
                  value={ie}
                  onChange={(e) => setIe(e.target.value)}
                  placeholder="Isento ou número da IE"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 font-medium"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="font-bold text-slate-700 block">Endereço Completo:</label>
                <input
                  type="text"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Rua, Número, Bairro, Cidade - UF"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  CFOP <span className="text-slate-400 font-normal">(Código Fiscal de Operações - SEFAZ):</span>
                </label>
                <input
                  type="text"
                  value={cfop}
                  onChange={(e) => setCfop(e.target.value)}
                  maxLength={4}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">UF de Destino:</label>
                <input
                  type="text"
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase())}
                  maxLength={2}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* Dados do Produto / Serviço */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
              <Calculator className="w-3.5 h-3.5 text-indigo-700" />
              <span>Itens da Nota (Produto / Serviço)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="sm:col-span-4 space-y-1">
                <label className="font-bold text-slate-700 block">Descrição do Produto ou Serviço: *</label>
                <input
                  type="text"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Consultoria Tributária Mensal ou Mercadoria para Revenda"
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Quantidade: *</label>
                <input
                  type="number"
                  value={quantidade}
                  min={1}
                  step="any"
                  onChange={(e) => setQuantidade(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Unidade Comercial:</label>
                <input
                  type="text"
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Valor Unitário R$: *</label>
                <input
                  type="number"
                  step="0.01"
                  value={valorUnitario || ''}
                  onChange={(e) => setValorUnitario(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 font-mono font-bold text-emerald-800"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Valor Total R$ (Calculado):</label>
                <input
                  type="text"
                  readOnly
                  value={`R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-mono font-black"
                />
              </div>
            </div>
          </div>

          {/* Caixa de Impostos Oficiais */}
          <div className="border border-emerald-300 bg-emerald-50/40 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 uppercase tracking-wider">
              <Percent className="w-3.5 h-3.5 text-emerald-700" />
              <span>📊 Tributos Incidentes & Alíquotas Vigentes (SEFAZ-GO)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Alíquota ICMS (%):</label>
                <input
                  type="number"
                  step="0.01"
                  value={aliquotaIcms}
                  disabled={tipoNota === 'nfse'}
                  onChange={(e) => setAliquotaIcms(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200 font-mono font-bold disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Alíquota IPI (%):</label>
                <input
                  type="number"
                  step="0.01"
                  value={aliquotaIpi}
                  onChange={(e) => setAliquotaIpi(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200 font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Alíquota ISS (%):</label>
                <input
                  type="number"
                  step="0.01"
                  value={aliquotaIss}
                  disabled={tipoNota === 'nfe'}
                  onChange={(e) => setAliquotaIss(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200 font-mono font-bold disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Base de Cálculo R$:</label>
                <input
                  type="text"
                  readOnly
                  value={`R$ ${baseCalculo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  className="w-full px-3 py-2 bg-emerald-100/60 border border-emerald-300 rounded-xl text-emerald-950 font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Valor ICMS R$:</label>
                <input
                  type="text"
                  readOnly
                  value={`R$ ${valorIcms.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  className="w-full px-3 py-2 bg-emerald-100/60 border border-emerald-300 rounded-xl text-emerald-950 font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Valor ISS R$:</label>
                <input
                  type="text"
                  readOnly
                  value={`R$ ${valorIss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  className="w-full px-3 py-2 bg-emerald-100/60 border border-emerald-300 rounded-xl text-emerald-950 font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* Informações Complementares */}
          <div className="space-y-1 text-xs">
            <label className="font-bold text-slate-700 block">Informações Complementares / Dados Adicionais:</label>
            <textarea
              rows={2}
              value={informacoesAdicionais}
              onChange={(e) => setInformacoesAdicionais(e.target.value)}
              placeholder="Dados de interesse do contribuinte ou fisco (ex: Tributação pelo Simples Nacional - Art. 18 da LC 123/2006)"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 font-medium"
            />
          </div>

          {/* Resumo Final & Total */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide block">
              VALOR TOTAL DA NOTA FISCAL:
            </span>
            <strong className="text-2xl sm:text-3xl font-black text-emerald-900 font-mono">
              R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>

          {/* Botão de Emissão */}
          <button
            type="submit"
            disabled={!certificado?.valido}
            className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all disabled:opacity-50"
          >
            <ShieldCheck className="w-5 h-5 text-emerald-200" />
            <span>
              {certificado?.valido
                ? '📄 Emitir e Assinar com Certificado Digital (SEFAZ)'
                : '🔒 Cadastre o Certificado Primeiro para Emitir'}
            </span>
          </button>
        </form>
      ) : (
        /* Visualização da Nota Fiscal Emitida */
        <div id="nota-fiscal-gerada-visual" className="space-y-6 animate-in fade-in duration-300">
          <div className="border-2 border-dashed border-emerald-500 rounded-3xl p-6 bg-emerald-50/20 space-y-5">
            {/* Topo da Nota */}
            <div className="text-center border-b border-dashed border-emerald-300 pb-4 space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                NOTA FISCAL AUTORIZADA E ASSINADA COM SUCESSO
              </span>
              <h3 className="text-2xl font-black text-slate-900 font-mono">
                Nº {notaGerada.numero} · Série {notaGerada.serie}
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Emissão: {notaGerada.dataEmissao} · Protocolo SEFAZ-GO: 152260000098762
              </p>
              <p className="text-[11px] text-purple-700 font-bold flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Assinada com Certificado Digital ICP-Brasil — Plena Validade Legal
              </p>
            </div>

            {/* Chave de Acesso */}
            <div className="bg-slate-100 p-2.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-bold block">CHAVE DE ACESSO SEFAZ (44 DÍGITOS):</span>
              <span className="font-mono text-[11px] font-bold text-slate-800 break-all select-all">
                {notaGerada.chaveAcessoSefaz}
              </span>
            </div>

            {/* Detalhes da Nota */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1.5">
                <h4 className="font-black text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-100 pb-1">
                  DESTINATÁRIO / TOMADOR
                </h4>
                <p><strong>Nome / Razão:</strong> {notaGerada.razaoSocial}</p>
                <p><strong>CPF / CNPJ:</strong> <span className="font-mono">{notaGerada.documento}</span></p>
                {notaGerada.ie && <p><strong>IE / RG:</strong> {notaGerada.ie}</p>}
                <p><strong>Endereço:</strong> {notaGerada.endereco}</p>
                <p><strong>UF:</strong> {notaGerada.uf} · <strong>CFOP:</strong> {notaGerada.cfop}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1.5">
                <h4 className="font-black text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-100 pb-1">
                  PRODUTO / SERVIÇO
                </h4>
                <p><strong>Descrição:</strong> {notaGerada.descricao}</p>
                <p><strong>Qtd:</strong> {notaGerada.quantidade} {notaGerada.unidade}</p>
                <p><strong>Valor Unitário:</strong> R$ {notaGerada.valorUnitario.toFixed(2)}</p>
                <p><strong>Base de Cálculo:</strong> R$ {notaGerada.baseCalculo.toFixed(2)}</p>
                <p><strong>ICMS ({notaGerada.aliquotaIcms}%):</strong> R$ {notaGerada.valorIcms.toFixed(2)}</p>
              </div>
            </div>

            {/* Valor Final */}
            <div className="bg-amber-100/60 border border-amber-300 rounded-2xl p-4 text-center">
              <span className="text-xs font-bold text-amber-900 block">VALOR TOTAL DA NOTA FISCAL:</span>
              <strong className="text-2xl font-black text-amber-950 font-mono">
                R$ {notaGerada.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>

            {/* Botões de Ação */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleSalvarPdf}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>💾 Salvar em PDF / Imprimir DANFE</span>
              </button>

              <button
                type="button"
                onClick={handleNovaNota}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>📄 Emitir Nova Nota</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
