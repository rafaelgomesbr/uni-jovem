import { router, useLocalSearchParams } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { ErroDaTela } from '@/ui/Falha'
import { Tela } from '@/ui/Tela'
import { abrirLink } from '@/utilidades/compartilhar'
import { parametro } from '@/utilidades/parametros'

import { SemComunidade } from '../navegacao/SemComunidade'
import { useMeuRepertorio } from './consultas'
import { LeitorDeCifra } from './LeitorDeCifra'

/**
 * Rota `/meu-repertorio/[eventoId]/[itemId]` (D61): a cifra de uma música do
 * Meu repertório, grande e no tom do dia, com anterior e próxima na barra de
 * baixo (botões, nunca só gesto). Os ajustes de tom, capotraste e letra valem só
 * nesta leitura. A cifra vem pela rede: o uso sem internet é a fatia 2.
 */
export function TelaCifraDoRepertorio() {
  const { comunidadeAtiva } = useSessao()
  const params = useLocalSearchParams<{ eventoId: string; itemId: string }>()
  const eventoId = parametro(params.eventoId)
  const itemId = parametro(params.itemId)
  const meu = useMeuRepertorio(comunidadeAtiva?.id ?? null)

  if (!comunidadeAtiva || !eventoId || !itemId) {
    return (
      <Tela pilha titulo="Cifra">
        <SemComunidade oQue="a cifra" />
      </Tela>
    )
  }
  if (meu.isPending) {
    return (
      <Tela pilha titulo="Cifra">
        <Esqueleto rotulo="Carregando a cifra">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Tela>
    )
  }
  if (meu.error) {
    return (
      <Tela pilha titulo="Cifra">
        <ErroDaTela
          erro={meu.error}
          titulo="A cifra não abriu"
          aoTentarDeNovo={() => void meu.refetch()}
        />
      </Tela>
    )
  }
  const encontro = meu.data.find((e) => e.evento.id === eventoId)
  const posicao = encontro ? encontro.itens.findIndex((i) => i.id === itemId) : -1
  const item = encontro && posicao >= 0 ? encontro.itens[posicao] : undefined
  if (!encontro || !item) {
    return (
      <Tela pilha titulo="Cifra">
        <EstadoVazio
          icone="musica"
          titulo="Esta música saiu do seu repertório"
          descricao="O repertório pode ter mudado ou o encontro já passou. Volte para a lista e escolha de novo."
          acao={{
            titulo: 'Ver meu repertório',
            aoPressionar: () => router.replace('/meu-repertorio'),
          }}
        />
      </Tela>
    )
  }

  const total = encontro.itens.length
  const anterior = posicao > 0 ? encontro.itens[posicao - 1] : undefined
  const proxima = posicao < total - 1 ? encontro.itens[posicao + 1] : undefined
  const ir = (destino: string) =>
    router.replace({
      pathname: '/meu-repertorio/[eventoId]/[itemId]',
      params: { eventoId, itemId: destino },
    })

  return (
    <Tela
      pilha
      titulo={item.titulo}
      descricao={`Música ${posicao + 1} de ${total} · ${encontro.evento.titulo}`}
      barraDeAcao={
        <BarraDeAcao>
          <ParDeBotoes>
            <Botao
              titulo="Anterior"
              variante="secundario"
              tamanho="grande"
              rotuloAcessivel="Música anterior"
              desabilitado={!anterior}
              aoPressionar={() => anterior && ir(anterior.id)}
            />
            <Botao
              titulo="Próxima"
              tamanho="grande"
              rotuloAcessivel="Próxima música"
              desabilitado={!proxima}
              aoPressionar={() => proxima && ir(proxima.id)}
            />
          </ParDeBotoes>
        </BarraDeAcao>
      }
    >
      <LeitorDeCifra
        key={item.id}
        cifra={item.cifra}
        tomOriginal={item.tomOriginal}
        tomDoDia={item.tomDoDia}
      />
      {item.link ? (
        <Botao
          titulo="Abrir o link da música"
          variante="terciario"
          icone="externo"
          alinhado
          rotuloAcessivel={`Abrir o link de ${item.titulo}`}
          aoPressionar={() => void abrirLink(item.link!)}
        />
      ) : null}
    </Tela>
  )
}
