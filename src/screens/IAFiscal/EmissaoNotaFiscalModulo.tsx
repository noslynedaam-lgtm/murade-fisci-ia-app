import React, { useState } from 'react';
import { 
  FileText, Lock,
  Printer, PlusCircle, Calculator, Building2, 
  DollarSign, Percent, AlertCircle
} from 'lucide-react';
import { CertificadoDigitalDados } from './typesCertificado';
import { normalizarCnpj, validarCnpj, validarCpf } from '../../services/cnpj/cnpjValidation';

interface EmissaoNotaFiscalModuloProps {
  certificado: CertificadoDigitalDados | null;
  empresaEmitente: { razaoSocial: string; cnpj: string; inscricaoEstadual?: string; endereco?: string; uf?: string } | null;
  onIrParaCertificado: () => void;
  onFalar?: (texto: string) => void;
}

export default function EmissaoNotaFiscalModulo({
  certificado,
  empresaEmitente,
  onIrParaCertificado,
  onFalar
}: EmissaoNotaFiscalModuloProps) {
  const [tipoNota, setTipoNota] = useState<'nfe' | 'nfse'>('nfe');
  // Campos do formulário
  const [razaoSocial, setRazaoSocial] = useState('');
  const [documento, setDocumento] = useState('');
  const [ie, setIe] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cfop, setCfop] = useState('');
  const [uf, setUf] = useState('');
  const [descricao, setDescricao] = useState('');
  const [quantidade, setQuantidade] = useState<number>(1);
  const [unidade, setUnidade] = useState('UN');
  const [valorUnitario, setValorUnitario] = useState<number>(0);
  const [aliquotaIcms, setAliquotaIcms] = useState('');
  const [aliquotaIpi, setAliquotaIpi] = useState('');
  const [aliquotaIss, setAliquotaIss] = useState('');
  const [informacoesAdicionais, setInformacoesAdicionais] = useState('');

  // Aviso local; esta tela não transmite nem consulta os portais emissores.
  const [avisoEmissao, setAvisoEmissao] = useState<string | null>(null);

  // Alternar tipo de nota
  const mudarTipoNota = (novoTipo: 'nfe' | 'nfse') => {
    setTipoNota(novoTipo);
    setCfop('');
    if (novoTipo === 'nfe') {
      setAliquotaIss('');
    } else {
      setAliquotaIcms('');
      setAliquotaIpi('');
    }
  };

  // Cálculos dinâmicos
  const arredondarCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;
  const valorTotalBruto = (quantidade || 0) * (valorUnitario || 0);
  const valorTotalValido = Number.isFinite(valorTotalBruto) && valorTotalBruto >= 0 && valorTotalBruto <= Number.MAX_SAFE_INTEGER / 100;
  const valorTotal = valorTotalValido ? arredondarCentavos(valorTotalBruto) : valorTotalBruto;
  const baseCalculo = valorTotal;
  const lerAliquota = (valor: string): number | null => {
    if (valor.trim() === '') return null;
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= 0 && numero <= 100 ? numero : null;
  };
  const aliquotaIcmsNumerica = lerAliquota(aliquotaIcms);
  const aliquotaIssNumerica = lerAliquota(aliquotaIss);
  const valorIcms = tipoNota === 'nfe' && aliquotaIcmsNumerica !== null && valorTotalValido ? arredondarCentavos(valorTotal * (aliquotaIcmsNumerica / 100)) : null;
  const valorIss = tipoNota === 'nfse' && aliquotaIssNumerica !== null && valorTotalValido ? arredondarCentavos(valorTotal * (aliquotaIssNumerica / 100)) : null;

  const baixarRascunhoLocal = () => {
    const cnpjEmitente = normalizarCnpj(empresaEmitente?.cnpj || '');
    if (!empresaEmitente || !validarCnpj(cnpjEmitente)) {
      setAvisoEmissao('Selecione uma empresa emitente com CNPJ válido antes de baixar o rascunho. Nenhum arquivo foi gerado.');
      return;
    }
    const documentoInformado = documento.trim();
    const documentoValido = (validarCpf(documentoInformado))
      || (normalizarCnpj(documentoInformado).length === 14 && validarCnpj(documentoInformado));
    if (!razaoSocial.trim() || !documentoInformado || !descricao.trim() || !Number.isFinite(quantidade) || quantidade <= 0 || !Number.isFinite(valorUnitario) || valorUnitario < 0 || !valorTotalValido) {
      setAvisoEmissao('Preencha nome, CPF/CNPJ, descrição, quantidade positiva e valor unitário não negativo para baixar o rascunho.');
      return;
    }
    if (!documentoValido) {
      setAvisoEmissao('CPF/CNPJ inválido: confira o documento e seus dígitos verificadores. Nenhum rascunho foi baixado.');
      return;
    }
    const aliquotas = tipoNota === 'nfe' ? [aliquotaIcms, aliquotaIpi] : [aliquotaIss];
    if (aliquotas.some(valor => valor.trim() !== '' && lerAliquota(valor) === null)) {
      setAvisoEmissao('Alíquota inválida. Informe um número entre 0 e 100, ou deixe o campo vazio. Nenhum rascunho foi baixado.');
      return;
    }
    const rascunho = {
      tipoRegistro: 'RASCUNHO_LOCAL_NAO_FISCAL',
      aviso: 'Este arquivo é apenas um rascunho para conferência. Não é NF-e/NFS-e, não tem validade fiscal e não foi transmitido nem autorizado.',
      criadoEm: new Date().toISOString(),
      empresaEmitenteInformada: {
        razaoSocial: empresaEmitente.razaoSocial,
        cnpj: cnpjEmitente,
        inscricaoEstadual: empresaEmitente.inscricaoEstadual || null,
        endereco: empresaEmitente.endereco || null,
        uf: empresaEmitente.uf || null,
        dadosDeclaradosNoCadastro: true,
        cadastroValidadoPorOrgao: false
      },
      destinatarioTomador: { nome: razaoSocial.trim(), documento: documento.trim(), inscricaoEstadualOuRg: ie.trim() || null, endereco: endereco.trim() || null, uf: uf.trim().toUpperCase() || null },
      operacao: { tipoNota: tipoNota === 'nfe' ? 'NF-e' : 'NFS-e', cfopInformado: cfop.trim() || null },
      item: { descricao: descricao.trim(), quantidade, unidade: unidade.trim() || null, valorUnitario, valorTotalAritmetico: valorTotal },
      aliquotasInformadas: { icms: aliquotaIcms || null, ipi: aliquotaIpi || null, iss: aliquotaIss || null },
      estimativasAritmeticas: { icms: valorIcms, iss: valorIss },
      informacoesAdicionais: informacoesAdicionais.trim() || null
    };
    try {
      const blob = new Blob([JSON.stringify(rascunho, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rascunho-${tipoNota}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setAvisoEmissao('Rascunho JSON baixado para este dispositivo. Nenhuma informação foi enviada ao servidor; o arquivo não é documento fiscal.');
    } catch {
      setAvisoEmissao('Não foi possível gerar o rascunho neste navegador. Os dados continuam apenas nesta tela.');
    }
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
              <span>📄 PREPARAÇÃO DE DADOS PARA NOTA FISCAL</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                Pré-preenchimento • sem transmissão oficial
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Preencha os dados para conferência local. A emissão e assinatura oficial dependem de integração com a SEFAZ ou prefeitura.
            </p>
          </div>
        </div>

        {/* Indicador de Certificado */}
        <div className="flex items-center gap-2">
          {certificado ? (
            <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-700" />
              <span>Dados cadastrados · certificado não validado</span>
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

      {/* Cadastro local de metadados não confirma certificado nem conexão oficial. */}
      {(
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-sm flex items-center gap-2 text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              Certificado digital não validado
            </h3>
            <p className="text-xs text-amber-800">
              {certificado ? 'Há dados de certificado cadastrados, mas o servidor não recebeu nem validou o arquivo e a senha. Isso não comprova conexão ou autorização para emitir.' : 'Nenhum certificado foi informado nesta tela. Mesmo cadastrado, o certificado precisa de integração segura no servidor para assinar e transmitir notas.'}
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

      {/* Formulário de conferência local; sem comprovante de emissão. */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
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
                  CFOP <span className="text-slate-400 font-normal">({tipoNota === 'nfe' ? 'Código Fiscal de Operações — informe conforme a operação' : 'aplicável a NF-e; não usado neste rascunho de NFS-e'}):</span>
                </label>
                <input
                  type="text"
                  value={cfop}
                  onChange={(e) => setCfop(e.target.value)}
                  maxLength={4}
                  disabled={tipoNota === 'nfse'}
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
                  value={valorTotalValido ? `R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Valor fora do limite'}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-mono font-black"
                />
              </div>
            </div>
          </div>

          {/* Caixa de Impostos Oficiais */}
          <div className="border border-emerald-300 bg-emerald-50/40 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 uppercase tracking-wider">
              <Percent className="w-3.5 h-3.5 text-emerald-700" />
              <span>📊 Estimativa aritmética com alíquotas informadas</span>
            </h3>
            <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">Informe alíquotas confirmadas, entre 0% e 100%. O ICMS/ISS exibido é multiplicação aritmética simples sobre o total informado; não determina base, CFOP nem regras fiscais. A alíquota de IPI é apenas informativa e não tem valor calculado.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Alíquota ICMS (%):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={aliquotaIcms}
                  disabled={tipoNota === 'nfse'}
                  onChange={(e) => setAliquotaIcms(e.target.value)}
                  placeholder="Informar conforme operação"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200 font-mono font-bold disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Alíquota IPI (%) — informativa:</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={aliquotaIpi}
                  disabled={tipoNota === 'nfse'}
                  onChange={(e) => setAliquotaIpi(e.target.value)}
                  placeholder="Sem cálculo de valor"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200 font-mono font-bold disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Alíquota ISS (%):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={aliquotaIss}
                  disabled={tipoNota === 'nfe'}
                  onChange={(e) => setAliquotaIss(e.target.value)}
                  placeholder="Informar conforme município/serviço"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200 font-mono font-bold disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Valor bruto usado na estimativa R$:</label>
                <input
                  type="text"
                  readOnly
                  value={valorTotalValido ? `R$ ${baseCalculo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Valor fora do limite'}
                  className="w-full px-3 py-2 bg-emerald-100/60 border border-emerald-300 rounded-xl text-emerald-950 font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Valor ICMS R$:</label>
                <input
                  type="text"
                  readOnly
                  value={valorIcms === null ? 'Informe a alíquota' : `R$ ${valorIcms.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  className="w-full px-3 py-2 bg-emerald-100/60 border border-emerald-300 rounded-xl text-emerald-950 font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Valor ISS R$:</label>
                <input
                  type="text"
                  readOnly
                  value={valorIss === null ? 'Informe a alíquota' : `R$ ${valorIss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
              TOTAL ARITMÉTICO DOS ITENS · SEM CÁLCULO TRIBUTÁRIO (NÃO É NOTA FISCAL):
            </span>
            <strong className="text-2xl sm:text-3xl font-black text-emerald-900 font-mono">
              {valorTotalValido ? `R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Valor fora do limite'}
            </strong>
          </div>

          <button type="button" onClick={baixarRascunhoLocal} className="w-full py-3 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-950 font-bold text-sm cursor-pointer">
            Baixar rascunho local (JSON — não é nota fiscal)
          </button>
          {avisoEmissao && <div role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs">{avisoEmissao}</div>}
          <div role="status" className="w-full p-4 rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 text-sm">
            <strong className="block">Emissão oficial indisponível</strong>
            <span className="text-xs">SEFAZ e prefeitura não estão conectadas. Nenhuma nota foi enviada, assinada ou autorizada por este sistema.</span>
          </div>
        </form>
    </div>
  );
}
