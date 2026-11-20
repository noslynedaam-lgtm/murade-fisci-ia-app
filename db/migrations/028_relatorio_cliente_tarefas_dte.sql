-- Relatório para o cliente, tarefas da equipe e checklist do DT-e de Goiás.
-- 1) dados_escritorio passa a aceitar três coleções novas (tudo por escritório, isolado como as demais):
--    relatorio_cliente  -> configuração do relatório (nome exibido, contato, rodapé e logo do escritório em JPEG);
--    tarefas_equipe     -> lista simples de tarefas da equipe (criadas à mão, pelo relatório, pelo DT-e ou pela Agente);
--    dte_go             -> checklist por empresa do DT-e de Goiás (credenciada, e-mail de avisos, procuração; tem/não tem/não se aplica).
-- 2) Robô conferidor (só a conta administradora, só leitura, só CONTAGENS por escritório: nunca empresa, CNPJ ou texto da tarefa).
-- Nada aqui consulta o Serpro, a SEFAZ ou o DT-e. Idempotente: pode rodar de novo sem duplicar nem apagar dados.

ALTER TABLE fiscoia.dados_escritorio DROP CONSTRAINT IF EXISTS dados_escritorio_colecao_check;
ALTER TABLE fiscoia.dados_escritorio ADD CONSTRAINT dados_escritorio_colecao_check
  CHECK (colecao IN ('agenda_lembretes', 'compliance_status', 'guias_receita', 'relatorio_cliente', 'tarefas_equipe', 'dte_go'));

-- Tarefas em aberto e atrasadas; empresas de Goiás do checklist do DT-e com item "não tem" e revisões vencidas.
CREATE OR REPLACE FUNCTION fiscoia.platform_tarefas_dte(p_admin uuid, p_hoje date)
RETURNS TABLE (tenant_id uuid, tenant_name text, tarefas_abertas integer, tarefas_atrasadas integer, dte_sem_procuracao integer, dte_sem_email integer, dte_nao_credenciada integer, dte_revisao_vencida integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fiscoia, pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscoia.users u WHERE u.id = p_admin AND u.active AND u.is_admin) THEN
    RAISE EXCEPTION 'Somente a conta administradora confere as tarefas e o DT-e.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.conferidor_robo', 'on', true);
  RETURN QUERY
    WITH t AS (
      SELECT d.tenant_id,
             count(*) FILTER (WHERE COALESCE(d.dados->>'concluida', 'false') <> 'true')::integer AS abertas,
             count(*) FILTER (WHERE COALESCE(d.dados->>'concluida', 'false') <> 'true'
                                AND (d.dados->>'prazo') ~ '^\d{4}-\d{2}-\d{2}$' AND (d.dados->>'prazo')::date < p_hoje)::integer AS atrasadas
        FROM fiscoia.dados_escritorio d WHERE d.colecao = 'tarefas_equipe' GROUP BY d.tenant_id
    ), g AS (
      SELECT d.tenant_id,
             count(*) FILTER (WHERE d.dados->>'procuracao' = 'nao_tem')::integer AS sem_proc,
             count(*) FILTER (WHERE d.dados->>'emailAvisos' = 'nao_tem')::integer AS sem_email,
             count(*) FILTER (WHERE d.dados->>'credenciada' = 'nao_tem')::integer AS nao_cred,
             count(*) FILTER (WHERE (d.dados->>'revisarEm') ~ '^\d{4}-\d{2}-\d{2}$' AND (d.dados->>'revisarEm')::date <= p_hoje)::integer AS revisao
        FROM fiscoia.dados_escritorio d
        JOIN fiscoia.companies c ON c.tenant_id = d.tenant_id AND c.id::text = d.chave AND c.archived_at IS NULL
       WHERE d.colecao = 'dte_go' GROUP BY d.tenant_id
    )
    SELECT tn.id, tn.name, COALESCE(t.abertas, 0), COALESCE(t.atrasadas, 0), COALESCE(g.sem_proc, 0), COALESCE(g.sem_email, 0), COALESCE(g.nao_cred, 0), COALESCE(g.revisao, 0)
      FROM t FULL JOIN g ON g.tenant_id = t.tenant_id
      JOIN fiscoia.tenants tn ON tn.id = COALESCE(t.tenant_id, g.tenant_id)
     WHERE COALESCE(t.atrasadas, 0) + COALESCE(g.sem_proc, 0) + COALESCE(g.sem_email, 0) + COALESCE(g.nao_cred, 0) + COALESCE(g.revisao, 0) + COALESCE(t.abertas, 0) > 0;
  PERFORM set_config('app.conferidor_robo', '', true);
END $$;

REVOKE ALL ON FUNCTION fiscoia.platform_tarefas_dte(uuid, date) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscoia_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON fiscoia.dados_escritorio TO fiscoia_runtime;
    GRANT EXECUTE ON FUNCTION fiscoia.platform_tarefas_dte(uuid, date) TO fiscoia_runtime;
  END IF;
END $$;
