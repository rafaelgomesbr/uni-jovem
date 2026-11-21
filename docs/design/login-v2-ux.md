# Entrada v2 (Entrar e Criar conta): desenho de UX

- Data: 21/11/2026.
- Origem: o dono reprovou a tela atual ("refaz do zero, foco total em UX, tá ridícula"). Captura analisada: a tela Entrar em iPhone, escuro.
- Este documento é UX: fluxo, estrutura, hierarquia, texto, estados e medição. O visual, o espaçamento e o movimento ficam em `docs/design/login-v2-ui-motion.md`. Os dois usam os **mesmos nomes de estado** (seção 3.4); se um nome mudar, muda nos dois.
- Código lido (somente leitura): `autenticacao/TelaEntrar.tsx`, `cadastro/TelaCriarConta.tsx`, `cadastro/TelaCompletarCadastro.tsx`, `convite/CadastroPorConvite.tsx`, `convite/TelaColarConvite.tsx`, `autenticacao/provedores/*`, `ui/BotaoDeAcessoRapido.tsx`, `ui/Tela.tsx`, ADR 0008 e as seções 3.1 de `especificacao-e-roadmap.md`.

## 1. Diagnóstico da tela atual e princípios do novo desenho

### 1.1 Por que a tela atual não funciona (10 pontos)

1. **A marca não aparece.** O ícone tem 56 pt e fica numa linha com o nome, colado no canto superior esquerdo, sem papel na composição. É a primeira impressão do app e não diz "onde estou" nem "de quem é isso".
2. **O título mente para quem chega agora.** "Bem-vindo de volta" supõe que a pessoa já esteve ali. A maioria de quem abre o app pela primeira vez veio de um convite. O título gasta cerca de 110 pt de altura com 34 pt de corpo e não ajuda a decidir nada. A frase que ajuda ("agenda, escalas e recados") vem depois, pequena e apagada.
3. **Duas lajes brancas iguais.** Apple e Google têm a mesma altura, largura e peso, e são os dois maiores contrastes da tela escura. O olho vai para elas antes do título e antes do botão do próprio app. Sem prioridade entre dois itens iguais, a pessoa trava (lei de Hick) e relê.
4. **Quatro botões de largura total com o mesmo peso de leitura.** Apple, Google, Entrar e Criar conta. A hierarquia é plana: não dá para saber qual é o caminho "normal".
5. **O formulário inteiro está exposto de uma vez.** E-mail, senha, "Esqueci a senha" e "Entrar" ficam num cartão com borda, mesmo para a maioria que vai usar Apple ou Google. É ruído constante para quem não o usa e uma parede para quem o usa.
6. **A tela não cabe.** Na captura (iPhone de cerca de 393 x 852 pt) o conteúdo já passa da altura e a barra de rolagem aparece. Por estimativa, no iPhone SE (667 pt) faltam cerca de 200 pt: "Criar conta" fica colado no limite e "Tenho um link de convite" some. Com o teclado aberto, o botão "Entrar" fica escondido.
7. **O convite está enterrado.** É o jeito mais comum de chegar, e está como link terciário no fim da tela, fora da dobra. "Ainda não tem conta?" repete em texto cinza o que o botão logo abaixo já diz.
8. **"Esqueci a senha" aparece sempre, e longe do erro.** Ocupa uma linha fixa (44 pt) o tempo todo, mesmo para quem entra por Apple, e quando a senha falha o erro não aponta para ele.
9. **Entrar e Criar conta são duas "casas" diferentes.** Criar conta pede nome, e-mail, idade, termos e senha em duas telas com barra de passos e cartões pesados. Quem erra de porta perde o que digitou. O texto "não precisa confirmar o e-mail" aparece em três lugares, com um aviso que só vale enquanto o ADR 0008 for temporário.
10. **Ritmo e retorno inexistentes.** Os espaços (16, 12, 16, 8, 16) não formam uma escala que agrupe por proximidade: tudo parece "um bloco de coisas". Não há transição entre estados nem retorno ao toque além do escurecimento do botão. O ícone de olho da senha não tem texto ("Mostrar"), o que atrapalha quem não o reconhece.

Nota de vocabulário: "Entrar" já significa "acessar minha conta" aqui e "entrar numa comunidade" no Perfil. Na entrada, "Entrar" fica só com o primeiro sentido.

### 1.2 Princípios do novo desenho (5)

1. **Uma decisão por vez.** Cada tela ou estado pede uma escolha só. Quem decide entre três jeitos de entrar não decide também entre entrar e criar conta.
2. **O caminho mais curto é o que a pessoa já usou.** O método usado da última vez sobe e ganha o destaque. Sem histórico, vale o padrão da plataforma.
3. **Quem digitou nunca perde o que digitou.** Trocar de estado, voltar, errar ou girar o aparelho preserva tudo.
4. **Cabe na mão.** Sem rolar no iPhone SE (375 x 667) em tamanho de fonte padrão, ações no terço de baixo (zona do polegar), e com o teclado aberto o campo ativo e o botão principal continuam visíveis.
5. **Erro diz o que houve e o que fazer, perto de quem o causou.** Nunca "algo deu errado". Nunca revela se um e-mail existe (seção 5.4).

## 2. Quem chega e o que quer

Meta: **1 ou 2 toques com Apple ou Google; por e-mail, no máximo 3 passos.** "Toque" é toque do app (a folha do sistema, como o Face ID, não conta). "Passo" é uma tela ou estado novo.

| Quem                                       | O que quer                                                                        | Caminho                                                                                                                                                                                                                                                                                                                                                                                                           | Toques / passos                                                                                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) Convidada pelo líder, nunca usou o app | Entrar na comunidade que o líder indicou, sem burocracia                          | **Link ou QR:** toca no link (ou lê o QR com a câmera do iPhone) → o app abre na tela do convite, que já mostra "Você foi convidado para X" e os mesmos acessos → "Continuar com a Apple" → Face ID do sistema → "Falta pouco" (idade) → conta criada e já dentro da comunidade (ainda com o aceite de fé TC-03, ver nota abaixo). **Código:** "Tenho um convite ou código" → colar → Continuar → mesmos acessos. | Link/QR com Apple ou Google: **2 toques** (provedor, idade). Link por e-mail: **3 passos** (ver 3.3). Código: +2 toques antes (abrir a folha e confirmar; "Colar" conta se usado). |
| (b) Já tem conta e volta                   | Abrir e estar dentro                                                              | Com sessão guardada e Face ID ligado: abre, Face ID dispara sozinho, **0 toques**. Sem sessão: o método da última vez já vem destacado → 1 toque (+ Face ID do sistema). Por e-mail: "Entrar com e-mail" → o chaveiro preenche e-mail e senha (1 toque na sugestão) → "Entrar".                                                                                                                                   | Apple/Google: **1 toque**. E-mail: **3 passos** (revelar, preencher, Entrar), com autopreenchimento 3 toques.                                                                      |
| (c) Líder ou admin                         | O mesmo, mais rápido, às vezes no computador                                      | Mesmo caminho. Na web, Google em primeiro lugar e e-mail como segunda opção. Se a conta tem segundo fator, o código de 6 números pede **depois** da senha certa, nunca antes. Quem vai criar comunidade faz isso depois de entrar, não aqui.                                                                                                                                                                      | Igual a (b); com 2º fator, +1 passo só para quem tem.                                                                                                                              |
| (d) Jovem de 16 ou 17 anos                 | Entrar sem constrangimento, geralmente com o ID Apple ou Google que já usa        | Mesmo caminho do cadastro. Em "Falta pouco", a opção "16 ou 17 anos" abre uma linha única: o responsável sabe e concorda (TC-01.v2). Menos de 16 recebe texto gentil, sem culpa, e um jeito de voltar.                                                                                                                                                                                                            | +1 toque que o adulto não faz (confirmar que o responsável sabe).                                                                                                                  |
| (e) Idoso ou pouco familiarizado           | Uma coisa clara na tela; palavras, não ícones; sem pressa; sem medo de "estragar" | Provavelmente "Entrar com e-mail" (é o que conhece). O botão fala "e-mail" por extenso; "Mostrar" tem texto, não só o olho; senha pode ser vista; erro diz o que fazer; nada some sozinho em menos de 10 s; fonte grande do sistema respeitada.                                                                                                                                                                   | E-mail: **3 passos**, cada um com um objetivo só.                                                                                                                                  |

Nota sobre o aceite de fé (TC-03): hoje ele é o passo 3 do cadastro por convite (`CadastroPorConvite`). No v2 ele deixa de fazer parte da entrada e passa para o momento de **participar da comunidade** (cartão do convite, logo depois da conta), porque é sobre a comunidade, não sobre a conta. Isso mantém a entrada com os mesmos passos para todos. Depende de decisão do dono (item 3 da seção 9.2).

Nota sobre o WhatsApp opcional do convite: sai da entrada e vira sugestão no Perfil depois (cada campo a mais derruba a conversão).

## 3. Arquitetura da entrada

### 3.1 Decisão: uma tela única com revelação progressiva para ENTRAR; um fluxo curto separado para CRIAR CONTA

**Entrar fica numa tela só (`/entrar`) com estados.** Apple e Google fazem a mesma coisa para quem tem e para quem não tem conta ("Continuar com..."), então não é preciso perguntar "entrar ou criar?" antes: essa pergunta só existe para o e-mail. A tela abre mostrando só o que a maioria usa, e o e-mail é revelado no lugar, quando pedido.

**Criar conta por e-mail fica em telas separadas (2 passos)** porque é uma tarefa com começo, meio e fim, com mais campos do que cabem com o teclado aberto, e porque o botão "voltar" do sistema precisa fazer sentido (voltar um passo).

Por que não tudo numa tela só: criar conta tem 4 entradas (e-mail, senha, nome, idade). Com o teclado aberto, o iPhone SE só tem cerca de 357 pt úteis. Não cabe sem rolar.

Por que não telas separadas para Entrar: a pessoa que volta precisa de 1 toque, e uma tela de boas-vindas extra com "Entrar" e "Criar conta" seria 1 toque de pura triagem para todos, inclusive para Apple e Google, que não precisam dela.

O estado do painel de e-mail vive na rota (`/entrar?modo=email`), assim o gesto de voltar do iOS, o botão voltar do Android e o voltar do navegador **fecham o painel** em vez de sair da tela.

### 3.2 Mapa de telas e estados

```
/entrar
  entrada.inicio ──────────────► Apple / Google ─► (conta existe) ─► Início
        │                                      └► (conta nova) ─► criar.idade ─► Início ("Comece por aqui")
        ├─ "Entrar com e-mail" ─► entrada.email ─► Entrar ─► (2º fator, se tiver) ─► Início
        │                              ├─ "Esqueci a senha" ─► /recuperar-senha (com o e-mail já preenchido)
        │                              └─ "Criar conta" ─► criar.dados
        ├─ "Criar conta" (rodapé) ─► criar.dados
        └─ "Tenho um convite ou código" ─► convite.folha ─► volta a entrada.inicio com o convite guardado

/criar-conta
  criar.dados (e-mail e senha) ─► criar.idade (nome e idade) ─► Início
                                          ├─ 16 ou 17: criar.responsavel
                                          └─ menos de 16: criar.menor
/convite (link, QR)
  mesma tela entrada.inicio com o cartão do convite em cima (entrada.inicio.convite)
```

### 3.3 Passos por caminho

| Caminho                       | Passo 1                                                    | Passo 2                                   | Passo 3  |
| ----------------------------- | ---------------------------------------------------------- | ----------------------------------------- | -------- |
| Apple/Google, conta existente | toque no botão                                             | (sistema: Face ID)                        | Início   |
| Apple/Google, conta nova      | toque no botão                                             | (sistema) → `criar.idade`: toque na idade | Início   |
| E-mail, conta existente       | "Entrar com e-mail" (revela)                               | e-mail e senha                            | "Entrar" |
| E-mail, conta nova            | "Criar conta" → `criar.dados`: e-mail e senha, "Continuar" | `criar.idade`: nome e idade               | Início   |

Conta nova por e-mail tem **2 telas de dados** mais a chegada: 3 passos no total contando o toque inicial. E-mail e senha ficam **juntos no mesmo passo** para o chaveiro do iOS e do Android ligar usuário e senha, sugerir senha forte e salvar. Nome e idade ficam juntos no segundo passo porque são o que o provedor também não entrega ("Falta pouco" é a **mesma tela** para quem veio de Apple, Google ou e-mail: uma tela só para manter, testar e entender).

Sem "repita a senha": o botão Mostrar substitui a confirmação. (Hoje o convite pede repetir; é um campo a menos e um erro de digitação a menos.)

Sem aviso sobre confirmação de e-mail na entrada (ADR 0008 é temporário). Se a confirmação voltar, entra um estado `criar.codigo` entre `criar.dados` e `criar.idade`; as telas não prometem nada sobre isso.

### 3.4 Nomes de estado (compartilhados com o documento de UI e movimento)

Telas e estados de conteúdo:

| Nome                       | O que é                                                                  |
| -------------------------- | ------------------------------------------------------------------------ |
| `entrada.inicio`           | boas-vindas com os acessos (estado padrão)                               |
| `entrada.inicio.convite`   | igual, com o cartão do convite guardado em cima                          |
| `entrada.inicio.biometria` | igual, com "Entrar com Face ID" no topo (sessão guardada neste aparelho) |
| `entrada.email`            | painel de e-mail e senha revelado                                        |
| `convite.folha`            | folha "Tenho um convite ou código"                                       |
| `criar.dados`              | e-mail e senha                                                           |
| `criar.idade`              | "Falta pouco": nome (só se faltar) e idade                               |
| `criar.responsavel`        | 16 ou 17: confirmação do responsável                                     |
| `criar.menor`              | menos de 16: bloqueio gentil                                             |
| `recuperar`                | "Esqueci a senha" (fora do escopo, só herda o e-mail)                    |

Modificadores (valem sobre qualquer tela):

`carregando.provedor`, `carregando.senha`, `carregando.criar`, `erro.campo`, `erro.geral`, `erro.provedor`, `erro.rede`, `erro.tempo`, `sem.internet`, `sucesso`, `teclado.aberto`, `fonte.grande`, `paisagem`, `movimento.reduzido`, `contraste.alto`, `transparencia.reduzida`.

### 3.5 Como cabe sem rolar

**`entrada.inicio` no iPhone SE (667 pt, fonte padrão).** Duas regiões: marca no alto, ações presas embaixo, e o espaço que sobra fica entre as duas.

| Bloco                                                 | Altura (pt)                   |
| ----------------------------------------------------- | ----------------------------- |
| Área segura do topo                                   | 20                            |
| Respiro                                               | 24                            |
| Marca: ícone 72, 16, nome 38, 8, apoio de 2 linhas 48 | 182                           |
| Folga mínima entre marca e ações                      | 24                            |
| 3 botões de 52 com 12 entre eles                      | 180                           |
| Rodapé: 20 de respiro, 2 linhas de 44                 | 108                           |
| Respiro de baixo                                      | 24                            |
| **Total**                                             | **562** (sobram cerca de 105) |

- Com `entrada.inicio.convite` entra um cartão compacto de 56 + 12 e some o link "Tenho um convite" (44): total 586.
- Android (só Google e e-mail) e web sem Apple sobram mais ainda.
- **Fonte grande do sistema:** cabe sem rolar até cerca de 120%. Acima disso a tela passa a rolar, **com as ações na ordem de leitura primeiro** e a marca encolhida (ícone 56, apoio oculto). Não se promete "sem rolar" nos tamanhos de acessibilidade, mas nunca se esconde uma ação atrás de gesto.

**`entrada.email` com o teclado aberto no SE.** O teclado do SE ocupa entre 260 e 290 pt (conta com a barra de sugestões); sobram cerca de 357 pt úteis.

| Bloco                                                             | Altura (pt) |
| ----------------------------------------------------------------- | ----------- |
| Linha "Outras formas de entrar" (voltar)                          | 44          |
| Título "Entrar com e-mail"                                        | 32          |
| Respiro                                                           | 12          |
| E-mail (rótulo 20 + campo 48)                                     | 68          |
| Respiro                                                           | 12          |
| Senha (rótulo 20 com "Esqueci a senha" na mesma linha + campo 48) | 68          |
| Botão "Entrar" (52 + 12 de cada lado)                             | 76          |
| **Total**                                                         | **312**     |

- A marca e o apoio **somem** (`teclado.aberto`) para dar a altura.
- O botão primário fica **preso acima do teclado** (barra de ação, como já existe em `BarraDeAcao`); os campos rolam acima dele se precisar (por exemplo, com mensagem de erro de duas linhas). O campo ativo rola até ficar 16 pt acima da barra.
- `criar.dados` (e-mail, senha e uma linha de status da senha) soma cerca de 352 pt com o teclado: cabe, desde que o texto de apoio também recolha com o teclado aberto.
- `criar.idade` não precisa de teclado para a parte da idade. O teclado do campo Nome fecha com "OK", e os três botões de idade aparecem inteiros.

**Tela grande, tablet e web.** Coluna única centralizada, largura máxima de 400 pt, conteúdo centralizado na vertical, ações sempre juntas (não esticadas pela largura). Em largura de 900 pt ou mais, o time de UI pode pôr uma faixa de marca ao lado; o fluxo não muda.

**Paisagem no celular.** Mesma ordem de leitura. Em altura menor que 500 pt a marca vai à esquerda e as ações à direita. Não se promete "sem rolar" em paisagem com o teclado aberto; promete-se campo ativo e botão visíveis.

### 3.6 Como o convite e o código entram

- **Link de convite (e QR, que é o mesmo link):** abre o app direto na tela do convite. O `/convite` mostra o cartão do convite (comunidade, papel) no alto e **os mesmos três acessos**. Não é um fluxo paralelo de cadastro: é a tela de entrada com contexto.
- **Código ou link colado:** "Tenho um convite ou código" abre `convite.folha`: um campo "Link ou código", com o botão **Colar** dentro do campo (a pessoa quase sempre copiou antes) e "Continuar". Ao continuar, o convite é guardado só em memória (como hoje) e a tela volta a `entrada.inicio.convite` mostrando "Convite guardado" com "Remover". Depois de entrar ou criar a conta, a pessoa cai no convite, como já funciona no `/entrar/<CODIGO>` (D58).
- **Quem já está dentro** e usa o código no app não passa por aqui; esse caminho existe no Perfil.
- **Convite para um e-mail específico** ("Convite para a***@gmail.com"): o campo de e-mail do `criar.dados` vem preenchido e travado, com a frase "Este convite é para a***@gmail.com".
- Convite vencido, usado ou inválido: o cartão do convite vira estado de erro com ação ("Pedir um convite novo à liderança") e a tela de entrada continua utilizável para quem quiser só entrar. O convite inválido não prende a pessoa (o problema de D58).

### 3.7 Como o "Esqueci a senha" aparece só quando faz sentido

- **Não existe** em `entrada.inicio` nem em `criar.*`.
- **Em `entrada.email`** fica na mesma linha do rótulo "Senha", à direita, discreto (alvo de 44 pt com área de toque expandida).
- **Depois de uma senha errada** o erro traz o botão "Esqueci a senha" dentro da própria mensagem. Depois da segunda senha errada, vira um botão secundário de largura total abaixo de "Entrar".
- Ao abrir `recuperar`, o e-mail digitado já vem preenchido. Ao voltar, a senha digitada **não** é perdida (só o painel muda de tela).

## 4. Hierarquia das ações por plataforma

Três níveis visíveis, não dois pesos iguais. Cada nível tem uma regra de UX; o "como" visual é do documento de UI.

| Nível          | Papel                       | Regra                                                                                                                                                                              |
| -------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primário**   | o caminho provável          | Um único preenchimento forte por estado. Sobe o método usado da última vez; sem histórico, o padrão da plataforma.                                                                 |
| **Secundário** | o outro caminho de um toque | Mesmo tamanho e largura do primário (a Apple exige peso equivalente entre os acessos de terceiros), mas com **preenchimento tonal discreto ou contorno**, nunca outra laje branca. |
| **Terciário**  | o caminho com mais passos   | Texto com ícone, largura total (alvo de 48 pt), sem preenchimento.                                                                                                                 |

| Plataforma                                                   | Primário                                                                                                             | Secundário                                                                                                                                     | Terciário           | Rodapé                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------- |
| **iOS**                                                      | "Continuar com a Apple" (preenchido; no escuro, branco; no claro, preto)                                             | "Continuar com o Google" (escuro com contorno no escuro, claro com contorno no claro: o tema "Dark" da marca Google, ou "Light" no tema claro) | "Entrar com e-mail" | "Primeira vez aqui? Criar conta" e "Tenho um convite ou código" |
| **Android**                                                  | "Continuar com o Google"                                                                                             | "Entrar com e-mail" (contorno)                                                                                                                 | (não há)            | os mesmos dois links                                            |
| **Web**                                                      | "Continuar com o Google", se configurado (o botão do Google na web tem pouca margem de estilo; o time de UI confere) | "Entrar com e-mail"                                                                                                                            | (não há)            | os mesmos dois links; sem Apple (depende de Services ID)        |
| **Sem nenhum provedor** (web sem Google, aparelho sem conta) | "Entrar com e-mail" já **aberto** (`entrada.email`), sem o passo de revelar                                          |                                                                                                                                                |                     | "Criar conta"                                                   |

Regras que valem para todas:

1. **Se a pessoa já entrou por um método**, esse vira o primário e ganha um texto "Usado da última vez" (texto, não só cor). Guarda-se só a marca do método (`apple`, `google`, `email`), nunca o e-mail. Os outros descem na ordem.
2. **Se houver Face ID** (`biometria.travada`), "Entrar com Face ID" é o primário, acima dos demais (`entrada.inicio.biometria`). A leitura dispara sozinha ao abrir; o botão serve para tentar de novo. Cancelar não gera erro.
3. **Só um preenchimento de acento por estado.** O coral do app fica para o "avançar" do painel de e-mail ("Entrar", "Continuar"). Assim, em qualquer estado, o olho sabe qual é a ação.
4. **Apple e Google com a mesma altura (52 pt) e a mesma largura.** A diferença é de preenchimento, não de tamanho.
5. "Criar conta" no rodapé é link com a palavra "Criar conta", não botão de largura total: não disputa com o primário, mas é encontrável (alvo de 48 pt).

## 5. Redação (microcopy)

Tom: caloroso, curto, sem jargão, sem travessão, sem "Sign in" e sem "login". Trate por "você". Valores entre chaves são variáveis. O nome do app vem da constante `NOME_DO_APP`.

### 5.1 `entrada.inicio` e variações

| Elemento                                       | Texto                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Nome (no lugar do título "Bem-vindo de volta") | {NOME_DO_APP}                                                                             |
| Apoio                                          | Agenda, escalas e recados da sua comunidade, num lugar só.                                |
| Botão Apple                                    | Continuar com a Apple                                                                     |
| Botão Google                                   | Continuar com o Google                                                                    |
| Botão e-mail                                   | Entrar com e-mail                                                                         |
| Selo do método usado                           | Usado da última vez                                                                       |
| Rodapé 1                                       | Primeira vez aqui? **Criar conta**                                                        |
| Rodapé 2                                       | Tenho um convite ou código                                                                |
| `entrada.inicio.biometria`                     | Entrar com Face ID (ou Touch ID, conforme o aparelho)                                     |
| `entrada.inicio.convite`, título               | Você foi convidado                                                                        |
| `entrada.inicio.convite`, linha                | para {nome da comunidade} (se o nome ainda não é conhecido: "Seu convite está guardado.") |
| `entrada.inicio.convite`, apoio                | Entre ou crie sua conta para participar.                                                  |
| `entrada.inicio.convite`, ação                 | Remover                                                                                   |
| Aviso de remoção (com desfazer)                | Convite removido. **Desfazer**                                                            |

### 5.2 `entrada.email`

| Elemento          | Texto                                              |
| ----------------- | -------------------------------------------------- |
| Voltar            | Outras formas de entrar                            |
| Título            | Entrar com e-mail                                  |
| Rótulo / exemplo  | E-mail / nome@exemplo.com                          |
| Rótulo da senha   | Senha                                              |
| Mostrar / ocultar | Mostrar / Ocultar (texto visível ao lado do ícone) |
| Link              | Esqueci a senha                                    |
| Botão             | Entrar                                             |
| Botão carregando  | Entrando...                                        |
| Rodapé            | Não tem conta? **Criar conta**                     |

### 5.3 Criar conta

| Elemento                    | Texto                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `criar.dados`, título       | Crie sua conta                                                                                                      |
| apoio                       | Use o e-mail que você mais olha: é com ele que você entra.                                                          |
| rótulos                     | E-mail / Crie uma senha                                                                                             |
| ajuda da senha              | Pelo menos 10 caracteres. Uma frase curta funciona bem.                                                             |
| status vivo da senha        | 7 de 10 caracteres (e, ao chegar: "Senha boa.")                                                                     |
| botão                       | Continuar                                                                                                           |
| rodapé                      | Já tem conta? **Entrar**                                                                                            |
| `criar.idade`, título       | Falta pouco                                                                                                         |
| apoio (provedor)            | Olá, {nome}. Vamos criar sua conta com {e-mail}.                                                                    |
| apoio (e-mail)              | Só mais duas coisas.                                                                                                |
| rótulo do nome              | Como você se chama? (ajuda: "É como a sua comunidade vai ver você.")                                                |
| pergunta                    | Quantos anos você tem?                                                                                              |
| instrução                   | Ao tocar na sua idade, sua conta é criada e você aceita os **Termos de Uso** e a **Política de Privacidade**.       |
| opções                      | 18 anos ou mais / 16 ou 17 anos / Menos de 16 anos                                                                  |
| `criar.responsavel`, título | Seu responsável sabe?                                                                                               |
| texto                       | Para ter 16 ou 17 anos no {NOME_DO_APP}, seu pai, sua mãe ou seu responsável precisa saber e concordar.             |
| botão / voltar              | Sim, meu responsável sabe e concorda / Voltar                                                                       |
| `criar.menor`, título       | Ainda não dá para criar a conta                                                                                     |
| texto                       | O {NOME_DO_APP} é para quem tem 16 anos ou mais. Converse com seu responsável ou com a liderança da sua comunidade. |
| botão                       | Voltar                                                                                                              |
| Sucesso                     | Conta criada. Que bom ter você aqui.                                                                                |

Observação de alternativa (item 1 da seção 9.2): se o jurídico preferir o aceite dos Termos como caixa de marcar, a instrução vira "Marque a caixa abaixo para continuar" e o fluxo ganha 1 toque.

### 5.4 `convite.folha`

| Elemento              | Texto                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Título                | Tenho um convite ou código                                                                                |
| Rótulo                | Link ou código                                                                                            |
| Ajuda                 | Cole o link que a liderança mandou ou digite o código da comunidade.                                      |
| Botão dentro do campo | Colar                                                                                                     |
| Botão                 | Continuar                                                                                                 |
| Erro                  | Não reconheci esse link ou código. Cole o link inteiro, do começo ao fim, ou digite o código sem espaços. |
| Convite guardado      | Convite guardado. Agora entre ou crie sua conta.                                                          |

### 5.5 Mensagens de erro

Regra: diz o que houve e o que fazer, sem desculpa, sem código, sem "algo deu errado". O erro de campo fica logo abaixo do campo, com ícone e texto (a cor nunca é o único sinal). O erro geral fica acima do botão primário.

| Situação                                                                                  | Texto                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E-mail vazio                                                                              | Digite seu e-mail.                                                                                                                                                                                |
| E-mail inválido                                                                           | Esse e-mail parece incompleto. Confira se tem @ e o final, como nome@exemplo.com.                                                                                                                 |
| Senha vazia                                                                               | Digite sua senha.                                                                                                                                                                                 |
| **Senha errada e conta não encontrada (mesmo texto, de propósito)**                       | **E-mail ou senha não conferem.** Confira os dois e tente de novo. Se você criou a conta com a Apple ou o Google, use o botão deles. [Esqueci a senha]                                            |
| Senha curta (criar)                                                                       | Faltam {n} caracteres. Use pelo menos 10; uma frase curta funciona.                                                                                                                               |
| Senha parecida com e-mail ou nome (criar)                                                 | Essa senha lembra seu e-mail ou seu nome. Escolha uma que só você saiba.                                                                                                                          |
| Senha repetitiva (criar)                                                                  | Misture letras ou palavras. Repetir o mesmo caractere é fácil de adivinhar.                                                                                                                       |
| Nome vazio ou curto                                                                       | Digite seu nome.                                                                                                                                                                                  |
| Sem internet                                                                              | Sem internet. Confira o Wi-Fi ou os dados do celular e tente de novo. [Tentar de novo]                                                                                                            |
| Aviso persistente sem internet                                                            | Sem internet. Para entrar, o aparelho precisa estar conectado.                                                                                                                                    |
| Tempo esgotado (12 s)                                                                     | Está demorando mais que o normal. Sua internet pode estar fraca. [Tentar de novo]                                                                                                                 |
| Muitas tentativas                                                                         | Muitas tentativas seguidas. Espere alguns minutos e tente de novo, ou crie uma senha nova.                                                                                                        |
| Cancelou Apple ou Google                                                                  | **Nenhuma mensagem.** Voltar ao estado anterior, com o foco no botão que a pessoa tocou. Se cancelar 2 vezes seguidas: "Prefere entrar com e-mail? Toque em Entrar com e-mail." (dica, não erro). |
| Falha do provedor (não foi cancelamento)                                                  | Não deu para entrar com {a Apple ou o Google} agora. Tente de novo ou use outro jeito de entrar.                                                                                                  |
| Conta já existe com outro método (provedor encontra conta de e-mail ainda não confirmada) | Já existe uma conta com o e-mail {a***@gmail.com}, criada com senha. Entre com seu e-mail e senha. [Entrar com e-mail] (abre `entrada.email` com o e-mail preenchido)                             |
| Criar com e-mail que já tem conta                                                         | Este e-mail já tem conta. [Entrar] [Esqueci a senha]                                                                                                                                              |
| Recuperar senha, depois de enviar                                                         | Se esse e-mail tiver conta, enviamos um link para criar uma senha nova. Olhe também a caixa de spam.                                                                                              |

**Por que "senha errada" e "conta não encontrada" têm o mesmo texto.** Dizer "não existe conta com este e-mail" na tela de entrada revela quem usa o app (a lista de pessoas de uma igreja é dado sensível). Mantemos uma mensagem única e a deixamos útil (menciona Apple e Google e oferece a recuperação). A exceção consciente é o cadastro: o app já avisa "este e-mail já tem conta" (necessário para a pessoa seguir), limitado pelas tentativas do servidor.

### 5.6 Carregando e sucesso

| Momento                              | Texto                                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Botão do provedor carregando         | o rótulo continua (o nome do botão não muda para o leitor de tela); o logotipo vira indicador                           |
| Botão "Entrar" carregando            | Entrando...                                                                                                             |
| Botão de criar carregando            | Criando sua conta...                                                                                                    |
| Demora (10 s)                        | Ainda entrando... Se demorar mais, toque em Tentar de novo.                                                             |
| Anúncio do leitor de tela, ao entrar | Você entrou.                                                                                                            |
| Anúncio ao criar                     | Conta criada.                                                                                                           |
| Sucesso visual                       | a própria transição para o Início; para conta nova, o aviso "Conta criada. Que bom ter você aqui." em "Comece por aqui" |

Ajuda contextual (ajuda e documentação, heurística 10): não há um link "Ajuda" genérico na primeira tela, para não competir com os acessos. A ajuda vive onde a dúvida nasce: no erro de senha, na folha de convite e em Perfil, Ajuda e sobre.

## 6. Estados e casos de borda

| Caso                                           | Regra                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Carregando**                                 | O botão tocado mostra o indicador no lugar do logotipo ou do rótulo e mantém o mesmo tamanho (sem pulo de layout). Os outros acessos ficam inativos com o rótulo legível e `accessibilityState.disabled`. Se a resposta chega em menos de 250 ms, o indicador não pisca. Aos 10 s aparece "Tentar de novo"; aos 12 s termina com `erro.tempo` (valores do D58).                                                                                                  |
| **Erro por campo**                             | Aparece ao sair do campo (não a cada tecla) e some assim que o valor fica certo. Ícone mais texto. No envio, o foco vai ao primeiro campo com erro.                                                                                                                                                                                                                                                                                                              |
| **Erro geral**                                 | Fica logo acima do botão primário, com o texto da seção 5.5 e a ação certa dentro (Tentar de novo, Esqueci a senha). Anunciado como região viva assertiva.                                                                                                                                                                                                                                                                                                       |
| **Nunca perder o digitado**                    | Erro, volta do painel, rotação, ida a "Esqueci a senha" e retorno preservam e-mail, senha e nome. A senha não vai para log, armazenamento persistente nem estado de navegação serializado (só memória).                                                                                                                                                                                                                                                          |
| **Teclado**                                    | O primário fica preso acima do teclado; os campos rolam. `returnKeyType`: e-mail "Próximo", senha "Entrar" (envia), nome "OK" (fecha o teclado). Toque fora do campo fecha o teclado, e `keyboardShouldPersistTaps="handled"` impede perder o toque no botão.                                                                                                                                                                                                    |
| **Preenchimento do sistema**                   | Entrar: e-mail com `autoComplete="username"` e `textContentType="username"`; senha com `current-password` e `password`. Criar: e-mail `email`; senha `new-password` e `newPassword` (o iOS e o Android oferecem senha forte e salvam). Os dois campos ficam **no mesmo painel** para o chaveiro ligar e salvar o par. Sem `autoCorrect`, sem capitalização automática no e-mail. Depois de preencher pelo sistema, o botão não envia sozinho: a pessoa confirma. |
| **Face ID / Touch ID**                         | Dispara sozinho em `entrada.inicio.biometria`; cancelar ou falhar não mostra erro, só deixa o botão "Entrar com Face ID" e os outros acessos. Depois de 3 falhas do sistema, cai para os acessos normais. Texto do nome da biometria vem do aparelho.                                                                                                                                                                                                            |
| **Provedor indisponível**                      | Botão que o aparelho não oferece (Apple fora do iOS, Google sem configuração) **não aparece**; sem nenhum provedor, o painel de e-mail abre direto.                                                                                                                                                                                                                                                                                                              |
| **Rotação**                                    | Estado e texto preservados; o painel aberto continua aberto. Paisagem: marca à esquerda, ações à direita quando a altura é menor que 500 pt.                                                                                                                                                                                                                                                                                                                     |
| **Fonte grande do sistema**                    | Rótulos quebram em até 3 linhas (nada de reticências). Botões crescem em altura, nunca cortam o texto. Acima de 120% a tela rola, as ações vêm antes e a marca encolhe. Nenhum texto fixo a 1 linha. Tudo testado em 100%, 150% e no maior tamanho de acessibilidade.                                                                                                                                                                                            |
| **VoiceOver e TalkBack: ordem de foco**        | 1. nome do app (cabeçalho nível 1, recebe o foco ao abrir); 2. apoio; 3. cartão de convite, se houver; 4. acessos na ordem visual (primário, secundário, e-mail); 5. "Criar conta"; 6. "Tenho um convite ou código". Em `entrada.email`: Voltar, título, E-mail, Senha, Mostrar, Esqueci a senha, Entrar, Criar conta. A ordem de leitura é a ordem visual.                                                                                                      |
| **VoiceOver e TalkBack: rótulos**              | Botões com o texto visível como nome ("Continuar com a Apple"); o logotipo é decorativo (oculto). Mostrar senha tem rótulo "Mostrar senha" e estado alternado. Campos com rótulo visível ligado ao campo (nunca só placeholder). Erro de campo: o leitor lê "{campo}, erro: {texto}".                                                                                                                                                                            |
| **VoiceOver e TalkBack: anúncios**             | Ao abrir um painel (`entrada.email`) o foco vai para o título do painel; ao voltar, para o botão que o abriu. Erros e "Entrando..." usam região viva. O sucesso ("Você entrou.") é anunciado uma vez, antes da troca de tela.                                                                                                                                                                                                                                    |
| **Reduzir movimento**                          | Sem deslizes, sem escala ao toque, sem pulso, sem movimento da aurora. Trocas viram esmaecimento de até 120 ms ou troca imediata. O háptico continua (é outra preferência).                                                                                                                                                                                                                                                                                      |
| **Aumentar contraste**                         | Bordas de 2 pt na cor do texto, textos sem transparência, aurora estática e opaca; o botão tonal ganha contorno visível. Cor nunca é o único sinal: ícone mais texto.                                                                                                                                                                                                                                                                                            |
| **Reduzir transparência**                      | Sem vidro na entrada. Nenhuma informação depende de desfoque.                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Contraste AA**                               | Todo texto, ícone e borda de campo medidos sobre o fundo real (aurora incluída) nos temas claro e escuro. Texto secundário nunca abaixo de 4,5:1; borda de campo a 3:1. O "Usado da última vez" e o rodapé contam como texto.                                                                                                                                                                                                                                    |
| **Alvos de toque**                             | 44 pt no mínimo em tudo, 48 nos links de largura total, 52 nos acessos. Mostrar/Ocultar tem 44 x 44 com texto.                                                                                                                                                                                                                                                                                                                                                   |
| **Sem internet**                               | Aviso persistente no alto (`sem.internet`); os botões continuam visíveis e, ao tocar, mostram `erro.rede` com "Tentar de novo". Nada fica desabilitado sem motivo dito.                                                                                                                                                                                                                                                                                          |
| **Convite inválido ou vencido**                | Ver 3.6. Não prende a pessoa.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Aba aberta pelo link com a sessão já ativa** | Vai direto ao convite sem passar por entrada.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Menor de 16**                                | `criar.menor`: sem dados guardados, a trava de cadastro existente (`useCadastroTravado`) continua valendo.                                                                                                                                                                                                                                                                                                                                                       |
| **Web**                                        | O foco visível é obrigatório (anel de foco), Enter envia, o desafio de segurança do cadastro público (ADR 0008) aparece só em `criar.idade`, no momento da criação, nunca como tela à parte.                                                                                                                                                                                                                                                                     |

## 7. Microinterações que ajudam

Só entram as que dão **retorno**, **orientação** ou **segurança**. Durações são sugestões; o documento de UI fecha os valores.

| Microinteração                          | Momento                                         | Propósito                                                                                                                                    | Com Reduzir movimento                                                                                                                    |
| --------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Retorno ao toque                        | ao pressionar qualquer botão                    | confirmar "recebi o toque" (retorno, Norman)                                                                                                 | só a troca de cor (80 ms); sem escala. O háptico leve continua.                                                                          |
| Revelar o e-mail                        | ao tocar "Entrar com e-mail"                    | a pessoa entende que o painel veio **daquele botão**, não é outra tela; a marca encolhe para dar espaço                                      | troca imediata, ou esmaecimento de 120 ms. O foco vai ao campo E-mail **depois** da transição (o teclado não abre no meio do movimento). |
| Voltar do painel                        | gesto de voltar ou "Outras formas de entrar"    | prevenir a sensação de "ficar preso" e mostrar que nada se perdeu                                                                            | idem                                                                                                                                     |
| Validação ao sair do campo              | ao sair do e-mail ou da senha                   | dizer o erro cedo, sem gritar a cada tecla; o erro some quando o valor fica certo                                                            | igual (já não tem movimento)                                                                                                             |
| Mostrar/ocultar senha                   | toque em "Mostrar"                              | conferir sem pedir "repita a senha"; o rótulo alterna e é anunciado ("Senha visível")                                                        | igual; sem animação. A senha volta a ficar oculta ao ir para segundo plano.                                                              |
| Status da senha                         | enquanto digita em `criar.dados`                | mostrar quanto falta ("7 de 10 caracteres") em texto, sem lista longa                                                                        | igual; atualização sem animação, com região viva "polida"                                                                                |
| Botão em carregamento                   | ao enviar                                       | impedir toque duplo e mostrar que o app trabalha, sem mudar o tamanho                                                                        | o indicador continua (é estado, não enfeite); sem rotação extra do logotipo                                                              |
| Erro                                    | ao falhar                                       | levar o olhar ao problema: borda mais ícone mais texto, foco no primeiro campo; um háptico de erro, uma vez                                  | sem tremor (nunca há tremor); o resto igual                                                                                              |
| Convite guardado                        | ao voltar da folha                              | confirmar que o convite está pronto e que o resto da entrada continua                                                                        | surge sem deslizar; "Remover" tem desfazer de 5 s                                                                                        |
| Sucesso ao entrar                       | quando a sessão abre                            | marcar o fim da tarefa: háptico de sucesso, anúncio "Você entrou." e a troca de tela; a animação nunca atrasa a navegação (máximo de 200 ms) | troca imediata; háptico e anúncio mantidos                                                                                               |
| Face ID automático                      | ao abrir com sessão guardada                    | zero toques para quem volta                                                                                                                  | igual                                                                                                                                    |
| Entrada da marca na abertura (opcional) | uma vez por abertura do app, não a cada retorno | dar identidade sem custo de tempo; ícone com esmaecimento e escala leve (400 ms), sem bloquear toque                                         | não anima                                                                                                                                |

Fora: tremor no erro, confete, rotação do ícone, pulso contínuo no botão e qualquer coisa que adie a pessoa mais de 300 ms.

## 8. Como medir se ficou bom

### 8.1 Cinco critérios simples

| #   | Critério                | Meta                                                                                                                                                | Como medir                                                               |
| --- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | **Conclusão sem ajuda** | 3 de 3 pessoas chegam ao Início sem que ninguém explique (no teste)                                                                                 | observação do teste de 15 min                                            |
| 2   | **Toques e passos**     | Apple/Google: no máximo 2 toques para conta nova e 1 para conta existente; e-mail: no máximo 3 passos                                               | contagem no protótipo e checagem automatizada do caminho (teste de tela) |
| 3   | **Tempo**               | Apple/Google em até 20 s; e-mail em até 60 s (conta existente, com o chaveiro) e 90 s (conta nova)                                                  | cronômetro no teste                                                      |
| 4   | **Cabe sem rolar**      | iPhone SE 375 x 667 em fonte padrão: `entrada.inicio` sem rolagem; `entrada.email` e `criar.dados` com teclado aberto: campo ativo e botão visíveis | captura em simulador e aparelho; teste de layout                         |
| 5   | **Erro e recuperação**  | no máximo 1 erro por pessoa no teste; quem erra recupera sozinho em menos de 30 s; ninguém toca em "Criar conta" querendo "Entrar"                  | observação do teste                                                      |

Se o app já tiver contagem agregada e autorizada, serve como termômetro: abertas da entrada, método escolhido, tipo de erro, entradas concluídas (nenhum e-mail, nome ou conteúdo). Teto de gasto zero: não se contrata ferramenta de medição para isso.

Pergunta de fechamento do teste (sobre o que acabou de acontecer, não sobre o futuro): "De 1 a 5, quão fácil foi entrar?" e "O que quase te fez desistir?". Uma média abaixo de 4 ou a mesma falha em 2 de 3 pessoas pede correção antes de seguir.

### 8.2 Teste de usabilidade de 15 minutos com 3 pessoas

**Quem** (uma de cada): jovem de 16 a 25 anos com iPhone; adulto de 50 anos ou mais, pouco familiarizado com apps; líder ou voluntário de igreja (Android ou iPhone).

**Antes:** build de homologação (ou protótipo clicável) com **contas fictícias do time** para e-mail e senha. Não usar Apple ID, Google ou e-mail pessoal da pessoa de teste em homologação (regra de dados reais do projeto). Para Apple e Google, usar as contas de teste do time ou observar até a folha do sistema abrir.

| Tempo       | O que acontece      | Roteiro                                                                                                                                                              |
| ----------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 a 2 min   | Abertura            | "Estamos testando o aplicativo, não você; não existe resposta errada. Pense em voz alta. Pode parar quando quiser." Peça permissão para anotar.                      |
| 2 a 4 min   | Passado             | "Da última vez que você instalou um aplicativo novo para um grupo, como foi entrar nele? O que atrapalhou?" Não pergunte se "usaria" nada.                           |
| 4 a 8 min   | Tarefa 1 (convite)  | "O líder do seu grupo mandou este link por mensagem. Abra e entre." Não ajude. Marque: onde toca primeiro, o que lê, o método que escolhe, hesitação maior que 5 s.  |
| 8 a 11 min  | Tarefa 2 (volta)    | "Você já tem uma conta com este e-mail e esta senha (entregue o cartão com a conta fictícia). Feche o app e entre de novo." Observe: usa o chaveiro? Acha "Mostrar"? |
| 11 a 13 min | Tarefa 3 (esqueceu) | "Agora imagine que você esqueceu a senha. O que faria?" (a senha do cartão está errada de propósito.) Observe se acha "Esqueci a senha" e se entende a mensagem.     |
| 13 a 15 min | Fechamento          | "De 1 a 5, quão fácil foi entrar?" "O que quase te fez desistir?" "Teve alguma palavra que não entendeu?" Agradeça.                                                  |

Regras de quem conduz: só pergunte "o que você esperava que acontecesse?" depois de 20 s parada; nunca diga "toque aqui"; anote a frase exata que a pessoa usou para o botão ou a tela (ela vira texto do app). Registro: uma tabela por pessoa (tarefa, concluiu, tempo, erros, hesitações, frase literal). Resultado em `docs/design/` com data absoluta e, se algo falhar, entrada em `docs/DECISOES.md`.

## 9. O que é UX e o que é UI, e o que o time visual precisa decidir

**UX (este documento) decide:** quais telas e estados existem, a ordem, quantos toques e passos, a hierarquia entre ações, o texto, os erros, o comportamento do teclado, do autopreenchimento e dos leitores de tela, e os critérios de teste.

**UI e movimento (`docs/design/login-v2-ui-motion.md`) decide:** cores, tipografia, tamanhos finais, espaçamento e ritmo (a escala que dá o agrupamento por proximidade), o uso da aurora e do vidro, as curvas e as durações, o desenho do ícone e da marca, a versão clara e escura, o layout em tela larga e a aparência dos três níveis de ação. Usa os **mesmos nomes de estado** da seção 3.4.

**Restrições de UX que o visual precisa cumprir:** cabe sem rolar nos números da seção 3.5; um único preenchimento de acento por estado; Apple e Google com altura e largura iguais; Reduzir movimento, Reduzir transparência e Aumentar contraste com versão definida; contraste AA medido sobre o fundo real; alvos de 44 pt; cor nunca é o único sinal.

### 9.1 Pontos que o time de design visual precisa fechar

1. Como diferenciar Apple (primário) e Google (secundário) sem laje branca dupla: o tema escuro do botão do Google (fundo `#131314` com contorno) é a opção natural no escuro e o tema claro no claro. Conferir as regras de marca vigentes da Google e da Apple antes de fixar os tokens (hoje o token do Google é só branco).
2. O tratamento do coral (acento) como único preenchimento do "avançar" do painel e como ele convive com o botão branco da Apple em `entrada.inicio`.
3. Marca: tamanho do ícone (sugestão de 72 pt em `entrada.inicio`, 40 em `entrada.email`, 28 com teclado aberto), posição e se a aurora aparece só em `entrada.inicio`.
4. Ritmo: uma escala de espaçamento com saltos claros entre grupos (marca, acessos, rodapé).
5. O cartão do convite compacto de 56 pt em `entrada.inicio.convite`.
6. A transição de revelar o e-mail: a marca encolhe, os acessos saem e o painel entra; duração, curva e o equivalente com Reduzir movimento.
7. O estado "Usado da última vez" (texto mais ícone, sem depender de cor).
8. A coluna de 400 pt em tela grande e a faixa de marca em 900 pt ou mais.
9. Ícone de Face ID dentro do botão, e o desenho de "Mostrar" com texto.

### 9.2 Decisões pendentes para o dono (com recomendação)

1. **Aceite dos Termos por ação (recomendado) ou por caixa.** Hoje é caixa (TC-02). Com "tocar na idade cria a conta e aceita os Termos" (texto visível acima dos botões), Apple e Google chegam a 2 toques para conta nova. Com caixa: 3 toques. Precisa de ok do jurídico; até lá o v2 pode sair com a caixa sem mudar o resto.
2. **Método usado da última vez no aparelho.** Guardar só a marca do método (sem e-mail). Recomendado: sim.
3. **Aceite de fé (TC-03) no momento de participar da comunidade**, não na entrada. Recomendado: sim, e ele continua obrigatório antes de o convite ser aceito.
4. **WhatsApp opcional fora da entrada.** Recomendado: sim (sugestão no Perfil).
5. **Texto de "Entrar" na comunidade:** a palavra "Entrar" na entrada só significa acessar a conta. Para a ação de entrar numa comunidade (Perfil), usar "Participar" nas próximas revisões de texto.

### 9.3 Fora do escopo desta revisão

Segundo fator, recuperar e redefinir senha, convite já com sessão, e o desenho interno do Perfil. Só herdam o e-mail digitado e os nomes de estado.

## O que foi feito (21/11/2026, D63)

Implementado em `apps/app/src/funcionalidades/autenticacao/`, `cadastro/` e `convite/CadastroPorConvite.tsx`, com os mesmos nomes de estado da seção 3.4. Decisão registrada em D63.

**Como no desenho:**

- Tela única `/entrar` com revelação progressiva; o painel de e-mail vive na rota (`?modo=email`, empilha a mesma rota, então o voltar do sistema e do navegador o fecham); sem nenhum provedor o e-mail já abre aberto.
- Hierarquia da seção 4 (função pura `ordemDosAcessos`, com teste): Apple primária no iOS, Google secundário, e-mail terciário; Google primário e e-mail em contorno no Android e na web; o método usado da última vez sobe com o selo "Usado da última vez" (só a marca é guardada); "Entrar com Face ID" vem primeiro quando há sessão guardada.
- Textos das seções 5.1, 5.2, 5.3 (exceto as listadas abaixo), 5.4 e 5.5; senha errada e conta não encontrada com o mesmo texto; "Esqueci a senha" dentro do erro e, na segunda falha, botão; cancelar Apple ou Google não mostra erro (duas vezes seguidas vira a dica); sem internet com "Tentar de novo"; aviso fixo de "Sem internet".
- Criar conta em duas telas (`criar.dados` e "Falta pouco"), sem "repita a senha", com status vivo da senha; "Falta pouco" é a mesma tela para Apple, Google, e-mail e convite; `autoComplete` e `textContentType` de entrada e de senha nova no mesmo painel.
- Erro por campo ao sair do campo, foco no primeiro campo com erro, `returnKeyType`, `keyboardShouldPersistTaps="handled"`, anúncios do leitor de tela ("Você entrou.", "Conta criada.").
- Sucesso: o guarda do grupo público segura o redirecionamento por 200 ms só para quem acabou de pedir a entrada.

**Decisões do dono aplicadas:** o aceite continua por **caixa de marcar** (a sugestão de aceitar ao tocar na idade, item 1 da seção 9.2, NÃO foi feita: depende do jurídico, PH-11); o método da última vez guarda só a marca; o WhatsApp opcional saiu da entrada por convite; a confirmação de e-mail não é mencionada.

**Diferenças em relação ao desenho (e por quê):**

1. A pergunta de idade e os Termos usam os componentes e os textos de sempre (`PerguntaDeIdade`, `AceiteDosTermos`, `MenorDe16`): as opções longas ("Tenho 16 ou 17 anos, e meu pai, minha mãe ou meu responsável legal sabe...") declaram a ciência do responsável na própria escolha, então não existem as telas `criar.responsavel` e `criar.menor` (o aviso de menor de 16 aparece na própria tela, com a trava de 24 horas). Mantê-los palavra por palavra evita enfraquecer qualquer mecanismo legal antes da PH-11.
2. O consentimento sobre a fé (TC-03) **continua no cadastro por convite**, como passo "Participar" depois de "Falta pouco" (a seção 9.2, item 3, sugeria movê-lo para depois da conta; não foi pedido).
3. `/convite` (link ou QR) não é a tela de entrada com o cartão: segue sendo `CadastroPorConvite`, agora com um primeiro passo (cartão, acessos, "Criar conta com e-mail") e os passos de e-mail e senha, "Falta pouco" e "Participar". A tela de entrada mostra o cartão compacto "Você foi convidado" quando o convite foi guardado pela folha "Tenho um convite ou código" (que aceita o link do convite, o código da comunidade e o link do código).
4. O cartão do convite não sabe o nome da comunidade (a consulta exige rede e o convite fica só em memória): mostra "Seu convite está guardado.". O campo de e-mail travado para convite com e-mail destino não foi feito.
5. Sem háptico (não há dependência para isso e a decisão do dono foi não adicionar nenhuma).
6. Aos 10 s o botão Entrar passa a "Ainda entrando..."; o "Tentar de novo" aparece no erro de rede. O limite de 12 s é o do cliente da API (D58).
7. Paisagem: sem o arranjo em duas colunas; a rolagem de segurança cobre.
8. O teste de usabilidade da seção 8.2 não foi feito (precisa de pessoas e de build de homologação).

**Evidência:** testes de `TelaEntrar` (estados `entrada.inicio`, `entrada.email`, erro, carregando, sucesso, biometria, convite, fonte grande, persistência de `?modo=email`, método da última vez), `Cadastro`, `Convite`, `FolhaDeConvite`, `GuardaDoGrupoPublico`, `ordemDosAcessos` e `medidasDoAcesso` (cabe sem rolar nos tamanhos da tabela, painel com teclado). Capturas em `scripts/apresentacao/telas/login-*.jpg`. Não verificado em aparelho: Face ID real, teclado sobre o painel, VoiceOver e TalkBack, a Apple no iPhone.
