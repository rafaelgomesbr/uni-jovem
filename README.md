# Uni Jovem

Aplicativo para a liderança jovem organizar comunidades, eventos, escalas, tarefas, inscrições, presença, oração e comunicação, em web, Android e iOS, com entrada só por convite, isolamento entre comunidades e uso offline no dia do evento.

> **Estado em 14/11/2026: só a Fase F0 (fundação) existe.** Hoje há uma API mínima (configuração validada por ambiente e `GET /api/saude`), um pacote de regras com os papéis e a ferramenta de verificação. Nenhum app, banco, tela ou ambiente publicado existe ainda. Neste README, o que já existe está marcado como **hoje** e o que ainda vai ser construído, como **planejado**. O andamento real fica em [`docs/STATUS.md`](docs/STATUS.md).

## 1. Como rodar

### Pré-requisitos (hoje)

- Node 22 (versão exata em `.nvmrc`) e npm 10.
- git.
- [gitleaks](https://github.com/gitleaks/gitleaks) no `PATH`. O hook de pre-commit **recusa o commit** se o gitleaks não estiver instalado, de propósito.

### Instalar e verificar

```bash
npm install
npm run preparar    # aponta o git para .githooks (gitleaks antes de cada commit)
npm run verificar   # prettier --check + eslint + tsc + vitest
```

`npm run verificar` é o portão de qualidade local: precisa estar verde antes de qualquer commit. Em 14/11/2026 ele passa com 3 arquivos de teste e 13 testes.

### Subir a API em desenvolvimento (hoje)

O script `npm run dev:api` **não lê o arquivo `.env` sozinho**: as variáveis precisam estar no ambiente do processo. No Windows, rode estes comandos no Git Bash.

```bash
cp .env.example .env
# Preencha JWT_SEGREDO, CONVITE_SEGREDO e ORACAO_CHAVE no .env.
# Os comandos para gerar cada valor estão no topo do próprio arquivo.
set -a; . ./.env; set +a
npm run dev:api
```

Em outro terminal:

```bash
curl http://localhost:3333/api/saude
# {"ok":true,"ambiente":"desenvolvimento"}
```

Se faltar alguma variável, a API não sobe e lista o que está errado (sem mostrar o valor dos segredos). Valores com espaço no `.env` (por exemplo `EMAIL_REMETENTE`) precisam de aspas para o `. ./.env` funcionar. O `.env` é ignorado pelo git e nunca deve ser versionado.

Ainda não há banco: `DATABASE_URL` é validada mas não é usada até a Fase F2.

## 2. Como está organizado

### Stack

| Camada                   | Hoje                                                                     | Planejado                                                                   |
| ------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Linguagem e ferramentas  | TypeScript ~6.0 estrito, ESLint 10, Prettier 3, Vitest 5, npm workspaces | Jest + jest-expo + Testing Library no app; Playwright + axe-core na web     |
| API                      | Node 22, Fastify 5, Zod 4                                                | Kysely sobre `pg`, páginas públicas renderizadas no servidor, jobs, SSE     |
| Banco                    | (nenhum)                                                                 | PostgreSQL 17 com RLS forçada; `embedded-postgres` em desenvolvimento       |
| App (iOS, Android, web)  | (nenhum)                                                                 | Expo SDK 58 com Expo Router; a web interna é o mesmo app exportado para web |
| Arquivos                 | (nenhum)                                                                 | Garage (compatível com S3) no Mac mini, URL assinada de curta duração       |
| E-mail e push            | (nenhum)                                                                 | Resend (e-mail), FCM HTTP v1 e APNs direto (push)                           |
| Segurança do repositório | gitleaks no pre-commit                                                   |                                                                             |

### Estrutura do monorepo

Hoje:

```
apps/
  api/                 API Fastify: configuração validada (src/config.ts) e GET /api/saude
packages/
  dominio/             regras puras compartilhadas: papéis e hierarquia (src/papeis.ts)
docs/                  documentação, decisões, ADRs, pendências, riscos, custos
.githooks/pre-commit   roda o gitleaks sobre o que está sendo commitado
.env.example           modelo de configuração da API, sem valores reais
```

Planejado (ainda não existe): `apps/app` (Expo), `packages/i18n` (catálogo pt-BR), `packages/tokens` (design tokens), `packages/conteudo` (versículos da Bíblia Livre com atribuição) e `infra/` (compose por ambiente, Caddy, backup, monitor).

### Ambientes

| Ambiente          | Onde                              | Dados                                    | Endereço                      | Existe hoje? |
| ----------------- | --------------------------------- | ---------------------------------------- | ----------------------------- | ------------ |
| desenvolvimento   | máquina local                     | sementes fictícias                       | `localhost`                   | sim (só API) |
| homologação (HML) | Mac mini, compose `unijovem-hml`  | fictícios + comunidade demo de revisores | `unijovem-hml.solerte.com.br` | não (F6)     |
| produção          | Mac mini, compose `unijovem-prod` | reais                                    | `unijovem.solerte.com.br`     | não (F19)    |

Banco, segredos, arquivos, chaves de push e identificadores do app são separados por ambiente. A API se recusa a subir se a configuração não combinar com o ambiente declarado em `UJ_AMBIENTE` (por exemplo: produção sem HTTPS ou apontando para homologação). Nenhum dado pessoal real entra em desenvolvimento ou homologação.

## 3. Como contribuir e testar

- Todo trabalho acontece na branch `release`. `main` é produção e só recebe a release promovida. Não se cria branch de feature, de correção ou de experimento.
- Mensagem de commit: `UJ-Fnn-Enn: resumo` (fase e etapa, por exemplo `UJ-F01-E02: tokens de cor`).
- Antes de commitar: `npm run verificar` verde. O hook do gitleaks roda no commit.
- Identificadores e textos em português do Brasil. Regras completas para quem trabalha no código (inclusive agentes) em [`CLAUDE.md`](CLAUDE.md).
- Nada é publicado (lojas, homologação, produção) sem aprovação explícita do dono.

## 4. Decisões e documentação

| Documento                                                                | Para que serve                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [`docs/STATUS.md`](docs/STATUS.md)                                       | Onde o projeto está, o que está pronto com evidência, próximo passo   |
| [`docs/DECISOES.md`](docs/DECISOES.md)                                   | Registro curto de todas as decisões e premissas (D1 a D10, P1 a P7)   |
| [`docs/adr/`](docs/adr/)                                                 | Decisões de arquitetura com contexto e alternativas (ADR 0001 a 0006) |
| [`docs/rastreabilidade.md`](docs/rastreabilidade.md)                     | Todo requisito com fase, critério de aceite, evidência e estado       |
| [`docs/PENDENCIAS-HUMANAS.md`](docs/PENDENCIAS-HUMANAS.md)               | O que só o dono pode fazer, e o que cada item bloqueia                |
| [`docs/RISCOS.md`](docs/RISCOS.md)                                       | Riscos e limites declarados, com mitigação                            |
| [`docs/custos.md`](docs/custos.md)                                       | Serviços externos, limites gratuitos e cenários de custo              |
| [`docs/runbooks/troca-de-dominio.md`](docs/runbooks/troca-de-dominio.md) | Como trocar o domínio sem quebrar links                               |
