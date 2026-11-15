#!/bin/zsh
# Assina o archive de loja (produção, com.solerte.unijovem) com o perfil da
# App Store e o chaveiro de build, empacota o .ipa e envia ao App Store
# Connect (TestFlight) com a chave de API guardada no Mac. Roda NO MAC, por SSH,
# sem senha de ninguém. Enviar ao TestFlight é distribuição de teste: só com o
# "sim" do dono (CLAUDE.md, seção 4); a trava é UJ_CONFIRMO_TESTFLIGHT=sim.
#
#   UJ_CONFIRMO_TESTFLIGHT=sim zsh ~/srv/builds/uni-jovem-loja/infra/prod/assinar-ios-loja.sh
#
# Pré-requisitos no Mac:
#   ~/srv/builds/saida-loja/<Esquema>.xcarchive  (archive sem assinatura)
#   ~/srv/builds/assinatura/loja.mobileprovision (perfil IOS_APP_STORE)
#   ~/.appstoreconnect/private_keys/AuthKey_<id>.p8 e ~/srv/builds/asc/issuer
set -eu
if [ "${UJ_CONFIRMO_TESTFLIGHT:-}" != "sim" ]; then
  echo "TestFlight: rode com UJ_CONFIRMO_TESTFLIGHT=sim, só com aprovação do dono." >&2
  exit 1
fi
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
CHAVE_API="${UJ_CHAVE_API:-5D35YX6U6U}"
A=~/srv/builds/assinatura
KC=$A/uj-build.keychain-db
PERFIL=$A/loja.mobileprovision
APP_DIR=~/srv/builds/uni-jovem-loja/apps/app
SAIDA=~/srv/builds/saida-loja
LOG=~/srv/builds/assinar-ios-loja.log
: > "$LOG"

ARQUIVO=$(ls -d "$SAIDA"/*.xcarchive | head -1)
ESQUEMA=$(basename "$ARQUIVO" .xcarchive)
APP="$ARQUIVO/Products/Applications/$ESQUEMA.app"
echo "1/4 Perfil e permissões ($ESQUEMA)..."
cp "$PERFIL" "$APP/embedded.mobileprovision"
security cms -D -i "$PERFIL" > "$SAIDA/perfil.plist"
# Permissões = as do perfil da App Store mais as declaradas pelo projeto que o
# perfil permite (domínios associados, Entrar com a Apple), sem get-task-allow.
python3 - "$SAIDA/perfil.plist" "$APP_DIR/ios/$ESQUEMA/$ESQUEMA.entitlements" "$SAIDA/permissoes.plist" <<'PY'
import plistlib, sys, os
perfil = plistlib.load(open(sys.argv[1], 'rb'))['Entitlements']
projeto = plistlib.load(open(sys.argv[2], 'rb')) if os.path.exists(sys.argv[2]) else {}
final = dict(perfil)
for chave, valor in projeto.items():
    if chave == 'aps-environment':
        continue  # vale o do perfil (produção)
    if chave in perfil or chave == 'com.apple.developer.associated-domains':
        final[chave] = valor
final['get-task-allow'] = False
plistlib.dump(final, open(sys.argv[3], 'wb'))
print('permissoes:', ', '.join(sorted(final)))
PY

echo "2/4 Assinando com o chaveiro de build..."
security unlock-keychain -p "$(cat $A/senha-do-chaveiro)" "$KC"
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

echo "3/4 Empacotando o .ipa..."
IPA="$SAIDA/$ESQUEMA.ipa"
cd "$SAIDA" && rm -rf Payload "$IPA" && mkdir Payload && cp -R "$APP" Payload/ && zip -qry "$IPA" Payload && rm -rf Payload
ls -l "$IPA"

echo "4/4 Enviando ao App Store Connect (TestFlight)..."
xcrun altool --upload-app --type ios --file "$IPA" \
  --apiKey "$CHAVE_API" --apiIssuer "$(cat ~/srv/builds/asc/issuer)" 2>&1 | tee -a "$LOG" | tail -15
echo "PRONTO"
