-- Carteira fiscal do escritório e dados compartilhados entre a equipe.
-- 1) serpro_resultados: o resultado das consultas Integra Contador JÁ FEITAS (situação fiscal com o PDF, Caixa Postal, parcelamentos),
--    por empresa e com data, para histórico e para o painel da carteira (que só lê o que está guardado: sem custo).
-- 2) company_fiscal_certificates.valid_until: validade do certificado A1, lida do próprio arquivo, para avisar 30/15/7 dias antes.
-- 3) dados_escritorio: Agenda Fiscal, Relatório de Conformidade e Guias (INSS/DCTFWeb) saem do navegador e ficam no servidor,
--    por escritório, para a contadora e a funcionária verem a mesma coisa.
-- Robôs conferidores: só CONTAGENS por escritório (nunca empresa, CNPJ ou conteúdo), só para a conta administradora, só leitura.
-- Idempotente: pode rodar de novo sem duplicar nada nem apagar dados.

-- ---------------------------------------------------------------- 1) Resultados guardados das consultas ao Serpro
CREATE TABLE IF NOT EXISTS fiscoia.serpro_resultados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  company_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('situacao_fiscal', 'caixa_postal_lista', 'caixa_postal_novas', 'parcelamento_pedidos', 'parcelamento_detalhe', 'parcelamento_parcelas')),
  servico text NOT NULL CHECK (servico ~ '^[A-Za-z0-9]{1,40}$'),
  modalidade text CHECK (modalidade IS NULL OR modalidade ~ '^[A-Z0-9-]{1,20}$'),
  resumo jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (octet_length(resumo::text) <= 1048576),
  situacao text CHECK (situacao IS NULL OR situacao IN ('regular', 'pendente', 'a_conferir')),
  situacao_origem text CHECK (situacao_origem IS NULL OR situacao_origem IN ('lida_do_pdf', 'marcada_pela_pessoa', 'sem_leitura')),
  situacao_marcada_por uuid,
  situacao_marcada_em timestamptz,
  novas_mensagens smallint CHECK (novas_mensagens IS NULL OR novas_mensagens IN (0, 1, 2)),
  pdf bytea CHECK (pdf IS NULL OR octet_length(pdf) <= 10485760),
  cobrada boolean NOT NULL DEFAULT false,
  criado_por uuid,
  consultado_em timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, company_id) REFERENCES fiscoia.companies(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS serpro_resultados_empresa_tipo_idx ON fiscoia.serpro_resultados (tenant_id, company_id, tipo, consultado_em DESC);

ALTER TABLE fiscoia.serpro_resultados ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscoia.serpro_resultados FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS serpro_resultados_tenant_isolation ON fiscoia.serpro_resultados;
CREATE POLICY serpro_resultados_tenant_isolation ON fiscoia.serpro_resultados
  USING (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id))
  WITH CHECK (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id));
-- Leitura só para os robôs conferidores: o sinal é ligado dentro das funções abaixo, local à transação, e desligado antes de devolver.
DROP POLICY IF EXISTS serpro_resultados_robo_read ON fiscoia.serpro_resultados;
CREATE POLICY serpro_resultados_robo_read ON fiscoia.serpro_resultados
  FOR SELECT USING (current_setting('app.conferidor_robo', true) = 'on');

-- ---------------------------------------------------------------- 2) Validade do certificado A1
ALTER TABLE fiscoia.company_fiscal_certificates ADD COLUMN IF NOT EXISTS valid_until date;
DROP POLICY IF EXISTS company_certificate_robo_read ON fiscoia.company_fiscal_certificates;
CREATE POLICY company_certificate_robo_read ON fiscoia.company_fiscal_certificates
  FOR SELECT USING (current_setting('app.conferidor_robo', true) = 'on');

-- As funções dos conferidores precisam saber se a empresa está ativa (não arquivada).
DROP POLICY IF EXISTS company_conferidor_robo_read ON fiscoia.companies;
CREATE POLICY company_conferidor_robo_read ON fiscoia.companies
  FOR SELECT USING (current_setting('app.conferidor_robo', true) = 'on');

-- ---------------------------------------------------------------- 3) Dados compartilhados do escritório (antes ficavam no navegador)
CREATE TABLE IF NOT EXISTS fiscoia.dados_escritorio (
  tenant_id uuid NOT NULL REFERENCES fiscoia.tenants(id) ON DELETE CASCADE,
  colecao text NOT NULL CHECK (colecao IN ('agenda_lembretes', 'compliance_status', 'guias_receita')),
  chave text NOT NULL CHECK (chave ~ '^[A-Za-z0-9_./:-]{1,120}$'),
  dados jsonb NOT NULL CHECK (octet_length(dados::text) <= 262144),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid,
  PRIMARY KEY (tenant_id, colecao, chave)
);
ALTER TABLE fiscoia.dados_escritorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscoia.dados_escritorio FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dados_escritorio_tenant_isolation ON fiscoia.dados_escritorio;
CREATE POLICY dados_escritorio_tenant_isolation ON fiscoia.dados_escritorio
  USING (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id))
  WITH CHECK (tenant_id = fiscoia.current_tenant_id() AND fiscoia.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS dados_escritorio_robo_read ON fiscoia.dados_escritorio;
CREATE POLICY dados_escritorio_robo_read ON fiscoia.dados_escritorio
  FOR SELECT USING (current_setting('app.conferidor_robo', true) = 'on');

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscoia_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON fiscoia.serpro_resultados TO fiscoia_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON fiscoia.dados_escritorio TO fiscoia_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON fiscoia.company_fiscal_certificates TO fiscoia_runtime;
  END IF;
END $$;

-- ---------------------------------------------------------------- Robôs conferidores (só a conta administradora, só contagens)
-- Carteira fiscal: para cada escritório, a ÚLTIMA situação fiscal guardada de cada empresa ativa, o último "há mensagens novas"
-- da Caixa Postal e a última lista de "parcelas para emitir" de cada parcelamento. Parcela de mês anterior ao mês de hoje que
-- ainda aparece como disponível para emitir conta como indício de atraso. Não consulta o Serpro.
CREATE OR REPLACE FUNCTION fiscoia.platform_carteira_alertas(p_admin uuid, p_hoje date)
RETURNS TABLE (tenant_id uuid, tenant_name text, sitfis_pendentes integer, sitfis_a_conferir integer, caixa_postal_novas integer, parcelas_atrasadas integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora confere a carteira fiscal.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.conferidor_robo', 'on', true);
  RETURN QUERY
    WITH ult AS (
      SELECT DISTINCT ON (r.tenant_id, r.company_id, r.tipo, COALESCE(r.modalidade, ''))
             r.tenant_id, r.company_id, r.tipo, r.situacao, r.novas_mensagens, r.resumo
        FROM fiscoia.serpro_resultados r
        JOIN fiscoia.companies c ON c.id = r.company_id AND c.tenant_id = r.tenant_id AND c.archived_at IS NULL
       WHERE r.tipo IN ('situacao_fiscal', 'caixa_postal_novas', 'parcelamento_parcelas')
       ORDER BY r.tenant_id, r.company_id, r.tipo, COALESCE(r.modalidade, ''), r.consultado_em DESC
    ), atrasos AS (
      SELECT u.tenant_id, count(*)::integer AS qtd
        FROM ult u, jsonb_array_elements(CASE WHEN jsonb_typeof(u.resumo->'parcelas') = 'array' THEN u.resumo->'parcelas' ELSE '[]'::jsonb END) p
       WHERE u.tipo = 'parcelamento_parcelas'
         AND (p->>'parcela') ~ '^(0[1-9]|1[0-2])/\d{4}$'
         AND substr(p->>'parcela', 4, 4) || substr(p->>'parcela', 1, 2) < to_char(p_hoje, 'YYYYMM')
       GROUP BY u.tenant_id
    ), contagem AS (
      SELECT u.tenant_id,
             count(*) FILTER (WHERE u.tipo = 'situacao_fiscal' AND u.situacao = 'pendente')::integer AS pend,
             count(*) FILTER (WHERE u.tipo = 'situacao_fiscal' AND u.situacao = 'a_conferir')::integer AS conferir,
             count(*) FILTER (WHERE u.tipo = 'caixa_postal_novas' AND u.novas_mensagens IN (1, 2))::integer AS novas
        FROM ult u GROUP BY u.tenant_id
    )
    SELECT t.id, t.name, COALESCE(c.pend, 0), COALESCE(c.conferir, 0), COALESCE(c.novas, 0), COALESCE(a.qtd, 0)
      FROM contagem c
      FULL JOIN atrasos a ON a.tenant_id = c.tenant_id
      JOIN fiscoia.tenants t ON t.id = COALESCE(c.tenant_id, a.tenant_id)
     WHERE COALESCE(c.pend, 0) + COALESCE(c.conferir, 0) + COALESCE(c.novas, 0) + COALESCE(a.qtd, 0) > 0;
  PERFORM set_config('app.conferidor_robo', '', true);
END $$;

-- Certificado A1: vencidos e vencendo em 7, 15 e 30 dias, e os que ainda não têm a validade registrada (empresas ativas).
CREATE OR REPLACE FUNCTION fiscoia.platform_certificados_vencimento(p_admin uuid, p_hoje date)
RETURNS TABLE (tenant_id uuid, tenant_name text, vencidos integer, vence_em_7 integer, vence_em_15 integer, vence_em_30 integer, sem_validade integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora confere o vencimento dos certificados.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.conferidor_robo', 'on', true);
  RETURN QUERY
    SELECT t.id, t.name,
           count(*) FILTER (WHERE f.valid_until < p_hoje)::integer,
           count(*) FILTER (WHERE f.valid_until >= p_hoje AND f.valid_until <= p_hoje + 7)::integer,
           count(*) FILTER (WHERE f.valid_until > p_hoje + 7 AND f.valid_until <= p_hoje + 15)::integer,
           count(*) FILTER (WHERE f.valid_until > p_hoje + 15 AND f.valid_until <= p_hoje + 30)::integer,
           count(*) FILTER (WHERE f.valid_until IS NULL)::integer
      FROM fiscoia.company_fiscal_certificates f
      JOIN fiscoia.companies c ON c.id = f.company_id AND c.tenant_id = f.tenant_id AND c.archived_at IS NULL
      JOIN fiscoia.tenants t ON t.id = f.tenant_id
     WHERE f.valid_until IS NULL OR f.valid_until <= p_hoje + 30
     GROUP BY t.id, t.name;
  PERFORM set_config('app.conferidor_robo', '', true);
END $$;

-- Agenda Fiscal: lembretes não concluídos já vencidos ou vencendo hoje, por escritório.
CREATE OR REPLACE FUNCTION fiscoia.platform_agenda_vencidos(p_admin uuid, p_hoje date)
RETURNS TABLE (tenant_id uuid, tenant_name text, vencidos integer, vence_hoje integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora confere a agenda.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.conferidor_robo', 'on', true);
  RETURN QUERY
    WITH l AS (
      SELECT d.tenant_id, (d.dados->>'dataVencimento')::date AS venc
        FROM fiscoia.dados_escritorio d
       WHERE d.colecao = 'agenda_lembretes'
         AND COALESCE(d.dados->>'concluido', 'false') <> 'true'
         AND (d.dados->>'dataVencimento') ~ '^\d{4}-\d{2}-\d{2}$'
    )
    SELECT t.id, t.name,
           count(*) FILTER (WHERE l.venc < p_hoje)::integer,
           count(*) FILTER (WHERE l.venc = p_hoje)::integer
      FROM l JOIN fiscoia.tenants t ON t.id = l.tenant_id
     WHERE l.venc <= p_hoje
     GROUP BY t.id, t.name;
  PERFORM set_config('app.conferidor_robo', '', true);
END $$;

REVOKE ALL ON FUNCTION fiscoia.platform_carteira_alertas(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION fiscoia.platform_certificados_vencimento(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION fiscoia.platform_agenda_vencidos(uuid, date) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscoia_runtime') THEN
    GRANT EXECUTE ON FUNCTION fiscoia.platform_carteira_alertas(uuid, date) TO fiscoia_runtime;
    GRANT EXECUTE ON FUNCTION fiscoia.platform_certificados_vencimento(uuid, date) TO fiscoia_runtime;
    GRANT EXECUTE ON FUNCTION fiscoia.platform_agenda_vencidos(uuid, date) TO fiscoia_runtime;
  END IF;
END $$;
