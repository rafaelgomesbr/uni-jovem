# Homologação no Mac mini

Ambiente `unijovem-hml`, em `https://unijovem-hml.solerte.com.br`. Dados só fictícios.

## Como está montado

- Stack Docker próprio, em `~/srv/apps/unijovem-hml` no Mac (`compose.yaml` copiado deste diretório). Ele não toca no dc360 nem nos outros sites.
- `unijovem-hml-banco`: Postgres 17, numa rede interna sem saída. Os papéis `uj_dono`, `uj_api` e `uj_auth` são criados na primeira subida (`infra/banco/iniciar-papeis.sh`).
- `unijovem-hml-api`: a API, que também entra na rede `server_edge`, onde o Caddy compartilhado a alcança. Não publica porta no host.
- Web interna (`/app`): os arquivos do `expo export` ficam em `~/srv/sites/unijovem-hml-web`. As regras extras do Caddy estão em `caddy-extras.conf`, copiado para `~/srv/config/caddy/sites/extras/unijovem-hml/`.
- O domínio é ligado pelo **painel do servidor**: um site do tipo `proxy` com nome `unijovem-hml`, domínio `unijovem-hml.solerte.com.br`, destino `unijovem-hml-api:3000` e marcado como público. O painel cria o DNS, a regra do túnel e a rota do Caddy. Isso é ação do dono, porque o painel tem senha.

## Segredos

O `.env` é gerado **no servidor** por `gerar-env.sh`, com valores aleatórios e permissão 600. Ele nunca é copiado para esta máquina, para o git ou para log. O script não sobrescreve um `.env` existente.

O Turnstile usa as chaves de teste oficiais do Cloudflare, que sempre aprovam. Antes de abrir a página pública a terceiros, troque-as pelas de um widget real. O e-mail fica `desligado` até existir a conta no Resend.

## Implantar

```bash
bash infra/hml/implantar.sh
```

O script envia o código do **último commit** (nunca trabalho pela metade), monta a imagem, sobe o banco, aplica as migrações com `uj_dono` e sobe a API.

O Docker do Mac usa uma configuração própria (`.docker/` ao lado do compose) sem o chaveiro do macOS, que fica travado em sessão SSH. As imagens usadas são públicas.

## Primeiro acesso do Criador

No Mac:

```bash
cd ~/srv/apps/unijovem-hml
DOCKER_CONFIG=$PWD/.docker docker compose run --rm --no-deps api \
  node --import tsx apps/api/src/cli/criador-iniciar.ts --nome "Seu nome" --email voce@exemplo.com
```

O comando imprime um link de uso único, válido por 30 minutos. Abra o link no navegador para definir a senha e o autenticador.

## Recursos

O Mac tem 8 GB de memória e o disco anda com cerca de 4 GB livres. Por isso os containers têm limite de memória de 384 MB cada.
