#!/usr/bin/env bash
# Exporta a web interna (Expo) e publica em ~/srv/sites/unijovem-hml-web no Mac,
# servida pelo Caddy em /app (ver caddy-extras.conf). Troca a pasta de uma vez
# (pasta nova, depois renomeia), para ninguém ver a web pela metade.
#
#   bash infra/hml/publicar-web.sh
set -euo pipefail
SERVIDOR="${UJ_SERVIDOR:-mac-cityhall}"
cd "$(git rev-parse --show-toplevel)/apps/app"
if [ -n "$(git status --porcelain -- .)" ]; then
  echo "Há mudanças não commitadas em apps/app; publique só código commitado." >&2
  exit 1
fi
rm -rf dist
# Entrar com Google na web: o ID de cliente web (público) entra no pacote.
EXPO_NO_TELEMETRY=1 UJ_VARIANTE=homologacao EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=457514327131-i7mraor79i6h8tjbr360jfmv1o6mmmfc.apps.googleusercontent.com \
  npx expo export --platform web --output-dir dist
tar -cf - -C dist . | ssh -o BatchMode=yes "$SERVIDOR" '
  set -e
  rm -rf ~/srv/sites/unijovem-hml-web.novo && mkdir -p ~/srv/sites/unijovem-hml-web.novo
  tar -xf - -C ~/srv/sites/unijovem-hml-web.novo
  rm -rf ~/srv/sites/unijovem-hml-web.antiga
  [ -d ~/srv/sites/unijovem-hml-web ] && mv ~/srv/sites/unijovem-hml-web ~/srv/sites/unijovem-hml-web.antiga
  mv ~/srv/sites/unijovem-hml-web.novo ~/srv/sites/unijovem-hml-web
  rm -rf ~/srv/sites/unijovem-hml-web.antiga'
rm -rf dist
echo "Web publicada: https://unijovem-hml.solerte.com.br/app"
