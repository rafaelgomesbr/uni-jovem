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
