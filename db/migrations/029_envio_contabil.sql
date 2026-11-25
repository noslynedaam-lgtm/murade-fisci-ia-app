-- Fisco IA → Contábil: guias, dívida ativa e parcelamentos consultados POR CLIQUE no Integra Contador viram pré-lançamentos no Contábil.
-- 1) serpro_resultados passa a guardar também a guia do DAS do MEI (principal, multa e juros) e a dívida ativa do MEI.
-- 2) Cada resultado guardado ganha a situação do envio ao Contábil (pendente/enviado/erro/sem itens/empresa fora do Contábil).
-- 3) Robô de envio (só a conta administradora): lista os resultados ainda não enviados e marca o envio. Nunca consulta o Serpro:
--    só reenvia o que já foi consultado e guardado. Isolado por escritório como as demais tabelas (RLS).
-- Idempotente: pode rodar de novo sem duplicar nem apagar dados.

ALTER TABLE fiscoia.serpro_resultados DROP CONSTRAINT IF EXISTS serpro_resultados_tipo_check;
ALTER TABLE fiscoia.serpro_resultados ADD CONSTRAINT serpro_resultados_tipo_check
  CHECK (tipo IN ('situacao_fiscal', 'caixa_postal_lista', 'caixa_postal_novas', 'parcelamento_pedidos', 'parcelamento_detalhe', 'parcelamento_parcelas', 'guia_das_mei', 'divida_ativa_mei'));

ALTER TABLE fiscoia.serpro_resultados ADD COLUMN IF NOT EXISTS contabil_situacao text;
ALTER TABLE fiscoia.serpro_resultados ADD COLUMN IF NOT EXISTS contabil_enviado_em timestamptz;
ALTER TABLE fiscoia.serpro_resultados ADD COLUMN IF NOT EXISTS contabil_mensagem text;
ALTER TABLE fiscoia.serpro_resultados ADD COLUMN IF NOT EXISTS contabil_itens smallint;
ALTER TABLE fiscoia.serpro_resultados DROP CONSTRAINT IF EXISTS serpro_resultados_contabil_situacao_check;
ALTER TABLE fiscoia.serpro_resultados ADD CONSTRAINT serpro_resultados_contabil_situacao_check
  CHECK (contabil_situacao IS NULL OR contabil_situacao IN ('pendente', 'enviado', 'erro', 'sem_itens', 'sem_contabil'));
ALTER TABLE fiscoia.serpro_resultados DROP CONSTRAINT IF EXISTS serpro_resultados_contabil_mensagem_check;
ALTER TABLE fiscoia.serpro_resultados ADD CONSTRAINT serpro_resultados_contabil_mensagem_check
  CHECK (contabil_mensagem IS NULL OR char_length(contabil_mensagem) <= 400);
CREATE INDEX IF NOT EXISTS serpro_resultados_envio_contabil_idx ON fiscoia.serpro_resultados (contabil_situacao, consultado_em)
  WHERE tipo IN ('parcelamento_detalhe', 'guia_das_mei', 'divida_ativa_mei');

-- Pendentes de envio (de todos os escritórios), para o robô: só o necessário para montar os itens (CNPJ, tipo, modalidade e resumo).
CREATE OR REPLACE FUNCTION fiscoia.platform_envios_contabil_pendentes(p_admin uuid, p_limite integer)
RETURNS TABLE (id uuid, tenant_id uuid, cnpj text, tipo text, modalidade text, resumo jsonb, contabil_situacao text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora envia ao Contábil.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.conferidor_robo', 'on', true);
  RETURN QUERY
    SELECT r.id, r.tenant_id, c.cnpj::text, r.tipo, r.modalidade, r.resumo, r.contabil_situacao
      FROM fiscoia.serpro_resultados r
      JOIN fiscoia.companies c ON c.id = r.company_id AND c.tenant_id = r.tenant_id AND c.archived_at IS NULL
     WHERE r.tipo IN ('parcelamento_detalhe', 'guia_das_mei', 'divida_ativa_mei')
       AND (r.contabil_situacao IS NULL OR r.contabil_situacao IN ('pendente', 'erro', 'sem_contabil'))
       AND r.consultado_em > now() - interval '400 days'
     ORDER BY r.consultado_em
     LIMIT LEAST(GREATEST(p_limite, 1), 500);
  PERFORM set_config('app.conferidor_robo', '', true);
END $$;

CREATE OR REPLACE FUNCTION fiscoia.platform_marcar_envio_contabil(p_admin uuid, p_id uuid, p_situacao text, p_mensagem text, p_itens integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora envia ao Contábil.' USING ERRCODE = '42501';
  END IF;
  IF p_situacao NOT IN ('pendente', 'enviado', 'erro', 'sem_itens', 'sem_contabil') THEN
    RAISE EXCEPTION 'Situação de envio inválida.' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('app.conferidor_robo', 'on', true);
  UPDATE fiscoia.serpro_resultados
     SET contabil_situacao = p_situacao, contabil_mensagem = left(p_mensagem, 400), contabil_itens = LEAST(GREATEST(COALESCE(p_itens, 0), 0), 32000),
         contabil_enviado_em = CASE WHEN p_situacao = 'enviado' THEN now() ELSE contabil_enviado_em END
   WHERE id = p_id AND tipo IN ('parcelamento_detalhe', 'guia_das_mei', 'divida_ativa_mei');
  PERFORM set_config('app.conferidor_robo', '', true);
END $$;

-- A política de leitura do robô já existe (serpro_resultados_robo_read); a de atualização do envio vale só dentro da função acima.
DROP POLICY IF EXISTS serpro_resultados_robo_envio ON fiscoia.serpro_resultados;
CREATE POLICY serpro_resultados_robo_envio ON fiscoia.serpro_resultados
  FOR UPDATE USING (current_setting('app.conferidor_robo', true) = 'on') WITH CHECK (current_setting('app.conferidor_robo', true) = 'on');

REVOKE ALL ON FUNCTION fiscoia.platform_envios_contabil_pendentes(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION fiscoia.platform_marcar_envio_contabil(uuid, uuid, text, text, integer) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscoia_runtime') THEN
    GRANT EXECUTE ON FUNCTION fiscoia.platform_envios_contabil_pendentes(uuid, integer) TO fiscoia_runtime;
    GRANT EXECUTE ON FUNCTION fiscoia.platform_marcar_envio_contabil(uuid, uuid, text, text, integer) TO fiscoia_runtime;
  END IF;
END $$;
