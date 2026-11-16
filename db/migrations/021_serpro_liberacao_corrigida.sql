-- Correção da liberação da consulta ao Serpro.
-- As tabelas de empresas aplicam o isolamento por escritório até ao proprietário do banco (FORCE ROW LEVEL SECURITY). Por isso as
-- funções de liberação (017 e 020), que precisam enxergar a empresa sem estar "dentro" de um escritório, não achavam empresa nenhuma:
-- a lista do dono vinha vazia, o botão Liberar não gravava e o escritório liberado por inteiro continuava travado.
-- Aqui as funções de liberação (e só elas) ganham leitura das empresas por um sinal próprio: cada função liga o sinal ao começar
-- e desliga antes de devolver o resultado (o sinal é local à transação e nunca fica ligado para as consultas comuns do sistema).
DROP POLICY IF EXISTS company_serpro_gate_read ON fiscoia.companies;
CREATE POLICY company_serpro_gate_read ON fiscoia.companies
  FOR SELECT USING (current_setting('app.serpro_gate', true) = 'on');

-- Pedido de liberação (consulta barrada): precisa achar a empresa para registrar o pedido.
CREATE OR REPLACE FUNCTION fiscoia.serpro_request_release(p_company uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  PERFORM set_config('app.serpro_gate', 'on', true);
  INSERT INTO fiscoia.serpro_company_gate (company_id, requested_at)
  SELECT c.id, now() FROM fiscoia.companies c WHERE c.id = p_company
  ON CONFLICT (company_id) DO UPDATE SET requested_at = now();
  PERFORM set_config('app.serpro_gate', '', true);
END $$;

-- Só a conta administradora libera ou volta a travar uma empresa.
CREATE OR REPLACE FUNCTION fiscoia.platform_set_serpro_release(p_admin uuid, p_company uuid, p_liberada boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
DECLARE existe boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora libera a consulta ao Serpro.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.serpro_gate', 'on', true);
  existe := EXISTS (SELECT 1 FROM fiscoia.companies c WHERE c.id = p_company);
  PERFORM set_config('app.serpro_gate', '', true);
  IF NOT existe THEN RETURN false; END IF;
  INSERT INTO fiscoia.serpro_company_gate (company_id, released, released_at, released_by)
  VALUES (p_company, p_liberada, CASE WHEN p_liberada THEN now() END, CASE WHEN p_liberada THEN p_admin END)
  ON CONFLICT (company_id) DO UPDATE
    SET released = EXCLUDED.released,
        released_at = CASE WHEN EXCLUDED.released THEN now() ELSE NULL END,
        released_by = CASE WHEN EXCLUDED.released THEN p_admin ELSE NULL END;
  RETURN true;
END $$;

-- Conferidor: empresas com consulta registrada nos últimos dias, com a situação da liberação (já contando o escritório liberado por inteiro).
CREATE OR REPLACE FUNCTION fiscoia.platform_serpro_gate_audit(p_admin uuid, p_dias integer DEFAULT 7)
RETURNS TABLE (tenant_name text, company_id uuid, cnpj text, legal_name text, released boolean, requested_at timestamptz, consultas_recentes integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora confere a liberação das consultas.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.serpro_gate', 'on', true);
  RETURN QUERY
    SELECT t.name, c.id, c.cnpj::text, c.legal_name,
           (COALESCE(g.released, false) OR fiscoia.serpro_tenant_released(c.tenant_id) OR fiscoia.serpro_office_released(c.metadata->'escritorioOrigem'->>'nome')),
           g.requested_at,
           (SELECT count(*)::integer FROM jsonb_array_elements(c.metadata->'serproCota'->'consultas') x
             WHERE (x->>'em')::timestamptz >= now() - make_interval(days => GREATEST(1, LEAST(p_dias, 60))))
      FROM fiscoia.companies c
      JOIN fiscoia.tenants t ON t.id = c.tenant_id
      LEFT JOIN fiscoia.serpro_company_gate g ON g.company_id = c.id
     WHERE jsonb_typeof(c.metadata->'serproCota'->'consultas') = 'array';
  PERFORM set_config('app.serpro_gate', '', true);
END $$;

-- Escritório liberado por inteiro: o escritório do Fisco IA cujo PROPRIETÁRIO está na lista de liberados.
CREATE OR REPLACE FUNCTION fiscoia.serpro_tenant_released(p_tenant uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
  SELECT EXISTS (
    SELECT 1 FROM fiscoia.tenant_memberships m
      JOIN fiscoia.users u ON u.id = m.user_id AND u.active
      JOIN fiscoia.serpro_office_release o ON o.login = lower(u.email)
     WHERE m.tenant_id = p_tenant AND m.role = 'OWNER')
$$;

-- Liberada = liberada empresa a empresa, OU o escritório dela está liberado por inteiro (vale para todos os usuários dele),
-- OU é o registro de uma empresa de escritório cliente vinda do Fiscal/DP cujo escritório de origem está liberado por inteiro.
CREATE OR REPLACE FUNCTION fiscoia.serpro_company_released(p_company uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
DECLARE liberada boolean;
BEGIN
  IF COALESCE((SELECT g.released FROM fiscoia.serpro_company_gate g WHERE g.company_id = p_company), false) THEN RETURN true; END IF;
  PERFORM set_config('app.serpro_gate', 'on', true);
  liberada := EXISTS (
    SELECT 1 FROM fiscoia.companies c
     WHERE c.id = p_company
       AND (fiscoia.serpro_tenant_released(c.tenant_id)
            OR fiscoia.serpro_office_released(c.metadata->'escritorioOrigem'->>'nome')));
  PERFORM set_config('app.serpro_gate', '', true);
  RETURN liberada;
END $$;

-- Painel do dono, empresa por empresa. Empresas de escritório liberado por inteiro NÃO aparecem (não há o que fazer nelas).
-- Para o registro vindo do Fiscal/DP, mostra o escritório de origem.
CREATE OR REPLACE FUNCTION fiscoia.platform_list_serpro_gate(p_admin uuid, p_busca text DEFAULT NULL)
RETURNS TABLE (tenant_id uuid, tenant_name text, company_id uuid, cnpj text, legal_name text, released boolean, requested_at timestamptz, released_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora vê a liberação da consulta ao Serpro.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.serpro_gate', 'on', true);
  RETURN QUERY
    SELECT c.tenant_id, COALESCE(NULLIF(btrim(c.metadata->'escritorioOrigem'->>'nome'), ''), t.name), c.id, c.cnpj::text, c.legal_name,
           COALESCE(g.released, false), g.requested_at, g.released_at
      FROM fiscoia.companies c
      JOIN fiscoia.tenants t ON t.id = c.tenant_id
      LEFT JOIN fiscoia.serpro_company_gate g ON g.company_id = c.id
     WHERE c.archived_at IS NULL
       AND NOT fiscoia.serpro_tenant_released(c.tenant_id)
       AND NOT fiscoia.serpro_office_released(c.metadata->'escritorioOrigem'->>'nome')
       AND (p_busca IS NULL OR btrim(p_busca) = ''
            OR c.cnpj::text ILIKE '%' || btrim(p_busca) || '%'
            OR c.legal_name ILIKE '%' || btrim(p_busca) || '%'
            OR t.name ILIKE '%' || btrim(p_busca) || '%'
            OR c.metadata->'escritorioOrigem'->>'nome' ILIKE '%' || btrim(p_busca) || '%')
     ORDER BY (g.requested_at IS NOT NULL AND COALESCE(g.released, false) = false) DESC, COALESCE(g.released, false) DESC, 2, c.legal_name
     LIMIT 300;
  PERFORM set_config('app.serpro_gate', '', true);
END $$;

-- Painel do dono, escritório por escritório: quem está liberado por inteiro. Não mostra as empresas, só a quantidade.
-- O escritório do próprio dono do sistema não aparece (ele nunca é travado).
CREATE OR REPLACE FUNCTION fiscoia.platform_list_serpro_offices(p_admin uuid)
RETURNS TABLE (tenant_id uuid, tenant_name text, owner_email text, companies integer, released boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora vê a liberação da consulta ao Serpro.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.serpro_gate', 'on', true);
  RETURN QUERY
    SELECT t.id, t.name,
           (SELECT string_agg(u.email, ', ' ORDER BY u.email) FROM fiscoia.tenant_memberships m JOIN fiscoia.users u ON u.id = m.user_id WHERE m.tenant_id = t.id AND m.role = 'OWNER'),
           (SELECT count(*)::integer FROM fiscoia.companies c WHERE c.tenant_id = t.id AND c.archived_at IS NULL),
           fiscoia.serpro_tenant_released(t.id)
      FROM fiscoia.tenants t
     WHERE NOT EXISTS (SELECT 1 FROM fiscoia.tenant_memberships m JOIN fiscoia.users u ON u.id = m.user_id
                        WHERE m.tenant_id = t.id AND m.role = 'OWNER' AND (u.is_admin OR u.account_type = 'ADMIN'))
     ORDER BY t.name
     LIMIT 500;
  PERFORM set_config('app.serpro_gate', '', true);
END $$;

-- Libera (ou volta a travar) um escritório inteiro. Somente a conta administradora.
CREATE OR REPLACE FUNCTION fiscoia.platform_set_serpro_office_release(p_admin uuid, p_tenant uuid, p_liberada boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora libera a consulta ao Serpro.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM fiscoia.tenant_memberships m WHERE m.tenant_id = p_tenant AND m.role = 'OWNER') THEN
    RETURN false;
  END IF;
  IF p_liberada THEN
    INSERT INTO fiscoia.serpro_office_release (login)
      SELECT lower(btrim(u.email)) FROM fiscoia.tenant_memberships m JOIN fiscoia.users u ON u.id = m.user_id
       WHERE m.tenant_id = p_tenant AND m.role = 'OWNER'
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM fiscoia.serpro_office_release o
     WHERE o.login IN (SELECT lower(btrim(u.email)) FROM fiscoia.tenant_memberships m JOIN fiscoia.users u ON u.id = m.user_id
                        WHERE m.tenant_id = p_tenant AND m.role = 'OWNER');
  END IF;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION fiscoia.serpro_tenant_released(uuid), fiscoia.platform_list_serpro_offices(uuid),
  fiscoia.platform_set_serpro_office_release(uuid, uuid, boolean) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscoia_runtime') THEN
    GRANT EXECUTE ON FUNCTION fiscoia.serpro_tenant_released(uuid), fiscoia.platform_list_serpro_offices(uuid),
      fiscoia.platform_set_serpro_office_release(uuid, uuid, boolean) TO fiscoia_runtime;
  END IF;
END $$;
