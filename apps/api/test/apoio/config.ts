/** Ambiente mínimo válido de desenvolvimento, para os testes. Valores fictícios. */
export function envDeTeste(extra: Record<string, string> = {}): Record<string, string> {
  return {
    UJ_AMBIENTE: 'desenvolvimento',
    URL_PUBLICA: 'http://localhost:8081',
    DATABASE_URL_API: 'postgres://uj_api@localhost/uj',
    DATABASE_URL_AUTH: 'postgres://uj_auth@localhost/uj',
    JWT_SEGREDO: 'j'.repeat(40),
    CONVITE_SEGREDO: 'c'.repeat(40),
    ORACAO_CHAVE: Buffer.alloc(32, 1).toString('base64'),
    TOTP_CHAVE: Buffer.alloc(32, 2).toString('base64'),
    ...extra,
  }
}
