# Passagem: Uni Jovem, app aberto (ADR 0007) e lojas

- **Criado:** 15/11/2026, 16:57
- **Projeto:** `c:\Projetos\Uni Jovens`, branch `release` (nunca criar branch; `main` é produção)
- **Último commit:** `5d0dad2` UJ-F21-E01: ADR 0007
- **Leia antes:** `CLAUDE.md`, `docs/STATUS.md`, `docs/adr/0007-app-aberto.md`, `docs/DECISOES.md` (até D46, mais as que os agentes acrescentaram)

## Estado atual

1. **App 1.0.0 (1) no TestFlight**, já processado (`VALID`), com o grupo interno "Equipe Uni Jovem" só com o dono. A ficha da versão 1.0.0 no App Store Connect está completa: prints 6,3" e 6,9", App Review Information (o dono colou a senha da conta demo) e build vinculado. **"Add for Review" NÃO foi clicado**: precisa do "sim" explícito do dono.
2. **Produção** (`https://unijovem.solerte.com.br`) no ar, com migrações até a 0021 e a conta de Criador do dono criada.
3. **Google Play:** a ficha está com 10 de 12 tarefas. Faltam a classificação de conteúdo (IARC) e mais uma. Ícone, recurso gráfico e prints não foram enviados. O teste interno está sem versão. O `.aab` 1.0.0 (versionCode 3, código de `efa42e4`) está em `C:\Users\Rfasg\Downloads\uni-jovem-1.0.0-3.aab`. **O Google exige que o primeiro `.aab` de um app novo seja enviado pela tela.**
4. **App aberto (ADR 0007), em construção e SEM commit.** No fim da sessão, dois agentes ainda rodavam e escreviam no working tree:
   - API: cadastro aberto, comunidades criadas por qualquer pessoa com limites ("rodinhas"), código e QR, busca, pedidos de entrada, denúncia de comunidade, verificação na Plataforma, 2FA fora da criação de comunidade, mais 10 itens dos textos legais e "criar comunidade exige 18 anos";
   - App: "Criar conta", "Comece por aqui", criar comunidade com o TC-16, configurações do admin (logotipo, modo de entrada, aparecer na busca, código), pedidos na Equipe, gestão na Plataforma, exclusão de conta por Google/Apple.
   - Os textos legais do app aberto estão prontos em `docs/privacidade` e `docs/lojas` (Política 0.3, Termos 0.3, `termo-do-administrador.md`), **também sem commit**.

## Contexto importante

- **NÃO implantar `docs/privacidade` sozinho:** a API lê esses textos ao servir as páginas públicas. A Política 0.3 descreve o app aberto, e só pode ir ao ar junto com a API da ADR 0007.
- **Verificação:** `npm run verificar` (Prettier, ESLint, tipos, 494 testes da API, cerca de 333 do app com o React Compiler e `fumaca:web`). O Jest passa pelo React Compiler: nunca pôr hook dentro de objeto, condição ou laço (foi a causa do app fechando no iPhone).
- **Implantar:**
  - homologação: `bash infra/hml/implantar.sh`;
  - produção: `UJ_CONFIRMO_PRODUCAO=sim bash infra/prod/implantar.sh` (o classificador já barrou a produção sem um "sim" do dono no momento);
  - web: `infra/*/publicar-web.sh`.
- **iOS no Mac (`ssh mac-cityhall`):**
  - homologação: `bash infra/hml/build-ios.sh` (instala no iPhone se estiver ao alcance, ou pelo link `/instalar`);
  - loja: o archive vem de `~/srv/builds/uni-jovem-loja`, e a assinatura e o envio são feitos com `UJ_CONFIRMO_TESTFLIGHT=sim zsh ~/srv/builds/assinar-ios-loja.sh` (cópia em `infra/prod/assinar-ios-loja.sh`). O próximo build precisa de `CFBundleVersion` 2 ou mais.
- **API da Apple:** chave `5D35YX6U6U` em `~/.appstoreconnect/private_keys` no Mac e Issuer ID em `~/srv/builds/asc/issuer` (vindo da variável `Issuer_apple` do Windows). Scripts em `infra/prod/asc/`.
  - App ID `6835004481`; versão `a672d0a1-c28f-4450-9154-3a3fccdc2837`; bundle `JMDR33883T`; certificado `MAF69F2LVM`; perfil "Uni Jovem App Store 2".
- **Android:** EAS cloud, `npx eas-cli build -p android --profile producao`. A chave de upload tem SHA-256 `55:93:38:...:CB:47`, que já está no `.env` de produção.
  - Falta acrescentar a chave de assinatura do Google Play depois do primeiro envio. Edite `ANDROID_SHA256_IMPRESSOES` no `.env` de produção no Mac e reinicie a API.
- **Chrome:** as ferramentas do claude-in-chrome caíram nesta sessão e não voltaram. A sessão `compromisso-01` (Duet) recebeu o pedido do Play, mas só age com o ok do dono na conversa dela.

## Próximos passos imediatos

1. **Google Play, pelo Chrome:**
   - ficha principal: ícone `docs/lojas/arte/icone-play-512.png`, recurso gráfico `destaque-play-1024x500.png` e prints `docs/lojas/capturas/final/play/01` a `08`;
   - IARC: o dono autorizou aceitar os termos; respostas em `docs/lojas/metadados.md` 5.2;
   - a tarefa pendente;
   - teste interno com o `.aab` de Downloads, testador `rafael.sgomesbr@gmail.com`;
   - anotar a SHA-256 da chave de assinatura do Google e pôr no `.env` de produção.
2. **Quando os agentes da API e do app terminarem** (ou, se a sessão foi perdida, conferindo o working tree):
   - rodar `npm run verificar` e corrigir;
   - commits separados: API (migrações 0022 em diante), app e textos legais;
   - implantar na homologação.
3. **Com o "sim" do dono para esta versão:**
   - implantar na produção;
   - build iOS de loja novo (versão 1.1.0 ou build 2), enviado ao TestFlight;
   - `.aab` novo no teste interno.
4. **Pendências do dono:**
   - "Add for Review" (Apple) e envio à revisão no Google: só com o "sim" dele;
   - a resposta sobre D41 (UUID v4) e a linha correspondente do `CLAUDE.md`;
   - a inscrição repetida (D45) mostrar "já inscrita" (recomendado manter);
   - Resend (PH-03), sem o qual o cadastro por e-mail fica indisponível;
   - Turnstile real (PH-13);
   - clientes OAuth do Google para produção (PH-14).

## Decisões desta sessão

- **ADR 0007:**
  - app aberto, comunidade "livre com rodinhas": até 30 pessoas e sem página pública até o Criador verificar;
  - busca só para quem escolher aparecer;
  - quem cria vira admin;
  - pedidos aprovados por admin e organizador;
  - criar comunidade sem código do autenticador; o código continua para excluir, suspender, transferir e intervir.
- **Criar comunidade exige 18 anos** (entrar continua a partir de 16), por decisão do agente; o dono pode reverter.
- **D41:** IDs com UUID v4 (`gen_random_uuid`), aguardando o ok do dono.
- **D42 a D46:**
  - D42: caixa de notificações (o sino);
  - D43: limite de erro por tela e Jest com o compilador;
  - D44: limites de abertura em grupo (600 por IP);
  - D45: irmãos na página pública;
  - D46: rede e mensagens.

## Cuidados

- O Docker do Mac às vezes trava ao recriar o contêiner de tarefas ("removal already in progress"). O `implantar.sh` já faz `rm -sf tarefas`. Se acontecer, rode `docker rm -f <nome_antigo>` e depois `docker compose up -d tarefas`.
- Para mudar o domínio de produção: no painel, o site `unijovem-prod` aponta para `unijovem-prod-api:3000`. Ele já foi criado uma vez com o domínio digitado errado (`unifovem`).
- Não abrir `.env` e não ler credenciais de outros projetos (o classificador bloqueia). Não digitar senha em site de terceiros.
- O dono quer tudo feito sem perguntas e fica irritado com pedidos de ação manual. Peça só o que é impossível sem ele, numa linha, com o link.
