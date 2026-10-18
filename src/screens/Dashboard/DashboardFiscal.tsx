import React from 'react';
import { 
  Building2, FileText, FileCheck, Bot, AlertTriangle, 
  CheckCircle2, Clock, Calendar, ArrowRight, ShieldCheck, 
  Download, Plus, Receipt, Server, ClipboardCheck 
} from 'lucide-react';
import SimboloContabil from '../../components/SimboloContabil';
import { useEmpresa } from '../../context/EmpresaContext';

interface DashboardFiscalProps {
  planoAtivoId: string;
  onNavegar: (aba: string) => void;
}

export default function DashboardFiscal({ planoAtivoId, onNavegar }: DashboardFiscalProps) {
  const { empresas } = useEmpresa();
  const maxCnpjs = planoAtivoId === 'empresarial' ? 500 : planoAtivoId === 'profissional' ? 100 : 50;

  return (
    <div id="dashboard-fiscal-screen" className="space-y-3.5 max-w-6xl mx-auto pb-8">
      {/* Banner de boas-vindas com marca Murade */}
      <div 
        className="text-white rounded-2xl p-4 sm:p-5 shadow-lg border relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{
          background: 'linear-gradient(135deg, #0A1628 0%, #0F2B5B 50%, #0A1628 100%)',
          borderColor: 'rgba(212, 175, 55, 0.25)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.35), 0 4px 12px rgba(22,93,255,0.12)'
        }}
      >
        <div className="flex items-center gap-3.5 z-10">
          {/* Símbolo Contábil (Colunas + Cobra + Cifrão) com brilho animado */}
          <SimboloContabil tamanho="lg" comBrilho={true} />

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 text-[11px] font-bold border border-emerald-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              <span>Painel fiscal local • integrações externas não conectadas</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight flex items-center gap-2 flex-wrap">
              <span className="text-white tracking-tight">Murade Fisco IA</span>
              <span className="text-xs text-indigo-300 font-semibold hidden sm:inline">
                • Ferramentas de apoio fiscal com IA
              </span>
            </h1>
            <p className="text-slate-300 text-xs max-w-xl">
              Painel de acompanhamento local. DCTFWeb, DARF, FGTS Digital, certidões e situação fiscal oficial não são consultados automaticamente neste ambiente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 z-10">
          <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/15 text-left shadow-sm">
            <span className="text-[9px] text-amber-300 uppercase tracking-wider block font-bold">
              Integração oficial
            </span>
            <span className="text-xs font-bold text-white flex items-center gap-1 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" /> Não conectada
            </span>
          </div>
        </div>
      </div>

      {/* 🏛️ BARRA DE SINCRONIZAÇÃO COM ÓRGÃOS PÚBLICOS FEDERAIS & ESTADUAIS (2026) */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
              Conexão com Órgãos Públicos Federais e Estaduais (Exercício 2026)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavegar('serpro')}
              className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-md border border-indigo-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Server className="w-3 h-3 text-indigo-600" />
              Homologação SERPRO (Roteiro)
            </button>
            <span className="text-[10px] text-amber-800 bg-amber-50 font-bold px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1 w-fit">
              <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
              Integrações externas não validadas
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 text-xs">
          {/* 1. SERPRO */}
          <div 
            onClick={() => onNavegar('serpro')}
            className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80 hover:border-indigo-400 hover:bg-indigo-100/80 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col gap-0.5 group"
            title="Clique para abrir Homologação SERPRO e gateway oficial"
          >
            <span className="text-[9px] text-indigo-700 font-bold uppercase flex items-center justify-between">
              SERPRO Integra
              <ArrowRight className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-indigo-700" />
            </span>
            <strong className="text-slate-900 text-[10px]">Gateway Oficial</strong>
            <span className="text-[9px] text-amber-700 font-bold flex items-center gap-0.5 mt-0.5">
              <AlertTriangle className="w-2 h-2" /> Não validado
            </span>
          </div>

          {/* 2. RFB • Receita */}
          <div 
            onClick={() => onNavegar('dctfweb')}
            className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 hover:border-emerald-400 hover:bg-emerald-100/80 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col gap-0.5 group"
            title="Clique para abrir e-CAC, DCTFWeb e Guias da Receita Federal"
          >
            <span className="text-[9px] text-emerald-700 font-bold uppercase flex items-center justify-between">
              RFB • Receita
              <ArrowRight className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-emerald-700" />
            </span>
            <strong className="text-slate-900 text-[10px]">e-CAC & DCTFWeb</strong>
            <span className="text-[9px] text-amber-700 font-bold flex items-center gap-0.5 mt-0.5">
              <AlertTriangle className="w-2 h-2" /> Não consultado
            </span>
          </div>

          {/* 3. PGFN • CND */}
          <div 
            onClick={() => onNavegar('cnd')}
            className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/80 hover:border-blue-400 hover:bg-blue-100/80 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col gap-0.5 group"
            title="Clique para abrir CND / Certidões Negativas Federais, Estaduais e FGTS"
          >
            <span className="text-[9px] text-blue-700 font-bold uppercase flex items-center justify-between">
              PGFN • CND
              <ArrowRight className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-blue-700" />
            </span>
            <strong className="text-slate-900 text-[10px]">CNDs & Certidões</strong>
            <span className="text-[9px] text-amber-700 font-bold flex items-center gap-0.5 mt-0.5">
              <AlertTriangle className="w-2 h-2" /> Emissão externa não conectada
            </span>
          </div>

          {/* 4. MTE / CAIXA */}
          <div 
            onClick={() => onNavegar('guias')}
            className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 hover:border-amber-400 hover:bg-amber-100/80 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col gap-0.5 group"
            title="Abrir o painel local de guias; emissão do FGTS Digital não está conectada"
          >
            <span className="text-[9px] text-amber-800 font-bold uppercase flex items-center justify-between">
              MTE / CAIXA
              <ArrowRight className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-amber-800" />
            </span>
            <strong className="text-slate-900 text-[10px]">FGTS Digital (Pix)</strong>
            <span className="text-[9px] text-amber-700 font-bold flex items-center gap-0.5 mt-0.5">
              <AlertTriangle className="w-2 h-2" /> Não conectado
            </span>
          </div>

          {/* 5. Previdência */}
          <div 
            onClick={() => onNavegar('guiasINSS')}
            className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-200/80 hover:border-purple-400 hover:bg-purple-100/80 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col gap-0.5 group"
            title="Clique para abrir eSocial e guias INSS"
          >
            <span className="text-[9px] text-purple-700 font-bold uppercase flex items-center justify-between">
              Previdência
              <ArrowRight className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-purple-700" />
            </span>
            <strong className="text-slate-900 text-[10px]">eSocial & INSS</strong>
            <span className="text-[9px] text-amber-700 font-bold flex items-center gap-0.5 mt-0.5">
              <AlertTriangle className="w-2 h-2" /> Não consultado
            </span>
          </div>

          {/* 6. SEFAZ / Pref. */}
          <div 
            onClick={() => onNavegar('fiscal')}
            className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-200/80 hover:border-teal-400 hover:bg-teal-100/80 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col gap-0.5 group"
            title="Clique para abrir apuração de ICMS, ISS e notas fiscais SEFAZ"
          >
            <span className="text-[9px] text-teal-700 font-bold uppercase flex items-center justify-between">
              SEFAZ / Pref.
              <ArrowRight className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-teal-700" />
            </span>
            <strong className="text-slate-900 text-[10px]">ICMS / ISS / CNDs</strong>
            <span className="text-[9px] text-amber-700 font-bold flex items-center gap-0.5 mt-0.5">
              <AlertTriangle className="w-2 h-2" /> Não consultado
            </span>
          </div>
        </div>
      </div>

      {/* === CARDS SUPERIORES 3D (DESIGN FINAL DO USUÁRIO COM PROFUNDIDADE) === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: SERPRO Gateway */}
        <div 
          onClick={() => onNavegar('serpro')}
          className="card-3d-fiscal bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm hover:border-indigo-400 cursor-pointer relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-400" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500">SERPRO • Gateway Oficial</span>
            <span className="text-xl group-hover:scale-110 transition-transform">🏛️</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Não conectado
          </div>
          <div className="text-[11px] text-indigo-600 font-semibold mt-1 flex items-center gap-1">
            <span>API oficial não configurada</span>
          </div>
        </div>

        {/* Card 2: CND Certidões */}
        <div 
          onClick={() => onNavegar('cnd')}
          className="card-3d-fiscal bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm hover:border-blue-400 cursor-pointer relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500">CND • Certidões</span>
            <span className="text-xl group-hover:scale-110 transition-transform">📄</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Painel local disponível
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
            <span>Portais externos não integrados</span>
          </div>
        </div>

        {/* Card 3: Caixa FGTS Digital */}
        <div 
          onClick={() => onNavegar('guias')}
          className="card-3d-fiscal bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm hover:border-amber-400 cursor-pointer relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-emerald-500" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500">Caixa • FGTS Digital</span>
            <span className="text-xl group-hover:scale-110 transition-transform">🏦</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Não conectado
          </div>
          <div className="text-[11px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
            <span>eSocial/FGTS não consultados</span>
          </div>
        </div>

        {/* Card 4: Assistente IA Murade (Voz Natural & Consultoria Fiscal) */}
        <div 
          onClick={() => onNavegar('iaVoz')}
          className="card-3d-fiscal bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm hover:border-purple-400 cursor-pointer relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500">IA Murade (Voz & Fiscal)</span>
            <span className="text-xl group-hover:scale-110 transition-transform">🎤</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-900 mt-1">
            Por demanda
          </div>
          <div className="text-[11px] text-purple-700 font-semibold mt-1 flex items-center gap-1">
            <span>Disponível conforme conexão do serviço</span>
          </div>
        </div>
      </div>

      {/* Resumo Compacto da Carteira de Clientes (Economia de Espaço / Sem Rolar a Página) */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-800">
            <Building2 className="w-4 h-4" />
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-600">Carteira de Clientes:</span>
            <strong className="text-slate-900 font-black">{empresas.length} cadastrada(s) · referência: {maxCnpjs} CNPJs</strong>
            <span className="text-slate-400">•</span>
            <strong className="text-slate-600 font-bold">Guias e procurações não consultadas</strong>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavegar('empresas')}
          className="text-xs font-bold text-indigo-700 hover:text-indigo-950 flex items-center gap-1 cursor-pointer ml-auto"
        >
          <span>Gerenciar Carteira</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* === GRADE INFERIOR: ESTADO DAS INTEGRAÇÕES === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <div className="lg:col-span-2 bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-amber-950 flex items-center gap-1.5">
                <span>⚠️</span> Obrigações e prazos oficiais
              </h2>
              <p className="text-[11px] text-amber-900">
                Não há consulta oficial ou calendário personalizado conectado para as empresas cadastradas.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
            <span>Os registros exibidos em outros módulos são locais e não comprovam entrega, débito, pagamento ou regularidade oficial.</span>
            <button type="button" onClick={() => onNavegar('agenda')} className="text-[11px] text-indigo-700 font-bold hover:text-indigo-900 flex items-center gap-1 cursor-pointer">
              Abrir agenda local <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 🚀 Propagandazinha Discreta: Sistema Murade Fisco IA & Planos para Upgrade */}
        <div 
          id="card-propaganda-planos-murade"
          className="rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/70 p-4 shadow-2xs flex flex-col justify-between space-y-2.5 text-slate-800 transition-all hover:shadow-xs hover:border-indigo-300"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="p-1 rounded-md bg-indigo-600 text-white shadow-2xs">
                  <SimboloContabil tamanho="sm" comBrilho={false} />
                </span>
                <span className="text-xs font-black text-slate-900 tracking-tight">
                  Murade Fisco IA
                </span>
              </div>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full border border-indigo-200">
                Planos e preços de referência
              </span>
            </div>

            <p className="text-[11px] text-slate-600 leading-snug">
              Ferramentas locais para organização fiscal. Valores e limites são referências; cobrança e limite por servidor não estão conectados.
            </p>

            {/* Mini Lista Comparativa de Planos (Baixinha e Discreta) */}
            <div className="grid grid-cols-3 gap-1.5 pt-0.5 text-center">
              <div className={`p-1.5 rounded-lg border text-[10px] transition-all ${
                planoAtivoId === 'basico'
                  ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-2xs'
                  : 'bg-white/80 border-slate-200 text-slate-700'
              }`}>
                <div className="font-bold text-[10px]">Básico</div>
                <div className={`text-[9px] ${planoAtivoId === 'basico' ? 'text-indigo-100' : 'text-slate-500'}`}>Ref. 50 CNPJs</div>
              </div>

              <div className={`p-1.5 rounded-lg border text-[10px] transition-all ${
                planoAtivoId === 'profissional'
                  ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-2xs'
                  : 'bg-white/80 border-slate-200 text-slate-700'
              }`}>
                <div className="font-bold text-[10px]">Profissional</div>
                <div className={`text-[9px] ${planoAtivoId === 'profissional' ? 'text-indigo-100' : 'text-slate-500'}`}>Ref. 100 CNPJs</div>
              </div>

              <div className={`p-1.5 rounded-lg border text-[10px] transition-all ${
                planoAtivoId === 'empresarial'
                  ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-2xs'
                  : 'bg-white/80 border-slate-200 text-slate-700'
              }`}>
                <div className="font-bold text-[10px]">Empresarial</div>
                <div className={`text-[9px] ${planoAtivoId === 'empresarial' ? 'text-indigo-100' : 'text-slate-500'}`}>Ref. 500 CNPJs</div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-indigo-100 flex items-center justify-between text-[10.5px]">
            <span className="text-[10px] text-slate-500 font-medium">
              Plano de referência neste acesso: <strong className="text-indigo-900 capitalize">{planoAtivoId}</strong>
            </span>
            <button
              type="button"
              id="btn-mudar-plano-propaganda"
              onClick={() => onNavegar('planos')}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10.5px] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Clique para ver detalhes dos planos e alterar sua assinatura"
            >
              <span>Mudar de Plano</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
