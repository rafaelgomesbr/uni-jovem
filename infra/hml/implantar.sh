#!/usr/bin/env bash
# Implanta a homologação no Mac mini a partir desta máquina.
#
#   bash infra/hml/implantar.sh            # código do último commit da release
#
# Passos: empacota o código commitado (nunca o que está pela metade na pasta),
# envia por SSH, gera o .env no servidor se ainda não existir, monta a imagem,
# sobe banco e API, aplica as migrações e confere a saúde. Não toca em nada
# fora de ~/srv/apps/unijovem-hml e da pasta da web em ~/srv/sites.
set -euo pipefail

SERVIDOR="${UJ_SERVIDOR:-mac-cityhall}"
DESTINO='~/srv/apps/unijovem-hml'
RAIZ="$(git rev-parse --show-toplevel)"
cd "$RAIZ"

if [ "$(git branch --show-current)" != "release" ]; then
  echo "Implante a partir da branch release." >&2
  exit 1
fi

PACOTE="$(mktemp)"
trap 'rm -f "$PACOTE"' EXIT
git archive --format=tar HEAD \
  apps/api/src apps/api/migracoes apps/api/package.json apps/api/tsconfig.json \
  packages/dominio tsconfig.base.json infra > "$PACOTE"
echo "Enviando $(git rev-parse --short HEAD) para $SERVIDOR..."

ssh -o BatchMode=yes "$SERVIDOR" "zsh -lc 'set -e
  mkdir -p $DESTINO && cd $DESTINO
  rm -rf codigo.novo && mkdir codigo.novo && tar -xf - -C codigo.novo
  rm -rf codigo && mv codigo.novo codigo
  cp codigo/infra/hml/compose.yaml .
  sh codigo/infra/hml/gerar-env.sh \$PWD/.env
  # Configuração do Docker sem o chaveiro do macOS (travado em sessão SSH).
  mkdir -p .docker
  ln -sfn ~/.docker/contexts .docker/contexts
  ln -sfn ~/.docker/cli-plugins .docker/cli-plugins
  ln -sfn ~/.docker/buildx .docker/buildx
  [ -f .docker/config.json ] || printf %s \"{\\\"currentContext\\\":\\\"colima\\\"}\" > .docker/config.json
  export DOCKER_CONFIG=\$PWD/.docker
  docker compose build api
  docker compose up -d banco
  docker compose run --rm --no-deps api node --import tsx apps/api/src/cli/migrar.ts
  docker compose up -d api
  mkdir -p ~/srv/config/caddy/sites/extras/unijovem-hml
  cp codigo/infra/hml/caddy-extras.conf ~/srv/config/caddy/sites/extras/unijovem-hml/uni-jovem.conf
  sleep 5
  docker compose ps
'" < "$PACOTE"

echo "Pronto. Saúde: https://unijovem-hml.solerte.com.br/api/saude"
