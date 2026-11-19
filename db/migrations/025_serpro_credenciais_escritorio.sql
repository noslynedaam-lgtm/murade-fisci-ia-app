-- Credencial do Serpro de cada escritório (guardada cifrada). A tabela era criada pelo próprio aplicativo na hora,
-- mas o papel de execução não tem permissão de criar tabelas: toda consulta de escritório cliente caía em
-- "Não foi possível conferir a credencial do escritório". Agora ela nasce aqui, pela migração, com as permissões certas.
CREATE TABLE IF NOT EXISTS fiscoia.serpro_credenciais_escritorio (
  escritorio_id text PRIMARY KEY,
  contratante_cnpj text NOT NULL,
  segredo bytea NOT NULL,
  nonce bytea NOT NULL,
  auth_tag bytea NOT NULL,
  key_version text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscoia_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON fiscoia.serpro_credenciais_escritorio TO fiscoia_runtime;
  END IF;
END $$;
