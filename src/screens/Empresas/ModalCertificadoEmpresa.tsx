import React, { useEffect, useState } from 'react';
import { X, KeyRound, ShieldCheck, CheckCircle2, AlertTriangle, UploadCloud, Lock, Loader2, Building2, ExternalLink } from 'lucide-react';
import { EmpresaDados } from '../../types';
import CotaConsultasSerpro from '../../components/CotaConsultasSerpro';
import { salvarCertificadoA1Central } from '../../services/empresas/empresasCentral.service';

interface ModalCertificadoEmpresaProps {
  empresa: EmpresaDados;
  onFechar: () => void;
  onSalvarCertificado: (empresaAtualizada: EmpresaDados) => Promise<void>;
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
  const [arquivoA1, setArquivoA1] = useState<File | null>(null);
  const [senhaA1, setSenhaA1] = useState('');
  const [statusServidor, setStatusServidor] = useState<{ carregando: boolean; cadastrado: boolean; mensagem: string }>({ carregando: true, cadastrado: false, mensagem: '' });

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

  useEffect(() => {
    if (!empresa.idCentral || !empresa.tenantIdCentral) {
      setStatusServidor({ carregando: false, cadastrado: false, mensagem: 'Salve o cadastro completo da empresa no banco permanente antes de vincular o A1.' });
      return;
    }
    let ativo = true;
    fetch(`/api/companies/${encodeURIComponent(empresa.idCentral)}/fiscal-certificate/status?tenantId=${encodeURIComponent(empresa.tenantIdCentral)}`, {
      credentials: 'same-origin', cache: 'no-store',
    }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.mensagem === 'string' ? data.mensagem : 'Não foi possível consultar o estado salvo do A1.');
      if (ativo) setStatusServidor({ carregando: false, cadastrado: data.cadastradoNoServidor === true, mensagem: data.cadastradoNoServidor === true
        ? `A1 cifrado no banco permanente desde ${new Date(data.recebidoEm).toLocaleString('pt-BR')}. Ainda não validado pela SEFAZ.`
        : 'Nenhum arquivo A1 foi confirmado no cofre do servidor.' });
    }).catch(error => {
      if (ativo) setStatusServidor({ carregando: false, cadastrado: false, mensagem: error instanceof Error ? error.message : 'Falha ao verificar o cofre do servidor.' });
    });
    return () => { ativo = false; };
  }, [empresa.idCentral, empresa.tenantIdCentral]);

  const handleArquivoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!/\.p(?:fx|12)$/i.test(file.name)) {
        setErroSalvar('Selecione um arquivo com extensão .pfx ou .p12.');
        e.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErroSalvar('O arquivo A1 excede o limite de 5 MB. Nenhum dado foi enviado.');
        e.target.value = '';
        return;
      }
      setErroSalvar(null);
      setNomeArquivo(file.name);
      setArquivoA1(file);
      // Se a senha já foi digitada, salva e reconhece na hora.
      if (senhaA1) setTimeout(() => { void salvarAutomatico(file, senhaA1); }, 0);
    }
  };

  // Salvamento automático: assim que arquivo + senha estiverem preenchidos, envia e reconhece.
  const salvarAutomatico = async (arquivo: File | null, senha: string) => {
    if (salvando || tipo !== 'A1' || !arquivo || !senha) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      if (!empresa.idCentral || !empresa.tenantIdCentral) throw new Error('Salve o cadastro completo da empresa no banco permanente antes de vincular o certificado.');
      const resultado = await salvarCertificadoA1Central(empresa.idCentral, empresa.tenantIdCentral, arquivo, senha);
      const validadeFinal = resultado.validade || validade;
      const emissorFinal = resultado.emissor || emissor;
      if (resultado.validade) setValidade(resultado.validade);
      if (resultado.emissor) setEmissor(resultado.emissor);
      await onSalvarCertificado({
        ...empresa,
        certificado: {
          tipo, nomeArquivo: arquivo.name, validade: validadeFinal, emissor: emissorFinal, ativo: false, valido: false, servidorCadastrado: true,
          recebidoEm: resultado.recebidoEm, dataCadastro: new Date().toLocaleDateString('pt-BR'),
        },
        statusCND: empresa.statusCND || 'NAO_CONSULTADA',
        procuracaoAtiva: empresa.procuracaoAtiva ?? false,
      });
      setSenhaA1('');
      setArquivoA1(null);
    } catch (error) {
      setErroSalvar(error instanceof Error ? error.message : 'Não foi possível confirmar o salvamento protegido do certificado.');
    }
    setSalvando(false);
  };

  const handleSalvar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (salvando) return;
    setSalvando(true);
    setErroSalvar(null);
    if (validade && diasRestantes === null) {
      setErroSalvar('A data de validade informada é inválida. Corrija ou deixe o campo vazio.');
      setSalvando(false);
      return;
    }
    try {
      if (tipo !== 'A1') throw new Error('O armazenamento seguro de certificado A3/token não está disponível nesta tela. Não vou salvar uma referência como se fosse uma credencial funcional.');
      if (!empresa.idCentral || !empresa.tenantIdCentral) throw new Error('Salve o cadastro completo da empresa no banco permanente antes de vincular o certificado.');
      let resultadoA1: { recebidoEm: string; mensagem: string; validade?: string; emissor?: string } | null = null;
      if (arquivoA1 || senhaA1) {
        if (!arquivoA1) throw new Error('O arquivo do certificado precisa ser selecionado novamente: clique na área pontilhada e escolha o .pfx/.p12.');
        if (!senhaA1) throw new Error('Informe a senha do arquivo A1.');
        resultadoA1 = await salvarCertificadoA1Central(empresa.idCentral, empresa.tenantIdCentral, arquivoA1, senhaA1);
        if (resultadoA1.validade) setValidade(resultadoA1.validade);
        if (resultadoA1.emissor) setEmissor(resultadoA1.emissor);
      } else if (!statusServidor.cadastrado) {
        throw new Error('Selecione o arquivo A1 e informe sua senha para o primeiro cadastro seguro.');
      }

      const certificadoAtualizado = {
        tipo,
        nomeArquivo: arquivoA1?.name || nomeArquivo,
        validade: resultadoA1?.validade || validade,
        emissor: resultadoA1?.emissor || emissor,
        ativo: false,
        valido: false,
        servidorCadastrado: true,
        recebidoEm: resultadoA1?.recebidoEm || certAtual?.recebidoEm,
        dataCadastro: new Date().toLocaleDateString('pt-BR')
      };

      const empresaAtualizada: EmpresaDados = {
        ...empresa,
        certificado: certificadoAtualizado,
        statusCND: empresa.statusCND || 'NAO_CONSULTADA',
        procuracaoAtiva: empresa.procuracaoAtiva ?? false
      };

      await onSalvarCertificado(empresaAtualizada);
      setSenhaA1('');
      setArquivoA1(null);
    } catch (error) {
      setErroSalvar(error instanceof Error ? error.message : 'Não foi possível confirmar o salvamento protegido do certificado.');
    }
    setSalvando(false);
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
                  Cofre do A1
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Salva o A1 cifrado no banco permanente. O salvamento não ativa a consulta fiscal oficial.
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

        <CotaConsultasSerpro companyId={empresa.idCentral} tenantId={empresa.tenantIdCentral} />

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
            {statusServidor.cadastrado ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-700" /> A1 no servidor
              </span>
            ) : certAtual ? (
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
                {arquivoA1 ? (
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-900 truncate max-w-sm mx-auto">
                      📄 {arquivoA1.name}
                    </p>
                    <p className="text-[10px] text-emerald-600 font-bold">
                      Arquivo carregado. {senhaA1 ? (salvando ? 'Enviando…' : 'Salvando ao sair do campo da senha.') : 'Agora digite a senha abaixo.'}
                    </p>
                  </div>
                ) : nomeArquivo ? (
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-500 truncate max-w-sm mx-auto">
                      Cadastro anterior: {nomeArquivo}
                    </p>
                    <p className="text-[11px] text-amber-700 font-bold">
                      Clique aqui e escolha o arquivo .pfx/.p12 para enviar (o nome acima é só do registro antigo).
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Clique para selecionar o arquivo A1 (.pfx/.p12)
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Será enviado por HTTPS e cifrado no banco permanente após informar a senha.
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

          {tipo === 'A1' && (
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Senha do arquivo A1
              <input type="password" autoComplete="new-password" value={senhaA1} onChange={e => setSenhaA1(e.target.value)} onBlur={e => { if (arquivoA1 && e.target.value) void salvarAutomatico(arquivoA1, e.target.value); }} maxLength={512} placeholder="Necessária para abrir e cifrar o arquivo" className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs normal-case" />
              <span className="mt-1 block text-[11px] font-normal normal-case text-slate-500">Não é salva no navegador nem incluída nos registros do sistema.</span>
            </label>
          )}

          {tipo === 'A1' && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">
              {validade
                ? <>Validade lida do arquivo: <strong>{new Date(validade + 'T00:00:00').toLocaleDateString('pt-BR')}</strong>{emissor ? <> · Emitido por: <strong>{emissor}</strong></> : null}.</>
                : 'A validade e a certificadora são lidas sozinhas do arquivo quando você enviar o certificado com a senha. Não precisa preencher nada.'}
            </p>
          )}

          {/* Validade declarada manualmente (só A3) */}
          {tipo === 'A3' && (<>
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

          {/* Autoridade Certificadora / Emissor (só A3) */}
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
          </>)}

          <div role="note" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>O A1 é cifrado no banco permanente. Isso não testa SEFAZ/RFB/SERPRO nem comprova autenticidade ou autorização.</span>
          </div>
          <div role="status" className={`p-3 rounded-xl border text-xs ${statusServidor.cadastrado ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
            {statusServidor.carregando ? 'Consultando o estado do certificado no servidor…' : statusServidor.mensagem}
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
                  <span>Salvando A1 com proteção...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Salvar certificado A1</span>
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
            <strong>Proteção:</strong> o arquivo e a senha são enviados somente ao servidor por HTTPS; o conteúdo é cifrado no banco. A validade informada e o armazenamento confirmado não equivalem à validação oficial pela SEFAZ.
          </span>
        </div>

      </div>
    </div>
  );
}
