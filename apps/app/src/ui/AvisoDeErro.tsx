import { ESPACO, RAIO } from '@uj/tokens'
import { View } from 'react-native'

import { mensagemDoErro, SemConexao } from '@/servicos/erros'

import { useAnunciar } from './useAnunciar'
import { Botao } from './Botao'
import { Icone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'

interface PropsDoAviso {
  /** Erro de qualquer origem; a mensagem humana vem de `mensagemDoErro`. */
  erro?: unknown
  mensagem?: string
  titulo?: string
  aoTentarDeNovo?: () => void
}

/** Aviso de erro: ícone + título + mensagem, nunca só a cor. */
export function AvisoDeErro({ erro, mensagem, titulo, aoTentarDeNovo }: PropsDoAviso) {
  const { cores } = useTema()
  const semConexao = erro instanceof SemConexao
  const texto = mensagem ?? mensagemDoErro(erro)
  const tituloFinal = titulo ?? (semConexao ? 'Sem conexão' : 'Não deu certo')
  // O papel `alert` não fala no iOS: o anúncio garante que o erro seja ouvido.
  useAnunciar(`${tituloFinal}. ${texto}`, { naWeb: false })
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        gap: ESPACO.x3,
        padding: ESPACO.x4,
        borderRadius: RAIO.medio,
        borderWidth: 1.5,
        borderColor: cores.erro,
        backgroundColor: cores.superficie,
        alignSelf: 'stretch',
      }}
    >
      <Icone nome={semConexao ? 'semConexao' : 'erro'} cor={cores.erro} />
      <View style={{ flex: 1, gap: ESPACO.x2 }}>
        <Texto variante="corpoForte">{tituloFinal}</Texto>
        <Texto variante="apoio">{texto}</Texto>
        {aoTentarDeNovo ? (
          <Botao
            titulo="Tentar de novo"
            aoPressionar={aoTentarDeNovo}
            variante="secundario"
            larguraTotal={false}
          />
        ) : null}
      </View>
    </View>
  )
}
