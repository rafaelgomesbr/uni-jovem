import { MAXIMO_DE_LINKS_DA_MUSICA, MAXIMO_DO_NOME_DO_LINK } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Texto } from '@/ui/Texto'

import {
  chaveDoErroDoLink,
  chaveDoErroDoNomeDoLink,
  linhaEmBranco,
  type LinhaDeLink,
} from './links'
import { AJUDA_DOS_LINKS, AVISO_DE_DIREITOS } from './tipos'

interface Props {
  rotulo: string
  linhas: readonly LinhaDeLink[]
  aoMudar: (linhas: LinhaDeLink[]) => void
  /** Erros por chave (`links`, `links:<id>`, `links:<id>:rotulo`), do mesmo formulário. */
  erros: Readonly<Record<string, string>>
}

/**
 * Links da música (D80): até 3 endereços do Google Drive ou do YouTube, cada um com um nome
 * opcional. Começa sem nenhum (o link é opcional): "Adicionar link" abre o campo, com a ajuda
 * "Cole o link do Drive ou do YouTube". Cada linha tem o seu "Remover" em texto. O erro de cada
 * link diz em palavras o que fazer (sem termo técnico). O aviso de direitos é o mesmo da cifra.
 */
export function CampoDeLinks({ rotulo, linhas, aoMudar, erros }: Props) {
  const cheio = linhas.length >= MAXIMO_DE_LINKS_DA_MUSICA

  function mudar(id: string, parte: Partial<Pick<LinhaDeLink, 'url' | 'rotulo'>>) {
    aoMudar(linhas.map((l) => (l.id === id ? { ...l, ...parte } : l)))
  }

  return (
    <View style={{ gap: ESPACO.e12 }}>
      <View style={{ gap: ESPACO.e4 }}>
        <Texto variante="rotulo" accessibilityRole="header">
          {`${rotulo} (opcional)`}
        </Texto>
        <Texto variante="meta" cor="textoSuave">
          {linhas.length === 0
            ? `${AJUDA_DOS_LINKS} Você pode juntar até ${MAXIMO_DE_LINKS_DA_MUSICA}: a música no YouTube, a cifra no Drive.`
            : AJUDA_DOS_LINKS}
        </Texto>
      </View>

      {linhas.map((l, i) => (
        <View key={l.id} style={{ gap: ESPACO.e12 }}>
          <Campo
            rotulo={`Link ${i + 1}`}
            value={l.url}
            onChangeText={(url) => mudar(l.id, { url })}
            erro={erros[chaveDoErroDoLink(l.id)] ?? null}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect={false}
            exemplo="https://youtu.be/..."
          />
          <Campo
            rotulo={`Nome do link ${i + 1}`}
            opcional
            value={l.rotulo}
            onChangeText={(texto) => mudar(l.id, { rotulo: texto })}
            erro={erros[chaveDoErroDoNomeDoLink(l.id)] ?? null}
            maxLength={MAXIMO_DO_NOME_DO_LINK}
            exemplo="Cifra no Drive"
          />
          <Botao
            titulo="Remover este link"
            icone="excluir"
            variante="secundario"
            tamanho="medio"
            rotuloAcessivel={`Remover o link ${i + 1}`}
            aoPressionar={() => aoMudar(linhas.filter((x) => x.id !== l.id))}
          />
        </View>
      ))}

      {erros['links'] ? (
        <Aviso tipo="erro" titulo="Links demais" anunciar>
          {erros['links']}
        </Aviso>
      ) : null}

      {cheio ? (
        <Texto variante="meta" cor="textoSuave">
          {`Você já adicionou os ${MAXIMO_DE_LINKS_DA_MUSICA} links. Remova um para colocar outro.`}
        </Texto>
      ) : (
        <Botao
          titulo="Adicionar link"
          icone="adicionar"
          variante="secundario"
          tamanho="medio"
          rotuloAcessivel={
            linhas.length === 0
              ? 'Adicionar link do Drive ou do YouTube'
              : 'Adicionar outro link do Drive ou do YouTube'
          }
          aoPressionar={() => aoMudar([...linhas, linhaEmBranco()])}
        />
      )}

      {linhas.length > 0 ? (
        <Aviso tipo="info" titulo="Direitos autorais">
          {AVISO_DE_DIREITOS}
        </Aviso>
      ) : null}
    </View>
  )
}
