# Consulta da Distribuição DF-e da SEFAZ

O serviço consulta a Distribuição DF-e nacional para o CNPJ da empresa selecionada. O A1 é recuperado e decifrado somente no backend dentro do tenant; a tela nunca recebe o certificado nem a senha. O botão exige confirmação explícita a cada consulta e não transmite NF-e, eventos ou manifestação ao portal.

## Requisitos de implantação

1. Aplicar as migrações privadas até `008_sefaz_dfe_distribution` por meio de `FISCOIA_MIGRATION_DATABASE_URL`; não configurar credencial administrativa no serviço web público.
2. Manter `FISCOIA_PG*` limitado ao papel runtime do schema `fiscoia` e `FISCOIA_DATA_ENCRYPTION_KEY` válida no serviço.
3. O usuário vincula o certificado A1 à empresa. O cadastro só confirma que o arquivo PKCS#12 abriu com a senha informada; a SEFAZ só é validada quando uma consulta real retorna uma resposta oficial.
4. `FISCOIA_SEFAZ_DFE_ENV` aceita `producao` (padrão) ou `homologacao`. A tela mostra o ambiente e pede confirmação antes da chamada.

## Cursor, documentos e eventos

- Uma consulta usa o último `ultNSU` retornado pela SEFAZ. O cursor e os XMLs são gravados na mesma transação do tenant; erro de transporte, XML inválido ou falha de persistência não avança o cursor.
- Os XMLs `docZip`, inclusive eventos, ficam cifrados em `fiscal_dfe_items`, idempotentes por empresa/NSU. NF-e só é estruturada em `fiscal_documents` quando modelo, chave válida e CNPJ participante estão explícitos. Valores ausentes continuam nulos e aguardam conferência.
- Resposta `cStat=137` ou `656` bloqueia novas consultas por uma hora, seguindo a orientação da documentação da SEFAZ para evitar consumo indevido.
- A distribuição retorna documentos de interesse do ator, conforme disponibilidade e regras oficiais. Ela não é fonte de notas emitidas pela própria empresa; para saída do emitente, usar o ERP/emissor ou fonte autorizada.

## Limites atuais

A consulta está sob demanda; nenhum Cron Job é ativado nesta etapa. Não foi executada chamada real porque ela exige certificado empresarial válido armazenado neste ambiente e confirmação do operador. O arquivo recebido pela distribuição ainda exige revisão fiscal; o armazenamento e a deduplicação não equivalem a escrituração aprovada.
