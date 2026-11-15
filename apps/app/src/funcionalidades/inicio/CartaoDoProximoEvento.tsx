import { router } from 'expo-router'

import type { EventoDoInicio } from '@/servicos/contratoDosEventos'
import { formatarDuracao, formatarHora } from '@/utilidades/datas'
import { Botao } from '@/ui/Botao'
import { CartaoDeDestaque, LinhaDeHorario, ListaDeHorarios } from '@/ui/CartaoDeDestaque'
import { Chip } from '@/ui/Chip'

import { useEvento } from '../eventos/consultas'
import { rotuloFaladoDoEvento } from '../eventos/LinhaDoEvento'

/** Quantas etapas o cartão mostra antes do "+N etapas" (mockup: três). */
const ETAPAS_NO_CARTAO = 3

function diaDaSemana(iso: string, fuso: string): string {
  const nome = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: fuso }).format(
    new Date(iso),
  )
  // "sábado" vira "Sábado"; "segunda-feira" vira "Segunda".
  const curto = nome.split('-')[0] ?? nome
  return curto.charAt(0).toLocaleUpperCase('pt-BR') + curto.slice(1)
}

interface Props {
  evento: EventoDoInicio
  comunidadeId: string
  fuso: string
  /** Títulos das etapas em que a pessoa está escalada neste evento (marca "Você"). */
  minhasEtapas: readonly string[]
  agora?: Date
}

/**
 * Próximo encontro no Início (mockup e 3.2.1): cartão de destaque com
 * "Sábado · 16:00 · 60 min", chip quente do local, título em Bricolage e as 3
 * primeiras etapas com a hora em coluna e "Você" onde a pessoa está escalada.
 * O cartão inteiro abre a programação. Durante o encontro: chip "Ao vivo", a
 * etapa atual em 600 com um ponto e o primário "Acompanhar ao vivo".
 */
export function CartaoDoProximoEvento({
  evento,
  comunidadeId,
  fuso,
  minhasEtapas,
  agora = new Date(),
}: Props) {
  const detalhe = useEvento(comunidadeId, evento.id)
  const etapas = detalhe.data?.etapas ?? []
  const inicio = new Date(evento.inicio).getTime()
  const aoVivo =
    evento.status === 'publicado' &&
    agora.getTime() >= inicio &&
    agora.getTime() < inicio + evento.duracaoMin * 60_000
  // Ao vivo, a lista começa na etapa em andamento (a última que já começou).
  const indiceAtual = aoVivo
    ? Math.max(
        0,
        etapas.filter((e) => new Date(e.inicioPrevisto).getTime() <= agora.getTime()).length - 1,
      )
    : 0
  const visiveis = etapas.slice(indiceAtual, indiceAtual + ETAPAS_NO_CARTAO)
  const resto = Math.max(0, etapas.length - indiceAtual - visiveis.length)
  const meta = [
    diaDaSemana(evento.inicio, fuso),
    formatarHora(evento.inicio, fuso),
    formatarDuracao(evento.duracaoMin),
  ].join(' · ')
  const abrir = () =>
    router.push({ pathname: '/evento/[eventoId]', params: { eventoId: evento.id } })

  return (
    <CartaoDeDestaque
      meta={meta}
      chip={
        aoVivo ? (
          <Chip texto="Ao vivo" tom="quente" ponto />
        ) : evento.localNome ? (
          <Chip texto={evento.localNome} tom="quente" />
        ) : undefined
      }
      titulo={evento.titulo}
      aoPressionar={abrir}
      rotuloAcessivel={rotuloFaladoDoEvento(evento, fuso)}
      dica="Abre a programação."
      {...(aoVivo
        ? {
            acoes: (
              <Botao
                titulo="Acompanhar ao vivo"
                larguraTotal
                aoPressionar={() =>
                  router.push({
                    pathname: '/evento/[eventoId]/ao-vivo',
                    params: { eventoId: evento.id },
                  })
                }
              />
            ),
          }
        : {})}
    >
      {visiveis.length ? (
        <ListaDeHorarios>
          {visiveis.map((e, i) => (
            <LinhaDeHorario
              key={e.id}
              hora={formatarHora(e.inicioPrevisto, fuso)}
              titulo={e.titulo}
              {...(minhasEtapas.includes(e.titulo) ? { marcador: 'Você' } : {})}
              atual={aoVivo && i === 0}
            />
          ))}
          {resto > 0 ? (
            <LinhaDeHorario hora={`+${resto}`} titulo={resto === 1 ? 'etapa' : 'etapas'} suave />
          ) : null}
        </ListaDeHorarios>
      ) : null}
    </CartaoDeDestaque>
  )
}
