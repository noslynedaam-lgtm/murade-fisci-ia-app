import React, { useState } from 'react';
import { X, KeyRound, ShieldCheck, CheckCircle2, AlertTriangle, UploadCloud, Lock, Loader2, Building2, ExternalLink } from 'lucide-react';
import { EmpresaDados } from '../../types';
import { normalizarCnpj } from '../../services/cnpj/cnpjValidation';

interface ModalCertificadoEmpresaProps {
  empresa: EmpresaDados;
  onFechar: () => void;
  onSalvarCertificado: (empresaAtualizada: EmpresaDados) => void;
  onAbrirCadastroCompleto?: () => void;
}

export default function ModalCertificadoEmpresa({
  empresa,
  onFechar,
  onSalvarCertificado,
  onAbrirCadastroCompleto
}: ModalCertificadoEmpresaProps) {
  const certAtual = empresa.certificado;

  const [tipo, setTipo] = useState<'A1' | 'A3'>(certAtual?.tipo || 'A1');
  const [nomeArquivo, setNomeArquivo] = useState(certAtual?.nomeArquivo || '');
  const [validade, setValidade] = useState(certAtual?.validade || '');
  const [emissor, setEmissor] = useState(certAtual?.emissor || '');

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const calcularDiasVencimento = (dataStr: string) => {
    if (!dataStr) return null;
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataStr);
    if (!partes) return null;
    const ano = Number(partes[1]);
    const mes = Number(partes[2]);
    const dia = Number(partes[3]);
    const data = new Date(ano, mes - 1, dia);
    if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diff = data.getTime() - hoje.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const diasRestantes = calcularDiasVencimento(validade);

  const handleArquivoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!/\.p(?:fx|12)$/i.test(file.name)) {
        setErroSalvar('Selecione um arquivo com extensão .pfx ou .p12. O conteúdo do arquivo não será enviado nem validado.');
        e.target.value = '';
        return;
      }
      setErroSalvar(null);
      setNomeArquivo(file.name);
    }
  };

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    setErroSalvar(null);
    if (validade && diasRestantes === null) {
      setErroSalvar('A data de validade informada é inválida. Corrija ou deixe o campo vazio.');
      setSalvando(false);
      return;
    }
    let valoresAnteriores: { chaveCliente: string; certificadoCliente: string | null } | null = null;

    try {
      const certificadoAtualizado = {
        tipo,
        nomeArquivo,
        validade,
        emissor,
        ativo: false,
        valido: false,
        dataCadastro: new Date().toLocaleDateString('pt-BR')
      };

      const cnpjLimpo = normalizarCnpj(empresa.cnpj);
      const chaveCliente = 'fiscoia_certificado_cliente_' + cnpjLimpo;
      valoresAnteriores = {
        chaveCliente,
        certificadoCliente: localStorage.getItem(chaveCliente)
      };
      localStorage.setItem(chaveCliente, JSON.stringify(certificadoAtualizado));

      const empresaAtualizada: EmpresaDados = {
        ...empresa,
        certificado: certificadoAtualizado,
        statusCND: empresa.statusCND || 'NAO_CONSULTADA',
        procuracaoAtiva: empresa.procuracaoAtiva ?? false
      };

      onSalvarCertificado(empresaAtualizada);
    } catch (error) {
      try {
        if (valoresAnteriores) {
          if (valoresAnteriores.certificadoCliente) localStorage.setItem(valoresAnteriores.chaveCliente, valoresAnteriores.certificadoCliente);
          else localStorage.removeItem(valoresAnteriores.chaveCliente);
        }
      } catch {}
      setErroSalvar(error instanceof Error ? `Não foi possível salvar a referência local: ${error.message}` : 'Não foi possível salvar a referência local neste navegador.');
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 space-y-6 animate-in fade-in zoom-in-95 duration-150 my-8">
        
        {/* Header do Modal */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 shadow-xs">
              <KeyRound className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  Certificado Digital do Cliente
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Referência local
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Registre dados de referência do certificado. Esta tela não faz a conexão oficial.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors shrink-0"
            title="Fechar Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informações da Empresa Selecionada */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Empresa selecionada</span>
            </div>
            <h4 className="text-sm font-extrabold text-slate-900 mt-0.5 truncate">
              {empresa.razaoSocial}
            </h4>
            <div className="text-xs font-mono text-slate-600 mt-0.5 flex items-center gap-2">
              <span>CNPJ: <strong>{empresa.cnpj}</strong></span>
              {empresa.regimeTributario && (
                <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-white text-slate-700 border border-slate-200">
                  {empresa.regimeTributario.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0">
            {certAtual ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-300">
                <AlertTriangle className="w-3 h-3 text-amber-700" /> Referência local · não validada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-300">
                <AlertTriangle className="w-3 h-3 text-amber-600" /> Sem referência local
              </span>
            )}
          </div>
        </div>

        {/* Formulário de Certificado */}
        <form onSubmit={handleSalvar} className="space-y-4">
          
          {/* Tipo de Certificado: A1 ou A3 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Tipo do Certificado Digital
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTipo('A1')}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                  tipo === 'A1'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 text-indigo-950 font-bold'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold">e-CNPJ A1</span>
                  {tipo === 'A1' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </div>
                <p className="text-[11px] text-slate-500 font-normal mt-1 leading-tight">
                  Arquivo digital (.pfx / .p12) em nuvem ou máquina local. Mais recomendado.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTipo('A3')}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                  tipo === 'A3'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 text-indigo-950 font-bold'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold">e-CNPJ A3</span>
                  {tipo === 'A3' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </div>
                <p className="text-[11px] text-slate-500 font-normal mt-1 leading-tight">
                  Token físico USB, cartão inteligente ou certificado em nuvem.
                </p>
              </button>
            </div>
          </div>

          {/* Upload de Arquivo ou Nome */}
          {tipo === 'A1' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Arquivo do Certificado (.pfx / .p12)
              </label>
              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-4 text-center bg-slate-50/50 hover:bg-indigo-50/20 transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept=".pfx,.p12"
                  onChange={handleArquivoUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <UploadCloud className="w-7 h-7 text-indigo-600 mx-auto mb-1.5" />
                {nomeArquivo ? (
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-900 truncate max-w-sm mx-auto">
                      📄 {nomeArquivo}
                    </p>
                    <p className="text-[10px] text-emerald-600 font-bold">
                      Somente o nome será registrado; o conteúdo não será enviado nem armazenado.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Clique para selecionar ou arraste o arquivo do certificado (.pfx)
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      O arquivo não sai do seu dispositivo nesta tela.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Identificação do Dispositivo Token / Cartão A3
              </label>
              <input
                type="text"
                value={nomeArquivo}
                onChange={(e) => setNomeArquivo(e.target.value)}
                placeholder="Ex: Token SafeNet e-CNPJ da Empresa"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-slate-800"
              />
            </div>
          )}

          {/* Validade declarada manualmente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Data de Validade
              </label>
              <input
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-slate-800 font-mono"
              />
            </div>
          </div>

          {validade && diasRestantes === null && (
            <div role="alert" className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              A data de validade cadastrada está inválida e não pode ser considerada pelo sistema. Corrija o campo antes de salvar.
            </div>
          )}

          {/* Alerta de validade informada; não comprova o certificado. */}
          {diasRestantes !== null && (
            <div className="text-xs">
              {diasRestantes < 0 ? (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span><strong>Atenção:</strong> a data de validade informada está no passado. O certificado não foi verificado.</span>
                </div>
              ) : diasRestantes <= 30 ? (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span><strong>Alerta:</strong> a data de validade informada ocorre em <strong>{diasRestantes} dias</strong>. O certificado não foi verificado.</span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-blue-700 shrink-0" />
              <span>Data de validade informada: <strong>{new Date(validade + 'T00:00:00').toLocaleDateString('pt-BR')}</strong>. Não verificada pelo sistema.</span>
                </div>
              )}
            </div>
          )}

          {/* Autoridade Certificadora / Emissor */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Autoridade Certificadora (Emissor ICP-Brasil)
            </label>
            <select
              value={emissor}
              onChange={(e) => setEmissor(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-slate-800 bg-white"
            >
              <option value="">Selecione se souber</option>
              <option value="Autoridade Certificadora SERPRO RFB v10 (ICP-Brasil)">Autoridade Certificadora SERPRO RFB v10 (ICP-Brasil)</option>
              <option value="AC Certisign Multipla G7 (ICP-Brasil)">AC Certisign Multipla G7 (ICP-Brasil)</option>
              <option value="AC Soluti Multipla v5 (ICP-Brasil)">AC Soluti Multipla v5 (ICP-Brasil)</option>
              <option value="AC Valid Brasil v5 (ICP-Brasil)">AC Valid Brasil v5 (ICP-Brasil)</option>
              <option value="AC Safeweb RFB v5 (ICP-Brasil)">AC Safeweb RFB v5 (ICP-Brasil)</option>
              <option value="AC Caixa Econômica Federal ICP-Brasil">AC Caixa Econômica Federal ICP-Brasil</option>
              <option value="Outra Autoridade Homologada ICP-Brasil">Outra Autoridade Homologada ICP-Brasil</option>
            </select>
          </div>

          <div role="note" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>A conexão com RFB/SERPRO não está implementada. Este formulário salva somente uma referência local; não testa nem envia o certificado.</span>
          </div>
          {erroSalvar && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">{erroSalvar}</div>}

          {/* Botões de Ação */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              disabled={salvando}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando referência...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Salvar dados de referência</span>
                </>
              )}
            </button>

            {onAbrirCadastroCompleto && (
              <button
                type="button"
                onClick={() => {
                  onFechar();
                  onAbrirCadastroCompleto();
                }}
                className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-300 shrink-0"
                title="Abrir formulário completo para alterar outros dados (endereço, telefone, contadora, etc.)"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>Editar Cadastro Completo</span>
              </button>
            )}

            <button
              type="button"
              onClick={onFechar}
              className="w-full sm:w-auto py-3 px-4 text-slate-500 hover:text-slate-800 font-bold text-xs cursor-pointer transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>

        {/* Rodapé de Compliance */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
          <Lock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>
            <strong>Referência local:</strong> o arquivo não é enviado nem guardado pelo sistema, e o nome/data informados não validam o certificado. Não informe a senha aqui. A integração oficial ainda não está conectada.
          </span>
        </div>

      </div>
    </div>
  );
}
