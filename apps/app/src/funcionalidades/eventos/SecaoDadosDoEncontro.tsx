import { ESPACO, RITMO } from '@uj/tokens'
import { useEffect, useRef, type ComponentRef } from 'react'
import { AccessibilityInfo, Platform, View } from 'react-native'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { Acordeao } from '@/ui/Acordeao'
import { Aparecer } from '@/ui/Aparecer'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Icone } from '@/ui/Icone'
import { RECUO_DA_LISTA } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { CabecalhoDeAcordeao } from '../comunidade/CabecalhoDeAcordeao'
import { dataEHoraDoCartao } from '../inicio/quando'
import { EditarDadosDoEncontro } from './EditarDadosDoEncontro'

/** Quem hospeda a seção decide quando ela está aberta (um "Editar" de fora a abre). */
export interface EdicaoNoResumo {
  aberta: boolean
  /** O toque no cabeçalho pede abrir ou recolher (recolher com algo digitado pergunta antes). */
  aoAlternar: (aberta: boolean) => void
  /** Salvou: a seção se recolhe. */
  aoSalvar: () => void
  aoMudarSujo: (sujo: boolean) => void
}

/** "Sáb., 28 nov. · 16:00 · Salão principal": a linha que o cabeçalho diz com a seção fechada. */
export function resumoDosDadosDoEncontro(evento: DetalheDoEvento): string {
  return `${dataEHoraDoCartao(evento.inicio, evento.fuso)} · ${evento.local?.nome ?? 'Local a definir'}`
}

/**
 * "Dados do encontro" (primeiro bloco do Resumo da organização): o formulário de edição dentro do
 * próprio encontro, dobrado. O cabeçalho traz o nome da seção e "Editar", escrito e com lápis,
 * para ninguém ter de adivinhar que ali se toca (o leitor de tela ouve também dia, hora e local). Antes havia dois
 * caminhos quase iguais (o cartão e um botão "Editar" para outra tela); agora é um só.
 */
export function SecaoDadosDoEncontro({
  evento,
  comunidadeId,
  edicao,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
  edicao: EdicaoNoResumo
}) {
  const resumo = resumoDosDadosDoEncontro(evento)
  const cabecalho = useRef<ComponentRef<typeof View>>(null)
  const { aberta } = edicao
  // Ao abrir, o foco do leitor de tela vai para o cabeçalho da seção: sem isso ele ficava no botão
  // de onde a pessoa veio (barra, "Outras coisas", Início) e não sabia que algo abriu. Só no app
  // nativo; na web o foco do navegador já cuida disso.
  useEffect(() => {
    if (!aberta || Platform.OS === 'web') return
    try {
      // `setAccessibilityFocus(findNodeHandle(...))` está obsoleto no React Native 0.88: o mesmo
      // pedido vai por `sendAccessibilityEvent` com o próprio nó.
      if (cabecalho.current) AccessibilityInfo.sendAccessibilityEvent(cabecalho.current, 'focus')
    } catch {
      // Sem leitor de tela (ou sem nó ainda): nada a fazer.
    }
  }, [aberta])
  return (
    <View style={{ gap: RITMO.entreSecoes }}>
      <CartaoDeVidro lista>
        <Acordeao
          recuo={RECUO_DA_LISTA.texto}
          aberto={aberta}
          aoAlternar={edicao.aoAlternar}
          refDoBotao={cabecalho}
          rotuloRecolhido={`Dados do encontro: ${resumo}. Recolhido, toque para editar.`}
          rotuloAberto="Dados do encontro. Aberto, toque para recolher."
          cabecalho={(aberto) => (
            <CabecalhoDeAcordeao
              icone="calendario"
              // Só o nome da seção: dia, hora e local já aparecem no cartão "Quando e onde" logo
              // abaixo (visto em tela real em 23/11/2026: o resumo repetia e quebrava em 3 linhas).
              // O leitor de tela continua ouvindo o resumo, pelo rótulo do acordeão.
              titulo="Dados do encontro"
              {...(aberto ? {} : { extra: <ChamadaEditar /> })}
            />
          )}
        >
          {null}
        </Acordeao>
      </CartaoDeVidro>
      {/* O formulário fica fora do cartão-lista: um nível de cartão só, com a largura toda da tela. */}
      {aberta ? (
        <Aparecer>
          <EditarDadosDoEncontro
            comunidadeId={comunidadeId}
            inicial={evento}
            aoSalvar={edicao.aoSalvar}
            aoMudarSujo={edicao.aoMudarSujo}
            aoCancelar={() => edicao.aoAlternar(false)}
            naSecao
          />
        </Aparecer>
      ) : null}
    </View>
  )
}

/** "Editar" com o lápis: texto e ícone juntos (cor nunca é o único sinal), na cor de destaque. */
function ChamadaEditar() {
  const { cores } = useTema()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e4 }}>
      <Icone nome="editar" cor={cores.destaque} tamanho={16} />
      <Texto variante="botao" cor="destaque">
        Editar
      </Texto>
    </View>
  )
}
