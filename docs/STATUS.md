# Status do projeto

Atualizado em 15/11/2026, de manhã.

## Onde estamos

O dono pediu o app inteiro, sem pausas, até rodar no iPhone dele e com as duas lojas prontas para submeter. O trabalho segue em paralelo, com agentes divididos por área, sem branch e sem worktree. Cada leva só entra na `release` depois do `npm run verificar` verde.

| Frente                | Estado em 15/11/2026                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Produto (F0 a F18)    | API e telas de todos os módulos feitas e testadas. Novidades de 15/11/2026: bloqueio de usuário (D35, D36), rotinas de retenção e comando do operador (D37 a D39), foto e logotipo (D33). **A foto e o logotipo ainda não aparecem no app:** falta o cliente da API baixar a imagem, o que aguarda o "sim" do dono para mexer em `servicos/api.ts`                                            |
| Redesign Aurora (D32) | D0 a D4 commitados (`e1d5ec9`, `57b42e2`) e o design system consolidado, sem fachadas nem duplicatas (`2ff8294`). D5 (QA visual) em andamento: barras de vidro sem desfoque no Android e na web, segmentos cortando texto em 360 pt e dois primários no detalhe do evento                                                                                                                     |
| Web                   | A web publicada na homologação abriu **em branco** (a Aurora importava a si mesma na web). Corrigido em `eab915f` e republicado na homologação e na produção; teste de fumaça da web no `verificar`                                                                                                                                                                                           |
| Homologação           | `https://unijovem-hml.solerte.com.br` no ar, migrações até a 0019, comunidade de demonstração enriquecida                                                                                                                                                                                                                                                                                     |
| Produção (D34)        | Stack `unijovem-prod` no ar dentro do Mac: 19 migrações, API saudável, páginas públicas e `assetlinks.json` com 200 pela rede do Caddy, backup às 03:45, contas de revisão (senhas só em `contas-revisao.txt`, 600) e demonstração enriquecida. **Falta o domínio público:** o site `unijovem-prod` no painel (PH-04)                                                                         |
| Páginas legais        | Zero `[PREENCHER` e nenhum `[IMPLEMENTAÇÃO]` nos textos publicados; contato e encarregado Rafael Gomes, `contact@solerte.com.br`. Revisão jurídica pendente (PH-11)                                                                                                                                                                                                                           |
| Lojas                 | Fichas preenchidas sem envio (`docs/lojas/estado-das-lojas.md`); classificação 16+. Capturas nos três tamanhos geradas pela prévia com Playwright (`scripts/lojas`), sendo refeitas depois da D5. Build Android 1.0.0 (2) no EAS. Faltam o build iOS de loja, as ações do dono (IARC, publicar o App Privacy, contato da revisão, credenciais de revisão) e a aprovação de cada envio (PH-10) |

## Evidência da última verificação

- iPhone do dono: build de homologação do commit `cdf4fd5` (design Aurora completo, D5 incluída) assinado no Mac e instalado pelo `devicectl` em 15/11/2026 ("App installed: com.solerte.unijovem.hml"); também em `https://unijovem-hml.solerte.com.br/instalar`. Conferência visual no aparelho: pendente do dono.
- Web: republicada na homologação e na produção em 15/11/2026; a tela de entrada da homologação desenha os campos, sem erro de página. `npm run fumaca:web` entrou no `verificar`.

- `npm run verificar` em 15/11/2026, antes do commit `2ff8294`: Prettier, ESLint e tipos sem problema, **43 arquivos e 469 testes da API e dos pacotes** (Postgres 17 real) e **44 suítes e 265 testes do app**, todos passando.
- Captura pela prévia (`node --import tsx scripts/lojas/capturas.ts`): 30 capturas sem erro de página depois da correção da Aurora.
- Rastreabilidade revista contra o código em 15/11/2026 (`docs/rastreabilidade.md`): nenhum requisito em "validado dispositivo" nem "publicado".
- Nada publicado em loja.

## Próximo passo

1. Recapturar o Ao vivo e a Presença à tarde (horários naturais) com `scripts/lojas/capturas.ts` e `molduras.ts`.
2. Foto e logotipo visíveis no app, depois do "sim" do dono para `servicos/api.ts`.
3. Quando o dono criar o site no painel: conferir o domínio público, gerar o link do Criador em produção e devolver a URL dos termos ao Google.
4. Build iOS de loja e build Android final; envio só com o "sim" do dono (PH-10).
5. Teste de fumaça da web exportada no `verificar` (a tela em branco passou por todos os testes).

## Como retomar

1. Leia [`../CLAUDE.md`](../CLAUDE.md) e este arquivo; confira `git branch --show-current` (deve ser `release`).
2. `npm install`, `npm run preparar`, `npm run verificar`.
3. Homologação: [`../infra/hml/LEIA-ME.md`](../infra/hml/LEIA-ME.md). Produção: [`../infra/prod/LEIA-ME.md`](../infra/prod/LEIA-ME.md). Prévia local: [`../scripts/previa/LEIA-ME.md`](../scripts/previa/LEIA-ME.md).
4. Pendências do dono: [`PENDENCIAS-HUMANAS.md`](PENDENCIAS-HUMANAS.md); decisões: [`DECISOES.md`](DECISOES.md); requisitos e evidências: [`rastreabilidade.md`](rastreabilidade.md).
