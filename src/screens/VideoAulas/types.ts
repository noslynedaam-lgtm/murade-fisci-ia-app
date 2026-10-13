export interface AlvoClique {
  id: string;
  textoAcao: string;
  passoNumero: number;
  elementoAlvo: 
    | 'LOGIN_BTN' 
    | 'MENU_SIDEBAR' 
    | 'DCTFWEB_TRANSMITIR' 
    | 'PIX_COPIA' 
    | 'WHATSAPP_BTN' 
    | 'SERPRO_TESTAR' 
    | 'PROCURACAO_VALIDAR' 
    | 'IA_ENVIAR'
    | 'FILTRO_MES';
  posicaoMobile: { 
    top: string; 
    left: string; 
    direcaoSeta?: 'cima' | 'baixo' | 'esquerda' | 'direita';
  };
  posicaoPC: { 
    top: string; 
    left: string; 
    direcaoSeta?: 'cima' | 'baixo' | 'esquerda' | 'direita';
  };
  explicacaoClique: string;
}

export interface PedacinhoVideo {
  id: string;
  tempoInicio: string;
  tempoSegundos: number;
  duracao: string;
  titulo: string;
  descricao: string;
  telaSimulada: 'LOGIN' | 'INICIO' | 'DCTFWEB' | 'GUIAS' | 'SERPRO' | 'PROCURACAO' | 'IA_CHAT';
  dicaPratica: string;
  narracaoVoz: string;
  alvoClique: AlvoClique;
}

export interface Aula {
  id: string;
  titulo: string;
  descricao: string;
  duracao: string;
  categoria: 'TODAS' | 'CELULAR' | 'PC' | 'DCTFWEB' | 'FISCAL' | 'PROCURACAO' | 'IA_COMPLIANCE';
  dispositivoPrincipal: 'AMBOS' | 'CELULAR' | 'PC';
  modulo: string;
  nivel: 'Iniciante' | 'Intermediário' | 'Avançado';
  concluida: boolean;
  videoUrl?: string;
  materiais?: string[];
  pedacinhos: PedacinhoVideo[];
}
