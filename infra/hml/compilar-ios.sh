#!/bin/zsh
# Compila e assina o app de homologação NO MAC, pelo Xcode, e gera o .ipa ad hoc.
# Rodar NO TERMINAL DO MAC (não por agente): o chaveiro precisa ser destravado
# na mesma sessão que assina, e a senha é digitada só por você.
#
#   zsh ~/srv/builds/compilar-ios.sh
#
# Pré-requisito: ~/srv/builds/uni-jovem/apps/app/ios gerado (expo prebuild).
set -eu
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
export UJ_VARIANTE=homologacao EXPO_PUBLIC_API_URL=https://unijovem-hml.solerte.com.br EXPO_NO_TELEMETRY=1
TIME=8DVJ2U5ZKX
APP=~/srv/builds/uni-jovem/apps/app
SAIDA=~/srv/builds/saida-ios
LOG=~/srv/builds/compilar-ios.log

echo "Destravando o chaveiro (digite a senha de login do Mac quando pedir):"
security unlock-keychain ~/Library/Keychains/login.keychain-db

rm -rf "$SAIDA" && mkdir -p "$SAIDA"
cat > "$SAIDA/opcoes.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>release-testing</string>
<key>signingStyle</key><string>automatic</string>
<key>teamID</key><string>$TIME</string>
<key>compileBitcode</key><false/>
</dict></plist>
PLIST

cd "$APP/ios"
echo "Compilando (10 a 20 minutos). Log: $LOG"
xcodebuild -workspace UniJovemHML.xcworkspace -scheme UniJovemHML -configuration Release \
  -destination "generic/platform=iOS" -archivePath "$SAIDA/UniJovemHML.xcarchive" \
  DEVELOPMENT_TEAM=$TIME CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates archive > "$LOG" 2>&1 \
  || { grep -E "error:" "$LOG" | head -5; echo "FALHOU NO ARCHIVE"; exit 1; }
echo "Archive pronto. Exportando o .ipa ad hoc..."
xcodebuild -exportArchive -archivePath "$SAIDA/UniJovemHML.xcarchive" -exportOptionsPlist "$SAIDA/opcoes.plist" \
  -exportPath "$SAIDA" -allowProvisioningUpdates >> "$LOG" 2>&1 \
  || { grep -E "error" "$LOG" | tail -5; echo "FALHOU NO EXPORT"; exit 1; }
ls -l "$SAIDA"/*.ipa
echo "PRONTO: avise no chat que terminou."
