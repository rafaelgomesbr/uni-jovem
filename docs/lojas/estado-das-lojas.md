# Estado das fichas nas lojas

## Correção do cadastro em 17/11/2026

- iOS 1.0.0 (5) compilado localmente, assinado e enviado à Apple em 17/11/2026 às 10:49:35 (Brasília). `UPLOAD SUCCEEDED with no errors`, entrega `6917d4e1-b732-4c01-bfc6-46c6c6182595`, IPA com 17.175.641 bytes. Confirmado pela API como `VALID` e `IN_BETA_TESTING`, com notificação automática habilitada. Grupo interno Equipe Uni Jovem com acesso automático a todos os builds. Notas pt-BR salvas. O primeiro envio havia sido recusado por número duplicado (4); o reenvio foi assinado com o número 5. Contador remoto EAS em 5.
- Código de origem: `d64494a`. Hashes dos arquivos de cadastro e convite conferem entre a origem local e a usada no archive. Apple acessível desde o início do cadastro e do convite; convite preservado ao usar provedor.
- API e web corrigidas já implantadas. Códigos por e-mail ainda dependem da autenticação SMTP no Gmail do dono. O suporte SMTP está incluído na API; a credencial fica só no servidor e não exige novo binário.
- Android 1.0.0 (9) concluído localmente, sem custo, em `tmp/uni-jovem-1.0.0-9.aab` (112.149.647 bytes). Assinatura conferida, mesma chave de upload anterior; manifesto com `com.solerte.unijovem`, versão 1.0.0 e código 9. SHA-256 `706d1f4cf46bd2a4c7d4431436e00c0363d08f4e69e90dc8923787ccac338af3`. Contador remoto EAS em 9. Nenhum novo upload ao Play foi concluído nesta etapa.

## Atualização dos envios em 16/11/2026

- Pedido do dono: conferir onde o Claude parou e subir os builds.
- Produção atualizada do commit `bc8ec05`: backup anterior à implantação, migrações 0023 a 0025 aplicadas, API saudável e web republicada. A API perdeu o acesso à autoria oculta dos pedidos de oração anônimos, conforme conferência de privilégios no banco.
- TestFlight: iOS 1.0.0 (4), com as abas novas e oração anônima, enviado em 16/11/2026 às 09:18 (Brasília). Entrega/build `6182aa43-1645-44a9-ae17-a7dab629a32b`, `UPLOAD SUCCEEDED with no errors`, processamento `VALID`, distribuição `IN_BETA_TESTING`. Grupo interno "Equipe Uni Jovem" com acesso automático a todos os builds. Nenhum envio à revisão pública da App Store.
- Android: build local 1.0.0 (8) concluído em 16/11/2026 às 09:50 (Brasília), sem custo de nuvem, com a chave de upload existente do EAS. Arquivo `tmp/uni-jovem-1.0.0-8.aab` (112.148.982 bytes), assinatura verificada pelo `jarsigner` e impressão SHA-256 do certificado igual à chave de upload anterior (`55:93:38:...:CB:47`). Pacote `com.solerte.unijovem`, mínimo 24, destino 36. Contador remoto do EAS atualizado para 8. Enviado ao Google Play e disponível no teste interno desde 16/11/2026 às 14:34 (Brasília).
- Google Play: Android 1.0.0 (8) confirmado no Console como "Disponível para testadores internos", faixa ativa, última versão 8 (1.0.0), um código de versão, lançamento em 16/11/2026 às 14:34 (Brasília). App `4972469995880639252`, faixa `4701600075887871933`, registro `/releases/4/details`. O upload foi feito pela interface do Chrome na sessão aberta pelo dono; sem nova credencial de API. As notas pt-BR descrevem as abas novas, oração anônima e melhorias de navegação. A tela Testar e lançar também mostrou "Você não tem alterações não publicadas" antes do novo upload; o estado das antigas mudanças da ficha não foi auditado em detalhe nesta retomada.

- **Data:** 15/11/2026.
- **Quem preencheu:** agente, no Chrome do dono (conta Apple "Rafael Gomes" e conta Google Play "Rafael Gomes", já logadas), a pedido do dono.
- **Fonte do conteúdo:** [`metadados.md`](metadados.md), [`declaracao-de-dados.md`](declaracao-de-dados.md) (versão 2, de 15/11/2026, no que foi preenchido; a versão 3, do app aberto, entra no envio do binário com a ADR 0007), [`revisao-apple.md`](revisao-apple.md), [`docs/privacidade/`](../privacidade/) e `docs/DECISOES.md` (D3, D27, D31, D33).
- **O que não foi feito, de propósito (primeira rodada, 15/11/2026):** nenhum build anexado, nada enviado para revisão, nada publicado, nenhuma versão criada no Google Play, nenhum contrato ou termo novo aceito, nenhuma senha digitada, nenhuma chave de API criada.
- **Segunda rodada no Google Play (15/11/2026, 16:50 a 17:25), a pedido e com autorização do dono:** gráficos da ficha, classificação IARC (termos da IARC aceitos com autorização do dono), lista de testadores e versão 1.0.0 (3) lançada no teste interno. Nada foi enviado para produção nem para teste fechado. Detalhes na seção 7.

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
| Google | Ícone 512, imagem de destaque, capturas   | Preenchida (15/11/2026)        | `arte/icone-play-512.png`, `arte/destaque-play-1024x500.png` e as capturas `capturas/final/play/01` a `08`, nessa ordem. Declaração de IA: "Não rotular"      |
| Google | Configurações da loja: categoria e tags   | Preenchida                     | Categoria Produtividade; tags Agenda, Eventos, Produtividade                                                                                                  |
| Google | Configurações da loja: dados de contato   | Preenchida                     | `contact@solerte.com.br` e `https://unijovem.solerte.com.br/`; telefone vazio                                                                                 |
| Google | Política de privacidade                   | Preenchida                     | `https://unijovem.solerte.com.br/privacidade`                                                                                                                 |
| Google | Anúncios                                  | Preenchida                     | Não tem anúncios                                                                                                                                              |
| Google | Detalhes do login (acesso ao app)         | Preenchida, com marcadores     | Usuário "[a definir]", senha vazia, instruções em inglês                                                                                                      |
| Google | Classificação de conteúdo (IARC)          | Concluída (15/11/2026, 17:08)  | Termos da IARC aceitos com autorização do dono. Resultado: ClassInd 12, ESRB Teen, PEGI e USK 12. Respostas na seção 7.2                                      |
| Google | Público-alvo e conteúdo                   | Preenchida                     | 16 a 17 e 18 ou mais                                                                                                                                          |
| Google | Segurança dos dados                       | Preenchida                     | 10 tipos, nenhum compartilhado                                                                                                                                |
| Google | ID de publicidade                         | Preenchida                     | Não usa                                                                                                                                                       |
| Google | Apps governamentais                       | Preenchida                     | Não                                                                                                                                                           |
| Google | Recursos financeiros                      | Preenchida                     | "Meu app não oferece recursos financeiros"                                                                                                                    |
| Google | Apps de saúde                             | Preenchida                     | "Meu app não tem recursos de saúde"                                                                                                                           |
| Google | Status de comerciante e Termos de Serviço | Preenchida (15/11/2026)        | Status de comerciante herdado da conta; Termos `https://unijovem.solerte.com.br/termos`, aceitos pelo Console                                                 |
| Google | Apps de notícias                          | Não apareceu                   | O Console não pediu essa declaração para este app em 15/11/2026                                                                                               |
| Google | Teste interno                             | **Ativo (15/11/2026, 17:21)**  | Versão 3 (1.0.0), `uni-jovem-1.0.0-3.aab`, notas "Primeira versão de teste". Testador: lista "Uni Jovem - dono" (só o dono). Nome temporário "(unreviewed)"   |
| Google | Assinatura de apps                        | Ativa (Play App Signing)       | SHA-256 da chave de assinatura do app na seção 7.3                                                                                                            |
| Google | Países, versão de produção                | Pendente                       | Não criada. Ao criar a versão de produção, escolher só o Brasil. Antes da produção, o Google exige teste fechado                                              |

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
- Classificação IARC: concluída em 15/11/2026; respostas e resultado na seção 7.2.

## 3. Valores usados: privacidade

### 3.1 Apple: Privacidade do app

"Coletamos dados deste app": **sim**. Dez tipos, todos **vinculados à identidade**, todos só para **Funcionalidade do app**, nenhum usado para **rastreamento**:

Nome; Endereço de e-mail; Número de telefone; Informações confidenciais (crença religiosa); Fotos ou vídeos (foto de perfil e logotipo); Outro conteúdo do usuário; ID do usuário (inclui o identificador do Google ou da Apple); ID do dispositivo (token de push, IP truncado); Outros dados de uso; Outros tipos de dados (modelo do aparelho, faixa de idade, consentimentos).

URL da política: `https://unijovem.solerte.com.br/privacidade`. URL de escolhas de privacidade: vazia (opcional).

### 3.2 Google: Segurança dos dados

- Coleta ou compartilha dados obrigatórios: sim. Criptografados em trânsito: sim.
- Criação de conta: "Nome de usuário, senha e outras autenticações". OAuth não marcado, porque entrar com Google ou Apple não criava conta. **No envio do app aberto (ADR 0007):** marcar também OAuth e o tipo "Histórico de pesquisa no app" (opcional, efêmero), conforme [`declaracao-de-dados.md`](declaracao-de-dados.md), versão 3.
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

1. **Google, classificação de conteúdo:** feito em 15/11/2026 (seção 7.2).
2. **Apple, Privacidade do app:** clicar em "Publish" na página App Privacy depois de conferir os 10 tipos. As respostas já estão salvas.
3. **Apple, informações para a revisão:** informar telefone de contato (o App Store Connect exige), colar o contato (Rafael Gomes, `contact@solerte.com.br`), marcar "Sign-in required", preencher usuário e senha da conta demo de admin e colar as notas da seção 5 com as credenciais da conta de membro. Anexar o PNG do QR de check-in da comunidade demo.
4. **Credenciais da conta demo** (admin e membro): hoje "[a definir]" no Google; nada salvo na Apple. Gerar no roteiro da comunidade demo (T8 de [`revisao-apple.md`](revisao-apple.md)) e colar à mão; nunca no git.
5. **Produção no ar:** feito. Em 15/11/2026, às 18:32, `/`, `/privacidade`, `/termos` e `/excluir-conta` respondem 200 com o título certo (seção 7.4), e os Termos entraram em "Status de comerciante e Termos de Serviço".
6. **Capturas de tela, ícone 512 e imagem de destaque:** feito no Google Play em 15/11/2026 (seção 7.1).
7. **Build:** o AAB 1.0.0 (3) está no teste interno desde 15/11/2026, e a SHA-256 da chave de assinatura do Google Play está no `.env` de produção desde a mesma data (seção 7.3).
8. **Google, países:** ao criar a versão de produção, escolher só o Brasil (o App Store já está só no Brasil).

## 5. Notas ao revisor da Apple, prontas para colar

Versão de 15/11/2026, para o binário com o **app aberto** (ADR 0007): o revisor pode criar a própria conta, e a conta de demonstração continua, porque uma conta nova começa sem comunidade e a demo mostra o app cheio de dados. A versão anterior (entrada só por convite) está no histórico do git e vale só para um envio sem o app aberto.

Antes de colar, o dono confere no build final, tocando em cada caminho:

1. **Cadastro por e-mail:** se o envio de e-mail ainda estiver desligado em produção (PH-03), o cadastro por e-mail não aparece. Nesse caso, apague o trecho "or with e-mail and password (we send a 6-digit code to that address)".
2. **Google:** "Entrar com Google" estava desligado em produção em 15/11/2026. Só cite o Google se ele estiver ligado no build enviado.
3. **Excluir conta criada com a Apple:** a conta criada só com a Apple não tem senha; a exclusão precisa confirmar entrando de novo com a Apple (`docs/privacidade/exclusao-de-conta.md`, seção 2.1). Se isso não estiver pronto, **não envie**: a diretriz 5.1.1(v) reprova.
4. **Credenciais:** troque os "[a definir]" à mão no App Store Connect; nunca no git.
5. **Nomes de aba e de botão:** "Criar conta", "Criar comunidade", "Tenho um código", "Procurar comunidade" e "Denunciar comunidade" são os nomes das telas em construção em 15/11/2026; ajuste ao texto final.

```
ABOUT THE APP
Uni Jovem helps church youth groups organize their weekly program and special events: schedules with timed steps, volunteer rosters, tasks, sign-ups, attendance check-in, prayer requests and announcements. The interface is in Brazilian Portuguese.

The app serves many independent youth groups ("communities"). Each community only sees its own data. Anyone aged 16 or older can create an account and then join a community with an invitation, with the community's code, or by sending a join request that the community's leaders approve. Any account with a confirmed e-mail can also create a community and becomes its admin, after accepting a community administrator agreement. New communities have limits until our team verifies them: at most 30 members and no public event sign-up page. Accounts are for people aged 16 or older, as stated in our terms of use, so the age rating is set to 16+.

YOU CAN CREATE YOUR OWN ACCOUNT
On the first screen, tap "Criar conta" (Create account) and use Sign in with Apple, or e-mail and password (we send a 6-digit code to that address). You will be asked for your age range and to accept the terms. A new account starts without any community: you can create one ("Criar comunidade", Create community) to see the admin tools of a new community, or use the demo accounts below to see a community already filled with data.

DEMO ACCOUNTS
We also keep an isolated demo community, "Comunidade Demonstração", filled with fictitious data.
1. Admin account (sees every feature): the credentials in the Sign-In fields above.
2. Member account (to see the member view, or to test account deletion): [a definir] / [a definir]
Neither account uses two-factor authentication. Please use the member account (or your own account) to test account deletion, so the admin account stays available for future reviews. If you delete the admin account, it is also fine: the community has a second admin.

HOW TO SIGN IN WITH A DEMO ACCOUNT
Open the app, tap "Entrar" (Sign in), type the e-mail and password, and tap "Entrar".

WHERE THINGS ARE (tab names in Portuguese)
- Início (Home): upcoming events, my rosters, announcements, verse of the day.
- Agenda (Calendar): "Calendário" (month and week) or "Lista" (all gatherings, with search and filters). Open "Sábado padrão" to see the program ("Roteiro"), who serves, tasks, checklists and attendance.
- Escalas (Rosters): my assignments (accept, "Não posso ir" / can't go, ask for a substitute) and availability; organizers also see who has not answered yet.
- Comunidade (Community): announcements, prayer requests, suggestions, content, reports (organizers), members, roles, invitations, join requests and the community code.
- Perfil (Profile): personal data, notification settings, security (two-factor authentication, connected devices), "Privacidade e dados" (privacy and data), "Ajuda e sobre" (help, terms) and "Mais opções" (more options: blocked people, offline use, join or create a community, report a community).
Without a community, the app shows "Tenho um código" (I have a code), "Procurar comunidade" (Find a community) and "Criar comunidade" (Create community).

ACCOUNT DELETION (Guideline 5.1.1(v))
Perfil > "Privacidade e dados" (Privacy and data) > "Excluir conta" (Delete account). Accounts with a password confirm with the password; accounts created with Sign in with Apple confirm by signing in with Apple again. The account and its personal data are deleted; the authorship of shared records becomes "Pessoa removida" (Removed person). The same can be requested on the web at https://unijovem.solerte.com.br/excluir-conta

CAMERA AND PHOTOS
The camera scans the attendance QR code at the event entrance: Agenda > "Lista" > "Sábado padrão" > "Check-in" > "Ler QR com a câmera" (Scan QR with the camera). Without the camera, attendance can also be marked by searching the person's name and tapping "Marcar presença". The camera and the photo library are also used, only when the user chooses, for an optional profile photo or the community logo.

OFFLINE BY DESIGN
On the event page, "Preparar para usar sem internet" downloads the program, roster and attendance list. With the device offline, attendance and live steps still work and are sent when the connection returns. Editing, invitations and administration require a connection on purpose.

USER-GENERATED CONTENT AND SAFETY (Guideline 1.2)
- Terms: every account accepts the terms of use before using the app, and every community admin accepts an administrator agreement covering data use, minimum age and moderation (https://unijovem.solerte.com.br/termos#administrador).
- Report content: prayer requests shared with others, suggestions and announcements have "Denunciar" (Report). Community admins review reports, can remove the content and can remove or deactivate members.
- Block: "Bloquear esta pessoa" (Block this person) hides that person's prayer requests and suggestions from the user.
- Report a community: "Denunciar comunidade" (Report community), from a search result or inside the community, goes to our team, never to the community.
- Our team verifies new communities, reviews community reports and can suspend or remove a community or an account.
- Community search shows only communities that chose to appear, by name and city, and never shows members or member counts. There are no direct messages, no public profiles and no feed.
- Prayer requests have three visibility levels chosen by the author: only me (default), prayer team, or the whole community.
- Contact: contact@solerte.com.br, also on the support page.

NO PURCHASES, NO ADS, NO TRACKING
The app has no in-app purchases, no advertising and no tracking.

The backend is our own server and is online during the review period. If anything does not work as described, please write to us through App Review and we will answer the same day.
```

**Em português, para conferência do dono:** o texto diz que qualquer pessoa com 16 anos ou mais cria conta e entra numa comunidade por convite, código ou pedido aprovado; que qualquer conta com e-mail confirmado cria comunidade e vira admin depois de aceitar o termo; que comunidade nova tem até 30 pessoas e não publica página aberta de evento até a verificação; que o revisor pode criar a própria conta (com a Apple ou, se o e-mail estiver ligado, por e-mail) ou usar as contas de demonstração; onde excluir a conta (com senha, ou entrando de novo com a Apple); e as ferramentas de segurança: termos aceitos, denúncia de conteúdo, bloqueio, denúncia de comunidade, verificação e suspensão pela equipe, busca sem pessoas e o contato.

## 6. Divergências encontradas e recomendações

1. **[`metadados.md`](metadados.md) na idade:** corrigido em 15/11/2026 (16+ na Apple pela idade mínima dos termos; público 16 a 17 e 18 ou mais no Google).
2. **ID de publicidade:** `com.google.android.gms.permission.AD_ID` já está em `apps/app/app.config.ts#blockedPermissions`; conferir o manifesto do AAB final.
3. **Câmera e foto de perfil (D33):** resolvido em 15/11/2026. Os textos de permissão da câmera e da galeria citam o QR de presença, a foto de perfil e o logotipo (TC-11.v2); a nota ao revisor deve mencionar a foto de perfil opcional.
4. **Google, Detalhes do login:** a opção "Permita que o Google use esses detalhes de login para testes em dispositivos do Google e de parceiros" ficou ligada (padrão do Console). Desligar se o dono não quiser testes automáticos mexendo na comunidade demo.
5. **Apple, disponibilidade em Mac com Apple Silicon e Vision Pro:** ficou o padrão do App Store Connect; não foi alterado.
6. **Apple, Acessibilidade do app (rótulos de acessibilidade):** seção opcional nova, não preenchida.

## 7. Google Play, segunda rodada (15/11/2026)

### 7.1 Ficha principal: gráficos

- Ícone: `arte/icone-play-512.png`. Recurso gráfico: `arte/destaque-play-1024x500.png`.
- Capturas de telefone, nesta ordem: `01-inicio`, `02-programacao`, `03-ao-vivo`, `04-escalas`, `05-presenca`, `06-novo-pedido`, `07-agenda`, `08-equipe` (`capturas/final/play/`). As capturas `09` e `10` ficaram de fora porque o limite é 8.
- Declaração de recursos de IA: "Não rotular recursos". A arte foi desenhada em código (commit `7e0b3c9`) e as capturas vêm do app.
- **Descrição completa:** trocada em 15/11/2026, a pedido do dono, pelo texto do app aberto de [`metadados.md`](metadados.md), seção 2.3 (2.569 caracteres). A descrição curta não mudou. A mudança ficou salva sem envio para revisão. Atenção: o AAB 1.0.0 (3) do teste interno é anterior ao app aberto (entrada só por convite); a ficha só fica pública com a versão de produção, que precisa ser o build do app aberto.

### 7.2 Classificação de conteúdo (IARC)

E-mail de contato: `contact@solerte.com.br`. Categoria: "Todos os Outros Tipos de Aplicações". Termos de Uso da IARC aceitos com autorização do dono. Enviada em 15/11/2026, 17:08.

| Pergunta                                                                 | Resposta | Motivo                                                                                        |
| ------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------- |
| Conteúdo com classificação relevante dentro do pacote                    | Não      |                                                                                               |
| Usuários interagem ou trocam conteúdo                                    | Sim      | Pedidos de oração compartilhados, sugestões, avisos                                           |
| Conteúdo dos usuários é a principal fonte de conteúdo                    | Sim      | Programação, escalas, avisos e pedidos são escritos pelas pessoas da comunidade               |
| Compartilhamento público de nudez                                        | Não      | Imagens só de perfil e logotipo, visíveis só dentro da comunidade                             |
| Compartilhamento público de violência explícita real                     | Não      |                                                                                               |
| Bloquear usuários ou conteúdo                                            | Sim      | "Bloquear esta pessoa" (`funcionalidades/denuncias/TelaPessoasBloqueadas`)                    |
| Denunciar usuários ou conteúdo                                           | Sim      | "Denunciar" em pedidos, sugestões e avisos (`funcionalidades/denuncias/BotaoDenunciar`)       |
| Moderação de conversas por chat                                          | Não      | O app não tem chat                                                                            |
| Interações limitadas a amigos convidados                                 | Sim      | A interação só acontece dentro da comunidade, que admite por convite, código ou pedido aceito |
| Destaca conteúdo de fora do pacote (catálogos, notícias, conteúdo de IA) | Não      | O versículo do dia é texto curto escolhido pelo app, não um catálogo                          |
| Promove produtos ou atividades com restrição de idade                    | Não      |                                                                                               |
| Compartilha a localização exata com outros usuários                      | Não      | O app não lê localização                                                                      |
| Compras de itens digitais                                                | Não      |                                                                                               |
| Recompensas em dinheiro, cripto ou equivalentes                          | Não      |                                                                                               |
| Navegador ou buscador                                                    | Não      |                                                                                               |
| Principalmente notícia ou produto educativo                              | Não      |                                                                                               |

**Resultado:** ClassInd **12 anos** (descritor "Linguagem Imprópria", elemento interativo "Usuários Interagem"), ESRB Teen, PEGI "Supervisão adulta", USK 12. O [`metadados.md`](metadados.md), seção 5.2, esperava Livre. A diferença vem de "conteúdo dos usuários é a principal fonte", que é a resposta verdadeira. Como o app já exige 16 anos (D27), a classificação 12 não conflita com a idade mínima.

### 7.3 Teste interno e assinatura

- **Testadores:** lista de e-mails nova "Uni Jovem - dono", só com o e-mail do dono. As listas "Casal" e "Meus chegados", de outros apps da conta, não foram marcadas.
- **Versão:** `uni-jovem-1.0.0-3.aab` (código de versão 3, nome 1.0.0, API 24 ou superior, SDK de destino 36), notas pt-BR "Primeira versão de teste". Lançada em 15/11/2026, 17:21, status "Disponível para testadores internos", "Não revisado". Até a revisão, o app aparece para o testador como "com.solerte.unijovem (unreviewed)". O link de participação está em Teste interno > Testadores > "Copiar link".
- **Como o AAB subiu:** a extensão do Chrome envia no máximo cerca de 10 MB por vez, e o AAB tem 113 MB. Um servidor local temporário em `127.0.0.1` entregou o arquivo à página do Console, que o colocou no campo de envio. O servidor foi desligado em seguida.
- **SHA-256 da chave de assinatura do app** (Play App Signing, gerada pelo Google; é a que assina o app instalado pela loja):

  `E3:99:6F:07:5D:EC:1A:DF:84:4A:AF:54:00:A3:09:1B:08:C5:92:7C:12:99:41:40:4F:2B:4D:B5:34:89:98:4F`

  Fonte: Console > Proteger com o Google Play > Assinatura de apps, snippet "JSON do protocolo Digital Asset Links". É diferente da SHA-256 da chave de upload (`55:93:38:...:CB:47`), que já estava no `.env` de produção. **Feito em 15/11/2026:** a SHA-256 do Google Play entrou em `ANDROID_SHA256_IMPRESSOES` no `.env` de produção (no Mac, só essa linha editada, cópia anterior em `.env.antes-impressao-play-20261115`, permissão 600 mantida), e a API e as tarefas foram recriadas com `docker compose up -d --no-deps --force-recreate api tarefas`. Evidência: `/api/saude` responde 200, os contêineres ficam `healthy`, e `https://unijovem.solerte.com.br/.well-known/assetlinks.json` lista as duas impressões (upload e Google Play).

### 7.4 "Página não encontrada" na visão geral da publicação (15/11/2026, noite)

Ao pedir o envio para revisão, o Console listou 3 problemas: política de privacidade, exclusão de conta e exclusão de dados com "Página não encontrada". As URLs cadastradas estavam certas (`/privacidade` e `/excluir-conta`). Às 18:32 as páginas respondiam 200 com o título certo, de dentro e de fora do Brasil, com HEAD, HTTP/1.0 e agentes do Google. Mesmo assim, a checagem rápida refeita depois de regravar as mesmas URLs voltou com os 3 problemas: o Google usava uma cópia guardada de antes do domínio público responder (PH-04).

O que resolveu foi cadastrar uma URL que o Google ainda não conhecia, que aponta para a mesma página:

- Política de Privacidade: `https://unijovem.solerte.com.br/privacidade?origem=play`.
- Segurança dos dados, exclusão de conta e exclusão de dados: `https://unijovem.solerte.com.br/excluir-conta?origem=play`.

Com isso, a checagem rápida passou ("As mudanças podem ser enviadas para revisão"). O parâmetro `origem` é ignorado pela API. Pode voltar à URL sem parâmetro mais tarde, quando o Google tiver visitado a página de novo.

**Envio para revisão das 9 mudanças: pendente do dono.** A trava de segurança do agente bloqueou o clique em "Enviar 9 mudanças para revisão"; o dono clica em Visão geral da publicação.

A variante com barra final (`/privacidade/`, `/excluir-conta/`, `/termos/`) responde 404. Não está cadastrada em lugar nenhum, mas fica registrada caso alguém digite assim.

### 7.5 Builds e servidores (15/11/2026, noite, e 16/11/2026)

- **Produção:** app aberto implantado em 15/11/2026, com a migração 0022, a pedido do dono ("SIM"). A 0023 (convocação) está **só na homologação**: a trava do agente barrou a implantação na produção em 16/11/2026. Falta o dono rodar `UJ_CONFIRMO_PRODUCAO=sim bash infra/prod/implantar.sh`.
- **TestFlight:** 1.0.0 (2), do commit `876fdcc` (app aberto), enviado em 15/11/2026 às 23:04 (entrega `f084cb98-24e4-4d6c-b1c7-922e30bb2e18`), com "Entrar com a Apple" assinado. O grupo interno "Equipe Uni Jovem" recebe todos os builds.
- **Google Play, teste interno:** 1.0.0 (4), do EAS `160c5226`, publicado em 15/11/2026 às 23:35, com as notas "Nova versão de teste...".
- **Login:** a produção aceita Apple (padrão `com.solerte.unijovem`); Google está desligado (sem `GOOGLE_CLIENT_IDS`, PH-14) e o e-mail também (`EMAIL_MODO=desligado`, PH-03). No Android, sem esses dois, quem não tem conta não consegue se cadastrar.
- **Builds com a convocação (commit `ba85cef`):** iOS 1.0.0 (3) no TestFlight em 16/11/2026 às 00:45 (entrega `bda36734-0efc-4b6e-80af-cd462326e236`) e Android 1.0.0 (5) no teste interno às 00:50 (EAS `72859858`). Os dois têm o seletor de data e hora em folha no iPhone, o aceite do Termo do Administrador corrigido e a convocação. O aviso de recusa e a ordem do Início dependem da 0023 na produção.

### 7.6 Builds de 22/11/2026 (commit `14debdd`)

- **Produção:** implantada em 22/11/2026 (00:01, com backup `diario-2026-11-22.dump`), com as migrações 0026 (cadastro sem confirmação de e-mail) e 0027 (repertório e cifra). Saúde 200; rotas novas respondem 401 sem sessão. `GOOGLE_CLIENT_IDS` com os 4 clientes (iOS, Web e Android assinatura e upload).
- **TestFlight:** 1.0.0 (7), entrega `b0b6d818-b4a0-45cc-a9c4-ad8026591dc2`, processado (`VALID`). Traz o login novo, o Início novo, a simplificação e o modo músico.
- **Android 1.0.0 (11):** compilado localmente, assinado com a chave de upload (SHA-256 do certificado `55:93:38:...:CB:47` conferido), em `tmp/uni-jovem-1.0.0-11.aab`. **Não está no Play:** o Chrome bloqueia o acesso da página do Console à rede local, então o envio fica com o dono (arrastar o arquivo em Teste interno > Criar nova versão, ou liberar "Acesso à rede local" para o Play Console). O teste interno segue na versão 8, com um rascunho vazio.
- **Clientes do Google (PH-14):** criados em 21/11/2026 (Web de produção, Android assinatura e Android upload); tela de consentimento publicada.

### 7.7 Build Android de 22/11/2026 (commit `d73220d`, app v3 Direção A)

- **Android 1.0.0 (13):** compilado localmente em 22/11/2026 (`BUILD SUCCESSFUL in 4m 36s`, Gradle `:app:bundleRelease`, Java 21 do Android Studio, sem custo de nuvem), a partir do commit `d73220d` (app v3 Direção A, ondas 1 e 2 mais as pendências de QA), com a fonte copiada de `git archive HEAD` para `C:/ujb` e o ambiente nativo já gerado (sem mudança de `app.config.ts`, `package.json` nem de assets desde o (11)). Variante de produção, API `https://unijovem.solerte.com.br`.
- **Arquivo:** `tmp/uni-jovem-1.0.0-13.aab`, 112.961.137 bytes, SHA-256 `b99565a4cb8df49dd0a89254797b86eba37fa2a0a8f392e82ab95d5b7248a9c2`.
- **Conferências:** `jarsigner -verify` devolve `jar verified`; certificado SHA-256 `55:93:38:FC:BF:34:77:2A:7B:D4:D7:57:95:68:63:DF:EF:29:5F:A1:DC:D7:55:78:42:D1:F8:B7:DB:C0:CB:47`, igual ao da chave de upload; manifesto do módulo base com `com.solerte.unijovem`, versão 1.0.0, código 13. Daemons do Gradle encerrados ao fim.
- **Não enviado ao Play:** o envio ao teste interno continua com o dono (arrastar o arquivo em Teste interno > Criar nova versão). Nenhum envio ao Play foi feito nesta etapa. A conferência no aparelho Android continua pendente.

### 7.8 Build Android de 22/11/2026 (commit `d18f290`, app v3 com simplificação e PDF por música)

- **Android 1.0.0 (14):** compilado localmente em 22/11/2026 (`BUILD SUCCESSFUL in 22m 19s`, Gradle `:app:bundleRelease`, Java 21 do Android Studio, CMake 3.31.1 e Ninja em `C:/ujcmake`, sem custo de nuvem), a partir do commit `d18f290`. Variante de produção, API `https://unijovem.solerte.com.br`, clientes do Google de produção (os mesmos do perfil `producao` do `eas.json`).
- **O que mudou desde o (13):** o código do app (E24 e E25: convocar sem bloqueio indevido, repertório e banda visíveis a todos, faixa do Início coerente, "Quem vai", Desfazer confiável, Início de uma ação, passada do vovô e PDF por música, D73 a D76) e **uma dependência nativa nova, `expo-document-picker`** (`apps/app/package.json` e `package-lock.json`). Por isso, ao contrário do (13), a fonte foi recopiada de `git archive HEAD` para `C:/ujb`, `npm ci` foi refeito e o ambiente nativo foi regenerado com `npx expo prebuild --platform android --clean` (o build levou 22 min porque o Gradle recompilou as quatro arquiteturas nativas do zero).
- **Arquivo:** `tmp/uni-jovem-1.0.0-14.aab`, 113.009.875 bytes, SHA-256 `808395d93cbad8a93ce307091576e88763e227cb201e79fe51e44d3f7cd9eb1e`.
- **Conferências:** `jarsigner -verify` devolve `jar verified`; certificado SHA-256 `55:93:38:FC:BF:34:77:2A:7B:D4:D7:57:95:68:63:DF:EF:29:5F:A1:DC:D7:55:78:42:D1:F8:B7:DB:C0:CB:47`, igual ao da chave de upload; manifesto mesclado com `com.solerte.unijovem`, versão 1.0.0, código 14 (SDK mínimo 24, alvo 36). As classes do `expo-document-picker` estão no `classes.dex`.
- **Permissões:** a lista do manifesto do módulo base é idêntica à do (13). Nenhuma das bloqueadas pelo projeto entrou (`RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`, `AD_ID`, `USE_EXACT_ALARM`, `SCHEDULE_EXACT_ALARM`). O seletor de documentos usa o seletor do sistema e não pede permissão de armazenamento.
- **Não enviado ao Play:** o envio ao teste interno continua com o dono (arrastar o arquivo em Teste interno > Criar nova versão). Nenhum envio ao Play foi feito nesta etapa. A conferência no aparelho Android continua pendente (o seletor de arquivos do PDF por música só foi provado em teste, não no aparelho). Daemons do Gradle encerrados ao fim.
