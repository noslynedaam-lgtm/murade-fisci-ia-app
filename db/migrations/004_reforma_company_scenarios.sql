CREATE TABLE IF NOT EXISTS fiscoia.company_reform_scenarios (
  tenant_id uuid NOT NULL,
  company_id uuid NOT NULL,
  scenario jsonb NOT NULL,
  rules_version text NOT NULL,
  updated_by uuid NOT NULL REFERENCES fiscoia.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, company_id),
  FOREIGN KEY (tenant_id, company_id)
    REFERENCES fiscoia.companies(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT reform_scenario_object CHECK (jsonb_typeof(scenario) = 'object'),
  CONSTRAINT reform_rules_version_format CHECK (rules_version ~ '^[0-9]{4}\.[0-9]{2}$')
);

ALTER TABLE fiscoia.company_reform_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscoia.company_reform_scenarios FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reform_scenario_tenant_isolation ON fiscoia.company_reform_scenarios;
CREATE POLICY reform_scenario_tenant_isolation ON fiscoia.company_reform_scenarios
  USING (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id))
  WITH CHECK (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS reform_scenario_updated_idx
  ON fiscoia.company_reform_scenarios (tenant_id, updated_at DESC);
