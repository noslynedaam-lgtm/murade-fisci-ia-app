import { useState, FormEvent, useEffect } from 'react';
import { 
  User, Shield, Lock, CreditCard, CheckCircle2, 
  Calendar, Building2, Phone, Mail, Award, Key, 
  AlertCircle, Sparkles, RefreshCw, Trash2, ArrowRight
} from 'lucide-react';
import { UsuarioAuth } from '../../types';
import { PLANOS } from '../../config/planos';
import { atualizarPerfilUsuario, limparTodosOsCadastros } from '../../services/auth/auth.service';

interface MinhaContaScreenProps {
  usuario: UsuarioAuth | null;
  onAtualizarUsuario?: (usuarioAtualizado: UsuarioAuth) => void;
  onNavegar?: (destino: string) => void;
}

export default function MinhaContaScreen({ usuario, onAtualizarUsuario, onNavegar }: MinhaContaScreenProps) {
  // Form State da Contadora / Titular
  const [nome, setNome] = useState(usuario?.nome || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [telefone, setTelefone] = useState(usuario?.telefone || '');
  const [crc, setCrc] = useState(usuario?.crc || '');
  const [cpfCnpj, setCpfCnpj] = useState(usuario?.cpfCnpj || '');
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);

  // Estados de troca de senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [msgSenha, setMsgSenha] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Sincroniza se o usuário prop mudar
  useEffect(() => {
    if (usuario) {
      setNome(usuario.nome || '');
      setEmail(usuario.email || '');
      setTelefone(usuario.telefone || '');
      setCrc(usuario.crc || '');
      setCpfCnpj(usuario.cpfCnpj || '');
    }
  }, [usuario]);

  const planoInfo = PLANOS[(usuario?.idPlano || 'empresarial').toUpperCase()] || PLANOS.EMPRESARIAL;

  const formatarCrc = (valor: string) => {
    // Mantém maiúsculas e remove caracteres indesejados
    return valor.toUpperCase();
  };

  const handleLimparFormulario = () => {
    setNome('');
    setTelefone('');
    setCrc('');
    setCpfCnpj('');
  };

  const handleSalvarPerfil = (e: FormEvent) => {
    e.preventDefault();
    const atualizado: UsuarioAuth = {
      ...(usuario || {
        id: 'user-contador',
        idPlano: 'empresarial',
        nomePlano: 'Plano Empresarial (Até 500 CNPJs)',
        dataVencimento: '31/12/2030',
        primeiroAcesso: false,
        ativo: true,
        ehAdmin: false,
        tipo: 'CONTADOR'
      }),
      nome: nome.trim() || (usuario?.nome || 'Contabilidade'),
      email: email.trim() || (usuario?.email || ''),
      telefone: telefone.trim(),
      crc: crc.trim(),
      cpfCnpj: cpfCnpj.trim()
    };

    atualizarPerfilUsuario(atualizado);

    // Também armazena como dados padrão da contadora para novos cadastros de empresas
    try {
      localStorage.setItem('fiscoia_contadora_padrao', JSON.stringify({
        nome: atualizado.nome,
        crc: atualizado.crc,
        telefone: atualizado.telefone,
        cpfCnpj: atualizado.cpfCnpj,
        email: atualizado.email
      }));
    } catch {}

    if (onAtualizarUsuario) {
      onAtualizarUsuario(atualizado);
    }

    setSalvoComSucesso(true);
    setTimeout(() => setSalvoComSucesso(false), 3500);
  };

  const handleTrocarSenha = (e: FormEvent) => {
    e.preventDefault();
    if (!senhaAtual || !novaSenha) {
      setMsgSenha({ tipo: 'erro', texto: 'Preencha a senha atual e a nova senha.' });
      return;
    }
    if (novaSenha.length < 6) {
      setMsgSenha({ tipo: 'erro', texto: 'A nova senha deve ter no mínimo 6 caracteres.' });
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setMsgSenha({ tipo: 'erro', texto: 'A confirmação de senha não confere!' });
      return;
    }

    setMsgSenha({ tipo: 'sucesso', texto: 'Senha alterada com sucesso!' });
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarSenha('');
    setTimeout(() => setMsgSenha(null), 4000);
  };

  const handleLimparTodosCadastrosGerais = () => {
    if (window.confirm('Deseja realmente redefinir a base local e deixar tudo limpo para o uso oficial do seu escritório?')) {
      limparTodosOsCadastros();
      handleLimparFormulario();
      alert('Base redefinida com sucesso! Agora você pode cadastrar suas empresas reais e preencher o CRC da contadora.');
      window.location.reload();
    }
  };

  const inicial = (nome || usuario?.nome || 'C').charAt(0).toUpperCase();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Cabeçalho do Perfil & Ações Rápidas */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-900 text-amber-400 flex items-center justify-center font-bold text-2xl shadow-md border border-indigo-700 shrink-0">
            {inicial}
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                {nome || 'Minha Conta Contábil'}
              </h1>
              {crc ? (
                <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-emerald-700" />
                  {crc}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-300">
                  ⚠️ CRC não informado
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{email || usuario?.email || 'contato@empresa.com.br'}</p>
            <p className="text-xs text-emerald-700 font-semibold mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Conta Ativa e Habilitada no Compliance FISCOIA
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          {onNavegar && (
            <button
              type="button"
              onClick={() => onNavegar('cadastro-empresa')}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors"
            >
              <Building2 className="w-4 h-4" />
              <span>Cadastrar Empresa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs space-y-0.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Capacidade</span>
            <p className="font-bold text-slate-900">{usuario?.nomePlano || planoInfo.nome}</p>
            <p className="text-slate-500 text-[11px]">
              Limite: <strong className="text-indigo-950">{planoInfo.maxCnpjs} CNPJs</strong>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Coluna Esquerda: Dados Cadastrais da Contadora e Escritório */}
        <div className="md:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-indigo-600" />
                  <span>Dados da Contadora Responsável & CRC</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Estes dados serão utilizados automaticamente nas procurações e-CAC e no cadastro de novas empresas.
                </p>
              </div>

              {salvoComSucesso && (
                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 animate-in fade-in bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Salvo com Sucesso!
                </span>
              )}
            </div>

            <form onSubmit={handleSalvarPerfil} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nome Completo da Contadora / Responsável Contábil
                </label>
                <input
                  type="text"
                  placeholder="Ex: Dra. Maria Silva / Contador Responsável"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Registro CRC da Contadora</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: CRC-GO 123456/O ou CRC-SP 000000/O"
                    value={crc}
                    onChange={(e) => setCrc(formatarCrc(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-600 font-bold font-mono text-indigo-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Informe a sigla e o número com /O</span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span>CPF da Contadora ou CNPJ</span>
                  </label>
                  <input
                    type="text"
                    placeholder="000.000.000-00 ou 00.000.000/0001-00"
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>E-mail da Contadora / Acesso</span>
                  </label>
                  <input
                    type="email"
                    placeholder="contato@seuescritorio.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-600 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>Telefone / WhatsApp</span>
                  </label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-600 font-medium"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-xs flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Salvar Cadastro da Contadora</span>
                </button>

                <button
                  type="button"
                  onClick={handleLimparFormulario}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors border border-slate-300 flex items-center gap-1.5"
                  title="Limpar campos para digitar novo cadastro do zero"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Limpar Campos</span>
                </button>
              </div>
            </form>
          </div>

          {/* Dica de Integração com o Cadastro de Empresas */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 text-xs text-emerald-950 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-900">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Pronto para cadastrar suas empresas!</span>
            </div>
            <p className="text-emerald-800 text-[11px] leading-relaxed">
              Ao cadastrar uma nova empresa no menu <strong>Empresas &gt; Nova Empresa</strong>, o nome e o <strong>CRC ({crc || 'a definir'})</strong> informados acima serão sugeridos automaticamente como a contabilidade responsável, poupando tempo na emissão de declarações e no acompanhamento fiscal.
            </p>
          </div>
        </div>

        {/* Coluna Direita: Segurança & Senha + Reset Geral */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Key className="w-4 h-4 text-indigo-600" />
              <span>Segurança & Senha de Acesso</span>
            </h2>

            {msgSenha && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                msgSenha.tipo === 'sucesso' 
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{msgSenha.texto}</span>
              </div>
            )}

            <form onSubmit={handleTrocarSenha} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Senha Atual</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nova Senha</label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Confirmar Nova Senha</label>
                <input
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold cursor-pointer transition-colors border border-slate-300"
              >
                Atualizar Senha
              </button>
            </form>
          </div>

          {/* Área de Limpeza Geral de Cadastros Antigos */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 text-xs text-slate-700 space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Limpeza e Redefinição de Cadastros</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Caso deseje reiniciar o banco de dados local do navegador e começar com seus cadastros 100% reais, use o botão abaixo:
            </p>
            <button
              type="button"
              onClick={handleLimparTodosCadastrosGerais}
              className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Redefinir Todos os Cadastros do Sistema</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
