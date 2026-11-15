import { router } from 'expo-router'

import { MenuDeAcoes } from '@/ui/FolhaNaTela'
import type { DataLocal } from '@/utilidades/datas'

import { usePode } from '../comunidade/permissoes'

/**
 * Folha "Nova programação" (3.4.1): Sábado padrão (recomendado), Em branco e
 * A partir de um modelo. É a mesma em Programas e na Agenda; na Agenda, a
 * data do dia escolhido vai junto, e o sábado nunca nasce sem as etapas
 * (auditoria U-07).
 */
export function FolhaNovaProgramacao({
  aberta,
  aoFechar,
  data,
}: {
  aberta: boolean
  aoFechar: () => void
  /** O dia já escolhido (Agenda). Sem ele, o Sábado padrão sugere o próximo sábado. */
  data?: DataLocal
}) {
  const pode = usePode()
  const comData = data ? { data } : {}
  return (
    <MenuDeAcoes
      aberto={aberta}
      titulo="Nova programação"
      aoFechar={aoFechar}
      acoes={[
        {
          titulo: 'Sábado padrão',
          icone: 'modelo',
          descricao: 'As etapas de sempre, todas editáveis',
          chip: 'Recomendado',
          navega: true,
          aoPressionar: () =>
            router.push({
              pathname: '/evento/novo',
              params: { modelo: 'sabado_padrao', ...comData },
            }),
        },
        {
          titulo: 'Em branco',
          icone: 'adicionar',
          descricao: 'Você monta as etapas depois',
          navega: true,
          aoPressionar: () =>
            router.push(data ? { pathname: '/evento/novo', params: { data } } : '/evento/novo'),
        },
        pode('modelo', 'ler') && {
          titulo: 'A partir de um modelo',
          icone: 'duplicar',
          descricao: 'Os modelos da comunidade e os do app',
          navega: true,
          aoPressionar: () =>
            router.push({ pathname: '/evento/novo', params: { modelo: 'escolher', ...comData } }),
        },
      ]}
    />
  )
}
