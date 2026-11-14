# Revisão da Apple: notas para o revisor e diretrizes de risco

- **Versão:** 1, de 14/11/2026.
- **Decisão de base:** D3 (app **público** na App Store, entrada só por convite, comunidade e conta de demonstração para revisores).
- **Diretrizes citadas:** [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), lidas em 14/11/2026. A página não mostra data de atualização; releia antes de cada envio.

---

## 1. Por que este app é o caso que a Apple mais questiona

Quem baixa o Uni Jovem sem convite vê só a tela de entrada. Para a revisão, isso levanta três perguntas, com palavras diferentes:

1. "Como eu testo, se não posso criar conta?" (diretriz 2.1)
2. "Isso é um app para uma organização só? Então não é para a loja pública." (introdução das diretrizes e distribuição não listada)
3. "Se tem conta, onde a pessoa exclui a conta?" (5.1.1(v))

As notas abaixo respondem as três antes que o revisor pergunte. A resposta à segunda é verdadeira só se a página de suporte disser como uma liderança pede uma comunidade (ver [`metadados.md`](metadados.md), seção 7).

---

## 2. Notas para o revisor (campo "Notes" em App Review Information)

O app é em português. As notas vão **em inglês**, porque é a língua de trabalho da revisão; o Google exige credenciais em inglês pelo mesmo motivo. É a única parte deste projeto escrita em inglês, por imposição do processo de revisão (exceção prevista na regra 6 do `CLAUDE.md`). A versão em português vem logo depois, para o dono conferir o que está assinando.

Campos do formulário:

| Campo            | Valor                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------- |
| Sign-in required | Yes                                                                                     |
| User name        | [PREENCHER: e-mail da conta demo de admin]                                              |
| Password         | [PREENCHER: senha da conta demo de admin]                                               |
| Notes            | texto abaixo                                                                            |
| Attachment       | imagem PNG do QR Code de check-in de uma inscrição da comunidade demo (seção 5, item 6) |
| Contact          | [PREENCHER: nome, telefone e e-mail do dono para a revisão]                             |

### 2.1 Texto para colar (inglês)

Os nomes de tela e de botão abaixo seguem o plano (seção 6) e as telas que já existem em `apps/app/src`. Telas de presença, ao vivo, oração e exclusão ainda não existem no app em 14/11/2026: **cada caminho citado é conferido no build final, tocando nele, antes de colar** ([`checklist.md`](checklist.md), passo A12).

```
ABOUT THE APP
Uni Jovem helps church youth groups organize their weekly program and special events: schedules with timed steps, volunteer rosters, tasks, sign-ups, attendance check-in, prayer requests and announcements. The interface is in Brazilian Portuguese.

The app serves many independent youth groups ("communities"). Each community only sees its own data. There is no open sign-up: a community leader invites each person, and the invite defines their role (admin, organizer or member). Leaders who want a community for their group request it through the support page.

DEMO ACCOUNTS
We created an isolated demo community, "Comunidade Demonstração", filled with fictitious data.
1. Admin account (sees every feature): the credentials in the Sign-In fields above.
2. Member account (to see the member view, or to test account deletion): [PREENCHER: e-mail] / [PREENCHER: senha]
Neither account uses two-factor authentication. Please use the member account to test account deletion, so the admin account stays available for future reviews. If you delete the admin account, it is also fine: the community has a second admin.

HOW TO SIGN IN
Open the app, tap "Entrar" (Sign in), type the e-mail and password, and tap "Entrar".

WHERE THINGS ARE (tab names in Portuguese)
- Início (Home): upcoming events, my rosters, announcements, verse of the day.
- Agenda (Calendar): month, week and day timeline.
- Programações (Programs): event list. Open "Sábado padrão" to see steps, roster, tasks, checklists and attendance.
- Comunidade (Community): members, roles and invitations.
- Perfil (Profile): personal data, notifications, connected devices, two-factor authentication, privacy policy, and account deletion.

ACCOUNT DELETION (Guideline 5.1.1(v))
Perfil > "Excluir conta" (Delete account). [CONFIRMAR o caminho e o texto quando a F18 entregar a tela] The account and its personal data are deleted; the authorship of shared records becomes "Pessoa removida" (Removed person). The same can be requested on the web at https://unijovem.solerte.com.br/excluir-conta

CAMERA
The camera is used only to scan the attendance QR code at the event entrance: Programações > "Sábado padrão" > Presença (Attendance) > "Ler QR Code". You can scan the QR code image attached to this submission. No photo is taken or stored. Without the camera, attendance can also be marked by searching the person's name and tapping "Marcar presença".

OFFLINE BY DESIGN
On the event page, "Preparar para usar sem internet" downloads the program, roster and attendance list. With the device offline, attendance and live steps still work and are sent when the connection returns. Editing, invitations and administration require a connection on purpose.

USER CONTENT AND SAFETY
Prayer requests have three visibility levels chosen by the author: only me (default), prayer team, or the whole community. Content shared with others can be reported in the app with "Denunciar" (Report), community admins can remove reported content and remove or deactivate members, and the support page has a contact e-mail. [CONFIRMAR: só manter este parágrafo quando a denúncia e a moderação existirem no binário; ver a seção 3, diretriz 1.2]

NO PURCHASES, NO ADS, NO TRACKING
The app has no in-app purchases, no advertising and no tracking.

The backend is our own server and is online during the review period. If anything does not work as described, please write to us through App Review and we will answer the same day.
```

### 2.2 O mesmo texto em português (para conferência do dono)

Sobre o app: organiza a programação semanal e os eventos especiais de grupos de jovens de igreja (programação com etapas e horários, escalas, tarefas, inscrições, presença, pedidos de oração e avisos). Interface em português. Atende muitos grupos independentes, cada um vê só os próprios dados. Não há cadastro aberto: a liderança convida cada pessoa e o convite define o papel. Lideranças que querem uma comunidade pedem pela página de suporte.

Contas de demonstração: uma de admin (nos campos de login) e uma de membro (para ver a visão de membro ou testar a exclusão de conta). Nenhuma das duas usa 2FA. Pedimos que a exclusão seja testada com a conta de membro; se o revisor excluir a de admin, a comunidade tem um segundo admin.

Como entrar, onde fica cada coisa, exclusão de conta (Perfil > Excluir conta, e na web), câmera só para o QR de presença (com alternativa por nome), funcionamento sem internet por desenho, privacidade dos pedidos de oração e denúncia de conteúdo, sem compras, sem anúncios, sem rastreamento, servidor no ar durante a revisão.

### 2.3 O que nunca vai nas notas

- A conta do dono, a conta do Criador ou qualquer conta com dado real (D3, PUB-04).
- Senha que expira, conta com 2FA ou com código por e-mail no login: o revisor não tem como receber o código e a Apple reprova por 2.1.
- Promessa de função que o binário não tem. Os trechos marcados [CONFIRMAR] saem se a função não estiver no build.

---

## 3. Diretrizes que reprovam app só por convite, e como o Uni Jovem atende

Ordem: da mais provável de reprovar para a menos. "Estado em 14/11/2026" é o que o repositório mostra hoje.

| Diretriz                                                                                                                                     | O que a Apple exige (resumo da redação vigente)                                                                                                                                                                                                                                                                                                                                                                                                               | Como o Uni Jovem atende                                                                                                                                    | Estado em 14/11/2026                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **5.1.1(v) Exclusão de conta**                                                                                                               | App que permite criar conta precisa permitir **iniciar a exclusão dentro do app**, fácil de achar (em geral nos ajustes da conta). Desativar a conta não basta. Pode haver confirmação e verificação de identidade, mas não pode exigir ligação, e-mail ou atendimento. Se demorar, dizer quanto tempo leva e confirmar quando terminar ([Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)) | Perfil > Excluir conta, com confirmação; anonimiza a autoria ("Pessoa removida") e apaga o dado pessoal (PAP-05, PRIV-03); a mesma ação pela web           | **Não existe.** Sem isto a reprovação é certa. Requisito: a exclusão não pode ser barrada pela regra "a comunidade nunca fica sem admin" sem oferecer saída na mesma tela (por exemplo, indicar outro admin ou, sendo o último, explicar e permitir excluir mesmo assim com a intervenção prevista do Criador). Uma exclusão que o app recusa é lida como "exclusão inexistente" |
| **2.1 Completude do app**                                                                                                                    | Incluir conta de demonstração e **manter o servidor ligado**; app que trava ou mostra erro óbvio é recusado. Modo demo embutido só com aprovação prévia da Apple                                                                                                                                                                                                                                                                                              | Duas contas demo numa comunidade demo de produção, isolada, com dados fictícios (seção 5)                                                                  | **Não existe** a comunidade demo nem o roteiro que a cria. O servidor é doméstico (L06): a revisão pode acontecer de madrugada, e servidor fora do ar é reprovação por 2.1                                                                                                                                                                                                       |
| **1.2 Conteúdo gerado por usuário**                                                                                                          | App com conteúdo de usuário precisa de: filtro de material ofensivo antes da publicação; **mecanismo de denúncia** com resposta rápida; **bloquear** usuários abusivos; contato publicado                                                                                                                                                                                                                                                                     | Hoje: sugestões são moderadas por organizadores (`0009_oracao_sugestoes_conteudos_avisos.sql#sugestoes_moderar`); admin desativa ou remove membro (PAP-05) | **Lacuna.** Não há denúncia em lugar nenhum do código; pedido de oração "Comunidade" só pode ser excluído pelo autor (`0009_oracao_sugestoes_conteudos_avisos.sql#pedidos_oracao_excluir`), então ninguém da liderança consegue tirar do ar um pedido ofensivo; não há filtro. Ver "Tarefas de produto" abaixo                                                                   |
| **Público limitado** (introdução das diretrizes; [distribuição não listada](https://developer.apple.com/support/unlisted-app-distribution/)) | App feito para uma organização específica tende a ser direcionado para distribuição não listada ou privada                                                                                                                                                                                                                                                                                                                                                    | O Uni Jovem é plataforma para várias comunidades (D6), cada uma isolada; qualquer liderança pode pedir uma comunidade                                      | Depende da página de suporte dizer isso (hoje não existe). **Plano B** abaixo                                                                                                                                                                                                                                                                                                    |
| **5.1.1(i) Política de privacidade**                                                                                                         | Link na ficha **e dentro do app**, de fácil acesso; a política diz o que coleta, como, para quê, com quem compartilha, retenção, exclusão e como revogar consentimento                                                                                                                                                                                                                                                                                        | Link em Perfil e na tela de entrada; texto a partir de [`declaracao-de-dados.md`](declaracao-de-dados.md)                                                  | **Não existe** a rota `/privacidade` nem o link no app                                                                                                                                                                                                                                                                                                                           |
| **4.2 Funcionalidade mínima**                                                                                                                | O app precisa ir além de um site empacotado, com utilidade duradoura                                                                                                                                                                                                                                                                                                                                                                                          | App nativo (Expo, não WebView), câmera para QR, uso sem internet no dia do evento, ao vivo, notificações nativas, cofre do sistema para a sessão           | Baixo risco quando F12 a F14 estiverem no binário. Se o build enviado tiver só a casca (entrar, comunidade, perfil), o risco sobe: o revisor vê pouco além de login e listas                                                                                                                                                                                                     |
| **2.3.3 Capturas**                                                                                                                           | Capturas mostram o app em uso, não só a tela de entrada ou a abertura                                                                                                                                                                                                                                                                                                                                                                                         | Roteiro em [`capturas.md`](capturas.md), só telas com dados                                                                                                | Depende das telas existirem                                                                                                                                                                                                                                                                                                                                                      |
| **2.2 Beta**                                                                                                                                 | Demo, beta e versão de teste vão para o TestFlight, não para a loja                                                                                                                                                                                                                                                                                                                                                                                           | Versão de loja 1.0.0                                                                                                                                       | `apps/app/app.config.ts#VERSAO` é `0.1.0`; trocar antes do build de loja ([`metadados.md`](metadados.md), seção 8)                                                                                                                                                                                                                                                               |
| **5.1.1 Permissões (texto de uso)**                                                                                                          | Texto de permissão claro sobre o uso real; pedir só o necessário                                                                                                                                                                                                                                                                                                                                                                                              | `apps/app/app.config.ts#TEXTO_CAMERA`: "A câmera é usada só para ler o QR Code de presença na entrada de um evento. Nenhuma foto é tirada nem guardada."   | Texto bom. **Permissão sem tela que a use**: se o build for sem a tela de QR, tirar a permissão                                                                                                                                                                                                                                                                                  |
| **2.4.1 iPad**                                                                                                                               | App de iPhone deve funcionar no iPad sempre que possível; a revisão abre apps de iPhone no iPad em modo de compatibilidade                                                                                                                                                                                                                                                                                                                                    | `supportsTablet: false`; o app roda ampliado no iPad                                                                                                       | Testar no simulador de iPad antes de enviar ([`checklist.md`](checklist.md))                                                                                                                                                                                                                                                                                                     |
| **4.8 Serviços de login**                                                                                                                    | Login social exige uma opção equivalente                                                                                                                                                                                                                                                                                                                                                                                                                      | Não se aplica: só conta própria (e-mail e senha)                                                                                                           | Atende                                                                                                                                                                                                                                                                                                                                                                           |
| **3.1.1 Compras**                                                                                                                            | Bem digital dentro do app passa pela compra da Apple                                                                                                                                                                                                                                                                                                                                                                                                          | Não se aplica: sem cobrança na v1                                                                                                                          | Atende                                                                                                                                                                                                                                                                                                                                                                           |

### 3.1 Tarefas de produto que estas diretrizes criam (para o roadmap, não para a véspera)

Conformidade é requisito de lançamento. Estas tarefas entram nas fases que já existem, e o envio à revisão espera por elas:

| #   | Tarefa                                                                                                                                                                                           | Fase sugerida | Diretriz                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | --------------------------------------------- |
| T1  | Excluir conta no Perfil, com confirmação, prazo informado e confirmação ao terminar; página web `/excluir-conta` com o mesmo efeito; regra do último admin com saída na própria tela             | F18           | 5.1.1(v); Google                              |
| T2  | "Denunciar" em pedido de oração visível a outros, em aviso e em sugestão respondida; denúncia chega à liderança da comunidade com prazo de resposta; registro na auditoria sem o texto do pedido | F15           | 1.2; Google UGC                               |
| T3  | Liderança (organizador ou acima) pode **ocultar** pedido de oração com visibilidade "Comunidade" ou "Equipe" que foi denunciado, sem passar a ler pedidos "Somente eu" (PAP-04 continua valendo) | F15           | 1.2                                           |
| T4  | "Ocultar pessoa" para cada membro (bloqueio do ponto de vista de quem bloqueia) além da remoção pelo admin                                                                                       | F15           | 1.2; Google exige bloqueio de usuários no app |
| T5  | Filtro simples de termos ofensivos no servidor antes de gravar pedido, sugestão e aviso (o texto do pedido é filtrado em memória antes de cifrar, e nunca vai para log)                          | F15           | 1.2                                           |
| T6  | Aceite dos termos de uso antes de publicar conteúdo (no cadastro por convite), com o que é proibido                                                                                              | F18           | Google UGC; 1.2                               |
| T7  | Link da política de privacidade e da página de suporte no Perfil e na tela de entrada                                                                                                            | F18           | 5.1.1(i); 1.2 (contato publicado)             |
| T8  | Roteiro idempotente que cria ou restaura a comunidade demo e as contas de revisão em produção (seção 5)                                                                                          | F19           | 2.1                                           |

### 3.2 Plano B: distribuição não listada

Se a Apple responder que o app é para público limitado, a saída prevista pela própria Apple é a **distribuição não listada**: o app continua na App Store, passa pela mesma revisão, mas só é encontrado por link direto, fora de busca, categorias e rankings. Pede-se com uma nota na revisão e um formulário; um app já publicado pode mudar para não listado e mantém o link ([Unlisted app distribution](https://developer.apple.com/support/unlisted-app-distribution/), consultada em 14/11/2026). Para o Uni Jovem, que entra só por convite com link, o efeito prático é pequeno.

Isto **muda a D3** (de "público" para "não listado"), então é decisão do dono, tomada só se a Apple pedir. O Google não tem equivalente para a ficha pública; lá o plano B seria manter o app num teste fechado permanente.

---

## 4. Conformidade de exportação (criptografia)

`apps/app/app.config.ts` declara `ITSAppUsesNonExemptEncryption: false`. Com o SQLCipher ligado (`apps/app/app.config.ts#useSQLCipher`), a pergunta é se o app usa criptografia fora da do sistema da Apple, o que mudaria a resposta.

- No iOS, o `expo-sqlite` compila o SQLCipher com `-DSQLCIPHER_CRYPTO_CC` (`node_modules/expo-sqlite/ios/ExpoSQLite.podspec`, conferido em 14/11/2026), ou seja, a cifra usa o **CommonCrypto da Apple**. O cofre de sessão é o Keychain. O transporte é HTTPS do sistema.
- A tabela da Apple diz: app com criptografia **limitada à do sistema operacional da Apple** não precisa de documentação no App Store Connect; algoritmo padrão **não** fornecido pelo sistema exige a declaração francesa, e só se o app for distribuído na França ([Export compliance documentation for encryption](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption/), consultada em 14/11/2026).
- **Conclusão:** `false` se sustenta. Reconfirmar a cada atualização do `expo-sqlite` (se o podspec deixar de usar `SQLCIPHER_CRYPTO_CC`, a resposta muda) e manter a distribuição só no Brasil ([`metadados.md`](metadados.md), seção 8), o que tira a França da conta de qualquer forma.

---

## 5. Comunidade e contas de demonstração (especificação)

Vive em **produção** (a revisão usa o build de produção), isolada como qualquer comunidade (ISO-01), só com dados fictícios, nunca com a conta do dono (D3, PUB-04). A criação é por roteiro idempotente (T8), rodado pelo agente com aprovação do dono, porque escreve em produção.

1. Comunidade "Comunidade Demonstração", fuso `America/Sao_Paulo`.
2. **Dois admins**: a conta de revisão de admin e um segundo admin fictício que ninguém usa. Assim, excluir a conta de revisão não esbarra na regra do último admin (PAP-02).
3. Uma conta de revisão de membro, para a visão de membro e para o teste de exclusão.
4. Nenhuma das contas de revisão com 2FA; senhas longas, geradas, guardadas só no cofre de senhas do dono e coladas no App Store Connect e no Play Console (nunca no git, regra 5 do `CLAUDE.md`).
5. Dados do roteiro de [`capturas.md`](capturas.md), seção 4: série "Sábado padrão" semanal (sempre há evento futuro, porque a recorrência materializa 183 dias, D18), escalas com uma substituição pendente, tarefas, inscrições com lista de espera, avisos, pedidos de oração "Comunidade" fictícios, músicas de domínio público.
6. Uma inscrição confirmada no próximo "Sábado padrão", cujo QR Code é exportado como PNG e anexado à revisão (o código é aleatório e não tem dado pessoal, PRE-03).
7. **Antes de cada envio:** rodar o roteiro de novo (recria o que o revisor anterior excluiu) e entrar com as duas contas num aparelho real. Conta demo que não entra é reprovação por 2.1.
8. Limite de tentativas de login: a conta de revisão está sujeita ao limitador por e-mail e rede (D14). O roteiro confere que não há bloqueio ativo antes do envio.

---

## 6. Fontes (consultadas em 14/11/2026)

- Apple, [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): 1.2, 2.1, 2.2, 2.3, 2.3.3, 2.4.1, 3.1.1, 4.2, 4.8, 5.1.1(i), 5.1.1(v).
- Apple, [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/).
- Apple, [Unlisted app distribution](https://developer.apple.com/support/unlisted-app-distribution/).
- Apple, [Export compliance documentation for encryption](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption/) e [Overview of export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/).
- Google, [User Generated Content policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en): aceite de termos, moderação, denúncia e bloqueio no app, inclusive em grupos fechados.
- Google, [Requirements for providing sign in details for review](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en): credenciais reutilizáveis, sem 2FA, em inglês.
- Referência de estrutura: `C:\Projetos\city-hall\dc360\apps\campo\LOJAS.md` (conta de revisão, nota "funciona sem conexão por desenho") e `C:\Projetos\brother-system\docs\08-compliance-lojas.md` (diretrizes que mais reprovam).
