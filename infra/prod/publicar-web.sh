#!/usr/bin/env bash
# Exporta a web interna (Expo) de PRODUÇÃO e publica em ~/srv/sites/unijovem-prod-web
# no Mac, servida pelo Caddy em /app (ver caddy-extras.conf). Troca a pasta de
# uma vez (pasta nova, depois renomeia), para ninguém ver a web pela metade.
#
#   UJ_CONFIRMO_PRODUCAO=sim bash infra/prod/publicar-web.sh
set -euo pipefail
if [ "${UJ_CONFIRMO_PRODUCAO:-}" != "sim" ]; then
  echo "Produção: rode com UJ_CONFIRMO_PRODUCAO=sim, só com aprovação do dono." >&2
  exit 1
fi
SERVIDOR="${UJ_SERVIDOR:-mac-cityhall}"
cd "$(git rev-parse --show-toplevel)/apps/app"
if [ -n "$(git status --porcelain -- .)" ]; then
  echo "Há mudanças não commitadas em apps/app; publique só código commitado." >&2
  exit 1
fi
rm -rf dist
# Sem EXPO_PUBLIC_API_URL: a web fala com a API na mesma origem.
# Os IDs públicos do Google têm a mesma fonte dos builds de loja.
export EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID="$(node -p "require('./eas.json').build.producao.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || ''")"
EXPO_NO_TELEMETRY=1 UJ_VARIANTE=producao \
  npx expo export --platform web --output-dir dist
tar -cf - -C dist . | ssh -o BatchMode=yes "$SERVIDOR" '
  set -e
  rm -rf ~/srv/sites/unijovem-prod-web.novo && mkdir -p ~/srv/sites/unijovem-prod-web.novo
  tar -xf - -C ~/srv/sites/unijovem-prod-web.novo
  rm -rf ~/srv/sites/unijovem-prod-web.antiga
  [ -d ~/srv/sites/unijovem-prod-web ] && mv ~/srv/sites/unijovem-prod-web ~/srv/sites/unijovem-prod-web.antiga
  mv ~/srv/sites/unijovem-prod-web.novo ~/srv/sites/unijovem-prod-web
  rm -rf ~/srv/sites/unijovem-prod-web.antiga'
rm -rf dist
echo "Web publicada: https://unijovem.solerte.com.br/app"
