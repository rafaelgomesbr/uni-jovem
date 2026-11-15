# ADR 0007: App aberto, comunidades criadas por qualquer pessoa ("livre com rodinhas")

- **Estado:** aceita
- **Data:** 15/11/2026
- **Decisão do dono:** "quero deixar o app aberto e público pra não precisar de convite"; aprovou a proposta "livre com rodinhas" e a busca só para quem escolher aparecer. Substitui partes da ADR 0004 (as três políticas continuam separadas; mudam os valores).

## Decisão

As três chaves da ADR 0004 mudam de valor, sem misturar as perguntas:

1. **Quem cria conta** (`PoliticaDeConta`): `cadastro_publico`. Conta é sempre de uma pessoa, nunca da igreja. Entra por e-mail e senha (código de 6 dígitos por e-mail), Google ou Apple. Google e Apple **passam a criar conta** quando o e-mail não existe, depois da declaração de idade (16 anos ou mais, D27) e dos aceites (termos e privacidade). Conta nova não tem vínculo nenhum.
2. **Quem cria comunidade** (`PoliticaDeComunidade`): `livre_com_limites`. Qualquer conta com e-mail confirmado cria comunidade e vira **admin** dela, depois de aceitar o **termo do administrador da comunidade** (TC novo, versionado). A comunidade nasce com `verificacao = 'nova'`.
3. **Como se entra** (`comunidades.modo_entrada`): `convite`, `codigo_com_aprovacao` (padrão das comunidades novas) ou `codigo_direto`. `livre` (sem código) continua não habilitado.

**Rodinhas (comunidade `nova`):** até 30 vínculos ativos; evento público (página de inscrição) recusado; uma comunidade `nova` por conta de cada vez e até 3 comunidades criadas por conta. O Criador verifica no painel da Plataforma (`verificacao = 'verificada'`, selo "Verificada"); os limites somem. Desverificar volta os limites sem apagar nada.

**Cargos:** quem cria é admin; quem entra por código ou pedido aceito é membro; convite entra com o papel do convite; promoção só por admin (ADR 0006). Ninguém pede cargo. O Criador continua fora das comunidades.

**Busca:** só comunidades `ativa` com `encontravel = true` (padrão `false`), por nome e cidade (mínimo 3 letras, até 20 resultados). Mostra nome, cidade, cor, logotipo e o selo; nunca membros nem contagem. Pedido de entrada leva mensagem curta.

**Pedidos de entrada:** admin e organizador aceitam ou recusam; aceitar cria vínculo de membro. Quem pediu vê "Pendente", "Aceito" ou "Não aprovado", nunca quem decidiu. Até 3 pedidos pendentes por conta; 30 dias de espera depois de uma recusa na mesma comunidade. Notificações pelo sino (D42): novo pedido para admin e organizadores; decisão para quem pediu. Texto genérico, sem a mensagem do pedido.

**Código da comunidade:** 8 caracteres aleatórios sem ambiguidade (sem 0/O/1/I), guardado como HMAC como o convite, mostrado ao admin com QR e link `https://<host>/entrar/<codigo>`; o admin troca o código quando quiser (o antigo deixa de valer). Código desconhecido responde 404 com limite por IP.

**Denúncia de comunidade:** qualquer conta denuncia uma comunidade encontrada na busca ou da qual participa; vai para a fila da Plataforma.

**Código do autenticador (revisa D12 e D31):** criar comunidade **não** pede o código. Pedem: suspender, arquivar e excluir comunidade, intervir em comunidade de outra pessoa, transferir a plataforma e excluir a conta do Criador. Verificar e desverificar comunidade não pedem (não destroem nada, são auditados).

**Logotipo e identidade:** o admin da comunidade troca nome, cor, cidade e logotipo em Configurações (D33), com caminho visível a partir da aba Equipe.

## Contrato da API (novo ou alterado)

Conta:

- `POST /api/auth/cadastro/iniciar` `{ nome, email, faixaEtaria, aceites, turnstile? }` → envia o código (resposta igual para e-mail novo ou existente).
- `POST /api/auth/cadastro/concluir` `{ email, codigo, senha }` → cria a conta sem vínculo e abre a sessão (mesmo formato de `SessaoAberta`). E-mail já cadastrado: mensagem para entrar ou recuperar a senha.
- Google e Apple: a rota existente devolve `{ cadastroPendente: true, tokenDeCadastro, nome, email }` quando a conta não existe; `POST /api/auth/provedor/concluir-cadastro` `{ tokenDeCadastro, faixaEtaria, aceites }` cria e abre a sessão. O token vale 15 minutos e uma vez.

Comunidades (fora de `/c/:id`, conta autenticada):

- `POST /api/v1/comunidades` `{ nome, cor, cidade?, aceiteDoTermoDoAdmin: true }` → `{ id, ... }`; 403 humano sem e-mail confirmado; 409 humano acima dos limites.
- `GET /api/v1/comunidades/busca?q=&cidade=` → `[{ idPublico, nome, cidade, cor, temLogo, logoVersao, verificada, modoEntrada }]`.
- `POST /api/v1/entrada` `{ codigo, mensagem? }` → `{ resultado: 'membro' | 'pedido_pendente', comunidade: { id?, nome } }`.
- `POST /api/v1/comunidades/:idPublico/pedidos` `{ mensagem? }` (pela busca) → mesmo formato.
- `GET /api/v1/eu/pedidos` e `DELETE /api/v1/eu/pedidos/:pedidoId`.
- `POST /api/v1/comunidades/:idPublico/denuncias` `{ motivo, detalhe? }`.

Dentro da comunidade (`/api/v1/c/:comunidadeId/...`, inventário de isolamento, 404 entre comunidades):

- `GET .../pedidos?estado=pendente` e `POST .../pedidos/:pedidoId/aceitar|recusar` (admin e organizador).
- `GET .../codigo` e `POST .../codigo/trocar` (admin): `{ codigo, link }`.
- Configurações aceitam `modoEntrada`, `encontravel` e `cidade`; o detalhe da comunidade devolve `verificacao`, limites e uso.

Plataforma (Criador):

- `GET /api/v1/plataforma/comunidades?verificacao=nova|verificada|todas&busca=&cursor=` → nome, cidade, criada em, quem criou (nome e e-mail do admin criador), membros, denúncias abertas, estado e verificação.
- `POST /api/v1/plataforma/comunidades/:id/verificar` e `/desverificar` (sem código do autenticador, auditados).
- `GET /api/v1/plataforma/denuncias-de-comunidade` e `POST .../:id/resolver`.
- `POST /api/v1/plataforma/comunidades` (criação pelo Criador) deixa de pedir o código.

## Consequências

- **LGPD:** cada comunidade passa a responder pelos dados dos próprios membros (controladora) e a plataforma vira operadora dessa parte; o termo do administrador registra isso e as páginas legais são ajustadas. A revisão jurídica (PH-11) passa a cobrir o termo.
- **Idade:** 16 anos ou mais por autodeclaração, como hoje (D27). Com cadastro aberto, o ECA Digital pede aferição mais robusta: fica registrado como risco para a revisão jurídica.
- **E-mail:** o cadastro por e-mail gasta da cota gratuita do Resend (100 por dia); Google e Apple não gastam. Enquanto o e-mail estiver desligado (PH-03), o cadastro por e-mail fica indisponível e a tela oferece Google e Apple.
- **Lojas:** a ficha deixa de dizer "só por convite"; o revisor pode criar conta própria, e a conta de demonstração continua.

## Alternativas rejeitadas

- **Pedido aprovado pelo Criador para cada comunidade:** o dono vira o gargalo de cada igreja nova.
- **Livre total, sem limites:** porta aberta para comunidade falsa e spam, e a Apple cobra moderação (diretriz 1.2).
- **Lista pública de todas as comunidades:** expõe quais igrejas usam o app e atrai pedidos aleatórios.

## Contrato implementado na API (15/11/2026)

Migração `0022_app_aberto.sql`; rotas em `apps/api/src/rotas/abertura.ts`, `autenticacao.ts`, `comunidades.ts`, `plataforma.ts`, `imagens.ts` e `privacidade.ts`. Tudo o que está acima vale como escrito; abaixo, o que a API acrescentou ou precisou fixar (decisões D47 a D53).

Conta:

- `POST /api/auth/cadastro/iniciar`: `aceites` é `{ termos: true, responsavelCiente?: boolean }` (TC-02; para `16_17`, `responsavelCiente: true` é obrigatório). Aceita também `plataforma?` (`web` liga o Turnstile, como a presença do cabeçalho `Origin`). Resposta 200 `{ ok: true, mensagem }`, igual para e-mail novo ou existente. Erros: 422 `menor_de_16` (nada gravado), 422 `responsavel_necessario`, 503 `cadastro_indisponivel`, 403 `verificacao_humana`, 429.
- `POST /api/auth/cadastro/concluir`: aceita também `aparelho?` e `plataforma?` (padrão `ios`; **a web precisa mandar `plataforma: 'web'`** para o refresh ir em cookie). Erros: 410 `codigo_vencido`, 422 `codigo_invalido`, 422 `senha_fraca`, 409 `conta_existente` (só depois do código certo).
- `POST /api/auth/provedor/:provedor` aceita `nome?` (a Apple só entrega o nome ao app). `cadastroPendente.nome` pode vir `null`.
- `POST /api/auth/provedor/concluir-cadastro` aceita `nome?`. Erros: 410 `token_de_cadastro_invalido` (vencido ou usado), 422 `menor_de_16` (o token não é gasto), 409 `conta_existente`.
- `POST /api/v1/eu/excluir-conta` aceita, no lugar de `senha`, `{ provedor: 'google', idToken }` ou `{ provedor: 'apple', identityToken, nonce }`: um token novo da conta do provedor ligada à conta (D50).

Comunidades:

- `POST /api/v1/comunidades` exige também `consentimentoFe: true` (TC-03.v3 na forma de criação) e aceita `fuso?`. Resposta: `{ id, nome, cor, cidade, verificacao, modoEntrada, encontravel, codigo, link }`. Erros: 403 `email_nao_confirmado`, 403 `idade_para_criar` (menos de 18, D48), 409 `limite_de_comunidades_novas`, 409 `limite_de_comunidades`.
- `GET /api/v1/comunidades/busca` devolve o array, como escrito acima; 400 `busca_curta` com menos de 3 letras. Logotipo da comunidade achada: `GET /api/v1/comunidades/:idPublico/logo` (rota nova).
- `POST /api/v1/entrada` e `POST /api/v1/comunidades/:idPublico/pedidos` exigem também `consentimentoFe: true` (TC-03.v3) e aceitam `faixaEtaria?` (só para conta que ainda não declarou) e `responsavelCiente?`. Pela busca, o pedido sempre passa pela aprovação, mesmo em `codigo_direto` (D49). Erros: 404 (código desconhecido ou só por convite), 409 `ja_participa`, `vinculo_desativado`, `so_por_convite`, `limite_de_pedidos`, `pedido_recusado_recentemente`, `limite_de_participantes`; 422 `faixa_etaria_necessaria`, `responsavel_necessario`.
- `GET /api/v1/eu/pedidos` → `{ pedidos: [{ id, comunidade: { id?, nome, cor }, estado: 'pendente' | 'aceito' | 'nao_aprovado', criadoEm, respondidoEm }] }` (o `id` da comunidade só quando aceito e com vínculo ativo).
- `POST /api/v1/comunidades/:idPublico/denuncias`: `motivo` em `menor_de_16`, `risco_a_menor`, `falsa`, `golpe`, `ofensiva`, `spam`, `outro`; resposta `{ id, mensagem }`.
- `GET .../pedidos?estado=pendente|aceito|recusado|todos` → `{ pedidos: [{ id, nome, mensagem, origem, estado, criadoEm, decididoEm }] }`; o parâmetro do caminho de aceitar e recusar é `:pedidoDeEntradaId`. Aceitar → `{ estado: 'aceito', vinculoId }`; recusar → `{ estado: 'recusado' }`; mudar decisão já tomada: 409 `pedido_ja_respondido`.
- `GET .../codigo` → `{ codigo, link, modoEntrada }`; `POST .../codigo/trocar` → `{ codigo, link }`. O link é `URL_PUBLICA/entrar/<codigo>`.
- Detalhe da comunidade: `cidade`, `modoEntrada`, `encontravel`, `verificacao`, `idPublico`, `limites: { membrosAtivos: 30 | null, eventoPublico: boolean }`, `uso: { membrosAtivos }` e `precisaAceitarTermoDoAdmin`. Aceite do TC-16 por admin promovido depois ou versão nova: `POST /api/v1/c/:comunidadeId/termo-do-admin` `{ aceite: true }` (rota nova, D51).
- `PATCH /api/v1/c/:comunidadeId`: `modoEntrada: 'livre'` responde 422 `modo_nao_habilitado`; `cidade: null` apaga a cidade.

Notificações: tipos `pedido_de_entrada` (destino `{ tela: 'pedidos_de_entrada', comunidadeId }`) e `pedido_decidido` (destino `{ tela: 'meus_pedidos' }`). A resposta a um pedido não aprovado aparece no sino de quem pediu mesmo sem vínculo.

Plataforma:

- `GET /api/v1/plataforma/comunidades` → `{ comunidades: [{ id, nome, cor, cidade, estado, verificacao, exclusaoAgendadaPara, criadoEm, membrosAtivos, adminsAtivos, denunciasAbertas, criador: { nome, email } | null }], proximoCursor }`, 50 por página. Não pede o código do autenticador (D47). `criador` é nulo nas comunidades criadas pelo próprio Criador.
- Verificar e desverificar → `{ verificacao }`. Denúncias: `GET /api/v1/plataforma/denuncias-de-comunidade?estado=aberta|procedente|improcedente|todas` → `{ denuncias: [{ id, comunidade: { id, nome }, motivo, detalhe, estado, resolucao, criadoEm, resolvidaEm }] }`, com `menor_de_16` e `risco_a_menor` abertas no topo; `POST .../:denunciaId/resolver` `{ estado: 'procedente' | 'improcedente', resolucao? }`.
- Quem não é o Criador recebe 403 `so_criador` nessas rotas; as que destroem continuam com 403 `segundo_fator_necessario` sem a prova.
- `POST /api/v1/plataforma/comunidades` cria a comunidade já `verificada`, com o convite do primeiro admin.
