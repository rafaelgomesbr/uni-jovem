# Status do projeto

Atualizado em 15/11/2026, de madrugada.

## Onde estamos

O dono pediu o app inteiro, sem pausas, até rodar no iPhone dele e com as duas lojas prontas para submeter. O trabalho segue em paralelo, com agentes divididos por área, sem branch e sem worktree. Cada leva só entra na `release` depois do `npm run verificar` verde.

| Frente                | Estado em 15/11/2026                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F0 a F18 (produto)    | API e telas de todos os módulos feitas e testadas (comunidades, convites, eventos, séries, escalas, ao vivo, inscrições, offline, notificações, versículo, oração, sugestões, conteúdos, relatórios, onboarding, privacidade). Foto e logotipo: API pronta (D33), app em construção                                                                                                            |
| Redesign Aurora (D32) | D0 (tokens e componentes) e D1 (casca, Início, entrada, Perfil) commitados em `e1d5ec9`. D2 a D4 (demais telas) em construção; D5 (QA visual sobre os quadros) depois                                                                                                                                                                                                                          |
| Homologação           | `https://unijovem-hml.solerte.com.br` no ar (API, web em `/app`, instalação ad hoc em `/instalar`, push APNs); migrações 0016 a 0018 a aplicar na próxima implantação                                                                                                                                                                                                                          |
| Produção (D34)        | Autorizada pelo dono em 15/11/2026. Stack `unijovem-prod` no ar dentro do Mac desde 15/11/2026: 18 migrações, API saudável, páginas públicas e `assetlinks.json` com 200 pela rede do Caddy, backup às 03:45, contas de revisão criadas (senhas só em `contas-revisao.txt`, 600). **Falta o domínio público:** o site `unijovem-prod` no painel (PH-04); hoje o nome cai num coringa da Vercel |
| Páginas legais        | `docs/privacidade/` conferido contra o código: zero `[PREENCHER`; contato e encarregado Rafael Gomes, `contact@solerte.com.br`. Restam promessas com marcador (rotinas de 2 anos, exclusão de comunidade ao fim da carência, bloqueio individual) e a revisão jurídica (PH-11)                                                                                                                 |
| Lojas                 | Play Console: app criado pelo dono. App Store Connect e fichas sendo preenchidos por agente no navegador. Arte do Play pronta (`docs/lojas/arte`). Faltam prints (depois do redesign), builds de produção e as aprovações do dono para cada envio (PH-10)                                                                                                                                      |

## Evidência da última verificação

- `npm run verificar` em 15/11/2026, antes dos commits `4fef10f` e `e1d5ec9`: Prettier sem diferenças, ESLint sem problemas, tipos sem erro, **41 arquivos e 446 testes da API e dos pacotes** (Postgres 17 real) e **37 suítes e 210 testes do app**, todos passando.
- Os testes que leem a marca d'água do log de mudanças rodam num Postgres próprio e em sequência (`vitest.config.ts`, projeto `banco-marca-dagua`), porque a marca vale para o cluster inteiro.
- Nada publicado em loja.

## Próximo passo

1. Implantar a homologação (migrações 0016 a 0018).
2. Build Android 1.0.0 (2) feito no EAS (chave de upload lida e posta no `.env` de produção). Quando o dono criar o site no painel: conferir o domínio público e gerar o link do Criador em produção.
3. Redesign D2 a D4, foto e logotipo no app, bloqueio de usuário (diretriz 1.2 da Apple) e as rotinas que as páginas legais prometem.
4. D5: capturas sobre os quadros, prints das lojas, build final e instalação no iPhone do dono.

## Como retomar

1. Leia [`../CLAUDE.md`](../CLAUDE.md) e este arquivo; confira `git branch --show-current` (deve ser `release`).
2. `npm install`, `npm run preparar`, `npm run verificar`.
3. Homologação: [`../infra/hml/LEIA-ME.md`](../infra/hml/LEIA-ME.md). Produção: [`../infra/prod/LEIA-ME.md`](../infra/prod/LEIA-ME.md).
4. Pendências do dono: [`PENDENCIAS-HUMANAS.md`](PENDENCIAS-HUMANAS.md); decisões: [`DECISOES.md`](DECISOES.md); requisitos e evidências: [`rastreabilidade.md`](rastreabilidade.md).
