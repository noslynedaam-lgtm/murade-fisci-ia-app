-- Atividade da equipe: quem alterou o quê, quando e em qual empresa (só metadados, nunca o conteúdo).
CREATE TABLE IF NOT EXISTS fiscoia.team_activity (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES fiscoia.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  login text NOT NULL,
  acao text NOT NULL,
  rota text NOT NULL,
  cnpj text,
  status integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_activity_tenant_idx ON fiscoia.team_activity(tenant_id, id DESC);
ALTER TABLE fiscoia.team_activity ENABLE ROW LEVEL SECURITY;

-- Registra a atividade no escritório do próprio usuário (descoberto pela associação, nunca informado pelo cliente).
CREATE OR REPLACE FUNCTION fiscoia.log_team_activity(p_user uuid, p_login text, p_acao text, p_rota text, p_cnpj text, p_status integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
DECLARE t uuid;
BEGIN
  SELECT m.tenant_id INTO t FROM fiscoia.tenant_memberships m WHERE m.user_id = p_user ORDER BY (m.role = 'OWNER') DESC, m.created_at LIMIT 1;
  IF t IS NULL THEN RETURN; END IF;
  INSERT INTO fiscoia.team_activity(tenant_id, user_id, login, acao, rota, cnpj, status)
    VALUES (t, p_user, left(p_login, 254), left(p_acao, 200), left(p_rota, 200), p_cnpj, p_status);
  IF random() < 0.01 THEN DELETE FROM fiscoia.team_activity WHERE created_at < now() - interval '180 days'; END IF;
END $$;

-- Só quem é OWNER/ADMIN do escritório lê, e só o do próprio escritório.
CREATE OR REPLACE FUNCTION fiscoia.list_team_activity(p_user uuid, p_login text, p_limit integer)
RETURNS TABLE (login text, acao text, cnpj text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
DECLARE t uuid;
BEGIN
  SELECT m.tenant_id INTO t FROM fiscoia.tenant_memberships m WHERE m.user_id = p_user AND m.role IN ('OWNER', 'ADMIN')
    ORDER BY (m.role = 'OWNER') DESC LIMIT 1;
  IF t IS NULL THEN RAISE EXCEPTION 'Somente o responsável do escritório consulta a atividade.' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT a.login, a.acao, a.cnpj, a.created_at FROM fiscoia.team_activity a
    WHERE a.tenant_id = t AND (p_login = '' OR a.login = p_login) ORDER BY a.id DESC LIMIT least(greatest(p_limit, 1), 200);
END $$;

REVOKE ALL ON FUNCTION fiscoia.log_team_activity(uuid, text, text, text, text, integer), fiscoia.list_team_activity(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fiscoia.log_team_activity(uuid, text, text, text, text, integer), fiscoia.list_team_activity(uuid, text, integer) TO fiscoia_runtime;
