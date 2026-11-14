# Declaração de dados nas lojas

- **Versão:** 1, de 14/11/2026.
- **Para quem preenche:** o formulário "Privacidade do app" (App Privacy) do App Store Connect e o formulário "Segurança dos dados" (Data safety) do Play Console.
- **Binário coberto:** `com.solerte.unijovem` como está no repositório em 14/11/2026 (Expo SDK 58, `apps/app`), mais as mudanças previstas na seção 5 para quando a F14 (notificações) e outras entregas entrarem no binário.
- **Companheiros:** [`metadados.md`](metadados.md), [`revisao-apple.md`](revisao-apple.md), [`checklist.md`](checklist.md). A política de privacidade (F18, `https://unijovem.solerte.com.br/privacidade`) precisa dizer o mesmo que este arquivo.

## Regra de uso deste arquivo

Formulário de loja é declaração assinada por quem envia. Toda resposta abaixo aponta para o arquivo e o **símbolo** que a sustenta (tabela, coluna, função, chave de configuração), na forma `caminho/arquivo#simbolo`, ou `caminho#!simbolo` quando o que sustenta a resposta é uma **ausência**. Não há âncora por número de linha, porque número de linha envelhece. Se uma resposta não tiver âncora, ela não pode ir para o formulário.

Quando o código mudar o que coleta, este arquivo muda no mesmo commit (regra 10 do `CLAUDE.md`).

---

## 1. O levantamento, lido do código

### 1.1 O que o app pede ao sistema operacional

| Recurso      | Onde é declarado                                                                                                                             | Uso                                            | Estado em 14/11/2026                                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Câmera       | `apps/app/app.config.ts#TEXTO_CAMERA` (iOS, `NSCameraUsageDescription`) e `apps/app/app.config.ts#permissions` (`android.permission.CAMERA`) | Ler o QR Code de presença na entrada do evento | **Declarada, mas nenhuma tela usa ainda** (`apps/app/src#!CameraView`, `apps/app/src#!useCameraPermissions`). A tela de check-in por QR é da F12 no app. Ver seção 6, item 2 |
| Notificações | ainda não declaradas (`apps/app/package.json#!expo-notifications`)                                                                           | Avisos e versículo do dia                      | Entram com a F14 (seção 5)                                                                                                                                                   |

Não há pedido de localização, contatos, agenda, microfone, fotos, armazenamento compartilhado, Bluetooth nem rastreamento. As permissões que bibliotecas trariam por herança estão bloqueadas em `apps/app/app.config.ts#blockedPermissions` (`RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`).

O quadro da câmera é processado **só no aparelho**: o que sai para o servidor é o código lido do QR, que é aleatório e não contém dado pessoal (`apps/api/migracoes/0008_inscricoes.sql#codigo_checkin`). Pelas duas lojas, processamento só no aparelho não é coleta. Por isso "Fotos e vídeos" fica em **não**.

### 1.2 O que fica guardado no aparelho

| Dado                           | Onde                                                          | Evidência                                                                                                              |
| ------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Token de renovação da sessão   | Keychain (iOS) ou Keystore (Android), sem sair do aparelho    | `apps/app/src/servicos/armazenamentoDoRefresh.ts#AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`                                  |
| Comunidade ativa da conta      | Mesmo cofre                                                   | `apps/app/src/estado/comunidadeAtivaSalva.ts#setItemAsync`                                                             |
| Dados das telas                | Memória do processo (cache do React Query), apagada ao fechar | `apps/app/package.json#@tanstack/react-query`                                                                          |
| Pacote offline do evento (F13) | SQLite cifrado (SQLCipher) por conta e comunidade             | Plugin já configurado em `apps/app/app.config.ts#useSQLCipher`; ainda sem uso no código (`apps/app/src#!openDatabase`) |

Dado guardado só no aparelho não é "coletado" para nenhuma das duas lojas. Ele entra aqui porque a política de privacidade precisa dizer onde fica.

### 1.3 O que sai do aparelho e fica no servidor

O servidor é do próprio desenvolvedor (Mac mini com Docker, D1). Tudo trafega por HTTPS (`apps/app/eas.json#EXPO_PUBLIC_API_URL`, sempre `https://`), atrás do Cloudflare Tunnel.

| Dado                                                                                     | Tabela ou ponto de gravação                                                                                                                                                                                       | Para quê                                                                                                               |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Nome                                                                                     | `apps/api/migracoes/0001_nucleo.sql#contas` (coluna `nome`)                                                                                                                                                       | Identificar a pessoa na comunidade                                                                                     |
| E-mail                                                                                   | `0001_nucleo.sql#contas` (coluna `email`); `0001_nucleo.sql#verificacoes_email`                                                                                                                                   | Entrar, verificar o convite, recuperar a senha, alertas de segurança                                                   |
| WhatsApp (opcional)                                                                      | `0001_nucleo.sql#contas` (coluna `whatsapp`), opcional em `apps/api/src/rotas/autenticacao.ts#whatsapp` (`.nullish()`)                                                                                            | Contato pela liderança (só admin e organizador veem)                                                                   |
| Senha                                                                                    | `0001_nucleo.sql#contas` (coluna `senha_hash`, argon2id)                                                                                                                                                          | Autenticação. Só o hash é guardado                                                                                     |
| Segredo de 2FA e códigos de recuperação                                                  | `0001_nucleo.sql#contas` (`totp_segredo_cifrado`), `0001_nucleo.sql#codigos_recuperacao` (hash)                                                                                                                   | Segurança da conta                                                                                                     |
| Identificador da conta                                                                   | `0001_nucleo.sql#contas` (coluna `id`, UUID)                                                                                                                                                                      | Vincular tudo à conta                                                                                                  |
| Sessão por aparelho: modelo do aparelho, plataforma, último uso                          | `0001_nucleo.sql#sessoes` (`aparelho`, `plataforma`, `ultimo_uso_em`); o app envia o modelo em `apps/app/src/servicos/aparelho.ts#nomeDoAparelho` (`Device.modelName`, nunca o nome que a pessoa deu ao aparelho) | Tela "Aparelhos conectados" e revogação                                                                                |
| IP truncado (/24 no IPv4, /48 no IPv6)                                                   | `0001_nucleo.sql#auditoria` (coluna `ip_truncado`), truncado por `apps/api/src/autenticacao/limitador.ts#truncarIp`                                                                                               | Auditoria de segurança (P7: 2 anos) e limite de tentativas                                                             |
| IP completo no log do servidor                                                           | `apps/api/src/servidor.ts#logger` (o serializador padrão do Fastify registra `remoteAddress`)                                                                                                                     | Operação e segurança. Ver seção 6, item 7                                                                              |
| Vínculo com a comunidade: papel, estado, designação (equipe de oração)                   | `0001_nucleo.sql#vinculos`                                                                                                                                                                                        | Permissões. **Revela participação num grupo religioso** (seção 2.2)                                                    |
| Pedidos de oração                                                                        | `0009_oracao_sugestoes_conteudos_avisos.sql#pedidos_oracao` (`texto_cifrado`, AES-256-GCM na aplicação) e `#intercessoes` ("estou orando")                                                                        | Função de oração                                                                                                       |
| Sugestões                                                                                | `0009_oracao_sugestoes_conteudos_avisos.sql#sugestoes`                                                                                                                                                            | Sugestões à liderança                                                                                                  |
| Avisos                                                                                   | `0009_oracao_sugestoes_conteudos_avisos.sql#avisos`                                                                                                                                                               | Comunicação da liderança                                                                                               |
| Músicas, músicos, palestrantes, dinâmicas                                                | `0009_oracao_sugestoes_conteudos_avisos.sql#musicas`, `#musicos`, `#palestrantes`, `#dinamicas`                                                                                                                   | Conteúdos da comunidade (podem ter nome de terceiros digitado pela liderança)                                          |
| Eventos, etapas, tarefas, materiais, checklists, notas internas, anexos por link, locais | `0004_eventos.sql#eventos`, `#etapas`, `#tarefas`, `#materiais`, `#checklist_itens`, `#notas_internas`, `#anexos`, `#locais`                                                                                      | Programação. O endereço e a coordenada de `locais` são do **lugar do evento**, digitados pela liderança, não da pessoa |
| Escalas, disponibilidade, substituições                                                  | `0004_eventos.sql#atribuicoes`, `0006_escalas.sql#disponibilidades`, `#substituicoes`                                                                                                                             | Escalas                                                                                                                |
| Inscrições e presença                                                                    | `0008_inscricoes.sql#inscricoes`, `#presencas`                                                                                                                                                                    | Inscrição em evento e check-in                                                                                         |
| Ao vivo                                                                                  | `0007_ao_vivo.sql#andamentos`, `#andamento_comandos`                                                                                                                                                              | Condução do evento                                                                                                     |
| Exportações CSV                                                                          | `0010_exportacoes.sql#exportacoes` (expira em 24 h)                                                                                                                                                               | Relatórios da liderança                                                                                                |

### 1.4 Quem mais toca nesses dados (prestadores de serviço)

| Prestador                   | O que recebe                                                                          | Papel                                         |
| --------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------- |
| Cloudflare (Tunnel e DNS)   | Todo o tráfego HTTPS passa pela borda da Cloudflare                                   | Prestador de serviço (infraestrutura)         |
| Resend                      | E-mail do destinatário e o texto do e-mail transacional (código, link de recuperação) | Prestador de serviço (envio de e-mail, PH-03) |
| Cloudflare R2               | Cópia cifrada (age) do backup do banco                                                | Prestador de serviço (backup, PH-05)          |
| Apple (APNs) e Google (FCM) | Token do aparelho e o dado da notificação, **a partir da F14**                        | Prestador de serviço (entrega de push)        |

Pelas definições do Google, prestador de serviço que processa dado **em nome do desenvolvedor** não é "compartilhamento" ([Data safety, definições](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)). Pela Apple, também não é rastreamento, porque nada é ligado a dado de terceiros para publicidade ([App privacy details](https://developer.apple.com/app-store/app-privacy-details/)).

### 1.5 O que o app não coleta (verificado por ausência)

- Nenhuma biblioteca de análise, publicidade, atribuição ou relatório de falha: `apps/app/package.json#dependencies` não tem Firebase Analytics, Sentry, Amplitude, Segment, AppsFlyer nem semelhantes. O Sentry é opcional no plano e está desligado (seção 5).
- Nenhum identificador de publicidade, nenhum `App Tracking Transparency` (`apps/app/src#!requestTrackingPermissionsAsync`).
- Sem localização: `apps/app/package.json#!expo-location`.
- Sem foto de perfil: `0001_nucleo.sql#contas` não tem coluna de foto (o plano cita "foto opcional" em PER-01, ainda não implementada).
- Sem upload de arquivo: anexos são só links `https://` (D17, `0004_eventos.sql#anexos`, `tipo` padrão `link`).
- Sem compras e sem anúncios.

---

## 2. App Store: Privacidade do app (App Privacy)

Definições usadas, conforme a página da Apple consultada em 14/11/2026 ([App privacy details](https://developer.apple.com/app-store/app-privacy-details/)):

- "Coletar" é transmitir para fora do aparelho de forma que o desenvolvedor acesse por mais tempo do que o necessário para atender o pedido em tempo real.
- Dado pessoal é sempre "vinculado à identidade". Como o app só funciona com conta, **tudo que é coletado é vinculado**.
- **Rastreamento: não, em todas as linhas.** Nenhum dado é ligado a dado de terceiros para publicidade nem enviado a corretor de dados. Por isso o app não pede a autorização de rastreamento e não deve pedir.
- Finalidade "Funcionalidade do app" inclui autenticar, habilitar recursos, prevenir fraude e implementar medidas de segurança.

### 2.1 Respostas

Pergunta inicial: **"Você ou seus parceiros coletam dados deste app?" Sim.**

| Categoria (Apple)         | Tipo                                | Coletado | Finalidade            | Vinculado | Rastreamento |
| ------------------------- | ----------------------------------- | -------- | --------------------- | --------- | ------------ |
| Informações de contato    | Nome                                | Sim      | Funcionalidade do app | Sim       | Não          |
| Informações de contato    | Endereço de e-mail                  | Sim      | Funcionalidade do app | Sim       | Não          |
| Informações de contato    | Número de telefone                  | Sim      | Funcionalidade do app | Sim       | Não          |
| Informações de contato    | Endereço físico                     | Não      |                       |           |              |
| Informações de contato    | Outras informações de contato       | Não      |                       |           |              |
| Saúde e condicionamento   | (todos)                             | Não      |                       |           |              |
| Informações financeiras   | (todos)                             | Não      |                       |           |              |
| Localização               | Precisa e aproximada                | Não      |                       |           |              |
| Informações confidenciais | Informações confidenciais           | **Sim**  | Funcionalidade do app | Sim       | Não          |
| Contatos                  | Contatos                            | Não      |                       |           |              |
| Conteúdo do usuário       | E-mails ou mensagens de texto       | Não      |                       |           |              |
| Conteúdo do usuário       | Fotos ou vídeos                     | Não      |                       |           |              |
| Conteúdo do usuário       | Dados de áudio                      | Não      |                       |           |              |
| Conteúdo do usuário       | Jogabilidade                        | Não      |                       |           |              |
| Conteúdo do usuário       | Atendimento ao cliente              | Não      |                       |           |              |
| Conteúdo do usuário       | Outro conteúdo do usuário           | Sim      | Funcionalidade do app | Sim       | Não          |
| Histórico de navegação    |                                     | Não      |                       |           |              |
| Histórico de busca        |                                     | Não      |                       |           |              |
| Identificadores           | ID do usuário                       | Sim      | Funcionalidade do app | Sim       | Não          |
| Identificadores           | ID do dispositivo                   | Sim      | Funcionalidade do app | Sim       | Não          |
| Compras                   |                                     | Não      |                       |           |              |
| Dados de uso              | Interação com o produto             | Não      |                       |           |              |
| Dados de uso              | Dados de publicidade                | Não      |                       |           |              |
| Dados de uso              | Outros dados de uso                 | Sim      | Funcionalidade do app | Sim       | Não          |
| Diagnóstico               | Dados de falhas, desempenho, outros | Não      |                       |           |              |
| Arredores, corpo          | (todos)                             | Não      |                       |           |              |
| Outros dados              | Outros tipos de dados               | Sim      | Funcionalidade do app | Sim       | Não          |

### 2.2 Por que cada "sim"

- **Nome:** `0001_nucleo.sql#contas` (`nome`), pedido no cadastro por convite (`apps/api/src/rotas/autenticacao.ts#nome`). Também nomes de terceiros digitados pela liderança (músico, palestrante, presença avulsa em `0008_inscricoes.sql#presencas`, coluna `nome_avulso`).
- **E-mail:** `0001_nucleo.sql#contas` (`email`); é o login e o canal de verificação e recuperação.
- **Número de telefone:** `0001_nucleo.sql#contas` (`whatsapp`). É opcional, mas é coleta: a Apple só dispensa a declaração quando a coleta é rara e fora da função principal, o que não é o caso de um campo do cadastro.
- **Informações confidenciais (decisão delicada):** a Apple lista "crenças religiosas ou filosóficas" nesta categoria. O app não pergunta a religião de ninguém, mas o vínculo com uma comunidade de jovens de igreja (`0001_nucleo.sql#vinculos`) e os pedidos de oração revelam convicção religiosa, e o próprio plano trata isso como dado sensível da LGPD (art. 5º, II; plano, seção 9; RISCOS R20). Declarar "não" seria declarar que o app não trata um dado que o projeto reconhece tratar. **Decisão: sim.**
- **Outro conteúdo do usuário:** pedidos de oração, sugestões, avisos, notas internas, tarefas, materiais, checklists, músicas, dinâmicas, observações de disponibilidade (tabelas da seção 1.3).
- **ID do usuário:** `0001_nucleo.sql#contas` (`id`) e `#vinculos` (`id`).
- **ID do dispositivo:** a Apple manda declarar o IP guardado conforme o uso, e cita "ID do dispositivo" entre as opções. O servidor guarda o IP truncado na auditoria (`0001_nucleo.sql#auditoria`, `ip_truncado`) e o IP completo no log (`apps/api/src/servidor.ts#logger`), para segurança. A partir da F14 entra também o token de push do aparelho.
- **Outros dados de uso:** ações registradas na conta que não são conteúdo: presença (`0008_inscricoes.sql#presencas`), inscrições, confirmação e substituição de escala (`0006_escalas.sql#substituicoes`), disponibilidade, "estou orando" (`0009_oracao_sugestoes_conteudos_avisos.sql#intercessoes`), último uso da sessão (`0001_nucleo.sql#sessoes`, `ultimo_uso_em`).
- **Outros tipos de dados:** modelo do aparelho e plataforma da sessão (`apps/app/src/servicos/aparelho.ts#nomeDoAparelho`), que não se encaixam em nenhuma categoria da Apple.

### 2.3 Por que alguns "não" que parecem "sim"

- **Interação com o produto:** não há medição de toques, telas vistas ou aberturas do app (ausência de biblioteca de análise, seção 1.5).
- **Fotos ou vídeos:** a câmera só lê QR, no aparelho (seção 1.1).
- **Localização:** endereço e coordenada em `0004_eventos.sql#locais` são do lugar do evento, digitados pela liderança. O app não lê a posição do aparelho.
- **Saúde:** o app não pede informação de saúde. Um pedido de oração pode mencionar doença, mas é texto livre declarado em "Outro conteúdo do usuário", cifrado em repouso e nunca usado para outra finalidade (seção 4, decisão D-L3).
- **Atendimento ao cliente:** o suporte é por e-mail fora do app; o app não tem formulário de suporte.

---

## 3. Google Play: Segurança dos dados (Data safety)

Definições usadas, conforme a ajuda do Play Console consultada em 14/11/2026 ([Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)): "coletar" é transmitir para fora do aparelho; dado processado só no aparelho não é coletado; "compartilhar" é transferir para terceiro, **exceto** prestador de serviço que processa em nome do desenvolvedor, exigência legal ou ação iniciada pela própria pessoa.

### 3.1 Perguntas gerais

| Pergunta                                                                          | Resposta                                                             | Justificativa                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O app coleta ou compartilha algum dos tipos de dados exigidos?                    | Sim                                                                  | Seção 1.3                                                                                                                                                                                                        |
| Todos os dados coletados são criptografados em trânsito?                          | Sim                                                                  | Só HTTPS: `apps/app/eas.json#EXPO_PUBLIC_API_URL`; o Android bloqueia texto claro por padrão desde o nível 28 e o alvo do SDK 58 é 36                                                                            |
| O app permite criar conta?                                                        | Sim, por convite                                                     | Rotas `/api/auth/convite/iniciar` e `/api/auth/convite/concluir` em `apps/api/src/rotas/autenticacao.ts`; ADR 0004                                                                                               |
| Método de criação de conta                                                        | Nome de usuário e senha (e-mail e senha), com segundo fator opcional | `0001_nucleo.sql#contas` (`senha_hash`, `totp_ativado_em`)                                                                                                                                                       |
| Link para pedir a exclusão da conta                                               | `https://unijovem.solerte.com.br/excluir-conta`                      | DOM-02, PRIV-03. **A página ainda não existe** (seção 6, item 1)                                                                                                                                                 |
| Você oferece um jeito de pedir a exclusão de parte dos dados sem excluir a conta? | Sim                                                                  | A pessoa exclui os próprios pedidos de oração (`0009_oracao_sugestoes_conteudos_avisos.sql#pedidos_oracao_excluir`, só o autor) e sai de uma comunidade (PAP-05). Confirmar que as telas existem antes de enviar |
| Os usuários podem pedir a exclusão dos dados?                                     | Sim                                                                  | Exclusão de conta no app e na web (PRIV-03, F18). **Só responda sim depois que a F18 entregar os dois caminhos**                                                                                                 |
| O app passou por revisão de segurança independente (MASA)?                        | Não                                                                  |                                                                                                                                                                                                                  |
| Compromisso com a política para famílias                                          | Não se aplica                                                        | Público-alvo a partir de 13 anos ([`metadados.md`](metadados.md), seção 6)                                                                                                                                       |

### 3.2 Tipos de dados

Todas as linhas com "sim": **criptografado em trânsito**, **não compartilhado** (só prestadores de serviço, seção 1.4), **não processado de forma efêmera** (fica guardado).

| Categoria > tipo (Google)                                     | Coletado | Obrigatório ou opcional | Finalidades                                                                                   |
| ------------------------------------------------------------- | -------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| Informações pessoais > Nome                                   | Sim      | Obrigatório             | Funcionalidade do app; Gerenciamento da conta                                                 |
| Informações pessoais > Endereço de e-mail                     | Sim      | Obrigatório             | Funcionalidade do app; Gerenciamento da conta; Prevenção de fraudes, segurança e conformidade |
| Informações pessoais > IDs do usuário                         | Sim      | Obrigatório             | Funcionalidade do app; Gerenciamento da conta                                                 |
| Informações pessoais > Endereço                               | Não      |                         |                                                                                               |
| Informações pessoais > Número de telefone                     | Sim      | Opcional                | Funcionalidade do app                                                                         |
| Informações pessoais > Raça e etnia                           | Não      |                         |                                                                                               |
| Informações pessoais > Crenças políticas ou religiosas        | **Sim**  | Obrigatório             | Funcionalidade do app                                                                         |
| Informações pessoais > Orientação sexual                      | Não      |                         |                                                                                               |
| Informações pessoais > Outras informações                     | Não      |                         |                                                                                               |
| Informações financeiras (todos)                               | Não      |                         |                                                                                               |
| Saúde e condicionamento físico (todos)                        | Não      |                         |                                                                                               |
| Mensagens (e-mails, SMS, outras mensagens no app)             | Não      |                         |                                                                                               |
| Fotos e vídeos                                                | Não      |                         |                                                                                               |
| Arquivos de áudio                                             | Não      |                         |                                                                                               |
| Arquivos e documentos                                         | Não      |                         |                                                                                               |
| Agenda > Eventos da agenda                                    | Não      |                         |                                                                                               |
| Contatos                                                      | Não      |                         |                                                                                               |
| Atividade no app > Interações com o app                       | Não      |                         |                                                                                               |
| Atividade no app > Histórico de pesquisa no app               | Não      |                         |                                                                                               |
| Atividade no app > Apps instalados                            | Não      |                         |                                                                                               |
| Atividade no app > Outro conteúdo gerado pelo usuário         | Sim      | Opcional                | Funcionalidade do app                                                                         |
| Atividade no app > Outras ações                               | Sim      | Opcional                | Funcionalidade do app                                                                         |
| Navegação na Web                                              | Não      |                         |                                                                                               |
| Informações e desempenho do app (falhas, diagnóstico, outros) | Não      |                         |                                                                                               |
| Dispositivo ou outros IDs                                     | Sim      | Obrigatório             | Funcionalidade do app; Gerenciamento da conta; Prevenção de fraudes, segurança e conformidade |
| Local (aproximado e preciso)                                  | Não      |                         |                                                                                               |

### 3.3 Por que cada resposta delicada

- **Crenças políticas ou religiosas, sim e obrigatório:** mesmo raciocínio da Apple (seção 2.2). Participar do app é participar de uma comunidade de igreja; não existe uso do app sem vínculo.
- **Outro conteúdo gerado pelo usuário, opcional:** ninguém é obrigado a publicar pedido de oração, sugestão ou nota para usar o app.
- **Outras ações:** presença, inscrição, confirmação de escala, substituição, disponibilidade, "estou orando" (seção 2.2). Opcional porque a pessoa pode só consultar a programação.
- **Dispositivo ou outros IDs:** o identificador da sessão por aparelho (a "família" de `0001_nucleo.sql#sessoes`), o modelo do aparelho, o IP truncado da auditoria e o IP do log do servidor. A partir da F14, o token de push.
- **Agenda, não:** a categoria do Google é a agenda **do aparelho**. O app não lê nem escreve na agenda do sistema; os eventos são dados do próprio app.
- **Fotos, não:** a câmera só lê QR, no aparelho.
- **Saúde, não:** ver seção 2.3 e decisão D-L3.

---

## 4. Decisões tomadas neste documento

| #    | Decisão                                                                                                                 | Por quê                                                                                                                                                                                              | Alternativa rejeitada                                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-L1 | Declarar **crença religiosa** (Apple "Informações confidenciais"; Google "Crenças políticas ou religiosas")             | O vínculo com a comunidade de igreja revela convicção religiosa, e o projeto já trata isso como dado sensível (R20, plano seção 9). Declarar a mais não reprova; declarar a menos é declaração falsa | Responder "não" porque o app não pergunta a religião                                                                                                                                           |
| D-L2 | Prestadores de serviço (Cloudflare, Resend, R2 e, na F14, APNs e FCM) **não** contam como compartilhamento              | Definição literal do Google: prestador que processa em nome do desenvolvedor não é compartilhamento. O conteúdo do push é genérico (NOT-02), sem texto de oração                                     | Seguir o dc360, que marcou "compartilhado" para o push por cautela. Se o dono preferir a cautela, mude só a coluna de compartilhamento de "Dispositivo ou outros IDs" para sim; nada mais muda |
| D-L3 | Pedido de oração vai como "outro conteúdo do usuário", **não** como dado de saúde                                       | O app não pede dado de saúde; o texto é livre, cifrado em repouso e sem uso secundário                                                                                                               | Declarar "Informações de saúde" porque um pedido pode citar doença. Reavaliar se a revisão jurídica (PH-11) entender diferente                                                                 |
| D-L4 | IP guardado declarado como **ID do dispositivo** (Apple) e **Dispositivo ou outros IDs** (Google), finalidade segurança | A Apple manda declarar IP guardado conforme o uso; aqui o uso é segurança, não localização nem diagnóstico                                                                                           | Não declarar o IP                                                                                                                                                                              |
| D-L5 | Telefone (WhatsApp) declarado mesmo sendo opcional                                                                      | É campo do cadastro, parte da função principal; não cumpre os critérios de dispensa da Apple                                                                                                         | Omitir por ser opcional                                                                                                                                                                        |

---

## 5. O que muda quando cada entrega entrar no binário

Revise este arquivo antes de cada envio. Cada linha abaixo vira mudança no formulário **no mesmo envio** em que a função entra.

| Entrega                                          | Muda na Apple                                                           | Muda no Google                                                                                              | Evidência a conferir                                                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| F14 notificações (push)                          | "ID do dispositivo" passa a incluir o token de push (já está "sim")     | "Dispositivo ou outros IDs" passa a incluir o token (já está "sim"); compartilhamento continua "não" (D-L2) | Token nativo (`getDevicePushTokenAsync`, nunca o serviço de push da Expo); conteúdo da notificação sem texto sensível (NOT-02) |
| F14 versículo do dia                             | Nada (agendado localmente, `expo-notifications`, sem envio ao servidor) | Nada                                                                                                        | Preferência e horário: se forem gravados no servidor, entram em "Outros dados de uso" e "Outras ações" (já marcados)           |
| Upload de arquivos (D17, depois da F6)           | "Fotos ou vídeos" e "Outro conteúdo do usuário"                         | "Fotos" e "Arquivos e documentos": sim, opcional                                                            | Rota de upload e chave em `0004_eventos.sql#anexos` (`arquivo_chave`)                                                          |
| Foto de perfil (PER-01, se implementada)         | "Fotos ou vídeos": sim                                                  | "Fotos": sim, opcional                                                                                      | Coluna nova em `contas`                                                                                                        |
| Sentry (opcional no plano)                       | "Dados de falhas" e "Outros dados de diagnóstico": sim                  | "Registros de falhas" e "Diagnóstico": sim; Sentry vira prestador                                           | Dependência em `apps/app/package.json`                                                                                         |
| Mapa embutido (D22, pendente de decisão do dono) | Nada sobre a pessoa, se o mapa só mostrar o lugar do evento             | Idem                                                                                                        | Se mostrar a posição do aparelho, refazer a seção de localização inteira                                                       |

---

## 6. O que precisa existir antes de enviar este formulário

Nada disto é opinião sobre qualidade: são condições sem as quais alguma resposta acima fica falsa.

1. **Exclusão de conta no app e na página `/excluir-conta`** (PRIV-03, F18). Hoje não existe em `apps/app/src` (`apps/app/src#!excluirConta`) nem na API. Sem isso, "os usuários podem pedir a exclusão" seria falso, e as duas lojas reprovam (ver [`revisao-apple.md`](revisao-apple.md)).
2. **Tela que usa a câmera** (check-in por QR, F12 no app). Hoje a permissão está declarada sem uso. Se a F12 não entrar no binário, a permissão sai do `app.config.ts` antes do build.
3. **Política de privacidade publicada** em `https://unijovem.solerte.com.br/privacidade` e com link dentro do app. Hoje a API só tem o link no rodapé das páginas públicas (`apps/api/src/publico/html.ts`, `href="/privacidade"`), sem rota que responda, e o app não tem link nenhum (`apps/app/src#!privacidade`).
4. **Termos de uso aceitos antes de publicar conteúdo** (exigência do Google para conteúdo gerado por usuário; ver [`revisao-apple.md`](revisao-apple.md), seção 3).
5. **Prestadores listados na política:** Cloudflare, Resend, Cloudflare R2 e, com a F14, Apple e Google para push.
6. **Backup do Android:** o `app.config.ts` não define `android.allowBackup`, e o padrão é ligado. O dado do app não é coletado por isso (o backup é da pessoa, na conta Google dela), mas o dc360 desliga por precaução. Recomendação para a F19: `allowBackup: false`.
7. **IP completo no log do servidor:** o log de produção do Fastify registra o IP inteiro (`remoteAddress`) por padrão. A declaração acima já cobre isso, mas a política de privacidade precisa dizer o prazo de guarda do log. Alternativa mais simples para a política: trocar o serializador para gravar o IP truncado (`truncarIp`), como a auditoria já faz.

---

## 7. Fontes (consultadas em 14/11/2026)

- Apple, [App privacy details on the App Store](https://developer.apple.com/app-store/app-privacy-details/): definição de coleta, critérios de dispensa, tipos de dado, finalidades, rastreamento, IP.
- Google, [Provide information for Google Play's Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en): coleta, compartilhamento, exceções, tipos e finalidades.
- Google, [Understanding Google Play's app account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en): caminho no app, recurso web e perguntas de exclusão no formulário.
- Firebase, [Data disclosure for Google Play's Data safety section](https://firebase.google.com/docs/android/play-data-disclosure): o que o FCM coleta por padrão (para a F14).
- Referência de estrutura: `C:\Projetos\city-hall\dc360\docs\DECLARACAO-NAS-LOJAS.md` (âncoras por símbolo, seção de ausências).
