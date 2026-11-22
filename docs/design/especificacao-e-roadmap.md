# Auditoria de design do Uni Jovem e roadmap de redesign

Data: 15/11/2026.

Base desta auditoria:

- o código que está no iPhone do dono (cópia congelada em `scratchpad\app-instalado\`);
- o print real da tela Início (`print-iphone-inicio.png`);
- o mockup aprovado "A · Aurora" (`mockup-aprovado-inicio.png` e o código dele, `direcoes\project\Main.dc.html`);
- a seção 7 do `CLAUDE.md`;
- a revisão de acessibilidade de 14/11/2026 (`revisao-acessibilidade.md`);
- a seção 6 do plano (`meu-objetivo-fazer-parallel-hickey.md`).

Como ler:

- Os caminhos de código são relativos a `C:\Users\Rfasg\AppData\Local\Temp\claude\774b84b711c50422\c28e7a4c-eaac-452c-ae14-e39929828078\scratchpad\app-instalado\`.
- As medidas estão em pt. No iOS 1 pt equivale a 1 dp no Android e a 1 px CSS na web. A tela de referência é 390×844 pt.
- Gravidade:
  - **Crítica**: o dono vê na primeira tela, e o problema quebra a fidelidade ao mockup ou uma regra obrigatória.
  - **Alta**: aparece no uso diário e dá à tela cara de genérico.
  - **Média**: acabamento e consistência.
  - **Baixa**: polimento.
- Os contrastes foram calculados pela fórmula WCAG 2.2, a mesma de `packages/tokens/src/contraste.ts`. As cores translúcidas foram compostas sobre o fundo real antes do cálculo, inclusive sobre o pior ponto da Aurora.

## Resumo em cinco frases

1. **Faltam os quatro elementos de assinatura do mockup.** São eles o fundo Aurora, a pílula da comunidade, o cartão de destaque claro e a barra de abas flutuante própria. No lugar deles entrou o que o sistema dá de graça: barra de abas nativa, cabeçalho de pilha nativo e fundo chapado.
2. **O design system está incompleto.** Há cores e uma escala de espaço, mas faltam papéis tipográficos, elevação, tokens de vidro e de Aurora, e componentes com estados desenhados. Cada tela é montada com os mesmos Cartão, Botão e Campo genéricos.
3. **Todo conteúdo vira "cartão com ícone e título".** São 170 usos de `Cartao` em 79 arquivos, todos com a mesma borda lavanda forte. Nada separa o que importa agora do que é secundário.
4. **Os botões são pílulas de 44 pt.** Têm contorno de 1,5 pt, ocupam a largura total por padrão e se empilham em paredes de até 8 botões numa tela.
5. **Os formulários são listas de campos de texto.** Isso vale até para data e hora, que hoje são digitadas.

---

# 1. Diagnóstico

## 1.1 Print do iPhone comparado com o mockup aprovado

| Elemento           | Print (hoje)                                                                           | Mockup aprovado                                                                                                                                        | Causa no código                                                                  |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Topo               | Faixa cinza de largura total, texto "Sem comunidade" 16/600 e linha inferior           | Pílula de 44 com avatar "JC" 32, nome 15/600 e chevron; à direita, "Sincronizado 14:32" 13 com check verde; não há faixa                               | `navegacao/CabecalhoDaComunidade.tsx:38-81`, `ui/Vidro.tsx:41-49`                |
| Fundo              | `#12102A` chapado                                                                      | Aurora: brilho coral no canto superior direito e brilho violeta à esquerda                                                                             | `ui/Tela.tsx:73` (só `backgroundColor`); não há gradiente em lugar nenhum do app |
| Saudação           | Bricolage 24/28 com "!"                                                                | Bricolage 800 34/38, espaçamento entre letras de -0,5, sem "!"                                                                                         | `ui/Tela.tsx:58` (variante `titulo`), `inicio/TelaInicio.tsx:54`                 |
| Margem lateral     | 16                                                                                     | 20                                                                                                                                                     | `ui/Tela.tsx:67`                                                                 |
| Cartão             | Borda 1 pt `#7A73B8` (lavanda forte), fundo `#1C1940`, conteúdo centralizado           | Borda branca a 14%, fundo branco a 7%, conteúdo alinhado à esquerda, sobrancelha em maiúsculas 12                                                      | `ui/Cartao.tsx:25-30`, `ui/EstadoVazio.tsx:20`                                   |
| Cartão de destaque | Não existe                                                                             | Cartão claro `#F5F3FF`, título 24/28 e linhas com hora em coluna de 44                                                                                 | Não há componente para isso                                                      |
| Botões             | Pílula, raio 999, 44, texto 16                                                         | Raio 14, 44, texto 15/600, dois lado a lado com `flex: 1` e intervalo de 10                                                                            | `ui/Botao.tsx:73,90`                                                             |
| Barra de abas      | Barra nativa do iOS com "Programações", "Comunidade" e "Mais"; seleção em pílula cinza | Barra própria com raio 28, a 16 das bordas e 24 do fundo; aba ativa em pílula coral a 20%; rótulos 11; abas Início, Agenda, Programas, Equipe e Perfil | `navegacao/AbasDoApp.tsx:18-39`, `navegacao/abas.ts:17-29`                       |
| Estado vazio       | Centralizado, ícone em círculo de 56, sem nenhuma ação                                 | O mockup não mostra; a regra do projeto pede ação e a direção pede alinhamento à esquerda                                                              | `navegacao/SemComunidade.tsx:10-19`                                              |

## 1.2 Causa raiz

1. **A casca foi terceirizada ao sistema.** São três peças:
   - `NativeTabs` (`AbasDoApp.tsx:18`);
   - `headerShown: true` em todas as pilhas (`app/(autenticado)/_layout.tsx:25`, `app/(publico)/_layout.tsx:15`, `app/_layout.tsx:84-90`);
   - um `GlassView` sem tinta (`Vidro.tsx:43-47`), que sobre o fundo chapado vira cinza neutro.

   Essas três peças desenham dois terços do que se vê na tela, e nenhuma delas segue o mockup.

2. **O design system parou nas cores.** `packages/tokens/src/index.ts` não tem elevação, vidro, Aurora, tons de chip nem espaçamento entre letras. A escala de espaço não tem os valores finos do mockup (2, 6, 10, 14, 18) nem os raios 20 e 28.
3. **Os componentes de base nasceram como "formulário acessível".** Todos funcionam e são acessíveis, mas nenhum tem desenho de estado: pressionado e desabilitado são `opacity`. Também não há variantes de hierarquia, como cartão de destaque, botão terciário de verdade ou chip preenchido.
4. **As telas foram escritas antes de existir composição.** Cada tela empilha Cartões iguais, com gap de 16, na ordem dos dados, e não na ordem de importância.

## 1.3 Casca (navegação, cabeçalho, fundo)

| ID   | Gravidade | Onde                                                                                   | Problema                                                                                                                                                                                                                                  | Correção (ver seção 2)                                                              |
| ---- | --------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| K-01 | Crítica   | `funcionalidades/navegacao/AbasDoApp.tsx:18-39`                                        | Barra de abas nativa: pílula cinza do sistema, rótulos do sistema, sem pílula coral. A aba selecionada só muda de cor no Android e na web (revisão A5).                                                                                   | Barra de abas própria (2.12.17)                                                     |
| K-02 | Crítica   | `funcionalidades/navegacao/abas.ts:17-29`                                              | Rótulos "Programações", "Comunidade" e "Mais"; o mockup aprovado tem "Programas", "Equipe" e "Perfil". O Perfil está escondido dentro de "Mais" (`AbaPerfilOuMais.tsx:15`).                                                               | Novas abas; o "Mais" vira categorias do Perfil (3.6.4)                              |
| K-03 | Crítica   | `funcionalidades/navegacao/CabecalhoDaComunidade.tsx:38-81`                            | Faixa de vidro de largura total com padding 16 (`:44`), nome solto em texto (`:60-62`), botão "Trocar" como pílula de 44 (`:66-77`) e indicador de sincronização numa segunda linha (`:80`). No print ela aparece como barra cinza opaca. | Pílula da comunidade e status na mesma linha, sem faixa (2.12.14, 2.12.15, 2.12.16) |
| K-04 | Crítica   | `ui/Vidro.tsx:41-49`                                                                   | `GlassView` sem `tintColor`. Sobre o fundo `#12102A` ele vira cinza neutro, fora da paleta.                                                                                                                                               | Vidro com tinta do token (2.8)                                                      |
| K-05 | Crítica   | `ui/Tela.tsx:73`                                                                       | Fundo chapado; não existe Aurora.                                                                                                                                                                                                         | Fundo Aurora (2.3)                                                                  |
| K-06 | Crítica   | `app/(autenticado)/_layout.tsx:25`, `funcionalidades/navegacao/opcoesDaPilha.ts:14-22` | 54 rotas com cabeçalho nativo (lista em 1.7). O título nativo 17/600 se repete no título 24 da tela: "Oração" aparece duas vezes (`_layout.tsx:65` mais `oracao/TelaOracao.tsx:23`), e o mesmo vale para todas as pilhas.                 | Cabeçalho de tela próprio (2.12.16) e `headerShown: false` em tudo                  |
| K-07 | Alta      | `ui/Tela.tsx:67`, `CabecalhoDaComunidade.tsx:44`                                       | Margem lateral de 16; o mockup usa 20.                                                                                                                                                                                                    | Margem de 20 (2.13)                                                                 |
| K-08 | Alta      | `ui/Tela.tsx:56-61`                                                                    | Título de toda tela em `titulo` 24/28. O mockup usa display 34/38 nas raízes de aba.                                                                                                                                                      | Papéis `display` e `tituloTela` (2.4)                                               |
| K-09 | Alta      | `CabecalhoDaComunidade.tsx:80`, `offline/IndicadorDeSincronizacao.tsx:110-145`         | O status de sincronização é uma pílula com borda, numa linha própria. A altura do cabeçalho pula entre cerca de 60 e 112 pt conforme o estado e empurra a tela.                                                                           | Status em texto 13 na linha da pílula (2.12.15)                                     |
| K-10 | Média     | `CabecalhoDaComunidade.tsx:46` e `Tela.tsx:49`                                         | Na web, o cabeçalho tem largura máxima de 752 (720 + 32) e o conteúdo tem 720: as bordas não se alinham.                                                                                                                                  | Usar a mesma largura máxima nos dois                                                |
| K-11 | Média     | `funcionalidades/comunidade/Identidade.tsx:28`                                         | Marca da comunidade com ícone genérico branco (`person.3`); o mockup usa as iniciais "JC".                                                                                                                                                | Avatar com iniciais (2.12.13)                                                       |

## 1.4 Tokens que faltam ou divergem

| ID   | Gravidade | Onde                                       | Problema                                                                                                                                                                                                                                                                                               |
| ---- | --------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P-01 | Crítica   | `packages/tokens/src/index.ts:31-39`       | Tipografia com 7 variantes e sem espaçamento entre letras nem caixa. Faltam: sobrancelha (12/16, 600, +1, maiúsculas), botão 15/20, legenda 13/18, leitura 17/26, aba 11/14 e display separado do título de tela. `subtitulo` (Bricolage 600 18) não existe no mockup, mas é o título dos 170 cartões. |
| P-02 | Crítica   | `packages/tokens/src/index.ts`             | Não há elevação: nenhuma sombra no app.                                                                                                                                                                                                                                                                |
| P-03 | Crítica   | `packages/tokens/src/cores.ts:48-49,68-69` | Vidro com só dois valores (fundo e borda). Faltam desfoque, tinta, fallback opaco, Aurora, fundo da aba ativa, fundo tonal e borda tonal.                                                                                                                                                              |
| P-04 | Alta      | `cores.ts:34,38`                           | `superficie #1C1940` é mais saturada e escura que o cartão do mockup (branco a 7% sobre o fundo dá `#232139`). `borda #7A73B8` é usada em todos os cartões e cria o contorno lavanda forte do print.                                                                                                   |
| P-05 | Alta      | `cores.ts:42,62`                           | `secundaria #9D8FFF` (violeta) é usada como cor de seleção em Segmentos (`ui/Segmentos.tsx:72`) e no dia de hoje (`agenda/VistaDoMes.tsx:81`). É um segundo acento que compete com o coral e não existe no mockup.                                                                                     |
| P-06 | Alta      | `index.ts:5-15`                            | A escala de espaço não tem 2, 6, 10, 14 e 18, que o mockup usa dentro dos componentes (padding de 18 no cartão, 10 entre botões, 14 depois do título). Também não há regra que separe os valores de layout dos valores internos dos componentes.                                                       |
| P-07 | Alta      | `index.ts:17`                              | Raios: falta 28 (barra de abas e folha) e 20 (aba ativa). O raio `pequeno` 10 é usado sem regra concêntrica.                                                                                                                                                                                           |
| P-08 | Média     | `cores.ts`                                 | Não há fundos tonais para chips (sucesso, alerta, erro, info, quente, neutro). O `Selo` é só um contorno.                                                                                                                                                                                              |
| P-09 | Média     | `cores.ts`                                 | Não há paleta inversa para o cartão de destaque (claro no tema escuro, escuro no tema claro).                                                                                                                                                                                                          |
| P-10 | Média     | `ui/fontes.ts:1-4`                         | Inter 500 não é carregada, e o rótulo da aba inativa do mockup é 500.                                                                                                                                                                                                                                  |
| P-11 | Média     | `cores.ts:73-96`                           | `PARES_OBRIGATORIOS` testa 21 pares. Não cobre composições translúcidas, chips, o inverso, a barra sobre conteúdo nem a Aurora; a revisão de acessibilidade já apontava isso.                                                                                                                          |
| P-12 | Baixa     | `index.ts:42`                              | As durações existem, mas não há curvas nem regra para Reduzir movimento além de "vira 0".                                                                                                                                                                                                              |

## 1.5 Componentes de base

### Botão (`ui/Botao.tsx`)

| ID   | Gravidade | Linha        | Problema                                                                                                                                                                               |
| ---- | --------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Crítica   | `:73`        | Raio `pilula` (999); o mockup usa 14. É o motivo número um de "os botões estão feios": pílula de 44 com contorno parece botão padrão de biblioteca.                                    |
| C-02 | Alta      | `:90`        | Texto `corpoForte` 16/600; o mockup usa 15/600. O botão fica maior que o corpo de texto e "grita".                                                                                     |
| C-03 | Alta      | `:35,:76-77` | O secundário tem fundo `superficie` e borda de 1,5 `#7A73B8`. No mockup o fundo é transparente e a borda tem 1 pt, branca a 30%.                                                       |
| C-04 | Alta      | `:82`        | Pressionado é `opacity: 0.85`; desabilitado é `opacity: 0.5`. Não há cor de pressionado, nem anel de foco no nativo, nem desenho de desabilitado.                                      |
| C-05 | Alta      | `:50,:60`    | `larguraTotal` é `true` por padrão: todo botão ocupa a linha inteira e eles se empilham (exemplo: 4 botões largos em `oracao/CartaoDoPedido.tsx:72-123`).                              |
| C-06 | Média     | `:69,:71`    | Só um tamanho (44 mínimo, padding 20). Não existe 48 para formulários nem variante só ícone; por isso `BotoesDeOrdem.tsx:40-50` cria a sua própria versão, com raio 10 e borda de 1,5. |
| C-07 | Média     | `:36`        | A variante `perigo` tem fundo `superficie` e borda de erro. Não existe destrutivo cheio para a confirmação final ("Excluir minha conta").                                              |
| C-08 | Média     | `:85-89`     | O indicador de carregamento troca o ícone, mas a largura não fica travada: o botão muda de tamanho ao carregar.                                                                        |
| C-09 | Baixa     | `:88`        | Ícone de 20; o padrão proposto para botões é 18.                                                                                                                                       |

### Campo (`ui/Campo.tsx`)

| ID   | Gravidade | Linha                                                                                                      | Problema                                                                                                                                                                                             |
| ---- | --------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-10 | Crítica   | `:55`                                                                                                      | Fundo do campo = `superficie`, a mesma cor do cartão onde ele quase sempre está. O campo só existe pela borda, o que reforça a cara de formulário.                                                   |
| C-11 | Alta      | `:51`                                                                                                      | Altura de 44; o padrão pedido para campos e botões na mesma linha é 48.                                                                                                                              |
| C-12 | Alta      | `:53-54`                                                                                                   | A borda passa de 1,5 para 2 no foco e no erro e desloca o texto em 0,5 pt a cada foco.                                                                                                               |
| C-13 | Alta      | `:44`                                                                                                      | Rótulo `corpoForte` 16/600 na cor do texto: pesa o mesmo que o valor digitado e compete com ele.                                                                                                     |
| C-14 | Alta      | `:43`                                                                                                      | Intervalo de 4 entre rótulo, caixa, ajuda e erro, apertado demais.                                                                                                                                   |
| C-15 | Média     | `:77`                                                                                                      | Padding horizontal de 12: o texto digitado fica em x=12, enquanto rótulo e ajuda estão em x=0 e o erro em x=22 (`:106-115`, ícone de 18 mais intervalo de 4). São três eixos esquerdos num só campo. |
| C-16 | Média     | `:101-116`                                                                                                 | Ajuda e erro aparecem empilhados ao mesmo tempo, e a altura do bloco salta.                                                                                                                          |
| C-17 | Média     | Todo o arquivo                                                                                             | Não há estado desabilitado nem altura mínima para multilinha. A descrição do evento tem 44 de altura (`eventos/CamposDoEvento.tsx:87-93`).                                                           |
| C-18 | Alta      | `eventos/CamposDoEvento.tsx:98-123`, `versiculo/TelaVersiculo.tsx:83-93`, `avisos/TelaNovoAviso.tsx:88-90` | Data e hora digitadas como texto ("DD/MM/AAAA", "HH:MM"); não há seletor nativo.                                                                                                                     |

### Cartão (`ui/Cartao.tsx`)

| ID   | Gravidade | Linha      | Problema                                                                                                                                                                                                   |
| ---- | --------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-19 | Crítica   | `:27-28`   | Borda de 1 em `#7A73B8` em todo cartão (2 com Aumentar contraste). É o contorno lavanda do print; no mockup a borda é branca a 14%, quase invisível.                                                       |
| C-20 | Crítica   | Não existe | Falta o cartão de destaque claro, o elemento mais forte do mockup ("Programação de sábado").                                                                                                               |
| C-21 | Alta      | `:36-43`   | Cabeçalho com ícone de 22 mais título em Bricolage 600 18 em todo cartão. O mockup usa sobrancelha em maiúsculas 12/600 coral, sem ícone. Isso multiplica ícones pela tela: 7 cartões com ícone no Início. |
| C-22 | Média     | `:29-30`   | Padding de 16 (o mockup usa 18) e gap fixo de 12 para tudo (o mockup usa 8 entre sobrancelha e conteúdo e 14 antes das ações).                                                                             |

### Linha de lista (`ui/Linha.tsx`)

| ID   | Gravidade | Linha        | Problema                                                                                                                                                      |
| ---- | --------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-23 | Alta      | `:20-26,:40` | Ícone solto de 22 na cor de destaque, sem ladrilho; altura mínima de 44; sem separadores. Linhas seguidas dentro de um cartão viram uma sopa de ícones coral. |
| C-24 | Média     | `:42,:50`    | Título 16/600 e chevron de 18 (o padrão do iOS é cerca de 14, mais leve). Não há valor à direita (como "07:00" ou "Ligada").                                  |
| C-25 | Baixa     | `:59`        | Pressionado é `opacity: 0.7`.                                                                                                                                 |

### Cabeçalho, abas e vidro

Os problemas desses componentes estão em K-01 a K-06 (1.3).

### Chips de estado (`ui/Selo.tsx`)

| ID   | Gravidade | Linha                                                                 | Problema                                                                                                                                                                  |
| ---- | --------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-26 | Alta      | `:11-19`                                                              | Só contorno colorido, sem fundo, com padding vertical de 2 (fora da escala). Parece etiqueta de formulário. O mockup usa chip preenchido (`#FFE3D9` com texto `#8A2E12`). |
| C-27 | Média     | `eventos/LinhaDoEvento.tsx:83-85`, `escalas/CartaoDaEscala.tsx:76-79` | O chip fica sozinho numa linha abaixo do texto (`alignSelf: flex-start`). No mockup ele fica à direita, na linha da meta, alinhado pela linha de base.                    |
| C-28 | Média     | `eventos/CabecalhoDoEvento.tsx:33`, `oracao/CartaoDoPedido.tsx:59`    | Chips com frase ("Visibilidade: Interna", "Quem vê: Equipe de oração"); chip é para uma ou duas palavras.                                                                 |

### Seleção (`ui/Segmentos.tsx`, `ui/GrupoDeOpcoes.tsx`, `ui/CaixaDeMarcar.tsx`)

| ID   | Gravidade | Linha                                                                            | Problema                                                                                                                                                                     |
| ---- | --------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-29 | Alta      | `Segmentos.tsx:43,50`                                                            | `flexWrap` com `alignSelf: flex-start`: os segmentos quebram em duas linhas e cada controle tem uma largura. Exemplo: "Cancelados ou adiados" em `TelaProgramacoes.tsx:135`. |
| C-30 | Alta      | `Segmentos.tsx:72,81`                                                            | Segmento selecionado em violeta `#9D8FFF`, com texto 12/600 (pequeno demais para controle).                                                                                  |
| C-31 | Alta      | `GrupoDeOpcoes.tsx:45-57,89`                                                     | Cada opção é uma caixa com borda própria, com rádio à esquerda e check repetido à direita. Uma lista de 4 opções vira 4 caixas empilhadas.                                   |
| C-32 | Média     | `CaixaDeMarcar.tsx:31`                                                           | `alignItems: center`: com descrição de 2 ou 3 linhas, a caixa fica no meio do bloco e não na primeira linha.                                                                 |
| C-33 | Alta      | `notificacoes/TelaNotificacoes.tsx:104-122`, `versiculo/TelaVersiculo.tsx:72-82` | Caixa de marcar usada como liga e desliga; o app não tem componente Interruptor.                                                                                             |

### Estados vazio, carregando e aviso

| ID   | Gravidade | Linha                                            | Problema                                                                                                                                                                                              |
| ---- | --------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-34 | Crítica   | `navegacao/SemComunidade.tsx:10-19`              | O estado vazio do print não tem ação, contrariando o CLAUDE.md §7 ("estados vazios com ação"). Para o Criador também não há caminho para criar a primeira comunidade.                                 |
| C-35 | Alta      | `ui/EstadoVazio.tsx:20-46`                       | Tudo centralizado dentro de cartões cujo título está à esquerda; ícone num círculo de 56 `superficieElevada`; ação como botão secundário (a ação esperada deveria ser primária).                      |
| C-36 | Alta      | `ui/Carregando.tsx:15-21`                        | Indicador giratório com texto em toda carga de tela; não há esqueleto. A tela pisca entre o indicador e o conteúdo.                                                                                   |
| C-37 | Média     | `ui/Aviso.tsx:39-48`, `ui/AvisoDeErro.tsx:28-37` | Aviso com borda colorida de 1,5 sobre `superficie`, que parece caixa de validação. Padding de 12 no Aviso e de 16 no AvisoDeErro: quando os dois estão empilhados, as bordas internas não se alinham. |
| C-38 | Média     | `ui/Aviso.tsx:14-16`                             | Títulos genéricos ("Para saber", "Pronto", "Atenção").                                                                                                                                                |
| C-39 | Média     | Não existe                                       | Não há toast. Confirmações transitórias viram avisos fixos (`eventos/AcoesDoEvento.tsx:108-112`, `inscricoes/TelaCheckin.tsx:186-190`) ou texto solto (`perfil/TelaPerfil.tsx:245-249`).              |
| C-40 | Média     | Não existe                                       | Não há folha (bottom sheet) própria nem barra de ação fixa. Ações secundárias viram mais botões na tela.                                                                                              |

### Ícones (`ui/Icone.tsx`)

| ID   | Gravidade | Linha         | Problema                                                                                                                                        |
| ---- | --------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| C-41 | Média     | `:101` e usos | Tamanhos soltos (16, 18, 20, 22, 24 e 28) sem regra; o peso do SF Symbol fica no padrão. O mockup usa traço de 2 px, equivalente ao peso médio. |

## 1.6 Problemas por tela

| ID   | Gravidade | Tela                  | Onde                                                                                | Problema                                                                                                                                                                                                                                                                                                                                  |
| ---- | --------- | --------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-01 | Crítica   | Início                | `inicio/TelaInicio.tsx:104-263`                                                     | Até 7 cartões com o mesmo peso e ícone: Avisos, Missão, Próximos eventos, Versículo, Minhas escalas, Minhas tarefas e Inscrições. O mockup tem 3, com hierarquia clara: versículo em vidro, próximo evento em destaque claro, escala em vidro com 2 ações. A ordem também diverge: no código o versículo é o 4º cartão; no mockup é o 1º. |
| T-02 | Alta      | Início                | `TelaInicio.tsx:101`                                                                | Frase "Isto é o que está acontecendo em X." redundante, entre a saudação e o primeiro cartão.                                                                                                                                                                                                                                             |
| T-03 | Alta      | Início                | `inicio/AvisosDoInicio.tsx:22-44`, `TelaInicio.tsx:127-153,179-189,206-216,227-230` | Seções vazias ocupam cartões inteiros com estado vazio. Uma comunidade nova vê 5 cartões dizendo "nada".                                                                                                                                                                                                                                  |
| T-04 | Alta      | Início                | `TelaInicio.tsx:238-260`                                                            | Inscrições como lista de botões secundários de largura total, um por evento.                                                                                                                                                                                                                                                              |
| T-05 | Crítica   | Início sem comunidade | `navegacao/SemComunidade.tsx:10-19`                                                 | É o print: sem ação, centralizado, a mesma tela para o Criador e para o membro.                                                                                                                                                                                                                                                           |
| T-06 | Alta      | Agenda                | `agenda/TelaAgenda.tsx:90-155`                                                      | Cinco linhas de controle antes do calendário: 2 botões, os segmentos, Anterior/título/Próximo e "Voltar para hoje". "Anterior" tem ícone e "Próximo" não (`:122-144`), então o título do mês não fica no eixo da tela.                                                                                                                    |
| T-07 | Alta      | Agenda, mês           | `agenda/VistaDoMes.tsx:63-98`                                                       | Células de 56 de altura por cerca de 46 de largura, com intervalo de 2; o dia de hoje é uma pílula violeta; a contagem aparece como texto "•2"; o selecionado tem borda de 2 coral sobre `superficieElevada`.                                                                                                                             |
| T-08 | Média     | Agenda, semana        | `TelaAgenda.tsx:259-297`                                                            | Sete cartões empilhados, quase todos com "Sem eventos.".                                                                                                                                                                                                                                                                                  |
| T-09 | Média     | Linha do tempo        | `agenda/TelaTimelineDoDia.tsx:80-94,257`                                            | Botões "Dia anterior" (com ícone) e "Dia seguinte" (sem ícone); coluna de hora com largura fixa de 48 (revisão M4).                                                                                                                                                                                                                       |
| T-10 | Alta      | Programações          | `eventos/TelaProgramacoes.tsx:99-145`                                               | Dois botões de largura total, dois controles de segmentos e um campo de busca antes do primeiro item: quatro blocos de controle.                                                                                                                                                                                                          |
| T-11 | Média     | Programações          | `eventos/LinhaDoEvento.tsx:65-88`                                                   | Cada evento é uma caixa com borda, sem bloco de data; o chip fica sozinho numa linha abaixo.                                                                                                                                                                                                                                              |
| T-12 | Crítica   | Detalhe do evento     | `eventos/DetalheDoEvento.tsx:79-89`                                                 | Dez cartões iguais em sequência: cabeçalho, organização, offline, participação, etapas, equipe, tarefas, materiais, checklist, notas e anexos. Não há navegação interna.                                                                                                                                                                  |
| T-13 | Crítica   | Detalhe do evento     | `eventos/AcoesDoEvento.tsx:114-211`                                                 | Parede de até 8 botões em `flexWrap`, cada um com largura diferente: Publicar, Editar, Duplicar, Salvar como modelo, Ver a série, Encerrar, Adiar e Cancelar ou Excluir.                                                                                                                                                                  |
| T-14 | Alta      | Detalhe do evento     | `eventos/CabecalhoDoEvento.tsx:29-35`                                               | Título do evento (24) dentro de um cartão com borda, mais 3 chips com frases.                                                                                                                                                                                                                                                             |
| T-15 | Alta      | Etapas                | `eventos/SecaoEtapas.tsx:97-155`                                                    | Cada etapa é uma caixa com borda, botões Subir/Descer de 44 com borda e um "Editar e escalar" secundário: 3 controles por etapa, sempre visíveis.                                                                                                                                                                                         |
| T-16 | Alta      | Criar e editar evento | `eventos/CamposDoEvento.tsx:55-258`                                                 | 13 campos empilhados com rótulo 16/600; categorias como botões secundários de 44 (`:76-85`); local como pilha de caixas de rádio (`:141-156`); prazo de inscrição em dois campos de texto (`:228-247`).                                                                                                                                   |
| T-17 | Alta      | Escala                | `escalas/CartaoDaEscala.tsx:55-134`                                                 | Caixa com borda dentro de cartão; até 3 botões em `flexWrap`, um com ícone e dois sem. No mockup são sobrancelha, título 16/600 e 2 botões com `flex: 1`.                                                                                                                                                                                 |
| T-18 | Alta      | Ao vivo               | `aoVivo/TelaAoVivo.tsx:199-430`                                                     | Borda de 2 na cor do texto (branca) em todos os painéis; rótulos digitados em maiúsculas sem espaçamento entre letras (`:242,255,264,305`); cronômetro feito com multiplicação ×1,6 (`:441-443`); controles em `flexWrap` (`:336-364`). Ponto positivo: já usa `tabular-nums` (`:444`).                                                   |
| T-19 | Alta      | Check-in              | `inscricoes/TelaCheckin.tsx:198-354`                                                | Três cartões de formulário. O campo de código e o botão estão empilhados quando deveriam estar numa linha só de 48 (`:206-231`). Cada pessoa é uma caixa com o botão abaixo do nome (`:272-325`).                                                                                                                                         |
| T-20 | Média     | Ler QR                | `inscricoes/TelaLerQr.tsx:187-204`                                                  | Câmera de 320 de altura com borda branca de 2, sem visor.                                                                                                                                                                                                                                                                                 |
| T-21 | Alta      | Equipe                | `comunidade/TelaComunidade.tsx:102-255`                                             | Pessoas sem avatar e com detalhe concatenado por "·", incluindo e-mail e WhatsApp (`:160-167`); botão "Cancelar" vermelho em cada convite (`:248-255`); "Sair da comunidade" como cartão com botão de perigo de largura total no fim da aba principal (`:122-134`).                                                                       |
| T-22 | Alta      | Convidar              | `comunidade/TelaConvidar.tsx:103-136`                                               | Dois grupos de caixas de rádio e um botão "Criar convite para {nome da comunidade}" longo.                                                                                                                                                                                                                                                |
| T-23 | Alta      | Criar comunidade      | `plataforma/TelaNovaComunidade.tsx:19-26,80`                                        | A cor é escolhida pelo nome ("Índigo", "Coral"...) numa lista de rádio, sem amostra de cor.                                                                                                                                                                                                                                               |
| T-24 | Média     | Plataforma            | `plataforma/TelaPlataforma.tsx:45-83`                                               | Botão primário de largura total e lista sem avatar; o estado aparece no texto da descrição, sem chip.                                                                                                                                                                                                                                     |
| T-25 | Crítica   | Perfil                | `navegacao/TelaMais.tsx:19-55`, `perfil/TelaPerfil.tsx:61-173`                      | No celular, o Perfil está dentro de "Mais" e é uma pilha de 7 cartões com ícone. Não há avatar. O formulário de dados aparece aberto no topo (`:219-258`). "Sair" é um cartão com botão de perigo de largura total (`:165-173`).                                                                                                          |
| T-26 | Alta      | Notificações          | `notificacoes/TelaNotificacoes.tsx:104-122`                                         | Oito caixas de marcar no lugar de interruptores.                                                                                                                                                                                                                                                                                          |
| T-27 | Alta      | Versículo             | `versiculo/TelaVersiculo.tsx:72-107`                                                | Caixa de marcar, horário digitado e botão "Salvar horário".                                                                                                                                                                                                                                                                               |
| T-28 | Alta      | Oração                | `oracao/TelaOracao.tsx:38-64`, `oracao/CartaoDoPedido.tsx:72-123`                   | Botão largo mais 2 controles de segmentos. Cada pedido tem até 4 botões largos empilhados mais "Denunciar", o que dá cerca de 400 pt por cartão.                                                                                                                                                                                          |
| T-29 | Média     | Avisos                | `avisos/TelaAvisos.tsx:97-138`                                                      | "Fixado" aparece 3 vezes (ícone, chip e borda coral de 2) e "Publicado em" 2 vezes (rótulo acessível e texto).                                                                                                                                                                                                                            |
| T-30 | Média     | Relatórios            | `relatorios/GraficoDeBarras.tsx:44-99`                                              | Números grandes sem `tabular-nums`, em caixas com borda; barras de 14 com borda.                                                                                                                                                                                                                                                          |
| T-31 | Alta      | Entrar                | `autenticacao/TelaEntrar.tsx:48-92`                                                 | Título "Entrar no Uni Jovem" 24 sem marca, sem Aurora e com os campos num cartão com borda; "Esqueci a senha" centralizado dentro do cartão. É a primeira impressão do app.                                                                                                                                                               |
| T-32 | Alta      | Convite               | `convite/CadastroPorConvite.tsx:134-195`                                            | Três campos, a pergunta de idade, os termos e 3 botões num só cartão, sem indicador de passo (o fluxo tem 3 passos).                                                                                                                                                                                                                      |
| T-33 | Média     | Excluir conta         | `privacidade/TelaExcluirConta.tsx:76-80`                                            | Marcadores "• " digitados à mão.                                                                                                                                                                                                                                                                                                          |
| T-34 | Baixa     | Face ID               | `app.config.ts:128`                                                                 | Não existe; `faceIDPermission: false`. A tela está especificada como nova em 3.1.3.                                                                                                                                                                                                                                                       |

## 1.7 Telas que usam o header nativo

São 54 rotas, todas com `headerShown: true` e, em quase todas, o título repetido dentro da tela:

- **`app/(autenticado)/_layout.tsx:27-89`**:
  - Comunidade e convites: trocar-comunidade, convidar, membro, aparelhos, ativar-2fa.
  - Plataforma: plataforma (lista, nova, comunidade).
  - Evento: novo, detalhe, editar, status, duplicar, etapa, ao-vivo, inscrições, check-in, ler-qr, série.
  - Agenda e escalas: agenda/[data], escalas, substituição.
  - Conta: conta.
  - Oração: lista, novo, detalhe.
  - Sugestões: lista, nova, detalhe.
  - Conteúdos: lista, novo, item.
  - Avisos: lista, novo, detalhe.
  - Relatórios: relatórios, exportações.
  - Locais: lista, local.
  - Diversos: modelos, denúncias, notificações, versículo, tradução, missão, privacidade, pendências, excluir-conta.
- **`app/(publico)/_layout.tsx:17-18`**: segundo-fator e recuperar-senha.
- **`app/_layout.tsx:84-90`**: convite, redefinir-senha, primeiro-acesso e não-encontrado.
- **Prop `cabecalhoNativo`** de `ui/Tela.tsx:20`: aparece em 51 arquivos de `funcionalidades/`.

Só estas telas ficam sem cabeçalho nativo: Entrar e as 5 abas (que usam o `CabecalhoDaComunidade`).

## 1.8 Desalinhamentos medidos

| ID   | Gravidade | Onde                                                                  | O que está desalinhado                                                                                                                                                                                                                                                                                          |
| ---- | --------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | Alta      | Cartão "Próximos eventos" (`TelaInicio.tsx:126-174`)                  | Três bordas esquerdas no mesmo cartão. Medidas a partir da borda do cartão: título em x=46 (padding 16, ícone 22, intervalo 8); texto das linhas de evento em x=29 (16, borda 1 e padding 12 de `LinhaDoEvento.tsx:70`); botão "Ver a agenda completa" em x=24 (16 mais padding 8 do discreto, `Botao.tsx:71`). |
| D-02 | Alta      | `ui/Campo.tsx`                                                        | Rótulo em x=0, texto digitado em x=12, ajuda em x=0 e erro em x=22.                                                                                                                                                                                                                                             |
| D-03 | Alta      | `agenda/TelaAgenda.tsx:121-145`, `agenda/TelaTimelineDoDia.tsx:80-94` | Pares de botões com larguras diferentes (um com ícone, outro sem); o título entre eles sai do centro.                                                                                                                                                                                                           |
| D-04 | Alta      | `ui/Segmentos.tsx:43,50`                                              | Controles empilhados com larguras diferentes: as bordas direitas não se alinham, e alguns quebram em 2 linhas.                                                                                                                                                                                                  |
| D-05 | Média     | `escalas/CartaoDaEscala.tsx:84-134`, `eventos/AcoesDoEvento.tsx:114`  | `flexWrap` de botões de largura automática: sobra um botão órfão na segunda linha, alinhado à esquerda, com a borda direita irregular.                                                                                                                                                                          |
| D-06 | Média     | `inscricoes/TelaCheckin.tsx:206-231`                                  | Campo de 44 e botão de 44 empilhados; deveriam estar numa linha de 48 com a mesma base.                                                                                                                                                                                                                         |
| D-07 | Média     | `ui/EstadoVazio.tsx:20` dentro de `ui/Cartao.tsx`                     | Dois eixos no mesmo cartão: o título do cartão à esquerda e o estado vazio centralizado (visível no print).                                                                                                                                                                                                     |
| D-08 | Média     | `agenda/VistaDoMes.tsx:47,65`                                         | Células de 56 de altura por cerca de 46,6 de largura, intervalo de 2; o número e os pontos não têm eixo comum com o cabeçalho dos dias.                                                                                                                                                                         |
| D-09 | Média     | `ui/Aviso.tsx:42` e `ui/AvisoDeErro.tsx:31`                           | Padding de 12 contra 16 em avisos que aparecem empilhados.                                                                                                                                                                                                                                                      |
| D-10 | Média     | `CabecalhoDaComunidade.tsx:80`                                        | A altura do cabeçalho varia com o estado da sincronização.                                                                                                                                                                                                                                                      |
| D-11 | Baixa     | `ui/LayoutDividido.tsx:26`                                            | Gap de 24 entre colunas, contra o gap global de 16 (sem regra).                                                                                                                                                                                                                                                 |

## 1.9 Tipografia sem hierarquia

- **`corpoForte` (16/600) aparece 50 vezes em 6 papéis diferentes**, e quando tudo é "forte", nada é:
  - rótulo de campo (`Campo.tsx:44`);
  - título de linha (`Linha.tsx:42`);
  - título de estado vazio (`EstadoVazio.tsx:33`);
  - título de aviso (`Aviso.tsx:52`);
  - texto de botão (`Botao.tsx:90`);
  - título de gráfico (`GraficoDeBarras.tsx:27`).
- **`titulo` (Bricolage 24/28) faz 4 papéis**: título de tela (`Tela.tsx:58`), título do evento (`CabecalhoDoEvento.tsx:30`), número de relatório (`GraficoDeBarras.tsx:93`) e nome do app na lateral (`AbasDoApp.web.tsx:166`).
- **`subtitulo` (Bricolage 600 18) é o título de todos os 170 cartões** (`Cartao.tsx:39`), e esse peso não existe no mockup.
- **Todo texto secundário é `apoio` 14.** Não há legenda 13 (meta, ajuda, referência) nem leitura 17 (o versículo sai em 16 em `CartaoDoVersiculo.tsx:29`; no mockup é 17/26).
- **Maiúsculas são digitadas à mão** (`TelaAoVivo.tsx:242,255,264,305`) e não há espaçamento entre letras. Não existe papel de sobrancelha.
- **`rotulo` 12/600 cobre usos demais**: rótulo de segmento, cabeçalho de dia, chip, rótulo de cronômetro e de aba na web. É pequeno demais para controles.
- **Números sem `tabular-nums`** (fora do Ao vivo), então os dígitos mudam de largura:
  - horas em listas (`LinhaDoEvento.tsx:80`, `TelaTimelineDoDia.tsx:257`);
  - contagens (`TelaCheckin.tsx:183`);
  - relatórios (`GraficoDeBarras.tsx:63,93`).

## 1.10 Telas com cara de formulário padrão

| Tela                                                                                | Por quê                                                               |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Criar e editar evento (`CamposDoEvento.tsx`)                                        | 13 campos de texto empilhados, data e hora digitadas, rádio em caixas |
| Convidar (`TelaConvidar.tsx`)                                                       | Dois grupos de rádio em caixas, campo, caixa de marcar e botão longo  |
| Cadastro por convite (`CadastroPorConvite.tsx`)                                     | Fluxo de 3 passos sem indicador, tudo num cartão                      |
| Perfil, seus dados (`TelaPerfil.tsx:219-258`)                                       | Formulário aberto no topo da área pessoal                             |
| Versículo (`TelaVersiculo.tsx:72-107`)                                              | Caixa de marcar, campo "HH:MM" e botão Salvar                         |
| Notificações (`TelaNotificacoes.tsx`)                                               | 8 caixas de marcar                                                    |
| Criar comunidade (`TelaNovaComunidade.tsx`)                                         | Cor escolhida pelo nome                                               |
| Check-in (`TelaCheckin.tsx`)                                                        | 3 cartões com campos e botões empilhados                              |
| Excluir conta, Novo pedido, Novo aviso, Nova sugestão, Regra da série, Mudar status | Campos de texto e botão largo no fim, sem barra de ação fixa          |

## 1.11 Conflitos entre o mockup e as regras (pedem decisão do dono)

1. **Cartões translúcidos contra "conteúdo sempre em superfície opaca" (CLAUDE.md §7).**
   - **O conflito:** os cartões de versículo e de escala do mockup são branco a 7% sem desfoque. Sobre o brilho violeta, o terço esquerdo do cartão ganha um tom violeta (composição `#453F7E` contra `#232139` opaco).
   - **O contraste se sustenta:** nesse ponto ele continua alto (texto 8,45:1, texto suave 5,62:1, destaque 5,30:1), desde que a Aurora role junto com o conteúdo.
   - **Recomendação:** implementar o cartão opaco `#232139` por padrão (cumpre a regra hoje) e deixar a translucidez atrás de um token (`VIDRO.conteudo: 'opaco' | 'translucido'`). Se o dono quiser a fidelidade total, registrar um ADR que altere a §7 para "translúcido sem desfoque é permitido sobre a Aurora quando o par composto no pior ponto passar AA, com teste".
2. **"Sincronizado 14:32" sobre o brilho coral.**
   - **O conflito:** com o brilho na posição do mockup (topo -140, direita -120), o texto 13 em `#C9C4EC` cai para 4,29:1 no ponto mais claro, abaixo de 4,5.
   - **Correção:** deslocar o brilho 20 pt para cima e 20 para a direita (topo -160, direita -140). O pior ponto sobe para cerca de 5,2:1 e o visual praticamente não muda.
3. **Barra de abas a 72% de opacidade.**
   - **O conflito:** quando o cartão de destaque claro passa por baixo da barra durante a rolagem, o rótulo inativo cai para 4,11:1 e o ativo para 3,14:1.
   - **Correção:** opacidade de 86% no escuro e de 80% no claro. Sobre o fundo a diferença é imperceptível (`#1C1A3B` contra `#1B1838`).
4. **Contorno do botão secundário a 30%.**
   - **O conflito:** dá 2,69:1 contra o cartão, e o projeto exige 3:1 para a borda de componente (`PARES_OBRIGATORIOS`, par `borda`).
   - **Correção:** 36%, que dá 3,26:1.
5. **Botões de 44 no mockup, contra o pedido de 48 para campos e botões lado a lado.**
   - **Adotar:**
     - **48** em formulários e na barra de ação;
     - **44** dentro de cartões, como no mockup;
     - **48 em tudo no Android**, para seguir o Material.
6. **Nomes das abas.**
   - **O conflito:** o plano §6 diz Programações, Comunidade e Perfil, mais "Mais"; o mockup aprovado diz Programas, Equipe e Perfil.
   - **Recomendação:** seguir o mockup e registrar a decisão em `docs/DECISOES.md`. O conteúdo de "Mais" vai para as categorias do Perfil.
7. **Tema claro.** O mockup só mostra o escuro. O tema claro desta especificação é derivado, com o cartão de destaque invertido em índigo `#1F1B4D`, e precisa de aprovação (mockup do Início claro, seção 4.1).
8. **Face ID.**
   - **Situação:** não existe no código.
   - **O que pede:** a dependência gratuita `expo-local-authentication`, o texto `NSFaceIDUsageDescription` e a decisão de produto (bloquear ao abrir? depois de quanto tempo?).
9. **Eixo óptico da Bricolage.**
   - **O risco:** o mockup na web aplica o eixo óptico automático (cerca de 34 no display). A fonte estática do `@expo-google-fonts` pode vir em outro valor e parecer mais larga.
   - **O que fazer:** conferir na captura lado a lado do D1. Se divergir, gerar instâncias estáticas com fonttools (gratuito): eixo 36 para display e 24 para títulos.

## 1.12 Os 10 problemas mais graves, em ordem

1. Barra de abas nativa no lugar da barra flutuante do mockup, com abas e rótulos errados (K-01, K-02).
2. Cabeçalho: faixa cinza de largura total no lugar da pílula, e 54 rotas com header nativo e título duplicado (K-03, K-04, K-06).
3. Sem Aurora: fundo chapado em todas as telas (K-05).
4. Botão de pílula genérico: raio 999, texto 16, contorno 1,5 com fundo, sem estados desenhados e largura total por padrão (C-01 a C-05).
5. Cartão com borda lavanda forte e cabeçalho de ícone e título; não existe o cartão de destaque claro nem a sobrancelha (C-19 a C-21).
6. Hierarquia tipográfica achatada: título de aba 24 em vez de 34; `corpoForte` em 6 papéis; faltam os papéis 15, 13, 12 (sobrancelha), 17 e 11 (P-01, K-08, 1.9).
7. Campo: 44 de altura, fundo igual ao cartão, borda que engrossa e desloca o texto, rótulo pesado, três eixos esquerdos; data e hora digitadas (C-10 a C-18).
8. Paredes de botões e telas-formulário: Ações do evento (8 botões), Oração (4 por cartão), Agenda (5 linhas de controle), Detalhe do evento (10 cartões iguais) (T-06, T-12, T-13, T-28).
9. Início sem hierarquia (7 cartões iguais, vazios ocupando espaço); sem comunidade, estado vazio sem ação e sem caminho para o Criador (T-01, T-03, T-05).
10. Tokens incompletos: sem elevação, vidro, Aurora, tons de chip ou espaçamento entre letras; escala sem os valores do mockup; superfície e borda divergentes; margem 16 em vez de 20 (P-02 a P-07, K-07).

---

# 2. Sistema de design especificado

Princípios, nesta ordem de precedência:

1. **O mockup manda.** Todo valor abaixo marcado com (M) foi copiado de `Main.dc.html`. O que não está no mockup foi derivado dele e está marcado com (D).
2. **Contraste AA não se negocia.** Onde o mockup falha, o ajuste é o menor possível e está documentado (1.11).
3. **Cada tela tem uma coisa mais importante**, no máximo um cartão de destaque e no máximo um botão primário visível.
4. **Escala fixa.** As telas só usam a escala de layout. Os valores finos do mockup ficam dentro dos componentes.
5. **O sistema nasce da repetição.** Nenhum componente novo entra sem pelo menos 3 usos reais. Esta especificação tem 25 componentes, e todos têm mais de 3 usos entre as 54 rotas.

## 2.1 Estrutura de tokens (`packages/tokens`)

```ts
// cores.ts: três paletas por tema (base, inversa para o cartão de destaque) e o vidro.
export interface Paleta {
  fundo: string
  superficie: string
  superficieBorda: string
  superficieElevada: string
  campoFundo: string
  campoBorda: string
  texto: string
  textoSuave: string
  destaque: string
  primaria: string
  primariaPressionada: string
  sobrePrimaria: string
  contorno: string
  tonal: string
  tonalOpaco: string
  tonalBorda: string
  pressionado: string
  separador: string
  esqueleto: string
  veu: string
  sucesso: string
  sucessoFundo: string
  alerta: string
  alertaFundo: string
  erro: string
  erroFundo: string
  erroCheio: string
  sobreErro: string
  info: string
  infoFundo: string
  quenteFundo: string
  neutroFundo: string
  foco: string
}
export const TEMAS = { escuro: { base, inverso }, claro: { base, inverso } }
```

O tema inverso se aplica por um provedor (`ProvedorDeTemaInverso`). Todo filho do cartão de destaque e do toast lê a paleta inversa sem código especial.

## 2.2 Cores

### Tema escuro (Aurora noite)

| Token                               | Valor                                | Origem                                | Uso                                                                |
| ----------------------------------- | ------------------------------------ | ------------------------------------- | ------------------------------------------------------------------ |
| fundo                               | `#12102A`                            | (M)                                   | Tela                                                               |
| superficie                          | `#232139`                            | (M) composto: branco 7% sobre o fundo | Cartão de vidro (opaco por padrão)                                 |
| superficie translúcida (só com ADR) | `rgba(255,255,255,0.07)`             | (M)                                   | Cartão de vidro, opção B                                           |
| superficieBorda                     | `rgba(255,255,255,0.14)`             | (M)                                   | Borda do cartão de vidro                                           |
| superficieElevada                   | `#2B2848`                            | (D)                                   | Folha e diálogo (fallback opaco), menu                             |
| campoFundo                          | `#322F4C`                            | (D64)                                 | Caixa do campo (opaca, um degrau acima do cartão)                  |
| campoBorda                          | `#7C77A8`                            | (D64)                                 | Borda do campo (3,75:1 contra o cartão)                            |
| texto                               | `#F5F3FF`                            | (M)                                   | Texto principal                                                    |
| textoSuave                          | `#C9C4EC`                            | (M)                                   | Meta, ajuda, rótulo de campo, aba inativa                          |
| destaque                            | `#FFB199`                            | (M)                                   | Sobrancelha, link, aba ativa, botão terciário                      |
| primaria                            | `#FF8A65`                            | (M)                                   | Botão primário, check, interruptor ligado, avatar do usuário       |
| primariaPressionada                 | `#F0764F`                            | (D)                                   | Primário pressionado                                               |
| sobrePrimaria                       | `#1A0F0A`                            | (M)                                   | Texto sobre o primário                                             |
| contorno                            | `rgba(255,255,255,0.36)`             | (M ajustado de 0,30)                  | Borda do botão secundário                                          |
| tonal                               | `rgba(255,255,255,0.08)`             | (M)                                   | Fundo da pílula da comunidade, botão só ícone, trilho de segmentos |
| tonalOpaco                          | `#25233B`                            | (D)                                   | Tonal com Reduzir transparência                                    |
| tonalBorda                          | `rgba(255,255,255,0.18)`             | (M)                                   | Borda da pílula, pílula de filtro inativa                          |
| pressionado                         | `rgba(255,255,255,0.08)`             | (D)                                   | Camada de toque em linhas e secundários                            |
| separador                           | `rgba(255,255,255,0.08)`             | (D)                                   | Linha entre itens de lista                                         |
| esqueleto                           | `rgba(255,255,255,0.06)`             | (D)                                   | Bloco de carregamento                                              |
| veu                                 | `rgba(8,6,24,0.60)`                  | (D)                                   | Atrás de diálogos (web)                                            |
| sucesso / sucessoFundo              | `#7FE0B0` / `rgba(127,224,176,0.16)` | (M) / (D)                             | Check de sincronizado, chip "Confirmada", "Presente"               |
| alerta / alertaFundo                | `#FFD166` / `rgba(255,209,102,0.16)` | (D)                                   | Pendências, "Adiado", sem conexão                                  |
| erro / erroFundo                    | `#FF8A8A` / `rgba(255,138,138,0.16)` | (D)                                   | Erro de campo, "Cancelado"                                         |
| erroCheio / sobreErro               | `#FF8A8A` / `#2A0A0A`                | (D)                                   | Botão destrutivo cheio                                             |
| info / infoFundo                    | `#B3A8FF` / `rgba(157,143,255,0.16)` | (D)                                   | Aviso informativo, "Substituição pedida"                           |
| quenteFundo                         | `rgba(255,177,153,0.16)`             | (D)                                   | Chip quente (local, "Ao vivo", "Fixado"), pílula de filtro ativa   |
| neutroFundo                         | `rgba(255,255,255,0.10)`             | (D)                                   | Chip neutro ("Rascunho", "Anônima")                                |
| foco                                | `#FF8A65`                            | (D64)                                 | Anel de foco (coral, igual à `primaria`)                           |

**Inverso do escuro.** É usado no cartão de destaque claro e no toast. Os valores são os do mockup e, onde ele não define, os do tema claro.

| Token                    | Valor                 |
| ------------------------ | --------------------- |
| fundo                    | `#F5F3FF` (M)         |
| texto                    | `#1B1838` (M)         |
| textoSuave               | `#4B4670` (M)         |
| destaque                 | `#8A2E12` (M)         |
| quenteFundo              | `#FFE3D9` (M)         |
| primaria / sobrePrimaria | `#C2491F` / `#FFFFFF` |
| contorno                 | `#857FAF`             |

### Tema claro (Aurora manhã), derivado

| Token                                          | Valor                                                     | Uso                                                       |
| ---------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| fundo                                          | `#F7F5FF`                                                 | Tela                                                      |
| superficie / superficieElevada                 | `#FFFFFF` / `#FFFFFF`                                     | Cartão de vidro (opaco) com sombra de nível cartão; folha |
| superficieBorda                                | `rgba(27,24,56,0.08)`                                     | Borda do cartão                                           |
| campoFundo / campoBorda                        | `#F3F1FA` / `#857FAF`                                     | Campo (3,72:1 contra o branco, D64)                       |
| texto / textoSuave                             | `#1B1838` / `#4B4670`                                     | Texto                                                     |
| destaque                                       | `#8A2E12`                                                 | Sobrancelha, link, aba ativa                              |
| primaria / primariaPressionada / sobrePrimaria | `#C2491F` / `#A93D18` / `#FFFFFF`                         | Botão primário                                            |
| contorno                                       | `#857FAF`                                                 | Botão secundário                                          |
| tonal / tonalOpaco / tonalBorda                | `rgba(27,24,56,0.05)` / `#ECEAF5` / `rgba(27,24,56,0.12)` | Pílula, só ícone, trilho                                  |
| pressionado / separador                        | `rgba(27,24,56,0.06)` / `rgba(27,24,56,0.08)`             | Toque e separadores                                       |
| esqueleto / veu                                | `#ECE9F8` / `rgba(27,24,56,0.40)`                         | Carregamento e véu                                        |
| sucesso / sucessoFundo                         | `#16794B` / `#E3F4EA`                                     |                                                           |
| alerta / alertaFundo                           | `#8A5A00` / `#FFF1D6`                                     |                                                           |
| erro / erroFundo                               | `#B42318` / `#FDE4E1`                                     |                                                           |
| erroCheio / sobreErro                          | `#B42318` / `#FFFFFF`                                     |                                                           |
| info / infoFundo                               | `#4B3FC4` / `#ECEAFD`                                     |                                                           |
| quenteFundo / neutroFundo                      | `#FFE3D9` / `#EEEBFA`                                     |                                                           |
| foco                                           | `#4B3FC4`                                                 |                                                           |

**Inverso do claro.** É usado no cartão de destaque e no toast do tema claro: índigo profundo, "a noite dentro do dia".

| Token                    | Valor                    |
| ------------------------ | ------------------------ |
| fundo                    | `#1F1B4D`                |
| texto                    | `#F5F3FF`                |
| textoSuave               | `#C9C4EC`                |
| destaque                 | `#FFB199`                |
| quenteFundo              | `rgba(255,177,153,0.18)` |
| primaria / sobrePrimaria | `#FF8A65` / `#1A0F0A`    |
| contorno                 | `rgba(255,255,255,0.36)` |

### Cores de comunidade e avatar

As seis cores atuais (`plataforma/TelaNovaComunidade.tsx:19-26`) continuam. Iniciais sempre em `#FFFFFF`, porque todas passam:

| Cor    | Hex       | Contraste com branco |
| ------ | --------- | -------------------- |
| Índigo | `#5B4BDB` | 6,04:1               |
| Coral  | `#C2410C` | 5,18:1               |
| Verde  | `#15803D` | 5,01:1               |
| Azul   | `#1D4ED8` | 6,70:1               |
| Roxo   | `#7E22CE` | 6,98:1               |
| Âmbar  | `#B45309` | 5,02:1               |

O avatar do próprio usuário usa `primaria` com `sobrePrimaria` (M: "JC" em `#FF8A65` sobre `#1A0F0A`).

## 2.3 Fundo Aurora

| Brilho  | Cor (escuro)                 | Cor (claro)              | Diâmetro | Posição                                               | Gradiente                                             |
| ------- | ---------------------------- | ------------------------ | -------- | ----------------------------------------------------- | ----------------------------------------------------- |
| Coral   | `rgba(255,138,101,0.55)` (M) | `rgba(255,138,101,0.30)` | 380 (M)  | topo -160, direita -140 (M deslocado 20/20, ver 1.11) | Radial: cor no centro, transparente a 70% do raio (M) |
| Violeta | `rgba(124,108,255,0.45)` (M) | `rgba(124,108,255,0.22)` | 360 (M)  | topo 120, esquerda -160 (M)                           | Igual                                                 |

**Regras:**

- **Rolagem.** A Aurora é uma camada absoluta no topo do conteúdo rolável e rola junto. Assim, o brilho coral fica sempre atrás da linha do cabeçalho e nunca atrás do texto de um cartão.
- **Onde aparece:**
  - **intensidade total:** raízes de aba, Entrar, Convite, Primeiro acesso, Face ID e Mapa da missão;
  - **60% da opacidade, mesma geometria:** telas de pilha;
  - **sem Aurora:** Ao vivo e Aumentar contraste.
- **Implementação:**
  - **Padrão:** `backgroundImage`/`experimental_backgroundImage` com `radial-gradient(...)`, que o React Native suporta desde a 0.80, ainda como API experimental ([documentação](https://reactnative.dev/docs/0.81/view-style-props)).
  - **Reserva:** PNG @3x por tema (1170×2532) com `expo-image`, se algum Android não renderizar o gradiente.
- **Reduzir transparência:** a Aurora fica, porque é fundo e não superfície translúcida.

## 2.4 Tipografia

As famílias carregadas por peso (`ui/fontes.ts`) passam a ser:

- `BricolageGrotesque_800ExtraBold`;
- `Inter_400Regular`;
- `Inter_500Medium` (nova);
- `Inter_600SemiBold`.

A família `BricolageGrotesque_600SemiBold` sai.

A reserva é a fonte do sistema (SF Pro ou Roboto), aplicada se o arquivo não carregar (`app/_layout.tsx:33`).

| Papel (token)  | Família                                 | Tamanho/entrelinha | Espaçamento entre letras | Caixa                                                    | Teto de escala (`maxFontSizeMultiplier`)          | Uso exclusivo                                                                         |
| -------------- | --------------------------------------- | ------------------ | ------------------------ | -------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `display`      | Bricolage 800                           | 34/38 (M)          | -0,5 (M)                 | normal                                                   | 1,6                                               | Saudação do Início; título das 5 raízes de aba                                        |
| `tituloTela`   | Bricolage 800                           | 28/32 (D)          | -0,3                     | normal                                                   | 1,8                                               | Título das telas de pilha e das folhas grandes                                        |
| `tituloCartao` | Bricolage 800                           | 24/28 (M)          | -0,2                     | normal                                                   | 2,0                                               | Título do cartão de destaque, mês da agenda, nome no Perfil, título de diálogo        |
| `numero`       | Bricolage 800, `tabular-nums`           | 28/32 (D)          | 0                        | normal                                                   | 1,6                                               | Números de relatório e contador do check-in                                           |
| `cronometro`   | Bricolage 800, `tabular-nums`           | 64/68 (D)          | -1                       | normal                                                   | 1,4                                               | Ao vivo                                                                               |
| `leitura`      | Inter 400                               | 17/26 (M)          | 0                        | normal                                                   | sem teto                                          | Versículo, texto de pedido de oração, descrição de evento, corpo de aviso             |
| `tituloItem`   | Inter 600                               | 16/22 (M)          | 0                        | normal                                                   | sem teto                                          | Título de linha, "Louvor · violão", nome de pessoa, título de estado vazio e de aviso |
| `corpo`        | Inter 400                               | 15/22 (D)          | 0                        | normal                                                   | sem teto                                          | Texto de interface, descrição de estado vazio, texto de toast                         |
| `botao`        | Inter 600                               | 15/20 (M)          | 0                        | normal                                                   | 2,0                                               | Botões, pílula da comunidade, links terciários, segmento ativo (o inativo é 500)      |
| `lista`        | Inter 400 (hora em 600, `tabular-nums`) | 14/20 (M)          | 0                        | normal                                                   | sem teto                                          | Linhas compactas da programação ("16:05 Louvor") e pílulas de filtro (500)            |
| `rotulo`       | Inter 600                               | 13/18 (M)          | 0                        | normal                                                   | sem teto                                          | Rótulo de campo, meta forte ("Sábado · 16:00 · 60 min")                               |
| `legenda`      | Inter 400 (erro em 600)                 | 13/18 (M)          | 0                        | normal                                                   | sem teto                                          | Ajuda, erro de campo, meta, referência, status de sincronização                       |
| `sobrancelha`  | Inter 600                               | 12/16 (M)          | +1,0 (M)                 | MAIÚSCULAS por estilo (`textTransform`), nunca digitadas | 1,6                                               | Etiqueta de seção no cartão e acima de grupos                                         |
| `chip`         | Inter 600                               | 12/16 (M)          | 0                        | normal                                                   | 1,6                                               | Chip de estado                                                                        |
| `aba`          | Inter 600 (ativa) / 500 (inativa)       | 11/14 (M)          | 0                        | normal                                                   | 1,3 mais o visualizador de conteúdo grande do iOS | Rótulos da barra de abas                                                              |

**Regras:**

- **Hierarquia primeiro por peso e cor**, depois por tamanho. Numa tela comum, a sequência é `display` ou `tituloTela`, depois `tituloItem`, depois `corpo`, depois `legenda`.
- **Texto secundário** usa `textoSuave` (sempre 4,5:1 ou mais), nunca opacidade.
- **Números em coluna e horas** usam `fontVariant: ['tabular-nums']`.
- **Títulos** têm `accessibilityRole="header"` e `aria-level` por papel: `display` e `tituloTela` são 1, `tituloCartao` é 2, `sobrancelha` é 3 (corrige a revisão M6).

## 2.5 Espaço

A escala completa vai de 2 a 40. A coluna "Quem pode usar" é verificada por lint.

| Token | pt  | Quem pode usar   | Exemplos do mockup                                                               |
| ----- | --- | ---------------- | -------------------------------------------------------------------------------- |
| `e2`  | 2   | Só `src/ui`      | Ícone e rótulo da aba (M)                                                        |
| `e4`  | 4   | Telas e `src/ui` | Margem acima do display (M); rótulo e chip                                       |
| `e6`  | 6   | Só `src/ui`      | Padding da pílula (M); acima do título do destaque (M); ajuda abaixo do campo    |
| `e8`  | 8   | Telas e `src/ui` | Abaixo da sobrancelha (M); entre linhas da programação (M); padding da barra (M) |
| `e10` | 10  | Só `src/ui`      | Entre botões lado a lado (M); entre avatar e nome na pílula (M)                  |
| `e12` | 12  | Telas e `src/ui` | Entre colunas hora e título (M); entre a pílula e o status (M)                   |
| `e14` | 14  | Só `src/ui`      | Abaixo do título do destaque (M); antes das ações no cartão (M)                  |
| `e16` | 16  | Telas e `src/ui` | Intervalo entre blocos (M); margem da barra de abas (M)                          |
| `e18` | 18  | Só `src/ui`      | Padding de cartão (M)                                                            |
| `e20` | 20  | Telas e `src/ui` | Margem lateral da tela (M)                                                       |
| `e24` | 24  | Telas e `src/ui` | Distância da barra ao fundo (M); antes de um grupo novo                          |
| `e32` | 32  | Telas e `src/ui` | Folga acima da barra de abas                                                     |
| `e40` | 40  | Telas e `src/ui` | Respiro em telas de autenticação                                                 |

Lint em `src/funcionalidades/**`:

- proíbe literais numéricos em `style`;
- proíbe `ESPACO.e2`, `e6`, `e10`, `e14` e `e18`.

A migração é por codemod: `x1` vira `e4`, `x2` vira `e8`, `x3` vira `e12`, `x4` vira `e16`, `x5` vira `e20`, `x6` vira `e24`, `x8` vira `e32` e `x10` vira `e40`.

**Alturas** (`ALTURA`):

| Token              | Valor                                               |
| ------------------ | --------------------------------------------------- |
| `controle`         | 48                                                  |
| `controleCompacto` | 44 no iOS e na web, 48 no Android                   |
| `iconeSo`          | 44                                                  |
| `aba`              | 48 (M)                                              |
| `linha`            | 56                                                  |
| `pilula`           | 44 (M)                                              |
| `filtro`           | 36 visual, com `hitSlop` vertical de 4 (44 efetivo) |
| `chip`             | 24                                                  |

## 2.6 Raios

| Token      | pt      | Uso                                                          | Regra               |
| ---------- | ------- | ------------------------------------------------------------ | ------------------- |
| `celula`   | 10      | Célula do calendário, ladrilho de ícone 32, segmento interno | Concêntrico: 14 - 4 |
| `controle` | 14 (M)  | Botão, campo, trilho de segmentos, aviso, toast              |                     |
| `abaAtiva` | 20 (M)  | Pílula da aba ativa                                          | 28 - 8              |
| `cartao`   | 22 (M)  | Cartão de vidro, cartão de destaque, diálogo                 |                     |
| `barra`    | 28 (M)  | Barra de abas, topo da folha                                 |                     |
| `pilula`   | 999 (M) | Pílula da comunidade, chip, pílula de filtro, avatar         |                     |

Regra concêntrica: raio interno = raio externo - afastamento. Nenhum outro raio é permitido.

## 2.7 Elevação (`boxShadow` do React Native 0.76 em diante)

| Token       | Escuro                                    | Claro                                                               | Uso                                                     |
| ----------- | ----------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| `nenhuma`   | nenhuma                                   | nenhuma                                                             | Conteúdo no fluxo                                       |
| `cartao`    | nenhuma (a borda faz o papel; fidelidade) | `0px 1px 2px rgba(27,24,56,0.06), 0px 6px 16px rgba(27,24,56,0.06)` | Cartão de vidro                                         |
| `destaque`  | nenhuma (M)                               | `0px 10px 30px rgba(31,27,77,0.28)`                                 | Cartão de destaque                                      |
| `flutuante` | `0px 12px 32px rgba(0,0,0,0.40)`          | `0px 12px 32px rgba(27,24,56,0.14)`                                 | Barra de abas, toast, cabeçalho compacto, barra de ação |
| `folha`     | `0px -8px 40px rgba(0,0,0,0.50)`          | `0px -8px 40px rgba(27,24,56,0.18)`                                 | Folha e diálogo na web                                  |

## 2.8 Vidro e fallback opaco

O vidro só existe no que flutua: barra de abas, cabeçalho compacto, barra de ação e folha. O toast flutua, mas é opaco e usa a paleta inversa, para ser lido sobre qualquer conteúdo. A pílula da comunidade é tonal, sem desfoque.

| Superfície                                       | Escuro                                                                                | Claro                                                 | Desfoque | Fallback opaco (Reduzir transparência)  | Aumentar contraste                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------- | --------------------------------------- | ------------------------------------ |
| Barra de abas, cabeçalho compacto, barra de ação | `rgba(30,27,62,0.86)`, borda `rgba(255,255,255,0.16)` (M; opacidade ajustada de 0,72) | `rgba(255,255,255,0.80)`, borda `rgba(27,24,56,0.10)` | 20 (M)   | `#1E1B3E` / `#FFFFFF` com a mesma borda | Opaco com borda de 2 na cor do texto |
| Folha                                            | Sistema (formSheet do iOS 26) ou `rgba(43,40,72,0.92)`                                | `rgba(255,255,255,0.92)`                              | 30       | `superficieElevada`                     | Opaco com borda superior de 2        |
| Pílula da comunidade, botão só ícone             | `tonal` (sem desfoque)                                                                | `tonal`                                               | nenhum   | `tonalOpaco`                            | Borda de 2 na cor do texto           |

**Implementação** (`ui/Vidro.tsx`, ordem atual mantida):

1. **Reduzir transparência ou Aumentar contraste:** opaco.
2. **`GlassView` do iOS 26:** `glassEffectStyle="regular"`, com `tintColor` igual ao fundo do token (corrige K-04).
3. **`BlurView`:** `intensity` 50 no iOS.
4. **Web:** desfoque real (`backdrop-filter` com o raio do token) sobre a tinta; sem suporte a desfoque, opaco.
5. **Android:** cor opaca do token (`opaco`). A tinta translúcida sem desfoque deixava o conteúdo nítido sob a barra (achado da D5 em 15/11/2026).

## 2.9 Movimento

| Token      | ms                | Curva                  | Uso                                          | Com Reduzir movimento |
| ---------- | ----------------- | ---------------------- | -------------------------------------------- | --------------------- |
| `toque`    | 120               | saída suave            | Cor de pressionado e escala 0,98             | Só a cor, sem escala  |
| `aparecer` | 200               | saída suave            | Cabeçalho compacto, toast (sobe 8 e aparece) | Só dissolve, 120 ms   |
| `folha`    | sistema           | sistema                | Folhas nativas                               | Sistema               |
| `pulso`    | 1200, ida e volta | entrada e saída suaves | Esqueleto                                    | Estático              |

Não há animação decorativa contínua. A celebração do Mapa da missão é estática com Reduzir movimento.

## 2.10 Iconografia

- **Fontes:** SF Symbols no iOS e Material Symbols no Android e na web (via `expo-symbols`), com peso médio. O traço de 2 px do mockup corresponde ao peso médio.
- **Tamanhos:** 22 na barra de abas (M); 18 em botões, avisos e toast; 18 dentro do ladrilho de 32 nas linhas; 16 no status, no erro de campo e no chip; 14 no chevron (peso semibold).
- **Cor:** sempre de token. O ícone nunca é o único sinal.
- **Cabeçalho de cartão:** não tem ícone. Quem identifica o cartão é a sobrancelha.

## 2.11 Tabela de contraste

Todo par texto/fundo e de interface, nos dois temas. O mínimo é 4,5 para texto e 3 para interface e texto a partir de 18,66 pt em negrito.

| Par                                                                     | Escuro                           | Claro                            | Mínimo |
| ----------------------------------------------------------------------- | -------------------------------- | -------------------------------- | ------ |
| texto sobre fundo                                                       | 16,9                             | 15,8                             | 4,5    |
| textoSuave sobre fundo                                                  | 11,3                             | 8,1                              | 4,5    |
| destaque sobre fundo                                                    | 10,6                             | 7,9                              | 4,5    |
| texto sobre superficie                                                  | 14,2                             | 17,0                             | 4,5    |
| textoSuave sobre superficie                                             | 9,5                              | 8,7                              | 4,5    |
| destaque sobre superficie                                               | 8,9                              | 8,5                              | 4,5    |
| sucesso sobre superficie                                                | 9,8                              | 5,4                              | 4,5    |
| alerta sobre superficie                                                 | 10,8                             | 5,8                              | 4,5    |
| erro sobre superficie                                                   | 6,9                              | 6,6                              | 4,5    |
| info sobre superficie                                                   | 7,4                              | 7,5                              | 4,5    |
| texto sobre superficieElevada                                           | 12,8                             | 17,0                             | 4,5    |
| textoSuave sobre superficieElevada                                      | 8,5                              | 8,7                              | 4,5    |
| texto sobre campoFundo                                                  | 11,6                             | 15,2                             | 4,5    |
| campoExemplo (exemplo) sobre campoFundo                                 | 5,3                              | 4,8                              | 4,5    |
| sobrePrimaria sobre primaria                                            | 8,1                              | 4,9                              | 4,5    |
| sobrePrimaria sobre primariaPressionada                                 | 6,6                              | 6,2                              | 4,5    |
| sobreErro sobre erroCheio                                               | 8,1                              | 6,6                              | 4,5    |
| chip sucesso (texto sobre fundo tonal composto)                         | 6,7                              | 4,8                              | 4,5    |
| chip alerta                                                             | 7,3                              | 5,2                              | 4,5    |
| chip erro                                                               | 5,2                              | 5,4                              | 4,5    |
| chip info                                                               | 5,6                              | 6,3                              | 4,5    |
| chip quente (destaque sobre quenteFundo)                                | 6,3                              | 7,0                              | 4,5    |
| chip neutro (textoSuave sobre neutroFundo)                              | 7,0                              | 7,4                              | 4,5    |
| Inverso: texto sobre fundo inverso                                      | 15,5 (`#1B1838` sobre `#F5F3FF`) | 14,5 (`#F5F3FF` sobre `#1F1B4D`) | 4,5    |
| Inverso: textoSuave                                                     | 7,9                              | 9,6                              | 4,5    |
| Inverso: destaque                                                       | 7,7                              | 9,1                              | 4,5    |
| Inverso: chip quente                                                    | 7,0 (`#8A2E12` sobre `#FFE3D9`)  | 6,2                              | 4,5    |
| Inverso: botão primário (texto)                                         | 4,9                              | 8,1                              | 4,5    |
| Pílula: texto sobre tonal composto                                      | 13,9                             | 14,3                             | 4,5    |
| Status "Sincronizado" sobre o pior ponto da Aurora (geometria ajustada) | 5,2                              | 6,4                              | 4,5    |
| Aba inativa sobre a barra em repouso                                    | 10,1                             | 8,6                              | 4,5    |
| Aba inativa sobre a barra com o destaque passando por baixo             | 6,6                              | 5,8                              | 4,5    |
| Aba ativa sobre a pílula, barra em repouso                              | 6,7                              | 7,2                              | 4,5    |
| Aba ativa sobre a pílula, com o destaque por baixo                      | 4,6                              | 4,9                              | 4,5    |
| Cartão translúcido (opção B): texto, suave e destaque sobre o violeta   | 8,5 / 5,6 / 5,3                  | não se aplica                    | 4,5    |
| Interface: primaria contra fundo                                        | 8,0                              | 4,6                              | 3      |
| Interface: campoBorda contra superficie                                 | 3,75                             | 3,7                              | 3      |
| Interface: campoBorda contra campoFundo                                 | 3,1                              | 3,3                              | 3      |
| Interface: contorno contra superficie                                   | 3,3                              | 3,7                              | 3      |
| Interface: contorno contra fundo                                        | 3,3                              | 3,4                              | 3      |
| Interface: foco contra fundo                                            | 8,0                              | 4,6                              | 3      |
| Interface: foco contra superficie                                       | 6,7                              | 4,9                              | 3      |
| Interface: foco contra o inverso                                        | 4,5 (`#C2491F` sobre `#F5F3FF`)  | 6,9 (`#FF8A65` sobre `#1F1B4D`)  | 3      |
| Interface: check de sincronizado sobre a Aurora                         | 4,4                              | não se aplica                    | 3      |
| Iniciais `#FFFFFF` sobre as 6 cores de comunidade                       | 5,0 a 7,0                        | 5,0 a 7,0                        | 4,5    |

**Fica fora da tabela:**

- **Componentes desabilitados:** isentos pela WCAG 1.4.3, mas o motivo que aparece abaixo deles segue a tabela.
- **Separadores e bordas de cartão:** decorativos. A borda do campo e a do botão secundário não são decorativas e estão na tabela.

**Teste.** Todos esses pares entram em `PARES_OBRIGATORIOS`. Para isso, `contraste.ts` ganha uma função `compor(rgba, hexDeBaixo)`.

## 2.12 Componentes

Para todos os componentes:

- **Estados obrigatórios:** normal, pressionado, foco, desabilitado, carregando (quando houver ação assíncrona) e erro (quando houver entrada).
- **Foco:** anel de 2 na cor `foco`, afastado 2, com raio igual ao do componente mais 2. Usa as propriedades `outline*` do React Native 0.77 em diante e aparece com teclado (web, Android e Acesso Total por Teclado do iOS).
- **Estado acessível:** usar `aria-*` (`aria-checked`, `aria-selected`, `aria-disabled`, `aria-busy`), conforme a revisão B1.

### 2.12.1 Botão (substitui `ui/Botao.tsx` e o botão de `ui/BotoesDeOrdem.tsx`)

> **Atualizado em 22/11/2026 (D64):** as medidas, as cores e os estados deste componente passaram a ser os de [controles-v2.md](controles-v2.md); onde esta seção divergir, vale o controles-v2.

**Anatomia:** [ícone de 18, opcional] + 8 + rótulo (`botao` 15/20 600). No carregamento, um indicador de 18 entra no lugar do ícone (ou à esquerda do rótulo) e o rótulo fica.

**Tamanhos:**

| Tamanho  | Altura                 | Padding horizontal | Raio                           | Onde                                                                   |
| -------- | ---------------------- | ------------------ | ------------------------------ | ---------------------------------------------------------------------- |
| Grande   | 48                     | 20                 | 14                             | Formulários, barra de ação, autenticação, estado vazio de tela inteira |
| Médio    | 44 (M) (48 no Android) | 16                 | 14                             | Ações dentro de cartão, linhas, avisos                                 |
| Só ícone | 44×44                  | 0                  | 14 (22 no cabeçalho: circular) | Voltar, mais ações, "+", subir e descer                                |

**Variantes e estados** (escuro / claro):

| Variante         | Normal                                                       | Pressionado                       | Desabilitado                                  |
| ---------------- | ------------------------------------------------------------ | --------------------------------- | --------------------------------------------- |
| Primário         | fundo `primaria`, texto `sobrePrimaria`, sem borda           | fundo `primariaPressionada`       | fundo `tonal`, texto `texto` a 40%, sem borda |
| Secundário       | fundo transparente, borda de 1 `contorno`, texto `texto` (M) | fundo `pressionado`               | borda `tonalBorda`, texto a 40%               |
| Terciário        | sem fundo nem borda, texto `destaque`                        | fundo `quenteFundo` com raio 14   | texto a 40%                                   |
| Destrutivo       | fundo transparente, borda de 1 `erro`, texto `erro`          | fundo `erroFundo`                 | borda `tonalBorda`, texto a 40%               |
| Destrutivo cheio | fundo `erroCheio`, texto `sobreErro`                         | fundo escurecido 8%               | igual ao primário desabilitado                |
| Só ícone         | fundo `tonal`, ícone 18 a 20 `texto`                         | fundo `pressionado` sobre `tonal` | ícone a 40%                                   |

**Outros estados:**

- **Pressionado:** além da cor, escala 0,98 em 120 ms (sem escala com Reduzir movimento). No Android, `android_ripple` com a cor `pressionado`.
- **Foco:** anel de 2 `foco`, afastado 2, raio 16.
- **Carregando:** largura travada na medida do estado normal (`minWidth` lido de `onLayout`), toques ignorados, `aria-busy`.
- **Erro:** o botão não tem estado de erro. O erro aparece num Aviso acima dele ou num toast, e o botão volta ao normal.
- **Desabilitado com motivo:** o texto do motivo (`legenda` 13/18 `textoSuave`) fica 6 abaixo do botão, alinhado à esquerda, e também vai para `accessibilityHint`. É o padrão atual e está correto.

**Regras de uso:**

- **Um primário visível por tela** (ou por cartão de destaque).
- **No máximo 2 botões por linha**, cada um com `flex: 1` e intervalo de 10 (M). Com 3 ou mais ações, ficam o primário e um só ícone "Mais ações" (`ellipsis`), que abre uma folha.
- **Largura automática por padrão.** A largura total fica só em formulário, barra de ação e estado vazio de tela inteira.
- **Rótulo:** verbo e objeto, até 22 caracteres. O nome da comunidade não entra no rótulo: "Criar convite" e não "Criar convite para Jovens Central"; o contexto já está no cabeçalho e no rótulo acessível.
- **Fonte grande:** com `fontScale` de 1,35 ou mais, pares lado a lado viram coluna.
- **Ícone:** só quando ajuda a reconhecer a ação (QR, compartilhar, "+"), nunca em um botão do par e não no outro.

### 2.12.2 Campo de texto e de senha (substitui `ui/Campo.tsx`)

> **Atualizado em 22/11/2026 (D64):** as medidas, as cores e os estados deste componente passaram a ser os de [controles-v2.md](controles-v2.md); onde esta seção divergir, vale o controles-v2.

**Anatomia**, de cima para baixo. Rótulo, caixa, ajuda e erro começam todos em x=0 (a borda esquerda da caixa).

1. **Rótulo:** `rotulo` 13/18 600 `textoSuave`, sempre visível. Campo opcional: "(opcional)" no próprio rótulo, em 400.
2. **8** de espaço.
3. **Caixa:** 48 de altura (multilinha a partir de 120), raio 14, fundo `campoFundo`, borda de 1 `campoBorda`, padding horizontal de 16. Texto Inter 400 16/22 `texto` (16 evita o zoom do Safari). O exemplo vai em `textoSuave` e é só exemplo, nunca instrução.
   - **Ícone à esquerda** (busca): 18, em x=14; o texto começa em x=40.
   - **Ação à direita** (mostrar senha, limpar): só ícone de 44×44, a 2 da borda direita; o texto termina 48 antes.
   - **Sufixo** ("min"): `legenda` `textoSuave`, a 16 da borda direita.
4. **6** de espaço.
5. **Linha de apoio**, uma só:
   - ajuda (`legenda` 13/18 `textoSuave`), **ou**
   - erro (ícone `exclamationmark.circle.fill` de 16 `erro` + 6 + texto `legenda` 600 `erro`). O texto do erro diz como corrigir ("Use o formato 07:00"), porque substitui a ajuda.
   - O contador fica à direita da mesma linha, com `tabular-nums`.

**Estados:**

| Estado              | Visual                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal / preenchido | Borda de 1 `campoBorda`                                                                                                                                                                                       |
| Foco                | Borda de 1 `foco` mais anel interno de 1 (`boxShadow: 'inset 0 0 0 1px'`), 2 visíveis sem deslocar o texto (corrige C-12)                                                                                     |
| Erro                | Borda de 1 `erro` mais anel interno de 1 `erro`; a linha de erro substitui a ajuda. É anunciado no iOS por `announceForAccessibility` (revisão A1) e ligado por `aria-describedby`/`aria-invalid` na web (M2) |
| Desabilitado        | Fundo transparente, borda tracejada de 1 `tonalBorda`, texto e rótulo `textoSuave`                                                                                                                            |
| Somente leitura     | Fundo `tonal`, sem borda, texto `texto`, selecionável                                                                                                                                                         |
| Validando           | Indicador de 16 à direita                                                                                                                                                                                     |

**Medidas e composição:**

- **Altura do bloco:** com ajuda, 18 + 8 + 48 + 6 + 18 = 98; sem ajuda, 74. O intervalo entre campos é 16.
- **Lado a lado** (Data e Hora; Nome e Duração): proporção 1,4 para 1 ou 2 para 1, intervalo de 12. Se só um dos campos tem ajuda, os dois reservam a linha de 18, para a próxima linha começar no mesmo y.
- **Campo e botão na mesma linha:** os dois com 48, `alignItems: flex-end`. O rótulo fica só sobre o campo e o erro abaixo da linha inteira. É o caso de "código de entrada + Marcar" e "nome + Registrar".

**Tipos:** texto, senha, e-mail, telefone, número, multilinha, busca, código (`numero` 20/24 600 `tabular-nums`, espaçamento de 8, 6 dígitos), data e hora.

### 2.12.3 Campo de data e de hora (novo)

- **Visual:** igual ao Campo, mas a caixa é tocável e mostra o valor formatado ("Sáb., 15 de nov. de 2026" ou "16:00"), com o ícone `calendar` ou `clock` de 18 à direita.
- **Toque:** abre o seletor nativo. Usar `DateTimePicker` do `@expo/ui`, que já está nas dependências (`apps/app/package.json:8`), no estilo compacto do iOS e no diálogo do Material 3 no Android. Na web, `<input type="date|time">` num arquivo `.web.tsx`.
- **Substitui** os campos digitados de `CamposDoEvento.tsx:98-123,228-247`, `TelaVersiculo.tsx:83-93`, `TelaNovoAviso.tsx:88-90`, `TelaMudarStatus.tsx:133-148` e `EditorDeRegra.tsx:144-149`.

### 2.12.4 Seleção: Segmentos (substitui `ui/Segmentos.tsx`)

> **Atualizado em 22/11/2026 (D64):** as medidas, as cores e os estados deste componente passaram a ser os de [controles-v2.md](controles-v2.md); onde esta seção divergir, vale o controles-v2.

- **Trilho:** largura total, 44 de altura, raio 14, fundo `tonal`, padding de 4.
- **Segmentos:** largura igual (`flex: 1`), 36 de altura, raio 10, quando os rótulos cabem. Se não couberem (4 opções em 360 pt, por exemplo), nesta ordem: tipo 13 com padding 4; larguras pelo conteúdo, como o controle segmentado do iOS; pílulas. Nenhum rótulo é cortado (achado da D5 em 15/11/2026).
- **Inativo:** `botao` em peso 500, `textoSuave`.
- **Ativo:**
  - no escuro, fundo `rgba(255,255,255,0.18)` com texto `texto` 600;
  - no claro, fundo `#FFFFFF` com borda de 1 `contorno` e sombra de nível cartão.
  - O sinal além da cor é o polegar em relevo mais o peso.
- **Limites:** no máximo 4 segmentos e rótulos de até 12 caracteres; nunca quebra linha.
- **Fonte grande:** com `fontScale` de 1,35 ou mais, vira pílulas de filtro roláveis.
- **Uso:** modo de exibição (Mês, Semana, Lista), abas internas de tela (Visão geral, Programação, Equipe, Preparação) e escolha única curta (Interna, Pública).

### 2.12.5 Seleção: Pílulas de filtro (novo)

- **Medidas:** altura visual de 36 com `hitSlop` vertical de 4 (44 efetivo), padding horizontal de 14, raio 999, texto `lista` 14/20 500.
- **Inativa:** borda de 1 `tonalBorda`, texto `textoSuave`.
- **Ativa:** fundo `quenteFundo`, borda de 1 `destaque`, texto `destaque` 600 e ícone `checkmark` de 14 à esquerda (o sinal além da cor).
- **Linha:** rolagem horizontal, com o primeiro item em x=20 e folga de 20 no fim, intervalo de 8.
- **Escolha:** única ou múltipla, definida por uso. Contador opcional: "Rascunhos 2".
- **Uso:** filtros de lista (Programas, Oração, Relatórios, Conteúdos) e sugestões de categoria.

### 2.12.6 Seleção: Lista de opções (rádio; substitui `ui/GrupoDeOpcoes.tsx`)

- **Onde vive:** dentro de um cartão de vidro com padding vertical de 6 e horizontal de 0. Cada linha tem padding horizontal de 18 e altura mínima de 56 (64 ou mais com descrição).
- **Rádio:** 22, à esquerda. Desmarcado: anel de 2 `campoBorda`. Marcado: anel de 2 `primaria` mais miolo de 10 `primaria`.
- **Texto:** 12 depois do rádio. Título `tituloItem` 16/22 e descrição `legenda` `textoSuave`.
- **Separador:** 1 pt `separador`, recuado 52 à esquerda.
- **Sem repetição:** sem check à direita (corrige C-31).
- **Opção desabilitada:** texto a 40% e o motivo na descrição.
- **Rótulo do grupo:** sobrancelha acima do cartão, 8 antes dele.

### 2.12.7 Caixa de marcar (`ui/CaixaDeMarcar.tsx`)

- **Caixa:** 22×22, raio 6, borda de 1,5 `campoBorda`. Marcada: fundo `primaria`, sem borda, `checkmark` de 14 em peso bold `sobrePrimaria`.
- **Linha:** altura mínima de 48, intervalo de 12. A caixa fica alinhada ao topo da primeira linha do rótulo (`alignItems: flex-start`; o rótulo tem entrelinha de 22, a mesma altura da caixa).
- **Texto:** rótulo `corpo` 15/22 `texto`, descrição `legenda` `textoSuave`.
- **Uso:** consentimentos, tarefas, checklist e "Enviar também por e-mail". Nunca para preferências de liga e desliga.

### 2.12.8 Interruptor (novo)

> **Atualizado em 22/11/2026 (D64):** as medidas, as cores e os estados deste componente passaram a ser os de [controles-v2.md](controles-v2.md); onde esta seção divergir, vale o controles-v2.

- **Controle:** `Switch` nativo do React Native (51×31 no iOS, 52×32 no Material 3). `trackColor.true` igual a `primaria`; polegar branco; `ios_backgroundColor` igual a `tonal`.
- **Linha:** altura mínima de 56. Rótulo `tituloItem` 16/22, com a descrição em `legenda` dizendo o estado em texto ("Ligado, todos os dias às 07:00"). O interruptor fica à direita, centralizado na linha.
- **Acessibilidade:** `accessibilityRole="switch"`. O iOS mostra I e O quando a pessoa liga "Rótulos ligado/desligado"; esse é o sinal além da cor.
- **Uso:** notificações, versículo, Face ID, lista de espera e envio por e-mail.

### 2.12.9 Cartão de vidro (substitui `ui/Cartao.tsx`)

- **Caixa:** padding de 18 (M), raio 22 (M), fundo `superficie`, borda de 1 `superficieBorda` (M); no claro, mais a sombra `cartao`.
- **Estrutura:** sobrancelha opcional (`sobrancelha` `destaque`), depois 8 (M), depois o conteúdo, depois 14 (M), depois as ações (linha de até 2 botões médios, intervalo de 10). Quando a sobrancelha vem seguida de um `tituloItem`, o espaço é 4 (M: "SUA ESCALA" e "Louvor · violão").
- **Sem ícone no cabeçalho.**
- **Tocável inteiro:** pressionado aplica a camada `pressionado`; chevron de 14 à direita da sobrancelha.
- **Variante lista:** padding vertical de 6 e horizontal de 0. As linhas têm o padding de 18.
- **Proibido:** cartão dentro de cartão e caixa com borda dentro de cartão (CartaoDaEscala, LinhaDoEvento, SecaoEtapas e TelaCheckin hoje fazem isso). Dentro do cartão, a separação é por separadores ou espaço.

### 2.12.10 Cartão de destaque claro (novo)

- **Caixa:** padding de 18 (M), raio 22 (M), fundo `inverso.fundo` (`#F5F3FF` no escuro, `#1F1B4D` no claro), sem borda; no claro, mais a sombra `destaque`. Os filhos usam a paleta inversa.
- **Anatomia** (M):
  1. Linha de meta: `rotulo` 13/18 600 `textoSuave` ("Sábado · 16:00 · 60 min") à esquerda; chip à direita, alinhado pela linha de base.
  2. 6.
  3. Título `tituloCartao` 24/28.
  4. 14.
  5. Linhas `lista` 14/20 com intervalo de 8. A coluna de hora tem `minWidth` 44 (cresce com a fonte) em 600 `tabular-nums`, com 12 até o título. O marcador "Você" fica à direita, em 600 `destaque`. A última linha é "+4 etapas" em `textoSuave`.
  6. Ações opcionais: 14 acima; botões com a paleta inversa.
- **Toque:** o cartão inteiro é tocável e abre o detalhe. Pressionado escurece 4%.
- **Regra:** no máximo 1 por tela. É "a coisa mais importante agora": próximo evento, etapa atual do Ao vivo, convite recebido, link criado ou QR de entrada.

### 2.12.11 Linha de lista (substitui `ui/Linha.tsx` e as linhas próprias de evento, pessoa, convite e aviso)

- **Medidas:** altura mínima de 56, padding vertical de 10 e horizontal de 18 (dentro do cartão lista).
- **À esquerda,** uma de três:
  - ladrilho de 32×32, raio 10, fundo `tonal`, ícone de 18 `destaque`;
  - avatar de 40, para pessoas;
  - bloco de data com 44 de largura (dia em `tituloCartao` 20/24 e mês em `sobrancelha`), para eventos.
- **Texto:** 12 depois do elemento da esquerda. Título `tituloItem` 16/22 e descrição `legenda` `textoSuave` (máximo de 2 linhas).
- **À direita,** uma de três:
  - valor (`corpo` `textoSuave` `tabular-nums`, como "07:00");
  - chip;
  - chevron de 14 `textoSuave` (só em linha que navega).
- **Separador:** 1 pt `separador`, recuado 62 (18 + 32 + 12), ou 70 com avatar. A última linha não tem separador.
- **Pressionado:** camada `pressionado` na linha inteira.
- **Destrutiva:** título em `erro`, ladrilho `erroFundo` com ícone `erro`, sem chevron.

### 2.12.12 Chip de estado (substitui `ui/Selo.tsx`)

- **Medidas:** altura de 24 (cresce com a fonte), padding horizontal de 10 e vertical de 4 (M), raio 999, texto `chip` 12/16 600. Ícone opcional de 12 à esquerda, com intervalo de 4.
- **Variantes:**

| Variante | Fundo          | Texto        |
| -------- | -------------- | ------------ |
| neutro   | `neutroFundo`  | `textoSuave` |
| quente   | `quenteFundo`  | `destaque`   |
| sucesso  | `sucessoFundo` | `sucesso`    |
| alerta   | `alertaFundo`  | `alerta`     |
| erro     | `erroFundo`    | `erro`       |
| info     | `infoFundo`    | `info`       |

- **Conteúdo:** sempre texto, de 1 a 2 palavras. Nunca é tocável; se precisa ser tocável, é uma pílula de filtro.
- **Mapa de estados:**

| Estado       | Chip                          |
| ------------ | ----------------------------- |
| Rascunho     | neutro                        |
| Publicado    | não mostrar                   |
| Adiado       | alerta                        |
| Cancelado    | erro                          |
| Encerrado    | neutro                        |
| Ao vivo      | quente, com ponto de 6        |
| Confirmada   | sucesso                       |
| Pendente     | alerta                        |
| Recusada     | erro                          |
| Substituição | info                          |
| Presente     | sucesso, com check            |
| Fixado       | quente, com ícone de alfinete |
| Anônima      | neutro                        |
| Ligada       | sucesso                       |
| Desligada    | alerta                        |
| Interna      | neutro                        |
| Pública      | info                          |

### 2.12.13 Avatar (novo; substitui `MarcaDaComunidade` de `comunidade/Identidade.tsx:11-31`)

- **Tamanhos:** 24 (aba), 32 (pílula, M), 40 (linha de pessoa), 56 (identidade da comunidade) e 72 (Perfil).
- **Iniciais:** até 2 letras, Bricolage 800, com tamanho de 40% do diâmetro (10, 13, 16, 22 e 28).
- **Cores:**
  - pessoa: cor derivada do nome (hash) entre as 6 cores de comunidade, iniciais em `#FFFFFF`;
  - comunidade: a cor da comunidade;
  - o próprio usuário: `primaria` com `sobrePrimaria`.
- **Foto:** `expo-image` cobrindo o círculo, com borda de 1 `tonalBorda`.
- **Na aba Perfil:**
  - Avatar de 24 no lugar do ícone.
  - **Inativa:** anel de 1,5 `textoSuave`, afastado 2 (diâmetro total de 31).
  - **Ativa:** anel de 2 `destaque`, afastado 2 (diâmetro total de 32), mais a pílula da aba ativa e o rótulo em 600.
  - O anel é o sinal de forma, além da cor.
- **No cabeçalho do Perfil:** avatar de 72 com anel de 2 `destaque`, afastado 3.

### 2.12.14 Pílula da comunidade (novo)

- **Caixa** (M): altura mínima de 44, padding de 6 em cima, 14 à direita, 6 embaixo e 6 à esquerda, intervalo de 10, raio 999, fundo `tonal`, borda de 1 `tonalBorda`.
- **Conteúdo:** avatar de 32 (iniciais 13, M); nome em `botao` 15/20 600, numa linha; `chevron.down` de 14 (no mockup, SVG de 16 com traço 2) só se houver mais de uma comunidade.
- **Toque:** abre a folha "Trocar de comunidade".
- **Sem comunidade:** avatar tracejado (borda de 1,5 `textoSuave` com ícone `person.2` de 14) e "Sem comunidade"; o toque abre a folha "Entrar numa comunidade".
- **Fonte grande:** o nome passa para 2 linhas e o raio vira 22.
- **Reduzir transparência:** fundo `tonalOpaco`.
- **Acessibilidade:** `accessibilityLabel` "Comunidade Jovens Central, Administrador. Trocar de comunidade".

### 2.12.15 Status de sincronização (substitui `offline/IndicadorDeSincronizacao.tsx`)

- **Posição:** à direita da pílula, na mesma linha, centralizado na vertical, com área de toque de 44 de altura que abre Pendências.
- **Conteúdo:** ícone de 14 mais 6 mais texto `legenda` 13/18 400 `textoSuave` (M). Não tem borda nem fundo.

| Estado        | Ícone e cor            | Texto                   |
| ------------- | ---------------------- | ----------------------- |
| Sincronizado  | `checkmark`, `sucesso` | "Sincronizado 14:32"    |
| Sincronizando | setas, `destaque`      | "Sincronizando"         |
| Pendente      | relógio, `alerta`      | "3 pendentes"           |
| Sem conexão   | `wifi.slash`, `alerta` | "Sem conexão"           |
| Conflito      | exclamação, `alerta`   | "2 conflitos"           |
| Falha         | exclamação, `erro`     | "Falha. Tentar de novo" |

- **Texto curto:** no máximo 22 caracteres. Se não couber (fonte grande), desce para uma linha própria abaixo da pílula, alinhado à esquerda.

### 2.12.16 Cabeçalho de tela (novo; substitui o header nativo e `CabecalhoDaComunidade`)

**Raiz de aba:**

- topo da área segura mais 8;
- linha de 44 com a pílula à esquerda e o status à direita (M: `space-between`, intervalo de 12);
- 16;
- título `display` (margem superior de 4, M);
- à direita do título, opcionalmente, um botão só ícone de 44 ("+", "Convidar"), centralizado na primeira linha do título;
- subtítulo opcional em `corpo` `textoSuave`, 4 abaixo.

**Pilha:**

- topo da área segura mais 8;
- linha de 44 com o voltar à esquerda (só ícone circular de 44, fundo `tonal`, `chevron.left` de 18 em peso semibold, rótulo acessível "Voltar", que corrige a revisão M8) e ações de 44 à direita, com intervalo de 8;
- 12;
- título `tituloTela` 28/32;
- subtítulo `corpo` `textoSuave`, 4 abaixo, com no máximo 2 linhas.

**Compacto ao rolar** (raiz e pilha):

- **Quando aparece:** quando o título sai da tela.
- **Visual:** barra de vidro com altura igual à área segura mais 52, e borda inferior de 1.
- **Conteúdo:**
  - raiz: pílula compacta (avatar 24, nome 15/600, altura 36) à esquerda e status à direita;
  - pilha: voltar de 44 e título em `tituloItem` centralizado, em uma linha.
- **Movimento:** dissolve em 200 ms (instantâneo com Reduzir movimento).
- **Por que existe:** mantém a comunidade sempre visível, como hoje exige o comentário de `CabecalhoDaComunidade.tsx:18`, sem uma faixa fixa em repouso.

**Folha:**

- grabber do sistema;
- linha de 44 com o título `tituloCartao` à esquerda e o fechar (`xmark`, 44) à direita;
- em formulários de folha, "Cancelar" (terciário) à esquerda e a ação primária na barra de ação.

**Fluxo com passos:**

- acima do título: sobrancelha "PASSO 2 DE 3";
- mais 8;
- barra de 3 segmentos com 4 de altura, raio 999 e intervalo de 4 (concluídos e o atual em `primaria`, futuros em `tonal`).

### 2.12.17 Barra de abas flutuante (substitui `AbasDoApp.tsx` e `AbasDoApp.web.tsx` estreito)

**Posição:**

- absoluta, à esquerda 16 e à direita 16 (M);
- embaixo, o maior entre (área segura de baixo menos 10) e 12, o que dá 24 num iPhone com Face ID (M).

**Caixa:**

- padding de 8 (M), raio 28 (M), vidro da barra (2.8), borda de 1 e sombra `flutuante`;
- no iOS 26, `GlassView` com `tintColor`;
- 5 itens com `space-between` (M).

**Itens:**

- cada item com largura mínima de 58 e altura mínima de 48 (M), raio 20, coluna com intervalo de 2 (M), ícone de 22 e rótulo `aba` 11/14;
- inativo: `textoSuave`, rótulo 500 e ícone de peso regular;
- ativo: fundo `abaAtivaFundo` (`rgba(255,138,101,0.20)` no escuro, M; `rgba(194,73,31,0.12)` no claro), cor `destaque`, rótulo 600 e ícone em peso bold ou preenchido. O peso e o preenchimento são o sinal além da cor (revisão A5).

**Abas:**

Desde 16/11/2026 (D57), as abas são estas, nesta ordem:

| Aba        | Ícone                           | Rota          |
| ---------- | ------------------------------- | ------------- |
| Início     | `house`                         | `/`           |
| Agenda     | `calendar`                      | `/agenda`     |
| Escalas    | `list.bullet` (três linhas)     | `/escalas`    |
| Comunidade | `person.2`                      | `/comunidade` |
| Perfil     | avatar de 24 com anel (2.12.13) | `/perfil`     |

A antiga aba Programas (`/programacoes`) virou o modo Lista da Agenda e a rota redireciona para `/agenda?vista=lista`. As rotas internas podem ficar com o nome atual.

**Implementação:**

- `Tabs` do `expo-router` com `tabBar` próprio, ou `TabList`/`TabTrigger` de `expo-router/ui`, como na web hoje;
- some quando o teclado abre;
- o conteúdo rola por baixo; as telas de aba têm padding inferior de 120 (M): 24 de fundo, 64 de barra e 32 de folga.

**Acessibilidade:**

- `tablist` e `tab` com `aria-selected`;
- no iOS, `accessibilityShowsLargeContentViewer` nos itens, porque o rótulo tem teto de 1,3;
- na web, `navigation` com `aria-current` (revisão A6).

### 2.12.18 Barra de ação (novo)

- **Onde:** rodapé fixo das telas de pilha com ação principal (formulários, detalhe do evento, excluir conta).
- **Caixa:** largura total, vidro da barra, borda superior de 1, padding de 12 em cima, 20 nas laterais e a área segura mais 12 embaixo.
- **Conteúdo:**
  - até 2 botões grandes de 48 lado a lado, com intervalo de 10 (secundário à esquerda, primário à direita), **ou**
  - 1 primário com `flex: 1` e um só ícone de 48×48 "Mais ações".
- **Teclado:** sobe junto com ele.
- **Conteúdo da tela:** padding inferior de 48 + 24 + área segura + 16.

### 2.12.19 Folha (bottom sheet)

- **Implementação:** formSheet nativo do `expo-router` (`presentation: 'formSheet'`), com `sheetAllowedDetents` em `'fitToContents'` ou `[0.5, 1]`, `sheetGrabberVisible: true` e `sheetCornerRadius: 28`. No iOS 26 a folha já vem com o vidro do sistema; nas outras plataformas, `superficieElevada` opaco.
- **Medidas:** padding de 20 nas laterais, 8 em cima (grabber) e a área segura mais 16 embaixo.
- **Conteúdo:** cabeçalho de folha, depois um menu de ações (linhas de lista; a destrutiva em vermelho por último, separada por 8) ou um formulário curto com a barra de ação.
- **Fechar:** gesto e botão "Fechar" de 44, sempre (nada só em gesto).
- **Usos:** trocar de comunidade, mais ações do evento, nova programação (escolher modelo), convidar, novo pedido, substituição, colar link de convite, ações de convite e de pessoa, adicionar etapa.

### 2.12.20 Diálogo de confirmação

- **iOS e Android:** o `Alert` nativo continua (`utilidades/confirmar.ts:19`). Isso segue a HIG e o Material e já é acessível.
  - **Título:** pergunta curta ("Excluir este rascunho?").
  - **Mensagem:** a consequência.
  - **Botões:** "Cancelar" e um verbo explícito ("Excluir rascunho"), este com `style: 'destructive'`.
- **Web:** componente próprio que substitui `window.confirm` (`utilidades/confirmar.web.ts:7`).
  - **Caixa:** largura de 340 (no máximo 100% menos 40), raio 22, padding de 24, fundo `superficieElevada`, sombra `folha` e véu.
  - **Conteúdo:** título `tituloCartao`, mensagem `corpo` `textoSuave` e botões de 48 lado a lado (Cancelar secundário; confirmar primário ou destrutivo cheio).
  - **Comportamento:** `role="alertdialog"`, foco preso, Esc fecha e o foco volta ao gatilho.

### 2.12.21 Estado vazio (substitui `ui/EstadoVazio.tsx` e `navegacao/SemComunidade.tsx`)

- **Onde:** dentro de um cartão de vidro, alinhado à esquerda.
- **Composição:**
  - ladrilho de 48×48, raio 14, fundo `quenteFundo`, ícone de 24 `destaque`;
  - 12;
  - título `tituloItem`;
  - 4;
  - descrição `corpo` `textoSuave` (máximo de 3 linhas);
  - 16;
  - ação: botão médio, primário quando é a ação esperada e secundário quando é alternativa; terciário opcional ao lado.
- **Texto:** o título diz o estado, a descrição diz o porquê e o próximo passo, e o botão executa esse passo. Todo estado vazio tem ação (corrige a revisão BAIXO "estados vazios sem ação").
- **Início:** seções vazias são omitidas (não ocupam cartão), exceto quando nada existe: aí aparece um único estado vazio.

### 2.12.22 Esqueleto de carregamento (novo; substitui `ui/Carregando.tsx` em telas)

- **Blocos:**
  - linha de texto com 60% da entrelinha (15/22 vira 13), raio 6, larguras de 100%, 72% e 48%;
  - título 24 vira bloco de 20;
  - avatar em círculo;
  - cartão completo com raio 22, padding de 18 e 3 linhas.
- **Cor:** `esqueleto`, com pulso de opacidade de 1,0 a 0,6 em 1200 ms (estático com Reduzir movimento).
- **Tempo:** só aparece depois de 300 ms, para não piscar em carga rápida.
- **Acessibilidade:** o contêiner tem `accessibilityLabel` "Carregando a agenda" e `aria-busy`; os blocos ficam ocultos para o leitor.
- **Indicador giratório:** fica só dentro de botões.

### 2.12.23 Aviso e erro (substitui `ui/Aviso.tsx` e `ui/AvisoDeErro.tsx`)

- **Caixa:** raio 14, padding de 14 na vertical e 16 na horizontal, fundo `{tipo}Fundo`, sem borda (com Aumentar contraste, borda de 2 na cor do tipo).
- **Ícone:** 18, na cor do tipo, alinhado ao topo:

| Tipo    | Ícone                           |
| ------- | ------------------------------- |
| info    | `info.circle.fill`              |
| sucesso | `checkmark.circle.fill`         |
| alerta  | `exclamationmark.triangle.fill` |
| erro    | `xmark.octagon.fill`            |

- **Texto:** 12 depois do ícone. Título `tituloItem` em `texto` (não na cor), texto `legenda` em `texto`.
- **Ação:** terciário médio abaixo do texto ("Tentar de novo"), ou à direita se for curta.
- **Títulos específicos:** "Sem conexão: o Início volta quando a internet voltar", e não "Atenção".
- **Erro de tela inteira:** é um estado vazio com ícone de erro e "Tentar de novo" primário.
- **Anúncio:** `announceForAccessibility` no iOS e região `aria-live` na web (revisão A1 e A4).
- **Botões dentro do aviso:** o contêiner só é `accessible` quando o filho é texto puro (revisão A2).

### 2.12.24 Toast (novo)

- **Posição:** acima da barra de abas (topo da barra mais 12) ou acima da barra de ação; à esquerda e à direita 20.
- **Caixa:** altura mínima de 48, raio 14, padding de 12 por 16, fundo `inverso.fundo`, sombra `flutuante`.
- **Conteúdo:** ícone de 18 na cor semântica do inverso, texto `corpo` em `inverso.texto` (máximo de 2 linhas) e ação terciária opcional ("Desfazer") à direita.
- **Duração:** 4 s, mais 1 s a cada 10 palavras. Pausa enquanto o leitor de tela está nele e é anunciado.
- **Movimento:** sobe 8 e dissolve em 200 ms (só dissolve com Reduzir movimento). Um por vez, em fila.
- **Uso:** confirmações transitórias (presença registrada, link copiado, dados salvos, evento publicado). Erros que exigem ação não vão em toast.

### 2.12.25 Fundo Aurora (componente `FundoAurora`)

Segue 2.3. Recebe a prop `intensidade` (1 ou 0,6) e some com Aumentar contraste.

## 2.13 Grade e ritmo

| Regra                                               | Valor                                                                                                                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Margem lateral                                      | 20 (M) em todas as telas. Barra de abas a 16 (M). Na web, largura máxima de 720 para conteúdo e cabeçalho                                                                                |
| Intervalo entre blocos                              | 16 (M)                                                                                                                                                                                   |
| Antes de um grupo novo (sobrancelha fora de cartão) | 24 acima, 8 abaixo                                                                                                                                                                       |
| Dentro do cartão                                    | Padding de 18; sobrancelha, 8, conteúdo, 14, ações, com intervalo de 10 entre botões                                                                                                     |
| Alinhamento                                         | Tudo à esquerda. Bordas de cartão em x=20; conteúdo de cartão em x=38; texto de linha com ladrilho em x=82. Só se centraliza a marca nas telas de autenticação, o QR e o visor da câmera |
| Alturas                                             | Campo e botão na mesma linha: 48. Botões lado a lado: mesmo tamanho e mesma variante de largura (`flex: 1`)                                                                              |
| Colunas de dados                                    | Hora com `minWidth` 44 (M), cresce com a fonte e usa `tabular-nums`                                                                                                                      |
| Topo                                                | Área segura mais 8                                                                                                                                                                       |
| Fundo das telas de aba                              | Padding inferior de 120 (M)                                                                                                                                                              |
| Fundo das telas de pilha                            | Área segura mais 24; com barra de ação, 48 + 24 + área segura + 16                                                                                                                       |
| Máximos por tela                                    | 1 cartão de destaque, 1 primário visível, 5 cartões no Início, 2 botões por linha                                                                                                        |
| Fonte grande (`fontScale` de 1,35 ou mais)          | Pares viram coluna; segmentos viram pílulas; a coluna de hora passa a ficar acima do título; o calendário de mês vira lista (revisão M4)                                                 |

## 2.14 Lojas: o que segue a HIG e o Material 3, e onde a marca diverge

**Segue a HIG no iOS:**

- alvos de 44;
- Dynamic Type;
- `Alert` nativo para confirmação destrutiva;
- formSheet nativo com detents;
- voltar no canto superior esquerdo mais o gesto de borda;
- SF Symbols;
- `Switch` e seletor de data nativos;
- visualizador de conteúdo grande na barra de abas;
- títulos grandes no topo das listas.

**Segue o Material 3 no Android:**

- alvos de 48 (`controleCompacto` = 48 no Android);
- voltar do sistema fecha a folha e volta a pilha;
- ripple (`android_ripple`);
- `Switch` e DatePicker do M3;
- tela de ponta a ponta (padrão do SDK 58).

**Diverge de propósito, pela identidade Aurora:**

- **Barra de abas própria flutuante em vez da barra do sistema.** É uma exceção consciente à HIG e ao M3; vira ADR.
- **Título grande em Bricolage** em vez do large title do UINavigationBar.
- **Cartão de destaque invertido.**
- **Sem FAB no Android:** o "+" fica no cabeçalho, para a mesma linguagem nas duas plataformas.

---

# 3. Especificação por tela

Formato: rota e arquivo atual, depois composição de cima para baixo, o que é vidro e o que é destaque, e a ação principal. A margem é sempre 20 e o intervalo entre blocos é 16, salvo indicação.

## 3.1 Entrada

### 3.1.1 Entrar (`/entrar`, `autenticacao/TelaEntrar.tsx`)

- **Fundo:** Aurora de intensidade total. Sem cabeçalho.
- **Bloco da marca:** começa na área segura mais 40. Ícone do app de 56 (raio 16), 16, nome "Uni Jovem" em `display` 34/38, 4, frase `corpo` `textoSuave` "A agenda da juventude, num lugar só".
- **Formulário** (24 abaixo), num cartão de vidro com sobrancelha "ENTRAR":
  - E-mail (48);
  - 16;
  - Senha (48, com mostrar);
  - 8;
  - terciário "Esqueci a senha", alinhado à direita, na borda direita do campo;
  - 16;
  - **primário grande "Entrar", largura total.**
- **Abaixo do cartão** (16): `legenda` `textoSuave` "A conta é criada por convite." e o terciário "Tenho um link de convite", que abre uma folha com campo "Cole o link" e "Abrir convite".
- **Estados:**
  - erro de credencial: Aviso de erro acima do botão, dentro do cartão;
  - sem conexão: Aviso alerta acima do cartão;
  - "alterações descartadas": Aviso info no topo.

### 3.1.2 Convite e primeiro acesso (`/convite`, `convite/TelaConvite.tsx` e `CadastroPorConvite.tsx`; `/primeiro-acesso`, `autenticacao/TelaPrimeiroAcesso.tsx`)

- **Cabeçalho:** Aurora total e cabeçalho de pilha sem voltar (o link é a entrada). Com sessão aberta, o voltar aparece.
- **Cartão de destaque** com o convite:
  - avatar da comunidade 56 à esquerda;
  - à direita, "Você foi convidado para" (`rotulo` `textoSuave`), nome da comunidade (`tituloCartao`) e chip "Membro" (neutro) ou "Administrador" (quente);
  - abaixo, se houver, "Convite para a\*\*\*@gmail.com" (`legenda`).
- **Fluxo em 3 passos**, com cabeçalho de passos ("PASSO 1 DE 3", barra de 3 segmentos):
  1. **Seus dados.** Cartão de vidro com Nome, WhatsApp (opcional) e E-mail; idade numa lista de opções ("Menos de 16", "16 ou 17", "18 ou mais"); termos em caixa de marcar. Na barra de ação, primário "Enviar código"; o motivo de desabilitado aparece abaixo. "Já tenho conta: entrar" é terciário abaixo do cartão.
  2. **Código.** `tituloItem` "Confira seu e-mail"; `corpo` com o e-mail; campo de código de 6 dígitos (`numero` 20/24, espaçamento de 8). Barra de ação com "Mandar outro código" (secundário) e "Continuar" (primário). "Corrigir meus dados" é terciário.
  3. **Senha.** Regras da senha como checklist (ícone e texto por regra), Senha, Repetir senha e o consentimento sobre a fé em caixa de marcar. Barra de ação com o primário "Criar conta e entrar".
- **Convite inválido:** estado vazio em tela inteira (ícone de link, título específico) com o primário "Ir para entrar".
- **Primeiro acesso do Criador**, mesmo padrão em 3 passos:
  1. **Começar:** aviso info explicando o autenticador.
  2. **Autenticador:** cartão de destaque com o QR de 200 sobre branco e o segredo numa linha copiável com o botão só ícone "Copiar".
  3. **Senha e código:** senha, repetir senha e código de 6.
- **Resultado do primeiro acesso:** cartão de destaque com os códigos de recuperação em 2 colunas (`numero` 15/22 `tabular-nums`) e uma barra de ação com "Copiar" e "Ir para entrar".

### 3.1.3 Face ID (novo; depende de decisão, ver 1.11 item 8)

- **Tela de bloqueio** (ao abrir o app, se estiver ligado):
  - Aurora total, sem barra de abas;
  - centralizados: ícone do app de 72, 16, `tituloTela` "Uni Jovem está bloqueado", 8, `corpo` `textoSuave` "Use o Face ID para continuar";
  - embaixo, na barra de ação: primário grande "Desbloquear com Face ID" com ícone `faceid`, e terciário "Usar a senha".
  - A leitura biométrica dispara sozinha ao abrir; o botão é para tentar de novo.
- **Oferta** (uma vez, depois do primeiro login): cartão de vidro no Início com sobrancelha "ENTRAR MAIS RÁPIDO", `tituloItem` "Usar o Face ID neste aparelho" e os botões "Agora não" (secundário) e "Ligar" (primário).
- **Ajuste:** interruptor em Perfil, Segurança.

### 3.1.4 Segundo fator, recuperar e redefinir senha

- Cabeçalho de pilha mais um cartão de vidro com um ou dois campos, e a barra de ação com o primário.
- No segundo fator, o campo de código de 6 vem com o terciário "Usar um código de recuperação".
- Depois de enviar a recuperação, um cartão de destaque "Confira seu e-mail" com o e-mail mascarado.

## 3.2 Início (`/`, `inicio/TelaInicio.tsx`)

### 3.2.1 Com dados (fiel ao mockup)

1. Cabeçalho raiz: pílula "Jovens Central" e status "Sincronizado 14:32".
2. `display` "Bom dia, Ana", sem "!" (M).
3. **Cartão de vidro "VERSÍCULO DO DIA"** (M): texto em `leitura` 17/26, selecionável; 8; referência em `legenda` `textoSuave` com "· BLIVRE". Sem botão (o ajuste fica no Perfil).
4. **Cartão de destaque claro "Próximo encontro"** (M):
   - meta "Sábado · 16:00 · 60 min" e chip quente com o local ("Na igreja");
   - título com o nome da programação;
   - as 3 primeiras etapas, com "Você" nas etapas em que a pessoa está escalada, e "+N etapas";
   - toque abre o detalhe.
   - **No dia do evento, quando o ao vivo começa:** chip "Ao vivo"; a etapa atual em 600 com um ponto `destaque`; e o botão primário inverso "Acompanhar ao vivo".
5. **Cartão de vidro "SUA ESCALA"** (M):
   - `tituloItem` "Louvor · violão";
   - `legenda` com a data;
   - botões médios "Confirmar" (primário) e "Pedir substituição" (secundário), `flex: 1`, intervalo de 10.
   - **Já confirmada:** chip "Confirmada" à direita da sobrancelha e só "Pedir substituição".
   - **Mais de uma escala:** a próxima escala e o terciário "Ver todas (3)".
6. **Cartões condicionais**, só quando há conteúdo, nesta ordem:
   - aviso info "Alguém precisa de substituição" com o terciário "Ver pedidos";
   - cartão de vidro "AVISO FIXADO" com o título em `tituloItem`, 2 linhas em `corpo` e o terciário "Ver todos";
   - cartão de vidro "SUAS TAREFAS" com até 3 caixas de marcar;
   - cartão lista "INSCRIÇÕES ABERTAS" com linhas de evento;
   - cartão de vidro "MAPA DA MISSÃO" compacto, com "Começar" (secundário) e "Agora não" (terciário).
   - **Máximo de 5 cartões.**
7. **Nada além disso:** a frase "Isto é o que está acontecendo" sai.

- **Carregando:** esqueleto com a forma dos 3 cartões.
- **Erro:** aviso de erro no lugar do destaque, e o versículo continua (ele não depende da rede).
- **Sem conexão e sem cache:** aviso alerta mais "Eventos preparados" em cartão lista.

### 3.2.2 Sem comunidade, para o Criador (`conta.criador`)

1. Cabeçalho raiz com a pílula vazia "Sem comunidade" e sem status.
2. `display` "Boa noite, Rafael".
3. **Cartão de destaque** "PRIMEIROS PASSOS":
   - `tituloCartao` "Crie a primeira comunidade";
   - 8;
   - `corpo` "Você é o Criador da plataforma. Crie uma comunidade e mande o convite para quem vai administrá-la.";
   - 14;
   - primário inverso "Criar comunidade", que abre a folha de criar comunidade.
4. Cartão de vidro "VERSÍCULO DO DIA".
5. Cartão lista com a linha "Plataforma" (ladrilho `building.2`, descrição "Comunidades, saúde e auditoria", chevron).

### 3.2.3 Sem comunidade, para o membro

1. Cabeçalho com a pílula vazia.
2. `display` com a saudação.
3. **Cartão de vidro com estado vazio:**
   - ladrilho `person.2`;
   - título "Você ainda não participa de uma comunidade";
   - descrição "O acesso é por convite. Quando alguém da liderança mandar o link, abra no celular ou cole aqui.";
   - primário médio "Colar link de convite", que abre uma folha com campo e "Abrir convite";
   - terciário "Como conseguir um convite", que abre uma folha explicativa.
4. Cartão de vidro "VERSÍCULO DO DIA".

### 3.2.4 Várias comunidades, nenhuma escolhida

- A pílula diz "Escolher comunidade", com chevron.
- Abaixo do título, cartão lista "SUAS COMUNIDADES": linhas com avatar de 40, nome e papel, e toque escolhe direto, sem tela intermediária.

## 3.3 Agenda e Linha do tempo

### 3.3.1 Agenda, mês (`/agenda`, `agenda/TelaAgenda.tsx` e `VistaDoMes.tsx`)

1. Cabeçalho raiz e `display` "Agenda".
2. Segmentos "Mês", "Semana" e "Lista", em largura total.
3. **Linha do mês:**
   - `tituloCartao` "Novembro de 2026" à esquerda;
   - à direita, terciário "Hoje" (só quando não estiver no mês atual) e os botões só ícone `chevron.left` e `chevron.right` (44), com intervalo de 8.
   - Os rótulos acessíveis começam pelo texto visível: "Mês anterior" e "Próximo mês" (corrige a revisão M5).
4. **Cartão de vidro com a grade:**
   - cabeçalho dos dias em `sobrancelha` `textoSuave` ("D S T Q Q S S"), oculto para o leitor;
   - grade de 7 colunas iguais (cerca de 44,8 cada, dentro de 314 úteis) e altura de 48 por célula.
   - **Número:** `corpo` 15/20 500 `tabular-nums`.
   - **Hoje:** círculo de 32 em `primaria` com o número em `sobrePrimaria` 600.
   - **Selecionado:** anel de 2 em `texto` em volta de um círculo de 36 (sinal de forma).
   - **Dias com evento:** até 3 pontos de 4 em `destaque`, 2 abaixo do número; a quantidade vai no rótulo acessível.
   - **Dias de outro mês:** `textoSuave`.
5. **Sobrancelha do dia escolhido** fora do cartão ("SÁBADO, 15 DE NOVEMBRO", 24 acima e 8 abaixo) e um cartão lista com as linhas de evento (bloco de hora, título, local, chip se não estiver publicado, chevron). No fim do cartão, a linha terciária "Ver a linha do tempo do dia".
6. **Dia sem nada:** uma linha `corpo` `textoSuave` "Nada marcado" dentro do cartão. Para quem cria, o terciário "Nova programação neste dia".

Os atalhos atuais "Minhas escalas" e "Linha do tempo de hoje" saem do topo: as escalas ficam no Início e no Perfil; a linha do tempo fica no item 5.

- **Carregando:** esqueleto da grade.
- **Fonte grande** (`fontScale` de 1,35 ou mais): o mês abre como Lista.

### 3.3.2 Agenda, semana

- Faixa horizontal de 7 dias dentro de um cartão de vidro. Cada dia é uma célula de 44×64 com a sobrancelha do dia da semana e o número em `tituloItem`.
- Hoje e selecionado seguem o mês; os pontos ficam abaixo.
- Navegação de semana na linha do título ("9 a 15 de novembro"), com o mesmo par de botões.
- Abaixo, a lista do dia escolhido como no mês. Os 7 cartões empilhados atuais acabam.

### 3.3.3 Agenda, lista

- Grupos por dia, cada um com uma sobrancelha. Hoje vem com um ponto coral e "HOJE".
- Abaixo de cada sobrancelha, um cartão lista com as linhas de evento.
- Navegação de período por botões só ícone e um intervalo de datas em `tituloCartao`.
- **Vazio:** estado vazio com "Nova programação" para quem cria.

### 3.3.4 Linha do tempo do dia (`/agenda/[data]`, `agenda/TelaTimelineDoDia.tsx`)

1. Cabeçalho de pilha com o título "Linha do tempo" e o subtítulo "Sábado, 15 de novembro de 2026 (hoje)". À direita, os botões só ícone "Dia anterior" e "Dia seguinte".
2. **Evento ao vivo ou o próximo do dia:** cartão de destaque.
   - meta, chip e título;
   - barra de progresso de 6, raio 999 (`primaria` sobre `tonal`), com "3 de 7 etapas" em `legenda`;
   - a lista de etapas.
3. **Outros eventos do dia:** cartões de vidro com a mesma lista.
4. **Linha de etapa:**
   - coluna de hora com largura mínima de 44, em `lista` 600 `tabular-nums`;
   - 12;
   - nó de 12 com linha vertical de 2 em `separador`:
     - concluída: círculo cheio `sucesso` com check de 8;
     - atual: anel de 2 `primaria` mais miolo;
     - próxima: anel de 1,5 `textoSuave`;
   - 12;
   - título em `tituloItem`;
   - `legenda` "16:05 a 16:20 · 15 min · Com Ana (violão)".
5. **Ações por evento:** terciários "Abrir a programação" e "Acompanhar ao vivo", em linha.

- **Vazio:** estado vazio com o primário "Voltar para a agenda".

## 3.4 Programas e eventos

> **D57 (16/11/2026):** na interface, evento e programação se chamam **encontro**; o segmento das etapas se chama **Roteiro**; "Série" virou **Repetição**. A lista abaixo é o modo **Lista** da aba Agenda (seletor "Calendário | Lista", `eventos/ListaDeEncontros.tsx`), com o botão "Novo encontro" ao lado do título. As escalas (3.4.5) são a aba **Escalas**, com "Aguardando resposta" para quem convoca.

### 3.4.1 Programas, lista (`/programacoes`, `eventos/TelaProgramacoes.tsx`)

1. Cabeçalho raiz e `display` "Programas". À direita do título, o botão só ícone "+" (para quem cria), que abre a folha "Nova programação" com linhas "Sábado padrão" (recomendado, chip quente), "Em branco" e "A partir de um modelo".
2. Campo de busca de 48 com ícone.
3. **Pílulas de filtro** numa linha só, com um separador vertical de 1 entre os dois grupos:
   - período: "Próximos" e "Passados";
   - situação: "Rascunhos", "Publicados" e "Cancelados".
     Isso substitui os dois controles de segmentos.
4. **Lista** agrupada por mês, com a sobrancelha "NOVEMBRO" e um cartão lista abaixo. Cada linha tem:
   - bloco de data (dia em `tituloCartao` 20/24 e dia da semana em `sobrancelha`);
   - título;
   - `legenda` "16:00 · 60 min · Salão";
   - chip quando não está publicado;
   - ícone de repetir de 14 quando faz parte de série;
   - chevron.
5. **Contador** "12 programações" em `legenda` acima da lista, anunciado.

- **Vazio com filtros:** estado vazio com "Limpar filtros". **Vazio de verdade:** primário "Novo Sábado padrão".
- **Web larga:** lista e detalhe lado a lado, como hoje, com intervalo de 24 registrado como regra da web.

### 3.4.2 Detalhe do evento (`/evento/[id]`, `eventos/DetalheDoEvento.tsx` e seções)

1. **Cabeçalho de pilha.** Ações à direita: "Compartilhar" (só ícone, quando é público) e "Mais ações" (`ellipsis`, para organizadores).
2. **Título e meta:** `tituloTela` com o título do evento; 8; `corpo` `textoSuave` "Sábado, 15 de nov. · 16:00 · 60 min"; 8; linha de chips (situação se não estiver publicado; "Interna" ou "Pública"; "Série").
3. **Cartão de destaque, conforme o contexto:**
   - **escalado:** "SUA PARTICIPAÇÃO", com a função e os botões Confirmar e Pedir substituição;
   - **inscrito:** "SUA ENTRADA", com o QR de 160 e o código (3.5.3);
   - **organizador no dia:** "AO VIVO", com o primário "Abrir ao vivo";
   - **nenhum desses:** o cartão não aparece.
4. **Segmentos:**
   - organizador: "Visão geral", "Programação", "Equipe" e "Preparação";
   - membro: só "Visão geral" e "Programação", sem segmentos se só restar uma visão.
5. **Visão geral:**
   - cartão lista "QUANDO E ONDE": linha de data e hora; linha do local, com o terciário "Abrir no mapa" à direita; linha de inscrições ("30 vagas · lista de espera · até sexta 23:59");
   - cartão de vidro "SOBRE": descrição em `leitura` e "Informações úteis" com sobrancelha;
   - aviso alerta se a programação foi cancelada ou adiada, com o motivo.
6. **Programação:**
   - cartão de vidro com as linhas de etapa (formato do 3.3.4, sem nós) e o rodapé `legenda` "Total 60 min de 60 previstos";
   - aviso alerta se as etapas passam da duração;
   - para organizadores, terciário "Editar etapas" no fim do cartão.
7. **Equipe:** cartão lista de pessoas por etapa (avatar 40, nome, função e chip de estado da escala).
8. **Preparação:** cartões de vidro "TAREFAS" (caixas de marcar com prazo em `legenda`), "MATERIAIS", "CHECKLIST", "NOTAS" e "ANEXOS". Cada um com estado vazio de uma linha e o terciário "Adicionar".
9. **Barra de ação** (organizador):
   - primário contextual: "Publicar" no rascunho, "Abrir ao vivo" no dia, "Editar" nos outros casos;
   - "Mais ações" (48×48), que abre uma folha com Editar, Duplicar, Salvar como modelo, Ver a série, Preparar para usar sem internet, Adiar e Encerrar; separados, por último, "Cancelar evento" e "Excluir rascunho" em vermelho.
   - Isso substitui `AcoesDoEvento.tsx` e acaba com a parede de 8 botões.

- **Sem conexão e com cópia no aparelho:** chip alerta "Cópia deste aparelho" ao lado do título, e o Aviso explicando no topo.

### 3.4.3 Criar, editar e duplicar evento (`/evento/novo`, `/evento/[id]/editar`, `/evento/[id]/duplicar`; `eventos/CamposDoEvento.tsx`)

- **Apresentação:** modal em tela cheia. Cabeçalho de pilha com "Fechar" (`xmark`) e o título "Nova programação" (ou "Editar programação").
- **Cartões de vidro, cada um com sobrancelha:**
  1. **O QUE É:**
     - Título;
     - Categoria (campo) e logo abaixo as pílulas de sugestão (rolagem horizontal);
     - Descrição (multilinha de 120).
  2. **QUANDO:**
     - Data e Hora lado a lado (1,4 para 1, 48 cada, seletores nativos);
     - Duração (48, com sufixo "min") e logo abaixo as pílulas "30", "60", "90" e "120".
     - Na série: `corpo` `textoSuave` explicando, e o terciário "Abrir a série".
  3. **ONDE:**
     - lista de opções de locais (linhas com descrição "Local interno" ou o endereço);
     - última linha "Cadastrar outro local", que abre uma folha com Nome, segmentos "Interno" e "Externo", Endereço e Referência, e o primário "Salvar local".
  4. **QUEM VÊ E INSCRIÇÕES:**
     - segmentos "Interna" e "Pública", com a descrição em `legenda` abaixo;
     - Vagas (48, metade da largura);
     - interruptor "Lista de espera" (desabilitado com o motivo "Defina as vagas primeiro");
     - "Inscrições até": Data e Hora lado a lado.
  5. **INFORMAÇÕES ÚTEIS:** multilinha.
- **Barra de ação:** "Salvar rascunho" (secundário) e "Publicar" (primário). Na edição, só "Salvar alterações".
- **Erros:** a validação marca os campos e rola até o primeiro erro, com foco nele. Um aviso de erro no topo resume: "Faltam 2 campos".

### 3.4.4 Etapas e Etapa e equipe (`eventos/SecaoEtapas.tsx`, `/evento/[id]/etapa/[etapaId]`, `eventos/TelaEtapa.tsx`)

- **Programação em modo de edição.** O terciário "Editar etapas" abre a tela "Etapas":
  - cabeçalho de pilha, título "Etapas", subtítulo "Total 60 de 60 min" (chip alerta quando passa);
  - cartão lista: cada linha com a hora (coluna 44), o título, a `legenda` com duração e pessoas, e à direita os botões só ícone "Subir" e "Descer" (44 cada, fundo `tonal`, intervalo de 4; o primeiro e o último têm o botão correspondente desabilitado com motivo);
  - toque na linha abre a Etapa;
  - última linha do cartão: "+ Adicionar etapa" (terciário), que abre uma folha com Nome e Duração lado a lado (2 para 1, 48 cada) e o primário "Salvar etapa";
  - o anúncio de reordenação continua.
- **Etapa e equipe:**
  - título com o nome da etapa;
  - cartão de vidro "DETALHES" com Nome, Duração e Descrição;
  - cartão lista "EQUIPE" com pessoas (avatar, nome, função e chip da escala) e a ação "Remover" na folha da linha;
  - linha "+ Escalar pessoa", que abre uma folha com busca e lista de pessoas com a disponibilidade em chip;
  - barra de ação com "Salvar".

### 3.4.5 Escala (`/escalas`, `escalas/TelaEscalas.tsx`; `/escalas/substituicao/[id]`, `escalas/TelaPedirSubstituicao.tsx`)

- **Minhas escalas:**
  - título "Escalas";
  - segmentos "Próximas" e "Disponibilidade";
  - cada escala é um cartão de vidro no formato do Início, com a sobrancelha da data, o título da função, a `legenda` com o evento e os botões Confirmar e Pedir substituição; "Recusar" fica na folha "Mais".
  - **Pedidos que eu posso assumir:** cartão lista com o primário médio "Assumir" à direita de cada linha.
- **Disponibilidade:** pílulas de filtro com os próximos 8 sábados ("15 nov", "22 nov"...), onde ativa quer dizer disponível; `legenda` explicando.
- **Pedir substituição:** folha com:
  - lista de opções "Aberto à equipe" e "Uma pessoa específica";
  - se for pessoa específica, seletor de pessoa (busca e lista);
  - mensagem opcional;
  - barra de ação com o primário "Pedir substituição".

### 3.4.6 Mudar situação, série, locais e modelos

- **Mudar situação** (cancelar ou adiar): folha.
  - aviso alerta com a consequência ("12 pessoas escaladas e 30 inscritas serão avisadas");
  - Motivo (multilinha);
  - no adiamento, a nova Data e a nova Hora lado a lado;
  - barra de ação com o destrutivo cheio "Cancelar evento" ou o primário "Adiar".
- **Série:**
  - título com o nome da série;
  - cartão de vidro "REGRA" (frase "Todo sábado às 16:00" em `tituloItem` e o terciário "Editar regra");
  - cartão lista das próximas ocorrências;
  - editar pergunta "Esta", "Esta e as futuras" ou "Toda a série" numa folha com lista de opções.
- **Locais** e **Modelos:** cartões lista com o "+" no cabeçalho e o detalhe em formulário de pilha com barra de ação. Arquivar fica na folha "Mais".

## 3.5 Ao vivo, check-in e QR

### 3.5.1 Ao vivo (`/evento/[id]/ao-vivo`, `aoVivo/TelaAoVivo.tsx`)

- **Fundo e regras:** fundo chapado (sem Aurora), tela acesa e tema do sistema.
- **Cabeçalho de pilha:** título com o nome do evento. À direita, chip de conexão ("Ao vivo", sucesso; "Reconectando", alerta; "Só neste aparelho", alerta) e "Mais ações".
- **Cartão de destaque**, a etapa atual:
  - sobrancelha "AGORA · ETAPA 3 DE 7" (ou "PAUSADO");
  - título em `display` 34;
  - 16;
  - dois cronômetros lado a lado, cada um com a sobrancelha ("DECORRIDO", "RESTANTE" ou "ALÉM DO PREVISTO") e o valor em `cronometro` 64/68 `tabular-nums` (teto de 1,4; com fonte grande, empilham);
  - `legenda` "Previsto 15 min, das 16:05 às 16:20".
  - O estouro aparece com o sinal "+", o chip "Atrasado" (alerta) e o texto, não só pela cor.
- **Cartão de vidro "A SEGUIR":** título em `tituloItem` e `legenda` com a duração e o horário.
- **Atraso acumulado:** linha com ícone e texto "Atraso acumulado: 4 min" (alerta) ou "No horário" (sucesso).
- **Progresso:** barra de 6 com o texto "3 de 7 etapas concluídas".
- **Cartão lista "TODAS AS ETAPAS":** a linha atual tem fundo `quenteFundo` e o chip "Agora".
- **Barra de controle fixa** (quem conduz; botões de 56 de altura, porque a tela é usada sob pressão):
  - "Voltar etapa" (só ícone 56×56);
  - primário "Avançar etapa" (ou "Iniciar", "Retomar", "Concluir a última etapa") com `flex: 1`;
  - "Pausar" (só ícone 56×56).
  - "Encerrar" e "Assumir" ou "Liberar condução" ficam na folha "Mais ações", com confirmação.
  - Quem não conduz vê, no lugar da barra, uma linha `corpo` "Você está acompanhando" e o terciário "Assumir a condução" (organizador).
- **Aviso de mudança de andamento:** toast "O andamento mudou: Ana avançou para Louvor", anunciado.

### 3.5.2 Check-in (`/evento/[id]/checkin`, `inscricoes/TelaCheckin.tsx`)

1. Cabeçalho de pilha com o título "Check-in" e o subtítulo com o evento.
2. **Contador:** `numero` 28 "42" mais `corpo` `textoSuave` "presentes de 60 inscritos", em linha, anunciado ao mudar.
3. **Linha de busca:** campo "Buscar pelo nome" (48, `flex: 1`) e o botão só ícone de 48×48 "Ler QR" (`qrcode.viewfinder`, fundo `tonal`), com intervalo de 12.
4. **Cartão lista de pessoas:**
   - avatar de 40, nome e `legenda` ("Inscrição confirmada", "Lista de espera" ou "Membro sem inscrição");
   - à direita, o botão médio secundário "Marcar", ou o chip sucesso "Presente" com check;
   - tocar numa pessoa presente abre a folha com "Desfazer presença" (destrutivo) e o motivo quando não é possível sem conexão.
5. **Cartão de vidro "PELO CÓDIGO":** linha com o campo "Código de entrada" (48) e o botão grande "Marcar" (48).
6. **Cartão de vidro "CHEGOU SEM INSCRIÇÃO":** linha com o campo "Nome" (48) e o botão grande "Registrar" (48).

- **Confirmações:** toast ("Presença de Ana registrada", com "Desfazer").
- **Sem conexão:** aviso alerta no topo e um chip "Neste aparelho" nas presenças locais.

### 3.5.3 Ler QR e QR de entrada (`/evento/[id]/ler-qr`, `inscricoes/TelaLerQr.tsx`; `inscricoes/MinhaInscricao.tsx`)

- **Ler QR:**
  - folha em tela cheia, câmera sangrando até as bordas, sempre escura;
  - visor de 240×240 centralizado, com cantos em L de 4 de espessura e 32 de comprimento em `primaria`, raio 22;
  - instrução numa pílula de vidro no topo: "Aponte para o QR de entrada";
  - resultado em toast (sucesso ou erro, com o nome);
  - embaixo, secundário grande "Buscar pelo nome", que volta.
  - **Sem permissão:** estado vazio (ícone `camera`, motivo) com o primário "Permitir a câmera" ou "Abrir os ajustes".
- **QR de entrada** (minha inscrição):
  - cartão de destaque com a sobrancelha "SUA ENTRADA";
  - o QR de 200 sobre um quadro branco com padding de 16 e raio 14 (`ui/CodigoQR.tsx:26` mantém preto no branco nos dois temas);
  - 12;
  - o código em `numero` 20/24 `tabular-nums` com espaçamento de 2;
  - `legenda` "Mostre na entrada. Aumente o brilho da tela se precisar.";
  - botões "Cancelar inscrição" (secundário) e "Adicionar à carteira" (só se existir; senão, não aparece).

## 3.6 Equipe, Plataforma e Perfil

### 3.6.1 Equipe (`/comunidade`, `comunidade/TelaComunidade.tsx`)

> **D57 (16/11/2026):** a aba se chama **Comunidade**. No topo, os atalhos para Avisos, Pedidos de oração, Sugestões e Conteúdos (e, para a organização, Relatórios, Locais, Modelos e Denúncias); depois Pessoas, Pedidos e Convites. "Configurações da comunidade" aparece uma vez só (no cartão da identidade, com o código). Entrar em outra comunidade, criar e denunciar foram para o Perfil, em "Mais opções"; a Plataforma do Criador fica só no Perfil.

1. Cabeçalho raiz e `display` "Equipe". À direita do título, o botão só ícone "Convidar" (`person.badge.plus`, para quem pode).
2. **Cartão de vidro de identidade:**
   - avatar de 56 com o nome em `tituloCartao` e a `legenda` "Você é Administrador · 24 pessoas";
   - chip se a comunidade não estiver ativa;
   - chip quente "Equipe de oração", se a pessoa fizer parte.
3. **Segmentos** "Pessoas" e "Convites (3)", com a segunda opção só para quem gerencia convites.
4. **Pessoas:**
   - campo de busca de 48;
   - cartão lista: avatar de 40, nome ("Ana Lima (você)"), chip do papel (Administrador quente, Organizador info, Membro neutro), chip "Oração" quando houver, chevron se for editável;
   - e-mail e WhatsApp não aparecem na linha, só no detalhe da pessoa.
5. **Convites:**
   - cartão lista com o ladrilho `link`;
   - título com o papel ("Membro");
   - `legenda` "Para a@b.com · vence em 3 dias" (ou "Link aberto");
   - à direita, o chip da situação (Válido sucesso, Vencido neutro, Usado neutro, Cancelado erro);
   - tocar abre a folha com Copiar link, Compartilhar e "Cancelar convite" (vermelho).
6. **Rodapé:** cartão lista com uma linha destrutiva "Sair de Jovens Central", que pede confirmação nativa.

- **Detalhe da pessoa** (`/membro/[id]`):
  - avatar de 72, nome em `tituloTela` e chip do papel;
  - cartão lista "CONTATO", com linhas de e-mail e WhatsApp e os botões só ícone "Copiar" e "Abrir WhatsApp";
  - "PAPEL" em lista de opções (as opções acima do próprio nível aparecem desabilitadas com o motivo);
  - interruptor "Equipe de oração";
  - linha destrutiva "Remover da comunidade";
  - barra de ação com "Salvar".

### 3.6.2 Convidar (`/convidar`, `comunidade/TelaConvidar.tsx`)

- **Folha grande** com o título "Convidar":
  - "PAPEL" em lista de opções com a descrição de cada papel;
  - "VALIDADE" em segmentos "1 dia", "3 dias" e "7 dias";
  - "PARA QUEM (OPCIONAL)": E-mail (48) e o interruptor "Enviar também por e-mail" (aparece quando há e-mail);
  - barra de ação com o primário "Criar convite".
- **Resultado:**
  - cartão de destaque com a sobrancelha "CONVITE CRIADO";
  - o papel em `tituloCartao`;
  - o link em `legenda`, truncado no meio, selecionável;
  - "Vale até sexta, 21/11 às 18:00";
  - botões "Copiar" e "Compartilhar" (`flex: 1`);
  - abaixo, o terciário "Criar outro convite".

### 3.6.3 Plataforma e criar comunidade (`/plataforma`, `plataforma/TelaPlataforma.tsx`, `TelaNovaComunidade.tsx`, `TelaComunidadeDaPlataforma.tsx`)

- **Plataforma:**
  - cabeçalho de pilha com o título "Plataforma" e o subtítulo "Ações aqui ficam registradas na auditoria"; botão só ícone "+" à direita;
  - cartão de vidro "VISÃO GERAL" com 3 números lado a lado em `numero` 28 (comunidades, pessoas ativas, sem administrador) e `legenda` abaixo;
  - cartão lista "COMUNIDADES": avatar de 40, nome, `legenda` "24 pessoas", chip da situação e o chip alerta "Sem admin" quando for o caso;
  - quando a prova de segundo fator é exigida, um cartão de destaque com o campo de código e o primário "Confirmar".
- **Criar comunidade:**
  - folha com o título "Nova comunidade";
  - Nome (48);
  - "COR": grade de 6 amostras de 44 (raio 999), com o nome da cor em `legenda` abaixo de cada uma; a selecionada tem anel de 2 em `texto` com afastamento de 2 e um check sobre a amostra (sinal de forma);
  - "PRÉVIA": a pílula da comunidade exatamente como vai aparecer;
  - e-mail de quem vai administrar (opcional);
  - barra de ação com "Criar comunidade";
  - **resultado:** cartão de destaque com o convite do primeiro administrador (mesmo formato do 3.6.2).
- **Comunidade da plataforma:**
  - identidade;
  - cartão lista com números;
  - "Mais ações" em folha: Suspender, Reativar, Nomear administrador, Arquivar e, por último, "Agendar exclusão" em vermelho.

### 3.6.4 Perfil com categorias (`/perfil`; substitui `navegacao/TelaMais.tsx` e `perfil/TelaPerfil.tsx`)

> **D57 (16/11/2026):** o Perfil fica só com a conta: "Sua conta" (Editar perfil, Ajustes de notificação, Segurança, Versículo do dia, Privacidade e dados, Ajuda e sobre), Comunidades (trocar), Criador (Plataforma do Criador, só para o Criador) e "Mais opções" no fim (Pessoas bloqueadas, Uso sem internet, Entrar em outra comunidade, Criar comunidade, Denunciar comunidade). Os grupos "Na comunidade" e "Organização" abaixo foram para a aba Comunidade.

1. Cabeçalho raiz (pílula e status) e `display` "Perfil".
2. **Cartão de vidro de identidade:**
   - avatar de 72 com anel à esquerda;
   - 16;
   - nome em `tituloCartao`, e-mail em `legenda` e o terciário "Editar dados" (que abre a folha "Seus dados" com Nome, WhatsApp e "Salvar").
3. **Categorias**, cada uma com a sobrancelha fora do cartão e um cartão lista. As linhas têm ladrilho, título, valor ou chip à direita e chevron.
   - **NA COMUNIDADE:**

     | Item      | À direita                      |
     | --------- | ------------------------------ |
     | Avisos    | contagem de novos, chip quente |
     | Oração    |                                |
     | Sugestões |                                |
     | Conteúdos |                                |

   - **ORGANIZAÇÃO** (por permissão): Relatórios, Locais, Modelos, Denúncias.
   - **CONTA:**

     | Item                 | À direita                              |
     | -------------------- | -------------------------------------- |
     | Segurança            | chip "2 etapas: Ligada" ou "Desligada" |
     | Notificações         |                                        |
     | Versículo do dia     | valor "07:00"                          |
     | Aparelhos conectados | valor "3"                              |

   - **COMUNIDADES:**

     | Item                 | À direita         |
     | -------------------- | ----------------- |
     | Trocar de comunidade | nome atual        |
     | Plataforma           | só para o Criador |

   - **AJUDA E PRIVACIDADE:**

     | Item                          | À direita                            |
     | ----------------------------- | ------------------------------------ |
     | Mapa da missão                |                                      |
     | Pendências e uso sem internet | chip com a contagem                  |
     | Privacidade e dados           |                                      |
     | Termos de Uso                 | `arrow.up.right` no lugar do chevron |
     | Política de Privacidade       | `arrow.up.right` no lugar do chevron |
4. **Cartão lista com uma linha destrutiva** "Sair deste aparelho".
5. `legenda` `textoSuave` com a versão do app ("Uni Jovem 1.0 (42)").

### 3.6.5 Segurança (`/ativar-2fa`, `/aparelhos`, `perfil/TelaAtivar2fa.tsx`, `TelaAparelhos.tsx`)

- **Título** "Segurança".
- **2FA desligada:** cartão de destaque "RECOMENDADO", com `tituloCartao` "Ligue a verificação em duas etapas", `corpo` explicando e o primário "Ligar".
- **2FA ligada:** cartão lista "VERIFICAÇÃO EM DUAS ETAPAS" com a linha "Autenticador" (chip "Ligada"), "Códigos de recuperação" e a linha destrutiva "Desligar".
- **Fluxo de ligar:** mesmo padrão em 3 passos do primeiro acesso.
- **Face ID** (se aprovado): linha de interruptor.
- **Aparelhos:**
  - cartão lista com o ladrilho `iphone` ou `laptopcomputer`, o nome, o chip "Este aparelho" (quente) e a `legenda` "Visto hoje às 14:32";
  - nos outros aparelhos, o botão médio destrutivo "Desconectar" à direita.

### 3.6.6 Notificações (`/notificacoes`, `notificacoes/TelaNotificacoes.tsx`)

- **Título** "Notificações".
- **"NESTE APARELHO":**
  - permissão concedida: linha com o chip "Permitidas";
  - permissão negada: aviso alerta "As notificações estão bloqueadas nos ajustes do aparelho" com o terciário "Abrir os ajustes".
- **"POR COMUNIDADE":**
  - com mais de uma comunidade, pílulas de filtro com os nomes;
  - cartão lista de interruptores: a primeira linha é o principal, "Receber de Jovens Central"; abaixo, um interruptor por tipo (Eventos, Escalas, Inscrições, Tarefas, Substituições, Alterações importantes e Avisos), cada um com a descrição em `legenda`;
  - com o principal desligado, os outros ficam desabilitados com o motivo.
- **"VERSÍCULO":** linha com o valor "07:00" e chevron.

### 3.6.7 Versículo (`/versiculo`, `versiculo/TelaVersiculo.tsx`)

- **Título** "Versículo do dia".
- **Prévia:** cartão de vidro igual ao do Início.
- **Cartão lista:**
  - interruptor "Receber todo dia" (descrição "Vale para a sua conta, em todas as comunidades");
  - linha "Horário" com o seletor de hora nativo compacto à direita (sem botão Salvar: salva ao escolher e confirma com toast).
- **Permissão do sistema:** linha como em 3.6.6.
- **Cartão lista "SOBRE A TRADUÇÃO":** linha "Bíblia Livre (BLIVRE)" com a `legenda` "CC BY 4.0" e chevron.
- **Tela de atribuição:** texto em `leitura` num cartão de vidro e linhas com os links externos.

## 3.7 Módulos

### 3.7.1 Oração (`/oracao`, `/oracao/novo`, `/oracao/[id]`; `oracao/*`)

- **Lista:**
  - título "Oração" e subtítulo "Cada pedido mostra quem vê"; "+" à direita;
  - pílulas de filtro "Todos", "Meus", "De outras pessoas", separador, "Em oração" e "Respondidos";
  - cada pedido é um cartão de vidro:
    - sobrancelha "PEDIDO DE ANA · 12 NOV" (ou "SEU PEDIDO");
    - à direita da sobrancelha, chip neutro com quem vê ("Equipe de oração") e chip sucesso "Respondido";
    - 8;
    - texto em `leitura`, com no máximo 6 linhas e o terciário "Ler tudo";
    - 14;
    - linha de ação: botão médio "Estou orando" (secundário, ícone de mãos). Marcado, o fundo vira `quenteFundo`, a borda `destaque`, o ícone vira check e o rótulo "Orando"; o sinal é o rótulo e o ícone. Depois, `legenda` "5 pessoas orando" e, à direita, "Mais ações" (44).
    - A folha "Mais ações" tem Marcar como respondido, Editar ou mudar quem vê, Denunciar (de outra pessoa) e Excluir (vermelho, quando o pedido é seu). Isso acaba com os 4 botões largos.
- **Novo pedido:**
  - folha grande com o título "Novo pedido";
  - multilinha de 160 em `leitura`, com o contador "0/2000";
  - aviso info compacto com o texto de privacidade (`AVISO_DO_TEXTO`) e o terciário "Entenda como é guardado";
  - "QUEM VAI VER" em lista de opções com a contagem de leitores na descrição ("Somente eu", "Equipe de oração · 4 pessoas", "Comunidade · 24 pessoas");
  - barra de ação com "Publicar pedido";
  - a confirmação de visibilidade continua nativa.
- **Detalhe:** o cartão do pedido completo, a lista de quem está orando (só a contagem, se for privado) e a barra de ação "Estou orando".

### 3.7.2 Sugestões (`/sugestoes`; `sugestoes/*`)

- **Lista:**
  - título "Sugestões", "+";
  - pílulas por situação (Recebida, Em análise, Aceita e Recusada);
  - cartão lista: título em `tituloItem`, `legenda` com a data e o chip da situação (Recebida neutro, Em análise info, Aceita sucesso, Recusada erro), mais o chip neutro "Anônima".
- **Nova:**
  - folha com Título, Ideia (multilinha) e o interruptor "Enviar sem mostrar meu nome" (descrição: "Os outros membros não veem seu nome; o sistema registra para evitar abuso");
  - barra de ação.
- **Detalhe e moderação:**
  - título e texto em `leitura`;
  - cartão de vidro "RESPOSTA DA ORGANIZAÇÃO";
  - para quem modera: segmentos de situação, o campo de resposta e a barra de ação "Salvar resposta".

### 3.7.3 Conteúdos (`/conteudos`; `conteudos/*`)

- **Lista:**
  - título "Conteúdos", "+";
  - segmentos "Músicas", "Músicos", "Palestrantes" e "Dinâmicas" (rótulos curtos);
  - busca;
  - cartão lista:
    - música: ladrilho `music.note`, título, `legenda` "Tom G · Ana (violão)" e chip "Fixado";
    - pessoa: avatar.
- **Detalhe:**
  - título;
  - cartão lista "DETALHES" (Tom, Cifra com `arrow.up.right`, Quem toca);
  - "NOTAS" em `leitura`;
  - barra de ação "Editar" (para quem pode).

### 3.7.4 Avisos (`/avisos`; `avisos/*`)

- **Lista:**
  - título "Avisos", "+" para quem publica;
  - os fixados primeiro, num cartão lista com a sobrancelha "FIXADOS";
  - depois "RECENTES";
  - cada linha: título em `tituloItem`, 2 linhas em `corpo` `textoSuave` e a data em `legenda`;
  - o chip "Rascunho" só para a organização;
  - "Fixado" aparece uma vez só: na sobrancelha do grupo (corrige T-29).
- **Detalhe:**
  - `tituloTela`, a `legenda` com a data e quem publicou, e o texto em `leitura`;
  - barra de ação (organização) com o primário contextual ("Publicar" ou "Fixar") e "Mais ações" (Editar, Tirar do ar, Excluir).
- **Novo:**
  - folha com Título, Texto e o interruptor "Fixar no topo";
  - "Publicar em": Data e Hora (opcional), com seletores;
  - barra de ação com "Salvar rascunho" e "Publicar".

### 3.7.5 Relatórios (`/relatorios`, `/relatorios/exportacoes`; `relatorios/*`)

- **Cabeçalho:** título "Relatórios" e subtítulo "Números agregados. Pedidos de oração nunca entram"; à direita, o botão só ícone "Exportar" (`square.and.arrow.down`).
- **Filtros:**
  - pílulas de tipo "Presença", "Inscrições", "Escalas" e "Atividade";
  - pílulas de período "30 dias", "90 dias", "12 meses" e "Personalizado" (este abre uma folha com Data inicial e Data final lado a lado);
  - em Presença, segmentos "Semana" e "Mês".
- **Números:** grade de 2 colunas (intervalo de 12) de cartões de vidro compactos (padding 14 dentro do componente), com o valor em `numero` 28/32 `tabular-nums` e o rótulo em `legenda`.
- **Gráficos:**
  - cartão de vidro com a sobrancelha (por exemplo, "PRESENÇAS POR MÊS");
  - cada barra: rótulo em `legenda` acima; trilho de 8 com raio 999 em `tonal` e preenchimento `primaria`, sem borda; valor à direita em `botao` `tabular-nums` com largura mínima de 48.
- **Rodapé:** `legenda` "Os números mostram participação, não desempenho".
- **Exportar:**
  - lista de opções com o tipo de arquivo;
  - aviso info "O arquivo expira em 24 h";
  - barra de ação com "Gerar CSV";
  - cartão lista com as exportações recentes e o chip ("Pronta", "Expirada").

### 3.7.6 Pendências (`/pendencias`, `offline/TelaPendencias.tsx`)

- **Título** "Pendências e uso sem internet".
- **Cartão de destaque com o estado:**
  - sobrancelha "SINCRONIZAÇÃO";
  - `tituloCartao` "Tudo sincronizado", "3 alterações pendentes" ou "Sem conexão";
  - `legenda` "Última às 14:32";
  - primário inverso "Sincronizar agora".
- **Conflitos:** cartão de vidro "CONFLITOS", com, para cada conflito, as duas versões lado a lado em cartões compactos ("Neste aparelho" e "No servidor") e os botões "Manter esta" em cada um.
- **Pendentes:** cartão lista "PENDENTES", com o chip da situação.
- **Guardado:** cartão lista "GUARDADO NESTE APARELHO", com os eventos preparados (validade "até 28/11") e a linha destrutiva "Apagar do aparelho".

### 3.7.7 Mapa da missão (`/missao`, `onboarding/TelaMapaDaMissao.tsx`)

> **D57 (16/11/2026):** na interface, "Primeiros passos" (em Perfil, Ajuda e sobre).

- **Fundo:** Aurora total. Cabeçalho de pilha com "Pular" (terciário) à direita.
- **Passos:** a sobrancelha "PASSO 2 DE 5" e a barra de passos.
- **Demonstração:** cartão de destaque com a tela de exemplo (dados fictícios, chip neutro "Exemplo").
- **Texto:** `tituloTela` com o objetivo do passo e `corpo` explicando.
- **Barra de ação:** "Pausar" (secundário) e "Continuar" (primário).
- **Conclusão:**
  - cartão de destaque com `tituloCartao` "Tudo pronto";
  - lista de missões de configuração com caixas de marcar;
  - primário "Ir para o Início";
  - celebração: ícone `sparkles` de 48 estático com Reduzir movimento, sem confete.

### 3.7.8 Privacidade e Excluir conta (`/privacidade`, `/excluir-conta`; `privacidade/*`)

- **Privacidade:**
  - título "Privacidade e dados";
  - cartão de vidro "SEUS DADOS" com `corpo` explicando e o secundário "Exportar meus dados"; enquanto a exportação é gerada, o chip "Preparando" e o aviso info;
  - cartão lista "DOCUMENTOS", com links externos (`arrow.up.right`);
  - cartão lista com a linha destrutiva "Excluir minha conta".
- **Excluir conta:**
  - título "Excluir sua conta?" e subtítulo "Isso não pode ser desfeito";
  - cartão lista "O QUE ACONTECE": cada consequência é uma linha com o ladrilho `erroFundo` e o ícone `xmark.circle`, substituindo os "•" de `TelaExcluirConta.tsx:78-80`;
  - terciário "Antes, baixe uma cópia dos seus dados";
  - cartão de vidro "CONFIRME QUE É VOCÊ", com Senha e Código (se houver 2FA), cada um com o próprio erro (corrige a revisão M7);
  - quando a pessoa é a única administradora, um aviso alerta com as linhas "Abrir os membros de X";
  - barra de ação com "Cancelar" (secundário) e "Excluir minha conta" (destrutivo cheio);
  - a confirmação final continua nativa.

### 3.7.9 Trocar de comunidade, Denúncias e Não encontrado

- **Trocar de comunidade:**
  - folha;
  - lista de opções com o avatar de 40 no lugar do rádio (o rádio fica à direita; o anel do avatar marca a atual);
  - o toque troca e fecha a folha;
  - toast "Agora em Jovens Central".
- **Denúncias:** cartão lista com o chip da situação e o detalhe em pilha com a barra de ação "Resolver" e "Mais ações".
- **Não encontrado:** estado vazio em tela inteira com o primário "Ir para o Início".

---

# 4. Roadmap de redesign

## 4.0 Regras do trabalho

- **Branch e verificação:** todo o trabalho acontece direto na branch `release`, com `npm run verificar` verde antes de cada commit.
- **Commits:** formato `UJ-Fnn-Enn: resumo`, com a fase vigente do `docs/STATUS.md`.
- **Ao fim de cada etapa:**
  - atualizar `docs/STATUS.md` e `docs/rastreabilidade.md`;
  - criar os ADRs no mesmo dia: troca de `NativeTabs` pela barra própria; abas Programas e Equipe com Perfil no lugar de Mais; tema claro com destaque invertido; e, se o dono aprovar, vidro translúcido de conteúdo.
- **Publicação:** build de homologação para o iPhone (TestFlight ou instalação interna) é publicação e exige aprovação do dono antes.
- **Custo:** nenhum serviço pago. As dependências novas são gratuitas e só entram se forem necessárias: `Inter_500Medium` (no pacote já instalado), `@expo/ui` (já instalado) e, se o Face ID for aprovado, `expo-local-authentication`.

## 4.1 Mockups antes de codar: recomendação

**Sim**, mas sem travar o que já está aprovado.

- **O Início escuro está aprovado.** D0 e D1 podem começar já, porque os componentes de base e a casca saem do mockup existente.
- **Para D2 em diante,** produzir antes um conjunto mínimo de quadros de 390×844, no mesmo formato `.dc.html` de `direcoes\project\Main.dc.html`, para os valores serem copiados sem reinterpretação. São 9 quadros, cerca de 1 dia de trabalho.

| #   | Quadro                                                                                                             | Tema           | O dono... | Por quê                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------ | -------------- | --------- | ----------------------------------------------------------------- |
| 1   | Folha de componentes (botões nos 6 estados, campo nos 6 estados, chips, segmentos, pílulas, linhas, avisos, toast) | Escuro e claro | Aprova    | É a base de todas as telas; um erro aqui se multiplica            |
| 2   | Início com dados                                                                                                   | Claro          | Aprova    | O tema claro com destaque invertido é decisão nova (1.11, item 7) |
| 3   | Detalhe do evento (organizador, segmentos e barra de ação)                                                         | Escuro         | Aprova    | Muda a estrutura da tela mais complexa                            |
| 4   | Perfil com categorias                                                                                              | Escuro         | Aprova    | Substitui o "Mais" e muda a navegação                             |
| 5   | Entrar                                                                                                             | Escuro         | Confere   | Segue o padrão do Início                                          |
| 6   | Agenda (mês)                                                                                                       | Escuro         | Confere   | Grade e estados de dia                                            |
| 7   | Criar programação (com seletores de data e hora e barra de ação)                                                   | Escuro         | Confere   | Padrão de todo formulário                                         |
| 8   | Equipe (pessoas)                                                                                                   | Escuro         | Confere   | Padrão de lista com avatar                                        |
| 9   | Ao vivo                                                                                                            | Escuro         | Confere   | Tela crítica de uso sob pressão                                   |

As telas de D4 seguem os padrões aprovados nos quadros 3, 7 e 8 e não precisam de mockup próprio. Elas recebem conferência por captura no D5.

## 4.2 Fases

### D0. Tokens e componentes de base. Esforço: G (8 pontos)

**Objetivo:** existir, testado e catalogado, tudo o que a seção 2 especifica, antes de mexer em qualquer tela.

**Entregas:**

- **`packages/tokens`:**
  - paletas base e inversa dos dois temas (2.2);
  - `AURORA` (2.3), `TIPO` (2.4, com espaçamento entre letras, caixa e teto de escala), `ESPACO` (2.5), `ALTURA`, `RAIO` (2.6), `ELEVACAO` (2.7), `VIDRO` (2.8) e `DURACAO` (2.9);
  - `compor()` em `contraste.ts`;
  - `PARES_OBRIGATORIOS` com todos os pares de 2.11.
- **`apps/app/src/ui/fontes.ts`:** Inter 500; sai a Bricolage 600.
- **Componentes novos ou reescritos em `src/ui`:**
  - Botao, Campo, CampoDeData, CampoDeHora, CampoDeBusca;
  - Segmentos, PilulasDeFiltro, ListaDeOpcoes, CaixaDeMarcar, Interruptor;
  - CartaoDeVidro, CartaoDeDestaque, ProvedorDeTemaInverso;
  - LinhaDeLista, Chip, Avatar;
  - EstadoVazio, Esqueleto, Aviso, Toast, BarraDeAcao, FundoAurora;
  - o hook `useAnunciar` para iOS e web (revisão A1 e A4).
- **Catálogo:** rota de desenvolvimento `/_catalogo` (fora dos builds de produção), com cada componente em todos os estados, nos dois temas e com o inverso.
- **Lint:**
  - proíbe literais numéricos em `style` em `src/funcionalidades`;
  - proíbe `ESPACO.e2`, `e6`, `e10`, `e14` e `e18` fora de `src/ui`;
  - proíbe `opacity` como estado em `src/ui`.
- **Migração:** codemod de `ESPACO.xN` para `ESPACO.eN`. As telas ainda usam os componentes antigos, que viram fachadas para os novos onde a assinatura permite.

**Critério de aceite:**

- `npm run verificar` verde.
- O teste de contraste cobre pelo menos 50 pares, todos acima dos mínimos de 2.11.
- O catálogo foi capturado em 390×844, escuro e claro. As medidas de altura, raio e padding de Botão, Campo, Cartão, Chip e Linha batem com a seção 2 com tolerância de 0,5 pt. A conferência é sobreposta à folha de componentes aprovada (quadro 1).
- Testes de componente de Botão e Campo cobrem os 6 estados, com `aria-*` correto.
- `grep` por `opacity:` em `src/ui` encontra 0 usos para estado.

### D1. Casca: Aurora, cabeçalho, abas, Início e entrada. Esforço: G (8 pontos)

**Objetivo:** o iPhone do dono mostrar o mockup.

**Entregas:**

- FundoAurora nas telas da 2.3.
- CabecalhoDeTela (raiz, pilha, folha, compacto ao rolar), pílula da comunidade e status de sincronização na mesma linha.
- Barra de abas própria (Início, Agenda, Programas, Equipe e Perfil, com o avatar e o anel).
- Perfil vira aba e absorve o "Mais", com as categorias da 3.6.4.
- `headerShown: false` em todas as pilhas e a prop `cabecalhoNativo` removida.
- `Tela` com margem de 20 e padding inferior de 120.
- Início nas 4 variações (3.2).
- Entrar, Convite, Primeiro acesso, Segundo fator e Recuperar e Redefinir senha (3.1).
- Face ID, se aprovado.

**Critério de aceite:**

- **Início escuro em 390×844, sobreposto ao mockup aprovado,** com diferença de até 2 pt em: pílula (x=20, y = área segura + 8, altura 44), linha de base do display, cartões (x=20, largura 350, raio 22, padding 18) e barra de abas (x=16, largura 358, 24 do fundo, raio 28, item ativo de 58×48).
- **Comandos de conferência:**
  - `grep -rn "headerShown: true" apps/app/src/app` encontra 0;
  - `grep -rn "cabecalhoNativo" apps/app/src` encontra 0;
  - `grep -rn "NativeTabs" apps/app/src` encontra 0.
- **VoiceOver** lê a barra como abas, com "selecionado", e o voltar como "Voltar".
- **Com Reduzir transparência,** a barra e a pílula ficam opacas (captura).
- **Com fonte AX3,** nada é cortado (captura).
- **O estado "sem comunidade"** tem ação nas duas variações (teste).

### D2. Telas de uso diário. Esforço: G (13 pontos)

**Pré-requisito:** quadros 2, 3, 6 e 7 aprovados ou conferidos.

**Entregas:**

- Agenda (mês, semana e lista) e Linha do tempo (3.3).
- Programas, lista (3.4.1).
- Detalhe do evento na visão de membro (3.4.2: visão geral e programação).
- Minhas escalas e substituição (3.4.5).
- QR de entrada (3.5.3).
- Avisos, leitura (3.7.4).
- Oração: lista, novo e detalhe (3.7.1).
- Versículo e Notificações com interruptores (3.6.6 e 3.6.7).

**Critério de aceite:**

- Cada tela foi capturada nos dois temas e conferida com a lista da seção 5, sem item reprovado.
- Nenhuma data ou hora é digitada nessas telas: `grep` por "DD/MM/AAAA" e "HH:MM" nos rótulos e ajudas encontra 0.
- No máximo 2 botões por linha e 1 primário visível por tela, conferidos por captura.
- Esqueletos aparecem no lugar de `Carregando` nas listas.

### D3. Gestão: Equipe, Plataforma e eventos. Esforço: G (13 pontos)

**Pré-requisito:** quadros 3, 8 e 9.

**Entregas:**

- Detalhe do evento para o organizador, com segmentos, preparação e barra de ação.
- Criar, editar e duplicar evento (3.4.3).
- Etapas e Etapa e equipe (3.4.4).
- Mudar situação, Série, Locais e Modelos (3.4.6).
- Ao vivo (3.5.1), Check-in e Ler QR (3.5.2 e 3.5.3), Inscrições.
- Equipe com Pessoas, Convites e Membro (3.6.1), e Convidar (3.6.2).
- Plataforma, Criar comunidade e Comunidade da plataforma (3.6.3).

**Critério de aceite:**

- `AcoesDoEvento.tsx` foi removido e as ações estão na barra de ação e na folha. Captura do detalhe com 8 ações possíveis mostra 2 botões visíveis.
- No check-in, campo e botão aparecem lado a lado com 48 (medido).
- O Ao vivo foi conferido em AX3: os cronômetros não cortam e os controles continuam alcançáveis.
- Os testes de isolamento e de permissão existentes continuam verdes (o redesign não toca nas regras).

### D4. Módulos. Esforço: M (8 pontos)

**Entregas:**

- Sugestões, Conteúdos e Avisos na gestão (3.7.2 a 3.7.4).
- Relatórios e Exportar (3.7.5).
- Pendências (3.7.6) e Mapa da missão (3.7.7).
- Privacidade e Excluir conta (3.7.8).
- Segurança e Aparelhos (3.6.5).
- Denúncias, Trocar de comunidade e Não encontrado (3.7.9).
- O diálogo próprio da web (2.12.20).

**Critério de aceite:**

- Nenhum arquivo importa `Cartao`, `Linha`, `Selo`, `GrupoDeOpcoes`, `Carregando` ou `AvisoDeErro` antigos (lint ativo). Os arquivos antigos foram apagados.
- Os números de relatório usam `tabular-nums` (teste de estilo).
- A lista da seção 5 está aprovada em todas as telas do D4.

### D5. QA visual. Esforço: M (5 pontos)

**Matriz de capturas:**

- todas as rotas, nos dois temas, em quatro condições: padrão, fonte AX3 (cerca de 200%), Reduzir transparência e Aumentar contraste;
- no simulador do iPhone 16 (390×844);
- e, nas telas principais, no Android em 412×915;
- para regressão de layout, também na web em 390×844 com Playwright.

**Sobreposição:** as capturas foram sobrepostas aos quadros aprovados com 50% de opacidade, conferindo os pontos de ancoragem (pílula, título, cartões, barra e barra de ação).

**Checagens extras:**

- o eixo óptico da Bricolage (1.11, item 9);
- a barra com o cartão de destaque passando por baixo (contraste medido na captura);
- a Aurora com conteúdo rolado.

**Resultado:** correções aplicadas e um registro em `docs/` com as capturas antes e depois.

**Critério de aceite:**

- 100% das telas aprovadas na lista da seção 5.
- Nenhuma diferença maior que 2 pt nos pontos de ancoragem das telas com mockup.
- Todo contraste medido em captura é de 4,5 ou mais (texto) e de 3 ou mais (interface).
- O dono conferiu no próprio iPhone, depois de aprovar a instalação.

**Ordem e paralelismo:** D0 vem antes de D1. Depois do D1, D2 e D3 podem andar em paralelo. Em seguida vêm D4 e D5. O total é de cerca de 55 pontos. Se tudo couber num lote só, a casca (D1) é o que o dono sente primeiro e é o maior ganho por esforço.

---

# 5. Lista de verificação de aceite visual (usar tela por tela)

Para cada tela: capturar em 390×844, nos temas escuro e claro, e marcar cada item.

**Estrutura**

- [ ] Sem cabeçalho nativo: cabeçalho de tela próprio (raiz, pilha ou folha) com a área segura mais 8 no topo.
- [ ] Raiz de aba: pílula da comunidade e status na mesma linha, `display` 34/38 abaixo, com 16 de espaço.
- [ ] Pilha: voltar circular de 44 com o rótulo "Voltar", e o `tituloTela` 28/32 12 abaixo.
- [ ] Fundo Aurora conforme a 2.3 (total, 60% ou nenhum) e rolando junto com o conteúdo.
- [ ] Barra de abas própria nas raízes; barra de ação fixa nas pilhas com ação principal.

**Grade e espaço**

- [ ] Margem lateral de 20 em todos os blocos; barra de abas a 16.
- [ ] Intervalo de 16 entre blocos; grupo novo com 24 acima e 8 abaixo da sobrancelha.
- [ ] Cartões com padding de 18 e raio 22; conteúdo em x=38.
- [ ] Tudo alinhado à esquerda (só a marca, o QR e o visor centralizados).
- [ ] Campo e botão na mesma linha com 48 de altura e a mesma base.
- [ ] Nenhum literal numérico de estilo na tela (lint).

**Hierarquia**

- [ ] Uma coisa mais importante: no máximo 1 cartão de destaque.
- [ ] No máximo 1 botão primário visível e no máximo 2 botões por linha.
- [ ] Nenhum cartão com ícone no cabeçalho; seções com sobrancelha.
- [ ] Nenhum cartão dentro de cartão, nem caixa com borda dentro de cartão.
- [ ] Início sem seções vazias ocupando cartão (exceto o vazio único).

**Tipografia**

- [ ] Só papéis da 2.4; nenhum tamanho fora da tabela.
- [ ] Sobrancelha em maiúsculas por estilo, 12/16 600 +1, cor `destaque`.
- [ ] Horas e números em coluna com `tabular-nums`.
- [ ] Botões em 15/20 600; rótulos de campo em 13/18 600 `textoSuave`.

**Cor e contraste**

- [ ] Só tokens; nenhum hex na tela.
- [ ] Um acento (coral); o violeta só na Aurora e na info.
- [ ] Todos os pares de texto com 4,5 ou mais, e de interface com 3 ou mais, inclusive sobre a Aurora e sob a barra (medir na captura nos pontos críticos).
- [ ] Cor nunca é o único sinal: estado com texto, ícone, peso ou forma.

**Componentes e estados**

- [ ] Botões com raio 14, sem pílula; pressionado e desabilitado desenhados (sem `opacity`).
- [ ] Campos com 48, fundo `campoFundo`, foco sem deslocar o texto, erro com ícone e texto que diz como corrigir.
- [ ] Data e hora por seletor nativo; liga e desliga por interruptor.
- [ ] Chips preenchidos, de 1 a 2 palavras, à direita da linha da meta.
- [ ] Listas como cartão lista com separadores recuados, ladrilho ou avatar e chevron só em linhas que navegam.
- [ ] Carregamento por esqueleto (o indicador giratório fica só em botões).
- [ ] Estado vazio alinhado à esquerda, com ação.
- [ ] Confirmação transitória em toast; destrutiva com diálogo nativo e verbo explícito.

**Acessibilidade**

- [ ] Todo alvo com 44 ou mais (48 no Android).
- [ ] VoiceOver: ordem de leitura igual à visual; títulos como cabeçalho; abas e segmentos com estado selecionado; erro anunciado.
- [ ] Fonte AX3 (cerca de 200%): nada cortado; pares viram coluna; o mês vira lista; a barra usa o visualizador de conteúdo grande.
- [ ] Reduzir transparência: barra, folha, pílula e cabeçalho compacto opacos.
- [ ] Aumentar contraste: sem Aurora, bordas de 2 e textos intactos.
- [ ] Reduzir movimento: sem escala no toque, sem deslizar no toast, esqueleto estático.

**Texto**

- [ ] Português do Brasil, sem travessão, sem termo técnico em erro.
- [ ] Rótulos de botão com verbo e objeto, até 22 caracteres, sem o nome da comunidade.
- [ ] Nenhuma informação repetida (título duplicado, "Fixado" duas vezes, data duas vezes).

**Fidelidade (telas com mockup)**

- [ ] Sobreposição a 50% com o quadro aprovado: âncoras com diferença de até 2 pt.
- [ ] Desenho da Bricolage igual ao do mockup (eixo óptico conferido).
- [ ] O dono conferiu no próprio aparelho (depois de aprovar a instalação).

---

Fontes externas consultadas: [React Native, propriedades de estilo de View (gradiente radial a partir da 0.80)](https://reactnative.dev/docs/0.81/view-style-props).
