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
  export UJ_VARIANTE=homologacao EXPO_PUBLIC_API_URL=https://unijovem-hml.solerte.com.br
  cd ~/srv/builds/uni-jovem
  npm ci --no-audit --no-fund > ~/srv/builds/npm.log 2>&1
  cd apps/app && npx expo prebuild --platform ios --clean > ~/srv/builds/prebuild.log 2>&1
  zsh ~/srv/builds/assinar-ios.sh
'"
bash infra/hml/publicar-ipa.sh '/Users/rafaelgomes/srv/builds/saida-ios/UniJovemHML.ipa' "$VERSAO"
