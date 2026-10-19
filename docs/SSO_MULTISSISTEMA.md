# Acesso único aos sistemas Murade

## Situação e limites

Fiscal, Contábil e Departamento Pessoal ainda mantêm usuários, sessões e permissões locais. O Fisco IA tem uma base própria de identidade. Não é seguro inferir que dois logins iguais pertencem à mesma pessoa nem copiar hashes de senha entre bancos. Os cookies HTTP-only dos serviços Render também não são compartilháveis.

Esta etapa adiciona ao Fisco IA um provedor OAuth 2 Authorization Code com PKCE S256, códigos de uso único, tokens opacos com validade curta, endpoint de perfil e concessões explícitas por usuário e sistema. Ela ainda não cria sessão nos outros módulos; isso requer um adaptador e vínculo de conta em cada um.

Mesmo depois do login único, cada módulo deve continuar verificando suas permissões locais por empresa, função e estado da conta. Uma concessão de acesso ao sistema não concede acesso a empresas.

## Rotas disponíveis

- `GET /api/sso/authorize`: valida cliente, retorno exato, state e PKCE; exige sessão Fisco IA e concessão ativa daquele sistema.
- `POST /api/sso/token`: troca o código de uso único, autenticado com HTTP Basic do cliente e `code_verifier`.
- `GET /api/sso/userinfo`: valida token Bearer e retorna `sub`; inclui `email` e `name` conforme os escopos concedidos.
- `POST /api/sso/revoke`: revoga o token do cliente autenticado.
- `GET /api/sso/apps`: lista sistemas configurados aos quais a sessão atual recebeu concessão.
- `PUT /api/sso/apps/:clientId/users/:userId` e `DELETE ...`: concessão/revogação por administrador central. A operação não altera permissões locais de empresa.

Escopos aceitos: `email` e `profile`. O serviço não se anuncia como OpenID Connect nem emite `id_token`; clientes devem usar o token opaco no endpoint de userinfo pelo servidor, nunca confiar em dados enviados pelo navegador.

## Configuração privada do provedor

Quando os adaptadores estiverem prontos, configure `FISCOIA_OIDC_CLIENTS_JSON` como variável privada no serviço Fisco IA. Esse é o nome lido pelo servidor. Valor de formato (substitua tudo pelos dados reais; não use esse exemplo literalmente):

```json
[
  {
    "clientId": "murade-fiscal",
    "clientSecret": "SEGREDO_ALEATORIO_COM_PELO_MENOS_32_CARACTERES",
    "redirectUris": ["https://DOMINIO-DO-FISCAL/api/sso/callback"],
    "name": "Murade Fiscal"
  }
]
```

Inclua cada cliente somente quando o adaptador correspondente existir. Use HTTPS, URL de callback exata e segredo diferente por serviço; coloque o segredo correspondente também como variável privada somente no serviço cliente. Não envie segredos pelo chat. A aplicação recusa URIs HTTP e não permite curingas.

## Próximas etapas

1. Fazer adaptador de callback em Fiscal, Contábil e DP, um por vez: state aleatório guardado em cookie curto HttpOnly/Secure/SameSite, PKCE, troca servidor-servidor, userinfo e sessão local renovada. Falhas devem deixar a conta local utilizável.
2. Criar fluxo de vínculo explícito da identidade central com a conta local já existente. Não vincular por e-mail ou nome sem confirmação autenticada da conta dos dois lados.
3. Dar ao administrador uma tela para conceder sistemas e empresas, com histórico auditável.
4. Só então mostrar o portal de atalhos, filtrado pelas concessões e acessos ativos.
5. Validar em homologação com contas separadas antes de configurar clientes ou migrar usuários em produção.

## Migração e publicação

A migração `011_central_sso_authorization.sql` cria concessões, códigos e tokens. O contador de migrações do serviço também foi atualizado para 11. Ela não foi executada contra produção. O próximo deploy do Fisco IA requer executar `npm run db:migrate` com a credencial administrativa restrita de migração antes de ativar clientes. Sem cliente cadastrado e sem os três adaptadores, os endpoints centrais não habilitam login único em produção.
