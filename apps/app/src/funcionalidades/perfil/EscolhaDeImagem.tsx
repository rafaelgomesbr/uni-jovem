import { ESPACO } from '@uj/tokens'
import { Platform, View } from 'react-native'

import { mensagemDoErro } from '@/servicos/erros'
import { confirmar } from '@/utilidades/confirmar'
import { Avatar, type DadosDoAvatar, type FotoDoAvatar } from '@/ui/Avatar'
import { Aviso } from '@/ui/Aviso'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import type { MutacoesDaImagem } from './imagens'

interface Textos {
  /** Sobrancelha do cartão ("Foto de perfil", "Logotipo"). */
  titulo: string
  /** O que a imagem é e onde aparece. */
  descricao: string
  /** "Remover foto", "Remover logotipo". */
  remover: string
  /** Pergunta da confirmação ("Remover a foto?"). */
  perguntaDeRemover: string
  /** Consequência ("Volta o avatar de ícone e cor."). */
  consequenciaDeRemover: string
  /** Toast depois de trocar ("Foto atualizada"). */
  trocada: string
  /** Toast depois de remover ("Foto removida"). */
  removida: string
}

interface Props {
  nome: string
  /** A imagem atual (`null`: ainda não tem). */
  foto: FotoDoAvatar | null
  /** O avatar de ícone e cor (D31), que aparece sem foto. */
  avatar?: DadosDoAvatar | null
  /** A própria pessoa (cor primária sem avatar escolhido). */
  proprio?: boolean
  /** Comunidade: a cor dela. */
  cor?: string
  textos: Textos
  mutacoes: MutacoesDaImagem
  /** Terciário extra abaixo do texto (ex.: "Usar ícone e cor"). */
  alternativa?: { titulo: string; aoPressionar: () => void }
}

/**
 * Escolher, trocar e remover uma imagem (D33): prévia no avatar de 72,
 * "Escolher da galeria" e "Tirar foto" (no celular) lado a lado, e o
 * terciário de remover. Erro em linguagem humana; trocar e remover confirmam
 * com toast. A escolha abre o recorte 1:1 do sistema.
 */
export function EscolhaDeImagem({
  nome,
  foto,
  avatar,
  proprio,
  cor,
  textos,
  mutacoes,
  alternativa,
}: Props) {
  const { enviar, remover } = mutacoes
  const ocupado = enviar.isPending || remover.isPending
  const erro = enviar.error ?? remover.error
  const naWeb = Platform.OS === 'web'

  function escolher(origem: 'camera' | 'galeria') {
    remover.reset()
    enviar.mutate(origem, {
      onSuccess: (resposta) => {
        if (resposta) mostrarToast({ texto: textos.trocada })
      },
    })
  }

  async function pedirRemocao() {
    const ok = await confirmar({
      titulo: textos.perguntaDeRemover,
      mensagem: textos.consequenciaDeRemover,
      confirmar: textos.remover,
      destrutivo: true,
    })
    if (!ok) return
    enviar.reset()
    remover.mutate(undefined, { onSuccess: () => mostrarToast({ texto: textos.removida }) })
  }

  return (
    <CartaoDeVidro
      sobrancelha={textos.titulo}
      acoes={
        <ParDeBotoes>
          <Botao
            titulo={naWeb ? 'Escolher imagem' : 'Escolher da galeria'}
            variante="secundario"
            carregando={enviar.isPending && enviar.variables === 'galeria'}
            desabilitado={ocupado}
            aoPressionar={() => escolher('galeria')}
          />
          {naWeb ? null : (
            <Botao
              titulo="Tirar foto"
              variante="secundario"
              carregando={enviar.isPending && enviar.variables === 'camera'}
              desabilitado={ocupado}
              aoPressionar={() => escolher('camera')}
            />
          )}
        </ParDeBotoes>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e16 }}>
        <Avatar
          nome={nome}
          avatar={avatar ?? null}
          foto={foto}
          tamanho="perfil"
          {...(proprio ? { proprio } : {})}
          {...(cor ? { cor } : {})}
          decorativo
        />
        <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
          <Texto variante="corpo" cor="textoSuave">
            {foto ? textos.descricao : `${textos.descricao} Ainda sem imagem.`}
          </Texto>
          {foto ? (
            <Botao
              titulo={textos.remover}
              variante="terciario"
              alinhado
              carregando={remover.isPending}
              desabilitado={enviar.isPending}
              aoPressionar={() => void pedirRemocao()}
            />
          ) : null}
          {alternativa ? (
            <Botao
              titulo={alternativa.titulo}
              variante="terciario"
              alinhado
              aoPressionar={alternativa.aoPressionar}
            />
          ) : null}
        </View>
      </View>
      {erro ? (
        <Aviso tipo="erro" titulo="Não deu para trocar a imagem" anunciar>
          {mensagemDoErro(erro)}
        </Aviso>
      ) : null}
    </CartaoDeVidro>
  )
}
