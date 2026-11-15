// Imagens importadas pelo Metro viram o identificador do recurso (número).
declare module '*.png' {
  const recurso: number
  export default recurso
}
