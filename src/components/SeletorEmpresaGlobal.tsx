import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check, Plus, AlertCircle } from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';

interface SeletorEmpresaGlobalProps {
  onCadastrarNova?: () => void;
  className?: string;
  tamanho?: 'pequeno' | 'medio';
}

export default function SeletorEmpresaGlobal({
  onCadastrarNova,
  className = '',
  tamanho = 'medio'
}: SeletorEmpresaGlobalProps) {
  const { empresas, empresaAtiva, selecionarEmpresa } = useEmpresa();
  const [aberto, setAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickFora(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        id="btn-seletor-empresa-global"
        onClick={() => setAberto(!aberto)}
        className={`flex items-center gap-2 rounded-xl border transition-all cursor-pointer select-none ${
          empresaAtiva
            ? 'bg-white border-slate-300 hover:border-indigo-400 hover:bg-slate-50 text-slate-900 shadow-2xs'
            : 'bg-amber-50 border-amber-300 hover:bg-amber-100 text-amber-900 font-bold'
        } ${tamanho === 'pequeno' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs'}`}
        title="Clique para selecionar a empresa de trabalho"
      >
        <Building2
          className={`${tamanho === 'pequeno' ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${
            empresaAtiva ? 'text-indigo-700' : 'text-amber-700'
          } shrink-0`}
        />

        <div className="text-left truncate max-w-[170px] sm:max-w-[260px] md:max-w-[320px]">
          {empresaAtiva ? (
            <>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold leading-tight">
                Empresa Ativa
              </span>
              <span className="font-extrabold text-slate-900 truncate block leading-tight">
                {empresaAtiva.nomeFantasia || empresaAtiva.razaoSocial}
              </span>
            </>
          ) : (
            <div className="flex items-center gap-1.5 py-0.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-xs font-bold text-amber-900 truncate">
                {empresas.length === 0 ? 'Nenhuma empresa cadastrada' : 'Selecionar Empresa'}
              </span>
            </div>
          )}
        </div>

        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5" />
      </button>

      {aberto && (
        <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Empresas Cadastradas ({empresas.length})
            </span>
            {onCadastrarNova && (
              <button
                type="button"
                onClick={() => {
                  setAberto(false);
                  onCadastrarNova();
                }}
                className="text-[11px] text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Nova Empresa</span>
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto py-1 space-y-1">
            {empresas.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 space-y-2">
                <p>Nenhuma empresa cadastrada no momento.</p>
                {onCadastrarNova && (
                  <button
                    type="button"
                    onClick={() => {
                      setAberto(false);
                      onCadastrarNova();
                    }}
                    className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg text-xs cursor-pointer hover:bg-indigo-700"
                  >
                    + Cadastrar Empresa
                  </button>
                )}
              </div>
            ) : (
              empresas.map((emp) => {
                const isSelected = empresaAtiva?.id === emp.id;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      selecionarEmpresa(emp);
                      setAberto(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-950 font-bold'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold truncate text-slate-900">
                          {emp.razaoSocial}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{emp.cnpj}</span>
                        {emp.regimeTributario && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 font-sans uppercase font-bold text-slate-600">
                            {emp.regimeTributario.replace('_', ' ')}
                          </span>
                        )}
                        {emp.certificado?.validade ? (
                          <span title="Há uma data de validade informada localmente; o arquivo e a conexão não foram validados." className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 font-sans font-semibold flex items-center gap-0.5">
                            🔐 Validade informada
                          </span>
                        ) : (
                          <span title="Nenhuma referência local de validade cadastrada; o sistema não verificou se há certificado." className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-sans font-semibold flex items-center gap-0.5">
                            ⚠️ Sem referência
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
