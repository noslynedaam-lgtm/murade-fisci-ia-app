-- Certidões (CND) por empresa: resultado das consultas (hoje, federal pelo Serpro) e registros manuais, com histórico.
-- Idempotente: pode rodar de novo sem duplicar nada nem apagar dados.
CREATE TABLE IF NOT EXISTS fiscoia.certidoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  company_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('federal', 'estadual', 'municipal', 'fgts', 'trabalhista')),
  uf varchar(2),
  municipio text,
  origem text NOT NULL CHECK (origem IN ('consulta_serpro', 'manual')),
  situacao text NOT NULL CHECK (situacao IN ('emitida', 'nao_emitida', 'em_processamento', 'indisponivel', 'erro', 'registrada_manualmente')),
  numero text,
  emissao date,
  validade date,
  mensagem text,
  resultado_orgao text,
  codigo_tipo_orgao text,
  observacao text,
  chave_consulta text,
  cobrada boolean NOT NULL DEFAULT false,
  pdf bytea CHECK (pdf IS NULL OR octet_length(pdf) <= 3145728),
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, company_id) REFERENCES fiscoia.companies(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS certidoes_empresa_tipo_idx ON fiscoia.certidoes (tenant_id, company_id, tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS certidoes_validade_idx ON fiscoia.certidoes (tenant_id, validade) WHERE validade IS NOT NULL;

ALTER TABLE fiscoia.certidoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscoia.certidoes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS certidoes_tenant_isolation ON fiscoia.certidoes;
CREATE POLICY certidoes_tenant_isolation ON fiscoia.certidoes
  USING (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id))
  WITH CHECK (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id));

-- Leitura só para o robô conferidor: o sinal é ligado dentro da função abaixo, local à transação, e desligado antes de devolver.
DROP POLICY IF EXISTS certidoes_robo_read ON fiscoia.certidoes;
CREATE POLICY certidoes_robo_read ON fiscoia.certidoes
  FOR SELECT USING (current_setting('app.certidoes_robo', true) = 'on');

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscoia_runtime') THEN
    GRANT SELECT, INSERT, DELETE ON fiscoia.certidoes TO fiscoia_runtime;
  END IF;
END $$;

-- Robô conferidor de vencimento (só a conta administradora, só contagens por escritório: nunca mostra empresa nem número de certidão).
-- Conta, para cada escritório, quantas certidões MAIS RECENTES (por empresa + tipo + UF + município) estão vencidas ou perto de vencer.
CREATE OR REPLACE FUNCTION fiscoia.platform_certidoes_vencimento(p_admin uuid, p_hoje date)
RETURNS TABLE (tenant_id uuid, tenant_name text, vencidas integer, vence_em_7 integer, vence_em_15 integer, vence_em_30 integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora confere o vencimento das certidões.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.certidoes_robo', 'on', true);
  RETURN QUERY
    WITH ult AS (
      SELECT DISTINCT ON (c.tenant_id, c.company_id, c.tipo, COALESCE(c.uf, ''), COALESCE(c.municipio, ''))
             c.tenant_id, c.validade
        FROM fiscoia.certidoes c
       WHERE c.situacao IN ('emitida', 'registrada_manualmente')
       ORDER BY c.tenant_id, c.company_id, c.tipo, COALESCE(c.uf, ''), COALESCE(c.municipio, ''), c.created_at DESC
    )
    SELECT t.id, t.name,
           count(*) FILTER (WHERE u.validade < p_hoje)::integer,
           count(*) FILTER (WHERE u.validade >= p_hoje AND u.validade <= p_hoje + 7)::integer,
           count(*) FILTER (WHERE u.validade > p_hoje + 7 AND u.validade <= p_hoje + 15)::integer,
           count(*) FILTER (WHERE u.validade > p_hoje + 15 AND u.validade <= p_hoje + 30)::integer
      FROM ult u JOIN fiscoia.tenants t ON t.id = u.tenant_id
     WHERE u.validade IS NOT NULL AND u.validade <= p_hoje + 30
     GROUP BY t.id, t.name;
  PERFORM set_config('app.certidoes_robo', '', true);
END $$;

REVOKE ALL ON FUNCTION fiscoia.platform_certidoes_vencimento(uuid, date) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscoia_runtime') THEN
    GRANT EXECUTE ON FUNCTION fiscoia.platform_certidoes_vencimento(uuid, date) TO fiscoia_runtime;
  END IF;
END $$;
