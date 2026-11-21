# Auditoria de UX: simplicidade e acessibilidade do Uni Jovem

Data: 21/11/2026. Branch `release`, depois do commit `1a3dab4`, com o trabalho em andamento do Modo músico (D61) já na árvore.

Pedido do dono, depois de usar o app no iPhone: "não gostei da apresentação, o versículo do dia fechado ficou ruim, acho que o resumo é que deveria ser um acordeon fechado e expandido ao tocar. Todos os outros pontos foram avaliados, o app completo funciona, não está confuso para um ser humano? Pessoas são confusas, gostam das coisas simples; um app complexo demais afasta em vez de trazer pessoas."

## Como esta auditoria foi feita (e o que ficou de fora)

- **Evidência:**
  - a captura do iPhone do dono (Início atual, 402 x 874 pt, tema escuro);
  - as 25 capturas de `scripts/apresentacao/telas/` (tema escuro, comunidade fictícia, prévia web);
  - a leitura do código de cada tela citada;
  - os tokens de cor em `packages/tokens/src`;
  - a auditoria de 15/11/2026 e as decisões D54 a D61.
- **Não foi feito:** não rodei o app, o VoiceOver nem o TalkBack. O que digo sobre leitor de tela e fonte grande vem do código e está marcado "verificar no aparelho" quando depende de teste real.
- **Contraste:** calculei à mão com a fórmula WCAG 2.2 a partir dos valores hexadecimais dos tokens (erro de cerca de 0,1). Os pares que o projeto já declara e testa não foram refeitos um a um.
- **Capturas antigas:** `03-inicio` e `23-inicio-membro` são anteriores ao "Seu resumo" e ao "Louvor". Quando a captura e o código divergem, o código vale e eu digo.
- **Login e cadastro:** fora do escopo (outro grupo refaz a entrada). A relação com eles está nas seções 3a e 8.
- **Toques:** um toque é uma ação física (tocar, marcar, escolher). Digitar conta como "campo", à parte. Os números dos passeios são estimativas feitas pelo código, não medidas em aparelho.

---

## 1. Veredito

1. **Sim, o app está pesado para uma pessoa comum.** Não é uma tela ruim: é quantidade e ordem. Os fundamentos são bons (rótulo visível, desfazer, motivo do botão desabilitado). O que falta é subtrair.
2. **O Início é o pior caso.** Na captura do dono, o "Seu resumo" ocupa 447 pt de 871 (51% da tela) e 4 das 6 linhas mostram "0". O próximo encontro, o que 9 em cada 10 pessoas abrem o app para ver, começa a 688 pt e fica atrás da barra de abas: sobram 92 pt, só a data e o título.
3. **O versículo fechado ficou ruim por um motivo concreto:** gasta um cartão inteiro (83 pt, moldura, 18 de margem) para mostrar uma linha cujo único dado útil, "João 3:30", está em 13 pt e não diz nada sem o texto.
4. **Carga de decisões:** Início atual, 6 alvos tocáveis antes do encontro (versículo e 3 linhas do resumo, mais pílula e sino). Comunidade, cerca de 18 alvos para o líder e 10 para o membro. Perfil, 17 linhas. Novo encontro, 7 seções. Convocar uma pessoa, 4 escolhas por pessoa.
5. **Onde mais confunde, em ordem:** (1) Início; (2) o caminho do líder (montar o sábado e convocar 5 pessoas dá cerca de 26 toques); (3) Comunidade e Perfil, que mostram ferramentas de organização e de configuração para quem só quer ver o horário; (4) a folha de convocar ("Responsável / Integrante / Outra"); (5) oração anônima (7 toques e 3 blocos de texto técnico).
6. **A mesma convocação pendente aparece com 2 botões no Início e com 3 na aba Escalas** ("Aceitar", "Pedir substituição", "Não posso ir"). Quem tem 45 anos e pouca prática trava aí.
7. **A confusão de palavras que a auditoria de 15/11 apontou foi bem tratada** (Encontro, Roteiro, Repetição, Primeiros passos). O que sobrou é pontual: "Encontro todo", "Responsável/Integrante", "Aguardando resposta".
8. **Acessibilidade:** nenhum par de cor declarado falha. Os problemas reais são três: segmentos de 2 e 3 opções viram pílulas roláveis com fonte grande; informação útil em 13 e 12 pt; rótulo de botão desabilitado a 3,4:1.
9. **O que o Modo músico acrescenta:** mais um cartão no Início, mais uma linha na Comunidade, para todos. É a hora de cortá-lo para quem não toca (seção 6).
10. **Recomendação:** a Onda 1 (seção 9) é quase toda subtração e cabe em um dia ou dois. Depois, 3 pessoas reais por 15 minutos (seção 10) antes de qualquer outra mudança de estrutura.

---

## 2. Quem usa e como se perde

| Pessoa              | Quem é                                                                                  | O que quer em 10 segundos                                                          | Onde se perde hoje                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Lucas, 17**       | Jovem do grupo. Usa o app em pé, no ônibus, com uma mão. Não lê, varre.                 | "Que horas e onde é sábado?"                                                       | Passa pelo versículo e por um cartão de 6 linhas de números antes de achar o horário. Se não achar em 5 segundos, pergunta no WhatsApp e o app perde a razão de existir. |
| **Regina, 45**      | Voluntária (recepção ou louvor). Pouca prática em celular. Tem medo de "estragar" algo. | "Me chamaram? Eu confirmo aqui? Que horas é a minha parte?"                        | Vê "Convocações para responder 0" e "Convocações aceitas 0" e não sabe se está em dia. Na aba Escalas vê 3 botões para uma pergunta só. Letra pequena no meio do cartão. |
| **Daniel, 32**      | Líder de jovens. Monta tudo, chega às 14h.                                              | "Quem confirmou? Falta alguém? Publico o aviso?" e, na porta, "marco quem chegou". | 26 toques para montar o sábado e convocar a banda. O check-in é uma lista de 15 linhas iguais. As ferramentas dele aparecem misturadas com as de todo mundo.             |
| **Bia, 19**         | Visitante: recebeu um link no WhatsApp.                                                 | "Onde é? Que horas? Preciso fazer conta?"                                          | Tem 10 segundos de paciência. O que vem antes do conteúdo (conta, termos) decide se ela fica. Está ligada ao trabalho de entrada que outro grupo refaz.                  |
| **Seu Antônio, 68** | Baixa visão. Fonte no maior tamanho, VoiceOver às vezes.                                | Ouvir ou ver, em um só gesto: "Sábado, 16h, Salão da igreja. Você está no louvor." | Segmentos com 2 e 3 opções viram faixa rolável; linhas de resumo quebram em 5 linhas; aba sem texto; sino com 4 itens idênticos.                                         |

Regra que sai daqui: **cada pessoa tem uma pergunta, e a primeira tela deve respondê-la sem toque e sem rolagem.** Para o membro é "quando e onde". Para o líder é "o que falta resolver".

---

## 3. Passeios guiados nas 8 tarefas

Convenção: "hoje" é o código atual (não só as capturas). Palavras difíceis entre aspas.

### (a) Primeira abertura e entrar na comunidade com o código

- **Caminho hoje (conta nova, sem comunidade):** Início "Comece por aqui" (aviso dos termos, 3 cartões do mesmo tamanho, versículo) → "Usar código ou convite" → campo "Código ou link" (ou "Colar") → campo opcional "Mensagem para a liderança" → rolar → marcar a concordância → "Entrar na comunidade".
- **Por link (`entrar/<código>`):** tocar no link → (login, fora do escopo) → "Tenho um código" já preenchido → concordância → "Entrar".
- **Toques:** 4 (abrir a tela, colar, marcar, entrar), mais 1 rolagem e 1 campo. Por link: 3.
- **Decisões:** 3 (qual dos 3 cartões; escrever ou não a mensagem; concordar).
- **Palavras difíceis:** "convite", "liderança", "a comunidade aprova cada entrada".
- **Onde hesita:**
  - Os três cartões têm o mesmo peso. O de "Criar uma comunidade" aparece para um jovem de 17 anos que nunca vai criar nada.
  - O exemplo "ABCD 2345" dentro do campo tem a cor de um valor preenchido (captura 22).
  - O botão desabilitado e o motivo ("Sem essa concordância não conseguimos incluir você") aparecem, mas a caixa de concordância fica abaixo da dobra, escondida atrás da barra. A pessoa vê o motivo e não vê o que marcar.
  - A concordância do TC-03 (fé) já foi pedida no cadastro; aqui é pedida de novo (D51). **Coordenar com o grupo da entrada para pedir uma vez só.**
- **Caminho ideal (3 toques):** Comece por aqui com uma pergunta só ("Você recebeu um código?") e um botão grande "Tenho um código"; "Procurar minha comunidade" e "Criar uma comunidade" como links de texto abaixo. Na tela do código: campo, "Colar", a concordância logo acima do botão, e "Adicionar mensagem" como link (o campo só abre se tocar).

### (b) "O que eu preciso fazer neste sábado?" (membro)

- **Caminho hoje:** abrir o app → versículo (recolhido) → "Seu resumo" (6 linhas) → rolar → cartão do próximo encontro → rolar mais → "Você foi convocado".
- **Toques:** 0, mas 1 a 2 rolagens e a leitura de 6 blocos.
- **Decisões:** 0, só leitura; o custo é achar.
- **Palavras difíceis:** "Convocações para responder", "Convocações aceitas / Próximos encontros", "Inscrições em encontros".
- **Onde hesita:**
  - O cartão diz "Sábado · 16:00 · 1 h" e o título "Sábado". Não diz o dia do mês. Se o próximo encontro é daqui a 12 dias, ainda diz "Sábado".
  - Na captura 23, o cartão do próximo encontro é de 21/11 e o cartão "Você foi convocado" logo abaixo é de 28/11, os dois chamados "Sábado Jovem". Quem lê rápido junta os dois.
- **Caminho ideal (0 toques, 0 rolagens):** o cartão do próximo encontro logo depois da saudação, com "Sábado, 21 de nov. · 16:00 às 17:00", o local e a linha "Você: Louvor · Vocal (confirmado)".

### (c) Aceitar ou recusar uma convocação

- **Caminho hoje, aceitar:** Início → rolar até "Você foi convocado" → "Aceitar" → toast. **1 toque** (mais a rolagem). Com mais de uma pendente: "Ver todas (5)" → aba Escalas → "Aceitar" em cada cartão.
- **Caminho hoje, recusar:** "Não posso ir" → confirmação nativa → toast. **2 toques.**
- **Decisões:** no Início, 2 botões. Na aba Escalas, a mesma convocação pendente mostra **3** ("Aceitar", "Pedir substituição", "Não posso ir", capturas 24 e 03).
- **Palavras difíceis:** "Pedir substituição" ao lado de "Não posso ir": para uma convocação ainda não aceita, qual é a diferença? A pessoa não sabe, e tem medo de apertar o errado.
- **Onde hesita:** depois de aceitar, o cartão continua no Início (captura 03: "Você foi convocado / Aceitou / Pedir substituição"). Parece pendência, e já não é.
- **Caminho ideal:** pendente = 2 botões em todo lugar ("Aceitar", "Não posso ir"). "Pedir substituição" só depois de aceitar e como link discreto ("Preciso de alguém no meu lugar"). Aceita, a convocação vira a linha "Você: ..." dentro do cartão do próximo encontro e o cartão some.

### (d) Ver horário e local do próximo encontro

- **Caminho hoje:** Início → rolar → o cartão tem a hora e o local como pílula. O endereço e a referência ("Entrada lateral, ao lado da secretaria") só aparecem no encontro (1 toque, captura 06).
- **Toques:** 0 a 1, mais 1 rolagem. Pela Agenda: 3 toques (aba, o dia ou "Lista", o encontro).
- **Onde hesita:** a Agenda abre em Calendário e mostra 7 pontinhos. A informação está a um toque e uma rolagem de distância (captura 04).
- **Caminho ideal:** 0 toques, 0 rolagens, no Início. Endereço com um toque ("Como chegar", abre o mapa) na tela do encontro.

### (e) Líder: criar o encontro do sábado e convocar a banda

- **Caminho hoje:** Agenda → "Novo encontro" → "Sábado padrão" → formulário (data e hora vêm sugeridas; local) → "Publicar" → segmento "Convocados" → no bloco "16:05 · Louvor": "+ Convocar pessoa" → função na banda → pessoa → "Convocar". Repete para cada pessoa.
- **Toques:** cerca de **26** para 5 pessoas (6 para criar e publicar, mais 4 por pessoa) e 1 a 2 rolagens.
- **Decisões:** 7 seções no formulário ("O que é", "Quando", "Onde", "Quem vê e inscrições", "Informações úteis", "Repetição", descrição); por pessoa, 3 escolhas.
- **Palavras difíceis:** "Categoria", "Quem vê: Interna ou Pública", "Lista de espera", "Encontro todo", "Responsável / Integrante / Outra", "Convocados".
- **Onde hesita:**
  - Na folha de convocar fora do Louvor, "Responsável / Integrante / Outra" não diz o que cada um faz (captura 09). O campo de busca se chama "Buscar pessoa (pessoa)". "Mostrando 8 de 15" faz a pessoa achar que 7 sumiram.
  - Para a banda toda, são 4 toques por pessoa, todos os sábados, para as mesmas 5 pessoas.
- **Caminho ideal (5 toques):** Agenda → "Novo encontro" → "Igual ao último sábado" (copia roteiro **e quem serviu**, como "aguardando") → conferir a data → "Publicar e avisar a equipe". A pessoa só mexe no que mudou. **Depende de decisão do dono (Q5).** Sem essa mudança de comportamento, o ganho possível é a folha de convocar aceitar várias pessoas de uma vez (marcar 5 nomes, 1 "Convocar").

### (f) Líder: fazer o check-in

- **Caminho hoje (no dia):** Início → tocar o cartão (que no horário diz "Acompanhar ao vivo") → barra do encontro: "Check-in" → "Marcar" em cada pessoa (com "Desfazer" por 10 s).
- **Toques:** 2 para abrir, mais 1 por pessoa. 15 pessoas: 17.
- **Onde hesita:**
  - A lista tem 15 linhas iguais, com "Membro sem inscrição" repetido (captura 10): ruído que a auditoria de 15/11 já tinha pedido para tirar (U-22).
  - "Marcar" não diz o quê. O contador "0 presentes" é grande, mas a ação é pequena.
  - Na porta, com fila, a pessoa precisa de linha inteira como alvo e de resposta imediata.
- **Caminho ideal:** botão "Fazer check-in" **no próprio cartão do Início** no dia do encontro (1 toque). Linha inteira como alvo, botão "Chegou" que vira "Presente" com marca (nunca só cor), sem texto repetido, convocados e inscritos primeiro. QR continua como atalho.

### (g) Publicar um aviso

- **Caminho hoje:** aba Comunidade → "Avisos" → "Novo aviso" → título e texto → "Publicar agora".
- **Toques:** **4**, mais 2 campos. É o caminho mais curto do app. Está bom.
- **Onde hesita:** "Publicar agora" não diz quantas pessoas vão receber a notificação; só a dica falada diz "Membros veem o aviso e recebem notificação". "Mostrar até" e "Fixar no topo" são opcionais e ficam visíveis como se fossem obrigatórios.
- **Caminho ideal:** o mesmo, com a linha "Vai avisar 15 pessoas" embaixo do botão, e "Mostrar até" e "Fixar" dentro de "Mais opções".

### (h) Pedir oração de forma anônima

- **Caminho hoje:** Comunidade → "Pedidos de oração" → "Novo pedido" → escrever → escolher "Comunidade" ou "Equipe de oração" (o padrão é "Somente eu") → ligar "Publicar como anônimo" → "Publicar pedido" → confirmar.
- **Toques:** **7**, mais 1 campo.
- **Palavras difíceis:** "guardado cifrado", "criptografia de ponta a ponta", "capacidade técnica de ler", "o Criador do app".
- **Onde hesita (captura 27):**
  - 3 blocos de texto antes de chegar à escolha: a caixa azul de 5 linhas, a frase "Só você vê. Nem administradores nem o Criador do app têm tela para ler.", e o cartão do anonimato.
  - O interruptor mostra duas frases ao mesmo tempo, "Desligado: seu nome aparece para quem pode ler o pedido" e "Seu nome não aparece para ninguém da comunidade, nem para a liderança". Parecem se contradizer.
  - O anonimato só faz sentido se a escolha não for "Somente eu", mas aparece sempre.
  - Quem só quer pedir oração sem nome precisa descobrir duas configurações separadas.
- **Caminho ideal (6 toques):** escrever; "Quem vai ver" com 3 opções; o anonimato aparecendo **só** quando a escolha não é "Somente eu", com uma frase só do estado atual; aviso de privacidade em 2 linhas com "Como é guardado" para o resto. A confirmação final **fica** (decisão de privacidade, e é o que o app prometeu).

### Quadro resumo

| Tarefa                       | Toques hoje      | Rolagens | Ideal             | Maior problema                           |
| ---------------------------- | ---------------- | -------- | ----------------- | ---------------------------------------- |
| a. Entrar com código         | 4 (3 por link)   | 1        | 3                 | 3 cartões iguais; concordância escondida |
| b. O que faço no sábado      | 0                | 1 a 2    | 0, sem rolar      | Início sem prioridade                    |
| c. Aceitar ou recusar        | 1 ou 2           | 1        | 1 ou 2, sem rolar | 3 botões na Escalas; cartão que não some |
| d. Horário e local           | 0 a 1            | 1        | 0, sem rolar      | Data sem dia do mês                      |
| e. Montar o sábado e a banda | cerca de 26      | 1 a 2    | 5                 | 4 toques por pessoa, toda semana         |
| f. Check-in                  | 2 + 1 por pessoa | 0        | 1 + 1 por pessoa  | Entrada longe; linhas repetidas          |
| g. Aviso                     | 4                | 0        | 4                 | Não diz quantos recebem                  |
| h. Oração anônima            | 7                | 0        | 6                 | Texto técnico; duas configurações        |

---

## 4. Diagnóstico por tela

Nota de clareza de 1 (confuso) a 5 (claro para quem nunca viu). Cada tela tem os 3 maiores problemas e a correção. Telas de login e cadastro (`01`, `02`) estão fora.

### Início atual (captura do dono) e `03`, `23`: nota 2

1. **"Seu resumo" cheio de zeros** (4 de 6 linhas em 0; a 5ª é "0 de 1"). Três das linhas (Tarefas, Inscrições, Presença) não têm seta e não fazem nada: parecem botão e não são. Correção: acordeão fechado, só linhas com valor (seção 5).
2. **Próximo encontro escondido** (começa a 688 pt, atrás da barra). Correção: subir logo depois da saudação.
3. **Versículo recolhido em cartão alto** (83 pt) com referência em 13 pt. Correção: linha fina de 44 pt sob a saudação, com o começo do texto.

- Também: "Presença nos últimos 30 dias: 0 de 1" é um julgamento ("você faltou") para o membro. Cortar do Início.

### `04` Agenda, calendário: nota 3

1. **Duas barras de escolha empilhadas** ("Calendário | Lista" e "Mês | Semana") antes de ver qualquer encontro. Correção: abrir em Lista; Calendário como opção secundária; cortar "Semana".
2. **O calendário ocupa 350 pt para mostrar 7 pontinhos** e o encontro do dia fica abaixo da dobra (atrás da barra). Correção: a lista resolve em 1 tela; o calendário só ajuda a achar um dia distante.
3. **"HOJE, SEGUNDA-FEIRA, 16 DE NOVEMBRO" em 13 pt maiúsculo** com espaçamento, e o "+ Novo encontro neste dia" cortado pela barra. Correção: título do dia em 16 pt, sem maiúsculas.

### `05` Agenda, lista: nota 4

1. **Busca "por título ou categoria":** "categoria" é jargão e o campo ocupa 48 pt para 7 encontros. Correção: esconder a busca até haver mais de 10 encontros.
2. **Filtros cortados na borda** ("Próximos / Passados / Rascunhos / Pub..."): o último some atrás de rolagem lateral. Correção: membro vê só "Próximos" e "Passados"; "Rascunhos" é do líder.
3. **Contorno da pílula inativa a 1,7:1** (seção 7): parecem texto solto.

- Bom: a data grande à esquerda, título, hora, duração e local. É o melhor padrão do app.

### `06` Encontro, Visão geral (líder): nota 3

1. **Cartão "Inscrição / Inscrever-me" é o primeiro bloco** (117 pt) para quem organiza e nem participa. Correção: para organização, vira uma linha "Inscrições: 12 de 60" mais abaixo.
2. **4 abas** ("Visão geral / Roteiro / Convocados / Preparação") e a informação principal (quando e onde) começa a 360 pt. Correção: membro, sem abas; líder, 3 abas no máximo.
3. **Chip "Pública"** sem explicação: quem lê não sabe que significa "qualquer pessoa com o link se inscreve". Correção: "Aberta ao público".

- Bom: "Mais" com texto e o "Editar" como único primário.

### `07` Encontro, Roteiro: nota 4

1. Mantém o cartão "Inscrição" no topo (o mesmo problema).
2. A lista mostra nomes (bom), mas "etapas" aqui e "Roteiro" na aba: coerente (Roteiro é a lista, etapa é cada item), só precisa ser dito uma vez na tela.
3. A seta (chevron) em cada linha leva a uma tela de etapa; para o membro, que só lê, é um toque que não rende.

### `08` Encontro, Convocados: nota 3

1. **"ENCONTRO TODO"** como título do primeiro bloco. Correção: "Para o encontro inteiro".
2. **"+ Convocar pessoa" repetido em cada etapa**, mesmo nas que não precisam de ninguém.
3. O resumo "11 convocados: 9 aceitaram, 2 aguardando" é excelente; falta quem são os 2 (o líder quer ligar para eles). Correção: link "Ver quem falta" que filtra.

### `09` Convocar pessoa: nota 2

1. **"Responsável / Integrante / Outra":** ninguém sabe a diferença. Correção: "Quem conduz / Quem ajuda / Outra função".
2. **"Buscar pessoa (pessoa)" e o subtítulo "Pessoa"**: texto repetido. Correção: "Buscar pelo nome".
3. **"Mostrando 8 de 15. Digite parte do nome para achar outras pessoas."** Parece defeito. Correção: listar todos (15 cabe) ou rolar com "Carregar mais"; ordenar por quem avisou que pode naquele dia.

- Bom: "Já convocado" e "Avisou que não pode neste dia" em texto. Mas "Já convocado" cinza apagado (3,4:1 como o botão desabilitado).

### `10` Check-in: nota 3

1. **"Membro sem inscrição" em todas as linhas** (15 vezes). Correção: mostrar só a exceção.
2. **"Marcar"** não diz o quê. Correção: "Chegou", depois chip "Presente" com marca.
3. **Alvo é o botão pequeno, não a linha.** Correção: linha inteira.

### `11` Ao vivo: nota 3

1. **Chip verde "Ao vivo" no topo, com "AINDA NÃO COMEÇOU" no cartão.** O chip é o estado da conexão (`TelaAoVivo.tsx:148`), não do encontro. Quem lê entende "está ao vivo" e vê "ainda não começou". Correção: "Conectado".
2. "TODAS AS ETAPAS" em 13 pt maiúsculo com a lista de 7 por baixo; está bom, mas o botão "Iniciar" fica sozinho sem dizer o que acontece. Correção: "Iniciar o encontro".
3. "Mais" no topo esconde as ações de encerrar e voltar etapa; aceitável (tem texto), mas confirmar com 3 pessoas.

- Bom: botões de 56 pt, "Previsto para 16:00" grande.

### `12` Novo encontro: nota 2

1. **7 seções para criar um sábado** (O que é, Quando, Onde, Quem vê e inscrições, Informações úteis, Repetição e descrição). Correção: Data, Hora e Local visíveis; o resto em "Mais opções".
2. **"Categoria" em campo livre com sugestões** e **"Descrição"** logo no começo: o que o líder quer decidir primeiro (quando) vem depois. Correção: ordem Quando, Onde, Título; "Categoria" some do caminho principal.
3. **Data e hora vazias na captura** (`dd/mm/yyyy`), embora o código prometa sugerir o próximo sábado às 16h no "Sábado padrão" (verificar no aparelho).

- Bom: "Salvar rascunho" e "Publicar" lado a lado.

### `14` Comunidade (líder): nota 2

1. **Dois grupos de ferramentas antes das pessoas** (5 em "Na comunidade", 4 em "Organização", mais configurações, convite, abas Pessoas/Pedidos/Convites e "Sair"). Para entrar em "Pessoas", rola-se 2 telas.
2. **"Louvor" e "Conteúdos" dizem "músicas" nos dois** ("Meu repertório, músicas, cifras..." e "Músicas, músicos, palestrantes e dinâmicas"). Correção na seção 6.
3. **A tela se chama "Comunidade" e tem 4 verbos diferentes** (ler avisos, rezar, sugerir, administrar). Correção: membro vê 3 linhas e "Pessoas"; ferramentas de organização viram um acordeão "Organização" fechado.

### `15` Convidar: nota 3

1. **"Papel", "Validade", "O máximo são 7 dias"**: 3 escolhas antes do primeiro resultado. Correção: um botão "Convidar para o grupo" que cria o link de 7 dias como Membro e abre o compartilhar; "Mais opções" para papel, validade e e-mail.
2. "Papel" é jargão: "Função na comunidade".
3. O campo "E-mail (opcional)" abre o teclado e distrai; ficará dentro de "Mais opções".

- Bom: cada papel tem a explicação em uma linha.

### `16` Avisos: nota 3

1. **Dados de teste na demonstração:** "QA offline 13089", "QA d'Ávila 63630" (2 vezes). Em uma apresentação isso passa a mensagem de produto improvisado. Correção: limpar a semente.
2. **A descrição "Escreva, publique, fixe no topo ou tire do ar. Rascunhos só a organização vê."** é instrução para o líder e aparece no topo da tela.
3. **"Publicado em 15/11/2026" repetido em todos os itens** (ocupa 1 linha de 4). Correção: data relativa ("há 6 dias") no lugar.

### `17` Oração: nota 4

1. **Filtros "Todos / Meus / De outras pessoas / Em..."** cortados na borda.
2. **Rótulo "PEDIDO DE THIAGO · 14 NOV"** em 13 pt maiúsculo coral: a frase mais importante do cartão é a menor e a mais enfeitada.
3. **Botão "..." só com ícone** em cada cartão. Correção: "Mais".

- Bom: "Estou orando" com contagem e o chip de quem vê.

### `18` Sugestões: nota 3

1. **"+" sozinho no canto** (U-06 ficou aberto só aqui). Correção: "Nova sugestão".
2. **"Mude a situação e responda para quem sugeriu saber o que ..."** truncado: descrição de líder, cortada.
3. **Estados "Recebida / Em análise / Aceita"** como filtros para todos: só o líder precisa deles.

### `19` Relatórios: nota 3

1. **Duas fileiras de filtros** ("Presença / Inscrições / Escalas / Atividade" e "30 dias / 90 dias / 12 meses / Personalizado") mais "Semana / Mês": 3 escolhas antes dos números.
2. **Botão de exportar só com ícone** no canto.
3. Os números são claros ("4 encontros", "28 presenças"). É tela de líder, de uso raro: não mexer agora.

### `20` Perfil: nota 3

1. **"Editar dados" no cartão e "Editar perfil" na lista levam ao mesmo lugar.** Correção: tirar um.
2. **17 linhas em 4 grupos** (Sua conta 6, Comunidades, Mais opções 5, Sair). "Versículo do dia" é um ajuste de notificação; "Pessoas bloqueadas" e "Denunciar comunidade" são privacidade; "Entrar em outra comunidade" e "Criar comunidade" são da lista de comunidades.
3. **Chip âmbar "Desligado" em "Segurança"**: é um aviso de alerta para algo opcional; incomoda o membro. Correção: só para quem administra.

### `21` Procurar comunidade: nota 3

1. **"Campinas" no campo "Cidade" tem a cor de valor preenchido.** O exemplo parece dado digitado.
2. O rótulo "Nome da comunidade" duplica o título da tela e o texto de dentro do campo.
3. Falta ver o resultado e o estado "ninguém encontrado" (não aparecem nas capturas; verificar).

- Bom: "Se a sua não aparecer, peça o código para alguém da liderança" fecha o caminho.

### `22` Tenho um código: nota 3

1. **Concordância abaixo da dobra** e botão desabilitado visível (seção 3a).
2. **Exemplo "ABCD 2345" parece preenchido.**
3. **"Mensagem para a liderança (opcional)"** com 5 linhas de explicação, na frente do que importa.

### `24` Escalas (membro): nota 4

1. **3 botões na convocação pendente** (seção 3c).
2. **"Não posso ir" é um link coral**, sem forma de botão: quem procura "botão" não acha.
3. **A aba se chama Escalas, o cartão diz "convocação" e o verbo é "convocar".** Regra (seção 6): "Escala" é a lista, "convocar" é o ato.

- Bom: data na sobrancelha com o chip de estado em texto.

### `25` Sino: nota 2

1. **4 linhas idênticas** "Novo aviso: Há um aviso novo na sua comunidade. Abra o app para ler." Quem lê não sabe qual aviso é qual. O texto genérico existe por privacidade (NOT-02), mas repetir 4 vezes é ruído e o leitor de tela lê os 4. Correção: agrupar ("4 avisos novos") e marcar como lido ao abrir o aviso.
2. **Hora sem data** em cada linha ("10:43"), sob o título "ONTEM".
3. "Você tem 12 não lidas" e "Marcar todas como lidas": certo.

### `26` Escalas (líder): nota 3

1. **A aba "Escalas" abre com a lista do que os outros ainda não responderam** ("Aguardando resposta", 6 linhas), e as escalas do próprio líder ficam abaixo da dobra. A aba mistura "o que eu faço" e "o que falta na equipe".
2. "2 sem resposta" sem dizer "convocados".
3. Correção: "Aguardando resposta" vai para o "Para resolver" do Início do líder (seção 5); Escalas fica só com o pessoal.

### `27` Oração anônima: nota 2

Ver 3h. Problemas: 3 blocos de texto técnico, duas frases contraditórias no interruptor, anonimato visível quando a escolha é "Somente eu".

### Resumo de padrões que se repetem

- **Texto de 13 pt maiúsculo para o que informa** (sobrancelhas, dia do calendário, "PEDIDO DE THIAGO").
- **Filtros em pílulas cortadas na borda** (Agenda, Oração, Sugestões, Relatórios).
- **Ícone sozinho** onde a ação importa: "+" em Sugestões, exportar em Relatórios, "..." nos cartões de Oração.
- **Instrução de líder no topo de tela de todos** (Avisos, Sugestões).
- **Exemplo dentro do campo com cor de valor** (Procurar, Código).

---

## 5. Proposta de Início novo

### Princípios

1. **Uma pergunta por pessoa, respondida sem tocar nem rolar:** "quando e onde" (membro) e "o que falta resolver" (líder).
2. **O que precisa de ação fica à vista; o resto fica recolhido.** O resumo é um acordeão fechado, e o título dele diz o que importa.
3. **Nada de zero.** Um número que não pede ação não aparece.
4. **Um primário por tela.** O botão do cartão do encontro muda conforme o estado.
5. **Orçamento de altura:** 874 pt do iPhone menos 59 de área segura e 94 de barra de abas deixam cerca de 720 pt. Cabeçalho (pílula e sino) 53, saudação 38, versículo 44: sobram cerca de 585 para o encontro, a ação pendente e o resumo (cartão do encontro 150, ação pendente 150, resumo fechado 64).

### Versículo do dia: decisão

**Formato escolhido: uma linha fina logo abaixo da saudação, sem cartão, com o começo do texto e a referência, que se abre com animação suave de altura.**

Por que, e por que não as outras opções:

- **Hoje falha** porque usa o corpo inteiro de um cartão (borda, 18 pt de margem, 83 pt) para mostrar "VERSÍCULO DO DIA" em coral e "João 3:30" em 13 pt, sem nenhuma palavra do versículo. Quem vê "João 3:30" não sabe o que é; é um convite a tocar sem recompensa.
- **Linha só com a referência** (a alternativa mais simples) repete o problema: a referência sem texto não diz nada.
- **Rodapé do cabeçalho** é bonito, mas no cabeçalho já estão a pílula e o sino; a saudação é o único texto "de tela", e o versículo é o seu subtítulo natural.
- **Linha com o começo do texto** dá o que ler em 1 linha, gasta 44 pt (menos da metade de hoje) e o toque é natural ("quero ler o resto").

Wireframe fechado e aberto (alturas em pt):

```
Bom dia, Ana                                    <- saudação (display 34)
✦ "Não fostes vós que me escolhestes…"  ⌄       <- 44 pt, texto 15, cor textoSuave
   João 15:16                                   <- só aparece com fonte grande (2ª linha)

(aberto, abre em 200 ms; com Reduzir movimento, sem animação)
Bom dia, Ana
✦ Versículo do dia                      ⌃
+--------------------------------------+
| Não fostes vós que me escolhestes,   |   <- leitura 17/26
| porém eu vos escolhi, e tenho vos    |
| posto para que vades e deis fruto... |
| João 15:16 · BLIVRE                  |   <- 14 pt (era 13)
| Sobre a tradução                     |   <- terciário
+--------------------------------------+
```

Regras e textos exatos:

- **Fechado:** ícone de livro 18 pt (decorativo) + `“{primeiras 6 a 8 palavras}…”` + chevron de 18 pt, tudo na mesma linha de 44 pt de alvo. Rótulo acessível: `Versículo do dia, {referência}. Recolhido. Toque para ler.` Aberto: `Versículo do dia, {referência}. Aberto. Toque para recolher.` Mantém `aria-expanded`.
- **Fonte grande (escala 1,35 ou mais):** o texto vai a 2 linhas e a referência desce.
- **Sem colchetes:** hoje o texto mostra `Não [fostes] vós [que] me escolhestes`. Os colchetes são suplementos do tradutor e parecem erro para quem lê. **Decisão Q7:** tirar na exibição e manter a explicação em "Sobre a tradução".
- **Lembrar a escolha:** vale só na sessão, como hoje (D59). Opção em Perfil, Versículo do dia: "Mostrar o versículo aberto" (para quem gosta de ler todo dia).
- **"Horário e notificação"** sai do cartão (já existe em Perfil) e fica só na tela cheia `/versiculo`.
- **Estados:** não há carregamento nem erro (o versículo vem do aparelho). Vazio: não existe.
- **Arquivo:** `apps/app/src/funcionalidades/versiculo/CartaoDoVersiculo.tsx`.

### Início do membro, ordem exata

```
+--------------------------------------+
| (JE) Jovens Esperança            (🔔2)|  1. Cabeçalho (como hoje)
|                                      |
| Bom dia, Ana                         |  2. Saudação
| ✦ "Não fostes vós que me esco…"   ⌄  |     Versículo (44 pt)
|                                      |
| +----------------------------------+ |
| | HOJE · 16:00 às 17:00            | |  3. PRÓXIMO ENCONTRO (sempre,
| | Sábado Jovem                     | |     claro, ~150 pt)
| | Salão da igreja                  | |
| | Você: Louvor · Vocal  ✓ Confirmado|
| | [ Abrir o repertório ]           | |     botão certo (tabela abaixo)
| +----------------------------------+ |
|                                      |
| +----------------------------------+ |
| | Você foi convocado               | |  4. AÇÃO PENDENTE (só se houver)
| | Recepção · Sábado, 28 de nov.    | |     ~150 pt, primário "Aceitar"
| | [ Aceitar ] [ Não posso ir ]     | |
| +----------------------------------+ |
|                                      |
| +----------------------------------+ |
| | Seu resumo                       | |  5. RESUMO, acordeão fechado
| | 2 coisas esperando você        ⌄ | |     ~64 pt
| +----------------------------------+ |
|                                      |
| Aviso fixado: Ensaio do louvor às 15h|  6. Aviso fixado (1 linha, 56 pt)
+--------------------------------------+
   [Início] [Agenda] [Escalas] [Comunidade] [Perfil]
```

Notas da ordem:

- **O próximo encontro vem antes da ação pendente**, porque aparece em toda abertura e a ação pendente aparece e some; o que muda de lugar confunde mais do que o que fica. **Exceção:** se a convocação pendente é do **mesmo** encontro do cartão, ela entra dentro dele (os dois botões no rodapé do cartão) e o bloco 4 não existe.
- **Antes e depois de aceitar:** depois de aceitar, o bloco 4 some e a linha "Você: Recepção · Confirmado" aparece no cartão do encontro correspondente. Não sobra cartão "Você foi convocado / Aceitou".
- **O cartão do encontro mostra a data completa:** `Sábado, 21 de nov. · 16:00 às 17:00` e um marcador de proximidade em texto: `Hoje`, `Amanhã` ou `Em 5 dias`. Hoje diz só "Sábado".
- **Roteiro no cartão:** de 3 etapas para **0** (o roteiro está a um toque). Se o líder quiser, 1 linha: "Começa com Boas-vindas".
- **Os 3 destaques do membro:** o próximo encontro, o que preciso responder, o resumo. O aviso fixado é uma linha, não um cartão.
- **Cartões que saem do Início do membro:** "Alguém precisa de substituição" (vai para o resumo), "Suas tarefas" (vai para o resumo), "Meu repertório" (vira o botão do cartão do encontro para quem toca), "Primeiros passos" (só para quem organiza, seção 8), "Minhas inscrições" (vira a linha "Você: inscrito" do cartão).

**O botão certo do cartão do encontro** (um primário só):

| Quem        | Estado                                                             | Botão primário                                                                                                                                             | Secundário     |
| ----------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Membro      | Convocação deste encontro pendente                                 | Aceitar                                                                                                                                                    | Não posso ir   |
| Membro      | Convocado e confirmado, no louvor                                  | Abrir o repertório                                                                                                                                         | Ver o encontro |
| Membro      | Convocado e confirmado, outra função                               | Ver o encontro                                                                                                                                             | (nenhum)       |
| Membro      | Encontro público com inscrição aberta e a pessoa não está inscrita | Inscrever-me                                                                                                                                               | Ver o encontro |
| Membro      | O encontro está acontecendo                                        | Acompanhar ao vivo                                                                                                                                         | (nenhum)       |
| Líder       | Rascunho                                                           | Publicar                                                                                                                                                   | Editar         |
| Líder       | Publicado, há convocação sem resposta                              | Ver quem falta responder                                                                                                                                   | Ver o encontro |
| Líder       | No dia, a partir de 2 h antes                                      | Fazer check-in                                                                                                                                             | Abrir ao vivo  |
| Qualquer um | Não há próximo encontro                                            | Líder: Criar o encontro do sábado. Membro: sem botão, com o texto "Quando a liderança marcar o próximo encontro, ele aparece aqui e você recebe um aviso." |                |

### "Seu resumo" como acordeão

**Fechado por padrão.** O título diz a única coisa que importa em uma linha.

```
Fechado, com itens:           Fechado, nada a fazer:
+------------------------+    +------------------------+
| Seu resumo             |    | Seu resumo             |
| 2 coisas esperando     |    | Tudo em dia         ✓  |   <- sem seta, não abre
| você                 ⌄ |    +------------------------+
+------------------------+

Aberto (só linhas com valor, na ordem de urgência):
+------------------------------------+
| Seu resumo                         |
| 2 coisas esperando você          ⌃ |
| ---------------------------------- |
| Responder 1 convocação           > |  -> Escalas
| Concluir 1 tarefa                > |  -> a tarefa
| Ver 1 pedido de substituição     > |  -> Escalas
+------------------------------------+
```

**Textos exatos do título:** `Tudo em dia` (zero itens, com ícone de marca; não expande, sem seta), `1 coisa esperando você`, `{n} coisas esperando você`. O rótulo acessível é `Seu resumo: {título}. Recolhido, toque para ver.` (ou `Aberto, toque para recolher.`), com `aria-expanded`.

**Regras do conteúdo:**

- Só entra linha com valor maior que zero. O título conta exatamente as linhas listadas.
- **Cada linha começa com o verbo do que o toque faz e leva a um lugar:** `Responder {n} convocação(ões)`, `Concluir {n} tarefa(s)`, `Ver {n} pedido(s) de substituição`. Nenhuma linha morta (hoje Tarefas, Inscrições e Presença não levam a lugar nenhum).
- **Saem do resumo:** "Convocações aceitas" (vira a linha "Você:" do cartão do encontro), "Inscrições em encontros" (idem), "Presença nos últimos 30 dias" (Q6), "Pedidos de oração ativos" (a contagem passa a ser um selo na linha "Pedidos de oração" da aba Comunidade; se o dono quiser mantê-la, entra como "Para acompanhar", fora do título).
- **Animação:** 200 ms de altura e dissolução, seta que gira; com "Reduzir movimento", abre sem animação. O estado vale só na sessão, como o versículo.
- **Estados (as quatro telas):** carregando (esqueleto de 64 pt, como hoje), erro ("Não deu para carregar o seu resumo" com "Tentar de novo", como hoje), vazio ("Tudo em dia"), com itens (acima).
- **Arquivos:** `apps/app/src/funcionalidades/inicio/MinhaVisaoGeral.tsx` e `LinhaDeNumero.tsx`; peça nova reutilizável `apps/app/src/ui/Acordeao.tsx` (o versículo e o resumo usam a mesma).

### Início do líder, ordem exata

Mesma ordem do membro, com duas diferenças:

1. **Sai o seletor "Minha visão | Da comunidade"** (D59). Ele obriga uma escolha antes de ver qualquer coisa, e leva o líder a ver só metade. **Decisão Q1.**
2. **O resumo ganha dois grupos**, com o título contando os dois.

```
Bom dia, Daniel
✦ "Não fostes vós que me esco…"   ⌄

+----------------------------------+
| HOJE · 16:00 às 17:00            |   PRÓXIMO ENCONTRO
| Sábado Jovem · Salão da igreja   |
| 9 de 11 aceitaram                |   <- a pergunta do líder
| [ Fazer check-in ] [Abrir ao vivo]
+----------------------------------+

+----------------------------------+
| Seu resumo                       |
| 5 coisas esperando você        ⌄ |
+----------------------------------+
   (aberto)
   PARA VOCÊ
   Responder 1 convocação        >
   DA ORGANIZAÇÃO
   Ver 2 convocações sem resposta >
   Ver 1 pedido de entrada       >
   Ver 1 tarefa atrasada         >
   Ver os números e relatórios   >   <- sempre, leva a Relatórios
```

- **Texto do título para o líder:** `Tudo em dia`, `1 coisa esperando você`, `{n} coisas esperando você`. Os dois grupos têm subtítulo em texto ("Para você", "Da organização").
- **Saem do Início do líder:** "Próximos 14 dias" (a Agenda faz isso) e "Números da comunidade" (Relatórios faz isso). `VisaoGeralDaComunidade.tsx` deixa de ser aba do Início e fica como um bloco do acordeão e uma linha "Ver os números e relatórios".
- **Sem encontro marcado (estado vazio do líder):** "Nenhum encontro marcado. Monte o próximo: o Sábado padrão já vem com o roteiro de sempre." Botão "Criar o encontro do sábado" (hoje "Novo Sábado padrão"). Some a segunda ação "Informar minha disponibilidade" (é da aba Escalas).
- **Sem encontro marcado (estado vazio do membro):** hoje dá dois botões ("Ver a agenda" e "Informar minha disponibilidade"), e a agenda está vazia também. Novo: `Ainda não há encontro marcado. Quando a liderança marcar o próximo, ele aparece aqui e você recebe um aviso.` Se os avisos estiverem desligados, um botão: "Ligar os avisos". Se não, nenhum botão.

### O que isso muda no tamanho da tela

|                                  | Hoje (captura do dono)  | Início novo (membro)               |
| -------------------------------- | ----------------------- | ---------------------------------- |
| Altura do versículo              | 83 pt                   | 44 pt                              |
| Altura do resumo                 | 447 pt                  | 64 pt                              |
| Onde começa o próximo encontro   | 688 pt (atrás da barra) | cerca de 170 pt                    |
| Alvos tocáveis antes do encontro | 6                       | 2 (pílula e sino) mais o versículo |
| Número de linhas "0"             | 4 de 6                  | 0                                  |

---

## 6. Simplificação radical

### Princípio

**Cortar o que ninguém pediu, esconder o que só uma pessoa usa, juntar o que tem o mesmo destino.** A régua é: _o membro vê no máximo 3 coisas importantes por tela; o líder vê as mesmas e mais o que organiza, sob demanda._

### CORTAR

| O quê                                      | Onde                         | Por que                                                                |
| ------------------------------------------ | ---------------------------- | ---------------------------------------------------------------------- |
| Linhas "0" do resumo                       | Início                       | Seção 5.                                                               |
| "Presença nos últimos 30 dias"             | Resumo do membro             | Parece cobrança; o líder vê em Relatórios (Q6).                        |
| "Convocações aceitas / Próximos encontros" | Resumo                       | Vira a linha "Você:" no cartão do encontro.                            |
| "Editar dados" (botão do cartão)           | Perfil                       | Mesma tela que "Editar perfil".                                        |
| Cartão "Você foi convocado / Aceitou"      | Início                       | Depois de aceitar, a pessoa não tem nada a fazer.                      |
| "Semana"                                   | Agenda                       | Para 1 a 3 encontros por semana, o Calendário em mês e a Lista bastam. |
| "Horário e notificação"                    | Cartão do versículo          | Já está no Perfil e na tela cheia.                                     |
| Dados de teste ("QA offline 13089")        | Demonstração                 | Seção 4, `16`.                                                         |
| 3 etapas de roteiro                        | Cartão do encontro no Início | O roteiro está a um toque; a linha "Você:" importa mais.               |

### ESCONDER (revelação progressiva)

| O quê                                                                                    | Para quem                                                    | Onde fica                                                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Relatórios, Locais, Modelos, Denúncias                                                   | Só o líder                                                   | Acordeão "Organização" fechado, na aba Comunidade.                                                                 |
| "Louvor"                                                                                 | Só quem está convocado ao louvor ou quem organiza            | Linha na Comunidade; botão no cartão do encontro. Hoje todo membro vê.                                             |
| "Sugestões" e "Conteúdos"                                                                | Todos                                                        | Embaixo de "Mais" na Comunidade, com 1 linha cada; membro quase nunca abre.                                        |
| Campos extras do novo encontro (descrição, categoria, vagas, lista de espera, repetição) | Líder                                                        | "Mais opções", fechado; só Data, Hora e Local à vista.                                                             |
| E-mail, papel e validade do convite                                                      | Líder                                                        | "Mais opções" do Convidar.                                                                                         |
| "Mostrar até" e "Fixar no topo" do aviso                                                 | Líder                                                        | "Mais opções".                                                                                                     |
| "Rascunhos" e "Passados" na Lista                                                        | Membro vê só "Próximos" e "Passados"; "Rascunhos" só o líder | Filtros.                                                                                                           |
| Busca na Lista                                                                           | Todos                                                        | Só aparece com mais de 10 encontros.                                                                               |
| Chip "Segurança: Desligado" em âmbar                                                     | Membro                                                       | Só o administrador vê o alerta.                                                                                    |
| Instrução de líder nos topos                                                             | Membro                                                       | "Escreva, publique, fixe..." só para quem pode escrever.                                                           |
| "Inscrição / Inscrever-me" no topo do encontro                                           | Quem organiza                                                | Linha "Inscrições: 12 de 60" mais abaixo.                                                                          |
| "Preparação" (tarefas, materiais, checklist, anexos)                                     | Membro que não tem tarefa                                    | Só aparece quando há o que marcar (já é assim); para o líder, uma linha "Preparação" na Visão geral em vez de aba. |

### JUNTAR

| O quê                                            | Em quê                                                                                                                                                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Editar perfil", "Editar dados"                  | Um só.                                                                                                                                                                                                                                                        |
| "Versículo do dia" (Perfil)                      | "Notificações" (é liga/desliga e horário).                                                                                                                                                                                                                    |
| "Pessoas bloqueadas", "Denunciar comunidade"     | "Privacidade e segurança".                                                                                                                                                                                                                                    |
| "Entrar em outra comunidade", "Criar comunidade" | Linha "Entrar ou criar comunidade" dentro de "Comunidades".                                                                                                                                                                                                   |
| "Aguardando resposta" (aba Escalas do líder)     | "Para resolver" do Início do líder. A aba Escalas fica só com o pessoal.                                                                                                                                                                                      |
| "Louvor" e "Conteúdos" (músicas)                 | Cada um com um papel diferente: **Louvor** = o repertório e a cifra do próximo encontro; **Conteúdos** = biblioteca (músicas, palestrantes, dinâmicas). Textos: "Repertório e cifras do encontro" e "Biblioteca da comunidade". Hoje os dois dizem "músicas". |
| "Pessoas / Pedidos / Convites" (3 segmentos)     | "Pessoas" como linha que abre a lista; "Pedidos de entrada" e "Convites" dentro de "Organização". Menos 3 segmentos na primeira tela.                                                                                                                         |

### Visão simples por papel

**Membro (no máximo 3 coisas por tela):**

| Tela       | As 3 coisas                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Início     | Próximo encontro. O que preciso responder. Seu resumo (fechado).                                                                        |
| Agenda     | Lista de próximos encontros. "Ver calendário". Passados (se quiser).                                                                    |
| Escalas    | O que preciso responder. O que já aceitei. "Meus dias" (disponibilidade).                                                               |
| Comunidade | Avisos. Pedidos de oração. Pessoas. (E "Mais": Sugestões, Conteúdos, Louvor se for do louvor.)                                          |
| Perfil     | Editar perfil. Notificações. Ajuda. (E Segurança, Privacidade, Comunidades e Sair em um grupo embaixo.) Cerca de 7 linhas em vez de 17. |
| Encontro   | Quando e onde. Minha parte. Roteiro. (Sem abas.)                                                                                        |

**Líder vê, além disso:**

- Na Agenda: "Novo encontro" e a opção "Rascunhos".
- No Início: botão do cartão por estado e o grupo "Da organização" no resumo.
- No encontro: "Convocados" e "Mais" com as ações de organização.
- Na Comunidade: o acordeão "Organização" e o convite.

**Como a organização aparece:** em acordeões fechados e em "Mais opções", nunca como mais linhas na primeira tela. O líder abre o que precisa, na hora em que precisa.

### Palavras: o que mantém e o que muda

- **Manter:** Encontro, Roteiro (a lista) e etapa (cada item), Repetição, Primeiros passos, Aceitar, Não posso ir. São coerentes e a auditoria de 15/11 já os trocou.
- **Regra para Escalas e convocação (D54 e D57):** "Escala" é o lugar (a aba e a lista), "convocar" é o ato do líder, e quem recebe "foi convocado". Isso é coerente, mas só **depois de testar com 3 pessoas** (seção 10); se a Regina disser "convocada" soa estranho, a troca é "escalado" no cartão. Não mexer antes.
- **Mudar:** "Encontro todo" por "Para o encontro inteiro"; "Responsável / Integrante / Outra" por "Quem conduz / Quem ajuda / Outra função"; "Papel" por "Função na comunidade"; "Pública" por "Aberta ao público"; "Marcar" por "Chegou"; o chip "Ao vivo" (conexão) por "Conectado".

### Impacto de complexidade do Modo músico (D61)

O Modo músico está em construção e acrescenta, para todos: a linha "Louvor" na Comunidade, o cartão "Meu repertório" no Início, o cartão do repertório dentro do Roteiro, a lista "Função na banda" ao convocar, "Avisar a banda". Isso é bom para quem toca e ruído para os outros 80%. Recomendações:

1. **"Louvor" só aparece** para quem está convocado ao louvor ou organiza. Não para todo membro.
2. **Nada de cartão "Meu repertório" no Início.** O botão "Abrir o repertório" entra no cartão do próximo encontro (tabela da seção 5), como segunda ação da linha "Você: Louvor · Vocal".
3. **Vocabulário musical** (tom, capotraste, ChordPro, transposição) **só dentro das telas do louvor**, nunca na Comunidade nem no Início.
4. **O Modo palco (fatia 2) deve ser um modo à parte**, aberto pelo botão do repertório, sem aba nova.
5. **Convocar a banda:** a lista de funções (Vocal, Violão, Guitarra...) é um avanço para o líder; manter e acrescentar "marcar várias pessoas de uma vez".

### O que NÃO mexer

- **A identidade visual (Aurora)**, o cartão claro do próximo encontro, o tema escuro e o claro.
- **Rótulo visível em todo campo** e o **motivo escrito embaixo do botão desabilitado**.
- **Desfazer no check-in** (toast de 10 s) e as **confirmações específicas** das ações destrutivas.
- **Estados vazios com ação** e erros em linguagem humana.
- **5 abas, barra flutuante com texto e ícone.** Não acrescentar nem tirar aba.
- **Aviso padrão "Somente eu" na oração**, o anonimato e a regra de que a confirmação aparece ao ampliar o público (decisão de privacidade).
- **"Sábado padrão" pré-preenchido** e a explicação de cada papel no convite.
- **Estou orando com contagem**, a lista de encontros com data grande.
- **Isolamento entre comunidades, offline, permissões** (nada disso é UX visível; não tocar nesta onda).

---

## 7. Acessibilidade (WCAG 2.2 AA, VoiceOver, TalkBack)

### 7.1 Contraste calculado a partir dos tokens

Cálculo: fórmula WCAG 2.2 de luminância relativa, sobre os valores de `packages/tokens/src/cores.ts`. Mínimos: 4,5:1 para texto normal, 3:1 para ícone e borda de controle.

**Pares usados todo dia, tema escuro (fundo `#12102A`, superfície `#232139`, elevada `#2B2848`, campo `#1A1833`):**

| Par                                          | Razão  | Resultado |
| -------------------------------------------- | ------ | --------- |
| texto `#F5F3FF` sobre fundo                  | 16,9:1 | passa     |
| texto sobre superfície                       | 14,2:1 | passa     |
| textoSuave `#C9C4EC` sobre fundo             | 11,1:1 | passa     |
| textoSuave sobre superfície                  | 9,3:1  | passa     |
| textoSuave sobre superfície elevada (folhas) | 8,4:1  | passa     |
| destaque `#FFB199` sobre fundo               | 10,6:1 | passa     |
| destaque sobre superfície                    | 8,9:1  | passa     |
| primária `#FF8A65` contra fundo (interface)  | 8,0:1  | passa     |
| borda do campo `#736DA8` contra o campo      | 3,7:1  | passa     |

**Tema claro (fundo `#F7F5FF`, superfície `#FFFFFF`):**

| Par                                     | Razão | Resultado                                       |
| --------------------------------------- | ----- | ----------------------------------------------- |
| textoSuave `#4B4670` sobre fundo        | 8,1:1 | passa                                           |
| destaque `#8A2E12` sobre branco         | 8,5:1 | passa                                           |
| sucesso `#16794B` sobre branco          | 5,4:1 | passa                                           |
| branco sobre primária `#C2491F` (botão) | 4,9:1 | passa, margem curta; **não clarear a primária** |

**Os que falham ou ficam no limite (pares não declarados em `pares.ts`):**

| Par                                                                                | Razão                                                                                                                                    | O que fazer                                                                                                       |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Rótulo de botão desabilitado** (texto a 40% sobre o fundo tonal), `ui/cor.ts:25` | **3,4:1** (a WCAG isenta o inativo, mas o botão "Entrar na comunidade" desabilitado é o que a pessoa precisa ler para saber o que falta) | Subir `ALFA_DESABILITADO` de 0,4 para 0,5: chega a cerca de 4,6:1 e continua distinto do ativo.                   |
| **Borda da pílula de filtro inativa** (18% de branco sobre fundo)                  | **1,7:1** contra o fundo (1,8:1 contra a superfície); abaixo dos 3:1 de WCAG 1.4.11 para o contorno de um controle                       | Usar a borda `contorno` (36%, que já passa 3:1) nos filtros inativos. A pílula ativa tem marca (check), bom.      |
| **"Já convocado"** em cinza (desabilitado)                                         | cerca de 3,4:1 (mesmo caso do botão)                                                                                                     | Mesmo ajuste do `ALFA_DESABILITADO`.                                                                              |
| **Exemplo no campo** ("ABCD 2345", "Campinas")                                     | passa em contraste (textoSuave), mas **tem a cor de um valor preenchido**                                                                | Mostrar o exemplo no texto de ajuda ("Exemplo: ABCD 2345") e deixar o campo vazio.                                |
| **Texto que aparece por trás da barra de abas** (capturas 03, 04, 05, 06)          | não medido                                                                                                                               | Verificar no iPhone; na web o desfoque não age. Se aparecer, subir a opacidade do vidro da barra de 86% para 92%. |

Nenhum dos pares declarados em `pares.ts` falha (o teste do projeto confere).

### 7.2 Achados, com severidade

| #   | Severidade | Achado                                                                                                                                                                                                                                                                                    | Como corrigir                                                                                                                                               |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **Alta**   | **Segmentos de 2 e 3 opções viram pílulas roláveis com fonte grande** (a partir da escala 1,35: "xxxGrande" e os tamanhos de acessibilidade). Em `ui/Segmentos.tsx:141-147` e `:107`, só o caso de 4 opções tem a grade em 2 linhas (U-18 corrigido pela metade). Afeta "Calendário       | Lista", "Próximas                                                                                                                                           | Disponibilidade", "Minha visão | Da comunidade", "Pessoas | Pedidos | Convites", "Responsável | Integrante | Outra". A segunda opção pode ficar fora da tela, só alcançável por gesto. | Para 2 e 3 opções com fonte grande, empilhar como lista de opções (como `ListaDeOpcoes`). Testar com escala 1,64 e 2,35. |
| A2  | **Média**  | **Informação útil em 13 e 12 pt.** Referência do versículo e "João 15:16 · BLIVRE" (13), chips (12), rótulo de aba (11), sobrancelha em maiúsculo a 13 com espaçamento. Para 45+ anos e baixa visão, é pequeno. O `corpo` está em 15 (o iOS usa 17).                                      | `TIPO` em `packages/tokens/src/index.ts`: `legenda` 14, `chip` 13, `corpo` e `meta` 16. Onda 3, porque mexe em todo o layout.                               |
| A3  | **Média**  | Rótulo desabilitado a 3,4:1 e borda de filtro a 1,7:1 (tabela acima).                                                                                                                                                                                                                     | Seção 7.1.                                                                                                                                                  |
| A4  | **Média**  | **Alvo do segmento tem 36 pt** (`minHeight: 36`, trilho de 44). Fere a regra de 44 pt do projeto (U-25 ficou aberto).                                                                                                                                                                     | `hitSlop` de 4 pt ou subir a altura do polegar para 44.                                                                                                     |
| A5  | **Média**  | **Aba Perfil só com avatar, sem texto**; com fonte grande, todas as abas perdem o rótulo e ficam 4 ícones ("≡" para Escalas, 2 pessoas para Comunidade). Em `navegacao/BarraDeAbas.tsx` e `ItemDaBarraDeAbas.tsx`.                                                                        | "Perfil" escrito sob o avatar; ícone de Escalas distinto (calendário com marca); verificar o "visualizador de conteúdo grande" do iOS (toque longo na aba). |
| A6  | **Média**  | **Sino com itens idênticos** (captura 25): o VoiceOver lê 4 vezes "Novo aviso. Há um aviso novo na sua comunidade", sem poder escolher.                                                                                                                                                   | Agrupar e marcar como lido ao abrir (seção 4, tela `25`).                                                                                                   |
| A7  | **Média**  | **Barra de abas marca "Início" em telas empilhadas** (capturas 15, 16, 17, 18, 19, 21, 22). Se isso acontece no app real e não só na captura por link direto (D56: "a aba marcada é a última aberta"), o VoiceOver diz "Início, selecionado" dentro de Avisos. **Verificar no aparelho.** | Se confirmado, marcar a aba de origem.                                                                                                                      |
| A8  | **Baixa**  | **Chip "Ao vivo" (conexão)** diz "Ao vivo" antes de o encontro começar (`TelaAoVivo.tsx:148`).                                                                                                                                                                                            | "Conectado".                                                                                                                                                |
| A9  | **Baixa**  | **Descrições truncadas com "..."** ("responda para quem sugeriu saber o que ...", "chegue um ..."): o texto some no leitor visual.                                                                                                                                                        | Deixar a descrição quebrar (sem limite de linhas) quando é informação.                                                                                      |
| A10 | **Baixa**  | **Títulos de seção em nível 3 sem um nível 2** acima: o rotor de títulos do VoiceOver pula do 1 para o 3.                                                                                                                                                                                 | Usar nível 2 em sobrancelhas de cartão.                                                                                                                     |
| A11 | **Baixa**  | "radio" no segmento: no iOS o VoiceOver pode não ler "1 de 2". **Verificar no aparelho** ("Calendário, selecionado, 1 de 2").                                                                                                                                                             | Se não ler, juntar o estado ao rótulo.                                                                                                                      |

### 7.3 O que já está certo (verificado no código)

- **Rótulo falado completo** nos botões (`rotuloAcessivel`), no sino ("Notificações, 12 não lidas") e nos dias do calendário (`rotuloDoDia`, com `aria-selected`).
- **Estado expandido** no versículo (`aria-expanded`), no botão alternável (`aria-pressed`) e nos botões de carregamento (`aria-busy`). O acordeão novo deve seguir o mesmo padrão.
- **Cor nunca é o único sinal:** "Resolver" com ícone no resumo, chips com texto, filtro ativo com check, "Orando" com check. As bolinhas do calendário são redundantes com o rótulo falado.
- **Reduzir movimento:** `Aparecer` abre sem animação, o esqueleto é estático. **Aumentar contraste e Reduzir transparência:** tratados em `Segmentos` e nos vidros.
- **Mensagens de erro** dizem o que fazer ("Escolha a função na banda.", "Falta escolher"), com anúncio (`anunciar`).
- **Toast com ação fica 10 s** (`duracaoDoToast`, U-13 corrigido).
- **Aba e cabeçalho:** nome falado "Perfil de Ana", título do app como nível 1.
- **Alvos de toque:** botões 44 a 56 pt, linhas 56, pílula 44, filtro 36 com 4 de folga vertical (44 efetivos).
- **Ordem de leitura:** a saudação (nível 1) vem antes do resto, os cartões seguem a ordem visual.

### 7.4 Como verificar no aparelho

1. iPhone, Ajustes, Acessibilidade, Tamanho do texto: **xxxGrande** e o maior de **Acessibilidade (AX5)**. Abrir Início, Agenda, Escalas, Comunidade, um encontro e Convocar. Conferir A1 e que nenhum botão primário sai da tela.
2. VoiceOver: deslizar pelo Início novo; o resumo deve ler "Seu resumo, 2 coisas esperando você, recolhido, botão". Depois do toque duplo, "aberto".
3. TalkBack (Android): o mesmo, mais o alvo de 48 dp.
4. **Reduzir movimento** ligado: versículo e acordeão abrem sem animar.
5. Tema claro: abrir Início e Comunidade e repetir as capturas (a demonstração só mostra o escuro).

---

## 8. Primeira experiência

### O que a pessoa vê hoje

**Depois de entrar, sem comunidade (`TelaInicio`, "Comece por aqui"):**

1. Saudação e a frase "Para usar o app, entre numa comunidade ou crie a sua."
2. Aviso dos termos (uma vez).
3. Se houver, "Meus pedidos de entrada".
4. **Três cartões iguais:** código ou convite (primário), procurar comunidade, criar comunidade.
5. Versículo do dia.
6. Nas abas Agenda, Escalas e Comunidade: "Você ainda não participa de uma comunidade" com "Tenho um código" e "Procurar comunidade".

**Depois de entrar com a comunidade (como membro novo, comunidade ainda sem encontro):**

1. Saudação, versículo, "Nenhum encontro marcado".
2. Dois botões ("Ver a agenda" e "Informar minha disponibilidade"), os dois levam a telas vazias.
3. Possível cartão "Primeiros passos".

### "Primeiros passos" ajuda ou atrapalha?

**Atrapalha, para o membro.** O cartão ("Um passeio de poucos minutos pelo app, com exemplos que não mudam nada de verdade") é um passeio de **configuração de organização** (`MissoesDeConfiguracao`, `Demonstracoes`). Para o Lucas, que só quer o horário, é um cartão a mais entre ele e o encontro, e pode ocupar uma das 5 vagas de cartão do Início. Para o líder, ajuda, mas só depois de ele fazer a primeira coisa real.

**Recomendação:** (1) mostrar só para quem organiza; (2) só depois do primeiro encontro criado, não no primeiro dia; (3) como uma linha do resumo ("Conhecer o app em 3 minutos"), não como cartão; (4) continua em Perfil, Ajuda.

### Tela de boas-vindas com UMA ação

Aparece **uma vez**, logo depois de a pessoa entrar numa comunidade (por código, link ou aprovação do pedido). Não substitui o Início: é um degrau antes dele.

```
+--------------------------------------+
|                                      |
|            (JE)  avatar grande       |
|                                      |
|   Tudo pronto, Ana.                  |   <- título, display
|   Você entrou em Jovens Esperança.   |
|                                      |
|   Quando a liderança marcar um       |   <- 2 linhas de corpo, 16 pt
|   encontro ou chamar você para       |
|   servir, a gente avisa pelo celular.|
|                                      |
|   [ Ligar os avisos ]                |   <- a ÚNICA ação (primário)
|   Agora não                          |   <- link, leva ao Início
|                                      |
+--------------------------------------+
```

- **Por que "Ligar os avisos" é a ação:** o valor do app (ser avisado de encontro e convocação) depende da permissão de notificação, e o sistema só pergunta uma vez. Pedir no momento certo e depois de explicar aumenta o aceite. Ligar abre o pedido do sistema; negar ou "Agora não" leva ao Início do mesmo jeito.
- **Para quem já ligou antes:** o botão vira "Ver o próximo encontro".
- **Sem confirmação extra, sem formulário, sem termos** (já foram dados na entrada).
- **Quando for o líder criando a comunidade:** a única ação é "Criar o encontro do sábado".
- **Relação com o trabalho de entrada:** essa tela é o fim do fluxo que o outro grupo refaz. Combinar com eles que (1) a entrada leva a ela, (2) a concordância da fé (TC-03) seja pedida uma vez só, não no cadastro e de novo em "Tenho um código".
- **Estados:** carregando (o pedido ao sistema, botão com `aria-busy`), erro ("Não deu para ligar os avisos. Você pode ligar depois em Perfil, Notificações."), sucesso (vai ao Início com o toast "Avisos ligados").
- **Arquivos prováveis:** nova `funcionalidades/entrada/TelaBoasVindas.tsx` e a rota em `app/(autenticado)/`; o desvio no fim de `funcionalidades/entrada/TelaTenhoUmCodigo` e do aceite do convite.

---

## 9. Plano

Esforço: **P** (horas), **M** (1 a 2 dias), **G** (mais de 2 dias ou decisão do dono). Todo trabalho direto na branch `release`, sem branch nova. Cada item termina com `npm run verificar` verde e a atualização de `docs/STATUS.md` e de `docs/rastreabilidade.md`.

### Onda 1: poucas horas, o que mais reduz a confusão

Tudo aqui é subtração ou texto. Nada precisa de decisão do dono, exceto onde marcado.

| #    | Problema                                                    | Mudança exata                                                                                                                                                                                                                                                   | Arquivo(s) provável(is)                                                                                                  | Como verificar                                                                                                             | Esforço |
| ---- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1.1  | "Seu resumo" ocupa metade da tela, com zeros                | Acordeão **fechado**; título `Tudo em dia` / `1 coisa esperando você` / `{n} coisas esperando você`; aberto, só linhas com valor, cada uma com verbo e destino; tirar "Convocações aceitas", "Inscrições", "Presença 30 dias" e "Pedidos de oração ativos" (Q6) | `inicio/MinhaVisaoGeral.tsx`, `inicio/LinhaDeNumero.tsx`, nova `ui/Acordeao.tsx`, `inicio/__tests__/VisaoGeral.test.tsx` | Teste de unidade por estado (zerado, 1, 2 itens, erro, carregando); captura do Início; VoiceOver lê "recolhido" e "aberto" | M       |
| 1.2  | Versículo fechado ocupa 83 pt e não diz nada                | Linha de 44 pt sob a saudação, com ícone, `“começo do texto…”` e chevron; abre com 200 ms; sem colchetes na exibição (Q7); sem "Horário e notificação" no cartão                                                                                                | `versiculo/CartaoDoVersiculo.tsx`, `inicio/TelaInicio.tsx`, o título da `TelaDoApp` ganha um subtítulo                   | Teste existente do versículo atualizado; captura em 402 pt e com escala 1,35; Reduzir movimento                            | M       |
| 1.3  | Próximo encontro começa a 688 pt                            | Reordenar: saudação e versículo, **próximo encontro**, ação pendente, resumo, aviso fixado; data completa (`Sábado, 21 de nov.`) e marcador `Hoje` / `Amanhã` / `Em 5 dias`; sem as 3 etapas; local em texto; linha "Você: ..."                                 | `inicio/TelaInicio.tsx` (ordem em `MinhaVisao`), `inicio/CartaoDoProximoEvento.tsx`                                      | `TelaInicio.test.tsx`; captura: o cartão inteiro acima da barra em 402 x 874                                               | M       |
| 1.4  | Cartão "Você foi convocado / Aceitou" permanece             | Pendente: cartão com "Aceitar" e "Não posso ir". Aceita: some do Início e vira a linha "Você: ..." no cartão do encontro certo. Se a pendente é do mesmo encontro do cartão, fica dentro dele                                                                   | `inicio/CartaoSuaEscala.tsx`, `CartaoDoProximoEvento.tsx`                                                                | Teste: depois de aceitar, não há `CartaoSuaEscala`; captura `23`                                                           | M       |
| 1.5  | Convocação pendente com 3 botões na Escalas                 | Pendente: só "Aceitar" e "Não posso ir". "Pedir substituição" só depois de aceitar, como botão secundário                                                                                                                                                       | `escalas/CartaoDaEscala.tsx`                                                                                             | Teste: pendente tem 2 botões; confirmada tem "Pedir substituição"                                                          | P       |
| 1.6  | Perfil: "Editar dados" e "Editar perfil" iguais; chip âmbar | Tirar o botão "Editar dados" do cartão (o cartão inteiro leva a Editar perfil); mostrar "Desligado" só para quem administra                                                                                                                                     | `perfil/TelaPerfil.tsx`                                                                                                  | Teste do Perfil; captura `20`                                                                                              | P       |
| 1.7  | Folha de convocar com jargão                                | `Responsável / Integrante / Outra` vira `Quem conduz / Quem ajuda / Outra função`; "Buscar pessoa (pessoa)" vira "Buscar pelo nome"; sem "Mostrando 8 de 15" (listar todos até 50); "Encontro todo" vira "Para o encontro inteiro"                              | `eventos/Convocacao.tsx`, `comunidade/SeletorDePessoa.tsx`, `eventos/SecaoEquipe.tsx`                                    | Testes de `Equipe.test.tsx`; captura `09` e `08`                                                                           | P       |
| 1.8  | Check-in: linhas repetidas e "Marcar" vago                  | "Membro sem inscrição" só como exceção; botão "Chegou" que vira chip "Presente"; linha inteira como alvo                                                                                                                                                        | `inscricoes/TelaCheckin.tsx`                                                                                             | Teste do check-in; captura `10`                                                                                            | P       |
| 1.9  | Ícones sozinhos que sobraram                                | "+" de Sugestões vira "Nova sugestão"; exportar em Relatórios ganha texto; "..." na Oração vira "Mais"                                                                                                                                                          | `sugestoes/TelaSugestoes.tsx`, `relatorios/`, `oracao/CartaoDoPedido.tsx`                                                | Capturas `17`, `18`, `19`                                                                                                  | P       |
| 1.10 | Chip "Ao vivo" que é conexão                                | Trocar o texto para "Conectado"                                                                                                                                                                                                                                 | `aoVivo/TelaAoVivo.tsx:148`                                                                                              | Teste do Ao vivo                                                                                                           | P       |
| 1.11 | Rótulo desabilitado a 3,4:1                                 | `ALFA_DESABILITADO` de 0,4 para 0,5                                                                                                                                                                                                                             | `ui/cor.ts:25`                                                                                                           | Recalcular (cerca de 4,6:1); teste `EstadosDosControles`                                                                   | P       |
| 1.12 | Dados de teste na demonstração                              | Limpar os avisos "QA ..." da semente de apresentação                                                                                                                                                                                                            | semente da comunidade de demonstração e `scripts/apresentacao/telas.ts`                                                  | Recapturar `16`                                                                                                            | P       |
| 1.13 | Texto técnico do aviso de oração                            | Trocar a caixa por: `Só quem você escolher vê. Quem cuida do servidor consegue ler o texto, se precisar. Evite nomes e doenças de outras pessoas.` + "Como é guardado". **Depende de decisão (Q4)**: é texto legal TC-06                                        | `oracao/TelaNovoPedido.tsx` (`AVISO_DO_TEXTO`), texto legal em `docs/`                                                   | Teste de texto; revisão do dono                                                                                            | P       |
| 1.14 | Interruptor de anonimato contraditório                      | Mostrar só a frase do estado atual; esconder o interruptor quando a escolha é "Somente eu"                                                                                                                                                                      | `oracao/TelaNovoPedido.tsx`                                                                                              | `OracaoAnonima.test.tsx`; captura `27`                                                                                     | P       |

**Regra de entrega da Onda 1:** recapturar `03`, `23`, `24`, `09`, `10`, `20`, `27` com `scripts/apresentacao/telas.ts` e comparar com as capturas desta auditoria.

### Onda 2: simplificação por papel

| #    | Problema                                               | Mudança exata                                                                                                                                                                                                                                                            | Arquivo(s)                                                                                      | Como verificar                                    | Esforço |
| ---- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------- |
| 2.1  | Início do líder tem um seletor que obriga a escolher   | Tirar o seletor "Minha visão / Da comunidade". Resumo com dois grupos ("Para você", "Da organização"). **Q1**                                                                                                                                                            | `inicio/TelaInicio.tsx`, `inicio/VisaoGeralDaComunidade.tsx`, `inicio/MinhaVisaoGeral.tsx`      | `VisaoGeral.test.tsx`; líder e membro lado a lado | M       |
| 2.2  | Aba Escalas do líder mistura "meu" e "da equipe"       | "Aguardando resposta" sai da Escalas e vai para o resumo do líder; segmentos "Próximas / Meus dias"                                                                                                                                                                      | `escalas/TelaEscalas.tsx`                                                                       | Captura `26`; teste de `TelaEscalas`              | P       |
| 2.3  | Comunidade mostra 18 alvos ao líder e 10 ao membro     | Membro: Avisos, Pedidos de oração, Pessoas, "Mais" (Sugestões, Conteúdos, Louvor se for do louvor). Líder: o mesmo e acordeão "Organização" fechado (Relatórios, Locais, Modelos, Denúncias, Pedidos de entrada, Convites). Convite como cartão só em comunidade pequena | `comunidade/TelaComunidade.tsx`, `navegacao/mais.ts`                                            | Capturas `14` como membro e como líder            | M       |
| 2.4  | Perfil com 17 linhas                                   | Reduzir para cerca de 7: Editar perfil, Notificações (inclui Versículo), Segurança, Privacidade e segurança (inclui Bloqueados e Denunciar), Ajuda, Comunidades (com "Entrar ou criar"), Sair                                                                            | `perfil/TelaPerfil.tsx`                                                                         | Captura `20`; testes de rota                      | M       |
| 2.5  | Agenda abre com 2 barras de escolha                    | Abrir em **Lista** (Próximos / Passados); "Ver calendário" como botão secundário; cortar "Semana"; busca só com mais de 10; "Rascunhos" só para o líder. **Q2**                                                                                                          | `agenda/TelaAgenda.tsx`, `eventos/ListaDeEncontros.tsx`                                         | Capturas `04`, `05`; testes de Agenda             | M       |
| 2.6  | Encontro tem 4 abas para todos                         | Membro: página única (quando e onde, minha parte, roteiro). Líder: 3 abas (Visão geral, Roteiro, Convocados); "Preparação" vira linha na Visão geral. "Inscrever-me" sai do topo para o líder                                                                            | `eventos/DetalheDoEvento.tsx`, `eventos/DestaqueDoEvento.tsx`, `eventos/VisaoGeralDoEvento.tsx` | `DetalheDoEvento.test.tsx`; capturas `06`, `07`   | M       |
| 2.3b | "Louvor" e o cartão do repertório aparecem para todos  | "Louvor" só para quem toca ou organiza; "Abrir o repertório" como botão do cartão do encontro; sem cartão "Meu repertório" no Início                                                                                                                                     | `navegacao/mais.ts`, `repertorio/CartaoMeuRepertorio.tsx`, `inicio/CartaoDoProximoEvento.tsx`   | `MeuRepertorioNoInicio.test.tsx` atualizado       | M       |
| 2.7  | Convidar tem 3 escolhas antes do link                  | Botão "Convidar para o grupo" que cria o link de 7 dias como Membro e abre o compartilhar; "Mais opções" para função, validade e e-mail                                                                                                                                  | `comunidade/TelaConvidar.tsx`                                                                   | Captura `15`; teste de convite                    | P       |
| 2.8  | Novo encontro com 7 seções                             | Data, Hora e Local à vista; o resto em "Mais opções"; ordem Quando, Onde, Título                                                                                                                                                                                         | `eventos/CamposDoEvento.tsx`, `eventos/TelaNovoEvento.tsx`                                      | Captura `12`; teste do formulário                 | M       |
| 2.9  | Início: botão do cartão por estado (tabela da seção 5) | "Fazer check-in" no dia, "Publicar" no rascunho, "Ver quem falta responder", "Abrir o repertório"                                                                                                                                                                        | `inicio/CartaoDoProximoEvento.tsx`                                                              | Testes por estado                                 | M       |
| 2.10 | Check-in: entrada longe e lista plana                  | Convocados e inscritos primeiro; contador "9 de 15 presentes"; "Desfazer" no toast                                                                                                                                                                                       | `inscricoes/TelaCheckin.tsx`                                                                    | Capturas; teste                                   | M       |
| 2.11 | Sino com itens idênticos                               | Agrupar ("4 avisos novos") e marcar como lido ao abrir                                                                                                                                                                                                                   | `notificacoes/`                                                                                 | Captura `25`; VoiceOver                           | M       |
| 2.12 | Tela de boas-vindas                                    | Seção 8                                                                                                                                                                                                                                                                  | `entrada/TelaBoasVindas.tsx` e rotas; **coordenar com o grupo da entrada**                      | Fluxo completo por código e por link              | M       |
| 2.13 | "Primeiros passos" para todos                          | Só para quem organiza, depois do primeiro encontro; como linha do resumo                                                                                                                                                                                                 | `onboarding/CartaoDaMissao.tsx`, `inicio/TelaInicio.tsx`                                        | Teste de `CartaoDaMissao`                         | P       |

### Onda 3: o resto

| #    | Mudança                                                                                                                                    | Arquivo(s)                                                                              | Esforço |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ------- |
| 3.1  | **Repetir a equipe do último sábado** ao criar o encontro (copia roteiro e convocações como "aguardando", sem avisar até publicar). **Q5** | `eventos/FolhaNovaProgramacao.tsx`, `eventos/TelaDuplicar.tsx`, rota de duplicar na API | G       |
| 3.2  | **Texto maior:** `legenda` 14, `chip` 13, `corpo` e `meta` 16; recapturar tudo com escala 1,35 e 2,35                                      | `packages/tokens/src/index.ts`                                                          | G       |
| 3.3  | **Segmentos de 2 e 3 opções empilham com fonte grande** (A1) e alvo de 44 (A4)                                                             | `ui/Segmentos.tsx`                                                                      | M       |
| 3.4  | Filtros que não cortam na borda (Oração, Sugestões, Relatórios): quebrar em 2 linhas ou virar "Filtrar" com folha                          | `ui/PilulasDeFiltro.tsx` e as telas                                                     | M       |
| 3.5  | Borda dos filtros inativos a 3:1 (A3)                                                                                                      | `ui/PilulasDeFiltro.tsx`                                                                | P       |
| 3.6  | Aba Perfil com texto, ícones distintos em Escalas e Comunidade (A5)                                                                        | `navegacao/BarraDeAbas.tsx`, `ui/ItemDaBarraDeAbas.tsx`                                 | P       |
| 3.7  | "Como chegar" (abre o mapa) no encontro                                                                                                    | `eventos/VisaoGeralDoEvento.tsx`                                                        | P       |
| 3.8  | Datas relativas ("há 6 dias") nos avisos; avisos: "Vai avisar 15 pessoas" no botão                                                         | `avisos/TelaAvisos.tsx`, `TelaNovoAviso.tsx`                                            | P       |
| 3.9  | Conferir o claro (tema) em todas as telas; barra de abas ligada a origem (A7); títulos de nível 2 (A10)                                    | `navegacao/BarraDaPilha.tsx`, `ui/CartaoDeVidro.tsx`                                    | M       |
| 3.10 | Ajuda no contexto das tarefas do sábado (um "?" que abre 3 linhas), não só em Perfil                                                       | várias telas                                                                            | M       |

### Perguntas ao dono (poucas, com a minha recomendação)

| #      | Pergunta                                                                                                                                             | Recomendação                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Q1** | O Início do líder pode ser o mesmo do membro, com um grupo "Da organização" dentro do resumo, **sem o seletor "Minha visão / Da comunidade"** (D59)? | **Sim.** O seletor obriga uma escolha antes de ver qualquer coisa.                        |
| **Q2** | A Agenda pode abrir em **Lista**, com o Calendário como opção secundária e **sem "Semana"** (D57)?                                                   | **Sim.** Para 1 a 3 encontros por semana, a lista responde em uma tela.                   |
| **Q4** | Posso reescrever o aviso de privacidade da oração em palavras comuns, mantendo a verdade técnica (revisão rápida na PH-11)?                          | **Sim**, com o texto da Onda 1, item 1.13.                                                |
| **Q5** | Ao criar o encontro, oferecer **"Igual ao último sábado"** (copia roteiro e equipe como "aguardando")?                                               | **Sim.** É o maior ganho para o líder (26 toques para 5). Não avisa ninguém até publicar. |
| **Q6** | Tirar "Presença nos últimos 30 dias" do Início do membro e deixar só para o líder, em Relatórios?                                                    | **Sim.** Parece cobrança, e a pessoa nunca age sobre ela.                                 |
| **Q7** | Tirar os colchetes do texto do versículo na exibição (mantendo a explicação em "Sobre a tradução")?                                                  | **Sim.** Parecem erro de digitação para quem lê.                                          |

Se o dono aprovar, os itens viram decisões D62 em diante em `docs/DECISOES.md`. A Q3 (palavras "escala" e "convocação") ficou de fora de propósito: **não decidir antes de testar com 3 pessoas.**

---

## 10. Como medir

### 5 indicadores simples (por observação, sem coletar dados pessoais)

O projeto não tem telemetria de uso e não é para criar agora. Tudo é medido vendo a pessoa usar.

| #   | Indicador                                                                       | Meta                                                                      | Como medir                              |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------- |
| 1   | **Tempo para dizer "quando e onde é o próximo encontro"**, abrindo o app        | até 5 s, sem tocar e sem rolar                                            | Cronômetro, tarefa (b) e (d)            |
| 2   | **Toques e tempo para responder uma convocação**                                | até 2 toques e 10 s                                                       | Tarefa (c)                              |
| 3   | **Líder: criar o sábado e convocar a banda** (hoje cerca de 26 toques)          | até 12 toques; depois da Onda 3, até 6                                    | Tarefa (e)                              |
| 4   | **Pessoas que terminam a tarefa sem pedir ajuda**                               | 3 de 3 nas tarefas (a) a (d); 2 de 3 nas (e) a (h)                        | Contagem de pedidos de ajuda por sessão |
| 5   | **"Em uma frase, para que serve o app?"**, dita pela pessoa depois de 5 minutos | A resposta menciona encontro, aviso ou escala, sem a palavra "complicado" | Pergunta final, anotada literalmente    |

### Roteiro de teste de 15 minutos, com 3 pessoas

**Quem:** (1) um jovem de 16 a 20 anos; (2) uma voluntária de 40 a 55 anos com pouca prática em celular; (3) um líder. Não são pessoas do time. Se possível, com fonte grande ligada para a voluntária.

**Montagem:** um iPhone com a comunidade de demonstração **sem os dados de teste**, o tema escuro e o claro já carregados, tela travada em modo "sem notificações". O observador não ajuda, não aponta, não explica.

**Falas fixas** (sem pergunta indutora; todas sobre o que a pessoa **fez**, nunca sobre o que "usaria"):

| Minuto  | O que acontece                                                                                                                                          | Fala do observador                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 a 2   | Abertura                                                                                                                                                | "Não estamos testando você, estamos testando o app. Se algo for confuso, a culpa é do app. Vá falando o que está pensando."                  |
| 2 a 4   | **Tarefa (b)** com o app recém-aberto                                                                                                                   | "Você abriu o app. Me conta o que você precisa fazer neste sábado." Cronometrar.                                                             |
| 4 a 6   | **Tarefa (d)**                                                                                                                                          | "Onde é e a que horas começa?"                                                                                                               |
| 6 a 8   | **Tarefa (c)** (convocação pendente preparada)                                                                                                          | "Você foi chamada para algo. Me mostra o que você faria."                                                                                    |
| 8 a 12  | Tarefa do papel: **jovem**, (h) oração anônima; **voluntária**, (a) entrar com um código; **líder**, (e) montar o sábado e convocar a banda, depois (f) | "Mostra como você faria para..."                                                                                                             |
| 12 a 15 | Perguntas finais                                                                                                                                        | (1) "O que foi mais confuso?" (2) "Conta a última vez que você ficou sem saber algo do sábado." (3) "Em uma frase, para que serve este app?" |

**Anotar em uma folha:** onde a pessoa parou por mais de 3 segundos, qual botão tocou por engano, qual palavra leu em voz alta com dúvida (especialmente "Convocar", "Escala", "Roteiro", "Responsável", "Papel"), onde pediu ajuda, o que disse sem ser perguntada.

**Depois dos 3:** qualquer problema que **2 de 3** pessoas tiveram vira item da próxima onda, por mais que pareça pequeno. Problema de uma pessoa só é anotado e espera o próximo teste. Repetir depois da Onda 1 e de novo depois da Onda 2.

### Limite desta auditoria

Esta auditoria é de especialista, feita pelo código e pelas capturas. **Três pessoas reais valem mais do que qualquer opinião interna, inclusive esta.** Tudo que está marcado "verificar no aparelho" é hipótese até alguém testar.

---

## Evidências citadas

- **Captura do dono:** `C:\Users\Rfasg\AppData\Local\Temp\claude\774b84b711c50422\462a495d-7242-459d-a450-f0a718313a74\images\8.png` (Início atual no iPhone).
- **Capturas de apresentação:** `scripts/apresentacao/telas/` (`03` a `12`, `14` a `22`, `23`, `23b`, `24`, `25`, `26`, `27`). `01` e `02` (login e cadastro) fora do escopo.
- **Auditoria anterior:** `docs/auditorias/2026-11-15-complexidade-humana-e-ux.md` (U-01 a U-28). Ainda abertos aqui: U-18 (parcial, só 4 opções), U-22 (check-in), U-25 (alvo do segmento de 36 pt), U-17 (texto de privacidade da oração), U-06 (o "+" de Sugestões).
- **Decisões:** `docs/DECISOES.md` (D54 a D61); `docs/produto/modo-musico.md`.
- **Código lido:** `navegacao/abas.ts`, `navegacao/mais.ts`, `navegacao/BarraDeAbas.tsx`, `navegacao/CabecalhoDaComunidade.tsx`, `navegacao/SemComunidade.tsx`, `inicio/*`, `versiculo/CartaoDoVersiculo.tsx`, `comunidade/TelaComunidade.tsx`, `perfil/TelaPerfil.tsx`, `escalas/TelaEscalas.tsx`, `eventos/DetalheDoEvento.tsx`, `BarraDoEvento.tsx`, `DestaqueDoEvento.tsx`, `Convocacao.tsx`, `FolhaNovaProgramacao.tsx`, `CamposDoEvento.tsx`, `inscricoes/TelaCheckin.tsx`, `oracao/TelaNovoPedido.tsx`, `avisos/TelaNovoAviso.tsx`, `agenda/TelaAgenda.tsx`, `aoVivo/TelaAoVivo.tsx`, `entrada/ComecePorAqui.tsx`, `onboarding/CartaoDaMissao.tsx`, `repertorio/CartaoMeuRepertorio.tsx`, `ui/Segmentos.tsx`, `ui/Botao.tsx`, `ui/Texto.tsx`, `ui/Aparecer.tsx`, `ui/cor.ts`, `ui/Toast.tsx`, `packages/tokens/src/*`.

---

## O que foi feito na Onda 1 (21/11/2026)

Decisão D62 em `docs/DECISOES.md`. Respostas do dono: **Q1, Q2, Q4, Q6 e Q7 = sim**; Q3 e Q5 ficam para depois. Sem migração, sem commit e sem implantação. A tabela abaixo diz, item por item, o que mudou e onde está a prova. **Nada disto foi conferido em aparelho nem recapturado:** o script `scripts/apresentacao/telas.ts` não foi rodado (a "Regra de entrega da Onda 1" fica pendente).

| #    | Estado                      | O que foi feito                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Prova                                                           |
| ---- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1.1  | Feito                       | `ui/Acordeao.tsx` novo e reutilizável (botão de 44 pt, `aria-expanded`, rótulo "recolhido" e "aberto", entrada de 200 ms, sem animação com Reduzir movimento, escolha só na sessão). "Seu resumo" é acordeão fechado, com título "Tudo em dia" (sem seta), "1 coisa esperando você" ou "N coisas esperando você"; aberto, só as linhas com valor e com verbo ("Responder 2 convocações", "Concluir 3 tarefas", "Ver 1 pedido de substituição"), cada uma com destino. Saíram convocações aceitas, inscrições, presença de 30 dias e oração ativa. **A oração ativa só saiu:** o selo na aba Comunidade não foi feito (exigiria uma chamada nova em toda a aba). | `Acordeao.test.tsx` (6), `VisaoGeral.test.tsx`                  |
| 1.2  | Feito                       | Versículo em linha fina de 44 pt sob a saudação, com ícone, o começo do texto entre aspas e o chevron; abre em 200 ms; sem colchetes (Q7); com fonte grande (1,35 ou mais) o texto vai a 2 linhas e a referência desce; "Horário e notificação" saiu do cartão. Tela cheia `/versiculo` e atribuição da Bíblia Livre mantidas.                                                                                                                                                                                                                                                                                                                                  | `VisaoGeral.test.tsx`, `Versiculo.test.tsx`                     |
| 1.3  | Feito                       | Próximo encontro logo depois da saudação e do versículo: "Hoje", "Amanhã" ou "Em N dias", data completa, horário de começo e fim, local, linha "Você:", sem as 3 etapas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `CartaoDoProximoEvento.test.tsx`, `TelaInicio.test.tsx` (ordem) |
| 1.4  | Feito                       | Convocação pendente do mesmo encontro dentro do cartão (Aceitar, Não posso ir); a de outro encontro tem cartão próprio; a aceita vira a linha "Você: Louvor · Vocal" com "Confirmado" e o cartão some.                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `TelaInicio.test.tsx`                                           |
| 1.5  | Feito                       | Convocação pendente com 2 botões na Escalas, no Início e também no detalhe do encontro (que tinha os mesmos 3); "Pedir substituição" só depois de aceitar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `Escalas.test.tsx`, `DetalheDoEvento.test.tsx`                  |
| 1.6  | Feito                       | Perfil sem "Editar dados" no cartão; chip "Desligado" só para o administrador e o Criador (para os demais, só o "Ligado").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `TelaPerfil.test.tsx`                                           |
| 1.7  | Feito                       | "Quem conduz / Quem ajuda / Outra função" (os valores gravados seguem "responsável", "integrante" e o texto livre), "Buscar pelo nome", lista de até 50 pessoas sem "Mostrando 8 de 15", "Para o encontro inteiro" no lugar de "Encontro todo".                                                                                                                                                                                                                                                                                                                                                                                                                 | `DetalheDoEvento.test.tsx`                                      |
| 1.8  | Feito                       | Check-in: linha inteira como alvo, "Chegou" (desenho do botão em `ui/BotaoDeLinha.tsx`) que vira o chip "Presente" com marca, "Membro sem inscrição" não se repete (inscritos ganham "Inscrito"). Convocados e inscritos primeiro e contador "9 de 15" são da Onda 2 (2.10) e **não** foram feitos.                                                                                                                                                                                                                                                                                                                                                             | `TelaCheckin.test.tsx`, `telas.test.tsx`                        |
| 1.9  | Feito                       | "Nova" em Sugestões, "Exportar" em Relatórios e "Mais" nos cartões de Oração, ao lado do ícone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Sugestoes.test.tsx`, `Relatorios.test.tsx`, `Oracao.test.tsx`  |
| 1.10 | Feito                       | O chip de conexão do Ao vivo diz "Conectado".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `TelaAoVivo.test.tsx`                                           |
| 1.11 | Feito                       | `ALFA_DESABILITADO` de 0,4 para 0,5 (cerca de 4,6:1, pelo cálculo da seção 7.1, **não remedido**).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `EstadosDosControles.test.tsx`                                  |
| 1.12 | Nada a fazer no repositório | "QA offline 13089" e "QA d'Ávila 63630" não estão em `semear.ts`, na demonstração nem nos scripts: vieram de testes manuais gravados no banco da homologação. Não mexi em banco. Para limpar, o dono (ou um agente autorizado) apaga esses avisos pela tela de Avisos.                                                                                                                                                                                                                                                                                                                                                                                          | Busca no repositório sem resultado                              |
| 1.13 | Feito                       | Aviso de privacidade do novo pedido: "Só quem você escolher vê o pedido. Ele é guardado em código, mas quem cuida do servidor consegue lê-lo, se precisar. Evite nomes e doenças de outras pessoas sem a permissão delas." mais "Entenda como é guardado". A substância legal (cifrado, sem ponta a ponta, quem administra o servidor tem capacidade de ler) foi mantida. **Revisão jurídica do texto novo na PH-11.**                                                                                                                                                                                                                                          | `OracaoAnonima.test.tsx`                                        |
| 1.14 | Feito                       | O interruptor de anonimato diz uma frase só, a do estado atual, e só aparece quando mais alguém pode ler o pedido ("Somente eu" o esconde; ligar o anonimato e voltar para "Somente eu" envia `anonimo: false`).                                                                                                                                                                                                                                                                                                                                                                                                                                                | `OracaoAnonima.test.tsx`                                        |

Além da tabela, por decisão do dono ("faz tudo") e do que a Onda 2 trazia:

- **Início do líder sem seletor (2.1, Q1):** o resumo ganha "Para você" e "Da organização"; saem "Próximos 14 dias" e "Números da comunidade". Quando o líder não tem pendência, o resumo diz "Tudo em dia" mas **ainda abre**, só com a linha "Ver os números e relatórios" (que não conta no título). Esta é uma interpretação minha do documento, que pedia "Tudo em dia" sem seta só para o membro.
- **Botão do cartão por estado (2.9):** função pura `acoesDoCartao`, testada linha a linha. "Inscrever-me" leva à tela do encontro (a inscrição tem vaga, espera e QR, e fica lá).
- **Modo músico (2.3b):** o cartão "Meu repertório" do Início saiu; "Abrir o repertório" é botão do cartão do encontro; o atalho "Louvor" da Comunidade só aparece para quem foi convocado ao louvor ou organiza; "Louvor" e "Conteúdos" deixaram de dizer "músicas" nos dois.
- **"Primeiros passos" (2.13):** só para quem organiza e só depois do primeiro encontro criado.
- **Agenda (2.5, Q2, Q6):** abre em Lista, o Calendário é secundário e só tem o mês; `VistaDaSemana.tsx` foi apagada. A busca só com mais de 10 encontros e "Rascunhos" só para o líder **não** foram feitos.
- **Segmentos (3.3, A1, A4):** com fonte grande, 2 e 3 opções empilham (4 opções ainda tentam a grade); o alvo do segmento completa 44 pt com `hitSlop`. **Não** foi feito o contorno da pílula de filtro a 3:1 (3.5).
- **Texto (A2, parcial):** `legenda` de 13 para 14 pt e `chip` de 12 para 13 pt em `packages/tokens/src/index.ts`. `corpo` e `meta` continuam em 15 e o rótulo de aba em 11 (Onda 3).
- **Vocabulário:** nada de "escala" e "convocação" foi trocado (Q3).

### Resultado da verificação (21/11/2026)

- Prettier, ESLint e tipos de todo o repositório passam; o Prettier só aponta os dois documentos `docs/design/login-v2-*.md`, do outro agente que refaz a entrada. **Testes da API e dos pacotes: 56 arquivos e 762 testes passam** (Postgres real).
- **Testes do app: 78 suítes e 684 testes passam, nenhum teste falha; 3 suítes não carregam** (`BarraDaPilha`, `ErroDeRota` e `LinkDoCodigo`), porque `FundoAurora.tsx`, do outro agente, chama `Easing.bezier` e o dublê do Reanimated em `jest.setup.ts` ainda não o tem. Não consertei: os arquivos são dele. Meus testes novos ou reescritos: `Acordeao` (6), `CartaoDoProximoEvento` (22), `VisaoGeral` (21), `TelaInicio` (20 com "Primeiros passos"), `MeuRepertorioNoInicio` (7), mais casos em `Escalas`, `Agenda`, `Equipe`, `DetalheDoEvento`, `TelaPerfil`, `TelaCheckin`, `OracaoAnonima`, `Segmentos`, `Relatorios`, `Sugestoes` e `Oracao`.
- **Fumaça da web (`npm run fumaca:web`):** passa em entrar, entrar por e-mail, recuperar senha e abrir Criar conta; **falha depois, no preenchimento do cadastro**, que é a tela do outro agente. A exportação web compila com as minhas mudanças.
