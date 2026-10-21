-- Limite de usuários contratado por escritório (dono incluso). NULL = sem limite.
ALTER TABLE fiscoia.tenants ADD COLUMN IF NOT EXISTS max_users integer
  CHECK (max_users IS NULL OR max_users BETWEEN 1 AND 1000);

CREATE OR REPLACE FUNCTION fiscoia.platform_list_office_limits(p_admin uuid)
RETURNS TABLE (id uuid, max_users integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora consulta os escritórios.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT t.id, t.max_users FROM fiscoia.tenants t;
END $$;

CREATE OR REPLACE FUNCTION fiscoia.platform_set_office_limit(p_admin uuid, p_tenant uuid, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora define o limite.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM fiscoia.tenant_memberships m WHERE m.tenant_id = p_tenant AND m.user_id = p_admin) THEN
    RAISE EXCEPTION 'O escritório da própria conta administradora não tem limite.' USING ERRCODE = '22023';
  END IF;
  UPDATE fiscoia.tenants SET max_users = p_limit WHERE id = p_tenant;
  RETURN FOUND;
END $$;

-- Usada ao cadastrar equipe: devolve o limite quando o escritório já está cheio; NULL caso contrário.
CREATE OR REPLACE FUNCTION fiscoia.office_user_limit_reached(p_tenant uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
  SELECT t.max_users FROM fiscoia.tenants t
   WHERE t.id = p_tenant AND t.max_users IS NOT NULL
     AND (SELECT count(*) FROM fiscoia.tenant_memberships m WHERE m.tenant_id = t.id) >= t.max_users
$$;

REVOKE ALL ON FUNCTION fiscoia.platform_list_office_limits(uuid), fiscoia.platform_set_office_limit(uuid, uuid, integer),
  fiscoia.office_user_limit_reached(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fiscoia.platform_list_office_limits(uuid), fiscoia.platform_set_office_limit(uuid, uuid, integer),
  fiscoia.office_user_limit_reached(uuid) TO fiscoia_runtime;
