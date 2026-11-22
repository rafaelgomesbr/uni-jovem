# APIs novas do app v3

Data: 22/11/2026. Decisão D66 em [../../DECISOES.md](../../DECISOES.md); migração `0028` (só funções, sem tabela nova); sem permissão nova (a matriz não mudou). Tipos e chamadas prontos para as telas em `apps/app/src/servicos/contratoV3.ts` (objeto `chamadasV3`).

Convenções que valem em todas:

- Base das rotas de comunidade: `/api/v1/c/:comunidadeId`. Todas exigem sessão e vínculo ativo na comunidade do caminho; sem vínculo, comunidade de outra pessoa ou id de outra comunidade: **404** (nunca 403). Membro sem a permissão: **403** `sem_permissao`. Comunidade suspensa: escrita dá **409** `comunidade_suspensa`.
- Erros vêm como `{ erro, mensagem }`, com a mensagem pronta para a tela (português, sem termo técnico). Corpo inválido: **400** `dados_invalidos`.
- Datas e horas em ISO 8601. `data` é `AAAA-MM-DD` e `hora` é `HH:MM`, no fuso do encontro.
- **Desfazer com espera de 10 s é do app, não do servidor.** Rotas que avisam pessoas (publicar, convocar em lote, lembrar) são chamadas só depois dos 10 s; se o app fechar antes, nada saiu. Nenhuma rota de "cancelar envio" existe nem é necessária.

## Resumo

| Rota                                                                | Permissão                                             | Para que serve                                               |
| ------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| `GET /c/:id/inicio` (campo novo `momento`)                          | `evento.ler` (todo membro)                            | Cartão do momento do Início                                  |
| `GET /c/:id/eventos/anteriores-para-copiar`                         | `evento.criar` (organizador, administrador)           | "Igual ao último sábado": de onde copiar e a data sugerida   |
| `POST /c/:id/eventos/:eventoId/copiar`                              | `evento.criar` e `escala.atribuir`                    | Cria o rascunho copiado, com a equipe aguardando resposta    |
| `POST /c/:id/eventos/:eventoId/atribuicoes/lote`                    | `escala.atribuir`                                     | Convocar várias pessoas de uma vez                           |
| `GET /c/:id/eventos/:eventoId/sugestoes-de-convocacao?funcao=`      | `escala.atribuir`                                     | Quem convocar para uma função                                |
| `POST /c/:id/eventos/:eventoId/lembrar-pendentes`                   | `escala.atribuir`                                     | "Lembrar os N" (quem não respondeu)                          |
| `GET /c/:id/mural`                                                  | `aviso.ler` (todo membro)                             | Aba Comunidade: aviso à vista, "3 novos", pessoas            |
| `GET /eu/notificacoes/caixa` (campos novos) e `.../caixa/nao-lidas` | sessão                                                | Sino com título real e quebra por assunto                    |
| `POST /api/auth/codigo/previa`                                      | pública (sem sessão)                                  | Prévia da comunidade ao digitar o código                     |
| `GET /c/:id/eventos/:eventoId/repertorio/pacote`                    | `evento.ler_pacote_offline` e tocar no encontro       | Modo palco e uso sem internet                                |
| `PUT /c/:id/conteudos/musicas/:musicaId/pdf` (D76, migração 0029)   | `conteudo.gerenciar` (organizador)                    | Anexar ou trocar o PDF da música                             |
| `GET /c/:id/conteudos/musicas/:musicaId/pdf` (D76)                  | `conteudo.ler` (todo membro)                          | Baixar o PDF da música, com ETag                             |
| `DELETE /c/:id/conteudos/musicas/:musicaId/pdf` (D76)               | `conteudo.gerenciar` (organizador)                    | Remover o PDF da música                                      |
| `GET /c/:id/eventos/limpar-proximos` (D77, migração 0030)           | `evento.limpar_proximos` (organizador, administrador) | Contar o que a limpeza alcança                               |
| `POST /c/:id/eventos/limpar-proximos` (D77)                         | `evento.limpar_proximos`                              | Apagar sem avisar ou cancelar e avisar os próximos encontros |
| `POST /c/:id/excluir` (D77, ADR 0009)                               | `comunidade.excluir` (só administrador)               | Pedir a exclusão da comunidade (30 dias de carência)         |
| `POST /c/:id/exclusao/desfazer` (D77)                               | `comunidade.desfazer_exclusao` (só administrador)     | Desfazer a exclusão dentro da carência                       |
| `GET /eu/comunidades-em-exclusao` (D77)                             | sessão (só aparecem as que a pessoa administra)       | Lista "Em exclusão" com a data                               |

## `GET /c/:id/inicio`: campo `momento`

Os campos de antes (`proximosEventos`, `minhasEscalas`, `minhasTarefas`, `substituicoesAbertas`, `avisos`) não mudaram. O campo novo:

```
momento: {
  agora,                                // ISO do servidor
  evento: {                             // o que está acontecendo ou o próximo; null = "nada marcado"
    id, titulo, categoria, inicio, fim, duracaoMin, fuso,
    status,                             // 'publicado' | 'adiado' | 'rascunho' (rascunho só para a organização)
    visibilidade,                       // 'interna' | 'publica'
    musicas,                            // quantas músicas tem o repertório (qualquer papel; só a contagem, D73)
    local: { nome, tipo, endereco, latitude, longitude, referencia } | null
  } | null,
  estado: 'longe' | 'vespera' | 'no_dia' | 'acontecendo' | null,
  minutosParaInicio: number | null,     // negativo = já começou
  suaParte: [{ atribuicaoId, funcao, etapaTitulo, estado }],   // a pendência primeiro; [] = a linha some
  inscricao: { situacao, inscritos, capacidade } | null,
    // situacao: 'inscrito' | 'espera' | 'aberta' | 'fechada' | 'nao_se_aplica'
    // 'aberta' só em encontro público ou com vagas contadas; inscritos é null para membro
  lider: {                              // só organizador e administrador; senão null
    convocados, confirmados, recusaram, pendentes,
    responderam,                        // "9 de 11 responderam" = convocados menos pendentes
    faltamResponder: [{ vinculoId, nome, funcoes }],   // até 4
    faltamResponderTotal,
    faltaFuncao: ['Bateria'],           // "Falta: bateria"
    musicas, inscritos, presentes,
    lembraveis,                         // "Lembrar os 2" (já sem quem foi lembrado nas últimas 24 h)
    avisariaAoPublicar                  // "Publicar e avisar 11 pessoas"
  } | null,
  recemTerminado: { id, titulo, inicio, fim, fuso, presentes, euServi } | null,
    // terminou há menos de 24 h; presentes é null para membro; euServi = tinha parte confirmada
  proximoAMarcar: boolean | null        // organização: nada marcado depois deste encontro; membro: null
}
```

Regras: `estado` usa o relógio de parede do fuso do encontro (véspera = o dia seguinte; no dia = o mesmo dia, antes da hora); o **ao vivo vence o relógio** (encontro iniciado e não encerrado segue `acontecendo`, mesmo estourando o horário; encerrado sai do cartão e vira `recemTerminado`). Quem está acontecendo vem antes do próximo. Rascunho só aparece para a organização (RLS). Primário por estado, textos e etiquetas ("EM 5 DIAS", "AMANHÃ") são do app, a partir de `estado`, `minutosParaInicio`, `suaParte` e `lider`. Nada de oração, música ou cifra aqui.

## `GET /c/:id/eventos/anteriores-para-copiar`

Até 3 encontros já realizados (publicados e terminados), **um por título**, o mais recente primeiro (o pré-marcado).

Resposta:

```
{ opcoes: [{ eventoId, titulo, inicio, fuso, duracaoMin, etapas, convocados, musicas,
             dataSugerida, horaSugerida, inicioSugerido }] }
```

`convocados` conta só pessoas ainda ativas. `dataSugerida` é o mesmo dia da semana da origem, depois de hoje, sem outro encontro do mesmo título naquele dia. Sem encontro realizado: `opcoes: []` (o app cai em "Modelo" ou "Em branco"). Erros: 403 membro.

## `POST /c/:id/eventos/:eventoId/copiar`

Corpo (tudo opcional): `{ data?: 'AAAA-MM-DD', hora?: 'HH:MM', incluirMusicas?: boolean }`. Sem `data`, vale a sugerida; sem `hora`, a da origem; `incluirMusicas` começa em `false`.

Cria um **rascunho**. Copia: título, descrição, categoria, duração, local, vagas, lista de espera, visibilidade e informações úteis (não o prazo de inscrição); roteiro na mesma ordem; checklist sem marcações; tarefas sem prazo e sem conclusão; materiais sem "providenciado"; e a **equipe como `pendente`**, só de quem ainda é ativo, com a etapa certa. Músicas só com `incluirMusicas` (arquivada não vai). **Ninguém é avisado**: a convocação sai quando o encontro é publicado (`POST /eventos/:eventoId/status` com `publicado`, que já existe).

Resposta:

```
{ id, versao, status: 'rascunho', inicio, fuso,
  resumo: { origem: { id, titulo, inicio }, etapas, duracaoTotalMin, checklist, tarefas, materiais,
            convocados: { pessoas, itens: [{ atribuicaoId, vinculoId, nome, funcao, etapaTitulo }] },
            naoCopiados,                   // gente que saiu da comunidade
            indisponiveis: [{ vinculoId, nome, funcao }],   // "Bruno avisou que não pode neste dia"
            musicas: { copiadas, naOrigem },
            avisariaAoPublicar } }
```

Erros: 400 `data_no_passado` (data e hora já passaram), 400 data ou hora mal formadas, 403 membro, 404 encontro de origem inexistente ou de outra comunidade. Auditoria: `evento.copiado` com ids e contagens. "Trocar" uma pessoa na conferência usa `DELETE /eventos/:eventoId/atribuicoes/:atribuicaoId` e a rota de lote abaixo.

## `POST /c/:id/eventos/:eventoId/atribuicoes/lote`

Corpo: `{ funcao: string (2 a 60), etapaId?: uuid | null, vinculoIds: uuid[] (1 a 30) }`. Uma transação só: todas ou nenhuma.

Resposta: `{ criadas: [{ id, vinculoId, estado: 'pendente' }], jaConvocadas: [vinculoId] }`. Quem já estava convocado na mesma combinação de **bloco (etapa ou encontro inteiro) e função** não é duplicado (a comparação ignora acento e caixa; "voz" e "Vocal" são a mesma da banda). A mesma pessoa em **outro bloco** ou com **outra função** é permitida (D73): quem serve o encontro inteiro também pode tocar no louvor, e quem toca violão também pode cantar. Em encontro **publicado**, cada pessoa criada recebe a convocação pelos gatilhos de sempre; em **rascunho**, ninguém é avisado ainda.

Erros: 400 corpo inválido (lista vazia, mais de 30, função curta, id que não é uuid); 403 membro; 404 encontro de outra comunidade, etapa de outro encontro, ou **qualquer** pessoa que não seja ativa nesta comunidade (o lote inteiro cai, nada é gravado). Auditoria: `escala.convocadas_em_lote` com contagens.

## `GET /c/:id/eventos/:eventoId/sugestoes-de-convocacao?funcao=Bateria&etapaId=`

`funcao` é obrigatória (2 a 60). `etapaId` é opcional: `geral` (encontro inteiro) ou o id da etapa onde a pessoa serviria; com ele, `jaConvocadas` só traz quem já está **nesse bloco** com a função (D73). Sem ele, vale qualquer bloco, como antes. Resposta:

```
{ funcao, data: 'AAAA-MM-DD',
  sugeridas: [{ vinculoId, nome, vezes, ultimaVez, disponivelNoDia }],   // até 10
  indisponiveis: [{ vinculoId, nome }],      // avisaram que NÃO podem neste dia
  jaConvocadas: [vinculoId] }                // já estão nesta função (e neste bloco, se etapaId veio)
```

Ordem: serviu na função e informou que pode no dia; serviu na função (mais vezes, mais recente primeiro); só informou que pode. Considera os 12 meses anteriores, só encontros publicados que já passaram, e **não conta recusa**. "voz" e "Vocal", "violao" e "Violão" são a mesma função; funções livres ("Recepção") comparam por texto sem acento nem caixa. Quem informou que não pode **nunca** está em `sugeridas`. `disponivelNoDia` é `true` ou `null`. Erros: 400 sem `funcao`; 403 membro; 404 encontro de outra comunidade (o 404 vem antes do 400).

## `POST /c/:id/eventos/:eventoId/lembrar-pendentes`

Sem corpo. Enfileira **uma notificação genérica por pessoa** com convocação pendente ("Falta responder" / "Você ainda não respondeu a uma convocação. Abra o app para responder."; sem nome, título, função nem data). Regras no banco: no máximo **uma por pessoa e por encontro a cada 24 h**; respeita a preferência "Escalas", vínculo ativo, cota diária e deduplicação de 1 h; quem pede não é avisado nem contado.

Resposta: `{ pendentes, lembradas, jaLembradas }`: pessoas pendentes, lembretes que entraram na fila agora e pessoas lembradas nas últimas 24 h (esperam). Botão: `Lembrar os {lembraveis}` do `momento.lider.lembraveis`; depois, `✓ Lembrete enviado`.

Erros: 403 membro; 404 encontro de outra comunidade; 409 `encontro_fora_do_ar` (rascunho, cancelado ou já terminado). Auditoria: `convocacao.lembrete_enviado` com contagens.

## `GET /c/:id/mural`

Aba Comunidade, numa chamada só. Resposta:

```
{ avisos: { total, destaque: { id, titulo, fixado, publicadoEm } | null },
  oracao: { novos },
  pessoas: { total },
  organizacao: { pedidosDeEntrada } | null }
```

`destaque` é o aviso fixado, ou o mais recente publicado e não vencido (só id e título: o texto está em `GET /avisos/:id`). `oracao.novos` é **só um número**: pedidos de outras pessoas que ela já pode ver, não respondidos, dos últimos 7 dias, em que ela ainda não marcou "Estou orando" (a RLS decide o que ela vê; bloqueio, equipe de oração e "só eu" valem). `organizacao` é `null` para membro.

## Sino: `GET /eu/notificacoes/caixa` e `/caixa/nao-lidas`

Cada item da caixa ganhou dois campos (os de antes não mudaram):

- `assunto: string | null`: o **título real** do aviso ou do encontro (`Ensaio do louvor às 15h`, `Sábado Jovem`). É `null` quando não há (pedido de entrada), quando o aviso saiu do ar ou venceu, quando é de autor que a pessoa bloqueou, ou quando o encontro é rascunho. `titulo` e `texto` seguem genéricos, como saem na tela bloqueada. Nunca há pedido de oração, música ou pessoa nesse campo.
- `eventoId: string | null`: o encontro a que a notificação se refere (convocação, lembrete, cancelamento), para o toque abrir "Sua parte".

`nao-lidas` agora devolve `{ naoLidas, avisos, convocacoes, pedidosDeEntrada }`. As três quebras são partes do mesmo conjunto de `naoLidas` (convocações = "Nova convocação" e "Falta responder"). Agrupar ("4 avisos novos") é do app.

## `POST /api/auth/codigo/previa` (pública)

Corpo: `{ codigo }` (como a pessoa digita: minúsculo, com espaço ou traço). Sem sessão (`autenticado: false` no cliente).

Resposta:

```
{ comunidade: { nome, cor, temLogo, pessoas, modoEntrada: 'codigo_direto' | 'codigo_com_aprovacao',
                proximoEncontro: { titulo, inicio, fuso } | null } }
```

Só o que `entrar_por_codigo` já revelaria. `proximoEncontro` só se for **público**, publicado, futuro e de comunidade verificada. Não há cidade, id, administrador nem contato; o logotipo não sai (só `temLogo`: o app usa a cor e as iniciais até entrar). **Mesmo 404** (`nao_encontrado`, "Não encontramos esta comunidade. Confira o código com quem passou para você.") para código desconhecido, mal formado, trocado, de comunidade suspensa ou que não entra por código. Limite por IP: 20 por 15 min, depois **429** `muitas_tentativas` com `Retry-After`. Não grava nada.

## `GET /c/:id/eventos/:eventoId/repertorio/pacote`

Fatia 2 do modo músico: o repertório do encontro inteiro, para o aparelho guardar no cofre cifrado e abrir sem internet (Modo palco). Resposta:

```
{ versao, geradoEm, validoAte, validadeDias,
  evento: { id, titulo, inicio, fuso, status },
  minhaParte: [{ funcao, estado }],
  itens: [{ id, ordem, musicaId, tomDoDia, nota, titulo, artista, tomOriginal,
            andamentoBpm, duracaoSeg, link, cifra }] }
```

- **Quem recebe:** organizador, administrador e quem tem convocação de louvor **não recusada** neste encontro (etapa Louvor, ou função de banda como Bateria). Outro membro: **403** `fora_do_louvor` (a lista sem cifra segue em `GET .../repertorio`). Rascunho: só a organização; para quem toca, 404.
- **Versão:** `versao` é uma impressão digital do conteúdo e vai também no cabeçalho `ETag`. Mandar `If-None-Match` (ou `?versao=<a que já tem>`) igual recebe **304** sem corpo (ou `200 { versao, inalterado: true }` com a consulta), sem a cifra trafegar de novo. Mudar tom do dia, ordem, cifra ou música muda a versão; chamar de novo sem mudar nada, não.
- **Validade:** `validoAte` usa `validade_offline_dias` da comunidade, a mesma do pacote do encontro. O `pacote-offline` do encontro não mudou e **continua sem cifra**.
- **Direitos autorais:** só dentro da comunidade, `Cache-Control: no-store`, leitura não auditada, cifra nunca em log. O aparelho guarda no mesmo cofre cifrado do pacote e apaga junto (saída da comunidade, troca de conta).

## PDF da música: `PUT`, `GET` e `DELETE /c/:id/conteudos/musicas/:musicaId/pdf` (D76)

Migração `0029_pdf_da_musica.sql` (tabela `uj.musica_pdfs`, `bytea` no Postgres, sem armazenamento externo). Tipos e chamadas no app: `apps/app/src/servicos/contratoDoPdf.ts`. Código: `apps/api/src/rotas/musica-pdf.ts`.

- **Enviar:** `PUT .../pdf?nome=<arquivo.pdf>&direitosConfirmados=true`, **corpo bruto** (`Content-Type: application/pdf`), sem multipart. Sessão, comunidade, papel e cota (30 por hora e conta) são conferidos **antes** de o corpo ser lido. Resposta `200 { temPdf: true, pdf: { nome, tamanho, versao } }`; `versao` é o SHA-256 do arquivo em hexadecimal, calculado no banco.
- **Erros:** **404** `nao_encontrado` (música de outra comunidade, id inválido; vem antes de qualquer conferência do corpo); **400** `direitos_nao_confirmados` (sem `direitosConfirmados=true`; o gatilho UJ100 do banco é a segunda camada); **415** `arquivo_nao_e_pdf` (tipo diferente de `application/pdf`, corpo vazio ou que não começa com `%PDF-` e um número de versão); **413** `grande_demais` (acima de **10 MB**, o mesmo teto do CHECK do banco); **403** (membro); **409** `comunidade_suspensa`.
- **O servidor não abre o PDF:** só confere a assinatura e o tamanho e grava os bytes como vieram. O nome vira só o último pedaço do caminho, sem caracteres de controle nem de direção de texto, até 120 letras, terminando em `.pdf`.
- **Ler:** `GET .../pdf` responde os bytes com `Content-Type: application/pdf`, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-cache` e `ETag` (o SHA-256). `If-None-Match` igual recebe **304** sem corpo. Sem PDF: **404**. O app baixa com o token no cabeçalho (nunca por endereço aberto no navegador) e entrega os bytes ao visualizador.
- **Remover:** `DELETE .../pdf` responde `200 { temPdf: false, pdf: null }`, também quando já não havia PDF (idempotente); música de outra comunidade: 404.
- **Um PDF por música:** enviar de novo troca o arquivo (e a versão). Apagar a música apaga o PDF.
- **Indicadores sem bytes, em quem já devolvia a música:** `GET .../conteudos/musicas` e `.../musicas/:id`, `GET .../eventos/:eventoId/repertorio`, `GET .../meu-repertorio` e `GET .../repertorio/pacote` trazem `temPdf` (boolean) e `pdf` (`{ nome, tamanho, versao }` ou `null`). No pacote o PDF vai **por referência**: a `versao` do pacote muda quando o PDF muda, e o aparelho baixa o binário só se a versão guardada for outra (`If-None-Match` com a versão que tem, 304 se igual).
- **Log e auditoria:** só o id da música (`conteudo.pdf_anexado`, `conteudo.pdf_trocado`, `conteudo.pdf_removido`). Nome e conteúdo nunca vão a log, auditoria nem log de mudanças; o nome viaja na consulta, que o registro técnico descarta.
- **Permissão nova:** nenhuma (`conteudo.gerenciar` e `conteudo.ler`); `docs/matriz-permissoes.md` não mudou. Inventário do isolamento: 3 rotas novas em `isolamento.test.ts`.

## Limpar os próximos encontros: `GET` e `POST /c/:id/eventos/limpar-proximos` (D77)

Migração `0030_limpar_encontros_e_excluir_comunidade.sql` (função de leitura `uj.resumo_dos_proximos_encontros`). Tipos no app: `apps/app/src/servicos/contratoDaExclusao.ts`. Código: `apps/api/src/rotas/eventos.ts`. "Próximos" é tudo que ainda não começou (`inicio > now()`), em qualquer situação.

- **`GET`:** `200 { total, rascunhos, publicados, adiados, cancelados, encerrados, pessoasAAvisar, repeticoesAtivas }`. `pessoasAAvisar` conta só quem receberia o aviso de cancelamento de fato (vínculo e conta ativos, sem ter desligado esse tipo de aviso) e não conta quem está limpando. `repeticoesAtivas` são as séries que seguem criando encontros depois.
- **`POST`:** `{ modo: 'apagar' | 'cancelar_e_avisar', confirmo: true, totalEsperado, motivo? }`. `apagar` apaga tudo e **não avisa ninguém** (o aviso nasce da mudança de status no gatilho do banco; apagar não muda status). `cancelar_e_avisar` apaga os rascunhos e cancela os publicados e adiados com `motivo` (padrão "Agenda reorganizada pela liderança."), que avisa como o cancelamento de sempre; os já cancelados ficam como estão. Resposta `200 { ok, modo, apagados, cancelados, pessoasAvisadas }`.
- **Seguro e idempotente:** sem nada a limpar responde `200` com zeros. Se o total mudou desde a contagem que a pessoa viu (`totalEsperado`), **409** `agenda_mudou` e nada é alterado. Sem `confirmo: true` ou sem modo: 400.
- **Permissão nova:** `evento.limpar_proximos`, a partir de organizador (a soma de `evento.excluir` e `evento.cancelar_ou_adiar`, que já são dele). Membro: 403; outra comunidade: 404 com os dados intactos.
- **Auditoria:** `evento.proximos_limpos`, só com o modo e as contagens. Nenhum título.

## Excluir a comunidade (D77, ADR 0009)

Migração 0030: tabelas `uj.exclusoes_de_comunidade` (quem pediu) e `uj.ciclos_de_vida_autorizados` (sem privilégio para o aplicativo), funções `agendar_exclusao_da_comunidade`, `desfazer_exclusao_da_comunidade` e `minhas_comunidades_em_exclusao`, e o gatilho `guardar_comunidade` com a exceção por transação marcada.

- **`POST /c/:id/excluir`** `{ nome, confirmo: true }`: só administrador (outros papéis 403; outra comunidade 404; suspensa 409). O `nome` é o que a pessoa leu na tela: se a comunidade foi renomeada, **422** `confirmacao_necessaria`. Resposta `200 { ok, estado: 'exclusao_agendada', apagadaEm }` (30 dias depois). A comunidade some das listas, nenhuma rota dela responde mais (404 para todos) e os demais vínculos recebem um aviso genérico, sem o nome. Repetir depois de agendada: 404.
- **`POST /c/:id/exclusao/desfazer`:** `200 { ok, estado: 'ativa' }`. Só a administração desta comunidade, só dentro da carência e só se o pedido foi da própria administração; qualquer outro caso é **404**. Os demais vínculos são avisados de que a exclusão foi desfeita.
- **`GET /eu/comunidades-em-exclusao`:** `200 { comunidades: [{ id, nome, apagadaEm, pedidaEm }] }`, só as que a pessoa pode desfazer.
- **Apagar de vez:** a rotina diária de retenção (`uj.excluir_comunidades_vencidas`, 0019) ao fim dos 30 dias. As contas das pessoas continuam; a auditoria que sobra não identifica ninguém.
- **Permissões novas:** `comunidade.excluir` e `comunidade.desfazer_exclusao` (só administrador); `docs/matriz-permissoes.md` regenerado. Inventário do isolamento: 4 rotas novas em `isolamento.test.ts` (a administração de A em B recebe 404 e B segue intacta, inclusive o estado).

## O que não foi criado, e por quê

- **Envio com espera e "Desfazer" no servidor:** não é preciso; é só do app (acima).
- **Histórico "tocada há 2 semanas":** é a fatia 3 do modo músico; fica para depois.
- **Rota própria para recusar e aceitar com desfazer:** `POST /atribuicoes/:id/confirmar` e `/recusar` já existem; o desfazer é segurar a chamada por 10 s. Depois de enviada, aceitar de novo ou recusar de novo funciona (o estado pode mudar de recusada para confirmada).
- **Permissão nova:** nenhuma nas rotas acima (a limpeza e a exclusão da comunidade, D77, criaram as suas, descritas nas seções delas). As rotas usam `evento.criar`, `escala.atribuir`, `aviso.ler`, `evento.ler_pacote_offline` e a regra de "toca neste encontro". O PDF da música (D76) também não criou permissão.
