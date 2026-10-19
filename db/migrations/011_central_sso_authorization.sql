-- Authorization Code + PKCE foundation for the Murade central identity.
-- OAuth clients are configured as private environment secrets, not in this table.
CREATE TABLE IF NOT EXISTS fiscoia.auth_app_grants (
  user_id uuid NOT NULL REFERENCES fiscoia.users(id) ON DELETE CASCADE,
  client_id text NOT NULL CHECK (length(client_id) BETWEEN 1 AND 120),
  granted_by uuid REFERENCES fiscoia.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS auth_app_grants_active_idx
  ON fiscoia.auth_app_grants (user_id, client_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS fiscoia.sso_authorization_codes (
  code_sha256 char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES fiscoia.users(id) ON DELETE CASCADE,
  client_id text NOT NULL CHECK (length(client_id) BETWEEN 1 AND 120),
  redirect_uri text NOT NULL CHECK (length(redirect_uri) BETWEEN 1 AND 2048),
  scope text NOT NULL,
  code_challenge char(43) NOT NULL CHECK (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  state text NOT NULL CHECK (length(state) BETWEEN 1 AND 512),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sso_authorization_codes_expiry_idx
  ON fiscoia.sso_authorization_codes (expires_at);

CREATE TABLE IF NOT EXISTS fiscoia.sso_access_tokens (
  token_sha256 char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES fiscoia.users(id) ON DELETE CASCADE,
  client_id text NOT NULL CHECK (length(client_id) BETWEEN 1 AND 120),
  scope text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sso_access_tokens_active_expiry_idx
  ON fiscoia.sso_access_tokens (expires_at)
  WHERE revoked_at IS NULL;

-- Cleanup is bounded and can be invoked by the app without requiring a job runner.
GRANT SELECT, INSERT, UPDATE, DELETE ON fiscoia.auth_app_grants,
  fiscoia.sso_authorization_codes, fiscoia.sso_access_tokens TO fiscoia_runtime;
