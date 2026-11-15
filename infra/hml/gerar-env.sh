#!/bin/sh
# Gera o .env da homologação NO PRÓPRIO SERVIDOR, com segredos aleatórios.
# Não sobrescreve um .env existente (trocar segredo é rotação, com runbook).
# Os valores nunca saem do servidor: nada é impresso.
set -eu
cd "$(dirname "$0")"
DESTINO="${1:-.env}"
if [ -f "$DESTINO" ]; then
  echo "$DESTINO já existe; nada foi alterado."
  exit 0
fi

aleatorio() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-48; }
chave32() { openssl rand -base64 32 | tr -d '\n'; }

SENHA_DONO=$(aleatorio)
SENHA_API=$(aleatorio)
SENHA_AUTH=$(aleatorio)
BANCO=unijovem-hml-banco:5432/unijovem

umask 077
cat > "$DESTINO" <<EOF
UJ_AMBIENTE=homologacao
URL_PUBLICA=https://unijovem-hml.solerte.com.br
URL_PUBLICA_PRODUCAO=https://unijovem.solerte.com.br
# O Caddy compartilhado fala com a API pela rede docker server_edge.
PROXIES_CONFIAVEIS=172.16.0.0/12,10.0.0.0/8,192.168.0.0/16
UJ_SENHA_SUPER=$(aleatorio)
UJ_SENHA_DONO=$SENHA_DONO
UJ_SENHA_API=$SENHA_API
UJ_SENHA_AUTH=$SENHA_AUTH
DATABASE_URL_DONO=postgres://uj_dono:$SENHA_DONO@$BANCO
DATABASE_URL_API=postgres://uj_api:$SENHA_API@$BANCO
DATABASE_URL_AUTH=postgres://uj_auth:$SENHA_AUTH@$BANCO
JWT_SEGREDO=$(aleatorio)
CONVITE_SEGREDO=$(aleatorio)
ORACAO_CHAVE=$(chave32)
TOTP_CHAVE=$(chave32)
# Sem conta no Resend ainda (pendência do dono): e-mail desligado.
EMAIL_MODO=desligado
# Chaves de TESTE oficiais do Cloudflare Turnstile (sempre aprovam). Trocar
# pelas de um widget real antes de abrir a página pública a terceiros.
TURNSTILE_SEGREDO=1x0000000000000000000000000000000AA
TURNSTILE_CHAVE_DO_SITE=1x00000000000000000000AA
# Entrar com Google (IDs de cliente iOS e web do projeto uni-jovem; não são segredo).
GOOGLE_CLIENT_IDS=457514327131-jgjuasb7a9nq7mqv3pcf857thsqnt526.apps.googleusercontent.com,457514327131-i7mraor79i6h8tjbr360jfmv1o6mmmfc.apps.googleusercontent.com
EOF
chmod 600 "$DESTINO"
echo "$DESTINO criado com permissão 600."
