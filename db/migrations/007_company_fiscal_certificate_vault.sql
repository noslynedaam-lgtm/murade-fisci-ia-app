CREATE TABLE IF NOT EXISTS fiscoia.company_fiscal_certificates (
  tenant_id uuid NOT NULL,
  company_id uuid NOT NULL,
  pfx_ciphertext bytea NOT NULL,
  pfx_nonce bytea NOT NULL CHECK (octet_length(pfx_nonce) = 12),
  pfx_auth_tag bytea NOT NULL CHECK (octet_length(pfx_auth_tag) = 16),
  encryption_key_version text NOT NULL,
  pfx_sha256 char(64) NOT NULL CHECK (pfx_sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by uuid REFERENCES fiscoia.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, company_id),
  FOREIGN KEY (tenant_id, company_id)
    REFERENCES fiscoia.companies(tenant_id, id) ON DELETE CASCADE
);

ALTER TABLE fiscoia.company_fiscal_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscoia.company_fiscal_certificates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_certificate_tenant_isolation ON fiscoia.company_fiscal_certificates;
CREATE POLICY company_certificate_tenant_isolation ON fiscoia.company_fiscal_certificates
  USING (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id))
  WITH CHECK (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id));
