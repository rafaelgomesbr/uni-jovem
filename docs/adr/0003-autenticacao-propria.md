# ADR 0003: Autenticação própria, com refresh rotativo e 2FA obrigatório para o Criador

- **Estado:** aceita
- **Data:** 14/11/2026
- **Decisões relacionadas:** D1, D4, P7 em [`../DECISOES.md`](../DECISOES.md)

## Contexto

O backend é próprio e roda no Mac mini (D1), sem orçamento para provedor de identidade pago (D4). O app precisa manter a sessão por semanas no celular (uso semanal, offline no dia do evento), e a conta do Criador controla a plataforma inteira. Os projetos de referência do dono já resolveram autenticação própria com o mesmo stack.

## Decisão

- **Senha:** argon2id (`@node-rs/argon2`), mínimo de 10 caracteres, conferida contra uma lista local de senhas vazadas (a senha nunca é enviada a terceiros).
- **Tokens:** access JWT de 15 min; **refresh rotativo**, guardado só como hash, uma linha por aparelho ou sessão. Reuso de um refresh já trocado derruba a família inteira.
- **Onde guardar:** no celular, o refresh fica no Keychain ou Keystore (`expo-secure-store`). Na web, em cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`, com o access só em memória. A senha nunca é guardada no aparelho.
- **Sessão:** expira após 90 dias de inatividade (P7); lista de "aparelhos conectados" com revogação.
- **Antiabuso:** limite por IP e por e-mail (login, recuperação, convite, verificação), atraso progressivo, respostas idênticas para conta existente ou inexistente; Turnstile só nas páginas públicas.
- **Recuperação de senha:** link de uso único de 30 min, guardado como hash, que derruba todas as sessões.
- **Criador:** TOTP obrigatório e 10 códigos de recuperação (mostrados uma vez, guardados como hash); reautenticação com 2FA para ações de plataforma. **Bootstrap** por comando no servidor (`npm run criador:iniciar`), que gera um link de uso único de 30 min mostrado só no terminal. Não existe conta mestra no código. 2FA é opcional para as demais contas e recomendado para admins.
- **E-mail transacional:** Resend no plano gratuito, com notificador em arquivo para desenvolvimento e testes.

## Consequências

- Nenhuma dependência paga nem serviço externo no caminho do login.
- O projeto passa a ser responsável por rotação de chaves, limites e recuperação; isso exige testes dedicados (AUT-04 a AUT-13 em [`../rastreabilidade.md`](../rastreabilidade.md)) e revisão de segurança nas F3 e F4.
- O teto de 100 e-mails por dia do Resend gratuito limita verificações e recuperações em picos (limite L07).
- Perder o TOTP e os códigos de recuperação do Criador não tem atalho: o fluxo de recuperação precisa ser desenhado na F3 sem criar porta dos fundos.

## Alternativas rejeitadas

- **Provedor de identidade gerenciado (Supabase Auth, Auth0, Clerk):** custo ou limite no plano gratuito, mais um subprocessador de dado sensível, e o dono já tem o padrão próprio testado.
- **Sessão longa sem rotação:** um refresh roubado valeria por meses sem detecção.
- **Guardar a senha no aparelho para login offline:** exposição desnecessária; o offline usa a partição local com validade (ver [ADR 0005](0005-offline-e-sincronizacao.md)).
- **Conta mestra criada por migração ou variável de ambiente:** credencial fixa é segredo esperando vazar.

## Inspiração

- `C:\Projetos\city-hall\docs\adr\0004-autenticacao-propria.md` (ADR 0004 do dc360: hash de senha, JWT curto, refresh rotativo com hash, resposta idêntica para conta existente ou inexistente).
- `C:\Projetos\city-hall\dc360\docs\LIGAR-O-EMAIL.md` (cliente Resend e notificador de teste).
