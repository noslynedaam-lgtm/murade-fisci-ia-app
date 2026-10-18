-- Campos de identidade e primeiro acesso para autenticação central.
-- A senha continua sendo armazenada somente como hash PBKDF2 no servidor.
ALTER TABLE fiscoia.users
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS tax_id varchar(14),
  ADD COLUMN IF NOT EXISTS crc text,
  ADD COLUMN IF NOT EXISTS plan_id text NOT NULL DEFAULT 'basico',
  ADD COLUMN IF NOT EXISTS plan_name text NOT NULL DEFAULT 'Básico',
  ADD COLUMN IF NOT EXISTS expires_on date,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'CONTADOR';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_plan_id_allowed'
      AND conrelid = 'fiscoia.users'::regclass
  ) THEN
    ALTER TABLE fiscoia.users
      ADD CONSTRAINT users_plan_id_allowed
      CHECK (plan_id IN ('basico', 'profissional', 'empresarial'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_account_type_allowed'
      AND conrelid = 'fiscoia.users'::regclass
  ) THEN
    ALTER TABLE fiscoia.users
      ADD CONSTRAINT users_account_type_allowed
      CHECK (account_type IN ('ADMIN', 'CONTADOR'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_tax_id_format'
      AND conrelid = 'fiscoia.users'::regclass
  ) THEN
    ALTER TABLE fiscoia.users
      ADD CONSTRAINT users_tax_id_format
      CHECK (tax_id IS NULL OR tax_id ~ '^[0-9]{11}$' OR tax_id ~ '^[A-Z0-9]{14}$');
  END IF;
END
$$;

-- Permite separar token de primeiro acesso de recuperação de senha.
ALTER TABLE fiscoia.password_reset_tokens
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'PASSWORD_RESET';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'password_token_purpose_allowed'
      AND conrelid = 'fiscoia.password_reset_tokens'::regclass
  ) THEN
    ALTER TABLE fiscoia.password_reset_tokens
      ADD CONSTRAINT password_token_purpose_allowed
      CHECK (purpose IN ('FIRST_ACCESS', 'PASSWORD_RESET'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS password_tokens_user_purpose_expiry_idx
  ON fiscoia.password_reset_tokens (user_id, purpose, expires_at DESC);

-- Consultas de sessão podem revogar sessões antigas sem varrer a tabela inteira.
CREATE INDEX IF NOT EXISTS auth_sessions_active_expiry_idx
  ON fiscoia.auth_sessions (expires_at)
  WHERE revoked_at IS NULL;
