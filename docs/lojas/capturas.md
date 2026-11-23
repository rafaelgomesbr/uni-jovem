# Capturas de tela e roteiro de dados fictícios

- **Versão:** 2, de 23/11/2026 (capturas refeitas com a Direção A; o roteiro de geração acompanhou a Agenda em lista, o ao vivo novo e a cópia "Quando?").
- **Regra de ouro:** captura publicada numa loja não tem como ser recolhida. Só dados fictícios, nunca nome, telefone ou pedido de oração de pessoa real (regra 5 do `CLAUDE.md`).
- **Regra da Apple (2.3.3):** captura mostra o app em uso, não só a tela de entrada ou a abertura. Texto sobreposto é permitido, desde que descreva o que o app faz de fato.

---

## 1. Tamanhos exigidos hoje

### 1.1 App Store (iPhone)

Fonte: [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/), consultada em 14/11/2026. A exigência mudou desde que o plano foi escrito: o plano citava 6,9" e 6,5"; hoje a Apple organiza por tipo de tela.

| Tipo de tela (Apple)                                                                           | Tamanhos aceitos, retrato (px)          | Exigência                                                                                                    | O que fazemos                                          |
| ---------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| iPhone com Dynamic Island, tela média (iPhone 14 Pro a 18 Pro, 15, 16, 17)                     | 1206 x 2622 ou 1179 x 2556              | **Obrigatório** ("pelo menos uma captura")                                                                   | Gerar em **1206 x 2622** (simulador iPhone 17 Pro)     |
| iPhone com Dynamic Island, tela grande (iPhone 14 Pro Max a 18 Pro Max, Air, 15 Plus, 16 Plus) | 1320 x 2868, 1290 x 2796 ou 1260 x 2736 | Opcional, mas, se faltar, o tamanho abaixo vira obrigatório                                                  | Gerar em **1320 x 2868** (simulador iPhone 17 Pro Max) |
| iPhone com Face ID, tela grande                                                                | 1284 x 2778 ou 1242 x 2688              | Obrigatório só se não houver a tela grande com Dynamic Island                                                | Dispensado, porque enviamos 1320 x 2868                |
| Demais iPhones (Face ID média, botão de início)                                                | vários                                  | Opcional; a loja reduz a partir dos maiores                                                                  | Não enviar                                             |
| iPhone Duo (externa 1398 x 2034, interna 2007 x 2853)                                          |                                         | Opcional hoje; obrigatório a partir de abril de 2027 para apps compilados com o SDK do iOS 27.1 ou mais novo | Rever quando o Expo adotar esse SDK                    |
| iPad                                                                                           |                                         | Não se aplica: `apps/app/app.config.ts#supportsTablet` é `false`                                             | Não enviar                                             |

- De 1 a **10** capturas por tamanho.
- Formatos `.png`, `.jpg` ou `.jpeg`, **sem canal alfa nem transparência**. A captura do simulador sai em PNG; converta para JPEG ou achate o alfa antes de enviar.
- Mesma interface nos tamanhos: a Apple aceita só o maior e reduz, mas enviamos os dois tamanhos para a tela média não sair com proporção errada.

### 1.2 Google Play (telefone)

Fonte: [Add preview assets to showcase your app](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en), consultada em 14/11/2026.

| Item                           | Exigência                                                                                                                                                                  | O que fazemos                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Capturas de telefone           | De **2** a **8**; JPEG ou PNG de 24 bits sem alfa; lado menor de no mínimo 320 px, lado maior de no máximo 3840 px; **o lado maior não pode passar de duas vezes o menor** | 8 capturas em **1080 x 1920** (9:16)                                                    |
| Para aparecer em recomendações | Pelo menos **4** capturas com no mínimo 1080 px; retrato em 9:16, mínimo 1080 x 1920                                                                                       | Atendido pelo item acima                                                                |
| Ícone                          | 512 x 512, PNG de 32 bits com alfa, até 1024 KB                                                                                                                            | Exportar de `apps/app/assets/images/icon.png` (fonte em alta resolução)                 |
| Recurso gráfico                | 1024 x 500, JPEG ou PNG de 24 bits sem alfa                                                                                                                                | Nome do app, frase da descrição curta, fundo `#12102A` (o mesmo do ícone e da abertura) |
| Tablet (7" e 10")              | Opcional                                                                                                                                                                   | Não enviar na primeira versão                                                           |

**Armadilha conhecida:** os emuladores Android atuais usam tela de 1080 x 2400 (20:9). 2400 é mais que o dobro de 1080, então essa captura **é recusada** pela regra da proporção. Use um aparelho virtual com tela de 1080 x 1920 ou componha a captura numa tela de 1080 x 1920.

---

## 2. As telas, em ordem

A ordem conta a história do produto: o que a pessoa vê ao abrir, o que a liderança faz, o dia do evento, a privacidade. As oito primeiras vão para as duas lojas; a 9 e a 10 só para a Apple (limite de 8 no Google). O roteiro `scripts/lojas/capturas.ts` gera exatamente esta lista, e `scripts/lojas/molduras.ts` põe a legenda (seção 3.0).

| #   | Arquivo          | Tela                                    | Estado e dados na tela                                                                                     | Legenda sobreposta (pt-BR)               | Requisitos             |
| --- | ---------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------- |
| 1   | `01-inicio`      | Início                                  | Versículo do dia, o próximo Sábado Jovem em destaque e a escala da pessoa                                  | Sua semana no grupo jovem, num olhar     | VIS-01, VER-01         |
| 2   | `02-programacao` | Programação do evento (timeline do dia) | Sábado Jovem do próximo sábado, segmento Etapas, com horários e responsáveis                               | A programação do sábado, etapa por etapa | EVT-01, EVT-02, VIS-03 |
| 3   | `03-ao-vivo`     | Ao vivo                                 | Etapa "Louvor" em andamento, decorrido e restante, cerca de 3 min de atraso, a próxima etapa               | Ao vivo: etapa atual e tempo restante    | LIVE-01                |
| 4   | `04-escalas`     | Escalas                                 | Escala confirmada com "Pedir substituição" e um pedido de substituição com "Assumir"                       | Confirme a escala ou peça substituição   | ESC-01, ESC-02         |
| 5   | `05-presenca`    | Presença (check-in)                     | Contador, busca por nome com "Ler QR" ao lado, três presenças marcadas e "Marcar" nas demais               | Presença por QR Code ou pelo nome        | PRE-01                 |
| 6   | `06-novo-pedido` | Novo pedido de oração                   | "Quem vai ver" (Somente eu, Equipe de oração, Comunidade) com a explicação de quem lê, acima de "Publicar" | Você escolhe quem vê o seu pedido        | ORA-01, ORA-03         |
| 7   | `07-agenda`      | Agenda do mês                           | Mês com os eventos marcados e o próximo sábado escolhido, com a lista do dia                               | Toda a agenda da comunidade              | VIS-02                 |
| 8   | `08-equipe`      | Equipe                                  | "Convidar pessoas" em destaque e a lista de pessoas com o papel de cada uma                                | Equipe, papéis e convites num lugar só   | PAP-01, COM-07         |
| 9   | `09-avisos`      | Avisos (só Apple)                       | Um aviso fixado e dois recentes                                                                            | Avisos da liderança, os fixados no topo  | CNT-02                 |
| 10  | `10-convidar`    | Convidar (só Apple)                     | Tela de criar convite com o papel escolhido e a validade                                                   | Entrada só por convite da liderança      | AUT-01, AUT-03         |

Ficaram fora desta leva, com o motivo:

- **Pronto para usar sem internet:** o modo sem internet não existe na web, e as capturas saem da prévia web. Entra quando houver captura do simulador.
- **Inscrições do evento:** cabe no lugar de Avisos se o dono preferir; as duas existem no app.
- **Lista de pedidos de oração e Perfil:** a lista mostra pedidos com família e nomes de pessoas (fora da regra da seção 4.4), e o Perfil mostra um e-mail `.invalid`.

Regras para as legendas: no máximo uma linha curta, sem promessa que a tela não mostre, sem preço, sem "grátis", sem marca de terceiros. Na Apple, nenhuma moldura ou imagem de aparelho Android; no Google, nenhuma de iPhone (diretriz 2.3.10 da Apple).

Sugestão original: duas capturas (3 e 8) no tema escuro e o restante no claro. O roteiro de 15/11/2026 gera todas no escuro, o tema do mockup aprovado; para o claro, troque `colorScheme` em `capturas.ts`. Tamanho de fonte do sistema no padrão (o maior corta texto na captura sem ganho para a ficha).

Tela que não existir no binário enviado sai da lista. Nunca simular tela que o app não tem (diretriz 2.3; política de metadados do Google).

---

## 3. Como gerar

### 3.0 Pela prévia local (roteiro usado em 15/11/2026)

1. `npm run previa` até "Prévia pronta" (dados fictícios da semente, só em `localhost`).
2. `node --import tsx scripts/lojas/capturas.ts`: entra com `demo.admin`, renomeia a comunidade para "Jovens Esperança" e gera as cruas em `docs/lojas/capturas/cru/<aparelho>/` (`apple-6.3` 1206 x 2622, `apple-6.9` 1320 x 2868, `play` 1080 x 1920). Para o ao vivo e a presença, duplica o Sábado Jovem para hoje, publica, inicia o ao vivo pela interface, avança até o Louvor e marca três presenças; no fim, encerra o ao vivo e a cópia. Isso escreve no banco, por isso só roda contra `localhost`. Qualquer erro de JavaScript na página derruba a captura daquela tela.
3. `node --import tsx scripts/lojas/molduras.ts`: monta os JPEGs finais, sem alfa, com a legenda da tabela da seção 2, em `docs/lojas/capturas/final/<aparelho>/`.

As seções 3.1 e 3.2 continuam valendo para capturas do simulador e do emulador.

As capturas saem do **ambiente de homologação** com o roteiro de dados da seção 4, nunca de produção: assim nenhuma captura toca dado real e não é preciso escrever em produção para fazer a ficha.

### 3.1 iPhone (no Mac, `ssh mac-cityhall`, Xcode 26.4 ou mais novo)

1. Build de desenvolvimento ou de homologação instalado nos simuladores **iPhone 17 Pro** (1206 x 2622) e **iPhone 17 Pro Max** (1320 x 2868). Conferir o tamanho do arquivo gerado contra a tabela 1.1.
2. Barra de status limpa: `xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3`.
3. Captura: `xcrun simctl io booted screenshot nome.png`.
4. Tirar o alfa (por exemplo `sips -s format jpeg nome.png --out nome.jpg`) e conferir com `sips -g hasAlpha`.
5. Legendas compostas por script (HTML renderizado ou ferramenta de imagem), nas fontes do app (Inter e Bricolage Grotesque, licença OFL).

### 3.2 Android

1. Aparelho virtual com tela de **1080 x 1920**, ou aparelho real com captura composta numa tela de 1080 x 1920. Esta máquina Windows não tem `adb` (plano, seção 0.1): usar o Android SDK do Mac ou instalar as ferramentas de plataforma.
2. Modo de demonstração da barra de status: `adb shell settings put global sysui_demo_allowed 1` e os comandos `com.android.systemui.demo` de relógio, bateria e rede.
3. Captura: `adb exec-out screencap -p > nome.png`; salvar como PNG de 24 bits ou JPEG.

### 3.3 Conferência de cada captura antes de enviar

- [ ] Tamanho exato de uma das linhas das tabelas 1.1 e 1.2.
- [ ] Sem alfa.
- [ ] Nenhum dado real: nomes, telefones e e-mails do roteiro abaixo.
- [ ] Nenhum texto de pedido de oração que pareça real ou sensível.
- [ ] Sem notificação de outro app, sem teclado aberto por acidente, barra de status limpa.
- [ ] A tela existe no build enviado e a legenda descreve o que ela mostra.

---

## 4. Roteiro de dados fictícios

O mesmo roteiro alimenta a comunidade das capturas (homologação) e a comunidade demo dos revisores (produção, [`revisao-apple.md`](revisao-apple.md), seção 5). Muda só o nome da comunidade, passado como parâmetro ao roteiro idempotente (T8).

### 4.1 Comunidade

| Campo | Capturas (HML)                                      | Revisores (produção)    |
| ----- | --------------------------------------------------- | ----------------------- |
| Nome  | Jovens Esperança                                    | Comunidade Demonstração |
| Cor   | `#5B4BDB` (padrão de `0001_nucleo.sql#comunidades`) | idem                    |
| Fuso  | `America/Sao_Paulo`                                 | idem                    |

Nada de nome de igreja, denominação, cidade, logotipo ou foto real.

### 4.2 Pessoas (todas fictícias)

| Nome            | Papel       | Designação       | E-mail                        |
| --------------- | ----------- | ---------------- | ----------------------------- |
| Ana Ribeiro     | admin       |                  | `ana.ribeiro@example.com`     |
| Bruno Tavares   | organizador | equipe de oração | `bruno.tavares@example.com`   |
| Carla Menezes   | organizador |                  | `carla.menezes@example.com`   |
| Diego Moura     | membro      |                  | `diego.moura@example.com`     |
| Elisa Prado     | membro      | equipe de oração | `elisa.prado@example.com`     |
| Felipe Antunes  | membro      |                  | `felipe.antunes@example.com`  |
| Gabriela Rocha  | membro      |                  | `gabriela.rocha@example.com`  |
| Heitor Campos   | membro      |                  | `heitor.campos@example.com`   |
| Isabela Freitas | membro      |                  | `isabela.freitas@example.com` |
| João Pedro Lins | membro      |                  | `joao.lins@example.com`       |

- Na semente (`apps/api/src/cli/demonstracao.ts`), Ana Ribeiro, Bruno Tavares e Carla Menezes são as contas com senha `demo.admin`, `demo.organizador` e `demo.membro` (`@unijovem.invalid`), e Diana Lopes é a segunda administradora (`demo.admin2`). Os e-mails `demo.*` não mudam: são os que os revisores das lojas usam. Conta que já existia guarda o nome antigo (a semente nunca altera conta).
- `example.com` é domínio reservado para exemplo (RFC 2606): nenhum e-mail sai para pessoa real, mesmo por engano.
- WhatsApp: deixar em branco nas capturas. Se alguma tela exigir, usar `+5511900000001` em diante, que não aparece em nenhuma captura escolhida.
- Na produção, as contas de revisão (admin e membro) e o segundo admin fictício seguem [`revisao-apple.md`](revisao-apple.md), seção 5; os e-mails das contas de revisão precisam receber mensagem (domínio do dono), então **não** usam `example.com`: o dono escolhe os endereços e os guarda fora do git (`contas-revisao.txt`, no servidor, com permissão 600).

### 4.3 Eventos

| Evento             | Regra                                           | Conteúdo                                                                                                                                                                                                                                        |
| ------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sábado padrão      | Semanal, sábado, 16:00, 60 min (série, D18)     | Etapas do modelo do plano: boas-vindas (5 min, Ana), louvor (15 min, Carla e Felipe), oração intercessora (10 min, Bruno e Elisa), dinâmica (10 min, Diego), estudo da lição (15 min, Ana), brinde (3 min, Gabriela), encerramento (2 min, Ana) |
| Ensaio do louvor   | Semanal, sexta, 19:30, 90 min                   | Etapas: aquecimento, repertório, passagem final                                                                                                                                                                                                 |
| Retiro de Carnaval | Evento único, sábado a terça, público, 40 vagas | Inscrições: 40 confirmadas (nomes da seção 4.2 mais inscritos públicos fictícios com nome e sobrenome comuns), 3 na lista de espera                                                                                                             |

Na semana da captura:

- Escala do louvor: Carla confirmou, Felipe confirmou, Isabela pediu substituição (pendente).
- Tarefas: "Levar o projetor" (Heitor, aberta), "Imprimir a ordem das músicas" (Carla, concluída).
- Checklist de preparação: "Testar o som", "Separar o brinde", "Abrir a sala às 15:30".
- Material: link `https://example.com/ordem-das-musicas` (anexo por link, D17).
- Ao vivo (captura 3): andamento iniciado, etapa "Louvor" com 3 min de atraso.

### 4.4 Conteúdos, avisos e oração

- Músicas, só títulos de hinos em domínio público e **sem letra nem cifra**: "Castelo Forte", "Santo, Santo, Santo", "Sublime Graça". Tom e quem toca preenchidos.
- Avisos: "Ensaio geral na sexta às 19:30" (fixado); "Traga um amigo no sábado".
- Sugestões: "Fazer um sábado ao ar livre em dezembro" (em análise); "Lanche coletivo depois do retiro" (aceita, com resposta).
- Pedidos de oração com visibilidade "Comunidade", todos genéricos e sem nada sensível: "Pela viagem da equipe ao retiro"; "Pela turma que faz prova no fim do mês"; "Gratidão pelo ensaio de sexta". Nada de doença, luto, família ou nome de pessoa: a captura 7 mostra o **seletor de visibilidade**, não a lista.
- Versículo do dia: um versículo de `packages/conteudo/src/versiculos.ts` **sem alteração**, com a referência (a licença CC BY 4.0 Brasil exige atribuição e aviso de alteração; D2). Exemplo disponível no arquivo: Êxodo 14:14.

### 4.5 O que o roteiro nunca faz

- Nunca cria conta com e-mail de pessoa real, nem a do dono, nem a do Criador.
- Nunca roda contra produção sem aprovação do dono (escreve em produção).
- Nunca grava segredo (senha das contas de revisão) em arquivo do repositório: a senha é gerada e mostrada uma vez no terminal, como o `criador:iniciar`.

---

## 5. Fontes (consultadas em 14/11/2026)

- Apple, [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).
- Apple, [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), 2.3.3 e 2.3.10.
- Google, [Add preview assets to showcase your app](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en).
- IETF, [RFC 2606](https://www.rfc-editor.org/rfc/rfc2606) (domínios reservados para exemplo).
- Referência de estrutura: `C:\Projetos\city-hall\dc360\apps\campo\LOJAS.md`, seção "Capturas de tela".
