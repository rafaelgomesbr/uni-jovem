# Fundação visual da direção A "Aurora Viva": guia para as telas

Data: 22/11/2026. Decisões: D65 (direção A escolhida) e D67 (esta fundação). Base visual: [prototipo.html](prototipo.html) (a verdade visual) e [especificacao.md](especificacao.md). Estrutura, textos e padrões de interação: [../../app-v3-ux.md](../../app-v3-ux.md).

Este documento é para quem vai refazer as telas (Início, Agenda, Encontro, Comunidade, Perfil, Check-in, Ao vivo, Meu repertório) em cima da fundação. Tudo que está aqui já existe em `apps/app/src/ui` e `packages/tokens`, com teste. **Use o que existe; não reinvente.** Para ver tudo funcionando: rota de desenvolvimento `/_catalogo` (seção "Fundação" no topo) e as capturas `scripts/apresentacao/telas/fundacao-*.jpg`.

## 1. Regras ("faça assim")

1. **Cor, medida, raio e movimento vêm de `@uj/tokens`.** Nunca escreva hexadecimal, número mágico de raio nem duração. Cor sai de `useTema().cores` (ou da prop `cor` do `Texto`).
2. **Um destaque por tela:** o `CartaoDoMomento` é o único bloco com moldura de luz. O botão primário (coral) é o único sólido quente por cartão.
3. **O sol e o fundo falam juntos.** Passe o mesmo `momento` ao `CartaoDoMomento` e à `Tela`: a pose do sol e a luz de base mudam juntas.
4. **Par de botões: secundário à esquerda, primário à direita** (`ParDeBotoes`; empilhado com fonte grande, o primário sobe sozinho). Ignore os wireframes do UX que mostram o primário à esquerda.
5. **Desfazer em vez de "tem certeza?"**: ato reversível mostra `mostrarDesfazer`; o que avisa outras pessoas só é enviado dentro do `aoConfirmar`, depois dos 10 s.
6. **Gesto nunca é o único caminho.** `DeslizarParaResponder` já traz os botões; qualquer gesto novo precisa de botão e de ação de acessibilidade.
7. **Todo estado assíncrono tem três telas:** carregando (`Esqueleto` com a forma final), erro (bloco com texto humano e "Tentar de novo") e vazio (com ação e, em tela inteira, o `Sol`).
8. **Cor nunca é o único sinal:** situação sempre com `Chip` (texto, mais ícone); desabilitado sempre com o motivo escrito.
9. **Vidro com desfoque só no que flutua** (barra de abas, cabeçalho rolado, folha, barra de ação). Cartão de conteúdo é tinta, sem desfoque.
10. **Reduzir movimento e Reduzir transparência já estão tratados dentro dos componentes.** Não faça `if (reduzirMovimento)` na tela: use as primitivas. Se precisar de animação nova, crie primitiva em `ui/primitivasDeMovimento.tsx`.
11. **Fonte do sistema:** `Texto` respeita o tamanho do sistema com teto por papel. Alvos de toque: 44 (48 no Android), 56 nos botões grandes, 72 nas linhas do check-in.
12. **Regra de layout do contraste (o teste não prova):** nenhum texto pequeno fora de cartão em x acima de 230 e y abaixo de 200 (quadro de 390, sob o pico coral) nem nos últimos 96 pt da tela (luz de base). Ali, só ícone, botão ou cartão. Dentro do cartão do momento, só chips `sucesso`, `alerta`, `quente` e `neutro` (erro e info não passam 4,5:1 sobre o degradê: use o bloco de erro no lugar do cartão).

## 2. Tokens novos (`packages/tokens`)

| Onde                  | O que                                                                                                                                                                                                                 | Valor ou uso                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `cores.ts` `Paleta`   | `fundoProfundo`, `realceDoCartao`, `momentoTopo`, `momentoBase`, `momentoBorda1/2/3`, `aceitarFundo`, `recusarFundo`, `toastFundo`, `vidroCabecalho`, `brilhoHorizonte`, `brilhoPoente`, `palco`, `abaAtivaBrilho`    | Escuro e claro, valores da especificação (seções 2.1 e 2.2)                                                                               |
| `cores.ts` mudaram    | `superficie` `#1F1B44`, `superficieTranslucida` `rgba(38,33,82,0.64)` (claro: branco a 80%), `superficieElevada` `#262250`, `botaoTonalOpaco`, `botaoTonalPressionado`, `separador`, `veu`, `esqueleto`, `tonalOpaco` | O cartão translúcido sobre o fundo escuro continua igual à superfície opaca (o fallback não muda a cor)                                   |
| `cores.ts`            | `VIDRO.barra` (24), `VIDRO.cabecalho` (20), `VIDRO.folha` (30); `TOAST`                                                                                                                                               | Cada vidro tem `fundo`, `borda` e `opaco`; o toast é sempre escuro com texto `#F5F3FF` e "Desfazer" `#FFB199`                             |
| `index.ts`            | `TIPO.corpo` 16/24 (era 15/22), `TIPO.tituloMomento` 26/30, `TIPO.contador` 40/40                                                                                                                                     | O `numero` (28) continua para relatórios                                                                                                  |
| `index.ts`            | `RAIO.medio` (20), `RAIO.miolo` (26,5), `RAIO.barraFlutuante` (34); `BARRA_DE_ABAS.altura` 68 e `preenchimento` 6; `ALTURA.linhaAlta` 72; `ELEVACAO.*.momento`; `TAMANHO_DO_AVATAR.checkin` 44                        | `ELEVACAO.claro.cartao` ganhou a sombra do protótipo                                                                                      |
| `movimento.ts` (novo) | `CURVAS` (inclui `nasce` e `pilula`), `MOLAS`, `MOVIMENTO_DAS_TELAS`, `POSES_DO_SOL`, `POSE_DO_MOMENTO`, `SOL_POENTE`, `LUZ_POR_MOMENTO`, `LUZ_DE_BASE`, `DESFAZER`, `DESLIZAR`                                       | Toda duração e curva da especificação (seção 9)                                                                                           |
| `pares.ts`            | 50 pares "D65" por tema                                                                                                                                                                                               | Pior ponto do brilho, cartão do momento, toast, deslizar, progresso, palco, luz de base. Teste em `packages/tokens/test/fundacao.test.ts` |

O pico do brilho de horizonte (`rgba(255,160,110,0.40)`) dá 4,55:1 ao `textoSuave` nu, a margem curta já prevista. **Se algum dia o teste cair, baixe `brilhoHorizonte` para 0,34** (instrução do dono, D67).

## 3. Componentes

Todos em `apps/app/src/ui`, importados por `@/ui/Nome`.

### 3.1 `Tela` (já existia): agora com a Aurora viva

```tsx
<Tela titulo="Início" topo={<PilulaDaComunidade />} momento={momento}>
  ...
</Tela>
```

- `momento?: MomentoDoDia` (`'longe' | 'vespera' | 'dia' | 'agora' | 'fim'`, padrão `'longe'`): a luz de base (`LuzDeBase`) e o coral do canto acompanham o relógio (900 ms). Calcule o momento a partir de `GET /inicio` (`momento.estado`).
- Toda `Tela` com Aurora **deriva** (coral 14 s, violeta 18 s, seis meias-voltas e para): decisão do dono (R1, D67). Sem deriva com Reduzir movimento; sem brilho nenhum (fundo opaco) com Reduzir transparência e com Aumentar contraste. `aurora={0}` (Ao vivo) tira tudo.
- O fundo desce de `fundo` a `fundoProfundo` a partir da metade da tela. O cabeçalho compacto usa o vidro `cabecalho`.

### 3.2 `Sol`: as cinco poses

```tsx
<Sol pose="pleno" lado={96} />
<Sol de="escondido" pose="pleno" lado={30} halo={false} />   {/* o "sobe o sol" do encanto 4 */}
<Sol pose="escondido" lado={104} />                           {/* estado vazio */}
```

| Prop          | Tipo                                                             | Notas                                                                                                                |
| ------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `pose`        | `'escondido' \| 'nascendo' \| 'pleno' \| 'radiante' \| 'poente'` | Antes do amanhecer, nascendo, pleno, radiante, poente. Mudou a prop, o sol anima 600 ms (raios de 40 em 40 ms)       |
| `lado`        | `number`                                                         | 96 no cartão do momento, 104 a 88 nos vazios, 72 no esqueleto, 32 e 30 em "Obrigado" e "Tudo em dia", 120 no Ao vivo |
| `de`          | `PoseDoSol`                                                      | Pose de partida na primeira vez (encantos)                                                                           |
| `halo`        | `boolean` (padrão `true`)                                        | O sol mini dispensa                                                                                                  |
| `alternativa` | `string`                                                         | Decorativo e escondido do leitor de tela, a menos que seja a única informação                                        |

Pose por momento: `POSE_DO_MOMENTO[momento]`. Com Reduzir movimento só a opacidade anima (120 ms) e a pose final já aparece no lugar. Cores por tema vêm de `MARCA_DO_SOL` e `SOL_POENTE`.

### 3.3 `Cartao` e `CartaoDoMomento`

```tsx
<Cartao sobrancelha="Seu resumo" titulo="Tudo em dia">...</Cartao>      {/* tinta (padrão) */}
<Cartao variante="plano">...</Cartao>                                   {/* opaco, sem sombra */}
<Cartao lista><Lista>...</Lista></Cartao>                               {/* linhas sem padding */}

<CartaoDoMomento
  momento={momento}
  etiqueta="Próximo encontro"
  titulo="Sábado Jovem"
  meta="Sáb., 28 de nov. · 16:00 · Salão da igreja"
  acoes={<ParDeBotoes><Botao titulo="Não posso ir" variante="secundario" ... /><Botao titulo="Aceitar" ... /></ParDeBotoes>}
>
  <Texto variante="rotulo">Sua parte: Louvor · Vocal</Texto>
  <Chip situacao="aguardando" texto="Aguardando sua resposta" />
</CartaoDoMomento>
```

- `Cartao variante="tinta"` é o `CartaoDeVidro` (as mesmas props: `sobrancelha`, `titulo`, `extra`, `acoes`, `aoPressionar`, `lista`, `opaco`). Tinta violeta translúcida sem desfoque e fio de luz no topo; no claro, branco a 80% com sombra. Reduzir transparência e Aumentar contraste: opaco, com borda de 2 no contraste.
- `CartaoDoMomento`: moldura de 1,5 (coral, violeta, índigo), miolo em degradê, brilho no canto, sol de 96, sombra `momento`. Props: `momento` ou `pose` (a `pose` vence), `etiqueta`, `aoVivo` (ponto que pulsa), `chip`, `titulo`, `meta`, `children`, `acoes`, `semSol` (vazio ou erro), `aoPressionar` (o corpo abre o detalhe; as `acoes` ficam fora da área tocável). Um por tela.
- `CartaoDeDestaque` (claro no tema escuro) continua só por compatibilidade e **sai** quando as telas migrarem.

### 3.4 `LinhaDeLista` e `Lista`

```tsx
<Cartao lista>
  <Lista>
    <LinhaDeLista icone="agenda" titulo="Agenda" descricao="Próximos encontros" aoPressionar={abrir} />
    <LinhaDeLista variante="checkin" avatar={{ nome }} titulo={nome} descricao="Convocada"
      marcada={chegou} semSeta extra={chegou ? <Chip situacao="aceitou" texto="Presente" aparecer="presente" /> : <Chip texto="Chegou" tom="neutro" />}
      aoPressionar={alternar} />
    <LinhaDeLista titulo="Pedro Lima" descricao="Já convocado" desabilitada aoPressionar={...} />
  </Lista>
</Cartao>
```

Props novas: `variante` (`'normal'` 56 pt, `'checkin'` 72 pt com avatar de 44), `desabilitada` (sem toque, título em `textoSuave`; **escreva o motivo em `descricao`**), `marcada` (vira caixa de marcar para o leitor de tela e acende a camada tonal). O ladrilho do ícone é `quenteFundo` com o ícone em `destaque`. A ação à direita é `extra` (chip, botão compacto) ou `valor`. A linha inteira é o alvo.

### 3.5 `Chip`

```tsx
<Chip situacao="aceitou" />                       {/* Confirmado, verde, check */}
<Chip situacao="aguardando" texto="Aguardando sua resposta" />   {/* âmbar, relógio */}
<Chip situacao="naoPode" />   {/* vermelho, x */}   <Chip situacao="aoVivo" />   {/* ponto que pulsa */}
<Chip situacao="novo" texto="3 novos" />   <Chip situacao="rascunho" />
<Chip situacao="aceitou" aparecer="confirmado" />  {/* escala 0,6 a 1 em mola; "presente": 0,9 a 1 em 160 ms */}
```

`SITUACOES_DO_CHIP` é a tabela única de tom, palavra e ícone. `texto`, `tom` e `icone` sobrescrevem. Nunca é tocável.

### 3.6 `Esqueleto`

`Esqueleto` (já existia: espera 300 ms, dissolve 160, pulso de 1 a 0,5 em 1200 ms, "Está demorando mais que o normal" mais "Tentar de novo" aos 10 s) ganhou formas prontas: `EsqueletoDoMomento` (262 pt), `LinhaDeEsqueleto altura={56|64|72|88}`, além de `BlocoDeEsqueleto`, `LinhasDeEsqueleto` e `CartaoDeEsqueleto`. Use a mesma altura do conteúdo final para a tela não pular.

### 3.7 `mostrarDesfazer` (toast com Desfazer)

```tsx
mostrarDesfazer({
  texto: 'Publicando e avisando 11 pessoas.',
  aoConfirmar: () => publicar.mutate(), // só roda aos 10 s, ao vir outro toast ou ao ir para segundo plano
  aoDesfazer: () => restaurarRascunho(), // o estado volta; aoConfirmar nunca roda
  segundos: 10, // opcional (padrão 10)
  rotuloDoBotao: 'Desfazer', // ou 'Tentar de novo' numa falha de ação
})
```

O ato já aparece feito na tela; o envio sai só ao fim. Um segundo `mostrarDesfazer` **confirma** o primeiro (nunca se perde envio). Se o app for encerrado à força, nada foi enviado (o erro seguro). `confirmarAgora()` envia já (a pessoa saiu da tela); `desfazerAgora()` desfaz. A contagem é em número ("10 s") e em barra de 3 pt (some com Reduzir movimento, o número fica); o leitor de tela ouve "Desfazer disponível por 10 segundos" uma vez e o foco não é roubado. O `HospedeiroDeToast` da raiz já desenha. O `mostrarToast` antigo (informação, 4 s) continua e também passou a ser escuro nos dois temas.

### 3.8 `DeslizarParaResponder`

```tsx
<DeslizarParaResponder
  titulo="Louvor, sábado 28"
  descricao="Sáb., 28 de nov. · 16:00"
  extra={<Chip situacao="aguardando" texto="Aguardando sua resposta" />}
  aoAceitar={() => aceitar(id)}
  aoRecusar={() => recusar(id)}
  desabilitado={semInternet}
  motivo="Precisa de internet para responder."
/>
```

Direita além de 40% da largura: aceita (depois de 120 ms). Esquerda: abre o "Não posso ir" (só envia se tocar). Os botões "Aceitar" e "Não posso ir" estão sempre visíveis; o título expõe as ações de acessibilidade "Aceitar" e "Não posso ir". Só uma resposta vale por linha. Depois de `aoAceitar`, chame `mostrarDesfazer` e encolha a linha (`MOVIMENTO_DAS_TELAS.linhaEncolhe`). Usa `react-native-gesture-handler` 3 e Reanimated (já instalados) e traz o próprio `GestureHandlerRootView`. Use só onde há lista de convocações.

### 3.8.1 Folha

`FolhaNaTela` (e `MenuDeAcoes`) agora: vidro de 30 com fallback opaco (Reduzir transparência, Aumentar contraste, Android), topo de 28, `AlcaDaFolha` (40 por 5) e máximo de 90%. "Fechar" de 44 e o véu fecham sempre. A `Folha` de rota (formSheet) segue nativa.

### 3.9 Barra de abas flutuante

Visual já aplicado em `funcionalidades/navegacao/BarraDeAbas.tsx` e `BarraDaPilha.tsx`: cápsula de 68, vidro de 24, itens de largura igual, **pílula luminosa única que desliza** por `translateX` (260 ms) até a aba marcada (`PilulaDaAba`, guiada por `abaAtiva.ts`), ícone ativo sobe 1 pt e cresce 6%. Com Reduzir movimento a pílula troca sem deslizar. A estrutura de abas (hoje cinco, o UX pede quatro) fica para a onda das telas: `ABAS` em `navegacao/abas.ts`. Ícone do Início para o UX: `abaInicio` hoje; use `sol` (traço novo) quando a aba trocar.

### 3.10 Primitivas de movimento (`ui/primitivasDeMovimento.tsx`)

| Primitiva                                                     | Para quê                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `useEntradaEmCascata(ordem)` / `<EntradaEmCascata ordem={n}>` | Blocos da tela entram: sobe 12 e aparece em 200 ms, passo de 30, no máximo 350 ms. Até 5 blocos; um componente por bloco |
| `usePressionar()`                                             | Escala 0,98 em 90 ms e mola ao soltar, mais a camada de toque (a mesma do botão)                                         |
| `useRevelar(visivel)`                                         | Faixa ou aviso que aparece depois de um toque: sobe 8 e dissolve em 200 ms (160 ao sair)                                 |
| `<TransicaoDeAba ativa={useIsFocused()}>`                     | A tela da aba dissolve em 160 ms (120 ao sair); nada desliza                                                             |

Todas: com Reduzir movimento, dissolve de 120 ms, sem passo e sem deslocamento.

### 3.11 Ícones

`Icone` e `IconeDeTraco` ganharam o conjunto do protótipo em traço (SVG, grade de 24, traço 2): `sol`, `agenda`, `pessoas`, `perfil`, `sino`, `voltar`, `avancar`, `confirmadoCirculo`, `fechar`, `maisAcoes`, `relogio`, `local`, `avisoAlerta`, `musica`, `compartilhar`, `qr`, `buscar`, `semConexao`, `cadeado`, `pausar`, `iniciar`, `etapaAnterior`, `aviso`, `versiculo`, `sugestao`, `seguranca`, `ajuda`, `sair`, `coracao`, `convidar`, `ajustes`, `fixar`. Iguais em iOS, Android e web.

### 3.12 Fundo

`FundoAurora` ganhou `momento`; `LuzDeBase` é a luz de base (duas elipses que saem por baixo da tela). A `Tela` já monta os dois: telas novas não os montam à mão.

## 4. Como migrar uma tela (ordem sugerida)

1. Troque `CartaoDeDestaque` por `CartaoDoMomento` e passe `momento` à `Tela`.
2. Troque `Chip texto="..." tom="..."` de situação por `Chip situacao`.
3. Linhas de check-in e convocados: `LinhaDeLista variante="checkin"` e `marcada`.
4. Respostas de convocação: `DeslizarParaResponder` onde há lista; `mostrarDesfazer` no aceite.
5. Carregando: `Esqueleto` com a forma final. Vazio: `Sol pose="escondido"` e uma ação.
6. Envolva os blocos em `EntradaEmCascata` (até 5).
7. Rode `npm run verificar` e confira o contraste de qualquer cor nova em `pares.ts`.

## 5. O que não foi verificado

- **Aparelho:** iOS e Android (degradê, `radial-gradient` em elipse, `boxShadow`, `backgroundImage` com `overflow`), VoiceOver e TalkBack (ações do deslizar, anúncio do toast, caixa de marcar do check-in), Aumentar contraste e Reduzir transparência no sistema, fonte a 200%, Liquid Glass e `BlurView` da barra e da folha, e o desempenho da deriva e da luz de base em aparelho médio (sem medida no Profiler).
- **Gesto de verdade:** o teste dispara o gesto pelo dublê do gesture handler (`createGestureController`); o toque do dedo, o atrito com a rolagem e a vibração não foram vistos.
- **Web:** as capturas foram tiradas no servidor de desenvolvimento do Expo com o catálogo, no Chromium; Safari e Firefox não.
- **Háptico:** `expo-haptics` não está instalado (Q5 do UX): o aceite, o "Chegou" e o limite do deslizar não vibram.
- **Os cinco encantos do sol** (halo do primeiro Aceitar, arco do primeiro check-in, publicar, "Tudo em dia", banda completa) e o "uma vez por conta" ficam para as telas: a fundação só traz o `Sol` com `de`, o `Chip aparece` e as primitivas.
