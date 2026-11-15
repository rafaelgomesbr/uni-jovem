# Metadados da ficha nas lojas

- **Versão:** 2, de 15/11/2026: app aberto (ADR 0007). A ficha deixa de dizer "só por convite": cadastro com e-mail, Google ou Apple, entrada por convite, código ou pedido, criação de comunidade com limites até a verificação. A versão 1, de 14/11/2026 (entrada só por convite), está no histórico do git.
- **Quando usar:** só no envio de um binário que já tenha o app aberto (cadastro, criar comunidade, código, busca e denúncia de comunidade) e com a API da ADR 0007 em produção. Se algum envio sair antes disso, use a versão 1.
- **Idioma da ficha:** português do Brasil (único idioma do app).
- **Regra:** a ficha descreve só o que o binário enviado faz. Antes de cada envio, a tabela da seção 3 é conferida item por item; função que não estiver no binário sai do texto **antes** de colar (diretriz 2.3 da Apple e política de metadados do Google: metadado que promete o que o app não faz é motivo de reprovação).
- **Limites de caracteres** conferidos por script em 14/11/2026 (contagem por caractere e por byte, porque o App Store Connect conta palavras-chave em bytes na prática).

---

## 1. Nome e identidade

| Campo                 | Loja           | Limite | Texto                            | Tamanho |
| --------------------- | -------------- | ------ | -------------------------------- | ------- |
| Nome do app           | Apple e Google | 30     | `Uni Jovem`                      | 9       |
| Subtítulo             | Apple          | 30     | `Programação do grupo de jovens` | 30      |
| Subtítulo alternativo | Apple          | 30     | `Escalas e eventos do seu grupo` | 30      |

O nome vem da constante única do D5 (`apps/app/app.config.ts#NOME`). Se o nome trocar, esta seção troca junto.

**Nome ocupado na App Store.** A Apple exige nome único entre todos os apps da loja; o Google não. Se "Uni Jovem" estiver em uso quando o dono criar o registro no App Store Connect (PH-09), as alternativas, nesta ordem, são `Uni Jovem: grupo jovem` (22) e `Uni Jovem Comunidade` (20). O nome no aparelho continua `Uni Jovem`.

---

## 2. Textos

### 2.1 Apple: texto promocional (até 170, editável sem nova revisão)

```
Programação do sábado, escalas, presença por QR Code e pedidos de oração com privacidade. Entre com o código do seu grupo ou crie a comunidade de vocês.
```

(152 caracteres)

### 2.2 Google: descrição curta (até 80)

```
Programação, escalas, presença e oração do grupo de jovens, num lugar só.
```

(73 caracteres)

### 2.3 Descrição completa (Apple e Google, até 4.000)

```
O Uni Jovem organiza a vida do grupo de jovens da igreja num lugar só: a programação do sábado, os eventos especiais, as escalas, as tarefas, as inscrições, a presença e os pedidos de oração. Sai o PDF solto, a planilha e a mensagem perdida no grupo.

SUA COMUNIDADE, DO SEU JEITO
Crie sua conta com e-mail, Google ou Apple. Entre na comunidade do seu grupo com o código ou o convite da liderança, ou peça para entrar. Ainda não tem? Crie a comunidade do seu grupo e chame as pessoas. Cada pessoa tem um papel (admin, organizador ou membro), e cada comunidade enxerga apenas os próprios dados.

COMUNIDADES CUIDADAS
Comunidade nova começa com até 30 pessoas e ganha o selo "Verificada" depois que a equipe do Uni Jovem confere o grupo. A comunidade escolhe se aparece na busca, e a busca nunca mostra quem participa. Conteúdos e comunidades podem ser denunciados.

PARA QUEM ORGANIZA
• Programação com etapas e horários (boas-vindas, louvor, oração, estudo, encerramento), com modelos reutilizáveis
• Eventos que se repetem toda semana, com a escolha de mudar só uma data ou todas as próximas
• Escalas por etapa, com confirmação e pedido de substituição
• Tarefas, materiais e checklists de preparação e de encerramento
• Modo ao vivo: etapa atual, tempo restante e atraso acumulado em tela grande, com um condutor por vez
• Inscrições com link para compartilhar, limite de vagas e lista de espera
• Presença por QR Code ou por busca de nome
• Relatórios de presença, inscrições e escalas

PARA QUEM PARTICIPA
• Próximos eventos e as suas escalas logo na tela inicial
• Confirmar a escala ou pedir substituição em poucos toques
• Agenda do mês, da semana e a linha do tempo do dia
• Avisos da liderança e sugestões com resposta
• Notificações por tipo e por comunidade, do jeito que você escolher
• Versículo do dia, no horário que você escolher

NO DIA DO EVENTO, MESMO SEM INTERNET
Prepare o evento com antecedência e use a programação, a escala e a lista de presença sem conexão. O que for registrado sem internet é enviado quando a conexão voltar, sem duplicar.

PEDIDOS DE ORAÇÃO COM PRIVACIDADE
Você escolhe quem vê cada pedido: só você, a equipe de oração ou a comunidade. O texto do pedido nunca aparece em notificação e é guardado cifrado no servidor.

PARA TODO MUNDO
Tema claro e escuro, texto que acompanha o tamanho de fonte do sistema e suporte a leitores de tela.

Sem anúncios e sem compras dentro do app.

O versículo do dia vem da Bíblia Livre (BLIVRE), © 2018 Diego Santos, Mario Sérgio e Marco Teles, licença Creative Commons Atribuição 4.0 Brasil.
```

O texto não cita outras plataformas (diretriz 2.3.10 da Apple), não usa marca de terceiros (o compartilhamento pelo WhatsApp é feito pela folha do sistema e não precisa ser anunciado) e não usa "grátis", ranking nem emoji.

### 2.4 Apple: palavras-chave (até 100, separadas por vírgula, sem espaço)

```
igreja,jovens,escala,eventos,agenda,oração,culto,louvor,presença,check-in,ministério,sábado
```

(91 caracteres, 96 bytes). O nome do app não entra (a Apple já indexa o nome). Nenhuma marca de terceiro nem nome de denominação (diretriz 2.3.7).

### 2.5 Novidades da primeira versão

A Apple não mostra "Novidades" na primeira versão de um app; o campo só aparece a partir da segunda. O texto abaixo serve para as notas de versão do Google Play (até 500 por idioma) e fica guardado para referência.

```
Primeira versão do Uni Jovem. Programação com etapas e horários, escalas com confirmação e substituição, inscrições com lista de espera, presença por QR Code ou por nome, modo ao vivo, pedidos de oração com escolha de quem vê, sugestões, relatórios e versículo do dia. Crie sua conta, entre com o código do seu grupo ou crie a comunidade de vocês.
```

(347 caracteres)

---

## 3. Cada afirmação da ficha e o requisito que a sustenta

Antes de colar a descrição, confira que cada linha está no binário enviado. A coluna "Em 14/11/2026" mostra o estado de hoje, lido de `docs/STATUS.md` e de `apps/app/src`.

| Afirmação na ficha                                                                                                                                                                            | Requisitos                               | Em 14/11/2026                                                                                                                                     | Se não estiver no binário                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Cadastro com e-mail, Google ou Apple; entrada por convite, código ou pedido; criar comunidade com limites e verificação; busca opcional; denúncia de comunidade; papéis; comunidades isoladas | AUT-01, AUT-02, PAP-01, ISO-01; ADR 0007 | Convite, papéis e isolamento prontos (F3 a F5). App aberto em construção em 15/11/2026 (migração `0022_app_aberto.sql` e telas novas, sem commit) | Voltar à versão 1 da ficha (entrada só por convite) |
| Programação com etapas e horários, modelos                                                                                                                                                    | EVT-01, EVT-02, EVT-03                   | API pronta; telas de evento em construção                                                                                                         | Tirar a linha                                       |
| Eventos semanais, mudar uma ou todas                                                                                                                                                          | REC-01, REC-02                           | API pronta (F8)                                                                                                                                   | Tirar a linha                                       |
| Escalas, confirmação, substituição                                                                                                                                                            | ESC-01, ESC-02                           | API pronta (F9)                                                                                                                                   | Tirar a linha                                       |
| Tarefas, materiais, checklists                                                                                                                                                                | EVT-01                                   | API pronta (F7)                                                                                                                                   | Tirar a linha                                       |
| Modo ao vivo                                                                                                                                                                                  | LIVE-01, LIVE-02                         | API pronta (F11); tela em construção                                                                                                              | Tirar a linha                                       |
| Inscrições com link, vagas, lista de espera                                                                                                                                                   | INS-01, INS-03                           | API e página pública prontas (F12)                                                                                                                | Tirar a linha                                       |
| Presença por QR Code ou por nome                                                                                                                                                              | PRE-01                                   | API pronta; **tela de câmera não existe**                                                                                                         | Tirar "por QR Code" e tirar a permissão de câmera   |
| Relatórios                                                                                                                                                                                    | REL-01, REL-02                           | API pronta (F16, exportações)                                                                                                                     | Tirar a linha                                       |
| Próximos eventos e escalas no Início; agenda do mês, semana, linha do tempo                                                                                                                   | VIS-01, VIS-02, VIS-03                   | Tela de agenda existe                                                                                                                             | Tirar a linha                                       |
| Avisos e sugestões com resposta                                                                                                                                                               | SUG-01, CNT-02                           | API pronta (F15)                                                                                                                                  | Tirar a linha                                       |
| Notificações por tipo e por comunidade                                                                                                                                                        | NOT-01, NOT-04                           | **Não existe** (F14)                                                                                                                              | Tirar a linha                                       |
| Versículo do dia                                                                                                                                                                              | VER-01                                   | Conteúdo em `packages/conteudo`; agendamento é da F14                                                                                             | Tirar a linha e o crédito da BLIVRE                 |
| Funciona sem internet no dia do evento                                                                                                                                                        | OFF-01, OFF-02, OFF-04                   | **Não existe** (F13)                                                                                                                              | Tirar a seção inteira                               |
| Pedido de oração com três visibilidades, fora da notificação, cifrado                                                                                                                         | ORA-01, ORA-02                           | API e banco prontos (F15)                                                                                                                         | Tirar a seção                                       |
| Tema claro e escuro, fonte do sistema, leitor de tela                                                                                                                                         | A11Y-01                                  | Tokens AA nos dois temas (F1)                                                                                                                     | Manter só o que foi validado                        |
| Sem anúncios, sem compras                                                                                                                                                                     | (ausência)                               | Verdadeiro (`apps/app/package.json` sem SDK de anúncio ou compra)                                                                                 | (obrigatório)                                       |

**Não pode aparecer na ficha** porque o plano não entrega na v1 (seções 16 e 17 do plano) ou porque a ADR 0007 rejeitou: lista pública de todas as comunidades ou "descubra igrejas perto de você" (a busca só acha, por nome e cidade, quem escolheu aparecer), push na web, envio automático por WhatsApp, mapa embutido no Android (D22), upload de arquivo (D17), criptografia de ponta a ponta nos pedidos de oração (L02).

---

## 4. Categoria

| Loja   | Primária          | Secundária                                 | Por quê                                                                                                                                                                                                                                                                                  |
| ------ | ----------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apple  | **Produtividade** | Estilo de vida                             | O uso central é organizar programação, escalas e tarefas de uma equipe. "Redes sociais" atrairia a leitura de rede social na classificação etária (13+ global, A16 no Brasil) e mais escrutínio da diretriz 1.2, sem corresponder ao produto: não há feed, perfil público nem descoberta |
| Google | **Produtividade** | (o Google não tem secundária; use as tags) | Mesmo motivo. Tags sugeridas no Console: organização de eventos, produtividade de equipe, calendário. Escolher só entre as que o Console oferecer                                                                                                                                        |

Rejeitadas: "Redes sociais" (acima); "Eventos" no Google (é a categoria de venda de ingressos e guias de evento, e confunde a expectativa); "Referência" (é onde ficam apps de leitura bíblica, e o Uni Jovem não é um).

---

## 5. Classificação etária

### 5.1 Apple: questionário de classificação etária

O questionário foi atualizado em 2025 e as respostas novas são exigidas desde 31/01/2026 ([Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)). As categorias e definições abaixo são as da página [Age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/), consultada em 14/11/2026. O texto exato de cada pergunta aparece no App Store Connect; a resposta vale pela categoria.

| Seção                      | Item                                                      | Resposta                   | Justificativa                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------- | --------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controles no app           | Controles parentais                                       | Não                        | O app não tem                                                                                                                                                                                                                                                                                                                                                                                |
| Controles no app           | Verificação de idade (age assurance)                      | Não                        | O app não verifica idade. Ver risco da seção 5.4                                                                                                                                                                                                                                                                                                                                             |
| Recursos                   | Acesso irrestrito à web                                   | **Não**                    | O app não tem navegador nem WebView. Links de anexo abrem no navegador do sistema, fora do app (`apps/app/src/utilidades/compartilhar.ts#abrirLink`, com `Linking.openURL`). `expo-web-browser` está nas dependências, mas sem uso. Se algum dia um link abrir dentro do app, esta resposta vira "sim" e a classificação sobe para 16+ (A16 no Brasil)                                       |
| Recursos                   | Conteúdo gerado por usuários                              | **Sim**                    | Pedidos de oração com visibilidade "Comunidade", sugestões, avisos e notas são vistos por outras pessoas da comunidade                                                                                                                                                                                                                                                                       |
| Recursos                   | Redes sociais                                             | Não                        | Não há feed que espalhe conteúdo para muitas pessoas, nem seguidores, nem perfil público, nem mensagem entre pessoas. Com a ADR 0007, existe busca, mas só de **comunidades** que escolheram aparecer, por nome e cidade, e ela nunca mostra pessoas nem quantas participam. O conteúdo fica dentro de cada comunidade, que decide quem entra. Reavaliar se a busca passar a mostrar pessoas |
| Recursos                   | Mensagens e bate-papo                                     | **Não** (decisão delicada) | Não há mensagem direta, conversa em grupo, voz nem vídeo. A resposta do organizador a uma sugestão é um campo de status, não conversa. A mensagem do pedido de entrada (ADR 0007) é um bilhete único de até 280 caracteres para a liderança, sem resposta nem conversa. Se a Apple discordar, o global continua 4+ e o Brasil sobe para A12                                                  |
| Recursos                   | Publicidade                                               | Não                        | Sem anúncios                                                                                                                                                                                                                                                                                                                                                                                 |
| Temas adultos              | Palavrões ou humor grosseiro                              | Nenhum                     |                                                                                                                                                                                                                                                                                                                                                                                              |
| Temas adultos              | Terror ou medo                                            | Nenhum                     |                                                                                                                                                                                                                                                                                                                                                                                              |
| Temas adultos              | Álcool, tabaco ou drogas                                  | Nenhum                     |                                                                                                                                                                                                                                                                                                                                                                                              |
| Médico ou bem-estar        | Informação médica ou de tratamento                        | Nenhum                     | O app não dá informação médica                                                                                                                                                                                                                                                                                                                                                               |
| Médico ou bem-estar        | Temas de saúde ou bem-estar                               | Nenhum                     | O app não trata de saúde. Pedidos de oração são texto livre da pessoa, não conteúdo do app                                                                                                                                                                                                                                                                                                   |
| Sexualidade ou nudez       | (todos os itens)                                          | Nenhum                     |                                                                                                                                                                                                                                                                                                                                                                                              |
| Violência                  | (todos os itens)                                          | Nenhum                     | Ver a curadoria de versículos abaixo                                                                                                                                                                                                                                                                                                                                                         |
| Atividades de sorte        | Jogos de azar, simulados, concursos, caixas de recompensa | Nenhum                     | Sem sorteio nem prêmio no app                                                                                                                                                                                                                                                                                                                                                                |
| Feito para crianças (Kids) |                                                           | Não                        |                                                                                                                                                                                                                                                                                                                                                                                              |

**Resultado do questionário:** **4+** no global e **A6** no Brasil (a tabela brasileira da Apple coloca "conteúdo gerado por usuários" em A6). **Classificação aplicada em 15/11/2026: 16+ no global e A16 no Brasil.** A tela da Apple pede que um app cujos termos fixam idade mínima seja classificado nessa idade, e os termos do Uni Jovem fixam 16 anos (D27). Ver `estado-das-lojas.md`.

**Curadoria de versículos.** As respostas "nenhum" em violência e temas adultos valem enquanto o plano de 366 versículos em `packages/conteudo/src/versiculos.ts` ficar em trechos de encorajamento. Se entrar trecho com violência ou tema adulto, refaça esta tabela.

### 5.2 Google: questionário de classificação (IARC)

O Play gera as classificações de cada autoridade a partir de um questionário único; no Brasil, a autoridade é a ClassInd, com as faixas Livre, 10, 12, 14, 16 e 18 ([Content ratings](https://support.google.com/googleplay/android-developer/answer/188189?hl=en), consultada em 14/11/2026). A ajuda do Google não publica o texto exato das perguntas; a lista abaixo segue os temas do questionário e deve ser conferida tela a tela no Console.

| Pergunta (tema)                                                      | Resposta                                            | Justificativa                                                                                            |
| -------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Categoria do app                                                     | **Utilitário, produtividade, comunicação ou outro** | Coerente com a categoria Produtividade. Não escolher "Rede social" (mesmo motivo da seção 4)             |
| Violência, sangue, medo                                              | Não                                                 |                                                                                                          |
| Sexualidade, nudez                                                   | Não                                                 |                                                                                                          |
| Linguagem imprópria                                                  | Não                                                 |                                                                                                          |
| Substâncias controladas (álcool, tabaco, drogas)                     | Não                                                 |                                                                                                          |
| Humor grosseiro                                                      | Não                                                 |                                                                                                          |
| Jogos de azar e apostas                                              | Não                                                 |                                                                                                          |
| Os usuários podem interagir ou trocar conteúdo entre si?             | **Sim**                                             | Pedidos de oração "Comunidade", sugestões, avisos                                                        |
| O app compartilha a localização atual da pessoa com outros usuários? | Não                                                 | O app não lê localização                                                                                 |
| O app compartilha informação pessoal com terceiros?                  | Não                                                 | Ver [`declaracao-de-dados.md`](declaracao-de-dados.md), D-L2                                             |
| O app permite comprar bens digitais?                                 | Não                                                 |                                                                                                          |
| O app é navegador ou buscador da web?                                | Não                                                 |                                                                                                          |
| O app tem conteúdo gerado por usuário que exige moderação?           | Sim                                                 | Mesma resposta da interação; ver o risco de moderação em [`revisao-apple.md`](revisao-apple.md), seção 3 |

**Resultado esperado:** ClassInd **Livre**, com o elemento interativo "Usuários interagem". O Google avisa que classificação com resposta falsa leva a remoção ou suspensão.

### 5.3 Por que 16+ e não a faixa do questionário

As respostas do questionário descrevem o conteúdo, e ele continua sendo o de 4+ (Apple) e Livre (ClassInd). A faixa aplicada sobe para 16+ só porque o próprio app recusa quem tem menos de 16 anos (D27, termos de uso): anunciar 4+ para um app que barra menores de 16 seria incoerente. Não é "por garantia": se a idade mínima dos termos mudar, a faixa muda junto. Se o app mudar (navegador interno, conversa, publicidade), as respostas também mudam.

### 5.4 Risco que a classificação não resolve: adolescentes

Grupos de jovens costumam ter adolescentes. O Estatuto Digital da Criança e do Adolescente (Lei 15.211/2025) está em vigor desde 17/03/2026 e trata de verificação de idade e proteção de menores em produtos digitais ([ANPD, ECA Digital](https://www.gov.br/anpd/pt-br/assuntos/eca-digital/eca-digital-english); [Machado Meyer, vigência](https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/direito-digital/estatuto-digital-da-crianca-e-do-adolescente-lei-n-15-211-2025-entra-em-vigor-em-17-de-marco-de-2026)). A análise de 15/11/2026 (política de privacidade, seção para pais e responsáveis) trata o app como dentro do escopo, por prudência, e mantém a idade mínima de 16 anos; os pontos em aberto entram na revisão jurídica da PH-11.

---

## 6. Público-alvo (Google: "Público-alvo e conteúdo")

| Pergunta                               | Resposta                | Justificativa                                                                                                                                                                                                                     |
| -------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Faixas etárias do público-alvo         | **16 a 17, 18 ou mais** | O app recusa quem tem menos de 16 anos (D27); quem tem 16 ou 17 declara a ciência do responsável. Declarar só 18+ seria falso. Nenhuma faixa abaixo de 13, então a política para famílias não se aplica                           |
| O app pode atrair crianças sem querer? | Não                     | Sem personagens, jogos, linguagem ou visual infantil. Com o cadastro aberto (ADR 0007), a idade é declarada em todo cadastro e quem marca menos de 16 não cria conta; ver `docs/privacidade/politica-de-privacidade.md`, seção 12 |
| Anúncios                               | Não                     |                                                                                                                                                                                                                                   |

---

## 7. Endereços e contatos

| Campo                                                    | Valor                                                       | Estado em 14/11/2026                                                                                                                                                                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Política de privacidade (Apple e Google)                 | `https://unijovem.solerte.com.br/privacidade`               | No ar desde 15/11/2026 (publicação autorizada pelo dono). A versão 0.3 (app aberto) só vai ao ar com a API da ADR 0007                                                                                                     |
| URL de suporte (Apple, obrigatória)                      | `https://unijovem.solerte.com.br/suporte`                   | No ar. Com a ADR 0007, precisa dizer também como criar uma comunidade e como denunciar uma comunidade (mudança de código em `apps/api/src/publico/documentos.ts`). É também o "contato publicado" que a diretriz 1.2 exige |
| Exclusão de conta pela web (Google)                      | `https://unijovem.solerte.com.br/excluir-conta`             | No ar (PRIV-03, F18)                                                                                                                                                                                                       |
| URL de marketing (Apple, opcional)                       | deixar em branco                                            | Não há site do produto além das páginas da API                                                                                                                                                                             |
| E-mail de contato do desenvolvedor (Google, público)     | `contact@solerte.com.br`                                    | Preenchido no Play Console em 15/11/2026 (`estado-das-lojas.md`)                                                                                                                                                           |
| Telefone de contato (Google, opcional)                   | deixar em branco                                            |                                                                                                                                                                                                                            |
| Contato para a revisão da Apple (nome, telefone, e-mail) | Rafael Gomes, `contact@solerte.com.br` e o telefone do dono | O telefone o dono digita no App Store Connect, fora do git (`estado-das-lojas.md`, seção 4); não aparece na loja                                                                                                           |

---

## 8. Outros campos da ficha

| Campo                                                         | Resposta                                                | Justificativa                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preço                                                         | Gratuito                                                | Sem cobrança na v1 (seção 16 do plano)                                                                                                                                                                                                                                                                                                            |
| Compras no app                                                | Nenhuma                                                 |                                                                                                                                                                                                                                                                                                                                                   |
| Contém anúncios (Google)                                      | Não                                                     |                                                                                                                                                                                                                                                                                                                                                   |
| Disponibilidade                                               | **Só Brasil**                                           | O app é em português, o servidor está no Brasil e a política segue a LGPD. Distribuir na União Europeia exigiria a declaração de comerciante da DSA; distribuir na França poderia exigir declaração de criptografia (ver [`revisao-apple.md`](revisao-apple.md), seção 4). Ampliar depois é simples; o contrário remove o app de quem já instalou |
| Direitos de conteúdo (Apple: "contém conteúdo de terceiros?") | **Sim**, com direito de uso                             | Versículos da Bíblia Livre sob CC BY 4.0 Brasil (D2), com atribuição na tela "Sobre a tradução" e na descrição; fontes Inter e Bricolage Grotesque sob SIL Open Font License                                                                                                                                                                      |
| Copyright (Apple)                                             | `2026 Rafael Gomes`                                     | A conta é de pessoa física; o nome que aparece é o do titular (L08)                                                                                                                                                                                                                                                                               |
| Versão vista na loja                                          | **1.0.0** (recomendado)                                 | Hoje `apps/app/app.config.ts#VERSAO` é `0.1.0`. Número "0.1" num app público é lido como beta, e a diretriz 2.2 manda beta para o TestFlight. Ajuste no `app.config.ts` na F19, antes do build de loja                                                                                                                                            |
| Suporte a iPad                                                | Não (`apps/app/app.config.ts#supportsTablet` é `false`) | O app roda no iPad em modo de compatibilidade de iPhone, e a Apple testa nesse modo (ver [`checklist.md`](checklist.md))                                                                                                                                                                                                                          |

---

## 9. Fontes (consultadas em 14/11/2026)

- Apple, [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): 2.2, 2.3, 2.3.3, 2.3.7, 2.3.10.
- Apple, [Age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/): categorias, faixas globais e a tabela do Brasil (AL, A6, A10, A12, A14, A16, A18).
- Apple, [Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/): questionário de idade atualizado exigido desde 31/01/2026.
- Google, [Content ratings for apps and games](https://support.google.com/googleplay/android-developer/answer/188189?hl=en) e [Content rating requirements](https://support.google.com/googleplay/android-developer/answer/9898843?hl=en): ClassInd no Brasil, aviso sobre resposta falsa.
- Google, [Prepare your app for review](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en): declarações obrigatórias (privacidade, anúncios, acesso, público-alvo, classificação).
- ANPD, [ECA Digital](https://www.gov.br/anpd/pt-br/assuntos/eca-digital/eca-digital-english); Machado Meyer, [vigência em 17/03/2026](https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/direito-digital/estatuto-digital-da-crianca-e-do-adolescente-lei-n-15-211-2025-entra-em-vigor-em-17-de-marco-de-2026).
