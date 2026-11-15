#!/bin/zsh
# Compila o app de homologação no Mac SEM o chaveiro de login: gera o archive
# sem assinatura e assina depois com o chaveiro de build próprio
# (~/srv/builds/assinatura, permissão 700), que guarda o certificado de
# distribuição baixado do EAS e uma senha aleatória gerada no próprio Mac.
# Roda inteiro por SSH, sem senha de ninguém e sem mexer na lista de chaveiros.
#
#   zsh ~/srv/builds/uni-jovem/infra/hml/assinar-ios.sh
#
# Saída: ~/srv/builds/saida-ios/UniJovemHML.ipa
set -eu
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
export UJ_VARIANTE=homologacao EXPO_PUBLIC_API_URL=https://unijovem-hml.solerte.com.br EXPO_NO_TELEMETRY=1
A=~/srv/builds/assinatura
KC=$A/uj-build.keychain-db
PERFIL=$A/hml.mobileprovision
APP_DIR=~/srv/builds/uni-jovem/apps/app
SAIDA=~/srv/builds/saida-ios
LOG=~/srv/builds/assinar-ios.log

if [ "${PULAR_ARCHIVE:-}" != 1 ]; then
  rm -rf "$SAIDA" && mkdir -p "$SAIDA"
  echo "1/4 Compilando sem assinatura (10 a 20 minutos)..."
  cd "$APP_DIR/ios"
  xcodebuild -workspace UniJovemHML.xcworkspace -scheme UniJovemHML -configuration Release \
    -destination "generic/platform=iOS" -archivePath "$SAIDA/UniJovemHML.xcarchive" \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" archive > "$LOG" 2>&1 \
    || { grep -E "error:" "$LOG" | head -8; echo "FALHOU NO ARCHIVE"; exit 1; }
fi

APP="$SAIDA/UniJovemHML.xcarchive/Products/Applications/UniJovemHML.app"
echo "2/4 Preparando perfil e permissões..."
cp "$PERFIL" "$APP/embedded.mobileprovision"
security cms -D -i "$PERFIL" > "$SAIDA/perfil.plist"
# Permissões = as do perfil (ambiente de push de produção, time, app) mais as
# declaradas pelo projeto (domínios associados), sem nada que o perfil não permita.
python3 - "$SAIDA/perfil.plist" "$APP_DIR/ios/UniJovemHML/UniJovemHML.entitlements" "$SAIDA/permissoes.plist" <<'PY'
import plistlib, sys, os
perfil = plistlib.load(open(sys.argv[1], 'rb'))['Entitlements']
projeto = plistlib.load(open(sys.argv[2], 'rb')) if os.path.exists(sys.argv[2]) else {}
final = dict(perfil)
for chave, valor in projeto.items():
    if chave == 'aps-environment':
        continue  # vale o do perfil (produção, no ad hoc)
    if chave in perfil or chave == 'com.apple.developer.associated-domains':
        final[chave] = valor
final['get-task-allow'] = False
plistlib.dump(final, open(sys.argv[3], 'wb'))
print('permissoes:', ', '.join(sorted(final)))
PY

echo "3/4 Assinando com o chaveiro de build..."
security unlock-keychain -p "$(cat $A/senha-do-chaveiro)" "$KC"
# O codesign só acha identidade em chaveiro que está na lista de busca. Como o
# EAS faz em todo build: acrescenta DEPOIS dos existentes e restaura a lista no
# fim, aconteça o que acontecer. A assinatura é pelo SHA-1, sem ambiguidade de nome.
LISTA_ORIGINAL=("${(@f)$(security list-keychains -d user | tr -d '" ')}")
restaurar() { security list-keychains -d user -s "${LISTA_ORIGINAL[@]}"; security lock-keychain "$KC" 2>/dev/null || true; }
trap restaurar EXIT
security list-keychains -d user -s "${LISTA_ORIGINAL[@]}" "$KC"
ID=$(security find-identity -v -p codesigning "$KC" | awk 'NR==1{print $2}')
assinar() { codesign --force --sign "$ID" --keychain "$KC" --generate-entitlement-der "$@" >> "$LOG" 2>&1; }
find "$APP" -depth \( -name "*.framework" -o -name "*.dylib" -o -name "*.appex" \) -print0 \
  | while IFS= read -r -d '' alvo; do assinar "$alvo"; done
assinar --entitlements "$SAIDA/permissoes.plist" "$APP"
codesign --verify --deep --strict "$APP" && echo "assinatura conferida"
restaurar
trap - EXIT

echo "4/4 Empacotando o .ipa..."
cd "$SAIDA" && rm -rf Payload && mkdir Payload && cp -R "$APP" Payload/ && zip -qry UniJovemHML.ipa Payload && rm -rf Payload
ls -l "$SAIDA/UniJovemHML.ipa"
echo "PRONTO"
