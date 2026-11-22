# Fácil de usar: o caminho do administrador e o teste do vovô

Data: 22/11/2026. Branch `release`. Leitor: o dono. Pedido do dono depois de testar a Direção A no TestFlight: "o app é maravilhoso e lindo, mas tem que ser fácil de usar". Requisito novo, vale para o documento inteiro: **idosos (60, 70 anos, pouca prática, vista cansada, mãos menos precisas) vão usar o app.** Toda proposta abaixo passa no teste da seção 0.

## Como este documento foi feito (e o que ficou de fora)

- **Li:** `docs/design/app-v3-ux.md` (estrutura, fluxos (c) a (i), vocabulário), `docs/produto/modo-musico.md`, `docs/qa/v3/README.md`, as capturas `390-escuro` (Início líder, Encontro Resumo e Convocados, Convocar, Igual ao último sábado, Novo encontro, Comunidade líder, Meu repertório do líder, Repertório do encontro) e o código de `inicio`, `eventos`, `repertorio`, `comunidade/atalhosDoMural.ts`, `packages/dominio/src/banda.ts`, `apps/api/src/rotas/montar-encontro.ts`, `apps/api/src/rotas/momento.ts` e o índice único de `atribuicoes` (migração 0004).
- **Não rodei o app.** Os toques são contados pelo código e pelas capturas (estimativas, não medidas). A causa do "já convocado" (seção 1.3, item 2) está lida no código, **não reproduzida**: reproduzir é o primeiro teste da Onda 1.
- **Não verifiquei** fonte grande, VoiceOver nem TalkBack no aparelho (o README do QA também não). O que digo sobre idosos vem dos tokens e do código, e a prova final é a seção 6.6 (5 pessoas de 60 anos ou mais).
- **Decisão do dono já registrada neste pedido:** toda a comunidade vê repertório e banda. Isso muda a D62 ("Louvor só de quem toca ou organiza").

---

## 0. Teste da vovó e do vovô (critério de aceite de tudo)

Uma tela ou proposta só passa se passar nos 12 itens. Cada um é verificável.

| #   | Critério                                                                                                                  | Como se verifica                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | **Letra:** nenhum texto que informa abaixo de 16 pt                                                                       | Revisar `TIPO` em `packages/tokens/src/index.ts`; captura com texto medido               |
| 2   | **Fonte do sistema a 200% sem quebrar:** nada some, nada vaza, o botão principal continua à vista, sem rolagem horizontal | Captura em 390 e 375 com escala 2,0 (Playwright `fontScale`/zoom de texto) e no aparelho |
| 3   | **Alvos de 48 pt ou mais**, com 8 pt ou mais de espaço entre dois alvos                                                   | Auditoria automática do `capturas-v3.ts` (hoje avisa só abaixo de 40 pt: subir para 48)  |
| 4   | **Uma ação principal por tela** e no máximo 3 secundárias visíveis                                                        | Contar botões cheios e tonais por tela                                                   |
| 5   | **Poucas escolhas à vista:** no máximo 6 opções em um grupo, sem rolar de lado                                            | Grupos de chips que cortam na borda reprovam                                             |
| 6   | **Palavras comuns:** nada de "bloco", "etapa", "atribuição", "convocar" onde "chamar" ou "adicionar" servem               | Varredura de texto contra a lista da seção 4                                             |
| 7   | **Nada escondido:** nem em gesto, nem em ícone sem texto, nem em "Mais", nem em pressionar e segurar                      | Todo ícone de ação tem palavra ao lado; todo "Mais" some ou vira linhas visíveis         |
| 8   | **Contraste alto:** AA em tudo, e 7:1 no texto de ação e de estado                                                        | Medir os pares do tema claro e do escuro                                                 |
| 9   | **Confirmação clara do que aconteceu**, com nome: "Pronto. Ana foi chamada para a bateria."                               | Texto de sucesso de toda ação                                                            |
| 10  | **Desfazer visível, sem pressa:** sem contagem curta; ação que avisa gente mostra antes quem será avisado                 | Nenhum Desfazer com relógio de 10 s                                                      |
| 11  | **Erro diz o que fazer**, sem código nem desculpa; nunca perde o que a pessoa fez                                         | Texto de erro de toda ação                                                               |
| 12  | **Não se perde:** botão "Voltar" com a palavra, título que diz onde está, mesma ação no mesmo lugar                       | Ícone sozinho de voltar, fechar ou compartilhar reprova                                  |

---

## 1. Diagnóstico honesto do caminho do administrador

### 1.1 Toques, telas e conceitos hoje (estimativas pelo código e capturas)

Parte do Início, líder, celular.

| Tarefa                                                | Toques                   | Telas e superfícies                                                          | Observação                                                                                                                                                   |
| ----------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Criar o sábado, **primeira vez** (sem anterior)       | cerca de 10 e 1 campo    | Início, Agenda, folha "Novo encontro", formulário (data e hora em seletores) | Título, data, hora e local chegam vazios. O "Sábado padrão" não vem preenchido                                                                               |
| Criar o sábado com anterior, pelo Início              | 2                        | Início, "Igual ao último sábado"                                             | Só funciona se o Início estiver em "Nada marcado" ou "Terminou". É o melhor caminho e está escondido atrás do estado                                         |
| Chamar 8 membros para o encontro                      | cerca de 12              | Início, Encontro Resumo, aba Convocados, folha "Convocar pessoas"            | Rolar até o botão "Convocar pessoas" no fim; 8 marcações; 10 s de espera                                                                                     |
| **Depois**, chamar a banda (5 funções, 1 pessoa cada) | cerca de 17              | Convocados, folha "Convocar para Bateria" (uma por função)                   | 3 toques por função, mais o trajeto. Total de montar o sábado: **cerca de 29 toques**, 2 esperas de 10 s                                                     |
| Ver o repertório (administrador que não toca)         | 6 pelo menu, 2 se souber | Comunidade, Louvor, Meu repertório (vazio), Agenda, Encontro, Repertório     | A porta "Louvor" abre um menu cuja 1ª linha é vazia para quem não toca. O caminho de 2 toques (cartão do Início, depois rolar o Resumo) não tem sinal nenhum |
| Lembrar quem não respondeu                            | 1 (mais 10 s)            | Início                                                                       | Bom. Existe em 3 lugares (Início, barra do encontro, aba Convocados)                                                                                         |
| Publicar o rascunho                                   | 1 (mais 10 s)            | Início                                                                       | Bom                                                                                                                                                          |

**Conceitos que o administrador encontra nesse caminho: 25.** Encontro, roteiro, etapa, Resumo, Convocados (aba), convocar, convocação, função (de 3 espécies: "Quem conduz/Quem ajuda/Outra função", "Função na banda" e "Sua parte"), "Onde" (Encontro inteiro ou etapa), banda, louvor, repertório, Meu repertório, rascunho, publicar, avisar a banda, lembrar, aguardando, pediu troca, modelo, Sábado padrão, Igual ao último sábado, inscrição, Preparação.

O líder pensa em **três** coisas: "o sábado", "quem vai" e "fazendo o quê".

### 1.2 Os 10 maiores pontos de confusão

| #   | O que acontece                                                                                                                                                                                                                                                                                                                                    | Modelo do líder x modelo do app                                                                                                                                        | Onde                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | **Convocar começa por "Onde"** (Encontro inteiro, Boas-vindas, Louvor...) antes de "quem" e "fazendo o quê". A mesma pessoa vive em dois grupos da tela.                                                                                                                                                                                          | Líder: "o Bruno vai tocar violão no sábado". App: o Bruno é uma linha por etapa. Ordem das perguntas invertida.                                                        | `Convocacao.tsx` (pílulas "Onde"), `SecaoEquipe.tsx` (grupos por etapa)                                |
| 2   | **"Já convocado" trava a pessoa e não dá saída.** Quem foi chamado para o encontro inteiro aparece cinza ao tentar chamar para a banda.                                                                                                                                                                                                           | Líder: "chamei para o sábado, agora quero que toque bateria". App: trava por grupo (etapa), a API trava por função. Duas regras que discordam. Ver o parágrafo abaixo. | `Convocacao.tsx` linhas 191 a 195 e 256 a 262; `montar-encontro.ts` linha 456                          |
| 3   | **A banda é outro fluxo.** A função da banda só aparece com a pílula "Louvor" escolhida, e no "Convocar pessoas" geral a pílula "Louvor" está **cortada na borda** ("Lou..."), parece não existir (captura 34).                                                                                                                                   | Líder: banda é gente do sábado. App: tem tela, lista de funções e botão "Avisar a banda" próprios.                                                                     | `Convocacao.tsx`, `SecaoEquipe.tsx` (`GrupoDoLouvor`)                                                  |
| 4   | **Quatro vocabulários para "o que a pessoa faz":** "Quem conduz/Quem ajuda/Outra função", as 9 funções da banda, "Coordenação" (texto livre) e "Sua parte".                                                                                                                                                                                       | Líder: "ela cuida da recepção". App pede para classificar em conduz ou ajuda antes de dizer recepção.                                                                  | `Convocacao.tsx` (`Segmentos`)                                                                         |
| 5   | **O repertório não tem porta.** "Louvor" mora em Comunidade, Mais, rolando; só aparece para quem toca ou organiza; a 1ª linha é "Meu repertório", vazia para quem não toca ("Você não está no louvor deste encontro", captura 80b). A lista de verdade está dentro do Resumo, abaixo da dobra. No Início, "Louvor: 3 músicas" é texto, não toque. | Líder: "cadê as músicas do sábado?". App: o repertório pertence a um papel (músico), não ao sábado. Decisão do dono: é de todos.                                       | `atalhosDoMural.ts` 40 a 43, `TelaLouvor.tsx`, `CartaoDoRepertorioNoEncontro.tsx`, `CartaoDoLider.tsx` |
| 6   | **A faixa de topo do Início contradiz o cartão.** "Sábado Jovem terminou. 0 presentes." fica em cima de "EM 6 DIAS, Sábado Jovem" (captura do Início do líder). Mesmo título, sem data, e "0 presentes" quando ninguém usou o check-in soa como fracasso.                                                                                         | Líder lê a faixa como sendo do cartão logo abaixo. App junta dois encontros (o de ontem e o próximo).                                                                  | `TelaInicio.tsx` 283 a 294 (`despedida`), `momento.ts` da API (`recemTerminado`)                       |
| 7   | **Quatro verbos para pôr o sábado de pé:** criar, convocar, publicar, avisar. Convocar em rascunho não avisa ninguém; publicar avisa; "Avisar a banda" é outro aviso.                                                                                                                                                                             | Líder: "marquei o sábado e chamei o pessoal". App: quatro ações, três avisos, um rascunho invisível ("Rascunhos (11)" na Agenda).                                      | `Convocacao.tsx` (`AVISO_DE_RASCUNHO`), `BotaoAvisarABanda.tsx`                                        |
| 8   | **Espera de 10 s com contagem em tudo que avisa** (publicar, lembrar, chamar, avisar a banda). "Convocar 2 pessoas" fecha a folha e mostra as duas como "aguardando" **antes** de o aviso sair: o estado mente por 10 s.                                                                                                                          | Líder com pressa: "toquei, foi?". App: "daqui a 10 s eu mando, se você não desistir".                                                                                  | `Convocacao.tsx` 241 a 245, `SecaoEquipe.tsx` (`emEspera`), `CartaoDoLider.tsx`                        |
| 9   | **O mesmo assunto em três abas e dois menus.** "Quem falta" aparece no Início, no Resumo (texto), em Convocados (cartão) e na barra de baixo ("Lembrar os 4" mais "Mais").                                                                                                                                                                        | Líder: "onde eu resolvo?". App: em todo lugar um pouco, sem um lugar certo.                                                                                            | `DetalheDoEvento.tsx`, `ResumoDoEncontro.tsx`, `BarraDoEvento.tsx`                                     |
| 10  | **Quatro maneiras de começar um encontro** ("Igual ao último", "Sábado padrão", "A partir de um modelo", "Em branco") e a mais comum (primeiro sábado) cai em formulário vazio com data e hora em seletores.                                                                                                                                      | Líder: "é o sábado de sempre". App: pergunta o que ele quer copiar, de onde, com que modelo.                                                                           | folha "Novo encontro" (captura 25), `TelaNovoEvento.tsx`                                               |

**Sobre o item 2 (lido no código, não reproduzido).** O banco permite a mesma pessoa em várias funções: o índice `atribuicoes_unica` é `(evento, etapa, pessoa, função)` e cada linha tem o seu próprio estado. O travamento é só de interface: `jaNoGrupo` bloqueia **qualquer pessoa que já tenha linha na mesma etapa**, seja qual for a função, e a API acrescenta quem já tem a **mesma função em qualquer etapa**. Pelo "Convocar pessoas" geral (que abre em "Encontro inteiro"), quem foi chamado como "Quem ajuda" fica travado para tudo ali. É a explicação mais provável do "já foi convocado" que o dono viu. **Não precisa de migração**, só de trocar a regra para (pessoa + função).

### 1.3 O que reprova hoje no teste do vovô

| Critério          | O que o código e as capturas mostram                                                                                                                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Letra           | `lista` 14, `legenda` 14, `meta` e `rotulo` 15, `chip` 13, `sobrancelha` 13 (os estados "Aguardando" e "Aceitou" são chips de 13 pt)                                                                                                                                  |
| 2 Fonte 200%      | Quase todo papel tem **teto** de escala menor que 2: `display` 1,6, `chip` 1,6, `sobrancelha` 1,6, pílula da comunidade 1,3, Modo palco 1,3. O texto para de crescer antes dos 200% e o layout não foi testado ali. As pílulas de filtro já cortam em 100% ("Lou...") |
| 3 Alvos           | Mínimo de 44 pt no iOS e 48 no Android; botão `compacto` tem 40 pt visíveis (48 só com folga de toque); chips e pílulas de 24 a 32 pt                                                                                                                                 |
| 7 Escondido       | Voltar, fechar, compartilhar e sino são **só ícone**; "Mais" e "Mais opções" em 75 pontos do código (28 arquivos), inclusive na barra do encontro e em cada música; pressionar e segurar e deslizar para aceitar estão no desenho (5.4 e 5.7 do UX)                   |
| 10 Desfazer       | 10 s com contagem (20 s só com leitor de tela). Para mãos lentas e vista cansada é curto                                                                                                                                                                              |
| 6 Palavras        | Convocar, convocação, etapa, Roteiro, "Função na banda", "Preparação", "Tom −", "aguardando"                                                                                                                                                                          |
| 5 Poucas escolhas | A folha "Convocar" mostra 3 grupos de escolha antes da lista de pessoas ("Onde", função, busca) e o Início do líder tem 8 linhas e 2 botões                                                                                                                           |

---

## 2. Modelo mental único: "Quem vai"

**O líder pensa:** "quem vai no sábado, e fazendo o quê". A tela do app é uma lista exatamente assim. Nada de "onde", nada de "convocar de novo para a banda".

### 2.1 As regras do modelo

1. **Uma lista por encontro:** pessoa, o que vai fazer, e se respondeu. A banda é uma **seção** da mesma lista, agrupada por instrumento.
2. **Uma pessoa pode ter mais de um papel** (Carla: Vocal e Violão). Ela aparece uma vez por seção em que tem papel, com os papéis dela naquela seção.
3. **Adicionar pessoa = nome, papel, pronto.** O app descobre sozinho onde o papel mora (função da banda vai para o Louvor; as outras, para o encontro). O líder nunca escolhe "Onde".
4. **O estado está na mesma linha:** "Vai", "Falta responder", "Não pode ir", "Pediu para trocar". Palavra e ícone, nunca só cor.
5. **"Falta: bateria" e "Lembrar as 4 pessoas" na mesma tela**, no alto, cada um com o seu botão.
6. **Não existe "já convocado" como bloqueio.** Se a pessoa já faz aquilo, a linha mostra "Já vai de violão" e abre para mudar ou tirar. Nunca fica cinza e muda.
7. **Quem chama avisa com um toque explícito e sem relógio** (seção 2.4).

### 2.2 A tela "Quem vai" (aba do Encontro, antes "Convocados")

```
+--------------------------------------+
| < Voltar              Sábado Jovem   |  "Voltar" com a palavra
| Quem vai no sábado, 28 de novembro   |
|                                      |
| 6 de 10 já responderam               |
| Faltam responder: Júlia, Bruno,      |
| Diana e Larissa                      |
| [ Lembrar as 4 pessoas ]             |  só se houver quem lembrar
|                                      |
| Falta alguém na projeção             |
| [ Escolher quem opera a projeção ]   |  só se houver "Falta"
|                                      |
| LOUVOR                               |  a banda é uma seção da lista
| Vocal                                |
|   Carla Menezes     Vai              |
|   Letícia Barros    Vai              |
| Violão                               |
|   Mateus Pereira    Vai              |
| Projeção                             |
|   Thiago Azevedo    Pediu para trocar|
| Bateria                              |
|   Ninguém ainda  [ Escolher ]        |
|                                      |
| EQUIPE                               |
| Coordenação                          |
|   Bruno Tavares     Falta responder  |
| Recepção                             |
|   Beatriz Moraes    Falta responder  |
|                                      |
+--------------------------------------+
| [ + Chamar alguém ]                  |  UMA ação principal, fixa embaixo
+--------------------------------------+
```

- Cada linha de pessoa é um botão inteiro (alvo de 56 pt) com seta e o texto "Mudar ou tirar" na descrição da primeira linha de cada seção.
- Carla com dois papéis aparece assim em "Louvor": `Carla Menezes: Vocal, Violão  Vai`. Se ela também ajuda na recepção, aparece de novo em "Equipe" só com "Recepção".
- Quem é de mais de uma função da banda aparece nas duas linhas de instrumento, com o mesmo estado.

### 2.3 Chamar alguém (folha, 2 passos, sem "Onde")

```
Passo 1: Quem?                         Passo 2: Fazendo o quê?
+----------------------------------+   +----------------------------------+
| Chamar alguém               [Fechar]|  | O que o Bruno vai fazer?         |
| [ Buscar pelo nome ]             |   |                                  |
| Costumam ajudar na bateria       |   | Louvor                           |
|   Davi Monteiro   serviu 3 vezes |   |  [ ] Vocal      [ ] Violão       |
|   Ana Ribeiro     pode neste dia |   |  [ ] Guitarra   [x] Bateria      |
| Todas as pessoas (15)            |   |  [ ] Teclado    [ ] Baixo        |
|   Ana Ribeiro                    |   | Equipe                           |
|   Beatriz Moraes                 |   |  [ ] Recepção   [ ] Conduzir     |
|   Bruno Tavares   Já vai de      |   |  [ ] Ajudar     [ ] Outra...     |
|                   coordenação    |   |                                  |
+----------------------------------+   | [ Pronto: chamar o Bruno ]       |
                                       +----------------------------------+
```

- **Entrando por "Falta: bateria"** o passo 2 já vem pronto: só o passo 1 ("quem?") aparece, e tocar no nome chama. São 3 toques (botão da falta, nome, "Chamar o Davi").
- Entrando por "Chamar alguém": nome, marcar o que vai fazer (pode marcar vários), "Pronto". São 4 toques.
- "Costumam ajudar" usa o endpoint de sugestões que já existe (`sugestoes-de-convocacao`), sem mudança.
- Papéis em duas listas curtas (no máximo 6 à vista por grupo; "Outra..." abre um campo com rótulo visível).
- Vários nomes de uma vez continua possível: marcar mais de um no passo 1 e usar o mesmo papel para todos.
- **Resultado:** "Pronto. Bruno foi chamado para a bateria." A linha aparece na hora em "Falta responder" (só depois de o aviso ter saído de fato, ver 2.4).

### 2.4 Avisar sem relógio

Hoje todo aviso espera 10 s com contagem. Para o vovô e para quem está com pressa isso falha (critério 10). A segurança passa a vir **antes** do toque, não de um relógio:

- A folha mostra **quem será avisado** e o botão diz o número: "Chamar o Bruno", "Publicar e avisar 9 pessoas".
- Ao tocar, o aviso sai e a tela diz: "Pronto. 9 pessoas foram avisadas." Sem contagem.
- O que **não** avisa ninguém (tirar uma pessoa do rascunho, tirar uma música) segue com Desfazer, agora **parado na tela** até a pessoa fazer outra coisa, sem contagem.
- Quem chama pessoas em rascunho vê "Salvo. Ninguém foi avisado ainda. Quem vai receber ao publicar: 9 pessoas."

Como fazer **sem mudar a API** (Onda 2): a seleção fica no aparelho (guardada, para não se perder ao fechar o app) até o toque em "Chamar". Como fazer **com mais robustez** (Onda 3): coluna `avisada_em` e aviso separado do ato de gravar. Ver seção 6.

### 2.5 O que sai das telas atuais

| Sai                                                                                                         | Vai para                                                                                          |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Pílulas "Onde" (Encontro inteiro, Boas-vindas, Louvor...)                                                   | O app descobre pelo papel (função da banda vai para o Louvor, o resto para o encontro)            |
| `Segmentos` "Quem conduz / Quem ajuda / Outra função" e "Função na banda"                                   | Uma lista só de papéis (2.3). "Conduz" e "Ajuda" ficam como papéis comuns, não como tipos         |
| Textos "Já convocado" e "Avisou que não pode neste dia" como bloqueio                                       | "Já vai de violão" (abre para mudar) e "Avisou que não pode neste dia" como **aviso**, sem travar |
| Um botão "Convocar" por grupo (3 a 5 por tela), "Convocar" por instrumento vazio, "Convocar pessoas" no fim | Um só "Chamar alguém" fixo embaixo e "Escolher" nas faltas                                        |
| "Avisar a banda" dentro de Convocados (`GrupoDoLouvor`)                                                     | Fica **só** na tela do Louvor, com o texto "Avisar que as músicas mudaram"                        |
| Menu de pessoa com diálogo "Tirar X da convocação?"                                                         | Folha da pessoa com "Mudar o que faz" e "Tirar do sábado", e Desfazer parado na tela              |
| "Lembrar" na barra do encontro e no Resumo em texto corrido                                                 | Fica no Início e em "Quem vai". O Resumo só mostra a linha "Quem vai: 6 de 10 responderam"        |
| Aba "Convocados"                                                                                            | Aba "Quem vai"                                                                                    |

### 2.6 O modelo de dados aguenta?

**Sim, sem migração.** `uj.atribuicoes` tem uma linha por (evento, etapa, pessoa, função), com estado próprio. Uma pessoa com dois papéis são duas linhas, e o índice único já permite. O que falta é só app:

| Precisa de                                       | Mudança                                                                                                                                                                       |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chamar uma pessoa com 2 papéis                   | App: duas chamadas ao `POST .../atribuicoes/lote` (uma por função). Melhor (Onda 3): a API aceitar `papeis: [{funcao, etapaId}]` numa transação                               |
| Decidir a etapa sozinho                          | App: função da banda mais etapa do Louvor (se existir), senão `etapaId: null`. `ehConvocacaoDeLouvor` já trata função de banda sem etapa como louvor                          |
| A pessoa aceitar uma vez só                      | Hoje cada linha responde sozinha (`POST .../atribuicoes/:id/confirmar`). Onda 3: "Aceitar" responde todas as linhas pendentes dela no encontro (app em laço, ou rota em lote) |
| Um aviso só por pessoa quando ela ganha 2 papéis | **Verificar** se o gatilho de aviso (0011 e 0023) agrupa; se não, a pessoa recebe dois avisos. Risco da Onda 3                                                                |

---

## 3. Caminho ideal

### 3.1 O sábado do líder em no máximo 4 toques

| Situação                                             | Toques | Caminho                                                                                                                                                                                                      |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| O sábado de sempre (equipe e banda iguais ao último) | **2**  | Início: `Marcar o próximo sábado`, depois `Publicar e avisar 9 pessoas`. A tela do meio mostra o que vai junto (roteiro, equipe, banda) e quem não pode                                                      |
| O mesmo, trocando uma pessoa                         | **4**  | `Marcar o próximo sábado`, `Trocar` na linha do Bruno, tocar o nome do Davi (a função já vem), `Publicar e avisar 9 pessoas`                                                                                 |
| Primeiro sábado da comunidade (sem anterior)         | **3**  | `Marcar o próximo sábado` abre já com Sábado Jovem, próximo sábado, 16:00 (do modelo) e local "A definir"; `Salvar e escolher quem vai`; depois `Chamar alguém`. Equipe se monta depois, 4 toques por pessoa |
| Banda incompleta no meio da semana                   | **3**  | Início: `Escolher quem opera a projeção`, tocar o nome, `Chamar o Thiago`                                                                                                                                    |

Hoje: 2 só no estado "Terminou ou Nada marcado"; 10 no primeiro sábado; cerca de 29 para equipe mais banda. **Regra:** "Marcar o próximo sábado" aparece **sempre** que não há encontro futuro, em qualquer dia, não só em 24 h depois.

### 3.2 Domingo à noite montando a semana

O Início do líder tem **uma próxima ação**, e depois de feita ela troca para a seguinte. O líder vai apertando o botão grande até o cartão dizer "Tudo certo".

```
Domingo 20h        Início: [ Marcar o próximo sábado ]                  (toque 1, depois publicar: 2)
Segunda de manhã   Início: [ Lembrar as 4 pessoas ]                     (toque 1)
Segunda à noite    Início: [ Escolher quem opera a projeção ]           (3 toques)
Terça              Início: [ Montar o repertório ]  -> Adicionar 4 músicas  (cerca de 7 toques, 4 são as músicas)
Sexta              Início: "Tudo certo para sábado."  [ Ver quem vai ]
```

Ordem de prioridade da ação (a primeira que for verdade vence):

1. Não há encontro futuro: **Marcar o próximo sábado**
2. É rascunho: **Publicar e avisar N pessoas**
3. Falta gente responder: **Lembrar as N pessoas**
4. Falta uma função da banda: **Escolher quem opera a projeção**
5. O repertório está vazio: **Montar o repertório**
6. Véspera e dia: **Ver quem vai** e, a partir de 2 h antes, **Fazer check-in**
7. Acontecendo: **Conduzir ao vivo**
8. Terminou: **Marcar o próximo sábado**

### 3.3 O Início do líder: uma ação, uma frase do que falta

```
+--------------------------------------+
| (JE) Jovens Esperança          Avisos|  sino com a palavra
| Bom dia, Ana                         |
|                                      |
| SÁBADO QUE VEM · EM 6 DIAS           |
| Sábado Jovem                         |
| Sábado, 28 de novembro, 16:00        |
| Salão da igreja                      |
|                                      |
| Faltam 4 pessoas responderem.        |  no máximo 2 frases do que falta
| Falta alguém na projeção.            |
|                                      |
| [ Lembrar as 4 pessoas ]             |  o único botão do cartão
| Ver quem vai   Ver o louvor          |  dois links de texto, 48 pt cada
+--------------------------------------+
| Aviso fixado: Ensaio às 15h        > |
+--------------------------------------+
```

- **Some:** a barra de progresso com "6/10", a lista de nomes no cartão (vai para "Quem vai"), o segundo botão cheio, "Louvor: 3 músicas" como texto solto e **a faixa de despedida**.
- **A faixa** "Sábado Jovem terminou. 0 presentes." só existe quando **não há** próximo encontro (aí é o cartão "Terminou"). Com próximo encontro no cartão, ela some: o resultado do sábado passado vira uma linha no Resumo do encontro passado. "0 presentes" nunca aparece se ninguém fez check-in; aparece "Check-in não foi feito".
- "Seu resumo" continua dobrado, com a palavra "Pendências" no lugar de "3 coisas esperando você" quando houver número.

### 3.4 Repertório: onde o líder monta e onde todos veem

**Uma tela só, para todos:** "Louvor do sábado" é a tela `/evento/[id]/repertorio` de hoje (já tem a banda e a lista), sem a camada de menu de `TelaLouvor`.

```
+--------------------------------------+
| < Voltar     Louvor de sábado, 28/11 |
| Sábado Jovem                         |
|                                      |
| BANDA                                |
|  Vocal: Carla, Letícia               |
|  Violão: Mateus                      |
|  Falta: bateria                      |  todos veem; o líder tem "Escolher"
|                                      |
| MÚSICAS                              |
|  1  Canção de abertura   Tom G       |  todos tocam para abrir a cifra
|  2  Canção de encerramento Tom E     |
|                                      |
| Você toca violão: [ Abrir as minhas cifras ] |  só para quem toca
+--------------------------------------+
| Líder:  [ Adicionar músicas ]        |  UMA ação para quem organiza
+--------------------------------------+
```

- **Quem vê:** todos da comunidade (decisão do dono). Quem organiza vê, a mais, "Adicionar músicas" e, em cada música, **botões com palavra visível** ("Subir", "Descer", "Tom", "Tirar"), nunca o "Mais".
- **De onde se chega (todos):** Comunidade, linha "Louvor: banda e músicas do sábado", que abre direto nesta tela (para o próximo encontro, sem menu). O Encontro também tem a linha. O Início do líder tem "Ver o louvor".
- **"Meu repertório"** passa a ser o botão "Abrir as minhas cifras" desta tela, só para quem toca. O administrador que não toca nunca mais cai num "Você não está no louvor".
- Biblioteca de músicas e Músicos saem do "Louvor" e ficam só na Biblioteca.
- **Sem encontro marcado:** "Ainda não há encontro marcado. Quando houver, as músicas e a banda aparecem aqui." (líder: botão "Marcar o próximo sábado").

---

## 4. Linguagem

### 4.1 Termos finais e os que somem

| Hoje                                                         | Final                                                       | Observação                                                                                     |
| ------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Convocar, convocado, convocação                              | **Chamar**, "chamado", "foi chamada"                        | **Pede revisão da D54** (palavra do dono). Texto dos avisos do servidor (8.3 do UX) muda junto |
| Aba "Convocados"                                             | **Quem vai**                                                |                                                                                                |
| Etapa (do roteiro)                                           | **Item do roteiro** ("Louvor, 16:05")                       | A palavra "etapa" sai da tela. O código segue `etapa`                                          |
| "Onde: Encontro inteiro, Boas-vindas..."                     | (some)                                                      | O app descobre                                                                                 |
| "Quem conduz / Quem ajuda / Outra função", "Função na banda" | **O que vai fazer** (lista única de papéis)                 |                                                                                                |
| Aguardando / Aceitou / Pediu troca / Não pode ir             | **Falta responder / Vai / Pediu para trocar / Não pode ir** |                                                                                                |
| Avisar a banda                                               | **Avisar que as músicas mudaram**                           | Só na tela do Louvor                                                                           |
| Sua parte                                                    | **Você vai fazer:** ("Você vai tocar violão")               | Frase com verbo, não etiqueta                                                                  |
| Repertório do louvor, Meu repertório, Louvor (3 telas)       | **Louvor do sábado** (uma tela) e "Minhas cifras"           |                                                                                                |
| Preparação                                                   | **Lista de tarefas** (dobrada, só quando existe tarefa)     |                                                                                                |
| Modelo, Sábado padrão, "A partir de um modelo", Em branco    | **Igual ao último sábado** e **Do zero**                    | "A partir de um modelo" só aparece quando a comunidade tem modelo próprio                      |
| Tom −, Tom +                                                 | **Descer o tom**, **Subir o tom**                           |                                                                                                |
| Rascunho                                                     | **Rascunho (ninguém foi avisado)**                          | Sempre com o parêntese                                                                         |
| Mais, Mais opções, Mais ações                                | (some, ver 4.3)                                             |                                                                                                |

### 4.2 Botões com verbo e consequência

| Onde                         | Texto                                                   |
| ---------------------------- | ------------------------------------------------------- |
| Início, sem encontro         | `Marcar o próximo sábado`                               |
| Início, rascunho             | `Publicar e avisar 9 pessoas`                           |
| Início e Quem vai            | `Lembrar as 4 pessoas`                                  |
| Quem vai, fixo embaixo       | `Chamar alguém`                                         |
| Folha, passo 2               | `Chamar o Bruno` (um nome) ou `Chamar 3 pessoas`        |
| Falta de função              | `Escolher quem opera a projeção`                        |
| Louvor, líder                | `Adicionar músicas`; `Avisar que as músicas mudaram`    |
| Louvor, quem toca            | `Abrir as minhas cifras`                                |
| Voltar, fechar, compartilhar | `Voltar`, `Fechar`, `Compartilhar` (ícone mais palavra) |

### 4.3 Mensagens de sucesso, erro e vazio

| Situação                     | Texto                                                                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chamou uma pessoa            | `Pronto. Bruno foi chamado para a bateria.`                                                                                                               |
| Chamou várias                | `Pronto. 3 pessoas foram chamadas.`                                                                                                                       |
| Publicou                     | `Pronto. O encontro está marcado e 9 pessoas foram avisadas.`                                                                                             |
| Lembrou                      | `Pronto. Você lembrou Júlia, Bruno, Diana e Larissa às 10:12.`                                                                                            |
| Tirou alguém (não avisa)     | `Bruno saiu da lista.` com o botão `Desfazer` parado na tela                                                                                              |
| Falha ao chamar              | `Não deu para chamar o Bruno agora. Ninguém foi avisado. Toque em Tentar de novo.`                                                                        |
| Falha ao publicar            | `Não deu para marcar o encontro. Nada foi enviado. Toque em Tentar de novo.`                                                                              |
| Pessoa já faz aquilo         | (não é erro) linha com `Já vai de violão`; ao tocar: `O Bruno já vai de violão. Quer mudar ou tirar?`                                                     |
| Pessoa disse que não pode    | Aviso amarelo, sem travar: `O Bruno avisou que não pode neste dia. Chamar mesmo assim?`                                                                   |
| Sem internet                 | `Sem internet. Você vê a lista, mas só dá para avisar quando a internet voltar.`                                                                          |
| Vazio de "Quem vai" (líder)  | `Ainda não chamou ninguém.` / `Escolha quem vai no sábado e o que cada um faz.` + `Chamar alguém` + `Chamar o mesmo pessoal do último sábado (9 pessoas)` |
| Vazio de "Quem vai" (membro) | `A liderança ainda não escolheu quem vai. Quando escolher, aparece aqui.`                                                                                 |
| Vazio de Louvor (membro)     | `O louvor ainda não escolheu as músicas deste sábado. Quando escolher, elas aparecem aqui.`                                                               |
| Vazio de Louvor (líder)      | `Nenhuma música ainda. Escolha as músicas do sábado, na ordem em que serão tocadas.` + `Adicionar músicas`                                                |

### 4.4 O que fica dobrado no primeiro uso (sem esconder o que o líder usa toda semana)

**Usa toda semana, fica à vista:** Marcar o próximo sábado, Quem vai, Lembrar, Louvor (banda e músicas), Check-in no dia, Ao vivo.

**Aparece só quando existe, fica dobrado:** Inscrições (só se há inscrição aberta), Lista de tarefas, "A partir de um modelo" (só se há modelo próprio), Séries ("Repete toda semana"), Relatórios, Locais.

**O fim do "Mais" do encontro:** em vez do menu "Mais" (Editar, Copiar, Cancelar ou adiar, Baixar para usar sem internet, Compartilhar), o fim da aba Resumo ganha o título **"Outras coisas"** com essas linhas **sempre visíveis**, cada uma com texto. Cancelar vem por último, com a consequência escrita ("Todo mundo é avisado que o encontro foi cancelado").

---

## 5. Regras de facilidade para as próximas telas (checklist)

Marque os 12 antes de dar uma tela por pronta. Os itens 7 a 12 vêm do teste do vovô (seção 0).

1. **Uma ação principal por tela**, fixa embaixo ou no fim do cartão. No máximo 3 secundárias à vista, em texto, não em botão cheio.
2. **No máximo 6 opções em um grupo** e nenhuma rolagem horizontal de chips. Mais que 6: busca ou uma segunda tela.
3. **Nunca dois caminhos para a mesma coisa.** Se "Lembrar" está no Início e em "Quem vai", é o mesmo botão, com o mesmo texto e o mesmo resultado, e só nesses dois lugares.
4. **Fale de quem vai e do que faz**, não do módulo. A pergunta da tela cabe em 6 palavras ("Quem vai no sábado?").
5. **Desfazer em vez de confirmar, e sem relógio.** Ação que avisa gente: mostrar antes quem será avisado e dizer o número no botão. Ação que não avisa: Desfazer parado na tela até a pessoa fazer outra coisa.
6. **Nada de estado bloqueado sem saída.** Item que não dá para escolher mostra o motivo **e** o que fazer ("Já vai de violão. Mudar ou tirar").
7. **Letra de 16 pt ou mais** em tudo que informa; a tela inteira funciona com a fonte do sistema a 200% (nenhum teto de escala abaixo de 2 em texto que informa; botões empilham, não cortam).
8. **Alvo de 48 pt ou mais e 8 pt de respiro** entre dois alvos. A linha inteira é o botão.
9. **Ícone sempre com palavra** (voltar, fechar, compartilhar, avisos). Nada essencial em gesto, em "Mais" ou em pressionar e segurar. Deslizar pode existir, só como atalho extra.
10. **Palavras comuns:** "chamar", "quem vai", "o que vai fazer". Nada de etapa, atribuição, bloco, convocação, escala.
11. **Diga o que aconteceu, com nome**, em frase completa ("Pronto. Bruno foi chamado para a bateria"). Erro diz o que fazer e o que **não** aconteceu ("Ninguém foi avisado").
12. **Nunca perca o que a pessoa fez** (seleção, texto) ao errar, voltar ou fechar; botão "Voltar" com a palavra e o título dizendo onde se está. Teste final: uma pessoa de 60 anos ou mais faz a tarefa sem ajuda (seção 6.6).

---

## 6. Plano de implementação em ondas pequenas

As ondas 1 e 2 **só mexem no app** (nenhuma API, nenhuma migração). Cada critério de aceite abaixo é um teste automático (Jest ou RNTL do projeto) ou uma captura.

### 6.1 Onda 1: pontas que machucam (hoje, cerca de 1 dia, risco baixo)

| #   | Mudança                                                                                                                                                                                              | Arquivos                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1a  | **Destravar "Já convocado":** travar por (pessoa + função), não por grupo; texto `Já vai de violão`, linha abre para mudar. Reproduzir antes o que o dono viu                                        | `eventos/Convocacao.tsx` (`jaNoGrupo`, `linhaDaPessoa`), `eventos/__tests__/Convocar.test.tsx`          |
| 1b  | **Tirar a faixa que contradiz o cartão:** `despedida` só quando não há próximo encontro no cartão; nunca "0 presentes" sem check-in                                                                  | `inicio/TelaInicio.tsx` 283 a 294, `inicio/__tests__/TelaInicio.test.tsx`                               |
| 1c  | **"Louvor: 3 músicas" vira toque** ("Ver o louvor"; com 0, "Montar o repertório")                                                                                                                    | `inicio/CartaoDoLider.tsx`                                                                              |
| 1d  | **Louvor para todos:** `veOLouvor` verdadeiro; 1ª linha da `TelaLouvor` leva ao repertório do próximo encontro para quem não toca; o vazio do "Meu repertório" ganha a ação "Ver o louvor do sábado" | `comunidade/atalhosDoMural.ts` 40 a 43, `repertorio/TelaLouvor.tsx`, `repertorio/TelaMeuRepertorio.tsx` |
| 1e  | **Pílulas "Onde" sem corte:** quebrar linha em vez de rolar para o lado (até a Onda 2 tirá-las)                                                                                                      | `eventos/Convocacao.tsx` (`PilulasDeFiltro`)                                                            |

**Risco:** baixo. 1d muda a regra da D62 (decisão já tomada pelo dono: registrar como D73 em `docs/DECISOES.md`). Verificar que `etapa.ler` (membro) basta para a lista e que o encontro traz as atribuições para o membro (a página do membro já mostra "Quem serve").

**Aceite:**

- Teste: pessoa já em "Recepção" no encontro inteiro **pode** ser marcada para "Bateria" na mesma folha; a mesma função repetida mostra "Já vai de bateria" e abre para mudar.
- Teste: com `recemTerminado` e `evento` futuro, não existe o `testID` `linha-de-despedida` para organização.
- Teste: administrador **sem parte** vê "Louvor" na Comunidade e chega à lista de músicas e à banda em **2 toques** a partir dela; membro comum também.
- Captura: pílulas da folha "Convocar" sem "Lou..." cortado a 390 e 375.

### 6.2 Onda 2: a tela "Quem vai" (esta semana, 3 a 4 dias, só app)

| Mudança                                                                                                                                                                    | Arquivos                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Aba "Convocados" vira **Quem vai** (2ª aba, antes de Roteiro); lista com banda como seção, papéis por pessoa, estado na linha, "Falta" e "Lembrar" no alto                 | `eventos/DetalheDoEvento.tsx`, `eventos/SecaoEquipe.tsx` (vira `QuemVai.tsx`), `repertorio/BandaDoEncontro.tsx` (leitura para todos) |
| `FolhaDeConvocar` vira `FolhaChamarAlguem`: passo 1 nome (com "Costumam ajudar"), passo 2 papéis com marcação múltipla; etapa inferida; N chamadas ao lote, uma por função | `eventos/Convocacao.tsx`, `eventos/convocadosOtimistas.ts`                                                                           |
| Tirar pessoa sem diálogo, com Desfazer parado; sai "Avisar a banda" de dentro de Convocados                                                                                | `eventos/Convocacao.tsx` (`MenuDaPessoaConvocada`), `eventos/SecaoEquipe.tsx`, `ui/ToastComDesfazer.tsx`                             |
| Resumo: a linha "Convocados" vira "Quem vai: 6 de 10 responderam"; o fim do Resumo ganha "Outras coisas" no lugar do botão "Mais"                                          | `eventos/ResumoDoEncontro.tsx`, `eventos/BarraDoEvento.tsx`                                                                          |
| Início do líder: um botão, a ordem de prioridade da seção 3.2, dois links de texto                                                                                         | `inicio/CartaoDoLider.tsx`, `inicio/momento.ts` (`acoesDoLider`)                                                                     |
| Repertório do encontro vira "Louvor do sábado" (tela única), com botões com palavra no lugar de "Mais"; Comunidade abre direto nele                                        | `repertorio/TelaRepertorioDoEncontro.tsx`, `repertorio/TelaLouvor.tsx` (vira redirecionamento), `comunidade/atalhosDoMural.ts`       |

**Riscos:** (1) encontro **sem item de Louvor**: função da banda fica com `etapaId: null` (o domínio já lê isso como louvor), testar; (2) função antiga `responsável`/`integrante` precisa aparecer como "Conduz" e "Ajuda" nas linhas; (3) a pessoa com 2 papéis ainda aceita **duas vezes** até a Onda 3; (4) chamadas em sequência podem falhar pela metade: tratar e dizer qual entrou ("O violão entrou. A bateria não: toque em Tentar de novo"); (5) remover o relógio de 10 s exige trocar os testes de espera.

**Aceite:**

- RNTL: "Chamar alguém, Bruno, marcar Violão e Vocal, Chamar o Bruno" faz **duas** chamadas ao lote (uma por função) e a linha mostra "Bruno: Vocal, Violão".
- RNTL: a string `Já convocado` e a pílula `Onde` **não existem** mais na tela.
- Contagem de toques por teste de fluxo: "Falta: bateria" até a pessoa chamada em **3**; "Chamar alguém" até a pessoa chamada em **4**.
- Captura a 390 e 375: tela "Quem vai" com a banda como seção, **sem** cortar na borda.
- Uma ação principal: no máximo 1 botão cheio por tela (Quem vai, Início do líder, Louvor).

### 6.3 Onda 3: aviso explícito, papéis em lote e linguagem (semana que vem, exige API pequena)

| Mudança                                                                                                                   | Exige                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST .../atribuicoes/lote` aceita `papeis: [{funcao, etapaId}]` numa transação (uma pessoa, vários papéis, tudo ou nada) | **API** (`montar-encontro.ts`), sem migração, teste de isolamento da rota (regra 8 do CLAUDE.md)                                                         |
| "Aceitar" responde **todas** as linhas pendentes da pessoa no encontro                                                    | App em laço **ou** rota nova em lote; sem migração                                                                                                       |
| Aviso explícito sem relógio, persistente, e um só aviso quando a pessoa ganha 2 papéis                                    | Opcional e mais robusto: coluna `atribuicoes.avisada_em`, gatilho de aviso separado do gravar (**migração** nova). Verificar antes o gatilho 0011 e 0023 |
| Vocabulário "chamar" nas telas **e nos avisos do servidor** ("Nova convocação" vira "Você foi chamada para o louvor")     | **Decisão do dono** (revisa D54); textos de notificação no servidor                                                                                      |

**Aceite:** teste de API com uma pessoa e dois papéis (duas linhas, um aviso); RNTL "Aceitar" muda todas as linhas dela; nenhum Desfazer com contagem de 10 s em fluxo que avisa; varredura de texto não acha "convoc" em telas de usuário.

### 6.4 Onda 4: a passada do vovô (em paralelo às ondas 2 e 3, 2 dias)

| Mudança                                                                                                                                            | Arquivos                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Mínimo de 16 pt em `lista`, `legenda`, `meta`, `rotulo`; `chip` e `sobrancelha` para 14 no mínimo e **teto de escala 2** em todo texto que informa | `packages/tokens/src/index.ts` (`TIPO`), `ui/PilulaDaComunidade.tsx`, `ui/MarcasDeNovidade.tsx` |
| Alvos de 48 pt: `compacto` com 48 visíveis; 8 pt entre alvos                                                                                       | `ui/Botao.tsx`, `ui/BotoesDeOrdem.tsx`, `ui/PilulasDeFiltro.tsx`, `ui/Chip.tsx`                 |
| Ícone mais palavra: Voltar, Fechar, Compartilhar, Avisos (sino) e a seta do acordeão com texto                                                     | `ui/Tela.tsx`, `ui/FolhaNaTela.tsx`, `ui/Botao.tsx` (`BotaoIcone`), `ui/PilulaDaComunidade.tsx` |
| Cartão do Início com no máximo 2 frases do que falta e 1 botão cheio; abas com rótulo maior                                                        | `inicio/CartaoDoLider.tsx`, `inicio/CartaoDoMembro.tsx`, navegação das abas                     |
| Auditoria de captura sobe de "alvo abaixo de 40" para "alvo abaixo de 48" e passa a rodar com escala 2,0                                           | `scripts/apresentacao/capturas-v3.ts`                                                           |

**Risco:** alto impacto visual (todas as telas mudam de altura). Fazer por papel tipográfico e comparar capturas antes e depois; botões empilham a 200% em vez de cortar.

**Aceite:** relatório do `capturas-v3.ts` com **zero** alvo abaixo de 48 e zero texto vazando a 390 e 375 com escala 2,0 nas telas Início, Agenda, Encontro (as 3 abas), Chamar alguém e Louvor; nenhum `maxFontSizeMultiplier` abaixo de 2 em texto que informa (busca no código).

### 6.5 Ordem recomendada

Onda 1 hoje (a ponta que o dono tropeçou), Onda 2 e Onda 4 na semana, Onda 3 depois do teste com gente. As ondas 1 e 2 já tiram "já convocado", a faixa contraditória e o repertório sem porta.

### 6.6 Teste com pessoas (a prova que falta)

Cinco pessoas, **três com 60 anos ou mais**, 20 minutos cada, no celular delas, sem explicação. Três tarefas, com o que cada uma fez da última vez (não "você usaria?"):

1. "Marque o sábado que vem e chame o pessoal da banda." Passa se terminar em até 3 minutos sem ajuda.
2. "Veja quem ainda não respondeu e avise." Passa em até 1 minuto.
3. "Veja quais músicas vão no sábado." Passa em até 30 segundos, **sem ser do louvor**.

Anotar onde a pessoa hesita, toca o lugar errado ou lê em voz alta uma palavra que não entende. Cada palavra errada volta para a seção 4. Rodar de novo a Onda 4 com a fonte do celular dela no tamanho que ela já usa.

---

## Decisões que só o dono toma

1. **"Chamar" no lugar de "Convocar"** nas telas e nos avisos (revisa a D54).
2. **Tirar o Desfazer de 10 s** em tudo que avisa gente, trocando pelo "mostrar quem será avisado e enviar com um toque" (seção 2.4). É o que mais ajuda o idoso e quem está com pressa, mas retira uma proteção que o app tem hoje.
3. **Louvor, banda e músicas visíveis a toda a comunidade** (já decidido neste pedido: registrar como D73 e atualizar a D62).
4. **Mínimo de 16 pt em todo texto que informa** (Onda 4 mexe em todas as telas).
