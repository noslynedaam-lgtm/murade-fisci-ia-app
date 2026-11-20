# Manual do Murade Fisco IA

Este manual foi escrito a partir do código e dos arquivos deste repositório (situação de 20/11/2026, commit `7a91128`).
Ele serve para o dono do sistema e para um programador contratado entenderem, consertarem e manterem o Fisco IA
sem depender de uma IA.

Regras deste manual:

- Nada aqui é inventado. Quando algo não pôde ser confirmado no código, aparece escrito **"conferir"**.
- Nenhuma senha, chave, certificado ou dado de cliente aparece aqui. Variáveis de ambiente aparecem **só pelo nome**.
- Se o código mudar, este manual precisa ser atualizado junto.

---

## Índice

**PARTE 1 — Para o dono (sem programar)**

1. [O que é o Fisco IA](#1-o-que-é-o-fisco-ia)
2. [O que o sistema faz](#2-o-que-o-sistema-faz)
3. [Regras de ouro do Serpro (dinheiro)](#3-regras-de-ouro-do-serpro-dinheiro)
4. [Como liberar a consulta ao Serpro para um escritório ou empresa](#4-como-liberar-a-consulta-ao-serpro-para-um-escritório-ou-empresa)
5. [Excluir empresa (exclusão em cascata)](#5-excluir-empresa-exclusão-em-cascata)
6. [Os robôs e conferidores](#6-os-robôs-e-conferidores)
7. [Como saber se o sistema está no ar](#7-como-saber-se-o-sistema-está-no-ar)
8. [Render passo a passo: ver erros, reiniciar, publicar, voltar versão](#8-render-passo-a-passo)
9. [Variáveis de ambiente (só os nomes)](#9-variáveis-de-ambiente-só-os-nomes)
10. [Certificado do Serpro (e-CNPJ do escritório)](#10-certificado-do-serpro-e-cnpj-do-escritório)
11. [Problemas comuns e o que fazer](#11-problemas-comuns-e-o-que-fazer)

**PARTE 2 — Para o programador**

12. [Tecnologias (stack)](#12-tecnologias-stack)
13. [Pastas e arquivos importantes](#13-pastas-e-arquivos-importantes)
14. [Rodar no computador (local)](#14-rodar-no-computador-local)
15. [Testes](#15-testes)
16. [Publicar (deploy)](#16-publicar-deploy)
17. [Banco de dados, migrações, RLS e o papel fiscoia_runtime](#17-banco-de-dados-migrações-rls-e-o-papel-fiscoia_runtime)
18. [Integração Serpro (Integra Contador e Consulta CND)](#18-integração-serpro-integra-contador-e-consulta-cnd)
19. [Agente IA (Gemini)](#19-agente-ia-gemini)
20. [Ligação com Fiscal, DP e Contábil](#20-ligação-com-fiscal-dp-e-contábil)
21. [Segurança do login](#21-segurança-do-login)
22. [Lista de itens "conferir"](#22-lista-de-itens-conferir)

---

# PARTE 1 — Para o dono (sem programar)

## 1. O que é o Fisco IA

O Murade Fisco IA é um dos sistemas Murade (junto com Fiscal, DP e Contábil). Ele roda na internet, no **Render**,
e guarda os dados num banco **PostgreSQL** compartilhado com o Murade Fiscal, numa área separada chamada `fiscoia`.

Dados de referência (não são senhas):

| Item | Valor |
|---|---|
| Serviço no Render | `srv-dbag3tdg1s2s73bvuisg` |
| Banco PostgreSQL no Render | `dpg-db80ev0u01pc738eju5g-a` (schema `fiscoia`) |
| Endereço público | `https://murade-fisco-ia.onrender.com` (é o endereço padrão que o código usa para o Fisco IA; **conferir** no Render se é o mesmo) |
| Repositório do código | `github.com/noslynedaam-lgtm/murade-fisci-ia-app`, ramo `main` |

Observação: o arquivo antigo `docs/DEPLOY_FISCO_IA_RENDER.md` cita outro repositório (`noslynedamurad-maker/murade-fisco-ia`).
**Conferir** no Render (Settings > Repository) qual repositório o serviço realmente acompanha.

Quem usa o sistema:

- **Dono do sistema (conta administradora)**: é você. Vê o "Painel MURADE", cadastra escritórios contratantes,
  libera consultas ao Serpro, vê o consumo para cobrança.
- **Escritórios clientes**: cada escritório só enxerga as próprias empresas. Dentro do escritório, os papéis são
  proprietário (OWNER), administrador (ADMIN) e equipe. Só proprietário/administrador fazem consultas oficiais.

## 2. O que o sistema faz

Itens confirmados no código:

1. **Cadastro de empresas por escritório** (menu "Cadastrar Empresa" e "Clientes / Empresas"). Cada escritório só vê as suas.
2. **Empresas trazidas do Murade Fiscal automaticamente** (robô de empresas, ver seção 6).
3. **Notas fiscais**: o robô sincronizador traz do Murade Fiscal as notas já guardadas lá. Também existe a consulta
   à **Distribuição DF-e da SEFAZ** com o certificado A1 da empresa (só quando a pessoa pede e confirma na tela).
4. **Conferência (radar)**: compara as notas guardadas no Fisco IA com as do Murade Fiscal e aponta diferenças.
5. **Consultas oficiais ao Serpro — Integra Contador** (bloco "Consulta oficial (SERPRO / Receita Federal)",
   que aparece na tela "Início" e na tela "Integração SERPRO"). Serviços que existem no catálogo do código:
   - Situação fiscal (relatório em PDF);
   - Simples Nacional: declarações do ano (PGDAS-D) e extrato de um DAS;
   - DCTFWeb: recibo, declaração completa, XML da declaração, guia (DARF) e guia de declaração em andamento;
   - **Parcelamentos**: Simples ordinário (PARCSN), Simples especial (PARCSN-ESP), PERT-SN, RELP Simples (RELPSN),
     MEI (PARCMEI), MEI especial (PARCMEI-ESP), PERT-MEI — em cada um: lista de pedidos, detalhes, pagamento de parcela,
     parcelas disponíveis e emissão do DAS da parcela em PDF;
   - MEI: DAS em PDF, DAS só com código de barras, dívida ativa do ano, Certificado da Condição de MEI (CCMEI);
   - Caixa Postal da Receita: lista de mensagens, se há mensagens novas e abrir uma mensagem.
     **Atenção:** abrir uma mensagem conta como **ciência da intimação** (igual ao e-CAC). A tela pede confirmação especial.
   - Serviços que **gravam** na Receita (transmitir DCTFWeb, registrar benefício do MEI) **não** rodam pela consulta comum;
     só pelo fluxo seguro com conferência e confirmação. A transmissão da DCTFWeb ainda depende de um interruptor
     (`SERPRO_DCTFWEB_TRANSMISSAO_HABILITADA`) e é pedida pelo DP/Fiscal pela "ponte".
   - O próprio código avisa que alguns formatos ainda precisam ser confirmados no primeiro teste real (ex.: versões de
     alguns serviços da DCTFWeb). **Conferir** no arquivo `src/services/serpro/integraContador.ts` os comentários "Pendente".
6. **Certidões / CND** (menu "CND / Certidões"):
   - **CND Federal (Receita + PGFN)**: consulta automática pelo produto "Consulta CND" do Serpro (produto separado do
     Integra Contador, com credenciais próprias). É **paga** e só sai por clique, com confirmação de custo.
   - Estadual, municipal, CRF do FGTS e CNDT: não têm consulta automática; a tela abre o portal do órgão e a pessoa
     registra a certidão emitida (com a validade) para o robô avisar o vencimento.
7. **Liberação da consulta ao Serpro pelo dono**, por empresa ou por escritório inteiro (seção 4).
8. **Consumo do Serpro para cobrança** (quadro "Consumo do SERPRO para cobrança", só para o dono), com botão
   "Baixar Excel (.csv)". O ciclo vai do dia 21 de um mês ao dia 20 do mês seguinte (fuso de Brasília).
9. **Exclusão de empresa em cascata** com os outros sistemas Murade (seção 5).
10. **Agente IA** (conversa por texto e voz): consulta dados, mostra robôs, propõe ações que só acontecem depois que
    a pessoa confirma no cartão da tela.
11. **Assistente fiscal (perguntas de legislação)**: responde pesquisando na internet e, para assuntos que mudam
    (prazos, alíquotas), exige fonte oficial `.gov.br`; se não achar, diz que não conseguiu confirmar.
12. **Reforma Tributária**: cenários por empresa, com base legal versionada (`src/data/reformaTributariaRegras.ts`).
13. **Segurança do login**: limite de tentativas, código de segurança no celular (2FA) e aparelho confiável.

## 3. Regras de ouro do Serpro (dinheiro)

Estas regras estão no código e **não podem ser quebradas**:

1. **Consulta paga ao Serpro só sai por clique de uma pessoa. Nunca por robô.** Todos os robôs do Fisco IA só leem
   o que já está guardado; nenhum chama o Serpro.
2. **Interruptor geral**: se a variável `SERPRO_CONSULTAS_HABILITADAS` não for exatamente `true`, nenhuma consulta
   paga acontece ("Consultas pagas desligadas neste sistema. Nada foi consultado nem cobrado.").
3. **Cota por empresa**: 1 consulta gratuita por semana por empresa (semana começa na segunda-feira, horário de Brasília),
   sem acumular. Da 2ª em diante na mesma semana, a tela pede "Confirmo o custo e quero consultar".
   O valor cobrado do escritório é R$ 1,00 por consulta acima da cota (constante no código). Os custos do Serpro
   anotados no código são: Consulta R$ 0,24, Emissão R$ 0,32, Declaração R$ 0,40 — **conferir** com a fatura real do Serpro.
4. **O contrato Serpro (Integra Contador) é do dono.** As chaves e o certificado do dono ficam nas variáveis de ambiente
   do Render. Quem usa a credencial do dono:
   - o próprio dono;
   - escritório que o dono **liberou por inteiro**, ou empresa que o dono **liberou no painel**, quando esse escritório
     **não** cadastrou credencial própria → usa o plano do dono;
   - pedidos que chegam pela "ponte" do DP, quando o DP já conferiu o modo (teste/efetivo) e as vagas.
   Escritório com credencial própria cadastrada usa **só a dele** (guardada cifrada no banco).
5. **Trava por empresa**: empresa de escritório cliente começa **travada**. Sem liberação do dono, nada é consultado,
   nem a gratuita. Se o sistema não conseguir saber se está liberada, trata como **travada** (nunca gasta por engano).
6. Toda consulta é registrada **antes** de chamar o Serpro (porque a tentativa pode ser cobrada).
7. Para escritório cliente consultar em nome dele, o CNPJ do escritório precisa estar cadastrado e a empresa cliente
   precisa ter dado **procuração no e-CAC** para esse CNPJ.

## 4. Como liberar a consulta ao Serpro para um escritório ou empresa

Só a conta administradora (você) vê este painel. Para os outros, ele some.

**Liberar uma empresa:**

1. Entre no Fisco IA com a sua conta de dono.
2. No menu da esquerda, clique em **"Integração SERPRO"** (ou fique na tela **"Início"**).
3. Desça até o bloco **"Consulta oficial (SERPRO / Receita Federal)"**.
4. Dentro dele, ache o quadro **"Liberar consultas do SERPRO por empresa"**.
5. No campo **"Buscar empresa, CNPJ ou escritório"**, digite o nome ou o CNPJ.
6. Na tabela, na linha da empresa, coluna **"Ação"**, clique em **"Liberar"**. Para desfazer, clique em **"Travar"**.
   Empresas que tentaram consultar e foram barradas aparecem marcadas como pedido de liberação.

**Liberar um escritório inteiro** (todas as empresas e todos os usuários dele, inclusive as que forem cadastradas depois):

1. No mesmo quadro, veja a parte **"Liberar um escritório inteiro"**.
2. Na linha do escritório, clique em **"Liberar escritório"** e confirme a pergunta.
3. Para voltar a valer empresa por empresa, clique em **"Travar"**.

Também é possível pedir à Agente IA ("ver liberações do Serpro", "liberar consulta da empresa X"); ela mostra um cartão
e só libera depois que você confirma.

**CNPJ do escritório**: para escritório cliente consultar, o CNPJ dele precisa estar cadastrado. O robô de empresas
preenche automaticamente quando o Murade Fiscal já tem o CNPJ (até a próxima rodada, a cada 10 minutos). O dono também
pode cadastrar à mão: no **"Painel MURADE"**, quadro **"Escritórios contratantes"**, na linha do escritório clique no botão
**"CNPJ do escritório"** (se já tiver CNPJ, o botão mostra "CNPJ" seguido do número), digite o CNPJ e confirme.

## 5. Excluir empresa (exclusão em cascata)

- Excluir uma empresa no Fisco IA **não apaga nada de verdade**: ela é **arquivada**. Notas, certificados e histórico
  ficam guardados.
- Depois de arquivar, o Fisco IA avisa o Murade Fiscal (o "hub"), que apaga a empresa no Fiscal, DP e Contábil.
- O caminho contrário também existe: se a empresa for excluída no Fiscal, o Fiscal manda o Fisco IA arquivar o CNPJ
  em todos os escritórios que o tenham.
- **Nenhum CNPJ fica bloqueado**: dá para cadastrar de novo depois.
- A exclusão é uma empresa por vez. Pela Agente IA ("apagar empresa"), ela mostra o cartão e só faz depois da confirmação.
- Se o aviso ao Fiscal falhar, o arquivamento no Fisco IA continua valendo e a tela mostra o motivo
  (por exemplo: "Apague a empresa também no Fiscal").
- Uma empresa arquivada pode ser restaurada (se não houver outra ativa com o mesmo CNPJ no escritório).

## 6. Os robôs e conferidores

Todos os robôs ficam no arquivo `server.ts` (e `src/server/sincronizacaoAutomatica.ts`). Nenhum deles consulta o Serpro.

| Robô | O que faz | De quanto em quanto tempo |
|---|---|---|
| Robô Sincronizador (Fiscal → Fisco IA) | Lê do Murade Fiscal as notas já guardadas e traz para o Fisco IA, uma empresa por vez. Não consulta a SEFAZ. | Confere a cada minuto; cada empresa a cada 61 minutos. Começa 90 s depois de ligar. |
| Robô de Empresas (Fiscal → Fisco IA) | Traz toda empresa do Fiscal para o escritório certo (e-mail do proprietário igual). Só cria o que falta; não altera nem reativa o que foi excluído. Preenche o CNPJ do escritório quando está vazio. | A cada 10 minutos (primeira vez 1 minuto depois de ligar). |
| Robô Mensageiro | Reenvia pedidos entre as Agentes dos sistemas Murade que não chegaram. | A cada 1 minuto. |
| Robô de Aviso de Cobranças (Serpro) | Às 20h (Brasília) manda por e-mail ao dono o resumo das consultas **cobradas** do dia. Só lê. | Confere a cada 10 minutos; envia na janela das 20h–21h. |
| Robô Conferidor de Segurança do Login | Confere as últimas 24 h do login (senhas erradas, bloqueios, códigos de emergência, se o dono tem o código ligado). Só lê. | A cada 2 horas. |
| Robô Conferidor das Liberações (Serpro) | Confere se alguma empresa usou o Serpro sem estar liberada e quantas esperam liberação. Só lê. | A cada 6 horas. |
| Robô Conferidor de Vencimento das Certidões | Avisa certidões vencidas ou que vencem em 7, 15 e 30 dias. Só lê. | A cada 6 horas. |
| Robô Conferidor de Exclusões (Fiscal ↔ Fisco IA) | Confere se empresa excluída num sistema ainda está ativa no outro. Só lê. | A cada 2 horas. |

**Como ver se os robôs estão funcionando:**

- Pergunte à Agente IA: **"como estão os robôs?"** (ela usa a ferramenta `status_robos`, que mostra cada robô, a última
  execução e o último erro).
- Ou veja os **Logs** no Render (seção 8). Os robôs escrevem linhas como `[Conferidor das certidões] ...`,
  `[empresas_fiscal] ...`, `[Segurança do login] ...`.
- Atenção: o estado dos robôs fica na memória do servidor. **Depois de reiniciar, os contadores voltam a zero.**

Como desligar robôs (sem mexer em código), pelas variáveis no Render:

- `FISCOIA_SYNC_AUTOMATICA` = `0` desliga o sincronizador de notas.
- `FISCOIA_EMPRESAS_FISCAL` = `0` desliga o robô de empresas (ele também não roda sem `MURADE_INTEGRATION_TOKEN`).

## 7. Como saber se o sistema está no ar

1. Abra no navegador: `https://murade-fisco-ia.onrender.com/api/health`
   - Se aparecer um texto com `"status":"ok"`, o servidor está respondendo.
   - `bancoPermanente` deve ser `conectado`. `chaveCriptografiaDados` deve ser `valida`.
2. Abra: `https://murade-fisco-ia.onrender.com/api/ready`
   - `"pronto": true` = banco conectado, migrações em dia e chave de criptografia válida.
   - `"pronto": false` = algo está faltando (veja a seção 11).
3. No Render, o serviço deve estar com a etiqueta **"Live"** (no ar).

## 8. Render passo a passo

Entre em `https://dashboard.render.com` com a sua conta.

**Achar o serviço:**

1. Na tela inicial (Dashboard), clique no serviço do Fisco IA (o ID é `srv-dbag3tdg1s2s73bvuisg`; o nome deve ser parecido com `murade-fisco-ia` — **conferir**).

**Ver erros (Logs):**

1. Dentro do serviço, no menu da esquerda, clique em **"Logs"**.
2. Use a caixa de busca do log para procurar palavras como `erro`, `Falha`, `Migração`, `serpro`.
3. Ao ligar, o sistema escreve: `Servidor Murade Fisco IA executando na porta ...` e, sobre o banco,
   `Migrações do banco em dia.` ou `As migrações não foram aplicadas; o sistema abre assim mesmo.`

**Reiniciar sem publicar código novo (Restart):**

1. Dentro do serviço, clique no botão **"Manual Deploy"** (canto superior direito).
2. Escolha **"Restart service"** e confirme. (O nome exato do botão pode mudar no Render — **conferir**.)
3. Reiniciar **derruba quem estiver usando** naquele momento. Avise antes quem estiver trabalhando no sistema.

**Publicar a versão mais nova do GitHub (Manual Deploy):**

1. Clique em **"Manual Deploy"** > **"Deploy latest commit"**.
2. Acompanhe em **"Events"** ou **"Logs"** até aparecer "Live".
3. Se der erro de build estranho, tente **"Manual Deploy"** > **"Clear build cache & deploy"**.

**Voltar para uma versão anterior (Rollback):**

1. No menu da esquerda, clique em **"Events"**.
2. Ache a publicação (deploy) que estava funcionando.
3. Clique no botão **"Rollback"** daquela linha e confirme.
4. Importante: o rollback volta o **código**, mas **não desfaz mudanças no banco** (migrações já aplicadas continuam).
   As migrações deste sistema foram escritas para não quebrar versões antigas, mas **conferir** caso a caso.
5. Depois do rollback, o próximo `git push` na `main` publica de novo o código mais novo (se o Auto-Deploy estiver ligado).

**Mudar uma variável de ambiente:**

1. No menu da esquerda, clique em **"Environment"**.
2. Clique em **"Edit"**, altere ou adicione a variável, e clique em **"Save Changes"** (o Render pode oferecer
   "Save, rebuild, and deploy"). Mudar variável **reinicia o sistema**.

## 9. Variáveis de ambiente (só os nomes)

Ficam no Render, em **Environment**. **Nunca** coloque valores neste manual, no Git ou em variável que começa com `VITE_`
(as `VITE_` vão parar no navegador, qualquer um vê).

**Banco de dados**

| Nome | Para que serve |
|---|---|
| `FISCOIA_PGHOST`, `FISCOIA_PGPORT`, `FISCOIA_PGDATABASE`, `FISCOIA_PGUSER`, `FISCOIA_PGPASSWORD` | Conexão do sistema ao banco com o usuário restrito `fiscoia_runtime`. |
| `FISCOIA_PGSSL` | `true` liga conexão segura (TLS) com o banco. |
| `FISCOIA_MIGRATION_DATABASE_URL` | Credencial administrativa usada **só** para aplicar as migrações ao ligar. Sem ela, as migrações automáticas ficam desligadas. |
| `DATABASE_URL` | Credencial administrativa. Só para provisionar o banco pela primeira vez e para desenvolvimento local. Em produção o sistema não usa. |
| `FISCOIA_DATA_ENCRYPTION_KEY` | Chave que cifra certificados, XMLs e credenciais guardadas. **Se perder, os dados cifrados não abrem mais.** Guardar cópia segura. |
| `FISCOIA_DATA_ENCRYPTION_KEY_VERSION` | Versão da chave acima. |

**Serpro**

| Nome | Para que serve |
|---|---|
| `SERPRO_PRODUCAO_CONSUMER_KEY`, `SERPRO_PRODUCAO_CONSUMER_SECRET` | Chaves do contrato Integra Contador do dono (produção). |
| `SERPRO_VALIDACAO_CONSUMER_KEY`, `SERPRO_VALIDACAO_CONSUMER_SECRET` | Chaves do ambiente de validação (teste de autenticação). |
| `SERPRO_CONTRATANTE_CNPJ` | CNPJ do escritório contratante do Serpro. |
| `SERPRO_CERT_PFX_BASE64` | Certificado e-CNPJ do escritório contratante, em texto Base64 (seção 10). |
| `SERPRO_CERT_PFX_SENHA` | Senha desse certificado. |
| `SERPRO_CONSULTAS_HABILITADAS` | Interruptor geral das consultas pagas. Só funciona com `true`. |
| `SERPRO_DCTFWEB_TRANSMISSAO_HABILITADA` | Interruptor da transmissão da DCTFWeb. Só funciona com `true`. |
| `SERPRO_CND_BASE_URL`, `SERPRO_CND_TOKEN_URL`, `SERPRO_CND_CONSUMER_KEY`, `SERPRO_CND_CONSUMER_SECRET` | Produto "Consulta CND" do Serpro (CND federal). Só aceita endereços `https` do `serpro.gov.br`. Sem elas, a tela diz "não configurada". |

**Ligação com os outros sistemas Murade**

| Nome | Para que serve |
|---|---|
| `MURADE_INTEGRATION_TOKEN` | Senha comum entre os sistemas Murade (precisa ser igual no Fiscal, DP e Fisco IA). Sem ela, robôs de integração, ponte do Serpro e exclusão em cascata não funcionam. |
| `MURADE_FISCAL_SERVER_URL` | Endereço do Murade Fiscal usado na sincronização de notas e na conferência. |
| `MURADE_FISCAL_URL`, `MURADE_DP_URL`, `MURADE_CONTABIL_URL`, `MURADE_FISCOIA_URL` | Endereços dos sistemas para a conversa entre Agentes, exclusão em cascata e licença (DP). Se faltarem, o código usa endereços padrão `*.onrender.com`. |
| `VITE_MURADE_FISCAL_URL`, `VITE_MURADE_CONTABIL_URL`, `VITE_MURADE_DP_URL` | Endereços públicos que aparecem nos botões "Módulos Murade" (vão para o navegador; nunca colocar segredo). |
| `FISCOIA_OIDC_CLIENTS_JSON` | Configuração do acesso único (SSO) entre sistemas. Ver `docs/SSO_MULTISSISTEMA.md`. |

**Inteligência artificial e voz**

| Nome | Para que serve |
|---|---|
| `GEMINI_API_KEY` | Chave do Google Gemini (Agente IA e assistente fiscal). Sem ela a Agente fica indisponível. |
| `GEMINI_MODEL_RAPIDO` | Modelo rápido da Agente; `desligado` desliga o modelo rápido. |
| `GEMINI_TTS_MODEL` | Modelo de voz do Gemini. |
| `VOZ_PREMIUM` | `ligada` permite a voz premium (gasta a chave). Sem isso, usa a voz do navegador. |
| `ELEVENLABS_API_KEY` | Voz da ElevenLabs (tela "IA Murade Voz Natural"). |

**E-mail e avisos**

| Nome | Para que serve |
|---|---|
| `EMAIL_FROM` | Remetente dos e-mails. |
| `RESEND_API_KEY` | Envio de e-mail pelo serviço Resend. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Envio de e-mail por SMTP (alternativa ao Resend). |
| `EMAIL_LIMITE_DIARIO` | Limite de e-mails por dia (padrão 300) para um robô com defeito não mandar e-mail sem parar. |
| `MURADE_AVISO_EMAIL` | Para onde vai o resumo diário das cobranças do Serpro. |
| `MURADE_DONO_SISTEMA` | Usado como reserva para achar o e-mail do dono no aviso de cobranças. |

**Login e segurança**

| Nome | Para que serve |
|---|---|
| `APP_URL` | Endereço público do sistema, usado para montar links de convite e de senha. |
| `FISCOIA_CHAVE_RECUPERACAO` | Frase secreta (mínimo 16 caracteres) para recuperar a conta administradora. Sem ela, essa recuperação fica desligada. |
| `MURADE_2FA_OBRIGATORIO_DONO` | Com `nao`, o dono deixa de ser obrigado a ter o código de segurança. Padrão: obrigatório. |
| `FISCOIA_BOOTSTRAP_EMAIL`, `FISCOIA_BOOTSTRAP_NAME`, `FISCOIA_BOOTSTRAP_PASSWORD` | Só para criar a primeira conta administradora uma única vez. Já foi feito; não deixar cadastradas. |

**Outras**

| Nome | Para que serve |
|---|---|
| `FISCOIA_SEFAZ_DFE_ENV` | Ambiente da consulta DF-e da SEFAZ (`producao` padrão ou `homologacao`). |
| `FISCOIA_SYNC_AUTOMATICA` | `0` desliga o robô sincronizador de notas. |
| `FISCOIA_EMPRESAS_FISCAL` | `0` desliga o robô de empresas do Fiscal. |
| `NODE_ENV`, `PORT` | Configuração técnica do servidor (o Render define a porta). |

O arquivo `.env.example` ainda lista `VITE_APP_NAME`, `VITE_APP_ADMIN`, `VITE_MAX_EMPRESAS`, `VITE_PLANO_*`,
`VITE_VIACEP_URL`, `VITE_SERPRO_WS`, `VITE_CAIXA_SEFIP_WS`, `VITE_DIAS_AVISO_VENCIMENTO`, `VITE_DIAS_BLOQUEIO_AUTOMATICO`:
não achei uso delas no código atual — **conferir** antes de apagar.

## 10. Certificado do Serpro (e-CNPJ do escritório)

- O Integra Contador exige o **certificado e-CNPJ A1 do escritório contratante** (arquivo `.pfx` ou `.p12`) além das chaves.
- No Render, o certificado vai na variável `SERPRO_CERT_PFX_BASE64` como texto Base64, e a senha em `SERPRO_CERT_PFX_SENHA`.
- Como transformar o arquivo em Base64 (no seu computador, sem enviar para ninguém):
  - Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\caminho\certificado.pfx"))`
  - Linux/Mac: `base64 -w0 certificado.pfx` (no Mac: `base64 -i certificado.pfx`)
  - Copie o resultado inteiro e cole no valor da variável. Espaços e quebras de linha são ignorados pelo sistema.
- Certificados antigos (formato que o Node recusa) são convertidos automaticamente pelo sistema.
- **Testar sem gastar**: na tela "Integração SERPRO", o dono pode usar o teste de autenticação (rota `/api/serpro/token-check`).
  Em produção, com certificado configurado, ele autentica no Integra Contador e diz "Nenhuma consulta paga foi feita".
- **Quando o certificado vencer**: gere o Base64 do certificado novo, troque as duas variáveis no Render (Environment),
  salve (o sistema reinicia) e rode o teste de autenticação.
- Escritório cliente com contrato próprio: as credenciais dele (chaves, CNPJ, certificado e senha) são enviadas pelo DP
  e ficam **cifradas** no banco, tabela `fiscoia.serpro_credenciais_escritorio`. Nunca são mostradas de volta.

## 11. Problemas comuns e o que fazer

| Mensagem ou sintoma | Causa provável (pelo código) | O que fazer |
|---|---|---|
| **"Não foi possível conferir a credencial do escritório agora. Nada foi consultado nem cobrado."** | O sistema não conseguiu ler a tabela de credenciais dos escritórios (`fiscoia.serpro_credenciais_escritorio`). Antes da migração 025 essa tabela não existia/sem permissão; também acontece se o banco estiver fora. | 1) Abra `/api/health` e veja se o banco está `conectado`. 2) Nos Logs do Render, procure `Migração 025`. 3) Se não aplicou, confira se `FISCOIA_MIGRATION_DATABASE_URL` está cadastrada e reinicie (Restart). 4) Se continuar, chame um programador (seção 17). |
| "Consultas pagas desligadas neste sistema." | `SERPRO_CONSULTAS_HABILITADAS` não é `true`. | Ajustar a variável no Render (só se quiser ligar as consultas pagas). |
| "Integração SERPRO ainda não está completa." / "Ainda falta configurar no Render" | Falta chave, CNPJ contratante, certificado ou interruptor. | A própria tela lista o que falta. Cadastrar as variáveis (seção 9). |
| "SERPRO recusou a autenticação do escritório (chaves ou certificado)." | Chaves erradas, de outro produto, ou certificado que não é do contratante. | Conferir as chaves na Área do Cliente do Serpro e o certificado; usar o teste de autenticação. |
| "O certificado do escritório no servidor não pôde ser aberto (senha ou formato)." | Base64 incompleto ou senha errada. | Gerar o Base64 de novo e conferir a senha. |
| "A consulta ao Serpro ainda não foi liberada para esta empresa." | Empresa travada. | Liberar no painel (seção 4). |
| "Não foi possível conferir se a consulta ao Serpro está liberada para esta empresa." | Banco fora ou migração 017/021 ausente. | Ver `/api/ready` e Logs. |
| "O CNPJ do escritório ainda não foi cadastrado..." | Escritório cliente sem CNPJ. | Esperar o robô de empresas (até 10 min) ou cadastrar o CNPJ do escritório como dono. |
| "Contrate o Integra Contador com o e-CNPJ do seu escritório e informe as credenciais." | Escritório não liberado pelo dono e sem credencial própria. | Liberar o escritório (usa o plano do dono) ou o escritório cadastra a credencial própria pelo DP. |
| "O SERPRO negou o acesso: confira a procuração do cliente no e-CAC." | Falta procuração do cliente para o escritório. | Cliente faz a procuração no e-CAC (o código da procuração aparece para cada serviço). |
| Erro sobre "token do procurador" / "autorizar a consulta em nome do escritório" | O Fiscal não entregou o token do procurador (certificado/termo do escritório fica no Fiscal). | Conferir no Murade Fiscal o certificado e o Termo de Autorização do escritório; conferir `MURADE_INTEGRATION_TOKEN` igual nos dois. |
| `/api/ready` com `"pronto": false` | Banco desconectado, migrações faltando ou chave de criptografia inválida. | Ver o campo que está errado na própria resposta; Logs; variáveis `FISCOIA_PG*` e `FISCOIA_DATA_ENCRYPTION_KEY`. |
| "Agente indisponível: configure GEMINI_API_KEY no servidor." | Falta a chave do Gemini. | Cadastrar `GEMINI_API_KEY`. |
| "Não foi possível falar com o serviço de IA agora." | Gemini fora ou modelo indisponível. | Tentar de novo; ver Logs ("Modelo rápido da Agente IA falhou"). Os nomes de modelo estão em `server.ts` — **conferir** se ainda existem no Google. |
| Resumo de cobranças não chega por e-mail | E-mail não configurado ou limite diário atingido. | Ver `EMAIL_FROM`, `RESEND_API_KEY` ou `SMTP_*`, `MURADE_AVISO_EMAIL`; nos Logs procurar `[e-mail] BLOQUEADO`. |
| CND federal: "ainda não foi contratada/configurada neste servidor" | Faltam as variáveis `SERPRO_CND_*`. | Contratar o produto "Consulta CND" na Loja Serpro e cadastrar as variáveis. Enquanto isso, emitir pelo portal da Receita. |
| Empresa não aparece no Fisco IA | O robô de empresas só liga o escritório do Fiscal ao escritório do Fisco IA cujo proprietário tem o **mesmo e-mail**; empresa em dois escritórios clientes fica de fora. | Conferir o e-mail do proprietário nos dois sistemas. O dono pode rodar o robô na hora (rota `/api/robos/empresas-fiscal/rodar`, só dono) e ver os avisos. |
| Esqueceu a senha da conta administradora | — | Tela "Esqueci a senha" usa `FISCOIA_CHAVE_RECUPERACAO` (precisa estar cadastrada no Render). |
| Perdeu o celular do código de segurança | — | Pedir à Agente IA "redefinir código do usuário" (o dono confirma) ou usar um código de emergência. |

---

# PARTE 2 — Para o programador

## 12. Tecnologias (stack)

- **Node.js** (testado com v22) + **TypeScript**.
- Servidor: **Express 4** (`server.ts`), rodado em desenvolvimento com `tsx` e em produção empacotado com **esbuild**
  em `dist/server.cjs`.
- Tela: **React 19** + **Vite 6** + **Tailwind CSS 4**, ícones `lucide-react`. Em produção o Express serve `dist/`.
  É PWA instalável (`public/manifest.webmanifest`, `public/sw.js`).
- Banco: **PostgreSQL** via `pg`, schema `fiscoia`, com RLS.
- IA: `@google/genai` (Gemini). Voz: Gemini TTS e ElevenLabs.
- Certificados: `node-forge` e `xml-crypto` (assinatura da DCTFWeb).
- E-mail: `nodemailer` (SMTP) ou Resend.
- Testes: `node --test` rodado por `tsx --test`.
- Gerenciador: `npm` (`package-lock.json`). Existe também `bun.lock` — **conferir** se ainda é usado.

## 13. Pastas e arquivos importantes

```
server.ts                      Servidor: rotas gerais, Agente IA, robôs, health/ready
src/server/                    Rotas e regras do servidor
  auth.routes.ts               Login, sessão, usuários, escritórios contratantes, 2FA, recuperação
  tenant.routes.ts             Escritórios, empresas, exclusão (arquivar) e ponte de exclusão por CNPJ
  serpro.routes.ts             Tudo do Serpro: prontidão, consulta, cota, consumo, liberações, pontes, DCTFWeb, credenciais
  certidoes.routes.ts          Certidões (CND)
  sefazDistribution.routes.ts  Distribuição DF-e da SEFAZ
  companyCertificate.routes.ts Cofre do certificado A1 da empresa
  fiscalDocuments.routes.ts    Notas guardadas
  fiscalSourceSync.routes.ts   Sincronização manual Fiscal → Fisco IA
  conferencia.routes.ts        Radar (Fisco IA × Fiscal)
  reforma.routes.ts            Cenários da Reforma Tributária
  licenca.routes.ts            Lê a licença da empresa no DP
  sso.routes.ts                Acesso único (OIDC)
  persistence.ts               Conexão ao banco e comContextoTenant (RLS)
  encryption.ts                Cifra AES-256-GCM com FISCOIA_DATA_ENCRYPTION_KEY
  pfxCompat.ts                 Leitura/conversão de certificados .pfx
  robosStatus.ts               Registro e estado dos robôs
  sincronizacaoAutomatica.ts   Robô sincronizador
  empresasDoFiscal.ts          Robô de empresas
  exclusaoEmpresa.ts           Cascata de exclusão e conferidor
  conferidorCertidoes.ts / conferidorLiberacoesSerpro.ts / avisoCobrancas.ts
  agenteMotor.ts               Motor da Agente IA (igual nos sistemas Murade)
  agenteFiscoIA.ts             Ferramentas da Agente do Fisco IA
  agentesEntreSistemas.ts      Conversa entre Agentes, URLs dos sistemas, tokenValido
  ferramentasEntreSistemas.ts  Ferramentas de perguntar/pedir a outro sistema
  tokenProcuradorFiscal.ts     Pede ao Fiscal o token do procurador
  segurancaLogin.ts / segurancaFiscoIA.ts  Limite de tentativas, 2FA, barreira do dono
  emailMurade.ts               Envio de e-mail com limite diário
src/services/serpro/           Regras puras do Serpro (catálogo, cota, consumo, liberação, credenciais, DCTFWeb)
src/services/certidoes/        Regras das certidões e cliente da Consulta CND
src/screens/, src/components/  Telas React
db/migrations/                 Migrações SQL numeradas (001 a 025)
scripts/                       migrate, migrar-se-configurado, bootstrap-admin, provision-shared-postgres
docs/                          Documentos técnicos (este manual e outros)
fiscoia-v1/, public/fiscoia-v1 Versão antiga (legada) servida em /fiscoia-v1
AUDITORIA_FLUXOS_FISCAIS.md    Auditoria antiga dos fluxos
```

## 14. Rodar no computador (local)

1. Instalar Node.js 22.
2. Na pasta do projeto: `npm ci`
3. Criar um arquivo `.env` (nunca vai para o Git; ver `.gitignore`) com base no `.env.example`.
   Para desenvolvimento, sem `FISCOIA_PG*`, o servidor usa `DATABASE_URL` (só fora de produção).
   **Use um banco de teste, nunca o de produção.**
4. Aplicar migrações no banco de teste: `npm run db:migrate` (usa `FISCOIA_MIGRATION_DATABASE_URL`).
   O script concede permissões ao papel `fiscoia_runtime`; ele precisa existir (ver `npm run db:provision-shared-role`).
5. Rodar: `npm run dev` → abre em `http://localhost:3000` (Vite em modo middleware dentro do Express).
6. Build de produção: `npm run build` e depois `npm start`.

## 15. Testes

| Comando | O que testa | Situação em 20/11/2026 |
|---|---|---|
| `npm run test:agentes` | Agente IA, entre sistemas, empresas do Fiscal, exclusão, CNPJ do escritório | 55 testes, 53 passam, 2 pulados (precisam de `DATABASE_URL` de teste) |
| `npm run test:seguranca` | Login, 2FA, barreira do dono, sessão expirada | 18 testes, 14 passam, 4 pulados (precisam de `DATABASE_URL`/`TEST_DATABASE_URL`) |
| `npm run test:serpro` | Catálogo, cota, consumo, liberação, credenciais, DCTFWeb, parcelamentos, e-mail | 89 passam |
| `npm run test:certidoes` | Certidões e conferidor | 20 passam |
| `npm run test:voltar` | Botão voltar do celular | 11 passam |
| `npm run test:protocol` | Protocolo da Distribuição DF-e da SEFAZ | não rodado neste levantamento — **conferir** |
| `npm run lint` (`tsc --noEmit`) | Tipos | **2 erros antigos** em `src/components/ConsultaRealSerpro.tsx` (linhas 134 e 135, propriedade `key` em `CotaConsultasSerpro` e `ConsumoSerproMensal`). Não impedem o build (o Vite não checa tipos). |

Rode os testes antes de cada publicação. Os testes do Serpro **não** chamam o Serpro de verdade.

## 16. Publicar (deploy)

- Build no Render: `npm ci && npm run build`. Start: `npm start` (segundo `docs/DEPLOY_FISCO_IA_RENDER.md`; **conferir** em Settings no Render).
- `npm start` = `node scripts/migrar-se-configurado.mjs && node dist/server.cjs`: primeiro tenta aplicar migrações,
  depois liga o servidor. Se a migração falhar, o sistema **abre assim mesmo** e escreve o motivo no log.
- **Push na `main` = deploy automático** (Auto-Deploy do Render).
- Para enviar só documentação sem reiniciar o sistema, coloque **`[skip render]`** na mensagem do commit
  (o Render pula o deploy desse commit).
- Todo deploy reinicia o servidor e derruba quem está usando: evite publicar enquanto alguém está trabalhando no sistema.
- Health check: `/api/health`. Prontidão: `/api/ready`.

## 17. Banco de dados, migrações, RLS e o papel fiscoia_runtime

**Migrações** (`db/migrations/NNN_nome.sql`):

- Rodam por `scripts/migrate.mjs`, em ordem, numa única transação, com trava (`pg_advisory_xact_lock`).
- Cada migração aplicada fica em `fiscoia.schema_migrations` com o **checksum** (SHA-256). **Nunca edite uma migração
  já aplicada**: o script recusa ("já foi aplicada com outro checksum") e nada roda. Para mudar algo, crie a próxima (`026_...`).
- Ao iniciar (`npm start`), `scripts/migrar-se-configurado.mjs` só roda as migrações se `FISCOIA_MIGRATION_DATABASE_URL`
  estiver cadastrada (tempo máximo 60 s). Obs.: o documento antigo `docs/DEPLOY_FISCO_IA_RENDER.md` recomendava não
  deixar essa variável no serviço web; o funcionamento atual (migração automática ao iniciar) depende dela — **conferir** a decisão.
- Depois das migrações, o script concede ao `fiscoia_runtime`: uso do schema, SELECT/INSERT/UPDATE/DELETE nas tabelas,
  uso das sequências; e **retira** acesso a `schema_migrations` (só leitura), às tabelas do limitador global da SEFAZ e a
  `serpro_company_gate` (só por funções).
- `/api/ready` só confere as migrações 001 a 012 (lista `MIGRACOES_ESPERADAS` em `src/server/persistence.ts`).
  As de 013 em diante não entram nessa conferência — **conferir** se deve ser ampliada.
- Resumo das migrações:
  001 base multiempresa (usuários, sessões, escritórios, membros, empresas, notas, auditoria, RLS) · 002 perfil de conta ·
  003 arquivar empresas (CNPJ pode voltar) · 004/005 Reforma · 006 criação de escritórios · 007 cofre do A1 ·
  008/009/010 Distribuição DF-e e limite por CNPJ · 011 SSO · 012 escritórios contratantes do dono · 013 limite de usuários ·
  014 atividade da equipe · 015 excluir escritório/conta sem bloquear e-mail · 016 CNPJ do escritório ·
  017 trava do Serpro por empresa · 018 segurança do login · 019 nome/saudação da Agente · 020 escritório liberado por inteiro ·
  021 correção das funções de liberação (RLS) · 022 exclusão em cascata · 023 CNPJ do escritório vindo do Fiscal ·
  024 certidões · 025 tabela de credenciais Serpro por escritório.

**RLS (Row Level Security)** — isolamento por escritório:

- O sistema conecta com o usuário **`fiscoia_runtime`**, que não é dono das tabelas e não pode criar tabelas (sem DDL).
- `comContextoTenant(userId, tenantId, operação, papeis)` em `persistence.ts`: abre transação, grava `app.user_id`,
  confere se o usuário é membro do escritório (e o papel, ex.: `OWNER`/`ADMIN`), grava `app.tenant_id` e só então roda a operação.
  As políticas RLS usam esses dois valores. `companies`, `fiscal_documents` e `audit_events` usam `FORCE ROW LEVEL SECURITY`.
- O que precisa enxergar vários escritórios (painel do dono, liberação do Serpro, arquivar por CNPJ, conferidores)
  passa por **funções `SECURITY DEFINER`** no banco (ex.: `fiscoia.platform_list_serpro_gate`,
  `fiscoia.serpro_company_released`, `fiscoia.platform_archive_companies_by_cnpj`), que devolvem só o necessário.
- Tabela nova: crie pela migração (o runtime não consegue criar). Esse foi exatamente o defeito corrigido pela 025.
- Provisionamento inicial (já feito): `npm run db:provision-shared-role` com `DATABASE_URL` administrativa cria o schema e os papéis.
- Backup do banco: ver `docs/OPERACAO_BACKUP_POSTGRES_RENDER.md`.

## 18. Integração Serpro (Integra Contador e Consulta CND)

Arquivos principais:

- `src/services/serpro/integraContador.ts`: `CATALOGO_SERVICOS` (cada serviço com idSistema, idServico, versão,
  operação Consultar/Emitir/Apoiar/Declarar/Monitorar, campos e procuração exigida), `montarPedido`, validações de
  dados, `avaliarProntidao` (lista o que falta no ambiente). Para incluir serviço novo: adicionar no catálogo
  seguindo a documentação oficial do Serpro e criar teste.
- `src/services/serpro/credenciaisEscritorio.ts`: escolhe a credencial (`decidirFonteCredencial`): `global` (do dono,
  vinda do ambiente) ou `propria` (do escritório, cifrada na tabela `fiscoia.serpro_credenciais_escritorio`,
  com `criptografarCredencialEscritorio`). Nunca devolve o conteúdo.
- `src/server/serpro.routes.ts` (montado em `/api/serpro`):
  - `executarConsulta`: valida serviço e dados → confere liberação (escritório inteiro, empresa, login do escritório) →
    `resolverCredencial` → cota (`cotaSemanal.ts`) → token do procurador no Fiscal quando o autor é escritório cliente →
    autentica com mTLS em `autenticacao.sapi.serpro.gov.br/authenticate` (Role-Type `TERCEIROS`) → **reserva a consulta
    com trava de linha** → chama `gateway.apiserpro.serpro.gov.br/integra-contador/v1/<operacao>`.
    Situação fiscal tem duas etapas (protocolo e depois o PDF, com até 3 tentativas).
  - Rotas para a tela: `/prontidao`, `/consultas/:companyId`, `/consumo` (dono), `/liberacoes`, `/liberacoes/escritorios`,
    `/consulta`, `/config-status` e `/token-check` (dono).
  - Rotas "ponte" (outros sistemas, com `MURADE_INTEGRATION_TOKEN`): `/ponte/cota`, `/ponte/liberacao`, `/ponte/consulta`,
    `/ponte/uso` (o Fiscal registra uso que ele mesmo fez; evita contar duas vezes pelo `idUso`),
    `/ponte/dctfweb/transmitir` (fases `preparar` e `confirmar`, XML guardado em memória 15 min, assinatura, uso único),
    `/ponte/escritorio/status`, `/ponte/escritorio/credenciais`, `/ponte/escritorio/credenciais/remover`, `/status-integracao`.
- Consumo e cobrança: `consumoSerpro.ts` (ciclo 21→20, valores). Os registros de consulta ficam em
  `companies.metadata.serproCota` (JSON), não em tabela própria.
- Consulta CND: `src/services/certidoes/consultaCndFederal.ts` + `src/server/certidoes.routes.ts`. Produto separado,
  variáveis `SERPRO_CND_*`, mesma trava de liberação e confirmação de custo; certidões na tabela `fiscoia.certidoes`.
- Mais detalhes e fontes oficiais: `docs/INTEGRACAO_SERPRO.md`.

**Regra que nunca pode mudar:** nenhuma rotina automática (robô, `setInterval`) pode chamar `executarConsulta`,
a Consulta CND ou qualquer endpoint pago. Só rota disparada por pessoa, com confirmação.

## 19. Agente IA (Gemini)

- Rotas em `server.ts`: `POST /api/ai/agente` (conversa), `/api/ai/agente/confirmar`, `/api/ai/agente/recusar`,
  `/api/ai/agente/saudacao`, `/api/ai/agente/nome`. Exigem sessão e mesma origem; limite de 40 pedidos por 10 minutos
  por sessão; texto até 30.000 caracteres.
- Motor: `src/server/agenteMotor.ts` (o mesmo nos sistemas Murade). A IA **não acessa o banco**: cada ferramenta chama
  uma rota interna com a sessão do usuário (`chamarApiComoUsuario`), então as mesmas permissões valem.
  Consultas rodam na hora; **alterações viram ação pendente** que a pessoa confirma no cartão.
- Ferramentas do Fisco IA (`agenteFiscoIA.ts`): `listar_escritorios`, `listar_empresas`, `conferir_periodo`,
  `status_sefaz_dfe`, `status_certificado`, `resumo_documentos`, `ver_liberacoes_serpro`, `liberar_consulta_serpro`,
  `apagar_empresa`, `ver_certidoes_vencendo`, `consultar_certidao`, `seguranca_login`, `redefinir_codigo_usuario`,
  `status_robos`, `consultar_legislacao`. Entre sistemas (`ferramentasEntreSistemas.ts`): `perguntar_a_outro_sistema`,
  `pedir_a_outro_sistema`, `ver_pedidos_entre_sistemas`, `responder_pedido_de_outro_sistema`.
- Modelos: rápido `GEMINI_MODEL_RAPIDO` (padrão no código `gemini-3.1-flash-lite`, 20 s), e reserva `gemini-3.8-flash`.
  Assistente fiscal (`/api/ia-fiscal/consultar`) usa `gemini-3.6-flash` e `gemini-3.8-flash` com pesquisa Google.
  **Conferir** se esses nomes de modelo continuam válidos no Google; se mudar, alterar em `server.ts`.
- Saudação do dia: regra fixa, sem IA (migração 019).

## 20. Ligação com Fiscal, DP e Contábil

Todas as chamadas entre sistemas usam o cabeçalho `Authorization: Bearer <MURADE_INTEGRATION_TOKEN>`, conferido com
`tokenValido` (comparação de tempo constante). URLs em `urlDoSistema` (`agentesEntreSistemas.ts`).

| Direção | Para quê | Onde no código |
|---|---|---|
| Fisco IA → Fiscal `GET /api/integracao/fiscal/empresas` | Robô de empresas | `empresasDoFiscal.ts` |
| Fisco IA → Fiscal `/api/integracao/fiscal/documentos` | Sincronizador de notas e conferência | `sincronizacaoAutomatica.ts`, `fiscalSourceSync.routes.ts`, `conferencia.routes.ts` |
| Fisco IA → Fiscal `DELETE /api/integracao/empresa/:cnpj` | Exclusão em cascata (o Fiscal repassa a DP e Contábil) | `exclusaoEmpresa.ts` |
| Fiscal → Fisco IA `DELETE /api/integracao/empresa/:cnpj` | Arquivar aqui o que foi excluído lá | `tenant.routes.ts` |
| Fisco IA → Fiscal `POST /api/integracao/serpro/token-procurador` | Token do procurador do escritório cliente | `tokenProcuradorFiscal.ts` |
| Fiscal/DP → Fisco IA `/api/serpro/ponte/*` | Consulta, liberação, uso, DCTFWeb e credenciais do Serpro centralizados aqui | `serpro.routes.ts` |
| Fisco IA → DP `GET /api/integracao/licenca` | Licença da empresa | `licenca.routes.ts` |
| Agentes ↔ Agentes `POST /api/integracao/agente/mensagem` | Pedidos entre as Agentes IA (com reenvio pelo Robô Mensageiro) | `server.ts`, `agentesEntreSistemas.ts` |
| Contábil | Só pela conversa entre Agentes, pela cascata via Fiscal e pelo link em "Módulos Murade". Não achei rota direta ao Contábil além disso — **conferir**. |

Fluxos que não podem falhar (Fiscal → Fisco IA de empresas e notas, exclusões): têm robô **e** conferidor.
Toda função nova deve ganhar rotina de robô e de conferidor no mesmo padrão (`registrarRobo` + `executarRobo` em `server.ts`).

## 21. Segurança do login

- Senhas com hash PBKDF2 (comentário da migração 002). Sessão por cookie `fiscoia_session`.
- Migração 018: tentativas erradas gravadas no banco, 2FA por aplicativo no celular, aparelho confiável, eventos mascarados.
- Barreira do dono (`segurancaFiscoIA.ts`): a conta administradora sem código de segurança só consegue ligar o código ou
  sair, a não ser que `MURADE_2FA_OBRIGATORIO_DONO=nao`. Depende de `FISCOIA_DATA_ENCRYPTION_KEY` válida e da migração 018.
- Cabeçalhos de proteção básicos em `server.ts` (sem CSP de propósito, ainda não testada).
- Escritório excluído/conta excluída: os registros são apagados e o e-mail pode ser convidado de novo (migração 015).

## 22. Lista de itens "conferir"

1. ✅ Conferido no Render em 20/11/2026: endereço público `https://murade-fisco-ia.onrender.com` (serviço `murade-fisco-ia`, plano pago 0.5 CPU / 512 MB, região Oregon).
2. ✅ Conferido em 20/11/2026: o Render acompanha `https://github.com/noslynedaam-lgtm/murade-fisci-ia-app`, branch `main`, publicação automática a cada commit (o doc antigo está desatualizado).
3. Nomes exatos dos botões do Render ("Restart service", "Rollback") — o Render muda a interface às vezes.
4. Custos do Serpro anotados no código (R$ 0,24 / 0,32 / 0,40) e o preço do serviço "Monitorar" (marcado como "A CONFIRMAR" no código) contra a fatura real.
5. Itens do catálogo Integra Contador marcados como "pendente de confirmar no primeiro teste real" em `integraContador.ts`.
6. Decisão sobre manter `FISCOIA_MIGRATION_DATABASE_URL` no serviço web (necessária para a migração automática, mas o doc antigo desaconselhava).
7. `/api/ready` só confere as migrações 001–012.
8. Variáveis `VITE_*` do `.env.example` que não aparecem no código.
9. Se o `bun.lock` ainda é usado.
10. Nomes dos modelos Gemini usados em `server.ts`.
11. `npm run test:protocol` não foi rodado neste levantamento.
12. Ligação direta com o Contábil (não encontrada além das citadas na seção 20).
13. ✅ Conferido em 20/11/2026: build `npm ci && npm run build`, start `npm start`.
