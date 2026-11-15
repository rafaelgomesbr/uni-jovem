# Scripts da API do App Store Connect

Rodam **no Mac**, em `~/srv/builds/asc`, com a chave de API em `~/.appstoreconnect/private_keys/AuthKey_<id>.p8` e o Issuer ID em `~/srv/builds/asc/issuer` (600). Nenhum dos dois entra no git.

- `asc.mjs`: chamada assinada (JWT ES256) à API. Uso: `node asc.mjs <keyId> <issuer> <MÉTODO> <caminho> [corpo]`.
- `revisao.mjs`: preenche o App Review Information da versão (contato, usuário da conta demo e notas). A senha da conta demo não é enviada: o dono cola no App Store Connect.
- `prints.mjs`: sobe as capturas de `prints/apple-6.9` (APP_IPHONE_67) e `prints/apple-6.3` (APP_IPHONE_61) na localização pt-BR, substituindo os conjuntos anteriores.

O envio do build fica em [`../assinar-ios-loja.sh`](../assinar-ios-loja.sh). Enviar para revisão continua dependendo do "sim" do dono (CLAUDE.md, seção 4).
