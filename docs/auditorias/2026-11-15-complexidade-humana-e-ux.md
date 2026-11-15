# Auditoria de complexidade humana e UX do Uni Jovem

Data: 15/11/2026. Branch `release`, depois do commit `09d5f3b`.

## Como esta auditoria foi feita (e o que ficou de fora)

- **Base de evidência:**
  - os 5 prints do iPhone do dono (13 a 17);
  - as 10 capturas de loja em `docs/lojas/capturas/cru/apple-6.3/` (390 pt de largura lógica);
  - a leitura do código de cada tela das 11 tarefas, em `apps/app/src/funcionalidades/` e em `apps/api/src/publico/rotas.ts` (página pública).
- **O que não foi feito:** nesta sessão de agente não havia ferramenta de terminal, então não deu para rodar o Playwright contra a prévia em `http://localhost:8090/app`. Por isso:
  - a pasta `docs/auditorias/2026-11-15-capturas/` não foi criada;
  - 360×640, zoom de 150% e 200% e fonte grande foram avaliados **pelo código** (regras de `fontScale`, tetos de escala em `packages/tokens/src/index.ts`), sem captura;
  - Excluir conta, Trocar de comunidade e a página pública não têm captura.
  - Item 1 da seção 6: rodar essas capturas antes da rodada com testadores.
- **Como contei os toques:** um toque é uma ação física (tocar, marcar, escolher). Digitar um campo conta como "1 campo", à parte. Trocar de app (ir ao e-mail e voltar) conta como uma "troca de app".
- **Tempo estimado:** modelo de digitação e decisão (KLM simplificado). O primeiro número é o de um jovem de 16 a 30 anos acostumado a apps; o segundo, o de um adulto de 55 a 70 anos que não é nativo digital, com 2 a 2,5 vezes mais tempo de leitura, digitação e procura.
- **Gravidade:**
  - **crítico:** a pessoa não conclui ou conclui errado sem perceber;
  - **alto:** conclui, mas trava ou pede ajuda;
  - **médio:** atrito e hesitação;
  - **baixo:** acabamento.

---

## 1. Resumo executivo

**Nota de facilidade de uso: 6 de 10.** Para pessoas mais velhas, **5 de 10**.

| Público                             | Nota | Por quê, em uma linha                                                                                                                        |
| ----------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Jovens de 16 a 30                   | 7,5  | Início resolve o principal com 1 toque. O cadastro é longo e jurídico.                                                                       |
| Líderes de 40 a 70 que organizam    | 5    | As tarefas do sábado (check-in, conduzir, escalas) ficam atrás de "…" e de ícones sem texto. As palavras se repetem com sentidos diferentes. |
| Pais na página pública de inscrição | 5    | O formulário é simples, mas "Seu nome" é ambíguo, dois filhos com o mesmo WhatsApp não entram, e o QR aparece uma vez só.                    |

**O que puxa a nota para cima** (é muito mais do que a maioria dos apps de igreja oferece):

- rótulo visível em todo campo;
- botão desabilitado sempre com o motivo escrito embaixo (prints 15 e 16);
- confirmação nativa em toda ação destrutiva;
- "Desfazer" no check-in;
- estados vazios com ação;
- erros em linguagem humana;
- adaptação real à fonte grande: os botões empilham, a agenda vira lista e o ao vivo empilha os cronômetros;
- barra de abas com texto e ícone.

O Início mostra o próximo encontro e a escala, e "Confirmar" está a 1 toque.

**O que puxa a nota para baixo:** os problemas não estão na tela isolada, e sim na **arquitetura da informação** e nas **palavras**.

1. **Tarefas centrais sem casa fixa:**
   - "Minhas escalas" e "Disponibilidade" só se alcançam por um cartão do Início que aparece só quando há escala. No código, `/escalas` só é chamado de `inicio/TelaInicio.tsx` e `inicio/CartaoSuaEscala.tsx`.
   - O check-in só existe dentro de "Mais ações" (um "…" sem texto) no detalhe do evento.
2. **A mesma palavra com sentidos diferentes:**
   - "Equipe" quer dizer:
     - a aba com todas as pessoas;
     - "Aberto à equipe" (qualquer pessoa da comunidade);
     - "Equipe de oração" (um grupo pequeno);
     - o segmento "Equipe" do evento (quem serve naquele dia).
   - "Etapas" quer dizer as partes da programação e também a "verificação em duas etapas".
3. **Ícones sozinhos onde a ação importa:**
   - "+" em Programas, Oração e Avisos;
   - "…" na barra do evento e no cartão da escala;
   - "Voltar etapa" e "Pausar" no ao vivo.
4. **Texto pequeno onde está a informação útil:**
   - data e hora da escala, meta do evento e rótulo de campo em 13 pt (`legenda` e `rotulo`), cor suave sobre fundo escuro;
   - cabeçalhos de seção em 12 pt maiúsculo;
   - rótulo da aba em 11 pt com teto de escala 1,3.
5. **Primeiro acesso pesado:**
   - 3 passos, código por e-mail com troca de app, senha de 10 caracteres digitada duas vezes;
   - dois blocos jurídicos, um de cerca de 70 palavras;
   - pergunta de idade e confirmação do responsável repetidas.
6. **Página pública com dois defeitos para pais:**
   - uma inscrição por WhatsApp por evento: o segundo filho é descartado em silêncio;
   - o código de entrada e o link de cancelamento aparecem uma vez só, e nada é enviado por e-mail.

**Recomendação:** antes de qualquer testador, fazer as 10 correções da seção 6 (a maioria é P). Depois, 5 sessões de 20 minutos com líderes de 50 anos ou mais, nas tarefas 2, 4, 6 e 7 e na página pública. Isso pega mais do que qualquer revisão adicional, inclusive esta.

---

## 2. Por tarefa

### Tarefa 1. Primeiro acesso por convite (link no WhatsApp) e entrada

- **Caminho (sem conta), em `convite/CadastroPorConvite.tsx`:**
  1. Toca o link no WhatsApp: abre o app ou a web em "Passo 1 de 3: Seus dados", com o cartão "Você foi convidado para…".
  2. Preenche Nome, WhatsApp (opcional) e E-mail.
  3. Responde "Quantos anos você tem?" e marca os Termos.
  4. Toca "Enviar código".
  5. Sai para o e-mail, acha a mensagem (pode estar no spam) e volta.
  6. Digita o código e toca "Continuar".
  7. Cria a senha e a repete.
  8. Marca "Sobre a sua fé" (e o responsável, se tiver 16 ou 17).
  9. Toca "Criar conta e entrar".
- **Toques:** cerca de 12, mais 5 campos e 1 troca de app.
- **Decisões:** 4 (WhatsApp opcional, idade, termos, fé).
- **Tempo:** 3 a 4 min para um jovem; **7 a 10 min** para alguém de 60 anos.
- **Obstáculos:**
  - **Código por e-mail com troca de app:** para quem não usa e-mail no celular, é o ponto de abandono. O texto pede "Olhe a caixa de spam", mas não há atalho para abrir o e-mail.
  - **Erro de código tardio:** o código só é validado no passo 3 (`concluir`). Quem erra o código digita a senha duas vezes e depois volta para o passo 2.
  - **Senha de 10 caracteres digitada duas vezes**, com a lista de regras acima (`RegrasDaSenha`).
  - **Termos no passo 1 e fé no passo 3:** duas paradas jurídicas. O bloco da fé (print 15) tem cerca de 70 palavras, com "dado sensível" e "tratem meus dados".
  - **Idade repetida:** a opção de 16 ou 17 anos já diz "meu responsável sabe e concorda", e no passo 3 aparece outra caixa dizendo a mesma coisa (print 14).
  - **Com conta já aberta (`AceitarComConta`):**
    - a caixa do responsável só aparece depois que a API recusa o primeiro toque em "Entrar na comunidade" (`PEDE_RESPONSAVEL`), então a pessoa toca duas vezes sem entender por quê;
    - "Agora não" descarta o convite guardado.
- **Gravidade:** **alto.**
- **Captura:** prints 14 e 15 (variante com conta).

### Tarefa 2. Ver o que tenho no sábado e confirmar a minha escala

- **Caminho:** abrir o app. O Início mostra o "Próximo encontro" (cartão claro) e "Sua escala" com "Confirmar" e "Pedir substituição".
- **Toques:** **1.**
- **Tempo:** 10 s para um jovem; 30 a 45 s para alguém de 60 anos.
- **Obstáculos:**
  - O cartão de escala mostra a **próxima escala**, que pode ser de outro evento. Na captura, o destaque é o Sábado Jovem de 21/11 e logo abaixo vem "Coordenação · Retiro de Verão · Sábado, 19/12". Quem lê rápido acha que está escalado no sábado.
  - A data da escala está em `legenda` 13 pt, cor suave: a informação mais importante do cartão é a menor.
  - Depois de confirmar, não há toast. O chip "Confirmada" aparece e o botão some. Para quem não percebeu a troca, parece que nada aconteceu.
  - Confirmar não tem desfazer: o caminho de volta é "Pedir substituição" ou "Não posso ir", escondido no "…" da tela Escalas.
- **Gravidade:** baixo.
- **Captura:** `docs/lojas/capturas/cru/apple-6.3/01-inicio.png`.

### Tarefa 3. Pedir substituição

- **Caminho:**
  1. Início, "Pedir substituição".
  2. Tela com "Aberto à equipe" já marcado e o motivo opcional.
  3. "Pedir substituição".
- **Toques:** **2** (mais 1 campo opcional).
- **Tempo:** 20 s para um jovem; 1 a 2 min para alguém de 60 anos.
- **Obstáculos:**
  - **"Aberto à equipe"** quer dizer "qualquer pessoa da comunidade pode assumir" (a descrição diz isso). Mas "equipe" no app também é o grupo de quem serve e a equipe de oração.
  - **Sem retorno de sucesso:** `TelaPedirSubstituicao.tsx` faz `router.back()` e não mostra nenhuma mensagem.
  - **Chip ambíguo:** o resultado é o chip "Substituição", que pode ser lido como "sou substituto".
  - **Escala fora do Início:** se a escala não for a primeira, é preciso achar "Ver todas (N)". Fora do Início, **não existe entrada fixa para Escalas** em nenhuma aba nem no Perfil.
  - **Etapa e função misturadas:** na lista de pedidos (captura 04), "Sábado Jovem · Louvor" e "pediu à equipe · Projeção" juntam etapa e função sem dizer qual é qual.
- **Gravidade:** **médio** (alto para a descoberta de Escalas fora do Início).
- **Captura:** `01-inicio.png`, `04-escalas.png`.

### Tarefa 4. Criar a programação de um Sábado Jovem a partir do modelo e publicar

- **Caminho pelo Programas:**
  1. Aba Programas.
  2. "+" (só ícone, no canto do título).
  3. Folha "Nova programação", "Sábado padrão (Recomendado)".
  4. Formulário já preenchido: título "Sábado", próximo sábado às 16:00.
  5. Corrige o título para "Sábado Jovem" e escolhe o local (o padrão é "A definir").
  6. "Publicar".
- **Toques:** **5**, mais 1 campo. Escalar as pessoas é outro fluxo: segmento Etapas, cada etapa, "Escalar pessoa".
- **Tempo:** 1 min para um jovem; 3 a 5 min para alguém de 60 anos (o formulário tem 6 seções mais "Repetir").
- **Obstáculos:**
  - **O "+" sem texto** é a única porta. Na Agenda, quem toca num sábado e em **"Nova programação neste dia"** cai num formulário **em branco, sem o modelo** (`agenda/ListaDoDia.tsx:144` passa só a data). É o caminho mais natural para quem pensa em calendário, e ele gera uma programação sem etapas.
  - **O modelo nunca aparece:** a pessoa publica sem ver as etapas que vêm junto.
  - **"Publicar" inconsistente:** no formulário, publica sem confirmação. No detalhe do evento, o mesmo verbo pede confirmação.
  - **Jargão na mesma tela:** "Categoria", "Quem vê: Interna ou Pública", "Lista de espera", "Repetição", "Série". O formulário inteiro aparece mesmo para o Sábado padrão, quando só data, hora e local mudam.
  - **Duas abas para os mesmos eventos:** Agenda (calendário) e Programas (lista). Para quem não é nativo digital, "onde está o sábado?" tem duas respostas. "Programas" também soa como programa de TV; o termo de igreja é "programação".
- **Gravidade:** **alto.**
- **Captura:** `02-programacao.png` (detalhe) e print 13 (Agenda com "Nova programação neste dia").

### Tarefa 5. Conduzir o ao vivo

- **Caminho no dia:**
  1. Início, Agenda ou Programas, e o evento.
  2. Primário "Abrir ao vivo", ou o cartão de destaque "AO VIVO".
  3. "Iniciar".
  4. "Avançar etapa" a cada etapa.
- **Toques:** **3 a 4** para começar, mais 1 por etapa.
- **Tempo:** 15 s para um jovem; 45 s para alguém de 60 anos.
- **Obstáculos:**
  - **Ícones sem texto:** "Voltar etapa" e "Pausar" são botões de 56 só com ícone (`|◁` e `▮▮`). Quem não conhece o símbolo pode confundir "voltar etapa" com "voltar de tela".
  - **Rótulo errado no Início:** o cartão do próximo encontro chama de "Acompanhar ao vivo" também quem vai conduzir.
  - **Fora do dia:** a entrada fica numa linha da Visão geral e no "…".
  - **Bom:** botões de 56, tela acesa, confirmação para encerrar, "Voltar etapa" funciona como desfazer, chip de conexão com texto.
- **Gravidade:** baixo.
- **Captura:** `03-ao-vivo.png`.

### Tarefa 6. Fazer check-in de quem chegou (pelo nome)

- **Caminho:**
  1. Programas e o evento.
  2. **"…" (Mais ações)**.
  3. "Check-in de presença".
  4. Digita o nome em "Buscar pelo nome".
  5. "Marcar".
- **Caminho alternativo:** Visão geral, linha "Inscrições", "Fazer check-in".
- **Toques:** **4**, mais 1 campo por pessoa.
- **Tempo:** 30 s para a primeira pessoa e 8 s para as seguintes (jovem); 2 min e 20 s (60 anos).
- **Obstáculos:**
  - **Escondido:** a ação central do sábado está no "…", sem rótulo visível (`BarraDoEvento.tsx:203-208`). No dia, o destaque do evento é o ao vivo, e nada na tela diz "check-in".
  - **Verbo vago:** "Marcar" não diz o quê.
  - **Desfazer some rápido:** o toast com "Desfazer" fica 4 s (`ui/Toast.tsx:65-68`), pouco para quem lê devagar com fila na porta. Existe o caminho pela folha da pessoa, mas ninguém sabe que existe.
  - **Ruído:** "Membro sem inscrição" repetido em toda linha.
- **Gravidade:** **alto** (pela descoberta).
- **Captura:** `05-presenca.png`, `02-programacao.png` (o "…" no canto inferior esquerdo).

### Tarefa 7. Fazer um pedido de oração só para a equipe

- **Caminho:**
  1. Aba **Perfil**.
  2. Rolar até "Na comunidade" e tocar "Oração".
  3. "+" (só ícone).
  4. Escrever o pedido.
  5. Escolher "Equipe de oração".
  6. "Publicar pedido".
  7. Confirmar.
- **Toques:** **6**, mais 1 campo.
- **Tempo:** 1 min para um jovem; 3 min para alguém de 60 anos.
- **Obstáculos:**
  - **Lugar inesperado:** oração é coisa da comunidade, não do "eu", e mora no Perfil (print 17). Ninguém procura ali na primeira vez.
  - **"Só para a equipe" não é uma opção.** As opções são "Somente eu", "Equipe de oração" e "Comunidade". A descrição honesta "Hoje, ninguém além de você" (captura 06) salva o caso de equipe vazia, mas quem queria "a liderança" não acha.
  - **Aviso de privacidade técnico:** "guardado cifrado, mas não é criptografia de ponta a ponta: quem administra o servidor tem capacidade técnica de ler". A verdade precisa ficar, mas em palavras comuns.
  - **"+" sem texto** para criar.
- **Gravidade:** **médio.**
- **Captura:** `06-novo-pedido.png`, print 17.

### Tarefa 8. Convidar alguém como organizador

- **Caminho:**
  1. Aba Equipe e "Criar convite" (cartão de destaque).
  2. Escolher "Organizador".
  3. "Criar convite".
  4. "Compartilhar", depois WhatsApp e o contato.
- **Toques:** **6 a 7.**
- **Tempo:** 40 s para um jovem; 2 min para alguém de 60 anos.
- **Obstáculos:**
  - "Membro" vem marcado: quem não lê convida com o papel errado. Mudar depois tem caminho (detalhe da pessoa), então o risco é baixo.
  - "Papel" é jargão, mas as descrições de cada papel são claras (captura 10).
- **Gravidade:** baixo.
- **Captura:** `08-equipe.png`, `10-convidar.png`.

### Tarefa 9. Trocar de comunidade

- **Caminho:**
  1. Tocar a pílula com o nome da comunidade.
  2. Escolher na folha.
  3. Toast "Agora em…".
- **Caminho alternativo:** Perfil, "Comunidades".
- **Toques:** **2.**
- **Tempo:** 10 s para um jovem; 40 s para alguém de 60 anos.
- **Obstáculos:**
  - A pílula não parece botão: o chevron é de 16 pt e só aparece com mais de uma comunidade.
  - Para quem não sabe que ela é tocável, o caminho real é o Perfil, rolando.
- **Gravidade:** baixo.
- **Captura:** `07-agenda.png` (pílula no topo).

### Tarefa 10. Achar como excluir a conta

- **Caminho:**
  1. Perfil e rolar até "Ajuda e privacidade".
  2. "Privacidade e dados" ("Exportar dados ou excluir a conta").
  3. "Excluir minha conta".
  4. Digitar a senha.
  5. "Excluir minha conta" e confirmar.
- **Toques:** **5**, mais 1 campo.
- **Tempo:** 1 min para um jovem; 3 min para alguém de 60 anos.
- **Obstáculos:**
  - Quem entrou com Google ou Apple e nunca criou senha pode travar no campo "Senha". **Não verificado:** conferir na API.
  - O resto está bom: consequências em lista, "baixe uma cópia antes", destrutivo cheio e confirmação nativa.
- **Gravidade:** baixo (médio, se o caso de quem não tem senha se confirmar).
- **Captura:** nenhuma (sem Playwright nesta sessão).

### Tarefa 11. Página pública de inscrição, como um pai ou uma mãe pelo celular

- **Caminho, em `apps/api/src/publico/rotas.ts`:**
  1. Abre o link.
  2. Lê os detalhes.
  3. Preenche "Seu nome" e "WhatsApp" (e o e-mail opcional).
  4. Marca 2 caixas.
  5. "Confirmar inscrição".
  6. Tela com QR e código.
- **Toques:** **4**, mais 2 ou 3 campos.
- **Tempo:** 1 min para um jovem; 3 min para alguém de 60 anos.
- **Obstáculos:**
  - **"Seu nome"** quando quem preenche é a mãe inscrevendo o filho: qual nome vai? A segunda caixa fala de "a pessoa inscrita", mas o rótulo diz "seu".
  - **Segundo filho descartado em silêncio:** uma inscrição ativa por WhatsApp por evento (`0015_correcoes_de_seguranca.sql:167`). A mãe que inscreve o segundo filho com o mesmo WhatsApp vê "Recebemos sua inscrição" e o texto "Se este WhatsApp já tinha inscrição, ela continua valendo". **O segundo filho não está inscrito, e ela não sabe.**
  - **QR que some:** o QR e o link de cancelamento aparecem **uma vez só** ("Ele não aparece de novo"). Nada é enviado por e-mail nem por WhatsApp (a rota não envia nada). Quem fecha a aba perde o QR da entrada.
  - **Consentimento longo:** cerca de 60 palavras.
  - **Formulário bom no resto:** rótulos visíveis, campos de 48 px, valores preservados no erro e mensagens claras.
- **Gravidade:** **crítico.**
- **Captura:** nenhuma (sem Playwright nesta sessão).

### Quadro resumo

| #   | Tarefa                        | Toques         | Jovem   | 60 anos  | Gravidade |
| --- | ----------------------------- | -------------- | ------- | -------- | --------- |
| 1   | Primeiro acesso por convite   | 12 + 5 campos  | 3-4 min | 7-10 min | Alto      |
| 2   | Ver o sábado e confirmar      | 1              | 10 s    | 30-45 s  | Baixo     |
| 3   | Pedir substituição            | 2              | 20 s    | 1-2 min  | Médio     |
| 4   | Criar Sábado Jovem e publicar | 5 + 1 campo    | 1 min   | 3-5 min  | Alto      |
| 5   | Conduzir o ao vivo            | 3-4            | 15 s    | 45 s     | Baixo     |
| 6   | Check-in pelo nome            | 4 + 1 campo    | 30 s    | 2 min    | Alto      |
| 7   | Oração só para a equipe       | 6 + 1 campo    | 1 min   | 3 min    | Médio     |
| 8   | Convidar organizador          | 6-7            | 40 s    | 2 min    | Baixo     |
| 9   | Trocar de comunidade          | 2              | 10 s    | 40 s     | Baixo     |
| 10  | Excluir a conta               | 5 + senha      | 1 min   | 3 min    | Baixo     |
| 11  | Página pública (pais)         | 4 + 2-3 campos | 1 min   | 3 min    | Crítico   |

---

## 3. Lista priorizada de problemas

Esforço: **P** (horas, só texto ou rota), **M** (1 a 2 dias), **G** (mais de 2 dias ou decisão do dono).

### Críticos

| ID   | Onde                                                 | Por que atrapalha                                                                                     | Proposta                                                                                                                                                                                       | Esforço                |
| ---- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| U-01 | Página pública, `rotas.ts:155` e `inscrever_publico` | Pai ou mãe com dois filhos: o segundo é descartado com mensagem de sucesso.                           | Rótulo "Nome de quem vai participar". Chave de repetição por WhatsApp **e** nome normalizado. Na tela de sucesso, o botão "Inscrever outra pessoa com o mesmo contato".                        | M                      |
| U-02 | Página pública, tela de sucesso (`rotas.ts:345-365`) | O QR e o link de cancelamento aparecem uma vez só e nada é enviado. Quem fecha a aba perde a entrada. | Texto em destaque "Tire um print desta tela: é o seu ingresso". Se houver e-mail, enviar o código e o link. O botão "Mandar para o meu WhatsApp" (`wa.me` com o próprio texto) não custa nada. | P (texto) / M (e-mail) |

### Altos

| ID   | Onde                                                                                   | Por que atrapalha                                                                                                                                | Proposta                                                                                                                                                                                                                                                                      | Esforço |
| ---- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| U-03 | Navegação: `/escalas` só se abre pelo Início                                           | "Minhas escalas" e "Disponibilidade" não têm casa. Sem escala no momento, não há como informar a disponibilidade, a não ser no Início vazio.     | Linha "Minhas escalas e disponibilidade" no topo do Perfil (grupo próprio "Você na comunidade") e atalho "Minhas escalas" na Agenda.                                                                                                                                          | P       |
| U-04 | Detalhe do evento, `BarraDoEvento.tsx:197-208`                                         | Check-in e Inscrições só dentro do "…". É a tarefa do sábado na porta.                                                                           | No dia do evento, para quem registra presença: barra com "Check-in" (secundário) e "Abrir ao vivo" (primário). Linha "Check-in" na Visão geral, ao lado de "Inscrições".                                                                                                      | P       |
| U-05 | "…" sem texto: `BarraDoEvento.tsx:303`, `CartaoDaEscala.tsx:142`, `TelaAoVivo.tsx:264` | Pessoas mais velhas não leem "…" como menu. "Não posso ir" e "Cancelar evento" ficam invisíveis.                                                 | Botão com texto "Mais" e ícone. Na escala, "Não posso ir" como terciário visível.                                                                                                                                                                                             | P       |
| U-06 | "+" sem texto: `TelaProgramacoes.tsx:250`, `TelaOracao.tsx:35`, Avisos                 | Criar é a ação principal dessas telas, e o único sinal é um "+" de 44 no canto.                                                                  | Botão com texto ("Nova", "Novo pedido", "Novo aviso"). Na lista vazia já existe; falta na lista cheia.                                                                                                                                                                        | P       |
| U-07 | Agenda, "Nova programação neste dia" (`agenda/ListaDoDia.tsx:144`)                     | Num sábado, cria uma programação em branco, sem as etapas do Sábado padrão.                                                                      | Abrir a mesma folha do Programas ("Sábado padrão" recomendado, "Em branco", "A partir de um modelo") com a data já escolhida.                                                                                                                                                 | P       |
| U-08 | Palavras sobrecarregadas                                                               | "Equipe" em 4 sentidos; "etapas" em 2. A pessoa lê "Aberto à equipe" e não sabe quem vê.                                                         | "Aberto à equipe" vira "Qualquer pessoa da comunidade". O segmento "Equipe" do evento vira "Quem serve". O segmento "Etapas" vira "Programação" (como a especificação 3.4.2 já dizia). A 2FA vira "Código extra ao entrar". O chip "Substituição" vira "Substituição pedida". | P       |
| U-09 | Tipografia, `packages/tokens/src/index.ts:201-224`                                     | A informação útil está em 13 pt suave: data da escala, meta do evento, rótulo de campo. Cabeçalhos em 12 maiúsculo. A aba em 11 com teto de 1,3. | Mínimo de 15 para texto que informa (data, hora, local, rótulo de campo). `legenda` só para o que é dispensável. Aba com teto de 1,6. Sobrancelha em 13. Medir de novo em 360 pt.                                                                                             | M       |
| U-10 | Primeiro acesso, `CadastroPorConvite.tsx`                                              | 3 passos, troca de app, senha duas vezes, dois blocos jurídicos, idade repetida. Erro de código descoberto só no passo 3.                        | Validar o código no passo 2. Um só campo de senha, com "Mostrar". Termos e fé juntos no fim, com o texto da fé encurtado e "Saiba mais" para o resto. Tirar a frase do responsável da opção de idade (fica só a caixa). Botão "Abrir meu e-mail".                             | M       |
| U-11 | Oração dentro do Perfil (`navegacao/mais.ts:41`)                                       | Perfil é "eu". Oração, Avisos, Sugestões e Conteúdos são da comunidade. Ninguém procura ali.                                                     | Grupo "Na comunidade" na aba Equipe (renomeada para "Comunidade"?), com atalho no Início para Avisos e Oração. Decisão de IA: pedir ao dono.                                                                                                                                  | M       |

### Médios

| ID   | Onde                                                  | Por que atrapalha                                                                                                                                  | Proposta                                                                                                                                   | Esforço              |
| ---- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| U-12 | Pedir substituição, `TelaPedirSubstituicao.tsx:69-72` | Volta sem dizer nada: a pessoa não sabe se foi.                                                                                                    | Toast "Pedido enviado. Você continua escalado até alguém assumir."                                                                         | P                    |
| U-13 | Toast com ação, `ui/Toast.tsx:65`                     | "Desfazer" some em 4 s.                                                                                                                            | Toast com ação fica 10 s ou até ser dispensado (WCAG 2.2.1).                                                                               | P                    |
| U-14 | Início, "Sua escala"                                  | A escala de outro evento aparece logo abaixo do destaque do sábado e parece ser do sábado.                                                         | Nome do evento como primeira linha do cartão, em `tituloItem`, ou priorizar a escala do evento em destaque.                                | P                    |
| U-15 | Agenda e Programas, duas abas                         | Os mesmos eventos em dois lugares; "Programas" soa como TV.                                                                                        | Renomear para "Programação". A médio prazo, juntar numa aba com Calendário e Lista.                                                        | P (nome) / G (fusão) |
| U-16 | Formulário de programação                             | O Sábado padrão mostra as 6 seções mais "Repetir"; o modelo não mostra as etapas; "Publicar" sem confirmação.                                      | Para o modelo: mostrar só Data, Hora e Local, mais "Mais opções". Prévia das etapas do modelo. A mesma confirmação de publicar do detalhe. | M                    |
| U-17 | Oração, aviso de privacidade (`TelaNovoPedido.tsx`)   | "cifrado", "criptografia de ponta a ponta" e "capacidade técnica".                                                                                 | "Só quem você escolher vê na tela. Quem cuida do servidor consegue ler, se precisar. Por isso, evite nomes e doenças de outras pessoas."   | P                    |
| U-18 | Segmentos com fonte grande (`ui/Segmentos.tsx:121`)   | A partir de 1,35, os segmentos viram pílulas roláveis na horizontal: a opção da direita ("Preparação") fica fora da tela, alcançável só por gesto. | Com fonte grande, quebrar em 2 linhas de largura igual, ou virar lista de opções vertical.                                                 | M                    |
| U-19 | Editar perfil, print 16                               | "Escolher da galeria" vaza pela borda do botão em 390 pt (em 360, pior).                                                                           | Rótulo "Galeria" e "Câmera", ou botões empilhados.                                                                                         | P                    |
| U-20 | Ao vivo, `TelaAoVivo.tsx:292-330`                     | "Voltar etapa" e "Pausar" só com ícone.                                                                                                            | Rótulo de 13 abaixo do ícone (o botão já tem 56).                                                                                          | P                    |
| U-21 | Convite com conta, `AceitarComConta.tsx`              | A caixa do responsável só aparece depois de a API recusar o primeiro toque.                                                                        | Pedir já de saída quando a conta tem faixa 16 ou 17 (a API já sabe).                                                                       | P                    |

### Baixos

| ID   | Onde                                               | Proposta                                                                                                                                 | Esforço |
| ---- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| U-22 | Check-in: "Marcar"                                 | "Marcar presença" (o rótulo acessível já diz isso, falta o visível). Tirar o "Membro sem inscrição" repetido; mostrar só a exceção.      | P       |
| U-23 | Início: "Acompanhar ao vivo" para quem conduz      | "Conduzir ao vivo" quando a pessoa pode conduzir.                                                                                        | P       |
| U-24 | Pílula da comunidade                               | Chevron de 20 sempre visível, e "Trocar" no rótulo acessível e visual quando há mais de uma.                                             | P       |
| U-25 | Segmentos com 36 de altura dentro de trilho de 44  | Toque em toda a altura do trilho (CLAUDE.md §7, 44 pt).                                                                                  | P       |
| U-26 | Barra do convite com motivo (print 15)             | Com o motivo embaixo do primário, "Agora não" desce e as bases se desalinham. Motivo numa linha própria acima da barra.                  | P       |
| U-27 | "Sincronizado 14:32" no topo                       | Para quem não sabe o que é sincronizar, isso não diz nada. "Tudo salvo · 14:32", ou só o ícone de check com o texto no rótulo acessível. | P       |
| U-28 | Excluir conta para quem entrou com Google ou Apple | Conferir se existe senha. Se não existir, pedir o código por e-mail no lugar da senha.                                                   | M       |

---

## 4. Heurísticas de Nielsen (o que falha)

| Heurística                        | Situação  | Onde falha                                                                                                               |
| --------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1. Visibilidade do estado         | Boa       | Falta retorno ao pedir substituição (U-12) e ao confirmar a escala (só o chip troca).                                    |
| 2. Linguagem do usuário           | **Fraca** | Equipe e etapas sobrecarregadas (U-08); "Programas"; "Sincronizado"; "cifrado"; "papel"; "série"; "modelo"; "categoria". |
| 3. Controle e liberdade           | Boa       | Check-in tem desfazer; ao vivo tem voltar etapa. Confirmar escala não tem desfazer; "Agora não" descarta o convite.      |
| 4. Consistência                   | Média     | "Publicar" com e sem confirmação; "Nova programação" com e sem modelo; "+" ora com texto (estado vazio), ora sem.        |
| 5. Prevenção de erro              | Média     | Página pública aceita o segundo filho e o descarta (U-01); "Membro" pré-marcado no convite.                              |
| 6. Reconhecer em vez de lembrar   | **Fraca** | "…" e "+" sem texto; Escalas sem casa (U-03); Oração no Perfil (U-11).                                                   |
| 7. Flexibilidade e eficiência     | Boa       | Início com ação direta; Sábado padrão pré-preenchido.                                                                    |
| 8. Estética e minimalismo         | Média     | Formulário completo para o modelo (U-16); textos legais longos no cadastro.                                              |
| 9. Reconhecer e recuperar de erro | Boa       | Mensagens humanas, motivo do botão desabilitado, campos preservados. Exceção: o código errado só aparece no passo 3.     |
| 10. Ajuda e documentação          | Média     | Existem "Ajuda e sobre" e o Mapa da missão, mas não há ajuda no contexto das tarefas do sábado.                          |

### Pessoas mais velhas, critério por critério

- **Tamanho de texto:** corpo 15 (o iOS usa 17 por padrão). A informação útil está em 13 suave; sobrancelhas em 12 maiúsculo; aba em 11 (U-09). A fonte do sistema é respeitada, com teto só nos títulos e na aba.
- **Tamanho de alvo:** bom (44 a 56; caixas de marcar com linha de 48). A exceção é o segmento de 36 (U-25).
- **Contraste:** medido no projeto (WCAG AA), mas o texto suave em 13 sobre fundo escuro com Aurora é o par mais frágil na prática. O tema escuro é o único mostrado; testar o claro com o grupo.
- **Rótulos contra ícones sozinhos:** as abas têm texto (bom). Falham "+", "…", "Voltar etapa" e "Pausar" (U-05, U-06, U-20).
- **Gestos escondidos:** nada essencial em gesto, exceto as pílulas roláveis com fonte grande (U-18) e as pílulas de filtro que passam da borda.
- **Jargão:**
  - "escala": entendido em igreja; manter;
  - "série": trocar por "Repetir";
  - "etapa": aceitável dentro da programação, nunca na 2FA;
  - "modelo": aceitável;
  - "papel": trocar por "Função na comunidade";
  - "designação": não aparece na interface (bom).
- **Opções por tela:** Início com no máximo 5 cartões (bom). O formulário de programação tem 6 seções; o Perfil, 6 grupos e 15 linhas.
- **Confirmação de ações perigosas:** completa e com texto específico (bom).
- **Caminho de volta:** botão voltar circular em todas as pilhas (bom). O formulário é modal; conferir se fechar com dados digitados pede confirmação (não verificado).
- **Fonte grande:** botões empilham, agenda vira lista, cronômetros empilham (bom). Os segmentos viram rolagem lateral (U-18).

---

## 5. O que já está bom e deve ficar

1. **Motivo escrito embaixo do botão desabilitado** ("Altere o nome ou o WhatsApp para salvar", "marque a concordância"). É exatamente o que pessoas mais velhas precisam (prints 15 e 16).
2. **Início com ação direta:** próximo encontro em destaque e escala com "Confirmar" a 1 toque. Nada de menu para a tarefa mais comum.
3. **Rótulo visível em todo campo**, com "(opcional)" escrito e exemplo separado do rótulo. Nada de placeholder como rótulo no app. A página pública usa placeholder só como exemplo, com rótulo acima.
4. **Confirmações destrutivas específicas** ("Recusar esta escala? A organização fica sabendo…") e **desfazer no check-in**.
5. **Estados vazios com ação e caminho**: "Novo Sábado padrão", "Limpar filtros", "Ver a agenda".
6. **"Sábado padrão" pré-preenchido** com o próximo sábado às 16:00. É o atalho certo.
7. **Pedido de oração começa em "Somente eu"**, com a quantidade de leitores escrita em cada opção ("14 pessoas além de você").
8. **Convidar** com descrição de cada papel em linguagem comum e a regra do e-mail explicada (captura 10).
9. **Ao vivo** com botões de 56, tela sempre acesa, progresso em texto ("1 de 7 etapas concluídas") e atraso com ícone e texto, não só cor.
10. **Barra de abas com texto**, aba ativa com forma e cor, e **5 abas** (no limite certo).
11. **Adaptação à fonte grande** feita de propósito em botões, agenda, ao vivo e relatórios.
12. **Página pública leve:** HTML puro, sem login, campos de 48, valores preservados no erro, mensagem de erro dizendo como resolver.

---

## 6. As 10 correções de maior retorno (antes de dar o app para testadores)

Em ordem de fazer:

1. **Página pública para pais (U-01, U-02):**
   - rótulo "Nome de quem vai participar";
   - aceitar mais de uma pessoa com o mesmo WhatsApp;
   - na tela de sucesso, "Tire um print: é o seu ingresso", o botão "Mandar para o meu WhatsApp" e "Inscrever outra pessoa".
   - **M.**
2. **Casa fixa para Escalas (U-03):** linha "Minhas escalas e disponibilidade" no topo do Perfil e atalho na Agenda. **P.**
3. **Check-in à vista no dia (U-04):** "Check-in" na barra do evento no dia e na Visão geral. **P.**
4. **Texto nos botões de ícone (U-05, U-06, U-20):** "Mais" no lugar de "…"; "Nova" e "Novo pedido" no lugar de "+"; rótulos sob "Voltar etapa" e "Pausar". **P.**
5. **"Nova programação neste dia" com a folha de modelos (U-07):** o sábado nunca nasce vazio. **P.**
6. **Desambiguar as palavras (U-08):**
   - "Qualquer pessoa da comunidade" no lugar de "Aberto à equipe";
   - "Quem serve" no lugar do segmento "Equipe";
   - "Programação" no lugar do segmento "Etapas";
   - "Código extra ao entrar" no lugar de "duas etapas";
   - "Substituição pedida" no chip.
   - **P.**
7. **Retorno depois de agir (U-12, U-13):** toast ao pedir substituição; toast com "Desfazer" por 10 s. **P.**
8. **Texto útil em 15 pt (U-09):** data, hora, local e rótulo de campo saem da `legenda` 13; aba com teto de 1,6. Recapturar em 360×640 e com 200%. **M.**
9. **Primeiro acesso mais curto (U-10, U-21):**
   - código validado no passo 2;
   - um campo de senha com "Mostrar";
   - termos e fé juntos no fim, com o texto encurtado;
   - responsável perguntado uma vez só.
   - **M.**
10. **Rodar as capturas que esta auditoria não pôde rodar e testar com 5 pessoas:**
    - Playwright em 390×844 e 360×640, zoom de 150% e 200%, como admin, organizador e membro, nas 11 tarefas, salvando em `docs/auditorias/2026-11-15-capturas/`;
    - depois, 5 líderes de 50 anos ou mais, 20 minutos cada, com as tarefas 2, 4, 6 e 7 e a página pública;
    - roteiro: "Mostre como você faria…", sem ajuda, anotando onde a pessoa para.
    - **P.**

A decisão de mover Oração, Avisos, Sugestões e Conteúdos do Perfil para a comunidade (U-11) e a de juntar Agenda e Programas (U-15) mudam a navegação: são do dono. Não entraram nas 10 para não segurar os testadores, mas a sessão com 5 pessoas vai dizer se são urgentes.

---

## Evidências citadas

- **Prints do iPhone do dono:** `C:\Users\Rfasg\AppData\Local\Temp\claude\774b84b711c50422\c28e7a4c-eaac-452c-ae14-e39929828078\images\13.png` a `17.png`. Pasta temporária: copiar para `docs/auditorias/2026-11-15-capturas/` se forem guardados.
  - 13: Agenda;
  - 14 e 15: convite com conta;
  - 16: Dados pessoais;
  - 17: Perfil.
- **Capturas de loja:** `docs/lojas/capturas/cru/apple-6.3/01-inicio.png` a `10-convidar.png`.
- **Código lido:**
  - `funcionalidades/convite/` (CadastroPorConvite, AceitarComConta, Consentimentos);
  - `inicio/` (TelaInicio, CartaoSuaEscala);
  - `escalas/` (CartaoDaEscala, TelaPedirSubstituicao, TelaEscalas);
  - `eventos/` (TelaProgramacoes, TelaNovoEvento, CamposDoEvento, BarraDoEvento, DestaqueDoEvento, VisaoGeralDoEvento);
  - `aoVivo/TelaAoVivo.tsx`;
  - `inscricoes/` (TelaCheckin, TelaInscricoes);
  - `oracao/` (TelaOracao, TelaNovoPedido);
  - `comunidade/` (TelaComunidade, TelaConvidar);
  - `perfil/TelaPerfil.tsx`;
  - `privacidade/TelaExcluirConta.tsx`;
  - `navegacao/` (abas, mais, CabecalhoDaComunidade, BarraDeAbas);
  - `ui/Toast.tsx`, `ui/Segmentos.tsx`;
  - `packages/tokens/src/index.ts`;
  - `apps/api/src/publico/rotas.ts` e `html.ts`;
  - `apps/api/migracoes/0015_correcoes_de_seguranca.sql`.
