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

## Pré-requisito para consulta fiscal de NF-e

Antes de implementar ou habilitar uma consulta fiscal SERPRO, confirme na Área do Cliente que a empresa possui o produto **Consulta NF-e** contratado e disponível para o perfil/contrato correspondente. Obtenha a documentação técnica vigente daquele produto (endpoint, escopos, parâmetros, limites, respostas e ambiente de validação) pela própria Área do Cliente ou pelo suporte oficial do SERPRO. Não presumir que um par de chaves OAuth, uma chave da API Consulta CNPJ ou o certificado A1 da empresa concedem acesso à Consulta NF-e.

As chaves podem ser compartilhadas entre serviços contratados que usam o mesmo mecanismo; gerar ou renovar uma chave pode afetar outras integrações. Portanto, não gerar nem renovar chaves como tentativa de diagnóstico sem planejar a atualização de todos os serviços que as utilizam. A orientação oficial do SERPRO descreve a geração de chaves por produto e alerta sobre esse compartilhamento: [Gerar/Renovar Chaves](https://centraldeajuda.serpro.gov.br/duvidas/pt/area-do-cliente/gerarenovchave/).

O serviço oficial de Distribuição DF-e da SEFAZ descrito em [`INTEGRACAO_SEFAZ_DFE.md`](./INTEGRACAO_SEFAZ_DFE.md) é uma integração separada. A API SERPRO Consulta NF-e não deve ser tratada como ativada até que o produto contratado, sua documentação técnica e uma chamada autorizada de validação estejam confirmados. Consultas de produção podem gerar consumo/faturamento conforme o contrato do produto; validar o preço e as regras atuais diretamente na Área do Cliente antes de habilitá-las.

## Próxima etapa de integração

Cada produto SERPRO tem documentação, permissões, dados de entrada e endpoint próprios. Após confirmar o produto Consulta NF-e, implementar o adaptador usando somente sua documentação vigente, separando validação e produção e mantendo consulta por empresa, limites, auditoria e proteção de dados. Não reutilizar o token-check como se fosse integração fiscal nem presumir que Consumer Key/Secret autorizam qualquer API.

Referências oficiais: [Suporte e documentação de produtos SERPRO](https://www.serpro.gov.br/menu/suporte/ajuda-ao-cliente), [Área do Cliente e geração de chaves](https://centraldeajuda.serpro.gov.br/duvidas/pt/area-do-cliente/chaves/), [Gerar/Renovar Chaves](https://centraldeajuda.serpro.gov.br/duvidas/pt/area-do-cliente/gerarenovchave/) e [Documentação Consulta NF-e](https://centraldeajuda.serpro.gov.br/duvidas/pt/documentacoes/doc_consultanfe/).
