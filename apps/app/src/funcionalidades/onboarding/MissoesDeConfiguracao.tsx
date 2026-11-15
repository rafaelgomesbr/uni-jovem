import { router } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { NOTIFICACOES_DISPONIVEIS } from '@/servicos/notificacoesDoSistema'
import { Linha } from '@/ui/Linha'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'

import { usePode } from '../comunidade/permissoes'
import { useInicio } from '../inicio/TelaInicio'
import { usePermissaoDoSistema } from '../notificacoes/permissao'
import { useProgressoDaMissao } from './missao'

interface Missao {
  id: string
  titulo: string
  descricao: string
  feita: boolean
  ir: () => void
}

/**
 * Missões de configuração, todas opcionais. O "feito" vem do estado real
 * (perfil com WhatsApp, permissão do aparelho) ou da própria pessoa ao abrir o
 * próximo evento. Só leitura: nenhuma missão grava na API por conta própria.
 */
export function MissoesDeConfiguracao() {
  const { conta, comunidadeAtiva } = useSessao()
  const pode = usePode()
  const permissao = usePermissaoDoSistema()
  const inicio = useInicio(comunidadeAtiva?.id ?? null)
  const { progresso, salvar } = useProgressoDaMissao()
  const feitas = progresso?.feitas ?? []
  const proximo = inicio.data?.proximosEventos[0] ?? null
  const organiza = pode('evento', 'criar')

  const missoes: Missao[] = [
    {
      id: 'perfil',
      titulo: 'Completar o perfil',
      descricao: 'Seu WhatsApp ajuda a organização a falar com você.',
      feita: !!conta?.whatsapp,
      ir: () => router.push('/conta'),
    },
    ...(NOTIFICACOES_DISPONIVEIS
      ? [
          {
            id: 'notificacoes',
            titulo: 'Ativar notificações',
            descricao: 'Saiba quando for escalado ou quando um evento mudar.',
            feita: permissao === 'concedida',
            ir: () => router.push('/notificacoes'),
          },
        ]
      : []),
    {
      id: 'evento',
      titulo: organiza ? 'Preparar o próximo evento' : 'Conferir o próximo encontro',
      descricao: proximo
        ? `${proximo.titulo}: confira etapas, equipe e o que falta.`
        : organiza
          ? 'Monte o próximo encontro a partir do Sábado padrão.'
          : 'Veja na agenda quando é o próximo encontro.',
      feita: feitas.includes('evento'),
      ir: () => {
        if (progresso && !feitas.includes('evento')) {
          salvar({ ...progresso, feitas: [...feitas, 'evento'] })
        }
        if (proximo) {
          router.push({ pathname: '/evento/[eventoId]', params: { eventoId: proximo.id } })
        } else if (organiza) {
          router.push({ pathname: '/evento/novo', params: { modelo: 'sabado_padrao' } })
        } else {
          router.push('/agenda')
        }
      },
    },
  ]

  const restantes = missoes.filter((m) => !m.feita).length
  return (
    <>
      <Texto variante="apoio" cor="textoSuave">
        {restantes === 0
          ? 'Tudo configurado.'
          : `Opcional. ${restantes === 1 ? 'Falta 1 item' : `Faltam ${restantes} itens`}, no seu ritmo.`}
      </Texto>
      {missoes.map((m) => (
        <Linha
          key={m.id}
          icone={m.feita ? 'confirmado' : 'pendente'}
          titulo={m.titulo}
          descricao={`${m.feita ? 'Feito. ' : ''}${m.descricao}`}
          extra={m.feita ? <Selo texto="Feito" cor="sucesso" /> : undefined}
          aoPressionar={m.ir}
        />
      ))}
    </>
  )
}
