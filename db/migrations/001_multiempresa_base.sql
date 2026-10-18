CREATE SCHEMA IF NOT EXISTS fiscoia;

CREATE TABLE IF NOT EXISTS fiscoia.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_normalized CHECK (email = lower(btrim(email)))
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON fiscoia.users (email);

CREATE TABLE IF NOT EXISTS fiscoia.auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES fiscoia.users(id) ON DELETE CASCADE,
  token_sha256 char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_session_token_hash_format CHECK (token_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_expiry_idx
  ON fiscoia.auth_sessions (user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS fiscoia.password_reset_tokens (
  token_sha256 char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES fiscoia.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reset_token_hash_format CHECK (token_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE IF NOT EXISTS fiscoia.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fiscoia.tenant_memberships (
  tenant_id uuid NOT NULL REFERENCES fiscoia.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES fiscoia.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'CONTADOR', 'OPERADOR', 'LEITURA')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS fiscoia.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES fiscoia.tenants(id) ON DELETE CASCADE,
  cnpj varchar(14) NOT NULL,
  legal_name text NOT NULL,
  state char(2),
  municipality text,
  tax_regime text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_cnpj_normalized CHECK (cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$'),
  CONSTRAINT company_cnpj_per_tenant UNIQUE (tenant_id, cnpj),
  CONSTRAINT company_tenant_id_pair UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS fiscoia.fiscal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  company_id uuid NOT NULL,
  access_key varchar(44) NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('NFE', 'NFCE', 'NFSE', 'OTHER')),
  issued_on date,
  total_amount numeric(16,2),
  status text NOT NULL DEFAULT 'PENDING',
  source text NOT NULL,
  xml_ciphertext bytea,
  xml_nonce bytea,
  xml_auth_tag bytea,
  encryption_key_version text,
  xml_sha256 char(64),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_document_company_fk
    FOREIGN KEY (tenant_id, company_id)
    REFERENCES fiscoia.companies(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fiscal_document_key_per_company UNIQUE (tenant_id, company_id, access_key),
  CONSTRAINT fiscal_document_sha256_format CHECK (xml_sha256 IS NULL OR xml_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT fiscal_document_encryption_fields_together CHECK (
    (xml_ciphertext IS NULL AND xml_nonce IS NULL AND xml_auth_tag IS NULL AND encryption_key_version IS NULL)
    OR
    (xml_ciphertext IS NOT NULL AND xml_nonce IS NOT NULL AND octet_length(xml_nonce) = 12
      AND xml_auth_tag IS NOT NULL AND octet_length(xml_auth_tag) = 16
      AND encryption_key_version IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS fiscal_documents_company_issued_idx
  ON fiscoia.fiscal_documents (tenant_id, company_id, issued_on DESC);

CREATE TABLE IF NOT EXISTS fiscoia.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES fiscoia.tenants(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES fiscoia.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_tenant_created_idx
  ON fiscoia.audit_events (tenant_id, created_at DESC);

-- Certificados, senhas e tokens de portais não são armazenados nestas tabelas.
-- A camada de aplicação deve setar os dois valores dentro de uma transação
-- autenticada antes de consultar dados de empresa.
CREATE OR REPLACE FUNCTION fiscoia.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION fiscoia.current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION fiscoia.is_tenant_member(target_tenant_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (
    SELECT 1 FROM fiscoia.tenant_memberships membership
    WHERE membership.tenant_id = target_tenant_id
      AND membership.user_id = fiscoia.current_user_id()
  )
$$;

ALTER TABLE fiscoia.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscoia.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscoia.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscoia.fiscal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscoia.audit_events ENABLE ROW LEVEL SECURITY;

-- O Render costuma conectar com o proprietário do schema. FORCE faz com que
-- as tabelas de dados empresariais também apliquem RLS ao proprietário; o
-- backend deverá setar app.user_id e app.tenant_id por transação autenticada.
ALTER TABLE fiscoia.companies FORCE ROW LEVEL SECURITY;
ALTER TABLE fiscoia.fiscal_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE fiscoia.audit_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_members_read ON fiscoia.tenants;
CREATE POLICY tenant_members_read ON fiscoia.tenants
  FOR SELECT USING (id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(id));

DROP POLICY IF EXISTS membership_scope ON fiscoia.tenant_memberships;
CREATE POLICY membership_scope ON fiscoia.tenant_memberships
  USING (user_id = fiscoia.current_user_id() OR tenant_id = fiscoia.current_tenant_id())
  WITH CHECK (fiscoia.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS company_tenant_isolation ON fiscoia.companies;
CREATE POLICY company_tenant_isolation ON fiscoia.companies
  USING (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id))
  WITH CHECK (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS fiscal_document_tenant_isolation ON fiscoia.fiscal_documents;
CREATE POLICY fiscal_document_tenant_isolation ON fiscoia.fiscal_documents
  USING (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id))
  WITH CHECK (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS audit_event_tenant_isolation ON fiscoia.audit_events;
CREATE POLICY audit_event_tenant_isolation ON fiscoia.audit_events
  USING (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id))
  WITH CHECK (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id));
