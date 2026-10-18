import { Aula } from './types';

export const AULAS_CATALOGO: Aula[] = [
  {
    id: 'aula-geral-1',
    titulo: 'DCTFWeb — demonstração e conferência no portal oficial',
    descricao: 'Demonstração visual de uma rotina de conferência. Este Murade não fecha eSocial, transmite DCTFWeb nem emite guias oficiais.',
    duracao: '14 min',
    categoria: 'DCTFWEB',
    dispositivoPrincipal: 'AMBOS',
    modulo: 'Módulo 1: DCTFWeb & Fechamento Fiscal',
    nivel: 'Iniciante',
    concluida: true,
    pedacinhos: [
      {
        id: 'p-1-1',
        tempoInicio: '00:00',
        tempoSegundos: 0,
        duracao: '02:30',
        titulo: '1. Acesse o serviço oficial da DCTFWeb',
        descricao: 'O menu mostrado é fictício. Para consultar uma declaração, entre no portal oficial com a autorização exigida.',
        telaSimulada: 'DCTFWEB',
        dicaPratica: 'Esta demonstração não carrega declarações nem pendências de clientes.',
        narracaoVoz: 'Este é um exemplo visual, não um portal conectado. Para ver a DCTFWeb real, acesse o serviço oficial da Receita Federal com a conta e os poderes adequados.',
        alvoClique: {
          id: 'alvo-1-1',
          passoNumero: 1,
          textoAcao: 'Veja o menu demonstrativo',
          elementoAlvo: 'MENU_SIDEBAR',
          posicaoMobile: { top: '32%', left: '48%', direcaoSeta: 'cima' },
          posicaoPC: { top: '28%', left: '16%', direcaoSeta: 'esquerda' },
          explicacaoClique: 'O clique só avança a aula; não consulta declarações.'
        }
      },
      {
        id: 'p-1-2',
        tempoInicio: '02:30',
        tempoSegundos: 150,
        duracao: '03:45',
        titulo: '2. Conferindo a transmissão no portal oficial',
        descricao: 'A transmissão da DCTFWeb não está integrada ao Murade. Confira os dados e conclua o envio somente no portal oficial, se estiver autorizado.',
        telaSimulada: 'DCTFWEB',
        dicaPratica: 'O Murade não assina nem transmite a declaração. Confirme competência, valores e autorização no ambiente oficial antes de enviar.',
        narracaoVoz: 'Este quadro é apenas uma demonstração. O Murade não transmite DCTFWeb. Acesse o portal oficial da Receita Federal com a autorização adequada, revise os dados da competência e acompanhe o recibo gerado pelo próprio portal.',
        alvoClique: {
          id: 'alvo-1-2',
          passoNumero: 2,
          textoAcao: 'Veja o exemplo de conferência',
          elementoAlvo: 'DCTFWEB_TRANSMITIR',
          posicaoMobile: { top: '46%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '42%', left: '76%', direcaoSeta: 'direita' },
          explicacaoClique: 'O clique só avança a demonstração; não envia dados nem gera recibo.'
        }
      },
      {
        id: 'p-1-3',
        tempoInicio: '06:15',
        tempoSegundos: 375,
        duracao: '03:10',
        titulo: '3. Conferindo uma guia no portal oficial',
        descricao: 'As guias exibidas no simulador são fictícias. Emita e confira a guia no portal oficial antes de pagar.',
        telaSimulada: 'GUIAS',
        dicaPratica: 'Este sistema não consulta pagamentos nem confirma baixa. Use os dados e comprovantes do portal e do banco responsáveis.',
        narracaoVoz: 'Os dados desta tela são de demonstração. Não copie nem pague por um código exibido aqui. Gere a guia no portal oficial, confira CNPJ, competência e valor, e confirme a situação com o comprovante bancário e no serviço responsável.',
        alvoClique: {
          id: 'alvo-1-3',
          passoNumero: 3,
          textoAcao: 'Veja o exemplo de guia',
          elementoAlvo: 'PIX_COPIA',
          posicaoMobile: { top: '68%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '64%', left: '60%', direcaoSeta: 'cima' },
          explicacaoClique: 'O clique apenas avança a aula; não copia nem gera um código de pagamento.'
        }
      },
      {
        id: 'p-1-4',
        tempoInicio: '09:25',
        tempoSegundos: 565,
        duracao: '04:35',
        titulo: '4. Compartilhando documentos com segurança',
        descricao: 'O Murade não envia guias por WhatsApp. Compartilhe somente documentos oficiais depois de conferi-los.',
        telaSimulada: 'GUIAS',
        dicaPratica: 'Não há envio automático por WhatsApp neste ambiente. Confirme o destinatário e envie pelo canal autorizado do escritório.',
        narracaoVoz: 'O botão visto nesta aula é fictício e não envia mensagens nem arquivos. Quando tiver emitido e conferido a guia no portal oficial, compartilhe o documento pelo canal seguro usado pelo seu escritório.',
        alvoClique: {
          id: 'alvo-1-4',
          passoNumero: 4,
          textoAcao: 'Veja o exemplo de compartilhamento',
          elementoAlvo: 'WHATSAPP_BTN',
          posicaoMobile: { top: '78%', left: '72%', direcaoSeta: 'cima' },
          posicaoPC: { top: '64%', left: '78%', direcaoSeta: 'cima' },
          explicacaoClique: 'O clique só avança a demonstração e não abre nem envia mensagens.'
        }
      }
    ]
  },
  {
    id: 'aula-pc-1',
    titulo: '💻 Navegação demonstrativa no computador',
    descricao: 'Explore o layout demonstrativo no navegador. Os dados e ações mostrados não representam consultas, exportações ou transmissões reais.',
    duracao: '12 min',
    categoria: 'PC',
    dispositivoPrincipal: 'PC',
    modulo: 'Módulo 2: Operação no Computador / Desktop',
    nivel: 'Iniciante',
    concluida: true,
    pedacinhos: [
      {
        id: 'p-pc-1',
        tempoInicio: '00:00',
        tempoSegundos: 0,
        duracao: '03:10',
        titulo: '1. Login e Seleção de Escritório no PC',
        descricao: 'A tela de login mostrada é apenas um exemplo; não autentica nem abre uma carteira de clientes.',
        telaSimulada: 'LOGIN',
        dicaPratica: 'Este simulador não recebe certificados nem autentica usuários.',
        narracaoVoz: 'Esta tela é ilustrativa. O botão apenas avança a aula; ele não autentica, acessa certificado ou carrega empresas.',
        alvoClique: {
          id: 'alvo-pc-1',
          passoNumero: 1,
          textoAcao: 'Clique em Entrar no Sistema',
          elementoAlvo: 'LOGIN_BTN',
          posicaoMobile: { top: '70%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '62%', left: '60%', direcaoSeta: 'cima' },
          explicacaoClique: 'O clique apenas avança o simulador e não inicia uma sessão.'
        }
      },
      {
        id: 'p-pc-2',
        tempoInicio: '03:10',
        tempoSegundos: 190,
        duracao: '04:20',
        titulo: '2. Visão Panorâmica de Vencimentos no Monitor',
        descricao: 'Exemplo de painel. O Murade não audita todos os prazos fiscais nem confirma obrigações externas.',
        telaSimulada: 'INICIO',
        dicaPratica: 'Os nomes, valores, prazos e status neste quadro são fictícios.',
        narracaoVoz: 'O painel ilustrativo não consulta obrigações nem calendário oficial. Use fontes oficiais para confirmar vencimentos e consulte os dados reais da empresa antes de agir.',
        alvoClique: {
          id: 'alvo-pc-2',
          passoNumero: 2,
          textoAcao: 'Clique no Resumo de Vencimentos',
          elementoAlvo: 'FILTRO_MES',
          posicaoMobile: { top: '42%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '35%', left: '50%', direcaoSeta: 'cima' },
          explicacaoClique: 'O clique avança o simulador; não filtra guias de clientes.'
        }
      },
      {
        id: 'p-pc-3',
        tempoInicio: '07:30',
        tempoSegundos: 450,
        duracao: '04:30',
        titulo: '3. Conferência de Guias em Tela Dupla no PC',
        descricao: 'Exemplo de conferência visual. Não há integração com eSocial nem apuração de DARF nesta tela.',
        telaSimulada: 'GUIAS',
        dicaPratica: 'Os valores e códigos do exemplo não podem ser utilizados para pagamento.',
        narracaoVoz: 'Este quadro não compara dados do eSocial nem gera guia. Para apurar, emitir ou conferir valores, use os sistemas oficiais e os dados validados pelo contador.',
        alvoClique: {
          id: 'alvo-pc-3',
          passoNumero: 3,
          textoAcao: 'Clique para Ver Espelho da Guia',
          elementoAlvo: 'PIX_COPIA',
          posicaoMobile: { top: '68%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '56%', left: '65%', direcaoSeta: 'cima' },
          explicacaoClique: 'O clique só avança o simulador; não gera nem consulta guia oficial.'
        }
      }
    ]
  },
  {
    id: 'aula-celular-1',
    titulo: '📱 Navegação demonstrativa no celular',
    descricao: 'Explore o layout demonstrativo em uma tela pequena. Este simulador não acessa guias nem compartilha documentos.',
    duracao: '11 min',
    categoria: 'CELULAR',
    dispositivoPrincipal: 'CELULAR',
    modulo: 'Módulo 3: Aplicativo Mobile & Celular',
    nivel: 'Iniciante',
    concluida: true,
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
        titulo: '2. Visualização de exemplo da DCTFWeb',
        descricao: 'Esta tela não acessa declarações nem atualiza pendências em tempo real.',
        telaSimulada: 'DCTFWEB',
        dicaPratica: 'Não há sincronização com o portal oficial neste simulador.',
        narracaoVoz: 'Os dados de empresa e os valores apresentados são fictícios. O Murade não calcula DARF nem confirma o status de transmissão da Receita.',
        alvoClique: {
          id: 'alvo-mob-2',
          passoNumero: 2,
          textoAcao: 'Veja o exemplo de declaração',
          elementoAlvo: 'DCTFWEB_TRANSMITIR',
          posicaoMobile: { top: '48%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '42%', left: '76%', direcaoSeta: 'direita' },
          explicacaoClique: 'O toque apenas avança a aula; não abre nem transmite declaração.'
        }
      },
      {
        id: 'p-mob-3',
        tempoInicio: '06:30',
        tempoSegundos: 390,
        duracao: '04:30',
        titulo: '3. Compartilhamento manual e seguro',
        descricao: 'O Murade não envia DARF ou QR Code Pix por WhatsApp. Use somente documentos oficiais conferidos.',
        telaSimulada: 'GUIAS',
        dicaPratica: 'O botão do simulador não abre o WhatsApp e não envia arquivos.',
        narracaoVoz: 'Este botão só avança a aula. Depois de emitir e conferir o documento no portal oficial, compartilhe-o pelo canal autorizado do escritório.',
        alvoClique: {
          id: 'alvo-mob-3',
          passoNumero: 3,
          textoAcao: 'Veja a ação demonstrativa',
          elementoAlvo: 'WHATSAPP_BTN',
          posicaoMobile: { top: '78%', left: '72%', direcaoSeta: 'cima' },
          posicaoPC: { top: '64%', left: '78%', direcaoSeta: 'cima' },
          explicacaoClique: 'Não abre conversa nem envia mensagem.'
        }
      }
    ]
  },
  {
    id: 'aula-serpro-1',
    titulo: '🔌 Requisitos para integrar serviços do SERPRO',
    descricao: 'Entenda que credenciais, contratação, documentação e homologação precisam ser obtidas antes de qualquer integração oficial.',
    duracao: '10 min',
    categoria: 'FISCAL',
    dispositivoPrincipal: 'AMBOS',
    modulo: 'Módulo 4: Integração Governamental SERPRO',
    nivel: 'Intermediário',
    concluida: false,
    pedacinhos: [
      {
        id: 'p-serp-1',
        tempoInicio: '00:00',
        tempoSegundos: 0,
        duracao: '04:20',
        titulo: '1. Confira os requisitos da integração',
        descricao: 'O Murade não possui um teste de conexão SERPRO funcional nesta versão. Consulte a documentação e contratação do serviço desejado.',
        telaSimulada: 'SERPRO',
        dicaPratica: 'Um botão de teste visual não comprova autenticação, disponibilidade ou autorização de API.',
        narracaoVoz: 'Esta tela é ilustrativa e não faz ping nem chamada ao SERPRO. Para integração real, o escritório precisa ter o serviço contratado e as credenciais e certificados exigidos configurados com segurança no servidor.',
        alvoClique: {
          id: 'alvo-serp-1',
          passoNumero: 1,
          textoAcao: 'Veja a demonstração visual',
          elementoAlvo: 'SERPRO_TESTAR',
          posicaoMobile: { top: '35%', left: '50%', direcaoSeta: 'baixo' },
          posicaoPC: { top: '30%', left: '80%', direcaoSeta: 'direita' },
          explicacaoClique: 'O clique apenas avança a aula; nenhum serviço SERPRO é chamado.'
        }
      },
      {
        id: 'p-serp-2',
        tempoInicio: '04:20',
        tempoSegundos: 260,
        duracao: '05:40',
        titulo: '2. Como reconhecer uma resposta oficial',
        descricao: 'Uma integração só deve ser considerada ativa quando houver chamada autenticada, resposta do serviço e registro verificável.',
        telaSimulada: 'SERPRO',
        dicaPratica: 'Este aplicativo ainda não registra respostas SERPRO nem retentativas de serviço.',
        narracaoVoz: 'Indicadores verdes nesta demonstração não são status reais. Nesta versão não há integração SERPRO ativa, monitoramento de latência ou transmissão. Confirme o serviço no portal e na documentação oficial do provedor.',
        alvoClique: {
          id: 'alvo-serp-2',
          passoNumero: 2,
          textoAcao: 'Veja os indicadores demonstrativos',
          elementoAlvo: 'SERPRO_TESTAR',
          posicaoMobile: { top: '56%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '55%', left: '50%', direcaoSeta: 'cima' },
          explicacaoClique: 'Os indicadores são exemplos estáticos, sem chamada oficial.'
        }
      }
    ]
  },
  {
    id: 'aula-procuracao-1',
    titulo: '📜 Conferência de procurações no e-CAC',
    descricao: 'Como revisar uma procuração diretamente no portal oficial, respeitando os poderes concedidos e o método de acesso exigido.',
    duracao: '11 min',
    categoria: 'PROCURACAO',
    dispositivoPrincipal: 'AMBOS',
    modulo: 'Módulo 5: Procurações Eletrônicas RFB',
    nivel: 'Iniciante',
    concluida: false,
    pedacinhos: [
      {
        id: 'p-proc-1',
        tempoInicio: '00:00',
        tempoSegundos: 0,
        duracao: '04:30',
        titulo: '1. Verificando Validade das Procurações e-CAC',
        descricao: 'O Murade não consulta procurações no e-CAC. Confira poderes e validade diretamente no portal oficial.',
        telaSimulada: 'PROCURACAO',
        dicaPratica: 'Os cartões desta aula são exemplos e não correspondem a procurações reais de clientes.',
        narracaoVoz: 'A tela é demonstrativa e não acessa o e-CAC. Entre no portal oficial com a identidade e autorização adequadas, localize a procuração e confira poderes e validade na fonte.',
        alvoClique: {
          id: 'alvo-proc-1',
          passoNumero: 1,
          textoAcao: 'Veja a demonstração de procuração',
          elementoAlvo: 'PROCURACAO_VALIDAR',
          posicaoMobile: { top: '48%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '45%', left: '75%', direcaoSeta: 'direita' },
          explicacaoClique: 'O clique só avança a aula e não verifica procuração no e-CAC.'
        }
      }
    ]
  },
  {
    id: 'aula-ia-1',
    titulo: '🤖 Como consultar o assistente fiscal',
    descricao: 'Aprenda a formular uma pergunta. Respostas dependem da disponibilidade do serviço de IA e devem ser conferidas nas fontes oficiais citadas.',
    duracao: '15 min',
    categoria: 'IA_COMPLIANCE',
    dispositivoPrincipal: 'AMBOS',
    modulo: 'Módulo 6: Inteligência Fiscal & Compliance',
    nivel: 'Avançado',
    concluida: false,
    pedacinhos: [
      {
        id: 'p-ia-1',
        tempoInicio: '00:00',
        tempoSegundos: 0,
        duracao: '06:00',
        titulo: '1. Enviando Pergunta Tributária para a IA',
        descricao: 'Formule uma dúvida objetiva. A conversa simulada nesta aula não executa uma consulta nem confirma regras atuais.',
        telaSimulada: 'IA_CHAT',
        dicaPratica: 'Se a pergunta depender de regra atual, confira a data e as fontes oficiais retornadas pela resposta.',
        narracaoVoz: 'Esta conversa é apenas uma demonstração. No assistente real, envie uma pergunta e confira se houve resposta e se as fontes citadas são oficiais. Sem fonte atual, não considere a resposta confirmada.',
        alvoClique: {
          id: 'alvo-ia-1',
          passoNumero: 1,
          textoAcao: 'Veja a conversa demonstrativa',
          elementoAlvo: 'IA_ENVIAR',
          posicaoMobile: { top: '55%', left: '50%', direcaoSeta: 'cima' },
          posicaoPC: { top: '50%', left: '60%', direcaoSeta: 'cima' },
          explicacaoClique: 'O clique apenas avança a aula e não chama o serviço de IA.'
        }
      }
    ]
  }
];
