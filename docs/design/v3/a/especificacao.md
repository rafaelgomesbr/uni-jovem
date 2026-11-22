# Direção A: Aurora Viva

Data: 22/11/2026. Base: `docs/design/app-v3-ux.md` (estrutura, textos, estados e catálogo de movimento são o contrato; esta direção só decide aparência, ritmo e o desenho dos movimentos). Protótipo clicável: `docs/design/v3/a/prototipo.html` (abre com dois cliques; as fontes do Google são opcionais).

## 0. O que foi e o que não foi verificado

- **O protótipo foi escrito e revisado por leitura. Eu não o abri em navegador** (esta sessão não tinha terminal nem navegador). Se algo não responder, o primeiro suspeito é um erro de JavaScript que a leitura não pegou. Abra, passe pelas 4 abas, pelos 5 botões "Encanto" e pelos seletores do topo antes de decidir.
- **Todas as razões de contraste deste documento foram calculadas à mão** com a fórmula de `packages/tokens/src/contraste.ts` (luminância WCAG 2.x). Onde o par já existe em `controles-v2.md` conferi que o meu cálculo reproduz o número deles. Antes de aceitar, os pares da seção 3 entram em `pares.ts` e o teste manda: se um número divergir, vale o teste.
- **Alturas de tela são estimativas** (soma das linhas), não medidas no aparelho.
- **Não rodei VoiceOver, TalkBack, nem testei em iOS e Android.** O que digo de plataforma é desenho.
- **Divergência do documento de UX, a decidir:** a seção 3.7 diz "de 17 linhas para 6", mas o wireframe lista 5 linhas (Notificações, Segurança, Privacidade e dados, Comunidades, Ajuda) mais Plataforma (só Criador) e Sair. O protótipo segue o wireframe: cartão da pessoa, 5 linhas e Sair.

---

## 1. Conceito em 5 linhas

1. **A luz é o assunto.** Noite roxa profunda (`#12102A`) e uma única fonte de luz: o sol da marca. O coral e o violeta do fundo deixam de ser enfeite e passam a dizer que horas são.
2. **O sol sobe com a semana.** O cartão do momento e o brilho de fundo seguem o relógio: longe (sol escondido), véspera (nascendo), no dia (pleno), acontecendo (radiante), terminou (poente). Cinco poses, uma por momento, o fio condutor de ponta a ponta.
3. **Profundidade por tinta, não por vidro.** Cartões em tinta violeta translúcida (sem desfoque, D32) com um fio de luz no topo; vidro com desfoque só no que flutua (barra de abas, cabeçalho ao rolar, folha, toast), sempre com fallback opaco.
4. **Um destaque por tela.** O cartão do momento ganha moldura de luz (coral para violeta) e brilho; o resto recua em tons de violeta. O botão sólido coral, com degradê, é a única laje quente.
5. **Movimento com trabalho.** Só `opacity` e `transform`, durações do catálogo 6.2, cascata curta na entrada, sol que nasce em 5 momentos raros. Com Reduzir movimento, tudo vira dissolução de 120 ms e o texto ocupa o lugar do encanto. O tema escuro é o principal; o claro é o par fiel (mesmas formas, papel e tinta no lugar de noite e luz).

---

## 2. Tokens de cor

Convenção: **(=)** igual ao app hoje, **(muda)** existe e muda de valor, **(novo)** nasce. Nomes seguem `packages/tokens/src/cores.ts`.

### 2.1 Tema escuro (principal)

| Token                                         | Hex ou rgba                                         | Status                  | Uso                                                            |
| --------------------------------------------- | --------------------------------------------------- | ----------------------- | -------------------------------------------------------------- |
| `fundo`                                       | `#12102A`                                           | (=)                     | fundo da tela                                                  |
| `fundoProfundo`                               | `#0C0A20`                                           | (novo)                  | base do degradê vertical do fundo (do meio da tela para baixo) |
| `texto`                                       | `#F5F3FF`                                           | (=)                     | texto principal                                                |
| `textoSuave`                                  | `#C9C4EC`                                           | (=)                     | meta, ajuda, aba inativa                                       |
| `destaque`                                    | `#FFB199`                                           | (=)                     | sobrancelha, link, aba ativa                                   |
| `primaria`                                    | `#FF8A65`                                           | (=)                     | botão primário, foco, selo                                     |
| `primariaTopo` / `primariaBase`               | `#FF9A78` / `#FF8A65`                               | (=)                     | degradê do primário                                            |
| `primariaPressionada`                         | `#F0764F`                                           | (=)                     | primário pressionado                                           |
| `sobrePrimaria`                               | `#1A0F0A`                                           | (=)                     | texto sobre o primário                                         |
| `superficie`                                  | `#1F1B44`                                           | (muda, era `#232139`)   | cartão opaco e fallback de "Reduzir transparência"             |
| `superficieTranslucida`                       | `rgba(38,33,82,0.64)`                               | (muda, era branco a 7%) | cartão de conteúdo (sem desfoque)                              |
| `realceDoCartao`                              | `rgba(255,255,255,0.06)`                            | (novo)                  | fio de luz no topo do cartão (degradê de 42% da altura)        |
| `superficieBorda`                             | `rgba(255,255,255,0.14)`                            | (=)                     | borda do cartão (decorativa)                                   |
| `superficieElevada`                           | `#262250`                                           | (muda, era `#2B2848`)   | folha, menu                                                    |
| `momentoTopo` / `momentoBase`                 | `#342C6E` / `#221D4E`                               | (novo)                  | degradê 160 graus do cartão do momento (sempre opaco)          |
| `momentoBorda`                                | `#FF8A65` para `#9D8FFF` para `#5B4BDB`             | (novo)                  | moldura de 1,5 pt do cartão do momento, 140 graus (decorativa) |
| `botaoTonal`                                  | `rgba(179,168,255,0.16)`                            | (=)                     | secundário, botão de ícone, pílula                             |
| `botaoTonalPressionado`                       | `rgba(179,168,255,0.26)`                            | (muda, era 0,24)        | secundário pressionado                                         |
| `botaoTonalOpaco`                             | `#373262`                                           | (muda, era `#3A3759`)   | tonal com Reduzir transparência                                |
| `campoFundo` / `campoBorda` / `campoExemplo`  | `#322F4C` / `#7C77A8` / `#A7A2D0`                   | (=)                     | campos (D64)                                                   |
| `sucesso` / `sucessoFundo`                    | `#7FE0B0` / `rgba(127,224,176,0.16)`                | (=)                     | confirmado, presente                                           |
| `alerta` / `alertaFundo`                      | `#FFD166` / `rgba(255,209,102,0.16)`                | (=)                     | aguardando, atraso                                             |
| `erro` / `erroFundo`                          | `#FF8A8A` / `rgba(255,138,138,0.16)`                | (=)                     | erro, perigo                                                   |
| `info` / `infoFundo`                          | `#B3A8FF` / `rgba(157,143,255,0.16)`                | (=)                     | "3 novos"                                                      |
| `quenteFundo`                                 | `rgba(255,177,153,0.16)`                            | (=)                     | chip quente, segmento escolhido                                |
| `neutroFundo`                                 | `rgba(255,255,255,0.10)`                            | (=)                     | chip neutro                                                    |
| `aceitarFundo`                                | `#17513B`                                           | (novo)                  | fundo revelado ao deslizar para aceitar                        |
| `recusarFundo`                                | `#432D4F`                                           | (novo)                  | fundo revelado ao deslizar para a esquerda                     |
| `toastFundo`                                  | `#2E2A66`                                           | (novo)                  | toast (mais claro que fundo e cartão)                          |
| `vidroBarra`                                  | `rgba(24,21,58,0.78)`, opaco `#1B1840`              | (muda)                  | barra de abas                                                  |
| `vidroCabecalho`                              | `rgba(18,16,42,0.78)`                               | (novo)                  | cabeçalho depois de 6 pt de rolagem                            |
| `vidroFolha`                                  | `rgba(38,34,80,0.92)`, opaco `#262250`              | (muda)                  | folha                                                          |
| `abaAtivaFundo`                               | `rgba(255,138,101,0.20)`                            | (=)                     | pílula da aba ativa                                            |
| `brilhoCoral` / `brilhoVioleta`               | `rgba(255,138,101,0.55)` / `rgba(124,108,255,0.45)` | (=)                     | Aurora (círculos de 380 e 360)                                 |
| `brilhoHorizonte`                             | `rgba(255,160,110,0.40)`                            | (novo)                  | elipse na base, sobe com o relógio                             |
| `brilhoPoente`                                | `rgba(214,80,150,0.38)`                             | (novo)                  | elipse na base, só no estado "terminou"                        |
| `foco` / `focoHalo`                           | `#FF8A65` / `rgba(255,138,101,0.22)`                | (=)                     | anel de 2 pt e halo de 4 pt                                    |
| `palco`                                       | `#07061A`                                           | (novo)                  | fundo do Modo palco (escuro nos dois temas)                    |
| sol: `solTopo` `solBase` `solRaio` `solBarra` | `#FFD166` `#FF8A65` `#FFD166` `#FFEBDD`             | (=)                     | `MARCA_DO_SOL.escuro`                                          |

### 2.2 Tema claro (par fiel)

| Token                                                      | Hex ou rgba                                                 | Status                                   | Uso                          |
| ---------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------- | ---------------------------- |
| `fundo` / `fundoProfundo`                                  | `#F7F5FF` / `#EFEBFF`                                       | (=) / (novo)                             | fundo                        |
| `texto` / `textoSuave` / `destaque`                        | `#1B1838` / `#4B4670` / `#8A2E12`                           | (=)                                      | texto, meta, link            |
| `primaria` / `primariaPressionada`                         | `#C2491F` / `#A93D18`                                       | (=)                                      | primário                     |
| `primariaTopo` / `primariaBase`                            | `#C64B20` / `#B5431B`                                       | (=)                                      | degradê                      |
| `sobrePrimaria`                                            | `#FFFFFF`                                                   | (=)                                      | texto sobre o primário       |
| `superficie`                                               | `#FFFFFF`                                                   | (=)                                      | cartão opaco                 |
| `superficieTranslucida`                                    | `rgba(255,255,255,0.80)`                                    | (muda, era `#FFFFFF`)                    | cartão sobre a Aurora pastel |
| `superficieBorda`                                          | `rgba(27,24,56,0.09)`                                       | (muda, era 0,08)                         | borda (decorativa)           |
| `momentoTopo` / `momentoBase`                              | `#FFFFFF` / `#F1ECFF`                                       | (novo)                                   | cartão do momento            |
| `momentoBorda`                                             | `#C2491F` para `#7C6CFF` para `#4B3FC4`                     | (novo)                                   | moldura (decorativa)         |
| `botaoTonal` / `botaoTonalPressionado` / `botaoTonalOpaco` | `rgba(75,63,196,0.12)` / `rgba(75,63,196,0.20)` / `#E9E8F8` | (=) / (muda) / (=)                       | secundário                   |
| `campoFundo` / `campoBorda` / `campoExemplo`               | `#F3F1FA` / `#857FAF` / `#6B6690`                           | (=)                                      | campos                       |
| `sucesso` / `sucessoFundo`                                 | `#16794B` / `#E3F4EA`                                       | (=)                                      | confirmado                   |
| `alerta` / `alertaFundo`                                   | `#8A5A00` / `#FFF1D6`                                       | (=)                                      | aguardando                   |
| `erro` / `erroFundo`                                       | `#B42318` / `#FDE4E1`                                       | (=)                                      | erro                         |
| `info` / `infoFundo`                                       | `#4B3FC4` / `#ECEAFD`                                       | (=)                                      | "3 novos"                    |
| `quenteFundo` / `neutroFundo`                              | `#FFE3D9` / `#EEEBFA`                                       | (=)                                      | chips                        |
| `aceitarFundo` / `recusarFundo`                            | `#E3F4EA` / `#FDE4E1`                                       | (novo)                                   | fundos revelados no deslizar |
| `toastFundo`                                               | `#1F1B4D`                                                   | (novo, igual a `INVERSO_DO_CLARO.fundo`) | toast                        |
| `vidroBarra`                                               | `rgba(255,255,255,0.82)`, opaco `#FFFFFF`                   | (muda)                                   | barra de abas                |
| `vidroCabecalho` / `vidroFolha`                            | `rgba(247,245,255,0.82)` / `rgba(255,255,255,0.94)`         | (novo) / (muda)                          | cabeçalho, folha             |
| `abaAtivaFundo`                                            | `rgba(194,73,31,0.12)`                                      | (=)                                      | pílula da aba ativa          |
| `brilhoCoral` / `brilhoVioleta`                            | `rgba(255,138,101,0.30)` / `rgba(124,108,255,0.22)`         | (=)                                      | Aurora                       |
| `brilhoHorizonte` / `brilhoPoente`                         | `rgba(255,170,120,0.30)` / `rgba(214,80,150,0.20)`          | (novo)                                   | base                         |
| `foco` / `focoHalo`                                        | `#C2491F` / `rgba(194,73,31,0.18)`                          | (=)                                      | foco                         |
| sol: `solTopo` `solBase` `solRaio` `solBarra`              | `#E8890C` `#C2491F` `#B86E00` `#8A2E12`                     | (=)                                      | `MARCA_DO_SOL.claro`         |

No claro o cartão não tem realce de topo (`realceDoCartao` = transparente) e usa sombra no lugar da luz: `0 1px 2px rgba(27,24,56,0.06), 0 8px 20px rgba(27,24,56,0.07)`.

---

## 3. Razões de contraste

Método: luminância relativa WCAG, `(L1 + 0,05) / (L2 + 0,05)`. "Cartão opaco" é `#1F1B44` (escuro) ou `#FFFFFF` (claro). Mínimos: 4,5:1 texto, 3:1 componente e ícone. Texto sobre a tinta translúcida foi medido no **pior ponto**: coral a 55% sob o cartão mais o realce de 6% (composto `#5B415B`). Os pares marcados com asterisco são os que o `pares.ts` precisa ganhar.

### 3.1 Escuro

| Par                                                                       | Razão       | Mínimo |
| ------------------------------------------------------------------------- | ----------- | ------ |
| `texto` `#F5F3FF` / `fundo` `#12102A`                                     | 16,89       | 4,5    |
| `texto` / cartão opaco `#1F1B44`*                                         | 14,74       | 4,5    |
| `textoSuave` `#C9C4EC` / cartão opaco*                                    | 9,70        | 4,5    |
| `destaque` `#FFB199` / cartão opaco*                                      | 9,24        | 4,5    |
| `texto` / cartão no pior ponto `#5B415B`*                                 | 8,14        | 4,5    |
| `textoSuave` / cartão no pior ponto*                                      | 5,36        | 4,5    |
| `destaque` / cartão no pior ponto*                                        | 5,10        | 4,5    |
| `texto` / momento topo `#342C6E`*                                         | 11,06       | 4,5    |
| `textoSuave` / momento topo*                                              | 7,27        | 4,5    |
| `destaque` / momento topo*                                                | 6,93        | 4,5    |
| `info` `#B3A8FF` / momento topo                                           | 5,75        | 4,5    |
| `texto` / momento base `#221D4E`*                                         | 14,14       | 4,5    |
| `textoSuave` / momento base*                                              | 9,30        | 4,5    |
| `texto` / momento com brilho de 12% `#4C376D`*                            | 9,23        | 4,5    |
| `textoSuave` / momento com brilho de 12%*                                 | 6,07        | 4,5    |
| `destaque` / momento com brilho de 12%*                                   | 5,78        | 4,5    |
| `textoSuave` / fundo nu sob o violeta (`#423A8A`)                         | 5,77        | 4,5    |
| `textoSuave` / fundo nu sob o horizonte no pico (`#714A45`)               | 4,55        | 4,5    |
| `texto` / fundo nu sob o coral no pico (`#945349`)                        | 5,32        | 4,5    |
| `sobrePrimaria` `#1A0F0A` / `primariaTopo` e `primariaBase`               | 9,08 e 8,13 | 4,5    |
| `primaria` / cartão opaco*                                                | 6,99        | 3      |
| `foco` `#FF8A65` / cartão opaco                                           | 6,99        | 3      |
| `foco` / folha `#262250`                                                  | 6,36        | 3      |
| `texto` / `botaoTonal` sobre cartão (`#373262`)*                          | 10,67       | 4,5    |
| `texto` / `botaoTonal` sobre momento topo (`#484085`)*                    | 8,15        | 4,5    |
| `sucesso` / chip sucesso sobre cartão (`#2E3A55`)*                        | 7,12        | 4,5    |
| `alerta` / chip alerta sobre cartão (`#433849`)*                          | 7,67        | 4,5    |
| `erro` / chip erro sobre cartão (`#432D4F`)*                              | 5,36        | 4,5    |
| `info` / chip info sobre cartão (`#332E62`)*                              | 5,83        | 4,5    |
| `destaque` / chip quente sobre cartão (`#433352`)*                        | 6,54        | 4,5    |
| `textoSuave` / chip neutro sobre cartão (`#353257`)*                      | 7,22        | 4,5    |
| `textoSuave` / barra opaca `#1B1840`*                                     | 10,07       | 4,5    |
| `textoSuave` / barra translúcida no pior ponto (`#33233E`)*               | 8,68        | 4,5    |
| `destaque` / pílula da aba ativa (`#492F47`)*                             | 6,74        | 4,5    |
| ícone `destaque` / pílula da aba ativa                                    | 6,74        | 3      |
| `destaque` ("Desfazer") / toast `#2E2A66`*                                | 7,32        | 4,5    |
| `texto` / toast*                                                          | 11,68       | 4,5    |
| `texto` / folha `#262250`*                                                | 13,42       | 4,5    |
| `textoSuave` / folha*                                                     | 8,82        | 4,5    |
| `campoBorda` `#7C77A8` / folha                                            | 3,55        | 3      |
| `campoBorda` / `campoFundo`                                               | 3,07        | 3      |
| `campoExemplo` / `campoFundo`                                             | 5,30        | 4,5    |
| `texto` / fundo revelado ao aceitar `#17513B`*                            | 8,41        | 4,5    |
| `sucesso` (ícone) / `#17513B`*                                            | 5,79        | 3      |
| `erro` / fundo revelado ao recusar `#432D4F`*                             | 5,36        | 4,5    |
| `primaria` (preenchimento da barra) / trilho (`#3A365A`)*                 | 4,89        | 3      |
| contorno com Aumentar contraste (`rgba(255,255,255,0.36)`) / cartão opaco | 3,26        | 3      |
| `texto` `#FFFFFF` / palco `#07061A`*                                      | 20,0        | 4,5    |
| acorde `#FFB199` / palco*                                                 | 11,43       | 4,5    |

### 3.2 Claro

| Par                                                  | Razão | Mínimo |
| ---------------------------------------------------- | ----- | ------ |
| `texto` `#1B1838` / `fundo` `#F7F5FF`                | 15,76 | 4,5    |
| `texto` / cartão `#FFFFFF`                           | 17,00 | 4,5    |
| `textoSuave` `#4B4670` / cartão                      | 8,72  | 4,5    |
| `textoSuave` / fundo                                 | 8,08  | 4,5    |
| `destaque` `#8A2E12` / cartão                        | 8,47  | 4,5    |
| `texto` / momento base `#F1ECFF`*                    | 14,73 | 4,5    |
| `textoSuave` / momento base*                         | 7,55  | 4,5    |
| `destaque` / momento base*                           | 7,33  | 4,5    |
| `sobrePrimaria` `#FFFFFF` / `primariaTopo` `#C64B20` | 4,74  | 4,5    |
| `sobrePrimaria` / `primariaBase` `#B5431B`           | 5,55  | 4,5    |
| `primaria` `#C2491F` / cartão                        | 4,92  | 3      |
| `foco` `#C2491F` / `fundo`                           | 4,56  | 3      |
| `sucesso` `#16794B` / `sucessoFundo` `#E3F4EA`       | 4,75  | 4,5    |
| `alerta` `#8A5A00` / `alertaFundo` `#FFF1D6`         | 5,31  | 4,5    |
| `erro` `#B42318` / `erroFundo` `#FDE4E1`             | 5,43  | 4,5    |
| `info` `#4B3FC4` / `infoFundo` `#ECEAFD`             | 6,32  | 4,5    |
| `destaque` / `quenteFundo` `#FFE3D9`                 | 6,95  | 4,5    |
| `textoSuave` / `neutroFundo` `#EEEBFA`*              | 7,43  | 4,5    |
| `destaque` / pílula da aba ativa (`#F8E9E4`)*        | 7,17  | 4,5    |
| `textoSuave` / barra `#FFFFFF`                       | 8,72  | 4,5    |
| `destaque` `#FFB199` ("Desfazer") / toast `#1F1B4D`* | 9,07  | 4,5    |
| `texto` `#F5F3FF` / toast*                           | 14,48 | 4,5    |
| `texto` / fundo revelado ao aceitar `#E3F4EA`*       | 14,9  | 4,5    |
| `sucesso` (ícone) / `#E3F4EA`                        | 4,75  | 3      |
| `erro` / fundo revelado ao recusar `#FDE4E1`         | 5,43  | 4,5    |
| `primaria` (preenchimento) / trilho `#E4E0F4`*       | 3,81  | 3      |
| `campoBorda` `#857FAF` / cartão                      | 3,72  | 3      |
| `campoExemplo` / `campoFundo`                        | 4,78  | 4,5    |

### 3.3 Onde a direção fica no limite, e por quê

- **`textoSuave` nu sobre o horizonte: 4,55:1.** É a única margem curta. O pico do brilho de base fica atrás da barra de abas (ponto mais baixo da tela). Regra: **nenhum texto fora de cartão nos últimos 96 pt da tela**. Se o teste do `pares.ts` mostrar menos de 4,5, baixe `brilhoHorizonte` de 0,40 para 0,34 (ganha cerca de 0,3).
- **`textoSuave` nu sobre o coral no pico: 3,5:1 (reprova).** Por isso nada pequeno e fora de cartão pode ficar sob o coral (x acima de 230 pt, y abaixo de 200 pt no quadro de 390). Hoje só o sino cai ali (ícone, 5,32:1). Regra para o time de telas: texto pequeno ali só dentro de cartão ou botão.
- **O brilho dentro do cartão do momento é de no máximo 12% nas áreas de texto** (26% só no canto do sol, onde não há texto). É o que sustenta os 9,23 e 6,07 da tabela.
- **O sol é logotipo** e fica fora da regra 1.4.11 (como já está em `MARCA_DO_SOL`). No claro, o corpo `#E8890C` mede 2,62:1 sobre branco. Nunca carrega informação sozinho: sempre há texto.

---

## 4. Tipografia

Par: **Bricolage Grotesque** (títulos, números grandes) e **Inter** (tudo o mais). Fallback real: Bricolage cai para `Avenir Next`, `Segoe UI`, `system-ui`; Inter cai para `system-ui`, `Segoe UI`, `Roboto`. O protótipo declara as duas pilhas e carrega as fontes do Google só como melhoria.

| Papel (`TIPO`)                      | Família e peso                   | Tamanho e entrelinha | Tracking | Teto de escala             | Status                                          |
| ----------------------------------- | -------------------------------- | -------------------- | -------- | -------------------------- | ----------------------------------------------- |
| `display` (saudação, raízes de aba) | Bricolage 800                    | 34 / 38              | -0,5     | 1,6                        | (=)                                             |
| `tituloTela`                        | Bricolage 800                    | 28 / 32              | -0,3     | 1,8                        | (=)                                             |
| `tituloMomento`                     | Bricolage 800                    | 26 / 30              | -0,2     | 2,0                        | (novo, título do cartão do momento)             |
| `tituloCartao`                      | Bricolage 800                    | 24 / 28              | -0,2     | 2,0                        | (=)                                             |
| `contador` (check-in "9")           | Bricolage 800, `tabular-nums`    | 40 / 40              | -0,5     | 1,6                        | (novo, era `numero` 28)                         |
| `cronometro` (ao vivo)              | Bricolage 800, `tabular-nums`    | 64 / 68              | -1       | 1,4                        | (=)                                             |
| `tituloItem`                        | Inter 600                        | 16 / 22              | 0        | sem teto                   | (=)                                             |
| `corpo`                             | Inter 400                        | **16 / 24**          | 0        | sem teto                   | (muda, era 15/22; é o item 3.1 da Fase 3 do UX) |
| `meta`                              | Inter 400                        | 15 / 20              | 0        | sem teto                   | (=)                                             |
| `legenda`                           | Inter 400                        | 14 / 20              | 0        | sem teto                   | (=)                                             |
| `sobrancelha`                       | Inter 600, maiúsculas por estilo | 13 / 18              | +1       | 1,6                        | (=)                                             |
| `chip`                              | Inter 600                        | 13 / 16              | 0        | 1,6                        | (=)                                             |
| `botao`                             | Inter 600                        | 16 / 20              | 0        | 2,0                        | (=)                                             |
| `aba`                               | Inter 500 (600 ativa)            | 11 / 14              | 0        | 1,6; acima disso só ícones | (=)                                             |

Regras de ritmo: peso e cor fazem a hierarquia antes do tamanho (título 800, item 600, resto 400; `texto`, `textoSuave`, `destaque`). Três tamanhos resolvem a maior parte de uma tela. Números em coluna usam `tabular-nums`. Medida de linha de leitura: no máximo 38 caracteres no versículo e nos avisos dentro de 350 pt.

---

## 5. Formas, sombras, vidro, bordas e espaçamento

### 5.1 Raios (nenhum fora desta lista)

| Raio | Onde                                                                        | Token                                                      |
| ---- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 999  | botões, chips, pílulas, avatar, **barra de abas** (altura 68, vira cápsula) | `RAIO.pilula`                                              |
| 28   | **cartão do momento**, topo da folha                                        | `RAIO.barra` (reuso)                                       |
| 22   | cartão, linha de evento                                                     | `RAIO.cartao`                                              |
| 20   | linha de resposta com deslizar, toast, pílula da aba ativa                  | `RAIO.abaAtiva` (reuso; sugiro renomear para `RAIO.medio`) |
| 16   | campo, bloco do dia, faixa de encanto                                       | `RAIO.campo`                                               |
| 14   | faixa de aviso                                                              | `RAIO.controle`                                            |
| 10   | ladrilho de ícone de 32                                                     | `RAIO.celula`                                              |
| 8    | caixa de marcar                                                             | `RAIO.caixa`                                               |

Regra concêntrica: a moldura do cartão do momento tem 1,5 pt, então o miolo tem 26,5 de raio (28 menos 1,5).

### 5.2 Sombras e luz

| Nível            | Escuro                                                                                                 | Claro                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `cartao`         | nenhuma; a borda e o realce de topo fazem o papel                                                      | `0 1px 2px rgba(27,24,56,0.06), 0 8px 20px rgba(27,24,56,0.07)`         |
| `momento` (novo) | `0 24px 48px -14px rgba(8,4,40,0.70), 0 0 70px -22px rgba(255,138,101,0.38)` (queda mais brilho coral) | `0 20px 44px -14px rgba(75,63,196,0.30), 0 2px 6px rgba(27,24,56,0.06)` |
| `flutuante`      | `0 12px 32px rgba(0,0,0,0.40)`                                                                         | `0 12px 32px rgba(27,24,56,0.16)`                                       |
| `folha`          | `0 -8px 40px rgba(0,0,0,0.50)`                                                                         | `0 -8px 40px rgba(27,24,56,0.20)`                                       |
| `botao`          | `0 6px 16px rgba(255,138,101,0.28)`                                                                    | `0 6px 14px rgba(194,73,31,0.30)`                                       |

### 5.3 Vidro (só no que flutua)

| Superfície                                                | Desfoque                         | Fundo escuro / claro                             | Fallback opaco        |
| --------------------------------------------------------- | -------------------------------- | ------------------------------------------------ | --------------------- |
| Barra de abas                                             | 24 (saturação 1,4)               | `rgba(24,21,58,0.78)` / `rgba(255,255,255,0.82)` | `#1B1840` / `#FFFFFF` |
| Cabeçalho (só depois de 6 pt de rolagem)                  | 20                               | `rgba(18,16,42,0.78)` / `rgba(247,245,255,0.82)` | `fundo`               |
| Folha                                                     | 30                               | `rgba(38,34,80,0.92)` / `rgba(255,255,255,0.94)` | `#262250` / `#FFFFFF` |
| Barra de ação fixa (encontro do líder, check-in, ao vivo) | 24                               | igual à barra de abas                            | igual                 |
| Toast                                                     | nenhum (cor sólida `toastFundo`) |                                                  |                       |

Cartões de conteúdo **não** têm desfoque. Com Reduzir transparência todo vidro vira opaco e o cartão usa `superficie`. Com Aumentar contraste a borda sobe para 2 pt em `contorno` (3,26:1 no escuro).

### 5.4 Bordas

Cartão: 1 pt `superficieBorda` mais o realce de topo. Cartão do momento: moldura de luz de 1,5 pt (coral, violeta claro, índigo). Campo: 1 pt `campoBorda`, foco de 2 pt `foco` mais halo de 4 pt. Linha de lista: separador de 1 pt `rgba(255,255,255,0.09)` (claro: `rgba(27,24,56,0.09)`), sem caixa por linha.

### 5.5 Espaçamento

Escala fixa, a mesma do app: 4, 8, 12, 16, 20, 24, 32, 40 (mais os internos 2, 6, 10, 14, 18). Margem lateral 20. Entre blocos 16; antes de um grupo 24; título de grupo a 8 do cartão; padding de cartão 16 a 18; entre os botões de um par 12; fim das telas de aba 120 (barra de 68 mais 12 de distância mais folga). Alvos: 48 (botão médio), 56 (grande e ao vivo), 72 (linha do check-in), 40 mais 4 de folga de toque (botão compacto de linha).

---

## 6. Ícones

- Estilo: **traço**, grade de 24, **espessura 2** (2,5 na aba ativa, o sinal de peso além da cor), pontas e junções redondas, sem preenchimento, `currentColor`. Mesmo conjunto do mockup aprovado (D15); os novos seguem a mesma gramática.
- Tamanhos: 14 em chip e meta, 16 em linha de texto e seta, 18 em botão e ladrilho, 20 em cabeçalho e campo, 22 na aba, 24 no sino.
- Novo: o ícone da aba **Início é o sol nascendo** (horizonte, meia-lua e 3 raios), no lugar da casa. Liga a navegação à marca. As outras três: calendário, duas pessoas, pessoa.
- Cor nunca é o único sinal: confirmado vem com check, aguardando com relógio, atraso com alerta, sem internet com antena riscada, desabilitado com cadeado e o motivo escrito.
- O protótipo usa 2 de espessura em todos (não troca para 2,5 na ativa).

---

## 7. O sol nascendo: as 5 poses

Geometria única, a de `GEOMETRIA_DO_SOL` (quadro 712, centro `(356, 444)`, corpo de 205, 5 raios em 150, 120, 90, 60 e 30 graus de 269 a 352, espessura 34, duas barras de horizonte). A pose muda só `transform` e `opacity` de quatro grupos: corpo, raios, halo e barras. O corpo é recortado no horizonte (`y < 444`), então "descer" é transladar para baixo da linha.

| #   | Pose                   | Corpo                        | Raios                    | Halo             | Cores                                                                          | Onde                                                           |
| --- | ---------------------- | ---------------------------- | ------------------------ | ---------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| 1   | **Antes do amanhecer** | translateY +215 (escondido)  | opacidade 0, escala 0,55 | opacidade 0,35   | padrão                                                                         | cartão "longe"; todos os estados vazios; esqueleto de encontro |
| 2   | **Nascendo**           | translateY +108 (meio corpo) | opacidade 0, escala 0,7  | 0,60             | padrão                                                                         | cartão "véspera"; etapa intermediária do encanto 1             |
| 3   | **Pleno**              | 0                            | 1, escala 1              | 0,70             | padrão                                                                         | cartão "no dia"; "Tudo em dia"; logotipo                       |
| 4   | **Radiante**           | 0                            | 1, escala 1,14           | 1,0, escala 1,15 | padrão                                                                         | cartão "acontecendo agora"; ao vivo; "banda completa"          |
| 5   | **Poente**             | translateY +62               | 0,55, escala 0,78        | 0,45             | corpo `#FFB36B` para `#D4508A` (claro: `#D9650C` para `#A83A55`); barras a 55% | cartão "terminou"; "Obrigado por servir ontem."                |

Transição entre poses: 600 ms, curva `nasce` `cubic-bezier(0.16, 1, 0.3, 1)`, raios com 40 ms de atraso um do outro (nascem do mais à esquerda). Com Reduzir movimento: dissolução de opacidade em 120 ms, sem translação nem escala, e a pose final já aparece no lugar.

O sol e o fundo falam juntos: cada momento reposiciona a luz de base (`opacity` e `translateY` de 900 ms): longe (0,30 e +70 pt), véspera (0,45 e +36), no dia (0,65 e +6), acontecendo (0,95 e -26, coral a 1,12 de escala), terminou (horizonte a 0,15 e poente a 0,95). O usuário vê o "dia" passar no fundo sem ler nada.

Tamanhos: 96 no cartão do momento (canto superior direito, recortado pelo cartão), 104 a 88 nos vazios, 72 no esqueleto de encontro, 32 em "Obrigado por servir", 30 em "Tudo em dia", 120 no ao vivo. Sempre `aria-hidden`; o texto ao lado diz o mesmo.

---

## 8. Componentes

### 8.1 Barra de abas

- Cápsula flutuante de **68 pt** de altura, 16 de margem lateral, 12 do fundo, 4 itens de largura igual (25% cada). Vidro de 24 com fallback opaco; sombra `flutuante`.
- **Pílula luminosa deslizante** (`abaAtivaFundo` mais um anel interno de 1 pt e uma luz de 22 pt de espalhamento na cor da aba ativa) que se move por `translateX` até a aba nova. O ícone ativo sobe 1 pt e cresce 6%.
- Rótulo 11/14 (500; 600 na ativa), teto 1,6; acima de 1,6 só ícones, com o rótulo no leitor de tela.
- Estados: repouso (`textoSuave`), pressionado (escala 0,98 e camada tonal), foco (anel de 2 pt coral, offset 2), ativo (`destaque`, peso 600, pílula), desabilitado (não existe), carregando (não existe: a aba nunca espera), erro (não existe). Nenhuma aba ganha bolinha ou número; o sino é o único lugar de "novo".
- Oculta (desce 130% e some em 280 ms) nas telas de pilha.

### 8.2 Cartão do momento

- Moldura de 1,5 pt em degradê coral, violeta, índigo (140 graus) e miolo com degradê `momentoTopo` para `momentoBase` (160 graus), raio 28, sombra `momento`. No app: duas `View`, a de fora com `padding: 1.5` e `LinearGradient`, a de dentro com o degradê (sem máscara).
- **Brilho** coral radial no canto superior direito (26% no canto, caindo a 0), sem texto por cima acima de 12%. **Sol** de 96 no mesmo canto, recortado.
- Conteúdo em ordem fixa (do UX): etiqueta (`sobrancelha`, `destaque`, com ponto "ao vivo" no estado acontecendo), título 26/30, data e local em `meta`, "Como chegar" como link terciário de 32 de altura, bloco da parte (rótulo "Sua parte:" mais valor mais chip), botões.
- Altura estimada do cartão de membro com convocação pendente: **cerca de 262 pt** (o documento de UX falava em 190; isso só vale sem o bloco de parte). Com 262, "Aceitar" e "Não posso ir" terminam por volta do pt 496 e "Para responder" aparece parcialmente acima da barra. **Medir no aparelho.**
- Estados do cartão: ver tabelas 3.1 e 3.2 do UX; esta direção só escolhe: pendente usa o chip `alerta` com relógio; confirmado usa o chip `sucesso` com check; "ainda não respondeu" no dia usa a mesma chip, texto do UX; recusou troca o bloco por texto e um terciário "Desfazer".
- Carregando: esqueleto de 262 com a mesma moldura apagada. Vazio: cartão sem moldura com sol pose 1. Erro: bloco `erroFundo` no lugar. Sem internet: etiqueta extra `Última versão: hoje, 14:32` (chip neutro), botões desabilitados com cadeado e o motivo escrito.
- **Ordem do par de botões: secundário à esquerda, primário à direita** (linguagem de `controles-v2.md` e alcance do polegar direito). Os wireframes do UX mostram `[Aceitar] [Não posso ir]`; é uma decisão de forma desta direção, não de estrutura. Empilhado (fonte 1,35 ou mais) o primário fica em cima.

### 8.3 Linha de lista

- Cartão com linhas de 56 pt (72 pt em linhas de duas informações e no check-in), separador de 1 pt, ladrilho de ícone de 32 (raio 10, `quenteFundo`), título `tituloItem`, apoio `legenda`, seta de 18 em `textoSuave`. A linha inteira é o alvo.
- **Linha de evento (Agenda):** bloco do dia de 56 de largura (número 26 Bricolage 800 com `tabular-nums`, mês em 12/600 espaçado), título 17/600, hora e local em `meta`, "Você: ..." em 15/600 com chip. Com fonte 1,35 ou mais o bloco do dia vai para cima.
- **Linha de resposta (deslizar):** cartão de raio 20 com fundo opaco. Direita: revela `aceitarFundo` com check e a palavra "Aceitar"; passando de 40% da largura aceita. Esquerda: revela `recusarFundo` com o botão "Não posso ir" (só envia se tocar). Os dois botões visíveis continuam na linha; o deslizar é atalho. `touch-action: pan-y` para não brigar com a rolagem.
- **Check-in:** 72 pt, avatar de 44, nome e a exceção ("Inscrita", "Convocada"), à direita o falso botão "Chegou" (tonal, `aria-hidden`) ou o chip "Presente". Tocar de novo desmarca.
- Estados: repouso, pressionado (camada `botaoTonal`), foco, desabilitado (opacidade 0,72 mais o motivo escrito, como "Já convocado"), carregando (esqueleto de 72), erro (a linha volta e diz o motivo).

### 8.4 Chip

Altura mínima 24, cápsula, 13/16 600, ícone de 14, nunca tocável. Cinco cores semânticas e uma neutra, sempre com **texto e ícone**:

| Chip                                         | Fundo e texto (escuro)       | Ícone           |
| -------------------------------------------- | ---------------------------- | --------------- |
| Quente ("Aberto ao público", "você", "nova") | `quenteFundo` / `destaque`   | opcional        |
| Confirmado, Presente                         | `sucessoFundo` / `sucesso`   | check           |
| Aguardando, Passou 3 min                     | `alertaFundo` / `alerta`     | relógio, alerta |
| Erro                                         | `erroFundo` / `erro`         | alerta          |
| "3 novos"                                    | `infoFundo` / `info`         | nenhum          |
| Neutro ("Rascunhos", "Última versão")        | `neutroFundo` / `textoSuave` | opcional        |

Razões na seção 3 (mínimo 5,36). Aparecer: escala 0,6 a 1 com mola em 200 ms ("Confirmado"); 0,9 a 1 em 160 ms ("Presente").

### 8.5 Esqueleto

Mesma forma do conteúdo final, mesmas margens e alturas: cartão do momento 262, linha de 72, linha de 64 no Início; 3 linhas de 88 na Agenda; contador mais barra mais 6 linhas de 72 no check-in. Cor `rgba(255,255,255,0.08)` (claro `#ECE9F8`), raio 14 (cápsula na barra). Só aparece **depois de 300 ms** (dissolve 160) e pulsa de opacidade 1 para 0,5 em 1200 ms. Com Reduzir movimento fica estático. Nada de spinner de tela inteira. Passando de 10 s vira "Demorando mais do que o normal. Confira a internet." com "Tentar de novo".

### 8.6 Toast com Desfazer

- Cápsula de raio 20, `toastFundo`, sobe de 8 pt em 200 ms, flutua 12 pt acima da barra de abas (ou da barra fixa da tela).
- Conteúdo: texto (15/22), **contagem em segundos** em número (tabular, "10 s", troca a cada 1 s), botão **"Desfazer"** de 44 por 44 no mínimo, `destaque` claro em 700 (7,32:1 no escuro, 9,07:1 no claro) e **barra fina de 3 pt** no rodapé que encolhe em `scaleX` por 10 s, linear.
- O número é o equivalente da barra: com Reduzir movimento a barra some e o número continua. O toast é uma região `status` (anuncia uma vez "Desfazer disponível por 10 segundos"); o foco não é roubado.
- Sem Desfazer (informação): 4 s, sem barra nem número. Falha de ação: o mesmo toast com o rótulo "Tentar de novo".
- O aviso a outras pessoas só sai quando o toast fecha; se aparecer outro toast, o anterior é confirmado (nunca se perde um envio).

---

## 9. Movimento

Só `opacity` e `transform`. **Exceção declarada:** altura da linha que encolhe, do acordeão e do bloco que cresce (200 ms, `padrao`), como já prevê o catálogo 6.2 do UX; no app, via layout animation do Reanimated. Tudo o mais é compositor.

Curvas (as do app, mais duas): `saida` `cubic-bezier(0.22, 1, 0.36, 1)`, `padrao` `cubic-bezier(0.4, 0, 0.2, 1)`, `saidaDeTela` `cubic-bezier(0.4, 0, 1, 1)`; mola `toque` (amortecimento 18, rigidez 320, massa 0,6; no CSS `cubic-bezier(0.34, 1.45, 0.5, 1)` em 220 ms); mola `check` (12, 260, 0,7). **Novas desta direção:** `nasce` `cubic-bezier(0.16, 1, 0.3, 1)` (sol e luz de fundo) e `luz` `ease-in-out` (deriva).

### 9.1 Tabela de movimento

| Gatilho                                   | Propriedade                                                                            | Duração e curva                                                                   | Com Reduzir movimento                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Entre abas: tela                          | `opacity` 0 a 1 (a que sai, 1 a 0)                                                     | 160 ms `padrao` (sai em 120)                                                      | dissolve 120 ms                                        |
| Entre abas: pílula e ícone                | `translateX` da pílula; ícone `translateY` -1 e `scale` 1,06                           | 260 ms, `cubic-bezier(0.34, 1.3, 0.5, 1)` (mola `toque`, cerca de 250 ms)         | a pílula troca sem deslizar; ícone sem escala          |
| Entrada da tela em cascata                | `opacity` 0 a 1 e `translateY` 12 a 0 em até 5 blocos                                  | 200 ms cada, passo de 30 ms, no máximo 350 ms, `saida`                            | dissolve 120 ms, sem passo                             |
| Abrir o encontro (pilha)                  | entra `translateX` 100% a 0; a de baixo `translateX` 0 a -22% e `opacity` 1 a 0,5      | 350 ms `saida`                                                                    | dissolve 120 ms                                        |
| Voltar (pilha)                            | sai `translateX` 0 a 100%; a de baixo volta                                            | 300 ms (`saidaDeTela` para a que sai)                                             | dissolve 120 ms                                        |
| Abrir folha                               | `translateY` 105% a 0; véu `opacity` 0 a 1                                             | 340 ms `saida`; véu 200 ms `padrao`                                               | dissolve 120 ms                                        |
| Fechar folha                              | `translateY` 0 a 105%; véu 1 a 0                                                       | 240 ms `saidaDeTela`; véu 200 ms                                                  | dissolve 120 ms                                        |
| Pressionar botão                          | `scale` 1 a 0,98 e camada de pressionado `opacity`                                     | 90 ms entra; 220 ms mola ao soltar                                                | só a camada, 80 ms                                     |
| Aceitar                                   | rótulo dissolve; chip `scale` 0,6 a 1 (mola `check`); bloco de botões encolhe          | rótulo 120 ms; chip 200 ms; altura 200 ms `padrao`                                | rótulo 120 ms; sem escala; troca na hora               |
| Check-in feito                            | chip `scale` 0,9 a 1 e `opacity`; contador dissolve                                    | chip 160 ms `saida`; número 120 ms; barra `scaleX` 500 ms `nasce`                 | chip e número dissolvem em 120 ms; barra troca na hora |
| Toast entra e sai                         | `translateY` 8 a 0 e `opacity`                                                         | entra 200 ms `saida`; sai 160 ms `padrao`                                         | dissolve 120 ms                                        |
| Toast: contagem                           | barra `scaleX` 1 a 0; número troca por segundo                                         | 10 s linear                                                                       | barra oculta; **número continua**                      |
| Desfazer                                  | o ato ao contrário                                                                     | 160 ms                                                                            | troca na hora                                          |
| Selo do sino (aviso novo)                 | `scale` 1 a 1,15 a 1                                                                   | 160 ms `saida`                                                                    | número troca na hora                                   |
| Erro de ação                              | `translateX` 0, -4, 4, -2, 0 no botão (5 no campo)                                     | 260 ms                                                                            | sem balanço; dissolve 120 ms                           |
| Carregando                                | esqueleto `opacity` 0 a 1; pulso 1 a 0,5                                               | aparece depois de 300 ms em 160 ms; pulso 1200 ms                                 | esqueleto estático                                     |
| Trocar de comunidade                      | nome dissolve; avatar `rotateY` 180 a 0; conteúdo recarrega com esqueleto              | 160 ms; 200 ms `padrao`; conteúdo 200 ms                                          | dissolve; avatar sem giro                              |
| Acordeão (versículo, resumo, Organização) | altura mais `opacity`; seta `rotate` 180                                               | 200 ms `padrao`                                                                   | abre sem animação                                      |
| Segmento escolhido                        | polegar `translateX`                                                                   | 200 ms `padrao`                                                                   | troca na hora, peso do texto muda                      |
| Cabeçalho vira vidro                      | `opacity` da camada                                                                    | 200 ms `padrao`                                                                   | troca na hora                                          |
| Troca de momento (o relógio): luz         | `opacity` e `translateY` das elipses e do coral                                        | 900 ms `nasce`                                                                    | dissolve 120 ms                                        |
| Troca de pose do sol                      | `translateY` do corpo, `scale` e `opacity` dos raios e halo                            | 600 ms `nasce`, raios +40 ms cada                                                 | opacidade em 120 ms, pose final já no lugar            |
| Deriva lenta do fundo                     | coral `translate(-14, 12)` e `scale` 1,06; violeta `translate(16, -10)` e `scale` 1,05 | 14 s e 18 s, `luz`, ida e volta, **6 meias-voltas (84 s e 108 s) e para sozinha** | desligada                                              |
| Deslizar para aceitar                     | `translateX` segue o dedo; ao soltar passa de 40%: sai 110%                            | volta ou sai em 250 ms `saida`                                                    | idem; o botão visível continua                         |
| Ponto "ao vivo"                           | `opacity` 1 a 0,4                                                                      | 1,6 s infinito                                                                    | estático                                               |

### 9.2 Os 5 momentos de encanto (uma vez por conta, no máximo um por sessão, 600 ms de animação principal, nunca bloqueiam o toque)

| #   | Momento                     | O que acontece                                                                                                                                                                     | Texto                                                                          | Com Reduzir movimento |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------- |
| 1   | Primeiro "Aceitar"          | Halo dourado e coral atrás do cartão: `opacity` 0 a 0,35 e `scale` 0,8 a 1 em 600 ms, some em 400 ms. O sol do cartão sobe até a pose "Pleno" por 1,5 s e volta à pose do momento. | "Que bom ter você no Louvor." (faixa dentro do cartão, 4 s, recolhe em 200 ms) | só o texto            |
| 2   | Primeira presença marcada   | 5 raios de sol se acendem em arco sobre o contador, um a cada 50 ms (`opacity` 0 a 1, `translateY` -26 a -30, `scale` 0,6 a 1, 220 ms cada)                                        | "Primeira presença marcada. Bom sábado!"                                       | só o texto            |
| 3   | Primeiro encontro publicado | O botão vira "Publicado" com o check dentro de um círculo que clareia (halo radial `scale` 0,6 a 1 e `opacity`, 400 ms)                                                            | "Seu primeiro encontro está no ar."                                            | só o texto            |
| 4   | Primeira vez "Tudo em dia"  | O sol de 30 pt do resumo sobe da pose "Antes do amanhecer" até "Pleno" (`translateY` 16 a 0, `opacity` 0,4 a 1, 600 ms `nasce`)                                                    | "Tudo em dia."                                                                 | sol já no lugar       |
| 5   | Banda completa              | O selo "Banda completa" acende (`opacity` 0,3 a 1, `scale` 0,92 a 1,05 a 1, 300 ms)                                                                                                | "Banda completa: 5 de 5."                                                      | só o selo             |

Fora de qualquer encanto: confete, som, pontos, sequências, medalhas. O app serve uma comunidade de fé: comemoração discreta e do grupo.

---

## 10. Plataformas

| Tema         | iOS (HIG)                                                                    | Android (Material 3)                                                                                              | Onde a marca diverge de propósito                                                                                                        |
| ------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Navegação    | barra de abas inferior com 4 itens, ícone mais rótulo: dentro do HIG (3 a 5) | barra de navegação de 3 a 5 destinos: dentro do M3                                                                | A barra é uma **cápsula flutuante** com pílula luminosa; o M3 usa barra de borda a borda com indicador. Decisão da marca (D56), mantida. |
| Alvos        | 44 pt                                                                        | 48 dp: `ALVO_MINIMO.android` já cobre; botões médios sobem para 48                                                | nenhuma                                                                                                                                  |
| Folha        | folha de baixo com puxador                                                   | folha modal: mesmo desenho                                                                                        | raio 28 e vidro de 30                                                                                                                    |
| Vidro        | `BlurView` nativo, fallback opaco                                            | desfoque em tempo real é caro e instável: **no Android o vidro cai para o opaco** por padrão (`vidroBarra.opaco`) | no Android a barra e a folha ficam opacas; o resto do visual igual                                                                       |
| Fonte grande | Dynamic Type, visualizador de conteúdo grande da barra                       | escala de fonte do sistema                                                                                        | teto de 1,6 e só ícones acima disso                                                                                                      |
| Háptico      | `UIImpactFeedbackGenerator` leve em Aceitar e Chegou                         | `HapticFeedback`                                                                                                  | só com a dependência do Q5 do UX                                                                                                         |
| Voltar       | gesto de borda, com botão                                                    | voltar do sistema                                                                                                 | botão de voltar sempre visível                                                                                                           |

---

## 11. Mapa de implementação

Esforço: **P** (poucas horas a 1 dia), **M** (2 a 4 dias), **G** (mais de 4 dias). Nenhuma dependência nova além do háptico (Q5 do UX); `react-native-svg`, `react-native-reanimated` e `react-native-gesture-handler` já estão instalados. Ordem sugerida: tokens (1), vidro e cartão (2), barra e cartão do momento (3), sol e fundo (4), toast e linha de resposta (5), telas (6), recapturar (7), cada um com `npm run verificar` verde e commit `UJ-F21-Enn`.

### Tokens (`packages/tokens/src`)

| Arquivo                                                         | Mudança                                                                                                                                                                                                                                                                                                                                                                                                                   | Esforço |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `cores.ts`                                                      | `superficie`, `superficieTranslucida`, `superficieElevada`, `botaoTonalOpaco`, `botaoTonalPressionado` mudam de valor; campos novos da `Paleta`: `fundoProfundo`, `realceDoCartao`, `momentoTopo`, `momentoBase`, `momentoBorda1/2/3`, `aceitarFundo`, `recusarFundo`, `toastFundo`, `vidroCabecalho`, `brilhoHorizonte`, `brilhoPoente`, `palco`; `VIDRO.barra/folha` novos valores; os inversos herdam por espalhamento | M       |
| `pares.ts`                                                      | os pares marcados com asterisco na seção 3 (cerca de 40)                                                                                                                                                                                                                                                                                                                                                                  | M       |
| `aurora.ts`                                                     | camadas `horizonte` e `poente`; tabela `LUZ_POR_MOMENTO` (opacidade e deslocamento por momento); `deriva` passa a valer também no Início e nas abas (decisão do dono, seção 12)                                                                                                                                                                                                                                           | M       |
| `index.ts`                                                      | `TIPO.corpo` 16/24, `TIPO.tituloMomento`, `TIPO.contador`; `ELEVACAO.momento`; `ALTURA.aba` e `BARRA_DE_ABAS` para 68 e 4 itens; `RAIO.medio` (alias de 20)                                                                                                                                                                                                                                                               | P       |
| `acesso.ts`                                                     | novo `MOVIMENTO_DAS_TELAS` (abaDissolve 160, pilulaDaAba, cascata `{duracao 200, passo 30, maximo 5, deslocamento 12}`, pilhaIda 350, pilhaVolta 300, folhaIda 340, folhaVolta 240, linhaEncolhe 200, chipPresente 160, seloEstoura 160, avatarDaPilula 200, toast `{entra 200, sai 160, contagem 10000}`, sol `{pose 600, passoDoRaio 40}`, luz 900); curvas `nasce` e `luz` em `CURVAS_DE_ACESSO`                       | P       |
| `geometriaDoSol` (hoje em `acesso.ts` e `ui/geometriaDoSol.ts`) | tabela `POSES_DO_SOL` com os 5 conjuntos de valores da seção 7                                                                                                                                                                                                                                                                                                                                                            | P       |

### Componentes (`apps/app/src/ui`)

| Arquivo                                                                        | Mudança                                                                                                                                                                               | Esforço |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `tema.tsx`, `cor.ts`                                                           | expõe os campos novos; `sombra()` ganha `momento`                                                                                                                                     | P       |
| `CartaoDeVidro.tsx`, `Vidro.tsx`                                               | tinta nova (translúcida de 0,64), realce de topo em degradê, fallback `superficie`; vidro com os valores da seção 5.3 e fallback opaco no Android                                     | M       |
| `CartaoDeDestaque.tsx`                                                         | vira a base do **cartão do momento**: moldura de 1,5 pt (duas `View`), degradê, brilho e o slot do sol; o cartão de destaque claro antigo some                                        | G       |
| novo `CartaoDoMomento.tsx`                                                     | composição dos estados do UX (3.1 e 3.2) sobre a base acima, recebendo a pose do sol e o momento                                                                                      | G       |
| `MarcaDoSol.tsx`, `geometriaDoSol.ts`                                          | prop `pose` (5 valores) com `animatedProps` de `transform` e `opacity` nos 4 grupos; `de` para transição                                                                              | M       |
| `FundoAurora.tsx`, `.web.tsx`, `propsDoFundoAurora.ts`, `geometriaDaAurora.ts` | camadas `horizonte` e `poente`; entrada `momento`; deriva com parada em 84 s; desliga com Reduzir movimento                                                                           | M       |
| `ItemDaBarraDeAbas.tsx`, `navegacao/abas.ts`, `navegacao.ts`                   | 4 itens (com o UX), pílula única que desliza, ícone do sol, teto 1,6 e só ícones                                                                                                      | M       |
| `Toast.tsx`                                                                    | contagem de 10 s (barra `scaleX` e número), botão de 44, `toastFundo`, variante "Tentar de novo", posição acima da barra fixa; quem chama passa `aoConfirmar` para o envio com espera | M       |
| `Esqueleto.tsx`                                                                | formas por tela (momento 262, linha 72, linha 64, agenda 88, check-in) e atraso de 300 ms já existente                                                                                | P       |
| `LinhaDeLista.tsx`, `BotaoDeLinha.tsx`                                         | linha de 56 e 72, ladrilho de 32, separador; sem caixa por linha                                                                                                                      | P       |
| novo `LinhaDeResposta.tsx`                                                     | deslizar com `react-native-gesture-handler` e Reanimated, ações de acessibilidade, botões visíveis                                                                                    | G       |
| `Chip.tsx`                                                                     | cores da seção 8.4 e animação de aparecer                                                                                                                                             | P       |
| `Acordeao.tsx`, `Segmentos.tsx`                                                | seta e altura de 200 ms; polegar desliza (com Reduzir movimento troca na hora)                                                                                                        | P       |
| `Folha.tsx`, `FolhaNaTela.tsx`                                                 | tempos 340 e 240, véu de 200, vidro de 30                                                                                                                                             | P       |
| `CabecalhoDeTela.tsx`, `PilulaDaComunidade.tsx`, `StatusDoCabecalho.tsx`       | vidro ao rolar (6 pt); troca de comunidade com giro do avatar; status "Tudo salvo · 14:32" em 13                                                                                      | M       |
| `Revelar.tsx`, `Aparecer.tsx`                                                  | cascata de até 5 blocos (200 ms, passo 30)                                                                                                                                            | P       |
| `EstadoVazio.tsx`                                                              | sol como ilustração (pose 1)                                                                                                                                                          | P       |
| `Numeros.tsx`, `BarraDeProgresso.tsx`                                          | `contador` 40/40; barra com `scaleX` de 500 ms                                                                                                                                        | P       |
| `acessibilidade.ts`                                                            | nada: o hook de Reduzir movimento e transparência já serve                                                                                                                            | nenhum  |
| `Botao.tsx`                                                                    | nada de visual; só garantir ordem do par (secundário à esquerda) nas telas                                                                                                            | P       |

### Telas (`apps/app/src/funcionalidades`)

Só aparência e o encaixe dos componentes novos: Início (cartão do momento, resposta na linha), Agenda (linha de evento), Check-in (linha de 72 e contador), Ao vivo (cartão "agora" com pose radiante), Meu repertório e cifra (modo palco em `palco`), notificações e perfil (linhas). Esforço agregado: **G**, dependente de o UX v3 estar implementado (as direções não mudam a estrutura).

---

## 12. Riscos

| #   | Risco                                                                                                                                                                                            | Impacto          | Mitigação                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Deriva do fundo fora do login** contraria a regra 2.9 ("sem animação decorativa contínua"); D63 abriu uma exceção só para a entrada. Custo de bateria e quadros.                               | decisão do dono  | Dois círculos, só `transform` e `opacity`, para em 84 s por abertura, desligada com Reduzir movimento, pausada com o app em segundo plano. Se o dono não quiser, tirar a seção 9.1 (linha da deriva) e o desenho continua inteiro. |
| R2  | **Margem curta do `textoSuave` sobre o horizonte (4,55:1).**                                                                                                                                     | acessibilidade   | Nenhum texto nu nos últimos 96 pt; se o `pares.ts` falhar, baixar `brilhoHorizonte` para 0,34.                                                                                                                                     |
| R3  | **Texto pequeno e nu sob o pico coral (3,5:1) reprova.**                                                                                                                                         | acessibilidade   | Regra de layout (seção 3.3). Um teste visual por tela: nada pequeno fora de cartão em x acima de 230 e y abaixo de 200.                                                                                                            |
| R4  | **Moldura em degradê** exige duas `View` e custa um nível de aninhamento por cartão do momento (um por tela).                                                                                    | desempenho baixo | Só o cartão do momento a usa. Medir no aparelho médio.                                                                                                                                                                             |
| R5  | **Pose do sol com `react-native-svg` e Reanimated:** animar `transform` em `G` com `animatedProps` funciona, mas varia por versão. Raios com origem no centro do corpo exigem `transformOrigin`. | técnico médio    | Prova de conceito de meio dia antes de implementar; alternativa: 5 imagens pré-renderizadas com dissolução entre elas.                                                                                                             |
| R6  | **Vidro no Android** (desfoque em tempo real instável).                                                                                                                                          | visual           | Opaco por padrão no Android (seção 10).                                                                                                                                                                                            |
| R7  | **Cartão do momento tem 262 pt, não 190.** O "sem rolar" do UX (seção 3.1) não vale para o membro com pendência.                                                                                 | expectativa      | O que decide está acima da dobra (cartão e botões). Se o dono exigir tudo sem rolar, tirar o bloco "Como chegar" do cartão pendente ou comprimir para 232.                                                                         |
| R8  | **Altura animada** (linha encolhe, acordeão) não é compositor.                                                                                                                                   | desempenho baixo | Layout animation nativa, 200 ms, só nestes 3 casos.                                                                                                                                                                                |
| R9  | **Bricolage 800 em tamanhos grandes com fonte do sistema a 2,0** quebra título longo.                                                                                                            | acessibilidade   | Tetos de 1,6 a 2,0 por papel (seção 4) e `numberOfLines` removido nos títulos de cartão (A9).                                                                                                                                      |
| R10 | **O claro é o par fiel, mas o sol amarelo-laranja fica abaixo de 3:1 sobre branco.**                                                                                                             | logotipo         | Fora da regra 1.4.11 e nunca sozinho; manter. Se o dono quiser, escurecer `solTopo` do claro para `#D9650C`.                                                                                                                       |
| R11 | **Não foi aberto em navegador.**                                                                                                                                                                 | verificação      | Seção 0.                                                                                                                                                                                                                           |

---

## 13. Checklist de aceitação visual (12 itens)

1. **Um destaque por tela:** o cartão do momento é o único bloco com moldura de luz; o botão sólido coral é o único sólido quente por cartão.
2. **A luz acompanha o relógio:** ao trocar o momento (longe, véspera, no dia, acontecendo, terminou), a pose do sol e o brilho de base mudam juntos, nos dois temas, em 600 e 900 ms (ou dissolvem em 120 ms com Reduzir movimento).
3. **Contraste AA em todos os pares da seção 3,** nos dois temas, conferidos pelo `pares.ts`; `textoSuave` sobre o horizonte, no mínimo 4,5.
4. **Texto sobre o cartão do momento** mede 4,5:1 ou mais com o brilho de até 12% nas áreas de texto; no canto do sol não há texto.
5. **Vidro só no que flutua** (barra de abas, cabeçalho rolado, folha, barra fixa); cartões sem desfoque; com Reduzir transparência todo vidro é opaco e legível.
6. **Alvos:** 48 nos botões médios, 56 nos grandes e no ao vivo, 72 nas linhas do check-in, 44 por 44 no "Desfazer"; nada abaixo de 44.
7. **Cor nunca sozinha:** confirmado, aguardando, atraso, presente, sem internet e desabilitado têm ícone ou texto; o fundo revelado do deslizar tem a palavra.
8. **Barra de abas:** 4 itens, cápsula de 68, pílula que desliza, ícone do sol no Início, sem bolinha nem número em nenhuma aba, só ícones acima de fonte 1,6.
9. **Toast com Desfazer:** 10 s, contagem em número visível (e a barra, se houver movimento), botão de 44, o aviso só sai quando fecha, foco não roubado.
10. **Fonte grande (1,0 a 2,0):** pares empilham com o primário em cima, segmentos viram lista, o bloco do dia vai para cima, o cartão cresce em altura, nenhum botão sai da tela, sem texto cortado.
11. **Estados completos em todo componente:** repouso, pressionado, foco (anel coral, nunca amarelo), desabilitado com motivo, carregando (esqueleto da forma final depois de 300 ms), erro (balanço de 260 ms e frase), sem internet (faixa e botões com motivo), sucesso.
12. **Reduzir movimento:** nenhum deslocamento, nenhuma escala, esqueleto parado, deriva desligada, sol já no lugar, os 5 momentos de encanto viram só texto, e o número do toast continua.

---

## 14. O que o protótipo não cobre (e o que ele simplifica)

- **Convocar:** a folha abre só "para Bateria" (o primeiro passo "escolher a função" do toque geral não existe); só a busca e a seleção múltipla estão vivas.
- **Marcar o próximo sábado:** a folha de conferência existe, mas "Ver", "Trocar" e "Salvar rascunho" só avisam que ficam fora; "Levar as músicas também" é um interruptor sem efeito.
- **Dados da outra comunidade:** a troca de comunidade muda nome, avatar, cor e conta de pessoas e mostra o esqueleto; o conteúdo é o mesmo.
- **Agenda:** "Ver encontros passados", "Novo encontro" (além da folha de conferência), busca e rascunhos não abrem nada. O calendário marca dias e leva a lista até o dia.
- **Câmera do QR, mapa, compartilhar, Versículo do dia inteiro, avisos, pedidos de oração, pessoas, relatórios, Organização:** mostram um aviso curto de que ficam fora.
- **Cifra:** 4 músicas fictícias e originais (letra inventada para o protótipo), transposição de Tom por semitons, A- e A+, modo palco; sem baixar, sem tom por vocalista.
- **Sem internet:** é uma simulação visual (faixa, botões desabilitados com motivo); não há fila.
- **Foco do teclado** não é preservado quando a tela se redesenha; no app isso é obrigação do componente.
- **Sem leitor de tela testado.** Há `aria-label`, `aria-pressed`, `role` e região `status`, mas nada foi verificado com VoiceOver ou TalkBack.
