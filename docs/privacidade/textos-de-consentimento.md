# Textos de consentimento e avisos de tela

> **Em uso em produção, com revisão jurídica pendente (PH-11).** Versão 0.3 deste arquivo, de 15/11/2026, para o app aberto (ADR 0007).
> **Versões em uso no código em 15/11/2026** (`VERSAO_DO_TEXTO` em `apps/api/src/privacidade/consentimentos.ts`): TC-01, TC-02 e TC-04 na versão 1; TC-03 na versão 2.
> **Versões novas desta revisão, que entram junto com a API da ADR 0007** (o código ainda não as tem): TC-01.v2 (cadastro sem convite, por e-mail, Google ou Apple), TC-02.v2 (aceite dos Termos 0.3 e da Política 0.3), TC-03.v3 (consentimento sobre a fé também ao pedir entrada, ao entrar por código e ao criar comunidade), TC-12.v2 (sair sem precisar de convite para voltar) e os textos novos TC-16 (Termo do Administrador, registrado), TC-17 (pedido de entrada), TC-18 (aparecer na busca), TC-19 (denúncia de comunidade) e TC-20 (código da comunidade). Até a API mudar, valem as versões anteriores, guardadas no histórico de cada texto.
> Textos curtos que aparecem nas telas do app e nas páginas públicas. Cada um tem um identificador com versão (`TC-nn.vN`). Mudou o texto de um consentimento, muda a versão (aqui e em `VERSAO_DO_TEXTO`), e quem aceitou a versão anterior continua registrado com ela.

## Regras que valem para todos

1. **Caixa desmarcada.** Nenhum consentimento vem pré-marcado. O botão de continuar fica desabilitado até marcar, e o motivo aparece em texto (não só pela cor do botão).
2. **Separado dos Termos.** O consentimento sobre a fé (art. 11, I) aparece em bloco próprio, com título, e não é misturado ao "li e aceito os Termos".
3. **Registro.** Cada aceite grava uma linha em `uj.consentimentos` (migração 0012): quem (conta ou inscrição), qual comunidade e vínculo (TC-03, TC-16), o identificador e a versão do texto, data e hora (`concedido_em`), a forma (plataforma: `ios`, `android`, `web`, `pagina_publica`), a faixa de idade (TC-01) e a confirmação adicional (ciência do responsável no TC-03 de quem tem 16 ou 17 anos; idade ou responsável no TC-04). Cancelar o pedido de entrada, ter o pedido recusado ou vencido, sair da comunidade, excluir a conta ou apagar a inscrição pública preenche `revogado_em`.
4. **Revogar com o mesmo esforço.** Todo consentimento diz em uma frase como desfazer.
5. **Acessibilidade.** Texto do consentimento como rótulo da caixa (leitor de tela lê tudo), alvo de toque de 44 pt, link "Saiba mais" com texto descritivo, sem depender de cor.
6. **Linguagem.** Frases curtas, segunda pessoa, sem juridiquês. Sem travessão.

---

## TC-01.v2: Declaração de idade (criação de conta, com ou sem convite)

**Onde aparece:** em todo caminho que cria conta, antes de a conta existir:

- **Cadastro por e-mail** (`Criar conta`, no app e na web): na mesma tela de nome e e-mail, antes de enviar o código de 6 dígitos (`POST /api/auth/cadastro/iniciar`, campo `faixaEtaria`).
- **Cadastro com Google ou Apple**, quando o e-mail ainda não tem conta: na tela "Falta pouco", depois que o provedor confirma a identidade e antes de criar a conta (`POST /api/auth/provedor/concluir-cadastro`).
- **Convite para conta nova** (`/convite`): como na v1, logo depois de nome, e-mail e WhatsApp.

**Texto (escolha única, nenhuma opção pré-selecionada, as três com o mesmo peso visual):**

> **Quantos anos você tem?**
> ( ) Tenho 18 anos ou mais.
> ( ) Tenho 16 ou 17 anos, e meu pai, minha mãe ou meu responsável legal sabe que vou usar o Uni Jovem e concorda.
> ( ) Tenho menos de 16 anos.
>
> Não pedimos sua data de nascimento nem documento. Guardamos só a sua resposta. Responda a verdade: conta de quem tem menos de 16 anos é encerrada.

**Se escolher "menos de 16":** o fluxo para com a mensagem:

> Que bom que você quer participar! Para ter uma conta no Uni Jovem é preciso ter 16 anos ou mais. Se o seu grupo tiver um evento com inscrição aberta, seu pai, sua mãe ou seu responsável pode inscrever você pela página do evento.

Nenhum dado digitado é gravado no servidor. O convite, se houver, **não** é consumido. Com Google ou Apple, o token de cadastro é descartado e nenhuma conta é criada. **Trava no aparelho (recomendação para a v1.1, depende de código no app):** depois dessa resposta, o mesmo aparelho só volta à tela de cadastro 24 horas depois, com a mensagem "Para ter uma conta no Uni Jovem é preciso ter 16 anos ou mais." A marca fica só no aparelho (sem dado pessoal, sem nada no servidor); serve para a pessoa não voltar na hora e escolher outra resposta.

**O que é registrado:** a faixa (`18_mais` ou `16_17`), o identificador `TC-01.v2`, data e forma.

**Histórico:** a v1 (até a ADR 0007) aparecia só no convite e mandava a pessoa falar com a liderança da comunidade. A v2 vale para o cadastro aberto, avisa que conta de menor de 16 é encerrada e indica o caminho da inscrição pelo responsável. As três opções não mudaram. Quem aceitou a v1 continua registrado com ela.

---

## TC-02.v2: Termos e Política (criação de conta)

**Onde aparece:** mesma tela, abaixo da TC-01, em todos os caminhos de cadastro (e-mail, Google, Apple, convite).

**Texto:**

> [ ] Li e concordo com os [Termos de Uso](/termos) e a [Política de Privacidade](/privacidade).

**Se recusar:** não cria a conta. Mensagem: "Para criar a conta, é preciso concordar com os Termos de Uso."

**Base legal:** execução de contrato (art. 7º, V). Não é o consentimento sobre a fé, que vem quando a pessoa pede para entrar ou entra numa comunidade (TC-03).

**Histórico:** a frase não mudou. A versão sobe para 2 porque os documentos aceitos mudaram (Termos 0.3 e Política 0.3, do app aberto), e o registro precisa provar qual versão a pessoa aceitou. Quem tem conta da v1 recebe no app o aviso de mudança relevante (Termos, seção 16) antes de os documentos novos valerem.

---

## TC-03.v3: Consentimento sobre a fé, ao pedir para entrar ou entrar numa comunidade

**Onde aparece (um consentimento por comunidade):**

- **Pedido de entrada** (pela busca ou por código com aprovação): na tela do pedido, acima da mensagem e do botão "Pedir para entrar". O pedido só é enviado com a caixa marcada.
- **Código direto:** na tela "Entrar em _Comunidade X_", antes do botão de confirmar.
- **Convite:** conta nova, depois do código de verificação e da senha; conta existente, na tela "Entrar em _Comunidade X_ como _Papel_".
- **Criar comunidade:** na tela de criação, em bloco separado do Termo do Administrador (TC-16), porque quem cria também participa.

**Texto (bloco destacado, com título):**

> **Sobre a sua fé**
>
> Pedir para entrar ou participar da _{nome da comunidade}_ no Uni Jovem mostra que você tem ligação com uma comunidade de igreja. A lei considera isso um dado sensível.
>
> [ ] Concordo que a _{nome da comunidade}_ e o Uni Jovem tratem meus dados para analisar meu pedido de entrada, se eu fizer um, e para organizar a minha participação nesta comunidade: eventos, escalas, presença, avisos, sugestões e pedidos de oração. Sei que nome e papel ficam visíveis para os membros desta comunidade, e meu e-mail e WhatsApp só para organizadores e administradores.
>
> Você pode desfazer isso quando quiser: cancelando o pedido, saindo da comunidade na aba **Equipe** ("Sair de _{nome da comunidade}_") ou excluindo sua conta. [Saiba mais](/privacidade#fe)

Na criação de comunidade, a primeira frase muda para "Criar e participar da _{nome}_ no Uni Jovem mostra que..." e a caixa não cita o pedido de entrada.

**Texto adicional, só para quem declarou 16 ou 17 anos:**

> [ ] Meu pai, minha mãe ou meu responsável legal sabe deste consentimento e concorda.

**Se recusar:** não envia o pedido nem entra na comunidade. Para conta nova por convite, a conta também não é criada. Mensagem:

> Sem essa concordância não conseguimos incluir você na comunidade, porque o app usa esses dados para funcionar. Se mudar de ideia, é só tentar de novo.

**O que é registrado:** conta, comunidade, `TC-03.v3`, data, forma e, para 16 e 17 anos, a confirmação da ciência do responsável. Na entrada por código direto, convite e criação, a linha vai na hora para `uj.consentimentos`, com o vínculo. No pedido de entrada, a versão, a forma e a ciência ficam na própria linha do pedido (`uj.pedidos_de_entrada`, migração 0022 em construção) e viram a linha do consentimento, com o vínculo, quando o pedido é aceito.

**Revogação:** cancelar o pedido, ter o pedido recusado ou vencido (o tratamento acaba), sair da comunidade ou excluir a conta revoga este consentimento para aquela comunidade (ver `exclusao-de-conta.md`, caso 2).

**Histórico:**

- v1 (até 15/11/2026): dizia "em Perfil > Sair da comunidade", mas o botão de sair fica na aba Equipe.
- v2 (15/11/2026): corrigiu o caminho de sair; o que a pessoa autoriza era o mesmo.
- v3 (15/11/2026, com a ADR 0007): cobre o pedido de entrada e a entrada por código, além do convite, e a criação de comunidade. Muda o que a pessoa autoriza (análise do pedido), por isso a versão sobe. Quem aceitou a v1 ou a v2 continua registrado com elas.

---

## TC-04.v1: Inscrição pública em evento (página `/e/{idPublico}`)

**Onde aparece:** formulário público de inscrição, acima do botão "Confirmar inscrição". Com a ADR 0007, só comunidades verificadas publicam essa página; o texto não muda.

**Texto (em uso desde a migração 0012, em `apps/api/src/publico/rotas.ts`; as duas caixas são obrigatórias e começam desmarcadas):**

> [ ] Concordo que a _{nome da comunidade}_ use meu nome, WhatsApp e e-mail (se eu informar) só para organizar este evento. Sei que me inscrever num evento de igreja mostra que participo de uma comunidade religiosa. Meus dados são apagados {N} dias depois do evento. Posso cancelar e apagar antes pelo link que recebo ao me inscrever. [Saiba mais sobre a privacidade](/privacidade#inscricao)
>
> [ ] A pessoa inscrita tem 16 anos ou mais, ou eu sou o pai, a mãe ou o responsável legal dela e informei o meu WhatsApp como contato.

`{N}` é o prazo de retenção configurado pela comunidade (padrão 90).

**Se recusar qualquer uma das duas:** a inscrição não é gravada. Mensagens (já no padrão do código):

- "Para se inscrever, marque a concordância com o uso dos seus dados."
- "Para se inscrever, confirme a idade ou que você é o responsável."

**O que é registrado:** `inscricoes.consentimento_em` e uma linha em `uj.consentimentos` com `TC-04`, a versão, a forma `pagina_publica` e a confirmação da idade ou do responsável (`uj.inscrever_publico`, que recusa sem a confirmação).

**Revogação:** a página do link de cancelamento oferece "Cancelar e apagar meus dados agora" (`uj.apagar_inscricao_publica`), que anonimiza a inscrição na hora e revoga o TC-04.

---

## TC-05.v1: Inscrição de membro em evento (dentro do app)

**Onde aparece:** botão "Quero participar" num evento, para quem já tem conta.

**Não é consentimento novo** (a participação já está coberta pela TC-03). Só uma linha informativa abaixo do botão:

> Organizadores e administradores desta comunidade verão que você se inscreveu.

---

## TC-06.v1: Pedido de oração, ao escolher a visibilidade

**Onde aparece:** tela de novo pedido de oração, no seletor de visibilidade, antes de "Publicar". O padrão é sempre **Somente eu**.

**Textos de cada opção (aparecem antes de publicar, sem precisar tocar em "saiba mais"):**

> **Somente eu** (padrão)
> Só você vê. Nem administradores nem o Criador do app têm tela para ler.
>
> **Equipe de oração**
> Você e as {n} pessoas da equipe de oração da _{comunidade}_ veem. Administradores só veem se estiverem na equipe.
>
> **Comunidade**
> Você e todos os membros ativos da _{comunidade}_ veem ({n} pessoas hoje).

**Aviso fixo abaixo do campo de texto:**

> Escreva só o necessário. Evite nomes e detalhes de saúde de outras pessoas sem a permissão delas. O texto é guardado cifrado, mas não é criptografia de ponta a ponta: quem administra o servidor tem capacidade técnica de ler. [Entenda](/privacidade#oracao)

**Confirmação ao publicar com "Equipe de oração" ou "Comunidade" (diálogo):**

> Publicar para {a equipe de oração / toda a comunidade}?
> {n} pessoas vão poder ler este pedido.
> [Voltar] [Publicar]

**Se recusar (tocar em Voltar ou sair da tela):** o pedido não é enviado nem salvo. O texto não fica guardado no aparelho (pedidos de oração nunca vão para o armazenamento offline).

**Base legal:** consentimento específico (art. 11, I), registrado pela própria ação de publicar com a visibilidade escolhida. [REVISÃO JURÍDICA: confirmar se a ação de publicar após a explicação, sem caixa de seleção, é manifestação suficiente para dado sensível, ou se cabe uma caixa na primeira vez.]

---

## TC-07.v1: Mudança de visibilidade de um pedido de oração

**Onde aparece:** ao trocar a visibilidade de um pedido já publicado.

> Mudar a visibilidade para {nova}?
> Antes: {quem via}. Depois: {quem vai ver}.
> {Se estiver ampliando:} Mais pessoas vão poder ler este pedido.
> {Se estiver reduzindo:} Quem já leu pode ter lido antes desta mudança.
> [Cancelar] [Mudar]

**Se cancelar:** nada muda.

---

## TC-08.v1: Sugestão anônima

**Onde aparece:** chave "Enviar como anônima" na tela de nova sugestão.

> **Enviar como anônima**
> Ninguém da comunidade, nem organizadores e administradores, verá quem enviou. O sistema guarda a autoria para segurança (por exemplo, em caso de abuso), sem mostrar em nenhuma tela; quem administra o servidor tem capacidade técnica de consultá-la.

---

## TC-09.v1: Notificações (antes do pedido do sistema)

**Onde aparece:** tela explicativa mostrada em contexto (por exemplo, ao confirmar a primeira escala ou na missão "ativar notificações"), nunca na primeira abertura do app. Só depois de "Ativar" aparece o diálogo do sistema.

> **Quer ser avisado?**
> Avisamos quando você for escalado, quando um evento mudar ou for cancelado, quando pedirem substituição e quando sair um aviso da sua comunidade.
> Na tela bloqueada, assuntos pessoais aparecem com texto genérico. Pedidos de oração nunca viram notificação.
> Você escolhe os tipos e as comunidades em **Perfil > Notificações**.
> [Agora não] [Ativar]

**Se recusar ("Agora não" ou negar no sistema):** nada se perde; tudo aparece no Início do app. A tela de preferências mostra os dois estados separados ("Ligado no app, bloqueado no sistema: abrir Ajustes").

---

## TC-10.v1: Versículo do dia

**Onde aparece:** Perfil > Versículo do dia (e na missão de boas-vindas).

> O versículo do dia é agendado no seu aparelho e funciona sem internet. O servidor guarda só se ele está ligado e o horário escolhido, para valer em todos os seus aparelhos. Você pode desligar ou mudar o horário quando quiser.

Não é consentimento (não há tratamento de dado pessoal). A notificação local depende da permissão de notificações do sistema; se ela estiver negada, o versículo aparece no Início.

---

## TC-11.v2: Câmera e galeria

**Onde aparece:** texto do sistema ao pedir a câmera (na primeira vez que alguém toca em "Ler QR Code" ou em "Tirar foto") e a galeria (em "Escolher da galeria"). Está em `apps/app/app.config.ts` desde 15/11/2026, quando a foto de perfil e o logotipo (D33) passaram a usar a câmera e a galeria:

> A câmera lê o QR Code de presença na entrada de um evento e, quando você escolhe, tira a sua foto de perfil ou o logotipo da sua comunidade. Só a foto que você confirmar é enviada, recortada e sem a localização.

> A galeria é usada quando você escolhe uma foto de perfil ou o logotipo da sua comunidade. Só a imagem escolhida é enviada, recortada e sem a localização.

**Se recusar:** o check-in continua pela busca por nome com o botão "Marcar presença".

---

## TC-12.v2: Sair da comunidade

**Onde aparece:** aba Equipe > "Sair de _{comunidade}_" (o Perfil lista as comunidades e leva à mesma tela). Em 15/11/2026 o app usa um texto mais curto (`apps/app/src/funcionalidades/comunidade/sairDaComunidade.ts`): "Você deixa de ver a agenda e as programações desta comunidade. Para voltar, vai precisar de um convite novo.", mais a lista do que não foi enviado. Com a ADR 0007, a última frase muda para "Para voltar, peça para entrar de novo ou use um convite ou o código da comunidade."

> **Sair da _{comunidade}_?**
>
> - Seus pedidos de oração nesta comunidade serão apagados.
> - Sua disponibilidade e suas escalas futuras serão retiradas.
> - Seu histórico aqui (presenças e escalas passadas) deixa de mostrar seu nome e passa a aparecer como "Pessoa removida".
> - O que estiver baixado para uso sem internet nesta comunidade será apagado deste aparelho.
> - Para voltar, peça para entrar de novo ou use um convite ou o código da comunidade. Você volta como pessoa nova, sem o histórico.
>   {Se houver operações não enviadas:} Há {n} alterações ainda não enviadas. Elas serão descartadas.
>   {Se for o único administrador e houver outras pessoas:} Você é o único administrador. Antes de sair, nomeie outra pessoa como administradora.
>   [Cancelar] [Sair da comunidade]

**Histórico:** a v1 dizia que a volta precisava de um novo convite, o que deixa de ser verdade com a entrada por código e por pedido (ADR 0007).

---

## TC-13.v1: Excluir conta

**Onde aparece:** Perfil > Privacidade e dados > Excluir minha conta (app e web, rota `/excluir-conta` do app, `/app/excluir-conta` na web); a página pública `/excluir-conta` leva até ela. Exige a senha (e o código de segundo fator, se ligado). Com a ADR 0007, conta criada só com Google ou Apple confirma entrando de novo com o provedor.

> **Excluir sua conta?**
> Isso não pode ser desfeito.
>
> - Você sai de todas as comunidades e é desconectado de todos os aparelhos.
> - Seus pedidos de oração e sua disponibilidade são apagados.
> - Seu nome, e-mail, WhatsApp e senha são apagados. Onde você aparecia (escalas passadas, presenças, sugestões, avisos), passa a aparecer "Pessoa removida". Os números da comunidade continuam.
> - Cópias de segurança com seus dados se apagam sozinhas em até cerca de 100 dias.
> - Antes, se quiser, [baixe uma cópia dos seus dados].
>   [Cancelar] [Excluir minha conta]

---

## TC-14.v1: Exportar meus dados

**Onde aparece:** Perfil > Privacidade e dados > Exportar meus dados. A API gera o arquivo na hora (D26), então o texto não fala em prazo de 24 horas.

> Vamos gerar um arquivo com os seus dados: conta, comunidades, pedidos de entrada, escalas, inscrições, presenças, seus pedidos de oração e suas sugestões. Só você pode gerar o seu. Guarde-o com cuidado: ele contém seus pedidos de oração sem cifragem.
> [Gerar arquivo]

---

## TC-15.v1: Bloquear esta pessoa

**Onde aparece:** junto do **Denunciar**, num pedido de oração, numa sugestão com nome ou num aviso (`apps/app/src/funcionalidades/denuncias/BotaoDenunciar.tsx`). A lista e o desbloqueio ficam em **Perfil > Pessoas bloqueadas** (rota `/bloqueados`). Não é consentimento: é um aviso de tela, sem versão registrada.

> **Bloquear esta pessoa?**
> Você deixa de ver os pedidos de oração e as sugestões desta pessoa, só nesta comunidade. Ela não é avisada, continua na comunidade e nada muda no papel de ninguém. Avisos e programação continuam aparecendo. Para desfazer: Perfil, Pessoas bloqueadas.
> [Cancelar] [Bloquear]

Depois: "Pessoa bloqueada. Ela não é avisada." [Desfazer]

**Sugestão anônima:** não dá para bloquear (a tela da sugestão pode esconder a opção com `podeBloquear={false}`). A API recusa e a tela mostra: "Esta sugestão é anônima: não dá para saber quem escreveu, então não dá para bloquear. Se ela tiver um problema, use "Denunciar"."

**Desbloquear:**

> **Desbloquear {nome}?**
> Os pedidos de oração e as sugestões dessa pessoa voltam a aparecer para você nesta comunidade. Ela não é avisada.
> [Cancelar] [Desbloquear]

---

## TC-16.v1: Termo do Administrador da Comunidade (criar comunidade)

**Onde aparece:** tela de criar comunidade (`POST /api/v1/comunidades`, campo `aceiteDoTermoDoAdmin: true`), depois de nome, cor e cidade, acima do botão "Criar comunidade". Na mesma tela, em bloco separado, vai o TC-03.v3 na forma de criação. Texto completo em [`termo-do-administrador.md`](termo-do-administrador.md), publicado em `/termos#administrador`.

**Texto (o resumo do termo, em texto corrido, mais a caixa):**

> **Antes de criar, leia com atenção**
>
> Ao criar esta comunidade, você passa a administrá-la e responde, em nome dela, pelos dados das pessoas que entram: a comunidade é a controladora desses dados, e o Uni Jovem os guarda e trata em nome dela. Só aceite quem tem 16 anos ou mais, com cuidado redobrado com quem tem 16 ou 17, e use os dados só para organizar as atividades da comunidade, nunca para propaganda, política, venda ou outra finalidade. Participar revela a fé das pessoas: guarde sigilo, analise as denúncias e responda a quem pedir para ver, corrigir ou apagar os próprios dados. Até a verificação pelo Uni Jovem, a comunidade tem no máximo 30 pessoas e não publica página aberta de evento, e o Uni Jovem pode suspendê-la se este termo ou a lei forem descumpridos.
>
> [Ler o termo completo](/termos#administrador)
>
> [ ] Li e aceito o Termo do Administrador da Comunidade.

**Se recusar:** a comunidade não é criada. Mensagem: "Para criar a comunidade, é preciso aceitar o Termo do Administrador."

**Se o e-mail da conta não estiver confirmado:** a tela nem chega à caixa. Mensagem (403 da API): "Para criar uma comunidade, confirme primeiro o seu e-mail."

**Se a conta estiver acima dos limites** (uma comunidade nova por vez, até 3 criadas): mensagem (409 da API): "Você já tem uma comunidade esperando verificação. Quando ela for verificada, você poderá criar outra." ou "Você já criou 3 comunidades, o limite por pessoa."

**O que é registrado:** conta, comunidade criada, vínculo de admin, `TC-16.v1`, data e forma. **Exige mudança no código:** `TC-16` em `VERSAO_DO_TEXTO` e o registro na criação.

**Base legal:** execução de contrato (art. 7º, V): é o acordo entre a comunidade, representada por quem a cria, e o Uni Jovem como operador (art. 39). Não substitui o TC-03 da própria pessoa.

**Administradores promovidos depois:** o termo vale para eles pelos Termos de Uso (seção 9). Recomendação: mostrar o mesmo bloco, com a caixa, na primeira vez que a pessoa abrir a comunidade como administradora, e registrar o TC-16 com o vínculo dela. Também na mudança de versão do termo.

---

## TC-17.v1: Pedido de entrada (aviso, sem versão registrada)

**Onde aparece:** tela "Pedir para entrar em _{comunidade}_" (pela busca ou por código com aprovação), junto do campo de mensagem. O consentimento é o TC-03.v3, na mesma tela.

> **Mensagem para a liderança (opcional)**
> Conte quem você é, por exemplo "Sou a Ana, do grupo de sábado". A liderança da _{comunidade}_ vai ver seu nome e esta mensagem. Não escreva dados de saúde, documentos nem detalhes de outras pessoas.
>
> Você verá só se o pedido está "Pendente", "Aceito" ou "Não aprovado". Se ninguém responder em 30 dias, o pedido vence. Você pode cancelar quando quiser.

**Depois de uma recusa:** "Seu pedido para _{comunidade}_ não foi aprovado. Você pode pedir de novo a partir de {data}." Nunca diz quem decidiu.

**Limites (mensagens da API):** "Você já tem 3 pedidos esperando resposta. Cancele um ou espere a resposta para pedir outro." e "Você pediu para entrar nesta comunidade há pouco tempo. Pode pedir de novo a partir de {data}."

**Notificações (D42):** para a liderança, "Novo pedido de entrada na sua comunidade."; para quem pediu, "Seu pedido de entrada teve resposta." Texto genérico, sem o nome da comunidade, sem o nome de quem pediu e sem a mensagem.

---

## TC-18.v1: Aparecer na busca (aviso para o administrador)

**Onde aparece:** Configurações da comunidade, na chave "Aparecer na busca" (desligada por padrão).

> **Aparecer na busca**
> Ligado, quem tem conta no Uni Jovem encontra esta comunidade pelo nome e pela cidade, e vê nome, cidade, cor, logotipo e se ela é verificada. Ninguém vê, pela busca, quem participa nem quantas pessoas há. Quem encontrar pode pedir para entrar, e você ou os organizadores decidem.

**Ao ligar, se a comunidade não tiver cidade:** "Informe a cidade para as pessoas acharem a comunidade certa."

---

## TC-19.v1: Denunciar comunidade (aviso)

**Onde aparece:** no resultado da busca e dentro da comunidade (para quem participa), no botão "Denunciar comunidade" (`POST /api/v1/comunidades/:idPublico/denuncias`).

> **Denunciar _{comunidade}_?**
> Sua denúncia vai para a equipe do Uni Jovem, não para a comunidade. Ninguém da comunidade fica sabendo quem denunciou.
> Motivo: ( ) Comunidade falsa ou que se passa por outra ( ) Golpe ( ) Conteúdo ofensivo ou ilegal ( ) Spam ou propaganda ( ) Risco a criança ou adolescente ( ) Pessoa com menos de 16 anos ( ) Outro
> Conte o que aconteceu (opcional). Não escreva dados de saúde nem documentos.
> [Cancelar] [Enviar denúncia]

Depois: "Denúncia enviada. Obrigado por avisar." Se a pessoa marcar "Risco a criança ou adolescente", a tela acrescenta: "Se houver perigo agora, ligue 190. Você também pode escrever para contact@solerte.com.br."

**Recomendação para a API:** a migração 0022 (em construção) aceita `falsa`, `golpe`, `ofensiva`, `spam` e `outro`. Faltam "Risco a criança ou adolescente" e "Pessoa com menos de 16 anos" (por exemplo, `risco_a_menor` e `menor_de_16`), que devem ir para o topo da fila do painel da plataforma. Até lá, a tela mostra só os cinco motivos aceitos.

---

## TC-20.v1: Código da comunidade (aviso para o administrador)

**Onde aparece:** tela do código da comunidade (`GET .../codigo`), com o QR e o link.

> Quem tiver este código pode {entrar na comunidade como membro / pedir para entrar}, conforme a forma de entrada escolhida em Configurações. Mostre só a quem você quer na comunidade. Se o código se espalhar, toque em "Trocar código": o antigo deixa de valer na hora.
> [Compartilhar] [Trocar código]

**Ao trocar:** "Trocar o código? Quem tem o código antigo não vai mais conseguir usá-lo. Quem já entrou continua na comunidade." [Cancelar] [Trocar]

---

## Notas para a revisão jurídica

1. TC-03: consentimento por comunidade como condição de participação (art. 9º, § 3º) e redação do destaque (art. 11, I). Na v3, consentimento dado no pedido de entrada para cobrir a participação se o pedido for aceito depois, sem nova ação da pessoa.
2. TC-01 e TC-03: suficiência da autodeclaração de idade, agora sem convite (cadastro aberto), e da ciência do responsável declarada pelo próprio adolescente de 16 e 17 anos (Lei nº 15.211/2025; Código Civil, art. 4º, I). Ver a Política de Privacidade, seção 12 e anexo, item 6: medidas da v1.1 e sinal de idade das lojas.
3. TC-04: inscrição de menores de 16 pelo responsável, com o contato do responsável; menores de 12 (LGPD, art. 14, § 1º).
4. TC-06: forma da manifestação de consentimento para o pedido de oração.
5. TC-16: aceite eletrônico do Termo do Administrador por pessoa física como contrato do art. 39 em nome da comunidade; idade mínima para criar comunidade; aceite pelos administradores promovidos depois.
6. TC-19: base legal da denúncia de comunidade feita por quem participa dela (revela a fé de quem denuncia).
