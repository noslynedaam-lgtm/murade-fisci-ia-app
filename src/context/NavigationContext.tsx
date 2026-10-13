import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface NavigationContextType {
  abaAtiva: string;
  navegarPara: (tela: string) => void;
  voltar: () => void;
  historico: string[];
  podeVoltar: boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ 
  children, 
  abaAtual = 'dashboard',
  onMudarAba
}: { 
  children: ReactNode; 
  abaAtual?: string;
  onMudarAba?: (aba: string) => void;
}) {
  const [historico, setHistorico] = useState<string[]>([abaAtual]);

  // Se abaAtual mudar externamente (ex: clique no Navbar ou seletor)
  useEffect(() => {
    setHistorico((prev) => {
      const ultimo = prev[prev.length - 1];
      if (ultimo !== abaAtual) {
        return [...prev, abaAtual];
      }
      return prev;
    });
  }, [abaAtual]);

  const abaAtiva = historico[historico.length - 1] || abaAtual || 'dashboard';

  const navegarPara = (novaTela: string) => {
    if (novaTela === abaAtiva) return;
    setHistorico((prev) => [...prev, novaTela]);
    if (onMudarAba) onMudarAba(novaTela);
  };

  const voltar = () => {
    if (historico.length <= 1) {
      if (historico[0] !== 'dashboard') {
        setHistorico(['dashboard']);
        if (onMudarAba) {
          onMudarAba('dashboard');
        }
      }
      return;
    }
    const novo = historico.slice(0, historico.length - 1);
    const telaAnterior = novo[novo.length - 1] || 'dashboard';
    setHistorico(novo);
    if (onMudarAba) {
      onMudarAba(telaAnterior);
    }
  };

  const podeVoltar = historico.length > 1 || abaAtiva !== 'dashboard';

  return (
    <NavigationContext.Provider value={{ abaAtiva, navegarPara, voltar, historico, podeVoltar }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useAppNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    return {
      abaAtiva: 'dashboard',
      navegarPara: (_tela: string) => {},
      voltar: () => {
        window.history.back();
      },
      historico: ['dashboard'],
      podeVoltar: true
    };
  }
  return context;
}

export const useNavigation = useAppNavigation;
