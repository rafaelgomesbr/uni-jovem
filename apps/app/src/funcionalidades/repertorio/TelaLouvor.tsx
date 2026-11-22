import { router } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { Aviso } from '@/ui/Aviso'
import { Cartao } from '@/ui/Cartao'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { EntradaEmCascata } from '@/ui/primitivasDeMovimento'

import { usePode } from '../comunidade/permissoes'
import { useEvento } from '../eventos/consultas'
import { useInicio } from '../inicio/consultas'
import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
import { BandaDoEncontro } from './BandaDoEncontro'

/**
 * A banda do próximo encontro (o do cartão do Início), lida do próprio encontro: quem toca e, para
 * quem organiza, o que falta. Some enquanto não há encontro ou ele ainda carrega: a lista de
 * atalhos já basta.
 */
function BandaDoProximoEncontro({
  comunidadeId,
  organiza,
}: {
  comunidadeId: string
  organiza: boolean
}) {
  const inicio = useInicio(comunidadeId)
  const eventoId = inicio.data?.momento?.evento?.id ?? inicio.data?.proximosEventos[0]?.id ?? null
  const evento = useEvento(comunidadeId, eventoId)
  if (!evento.data) return null
  return <BandaDoEncontro evento={evento.data} podeConvocar={organiza} />
}

/**
 * Rota `/louvor` (D61, D71, D73): o atalho "Louvor" da aba Comunidade, aberto a toda a
 * comunidade. O repertório do próximo encontro (as músicas, a ordem e o tom do dia) e a banda
 * são de leitura para todos; quem organiza também edita, no próprio encontro. Reúne ainda a
 * Biblioteca de músicas e os músicos.
 */
export function TelaLouvor() {
  const pode = usePode()
  const { comunidadeAtiva } = useSessao()
  const gerencia = pode('conteudo', 'gerenciar')
  const organiza = pode('etapa', 'gerenciar')
  return (
    <TelaDaComunidade
      oQue="o louvor"
      titulo="Louvor"
      descricao="O repertório do próximo encontro, a banda e as músicas."
    >
      {() => (
        <>
          <EntradaEmCascata ordem={1}>
            <Cartao lista>
              <Lista>
                <LinhaDeLista
                  icone="musica"
                  titulo="Repertório do próximo encontro"
                  descricao="As músicas, a ordem e o tom do dia."
                  rotuloAcessivel="Repertório do próximo encontro. As músicas, a ordem e o tom do dia."
                  aoPressionar={() => router.push('/meu-repertorio')}
                />
                <LinhaDeLista
                  icone="conteudo"
                  titulo="Biblioteca de músicas"
                  descricao={
                    gerencia
                      ? 'Cadastre músicas, cifras, tons e andamento.'
                      : 'As músicas da comunidade, com cifras, tons e andamento.'
                  }
                  rotuloAcessivel="Biblioteca de músicas. As músicas da comunidade."
                  aoPressionar={() =>
                    router.push({ pathname: '/conteudos', params: { tipo: 'musicas' } })
                  }
                />
                <LinhaDeLista
                  icone="pessoa"
                  titulo="Músicos"
                  descricao="Quem toca na comunidade e o que toca."
                  rotuloAcessivel="Músicos. Quem toca na comunidade e o que toca."
                  aoPressionar={() =>
                    router.push({ pathname: '/conteudos', params: { tipo: 'musicos' } })
                  }
                />
                <LinhaDeLista
                  icone="eventos"
                  titulo="Encontros"
                  descricao="Abra o encontro e veja o repertório do louvor e a banda."
                  rotuloAcessivel="Encontros. Abra o encontro e veja o repertório do louvor e a banda."
                  aoPressionar={() => router.push('/agenda')}
                />
              </Lista>
            </Cartao>
          </EntradaEmCascata>
          {comunidadeAtiva ? (
            <EntradaEmCascata ordem={2}>
              <BandaDoProximoEncontro comunidadeId={comunidadeAtiva.id} organiza={organiza} />
            </EntradaEmCascata>
          ) : null}
          <Aviso tipo="info" titulo="Só dentro da comunidade">
            As letras e cifras ficam visíveis só para quem é da comunidade: não há link público nem
            exportação.
          </Aviso>
        </>
      )}
    </TelaDaComunidade>
  )
}
