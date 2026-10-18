-- A versão da base agora inclui dia (AAAA.MM.DD). Mantém aceitas versões antigas.
ALTER TABLE fiscoia.company_reform_scenarios
  DROP CONSTRAINT IF EXISTS reform_rules_version_format;

ALTER TABLE fiscoia.company_reform_scenarios
  ADD CONSTRAINT reform_rules_version_format
  CHECK (rules_version ~ '^[0-9]{4}\.[0-9]{2}(\.[0-9]{2})?$');
