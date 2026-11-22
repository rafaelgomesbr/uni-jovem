# App v3: redesenho de experiência de ponta a ponta

Data: 22/11/2026. Branch `release`, depois do commit `cd7760b`. Leitor: o dono. Este documento é a base de estrutura, texto, comportamento e movimento para as três direções visuais: elas desenham em cima dele e não mudam a ordem dos blocos, os textos nem os estados.

Pedido do dono (22/11/2026): "propostas de melhoria reais do app que já temos: facilidades de usabilidade, UX, animation, motion, o app mais fácil de mexer, mais bonito, design completo e bem pensado e estruturado de ponta a ponta."

## Como este documento foi feito (e o que ficou de fora)

- **Li:** as auditorias de 15/11 e 21/11/2026, `login-v2-ux.md`, `login-v2-ui-motion.md`, `controles-v2.md`, `especificacao-e-roadmap.md`, `modo-musico.md`, as decisões D54 a D64, 27 capturas de `scripts/apresentacao/telas/`, as rotas de `apps/app/src/app` (91 arquivos, 4 estruturais, 87 telas), `navegacao/abas.ts`, `navegacao/mais.ts`, o layout da pilha, `package.json` e os tokens de movimento.
- **Capturas antigas:** `03-inicio` e `23-inicio-membro` são anteriores à Onda 1 (D62). O Início real hoje já tem versículo em linha fina, resumo em acordeão e o cartão do encontro com "Você:". Onde a captura e o código divergem, vale o código.
- **Não rodei o app, o VoiceOver nem o TalkBack.** O que digo sobre leitor de tela e fonte grande é desenho, e está marcado "verificar no aparelho" onde depende de teste real.
- **Toques:** um toque é uma ação física. Digitar conta como "campo", à parte. Os números "antes" dos fluxos (a) a (h) vêm da auditoria de 21/11/2026 (contados pelo código). Os de (i) e (j) e todos os "depois" são estimativas do desenho, não medidas.
- **Login e cadastro:** fora do escopo (D63). Só trato do que vem depois da entrada e do ponto em que os dois se encontram.
- **Revisto em 22/11/2026 (D73):** o repertório e a banda são de toda a comunidade (o Louvor, o botão "Ver o repertório" e o Repertório do encontro em leitura valem para todos), e o bloqueio "Já convocado" vale só para a mesma combinação de bloco e função. Onde este documento ainda diz "só quem toca ou organiza" ou mostra "Você não está no louvor", vale a D73.
- **Estado das ondas da auditoria de 21/11:** Onda 1 feita (D62). Da Onda 2 estão feitos 2.1 (sem seletor no Início do líder), 2.3b (Louvor só de quem toca), 2.5 (Agenda em Lista, parcial), 2.9 (botão do cartão por estado) e 2.13 (Primeiros passos só do líder). Os demais itens das Ondas 2 e 3 (2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 2.10, 2.11, 2.12, 3.1 a 3.10) não foram feitos e entram aqui, redesenhados, na seção 10.
- **Formatação:** não havia terminal nesta sessão. Rodar `npx prettier --write docs/design/app-v3-ux.md` antes de commitar (as tabelas precisam de alinhamento).

---

## 1. Visão e princípios

### Visão em 15 linhas

1. Hoje o Uni Jovem é um app completo, organizado por **módulos** (Agenda, Escalas, Comunidade, Perfil, 87 telas). Pessoas não pensam em módulos. Pensam em perguntas: "quando é?", "me chamaram?", "quem falta?", "o que eu toco?".
2. A v3 reorganiza tudo em três verbos: **ver** (quando e onde), **responder** (aceitar ou não) e **fazer** (chegar, conduzir, tocar).
3. O app deixa de ser um menu e passa a ser um **assistente do sábado**: o Início muda conforme o relógio (longe, véspera, no dia, acontecendo, depois) e sempre oferece a única ação que faz sentido agora.
4. Quatro abas em vez de cinco: **Início, Agenda, Comunidade, Perfil**. "Escalas" deixa de ser uma aba: o que ela fazia vira a linha "Sua parte" em todo lugar onde há um encontro.
5. A palavra "escala" sai da interface. "Convocar" (palavra do dono) e "Sua parte" ficam.
6. O membro vê pouco: o próximo encontro, o que precisa responder e o aviso fixado. O líder vê o mesmo mais **o que falta resolver**, e o resto da organização fica dobrado.
7. Nada frequente fica a mais de 2 toques do Início. Montar o sábado e convocar a banda cai de cerca de 26 toques para 4 (Agenda) ou 2 (pelo Início), com "Igual ao último sábado".
8. "Tem certeza?" vira **Desfazer**. Quando uma ação avisa outras pessoas, o aviso espera 10 segundos e dá para desistir.
9. Todo estado vazio ensina e tem uma ação. Todo erro diz o que aconteceu e o que fazer. Toda lista que carrega tem esqueleto da forma final.
10. O movimento tem trabalho a fazer: mostra de onde veio a coisa, confirma que a ação valeu e, raramente, encanta. A marca é um sol nascendo; ele aparece em 5 momentos raros, nunca como decoração.
11. A acessibilidade não é uma camada: alvos de 44 pt, nada essencial em gesto, cor nunca sozinha, fonte grande sem perder botão, ação por gesto sempre com botão equivalente e ação alternativa para leitor de tela.
12. A estrutura não muda com o visual: as três direções visuais escolhem forma, cor, ilustração e ritmo. A ordem dos blocos, os textos e os estados deste documento são o contrato.
13. Não se mexe no que está bom (seção 9): Aurora, rótulo visível, motivo do botão desabilitado, isolamento entre comunidades, offline, permissões.
14. Quase tudo é app: poucas coisas exigem API nova (seção 10), e nenhuma exige migração de banco nas fases 1 e 2.
15. A decisão mais séria é tirar uma aba. É reversível em um dia (a rota continua existindo) e tem um teste de 15 minutos para confirmar.

### Os 6 princípios

| #   | Princípio                                                | Em uma frase                                                                                                          | Teste de bolso                                                                   |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| P1  | **Uma tela, uma pergunta**                               | Cada tela responde a uma pergunta que a pessoa já tinha antes de abri-la, e o título diz qual.                        | Dá para dizer a pergunta da tela em 6 palavras?                                  |
| P2  | **O app te leva até o que você precisa fazer agora**     | O relógio e o seu papel decidem o que está no alto do Início e qual é o botão grande.                                 | Na véspera, o botão grande continua sendo "Ver o encontro"? Então errou.         |
| P3  | **Complexidade só para quem lidera, e só quando pedida** | Ferramenta de organização nasce dobrada ("Mais opções", "Organização") e aparece no contexto em que serve.            | O membro novo vê algum termo de organizador na primeira tela? Então errou.       |
| P4  | **Um primário por tela, e ele diz o que vai acontecer**  | O botão grande tem verbo e consequência: "Publicar e avisar 5 pessoas", não "Enviar".                                 | Dá para saber quem será avisado só lendo o botão?                                |
| P5  | **Desfazer em vez de "tem certeza?"**                    | Confirmação vira reflexo em duas semanas. Desfazer protege de verdade e não atrasa quem acertou.                      | Quantos diálogos "Tem certeza?" restaram? Só os de perda definitiva (seção 5.1). |
| P6  | **Nada importante depende de gesto, cor ou memória**     | Gesto é atalho com botão equivalente. Cor vem com texto ou forma. O que a pessoa precisa está na tela, não na cabeça. | Dá para fazer tudo com leitor de tela, fonte grande e sem ver cor?               |

### O que a pessoa sente ao abrir o app

| Quem                                        | O que vê em 3 segundos                                                                                               | O que sente                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Membro** (Lucas, 17)                      | "Em 5 dias. Sábado Jovem, 28 de nov., 16:00, Salão da igreja." e "Como chegar".                                      | "Já sei. Fecho." Sem rolar, sem tocar.           |
| **Voluntária convocada** (Regina, 45)       | O mesmo cartão com "Aguardando sua resposta" e dois botões grandes: Aceitar, Não posso ir.                           | "Me chamaram e eu resolvo aqui." Um toque, some. |
| **Músico**                                  | "Sua parte: Louvor · Violão" e o botão "Abrir o repertório".                                                         | "É o meu sábado, na minha ordem, no meu tom."    |
| **Organizador** (Daniel, 32)                | "9 de 11 responderam. Faltam Bruno e Camila. Falta: bateria." com "Lembrar os 2".                                    | "O app já viu o que falta. Eu só decido."        |
| **Administrador**                           | O mesmo do organizador, mais um número em "Seu resumo" quando há pedido de entrada.                                  | "Nada me persegue; o que importa me procura."    |
| **Criador** (dono da plataforma)            | O Início de quem ele é na comunidade. A Plataforma fica em Perfil, para ele só.                                      | "A ferramenta de dono não atrapalha o app."      |
| **Visitante sem comunidade** (Bia, 19)      | Uma pergunta: "Você recebeu um código ou um link?" e um botão. Nada de três cartões.                                 | "Sei o que fazer em 5 segundos."                 |
| **Quem usa fonte grande** (Seu Antônio, 68) | Menos blocos, mais respiro, botão que não sai da tela e a frase "Sábado, 16h, Salão da igreja. Você está no louvor." | "Consigo sem pedir ajuda."                       |

---

## 2. Arquitetura de informação nova

### 2.1 O que está errado na estrutura de hoje

1. **As abas são módulos, não perguntas.** Agenda, Escalas, Comunidade e Perfil dizem de onde o dado vem, não o que a pessoa quer.
2. **Escalas faz quatro coisas** (minhas convocações, pedidos de substituição dos outros, disponibilidade e, para o líder, "aguardando resposta"). A mesma convocação pendente aparece no Início, na Escalas e no encontro.
3. **A palavra "escala" tem cinco papéis:** nome da aba, nome da lista, nome do item, preferência de notificação e verbo no código. "Convocação", "convocar", "convocado" somam mais três.
4. **Comunidade mistura quatro verbos** (ler avisos, rezar, sugerir, administrar) e até 18 alvos para o líder. A tela é um menu de links, sem nada vivo.
5. **Três telas para "tenho um código"** (`colar-convite`, `tenho-um-codigo`, `entrar-com-convite`) e quatro telas de segurança (`conta/seguranca`, `ativar-2fa`, `aparelhos`, mais o chip no Perfil).
6. **O encontro tem 4 abas para todos**, inclusive para quem só quer o horário.
7. **Há 87 telas.** A pessoa média usa 10.

### 2.2 As quatro abas

```
 [ Início ]   [ Agenda ]   [ Comunidade ]   [ Perfil ]
   casa         calendário     pessoas         avatar
```

| Aba            | A pergunta que responde                           | O que entra                                                                                                                                                                                                                 | O que sai                                                                                                                                                       |
| -------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Início**     | "O que eu faço agora?"                            | Cartão do momento (próximo encontro, com a sua parte e o botão certo), "Para responder", "Seu resumo", aviso fixado, versículo em linha fina.                                                                               | Seletores, cartões de ferramenta, "Primeiros passos" para quem não organiza, qualquer número que não pede ação.                                                 |
| **Agenda**     | "Quando é? O que vem aí? Qual é a minha parte?"   | Lista de encontros por semana com "Você:" em cada linha, resposta direto na linha, filtro "Todos / Só o que é meu", pedidos de ajuda dos outros, Calendário em folha (com "Dias em que posso ajudar").                      | A aba Escalas inteira. "Semana". Busca (só com mais de 10). A antiga "Linha do tempo do dia".                                                                   |
| **Comunidade** | "O que está acontecendo com a gente? Quem somos?" | Avisos (o fixado já à vista), Pedidos de oração, Pessoas, ações rápidas ("Pedir oração", "Sugerir uma ideia"; líder: "Novo aviso", "Convidar"), "Mais" (Biblioteca, Louvor, Sugestões), "Organização" dobrada para o líder. | "Sair da comunidade" (vai para Perfil), a legenda "Você é Administrador" como assunto principal, as três abas Pessoas/Pedidos/Convites.                         |
| **Perfil**     | "Quem sou eu aqui e como o app me trata?"         | Cartão da pessoa, Notificações, Segurança, Privacidade e dados, Comunidades (trocar, entrar, criar, sair), Ajuda, Sair.                                                                                                     | Versículo do dia (vai para Notificações), Bloqueados e Denunciar (vão para Privacidade), "Uso sem internet" (abre pelo status do cabeçalho), 17 linhas viram 6. |

**Fora das abas, sempre no cabeçalho** (como hoje): a pílula da comunidade (trocar) e o sino (novidades). O sino é o **único lugar de "tem novidade"**: nenhuma aba ganha bolinha ou número. Menos sinais, mais confiança no sinal que existe.

**Por que tirar a aba Escalas, e o que a seguraria:**

- Ela não responde a uma pergunta de pessoa: responde a um módulo. A pergunta real ("me chamaram?") é respondida no Início (sem tocar) e na Agenda (com a resposta na linha).
- Libera espaço: com 4 abas o rótulo de cada uma cabe melhor com fonte grande (a auditoria de 21/11 achou que, com fonte grande, as abas perdem o texto, A5).
- **O que a seguraria:** se no teste (seção 10.5) 2 de 3 pessoas tocarem a aba errada ao procurar "minha parte", a aba volta com o nome "Minha parte" (a rota `/escalas` continua existindo como redirecionamento durante a fase 1). Decisão do dono (Q1).

### 2.3 Profundidade máxima e atalhos

**Regra:** tudo que a pessoa faz toda semana fica a no máximo **2 toques do Início** (contando o toque na aba, mas não o toque no sino). Tudo que a liderança faz uma vez por mês pode chegar a 4.

| Tarefa frequente                  | Quem                 | Toques a partir do Início | Caminho                                                          |
| --------------------------------- | -------------------- | ------------------------- | ---------------------------------------------------------------- |
| Saber quando e onde é             | Todos                | 0                         | Cartão do momento                                                |
| Aceitar ou recusar a convocação   | Convocado            | 1                         | Botão no cartão ou na linha                                      |
| Como chegar                       | Todos                | 1                         | "Como chegar" no cartão (abre o mapa)                            |
| Ver o roteiro                     | Todos                | 1                         | Toque no cartão                                                  |
| Abrir a cifra                     | Músico               | 2                         | "Abrir o repertório", depois a música                            |
| Ler o último aviso                | Todos                | 1                         | Linha "Aviso fixado" (ou Comunidade, 2)                          |
| Pedir oração                      | Todos                | 2                         | Comunidade, "Pedir oração"                                       |
| Fazer check-in                    | Organizador          | 1                         | "Fazer check-in" no cartão, no dia                               |
| Conduzir o ao vivo                | Organizador          | 1                         | "Conduzir ao vivo" no cartão                                     |
| Marcar o próximo sábado           | Organizador          | 1 ou 2                    | "Marcar o próximo sábado" no cartão (ou Agenda, "Novo encontro") |
| Publicar um aviso                 | Organizador          | 2                         | Comunidade, "Novo aviso"                                         |
| Ver quem não respondeu            | Organizador          | 1                         | "Faltam: Bruno e Camila" no cartão                               |
| Dizer os dias em que posso ajudar | Todos                | 3                         | Agenda, "Calendário", "Dias em que posso ajudar" (uso mensal)    |
| Trocar de comunidade              | Quem tem mais de uma | 2                         | Pílula do cabeçalho, escolher                                    |

**Atalhos (todos com equivalente visível):**

- **Pílula e sino** no cabeçalho de toda aba.
- **Pressionar e segurar** em linha da Agenda e do Check-in abre o menu "Mais" daquela linha (seção 5.7). Todo item de menu existe também no botão "Mais".
- **Compartilhar o encontro** (ícone e texto "Compartilhar" na tela do encontro): abre o compartilhar do sistema com `Sábado Jovem, sábado, 28 de nov., 16:00, Salão da igreja.` e o link.
- **Atalho na tela inicial do celular** (pressionar o ícone do app: "Próximo encontro", "Abrir o repertório"): possível, **exige dependência nova** (`expo-quick-actions`) e novo build. Fase 3, só se o teste pedir.
- **Widget "Próximo encontro"** na tela do celular: é o "0 toque" absoluto, mas exige trabalho nativo (WidgetKit e Glance). Fora do plano; fica anotado para depois da fase 3.

### 2.4 Vocabulário (resumo; a tabela completa está na seção 8)

| Conceito                            | Palavra final                                                         | Palavras que saem da interface                    |
| ----------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------- |
| A reunião                           | **Encontro**                                                          | evento, programação, programa                     |
| A lista de partes do encontro       | **Roteiro** (cada item: **etapa**)                                    | programação, "Etapas" como título                 |
| O que a pessoa faz no encontro      | **Sua parte** ("Louvor · Vocal")                                      | escala, designação, atribuição, "minhas escalas"  |
| Chamar alguém para servir           | **Convocar** (quem recebe: **convocado**)                             | escalar, designar                                 |
| Pedir para outra pessoa assumir     | **Preciso de alguém no meu lugar**                                    | "Pedir substituição" (vira só o rótulo do pedido) |
| Encontro que se repete sozinho      | **Repete toda semana**                                                | série, repetição (como título)                    |
| Criar um encontro a partir de outro | **Igual ao último sábado**                                            | duplicar, clonar                                  |
| Ponto de partida de um roteiro      | **Modelo** ("Sábado padrão")                                          | template                                          |
| Marcar quem chegou                  | **Check-in** (tela), "Chegou" (botão)                                 | marcar presença, lista de presença                |
| O encontro acontecendo              | **Ao vivo** (líder: "Conduzir ao vivo"; membro: "Acompanhar ao vivo") |                                                   |
| Biblioteca de músicas e afins       | **Biblioteca**                                                        | Conteúdos                                         |
| O que a pessoa toca no encontro     | **Meu repertório**                                                    | setlist, modo músico                              |
| Novidades                           | **Sino**, tela "Notificações"                                         |                                                   |

### 2.5 Mapa completo do app v3

```
App v3
|
|-- Antes de entrar (login v2, sem mudança)
|     Entrar, Criar conta, Segundo fator, Recuperar e redefinir senha,
|     Convite, Completar cadastro, Primeiro acesso, Oferta de biometria
|
|-- Sem comunidade (uma pergunta só)
|     Comece por aqui ("Você recebeu um código ou um link?")
|       |-- Tenho um código (1 tela, com ou sem conta) -> Prévia da comunidade -> Boas-vindas
|       |-- Procurar minha comunidade -> Comunidade encontrada -> Pedir para entrar
|       |-- Como conseguir um convite (folha, com mensagem pronta para o WhatsApp)
|       `-- Criar uma comunidade (link discreto)
|
|-- Boas-vindas (uma vez, depois de entrar): "Tudo pronto, Ana." -> Ligar os avisos
|
|-- Cabeçalho de toda aba: pílula da comunidade (Trocar) e sino (Notificações)
|
|-- [Início]
|     Saudação, versículo (linha fina -> Versículo do dia)
|     Cartão do momento  -> Encontro
|     Para responder     -> (resposta na linha) ou Encontro
|     Seu resumo (acordeão)
|     Aviso fixado       -> Aviso
|
|-- [Agenda]
|     Todos | Só o que é meu
|     Lista por semana -> Encontro
|     Calendário (folha) -> Dias em que posso ajudar
|     Novo encontro (organização) -> Igual ao último, Modelo, Em branco -> Formulário curto
|
|-- Encontro (página única; organização vê 3 abas)
|     Resumo: quando e onde, Sua parte, Roteiro, Quem serve, Inscrição, Como chegar
|     Roteiro -> folha da etapa
|     Convocados (organização) -> Convocar (folha)
|     Repertório (organização, etapa Louvor)
|     Check-in -> Ler QR
|     Ao vivo
|     Mais: Editar, Copiar este encontro, Compartilhar, Repete toda semana, Cancelar ou adiar
|
|-- [Comunidade]
|     Ações rápidas, Avisos, Pedidos de oração, Pessoas
|     Mais: Biblioteca, Louvor (todos, D73), Sugestões
|     Organização (dobrada): Pedidos de entrada e convites, Relatórios, Locais, Modelos,
|                            Denúncias, Configurações, Código da comunidade
|
|-- [Perfil]
|     Cartão da pessoa -> Editar perfil (foto ou avatar em folha)
|     Notificações (inclui Versículo do dia), Segurança (inclui Aparelhos e Código extra),
|     Privacidade e dados (inclui Bloqueados, Denunciar, Exportar, Excluir),
|     Comunidades (trocar, entrar, criar, sair), Ajuda (inclui Primeiros passos),
|     Plataforma (só Criador), Sair
|
`-- Telas de apoio: Notificações (sino), Uso sem internet (pelo status do cabeçalho),
    Não encontramos esta página
```

### 2.6 Inventário das 87 telas

Resultado: **54 manter, 14 juntar, 18 esconder, 1 cortar.** Quem junta não perde função: a rota antiga vira redirecionamento por um ciclo de lançamento (links antigos de notificação e de e-mail continuam abrindo).

**Antes de entrar e infraestrutura (13)**

| Rota                           | Decisão  | Motivo                                                                       |
| ------------------------------ | -------- | ---------------------------------------------------------------------------- |
| `(publico)/entrar`             | MANTER   | Refeita em D63; não reauditar.                                               |
| `(publico)/segundo-fator`      | MANTER   | Segurança do login v2.                                                       |
| `(publico)/recuperar-senha`    | MANTER   | Login v2.                                                                    |
| `redefinir-senha`              | MANTER   | Link do e-mail de recuperação.                                               |
| `(publico)/criar-conta`        | MANTER   | Login v2.                                                                    |
| `(publico)/completar-cadastro` | MANTER   | Login v2 (cadastro por provedor).                                            |
| `convite`                      | MANTER   | Chegada por link, login v2.                                                  |
| `primeiro-acesso`              | MANTER   | Fora do escopo; conferir com o grupo da entrada se o login v2 já o absorveu. |
| `biometria`                    | MANTER   | Oferta única, com "Agora não" sem culpa.                                     |
| `(publico)/colar-convite`      | JUNTAR   | Mesmo trabalho de `tenho-um-codigo`: um só componente, com ou sem conta.     |
| `entrar/[codigo]`              | MANTER   | Link do código abre o app (D58).                                             |
| `+not-found`                   | MANTER   | Redesenhar: "Não encontramos esta página" com "Ir para o Início".            |
| `_catalogo`                    | ESCONDER | Só em desenvolvimento, já fora do pacote de produção.                        |

**Sem comunidade (9)**

| Rota                                | Decisão  | Motivo                                                                      |
| ----------------------------------- | -------- | --------------------------------------------------------------------------- |
| `comece-por-aqui`                   | MANTER   | Vira uma pergunta e um botão (fluxo a).                                     |
| `tenho-um-codigo`                   | MANTER   | Passa a ser a única tela de código, com prévia da comunidade.               |
| `entrar-com-convite`                | JUNTAR   | Duplicata de `tenho-um-codigo` depois do login.                             |
| `como-conseguir-convite`            | MANTER   | Ganha a mensagem pronta "Pode me mandar o link de convite?".                |
| `procurar-comunidade`               | MANTER   | Caminho de quem não tem código.                                             |
| `comunidade-encontrada/[idPublico]` | MANTER   | Resultado da busca e pedido de entrada.                                     |
| `criar-comunidade`                  | ESCONDER | Quase ninguém cria; fica como link de texto, não como cartão do mesmo peso. |
| `denunciar-comunidade`              | ESCONDER | Raro; vive dentro de Privacidade e da comunidade encontrada.                |
| `trocar-comunidade`                 | MANTER   | Folha de 2 toques, a pílula do cabeçalho abre.                              |

**Abas (5)**

| Rota                | Decisão | Motivo                                                                                     |
| ------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `(abas)/index`      | MANTER  | Início: cartão do momento.                                                                 |
| `(abas)/agenda`     | MANTER  | Lista por semana, com a parte de cada um.                                                  |
| `(abas)/escalas`    | JUNTAR  | Vira Agenda (filtro "Só o que é meu") e Início ("Para responder"). `/escalas` redireciona. |
| `(abas)/comunidade` | MANTER  | Ações rápidas, avisos, oração, pessoas, Mais e Organização.                                |
| `(abas)/perfil`     | MANTER  | De 17 linhas para 6.                                                                       |

**Encontro e agenda (15)**

| Rota                                  | Decisão  | Motivo                                                                                             |
| ------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `evento/novo`                         | MANTER   | Começa por "Igual ao último / Modelo / Em branco", depois Data, Hora e Local.                      |
| `evento/[id]/index`                   | MANTER   | Página única para o membro; 3 abas para a organização.                                             |
| `evento/[id]/editar`                  | MANTER   | Mesmo formulário curto do novo, com "Mais opções".                                                 |
| `evento/[id]/status`                  | ESCONDER | "Cancelar ou adiar" só em "Mais", só para a organização, com a consequência escrita.               |
| `evento/[id]/duplicar`                | JUNTAR   | É a mesma ideia de "Igual ao último sábado"; "Copiar este encontro" em "Mais" usa o mesmo fluxo.   |
| `evento/[id]/etapa/[etapaId]`         | JUNTAR   | Vira folha aberta do Roteiro (organização edita; membro lê). Menos uma tela de seta que não rende. |
| `evento/[id]/ao-vivo`                 | MANTER   | Tarefa do dia, com rótulos nos botões.                                                             |
| `evento/[id]/inscricoes`              | ESCONDER | Só quando há inscrição aberta; linha "Inscrições: 12 de 60" no Resumo da organização.              |
| `evento/[id]/checkin`                 | MANTER   | Tarefa do dia, 1 toque a partir do Início.                                                         |
| `evento/[id]/ler-qr`                  | MANTER   | Botão dentro do Check-in.                                                                          |
| `serie/[serieId]`                     | ESCONDER | "Repete toda semana" só em "Mais" do encontro.                                                     |
| `agenda/[data]`                       | JUNTAR   | A "Linha do tempo do dia" repete a lista; tocar um dia no Calendário filtra a lista.               |
| `programacoes`                        | CORTAR   | Redirecionamento antigo (D57). Remover depois de um ciclo de lançamento.                           |
| `escalas/substituicao/[atribuicaoId]` | MANTER   | Folha "Preciso de alguém no meu lugar", 2 opções e motivo opcional.                                |
| `evento/[id]/repertorio`              | MANTER   | Montar o louvor, para a organização.                                                               |

**Louvor (3)**

| Rota                                 | Decisão | Motivo                                                                                                                        |
| ------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `louvor`                             | JUNTAR  | Uma tela "Louvor": o músico cai em "Meu repertório" do próximo encontro; a organização vê também os encontros sem repertório. |
| `meu-repertorio/index`               | MANTER  | É a tela de destino da junção acima.                                                                                          |
| `meu-repertorio/[eventoId]/[itemId]` | MANTER  | A cifra; ganha o botão "Modo palco" (fatia 2).                                                                                |

**Comunidade (22)**

| Rota                        | Decisão  | Motivo                                                                                  |
| --------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `avisos/index`              | MANTER   | Datas relativas, "Vai avisar 15 pessoas".                                               |
| `avisos/novo`               | MANTER   | Título e texto; o resto em "Mais opções".                                               |
| `avisos/[avisoId]`          | MANTER   | Leitura do aviso.                                                                       |
| `oracao/index`              | MANTER   | Filtros que não cortam na borda.                                                        |
| `oracao/novo`               | MANTER   | Pergunta "Quem vai ver?" primeiro; anonimato só quando faz sentido.                     |
| `oracao/[pedidoId]`         | MANTER   | Pedido e "Estou orando".                                                                |
| `sugestoes/index`           | ESCONDER | Em "Mais"; poucos abrem toda semana.                                                    |
| `sugestoes/nova`            | MANTER   | Ação rápida "Sugerir uma ideia".                                                        |
| `sugestoes/[sugestaoId]`    | MANTER   | Resposta da liderança.                                                                  |
| `conteudos/index`           | MANTER   | Renomeada "Biblioteca" (músicas, palestrantes, dinâmicas).                              |
| `conteudos/[tipo]/novo`     | MANTER   | Cadastro, só organização.                                                               |
| `conteudos/[tipo]/[itemId]` | MANTER   | Cifra e dados da música.                                                                |
| `membro/[vinculoId]`        | MANTER   | Pessoa: função, contato, histórico.                                                     |
| `convidar`                  | MANTER   | Um botão "Convidar para Jovens Esperança"; "Mais opções" tem função, validade e e-mail. |
| `codigo-da-comunidade`      | JUNTAR   | O código e o link são o convite: vira bloco dentro de Convidar.                         |
| `configurar-comunidade`     | ESCONDER | Administrador, dentro de "Organização".                                                 |
| `relatorios/index`          | ESCONDER | Uso raro, organização, dentro de "Organização".                                         |
| `relatorios/exportacoes`    | JUNTAR   | "Exportar" vira folha dentro de Relatórios.                                             |
| `locais/index`              | ESCONDER | Organização.                                                                            |
| `locais/[localId]`          | MANTER   | Edição do local.                                                                        |
| `modelos`                   | ESCONDER | Organização; o modelo aparece onde importa: ao criar o encontro.                        |
| `denuncias`                 | ESCONDER | Moderação, organização.                                                                 |

**Perfil, conta e ajuda (16)**

| Rota                    | Decisão  | Motivo                                                                                                 |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `conta`                 | JUNTAR   | Duplicata do Perfil aberto como tela de pilha; nada a referencia no código. Conferir antes de remover. |
| `editar-perfil`         | MANTER   | Uma só porta de edição.                                                                                |
| `escolher-avatar`       | JUNTAR   | Vira folha dentro de Editar perfil ("Tirar foto", "Galeria", "Escolher um avatar").                    |
| `notificacoes`          | MANTER   | "Quando o app me avisa"; absorve o Versículo do dia.                                                   |
| `caixa-de-notificacoes` | MANTER   | O sino: agrupado, com título real de cada coisa.                                                       |
| `versiculo/index`       | MANTER   | Leitura inteira e horário.                                                                             |
| `versiculo/traducao`    | JUNTAR   | Seção "Sobre a tradução" no fim do Versículo.                                                          |
| `conta/seguranca`       | MANTER   | "Segurança": a tela única do assunto.                                                                  |
| `ativar-2fa`            | MANTER   | Assistente passo a passo, aberto de Segurança.                                                         |
| `aparelhos`             | JUNTAR   | Seção "Aparelhos" dentro de Segurança.                                                                 |
| `privacidade`           | MANTER   | "Privacidade e dados".                                                                                 |
| `bloqueados`            | JUNTAR   | Seção dentro de Privacidade.                                                                           |
| `excluir-conta`         | MANTER   | Fundo de Privacidade, com as consequências escritas.                                                   |
| `pendencias`            | ESCONDER | "Uso sem internet" abre pelo status do cabeçalho, não pelo Perfil.                                     |
| `missao`                | ESCONDER | "Primeiros passos", só organização e só depois do primeiro encontro (D62); mora em Ajuda.              |
| `ajuda`                 | MANTER   | Ajuda e sobre; ganha "Falar com a gente".                                                              |

**Plataforma, só Criador (4)**

| Rota                        | Decisão  | Motivo                                         |
| --------------------------- | -------- | ---------------------------------------------- |
| `plataforma/index`          | ESCONDER | Só o Criador vê; fica em Perfil, última linha. |
| `plataforma/nova`           | ESCONDER | Idem.                                          |
| `plataforma/[comunidadeId]` | ESCONDER | Idem.                                          |
| `plataforma/transferencia`  | ESCONDER | Idem.                                          |

### 2.7 O que muda por papel: revelação progressiva

Quatro camadas. Quanto mais fundo, mais raro e mais atrás de um toque de pedido.

| Camada                      | Quem vê                                           | Regra                                                                          | Exemplos                                                                                |
| --------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| **0: todos**                | Todo membro                                       | Sempre à vista                                                                 | Cartão do momento, Agenda, Avisos, Pedir oração, Pessoas, Perfil.                       |
| **1: por relevância**       | Quem tem uma parte, uma inscrição, um instrumento | Aparece quando é verdade para a pessoa, nunca por menu                         | "Sua parte", "Abrir o repertório", "Louvor", "Para responder", "Inscrição".             |
| **2: organização, dobrada** | Organizador e administrador                       | Aparece no contexto, com "Mais opções" ou "Organização" fechados               | "Lembrar os 2", "Convocados", "Check-in", "Novo encontro", "Organização" na Comunidade. |
| **3: dono e plataforma**    | Administrador (configurar), Criador               | Só pelo Perfil ou pela Organização; nunca no caminho de nenhuma tarefa semanal | Configurar comunidade, Plataforma, Transferência.                                       |

| Aba ou tela    | Membro                                                                            | Convocado ou músico (camada 1)             | Organizador e administrador (camada 2)                                                              |
| -------------- | --------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Início**     | Cartão do momento, aviso fixado, resumo                                           | Mais "Sua parte" e "Para responder"        | O cartão mostra quem falta responder, falta função e o próximo passo do sábado (seção 3.2)          |
| **Agenda**     | Lista, "Todos / Só o que é meu", Calendário                                       | Resposta direto na linha, pedidos de ajuda | "Novo encontro", chip "Rascunhos" (só quando existe um)                                             |
| **Encontro**   | Página única                                                                      | "Sua parte" no alto                        | 3 abas: Resumo, Roteiro, Convocados; "Mais" com Editar, Copiar, Cancelar; Check-in e Ao vivo no dia |
| **Comunidade** | Ações rápidas "Pedir oração", "Sugerir uma ideia"; Avisos; Pedidos; Pessoas; Mais | Mais "Louvor" para todos (D73)             | Ações "Novo aviso", "Convidar"; "Organização" dobrada                                               |
| **Perfil**     | 6 linhas                                                                          | Igual                                      | "Segurança" mostra o alerta de código extra desligado só para o administrador (D62)                 |

---

## 3. Tela a tela: as 10 telas centrais

Convenções dos wireframes: 402 pt de largura, margem 20, cabeçalho de 53 pt, saudação 38, barra de abas 94 pt (altura útil sem rolagem de cerca de 720 pt). `[ Botão ]` é botão, `(texto)` é link ou chip, `>` é toque que abre outra coisa. Textos entre aspas são os finais. Todos os estados seguem as quatro telas: carregando, vazio, erro e sucesso, mais o "sem internet".

Regras comuns dos estados (valem em todas as telas, não repito):

- **Carregando:** o cabeçalho e o título aparecem na hora; depois de 300 ms entra um **esqueleto com a forma final** (cartão de 190 pt, linhas de 72 pt). Nada de roda girando na tela inteira. Com Reduzir movimento, o esqueleto é estático.
- **Erro de carregamento:** bloco no lugar do que falhou, não tela inteira, com o que aconteceu e "Tentar de novo". O resto da tela continua.
- **Sem internet:** faixa fina abaixo do cabeçalho: ícone e texto `Sem internet. Você vê a última versão, salva às 14:32.` Botões que precisam de internet ficam desabilitados com o motivo escrito embaixo (padrão que já existe e é bom): `Precisa de internet para responder.`

### 3.1 Início do membro

**Pergunta:** "Quando e onde é, e preciso fazer algo?" **Ação primária:** a do cartão do momento (tabela abaixo).

```
+--------------------------------------+
| (JE) Jovens Esperança v        (sino 2)|  1. Cabeçalho (53 pt)
|                                      |
| Bom dia, Carla                       |  2. Saudação (38 pt)
| "Não fostes vós que me esco..."   v  |     Versículo, linha de 44 pt
|                                      |
| +----------------------------------+ |
| | EM 5 DIAS                        | |  3. CARTÃO DO MOMENTO (cerca de 190 pt)
| | Sábado Jovem                     | |
| | Sáb., 28 de nov. · 16:00 às 17:00| |
| | Salão da igreja · (Como chegar)  | |
| | -------------------------------- | |
| | Sua parte: Louvor · Vocal        | |
| | Aguardando sua resposta          | |
| | [ Aceitar ]  [ Não posso ir ]    | |
| +----------------------------------+ |
|                                      |
| Para responder (1)                   |  4. Só se houver outro encontro pendente
| Recepção · Sáb., 5 de dez.           |     (linha de 72 pt, resposta na linha)
|   [ Aceitar ]  [ Não posso ir ]      |
|                                      |
| +----------------------------------+ |
| | Seu resumo                       | |  5. Acordeão fechado (64 pt)
| | 1 coisa esperando você         v | |
| +----------------------------------+ |
|                                      |
| Aviso fixado: Ensaio às 15h       >  |  6. Uma linha de 56 pt
+--------------------------------------+
  [Início] [Agenda] [Comunidade] [Perfil]
```

**Ordem fixa dos blocos (nunca muda de lugar, só o conteúdo):** cabeçalho, saudação com versículo, cartão do momento, Para responder, Seu resumo, aviso fixado. Tudo cabe em 720 pt com fonte padrão, sem rolar.

**O cartão do momento por estado (o relógio e a parte decidem):**

| Estado                         | Etiqueta do alto                                                                                     | Linha de "Sua parte"          | Primário                   | Secundário     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------- | -------------- |
| Longe, convocação pendente     | `EM 5 DIAS`                                                                                          | `Aguardando sua resposta`     | **Aceitar**                | Não posso ir   |
| Longe, confirmado, músico      | `EM 5 DIAS`                                                                                          | `Louvor · Vocal ✓ Confirmado` | **Abrir o repertório**     | Ver o encontro |
| Longe, confirmado, outra parte | `EM 5 DIAS`                                                                                          | `Recepção ✓ Confirmado`       | **Ver o encontro**         | (nenhum)       |
| Longe, público e não inscrito  | `EM 5 DIAS`                                                                                          | `Inscrições abertas`          | **Inscrever-me**           | Ver o encontro |
| Longe, sem parte               | `EM 5 DIAS`                                                                                          | (some)                        | **Ver o encontro**         | (nenhum)       |
| Véspera (até 24 h antes)       | `AMANHÃ · 16:00`                                                                                     | igual ao estado               | **Como chegar**            | Ver o encontro |
| No dia, antes (até a hora)     | `HOJE · EM 3 H`                                                                                      | igual ao estado               | **Como chegar**            | Ver o encontro |
| Acontecendo                    | `ACONTECENDO AGORA`                                                                                  | igual ao estado               | **Acompanhar ao vivo**     | (nenhum)       |
| Passou (até 24 h depois)       | `Obrigado por servir ontem.` só para quem tinha parte, e o próximo encontro entra no lugar do cartão |                               | **Ver o próximo encontro** |                |

Observação: a pendência vence o relógio: se a parte ainda está pendente, o primário é **Aceitar** em qualquer estado até o dia. No dia, se não respondeu, o cartão diz `Você ainda não respondeu. Dá tempo de avisar a liderança.` e o primário continua Aceitar.

**O que acontece ao tocar:**

| Toque                | Resultado                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Corpo do cartão      | Abre o Encontro.                                                                                                                                                                                                          |
| `Aceitar`            | Na hora o botão vira `✓ Confirmado` e a linha muda para `Louvor · Vocal ✓ Confirmado`. Toast `Você está no Louvor, sábado 28. Desfazer` (10 s). O aviso à liderança sai quando o toast fecha.                             |
| `Não posso ir`       | O cartão mostra `Você avisou que não pode. A liderança será avisada.` com `Desfazer` por 10 s; só depois o aviso sai. Sem diálogo "tem certeza?". O botão `Preciso de alguém no meu lugar` aparece no encontro, não aqui. |
| `Como chegar`        | Abre o app de mapas do sistema com o endereço do local. Sem endereço (local interno sem rua), abre o Encontro na linha "Onde".                                                                                            |
| Linha do versículo   | Abre e fecha o texto (200 ms). Segunda linha de toque `Ler com calma` abre `/versiculo`.                                                                                                                                  |
| `Para responder (n)` | Cada linha tem os dois botões; deslizar para a direita aceita (seção 5.4); tocar no nome abre o Encontro.                                                                                                                 |
| `Seu resumo`         | Abre o acordeão com linhas que levam a algum lugar (como em D62).                                                                                                                                                         |
| `Aviso fixado`       | Abre o Aviso.                                                                                                                                                                                                             |
| Pílula da comunidade | Folha "Trocar de comunidade".                                                                                                                                                                                             |
| Sino                 | Notificações.                                                                                                                                                                                                             |

**Estados:**

- **Carregando:** saudação já com o nome; esqueleto do cartão (190 pt) e de uma linha.
- **Vazio** (nenhum encontro marcado): o cartão vira texto sem botão. `Ainda não há encontro marcado.` / `Quando a liderança marcar o próximo, ele aparece aqui e você recebe um aviso.` Se os avisos do app estiverem desligados, um botão `Ligar os avisos`. Ilustração: o sol atrás do horizonte (seção 5.6).
- **Tudo em dia** (sem pendência e sem nada a fazer): o resumo diz `Tudo em dia` com a marca, sem seta.
- **Erro:** no lugar do cartão, `Não deu para carregar o próximo encontro. Confira a internet e tente de novo.` com `Tentar de novo`. Versículo, resumo e aviso continuam.
- **Sem internet:** faixa de aviso; o cartão aparece com a última versão e a etiqueta `Última versão: hoje, 14:32`; `Aceitar` e `Não posso ir` ficam desabilitados com `Precisa de internet para responder.`; `Como chegar` e `Ver o encontro` (do que já estiver salvo) continuam.

### 3.2 Início do líder

**Pergunta:** "O que falta resolver, e qual é o próximo passo do sábado?" **Ação primária:** a que o estado do encontro pede.

```
+--------------------------------------+
| (JE) Jovens Esperança v        (sino 1)|
| Bom dia, Daniel                      |
| "Não fostes vós que me esco..."   v  |
|                                      |
| +----------------------------------+ |
| | SÁBADO QUE VEM · EM 5 DIAS       | |  CARTÃO DO MOMENTO, líder
| | Sábado Jovem                     | |
| | Sáb., 28 de nov. · 16:00         | |
| | Salão da igreja                  | |
| | -------------------------------- | |
| | 9 de 11 responderam              | |  a pergunta do líder
| | [=========------]                | |  (barra com número ao lado)
| | Faltam: Bruno e Camila           | |
| | Falta: bateria                   | |
| | Louvor: 0 músicas                | |
| | [ Lembrar os 2 ] [ Ver convocados]|
| +----------------------------------+ |
|                                      |
| +----------------------------------+ |
| | Seu resumo                       | |
| | 3 coisas esperando você        v | |
| +----------------------------------+ |
|                                      |
| Aviso fixado: Ensaio às 15h       >  |
+--------------------------------------+
```

**O cartão do líder por estado:**

| Estado                                  | Etiqueta               | Linhas                                                                                 | Primário                                                               | Secundário         |
| --------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------ |
| **Sem encontro marcado**                | `NADA MARCADO`         | `Nenhum encontro marcado. O Sábado padrão já vem com o roteiro de sempre.`             | **Marcar o próximo sábado**                                            | (nenhum)           |
| **Rascunho**                            | `RASCUNHO · EM 5 DIAS` | `Ainda não publicado. Ninguém foi avisado.`                                            | **Publicar e avisar 11 pessoas**                                       | Editar             |
| **Publicado, falta resposta ou função** | `EM 5 DIAS`            | `9 de 11 responderam`, `Faltam: Bruno e Camila`, `Falta: bateria`, `Louvor: 0 músicas` | **Lembrar os 2** (ou **Convocar bateria** se não há ninguém a lembrar) | Ver convocados     |
| **Publicado, tudo respondido**          | `EM 5 DIAS`            | `Todos responderam ✓` e a linha da Banda completa, se for o caso                       | **Ver o encontro**                                                     | Abrir o repertório |
| **Véspera**                             | `AMANHÃ · 16:00`       | `{n} confirmados. Falta: ...` se houver                                                | **Ver convocados**                                                     | Ver o encontro     |
| **No dia, a partir de 2 h antes**       | `HOJE · EM 2 H`        | `{n} confirmados. {m} inscritos.`                                                      | **Fazer check-in**                                                     | Abrir ao vivo      |
| **Acontecendo**                         | `ACONTECENDO AGORA`    | `Agora: Louvor, até 16:20. Depois: Oração intercessora.`                               | **Conduzir ao vivo**                                                   | Check-in           |
| **Terminou (até 24 h depois)**          | `TERMINOU`             | `Sábado Jovem terminou. 12 presentes.`                                                 | **Marcar o próximo sábado**                                            | Ver o resumo       |

**Por que "Lembrar os 2" e "Marcar o próximo sábado" são o coração:** o líder hoje liga no WhatsApp para quem não respondeu, e hoje monta o sábado do zero (cerca de 26 toques). Os dois botões resolvem as duas tarefas semanais mais caras. `Lembrar os 2` envia uma notificação só para quem não respondeu; no máximo um lembrete por pessoa por encontro por dia (depende de API, seção 10). `Marcar o próximo sábado` abre o fluxo (d).

**Seu resumo (líder):** acordeão fechado. Aberto, só linhas com valor, em dois grupos (D62): `Para você` (Responder 1 convocação) e `Da organização` (Ver 1 pedido de entrada, Ver 1 tarefa atrasada, Ver os números e relatórios).

**Toques:** `Lembrar os 2` envia e muda o botão para `✓ Lembrete enviado` e o texto da linha para `Você lembrou Bruno e Camila, hoje às 10:12.` (desfazer não se aplica a uma notificação já enviada, por isso o botão pede um segundo de espera: ele vira `Enviando em 10 s` com `Desfazer`, como em 5.2).

**Estados:** igual ao 3.1, com estas trocas.

- **Erro:** `Não deu para carregar o sábado. Confira a internet e tente de novo.`
- **Sem internet:** o cartão aparece com a última versão; `Lembrar`, `Publicar` e `Marcar o próximo sábado` desabilitados com `Precisa de internet para avisar as pessoas.`; `Fazer check-in` e `Conduzir ao vivo` **continuam** se o pacote do encontro estiver baixado (seção 5.10).

### 3.3 Agenda

**Pergunta:** "O que vem aí e qual é a minha parte?" **Ação primária:** nenhuma obrigatória; para a organização, `Novo encontro` no cabeçalho.

```
+--------------------------------------+
| (JE) Jovens Esperança v        (sino 2)|
| Agenda                  [+ Novo encontro]   (só organização)
|                                      |
| [ Todos | Só o que é meu ]  [Calendário]
|                                      |
| Pedem ajuda (1)                      |  só se houver
| Projeção · Sáb., 5 de dez.  [Assumir]|
|                                      |
| Esta semana                          |
| +----------------------------------+ |
| | 21  Sábado Jovem                 | |
| | SÁB 16:00 às 17:00 · Salão       | |
| |     Você: Louvor · Vocal ✓       | |
| +----------------------------------+ |
| Próxima semana                       |
| +----------------------------------+ |
| | 28  Sábado Jovem                 | |
| | SÁB 16:00 · Salão da igreja      | |
| |     Aguardando sua resposta      | |
| |     [ Aceitar ] [ Não posso ir ] | |
| +----------------------------------+ |
| Mais adiante                         |
| ...                                  |
| (Ver encontros passados)             |
+--------------------------------------+
```

**Decisões:**

- **Abre em Lista**, agrupada por `Esta semana`, `Próxima semana` e `Mais adiante` (nada de "HOJE, SEGUNDA-FEIRA, 16 DE NOVEMBRO" em maiúsculas pequenas). Títulos de grupo em 16 pt, não em 13.
- **`Todos / Só o que é meu`**: dois segmentos (com fonte grande empilham). É o que sobra da antiga aba Escalas: "Só o que é meu" lista só os encontros onde a pessoa tem parte, com a resposta na linha.
- **A resposta fica na linha** quando está pendente (mesmos dois botões do Início). Depois de aceita, a linha vira `Você: Louvor · Vocal ✓` e os botões somem, a linha encolhe 200 ms.
- **`Pedem ajuda`** (antiga seção "Pedidos de substituição" da Escalas): só aparece se alguém pediu e a pessoa pode assumir. `Assumir` é um toque, com `Desfazer`.
- **`Calendário`** abre uma **folha** com o mês. Tocar num dia fecha a folha e leva a lista a esse dia. Dentro da folha há um interruptor `Dias em que posso ajudar` (modo de marcar): tocar nos dias marca `Posso ajudar` com o ícone de check e o texto (cor nunca é o único sinal). É onde mora a antiga "Disponibilidade".
- **Cortado:** "Semana", busca (só aparece com mais de 10 encontros), "Linha do tempo do dia".
- **Rascunhos:** o chip `Rascunhos (1)` só aparece para a organização e só quando existe um.
- **Linha do encontro:** número do dia grande à esquerda (o melhor padrão do app, mantido), título, hora e local, e **sempre** a linha `Você: ...` quando há parte, ou `Inscrito` quando há inscrição. Sem parte e sem inscrição, a linha não existe.

**Toques:** linha abre o Encontro. Pressionar e segurar abre `Mais`: `Ver o encontro`, `Compartilhar`, `Como chegar` e, para a organização, `Copiar este encontro` e `Cancelar ou adiar`. `Novo encontro` abre o fluxo (d). `Ver encontros passados` abre a lista de passados, com a presença da pessoa.

**Estados:**

- **Carregando:** 3 linhas de esqueleto de 88 pt.
- **Vazio, membro:** `Nenhum encontro marcado.` / `Quando a liderança marcar o próximo, ele aparece aqui.` Sem botão.
- **Vazio, organização:** `Nenhum encontro marcado.` / `O Sábado padrão já vem com o roteiro de sempre.` Botão `Marcar o próximo sábado`.
- **Vazio em "Só o que é meu":** `Você não tem nenhuma parte nos próximos encontros.` / `Se quiser ajudar, diga em quais dias você pode.` Botão `Dias em que posso ajudar`.
- **Erro:** `Não deu para carregar a agenda.` / `Confira a internet e tente de novo.` `Tentar de novo`.
- **Sem internet:** a lista salva aparece com a faixa; os botões de resposta ficam desabilitados com o motivo.

### 3.4 Encontro

**Pergunta:** "O que é, quando, onde e qual é a minha parte?" (membro); "Está tudo pronto?" (organização). **Ação primária:** a mesma do cartão do Início para o mesmo estado (uma função só decide as duas telas).

**Membro: página única, sem abas.**

```
+--------------------------------------+
| (<)                     (Compartilhar)|
| Sábado Jovem                         |
| Sáb., 28 de nov. · 16:00 às 17:00    |
| (Aberto ao público)    (Em 5 dias)   |
|                                      |
| +----------------------------------+ |
| | Sua parte                        | |  1. a primeira coisa depois do título
| | Louvor · Vocal ✓ Confirmado      | |     (ou Aceitar e Não posso ir)
| | (Abrir o repertório)             | |     (Preciso de alguém no meu lugar)
| +----------------------------------+ |
|                                      |
| Quando e onde                        |  2.
|  Sábado, 28 de novembro              |
|  16:00 às 17:00 · 1 h                |
|  Salão da igreja                     |
|  Entrada lateral, ao lado da secretaria
|  [ Como chegar ]                     |
|                                      |
| Roteiro                              |  3. 3 linhas e "Ver tudo (7)"
|  16:00  Boas-vindas                  |
|  16:05  Louvor           você        |
|  16:20  Oração intercessora          |
|  (Ver tudo, 7 etapas)                |
|                                      |
| Quem serve (9)                       |  4. avatares e (Ver todos)
| Inscrição: 12 de 60 vagas            |  5. só se aberta
| Sobre o encontro                     |  6. descrição
| Preparação (só se tiver algo)        |  7. tarefas, materiais
+--------------------------------------+
```

**Organização: a mesma página no topo, mais três abas** (D57 e auditoria de 21/11): `Resumo`, `Roteiro`, `Convocados`. "Preparação" vira linha do Resumo. "Inscrição" sai do topo e vira a linha `Inscrições: 12 de 60` no Resumo. A barra de baixo mostra o primário do estado e `Mais`:

```
Resumo (organização)
  Quando e onde (com Como chegar)
  Convocados: 9 de 11 aceitaram. Falta: bateria.  (Ver convocados)
  Louvor: 0 músicas  (Montar o repertório)
  Check-in  (aparece de 2 h antes até o fim)
  Inscrições: 12 de 60  >
  Preparação: 3 tarefas, 1 atrasada  >
 [ Mais ]  [ Publicar e avisar 11 pessoas ]     (barra fixa, primário por estado)
```

`Mais` (organização): `Editar`, `Copiar este encontro`, `Compartilhar`, `Repete toda semana`, `Cancelar ou adiar`.

**O que acontece ao tocar:**

| Toque                            | Resultado                                                                                                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Como chegar`                    | Abre o mapa do sistema.                                                                                                                                                                                     |
| Linha do Roteiro                 | Folha da etapa: horário, duração, descrição, quem está nela. Organização edita ali; membro só lê. Nada de nova tela.                                                                                        |
| `Abrir o repertório`             | Abre "Meu repertório" no próximo encontro.                                                                                                                                                                  |
| `Preciso de alguém no meu lugar` | Folha com duas opções (`Qualquer pessoa da comunidade` ou `Escolher uma pessoa`), motivo opcional e o botão `Enviar pedido`. Depois: toast `Pedido enviado. Você continua na sua parte até alguém assumir.` |
| `Compartilhar`                   | Compartilhar do sistema com o texto do encontro e o link.                                                                                                                                                   |
| `Cancelar ou adiar`              | Folha com a consequência escrita (`Vai avisar 11 pessoas`) e o botão `Cancelar o encontro`. É um dos poucos diálogos de verdade, porque desfaz o que outras pessoas já organizaram.                         |

**Estados:** carregando (título já no lugar, 3 blocos de esqueleto), erro (`Não deu para abrir este encontro. Pode ter sido removido ou você está sem internet.` com `Tentar de novo` e `Voltar para a Agenda`; 404 de outra comunidade usa o mesmo texto), sem internet (a cópia do aparelho, com o aviso `Sem conexão: você vê a cópia deste aparelho, salva às 14:32`, já existente no código), vazio (roteiro vazio: `O roteiro ainda não foi montado.` e, para a organização, `Usar o Sábado padrão`).

### 3.5 Escalas e convocação (a parte da pessoa e o ato de convocar)

Esta tela não é mais uma aba. É um **par de peças** que aparece em vários lugares: a **resposta** (para quem foi convocado) e a **convocação** (para quem convoca).

**A resposta**, sempre a mesma peça (Início, Agenda, Encontro, notificação):

```
  Sua parte: Louvor · Vocal
  Aguardando sua resposta
  [ Aceitar ]  [ Não posso ir ]
        depois de aceitar:
  Louvor · Vocal ✓ Confirmado
  (Preciso de alguém no meu lugar)
```

Regras: pendente tem **dois** botões, sempre (D62). `Preciso de alguém no meu lugar` só existe depois de aceitar. `Não posso ir` não tem diálogo: tem `Desfazer` (seção 5.2).

**A convocação**, na aba `Convocados` do encontro (organização):

```
+--------------------------------------+
| Convocados                           |
| 9 de 11 aceitaram. Faltam 2.  (Ver quem falta)
| Falta: bateria                       |
|                                      |
| Louvor                               |
|  Vocal   Carla ✓   Mateus ✓          |
|  Violão  Bruno (aguardando)          |
|  Teclado Camila (aguardando)         |
|  Bateria   Ninguém     [ Convocar ]  |
| Recepção                             |
|  Regina ✓                            |
| Para o encontro inteiro              |
|  Daniel ✓ (quem conduz)              |
|                                      |
| [ Convocar pessoas ]                 |
+--------------------------------------+
```

**A folha "Convocar" (múltipla escolha):**

```
+--------------------------------------+
| Convocar para Bateria            (X) |
| Buscar pelo nome                     |
| Sugeridas                            |
|  [ ] Marcos    tocou bateria 3 vezes |
|  [ ] Léo       disponível neste dia  |
| Todas as pessoas (15)                |
|  [ ] Ana Ribeiro                     |
|  [ ] Beatriz Moraes                  |
|  ( ) Bruno Tavares  Já convocado     |
|  ( ) Davi  Avisou que não pode neste dia |
|                                      |
| [ Convocar 2 pessoas ]               |
+--------------------------------------+
```

- **Marcar várias de uma vez** (hoje são 4 toques por pessoa). Quem já foi convocado fica visível e desabilitado, com o motivo escrito.
- **Sugeridas primeiro:** quem tocou ou serviu nessa função nos últimos encontros e quem avisou que pode neste dia. Isto usa dados que já existem (convocações passadas e disponibilidade); é cálculo no app.
- **Função** (`Quem conduz / Quem ajuda / Outra função` e a lista do louvor) escolhida na folha, mas vem **preenchida** pelo bloco de onde o toque saiu (Convocar em "Bateria" já traz Bateria). Para o toque geral, o primeiro passo da folha é a função.
- **Primário:** `Convocar 2 pessoas`. O botão muda com a contagem; sem ninguém marcado, `Marque quem convocar` desabilitado.
- **Depois:** a folha fecha e o bloco mostra as pessoas como `(aguardando)`. Toast `2 pessoas convocadas.` com `Desfazer` (10 s); o aviso às pessoas sai quando o toast fecha (ou ao sair do app).

**Estados:** carregando (esqueleto de 4 blocos), vazio (`Ninguém convocado ainda.` / `Convoque quem vai servir neste encontro.` botão `Convocar pessoas`), erro (`Não deu para carregar quem foi convocado.` `Tentar de novo`), sem internet (leitura da cópia; `Convocar` desabilitado: `Precisa de internet para avisar as pessoas.`).

### 3.6 Comunidade

**Pergunta:** "O que está acontecendo com a gente?" **Ação primária:** nenhuma obrigatória; as ações rápidas são secundárias de verdade.

```
+--------------------------------------+
| (JE) Jovens Esperança v        (sino 2)|
| Comunidade                           |
| 15 pessoas                           |
|                                      |
| [ Pedir oração ] [ Sugerir uma ideia ]    membro
| [ Novo aviso ]  [ Convidar ]              organização
|                                      |
| Avisos                               |
| +----------------------------------+ |
| | Fixado: Ensaio do louvor às 15h  | |  o último aviso à vista (1 linha de
| | há 2 dias                      > | |  título, não só um atalho)
| +----------------------------------+ |
| (Ver todos os avisos, 4)             |
|                                      |
| Pedidos de oração           3 novos >|
| Pessoas                  (avatares) 15 >|
|                                      |
| Mais                                 |
|  Biblioteca                        > |
|  Louvor (todos, D73)               > |
|  Sugestões                         > |
|                                      |
| Organização (organização, dobrada) v |
|  Pedidos de entrada (2) e convites   |
|  Relatórios, Locais, Modelos         |
|  Denúncias, Configurações, Código    |
+--------------------------------------+
```

**Decisões:**

- A aba deixa de ser um menu de links e vira um **mural curto**: mostra o aviso mais importante com título (não só o atalho), a contagem de pedidos novos e as pessoas.
- **Ações rápidas** no alto: o que a pessoa vem fazer aqui. Membro: `Pedir oração`, `Sugerir uma ideia`. Organização: `Novo aviso`, `Convidar`. São botões secundários lado a lado (par de largura igual, 12 de intervalo).
- **Pedidos de oração, `3 novos`:** número em texto (nunca só cor). O texto do pedido nunca aparece aqui (regra de privacidade do CLAUDE.md).
- **Sai daqui:** "Sair da comunidade" (Perfil, Comunidades), a legenda "Você é Administrador" como assunto (fica em Pessoas, no seu cartão), os segmentos Pessoas, Pedidos e Convites (viram a linha Pessoas e a seção Organização).
- **Organização** é um acordeão fechado, para organizador e administrador. `Pedidos de entrada (2)` mostra o número em texto.
- **Louvor** aparece para todos (D73, que revê a D62): o repertório do próximo encontro e a banda são de leitura para toda a comunidade; editar continua da organização.
- O vocabulário musical (tom, capotraste) nunca aparece aqui.

**Toques:** `Pedir oração` abre o novo pedido (fluxo h). `Novo aviso` abre o novo aviso (fluxo g). `Convidar` abre Convidar. `Pessoas` abre a lista (busca por nome, desativados no fim, como hoje). A linha de aviso abre o aviso.

**Estados:** carregando (3 blocos de esqueleto), vazio de avisos (`Nenhum aviso por enquanto.` e, para a organização, `Escreva o primeiro aviso.` botão `Novo aviso`), vazio de pessoas só você (`Por enquanto, só você. Convide o grupo.` botão `Convidar`; já existe), erro (`Não deu para carregar a comunidade.` `Tentar de novo`), sem internet (avisos e pessoas da última versão; ações rápidas desabilitadas com o motivo).

### 3.7 Perfil

**Pergunta:** "Como eu ajusto o app e a minha conta?" **Ação primária:** nenhuma.

```
+--------------------------------------+
| Perfil                               |
| +----------------------------------+ |
| | (AR)  Ana Ribeiro              > | |  o cartão inteiro abre Editar perfil
| |       Administradora · Jovens E. | |
| +----------------------------------+ |
|                                      |
| Notificações                       > |  "Quando o app me avisa" (encontros,
|   Encontros, convocações, avisos     |   convocações, avisos, versículo)
| Segurança                          > |  Código extra, Face ID, aparelhos
| Privacidade e dados                > |  Bloqueados, denunciar, exportar, excluir
| Comunidades                        > |  Jovens Esperança · trocar, entrar, criar, sair
| Ajuda                              > |  Primeiros passos, termos, versão, falar com a gente
|                                      |
| Plataforma                         > |  só Criador
|                                      |
| (Sair)                               |  link de texto, vermelho com ícone
+--------------------------------------+
```

- **De 17 linhas para 6** (mais a do Criador e o Sair). Cada linha tem uma frase de apoio de uma linha.
- **O alerta de "Segurança: Desligado"** aparece só para o administrador e o Criador (D62), com ícone e texto.
- **"Uso sem internet"** deixou de ser linha: abre pelo status do cabeçalho (`Tudo salvo · 14:32` ou `3 alterações esperando internet`).
- **Sair** pede um segundo toque no próprio botão (vira `Toque de novo para sair`, 4 s). Não é diálogo.

**Estados:** quase estático. Carregando: o cartão da pessoa com esqueleto de avatar e duas linhas. Erro de carregar o perfil: `Não deu para carregar seus dados.` `Tentar de novo`, com as linhas de baixo ainda tocáveis. Sem internet: tudo abre; `Sair` pede internet? Não: sair funciona sem internet e avisa `Você saiu. Seus dados neste aparelho foram apagados.`.

### 3.8 Check-in

**Pergunta:** "Quem já chegou?" **Ação primária:** `Chegou`, a linha inteira.

```
+--------------------------------------+
| (<)                        (Ler QR)  |
| Check-in                             |
| Sábado Jovem                         |
|                                      |
| 9 de 15 presentes                    |  contador grande, fixo ao rolar
| [========-------]                    |
|                                      |
| [ Buscar pelo nome ]                 |
|                                      |
| Convocados e inscritos (11)          |
| +----------------------------------+ |
| | (BM) Beatriz Moraes   Chegou   | |  toda a linha é o alvo (72 pt)
| | (CN) Camila Nunes  ✓ Presente  | |
| | (CM) Carla Menezes   Chegou    | |
| |      Inscrita                    | |
| Outras pessoas (4)                   |
| | (AR) Ana Ribeiro     Chegou    | |
| +----------------------------------+ |
|                                      |
|   [ Mais ]  (Marcar todos que aceitaram)|
+--------------------------------------+
```

**Decisões:**

- **Linha inteira é o alvo** (72 pt de altura), com o botão `Chegou` à direita como sinal. Tocar em qualquer parte da linha marca. Marcado vira o chip `✓ Presente` (forma e texto, nunca só cor).
- **Tocar de novo** num presente **desmarca** e mostra `Presença de Ana desfeita.` Sem diálogo.
- **Grupos:** primeiro `Convocados e inscritos`, depois `Outras pessoas`. Dentro de cada grupo, ordem alfabética. "Membro sem inscrição" desaparece (ruído); só a exceção é escrita (`Inscrita`, `Convocada`).
- **Contador** `9 de 15 presentes` (hoje "0 presentes") fixo no alto durante a rolagem, com a barra; o número troca por dissolução de 120 ms.
- **Busca** pelo nome com o teclado só quando a pessoa toca no campo (a tela não abre com teclado).
- **`Mais`:** `Marcar todos que aceitaram` (um toque, com `Desfazer` de 10 s) para a equipe que chega junto.
- **`Ler QR`:** abre a câmera; ao ler, o nome entra no topo da lista como `Ana Ribeiro ✓ Presente` e a câmera continua aberta.
- **Primeira presença da vida do líder:** momento de encanto (seção 6.3).

**Estados:**

- **Carregando:** contador `-- de --` e 6 linhas de esqueleto.
- **Vazio:** nenhum convocado nem inscrito: `Ninguém convocado ou inscrito. Procure pelo nome ou leia o QR de quem chegou.` Com busca sem resultado: `Ninguém com esse nome.`
- **Erro** ao marcar: a linha volta ao estado anterior com `Não deu para marcar Ana. Toque para tentar de novo.`
- **Sem internet:** **funciona** (a presença entra numa fila e sincroniza depois, `presenca.registrar` já existe). Faixa: `Sem internet. As presenças ficam guardadas e vão quando voltar.` Contador mostra `9 de 15 presentes (2 esperando internet)`.

### 3.9 Ao vivo

**Pergunta:** "Em que etapa estamos e o que vem depois?" **Ação primária:** `Próxima etapa`.

```
Antes de iniciar               Em andamento (organização)
+-----------------------+     +--------------------------------+
| (<)   (Conectado) (Mais)|     | (<)    (Conectado)       (Mais)|
| Sábado Jovem           |     | Sábado Jovem                   |
| +-------------------+  |     | +----------------------------+ |
| | AINDA NÃO COMEÇOU |  |     | | AGORA                      | |
| | Previsto: 16:00   |  |     | | Louvor                     | |
| +-------------------+  |     | | 08:42  de 15 min           | |
| A seguir               |     | | (ícone) 2 min de folga     | |
| Boas-vindas, 5 min     |     | +----------------------------+ |
| 0 de 7 etapas          |     | Depois: Oração intercessora    |
| Todas as etapas        |     | 2 de 7 etapas                  |
| 16:00 Boas-vindas      |     | Roteiro (toque para ver tudo)  |
|  ...                   |     |                                |
| [ Iniciar o encontro ] |     | [ Voltar ] [ Próxima etapa:    |
+-----------------------+     |            Oração intercessora ] |
                               |          (Pausar)              |
                               +--------------------------------+
```

**Decisões:**

- **O chip diz `Conectado`**, não "Ao vivo" (D62 já fez). A etiqueta do encontro é `AINDA NÃO COMEÇOU`, `AGORA` e `ENCERRADO`.
- **Botões com texto** (não só ícone): `Voltar` (secundário de 56 pt, ícone e texto), `Próxima etapa: Oração intercessora` (primário de 56 pt, mostra para onde vai), `Pausar` (terciário). O primário nomeia a etapa seguinte, assim a pessoa nunca avança por reflexo sem saber o que vem.
- **Atraso** com ícone e texto (`Passou 3 min`), nunca só cor; já é assim.
- **`Mais`:** `Encerrar o encontro`, `Pular uma etapa`, `Voltar uma etapa`. `Encerrar` não pede confirmação: mostra `Encontro encerrado. Desfazer` por 10 s e muda a etiqueta para `ENCERRADO`.
- **Tela acesa** durante o encontro (já usa `expo-keep-awake`).
- **Para o membro** (`Acompanhar ao vivo`): a mesma tela sem botões de condução: `AGORA: Louvor, até 16:20` e `DEPOIS: Oração intercessora`. Sem `Mais`.
- **A tela não tem barra de abas** (como hoje).

**Estados:** carregando (esqueleto do cartão grande), erro de conexão (o chip passa a `Sem conexão` com ícone; a condução **continua** e entra na fila, `ao_vivo.proposta` já existe; texto `Você pode continuar. As mudanças vão quando a internet voltar.`), vazio (encontro sem roteiro: `Este encontro não tem roteiro. Monte o roteiro para conduzir etapa por etapa.` botão `Montar o roteiro`), sem internet com pacote baixado (funciona igual) e sem pacote (`Para conduzir sem internet, baixe o encontro antes. Faça isso com Wi-Fi.`, botão `Baixar o encontro`).

### 3.10 Meu repertório e modo músico

**Pergunta:** "O que eu toco neste sábado, e em que tom?" **Ação primária:** abrir a primeira música; no encontro, `Modo palco`.

```
Meu repertório                      Cifra (leitura)
+--------------------------+       +-----------------------------+
| (<) Meu repertório       |       | (<)  Sobre a rocha    (Palco)|
| Sábado Jovem             |       | Tom: A  ·  Capotraste 2      |
| Sáb., 28 de nov., 16:05  |       | Soa em A, toque em G         |
| Sua parte: Violão ✓      |       |                              |
| Baixado para usar sem    |       |  G           D               |
| internet ✓               |       |  Sobre a rocha eu firmo...   |
|                          |       |  Em           C              |
| 1  Sobre a rocha         |       |  Quando o vento vem          |
|    Tom A · Capotraste 2  |       |                              |
| 2  Grande é o Senhor     |       | [ Tom - ] [ Tom + ] [ A- ][A+]|
|    Tom G                 |       | [ < Anterior ] [ Próxima > ] |
| 3  ...                   |       | Música 1 de 4                |
|                          |       +-----------------------------+
| [ Modo palco ]           |
| (Ver encontros seguintes)|
+--------------------------+
```

**Decisões:**

- **Um caminho só**: `Abrir o repertório` no cartão do Início (1 toque) leva a esta lista; a música abre a cifra (2 toques); `Modo palco` (3).
- **A lista mostra o meu tom** (tom do dia, ou o meu tom de vocalista), a posição e a marca `Baixado para usar sem internet ✓`.
- **Cifra:** letra com acorde sobre a sílaba, em negrito (nunca só cor), `Tom -` e `Tom +` e `Capotraste` com botões de 44 pt, `A-` e `A+` para o tamanho, `Anterior` e `Próxima` por botão (e por toque nas laterais, nunca só gesto). O vocabulário musical vive só aqui.
- **Modo palco** (fatia 2 do modo músico, ainda não construída): tela escura de alto contraste, sem barra de abas, tela sempre acesa, tamanho da letra lembrado, funciona sem internet. Sair pelo botão `Sair do palco` (nunca só gesto).
- **Ao aceitar uma convocação de louvor**, o app **baixa sozinho** o repertório no Wi-Fi (fase 2). O músico nunca precisa lembrar de "deixar pronto".
- **Para a organização**, a mesma lista tem `Subir` e `Descer` por botão em cada música, `Tom do dia` com `-` e `+`, `Adicionar músicas` e `Avisar a banda`. É a tela que o regente usa para montar (fluxo i).

**Estados:**

- **Carregando:** 4 linhas de esqueleto.
- **Não convocado ao louvor (D73):** não há mais este vazio. `/meu-repertorio` abre o Repertório do próximo encontro em leitura (lista, tom do dia, cifra para ler, "Quem toca: Ana (violão), Bruno (bateria)." sem "Falta"); no Início o botão é `Ver o repertório` e só aparece havendo músicas.
- **Vazio, convocado e sem músicas ainda:** `O repertório ainda não foi montado. Assim que a liderança montar, você recebe um aviso.`
- **Erro:** `Não deu para carregar o repertório.` `Tentar de novo`. Se o pacote já estiver baixado, a lista abre assim mesmo, sem erro.
- **Sem internet:** com o repertório baixado, **tudo funciona**, inclusive cifra e Modo palco. Sem estar baixado: `Este repertório ainda não está no seu aparelho. Conecte-se para baixar.` e botão `Baixar agora`.

---

## 4. Fluxos de ponta a ponta

Formato: caminho, toques antes e depois, decisões, o que some. "Antes" vem da auditoria de 21/11 (a a h, contados pelo código) ou é marcado como estimativa.

### Quadro resumo

| Fluxo                                    | Toques antes        | Toques depois                                 | Rolagens antes | Rolagens depois | Decisões antes       | Decisões depois |
| ---------------------------------------- | ------------------- | --------------------------------------------- | -------------- | --------------- | -------------------- | --------------- |
| a. Primeira abertura e entrar            | 4 (3 por link)      | 4 (2 por link)                                | 1              | 0               | 3                    | 1               |
| b. O que eu faço neste sábado            | 0                   | 0                                             | 1 a 2          | 0               | 0                    | 0               |
| c. Aceitar ou recusar                    | 1 / 2               | 1 / 1 (com Desfazer)                          | 1              | 0               | 2 a 3 botões         | 2 botões        |
| d. Líder cria o sábado e convoca a banda | cerca de 26         | **4** (Agenda) ou **2** (Início)              | 1 a 2          | 0               | 7 seções             | 1 pergunta      |
| e. Check-in no dia                       | 2 + 1 por pessoa    | 1 + 1 por pessoa                              | 0              | 0               | 0                    | 0               |
| f. Conduzir o ao vivo                    | 3 a 4 + 1 por etapa | 2 + 1 por etapa                               | 0              | 0               | 0                    | 0               |
| g. Aviso                                 | 4                   | 3                                             | 0              | 0               | 2 opcionais visíveis | 0               |
| h. Oração anônima                        | 7                   | 6                                             | 0              | 0               | 3 blocos de texto    | 1 pergunta      |
| i. Montar o repertório e tocar           | cerca de 15 (est.)  | 7 para montar com 4 músicas; 2 a 3 para tocar | n/d            | 0               | n/d                  | n/d             |
| j. Convite por link, sem comunidade      | 3 (est.)            | 2                                             | 1              | 0               | 3                    | 1               |

### (a) Primeira abertura e entrar numa comunidade

**Depois da entrada (login v2, fora do escopo):**

```
Comece por aqui
  "Você recebeu um código ou um link?"
  [ Tenho um código ]                      <- primário, a única decisão
  (Procurar minha comunidade)   (Criar uma comunidade)

Tenho um código  (uma tela, com ou sem conta)
  Código ou link  [ ABCD 2345 ]  (Colar)   <- exemplo no texto de ajuda, não no campo
  "Exemplo: ABCD 2345"
  ---- (ao digitar o código, aparece a prévia) ----
  +-----------------------------------+
  | (JE) Jovens Esperança             |
  | 15 pessoas                        |
  +-----------------------------------+
  [x] Concordo em participar          <- logo acima do botão, nunca atrás da barra
  [ Entrar em Jovens Esperança ]
  (Adicionar mensagem para a liderança)  <- link; o campo só abre se tocar

Boas-vindas (uma vez)
  "Tudo pronto, Ana."
  "Você entrou em Jovens Esperança. Quando a liderança marcar um encontro
   ou chamar você para servir, a gente avisa pelo celular."
  [ Ligar os avisos ]    (Agora não)
```

- **Toques por código manual:** `Tenho um código` (1), `Colar` (2), `Entrar em Jovens Esperança` (3), `Ligar os avisos` (4). **Por link:** o código chega preenchido: `Entrar` (1), `Ligar os avisos` (2).
- **O que muda de verdade:** decisões de 3 para 1; zero rolagem (a concordância sobe até acima do botão); a pessoa **vê a comunidade antes de entrar** (menos medo de entrar no lugar errado); a boas-vindas pede a única permissão que faz o app valer.
- **Coordenar com o grupo da entrada:** a concordância da fé (TC-03) pedida uma vez só, no cadastro ou aqui, nunca nas duas (D51).
- **Erros:** `Código não encontrado. Confira as letras e os números, ou peça outro à liderança.` com o link `Como conseguir um convite`. Código vencido: `Este convite venceu. Peça um novo à liderança.` com o botão `Pedir um novo convite por mensagem` (abre o WhatsApp com o texto pronto).
- **Se a comunidade pede aprovação:** a tela depois de `Entrar` diz `Pedido enviado. A liderança de Jovens Esperança vai avaliar. Você recebe um aviso.` e o Início mostra um cartão `Aguardando aprovação` com `Cancelar pedido`.

### (b) "O que eu faço neste sábado?"

- **Caminho:** abrir o app. **Toques: 0. Rolagens: 0.**
- O cartão do momento responde: `EM 5 DIAS`, data completa, hora, local, `Sua parte: Louvor · Vocal ✓ Confirmado`.
- **O que some:** "Seu resumo" cheio de zeros e a leitura de 6 blocos (já feito em D62); o v3 acrescenta a etiqueta de proximidade e o botão certo por estado.
- **Caminho de erro:** sem internet, o cartão aparece com `Última versão: hoje, 14:32`.

### (c) Aceitar ou recusar uma convocação

- **Caminho:** o toque chega pelo sino ou pelo Início. **Aceitar: 1 toque. Recusar: 1 toque** (antes 2 por causa do diálogo).
- **Depois de tocar:**
  - `Aceitar`: o botão vira `✓ Confirmado` na hora (atualização otimista). Toast `Você está no Louvor, sábado 28. Desfazer` por 10 s. O cartão deixa de ser "pendente" e vira a linha `Você: Louvor · Vocal ✓ Confirmado`.
  - `Não posso ir`: sem diálogo. O cartão mostra `Você avisou que não pode.` com `Desfazer` por 10 s. A liderança só é avisada quando o prazo acaba (ou quando a pessoa sai do app).
- **Várias pendentes:** na lista `Para responder`, **deslizar para a direita aceita** (com `Desfazer`); deslizar para a esquerda **revela** `Não posso ir` e só envia quando a pessoa toca (recusar nunca acontece por gesto sozinho). Os botões visíveis continuam ali (seção 5.4).
- **Primeira vez na vida:** o primeiro `Aceitar` de uma conta ganha o momento de encanto (seção 6.3): `Que bom ter você no Louvor.`
- **Caminho de erro:** `Não deu para registrar sua resposta. Toque para tentar de novo.` e o cartão volta a `Aguardando sua resposta`.

### (d) Líder cria o encontro e convoca a banda em no máximo 5 toques

**Como funciona "Igual ao último sábado":**

- **O que é o "último":** o encontro mais recente já realizado (ou publicado e passado) da mesma comunidade e do mesmo **título**. Se houver mais de um título, a tela lista até 3 (`Sábado Jovem, 21 de nov.`, `Noite de Louvor, 4 de dez.`), o mais recente pré-marcado.
- **O que copia:** título, hora, local, descrição, **roteiro** (etapas, ordem, duração), **quem foi convocado** (como `aguardando`, sem avisar ninguém), regras de inscrição (vagas, aberto ao público), tarefas e checklist (zerados).
- **O que não copia:** repertório (as músicas mudam toda semana; existe a linha `Levar as músicas também` desligada), presença, inscritos, avisos, status, histórico do ao vivo.
- **A data:** a próxima data livre **depois da última**, no mesmo dia da semana e na mesma hora (último em 21/11, sábado: sugere 28/11). Se já existe um encontro com o mesmo título naquele dia, sugere o seguinte.
- **A conferência antes de publicar** é uma tela de resumo, não de formulário:

```
Novo encontro: Igual ao último sábado
+--------------------------------------+
| Sábado Jovem                         |
| [ Sáb., 28 de nov. ] [ 16:00 ]       |  toque troca (chips: Este sábado,
| Salão da igreja                      |   Próximo sábado, Outra data)
|                                      |
| Roteiro: 7 etapas, 1 h               |  (Ver)
| Banda e equipe: 11 pessoas           |  (Ver)
|   Bruno avisou que não pode neste    |
|   dia.  (Trocar)                     |
| [ ] Levar as músicas também          |
|                                      |
| (Mais opções)                        |
| [ Salvar rascunho ]                  |
| [ Publicar e avisar 11 pessoas ]     |
+--------------------------------------+
```

**Contagem de toques:**

| Caminho                                               | Toques                                                                                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pelo Início** (estado `Terminou` ou `Nada marcado`) | 1 `Marcar o próximo sábado` (abre já na conferência, com "Igual ao último" aplicado) + 2 `Publicar e avisar 11 pessoas` = **2 toques**         |
| **Pela Agenda**                                       | 1 aba Agenda, 2 `Novo encontro`, 3 `Igual ao último sábado`, 4 `Publicar e avisar 11 pessoas` = **4 toques**                                   |
| Com data diferente                                    | +2 (tocar a data, escolher no seletor)                                                                                                         |
| Trocando uma pessoa                                   | +3 (tocar em `Trocar`, marcar outra pessoa, `Trocar`)                                                                                          |
| Sem encontro anterior (primeira vez)                  | `Novo encontro`, `Sábado padrão` (modelo recomendado), conferir, `Publicar`: 4 toques, mas sem banda; a banda se convoca em `Convocados` (3.5) |

Depois de `Publicar e avisar 11 pessoas`, o botão vira `✓ Publicado` e o toast diz `Publicando e avisando 11 pessoas em 10 s. Desfazer`. Ao fim dos 10 s, os avisos saem e o toast vira `Publicado. 11 pessoas avisadas.` Se a pessoa sair do app durante a espera, **envia na hora** (nunca perde) e, se o app for encerrado à força, o encontro fica como rascunho (nada vai a ninguém por acidente).

**Nunca** o app publica sozinho: "Igual ao último sábado" só cria um rascunho pronto. O botão final é do líder.

### (e) Check-in no dia

- **Caminho:** Início, `Fazer check-in` (1 toque, aparece de 2 h antes até o fim do encontro). Em seguida, 1 toque por pessoa (antes: 2 para chegar e 1 por pessoa).
- Detalhes na seção 3.8: linha inteira como alvo, contador, `Marcar todos que aceitaram`, `Ler QR`, funciona sem internet.
- **Caminho de erro:** presença que não gravou volta ao estado anterior com o aviso; sem internet, entra na fila.

### (f) Conduzir o ao vivo

- **Caminho:** Início, `Conduzir ao vivo` (1), `Iniciar o encontro` (2), depois `Próxima etapa: ...` (1 por etapa). Antes: 3 a 4 para começar.
- O primário **nomeia a etapa seguinte**; `Voltar` (com texto) desfaz o último avanço; `Encerrar` tem `Desfazer`. Seção 3.9.
- **Caminho de erro:** sem conexão, a condução continua e sincroniza; o chip diz `Sem conexão` com ícone.

### (g) Publicar um aviso

- **Caminho:** Comunidade, `Novo aviso` (2 toques), escrever título e texto (2 campos), `Publicar e avisar 15 pessoas` (3). **3 toques e 2 campos** (antes: 4 toques).
- `Mostrar até` e `Fixar no topo` ficam em `Mais opções`, fechado.
- O aviso espera 10 s com `Desfazer` antes de notificar (como em d).
- **Erro:** campos preservados (nunca perder o que foi digitado, mesmo com falha de rede); `Não deu para publicar. Seu texto está guardado. Tente de novo.`

### (h) Pedido de oração anônimo

```
Novo pedido de oração
  Escreva o pedido  [ texto, cresce com o conteúdo ]  0/280
  Quem vai ver?   (uma escolha, 3 cartões de opção)
    ( ) Só eu             "Fica guardado só para você."
    ( ) Equipe de oração  "3 pessoas, além de você."
    ( ) Toda a comunidade "15 pessoas, além de você."
  (aparece só se não for "Só eu")
  [ ] Publicar como Anônimo
      "Seu nome não aparece para ninguém. Nem para a liderança."
      (ou, desligado: "Seu nome aparece para quem pode ler.")
  [ Publicar pedido ]
        -> folha de resumo (privacidade, 1 vez):
  "Vai aparecer como Anônimo para 15 pessoas."
  "Só quem você escolheu vê. Quem cuida do servidor consegue ler se precisar. Evite nomes e doenças de outras pessoas sem a permissão delas." (Entenda como é guardado)
  [ Publicar como Anônimo ]   (Voltar)
```

- **Toques:** Comunidade (1), `Pedir oração` (2), [escrever], escolher `Quem vai ver` (3), `Anônimo` (4), `Publicar pedido` (5), `Publicar como Anônimo` na folha de resumo (6). **6 toques** e 1 campo (antes: 7). A folha é o único passo de confirmação e **fica**: é decisão de privacidade (D55, D62) e o app prometeu isso.
- **O que some:** 3 blocos de texto técnico; as duas frases contraditórias do interruptor (só a do estado atual aparece); o anonimato visível quando a escolha é "Só eu".
- **Caminho de erro:** o texto é preservado; `Não deu para publicar. Seu pedido está guardado neste aparelho enquanto você tenta de novo.` **Atenção de privacidade:** o texto do pedido nunca vai para o armazenamento offline (CLAUDE.md, seção 5); o texto fica só na memória da tela e se perde se o app fechar. A mensagem de erro não deve prometer guardar.

### (i) Montar o repertório e tocar com a cifra

**Montar (organização):**

1. Início, no cartão do líder, a linha `Louvor: 0 músicas`: `Montar o repertório` (1).
2. Folha `Adicionar músicas` com busca e a lista `Tocadas nos últimos sábados` primeiro; marcar 4 músicas (2 a 5).
3. `Adicionar 4 músicas` (6).
4. Ordem e tom: `Subir`, `Descer` por botão; `Tom do dia` com `-` e `+`. Se não mexer, 0 toques.
5. `Avisar a banda` (7). O aviso não diz nome de música (já é assim) e espera 10 s com `Desfazer`.

**Total: 7 toques para 4 músicas** (estimativa; antes, cerca de 15: seis para chegar ao repertório e um bloco de toques por música; não medido). Com `Levar as músicas também` ligado em "Igual ao último sábado", o repertório já nasce pronto.

**Tocar (músico):** Início, `Abrir o repertório` (1), a música (2) para ler; `Modo palco` (3) para tocar. Ao aceitar a convocação o app já baixou o repertório; `Baixado para usar sem internet ✓` aparece na lista. **Caminho de erro:** sem repertório baixado e sem internet, `Este repertório ainda não está no seu aparelho. Conecte-se para baixar.`

### (j) Convite por link, chegada ao app sem comunidade

```
Bia toca o link no WhatsApp
  |- Já tem o app: abre direto em "Tenho um código" com o código preenchido
  |- Não tem o app: abre a página do convite (web)
  |     "Jovens Esperança convidou você"
  |     "Próximo encontro: Sábado Jovem, sábado, 28 de nov., 16:00" (se público)
  |     [ Baixar o app ]   (Continuar no navegador)
  |     O código é copiado para a área de transferência.
  |
  `- Depois de instalar e entrar: o app mostra
       "Você tem um convite para Jovens Esperança. [ Usar o convite ]"
       (lido do convite guardado ou do código colado)
```

- **Toques:** com o app instalado: tocar o link (1, fora do app), `Entrar em Jovens Esperança` (2), `Ligar os avisos` (3, opcional). Antes (estimativa): tocar o link, passar pelo login, `Tenho um código`, a concordância, `Entrar`: 3 a 4.
- **Sem o app:** a página web mostra a comunidade e o próximo encontro público antes de pedir instalação (a pessoa vê o que ganha antes de gastar 40 MB). O código copiado resolve o "convite perdido na instalação" no iOS, onde o link da loja não leva parâmetro; ao abrir pela primeira vez, o app oferece `Colar o convite que você recebeu` (o sistema pede a permissão de colar; é uma pergunta honesta e uma só).
- **Erro e vazio:** link inválido ou vencido: `Este convite venceu ou não existe.` com `Pedir um novo convite por mensagem`.
- **Quem chega sem convite e sem comunidade:** Início mostra `Comece por aqui` (a mesma pergunta do fluxo a). Nunca um Início vazio com abas mortas: as abas Agenda e Comunidade, sem comunidade, mostram a mesma pergunta e o mesmo botão.

---

## 5. Padrões de interação

### 5.1 Folha, tela ou diálogo

| Use                     | Quando                                                                           | Exemplos                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Folha**               | Uma decisão curta, sem teclado longo, que volta à tela de origem.                | Trocar de comunidade, Convocar, Calendário, Preciso de alguém no meu lugar, Modelo, Mais, Tom do dia, resumo de privacidade da oração, etapa do roteiro       |
| **Tela cheia**          | Ler ou escrever algo com mais de 3 campos, teclado longo ou rolagem.             | Encontro, Novo encontro, Novo aviso, Novo pedido, Cifra, Check-in, Ao vivo                                                                                    |
| **Faixa fixa** (banner) | Estado que dura enquanto é verdade.                                              | Sem internet, Rascunho, Aguardando aprovação                                                                                                                  |
| **Toast**               | Resultado de uma ação reversível, com `Desfazer` por 10 s (WCAG 2.2.1).          | Aceitei, Chegou, Convocado, Publicado                                                                                                                         |
| **Diálogo**             | Só perda definitiva e que não se adia: a ação não tem como desfazer nem esperar. | Excluir a conta, Sair da comunidade (apaga o que está no aparelho), Cancelar o encontro (já avisou gente), Apagar o que foi digitado ao sair de um formulário |

**As 3 perguntas que decidem (regra de ouro):**

1. **É reversível?** Então `Desfazer`, nunca diálogo.
2. **Avisa outras pessoas?** Então o aviso espera 10 s e dá para desistir (5.2).
3. **Apaga para sempre ou mexe em privacidade?** Então diálogo ou folha de resumo, com a consequência escrita e o botão com o verbo (`Excluir minha conta`, `Publicar como Anônimo`).

**Dos diálogos "Tem certeza?" que existem hoje, viram `Desfazer`:** `Não posso ir` (hoje confirmação nativa), `Publicar` no detalhe do encontro (hoje confirma), `Encerrar o ao vivo` (hoje confirma). Restam os de perda definitiva acima.

### 5.2 Desfazer e envio com espera

- **Desfazer de ação local** (Chegou, Convocar, Marcar tarefa, Subir uma música): atualização na hora e toast com `Desfazer` por **10 s**. A resposta do servidor é confirmada em segundo plano.
- **Desfazer de ação que avisa pessoas** (Publicar e avisar, Aviso, Avisar a banda, Lembrar, Não posso ir): a interface mostra o resultado na hora, mas **a chamada à API só sai depois de 10 s** (ou quando a pessoa sai do app, troca de tela por mais de 10 s ou toca em outro lugar que a confirme). `Desfazer` cancela e restaura o estado. Se o app for encerrado à força durante a espera, **nada foi enviado**: o que era publicação fica rascunho, o que era resposta volta a pendente. O erro seguro é sempre o de não enviar.
- **Texto exato do toast:** o verbo no presente, o número de pessoas e `Desfazer`. Exemplos: `Publicando e avisando 11 pessoas. Desfazer`, `Você avisou que não pode ir. Desfazer`.
- **Leitor de tela:** o toast é anunciado uma vez (`Desfazer disponível por 10 segundos`) e o botão `Desfazer` é focável; o foco **não** é roubado.
- **Esta é uma decisão do dono** (Q4): muda o comportamento de um clique que hoje é imediato.

### 5.3 Atualização otimista

- **Sim (a interface muda na hora; erro desfaz com mensagem):** Aceitar, Chegou, marcar tarefa, `Estou orando`, marcar notificação como lida, subir e descer de música, `Posso ajudar` no calendário.
- **Não (espera o servidor, com botão em estado de carregando):** Publicar pedido de oração (privacidade), Enviar pedido de entrada, Excluir conta, Convidar (gera um código), Trocar papel de alguém.
- **Regra de falha:** o elemento volta ao estado anterior e diz o motivo: `Não deu para marcar Ana. Toque para tentar de novo.` O texto digitado nunca se perde.

### 5.4 Deslizar para aceitar ou recusar

- **Só onde há lista de convocações** (`Para responder`, Agenda em "Só o que é meu" com várias pendentes). Usa `react-native-gesture-handler` e Reanimated, que **já estão instalados**: não exige dependência nova.
- **Direita:** aceita, com o fundo da linha mostrando o ícone de check e o texto `Aceitar` (nunca só cor); ao soltar além de 40% da largura, aceita e mostra `Desfazer`.
- **Esquerda:** **revela** o botão `Não posso ir` (não envia sozinho). Recusar é mais caro de errar do que aceitar, então exige um toque.
- **Nunca é o único caminho:** os botões `Aceitar` e `Não posso ir` continuam visíveis na linha, e cada linha expõe ações de acessibilidade (`Aceitar`, `Não posso ir`) para VoiceOver e TalkBack (seção 7).
- **Por que não em todo lugar:** gesto escondido é o problema que o app já evita (CLAUDE.md, seção 7). Ele é um atalho para quem tem 3 pendências, e só.

### 5.5 Puxar para atualizar

Em **Início, Agenda, Comunidade, Notificações, Check-in, Convocados e Pessoas**. Não no Ao vivo (atualiza sozinho) nem em formulários. O indicador é o do sistema. Ao terminar, sem toast; o texto de status do cabeçalho muda para `Atualizado agora`. Com Reduzir movimento, o sistema já respeita.

### 5.6 Estados vazios que ensinam e têm uma ação

Um vazio responde a três perguntas: **o que é isto?**, **por que está vazio?**, **o que faço agora?** Sempre com uma ação, exceto quando a ação não é da pessoa (membro esperando a liderança). Nesse caso, o texto diz o que vai acontecer e como será avisado.

| Tela                          | Título                                               | Texto                                                                              | Ação                              | Ilustrar?                    |
| ----------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------- | ---------------------------- |
| Início, membro, sem encontro  | `Ainda não há encontro marcado.`                     | `Quando a liderança marcar o próximo, ele aparece aqui e você recebe um aviso.`    | `Ligar os avisos` (se desligados) | Sim, sol atrás do horizonte  |
| Início, líder, sem encontro   | `Nenhum encontro marcado.`                           | `Monte o próximo: o Sábado padrão já vem com o roteiro de sempre.`                 | `Marcar o próximo sábado`         | Sim                          |
| Resumo sem pendência          | `Tudo em dia`                                        | (nenhum)                                                                           | (nenhuma)                         | Ícone do sol, sem ilustração |
| Agenda, "Só o que é meu"      | `Você não tem nenhuma parte nos próximos encontros.` | `Se quiser ajudar, diga em quais dias você pode.`                                  | `Dias em que posso ajudar`        | Não                          |
| Avisos                        | `Nenhum aviso por enquanto.`                         | Líder: `Escreva o primeiro aviso.` Membro: `Os avisos da liderança aparecem aqui.` | Líder: `Novo aviso`               | Sim                          |
| Pedidos de oração             | `Nenhum pedido ainda.`                               | `Quem pedir oração aparece aqui. Você pode ser o primeiro.`                        | `Pedir oração`                    | Sim                          |
| Pessoas                       | `Por enquanto, só você.`                             | `Convide o grupo para o Uni Jovem.`                                                | `Convidar`                        | Sim                          |
| Convocados                    | `Ninguém convocado ainda.`                           | `Convoque quem vai servir neste encontro.`                                         | `Convocar pessoas`                | Não                          |
| Check-in                      | `Ninguém convocado ou inscrito.`                     | `Procure pelo nome ou leia o QR de quem chegou.`                                   | `Ler QR`                          | Não                          |
| Meu repertório, não convocado | (D73: abre o Repertório do encontro, em leitura)     | `Ainda não há encontro marcado.` quando não há encontro                            | (nenhuma)                         | Não                          |
| Sino                          | `Nenhuma novidade.`                                  | `Avisos, convocações e lembretes aparecem aqui.`                                   | (nenhuma)                         | Sim, pequena                 |
| Sem comunidade                | `Você recebeu um código ou um link?`                 | `Com ele você entra no seu grupo em poucos segundos.`                              | `Tenho um código`                 | Sim                          |

**Onde ilustrar e como:** só em tela inteira vazia ou de primeira vez (colunas acima), nunca em linha ou seção. A família é uma só: o **sol da marca** em cinco poses (atrás do horizonte para "ainda não", metade para "quase", inteiro para "tudo em dia", com um pequeno objeto para "oração" e "pessoas"). 96 pt, traço e preenchimento coral, decorativa e escondida do leitor de tela. Parada, exceto o `Tudo em dia` que nasce uma vez (seção 6.3). Sem texto dentro da imagem.

### 5.7 Pressionar e segurar

- **Linha da Agenda:** `Ver o encontro`, `Compartilhar`, `Como chegar` (organização: `Copiar este encontro`, `Cancelar ou adiar`).
- **Pessoa no Check-in:** `Ver a pessoa`, `Desfazer presença`.
- **Linha da Biblioteca:** `Abrir cifra`, `Adicionar ao repertório` (organização).
- **Regra:** o menu de segurar contém **só** o que já existe no botão `Mais` da linha ou da tela. Nada exclusivo do gesto. O menu usa o do sistema (iOS e Android), que dá a leitura por voz de graça.
- **Descoberta:** a primeira vez (por conta) que o menu poderia ajudar, uma dica de uma linha (`Dica: segure para ver mais ações.`), uma só vez por conta, dispensável.

### 5.8 Carregamento com esqueleto

- Aparece **depois de 300 ms** (já é assim, `atrasoDoEsqueleto`); carga rápida não pisca.
- **Forma final:** o esqueleto do Início tem um cartão de 190 pt, uma linha de 72 pt e uma de 64; o da Agenda tem 3 linhas de 88; o do Check-in tem o contador e 6 linhas de 72. Mesmas margens e mesma altura do conteúdo final, para não pular.
- **Pulso** de 1200 ms (já é assim); com Reduzir movimento, estático.
- **Nada de spinner de tela inteira** e de barra no topo. Botões têm o indicador próprio depois de 250 ms (já é assim).
- **Mais de 10 s:** o esqueleto vira `Demorando mais do que o normal. Confira a internet.` com `Tentar de novo`.

### 5.9 Erros que explicam e oferecem saída

Fórmula: **o que aconteceu, o que fazer, e um botão que faz.** Sem desculpa, sem código, sem "algo deu errado" (UX regra 4).

| Situação                                   | Texto                                                                  | Botão                                    |
| ------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------- |
| Sem internet ao carregar                   | `Sem internet. Mostrando a última versão, salva às 14:32.`             | `Tentar de novo`                         |
| Servidor indisponível                      | `Não conseguimos carregar agora. Tente de novo em alguns instantes.`   | `Tentar de novo`                         |
| Ação falhou                                | `Não deu para registrar sua resposta. Toque para tentar de novo.`      | `Tentar de novo` (no toast)              |
| Sem permissão ou de outra comunidade (404) | `Não encontramos isto. Pode ter sido removido.`                        | `Voltar ao Início`                       |
| Campo inválido                             | `Escreva um e-mail completo, como nome@exemplo.com.`                   | (o campo foca)                           |
| Sessão vencida                             | `Sua sessão terminou. Entre de novo para continuar.`                   | `Entrar`                                 |
| Convite vencido                            | `Este convite venceu. Peça um novo à liderança.`                       | `Pedir um novo convite por mensagem`     |
| Câmera negada (QR)                         | `O app precisa da câmera para ler o QR. Você pode procurar pelo nome.` | `Abrir os ajustes`, `Procurar pelo nome` |

O formulário **nunca** perde o que foi digitado (UX regra 5). O erro de campo aparece ao sair do campo; o erro do envio, ao enviar, com o balanço de 260 ms do login v2 (seção 6).

### 5.10 Uso sem internet: o que continua e como mostrar

O app já tem uma fila e um pacote do encontro guardado no aparelho (SQLCipher), **só no app nativo** (na web nada fica guardado). O desenho mostra isso com honestidade.

| O que                                                            | Sem internet                                                                           | Como aparece                                                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Ver Início, Agenda, Comunidade                                   | Mostra a última versão salva (a verificar no aparelho se a cópia de cada aba persiste) | Faixa `Sem internet. Você vê a última versão, salva às 14:32.`                               |
| Encontro baixado: roteiro, equipe, tarefas, checklist, materiais | Funciona                                                                               | Selo `Baixado ✓` no encontro                                                                 |
| Check-in, marcar tarefa, checklist, inscrição                    | Funciona, entra em fila                                                                | `Sem internet. Vai quando voltar.` e o contador `(2 esperando internet)`                     |
| Ao vivo                                                          | Funciona com o encontro baixado, entra em fila                                         | Chip `Sem conexão` com ícone, `Você pode continuar.`                                         |
| Cifra e Modo palco                                               | Funciona se o repertório estiver baixado (fatia 2 do modo músico)                      | `Baixado para usar sem internet ✓`                                                           |
| Aceitar, Não posso ir                                            | **Não** (decisão: uma resposta duvidosa na fila gera conflito)                         | Botão desabilitado: `Precisa de internet para responder.`                                    |
| Publicar, avisar, convocar, lembrar                              | **Não**                                                                                | Botão desabilitado: `Precisa de internet para avisar as pessoas.` e o rascunho fica guardado |
| Pedido de oração                                                 | **Não** (texto nunca vai para o armazenamento offline)                                 | `Precisa de internet para publicar. O texto não é guardado no aparelho.`                     |

- **O app nunca fica mudo:** a faixa de aviso e o status do cabeçalho (`Tudo salvo · 14:32`, `3 alterações esperando internet`) são os dois lugares do estado de conexão. O status abre `Uso sem internet` (a antiga tela `pendencias`).
- **Baixar sozinho (fase 2):** o próximo encontro é baixado em Wi-Fi para quem tem parte ou organiza. Ao aceitar uma convocação, o app baixa na hora. O botão manual continua existindo.
- **O que exige decisão:** hoje só funciona em app nativo; a versão web nunca mostra "baixado".

### 5.11 Háptico

`expo-haptics` **não está instalado**. Adicioná-lo é uma dependência do próprio Expo, sem custo recorrente, que exige um novo build nativo e o "sim" do dono (CLAUDE.md, seção 4, só pede aprovação para gasto, publicação e mudança estrutural; uma dependência nova é mudança pequena, mas deixo como pergunta Q5 por exigir novo build).

| Onde ajudaria                         | Tipo                | Por quê                                               |
| ------------------------------------- | ------------------- | ----------------------------------------------------- |
| `Aceitar` e `Chegou`                  | leve (impacto)      | Confirma sem olhar, em pé, com fila na porta.         |
| Erro ao registrar                     | notificação de erro | A pessoa percebe que não valeu, mesmo sem ver a tela. |
| Passar o limite do deslizar (aceitar) | seleção             | Mostra "agora vale" antes de soltar.                  |
| `Próxima etapa` no Ao vivo            | médio               | Quem conduz olha para a sala, não para a tela.        |
| Mudar de segmento, Subir e Descer     | seleção             | Confirma o gesto.                                     |

**Regras:** respeitar a configuração do sistema (sem háptico ligado, nada), nunca ser o único sinal (sempre há texto e forma), e nunca em rolagem ou digitação.

---

## 6. Movimento com propósito

### 6.1 Princípios

1. **O movimento explica de onde veio ou para onde vai.** Se não explica, não existe.
2. **Responde em 100 ms, termina em 200 a 300 ms.** O app é de uso rápido, em pé, em fila. Nada passa de 350 ms em ação comum.
3. **Só `opacity` e `transform`** (translate e scale), como no login v2 e nos controles (D63, D64). Cor muda por camada que muda de opacidade.
4. **Nunca bloqueia o toque** nem faz esperar para agir.
5. **A marca é rara.** O sol aparece em cinco momentos e só uma vez por conta cada um.
6. **Reduzir movimento troca deslocamento por dissolução** de 80 a 120 ms (ou troca imediata). Nenhum movimento carrega informação que o texto não tenha.
7. **Reaproveitar o que existe:** curvas `saida` (0,22, 1, 0,36, 1), `padrao` (0,4, 0, 0,2, 1) e `saidaDeTela`; molas `toque` e `check`; `DURACAO.aparecer` (200 ms); `MOVIMENTO_DOS_CONTROLES` (balanço, foco, erro). Não nascem tokens novos, exceto os marcados na tabela.

### 6.2 Catálogo

| Transição                                 | O que o movimento comunica                                                                                                                         | Duração e curva (aproximadas)                                                                                                     | Com Reduzir movimento                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Entre abas**                            | "Estas telas são pares, não pai e filho." A tela nova dissolve; a pílula da aba ativa desliza até a nova.                                          | Tela: dissolve 160 ms, `padrao`. Pílula: mola `toque` (cerca de 250 ms).                                                          | Dissolve 120 ms; a pílula troca sem deslizar.                                            |
| **Abrir o encontro** (de cartão ou linha) | "Estou entrando mais fundo, e posso voltar."                                                                                                       | Entrada nativa da pilha (cerca de 350 ms, do sistema, com o gesto de voltar).                                                     | O sistema troca por dissolve.                                                            |
| **Abrir uma folha**                       | "Isto é uma decisão curta sobre a tela de baixo."                                                                                                  | Nativa do sistema (a folha sobe 300 a 400 ms com mola); o fundo escurece 200 ms.                                                  | O sistema dissolve a folha.                                                              |
| **Aceitar uma convocação**                | "Valeu, e agora é seu." O botão `Aceitar` vira `✓ Confirmado`; o outro botão some; a linha encolhe.                                                | Rótulo: troca com dissolve 120 ms; check: escala 0,6 a 1 com mola `check` (cerca de 200 ms); linha: altura 200 ms, `padrao`.      | Troca de rótulo com dissolve de 120 ms; sem escala e sem altura animada (troca na hora). |
| **Check-in feito**                        | "Registrado." O botão `Chegou` vira o chip `✓ Presente`; o contador troca o número.                                                                | Chip: escala 0,9 a 1 e opacidade, 160 ms, `saida`. Número: dissolve 120 ms (sem rolar dígitos).                                   | Chip por dissolve de 120 ms, sem escala; número troca na hora.                           |
| **Aviso novo** (app aberto)               | "Chegou novidade." Só o sino reage: o número do selo "estoura" 1,0 a 1,15 a 1; a linha do aviso fixado (se for ela) entra de cima.                 | Selo: 160 ms, `saida`. Linha: 200 ms, `aparecer`.                                                                                 | O número troca na hora; a linha aparece por dissolve.                                    |
| **Erro**                                  | "Não valeu, e aqui está o que fazer." Em formulário, o campo balança; em carregamento, o bloco aparece.                                            | Balanço do campo: 260 ms (cinco pontos, os valores do login v2). Bloco de erro: dissolve 160 ms. Linha de erro sobe 4 pt, 200 ms. | Sem balanço; dissolve de 120 ms.                                                         |
| **Carregando**                            | "Estou buscando; a forma final é esta."                                                                                                            | Esqueleto depois de 300 ms; pulso 1200 ms. Botão: indicador depois de 250 ms (140 ms entra).                                      | Esqueleto estático; botão igual.                                                         |
| **Trocar de comunidade**                  | "Mudei de lugar." O nome na pílula troca (dissolve 160 ms, o avatar gira meia volta, cerca de 200 ms) e o conteúdo abaixo recarrega com esqueleto. | Pílula: dissolve 160 ms, `padrao`; avatar: virada de 200 ms. Conteúdo: `aparecer` 200 ms.                                         | Pílula troca por dissolve; avatar sem giro.                                              |
| **Sucesso** (publicar, enviar)            | "Foi." O botão vira `✓` e o toast sobe.                                                                                                            | Indicador vira check em 200 ms (igual ao login v2); toast sobe 8 pt e aparece em 200 ms.                                          | Check por dissolve de 120 ms; toast por dissolve.                                        |
| **Subir e descer** (música, etapa)        | "Mudou de lugar." A linha troca de posição.                                                                                                        | Deslocamento 200 ms, `padrao`; o leitor anuncia a nova posição.                                                                   | Troca na hora, com o anúncio.                                                            |
| **Acordeão** (resumo, versículo)          | "Abri e fechei." Altura e seta.                                                                                                                    | Altura e dissolve 200 ms, `padrao`; seta gira 180 graus em 200 ms.                                                                | Abre sem animação (já é assim, D62).                                                     |
| **Desfazer**                              | "Voltei atrás." O elemento volta ao estado anterior.                                                                                               | Mesmo movimento do ato, ao contrário, em 160 ms.                                                                                  | Troca na hora.                                                                           |
| **Pressionar** botão                      | "Peguei." Escala 0,98 e camada de pressionado.                                                                                                     | 90 ms ao tocar, mola `toque` ao soltar (igual aos controles).                                                                     | Só a camada, 80 ms.                                                                      |

Tokens novos que o desenho pede (só nome e valor, para o código criar): `MOVIMENTO_DAS_TELAS` com `abaDissolve` 160, `pilulaDaAba` (mola `toque`), `linhaEncolhe` 200, `chipPresente` 160, `seloEstoura` 160, `avatarDaPilula` 200. Tudo em `packages/tokens/src`, ao lado de `MOVIMENTO_DOS_CONTROLES`.

### 6.3 Momentos de encanto: o sol, raros e discretos

Cinco momentos, **cada um uma só vez por conta** (guardado no aparelho; reinstalar pode repetir, e tudo bem), no máximo **um por sessão**, nunca bloqueia toque, máximo 600 ms, e sempre com o texto no lugar da animação com Reduzir movimento.

| #   | Momento                                                     | O que acontece                                                                                         | Texto                                                      | Reduzir movimento    |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------- |
| 1   | **Primeiro `Aceitar` da conta**                             | Um halo do sol nasce por trás do cartão (opacidade 0 a 0,35, escala 0,8 a 1, 600 ms) e some em 400 ms. | `Que bom ter você no Louvor.` (a parte da pessoa na frase) | Só o texto, por 4 s. |
| 2   | **Primeira presença marcada pela liderança**                | O contador ganha um arco de sol que se completa até o primeiro número (500 ms).                        | `Primeira presença marcada. Bom sábado!`                   | Só o texto.          |
| 3   | **Primeiro encontro publicado**                             | O botão `Publicar` vira o sol (check dentro de um círculo que clareia 400 ms).                         | `Seu primeiro encontro está no ar.`                        | Só o texto.          |
| 4   | **Primeira vez que o resumo diz `Tudo em dia`**             | O sol da marca sobe devagar até o horizonte da linha (600 ms).                                         | `Tudo em dia.`                                             | Sol já no lugar.     |
| 5   | **Banda completa** (todas as funções do louvor confirmadas) | O selo `Banda completa ✓` acende uma vez (300 ms).                                                     | `Banda completa: 5 de 5.`                                  | Só o selo.           |

**O que não é encanto:** confete, balões, sons, pontos, sequência de dias ("streak"), medalhas. O app serve uma comunidade de fé; a comemoração é discreta e do grupo, não da pessoa contra si mesma.

---

## 7. Acessibilidade embutida

### 7.1 Fonte grande do sistema

- **Alvo de teste:** escala 1,0, 1,35 (xxxGrande), 2,0 e AX5.
- **Quatro abas** em vez de cinco dão 25% de largura por aba em vez de 20%. O rótulo da aba tem teto de 1,6; acima disso, a pessoa tem o **visualizador de conteúdo grande** do iOS (verificar no aparelho) e o `Perfil` continua com avatar mais texto.
- **Botões em par empilham** (primário em cima, `Não posso ir` embaixo) a partir de 1,35, como já é.
- **Segmentos de 2 ou 3 opções** (`Todos / Só o que é meu`) viram lista vertical com fonte grande (A1, já feito em D62).
- **Cartão do momento** cresce em altura, nunca em largura; o limite de linhas é removido de título e local (A9). A linha `Sua parte` nunca é truncada.
- **A Agenda** usa uma linha por encontro com a data grande à esquerda; com fonte grande, a data vai para cima da linha.
- **Texto que informa em 14 pt ou mais** (nada de 12 ou 13). A meta de 16 de `corpo` e `meta` (auditoria 21/11, 3.2) entra na fase 3.

### 7.2 VoiceOver e TalkBack: ordem de leitura e anúncios

**Ordem de leitura do Início:** `Bom dia, Carla` (nível 1) > `Versículo do dia, João 15:16. Recolhido.` > `Cartão: Em 5 dias. Sábado Jovem. Sábado, 28 de novembro, 16 às 17. Salão da igreja.` > `Sua parte: Louvor, Vocal. Aguardando sua resposta.` > `Aceitar, botão` > `Não posso ir, botão` > `Para responder, 1` > `Seu resumo, 1 coisa esperando você. Recolhido, botão.` > `Aviso fixado: Ensaio às 15h, botão.`

**Anúncios das ações novas** (uma vez, voz educada, sem roubar foco):

| Ação                    | O leitor diz                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Aceitar`               | `Você aceitou. Louvor, Vocal, sábado 28 de novembro. Desfazer disponível por 10 segundos.`                                            |
| `Não posso ir`          | `Você avisou que não pode ir. Desfazer disponível por 10 segundos.`                                                                   |
| Marcar presença         | `Ana Ribeiro, presente. 9 de 15.`                                                                                                     |
| Desfazer presença       | `Presença de Ana Ribeiro desfeita. 8 de 15.`                                                                                          |
| Próxima etapa (Ao vivo) | `Etapa 3 de 7: Oração intercessora, 10 minutos.` O relógio **não** é lido a cada segundo: só em 5 min, 1 min e quando passa do tempo. |
| Subir uma música        | `Sobre a rocha, posição 1 de 4.`                                                                                                      |
| Publicar e avisar       | `Publicando e avisando 11 pessoas em 10 segundos. Desfazer disponível.`                                                               |
| Trocar de comunidade    | `Agora em Jovens Esperança.`                                                                                                          |
| Erro de ação            | O texto do erro, e o foco vai ao elemento com problema.                                                                               |

**Ações por gesto, sempre com alternativa para leitor de tela:**

- A linha `Para responder` expõe ações de acessibilidade `Aceitar` e `Não posso ir` no rotor "Ações" (VoiceOver) e no menu de ações locais (TalkBack), além dos botões visíveis.
- A linha do Check-in é um botão com o rótulo `Ana Ribeiro, inscrita. Ainda não chegou. Toque duas vezes para marcar presença.` Depois: `Ana Ribeiro, presente. Toque duas vezes para desfazer.`
- A linha da Agenda expõe `Ver o encontro`, `Compartilhar` e `Como chegar` como ações.
- O menu de segurar tem sempre o botão `Mais` equivalente (já descrito).

**Estrutura:** títulos de seção em nível 2 (rotor de títulos funciona: nível 1 só o título da tela; A10), listas anunciadas com "1 de N", o cartão do momento como um grupo com um rótulo de uma frase.

### 7.3 Alvos, contraste e cor

- **Alvos de 44 pt** em tudo: `Chegou` e as linhas do Check-in têm 72 pt; `Aceitar` e `Não posso ir` têm 48 pt (botão médio de D64); `Próxima etapa` tem 56 pt.
- **Contraste AA** (4,5:1 para texto, 3:1 para ícone e contorno de controle) nos dois temas, medido sobre o fundo real de cada tela, não sobre a cor cheia. As três direções visuais refazem a tabela com a paleta delas.
- **Cor nunca sozinha:** `✓ Confirmado`, `✓ Presente`, `Aguardando sua resposta` e `Passou 3 min` sempre com ícone e texto. A barra de "9 de 11 responderam" vem com o número escrito ao lado.
- **O fundo do deslizar** (verde de aceitar) tem ícone e a palavra `Aceitar`; a ação revelada à esquerda tem `Não posso ir` escrito.

### 7.4 Reduzir movimento, Reduzir transparência, Aumentar contraste

- Cada linha da tabela 6.2 tem o seu equivalente. Os 5 momentos de encanto viram texto.
- **Reduzir transparência:** o cartão do momento e a barra de abas têm versão opaca (já exigido pelo CLAUDE.md, seção 7).
- **Aumentar contraste:** a borda de cartão e de linha de lista sobe para 3:1.

### 7.5 Linguagem simples

- Frases de no máximo 15 palavras; verbo no começo do botão; sem jargão (`convocação`, `designação`, `etapa` no rótulo de ação, `papel`, `webhook`).
- Metas de leitura: escola de 6º ano. Teste mental com o Seu Antônio: lido em voz alta, a frase faz sentido sozinha?
- Datas absolutas com dia da semana (`Sábado, 28 de nov.`) e relativas ao lado (`Em 5 dias`), nunca só uma.

### 7.6 Onde o redesenho melhora e onde arrisca

| Melhora                                                                              | Arrisca                                                                                         | Mitigação                                                                                 |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 4 abas com rótulo e menos blocos por tela: menos coisas para ler com leitor de tela. | **Cartão do momento muda com a hora**: quem usa leitor de tela pode estranhar que o botão mude. | Etiqueta lida primeiro (`Hoje, em 3 horas`) e a ordem dos blocos nunca muda.              |
| Resposta direto na linha: menos navegação.                                           | **Deslizar** é gesto: pode ser difícil para quem tem tremor ou usa leitor de tela.              | Sempre com os botões visíveis e as ações de acessibilidade (7.2).                         |
| Desfazer em vez de diálogo: menos diálogos para ler.                                 | **Toast de 10 s** pode sumir antes de um usuário de TalkBack chegar até ele.                    | `Desfazer` focável e anunciado; leitor de tela estende o tempo (a verificar no aparelho). |
| Linha inteira de 72 pt no Check-in: acerto fácil com polegar ou com tremor.          | **Toque acidental** na linha marca presença por engano.                                         | `Desfazer` na hora e `Presença desfeita` anunciada.                                       |
| Erros e vazios com texto humano.                                                     | **Sol animado** pode causar desconforto vestibular.                                             | Só em 5 momentos, de 600 ms, desligado com Reduzir movimento.                             |
| Sem "escala" na interface: uma palavra a menos.                                      | **Tirar uma aba** desorienta quem já usava Escalas.                                             | Redirecionamento por uma versão e `Sua parte` visível em todo lugar.                      |

---

## 8. Vocabulário e voz

### 8.1 A voz

Quem escreve é um **colega que organiza o sábado com você**: calmo, direto e gentil. Fala "você" (nunca "tu" nem "o usuário"), com verbos no presente, frases curtas e sem exclamação (exceto os 5 momentos de encanto). Sem desculpa (`Desculpe`), sem pergunta retórica, sem "oops". O botão diz o que acontece. Nunca "Submeter", "Confirmar" sozinho nem "OK" quando há um verbo melhor.

### 8.2 Tabela das palavras finais

| Conceito                      | Final                              | Sai                               | Por quê                                                                                 |
| ----------------------------- | ---------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------- |
| Reunião                       | Encontro                           | evento, programação               | Decidido em D57; uma palavra só.                                                        |
| Lista de partes               | Roteiro (etapa)                    | programação, "Etapas" como título | Sem conflito com "verificação em duas etapas".                                          |
| Papel da pessoa no encontro   | Sua parte                          | escala, designação                | "Escala" vem em cinco sentidos; "parte" é o que a pessoa diz ("minha parte no louvor"). |
| Chamar para servir            | Convocar, convocado                | escalar, designar                 | Palavra do dono (D54).                                                                  |
| Pedir para outro assumir      | Preciso de alguém no meu lugar     | Pedir substituição                | Fala o que a pessoa quer; o rótulo do pedido na lista pode continuar "Pedem ajuda".     |
| Cópia de um encontro          | Igual ao último sábado             | duplicar                          | Descreve o resultado.                                                                   |
| Início de roteiro             | Modelo                             | template                          |                                                                                         |
| Quem chegou                   | Check-in, Chegou, Presente         | marcar presença, lista            |                                                                                         |
| Encontro acontecendo          | Ao vivo                            | modo palco do evento              | "Palco" fica só da cifra.                                                               |
| Quem pode ver (aviso, oração) | Quem vai ver?                      | visibilidade, escopo              |                                                                                         |
| Quem é só aquele grupo        | Equipe de oração (só esse sentido) | "equipe" para outras coisas       | "Equipe" tinha 4 sentidos; só um sobrevive.                                             |
| Cargo na comunidade           | Função na comunidade               | papel                             | Opções: Membro, Organizador, Administrador.                                             |
| Lugar de músicas              | Biblioteca                         | Conteúdos                         |                                                                                         |
| O que a pessoa toca           | Meu repertório                     | setlist, modo músico              |                                                                                         |
| Lista de novidades            | Notificações                       | Caixa de notificações             | O sino abre "Notificações".                                                             |
| Aviso do aplicativo           | Quando o app me avisa              | Ajustes de notificação            | Linha de Perfil.                                                                        |
| Segurança do login            | Código extra ao entrar             | autenticação em duas etapas, 2FA  |                                                                                         |
| Conexão                       | Sem internet, Conectado            | offline, sincronizado             |                                                                                         |

### 8.3 Notificações (texto exato)

Respeitam a privacidade (NOT-02): nunca texto de pedido de oração, nunca nome de música, nunca nome de pessoa que recusou na tela de bloqueio.

| Quando                              | Título                           | Texto                                                           | Toque leva a          |
| ----------------------------------- | -------------------------------- | --------------------------------------------------------------- | --------------------- |
| Foi convocado                       | `Você foi convocado`             | `Louvor, Vocal. Sábado, 28 de nov., 16h. Toque para responder.` | Encontro, "Sua parte" |
| Véspera de encontro                 | `Amanhã, 16h: Sábado Jovem`      | `Sua parte: Louvor, Vocal.`                                     | Encontro              |
| Dia do encontro                     | `Hoje, 16h: Sábado Jovem`        | `Salão da igreja. Toque para ver como chegar.`                  | Encontro              |
| Lembrete da organização             | `Falta responder`                | `Você ainda não respondeu: Louvor, Vocal, sábado 28.`           | Encontro              |
| Alguém recusou (para a organização) | `Uma pessoa não pode ir`         | `Sábado Jovem, 28 de nov.: Louvor. Veja quem pode assumir.`     | Convocados            |
| Pedem ajuda                         | `Pedem ajuda no sábado`          | `Projeção, 5 de dez. Você pode assumir?`                        | Agenda, "Pedem ajuda" |
| Novo aviso                          | `Novo aviso em Jovens Esperança` | `Toque para ler.`                                               | Aviso                 |
| Repertório mudou                    | `O repertório mudou`             | `Sábado Jovem, 28 de nov. Toque para ver.`                      | Meu repertório        |
| Pedido de entrada (administração)   | `Pedido de entrada`              | `Uma pessoa quer entrar em Jovens Esperança.`                   | Pedidos de entrada    |

Dentro do app, a tela de Notificações mostra o **título real** de cada coisa (`Ensaio do louvor às 15h`), não o texto genérico da notificação do sistema; o texto de pedido de oração continua nunca aparecendo.

### 8.4 Estados vazios, erros e confirmações (exemplos adicionais)

| Tipo                | Texto                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vazio               | `Nenhum aviso por enquanto.` / `Os avisos da liderança aparecem aqui.`                                                                                                                    |
| Vazio               | `Nenhuma novidade.` / `Avisos, convocações e lembretes aparecem aqui.`                                                                                                                    |
| Erro                | `Não deu para abrir este encontro. Pode ter sido removido ou você está sem internet.`                                                                                                     |
| Erro                | `Não deu para marcar Ana. Toque para tentar de novo.`                                                                                                                                     |
| Erro                | `Código não encontrado. Confira as letras e os números, ou peça outro à liderança.`                                                                                                       |
| Confirmação (toast) | `Você está no Louvor, sábado 28. Desfazer`                                                                                                                                                |
| Confirmação (toast) | `2 pessoas convocadas. Desfazer`                                                                                                                                                          |
| Confirmação (toast) | `Publicado. 11 pessoas avisadas.`                                                                                                                                                         |
| Confirmação (toast) | `Agora em Jovens Esperança.`                                                                                                                                                              |
| Diálogo (perda)     | Título: `Cancelar o Sábado Jovem?` Texto: `Vai avisar 11 pessoas que o encontro foi cancelado. Isso não pode ser desfeito.` Botões: `Cancelar o encontro` (vermelho), `Manter o encontro` |
| Diálogo (perda)     | Título: `Excluir sua conta?` Texto: `Seus dados serão apagados. Baixe uma cópia antes, se quiser.` Botões: `Excluir minha conta`, `Voltar`                                                |

---

## 9. O que eu não mexeria (e por quê) e riscos

### 9.1 O que não mexeria

| O quê                                                                                       | Por quê                                                                                             |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Rótulo visível em todo campo** e **o motivo escrito abaixo do botão desabilitado**        | É o que mais ajuda quem tem pouca prática. As duas auditorias elogiaram.                            |
| **O login v2** (D63) e **os controles v2** (D64)                                            | Acabaram de ser refeitos; refazer de novo é desperdício. O v3 só os reaproveita.                    |
| **A Aurora**, o cartão claro do próximo encontro, o tema escuro e o claro                   | É a identidade aprovada; as três direções visuais decidem o que mudar, não este documento.          |
| **O isolamento entre comunidades** (RLS, 404, inventário de rotas), **permissões, offline** | Não é UX visível, é requisito central. Qualquer rota nova entra no inventário (CLAUDE.md, seção 8). |
| **A confirmação final do pedido de oração com público ampliado** (folha de resumo)          | É decisão de privacidade e o app prometeu isso (D55, D62).                                          |
| **"Somente eu" como padrão da oração**, "Estou orando" com contagem, anonimato              | Boas decisões de privacidade e de cuidado.                                                          |
| **"Sábado padrão" pré-preenchido** e a explicação de cada função no convite                 | São os melhores atalhos que o app já tem.                                                           |
| **Desfazer do check-in** e as confirmações específicas de ação destrutiva                   | O v3 só estende o padrão.                                                                           |
| **A barra de abas flutuante com texto e ícone** (D56)                                       | Muda de 5 para 4 abas; a barra em si, a posição e o vidro não mudam.                                |
| **Relatórios**                                                                              | Tela de uso raro, números claros; só muda de lugar (Organização).                                   |
| **Português do Brasil e "Uni Jovem" na constante única** (D5)                               | Regra do projeto.                                                                                   |

### 9.2 Riscos do redesenho

| #   | Risco                                                                                                | Probabilidade e impacto | O que fazer                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Tirar a aba Escalas desorienta** quem já a usava (poucas pessoas hoje: o app está em homologação). | Média, médio            | Redirecionar `/escalas`; teste com 3 pessoas antes da loja; se 2 de 3 procurarem a aba, volta como "Minha parte". Reversível em um dia. |
| R2  | **O cartão do momento "mudar com a hora" parece que o app mudou de lugar.**                          | Média, alto             | A ordem dos blocos nunca muda; só muda a etiqueta e o botão. Testar com a voluntária.                                                   |
| R3  | **"Igual ao último sábado" copia gente que saiu ou mudou.**                                          | Média, médio            | Tela de conferência com conflitos (avisou que não pode); ninguém é avisado até publicar; 10 s de espera com Desfazer.                   |
| R4  | **Envio com espera de 10 s** confunde ("não foi?").                                                  | Média, médio            | Texto `Publicando e avisando 11 pessoas em 10 s`, com contagem e botão `Desfazer`; envia na hora se a pessoa sair do app.               |
| R5  | **Deslizar para aceitar** aceita sem querer.                                                         | Baixa, baixo            | Aceitar tem `Desfazer`; recusar nunca por gesto sozinho.                                                                                |
| R6  | **Linha inteira do Check-in** marca a pessoa errada na pressa.                                       | Média, médio            | Desfazer de 10 s, tocar de novo desmarca, linhas de 72 pt com espaço.                                                                   |
| R7  | **Escopo grande ao lado de três direções visuais** e de uma coisa em produção.                       | Alta, alto              | Fases (seção 10); o contrato (ordem, texto, estado) fica fixo e cada direção só decide aparência.                                       |
| R8  | **API nova sem teste de isolamento** quebra o CI (CLAUDE.md, seção 8).                               | Certa se esquecida      | Cada rota nova da seção 10 entra no inventário de rotas com teste de A trocando ID com B (404).                                         |
| R9  | **Háptico e atalho do ícone exigem build nativo novo.**                                              | Média, baixo            | Só na fase 3 ou junto de um build já planejado.                                                                                         |
| R10 | **Offline é só nativo**: quem usa a versão web vê promessa vazia.                                    | Média, baixo            | Mostrar "Baixado ✓" e "Baixar o encontro" **somente** no nativo; na web, a faixa de "Sem internet" diz o que não funciona.              |
| R11 | **Tirar números do Início** (presença, oração ativa) frustra quem gostava deles.                     | Baixa, baixo            | O líder tem Relatórios; o selo `3 novos` em Pedidos de oração dá a contagem útil.                                                       |
| R12 | **Cópia dos textos** passa por revisão jurídica nos pontos de privacidade (PH-11).                   | Certa                   | Só os dois textos da oração e o da concordância precisam de revisão; os demais não.                                                     |

### 9.3 O contrato com as três direções visuais

| Fica fixo (este documento)                                                                   | Cada direção decide                                                 |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Quatro abas, a ordem dos blocos de cada tela, a quantidade de botões e qual é o primário     | Forma do cartão do momento, da barra de abas, da pílula, das linhas |
| Todos os textos (seção 8), todos os estados (carregando, vazio, erro, sem internet, sucesso) | Ilustração do sol (as 5 poses), ícones, cor dos estados e dos chips |
| Alvos mínimos (44 pt; 72 pt nas linhas do Check-in), contraste AA, cor nunca sozinha         | Tipografia exata dentro dos mínimos, ritmo e espaçamento            |
| Duração e sentido de cada movimento (6.2) e o equivalente com Reduzir movimento              | Curvas finas e o desenho dos 5 momentos de encanto                  |

---

## 10. Roteiro, decisões e teste

### 10.1 Três fases

Esforço: **P** (pequeno, poucas horas a 1 dia), **M** (médio, 2 a 4 dias), **G** (grande, mais de 4 dias ou com API). Todo trabalho direto na branch `release`; cada item termina com `npm run verificar` verde e com `docs/STATUS.md` e `docs/rastreabilidade.md` atualizados.

**Fase 1: arrumar a casa (estrutura e texto, quase só app).** Sem migração, sem depender de decisão sobre dado.

| #    | Mudança                                                                                                                                                | Esforço | Depende de                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------- |
| 1.1  | **4 abas**: tirar `escalas` de `abas.ts`, redirecionar `/escalas` (e os 4 arquivos do Início e `notificacoes/caixa.ts` que o chamam) para `/agenda`.   | M       | Q1                                                                                      |
| 1.2  | **Agenda v3**: grupos por semana, `Todos / Só o que é meu`, resposta na linha, `Pedem ajuda`, Calendário em folha com `Dias em que posso ajudar`.      | G       | 1.1                                                                                     |
| 1.3  | **Encontro**: página única para o membro; 3 abas (Resumo, Roteiro, Convocados) para a organização; `Sua parte` no alto; `Como chegar`; etapa em folha. | G       | Nada                                                                                    |
| 1.4  | **Comunidade v3**: ações rápidas, mural com o aviso fixado, `Organização` dobrada, `Sair` vai a Perfil.                                                | M       | `GET` do último aviso já existe; selo de pedidos novos precisa de contagem (1.8)        |
| 1.5  | **Perfil**: 6 linhas, absorve Versículo, Bloqueados, Denunciar, Aparelhos e Código extra.                                                              | M       | Nada                                                                                    |
| 1.6  | **Vocabulário**: tabela da seção 8 em todo o app (`escala` sai; `Biblioteca`, `Sua parte`, `Preciso de alguém no meu lugar`).                          | P       | Q2                                                                                      |
| 1.7  | **Desfazer no lugar de "tem certeza?"** (Não posso ir, Publicar no detalhe, Encerrar ao vivo) e o toast padrão de 10 s.                                | M       | Q4 para o envio com espera; o resto é só app                                            |
| 1.8  | **Sino agrupado, com título real**, e selo `3 novos` em Pedidos de oração.                                                                             | M       | API: campo `titulo` no item da caixa (avisos) e contagem de pedidos novos; sem migração |
| 1.9  | **Folhas e telas** (5.1) aplicadas; fusão das telas de código (`colar-convite`, `entrar-com-convite` em `tenho-um-codigo`).                            | M       | Coordenar com o grupo da entrada                                                        |
| 1.10 | **Estados vazios novos** (5.6) e erros (5.9), puxar para atualizar.                                                                                    | M       | Ilustração só depois da fase 2                                                          |
| 1.11 | **Check-in**: grupos, contador `9 de 15`, `Marcar todos que aceitaram`, linha de 72 pt, desfazer ao tocar de novo.                                     | M       | Nada                                                                                    |
| 1.12 | **Boas-vindas** com `Ligar os avisos` (item 2.12 da auditoria de 21/11).                                                                               | M       | Coordenar com o grupo da entrada                                                        |

**Fase 2: o app que leva até o que fazer agora (o coração da v3).**

| #    | Mudança                                                                                                                                | Esforço | Depende de                                                                                                                                                                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1  | **Cartão do momento** por estado e por papel (3.1 e 3.2), com `acoesDoCartao` ampliada (véspera, no dia, acontecendo, terminou).       | M       | Fase 1                                                                                                                                                                                        |
| 2.2  | **"Igual ao último sábado"** com conferência e o fluxo de 2 e 4 toques; `Copiar este encontro` em `Mais`.                              | G       | Q3. **API nova:** copiar encontro com equipe como "aguardando", sem notificar (rota nova ou extensão de `duplicar`); teste de isolamento; **sem migração** se o status "aguardando" já existe |
| 2.3  | **Lembrar quem falta** (`Lembrar os 2`).                                                                                               | M       | **API nova:** `POST` de lembrete para convocados sem resposta, no máximo um por pessoa por dia; reutiliza a infraestrutura de notificação; teste de isolamento                                |
| 2.4  | **Envio com espera de 10 s** (publicar, aviso, avisar a banda, lembrar, não posso ir).                                                 | M       | Q4. Só app                                                                                                                                                                                    |
| 2.5  | **Convocar em lote** e sugestões por função e disponibilidade (3.5).                                                                   | M       | Só app (usa convocações passadas e disponibilidade que já existem)                                                                                                                            |
| 2.6  | **Folha de conferência da oração** e fluxo de 6 toques (h).                                                                            | P       | Revisão do texto na PH-11                                                                                                                                                                     |
| 2.7  | **Baixar sozinho** o próximo encontro e o repertório; `Baixado ✓`; cifras no pacote offline e **Modo palco** (fatia 2 do modo músico). | G       | Fatia 2 de `docs/produto/modo-musico.md`; vale só no nativo                                                                                                                                   |
| 2.8  | **Prévia da comunidade** ao digitar o código e página web do convite com o próximo encontro público.                                   | M       | **API nova:** prévia pública do código (nome, avatar, contagem de pessoas, próximo encontro público), com limite de taxa e sem dado pessoal                                                   |
| 2.9  | **Ilustração do sol** (5 poses) e os **5 momentos de encanto**.                                                                        | M       | As direções visuais                                                                                                                                                                           |
| 2.10 | **Movimento da seção 6** (tokens novos em `packages/tokens/src`).                                                                      | M       | Nada                                                                                                                                                                                          |
| 2.11 | **Háptico** nos 5 pontos da seção 5.11.                                                                                                | P       | Q5 (dependência nova e novo build)                                                                                                                                                            |

**Fase 3: polimento e profundidade.**

| #   | Mudança                                                                                                               | Esforço | Depende de                                           |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------- |
| 3.1 | Tipografia: `legenda` 14, `chip` 13 (feitos), `corpo` e `meta` 16, aba com teto 1,6 (item 3.2 da auditoria de 21/11). | G       | Recapturar tudo com escala 1,35 e 2,0                |
| 3.2 | Filtros que não cortam na borda; borda de filtro a 3:1.                                                               | M       | Nada                                                 |
| 3.3 | Tema claro conferido tela a tela; barra de abas ligada à origem (A7).                                                 | M       | Nada                                                 |
| 3.4 | Ajuda no contexto: um `?` com 3 linhas nas telas do sábado (item 3.10).                                               | M       | Nada                                                 |
| 3.5 | Compartilhar o encontro com cartão (texto e imagem).                                                                  | P       | Nada                                                 |
| 3.6 | Atalhos do ícone do app ("Próximo encontro", "Abrir o repertório").                                                   | M       | Dependência nova (`expo-quick-actions`) e novo build |
| 3.7 | Widget "Próximo encontro".                                                                                            | G       | Trabalho nativo; só se o teste de uso real pedir     |
| 3.8 | Tom por vocalista, histórico, materiais, "Copiar repertório" (fatia 3 do modo músico).                                | G       | Fatia 3 de `modo-musico.md`                          |

**Migração e compatibilidade:** nenhuma migração de banco nas fases 1 e 2. Rotas antigas viram redirecionamento por uma versão (`/escalas`, `colar-convite`, `entrar-com-convite`, `programacoes`, `agenda/[data]`, `codigo-da-comunidade`, `relatorios/exportacoes`, `bloqueados`, `aparelhos`, `versiculo/traducao`, `escolher-avatar`, `evento/[id]/duplicar`) e depois saem. Links antigos de notificação em `notificacoes/caixa.ts` apontam ao destino novo no mesmo commit.

**Fase 1 e a Onda 2 e 3 da auditoria de 21/11:** os itens 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 2.10, 2.11 e 2.12 viram os itens 1.2 a 1.12 acima, já redesenhados; 3.1 vira 2.2; 3.2 a 3.10 viram 1.x e 3.x.

### 10.2 O que pede decisão do dono

| #      | Pergunta                                                                                                                                                         | Minha recomendação                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Q1** | Tirar a aba **Escalas** e ficar com 4 abas (Início, Agenda, Comunidade, Perfil)?                                                                                 | **Sim**, com o teste da seção 10.3 como freio: se 2 de 3 procurarem a aba, ela volta como "Minha parte".              |
| **Q2** | A palavra **"escala" sai da interface** (fica "Sua parte", e "convocar" continua)? Isso reabre a Q3 anterior, que ficou "testar antes".                          | **Sim**, e confirmar no mesmo teste (a pessoa diz com as próprias palavras como chama o que ela faz no sábado).       |
| **Q3** | "Igual ao último sábado" **copia roteiro e equipe** (como "aguardando", sem avisar até publicar), **sem as músicas** por padrão?                                 | **Sim.** É o maior ganho do líder (de cerca de 26 toques para 4). Reabre a Q5 de 21/11, que ficou para depois.        |
| **Q4** | Quando uma ação avisa pessoas (publicar encontro, aviso, avisar a banda, lembrar, "Não posso ir"), o **aviso espera 10 s com Desfazer** em vez de "tem certeza?" | **Sim.** Se o app fechar à força na espera, nada sai: o erro seguro é não enviar.                                     |
| **Q5** | Autorizar **`expo-haptics`** (dependência do Expo, sem custo, exige novo build)?                                                                                 | **Sim**, mas só junto do próximo build que já houver. Sem a dependência, o v3 funciona igual; o háptico é acabamento. |

O que decidi sozinho e registro: o nome "Biblioteca", "Quando o app me avisa", "Preciso de alguém no meu lugar", os 5 momentos de encanto, o limite de 1 por sessão e as regras de revelação progressiva. São reversíveis e ficam na seção 8.

### 10.3 Plano de teste de usabilidade (15 minutos, 3 pessoas)

**Quem:** (1) um jovem de 16 a 20 anos; (2) uma voluntária de 40 a 55 anos, pouca prática, com fonte grande ligada; (3) um líder. Não são pessoas do time. Quando o v3 ainda não existir, usar **protótipo clicável** de 8 telas (Início membro, Início líder, Agenda, Encontro, Convocar, Check-in, Comunidade, Perfil) com as 4 abas; depois repetir com o app real. Cinco conversas de 20 minutos pegam a maioria dos problemas; é o que vale em fase de validação.

**Montagem:** iPhone, comunidade de demonstração sem dados de teste ("QA offline 13089" e "QA d'Ávila 63630" do banco da homologação devem ser apagados antes), uma convocação pendente preparada, o encontro "daqui a 5 dias". O observador não ajuda, não aponta, não explica. Perguntar do passado, nunca do futuro.

| Minuto  | Tarefa e fala fixa                                                                                                                                                                                    | O que medir                                                |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 0 a 2   | `Não estamos testando você, estamos testando o app. Se algo for confuso, a culpa é do app. Vá falando o que pensa.`                                                                                   | (acolhimento)                                              |
| 2 a 4   | **Quando e onde.** `Você abriu o app. Me diga quando e onde é o próximo encontro.`                                                                                                                    | Tempo até responder, se tocou ou rolou                     |
| 4 a 6   | **Responder.** `Você foi chamada para algo. Me mostra o que faria.`                                                                                                                                   | Toques, tempo, hesitação, se achou "Aceitar"               |
| 6 a 8   | **Onde fica.** `Onde você veria os dias em que pode ajudar? E onde veria tudo o que é seu no mês?`                                                                                                    | Primeiro toque certo (valida Q1 e Q2)                      |
| 8 a 12  | **Tarefa do papel.** Jovem: `Mostra como pediria oração sem aparecer o seu nome.` Voluntária: `Você recebeu um link no WhatsApp. Mostra como entra.` Líder: `Marca o próximo sábado e chama a banda.` | Toques, erros, pedidos de ajuda, palavras lidas com dúvida |
| 12 a 15 | `O que foi mais confuso?` / `Conta a última vez que você ficou sem saber algo do sábado.` / `Em uma frase, para que serve este app?`                                                                  | Respostas literais                                         |

**Anotar:** onde parou por mais de 3 segundos, qual botão tocou por engano, qual palavra leu com dúvida (especialmente `convocado`, `Sua parte`, `Roteiro`, `Check-in`, `Biblioteca`), onde pediu ajuda, o que disse sem ser perguntada. **Regra de decisão:** qualquer problema que 2 de 3 tiveram vira item da próxima fase; de 1 só, fica anotado.

**5 indicadores:**

| #   | Indicador                                                                           | Meta                                                                                                               | Como medir                                                  |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 1   | **Tempo para dizer quando e onde**, abrindo o app                                   | até 5 s, sem tocar e sem rolar, em 3 de 3                                                                          | Cronômetro, tarefa de 2 a 4 min                             |
| 2   | **Toques e tempo para responder uma convocação**                                    | até 2 toques e 10 s, sem errar o botão                                                                             | Tarefa de 4 a 6 min                                         |
| 3   | **Líder: marcar o próximo sábado e convocar a banda**                               | até 5 toques e 60 s (hoje cerca de 26 toques)                                                                      | Tarefa do líder                                             |
| 4   | **Acerto do primeiro toque** ao procurar "dias em que posso ajudar" e "o que é meu" | pelo menos 2 de 3 tocam a aba certa (Agenda); se não, Q1 reabre                                                    | Tarefa de 6 a 8 min                                         |
| 5   | **Conclusão sem ajuda** e a frase final                                             | 3 de 3 nas tarefas de membro; 2 de 3 na do líder; a frase cita encontro, aviso ou "minha parte" e não "complicado" | Contagem de pedidos de ajuda; resposta anotada literalmente |

Repetir depois da fase 1 e depois da fase 2. Tudo marcado "verificar no aparelho" neste documento é hipótese até alguém testar.

---

## Evidências citadas

- **Documentos:** `docs/auditorias/2026-11-21-ux-simplicidade-e-acessibilidade.md`, `docs/auditorias/2026-11-15-complexidade-humana-e-ux.md`, `docs/design/login-v2-ux.md`, `docs/design/login-v2-ui-motion.md`, `docs/design/controles-v2.md`, `docs/design/especificacao-e-roadmap.md`, `docs/produto/modo-musico.md`, `docs/DECISOES.md` (D54 a D64).
- **Capturas:** `scripts/apresentacao/telas/` (`03` a `11`, `14`, `20`, `23`, `24`, `25`, `26`), vistas como 402 x 874 pt.
- **Código lido:** `apps/app/src/funcionalidades/navegacao/abas.ts` e `mais.ts`, `apps/app/src/app/(autenticado)/_layout.tsx`, as 91 rotas de `apps/app/src/app`, `apps/app/package.json` (confirma `react-native-gesture-handler`, `react-native-reanimated`, `expo-keep-awake`, `expo-notifications` instalados e **`expo-haptics` ausente**), `packages/tokens/src/acesso.ts` e `index.ts` (movimento), `funcionalidades/offline` (tipos da fila: `tarefa.concluir`, `checklist.marcar`, `presenca.registrar`, `inscricao.intencao`, `ao_vivo.proposta`), `funcionalidades/escalas/TelaEscalas.tsx`, `funcionalidades/perfil/TelaPerfil.tsx`, `funcionalidades/comunidade/TelaComunidade.tsx`.
