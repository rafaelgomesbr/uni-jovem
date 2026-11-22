# Avaliação de usos: o app serve para outros grupos e eventos da igreja?

Análise de produto escrita em 22/11/2026, a pedido do dono: "temos que avaliar se esse app serve para diversos propósitos na igreja, seja nas classes jovens, na banda, em algum clube de desbravadores, acampamentos; esse é o propósito: algum evento fora da igreja." Ou seja: organizar qualquer grupo e evento ligado à igreja, para pessoas de todas as idades, inclusive idosos.

Este documento é só análise. Nenhum código, banco ou documento existente foi alterado. Tudo que está descrito como "o app tem" foi conferido no código e nas migrações em 22/11/2026; o que não foi conferido está marcado como "não verificado".

## 1. Veredito em 6 linhas

| # | Cenário | Veredito |
| - | ------- | -------- |
| 1 | Classe jovem, EBD, célula, grupo pequeno de casa | **Serve com ajuste pequeno.** Falta só texto e modelos; aniversariantes e frequência por pessoa não existem. |
| 2 | Banda, louvor e ministérios de serviço (recepção, mídia, som) | **Serve** para a banda (é o que o app tem de mais forte); **serve com ajuste pequeno** para recepção e mídia. |
| 3 | Clube de Desbravadores e Aventureiros | **Serve só para a diretoria adulta e os pais. NÃO serve para os meninos e meninas** (conta só a partir de 16 anos; sem ficha médica, sem cadastro de menor, sem autorização de pais). |
| 4 | Acampamento e retiro de vários dias | **Não serve de verdade para vários dias** (um encontro dura no máximo 24 h; não há quartos, cardápio, ficha de saúde nem pagamento). Serve com ajuste médio para um retiro de um dia ou um fim de semana tratado como encontros separados. |
| 5 | Evento fora da igreja, aberto a convidados | **Serve com ajuste pequeno**: local externo com mapa, página pública de inscrição com vagas e lista de espera, uso sem internet. Faltam carona e clima (e não devem virar módulo). |
| 6 | Igreja inteira com várias comunidades | **Isolamento serve e é o ponto mais forte; visão unificada não existe.** Os limites de comunidade nova (30 pessoas, 3 por conta) só deixam de valer com a verificação do Criador. |

Resposta curta à pergunta do dono: **o esqueleto serve para quase tudo que é "adulto se reúne, alguém convoca, alguém confirma, alguém marca presença"**. Onde o app falha é em tudo que envolve **menor de idade como pessoa dentro do app** e em **evento de vários dias com dado por participante** (saúde, quarto, pagamento). Esses dois pontos não são "ajuste": são decisões de privacidade e de escopo, e a recomendação é não entrar neles agora.

## 2. O que o app FAZ de verdade hoje (conferido no código)

| Capacidade | Prova (arquivo ou modelo) | Observação que importa para outros usos |
| ---------- | ------------------------- | --------------------------------------- |
| Comunidade com papéis admin, organizador e membro por vínculo | `apps/api/migracoes/0001_nucleo.sql` (`comunidades`, `vinculos`), `packages/dominio/src/papeis.ts` | O papel vive no vínculo: a mesma conta pode ter papéis diferentes em comunidades diferentes. Comunidade é plana (não há comunidade dentro de comunidade). Sem coluna de "tipo" de comunidade. |
| Encontro com data, duração, local, status, capacidade, lista de espera, visibilidade interna ou pública | `0004_eventos.sql` (`eventos`) | **`duracao_min` vai de 5 a 1440 (24 h).** Não existe evento de vários dias. |
| Roteiro por etapas (título, duração, descrição) | `0004_eventos.sql` (`etapas`) | Cada etapa dura até 600 min; o total do encontro ainda cabe em 24 h. |
| Convocar pessoa para o encontro ou para uma etapa, com função em texto livre; aceitar, recusar, pedir substituição | `0004_eventos.sql` (`atribuicoes`), `0006_escalas.sql` (`substituicoes`, `disponibilidades`) | Só vale para quem tem **conta e vínculo**. Não existe participante sem conta numa escala. |
| Repetição (série semanal etc.) | `0005_recorrencia.sql` (`series`), `packages/dominio/src/recorrencia.ts` | Serve a aula semanal. |
| Modelos de encontro por comunidade | `0004_eventos.sql` (`modelos`) e `programacao.ts` (`MODELOS_EMBUTIDOS`) | Cada comunidade cria os próprios modelos; o único embutido é "Sábado padrão" (com Louvor, Dinâmica, Estudo da lição e Brinde). |
| Tarefas, materiais (quem providencia), checklist de preparação e encerramento, notas internas, anexos por link https | `0004_eventos.sql` | "O que levar" existe como material com responsável, ou como texto livre. |
| Inscrição de membro e inscrição pública por página própria, com vagas, lista de espera e promoção automática | `0008_inscricoes.sql`, `0021_inscricao_de_irmaos.sql`, `apps/api/src/publico/rotas.ts` | A inscrição pública guarda **nome, WhatsApp, e-mail e o aceite**. Não há campo extra (alergia, tamanho de camiseta, responsável). A página pública só existe em comunidade **verificada**. A organização **não tem rota para inscrever alguém manualmente** (`apps/api/src/rotas/inscricoes.ts` só tem listar, "inscrever-me", cancelar, check-in e presenças). |
| Check-in por QR, manual e offline; "chegou sem inscrição" por nome | `0008_inscricoes.sql` (`presencas.nome_avulso`) | Serve a visitante avulso, mas o nome é redigitado a cada encontro: **não há cadastro de visitante**. |
| Presença: relatório por encontro e exportação | `apps/api/src/rotas/relatorios.ts` (`TIPOS_DE_EXPORTACAO`: presenca, inscricoes, escalas, membros) | Contagem por encontro. **Não há frequência por pessoa ao longo do tempo.** |
| Locais internos e externos com endereço, coordenadas e link para o mapa do aparelho | `0004_eventos.sql` (`locais`), `apps/app/src/utilidades/mapas.ts`, página pública com "Ver no mapa" | Serve a evento fora da igreja. Sem rota, clima ou ponto de encontro estruturado (só texto livre). |
| Ao vivo (condução do encontro), uso sem internet com cofre cifrado, validade de 14 dias por padrão | `0007_ao_vivo.sql`, ADR 0005 (pensado para "igreja, retiro, sítio") | Bom para acampamento sem sinal. |
| Avisos, pedidos de oração (cifrados, anônimos), sugestões, Biblioteca (músicas, palestrantes, dinâmicas) | `0009_oracao_sugestoes_conteudos_avisos.sql`, `0024_oracao_anonima.sql` | Oração é o dado mais sensível hoje e já tem o padrão de cifra (`texto_cifrado`). |
| Repertório, cifra, Modo palco, banda ("Falta: bateria") | `0027_repertorio_e_cifra.sql`, `packages/dominio/src/{cifra,banda,repertorio}.ts`, `docs/produto/modo-musico.md` | A banda é reconhecida pela etapa de título "Louvor" (ver cenário 2). |
| Isolamento entre comunidades por RLS, 404 e inventário de rotas | `CLAUDE.md` seção 8, `docs/adr/0002-isolamento-por-comunidade-rls.md`, `isolamento.test.ts` | Requisito central; qualquer ideia nova precisa respeitá-lo. |
| Idade mínima de 16 anos para ter conta; 16 e 17 com ciência do responsável | `docs/privacidade/politica-de-privacidade.md` seção 12, D27, `apps/api/src/autenticacao/servico.ts` (`MENOR_DE_16`), `consentimentos.ts` | **Decisão estrutural para os cenários 1, 3 e 4.** Classificação das lojas 16+ pelo mesmo motivo (`docs/lojas/metadados.md` seção 5). |
| Sem pagamento, sem cobrança, sem planos | `docs/rastreabilidade.md` (EXT-01: "Fora do escopo: marketplace, cobrança, planos"), D4 (teto R$ 0) | Consistente com a pergunta do dono. |

### Quatro fatos estruturais que decidem quase tudo

1. **Menor de 16 anos não tem conta** (D27, política de privacidade seção 12, "Comunidades não devem aceitar nem convidar menores de 16"). O público de Desbravadores (10 a 15) e Aventureiros (6 a 9) fica fora por desenho. Um menor só aparece hoje como **inscrito feito pelo responsável** numa página pública de evento.
2. **Um encontro dura no máximo 24 horas** (`eventos.duracao_min <= 1440`). Acampamento de vários dias precisa de uma solução de modelagem.
3. **Não existe dado por participante além de nome, contato e presença.** Sem campos personalizados, sem ficha, sem grupo (quarto, barraca, equipe).
4. **Comunidade nova tem "rodinhas"**: até 30 vínculos, nenhum evento público, 1 nova ao mesmo tempo e 3 criadas por conta (`0022_app_aberto.sql`, `politicas.ts`). Só a verificação pelo Criador (`uj.definir_verificacao`) as retira, e só o Criador cria sem limite (`podeCriarComunidade`). Como o dono é o Criador, isso é um trabalho dele, não um bloqueio técnico; mas um líder de clube que crie a própria comunidade sozinho esbarra nisso.

## 3. Cenário por cenário

Legenda de esforço: **pequeno** (até 2 dias de trabalho, sem migração ou com migração trivial), **médio** (1 a 2 semanas, migração e rota nova com teste de isolamento), **grande** (mais de 2 semanas ou decisão jurídica no caminho).

### 3.1 Classe jovem, EBD, escola bíblica, célula

**Personas.** Professora Marta, 58, dá a lição de domingo para 14 adultos e usa caderno de chamada e um grupo de WhatsApp. Seu Antônio, 68, aluno, só quer saber dia, hora, sala e se há lição para ler. Lucas, 17, jovem que chega e sai de várias turmas.

| Necessidade | O app tem hoje? | Prova | Lacuna |
| ----------- | --------------- | ----- | ------ |
| Encontro semanal recorrente | Sim | `series` (`0005`), "Igual ao último sábado" | Os textos dizem "sábado" mesmo para uma classe de domingo ou quarta (`TelaIgualAoUltimo.tsx`, "Sábado padrão"). Ajuste pequeno: "Igual ao último encontro". |
| Roteiro da aula (abertura, lição, oração) | Sim, como modelo próprio | `modelos` (`0004`) | O único modelo embutido tem Louvor e Brinde. Faltam modelos "Aula" e "Reunião de grupo" (código, `programacao.ts`). Pequeno. |
| Chamada de presença | Sim | `presencas`, tela Check-in ("Convocados e inscritos" e "Outras pessoas") | Lista da classe inteira funciona; **não há frequência por pessoa ao longo do mês**. Médio, e só se pedirem. |
| Material da lição | Parcial | `anexos` por link, `materiais` | Link por encontro, sem "material do trimestre". Suficiente. |
| Professores e auxiliares | Sim | convocação com função livre | Nenhuma. |
| Pedido de oração e avisos da turma | Sim | `pedidos_oracao`, `avisos` | Nenhuma. É onde o app mais agrada. |
| Aniversariantes | **Não** | A política diz que a data de nascimento nunca é guardada (só a faixa `16_17` ou `18_mais`) | Decisão de privacidade. Opção: **dia e mês, sem ano, opcional, digitado pela própria pessoa**, visível só à organização e nunca para quem tem 16 ou 17 anos. Médio e baixo valor até alguém pedir. |
| Visitantes | Parcial | `presencas.nome_avulso` | Registra a presença do visitante, mas não guarda o visitante para a próxima semana nem permite "acompanhar". Não construir: virar CRM é burocracia. |

- **Risco.** Classe de crianças (berçário, juniores) cai no cenário 3: a criança não tem conta. Só a turma de adultos e jovens de 16 anos ou mais cabe sem restrição.
- **O que NÃO deve entrar.** Nota de aluno, diário de classe, trilha de leitura com cobrança, ranking de presença (pressão social em idoso e em jovem), ficha de visitante.
- **Esforço total para servir bem:** pequeno. **Prioridade:** alta (é grátis e valida o uso fora do louvor).

### 3.2 Banda, louvor e ministérios de serviço

**Personas.** Daniel, 32, ministro de louvor. Bruno, 24, baterista que troca de sábado. Dona Regina, 61, coordena a recepção e faz escala em caderno. Cláudio, 40, da mídia (projeção e som).

| Necessidade | O app tem hoje? | Prova | Lacuna |
| ----------- | --------------- | ----- | ------ |
| Escala por função | Sim | `atribuicoes`, convocar em lote (D66, `montar-encontro.ts`) | Função é texto livre; só o louvor tem lista padrão (`FUNCOES_DA_BANDA`). Para recepção, mídia e infantil basta uma lista sugerida de funções por tipo. Pequeno. |
| Ensaio | Parcial | Encontro com etapa "Louvor" | As telas de banda (repertório, "Falta: bateria") dependem da etapa chamada "Louvor" (`STATUS.md`, D73: "o Louvor aparece como bloco da folha só quando o encontro tem a etapa Louvor"). Um encontro de ensaio precisa ter essa etapa. Ajuste pequeno a médio (**não verificado** onde mais o nome é usado). |
| Repertório, cifra, tom, capotraste, modo palco, sem internet | Sim | `0027`, `modo-musico.md`, D71 | Nenhuma relevante. |
| Troca de escala | Sim | `substituicoes` (`0006`), "Preciso de alguém no meu lugar", "Pedem ajuda" | Nenhuma. |
| Disponibilidade | Sim, por data | `disponibilidades` | Falta "não posso todo primeiro domingo" (indisponibilidade recorrente). Médio, só se pedirem. |
| Rodízio automático ("é a vez da equipe B") | Não | | Não construir ainda: escala automática erra e gera conflito humano. A liderança escolhe. |
| Regente editar repertório sem ser organizador | Não | `permissoes.ts` só tem a designação `equipe_oracao` | Decisão aberta desde `modo-musico.md`. Resolver só se houver pedido. |

- **Risco.** Direito autoral da cifra (aviso já existe, revisão jurídica pendente em PH-11). Menores: adolescente de 16 e 17 anos na banda é permitido com a ciência do responsável.
- **O que NÃO deve entrar.** Banco público de cifras, partitura, gravação de áudio, mensagem direta entre músicos, ranking de quem toca mais.
- **Esforço:** pequeno. **Prioridade:** alta (já é o caso de uso de maior valor).

### 3.3 Clube de Desbravadores e Aventureiros

**Personas.** Diretor Paulo, 45, cuida de 40 desbravadores (10 a 15 anos) com 8 conselheiros. Conselheira Rute, 29, cuida da unidade "Águias". Dona Neuza, 63, mãe e avó de dois meninos, quer saber horário, uniforme e autorização. Pedro, 12, desbravador (**não pode ter conta**).

| Necessidade | O app tem hoje? | Prova | Lacuna |
| ----------- | --------------- | ----- | ------ |
| Reunião semanal, agenda, local | Sim | `series`, `locais` | Nenhuma para a diretoria e os pais. |
| Escala da diretoria e dos conselheiros | Sim | `atribuicoes` | Nenhuma. |
| Avisos aos pais (uniforme, data, o que levar) | Sim, **se os pais tiverem conta** | `avisos`, push genérico | O pai e a avó entram como membros adultos. Funciona hoje. |
| Presença das crianças | Parcial | `presencas.nome_avulso` | Não há lista da unidade. Digitar o nome de 40 crianças a cada reunião não serve. **Falta cadastro de participante sem conta**, e esse cadastro é de menor. |
| Unidades, classes progressivas, especialidades | **Não** | | É controle de progresso de criança. Tem lugar no sistema próprio do clube (IASD/DSA); não replicar. |
| Autorização dos pais e contato de emergência | **Não** | Só existe o aceite "sou o responsável" da inscrição pública (`publico/rotas.ts`, `consentimento_em`) | Aceite de inscrição não é autorização de atividade nem de viagem. |
| Ficha médica e alergias | **Não** | Nenhuma tabela | Dado de saúde de criança é dado sensível (LGPD art. 11 e art. 14). |
| Regras de proteção (adulto nunca sozinho com criança, dois adultos por atividade) | **Não** | | É regra do clube, não do app. O app pode mostrar um **checklist de encerramento** padrão (já existe `checklist_itens`). |

- **Risco (alto).**
  - A política de privacidade diz que comunidades **não devem aceitar menores de 16** (seção 12). Uma comunidade de clube com vínculos de crianças contradiz o que está publicado e contradiz o aceite do administrador (TC-16).
  - A classificação 16+ nas lojas existe porque o app barra menores. Um app "para crianças" muda a classificação, o questionário de privacidade das lojas e a exposição ao ECA Digital (Lei 15.211/2025), inclusive o vínculo de conta ao responsável (`politica-de-privacidade.md` seção 12, item 3 da revisão jurídica).
  - Ficha médica exige base legal, minimização, acesso restrito, prazo de guarda e expurgo. A revisão jurídica da PH-11 ainda nem fechou o caso mais simples (adolescente de 16 e 17 anos).
- **Como servir sem entrar nesse risco.** A diretoria e os pais usam o app (adultos, conta normal). As crianças **não são pessoas no app**. Ficha médica, autorização e lista de unidade ficam fora, no formulário de papel ou no sistema do clube, e o app leva só um **link https** para o formulário (anexo, já existe) e um item de checklist "autorizações conferidas".
- **O que NÃO deve entrar.** Cadastro de menor, ficha médica no app, especialidades e classes, foto de criança, conta de criança, mensagem entre adulto e criança, geolocalização de menor.
- **Esforço para a diretoria e os pais:** pequeno (texto de ajuda e modelo). **Esforço para os menores:** grande, com decisão jurídica no caminho. **Prioridade:** diretoria, média; menores, **não agora**.

### 3.4 Acampamento e retiro de vários dias

**Personas.** Coordenadora Lia, 36, organiza o acampamento de 3 dias com 60 vagas. Tio Zé, 64, cozinheiro voluntário. Dona Neuza, mãe, inscreve o neto de 13. Bia, 19, no apoio de recreação.

| Necessidade | O app tem hoje? | Prova | O que fazer |
| ----------- | --------------- | ----- | ----------- |
| Inscrição com vagas e lista de espera | **Sim** | `eventos.capacidade`, `lista_de_espera`, `inscricoes.estado = 'espera'`, aviso "Vaga confirmada" (`0025`) | Nenhuma. É o melhor ponto do cenário. |
| Inscrição de menor pelo responsável | Parcial | `inscrever_publico`, texto "eu sou o pai, a mãe ou o responsável" | Serve para menor de 16. Só em comunidade verificada. Não é autorização de viagem. |
| Várias datas (3 dias) | **Não como um evento** | `eventos.duracao_min <= 1440` | Gambiarra: **um encontro por dia** (Sexta, Sábado, Domingo), cada um com as etapas do dia. Vagas e inscrição ficam no primeiro. Médio para suportar de verdade (permitir duração de vários dias e agrupar o roteiro por dia). |
| Programação por dia | Sim, nos encontros diários | `etapas` | Ver acima. |
| Quartos, barracas, equipes | **Não** | | Gambiarra possível: uma etapa por equipe. Não recomendo. Se pedirem: grupos simples do evento com nome livre, sem tabela de dependentes. Médio. |
| Cardápio | Texto | `informacoes_uteis` (até 5000 caracteres) | Colar o cardápio ali. Não é módulo. |
| O que levar | Sim | `materiais` e `informacoes_uteis` | Lista única do evento, sem "meu pacote". Suficiente. |
| Equipe de cozinha, saúde, recreação | Sim | convocação por função | Funciona para quem tem conta. |
| Saúde e alergias | **Não** | | Ver 3.3. Fora do app; cada responsável leva a ficha em papel ou entrega à enfermeira. O app só tem um item de checklist "fichas conferidas" e o contato de emergência da liderança. |
| Autorização dos pais | **Não** | | Autorização de viagem de menor tem regra legal própria (ECA, arts. 83 e 84; **confirmar com advogado ou com a regra da denominação**). O app leva o link do formulário e a lista de "autorização recebida" fica como checklist, sem guardar o documento. |
| Transporte e caronas | **Não** | | Texto no aviso e no encontro (ponto de encontro, horário de saída). Não construir módulo de carona. |
| Comunicados | Sim | `avisos`, push genérico | Nenhuma. |
| Uso sem internet no sítio | **Sim** | ADR 0005, pacote offline, check-in offline | Ótimo diferencial. Falta provar em aparelho (D71 "não verificado"). |
| Pagamento | **Não, por decisão** | D4 (R$ 0) e EXT-01 | **O que fazer sem processar pagamento:** a organização escreve em `informacoes_uteis` o valor, a chave Pix e o prazo; o pagamento acontece fora do app; a tesouraria confere em planilha própria. Dentro do app, no máximo uma **marca manual "pagamento conferido"** por inscrição, sem valor, sem comprovante, sem integração. Essa marca é médio e opcional (**não verificado** se a promoção manual da espera serve como substituto). |
| Inscrever alguém por telefone (idoso, quem não usa app) | **Não** | Sem rota de inscrição manual pela organização | Médio e valioso. Também resolve o idoso que liga e não instala nada. Ver onda 2. |

- **Risco.** Saúde e autorização de menor (acima), foto de criança em acampamento, lista de presença com menor exposta em exportação (a exportação de presença e inscrições já existe, com retenção de 90 dias por padrão, `comunidades.retencao_inscricoes_dias`).
- **O que NÃO deve entrar.** Gateway ou link de pagamento, cobrança parcelada, gestão de quartos com sexo e idade, ficha médica, GPS de participante, mapa do acampamento interativo.
- **Esforço:** evento de vários dias médio; o resto é texto e checklist. **Prioridade:** média, e **só com um acampamento real como piloto** (pergunta 3 ao dono).

### 3.5 Evento fora da igreja

**Personas.** Lia, 36, organiza a ação social na praça. Seu Jorge, 70, quer ir e precisa saber o ponto de encontro. Convidada Ana, 28, vê o link num grupo e não tem o app.

| Necessidade | O app tem hoje? | Prova | Lacuna |
| ----------- | --------------- | ----- | ------ |
| Local externo com endereço e mapa | Sim | `locais.tipo = 'externo'` (endereço obrigatório), `linkDoMapa` | Nenhuma. |
| Ponto de encontro | Texto | `informacoes_uteis` e `locais.referencia` | Suficiente. |
| Evento aberto a convidados com inscrição | Sim | `visibilidade = 'publica'`, página `/e/...` com "Ver no mapa" | Só em comunidade verificada. Sem conta: nome, WhatsApp e aceite. |
| Check-in na porta com QR, sem internet | Sim | `presencas` offline | Nenhuma. |
| Carona | Não | | Texto. Não construir. |
| Clima | Não | | Não construir: o aparelho já tem previsão. Um link no texto resolve. |
| Voluntários e tarefas | Sim | `atribuicoes`, `tarefas`, `materiais` | Nenhuma. |

- **Risco.** Divulgar endereço (casa de membro) em página pública: a página mostra endereço do local; local residencial não deve ser público. Orientar a usar evento interno para casa.
- **O que NÃO deve entrar.** Rastreamento de pessoas, localização ao vivo, mapa próprio, previsão do tempo no app.
- **Esforço:** pequeno. **Prioridade:** média.

### 3.6 Igreja inteira com várias comunidades

**Personas.** Pastor Marcos, 52, quer saber "o que acontece esta semana na igreja". Dona Neuza está na classe, no clube (como mãe) e na recepção. Rafael (Criador) administra tudo.

| Necessidade | O app tem hoje? | Prova | Lacuna |
| ----------- | --------------- | ----- | ------ |
| A mesma pessoa em várias comunidades, com papéis diferentes | **Sim** | `vinculos unique (conta_id, comunidade_id)`, folha "Comunidades" no Perfil | Nenhuma. |
| Isolamento entre elas | **Sim, é o ponto mais forte** | RLS, 404, inventário `isolamento.test.ts` | Nenhuma. |
| Visão "minha semana" reunindo as comunidades | **Não** | O app entra na última comunidade usada (D57) | Agenda e Início são de uma comunidade por vez. Médio. **Fazer no app**, juntando as comunidades da própria pessoa, sem rota nova que cruze comunidades (preserva o isolamento). |
| Avisos da igreja toda | **Não** | | Convenção sem código: uma comunidade "Igreja X" com todos, só para avisos gerais; os ministérios são comunidades à parte. |
| Visão do pastor sobre todas as comunidades | **Não** | | Não construir. Quebra o isolamento por desenho; o pastor entra como membro ou organizador em cada uma. |
| Criar muitas comunidades | Com limite | `0022`: 3 por conta, 30 vínculos e sem evento público enquanto "nova" | O Criador cria e verifica as comunidades da igreja; para outras igrejas, cada líder esbarra nas rodinhas. |
| Notificação que diz de qual comunidade | Parcial | D25: o push é genérico por privacidade; o sino já mostra o título real (D66) | Quem está em 4 comunidades recebe "Nova convocação" sem saber qual. Aceitável; o sino resolve. |

- **Risco.** Uma agregação que cruze comunidades no servidor é o tipo de rota que o `CLAUDE.md` seção 8 existe para barrar. Agregar no aparelho, só com as comunidades em que a pessoa já tem vínculo.
- **O que NÃO deve entrar.** Hierarquia (igreja > ministério > grupo), permissão que desce de comunidade-mãe, relatório "da igreja inteira", pessoa vista por outra comunidade.
- **Esforço:** pequeno (convenção) e médio ("Minha semana"). **Prioridade:** média.

### 3.7 Grupo pequeno, casa, célula sem estrutura

**Personas.** Casal Edson e Joana, 60 e 58, recebem 8 pessoas toda quinta. Querem: data, quem leva o lanche, um pedido de oração.

| Necessidade | O app tem hoje? | Lacuna |
| ----------- | --------------- | ------ |
| Quinta toda semana, com a casa como local | Sim (série e local) | Texto "sábado" nas telas e modelo com Louvor e Brinde. Modelo "Célula" com 3 etapas (partilha, palavra, oração). |
| Quem leva o lanche | Sim (`materiais` ou convocação com função "Lanche") | Nenhuma. |
| Pedido de oração | Sim | Nenhuma. |
| Entrar sem burocracia | Parcial | Criar conta tem aceites jurídicos e fé (TC-03); é o que a lei e as lojas exigem. Reduzir não está nas nossas mãos. |
| Esconder o que sobra (roteiro, ao vivo, repertório, check-in) | Parcial | O Início do membro já é mínimo (D62); o resto está dobrado para quem organiza. |

- **Risco.** Endereço da casa visível a todos os membros (privacidade de quem recebe). Mostrar só a quem aceitou; hoje o local é visível a membros do evento.
- **O que NÃO deve entrar.** Modo "simples" separado, outra versão do app, assistente de configuração longo.
- **Esforço:** pequeno. **Prioridade:** alta (casos reais, baratos, validam a facilidade).

## 4. (a) Como a estrutura generaliza: o vocabulário é fixo ou configurável?

**Fatos.**

- **O vocabulário é fixo no código.** Não existe coluna de tipo ou de rótulos na comunidade (`0001_nucleo.sql` e `0022_app_aberto.sql` não têm). A D57 (migração `0025_vocabulario_do_encontro.sql`) unificou "evento" e "programação" em **"Encontro"** na interface e deixou tabelas, rotas e tipos com "evento"; ela não tornou nada configurável. (A D25 citada no pedido é a fila de push; a que trata do nome é a **D5**, constante `NOME_DO_APP` em `packages/dominio/src/produto.ts`, e a de vocabulário é a **D57**.)
- Medido no código do app (sem os testes): "encontro" aparece **653 vezes em 126 arquivos**; "sábado", "Louvor" e "Jovem" aparecem **190 vezes em 59 arquivos**. O nome "Uni Jovem" tem 17 aparições em 13 arquivos de tela, além da constante.
- A comunidade já personaliza **nome, cor e logotipo** (`comunidades.nome`, `cor`, `logos_comunidades`), então dentro do app cada grupo vê o próprio nome, não o da marca.
- **"Encontro" já é neutro o bastante** para aula, ensaio, reunião de clube, célula e cada dia de retiro. Não precisa virar "Aula" ou "Ensaio" para o app servir.

**O que realmente é específico demais hoje (são poucos pontos).**

| Ponto | Onde | Correção |
| ----- | ---- | -------- |
| "Igual ao último sábado", "Marcar o próximo sábado", "Sábado padrão" | `TelaIgualAoUltimo.tsx`, `momento.ts`, `programacao.ts` | Trocar por "último encontro" e "próximo encontro". Pequeno. |
| Modelo embutido único com Louvor, Dinâmica e Brinde | `programacao.ts` (`MODELOS_EMBUTIDOS`) | Acrescentar modelos embutidos. Pequeno, sem migração. |
| Atalho "Louvor" na aba Comunidade e blocos de banda atrelados à etapa "Louvor" | `atalhosDoMural.ts`, `TelaLouvor.tsx`, `BandaDoEncontro.tsx` | Mostrar só para comunidade que usa. Pequeno a médio. |
| Categorias sugeridas (Noite de jogos, Luau, Doação de sangue...) | `CATEGORIAS_SUGERIDAS` | Lista por tipo. Pequeno. |
| Aviso de privacidade e termos falam em "grupo de jovens" | `docs/privacidade/` | Revisão de texto (PH-11). |

**Proposta: "modelo de uso" da comunidade, sem multiplicar telas.**

Uma única coluna `comunidades.modelo_de_uso` (texto, com padrão `geral`), escolhida **uma vez**, na criação, com uma pergunta de uma linha: "O que vocês fazem?". Ela só escolhe quatro coisas, todas em código, sem tela nova:

| Modelo | Rótulos sugeridos | Modelo de encontro embutido | O que aparece | O que fica escondido |
| ------ | ----------------- | --------------------------- | ------------- | -------------------- |
| **Classe ou grupo** | Encontro, Aula | Aula (Abertura, Lição, Conversa, Oração) | Presença, avisos, oração | Repertório, banda |
| **Banda ou ministério** | Encontro, Ensaio, Culto | Ensaio (Aquecimento, Repertório, Avisos) com a etapa Louvor | Repertório, cifra, banda, troca de escala | Inscrições |
| **Clube (só adultos no app)** | Reunião | Reunião (Abertura, Atividade, Encerramento) com checklist de proteção | Escala dos adultos, avisos aos pais, presença da diretoria | Inscrição pública de menor sem texto do responsável |
| **Acampamento ou retiro** | Programação, Dia | Retiro (um encontro por dia) | Inscrição com vagas, "o que levar", comunicados, offline | Repertório |
| **Geral** (padrão) | Encontro | Em branco e Sábado padrão | Tudo como hoje | |

Regras de desenho:

1. **Nada muda para quem já usa.** Padrão `geral` é o comportamento de hoje.
2. **Só rótulos, modelos e o que fica dobrado.** Permissões, banco, RLS e rotas não mudam. A matriz continua a mesma (`packages/dominio/src/permissoes.ts`).
3. **Os papéis não são renomeados** (Administrador, Organizador, Membro). Renomear papel quebra a matriz gerada, os testes de todas as células e a lembrança de quem já usa.
4. **O push continua genérico** ("Encontro", "convocação"): é decisão de privacidade (D25), não de vocabulário.
5. **O membro nunca vê o "modelo de uso"**; só vê as consequências (as palavras certas).
6. **Cortar:** nada de tipo definido pelo usuário, nada de rótulo editável livre, nada de tela de personalização.

**Sequência.** Não fazer antes de existir um segundo grupo real usando. Antes disso, os ajustes da onda 1 (trocar "sábado" por "encontro" e acrescentar modelos) entregam 80 por cento do efeito sem coluna nova.

## 5. (b) Impacto na marca

| Proposta | Serve para todos os públicos? | Por quê |
| -------- | ----------------------------- | ------- |
| **A. Uni Jovem** | **Não.** Serve enquanto o app for de jovens. | "Jovem" exclui, na própria porta, a classe de idosos, a mãe do desbravador, o grupo de casa de 60 anos e o ministério de recepção. Seu Antônio (68) não baixa um app com "Jovem" no nome para a classe dele. |
| **B. Nossa Roda** | **Sim, é a mais próxima.** | "Roda" é grupo, sem idade nem estilo. O ícone com um lugar vago ("sempre cabe mais um") fala a célula, a classe e o clube. Serve a banda menos diretamente, mas não a exclui. Condicionada ao conflito com o pedido "GRUPO NOSSA RODA" no INPI (classe 41, em exame): `docs/marca/leia-me.md` já diz que um advogado de marcas precisa olhar. |
| **C. Bom Rolê** | **Não para todos.** | "Rolê" é gíria jovem e de passeio ou festa. Funciona para o público de 16 a 30 e soa estranho para a igreja tradicional, para idosos e para o clube infantil visto pelos pais. É o maior esforço (marca, tema claro, nova fonte). |

**Recomendação.**

1. Se a resposta à pergunta 1 do dono for "igreja toda, todas as idades": **escolher B (Nossa Roda)** se o parecer do INPI permitir; se barrar, **não escolher C por falta de opção**: pedir outra rodada com nomes neutros (sem "Jovem", sem gíria).
2. Se a resposta for "continua de jovens, os outros são convidados": **manter A**. Não há razão para pagar o custo de rebatizar por um uso que ainda não existe.
3. **O nome é trocável** (D5; `NOME_DO_APP` única e os ids técnicos `com.solerte.unijovem` não mudam em nenhuma proposta, segundo `docs/marca/leia-me.md`). Portanto a decisão **não precisa ser feita antes do piloto** de um segundo tipo de grupo. O custo real de esperar é só o do nome já aparecer na loja e nos materiais.
4. A marca do **grupo** é do grupo: cada comunidade já tem nome, cor e logo próprios. O clube vê "Clube Águias", não a marca do app.
5. Texto da loja e política dizem "grupos de jovens" (`docs/lojas/metadados.md`); se o escopo mudar, o texto muda antes da marca.

## 6. (c) Facilidade de uso, idosos incluídos: o que NÃO adicionar

O app já tem quatro abas, um botão primário por tela e o Início por momento (D62, D68). A promessa "fácil para idosos" é uma **hipótese de desenho, não um fato provado**: VoiceOver, TalkBack, fonte a 200% e uso em aparelho real aparecem como "não verificado" em todas as ondas do `STATUS.md`. Antes de ampliar o público, o teste com 3 idosos de verdade vale mais que qualquer funcionalidade nova.

**Lista de "não" (por escrito, com o motivo).**

| Não adicionar | Motivo |
| ------------- | ------ |
| Uma quinta aba ou menu por tipo de grupo | O app tem 4 abas porque pessoas não pensam em módulos (`app-v3-ux.md` seção 2). Cada tipo novo vira "Mais opções" do líder. |
| Campos obrigatórios novos no cadastro (idade exata, endereço, responsável, tamanho de camiseta) | Cada campo derruba cadastro. A inscrição pública já pede nome, WhatsApp e aceite. |
| Chat, mensagem direta, feed, curtida | Política de privacidade diz "nenhuma mensagem direta"; é também a razão da classificação 16+ e a salvaguarda de menor. |
| Pagamento dentro do app | D4 (R$ 0), EXT-01, risco financeiro e fiscal. Pix fora do app. |
| Ficha médica, alergia, documento de menor | Dado sensível; risco jurídico e de vazamento maior que o ganho. Ficha em papel ou sistema do clube. |
| Gamificação (pontos, medalhas, ranking de presença) | Pressão social; idoso e adolescente reagem mal. |
| Perfis de criança, foto de criança | Política e lojas. |
| Painel com muitos números para o membro | A regra 4 do produto: uma métrica por vez; o membro só precisa de "quando, onde, qual é a minha parte". |
| Papéis novos e permissões configuráveis por comunidade | Quebra a matriz única (`CLAUDE.md` seção 9), os testes de todas as células e a leitura do líder. |
| Versão "simples" separada para idosos | Dois produtos. A simplicidade tem de valer para todos. |
| Configuração obrigatória no primeiro uso | Quem cria um grupo escolhe o nome e "O que vocês fazem?" e começa. |

**Regra para qualquer funcionalidade nova:** ela nasce dobrada, só para quem organiza, e o membro (Dona Neuza, Seu Antônio) não vê nenhum termo novo na primeira tela (princípio P3 do `app-v3-ux.md`).

## 7. Diagnóstico, risco principal e validação (produto)

**Diagnóstico em uma frase.** O app é hoje uma ferramenta excelente para a **liderança adulta** de grupos que se reúnem com regularidade (escala, convocação, presença, aviso, oração, banda); ele não é, nem deve virar, um cadastro de **pessoas menores de idade** nem um sistema de **evento com dado por participante**.

**A pergunta mais arriscada (valor, não técnica).** Líderes de grupos que não são o do dono (clube, retiro, classe, recepção) **deixam o WhatsApp e a planilha** pelo app, ou só usam quando o dono opera por eles? Se não houver dor atual forte, a generalização não paga o custo de manter.

**O experimento mais barato (apetite de 3 semanas, escopo variável).** Usar **o app como está** em **um** evento real fora do louvor (a reunião de uma classe, uma célula ou um retiro de um dia), com os ajustes da onda 1 e os modelos novos, e ver se o líder, sem ajuda do dono, publica o encontro, convoca e marca presença. Compromisso concreto exigido: **data marcada, lista real de convocados, e o líder fazendo**.

**Freio da própria disciplina.** O usuário aqui é o dono e gente que ele conhece de perto. Descoberta curta: **três conversas de 30 minutos** (um líder de clube, um coordenador de retiro, uma professora de EBD) e seguir. Nada de entrevista semanal.

**Roteiro de validação: 5 perguntas sobre o passado** (Mom Test).

1. "Da última vez que vocês fizeram [o retiro, a reunião do clube, a aula], como foi montada a lista de quem ia, em que ferramenta, e quantas horas levou?"
2. "Da última vez, o que foi esquecido ou deu errado (autorização, alergia, carona, quem leva o quê)? Como você descobriu, e o que custou?"
3. "Quem mais mexeu nessa lista além de você, e como essa pessoa ficou sabendo do que mudou?"
4. "Como os pais, os avós ou os alunos ficaram sabendo de data, local e o que levar? Quantos você precisou ligar para confirmar?"
5. "Você já usou um app, planilha ou formulário para isso? Por que parou? Posso ver o arquivo? E você separa 30 minutos esta semana para passar a lista real (com nomes fictícios) para o app?"

Elogio ("que legal") não conta. Contam: o arquivo mostrado, a data agendada e o líder que fez sozinho.

**Métrica principal (uma só).** Comunidades fora do círculo imediato do dono que tiveram **pelo menos um encontro com presença registrada ou convocação respondida nos últimos 28 dias**.

**Eventos a medir.** `encontro.publicado`, `convocacao.respondida`, `presenca.registrada`, `inscricao.criada`, `comunidade.criada`. Todos são derivados de linhas que já existem (`eventos.status`, `atribuicoes.estado`, `presencas`, `inscricoes`, `comunidades`), então **a contagem pode sair do banco por consulta, sem rastreador de terceiros**, coerente com R$ 0 e com a política de privacidade. (Não verificado: se o painel do Criador, `ler_saude_da_plataforma`, já mostra isso.)

**Modelo de receita e primeira hipótese de preço.** Hoje: **R$ 0**, para igrejas e grupos. É coerente com D4, com EXT-01 ("fora do escopo: cobrança, planos") e com o ponto de partida (o dono é o Criador e verifica as comunidades). Só se testa preço **se aparecer** uma federação, associação ou união querendo várias igrejas com apoio; a primeira hipótese seria um valor mensal por igreja, a testar com a pergunta de compromisso "vocês pagariam isto, hoje, e quem assinaria?". Até lá, nenhum código de cobrança.

**O que acontece se ninguém usar?** Nada se perde: a onda 1 custa poucos dias, não adiciona banco nem dependência, e melhora o uso atual do dono (o texto "sábado" some). A onda 3 (menores e saúde) é onde o custo de errar é alto; por isso ela só entra se pedirem.

## 8. (d) Roteiro enxuto de 3 ondas

### Onda 1: agora, sem custo, sem dado novo (cerca de 1 semana)

| Item | Por quê | Esforço |
| ---- | ------- | ------- |
| Trocar "último sábado", "próximo sábado" por "último encontro", "próximo encontro" | Classe de domingo ou quarta lê o texto errado | Pequeno |
| Modelos embutidos: Aula, Reunião de grupo, Ensaio, Retiro de um dia (um por dia), Célula | `programacao.ts` é código puro, sem migração | Pequeno |
| Lista sugerida de funções para serviço (Recepção, Mídia, Som, Cozinha, Apoio) | Convocar sem digitar | Pequeno |
| Ensaio sem exigir etapa chamada "Louvor" nas telas de banda | Tirar a amarra por nome | Pequeno a médio (**não verificado**) |
| Guia "Como usar em cada grupo" na Ajuda: classe, banda, célula, evento externo, retiro curto, clube só com adultos | O dono ou o líder descobre o caminho sem código | Pequeno |
| Texto de limites escrito: "menor de 16 não tem conta; pais e diretoria sim; ficha médica e autorização ficam fora do app" | Evita a pergunta voltar todo mês e o risco jurídico | Pequeno |
| Verificar as comunidades que o dono criar (retira rodinhas) | Sem isso, evento público e mais de 30 pessoas ficam travados | Ação do dono |
| Teste de 15 minutos com 3 pessoas de mais de 60 anos | A promessa de "fácil" ainda não foi provada em aparelho | Pequeno |

### Onda 2: depois, só com um grupo real como piloto (2 a 4 semanas)

| Item | Gatilho para fazer | Esforço |
| ---- | ------------------ | ------- |
| Inscrição manual pela organização (para quem não usa app, por telefone) | Um idoso ou grupo precisa de ajuda para se inscrever | Médio (rota nova, teste de isolamento) |
| Encontro de vários dias (duração maior e roteiro agrupado por dia) | Um acampamento real marcado | Médio |
| "Minha semana": agenda reunindo as comunidades da pessoa, **no aparelho** | Alguém está em 3 ou mais comunidades | Médio |
| "Modelo de uso" da comunidade (seção 4) | Dois tipos de grupo usando de verdade | Médio |
| Frequência por pessoa ao longo do tempo (só para a organização) | Professora ou líder pediu | Médio |
| Aniversário opcional (dia e mês, sem ano, só adultos, só quem informar) | Classe ou célula pediu | Médio |
| Marca "pagamento conferido" por inscrição, sem valor e sem integração | Acampamento com tesouraria manual pediu | Pequeno a médio |

### Onda 3: só se pedirem, com decisão jurídica antes (não começar)

| Item | Condição |
| ---- | -------- |
| Cadastro de menor de 16 como pessoa (roster da unidade) | Revisão jurídica concluída (PH-11, itens 1 a 5) e mudança da política e da classificação das lojas |
| Ficha médica e alergia (cifrada como o pedido de oração, acesso mínimo, expurgo após o evento) | Base legal, encarregado e retenção definidos; só para o evento e só para a equipe de saúde |
| Autorização dos pais em formato digital | Parecer sobre viagem de menor (ECA arts. 83 e 84) |
| Grupos do evento (quartos, equipes) | Acampamento grande pediu e não cabe em texto |

### Lista do que NÃO será feito (e o motivo)

Pagamento dentro do app (R$ 0 e risco); chat e mensagem direta (privacidade e menores); conta de menor de 16 (política e lojas); classes e especialidades de clube (é de outro sistema); ranking e gamificação (pressão social); caronas e clima como módulo (texto resolve); visão da igreja que cruza comunidades no servidor (quebra o isolamento); papéis e permissões configuráveis (quebra a matriz); versão separada para idosos (dois produtos).

## 9. Três perguntas ao dono que realmente mudam o plano

1. **Quem é o público do app daqui a seis meses: a igreja toda, em todas as idades (e então a marca B e o texto da loja mudam), ou jovens e adultos que servem, com os outros grupos como convidados (e então fica a marca A)?** Isso decide marca, vocabulário e o que a loja diz.
2. **Menores de 16: o app terá só pais e diretoria como contas (recomendado, sem mudança), ou você quer o cadastro dos menores dentro do app?** O segundo caminho exige revisão jurídica (PH-11), ficha com dado de saúde, consentimento dos pais e muda a classificação nas lojas; é o único item deste documento que pode custar dinheiro ou parar uma publicação.
3. **Existe um grupo real e uma data (um acampamento, um retiro, o clube, uma classe) em que o app seja usado como piloto neste semestre? Qual, quantas pessoas e quem lidera?** Sem isso, a onda 2 é suposição; com isso, ela vira o pedido do líder.

## 10. Honestidade final: o que o app NÃO serve hoje

- Não serve para **crianças e adolescentes menores de 16 como pessoas dentro do app**.
- Não serve para **acampamento de vários dias como um evento só** (24 horas é o máximo) nem para **quartos, cardápio por pessoa, saúde, alergia e pagamento**.
- Não serve para **autorização de pais** como documento.
- Não serve para **acompanhar progresso** (classe de clube, especialidade, trilha de leitura).
- Não serve para **visão única de várias comunidades** nem para um "painel do pastor".
- Não serve para **aniversariantes** nem para **frequência por pessoa** hoje.
- Não serve para a **organização inscrever alguém por telefone**.
- A **facilidade para idosos** ainda não foi provada em aparelho real.
- Nada deste documento foi publicado ou testado com um segundo grupo: o que é "serve" é conferido pelo **código e pelos testes**, não por uso real fora do círculo do dono.

## Arquivos consultados

`CLAUDE.md`, `docs/STATUS.md`, `docs/DECISOES.md` (D4, D5, D25, D27, D57), `docs/rastreabilidade.md`, `docs/matriz-permissoes.md`, `docs/produto/modo-musico.md`, `docs/design/app-v3-ux.md`, `docs/marca/leia-me.md`, `docs/privacidade/politica-de-privacidade.md`, `docs/lojas/metadados.md`, `packages/dominio/src/{papeis,permissoes,politicas,produto,programacao,banda}.ts`, `apps/api/migracoes/{0001,0003,0004,0005,0008,0009,0021,0022,0025}`, `apps/api/src/rotas/{inscricoes,relatorios}.ts`, `apps/api/src/publico/rotas.ts`, `apps/app/src/utilidades/mapas.ts`.
