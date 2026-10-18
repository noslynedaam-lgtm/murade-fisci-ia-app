import React, { useState, useEffect } from 'react';
import { 
  Key, ShieldCheck, CheckCircle2, AlertTriangle, 
  Building2, UploadCloud,
  RefreshCw, Check, Sparkles, HardDrive, ExternalLink
} from 'lucide-react';
import { CertificadoDigitalDados } from './typesCertificado';
import { normalizarCnpj, validarCnpj, validarCpf } from '../../services/cnpj/cnpjValidation';
import { lerReferenciaCertificadoEmpresa } from '../../services/serpro/certificadoReferencia.service';

interface CertificadoDigitalModuloProps {
  empresaAtiva?: {
    razaoSocial: string;
    cnpj: string;
  } | null;
  onCertificadoAtualizado: (cert: CertificadoDigitalDados | null) => void;
  onFalar?: (texto: string) => void;
}

export default function CertificadoDigitalModulo({
  empresaAtiva,
  onCertificadoAtualizado,
  onFalar
}: CertificadoDigitalModuloProps) {
  const [tipo, setTipo] = useState<'A1' | 'A3'>('A1');
  const [nomeArquivo, setNomeArquivo] = useState<string>('');
  const [cnpj, setCnpj] = useState<string>('');
  const [razao, setRazao] = useState<string>('');
  const [carregando, setCarregando] = useState<boolean>(false);

  // Sem integração de validação, o estado máximo disponível é referência pendente.
  const [status, setStatus] = useState<'nenhum' | 'pendente' | 'erro'>('nenhum');
  const [mensagemStatus, setMensagemStatus] = useState<string>('Nenhum certificado cadastrado');
  const [certificadoSalvo, setCertificadoSalvo] = useState<CertificadoDigitalDados | null>(null);

  // Cada referência de certificado fica isolada pelo CNPJ da empresa ativa.
  useEffect(() => {
    setCertificadoSalvo(null);
    setNomeArquivo('');
    setStatus('nenhum');
    setMensagemStatus('Nenhum certificado cadastrado para esta empresa neste navegador.');
    if (!empresaAtiva?.cnpj) {
      setCnpj('');
      setRazao('');
      onCertificadoAtualizado(null);
      return;
    }
    setCnpj(empresaAtiva.cnpj);
    setRazao(empresaAtiva.razaoSocial);
    try {
      const referenciaSalva = lerReferenciaCertificadoEmpresa(empresaAtiva.cnpj);
      if (referenciaSalva) {
        const parsed = referenciaSalva as unknown as CertificadoDigitalDados;
        parsed.valido = false;
        setCertificadoSalvo(parsed);
        setTipo(parsed.tipo || 'A1');
        setNomeArquivo(parsed.nomeArquivo || '');
        setCnpj(empresaAtiva.cnpj);
        setRazao(empresaAtiva.razaoSocial);
        setStatus('pendente');
        setMensagemStatus('Referência desta empresa salva neste navegador. Não foi enviada, validada ou conectada ao SERPRO/e-CAC.');
        onCertificadoAtualizado(parsed);
      } else {
        setTipo('A1');
        onCertificadoAtualizado(null);
      }
    } catch (e) {
      console.error('Erro ao ler certificado:', e);
      setStatus('erro');
      setMensagemStatus('Não foi possível ler a referência local deste certificado. Nenhuma empresa foi substituída.');
    }
  }, [empresaAtiva?.cnpj]);

  const preencherEmpresaAtiva = () => {
    if (empresaAtiva) {
      setCnpj(empresaAtiva.cnpj);
      setRazao(empresaAtiva.razaoSocial);
      if (onFalar) {
        onFalar(`Dados preenchidos com ${empresaAtiva.razaoSocial}!`);
      }
    }
  };

  const handleArquivoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!/\.p(?:fx|12)$/i.test(file.name)) {
        setNomeArquivo('');
        setStatus('erro');
        setMensagemStatus('Arquivo inválido. Selecione um arquivo .pfx ou .p12. O conteúdo não será enviado nem validado.');
        e.target.value = '';
        return;
      }
      setNomeArquivo(file.name);
      setStatus('pendente');
      setMensagemStatus('Arquivo selecionado apenas como referência local. O conteúdo não foi enviado nem validado.');
      if (onFalar) {
        onFalar(`Arquivo do certificado selecionado: ${file.name}`);
      }
    }
  };

  const handleSalvarCertificado = (e: React.FormEvent) => {
    e.preventDefault();

    if (!cnpj || (!validarCnpj(cnpj) && !validarCpf(cnpj))) {
      setStatus('erro');
      setMensagemStatus('⚠️ Preencha um CPF ou CNPJ válido!');
      if (onFalar) onFalar('Por favor, informe o documento do escritório ou empresa!');
      return;
    }

    if (tipo === 'A1' && !nomeArquivo) {
      setStatus('erro');
      setMensagemStatus('⚠️ Selecione o arquivo .pfx ou .p12 do Certificado A1!');
      if (onFalar) onFalar('Por favor, anexe o arquivo PFX do certificado A1!');
      return;
    }

    setCarregando(true);
    setStatus('pendente');
    const novoCert: CertificadoDigitalDados = {
        tipo,
        nomeArquivo,
        cnpj,
        razao,
        dataCadastro: new Date().toLocaleDateString('pt-BR'),
        validade: '',
        emissor: '',
        uf: '',
        valido: false
      };

      const chaveEmpresa = `fiscoia_certificado_cliente_${normalizarCnpj(cnpj)}`;
      let anterior: string | null = null;
      try {
        anterior = localStorage.getItem(chaveEmpresa);
        localStorage.setItem(chaveEmpresa, JSON.stringify(novoCert));
        onCertificadoAtualizado(novoCert);
        setCertificadoSalvo(novoCert);
        setStatus('pendente');
        setMensagemStatus('Referência salva para esta empresa neste navegador. O arquivo não foi enviado; a conexão oficial não está configurada.');
        if (onFalar) onFalar('Referência do certificado salva localmente para a empresa selecionada. Nenhuma conexão oficial foi realizada.');
      } catch (e) {
        try {
          if (anterior === null) localStorage.removeItem(chaveEmpresa);
          else localStorage.setItem(chaveEmpresa, anterior);
        } catch {
          setMensagemStatus('Falha ao salvar e restaurar a referência local. Confira os dados desta empresa antes de tentar novamente.');
        }
        setStatus('erro');
        setMensagemStatus(e instanceof Error ? `Não foi possível salvar a referência deste certificado: ${e.message}` : 'Não foi possível salvar a referência deste certificado neste navegador.');
      } finally {
        setCarregando(false);
      }
  };

  return (
    <div id="modulo-certificado-digital" className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm space-y-6">
      {/* Cabeçalho do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 shadow-xs">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 flex-wrap">
              <span>🔐 CERTIFICADO DIGITAL — REFERÊNCIA LOCAL</span>
            </h2>
            <p className="text-xs text-slate-500">
              O cadastro local não envia nem valida o certificado. A integração oficial ainda não está conectada.
            </p>
          </div>
        </div>

        {empresaAtiva && (
          <button
            type="button"
            onClick={preencherEmpresaAtiva}
            className="text-xs px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Preencher com os dados da empresa ativa no topo"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Puxar {empresaAtiva.razaoSocial.slice(0, 20)}...</span>
          </button>
        )}
      </div>

      {/* ✅ AVISO CLARO: APENAS PARA CONEXÃO, NÃO EMITE NOTA */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-2xl text-xs text-amber-900 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="block text-amber-950 font-bold text-[13px] mb-0.5">
            Aviso de Finalidade do Certificado Digital
          </strong>
          <p className="leading-relaxed">
            Esta tela não transmite o arquivo nem testa o certificado. <strong>Não informe a senha aqui.</strong> A conexão oficial exige integração segura no servidor. O cadastro local não emite notas ou consulta pendências.
          </p>
        </div>
      </div>

      {/* Formulário do Certificado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        {/* Tipo de Certificado */}
        <div className="space-y-1.5">
          <label className="font-bold text-slate-700 block">Tipo de Certificado:</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as 'A1' | 'A3')}
            className="w-full p-2.5 rounded-xl border border-slate-300 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:border-indigo-600 outline-hidden"
          >
            <option value="A1">A1 — Arquivo (.pfx / .p12) [Recomendado em Nuvem]</option>
            <option value="A3">A3 — Cartão / Token Físico USB</option>
          </select>
        </div>

        {/* CNPJ / CPF */}
        <div className="space-y-1.5">
          <label className="font-bold text-slate-700 block">CNPJ / CPF do Titular:</label>
          <input
            type="text"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
            className="w-full p-2.5 rounded-xl border border-slate-300 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:border-indigo-600 outline-hidden"
          />
        </div>

        {/* Razão Social / Nome */}
        <div className="space-y-1.5 sm:col-span-2">
          <label className="font-bold text-slate-700 block">Razão Social / Nome do Titular:</label>
          <input
            type="text"
            value={razao}
            onChange={(e) => setRazao(e.target.value)}
            placeholder="Razão Social completa do escritório ou empresa"
            className="w-full p-2.5 rounded-xl border border-slate-300 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:border-indigo-600 outline-hidden"
          />
        </div>

        {/* Arquivo A1 ou Instrução A3 */}
        {tipo === 'A1' ? (
          <div className="space-y-1.5 sm:col-span-2">
            <label className="font-bold text-slate-700 block">Arquivo do Certificado (.pfx / .p12):</label>
            <div className="flex items-center gap-3">
              <label className="flex-1 border-2 border-dashed border-slate-300 hover:border-purple-500 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-purple-50/40">
                <UploadCloud className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                <span className="text-xs font-bold text-purple-900 block">
                  {nomeArquivo ? nomeArquivo : 'Clique para selecionar o arquivo .pfx ou .p12'}
                </span>
                <span className="text-[10px] text-slate-500">Somente o nome do arquivo será salvo; o conteúdo não será enviado.</span>
                <input
                  type="file"
                  accept=".pfx,.p12"
                  onChange={handleArquivoUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center gap-3">
            <HardDrive className="w-5 h-5 text-indigo-600 shrink-0" />
            <div>
              <strong className="block text-slate-900">Modo A3 (Token ou Cartão Físico):</strong>
              <span>A conexão com token/cartão A3 e a leitura da cadeia do certificado ainda não estão implementadas nesta aplicação. O cadastro abaixo guarda só uma referência local.</span>
            </div>
          </div>
        )}

      </div>

      {/* Botões de Ação */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSalvarCertificado}
          disabled={carregando}
          className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-all disabled:opacity-50"
        >
          {carregando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          <span>{carregando ? 'Salvando...' : 'Salvar referência local'}</span>
        </button>

        <div role="note" className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs">
          SERPRO/e-CAC não estão conectados. Este cadastro não envia nem valida o certificado.
        </div>
      </div>

      {/* Caixa de Status Dinâmico */}
      <div
        className={`p-3.5 rounded-2xl border text-xs flex items-center gap-3 transition-colors ${
          status === 'erro'
            ? 'bg-rose-50 border-rose-300 text-rose-900'
            : status === 'pendente'
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}
      >
        <span className="text-xl">
          {status === 'erro' ? '❌' : status === 'pendente' ? '⏳' : '⚪'}
        </span>
        <div className="flex-1 font-medium">{mensagemStatus}</div>
      </div>

      {/* Cartão de informações da referência local do certificado */}
      {certificadoSalvo && (
        <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 text-xs space-y-2 text-purple-950">
          <div className="flex items-center justify-between pb-2 border-b border-purple-200/60 font-bold">
            <span className="flex items-center gap-1.5 text-purple-900">
              <ShieldCheck className="w-4 h-4 text-purple-700" />
              Referência local do certificado
            </span>
            <span className="text-amber-800 font-mono text-[11px]">Status: Não validado</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
            <div>
              <span className="text-purple-800 font-bold block">Validade informada:</span>
              <span className="font-mono text-slate-800">{certificadoSalvo.validade || 'Não informada'}</span>
            </div>
            <div>
              <span className="text-purple-800 font-bold block">Emissor informado:</span>
              <span className="text-slate-800 truncate block" title={certificadoSalvo.emissor}>
                {certificadoSalvo.emissor}
              </span>
            </div>
            <div>
              <span className="text-purple-800 font-bold block">Finalidade Autorizada:</span>
              <span className="font-bold text-slate-800">Nenhuma conexão validada</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
