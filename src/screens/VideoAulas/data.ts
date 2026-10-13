import { Aula } from './types';

export const AULAS_CATALOGO: Aula[] = [
  {
    id: 'aula-geral-1',
    titulo: 'DCTFWeb & Emissão de DARF Dia 20 (Celular & PC)',
    descricao: 'Como fechar o eSocial, apurar a DCTFWeb, transmitir para a Receita Federal e emitir a guia DARF numerada com QR Code Pix.',
    duracao: '14 min',
    categoria: 'DCTFWEB',
    dispositivoPrincipal: 'AMBOS',
    modulo: 'Módulo 1: DCTFWeb & Fechamento Fiscal',
    nivel: 'Iniciante',
    concluida: true,
    materiais: ['Manual_DCTFWeb_Receita_Federal.pdf', 'Checklist_Fechamento_Dia20.pdf'],
    pedacinhos: [
      {
        id: 'p-1-1',
        tempoInicio: '00:00',
        tempoSegundos: 0,
        duracao: '02:30',
        titulo: '1. Acessando a DCTFWeb no Menu Principal',
        descricao: 'Localize no menu lateral o módulo de DCTFWeb para carregar as empresas apuradas no período.',
        telaSimulada: 'DCTFWEB',
        dicaPratica: 'O menu lateral mostra as pendências da competência atual com badges coloridos.',
        narracaoVoz: 'Olá! Observe a seta amarela indicando na tela exatamente onde você deve clicar. Acesse o menu DCTFWeb para carregar as apurações da competência atual. Clique na opção indicada.',
        alvoClique: {
          id: 'alvo-1-1',
          passoNumero: 1,
          textoAcao: 'Clique no Menu DCTFWeb',
          elementoAlvo: 'MENU_SIDEBAR',
          posicaoMobile: { top: '32%', left: '48%', direcaoSeta: 'cima' },
          posicaoPC: { top: '28%', left: '16%', direcaoSeta: 'esquerda' },
          explicacaoClique: 'Clique neste botão para listar as declarações previdenciárias e fiscais do mês.'
        }
      },
      {
        id: 'p-1-2',
        tempoInicio: '02:30',
        tempoSegundos: 150,
        duracao: '03:45',
        titulo: '2. Transmitindo a Declaração para a Receita',
        descricao: 'Clique no botão verde "Transmitir DCTFWeb" para enviar a apuração diretamente ao e-CAC.',
        telaSimulada: 'DCTFWEB',
        dicaPratica: 'Antes de transmitir, confirme se as deduções de salário-família e maternidade foram abatidas.',
        narracaoVoz: 'Agora veja a seta apontando para o botão Transmitir DCTFWeb. Dê um clique neste botão para homologar a transmissão oficial dos tributos previdenciários junto ao SERPRO e Receita Federal.',
        alvoClique: {
          id: 'alvo-1-2',
          passoNumero: 2,
          textoAcao: 'Clique em Transmitir DCTFWeb',
          elementoAlvo: 'DCTFWEB_TRANSMITIR',
          posicaoMobile: { top: '46%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '42%', left: '76%', direcaoSeta: 'direita' },
          explicacaoClique: 'O sistema assina digitalmente a apuração e gera o número do recibo na Receita Federal.'
        }
      },
      {
        id: 'p-1-3',
        tempoInicio: '06:15',
        tempoSegundos: 375,
        duracao: '03:10',
        titulo: '3. Copiando o Código Pix da Guia DARF',
        descricao: 'Clique no botão "Copiar Pix Copia e Cola" para pagar instantaneamente pelo aplicativo do banco.',
        telaSimulada: 'GUIAS',
        dicaPratica: 'Pagamentos por Pix são baixados na Receita Federal em até 10 minutos.',
        narracaoVoz: 'Veja onde a seta está indicando. Clique no botão Copiar Pix Copia e Cola para copiar a chave da guia gerada. Você pode colar no app do seu banco ou enviar diretamente para o cliente.',
        alvoClique: {
          id: 'alvo-1-3',
          passoNumero: 3,
          textoAcao: 'Clique para Copiar Pix Copia e Cola',
          elementoAlvo: 'PIX_COPIA',
          posicaoMobile: { top: '68%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '64%', left: '60%', direcaoSeta: 'cima' },
          explicacaoClique: 'Copia o código Pix no formato oficial do Banco Central e Receita Federal.'
        }
      },
      {
        id: 'p-1-4',
        tempoInicio: '09:25',
        tempoSegundos: 565,
        duracao: '04:35',
        titulo: '4. Disparando a Guia no WhatsApp do Cliente',
        descricao: 'Envie a guia em PDF e o código de barras com apenas um clique para o WhatsApp do cliente.',
        telaSimulada: 'GUIAS',
        dicaPratica: 'O envio automático já inclui a mensagem personalizada com o vencimento do dia 20.',
        narracaoVoz: 'Para finalizar, clique no botão verde Enviar por WhatsApp indicado pela seta. O FiscoIA anexa o PDF do DARF com código de barras e manda na hora para o telefone cadastrado.',
        alvoClique: {
          id: 'alvo-1-4',
          passoNumero: 4,
          textoAcao: 'Clique em Enviar via WhatsApp',
          elementoAlvo: 'WHATSAPP_BTN',
          posicaoMobile: { top: '78%', left: '72%', direcaoSeta: 'cima' },
          posicaoPC: { top: '64%', left: '78%', direcaoSeta: 'cima' },
          explicacaoClique: 'Abre o WhatsApp Web no PC ou o WhatsApp nativo no celular já pronto para enviar.'
        }
      }
    ]
  },
  {
    id: 'aula-pc-1',
    titulo: '💻 FiscoIA no Computador (PC): Produtividade & Painel Desktop',
    descricao: 'Aprenda a operar o sistema no navegador do PC: telas divididas, atalhos de teclado, exportação para Excel e gestão em lote de dezenas de CNPJs.',
    duracao: '12 min',
    categoria: 'PC',
    dispositivoPrincipal: 'PC',
    modulo: 'Módulo 2: Operação no Computador / Desktop',
    nivel: 'Iniciante',
    concluida: true,
    materiais: ['Atalhos_Teclado_FiscoIA_PC.pdf', 'Planilha_Exportacao_Lote.xlsx'],
    pedacinhos: [
      {
        id: 'p-pc-1',
        tempoInicio: '00:00',
        tempoSegundos: 0,
        duracao: '03:10',
        titulo: '1. Login e Seleção de Escritório no PC',
        descricao: 'Acesse o portal web seguro no computador e selecione a carteira de clientes.',
        telaSimulada: 'LOGIN',
        dicaPratica: 'No PC, você pode manter a sessão salva com o Certificado Digital A1 ou e-CPF.',
        narracaoVoz: 'Bem-vindo ao FiscoIA no computador! Veja a seta apontando para o botão Entrar no Sistema. Clique nele para autenticar com certificado e carregar todas as empresas gerenciadas.',
        alvoClique: {
          id: 'alvo-pc-1',
          passoNumero: 1,
          textoAcao: 'Clique em Entrar no Sistema',
          elementoAlvo: 'LOGIN_BTN',
          posicaoMobile: { top: '70%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '62%', left: '60%', direcaoSeta: 'cima' },
          explicacaoClique: 'Inicia a sessão segura criptografada de alta performance para desktop.'
        }
      },
      {
        id: 'p-pc-2',
        tempoInicio: '03:10',
        tempoSegundos: 190,
        duracao: '04:20',
        titulo: '2. Visão Panorâmica de Vencimentos no Monitor',
        descricao: 'Como usar a tela ampla do computador para auditar 100% dos prazos fiscais da semana.',
        telaSimulada: 'INICIO',
        dicaPratica: 'Use as teclas de atalho Ctrl+F para localizar qualquer CNPJ ou Razão Social imediatamente.',
        narracaoVoz: 'Observe na tela do computador o painel de obrigações. Veja a seta amarela indicando os alertas de vencimento do dia 20. Clique no card de resumo para filtrar as empresas pendentes.',
        alvoClique: {
          id: 'alvo-pc-2',
          passoNumero: 2,
          textoAcao: 'Clique no Resumo de Vencimentos',
          elementoAlvo: 'FILTRO_MES',
          posicaoMobile: { top: '42%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '35%', left: '50%', direcaoSeta: 'cima' },
          explicacaoClique: 'Filtra as guias por status: transmitidas, em edição e vencendo nesta semana.'
        }
      },
      {
        id: 'p-pc-3',
        tempoInicio: '07:30',
        tempoSegundos: 450,
        duracao: '04:30',
        titulo: '3. Conferência de Guias em Tela Dupla no PC',
        descricao: 'Comparação simultânea dos valores do eSocial com o DARF apurado sem trocar de janela.',
        telaSimulada: 'GUIAS',
        dicaPratica: 'Você pode exportar a grade inteira para o Excel com o botão superior direito.',
        narracaoVoz: 'Aqui na conferência de guias no PC, a seta está indicando onde você confere o código de barras e o espelho da guia. Clique para expandir os detalhes e verificar as alíquotas RAT e FAP.',
        alvoClique: {
          id: 'alvo-pc-3',
          passoNumero: 3,
          textoAcao: 'Clique para Ver Espelho da Guia',
          elementoAlvo: 'PIX_COPIA',
          posicaoMobile: { top: '68%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '56%', left: '65%', direcaoSeta: 'cima' },
          explicacaoClique: 'Exibe a guia formatada no padrão oficial da Receita Federal do Brasil.'
        }
      }
    ]
  },
  {
    id: 'aula-celular-1',
    titulo: '📱 FiscoIA no Celular (Android): Operação Completa Touch',
    descricao: 'Como instalar o atalho na tela inicial do celular, navegar com gestos de toque, consultar guias e compartilhar DARF com clientes via WhatsApp.',
    duracao: '11 min',
    categoria: 'CELULAR',
    dispositivoPrincipal: 'CELULAR',
    modulo: 'Módulo 3: Aplicativo Mobile & Celular',
    nivel: 'Iniciante',
    concluida: true,
    materiais: ['Guia_Instalacao_Android_Mobile.pdf'],
    pedacinhos: [
      {
        id: 'p-mob-1',
        tempoInicio: '00:00',
        tempoSegundos: 0,
        duracao: '02:40',
        titulo: '1. Acesso Rápido com Toque na Tela do Smartphone',
        descricao: 'Como abrir o sistema pelo ícone na tela inicial e fazer login rápido.',
        telaSimulada: 'LOGIN',
        dicaPratica: 'Toque em "Adicionar à Tela Inicial" no Chrome para usar como aplicativo nativo.',
        narracaoVoz: 'Aprenda agora no celular. Veja a seta amarela indicando o campo de acesso. Toque no botão azul Entrar no Sistema para autenticar diretamente do seu celular Android.',
        alvoClique: {
          id: 'alvo-mob-1',
          passoNumero: 1,
          textoAcao: 'Toque em Entrar no Sistema',
          elementoAlvo: 'LOGIN_BTN',
          posicaoMobile: { top: '70%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '62%', left: '60%', direcaoSeta: 'cima' },
          explicacaoClique: 'Toque para entrar com suas credenciais salvas no smartphone.'
        }
      },
      {
        id: 'p-mob-2',
        tempoInicio: '02:40',
        tempoSegundos: 160,
        duracao: '03:50',
        titulo: '2. Consultando DCTFWeb na Tela Vertical do Celular',
        descricao: 'Visualização fluida e legível adaptada à tela do celular para checar pendências.',
        telaSimulada: 'DCTFWEB',
        dicaPratica: 'Deslize a tela para baixo para atualizar as apurações em tempo real.',
        narracaoVoz: 'Veja a seta indicando a primeira empresa da lista no celular. Toque nela para ver os valores de DARF calculados e o status de transmissão na Receita.',
        alvoClique: {
          id: 'alvo-mob-2',
          passoNumero: 2,
          textoAcao: 'Toque na Empresa para Transmitir',
          elementoAlvo: 'DCTFWEB_TRANSMITIR',
          posicaoMobile: { top: '48%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '42%', left: '76%', direcaoSeta: 'direita' },
          explicacaoClique: 'Toque para abrir a declaração e acionar o comando de transmissão.'
        }
      },
      {
        id: 'p-mob-3',
        tempoInicio: '06:30',
        tempoSegundos: 390,
        duracao: '04:30',
        titulo: '3. Envio Direto para o WhatsApp do Empresário',
        descricao: 'Dispare o DARF com QR Code Pix diretamente pelo WhatsApp do seu smartphone.',
        telaSimulada: 'GUIAS',
        dicaPratica: 'O WhatsApp abre automaticamente com a mensagem e o link do documento pronto.',
        narracaoVoz: 'Agora veja a seta apontando para o botão verde WhatsApp. Dê um toque nele. O FiscoIA abre o WhatsApp no seu smartphone com a guia pronta para o cliente pagar.',
        alvoClique: {
          id: 'alvo-mob-3',
          passoNumero: 3,
          textoAcao: 'Toque no Botão WhatsApp',
          elementoAlvo: 'WHATSAPP_BTN',
          posicaoMobile: { top: '78%', left: '72%', direcaoSeta: 'cima' },
          posicaoPC: { top: '64%', left: '78%', direcaoSeta: 'cima' },
          explicacaoClique: 'Abre a conversa do WhatsApp do cliente com a guia e o Pix prontos.'
        }
      }
    ]
  },
  {
    id: 'aula-serpro-1',
    titulo: '🔌 Homologação SERPRO & Teste de Gateway Oficial (PC & Celular)',
    descricao: 'Como configurar as credenciais do SERPRO, testar os 5 serviços governamentais e monitorar a latência da Receita Federal.',
    duracao: '10 min',
    categoria: 'FISCAL',
    dispositivoPrincipal: 'AMBOS',
    modulo: 'Módulo 4: Integração Governamental SERPRO',
    nivel: 'Intermediário',
    concluida: false,
    materiais: ['Checklist_Homologacao_SERPRO.pdf'],
    pedacinhos: [
      {
        id: 'p-serp-1',
        tempoInicio: '00:00',
        tempoSegundos: 0,
        duracao: '04:20',
        titulo: '1. Testando a Conexão Oficial com a Receita Federal',
        descricao: 'Acione o botão de teste para validar a resposta dos 5 microsserviços do SERPRO.',
        telaSimulada: 'SERPRO',
        dicaPratica: 'Latências abaixo de 200 milissegundos garantem respostas instantâneas na apuração.',
        narracaoVoz: 'Atenção: observe onde a seta amarela está indicando. Clique no botão azul Testar Conexão Agora. O FiscoIA fará um ping em tempo real nos servidores da Receita Federal.',
        alvoClique: {
          id: 'alvo-serp-1',
          passoNumero: 1,
          textoAcao: 'Clique em Testar Conexão Agora',
          elementoAlvo: 'SERPRO_TESTAR',
          posicaoMobile: { top: '35%', left: '50%', direcaoSeta: 'baixo' },
          posicaoPC: { top: '30%', left: '80%', direcaoSeta: 'direita' },
          explicacaoClique: 'Testa Integra Contador, DCTFWeb, CNPJ, Situação Fiscal e Dívida Ativa.'
        }
      },
      {
        id: 'p-serp-2',
        tempoInicio: '04:20',
        tempoSegundos: 260,
        duracao: '05:40',
        titulo: '2. Auditando os 5 Serviços Governamentais Ativos',
        descricao: 'Verifique se todos os microsserviços (DCTFWeb, CNPJ, CND, PGFN) estão com sinal verde.',
        telaSimulada: 'SERPRO',
        dicaPratica: 'Caso algum serviço apresente instabilidade no SERPRO, o FiscoIA faz retentativa automática.',
        narracaoVoz: 'Veja a seta indicando a lista dos serviços oficiais do SERPRO. Verifique se o status está verde em cada um deles. Estando todos verdes, o sistema está 100% pronto para transmitir.',
        alvoClique: {
          id: 'alvo-serp-2',
          passoNumero: 2,
          textoAcao: 'Verifique os Serviços Ativos',
          elementoAlvo: 'SERPRO_TESTAR',
          posicaoMobile: { top: '56%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '55%', left: '50%', direcaoSeta: 'cima' },
          explicacaoClique: 'Mostra os serviços oficiais homologados para emissão e consulta tributária.'
        }
      }
    ]
  },
  {
    id: 'aula-procuracao-1',
    titulo: '📜 Procurações Eletrônicas RFB e-CAC Sem Certificado do Cliente',
    descricao: 'Como emitir e aprovar a procuração RFB padrão código de segurança da Receita Federal para atender até centenas de CNPJs no e-CAC.',
    duracao: '11 min',
    categoria: 'PROCURACAO',
    dispositivoPrincipal: 'AMBOS',
    modulo: 'Módulo 5: Procurações Eletrônicas RFB',
    nivel: 'Iniciante',
    concluida: false,
    materiais: ['Modelo_Procuracao_RFB_2026.pdf'],
    pedacinhos: [
      {
        id: 'p-proc-1',
        tempoInicio: '00:00',
        tempoSegundos: 0,
        duracao: '04:30',
        titulo: '1. Verificando Validade das Procurações e-CAC',
        descricao: 'Como auditar os poderes concedidos (DCTFWeb, CND, parcelamentos) e os prazos de validade.',
        telaSimulada: 'PROCURACAO',
        dicaPratica: 'O FiscoIA alerta procurações com vencimento nos próximos 30 dias.',
        narracaoVoz: 'Veja onde a seta está indicando. Clique no card da procuração para verificar os poderes concedidos pela empresa e o prazo de validade no portal e-CAC.',
        alvoClique: {
          id: 'alvo-proc-1',
          passoNumero: 1,
          textoAcao: 'Clique para Validar Procuração',
          elementoAlvo: 'PROCURACAO_VALIDAR',
          posicaoMobile: { top: '48%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '45%', left: '75%', direcaoSeta: 'direita' },
          explicacaoClique: 'Verifica poderes de transmissão de DCTFWeb e emissão de guias no e-CAC.'
        }
      }
    ]
  },
  {
    id: 'aula-ia-1',
    titulo: '🤖 Auditoria Fiscal & Dúvidas Tributárias com IA no FiscoIA',
    descricao: 'Como utilizar o assistente de inteligência fiscal para analisar riscos, tirar dúvidas de retenção e redigir pareceres aos clientes.',
    duracao: '15 min',
    categoria: 'IA_COMPLIANCE',
    dispositivoPrincipal: 'AMBOS',
    modulo: 'Módulo 6: Inteligência Fiscal & Compliance',
    nivel: 'Avançado',
    concluida: false,
    materiais: ['Guia_Prompts_Fiscais_Contador.pdf'],
    pedacinhos: [
      {
        id: 'p-ia-1',
        tempoInicio: '00:00',
        tempoSegundos: 0,
        duracao: '06:00',
        titulo: '1. Enviando Pergunta Tributária para a IA',
        descricao: 'Como formular dúvidas sobre retenções de INSS, ISS, Simples Nacional ou regras de DCTFWeb.',
        telaSimulada: 'IA_CHAT',
        dicaPratica: 'Você pode digitar ou falar usando o microfone do celular ou computador.',
        narracaoVoz: 'Veja a seta amarela indicando a caixa de perguntas da IA. Clique no botão Enviar Consulta para que a inteligência tributária do FiscoIA cruze a legislação e responda em segundos.',
        alvoClique: {
          id: 'alvo-ia-1',
          passoNumero: 1,
          textoAcao: 'Clique em Enviar Consulta Fiscal',
          elementoAlvo: 'IA_ENVIAR',
          posicaoMobile: { top: '55%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '50%', left: '60%', direcaoSeta: 'cima' },
          explicacaoClique: 'Aciona o motor de inteligência artificial fiscal para análise de conformidade.'
        }
      }
    ]
  }
];
