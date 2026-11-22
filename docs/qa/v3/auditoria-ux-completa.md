# Auditoria completa de UX e navegação (app v3, Direção A)

Data: 22/11/2026. Branch `release`, sobre o commit `63435ff`. Leitor: o dono. Pedido: "uma AUDITORIA COMPLETA DE UX E NAVEGAÇÃO no app. Eu preciso que seja FÁCIL DE MEXER", "focar sempre na facilidade", "não admito alinhamento e espaçamento errados ou que causam estranheza".

## Como foi feita (e o que é inferência)

- **Li o código** de todas as rotas de `apps/app/src/app/**` (layouts, abas e pilha), de `funcionalidades/navegacao` (`rotasDaBarra.ts`, `BarraDaPilha.tsx`, `mais.ts`, `TelaDoApp.tsx`), dos componentes de `ui` que montam o esqueleto (`Tela`, `BarraDeAcao`, `FolhaNaTela`, `CabecalhoDeTela`, `Botao`, `Cartao`, `LinhaDeLista`) e das telas de Início, Agenda, Encontro (Resumo, Roteiro, Quem vai, Etapa, Convocar), Igual ao último, Novo encontro, Repertório, Louvor, Comunidade e Perfil. Das demais pastas (avisos, oração, sugestões, relatórios, entrada, plataforma, inscrições, ao vivo) li os textos e os destinos de navegação por busca, não linha a linha.
- **Li os documentos** `docs/design/app-v3-ux.md`, `docs/design/v3/facil-de-usar.md`, `docs/qa/v3/teste-ingenuo-1.md`, `docs/qa/v3/README.md` e o `docs/STATUS.md`. O `docs/produto/avaliacao-de-usos.md` não foi lido a fundo (sem impacto nos achados).
- **Vi as imagens** do dono 9 a 17 (builds 10 e 11, iPhone; ficam em `C:\Users\Rfasg\AppData\Local\Temp\claude\774b84b711c50422\462a495d-7242-459d-a450-f0a718313a74\images\`, pasta temporária) e as capturas `21`, `31-p2`, `33`, `41` e `81` de `docs/qa/v3/` (390 escuro, build 6). As capturas são **anteriores** às D74 a D77: onde a captura e o código divergem, vale o código, e eu digo qual.
- **Não rodei o app** (a prévia na porta 8090 é de outro agente), não usei VoiceOver, TalkBack nem fonte a 200%, e **não medi contraste**. Toques são contados pelo código: são estimativas. Tudo que depende de aparelho está marcado como **inferência**.
- Este documento não muda código. Os números de linha valem para a árvore de 22/11/2026 e podem andar com as frentes em edição.

---

## 1. Mapa real de navegação

### 1.1 Contagem

| O quê                                 | Quantas     | Observação                                                                                                                                          |
| ------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arquivos de rota de tela              | 93          | 13 antes de entrar, 4 abas, 76 na pilha autenticada (mais 4 de layout)                                                                              |
| Telas que só redirecionam             | 5           | `/escalas`, `/programacoes`, `/agenda/[data]`, `/evento/[id]/duplicar`, `/entrar-com-convite`                                                       |
| Tela duplicada                        | 1           | `/conta` é o Perfil empilhado (`app/(autenticado)/conta.tsx:4`), chamado só por `onboarding/MissoesDeConfiguracao.tsx` e `perfil/TelaAtivar2fa.tsx` |
| Só de desenvolvimento                 | 1           | `_catalogo`                                                                                                                                         |
| Telas reais                           | cerca de 85 | O líder usa umas 15 por semana; o membro, umas 6                                                                                                    |
| Folhas dentro da tela (`FolhaNaTela`) | mais de 20  | Novo encontro, Convocar, Tirar, Adicionar músicas, Tom do dia, Calendário, menus "Mais"...                                                          |
| Folhas nativas (`formSheet`)          | 3           | Comunidades, Como conseguir um convite, Tenho um convite (a da folha em branco, imagem 12)                                                          |

### 1.2 Árvore (como se chega a cada tela)

```
ANTES DE ENTRAR (sem barra)
  Entrar -> Segundo fator · Recuperar senha ->(e-mail)-> Redefinir senha · Criar conta -> Completar cadastro
  Colar convite · Convite (link) · entrar/[codigo] (link do código) · Primeiro acesso · Oferta de biometria

SEM COMUNIDADE
  Início vira "Comece por aqui"
    Tenho um código -> Boas-vindas · Procurar -> Comunidade encontrada -> Denunciar
    Criar comunidade (modal) -> Código da comunidade · Como conseguir convite (folha nativa)

ABAS (barra do Tabs)
  Início
    pílula -> Comunidades (folha nativa) -> Comece por aqui | Criar | Plataforma nova
    sino -> Notificações -> destino de cada notificação
    versículo -> Versículo do dia -> Sobre a tradução
    cartão do momento -> Encontro | aba Quem vai | Igual ao último (modal) | Repertório
                      | Meu repertório -> Cifra -> Modo palco | Marcar quem chegou -> Ler QR (modal)
                      | Ao vivo | Editar (modal)
    Para responder (responde na linha) · Seu resumo (acordeão) · Aviso fixado -> Aviso
    Primeiros passos (cartão) -> Missão -> /conta (Perfil de novo, empilhado)
  Agenda
    Novo encontro (folha, 4 opções) -> Igual ao último (modal) | Novo encontro (modal)
    Calendário (folha) -> filtra o dia na lista · "Dias em que posso ajudar"
    Pedem ajuda -> Assumir
    linha -> Encontro · pressionar e segurar -> menu (Ver, Compartilhar, Copiar, Cancelar ou adiar)
  Comunidade
    Novo aviso | Convidar   (membro: Pedir oração | Sugerir uma ideia)
    Aviso em destaque -> Aviso · "Ver todos os avisos" -> Avisos -> Aviso | Novo aviso
    Pedidos de oração -> Pedido | Pedir oração · Pessoas -> Pessoa | Convidar
    Mais: Biblioteca -> Conteúdo | Novo conteúdo
          Louvor -> "Repertório do próximo encontro" -> Meu repertório ->(redireciona)-> Repertório
                 -> Biblioteca de músicas · Músicos · "Encontros" -> (volta para a aba Agenda)
          Sugestões -> Sugestão | Nova
    Organização (acordeão): Pedidos de entrada e convites -> Convidar · Relatórios -> Exportar
          · Locais -> Local · Limpar próximos encontros · Modelos · Denúncias
          · Configurações -> Código da comunidade | Excluir comunidade · Código da comunidade
  Perfil
    cartão -> Editar perfil -> Escolher avatar
    Ajustes de notificação · Segurança -> Ativar código extra | Aparelhos
    Privacidade -> Excluir conta | Bloqueados · Comunidades (folha nativa) · Ajuda -> Missão | Tradução
    Plataforma (Criador) -> Comunidade | Nova | Transferência
    Mais opções (acordeão): Versículo, Bloqueados, Uso sem internet, Denunciar comunidade · Sair

ENCONTRO (pilha)
  Membro: página única (Sua parte -> Substituição (modal), Quando e onde, Roteiro, Quem serve, Repertório)
  Organização: Resumo | Roteiro | Quem vai  + barra de ação
    Roteiro -> Etapa (outra tela) -> Convocar (folha) · Remover (ícone "Mais", sem texto)
    Quem vai -> Convocar (folha) · Tirar (folha)
    Resumo -> Inscrições · Marcar quem chegou · Repertório -> Adicionar músicas (folha) -> Cifra da Biblioteca
           · Outras coisas: Editar (modal), Copiar (Igual ao último, modal), Compartilhar,
             Salvar como modelo, Repetição -> Série, Conduzir ao vivo, Baixar, Cancelar ou adiar (modal),
             Encerrar, Excluir rascunho
```

### 1.3 Profundidade

- **Mais fundo para o membro:** Comunidade, Louvor, "Repertório do próximo encontro" (que abre Meu repertório e redireciona), Repertório, cifra da Biblioteca: **5 telas** para ler uma cifra. Pelo Início são 2 (link "Ver o repertório" e a música).
- **Mais fundo para o líder no uso semanal:** Início, Encontro, aba Roteiro, Etapa, folha Convocar: **4 níveis** para chamar alguém para uma etapa.
- **Uso mensal:** Comunidade, Organização (acordeão), Configurações, Excluir comunidade: 4.

### 1.4 Telas alcançáveis por 2 ou mais caminhos (que geram dúvida, não atalho)

| Destino                | Caminhos                                                                                            | Problema                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Repertório do encontro | Início (link), Resumo (cartão), Roteiro (o mesmo cartão), Louvor, Meu repertório (redireciona)      | 6 rótulos diferentes para a mesma coisa (achado 46)                                     |
| Convidar               | ação rápida da Comunidade, Pessoas, Pedidos de entrada e convites, Código da comunidade             | três telas para "trazer alguém" (achado 48)                                             |
| Biblioteca de músicas  | Comunidade > Mais > Biblioteca, Louvor > Biblioteca de músicas, Louvor > Músicos                    | duplicada                                                                               |
| Lembrar quem falta     | Início, cartão de Quem vai, barra do Encontro                                                       | números diferentes (achado 16)                                                          |
| Marcar o próximo       | Início, barra do Encontro, Agenda > Novo encontro, Outras coisas > Copiar, segurar a linha > Copiar | cinco portas, três nomes ("próximo encontro", "próximo sábado", "Copiar este encontro") |
| Comunidades (trocar)   | pílula do cabeçalho, Perfil > Comunidades                                                           | aceitável (atalho e lugar fixo)                                                         |
| Bloqueados             | Perfil > Mais opções, Privacidade                                                                   | duplicado                                                                               |

### 1.5 Telas órfãs, escondidas ou só por gesto

- **Órfãs ou quase:** `/conta` (Perfil empilhado, só por Missões), `/modelos` (só em Organização; "A partir de um modelo" no Novo encontro não leva a ela), `primeiro-acesso` (só por redirecionamento de entrada).
- **Só atrás de "Mais" ou de ícone sem texto:** Remover etapa (`eventos/TelaEtapa.tsx:177-183`), editar e arquivar Local (`eventos/TelaLocais.tsx:266`), ações da Série (`eventos/TelaSerie.tsx:151`), ações da comunidade na Plataforma (`plataforma/TelaComunidadeDaPlataforma.tsx:154`), Tom do dia e Tirar música (`repertorio/TelaRepertorioDoEncontro.tsx:463-469`), Marcar pedido de oração como respondido (`oracao/CartaoDoPedido.tsx:125`).
- **Só por gesto:** nenhuma função essencial (o menu de pressionar e segurar da Agenda repete o que existe no Encontro). Bom.
- **Dobradas:** Organização (Comunidade), Mais opções (Perfil), Mais opções (Novo encontro: repetição, vagas, categoria), Preparação (Resumo), Ver detalhes (cartão do líder).

### 1.6 Barra flutuante: onde aparece e onde falha

Regra no código: aparece em toda tela da pilha que **não** está em `ROTAS_SEM_BARRA_FLUTUANTE` (`navegacao/rotasDaBarra.ts:15-42`). Ela é desenhada **fora** da pilha (`app/(autenticado)/_layout.tsx:149`), e cada tela reserva o espaço dela pelo **nome da rota** (`navegacao/BarraDaPilha.tsx:36-41`).

| Grupo                                                                                      | Rotas                                                                                                                                                                                                                                                               | Barra                                                           | Avaliação                                                                                |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Abas                                                                                       | Início, Agenda, Comunidade, Perfil                                                                                                                                                                                                                                  | a do Tabs                                                       | certo                                                                                    |
| Leitura e listas                                                                           | Encontro (membro), Repertório (membro), Louvor, Meu repertório, Avisos, Aviso, Oração, Sugestões, Biblioteca, Relatórios, Pessoas, Pessoa, Notificações, Versículo, Ajuda, Privacidade, Segurança, Aparelhos, Plataforma                                            | aparece                                                         | certo                                                                                    |
| Telas com ação fixa (`BarraDeAcao`)                                                        | Encontro (organização), Repertório (organização), Etapa, Editar perfil, Escolher avatar, Convidar, Configurações, Excluir conta, Denunciar comunidade, Conteúdo (editar), Aviso (rascunho), Sugestão, Exportar, Local, Ativar código extra, Tenho um código, Missão | **aparece embaixo da barra de ação**                            | dois rodapés empilhados, cerca de 150 pt (achado 3)                                      |
| Formulários de criação, confirmações que apagam, Ao vivo, Check-in, Cifra, Igual ao último | lista de exceções                                                                                                                                                                                                                                                   | não aparece                                                     | certo                                                                                    |
| Modais nativos                                                                             | Novo, Editar, Duplicar, Status, Ler QR, Substituição, Criar comunidade                                                                                                                                                                                              | não aparece                                                     | certo                                                                                    |
| **Tela empilhada aberta de dentro de um modal**                                            | Encontro aberto pelo "Roteiro" de Igual ao último (`TelaIgualAoUltimo.tsx:497-499`), Série aberta do Editar (`TelaEditarEvento.tsx:369`), Código da comunidade aberto do Criar comunidade (`TelaCriarComunidade.tsx:208`)                                           | **reserva o espaço, mas a barra fica escondida atrás do modal** | é a imagem 15 do dono: "Publicar" elevado sobre uma faixa vazia e sem a barra (achado 1) |
| Degraus de uma vez só                                                                      | Boas-vindas, Comece por aqui, Tenho um código                                                                                                                                                                                                                       | aparece                                                         | discutível: a barra convida a pular o degrau                                             |

Inconsistência da regra: **criar** esconde a barra e **editar** mostra (`avisos/novo` sem, `avisos/[id]` com; `conteudos/[tipo]/novo` sem, `conteudos/[tipo]/[itemId]` com), e **excluir a comunidade** esconde enquanto **excluir a conta** mostra.

---

## 2. Tarefas reais medidas em toques e telas

Toques contados pelo código (estimativa). "+10 s" é a espera do Desfazer. Ideal = proposta deste documento.

| #   | Tarefa (quem)                                       | Caminho atual                                                                                                                         | Toques e telas                      | Atrito principal                                                                                    | Caminho ideal                                                                                                     | Toques           | API?                                                      |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------- |
| 1   | Criar encontro, com anterior (líder)                | Agenda, Novo encontro, Igual ao último, (data), Publicar                                                                              | 4 a 5, 3 superfícies, +10 s         | Folha com 4 caminhos; tela "Quando" confusa; título "Igual ao último **sábado**" para qualquer dia  | Agenda, Novo encontro (abre direto a conferência), Publicar                                                       | 2 a 3            | não                                                       |
| 1b  | Criar o primeiro encontro (líder)                   | Agenda, Novo encontro, Sábado padrão, local, Publicar                                                                                 | 5 a 6                               | Título nasce "Sábado" e categoria "Programação de sábado" mesmo num domingo                         | Mesma conferência, título vazio com exemplo, data e hora numa linha                                               | 4                | não                                                       |
| 2   | Criar vários dias (líder)                           | Não existe. Só "Repetição" dentro de "Mais opções" do Novo encontro, ou repetir a tarefa 1 por data                                   | 5 por data                          | Não dá para marcar 3 datas soltas (retiro, semana especial)                                         | Na conferência: "Mudar data", calendário com várias datas marcadas, "Marcar 3 encontros"                          | 3 + 1 por data   | não (app chama a cópia N vezes); lote é opcional          |
| 3   | Chamar 1 pessoa (líder)                             | Início, "Ver quem vai", rolar, Convocar pessoas, papel, pessoa, botão no fim da folha                                                 | 5 a 6, 2 telas e 1 folha, +10 s     | Botão de enviar no fim da rolagem; 12 papéis antes da lista                                         | Início, "Chamar quem vai" (abre a folha), pessoa, papel, "Chamar a Ana"                                           | 4                | não                                                       |
| 4   | Montar a banda, 5 funções (líder)                   | Quem vai, "Convocar" na linha do instrumento, pessoa, enviar; 5 vezes                                                                 | cerca de 15 a 20, 5 esperas de 10 s | Uma folha e um aviso por instrumento                                                                | "Montar a banda": uma folha com as funções em linhas, um nome por linha, um envio                                 | 11, 1 espera     | não (N chamadas); `papeis` em lote é opcional             |
| 5   | Montar o repertório, 4 músicas (líder)              | Início "Montar o repertório", Adicionar, marcar 4, Adicionar 4 músicas                                                                | 7                                   | Botão acima da lista; cartão de cada música com 5 botões                                            | Igual, com o botão fixo embaixo                                                                                   | 7                | não                                                       |
| 6   | Adicionar música que não está na Biblioteca (líder) | Fechar a folha, Voltar, aba Comunidade, Biblioteca, cadastrar, salvar, voltar ao Início, cartão, Montar, Adicionar, marcar, Adicionar | cerca de 14 + formulário, 6 telas   | **Não existe "Cadastrar música nova" na folha** quando a Biblioteca já tem músicas (imagem 17)      | Na folha: "Cadastrar música nova" (ou "Cadastrar 'Nome'" quando a busca não acha), mini formulário, volta marcada | 4 + digitar      | não                                                       |
| 7   | Publicar o rascunho (líder)                         | Início, "Publicar e avisar N pessoas"                                                                                                 | 1, +10 s                            | No Início o botão vira "Publicado" durante a espera; no Encontro diz "Publicando em 9 s · Desfazer" | Um só padrão nos dois                                                                                             | 1                | não                                                       |
| 8   | Lembrar quem não respondeu (líder)                  | Início, "Lembrar os N"                                                                                                                | 1, +10 s                            | "Lembrar os 1"; número diferente entre Início e Encontro                                            | Um número, uma frase                                                                                              | 1                | não                                                       |
| 9   | Marcar quem chegou (líder)                          | Início (de 2 h antes), "Marcar quem chegou", tocar cada nome                                                                          | 1 + 1 por pessoa                    | Fora da janela, fica em "Outras coisas", no fim do Resumo                                           | Igual; no dia, Início em "modo hoje" (ideia 5)                                                                    | 1 + 1 por pessoa | não                                                       |
| 10  | Conduzir ao vivo (líder)                            | Início, "Conduzir ao vivo"                                                                                                            | 1                                   | Bom                                                                                                 | Igual                                                                                                             | 1                | não                                                       |
| 11  | Avisar a comunidade (líder)                         | Comunidade, Novo aviso, título e texto, Publicar e avisar                                                                             | 3 + digitar, +10 s                  | Bom (melhor tarefa do teste ingênuo)                                                                | Igual                                                                                                             | 3                | não                                                       |
| 12  | Responder convite (membro)                          | Início, Aceitar                                                                                                                       | 1, +10 s                            | Duas funções no mesmo encontro pedem duas respostas                                                 | "Aceitar tudo" quando há mais de uma                                                                              | 1                | não (app em laço)                                         |
| 13  | Ver o que é meu (membro)                            | Agenda, "Só o que é meu"                                                                                                              | 2                                   | Bom                                                                                                 | Igual                                                                                                             | 2                | não                                                       |
| 14  | Ver vários encontros no mesmo dia (todos)           | Agenda, rolar; ou Calendário, dia                                                                                                     | 1 a 3                               | Agenda agrupa por semana: dois cartões repetem "28 NOV"; o Início mostra só um                      | Agenda com cabeçalho por dia ("Sábado, 28 de novembro · 2 encontros"); Início com "Também neste dia"              | 1                | não (o `GET /inicio` já traz `proximosEventos`; conferir) |
| 15  | Trocar de comunidade (quem tem 2+)                  | pílula, escolher                                                                                                                      | 2                                   | Folha nativa em branco no build 10 (imagem 12, PH-16)                                               | Igual, com a folha consertada                                                                                     | 2                | não                                                       |
| 16  | Convidar alguém (administração)                     | Comunidade, Convidar, "Convidar para X", compartilhar                                                                                 | 3 a 4                               | Três portas para o mesmo assunto; o organizador não convida                                         | Uma tela "Convidar" com link, código, QR e pedidos                                                                | 3                | não                                                       |
| 17  | Tocar a música no palco (músico)                    | Início "Abrir o repertório", música, Modo palco                                                                                       | 3                                   | O líder que não toca cai na cifra da Biblioteca, sem palco                                          | Igual; "Modo palco" também na leitura                                                                             | 3                | não                                                       |

**Resumo:** o que é diário (publicar, lembrar, avisar, responder, ao vivo) já está em 1 a 3 toques. O que dói é **montar** o encontro (tarefas 2, 3, 4 e 6) e **ler** o dia (tarefa 14).

---

## 3. Auditoria por heurísticas

Severidade: **B** bloqueia (a pessoa não consegue ou faz errado), **A** atrapalha (consegue com esforço ou dúvida), **P** polimento (estranheza, alinhamento, texto). Heurística entre colchetes (Nielsen: H1 visibilidade, H2 mundo real, H3 controle, H4 consistência, H5 prevenção, H6 reconhecer, H7 eficiência, H8 minimalismo, H9 erro, H10 ajuda; ID = idosos; AL = alinhamento).

### Navegação e barra

1. **B [H1, H4] Barra flutuante some e o rodapé fica "elevado" sobre uma faixa vazia.** Encontro aberto de dentro do modal "Igual ao último". Evidência: imagem 15 do dono; `eventos/TelaIgualAoUltimo.tsx:497-499` empurra `/evento/[eventoId]` de dentro de um `fullScreenModal` (`app/(autenticado)/_layout.tsx:75-78`); a barra é desenhada fora da pilha (`_layout.tsx:149`) e o modal nativo a cobre, mas a tela reserva o espaço pelo nome (`navegacao/BarraDaPilha.tsx:36-41`) e a `BarraDeAcao` soma esse espaço embaixo (`ui/BarraDeAcao.tsx:23-25` e `67`). Mesmo risco em `TelaEditarEvento.tsx:369` e `TelaCriarComunidade.tsx:208`. Causa: lida no código, **não reproduzida**. Correção: (a) nunca empurrar tela cheia de dentro de modal (Roteiro vira acordeão, achado 5; depois de publicar, fechar o modal e só então abrir o encontro); (b) contexto `DentroDeModal` que zera o espaço da barra em qualquer tela montada sobre um modal; (c) teste: tela empilhada sobre modal tem `ContextoDaBarraDeAbas` 0.
2. **A [H4] A regra da barra muda entre criar e editar.** `rotasDaBarra.ts:26-34`: `avisos/novo` e `conteudos/[tipo]/novo` sem barra; `avisos/[avisoId]` e `conteudos/[tipo]/[itemId]` com barra; `excluir-comunidade` sem, `excluir-conta` com. Correção: regra única no achado 3.
3. **A [H8, ID] Dois rodapés empilhados.** Toda tela com `BarraDeAcao` que não é exceção mostra a barra de ação **e** a barra de abas: cerca de 150 pt fixos embaixo (captura 81: os dois rodapés ocupam perto de 20% da altura; imagem 15). Correção: "tela com ação principal fixa não mostra a barra de abas" (derivar de `barraDeAcao` na `Tela`, não de lista de nomes). Pede decisão do dono (pergunta 1).
4. **A [H4] Dois sistemas de folha.** `ui/FolhaNaTela.tsx` (Modal do RN, vidro, alça própria) e a folha nativa `formSheet` (`ui/opcoesDaFolha.ts`) com aparência e altura diferentes; a nativa deu a folha em branco (imagem 12, PH-16, causa ainda hipótese). Correção: uma folha só (a `FolhaNaTela`) também para Comunidades, Como conseguir convite e Tenho um convite.
5. **A [H6, H7] O roteiro leva para outra tela.** `eventos/SecaoEtapas.tsx:170-178` empurra `/evento/[id]/etapa/[etapaId]`; lá a etapa tem "Salvar" próprio e "Remover" escondido. O dono pediu acordeão. Correção: cada etapa é um acordeão na própria aba: aberta mostra duração, quem cuida (com "Chamar alguém" e "Tirar"), descrição, e os botões "Subir", "Descer", "Mudar nome e duração" (folha curta) e "Tirar esta etapa" (com Desfazer). A rota da etapa vira redirecionamento por um ciclo.
6. **A [H8] Louvor é um menu de menus.** `repertorio/TelaLouvor.tsx:56-91`: quatro linhas, uma delas ("Encontros") leva de volta para a aba Agenda; "Biblioteca de músicas" e "Músicos" repetem a Biblioteca. Correção: Comunidade > "Músicas do próximo encontro" abre direto o Repertório (como já propõe `facil-de-usar.md` 3.4).
7. **P [H4] Rotas e títulos velhos.** `_layout.tsx:103` ainda chama `agenda/[data]` de "Linha do tempo do dia"; `/conta` duplica o Perfil. Correção: apagar `/conta` (Missões aponta para `/perfil`), manter só os redirecionamentos com prazo escrito.
8. **A [H7] Cifra a 5 telas para quem não toca.** Ver 1.3. Correção: achado 6 resolve (2 telas).

### Textos fixos de dia da semana ("pro app só existe sábado?")

9. **B [H2, H5] O modelo padrão batiza o encontro de "Sábado".** `eventos/TelaNovoEvento.tsx:141-148`: título `'Sábado'`, categoria `'Programação de sábado'`, data `proximoSabado`. Resultado na imagem 13: cartão "Sábado · Dom., 29 de nov." e a faixa "Sábado de ontem terminou.". Correção: o modelo vira "Encontro padrão"; o título nasce vazio com exemplo do dia escolhido ("Ex.: Culto de domingo"); a data padrão é o próximo dia da semana do último encontro (ou hoje + 7); categoria sai da criação (achado 30).
10. **A [H2, H4] "Sábado" escrito à mão em 15 lugares.** `_layout.tsx:77`; `TelaIgualAoUltimo.tsx:82, 89, 91, 306, 316, 328, 335, 337, 351, 389, 538`; `BarraDoEvento.tsx:242` ("Marcar o próximo sábado", enquanto o Início diz "Marcar o próximo encontro"); `FolhaNovaProgramacao.tsx:42, 53`; `entrada/TelaBoasVindas.tsx:63` ("Criar o encontro do sábado"); `onboarding/MissoesDeConfiguracao.tsx:62`; `onboarding/missao.ts:67`. Correção: função única `nomeDoDia(eventoAnterior)` que devolve "domingo", "sábado", "quarta"; os textos viram "Igual ao último encontro" e "Marcar o próximo domingo" (com o dia calculado) ou "o próximo encontro" quando não há anterior. Teste de varredura: nenhuma string com "sábado" fora de `datas.ts` e de exemplos.
11. **P [H2] "Obrigado por servir ontem." é fixo.** `inicio/TelaInicio.tsx:287-288`: diz "ontem" mesmo quando foi hoje cedo. Correção: usar o mesmo "de hoje / de ontem / (data)" de `textoDaDespedida` (`momento.ts:130-142`).

### Início

12. **A [H1, H7] O cartão diz "Ninguém foi convocado ainda." e o botão é "Montar o repertório".** Imagem 13. `inicio/momento.ts:248-263`: a ordem de `acoesDoLider` não tem o passo "chamar a equipe" quando `convocados === 0`; a frase vem de `momento.ts:298-299`. Correção: novo passo 2 (depois de publicar o rascunho): "Chamar quem vai" abre a folha de convocar direto. Teste: `convocados 0` e publicado dá primária `chamar`.
13. **A [H7] "Convocar bateria" não abre a bateria.** `inicio/CartaoDoLider.tsx:293-303` chama `destinos.verConvocados` (`PecasDoCartao.tsx:103-107`), que só abre a aba Quem vai. Correção: parâmetro `convocar=Bateria` que abre a folha com o papel escolhido (3 toques até a pessoa chamada).
14. **A [H1, H4] "Publicado" antes de publicar, só no Início.** `CartaoDoLider.tsx:268-279` mostra "Publicado" com check durante a contagem; o Encontro e a conferência mostram "Publicando em 9 s · Desfazer" (`BarraDoEvento.tsx:224-227`, `TelaIgualAoUltimo.tsx:372-378`). É exatamente a confusão 3 do teste ingênuo, que foi corrigida em dois lugares e não neste. Correção: um gancho `usePublicar` usado pelos três.
15. **P [H2] "Lembrar os 1".** `CartaoDoLider.tsx:255` não trata o singular; `BarraDoEvento.tsx:282` e `QuemVai.tsx:245` dizem "Lembrar o 1". Correção: uma função `rotuloDoLembrar(n)` ("Lembrar a Júlia" com 1 nome; "Lembrar as 4 pessoas" com mais).
16. **A [H4] O número de "Lembrar" muda de tela para tela.** Início usa `lembraveis` (`CartaoDoLider.tsx:255`), o Encontro usa `pendentes` (`QuemVai.tsx:245`, `BarraDoEvento.tsx:282`). O teste ingênuo viu "Lembrar os 10" e "Lembrar os 9". Correção: um número (`lembraveis`) e, se diferente de `pendentes`, a frase "2 já foram lembrados hoje".
17. **A [H2] "0 presentes" ainda pode aparecer.** `CartaoDoLider.tsx:358-362` mostra presentes sempre que `!== null`, inclusive 0 (a D73 corrigiu só a faixa). Correção: só com mais de 0; com 0, "Ninguém marcou presença".
18. **P [AL] A data quebra no meio do horário.** Imagem 13: "Dom., 29 de nov. · 16:00 às" e "17:00" sozinho na linha de baixo (`CartaoDoLider.tsx:370`, `dataEHorario`). Correção: data numa linha, horário na outra, sempre (padrão do item 4.6).
19. **A [H1] O Início mostra um encontro só.** Com "Sábado Jovem" e "Noite de jogos" no mesmo dia, o segundo não aparece (teste ingênuo, missão 1). Correção: linha abaixo do cartão "Também neste dia: Noite de jogos, 19:30" (toque abre). Dado: `dados.proximosEventos` já chega no `GET /inicio` (conferir se basta).

### Agenda e calendário

20. **A [H6, AL] Vários encontros no mesmo dia viram cartões soltos com a mesma data.** Captura 21: "28 NOV Sábado Jovem" e "28 NOV Noite de jogos" em cartões separados; agrupamento só por semana (`agenda/semanas.ts:40-52`, `TelaAgenda.tsx:285-295`). Correção: dentro da semana, cabeçalho por dia ("Sábado, 28 de novembro · 2 encontros") e as linhas do dia num cartão só, com a hora na coluna da esquerda.
21. **A [AL, H4] A linha que pede resposta tem outro esqueleto.** `agenda/LinhaDoEncontro.tsx:73-94` usa `DeslizarParaResponder` (sem a coluna de data, recuo 16), a linha comum tem a coluna de data (`164-171`): na mesma lista, os títulos começam em x diferentes. Correção: a mesma linha para os dois casos; os botões "Aceitar" e "Não posso ir" vão numa segunda fileira, alinhados à coluna do título.
22. **P [H2, ID] Data sem dia da semana na coluna e "SÁB" em caixa alta no texto.** `LinhaDoEncontro.tsx:24` e `164-171` mostram "28 / NOV"; `semanas.ts:58-68` escreve "SÁB 16:00 às 17:00". Correção: coluna "SÁB / 28"; meta "16:00 às 17:00 · Salão da igreja".
23. **A [H4] "Rascunhos (16)" parece botão e não faz nada.** `TelaAgenda.tsx:235`, ao lado do botão "Calendário" (captura 21). Correção: virar filtro de verdade ("Ver rascunhos") ou sumir.
24. **A [H7] O calendário não cria encontro no dia escolhido.** `FolhaNovaProgramacao` aceita `data` (`FolhaNovaProgramacao.tsx:21-30`), mas a Agenda nunca passa (`TelaAgenda.tsx:336`); o dia do calendário só filtra a lista (`346-350`). Correção: ao escolher um dia, a faixa "Só o dia 28/11" ganha "Novo encontro neste dia".
25. **A [H7] Não dá para escolher vários dias.** Só a repetição semanal, dentro de "Mais opções" (`CamposDoEvento.tsx:379`). Correção: na conferência, o calendário aceita várias datas e o botão diz "Marcar 3 encontros"; o app chama a cópia uma vez por data (sem API). Com API (opcional), `POST .../eventos/copiar` em lote numa transação.
26. **A [H5] Segurar a linha abre "Cancelar ou adiar" já em Adiar.** `TelaAgenda.tsx:495` passa `acao: 'adiar'`; a D74 tirou exatamente essa escolha de partida no Encontro (`TelaMudarStatus.tsx:44-58`). Correção: não passar `acao`.

### Novo encontro e "Igual ao último"

27. **A [H8] Quatro jeitos de começar.** `FolhaNovaProgramacao.tsx:40-79` (Igual ao último, Sábado padrão, A partir de um modelo, Em branco). Correção: "Novo encontro" abre direto a conferência "Igual ao último"; dentro dela, "Começar do zero" como link; "A partir de um modelo" só quando a comunidade tem modelo próprio.
28. **A [H6, ID] A tela "Quando" é confusa.** Imagem 14: a data aparece no cartão de cima e de novo nas pílulas; a hora só muda em "Outra data"; pílulas de escolha parecem filtro e quebram em duas linhas desiguais (`TelaIgualAoUltimo.tsx:443-490`). Correção: uma linha "Sábado, 28 de novembro, 16:00" com o botão "Mudar data ou hora" (folha com calendário e hora); sugestões de data só dentro dessa folha.
29. **P [H2] "Banda e equipe: 0 pessoas. Todos voltam como 'aguardando resposta'."** Imagem 14; `TelaIgualAoUltimo.tsx:502-511` mostra a frase mesmo com 0. Correção: com 0, "Ninguém foi chamado no último encontro."; com mais, "Ana, Bruno e mais 3 vão receber o aviso ao publicar".
30. **A [H8] Formulário com controles demais.** "Mais opções" tem categoria (com 8 pílulas), descrição, duração (com 6 pílulas), quem vê, vagas, lista de espera, prazo (data e hora), informações úteis e repetição (`eventos/CamposDoEvento.tsx:182-238` e `364-399`). Correção: criação pede título, data e hora, local; duração vem do roteiro; categoria sai da tela (fica com o padrão); inscrição e vagas viram "Abrir inscrições" no próprio encontro depois.

### Encontro da organização (Resumo, Quem vai, Convocar)

31. **A [H8, H4] Duas ações principais na mesma tela, e "Lembrar" duas vezes.** Aba Quem vai: botão grande "Convocar pessoas" no fim do conteúdo (`QuemVai.tsx:355-365`) mais o primário da barra; "Lembrar" no cartão (`QuemVai.tsx:241-255`) e na barra (`BarraDoEvento.tsx:275-289`). Correção: com a aba Quem vai aberta, o primário da barra é "Chamar alguém"; "Lembrar" só no cartão do alto.
32. **A [H4] Quatro botões "Convocar" com rótulos diferentes numa tela.** `QuemVai.tsx:259` ("Convocar bateria"), `276` ("Convocar para a banda"), `315` ("Convocar" por instrumento), `357` ("Convocar pessoas"), e `TelaEtapa.tsx:298` ("Convocar pessoa"). Correção: "Chamar alguém" (um só, fixo) e "Escolher" nas faltas.
33. **A [ID, H8] Folha de convocar com 12 opções antes da lista e botão no fim da rolagem.** `eventos/Convocacao.tsx:457-480` (3 papéis de equipe e 9 de banda, `packages/dominio/src/banda.ts:11-21`) e o botão em `563-569`, dentro da rolagem. Correção: rodapé fixo da folha (padrão 4.5); papéis em até 6 à vista e "Outra função..."; quem entra por uma falta já chega com o papel.
34. **A [H3, H9] Pessoa travada sem saída.** `Convocacao.tsx:397-405` e `421`: "Já está como X" desabilita a linha, sem "Mudar ou tirar". Correção: a linha abre "Já vai de violão. Mudar ou tirar?" (regra 6 de `facil-de-usar.md` 2.1).
35. **P [H2] "Quem conduz / Quem ajuda / Outra função".** `Convocacao.tsx:160-164`. Categorias abstratas. Correção: papéis concretos (Recepção, Coordenação, Projeção, Outra...) e "Ajudar no encontro" como padrão.
36. **A [AL] "Preparação" fora de cartão, entre cartões.** Captura 31-p2 e `ResumoDoEncontro.tsx:148-162`: o acordeão encosta na margem da tela (x 20) enquanto os blocos vizinhos têm o texto em x 38. Correção: linha de lista dentro do cartão "Quem vai / Inscrições", ou cartão próprio.
37. **P [H8] O cartão do repertório aparece no Resumo e no Roteiro.** `ResumoDoEncontro.tsx:139` e `DetalheDoEvento.tsx:290-293`. Correção: só no Resumo.
38. **P [H10] Texto manda tocar num "Mais" que não existe mais.** `DetalheDoEvento.tsx:107`: "abra o encontro, toque em Mais e depois em Baixar". Correção: "role até Outras coisas e toque em Baixar para usar sem internet".
39. **A [ID, H6] Ações só em ícone sem palavra.** `TelaEtapa.tsx:177-183` (Remover etapa), `TelaLocais.tsx:266`, `TelaSerie.tsx:151`, `TelaComunidadeDaPlataforma.tsx:154`: `BotaoIcone` sem `texto`, contra a D75. Correção: a ação aparece como linha visível no fim da tela ("Tirar esta etapa"), como as "Outras coisas".
40. **A [H4] Dois modelos de gravação.** Etapa pede "Salvar" (`TelaEtapa.tsx:184-194`); ordem, tom e convocação gravam na hora. Correção: com o acordeão (achado 5), nome e duração numa folha curta com "Salvar"; o resto grava na hora com Desfazer.

### Repertório

41. **B [H3, H7] Não dá para cadastrar música nova ao montar o repertório.** Imagem 17. `TelaRepertorioDoEncontro.tsx:559-571`: "Cadastrar música" só aparece com a Biblioteca **vazia**; com músicas, a folha diz "Todas as músicas da biblioteca já estão neste repertório." (`597-601`) e não oferece saída. Correção: linha fixa "Cadastrar música nova" no alto da folha; busca sem resultado vira "Cadastrar 'Nome digitado'"; mini formulário (título, tom, artista, cifra opcional) e a música volta **marcada**.
42. **A [AL, H6] O botão da folha vem antes da lista e do vazio.** `TelaRepertorioDoEncontro.tsx:585-596`; na imagem 17, "Marque as músicas" (desabilitado) fica acima da explicação. Correção: rodapé fixo da folha.
43. **A [AL] Cartão da música com 5 controles que quebram em 2 linhas, e "Mais" desalinhado.** Captura 81 e imagem 17: "Mais" sozinho na segunda linha, com o texto 30 px (2x) à direita da coluna do título, porque o terciário tem recuo de 20 (`TelaRepertorioDoEncontro.tsx:435-470`; `ui/Botao.tsx:121-134`). Correção: linha de lista "1 Canção de abertura · Tom G" com "Subir" e "Descer" à direita; tocar a linha abre a folha da música (Tom do dia com "Descer o tom" e "Subir o tom", Abrir cifra, Tirar do repertório). Sem "Mais".
44. **P [H2] "Tom C · Novo Tom".** Imagem 17: o artista (a banda "Novo Tom") colado ao tom lê como "mudou de tom" (`descricaoDoItem`, `TelaRepertorioDoEncontro.tsx:55`). Correção: "Tom do dia: C" e, em outra parte, "de Novo Tom".
45. **P [H8] Um cartão inteiro para "Louvor · 3 músicas".** `TelaRepertorioDoEncontro.tsx:256-267`. Correção: subtítulo da tela ("Sábado Jovem · 3 músicas, 14 min").
46. **A [H4] Seis nomes para o repertório.** "Abrir o repertório", "Ver o repertório", "Montar o repertório" (`inicio/PecasDoCartao.tsx:84-88`); "Ver repertório", "Montar repertório", "Meu repertório" (`repertorio/CartaoDoRepertorioNoEncontro.tsx:56-67`); "Abrir o meu repertório" (`TelaRepertorioDoEncontro.tsx:270`); "Repertório do próximo encontro" (`TelaLouvor.tsx:58`); "Louvor". Correção: "Músicas do encontro" (ver, todos), "Escolher as músicas" (líder, vazio) e "Minhas cifras" (quem toca).

### Comunidade e Perfil

47. **A [H5] "Limpar próximos encontros" no meio de Locais e Modelos.** `comunidade/atalhosDoMural.ts:128-137`: ação que apaga em massa, com ícone de lixeira, mas sem cor nem grupo de perigo. Correção: só dentro de Configurações, no bloco "Cuidado" (onde já está o Excluir comunidade).
48. **A [H4] Três portas para convidar.** "Convidar" (`atalhosDoMural.ts:65-75`), "Código da comunidade" (`158-172`) e "Pedidos de entrada e convites" (`TelaComunidade.tsx:402-416`). Correção: uma tela "Convidar" com: link para mandar, código e QR, pedidos esperando.
49. **P [AL] Links centralizados embaixo de conteúdo alinhado à esquerda.** "Ver todos os avisos, 6" (`TelaComunidade.tsx:269-275`, captura 41) e "Ver encontros passados" (`TelaAgenda.tsx:301-307`). Correção: última linha do cartão, alinhada ao texto, com seta.
50. **P [H2] "Sair" promete e-mail e senha para quem entrou com Apple ou Google.** `perfil/TelaPerfil.tsx:213-215`. Correção: dica pelo provedor da conta.

### Erros, feedback e Desfazer

51. **A [H9] Mensagem genérica "Algo deu errado. Tente de novo em instantes."** `servicos/erros.ts:46`, usada por `mensagemDoErro` em toda tela que não passa título próprio. Correção: as telas passam sempre o que **não** aconteceu ("Nada foi alterado") e o que fazer; a genérica vira "Não deu para concluir. Nada foi alterado. Confira a internet e toque em Tentar de novo."
52. **P [H4] "Sem conexão" e "Sem internet".** `erros.ts:35` e `DetalheDoEvento.tsx:105` dizem "conexão"; o resto do app diz "internet". Correção: "Sem internet" em tudo.
53. **A [H1, H4] O Desfazer tem três caras.** Botão que vira o Desfazer ("Publicando em 9 s · Desfazer", `BarraDoEvento.tsx:224-227`); botão desabilitado com contagem e o Desfazer só na faixa ("Enviando em 9 s", `CartaoDoLider.tsx:228-238`, `eventos/useLembrete.ts:68`); botão que já diz o resultado ("Publicado", `CartaoDoLider.tsx:268-279`). Correção: um só: o botão diz "Enviando... Desfazer (9 s)" e é o Desfazer, em toda ação que avisa gente.

### Forma, alinhamento e acessibilidade

54. **A [H6, ID] A forma não separa ação de estado.** Botão, chip, pílula de filtro e segmento são todos cápsula (`RAIO.pilula`, `packages/tokens/src/index.ts:140-141`). Na imagem 15, "Rascunho" e "Só para a comunidade" têm o formato do "Voltar"; na captura 21, "Rascunhos (16)" parece botão. E 82 botões terciários (só texto colorido, em 57 arquivos) parecem frase: "Ver quem vai" na imagem 13. Correção: chip de estado retangular (raio 8), sem borda, com ícone; botão continua cápsula; terciário ganha seta "›" (navega) ou ícone (age).
55. **A [AL] O recuo interno dos cartões varia entre 16, 18 e 20.** `ui/Cartao.tsx:46` (18), `ui/LinhaDeLista.tsx:208-209` (18), `ui/CartaoDoMomento.tsx:126-128` (20), `ui/Aviso.tsx:62-63` (16), `agenda/LinhaDoEncontro.tsx:159` (16), `ui/DeslizarParaResponder.tsx:179` (16). Cartões vizinhos têm o texto em colunas diferentes. Correção: 16 em todos (padrão 4.1).
56. **P [AL] Escala de espaços com 13 valores.** `ESPACO` tem 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 32, 40 (`packages/tokens/src/index.ts:14-33`); 6, 10, 14 e 18 deixam medidas "quase iguais" lado a lado. Correção: telas e componentes usam só 4, 8, 12, 16, 20, 24, 32; os ímpares de escala ficam proibidos por lint fora de ícones.
57. **A [H7, ID] A ação principal de toda folha rola junto com o conteúdo.** `ui/FolhaNaTela.tsx:122-138`: tudo dentro da `ScrollView`; com lista longa, o botão some (Convocar, Adicionar músicas). Correção: `FolhaNaTela` ganha `rodape` fixo, igual à `BarraDeAcao`.
58. **P [ID] Contraste não medido sobre o vidro.** Texto suave (`textoSuave`) sobre tinta translúcida e o terciário coral sobre o roxo: o `contraste.test.ts` mede pares de token, não o fundo real com Aurora. **Inferência**, não medi. Correção: medir nas capturas a 390 e 375 (claro e escuro) e subir o par se ficar abaixo de 4,5:1 (7:1 no texto de ação, critério 8 do teste do vovô).

**Contagem:** 58 achados: 3 bloqueiam (1, 9, 41), 39 atrapalham, 16 de polimento.

---

## 4. Padrões de layout (o conjunto fechado)

Objetivo: **toda borda de texto cai numa de três colunas** (20, 36 e 88 a partir da borda do celular) e todo espaço vertical é 4, 8, 12, 16, 20, 24 ou 32.

### 4.1 Grade

| Medida                                                  | Valor                                                                      | Token                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------- |
| Margem da tela                                          | 20                                                                         | `RITMO.margemDaTela`       |
| Recuo interno de cartão, aviso, linha e folha           | **16** (hoje 16, 18 ou 20)                                                 | novo `RITMO.recuoDoCartao` |
| Entre blocos                                            | 16                                                                         | `RITMO.entreSecoes`        |
| Título de seção até o cartão                            | 8                                                                          | `RITMO.rotuloDaSecao`      |
| Entre itens dentro do cartão                            | 12                                                                         | `RITMO.entreItens`         |
| Coluna da esquerda da linha (ícone, avatar, data, hora) | 40, mais 12 de intervalo                                                   | novo `COLUNA_DA_LINHA`     |
| Colunas de texto                                        | 20 (fora de cartão), 36 (dentro de cartão), 88 (depois da coluna da linha) | derivadas                  |

### 4.2 Cabeçalho

- **Raiz de aba:** linha de 48 (pílula à esquerda, sino com a palavra à direita), 20, título `display`; ação do título opcional, cápsula média.
- **Pilha:** linha de 48 ("Voltar" com palavra à esquerda; no máximo **uma** ação com palavra à direita), 12, título `tituloTela`, subtítulo 4 abaixo (2 linhas no máximo), meta 8 abaixo. **Sem chips** no cabeçalho: estado vira a primeira linha do corpo, em texto com ícone.
- **Modal:** igual à pilha, com "Fechar" no lugar de "Voltar". Nunca empurrar tela cheia de dentro de modal.

### 4.3 Corpo

- Seção = título de seção (`tituloItem`, coluna 20) + 8 + cartão.
- Links "Ver todos" e "Ver mais" = **última linha do cartão** (coluna 36, com seta), nunca centralizados fora dele.
- Acordeão = **sempre dentro de cartão**, cabeçalho de 56 com a seta e a palavra ("Ver detalhes").

### 4.4 Cartão e linha de lista

- Cartão: raio 22, recuo 16 nos quatro lados, intervalo 12 entre itens.
- Linha de lista: 56 (uma informação) ou 72 (duas), recuo 16; coluna da esquerda 40; à direita **um** elemento só: seta, botão compacto **ou** chip.
- Linha de encontro (Agenda, Início, Para responder): coluna "SÁB / 28", título, "16:00 às 17:00 · Local", e a fileira de botões (Aceitar, Não posso ir) **abaixo**, na coluna 88. Mesmo esqueleto com ou sem resposta pendente.
- Cartão do momento: etiqueta, título, data (linha 1), horário e local (linha 2), no máximo 2 frases do que falta, **um** botão primário, **um** link. Nada mais.

### 4.5 Rodapé de ação

- Fixo, 1 primário (à direita) e no máximo 1 secundário, recuo 12 em cima e 20 nos lados, área segura mais 12.
- **Tela com rodapé de ação não mostra a barra de abas** (pergunta 1).
- A folha tem o mesmo rodapé fixo (achado 57). Motivo de botão desabilitado: linha abaixo dos botões.

### 4.6 Formulário

- No máximo 5 campos à vista; rótulo acima; 20 entre campos; erro abaixo do campo.
- "Mais opções" só para o que menos de 1 em 5 pessoas usa.
- Data e hora: **uma linha que se lê** ("Sábado, 28 de novembro, 16:00") com "Mudar", nunca pílulas de data soltas.

### 4.7 Folha

- Alça, título `tituloCartao` à esquerda, "Fechar" com palavra à direita, corpo que rola, rodapé fixo. Altura do conteúdo até 90%. Um só componente (`FolhaNaTela`).

### 4.8 Estados

- Vazio: sol ou ícone, 1 frase de título, 1 frase de explicação, **1 ação** (ou o motivo de não haver).
- Erro: o que não aconteceu, o que fazer, "Tentar de novo".
- Chip de estado: retangular, raio 8, ícone e texto. Botão: cápsula. Link: texto com seta.

### 4.9 Datas (um formato por lugar)

| Lugar              | Formato                                                         |
| ------------------ | --------------------------------------------------------------- |
| Coluna da linha    | "SÁB" sobre "28"                                                |
| Meta da linha      | "16:00 às 17:00 · Salão da igreja"                              |
| Cartão e cabeçalho | "Sábado, 28 de novembro" (linha 1) e "16:00 às 17:00" (linha 2) |
| Frase corrida      | "sábado, 28/11, às 16:00"                                       |

### 4.10 Onde o código viola os padrões

| Padrão                                 | Violação                                                         | Arquivo                                                                                                                                            |
| -------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 recuo 16                           | 18 e 20                                                          | `ui/Cartao.tsx:46`, `ui/LinhaDeLista.tsx:209`, `ui/CartaoDoMomento.tsx:126-128`, `ui/CartaoDeVidro.tsx:87, 112, 161, 178`                          |
| 4.1 escala                             | 6, 10, 14, 18 em componentes                                     | `ui/Aviso.tsx:62`, `ui/DeslizarParaResponder.tsx:231`, `ui/ToastComDesfazer.tsx:422-457`, `ui/LinhaDeLista.tsx:208`                                |
| 4.2 sem chips no cabeçalho             | chips de estado e "Em 6 dias"                                    | `eventos/MetaDoEvento.tsx` (imagem 15, captura 33)                                                                                                 |
| 4.2 uma ação com palavra               | ícone sozinho                                                    | `TelaEtapa.tsx:177-183`, `TelaLocais.tsx:266`, `TelaSerie.tsx:151`, `TelaComunidadeDaPlataforma.tsx:154`                                           |
| 4.2 nada de tela cheia dentro de modal | empurra o Encontro                                               | `TelaIgualAoUltimo.tsx:497-499`, `TelaEditarEvento.tsx:369`, `TelaCriarComunidade.tsx:208`                                                         |
| 4.3 link na última linha               | links centralizados                                              | `TelaComunidade.tsx:269-275`, `TelaAgenda.tsx:301-307`                                                                                             |
| 4.3 acordeão em cartão                 | Preparação solta                                                 | `ResumoDoEncontro.tsx:148-162`                                                                                                                     |
| 4.4 um elemento à direita              | 5 controles no cartão da música                                  | `TelaRepertorioDoEncontro.tsx:435-470`                                                                                                             |
| 4.4 mesmo esqueleto                    | linha pendente diferente                                         | `agenda/LinhaDoEncontro.tsx:73-94`                                                                                                                 |
| 4.4 cartão do momento enxuto           | link do repertório, "Como chegar", chip, frases, primário e link | `inicio/CartaoDoLider.tsx:411-483`, `inicio/CartaoDoMembro.tsx:181-251`                                                                            |
| 4.5 barra de abas some                 | dois rodapés                                                     | `navegacao/rotasDaBarra.ts:15-42`                                                                                                                  |
| 4.5 um primário                        | "Convocar pessoas" grande no corpo                               | `QuemVai.tsx:355-365`                                                                                                                              |
| 4.6 data numa linha                    | pílulas de data                                                  | `TelaIgualAoUltimo.tsx:443-490`                                                                                                                    |
| 4.6 no máximo 5 campos                 | 11 controles em "Mais opções"                                    | `CamposDoEvento.tsx:364-399`                                                                                                                       |
| 4.7 rodapé fixo na folha               | botão dentro da rolagem                                          | `ui/FolhaNaTela.tsx:122-138`, `Convocacao.tsx:563-569`, `TelaRepertorioDoEncontro.tsx:585-596`                                                     |
| 4.7 uma folha só                       | folha nativa                                                     | `ui/opcoesDaFolha.ts`, `_layout.tsx:43-47`                                                                                                         |
| 4.8 vazio com ação                     | sem ação                                                         | `TelaRepertorioDoEncontro.tsx:597-601`, `Convocacao.tsx:552` ("Não há mais ninguém para escolher." sem "Convidar"), `QuemVai.tsx:198-200` (membro) |
| 4.8 chip retangular                    | tudo cápsula                                                     | `packages/tokens/src/index.ts:140-141`, `ui/Chip.tsx`                                                                                              |
| 4.9 datas                              | 4 formatos                                                       | `agenda/semanas.ts:58-68`, `LinhaDoEncontro.tsx:24`, `inicio/momento.ts:145-147`, `eventos/PartesDaPagina.tsx` (Quando e onde)                     |

---

## 5. Plano em ondas

Cada onda é pequena, cabe em 1 a 3 dias e tem aceite testável. **Nenhuma onda exige migração.** Onde houver API, está marcado.

### Onda 1: o que o dono viu quebrar (só app, 2 dias)

| Item | Mudança                                                                                                                                                     | Arquivos                                                                                                                                                                                                                                                      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1a   | Barra sobre modal: contexto `DentroDeModal` zera o espaço; Igual ao último não empurra o Encontro (fecha e abre)                                            | `navegacao/BarraDaPilha.tsx`, `ui/Tela.tsx`, `ui/BarraDeAcao.tsx`, `eventos/TelaIgualAoUltimo.tsx`, `eventos/TelaEditarEvento.tsx`, `comunidade/TelaCriarComunidade.tsx`                                                                                      |
| 1b   | Fim do "sábado" fixo: `nomeDoDia()`; modelo "Encontro padrão" com título vazio                                                                              | `eventos/TelaNovoEvento.tsx`, `eventos/TelaIgualAoUltimo.tsx`, `eventos/BarraDoEvento.tsx`, `eventos/FolhaNovaProgramacao.tsx`, `entrada/TelaBoasVindas.tsx`, `onboarding/*`, `app/(autenticado)/_layout.tsx`, `inicio/TelaInicio.tsx`, `utilidades/datas.ts` |
| 1c   | "Cadastrar música nova" na folha (sempre e na busca vazia), volta marcada; botão em rodapé fixo                                                             | `repertorio/TelaRepertorioDoEncontro.tsx`, `conteudos/TelaConteudo.tsx` (formulário reaproveitado)                                                                                                                                                            |
| 1d   | Roteiro em acordeão (Encontro e conferência); rota da etapa vira redirecionamento                                                                           | `eventos/SecaoEtapas.tsx`, `eventos/TelaEtapa.tsx`, `eventos/TelaIgualAoUltimo.tsx`                                                                                                                                                                           |
| 1e   | Início: passo "Chamar quem vai"; "Convocar bateria" abre a folha; "Lembrar" com um número e singular; "0 presentes" fora; "Publicando..." igual ao Encontro | `inicio/momento.ts`, `inicio/CartaoDoLider.tsx`, `inicio/PecasDoCartao.tsx`, `eventos/DetalheDoEvento.tsx` (parâmetro)                                                                                                                                        |
| 1f   | Agenda: cabeçalho por dia, linha pendente com o mesmo esqueleto, "Rascunhos" vira filtro, segurar sem `acao: 'adiar'`                                       | `agenda/TelaAgenda.tsx`, `agenda/LinhaDoEncontro.tsx`, `agenda/semanas.ts`, `ui/DeslizarParaResponder.tsx`                                                                                                                                                    |
| 1g   | Cartão da música vira linha (Subir, Descer, toque abre a folha da música); "Tom do dia: C · de Novo Tom"                                                    | `repertorio/TelaRepertorioDoEncontro.tsx`                                                                                                                                                                                                                     |

**Aceite:**

- Teste: tela montada sobre `fullScreenModal` recebe `ContextoDaBarraDeAbas` igual a 0; captura do Encontro aberto depois de publicar na conferência mostra rodapé encostado na área segura.
- Varredura (teste): nenhum literal "sábado" em `funcionalidades/**` fora de `datas.ts` e de exemplos; Novo encontro com data num domingo nasce sem título "Sábado".
- RNTL: com Biblioteca não vazia, a folha "Adicionar músicas" tem "Cadastrar música nova"; buscar "Oceanos" sem resultado mostra "Cadastrar 'Oceanos'"; depois de salvar, a música volta marcada.
- RNTL: tocar numa etapa do Roteiro **não** chama `router.push`; a etapa abre no lugar com quem cuida e "Chamar alguém".
- `momento.test`: publicado com `convocados 0` dá primária `chamar`; `lembraveis 1` dá "Lembrar a Júlia"; `presentes 0` não escreve "0 presentes".
- RNTL: dois encontros em 28/11 aparecem sob um cabeçalho "Sábado, 28 de novembro · 2 encontros".
- Captura 390 e 375: cartão de música sem segunda fileira de botões.

### Onda 2: padrões de layout (só app, 2 a 3 dias)

| Mudança                                                                              | Arquivos                                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Recuo 16 em todo cartão, linha e aviso; `RITMO.recuoDoCartao` e `COLUNA_DA_LINHA`    | `packages/tokens/src/index.ts`, `ui/Cartao.tsx`, `ui/CartaoDeVidro.tsx`, `ui/LinhaDeLista.tsx`, `ui/CartaoDoMomento.tsx`, `ui/Aviso.tsx`, `ui/DeslizarParaResponder.tsx` |
| Tela com `barraDeAcao` esconde a barra de abas (se o dono disser sim)                | `ui/Tela.tsx`, `navegacao/BarraDaPilha.tsx`, `navegacao/rotasDaBarra.ts`                                                                                                 |
| `FolhaNaTela` com `rodape` fixo; Convocar, Adicionar músicas e Novo encontro usam    | `ui/FolhaNaTela.tsx`, `eventos/Convocacao.tsx`, `repertorio/TelaRepertorioDoEncontro.tsx`                                                                                |
| Chip retangular; terciário com seta ou ícone                                         | `ui/Chip.tsx`, `ui/aparenciaDoBotao.ts`, `ui/Botao.tsx`                                                                                                                  |
| Links "Ver todos" como última linha do cartão; Preparação dentro de cartão           | `comunidade/TelaComunidade.tsx`, `agenda/TelaAgenda.tsx`, `eventos/ResumoDoEncontro.tsx`                                                                                 |
| Datas: 4 formatos fixos (4.9)                                                        | `agenda/semanas.ts`, `inicio/quando.ts`, `inicio/momento.ts`, `eventos/PartesDaPagina.tsx`                                                                               |
| Auditoria de captura: recuo de texto por coluna (20, 36, 88) e espaço fora da escala | `scripts/apresentacao/capturas-v3.ts`                                                                                                                                    |

**Aceite:** teste de tokens: nenhum `ESPACO.e6/e10/e14/e18` fora de `ui/Icone*`; relatório de capturas com zero texto fora das colunas 20, 36 e 88 nas telas Início, Agenda, Encontro (3 abas), Repertório, Comunidade e Perfil, a 390 e 375; nenhum botão de ação dentro da rolagem de folha (busca no código).

### Onda 3: vocabulário e portas únicas (só app, 2 dias)

| Mudança                                                                                                | Arquivos                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repertório: "Músicas do encontro", "Escolher as músicas", "Minhas cifras"; Louvor sem menu             | `inicio/PecasDoCartao.tsx`, `repertorio/CartaoDoRepertorioNoEncontro.tsx`, `repertorio/TelaLouvor.tsx`, `comunidade/atalhosDoMural.ts`, `navegacao/mais.ts` |
| Um "Chamar alguém" (ou "Convocar", conforme D54) por tela; "Escolher" nas faltas; Lembrar só no cartão | `eventos/QuemVai.tsx`, `eventos/BarraDoEvento.tsx`, `eventos/TelaEtapa.tsx`                                                                                 |
| Desfazer com uma cara só (`usePublicar`, `useLembrete` com o mesmo rótulo)                             | `inicio/CartaoDoLider.tsx`, `eventos/useLembrete.ts`, `eventos/BarraDoEvento.tsx`, `ui/ToastComDesfazer.tsx`                                                |
| Erro genérico com o que não aconteceu; "Sem internet" em tudo                                          | `servicos/erros.ts`, `eventos/DetalheDoEvento.tsx`                                                                                                          |
| Convidar numa tela (link, código, QR, pedidos); Limpar para Configurações > Cuidado                    | `comunidade/atalhosDoMural.ts`, `comunidade/TelaConvidar.tsx`, `comunidade/TelaCodigoDaComunidade.tsx`, `comunidade/TelaConfigurarComunidade.tsx`           |
| Ações só em ícone viram linhas visíveis; texto do "Mais" que não existe                                | `TelaEtapa.tsx`, `TelaLocais.tsx`, `TelaSerie.tsx`, `TelaComunidadeDaPlataforma.tsx`, `DetalheDoEvento.tsx:107`                                             |

**Aceite:** varredura: nenhum `BotaoIcone` de ação sem `texto`; os rótulos de repertório da lista proibida não existem; a mesma ação de publicar mostra o mesmo texto em Início, Encontro e conferência (teste com os três).

### Onda 4: montar mais rápido (app, 3 dias; API opcional)

| Mudança                                                                       | Exige                                                                                                |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Vários dias: calendário com várias datas na conferência, "Marcar 3 encontros" | App (cópia chamada N vezes). **API opcional:** cópia em lote numa transação, com teste de isolamento |
| "Montar a banda": folha com as funções em linhas, um nome por linha, um envio | App (uma chamada ao lote por função). **API opcional:** `papeis` no lote                             |
| "Aceitar tudo" para quem tem 2 papéis                                         | App em laço; **API opcional** (rota em lote)                                                         |
| Início "Também neste dia"                                                     | App, se `proximosEventos` basta; senão **API** pequena no `GET /inicio`                              |
| Formulário de criação com 4 campos; categoria fora                            | App (a API aceita categoria padrão; conferir se é obrigatória no contrato)                           |

**Aceite:** fluxo de teste conta toques: 3 datas criadas em no máximo 6 toques; banda de 5 funções em no máximo 11 toques com 1 espera; uma pessoa com 2 papéis responde com 1 toque.

### Onda 5: prova com gente (sem código)

Cinco pessoas, três com 60 anos ou mais, 20 minutos, no celular delas (roteiro em `facil-de-usar.md` 6.6), mais duas tarefas novas: "marque os três sábados do retiro" e "ponha uma música que ainda não está no app". Só sobe estado em `rastreabilidade.md` com essa prova.

---

## 6. O que não fazer, e o que só o dono decide

### Não fazer (para não virar burocracia)

- Não criar telas novas para resolver confusão de telas: cada correção acima **tira** uma tela ou uma camada.
- Não acrescentar "Tem certeza?". O que avisa gente mostra antes quem será avisado; o resto tem Desfazer.
- Não pôr nada novo atrás de "Mais", "Mais opções" ou "Organização" sem tirar outra coisa de lá.
- Não criar preferência ("ligar e desligar") para contornar um padrão ruim: corrige o padrão.
- Não renomear tudo de uma vez: vocabulário vai em uma onda, com teste de varredura.
- Não fazer widget, atalho na tela inicial do celular nem dependência nativa nova antes da onda 5.
- Não coletar data de nascimento (aniversariantes) nem dado de menor sem decisão jurídica.
- Não transformar a onda 5 em pesquisa longa: 5 conversas de 20 minutos bastam.
- Não pedir mudança de API onde o app resolve com N chamadas, até haver prova de que N chamadas falham na prática.

### Cinco perguntas que só o dono responde

1. **Tela com botão principal fixo embaixo pode esconder a barra de abas?** (Ganha cerca de 80 pt e acaba com o rodapé duplo; perde o atalho para trocar de aba no meio de uma edição.)
2. **"Sábado padrão" vira "Encontro padrão" e o título do encontro nasce vazio?** Ou o título nasce com o dia ("Encontro de domingo")?
3. **Vários dias:** cada data vira um encontro independente (cada um com rascunho e equipe própria) ou uma "série" com datas avulsas que se edita junto?
4. **Roteiro em acordeão:** a organização edita tudo ali (nome, duração, quem cuida, ordem), ou o acordeão só mostra e a edição fica numa folha curta?
5. **Aceita mudar a forma dos chips** (de cápsula para retângulo de cantos suaves) no visual aprovado da Direção A, para que estado nunca pareça botão?

---

## 7. Ideias e melhorias

Critérios: público é a liderança, fácil para idosos, **R$ 0 de gasto recorrente**, nada de dado de menor sem decisão jurídica. "Esforço": pequeno (até 1 dia), médio (2 a 4 dias), grande (1 semana ou mais).

### As 5 para fazer primeiro (e por quê)

1. **Compartilhar pelo WhatsApp (ideia 1):** é onde a liderança já vive; resolve "mandar o roteiro e as músicas" sem ensinar nada; pequeno; usa `compartilharTexto` e `expo-sharing`, que já existem.
2. **Modo "Hoje" (ideia 5):** no dia do encontro o líder idoso vê só 3 botões grandes; reduz erro sob pressão, sem tela nova.
3. **Chamar a mesma equipe do último encontro, com escala justa (ideias 2 e 3):** ataca a tarefa mais cara (montar a banda) com dados que a API já devolve (`vezes`, `disponivelNoDia`).
4. **Lembretes silenciosos para o líder (ideia 10):** notificação local (`expo-notifications` já instalado), sem servidor e sem custo; o app "lembra de lembrar".
5. **Pôr na agenda do celular (ideia 22):** um toque e o encontro aparece no calendário do aparelho, com alarme do próprio celular; ajuda muito o idoso, custo zero.

### Lista

**1. Compartilhar roteiro, músicas e equipe pelo WhatsApp.**

- Problema: o líder digita no grupo o que o app já sabe.
- Na tela: no Encontro, "Compartilhar" abre "O que mandar?": Dia e local · Roteiro · Músicas e tons · Quem vai. Texto pronto, com quebras de linha e sem emoji.
- Esforço pequeno. Custo R$ 0. Impacto alto. Risco de burocracia baixo (uma folha, 4 linhas).

**2. "Chamar a mesma equipe do último encontro".**

- Problema: toda semana o líder chama as mesmas 8 pessoas uma a uma.
- Na tela: vazio de Quem vai: "Chamar as mesmas 8 pessoas do último encontro (mesmas funções)" e a lista para desmarcar quem não vai.
- Esforço médio (app chama o lote por função). Custo R$ 0. Impacto alto. Risco baixo.

**3. Escala justa: quem serviu menos aparece primeiro.**

- Problema: os mesmos de sempre ficam sobrecarregados.
- Na tela: na folha de chamar, "Sugeridas" ordenadas por menos vezes nos últimos 2 meses, com "serviu 1 vez em 2 meses" e "pode neste dia".
- Esforço pequeno (a API já manda `vezes`; conferir a janela). Custo R$ 0. Impacto médio. Risco baixo.

**4. A semana numa tela (líder).**

- Problema: com 3 encontros na semana, o Início mostra um.
- Na tela: no Início, abaixo do cartão, "Esta semana": uma linha por encontro com o estado em palavra ("Rascunho", "Faltam 3", "Tudo certo").
- Esforço pequeno a médio. Custo R$ 0. Impacto alto. Risco baixo.

**5. Modo "Hoje".**

- Problema: no domingo de manhã o líder procura o check-in, o ao vivo e as músicas.
- Na tela: de 2 h antes até o fim, o cartão do Início mostra 3 botões grandes empilhados: "Marcar quem chegou", "Conduzir ao vivo", "Músicas do encontro". O resto recolhe.
- Esforço pequeno (o estado já existe em `momento.ts`). Custo R$ 0. Impacto alto. Risco baixo.

**6. Cartaz com QR para imprimir.**

- Problema: o idoso não sabe "abrir link"; aponta a câmera.
- Na tela: Convidar, "Cartaz para imprimir": nome da comunidade, QR do código, 3 passos em letra grande. Compartilhar como imagem ou PDF.
- Esforço médio (precisa de `react-native-view-shot` ou `expo-print`: dependência gratuita, build nativo novo). Custo R$ 0. Impacto médio. Risco baixo.

**7. Copiar com um toque.**

- Problema: endereço, código e link são redigitados.
- Na tela: ao lado do local, do código e do link, "Copiar" com a palavra; toast "Endereço copiado".
- Esforço pequeno (`expo-clipboard` já instalado). Custo R$ 0. Impacto médio. Risco nenhum.

**8. Busca única da liderança.**

- Problema: "onde estava aquela música / aquela pessoa / aquele aviso?".
- Na tela: campo "Buscar" no alto da Comunidade: resultados agrupados (Pessoas, Músicas, Encontros, Avisos), com o que já está carregado.
- Esforço médio (só app, sobre as listas em cache). Custo R$ 0. Impacto médio. Risco médio (pode virar tela de "tudo").

**9. Pedido de troca com sugestão pronta.**

- Problema: quando alguém pede troca, o líder precisa achar substituto.
- Na tela: em "Pedem ajuda", para o líder: "Sugerir alguém" abre a folha de chamar já com a função.
- Esforço pequeno. Custo R$ 0. Impacto médio. Risco baixo.

**10. Lembretes silenciosos para o líder.**

- Problema: o líder esquece de publicar, de lembrar ou de montar as músicas.
- Na tela: nenhuma tela; notificação local na quinta às 19h só se faltar algo ("Sábado Jovem: faltam 3 respostas e as músicas"). Um interruptor em Ajustes de notificação.
- Esforço pequeno a médio (o `AgendadorDoAparelho` já agenda o versículo). Custo R$ 0. Impacto alto. Risco baixo.

**11. Aviso que vira lembrete.**

- Problema: "Ensaio às 15h" é lido na segunda e esquecido no sábado.
- Na tela: no aviso, "Lembrar-me no dia" (notificação local no aparelho de quem tocou).
- Esforço pequeno. Custo R$ 0. Impacto médio. Risco baixo. (Agendar a publicação para todos exige API, fica fora.)

**12. Oração com ciclo de vida à vista.**

- Problema: "Marcar como respondido" está atrás de "Mais"; ninguém fecha o pedido.
- Na tela: para quem pediu, botão "Foi respondido" visível no próprio cartão; depois, "Quer contar como foi?" (opcional, mesmo público do pedido).
- Esforço pequeno (a API já tem `respondido`). Custo R$ 0. Impacto médio. Risco baixo (texto continua fora de log e push).

**13. Letra maior só nesta tela.**

- Problema: o idoso quer ler um aviso ou a letra sem mudar o celular inteiro.
- Na tela: em Aviso, Pedido de oração, Versículo e cifra, botão "Letra maior" (A+ com palavra) que alterna 17, 22 e 28.
- Esforço pequeno. Custo R$ 0. Impacto médio para idosos. Risco baixo.

**14. Ditar em vez de digitar.**

- Problema: digitar título e aviso é difícil para quem tem mão menos precisa.
- Na tela: abaixo de campos longos, a dica "Toque no microfone do teclado para ditar."
- Esforço mínimo (sem dependência: o teclado do sistema já dita). Custo R$ 0. Impacto médio. Risco nenhum.

**15. Contagem de presença sem check-in.**

- Problema: quem não usa o check-in fica com "0 presentes" ou nada.
- Na tela: depois do encontro, "Quantas pessoas vieram?" com um número e "Salvar".
- Esforço médio, **exige API** (campo de contagem no encontro; conferir se já há onde guardar). Custo R$ 0. Impacto médio. Risco médio (mais uma pergunta: só aparece se não houve check-in).

**16. Frequência simples para cuidar das pessoas.**

- Problema: o líder não percebe quem sumiu.
- Na tela: em Relatórios, "Não vêm há 3 encontros: Bruno, Camila" com "Mandar mensagem".
- Esforço médio (usa a presença que já existe). Custo R$ 0. Impacto alto pastoralmente. Risco: privacidade; só liderança, só com check-in feito, e o dono decide (dado de menor: não mostrar menores sem decisão jurídica).

**17. Mensagem direta para a pessoa.**

- Problema: para falar com alguém da lista, o líder sai do app e procura o contato.
- Na tela: na linha da pessoa (Quem vai, Pessoas), "WhatsApp" quando ela cadastrou o número e permitiu.
- Esforço pequeno. Custo R$ 0. Impacto alto. Risco: consentimento (só com o número que a própria pessoa pôs em Editar perfil).

**18. "Aceitar tudo".**

- Problema: quem tem 2 papéis no mesmo encontro responde duas vezes.
- Na tela: "Você vai tocar violão e cantar. Aceitar os dois?" com um botão.
- Esforço pequeno (app em laço). Custo R$ 0. Impacto médio. Risco nenhum.

**19. Escala do mês para o mural da igreja.**

- Problema: muitas igrejas ainda imprimem quem serve em cada domingo.
- Na tela: Agenda, "Compartilhar o mês": texto ou imagem com data, encontro e quem serve em cada função.
- Esforço médio (texto: pequeno; imagem: dependência gratuita da ideia 6). Custo R$ 0. Impacto médio. Risco baixo.

**20. Músicas com "tocada há 2 semanas".**

- Problema: o regente repete as mesmas músicas sem perceber.
- Na tela: na folha "Adicionar músicas", ao lado do título, "tocada em 15/11".
- Esforço médio, **exige API** (última vez tocada, já anotada como pendência em D71). Custo R$ 0. Impacto médio. Risco baixo.

**21. Lista de tarefas que se repete.**

- Problema: "levar o projetor", "comprar o lanche" são escritos toda semana.
- Na tela: a Preparação vai junto no "Igual ao último" (marcar "Levar a lista de tarefas").
- Esforço pequeno a médio (conferir se a cópia leva tarefas; se não, **API**). Custo R$ 0. Impacto médio. Risco: a lista crescer; manter dobrada.

**22. Pôr na agenda do celular.**

- Problema: o idoso confia no calendário do celular, não no app.
- Na tela: no Encontro, "Pôr na agenda do celular": gera um arquivo de calendário e abre o compartilhar do sistema.
- Esforço pequeno a médio (texto `.ics` e `expo-sharing`, já instalado). Custo R$ 0. Impacto alto para idosos. Risco nenhum.

**23. Resumo de domingo à noite.**

- Problema: o líder não sabe por onde começar a semana.
- Na tela: notificação local no domingo às 20h: "Semana: 2 encontros. Falta publicar o de sábado." Toque abre a semana (ideia 4).
- Esforço pequeno, depende das ideias 4 e 10. Custo R$ 0. Impacto médio. Risco: cansar; um por semana, com interruptor.

**Fora de propósito (anotado para não voltar):** aniversariantes (exige data de nascimento e decisão jurídica sobre menores), leitura em voz alta com voz sintetizada (dependência nova e pouco ganho sobre o leitor de tela do sistema), widget de tela inicial (trabalho nativo grande), qualquer serviço de SMS ou e-mail em massa (custo recorrente).
