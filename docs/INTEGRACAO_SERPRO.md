# Integração SERPRO

## Estado implementado

- `POST /api/serpro/token-check` está restrito à conta administradora.
- O operador escolhe homologação ou produção e confirma a ação na tela. O servidor usa o par OAuth correspondente configurado como segredo no Render para solicitar um token ao gateway SERPRO.
- O token de acesso é descartado no servidor; credenciais e token não são devolvidos ao navegador nem gravados em log.
- O resultado confirma apenas a autenticação OAuth do gateway. Não consulta CNPJ, notas, CND, DCTFWeb, procurações, guias ou qualquer API fiscal específica.

## Segredos por ambiente

Configure no Render, no serviço Fisco IA, somente os pares fornecidos pelo SERPRO:

- Validação: `SERPRO_VALIDACAO_CONSUMER_KEY` e `SERPRO_VALIDACAO_CONSUMER_SECRET`.
- Produção: `SERPRO_PRODUCAO_CONSUMER_KEY` e `SERPRO_PRODUCAO_CONSUMER_SECRET`.

Não cole segredos na tela, no Git, em variáveis `VITE_*` ou no chat. Depois de salvar os segredos no Render e concluir o deploy, um administrador pode usar **Testar OAuth do gateway**. Isso envia uma solicitação de token ao ambiente escolhido. O resultado não valida contrato, escopos, permissões ou endpoint de uma API de produto.

## Próxima etapa de integração

Cada produto SERPRO tem documentação, permissões, dados de entrada e endpoint próprios. Antes de implementar chamadas fiscais, identifique no contrato/Área do Cliente o produto efetivamente contratado e consulte sua documentação técnica vigente. Não reutilizar o token-check como se fosse integração fiscal nem presumir que Consumer Key/Secret autorizam qualquer API.

Referências oficiais: [Suporte e documentação de produtos SERPRO](https://www.serpro.gov.br/menu/suporte/ajuda-ao-cliente), [Área do Cliente e geração de chaves](https://centraldeajuda.serpro.gov.br/duvidas/pt/area-do-cliente/chaves/) e [Consulta CNPJ — serviço SERPRO](https://www.serpro.gov.br/menu/suporte/css).
