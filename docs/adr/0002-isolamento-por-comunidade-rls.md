# ADR 0002: Isolamento entre comunidades em duas camadas, aplicação e RLS

- **Estado:** aceita
- **Data:** 14/11/2026
- **Decisões relacionadas:** D6 em [`../DECISOES.md`](../DECISOES.md)

## Contexto

O Uni Jovem tem várias comunidades desde a v1 (D6), e uma mesma conta pode estar em várias, com papéis diferentes. Participar de uma comunidade de igreja pode revelar convicção religiosa, dado pessoal sensível pela LGPD (art. 5º, II). Um vazamento entre comunidades é o pior defeito possível do produto. Uma só camada de proteção (por exemplo, um `WHERE` esquecido numa consulta) é uma falha esperando acontecer.

## Decisão

1. **Aplicação:** toda rota de comunidade é `/api/v1/c/:comunidadeId/...`. Um hook do Fastify carrega o **vínculo ativo da conta autenticada** nessa comunidade direto do banco (nunca do corpo nem de cabeçalho), avalia a matriz de permissões de `packages/dominio` e nega por padrão.
2. **Banco:** cada transação faz `SET LOCAL app.conta_id` e `SET LOCAL app.comunidade_id`. A API conecta com um papel **sem** `BYPASSRLS` e que **não** é dono das tabelas. As políticas RLS ficam **habilitadas em toda tabela do esquema `uj`** (o teste reprova tabela sem RLS) e exigem `comunidade_id = current_setting('app.comunidade_id')` e vínculo ativo. Tabela sem política é tabela sem acesso.
3. **Mesmo princípio fora do banco:** arquivos com chave `comunidades/{id}/...` e URL assinada com escopo; chave de cache com a comunidade; busca sob RLS; filas de notificação resolvidas no envio sob RLS; relatórios e exportações gerados sob RLS, com dono e validade; offline particionado por (conta, comunidade); SSE com canal por comunidade validado no handshake.
4. **IDs:** UUID v7 internos; `idPublico` aleatório de 128 bits para links; nenhum ID sequencial exposto.
5. **Resposta a acesso indevido:** 404, não 403, para não confirmar que o recurso existe.
6. **Suíte de isolamento** a partir da F4, gerada de um inventário de rotas: para cada recurso, uma conta de A tenta ler, alterar e listar dados de B trocando IDs na URL, no corpo e em filtros. Rota nova sem teste de isolamento quebra o CI.
7. **Auditoria só-inserção:** sem UPDATE nem DELETE concedidos, com trigger de segurança.
8. **Três papéis de banco (F2-E01):** `uj_dono` só migra; `uj_api` atende as rotas, sempre sob RLS; `uj_auth` atende autenticação e aceite de convite, com acesso só às tabelas de identidade. O contexto exige também `comunidade_id = comunidade_atual()` na leitura: quem participa de A e B, no contexto A, não vê dados de terceiros em B.
9. **Habilitada, não `FORCE` (desvio do plano, 14/11/2026):** as funções das políticas (`papel_na`, `estado_da_comunidade`) são `SECURITY DEFINER` do dono e leem `vinculos` e `comunidades` sem recursão. Com `FORCE`, elas cairiam nas próprias políticas. Como o dono só aplica migrações e o aplicativo nunca conecta com ele, RLS habilitada já vale para os dois papéis do aplicativo; o teste `rls-nucleo` confere que eles não são donos nem têm `BYPASSRLS`.

## Consequências

- Uma falha na aplicação ainda esbarra no banco, e vice-versa.
- Toda consulta precisa rodar dentro de uma transação com o contexto definido; consulta sem contexto retorna 0 linhas, o que torna o erro visível cedo em vez de vazar.
- Jobs e tarefas de plataforma (retenção, painel do Criador) precisam de caminho próprio e explícito, sem contornar a RLS por conveniência.
- Os testes da API rodam contra Postgres real (`embedded-postgres` em desenvolvimento), não contra simulação.

## Alternativas rejeitadas

- **Só filtro na aplicação:** um `WHERE` esquecido vaza dados.
- **Um banco ou schema por comunidade:** multiplica migrações e backups para uma pessoa só operar, e complica a conta que está em várias comunidades.
- **403 para recurso de outra comunidade:** confirma que o ID existe.

## Inspiração

- `C:\Projetos\city-hall\docs\adr\0001-isolamento-entre-municipios-no-banco.md` (ADR 0001 do dc360).
- `C:\Projetos\brother-system\docs\adr\0001-isolamento-por-set-local.md`.
- `C:\Projetos\city-hall\docs\adr\0002-trilha-append-only-por-ausencia-de-policy.md` (ADR 0002 do dc360: auditoria só-inserção sob RLS forçada).
