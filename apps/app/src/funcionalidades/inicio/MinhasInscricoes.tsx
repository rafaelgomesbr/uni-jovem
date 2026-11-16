import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { InscricaoMinha, RespostaDasMinhasInscricoes } from '@/servicos/contratoDosEventos'
import { dataDoInstante, falarQuando, formatarHora } from '@/utilidades/datas'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'

import { naComunidade } from '../eventos/consultas'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** As próprias inscrições ativas em eventos que ainda não terminaram (`GET /inscricoes/eu`). */
export function useMinhasInscricoes(comunidadeId: string) {
  return useQuery({
    queryKey: CHAVES.minhasInscricoes(comunidadeId),
    queryFn: () =>
      api
        .get<RespostaDasMinhasInscricoes>(
          `${naComunidade(comunidadeId)}/inscricoes/eu?periodo=proximas`,
        )
        .then((r) => r.inscricoes),
    // API antiga (sem a rota) ou sem rede: o cartão simplesmente não aparece.
    retry: false,
  })
}

function linha(i: InscricaoMinha) {
  const [, mes, dia] = dataDoInstante(i.evento.inicio, i.evento.fuso).split('-')
  const hora = formatarHora(i.evento.inicio, i.evento.fuso)
  const espera = i.estado === 'espera'
  return (
    <LinhaDeLista
      key={i.inscricaoId}
      data={{ dia: dia ?? '', mes: MESES[Number(mes) - 1] ?? '' }}
      titulo={i.evento.titulo}
      descricao={[hora, i.evento.localNome].filter(Boolean).join(' · ')}
      extra={
        i.presente ? (
          <Chip texto="Presente" tom="sucesso" icone="check" />
        ) : espera ? (
          <Chip texto="Na espera" tom="alerta" />
        ) : (
          <Chip texto="Inscrito" tom="sucesso" />
        )
      }
      rotuloAcessivel={`${i.evento.titulo}, ${falarQuando(i.evento.inicio, i.evento.fuso)}. ${
        i.presente ? 'Presença registrada' : espera ? 'Na lista de espera' : 'Inscrição confirmada'
      }. Abrir o encontro e o código de entrada.`}
      aoPressionar={() =>
        router.push({ pathname: '/evento/[eventoId]', params: { eventoId: i.evento.id } })
      }
    />
  )
}

/**
 * "MINHAS INSCRIÇÕES" no Início: cartão lista com os próximos eventos em que
 * a pessoa está inscrita (bloco de data, título, hora e local, chip da
 * situação). Só aparece quando há inscrição próxima; abre o evento, onde
 * está o código de entrada.
 */
export function MinhasInscricoes({ inscricoes }: { inscricoes: readonly InscricaoMinha[] }) {
  if (inscricoes.length === 0) return null
  return (
    <CartaoDeVidro sobrancelha="Minhas inscrições" lista>
      <Lista>{inscricoes.slice(0, 3).map(linha)}</Lista>
    </CartaoDeVidro>
  )
}
