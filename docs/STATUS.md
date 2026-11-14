# Status do projeto

Atualizado em 14/11/2026.

## Fase atual

- **F0 Fundação:** concluída no commit `UJ-F00-E01` (hash em `git log`).
- **F1 Identidade:** três direções visuais publicadas para escolha do dono (quadro privado "Uni Jovem: direções visuais": A Aurora, B Areia e oliva, C Céu aberto). Recomendada: A. A escolha não bloqueia a F2.
- **F2 Banco e domínio:** etapa E01 (núcleo) concluída; próxima etapa é a revisão do schema por agente de banco e o fechamento da F2.

O mapa de fases está no fim deste arquivo; o que cada requisito exige está em [`rastreabilidade.md`](rastreabilidade.md).

## O que está pronto, com evidência

Só o que foi conferido em 14/11/2026. Não há app, telas, ambiente de homologação nem produção.

| Item (F2-E01)              | Evidência                                                                                                                                                                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema núcleo com RLS      | `apps/api/migracoes/0001_nucleo.sql`: contas, sessões, recuperação, comunidades, vínculos, convites, verificação de e-mail, transferência de propriedade, auditoria só-inserção, log de mudanças. Três papéis: `uj_dono` (migra), `uj_api` e `uj_auth` (sujeitos a RLS).                |
| Executor de migrações      | `apps/api/src/banco/migrar.ts`: aplica em ordem e recusa migração já aplicada que tenha sido editada (checksum).                                                                                                                                                                        |
| Transação com contexto     | `apps/api/src/banco/contexto.ts`: `set_config('app.conta_id'/'app.comunidade_id', ..., true)` por transação.                                                                                                                                                                            |
| Testes no Postgres 17 real | `apps/api/test/banco/rls-nucleo.test.ts`, 36 testes contra `embedded-postgres` 17: sem contexto = 0 linhas; isolamento A×B inclusive trocando o contexto; membro não se promove; Criador protegido; último admin; ciclo de vida só do proprietário; auditoria imutável até para o dono. |
| Matriz de permissões       | `packages/dominio/src/permissoes.ts`; `packages/dominio/test/permissoes.test.ts` confere as 72 ações × 16 combinações (1.152 células) contra uma especificação escrita à parte, e a visibilidade de pedidos de oração. `docs/matriz-permissoes.md` é gerado e conferido byte a byte.    |
| Portão de qualidade        | `npm run verificar` verde em 14/11/2026: 5 arquivos, 58 testes.                                                                                                                                                                                                                         |

| Item                                   | Evidência                                                                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repositório git com `main` e `release` | `git branch` lista `main` e `release`; o trabalho acontece em `release`. Há um commit raiz (`Raiz do repositório Uni Jovem`).                                                               |
| Monorepo com npm workspaces            | `package.json` declara `packages/*` e `apps/api`. Pacotes existentes: `@uj/api` (`apps/api`) e `@uj/dominio` (`packages/dominio`).                                                          |
| TypeScript estrito                     | `tsconfig.base.json` com `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; `tsc` sem erro nos dois pacotes.                                                               |
| Portão de qualidade local              | `npm run verificar` (prettier --check, eslint, tsc, vitest) verde em 14/11/2026: 3 arquivos de teste, 13 testes passando.                                                                   |
| Configuração validada por ambiente     | `apps/api/src/config.ts`; 9 testes em `apps/api/test/config.test.ts` (segredo curto ou de exemplo, segredos iguais, produção sem HTTPS, homologação apontando para produção, entre outros). |
| Rota de saúde                          | `GET /api/saude` em `apps/api/src/servidor.ts`; 1 teste em `apps/api/test/saude.test.ts`. Em 14/11/2026 a API subiu localmente com `npm run dev:api` e respondeu `{"ok":true,...}`.         |
| Papéis e hierarquia                    | `packages/dominio/src/papeis.ts`; 3 testes em `packages/dominio/test/papeis.test.ts`. Só a hierarquia: a matriz completa de permissões é da F2.                                             |
| gitleaks no pre-commit                 | `.githooks/pre-commit`. Em 14/11/2026, num repositório descartável apontado para esse hook, um commit com chave de acesso falsa foi barrado (gitleaks 8.30.1).                              |
| Dependências sem vulnerabilidade       | `npm audit` em 14/11/2026: `found 0 vulnerabilities` (com o override de D9).                                                                                                                |
| Modelo de configuração                 | `.env.example` comentado, sem valores reais.                                                                                                                                                |
| Documentação base                      | `README.md`, `CLAUDE.md`, `docs/` (este arquivo, DECISOES, PENDENCIAS-HUMANAS, RISCOS, rastreabilidade, custos, ADRs 0001 a 0006, runbook de troca de domínio).                             |

## Observações da F0

- Hook do gitleaks ativado neste clone com `npm run preparar` em 14/11/2026.
- Jest, previsto na F0, fica para a F5 junto com o app: não há código de app para testar antes disso.
- Desvio registrado: o plano dizia "RLS forçada"; o schema usa RLS **habilitada** sem `FORCE`, porque o único papel isento (o dono) só migra e as funções das políticas precisam ler `vinculos` sem recursão. O teste confere que `uj_api` e `uj_auth` não são donos nem têm BYPASSRLS. Ver ADR 0002.

## Próximo passo

1. **F2 (fechamento):** revisão do schema por agente de banco; correções; marcar F2 concluída.
2. **F1:** aguardar a escolha visual; com ela (ou com a recomendada A, se não houver resposta), tokens, componentes base e script de contraste.
3. **F3 Autenticação.**

## Como retomar

1. Leia [`../CLAUDE.md`](../CLAUDE.md) (regras) e este arquivo.
2. Confirme a branch: `git branch --show-current` deve mostrar `release`.
3. `npm install`, `npm run preparar`, `npm run verificar`.
4. Siga o "Próximo passo" acima e, ao fim de cada etapa, atualize este arquivo e [`rastreabilidade.md`](rastreabilidade.md).

## Mapa de fases

Cada fase fecha com `npm run verificar` verde, evidências registradas aqui, a matriz de rastreabilidade atualizada e um commit na branch `release`. Só se avança com os critérios de aceite cumpridos ou com o bloqueio registrado e o impacto descrito.

| Fase | Objetivo                                                                  | Depende de   | Estado em 14/11/2026  |
| ---- | ------------------------------------------------------------------------- | ------------ | --------------------- |
| F0   | Fundação: repositório, monorepo, verificação, gitleaks, docs base, config | (nenhuma)    | concluída             |
| F1   | Identidade e design system                                                | F0           | aguardando escolha    |
| F2   | Banco e domínio (schema núcleo, RLS, matriz de permissões)                | F0           | em andamento (E01 ok) |
| F3   | Autenticação (login, sessões, recuperação, 2FA do Criador, e-mail)        | F2           | não iniciada          |
| F4   | Comunidades, convites, vínculos e suíte de isolamento                     | F3           | não iniciada          |
| F5   | Casca do app e camada de dados offline                                    | F4, F1       | não iniciada          |
| F6   | Homologação no Mac mini (compose, backup, monitor, primeiro build)        | F5           | não iniciada          |
| F7   | Eventos e programação                                                     | F5           | não iniciada          |
| F8   | Recorrência                                                               | F7           | não iniciada          |
| F9   | Escalas e disponibilidade                                                 | F7           | não iniciada          |
| F10  | Início, Agenda, Timeline                                                  | F8, F9       | não iniciada          |
| F11  | Ao vivo                                                                   | F10, F5      | não iniciada          |
| F12  | Inscrições públicas e presença                                            | F7           | não iniciada          |
| F13  | Offline do evento e conflitos                                             | F11, F12     | não iniciada          |
| F14  | Notificações e versículo diário                                           | F6, F8 a F12 | não iniciada          |
| F15  | Sugestões, oração, conteúdos, avisos                                      | F5           | não iniciada          |
| F16  | Relatórios e exportações                                                  | F12, F9      | não iniciada          |
| F17  | Onboarding e gamificação leve                                             | F10 a F16    | não iniciada          |
| F18  | Privacidade e conformidade                                                | F15          | não iniciada          |
| F19  | Produção e lojas (preparação; nada enviado sem aprovação)                 | F6, F18      | não iniciada          |
| F20  | QA integrado e entrega                                                    | todas        | não iniciada          |
