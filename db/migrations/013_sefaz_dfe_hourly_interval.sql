-- Enforce one outbound Distribuicao DF-e request per CNPJ every 61 minutes.
-- This is shared across tenants and Render instances, and records failed network
-- attempts too because the reservation is committed before the HTTP request.
CREATE TABLE IF NOT EXISTS fiscoia.sefaz_dfe_global_dispatch_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  requested_at timestamptz
);
INSERT INTO fiscoia.sefaz_dfe_global_dispatch_state (singleton)
VALUES (true) ON CONFLICT (singleton) DO NOTHING;

REVOKE ALL ON TABLE fiscoia.sefaz_dfe_global_dispatch_state FROM PUBLIC, fiscoia_runtime;

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
  latest_request timestamptz;
  latest_global_request timestamptz;
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

  -- A global lock plus timestamp keeps all service instances to one outbound
  -- request per minute, with companies naturally staggered across those slots.
  PERFORM pg_advisory_xact_lock(hashtextextended('fiscoia.sefaz_dfe_global_dispatch', 0));
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

  SELECT max(a.requested_at) INTO latest_request
    FROM fiscoia.sefaz_dfe_global_request_attempts a
   WHERE a.cnpj = normalized_cnpj;
  IF latest_request > now() - interval '61 minutes' THEN
    SELECT count(*)::integer INTO request_count
      FROM fiscoia.sefaz_dfe_global_request_attempts a
     WHERE a.cnpj = normalized_cnpj AND a.requested_at > now() - interval '1 hour';
    RETURN QUERY SELECT false, latest_request + interval '61 minutes', coalesce(request_count, 0);
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

  SELECT requested_at INTO latest_global_request
    FROM fiscoia.sefaz_dfe_global_dispatch_state
   WHERE singleton = true
   FOR UPDATE;
  IF latest_global_request > now() - interval '1 minute' THEN
    RETURN QUERY SELECT false, latest_global_request + interval '1 minute', coalesce(request_count, 0);
    RETURN;
  END IF;

  INSERT INTO fiscoia.sefaz_dfe_global_request_attempts (cnpj) VALUES (normalized_cnpj);
  UPDATE fiscoia.sefaz_dfe_global_dispatch_state
     SET requested_at=now() WHERE singleton=true;
  RETURN QUERY SELECT true, NULL::timestamptz, coalesce(request_count, 0) + 1;
END;
$$;

REVOKE ALL ON FUNCTION fiscoia.reserve_sefaz_dfe_request(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fiscoia.reserve_sefaz_dfe_request(text, uuid, uuid) TO fiscoia_runtime;
