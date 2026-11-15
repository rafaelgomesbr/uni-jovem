# Produção no Mac mini

Ambiente `unijovem-prod`, em `https://unijovem.solerte.com.br`. Dados reais: só entra aqui o que já passou pela homologação.

A subida foi autorizada pelo dono em 15/11/2026. **Cada implantação em produção continua precisando da aprovação explícita dele** (CLAUDE.md, seção 4). Os scripts recusam rodar sem `UJ_CONFIRMO_PRODUCAO=sim`.

## Como está montado

O desenho é igual ao da homologação ([`../hml/LEIA-ME.md`](../hml/LEIA-ME.md)). Nomes, segredos, banco, volume e rede são todos próprios.

| Peça                            | Produção                                     | Homologação                    |
| ------------------------------- | -------------------------------------------- | ------------------------------ |
| Pasta no Mac                    | `~/srv/apps/unijovem-prod`                   | `~/srv/apps/unijovem-hml`      |
| Contêineres                     | `unijovem-prod-banco`, `-api`, `-tarefas`    | `unijovem-hml-*`               |
| Imagem                          | `unijovem-api:prod`                          | `unijovem-api:hml`             |
| Volume do banco                 | `unijovem_prod_banco`                        | `unijovem_hml_banco`           |
| Web interna                     | `~/srv/sites/unijovem-prod-web`              | `~/srv/sites/unijovem-hml-web` |
| Regras extras do Caddy          | `sites/extras/unijovem-prod/`                | `sites/extras/unijovem-hml/`   |
| Backup (launchd)                | 03:45, `br.com.solerte.unijovem-prod-backup` | 03:30                          |
| Instalação ad hoc (`/instalar`) | não existe: o app vem das lojas              | existe                         |

O `Dockerfile.api` é o mesmo dos dois ambientes (`infra/hml/Dockerfile.api`).

## Antes da primeira subida

1. **Domínio (ação do dono, porque o painel tem senha).** No painel do servidor, crie um site do tipo `proxy` com estes dados:
   - nome: `unijovem-prod`;
   - domínio: `unijovem.solerte.com.br`;
   - destino: `unijovem-prod-api:3000`;
   - marcado como público.

   O painel cria o DNS, a regra do túnel e a rota do Caddy. O nome precisa ser exatamente `unijovem-prod`, porque as regras extras ficam em `sites/extras/unijovem-prod/`.

2. **Impressões do certificado Android.** Em produção, a API não sobe sem `ANDROID_SHA256_IMPRESSOES`, que alimenta o `assetlinks.json` dos links do app. O valor tem as impressões SHA-256, separadas por vírgula:
   - da chave de upload do EAS: saem do `.aab` de produção com `keytool -printcert -jarfile app.aab`;
   - da chave de assinatura do Google Play: aparece em _Play Console > Integridade do app_ depois do primeiro envio de `.aab`.

   Para editar o `.env` no Mac: `nano ~/srv/apps/unijovem-prod/.env`. O `.env` é gerado no servidor, com permissão 600, e nunca sai de lá.

## Implantar

```bash
UJ_CONFIRMO_PRODUCAO=sim bash infra/prod/implantar.sh
```

O script faz, em ordem:

1. envia o código do último commit da `release`;
2. gera o `.env` com segredos novos, se ainda não existir;
3. para, sem subir nada, se faltar a impressão Android;
4. monta a imagem;
5. aplica as migrações com `uj_dono` e sobe banco, API e tarefas;
6. instala as regras do Caddy e o backup diário.

Para publicar a web interna em `/app`:

```bash
UJ_CONFIRMO_PRODUCAO=sim bash infra/prod/publicar-web.sh
```

## Primeiro acesso do Criador

No Mac:

```bash
cd ~/srv/apps/unijovem-prod
DOCKER_CONFIG=$PWD/.docker docker compose run --rm --no-deps api \
  node --import tsx apps/api/src/cli/criador-iniciar.ts --nome "Seu nome" --email voce@exemplo.com
```

O comando imprime um link de uso único, válido por 30 minutos. Abra o link para definir a senha e o autenticador.

## Contas dos revisores das lojas

São contas e comunidades fictícias (`*@unijovem.invalid`), isoladas das comunidades reais. As senhas são aleatórias e vão direto para um arquivo com permissão 600 no Mac. Não aparecem em log nem no terminal de quem rodou.

```bash
cd ~/srv/apps/unijovem-prod
( umask 077; DOCKER_CONFIG=$PWD/.docker docker compose run --rm -T --no-deps \
    -e UJ_SEMEAR_EM_PRODUCAO=sim api node --import tsx apps/api/src/cli/semear.ts > contas-revisao.txt )
```

**Rodar de novo** (por exemplo, para acrescentar o conteúdo novo da demonstração ou as semanas seguintes) **nunca** grava em `contas-revisao.txt`: o `>` sobrescreveria as senhas dos revisores, que não são mostradas de novo. Use outro arquivo, como `> enriquecimento-demo.txt`, também com `umask 077`. A semente cifra os pedidos de oração com a `ORACAO_CHAVE` do `.env`, que já chega ao contêiner `api`. Contas criadas só como figurantes ficam sem senha.

O dono lê o arquivo (`cat ~/srv/apps/unijovem-prod/contas-revisao.txt`) e cola o e-mail e a senha nos campos de acesso para revisão:

- na Apple: _App Review Information > Sign-in required_;
- no Google: _Conteúdo do app > Acesso ao app_.

## O que ainda falta para o uso real (não bloqueia a revisão)

| Item              | Estado                              | Efeito enquanto falta                                                                                                               |
| ----------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| E-mail (Resend)   | `EMAIL_MODO=desligado`              | Sem código por e-mail no convite de conta nova e sem recuperação de senha. As contas de revisão já existem e não dependem de e-mail |
| Push de produção  | Sem chaves em `chaves/`             | Sem notificações. O versículo do dia é local e funciona                                                                             |
| Turnstile real    | Chaves de teste, que sempre aprovam | A página pública de inscrição fica só com limite por IP e campo-armadilha. Trocar antes de divulgar                                 |
| Entrar com Google | Desligado                           | Só e-mail e senha, Apple e Face ID. Precisa dos clientes OAuth de `com.solerte.unijovem`                                            |

## Backup e restauração

Iguais aos da homologação, com os nomes de produção:

- `backup.sh`: diário às 03:45, retenção de 7 diários, 4 semanais e 3 mensais, em `~/srv/apps/unijovem-prod/backups` (700);
- `provar-restauracao.sh`: ensaio de restauração num banco temporário.

A cópia externa no R2 depende da PH-05. Até lá, o backup fica no mesmo disco do Mac.
