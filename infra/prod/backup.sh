#!/bin/sh
# Backup diário do banco da PRODUÇÃO, rodado NO MAC (launchd, ver
# br.com.solerte.unijovem-prod-backup.plist). Retenção: 7 diários, 4 semanais
# (domingo) e 3 mensais (dia 1). Os arquivos ficam em ./backups com
# permissão 600. Cópia externa no R2 depende da PH-05.
set -eu
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
cd "$(dirname "$0")/../../.."   # ~/srv/apps/unijovem-prod (o script roda de codigo/infra/prod)
export DOCKER_CONFIG="$PWD/.docker"
umask 077
mkdir -p backups

hoje=$(date +%Y-%m-%d)
arquivo="backups/diario-$hoje.dump"
docker exec unijovem-prod-banco pg_dump -U postgres -Fc unijovem > "$arquivo.parcial"
mv "$arquivo.parcial" "$arquivo"

[ "$(date +%u)" = 7 ] && cp "$arquivo" "backups/semanal-$hoje.dump"
[ "$(date +%d)" = 01 ] && cp "$arquivo" "backups/mensal-$hoje.dump"

podar() { ls -1t backups/"$1"-*.dump 2>/dev/null | tail -n +"$(($2 + 1))" | xargs rm -f; }
podar diario 7
podar semanal 4
podar mensal 3

echo "$(date '+%Y-%m-%d %H:%M') backup ok: $arquivo ($(du -h "$arquivo" | cut -f1))"
