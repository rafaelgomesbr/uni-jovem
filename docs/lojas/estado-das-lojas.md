# Estado das fichas nas lojas

- **Data:** 15/11/2026.
- **Quem preencheu:** agente, no Chrome do dono (conta Apple "Rafael Gomes" e conta Google Play "Rafael Gomes", já logadas), a pedido do dono.
- **Fonte do conteúdo:** [`metadados.md`](metadados.md), [`declaracao-de-dados.md`](declaracao-de-dados.md) (versão 2, de 15/11/2026), [`revisao-apple.md`](revisao-apple.md), [`docs/privacidade/`](../privacidade/) e `docs/DECISOES.md` (D3, D27, D31, D33).
- **O que não foi feito, de propósito:** nenhum build anexado, nada enviado para revisão, nada publicado, nenhuma versão criada no Google Play, nenhum contrato ou termo novo aceito, nenhuma senha digitada, nenhuma chave de API criada.

## 1. Resumo

| Loja   | Seção                                     | Estado                         | Observação                                                                                                                                                    |
| ------ | ----------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apple  | Criação do app                            | Preenchida                     | "Uni Jovem", iOS, pt-BR, `com.solerte.unijovem`, SKU `unijovem-ios`, acesso total. Apple ID 6835004481. Nome aceito sem conflito                              |
| Apple  | Informações do app                        | Preenchida                     | Subtítulo, categorias, direitos de conteúdo, classificação etária                                                                                             |
| Apple  | Preço e disponibilidade                   | Preenchida                     | Grátis (R$ 0,00, base Brasil), disponível só no Brasil                                                                                                        |
| Apple  | Privacidade do app                        | Preenchida, **falta publicar** | URL da política e os 10 tipos de dado salvos. O botão "Publish" da página não foi clicado (regra de não publicar)                                             |
| Apple  | Versão 1.0.0: textos e URLs               | Preenchida                     | Texto promocional, descrição, palavras-chave, suporte, marketing, direitos autorais, versão 1.0.0, liberação manual                                           |
| Apple  | Versão 1.0.0: informações para a revisão  | **Pendente (dono)**            | O App Store Connect só salva com nome, sobrenome, **telefone** e e-mail de contato. Sem o telefone, nada da seção ficou salvo; o texto pronto está na seção 5 |
| Apple  | Capturas de tela                          | Pendente                       | Ficam para depois do redesign                                                                                                                                 |
| Apple  | Build                                     | Pendente                       | Não anexado, por regra                                                                                                                                        |
| Google | Ficha principal (padrão, pt-BR)           | Preenchida (rascunho salvo)    | Nome, descrição curta, descrição completa                                                                                                                     |
| Google | Ícone 512, imagem de destaque, capturas   | Pendente                       | Ficam para outro passo                                                                                                                                        |
| Google | Configurações da loja: categoria e tags   | Preenchida                     | Categoria Produtividade; tags Agenda, Eventos, Produtividade                                                                                                  |
| Google | Configurações da loja: dados de contato   | Preenchida                     | `contact@solerte.com.br` e `https://unijovem.solerte.com.br/`; telefone vazio                                                                                 |
| Google | Política de privacidade                   | Preenchida                     | `https://unijovem.solerte.com.br/privacidade`                                                                                                                 |
| Google | Anúncios                                  | Preenchida                     | Não tem anúncios                                                                                                                                              |
| Google | Detalhes do login (acesso ao app)         | Preenchida, com marcadores     | Usuário "[a definir]", senha vazia, instruções em inglês                                                                                                      |
| Google | Classificação de conteúdo (IARC)          | **Bloqueada (dono)**           | O questionário exige marcar "Concordo com os Termos de Uso da IARC". Não aceitei termo novo. Ficou um rascunho incompleto, sem aceite                         |
| Google | Público-alvo e conteúdo                   | Preenchida                     | 16 a 17 e 18 ou mais                                                                                                                                          |
| Google | Segurança dos dados                       | Preenchida                     | 10 tipos, nenhum compartilhado                                                                                                                                |
| Google | ID de publicidade                         | Preenchida                     | Não usa                                                                                                                                                       |
| Google | Apps governamentais                       | Preenchida                     | Não                                                                                                                                                           |
| Google | Recursos financeiros                      | Preenchida                     | "Meu app não oferece recursos financeiros"                                                                                                                    |
| Google | Apps de saúde                             | Preenchida                     | "Meu app não tem recursos de saúde"                                                                                                                           |
| Google | Status de comerciante e Termos de Serviço | Preenchida em parte            | Status de comerciante confirmado (herdado da conta). URL dos termos tirada, porque o Console não salva com a URL respondendo 404                              |
| Google | Apps de notícias                          | Não apareceu                   | O Console não pediu essa declaração para este app em 15/11/2026                                                                                               |
| Google | Países, versão, AAB                       | Pendente                       | Não criado, por regra. Ao criar a versão de produção, escolher só o Brasil                                                                                    |

## 2. Valores usados: classificação etária e público

### 2.1 Apple

Questionário (versão nova, sete etapas), respostas:

| Etapa                  | Item                                        | Resposta                                                         |
| ---------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| Recursos               | Controles parentais                         | Não                                                              |
| Recursos               | Verificação de idade (age assurance)        | Não                                                              |
| Recursos               | Acesso irrestrito à web                     | Não                                                              |
| Recursos               | Conteúdo gerado por usuários                | **Sim**                                                          |
| Recursos               | Redes sociais                               | Não                                                              |
| Recursos               | Redes sociais desligadas para menores de 13 | Não (o app não tem rede social nem usa a API Declared Age Range) |
| Recursos               | Mensagens e bate-papo                       | Não                                                              |
| Recursos               | Publicidade                                 | Não                                                              |
| Temas adultos          | Palavrões, terror, álcool, tabaco ou drogas | Nenhum                                                           |
| Médico ou bem-estar    | Informação médica ou de tratamento          | Nenhum                                                           |
| Médico ou bem-estar    | Temas de saúde ou bem-estar                 | Não                                                              |
| Sexualidade ou nudez   | Todos os itens                              | Nenhum                                                           |
| Violência              | Todos os itens, inclusive armas             | Nenhum                                                           |
| Atividades de sorte    | Jogos simulados, concursos                  | Nenhum                                                           |
| Atividades de sorte    | Jogos de azar, caixas de recompensa         | Não                                                              |
| Informações adicionais | Categoria e ajuste                          | **Ajustar para classificação mais alta: 16+**                    |
| Informações adicionais | URL de adequação de idade                   | `https://unijovem.solerte.com.br/termos`                         |

Resultado calculado pelas respostas: 4+. Resultado gravado depois do ajuste: **16+ em 173 países, A16 no Brasil, 15+ na Coreia do Sul**; em sistemas anteriores à versão 26, 17+ com exceções regionais.

Por que 16+: a própria tela da Apple diz que, se o app tem termos de uso com idade mínima, a classificação precisa acompanhar essa idade. Os termos e a política dizem 16 anos ou mais (D27, ECA Digital), e a API recusa menores de 16 (`apps/api/src/autenticacao/servico.ts#MENOR_DE_16`).

Direitos de conteúdo: "contém conteúdo de terceiros e tenho os direitos" (Bíblia Livre sob CC BY 4.0; fontes sob SIL OFL).

### 2.2 Google

- Público-alvo: **16 a 17** e **18 ou mais**. Nenhuma faixa abaixo de 16; a política para famílias não se aplica.
- Classificação IARC: não respondida (seção 4). Quando o dono aceitar os termos da IARC, responder conforme [`metadados.md`](metadados.md), seção 5.2: categoria "Todos os outros tipos de aplicações"; violência, sexualidade, linguagem, substâncias, humor grosseiro e jogos de azar: não; usuários interagem: sim; compartilha localização: não; compartilha informação pessoal com terceiros: não; compras digitais: não; navegador: não. E-mail de contato da IARC: `contact@solerte.com.br`.

## 3. Valores usados: privacidade

### 3.1 Apple: Privacidade do app

"Coletamos dados deste app": **sim**. Dez tipos, todos **vinculados à identidade**, todos só para **Funcionalidade do app**, nenhum usado para **rastreamento**:

Nome; Endereço de e-mail; Número de telefone; Informações confidenciais (crença religiosa); Fotos ou vídeos (foto de perfil e logotipo); Outro conteúdo do usuário; ID do usuário (inclui o identificador do Google ou da Apple); ID do dispositivo (token de push, IP truncado); Outros dados de uso; Outros tipos de dados (modelo do aparelho, faixa de idade, consentimentos).

URL da política: `https://unijovem.solerte.com.br/privacidade`. URL de escolhas de privacidade: vazia (opcional).

### 3.2 Google: Segurança dos dados

- Coleta ou compartilha dados obrigatórios: sim. Criptografados em trânsito: sim.
- Criação de conta: "Nome de usuário, senha e outras autenticações". OAuth não marcado, porque entrar com Google ou Apple não cria conta.
- Exclusão de conta: `https://unijovem.solerte.com.br/excluir-conta`. Exclusão de parte dos dados sem excluir a conta: sim, mesmo link.
- Tipos (todos coletados, nenhum compartilhado, nenhum efêmero):

| Tipo                                          | Obrigatório ou opcional | Finalidades                                                                      |
| --------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| Nome                                          | Obrigatório             | Funcionalidade do app; Gerenciamento de contas                                   |
| Endereço de e-mail                            | Obrigatório             | Funcionalidade do app; Gerenciamento de contas; Segurança e prevenção de fraudes |
| IDs de usuários                               | Obrigatório             | Funcionalidade do app; Gerenciamento de contas                                   |
| Número de telefone                            | Opcional                | Funcionalidade do app                                                            |
| Posicionamento político ou crenças religiosas | Obrigatório             | Funcionalidade do app                                                            |
| Outras informações (faixa de idade)           | Obrigatório             | Funcionalidade do app; Segurança e prevenção de fraudes                          |
| Fotos                                         | Opcional                | Funcionalidade do app                                                            |
| Outro conteúdo gerado pelo usuário            | Opcional                | Funcionalidade do app                                                            |
| Outras ações                                  | Opcional                | Funcionalidade do app                                                            |
| Identificadores do dispositivo e outros IDs   | Obrigatório             | Funcionalidade do app; Gerenciamento de contas; Segurança e prevenção de fraudes |

A prévia do Console mostra "Os dados não são compartilhados com terceiros".

## 4. O que depende do dono

1. **Google, classificação de conteúdo:** marcar o aceite dos Termos de Uso da IARC e responder o questionário (seção 2.2). Sem isso o app não pode ser lançado.
2. **Apple, Privacidade do app:** clicar em "Publish" na página App Privacy depois de conferir os 10 tipos. As respostas já estão salvas.
3. **Apple, informações para a revisão:** informar telefone de contato (o App Store Connect exige), colar o contato (Rafael Gomes, `contact@solerte.com.br`), marcar "Sign-in required", preencher usuário e senha da conta demo de admin e colar as notas da seção 5 com as credenciais da conta de membro. Anexar o PNG do QR de check-in da comunidade demo.
4. **Credenciais da conta demo** (admin e membro): hoje "[a definir]" no Google; nada salvo na Apple. Gerar no roteiro da comunidade demo (T8 de [`revisao-apple.md`](revisao-apple.md)) e colar à mão; nunca no git.
5. **Produção no ar:** o Google avisou que `/excluir-conta` e `/termos` respondem 404 em 15/11/2026. Antes de enviar, conferir que `/`, `/privacidade`, `/termos` e `/excluir-conta` abrem. Depois disso, colocar `https://unijovem.solerte.com.br/termos` em "Status de comerciante e Termos de Serviço" no Google.
6. **Capturas de tela, ícone 512 e imagem de destaque:** outro passo, depois do redesign.
7. **Build:** EAS Build e envio do binário (iOS 1.0.0 e AAB), com aprovação do dono.
8. **Google, países:** ao criar a versão de produção, escolher só o Brasil (o App Store já está só no Brasil).

## 5. Notas ao revisor da Apple, prontas para colar

Adaptadas de [`revisao-apple.md`](revisao-apple.md), seção 2.1, ao app de 15/11/2026 (abas Início, Agenda, Programas, Equipe e Perfil; exclusão em Perfil > Privacidade e dados; denúncia e ocultação existem). Conferir cada caminho no build final antes de colar e trocar os "[a definir]".

```
ABOUT THE APP
Uni Jovem helps church youth groups organize their weekly program and special events: schedules with timed steps, volunteer rosters, tasks, sign-ups, attendance check-in, prayer requests and announcements. The interface is in Brazilian Portuguese.

The app serves many independent youth groups ("communities"). Each community only sees its own data. There is no open sign-up: a community leader invites each person, and the invite defines their role (admin, organizer or member). Leaders who want a community for their group request it through the support page (https://unijovem.solerte.com.br/). Accounts are for people aged 16 or older, as stated in our terms of use, so the age rating is set to 16+.

DEMO ACCOUNTS
We created an isolated demo community, "Comunidade Demonstração", filled with fictitious data.
1. Admin account (sees every feature): the credentials in the Sign-In fields above.
2. Member account (to see the member view, or to test account deletion): [a definir] / [a definir]
Neither account uses two-factor authentication. Please use the member account to test account deletion, so the admin account stays available for future reviews. If you delete the admin account, it is also fine: the community has a second admin.

HOW TO SIGN IN
Open the app, tap "Entrar" (Sign in), type the e-mail and password, and tap "Entrar". Sign in with Apple and Google are also offered, but they only open accounts that already exist (created by invitation); please use the e-mail and password above.

WHERE THINGS ARE (tab names in Portuguese)
- Início (Home): upcoming events, my rosters, announcements, verse of the day.
- Agenda (Calendar): month, week and day timeline.
- Programas (Programs): event list. Open "Sábado padrão" to see steps, roster, tasks, checklists and attendance.
- Equipe (Team): members, roles and invitations.
- Perfil (Profile): personal data, notifications, connected devices, two-factor authentication, "Privacidade e dados" (privacy and data) and "Ajuda e sobre" (help, terms).

ACCOUNT DELETION (Guideline 5.1.1(v))
Perfil > "Privacidade e dados" (Privacy and data) > "Excluir conta" (Delete account). The account and its personal data are deleted; the authorship of shared records becomes "Pessoa removida" (Removed person). The same can be requested on the web at https://unijovem.solerte.com.br/excluir-conta

CAMERA
The camera is used to scan the attendance QR code at the event entrance: Programas > "Sábado padrão" > attendance > "Ler QR com a câmera" (Scan QR with the camera). Without the camera, attendance can also be marked by searching the person's name and tapping "Marcar presença".

OFFLINE BY DESIGN
On the event page, "Preparar para usar sem internet" downloads the program, roster and attendance list. With the device offline, attendance and live steps still work and are sent when the connection returns. Editing, invitations and administration require a connection on purpose.

USER CONTENT AND SAFETY
Prayer requests have three visibility levels chosen by the author: only me (default), prayer team, or the whole community. Content shared with others can be reported in the app with "Denunciar" (Report); community admins review reports and can remove reported content and remove or deactivate members. The support page has a contact e-mail (contact@solerte.com.br).

NO PURCHASES, NO ADS, NO TRACKING
The app has no in-app purchases, no advertising and no tracking.

The backend is our own server and is online during the review period. If anything does not work as described, please write to us through App Review and we will answer the same day.
```

## 6. Divergências encontradas e recomendações

1. **[`metadados.md`](metadados.md) na idade:** corrigido em 15/11/2026 (16+ na Apple pela idade mínima dos termos; público 16 a 17 e 18 ou mais no Google).
2. **ID de publicidade:** `com.google.android.gms.permission.AD_ID` já está em `apps/app/app.config.ts#blockedPermissions`; conferir o manifesto do AAB final.
3. **Câmera e foto de perfil (D33):** resolvido em 15/11/2026. Os textos de permissão da câmera e da galeria citam o QR de presença, a foto de perfil e o logotipo (TC-11.v2); a nota ao revisor deve mencionar a foto de perfil opcional.
4. **Google, Detalhes do login:** a opção "Permita que o Google use esses detalhes de login para testes em dispositivos do Google e de parceiros" ficou ligada (padrão do Console). Desligar se o dono não quiser testes automáticos mexendo na comunidade demo.
5. **Apple, disponibilidade em Mac com Apple Silicon e Vision Pro:** ficou o padrão do App Store Connect; não foi alterado.
6. **Apple, Acessibilidade do app (rótulos de acessibilidade):** seção opcional nova, não preenchida.
