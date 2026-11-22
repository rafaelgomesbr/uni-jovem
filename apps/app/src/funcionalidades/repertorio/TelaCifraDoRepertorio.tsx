import { linksAbriveisDaMusica } from '@uj/dominio'
import { router, useLocalSearchParams } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao, BotaoIcone, ParDeBotoes } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Chip } from '@/ui/Chip'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { ErroDaTela } from '@/ui/Falha'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { voltarOu } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { abrirLink } from '@/utilidades/compartilhar'
import { parametro } from '@/utilidades/parametros'
import { useState } from 'react'

import { LinksDaMusica } from '../conteudos/LinksDaMusica'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useEstaOnline } from '../offline/ProvedorOffline'
import { CartaoDoPdf } from '../pdf/CartaoDoPdf'
import { LeitorDeCifra } from './LeitorDeCifra'
import { ModoPalco } from './ModoPalco'
import { TomDoPdf } from './TomDoPdf'
import { useAjustesDaCifra } from './useAjustesDaCifra'
import { useEncontrosParaTocar, type EncontroParaTocar } from './useEncontrosParaTocar'

const CAMINHO = '/meu-repertorio/[eventoId]/[itemId]' as const

/**
 * Rota `/meu-repertorio/[eventoId]/[itemId]` (D61, D71): a cifra de uma música do Meu repertório,
 * grande e no tom do dia, com anterior e próxima por botão, e o Modo palco (`?palco=1` abre direto
 * nele). Lê da rede ou, sem internet, da cópia guardada no aparelho: o músico não fica na mão.
 * Os ajustes de tom, capotraste e letra valem só nesta leitura.
 */
export function TelaCifraDoRepertorio() {
  const { comunidadeAtiva } = useSessao()
  const params = useLocalSearchParams<{ eventoId: string; itemId: string; palco?: string }>()
  const eventoId = parametro(params.eventoId)
  const itemId = parametro(params.itemId)
  const abertoNoPalco = parametro(params.palco) === '1'
  const situacao = useEncontrosParaTocar(comunidadeAtiva?.id ?? null)

  if (!comunidadeAtiva || !eventoId || !itemId) {
    return (
      <Tela pilha titulo="Cifra">
        <SemComunidade oQue="a cifra" />
      </Tela>
    )
  }
  if (situacao.tipo === 'carregando') {
    return (
      <Tela pilha titulo="Cifra">
        <Esqueleto rotulo="Carregando a cifra">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Tela>
    )
  }
  if (situacao.tipo === 'erro') {
    return (
      <Tela pilha titulo="Cifra">
        <ErroDaTela
          erro={situacao.erro}
          titulo="A cifra não abriu"
          aoTentarDeNovo={situacao.tentarDeNovo}
        />
      </Tela>
    )
  }
  if (situacao.tipo === 'sem_copia') {
    return (
      <Tela pilha titulo="Cifra">
        <EstadoVazio
          icone="semConexao"
          titulo="Este repertório ainda não está no seu aparelho"
          descricao="Conecte-se à internet para ver a cifra e baixar o repertório."
          acao={{ titulo: 'Tentar de novo', aoPressionar: situacao.tentarDeNovo }}
        />
      </Tela>
    )
  }

  const encontro = situacao.encontros.find((e) => e.evento.id === eventoId)
  const posicao = encontro ? encontro.itens.findIndex((i) => i.id === itemId) : -1
  if (!encontro || posicao < 0) {
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
  return (
    <MusicaAberta
      // Trocar de música recomeça o tom e o capotraste (valem só para a música aberta).
      key={itemId}
      comunidadeId={comunidadeAtiva.id}
      encontro={encontro}
      posicao={posicao}
      abertoNoPalco={abertoNoPalco}
    />
  )
}

function MusicaAberta({
  comunidadeId,
  encontro,
  posicao,
  abertoNoPalco,
}: {
  comunidadeId: string
  encontro: EncontroParaTocar
  posicao: number
  abertoNoPalco: boolean
}) {
  const ajustes = useAjustesDaCifra()
  const [palco, setPalco] = useState(abertoNoPalco)
  const item = encontro.itens[posicao]!
  const total = encontro.itens.length
  const anterior = posicao > 0 ? encontro.itens[posicao - 1] : undefined
  const proxima = posicao < total - 1 ? encontro.itens[posicao + 1] : undefined
  const pdf = item.pdf ?? null
  const temCifra = !!item.cifra && item.cifra.trim() !== ''
  const online = useEstaOnline()
  const temLinks = linksAbriveisDaMusica(item.links).length > 0

  // No palco a troca de música mantém o palco aberto: o músico não volta à leitura entre as duas.
  const ir = (destino: string) =>
    router.replace({
      pathname: CAMINHO,
      params: {
        eventoId: encontro.evento.id,
        itemId: destino,
        ...(palco ? { palco: '1' } : {}),
      },
    })

  if (palco) {
    return (
      <ModoPalco
        titulo={item.titulo}
        cifra={item.cifra}
        tomOriginal={item.tomOriginal}
        tomDoDia={item.tomDoDia}
        posicao={posicao + 1}
        total={total}
        ajustes={ajustes}
        aoSair={() => (abertoNoPalco ? voltarOu('/meu-repertorio') : setPalco(false))}
        aoAnterior={anterior ? () => ir(anterior.id) : null}
        aoProxima={proxima ? () => ir(proxima.id) : null}
        pdf={pdf ? { comunidadeId, musicaId: item.musicaId, resumo: pdf } : null}
      />
    )
  }

  return (
    <Tela
      pilha
      titulo={item.titulo}
      descricao={`Música ${posicao + 1} de ${total} · ${encontro.evento.titulo}`}
      {...(encontro.baixado
        ? {
            abaixoDoTitulo: <Chip situacao="aceitou" texto="Baixado para usar sem internet" />,
          }
        : {})}
      acoes={
        <BotaoIcone
          icone="musica"
          texto="Palco"
          rotulo="Abrir o Modo palco"
          aoPressionar={() => setPalco(true)}
        />
      }
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
      {/* PDF (D76): primeiro, porque é o que se abre; a cifra em texto, se houver, vem logo abaixo. */}
      {pdf ? (
        <CartaoDoPdf
          comunidadeId={comunidadeId}
          musicaId={item.musicaId}
          titulo={item.titulo}
          pdf={pdf}
          guardado={encontro.baixado}
        />
      ) : null}
      {pdf && !temCifra ? (
        <TomDoPdf tomDoDia={item.tomDoDia} tomOriginal={item.tomOriginal} />
      ) : (
        <LeitorDeCifra
          cifra={item.cifra}
          tomOriginal={item.tomOriginal}
          tomDoDia={item.tomDoDia}
          ajustes={ajustes}
        />
      )}
      {/* Links do Drive e do YouTube (D80): só como texto no pacote, abrir exige internet. */}
      {temLinks ? (
        <Cartao sobrancelha="Links">
          <LinksDaMusica links={item.links} musica={item.titulo} online={online} />
        </Cartao>
      ) : null}
      {item.link ? (
        <Botao
          titulo="Abrir o link da música"
          variante="secundario"
          icone="externo"
          rotuloAcessivel={`Abrir o link de ${item.titulo}`}
          aoPressionar={() => void abrirLink(item.link!)}
        />
      ) : null}
    </Tela>
  )
}
