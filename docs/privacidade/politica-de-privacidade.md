# Política de Privacidade do Uni Jovem

> **Texto publicado em `/privacidade`, com revisão jurídica ainda pendente (PH-11).**
> Versão 0.2, de 15/11/2026. A publicação em produção foi autorizada pelo dono em 15/11/2026; a revisão jurídica continua aberta e pode mudar o texto.
> Conferida contra o código em 15/11/2026: migrações `apps/api/migracoes/0001` a `0018`, `apps/api/src`, `apps/app/src` e `infra/prod`.
> Os trechos `[REVISÃO JURÍDICA: ...]` são dúvidas para o advogado e os trechos `[IMPLEMENTAÇÃO: ...]` descrevem algo que o texto afirma e o código ainda não faz por completo. Os dois saem do texto publicado. Por isso, um `[IMPLEMENTAÇÃO: ...]` só fica aqui quando o trecho é exigido por lei ou pela loja; a lista está no anexo.

Versão de 15/11/2026.

Esta política explica, em linguagem direta, quais dados o Uni Jovem guarda, por quê, quem vê, por quanto tempo e como você controla tudo isso. Ela vale para o aplicativo (iPhone, Android e web) e para as páginas públicas de [unijovem.solerte.com.br](https://unijovem.solerte.com.br).

## 1. Resumo em um minuto

- O Uni Jovem organiza a vida de comunidades jovens de igreja: eventos, escalas, presença, avisos, sugestões e pedidos de oração.
- Só entra quem é convidado. Cada comunidade é separada das outras: ninguém de uma comunidade vê dados de outra.
- Participar de uma comunidade de igreja pode revelar a sua **fé**. A lei trata isso como dado sensível, então pedimos o seu **consentimento específico** antes de você entrar em cada comunidade.
- **Não vendemos dados, não mostramos anúncios e não usamos ferramentas de rastreamento ou de análise de comportamento.**
- Pedidos de oração são guardados cifrados e, por padrão, só você vê. Mas isso **não é criptografia de ponta a ponta** (explicamos o limite na seção 10).
- Você pode ver, corrigir, baixar e apagar seus dados pelo próprio app, em **Perfil**.
- É preciso ter **16 anos ou mais** para ter uma conta. Quem tem 16 ou 17 anos precisa que o pai, a mãe ou o responsável saiba e concorde (seção 12).
- Quem responde pelo Uni Jovem é Rafael Gomes, pelo e-mail [contact@solerte.com.br](mailto:contact@solerte.com.br).

## 2. Quem cuida dos seus dados

O Uni Jovem tem dois tipos de responsável, porque há dois tipos de dado.

| Quem                                                                                                                    | Papel na lei (LGPD)                                                                                                                        | Sobre quais dados                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A sua comunidade** (a igreja ou o ministério jovem que convidou você, representado pelos administradores dela no app) | **Controladora**: decide para que os dados da comunidade são usados                                                                        | Tudo o que existe dentro da comunidade: sua participação, escalas, presença, inscrições, avisos, sugestões, denúncias, pedidos de oração, conteúdos                                                                         |
| **O operador da plataforma**: Rafael Gomes, pessoa física, responsável pelo Uni Jovem                                   | **Operador** dos dados da comunidade (trata em nome dela e segundo as instruções dela) e **controlador** dos dados da conta e da segurança | Operador: os dados da comunidade. Controlador: sua conta (nome, e-mail, WhatsApp, senha, foto de perfil, contas conectadas), sessões, aparelhos, autenticação em dois fatores, registros de segurança e cópias de segurança |

**Encarregado pelo tratamento de dados (DPO):** Rafael Gomes, e-mail [contact@solerte.com.br](mailto:contact@solerte.com.br). É com ele que você fala sobre qualquer assunto desta política, inclusive se não conseguir resolver algo pelo app.

[REVISÃO JURÍDICA: confirmar a divisão controladora (comunidade) e operador/controlador (plataforma). Pontos em aberto: (1) quando a "comunidade" é um grupo jovem sem personalidade jurídica, a controladora é a igreja (organização religiosa, pessoa jurídica) ou o líder como pessoa natural? (2) Há risco de a relação ser lida como controladoria conjunta, já que a plataforma define meios essenciais (prazos de retenção padrão, regras de visibilidade)? (3) A relação precisa de contrato escrito entre plataforma e cada comunidade (art. 39); o rascunho dessas obrigações está na seção 9 dos Termos de Uso, mas talvez deva ser um acordo separado aceito pelo administrador.]

[REVISÃO JURÍDICA: a Resolução CD/ANPD nº 2/2022 dispensa agentes de pequeno porte de indicar encarregado, mas a dispensa não vale para tratamento de alto risco, e aqui há dado sensível e dados de adolescentes. Decidimos indicar encarregado de qualquer forma; confirmar a forma de indicação e publicação conforme a Resolução CD/ANPD nº 18/2024. Decisão do dono em 15/11/2026: identificar o controlador pelo nome e pelo e-mail, sem publicar CPF nem endereço; confirmar que isso atende ao art. 9º, III, da LGPD.]

## 3. Quais dados guardamos

Guardamos só o necessário para o app funcionar. A lista abaixo é completa: se um dado não está aqui, o Uni Jovem não o coleta.

### 3.1 Sua conta

| Dado                                                                                                        | De onde vem                                                                                                                                                                                           | Obrigatório? |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Nome                                                                                                        | Você informa ao aceitar o convite                                                                                                                                                                     | Sim          |
| E-mail (verificado por código)                                                                              | Você informa                                                                                                                                                                                          | Sim          |
| WhatsApp                                                                                                    | Você informa                                                                                                                                                                                          | Não          |
| Senha                                                                                                       | Você cria. Guardamos só uma "impressão" irreversível (hash argon2id), nunca a senha                                                                                                                   | Sim          |
| Faixa de idade declarada (18 anos ou mais, ou 16 a 17 anos com ciência do responsável)                      | Você declara ao criar a conta (ou ao aceitar um convite, se a conta ainda não tinha declarado). **Não pedimos data de nascimento**                                                                    | Sim          |
| Registro dos seus consentimentos (o que você aceitou, quando, em qual versão do texto e em qual plataforma) | Gerado quando você aceita                                                                                                                                                                             | Sim          |
| Autenticação em dois fatores (opcional; obrigatória para o Criador da plataforma)                           | Segredo do aplicativo autenticador, guardado cifrado; códigos de recuperação guardados só como hash                                                                                                   | Não          |
| Contas conectadas do Google ou da Apple                                                                     | Se você entrar ou se conectar com Google ou Apple: o identificador da sua conta nesse serviço e o e-mail que ele informou (na Apple, pode ser um e-mail de retransmissão). Isso nunca cria conta nova | Não          |
| Avatar (ícone e cor escolhidos numa lista) e foto de perfil                                                 | Você escolhe. A foto é regravada pelo servidor sem metadados (localização e dados da câmera somem), com no máximo 512 × 512 pixels                                                                    | Não          |

### 3.2 Segurança e acesso

| Dado                                                                                                                                                                              | Para quê                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Sessões: modelo do aparelho (por exemplo, "iPhone 15"; nunca o nome que você deu ao aparelho), sistema (iOS, Android ou web), datas de criação, último uso, expiração e revogação | Manter você conectado, mostrar a lista "Aparelhos conectados" e permitir desconectar um aparelho |
| Contagem de falhas de login e de segundo fator, bloqueios temporários                                                                                                             | Impedir que alguém adivinhe sua senha                                                            |
| Endereço IP **truncado** (o final do endereço é zerado, por exemplo `200.150.10.0`) nos registros de auditoria e nos registros técnicos do servidor                               | Investigar abuso sem guardar o endereço exato                                                    |
| Códigos e links temporários (verificação de e-mail, redefinição de senha, confirmação para excluir a conta)                                                                       | Guardados só como hash, valem de 5 a 30 minutos                                                  |

### 3.3 Sua participação na comunidade

- Vínculo com cada comunidade: papel (membro, organizador ou administrador), situação (ativo, desativado, removido), designação para a equipe de oração, data de entrada.
- Escalas: em que etapa você serve, se confirmou, se pediu substituição (com um motivo opcional que você escreve) e quem assumiu.
- Disponibilidade por data, com observação opcional.
- Tarefas, materiais e itens de checklist pelos quais você é responsável ou que você marcou.
- Inscrições em eventos e presença (quando e como foi registrada).
- Comandos que você deu na tela "Ao vivo", quando conduz um evento.

### 3.4 O que você escreve

- **Pedidos de oração**: o texto (cifrado), a visibilidade escolhida, se foi marcado como respondido, e quem tocou em "estou orando".
- **Sugestões**: título, texto, se é anônima, situação e resposta.
- **Denúncias**: o motivo escolhido e, se você quiser, um detalhe de até 500 caracteres.
- Se você é organizador ou administrador: avisos, notas internas de evento, eventos, etapas, modelos, conteúdos (músicas, músicos, palestrantes, dinâmicas), locais, anexos por link e, para administradores, o logotipo da comunidade.

### 3.5 Inscrição pública em evento (sem conta)

Quem se inscreve pela página pública de um evento **não cria conta**. Guardamos: nome, WhatsApp, e-mail (opcional), situação da inscrição (confirmada, lista de espera, cancelada), um código de presença aleatório (o QR Code, que não contém dado pessoal), a data e a versão do texto do consentimento, a confirmação de idade ou de responsável e uma impressão (hash) do link de cancelamento.

### 3.6 Pessoas cadastradas por organizadores

Organizadores podem registrar o nome de músicos, palestrantes e de quem chegou a um evento sem inscrição (presença avulsa). Nesses casos o dado é informado por eles, e a comunidade é responsável por ter motivo para isso.

### 3.7 No seu aparelho

- O token que mantém você conectado fica no cofre do sistema (Keychain no iPhone, Keystore no Android). Na web, fica num cookie protegido que o JavaScript da página não consegue ler. **Sua senha nunca é guardada no aparelho.**
- Se você ligar o Face ID (ou a biometria do Android), esse token fica trancado por uma chave que só a biometria do aparelho abre. Quem confere o rosto ou a digital é o sistema do aparelho: **o Uni Jovem não recebe nem guarda imagem do rosto nem digital.**
- No celular, uma cópia dos seus dados de conta e da lista das suas comunidades, também no cofre do sistema, para o app abrir sem internet. Ela vale por até 30 dias e é apagada quando você sai da conta.
- A comunidade que você abriu por último e algumas preferências de interface (por exemplo, o andamento da missão de boas-vindas).
- Só no celular, quando você prepara um evento para uso sem internet: a programação, a escala, as tarefas, os materiais e os checklists; para organizadores, também a lista de inscritos e de membros para o check-in, com o telefone mascarado. Tudo fica num banco local **cifrado**, separado por conta e por comunidade, que vence em 7 dias sem contato com o servidor (cada comunidade pode ajustar entre 3 e 30 dias) e é apagado quando você sai da conta ou da comunidade, ou quando o servidor informa que você perdeu o acesso. Na web, nada é guardado para uso sem internet.
- Os versículos do dia já agendados como notificação local. O servidor guarda só se o versículo está ligado e o horário que você escolheu.
- **Pedidos de oração nunca ficam guardados no aparelho para uso offline.**

### 3.8 Notificações

Se você permitir notificações: o identificador de notificação do aparelho (fornecido pela Apple ou pelo Google), ligado à sessão daquele aparelho, e suas preferências por tipo e por comunidade. O servidor também guarda, por 30 dias, o registro das notificações enviadas a você: o tipo e um texto curto e genérico, sem o nome da comunidade, sem o título do evento e sem o conteúdo de avisos.

### 3.9 O que o Uni Jovem **não** coleta

Localização do seu aparelho, contatos da sua agenda, fotos da sua galeria (a única imagem sua que guardamos é a foto de perfil que você escolher enviar), microfone, CPF, data de nascimento, dados biométricos, dados de pagamento, identificador de publicidade, histórico de navegação, e qualquer ferramenta de análise de uso ou rastreamento. A câmera é usada só para ler o QR Code de presença, e nenhuma foto é tirada nem guardada nesse uso. O endereço e o pino no mapa que aparecem num evento são do **local** do evento, não seus.

## 4. Dado sensível: sua fé (e o que você escreve na oração)

Pela LGPD (art. 5º, II), dado que revela **convicção religiosa** ou filiação a organização religiosa é dado pessoal sensível. Fazer parte de uma comunidade de igreja no Uni Jovem revela isso. Por isso:

- Pedimos o seu **consentimento específico e destacado** (art. 11, I) ao entrar em **cada** comunidade, num bloco próprio, separado dos Termos de Uso, com caixa que começa desmarcada.
- Quem se inscreve pela página pública de um evento também dá esse consentimento, no próprio formulário.
- Esse consentimento é **condição** para participar da comunidade: sem ele, o app não tem como funcionar para você naquela comunidade (art. 9º, § 3º). Você pode **revogá-lo a qualquer momento**, com o mesmo esforço com que deu: saindo da comunidade ou excluindo sua conta (seção 11). A revogação não desfaz o que foi feito antes dela.

Pedidos de oração podem conter outros dados sensíveis, como informação de saúde, e às vezes dados de **outras pessoas** ("orem pela minha mãe, que está internada"). Pedimos que você escreva só o necessário e evite nomes e detalhes de terceiros sem a permissão deles.

[REVISÃO JURÍDICA: (1) confirmar o consentimento (art. 11, I) como base para o tratamento ligado à convicção religiosa, já que a LGPD não tem exceção equivalente à do GDPR para membros de organização religiosa (art. 9º, 2, d, do GDPR). (2) Avaliar se o consentimento como condição do serviço atende ao art. 9º, § 3º, com o destaque proposto. (3) Avaliar dados de terceiros em pedidos de oração (saúde de familiares).]

## 5. Para que usamos e com qual base legal

| Finalidade                                                                                                                              | Dados usados                                                         | Base legal (LGPD)                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Criar e manter sua conta, deixar você entrar e sair (inclusive com Google ou Apple, se você escolher)                                   | Conta, sessões, contas conectadas                                    | Execução do contrato, os Termos de Uso (art. 7º, V)                                                                                             |
| Mostrar sua foto de perfil ou avatar às pessoas das suas comunidades                                                                    | Foto ou avatar                                                       | Consentimento (art. 7º, I), dado ao enviar; você pode apagar quando quiser                                                                      |
| Fazer você participar da comunidade (escalas, eventos, presença, avisos, sugestões, conteúdos)                                          | Participação, o que você escreve                                     | Consentimento específico (art. 11, I), por envolver convicção religiosa                                                                         |
| Publicar e mostrar seus pedidos de oração a quem você escolheu                                                                          | Pedido de oração                                                     | Consentimento específico (art. 11, I), dado na hora de escolher a visibilidade                                                                  |
| Receber e analisar denúncias de conteúdo dentro da comunidade                                                                           | Denúncia, conteúdo denunciado                                        | Consentimento específico já dado ao entrar na comunidade (art. 11, I), na finalidade de manter a convivência segura                             |
| Proteger sua conta: senha, segundo fator, bloqueio de tentativas, alerta de segurança por e-mail, registros técnicos                    | Segurança e acesso                                                   | Prevenção à fraude e segurança do titular em autenticação (art. 11, II, "g"); para a parte que não é sensível, legítimo interesse (art. 7º, IX) |
| Manter uma trilha de auditoria de ações importantes (quem mudou o quê, sem conteúdo)                                                    | Auditoria                                                            | Prevenção à fraude e segurança (art. 11, II, "g") e exercício regular de direitos (art. 11, II, "d")                                            |
| Inscrição pública em evento                                                                                                             | Inscrição pública                                                    | Consentimento específico (art. 11, I)                                                                                                           |
| Barrar robôs na página pública de inscrição                                                                                             | Sinais técnicos do navegador, analisados pela Cloudflare (Turnstile) | Legítimo interesse (art. 7º, IX)                                                                                                                |
| Enviar e-mails essenciais (código de verificação, convite, redefinição de senha, alerta de segurança, confirmação de exclusão de conta) | E-mail, primeiro nome                                                | Execução do contrato (art. 7º, V)                                                                                                               |
| Enviar notificações que você ligou                                                                                                      | Identificador do aparelho, preferências                              | Execução do contrato (art. 7º, V); a permissão do sistema é pedida antes e pode ser desligada                                                   |
| Relatórios da comunidade (presença, escalas, inscrições)                                                                                | Participação                                                         | Consentimento específico (art. 11, I), na mesma finalidade de organizar a comunidade                                                            |
| Atender pedidos seus como titular                                                                                                       | O que for necessário para o pedido                                   | Cumprimento de obrigação legal (art. 7º, II)                                                                                                    |

Não usamos seus dados para publicidade, para traçar perfil de comportamento, para decisões automatizadas sobre você nem para treinar inteligência artificial.

[REVISÃO JURÍDICA: confirmar o enquadramento da segurança da conta e da auditoria no art. 11, II, "g" e "d", em vez de consentimento, já que elas também tocam no vínculo religioso. Confirmar o legítimo interesse do Turnstile e se cabe teste de balanceamento documentado (art. 10). Confirmar a base da foto de perfil (consentimento) e da análise de denúncias (consentimento da comunidade, ou cumprimento do art. 28 da Lei nº 15.211/2025).]

## 6. Quem vê o quê dentro da comunidade

| Informação                             | Quem vê                                                                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Seu nome, seu papel, avatar e foto     | Todos os membros ativos das comunidades em que você está ativo                                                                                                                                         |
| Seu e-mail e WhatsApp                  | Organizadores e administradores da mesma comunidade                                                                                                                                                    |
| Sua faixa de idade                     | Ninguém da comunidade. Só o sistema usa, e ela aparece na sua exportação de dados                                                                                                                      |
| Suas escalas, presença e inscrições    | Organizadores e administradores (membros veem a escala do evento, que mostra quem serve em cada etapa)                                                                                                 |
| Pedido de oração "Somente eu" (padrão) | **Só você.** Nem administradores nem o Criador da plataforma têm tela para ler                                                                                                                         |
| Pedido de oração "Equipe de oração"    | Você e as pessoas designadas para a equipe de oração da comunidade. Administradores só veem se estiverem na equipe                                                                                     |
| Pedido de oração "Comunidade"          | Você e todos os membros ativos da comunidade                                                                                                                                                           |
| Sugestão                               | Você e os organizadores e administradores. Se for **anônima**, ninguém da comunidade vê quem enviou; o sistema guarda a autoria para segurança (por exemplo, abuso), e ela não aparece em nenhuma tela |
| Denúncia                               | Os administradores da comunidade veem o conteúdo denunciado, o motivo e o detalhe, **sem saber quem denunciou**                                                                                        |
| Registro de auditoria da comunidade    | Administradores da comunidade                                                                                                                                                                          |
| Exportação (planilha) com contatos     | Só administradores podem gerar. Organizadores exportam sem contatos                                                                                                                                    |

Pessoas de **outra comunidade** não veem nada disso, mesmo que você participe das duas. O **Criador da plataforma** não tem acesso automático aos dados de uma comunidade: só age nela se tiver vínculo ou num "modo de intervenção" explícito (por exemplo, nomear um novo administrador), que fica registrado na auditoria e, para mudar algo, exige um motivo escrito. Mesmo assim, ele vê só nome, papel e situação das pessoas, nunca contatos, pedidos de oração ou notas.

## 7. Com quem compartilhamos

**Não vendemos, não alugamos e não cedemos seus dados.** Eles não são compartilhados com outras comunidades nem com outras igrejas.

Usamos poucos serviços de terceiros (subprocessadores), cada um só para uma tarefa. Esta é a lista completa:

| Serviço (empresa e país)                          | Para quê                                                                                                 | O que recebe                                                                                                                                               | Política                                                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Cloudflare (Cloudflare, Inc., EUA; rede global)   | Conexão segura entre a internet e o servidor, DNS e anti-robô na página pública de inscrição (Turnstile) | Todo o tráfego passa por ela, inclusive o endereço IP de quem acessa (seção 10). No Turnstile, sinais técnicos do navegador, sem nome, telefone nem e-mail | [Política](https://www.cloudflare.com/privacypolicy/), [Turnstile](https://www.cloudflare.com/turnstile-privacy-policy/) |
| Resend (Resend, Inc., EUA)                        | Envio de e-mail                                                                                          | Seu e-mail, primeiro nome e o texto do e-mail. Os e-mails **não** dizem o nome da comunidade nem da igreja. O Resend guarda os e-mails por 30 dias         | [Política](https://resend.com/legal/privacy-policy)                                                                      |
| Apple Push Notification service (Apple Inc., EUA) | Entregar notificações no iPhone                                                                          | Identificador do aparelho e o texto da notificação, que é curto, genérico e nunca contém pedido de oração                                                  | [Política](https://www.apple.com/br/legal/privacy/)                                                                      |
| Firebase Cloud Messaging (Google LLC, EUA)        | Entregar notificações no Android                                                                         | Identificador do aparelho e o texto da notificação, com as mesmas regras. Nenhum outro produto do Firebase é usado                                         | [Privacidade no Firebase](https://firebase.google.com/support/privacy)                                                   |
| Expo (650 Industries, Inc., EUA)                  | Gerar o aplicativo para as lojas                                                                         | **Nenhum dado seu.** Só o código do app                                                                                                                    | [Política](https://expo.dev/privacy)                                                                                     |

Nenhum serviço novo passa a receber dado seu sem antes entrar nesta lista (seção 16).

Também tratam dados, segundo as políticas deles e como controladores independentes:

- **Apple e Google, como lojas**, quando você baixa o app.
- **Google e Apple, como contas de acesso**, se você escolher "Entrar com Google" ou "Entrar com a Apple": eles ficam sabendo que você entrou no Uni Jovem, e nós recebemos deles só o identificador da sua conta e o e-mail (seção 3.1).
- **O app de mapas** que você escolher, quando toca em "Abrir no app de mapas": ele recebe o endereço do evento.

Podemos ter de entregar dados a autoridade pública quando a lei ou uma ordem judicial obrigar. Nesse caso entregamos só o exigido e, quando a lei permitir, avisamos você.

## 8. Transferência para fora do Brasil

O servidor, o banco de dados e as cópias de segurança ficam no Brasil. Alguns subprocessadores operam fora do país, principalmente nos Estados Unidos: a Cloudflare (rede global), o Resend, a Apple e o Google. Isso é transferência internacional de dados (LGPD, art. 33).

[REVISÃO JURÍDICA: definir o mecanismo de cada transferência. A Resolução CD/ANPD nº 19/2024 prevê cláusulas-padrão contratuais; verificar se os contratos e adendos de proteção de dados de Cloudflare, Resend, Apple e Google já incorporam as cláusulas-padrão da ANPD ou se outro mecanismo do art. 33 se aplica.]

## 9. Por quanto tempo guardamos

| Dado                                             | Por quanto tempo                                                                                                                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conta                                            | Enquanto você mantiver a conta. Ao excluí-la, os dados pessoais saem na hora (seção 11)                                                                                                                                                                       |
| Participação numa comunidade                     | Enquanto você estiver nela. Ao sair, seu histórico ali é desligado do seu nome na hora (vira "Pessoa removida") e só as contagens ficam. Se a administração remover você e não desfizer em 30 dias, acontece o mesmo                                          |
| Pedidos de oração                                | Até você apagar, sair da comunidade ou excluir a conta                                                                                                                                                                                                        |
| Disponibilidade por data                         | Apagada 6 meses depois da data                                                                                                                                                                                                                                |
| Inscrição pública em evento                      | Nome, WhatsApp e e-mail são apagados **90 dias depois do evento** (cada comunidade pode ajustar entre 30 e 365 dias). Fica só a contagem. Você pode apagar antes pelo link de cancelamento                                                                    |
| Presença avulsa (nome digitado pelo organizador) | Mesmo prazo da inscrição pública                                                                                                                                                                                                                              |
| Sessões e aparelhos                              | Saem sozinhas após **90 dias sem uso** (e nunca duram mais de 365 dias); o registro é apagado 30 dias depois                                                                                                                                                  |
| Identificador de notificação do aparelho         | Apagado quando a sessão daquele aparelho termina ou quando a Apple ou o Google o recusam                                                                                                                                                                      |
| Registro das notificações enviadas               | 30 dias                                                                                                                                                                                                                                                       |
| Códigos de verificação e links temporários       | Valem de 5 a 30 minutos e são apagados até 24 horas depois de vencer ou ser usados                                                                                                                                                                            |
| E-mail de convite                                | Apagado 30 dias depois que o convite vence, é usado ou revogado                                                                                                                                                                                               |
| Planilhas exportadas no servidor                 | **24 horas**                                                                                                                                                                                                                                                  |
| Denúncias                                        | Enquanto a comunidade existir no Uni Jovem                                                                                                                                                                                                                    |
| Registro dos consentimentos                      | Enquanto a conta ou a inscrição existir e, depois da revogação, por **2 anos**, como prova do que foi aceito [IMPLEMENTAÇÃO: o expurgo automático dos consentimentos revogados há 2 anos não existe; o primeiro vence em 15/11/2028]                          |
| Auditoria (sem conteúdo, com IP truncado)        | **2 anos** [IMPLEMENTAÇÃO: o expurgo automático da auditoria com mais de 2 anos não existe; nenhuma linha completa 2 anos antes de 15/11/2028]                                                                                                                |
| Registros técnicos do servidor                   | Arquivos rotativos de tamanho limitado: os mais antigos são apagados sozinhos quando o limite é atingido. Não guardam e-mail, telefone, token, senha nem conteúdo                                                                                             |
| Cópias de segurança                              | Até cerca de **100 dias** (7 diárias, 4 semanais e 3 mensais), guardadas no próprio servidor, com acesso restrito. Os pedidos de oração continuam cifrados dentro delas                                                                                       |
| E-mails no serviço de envio                      | 30 dias, no Resend                                                                                                                                                                                                                                            |
| Comunidade excluída                              | Apagada depois de 30 dias de carência; só a auditoria, sem dado pessoal identificável, fica até completar 2 anos [IMPLEMENTAÇÃO: a exclusão de comunidade só marca "exclusão agendada" com a data; não existe a rotina que apaga os dados ao fim da carência] |

[REVISÃO JURÍDICA: o Marco Civil da Internet (art. 15) exige guarda de registros de acesso a aplicação por 6 meses para provedor constituído como pessoa jurídica com fins econômicos. O operador hoje é pessoa física e o app é gratuito; confirmar se a obrigação se aplica. Se aplicar, os registros técnicos (hoje rotativos por tamanho e com IP truncado) precisam mudar.]

## 10. Segurança e os limites que preferimos dizer

O que fazemos:

- Cada comunidade é isolada em duas camadas independentes: no código e no próprio banco de dados.
- Senhas com argon2id; sessões curtas renovadas com detecção de roubo; segundo fator disponível; Face ID ou biometria do Android para abrir a sessão guardada, se você quiser.
- Pedidos de oração **cifrados no servidor** (AES-256-GCM), com a chave guardada fora do banco: uma cópia do banco ou de um backup não mostra o texto.
- Pedidos de oração nunca aparecem em notificação, em registro técnico, em auditoria nem no armazenamento offline do aparelho.
- Notificações aparecem na tela bloqueada com texto genérico.
- Fotos de perfil regravadas sem metadados e entregues só a quem está ativo na mesma comunidade.
- Registros técnicos sem senha, token, cookie, corpo das requisições, e-mail nem telefone, e com o IP truncado.
- Para excluir a conta, o app pede de novo a senha (e o código do autenticador, se estiver ligado).

Os limites, ditos com honestidade:

1. **A cifragem dos pedidos de oração não é de ponta a ponta.** Quem administra o servidor e guarda a chave tem capacidade técnica de decifrar. Hoje essa pessoa é o operador da plataforma, que também é o Criador. A garantia de que "o Criador não lê" vale para o app e suas telas, não contra quem controla a infraestrutura. Por isso pedimos que você escreva só o necessário.
2. **A Cloudflare vê o tráfego.** A conexão segura (HTTPS) termina na Cloudflare, que repassa a requisição ao servidor por um túnel cifrado. Na passagem, o conteúdo das requisições, inclusive o texto de um pedido de oração que você está enviando, fica acessível à infraestrutura da Cloudflare.
3. **Aparelho sem internet não recebe revogação.** Se você sair de uma comunidade ou for removido enquanto um celular com o evento preparado está offline, o que já foi baixado continua legível nele até a próxima conexão ou até vencer (7 dias, ou o prazo da comunidade, até 30).
4. **Planilhas baixadas saem do nosso controle.** Uma exportação feita por organizador ou administrador fica 24 horas no servidor, mas a cópia baixada fica no aparelho dele; a comunidade é responsável por ela.
5. **O servidor é doméstico**, sem garantia de disponibilidade contínua, e hoje as cópias de segurança ficam no mesmo servidor, sem cópia externa.

## 11. Seus direitos e como exercer

A LGPD (art. 18) garante a você os direitos abaixo. A maioria você exerce sozinho, no app, em **Perfil**.

| Direito                                                    | Como exercer                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Saber se tratamos seus dados e acessá-los                  | **Perfil > Privacidade e dados > Exportar meus dados**: o app gera na hora um arquivo com tudo o que é seu, inclusive seus pedidos de oração sem cifragem. Só você pode gerar o seu                                                                                                                                                                    |
| Corrigir dados                                             | **Perfil > Conta**: nome e WhatsApp. Para trocar o e-mail, fale com o encarregado                                                                                                                                                                                                                                                                      |
| Portabilidade                                              | O mesmo arquivo de exportação, em formato aberto (JSON)                                                                                                                                                                                                                                                                                                |
| Apagar dados                                               | Apague um pedido de oração na própria tela; saia de uma comunidade na aba **Equipe** ("Sair de" e o nome da comunidade); ou exclua a conta em **Perfil > Privacidade e dados > Excluir minha conta**. Para apagar uma sugestão, peça à organização da comunidade ou ao encarregado. Sem o app: [unijovem.solerte.com.br/excluir-conta](/excluir-conta) |
| Revogar consentimento                                      | Sair da comunidade (revoga o daquela comunidade) ou excluir a conta (revoga todos). Notificações: **Perfil > Notificações** ou os ajustes do aparelho. Google ou Apple: **Perfil > Segurança > Contas conectadas**                                                                                                                                     |
| Saber com quem compartilhamos                              | Seção 7                                                                                                                                                                                                                                                                                                                                                |
| Anonimização, bloqueio ou eliminação de dado desnecessário | Fale com o encarregado                                                                                                                                                                                                                                                                                                                                 |
| Opor-se a um tratamento                                    | Fale com o encarregado                                                                                                                                                                                                                                                                                                                                 |
| Revisão de decisão automatizada                            | O Uni Jovem não toma decisões automatizadas sobre você                                                                                                                                                                                                                                                                                                 |
| Pedidos sobre inscrição pública                            | Pelo link de cancelamento recebido na inscrição, que tem a opção "Cancelar e apagar meus dados agora", ou com o encarregado                                                                                                                                                                                                                            |
| Reclamar à autoridade                                      | Agência Nacional de Proteção de Dados (ANPD), em [gov.br/anpd](https://www.gov.br/anpd)                                                                                                                                                                                                                                                                |

O encarregado atende pelo e-mail [contact@solerte.com.br](mailto:contact@solerte.com.br). Pedidos feitos a ele são respondidos em até **15 dias**. Podemos pedir uma confirmação de identidade (por exemplo, responder do e-mail da conta) para não entregar seus dados a outra pessoa.

Quando o pedido é sobre dados **da comunidade** (por exemplo, o histórico de escalas), nós o encaminhamos aos administradores dela, que são os controladores, e acompanhamos a resposta.

## 12. Crianças e adolescentes

O público do Uni Jovem é jovem, então as regras são estas:

- **Conta só a partir de 16 anos.** Ao criar a conta, a pessoa escolhe a faixa de idade; quem marca "menos de 16" não consegue criar a conta, e nada do que digitou é gravado. Comunidades não devem convidar menores de 16.
- **De 16 a 17 anos:** a pessoa declara a idade e confirma que o pai, a mãe ou o responsável legal **sabe e concorda** com o uso do Uni Jovem e com o consentimento sobre a fé. Guardamos só essa confirmação e a faixa de idade, nunca a data de nascimento.
- **Inscrição pública em evento de quem tem menos de 16 anos:** precisa ser feita pelo pai, pela mãe ou pelo responsável, que informa o próprio WhatsApp como contato e confirma isso no formulário.
- Para todos, inclusive adolescentes, valem por padrão as opções mais protetoras: pedido de oração em "Somente eu", nenhum perfil público, nenhuma mensagem direta entre pessoas, nenhum anúncio, nenhuma recomendação automática e nenhuma localização do aparelho. A faixa de idade não aparece para ninguém da comunidade.
- Qualquer pessoa da comunidade pode **denunciar** um pedido de oração visível à comunidade, uma sugestão ou um aviso. A denúncia vai para os administradores da comunidade, que podem retirar o conteúdo.

**Por que 16 anos.** Abaixo de 16 anos, a lei civil exige que a pessoa seja representada pelos pais ou responsáveis nos atos da vida civil (Código Civil, art. 3º), então o consentimento dela sozinha sobre um dado sensível, como a fé, seria frágil. Além disso, o Uni Jovem não tem ferramentas de supervisão parental nem de vínculo com a conta de um responsável, que o Estatuto Digital da Criança e do Adolescente (Lei nº 15.211/2025, em vigor desde 17/03/2026) prevê para públicos mais novos. Entre 16 e 17 anos a pessoa é relativamente incapaz e age assistida (Código Civil, art. 4º, I), por isso pedimos a ciência e a concordância do responsável. A LGPD (art. 14) exige que todo tratamento de dados de criança e adolescente atenda ao seu melhor interesse; é o que guia as configurações padrão acima.

**Para pais e responsáveis.** Vocês podem pedir informações sobre os dados de um adolescente, pedir a exclusão da conta dele ou comunicar qualquer violação aos direitos de crianças e adolescentes no Uni Jovem pelo e-mail [contact@solerte.com.br](mailto:contact@solerte.com.br). Conteúdo que viole esses direitos é retirado assim que soubermos, sem esperar ordem judicial.

Se soubermos que uma conta pertence a alguém com menos de 16 anos, ela será encerrada e os dados apagados, com aviso à comunidade.

[REVISÃO JURÍDICA: (1) confirmar se a combinação "convite feito pela liderança da comunidade, que conhece a pessoa pessoalmente, mais autodeclaração" é mecanismo de aferição de idade proporcional, à luz da Lei nº 15.211/2025, do Decreto nº 12.880/2026 (art. 24, I) e das orientações preliminares da ANPD sobre aferição de idade (março de 2026), que consideram a autodeclaração isolada pouco confiável; (2) confirmar se a "ciência e concordância do responsável" declarada pelo próprio adolescente basta para 16 e 17 anos, ou se é preciso coletar o consentimento do responsável diretamente; (3) confirmar se o Uni Jovem é produto "direcionado" ou "de acesso provável" (art. 1º, parágrafo único, e guia da ANPD de 28/10/2026) e se o art. 24 (vínculo de contas "de até 16 anos" a um responsável) alcança um serviço que não é rede social; se alcançar e "até 16 anos" incluir quem tem 16, a idade mínima precisa subir para 17 ou o vínculo precisa existir; (4) confirmar a inscrição de menores de 16 pelo responsável na página pública, inclusive menores de 12 (art. 14, § 1º e § 5º, da LGPD); (5) confirmar o procedimento de retirada de conteúdo e de notificação dos arts. 28 a 33 da Lei nº 15.211/2025 para o porte do Uni Jovem (art. 39).]

## 13. Permissões do aparelho

| Permissão                         | Quando pedimos                                                                      | Se você negar                                    |
| --------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| Câmera                            | Só quando você toca em "Ler QR Code" para marcar presença                           | O check-in continua possível pela busca por nome |
| Notificações                      | Depois de explicar o benefício, nunca na primeira abertura                          | Você vê tudo no Início do app; nada se perde     |
| Face ID (ou biometria do Android) | Só se você escolher usar a biometria para abrir a sessão, em **Perfil > Segurança** | Você entra com e-mail e senha, como sempre       |

O app não pede localização, contatos, galeria de fotos nem microfone.

## 14. Cookies e armazenamento no navegador

Na web, usamos só o essencial: um cookie de sessão protegido (`HttpOnly`, `Secure`, `SameSite=Strict`) para manter você conectado, e o armazenamento local do navegador para lembrar a última comunidade aberta e algumas preferências de interface. Nas páginas públicas de inscrição, o serviço anti-robô da Cloudflare (Turnstile) analisa sinais técnicos do navegador. Não usamos cookies de publicidade nem de análise de uso.

## 15. Incidentes de segurança

Se acontecer um incidente de segurança que possa causar risco ou dano relevante a você, comunicamos a ANPD e as pessoas afetadas em até **3 dias úteis** a partir de quando soubermos que dados pessoais foram afetados (Resolução CD/ANPD nº 15/2024), dizendo o que aconteceu, quais dados, os riscos e o que estamos fazendo. Quando o incidente envolver dados de uma comunidade, avisamos também os administradores dela.

[REVISÃO JURÍDICA: quando o incidente afeta dados de que a comunidade é controladora, a comunicação à ANPD é dever dela, com apoio do operador. Confirmar a divisão e o prazo do aviso do operador à comunidade, e prever no acordo com as comunidades.]

## 16. Mudanças nesta política

Quando esta política mudar, a nova versão aparece em [unijovem.solerte.com.br/privacidade](/privacidade) com a data. Se a mudança for relevante (nova finalidade, novo tipo de dado, novo subprocessador que receba dado seu), avisamos no app antes de ela valer e, quando a mudança depender de consentimento, pedimos de novo. As versões anteriores podem ser pedidas ao encarregado.

## 17. Contato

- Encarregado (DPO): Rafael Gomes, [contact@solerte.com.br](mailto:contact@solerte.com.br)
- Operador da plataforma: Rafael Gomes, pessoa física, [contact@solerte.com.br](mailto:contact@solerte.com.br)
- Suporte: [unijovem.solerte.com.br/suporte](/suporte)
- Autoridade: ANPD, [gov.br/anpd](https://www.gov.br/anpd)

---

## Anexo (não publicar): notas consolidadas para a revisão jurídica

1. Divisão de papéis: comunidade controladora, plataforma operadora dos dados da comunidade e controladora dos dados de conta e segurança. Quem é a controladora quando a comunidade não tem personalidade jurídica; risco de controladoria conjunta; contrato do art. 39 (seção 2).
2. Consentimento (art. 11, I) como base do tratamento ligado à convicção religiosa e como condição do serviço (art. 9º, § 3º) (seção 4).
3. Art. 11, II, "g" e "d" para segurança e auditoria; base da foto de perfil e das denúncias (seção 5).
4. Mecanismo de transferência internacional para cada subprocessador (Resolução CD/ANPD nº 19/2024) (seção 8).
5. Aplicabilidade do art. 15 do Marco Civil a operador pessoa física e app gratuito (seção 9).
6. Idade mínima de 16, ciência do responsável para 16 e 17, inscrição pública de menores pelo responsável, enquadramento na Lei nº 15.211/2025, no Decreto nº 12.880/2026 e no guia da ANPD de 28/10/2026, alcance do art. 24 (seção 12).
7. Encarregado: obrigatoriedade e forma de indicação; suficiência de nome e e-mail como identificação do controlador pessoa física (decisão do dono de não publicar CPF nem endereço) (seção 2).
8. Divisão do dever de comunicar incidente entre comunidade e operador (seção 15).
9. Necessidade de Relatório de Impacto à Proteção de Dados (RIPD, art. 38) por envolver dado sensível de adolescentes, e da avaliação de impacto à segurança e à saúde de crianças e adolescentes do art. 47 do Decreto nº 12.880/2026: recomendamos um documento simplificado que cubra os dois.
10. Dados de terceiros em pedidos de oração (saúde de familiares) (seção 4).

**Trechos com `[IMPLEMENTAÇÃO]` mantidos (exigência legal de declarar e cumprir o prazo de retenção, LGPD arts. 9º, II, 15 e 16), em 15/11/2026:**

- Seção 9, registro dos consentimentos: falta o expurgo dos revogados há 2 anos (primeiro vencimento em 15/11/2028).
- Seção 9, auditoria: falta o expurgo das linhas com mais de 2 anos (primeiro vencimento em 15/11/2028).
- Seção 9, comunidade excluída: falta a rotina que apaga os dados da comunidade ao fim dos 30 dias de carência. Só o Criador agenda exclusão; até a rotina existir, não agendar nenhuma.

**Promessas da versão 0.1 retiradas porque o código não as cumpre:** anonimização de conta sem acesso há 24 meses; IP completo por 30 dias nos registros técnicos (hoje o IP já sai truncado, mas a rotação é por tamanho, não por 30 dias); cópias de segurança cifradas e cópia externa no Cloudflare R2 (PH-05 aberta; o `pg_dump` é guardado sem cifragem no Mac); exportação que fica disponível por 24 horas (a exportação real é gerada e baixada na hora); apagar a própria sugestão (só organizadores apagam); versões anteriores da política no mesmo endereço.
