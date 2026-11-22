# Direção B: Claro e acolhedor

Data: 22/11/2026. Base obrigatória: `docs/design/app-v3-ux.md` (estrutura, textos, estados e catálogo de movimento ficam como estão). Protótipo clicável: `docs/design/v3/b/prototipo.html` (abre com dois cliques, funciona sem internet).

## 0. O que foi medido e o que não foi

- **Razões de contraste:** calculei à mão com a fórmula da WCAG 2.x (luminância relativa com linearização sRGB). Não havia terminal nesta sessão para rodar `contraste.test.ts`. Escolhi cores com folga de pelo menos 0,4 sobre o limite (4,5 para texto, 3 para componente), então um erro de arredondamento não vira reprovação. Antes de implementar, os pares da seção 3.3 entram em `packages/tokens/src/pares.ts` e o teste existente confirma.
- **Protótipo:** nunca foi aberto em navegador nem em aparelho por mim. Escrevi, li e revisei o código, mas "funciona" só vale depois de alguém abrir. VoiceOver e TalkBack não foram testados; o que o protótipo faz por acessibilidade (rótulos, `aria-pressed`, `role="dialog"`, anúncio em região viva, foco devolvido ao fechar a folha) é desenho, a verificar no aparelho.
- **Fraunces no app nativo:** o pacote `@expo-google-fonts/fraunces` existe (versão 0.4.1, licença OFL-1.1). Não confirmei se as instâncias estáticas dele trazem o eixo SOFT. No protótipo, com internet, uso `SOFT 100`; sem internet, cai em Georgia. Se o pacote não tiver o SOFT, os títulos ficam mais secos que no protótipo (ver riscos).
- **Tamanhos de fonte:** o protótipo escala de 1,0 a 2,0 pela variável `--fs` com tetos por papel, como o app faz com `maxFontSizeMultiplier`.

## 1. Conceito em 5 linhas

1. O app parece uma conversa com o colega que organiza o sábado, não um painel: papel creme quente, cartões brancos macios, texto grande e muito respiro.
2. O tema claro é o principal; o escuro é "a mesma sala à noite": marrom quente, não índigo.
3. Cor com economia: terracota como única ação, verde-sálvia como "deu certo", âmbar, rosa-cereja e azul-calmo só para estados.
4. Títulos em serifa suave (Fraunces), texto em Inter, ícones de traço arredondado, e o sol da marca como única ilustração, em 5 poses, nos momentos raros.
5. Quem tem 16 anos e quem tem 55 leem a mesma tela: nada menor que 14 pt, alvo mínimo 44 pt, botão grande com verbo, e o primário sempre acima da dobra.

## 2. Contrato com o documento de UX e onde esta direção diverge

Fica fixo e foi seguido: 4 abas, ordem dos blocos, todos os textos, todos os estados (carregando, vazio, erro, sem internet, sucesso), quantidade de botões e primário de cada tela, cartão do momento por relógio e papel, Desfazer de 10 s em vez de "tem certeza?", deslizar para aceitar com botões equivalentes, durações e sentido dos movimentos.

Divergências que o dono precisa saber (todas decididas por esta direção, nenhuma muda texto ou ordem):

| #   | Divergência                                                                                                                                                                                                                                                                                                             | Por quê                                                                               | Custo                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | O Início do membro **não cabe em 720 pt sem rolar** quando há "Para responder". O cartão do momento tem cerca de 330 pt (o documento previa cerca de 190). O botão primário fica sempre acima da dobra; o resumo e o aviso fixado ficam abaixo de uma rolagem curta de cerca de 100 pt. Sem pendência extra, tudo cabe. | Tipografia grande e respiro são o conceito.                                           | Violação do parágrafo "tudo cabe em 720 pt" da seção 3.1. Esqueleto do cartão sobe de 190 para 300 pt, para não pular.                                                   |
| D2  | **Sem Aurora** (os brilhos coral e violeta). Entra uma lavagem de luz quente dentro do cartão do momento (radial de 16% no canto superior direito).                                                                                                                                                                     | A Aurora é a identidade do índigo; o conceito pede creme.                             | A seção 9.1 do documento diz para não mexer na Aurora; aqui ela sai. É a decisão mais séria da direção. Ícone e abertura do app precisam de decisão (seção 10, item 19). |
| D3  | **Tema escuro marrom quente**, não índigo.                                                                                                                                                                                                                                                                              | O escuro é "par fiel" do claro, com mesma família de matiz.                           | Quebra a continuidade visual com o escuro de hoje.                                                                                                                       |
| D4  | **Primário sem degradê** e sem realce interno; sombra terracota suave. Em par, **primário primeiro** (esquerda; em cima quando empilha), não à direita como em `controles-v2.md`.                                                                                                                                       | Ordem de leitura: a pergunta "Aceitar?" vem antes. Empilhado já era primário em cima. | Muda `aparenciaDoBotao.ts`.                                                                                                                                              |
| D5  | **Rótulo da aba em 14 pt** (era 11). Com fonte do sistema a partir de 1,1, as abas inativas viram só ícone e a ativa mostra ícone e rótulo lado a lado ("ativa expandida").                                                                                                                                             | Nada abaixo de 14 pt; "Comunidade" em 14 pt ocupa cerca de 80 de 88 pt.               | Dois layouts de barra.                                                                                                                                                   |
| D6  | Acordeão (200 ms) e "linha encolhe" (200 ms) animam **altura**, como pede o catálogo do documento. Todo o resto só `opacity` e `transform`.                                                                                                                                                                             | Está no catálogo 6.2.                                                                 | No RN, animação de layout do Reanimated.                                                                                                                                 |
| D7  | O Perfil mostra **o cartão da pessoa e 5 linhas** (Notificações, Segurança, Privacidade e dados, Comunidades, Ajuda), mais "Sair". "Plataforma" só aparece para o Criador e não está no protótipo.                                                                                                                      | O documento diz "6 linhas": contei o cartão como a primeira.                          | Nenhum.                                                                                                                                                                  |
| D8  | O protótipo não limita "um encanto do sol por sessão": cada um dos 5 toca uma vez, e há um botão para rever.                                                                                                                                                                                                            | Para o dono ver os cinco na mesma sessão.                                             | No app vale a regra do documento (6.3).                                                                                                                                  |

## 3. Tokens

Os nomes seguem `Paleta` em `packages/tokens/src/cores.ts` onde a chave existe. Onde não existe, a coluna diz "nova".

### 3.1 Cores nos dois temas

| Token (nome no protótipo) | Chave em `cores.ts`                          | Claro                                                                     | Escuro                                                                    | Uso                                                          |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| papel                     | `fundo`                                      | `#FBF5EC`                                                                 | `#1B1511`                                                                 | fundo da tela (creme, nunca branco frio)                     |
| areia                     | nova `areia`                                 | `#F3E9DA`                                                                 | `#241C17`                                                                 | aviso fixado, tile de ícone, tile do dia                     |
| sup                       | `superficie`                                 | `#FFFFFF`                                                                 | `#272019`                                                                 | cartões                                                      |
| sup2                      | nova `superficieInset`                       | `#FFF8EE`                                                                 | `#2E251D`                                                                 | bloco "Sua parte" dentro do cartão                           |
| folha                     | `superficieElevada`                          | `#FFFFFF`                                                                 | `#332920`                                                                 | folha e diálogo                                              |
| texto                     | `texto`                                      | `#2A1F17`                                                                 | `#F7EEE3`                                                                 | texto principal (marrom-café, não preto)                     |
| suave                     | `textoSuave`                                 | `#66554A`                                                                 | `#CDBBA9`                                                                 | meta, ajuda, aba inativa                                     |
| coral                     | `primaria`                                   | `#B5421D`                                                                 | `#EE8A62`                                                                 | botão primário, selo do sino, "acontecendo agora"            |
| coral-p                   | `primariaPressionada`                        | `#9D3715`                                                                 | `#D9764F`                                                                 | primário pressionado                                         |
| sobre                     | `sobrePrimaria`                              | `#FFFFFF`                                                                 | `#2A1209`                                                                 | texto sobre o primário                                       |
| dest                      | `destaque`                                   | `#9A3412`                                                                 | `#FFB08C`                                                                 | link, aba ativa, terciário, chip "EM 5 DIAS"                 |
| quente                    | `quenteFundo`, `abaAtivaFundo`               | `#FDE6DA`                                                                 | `#4A2E21`                                                                 | chip quente, pílula da aba ativa                             |
| tonal                     | `botaoTonal` (passa a ser opaco)             | `#F3E4D0`                                                                 | `#3A2F26`                                                                 | botão secundário, trilho do segmento, botão só ícone         |
| contorno                  | `contorno`, `campoBorda`                     | `#8A7766`                                                                 | `#9A8878`                                                                 | borda de campo, caixa de marcar                              |
| exemplo                   | `campoExemplo`                               | `#7A685A`                                                                 | `#B3A190`                                                                 | placeholder                                                  |
| campo                     | `campoFundo`                                 | `#FFFFFF`                                                                 | `#332920`                                                                 | caixa do campo                                               |
| ok                        | `sucesso`                                    | `#2E5E45`                                                                 | `#9ADBB4`                                                                 | texto de confirmado, presente, conectado                     |
| ok-f                      | `sucessoFundo`                               | `#E2EFE5`                                                                 | `#23362B`                                                                 | fundo do chip de sucesso                                     |
| ok-ic                     | nova `sucessoIcone`                          | `#3F7A5A`                                                                 | `#6FB88B`                                                                 | check, barra de progresso, fundo do deslizar                 |
| al                        | `alerta`                                     | `#7A4E00`                                                                 | `#F2C46D`                                                                 | aguardando, sem internet                                     |
| al-f                      | `alertaFundo`                                | `#FFF0CC`                                                                 | `#3A2E16`                                                                 | fundo do chip de alerta e da faixa                           |
| er                        | `erro`                                       | `#A31F3D`                                                                 | `#FF9DB0`                                                                 | erro, "Passou 3 min", Sair (rosa-cereja, longe do terracota) |
| er-f                      | `erroFundo`                                  | `#FBE4E8`                                                                 | `#3D1F29`                                                                 | fundo de erro                                                |
| in                        | `info`                                       | `#2D5C88`                                                                 | `#9CC7EE`                                                                 | "Aberto ao público", "Inscrito"                              |
| in-f                      | `infoFundo`                                  | `#E0ECF8`                                                                 | `#1F3144`                                                                 | fundo do chip de info                                        |
| neu-f                     | `neutroFundo`                                | `#EFE4D3`                                                                 | `#3A3027`                                                                 | chip neutro ("Rascunho", "NADA MARCADO"), trilho de barra    |
| esq                       | `esqueleto`                                  | `#EFE3D2`                                                                 | `#352B23`                                                                 | blocos do esqueleto (decorativo)                             |
| sep                       | `separador`                                  | `rgba(120,80,40,.12)`                                                     | `rgba(255,236,214,.10)`                                                   | linha entre itens (decorativo)                               |
| foco                      | `foco`                                       | `#9A3412`                                                                 | `#FFB08C`                                                                 | anel de foco, 3 pt, afastado 3                               |
| off-bg e off-tx           | novas `primariaOffFundo`, `primariaOffTexto` | `#E9C7B8` e `#7A3A22`                                                     | `#5A3A2B` e `#E9B9A3`                                                     | primário desabilitado (continua coral apagado, como D64)     |
| inverso (toast)           | `INVERSO_*`                                  | fundo `#2A1F17`, texto `#FBF5EC`, ação `#FFB08C`                          | fundo `#F7EEE3`, texto `#2A1F17`, ação `#9A3412`                          | toast com Desfazer                                           |
| véu                       | `veu`                                        | `rgba(42,31,23,.45)`                                                      | `rgba(8,5,3,.60)`                                                         | atrás da folha                                               |
| sol (decorativo)          | novas                                        | `#F9B25F` a `#E4693A`, raio `#EE8C45`, barra `#B5421D`, barra 2 `#D99A86` | `#F4B070` a `#E27B4F`, raio `#E9965C`, barra `#EE8A62`, barra 2 `#8C5A48` | ilustração do sol                                            |

Cores de avatar (texto sempre branco): `#B5421D`, `#3F7A5A`, `#2D5C88`, `#7A4A8C`, `#8A5A00`, `#A31F3D`. Valem nos dois temas.

Neutro com viés: todos os neutros puxam para o marrom quente (matiz de cerca de 30 graus). Não há cinza puro em lugar nenhum.

Escuro recalculado, não invertido: cores semânticas ficam mais claras e menos saturadas (sálvia `#9ADBB4` em vez de `#2E5E45`, âmbar `#F2C46D`), o coral sobe de `#B5421D` para `#EE8A62` para não vibrar, e a sombra some (a borda de 1 pt em `rgba(255,236,214,.09)` faz o papel).

### 3.2 Sombras, bordas e raios

| Nível                                    | Claro                                                                                                  | Escuro                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| cartão                                   | `0 1px 2px rgba(92,58,28,.06), 0 8px 24px rgba(92,58,28,.08)` mais borda de 1 pt `rgba(120,80,40,.06)` | sem sombra, borda de 1 pt `rgba(255,236,214,.09)` |
| flutuante (barra de abas, toast, pílula) | `0 12px 32px rgba(92,58,28,.16)`                                                                       | `0 12px 32px rgba(0,0,0,.50)`                     |
| botão primário                           | `0 6px 16px rgba(181,66,29,.28)`, some ao pressionar                                                   | `0 6px 16px rgba(238,138,98,.22)`                 |
| folha                                    | `0 -12px 40px rgba(60,36,16,.22)`                                                                      | `0 -12px 40px rgba(0,0,0,.55)`                    |

A sombra é tingida de marrom, não de preto: no creme, sombra cinza parece suja. No Android, `boxShadow` com cor exige a Nova Arquitetura do RN (o código atual já usa `boxShadow`); verificar no aparelho.

Bordas: 1 pt hairline decorativa no cartão. Controle interativo com borda (campo, caixa de marcar) usa `contorno` de 2 pt, 3:1 contra o fundo. Com "Aumentar contraste": borda de 2 pt em `texto` em cartão e linha.

| Raio            | Valor           | Onde                                                                |
| --------------- | --------------- | ------------------------------------------------------------------- |
| cartão          | 28              | cartão do momento, cartões, linha da Agenda, linha do Check-in (24) |
| bloco interno   | 20              | "Sua parte", tile do dia, aviso fixado (24), campo                  |
| barra de abas   | 36              | cápsula de 72 pt de altura                                          |
| folha           | 32 (só em cima) | folhas                                                              |
| cápsula         | 999             | botões, chips, pílula, polegar do segmento, avatar                  |
| caixa de marcar | 9               | caixa de 28 pt                                                      |

### 3.3 Tabela de contraste (calculada à mão, ver seção 0)

Texto normal exige 4,5:1. Componente de interface exige 3:1. Todos os pares usados passam nos dois temas. Os dois valores de cada célula são "claro / escuro".

| Par (texto sobre fundo)                         | Mínimo | Claro                                | Escuro |
| ----------------------------------------------- | ------ | ------------------------------------ | ------ |
| texto sobre papel                               | 4,5    | 14,8                                 | 15,7   |
| texto sobre sup (cartão)                        | 4,5    | 16,1                                 | 14,0   |
| texto sobre sup2                                | 4,5    | 15,2                                 | 13,1   |
| texto sobre areia                               | 4,5    | 13,4                                 | 14,6   |
| texto sobre tonal (botão secundário)            | 4,5    | 12,9                                 | 11,3   |
| texto sobre neu-f (chip neutro)                 | 4,5    | 12,8                                 | 11,2   |
| suave sobre papel                               | 4,5    | 6,5                                  | 9,7    |
| suave sobre sup                                 | 4,5    | 7,1                                  | 8,6    |
| suave sobre sup2                                | 4,5    | 6,7                                  | 8,1    |
| suave sobre areia                               | 4,5    | 5,9                                  | 9,0    |
| suave sobre tonal                               | 4,5    | 5,7                                  | 7,0    |
| suave sobre neu-f                               | 4,5    | 5,6                                  | 6,9    |
| suave sobre folha                               | 4,5    | 7,1                                  | 7,6    |
| sobre sobre coral (botão primário)              | 4,5    | 5,6                                  | 7,1    |
| sobre sobre coral-p (pressionado)               | 4,5    | 7,0                                  | 5,6    |
| sobre sobre coral (chip "ACONTECENDO AGORA")    | 4,5    | 5,6                                  | 7,1    |
| dest sobre papel                                | 4,5    | 6,7                                  | 10,2   |
| dest sobre sup                                  | 4,5    | 7,3                                  | 9,1    |
| dest sobre quente (chip "EM 5 DIAS", aba ativa) | 4,5    | 6,1                                  | 7,0    |
| ok sobre ok-f                                   | 4,5    | 6,3                                  | 8,1    |
| ok sobre sup                                    | 4,5    | 7,5                                  | 10,1   |
| al sobre al-f                                   | 4,5    | 6,4                                  | 8,2    |
| er sobre er-f                                   | 4,5    | 6,2                                  | 7,5    |
| er sobre papel (link "Sair")                    | 4,5    | 6,9                                  | 9,2    |
| in sobre in-f                                   | 4,5    | 5,9                                  | 7,5    |
| exemplo sobre campo (placeholder)               | 4,5    | 5,3                                  | 5,7    |
| off-tx sobre off-bg (primário desabilitado)     | 4,5    | 5,4                                  | 5,8    |
| inverso: texto sobre fundo do toast             | 4,5    | 14,8                                 | 14,0   |
| inverso: ação "Desfazer" sobre fundo do toast   | 4,5    | 9,1                                  | 6,4    |
| branco sobre cada cor de avatar                 | 4,5    | de 5,1 (`#3F7A5A`) a 7,4 (`#A31F3D`) | igual  |
| Palco: texto `#FFF6EA` sobre `#0E0B09`          | 4,5    | 18,3                                 | 18,3   |
| Palco: acorde `#FFC29E` sobre `#0E0B09`         | 4,5    | 12,6                                 | 12,6   |
| Palco: suave `#D9C9B8` sobre `#0E0B09`          | 4,5    | 12,1                                 | 12,1   |

| Par (componente)                                     | Mínimo | Claro | Escuro |
| ---------------------------------------------------- | ------ | ----- | ------ |
| coral (botão primário) contra papel                  | 3      | 5,2   | 7,3    |
| coral contra sup                                     | 3      | 5,6   | 6,5    |
| contorno (campo, caixa) contra sup                   | 3      | 4,3   | 4,7    |
| contorno contra papel                                | 3      | 3,9   | 5,3    |
| contorno contra areia                                | 3      | 3,6   | 4,9    |
| ok-ic (check, barra) contra sup                      | 3      | 5,1   | 6,8    |
| ok-ic contra papel                                   | 3      | 4,7   | 7,7    |
| ok-ic contra ok-f                                    | 3      | 4,3   | 5,4    |
| foco contra papel                                    | 3      | 6,7   | 10,2   |
| ícone da aba inativa (suave) contra o fundo da barra | 3      | 7,1   | 8,3    |

O botão secundário (`tonal`) não tem borda: como em `controles-v2.md`, a WCAG 1.4.11 dispensa o limite quando o texto do botão já identifica o controle (12,9:1 e 11,3:1). Cor nunca é o único sinal: toda cor de estado vem com ícone e texto (check, relógio, alerta, wifi cortado).

## 4. Tipografia

| Papel             | Família e peso            | Tamanho / entrelinha                | Teto de escala | Onde                                                                                          |
| ----------------- | ------------------------- | ----------------------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| display           | Fraunces 600              | 36 / 40                             | 1,6            | saudação, título de aba                                                                       |
| tituloTela        | Fraunces 600              | 30 / 35                             | 1,8            | título de tela de pilha e de folha grande                                                     |
| tituloCartao      | Fraunces 600              | 26 / 31                             | 2,0            | "Sábado Jovem" no cartão                                                                      |
| secao             | Fraunces 600              | 22 / 26 (grupo da Agenda: 20 / 25)  | 1,8            | "Para responder", "Avisos", "Mais"                                                            |
| numero            | Fraunces 600              | 34 / 38                             | 1,6            | contador do Check-in                                                                          |
| cronometro        | Inter 600, `tabular-nums` | 64 / 67                             | 1,4            | Ao vivo                                                                                       |
| versiculo (linha) | Fraunces 500              | 17 / 24                             | sem teto       | linha do versículo                                                                            |
| corpo e leitura   | Inter 400                 | 17 / 26 (versículo aberto: 18 / 28) | sem teto       | texto corrido                                                                                 |
| tituloItem        | Inter 600                 | 17 / 23                             | sem teto       | nome de pessoa, título de linha                                                               |
| rotulo            | Inter 600                 | 16 / 22                             | sem teto       | "Sua parte", rótulo de campo                                                                  |
| meta              | Inter 400                 | 16 / 22                             | sem teto       | data, hora, local                                                                             |
| legenda           | Inter 400                 | 15 / 21                             | sem teto       | apoio, motivo do botão desabilitado                                                           |
| botao             | Inter 600                 | 17 / 21                             | 2,0            | botões                                                                                        |
| chip              | Inter 600                 | 14 / 18, espaçamento 0,01 em        | 1,6            | chips e etiquetas (as etiquetas do documento ficam em maiúsculas digitadas, como ele escreve) |
| aba               | Inter 500, ativa 600      | 14 / 16                             | 1,6            | rótulo da barra                                                                               |

Pisos: nada abaixo de 14 pt (o app hoje tem 11 e 13). Linha de leitura entre 45 e 75 caracteres em 342 pt de largura útil. Números em coluna (horário do roteiro, cronômetro, contador, datas) em Inter com `tabular-nums`, por segurança: não confirmei que a Fraunces tenha algarismos tabulares.

**Por que Fraunces para títulos.** É uma serifa de "estilo antigo suave" com contraste baixo e eixo SOFT que arredonda as pontas. Título em serifa suave lê como carta e como conversa, o contrário de painel; combina com um app de fé e com o creme. Para quem tem 55 anos, a serifa em corpo 26 a 36 é fácil de ler e dá hierarquia por forma, não só por tamanho. Alternativa pesada: Young Serif (peso único, mais robusta, sem eixos). Alternativa sem serifa arredondada: Nunito. Escolhi Fraunces pela família de pesos (500 a 700) e pelo eixo SOFT.

**Por que Inter para texto.** Já está no app (400, 500, 600, `tabular-nums`, boa em corpo 15 a 17), então zero risco novo no texto. Só entra **uma** família nova.

**Licença e custo:** Fraunces e Inter são OFL-1.1 (livres para embutir em app). Bricolage Grotesque, que sai, também é OFL. Custo recorrente R$ 0 (D4). Pacote novo: `@expo-google-fonts/fraunces`. Peso a embutir: 2 arquivos (500 e 600); tamanho em kB não medido.

**Reservas.** Protótipo: `'Fraunces','Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif` para títulos e `'Inter',system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif` para texto. No app: se o arquivo não carregar, serifa do sistema (`Georgia` no iOS, `serif` no Android).

## 5. Espaço, alturas e alvos

Escala fixa: **4, 8, 12, 16, 20, 24, 32, 40, 48, 64**. Dentro de componentes valem também 2, 6, 10 (como `ESPACOS_INTERNOS` já permite): o gap de 6 do chip, o de 2 do rótulo da aba, a sobreposição de 10 dos avatares.

| Ritmo                            | Valor                                  |
| -------------------------------- | -------------------------------------- |
| margem lateral da tela           | 24 (era 20)                            |
| entre blocos                     | 24 (era 16)                            |
| padding de cartão                | 24; cartão compacto 16                 |
| padding de linha de lista        | 16 em cima e embaixo, altura mínima 72 |
| entre botões em par              | 12                                     |
| entre título de seção e conteúdo | 12                                     |
| fim das telas de aba             | 120                                    |

| Elemento                                     | Altura                            |
| -------------------------------------------- | --------------------------------- |
| botão grande (barra de ação, Ao vivo, folha) | 56                                |
| botão médio (dentro de cartão)               | 52                                |
| botão compacto (linha de lista, folha)       | 44                                |
| linha do Check-in                            | 72 mínimo, linha inteira é o alvo |
| opção de folha (checkbox, rádio)             | 64 mínimo                         |
| segmento                                     | trilho 56, opção 48               |
| chip de filtro                               | 44                                |
| chip informativo                             | 32 (não é alvo)                   |
| item da barra de abas                        | 56, barra 72                      |
| pílula da comunidade e sino                  | 48                                |
| botão de ícone                               | 44 a 48                           |
| Desfazer no toast                            | 48                                |

## 6. Ícones

Família própria de traço, grade 24, traço 2 (2,3 quando ativo; 2,4 nos de 16 pt dentro de chip), pontas e cantos redondos, sem cantos vivos. Ativo na barra de abas: o mesmo desenho com o miolo preenchido em coral a 20%. Tamanhos: 16 (chip), 20 (botão, linha), 24 (padrão), 26 (aba), 28 (grande). Sempre com texto ao lado ou rótulo acessível; nenhum ícone sozinho carrega significado.

Conjunto desenhado no protótipo (36 símbolos): início, calendário, pessoas, usuário, sino, seta (3 direções), check, x, mais, menos, local, compartilhar, três pontos, relógio, nota musical, sem internet, alerta, cadeado, desfazer, QR, busca, livro, escudo, coração (oração), aviso (megafone), tocar, pausar, baixar, sair, ajuda, arquivo, sol nascendo, rádio (ao vivo), lista. Sem emoji em lugar nenhum.

## 7. O sol em 5 poses

Uma ilustração só, em SVG (`viewBox` 120 x 96, horizonte em y = 72), parada. Corpo com degradê vertical `sol1` para `sol2`, raios de 6 pt de traço com pontas redondas (de r+10 a r+20), duas barras de horizonte (a marca do app: 92 x 6 e 52 x 6, em `sol-barra` e `sol-barra2`). Decorativa e escondida do leitor de tela. Sem texto dentro da imagem.

| Pose                 | Desenho                                                                              | Onde                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1 atrás do horizonte | só uma fatia do disco acima da barra (centro em y = 92) e o brilho; sem raios        | "Ainda não há encontro marcado", Agenda vazia, avisos vazios, sino vazio, sem comunidade                                     |
| 2 metade             | meio disco na barra (centro em y = 72), 5 raios de 150 a 30 graus (a marca do login) | vazios com ação ou sem ação mais discretos: "Só o que é meu", Check-in, repertório, Ao vivo sem roteiro, "Fora do protótipo" |
| 3 inteiro            | disco completo sobre a barra (centro em y = 50, raio 22), 7 raios de 0 a 180 graus   | "Tudo em dia" (56 pt)                                                                                                        |
| 4 com oração         | meia pose com um coração branco de contorno terracota diante do corpo                | Pedidos de oração vazio                                                                                                      |
| 5 com pessoas        | meia pose com duas figuras simples (sálvia e terracota) na barra                     | Pessoas vazio ("Por enquanto, só você")                                                                                      |

No protótipo, as 5 poses lado a lado estão no botão "Ver o sol em 5 poses" (fora da moldura). As poses 4 e 5 aparecem também nas telas "Fora do protótipo" de Pedidos de oração e de Pessoas. Tamanho: 120 pt de largura nos vazios de tela inteira, 96 na galeria, 56 pt no "Tudo em dia". A pose 3 é o único sol que sobe (seção 9, encanto 4). O sol não é decoração: não aparece em cartão, em cabeçalho nem em botão.

## 8. Componentes

### 8.1 Barra de abas

Cápsula branca (`tab-bg`) flutuante: 72 pt de altura, raio 36, margem lateral 12, 24 do fim, sombra flutuante, borda de 1 pt. 4 itens de 88 pt. A pílula da aba ativa (`quente`, 56 pt, raio 28) desliza por baixo com a mola `toque`. Item: ícone de 26 pt e rótulo de 14 pt; ativo em `dest` e peso 600, inativo em `suave`. Com fonte do sistema a partir de 1,1: inativas só ícone (rótulo no leitor de tela) e ativa com ícone e rótulo lado a lado dentro da própria pílula. Sem bolinha nem número em aba (o sino é o único lugar de "tem novidade"). Estados: repouso, hover (web: camada de 4%), foco (anel), ativo, pressionado (escala 0,98 no ícone). Com "Reduzir transparência" não muda, porque já é opaca; o fundo da lavagem inferior (gradiente papel até transparente, 120 pt) existe só para ler a barra sobre o conteúdo.

### 8.2 Cartão do momento

Cartão branco, raio 28, padding 24, lavagem de luz no canto superior direito. Ordem interna fixa: etiqueta (chip) e, sem internet, "Última versão: hoje, 14:32"; título "Sábado Jovem" (Fraunces 26); data e hora; local com "Como chegar" (link, 44 pt de alvo); bloco "Sua parte" (`sup2`, raio 20); botões. O corpo do cartão abre o Encontro (o título e a data são o alvo, estendido ao cartão todo; os botões ficam acima). Membro: etiqueta em chip `quente`, "ACONTECENDO AGORA" em chip coral cheio com ícone de rádio. Líder: a pergunta é "9 de 11 responderam", barra de 12 pt em `ok-ic` com o número escrito ao lado, e linhas com ícone (relógio para quem falta, alerta para a função, nota para o louvor). Estados do botão primário: repouso, hover, foco, pressionado, desabilitado (com o motivo abaixo e cadeado), carregando, e para o líder "Enviando em 10 s" e "Lembrete enviado". Pendência de resposta: primário "Aceitar", secundário "Não posso ir", pares de largura igual, 12 de intervalo, empilhados a partir de 1,35.

### 8.3 Linha de lista

Dois formatos. **Linha de grupo** (Perfil, Comunidade, resumo): dentro de um cartão, 72 pt, tile de 44 pt (raio 14, `areia`, ícone `dest`), título 17/23, apoio 15/21, seta; separador de 1 pt `sep` (sem borda por linha). **Linha de encontro da Agenda**: cartão próprio (raio 28, padding 16) com o tile do dia à esquerda (64 pt, raio 20: dia em Fraunces 30 e mês em maiúsculas 14), título, hora e local, e **sempre** a linha "Você: ..." com ícone quando há parte, ou o chip "Inscrito". Pendente: chip "Aguardando sua resposta" mais dois botões compactos de 44 pt, e a linha desliza para aceitar. Com fonte grande o tile do dia vai para cima do título.

### 8.4 Chip

Cápsula de 32 pt, padding 4 x 12, ícone de 16 pt à esquerda, Inter 600 14. Seis variantes (fundo e texto de 3.1, razão em 3.3): quente (`EM 5 DIAS`), ok (Confirmado, Presente, Conectado, Aceitou), al (Aguardando sua resposta, Sem conexão), er (Passou 3 min), in (Aberto ao público, Inscrito), neutro (Rascunho, NADA MARCADO, "x de 5 funções confirmadas"), mais o cheio coral (ACONTECENDO AGORA). Todos com ícone e texto. Chip de filtro (Calendário, Rascunhos): 44 pt, ativo em `quente` com `dest`.

### 8.5 Esqueleto

Blocos com a forma e a altura finais, raio 28, cor `esq`, sem borda. Início: cartão de 300, linha de 72, linha de 64. Agenda: 3 linhas de 88. Check-in: contador "-- de --" e 6 linhas de 72. Aparece depois de 300 ms (fade de 200 ms); pulso de opacidade 1 para 0,55 em 1200 ms; com Reduzir movimento, estático. Passou de 10 s: o bloco ganha "Demorando mais do que o normal. Confira a internet." com "Tentar de novo". Cabeçalho, título e saudação aparecem na hora.

### 8.6 Toast com Desfazer

Cápsula-retângulo (raio 24, mínimo 64 pt de altura) em tom inverso do tema, 12 pt de cada lado, acima da barra de abas (112 do fim; 32 nas telas de pilha). Texto 16/22 em 500, botão "Desfazer" de 48 pt em sublinhado e `inverso-ação` (9,1:1 e 6,4:1), número "9 s" em `tabular-nums` e, por baixo, uma barra de 4 pt que encolhe em 10 s, linear. Só um toast por vez: o novo confirma o anterior. Ao fim dos 10 s, a ação confirma (o aviso às pessoas sai); "Desfazer" cancela e restaura. Foco não é roubado; o leitor de tela anuncia uma vez "Desfazer disponível por 10 segundos". Com Reduzir movimento: sem barra, só o número.

### 8.7 Botões, pílula, segmento, folha

- **Botão primário:** terracota chapado, texto branco 17/21, cápsula, sombra terracota, sem degradê. Estados: repouso; hover (camada preta de 8%); foco (anel `foco` de 3 pt, afastado 3); pressionado (`coral-p`, escala 0,98, sem sombra); desabilitado (`off-bg` e `off-tx`, motivo abaixo com cadeado); carregando (spinner de 20 pt depois de 250 ms, largura travada).
- **Secundário:** `tonal` opaco, texto `texto`, sem borda. **Terciário:** texto `dest`, hover `quente`. **Destrutivo:** `er-f` com `er`; o cheio (`Cancelar o encontro`) em `er` com texto papel.
- **Pílula da comunidade:** cápsula branca de 48 pt, avatar de 40 pt, nome, seta; sombra de cartão.
- **Segmento:** trilho `tonal` de 56 pt, polegar branco de 48 pt que desliza 200 ms. Com fonte do sistema a partir de 1,35 empilha e o selecionado ganha fundo branco.
- **Folha:** fundo `folha`, raio 32 em cima, alça de 40 x 4, título em Fraunces 26, botão primário colado ao fim (gradiente de fundo para o conteúdo não ficar atrás). Sobe pelo chão com véu de 45%.
- **Linha do Check-in:** cartão de 72 pt, avatar de 44, nome e exceção ("Convocada", "Inscrita"), à direita "Chegou" (cápsula `tonal` de 44 pt) ou o chip "Presente". A linha inteira é o botão (`aria-pressed`). Erro: fundo `er-f` e a frase "Não deu para marcar Ana. Toque para tentar de novo.", com balanço.

## 9. Tabela de movimento

Todas as animações usam só `opacity` e `transform`, exceto a linha D6 (altura, duas vezes). Curvas do app (`acesso.ts`): saída `cubic-bezier(.22, 1, .36, 1)`, padrão `cubic-bezier(.4, 0, .2, 1)`, saída de tela `cubic-bezier(.4, 0, 1, 1)`. No protótipo a mola `toque` ({ damping 18, stiffness 320, mass 0,6 }) é aproximada por `cubic-bezier(.34, 1.5, .64, 1)` e a mola `check` ({ damping 12, stiffness 260, mass 0,7 }) por `cubic-bezier(.3, 1.8, .5, 1)`; no app valem as molas do Reanimated.

| Gatilho                                                                     | Propriedade                                                                                                                                                               | Duração                                                            | Curva                               | Com Reduzir movimento                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------- | --------------------------------------------------- |
| Abrir o app, trocar de comunidade, abrir tela de pilha (entrada em cascata) | `opacity` 0 para 1 e `translateY` 12 para 0, por bloco                                                                                                                    | 340 ms, atraso de 60 ms por bloco (seis blocos terminam em 640 ms) | saída                               | dissolve de 120 ms, sem atraso                      |
| Entre abas                                                                  | conteúdo: `opacity`; pílula: `translateX`                                                                                                                                 | 160 ms; 250 ms                                                     | padrão; mola `toque`                | dissolve de 120 ms; a pílula troca sem deslizar     |
| Abrir o encontro (cartão ou linha)                                          | `translateX` de 100% para 0; volta de 0 para 100%                                                                                                                         | 350 ms; 280 ms                                                     | padrão; saída de tela               | dissolve de 120 ms (o sistema)                      |
| Abrir e fechar folha                                                        | folha: `translateY` de 100% para 0 (volta 220 ms); véu: `opacity`                                                                                                         | 360 ms; 200 ms                                                     | saída; saída de tela; linear no véu | dissolve de 120 ms                                  |
| Aceitar uma convocação                                                      | botão vira "Confirmado": check `scale` 0,6 para 1 e `opacity`; o secundário sai; 1,1 s depois o par seguinte entra                                                        | 200 ms                                                             | mola `check`                        | dissolve de 120 ms, sem escala                      |
| Linha encolhe depois de aceitar (exceção D6)                                | altura de a para b                                                                                                                                                        | 200 ms                                                             | padrão                              | troca na hora                                       |
| Check-in feito                                                              | chip: `scale` 0,9 para 1 e `opacity`; número: `opacity`; barra: `scaleX`                                                                                                  | 160 ms; 120 ms; 300 ms                                             | saída; linear; padrão               | dissolve de 120 ms; barra na hora                   |
| Toast com Desfazer                                                          | sobe 8 (`translateY`) e `opacity`; sai só `opacity`; barra `scaleX` de 1 para 0                                                                                           | 200 ms; 160 ms; 10 s                                               | saída; padrão; linear               | dissolve de 120 ms; sem barra, o número "9 s" conta |
| Aviso novo no sino                                                          | selo `scale` 1 para 1,15 para 1                                                                                                                                           | 160 ms                                                             | saída                               | o número troca na hora                              |
| Erro                                                                        | bloco: `opacity`; campo ou linha: `translateX` 0, -5, 5, -3, 0 (4 passos de 65 ms)                                                                                        | 160 ms; 260 ms                                                     | padrão; linear                      | dissolve de 120 ms, sem balanço                     |
| Carregando                                                                  | esqueleto: `opacity` aparece depois de 300 ms e pulsa 1 para 0,55; botão: spinner `rotate` depois de 250 ms                                                               | 200 ms e 1200 ms; 800 ms por volta                                 | linear e ease-in-out                | esqueleto estático; spinner vira anel parado        |
| Trocar de comunidade                                                        | nome: `opacity`; avatar: `rotateY` 180 para 360; depois esqueleto (650 ms) e cascata                                                                                      | 160 ms; 200 ms                                                     | padrão                              | dissolve; sem giro                                  |
| Acordeão (exceção D6)                                                       | altura; seta `rotate` 180                                                                                                                                                 | 200 ms                                                             | padrão                              | abre sem animação                                   |
| Segmento                                                                    | polegar `translateX`; depois a lista troca                                                                                                                                | 200 ms                                                             | padrão                              | troca na hora                                       |
| Pressionar                                                                  | `scale` 0,98 ao tocar, volta com mola                                                                                                                                     | 90 ms; 160 ms                                                      | linear; mola `toque`                | só a camada de cor, 80 ms                           |
| Deslizar para aceitar                                                       | `translateX` 1:1 com o dedo; a 40% da largura o fundo vira sálvia cheia (e 8 ms de vibração, se houver); ao soltar passa: `translateX` até 100%; senão volta              | 200 ms; 220 ms                                                     | padrão                              | sem transição; os botões continuam                  |
| Desfazer                                                                    | o elemento volta ao estado anterior (a altura, quando muda, também 200 ms). O protótipo troca o conteúdo na hora; o desenho pede o mesmo movimento ao contrário em 160 ms | 160 ms                                                             | o mesmo do ato                      | troca na hora                                       |
| Mensagem de encanto (texto do sol)                                          | `opacity` e `translateY` de -8 para 0, fica 4 s                                                                                                                           | 200 ms                                                             | saída                               | dissolve de 120 ms                                  |

### Os 5 momentos de encanto (o sol)

Todos: no máximo 600 ms de movimento, nunca bloqueiam toque, sempre com o texto do documento, uma vez por conta (no protótipo, uma vez por carga, com botão para rever).

| #   | Momento                         | O que acontece                                                                                                           | Texto                                                  | Reduzir movimento                    |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------ |
| 1   | Primeiro "Aceitar"              | anel de luz ao redor do cartão (ou da linha): `opacity` 0 para 0,35 e `scale` 0,8 para 1 em 600 ms, some em 400 ms       | "Que bom ter você no Louvor." dentro do cartão por 4 s | só o texto                           |
| 2   | Primeira presença marcada       | os 5 raios do sol do contador acendem em sequência: `opacity` e `scale` 0,6 para 1, 160 ms cada, passo de 80 ms (480 ms) | "Primeira presença marcada. Bom sábado!" por 4 s       | raios acesos, sem animar; só o texto |
| 3   | Primeiro encontro publicado     | o botão vira "Publicado" com um disco branco que clareia (`scale` 0,7 para 1, 400 ms)                                    | "Seu primeiro encontro está no ar." por 4 s            | dissolve de 120 ms                   |
| 4   | "Tudo em dia" pela primeira vez | o sol da pose 3 sobe 30 pt (`translateY`) e clareia em 600 ms, cortado pelo horizonte                                    | "Tudo em dia" no próprio resumo                        | sol já no lugar                      |
| 5   | Banda completa                  | o selo "Banda completa: 5 de 5" acende: `opacity` 0,4 para 1 e `scale` 0,96 para 1,06 para 1 em 300 ms                   | "Banda completa: 5 de 5." por 4 s                      | dissolve de 120 ms                   |

## 10. Mapa de implementação (arquivo a arquivo)

Esforço: P até meio dia, M cerca de 1 dia, G 2 dias ou mais. Estimativa minha, não medida. O que é estrutura (4 abas, cartão do momento, desfazer) já está no plano do documento de UX; aqui está só o **custo visual** da direção B em cima dele.

| #   | Arquivo                                                                                                                                                               | Mudança                                                                                                                                                                                                                                                                       | Esforço |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | `packages/tokens/src/cores.ts`                                                                                                                                        | trocar `CLARO` e `ESCURO` pelos valores de 3.1; 4 chaves novas (`areia`, `superficieInset`, `sucessoIcone`, `primariaOff*`); `botaoTonal` e `tonal` passam a opacos; `primariaTopo` e `primariaBase` iguais a `primaria`; `CORES_DA_COMUNIDADE`: o padrão passa a ser o coral | M       |
| 2   | `packages/tokens/src/pares.ts` e `contraste.test.ts`                                                                                                                  | pares de 3.3 como pares obrigatórios nos dois temas                                                                                                                                                                                                                           | M       |
| 3   | `packages/tokens/src/index.ts`                                                                                                                                        | `TIPO` (tamanhos de 4), `FONTES.titulo = 'Fraunces'`, `RAIO` (28, 20, 36, 32), `ESPACO` (e48 e e64), `RITMO` (margem 24, entre blocos 24), `ELEVACAO.claro`, `ALTURA`, `BARRA_DE_ABAS`                                                                                        | M       |
| 4   | `packages/tokens/src/aurora.ts`, `apps/app/src/ui/FundoAurora*.tsx`, `geometriaDaAurora.ts`, `propsDoFundoAurora.ts`                                                  | remover a Aurora das telas autenticadas; a lavagem de luz fica dentro do cartão do momento                                                                                                                                                                                    | M       |
| 5   | `packages/tokens/src/acesso.ts`                                                                                                                                       | `MOVIMENTO_DAS_TELAS` (cascata, aba, pílula, chip, selo, avatar, toast, encantos)                                                                                                                                                                                             | P       |
| 6   | `apps/app/package.json`, `apps/app/src/ui/fontes.ts`                                                                                                                  | `@expo-google-fonts/fraunces` (500 e 600), sair da Bricolage; a validar: se vai por `useFonts` como hoje, não pede build nativo                                                                                                                                               | P       |
| 7   | `apps/app/src/ui/Botao.tsx`, `aparenciaDoBotao.ts`, `BotaoDeLinha.tsx`                                                                                                | sem degradê, sombra terracota, alturas 56, 52, 44, ordem primário primeiro                                                                                                                                                                                                    | M       |
| 8   | `apps/app/src/ui/CartaoDeVidro.tsx`, `CartaoDeDestaque.tsx`                                                                                                           | `CartaoSuave` (claro opaco com sombra) e o novo `CartaoDoMomento`                                                                                                                                                                                                             | G       |
| 9   | `apps/app/src/ui/ItemDaBarraDeAbas.tsx`, `src/app/(autenticado)/(abas)/_layout.tsx`, `src/navegacao/abas.ts`                                                          | 4 abas, pílula deslizante, modo "ativa expandida" a partir de 1,1                                                                                                                                                                                                             | G       |
| 10  | `apps/app/src/ui/PilulaDaComunidade.tsx`, `CabecalhoDeTela.tsx`, `MarcasDeNovidade.tsx`                                                                               | pílula branca de 48, selo do sino com `estoura`, troca de comunidade com giro do avatar                                                                                                                                                                                       | M       |
| 11  | `apps/app/src/ui/LinhaDeLista.tsx`, `Chip.tsx`, `Segmentos.tsx`, `PilulasDeFiltro.tsx`                                                                                | tile de 44, tile do dia, 7 variantes de chip, polegar de 48                                                                                                                                                                                                                   | M       |
| 12  | `apps/app/src/ui/Esqueleto.tsx`, `EstadoVazio.tsx`, `Falha.tsx`, `Aviso.tsx`, `Acordeao.tsx`                                                                          | formas e alturas de 8.5, estados com o sol, bloco de erro com balanço                                                                                                                                                                                                         | M       |
| 13  | `apps/app/src/ui/MarcaDoSol.tsx`, `geometriaDoSol.ts` e novo `IlustracaoDoSol.tsx`                                                                                    | 5 poses (seção 7) com `react-native-svg`; subida da pose 3                                                                                                                                                                                                                    | G       |
| 14  | `apps/app/src/ui/Toast.tsx`, `Folha.tsx`, `FolhaNaTela.tsx`, `DialogoDeConfirmacao*.tsx`                                                                              | Desfazer com contagem de 10 s e barra, folha com alça e botão colado                                                                                                                                                                                                          | M       |
| 15  | `apps/app/src/ui/Campo.tsx`, `CampoDeAcesso.tsx`, `CaixaDeMarcar.tsx`, `Interruptor.tsx`                                                                              | reinterpretar `controles-v2` para o claro: campo branco de raio 20, borda de 2 pt `contorno`, caixa de 28                                                                                                                                                                     | M       |
| 16  | `apps/app/src/ui/Icone.tsx`, `IconeDeTraco.tsx`, `Avatar.tsx` e `packages/tokens/src/avatar.ts`                                                                       | ícones com cantos redondos e traço 2; avatares na paleta nova                                                                                                                                                                                                                 | M       |
| 17  | `src/app/(autenticado)/(abas)/{index,agenda,comunidade,perfil}.tsx`, `evento/[eventoId]/{index,checkin,ao-vivo}.tsx`, `meu-repertorio/*`, `caixa-de-notificacoes.tsx` | só o que é aparência: margem 24, ritmo, tipografia nova; a estrutura é a do documento de UX                                                                                                                                                                                   | G       |
| 18  | testes `ui/__tests__/*`                                                                                                                                               | atualizar valores de raio e altura; novo teste de contraste da tabela 3.3                                                                                                                                                                                                     | M       |
| 19  | `apps/app/app.json`, `icon.png`, abertura (D63)                                                                                                                       | decidir se o ícone e a abertura continuam no índigo ou passam ao creme; o sol coral do ícone continua                                                                                                                                                                         | P a M   |

Total estimado: **9 a 13 dias-pessoa** de trabalho visual, somados ao custo estrutural do documento de UX. Nenhuma dependência paga; uma dependência nova (Fraunces). Nenhum serviço novo, nenhuma migração de banco, nenhuma rota nova (nada de isolamento entre comunidades a testar).

Para app de loja: **segue o HIG no iOS** (folha com alça, botão em cápsula, alvo de 44, barra flutuante, Dynamic Type com tetos) e **o Material 3 no Android** (alvo de 48 dp, snackbar com ação "Desfazer", folha inferior, cantos arredondados grandes). **A marca diverge de propósito** em: barra de abas flutuante de 72 pt com pílula deslizante (o Material 3 pede barra de 80 dp encostada no fim) e título em serifa em vez da fonte do sistema.

## 11. Riscos

| #   | Risco                                                                                                         | Chance e impacto | O que fazer                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| R1  | Tirar a Aurora e o índigo muda a identidade já aprovada (D2 e D3 acima).                                      | Certo, alto      | Decisão do dono antes de qualquer código. A direção A ou C pode manter a identidade.                                     |
| R2  | O eixo SOFT da Fraunces pode não vir no pacote do Expo; os títulos ficariam mais secos.                       | Média, baixo     | Abrir um build de teste com o pacote; se faltar, usar Young Serif (peso único) ou embutir o arquivo variável.            |
| R3  | Início do membro rola ~100 pt com "Para responder" (D1).                                                      | Certo, médio     | Se incomodar: cartão do momento com padding 20 e título 24 recupera cerca de 28 pt; ainda rola. A alternativa é aceitar. |
| R4  | Terracota sobre creme e chips `quente` (pêssego) são da mesma família: o primário pode se confundir com chip. | Média, médio     | O primário é sólido, com sombra, e o chip tem 32 pt sem sombra; testar com 3 pessoas.                                    |
| R5  | Fonte grande 2,0: títulos de 36 viram 57 pt (teto de 1,6) e botões em par empilham; o cartão chega a 600 pt.  | Média, médio     | Testado só no protótipo (CSS); verificar no aparelho com AX5 e 2,0.                                                      |
| R6  | Primário primeiro em par diverge de `controles-v2.md`.                                                        | Certa, baixo     | Registrar como decisão; é uma linha em `aparenciaDoBotao.ts`.                                                            |
| R7  | Sombra tingida e `boxShadow` com cor no Android antigo.                                                       | Baixa, baixo     | Cair para `elevation` neutra sem quebrar o contraste (a sombra é decorativa).                                            |
| R8  | Ratios calculados à mão.                                                                                      | Baixa, alto      | O teste de contraste do repositório confirma antes do merge (seção 0).                                                   |
| R9  | O sol animado em 5 momentos causa desconforto vestibular.                                                     | Baixa, baixo     | Já limitado: 600 ms, uma vez, desligado com Reduzir movimento.                                                           |

## 12. Checklist de aceitação visual (12 itens)

1. Em claro e em escuro, nenhum texto de interface abaixo de 14 pt e nenhum par da tabela 3.3 abaixo do mínimo (o teste de contraste passa).
2. Fundo da tela é creme (`#FBF5EC`), nunca branco `#FFFFFF`; cartões são brancos com sombra marrom, sem borda visível no claro.
3. O Início do membro e o do líder mostram, sem rolar, o cartão com seu botão primário em qualquer dos estados (longe, véspera, no dia, acontecendo, terminou), com o primário em terracota e o secundário tonal, lado a lado com 12 pt de intervalo.
4. A única cor de ação é a terracota: nenhum outro elemento sólido da tela usa `coral`, e nenhum chip de estado depende só de cor (todos têm ícone e texto).
5. Títulos de aba e de tela em Fraunces 600; todo o resto em Inter; algarismos de coluna (horário do roteiro, cronômetro, contador) alinhados em tabular.
6. Barra de abas: 4 itens, cápsula de 72 pt, pílula deslizante; a 1,1 ou mais as inativas viram só ícone e a ativa mostra o rótulo.
7. Alvos: botões de 44 a 56 pt, linha do Check-in com 72 pt ou mais, opção de folha com 64 pt ou mais, "Desfazer" com 48 pt.
8. Esqueleto com a forma final, aparece depois de 300 ms, pulsa em 1200 ms e fica estático com Reduzir movimento.
9. Vazio com o sol na pose do quadro 7, ilustração escondida do leitor de tela, título e texto do documento, e a ação quando existe.
10. Toast com "Desfazer" mostra a contagem em segundos de 10 a 0; o aviso só sai quando a contagem acaba; com Reduzir movimento a barra some e o número continua.
11. Com Reduzir movimento ligado, nenhum elemento se desloca ou escala (cascata, pílula, pilha, folha, chip, halo e sol viram dissolve de 120 ms ou nada), e nenhum texto ou estado depende do movimento.
12. Os 5 momentos do sol tocam uma só vez por conta, cada um com seu texto exato, e nenhum bloqueia o toque.

## 13. O que ficou fora do protótipo

- **Telas:** Login, Boas-vindas, Novo aviso, Pedir oração, Sugerir uma ideia, Convidar, Pessoas, Biblioteca, Relatórios, Notificações e Segurança do Perfil, Editar perfil, Novo encontro completo (existe só a conferência de "Igual ao último sábado"). Elas abrem uma tela "Fora do protótipo" com o mesmo sistema.
- **Não demonstráveis no navegador:** "Reduzir transparência" e "Aumentar contraste" do sistema; leitor de tela; háptico real (usa `navigator.vibrate` se o aparelho tiver); `Como chegar` e compartilhar abrem um toast explicando o que fariam; câmera do QR (há um botão que simula a leitura).
- **Subir e descer** música ou etapa, o `Pressionar e segurar` (menu de linha), puxar para atualizar, a faixa "Aguardando aprovação", Modo palco com tela sempre acesa e tamanho de letra lembrado.
- **Dados:** a comunidade "Juventude Betel" mostra o mesmo conteúdo; só o nome, o avatar e o número de pessoas mudam.
- **Cifra e letras:** as quatro músicas e suas letras foram escritas para o protótipo; o Modo palco e a transposição (Tom e Capotraste) funcionam sobre elas.
