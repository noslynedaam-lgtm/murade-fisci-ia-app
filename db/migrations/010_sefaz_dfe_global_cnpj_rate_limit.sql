-- A SEFAZ limita o consumo pelo CNPJ, mesmo que o mesmo contribuinte esteja
-- cadastrado em mais de um tenant. A tabela é privada ao proprietário da
-- migração; o runtime só pode consultar/registrar por funções SECURITY DEFINER.
CREATE TABLE IF NOT EXISTS fiscoia.sefaz_dfe_global_request_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cnpj char(14) NOT NULL CHECK (cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$'),
  requested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sefaz_dfe_global_attempts_cnpj_time_idx
  ON fiscoia.sefaz_dfe_global_request_attempts (cnpj, requested_at DESC);

CREATE TABLE IF NOT EXISTS fiscoia.sefaz_dfe_global_request_state (
  cnpj char(14) PRIMARY KEY CHECK (cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$'),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION fiscoia.reserve_sefaz_dfe_request(
  target_cnpj text,
  target_tenant_id uuid,
  target_company_id uuid
)
RETURNS TABLE(allowed boolean, retry_at timestamptz, requests_in_window integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, fiscoia
AS $$
DECLARE
  normalized_cnpj text;
  current_block timestamptz;
  oldest_request timestamptz;
  request_count integer;
BEGIN
  normalized_cnpj := upper(regexp_replace(coalesce(target_cnpj, ''), '[^A-Za-z0-9]', '', 'g'));
  IF normalized_cnpj !~ '^[A-Z0-9]{12}[0-9]{2}$' THEN
    RAISE EXCEPTION 'CNPJ inválido para reserva SEFAZ.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM fiscoia.companies c
     WHERE c.tenant_id = target_tenant_id AND c.id = target_company_id
       AND c.cnpj = normalized_cnpj AND c.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Empresa não autorizada para reserva SEFAZ.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(normalized_cnpj, 0));
  INSERT INTO fiscoia.sefaz_dfe_global_request_state (cnpj)
  VALUES (normalized_cnpj)
  ON CONFLICT (cnpj) DO NOTHING;

  SELECT s.blocked_until INTO current_block
    FROM fiscoia.sefaz_dfe_global_request_state s
   WHERE s.cnpj = normalized_cnpj
   FOR UPDATE;
  IF current_block > now() THEN
    SELECT count(*)::integer INTO request_count
      FROM fiscoia.sefaz_dfe_global_request_attempts a
     WHERE a.cnpj = normalized_cnpj AND a.requested_at > now() - interval '1 hour';
    RETURN QUERY SELECT false, current_block, coalesce(request_count, 0);
    RETURN;
  END IF;

  DELETE FROM fiscoia.sefaz_dfe_global_request_attempts a
   WHERE a.cnpj = normalized_cnpj AND a.requested_at <= now() - interval '1 hour';
  SELECT count(*)::integer, min(a.requested_at)
    INTO request_count, oldest_request
    FROM fiscoia.sefaz_dfe_global_request_attempts a
   WHERE a.cnpj = normalized_cnpj AND a.requested_at > now() - interval '1 hour';

  IF coalesce(request_count, 0) >= 20 THEN
    current_block := oldest_request + interval '1 hour';
    UPDATE fiscoia.sefaz_dfe_global_request_state s
       SET blocked_until = current_block, updated_at = now()
     WHERE s.cnpj = normalized_cnpj;
    RETURN QUERY SELECT false, current_block, request_count;
    RETURN;
  END IF;

  INSERT INTO fiscoia.sefaz_dfe_global_request_attempts (cnpj)
  VALUES (normalized_cnpj);
  RETURN QUERY SELECT true, NULL::timestamptz, coalesce(request_count, 0) + 1;
END;
$$;

CREATE OR REPLACE FUNCTION fiscoia.block_sefaz_dfe_cnpj(
  target_cnpj text,
  target_tenant_id uuid,
  target_company_id uuid,
  target_blocked_until timestamptz
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, fiscoia
AS $$
DECLARE
  normalized_cnpj text;
  effective_block timestamptz;
BEGIN
  normalized_cnpj := upper(regexp_replace(coalesce(target_cnpj, ''), '[^A-Za-z0-9]', '', 'g'));
  IF normalized_cnpj !~ '^[A-Z0-9]{12}[0-9]{2}$' OR target_blocked_until IS NULL THEN
    RAISE EXCEPTION 'Bloqueio SEFAZ inválido.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM fiscoia.companies c
     WHERE c.tenant_id = target_tenant_id AND c.id = target_company_id
       AND c.cnpj = normalized_cnpj AND c.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Empresa não autorizada para bloqueio SEFAZ.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(normalized_cnpj, 0));
  INSERT INTO fiscoia.sefaz_dfe_global_request_state AS current_state (cnpj, blocked_until)
  VALUES (normalized_cnpj, target_blocked_until)
  ON CONFLICT (cnpj) DO UPDATE
    SET blocked_until = greatest(
          coalesce(current_state.blocked_until, '-infinity'::timestamptz),
          EXCLUDED.blocked_until
        ),
        updated_at = now()
  RETURNING blocked_until INTO effective_block;
  RETURN effective_block;
END;
$$;

REVOKE ALL ON TABLE fiscoia.sefaz_dfe_global_request_attempts FROM PUBLIC, fiscoia_runtime;
REVOKE ALL ON TABLE fiscoia.sefaz_dfe_global_request_state FROM PUBLIC, fiscoia_runtime;
REVOKE ALL ON FUNCTION fiscoia.reserve_sefaz_dfe_request(text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION fiscoia.block_sefaz_dfe_cnpj(text, uuid, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fiscoia.reserve_sefaz_dfe_request(text, uuid, uuid) TO fiscoia_runtime;
GRANT EXECUTE ON FUNCTION fiscoia.block_sefaz_dfe_cnpj(text, uuid, uuid, timestamptz) TO fiscoia_runtime;
