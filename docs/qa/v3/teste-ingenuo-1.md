# Teste ingênuo 1 (22/11/2026)

Quem testou: papel de uma pessoa de 60 anos, pouca prática com celular, no app como administradora. Celular 390x844, tema escuro, prévia local com dados fictícios (porta 8090), Chromium. Sem ler código, docs ou testes. Capturas em `docs/qa/v3/ingenuo-1/`.

Limites do teste (para ninguém superestimar o resultado):

- Quem testa é um robô: eu achei botões por nome acessível, não por olho. Onde o robô tocou algo que uma pessoa poderia não ver, está dito.
- A conta de teste do admin se chama Ana Ribeiro. Então "chamar a Ana" é chamar a si mesma. Uma pessoa real estranharia.
- A data de hoje na prévia é domingo 22/11/2026, então "este sábado" e "próximo sábado" são o mesmo dia: 28/11. Já existiam "Sábado Jovem" 16h e "Noite de jogos" 19h30 nesse dia.
- Fechei o navegador algumas vezes cedo demais (ver confusão 4). Isso deixou rascunhos soltos e perdeu duas ações. Os números de rascunhos (17 para 22) vêm daí, em parte.
- Missão 9 parou no último passo, sem confirmar. Nenhum erro técnico de página apareceu durante o teste.

## Tabela das 10 missões

| #   | Missão                                        | Conseguiu?              | Toques                                   | Telas | Clareza (0 a 5) |
| --- | --------------------------------------------- | ----------------------- | ---------------------------------------- | ----- | --------------- |
| 1   | Ver o que tem no sábado e quem vai            | Sim                     | 1 (Início, "Ver convocados")             | 2     | 4               |
| 2   | Marcar encontro no próximo sábado, 16h, salão | Sim, com ressalvas      | 7 a 8 + espera de 20 s                   | 3     | 2               |
| 3   | Chamar Ana e Bruno para ajudar                | Sim                     | 5 (pelo Início) a 7 (pela Agenda) + 20 s | 3     | 2               |
| 4   | Ana no violão e Bruno na bateria              | Sim, com muito esforço  | cerca de 12 a 14                         | 4     | 2               |
| 5   | Ver músicas e quem toca                       | Sim                     | 2 (ou 3 por Comunidade, Louvor)          | 2     | 4               |
| 6   | Ver quem não respondeu e lembrar              | Sim                     | 1                                        | 1     | 5               |
| 7   | Aceitar ou dizer que não posso                | Sim                     | 1 (mais rolar a tela)                    | 1     | 3               |
| 8   | Marcar quem chegou                            | Sim                     | 4 (cartão, Mais, Check-in, Chegou)       | 3     | 4               |
| 9   | Cancelar o encontro (parei antes do fim)      | Sim, até o último passo | 4                                        | 3     | 4               |
| 10  | Escrever aviso para todos                     | Sim                     | 3 + digitar + 20 s                       | 3     | 5               |

## Missão por missão

Legenda: (a) esperava, (b) aconteceu, (c) toques e telas, (d) onde hesitei, (e) palavras que não entendi, (f) certeza no fim, (g) rótulo versus destino.

**1. O que tem no sábado e quem vai**

- (a) O cartão grande do Início ia mostrar o sábado. (b) Mostra "Sábado Jovem", 16h, "6 de 10 responderam". "Ver convocados" abre a lista com Aceitou, Aguardando, Pediu troca. (c) 1 toque, 2 telas. Por "Agenda" são 2 toques.
- (d) O Início mostra só um encontro, mas a Agenda mostra dois no sábado (também "Noite de jogos", 19h30). Quem olha só o Início não fica sabendo da noite de jogos. (e) "convocados" (eu diria "chamados"), "Pediu troca", "Aguardando". (f) Sim, a lista é clara. (g) "Ver convocados" leva ao que promete. Captura 17.

**2. Marcar encontro no próximo sábado, 16h, salão**

- (a) "Novo encontro" ia pedir data, hora e lugar. (b) Abre uma folha com 4 jeitos. Peguei o "Recomendado: Igual ao último sábado". Ele propõe 17 de abril de 2027 (!) como data e só oferece mais abril e maio. O 28/11 só aparece em "Outra data", que fica escondida do lado direito da fileira de datas. Ao tocar, a fileira "pula" e a data muda sozinha para outra. Digitei 28/11. Não houve nenhum aviso de que já havia dois encontros naquele sábado. Toquei "Publicar e avisar 9 pessoas". Ficou 20 s com "Publicando e avisando 9 pessoas" e um "Desfazer" contando, enquanto o topo da tela seguia dizendo "RASCUNHO · NINGUÉM FOI AVISADO" e o botão já dizia "Publicado". Depois de 20 s a tela mudou sozinha para o encontro novo, sem mensagem final de sucesso. O encontro novo veio "Aberto ao público" sem eu escolher isso.
- (c) 7 a 8 toques, 3 telas. Desistiria na hora da data: a pessoa de 60 anos aceitaria "17 de abr." e avisaria 9 pessoas para o encontro errado.
- (d) Data escondida, fileira que pula, sem aviso de choque de horário. (e) "Rascunho", "Publicar e avisar", "Roteiro: 7 etapas", "Banda e equipe". (f) Não: o topo contradiz o botão e não há "pronto, avisamos 9 pessoas". (g) "Igual ao último sábado" não é igual a nada que eu vi (o último sábado foi 21/11, mas a data sugerida é abril). Capturas 01, 02, 03, 04.

**3. Chamar Ana e Bruno para ajudar**

- (a) Um botão "Chamar pessoas". (b) Em "Convocados", o botão de baixo "Convocar pessoas" abre uma folha com DUAS fileiras de botões: de um lado as etapas (Encontro inteiro, Boas-vindas, Louvor...), do outro "Quem conduz / Quem ajuda / Outra função". Já vinha marcado "Encontro inteiro" e "Quem ajuda", o que acertou. Marquei Ana e Bruno e toquei "Convocar 2 pessoas". Bruno já era coordenador do encontro inteiro e a folha deixou marcar de novo. Resultado: Bruno apareceu 3 vezes na mesma caixa ("Coordenação", "integrante", "integrante"), e Ana como "integrante" em minúsculo. O texto do resumo dizia "Lembrar os 10" e o botão "Lembrar os 9".
- (c) 5 a 7 toques, 3 telas. (d) Qual das duas fileiras mexer primeiro. Sem aviso de que Bruno já estava. (e) "Convocar", "Quem conduz", "integrante". (f) Mais ou menos: o aviso "2 pessoas convocadas" aparece por poucos segundos; a posição na tela já tinha rolado e eu não vi onde a Ana entrou. (g) "Convocar pessoas" leva ao que promete. Capturas 05 e 06.
- Atenção: se eu fechava o app antes dos 20 s da contagem, a convocação sumia sem aviso (ver confusão 4).

**4. Ana no violão e Bruno na bateria**

- (a) Tocar em "Bateria", escolher Bruno, tocar em "Violão", escolher Ana. (b) Há "Convocar para Bateria" (porque estava vazia) e nenhum botão para o Violão (já tinha gente). Abri "Convocar para Bateria", marquei Bruno, e troquei para o botão "Violão" para marcar Ana na mesma folha. O título da folha continuou "Convocar para Bateria", e Bruno continuou marcado, agora como "Já convocado: Louvor (violão)": um toque no botão azul final poria os dois no violão. Voltei, convoquei Bruno na bateria sozinho, depois abri "Convocar" do cabeçalho "Louvor" (aí a folha diz "Escolha a função na banda para ver quem convocar") e coloquei Ana no violão. O Bruno ainda estava no violão: para tirar, toquei no nome dele (abre "Tirar da convocação"), toquei no botão, e ainda veio uma pergunta de confirmação "Tirar Bruno Tavares da convocação?".
- (c) 12 a 14 toques, 4 telas e folhas. Desistiria na primeira folha, quando o título dizia "Bateria" e eu estava no "Violão".
- (d) Título que não muda, seleção que acompanha de uma função para outra, falta de botão onde já existe gente, "tirar" escondido atrás do nome. (e) "Convocar" (eu queria "colocar"), "Convocação", "Falta: vocal, violão, teclado, bateria, projeção" ao lado de pessoas já listadas.
- **Chamar de novo?** Não ficou claro. O app trata "colocar no louvor" e "chamar" como a mesma coisa (convoca e manda aviso depois de 10 s, ou 20 s, o texto diz dois números). A folha diz "As pessoas só são avisadas depois de 10 segundos", mas a faixa de baixo conta 20 s. Quem foi "chamado para ajudar" antes (missão 3) e depois "colocado no violão" aparece em duas linhas. Nada diz "Ana já está convidada, só vou dar a função".
- (f) Só no fim, olhando a lista de "Violão · 1: Ana" e "Bateria · 1: Bruno". (g) Capturas 07, 08, 18.

**5. Músicas do sábado e quem toca**

- (a) Um botão de música. (b) No cartão do Início existe "Louvor: 3 músicas" mas não é um botão. Entrei no encontro e, rolando, achei "REPERTÓRIO DO LOUVOR: 3 músicas, Ver repertório". Abre a lista (Canção de abertura, Canção de encerramento, Castelo Forte) com a banda embaixo: quem aceitou, quem falta. Outro caminho: Comunidade, "Louvor", que mostra a mesma banda.
- (c) 2 toques + rolar, 2 telas. (d) O "Louvor: 3 músicas" do Início parece clicável e não é. No encontro novo, o repertório vem vazio ("Montar repertório"). (e) "Tom G", "Tom + / Tom −", "cifra", "Equipe de louvor", "andamento", "Avisar a banda". (f) Sim. (g) "Ver repertório" leva ao repertório. Captura 16.

**6. Quem não respondeu e lembrar**

- (a) Um botão "Lembrar". (b) Está no Início: "Faltam: Júlia, Bruno, Diana e Larissa", botão "Lembrar os 4". Um toque: vira "Enviando em 19 s" com "Desfazer"; ao fim, "Lembrete enviado" e "Você lembrou Júlia, Bruno, Diana, Larissa e mais 1, hoje às 11:07".
- (c) 1 toque, 1 tela. (d) Nenhuma. O "e mais 1" não diz quem é. (e) "Faltam" é claro. (f) Sim, a melhor missão. (g) Exato. Depois do envio o botão grande vira "Convocar projeção", sem dizer por quê. Captura 14 e 13.

**7. Aceitar ou dizer que não posso**

- (a) Dois botões grandes. (b) Existem: no Início, "PARA RESPONDER (2)", com "Não posso ir" e "Aceitar". Os dois cartões têm o título "integrante" (minúsculo) e "Louvor · Violão", ambos "Sáb., 28 de nov. · Sábado Jovem". Aceitei o primeiro: "Que bom ter você em Integrante." e "Você está em Integrante, sábado 28." "Não posso ir" é imediato, sem pedir motivo. O número no cartão grande subiu para "7 de 11" só depois dos 20 s.
- (c) 1 toque + rolar, 1 tela. (d) Dois cartões do mesmo encontro, sem nome claro de qual é qual (o "Sábado Jovem" duplicado da missão 2). O papel "integrante" aparece como se fosse o título do cartão. (e) "integrante", "Pediu troca" (do lado de quem organiza). (f) Em parte: o aviso some em segundos e o cartão do outro encontro continua na tela. (g) Rótulos corretos. Capturas 09 e 13.

**8. Marcar quem chegou**

- (a) Um botão "Presença" ou "Chegada". (b) Não está na tela do encontro. Está atrás do botão "Mais" (rodapé, "Mais ações"), na lista: Editar, Copiar, Compartilhar, Salvar como modelo, Conduzir ao vivo, Inscrições, **Check-in**, Encerrar, Cancelar ou adiar. Abre "0 de 15 presentes" com uma linha por pessoa e botão "Chegou". Ao tocar: "Presente" em verde, "1 de 15 presentes" e "Presença de Bruno Tavares registrada. Desfazer".
- (c) 4 toques (cartão, Mais, Check-in, Chegou), 3 telas. (d) Hesitei entre "Conduzir ao vivo", "Inscrições" e "Check-in". Funciona 6 dias antes do sábado e ninguém avisou "o encontro é só dia 28". (e) "Check-in" (eu diria "Presença"), "Ler QR", "Convocados e inscritos". "Chegou" parece etiqueta, não botão. (f) Sim, a mudança é visível. (g) "Marcar todos que aceitaram" faz o que diz. Captura 10.

**9. Cancelar o encontro de sábado (parei no último passo)**

- (a) "Cancelar encontro". (b) "Mais", "Cancelar ou adiar" abre numa folha com duas abas, mas já em **Adiar** (botão grande "Adiar o encontro"). Troquei para a aba "Cancelar": faixa amarela "Isto não se desfaz. Vai cancelar Sábado Jovem. Vai avisar 11 pessoas convocadas e quem se inscreveu. Um encontro cancelado não volta a ser publicado.", caixa "Motivo" e botão salmão "Cancelar o encontro". Parei aqui. A promessa do botão é clara: avisa 11 pessoas, sem volta.
- (c) 4 toques, 3 telas. (d) A aba abre em "Adiar", que é o mais seguro, mas quem quer cancelar toca no botão grande da frente achando que cancelou. Na aba Adiar, o texto dava 10 s para desfazer; na aba Cancelar diz que não se desfaz. (e) "Adiar" (entendi), "Motivo". (f) Teria certeza se confirmasse: o botão diz o que faz. (g) Rótulo igual ao destino. Capturas 11 e 12.

**10. Aviso para todo mundo**

- (a) Um botão "Novo aviso". (b) Em Comunidade, no topo, "Novo aviso". Título, texto, botão "Publicar e avisar 14 pessoas". Se tocar vazio, mostra "Dê um título ao aviso" e "Escreva o aviso". Depois de publicar, 20 s com "Publicando…" e "Desfazer", e então volta a Comunidade com "Publicado. 14 pessoas avisadas.", que dura poucos segundos. O aviso novo não aparece na lista de Comunidade (só o fixado); o contador sobe de 6 para 7.
- (c) 3 toques + digitar, 3 telas. (d) Nenhuma séria. Os 20 s parados na tela do formulário dão a sensação de que travou. (e) Nada. (f) Sim, mas por pouco tempo na tela. (g) Exato. Captura 15.

## Os 10 piores momentos de confusão

| #   | Momento                                                                            | Captura | Causa provável (em linguagem de gente)                                                                                                                               |
| --- | ---------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Novo encontro "Igual ao último sábado" propõe abril de 2027 e esconde "Outra data" | 01, 02  | O app procura o primeiro sábado livre e pulou meses de rascunhos. A opção da data certa está do lado, fora da tela.                                                  |
| 2   | Cria encontro em dia que já tem dois, sem avisar                                   | 03      | Ninguém confere choque de horário no mesmo lugar. A Agenda fica com quatro "Sábado Jovem" iguais no mesmo dia.                                                       |
| 3   | Publicar: topo diz "RASCUNHO", botão diz "Publicado", e passam 20 s sem nada       | 04      | O texto do topo não atualiza durante a espera. A tela só muda sozinha no fim e sem mensagem de "pronto".                                                             |
| 4   | O "Desfazer" de 20 s: se sair do app antes, a ação some sem aviso                  | 06      | A ação só vale depois da contagem. Fechar o app cedo cancela em silêncio. Vi acontecer com convocação e com publicação. Texto da folha diz 10 s, a faixa conta 20 s. |
| 5   | Convocar pessoas: duas fileiras de botões e Bruno entra 3 vezes                    | 05, 06  | O app deixa convocar de novo quem já está, em outra função, e mostra tudo em lista. Ninguém avisa "Bruno já está".                                                   |
| 6   | Título "Convocar para Bateria" com o botão "Violão" marcado e Bruno ainda marcado  | 07      | O título da folha e as marcas não acompanham a troca de função. Um toque a mais poria Bruno também no violão.                                                        |
| 7   | Violão sem botão de "Convocar" e "Tirar da convocação" escondido atrás do nome     | 08, 18  | Só linhas vazias ganham botão. Quem já está só dá para mexer tocando no nome.                                                                                        |
| 8   | Dois cartões "Para responder" com título "integrante" em minúsculo                 | 09      | O cartão usa a função como título e o nome do encontro fica pequeno. Com dois encontros no mesmo sábado, não dá para distinguir.                                     |
| 9   | Check-in atrás de "Mais", entre 9 opções, e "Chegou" parece etiqueta               | 10      | O botão de uso mais frequente no dia do encontro não está na frente. Hoje só o dono de rotina sabe onde fica.                                                        |
| 10  | "Cancelar ou adiar" abre em Adiar                                                  | 11, 12  | Escolha deliberada pelo lado seguro, mas quem quer cancelar toca o botão grande sem ler a aba.                                                                       |

## Padrões que se repetem

- **Contagem de 20 s em quase toda ação** (publicar, convocar, lembrar, aceitar, aviso). Bom para desfazer, ruim para quem fecha o app logo depois: perde a ação. A tela também não repete o resultado no fim. O texto fala em 10 s em alguns lugares e 20 s em outros.
- **Palavra "Convocar" para tudo** (chamar, colocar na banda, dar função). A pessoa quer "chamar" ou "colocar", o app só diz "convocar", e o mesmo nome entra de novo em outra função.
- **Jargão**: convocados, check-in, integrante, roteiro, repertório, tom, cifra, projeção (aqui é o telão, não previsão), "Pediu troca", "rascunho", "Aberto ao público".
- **Dois encontros no mesmo dia** deixam o Início, a Agenda e "Para responder" ambíguos. A causa foi a missão 2, mas qualquer organizador pode cair nisso.
- **Folha com marcas que sobrevivem à troca de aba** (convocar). O título não acompanha.
- **Botão escondido**: Check-in, Cancelar, Tirar da convocação, "Outra data".
- **O que está bom**: Lembrar (missão 6), Novo aviso (10) e o aviso de "Isto não se desfaz" (9). Verbo no botão, número de pessoas avisadas, resultado escrito.

## O que uma pessoa sem ajuda conseguiria

- **Sozinha, sem tropeço**: ver o sábado e quem vai (1), lembrar quem não respondeu (6), escrever aviso (10), aceitar ou recusar (7), ver as músicas (5), chegar até o último passo do cancelamento (9).
- **Sozinha, mas com risco**: marcar o encontro (2): o caminho mais fácil leva à data errada de abril e avisa 9 pessoas. Marcar presença (8): acharia pelo "Mais", demoraria.
- **Dificilmente sem ajuda**: chamar Ana e Bruno (3) e colocar um no violão e outro na bateria (4). Teria desistido ou feito errado.

## Sobras do teste na prévia (dados fictícios, banco local)

- Encontro de 28/11 duplicado e publicado, dois rascunhos soltos em 28/11, vários rascunhos soltos em outras datas.
- Ana convocada nos dois encontros de 28/11; Bruno no encontro duplicado: bateria e coordenação.
- Check-in de Bruno marcado como presente; Ana aceitou o convite do encontro original; Aviso "Lembrete do sábado" publicado; lembrete enviado.
- O cancelamento NÃO foi confirmado.
- A prévia, o banco, a API e o navegador foram encerrados ao fim.
