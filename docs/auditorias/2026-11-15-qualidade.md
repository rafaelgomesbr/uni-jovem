# Auditoria de qualidade antes dos testadores

- **Data:** 15/11/2026.
- **Escopo:** app (`apps/app`), API (`apps/api`) e prontidão para TestFlight e teste interno do Google Play. Código, comportamento na prévia local e conferência das URLs públicas.
- **Base auditada:** commit `09d5f3b` (branch `release`). Durante a auditoria, outro agente começou a corrigir a falha de "Nova programação" no working tree (não commitado). O estado dessas correções está anotado em cada achado.
- **Quem:** agente de QA. Só leitura em `apps/` e `packages/`; nada publicado, nenhum commit.

## 1. Resumo executivo

**Veredito: NÃO está pronto para testadores (BLOQUEADO).**

Três motivos, nesta ordem:

1. **Criar e editar programação fecham o app** (iPhone) e deixam a tela em branco (web), em qualquer entrada, não só em "Nova programação neste dia". A causa é uma só e foi provada: o React Compiler memoriza o objeto devolvido por `useRefsDosCampos` e pula os quatro `useRef` a partir do segundo render. A ordem dos hooks muda, o React lança erro e, sem limite de erro em rota nenhuma, o erro vira fatal no build de release. A web da homologação serve o mesmo pacote (`entry-be9391c8...`), então o defeito está publicado lá também.
2. **Nenhuma rota tem limite de erro** no commit auditado. Qualquer erro de renderização, em qualquer tela, fecha o app. Isso transforma defeitos médios (por exemplo, uma data fora do intervalo num link) em fechamento do app.
3. **O build de loja aponta para um endereço que não existe.** O perfil `producao` do EAS usa `https://unijovem.solerte.com.br`, que hoje responde 404 (`x-vercel-error: DEPLOYMENT_NOT_FOUND`) em `/api/saude`, `/privacidade`, `/termos`, `/excluir-conta`, `/suporte` e `/.well-known/*`. TestFlight e Play interno exigem build de distribuição; com o perfil atual, o testador instala, tenta entrar e recebe erro.

A boa notícia: a varredura com o React Compiler em **todos os 370 arquivos** do app (iOS e web) encontrou **um único ponto** com hook dentro de bloco memorizado, o mesmo `useRefsDosCampos`. Não há outra falha da mesma classe escondida. O restante do código é cuidadoso (erros humanos, `JSON.parse` protegido, offline cifrado, renovação de sessão em fila). O que falta é proteção contra o imprevisto (limite de erro, tempo limite de rede), comportamento sem rede nas ações comuns e o ambiente de produção no ar.

O outro agente já tem no working tree a correção de `useRefsDosCampos`, um limite de erro por tela (`ErroDeRota`) e o Jest passando pelo React Compiler. Quando isso for commitado e o domínio de produção estiver no ar, o veredito pode subir para "aprovado com ressalvas", desde que as correções 4 a 7 da seção 4 entrem junto.

## 2. Como foi verificado

| Verificação                                                                                                       | Resultado                                                                                    | Evidência                                  |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `npm run verificar` no commit `09d5f3b`                                                                           | verde: 43 arquivos e 469 testes da API, 44 suítes e 272 testes do app, fumaça web em 2 telas | log local da rodada de 15/11/2026          |
| Varredura Playwright na prévia (`http://localhost:8090/app`), conta admin, 390 x 844, pt-BR, fuso de São Paulo    | 110 rotas: 9 com erro de página (`pageerror`), nenhum 5xx                                    | seção 3, B1 e M1                           |
| Mesma varredura com a conta membro                                                                                | 65 rotas, nenhum erro de página, nenhum 5xx                                                  | telas de permissão negada com texto humano |
| Rotas com parâmetro sujo (data inexistente, id inexistente, tipo inválido, fragmento inválido)                    | 43 rotas; 404 tratados com estado de erro e "Tentar de novo"; 2 defeitos                     | B1, M1, A3                                 |
| Compilação de todos os arquivos do app com `babel-preset-expo` e `supportsReactCompiler: true` (como o Metro faz) | 1 arquivo com hook dentro de bloco memorizado                                                | B1                                         |
| Fluxos na prévia: publicar aviso sem rede, clique duplo, voltar com formulário preenchido, sessão sem cookie      | 3 defeitos reproduzidos                                                                      | A1, A2, A5                                 |
| URLs públicas de produção e homologação (`curl`)                                                                  | produção 404 em tudo; homologação 200 em tudo                                                | B3                                         |

## 3. Achados

Gravidade: **bloqueia** (perde dado, fecha o app, erra dado de outro, não sobe ou impede a tarefa principal), **alto**, **médio**, **baixo**.

### B1. Criar e editar programação fecham o app (bloqueia)

- **Onde:** `apps/app/src/funcionalidades/eventos/CamposDoEvento.tsx:48` (`useRefsDosCampos`), chamado em `TelaNovoEvento.tsx:109` e `TelaEditarEvento.tsx:126`.
- **Causa provada:** compilado pelo React Compiler, o hook vira:

  ```js
  function useRefsDosCampos() {
    var $ = c(1)
    var t0
    if ($[0] === Symbol.for('react.memo_cache_sentinel')) {
      t0 = {
        titulo: useRef(null),
        categoria: useRef(null),
        duracao: useRef(null),
        capacidade: useRef(null),
      }
      $[0] = t0
    } else {
      t0 = $[0]
    }
    return t0
  }
  ```

  No primeiro render os quatro `useRef` rodam; do segundo em diante, não. Os hooks seguintes de `NovoEvento` e `EditarEvento` passam a ler o estado errado.

- **Reprodução (web, prévia):** entrar como `demo.admin`, abrir `/app/evento/novo` (com ou sem `?data=`, `?modelo=sabado_padrao`, `?modelo=escolher`). Esperado: o formulário. Obtido: tela em branco e `TypeError: Cannot read properties of undefined (reading 'length')` dentro de `useEffect`. Em `/app/evento/<id>/editar`: tela em branco e `Minified React error #311` (hook chamado fora de ordem). No iPhone, o mesmo erro sem limite vira `ExceptionsManager` e SIGABRT, como o dono relatou.
- **Alcance:** toda criação de programação (botão do topo, Agenda, sábado padrão, modelo) e toda edição. É a tarefa principal da organização.
- **Por que os testes passaram:** o Jest não passa pelo React Compiler. `babel-preset-expo` só liga o compilador quando o chamador informa `supportsReactCompiler`, e só o Metro informa (`node_modules/babel-preset-expo/build/common.js:189`, `@expo/metro-config/build/babel-transformer.js:110`). Os 272 testes do app testam um código que não vai para o aparelho.
- **Correção proposta:** cada `useRef` numa linha própria, fora do objeto literal. **Estado:** feita no working tree pelo outro agente (não commitada), junto com `apps/app/jest.config.js` que liga o compilador no Jest.
- **Regressão:** (1) o teste "Nova programação neste dia" de `Formularios.test.tsx` precisa provocar um segundo render (locais carregando) com o compilador ligado; (2) uma checagem no `verificar` que compila todos os arquivos com o compilador e falha se um `use...(` aparecer dentro de um bloco `if($[n]===...)`. O roteiro usado nesta auditoria está descrito no apêndice A.

### B2. Nenhuma rota tem limite de erro (bloqueia)

- **Onde:** `apps/app/src/app/_layout.tsx` e todas as rotas em `apps/app/src/app/**`: nenhum `export function ErrorBoundary`, nenhum `componentDidCatch`.
- **Efeito:** qualquer exceção na renderização ou num efeito derruba o app inteiro no build de release. Foi o que transformou B1 em fechamento. O mesmo vale para M1 e para qualquer resposta inesperada da API que chegue a uma formatação de data.
- **Correção proposta:** `ErrorBoundary` no layout raiz e limite por tela, com "Tentar de novo" e o voltar. **Estado:** o outro agente criou `apps/app/src/ui/ErroDeRota.tsx` e exportou `unstable_settings = { screenErrorBoundary: ErroDeRota }` no layout raiz (a opção existe no `expo-router` 58.0.31, `build/useScreens.js:196`). Falta provar no **build de release**: forçar um erro numa tela de teste e confirmar que só aquela tela cai, no iPhone e no Android.

### B3. O build de loja aponta para um domínio que responde 404 (bloqueia)

- **Onde:** `apps/app/eas.json`, perfil `producao`: `EXPO_PUBLIC_API_URL=https://unijovem.solerte.com.br`.
- **Reprodução:** `curl -i https://unijovem.solerte.com.br/api/saude` responde `404`, `x-vercel-error: DEPLOYMENT_NOT_FOUND`. O mesmo em `/privacidade`, `/termos`, `/excluir-conta`, `/suporte`, `/.well-known/apple-app-site-association` e `/.well-known/assetlinks.json`. A homologação responde 200 em todas.
- **Efeito:** testador do TestFlight ou do Play interno não consegue entrar; os links de privacidade, termos e exclusão do app abrem 404; links universais e App Links não verificam; o Google já recusou a URL dos termos (`docs/lojas/estado-das-lojas.md`, seção 4, item 5).
- **Correção proposta:** concluir a PH-04 (site `unijovem-prod` no painel) e conferir as oito URLs com 200 antes de gerar o build. Alternativa, se o dono quiser testadores antes da produção: criar no App Store Connect e no Play Console o app de homologação (`com.solerte.unijovem.hml`) e distribuir o perfil `homologacao` como build de loja. É decisão do dono.

### A1. Ação sem rede fica girando para sempre e é enviada sozinha depois (alto)

- **Onde:** `apps/app/src/estado/clienteDeConsulta.ts`, `mutations: { retry: false }` sem `networkMode`. O padrão do React Query pausa a mutação sem rede e a retoma quando a rede volta.
- **Reprodução (prévia):** admin, `/app/avisos/novo`, preencher título e texto, desligar a rede, tocar "Publicar agora". Esperado: "Sem conexão" e o botão livre. Obtido: o botão fica em `aria-busy=true` por tempo indefinido, nenhuma mensagem; ao religar a rede, o `POST /avisos` sai sozinho (registro: 11,6 s, no mesmo instante em que a rede voltou).
- **Efeito:** a pessoa desiste, fecha a tela, e o aviso (com push para a comunidade), o pedido de oração ou a sugestão é publicado minutos depois sem ela saber. Vale para todas as `useMutation` que não são da fila offline.
- **Correção proposta:** `mutations: { retry: false, networkMode: 'always' }` no cliente, para falhar na hora com `SemConexao` e mostrar a mensagem; manter a fila offline só onde ela existe de propósito (presença, check-in).
- **Regressão:** teste com `onlineManager.setOnline(false)` que toca "Publicar" e espera "Sem conexão" e nenhuma chamada depois de `setOnline(true)`.

### A2. Envio duplicado: depois de salvar, a tela não fecha quando não há para onde voltar (alto)

- **Onde:** 34 chamadas de `router.back()` sem `router.canGoBack()`; as de sucesso de formulário estão em `avisos/TelaNovoAviso.tsx:155`, `oracao/TelaNovoPedido.tsx:98`, `sugestoes/TelaNovaSugestao.tsx:59`, `eventos/TelaMudarStatus.tsx:70`, `escalas/TelaPedirSubstituicao.tsx:71`, entre outras.
- **Reprodução (prévia, web):** abrir `/app/avisos/novo` direto (recarregar a página ou chegar por link), preencher, publicar. O aviso é criado, mas a tela continua no formulário preenchido com o botão ativo. Um segundo toque cria outro. Obtido na rodada: **2 avisos com o mesmo título** na lista.
- **Efeito:** avisos e pedidos duplicados, com push duplicado. No celular acontece quando a tela é aberta por link ou notificação.
- **Correção proposta:** um `voltarOu(destino)` único (`canGoBack() ? back() : replace(destino)`) e, nos formulários de criação, travar o envio por uma referência (`enviando.current`) além do `isPending`.

### A3. Mensagens técnicas em inglês chegam à tela (alto)

- **Onde:** `apps/api/src/http.ts:33`: `validar` junta `issue.message` do Zod. Onde o esquema não tem mensagem própria, sai o texto padrão do Zod em inglês.
- **Reprodução:** abrir `/app/convite#t=lixo`. Obtido na tela: "Não deu certo. Too small: expected string to have >=20 characters".
- **Efeito:** texto técnico em inglês para quem chega por link de convite quebrado (copiado pela metade no WhatsApp, por exemplo). Fere a regra 7 do `CLAUDE.md`.
- **Correção proposta:** `z.config(z.locales.ptBR())` na inicialização da API (o Zod 4.6.7 instalado tem `pt-BR`) e, em `validar`, trocar a mensagem por uma frase humana quando o código do erro não for de regra de negócio. Para o convite: "Este link de convite está incompleto. Peça um novo a quem convidou."

### A4. Limite de tentativas por faixa de IP derruba a abertura do app em grupo (alto)

- **Onde:** `apps/api/src/rotas/autenticacao.ts:95` (`entrarIp`: 30 em 15 min) e `:108` (`renovarIp`: 120 em 15 min), com chave `truncarIp` (faixa /24 no IPv4, /48 no IPv6, linha 170). No app, `apps/app/src/estado/sessao.tsx`, `iniciar()`: um 429 na renovação não é 401 nem `SemConexao`, então vira `falhaAoIniciar`.
- **Reprodução (prévia):** depois de cerca de 110 aberturas do app na mesma máquina, `POST /api/auth/renovar` responde 429 e o app abre em "Não foi possível abrir. Muitas tentativas seguidas." **sem a tela de Entrar e sem o modo offline**, por até 15 minutos.
- **Efeito provável (inferência, não reproduzido com pessoas reais):** num encontro com 30 ou 40 jovens no mesmo Wi-Fi, ou em operadora com CGNAT, a 31ª pessoa a entrar recebe 429, e a renovação de 15 em 15 minutos de todos soma contra o mesmo limite. É justamente o dia do check-in.
- **Correção proposta:** na API, chave por IP inteiro (não por faixa) para `renovar` e limite mais alto, já que o refresh é segredo de 128 bits e a força bruta nele é inviável; no app, tratar 429 na abertura como "sem rede" (abrir com a conta salva ou mostrar Entrar com a mensagem), nunca como tela sem saída.

### A5. Formulário longo fecha sem aviso e perde tudo (alto)

- **Onde:** nenhuma tela usa `usePreventRemove` ou `beforeRemove` para descartar. "Nova programação" e "Editar" são `fullScreenModal` com "Fechar" (`apps/app/src/app/(autenticado)/_layout.tsx`); aviso, pedido de oração, sugestão e conteúdo também não perguntam.
- **Reprodução (prévia):** `/app/sugestoes/nova`, preencher o título, voltar no navegador. Não aparece confirmação; ao avançar de novo, o título está vazio.
- **Efeito:** um organizador que montou uma programação inteira (título, descrição, local novo, inscrições) e toca "Fechar" por engano perde tudo.
- **Correção proposta:** `usePreventRemove(sujo, ...)` com "Descartar alterações?" nos formulários de criar e editar.

### A6. Pedidos de rede sem tempo limite (alto)

- **Onde:** `apps/app/src/servicos/api.ts:148`, `chamar`: `fetch` sem `AbortSignal.timeout` nem equivalente.
- **Efeito:** em Wi-Fi de igreja ou 4G fraco, o pedido fica pendurado; carregando eterno nas telas e botão travado em `isPending` nos formulários (o mesmo sintoma de A1, por outra causa). O `fetch` do React Native não tem tempo limite padrão útil.
- **Correção proposta:** tempo limite de 20 s nos pedidos comuns (combinado com o sinal do chamador), virando `SemConexao`; o long polling do ao vivo continua com o próprio sinal e espera de 25 s do servidor.

### A7. Os testes não provam o que vai para o aparelho (alto)

- **Onde:** configuração do Jest do app (ver B1) e `scripts/fumaca-web.ts`, que abre só `/app/entrar` e `/app/recuperar-senha` com uma API falsa que responde 401.
- **Efeito:** criação e edição de programação quebradas com `verificar` verde; a rastreabilidade marca EVT-01, EVT-03, EVT-04 e OFF-09 como "testado auto" e o binário não cumpre nenhum deles.
- **Correção proposta:** (1) Jest com o compilador (em andamento no working tree); (2) fumaça web autenticada: subir a prévia com a semente, entrar como admin e como membro e abrir todas as rotas estáticas mais uma de cada rota dinâmica, falhando em qualquer `pageerror` (o roteiro desta auditoria, apêndice B, faz isso em menos de 4 minutos); (3) a checagem do apêndice A.

### M1. Data válida mas fora do alcance derruba a linha do tempo do dia (médio)

- **Onde:** `apps/app/src/funcionalidades/agenda/TelaTimelineDoDia.tsx:53` aceita qualquer data real; `calendario.ts:43` soma um dia; `packages/dominio/src/recorrencia.ts:32` (`deUtc`) devolve `+010000-01` para 31/12/9999, e `instanteNoFuso` chama `Intl.DateTimeFormat.formatToParts` com `NaN`.
- **Reprodução:** `/app/agenda/9999-12-31`. Obtido: tela em branco, `RangeError: Invalid time value`. No celular, com B2 aberto, fecha o app (rota alcançável por link universal `https://.../app/agenda/...`).
- **Correção proposta:** `dataValidaOuNula` só aceita anos entre 1900 e 2100; `dataNoFuso` e `formatarQuando` devolvem texto vazio para instante inválido em vez de lançar.

### M2. Ações de menu sem trava contra toque duplo (médio)

- **Onde:** `apps/app/src/funcionalidades/eventos/BarraDoEvento.tsx:179` ("Salvar como modelo", `salvarModelo.mutate()`) e `:221` ("Preparar para uso offline"), sem `carregando` nem bloqueio.
- **Efeito:** dois toques criam dois modelos iguais.
- **Correção proposta:** `carregando` e `desabilitado` como nas outras ações da barra.

### M3. Listas sem virtualização e fotos em base64 na memória (médio)

- **Onde:** nenhum `FlatList`, `FlashList` ou `SectionList` no app; check-in, inscrições, membros, avisos e pedidos são `ScrollView` com `.map`. As fotos de membro chegam como `data:` URI em base64 montada em JavaScript (`servicos/api.ts`, `emBase64`) e ficam num mapa em memória (`ui/Avatar.tsx`).
- **Efeito provável:** com 150 inscritos com foto, o check-in fica lento em Android de entrada (não medido: sem aparelho).
- **Correção proposta:** `FlatList` no check-in e nas inscrições primeiro; medir com o perfilador do React Native num Android de entrada antes de ampliar.

### M4. Push no Android e entrar com Google no build de loja (médio)

- **Onde:** `apps/app/app.config.ts` sem `android.googleServicesFile` (PH-08 ainda aberta): `getDevicePushTokenAsync` falha e o app segue sem push remoto no Android. `eas.json`: o perfil `producao` não tem `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` nem `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, e nenhum perfil tem o ID do Android; o botão do Google some nesses builds.
- **Efeito:** testadores Android não recebem notificação de aviso, escala ou mudança de evento; quem usa Google na homologação não acha o botão no build de loja.
- **Correção proposta:** decidir com o dono se o teste começa sem push no Android e avisar os testadores; alinhar os IDs do Google entre os perfis ou registrar a decisão de não oferecer Google no lançamento.

### M5. Datas dependem do `Intl` do Hermes, testado só no Node (médio, risco)

- **Onde:** `packages/dominio/src/recorrencia.ts:106`, `deslocamentoDoFuso`, usa `formatToParts` com `timeZone` e `hourCycle: 'h23'`.
- **Risco:** se o `Intl` do Hermes no aparelho devolver hora `24` à meia-noite ou ignorar `hourCycle`, o deslocamento sai com um dia a mais e eventos de sábado à noite, perto da meia-noite, aparecem no dia errado. Os testes rodam no Node (V8 com ICU completo) e não pegam isso. O Brasil não tem horário de verão desde 2019, o que reduz o risco no fuso padrão.
- **Correção proposta:** teste no aparelho (ou no Hermes do Node, `hermes` CLI) de `dataNoFuso` para 23:59, 00:00 e 00:01 em `America/Sao_Paulo`, num sábado e na virada de mês (31/01 para 01/02).

### M6. Programação com data no passado é aceita sem aviso (médio)

- **Onde:** `apps/app/src/funcionalidades/eventos/formulario.ts:133`, `validarRascunho`.
- **Efeito:** quem escolhe o ano errado no calendário publica um evento passado (com push) sem perceber.
- **Correção proposta:** aviso não bloqueante "Esta data já passou" ao lado do campo.

### Baixos

| #   | Achado                                                                                                                                                               | Onde                                                        | Correção                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| L1  | `/plataforma/<id inexistente>` mostra só o título "Comunidade", sem estado vazio nem saída                                                                           | `funcionalidades/plataforma/TelaComunidadeDaPlataforma.tsx` | estado "Comunidade não encontrada" com voltar                                       |
| L2  | Membro que chega a `/avisos/novo` por link preenche tudo e só descobre a falta de permissão ao enviar                                                                | `funcionalidades/avisos/TelaNovoAviso.tsx:124`              | conferir `pode('aviso','publicar')` antes do formulário, como em "Nova programação" |
| L3  | O HTML da web não tem `Cache-Control`; o navegador pode guardar o `index.html` antigo depois de um deploy                                                            | Caddy da homologação                                        | `Cache-Control: no-cache` no HTML                                                   |
| L4  | Web: cerca de 2,2 MB de JavaScript inicial (cerca de 640 KB comprimido) e 2 MB de fontes, sendo 975 KB só a Material Symbols                                         | `.previa/web`                                               | subconjunto da fonte de ícones; aceitável para os testadores                        |
| L5  | O log de erro interno grava `erro.message` do banco, que pode trazer valor digitado (por exemplo, `invalid input syntax for type uuid: "..."`)                       | `apps/api/src/servidor.ts:129`                              | gravar só o código do erro do Postgres                                              |
| L6  | `CampoDeMomento` não impede `minimo` maior que `maximo`; no iOS, o SwiftUI monta `start...end` e o Swift aborta com faixa invertida. Hoje nenhuma tela passa os dois | `apps/app/src/ui/CampoDeMomento.tsx`                        | só repassar o intervalo quando `minimo <= maximo`                                   |

### Segurança visível ao usuário

- Mensagens: as telas usam `mensagemDoErro` e os 404 dizem "Não encontramos o que você procurou", sem detalhe técnico. A exceção é A3.
- Log no app: um único `console.warn` (falta de `EXPO_PUBLIC_API_URL`, só em desenvolvimento). Nenhum log de dado pessoal no app.
- Membro nas rotas de organização e de Criador: todas mostram texto humano de permissão (varredura da conta membro, 65 rotas).

## 4. As 10 correções antes dos testadores

| #   | Correção                                                                                                                                | Achado | Dono               | Estado em 15/11/2026                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------ | ----------------------------------------------------- |
| 1   | `useRefsDosCampos` sem hooks dentro do objeto, e criar e editar programação conferidos no build de release do iPhone e na web           | B1     | eventos (app)      | no working tree, não commitado                        |
| 2   | Limite de erro no layout raiz e por tela, provado com erro forçado no build de release                                                  | B2     | app (navegação)    | no working tree, não commitado                        |
| 3   | Domínio de produção no ar (PH-04) com as oito URLs em 200 antes do build de loja, ou decisão do dono de distribuir o app de homologação | B3     | dono e entrega     | pendente                                              |
| 4   | Mutações com `networkMode: 'always'`: sem rede, mensagem na hora e nada enviado depois                                                  | A1     | app (estado)       | pendente                                              |
| 5   | `voltarOu(destino)` em todo sucesso de formulário e trava por referência nos envios de criação                                          | A2, M2 | app                | pendente                                              |
| 6   | Mensagens do Zod em português e humanas na API; caso do convite incompleto                                                              | A3     | API                | pendente                                              |
| 7   | Limite de `renovar` por IP inteiro e mais alto; app trata 429 na abertura sem tela sem saída                                            | A4     | API e app (sessão) | pendente                                              |
| 8   | Confirmação de descarte nos formulários de criar e editar                                                                               | A5     | app (UX)           | pendente                                              |
| 9   | Tempo limite de 20 s nos pedidos da API, virando "Sem conexão"                                                                          | A6     | app (serviços)     | pendente                                              |
| 10  | Testes que provam o binário: Jest com o React Compiler, checagem de hook em bloco memorizado e fumaça web autenticada em todas as rotas | A7     | testes             | Jest com compilador no working tree; o resto pendente |

As correções 1, 2 e 3 bloqueiam. As de 4 a 10 podem entrar no mesmo lote; sem elas, os testadores vão relatar duplicatas, perda de formulário e "não abre" no encontro, e o relato vai esconder o resto.

## 5. Prontidão para as lojas

| Item                                             | Situação                                                                                                                                                                                          | Risco de recusa ou de teste parado                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Permissões iOS                                   | Câmera, Fotos e Face ID com texto específico (`app.config.ts`); microfone desligado                                                                                                               | baixo                                                                                                              |
| Permissões Android                               | `CAMERA`; os módulos somam `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `USE_BIOMETRIC`, `USE_FINGERPRINT`; armazenamento, microfone, alarme exato e `AD_ID` bloqueados; nenhum `READ_MEDIA_*` | baixo                                                                                                              |
| Versão e build                                   | `1.0.0`; número de build remoto no EAS, `autoIncrement` só no perfil `producao`; Android 1.0.0 (2) já gerado                                                                                      | baixo                                                                                                              |
| Privacidade, termos, exclusão, suporte           | 404 em produção                                                                                                                                                                                   | **alto**: Google já recusou a URL dos termos; revisor da Apple não abre a política (B3)                            |
| Conta de revisão                                 | Credenciais "[a definir]" no Google e nada salvo na Apple; telefone de contato pendente (`estado-das-lojas.md`, seção 4)                                                                          | alto para revisão e para TestFlight externo (Beta App Review pede conta de acesso); nenhum para TestFlight interno |
| Classificação Google (IARC)                      | Não respondida (exige o aceite do dono)                                                                                                                                                           | bloqueia a publicação no Google                                                                                    |
| App Privacy da Apple                             | Preenchido, falta "Publish"                                                                                                                                                                       | bloqueia o envio à revisão                                                                                         |
| Exclusão de conta no app, denúncia e bloqueio    | Existem (Perfil, Privacidade e dados; denúncia e bloqueio)                                                                                                                                        | baixo                                                                                                              |
| Entrar com a Apple                               | `usesAppleSignIn: true`; o botão do Google não aparece no perfil `producao`                                                                                                                       | baixo; conferir a capacidade no App ID                                                                             |
| Manifesto de privacidade do iOS (motivos de API) | Não conferido no binário                                                                                                                                                                          | médio: e-mail ITMS-91053 no primeiro envio; conferir o `PrivacyInfo.xcprivacy` gerado                              |
| Capturas                                         | Ainda sendo refeitas depois da D5                                                                                                                                                                 | não bloqueia o teste; bloqueia a ficha                                                                             |

## 6. Conferência da rastreabilidade

`docs/rastreabilidade.md` declara 160 requisitos, 125 em "testado auto". Não conferi os 160 um a um. Conferi os que esta auditoria tocou e **quatro estão marcados acima do que o binário entrega**: **EVT-01, EVT-03, EVT-04 e OFF-09** (criar, criar de modelo, publicar ao criar e editar com conflito: todos passam pela tela que fecha, B1). Eles precisam voltar para "implementado" até a correção 1 ser provada no build de release, e a evidência deles deve citar a fumaça autenticada (correção 10), não só o Jest.

## 7. Matriz de cobertura

**Testei:**

- 110 rotas como admin e 65 como membro na web exportada da prévia, com erro de página, erro de console e 5xx coletados.
- 43 rotas com parâmetro sujo: id inexistente, UUID zerado, datas 31/02, 9999-12-31, 0001-01-01, texto no lugar de data, tipo de conteúdo inválido, fragmento de convite inválido.
- Publicar sem rede, clique duplo, voltar com formulário preenchido, sessão sem cookie (vai para Entrar, correto), título com apóstrofo, acento e emoji e texto de 4.900 caracteres (aceitos).
- Compilação de todo o app com o React Compiler, iOS e web.
- Paridade de exportações entre os arquivos `.web.ts(x)` e os nativos (só diferenças de tipo; nenhuma falta que quebre a web).
- Uso de `window`, `document` e `navigator` fora dos arquivos `.web` (todos protegidos).
- URLs públicas de produção e homologação.

**Não testei, e por quê:**

- **Aparelho real (iPhone e Android):** sem aparelho nesta sessão. Ficam sem prova: câmera e leitor de QR, Face ID, seletor de data nativo, folhas `formSheet`, vidro, `Intl` do Hermes (M5), desempenho em Android de entrada (M3), VoiceOver e TalkBack.
- **Push real (APNs e FCM):** sem `google-services.json` e sem envio real nesta sessão.
- **Entrar com Apple e com Google:** exigem conta real e cliente configurado.
- **Isolamento entre comunidades pela interface:** a API tem a suíte gerada do inventário de rotas, que rodou verde no `verificar`; não repeti pela tela.
- **Offline completo (preparar evento, check-in sem rede, sincronizar, conflito):** depende do SQLite cifrado do celular; a web não tem o depósito offline.
- **Ao vivo com duas pessoas conduzindo ao mesmo tempo:** só pela leitura do código (409 com estado atual e toast); sem rodada com dois navegadores.
- **Homologação com login:** não entrei na homologação; a prova de que o defeito B1 está publicado lá é o mesmo nome de arquivo do pacote (`entry-be9391c8cc88d2e2b9e9405a8d9db412.js`) servido pela prévia e pela homologação.
- **Fuso diferente do aparelho, virada de mês e sábado à noite na interface:** só pela leitura do código e dos testes de domínio; nenhum evento de teste criado às 23:30.

## 8. Auditoria de contrato por agente

| Agente                        | Item                                                                   | Resultado                                                                |
| ----------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| testes                        | testes do app exercitam o código que vai para o aparelho               | ❌ Jest sem React Compiler (A7); em correção                             |
| testes                        | fumaça cobre as telas principais                                       | ❌ só 2 telas públicas                                                   |
| testes                        | fronteira de datas                                                     | ❌ 9999-12-31 derruba a tela (M1)                                        |
| ux                            | estados vazio, carregando, erro e sucesso                              | ✅ nas rotas varridas, com exceção de L1                                 |
| ux                            | formulário preserva o que foi digitado                                 | ❌ voltar e fechar perdem tudo (A5)                                      |
| ux                            | mensagem de erro diz como resolver                                     | ❌ convite incompleto em inglês técnico (A3); sem rede não diz nada (A1) |
| engenharia-entrega            | build de loja aponta para ambiente que responde                        | ❌ produção 404 (B3)                                                     |
| seguranca-aplicacao           | limitação de tentativas sem negar serviço a quem é legítimo            | ❌ faixa /24 e app sem saída em 429 (A4)                                 |
| documentacao-tecnica e status | "API e telas de todos os módulos feitas e testadas" (`docs/STATUS.md`) | ❌ criar e editar programação não abrem no binário                       |
| especificacao                 | rastreabilidade só sobe com evidência verificável                      | ❌ EVT-01, EVT-03, EVT-04 e OFF-09 (seção 6)                             |
| publicacao-lojas              | exclusão de conta no app, denúncia e bloqueio                          | ✅                                                                       |
| publicacao-lojas              | política e termos publicados                                           | ❌ 404 em produção                                                       |
| privacidade-lgpd              | log sem dado pessoal no app                                            | ✅; ressalva L5 na API                                                   |

## 9. Riscos residuais

- Nada do que depende do aparelho foi provado nesta auditoria (seção 7). O primeiro build de teste precisa de uma rodada no iPhone e num Android de entrada, roteirizada: entrar, aceitar convite, criar programação a partir da Agenda, editar, ao vivo, check-in por QR e por nome, ficar sem rede, voltar, trocar foto.
- O teste em grupo (A4) só se prova com várias pessoas na mesma rede; vale fazer um ensaio com o dono e dois ou três aparelhos no mesmo Wi-Fi antes de convidar o grupo inteiro.
- As correções do outro agente estavam no working tree, não commitadas, durante esta auditoria. Este relatório vale para o commit `09d5f3b`; reavaliar depois do commit delas.

## Apêndice A. Checagem de hook em bloco memorizado

Para cada arquivo de `apps/app/src` (exceto `__tests__`), compilar com `babel-preset-expo` e o chamador `{ name: 'metro', bundler: 'metro', platform: 'ios' | 'web', supportsReactCompiler: true, isDev: false }`; no código gerado, para cada bloco aberto por `if($[n]===` ou `if($[n]!==`, tirar as funções internas e procurar chamada `use[A-Z]...(`. Qualquer ocorrência é erro. Em 15/11/2026: 370 arquivos, 1 ocorrência (`CamposDoEvento.tsx`, os quatro `useRef`).

## Apêndice B. Varredura Playwright usada

Com a prévia no ar: entrar pela tela Entrar (senha lida de `.previa/contas.txt`, nunca impressa), visitar cada rota com `page.goto`, esperar a rede parar, registrar `pageerror`, `console.error` e respostas 5xx e marcar tela com menos de 25 caracteres como "em branco". Os IDs das rotas dinâmicas vêm das respostas JSON da própria navegação. Atenção: cada `page.goto` recarrega o app e chama `/api/auth/renovar`; acima de 120 recargas em 15 minutos a prévia responde 429 (foi assim que A4 apareceu). Na fumaça do `verificar`, navegar dentro do app em vez de recarregar, ou subir a API da fumaça com o fator de limite dos testes.
