# ADR 0005: Offline por partição cifrada e fila de operações idempotentes

- **Estado:** aceita
- **Data:** 14/11/2026
- **Decisões relacionadas:** P2 em [`../DECISOES.md`](../DECISOES.md)

## Contexto

No dia do evento a internet costuma falhar (igreja, retiro, sítio). Organizadores precisam ver a programação, fazer check-in e conduzir o ao vivo sem rede. Ao mesmo tempo, o dado é sensível, uma conta pode estar em várias comunidades e um aparelho pode ser perdido ou ter o acesso revogado enquanto está desconectado.

## Decisão

**Cliente (celular):**

- expo-sqlite com **SQLCipher**, chave aleatória por (conta, comunidade) guardada no Keychain ou Keystore, **uma partição por (conta, comunidade)**.
- Fila de saída: cada operação recebe um UUID v7 (chave de idempotência) e grava `comunidade_id` e `vinculo_id` **no momento da criação**, então trocar de comunidade nunca reenvia uma operação para a outra.
- Web: só cache de leitura de curta duração, sem modo offline de evento (limitação declarada).

**Servidor:**

- `POST /api/v1/c/:id/sync/operacoes` recebe um lote e **revalida tudo** (sessão, vínculo, papel, regra, versão). Responde por operação: `aceita`, `ja_aplicada`, `rejeitada` (com motivo) ou `conflito` (com o estado do servidor).
- `GET /api/v1/c/:id/sync/mudancas?cursor=` devolve o log de mudanças da comunidade, já filtrado pelo que a pessoa pode ver (`nivel_minimo`, `conta_alvo`, `designacao` em `uj.mudancas`).
- **Cursor sem perder linhas (D13):** o cursor é o par `(xact, id)`, e só entram linhas com `xact < pg_snapshot_xmin(pg_current_snapshot())`, isto é, de transações que já terminaram. Um id sequencial sozinho perderia a linha de uma transação mais antiga que confirma depois de uma mais nova. Página cheia: cursor = `(xact, id)` da última linha; página incompleta: cursor = `(limite, 0)`. Custo aceito: uma transação longa atrasa a sincronização de todos, por isso os papéis do app têm `idle_in_transaction_session_timeout` e `statement_timeout`. Teste: `rls-nucleo.test.ts`, "cursor de sincronização".
- Envelope repetido com o mesmo conteúdo é aceito sem efeito; conteúdo diferente com a mesma chave é conflito (409).

**Gatilhos:** ao abrir, ao voltar ao primeiro plano, ao recuperar rede, botão "Sincronizar agora" e tarefa em segundo plano oportunista, sem depender só dela.

**Conflitos:** edição online usa concorrência otimista (`versao`); 409 abre uma tela com "sua versão" e "versão atual" e escolha explícita. Nunca "última gravação vence" em dado relevante. Operação rejeitada fica visível na tela "Pendências", com motivo e ações (descartar, copiar, refazer).

**O que funciona offline:** leitura do evento preparado; concluir e reabrir tarefas e checklists; marcar presença; avançar o ao vivo ("só neste aparelho"); registrar intenção de inscrição ("pendente: vaga não garantida"); rascunhos locais de sugestão e perfil. Edição estrutural, convites, papéis e administração exigem conexão. Pedidos de oração **nunca** ficam offline. A tabela completa vai para `docs/matriz-offline.md` na F13.

**Validade e revogação:** cada partição tem `valido_ate`, renovado a cada contato com o servidor: **14 dias** (P2), ajustável por comunidade entre 3 e 30. Vencida, é bloqueada e apagada ao abrir. Logout, troca de conta, saída da comunidade ou revogação detectada apagam a partição (operações pendentes são mostradas antes, com aviso).

## Consequências

- **Limite real:** um aparelho desconectado não recebe a revogação nem pode ser apagado remotamente naquele instante. O dado já baixado continua legível nesse aparelho até a próxima conexão ou o vencimento. Por isso o pacote offline é mínimo (telefone mascarado, sem oração) e cifrado, e o servidor rejeita qualquer operação enviada depois da revogação.
- 14 dias toleram uma semana sem rede no uso semanal real; prazo maior amplia a exposição em aparelho perdido.
- SQLCipher exige build de desenvolvimento (não roda no Expo Go).
- Sincronização em segundo plano é oportunista no iOS e no Android; a garantida é ao abrir ou retomar o app.

## Alternativas rejeitadas

- **Um banco local único para todas as comunidades:** risco de mistura de dados e de filas entre comunidades.
- **"Última gravação vence":** perde trabalho de alguém em silêncio.
- **Offline sem validade:** aparelho perdido exporia dados indefinidamente.
- **Offline completo na web:** IndexedDB sem cifragem confiável e sem Keychain; a web fica com cache curto de leitura.

## Inspiração

- `C:\Projetos\city-hall\dc360\packages\campo\src\fila.ts` e `C:\Projetos\city-hall\dc360\packages\campo\src\deposito-sqlite.ts` (fila offline em expo-sqlite com SQLCipher; envelope repetido = 200, conteúdo diferente no mesmo envelope = 409).
