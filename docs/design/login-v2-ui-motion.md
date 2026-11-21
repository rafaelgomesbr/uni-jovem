# Entrada v2 (Entrar e Criar conta): UI, espaçamento e movimento

- Data: 21/11/2026.
- Origem: o dono reprovou a tela Entrar ("refaz do zero, foco total em UX, motion animation, espaçamento e UI, tá ridícula").
- Este documento é o lado visual. A estrutura, o texto e os estados de conteúdo estão em `docs/design/login-v2-ux.md`, e os **nomes de estado são os da seção 3.4 dele** (`entrada.inicio`, `entrada.inicio.convite`, `entrada.inicio.biometria`, `entrada.email`, e os modificadores `carregando.*`, `erro.*`, `sucesso`, `teclado.aberto`, `fonte.grande`, `movimento.reduzido`, `contraste.alto`, `transparencia.reduzida`). Se um nome mudar, muda nos dois.
- Código lido (somente leitura): `packages/tokens/src/*`, `ui/FundoAurora*.tsx`, `ui/geometriaDaAurora.ts`, `ui/BotaoDeAcessoRapido.tsx`, `ui/Botao.tsx`, `ui/Campo.tsx`, `ui/IconeDoApp.tsx`, `ui/Aparecer.tsx`, `ui/Tela.tsx`, `ui/tema.tsx`, `ui/acessibilidade.ts`, `autenticacao/TelaEntrar.tsx`, `CabecalhoDeAcesso.tsx`, `jest.setup.ts`, seções 2.9, 2.11, 2.12 e 3.1 de `especificacao-e-roadmap.md`, e a captura da tela reprovada.
- Nada foi alterado no código. Os valores de contraste foram calculados à mão com a fórmula de `packages/tokens/src/contraste.ts` (WCAG 2.2); ao implementar, entram em `pares.ts` e o teste automático confirma.

## 0. Resumo

**Conceito em 3 linhas.**

1. **Amanhecer.** A tela é uma noite calma em que o sol do app está prestes a nascer: a marca deixa de ser um ícone no canto e vira o centro da composição, um sol sobre um horizonte, com a aurora coral aquecendo atrás dele.
2. **Um peso forte só.** Um botão de cor chapada (o provedor do aparelho), um de contorno, um de texto, e o coral guardado para o "avançar" do e-mail. Sem cartão, sem laje: espaço, alinhamento e uma escala de 4/8 fazem o agrupamento.
3. **Movimento que informa.** Só o sol se move de verdade: nasce uma vez por abertura (780 ms) e pulsa no sucesso. O resto é retorno ao toque, revelação do e-mail e erro. Tudo em `opacity` e `transform`, no thread de UI.

**Momento de marca (restrição incluída).** Na primeira abertura do app (e só nela), o sol sobe de trás do horizonte em 560 ms, os 5 raios acendem em cascata de 40 ms, e a aurora coral esquenta de 55% a 100% em 800 ms. A tela já está interativa no primeiro quadro. Não repete ao voltar de Criar conta, ao fechar o painel de e-mail, nem quando há convite pendente (nesses casos entra a versão curta de 260 ms). Com Reduzir movimento, nada se move.

**Os 5 movimentos principais:** nascer do sol e cascata da abertura (780 ms), revelar o e-mail (280 ms), toque nos botões (escala 0,98 em 90 ms com mola de retorno), erro (balanço de 5 pt em 260 ms mais anúncio), deriva ambiente da aurora (28 e 36 s por ciclo, no máximo 84 s e 108 s por abertura).

## 1. Diagnóstico visual da captura (confirmado e ampliado)

Medidas tiradas da captura (738 px de largura, cerca de 1,88 px por pt, tela de 393 pt):

| #   | Problema                  | Evidência na captura                                                                                       | Efeito                                                                            |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | Marca pequena e escondida | ícone de 56 pt no canto, em linha com o nome em 16 pt                                                      | a primeira impressão do app não existe                                            |
| 2   | Título gigante e genérico | `display` 34/38 em "Bem-vindo de volta", mais 2 linhas de `leitura` 17/26: cerca de 150 pt de texto        | o texto domina e não ajuda a decidir                                              |
| 3   | Duas lajes brancas iguais | Apple e Google, 56 pt, brancas, mesma largura                                                              | são os dois maiores contrastes da tela; brigam entre si                           |
| 4   | Cartão pesado             | cartão de 320 pt de altura, borda e fundo, com campos de 48 pt dentro                                      | cartão dentro de uma tela já cheia; o formulário aparece para quem nem vai usá-lo |
| 5   | Sem ritmo                 | intervalos de 16, 12, 16, 8, 16, 8 pt sem relação entre si                                                 | tudo parece "um bloco"; nada agrupa por proximidade                               |
| 6   | Não cabe                  | conteúdo de cerca de 985 pt em tela de 852 (barra de rolagem visível); no iPhone SE faltam cerca de 280 pt | "Criar conta" encosta no limite e "Tenho um link de convite" some                 |
| 7   | Zero movimento            | nenhum retorno além do escurecimento do botão                                                              | tela morta, sem o momento de marca que o conceito pede                            |
| 8   | Hierarquia plana de texto | rótulos, apoio e links em tamanhos quase iguais (15 a 17)                                                  | o olho não encontra o ponto de entrada                                            |
| 9   | Eixo quebrado             | marca e título alinhados à esquerda, botões e separador centrados                                          | sem eixo comum, a composição parece montada por camadas                           |
| 10  | Aurora desperdiçada       | o brilho coral some atrás do status e o violeta atrás dos botões                                           | o fundo, que é a identidade, não participa da composição                          |

## 2. Layout: medidas exatas, sem rolar

### 2.1 Tokens usados e propostos

Usados como estão: `RITMO.margemDaTela` (20), `ESPACO.e4/e8/e12/e16/e20/e24/e32/e40`, `ALTURA.controleAlto` (56, botões e campos), `ALTURA.controle` (48, e-mail terciário e "Criar conta"), `ALVO_MINIMO` (44), `RAIO.controle` (14), `BORDA.fina/contraste`, `TIPO.*`, `ELEVACAO.claro.cartao`, `MARCA_DA_APPLE`, `MARCA_DO_GOOGLE`, `AURORA.*`.

Propostos (novo arquivo `packages/tokens/src/acesso.ts`, reexportado em `index.ts`):

| Nome                                               | Valor                                                                                       | Para quê                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `LARGURA_DA_COLUNA_DE_ACESSO` (em `constantes.ts`) | 400                                                                                         | coluna única na web e em tablet             |
| `RITMO_DE_ACESSO.solParaTitulo`                    | 16 (sol de 88 e 96), 20 (sol de 112)                                                        | marca e nome                                |
| `RITMO_DE_ACESSO.tituloParaApoio`                  | `ESPACO.e8`                                                                                 | nome e frase                                |
| `RITMO_DE_ACESSO.apoioParaConvite`                 | `ESPACO.e16`                                                                                | cartão do convite                           |
| `RITMO_DE_ACESSO.seloParaBotao`                    | `ESPACO.e8`                                                                                 | "Usado da última vez"                       |
| `RITMO_DE_ACESSO.entreAcessos`                     | `ESPACO.e12`                                                                                | entre botões                                |
| `RITMO_DE_ACESSO.acessosParaRodape`                | `ESPACO.e20`                                                                                | salto de grupo                              |
| `RITMO_DE_ACESSO.respiroMinimo`                    | `ESPACO.e16`                                                                                | entre palco e acessos, nunca menos          |
| `RITMO_DE_ACESSO.fatorDoRespiroDeCima`             | 0,4 (arredondado para baixo a múltiplo de 8)                                                | distribui a sobra: 40% em cima, 60% embaixo |
| `RITMO_DE_ACESSO.fendaDeErro`                      | 26 (6 mais 20)                                                                              | linha de apoio do campo, sempre reservada   |
| `LADO_DO_SOL`                                      | 88, 96, 112 (e 72, 56 em fonte grande)                                                      | tamanho da marca                            |
| `MARCA_DO_GOOGLE_ESCURO`                           | fundo `#131314`, texto `#E3E3E3`, borda `#8E918F` (1 pt, por dentro), pressionado `#262627` | tema "Dark" oficial do botão do Google      |
| `MARCA_DO_SOL`                                     | ver 2.6                                                                                     | cores do sol por tema                       |
| `MOVIMENTO_DE_ACESSO`                              | ver seção 7                                                                                 | durações, atrasos, curvas, molas            |
| `AURORA.deriva`                                    | ver seção 6                                                                                 | amplitudes e períodos                       |

`ALTURA.controleAlto` (56) é o valor de todos os botões e campos da entrada. O UX sugere 52 nos acessos; 56 foi mantido porque a sobra é grande (125 pt no SE em `entrada.inicio`) e porque o campo e o botão que o seguem ficam na mesma altura. Se o UX preferir 52, muda uma constante e as somas abaixo diminuem 4 por botão.

### 2.2 Estrutura (as duas camadas)

A tela tem **duas camadas de geometria fixa**, nunca uma que muda de tamanho:

- **Camada A (`entrada.inicio`):** palco (sol, nome, apoio) centrado na sobra, e acessos presos embaixo.
- **Camada B (`entrada.email`):** painel ancorado no topo, absoluto, sobre a camada A.

Trocar de estado é cross-fade entre as camadas (seção 7.5). Nada muda de altura durante a troca, então não há salto de layout. O painel B é ancorado no topo e termina acima do teclado, por isso **o teclado não empurra nada** (a `Tela` ganha a prop `ajustarAoTeclado={false}` para desligar o `KeyboardAvoidingView` nesta tela; ver seção 8).

Margens: 20 de cada lado (`RITMO.margemDaTela`). Largura da coluna: 335 (375), 353 (393), 320 (360), 400 (web). Eixo único: tudo centrado no meio da coluna (marca, nome, apoio, selo e rodapé), botões e campos ocupam a largura toda.

Distribuição do espaço em `entrada.inicio`:

```
sobra = alturaDaJanela - areaSeguraDeCima - alturaDosAcessos - alturaDoPalco
respiroDeCima  = floor(sobra * 0,4 / 8) * 8
respiroDeBaixo = sobra - respiroDeCima      (nunca menor que 16)
```

Escada de ajuste quando `sobra < 16`: (1) sol de 88 vai a 72; (2) apoio some (o nome fica); (3) liga a rolagem. O sol cresce quando sobra espaço: com o palco de sol 88, `sobra >= 176` usa 112; `sobra >= 136` usa 96; senão 88.

### 2.3 `entrada.inicio` em 4 tamanhos

Altura dos acessos (de cima para baixo): selo 18 + 8, botão 56, 12, botão 56, 12, e-mail 48, 20, rodapé 1 de 48, rodapé 2 de 44, base de 12 mais a área segura de baixo. Sem Apple (Android e web) são 2 botões.

| Medida                              | iPhone SE 375x667     | iPhone 15/16 393x852  | Android 360x800 | Web larga 1280x800  |
| ----------------------------------- | --------------------- | --------------------- | --------------- | ------------------- |
| Área segura (cima/baixo)            | 20 / 0                | 59 / 34               | 24 / 24         | 0 / 0               |
| Coluna                              | 335                   | 353                   | 320             | 400                 |
| Botões                              | Apple, Google, e-mail | Apple, Google, e-mail | Google, e-mail  | Google, e-mail      |
| Altura dos acessos                  | 334                   | 368                   | 298             | 262                 |
| Palco: sol / nome / apoio           | 88 / 32 / 44          | 112 / 32 / 44         | 112 / 32 / 44   | 112 / 32 / 44       |
| Altura do palco (com os intervalos) | 188                   | 216                   | 216             | 216                 |
| Sobra                               | 125                   | 209                   | 262             | centrado (ver nota) |
| Respiro de cima / de baixo          | 48 / 77               | 80 / 129              | 104 / 158       | 141 / 141           |
| Rola?                               | não                   | não                   | não             | não                 |

Nota da web: o conjunto (palco 216, intervalo de 40, acessos 262 = 518) é centrado na vertical; abaixo de 560 pt de altura da janela a rolagem liga.

Com `entrada.inicio.convite` entra o cartão compacto (56 de altura, mais 16 de intervalo acima): no SE a sobra cai para 53 (respiro 16 / 37); nos outros, de sobra. Com `entrada.inicio.biometria` entra o botão de Face ID (56 mais 12): no SE a sobra cai para 57; se os dois estados se somam no SE, aplica-se a escada (sol 72, depois apoio fora).

**Wireframe, iPhone SE (375x667), `entrada.inicio`, iOS, tema escuro:**

```
y     375 pt
0     +----------------------------------------+
      | barra de status (area segura) 20       |
20    |                                        |
      |            respiro de cima 48          |
68    |             .  \  |  /  .              |
      |              \  \ | /  /               |
      |               (  SOL 88x88 )           |   centro x = 187,5
      |            ===== horizonte =====       |
156   |                                        |
      |            gap 16                      |
172   |             Uni Jovem   (32)           |   tituloTela 28/32
204   |            gap 8                       |
212   |     Agenda, escalas e recados da       |   corpo 15/22, 2 linhas
      |     sua comunidade, num lugar so.      |
256   |                                        |
      |            respiro de baixo 77         |
333   |  [v] Usado da ultima vez        (18)   |   legenda, alinhado a esquerda
351   |                gap 8                   |
359   | +------------------------------------+ |
      | |   [logo]  Continuar com a Apple    | |   56, Apple (solido)
415   | +------------------------------------+ |
      |                gap 12                  |
427   | +------------------------------------+ |
      | |   [G]  Continuar com o Google      | |   56, Google (contorno escuro)
483   | +------------------------------------+ |
      |                gap 12                  |
495   |    [envelope]  Entrar com e-mail  (48) |   terciario, so texto
543   |                gap 20                  |
563   |    Primeira vez aqui?  Criar conta (48)|
611   |    Tenho um convite ou codigo     (44) |
655   |                pad 12                  |
667   +----------------------------------------+
        x: 20 margem | 335 coluna | 20 margem
```

**Wireframe, iPhone 15/16 (393x852):** mesma pilha; as coordenadas mudam.

```
y
0     +----------------------------------------+
59    | area segura 59                         |
      |           respiro de cima 80           |
139   |             SOL 112x112                |
251   |            gap 20                      |
271   |             Uni Jovem (32)             |
303   |            gap 8                       |
311   |     apoio (2 linhas, 44)               |
355   |                                        |
      |           respiro de baixo 129         |
484   |  selo (18) / gap 8                     |
510   | [ Continuar com a Apple          56 ]  |
566   |  gap 12                                |
578   | [ Continuar com o Google         56 ]  |
634   |  gap 12                                |
646   |   Entrar com e-mail (48)               |
694   |  gap 20                                |
714   |   Primeira vez aqui? Criar conta (48)  |
762   |   Tenho um convite ou codigo (44)      |
806   |  pad 46 (34 de area segura mais 12)    |
852   +----------------------------------------+
```

**Android 360x800 (so Google e e-mail):** selo 502..520; Google 528..584; e-mail (secundario, contorno, 56) 596..652; rodape 1 em 672..720; rodape 2 em 720..764; base 36. Sol 128..240, nome 260..292, apoio 300..344.

**Web 1280x800 (coluna de 400):** sol 141..253; nome 273..305; apoio 313..357; intervalo de 40; selo 397..415; Google 423..479; e-mail 491..547; rodape 1 em 567..615; rodape 2 em 615..659. Aurora de largura toda (a geometria atual de `AURORA` usa quadro de 390; em janela larga o brilho coral fica no canto superior direito da janela, e o violeta à esquerda).

### 2.4 `entrada.email`

Painel ancorado no topo. Composição, de cima para baixo: padding de 8 depois da área segura; linha de voltar de 44 ("Outras formas de entrar", texto do UX, com chevron e o sol mini de 32 à direita); título "Entrar com e-mail" (`tituloTela`, 32); intervalo; E-mail (rótulo 20, intervalo 8, campo 56, fenda de erro 26); Senha (mesma anatomia, com "Esqueci a senha" na linha do rótulo); botão Entrar 56.

Dois ritmos, escolhidos pela altura livre (`alturaLivre = janela - areaSeguraDeCima - teclado`):

- **Confortável:** título para o primeiro campo 24. Usado se sobrarem pelo menos 16 pt depois dele.
- **Compacto:** título para o primeiro campo 12. Usado no SE.

Altura do teclado considerada (conferir no aparelho): 260 no SE, 336 no 15/16 (com a barra de sugestões), 300 no Android.

| Medida                                | SE 375x667 (compacto) | 15/16 393x852 (confortável) | Android 360x800 (confortável) |
| ------------------------------------- | --------------------- | --------------------------- | ----------------------------- |
| Teclado                               | 260                   | 336                         | 300                           |
| Altura livre abaixo da área segura    | 387                   | 457                         | 476                           |
| Início do painel (área segura mais 8) | y = 28                | y = 67                      | y = 32                        |
| Voltar (44)                           | 28..72                | 67..111                     | 32..76                        |
| Título (32)                           | 72..104               | 111..143                    | 76..108                       |
| Intervalo                             | 12                    | 24                          | 24                            |
| E-mail (rótulo 20, 8, campo 56)       | 116..200              | 167..251                    | 132..216                      |
| Fenda de erro 26                      | 200..226              | 251..277                    | 216..242                      |
| Senha (84)                            | 226..310              | 277..361                    | 242..326                      |
| Fenda de erro 26                      | 310..336              | 361..387                    | 326..352                      |
| Entrar (56)                           | 336..392              | 387..443                    | 352..408                      |
| Topo do teclado                       | 407                   | 516                         | 500                           |
| Sobra acima do teclado                | **15**                | **73**                      | **92**                        |

A fenda de erro é reservada sempre: o erro aparece sem empurrar o botão. Ela faz o papel de intervalo entre os grupos (26, só 10 acima do ritmo de 16). Se uma mensagem quebra em 2 linhas, o botão desce 20 e, no SE com o teclado de 260, passa 5 pt do limite: a rolagem de segurança liga só nesse caso. Os textos de erro do UX (5.5) têm de caber em 1 linha de 335 pt; os mais longos (credencial, muitas tentativas) usam o fallback abaixo.

**Fallback de teclado alto:** se o teclado reportado deixa menos de 372 pt livres abaixo da área segura, o título "Entrar com e-mail" some (opacidade 0 em 160 ms) e o painel sobe 32: nunca rola. O nome do painel continua no rótulo acessível do campo e do botão voltar.

**Wireframe, SE com teclado (`entrada.email`, `teclado.aberto`):**

```
y     375 pt
0     +----------------------------------------+
20    | area segura 20 + padding 8             |
28    | < Outras formas de entrar        (sol) |   44, link a esquerda, sol mini 32
72    | Entrar com e-mail                      |   tituloTela 28/32
104   |            gap 12                      |
116   | E-mail                      (20)       |
136   |            gap 8                       |
144   | +------------------------------------+ |
      | | nome@exemplo.com                   | |   campo 56
200   | +------------------------------------+ |
      | (fenda de erro 26)                     |
226   | Senha                 Esqueci a senha  |   rotulo e link na mesma linha
246   |            gap 8                       |
254   | +------------------------------------+ |
      | | ••••••••               (o) Mostrar | |   campo 56
310   | +------------------------------------+ |
      | (fenda de erro 26)                     |
336   | +------------------------------------+ |
      | |              Entrar                | |   56, coral solido
392   | +------------------------------------+ |
      |            sobra 15                    |
407   +================ teclado (260) =========+
667   +----------------------------------------+
```

### 2.5 Largura, paisagem e tela grande

- **Web e tablet:** coluna de 400, conteúdo centrado na vertical, sem cartão. Em janela de 900 ou mais, o UX permite uma faixa de marca ao lado; o sol passa a 128 nesse caso (fora do escopo desta revisão).
- **Paisagem no celular, altura menor que 500:** sol de 56 à esquerda, ações à direita (2 colunas de 50%), rolagem de segurança ligada.
- **Fonte grande (`fonte.grande`):** até 1,2 igual ao padrão; de 1,2 a 1,6 o sol vai a 56, o apoio some e continua sem rolar (sobram 60 pt no SE); acima de 1,6 liga a rolagem, com a ordem de leitura intacta.

### 2.6 O sol (marca)

A marca nova é o sol do ícone, **sem o quadrado do app**, redesenhado em SVG (`react-native-svg` já existe) em peças separadas para poder animar: semicírculo, 5 raios, 2 barras de horizonte e um halo. Coordenadas no quadro de 1024 do `icon.png` (aproximadas da imagem; conferir contra a arte original):

| Peça      | Geometria (viewBox 1024)                                                                                           | Cor no escuro                               | Cor no claro                            |
| --------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | --------------------------------------- |
| Corpo     | semicírculo de raio 205, centro (512, 634), base reta                                                              | degradê `#FFD166` (topo) a `#FF8A65` (base) | degradê `#E8890C` a `#C2491F`           |
| Raios (5) | cápsulas de espessura 34, de 75 de comprimento: ângulos 150, 120, 90, 60, 30 graus, a 230 a 330 do centro do corpo | `#FFD166`                                   | `#B86E00` (3,7 contra o fundo claro)    |
| Barra 1   | cápsula 574x38 em y 665                                                                                            | `#FFEBDD`                                   | `#8A2E12` (`destaque`)                  |
| Barra 2   | cápsula 348x37 em y 754                                                                                            | `#FFEBDD` a 70%                             | `#8A2E12` a 60%                         |
| Halo      | círculo 2,4 vezes o lado do sol, `radial-gradient`                                                                 | `rgba(255,138,101,0.35)` a transparente     | `rgba(255,138,101,0.25)` a transparente |

O sol é decorativo (`aria-hidden`): o nome do app em texto faz o papel de título. A marca é logotipo e fica fora das regras de contraste da WCAG 1.4.11, mas o claro foi acertado para não sumir sobre `#F7F5FF`. Lado: 88, 96 ou 112 (2.2); no painel de e-mail, mini de 32 à direita da linha de voltar.

## 3. Sistema de botões de acesso

### 3.1 Hierarquia (alinhada ao UX, seção 4)

Três níveis visuais, todos **diferentes entre si em preenchimento, borda e peso de texto**. O coral de fundo cheio fica só no "avançar" do painel de e-mail.

| Nível                              | Aparência                               | iOS                                                                                                                                    | Android e web                                                               |
| ---------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Primário (um só sólido por estado) | cor chapada oficial da marca            | Apple: branca no escuro, preta no claro                                                                                                | Google: branco com contorno (tema "Light" da marca), nos dois temas         |
| Secundário                         | contorno                                | Google: tema "Dark" no escuro (`#131314`, contorno `#8E918F`), tema "Light" no claro (branco, contorno `#747775`)                      | E-mail: transparente, contorno `contorno`, texto `texto`, ícone de envelope |
| Terciário                          | só texto com ícone, sem fundo nem borda | E-mail: texto `texto` 600, ícone de envelope, 48 de altura                                                                             | (não há)                                                                    |
| Rodapé                             | texto                                   | "Primeira vez aqui?" em `textoSuave` mais "Criar conta" em `destaque` 600; "Tenho um convite ou código" em `textoSuave` com sublinhado | igual                                                                       |
| Avançar do painel de e-mail        | coral sólido (`primaria`)               | Entrar                                                                                                                                 | Entrar                                                                      |

Por que Apple primeiro e sólida: a Apple pede que o botão dela não seja menor que o dos outros provedores e não force rolagem; ela só aceita branco, branco com contorno ou preto. Por que o Google em contorno: a marca do Google permite o tema escuro, e ele deixa de ser "outra laje branca". Por que o e-mail no iOS é só texto: é o caminho de mais passos (UX 4).

Regras de ordem (UX 4): o método usado da última vez sobe ao primeiro lugar e ganha o selo "Usado da última vez" (`legenda` 13/18, 500, `textoSuave`, ícone de relógio de 14, à esquerda, 8 acima do botão). Se o método subir for o e-mail, ele assume o desenho de primário coral sólido. Se houver Face ID (`entrada.inicio.biometria`), "Entrar com Face ID" ocupa o primeiro lugar em coral sólido (é o "avançar" de quem volta); os provedores seguem abaixo nos desenhos normais. Esse é o único estado em que a Apple branca convive com um coral sólido, é raro e dispara o Face ID sozinho; conferir em protótipo antes de fixar.

### 3.2 Regras da marca

**Apple** (HIG e "Creating a custom Sign in with Apple button"):

- Só as cores oficiais: fundo `#FFFFFF` e texto e logotipo `#000000` (escuro); fundo `#000000` e texto `#FFFFFF` (claro). Nada de vidro, tom ou gradiente.
- Logotipo `LogoDaApple` (viewBox 24x24) em 20 pt de altura, sem deformar, cor igual à do texto, 8 pt até o texto, conteúdo centrado.
- Rótulo "Continuar com a Apple" (português do Brasil, formato "Continuar com"). O botão é desenhado aqui, e não o nativo, porque o nativo escreve em inglês; a decisão já está comentada em `BotaoApple.tsx`. O pedido continua sendo o nativo.
- Mesma largura e altura do Google; vem primeiro; cabe sem rolar (por isso a tela inteira cabe no SE).
- A busca feita para este documento não confirmou números exatos de proporção do logotipo; antes de fixar, conferir no gerador oficial `appleid.apple.com/signinwithapple/button`.

**Google** (diretriz "Sign in with Google"):

- "G" oficial colorido (`LogoDoGoogle`, viewBox 48), 20 pt, sem recolorir.
- Tema "Dark": fundo `#131314`, contorno `#8E918F` de 1 pt por dentro, texto `#E3E3E3`. Tema "Light": fundo `#FFFFFF`, contorno `#747775`, texto `#1F1F1F` (já em `MARCA_DO_GOOGLE`).
- Rótulo "Continuar com o Google". A diretriz lista Google Sans 14/20; aqui o texto é Inter 600 15/20 como os outros botões (a marca exige o "G" e as cores, não a fonte, mas confirmar em `developers.google.com/identity/branding-guidelines`).
- O botão do Google na web (`BotaoGoogle.web.tsx`) tem margem de estilo menor; o time de UI confere se o desenho pode ser o mesmo.

### 3.3 Estados

Tabela por botão. Todos: raio `RAIO.controle` (14), altura 56 (e-mail terciário 48), texto `TIPO.botao` (15/20, 600), alvo de toque total do botão. A camada de pressionado é uma `View` absoluta que muda só de `opacity` (seção 7.7).

| Estado                                                 | Apple                                                                                                           | Google                                                                                                          | E-mail (contorno e texto)            | Entrar (coral)                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| Repouso, escuro                                        | fundo `#FFFFFF`, texto e logo `#000000`                                                                         | fundo `#131314`, borda 1 `#8E918F`, texto `#E3E3E3`                                                             | contorno 1 `contorno`, texto `texto` | fundo `primaria`, texto `sobrePrimaria`                              |
| Repouso, claro                                         | fundo `#000000`, texto e logo `#FFFFFF`                                                                         | fundo `#FFFFFF`, borda 1 `#747775`, texto `#1F1F1F`, sombra `ELEVACAO.claro.cartao`                             | contorno 1 `contorno`, texto `texto` | fundo `primaria`, texto `sobrePrimaria`                              |
| Pressionado                                            | camada `rgba(0,0,0,0.10)` (escuro, dá `#E6E6E6`) ou `rgba(255,255,255,0.16)` (claro, dá `#2A2A2A`); escala 0,98 | camada `rgba(255,255,255,0.08)` (escuro, dá `#262627`) ou `rgba(0,0,0,0.05)` (claro, dá `#F2F2F2`); escala 0,98 | camada `pressionado`                 | camada `primariaPressionada`                                         |
| Foco (anel)                                            | anel 2 `foco`, afastado 2, raio 16                                                                              | igual                                                                                                           | igual                                | igual                                                                |
| Carregando (`carregando.provedor`, `carregando.senha`) | logo vira indicador de 18 pt (cor do texto); rótulo fica; largura travada                                       | igual                                                                                                           | indicador de 18 à esquerda           | indicador de 18, rótulo "Entrando..."                                |
| Desabilitado (outra ação em curso)                     | todo o botão a 60% de `opacity`, `aria-disabled`, rótulo legível                                                | igual                                                                                                           | igual                                | igual                                                                |
| Erro                                                   | sem estado próprio: o botão tocado balança 4 pt e o erro aparece no lugar do apoio (7.8)                        | idem                                                                                                            | idem                                 | o erro vai à fenda do campo de senha (7.8); o botão volta ao repouso |

Com `contraste.alto`: borda de 2 pt em `texto` (como já faz `BotaoDeAcessoRapido`), aurora desligada. Com `transparencia.reduzida`: nada muda nos botões (todos já são opacos); o cartão do convite usa `superficie`.

Indicador: o do sistema (`ActivityIndicator` de 18, `size={18}` no Android e `small` no iOS). Só aparece depois de 250 ms de espera (UX 6): resposta rápida não pisca. Nada de círculo grande.

### 3.4 Contraste (texto/fundo e componentes), dois temas

Mínimo: 4,5:1 para texto, 3:1 para texto grande e componentes. "Fundo" é `fundo` (`#12102A` escuro, `#F7F5FF` claro). Os valores marcados com (doc) vêm da tabela 2.11 da especificação; os demais foram calculados aqui.

| Par                                                                   | Escuro                                     | Claro                        | Mín. |
| --------------------------------------------------------------------- | ------------------------------------------ | ---------------------------- | ---- |
| Nome: `texto` sobre fundo                                             | 16,9 (doc)                                 | 15,8 (doc)                   | 4,5  |
| Apoio e rodapé: `textoSuave` sobre fundo                              | 11,3 (doc)                                 | 8,1 (doc)                    | 4,5  |
| Apoio sobre o pico do violeta da aurora                               | 5,7                                        | não se aplica (aurora a 22%) | 4,5  |
| Link "Criar conta": `destaque` sobre fundo                            | 10,6 (doc)                                 | 7,9 (doc)                    | 4,5  |
| Selo "Usado da última vez": `textoSuave` sobre fundo                  | 11,3                                       | 8,1                          | 4,5  |
| Apple: `#000000` sobre `#FFFFFF`                                      | 21,0                                       | 21,0 (inverso)               | 4,5  |
| Apple pressionado: texto sobre `#E6E6E6` (escuro) e `#2A2A2A` (claro) | 16,8                                       | 14,3                         | 4,5  |
| Apple: fundo do botão contra fundo da tela                            | 18,5                                       | 19,5                         | 3    |
| Google escuro: `#E3E3E3` sobre `#131314`                              | 14,5                                       | não se aplica                | 4,5  |
| Google escuro: contorno `#8E918F` contra fundo                        | 5,8                                        | não se aplica                | 3    |
| Google escuro pressionado: texto sobre `#262627`                      | 11,8                                       | não se aplica                | 4,5  |
| Google claro: `#1F1F1F` sobre `#FFFFFF`                               | 16,5 (quando é primário no Android escuro) | 16,5                         | 4,5  |
| Google claro: contorno `#747775` contra fundo claro                   | não se aplica                              | 4,2                          | 3    |
| Google claro como primário no escuro: fundo `#FFFFFF` contra fundo    | 18,5                                       | não se aplica                | 3    |
| E-mail terciário e secundário: `texto` sobre fundo                    | 16,9                                       | 15,8                         | 4,5  |
| E-mail secundário: `contorno` contra fundo                            | 3,3 (doc)                                  | 3,4 (doc)                    | 3    |
| Entrar: `sobrePrimaria` sobre `primaria`                              | 8,1 (doc)                                  | 4,9 (doc)                    | 4,5  |
| Entrar pressionado: sobre `primariaPressionada`                       | 6,6 (doc)                                  | 6,2 (doc)                    | 4,5  |
| Entrar: `primaria` contra fundo                                       | 8,0 (doc)                                  | 4,6 (doc)                    | 3    |
| Anel de foco: `foco` contra fundo                                     | 12,9 (doc)                                 | 6,9 (doc)                    | 3    |
| Anel de foco: `foco` contra `campoFundo`                              | 11,9                                       | 7,5 (doc)                    | 3    |
| Campo: texto digitado `texto` sobre `campoFundo`                      | 15,7 (doc)                                 | 17,0 (doc)                   | 4,5  |
| Campo: exemplo e "Mostrar" `textoSuave` sobre `campoFundo`            | 10,4 (doc)                                 | 8,7 (doc)                    | 4,5  |
| Campo: borda `campoBorda` contra `campoFundo`                         | 3,7 (doc)                                  | 3,7 (doc)                    | 3    |
| Campo: borda `campoBorda` contra fundo da tela                        | 4,0                                        | 3,4                          | 3    |
| Rótulo do campo: `textoSuave` sobre fundo                             | 11,3                                       | 8,1                          | 4,5  |
| Erro: texto `texto` sobre fundo (nunca `erro`, ver nota)              | 16,9                                       | 15,8                         | 4,5  |
| Erro: ícone e borda `erro` contra fundo                               | 8,2                                        | 6,1                          | 3    |
| Texto de erro em `erro` sobre o pico do violeta (por isso não se usa) | 4,2 (reprova)                              | não se aplica                | 4,5  |
| Link "Esqueci a senha" e voltar: `destaque` sobre fundo               | 10,6                                       | 7,9                          | 4,5  |
| Botão voltar (ícone `texto` sobre `tonal` composto)                   | 13,9 (doc)                                 | 14,3 (doc)                   | 3    |
| Cartão do convite: `texto` sobre `superficie`                         | 14,2 (doc)                                 | 17,0 (doc)                   | 4,5  |
| Indicador no Entrar: `sobrePrimaria` sobre `primaria`                 | 8,1                                        | 4,9                          | 3    |

Notas:

1. **Erro em `texto`, ícone em `erro`.** É a regra que o projeto já adotou em `BlocoDoCampo` para texto sobre a aurora: sobre o pico do violeta (`rgba(124,108,255,0.45)` sobre `#12102A`, que compõe `#423A8A`) o `erro` dá 4,2 e reprova. O ícone mais o texto garantem que a cor não é o único sinal.
2. **Coral dentro da aurora.** `textoSuave` sobre o pico do brilho coral (`#94534A`) dá 3,5 e reprova; por isso nenhum `textoSuave` fica a menos de 150 pt do centro coral (canto superior direito). Na composição, só o sol mini decorativo mora ali.
3. **A deriva nunca piora o contraste.** O contraste foi medido no pico (alfa máximo), que é o pior caso em qualquer posição do brilho; a deriva só afasta o coral do cabeçalho.
4. **Desabilitado** é isento (WCAG 1.4.3). O texto continua legível a 60% por escolha do UX.

## 4. Tipografia

Todos os papéis vêm de `TIPO`. Nenhum tamanho novo. Escala dinâmica do sistema respeitada (`allowFontScaling` nunca desligado); o teto vem do papel ou é definido por texto, e a tela promete "sem rolar" até 1,2 (seção 2.5).

| Texto                                   | Papel                  | Família, peso | Tamanho / altura | Espaç. entre letras | Cor                              | Teto | Observação                                                                 |
| --------------------------------------- | ---------------------- | ------------- | ---------------- | ------------------- | -------------------------------- | ---- | -------------------------------------------------------------------------- |
| Nome do app (`entrada.inicio`)          | `tituloTela`           | Bricolage 800 | 28 / 32          | -0,3                | `texto`                          | 1,8  | cabeçalho nível 1; recebe o foco ao abrir; centrado                        |
| Título do painel ("Entrar com e-mail")  | `tituloTela`           | Bricolage 800 | 28 / 32          | -0,3                | `texto`                          | 1,8  | alinhado à esquerda; até 2 linhas se a fonte for grande                    |
| Apoio                                   | `corpo`                | Inter 400     | 15 / 22          | 0                   | `textoSuave`                     | 1,5  | centrado, até 2 linhas (3 a 1,2); some a partir de 1,2 em `entrada.inicio` |
| Selo "Usado da última vez"              | `legenda` com peso 500 | Inter 500     | 13 / 18          | 0                   | `textoSuave`                     | 1,6  | com ícone de 14, à esquerda                                                |
| Rótulo de botão                         | `botao`                | Inter 600     | 15 / 20          | 0                   | por variante                     | 2,0  | pode ir a 3 linhas; o botão cresce em altura (`minHeight`), nunca corta    |
| Rodapé 1 (frase)                        | `meta`                 | Inter 400     | 15 / 20          | 0                   | `textoSuave`                     | 1,5  | na mesma linha que o link; empilha se não couber                           |
| Rodapé 1 (link "Criar conta")           | `botao`                | Inter 600     | 15 / 20          | 0                   | `destaque`                       | 2,0  | alvo de 48 de altura                                                       |
| Rodapé 2 ("Tenho um convite ou código") | `meta`                 | Inter 400     | 15 / 20          | 0                   | `textoSuave`                     | 1,5  | sublinhado (não depende de cor); alvo de 44                                |
| Voltar ("Outras formas de entrar")      | `botao`                | Inter 600     | 15 / 20          | 0                   | `destaque`                       | 2,0  | chevron de 18 à esquerda                                                   |
| Rótulo do campo                         | `rotulo`               | Inter 600     | 15 / 20          | 0                   | `textoSuave`                     | 1,6  | sempre visível; 8 acima do campo                                           |
| Texto digitado e exemplo                | (do `Campo`)           | Inter 400     | 16 / 22          | 0                   | `texto`, exemplo em `textoSuave` | 1,5  | 16 evita o zoom do Safari                                                  |
| "Esqueci a senha"                       | `botao`                | Inter 600     | 15 / 20          | 0                   | `destaque`                       | 1,6  | na linha do rótulo, à direita; alvo de 44 com `hitSlop` de 12              |
| "Mostrar" / "Ocultar"                   | `botao`                | Inter 600     | 15 / 20          | 0                   | `textoSuave`                     | 1,4  | texto mais ícone de 18 dentro do campo; rótulo acessível "Mostrar senha"   |
| Erro de campo                           | `meta` com peso 600    | Inter 600     | 15 / 20          | 0                   | `texto`, ícone `erro` de 16      | 1,6  | 6 abaixo do campo; fenda de 26                                             |
| Erro de provedor (vira o apoio)         | `meta` com peso 600    | Inter 600     | 15 / 20          | 0                   | `texto`, ícone `erro`            | 1,5  | centrado, mesma caixa do apoio (44)                                        |
| Cartão do convite, título               | `tituloItem`           | Inter 600     | 16 / 22          | 0                   | `texto`                          | 1,5  | "Você foi convidado"                                                       |
| Cartão do convite, linha                | `legenda`              | Inter 400     | 13 / 18          | 0                   | `textoSuave`                     | 1,5  | "para {comunidade}"                                                        |

Regras para fonte grande: botões e campos usam `minHeight`, não `height`; nenhum texto tem `numberOfLines` fixo em 1; "Mostrar" e "Esqueci a senha" não encurtam, quebram a linha do rótulo (a linha vira coluna acima de 1,35).

## 5. Campos

**Escolha: rótulo fixo acima do campo** (o que o `Campo` já faz), com 8 pt de intervalo. Rótulo flutuante foi descartado por 5 razões:

1. A decisão U-09 do projeto fixou o rótulo em 15 pt porque quem tem 40 a 70 anos lia mal em 13. O rótulo flutuante, ao subir, fica em 12 a 13.
2. O preenchimento automático (iCloud Keychain, Google, gerenciadores) escreve no campo sem passar pelo foco: o rótulo flutuante não sobe e fica em cima do texto.
3. Com fonte grande o rótulo flutuante quebra a altura fixa do campo.
4. O UX exige rótulo ligado ao campo e visível sempre (leitor de tela e teste com idoso).
5. O ganho vertical do flutuante (28 pt por campo) não é necessário: com campos de 56 a tela já cabe no SE com 15 pt de sobra, e o fallback do 2.4 cobre o teclado alto.

Anatomia (altura do bloco: rótulo 20, 8, campo 56, fenda 26 = 110):

| Elemento                                  | Medida e valor                                                                                                                                                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Altura                                    | 56 (`ALTURA.controleAlto`)                                                                                                                                                                                                                                                                                   |
| Raio                                      | 14 (`RAIO.controle`)                                                                                                                                                                                                                                                                                         |
| Fundo                                     | `campoFundo`                                                                                                                                                                                                                                                                                                 |
| Borda repouso                             | 1, `campoBorda` (3,7:1 contra o campo; 4,0 e 3,4 contra o fundo)                                                                                                                                                                                                                                             |
| Padding horizontal                        | 16                                                                                                                                                                                                                                                                                                           |
| Texto                                     | Inter 400, 16/22, `texto`                                                                                                                                                                                                                                                                                    |
| Exemplo                                   | só no e-mail ("nome@exemplo.com", `textoSuave`); a senha não tem exemplo                                                                                                                                                                                                                                     |
| Foco                                      | anel de 2 em `foco`, desenhado por uma camada `View` absoluta (borda de 2, raio 14) que sobe de `opacity` 0 a 1 em 140 ms; a borda de 1 do repouso continua por baixo, então o texto não se desloca                                                                                                          |
| Erro                                      | camada irmã com borda de 2 em `erro`, mesma técnica; mais ícone `erroDeCampo` de 16 e o texto (`texto`, `meta` 600) na fenda de 26; o campo ganha `aria-invalid` e `accessibilityHint` "Erro: ..."                                                                                                           |
| Desabilitado (durante `carregando.senha`) | só leitura, sem mudar a cor (o estado do botão já diz que está enviando)                                                                                                                                                                                                                                     |
| Mostrar senha                             | ação à direita dentro da caixa: ícone de olho de 18 mais o texto "Mostrar" ou "Ocultar" (15/20, 600, `textoSuave`), alvo de 44 de altura por cerca de 96 de largura, a 6 pt da borda direita; o texto digitado termina 104 antes da borda direita. A troca de ícone e texto é instantânea (nenhum movimento) |
| Apoio                                     | e-mail e senha não têm texto de ajuda na entrada; a fenda de 26 só mostra erro                                                                                                                                                                                                                               |

Preenchimento automático:

- E-mail: `autoComplete="username"`, `textContentType="username"`, `inputMode="email"`, `autoCapitalize="none"`, `autoCorrect={false}`, `spellCheck={false}`, `importantForAutofill="yes"`, `returnKeyType="next"`; na web `name="username"` e `autocomplete="username"`.
- Senha: `autoComplete="current-password"`, `textContentType="password"`, `returnKeyType="go"`, na web `autocomplete="current-password"`.
- Os dois campos ficam no mesmo painel, e na web dentro de um `<form>` real (arquivo `.web.tsx`) para o gerenciador de senhas oferecer salvar o par. O foco vai ao e-mail 280 ms depois de abrir o painel (fim da transição), com `ref.focus()`, não com `autoFocus`.
- Depois de preencher pelo sistema, o botão não envia sozinho.
- Web: o preenchimento do Chrome pinta o campo de azul claro (`:-webkit-autofill`); neutralizar em `EstilosDaWeb.web.tsx` com o truque de `box-shadow: inset` na cor `campoFundo` e `-webkit-text-fill-color` na cor `texto`.

## 6. Fundo: a aurora que respira

Hoje `FundoAurora` desenha duas `View` com `backgroundImage` radial (nativo) e dois `div` com `background` (web, em `FundoAurora.web.tsx`). Proposta: só na tela de acesso (prop `movimento="ambiente"`), as duas camadas ganham um movimento quase imperceptível. O resto do app continua estático.

| Camada                | Deriva (ida e volta)                                   | Período completo                  | Opacidade                 | Duração máxima         |
| --------------------- | ------------------------------------------------------ | --------------------------------- | ------------------------- | ---------------------- |
| Coral (nascer do sol) | translateX 0 a -14, translateY 0 a +12, scale 1 a 1,06 | 28 s (14 s de ida, 14 s de volta) | multiplicador de 1 a 0,9  | 6 meias-voltas = 84 s  |
| Violeta (noite)       | translateX 0 a +16, translateY 0 a -10, scale 1 a 1,05 | 36 s (18 s de ida, 18 s de volta) | multiplicador de 1 a 0,92 | 6 meias-voltas = 108 s |

- **Curva:** `Easing.inOut(Easing.sin)`. Períodos de 28 e 36 s não se alinham, então a composição nunca repete de forma perceptível.
- **Só se afasta do ponto medido.** A posição de repouso (fase 0) é a geometria já medida em `AURORA`; a deriva leva o coral para baixo e para a esquerda (longe do cabeçalho) e a opacidade nunca passa de 1, então a deriva só pode igualar ou melhorar os contrastes da seção 3.4.
- **Duas camadas aninhadas por brilho:** a externa faz a abertura (opacity 0,55 a 1 e scale 0,94 a 1 em 800 ms, "o sol esquentando"); a interna faz a deriva. Assim os dois movimentos não competem na mesma propriedade.
- **Por que `transform` e `opacity`:** os dois degradês são bitmaps rasterizados uma vez; mover um bitmap é o trabalho mais barato do compositor. Nenhum `setState` ocorre durante a deriva (os valores vivem no thread de UI). Se medir quadro perdido no aparelho médio, ligar `renderToHardwareTextureAndroid` e `shouldRasterizeIOS` nas duas camadas.
- **Para por conta própria:** ao fim das meias-voltas (a fase termina em 0, o repouso), com o aplicativo em segundo plano (`AppState`), com a tela fora de foco (`useIsFocused`), e quando o painel de e-mail está aberto com o teclado (economiza bateria enquanto a pessoa digita).
- **Reduzir movimento (`movimento.reduzido`):** sem deriva e sem abertura; a aurora fica estática na posição de repouso, como hoje.
- **Aumentar contraste (`contraste.alto`):** a aurora já some (regra atual), então a deriva some junto.
- **Reduzir transparência (`transparencia.reduzida`):** a aurora é fundo, não superfície translúcida; fica e a deriva continua. O que perde transparência é o cartão do convite (usa `superficie`).
- **Web:** `FundoAurora.web.tsx` usa `div` com CSS. A deriva na web deve ser `@keyframes` CSS (`transform` e `opacity`, `animation: ... 28s ease-in-out 6 alternate`), em `EstilosDaWeb.web.tsx`, com `@media (prefers-reduced-motion: reduce) { animation: none }` (o arquivo já tem esse bloco). Roda no compositor, sem JavaScript.
- **Meta de custo:** em aparelho médio (iPhone SE de 2ª geração; Android com 4 GB de RAM), deriva ligada com quadros perdidos abaixo de 3% em 90 s, medidos com Instruments (iOS) e `adb shell dumpsys gfxinfo` (Android). Se passar, reduzir a amplitude pela metade e testar de novo, antes de cortar a deriva.
- **Exceção que precisa de registro.** A especificação 2.9 diz "não há animação decorativa contínua". A deriva é exceção, limitada à tela de acesso e a 84 e 108 s por abertura. Registrar em `docs/DECISOES.md` quando o dono aprovar; sem aprovação, o resto do documento vale sem a deriva.

## 7. Coreografia de movimento

### 7.1 Constantes (proposta para `MOVIMENTO_DE_ACESSO` em `packages/tokens/src/acesso.ts`)

```ts
export const CURVAS_DE_ACESSO = {
  saida: [0.22, 1, 0.36, 1], // entradas e revelações: sobe rápido, assenta devagar
  padrao: [0.4, 0, 0.2, 1], // trocas de painel, simétricas
  saidaDeTela: [0.4, 0, 1, 1], // o que sai: começa devagar, termina rápido
} as const

export const MOLAS_DE_ACESSO = {
  toque: { damping: 18, stiffness: 320, mass: 0.6 }, // volta de 0,98 a 1 (amortecimento 0,65)
  check: { damping: 12, stiffness: 260, mass: 0.7 }, // o check do sucesso (overshoot de cerca de 8%)
} as const
```

Valores de bezier são os de `cubic-bezier(x1, y1, x2, y2)`. Em Reanimated, usar `Easing.bezier(...)` definida no escopo do módulo (não dentro de função); dentro de worklet usar `Easing.bezierFn`. Confirmar na versão 4.7.1.

Regra geral: o movimento só usa `opacity` e `transform` (translate, scale). Mudança de cor (pressionado, foco) é troca de camada com `opacity`.

### 7.2 Entrada da tela (`entrada.inicio`, "abertura completa")

Disparo: montagem da tela na primeira vez da sessão e sem convite pendente. Tudo parte já posicionado no espaço final (nada ocupa lugar em movimento) e a tela é interativa desde o quadro 0 (`pointerEvents` nunca é `none`). Duração total: **780 ms** (o halo da aurora termina em 800 e não bloqueia nada).

| #   | Elemento                                | Propriedade (de para)                                               | Duração  | Atraso                                      | Curva | Reduzir movimento                |
| --- | --------------------------------------- | ------------------------------------------------------------------- | -------- | ------------------------------------------- | ----- | -------------------------------- |
| 1   | Aurora coral (camada externa)           | opacity 0,55 a 1; scale 0,94 a 1                                    | 800      | 0                                           | saida | já no estado final, sem animação |
| 2   | Halo do sol                             | opacity 0 a 1; scale 0,8 a 1                                        | 700      | 60                                          | saida | opacity 0 a 1 em 120, sem scale  |
| 3   | Barra de horizonte 1                    | opacity 0 a 1; scaleX 0,6 a 1                                       | 360      | 0                                           | saida | junto do bloco (item 12)         |
| 4   | Barra de horizonte 2                    | opacity 0 a 1; scaleX 0,6 a 1                                       | 360      | 60                                          | saida | idem                             |
| 5   | Corpo do sol (recortado pelo horizonte) | translateY de 0,2 vezes o lado a 0; opacity 0 a 1 nos primeiros 40% | 560      | 80                                          | saida | idem                             |
| 6   | Raios 1 a 5, em ordem                   | opacity 0 a 1; scale 0,6 a 1                                        | 200 cada | 300 + 40 por raio (300, 340, 380, 420, 460) | saida | idem                             |
| 7   | Nome do app                             | opacity 0 a 1; translateY 12 a 0                                    | 360      | 180                                         | saida | idem                             |
| 8   | Apoio (ou cartão do convite)            | opacity 0 a 1; translateY 12 a 0                                    | 360      | 230                                         | saida | idem                             |
| 9   | Selo mais botão 1                       | opacity 0 a 1; translateY 16 a 0                                    | 320      | 300                                         | saida | idem                             |
| 10  | Botão 2                                 | opacity 0 a 1; translateY 16 a 0                                    | 320      | 350                                         | saida | idem                             |
| 11  | Botão 3 (e-mail)                        | opacity 0 a 1; translateY 16 a 0                                    | 320      | 400                                         | saida | idem                             |
| 12  | Rodapé 1                                | opacity 0 a 1; translateY 8 a 0                                     | 280      | 450                                         | saida | idem                             |
| 13  | Rodapé 2                                | opacity 0 a 1; translateY 8 a 0                                     | 280      | 500                                         | saida | idem                             |

Passos da cascata: 50 ms (7, 8; 9, 10, 11; 12, 13). Último fim: 780 (item 13). Com Reduzir movimento, o bloco todo (itens 3 a 13) faz **um** dissolve de `opacity` 0 a 1 em 120 ms, sem cascata e sem `translate`.

O "nascer": o corpo do sol sobe de trás da linha do horizonte (um contêiner de altura 0,62 vezes o lado, com `overflow: hidden`, corta a parte que ainda está embaixo), os raios acendem depois que ele passa da metade, e a aurora coral esquenta junto. É um movimento só, em 3 camadas.

### 7.3 Entrada curta (retorno, e troca entre Entrar e Criar conta)

Disparo: montagem sem ser a primeira vez da sessão, ou com convite pendente, ou chegada vinda de outra tela de acesso. O sol e a aurora não repetem.

| Elemento                                                       | Propriedade                                                    | Duração | Atraso                | Curva      | Reduzir movimento                                 |
| -------------------------------------------------------------- | -------------------------------------------------------------- | ------- | --------------------- | ---------- | ------------------------------------------------- |
| Conteúdo (nome, apoio, acessos, rodapé), do primeiro ao último | opacity 0 a 1; translateX de +16 (avançar) ou -16 (voltar) a 0 | 260     | 30 por item (0 a 210) | saida      | um dissolve de `opacity` em 120, sem `translateX` |
| Tela que sai (animação do `Stack`)                             | cross-fade nativo                                              | 160     | 0                     | do sistema | igual (já é só dissolve)                          |

Total máximo: 470 ms. A marca não se move nesse caso: Entrar e Criar conta posicionam o sol no mesmo lugar, então a pessoa vê só o conteúdo trocar (deslizar de 16 pt).

### 7.4 Foco no campo

| Evento        | Propriedade                   | Duração | Curva  | Reduzir movimento     |
| ------------- | ----------------------------- | ------- | ------ | --------------------- |
| Foco          | camada do anel: opacity 0 a 1 | 140     | saida  | troca imediata (0 ms) |
| Saída do foco | camada do anel: opacity 1 a 0 | 100     | padrao | troca imediata (0 ms) |

O texto não se desloca (a borda de 1 do repouso continua por baixo). O foco de teclado em botões segue sendo o anel do sistema (`useAnelDeFoco`), sem animação.

### 7.5 Revelar e fechar o painel de e-mail (`entrada.inicio` a `entrada.email`)

Um único valor `fase` (0 = `entrada.inicio`, 1 = `entrada.email`) comanda três estilos. A rota `?modo=email` (UX 3.1) é a fonte de verdade; um efeito põe `fase` em 1 ou 0.

| Elemento                          | Propriedade, pela fase                                                    | Duração   | Curva  |
| --------------------------------- | ------------------------------------------------------------------------- | --------- | ------ |
| Palco (sol, nome, apoio, convite) | opacity 1 a 0 na faixa 0 a 0,5; translateY 0 a -12; scale do sol 1 a 0,92 | 280 total | padrao |
| Camada de acessos (A)             | opacity 1 a 0 na faixa 0 a 0,4; translateY 0 a +12                        | 280 total | padrao |
| Painel de e-mail (B)              | opacity 0 a 1 na faixa 0,45 a 1; translateY +12 a 0                       | 280 total | padrao |
| Sol mini (no painel)              | opacity 0 a 1 na faixa 0,6 a 1                                            | 280 total | padrao |

- **Ida:** 280 ms. **Volta** ("Outras formas de entrar", gesto de voltar): 240 ms, `fase` de 1 a 0 com a mesma curva.
- **Sem salto de layout.** As duas camadas têm geometria fixa e ocupam o lugar delas desde o início; nada muda de altura. O painel é ancorado no topo e o teclado só cobre o que está abaixo dele.
- **Foco:** o foco vai ao campo E-mail quando `fase` chega a 1 (callback no fim da animação, 280 ms), de modo que o teclado do iOS (cerca de 250 ms) sobe com o painel já assentado. Na volta, o foco vai ao botão "Entrar com e-mail" (UX 6) quando `fase` chega a 0.
- **Camada escondida:** assim que o cross-fade passa da metade, a camada que saiu recebe `pointerEvents="none"`, `aria-hidden`, `importantForAccessibility="no-hide-descendants"`; na web, `display: none` no fim da animação (para o Tab pular). Nada de botão invisível focável.
- **Reduzir movimento:** `fase` muda em 120 ms só com `opacity` (sem translate nem scale).
- **Alternativa descartada:** fazer o sol "viajar" do centro para o canto. Exige medir posição, quebra com fonte grande e duplica cálculo; o cross-fade de dois sóis (um grande, um mini) dá o mesmo efeito com menos risco.

### 7.6 Troca do cartão do convite

Entrada: opacity 0 a 1 e translateY 8 a 0, 220 ms, saida, ao voltar da folha. Remoção: opacity 1 a 0 em 160 ms e, ao mesmo tempo, o palco inteiro faz translateY de (delta) a 0 em 220 ms (técnica FLIP, o delta vem da função pura de medidas, 2.2). Reduzir movimento: troca com dissolve de 120 ms.

### 7.7 Pressionar botões

| Evento            | Propriedade                      | Valor                          | Duração / mola                                 | Curva                     |
| ----------------- | -------------------------------- | ------------------------------ | ---------------------------------------------- | ------------------------- |
| Toque dentro      | scale do botão                   | 1 a 0,98                       | 90 ms                                          | `Easing.out(Easing.quad)` |
| Toque dentro      | camada de pressionado: opacity   | 0 a 1                          | 90 ms                                          | `Easing.out(Easing.quad)` |
| Soltar            | scale                            | 0,98 a 1                       | mola `MOLAS_DE_ACESSO.toque` (cerca de 250 ms) | mola                      |
| Soltar            | camada de pressionado: opacity   | 1 a 0                          | 160 ms                                         | padrao                    |
| Reduzir movimento | sem scale; camada de pressionado | 0 a 1 em 80 ms, 1 a 0 em 80 ms |                                                |                           |

Aplica-se aos 4 botões e aos links de rodapé (nestes, só a camada, sem scale). A camada de pressionado é uma `View` absoluta com a cor da seção 3.3 e `opacity` animada: nada de animar cor. No Android mantém-se o `android_ripple`, em vez da camada, se o ripple for preferido (decisão de implementação; ele já existe em `Botao`).

### 7.8 Erro

| Situação                                         | Elemento                                                      | Animação                                                                                                                      | Duração    | Reduzir movimento |
| ------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------- |
| Envio com campo vazio ou inválido (`erro.campo`) | o campo                                                       | balanço: translateX 0, -5 (40 ms), +5 (80 ms), -3 (70 ms), 0 (70 ms); total 260 ms; curva `Easing.out(Easing.quad)` por etapa | 260        | sem balanço       |
| Mesma situação                                   | camada de erro (borda de 2 em `erro`)                         | opacity 0 a 1                                                                                                                 | 140, saida | 120 só dissolve   |
| Mesma situação                                   | linha de erro na fenda de 26                                  | opacity 0 a 1; translateY -4 a 0                                                                                              | 160, saida | 120 só dissolve   |
| Credencial errada (`erro.geral`)                 | o grupo dos dois campos                                       | mesmo balanço de 5 pt                                                                                                         | 260        | sem balanço       |
| Falha de provedor (`erro.provedor`)              | o botão tocado                                                | balanço de 4 pt (0, -4, +4, -2, 0)                                                                                            | 240        | sem balanço       |
| Mesma situação                                   | o apoio vira o erro                                           | cross-fade do texto de apoio para o erro (ícone `erro` mais texto `texto`, centrado)                                          | 160        | 120               |
| `erro.rede`, `erro.tempo`, `sem.internet`        | linha de erro do campo de senha, com o botão "Tentar de novo" | só dissolve                                                                                                                   | 160        | 120               |

- O balanço só acontece **ao enviar**, nunca ao sair do campo (UX 6: erro por campo aparece ao sair do campo, sem movimento).
- **Anúncio para leitor de tela:** `useAnunciar` (já em `Campo` e em `AvisoDeFalha`) com o texto do erro; o balanço é só visual. O foco vai ao primeiro campo com erro.
- A tela nunca bloqueia o toque durante o balanço.

### 7.9 Carregando (`carregando.provedor`, `carregando.senha`)

| Elemento                                    | Animação                                      | Duração | Curva  | Reduzir movimento |
| ------------------------------------------- | --------------------------------------------- | ------- | ------ | ----------------- |
| Indicador de 18 pt no botão tocado          | opacity 0 a 1, depois de 250 ms de espera     | 140     | saida  | igual (é estado)  |
| Logotipo ou ícone que o indicador substitui | opacity 1 a 0                                 | 100     | padrao | troca imediata    |
| Demais botões                               | opacity 1 a 0,6                               | 140     | padrao | igual, 80         |
| Texto do Entrar                             | troca "Entrar" por "Entrando..." (cross-fade) | 120     | padrao | troca imediata    |
| Texto aos 10 s ("Ainda entrando...")        | cross-fade                                    | 160     | padrao | troca imediata    |

O botão trava a largura medida (`minWidth` do `onLayout`, como `Botao` já faz). Nenhum círculo grande, nenhuma barra no topo; `aria-busy` no botão.

### 7.10 Sucesso e saída (`sucesso`)

| Passo                | Animação                                                                                                          | Duração | Reduzir movimento                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------ |
| Indicador vira check | indicador opacity 1 a 0 (100 ms); check scale 0,6 a 1 com `MOLAS_DE_ACESSO.check` mais opacity 0 a 1 (120 ms)     | 200     | check por dissolve de 120, sem scale |
| Sol responde         | halo: scale 1 a 1,12 a 1 e opacity 0,35 a 0,6 a 0,35                                                              | 360     | sem pulso                            |
| Anúncio              | "Você entrou." (uma vez, antes da troca de tela)                                                                  |         | mantido                              |
| Saída para o app     | troca de grupo com animação `fade` do `Stack` (200 ms, nativa); o Início entra com `Aparecer` (200 ms, já existe) | 200     | só dissolve de 120                   |

- **Continuidade do céu:** o Início usa a mesma `FundoAurora` com intensidade 1, na mesma posição, então a aurora não "pisca" na troca. A deriva da entrada para (a fase volta a 0 em 600 ms) quando a sessão abre.
- **A animação nunca atrasa a navegação** (UX 7: no máximo 200 ms). Ponto de integração: o guarda de `(publico)/_layout.tsx` redireciona assim que `estado === 'autenticado'`. Para o check aparecer, o guarda precisa segurar o redirecionamento por 200 ms (um sinalizador `sucessoEmAndamento` no contexto da sessão). Se a equipe preferir não mexer no guarda, o sucesso vira só o anúncio e o fade de 200 ms do `Stack`.
- **Háptico (UX 7):** não há `expo-haptics` no projeto. Opcional, dependência nova do próprio Expo, sem custo: pedir aprovação antes de adicionar. Sem ela, o sucesso fica visual e sonoro (anúncio do leitor de tela).

### 7.11 Troca entre Entrar e Criar conta

Ver 7.3. Resumo: a tela que sai faz cross-fade de 160 ms; o conteúdo que entra desliza 16 pt (+16 ao avançar, -16 ao voltar) em 260 ms com 30 ms de passo; a marca e a aurora ficam paradas. Reduzir movimento: dissolve de 120 ms, sem deslize.

### 7.12 Mostrar e ocultar senha

Troca instantânea do ícone e do texto ("Mostrar" a "Ocultar"). Nenhum movimento (UX 7). Cross-fade de 100 ms entre os dois ícones é opcional e some com Reduzir movimento.

### 7.13 Resumo de limites

- Entrada completa: 780 ms (limite de 900).
- Entrada curta: 470 ms no pior caso.
- Painel de e-mail: 280 ms (ida), 240 ms (volta).
- Nenhuma animação bloqueia toque nem foco; nenhuma exige que o usuário espere para agir.
- Só `opacity` e `transform` (translate e scale); a aurora e a web também.
- Com `movimento.reduzido`: nenhum `translate`, nenhum `scale`, nenhuma deriva; só dissolves de 80 a 120 ms (ou troca imediata).

## 8. Implementação

### 8.1 Componentes novos ou alterados

`apps/app/src/ui/`:

| Arquivo                                                 | O que é                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MarcaDoSol.tsx` (mais `marcaDoSol.ts` com a geometria) | o sol em SVG, em peças (corpo, 5 raios, 2 barras, halo). Props: `lado`, `etapa` (`abertura` ou `estatica`), `decorativa` (sempre verdadeiro aqui). Cada peça animada é um `Animated.View` com um `Svg` dentro; o recorte do horizonte é um contêiner com `overflow: 'hidden'`                              |
| `Revelar.tsx`                                           | `<Revelar atraso duracao dx dy escala>`: envolve um filho e o revela (opacity mais transform). Cada elemento da cascata é um `Revelar`: um componente, um hook. Substitui `Aparecer` nesta tela (o `Aparecer` atual usa a API `Animated` do React Native e continua para as outras telas)                  |
| `useToqueComMola.ts`                                    | devolve `{ estiloDoToque, estiloDaCamada, aoPressionarDentro, aoPressionarFora }`; usado por `BotaoDeAcesso`, por `Campo` (anel) e depois por `Botao`                                                                                                                                                      |
| `Abalar.tsx`                                            | `<Abalar disparo={n} amplitude={5}>`: toda vez que `disparo` aumenta, balança (sequência 7.8); ignora se `reduzirMovimento`                                                                                                                                                                                |
| `TrocaDePainel.tsx`                                     | duas camadas (A e B) comandadas por `fase`; cuida de `pointerEvents`, `aria-hidden` e `display: none` na web; chama `aoAssentar(fase)` ao fim (foco)                                                                                                                                                       |
| `BotaoDeAcesso.tsx`                                     | substitui `BotaoDeAcessoRapido`: props `marca` (`apple`, `google`, `email`, `biometria`), `nivel` (`primario`, `secundario`, `terciario`), `selo`, `carregando`, `inativo`, `aoPressionar`, `estadoDeVitrine`. Escolhe as cores pela tabela 3.1 (função pura `aparenciaDoAcesso`, testável)                |
| `FundoAurora.tsx` e `.web.tsx`                          | props `movimento?: 'estatico'                                                                                                                                                                                                                                                                              | 'ambiente'`e`amanhecer?: boolean`; camadas aninhadas (externa: abertura; interna: deriva). Na web, deriva por CSS |
| `Campo.tsx`                                             | variante `acesso`: altura 56, anel e erro em camadas animadas, ação "Mostrar" com texto, fenda de erro de 26 (`reservarApoio` já existe; ganha `alturaDoApoio`)                                                                                                                                            |
| `Tela.tsx`                                              | prop `ajustarAoTeclado` (padrão `true`); `false` desliga o `KeyboardAvoidingView`. Com `rolar={false}` e conteúdo que cabe, nada rola                                                                                                                                                                      |
| `medidasDoAcesso.ts`                                    | função pura `calcularMedidasDoAcesso({ largura, altura, topo, base, teclado, fonte, temApple, temConvite, temBiometria, temSelo })` que devolve o `y` de cada bloco, o lado do sol, o ritmo (compacto ou confortável), `rola` e as sobras. É o que o teste usa para provar "cabe sem rolar" nos 5 tamanhos |

`apps/app/src/funcionalidades/autenticacao/`:

| Arquivo                 | O que é                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `TelaEntrar.tsx`        | reescrita: estado da rota (`modo`), `useMutation` como hoje, e os 3 blocos abaixo                                                     |
| `PalcoDaEntrada.tsx`    | sol, nome e apoio (ou erro do provedor), mais o cartão do convite                                                                     |
| `AcessosDaEntrada.tsx`  | selo, botões em ordem (função pura `ordemDosAcessos({ plataforma, ultimoMetodo, biometria, provedores })` com teste) e rodapé         |
| `PainelDeEmail.tsx`     | linha de voltar, título, os dois campos, Entrar; `Abalar` nos campos; foco programado                                                 |
| `CabecalhoDeAcesso.tsx` | continua para Criar conta e convite, trocando a linha da marca pelo `MarcaDoSol` pequeno, para as três telas ficarem do mesmo desenho |

`packages/tokens/src/acesso.ts`: os tokens da tabela 2.1 mais `MOVIMENTO_DE_ACESSO`, `CURVAS_DE_ACESSO`, `MOLAS_DE_ACESSO`, `MARCA_DO_GOOGLE_ESCURO`, `MARCA_DO_SOL`, `AURORA.deriva`. Cada par novo entra em `pares.ts` (`PARES_OBRIGATORIOS`) para o teste de contraste existente cobrir.

### 8.2 Reanimated 4.7.1: o que usar

- **Hooks:** `useSharedValue`, `useAnimatedStyle`, `withTiming`, `withSpring`, `withDelay`, `withSequence`, `withRepeat`, `cancelAnimation`, `interpolate`, `Easing`, `ReduceMotion`. Para chamar JavaScript no fim de uma animação (foco no campo), no Reanimated 4 o `runOnJS` foi substituído por `scheduleOnRN` de `react-native-worklets` (confirmar na 4.7.1).
- **Reduzir movimento:** o Reanimated, por padrão, **pula** a animação quando o sistema pede menos movimento (`ReduceMotion.System`), e então nem o dissolve de 120 ms acontece. Como o projeto quer dissolves curtos, passar `reduceMotion: ReduceMotion.Never` em todos os `withTiming` e `withSpring` desta tela, e decidir o que animar pela preferência que o app já lê, `usePreferenciasDeAcessibilidade().reduzirMovimento` (é a mesma no nativo e na web via `matchMedia`). Uma só fonte de verdade.
- **Animações de layout (`entering`, `exiting`, `LinearTransition`):** **não usar nesta tela.** O elenco precisa de atraso, ordem e equivalente para Reduzir movimento controlados, e o suporte na web é por CSS com outro tempo. Valores compartilhados mais `useAnimatedStyle` dão o mesmo resultado nas três plataformas e são mais fáceis de testar.
- **Nada de animar propriedade de layout** (`width`, `height`, `top`, `margin`): só `opacity` e `transform`.
- **Camadas de pressionado, de anel e de erro:** `View` absoluta com `opacity` animada, no lugar de animar `backgroundColor` ou `borderColor`.

### 8.3 React Compiler

O app roda pelo React Compiler no bundle e nos testes (`jest.config.mjs`). Cuidados:

1. **Hook só no topo do componente.** Nada de hook em objeto, condição ou laço. Por isso a cascata usa um componente `Revelar` por elemento, e **nunca** `itens.map(() => useSharedValue(0))`.
2. **`.get()` e `.set()` em vez de `.value`** em código de componente e em efeitos (o compilador e `eslint-plugin-react-hooks` 7 reclamam de escrita em `.value`). Dentro de `useAnimatedStyle` (worklet) `.value` é permitido.
3. **Valores derivados de props** (`lado` do sol, posições em `calcularMedidasDoAcesso`) entram como dependência do que depende deles; nada de ler `window` no render.
4. **Efeitos para sistemas externos** (animação, teclado, `AppState`): como o projeto já faz em `Aparecer` e `useTecladoAberto`, com limpeza (`cancelAnimation`) no retorno do efeito.
5. **Estilos animados estáveis:** um `useAnimatedStyle` por elemento, sem fábrica de estilo no render.

### 8.4 React Native Web

- **Reanimated na web:** `useAnimatedStyle` roda no thread de JavaScript e atualiza `style`; para a cascata de 780 ms com 13 elementos é aceitável. Para a deriva de 28 s, não: usar CSS (`@keyframes`), como em 6.
- `FundoAurora.web.tsx` usa `div` e CSS; o `react-native-web` não desenha `backgroundImage`. Por isso a camada animada na web é um `div` com a classe de `@keyframes`, e a abertura (opacity e scale do coral) também em CSS.
- O foco visível é o `:focus-visible` de `EstilosDaWeb`; a camada de anel do `Campo` e o anel do botão não podem duplicar o contorno: na web, o campo usa só o `:focus-visible` mais a camada.
- O painel de e-mail é um `<form>` real na web (arquivo `.web.tsx`), para Enter enviar e o gerenciador de senhas oferecer salvar. `autocomplete` e `name` nos campos (seção 5).
- Altura da janela na web: `100dvh` (não `100vh`), para a barra do navegador móvel não cortar o rodapé.
- `prefers-reduced-motion` já alimenta `usePreferenciasDeAcessibilidade`; o CSS da deriva tem o `@media` próprio.

### 8.5 Jest

- `apps/app/jest.setup.ts` **não trata o Reanimated hoje**, e a busca no app não achou nenhum componente que o use (só o `package.json`). Antes da primeira tela com Reanimated, o setup precisa do mock do Reanimated e do `react-native-worklets` (a documentação da 4.7.1 pede `setUpTests()` do Reanimated e o mock de `react-native-worklets`; confirmar o nome exato nela). Sem isso os testes de tela quebram na importação.
- Testes de movimento conferem **estado final** (papel, `accessibilityState`, texto, `pointerEvents`), com timers falsos avançando 900 ms. A coreografia em si (curvas, atrasos) é conferida em aparelho; os números ficam em `MOVIMENTO_DE_ACESSO` e têm teste de soma (último fim abaixo de 900).
- Testes puros: `calcularMedidasDoAcesso` (as 5 combinações da tabela 2.3 e 2.4, mais fonte 1,35 e 1,6), `ordemDosAcessos`, `aparenciaDoAcesso` e os pares de contraste de 3.4.
- Isolamento (CLAUDE.md, seção 8): a tela de entrada é pública, sem rota `/api/v1/c/...`; não gera teste de isolamento.

### 8.6 Documentação junto do código (CLAUDE.md, seção 10)

Ao implementar: atualizar `docs/STATUS.md` e a linha de rastreabilidade; registrar em `docs/DECISOES.md` a exceção da deriva (6) e os botões de 56; atualizar `docs/design/especificacao-e-roadmap.md` 3.1.1 (a tela Entrar deixa de ter cartão) e 2.9 (movimento). Pendências humanas: aprovação da deriva, da dependência opcional `expo-haptics` e do segurar o redirecionamento por 200 ms.

## 9. Checklist de aceitação visual (10 itens)

Verificar no iPhone SE (375x667), no 15/16 (393x852), em Android (360x800) e na web larga, nos temas escuro e claro.

1. **Cabe sem rolar:** `entrada.inicio` e `entrada.email` (teclado aberto) sem barra de rolagem em fonte padrão e em 1,2; no SE, a sobra acima do teclado é de pelo menos 15 pt.
2. **Marca como centro:** o sol (88, 96 ou 112) está centrado no eixo da coluna e é o maior elemento acima da dobra; o nome em `tituloTela` 28/32, nunca maior.
3. **Um só preenchimento forte por estado:** em `entrada.inicio`, exatamente um botão de cor chapada (Apple no iOS, Google no Android e web); nenhum coral de fundo cheio; Google em contorno; e-mail em texto (iOS) ou contorno (Android e web).
4. **Ritmo da escala:** todo intervalo vertical medido é 8, 12, 16, 20, 24 ou 32, mais os respiros de cima e de baixo (múltiplos de 8 e sobra); nada de valor fora disso (conferir pela função `calcularMedidasDoAcesso` e por captura sobreposta a uma grade de 4).
5. **Alinhamento:** margem de 20 nos dois lados; botões e campos na mesma largura; centro do sol, do nome, do selo e do rodapé na mesma vertical.
6. **Contraste AA medido:** todos os pares da tabela 3.4 ≥ 4,5 (texto) e ≥ 3 (componente) nos dois temas, inclusive o texto de apoio sobre o pico da aurora.
7. **Estados completos:** repouso, pressionado, foco (anel), carregando, desabilitado e erro existem e foram vistos em cada botão e em cada campo (catálogo `_catalogo.tsx`).
8. **Alvos de toque:** botões 56 (e-mail terciário 48, rodapé 48 e 44); "Esqueci a senha", "Mostrar" e "Voltar" com alvo de 44 de altura; nenhum alvo menor que 44.
9. **Movimento dentro do orçamento:** abertura em 780 ms ou menos, cascata de 50 ms entre botões, toque em 90 ms com mola, painel de e-mail em 280 ms, balanço de 5 pt em 260 ms; a tela responde ao toque desde o primeiro quadro; só `opacity` e `transform` animados.
10. **Preferências respeitadas:** com Reduzir movimento, nenhum deslize, escala, balanço ou deriva (só dissolve de até 120 ms); com Reduzir transparência, nenhum elemento translúcido (o cartão do convite usa `superficie`); com Aumentar contraste, borda de 2 em `texto` e aurora desligada; com fonte em 1,6, nenhum texto cortado e nenhuma ação escondida.

## 10. O que muda em relação ao UX e ao código atual

| Ponto                | UX ou código atual                          | Aqui                                            | Por quê                                                                                      |
| -------------------- | ------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Altura dos acessos   | 52 (UX)                                     | 56                                              | sobra de 125 pt no SE; campo e botão na mesma altura                                         |
| Botão Entrar         | preso acima do teclado (barra de ação)      | no fluxo do painel, logo abaixo da senha        | o painel é ancorado no topo e cabe acima do teclado; sem `BarraDeAcao` não há segundo layout |
| Marca                | ícone de 56 no canto, com o nome ao lado    | sol de 88 a 112 centrado, mini de 32 no painel  | a marca é o momento de marca                                                                 |
| Título               | "Bem-vindo de volta" em `display` 34/38     | nome do app em `tituloTela` 28/32 (texto do UX) | menos texto, mais hierarquia                                                                 |
| Cartão de formulário | cartão de vidro com borda                   | sem cartão; campos soltos no fundo              | pedido do dono; menos peso                                                                   |
| Movimento contínuo   | "não há animação decorativa contínua" (2.9) | deriva da aurora só na entrada                  | exceção a registrar                                                                          |
| `Aparecer`           | `Animated` do React Native, 200 ms, 6 pt    | `Revelar` (Reanimated), cascata                 | cascata e Reduzir movimento controlados                                                      |
| Google               | token só em branco                          | dois temas (`MARCA_DO_GOOGLE_ESCURO`)           | o escuro é o tema oficial para o secundário                                                  |

## 11. Fontes consultadas

- Apple, Human Interface Guidelines, Sign in with Apple: https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple
- Apple, gerador do botão oficial: https://appleid.apple.com/signinwithapple/button
- Google, Sign in with Google Branding Guidelines: https://developers.google.com/identity/branding-guidelines
- Expo, Apple Authentication (botão e regras de botão customizado): https://docs.expo.dev/versions/v58.0.0/sdk/apple-authentication/

Os números da marca do Google no tema escuro (`#131314`, `#8E918F`, `#E3E3E3`) vieram de um espelho da diretriz; conferir na página oficial. Os números exatos do botão da Apple (proporção do logotipo, espaço até o texto) não foram confirmados na busca e estão marcados em 3.2.

## O que foi feito (21/11/2026, D63)

Implementado com os tokens de `packages/tokens/src/acesso.ts` e os componentes de `apps/app/src/ui/`. A deriva da aurora foi **aprovada pelo dono** como exceção limitada à especificação 2.9 (registrada em D63).

**Como no desenho:**

- Sol em SVG em peças (halo, 2 barras, corpo recortado pelo horizonte, 5 raios), geometria do `icon.png`; cascata de abertura de 780 ms uma vez por abertura do app (`CASCATA_DE_ABERTURA`, com teste de soma), entrada curta de 260 ms nos retornos e com convite, e halo que respira no sucesso.
- Layout com duas camadas de geometria fixa (acessos e painel de e-mail) trocadas por uma fase única (280 ms ida, 240 volta), sem salto de layout; a camada que sai perde o toque e some do leitor de tela (na web, `display: none`). A função pura `calcularMedidasDoAcesso` escolhe o sol (112, 96, 88, 72, 56), esconde o apoio e liga a rolagem de segurança; o teste confere a tabela 2.3 (SE: sobra 125, respiro 48 e 77; 15 e 16: 209, 80 e 129; Android: 262, 104 e 158) e a 2.4 (painel com teclado: sobra 15, 73 e 92).
- Botões de 56 (terciário 48), a hierarquia da seção 3.1 (função pura `aparenciaDoAcesso`), a Apple e o Google nas cores oficiais (tema escuro da marca do Google como secundário no escuro), camada de pressionado que só muda de opacidade, escala 0,98 com mola, indicador depois de 250 ms, check no sucesso, balanço do erro de 5 pt (campo) e 4 pt (botão).
- Campos com rótulo fixo, caixa de 56, anel de foco e de erro em camadas, fenda de 26 sempre reservada, "Mostrar" com texto.
- Aurora com deriva (Reanimated no nativo; `@keyframes` na web), em duas camadas aninhadas; para com o app em segundo plano, fora de foco e com o painel de e-mail com teclado.
- Contraste: os pares da tabela 3.4 entraram em `packages/tokens/src/pares.ts` e o teste confere 4,5:1 (texto) e 3:1 (componentes) nos dois temas.
- Reanimated 4.7.1: `Easing.bezier` no escopo do módulo, `ReduceMotion.Never` com a decisão pela preferência do app, `scheduleOnRN` de `react-native-worklets` para o aviso de fim da troca, `.get()` e `.set()` fora dos worklets, um `Revelar` por elemento (nenhum hook em laço). Dublê do Reanimated em `jest.setup.ts` (o mock oficial não carrega no Jest).

**Diferenças em relação ao desenho (e por quê):**

1. Nomes: `geometriaDoSol.ts` (e não `marcaDoSol.ts`, que colidia por caixa com `MarcaDoSol.tsx` no Windows); `CampoDeAcesso` é um componente novo (a variante `acesso` do `Campo` mexeria num arquivo de todo o app); `BotaoDeAcessoRapido` ficou como um invólucro fino de `BotaoDeAcesso` para os usos fora da entrada; a `Tela` não ganhou `ajustarAoTeclado`: a entrada e as telas de criar conta usam uma moldura própria (`QuadroDeAcesso`).
2. O estado desabilitado e o esmaecer dos outros botões durante o carregamento são `opacity` animada a 60% (item 7.9 do desenho); é a única exceção à regra "estado é cor", e vive só em `BotaoDeAcesso`.
3. Os raios têm 252 a 369 de distância do centro (medidos da imagem), não 230 a 330.
4. O painel de e-mail na web não é um `<form>` real: Enter envia pelo `onSubmitEditing` e o chaveiro usa `autoComplete`; o contorno do `:focus-visible` do campo é desligado por atributo em `EstilosDaWeb.web.tsx` (o anel é a camada arredondada).
5. A abertura nunca deixa o botão principal trocar depois de desenhado: no iOS os acessos esperam a resposta da Apple (`consultando`).
6. A tela de entrada do iPhone com a Apple só aparece em aparelho ou simulador; a web não tem a Apple, então as capturas são da variante web (Google primário). O catálogo (`_catalogo`) não foi atualizado com os estados novos.
7. Não medido: quadros perdidos da deriva em aparelho médio (meta de 3% em 90 s), altura real do teclado, Aumentar contraste e Reduzir transparência em aparelho.
