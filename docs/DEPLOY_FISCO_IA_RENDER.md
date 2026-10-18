# Preparar o Fisco IA no Render

## Situação verificada

O workspace Render consultado ainda não mostra um serviço ligado ao repositório `noslynedamurad-maker/murade-fisco-ia`. Os serviços vistos pertencem ao Murade Fiscal, Murade Contábil e DP. Não reutilize o banco `murade-banco` do projeto Fiscal para o Fisco IA.

## Serviço esperado

- Repositório: `noslynedamurad-maker/murade-fisco-ia`
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`
- Readiness path: `/api/ready`
- PostgreSQL: criar ou selecionar um banco exclusivo do Fisco IA na mesma região do serviço.

## Variáveis privadas

Configure no ambiente do serviço, sem prefixo `VITE_` para segredos:

- `DATABASE_URL`: conexão PostgreSQL exclusiva do Fisco IA.
- `FISCOIA_DATA_ENCRYPTION_KEY`: chave aleatória de 32 bytes em Base64; preserve-a e faça backup seguro, pois dados cifrados dependem dela.
- `FISCOIA_DATA_ENCRYPTION_KEY_VERSION`: `v1` na primeira instalação.
- `APP_URL`: URL pública do serviço.
- `GEMINI_API_KEY`: opcional para a assistente.
- `SERPRO_VALIDACAO_CONSUMER_KEY` e `SERPRO_VALIDACAO_CONSUMER_SECRET`: opcional, credenciais de validação.
- `SERPRO_PRODUCAO_CONSUMER_KEY` e `SERPRO_PRODUCAO_CONSUMER_SECRET`: opcional, credenciais de produção.

Nunca coloque credenciais em `VITE_*`, no código, no Git ou no navegador.

## Migração do banco

Depois de conectar o serviço ao banco exclusivo e configurar `DATABASE_URL`, execute `npm run db:migrate` uma vez no ambiente privado do serviço. O script aplica sequencialmente as migrações `001` a `005`, confere checksums e cancela sem alterar o esquema se detectar divergência.

A migração `004_reforma_company_scenarios.sql` cria o armazenamento de cenários da Reforma Tributária, isolado por escritório/empresa e com política RLS. A migração `005_reforma_rules_version_day.sql` permite versionar a base legal por data e mantém válidos cenários salvos na versão antiga. `/api/ready` deve retornar HTTP 200 e informar schema migrado antes de considerar a persistência ativa.

## Atualizar a base legal da Reforma

Os resumos e links oficiais ficam em `src/data/reformaTributariaRegras.ts`. Uma atualização exige revisar as fontes oficiais, corrigir os resumos, incrementar `VERSAO_REGRAS` e atualizar `REGRAS_REVISADAS_EM`. A interface identifica cenários gravados com uma versão anterior e avisa que as confirmações antigas não foram revalidadas. Salvar ou exportar não troca silenciosamente a versão registrada; a versão atual só é gravada depois de marcar todos os itens como conferidos e confirmar explicitamente. O registro atual não mantém versões históricas completas do cenário: salvar substitui os dados da versão corrente. Não há atualização automática nem importação de texto legal sem revisão.

O cadastro inicial do administrador deve ser feito somente depois das migrações, com `FISCOIA_BOOTSTRAP_EMAIL`, `FISCOIA_BOOTSTRAP_NAME` e `FISCOIA_BOOTSTRAP_PASSWORD` temporários no ambiente privado, executando `npm run db:bootstrap-admin` uma vez. Remova essas três variáveis após a criação da conta.

## Estado de validação

Build e TypeScript passaram no checkout local. O deploy e a conexão com PostgreSQL ainda não foram validados em produção; não há confirmação de serviço Render do Fisco IA neste workspace.
