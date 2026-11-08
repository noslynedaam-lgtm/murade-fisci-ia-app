-- Agente IA: nome de tratamento da pessoa e data da última saudação do dia (uma saudação por dia, regra fixa, sem chamar IA).
-- Sem esta migração o sistema continua igual: a Agente apenas não saúda e não grava o nome.
-- Não precisa de GRANT novo: fiscoia_runtime já tem SELECT/UPDATE na tabela fiscoia.users inteira (as colunas novas herdam).
ALTER TABLE fiscoia.users ADD COLUMN IF NOT EXISTS nome_tratamento text;
ALTER TABLE fiscoia.users ADD COLUMN IF NOT EXISTS ultima_saudacao date;
