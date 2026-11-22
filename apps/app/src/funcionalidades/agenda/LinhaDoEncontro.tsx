import { ALTURA, ESPACO } from '@uj/tokens'
import { Pressable, View } from 'react-native'

import type { MinhaEscala, ResumoDoEvento } from '@/servicos/contratoDosEventos'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { DeslizarParaResponder } from '@/ui/DeslizarParaResponder'
import { Icone } from '@/ui/Icone'
import { LARGURA_DA_HORA } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { dataDoInstante, falarQuando } from '@/utilidades/datas'

import { estadoEfetivo, type RespostaOtimista } from '../escalas/respostasOtimistas'
import { NOME_DO_STATUS } from '../eventos/nomes'
import {
  dataCurtaDoEncontro,
  horarioELocal,
  nomeDaParte,
  textoDaSuaParte,
  type ParteDaPessoa,
} from './semanas'

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAIO', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

export interface PropsDaLinhaDoEncontro {
  evento: ResumoDoEvento
  /** As convocações da própria pessoa neste encontro (a recusada fica de fora do "Você:"). */
  partes: readonly MinhaEscala[]
  /** A pessoa tem inscrição ativa neste encontro. */
  inscrito: boolean
  /** Respostas dadas e ainda em espera do Desfazer: valem mais que as do servidor. */
  otimistas: ReadonlyMap<string, RespostaOtimista>
  /** Sem internet: Aceitar e Não posso ir ficam desabilitados com o motivo escrito. */
  semInternet: boolean
  aoAbrir: () => void
  /** Pressionar e segurar: o menu da linha (o mesmo que o "Mais" do encontro). */
  aoSegurar: () => void
  aoAceitar: (parte: MinhaEscala) => void
  aoRecusar: (parte: MinhaEscala) => void
}

/**
 * A linha do encontro na Agenda (D69, seção 3.3): o dia grande à esquerda, o título, o horário
 * e o local, e SEMPRE a linha "Você: ..." quando há parte (ou "Inscrito"). Com a convocação
 * pendente, a linha é a de resposta: "Aceitar" e "Não posso ir" direto nela, com o deslizar como
 * atalho (nunca o único caminho). Depois de aceitar, a linha vira "Você: Louvor · Vocal" com o
 * chip "Confirmado" e os botões somem.
 */
export function LinhaDoEncontro({
  evento,
  partes,
  inscrito,
  otimistas,
  semInternet,
  aoAbrir,
  aoSegurar,
  aoAceitar,
  aoRecusar,
}: PropsDaLinhaDoEncontro) {
  const efetivas = partes.map((p) => ({ ...p, estado: estadoEfetivo(p.id, p.estado, otimistas) }))
  // Em rascunho a convocação ainda não saiu: não há o que responder.
  const pendente =
    evento.status === 'publicado' ? efetivas.find((p) => p.estado === 'pendente') : undefined
  const daPessoa: ParteDaPessoa[] = efetivas.map((p) => ({
    funcao: p.funcao,
    etapaTitulo: p.etapaTitulo,
    estado: p.estado,
  }))
  const voce = textoDaSuaParte(daPessoa)
  const confirmada = efetivas.some((p) => p.estado === 'confirmada')

  if (pendente) {
    const original = partes.find((p) => p.id === pendente.id)!
    return (
      <DeslizarParaResponder
        titulo={evento.titulo}
        descricao={`${dataCurtaDoEncontro(evento.inicio, evento.fuso)} · ${horarioELocal(evento, false)}`}
        extra={
          <View style={{ gap: ESPACO.e8, alignItems: 'flex-start' }}>
            <Chip situacao="aguardando" texto="Aguardando sua resposta" />
            <Texto variante="rotulo" cor="textoSuave">
              {`Você: ${nomeDaParte(pendente)}`}
            </Texto>
          </View>
        }
        aoPressionar={aoAbrir}
        aoAceitar={() => aoAceitar(original)}
        aoRecusar={() => aoRecusar(original)}
        desabilitado={semInternet}
        {...(semInternet ? { motivo: 'Precisa de internet para responder.' } : {})}
      />
    )
  }

  return (
    <LinhaSimples
      evento={evento}
      voce={voce}
      confirmada={confirmada}
      inscrito={inscrito}
      aoAbrir={aoAbrir}
      aoSegurar={aoSegurar}
    />
  )
}

function LinhaSimples({
  evento,
  voce,
  confirmada,
  inscrito,
  aoAbrir,
  aoSegurar,
}: {
  evento: ResumoDoEvento
  voce: string | null
  confirmada: boolean
  inscrito: boolean
  aoAbrir: () => void
  aoSegurar: () => void
}) {
  const { cores } = useTema()
  const dia = dataDoInstante(evento.inicio, evento.fuso)
  const situacao =
    evento.status === 'rascunho' ? (
      <Chip situacao="rascunho" />
    ) : evento.status === 'cancelado' ? (
      <Chip texto={NOME_DO_STATUS.cancelado} tom="erro" icone="fechar" />
    ) : evento.status === 'adiado' ? (
      <Chip texto={NOME_DO_STATUS.adiado} tom="alerta" icone="relogio" />
    ) : null
  const falado = [
    evento.titulo,
    falarQuando(evento.inicio, evento.fuso),
    evento.localNome ? `local: ${evento.localNome}` : null,
    voce ?? (inscrito ? 'Você está inscrito' : null),
    evento.status === 'publicado' ? null : NOME_DO_STATUS[evento.status],
  ]
    .filter(Boolean)
    .join('. ')

  return (
    <CartaoDeVidro lista>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={falado}
        accessibilityActions={[{ name: 'maisAcoes', label: 'Mais ações do encontro' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'maisAcoes') aoSegurar()
        }}
        onPress={aoAbrir}
        onLongPress={aoSegurar}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: ESPACO.e12,
          minHeight: ALTURA.linhaAlta,
          paddingHorizontal: ESPACO.e16,
          paddingVertical: ESPACO.e12,
          backgroundColor: pressed ? cores.pressionado : 'transparent',
        })}
      >
        <View style={{ width: LARGURA_DA_HORA, alignItems: 'center' }} accessible={false}>
          <Texto variante="tituloCartao" accessibilityRole="text" tabular>
            {String(Number(dia.slice(8, 10)))}
          </Texto>
          <Texto variante="legenda" cor="textoSuave">
            {MESES[Number(dia.slice(5, 7)) - 1] ?? ''}
          </Texto>
        </View>
        <View style={{ flex: 1, gap: ESPACO.e4 }}>
          <Texto variante="tituloItem">{evento.titulo}</Texto>
          <Texto variante="meta" cor="textoSuave">
            {horarioELocal(evento)}
          </Texto>
          {voce || inscrito || situacao ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: ESPACO.e8,
                marginTop: ESPACO.e4,
              }}
            >
              {voce ? (
                <Texto variante="rotulo" cor="textoSuave">
                  {voce}
                </Texto>
              ) : inscrito ? (
                <Texto variante="rotulo" cor="textoSuave">
                  Inscrito
                </Texto>
              ) : null}
              {confirmada ? <Chip situacao="aceitou" /> : null}
              {!voce && inscrito ? <Chip situacao="aceitou" texto="Inscrição feita" /> : null}
              {situacao}
            </View>
          ) : null}
        </View>
        <Icone nome="avancar" cor={cores.textoSuave} tamanho={14} peso="semibold" />
      </Pressable>
    </CartaoDeVidro>
  )
}
