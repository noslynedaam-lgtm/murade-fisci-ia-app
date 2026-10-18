# Preparar o Fisco IA no Render

## Situação verificada

O serviço `murade-fisco-ia` está publicado no Render. A implantação inicial usa temporariamente o PostgreSQL existente do Murade Fiscal, com credencial de runtime restrita ao schema `fiscoia`; depois deverá ser migrada para um PostgreSQL dedicado.

## Serviço esperado

- Repositório: `noslynedamurad-maker/murade-fisco-ia`
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`
- Readiness path: `/api/ready`
- PostgreSQL: usar temporariamente o serviço existente do Murade Fiscal com schema e papel de runtime limitados conforme abaixo. Não reutilizar a `DATABASE_URL` administrativa no serviço web. Migrar para serviço PostgreSQL próprio quando o plano dedicado estiver disponível.

## Variáveis privadas

Configure no ambiente do serviço, sem prefixo `VITE_` para segredos:

- `FISCOIA_PGHOST`, `FISCOIA_PGPORT`, `FISCOIA_PGDATABASE`, `FISCOIA_PGUSER`, `FISCOIA_PGPASSWORD`: credencial de runtime do papel `fiscoia_runtime`, sem acesso a outros schemas. Em produção, o serviço web ignora `DATABASE_URL` administrativa.
- `FISCOIA_PGSSL`: `true` para conexão externa TLS com verificação de certificado; `false` somente para tráfego interno na mesma região do Render.
- `DATABASE_URL`: use apenas no job privado de provisionamento inicial do papel/schema. Nunca coloque no serviço web.
- `FISCOIA_MIGRATION_DATABASE_URL`: credencial administrativa, somente em jobs privados de migração/bootstrap. Nunca coloque no serviço web.
- `FISCOIA_DATA_ENCRYPTION_KEY`: chave aleatória de 32 bytes em Base64; preserve-a e faça backup seguro, pois dados cifrados dependem dela.
- `FISCOIA_DATA_ENCRYPTION_KEY_VERSION`: `v1` na primeira instalação.
- `APP_URL`: URL pública do serviço.
- `GEMINI_API_KEY`: opcional para a assistente.
- `SERPRO_VALIDACAO_CONSUMER_KEY` e `SERPRO_VALIDACAO_CONSUMER_SECRET`: opcional, credenciais de validação.
- `SERPRO_PRODUCAO_CONSUMER_KEY` e `SERPRO_PRODUCAO_CONSUMER_SECRET`: opcional, credenciais de produção.

O estado e o alcance do teste SERPRO estão descritos em [`INTEGRACAO_SERPRO.md`](./INTEGRACAO_SERPRO.md). A autenticação OAuth do gateway não substitui contrato nem valida acesso a APIs de produto.

Nunca coloque credenciais em `VITE_*`, no código, no Git ou no navegador.

## Migração do banco

### PostgreSQL compartilhado com schema restrito (configuração inicial autorizada)

O serviço web não deve receber a URL administrativa do Murade Fiscal. O schema `fiscoia` foi provisionado com o papel administrativo do banco como proprietário e uma credencial de runtime separada para `fiscoia_runtime`. Não reutiliza nem altera tabelas de outro schema.

Configure o serviço web apenas com `FISCOIA_PGHOST`, `FISCOIA_PGPORT`, `FISCOIA_PGDATABASE`, `FISCOIA_PGUSER=fiscoia_runtime` e a mesma senha secreta `FISCOIA_PGPASSWORD`. Para esse serviço, não configure `DATABASE_URL` nem `FISCOIA_MIGRATION_DATABASE_URL`.

Execute migração e bootstrap em jobs privados separados com `FISCOIA_MIGRATION_DATABASE_URL` administrativa. O runner aplica as migrações, confere checksums, concede ao runtime somente DML/uso de sequência dentro de `fiscoia` e mantém o log de migração somente para leitura. O runtime não é dono das tabelas, não tem privilégios de DDL, e as políticas RLS continuam ativas. O bootstrap usa a conexão administrativa temporária para inserir a primeira conta; nunca use a credencial de runtime para essa tarefa.

Não coloque URLs administrativas, senhas de banco, chave de criptografia ou credenciais SERPRO em variáveis `VITE_*`. Não copie a senha para logs nem para o Git. O PostgreSQL compartilhado mantém backups, restaurações, capacidade e disponibilidade no nível do serviço inteiro; durante essa fase o Fisco IA continua dependente operacionalmente do banco do Fiscal. Após contratar o plano dedicado, provisionar o PostgreSQL próprio do Fisco IA e migrar os dados.

A migração `004_reforma_company_scenarios.sql` cria o armazenamento de cenários da Reforma Tributária, isolado por escritório/empresa e com política RLS. A migração `005_reforma_rules_version_day.sql` permite versionar a base legal por data e mantém válidos cenários salvos na versão antiga. A migração `006_tenant_provisioning.sql` mantém a criação de escritórios restrita ao administrador central. `/api/ready` deve retornar HTTP 200 e informar schema migrado antes de considerar a persistência ativa.

## Atualizar a base legal da Reforma

Os resumos e links oficiais ficam em `src/data/reformaTributariaRegras.ts`. Uma atualização exige revisar as fontes oficiais, corrigir os resumos, incrementar `VERSAO_REGRAS` e atualizar `REGRAS_REVISADAS_EM`. A interface identifica cenários gravados com uma versão anterior e avisa que as confirmações antigas não foram revalidadas. Salvar ou exportar não troca silenciosamente a versão registrada; a versão atual só é gravada depois de marcar todos os itens como conferidos e confirmar explicitamente. O registro atual não mantém versões históricas completas do cenário: salvar substitui os dados da versão corrente. Não há atualização automática nem importação de texto legal sem revisão.

O cadastro inicial do administrador deve ser feito somente depois das migrações, com `FISCOIA_BOOTSTRAP_EMAIL`, `FISCOIA_BOOTSTRAP_NAME` e `FISCOIA_BOOTSTRAP_PASSWORD` temporários em um job privado, executando `npm run db:bootstrap-admin` uma vez. A senha deve ter pelo menos 16 caracteres; a conta exige troca de senha no primeiro login. O script aborta sem alterações se já houver qualquer conta. Remova a URL administrativa e as três variáveis de bootstrap ao terminar.

## Estado de validação

O deploy e a conexão com PostgreSQL foram validados em produção por `/api/ready`: banco conectado, seis de seis migrações aplicadas e chave de criptografia válida. A conta inicial de administrador ainda precisa ser criada pelo bootstrap único; a tela pública de login não oferece cadastro aberto.
