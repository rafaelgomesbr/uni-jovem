#!/usr/bin/env bash
# Publica um .ipa ad hoc de homologação para instalar no iPhone pelo Safari.
#   bash infra/hml/publicar-ipa.sh <caminho do .ipa NO MAC> <versão>
# Gera manifest.plist e index.html em ~/srv/sites/unijovem-hml-instalar,
# servidos em https://unijovem-hml.solerte.com.br/instalar (caddy-extras.conf).
set -euo pipefail
SERVIDOR="${UJ_SERVIDOR:-mac-cityhall}"
IPA="$1"
VERSAO="${2:-1.0.0}"
BASE="https://unijovem-hml.solerte.com.br/instalar"
ssh -o BatchMode=yes "$SERVIDOR" "set -e
  D=~/srv/sites/unijovem-hml-instalar
  rm -rf \$D.novo && mkdir -p \$D.novo
  cp '$IPA' \$D.novo/uni-jovem-hml.ipa
  cat > \$D.novo/manifest.plist <<PLIST
<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\"><dict><key>items</key><array><dict>
<key>assets</key><array><dict><key>kind</key><string>software-package</string><key>url</key><string>$BASE/uni-jovem-hml.ipa</string></dict></array>
<key>metadata</key><dict><key>bundle-identifier</key><string>com.solerte.unijovem.hml</string><key>bundle-version</key><string>$VERSAO</string><key>kind</key><string>software</string><key>title</key><string>Uni Jovem HML</string></dict>
</dict></array></dict></plist>
PLIST
  cat > \$D.novo/index.html <<HTML
<!doctype html><html lang=\"pt-BR\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">
<title>Instalar Uni Jovem HML</title>
<body style=\"font:17px -apple-system,system-ui,sans-serif;background:#12102A;color:#F5F3FF;margin:0;padding:32px 20px;line-height:1.5\">
<h1 style=\"font-size:26px\">Uni Jovem (homologação)</h1>
<p>Versão $VERSAO. Abra esta página no Safari do iPhone cadastrado.</p>
<p><a style=\"display:inline-block;background:#FF8A65;color:#1A0F0A;padding:14px 22px;border-radius:12px;font-weight:600;text-decoration:none\" href=\"itms-services://?action=download-manifest&amp;url=$BASE/manifest.plist\">Instalar o app</a></p>
<p>Depois de instalar: Ajustes, Privacidade e Segurança, Modo de Desenvolvedor, ligar e reiniciar.</p>
</body></html>
HTML
  chmod -R a+rX \$D.novo
  rm -rf \$D.antiga; [ -d \$D ] && mv \$D \$D.antiga; mv \$D.novo \$D; rm -rf \$D.antiga"
echo "Link: $BASE"
