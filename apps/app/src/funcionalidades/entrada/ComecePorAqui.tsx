import { ALTURA, ESPACO, RAIO } from '@uj/tokens'
import { router, type Href } from 'expo-router'
import { View } from 'react-native'

import { Botao, type VarianteDoBotao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Icone, type NomeDoIcone } from '@/ui/Icone'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { CartaoDoVersiculo } from '../versiculo/CartaoDoVersiculo'
import { MeusPedidos } from './MeusPedidos'

interface Caminho {
  icone: NomeDoIcone
  titulo: string
  descricao: string
  acao: string
  destino: Href
  variante: VarianteDoBotao
}

/**
 * Os três caminhos, do mais comum ao menos comum. Um primário só na tela:
 * quem recebeu um código é a maioria; os outros dois são alternativas.
 */
const CAMINHOS: readonly Caminho[] = [
  {
    icone: 'qr',
    titulo: 'Tenho um código ou convite',
    descricao: 'Digite o código que a liderança passou, leia o QR com a câmera ou cole o link.',
    acao: 'Usar código ou convite',
    destino: '/tenho-um-codigo',
    variante: 'primario',
  },
  {
    icone: 'buscar',
    titulo: 'Procurar minha comunidade',
    descricao: 'Busque pelo nome da igreja ou do grupo e pela cidade, e peça para entrar.',
    acao: 'Procurar comunidade',
    destino: '/procurar-comunidade',
    variante: 'secundario',
  },
  {
    icone: 'adicionar',
    titulo: 'Criar uma comunidade',
    descricao:
      'Para quem lidera um grupo e quer organizar tudo por aqui. Você vira o administrador.',
    acao: 'Criar comunidade',
    destino: '/criar-comunidade',
    variante: 'secundario',
  },
]

/** Um caminho: ladrilho de 48 com o ícone, o título, uma frase e o botão com o verbo. */
function CartaoDoCaminho({ caminho }: { caminho: Caminho }) {
  const { cores, solido } = useTema()
  return (
    <CartaoDeVidro
      acoes={
        <Botao
          titulo={caminho.acao}
          variante={caminho.variante}
          larguraTotal
          aoPressionar={() => router.push(caminho.destino)}
        />
      }
    >
      <View style={{ flexDirection: 'row', gap: ESPACO.e12, alignItems: 'flex-start' }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: ALTURA.controle,
            height: ALTURA.controle,
            borderRadius: RAIO.controle,
            backgroundColor: solido(cores.quenteFundo),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icone nome={caminho.icone} cor={cores.destaque} tamanho={24} />
        </View>
        <View style={{ flex: 1, gap: ESPACO.e4 }}>
          <Texto variante="tituloItem" accessibilityRole="header">
            {caminho.titulo}
          </Texto>
          <Texto variante="corpo" cor="textoSuave">
            {caminho.descricao}
          </Texto>
        </View>
      </View>
    </CartaoDeVidro>
  )
}

/**
 * "Comece por aqui" (ADR 0007): a conta sem comunidade vê três caminhos
 * grandes, cada um com um botão de texto (nada só em ícone), o versículo do
 * dia e, se houver, os próprios pedidos de entrada.
 */
export function ComecePorAqui() {
  return (
    <>
      <MeusPedidos />
      {CAMINHOS.map((c) => (
        <CartaoDoCaminho key={c.titulo} caminho={c} />
      ))}
      <CartaoDoVersiculo />
    </>
  )
}
