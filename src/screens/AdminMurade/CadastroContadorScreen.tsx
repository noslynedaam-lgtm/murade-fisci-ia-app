import { useState, FormEvent } from 'react';
import { 
  UserPlus, Mail, Phone, FileText, Award, Calendar, 
  CreditCard, CheckCircle2, AlertCircle, Copy, Check, Send, Shield 
} from 'lucide-react';
import { cadastrarContador } from '../../services/auth/auth.service';
import { PLANOS } from '../../config/planos';
import BotaoVoltar from '../../components/BotaoVoltar';

interface CadastroContadorScreenProps {
  onVoltar?: () => void;
}

export default function CadastroContadorScreen({ onVoltar }: CadastroContadorScreenProps = {}) {
  const [dados, setDados] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpfCnpj: '',
    crc: '',
    idPlano: 'empresarial' as 'basico' | 'profissional' | 'empresarial',
    dataVencimento: '09/10/2026'
  });

  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState<{
    senhaProvisoria: string;
    email: string;
    nome: string;
    nomePlano: string;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const handleSalvar = async (e: FormEvent) => {
    e.preventDefault();
    if (!dados.nome || !dados.email || !dados.idPlano) {
      setErro('Preencha os campos obrigatórios: Nome, E-mail e Plano!');
      return;
    }

    setCarregando(true);
    setErro(null);

    const planoInfo = PLANOS[dados.idPlano.toUpperCase()];

    const resp = await cadastrarContador({
      ...dados,
      nomePlano: planoInfo.nome
    });

    setCarregando(false);

    if (resp.sucesso && resp.senhaProvisoria) {
      setSucesso({
        senhaProvisoria: resp.senhaProvisoria,
        email: dados.email,
        nome: dados.nome,
        nomePlano: planoInfo.nome
      });

      // Limpa dados
      setDados({
        nome: '',
        email: '',
        telefone: '',
        cpfCnpj: '',
        crc: '',
        idPlano: 'empresarial',
        dataVencimento: '09/10/2026'
      });
    } else {
      setErro(resp.mensagem || 'Erro ao cadastrar contador.');
    }
  };

  const copiarAcesso = () => {
    if (!sucesso) return;
    const texto = `🎉 SEU ACESSO AO FISCOIA — MURADE!\n\nOlá ${sucesso.nome}!\n\nSeu acesso foi criado com sucesso.\n\n🔐 Login: ${sucesso.email}\n🔑 Senha temporária: ${sucesso.senhaProvisoria}\n📋 Plano: ${sucesso.nomePlano}\n\n⚠️ Ao entrar pela primeira vez, você DEVERÁ trocar sua senha por uma sua exclusiva.\n\nAcesse: https://app.fiscoia.com.br/login`;
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div id="cadastro-contador-screen" className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <BotaoVoltar onVoltar={onVoltar} />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
              <UserPlus className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Cadastrar Novo Contador / Escritório
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão Master MURADE: cadastre o cliente, gere a senha temporária automática e envie os dados de acesso por e-mail.
          </p>
        </div>
      </div>

      {erro && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Caixa de Sucesso com Dados Gerados */}
      {sucesso && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200 pb-3">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Contador Cadastrado e E-mail de Boas-Vindas Disparado!</span>
            </div>
            <button
              type="button"
              onClick={copiarAcesso}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiado ? 'Acesso Copiado!' : 'Copiar Acesso para WhatsApp'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-white rounded-xl border border-emerald-200">
              <span className="text-slate-500 block text-[11px]">Login (E-mail):</span>
              <strong className="text-slate-900 font-mono text-sm block truncate">{sucesso.email}</strong>
            </div>

            <div className="p-3 bg-white rounded-xl border border-emerald-200">
              <span className="text-slate-500 block text-[11px]">Senha Temporária Gerada:</span>
              <strong className="text-indigo-700 font-mono text-base block font-bold">{sucesso.senhaProvisoria}</strong>
            </div>

            <div className="p-3 bg-white rounded-xl border border-emerald-200">
              <span className="text-slate-500 block text-[11px]">Plano Habilitado:</span>
              <strong className="text-emerald-800 text-xs block">{sucesso.nomePlano}</strong>
            </div>
          </div>

          <div className="p-3 bg-white/80 rounded-xl border border-emerald-200/80 text-[11px] text-emerald-950 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Ao entrar pela primeira vez com essa senha temporária, o sistema exigirá que o contador defina sua senha exclusiva e definitiva.
            </span>
          </div>
        </div>
      )}

      {/* Formulário de Cadastro */}
      <form onSubmit={handleSalvar} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5 text-xs">
        <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <span>📋 Dados do Titular / Escritório Contábil</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Nome Completo / Razão do Escritório *
            </label>
            <input
              type="text"
              required
              value={dados.nome}
              onChange={(e) => setDados({ ...dados, nome: e.target.value })}
              placeholder="Ex: SILVA ASSESSORIA CONTÁBIL LTDA"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 uppercase"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              E-mail Principal * (Será o Login de Acesso)
            </label>
            <input
              type="email"
              required
              value={dados.email}
              onChange={(e) => setDados({ ...dados, email: e.target.value })}
              placeholder="contador@escritorio.com.br"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Telefone / WhatsApp
            </label>
            <input
              type="text"
              value={dados.telefone}
              onChange={(e) => setDados({ ...dados, telefone: e.target.value })}
              placeholder="(11) 99999-8888"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              CPF ou CNPJ
            </label>
            <input
              type="text"
              value={dados.cpfCnpj}
              onChange={(e) => setDados({ ...dados, cpfCnpj: e.target.value })}
              placeholder="00.000.000/0001-00"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 font-mono"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Registro CRC (Conselho Regional)
            </label>
            <input
              type="text"
              value={dados.crc}
              onChange={(e) => setDados({ ...dados, crc: e.target.value })}
              placeholder="Ex: SP-123456/O"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 font-mono"
            />
          </div>
        </div>

        {/* Seleção do Plano Contratado */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          <label className="font-bold text-slate-800 block text-xs">
            Plano Contratado * (Define o Limite de CNPJs e Recursos)
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.values(PLANOS).map((plano) => {
              const ativo = dados.idPlano === plano.id;
              return (
                <div
                  key={plano.id}
                  onClick={() => setDados({ ...dados, idPlano: plano.id as any })}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    ativo
                      ? 'border-indigo-600 bg-indigo-50/60 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{plano.nome}</span>
                    {ativo && <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>}
                  </div>
                  <div className="text-xs text-indigo-700 font-bold mt-1">
                    R$ {plano.valorMensal.toFixed(2).replace('.', ',')}/mês
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Capacidade: até <strong>{plano.maxCnpjs} CNPJs</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Data de Vencimento da Mensalidade
            </label>
            <input
              type="text"
              value={dados.dataVencimento}
              onChange={(e) => setDados({ ...dados, dataVencimento: e.target.value })}
              placeholder="09/10/2026"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 font-mono"
            />
          </div>
        </div>

        {/* Botão de Envio */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={carregando}
            className="px-6 py-3 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 transition-all"
          >
            <Send className="w-4 h-4 text-amber-400" />
            <span>{carregando ? 'Cadastrando e Enviando E-mail...' : 'Cadastrar Contador e Disparar Acesso'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
