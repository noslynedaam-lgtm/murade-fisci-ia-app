-- CNPJ do próprio escritório contratante: é o "autor do pedido" nas consultas ao Integra Contador (Serpro).
-- As empresas do escritório autorizam ESTE CNPJ no e-CAC. Só a conta administradora (dona do sistema) define.
ALTER TABLE fiscoia.tenants ADD COLUMN IF NOT EXISTS office_cnpj text
  CHECK (office_cnpj IS NULL OR office_cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$');

CREATE OR REPLACE FUNCTION fiscoia.platform_list_office_cnpjs(p_admin uuid)
RETURNS TABLE (id uuid, office_cnpj text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora consulta os escritórios.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT t.id, t.office_cnpj FROM fiscoia.tenants t;
END $$;

CREATE OR REPLACE FUNCTION fiscoia.platform_set_office_cnpj(p_admin uuid, p_tenant uuid, p_cnpj text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora define o CNPJ do escritório.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM fiscoia.tenant_memberships m WHERE m.tenant_id = p_tenant AND m.user_id = p_admin) THEN
    RAISE EXCEPTION 'O escritório da própria conta administradora usa o CNPJ do contratante.' USING ERRCODE = '22023';
  END IF;
  UPDATE fiscoia.tenants SET office_cnpj = p_cnpj WHERE id = p_tenant;
  RETURN FOUND;
END $$;

-- Usada na hora da consulta: nome e CNPJ do escritório e se ele é o do próprio dono do sistema (que usa o CNPJ do contratante).
CREATE OR REPLACE FUNCTION fiscoia.tenant_office_info(p_tenant uuid)
RETURNS TABLE (name text, office_cnpj text, is_platform_owner boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
  SELECT t.name, t.office_cnpj,
         EXISTS (SELECT 1 FROM fiscoia.tenant_memberships m JOIN fiscoia.users u ON u.id = m.user_id
                  WHERE m.tenant_id = t.id AND u.active AND u.is_admin)
    FROM fiscoia.tenants t WHERE t.id = p_tenant
$$;

-- Cobrança: o que cada escritório consultou dentro do Fisco IA (só empresas que têm registro de consulta). Só a conta administradora.
-- Não inclui o escritório da própria conta administradora (esse a tela já lê direto).
CREATE OR REPLACE FUNCTION fiscoia.platform_serpro_usage(p_admin uuid)
RETURNS TABLE (tenant_id uuid, tenant_name text, company_id uuid, cnpj text, legal_name text, consultas jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora vê o consumo para cobrança.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.tenant_id, t.name, c.id, c.cnpj::text, c.legal_name, c.metadata->'serproCota'->'consultas'
      FROM fiscoia.companies c JOIN fiscoia.tenants t ON t.id = c.tenant_id
     WHERE c.metadata ? 'serproCota'
       AND NOT EXISTS (SELECT 1 FROM fiscoia.tenant_memberships mine WHERE mine.tenant_id = c.tenant_id AND mine.user_id = p_admin);
END $$;

REVOKE ALL ON FUNCTION fiscoia.platform_list_office_cnpjs(uuid), fiscoia.platform_set_office_cnpj(uuid, uuid, text),
  fiscoia.tenant_office_info(uuid), fiscoia.platform_serpro_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fiscoia.platform_list_office_cnpjs(uuid), fiscoia.platform_set_office_cnpj(uuid, uuid, text),
  fiscoia.tenant_office_info(uuid), fiscoia.platform_serpro_usage(uuid) TO fiscoia_runtime;
