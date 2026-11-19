-- Exclusão de empresa em cascata entre os sistemas Murade.
-- Quando o CNPJ é excluído em outro sistema (ou aqui), o Fisco IA arquiva o cadastro em TODOS os escritórios que o tenham.
-- Arquivar não apaga nada: documentos, certificados e histórico continuam guardados, e o CNPJ pode ser cadastrado de novo
-- (o índice único só vale para cadastros ativos). Nada fica bloqueado.
--
-- RLS: companies e audit_events aplicam o isolamento por escritório até ao proprietário do banco (FORCE). A função abaixo é a
-- única porta para arquivar por CNPJ fora do contexto de um escritório; ela liga um sinal local à transação
-- (app.company_archive), que só as duas políticas abaixo reconhecem, e o desliga antes de devolver. Ela devolve apenas
-- a quantidade arquivada: nenhum dado de um escritório é mostrado a outro.
DROP POLICY IF EXISTS company_platform_archive_read ON fiscoia.companies;
CREATE POLICY company_platform_archive_read ON fiscoia.companies
  FOR SELECT USING (current_setting('app.company_archive', true) = 'on');

DROP POLICY IF EXISTS company_platform_archive_update ON fiscoia.companies;
CREATE POLICY company_platform_archive_update ON fiscoia.companies
  FOR UPDATE USING (current_setting('app.company_archive', true) = 'on')
  WITH CHECK (current_setting('app.company_archive', true) = 'on');

DROP POLICY IF EXISTS audit_platform_archive_insert ON fiscoia.audit_events;
CREATE POLICY audit_platform_archive_insert ON fiscoia.audit_events
  FOR INSERT WITH CHECK (current_setting('app.company_archive', true) = 'on');

-- Arquiva (não apaga) toda empresa ATIVA com este CNPJ, em todos os escritórios. Idempotente: sem ativa, devolve 0.
CREATE OR REPLACE FUNCTION fiscoia.platform_archive_companies_by_cnpj(p_cnpj text, p_origem text DEFAULT 'integracao')
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
DECLARE n integer := 0; r record; origem text := left(coalesce(nullif(btrim(p_origem), ''), 'integracao'), 40);
BEGIN
  IF p_cnpj IS NULL OR p_cnpj !~ '^[A-Z0-9]{12}[0-9]{2}$' THEN
    RAISE EXCEPTION 'CNPJ inválido.' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('app.company_archive', 'on', true);
  FOR r IN
    WITH alvo AS (
      UPDATE fiscoia.companies c
         SET archived_at = now(), archived_by = NULL, updated_at = now(),
             metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object('excluidaPor', origem, 'excluidaEm', now())
       WHERE c.cnpj = p_cnpj AND c.archived_at IS NULL
       RETURNING c.id, c.tenant_id
    ) SELECT id, tenant_id FROM alvo
  LOOP
    INSERT INTO fiscoia.audit_events (tenant_id, actor_user_id, event_type, entity_type, entity_id, details)
    VALUES (r.tenant_id, NULL, 'company.archived', 'company', r.id,
            jsonb_build_object('documents_preserved', true, 'origem', origem, 'cascata', true));
    n := n + 1;
  END LOOP;
  PERFORM set_config('app.company_archive', '', true);
  RETURN n;
END $$;

-- Conferidor (só leitura): CNPJs arquivados que NÃO têm cadastro ativo em nenhum escritório. Só CNPJ e quantidade; sem nomes.
CREATE OR REPLACE FUNCTION fiscoia.platform_archived_cnpjs()
RETURNS TABLE (cnpj text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  PERFORM set_config('app.company_archive', 'on', true);
  RETURN QUERY
    SELECT DISTINCT btrim(c.cnpj)::text FROM fiscoia.companies c
     WHERE c.archived_at IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM fiscoia.companies a WHERE a.cnpj = c.cnpj AND a.archived_at IS NULL);
  PERFORM set_config('app.company_archive', '', true);
END $$;

-- Conferidor: CNPJs ATIVOS aqui, marcando os que foram trazidos pelo robô do Fiscal. Só CNPJ; sem nomes.
CREATE OR REPLACE FUNCTION fiscoia.platform_active_cnpjs()
RETURNS TABLE (cnpj text, veio_do_fiscal boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  PERFORM set_config('app.company_archive', 'on', true);
  RETURN QUERY
    SELECT btrim(c.cnpj)::text, bool_or(c.metadata->>'origem' = 'murade-fiscal')
      FROM fiscoia.companies c WHERE c.archived_at IS NULL GROUP BY btrim(c.cnpj);
  PERFORM set_config('app.company_archive', '', true);
END $$;

REVOKE ALL ON FUNCTION fiscoia.platform_archive_companies_by_cnpj(text, text), fiscoia.platform_archived_cnpjs(),
  fiscoia.platform_active_cnpjs() FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscoia_runtime') THEN
    GRANT EXECUTE ON FUNCTION fiscoia.platform_archive_companies_by_cnpj(text, text), fiscoia.platform_archived_cnpjs(),
      fiscoia.platform_active_cnpjs() TO fiscoia_runtime;
  END IF;
END $$;
