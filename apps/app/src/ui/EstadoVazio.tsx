import { ESPACO, RAIO } from '@uj/tokens'
import { View } from 'react-native'

import { Botao, type VarianteDoBotao } from './Botao'
import { CartaoDeVidro } from './CartaoDeVidro'
import { Icone, type NomeDoIcone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'

interface AcaoDoVazio {
  titulo: string
  aoPressionar: () => void
  icone?: NomeDoIcone
  /** Padrão: primário (é a ação esperada); secundário quando é alternativa. */
  variante?: VarianteDoBotao
}

interface PropsDoEstadoVazio {
  icone: NomeDoIcone
  /** Diz o estado ("Nenhuma programação ainda"). */
  titulo: string
  /** Diz o porquê e o próximo passo (até 3 linhas). */
  descricao: string
  /** O botão executa o próximo passo. Todo estado vazio tem ação. */
  acao?: AcaoDoVazio
  /** Terciário opcional ao lado da ação. */
  acaoSecundaria?: Omit<AcaoDoVazio, 'variante'>
  /** Tela inteira (convite inválido, não encontrado): botão grande de largura total. */
  telaInteira?: boolean
}

/**
 * Estado vazio (seção 2.12.21): dentro de um cartão de vidro, alinhado à
 * esquerda. Ladrilho de 48 (raio 14, fundo quente, ícone de 24), 12, título,
 * 4, descrição, 16, ação. Fora de um cartão, ele mesmo se põe num.
 */
export function EstadoVazio(props: PropsDoEstadoVazio) {
  const { superficie } = useTema()
  if (superficie === 'fundo') {
    return (
      <CartaoDeVidro>
        <Conteudo {...props} />
      </CartaoDeVidro>
    )
  }
  return <Conteudo {...props} />
}

function Conteudo({
  icone,
  titulo,
  descricao,
  acao,
  acaoSecundaria,
  telaInteira = false,
}: PropsDoEstadoVazio) {
  const { cores, solido } = useTema()
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: RAIO.controle,
          backgroundColor: solido(cores.quenteFundo),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icone nome={icone} cor={cores.destaque} tamanho={24} />
      </View>
      <Texto variante="tituloItem" accessibilityRole="header" style={{ marginTop: ESPACO.e12 }}>
        {titulo}
      </Texto>
      <Texto variante="corpo" cor="textoSuave" style={{ marginTop: ESPACO.e4 }}>
        {descricao}
      </Texto>
      {acao || acaoSecundaria ? (
        <View
          style={{
            marginTop: ESPACO.e16,
            alignSelf: telaInteira ? 'stretch' : 'flex-start',
            flexDirection: telaInteira ? 'column' : 'row',
            flexWrap: 'wrap',
            alignItems: telaInteira ? 'stretch' : 'center',
            gap: ESPACO.e10,
          }}
        >
          {acao ? (
            <Botao
              titulo={acao.titulo}
              aoPressionar={acao.aoPressionar}
              variante={acao.variante ?? 'primario'}
              tamanho={telaInteira ? 'grande' : 'medio'}
              larguraTotal={telaInteira}
              {...(acao.icone ? { icone: acao.icone } : {})}
            />
          ) : null}
          {acaoSecundaria ? (
            <Botao
              titulo={acaoSecundaria.titulo}
              aoPressionar={acaoSecundaria.aoPressionar}
              variante="secundario"
              {...(acaoSecundaria.icone ? { icone: acaoSecundaria.icone } : {})}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
