# Runbook: troca de domínio

Como mover um ambiente do Uni Jovem para um domínio novo sem quebrar links já compartilhados (convites, eventos no WhatsApp) nem o app instalado.

- **Escrito em:** 14/11/2026, a partir do plano aprovado.
- **Ensaiado:** ainda não. Parte do que este runbook usa (páginas públicas, `.well-known`, app nas lojas, compose de produção) só existe a partir das F12 e F19. Ensaiar em homologação antes do primeiro uso real e registrar a data aqui.
- **Domínios atuais (planejados):** produção `unijovem.solerte.com.br`; homologação `unijovem-hml.solerte.com.br`.

## Por que a troca é possível

- O domínio vive num só lugar: a variável `URL_PUBLICA` da API (ver `.env.example`).
- Tokens de convite, links de cancelamento e o `idPublico` dos eventos **não carregam domínio**: o mesmo token funciona em qualquer host que sirva a aplicação.
- Nenhum link absoluto é gravado no banco: links são montados na hora a partir de `URL_PUBLICA`.
- Cada ambiente usa um host só (`/`, `/e/{idPublico}`, `/convite`, `/app/*`, `/api/*`, `/.well-known/*`, `/privacidade`, `/termos`, `/excluir-conta`), então trocar o host é trocar um nome, não reorganizar rotas.

## Limite real

**Links antigos só continuam funcionando enquanto o domínio antigo for mantido e redirecionando.** Convites e eventos já enviados por WhatsApp, e-mail ou impressos apontam para o domínio antigo; se o registro desse domínio vencer, ou se o redirecionamento for desligado, esses links quebram e nada no novo domínio consegue recuperá-los. Versões antigas do app instaladas nos aparelhos também continuam chamando o domínio antigo até serem atualizadas.

Por isso: manter o domínio antigo registrado, com DNS ativo e redirecionando, por **pelo menos 12 meses** depois da troca, e mais tempo se houver convites ou eventos de longa duração em circulação.

## Antes de começar (ações do dono)

1. Decidir o novo domínio e registrar a decisão em `docs/DECISOES.md`.
2. Ter o DNS do novo domínio no Cloudflare.
3. Adicionar o novo hostname como regra de ingress do **túnel existente**. Não iniciar um segundo `cloudflared` (ele é compartilhado com o dc360).
4. Se o domínio de envio de e-mail mudar: verificar o novo domínio no Resend (registros SPF e DKIM no Cloudflare).
5. Adicionar o novo hostname aos domínios permitidos do widget do Turnstile.

Esses itens vão para [`../PENDENCIAS-HUMANAS.md`](../PENDENCIAS-HUMANAS.md) com o estado "aberta" quando a troca for decidida.

## Passos

### 1. Novo domínio ao lado do antigo

1. No Caddy do ambiente, servir o **novo** host com a mesma aplicação (web exportada e proxy de `/api`). O antigo continua servindo normalmente nesta etapa.
2. Servir `/.well-known/apple-app-site-association` e `/.well-known/assetlinks.json` também no novo host.
3. Conferir: `curl -sI https://NOVO/api/saude` responde 200.

### 2. App passa a conhecer os dois domínios

1. Em `apps/app/app.config.ts`, declarar **os dois** domínios em `associatedDomains` (iOS) e nos intent filters com verificação (Android).
2. Se o app chama a API por um endereço fixo no build, apontá-lo para o novo domínio.
3. Gerar o build, instalar em aparelho, conferir que links do novo **e** do antigo abrem o app.
4. Enviar a nova versão às lojas. **Exige aprovação explícita do dono para cada envio.**
5. Esperar a adoção da nova versão antes do passo 4 deste runbook. Versões antigas que não forem atualizadas continuam dependendo do domínio antigo.

### 3. API passa a gerar links no novo domínio

1. Trocar `URL_PUBLICA` no `.env` do ambiente para o novo domínio.
2. **Atualizar a guarda de configuração em `apps/api/src/config.ts`.** Em 14/11/2026 ela tem o domínio de produção escrito no código (recusa homologação apontando para `unijovem.solerte.com.br` e produção apontando para `-hml.` ou `localhost`). Sem essa mudança, a guarda deixa de proteger o novo domínio. Atualizar também os testes em `apps/api/test/config.test.ts`.
3. Reiniciar a API. Ela recusa subir se a configuração não combinar com o ambiente.
4. Conferir que um convite novo, um evento público e o e-mail de recuperação saem com o novo domínio, e que a prévia do WhatsApp mostra o novo endereço.

### 4. Antigo redireciona para o novo

1. No Caddy, o host antigo responde com redirecionamento permanente para o novo, **preservando caminho e query**:
   - páginas (`/`, `/e/*`, `/convite`, `/app/*`, `/privacidade`, `/termos`, `/excluir-conta`): **301**;
   - `/api/*`: **não usar 301**, porque muitos clientes transformam POST em GET ao seguir 301. Manter o proxy da API no host antigo até as versões antigas do app sumirem, ou usar **308**, que preserva o método e o corpo.
2. O **fragmento** (`#t=...` do convite) não chega ao servidor; o navegador o reaplica ao seguir o redirecionamento quando o destino não traz fragmento próprio. Por isso o `Location` do redirecionamento não deve conter `#`.
3. **Exceção:** `/.well-known/*` no host antigo **não** redireciona. Apple e Android buscam esses arquivos direto no host e não aceitam redirecionamento; eles continuam sendo servidos no domínio antigo por pelo menos 12 meses.

## Verificação

| Conferência                                                      | Esperado                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| `curl -sI https://ANTIGO/e/ID_PUBLICO`                           | `301`, `Location: https://NOVO/e/ID_PUBLICO`            |
| `curl -sI "https://ANTIGO/convite"`                              | `301` para `https://NOVO/convite`                       |
| `curl -sI https://ANTIGO/.well-known/apple-app-site-association` | `200`, sem redirecionamento                             |
| `curl -sI https://ANTIGO/.well-known/assetlinks.json`            | `200`, sem redirecionamento                             |
| `curl -sI https://NOVO/api/saude`                                | `200`                                                   |
| Convite antigo aberto no navegador do celular                    | Chega à página de convite no novo domínio, token aceito |
| Link antigo e link novo tocados no aparelho com o app instalado  | Abrem o app (iOS e Android)                             |
| Login na web pelo novo domínio                                   | Funciona; a sessão web do domínio antigo não é levada   |

Registrar a data e o resultado de cada conferência em `docs/STATUS.md`.

## Efeitos colaterais conhecidos

- **Sessão na web:** o cookie de refresh pertence ao host antigo; quem usa a web entra de novo no novo domínio. No celular, o refresh fica no Keychain ou Keystore e não depende do domínio.
- **Prévias já enviadas no WhatsApp** continuam mostrando o domínio antigo; o link funciona por causa do redirecionamento.
- **Páginas de privacidade e exclusão de conta** cadastradas nas lojas precisam ter o endereço atualizado no App Store Connect e no Play Console (ação do dono).

## Reversão

Enquanto o domínio antigo estiver ativo, reverter é: voltar `URL_PUBLICA` (e a guarda de `config.ts`) para o domínio antigo, reiniciar a API e remover o redirecionamento no Caddy. O app com os dois domínios declarados continua funcionando nos dois sentidos.
