import { router } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { MenuDeAcoes } from '@/ui/FolhaNaTela'
import type { DataLocal } from '@/utilidades/datas'

import { dataCurtaDoEncontro } from '../agenda/semanas'
import { usePode } from '../comunidade/permissoes'
import { useAnterioresParaCopiar } from './consultas'

/**
 * Folha "Novo encontro" (D69, seção 3.3): "Igual ao último encontro" (recomendado, leva à
 * conferência), "Encontro padrão", "A partir de um modelo" e "Em branco". Sem encontro realizado
 * para copiar, a primeira opção continua à vista, desabilitada com o motivo escrito: a pessoa
 * sabe por que não pode, em vez de achar que o app não tem o recurso. Com a data de um dia do
 * calendário (`data`), as demais opções já nascem nela.
 */
export function FolhaNovaProgramacao({
  aberta,
  aoFechar,
  data,
}: {
  aberta: boolean
  aoFechar: () => void
  /** O dia já escolhido (Agenda). Sem ele, a pessoa escolhe o dia no calendário. */
  data?: DataLocal
}) {
  const pode = usePode()
  const { comunidadeAtiva } = useSessao()
  const comData = data ? { data } : {}
  const anteriores = useAnterioresParaCopiar(comunidadeAtiva?.id ?? null, aberta)
  const ultimo = anteriores.data?.opcoes[0] ?? null
  const semAnterior = anteriores.isSuccess && anteriores.data.opcoes.length === 0

  return (
    <MenuDeAcoes
      aberto={aberta}
      titulo="Novo encontro"
      aoFechar={aoFechar}
      acoes={[
        {
          titulo: 'Igual ao último encontro',
          icone: 'copiar',
          descricao: ultimo
            ? `${ultimo.titulo}, ${dataCurtaDoEncontro(ultimo.inicio, ultimo.fuso)}: o roteiro e a equipe já vêm`
            : 'O roteiro e a equipe do último encontro, numa data nova',
          chip: 'Recomendado',
          motivo: semAnterior ? 'Ainda não há um encontro realizado para copiar.' : null,
          navega: true,
          aoPressionar: () => router.push('/evento/igual-ao-ultimo'),
        },
        {
          titulo: 'Encontro padrão',
          icone: 'modelo',
          descricao: 'As etapas de sempre, todas editáveis',
          navega: true,
          aoPressionar: () =>
            router.push({
              pathname: '/evento/novo',
              params: { modelo: 'sabado_padrao', ...comData },
            }),
        },
        pode('modelo', 'ler') && {
          titulo: 'A partir de um modelo',
          icone: 'duplicar',
          descricao: 'Os modelos da comunidade e os do app',
          navega: true,
          aoPressionar: () =>
            router.push({ pathname: '/evento/novo', params: { modelo: 'escolher', ...comData } }),
        },
        {
          titulo: 'Em branco',
          icone: 'adicionar',
          descricao: 'Você monta o roteiro depois',
          navega: true,
          aoPressionar: () =>
            router.push(data ? { pathname: '/evento/novo', params: { data } } : '/evento/novo'),
        },
      ]}
    />
  )
}
