import { DURACAO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Animated } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { parametro } from '@/utilidades/parametros'
import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { anunciar } from '@/ui/anunciar'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { Icone } from '@/ui/Icone'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { useTema } from '@/ui/tema'
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
      <Tela pilha aurora={1} titulo="Mapa da missão">
        <Esqueleto rotulo="Abrindo o mapa">
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
 * Mapa da missão (3.7.7): Aurora total, "PASSO 2 DE 5" com a barra de
 * passos, o objetivo do passo em `tituloTela` e a explicação em `corpo`, a
 * demonstração num cartão de destaque com o chip "Exemplo" e "Pausar" e
 * "Próxima etapa" na barra de ação. "Pular" fica no cabeçalho.
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
        titulo="Mapa da missão"
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
          titulo="Rever o mapa"
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
          rotuloAcessivel="Pular o mapa"
          dica="Dá para rever quando quiser, no Perfil."
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
            titulo={ultima ? 'Concluir o mapa' : 'Próxima etapa'}
            tamanho="grande"
            aoPressionar={proxima}
          />
        </BarraDeAcao>
      }
    >
      {etapa.demo ? (
        <CartaoDeDestaque
          meta="Não muda nada de verdade"
          chip={<Chip texto="Exemplo" tom="neutro" />}
        >
          <DemonstracaoDaEtapa key={etapa.id} demo={etapa.demo} />
        </CartaoDeDestaque>
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
 * Celebração discreta (3.7.7): cartão de destaque com o ícone de brilhos de
 * 48 e "Tudo pronto", sem confete. Com "Reduzir movimento", aparece parada;
 * sem, entra com um leve aumento. O leitor de tela ouve a frase.
 */
export function Celebracao() {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const [escala] = useState(() => new Animated.Value(reduzirMovimento ? 1 : 0.85))
  useEffect(() => {
    anunciar('Mapa concluído. Você já conhece o caminho.')
    if (reduzirMovimento) {
      escala.setValue(1)
      return
    }
    const animacao = Animated.timing(escala, {
      toValue: 1,
      duration: DURACAO.aparecer,
      useNativeDriver: true,
    })
    animacao.start()
    return () => animacao.stop()
  }, [reduzirMovimento, escala])
  return (
    <CartaoDeDestaque
      sobrancelha="Mapa concluído"
      titulo="Tudo pronto"
      descricao="Você já conhece o caminho. Quando quiser rever, está no Perfil."
    >
      <IconeDaCelebracao escala={escala} />
    </CartaoDeDestaque>
  )
}

/** Dentro do destaque, a cor vem da paleta inversa (por isso o tema é lido aqui). */
function IconeDaCelebracao({ escala }: { escala: Animated.Value }) {
  const { cores } = useTema()
  return (
    <Animated.View style={{ alignSelf: 'flex-start', transform: [{ scale: escala }] }}>
      <Icone nome="celebrar" cor={cores.destaque} tamanho={48} />
    </Animated.View>
  )
}
