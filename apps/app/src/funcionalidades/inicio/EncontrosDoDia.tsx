import { ALTURA, ESPACO, RITMO } from '@uj/tokens'
import { router } from 'expo-router'
import { Pressable, View } from 'react-native'

import type { EncontroDoDia } from '@/servicos/contratoV3'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { Icone } from '@/ui/Icone'
import { ColunaDeHora, Lista, RECUO_DA_LISTA } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { formatarHora } from '@/utilidades/datas'

import { AvisoDeHorario } from '../agenda/AvisoDeHorario'
import { avisoDeHorario } from '../agenda/dias'
import { textoDaSuaParte } from '../agenda/semanas'
import { NOME_DO_STATUS } from '../eventos/nomes'

interface Props {
  /** "Hoje: 3 encontros" (ver `tituloDoBlocoDoDia`). */
  titulo: string
  encontros: readonly EncontroDoDia[]
  /** O encontro que o cartão do momento mostra: a linha dele ganha o fundo quente e "Próximo". */
  idDoCartao: string
}

/** A palavra da situação do encontro dentro do dia, para o chip e para o leitor de tela. */
function situacaoDaLinha(e: EncontroDoDia, doCartao: boolean): string | null {
  if (e.status === 'cancelado') return NOME_DO_STATUS.cancelado
  if (e.status === 'adiado') return NOME_DO_STATUS.adiado
  if (e.status === 'rascunho') return NOME_DO_STATUS.rascunho
  if (e.situacao === 'agora') return 'Agora'
  if (e.situacao === 'terminou') return 'Terminou'
  return doCartao ? 'Próximo' : null
}

/**
 * Vários encontros no mesmo dia (D79): "Hoje: 3 encontros", a lista por horário, uma linha por
 * encontro com a hora (começo e fim), o título, a situação ("Terminou", "Agora", "Próximo") e "o seu
 * papel" ("Você: Louvor · Vocal"). O encontro do cartão tem o fundo quente. Encontros que se
 * encostam dizem "Ao mesmo tempo que ...". Toque em qualquer linha abre o encontro. Só aparece com
 * 2 ou mais (quem chama decide); com um só o cartão basta.
 */
export function EncontrosDoDia({ titulo, encontros, idDoCartao }: Props) {
  const ativos = encontros.filter((e) => e.status !== 'cancelado')
  return (
    <Secao titulo={titulo} estilo="titulo">
      <CartaoDeVidro lista>
        <Lista recuo={RECUO_DA_LISTA.hora}>
          {encontros.map((e) => (
            <LinhaDoDia
              key={e.id}
              encontro={e}
              doCartao={e.id === idDoCartao}
              aviso={e.status === 'cancelado' ? null : avisoDeHorario(e, ativos)}
            />
          ))}
        </Lista>
      </CartaoDeVidro>
    </Secao>
  )
}

function LinhaDoDia({
  encontro: e,
  doCartao,
  aviso,
}: {
  encontro: EncontroDoDia
  doCartao: boolean
  aviso: string | null
}) {
  const { cores, solido } = useTema()
  const inicio = formatarHora(e.inicio, e.fuso)
  const fim = formatarHora(e.fim, e.fuso)
  const situacao = situacaoDaLinha(e, doCartao)
  const voce = textoDaSuaParte(e.suaParte)
  // "Terminou" e "Próximo" são palavras na mesma linha do papel ("Próximo · Você: Louvor"); só o que
  // pede atenção (Agora, Adiado, Cancelado, Rascunho) ganha chip. Menos blocos por linha (D79).
  const soTexto = situacao === 'Terminou' || situacao === 'Próximo'
  const chipDaSituacao = soTexto ? null : situacao
  const linhaDoPapel = [soTexto ? situacao : null, voce].filter(Boolean).join(' · ') || null
  const pendente = e.suaParte.some((p) => p.estado === 'pendente') && e.status !== 'rascunho'
  const falado = [
    `${inicio} às ${fim}`,
    e.titulo,
    situacao,
    voce,
    pendente ? 'Aguardando sua resposta' : null,
    aviso,
  ]
    .filter(Boolean)
    .join('. ')

  return (
    <Pressable
      testID={`encontro-do-dia-${e.id}`}
      accessibilityRole="button"
      accessibilityLabel={falado}
      accessibilityHint="Abre o encontro."
      onPress={() => router.push({ pathname: '/evento/[eventoId]', params: { eventoId: e.id } })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: ESPACO.e12,
        minHeight: ALTURA.linha,
        paddingHorizontal: RITMO.recuoDoCartao,
        paddingVertical: ESPACO.e12,
        backgroundColor: pressed
          ? cores.botaoTonal
          : doCartao
            ? solido(cores.quenteFundo)
            : 'transparent',
      })}
    >
      <ColunaDeHora inicio={inicio} fim={fim} />
      <View style={{ flex: 1, gap: ESPACO.e4 }}>
        <Texto variante="tituloItem">{e.titulo}</Texto>
        {linhaDoPapel || chipDaSituacao || pendente ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: ESPACO.e8,
              rowGap: ESPACO.e8,
              marginTop: ESPACO.e4,
            }}
          >
            {chipDaSituacao ? <ChipDaSituacao situacao={chipDaSituacao} /> : null}
            {linhaDoPapel ? <Texto variante="apoio">{linhaDoPapel}</Texto> : null}
            {pendente ? <Chip situacao="aguardando" texto="Aguardando sua resposta" /> : null}
          </View>
        ) : null}
        {aviso ? <AvisoDeHorario texto={aviso} /> : null}
      </View>
      <View style={{ height: 22, justifyContent: 'center' }}>
        <Icone nome="avancar" cor={cores.textoSuave} tamanho={14} peso="semibold" />
      </View>
    </Pressable>
  )
}

function ChipDaSituacao({ situacao }: { situacao: string }) {
  if (situacao === 'Agora') return <Chip situacao="aoVivo" texto="Agora" />
  if (situacao === NOME_DO_STATUS.rascunho) return <Chip situacao="rascunho" />
  if (situacao === NOME_DO_STATUS.cancelado)
    return <Chip tom="erro" icone="fechar" texto={situacao} />
  return <Chip tom="alerta" icone="relogio" texto={situacao} />
}
