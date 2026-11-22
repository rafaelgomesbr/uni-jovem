import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import type { PreviaDoCodigo } from '@/servicos/contratoV3'
import { Avatar } from '@/ui/Avatar'
import { Cartao } from '@/ui/Cartao'
import { Chip } from '@/ui/Chip'
import { Texto } from '@/ui/Texto'
import { falarQuando, formatarQuando, fusoDoAparelho } from '@/utilidades/datas'

export type ComunidadeDaPrevia = PreviaDoCodigo['comunidade']

/** "1 pessoa", "15 pessoas". */
export function pessoasDaPrevia(total: number): string {
  return total === 1 ? '1 pessoa' : `${total} pessoas`
}

/**
 * "Você foi convidado para <comunidade>" (D66 e UX v3, fluxos a e j): a prévia pública do código,
 * mostrada ANTES de pedir qualquer dado. É o destaque da tela (o único cartão do momento): o sol
 * nascendo, a cor da comunidade no avatar, quantas pessoas e, se o encontro for público, o
 * próximo. O logotipo não vem na prévia (só `temLogo`), então o avatar usa as iniciais e a cor.
 * Nenhum dado de pessoa aparece aqui: só o que o próprio código já revelaria.
 */
export function PreviaDaComunidade({ comunidade }: { comunidade: ComunidadeDaPrevia }) {
  const proximo = comunidade.proximoEncontro
  const fuso = proximo?.fuso ?? fusoDoAparelho()
  return (
    <Cartao
      variante="momento"
      pose="nascendo"
      etiqueta="Convite"
      titulo={`Você foi convidado para ${comunidade.nome}`}
      rotuloAcessivel={`Convite. Você foi convidado para ${comunidade.nome}. ${pessoasDaPrevia(comunidade.pessoas)}.`}
    >
      <View style={{ gap: ESPACO.e12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12 }}>
          <Avatar nome={comunidade.nome} cor={comunidade.cor} lado={44} decorativo />
          <Texto variante="tituloItem">{pessoasDaPrevia(comunidade.pessoas)}</Texto>
        </View>
        {proximo ? (
          <View
            accessible
            accessibilityLabel={`Próximo encontro: ${proximo.titulo}. ${falarQuando(proximo.inicio, fuso)}`}
          >
            <Texto variante="sobrancelha">Próximo encontro</Texto>
            <Texto variante="tituloItem">{proximo.titulo}</Texto>
            <Texto variante="meta" cor="textoSuave">
              {formatarQuando(proximo.inicio, fuso)}
            </Texto>
          </View>
        ) : null}
        {comunidade.modoEntrada === 'codigo_com_aprovacao' ? (
          <View style={{ alignItems: 'flex-start' }}>
            <Chip texto="A liderança aprova a entrada" tom="neutro" icone="relogio" />
          </View>
        ) : null}
      </View>
    </Cartao>
  )
}
