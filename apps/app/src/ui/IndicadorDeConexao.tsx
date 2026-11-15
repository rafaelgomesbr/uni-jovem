import { useNetInfo } from '@react-native-community/netinfo'

import { StatusDoCabecalho } from './StatusDoCabecalho'
import { useAnunciar } from './useAnunciar'

/** Status "Sem conexão" (web, sem modo offline). Só aparece quando a rede caiu de fato. */
export function IndicadorDeConexao() {
  const { isConnected } = useNetInfo()
  const semConexao = isConnected === false

  // Avisa o leitor de tela na mudança: o status visual sozinho não é anunciado.
  useAnunciar(semConexao ? 'Sem conexão com a internet' : null)

  if (!semConexao) return null
  return (
    <StatusDoCabecalho
      icone="semConexao"
      cor="alerta"
      texto="Sem conexão"
      rotulo="Sem conexão com a internet. O que depende da rede fica indisponível."
    />
  )
}

/** Há conexão? `null` enquanto o sistema ainda não respondeu. */
export function useSemConexao(): boolean {
  return useNetInfo().isConnected === false
}
