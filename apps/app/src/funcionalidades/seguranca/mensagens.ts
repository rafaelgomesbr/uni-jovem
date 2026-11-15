import { BiometriaRecusada } from '@/servicos/armazenamentoDoRefresh'
import { mensagemDoErro } from '@/servicos/erros'

/** Texto humano para falhas da biometria (sem termo técnico). */
export function mensagemDaBiometria(erro: unknown, nome: string): string {
  if (erro instanceof BiometriaRecusada) {
    return `Não deu para confirmar o ${nome}. Tente de novo ou deixe para depois.`
  }
  if (erro instanceof Error && !('mensagem' in erro)) {
    return `Não foi possível ligar o ${nome} agora. Tente de novo em instantes.`
  }
  return mensagemDoErro(erro)
}
