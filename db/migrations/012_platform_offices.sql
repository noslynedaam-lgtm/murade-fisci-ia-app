-- Modelo SaaS: o dono do sistema (conta administradora) contrata e bloqueia ESCRITÓRIOS,
-- sem ser membro deles e, portanto, sem enxergar empresas, documentos ou certificados.
-- As funções abaixo são SECURITY DEFINER e só devolvem dados de contratação (nome, datas,
-- quantidade de usuários e situação). As tabelas de dados continuam sob RLS por escritório.

ALTER TABLE fiscoia.tenants ADD COLUMN IF NOT EXISTS blocked_at timestamptz;

CREATE OR REPLACE FUNCTION fiscoia.platform_list_offices(p_admin uuid)
RETURNS TABLE (id uuid, name text, created_at timestamptz, blocked_at timestamptz, users integer, owner_email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora consulta os escritórios.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT t.id, t.name, t.created_at, t.blocked_at,
           (SELECT count(*)::int FROM fiscoia.tenant_memberships m WHERE m.tenant_id = t.id),
           (SELECT u.email FROM fiscoia.tenant_memberships m JOIN fiscoia.users u ON u.id = m.user_id
             WHERE m.tenant_id = t.id AND m.role = 'OWNER' ORDER BY m.created_at LIMIT 1)
      FROM fiscoia.tenants t
     WHERE NOT EXISTS (SELECT 1 FROM fiscoia.tenant_memberships mine WHERE mine.tenant_id = t.id AND mine.user_id = p_admin)
     ORDER BY t.created_at;
END $$;

CREATE OR REPLACE FUNCTION fiscoia.platform_create_office(p_admin uuid, p_name text, p_owner uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
DECLARE novo uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora cria escritórios.' USING ERRCODE = '42501';
  END IF;
  IF p_owner = p_admin THEN
    RAISE EXCEPTION 'O responsável do escritório contratante deve ser outra conta.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO fiscoia.tenants (name) VALUES (btrim(p_name)) RETURNING fiscoia.tenants.id INTO novo;
  INSERT INTO fiscoia.tenant_memberships (tenant_id, user_id, role) VALUES (novo, p_owner, 'OWNER');
  RETURN novo;
END $$;

CREATE OR REPLACE FUNCTION fiscoia.platform_set_office_blocked(p_admin uuid, p_tenant uuid, p_blocked boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora bloqueia escritórios.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM fiscoia.tenant_memberships m WHERE m.tenant_id = p_tenant AND m.user_id = p_admin) THEN
    RAISE EXCEPTION 'O escritório da própria conta administradora não pode ser bloqueado.' USING ERRCODE = '22023';
  END IF;
  UPDATE fiscoia.tenants SET blocked_at = CASE WHEN p_blocked THEN now() ELSE NULL END WHERE id = p_tenant;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_blocked THEN
    UPDATE fiscoia.auth_sessions SET revoked_at = now()
     WHERE revoked_at IS NULL AND user_id IN (SELECT user_id FROM fiscoia.tenant_memberships WHERE tenant_id = p_tenant);
  END IF;
  RETURN true;
END $$;

-- Usuário sem nenhum escritório ativo (todos bloqueados) fica impedido de entrar.
CREATE OR REPLACE FUNCTION fiscoia.user_is_blocked(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
  SELECT EXISTS (SELECT 1 FROM fiscoia.tenant_memberships m WHERE m.user_id = p_user)
     AND NOT EXISTS (
       SELECT 1 FROM fiscoia.tenant_memberships m JOIN fiscoia.tenants t ON t.id = m.tenant_id
        WHERE m.user_id = p_user AND t.blocked_at IS NULL)
$$;

REVOKE ALL ON FUNCTION fiscoia.platform_list_offices(uuid), fiscoia.platform_create_office(uuid, text, uuid),
  fiscoia.platform_set_office_blocked(uuid, uuid, boolean), fiscoia.user_is_blocked(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fiscoia.platform_list_offices(uuid), fiscoia.platform_create_office(uuid, text, uuid),
  fiscoia.platform_set_office_blocked(uuid, uuid, boolean), fiscoia.user_is_blocked(uuid) TO fiscoia_runtime;
