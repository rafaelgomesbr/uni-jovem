import { ESPACO } from '@uj/tokens'
import type { Ref } from 'react'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import type { NoDeTexto } from '@/ui/foco'
import { IconeDoApp } from '@/ui/IconeDoApp'
import { Texto } from '@/ui/Texto'
import { soNaWeb } from '@/ui/web'

interface PropsDoCabecalhoDeAcesso {
  /**
   * Título grande ("Bem-vindo de volta"), anunciado como cabeçalho de nível 1.
   * Nas telas de pilha o título é o da própria `Tela`, então fica de fora.
   */
  titulo?: string
  /** Uma frase de apoio, em linguagem simples. */
  apoio: string
  refDoTitulo?: Ref<NoDeTexto>
  /** Sem a linha da marca: quando um cartão logo acima já mostra de quem é o convite. */
  semMarca?: boolean
}

/**
 * Topo das telas de acesso (Entrar, Criar conta e convite): a marca (ícone e
 * nome), o título e uma frase de apoio. Um só desenho para as três, para a
 * pessoa reconhecer que está no mesmo lugar.
 */
export function CabecalhoDeAcesso({
  titulo,
  apoio,
  refDoTitulo,
  semMarca = false,
}: PropsDoCabecalhoDeAcesso) {
  return (
    <View style={{ gap: ESPACO.e16 }}>
      {semMarca ? null : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12 }}>
          <IconeDoApp decorativo />
          <Texto variante="tituloItem">{NOME_DO_APP}</Texto>
        </View>
      )}
      <View style={{ gap: ESPACO.e8 }}>
        {titulo ? (
          <Texto variante="display" ref={refDoTitulo} {...soNaWeb({ tabIndex: -1 })}>
            {titulo}
          </Texto>
        ) : null}
        <Texto variante="leitura" cor="textoSuave">
          {apoio}
        </Texto>
      </View>
    </View>
  )
}
