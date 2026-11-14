# Status do projeto

Atualizado em 14/11/2026.

## Fase atual

- **F0 Fundação:** concluída (`UJ-F00-E01`).
- **F1 Identidade:** três direções visuais publicadas para escolha do dono (quadro privado "Uni Jovem: direções visuais": A Aurora, B Areia e oliva, C Céu aberto). Recomendada: A. Sem resposta até o início da F5, adota-se A (registrar em DECISOES).
- **F2 Banco e domínio:** concluída (`UJ-F02-E02`), após revisão independente do agente de banco (D11 a D13).
- **F3 Autenticação:** concluída na API (`UJ-F03-E01`, `UJ-F03-E02`), após revisão de segurança independente (D14). Telas de login, convite e 2FA ficam para a F5. E-mail real depende do Resend (pendência humana).
- **F4 Comunidades, convites, vínculos:** API concluída (`UJ-F04-E01`), com suíte de isolamento por inventário de rotas. Telas na F5.

O mapa de fases está no fim deste arquivo; o que cada requisito exige está em [`rastreabilidade.md`](rastreabilidade.md).

## Como está agora (14/11/2026)

`npm run verificar` verde: 13 arquivos, **164 testes** (cerca de 115 contra Postgres 17 real). Não há app, telas, ambiente de homologação nem produção.

| Item (F3/F4)          | Evidência                                                                                                                                                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticação          | `apps/api/src/autenticacao/*`, `apps/api/src/rotas/autenticacao.ts`; `apps/api/test/banco/autenticacao.test.ts` (convite com código por e-mail, login com resposta idêntica, refresh rotativo com detecção de reuso, cookie HttpOnly na web, recuperação, 2FA com bloqueio por conta, primeiro acesso do Criador) |
| Comando do Criador    | `npm run criador:iniciar` (`apps/api/src/cli/`), `criador-cli.test.ts`                                                                                                                                                                                                                                            |
| Comunidades e membros | `apps/api/src/rotas/comunidades.ts`, `migracoes/0002_comunidades.sql`; `comunidades.test.ts` (contatos só a partir de organizador, papéis, último admin, convites, suspensa)                                                                                                                                      |
| Plataforma (Criador)  | `apps/api/src/rotas/plataforma.ts`; criação com convite do primeiro admin, ciclo de vida com confirmação, intervenção com motivo, transferência de propriedade com 72 h                                                                                                                                           |
| Isolamento            | `apps/api/test/banco/isolamento.test.ts`: toda rota de comunidade (inventário) atacada com a sessão de outra comunidade = 404; rota nova sem caso reprova                                                                                                                                                         |
| Cotas de e-mail       | `migracoes/0003_cotas.sql` (convite 60/dia, por convite 15/dia, recuperação 30/dia)                                                                                                                                                                                                                               |

## O que estava pronto antes (F0 e F2-E01)

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

1. **F1 + F5:** com a escolha visual (ou a recomendada A), `packages/tokens`, script de contraste AA, criar o app Expo (`apps/app`, SDK 58, Expo Router) com casca, telas de entrar, convite, primeiro acesso, 2FA, seletor de comunidade, perfil e camada de dados offline (SQLite cifrado por partição + fila de saída).
2. **F6 HML no Mac:** exige ações do dono (hostnames no túnel, conta R2, `eas init`); ver PENDENCIAS-HUMANAS.
3. **F7 Eventos e programação** (API) pode avançar em paralelo à F5.

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
