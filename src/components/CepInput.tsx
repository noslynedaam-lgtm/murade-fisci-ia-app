import React, { useRef, useState } from 'react';
import { Loader2, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import { buscarCep } from '../services/viaCep';
import { DadosViaCep } from '../types';

interface CepInputProps {
  value: string;
  onChange: (cep: string) => void;
  onDadosCarregados?: (dados: DadosViaCep) => void;
  disabled?: boolean;
}

export default function CepInput({ value, onChange, onDadosCarregados, disabled = false }: CepInputProps) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const consultaId = useRef(0);

  // Formata 00000-000
  const formatarCep = (v: string) => {
    const limpo = v.replace(/\D/g, '').slice(0, 8);
    if (limpo.length > 5) {
      return `${limpo.slice(0, 5)}-${limpo.slice(5)}`;
    }
    return limpo;
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const idAtual = ++consultaId.current;
    const rawVal = e.target.value;
    const formatado = formatarCep(rawVal);
    onChange(formatado);

    const cepLimpo = formatado.replace(/\D/g, '');
    
    if (cepLimpo.length === 8) {
      setCarregando(true);
      setErro(null);
      setSucesso(false);
      
      try {
        const resposta = await buscarCep(cepLimpo);
        if (idAtual !== consultaId.current) return;
        if (resposta.erro) {
          setErro(resposta.mensagem || 'CEP inválido');
          setSucesso(false);
        } else if (resposta.dados) {
          setSucesso(true);
          onDadosCarregados?.(resposta.dados);
        }
      } catch (e) {
        if (idAtual === consultaId.current) {
          setErro(e instanceof Error ? e.message : 'Falha na consulta ao ViaCEP. Preencha o endereço manualmente.');
          setSucesso(false);
        }
      } finally {
        if (idAtual === consultaId.current) setCarregando(false);
      }
    } else {
      setCarregando(false);
      setErro(null);
      setSucesso(false);
    }
  };

  return (
    <div className="w-full space-y-1.5" id="cep-input-wrapper">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-indigo-600" />
          <span>CEP (Preenchimento Automático)</span>
        </label>
        {sucesso && (
          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Endereço localizado
          </span>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          id="cep-field-input"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder="00000-000"
          maxLength={9}
          className={`w-full px-3.5 py-2.5 bg-white border text-sm rounded-lg font-mono tracking-wider transition-colors placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
            erro 
              ? 'border-rose-300 focus:ring-rose-200 text-rose-900' 
              : sucesso 
              ? 'border-emerald-300 focus:ring-emerald-200 text-slate-900'
              : 'border-slate-300 focus:ring-indigo-100 focus:border-indigo-600 text-slate-900'
          }`}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          {carregando && (
            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
          )}
        </div>
      </div>

      {erro && (
        <p className="text-xs text-rose-600 flex items-center gap-1 mt-1 font-medium">
          <AlertCircle className="w-3 h-3" />
          {erro}
        </p>
      )}
    </div>
  );
}
