import { router } from 'expo-router'

import type { EncontroDaVisaoGeral } from '@/servicos/contratoDosEventos'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha } from '@/ui/Falha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { dataDoInstante, falarQuando, formatarHora } from '@/utilidades/datas'

import { usePode } from '../comunidade/permissoes'
import { LinhaDeNumero, plural } from './LinhaDeNumero'
import { useVisaoGeralDaComunidade } from './visaoGeral'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "1,5" no lugar de "1.5". */
const decimal = (n: number) => String(n).replace('.', ',')

function situacao(e: EncontroDaVisaoGeral): { texto: string; atencao: boolean } {
  if (e.convocados === 0) return { texto: 'Sem convocados', atencao: false }
  if (e.semResposta > 0) return { texto: `${e.semResposta} sem resposta`, atencao: true }
  if (e.recusadas > 0) return { texto: plural(e.recusadas, 'recusa', 'recusas'), atencao: true }
  return { texto: 'Todos responderam', atencao: false }
}

function Encontro({ e }: { e: EncontroDaVisaoGeral }) {
  const [, mes, dia] = dataDoInstante(e.inicio, e.fuso).split('-')
  const s = situacao(e)
  // Sem resposta já está no chip; a recusa, quando existe também, vai na descrição.
  const recusa =
    e.semResposta > 0 && e.recusadas > 0 ? plural(e.recusadas, 'recusa', 'recusas') : null
  return (
    <LinhaDeLista
      data={{ dia: dia ?? '', mes: MESES[Number(mes) - 1] ?? '' }}
      titulo={e.titulo}
      descricao={[formatarHora(e.inicio, e.fuso), recusa].filter(Boolean).join(' · ')}
      extra={<Chip texto={s.texto} tom={s.atencao ? 'alerta' : 'sucesso'} />}
      rotuloAcessivel={`${e.titulo}, ${falarQuando(e.inicio, e.fuso)}. ${s.texto}${
        recusa ? `, ${recusa}` : ''
      }. Abrir o encontro.`}
      aoPressionar={() =>
        router.push({ pathname: '/evento/[eventoId]', params: { eventoId: e.id } })
      }
    />
  )
}

/**
 * "Da comunidade" no Início (D59), para organizador e administrador: o que
 * pede resolução (cada número leva à tela certa), os encontros dos próximos 14
 * dias com a situação das convocações e os números gerais. Só contagens: nome,
 * contato e pedido de oração não passam por aqui.
 */
export function VisaoGeralDaComunidade({ comunidadeId }: { comunidadeId: string }) {
  const pode = usePode()
  const consulta = useVisaoGeralDaComunidade(comunidadeId)

  if (consulta.isPending && consulta.fetchStatus === 'paused') {
    return (
      <AvisoDeFalha
        titulo="Sem conexão"
        mensagem="Os números da comunidade voltam quando a internet voltar."
      />
    )
  }
  if (consulta.isPending) {
    return (
      <Esqueleto rotulo="Carregando os números da comunidade">
        <CartaoDeEsqueleto titulo />
        <CartaoDeEsqueleto />
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (consulta.error) {
    return (
      <AvisoDeFalha
        erro={consulta.error}
        titulo="Não deu para carregar a visão da comunidade"
        aoTentarDeNovo={() => void consulta.refetch()}
      />
    )
  }

  const d = consulta.data
  const { semResposta, recusadas } = d.convocacoes
  const podeCriar = pode('evento', 'criar')

  return (
    <>
      <CartaoDeVidro sobrancelha="Para resolver" lista>
        <Lista>
          <LinhaDeNumero
            icone="abaEscalas"
            titulo="Convocações sem resposta"
            valor={String(semResposta)}
            atencao={semResposta > 0}
            destino="Escalas"
            aoPressionar={() => router.push('/escalas')}
          />
          <LinhaDeNumero
            icone="cancelar"
            titulo="Convocações recusadas"
            descricao="Chame outra pessoa"
            valor={String(recusadas)}
            atencao={recusadas > 0}
            destino="Escalas"
            aoPressionar={() => router.push('/escalas')}
          />
          <LinhaDeNumero
            icone="pessoas"
            titulo="Pedidos de entrada"
            valor={String(d.pedidosDeEntrada)}
            atencao={d.pedidosDeEntrada > 0}
            destino="Comunidade"
            aoPressionar={() => router.push('/comunidade')}
          />
          {d.denunciasAbertas !== null ? (
            <LinhaDeNumero
              icone="denuncia"
              titulo="Denúncias abertas"
              valor={String(d.denunciasAbertas)}
              atencao={d.denunciasAbertas > 0}
              destino="Denúncias"
              aoPressionar={() => router.push('/denuncias')}
            />
          ) : null}
          <LinhaDeNumero
            icone="tarefas"
            titulo="Tarefas atrasadas"
            valor={String(d.tarefasAtrasadas)}
            atencao={d.tarefasAtrasadas > 0}
            destino="Agenda"
            aoPressionar={() => router.push({ pathname: '/agenda', params: { vista: 'lista' } })}
          />
        </Lista>
      </CartaoDeVidro>

      {d.proximosEncontros.length > 0 ? (
        <CartaoDeVidro sobrancelha="Próximos 14 dias" lista>
          <Lista>
            {d.proximosEncontros.map((e) => (
              <Encontro key={e.id} e={e} />
            ))}
          </Lista>
        </CartaoDeVidro>
      ) : (
        <CartaoDeVidro sobrancelha="Próximos 14 dias">
          <Texto variante="corpo">Nenhum encontro publicado para os próximos 14 dias.</Texto>
          <Botao
            titulo={podeCriar ? 'Novo encontro' : 'Ver a agenda'}
            variante="terciario"
            alinhado
            aoPressionar={() => router.push(podeCriar ? '/evento/novo' : '/agenda')}
          />
        </CartaoDeVidro>
      )}

      <CartaoDeVidro sobrancelha="Números da comunidade" lista>
        <Lista>
          <LinhaDeNumero
            icone="pessoa"
            titulo="Pessoas ativas"
            valor={String(d.pessoasAtivas)}
            destino="Comunidade"
            aoPressionar={() => router.push('/comunidade')}
          />
          <LinhaDeNumero
            icone="relatorio"
            titulo="Presença média"
            valor={d.presencaMedia.media === null ? 'Sem dados' : decimal(d.presencaMedia.media)}
            descricao={
              d.presencaMedia.media === null
                ? 'Nenhum encontro recente com presença registrada'
                : `Por encontro, nos últimos ${plural(d.presencaMedia.encontros, 'encontro', 'encontros')}`
            }
            destino="Relatórios"
            aoPressionar={() => router.push('/relatorios')}
          />
        </Lista>
      </CartaoDeVidro>
    </>
  )
}
