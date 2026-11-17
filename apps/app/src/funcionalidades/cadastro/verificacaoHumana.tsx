/** No celular, o cadastro usa os limites de tentativas da API. */
export function useVerificacaoHumana() {
  return {
    elemento: null,
    obterToken: (): string | undefined => undefined,
    reiniciar: () => undefined,
  }
}
