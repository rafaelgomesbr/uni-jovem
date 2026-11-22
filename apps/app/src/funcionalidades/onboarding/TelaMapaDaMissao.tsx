import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import { parametro } from '@/utilidades/parametros'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useAnunciar } from '@/ui/useAnunciar'
import { voltarOu } from '@/ui/navegacao'

import { DemonstracaoDaEtapa } from './Demonstracoes'
import { ETAPAS_POR_PAPEL, useProgressoDaMissao, type ProgressoDaMissao } from './missao'
import { MissoesDeConfiguracao } from './MissoesDeConfiguracao'

/** Rota `/missao` (`?rever=1` recomeça do início, a partir do Perfil). */
export function TelaMapaDaMissao() {
  const { comunidadeAtiva } = useSessao()
  const rever = parametro(useLocalSearchParams<{ rever?: string }>().rever) === '1'
  const { progresso, salvar } = useProgressoDaMissao()
  const papel = comunidadeAtiva?.papel ?? 'membro'
  const etapas = ETAPAS_POR_PAPEL[papel]

  if (!progresso) {
    return (
      <Tela pilha aurora={1} titulo="Primeiros passos">
        <Esqueleto rotulo="Abrindo os primeiros passos">
          <CartaoDeEsqueleto titulo />
        </Esqueleto>
      </Tela>
    )
  }
  return (
    <Mapa
      // Revisitar começa do zero; continuar retoma onde parou.
      inicial={
        rever || progresso.estado === 'concluido' || progresso.estado === 'pulado'
          ? 0
          : Math.min(progresso.etapa, etapas.length - 1)
      }
      progresso={progresso}
      salvar={salvar}
    />
  )
}

/**
 * Primeiros passos (3.7.7, direção A): Aurora total, "PASSO 2 DE 5" com a barra de
 * passos, o objetivo do passo em `tituloTela` e a explicação em `corpo`, a
 * demonstração num cartão com o chip "Exemplo" e "Pausar" e "Próxima etapa" na
 * barra de ação. "Pular" fica no cabeçalho. É para quem organiza (UX v3, D62), mas
 * continua abrindo para todo papel por Perfil, Ajuda.
 */
function Mapa({
  inicial,
  progresso,
  salvar,
}: {
  inicial: number
  progresso: ProgressoDaMissao
  salvar: (p: ProgressoDaMissao) => void
}) {
  const { comunidadeAtiva } = useSessao()
  const etapas = ETAPAS_POR_PAPEL[comunidadeAtiva?.papel ?? 'membro']
  const [atual, setAtual] = useState(inicial)
  const [concluido, setConcluido] = useState(false)
  const etapa = etapas[atual]!
  const ultima = atual + 1 >= etapas.length

  function irPara(i: number) {
    setAtual(i)
    salvar({ ...progresso, estado: 'em_andamento', etapa: i })
  }

  function proxima() {
    if (!ultima) {
      irPara(atual + 1)
      return
    }
    setConcluido(true)
    salvar({ ...progresso, estado: 'concluido', etapa: 0 })
  }

  if (concluido) {
    return (
      <Tela
        pilha
        aurora={1}
        titulo="Primeiros passos"
        barraDeAcao={
          <BarraDeAcao>
            <Botao
              titulo="Ir para o Início"
              tamanho="grande"
              aoPressionar={() => router.replace('/')}
            />
          </BarraDeAcao>
        }
      >
        <Celebracao />
        <Secao titulo="Para deixar tudo pronto">
          <CartaoDeVidro>
            <MissoesDeConfiguracao />
          </CartaoDeVidro>
        </Secao>
        <Botao
          titulo="Rever os primeiros passos"
          variante="terciario"
          alinhado
          aoPressionar={() => {
            setConcluido(false)
            setAtual(0)
          }}
        />
      </Tela>
    )
  }

  return (
    <Tela
      pilha
      aurora={1}
      passos={{ atual: atual + 1, total: etapas.length }}
      titulo={etapa.titulo}
      descricao={etapa.texto}
      acoes={
        <Botao
          titulo="Pular"
          variante="terciario"
          rotuloAcessivel="Pular os primeiros passos"
          dica="Dá para rever quando quiser, em Perfil, Ajuda."
          aoPressionar={() => {
            salvar({ ...progresso, estado: 'pulado', etapa: 0 })
            voltarOu('/')
          }}
        />
      }
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Pausar"
            rotuloAcessivel="Pausar e continuar depois"
            variante="secundario"
            tamanho="grande"
            aoPressionar={() => {
              salvar({ ...progresso, estado: 'pausado', etapa: atual })
              voltarOu('/')
            }}
          />
          <Botao
            titulo={ultima ? 'Concluir' : 'Próxima etapa'}
            tamanho="grande"
            aoPressionar={proxima}
          />
        </BarraDeAcao>
      }
    >
      {etapa.demo ? (
        <CartaoDeVidro
          opaco
          sobrancelha="Não muda nada de verdade"
          extra={<Chip texto="Exemplo" tom="neutro" />}
        >
          <DemonstracaoDaEtapa key={etapa.id} demo={etapa.demo} />
        </CartaoDeVidro>
      ) : null}
      {atual > 0 ? (
        <Botao
          titulo="Etapa anterior"
          variante="terciario"
          alinhado
          aoPressionar={() => irPara(atual - 1)}
        />
      ) : null}
      <Secao titulo="O caminho">
        <CartaoDeVidro lista>
          <Lista>
            {etapas.map((e, i) => (
              <LinhaDeLista
                key={e.id}
                icone={i < atual ? 'confirmado' : i === atual ? 'avancar' : 'pendente'}
                titulo={`${i + 1}. ${e.titulo}`}
                descricao={i < atual ? 'Visto' : i === atual ? 'Você está aqui' : 'A seguir'}
                {...(i !== atual ? { aoPressionar: () => irPara(i) } : {})}
              />
            ))}
          </Lista>
        </CartaoDeVidro>
      </Secao>
    </Tela>
  )
}

/**
 * Celebração discreta (direção A): o cartão do momento com o sol radiante, "Tudo pronto" e uma
 * frase, sem confete nem pontos. O sol faz o papel dos brilhos de antes; com "Reduzir movimento"
 * ele já aparece no lugar (a regra está dentro do `Sol`). O leitor de tela ouve a frase.
 */
export function Celebracao() {
  useAnunciar('Primeiros passos concluídos. Você já conhece o caminho.')
  return (
    <Cartao
      variante="momento"
      pose="radiante"
      etiqueta="Primeiros passos concluídos"
      titulo="Tudo pronto"
    >
      <Texto variante="corpo" cor="textoSuave">
        Você já conhece o caminho. Quando quiser rever, está em Perfil, Ajuda.
      </Texto>
    </Cartao>
  )
}
