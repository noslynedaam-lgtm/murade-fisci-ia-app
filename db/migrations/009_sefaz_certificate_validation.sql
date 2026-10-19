ALTER TABLE fiscoia.fiscal_dfe_cursors
  ADD COLUMN IF NOT EXISTS validated_certificate_sha256 char(64)
    CHECK (validated_certificate_sha256 IS NULL OR validated_certificate_sha256 ~ '^[0-9a-f]{64}$'),
  ADD COLUMN IF NOT EXISTS certificate_validated_at timestamptz;
