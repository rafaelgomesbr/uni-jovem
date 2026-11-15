# Matriz offline

O que o app faz sem internet, por funcionalidade. Base: plano (seção 7), [ADR 0005](adr/0005-offline-e-sincronizacao.md), D23 (validade de 7 dias) e D28 (respostas da sincronização). Atualizado em 14/11/2026.

## Regras gerais

- Só o **app de celular** tem modo offline. A web não guarda dados para uso sem internet.
- Os dados ficam num SQLite cifrado (SQLCipher), **uma partição por conta e comunidade**, com chave aleatória guardada no Keychain ou no Keystore.
- Cada operação feita sem internet recebe uma chave de idempotência e já nasce com a comunidade e o vínculo gravados. Trocar de comunidade nunca reenvia uma operação para outra.
- O servidor revalida tudo no envio (sessão, vínculo, papel, regra e versão) e responde por operação: `aceita`, `ja_aplicada`, `rejeitada` (com motivo) ou `conflito` (com o estado atual). Operação rejeitada continua visível na tela "Pendências", com o motivo e as ações descartar, copiar e refazer.
- **Validade: 7 dias** sem contato com o servidor (ajustável por comunidade entre 3 e 30). Vencida, a partição é bloqueada e apagada ao abrir o app.
- Sair da conta, trocar de conta, sair da comunidade ou ter o vínculo revogado apaga a partição. Antes, o app mostra as operações pendentes não enviadas.
- **Limite real:** um aparelho desligado da internet não recebe a revogação. O que já foi baixado continua legível nele até a próxima conexão ou até vencer. Por isso o pacote offline é mínimo e cifrado, e o servidor recusa operações enviadas depois da revogação.

## Por funcionalidade

| Funcionalidade                             | Disponível offline                                          | Ações offline                                          | Conflito e regra no servidor                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Programação, local, escala, etapas         | Leitura do que foi sincronizado ou preparado                | Nenhuma                                                | Não se aplica                                                                                                                   |
| Tarefas e checklists                       | Leitura                                                     | Concluir e reabrir                                     | Concluir é idempotente; reabrir algo que outra pessoa concluiu depois vira `conflito` explícito                                 |
| Presença e check-in                        | Lista de inscritos do evento preparado (telefone mascarado) | Marcar presença (QR, código ou nome)                   | União idempotente por chave e por pessoa: nunca duplica                                                                         |
| Ao vivo                                    | Estado da última sincronização                              | Avançar etapas localmente, marcado "só neste aparelho" | O servidor é a fonte da verdade; o log local vai como proposta; se outro condutor avançou, o app mostra as duas linhas do tempo |
| Inscrição de membro                        | Leitura                                                     | Registrar a intenção                                   | Fica "pendente: vaga não garantida" até o servidor confirmar                                                                    |
| Edição estrutural, convites, papéis, admin | Nenhuma                                                     | Exige conexão (botões desabilitados com explicação)    | Não se aplica                                                                                                                   |
| Pedidos de oração                          | **Nunca guardados no aparelho**                             | Nenhuma                                                | Não se aplica                                                                                                                   |
| Sugestões e perfil                         | Leitura                                                     | Rascunho local                                         | O envio exige conexão                                                                                                           |
| Versículo do dia                           | Os próximos 30 dias, agendados no aparelho                  | Notificação local no horário escolhido                 | Não se aplica                                                                                                                   |

## Onde está no código

- **Servidor:** `apps/api/src/rotas/sincronizacao.ts` (`POST /api/v1/c/:id/sync/operacoes`, `GET .../sync/mudancas?cursor=`, `GET .../eventos/:eventoId/pacote-offline`), `apps/api/migracoes/0013_sincronizacao.sql`; testes em `apps/api/test/banco/sincronizacao.test.ts`.
- **App:** camada local (SQLCipher por partição, fila, tela Pendências, preparar evento) em construção.
