-- Preenchimento automático do CNPJ do escritório a partir do Murade Fiscal (robô de empresas).
-- O Fiscal já guarda o CNPJ de cada escritório; aqui o robô de integração (que não é a conta administradora) só pode PREENCHER o que
-- está vazio. Nunca sobrescreve um CNPJ já cadastrado e nunca mexe no escritório do dono do sistema. Idempotente.

CREATE OR REPLACE FUNCTION fiscoia.platform_fill_office_cnpj_from_integration(p_tenant uuid, p_cnpj text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
DECLARE
  c text := upper(coalesce(p_cnpj, ''));
  pesos1 int[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  pesos2 int[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  soma int; i int; d1 int; d2 int;
BEGIN
  -- CNPJ válido (numérico ou alfanumérico): 12 posições + 2 dígitos, não todos iguais, dígitos verificadores corretos.
  IF c !~ '^[A-Z0-9]{12}[0-9]{2}$' OR c ~ '^(.)\1+$' THEN RETURN false; END IF;
  soma := 0; FOR i IN 1..12 LOOP soma := soma + (ascii(substr(c, i, 1)) - 48) * pesos1[i]; END LOOP;
  d1 := CASE WHEN soma % 11 < 2 THEN 0 ELSE 11 - soma % 11 END;
  soma := 0; FOR i IN 1..12 LOOP soma := soma + (ascii(substr(c, i, 1)) - 48) * pesos2[i]; END LOOP;
  soma := soma + d1 * pesos2[13];
  d2 := CASE WHEN soma % 11 < 2 THEN 0 ELSE 11 - soma % 11 END;
  IF substr(c, 13, 2) <> d1::text || d2::text THEN RETURN false; END IF;
  -- Escritório do dono do sistema usa o CNPJ do contratante: nunca é preenchido por aqui.
  IF EXISTS (SELECT 1 FROM fiscoia.tenant_memberships m JOIN fiscoia.users u ON u.id = m.user_id
              WHERE m.tenant_id = p_tenant AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'O escritório da conta administradora usa o CNPJ do contratante.' USING ERRCODE = '22023';
  END IF;
  UPDATE fiscoia.tenants SET office_cnpj = c WHERE id = p_tenant AND office_cnpj IS NULL;
  RETURN FOUND;
END $$;

-- Conferidor: escritórios clientes (não-dono) ainda sem CNPJ, com o e-mail do proprietário (para casar com o login do Fiscal).
CREATE OR REPLACE FUNCTION fiscoia.integration_offices_without_cnpj()
RETURNS TABLE (id uuid, name text, owner_email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
  SELECT t.id, t.name,
         (SELECT u.email FROM fiscoia.tenant_memberships m JOIN fiscoia.users u ON u.id = m.user_id
           WHERE m.tenant_id = t.id AND m.role = 'OWNER' ORDER BY m.created_at LIMIT 1)
    FROM fiscoia.tenants t
   WHERE t.office_cnpj IS NULL
     AND NOT EXISTS (SELECT 1 FROM fiscoia.tenant_memberships m JOIN fiscoia.users u ON u.id = m.user_id
                      WHERE m.tenant_id = t.id AND u.active AND u.is_admin)
$$;

REVOKE ALL ON FUNCTION fiscoia.platform_fill_office_cnpj_from_integration(uuid, text), fiscoia.integration_offices_without_cnpj() FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscoia_runtime') THEN
    GRANT EXECUTE ON FUNCTION fiscoia.platform_fill_office_cnpj_from_integration(uuid, text), fiscoia.integration_offices_without_cnpj() TO fiscoia_runtime;
  END IF;
END $$;
