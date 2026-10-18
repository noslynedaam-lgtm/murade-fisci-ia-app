# Backup PostgreSQL do Murade Fisco IA no Render

Status: **backup indisponível no plano atual**. No painel Render foi localizado `murade-banco` (PostgreSQL 18, Free), ID `dpg-db80ev0u01pc738eju5g-a`, no projeto `murade-fiscal`. O painel informa expiração em **13/11/2026** e que o banco será excluído se não for migrado para um plano pago. As opções Recovery/PITR e Create export estão desativadas no Free.

O painel não mostra um serviço chamado Murade Fisco IA ligado a esse recurso. Antes de redirecionar ou migrar serviços, confirme a associação do banco; não altere `DATABASE_URL` de Fiscal, Contábil ou DP durante o backup.

## O que o Render fornece

- O Render oferece recuperação point-in-time (PITR) contínua para instâncias PostgreSQL pagas. A janela depende do plano do workspace: 3 dias no Hobby e 7 dias em Pro ou superior.
- Exportações lógicas manuais pelo painel ficam disponíveis por 7 dias e não são oferecidas para instâncias Free.
- Uma exportação manual é útil para portabilidade, mas não substitui uma cópia externa de longo prazo.

Consulte a [documentação oficial de recuperação e backups do Render](https://render.com/docs/postgresql-backups).

## Configuração no painel (quando o banco certo estiver identificado)

1. No Render, abra `murade-banco` e confirme quais serviços usam o recurso.
2. Selecione um compute pago na página **Plan** para manter o banco após 13/11/2026 e habilitar os recursos de recuperação. Essa mudança tem custo e precisa de decisão explícita do responsável pela conta.
3. Abra **Recovery**, confirme a janela PITR e crie um export lógico com **Create export**. Aguarde a conclusão e baixe o `.dir.tar.gz` para armazenamento controlado fora do Render.
4. Registre a data, o banco de origem e a localização protegida do arquivo. Nunca coloque a URL do banco, senhas ou chaves em issue, chat, arquivo versionado ou log.
5. Faça restaurações apenas em uma instância vazia/de recuperação e valide antes de redirecionar o serviço de produção.

## Retenção externa automatizada

Para retenção além dos sete dias do export manual, o Render documenta um Cron Job que executa `pg_dump` e envia o arquivo para Amazon S3. Isso exige um bucket e credenciais IAM restritas; não está provisionado neste projeto. O custo de S3, o cron e eventual upgrade do PostgreSQL precisam ser conhecidos antes de habilitar a rotina.

Guia oficial: [Back Up Render Postgres to Amazon S3](https://render.com/docs/backup-postgresql-to-s3).

## Critérios para declarar backup ativo

- Recurso PostgreSQL do Fisco IA identificado e associação confirmada.
- PITR ativo (quando plano elegível), ou rotina externa de exportação configurada.
- Pelo menos um backup concluído com horário e retenção verificados.
- Restauração validada em banco separado, sem sobrescrever produção.
- Segredos fornecidos somente nos campos privados do Render; nunca enviados no chat.
