#!/usr/bin/env bash
# Implanta a PRODUÇÃO no Mac mini a partir desta máquina.
#
#   UJ_CONFIRMO_PRODUCAO=sim bash infra/prod/implantar.sh
#
# Cada implantação em produção precisa da aprovação explícita do dono
# (CLAUDE.md, seção 4); a variável é a trava contra rodar por engano.
#
# Passos: empacota o código commitado (nunca o que está pela metade na pasta),
# envia por SSH, gera o .env no servidor se ainda não existir, confere se ele
# está completo, monta a imagem, sobe banco e API, aplica as migrações, instala
# o backup diário e confere a saúde. Não toca em nada fora de
# ~/srv/apps/unijovem-prod, da pasta extra do Caddy e do agendamento do backup.
set -euo pipefail

if [ "${UJ_CONFIRMO_PRODUCAO:-}" != "sim" ]; then
  echo "Produção: rode com UJ_CONFIRMO_PRODUCAO=sim, só com aprovação do dono." >&2
  exit 1
fi

SERVIDOR="${UJ_SERVIDOR:-mac-cityhall}"
DESTINO='~/srv/apps/unijovem-prod'
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
  packages/dominio packages/tokens tsconfig.base.json infra docs/privacidade > "$PACOTE"
echo "Enviando $(git rev-parse --short HEAD) para $SERVIDOR (produção)..."

ssh -o BatchMode=yes "$SERVIDOR" "zsh -lc 'set -e
  mkdir -p $DESTINO && cd $DESTINO
  rm -rf codigo.novo && mkdir codigo.novo && tar -xf - -C codigo.novo
  rm -rf codigo && mv codigo.novo codigo
  cp codigo/infra/prod/compose.yaml .
  mkdir -p chaves backups && chmod 700 chaves backups
  sh codigo/infra/prod/gerar-env.sh \$PWD/.env
  if grep -q \"^ANDROID_SHA256_IMPRESSOES=\$\" .env; then
    echo \"Falta ANDROID_SHA256_IMPRESSOES no .env da produção (ver infra/prod/LEIA-ME.md). Nada foi subido.\" >&2
    exit 1
  fi
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
  docker compose up -d
  mkdir -p ~/srv/config/caddy/sites/extras/unijovem-prod
  cp codigo/infra/prod/caddy-extras.conf ~/srv/config/caddy/sites/extras/unijovem-prod/uni-jovem.conf
  # Backup diário às 03:45 (a homologação usa 03:30).
  PLIST=br.com.solerte.unijovem-prod-backup.plist
  if [ ! -f ~/Library/LaunchAgents/\$PLIST ]; then
    cp codigo/infra/prod/\$PLIST ~/Library/LaunchAgents/
    launchctl load -w ~/Library/LaunchAgents/\$PLIST
  fi
  sleep 5
  docker compose ps
'" < "$PACOTE"

echo "Pronto. Saúde: https://unijovem.solerte.com.br/api/saude"
