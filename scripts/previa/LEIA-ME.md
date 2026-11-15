# Prévia local do Uni Jovem

Sobe o Uni Jovem inteiro nesta máquina, com dados fictícios, para abrir o app web no navegador e conferir o visual tela a tela. Roda no Windows com Node 22, sem Docker e sem nada publicado: tudo escuta só em `localhost`.

```
npm run previa
```

No fim aparece:

```
Prévia pronta: http://localhost:8090/app
Contas fictícias: C:\...\.previa\contas.txt
```

Abra o endereço, entre com uma das contas do arquivo e navegue. **Ctrl+C** no terminal encerra tudo.

## O que sobe

| Peça                 | Endereço                | Origem                                                           |
| -------------------- | ----------------------- | ---------------------------------------------------------------- |
| Servidor da prévia   | `http://localhost:8090` | `scripts/previa/servidor.ts`                                     |
| API (Fastify)        | `http://127.0.0.1:3333` | `apps/api/src/index.ts`, com `UJ_AMBIENTE=desenvolvimento`       |
| Postgres 17 embutido | `127.0.0.1:54433` (\*)  | binários do pacote `embedded-postgres`, dados em `.previa/banco` |
| Web exportada (Expo) | `.previa/web`           | `npx expo export --platform web` em `apps/app`                   |

(\*) A porta do banco é escolhida na primeira vez (a primeira livre a partir de 54433) e fica gravada em `.previa/.env`.

O servidor da prévia faz o papel do Caddy da homologação (`infra/hml/caddy-extras.conf`):

- `/app/*` é servido como SPA a partir de `.previa/web` (arquivo, depois `arquivo.html`, depois `index.html`);
- `/convite`, `/primeiro-acesso` e `/redefinir-senha` redirecionam (302) para `/app/...`, mantendo o fragmento `#t=...`;
- todo o resto vai para a API, com o mesmo método, corpo e cabeçalhos (inclusive `Cookie` e `Set-Cookie`). O `X-Forwarded-For` é refeito a partir da conexão, e a API confia no proxy local (`PROXIES_CONFIAVEIS=127.0.0.1,::1`).

Como na homologação, a web fala com a API no mesmo endereço (`/api/...`), então o cookie de sessão funciona sem CORS.

## Primeira vez e vezes seguintes

Na primeira vez a prévia:

1. gera `.previa/.env` com segredos aleatórios de desenvolvimento (uma vez só);
2. cria o cluster do Postgres em `.previa/banco` e os papéis `uj_dono`, `uj_api` e `uj_auth` a partir de `infra/banco/papeis.sql`, com senhas aleatórias;
3. aplica as migrações (`apps/api/src/cli/migrar.ts`);
4. roda a semente (`apps/api/src/cli/semear.ts`) e guarda as senhas que ela imprime em `.previa/contas.txt`;
5. cria uma conta de Criador fictícia pelo fluxo real de primeiro acesso (`criador:iniciar` e a API), com senha e autenticador conhecidos só aqui;
6. exporta a web (a parte lenta: cerca de 2 minutos; corre enquanto banco e API sobem).

Nas vezes seguintes reaproveita tudo: só aplica migrações novas e exporta a web de novo. Para pular a exportação e usar a anterior (sobe em poucos segundos):

```
npm run previa -- --sem-exportar
```

## Opções

Passe depois de `--`, por exemplo `npm run previa -- --recriar`.

| Opção              | O que faz                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `--sem-exportar`   | reaproveita a última exportação da web (`.previa/web`)                                            |
| `--recriar`        | apaga banco, contas, segredos, e-mails e pushes da prévia e começa do zero (a web exportada fica) |
| `--codigo-criador` | mostra o código de 6 dígitos do autenticador do Criador e sai                                     |
| `--parar`          | para um Postgres da prévia que tenha sobrado e sai                                                |
| `--ajuda`          | mostra a ajuda                                                                                    |

## Contas

Tudo está em `.previa/contas.txt` (o terminal nunca mostra senha):

- as contas da semente (administradora, organizador, membro e as demais que a semente criar), com e-mail `@unijovem.invalid`;
- o **Criador** (`demo.criador@unijovem.invalid`): senha, segredo do autenticador (base32 e URI `otpauth://`) e códigos de recuperação.

O login do Criador não pede o código; as ações de plataforma pedem. Para ver o código atual, rode `npm run previa -- --codigo-criador` (em outro terminal, com a prévia no ar) ou cadastre o segredo num aplicativo autenticador. Código já usado não vale de novo: se recusar, espere o próximo (30 s).

E-mails que a API enviaria (convites, recuperação de senha, códigos) vão para `.previa/correio.txt`, e os pushes para `.previa/push.jsonl`.

## Encerrar

Ctrl+C para, nesta ordem, o servidor da prévia, a exportação (se ainda estiver rodando), a API e o Postgres (`pg_ctl stop -m fast`), e escreve `Prévia encerrada.`. O npm às vezes devolve o prompt antes dessa última linha; espere por ela. No `cmd.exe`, a pergunta "Deseja finalizar o arquivo em lotes (S/N)?" pode aparecer: responda S.

Mesmo se o terminal for fechado ou o processo for derrubado à força, a API e o Postgres morrem junto (no Windows eles ficam no job do processo do Node). Se algum Postgres da prévia sobrar, a próxima execução o encontra e para; `npm run previa -- --parar` faz só isso. Outros Postgres da máquina nunca são tocados: a prévia só para o processo cuja linha de comando aponta para `.previa/banco`.

## O que fica em `.previa/` (ignorada pelo git)

| Caminho        | Conteúdo                                                      |
| -------------- | ------------------------------------------------------------- |
| `.env`         | configuração da API e senhas do banco (gerado uma vez)        |
| `banco/`       | dados do Postgres                                             |
| `web/`         | web exportada servida em `/app`                               |
| `contas.txt`   | contas fictícias                                              |
| `criador.json` | dados do Criador, lidos por `--codigo-criador`                |
| `correio.txt`  | e-mails gravados pela API                                     |
| `push.jsonl`   | notificações push gravadas pela API                           |
| `logs/`        | `postgres.log`, `api.log` e `exportar.log` da última execução |

Apagar a pasta inteira é seguro (com a prévia parada): a próxima execução recomeça do zero.

## Problemas comuns

- **Porta ocupada (8090 ou 3333):** outra prévia aberta, ou outro programa na porta. Encerre-o e rode de novo.
- **"Uma migração já aplicada mudou no código":** o banco da prévia aplicou uma versão anterior de uma migração que ainda está sendo escrita. Rode `npm run previa -- --recriar`.
- **A exportação da web falhou:** veja `.previa/logs/exportar.log`. A exportação anterior continua em `.previa/web` e pode ser usada com `--sem-exportar`.
- **A API não subiu:** veja `.previa/logs/api.log` (o erro de configuração lista o que falta, sem valores).

## Limitações

- Só para conferir visual e fluxo: HTTP sem TLS (o cookie de sessão sai sem `Secure`, como em desenvolvimento), sem Turnstile, sem entrar com Google ou Apple e sem envio real de e-mail ou push.
- A web exportada é a do código no disco no momento da exportação, inclusive mudanças não commitadas.
- O servidor da prévia não repete tudo do Caddy: não há `/instalar` (instalação ad hoc do iPhone), nem compressão, nem `ETag`; arquivos fora de `/_expo/` vão com `Cache-Control: no-cache`, para uma exportação nova aparecer sem limpar o cache do navegador. Não há WebSocket (a API não usa).
- O banco usa UTF-8 com o provedor de locale `builtin` (`C.UTF-8`), então a ordenação de texto é por código Unicode, não a do português.
- Feito e testado para Windows. Em macOS e Linux deve funcionar (os binários do Postgres vêm do mesmo pacote), mas não foi conferido.

Para rodar sem o npm no meio (o prompt só volta depois de `Prévia encerrada.`): `node --import tsx scripts/previa/index.ts`, com as mesmas opções.
