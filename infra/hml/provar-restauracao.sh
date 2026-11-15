#!/bin/sh
# Ensaio de restauração: restaura o backup mais recente num banco temporário,
# dentro do próprio container do Postgres, e compara a contagem de linhas de
# cada tabela de `uj` com a do banco em uso. Não toca no banco em uso.
# Rodar no Mac:  sh ~/srv/apps/unijovem-hml/codigo/infra/hml/provar-restauracao.sh
set -eu
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
cd "$(dirname "$0")/../../.."
export DOCKER_CONFIG="$PWD/.docker"

ultimo=$(ls -1t backups/*.dump | head -1)
echo "Restaurando $ultimo num banco temporário..."
psql_su() { docker exec -i unijovem-hml-banco psql -U postgres -v ON_ERROR_STOP=1 -qAt "$@"; }

psql_su -d postgres -c 'drop database if exists uj_ensaio' -c 'create database uj_ensaio'
docker exec -i unijovem-hml-banco pg_restore -U postgres -d uj_ensaio --no-owner --role=postgres < "$ultimo"

contar() {
  psql_su -d "$1" -c "select string_agg(format('%s=%s', relname, n), ' ' order by relname) from (
    select c.relname, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from uj.%I', c.relname), false, true, '')))[1]::text::bigint as n
      from pg_class c join pg_namespace s on s.oid = c.relnamespace
     where s.nspname = 'uj' and c.relkind in ('r', 'p')) t"
}
original=$(contar unijovem)
restaurado=$(contar uj_ensaio)
psql_su -d postgres -c 'drop database uj_ensaio'

if [ "$original" = "$restaurado" ]; then
  echo "$(date '+%Y-%m-%d %H:%M') restauração ok: contagens iguais em todas as tabelas de uj"
  echo "$restaurado" | tr ' ' '\n' | head -40
else
  echo "DIVERGÊNCIA (pode ser escrita entre o backup e agora):"
  echo "original:   $original"
  echo "restaurado: $restaurado"
  exit 1
fi
