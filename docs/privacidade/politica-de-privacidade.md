# Política de Privacidade do Uni Jovem

> **Rascunho para revisão jurídica, sem validade até a revisão.**
> Versão 0.1, escrita em 14/11/2026. Não publicar em `/privacidade` nem nas lojas antes da revisão (PH-11).
> Os trechos `[PREENCHER: ...]` dependem do dono. Os trechos `[REVISÃO JURÍDICA: ...]` são dúvidas para o advogado e saem do texto publicado. Os trechos `[IMPLEMENTAÇÃO: ...]` descrevem algo que o texto promete e o código ainda não faz em 14/11/2026: ou o código passa a fazer antes da publicação, ou o trecho sai.

Esta política explica, em linguagem direta, quais dados o Uni Jovem guarda, por quê, quem vê, por quanto tempo e como você controla tudo isso. Ela vale para o aplicativo (iPhone, Android e web) e para as páginas públicas de eventos em `https://unijovem.solerte.com.br`.

## 1. Resumo em um minuto

- O Uni Jovem organiza a vida de comunidades jovens de igreja: eventos, escalas, presença, avisos, sugestões e pedidos de oração.
- Só entra quem é convidado. Cada comunidade é separada das outras: ninguém de uma comunidade vê dados de outra.
- Participar de uma comunidade de igreja pode revelar a sua **fé**. A lei trata isso como dado sensível, então pedimos o seu **consentimento específico** antes de você entrar em cada comunidade.
- **Não vendemos dados, não mostramos anúncios e não usamos ferramentas de rastreamento ou de análise de comportamento.**
- Pedidos de oração são guardados cifrados e, por padrão, só você vê. Mas isso **não é criptografia de ponta a ponta** (explicamos o limite na seção 10).
- Você pode ver, corrigir, baixar e apagar seus dados pelo próprio app, em **Perfil**.
- É preciso ter **16 anos ou mais** para ter uma conta. Quem tem 16 ou 17 anos precisa que o pai, a mãe ou o responsável saiba e concorde (seção 12).

## 2. Quem cuida dos seus dados

O Uni Jovem tem dois tipos de responsável, porque há dois tipos de dado.

| Quem                                                                                                                                           | Papel na lei (LGPD)                                                                                                                        | Sobre quais dados                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A sua comunidade** (a igreja ou o ministério jovem que convidou você, representado pelos administradores dela no app)                        | **Controladora**: decide para que os dados da comunidade são usados                                                                        | Tudo o que existe dentro da comunidade: sua participação, escalas, presença, inscrições, avisos, sugestões, pedidos de oração, conteúdos                                     |
| **O operador da plataforma**: [PREENCHER: nome completo ou razão social], [PREENCHER: CPF ou CNPJ], [PREENCHER: endereço para correspondência] | **Operador** dos dados da comunidade (trata em nome dela e segundo as instruções dela) e **controlador** dos dados da conta e da segurança | Operador: os dados da comunidade. Controlador: sua conta (nome, e-mail, WhatsApp, senha), sessões, aparelhos, autenticação em dois fatores, registros de segurança e backups |

**Encarregado pelo tratamento de dados (DPO):** [PREENCHER: nome do encarregado], e-mail [PREENCHER: e-mail do encarregado]. É com ele que você fala sobre qualquer assunto desta política, inclusive se não conseguir resolver algo pelo app.

[REVISÃO JURÍDICA: confirmar a divisão controladora (comunidade) e operador/controlador (plataforma). Pontos em aberto: (1) quando a "comunidade" é um grupo jovem sem personalidade jurídica, a controladora é a igreja (organização religiosa, pessoa jurídica) ou o líder como pessoa natural? (2) Há risco de a relação ser lida como controladoria conjunta, já que a plataforma define meios essenciais (prazos de retenção padrão, regras de visibilidade)? (3) A relação precisa de contrato escrito entre plataforma e cada comunidade (art. 39); o rascunho dessas obrigações está na seção 9 dos Termos de Uso, mas talvez deva ser um acordo separado aceito pelo administrador.]

[REVISÃO JURÍDICA: a Resolução CD/ANPD nº 2/2022 dispensa agentes de pequeno porte de indicar encarregado, mas a dispensa não vale para tratamento de alto risco, e aqui há dado sensível e dados de adolescentes. Decidimos indicar encarregado de qualquer forma; confirmar a forma de indicação e publicação conforme a Resolução CD/ANPD nº 18/2024.]

## 3. Quais dados guardamos

Guardamos só o necessário para o app funcionar. A lista abaixo é completa: se um dado não está aqui, o Uni Jovem não o coleta.

### 3.1 Sua conta

| Dado                                                                                                   | De onde vem                                                                                                        | Obrigatório? |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------ |
| Nome                                                                                                   | Você informa ao aceitar o convite                                                                                  | Sim          |
| E-mail (verificado por código)                                                                         | Você informa                                                                                                       | Sim          |
| WhatsApp                                                                                               | Você informa                                                                                                       | Não          |
| Senha                                                                                                  | Você cria. Guardamos só uma "impressão" irreversível (hash argon2id), nunca a senha                                | Sim          |
| Faixa de idade declarada (18 anos ou mais, ou 16 a 17 anos com ciência do responsável)                 | Você declara ao criar a conta. **Não pedimos data de nascimento.** [IMPLEMENTAÇÃO: campo e tela ainda não existem] | Sim          |
| Registro dos seus consentimentos (o que você aceitou, quando, em qual versão do texto e por qual tela) | Gerado quando você aceita [IMPLEMENTAÇÃO: registro ainda não existe para contas]                                   | Sim          |
| Autenticação em dois fatores (opcional; obrigatória para o Criador da plataforma)                      | Segredo do aplicativo autenticador, guardado cifrado; códigos de recuperação guardados só como hash                | Não          |

### 3.2 Segurança e acesso

| Dado                                                                                                                                                                              | Para quê                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessões: modelo do aparelho (por exemplo, "iPhone 15"; nunca o nome que você deu ao aparelho), sistema (iOS, Android ou web), datas de criação, último uso, expiração e revogação | Manter você conectado, mostrar a lista "Aparelhos conectados" e permitir desconectar um aparelho                                                                          |
| Contagem de falhas de login e de segundo fator, bloqueios temporários                                                                                                             | Impedir que alguém adivinhe sua senha                                                                                                                                     |
| Endereço IP **truncado** (o último bloco é zerado, por exemplo `200.150.10.0`) nos registros de auditoria                                                                         | Investigar abuso sem guardar o endereço exato                                                                                                                             |
| Endereço IP completo nos registros técnicos do servidor, por até 30 dias                                                                                                          | Diagnóstico e segurança [IMPLEMENTAÇÃO: hoje o registro técnico grava o IP completo; a decisão é truncá-lo também ali, e a rotação de 30 dias ainda não está configurada] |
| Códigos e links temporários (verificação de e-mail, redefinição de senha)                                                                                                         | Guardados só como hash, valem de 10 a 30 minutos                                                                                                                          |

### 3.3 Sua participação na comunidade

- Vínculo com cada comunidade: papel (membro, organizador ou administrador), situação (ativo, desativado, removido), designação para a equipe de oração, data de entrada.
- Escalas: em que etapa você serve, se confirmou, se pediu substituição (com um motivo opcional que você escreve) e quem assumiu.
- Disponibilidade por data, com observação opcional.
- Tarefas, materiais e itens de checklist pelos quais você é responsável ou que você marcou.
- Inscrições em eventos e presença (quando e como foi registrada).
- Comandos que você deu na tela "Ao vivo", quando conduz um evento.

### 3.4 O que você escreve

- **Pedidos de oração**: o texto (cifrado), a visibilidade escolhida, se foi marcado como respondido, e quem clicou "estou orando".
- **Sugestões**: título, texto, se é anônima, situação e resposta.
- Se você é organizador ou administrador: avisos, notas internas de evento, eventos, etapas, modelos, conteúdos (músicas, músicos, palestrantes, dinâmicas), locais e anexos por link.

### 3.5 Inscrição pública em evento (sem conta)

Quem se inscreve pela página pública de um evento **não cria conta**. Guardamos: nome, WhatsApp, e-mail (opcional), situação da inscrição (confirmada, lista de espera, cancelada), um código de presença aleatório (o QR Code, que não contém dado pessoal), a data do consentimento e uma impressão (hash) do link de cancelamento.

### 3.6 Pessoas cadastradas por organizadores

Organizadores podem registrar o nome de músicos, palestrantes e de quem chegou a um evento sem inscrição (presença avulsa). Nesses casos o dado é informado por eles, e a comunidade é responsável por ter motivo para isso.

### 3.7 No seu aparelho

- O token que mantém você conectado fica no cofre do sistema (Keychain no iPhone, Keystore no Android). Na web, fica num cookie protegido que o JavaScript da página não consegue ler. **Sua senha nunca é guardada no aparelho.**
- A comunidade que você abriu por último.
- Quando um organizador prepara um evento para uso sem internet: a programação, a escala, os checklists e a lista de inscritos (com nome e telefone mascarado), num banco local **cifrado**, que vence em até 14 dias sem contato com o servidor (o prazo pode ser ajustado pela comunidade entre 3 e 30 dias) e é apagado ao sair da conta ou da comunidade. [IMPLEMENTAÇÃO: o modo offline é da fase F13 e ainda não existe]
- Os versículos do dia já agendados como notificação local. Isso acontece só no aparelho: nada sobre o versículo é enviado ao servidor.
- **Pedidos de oração nunca ficam guardados no aparelho para uso offline.**

### 3.8 Notificações

Se você permitir notificações: o identificador de notificação do aparelho (fornecido pela Apple ou pelo Google) e suas preferências por tipo e por comunidade. [IMPLEMENTAÇÃO: notificações são da fase F14 e ainda não existem no código]

### 3.9 O que o Uni Jovem **não** coleta

Localização do seu aparelho, contatos da sua agenda, fotos, microfone, CPF, data de nascimento, dados de pagamento, identificador de publicidade, histórico de navegação, e qualquer ferramenta de análise de uso ou rastreamento. A câmera é usada só para ler o QR Code de presença, e nenhuma foto é tirada nem guardada. O endereço e o pino no mapa que aparecem num evento são do **local** do evento, não seus.

## 4. Dado sensível: sua fé (e o que você escreve na oração)

Pela LGPD (art. 5º, II), dado que revela **convicção religiosa** ou filiação a organização religiosa é dado pessoal sensível. Fazer parte de uma comunidade de igreja no Uni Jovem revela isso. Por isso:

- Pedimos o seu **consentimento específico e destacado** (art. 11, I) ao entrar em **cada** comunidade, numa tela própria, separada dos Termos de Uso, com caixa que começa desmarcada.
- Quem se inscreve pela página pública de um evento também dá esse consentimento, no próprio formulário.
- Esse consentimento é **condição** para participar da comunidade: sem ele, o app não tem como funcionar para você naquela comunidade (art. 9º, § 3º). Você pode **revogá-lo a qualquer momento**, com o mesmo esforço com que deu: saindo da comunidade ou excluindo sua conta (seção 11). A revogação não desfaz o que foi feito antes dela.

Pedidos de oração podem conter outros dados sensíveis, como informação de saúde, e às vezes dados de **outras pessoas** ("orem pela minha mãe, que está internada"). Pedimos que você escreva só o necessário e evite nomes e detalhes de terceiros sem a permissão deles.

[REVISÃO JURÍDICA: (1) confirmar o consentimento (art. 11, I) como base para o tratamento ligado à convicção religiosa, já que a LGPD não tem exceção equivalente à do GDPR para membros de organização religiosa (art. 9º, 2, d, do GDPR). (2) Avaliar se o consentimento como condição do serviço atende ao art. 9º, § 3º, com o destaque proposto. (3) Avaliar dados de terceiros em pedidos de oração (saúde de familiares).]

## 5. Para que usamos e com qual base legal

| Finalidade                                                                                                           | Dados usados                                                         | Base legal (LGPD)                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Criar e manter sua conta, deixar você entrar e sair                                                                  | Conta, sessões                                                       | Execução do contrato, os Termos de Uso (art. 7º, V)                                                                                             |
| Fazer você participar da comunidade (escalas, eventos, presença, avisos, sugestões, conteúdos)                       | Participação, o que você escreve                                     | Consentimento específico (art. 11, I), por envolver convicção religiosa                                                                         |
| Publicar e mostrar seus pedidos de oração a quem você escolheu                                                       | Pedido de oração                                                     | Consentimento específico (art. 11, I), dado na hora de escolher a visibilidade                                                                  |
| Proteger sua conta: senha, segundo fator, bloqueio de tentativas, alerta de segurança por e-mail, registros técnicos | Segurança e acesso                                                   | Prevenção à fraude e segurança do titular em autenticação (art. 11, II, "g"); para a parte que não é sensível, legítimo interesse (art. 7º, IX) |
| Manter uma trilha de auditoria de ações importantes (quem mudou o quê, sem conteúdo)                                 | Auditoria                                                            | Prevenção à fraude e segurança (art. 11, II, "g") e exercício regular de direitos (art. 11, II, "d")                                            |
| Inscrição pública em evento                                                                                          | Inscrição pública                                                    | Consentimento específico (art. 11, I)                                                                                                           |
| Barrar robôs na página pública de inscrição                                                                          | Sinais técnicos do navegador, analisados pela Cloudflare (Turnstile) | Legítimo interesse (art. 7º, IX)                                                                                                                |
| Enviar e-mails essenciais (código de verificação, convite, redefinição de senha, alerta de segurança)                | E-mail, primeiro nome                                                | Execução do contrato (art. 7º, V)                                                                                                               |
| Enviar notificações que você ligou                                                                                   | Identificador do aparelho, preferências                              | Execução do contrato (art. 7º, V); a permissão do sistema é pedida antes e pode ser desligada                                                   |
| Relatórios da comunidade (presença, escalas, inscrições)                                                             | Participação                                                         | Consentimento específico (art. 11, I), na mesma finalidade de organizar a comunidade                                                            |
| Atender pedidos seus como titular                                                                                    | O que for necessário para o pedido                                   | Cumprimento de obrigação legal (art. 7º, II)                                                                                                    |

Não usamos seus dados para publicidade, para traçar perfil de comportamento, para decisões automatizadas sobre você nem para treinar inteligência artificial.

[REVISÃO JURÍDICA: confirmar o enquadramento da segurança da conta e da auditoria no art. 11, II, "g" e "d", em vez de consentimento, já que elas também tocam no vínculo religioso. Confirmar o legítimo interesse do Turnstile e se cabe teste de balanceamento documentado (art. 10).]

## 6. Quem vê o quê dentro da comunidade

| Informação                             | Quem vê                                                                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Seu nome e seu papel                   | Todos os membros ativos da mesma comunidade                                                                                                                                                            |
| Seu e-mail e WhatsApp                  | Organizadores e administradores da mesma comunidade                                                                                                                                                    |
| Suas escalas, presença e inscrições    | Organizadores e administradores (membros veem a escala do evento, que mostra quem serve em cada etapa)                                                                                                 |
| Pedido de oração "Somente eu" (padrão) | **Só você.** Nem administradores nem o Criador da plataforma têm tela para ler                                                                                                                         |
| Pedido de oração "Equipe de oração"    | Você e as pessoas designadas para a equipe de oração da comunidade. Administradores só veem se estiverem na equipe                                                                                     |
| Pedido de oração "Comunidade"          | Você e todos os membros ativos da comunidade                                                                                                                                                           |
| Sugestão                               | Você e os organizadores e administradores. Se for **anônima**, ninguém da comunidade vê quem enviou; o sistema guarda a autoria para segurança (por exemplo, abuso), e ela não aparece em nenhuma tela |
| Registro de auditoria da comunidade    | Administradores da comunidade                                                                                                                                                                          |
| Exportação (planilha) com contatos     | Só administradores podem gerar. Organizadores exportam sem contatos                                                                                                                                    |

Pessoas de **outra comunidade** não veem nada disso, mesmo que você participe das duas. O **Criador da plataforma** não tem acesso automático aos dados de uma comunidade: só age nela se tiver vínculo ou num "modo de intervenção" explícito (por exemplo, nomear um novo administrador), com motivo obrigatório e registro em auditoria, e mesmo assim sem acesso a pedidos de oração e notas privadas.

## 7. Com quem compartilhamos

**Não vendemos, não alugamos e não cedemos seus dados.** Eles não são compartilhados com outras comunidades nem com outras igrejas.

Usamos poucos serviços de terceiros (subprocessadores), cada um só para uma tarefa:

| Serviço                           | Para quê                                                                                                            | O que recebe                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Cloudflare                        | Conexão segura entre a internet e o servidor, DNS, anti-robô na página pública, cópia de segurança fora do servidor | Todo o tráfego passa por ela (seção 10); na cópia de segurança, só arquivos já cifrados por nós            |
| Resend                            | Envio de e-mail                                                                                                     | Seu e-mail, primeiro nome e o texto do e-mail. Os e-mails **não** dizem o nome da comunidade nem da igreja |
| Apple (APNs)                      | Entregar notificações no iPhone                                                                                     | Identificador do aparelho e o texto da notificação, que é genérico para assuntos sensíveis                 |
| Google (Firebase Cloud Messaging) | Entregar notificações no Android                                                                                    | Idem                                                                                                       |
| Expo                              | Gerar o aplicativo para as lojas                                                                                    | **Nenhum dado seu.** Só o código do app                                                                    |

A lista completa, com país e link da política de cada um, está em `subprocessadores.md` [PREENCHER: publicar como página, por exemplo `/privacidade/subprocessadores`].

A Apple e o Google também tratam dados quando você baixa o app nas lojas, segundo as políticas deles, como controladores independentes. Ao tocar em "Abrir no app de mapas", o endereço do evento é entregue ao app de mapas que você escolher.

Podemos ter de entregar dados a autoridade pública quando a lei ou uma ordem judicial obrigar. Nesse caso entregamos só o exigido e, quando a lei permitir, avisamos você.

## 8. Transferência para fora do Brasil

O servidor e o banco de dados ficam no Brasil. Alguns subprocessadores operam fora do país, principalmente nos Estados Unidos: a Cloudflare (rede global), o Resend, a Apple e o Google. Isso é transferência internacional de dados (LGPD, art. 33).

[REVISÃO JURÍDICA: definir o mecanismo de cada transferência. A Resolução CD/ANPD nº 19/2024 prevê cláusulas-padrão contratuais; verificar se os contratos e adendos de proteção de dados de Cloudflare, Resend, Apple e Google já incorporam as cláusulas-padrão da ANPD ou se outro mecanismo do art. 33 se aplica. Verificar também se a cópia de segurança cifrada no Cloudflare R2, cuja chave a Cloudflare não tem, conta como transferência.]

## 9. Por quanto tempo guardamos

| Dado                                             | Por quanto tempo                                                                                                                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conta                                            | Enquanto você mantiver a conta. Conta sem nenhum acesso por **24 meses** recebe aviso por e-mail e, se continuar sem acesso por mais 30 dias, é anonimizada [IMPLEMENTAÇÃO: rotina ainda não existe] |
| Participação numa comunidade                     | Enquanto você estiver nela. Ao sair, seu histórico ali é desligado do seu nome (vira "Pessoa removida") e só as contagens ficam (detalhes em `exclusao-de-conta.md`)                                 |
| Pedidos de oração                                | Até você apagar, sair da comunidade ou excluir a conta                                                                                                                                               |
| Disponibilidade por data                         | Apagada 6 meses depois da data                                                                                                                                                                       |
| Inscrição pública em evento                      | Nome, WhatsApp e e-mail são apagados **90 dias depois do evento** (cada comunidade pode ajustar entre 30 e 365 dias). Fica só a contagem                                                             |
| Presença avulsa (nome digitado pelo organizador) | Mesmo prazo da inscrição pública                                                                                                                                                                     |
| Sessões e aparelhos                              | Saem sozinhas após **90 dias sem uso** (e nunca duram mais de 365 dias); o registro é apagado 30 dias depois                                                                                         |
| Códigos de verificação e links de senha          | Valem de 10 a 30 minutos e são apagados em até 24 horas                                                                                                                                              |
| E-mail de convite                                | Apagado 30 dias depois que o convite vence, é usado ou revogado                                                                                                                                      |
| Planilhas exportadas no servidor                 | **24 horas**                                                                                                                                                                                         |
| Auditoria (sem conteúdo, com IP truncado)        | **2 anos**                                                                                                                                                                                           |
| Registros técnicos do servidor                   | **30 dias**                                                                                                                                                                                          |
| Cópias de segurança (cifradas)                   | Até cerca de **100 dias** (7 diárias, 4 semanais e 3 mensais)                                                                                                                                        |
| Comunidade excluída                              | Apagada depois de 30 dias de carência; só a auditoria, sem dado pessoal identificável, fica até completar 2 anos                                                                                     |

[REVISÃO JURÍDICA: o Marco Civil da Internet (art. 15) exige guarda de registros de acesso a aplicação por 6 meses para provedor constituído como pessoa jurídica com fins econômicos. O operador hoje é pessoa física e o app é gratuito; confirmar se a obrigação se aplica. Se aplicar, o prazo dos registros técnicos (30 dias) e o truncamento do IP precisam mudar.]

## 10. Segurança e os limites que preferimos dizer

O que fazemos:

- Cada comunidade é isolada em duas camadas independentes: no código e no próprio banco de dados.
- Senhas com argon2id; sessões curtas renovadas com detecção de roubo; segundo fator disponível.
- Pedidos de oração **cifrados no servidor** (AES-256-GCM), com a chave guardada fora do banco: uma cópia do banco ou de um backup não mostra o texto.
- Pedidos de oração nunca aparecem em notificação, em registro técnico, em auditoria nem no armazenamento offline do aparelho.
- Notificações de assuntos sensíveis aparecem na tela bloqueada com texto genérico.
- Cópias de segurança cifradas antes de sair do servidor.
- Registros técnicos sem senha, token, cookie nem corpo das requisições.

Os limites, ditos com honestidade:

1. **A cifragem dos pedidos de oração não é de ponta a ponta.** Quem administra o servidor e guarda a chave tem capacidade técnica de decifrar. Hoje essa pessoa é o operador da plataforma, que também é o Criador. A garantia de que "o Criador não lê" vale para o app e suas telas, não contra quem controla a infraestrutura. Por isso pedimos que você escreva só o necessário.
2. **A Cloudflare vê o tráfego.** A conexão segura (HTTPS) termina na Cloudflare, que repassa a requisição ao servidor por um túnel cifrado. Na passagem, o conteúdo das requisições, inclusive o texto de um pedido de oração que você está enviando, fica acessível à infraestrutura da Cloudflare.
3. **Aparelho sem internet não recebe revogação.** Se você sair de uma comunidade ou for removido enquanto um aparelho com o evento preparado está offline, o que já foi baixado continua legível nele até a próxima conexão ou até vencer (no máximo 14 dias, ou o prazo da comunidade, até 30).
4. **Planilhas baixadas saem do nosso controle.** Uma exportação feita por um administrador fica 24 horas no servidor, mas a cópia baixada fica no aparelho dele; a comunidade é responsável por ela.
5. **O servidor é doméstico**, sem garantia de disponibilidade contínua.

## 11. Seus direitos e como exercer

A LGPD (art. 18) garante a você os direitos abaixo. A maioria você exerce sozinho, no app, em **Perfil**.

| Direito                                                    | Como exercer                                                                                                                                                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saber se tratamos seus dados e acessá-los                  | **Perfil > Exportar meus dados**: gera um arquivo com tudo o que é seu, disponível por 24 horas [IMPLEMENTAÇÃO: ainda não existe]                                                                                                   |
| Corrigir dados                                             | **Perfil**: nome e WhatsApp. Para trocar o e-mail, fale com o encarregado [IMPLEMENTAÇÃO: troca de e-mail pelo app ainda não existe]                                                                                                |
| Portabilidade                                              | O mesmo arquivo de exportação, em formato aberto (JSON)                                                                                                                                                                             |
| Apagar dados                                               | Apague um pedido de oração ou uma sugestão na própria tela; **Perfil > Sair da comunidade**; **Perfil > Excluir conta** [IMPLEMENTAÇÃO: excluir conta ainda não existe]. Sem o app: `https://unijovem.solerte.com.br/excluir-conta` |
| Revogar consentimento                                      | Sair da comunidade (revoga o daquela comunidade) ou excluir a conta (revoga todos). Para notificações: **Perfil > Notificações** ou os ajustes do aparelho                                                                          |
| Saber com quem compartilhamos                              | Seção 7 e `subprocessadores.md`                                                                                                                                                                                                     |
| Anonimização, bloqueio ou eliminação de dado desnecessário | Fale com o encarregado                                                                                                                                                                                                              |
| Opor-se a um tratamento                                    | Fale com o encarregado                                                                                                                                                                                                              |
| Revisão de decisão automatizada                            | O Uni Jovem não toma decisões automatizadas sobre você                                                                                                                                                                              |
| Pedidos sobre inscrição pública                            | Pelo link de cancelamento recebido na inscrição, ou com o encarregado                                                                                                                                                               |
| Reclamar à autoridade                                      | Agência Nacional de Proteção de Dados (ANPD), em `https://www.gov.br/anpd`                                                                                                                                                          |

Pedidos feitos ao encarregado são respondidos em até **15 dias**. Podemos pedir uma confirmação de identidade (por exemplo, responder do e-mail da conta) para não entregar seus dados a outra pessoa.

Quando o pedido é sobre dados **da comunidade** (por exemplo, o histórico de escalas), nós o encaminhamos aos administradores dela, que são os controladores, e acompanhamos a resposta.

## 12. Crianças e adolescentes

O público do Uni Jovem é jovem, então as regras são estas:

- **Conta só a partir de 16 anos.** Menores de 16 não podem criar conta. Comunidades não devem convidar menores de 16.
- **De 16 a 17 anos:** a pessoa declara a idade e declara que o pai, a mãe ou o responsável legal **sabe e concorda** com o uso do Uni Jovem e com o consentimento sobre a fé. Guardamos só essa declaração e a faixa de idade, nunca a data de nascimento.
- **Inscrição pública em evento de quem tem menos de 16 anos:** precisa ser feita pelo pai, pela mãe ou pelo responsável, com o nome e o WhatsApp **do responsável** como contato.
- Para todos os adolescentes, valem por padrão as opções mais protetoras: pedido de oração em "Somente eu", nenhum perfil público, nenhuma mensagem direta entre pessoas, nenhum anúncio, nenhuma recomendação automática e nenhuma localização do aparelho.

**Por que 16 anos.** Abaixo de 16 anos a pessoa é absolutamente incapaz para os atos da vida civil (Código Civil, art. 3º), então o consentimento dela sozinha sobre um dado sensível seria frágil; e o Estatuto Digital da Criança e do Adolescente (Lei nº 15.211/2025, em vigor desde 17/03/2026) exige que contas de menores de 16 anos sejam vinculadas a um responsável, recurso que o Uni Jovem não tem. Entre 16 e 17 anos a pessoa é relativamente incapaz e age assistida (Código Civil, art. 4º, I), por isso pedimos a ciência e a concordância do responsável. A LGPD (art. 14) exige que todo tratamento de dados de criança e adolescente atenda ao seu melhor interesse; é o que guia as configurações padrão acima.

Se soubermos que uma conta pertence a alguém com menos de 16 anos, ela será encerrada e os dados apagados, com aviso à comunidade.

[IMPLEMENTAÇÃO: a declaração de idade e a ciência do responsável ainda não existem nas telas de convite nem no formulário público.]

[REVISÃO JURÍDICA: (1) confirmar se a combinação "convite feito pela liderança da comunidade, que conhece a pessoa pessoalmente, mais autodeclaração" é mecanismo de aferição de idade proporcional para um app que não tem conteúdo impróprio, à luz da Lei nº 15.211/2025 e da sua regulamentação; (2) confirmar se a "ciência e concordância do responsável" declarada pelo próprio adolescente basta para 16 e 17 anos, ou se é preciso coletar o consentimento do responsável diretamente; (3) confirmar se o Uni Jovem se enquadra como produto "de acesso provável" por crianças e adolescentes e quais deveres da Lei nº 15.211/2025 se aplicam; (4) confirmar a inscrição de menores de 16 pelo responsável na página pública, inclusive menores de 12 (art. 14, § 1º, da LGPD).]

## 13. Permissões do aparelho

| Permissão    | Quando pedimos                                             | Se você negar                                    |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------ |
| Câmera       | Só quando você toca em "Ler QR Code" para marcar presença  | O check-in continua possível pela busca por nome |
| Notificações | Depois de explicar o benefício, nunca na primeira abertura | Você vê tudo no Início do app; nada se perde     |

O app não pede localização, contatos, fotos nem microfone.

## 14. Cookies e armazenamento no navegador

Na web, usamos só o essencial: um cookie de sessão protegido (`HttpOnly`, `Secure`, `SameSite=Strict`) para manter você conectado, e o armazenamento local do navegador para lembrar a última comunidade aberta. Nas páginas públicas de inscrição, o serviço anti-robô da Cloudflare (Turnstile) analisa sinais técnicos do navegador. Não usamos cookies de publicidade nem de análise de uso.

## 15. Incidentes de segurança

Se acontecer um incidente de segurança que possa causar risco ou dano relevante a você, comunicamos a ANPD e as pessoas afetadas em até **3 dias úteis** a partir de quando soubermos que dados pessoais foram afetados (Resolução CD/ANPD nº 15/2024), dizendo o que aconteceu, quais dados, os riscos e o que estamos fazendo. Quando o incidente envolver dados de uma comunidade, avisamos também os administradores dela.

[REVISÃO JURÍDICA: quando o incidente afeta dados de que a comunidade é controladora, a comunicação à ANPD é dever dela, com apoio do operador. Confirmar a divisão e o prazo do aviso do operador à comunidade, e prever no acordo com as comunidades.]

## 16. Mudanças nesta política

Quando esta política mudar, a nova versão aparece em `https://unijovem.solerte.com.br/privacidade` com a data. Se a mudança for relevante (nova finalidade, novo tipo de dado, novo subprocessador que receba dado seu), avisamos no app antes de ela valer e, quando a mudança depender de consentimento, pedimos de novo. As versões anteriores ficam disponíveis no mesmo endereço.

## 17. Contato

- Encarregado: [PREENCHER: nome], [PREENCHER: e-mail do encarregado]
- Operador da plataforma: [PREENCHER: nome completo ou razão social], [PREENCHER: CPF ou CNPJ]
- Autoridade: ANPD, `https://www.gov.br/anpd`

---

## Anexo (não publicar): notas consolidadas para a revisão jurídica

1. Divisão de papéis: comunidade controladora, plataforma operadora dos dados da comunidade e controladora dos dados de conta e segurança. Quem é a controladora quando a comunidade não tem personalidade jurídica; risco de controladoria conjunta; contrato do art. 39 (seção 2).
2. Consentimento (art. 11, I) como base do tratamento ligado à convicção religiosa e como condição do serviço (art. 9º, § 3º) (seção 4).
3. Art. 11, II, "g" e "d" para segurança e auditoria (seção 5).
4. Mecanismo de transferência internacional para cada subprocessador (Resolução CD/ANPD nº 19/2024) (seção 8).
5. Aplicabilidade do art. 15 do Marco Civil a operador pessoa física e app gratuito (seção 9).
6. Idade mínima de 16, ciência do responsável para 16 e 17, inscrição pública de menores pelo responsável, enquadramento na Lei nº 15.211/2025 (seção 12).
7. Encarregado: obrigatoriedade e forma de indicação (seção 2).
8. Divisão do dever de comunicar incidente entre comunidade e operador (seção 15).
9. Necessidade de Relatório de Impacto à Proteção de Dados (RIPD, art. 38) por envolver dado sensível de adolescentes: recomendamos um RIPD simplificado antes da produção.
10. Dados de terceiros em pedidos de oração (saúde de familiares) (seção 4).
