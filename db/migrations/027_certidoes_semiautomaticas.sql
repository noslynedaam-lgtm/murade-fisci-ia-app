-- Certidões semiautomáticas (estadual, municipal, CRF do FGTS e CNDT): a pessoa emite no portal do órgão, solta o PDF e o sistema
-- lê número, situação e validade para ela confirmar. Esta migração:
-- 1) aceita a origem 'pdf_importado' (PDF lido pelo sistema e confirmado pela pessoa);
-- 2) guarda o resultado da certidão: negativa, positiva com efeito de negativa ou positiva (para o painel verde/amarelo/vermelho);
-- 3) cria a função do robô preparador: por escritório, só CONTAGENS (nunca empresa, CNPJ ou número) do que falta buscar.
-- Idempotente: pode rodar de novo sem duplicar nada nem apagar dados.

ALTER TABLE fiscoia.certidoes DROP CONSTRAINT IF EXISTS certidoes_origem_check;
ALTER TABLE fiscoia.certidoes ADD CONSTRAINT certidoes_origem_check CHECK (origem IN ('consulta_serpro', 'manual', 'pdf_importado'));

ALTER TABLE fiscoia.certidoes ADD COLUMN IF NOT EXISTS resultado text;
ALTER TABLE fiscoia.certidoes DROP CONSTRAINT IF EXISTS certidoes_resultado_check;
ALTER TABLE fiscoia.certidoes ADD CONSTRAINT certidoes_resultado_check CHECK (resultado IS NULL OR resultado IN ('negativa', 'positiva_efeito_negativa', 'positiva'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscoia_runtime') THEN
    GRANT SELECT, INSERT, DELETE ON fiscoia.certidoes TO fiscoia_runtime;
  END IF;
END $$;

-- Robô preparador das certidões (só a conta administradora, só leitura, só contagens por escritório).
-- Para cada empresa ativa e cada certidão semiautomática, olha a mais recente utilizável e conta: faltando (nunca buscada),
-- vencidas e a renovar (vence em até 7 dias o CRF do FGTS; em até 15 dias as demais).
CREATE OR REPLACE FUNCTION fiscoia.platform_certidoes_a_buscar(p_admin uuid, p_hoje date)
RETURNS TABLE (tenant_id uuid, tenant_name text, empresas integer, faltando integer, vencidas integer, a_renovar integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora prepara a busca das certidões.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.certidoes_robo', 'on', true);
  PERFORM set_config('app.conferidor_robo', 'on', true);
  RETURN QUERY
    WITH emp AS (
      SELECT c.tenant_id, c.id FROM fiscoia.companies c WHERE c.archived_at IS NULL
    ), tipos AS (
      SELECT unnest(ARRAY['estadual', 'municipal', 'fgts', 'trabalhista']) AS tipo
    ), ult AS (
      SELECT DISTINCT ON (x.tenant_id, x.company_id, x.tipo) x.tenant_id, x.company_id, x.tipo, x.validade
        FROM fiscoia.certidoes x
       WHERE x.situacao IN ('emitida', 'registrada_manualmente')
       ORDER BY x.tenant_id, x.company_id, x.tipo, x.created_at DESC
    )
    SELECT t.id, t.name,
           count(DISTINCT e.id)::integer,
           count(*) FILTER (WHERE u.company_id IS NULL)::integer,
           count(*) FILTER (WHERE u.validade < p_hoje)::integer,
           count(*) FILTER (WHERE u.validade >= p_hoje AND u.validade <= p_hoje + CASE WHEN tp.tipo = 'fgts' THEN 7 ELSE 15 END)::integer
      FROM emp e
      CROSS JOIN tipos tp
      LEFT JOIN ult u ON u.tenant_id = e.tenant_id AND u.company_id = e.id AND u.tipo = tp.tipo
      JOIN fiscoia.tenants t ON t.id = e.tenant_id
     GROUP BY t.id, t.name;
  PERFORM set_config('app.certidoes_robo', '', true);
  PERFORM set_config('app.conferidor_robo', '', true);
END $$;

REVOKE ALL ON FUNCTION fiscoia.platform_certidoes_a_buscar(uuid, date) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscoia_runtime') THEN
    GRANT EXECUTE ON FUNCTION fiscoia.platform_certidoes_a_buscar(uuid, date) TO fiscoia_runtime;
  END IF;
END $$;
