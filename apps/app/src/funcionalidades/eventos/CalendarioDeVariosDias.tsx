import { ALTURA, ESPACO, RAIO } from '@uj/tokens'
import { useState } from 'react'
import { Pressable, useWindowDimensions, View } from 'react-native'

import { Botao, BotaoIcone } from '@/ui/Botao'
import { Icone } from '@/ui/Icone'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'
import { useTema } from '@/ui/tema'
import {
  formatarDataPorExtenso,
  gradeDoMes,
  inicioDoMes,
  nomeDoMesEAno,
  somarMeses,
  type DataLocal,
} from '@/utilidades/datas'

import { diasDoAtalho, MAXIMO_DE_ENCONTROS_EM_LOTE, type AtalhoDeDias } from './variosDias'

const INICIAIS_DOS_DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const
/** A partir desta escala de fonte, sete colunas não cabem: o mês vira uma lista de dias. */
const ESCALA_DA_LISTA = 1.35
/** O círculo do número: cabe no alvo de 48 com folga. */
const CIRCULO = 36

interface Props {
  selecionados: readonly DataLocal[]
  /** Tocou num dia: marca ou desmarca. */
  aoAlternar: (dia: DataLocal) => void
  /** Um atalho trocou todos os dias de uma vez. */
  aoDefinir: (dias: DataLocal[]) => void
  hoje: DataLocal
  maximo?: number
}

/**
 * Calendário do mês com seleção MÚLTIPLA (D78): cada toque marca ou desmarca um dia, e cada dia
 * marcado vira um encontro. O dia marcado é um círculo cheio com um check embaixo (cor nunca é o
 * único sinal); hoje tem anel; dias que já passaram ficam apagados e fora do toque. Alvos de 48.
 * Atalhos "Esta semana" e "Fim de semana" marcam vários de uma vez. Com fonte grande, o mês vira
 * uma lista de dias com caixa de marcar. Uma frase abaixo diz quantos encontros serão criados.
 */
export function CalendarioDeVariosDias({
  selecionados,
  aoAlternar,
  aoDefinir,
  hoje,
  maximo = MAXIMO_DE_ENCONTROS_EM_LOTE,
}: Props) {
  const { fontScale } = useWindowDimensions()
  const [referencia, setReferencia] = useState<DataLocal>(inicioDoMes(selecionados[0] ?? hoje))
  const mes = referencia.slice(0, 7)
  const dias = gradeDoMes(referencia)
  const cheio = selecionados.length >= maximo
  const noMesDeHoje = mes === hoje.slice(0, 7)

  function atalho(qual: AtalhoDeDias) {
    const escolhidos = diasDoAtalho(qual, hoje)
    aoDefinir(escolhidos)
    if (escolhidos[0]) setReferencia(inicioDoMes(escolhidos[0]))
  }

  return (
    <View style={{ gap: ESPACO.e12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
        <Botao
          titulo="Esta semana"
          tamanho="compacto"
          variante="secundario"
          dica="Marca os dias que faltam até o fim desta semana."
          aoPressionar={() => atalho('semana')}
        />
        <Botao
          titulo="Fim de semana"
          tamanho="compacto"
          variante="secundario"
          dica="Marca os dois dias do próximo fim de semana."
          aoPressionar={() => atalho('fim_de_semana')}
        />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
        <TextoAnunciado soMudancas variante="tituloItem" style={{ flex: 1 }}>
          {nomeDoMesEAno(referencia)}
        </TextoAnunciado>
        <BotaoIcone
          icone="voltar"
          rotulo="Mês anterior"
          desabilitado={noMesDeHoje}
          aoPressionar={() => setReferencia((r) => somarMeses(r, -1))}
        />
        <BotaoIcone
          icone="avancar"
          rotulo="Próximo mês"
          aoPressionar={() => setReferencia((r) => somarMeses(r, 1))}
        />
      </View>

      {fontScale >= ESCALA_DA_LISTA ? (
        <Lista>
          {dias
            .filter((d) => d.startsWith(mes) && d >= hoje)
            .map((dia) => (
              <LinhaDeLista
                key={dia}
                icone="agenda"
                titulo={`${formatarDataPorExtenso(dia, false)}${dia === hoje ? ' (hoje)' : ''}`}
                semSeta
                marcada={selecionados.includes(dia)}
                desabilitada={cheio && !selecionados.includes(dia)}
                aoPressionar={() => aoAlternar(dia)}
              />
            ))}
        </Lista>
      ) : (
        <View>
          <View
            style={{ flexDirection: 'row', marginBottom: ESPACO.e4 }}
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
          {Array.from({ length: 6 }, (_, s) => dias.slice(s * 7, s * 7 + 7))
            .filter((semana) => semana.some((d) => d.startsWith(mes)))
            .map((semana) => (
              <View key={semana[0]} style={{ flexDirection: 'row' }}>
                {semana.map((dia) =>
                  dia.startsWith(mes) ? (
                    <CelulaDoDia
                      key={dia}
                      dia={dia}
                      ehHoje={dia === hoje}
                      passado={dia < hoje}
                      marcado={selecionados.includes(dia)}
                      semVaga={cheio && !selecionados.includes(dia)}
                      aoTocar={aoAlternar}
                    />
                  ) : (
                    <View key={dia} style={{ flex: 1 }} />
                  ),
                )}
              </View>
            ))}
        </View>
      )}

      {cheio ? (
        <Texto variante="legenda" cor="textoSuave">
          {`Até ${maximo} dias de uma vez. Desmarque um dia para escolher outro.`}
        </Texto>
      ) : null}
    </View>
  )
}

function CelulaDoDia({
  dia,
  ehHoje,
  passado,
  marcado,
  semVaga,
  aoTocar,
}: {
  dia: DataLocal
  ehHoje: boolean
  passado: boolean
  marcado: boolean
  semVaga: boolean
  aoTocar: (dia: DataLocal) => void
}) {
  const { cores } = useTema()
  // O dia marcado sempre pode ser desmarcado, mesmo que já tenha passado (a data veio da Agenda).
  const bloqueado = !marcado && (passado || semVaga)
  const rotulo = `${formatarDataPorExtenso(dia)}${ehHoje ? ', hoje' : ''}`
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={rotulo}
      accessibilityState={{ checked: marcado, disabled: bloqueado }}
      aria-checked={marcado}
      disabled={bloqueado}
      onPress={() => aoTocar(dia)}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: ALTURA.controle + ESPACO.e4,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: RAIO.celula,
        backgroundColor: pressed ? cores.pressionado : 'transparent',
      })}
    >
      <View
        style={{
          width: CIRCULO,
          height: CIRCULO,
          borderRadius: RAIO.pilula,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: marcado ? cores.primaria : 'transparent',
          // Hoje: um anel (forma), para não depender de cor.
          borderWidth: ehHoje && !marcado ? 2 : 0,
          borderColor: cores.texto,
        }}
      >
        <Texto
          variante="corpo"
          peso={marcado || ehHoje ? 'forte' : 'medio'}
          cor={marcado ? 'sobrePrimaria' : bloqueado ? 'textoSuave' : 'texto'}
          centralizado
          tabular
          maxFontSizeMultiplier={ESCALA_DA_LISTA}
        >
          {Number(dia.slice(8, 10))}
        </Texto>
      </View>
      <View style={{ height: ESPACO.e12, justifyContent: 'center' }}>
        {marcado ? <Icone nome="check" cor={cores.destaque} tamanho={12} peso="forte" /> : null}
      </View>
    </Pressable>
  )
}
