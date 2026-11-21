import { router } from 'expo-router'

import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha } from '@/ui/Falha'
import { Lista } from '@/ui/LinhaDeLista'

import { LinhaDeNumero, plural } from './LinhaDeNumero'
import { useMinhaVisaoGeral } from './visaoGeral'

/**
 * "Seu resumo" na Minha visão (D59): os números da pessoa nesta comunidade,
 * cada um com o toque certo. Só aparece quando há algo a mostrar: com tudo
 * zerado, quem fala é o estado vazio do Início. Se os números não carregam,
 * o resto do Início continua funcionando e este bloco pede para tentar de novo.
 */
export function MinhaVisaoGeral({ comunidadeId }: { comunidadeId: string }) {
  const consulta = useMinhaVisaoGeral(comunidadeId)

  // Sem rede e sem nada carregado, o bloco simplesmente não aparece (o Início já avisa).
  if (consulta.isPending && consulta.fetchStatus === 'paused') return null
  if (consulta.isPending) {
    return (
      <Esqueleto rotulo="Carregando o seu resumo">
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (consulta.error) {
    return (
      <AvisoDeFalha
        erro={consulta.error}
        titulo="Não deu para carregar o seu resumo"
        aoTentarDeNovo={() => void consulta.refetch()}
      />
    )
  }

  const d = consulta.data
  const tudoZerado =
    d.convocacoesParaResponder === 0 &&
    d.convocacoesProximas === 0 &&
    d.tarefasAbertas === 0 &&
    d.inscricoes === 0 &&
    d.presenca30dias.encontros === 0 &&
    d.oracoesAtivas === 0
  if (tudoZerado) return null

  return (
    <CartaoDeVidro sobrancelha="Seu resumo" lista>
      <Lista>
        <LinhaDeNumero
          icone="abaEscalas"
          titulo="Convocações para responder"
          valor={String(d.convocacoesParaResponder)}
          atencao={d.convocacoesParaResponder > 0}
          destino="Escalas"
          aoPressionar={() => router.push('/escalas')}
        />
        <LinhaDeNumero
          icone="check"
          titulo="Convocações aceitas"
          descricao="Próximos encontros"
          valor={String(d.convocacoesProximas)}
          destino="Escalas"
          aoPressionar={() => router.push('/escalas')}
        />
        <LinhaDeNumero icone="tarefas" titulo="Tarefas abertas" valor={String(d.tarefasAbertas)} />
        <LinhaDeNumero
          icone="eventos"
          titulo="Inscrições em encontros"
          valor={String(d.inscricoes)}
        />
        <LinhaDeNumero
          icone="pessoa"
          titulo="Presença nos últimos 30 dias"
          valor={`${d.presenca30dias.presentes} de ${d.presenca30dias.encontros}`}
          descricao={plural(d.presenca30dias.encontros, 'encontro', 'encontros')}
        />
        <LinhaDeNumero
          icone="oracao"
          titulo="Pedidos de oração ativos"
          valor={String(d.oracoesAtivas)}
          destino="Oração"
          aoPressionar={() => router.push('/oracao')}
        />
      </Lista>
    </CartaoDeVidro>
  )
}
