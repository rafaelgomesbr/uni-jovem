# ADR 0001: Um app Expo para iOS, Android e web interna, com API própria no Mac mini

- **Estado:** aceita
- **Data:** 14/11/2026
- **Decisões relacionadas:** D1, D4, D10 em [`../DECISOES.md`](../DECISOES.md)

## Contexto

O Uni Jovem precisa estar em iOS, Android e web, com páginas públicas de evento que mostrem prévia correta no WhatsApp, uso offline no dia do evento e custo recorrente zero (D4). O dono já opera Postgres, Caddy e Cloudflare Tunnel em Docker num Mac mini, e decidiu que tudo roda ali (D1). Há uma pessoa só para manter o sistema, então cada tecnologia extra é custo de manutenção.

## Decisão

- **Um projeto Expo (React Native)**, SDK 58 (D10), com Expo Router e TypeScript estrito, para iOS, Android **e** a web interna (membros, organizadores, admins), exportada com `expo export --platform web`. Onde a tela larga pede outra composição (relatórios, administração), a tela tem variante `.web.tsx`.
- **Páginas públicas** (evento, inscrição, cancelamento, convite, privacidade, termos, exclusão de conta) **renderizadas no servidor** pela API, com templates de escape automático, CSS próprio e quase nenhum JavaScript.
- **API própria**: Node 22, Fastify 5, TypeScript, Kysely sobre `pg`, Zod nos contratos.
- **PostgreSQL 17** com RLS forçada (ver [ADR 0002](0002-isolamento-por-comunidade-rls.md)); **Garage** (compatível com S3) para arquivos; **Server-Sent Events** com polling de reserva para o tempo real.
- Tudo em Docker no Mac mini, um compose por ambiente, exposto pelo túnel já existente.

## Consequências

- Uma base de regras, telas e testes para as três plataformas; regras puras ficam em `packages/dominio`, compartilhadas entre app e API.
- Páginas públicas carregam rápido em 3G, funcionam sem JavaScript, geram Open Graph correto e não expõem o bundle do app interno.
- SQL explícito e tipado, sem ORM; mais código de consulta escrito à mão.
- SSE atravessa o túnel com mais facilidade que WebSocket, mas pode sofrer com buffer e tempo limite (risco R11); o polling de reserva é obrigatório.
- Servidor doméstico, sem SLA (limite L06): exige backup externo, monitor e plano de migração se o uso crescer.
- Recursos (SQLCipher, notificações nativas) exigem build de desenvolvimento, não Expo Go (risco R06).

## Alternativas rejeitadas

- **Supabase:** custo ou pausa por inatividade no plano gratuito, e o dono já opera Postgres no Mac.
- **Next.js separado para a web interna:** duplicaria telas e regras.
- **Capacitor:** experiência nativa e offline piores que as do Expo.
- **WebSocket para o ao vivo:** mais complexo que SSE e com fallback menos trivial.

## Inspiração

- `C:\Projetos\brother-system\docs\adr\0005-expo-exporta-a-web.md` (mesmo app Expo exportado para web).
- `C:\Projetos\city-hall\dc360\docs\AMBIENTES.md` (configuração validada por ambiente).
