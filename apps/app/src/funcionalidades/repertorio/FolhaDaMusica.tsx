import { nomeDoTom, transporTom } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import type { ItemDoRepertorio } from '@/servicos/contratoDoRepertorio'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { AvisoDeFalha } from '@/ui/Falha'
import { depoisDeFechar, FolhaNaTela } from '@/ui/FolhaNaTela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { LinksDaMusica } from '../conteudos/LinksDaMusica'
import { useMudarItemDoRepertorio } from './consultas'
import { BotoesDoTom } from './ControlesDaCifra'
import { descricaoDoItem } from './rotulosDoRepertorio'

interface Props {
  /** A música aberta; `null` com a folha fechada. */
  item: ItemDoRepertorio | null
  aoFechar: () => void
  comunidadeId: string
  eventoId: string
  /** Abre a cifra (e o PDF) da música; a folha fecha antes. */
  aoAbrirCifra: (item: ItemDoRepertorio) => void
  /** Tira do repertório (com Desfazer); a folha fecha antes. */
  aoTirar: (item: ItemDoRepertorio) => void
  /** "Dá para desfazer por 10 segundos.": o mesmo número que a faixa conta. */
  fraseDoDesfazer: string
}

/**
 * A folha de UMA música do repertório (D80, auditoria de UX 43): tudo o que antes ficava atrás do
 * "Mais" e dos botões de tom da linha. De cima para baixo: o tom do dia (com Descer tom e Subir
 * tom, o campo e "Salvar"), os links do Drive e do YouTube, "Abrir a cifra" e "Tirar do repertório"
 * (a música continua na biblioteca; dá para desfazer).
 */
export function FolhaDaMusica({
  item,
  aoFechar,
  comunidadeId,
  eventoId,
  aoAbrirCifra,
  aoTirar,
  fraseDoDesfazer,
}: Props) {
  return (
    <FolhaNaTela aberta={item !== null} titulo={item?.titulo ?? 'Música'} aoFechar={aoFechar}>
      {item ? (
        <>
          <Texto variante="apoio">{descricaoDoItem(item)}</Texto>
          <CampoDoTom
            key={item.id}
            item={item}
            aoFechar={aoFechar}
            comunidadeId={comunidadeId}
            eventoId={eventoId}
          />
          {item.links && item.links.length > 0 ? (
            <View style={{ gap: ESPACO.e8 }}>
              <Texto variante="sobrancelha" accessibilityRole="header" nivel={3}>
                Links
              </Texto>
              <LinksDaMusica links={item.links} musica={item.titulo} />
            </View>
          ) : null}
          <View style={{ gap: ESPACO.e12 }}>
            <Botao
              titulo={item.temPdf ? 'Abrir a cifra e o PDF' : 'Abrir a cifra'}
              icone="conteudo"
              variante="secundario"
              tamanho="grande"
              larguraTotal
              aoPressionar={() => {
                aoFechar()
                depoisDeFechar(() => aoAbrirCifra(item))
              }}
            />
            <Botao
              titulo="Tirar do repertório"
              icone="excluir"
              variante="destrutivo"
              tamanho="grande"
              larguraTotal
              aoPressionar={() => {
                aoFechar()
                depoisDeFechar(() => aoTirar(item))
              }}
            />
            <Texto variante="apoio">{`A música continua na biblioteca. ${fraseDoDesfazer}`}</Texto>
          </View>
        </>
      ) : null}
    </FolhaNaTela>
  )
}

/** O tom do dia por escrito, com Descer tom e Subir tom para andar a partir do atual. */
function CampoDoTom({
  item,
  aoFechar,
  comunidadeId,
  eventoId,
}: {
  item: ItemDoRepertorio
  aoFechar: () => void
  comunidadeId: string
  eventoId: string
}) {
  const mudar = useMudarItemDoRepertorio(comunidadeId, eventoId)
  const [texto, setTexto] = useState(item.tomDoDia ?? item.tomOriginal ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const atual = nomeDoTom(texto)

  function andar(semitons: number) {
    const base = atual ?? nomeDoTom(item.tomOriginal)
    const novo = base ? transporTom(base, semitons) : null
    if (novo) {
      setTexto(novo)
      setErro(null)
    }
  }

  function salvar() {
    const vazio = texto.trim() === ''
    if (!vazio && atual === null) {
      setErro('Use um tom como G, Am, F#m ou Bb.')
      return
    }
    // Tom igual ao original (ou vazio) volta ao tom original: nada a guardar.
    const tomDoDia = vazio || atual === nomeDoTom(item.tomOriginal) ? null : atual
    mudar.mutate(
      { itemId: item.id, versao: item.versao, tomDoDia },
      {
        onSuccess: () => {
          mostrarToast({ texto: `Tom do dia de ${item.titulo} salvo.` })
          aoFechar()
        },
      },
    )
  }

  return (
    <View style={{ gap: ESPACO.e12 }}>
      <Texto variante="sobrancelha" accessibilityRole="header" nivel={3}>
        Tom do dia
      </Texto>
      <Texto variante="corpo" cor="textoSuave">
        {item.tomOriginal
          ? `O tom original é ${item.tomOriginal}. O tom do dia vale só neste encontro.`
          : 'Esta música não tem tom original cadastrado. O tom do dia vale só neste encontro.'}
      </Texto>
      <BotoesDoTom
        desabilitado={!atual && !item.tomOriginal}
        aoDescer={() => andar(-1)}
        aoSubir={() => andar(1)}
      />
      {item.tomOriginal ? (
        <Botao
          titulo="Voltar ao tom original"
          variante="terciario"
          alinhado
          aoPressionar={() => {
            setTexto(item.tomOriginal ?? '')
            setErro(null)
          }}
        />
      ) : null}
      <Campo
        rotulo="Tom do dia"
        opcional
        value={texto}
        onChangeText={(t) => {
          setTexto(t)
          setErro(null)
        }}
        erro={erro}
        ajuda="Por exemplo: A, Bb, F#m. Vazio vale o tom original."
        maxLength={12}
        autoCapitalize="characters"
      />
      {mudar.error ? <AvisoDeFalha erro={mudar.error} titulo="O tom não foi salvo" /> : null}
      <Botao
        titulo="Salvar tom do dia"
        tamanho="grande"
        larguraTotal
        carregando={mudar.isPending}
        aoPressionar={salvar}
      />
    </View>
  )
}
