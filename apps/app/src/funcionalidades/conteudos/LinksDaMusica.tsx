import { linksAbriveisDaMusica, textoDeAbrirLink, type LinkDaMusica } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { Botao } from '@/ui/Botao'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { abrirLink } from '@/utilidades/compartilhar'

/** O aviso de que o toque sai do app. Aparece junto dos botões (uma vez por tela ou por cartão). */
export const AVISO_DE_SAIR_DO_APP =
  'Ao tocar, você sai do Uni Jovem e abre o link no aplicativo ou no navegador do celular. Para voltar, use o botão de voltar do celular.'

export const MENSAGEM_DO_LINK_QUE_NAO_ABRIU =
  'Não deu para abrir o link. Confira se o celular tem o aplicativo ou um navegador e tente de novo.'

/** Abre o link no aplicativo ou no navegador do sistema; se não der, avisa em palavras. */
export async function abrirLinkDaMusica(url: string): Promise<void> {
  const abriu = await abrirLink(url)
  if (!abriu) mostrarToast({ texto: MENSAGEM_DO_LINK_QUE_NAO_ABRIU })
}

interface Props {
  links: readonly LinkDaMusica[] | null | undefined
  /** O título da música, para o nome acessível de cada botão. */
  musica: string
  /** Sem internet o link não abre: os botões ficam parados e dizem por quê. Padrão: com internet. */
  online?: boolean
  /** Sem o aviso de "sai do app": a tela o mostra uma vez só, para a lista inteira. */
  semAviso?: boolean
}

/**
 * Os links da música (D80): um botão por link, "Abrir no YouTube" ou "Abrir no Drive", com ícone,
 * texto e 48 de altura, e o nome do link (se houver) logo acima. Só abre o que passa na regra do
 * domínio (https, só Drive e YouTube): o que vem de fora nunca é aberto sem conferir. Sem links,
 * não desenha nada.
 */
export function LinksDaMusica({ links, musica, online = true, semAviso = false }: Props) {
  const abriveis = linksAbriveisDaMusica(links)
  if (abriveis.length === 0) return null
  return (
    <View style={{ gap: ESPACO.e12 }}>
      {abriveis.map((l) => (
        <View key={`${l.url}|${l.rotulo ?? ''}`} style={{ gap: ESPACO.e4 }}>
          {l.rotulo ? (
            <Texto variante="meta" cor="textoSuave">
              {l.rotulo}
            </Texto>
          ) : null}
          <Botao
            titulo={textoDeAbrirLink(l.tipo)}
            icone="externo"
            variante="secundario"
            tamanho="medio"
            larguraTotal
            rotuloAcessivel={`${textoDeAbrirLink(l.tipo)}: ${l.rotulo ?? musica}`}
            desabilitado={!online}
            motivo="Abrir o link precisa de internet."
            aoPressionar={() => void abrirLinkDaMusica(l.url)}
          />
        </View>
      ))}
      {semAviso ? null : (
        <Texto variante="legenda" cor="textoSuave">
          {AVISO_DE_SAIR_DO_APP}
        </Texto>
      )}
    </View>
  )
}
