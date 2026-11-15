#!/usr/bin/env bash
# Build completo do app de homologação para iPhone, a partir desta máquina,
# sem ninguém precisar ir ao Mac: envia o último commit, instala dependências,
# gera o projeto iOS, compila, assina com o chaveiro de build e publica em
# https://unijovem-hml.solerte.com.br/instalar.
#
#   bash infra/hml/build-ios.sh
set -euo pipefail
SERVIDOR="${UJ_SERVIDOR:-mac-cityhall}"
cd "$(git rev-parse --show-toplevel)"
VERSAO=$(grep -oE "VERSAO = '[0-9.]+'" apps/app/app.config.ts | grep -oE '[0-9.]+')
COMMIT=$(git rev-parse --short HEAD)
echo "Enviando $COMMIT para o Mac..."
git archive --format=tar HEAD | ssh -o BatchMode=yes "$SERVIDOR" '
  set -e; cd ~/srv/builds
  rm -rf uni-jovem.novo && mkdir uni-jovem.novo && tar -xf - -C uni-jovem.novo
  [ -d uni-jovem/node_modules ] && mv uni-jovem/node_modules uni-jovem.novo/
  rm -rf uni-jovem && mv uni-jovem.novo uni-jovem
  cp uni-jovem/infra/hml/assinar-ios.sh ~/srv/builds/assinar-ios.sh'
ssh -o BatchMode=yes "$SERVIDOR" "zsh -lc '
  set -e
  export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 PATH=/opt/homebrew/bin:\$PATH
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer EXPO_NO_TELEMETRY=1
  export UJ_VARIANTE=homologacao EXPO_PUBLIC_API_URL=https://unijovem-hml.solerte.com.br EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=457514327131-jgjuasb7a9nq7mqv3pcf857thsqnt526.apps.googleusercontent.com EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=457514327131-i7mraor79i6h8tjbr360jfmv1o6mmmfc.apps.googleusercontent.com
  cd ~/srv/builds/uni-jovem
  npm ci --no-audit --no-fund > ~/srv/builds/npm.log 2>&1
  cd apps/app && npx expo prebuild --platform ios --clean > ~/srv/builds/prebuild.log 2>&1
  zsh ~/srv/builds/assinar-ios.sh
'"
bash infra/hml/publicar-ipa.sh '/Users/rafaelgomes/srv/builds/saida-ios/UniJovemHML.ipa' "$VERSAO"
# Instala direto no iPhone pareado com o Mac (Xcode/devicectl), se estiver ao alcance.
ssh -o BatchMode=yes "$SERVIDOR" '
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
  ID=$(xcrun devicectl list devices 2>/dev/null | awk "/available \(paired\)/ && /iPhone/ {for(i=1;i<=NF;i++) if (\$i ~ /^[0-9A-F-]{36}$/) print \$i; exit}")
  if [ -n "$ID" ]; then
    xcrun devicectl device install app --device "$ID" ~/srv/builds/saida-ios/UniJovemHML.xcarchive/Products/Applications/UniJovemHML.app | grep -E "App installed|bundleID"
  else
    echo "Nenhum iPhone pareado ao alcance; use o link /instalar."
  fi'
