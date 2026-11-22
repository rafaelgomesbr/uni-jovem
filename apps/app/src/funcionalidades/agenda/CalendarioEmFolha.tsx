import { ESPACO, RAIO } from '@uj/tokens'
import { useState } from 'react'
import { Pressable, useWindowDimensions, View } from 'react-native'

import { BotaoIcone } from '@/ui/Botao'
import { Esqueleto, BlocoDeEsqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha } from '@/ui/Falha'
import { FolhaNaTela } from '@/ui/FolhaNaTela'
import { Icone } from '@/ui/Icone'
import { Interruptor } from '@/ui/Interruptor'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { TextoAnunciado } from '@/ui/TextoAnunciado'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import {
  formatarDataPorExtenso,
  gradeDoMes,
  nomeDoMesEAno,
  somarMeses,
  type DataLocal,
} from '@/utilidades/datas'

import { useMeuVinculo } from '../comunidade/consultas'
import { useDisponibilidade } from '../escalas/consultas'
import { useEventosNoPeriodo } from '../eventos/consultas'
import { agruparPorDia, contarEventos, intervaloDoModo, limitesParaApi } from './calendario'
import { useInformarDisponibilidade } from './consultas'
import { CALENDARIO } from './medidas'
import { diaEMesCurto } from './semanas'

const INICIAIS_DOS_DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const
/** A partir desta escala de fonte, sete colunas não cabem: o mês vira lista de dias. */
const ESCALA_DA_LISTA = 1.35

interface Props {
  aberta: boolean
  aoFechar: () => void
  comunidadeId: string
  fuso: string
  hoje: DataLocal
  /** Abre já no modo "Dias em que posso ajudar" (o vazio de "Só o que é meu" leva direto). */
  modoDeAjudaInicial?: boolean
  /** Tocar num dia (fora do modo de ajuda) fecha a folha e leva a lista a esse dia. */
  aoEscolherDia: (dia: DataLocal) => void
}

/**
 * Calendário numa FOLHA (D69, seção 3.3): o mês, com o encontro de cada dia marcado, e um
 * interruptor "Dias em que posso ajudar" (a antiga Disponibilidade da aba Escalas). Com o
 * interruptor desligado, tocar num dia leva a Agenda a ele; ligado, tocar marca ou desmarca
 * "Posso ajudar" (ícone de check e texto, cor nunca é o único sinal), e o app responde na hora.
 */
export function CalendarioEmFolha({
  aberta,
  aoFechar,
  comunidadeId,
  fuso,
  hoje,
  modoDeAjudaInicial = false,
  aoEscolherDia,
}: Props) {
  const { fontScale } = useWindowDimensions()
  const eu = useMeuVinculo()
  const [referencia, setReferencia] = useState<DataLocal>(hoje)
  // O que o pedido de fora quer (o vazio de "Só o que é meu"): vale ao abrir.
  const [modoDeAjuda, setModoDeAjuda] = useState(modoDeAjudaInicial)
  const [otimista, setOtimista] = useState<Readonly<Record<string, boolean>>>({})
  const intervalo = intervaloDoModo('mes', referencia)
  const { de, ate } = limitesParaApi(intervalo, fuso)
  const eventos = useEventosNoPeriodo(aberta ? comunidadeId : null, de, ate)
  const disponibilidade = useDisponibilidade(
    aberta ? comunidadeId : null,
    intervalo.inicio,
    intervalo.fim,
  )
  const informar = useInformarDisponibilidade(comunidadeId)
  const porDia = agruparPorDia(eventos.data ?? [])
  const minhas = new Map(
    (disponibilidade.data ?? [])
      .filter((d) => eu === null || d.vinculo_id === eu)
      .map((d) => [d.data, d.disponivel]),
  )
  const posso = (dia: DataLocal) => otimista[dia] ?? minhas.get(dia) === true
  const marcados = gradeDoMes(referencia)
    .filter((d) => d.startsWith(referencia.slice(0, 7)) && posso(d))
    .map((d) => diaEMesCurto(d))

  function tocar(dia: DataLocal) {
    if (!modoDeAjuda) {
      aoEscolherDia(dia)
      return
    }
    if (dia < hoje) return
    const disponivel = !posso(dia)
    setOtimista((o) => ({ ...o, [dia]: disponivel }))
    informar.mutate(
      { data: dia, disponivel },
      {
        onSettled: () =>
          setOtimista((o) => Object.fromEntries(Object.entries(o).filter(([d]) => d !== dia))),
      },
    )
  }

  const emLista = fontScale >= ESCALA_DA_LISTA
  const dias = gradeDoMes(referencia)
  const mes = referencia.slice(0, 7)

  return (
    <FolhaNaTela aberta={aberta} titulo={nomeDoMesEAno(referencia)} aoFechar={aoFechar}>
      <Interruptor
        rotulo="Dias em que posso ajudar"
        descricao={
          modoDeAjuda ? 'Ligado: toque nos dias em que você pode' : 'Toque nos dias para marcar'
        }
        ligado={modoDeAjuda}
        aoMudar={setModoDeAjuda}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
        <TextoAnunciado soMudancas variante="rotulo" cor="textoSuave" style={{ flex: 1 }}>
          {nomeDoMesEAno(referencia)}
        </TextoAnunciado>
        <BotaoIcone
          icone="voltar"
          rotulo="Mês anterior"
          aoPressionar={() => setReferencia((r) => somarMeses(r, -1))}
        />
        <BotaoIcone
          icone="avancar"
          rotulo="Próximo mês"
          aoPressionar={() => setReferencia((r) => somarMeses(r, 1))}
        />
      </View>
      {eventos.isPending || disponibilidade.isPending ? (
        <Esqueleto rotulo="Carregando o calendário">
          <BlocoDeEsqueleto altura={280} raio={RAIO.cartao} />
        </Esqueleto>
      ) : eventos.error || disponibilidade.error ? (
        <AvisoDeFalha
          erro={eventos.error ?? disponibilidade.error}
          titulo="Não deu para carregar o calendário"
          aoTentarDeNovo={() => {
            void eventos.refetch()
            void disponibilidade.refetch()
          }}
        />
      ) : emLista ? (
        <Lista>
          {dias
            .filter(
              (d) =>
                d.startsWith(mes) &&
                (modoDeAjuda ? d >= hoje : (porDia.get(d)?.length ?? 0) > 0 || d === hoje),
            )
            .map((dia) => (
              <LinhaDeLista
                key={dia}
                icone="agenda"
                titulo={`${formatarDataPorExtenso(dia, false)}${dia === hoje ? ' (hoje)' : ''}`}
                descricao={
                  modoDeAjuda && posso(dia)
                    ? `Posso ajudar. ${contarEventos(porDia.get(dia)?.length ?? 0)}`
                    : contarEventos(porDia.get(dia)?.length ?? 0)
                }
                semSeta
                {...(modoDeAjuda ? { marcada: posso(dia) } : {})}
                aoPressionar={() => tocar(dia)}
              />
            ))}
        </Lista>
      ) : (
        <View>
          <View
            style={{ flexDirection: 'row', marginBottom: ESPACO.e8 }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {INICIAIS_DOS_DIAS.map((d, i) => (
              <Texto
                key={i}
                variante="sobrancelha"
                cor="textoSuave"
                centralizado
                style={{ flex: 1 }}
              >
                {d}
              </Texto>
            ))}
          </View>
          {Array.from({ length: 6 }, (_, s) => dias.slice(s * 7, s * 7 + 7)).map((semana) => (
            <View key={semana[0]} style={{ flexDirection: 'row' }}>
              {semana.map((dia) => (
                <CelulaDoCalendario
                  key={dia}
                  dia={dia}
                  hoje={hoje}
                  doMes={dia.startsWith(mes)}
                  encontros={porDia.get(dia)?.length ?? 0}
                  posso={posso(dia)}
                  modoDeAjuda={modoDeAjuda}
                  passado={dia < hoje}
                  aoTocar={tocar}
                />
              ))}
            </View>
          ))}
        </View>
      )}
      {informar.error ? <AvisoDeFalha erro={informar.error} /> : null}
      {modoDeAjuda ? (
        <Texto variante="meta" cor="textoSuave">
          {marcados.length > 0
            ? `Posso ajudar: ${marcados.join(', ')}.`
            : 'Nenhum dia marcado. A organização vê isso ao montar o encontro.'}
        </Texto>
      ) : (
        <Texto variante="meta" cor="textoSuave">
          Os dias com um ponto têm encontro.
        </Texto>
      )}
    </FolhaNaTela>
  )
}

function CelulaDoCalendario({
  dia,
  hoje,
  doMes,
  encontros,
  posso,
  modoDeAjuda,
  passado,
  aoTocar,
}: {
  dia: DataLocal
  hoje: DataLocal
  doMes: boolean
  encontros: number
  posso: boolean
  modoDeAjuda: boolean
  passado: boolean
  aoTocar: (dia: DataLocal) => void
}) {
  const { cores } = useTema()
  const ehHoje = dia === hoje
  const bloqueada = modoDeAjuda && passado
  const rotulo = [
    formatarDataPorExtenso(dia),
    ehHoje ? 'hoje' : null,
    contarEventos(encontros),
    posso ? 'posso ajudar' : null,
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <Pressable
      accessibilityRole={modoDeAjuda ? 'checkbox' : 'button'}
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: bloqueada, ...(modoDeAjuda ? { checked: posso } : {}) }}
      aria-checked={modoDeAjuda ? posso : undefined}
      disabled={bloqueada}
      onPress={() => aoTocar(dia)}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: CALENDARIO.celula + ESPACO.e4,
        alignItems: 'center',
        justifyContent: 'center',
        gap: CALENDARIO.abaixoDoNumero,
        borderRadius: RAIO.celula,
        backgroundColor: pressed ? cores.pressionado : posso ? cores.sucessoFundo : 'transparent',
        borderWidth: posso ? 1 : 0,
        borderColor: cores.sucesso,
      })}
    >
      <View
        style={{
          width: CALENDARIO.circulo,
          height: CALENDARIO.circulo,
          borderRadius: RAIO.pilula,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ehHoje ? cores.primaria : 'transparent',
        }}
      >
        <Texto
          variante="corpo"
          peso={ehHoje ? 'forte' : 'medio'}
          cor={ehHoje ? 'sobrePrimaria' : doMes && !bloqueada ? 'texto' : 'textoSuave'}
          centralizado
          tabular
          maxFontSizeMultiplier={ESCALA_DA_LISTA}
        >
          {Number(dia.slice(8, 10))}
        </Texto>
      </View>
      <View
        style={{ height: ESPACO.e12, flexDirection: 'row', alignItems: 'center', gap: ESPACO.e4 }}
      >
        {posso ? <Icone nome="check" cor={cores.sucesso} tamanho={12} peso="forte" /> : null}
        {encontros > 0 ? (
          <View
            style={{
              width: CALENDARIO.ponto + 2,
              height: CALENDARIO.ponto + 2,
              borderRadius: RAIO.pilula,
              backgroundColor: cores.destaque,
            }}
          />
        ) : null}
      </View>
    </Pressable>
  )
}
