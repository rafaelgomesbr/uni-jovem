# App Uni Jovem (`@uj/app`)

Um só projeto Expo (SDK 58, Expo Router) para iOS, Android e a web interna (servida em `/app`).

## Comandos (dentro de `apps/app`)

```bash
npm run tipos   # tsc sem emitir
npm test        # jest (preset jest-expo)
npx expo start  # servidor de desenvolvimento
```

No celular, a API vem de `EXPO_PUBLIC_API_URL` (origem, sem barra no fim). Na web, a API é a mesma origem (`/api`).

## Estrutura

- `src/app/`: só rotas (arquivos finos que reexportam as telas). `(publico)` e `(autenticado)` têm guarda que redireciona.
- `src/funcionalidades/<funcionalidade>/`: telas e componentes de cada funcionalidade (autenticação, convite, início, comunidade, perfil, plataforma, navegação).
- `src/estado/`: sessão (provedor React), cliente do React Query, comunidade ativa por conta, ganchos de encerramento de sessão.
- `src/servicos/`: cliente da API, erros, contrato das respostas, aparelho.
- `src/ui/`: componentes base (Texto, Botao, Campo, Cartao, Tela, EstadoVazio, AvisoDeErro, Vidro, ícones) e tema a partir de `@uj/tokens`.
- `src/utilidades/`: fragmento do link (`#t=`), confirmação, cópia e WhatsApp, formatos.

## Mapa de estado

| Dado                                             | Onde vive                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| Conta, comunidades, membros, convites, aparelhos | Servidor: React Query (chaves de comunidade levam o id dela)                |
| Token de acesso                                  | Memória do cliente da API (nunca em disco)                                  |
| Refresh                                          | Celular: Keychain/Keystore (`expo-secure-store`); web: cookie HttpOnly      |
| Comunidade ativa                                 | Preferência local por conta (SecureStore no celular, `localStorage` na web) |
| Fase da sessão, desafio de 2FA em andamento      | `ProvedorDeSessao`                                                          |
| Tokens de convite, redefinição e primeiro acesso | Fragmento da URL (`#t=`), lido e apagado da barra de endereço na web        |
| Formulários                                      | Estado local da tela                                                        |
