import { formatarDuracaoDaMusica } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { EncontroDoMeuRepertorio, ItemDoMeuRepertorio } from '@/servicos/contratoDoRepertorio'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { falarQuando } from '@/utilidades/datas'

import { confirmarQueNaoPodeIr, useResponderEscala } from '../escalas/consultas'
import { CHIP_DO_ESTADO_DA_ATRIBUICAO } from '../eventos/nomes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useMeuRepertorio } from './consultas'

/** O tom em que a pessoa toca: o tom do dia, ou o original quando ninguém definiu outro. */
export function tomDoItem(
  item: Pick<ItemDoMeuRepertorio, 'tomDoDia' | 'tomOriginal'>,
): string | null {
  return item.tomDoDia ?? item.tomOriginal
}

function descricaoDoItem(item: ItemDoMeuRepertorio): string {
  const tom = tomDoItem(item)
  const partes = [
    tom
      ? item.tomDoDia && item.tomOriginal && item.tomDoDia !== item.tomOriginal
        ? `Tom do dia ${tom} (original ${item.tomOriginal})`
        : `Tom ${tom}`
      : 'Tom não informado',
    item.andamentoBpm ? `${item.andamentoBpm} bpm` : null,
    formatarDuracaoDaMusica(item.duracaoSeg) || null,
    item.cifra && item.cifra.trim() ? null : 'Sem cifra',
  ]
  return partes.filter(Boolean).join(' · ')
}

/**
 * Rota `/meu-repertorio` (D61): o que a pessoa toca nos próximos encontros em
 * que foi convocada ao louvor, com o tom do dia de cada música. Quem não foi
 * convocado vê como isso funciona. A cifra abre numa tela de leitura, com a
 * letra grande, o tom e o capotraste (online: o uso sem internet é a fatia 2).
 */
export function TelaMeuRepertorio() {
  const { comunidadeAtiva } = useSessao()
  const meu = useMeuRepertorio(comunidadeAtiva?.id ?? null)

  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo="Meu repertório">
        <SemComunidade oQue="o seu repertório" />
      </Tela>
    )
  }
  return (
    <Tela
      pilha
      titulo="Meu repertório"
      descricao="As músicas que você toca nos próximos encontros, no tom do dia."
    >
      {meu.isPending ? (
        <Esqueleto rotulo="Carregando o seu repertório">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
        </Esqueleto>
      ) : meu.error ? (
        <ErroDaTela
          erro={meu.error}
          titulo="O seu repertório não abriu"
          aoTentarDeNovo={() => void meu.refetch()}
        />
      ) : meu.data.length === 0 ? (
        <EstadoVazio
          icone="musica"
          titulo="Você não está convocado para o louvor"
          descricao="Quando a organização convocar você para o louvor de um encontro, o repertório aparece aqui."
          acao={{ titulo: 'Ver minhas escalas', aoPressionar: () => router.push('/escalas') }}
        />
      ) : (
        meu.data.map((e, i) => (
          <CartaoDoEncontro
            key={e.evento.id}
            encontro={e}
            comunidadeId={comunidadeAtiva.id}
            primeiro={i === 0}
          />
        ))
      )}
    </Tela>
  )
}

function CartaoDoEncontro({
  encontro,
  comunidadeId,
  primeiro,
}: {
  encontro: EncontroDoMeuRepertorio
  comunidadeId: string
  primeiro: boolean
}) {
  const responder = useResponderEscala(comunidadeId)
  const pendente = encontro.convocacoes.find((c) => c.estado === 'pendente') ?? null
  const funcoes = encontro.convocacoes.map((c) => c.funcao).join(', ')
  const estadoDaPrimeira = encontro.convocacoes[0]
  const chip = estadoDaPrimeira ? CHIP_DO_ESTADO_DA_ATRIBUICAO[estadoDaPrimeira.estado] : null

  async function naoPossoIr() {
    if (pendente && (await confirmarQueNaoPodeIr())) {
      responder.mutate({ atribuicaoId: pendente.atribuicaoId, resposta: 'recusar' })
    }
  }

  return (
    <CartaoDeVidro
      sobrancelha={primeiro ? 'Próximo encontro' : 'Depois'}
      comecaComTitulo
      {...(chip && !pendente ? { extra: <Chip texto={chip.texto} tom={chip.tom} /> } : {})}
      acoes={
        pendente ? (
          <ParDeBotoes>
            <Botao
              titulo="Aceitar"
              rotuloAcessivel={`Aceitar a convocação em ${encontro.evento.titulo}, ${pendente.funcao}`}
              carregando={responder.isPending && responder.variables?.resposta === 'confirmar'}
              aoPressionar={() =>
                responder.mutate({ atribuicaoId: pendente.atribuicaoId, resposta: 'confirmar' })
              }
            />
            <Botao
              titulo="Não posso ir"
              variante="secundario"
              rotuloAcessivel={`Não posso ir: avisar a organização sobre ${encontro.evento.titulo}`}
              carregando={responder.isPending && responder.variables?.resposta === 'recusar'}
              aoPressionar={() => void naoPossoIr()}
            />
          </ParDeBotoes>
        ) : undefined
      }
    >
      <View
        accessible
        accessibilityLabel={`${encontro.evento.titulo}, ${falarQuando(encontro.evento.inicio, encontro.evento.fuso)}. Minha função: ${funcoes}.`}
        style={{ gap: ESPACO.e4 }}
      >
        <Texto variante="tituloItem">{encontro.evento.titulo}</Texto>
        <Texto variante="meta" cor="textoSuave">
          {`${falarQuando(encontro.evento.inicio, encontro.evento.fuso)} · Minha função: ${funcoes}`}
        </Texto>
      </View>
      {responder.error ? <AvisoDeFalha erro={responder.error} /> : null}
      {encontro.itens.length === 0 ? (
        <Texto variante="corpo" cor="textoSuave">
          O repertório deste encontro ainda não foi montado. Quando for, ele aparece aqui.
        </Texto>
      ) : (
        <Lista>
          {encontro.itens.map((item, i) => (
            <LinhaDeLista
              key={item.id}
              hora={String(i + 1)}
              titulo={item.titulo}
              descricao={descricaoDoItem(item)}
              rotuloAcessivel={`Música ${i + 1} de ${encontro.itens.length}: ${item.titulo}. ${descricaoDoItem(item)}. Abrir a cifra.`}
              aoPressionar={() =>
                router.push({
                  pathname: '/meu-repertorio/[eventoId]/[itemId]',
                  params: { eventoId: encontro.evento.id, itemId: item.id },
                })
              }
            />
          ))}
        </Lista>
      )}
    </CartaoDeVidro>
  )
}
