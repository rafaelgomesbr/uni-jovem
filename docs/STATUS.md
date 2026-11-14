# Status do projeto

Atualizado em 14/11/2026, à noite.

## Onde estamos

O dono pediu o app inteiro, sem pausas, até rodar no iPhone dele. O trabalho segue em paralelo (agentes por área, sem branch e sem worktree), e cada leva só entra na `release` depois da verificação.

| Fase                            | Estado em 14/11/2026                                                                                                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F0 Fundação                     | concluída; repositório público no GitHub (`rafaelgomesbr/uni-jovem`, D24)                                                                                                                                                        |
| F1 Identidade                   | direção A (Aurora) confirmada pelo dono; ícone e splash próprios                                                                                                                                                                 |
| F2 a F4                         | concluídas (banco com RLS, autenticação, comunidades, convites, suíte de isolamento)                                                                                                                                             |
| F5 Casca do app                 | concluída; telas dos módulos em construção                                                                                                                                                                                       |
| F6 Homologação no Mac           | stack `unijovem-hml` no ar dentro do Mac (banco + API, 10 migrações, comunidade de demonstração); **o domínio público aguarda o site no painel do servidor (PH-04)**; build do iPhone aguarda o `eas credentials -p ios` do dono |
| F7 a F12                        | API concluída e testada; telas no app em construção                                                                                                                                                                              |
| F13 Offline                     | API de sincronização em construção; camada local do app depois                                                                                                                                                                   |
| F14 Notificações e versículo    | 366 versículos da Bíblia Livre com atribuição (`packages/conteudo`); Firebase e chave APNs prontos (D21, D22); API de push em construção                                                                                         |
| F15 Oração, sugestões, conteúdo | API concluída e testada (oração cifrada, invisível para admin e Criador quando "Somente eu"); telas pendentes                                                                                                                    |
| F16 Relatórios                  | API concluída e testada (agregados e CSV com validade de 24 h); telas pendentes                                                                                                                                                  |
| F17 Onboarding                  | não iniciada                                                                                                                                                                                                                     |
| F18 Privacidade                 | rascunhos em `docs/privacidade/` (para revisão jurídica); código (exportar, excluir conta, consentimento, logs) em construção                                                                                                    |
| F19 Lojas                       | app criado no Play Console pelo dono; identificadores na Apple; material das lojas em construção; nada enviado                                                                                                                   |
| F20 QA e entrega                | não iniciada                                                                                                                                                                                                                     |

## Evidência da última verificação

- `npx vitest run` em 14/11/2026: **27 arquivos, 268 testes passando** (API contra Postgres 17 real, domínio, conteúdo).
- Homologação: `docker exec caddy wget -qO- http://unijovem-hml-api:3000/api/saude` responde `{"ok":true,"ambiente":"homologacao"}`; migrações 0001 a 0010 aplicadas por `apps/api/src/cli/migrar.ts`.
- Nada aberto em simulador nem em aparelho ainda; nada publicado em loja.

## Próximo passo

1. Juntar as telas das F7 a F12, verificar e fazer o commit; exportar a web para `/app` na homologação.
2. API das F13, F14 e F18 (em construção), depois as telas de oração, sugestões, conteúdos, avisos, relatórios, notificações, versículo, privacidade e onboarding (F17), e a camada offline do app.
3. Assim que o dono criar o site no painel e rodar `eas credentials -p ios`: primeiro acesso do Criador na homologação e build `homologacao` instalado no iPhone por link.
4. F19 (material das lojas) e F20 (QA integrado, revisão de segurança e acessibilidade, relatório final).

## Como retomar

1. Leia [`../CLAUDE.md`](../CLAUDE.md) e este arquivo; confira `git branch --show-current` (deve ser `release`).
2. `npm install`, `npm run preparar`, `npm run verificar`.
3. Homologação: [`../infra/hml/LEIA-ME.md`](../infra/hml/LEIA-ME.md) (`bash infra/hml/implantar.sh`).
4. Pendências do dono: [`PENDENCIAS-HUMANAS.md`](PENDENCIAS-HUMANAS.md); decisões: [`DECISOES.md`](DECISOES.md); requisitos e evidências: [`rastreabilidade.md`](rastreabilidade.md).
