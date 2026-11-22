# Modo músico: repertório, cifras e banda do encontro

Proposta de produto escrita em 21/11/2026, a partir do pedido do dono: "O app pode servir para maestros e regentes musicais: definir escalas de música e membros que vão compor o som. Talvez uma versão diferente para músicos, onde mostra as músicas e cifras. Melhorar a ideia."

**Estado em 21/11/2026:** a **fatia 1 foi construída** (decisão D61 em [DECISOES.md](../DECISOES.md), migração 0027), com as respostas padrão às perguntas 1 a 3 da seção 10: só organizador e administrador editam o repertório, todo membro lê a cifra e não há músico convidado sem conta. A seção 9 diz o que a fatia 1 entregou e o que ficou para as fatias seguintes. O resto deste documento continua sendo o desenho: o que não é da fatia 1 segue como proposta, sem construção nem decisão, e a pergunta 4 (sinal de internet) decide se a fatia 2 sobe de prioridade.

**Estado em 22/11/2026 (PDF):** a música aceita um **PDF anexado** (cifra ou partitura que o músico já tem em arquivo), decisão D76, migração 0029 e a seção 12 abaixo. O item "PDF" da fatia 6 foi antecipado por pedido do dono, dentro do teto de R$ 0 (o arquivo mora no Postgres).

**Estado em 22/11/2026:** a **fatia 2 foi construída** (Modo palco e uso sem internet; decisão D71, direção visual A) e, da fatia 3, só o bloco da banda na tela do repertório. O desenho de telas das seções 6.3 a 6.6 está no app: Meu repertório, leitor de cifra, Modo palco, Repertório do encontro e Banda. A seção 9 diz o que cada fatia entregou e o que ficou pendente.

## 1. Resumo e para quem é

- O regente (ou ministro de louvor) monta o **repertório do encontro**: quais músicas, em que ordem, em que tom, e quem toca o quê.
- A banda é convocada pelo mesmo caminho de hoje (Convocar, Aceitar, Não posso ir), agora por instrumento: vocal, violão, guitarra, teclado, baixo, bateria e outros.
- Cada músico abre o **Meu repertório**: só o que ele toca no próximo encontro, com a cifra grande, no tom certo e com capotraste calculado.
- O **Modo palco** é a cifra em tela escura, letra grande, sem internet, para usar no ensaio e no culto.
- A liderança vê quem confirmou cada instrumento, o que já foi tocado e o que está faltando antes do sábado.

| Quem                                                 | O que ganha                                                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Regente ou ministro de louvor                        | Monta o repertório em minutos, define tons, vê quem confirmou cada instrumento, avisa a banda de uma vez |
| Músico (violão, teclado, baixo, bateria)             | Abre a cifra certa, no tom do dia, no celular, sem procurar mensagem antiga no WhatsApp                  |
| Vocalista                                            | Vê o tom dele em cada música; letra e cifra juntas                                                       |
| Liderança da comunidade (organizador, administrador) | Vê se o louvor do sábado está fechado e se falta alguém, sem perguntar                                   |

Quem NÃO é público desta proposta: banda profissional com várias igrejas, quem quer catálogo de músicas pronto, quem quer tocar sozinho. O app continua sendo da comunidade.

## 2. O que já existe e cobre parte da ideia

Conferido no código em 21/11/2026. Os arquivos citados são só de leitura aqui.

| Já existe                        | Onde                                                                                                                                                                                                         | O que cobre da ideia                                                                                                                                                                                                                                                                                                                  | O que falta                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Músicas** nos Conteúdos        | tabela `uj.musicas` (migração 0009), tela `funcionalidades/conteudos`, rotas `/api/v1/c/:comunidadeId/conteudos/musicas`                                                                                     | Título, artista, **tom** (um só), link https, **cifra ou letra** em texto livre (até 20 mil letras), observações, arquivar. Todo membro lê; organizador grava                                                                                                                                                                         | Cifra é texto solto: sem formato, sem transposição, sem capotraste. Um só tom por música. Sem andamento. Um só link. Sem lugar para "tocar em G neste sábado" |
| **Músicos** nos Conteúdos        | `uj.musicos`, `uj.musica_musicos`                                                                                                                                                                            | Cadastro de músicos com lista de **instrumentos**, vínculo opcional com um membro, e "quem toca cada música"                                                                                                                                                                                                                          | O cadastro é feito só por organizador. Não há "meus instrumentos" feito pela própria pessoa. A relação música e músico não depende do encontro                |
| **Roteiro do encontro** (etapas) | `uj.etapas`, rota `.../eventos/:eventoId/etapas`, reordenação `PUT .../etapas/ordem` com botões subir e descer                                                                                               | O modelo "Sábado padrão" já tem a etapa **Louvor** (15 min). Ordenar etapas já funciona                                                                                                                                                                                                                                               | A etapa é só título e duração: não carrega músicas. Não existe "tipo de etapa" além do título                                                                 |
| **Convocados**                   | `eventos/SecaoEquipe.tsx`, `Convocacao.tsx`, `POST .../eventos/:eventoId/atribuicoes`, `escalas.ts` (`confirmar`, `recusar`, `substituicao`, `substituicoes/:id/assumir`, `convocacoes/aguardando-resposta`) | Convocar por encontro ou por etapa, com **função** (texto de 2 a 60 letras), resposta Aceitar ou Não posso ir, **pedido de substituição**, "Aguardando resposta", aviso "Nova convocação" (D54). A pessoa pode ter duas funções na mesma etapa (vocal e violão). Os dados de demonstração já usam Louvor com Violão, Vocal e Projeção | A função é texto livre (risco de "violão", "Violão", "violao"). Não há lista padrão do louvor. A folha de convocar não filtra por instrumento                 |
| **Minhas escalas**               | `GET .../minhas-escalas`, aba Escalas                                                                                                                                                                        | Lista do que a pessoa foi convocada a fazer                                                                                                                                                                                                                                                                                           | Não mostra repertório. Não separa o que é do louvor                                                                                                           |
| **Disponibilidade**              | `uj.disponibilidades`, `PUT .../disponibilidade/:data`                                                                                                                                                       | Pessoa informa por data se está disponível; organizador lê                                                                                                                                                                                                                                                                            | É por dia, não por instrumento. Para o louvor isso basta no começo                                                                                            |
| **Ao vivo**                      | `aoVivo/`, rota `ao-vivo.ts`, `ao_vivo.proposta` na fila offline                                                                                                                                             | Condução do encontro etapa por etapa, funciona sem internet em aparelho com o pacote baixado                                                                                                                                                                                                                                          | Não sabe de músicas. Não mostra cifra                                                                                                                         |
| **Offline**                      | `offline/`, `GET .../eventos/:eventoId/pacote-offline`, cofre cifrado por conta e comunidade com validade                                                                                                    | Pacote do encontro (etapas, equipe, tarefas, checklist, materiais, ao vivo) guardado no aparelho com SQLCipher. **Só no celular: na web nada fica guardado**                                                                                                                                                                          | O pacote não inclui músicas nem cifras. Offline vale só no app nativo                                                                                         |
| **Permissões**                   | `packages/dominio/src/permissoes.ts`                                                                                                                                                                         | `conteudo.ler` (membro), `conteudo.gerenciar` (organizador), `escala.atribuir` (organizador), `escala.confirmar` (próprio), `escala.pedir_substituicao` (próprio), `evento.ler_pacote_offline` (membro)                                                                                                                               | Nada específico do louvor. Para o regente editar sem ser organizador seria preciso uma designação nova (hoje só existe `equipe_oracao`)                       |
| **Sugestões**                    | `uj.sugestoes`, moderação por organizador, anonimato                                                                                                                                                         | Serve de base para "pedido de música"                                                                                                                                                                                                                                                                                                 | Não tem categoria                                                                                                                                             |

Conclusão: **cerca de metade do caminho já está pronta**. O que o app tem é "a música" e "a convocação". O que falta é o elo entre os dois, que é o **repertório do encontro** (música + ordem + tom do dia + banda), e a leitura da cifra de forma útil.

## 3. A ideia melhorada

Marcação: **Essencial** (sem isso a ideia não funciona), **Valioso** (muda a vida do regente ou do músico), **Luxo** (bom, mas só depois de provar o resto).

### 3.1 Repertório do encontro ligado à etapa Louvor (Essencial)

O encontro ganha um repertório: lista ordenada de músicas, ligada à etapa "Louvor" do Roteiro (ou a outra etapa que o regente escolher). A ordem é a ordem em que será tocado. A soma do tempo das músicas aparece ao lado da duração da etapa ("4 músicas, cerca de 17 min de 15 previstos"), só como aviso, nunca bloqueio.

### 3.2 Tom e andamento por música, e tom do dia (Essencial)

Cada música tem o **tom original** e o **andamento** (batidas por minuto, opcional). No repertório, o regente define o **tom do dia** daquela música naquele encontro (por exemplo, a música é em G, mas neste sábado vai em A). O tom do dia não altera a música na biblioteca.

### 3.3 Cifra em ChordPro, com transposição e capotraste (Essencial)

ChordPro é um formato de texto simples em que o acorde vem entre colchetes, colado na sílaba onde ele muda. Exemplo:

```
{title: Exemplo}
{key: G}
[G]Sobre a rocha eu [D]firmo os meus pés
[Em]Quando o vento [C]vem
```

Por que ChordPro: é texto puro (cabe no campo `cifra` que já existe, sem migrar nada), é fácil de colar, e o app consegue transpor porque sabe onde está cada acorde. A tela mostra os acordes em cima da letra, como o músico está acostumado.

- **Transposição automática:** o app troca todos os acordes para o tom do dia, inclusive acordes com baixo (D/F#) e preferindo sustenido ou bemol conforme o tom.
- **Capotraste:** o músico escolhe a casa do capotraste e o app mostra os acordes que ele vai **tocar** (formas) e o tom que **soa**. Exemplo: soa em A, capotraste na 2ª casa, toca-se em G.
- **Colar cifra que já existe:** muita gente tem cifra no formato "linha de acordes em cima da linha de letra". O app deve **reconhecer esse formato ao colar** e oferecer "converter para o formato do app", mostrando o resultado antes de salvar. Se não conseguir, guarda como texto e avisa que a transposição não vai funcionar. Isso é o que faz a pessoa realmente adotar, porque ninguém vai redigitar 40 músicas.
- Cifra antiga (texto livre já cadastrado) continua abrindo, só sem transposição.

### 3.4 Banda do encontro por instrumento (Essencial)

A banda é a **convocação de hoje**, filtrada pela etapa Louvor, com uma lista padrão de funções: Vocal, Violão, Guitarra, Teclado, Baixo, Bateria, Projeção, Som e Outro (Projeção e Som porque o próprio modelo do sábado já tem "testar som, microfones e projeção"). A pessoa recebe "Nova convocação", responde Aceitar ou Não posso ir, e pode pedir substituição, tudo como já funciona.

O que muda para o regente: a tela mostra **um bloco por instrumento** e deixa claro o que está sem ninguém ("Bateria: ninguém convocado") e o que está sem resposta. Ao convocar, a folha sugere primeiro as pessoas cujo cadastro de músico tem aquele instrumento.

### 3.5 Meu repertório (modo músico) (Essencial)

Visão só do que a pessoa toca: o próximo encontro em que ela aceitou ou foi convocada para o louvor, o repertório na ordem, o tom que vale para ela e a cifra. Sem menus do resto do app no caminho. Detalhes na seção 6.

### 3.6 Modo palco (Valioso, e Essencial se o sinal da igreja for ruim)

Cifra em tela escura, letra grande, fonte ajustável, tela que não apaga, próxima e anterior por botão, e funcionando **sem internet** (o repertório baixa junto com o pacote do encontro). Ver seção 6.

### 3.7 Modo regente (Essencial, mas não é uma tela nova)

Não é um segundo app: é o **mesmo repertório do encontro**, com os botões de editar que só organizador vê. O regente monta o repertório, define tons, arrasta para ordenar (sempre com botões subir e descer, regra do CLAUDE.md), vê quem confirmou cada instrumento e usa **Avisar a banda** para mandar um aviso de "repertório atualizado" a quem foi convocado.

### 3.8 Histórico do que foi tocado (Valioso)

Cada música mostra "tocada pela última vez em 14/11/2026" e quantas vezes entrou em encontros realizados nos últimos meses. Ao adicionar uma música ao repertório, o app avisa "tocada há 2 semanas". É só um aviso: o regente decide. O histórico sai dos próprios repertórios dos encontros já realizados, sem digitar nada.

### 3.9 Materiais por música (Valioso)

Cada música pode ter vários materiais: letra, cifra extra (por exemplo, a de um instrumento), partitura em PDF, áudio ou vídeo de referência. **No começo, só por link** (https), como o campo de link de hoje, mas vários e com tipo. Envio de PDF para o servidor fica para depois (custo de armazenamento e direitos autorais, ver seção 4).

### 3.10 Ensaio como encontro (Valioso, e quase de graça)

Ensaio é um Encontro com a categoria "Ensaio de louvor" (entra na lista de categorias sugeridas). Ele tem repertório e banda como qualquer outro. "Copiar repertório de outro encontro" resolve o caso do ensaio de quinta que vira o culto de sábado, e vale para o histórico: o ensaio não deve contar como "tocada" no culto, então o histórico conta só encontros que não são ensaio.

### 3.11 Tom por vocalista (Valioso para quem tem mais de um vocal)

No repertório, cada música pode ter um tom por vocalista ("Letícia: A, Mateus: G"). O Meu repertório mostra a música no tom da pessoa. Se ninguém definir, vale o tom do dia.

### 3.12 Disponibilidade por instrumento (Luxo no começo)

Hoje a pessoa diz se está disponível em uma data. Para o louvor isso quase sempre basta: quem convoca já sabe o instrumento da pessoa. Disponibilidade por instrumento só vale quando a mesma pessoa toca duas coisas e só pode uma delas. Deixar para depois.

### 3.13 Pedido de música pela comunidade (Luxo, por último)

Membro pede uma música ("podemos tocar esta?") e o regente aceita ou recusa, como hoje funciona a Sugestão. Não precisa de tela nova no começo: reaproveitar Sugestões com um tema "Música". Só depois de o resto estar em uso.

### 3.14 Outras ideias, para ficarem escritas e fora

- **Metrônomo e afinador no app:** o celular já tem. Fora.
- **Rolagem automática da cifra pelo andamento:** Luxo, depois do Modo palco estar em uso.
- **Regente avança a música e a tela de toda a banda acompanha:** Luxo. Exigiria sincronização em tempo real parecida com o Ao vivo e não funciona sem internet.
- **Catálogo de músicas pronto, busca de cifras na internet, importar de sites:** fora, por direitos autorais (seção 4).
- **Gravação de áudio do ensaio dentro do app:** fora. Armazenamento e privacidade das pessoas gravadas.
- **Partitura em PDF enviada ao app:** depois, com decisão do dono sobre armazenamento (limite de gasto R$ 0).

## 4. Direitos autorais e privacidade

Letras e cifras são obras protegidas. O app **não vende, não distribui e não publica** nada disso; ele só guarda o que a própria comunidade digita ou cola, como um caderno de música da banda. Regras do desenho:

1. **Sem catálogo de terceiros embutido.** O app não traz nenhuma letra ou cifra de fábrica e não busca em nenhum site. Os dados de demonstração usam só músicas de domínio público ou letras escritas para o teste.
2. **Quem cadastra é a comunidade.** Na hora de salvar uma cifra ou letra, aparece uma confirmação curta: "Guarde apenas letras e cifras que a sua comunidade tem direito de usar, por licença própria, autorização ou domínio público." O registro de quem cadastrou já existe (`criado_por`).
3. **Visível só dentro da comunidade.** Sem link público, sem página aberta, sem compartilhar para fora do app, sem botão "exportar cifra", e **nenhuma exportação da comunidade inclui letras ou cifras**. Imprimir e capturar tela não dá para impedir; o app só não oferece o caminho.
4. **Isolamento entre comunidades**, como no resto do app (CLAUDE.md, seção 8): RLS por `comunidade_id`, teste de troca de ID na URL, no corpo e em filtros, resposta 404.
5. **No aparelho:** a cifra baixada para uso sem internet fica no mesmo cofre cifrado que já guarda o pacote do encontro, com a mesma validade, e some quando a partição é apagada (saída da comunidade, troca de conta).
6. **Texto de pedido de oração e dados pessoais não se misturam com música.** Nenhum dado de pessoa vai para log junto com letra: o log registra o id da música, nunca o texto da cifra.
7. **Termos de uso:** incluir no termo do administrador a responsabilidade pelo conteúdo cadastrado (nova versão do termo e novo aceite, como o app já faz para o termo do admin). **Isso precisa de revisão jurídica** (já há a pendência PH-11 para os textos legais). Licenciamento de letras para uso em culto é assunto de cada igreja; o app não substitui licença e não deve dizer que substitui.
8. **Lojas:** Apple e Google têm regras para conteúdo de terceiros. O desenho (conteúdo privado, cadastrado só por organizadores, sem busca pública, com o canal de denúncia que o app já tem) é o que melhor se defende. Conferir antes do envio se a denúncia cobre música e se a ficha de privacidade e a classificação precisam de ajuste. Nada é enviado às lojas sem o "sim" do dono (CLAUDE.md, seção 4).

Observação: hoje a política de leitura das músicas deixa **todo membro** ler a cifra (`conteudo.ler` é de membro). Isso fica igual na fatia 1. A pergunta 3 da seção 10 trata de restringir a cifra a quem toca.

## 5. Vocabulário na interface

Coerente com o app (Encontro, Roteiro, Convocar, Aceitar):

| Use                             | Não use                     |
| ------------------------------- | --------------------------- |
| Repertório                      | Setlist, playlist           |
| Música, cifra, letra            | Track, chart                |
| Banda do encontro               | Escala musical, time de som |
| Convocar, Aceitar, Não posso ir | Escalar, confirmar presença |
| Tom do dia                      | Key                         |
| Capotraste                      | Capo                        |
| Meu repertório                  | Modo músico (no menu)       |
| Modo palco                      | Stage mode                  |
| Avisar a banda                  | Notificar equipe            |
| Pedir substituição              | Trocar                      |
| Louvor (etapa e atalho)         | Worship                     |

"Modo músico" e "Modo regente" são nomes de conversa. Na interface não aparecem como modos que a pessoa liga e desliga: a tela se ajusta ao que a pessoa é naquele encontro (convocada como músico vê Meu repertório; organizador vê também os botões de editar).

**Revisto em 22/11/2026 (D73): o repertório e a banda são de toda a comunidade.** Qualquer pessoa com vínculo ativo vê o repertório do encontro (músicas, ordem, tom do dia), quem está na banda ("Quem toca: Ana (violão), Bruno (bateria).") e pode abrir a cifra para ler; o atalho **Louvor** e o botão do cartão ("Ver o repertório") valem para todos. Continuam **só de quem toca**: "Sua parte", o Meu repertório com a cifra no tom do dia, o Modo palco e o uso sem internet. Continuam **só da organização**: editar o repertório, "Avisar a banda", "Falta: bateria" e a situação de cada resposta. Antes (D62, 21/11/2026): atalho **Louvor** na aba Comunidade, **só para quem foi convocado ao louvor ou organiza** (não para todo membro); o Repertório do encontro dentro do detalhe do Encontro (na etapa Louvor do Roteiro); e **Meu repertório** como o botão "Abrir o repertório" do cartão do próximo encontro, no Início, para quem tem convocação de louvor aceita. O cartão "Meu repertório" do Início saiu: era mais um cartão para todos, e a maioria da comunidade não toca.

## 6. Telas

Todas seguem o que o CLAUDE.md exige: contraste AA nos dois temas, alvos de 44 pt, cor nunca como único sinal, respeito a Reduzir movimento e tamanho de fonte do sistema, estados vazios com ação, erros em linguagem humana, nada essencial escondido em gesto.

### 6.1 Repertório (biblioteca)

Acesso: Comunidade, Louvor. É a tela de Conteúdos, Músicas, melhorada.

- **Aparece:** busca por título ou artista; filtros (tom, "tocadas recentemente", arquivadas); lista com título, artista, tom, andamento e, em texto pequeno, "tocada em 14/11/2026". Selo "Sem cifra" quando falta.
- **Botões:** Nova música (organizador); tocar numa linha abre a Música.
- **Vazio:** "Nenhuma música ainda. Cadastre a primeira música da comunidade." com a ação Nova música.

### 6.2 Música (cifra, tons e materiais)

- **Aparece:** título, artista, tom original, andamento. Abas **Cifra**, **Materiais**, **Histórico**.
- **Cifra:** leitura com acordes sobre a letra; seletor de **Tom** (sobe e desce meio tom, botões + e −, e escolha direta) e de **Capotraste** (0 a 7); letra de tamanho ajustável; botão **Modo palco**.
- **Materiais:** lista por tipo (letra, cifra, partitura, áudio, vídeo) com título e link; Adicionar material (organizador); tocar abre o link fora do app.
- **Histórico:** encontros em que foi tocada, com data e tom usado.
- **Edição (organizador):** campo de cifra com a dica do formato ChordPro, botão **Converter cifra colada** que mostra a prévia, o aviso de direitos autorais ao salvar, e Arquivar música.

### 6.3 Repertório do encontro (setlist)

Acesso: detalhe do Encontro, Roteiro, etapa Louvor, "Repertório". Fica também como seção própria do detalhe quando o encontro não tem etapa Louvor (o regente escolhe a etapa).

- **Aparece:** lista numerada na ordem de execução. Cada linha: título, **tom do dia**, andamento, nota curta ("entra só o coro"). No topo: soma do tempo contra os minutos da etapa. Avisos discretos: "tocada há 2 semanas".
- **Botões (organizador):** Adicionar música (abre a biblioteca com busca), **Subir** e **Descer** em cada linha (arrastar é um extra, nunca o único jeito), Mudar tom do dia, Tirar do repertório, **Copiar de outro encontro**, **Avisar a banda**.
- **Para quem não edita:** a mesma lista, só leitura, com "Abrir cifra".
- **No rascunho:** só organizadores veem, como o resto do encontro.

### 6.4 Banda do encontro

Acesso: detalhe do Encontro, seção Convocados (a mesma de hoje), com o louvor agrupado por função.

- **Aparece:** um bloco por função (Vocal, Violão, Guitarra, Teclado, Baixo, Bateria, Projeção, Som, Outro). Em cada um, as pessoas com o chip da resposta (Aceitou, Aguardando, Não posso ir, Pediu substituição). Função sem ninguém mostra "Ninguém convocado" com o botão Convocar. Resumo no topo: "5 de 7 aceitaram, falta bateria".
- **Botões (organizador):** **Convocar** por função (a folha sugere antes quem tem o instrumento no cadastro de músico e quem está disponível na data), tocar numa pessoa para tirá-la, **Avisar a banda**.
- **Para a pessoa convocada:** Aceitar, Não posso ir, Pedir substituição, como já existem.

### 6.5 Meu repertório (modo músico)

Acesso: cartão no Início e na aba Escalas; só aparece para quem tem convocação de louvor.

- **Aparece:** próximo encontro com a data, o horário e **minha função** ("Violão"); o repertório em ordem com o **meu tom** (tom do dia, ou o meu tom de vocalista); marca de "baixado para uso sem internet". Abaixo, os encontros seguintes. Se a convocação está pendente, no topo: Aceitar e Não posso ir.
- **Botões:** tocar numa música abre a cifra grande; **Deixar pronto sem internet** (baixa o repertório e as cifras); **Modo palco** (abre a primeira música); Abrir material (link).
- **Vazio:** "Você não está convocado para o louvor. Quando for, o repertório aparece aqui."

### 6.6 Modo palco

Acesso: Música ou Meu repertório, botão Modo palco. Não mostra a barra de abas (como o Ao vivo hoje).

- **Aparece:** tela escura de alto contraste, título e tom (e capotraste) em cima, cifra grande com acordes **em negrito e posição acima da letra** (não só em cor), seções (verso, refrão) com rótulo em texto.
- **Botões:** **Anterior** e **Próxima** música (botões grandes, também por toque nas laterais, nunca só gesto); **A−** e **A+** (tamanho da letra, lembrado por pessoa); **Tom −** e **Tom +** e Capotraste (só para o meu aparelho, sem mexer no tom do dia); **Sair**.
- **Comportamento:** mantém a tela acesa, respeita Reduzir movimento, funciona sem internet, mostra "Posição 2 de 4" para não se perder. Rolagem automática é Luxo e fica fora da fatia inicial.

## 7. Modelo de dados proposto

Tudo em português, na mesma convenção das migrações existentes: `comunidade_id` em toda tabela, índice por comunidade, RLS ligada, gatilho que confere que as ligações são da mesma comunidade, registro no log de mudanças para a sincronização, `versao` quando houver edição concorrente. Sem código aqui; o desenho vira migração (a próxima depois da 0026) na etapa da fatia.

### 7.1 Tabelas existentes que ganham campos

| Tabela           | Campo novo                              | Para quê                                                                                                                                                                                    |
| ---------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uj.musicas`     | `andamento_bpm` (inteiro, opcional)     | Andamento                                                                                                                                                                                   |
| `uj.musicas`     | `formato_cifra` ('chordpro' ou 'texto') | Saber se a transposição funciona. Cifra antiga fica como 'texto'                                                                                                                            |
| `uj.musicas`     | `duracao_seg` (inteiro, opcional)       | Soma do tempo no repertório                                                                                                                                                                 |
| `uj.musicas`     | `direito_confirmado_em` (data)          | Registro de que a confirmação de direitos foi aceita ao salvar                                                                                                                              |
| `uj.atribuicoes` | nenhum na fatia 1                       | A função continua texto; a lista padrão vive em `packages/dominio` e normaliza o texto na entrada. Se a função livre atrapalhar, entra depois uma coluna `instrumento` com valores fechados |

### 7.2 Tabelas novas

**`uj.repertorio_itens`** (uma linha por música em um encontro)

- `id`, `comunidade_id`, `evento_id` (apaga junto com o encontro), `etapa_id` (opcional, normalmente a etapa Louvor), `musica_id`, `ordem`, `tom_do_dia`, `andamento_bpm` (opcional, sobrepõe o da música), `capotraste_sugerido` (opcional), `nota` (até 300 letras), `criado_em`, `atualizado_em`, `versao`.
- Regras: `ordem` única por encontro, com checagem adiada como nas etapas (reordenar sem conflito); a mesma música pode entrar duas vezes? Não na fatia 1 (único por encontro e música). `evento_id`, `etapa_id` e `musica_id` têm de ser da mesma comunidade e a etapa tem de ser do mesmo encontro.

**`uj.repertorio_tons`** (tom por vocalista, fatia 3)

- `id`, `comunidade_id`, `item_id` (apaga junto com o item), `vinculo_id`, `tom`. Único por item e vínculo. O vínculo tem de ter convocação naquele encontro (checagem no gatilho).

**`uj.musica_materiais`** (fatia 3)

- `id`, `comunidade_id`, `musica_id`, `tipo` ('letra', 'cifra', 'partitura', 'audio', 'video', 'outro'), `titulo`, `link` (https, mesma regra do campo atual), `criado_por`, `criado_em`. PDF enviado ao servidor: fora até decisão do dono.

**Histórico:** não precisa de tabela. Sai de `repertorio_itens` dos encontros com status realizado e categoria diferente de ensaio.

**Pedido de música (Luxo):** reaproveita `uj.sugestoes`, sem tabela nova.

**Designação "regente" (fatia 5, só se o dono quiser):** hoje o tipo `Designacao` só tem `equipe_oracao`. Uma designação `louvor` deixaria um membro comum editar repertório e convocar a banda sem ser organizador. Mexe na matriz, na função `designacoes_no_contexto` e nas políticas; por isso fica para depois de provar o uso.

### 7.3 Regras de acesso por papel

| Ação                                              | Quem                                  | Como fica na matriz                                                                              |
| ------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Ler músicas, repertório do encontro, materiais    | Membro                                | Recurso novo `repertorio` com `ler: membro`; `conteudo.ler` continua para a biblioteca           |
| Ler repertório de encontro em rascunho            | Só organizador                        | A política segue a de `etapas`: `nivel >= 20` ou `uj.evento_visivel_para_membro(evento_id)`      |
| Montar, ordenar, mudar tom do dia, copiar, avisar | Organizador                           | `repertorio.gerenciar: organizador`                                                              |
| Cadastrar e editar música e materiais             | Organizador                           | `conteudo.gerenciar` (como hoje)                                                                 |
| Convocar, aceitar, recusar, substituir            | Como hoje                             | `escala.*` sem mudança                                                                           |
| Tom por vocalista                                 | Organizador grava; a pessoa lê o dela | `repertorio.gerenciar` e leitura do próprio                                                      |
| Meu repertório                                    | Membro, só o que é seu                | Rota própria, filtra por convocação do vínculo                                                   |
| Cifra e materiais em pacote offline               | Membro convocado ou organizador       | Dentro de `evento.ler_pacote_offline`, só se houver convocação de louvor ou papel de organizador |

Como o CLAUDE.md pede: a matriz fica só em `packages/dominio`; `docs/matriz-permissoes.md` é regerado por `npm run gerar:matriz`, nunca editado à mão; o teste percorre todas as células; negar por padrão.

### 7.4 Banco: RLS e privilégios

- Políticas por `comunidade_id = uj.comunidade_atual()` e por nível, no mesmo padrão de `musicas_ler` e `musicas_gravar` (migração 0009): leitura a partir de membro, escrita só com `nivel_gravavel_no_contexto() >= 20`.
- Leitura de `repertorio_itens` acompanha a visibilidade do encontro (rascunho só organizador), como `etapas_ler`.
- `uj_api` sem ser dono das tabelas e sem `BYPASSRLS`; privilégios por coluna (só as colunas gravadas em cada rota), como na 0009.
- Gatilho de conferência de comunidade para `evento_id`, `etapa_id`, `musica_id` e `vinculo_id`, como `guardar_conteudo()`.
- Log de mudanças com nível mínimo 10 para o repertório (para a sincronização do aparelho), e o log nunca leva o texto da cifra, só o id.
- Cifra e letra nunca vão para o log da API nem para auditoria; a auditoria registra "música alterada" com o id.

## 8. Rotas de API

Todas sob `/api/v1/c/:comunidadeId`, com o vínculo ativo vindo do banco, nunca do corpo ou cabeçalho. Lista sem código.

**Existentes que mudam (compatíveis):**

- `GET`, `POST /conteudos/musicas` e `GET`, `PATCH`, `DELETE /conteudos/musicas/:musicaId`: aceitam `andamentoBpm`, `formatoCifra`, `duracaoSeg`, confirmação de direitos.
- `GET /eventos/:eventoId/pacote-offline`: passa a incluir o repertório do encontro e as cifras das músicas dele (só para convocado de louvor ou organizador).
- `POST /eventos/:eventoId/atribuicoes`: normaliza a função pela lista padrão do louvor.

**Novas:**

- `GET /eventos/:eventoId/repertorio` e `POST /eventos/:eventoId/repertorio` (adicionar música).
- `PATCH` e `DELETE /eventos/:eventoId/repertorio/:itemId` (tom do dia, andamento, nota, tirar).
- `PUT /eventos/:eventoId/repertorio/ordem` (mesma ideia de `etapas/ordem`: a lista inteira, com conflito se mudou).
- `POST /eventos/:eventoId/repertorio/copiar` (corpo com o encontro de origem).
- `POST /eventos/:eventoId/repertorio/avisar` ("Avisar a banda": notificação sem texto de música, só "repertório atualizado").
- `PUT /eventos/:eventoId/repertorio/:itemId/tons/:vinculoId` e `DELETE` (tom por vocalista, fatia 3).
- `GET /meu-repertorio` (próximos encontros em que sou convocado ao louvor: função, estado da convocação, repertório e meu tom).
- `GET /conteudos/musicas/:musicaId/historico`.
- `GET`, `POST /conteudos/musicas/:musicaId/materiais` e `PATCH`, `DELETE .../materiais/:materialId` (fatia 3).
- `GET /eventos/:eventoId/banda` (resumo por função e o que falta; pode sair do detalhe do encontro se der para derivar no cliente, a decidir na implementação).

**Testes de isolamento (exigência do CLAUDE.md, seção 8):** cada rota acima entra no **inventário de rotas** e ganha o teste de conta da comunidade A tentando ler, alterar ou listar dado da B, trocando IDs na URL (evento, música, item, material), no corpo (`musicaId` ou `vinculoId` de outra comunidade ao adicionar ao repertório) e em filtros (histórico, cópia de repertório de encontro alheio). Resposta esperada: **404**, não 403. Sem o teste, o CI quebra por regra. Teste extra do banco: o gatilho barra `musica_id` de outra comunidade mesmo com a API contornada.

Pontos de atenção em teste: reordenação com conflito, cópia de repertório de encontro em rascunho por quem não é organizador, pacote offline sem cifra para quem não tem convocação de louvor, e a cifra ausente de qualquer exportação.

## 9. Fatias de entrega

Ordem pelo que prova o valor mais cedo. Esforço: pequena (poucos dias), média (cerca de uma a duas semanas de trabalho), grande (mais que isso). São estimativas de ordem de grandeza, sem prazo prometido.

### Fatia 1 (recomendada): repertório do encontro, cifra com tom e Meu repertório

> **Entregue em 21/11/2026 (D61, migração 0027), ainda sem uso real: falta a prova de valor em 3 sábados.** O que existe agora e o que ficou fora estão logo abaixo desta lista. Nada foi publicado: a mudança só chega ao aparelho num novo build e na implantação da 0027, que dependem do "sim" do dono.

- **O que o dono ganha:** o regente monta o sábado do louvor no app; o músico abre a cifra certa, no tom certo, a partir do celular.
- **O que muda no app:**
  - Música: andamento e formato ChordPro, transposição e capotraste, conversão de cifra colada, aviso de direitos.
  - Encontro: seção Repertório na etapa Louvor, com tom do dia, subir e descer, Avisar a banda.
  - Convocados: lista padrão de funções do louvor, bloco por função e "falta bateria".
  - Cartão e tela **Meu repertório** com a cifra grande (leitura online; a cifra baixada de cada música abre como leitura simples, ainda sem o Modo palco completo).
  - Atalho Louvor na aba Comunidade.
- **Esforço:** média a grande. A transposição fica em `packages/dominio` como função pura e testável. A migração é pequena (colunas em `musicas`, uma tabela nova).
- **Depende de:** nada novo. Usa Conteúdos, Convocados, Roteiro e notificações que já existem. Precisa só da decisão das perguntas 1 a 3 da seção 10.
- **Prova de valor:** usar em 3 sábados reais antes de construir mais.

**O que a fatia 1 entregou (21/11/2026):**

- **Domínio (`packages/dominio`):** `cifra.ts` (ler e normalizar ChordPro, converter "acordes sobre a letra", transpor com grafia de ♯ ou ♭ pelo tom de chegada, acordes com baixo, `m7`, `sus4`, `dim`, `maj7`, capotraste com o tom que soa e o que se toca), `banda.ts` (lista padrão de funções, normalização do texto da convocação, resumo "5 de 7 aceitaram. Falta: bateria", louvor pela etapa ou pela função) e `repertorio.ts` (soma do tempo contra os minutos da etapa, duração m:ss).
- **Banco e API:** colunas `andamento_bpm`, `duracao_seg` e `direito_confirmado_em` em `uj.musicas`; tabela `uj.repertorio_itens`; função `uj.avisar_banda`. Rotas: `GET`, `POST /eventos/:eventoId/repertorio`, `PATCH`, `DELETE /eventos/:eventoId/repertorio/:repertorioItemId`, `PUT .../repertorio/ordem`, `POST .../repertorio/avisar` e `GET /meu-repertorio`. As rotas de músicas aceitam `andamentoBpm`, `duracaoSeg` e `direitosConfirmados` e devolvem `temCifra`.
- **App:** cifra no cadastro e na edição da música (dica de ChordPro, formato reconhecido, "Converter cifra colada", pré-visualização e aviso de direitos com confirmação); leitor de cifra com tom, capotraste e tamanho da letra em painel escuro; tela Repertório do encontro (adicionar da biblioteca, tom do dia, subir e descer por botão, tirar, Avisar a banda); Convocados do louvor agrupado por função com "Falta: bateria"; tela Meu repertório e leitura da cifra com anterior e próxima; cartão no Início; atalho Louvor na aba Comunidade.
- **Permissões:** a matriz não mudou. Reaproveita `etapa.ler`, `etapa.gerenciar`, `escala.atribuir` e `escala.ler`; `docs/matriz-permissoes.md` continua igual ao gerado.

**O que ficou para depois (não faz parte da fatia 1):**

- **Fatia 2:** Modo palco (tela que não apaga, repertório e cifras no pacote offline e no cofre cifrado, "Deixar pronto sem internet", tamanho da letra lembrado por pessoa). Hoje a cifra só abre com internet.
- **Fatia 3:** "Copiar de outro encontro", tom por vocalista, histórico ("tocada há 2 semanas"), materiais por música (vários links com tipo) e a categoria "Ensaio de louvor".
- **Fatia 4:** "Meus instrumentos" e a folha de convocar sugerir primeiro quem tem o instrumento no cadastro de músico. Na fatia 1 a folha só oferece a lista padrão de funções.
- **Fatia 5:** designação de regente (membro comum editando o repertório).
- **Do desenho, não feito na fatia 1:** abas Materiais e Histórico na Música, filtros da biblioteca por tom e "tocadas recentemente", botão "Modo palco".
- **Escolhas desta entrega:** não existe a coluna `formato_cifra` (o formato se deduz do texto, então cifra antiga continua abrindo e cifra colada em ChordPro passa a transpor sem migrar nada); "falta" conta só funções já convocadas (função convocada sem ninguém que aceitou); "Avisar a banda" não diz nome de música e respeita a preferência "Escalas" de cada pessoa.
- **Pendências do dono (PH-11):** revisão jurídica do aviso de direitos autorais e do termo do administrador. A função não deve ser liberada às comunidades antes dela.

### Fatia 2: Modo palco e uso sem internet

> **Entregue em 22/11/2026 (D71), sem migração e sem rota nova no servidor** (usa o pacote da D66). Só no app nativo: na web nada fica guardado, e o cartão diz isso. O que foi entregue está logo abaixo da lista do que a fatia muda.

- **Ganha:** a cifra funciona sem sinal e em tela escura de palco.
- **Muda:** Modo palco completo (seção 6.6); repertório e cifras entram no pacote offline e no cofre cifrado; "Deixar pronto sem internet" em Meu repertório; tamanho de fonte lembrado.
- **Esforço:** média.
- **Depende de:** fatia 1 e do offline atual (que só existe no app nativo, não na web). Se o sinal da igreja for ruim, esta fatia sobe para antes do uso real (pergunta 4).

**O que a fatia 2 entregou (22/11/2026):**

- **Modo palco** (abre pelo botão "Palco" da cifra ou pelo "Modo palco" do Meu repertório, que já abre a primeira música): tela cheia escura, sem barra de abas, tela sempre acesa (`expo-keep-awake`, que já estava instalado), título, tom e capotraste, letra de 24 a 56 pt (o tamanho fica lembrado neste aparelho), acordes em negrito sobre a sílaba, rolagem por botão (uma página por toque) além do dedo, Tom − e Tom +, A− e A+, Anterior e Próxima, "Sair do palco" com um toque e a posição ("2 de 4"). Respeita Reduzir movimento (a rolagem por botão não anima) e o teto de 1,3 da fonte do sistema.
- **Uso sem internet:** "Deixar pronto sem internet" baixa o pacote do repertório (`GET /eventos/:eventoId/repertorio/pacote`) para a tabela `repertorios` da mesma partição cifrada do pacote do encontro. A segunda chamada manda a versão que o aparelho tem e recebe "inalterado": a cifra não trafega de novo. A tela diz "Pronto para tocar sem internet" e "Baixado em 22/11 às 14:32. Vale até 29/11.". Meu repertório, a cifra e o Modo palco abrem da cópia quando não há rede.
- **Baixar sozinho:** ao abrir o app, ao voltar ao primeiro plano e ao recuperar a rede, se o encontro está a até 3 dias, a pessoa tem parte (convocação não recusada) e há Wi-Fi, o repertório baixa sem ninguém pedir (no máximo a cada 10 minutos por comunidade). Em dados móveis fica só o botão.
- **Validade e limpeza:** a cópia vence com a partição (D23, renovada a cada contato com o servidor), sai 36 h depois do início do encontro, sai quando o servidor responde 403 ou 404 (saiu do louvor, encontro voltou a rascunho) e sai com a partição ao sair da comunidade ou da conta. A letra e a cifra nunca vão a log (há teste que espia o console).
- **Ficou de fora:** conferência no aparelho (cofre cifrado, tela acesa, iOS e Android), PDF e áudio, rolagem automática pelo andamento e o tamanho da letra "por pessoa" além do aparelho (é por aparelho, no armazenamento local).

### Fatia 3: histórico, materiais, tom por vocalista, ensaio e cópia

> **Parcial em 22/11/2026 (D71):** entrou o bloco "Banda" na tela do Repertório do encontro (as funções do louvor com quem aceitou, "Falta: bateria" e "Banda completa") e a Biblioteca ganhou os estados de tela inteira. **Pendente:** o histórico "tocada há 2 semanas" (a API não traz a última vez que a música foi tocada: sai de `repertorio_itens` dos encontros realizados e pede uma rota nova), as abas Materiais e Histórico, tom por vocalista, a categoria Ensaio e "Copiar de outro encontro".

- **Ganha:** não repetir música demais, vários links por música, o tom certo de cada voz, ensaio com o mesmo repertório.
- **Muda:** abas Materiais e Histórico na Música; categoria "Ensaio de louvor"; "Copiar de outro encontro"; tom por vocalista.
- **Esforço:** média.
- **Depende de:** fatia 1 (e de alguns encontros realizados para o histórico mostrar algo).

### Fatia 4: Meus instrumentos e disponibilidade por instrumento

- **Ganha:** a pessoa declara o que toca; a folha de convocar sugere melhor; disponibilidade por instrumento para quem toca mais de um.
- **Muda:** tela "Meus instrumentos" (a pessoa edita o próprio cadastro de músico); filtro na folha de convocar.
- **Esforço:** pequena a média.
- **Depende de:** fatia 1. Só vale se o regente sentir falta.

### Fatia 5: designação de regente

- **Ganha:** um membro comum conduz o louvor sem ser organizador.
- **Muda:** nova designação na matriz, política do banco e tela do administrador para designar (como a equipe de oração).
- **Esforço:** média (toca permissões, o ponto mais sensível do projeto).
- **Depende de:** decisão da pergunta 1.

### Fatia 6 (Luxo): pedido de música, rolagem automática, PDF, acompanhamento ao vivo

- Pedido de música pela comunidade via Sugestões; rolagem automática; ~~partitura em PDF~~ (feita em 22/11/2026, D76, seção 12: o armazenamento é o Postgres, dentro do teto de R$ 0); banda acompanhando o regente em tempo real.
- **Esforço:** cada item é pequeno a médio; o acompanhamento ao vivo é grande.
- **Depende de:** uso real das fatias anteriores. Cada item só entra se alguém pedir.

## 10. Riscos e perguntas em aberto

Só as que mudam o desenho.

**Perguntas ao dono**

1. **Quem edita o repertório?** Só organizadores (nada novo, fatia 1) ou também um membro designado como regente (fatia 5, mexe em permissões)? Recomendo começar só com organizador.
2. **Músico convidado sem conta no app existe no louvor?** Hoje a convocação é por vínculo (pessoa com conta). Se o regente convida gente de fora, é preciso uma convocação "avulsa" por nome (sem resposta pelo app). Recomendo ignorar na fatia 1 e ver se aparece.
3. **A cifra deve ser vista por todos os membros ou só por quem toca?** Hoje todo membro lê. Restringir reduz exposição de direitos autorais, mas exige uma regra a mais no banco e no pacote offline. Recomendo manter como está na fatia 1 e decidir depois da revisão jurídica.
4. **Como é o sinal de internet onde a banda toca?** Se for ruim, a fatia 2 (offline) vira parte do primeiro uso real. Uso sem internet só existe no app nativo; a web não guarda nada.
5. **Quantos encontros de louvor por semana?** Se houver ensaio e culto, "copiar repertório" e a categoria Ensaio sobem de prioridade.

**Riscos**

- **Direitos autorais e lojas:** ver seção 4. Mitigação de desenho (privado, sem catálogo, sem exportar) e revisão jurídica antes de publicar a função. Não publicar na loja sem o "sim" do dono.
- **Adoção:** o músico já tem a cifra no WhatsApp ou no Cifra Club. O app só ganha se for mais rápido: por isso a conversão de cifra colada e o tom do dia são da fatia 1, não depois.
- **Transposição errada:** acordes complexos (sus, dim, baixo invertido) geram erro. Mitigação: testes com uma lista grande de acordes, e a tela mostra a cifra original ao lado quando houver dúvida.
- **Função em texto livre:** variações de escrita quebram o agrupamento por instrumento. Mitigação: lista padrão e normalização; se não bastar, coluna `instrumento`.
- **Escopo:** é um módulo novo dentro de um app já grande, com 575 testes e inventário de isolamento. Manter a fatia 1 estreita.

**Como saber se funcionou (sem inventar meta):** observar em 3 sábados reais se o regente monta o repertório no app em vez do WhatsApp, e se os músicos convocados abrem a cifra pelo Meu repertório. Se não abrirem, descobrir por quê antes de construir a fatia 2.

## 11. O que eu faria primeiro

1. **Conversar com o regente e dois músicos** (três conversas curtas, são pessoas que o dono conhece): "Como você montou o repertório do último sábado? Onde estavam as cifras? Quanto tempo levou? Como você avisou a banda?" Perguntar sobre o passado, não sobre o futuro. Ver as mensagens e os arquivos de verdade.
2. **Responder as 5 perguntas da seção 10**, principalmente a 3 (quem lê a cifra) e a 4 (sinal de internet).
3. **Mostrar este desenho ao regente** (as telas 6.3, 6.4 e 6.5 em protótipo, sem programar) e ver se ele reconhece o próprio sábado.
4. **Pedir a revisão jurídica do aviso de direitos autorais** junto da pendência PH-11, antes de liberar o cadastro de cifra para as comunidades.
5. **Construir só a fatia 1:** transposição e conversão de cifra em `packages/dominio` (com testes), migração pequena, repertório do encontro, bloco por função na convocação e Meu repertório.
6. **Usar em 3 sábados reais** na comunidade do dono, e só então decidir entre fatia 2 (offline e palco) e fatia 3 (histórico e materiais) pelo que a banda reclamar.
7. **Manter fora, por escrito:** catálogo de músicas, importação de sites, gravação de áudio, metrônomo e acompanhamento em tempo real, até haver pedido real. (O PDF enviado ao servidor saiu desta lista em 22/11/2026: o dono pediu, ver a seção 12.)

## 12. PDF anexado à música (D76, 22/11/2026)

Pedido do dono: "faz o repertório aceitar PDF também". Músicos e líderes têm cifras e partituras em PDF e querem anexá-las à música e abri-las no repertório. A cifra em texto (ChordPro, D61) continua, e a música pode ter **as duas coisas**.

**O que o usuário vê**

- **Quem organiza**, na Biblioteca (música nova ou em edição): "Anexar PDF". O aviso de direitos autorais e a caixa do aceite são **os mesmos da cifra em texto** (sem texto legal novo): ao tocar em "Anexar PDF" sem o aceite, o app mostra o aviso e a caixa e diz o que falta; com o aceite, abre a escolha do arquivo. Depois: "PDF anexado (nome, tamanho)", "Trocar o PDF" e "Remover o PDF" (confirmação clara, porque remover apaga o arquivo do servidor). Na música nova o PDF escolhido espera o "Salvar".
- **Mensagens em palavras:** arquivo acima de 10 MB ("Este PDF tem 14 MB e o limite é de 10 MB..."), arquivo que não é PDF, sem internet, e a mensagem da API quando ela recusa.
- **Todos**, no repertório do encontro, no Meu repertório e na Biblioteca: o selo **"PDF" em texto** na linha da música (sem PDF e sem cifra, continua "Sem cifra"), e o cartão **"PDF da música"** com o botão **"Abrir PDF"**, que abre no visualizador do sistema (Quick Look no iPhone, aplicativo de PDF no Android, aba nova na web). Música com cifra em texto e PDF mostra as duas opções.
- **O PDF não transpõe tom.** Em música só com PDF, "Tom −" e "Tom +" ficam desabilitados e a tela escreve o motivo ("O PDF não muda de tom: ele abre do jeito que foi anexado. Para transpor, peça à organização a cifra em texto."). O tom do dia aparece em texto.
- **Modo palco com PDF:** botão grande "Abrir PDF" (tela cheia, sem barra) e a tela acesa que o palco já mantém. No Android o PDF abre em outro aplicativo, então a tela acesa depende dele.
- **Sem internet (quem toca):** "Deixar pronto sem internet" baixa o PDF junto, só se a versão mudou, e guarda na mesma partição cifrada. **"Pronto para tocar sem internet" só aparece com todos os PDFs baixados**; antes disso o cartão diz "Quase pronto: falta 1 PDF" e oferece "Baixar o que falta". O PDF abre sem rede e sai junto com a cópia (sair da comunidade ou da conta, 403 ou 404, 36 h depois do início do encontro).

**Regras de produto**

- Um PDF por música, até 10 MB. Trocar substitui; remover apaga.
- Anexar, trocar e remover: organizador e administrador (`conteudo.gerenciar`). Ler: toda a comunidade (`conteudo.ler`, D73). O músico que não organiza não anexa: dar esse direito pede papel novo e ADR, e a matriz não mudou.
- Direitos: o mesmo aceite da cifra; o banco recusa PDF sem aceite mesmo com a rota contornada. O arquivo fica só dentro da comunidade (sem link público, sem exportação, fora de log).
- Quem só lê (não toca) abre o PDF pela rede, sem cópia no aparelho: o pacote offline segue 403 para quem não toca (D73).

**Fora desta rodada:** várias versões do arquivo por música, miniatura da primeira página, busca dentro do PDF, anotação do músico sobre o PDF e baixar o PDF sem o repertório. Detalhes técnicos e rotas em [../design/v3/api-v3.md](../design/v3/api-v3.md).

## 13. Cadastrar música direto no repertório e links do Drive e do YouTube (D80, 22/11/2026)

Pedido do dono depois de testar o build 11 no iOS: a folha "Adicionar músicas" só dizia "Todas as músicas da biblioteca já estão neste repertório" e não oferecia como cadastrar mais uma ("faz o usuário dar voltas desnecessárias; o intuito do app é facilitar e não atrapalhar"), e a música deveria aceitar o link do Drive e do YouTube se quem organiza quiser.

**O que o usuário vê**

- **Folha "Adicionar músicas":** no alto, SEMPRE, o botão grande "Cadastrar nova música". Se a busca não acha uma música com aquele título, o botão vira `Cadastrar “Oceanos”` e o formulário abre com o título já escrito. Com a biblioteca toda usada: "Todas as músicas já estão aqui. Quer cadastrar uma nova?" com o botão. Com a biblioteca vazia: "A biblioteca ainda não tem músicas. Cadastre a primeira". O botão que conclui ("Adicionar 3 músicas") fica fixo embaixo, fora da rolagem; sem nada para marcar, ele nem aparece.
- **Formulário curto, na própria folha:** título (obrigatório), artista, tom, links, cifra em texto e PDF (todos opcionais). O aceite de direitos autorais só aparece quando há cifra ou PDF, igual ao da Biblioteca. "Salvar na biblioteca e adicionar ao repertório" cria a música e a coloca no fim do repertório de uma vez; a folha fecha e um aviso confirma. Os campos são os mesmos da Biblioteca (uma peça só: `conteudos/FormularioDeConteudo.tsx`).
- **"Só adicionar a este encontro" não existe, de propósito:** o repertório guarda uma referência a uma música da biblioteca. A folha diz: "Toda música cadastrada fica na biblioteca da comunidade, para usar de novo nos próximos encontros. Para tirá-la só deste repertório, use 'Tirar do repertório' na linha da música." Para ter música avulsa seria preciso um modelo novo e um ADR.
- **Links:** até 3 por música, cada um com nome opcional ("Cifra no Drive", "Versão ao vivo"), só endereços https do Google Drive e Docs (`drive.google.com`, `docs.google.com`) e do YouTube (`youtube.com`, `www.`, `m.`, `music.youtube.com`, `youtu.be`). "Adicionar link" abre o campo, com a ajuda "Cole o link do Drive ou do YouTube". Erros em palavras: "Só dá para usar links do Google Drive ou do YouTube", "O link precisa começar com https://", "Esse link traz usuário e senha". O aviso de direitos é o mesmo texto aprovado da cifra. O link é opcional, e a música antiga continua valendo sem ele.
- **Abrir:** "Abrir no YouTube" e "Abrir no Drive" (ícone, texto, 48 pt) na folha da música do repertório, no leitor do Meu repertório e na Biblioteca, com o aviso "Ao tocar, você sai do Uni Jovem e abre o link no aplicativo ou no navegador do celular". As listas dizem em texto "Links: YouTube e Drive". Sem internet, o botão fica parado ("Abrir o link precisa de internet"); o pacote do repertório leva os links só como texto.
- **A linha de música (quem organiza):** número, título, "Tom A (original G) · 72 bpm · 4:00 · de Ministério Exemplo", e à direita "Subir" e "Descer" (ícone e texto, 48 pt). Tocar na linha abre a folha da música: tom do dia (Tom − e Tom +, campo, salvar), links, "Abrir a cifra" e "Tirar do repertório" (com Desfazer). Acabaram o "Mais" solto e o Tom − e Tom + dentro da lista. O resumo do tempo foi para o subtítulo da tela.

**Regras**

- Permissão: nenhuma nova. Cadastrar direto pede `conteudo.gerenciar` e `etapa.gerenciar` (as duas são de organizador para cima). Membro lê os links.
- Segurança: a regra dos endereços é uma só (`packages/dominio/src/links-de-musica.ts`), conferida no app, na API e no banco (migração 0031). O app só abre o que passa na regra, mesmo vindo do servidor. O endereço não vai a log, auditoria nem log de mudanças.
- A música antiga com o link único (qualquer https) foi migrada para `links` quando cabe na regra; o que não cabe continua só para ler, com "Remover o link antigo" na edição.

**Fora:** música avulsa só de um encontro, pré-visualização do título do vídeo, link dentro do Modo palco, nomes do repertório uniformes entre telas de outros donos. Rotas em [../design/v3/api-v3.md](../design/v3/api-v3.md).
