import { ShieldAlert } from 'lucide-react';
import BotaoVoltar from '../../components/BotaoVoltar';

interface RedefinirSenhaProps {
  token: string;
  onVoltarLogin: () => void;
}

export default function RedefinirSenhaScreen({ onVoltarLogin }: RedefinirSenhaProps) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 sm:p-8 space-y-6">
        <BotaoVoltar onVoltar={onVoltarLogin} />
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-100">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Link de redefinição não reconhecido</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            A redefinição local foi desativada porque não altera a senha da conta no servidor. Solicite ao administrador um reset pelo painel seguro.
          </p>
        </div>
        <button
          type="button"
          onClick={onVoltarLogin}
          className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-bold transition-colors"
        >
          Voltar para o login
        </button>
      </div>
    </div>
  );
}
