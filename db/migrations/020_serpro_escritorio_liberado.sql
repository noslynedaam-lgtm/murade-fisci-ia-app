-- Escritório com consulta ao Serpro liberada por inteiro (todas as empresas e todos os usuários dele, inclusive funcionários).
-- Começa só com o escritório da contadora do dono. Os demais clientes continuam travados, empresa por empresa.
-- A tabela não é visível nem gravável pelo escritório: tudo passa pelas funções abaixo.
CREATE TABLE IF NOT EXISTS fiscoia.serpro_office_release (
  login      text PRIMARY KEY CHECK (login = lower(btrim(login))),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON fiscoia.serpro_office_release FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscoia_runtime') THEN
    REVOKE ALL ON fiscoia.serpro_office_release FROM fiscoia_runtime;
  END IF;
END $$;
INSERT INTO fiscoia.serpro_office_release (login) VALUES ('muradassessoriacontabil@hotmail.com'), ('muradassessoriacontabil')
ON CONFLICT DO NOTHING;

-- O escritório (login do Fiscal ou e-mail do Fisco IA) está liberado por inteiro?
CREATE OR REPLACE FUNCTION fiscoia.serpro_office_released(p_login text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
  SELECT EXISTS (SELECT 1 FROM fiscoia.serpro_office_release o WHERE o.login = lower(btrim(COALESCE(p_login, ''))))
$$;

-- Liberada = liberada empresa a empresa OU o escritório dono da empresa está liberado por inteiro (qualquer usuário do escritório).
CREATE OR REPLACE FUNCTION fiscoia.serpro_company_released(p_company uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
  SELECT COALESCE((SELECT g.released FROM fiscoia.serpro_company_gate g WHERE g.company_id = p_company), false)
      OR EXISTS (
        SELECT 1 FROM fiscoia.companies c
          JOIN fiscoia.tenant_memberships m ON m.tenant_id = c.tenant_id
          JOIN fiscoia.users u ON u.id = m.user_id AND u.active
          JOIN fiscoia.serpro_office_release o ON o.login = lower(u.email)
         WHERE c.id = p_company)
$$;

REVOKE ALL ON FUNCTION fiscoia.serpro_office_released(text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscoia_runtime') THEN
    GRANT EXECUTE ON FUNCTION fiscoia.serpro_office_released(text) TO fiscoia_runtime;
  END IF;
END $$;
