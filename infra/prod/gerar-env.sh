#!/bin/sh
# Gera o .env da PRODUÇÃO no próprio servidor, com segredos aleatórios e
# diferentes dos da homologação. Não sobrescreve um .env existente (trocar
# segredo é rotação, com runbook). Os valores nunca saem do servidor: nada é
# impresso.
#
# O que fica por completar depois (ver infra/prod/LEIA-ME.md):
#   ANDROID_SHA256_IMPRESSOES: acrescentar a chave de assinatura do Google Play;
#   e-mail (Resend), push, Turnstile real e Google: pendências do dono.
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
BANCO=unijovem-prod-banco:5432/unijovem

umask 077
cat > "$DESTINO" <<EOF
UJ_AMBIENTE=producao
URL_PUBLICA=https://unijovem.solerte.com.br
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
# Contato público (página /suporte e páginas legais).
SUPORTE_EMAIL=contact@solerte.com.br
# Impressões SHA-256 do certificado do app Android (assetlinks.json), separadas
# por vírgula. Não são segredo. Hoje só a chave de upload do EAS (lida do .aab
# 1.0.0 (2) com keytool em 15/11/2026); acrescentar a de assinatura do Google
# Play, que aparece em Integridade do app depois do primeiro envio do .aab.
ANDROID_SHA256_IMPRESSOES=55:93:38:FC:BF:34:77:2A:7B:D4:D7:57:95:68:63:DF:EF:29:5F:A1:DC:D7:55:78:42:D1:F8:B7:DB:C0:CB:47
# Sem conta no Resend ainda (pendência do dono): e-mail desligado.
EMAIL_MODO=desligado
# Chaves de TESTE oficiais do Cloudflare Turnstile (sempre aprovam). Trocar
# pelas de um widget real antes de divulgar a página pública de inscrição.
TURNSTILE_SEGREDO=1x0000000000000000000000000000000AA
TURNSTILE_CHAVE_DO_SITE=1x00000000000000000000AA
# Entrar com Google fica desligado até existirem os clientes OAuth do pacote
# de produção (com.solerte.unijovem) no projeto uni-jovem.
EOF
chmod 600 "$DESTINO"
echo "$DESTINO criado com permissão 600."
