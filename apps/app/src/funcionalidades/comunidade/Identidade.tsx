import { BORDA, corSobre, ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import type { ComunidadeDoVinculo } from '@/servicos/contrato'
import { Avatar, type FotoDoAvatar } from '@/ui/Avatar'
import { Icone } from '@/ui/Icone'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { EscolhaDeImagem } from '../perfil/EscolhaDeImagem'
import { logoDaComunidade, useLogotipo, type ComLogo } from '../perfil/imagens'
import { usePode } from './permissoes'

const HEX = /^#[0-9A-Fa-f]{6}$/

interface PropsDaMarca {
  cor: string
  tamanho?: number
  /** Com o nome, a marca é o avatar da comunidade (2.12.13): iniciais na cor dela. */
  nome?: string
  /** Logotipo (D33): cobre o círculo. */
  logo?: FotoDoAvatar | null
}

/**
 * Marca da comunidade: o avatar dela (logotipo, quando há; senão as iniciais
 * na cor da comunidade). Sem nome nem logotipo, o círculo na cor com o ícone
 * de comunidade, como antes. Decorativa: o nome vem ao lado.
 */
export function MarcaDaComunidade({ cor, tamanho = 36, nome, logo }: PropsDaMarca) {
  const { cores } = useTema()
  const fundo = HEX.test(cor) ? cor : cores.primaria
  if (nome !== undefined || logo) {
    return <Avatar nome={nome ?? ''} cor={fundo} lado={tamanho} foto={logo ?? null} decorativo />
  }
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        backgroundColor: fundo,
        borderWidth: BORDA.fina,
        borderColor: cores.separador,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Branco ou quase preto, o que contrastar mais com a cor da comunidade. */}
      <Icone nome="comunidade" cor={corSobre(fundo)} tamanho={tamanho * 0.55} />
    </View>
  )
}

interface PropsDaIdentidade {
  nome: string
  cor: string
  detalhe?: string
  /** Logotipo da comunidade (D33), quando ela já existe e tem um. */
  logo?: FotoDoAvatar | null
}

/**
 * Identidade da comunidade (2.12.13): avatar de 56 (logotipo ou iniciais na
 * cor), nome e detalhe (ex.: papel). Lida como um item só pelo leitor de tela.
 */
export function IdentidadeDaComunidade({ nome, cor, detalhe, logo }: PropsDaIdentidade) {
  const { cores } = useTema()
  const fundo = HEX.test(cor) ? cor : cores.primaria
  return (
    <View
      accessible
      accessibilityLabel={detalhe ? `Comunidade ${nome}. ${detalhe}` : `Comunidade ${nome}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12, flexShrink: 1 }}
    >
      <Avatar nome={nome} cor={fundo} tamanho="comunidade" foto={logo ?? null} decorativo />
      <View style={{ flexShrink: 1 }}>
        <Texto variante="tituloItem">{nome}</Texto>
        {detalhe ? (
          <Texto variante="legenda" cor="textoSuave">
            {detalhe}
          </Texto>
        ) : null}
      </View>
    </View>
  )
}

/**
 * Logotipo da comunidade (D33), só para quem administra: escolher da galeria
 * ou tirar foto (recorte 1:1, reduzido para 512 antes de enviar) e remover.
 * Sem permissão, não aparece (a API também recusa).
 */
export function EditorDoLogotipo({
  comunidade,
}: {
  comunidade: Pick<ComunidadeDoVinculo, 'id' | 'nome' | 'cor'> & ComLogo
}) {
  const pode = usePode()
  const mutacoes = useLogotipo(comunidade.id)
  if (!pode('comunidade', 'trocar_logo')) return null
  return (
    <EscolhaDeImagem
      nome={comunidade.nome}
      foto={logoDaComunidade(comunidade)}
      cor={comunidade.cor}
      mutacoes={mutacoes}
      textos={{
        titulo: 'Logotipo',
        descricao: 'Aparece para os membros na pílula da comunidade e na troca de comunidade.',
        remover: 'Remover logotipo',
        perguntaDeRemover: 'Remover o logotipo?',
        consequenciaDeRemover: 'No lugar dele voltam as iniciais na cor da comunidade.',
        trocada: 'Logotipo atualizado',
        removida: 'Logotipo removido',
      }}
    />
  )
}
