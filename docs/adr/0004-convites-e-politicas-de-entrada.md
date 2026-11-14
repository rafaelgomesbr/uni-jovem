# ADR 0004: Entrada só por convite, com três políticas separadas

- **Estado:** aceita
- **Data:** 14/11/2026
- **Decisões relacionadas:** D3, D6, P4 em [`../DECISOES.md`](../DECISOES.md)

## Contexto

O app será público nas lojas, mas só entra quem for convidado (D3). Só o Criador cria comunidades (D6). No futuro pode haver cadastro público, pedido de entrada ou entrada livre, e misturar essas três perguntas numa regra só ("quem pode se cadastrar") tornaria qualquer mudança perigosa. O convite é a porta de entrada: se ele vazar ou puder ser adulterado, alguém ganha acesso a dado sensível de uma comunidade.

## Decisão

**Três decisões separadas, cada uma com seu ponto de política:**

1. **Quem cria conta:** `PoliticaDeConta` global. v1 = `somente_por_convite`. Extensão futura: `cadastro_publico`, que cria só a conta, **sem** vínculo com comunidade.
2. **Quem cria comunidade:** `PoliticaDeComunidade` global. v1 = `somente_criador`.
3. **Como se entra numa comunidade:** `comunidades.modo_entrada`, enum com `convite` (implementado na v1), `solicitacao` e `livre`. O enum e a interface `ServicoDeEntrada` existem; os dois últimos respondem "não habilitado", com teste garantindo isso.

**Convite:**

- Token de 256 bits, guardado só como HMAC; validade de 7 dias (P4); uso único; revogável; pode ser vinculado a um e-mail.
- Papel e comunidade ficam fixos no servidor, nunca vêm do link.
- O link é `/convite#t=...`: o token vai no fragmento, que não aparece em log de servidor nem em `Referer`. A página tem `noindex` e `no-referrer`.
- **Conta nova:** nome, WhatsApp e e-mail, código de 6 dígitos por e-mail (10 min, 5 tentativas), senha; conta e vínculo são criados numa transação que consome o convite.
- **Conta existente:** autentica se preciso, vê "Entrar em _Comunidade X_ como _Organizador_", confirma, e o vínculo é criado. Se o convite foi vinculado a outro e-mail, bloqueia e explica, sem mostrar o e-mail do convite inteiro.
- Criação, uso e revogação são auditados.
- Convite nunca concede o atributo de Criador.

**Revisores das lojas:** comunidade e conta de demonstração em produção, isoladas e com dados fictícios, nunca a conta do dono.

**Inscrição pública não é conta:** o participante externo de um evento vive em `participantes_externos` e nunca ganha conta, vínculo ou acesso.

## Consequências

- Abrir o cadastro no futuro é trocar uma política, sem mexer em convites nem em comunidades.
- Convite vazado expira em 7 dias e vale uma vez; o banco não guarda nada que permita reconstruir o link.
- Quem perde o link precisa de um convite novo; não há "reenviar o mesmo".
- A Apple pode questionar um app público de entrada só por convite (risco R17); a conta demo e as notas de revisão respondem a isso.

## Alternativas rejeitadas

- **Uma regra única de cadastro:** acopla as três decisões.
- **Token do convite na query string:** vaza em log e em `Referer`.
- **Guardar o token em claro ou só com hash simples sem segredo:** quem lê o banco poderia usar ou testar convites.
- **Papel e comunidade dentro do token:** adulteração vira escalada de privilégio.

## Inspiração

- `C:\Projetos\brother-system\docs\adr\0016-convite-de-membro-com-aceite.md`.
- `C:\Projetos\brother-system\docs\adr\0032-convite-de-conta-guardado-como-hmac.md` (convite de uso único como HMAC, `noindex` e `no-referrer`).
