-- Segurança de login: limite de tentativas gravado no banco, código de segurança (2FA por app no celular),
-- aparelho confiável e registro de eventos (login mascarado). Sem RLS: não guarda dado de cliente, só metadados de acesso.
CREATE TABLE IF NOT EXISTS fiscoia.seg_login_falhas (chave text PRIMARY KEY, tentativas integer NOT NULL DEFAULT 0, ate timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS fiscoia.seg_eventos_seguranca (id bigserial PRIMARY KEY, quando timestamptz NOT NULL DEFAULT now(), tipo text NOT NULL, login text, ip text);
CREATE INDEX IF NOT EXISTS seg_eventos_seguranca_quando_idx ON fiscoia.seg_eventos_seguranca(quando DESC);
CREATE TABLE IF NOT EXISTS fiscoia.seg_2fa (user_id text PRIMARY KEY, segredo_cifrado text NOT NULL, ativo boolean NOT NULL DEFAULT false, ultimo_passo bigint, emergencia text[] NOT NULL DEFAULT '{}', criado_em timestamptz NOT NULL DEFAULT now(), ativado_em timestamptz);
CREATE TABLE IF NOT EXISTS fiscoia.seg_dispositivos_confiaveis (token_hash char(64) PRIMARY KEY, user_id text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(), expira_em timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS seg_dispositivos_confiaveis_user_idx ON fiscoia.seg_dispositivos_confiaveis(user_id);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscoia_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON fiscoia.seg_login_falhas, fiscoia.seg_eventos_seguranca, fiscoia.seg_2fa, fiscoia.seg_dispositivos_confiaveis TO fiscoia_runtime;
    GRANT USAGE, SELECT ON SEQUENCE fiscoia.seg_eventos_seguranca_id_seq TO fiscoia_runtime;
  END IF;
END $$;
