import { DURACAO, ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { parametro } from '@/utilidades/parametros'
import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { BarraDeProgresso } from '@/ui/BarraDeProgresso'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { Icone } from '@/ui/Icone'
import { Linha } from '@/ui/Linha'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

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
      <Tela cabecalhoNativo>
        <Carregando texto="Abrindo o mapa" />
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
  const { cores } = useTema()
  const etapas = ETAPAS_POR_PAPEL[comunidadeAtiva?.papel ?? 'membro']
  const [atual, setAtual] = useState(inicial)
  const [concluido, setConcluido] = useState(false)
  const etapa = etapas[atual]!

  function irPara(i: number) {
    setAtual(i)
    salvar({ ...progresso, estado: 'em_andamento', etapa: i })
  }

  function proxima() {
    if (atual + 1 < etapas.length) {
      irPara(atual + 1)
      return
    }
    setConcluido(true)
    salvar({ ...progresso, estado: 'concluido', etapa: 0 })
  }

  if (concluido) {
    return (
      <Tela cabecalhoNativo titulo="Mapa da missão">
        <Celebracao />
        <Cartao titulo="Para deixar tudo pronto" icone="tarefas">
          <MissoesDeConfiguracao />
        </Cartao>
        <Botao titulo="Ir para o Início" aoPressionar={() => router.replace('/')} />
        <Botao
          titulo="Rever o mapa"
          variante="discreto"
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
      cabecalhoNativo
      titulo="Mapa da missão"
      descricao={`Etapa ${atual + 1} de ${etapas.length}. Sem pontos nem ranking: é só para conhecer o app.`}
    >
      <BarraDeProgresso
        fracao={(atual + 1) / etapas.length}
        rotulo={`Etapa ${atual + 1} de ${etapas.length}`}
      />
      <Cartao titulo="O caminho" icone="missao">
        {etapas.map((e, i) => (
          <Linha
            key={e.id}
            icone={i < atual ? 'confirmado' : i === atual ? 'avancar' : 'pendente'}
            titulo={`${i + 1}. ${e.titulo}`}
            descricao={i < atual ? 'Visto' : i === atual ? 'Você está aqui' : 'A seguir'}
            {...(i !== atual ? { aoPressionar: () => irPara(i) } : {})}
          />
        ))}
      </Cartao>
      <Cartao>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.x2 }}>
          <Icone nome="missao" cor={cores.destaque} />
          <Texto variante="subtitulo" accessibilityRole="header" style={{ flex: 1 }}>
            {etapa.titulo}
          </Texto>
        </View>
        <Texto>{etapa.texto}</Texto>
        <DemonstracaoDaEtapa key={etapa.id} demo={etapa.demo} />
      </Cartao>
      <Botao
        titulo={atual + 1 < etapas.length ? 'Próxima etapa' : 'Concluir o mapa'}
        icone="avancar"
        aoPressionar={proxima}
      />
      {atual > 0 ? (
        <Botao
          titulo="Etapa anterior"
          variante="secundario"
          icone="voltar"
          aoPressionar={() => irPara(atual - 1)}
        />
      ) : null}
      <Botao
        titulo="Pausar e continuar depois"
        icone="pausar"
        variante="secundario"
        aoPressionar={() => {
          salvar({ ...progresso, estado: 'pausado', etapa: atual })
          router.back()
        }}
      />
      <Botao
        titulo="Pular o mapa"
        variante="discreto"
        dica="Dá para rever quando quiser, no Perfil."
        aoPressionar={() => {
          salvar({ ...progresso, estado: 'pulado', etapa: 0 })
          router.back()
        }}
      />
    </Tela>
  )
}

/**
 * Celebração discreta: um ícone e uma frase. Com "Reduzir movimento", aparece
 * parada; sem, entra com um leve aumento. O leitor de tela ouve a frase.
 */
export function Celebracao() {
  const { cores } = useTema()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const [escala] = useState(() => new Animated.Value(reduzirMovimento ? 1 : 0.85))
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility('Mapa concluído. Você já conhece o caminho.')
    if (reduzirMovimento) {
      escala.setValue(1)
      return
    }
    const animacao = Animated.timing(escala, {
      toValue: 1,
      duration: DURACAO.lenta,
      useNativeDriver: true,
    })
    animacao.start()
    return () => animacao.stop()
  }, [reduzirMovimento, escala])
  return (
    <Cartao>
      <Animated.View
        style={{ alignItems: 'center', gap: ESPACO.x2, transform: [{ scale: escala }] }}
      >
        <Icone nome="celebrar" cor={cores.destaque} tamanho={40} />
        <Texto variante="subtitulo" centralizado accessibilityRole="header">
          Mapa concluído
        </Texto>
        <Texto centralizado>Você já conhece o caminho. Quando quiser rever, está no Perfil.</Texto>
      </Animated.View>
    </Cartao>
  )
}
