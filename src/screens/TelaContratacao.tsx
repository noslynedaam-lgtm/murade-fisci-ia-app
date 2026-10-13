import React, { useState } from 'react';
import BotaoVoltar from '../components/BotaoVoltar';
import { FIDELIDADE, salvarContratacao } from '../config/Fidelidade';
import { ShieldCheck, CheckCircle2, AlertTriangle, FileText, Loader2, Sparkles } from 'lucide-react';

interface NavigationLike {
  navigate?: (screen: string) => void;
  goBack?: () => void;
}

interface TelaContratacaoProps {
  navigation?: NavigationLike;
  onVoltar?: () => void;
  onSucesso?: () => void;
  planoNome?: string;
  planoValor?: string;
}

export default function TelaContratacao({
  navigation,
  onVoltar,
  onSucesso,
  planoNome = 'Empresarial',
  planoValor = 'R$ 599,90/mês'
}: TelaContratacaoProps) {
  const [aceitouFidelidade, setAceitouFidelidade] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [modalSucesso, setModalSucesso] = useState<{
    ativo: boolean;
    dataContratacao: string;
    dataLiberacao: string;
  } | null>(null);

  const executarVoltar = () => {
    if (onVoltar) {
      onVoltar();
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  const finalizarContratacao = () => {
    if (!aceitouTermos || !aceitouFidelidade) {
      alert('⚠️ Atenção: Você precisa aceitar os termos e o compromisso de fidelidade para contratar.');
      return;
    }

    setProcessando(true);

    // Salva a data de contratação — começa a contar os 60 dias!
    const { dataContratacao, dataLiberacao } = salvarContratacao(planoNome.toLowerCase());

    setTimeout(() => {
      setProcessando(false);
      setModalSucesso({
        ativo: true,
        dataContratacao: dataContratacao.toLocaleDateString('pt-BR'),
        dataLiberacao: dataLiberacao.toLocaleDateString('pt-BR')
      });
    }, 1200);
  };

  const concluirSucesso = () => {
    setModalSucesso(null);
    if (onSucesso) {
      onSucesso();
    } else if (navigation?.navigate) {
      navigation.navigate('Dashboard');
    } else {
      executarVoltar();
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-16 px-4 sm:px-6">
      {/* Seta de Voltar */}
      <div className="mb-4">
        <BotaoVoltar onVoltar={executarVoltar} />
      </div>

      {/* Cabeçalho */}
      <div className="text-center mb-8 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[#1a237e] text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-[#1a237e]" />
          <span>Fiscoia by MURADE • Ativação de Acesso</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1a237e] tracking-tight">
          📝 Contratação do Fiscoia
        </h1>
        <p className="text-sm sm:text-base text-slate-600">
          Leia com atenção antes de confirmar a ativação do seu plano ({planoNome} - {planoValor})
        </p>
      </div>

      <div className="space-y-6">
        {/* ============================================== */}
        {/* 🔒 CAIXA DA FIDELIDADE — DESTAQUE PRINCIPAL! */}
        {/* ============================================== */}
        <div 
          id="caixa-fidelidade"
          className="bg-[#fff8e1] rounded-2xl p-6 sm:p-7 border-2 border-[#ff8f00] shadow-sm transition-all"
        >
          <div className="flex items-center justify-center gap-2 text-[#e65100] mb-3">
            <Sparkles className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-bold text-center">
              {FIDELIDADE.TEXTO_CONTRATACAO.titulo}
            </h2>
          </div>

          <div className="h-px bg-[#ffcc80] my-3" />

          <div className="space-y-2.5 text-sm sm:text-base text-[#424242] leading-relaxed">
            <p>{FIDELIDADE.TEXTO_CONTRATACAO.item1}</p>
            <p>{FIDELIDADE.TEXTO_CONTRATACAO.item2}</p>
            <p>{FIDELIDADE.TEXTO_CONTRATACAO.item3}</p>
            <p>{FIDELIDADE.TEXTO_CONTRATACAO.item4}</p>
            <p>{FIDELIDADE.TEXTO_CONTRATACAO.item5}</p>
          </div>

          <div className="h-px bg-[#ffcc80] my-4" />

          {/* ✅ CAIXA DE ACEITE — OBRIGATÓRIO MARCAR! */}
          <label className="flex items-start gap-3 cursor-pointer pt-1 group select-none">
            <input
              type="checkbox"
              id="check-fidelidade"
              checked={aceitouFidelidade}
              onChange={(e) => setAceitouFidelidade(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-2 border-amber-600 text-[#1a237e] focus:ring-[#1a237e] cursor-pointer"
            />
            <span className="text-sm sm:text-base text-slate-800 leading-snug">
              <strong className="text-[#1a237e]">
                Li e concordo com o compromisso de fidelidade de 60 dias.
              </strong>{' '}
              Estou ciente do período mínimo para cancelamento sem carência.
            </span>
          </label>
        </div>

        {/* 📋 TERMOS GERAIS */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-[#1a237e]">
            <FileText className="w-5 h-5" />
            <h3 className="text-base sm:text-lg font-bold">
              📋 Termos e Condições Gerais
            </h3>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl text-xs sm:text-sm text-slate-600 leading-relaxed max-h-36 overflow-y-auto border border-slate-100">
            <p className="mb-2">
              Ao contratar a plataforma Fiscoia, você terá acesso imediato aos módulos tributários, 
              geração de guias (DAS, ICMS, DARF Previdenciário/DCTFWeb, IRPJ), auditoria e-CAC, gestão da DCTFWeb e assistente IA fiscal.
            </p>
            <p className="mb-2">
              A cobrança é realizada de forma recorrente. A MURADE garante sigilo profissional absoluto, 
              conformidade com a LGPD e disponibilidade contínua dos serviços contratados.
            </p>
            <p>
              Em caso de dúvidas operacionais ou regulatórias, nosso time de suporte especializado está à disposição.
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer pt-1 group select-none">
            <input
              type="checkbox"
              id="check-termos"
              checked={aceitouTermos}
              onChange={(e) => setAceitouTermos(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-2 border-slate-300 text-[#1a237e] focus:ring-[#1a237e] cursor-pointer"
            />
            <span className="text-sm text-slate-700 leading-snug">
              Li e concordo com os <strong>Termos de Uso</strong> e a <strong>Política de Privacidade</strong>.
            </span>
          </label>
        </div>

        {/* ✅ BOTÃO FINAL — SÓ LIBERA SE ACEITAR TUDO! */}
        <div className="pt-2">
          <button
            type="button"
            id="btn-finalizar-contratacao"
            onClick={finalizarContratacao}
            disabled={!aceitouFidelidade || !aceitouTermos || processando}
            className={`w-full py-4 px-6 rounded-2xl font-bold text-lg shadow-md transition-all flex items-center justify-center gap-2 ${
              !aceitouFidelidade || !aceitouTermos || processando
                ? 'bg-[#b0b0b0] text-white cursor-not-allowed opacity-80'
                : 'bg-[#1a237e] hover:bg-[#283593] text-white cursor-pointer hover:shadow-lg'
            }`}
          >
            {processando ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Ativando sua assinatura...</span>
              </>
            ) : (
              <span>✅ Finalizar Contratação</span>
            )}
          </button>
          {(!aceitouFidelidade || !aceitouTermos) && (
            <p className="text-xs text-center text-slate-500 mt-2">
              ⚠️ Marque as duas caixas de confirmação acima para habilitar a finalização.
            </p>
          )}
        </div>
      </div>

      {/* Modal de Confirmação e Sucesso */}
      {modalSucesso && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-extrabold text-[#1a237e]">
              ✅ CONTRATAÇÃO REALIZADA COM SUCESSO!
            </h3>

            <div className="bg-slate-50 p-4 rounded-2xl text-left text-sm text-slate-700 space-y-2 border border-slate-200">
              <p>
                <strong>Data de Ativação:</strong> {modalSucesso.dataContratacao}
              </p>
              <p className="text-amber-800 font-semibold flex items-center gap-1.5">
                <span>📜 Compromisso de fidelidade:</span> 60 dias
              </p>
              <p className="text-slate-600 text-xs">
                🔓 Cancelamento liberado a partir de: <strong>{modalSucesso.dataLiberacao}</strong>
              </p>
            </div>

            <p className="text-sm font-semibold text-[#1a237e]">
              Bem-vindo ao Fiscoia! 🎉
            </p>

            <button
              type="button"
              onClick={concluirSucesso}
              className="w-full py-3.5 bg-[#1a237e] hover:bg-[#283593] text-white font-bold rounded-xl transition-all cursor-pointer shadow-md"
            >
              Acessar Painel Principal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
