-- Dono do sistema: excluir um escritório inteiro ou uma conta que impede novo cadastro do e-mail.
-- Nada fica bloqueado para sempre: os registros são apagados e o e-mail volta a poder receber convite.
-- Se o histórico impedir apagar uma conta, ela fica sem acesso e com o e-mail liberado.

CREATE OR REPLACE FUNCTION fiscoia.platform_purge_user(p_user uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_user AND u.is_admin) THEN RETURN false; END IF;
  BEGIN
    DELETE FROM fiscoia.password_reset_tokens WHERE user_id = p_user;
    DELETE FROM fiscoia.auth_sessions WHERE user_id = p_user;
    DELETE FROM fiscoia.users WHERE id = p_user;
    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    UPDATE fiscoia.users SET active = false, email = left(email, 60) || '#removido-' || extract(epoch from now())::bigint::text, updated_at = now() WHERE id = p_user;
    UPDATE fiscoia.auth_sessions SET revoked_at = now() WHERE user_id = p_user AND revoked_at IS NULL;
    RETURN false;
  END;
END $$;

CREATE OR REPLACE FUNCTION fiscoia.platform_delete_office(p_admin uuid, p_tenant uuid)
RETURNS TABLE (encontrado boolean, apagadas integer, sem_acesso integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
DECLARE ids uuid[]; uid uuid; ok integer := 0; sem integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora exclui escritórios.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM fiscoia.tenant_memberships m WHERE m.tenant_id = p_tenant AND m.user_id = p_admin) THEN
    RAISE EXCEPTION 'O escritório da própria conta administradora não pode ser excluído.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM fiscoia.tenants t WHERE t.id = p_tenant) THEN RETURN QUERY SELECT false, 0, 0; RETURN; END IF;
  SELECT coalesce(array_agg(m.user_id), '{}') INTO ids FROM fiscoia.tenant_memberships m WHERE m.tenant_id = p_tenant;
  DELETE FROM fiscoia.tenants WHERE id = p_tenant;
  FOREACH uid IN ARRAY ids LOOP
    IF NOT EXISTS (SELECT 1 FROM fiscoia.tenant_memberships m WHERE m.user_id = uid) THEN
      IF fiscoia.platform_purge_user(uid) THEN ok := ok + 1; ELSE sem := sem + 1; END IF;
    END IF;
  END LOOP;
  RETURN QUERY SELECT true, ok, sem;
END $$;

CREATE OR REPLACE FUNCTION fiscoia.platform_account_summary(p_admin uuid, p_email text)
RETURNS TABLE (id uuid, is_admin boolean, active boolean, offices integer, is_owner boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora consulta contas.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.id, u.is_admin, u.active,
           (SELECT count(*)::int FROM fiscoia.tenant_memberships m WHERE m.user_id = u.id),
           EXISTS (SELECT 1 FROM fiscoia.tenant_memberships m WHERE m.user_id = u.id AND m.role = 'OWNER')
      FROM fiscoia.users u WHERE lower(u.email) = lower(btrim(p_email));
END $$;

CREATE OR REPLACE FUNCTION fiscoia.platform_delete_account(p_admin uuid, p_user uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora exclui contas.' USING ERRCODE = '42501';
  END IF;
  IF p_user = p_admin OR EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_user AND u.is_admin) THEN
    RAISE EXCEPTION 'Esta é uma conta administradora e não pode ser excluída aqui.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM fiscoia.tenant_memberships m WHERE m.user_id = p_user AND m.role = 'OWNER') THEN
    RAISE EXCEPTION 'Esta conta é dono de escritório: exclua o escritório.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_user) THEN RETURN 'nao_encontrada'; END IF;
  DELETE FROM fiscoia.tenant_memberships WHERE user_id = p_user;
  IF fiscoia.platform_purge_user(p_user) THEN RETURN 'apagada'; END IF;
  RETURN 'sem_acesso';
END $$;

REVOKE ALL ON FUNCTION fiscoia.platform_purge_user(uuid), fiscoia.platform_delete_office(uuid, uuid),
  fiscoia.platform_account_summary(uuid, text), fiscoia.platform_delete_account(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fiscoia.platform_delete_office(uuid, uuid), fiscoia.platform_account_summary(uuid, text),
  fiscoia.platform_delete_account(uuid, uuid) TO fiscoia_runtime;
