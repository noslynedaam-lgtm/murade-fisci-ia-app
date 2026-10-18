CREATE TABLE IF NOT EXISTS fiscoia.fiscal_dfe_cursors (
  tenant_id uuid NOT NULL,
  company_id uuid NOT NULL,
  last_nsu numeric(15,0) NOT NULL DEFAULT 0 CHECK (last_nsu >= 0),
  max_nsu numeric(15,0) NOT NULL DEFAULT 0 CHECK (max_nsu >= 0),
  last_status integer,
  last_message text,
  last_response_at timestamptz,
  last_request_at timestamptz,
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, company_id),
  FOREIGN KEY (tenant_id, company_id)
    REFERENCES fiscoia.companies(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fiscoia.fiscal_dfe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  company_id uuid NOT NULL,
  document_nsu numeric(15,0) NOT NULL CHECK (document_nsu >= 0),
  schema_name text NOT NULL,
  access_key varchar(44),
  content_ciphertext bytea NOT NULL,
  content_nonce bytea NOT NULL CHECK (octet_length(content_nonce) = 12),
  content_auth_tag bytea NOT NULL CHECK (octet_length(content_auth_tag) = 16),
  encryption_key_version text NOT NULL,
  content_sha256 char(64) NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_dfe_item_nsu_unique UNIQUE (tenant_id, company_id, document_nsu),
  FOREIGN KEY (tenant_id, company_id)
    REFERENCES fiscoia.companies(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS fiscal_dfe_items_company_received_idx
  ON fiscoia.fiscal_dfe_items (tenant_id, company_id, received_at DESC);

ALTER TABLE fiscoia.fiscal_dfe_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscoia.fiscal_dfe_cursors FORCE ROW LEVEL SECURITY;
ALTER TABLE fiscoia.fiscal_dfe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscoia.fiscal_dfe_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiscal_dfe_cursor_tenant_isolation ON fiscoia.fiscal_dfe_cursors;
CREATE POLICY fiscal_dfe_cursor_tenant_isolation ON fiscoia.fiscal_dfe_cursors
  USING (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id))
  WITH CHECK (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS fiscal_dfe_item_tenant_isolation ON fiscoia.fiscal_dfe_items;
CREATE POLICY fiscal_dfe_item_tenant_isolation ON fiscoia.fiscal_dfe_items
  USING (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id))
  WITH CHECK (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id));
