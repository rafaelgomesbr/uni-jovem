import { router } from 'expo-router'

import type { VisaoGeralDaComunidade } from '@/servicos/contratoDosEventos'
import type { NomeDoIcone } from '@/ui/Icone'

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
  if (semResposta > 0) {
    linhas.push({
      chave: 'sem-resposta',
      icone: 'abaEscalas',
      titulo: `Ver ${plural(semResposta, 'convocação sem resposta', 'convocações sem resposta')}`,
      destino: 'Escalas',
      aoPressionar: () => router.push('/escalas'),
    })
  }
  if (recusadas > 0) {
    linhas.push({
      chave: 'recusadas',
      icone: 'cancelar',
      titulo: `Ver ${plural(recusadas, 'convocação recusada', 'convocações recusadas')}`,
      destino: 'Escalas',
      aoPressionar: () => router.push('/escalas'),
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
