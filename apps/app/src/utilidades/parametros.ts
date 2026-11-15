/** Parâmetro de rota como texto único (o Expo Router pode entregar lista). */
export function parametro(valor: string | string[] | undefined): string | null {
  const v = Array.isArray(valor) ? valor[0] : valor
  return v ? v : null
}
