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
import { falarQuando, formatarHora } from '@/utilidades/datas'

import { estadoEfetivo, type RespostaOtimista } from '../escalas/respostasOtimistas'
import { NOME_DO_STATUS } from '../eventos/nomes'
import { AvisoDeHorario } from './AvisoDeHorario'
import { nomeDaParte, textoDaSuaParte, type ParteDaPessoa } from './semanas'

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
  /** "Ao mesmo tempo que Culto (16:00)": o aviso discreto de encontros que se encostam no dia (D79). */
  aviso?: string | null
  aoAbrir: () => void
  /** Pressionar e segurar: o menu da linha (o mesmo que o "Mais" do encontro). */
  aoSegurar: () => void
  aoAceitar: (parte: MinhaEscala) => void
  aoRecusar: (parte: MinhaEscala) => void
}

/**
 * A linha do encontro na Agenda (D69, seção 3.3; D79): a linha mora debaixo do cabeçalho do DIA,
 * então à esquerda vai o horário (começo e fim), não a data. Depois o título, o local, e SEMPRE a linha "Você: ..." quando há parte (ou "Inscrito"). Com a convocação
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
  aviso = null,
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
        {...(evento.localNome ? { descricao: evento.localNome } : {})}
        inicio={<ColunaDaHora evento={evento} />}
        extra={
          <View style={{ gap: ESPACO.e8, alignItems: 'flex-start' }}>
            <Chip situacao="aguardando" texto="Aguardando sua resposta" />
            <Texto variante="rotulo" cor="textoSuave">
              {`Você: ${nomeDaParte(pendente)}`}
            </Texto>
            {aviso ? <AvisoDeHorario texto={aviso} /> : null}
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
      aviso={aviso}
      aoAbrir={aoAbrir}
      aoSegurar={aoSegurar}
    />
  )
}

/** A hora de começo e, embaixo, a de fim: a coluna à esquerda da linha, igual com ou sem resposta pendente. */
function ColunaDaHora({ evento }: { evento: ResumoDoEvento }) {
  const fim = new Date(Date.parse(evento.inicio) + evento.duracaoMin * 60_000).toISOString()
  return (
    <View
      style={{ minWidth: LARGURA_DA_HORA, alignItems: 'flex-start', gap: ESPACO.e4 }}
      accessible={false}
    >
      <Texto variante="tituloItem" accessibilityRole="text" tabular>
        {formatarHora(evento.inicio, evento.fuso)}
      </Texto>
      <Texto variante="meta" cor="textoSuave" tabular>
        {formatarHora(fim, evento.fuso)}
      </Texto>
    </View>
  )
}

function LinhaSimples({
  evento,
  voce,
  confirmada,
  inscrito,
  aviso,
  aoAbrir,
  aoSegurar,
}: {
  evento: ResumoDoEvento
  voce: string | null
  confirmada: boolean
  inscrito: boolean
  aviso: string | null
  aoAbrir: () => void
  aoSegurar: () => void
}) {
  const { cores } = useTema()
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
    aviso,
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
        <ColunaDaHora evento={evento} />
        <View style={{ flex: 1, gap: ESPACO.e4 }}>
          <Texto variante="tituloItem">{evento.titulo}</Texto>
          {evento.localNome ? (
            <Texto variante="meta" cor="textoSuave">
              {evento.localNome}
            </Texto>
          ) : null}
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
          {aviso ? <AvisoDeHorario texto={aviso} /> : null}
        </View>
        <Icone nome="avancar" cor={cores.textoSuave} tamanho={14} peso="semibold" />
      </Pressable>
    </CartaoDeVidro>
  )
}
