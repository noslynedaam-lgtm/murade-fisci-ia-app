import { useState, useEffect, FormEvent } from 'react';
import { Lock, Unlock, ShieldAlert, KeyRound, CheckCircle2, Eye, EyeOff, X, ArrowRight, ShieldCheck } from 'lucide-react';

interface ModalAcessoAdminProps {
  aberto: boolean;
  onFechar: () => void;
  adminDesbloqueado: boolean;
  onDesbloquear: () => void;
  onBloquear: () => void;
  onNavegarAdmin?: (aba: string) => void;
}

const STORAGE_SENHA_ADMIN_KEY = 'murade_admin_master_pwd';
const SENHA_PADRAO = 'murade2026';

export function obterSenhaAdmin(): string {
  try {
    return localStorage.getItem(STORAGE_SENHA_ADMIN_KEY) || SENHA_PADRAO;
  } catch {
    return SENHA_PADRAO;
  }
}

export function salvarNovaSenhaAdmin(novaSenha: string): void {
  try {
    localStorage.setItem(STORAGE_SENHA_ADMIN_KEY, novaSenha);
  } catch (e) {
    console.error('Erro ao salvar nova senha admin:', e);
  }
}

export default function ModalAcessoAdmin({
  aberto,
  onFechar,
  adminDesbloqueado,
  onDesbloquear,
  onBloquear,
  onNavegarAdmin
}: ModalAcessoAdminProps) {
  const [senhaDigitada, setSenhaDigitada] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Modo de troca de senha
  const [modoAlterarSenha, setModoAlterarSenha] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaNovaSenha, setConfirmaNovaSenha] = useState('');

  useEffect(() => {
    if (aberto) {
      setSenhaDigitada('');
      setErro(null);
      setSucesso(null);
      setModoAlterarSenha(false);
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmaNovaSenha('');
    }
  }, [aberto]);

  if (!aberto) return null;

  const handleVerificarSenha = (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    const senhaCorreta = obterSenhaAdmin();
    if (senhaDigitada.trim() === senhaCorreta) {
      setSucesso('Acesso Master concedido com sucesso!');
      setTimeout(() => {
        onDesbloquear();
        onFechar();
      }, 500);
    } else {
      setErro('Senha incorreta! Este painel é restrito exclusivamente ao Administrador Murade.');
    }
  };

  const handleTrocarSenha = (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    const senhaCorreta = obterSenhaAdmin();
    if (senhaAtual.trim() !== senhaCorreta) {
      setErro('Senha atual incorreta.');
      return;
    }

    if (novaSenha.length < 4) {
      setErro('A nova senha deve ter no mínimo 4 caracteres.');
      return;
    }

    if (novaSenha !== confirmaNovaSenha) {
      setErro('A confirmação da nova senha não confere.');
      return;
    }

    salvarNovaSenhaAdmin(novaSenha.trim());
    setSucesso('Senha do Administrador atualizada com sucesso!');
    setModoAlterarSenha(false);
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmaNovaSenha('');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        id="modal-janelinha-admin"
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              {adminDesbloqueado ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Acesso Restrito do Administrador
                </h3>
                <span className="text-[9px] font-black bg-amber-400 text-slate-950 px-2 py-0.5 rounded uppercase">
                  MURADE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {adminDesbloqueado ? 'Sessão Master ativa' : 'Painel confidencial da Diretoria Murade'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer text-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-5">
          {erro && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 animate-in fade-in duration-150">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {sucesso && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{sucesso}</span>
            </div>
          )}

          {/* Estado 1: Administrador JÁ ESTÁ DESBLOQUEADO */}
          {adminDesbloqueado && !modoAlterarSenha ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 space-y-1">
                  <p className="font-bold text-[13px]">O Modo Administrador está Ativo</p>
                  <p className="text-slate-600 leading-relaxed">
                    Você tem acesso total aos módulos confidenciais (Painel Murade, Faturamento, Bloqueio de Inadimplentes e Preços). O cliente não vê esta área quando ela está bloqueada.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onFechar();
                    if (onNavegarAdmin) onNavegarAdmin('admin');
                  }}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Abrir Painel MURADE Completo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onBloquear();
                    onFechar();
                  }}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-rose-600" />
                  <span>Bloquear Acesso (Voltar 100% à Visão do Cliente)</span>
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
                <span>Deseja trocar sua senha?</span>
                <button
                  type="button"
                  onClick={() => setModoAlterarSenha(true)}
                  className="text-indigo-600 font-bold hover:underline cursor-pointer"
                >
                  Alterar Senha Master
                </button>
              </div>
            </div>
          ) : modoAlterarSenha ? (
            /* Formulário de Alteração de Senha */
            <form onSubmit={handleTrocarSenha} className="space-y-4">
              <div className="text-xs text-slate-600 leading-snug">
                Defina uma nova senha exclusiva para o seu acesso de Administrador Master:
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Senha Atual:
                </label>
                <input
                  type="password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  placeholder="Digite sua senha atual"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nova Senha:
                </label>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirmar Nova Senha:
                </label>
                <input
                  type="password"
                  value={confirmaNovaSenha}
                  onChange={(e) => setConfirmaNovaSenha(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Salvar Nova Senha
                </button>
                <button
                  type="button"
                  onClick={() => setModoAlterarSenha(false)}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            /* Estado 2: Administrador BLOQUEADO -> Pede a Senha */
            <form onSubmit={handleVerificarSenha} className="space-y-4">
              <div className="text-xs text-slate-600 leading-relaxed">
                Para visualizar as opções de <strong>Administrador (Painel Murade, Faturamento, Bloqueio e Planos)</strong>, digite a sua senha de segurança.
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Senha de Administrador Master:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Exclusivo Diretoria</span>
                </label>
                <div className="relative">
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    id="input-senha-admin"
                    autoFocus
                    value={senhaDigitada}
                    onChange={(e) => setSenhaDigitada(e.target.value)}
                    placeholder="Digite sua senha de administrador..."
                    className="w-full pl-3 pr-10 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-slate-50 focus:bg-white transition-all font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  id="btn-confirmar-senha-admin"
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-slate-900 to-indigo-900 hover:from-slate-800 hover:to-indigo-800 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Desbloquear Modo Administrador</span>
                </button>
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-snug">
                🔒 <strong>Privacidade Total do Cliente:</strong> Quando não desbloqueado, seus clientes verão apenas a área contábil normal e nenhuma tela ou menu de administração estará visível.
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
