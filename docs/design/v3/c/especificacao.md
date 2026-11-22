# Direção C: Editorial ousado

Data: 22/11/2026. Base: `docs/design/app-v3-ux.md` (estrutura, textos, estados e movimento fixos pelo contrato da seção 9.3). Protótipo: `docs/design/v3/c/prototipo.html`.

## O que eu fiz e o que não verifiquei

- **Li:** o documento de UX v3 inteiro (seções 1 a 9), `packages/tokens/src` (`cores.ts`, `index.ts`, `acesso.ts`), `apps/app/src/ui` (lista de componentes, `fontes.ts`, `geometriaDoSol.ts`) e as capturas `23-inicio-membro`, `04-agenda`, `10-checkin` e `controles-perfil-claro`.
- **Não abri o protótipo em navegador nem em aparelho.** Esta sessão não tinha terminal nem navegador. O HTML foi escrito e revisado por leitura do código (chaves de CSS conferidas por busca, JS relido inteiro). Antes de mostrar ao dono, abrir uma vez e passar pelos 12 itens da seção 14.
- **As razões de contraste foram calculadas à mão** com a fórmula do WCAG 2.2 (luminância relativa de cada hex). Uma casa decimal, arredondada para baixo quando perto do limite. Rodar `contraste.test.ts` com a paleta nova antes de aceitar (seção 13).
- **Alturas "cabe em 720 pt"** são estimativas de CSS, não medições em aparelho.
- **Mola:** o protótipo aproxima as molas `toque` e `check` com `cubic-bezier(.34,1.56,.64,1)`. No app valem as molas do Reanimated.

## 1. Conceito em 5 linhas

1. **Revista de sábado.** Cada tela é uma página: título grande em serifa, régua grossa entre seções, e o número manda (28, 16:00, 9 de 15).
2. **Cor em bloco chapado, uma por vez.** Sol pede ação ou mostra a sua parte, Girassol avisa e agradece, Ultramar diz que está acontecendo. Sem vidro, sem brilho, sem degradê.
3. **O sol da marca vira forma recortada:** meia-lua com 5 raios, cortada pela borda do cartão. Cinco poses contam o estado do sábado.
4. **Papel quente e tinta.** Neutros com viés quente e contraste alto por padrão: a pessoa de 55 anos lê tudo sem esforço, e a de 17 anos vê personalidade.
5. **Movimento curto, com função, só `opacity` e `transform`.** O ritmo vem do corte entre blocos, não de efeito.

## 2. Qual tema é o principal, e por quê

**O principal é o claro (papel).** Razões ligadas ao produto:

- O app é lido em pé, de dia e no sábado à tarde (encontro às 16:00). Papel com tinta é o caso de leitura mais fácil para quem tem 55 anos ou usa fonte grande.
- Bloco de cor chapada com texto escuro só segura contraste alto sobre fundo claro: tinta sobre Sol dá 6,2:1. Sobre fundo escuro, o mesmo bloco ofusca.
- Hoje o app abre no escuro (Aurora noite). A direção C inverte a hierarquia, e isso muda as capturas de loja e a primeira impressão. É decisão do dono (seção 13).

**O escuro é um par fiel, não uma inversão.** Mesmo layout, mesmos blocos e mesmas regras. O que muda:

- O papel vira preto quente `#17130F` e o texto vira creme `#F3EBDC`.
- Os blocos continuam luminosos e **continuam levando tinta escura por cima** (`#17130F`). Por isso o Ultramar do escuro é um periwinkle claro `#8C96FF` com texto escuro, e não o azul profundo do claro com texto branco. Azul saturado e escuro sobre preto vibra e perde 3:1.
- O Sol sobe de `#FF6B3D` para `#FF8A5C` e o Girassol de `#F2B700` para `#F2BE3A`. A saturação cai um pouco para não vibrar sobre preto.
- A tinta sobre Sol sobe de 6,2:1 para 8,0:1: o escuro lê melhor que o claro nos blocos.

O tema segue o sistema por padrão. O protótipo abre no tema do sistema e tem o botão de troca fora da moldura.

## 3. Tokens (claro e escuro)

Nomes em português, na mesma lógica de `Paleta` em `packages/tokens/src/cores.ts`. A coluna "campo atual" diz onde o valor entra.

| Token          | Claro                | Escuro                  | Uso                                                         | Campo atual de `Paleta`                                            |
| -------------- | -------------------- | ----------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| papel          | `#F4EEE1`            | `#17130F`               | fundo da tela                                               | `fundo`                                                            |
| cartão         | `#FFFBF2`            | `#221D18`               | folha, campo, barra de abas, cartão sem cor                 | `superficie`, `superficieElevada`, `campoFundo`                    |
| papel 2        | `#E7DFCD`            | `#332C25`               | chip neutro, esqueleto, botão desabilitado                  | `neutroFundo`, `esqueleto`, `campoDesabilitado`, `botaoTonalOpaco` |
| tinta          | `#1D1915`            | `#F3EBDC`               | texto, contorno, régua de seção                             | `texto`, `contorno`                                                |
| tinta suave    | `#5B5147`            | `#B8AD9C`               | meta, rótulo, aba inativa, exemplo do campo                 | `textoSuave`, `campoExemplo`                                       |
| Sol            | `#FF6B3D`            | `#FF8A5C`               | bloco do momento, botão primário, aba ativa                 | `primaria`, `abaAtivaFundo`                                        |
| Girassol       | `#F2B700`            | `#F2BE3A`               | aviso fixado, aguardando, chip de destaque                  | `quenteFundo`, `alertaFundo`                                       |
| Ultramar       | `#2B35D1`            | `#8C96FF`               | "acontecendo agora", avatar, ladrilho                       | `info` (fundo)                                                     |
| link           | `#2B35D1`            | `#A9B1FF`               | link, acorde da cifra                                       | `destaque`                                                         |
| verde          | `#0B6B43`            | `#6FE0A4`               | confirmado, presente, sucesso                               | `sucesso`                                                          |
| verde fundo    | `#CDEBD9`            | `#1E3A2B`               | chip confirmado                                             | `sucessoFundo`                                                     |
| erro           | `#B3261E`            | `#FF9A8F`               | erro, "Sair"                                                | `erro`, `erroCheio`                                                |
| erro fundo     | `#F9D6D0`            | `#4A1F1B`               | bloco de erro                                               | `erroFundo`                                                        |
| ink            | `#1D1915`            | `#17130F`               | texto fixo sobre Sol e Girassol, fundo do botão sobre bloco | `sobrePrimaria`                                                    |
| pap            | `#F4EEE1`            | `#F3EBDC`               | texto fixo sobre botão ink                                  | (novo)                                                             |
| borda de campo | `#5B5147`            | `#8F8576`               | contorno do campo (3:1)                                     | `campoBorda`                                                       |
| régua de linha | `rgba(29,25,21,.22)` | `rgba(243,235,220,.22)` | separador de linha (decorativo)                             | `separador`                                                        |
| véu            | `rgba(29,25,21,.55)` | `rgba(0,0,0,.62)`       | atrás da folha                                              | `veu`                                                              |
| foco           | `#1D1915`            | `#F3EBDC`               | anel de foco 3 pt com 2 de afastamento                      | `foco`                                                             |

Regras de uso, que valem como lint:

- **Três cores vibrantes, nunca mais.** Sol, Girassol e Ultramar. Verde e erro são semânticos e só aparecem em chip, ícone e texto, nunca como bloco grande (exceção: o fundo do deslizar, verde).
- **Nunca texto branco sobre Sol ou Girassol.** Branco sobre Sol dá 2,8:1. Sobre Sol e Girassol, sempre `ink`.
- **Texto secundário é `tinta suave`** (6,7:1 ou mais). Não existe cinza claro, nem texto com transparência.
- **Dentro de bloco colorido** o foco usa `ink` (no Ultramar claro, branco).
- Sem sombra, sem blur, sem degradê. O único `box-shadow` do protótipo é a moldura do celular, fora do app.
- O mesmo bloco muda por tema só pelos tokens. Nenhum valor de cor no componente.

### Cor do cartão do momento por estado

| Estado                               | Bloco                        | Primário dentro do bloco                             | Motivo                               |
| ------------------------------------ | ---------------------------- | ---------------------------------------------------- | ------------------------------------ |
| Longe, véspera, no dia (e pendência) | Sol                          | ink                                                  | o Sol é a cor de "isto é seu"        |
| Acontecendo agora                    | Ultramar                     | claro: Girassol com ink. Escuro: ink com texto creme | única cor fria do app: marca "agora" |
| Terminou (membro e líder)            | Girassol                     | ink                                                  | agradecimento                        |
| Nada marcado, rascunho (líder)       | cartão com contorno de tinta | Sol com borda ink                                    | ainda não é um sábado                |

A forma, a posição e a ordem dos blocos não mudam entre estados (risco R2 do UX). Só mudam a cor, a etiqueta e o botão.

## 4. Contraste (calculado à mão, WCAG 2.2)

Mínimos: 4,5:1 para texto, 3:1 para componente e foco. "Escuro" repete o par com os tokens do escuro.

| Par                                       | Onde                                                        | Claro   | Escuro        | Mínimo |
| ----------------------------------------- | ----------------------------------------------------------- | ------- | ------------- | ------ |
| tinta sobre papel                         | texto corrente                                              | 15,1    | 15,5          | 4,5    |
| tinta sobre cartão                        | folha, campo, barra de abas                                 | 16,9    | 14,0          | 4,5    |
| tinta sobre papel 2                       | chip neutro                                                 | 13,1    | 11,5          | 4,5    |
| tinta suave sobre papel                   | meta, rótulo                                                | 6,7     | 8,3           | 4,5    |
| tinta suave sobre cartão                  | aba inativa, exemplo do campo                               | 7,5     | 7,5           | 4,5    |
| tinta suave sobre papel 2                 | botão desabilitado                                          | 5,8     | 6,2           | 4,5    |
| ink sobre Sol                             | cartão do momento, botão primário, aba ativa                | 6,1     | 7,9           | 4,5    |
| ink sobre Sol pressionado (camada de 16%) | botão primário pressionado (`#DB5E37` e `#DA7750`)          | 4,6     | 5,8           | 4,5    |
| ink sobre Girassol                        | aviso fixado, chip aguardando, cartão "Terminou"            | 9,6     | 10,7          | 4,5    |
| texto sobre Ultramar                      | cartão "Acontecendo" (branco no claro, ink no escuro)       | 8,2     | 6,9           | 4,5    |
| Girassol sobre Ultramar                   | botão primário no cartão "Acontecendo" (componente)         | 4,5     | n/a (usa ink) | 3      |
| ink sobre Ultramar                        | botão primário no cartão "Acontecendo" (componente)         | n/a     | 6,9           | 3      |
| link sobre papel                          | link, acorde                                                | 7,1     | 9,1           | 4,5    |
| link sobre cartão                         | link em folha                                               | 8,0     | 8,2           | 4,5    |
| verde sobre verde fundo                   | "Confirmado", "Presente"                                    | 5,1     | 7,6           | 4,5    |
| verde sobre papel                         | ícone e texto de sucesso                                    | 5,6     | 11,3          | 4,5    |
| erro sobre erro fundo                     | bloco de erro, chip                                         | 4,8     | 6,8           | 4,5    |
| erro sobre papel                          | "Sair", mensagem de erro                                    | 5,6     | 9,0           | 4,5    |
| branco sobre verde / ink sobre verde      | avatar verde, ladrilho                                      | 6,5     | 11,3          | 4,5    |
| branco sobre erro / ink sobre erro        | botão "Cancelar o encontro"                                 | 6,5     | 9,0           | 4,5    |
| pap sobre ink                             | botão sobre bloco, selo do sino, toast                      | 15,1    | 15,5          | 4,5    |
| Desfazer sobre o toast                    | Girassol sobre tinta (claro), Ultramar sobre creme (escuro) | 9,5     | 6,9           | 4,5    |
| borda de campo sobre papel                | campo (componente)                                          | 6,7     | 5,0           | 3      |
| borda de campo sobre cartão               | campo em folha (componente)                                 | 7,5     | 4,6           | 3      |
| contorno de tinta sobre papel             | botão secundário, polegar, chips de filtro (componente)     | 15,1    | 15,5          | 3      |
| anel de foco sobre papel                  | foco (componente)                                           | 15,1    | 15,5          | 3      |
| anel de foco `ink` sobre Sol              | foco dentro do bloco                                        | 6,1     | 7,9           | 3      |
| Sol sobre papel, sem borda                | só o preenchimento do primário                              | **2,4** | 7,9           | 3      |
| Palco: creme `#F8F1E3` sobre `#0E0B09`    | letra no modo palco                                         | 17,4    | 17,4          | 4,5    |
| Palco: acorde `#FFC629` sobre `#0E0B09`   | acorde no modo palco                                        | 12,5    | 12,5          | 4,5    |
| Palco: `#CFC4B1` sobre `#0E0B09`          | título de bloco no palco                                    | 11,3    | 11,3          | 4,5    |

**A linha em negrito é o único par abaixo do mínimo, e foi resolvido por forma:** no claro, Sol sobre papel dá 2,4:1, por isso todo botão primário em fundo de papel e a pílula da aba ativa têm borda de `ink` de 2 pt (15,1:1). Sobre bloco Sol o primário é ink, sem esse problema. Os blocos coloridos não precisam de 3:1 contra o fundo porque o que o leitor precisa está no texto dentro deles.

O modo palco é sempre escuro nos dois temas (tela de uso no palco, D do modo músico).

## 5. Tipografia

| Papel            | Fonte e peso                    | Tamanho / entrelinha (pt)             | Teto de escala                | Onde                                                             |
| ---------------- | ------------------------------- | ------------------------------------- | ----------------------------- | ---------------------------------------------------------------- |
| Número do cartão | Fraunces 900                    | 84 / 76, espaçamento -0,04 em         | 1,3                           | "28" no cartão do momento                                        |
| Contador         | Fraunces 900                    | 64 / 61                               | 1,3                           | "9 de 15" do Check-in                                            |
| Cronômetro       | Inter 800, algarismos tabulares | 80 / 80                               | 1,3                           | Ao vivo                                                          |
| Dia da linha     | Fraunces 900                    | 52 / 49                               | 1,3                           | número da linha da Agenda                                        |
| Título de tela   | Fraunces 900                    | 44 / 45 (saudação do Início: 40 / 41) | 1,3                           | Agenda, Comunidade, Perfil, Encontro                             |
| Título do cartão | Fraunces 900                    | 32 / 33                               | 1,3                           | "Sábado Jovem" no cartão                                         |
| Seção            | Fraunces 800                    | 26 / 29                               | 1,3                           | "Para responder", "Roteiro"                                      |
| Corpo            | Inter 400 e 500                 | 17 / 25                               | 2,0                           | texto corrente, linha de parte                                   |
| Meta             | Inter 500                       | 15 / 21                               | 2,0                           | data, local, apoio                                               |
| Etiqueta         | Inter 800, espaçamento 0,06 em  | 14 / 17                               | 2,0                           | `EM 5 DIAS`, `AGORA` (o texto já vem em maiúsculas do documento) |
| Botão            | Inter 800                       | 16 / 18 (grande: 17)                  | 2,0                           | todos os botões                                                  |
| Aba              | Inter 600, ativa 800            | 14                                    | **15 pt fixos acima de 1,07** | barra de abas                                                    |
| Cifra            | Inter 500, acorde 800           | 19 / 28 (acorde 17,5)                 | 2,0                           | letra e acorde; `A-` e `A+` mudam de 15 a 40                     |

Regras:

- **Fraunces só em 26 pt ou mais.** Abaixo disso a serifa de peso 800 perde as contraformas. Todo texto menor é Inter.
- **Mínimo de 14 pt em qualquer texto que informa.** Corpo em 17.
- **Números em coluna (horário do roteiro, cronômetro, contador que troca de dígito) usam Inter com algarismos tabulares.** Fraunces tem algarismos proporcionais por padrão, e eu não confirmei se a família tem o recurso `tnum`. Fraunces fica só nos números que não mudam de largura ao vivo (o "28" do cartão, o dia da Agenda, o "9" do contador, que troca por dissolução).
- Peso, não tamanho, faz a hierarquia: o título do cartão (32) e a meta (16 em 700) se separam por serifa, peso e cor de bloco.
- **Fonte grande:** o tamanho de texto cresce de 1,0 a 2,0 (linear). Os tamanhos de exibição param em 1,3 (84 pt chega a 109 pt). Acima de 1,35 os botões em par empilham, os segmentos e as três abas do Encontro viram lista vertical e o número do cartão desce para baixo do título.
- **Fontes e licença:** Fraunces (variável, eixos `opsz`, `wght`, `SOFT`, `WONK`) e Inter. As duas em SIL Open Font License 1.1, grátis, uso comercial e embutido no app permitido. Inter já está no app (400, 500, 600). Entram Fraunces 800 e 900 e Inter 800. Pacote esperado: `@expo-google-fonts/fraunces` (confirmar o nome e os arquivos no `npm view` antes de instalar). Bricolage Grotesque sai.
- **Fallback real:** `Fraunces, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif` e `Inter, system-ui, "Segoe UI", Roboto, Arial`. Sem internet na primeira abertura, o protótipo cai em Georgia e o título fica mais largo: o layout aceita quebra de linha por isso.

**Por que serifa:** o assunto é uma comunidade de fé com agenda semanal, e a serifa macia (`SOFT` 100) de Fraunces traz calor de revista sem parecer igreja antiga. Combinada com Inter, separa "o que é título e número" de "o que é informação". Sozinha, a Bricolage em 800 (a fonte de hoje) é expressiva, mas não muda o ritmo da tela.

## 6. Formas, espaço, borda

- **Escala de espaço:** 4, 8, 12, 16, 20, 24, 32, 40, 48. Margem lateral 20. Entre seções 24. Padding de bloco 18.
- **Raios:** 8 (caixa de marcar), 14 (botão, campo, linha tocável), 20 (bloco pequeno), 24 (bloco "Sua parte", cartão da pessoa), 28 (cartão do momento, folha), 999 (chip, pílula, avatar). Nenhum outro raio.
- **Borda:** 2 pt em todo componente de interface (botão secundário, campo, pílula, polegar, aba ativa). Régua de seção 3 pt em `tinta`. Régua de linha 1,5 pt em `régua de linha`. Com "Aumentar contraste", a régua de linha vira `tinta` de 2 pt.
- **Alturas:** botão grande 56, botão 48, botão médio 44, linha de lista 72 (mínimo), linha do Check-in 72, barra de abas 88 (com 20 de área segura), cabeçalho 62.
- **Sem sombra.** Profundidade vem de cor de bloco, borda e régua.
- **Reduzir transparência:** não há nada a desligar. Nenhuma superfície do app tem transparência ou desfoque (a barra de abas e a folha são opacas). A decisão D32 (tinta translúcida do cartão) deixa de existir nesta direção.

## 7. Ícones

- Traço de **2,5 pt** em grade de 24, pontas e junções redondas, sem preenchimento (o ícone da aba ativa sobe para 3 pt). Tamanhos: 18 (dentro de chip), 24 (padrão), 26 (aba), 28 (sino, ladrilho de linha).
- O protótipo traz 33 ícones desenhados na mesma grade: casa, calendário, pessoas, perfil, sino, setas, check, x, mais, compartilhar, pino, relógio, QR, lupa, subir, descer, fixo, aviso, vela, cadeado, escudo, ajuda, sair, sem internet, alerta, soma, música, livro, play, pausa, lista.
- **Ladrilho de linha de Perfil e Comunidade:** quadrado de 52 com raio 16, borda de tinta 2 pt e fundo em uma das cinco cores (Sol, Girassol, Ultramar, verde, papel 2). A cor decora, o ícone e o rótulo informam.
- Nenhum ícone é a única informação: `✓` vem com "Confirmado", relógio com "Aguardando sua resposta", alerta com "Passou 3 min".
- Implementação: o `IconeDeTraco.tsx` já é de traço. A mudança é a espessura e os glifos novos. Nenhum emoji.

## 8. As 5 poses do sol

Desenho único: meia-lua de raio 50 com 5 raios arredondados (de 150 a 30 graus, de 66 a 98 de distância do centro), duas barras de horizonte (184 x 10 e 112 x 10), tudo em quadro 240 x 160. É a geometria do `geometriaDoSol.ts` (corpo em semicírculo, 5 raios, duas barras) simplificada. O corpo e os raios são cortados no horizonte por uma máscara, e a pose é só um deslocamento vertical, o que permite animar de uma pose a outra.

| Pose | Nome               | Construção                                                 | Onde aparece                                                               | Tamanho  |
| ---- | ------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------- | -------- |
| 1    | Atrás do horizonte | corpo desce 40, só uma faixa de 10 aparece, raios apagados | Início sem encontro, Agenda vazia, Check-in vazio                          | 168      |
| 2    | Meio nascido       | corpo desce 22, raios apagados                             | Avisos vazios, Sino vazio, roteiro vazio, "Só o que é meu" vazio, rascunho | 168      |
| 3    | Inteiro            | corpo e 5 raios no lugar                                   | "Tudo em dia", cartão do momento (recortado), "Terminou"                   | 56 a 190 |
| 4    | Com vela           | pose 3 mais uma vela de 20 x 30 com chama                  | Pedidos de oração vazios                                                   | 168      |
| 5    | Com pessoas        | pose 3 mais duas cabeças com ombros                        | Pessoas vazio                                                              | 168      |

- **No cartão do momento o sol é recortado:** a pose 3 sem as barras, em 190 de largura, no canto superior direito (`top: -30`, `right: -6`), em tom contrário ao bloco (Girassol sobre Sol, Sol sobre Girassol). A borda do cartão corta os raios de cima. O numeral "28" fica sobre a meia-lua: tinta sobre Girassol dá 9,6:1 e sobre Sol 6,1:1.
- **Fora de bloco** (estado vazio): corpo em Sol, raios e barras em tinta, contorno de 4 em tinta no corpo. Decorativa, escondida do leitor de tela, sem texto dentro. Parada, exceto no momento 4 de encanto.
- Nunca em linha ou seção, só em tela inteira vazia ou de primeira vez (UX 5.6).

## 9. Componentes

### Barra de abas

- Faixa opaca de 88 de altura, cor cartão, régua de 2 pt de tinta em cima (não flutua, não tem vidro). Quatro itens iguais com ícone de 26 e rótulo.
- **Aba ativa:** um bloco Sol de 60 de altura com raio 18 e borda de tinta 2 pt, atrás do ícone e do rótulo (ink, peso 800, ícone com traço 3). A cor sozinha não identifica: peso, traço e borda também.
- **Pílula deslizante:** o bloco é um único elemento que anda de uma aba à outra com `translateX` (250 ms, mola).
- Rótulo 14 pt, sobe até 15 pt com fonte grande e para aí. Se "Comunidade" não couber a 15 pt em 390 de largura, usar o visualizador de conteúdo grande do iOS (a verificar no aparelho).
- Estados: repouso, ativa, foco (anel de tinta 3 pt), pressionado (escala 0,98 e camada de 16%), oculta (nas telas empilhadas, desce 100% em 250 ms).

### Cartão do momento

- Bloco de 28 de raio, padding 18, uma cor por estado (seção 3), altura de cerca de 293 pt no membro com pendência e 330 no líder (estimado).
- Ordem fixa dentro dele: etiqueta (chip de tinta), título (Fraunces 32), data e hora (Inter 16 em 700), onde com "Como chegar" (link de 44 pt), régua, "Sua parte" e chip de estado, e os botões. O numeral e o sol ficam à direita, sem empurrar o texto (o texto tem 108 de respiro à direita).
- Estados do cartão cobertos no protótipo: membro (pendente, confirmado, sem parte, véspera, no dia, acontecendo, terminou, sem encontro, erro, sem internet com `Última versão: hoje, 14:32`) e líder (nada marcado, rascunho, falta responder, véspera, no dia, acontecendo, terminou).
- Pendente: o chip "Aguardando sua resposta" tem **borda tracejada e ícone de relógio**, para não depender de cor.

### Linha de lista (Agenda, Para responder, Check-in)

- **Agenda:** dia em Fraunces 52 à esquerda, título Inter 20 em 800, hora e local em meta, linha `Você: Louvor · Vocal ✓` ou chip de pendência, botão `Mais` de 48. Régua de linha entre itens, nenhuma caixa em volta (menos borda, mais espaço).
- **Para responder:** 72 de altura, nome e data à esquerda, `Aceitar` e `Não posso ir` de 44 à direita (empilham com fonte grande). O deslizar para a direita mostra um fundo verde com ícone e a palavra `Aceitar`; o deslizar para a esquerda mostra `Não posso ir` e só envia ao tocar.
- **Check-in:** a linha inteira (72) é o botão. À direita, `Chegou` (contorno de tinta de 2 pt, 44 de altura) ou o chip `✓ Presente` (verde sobre verde fundo). Marcado vira chip com escala 0,9 a 1.
- Estados: repouso, pressionado, foco, marcado, erro (mensagem em vermelho com ícone sob a linha), desabilitado (borda tracejada e motivo escrito).

### Chip

- Altura mínima 28, raio 999, Inter 14 em 700. Neutro (papel 2), confirmado (verde sobre verde fundo, com check), aguardando (Girassol com borda tracejada e relógio), destaque (Girassol), erro (erro sobre erro fundo, com ícone).
- Dentro de bloco colorido o chip vira cartão com texto de tinta e a etiqueta vira ink com texto pap.

### Esqueleto

- Forma final, nas alturas do documento: cartão de 293 (não os 190 do documento, porque o cartão da direção C é maior), linhas de 72 e 64, Agenda 3 x 88, Check-in contador mais 6 x 72.
- Cor papel 2, raio 14. Aparece depois de 300 ms (fade de 160 ms), pulsa de opacidade 1 para 0,5 em 1200 ms. Com Reduzir movimento, fica estático.

### Toast com Desfazer

- Bloco de `tinta` com texto `papel` (no escuro, bloco creme com texto escuro), raio 16, a 96 pt do fundo para ficar acima da barra de abas ou da barra de ação.
- Texto, contagem em texto (`10 s`, `9 s`...), botão `Desfazer` de 44 (borda e texto Girassol no claro, Ultramar no escuro) e uma barra de 5 pt na base que encolhe de 100% a 0 em 10 s (`scaleX`, linear). Com Reduzir movimento a barra some e a contagem em texto continua.
- O leitor de tela anuncia uma vez `Desfazer disponível por 10 segundos`. Um toast novo confirma o anterior na hora.

## 10. Telas, de acordo com o protótipo

Todas seguem a ordem e os textos do UX v3 (seções 3 e 8). O que esta direção decidiu:

- **Início:** saudação em Fraunces 40, versículo em linha fina, cartão do momento (bloco de cor), `Para responder` com régua grossa, `Seu resumo` como acordeão entre duas réguas, `Aviso fixado` como faixa Girassol com borda de tinta.
- **Agenda:** título 44, segmento `Todos / Só o que é meu` com polegar de tinta, `Pedem ajuda` em caixa com borda, grupos com título Fraunces 26 e régua de 3 pt.
- **Encontro:** título 44, `Sua parte` em bloco Sol, hora em Fraunces 56, roteiro em linhas, três abas sublinhadas para a liderança (traço de 4 pt que desliza) e barra fixa `Mais` e primário.
- **Comunidade:** ações rápidas lado a lado, mural Girassol com o aviso fixado, linhas com ladrilho colorido, `Organização` em acordeão.
- **Perfil:** cartão da pessoa com avatar de 72 e nome em Fraunces 28, cinco linhas com ladrilho (mais o cartão da pessoa, são as 6 linhas do UX) e `Sair` em texto com ícone (`Toque de novo para sair`, 4 s). A linha `Plataforma` só existe para o Criador, que o seletor "ver como" do protótipo não inclui.
- **Check-in, Ao vivo, Repertório, Cifra, Palco, Sino:** como no documento, com contador de 64, cronômetro de 80, bloco Ultramar para "AGORA", cifra com acorde em negrito e na cor de link (negrito, para a cor não ser o único sinal).

Textos que o protótipo acrescenta e que **não estão no UX** (para o dono aprovar ou cortar): a dica `Deslize a linha para a direita para aceitar.` sob `Para responder`, o rótulo `Ver menos` no roteiro aberto, os chips `feita` e `agora` no Ao vivo, os títulos `Novas` e `Antes` e o chip `Nova` no Sino, o chip `você` do roteiro (o documento escreve `você` na linha do Louvor) e `Esta tela não faz parte do protótipo.`.

Divergências do documento que eu resolvi (pontos a confirmar):

- A etiqueta do líder em `Longe` é `EM 5 DIAS` (tabela 3.2), e não `SÁBADO QUE VEM · EM 5 DIAS` (wireframe).
- Em "Meu repertório" o chip diz `Sua parte: Vocal` (a pessoa do protótipo é a Carla, do vocal) e não `Violão` como no wireframe.
- O `Seu resumo` do membro conta as pendências **além** da do cartão (como no wireframe: `1 coisa esperando você`). Assim, aceitar o cartão não zera o resumo.
- O ✓ de `Confirmado` fica visível por cerca de 760 ms antes de a linha reorganizar, para ser lido. O documento fala em encolher a linha em 200 ms.

## 11. Movimento

Só `opacity` e `transform`. Curvas do app: `saida` (0,22, 1, 0,36, 1), `padrao` (0,4, 0, 0,2, 1), `saidaDeTela` (0,4, 0, 1, 1), `mola` aproximada por (0,34, 1,56, 0,64, 1). Com Reduzir movimento toda linha vira dissolução de 120 ms ou troca na hora, e nenhum movimento carrega informação que o texto não tenha.

| Gatilho                                                                | Propriedade                                                                                        | Duração                                   | Curva                 | Com Reduzir movimento                               |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------- | --------------------------------------------------- |
| Trocar de aba, tela nova                                               | opacity 0 para 1                                                                                   | 160 ms                                    | padrao                | 120 ms, igual                                       |
| Trocar de aba, bloco da aba ativa                                      | transform translateX de uma aba à outra                                                            | 250 ms                                    | mola                  | troca sem deslizar                                  |
| Abrir encontro (empurrar)                                              | tela nova translateX 100% para 0; tela de baixo 0 para -24%                                        | 350 ms                                    | saida                 | dissolução de 120 ms                                |
| Voltar                                                                 | tela do alto translateX 0 para 100%; a de baixo -24% para 0                                        | 300 ms                                    | padrao                | dissolução de 120 ms                                |
| Barra de abas some e volta nas telas empilhadas                        | transform translateY 0 para 100%                                                                   | 250 ms                                    | padrao                | some por opacity                                    |
| Abrir folha                                                            | folha translateY 100% para 0; véu opacity 0 para 1                                                 | 350 ms; 200 ms                            | saida; padrao         | dissolução de 120 ms                                |
| Fechar folha                                                           | folha translateY 0 para 100%; véu 1 para 0                                                         | 250 ms                                    | saidaDeTela           | dissolução de 120 ms                                |
| Entrada em cascata (abrir o app, trocar de comunidade, tentar de novo) | cada bloco: opacity 0 para 1 e translateY 14 para 0; atraso de 40 ms por bloco, no máximo 7 blocos | 200 ms cada, fim em 440 ms                | saida                 | todos juntos, só opacity, 120 ms                    |
| Aceitar: rótulo vira `✓ Confirmado`                                    | opacity 0,6 para 1; irmão `Não posso ir` opacity 1 para 0                                          | 120 ms                                    | padrao                | igual                                               |
| Aceitar: check                                                         | transform scale 0,6 para 1 e opacity                                                               | 200 ms                                    | mola                  | só opacity, 120 ms                                  |
| Aceitar: linha reorganiza                                              | vizinhos transform translateY (diferença) para 0                                                   | 200 ms                                    | padrao                | troca na hora                                       |
| Check-in feito: chip                                                   | opacity 0 para 1 e scale 0,9 para 1                                                                | 160 ms                                    | saida                 | só opacity, 120 ms                                  |
| Check-in: número do contador                                           | opacity 0 para 1 (dissolve, sem rolar dígitos); barra scaleX                                       | 120 ms                                    | padrao                | troca na hora                                       |
| Aviso novo no sino                                                     | selo scale 1 para 1,15 para 1; faixa do aviso translateY -12 para 0 e opacity                      | 160 ms; 200 ms                            | saida; padrao         | número troca na hora; faixa dissolve                |
| Erro de ação no Check-in                                               | linha translateX 0, -5, 5, -3, 0 (cinco pontos)                                                    | 260 ms                                    | linear                | sem balanço, mensagem aparece                       |
| Bloco de erro aparece                                                  | opacity 0 para 1                                                                                   | 160 ms                                    | padrao                | 120 ms                                              |
| Carregando                                                             | esqueleto opacity 0 para 1 depois de 300 ms; pulso opacity 1 para 0,5                              | 160 ms; 1200 ms em laço                   | padrao; ease-in-out   | esqueleto estático                                  |
| Botão com indicador (publicar)                                         | indicador entra depois de 250 ms (rotação em laço) e vira check scale 0,6 para 1                   | 140 ms; 200 ms                            | padrao; mola          | check por opacity                                   |
| Trocar de comunidade                                                   | avatar rotateY 180 para 0; nome opacity 0 para 1; esqueleto; cascata                               | 200 ms; 160 ms; 1100 ms de carga fictícia | padrao; padrao; saida | sem giro, nome por opacity                          |
| Toast entra                                                            | opacity e translateY 8 para 0                                                                      | 200 ms                                    | saida                 | opacity, 120 ms                                     |
| Toast: contagem de 10 s                                                | barra scaleX 1 para 0                                                                              | 10 000 ms                                 | linear                | sem barra, contagem em texto                        |
| Toast sai                                                              | opacity 1 para 0                                                                                   | 160 ms                                    | padrao                | 120 ms                                              |
| Desfazer                                                               | o inverso do ato (por exemplo, rótulo volta e linha volta)                                         | 160 ms                                    | padrao                | troca na hora                                       |
| Subir e descer música                                                  | translateY da diferença para 0                                                                     | 200 ms                                    | padrao                | troca na hora, com anúncio                          |
| Acordeão (versículo, resumo, organização)                              | conteúdo opacity 0 para 1; vizinhos translateY; seta rotate 0 para 180                             | 200 ms                                    | padrao                | abre sem animação                                   |
| Segmento (Todos, Só o que é meu) e três abas                           | polegar ou traço translateX                                                                        | 200 ms                                    | padrao                | troca na hora                                       |
| Deslizar para aceitar                                                  | linha translateX acompanha o dedo; ao soltar volta a 0 ou trava em -140                            | 200 ms                                    | padrao                | igual, sem escala                                   |
| Pressionar botão                                                       | scale 1 para 0,98 e camada de 16%; volta com mola                                                  | 90 ms; 160 ms                             | padrao; mola          | só a camada, 80 ms                                  |
| Passar de etapa no Ao vivo                                             | cartão translateX 24 para 0 e opacity                                                              | 200 ms                                    | saida                 | opacity, 120 ms                                     |
| Cifra, próxima música                                                  | conteúdo translateX 20 para 0 e opacity                                                            | 200 ms                                    | saida                 | opacity, 120 ms                                     |
| **Encanto 1** (primeiro Aceitar): halo do sol por trás do cartão       | disco Girassol opacity 0 para 0,35 e scale 0,8 para 1 em 600 ms, some em 400 ms                    | 1000 ms no total                          | saida                 | só o texto `Que bom ter você no Louvor.` por 4 s    |
| **Encanto 2** (primeira presença): arco                                | meia-coroa Girassol rotate -180 para 0 junto ao número                                             | 500 ms                                    | saida                 | só o texto `Primeira presença marcada. Bom sábado!` |
| **Encanto 3** (primeiro encontro publicado): disco no botão            | disco Girassol scale 0,4 para 1 e opacity                                                          | 400 ms                                    | saida                 | só o texto `Seu primeiro encontro está no ar.`      |
| **Encanto 4** (`Tudo em dia`): o sol sobe                              | corpo e raios translateY 40 para 0, raios opacity 0 para 1 (pose 1 para 3)                         | 600 ms                                    | saida                 | sol já no lugar, texto `Tudo em dia.`               |
| **Encanto 5** (banda completa): selo                                   | selo scale 0,96 para 1 e opacity 0,4 para 1                                                        | 300 ms                                    | saida                 | só o selo e o texto `Banda completa: 5 de 5.`       |

Observações:

- **Reorganizar linhas usa a técnica FLIP** (medir antes e depois, animar a diferença com `translateY`). Nada anima `height`. No app, isso é o `LinearTransition` do Reanimated ou o mesmo cálculo em `onLayout`. Se a equipe preferir animar altura, a tabela do UX 6.2 já prevê isso e o resultado é o mesmo.
- **Encantos:** cada um vale uma vez por conta, no máximo um por sessão, 600 ms ou menos de movimento, nunca bloqueia toque. No protótipo isso funciona nas ações reais (1 a 4); o 5 só dispara pelo botão do painel, porque a banda completa depende de uma resposta de outra pessoa. Os botões 1 a 5 do painel repetem cada um.
- Novos tokens a criar em `packages/tokens/src/acesso.ts` (ao lado de `MOVIMENTO_DOS_CONTROLES`): `cascata` (passo 40, deslocamento 14, máximo 7), `toastContagem` (10 000), `haloDoSol` (1000, pico 0,35), `arcoDoSol` (500), `soSobe` (600), `seloDaBanda` (300), mais os já previstos no UX 6.2 (`abaDissolve` 160, `pilulaDaAba`, `linhaEncolhe` 200, `chipPresente` 160, `seloEstoura` 160, `avatarDaPilula` 200).

## 12. Mapa de implementação, arquivo a arquivo

Esforço em dias de uma pessoa, com testes. "UX v3" são as mudanças de estrutura (4 abas, desfazer, deslizar), que o documento de UX já planeja e **não** estão contadas aqui: esta tabela é só o que a direção C acrescenta ou troca.

| Arquivo                                                                                                                  | Mudança                                                                                                                                  | Esforço              |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `packages/tokens/src/cores.ts`                                                                                           | paleta nova nos dois temas (seção 3), `INVERSO_*` e `VIDRO` saem; campos novos `ink` e `pap`                                             | 1                    |
| `packages/tokens/src/pares.ts` e `contraste.test.ts`                                                                     | pares da seção 4, incluindo botão pressionado e palco                                                                                    | 1                    |
| `packages/tokens/src/index.ts`                                                                                           | `TIPO` (Fraunces nos papéis de exibição, tetos), `RAIO` (14, 20, 24, 28), `BARRA_DE_ABAS` (88, bloco de 60), `ELEVACAO` zerada, `ALTURA` | 1                    |
| `packages/tokens/src/acesso.ts`                                                                                          | tokens de movimento novos (seção 11)                                                                                                     | 0,5                  |
| `apps/app/src/ui/fontes.ts`, `package.json`                                                                              | trocar Bricolage por Fraunces 800 e 900, somar Inter 800; checar peso do pacote                                                          | 0,5                  |
| `apps/app/src/ui/tema.tsx`, `cor.ts`                                                                                     | repassar os campos novos                                                                                                                 | 0,5                  |
| `apps/app/src/ui/Tela.tsx`, `FundoAurora*.tsx`, `geometriaDaAurora.ts`, `propsDoFundoAurora.ts`                          | fundo vira papel chapado (a Aurora sai das telas internas)                                                                               | 1                    |
| `apps/app/src/ui/CartaoDeVidro.tsx`, `Vidro.tsx`                                                                         | substituir por `Bloco` (cor, raio, padding, variáveis de botão e etiqueta)                                                               | 1,5                  |
| `apps/app/src/ui/CartaoDeDestaque.tsx`                                                                                   | vira o cartão do momento (numeral, sol recortado, estados)                                                                               | 2                    |
| `apps/app/src/ui/MarcaDoSol.tsx`, `geometriaDoSol.ts`                                                                    | 5 poses por deslocamento e máscara, variante recortada                                                                                   | 1,5                  |
| `apps/app/src/ui/ItemDaBarraDeAbas.tsx` e a barra de abas                                                                | faixa opaca, bloco deslizante, 4 itens, teto de rótulo                                                                                   | 1,5                  |
| `apps/app/src/ui/Botao.tsx`, `aparenciaDoBotao.ts`, `BotaoDeLinha.tsx`                                                   | primário Sol com borda ink, secundário com contorno, variantes por bloco, camada de pressionado, tracejado do desabilitado               | 1,5                  |
| `apps/app/src/ui/Campo.tsx`, `Segmentos.tsx`, `CaixaDeMarcar.tsx`, `Interruptor.tsx`                                     | reaplicar a gramática de borda de 2 pt; polegar de tinta                                                                                 | 1,5                  |
| `apps/app/src/ui/Chip.tsx`, `PilulasDeFiltro.tsx`                                                                        | cinco tipos de chip, tracejado de pendente                                                                                               | 0,5                  |
| `apps/app/src/ui/LinhaDeLista.tsx`, `BotaoDeLinha.tsx`                                                                   | linha com régua, dia grande, linha do Check-in de 72                                                                                     | 1,5                  |
| `apps/app/src/ui/Esqueleto.tsx`                                                                                          | formas novas e atraso de 300 ms                                                                                                          | 0,5                  |
| `apps/app/src/ui/Toast.tsx`                                                                                              | contagem, barra, `Desfazer` de 44 (se o UX v3 ainda não o fez)                                                                           | 1                    |
| `apps/app/src/ui/IconeDeTraco.tsx`, `Icone.tsx`                                                                          | traço 2,5 e glifos novos                                                                                                                 | 1                    |
| `apps/app/src/ui/EstadoVazio.tsx`                                                                                        | sol por pose, texto e ação                                                                                                               | 0,5                  |
| `apps/app/src/ui/PilulaDaComunidade.tsx`, `CabecalhoDeTela.tsx`, `MarcasDeNovidade.tsx`, `Avatar.tsx`                    | pílula com borda, selo de texto, avatar com borda                                                                                        | 1                    |
| `apps/app/src/ui/Acordeao.tsx`, `BarraDeProgresso.tsx`, `Numeros.tsx`, `Folha.tsx`, `FolhaNaTela.tsx`, `BarraDeAcao.tsx` | réguas, barra de 16 com número, folha opaca com borda, barra fixa                                                                        | 2                    |
| `apps/app/src/funcionalidades/*` (Início, Agenda, Encontro, Check-in, Ao vivo, Repertório, Comunidade, Perfil)           | só ajustes de composição sobre os componentes novos; a estrutura vem do UX v3                                                            | 3                    |
| `scripts/apresentacao`                                                                                                   | refazer as capturas nos dois temas                                                                                                       | 1                    |
| **Total**                                                                                                                |                                                                                                                                          | **cerca de 27 dias** |

Ordem sugerida (para não repetir o erro de sistema antes de produto): 1) tokens e fontes, 2) `Bloco`, cartão do momento, botão e barra de abas, 3) Início e Agenda reais, 4) ver as duas telas ao lado da atual, 5) só então Check-in, Ao vivo e o resto.

## 13. Riscos

| #   | Risco                                                                                                                                                                                                 | O que fazer                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | **A direção C substitui a Aurora**, que o UX v3 (9.1) lista como identidade aprovada que não se mexe.                                                                                                 | É decisão do dono. Se escolher C, registrar um ADR que revoga a Aurora nas telas internas.                                  |
| 2   | **Login v2 (D63) e controles v2 (D64) foram feitos em Aurora e degradê.** Trocar tokens muda os dois. O login, que tem o sol nascendo, ficaria com outra linguagem que o resto.                       | Decidir se o login ganha a mesma linguagem (mais 2 dias) ou mantém a Aurora como "portão". Não mexi nisso.                  |
| 3   | **Fraunces no nativo.** Os arquivos estáticos do pacote do Expo podem não trazer os eixos `SOFT` e `opsz`; a forma a 84 pt pode ficar mais dura que a do protótipo (que usa a fonte variável na web). | Instalar, comparar a 84 pt e a 32 pt no aparelho antes de aceitar.                                                          |
| 4   | **Peso do app:** mais dois arquivos de fonte (Fraunces 800 e 900) e Inter 800.                                                                                                                        | Medir. Se pesar, só Fraunces 900.                                                                                           |
| 5   | **Serifa em peso 900 em título longo** ("Novo encontro: Igual ao último sábado") cansa.                                                                                                               | O protótipo já reduz esse título para 36. Teste com Seu Antônio.                                                            |
| 6   | **Borda de 2 pt em tudo** pode virar ruído.                                                                                                                                                           | Se o teste reclamar, manter a borda só em botão, campo e pílula, e tirar da linha e do ladrilho.                            |
| 7   | **Blocos luminosos no escuro** podem ofuscar à noite.                                                                                                                                                 | Se o teste reclamar, baixar 8% a luminosidade do Sol e do Girassol no escuro (a tinta continua passando de 7:1).            |
| 8   | **Rótulo de aba com teto de 15 pt** é menor que o teto de 1,6 do UX 7.1.                                                                                                                              | Medir "Comunidade" a 15 pt em 360 de largura. Se não couber, encolher o tracking ou usar o visualizador de conteúdo grande. |
| 9   | **Cartão do momento mudando de cor** soma ao risco R2 do UX (parece que o app mudou).                                                                                                                 | Só o Ultramar de "Acontecendo" é fria; o resto é Sol. Testar com a voluntária.                                              |
| 10  | **Halo do sol fora do cartão** exige que o contêiner do cartão não corte filhos (no Android, `overflow: hidden` do cartão corta).                                                                     | O halo fica no contêiner de fora, atrás do cartão, como no protótipo.                                                       |
| 11  | **Fraunces sem algarismos tabulares confirmados.**                                                                                                                                                    | Já tratado: tempo e contador que trocam de dígito usam Inter.                                                               |
| 12  | **O protótipo usa Google Fonts por rede.** Sem internet na primeira abertura, cai em Georgia e o título fica mais largo.                                                                              | Funciona, mas o visual não é o final. Para a demonstração, abrir uma vez com internet.                                      |

## 14. Checklist de aceitação visual (12 itens)

Conferir no protótipo, nos dois temas, com fonte 1,0, 1,35 e 2,0, e depois no app.

1. **Tamanho:** nenhum texto que informa abaixo de 14 pt; corpo em 17; Fraunces só a partir de 26.
2. **Contraste:** todo par da seção 4 passa (teste automático), sem texto branco sobre Sol ou Girassol.
3. **Cartão do momento:** numeral, título, etiqueta, parte e botões legíveis nos 5 estados do membro e nos 7 do líder, com o sol cortado pela borda e sem cobrir texto.
4. **Quatro abas:** o bloco ativo tem borda de tinta e rótulo em peso 800; o rótulo cabe a 2,0; alvo de 44 ou mais.
5. **Cor nunca sozinha:** "Aguardando" (tracejado, relógio, texto), "Confirmado" e "Presente" (check, texto), "Passou 3 min" (alerta, texto), barra "9 de 11" (número ao lado).
6. **Alvos:** linha do Check-in 72, botões 44 a 56, `Desfazer` 44, check de 28 com área de 56.
7. **Fonte grande:** em 1,35 os pares de botão empilham; em 2,0 nada é cortado, os segmentos viram lista e o número do cartão desce; botão nunca sai da tela.
8. **Reduzir movimento:** nenhum deslocamento, só dissolução de 120 ms ou menos; os 5 encantos viram texto; esqueleto parado; contagem do toast em texto.
9. **Toast:** 10 s com contagem em texto e barra; `Desfazer` focável com teclado; um toast novo confirma o anterior.
10. **Estados completos por componente:** repouso, hover, foco (anel visível sobre papel e sobre bloco), pressionado, desabilitado (tracejado com motivo escrito), carregando (esqueleto da forma final), erro, sem internet.
11. **O sol:** só nos lugares da seção 8; escondido do leitor de tela; nenhuma pose em linha ou seção; no cartão, recortado pela borda.
12. **Claro e escuro lado a lado** nas 10 telas centrais: nada vibra, os blocos mantêm a tinta escura por cima, e a hierarquia é a mesma nos dois.

## 15. O que ficou de fora do protótipo

- Entrada (login, cadastro, convite), `Novo aviso`, `Novo pedido de oração`, `Convidar`, Biblioteca, leitura de aviso e demais telas do inventário: o toque mostra `Esta tela não faz parte do protótipo.`.
- O Calendário abre, marca `Posso ajudar` e fecha, mas tocar num dia não leva a lista até ele.
- `Ler QR` marca a próxima pessoa ausente, sem câmera.
- Compartilhar e `Como chegar` mostram o que fariam, sem abrir nada do sistema.
- Háptico, ações de acessibilidade do deslizar (VoiceOver e TalkBack) e leitura por voz real: o protótipo tem `aria` e uma região de anúncios, mas não foi testado com leitor de tela.
- "Aumentar contraste" e "Reduzir transparência" não têm botão no painel. A segunda não tem o que reduzir (tudo é opaco); a primeira está descrita na seção 6.
- O encanto 5 (banda completa) só dispara pelo painel.
- O pacote do encontro baixado e a fila de sincronização offline são só visuais (faixa, contador `esperando internet`, botões desabilitados com motivo).
- Medição real de alturas e de rótulo de aba: a ser feita no aparelho.
