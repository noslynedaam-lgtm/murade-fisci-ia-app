# Preparar o Fisco IA no Render

## Situação verificada

O serviço `murade-fisco-ia` está publicado no Render. A implantação inicial usa temporariamente o PostgreSQL existente do Murade Fiscal, com credencial de runtime restrita ao schema `fiscoia`; depois deverá ser migrada para um PostgreSQL dedicado.

## Serviço esperado

- Repositório: `noslynedaam-lgtm/murade-fisci-ia-app`
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`
- Readiness path: `/api/ready`
- PostgreSQL: usar temporariamente o serviço existente do Murade Fiscal com schema e papel de runtime limitados conforme abaixo. Não reutilizar a `DATABASE_URL` administrativa no serviço web. Migrar para serviço PostgreSQL próprio quando o plano dedicado estiver disponível.

## Variáveis privadas

Configure no ambiente do serviço, sem prefixo `VITE_` para segredos:

- `FISCOIA_PGHOST`, `FISCOIA_PGPORT`, `FISCOIA_PGDATABASE`, `FISCOIA_PGUSER`, `FISCOIA_PGPASSWORD`: credencial de runtime do papel `fiscoia_runtime`. Antes de usar, confirme os privilégios efetivos com `npm run db:provision-status`, inclusive grants herdados de `PUBLIC`. Em produção, o serviço web ignora `DATABASE_URL` administrativa.
- `FISCOIA_PGSSL`: `true` para conexão externa TLS com verificação de certificado; `false` somente para tráfego interno na mesma região do Render.
- `DATABASE_URL`: use apenas no job privado de provisionamento inicial do papel/schema. Nunca coloque no serviço web.
- `FISCOIA_MIGRATION_DATABASE_URL`: credencial administrativa, somente em jobs privados de migração/bootstrap. Nunca coloque no serviço web.
- `FISCOIA_DATA_ENCRYPTION_KEY`: chave aleatória de 32 bytes em Base64; preserve-a e faça backup seguro, pois dados cifrados dependem dela.
- `FISCOIA_DATA_ENCRYPTION_KEY_VERSION`: `v1` na primeira instalação.
- `APP_URL`: URL pública HTTPS do serviço. Usada para formar links de convite de primeiro acesso. O convite é entregue como link de uso único, expira em 48 horas e não é enviado por e-mail automaticamente.
- `GEMINI_API_KEY`: opcional para a assistente.
- `SERPRO_VALIDACAO_CONSUMER_KEY` e `SERPRO_VALIDACAO_CONSUMER_SECRET`: opcional, credenciais de validação.
- `SERPRO_PRODUCAO_CONSUMER_KEY` e `SERPRO_PRODUCAO_CONSUMER_SECRET`: opcional, credenciais de produção.
- `MURADE_INTEGRATION_TOKEN`: segredo servidor-servidor igual ao configurado no Murade Fiscal. Usado somente pela sincronização autenticada de documentos fiscais; nunca exponha com prefixo `VITE_`.
- `MURADE_FISCAL_SERVER_URL`: URL HTTPS do serviço Murade Fiscal. O sincronizador aceita apenas `https://murade-fiscal-1.onrender.com`.

A sincronização Fiscal → Fisco IA é iniciada por usuário autenticado, empresa e período, com confirmação na tela. Ela importa somente XMLs completos entregues pelo contrato servidor-servidor, valida CNPJ/chave/modelo novamente, cifra o XML no PostgreSQL e deixa os documentos como `PENDING_REVIEW`. Cada execução limita-se a 20 documentos, busca no máximo dois XMLs por página e pode continuar pela paginação. Metadados sem XML completo são reportados, sem gerar XML fictício. Não cria lançamentos nem transmite declarações ou guias.

O estado e o alcance do teste SERPRO estão descritos em [`INTEGRACAO_SERPRO.md`](./INTEGRACAO_SERPRO.md). A autenticação OAuth do gateway não substitui contrato nem valida acesso a APIs de produto.

Nunca coloque credenciais em `VITE_*`, no código, no Git ou no navegador.

### Aviso de dependência do certificado A1

O `npm audit` de 21/10/2026 reporta vulnerabilidade alta em `node-forge` até a versão 1.4.0 e não indica versão corrigida. O Fisco IA usa essa biblioteca em `src/server/pfxCompat.ts` para reempacotar arquivos A1 legados quando o OpenSSL do Node não consegue abri-los. O Vite foi atualizado no lockfile para 6.4.5, que remove os avisos corrigíveis do auditor. Não há atualização automática segura para `node-forge` enquanto não houver versão corrigida; avaliar substituição do conversor e validar compatibilidade com certificados A1 legados antes de alterar esse fluxo.

## Migração do banco

### Conferir antes de alterar o banco

Use `npm run db:provision-status` em um job privado com `DATABASE_URL` administrativa antes de decidir sobre papéis e schema. O comando é somente leitura; lista o proprietário do schema, atributos e associações do papel runtime e privilégios efetivos em schemas, tabelas e sequências fora de `fiscoia`, incluindo grants via `PUBLIC`. Também falha se o runtime puder criar schemas, alterar o ledger de migrações, contornar RLS ou assumir outro papel. Não conecte o runtime ao serviço até resolver todo alerta. Em banco compartilhado, revogar privilégios de `PUBLIC` pode afetar outros sistemas; considere banco dedicado.

Use `npm run db:status` em um job privado com `FISCOIA_MIGRATION_DATABASE_URL`. O comando é somente leitura: compara o ledger `fiscoia.schema_migrations` com os arquivos locais, incluindo SHA-256, e aponta migrações pendentes, checksums divergentes ou versões desconhecidas. Não imprime a URL nem altera o banco. Repita a conferência depois de cada job de migração.

Antes de provisionar o papel e o schema, confira o estado existente no PostgreSQL. `npm run db:provision-shared-role` aborta intencionalmente se `fiscoia`, `fiscoia_runtime` ou `fiscoia_schema_owner` já existir. Nesse caso, não apague nem recrie objetos: inspecione os papéis e permissões existentes e só então escolha o próximo passo. Se o schema ainda não existir, faça o provisionamento autorizado uma única vez; depois execute `npm run db:migrate` em job privado e confirme `npm run db:status` sem pendências ou divergências.

Não execute o bootstrap administrativo sem confirmar primeiro se já existe uma conta. O procedimento histórico abaixo registra que o primeiro acesso já foi concluído.

### PostgreSQL compartilhado com schema restrito (configuração inicial autorizada)

O serviço web não deve receber a URL administrativa do Murade Fiscal. O provisionador cria `fiscoia_runtime` e cria o schema `fiscoia` sob o usuário administrativo conectado. Ele não cria o papel `fiscoia_schema_owner`; esse nome é tratado como reservado e, se já existir, a rotina aborta para inspeção manual. O papel runtime não recebe grants diretos em outros schemas, mas privilégios concedidos a `PUBLIC` podem continuar efetivos. Execute `npm run db:provision-status` e resolva qualquer acesso externo a objetos ou `CREATE` antes de usar o runtime.

Configure o serviço web apenas com `FISCOIA_PGHOST`, `FISCOIA_PGPORT`, `FISCOIA_PGDATABASE`, `FISCOIA_PGUSER=fiscoia_runtime` e a mesma senha secreta `FISCOIA_PGPASSWORD`. Para esse serviço, não configure `DATABASE_URL` nem `FISCOIA_MIGRATION_DATABASE_URL`.

Execute migração e bootstrap em jobs privados separados com `FISCOIA_MIGRATION_DATABASE_URL` administrativa. O runner aplica as migrações, confere checksums, concede ao runtime somente DML/uso de sequência dentro de `fiscoia` e mantém o log de migração somente para leitura. O runtime não é dono das tabelas, não tem privilégios de DDL, e as políticas RLS continuam ativas. O bootstrap usa a conexão administrativa temporária para inserir a primeira conta; nunca use a credencial de runtime para essa tarefa.

**Importante no Render:** um One-Off Job herda uma fotografia da configuração e das variáveis de ambiente do serviço-base. Portanto, não adicione `FISCOIA_MIGRATION_DATABASE_URL` ao serviço Web público para tentar executar o job por ele. Use um serviço-base privado, sem URL pública, dedicado à migração, com o mesmo repositório/build e somente os segredos estritamente necessários; execute `npm run db:migrate` nele e remova a variável administrativa do serviço privado assim que a migração terminar. Mantenha a credencial `FISCOIA_PG*` de runtime apenas no Web Service. A documentação do Render descreve essa herança de configuração dos One-Off Jobs: https://render.com/docs/one-off-jobs.

Não coloque URLs administrativas, senhas de banco, chave de criptografia ou credenciais SERPRO em variáveis `VITE_*`. Não copie a senha para logs nem para o Git. O PostgreSQL compartilhado mantém backups, restaurações, capacidade e disponibilidade no nível do serviço inteiro; durante essa fase o Fisco IA continua dependente operacionalmente do banco do Fiscal. Após contratar o plano dedicado, provisionar o PostgreSQL próprio do Fisco IA e migrar os dados.

A migração `004_reforma_company_scenarios.sql` cria o armazenamento de cenários da Reforma Tributária, isolado por escritório/empresa e com política RLS. A migração `005_reforma_rules_version_day.sql` permite versionar a base legal por data e mantém válidos cenários salvos na versão antiga. A migração `006_tenant_provisioning.sql` mantém a criação de escritórios restrita ao administrador central. `/api/ready` deve retornar HTTP 200 e informar schema migrado antes de considerar a persistência ativa.

## Atualizar a base legal da Reforma

Os resumos e links oficiais ficam em `src/data/reformaTributariaRegras.ts`. Uma atualização exige revisar as fontes oficiais, corrigir os resumos, incrementar `VERSAO_REGRAS` e atualizar `REGRAS_REVISADAS_EM`. A interface identifica cenários gravados com uma versão anterior e avisa que as confirmações antigas não foram revalidadas. Salvar ou exportar não troca silenciosamente a versão registrada; a versão atual só é gravada depois de marcar todos os itens como conferidos e confirmar explicitamente. O registro atual não mantém versões históricas completas do cenário: salvar substitui os dados da versão corrente. Não há atualização automática nem importação de texto legal sem revisão.

O cadastro inicial do administrador deve ser feito somente depois das migrações, com `FISCOIA_BOOTSTRAP_EMAIL`, `FISCOIA_BOOTSTRAP_NAME` e `FISCOIA_BOOTSTRAP_PASSWORD` temporários em um job privado, executando `npm run db:bootstrap-admin` uma vez. A senha deve ter pelo menos 16 caracteres; a conta exige troca de senha no primeiro login. O script aborta sem alterações se já houver qualquer conta. Remova a URL administrativa e as três variáveis de bootstrap ao terminar.

## Estado conhecido de produção

Registro histórico de 18/10/2026: `GET https://murade-fisco-ia.onrender.com/api/ready` respondeu HTTP 200, com PostgreSQL conectado, seis de seis migrações obrigatórias aplicadas e chave de criptografia válida. Esse resultado não confirma o estado atual. O código deste repositório espera 12 migrações; confira o serviço e o banco atuais antes de assumir qualquer versão implantada. O primeiro acesso administrativo já havia sido confirmado; não execute bootstrap sem verificar novamente a existência da conta.

### Sequência segura para preparar o serviço atual

1. Confirme qual serviço Render usa este repositório e commit. A checagem `/api/ready` deve considerar 12 migrações esperadas; não promova o Web Service antes de preparar o banco correspondente.
2. Em um job privado, configure temporariamente `DATABASE_URL` administrativa e rode `npm run db:provision-status`. Se o schema ou algum papel reservado existir, não rode o provisionador; inspecione a configuração encontrada. Se não existir nenhum deles, confirme privilégios de criação e privilégios efetivos antes de decidir sobre `npm run db:provision-shared-role`.
3. Depois de provisionar, rode novamente `npm run db:provision-status`. Verifique o proprietário do schema e confirme que o runtime não tem `CREATE` nem acesso de leitura/escrita a objetos fora de `fiscoia`. Grants herdados de `PUBLIC` contam; em um banco compartilhado, mudar grants globais pode afetar o Murade Fiscal.
4. Em job privado com `FISCOIA_MIGRATION_DATABASE_URL`, execute `npm run db:migrate`. A tarefa aplica as migrações pendentes em transação e valida checksums; não configure a URL administrativa no Web Service público.
5. Rode `npm run db:status` no mesmo job privado. Prossiga somente com 12/12 aplicadas, sem checksums divergentes, pendências ou versões desconhecidas. Remova as credenciais administrativas temporárias após as tarefas.
6. Configure no Web Service somente as variáveis de runtime `FISCOIA_PG*` e a chave persistente `FISCOIA_DATA_ENCRYPTION_KEY`; não troque uma chave já usada para cifrar dados. Confira `/api/ready` em HTTP 200 e `schema.desconhecidas` igual a zero.
7. Não execute `npm run db:bootstrap-admin` se já houver uma conta. O registro histórico diz que o primeiro acesso foi concluído; confirme isso antes de qualquer bootstrap.
8. Depois da prontidão do banco e do serviço, faça uma consulta SEFAZ real sob demanda, com A1 da empresa e confirmação explícita. Confira a resposta oficial, a persistência cifrada e a auditoria.

O Render informa que um One-Off Job usa o artefato de build mais recente e uma fotografia das variáveis do serviço-base no momento da criação. Assim, use como base um serviço privado de migração que já tenha o artefato correto e apenas o segredo administrativo necessário; não reutilize o Web Service público enquanto isso exigir adicionar nele a URL administrativa. Após alterar o serviço-base, crie um novo job para obter a configuração atualizada. Consulte a [documentação oficial de One-Off Jobs do Render](https://render.com/docs/one-off-jobs).

Não executar migração com o usuário runtime nem manter `FISCOIA_MIGRATION_DATABASE_URL` no serviço web público.
