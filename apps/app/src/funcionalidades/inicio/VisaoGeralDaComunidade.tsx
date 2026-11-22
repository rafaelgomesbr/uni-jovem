import { router } from 'expo-router'

import type { VisaoGeralDaComunidade } from '@/servicos/contratoDosEventos'
import type { NomeDoIcone } from '@/ui/Icone'

import { DESTINO_DE_ESCALAS } from '../navegacao/Redirecionamentos'
import { plural } from './LinhaDeNumero'

/** Uma linha do resumo: o verbo do que o toque faz e para onde ele leva. */
export interface LinhaDoResumo {
  chave: string
  icone: NomeDoIcone
  titulo: string
  destino: string
  aoPressionar: () => void
}

/**
 * "Da organização" no resumo do Início (D59, D62), para organizador e
 * administrador: só o que pede ação, cada linha com o verbo e o destino. Só
 * contagens: nome, contato e pedido de oração não passam por aqui. Antes isto
 * era uma aba inteira ("Da comunidade", com "Próximos 14 dias" e "Números da
 * comunidade"); a Agenda e os Relatórios já fazem esse papel.
 */
export function linhasDaOrganizacao(d: VisaoGeralDaComunidade): LinhaDoResumo[] {
  const linhas: LinhaDoResumo[] = []
  const { semResposta, recusadas } = d.convocacoes
  // Quem organiza resolve no encontro que tem o problema (a aba Convocados); sem ele, na Agenda.
  const encontroComProblema = (
    d.proximosEncontros.find((e) => e.semResposta > 0) ??
    d.proximosEncontros.find((e) => e.recusadas > 0)
  )?.id
  const verConvocados = () =>
    encontroComProblema
      ? router.push({
          pathname: '/evento/[eventoId]',
          params: { eventoId: encontroComProblema, aba: 'convocados' },
        })
      : router.push(DESTINO_DE_ESCALAS)
  if (semResposta > 0) {
    linhas.push({
      chave: 'sem-resposta',
      icone: 'agenda',
      titulo: `Ver ${plural(semResposta, 'convocação sem resposta', 'convocações sem resposta')}`,
      destino: encontroComProblema ? 'o encontro' : 'Agenda',
      aoPressionar: verConvocados,
    })
  }
  if (recusadas > 0) {
    linhas.push({
      chave: 'recusadas',
      icone: 'cancelar',
      titulo: `Ver ${plural(recusadas, 'convocação recusada', 'convocações recusadas')}`,
      destino: encontroComProblema ? 'o encontro' : 'Agenda',
      aoPressionar: verConvocados,
    })
  }
  if (d.pedidosDeEntrada > 0) {
    linhas.push({
      chave: 'entrada',
      icone: 'pessoas',
      titulo: `Ver ${plural(d.pedidosDeEntrada, 'pedido de entrada', 'pedidos de entrada')}`,
      destino: 'Comunidade',
      aoPressionar: () => router.push('/comunidade'),
    })
  }
  if (d.denunciasAbertas !== null && d.denunciasAbertas > 0) {
    linhas.push({
      chave: 'denuncias',
      icone: 'denuncia',
      titulo: `Ver ${plural(d.denunciasAbertas, 'denúncia aberta', 'denúncias abertas')}`,
      destino: 'Denúncias',
      aoPressionar: () => router.push('/denuncias'),
    })
  }
  if (d.tarefasAtrasadas > 0) {
    linhas.push({
      chave: 'atrasadas',
      icone: 'tarefas',
      titulo: `Ver ${plural(d.tarefasAtrasadas, 'tarefa atrasada', 'tarefas atrasadas')}`,
      destino: 'Agenda',
      aoPressionar: () => router.push({ pathname: '/agenda', params: { vista: 'lista' } }),
    })
  }
  return linhas
}

/** Fixa para quem organiza e não conta no título: leva aos números, não pede ação. */
export const LINHA_DOS_NUMEROS: LinhaDoResumo = {
  chave: 'numeros',
  icone: 'relatorio',
  titulo: 'Ver os números e relatórios',
  destino: 'Relatórios',
  aoPressionar: () => router.push('/relatorios'),
}
