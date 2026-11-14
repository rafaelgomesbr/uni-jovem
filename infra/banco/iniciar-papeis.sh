#!/bin/sh
# Roda uma vez, na criação do volume do Postgres (docker-entrypoint-initdb.d):
# cria os três papéis e o banco com as senhas que vêm do ambiente do container.
# As senhas nunca são escritas em arquivo nem em log.
set -eu
psql -v ON_ERROR_STOP=1 --username postgres \
  -v senha_dono="$UJ_SENHA_DONO" \
  -v senha_api="$UJ_SENHA_API" \
  -v senha_auth="$UJ_SENHA_AUTH" \
  -f /papeis.sql
