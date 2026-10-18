CREATE OR REPLACE FUNCTION fiscoia.is_platform_admin(target_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (
    SELECT 1 FROM fiscoia.users
    WHERE id = target_user_id AND active AND is_admin
  )
$$;

DROP POLICY IF EXISTS tenants_create_admin ON fiscoia.tenants;
CREATE POLICY tenants_create_admin ON fiscoia.tenants
  FOR INSERT WITH CHECK (fiscoia.is_platform_admin(fiscoia.current_user_id()));

DROP POLICY IF EXISTS membership_scope ON fiscoia.tenant_memberships;
CREATE POLICY membership_scope ON fiscoia.tenant_memberships
  USING (user_id = fiscoia.current_user_id() OR tenant_id = fiscoia.current_tenant_id())
  WITH CHECK (
    fiscoia.is_tenant_member(tenant_id)
    OR (
      user_id = fiscoia.current_user_id()
      AND role = 'OWNER'
      AND fiscoia.is_platform_admin(fiscoia.current_user_id())
    )
  );
