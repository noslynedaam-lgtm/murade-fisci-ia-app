-- Trava da consulta ao Serpro por EMPRESA: começa travada; só a conta administradora (dona do sistema) libera, empresa por empresa.
-- A tabela não é visível nem gravável pelo escritório (fiscoia_runtime não recebe nenhum acesso direto): tudo passa pelas funções abaixo.
CREATE TABLE IF NOT EXISTS fiscoia.serpro_company_gate (
  company_id   uuid PRIMARY KEY REFERENCES fiscoia.companies(id) ON DELETE CASCADE,
  released     boolean NOT NULL DEFAULT false,
  requested_at timestamptz,
  released_at  timestamptz,
  released_by  uuid
);
REVOKE ALL ON fiscoia.serpro_company_gate FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscoia_runtime') THEN
    REVOKE ALL ON fiscoia.serpro_company_gate FROM fiscoia_runtime;
  END IF;
END $$;

-- Usada na hora da consulta: a empresa está liberada?
CREATE OR REPLACE FUNCTION fiscoia.serpro_company_released(p_company uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
  SELECT COALESCE((SELECT g.released FROM fiscoia.serpro_company_gate g WHERE g.company_id = p_company), false)
$$;

-- Quando uma consulta é barrada, deixa o pedido registrado para o dono ver no painel (não libera nada).
CREATE OR REPLACE FUNCTION fiscoia.serpro_request_release(p_company uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
  INSERT INTO fiscoia.serpro_company_gate (company_id, requested_at)
  SELECT c.id, now() FROM fiscoia.companies c WHERE c.id = p_company
  ON CONFLICT (company_id) DO UPDATE SET requested_at = now()
$$;

-- Só a conta administradora libera ou volta a travar.
CREATE OR REPLACE FUNCTION fiscoia.platform_set_serpro_release(p_admin uuid, p_company uuid, p_liberada boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora libera a consulta ao Serpro.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM fiscoia.companies c WHERE c.id = p_company) THEN
    RETURN false;
  END IF;
  INSERT INTO fiscoia.serpro_company_gate (company_id, released, released_at, released_by)
  VALUES (p_company, p_liberada, CASE WHEN p_liberada THEN now() END, CASE WHEN p_liberada THEN p_admin END)
  ON CONFLICT (company_id) DO UPDATE
    SET released = EXCLUDED.released,
        released_at = CASE WHEN EXCLUDED.released THEN now() ELSE NULL END,
        released_by = CASE WHEN EXCLUDED.released THEN p_admin ELSE NULL END;
  RETURN true;
END $$;

-- Painel do dono: empresas de todos os escritórios com a situação da liberação. Pedidos barrados e liberadas primeiro. Máximo de 300 linhas.
CREATE OR REPLACE FUNCTION fiscoia.platform_list_serpro_gate(p_admin uuid, p_busca text DEFAULT NULL)
RETURNS TABLE (tenant_id uuid, tenant_name text, company_id uuid, cnpj text, legal_name text, released boolean, requested_at timestamptz, released_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora vê a liberação da consulta ao Serpro.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.tenant_id, t.name, c.id, c.cnpj::text, c.legal_name, COALESCE(g.released, false), g.requested_at, g.released_at
      FROM fiscoia.companies c
      JOIN fiscoia.tenants t ON t.id = c.tenant_id
      LEFT JOIN fiscoia.serpro_company_gate g ON g.company_id = c.id
     WHERE c.archived_at IS NULL
       AND (p_busca IS NULL OR btrim(p_busca) = ''
            OR c.cnpj::text ILIKE '%' || btrim(p_busca) || '%'
            OR c.legal_name ILIKE '%' || btrim(p_busca) || '%'
            OR t.name ILIKE '%' || btrim(p_busca) || '%')
     ORDER BY (g.requested_at IS NOT NULL AND COALESCE(g.released, false) = false) DESC, COALESCE(g.released, false) DESC, t.name, c.legal_name
     LIMIT 300;
END $$;

-- Conferidor: empresas de escritórios clientes com consulta registrada nos últimos dias, com a situação da liberação (para achar uso sem liberação).
CREATE OR REPLACE FUNCTION fiscoia.platform_serpro_gate_audit(p_admin uuid, p_dias integer DEFAULT 7)
RETURNS TABLE (tenant_name text, company_id uuid, cnpj text, legal_name text, released boolean, requested_at timestamptz, consultas_recentes integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora confere a liberação das consultas.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT t.name, c.id, c.cnpj::text, c.legal_name, COALESCE(g.released, false), g.requested_at,
           (SELECT count(*)::integer FROM jsonb_array_elements(c.metadata->'serproCota'->'consultas') x
             WHERE (x->>'em')::timestamptz >= now() - make_interval(days => GREATEST(1, LEAST(p_dias, 60))))
      FROM fiscoia.companies c
      JOIN fiscoia.tenants t ON t.id = c.tenant_id
      LEFT JOIN fiscoia.serpro_company_gate g ON g.company_id = c.id
     WHERE jsonb_typeof(c.metadata->'serproCota'->'consultas') = 'array';
END $$;

REVOKE ALL ON FUNCTION fiscoia.serpro_company_released(uuid), fiscoia.serpro_request_release(uuid),
  fiscoia.platform_set_serpro_release(uuid, uuid, boolean), fiscoia.platform_list_serpro_gate(uuid, text), fiscoia.platform_serpro_gate_audit(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fiscoia.serpro_company_released(uuid), fiscoia.serpro_request_release(uuid),
  fiscoia.platform_set_serpro_release(uuid, uuid, boolean), fiscoia.platform_list_serpro_gate(uuid, text), fiscoia.platform_serpro_gate_audit(uuid, integer) TO fiscoia_runtime;
