ALTER TABLE fiscoia.companies
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES fiscoia.users(id) ON DELETE SET NULL;

-- Permite cadastrar novamente um CNPJ depois de arquivar o cadastro anterior,
-- mantendo o registro antigo e os documentos fiscais ligados a ele.
ALTER TABLE fiscoia.companies
  DROP CONSTRAINT IF EXISTS company_cnpj_per_tenant;

CREATE UNIQUE INDEX IF NOT EXISTS company_cnpj_active_per_tenant
  ON fiscoia.companies (tenant_id, cnpj)
  WHERE archived_at IS NULL;
