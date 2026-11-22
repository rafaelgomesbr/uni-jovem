# Controles v2: botões e campos de texto

Data: 22/11/2026. Pedido do dono: "não gosto dos btns nem dos inputs text". Este documento diz o que provavelmente incomoda, propõe uma linguagem única para botões e campos e dá os valores exatos para a equipe de código aplicar. A página `docs/design/controles-v2.html` mostra o ANTES (reproduzido do código) e o DEPOIS lado a lado, nos dois temas, com foco e pressionar funcionando. Abra com dois cliques.

Aviso de método: os contrastes abaixo foram calculados à mão com a mesma fórmula de `packages/tokens/src/contraste.ts` (nesta sessão não havia como rodar o teste). Antes de aceitar, adicione os pares do apêndice a `pares.ts` e rode o teste: se algum número divergir, o teste manda.

---

## 1. Diagnóstico: o que provavelmente incomoda

Vi as 13 telas e li o código. Em ordem de peso visual:

1. **Tudo é o mesmo retângulo de raio 14.** Botão, campo, trilho de segmentos, aviso e toast usam `RAIO.controle` (14). Não há uma forma que diga "isto é para tocar" e outra que diga "isto é para escrever". É o sintoma mais forte de "formulário genérico".
2. **O botão primário é uma laje chapada.** Coral `#FF8A65` liso, 48 pt, texto marrom quase preto `#1A0F0A` (telas 12, 15, 21, 22, 27). Contraste ótimo (8,1:1), mas sem luz, sem profundidade e sem relação com o brilho coral do fundo Aurora.
3. **O secundário é um vazio com contorno.** Só uma linha de 1 pt a 36% de branco (3,25:1 sobre o cartão). "Salvar rascunho" (12), "Colar" (22), "Não posso ir" (23b), "Inscrever-me" (08) parecem desenhos sem preenchimento ao lado de uma laje sólida. Em 10 (check-in) são oito "Marcar" vazados empilhados: ruído.
4. **Não existe regra de secundário.** "Mais" (08) é tonal e 44 pt; "Inscrever-me" é contorno e 44; "Colar" é contorno e 48. Mesmo papel, três desenhos.
5. **O campo é um poço escuro com contorno violeta.** O fundo `campoFundo #1A1833` é mais escuro que o cartão `#232139` (parece um buraco) e a borda `#736DA8` é violeta saturada de 1 pt. Visto de 3 telas seguidas (12, 21, 22), é o visual de formulário de 2015.
6. **Rótulo, ajuda e erro não têm hierarquia.** O rótulo (600, `#C9C4EC`) e a ajuda (400, `#C9C4EC`) têm a mesma cor; só muda o peso. O intervalo entre um campo e o rótulo do próximo é 12 pt (`RITMO.entreItens`), quase igual aos 8 pt entre rótulo e caixa: o olho não sabe a quem o rótulo pertence. Na tela 22 a ajuda de três linhas briga com o contador "0/280".
7. **O exemplo (placeholder) parece valor digitado.** `placeholderTextColor` é `textoSuave #C9C4EC` (10,3:1 no campo) contra o texto `#F5F3FF` (15,7:1): quase o mesmo brilho. Em `login-15-email`, "nome@exemplo.com" parece já preenchido. No web, a data aparece como "dd/mm/yyyy" e "--:-- --" do navegador.
8. **O foco é amarelo e fala dois dialetos.** `foco = #FFD166` no escuro (único amarelo num sistema coral e violeta) e índigo `#4B3FC4` no claro. O `Campo` faz borda de foco mais sombra interna de 1 pt; o `CampoDeAcesso` faz anel de 2 pt em camada; o `Botao` faz contorno de 2 com afastamento 2. Três jeitos de dizer "estou aqui".
9. **Caixas de texto longo sem alma.** Alturas fixas de 120 e 160 pt (telas 12, 22, 27): um retângulo escuro vazio, sem crescer com o conteúdo, com o contador longe.
10. **Desabilitado parece quebrado e o interruptor desligado some.** "Entrar na comunidade" (22) vira uma laje cinza-violeta que lembra um secundário, e a explicação fica três linhas abaixo. O `Switch` desligado usa branco a 8% sobre o cartão: 1,28:1, o trilho desaparece (27).
11. **Dois sistemas no mesmo app.** `BotaoDeAcesso` e `CampoDeAcesso` (login, 56 pt, mola, camada de toque, anel animado) são mais maduros que `Botao` e `Campo` (48 e 44 pt, escala sem mola, anel seco). Quem entra pelo login vê um app e, na tela seguinte, outro.
12. **Chips de sugestão com cara de campo.** As sugestões de categoria (12) usam o mesmo contorno violeta dos campos; parecem campos vazios.

Um achado de comportamento: em `login-15-erro` o erro é do formulário e nenhum campo ganha anel de erro. O campo precisa aceitar "inválido sem mensagem própria".

---

## 2. Princípios

1. **Forma diz função.** Cápsula (raio máximo) é para agir. Retângulo de raio 16 é para escrever. Raio 22 contém (cartão), 28 flutua (barra). Quem vê a forma sabe o que fazer.
2. **Hierarquia por preenchimento, sem contorno nos botões.** Sólido coral (a ação), tonal violeta (a alternativa), só texto coral claro (o resto), tonal vermelho (o perigo). Contorno fica só para campos.
3. **Quente e frio, como a Aurora.** Coral é ação e foco. Violeta é superfície e alternativa. Nada de amarelo.
4. **Uma gramática de estados.** Repouso, hover (web), pressionado, foco, carregando, desabilitado, erro: os mesmos gestos em botão, campo, segmento e interruptor.
5. **Sutileza vem de matiz e preenchimento, nunca de contraste.** Onde quis reduzir peso visual (borda violeta), mudei saturação e fundo, e mantive 3:1. Contorno realmente "quase invisível" reprovaria na WCAG 1.4.11 (ver seção 9).
6. **Movimento só de `opacity` e `transform`**, com equivalente para "Reduzir movimento".
7. **Reaproveitar antes de criar.** `primaria`, `primariaPressionada`, `sobrePrimaria`, `destaque`, `quenteFundo`, `erro`, `erroFundo`, `erroCheio`, `sucesso`, `tonal` e `tonalBorda` continuam como estão; só nascem 8 cores novas (3.0).

---

## 3. Especificação

### 3.0 Tokens: o que muda e o que nasce

Existente que muda de valor:

| Token             | Hoje (escuro / claro) | Proposto (escuro / claro)                      |
| ----------------- | --------------------- | ---------------------------------------------- |
| `campoFundo`      | `#1A1833` / `#FFFFFF` | `#322F4C` (opaco, um degrau acima) / `#F3F1FA` |
| `campoBorda`      | `#736DA8` / `#857FAF` | `#7C77A8` (menos saturado) / `#857FAF` (igual) |
| `foco`            | `#FFD166` / `#4B3FC4` | `#FF8A65` / `#C2491F` (iguais à `primaria`)    |
| `RAIO`            | só `controle` 14      | + `campo` 16; botão usa `pilula` (999)         |
| `ALTURA.controle` | 48                    | fica, marcado como legado; nascem as de baixo  |
| `TIPO.botao`      | 600, 15/20            | 600, **16/20**, espaçamento 0, teto 2          |

Novos tokens:

| Token                          | Escuro                                    | Claro                               | Uso                                      |
| ------------------------------ | ----------------------------------------- | ----------------------------------- | ---------------------------------------- |
| `Paleta.primariaTopo`          | `#FF9A78`                                 | `#C64B20`                           | topo do degradê do primário              |
| `Paleta.primariaBase`          | `#FF8A65`                                 | `#B5431B`                           | base do degradê                          |
| `Paleta.botaoTonal`            | `rgba(179,168,255,0.16)`                  | `rgba(75,63,196,0.12)`              | secundário e botão de ícone              |
| `Paleta.botaoTonalPressionado` | `rgba(179,168,255,0.24)`                  | `rgba(75,63,196,0.18)`              | secundário pressionado                   |
| `Paleta.botaoTonalOpaco`       | `#3A3759`                                 | `#E9E8F8`                           | com "Reduzir transparência"              |
| `Paleta.campoExemplo`          | `#A7A2D0`                                 | `#6B6690`                           | placeholder                              |
| `Paleta.campoDesabilitado`     | `rgba(255,255,255,0.04)`                  | `rgba(27,24,56,0.04)`               | fundo do campo desabilitado              |
| `Paleta.focoHalo`              | `rgba(255,138,101,0.22)`                  | `rgba(194,73,31,0.18)`              | halo de 4 pt ao redor do anel            |
| `ELEVACAO.botao`               | `0px 6px 16px rgba(255,138,101,0.28)`     | `0px 6px 14px rgba(194,73,31,0.30)` | brilho do primário                       |
| `ALTURA.botao`                 | `{ grande: 56, medio: 48, compacto: 40 }` |                                     | ver 3.1                                  |
| `ALTURA.campo`                 | 56                                        |                                     | caixa de uma linha                       |
| `RITMO.entreCampos`            | 20                                        |                                     | entre blocos de campo                    |
| `TIPO.campo`                   | Inter 400, 16/22, teto 2                  |                                     | texto digitado (16 evita zoom do Safari) |
| `MOVIMENTO_DOS_CONTROLES`      | ver 3.4                                   |                                     | generaliza `MOVIMENTO_DE_ACESSO`         |

Os valores de espaço usados (8, 12, 16, 20, 24) já estão na escala. O realce interno do primário é constante: `inset 0px 1px 0px rgba(255,255,255,0.30)` no escuro e `0.22` no claro.

### 3.1 Botões

**Hierarquia** (no máximo um primário por tela ou cartão):

| Variante          | Papel               | Aparência no escuro                                                 | No claro                                                                |
| ----------------- | ------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `primario`        | a ação da tela      | degradê `primariaTopo` a `primariaBase`, texto `sobrePrimaria`      | degradê `primariaTopo` a `primariaBase`, texto `sobrePrimaria` (branco) |
| `secundario`      | a alternativa       | fundo `botaoTonal` composto no cartão, texto `texto`, **sem borda** | idem                                                                    |
| `terciario`       | links e ações leves | sem fundo, texto `destaque` (`#FFB199`)                             | texto `destaque` (`#8A2E12`)                                            |
| `destrutivo`      | perigo              | fundo `erroFundo`, texto `erro` (era contorno)                      | idem                                                                    |
| `destrutivoCheio` | confirmação final   | `erroCheio` + `sobreErro` (igual hoje)                              | igual hoje                                                              |
| `BotaoIcone`      | ações curtas        | círculo `botaoTonal`, ícone `texto` 22                              | idem                                                                    |

**Medidas** (a prop `tamanho` continua com os mesmos nomes):

| `tamanho`         | Altura                            | Padding horizontal | Ícone | Onde                                           |
| ----------------- | --------------------------------- | ------------------ | ----- | ---------------------------------------------- |
| `grande`          | **56** (era 48)                   | 24                 | 20    | formulário, barra de ação, entrada             |
| `medio` (padrão)  | **48** (era 44/48)                | 20                 | 18    | dentro de cartão                               |
| `compacto` (novo) | 40 visual + `hitSlop` 4 = alvo 48 | 16                 | 16    | só em linha de lista (`BotaoDeLinha`)          |
| `alto`            | 56 (igual hoje)                   | 8                  | 24    | Ao vivo; vira apelido de `grande` com ícone 24 |

- **Raio:** `RAIO.pilula` (cápsula). Em 56 pt o raio efetivo é 28, o mesmo valor de `RAIO.barra`.
- **Tipografia:** Inter 600, 16/20, espaçamento 0 (Inter já vem calibrada em 16; espaçar mais abre demais). Nunca maiúsculas. `maxFontSizeMultiplier` 2; a altura é mínima, não fixa.
- **Ícone:** à esquerda, 8 pt do rótulo, só quando ajuda a reconhecer (QR, colar, compartilhar, "+"). À direita só a seta de avanço do terciário ("Ver todas" seguido de seta).
- **Largura:** cheia em formulário, barra de ação e estado vazio (`larguraTotal`); ajustada ao conteúdo no resto, com largura mínima de 96 no `grande`.
- **Par lado a lado:** intervalo **12** (era 10), larguras iguais, secundário à esquerda e primário à direita, padding horizontal 12 dentro do par. **Empilhado** (fonte do sistema 1,35 ou mais, ou rótulo que não cabe): primário em cima, secundário embaixo, intervalo 12, ambos de largura total.

**Estados, escuro (claro entre parênteses quando muda):**

| Estado       | Primário                                                                                                                                                                            | Secundário                              | Terciário                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------ |
| Repouso      | degradê `primariaTopo`→`primariaBase`, realce interno, sombra `ELEVACAO.botao`                                                                                                      | `botaoTonal`                            | transparente, `destaque` |
| Hover (web)  | camada branca 6% (preta 4% no claro) por cima                                                                                                                                       | camada igual                            | `quenteFundo` a 50%      |
| Pressionado  | fundo sólido `primariaPressionada` (`#F0764F`; claro `#A93D18`), sem sombra, escala 0,98                                                                                            | `botaoTonalPressionado`                 | `quenteFundo`            |
| Foco         | contorno 2 pt `foco`, afastado 2, seguindo a cápsula                                                                                                                                | igual                                   | igual                    |
| Carregando   | fundo de repouso, indicador de 18 pt no lugar do ícone (depois de 250 ms), rótulo mantido (ou `tituloCarregando`, ex.: "Entrando..."), largura travada, `aria-busy`, toque ignorado | igual                                   | igual                    |
| Desabilitado | fundo `quenteFundo`, texto `destaque` a 70%, sem sombra nem realce; `motivo` abaixo                                                                                                 | fundo `tonal`, texto `textoSuave` a 70% | texto `destaque` a 50%   |

Regras de estado:

- **Desabilitado não vira cinza.** O primário continua coral apagado, para ainda ler como "a ação principal, ainda não". Mesmo desabilitado o texto fica a 3,9:1 (escuro) e 3,7:1 (claro): não é exigência da WCAG, mas evita parecer quebrado.
- **O `motivo`** aparece 8 pt abaixo (`legenda` 14, `textoSuave`) com ícone de cadeado de 14 e vai ao leitor de tela. Em barra de ação, uma linha só, na largura toda (como hoje).
- **Carregando** usa o indicador pequeno do sistema (20 pt no iOS, 18 no Android), nunca o `large`.
- **Marcado** (alternável, "Estou orando"): fundo `quenteFundo`, texto `destaque`, borda 1 pt `destaque`, ícone de check (cor nunca é o único sinal).
- **Aumentar contraste:** sem degradê nem sombra; borda de 2 pt em `texto` em todas as variantes com fundo.
- **Reduzir transparência:** secundário e botão de ícone usam `botaoTonalOpaco`.

**Acabamento do primário (justificativa).** O primário ganha três toques de baixo custo: (a) degradê vertical de 8% de luminosidade, de `#FF9A78` para `#FF8A65`; (b) realce interno de 1 pt no topo; (c) brilho coral suave embaixo (`0 6 16 rgba(255,138,101,0.28)`). Justificativa: o botão deixa de ser laje e passa a ecoar o brilho coral da Aurora, o que é a marca do app. O custo é uma propriedade de estilo nativa (sem biblioteca, sem imagem): a `View` já usa `boxShadow`. Restrições: o degradê só clareia o topo, então o texto escuro só ganha contraste (9,1:1 no topo, 8,1:1 na base, 6,6:1 pressionado); no claro o topo `#C64B20` ainda dá 4,74:1 com texto branco. Nada anima o degradê. Se o dispositivo não suportar `backgroundImage`, cai no sólido `primaria` sem perda. Se o dono achar demais, desligue (b) e (c) e fique só com (a).

**Contraste dos botões:**

| Par                                          | Escuro | Claro  |
| -------------------------------------------- | ------ | ------ |
| texto do primário / topo do degradê          | 9,08:1 | 4,74:1 |
| texto do primário / base                     | 8,13:1 | 5,55:1 |
| texto do primário / pressionado              | 6,63:1 | 6,24:1 |
| primário contra o cartão (limite, 3:1)       | 6,73:1 | 4,92:1 |
| texto do secundário / `botaoTonal` no cartão | 10,2:1 | 14,1:1 |
| texto do secundário pressionado              | 8,6:1  | 12,7:1 |
| `erro` / `erroFundo` no cartão (destrutivo)  | 5,13:1 | 5,43:1 |
| `destaque` (terciário) / cartão              | 8,9:1  | 8,46:1 |

O secundário não tem borda: a WCAG 1.4.11 dispensa o limite quando o texto do botão já o identifica (e o texto passa 4,5:1). O preenchimento tonal existe para dar forma, não para cumprir limite.

### 3.2 Campos de texto

**Uma só forma** para texto, e-mail, senha, número, código, busca, data, hora e área de texto: `Campo`, `CampoDeBusca`, `CampoDeAcesso`, `CampoDeData`, `CampoDeHora` passam a desenhar a mesma caixa.

**Rótulo: fixo acima, não flutuante.** Motivos: o preenchimento do sistema (chaveiro, Safari) escreve no campo e o rótulo flutuante colide; a fonte grande do sistema quebra o rótulo que encolhe para 12 (o piso do app é 14 a 15 por causa de quem tem 40 a 70 anos); e o `CampoDeAcesso` já decidiu isso. O rótulo ganha peso: Inter 600 15/20 na cor **`texto`** (era `textoSuave`), "(opcional)" em 400 `textoSuave`. A ajuda fica `textoSuave`: a hierarquia passa a vir da cor e do peso.

**Anatomia e medidas:**

- Rótulo, intervalo **8**, caixa, intervalo **8**, linha de apoio (ajuda, erro ou sucesso à esquerda; contador à direita). Entre blocos de campo: **20** (`RITMO.entreCampos`, era 12).
- Caixa: altura mínima **56** (era 48), raio **16** (`RAIO.campo`), borda 1 pt `campoBorda`, fundo `campoFundo`, padding horizontal 16.
- Texto: Inter 400, 16/22 (`TIPO.campo`), cor `texto`. Exemplo: `campoExemplo`, nunca `textoSuave`.
- Ícone à esquerda: 20 pt, `textoSuave`, a 16 da borda; o texto começa em 48. Regra: esquerda diz "o que é" (busca, calendário, relógio, cadeado); direita diz "o que fazer" (limpar, mostrar) ou o estado (erro, sucesso).
- Prefixo ("R$", "+55") e sufixo ("min"): 15/20 `textoSuave`, dentro da caixa, 8 do texto.
- Limpar: aparece quando há texto e o campo tem foco; alvo 44 x 44 a 6 da borda direita, ícone de 18.
- Senha: botão com **ícone e palavra** ("Mostrar" e "Ocultar", Inter 600 15, cor `destaque`), como já faz o login; alvo 44 de altura.
- Campo ao lado de botão (`botao`): o botão assume altura 56 e raio `RAIO.campo` (variante "encaixada"), para os dois formarem uma peça.

**Estados:**

| Estado          | Fundo                       | Borda e anel                                                                                      | Detalhe                                                                                                                                                     |
| --------------- | --------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repouso         | `campoFundo`                | 1 pt `campoBorda`                                                                                 | exemplo em `campoExemplo`                                                                                                                                   |
| Hover (web)     | `campoFundo` + 3% de branco | borda 1 pt mais clara (+8% de luminosidade)                                                       | só ponteiro                                                                                                                                                 |
| Foco            | igual                       | **anel de 2 pt `foco`** sobre a borda, mais halo de 4 pt `focoHalo`; transição 160 ms (saída 120) | cursor e seleção em `primaria`; o texto não se desloca (o anel é camada com `opacity`)                                                                      |
| Preenchido      | igual ao repouso            | igual                                                                                             | texto em `texto`                                                                                                                                            |
| Desabilitado    | `campoDesabilitado`         | sem borda                                                                                         | texto `textoSuave` a 60%; ajuda explica por quê; sem tracejado                                                                                              |
| Somente leitura | transparente                | 1 pt `tonalBorda`                                                                                 | texto `texto` cheio, ícone de cadeado à direita, texto selecionável                                                                                         |
| **Erro**        | igual                       | **anel de 2 pt `erro` permanente**                                                                | ícone `erro` de 20 à direita (se não houver ação) **e** linha de apoio: ícone de 16 + texto 15/20 600 em `texto`; `aria-invalid`; balanço de 5 pt ao enviar |
| Sucesso         | igual                       | borda 1 pt `sucesso`                                                                              | check `sucesso` de 20 à direita e texto de apoio em `texto` ("Nome disponível")                                                                             |
| Validando       | igual                       | repouso                                                                                           | indicador de 16 à direita                                                                                                                                   |

Notas: (a) o erro nunca é só cor: anel, ícone dentro do campo e frase embaixo. Como o anel de erro (`#FF8A8A`) e o de foco (`#FF8A65`) são ambos salmão, o ícone e a frase são o que separa os dois; com foco e erro juntos, vale o anel de erro e o halo vira `erroFundo`. (b) O `Campo` aceita `invalido` (booleano) para o erro do formulário inteiro (caso de `login-15-erro`): anel nos campos, mensagem em outro lugar. (c) A mensagem de erro passa a usar sempre `texto` com ícone em `erro`, em qualquer superfície (hoje só no cartão translúcido), o que tira uma ramificação do código.

**Área de texto:**

- Cresce com o conteúdo: mínimo **3 linhas** (100 pt = 16 + 3 x 22 + 16 + 2 de borda), máximo **8 linhas** (210 pt); passando disso, rola por dentro. Padding vertical 16. A variante `leitura` (17/26): mínimo 5 linhas (164 pt, era 160), máximo 10 (294).
- Contador à direita da linha de apoio, `legenda` 14 com `tabular-nums`; a partir de 90% do limite ganha peso 600 e ícone de alerta; no limite, vira erro. A ajuda pode quebrar em várias linhas à esquerda; o contador não quebra.
- A altura muda sem animação (animar altura não é `opacity` nem `transform`); a tela rola para manter o cursor visível.

**Busca:** mesma caixa de 56 e raio 16 (não é cápsula, para não parecer botão), ícone de lupa à esquerda, "Limpar a busca" à direita, `returnKeyType="search"`, o rótulo continua sendo o nome acessível mesmo oculto.

**Data e hora (`CampoDeMomento`):** a mesma caixa tocável; ícone de calendário ou relógio à **esquerda** (regra esquerda = o que é); valor 16/22; vazio mostra "Escolher data" em `campoExemplo`; o anel de foco fica ligado enquanto o seletor está aberto. No web, estilize o campo nativo com `color-scheme` e esconda o texto "dd/mm/yyyy" quando vazio.

**Dentro e fora de cartão:** o `campoFundo` é opaco e igual nos dois lugares: `#322F4C` está 1,22:1 acima do cartão `#232139`, 1,45:1 acima do fundo e 1,10:1 acima da folha `#2B2848` (sempre "um degrau"). Fora do cartão, o fundo opaco protege a leitura sobre os brilhos da Aurora.

**Fonte grande:** altura mínima, nunca fixa; o rótulo e a ajuda quebram em linhas; o contador desce para a linha de baixo se a ajuda ocupar a largura; o texto do campo cresce até 2x.

**Preenchimento do sistema (autofill):**

- Declare `autoComplete`, `textContentType` e `importantForAutofill="yes"`: e-mail (`email`/`emailAddress`), senha (`current-password`/`password`, ou `new-password`/`newPassword`), código (`one-time-code`/`oneTimeCode`), nome (`name`), telefone (`tel`).
- Web: em `EstilosDaWeb.web.tsx` acrescente, para `input` e `textarea` com `:-webkit-autofill`, `box-shadow: 0 0 0 1000px <campoFundo> inset`, `-webkit-text-fill-color: <texto>` e `caret-color: <primaria>`. Não use o truque de `transition` longa: a regra de "Reduzir movimento" do mesmo arquivo força `transition-duration: 0.01ms` e o amarelo do navegador apareceria.
- Generalize a exceção `[data-campo-de-acesso]:focus-visible` para `[data-campo]`: o anel é a camada do próprio campo.

**Contraste dos campos:**

| Par                                   | Escuro | Claro           |
| ------------------------------------- | ------ | --------------- |
| `texto` / `campoFundo`                | 11,6:1 | 15,2:1          |
| `campoExemplo` / `campoFundo`         | 5,30:1 | 4,78:1          |
| `campoBorda` / cartão (limite 3:1)    | 3,75:1 | 3,72:1          |
| `campoBorda` / fundo da tela          | 4,46:1 | 3,44:1          |
| `campoBorda` / folha elevada          | 3,37:1 | 3,72:1 (branca) |
| `campoBorda` / `campoFundo`           | 3,07:1 | 3,32:1          |
| `foco` / cartão                       | 6,73:1 | 4,92:1          |
| `foco` / `campoFundo`                 | 5,5:1  | 4,40:1          |
| `erro` / `campoFundo`                 | 5,62:1 | 5,88:1          |
| `sucesso` / `campoFundo`              | 8,0:1  | 4,85:1          |
| "Mostrar" (`destaque`) / `campoFundo` | 7,3:1  | 7,57:1          |

### 3.3 Controles vizinhos (resumo)

- **Segmentos:** trilho em cápsula (era raio 14), altura **48** (era 44), padding 4, polegar de 40 (era 36) também em cápsula. Selecionado: fundo `quenteFundo`, texto `destaque` 600 (6,06:1 no escuro, 6,95:1 no claro); inativo `textoSuave` 500 (9,1:1). Mantém o papel `radio`, as setas e a lógica de disposição (grade, pilha, pílulas).
- **ListaDeOpcoes (radio e caixa de marcar):** radio de **24** (era 22), anel 2 pt `campoBorda`, marcado em `primaria` com miolo de 12 e halo de foco; linha marcada ganha fundo `quenteFundo` a 50%. Caixa de marcar de 24, raio 8 (hoje 6), marcada em `primaria` com check em `sobrePrimaria`. Linhas de 56 (64 com descrição) como hoje.
- **Interruptor:** o `Switch` nativo desligado fica invisível no escuro (1,28:1). Troque por trilho próprio de 52 x 32: desligado, transparente com borda de 2 pt `campoBorda` (3,75:1 escuro, 3,72:1 claro) e polegar de 14 em `campoBorda`; ligado, trilho `primaria` com polegar de 24 em `sobrePrimaria` (claro: branco) e check de 14 em `primaria`. O texto de estado continua. O `Pressable` com papel `switch` já existe e fica.
- **Chip (estado):** não muda (24, cápsula, 13/16 600, nunca tocável).
- **Pílula de filtro e sugestão (tocável):** de contorno para preenchimento tonal (`botaoTonal`), altura 40 com `hitSlop` 4, texto 15/20 500; selecionada: `quenteFundo`, `destaque`, ícone de check. Isso separa "sugestão" de "campo" (ponto 12 do diagnóstico).
- **BarraDeAcao:** botões `grande` (56), intervalo 12, padding 12 em cima e embaixo, altura `12 + 56 + base + 12`. Par: secundário à esquerda, primário à direita, 1:1.

### 3.4 Movimento dos controles

Só `opacity` e `transform`. Tokens em `MOVIMENTO_DOS_CONTROLES` (generaliza `MOVIMENTO_DE_ACESSO`, que fica como apelido). A mola é a que já existe: `MOLAS_DE_ACESSO.toque` (amortecimento 18, rigidez 320, massa 0,6).

| Gatilho                     | Propriedade                                                              | Duração e curva                                                                 | Com "Reduzir movimento"            |
| --------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------- |
| Tocar o botão (entrada)     | `transform: scale` 1 para 0,98; camada de pressionado `opacity` 0 para 1 | 90 ms, saída suave (quad out)                                                   | sem escala; só a camada, 80 ms     |
| Soltar o botão              | `scale` 0,98 para 1; camada 1 para 0                                     | mola (cerca de 220 ms, passa uns 4%); camada 160 ms `cubic-bezier(0.4,0,0.2,1)` | só a camada, 80 ms                 |
| Foco no campo               | camada do anel e do halo, `opacity` 0 para 1                             | **160 ms**, quad out                                                            | 0 ms (instantâneo)                 |
| Perder o foco               | `opacity` 1 para 0                                                       | 120 ms                                                                          | 0 ms                               |
| Erro ao enviar              | `translateX` 0, -5, 5, -3, 0 no campo (4 pt no botão)                    | 260 ms em 4 etapas (já existe)                                                  | sem balanço; anel de erro em 80 ms |
| Mensagem de erro aparece    | `opacity` 0 para 1 e `translateY` 4 para 0                               | 200 ms, `cubic-bezier(0.22,1,0.36,1)`                                           | só `opacity`, 120 ms               |
| Carregando começa           | indicador `opacity` 0 para 1                                             | espera 250 ms, depois 140 ms                                                    | igual (é só dissolver)             |
| Carregando termina          | indicador 1 para 0                                                       | 100 ms                                                                          | igual                              |
| Habilitar ou desabilitar    | camada de cor `opacity`                                                  | 140 ms                                                                          | 80 ms                              |
| Interruptor liga ou desliga | polegar `translateX`                                                     | mola (a mesma do toque)                                                         | 80 ms linear, sem mola             |
| Segmento escolhido          | polegar `translateX`; texto sem animação de cor                          | 200 ms `cubic-bezier(0.4,0,0.2,1)`                                              | troca por dissolver, 120 ms        |
| Botão Limpar entra ou sai   | `opacity`                                                                | 120 ms                                                                          | 0 ms                               |
| Hover (web)                 | camada `opacity`                                                         | 120 ms                                                                          | 0 ms                               |

Regra: nenhuma cor é animada diretamente (cor muda por camada que só altera `opacity`), como já é a regra do `useToqueComMola`.

---

## 4. Mapa de migração

**Compatibilidade.** Nenhuma prop deixa de existir; os nomes de variante e de tamanho continuam. O que muda é o desenho e as medidas, logo as telas crescem: `grande` +8 pt, `medio` +4 pt, campo +8 pt. Props novas, todas opcionais: `Botao.tituloCarregando`, `Botao.tamanho: 'compacto'`, `Campo.invalido`, `Campo.sucesso` (texto), `Campo.prefixo`, `Campo.linhas` (`{ min, max }`), `Campo.limpavel`.

**O que muda em cada arquivo** (todos em `apps/app/src/ui` salvo indicação):

| Arquivo                                                                | Mudança                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/tokens/src/cores.ts`                                         | valores novos de `campoFundo`, `campoBorda`, `foco`; campos novos da `Paleta` (3.0) nos quatro objetos (`ESCURO`, `CLARO`, `INVERSO_*`). O inverso do escuro (cartão de destaque claro) herda os do claro; o do claro, os do escuro.                                                                                                               |
| `packages/tokens/src/index.ts`                                         | `ALTURA.botao`, `ALTURA.campo`, `RAIO.campo`, `TIPO.botao` 16/20, `TIPO.campo`, `RITMO.entreCampos`, `ELEVACAO.botao`, `BORDA.anel` (2)                                                                                                                                                                                                            |
| `packages/tokens/src/acesso.ts`                                        | `MOVIMENTO_DE_ACESSO` ganha apelido `MOVIMENTO_DOS_CONTROLES` (foco 160, saída 120)                                                                                                                                                                                                                                                                |
| `packages/tokens/src/pares.ts`                                         | pares do apêndice A                                                                                                                                                                                                                                                                                                                                |
| `Botao.tsx`                                                            | `aparenciaDoBotao` com a tabela 3.1; `alturaDoBotao` com 56/48/40; raio `RAIO.pilula`; usar `useToqueComMola` (hoje só o `BotaoDeAcesso` usa) em vez de `scale` sem mola; degradê, realce e sombra no primário; destrutivo tonal; desabilitado coral apagado com `motivo`; `BotaoIcone` circular e tonal; `ParDeBotoes` e `EmPar` com intervalo 12 |
| `BotaoDeAcesso.tsx`, `aparenciaDoAcesso.ts`, `BotaoDeAcessoRapido.tsx` | e-mail, Face ID e ação passam a delegar a `aparenciaDoBotao` (uma só tabela). Apple e Google ficam nas cores de marca, com raio cápsula e altura 56. `BotaoDeAcessoRapido` não muda.                                                                                                                                                               |
| `BotaoDeLinha.tsx`                                                     | de contorno para tonal (`botaoTonal`), altura 40, cápsula                                                                                                                                                                                                                                                                                          |
| `Campo.tsx` (`useEstiloDaCaixa`, `BlocoDoCampo`)                       | caixa 56, raio 16; estados da 3.2; **trazer o anel em camada de `CampoDeAcesso`** (opacidade, sem deslocar texto); espaçamento 8/8; erro sempre com `texto` e ícone `erro`; área de texto que cresce (`onContentSizeChange`); limpar, prefixo, sucesso, invalido                                                                                   |
| `CampoDeAcesso.tsx`                                                    | vira um invólucro fino de `Campo` (mantém `apoio`, `aoLado`, `disparoDeErro`, a fenda de 26 e o "Mostrar"); elimina a duplicação                                                                                                                                                                                                                   |
| `CampoDeMomento.tsx` e `.web.tsx`                                      | ícone à esquerda, exemplo em `campoExemplo`, anel de foco com o seletor aberto; herda a caixa de `useEstiloDaCaixa`                                                                                                                                                                                                                                |
| `Segmentos.tsx`                                                        | trilho cápsula 48, polegar 40, selecionado `quenteFundo`/`destaque`                                                                                                                                                                                                                                                                                |
| `ListaDeOpcoes.tsx`, `CaixaDeMarcar.tsx`                               | radio e caixa de 24, linha marcada com fundo quente                                                                                                                                                                                                                                                                                                |
| `Interruptor.tsx`                                                      | trilho próprio (3.3) no lugar do `Switch`                                                                                                                                                                                                                                                                                                          |
| `PilulasDeFiltro.tsx`                                                  | preenchimento tonal, altura 40                                                                                                                                                                                                                                                                                                                     |
| `BarraDeAcao.tsx`                                                      | `alturaDaBarraDeAcao` e `fimComBarraDeAcao` passam de `ALTURA.controle` (48) para `ALTURA.botao.grande` (56); intervalo 12                                                                                                                                                                                                                         |
| `EstilosDaWeb.web.tsx`                                                 | regra de autofill; `[data-campo]` no lugar de `[data-campo-de-acesso]`                                                                                                                                                                                                                                                                             |
| `apps/app/src/catalogo/Catalogo.tsx`                                   | 18 `Botao` e 15 campos do catálogo: mostrar todos os estados novos, nos dois temas                                                                                                                                                                                                                                                                 |
| Telas com altura fixa                                                  | revisar `funcionalidades/agenda/medidas.ts`, `TelaCheckin`, `BarraDoEvento`, `ComecePorAqui`, `PalcoDaEntrada` (usam `ALTURA.controle` ou `RAIO.controle`)                                                                                                                                                                                         |

Números do impacto: `<Botao` aparece 299 vezes em 119 arquivos e os campos 126 vezes em 59: **a mudança tem de acontecer dentro dos componentes, sem tocar nas telas**; qualquer ajuste de tela é só para absorver os +8 pt.

**Ordem sugerida** (um commit por etapa, `npm run verificar` verde em cada):

1. Tokens, pares de contraste e o teste de contraste (sem mexer em componente).
2. `Botao`, `BotaoIcone`, `ParDeBotoes`, `BarraDeAcao` e os testes de botão e de fim de tela.
3. `Campo`, `BlocoDoCampo`, `CampoDeAcesso` (como invólucro), `CampoDeMomento` e os testes de campo.
4. `BotaoDeAcesso` delegando a `aparenciaDoBotao`.
5. Vizinhos: `Segmentos`, `ListaDeOpcoes`, `CaixaDeMarcar`, `Interruptor`, `PilulasDeFiltro`, `BotaoDeLinha`.
6. Web (`EstilosDaWeb`), catálogo e recaptura das telas em `scripts/apresentacao/telas` nos dois temas.
7. Passada de telas para absorver as alturas novas.

**Testes que mudam:**

- `EstadosDosControles.test.tsx`: botão normal (raio 14 para cápsula, rótulo 15/20 para 16/20, `minHeight` 48), pressionado (agora por camada e escala com mola), desabilitado (fundo `quenteFundo`, texto `destaque` a 70%, em vez de tonal a 40%), destrutivo (de contorno para `erroFundo`), campo normal (48 para 56, raio 14 para 16, fundo e borda novos), foco (anel em camada, não borda mais sombra interna), desabilitado (sem tracejado), "nenhum estado usa opacidade".
- `Botao.test.tsx`: sem mudança de contrato; acrescentar `tituloCarregando` e `compacto`.
- `Campo.test.tsx`: "multilinha de 160" vira 164 em `leitura`; novos: cresce de 3 a 8 linhas, limpar, `invalido`, sucesso, autofill.
- `CampoDeAcesso.test.tsx`: deve continuar passando intacto (a fenda de 26, o "Mostrar" e as props são mantidos); é o teste que prova a compatibilidade do invólucro.
- `Segmentos.test.tsx`: alvo de 44 continua; `minHeight` do polegar 36 para 40.
- `FimDaTela.test.tsx`: `alturaDaBarraDeAcao` e `fimComBarraDeAcao` somam 8 a mais.
- `BotaoDeAcesso.test.tsx`: raio cápsula; contrato (56, 48 do terciário, balanço) intacto.
- `contraste.test.ts` (pacote de tokens): novos pares do apêndice A; o par antigo "campoBorda contra campoFundo" muda de valor (3,67 para 3,07), o piso 3:1 ainda vale.

---

## 5. Checklist de aceitação visual

1. Em qualquer tela, só **um** botão sólido coral; o resto é tonal ou texto. Nenhum botão com contorno.
2. Todos os botões e a barra de ação têm altura 56 ou 48 (40 só dentro de linha de lista) e são cápsulas.
3. O primário tem degradê, realce e brilho visíveis, e o texto continua legível em todo o botão (4,5:1 no pior ponto, nos dois temas).
4. Todo campo tem 56 pt, raio 16, fundo um degrau acima do cartão e borda neutra violeta de 1 pt que se vê sem esforço (3:1 ou mais).
5. O rótulo é mais forte que a ajuda; entre dois campos há 20 pt; rótulo e caixa ficam a 8 pt.
6. O exemplo se distingue do valor digitado à primeira vista (cor `campoExemplo`).
7. O foco é coral em tudo (botão, campo, segmento, interruptor); **não existe amarelo** no app. Funciona por teclado e por toque.
8. O erro mostra anel, ícone dentro do campo e frase embaixo; em tela cinza (sem cor) o erro continua inequívoco.
9. A área de texto começa com 3 linhas e cresce até 8; não sobra caixa escura vazia.
10. Dobrando a fonte do sistema (200%), nada corta nem sobrepõe: pares empilham, rótulos quebram, campos crescem. Com "Reduzir movimento", "Reduzir transparência" e "Aumentar contraste", todos os controles continuam completos.

---

## 6. Apêndice A: pares de contraste para o teste (calculados à mão)

Convenção: `texto` `#F5F3FF`, `fundo` `#12102A`, `superficie` (cartão) `#232139`, `superficieElevada` `#2B2848`; claro: `texto` `#1B1838`, `fundo` `#F7F5FF`, cartão `#FFFFFF`. "Composto" = a cor translúcida sobre o cartão.

| Par                                                                 | Escuro | Claro         | Mínimo |
| ------------------------------------------------------------------- | ------ | ------------- | ------ |
| `texto` / `campoFundo`                                              | 11,63  | 15,2          | 4,5    |
| `campoExemplo` / `campoFundo`                                       | 5,30   | 4,78          | 4,5    |
| `campoBorda` / `superficie`                                         | 3,75   | 3,72          | 3      |
| `campoBorda` / `fundo`                                              | 4,46   | 3,44          | 3      |
| `campoBorda` / `superficieElevada`                                  | 3,37   | 3,72          | 3      |
| `campoBorda` / `campoFundo`                                         | 3,07   | 3,32          | 3      |
| `foco` / `superficie`                                               | 6,73   | 4,92          | 3      |
| `foco` / `fundo`                                                    | 8,01   | 4,56          | 3      |
| `foco` / `campoFundo`                                               | 5,5    | 4,40          | 3      |
| `erro` / `campoFundo`                                               | 5,62   | 5,88          | 3      |
| `sucesso` / `campoFundo`                                            | 8,0    | 4,85          | 3      |
| `destaque` ("Mostrar") / `campoFundo`                               | 7,3    | 7,57          | 4,5    |
| `sobrePrimaria` / `primariaTopo`                                    | 9,08   | 4,74          | 4,5    |
| `sobrePrimaria` / `primariaBase`                                    | 8,13   | 5,55          | 4,5    |
| `sobrePrimaria` / `primariaPressionada`                             | 6,63   | 6,24          | 4,5    |
| `texto` / `botaoTonal` composto                                     | 10,2   | 14,1          | 4,5    |
| `texto` / `botaoTonalPressionado` composto                          | 8,6    | 12,7          | 4,5    |
| `erro` / `erroFundo` composto                                       | 5,13   | 5,43          | 4,5    |
| `destaque` / `superficie` (terciário)                               | 8,9    | 8,46          | 4,5    |
| `destaque` / `quenteFundo` no trilho (segmento)                     | 6,06   | 6,95          | 4,5    |
| `textoSuave` / trilho (segmento inativo)                            | 9,1    | 7,32          | 4,5    |
| `campoBorda` / `superficie` (interruptor desligado)                 | 3,75   | 3,72          | 3      |
| `primaria` / `superficie` (interruptor ligado)                      | 6,73   | 4,92          | 3      |
| `sobrePrimaria` / `primaria` (polegar ligado)                       | 8,13   | 4,92 (branco) | 3      |
| `destaque` 70% / `quenteFundo` (primário desabilitado, informativo) | 3,95   | 3,66          | n/a    |

Do ANTES, para comparação: borda do campo 3,67:1 sobre o campo e 3,32:1 sobre o cartão (passava, mas violeta e pesada); contorno do secundário 3,25:1; trilho do interruptor desligado 1,28:1 (falha para o desenho do controle).

## 7. Decisões em aberto para o dono

1. **Cápsula nos botões.** É a escolha que mais muda a cara do app. Alternativa conservadora: raio 18 (continua "retângulo arredondado", mas mais amigável que 14). Recomendo a cápsula: é a forma que o app já usa nas pílulas e na barra.
2. **Borda do campo.** Pediram campos "quase invisíveis" na borda. Medi: uma borda de 10 a 14% de branco dá cerca de 1,3:1 a 1,6:1 e reprova a regra de 3:1 que o `CLAUDE.md` exige. Resolvi tirando o que pesava (fundo afundado, violeta saturado, 14 de raio, foco amarelo) e deixando a borda no piso de 3:1. Se o dono quiser a borda realmente sumida, o caminho é o campo preenchido com linha de base de 2 pt (estilo Material), que também passa na regra, mas muda a forma do campo.
3. **Degradê, realce e brilho do primário.** Pacote de três; pode ficar só no degradê.
4. **Interruptor próprio.** Troca o `Switch` nativo por um desenho nosso (necessário no escuro, onde o nativo desligado some). Perde a sensação nativa do iOS.
5. **Não verificado:** o nome exato da propriedade de degradê no React Native 0.88 (`backgroundImage` ou `experimental_backgroundImage`): confirmar nos tipos antes de codar. A página HTML não foi aberta num navegador por mim (sem ferramenta de execução nesta sessão): vale uma olhada rápida.

---

## 8. O que foi feito (22/11/2026, D64)

Decisões do dono aplicadas, todas pela recomendação do especialista: **cápsula nos botões**, **borda do campo no piso de 3:1**, **interruptor com trilho próprio** e **degradê, realce interno e brilho do primário**. Registro em [DECISOES.md](../DECISOES.md) (D64). Sem commit, sem implantação, sem dependência nova, sem migração. Resolvido o ponto 5 acima: a propriedade do degradê no React Native 0.88 é `backgroundImage` (o tipo também declara `experimental_backgroundImage`, que não foi usada); o `react-native-web` a desenha.

### Tokens (`packages/tokens`)

- `cores.ts`: `Paleta` ganhou `primariaTopo`, `primariaBase`, `botaoTonal`, `botaoTonalPressionado`, `botaoTonalOpaco`, `campoExemplo`, `campoDesabilitado` e `focoHalo`; mudaram de valor `campoFundo`, `campoBorda` e `foco` (coral, igual à `primaria`, nos dois temas: o amarelo e o índigo do foco saíram). Os inversos herdam por espalhamento.
- `index.ts`: `ALTURA.botao` (56, 48, 40), `ALTURA.campo`, `ALTURA.areaDeTexto` (3 a 8 linhas: 100 e 210; leitura, 5 a 10: 164 e 294), `ALTURA.trilho` e `polegar` (48 e 40), `ALTURA.interruptorLargura` e `interruptorAltura` (52 e 32), `ALTURA.filtro` 40; `RAIO.campo` 16 e `RAIO.caixa` 8; `BORDA.anel` 2 e `HALO_DE_FOCO` 4; `TIPO.botao` 16/20 e `TIPO.campo` 16/22; `RITMO.entreCampos` 20; `ELEVACAO.botao` e `ELEVACAO.realceDoBotao` nos dois temas.
- `acesso.ts`: `MOVIMENTO_DOS_CONTROLES` (foco 160 e saída 120, toque 90, escala 0,98, espera do indicador 250 e os demais da tabela 3.4); `MOVIMENTO_DE_ACESSO` virou apelido dele, com o foco que passou de 140 e 100 para 160 e 120.
- `pares.ts`: 25 pares novos do apêndice A (função `paresDosControles`), mais o par do exemplo, que agora usa `campoExemplo`. **Todos passam nos dois temas com os valores do documento, sem ajuste de token.** Duas diferenças de medição, ambas acima do piso: o escolhido do segmento sobre o trilho translúcido (`tonal` composto no cartão) mede 4,96:1 no escuro, e o documento calculou 6,06:1 sobre o trilho opaco, que também está nos pares; e `foco` contra o inverso do escuro mede 4,49:1 (a cor de foco do claro sobre o cartão claro de destaque).

### Componentes (`apps/app/src/ui`)

- `aparenciaDoBotao.ts` (novo): a tabela única das variantes e estados (função pura, testada). `Botao.tsx`: cápsula, degradê `linear-gradient(180deg, primariaTopo, primariaBase)` por cima do sólido `primaria` (onde `backgroundImage` não desenha, vale o sólido), realce e brilho em `boxShadow`, camada de pressionado e de hover que só mudam de `opacity`, escala 0,98 com mola (`useToqueComMola`), anel de foco, carregando com indicador depois de 250 ms e `tituloCarregando`, largura travada, desabilitado em coral apagado com motivo e cadeado, `compacto`, botão encaixado ao lado de campo (altura 56 e raio do campo). `BotaoIcone` circular e tonal. `ParDeBotoes` com intervalo 12 e, empilhado, o primário em cima. Aumentar contraste: sem degradê nem sombra e com borda de 2; Reduzir transparência: `botaoTonalOpaco`; Reduzir movimento: sem escala nem mola.
- `BotaoDeAcesso.tsx` e `aparenciaDoAcesso.ts`: e-mail, Face ID e ação delegam a `aparenciaDoBotao`; Apple e Google ficam nas cores de marca, em cápsula de 56. `BotaoDeAcessoRapido.tsx` herda sem mudar. `BotaoDeLinha.tsx`: cápsula tonal de 40, sem contorno.
- `Campo.tsx`: caixa de 56 e raio 16, estados normal, foco, erro, sucesso, somente leitura e desabilitado; `AnelDoCampo` (anel e halo em camada, 160 ms na entrada e 120 na saída, 0 com Reduzir movimento); erro com anel permanente, ícone dentro da caixa e frase embaixo em `texto`; props novas `invalido`, `sucesso`, `prefixo`, `linhas`, `limpavel`, `apoio`, `aoLado`, `disparoDeErro`, `fenda` e `semEdicao`; "Mostrar" e "Ocultar" em palavra; área de texto que cresce de 3 a 8 linhas (no celular pelo próprio `TextInput`; na web por `field-sizing: content`, conferido de 98 a 208 e de volta a 98) com contador que ganha peso e alerta a partir de 90% e vira erro no limite; `BlocoDoCampo` com rótulo em `texto` 600 e 8 de intervalo. `CampoDeBusca` na mesma caixa.
- `CampoDeAcesso.tsx`: invólucro fino do `Campo` (a fenda de 26, o "Mostrar", `apoio`, `aoLado` e `disparoDeErro` vêm do `Campo`); o teste dele passou intacto. A entrada com erro de credencial agora acende o anel nos dois campos (`invalido`), o achado de `login-15-erro`.
- `CampoDeMomento.tsx` e `.web.tsx`: ícone à esquerda, exemplo em `campoExemplo`, anel ligado com o seletor aberto; na web, "Escolher data" no lugar do "dd/mm/aaaa" e o seletor do navegador cobrindo a caixa toda.
- Vizinhos: `Segmentos` (trilho e polegar em cápsula, 48 e 40, escolhido em `quenteFundo` e `destaque`), `ListaDeOpcoes` e `CaixaDeMarcar` (24; faixa quente de cantos redondos na linha marcada), `Interruptor` (trilho de 52 por 32, desligado vazado com borda de 2 em `campoBorda`, ligado em `primaria` com check, polegar com mola), `PilulasDeFiltro` (tonal, 40, alvo 48), `BarraDeAcao` (botões de 56, intervalo 12, motivo com cadeado) e `Chip` sem mudança. `EstilosDaWeb.web.tsx`: `[data-campo]` no lugar de `[data-campo-de-acesso]`, autofill sem o amarelo do navegador, hover da caixa e seletor de data.
- Catálogo (`catalogo/Catalogo.tsx`): compacto, título de carregando, `invalido`, sucesso, prefixo, limpar, erro com foco, contador perto e no limite, interruptor desligado.
- Infra de teste: `jest.setup.ts` neutraliza o dublê do Reanimated que o `expo-router/testing-library` instala (virava `{}` e derrubava o botão e o campo, que agora animam).

### Testes

Novos ou reescritos: `EstadosDosControles`, `Campo`, `OutrosControles` (interruptor, botão de ícone, botão de linha, par, pílula, rádio e caixa de marcar), `Segmentos`, `BotaoDeAcesso`, `CampoDeMomento`, `FimDaTela` e, nos tokens, `controles.test.ts` (medidas, cores e os pares do apêndice A nos dois temas). Os números do `npm run verificar` estão no fim do STATUS.

### Capturas

`scripts/apresentacao/capturas-dos-controles.ts` gera `scripts/apresentacao/telas/controles-*.jpg` a partir da prévia local: entrada no iPhone SE (375 por 667, cabe sem rolar, com foco e com erro), criar conta, novo pedido de oração, nova programação (com e sem rolar até a barra de ação), convidar, procurar comunidade e perfil, no escuro e no claro, mais `controles-area-de-texto-cresce.jpg`.

### O que ficou de fora ou diferente do documento

1. **Limpar** aparece enquanto há texto, não só com foco: na web e no toque o campo perde o foco antes do clique chegar ao botão, e o botão sumiria no meio do toque.
2. **Segmento escolhido** troca por dissolver (200 ms; 120 com Reduzir movimento), não desliza: o polegar de cada opção é uma camada que só muda de `opacity`.
3. **Hover** do botão (web, 120 ms) e da caixa do campo (CSS) existem só com o ponteiro, e a camada de hover não tem par de contraste próprio além dos do apêndice.
4. **Espaço entre campos:** o `Campo` ganhou 4 de folga embaixo (de 16 a 20 entre blocos nas telas de hoje), mas o intervalo de 20 de `RITMO.entreCampos` não foi imposto nas cerca de 60 telas com campo: cada tela decide o próprio `gap`. Nenhuma tela foi alterada para isso.
5. **Autofill:** o `Campo` liga `importantForAutofill` quando a tela declara `autoComplete` ou `textContentType`; as telas fora da entrada não foram revisadas para declarar (só as da entrada já declaravam).
6. **Passada de telas (item 7 da ordem sugerida):** nenhuma tela precisou de mudança para absorver os +8 pt, fora `PainelDeEmail` (`invalido`). Conferido nas capturas web; barra de ação, formulário longo e teclado em aparelho não foram conferidos.
7. **Fonte grande do sistema:** só por teste (o par empilha com o primário em cima; alturas mínimas e não fixas). Não há captura com 200%.
8. O catálogo (`/_catalogo`) só existe em desenvolvimento (`__DEV__`): foi atualizado, mas não está nas capturas da web exportada.
9. **Desempenho:** cada `Botao` agora cria quatro valores compartilhados (camada, escala, hover, indicador). Sem medida no Profiler; em listas com muitos botões vale medir em aparelho médio.
10. **Não verificado em aparelho:** o degradê, o brilho e o realce no iOS e no Android (a web foi conferida), `boxShadow` com `overflow: hidden` no Android, VoiceOver e TalkBack, Aumentar contraste, Reduzir transparência e o teclado sobre os campos.
