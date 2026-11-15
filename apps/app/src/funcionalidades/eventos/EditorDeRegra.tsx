import type { DiaDaSemana } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import {
  diaDaSemana,
  formatarDataPorExtenso,
  lerDataDigitada,
  NOMES_DOS_DIAS,
  type DataLocal,
} from '@/utilidades/datas'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo } from '@/ui/Campo'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Segmentos } from '@/ui/Segmentos'
import { Texto } from '@/ui/Texto'

import {
  previaDasDatas,
  regraDoRascunho,
  type RascunhoDaRegra,
  type Repeticao,
  type SemanaDoMes,
} from './formulario'
import { descreverRegra } from './nomes'

interface Props {
  regra: RascunhoDaRegra
  aoMudar: (regra: RascunhoDaRegra) => void
  /** Data da primeira ocorrência (já validada), base do mensal e da prévia. */
  primeira: DataLocal | null
  hora: string | null
  /** Esconde "Não repete" (ao editar uma série que já existe). */
  semNaoRepete?: boolean
  erroDoFim?: string | null
}

const ORDEM_DOS_DIAS: readonly DiaDaSemana[] = [0, 1, 2, 3, 4, 5, 6]

/** Regra de repetição semanal ou mensal, com a prévia das próximas datas. */
export function EditorDeRegra({
  regra: r,
  aoMudar,
  primeira,
  hora,
  semNaoRepete = false,
  erroDoFim,
}: Props) {
  const mudar = (parcial: Partial<RascunhoDaRegra>) => aoMudar({ ...r, ...parcial })
  const { regra } = primeira ? regraDoRascunho(r, primeira) : { regra: null }
  const fim = r.fim.trim() ? lerDataDigitada(r.fim) : null
  const previa = regra && primeira ? previaDasDatas(regra, primeira, fim) : []
  const nomeDoDia = primeira ? NOMES_DOS_DIAS[diaDaSemana(primeira)] : 'dia da data escolhida'

  const repeticoes: { valor: Repeticao; rotulo: string }[] = [
    ...(semNaoRepete ? [] : [{ valor: 'nao' as const, rotulo: 'Não repete' }]),
    { valor: 'semanal', rotulo: 'Toda semana' },
    { valor: 'mensal', rotulo: 'Todo mês' },
  ]

  return (
    <View style={{ gap: ESPACO.x3 }}>
      <Segmentos
        rotulo="Repetição"
        valor={r.repeticao}
        aoMudar={(v) => mudar({ repeticao: v })}
        segmentos={repeticoes}
      />
      {r.repeticao === 'semanal' ? (
        <>
          <View accessibilityRole="none" style={{ gap: ESPACO.x1 }}>
            <Texto variante="corpoForte">Dias da semana</Texto>
            <Texto variante="apoio" cor="textoSuave">
              Sem marcar nenhum, vale o dia da data escolhida ({nomeDoDia}).
            </Texto>
            {ORDEM_DOS_DIAS.map((d) => (
              <CaixaDeMarcar
                key={d}
                rotulo={NOMES_DOS_DIAS[d]}
                marcada={r.diasDaSemana.includes(d)}
                aoMudar={(marcada) =>
                  mudar({
                    diasDaSemana: marcada
                      ? [...r.diasDaSemana, d].sort()
                      : r.diasDaSemana.filter((x) => x !== d),
                  })
                }
              />
            ))}
          </View>
          <Segmentos
            rotulo="Frequência"
            valor={String(r.intervaloSemanas) as '1' | '2' | '3' | '4'}
            aoMudar={(v) => mudar({ intervaloSemanas: Number(v) as 1 | 2 | 3 | 4 })}
            segmentos={[
              { valor: '1', rotulo: 'Toda semana' },
              { valor: '2', rotulo: 'A cada 2' },
              { valor: '3', rotulo: 'A cada 3' },
              { valor: '4', rotulo: 'A cada 4' },
            ]}
          />
        </>
      ) : null}
      {r.repeticao === 'mensal' ? (
        <>
          <GrupoDeOpcoes
            rotulo="Em que dia do mês"
            valor={r.modoMensal}
            aoMudar={(v) => mudar({ modoMensal: v })}
            opcoes={[
              {
                valor: 'dia_do_mes',
                rotulo: primeira
                  ? `Sempre no dia ${Number(primeira.slice(8, 10))}`
                  : 'No mesmo dia',
                descricao: 'Mês sem esse dia (ex.: 31) fica sem encontro.',
              },
              {
                valor: 'semana_do_mes',
                rotulo: `Num(a) ${nomeDoDia} do mês`,
                descricao: 'Escolha qual abaixo.',
              },
            ]}
          />
          {r.modoMensal === 'semana_do_mes' ? (
            <Segmentos
              rotulo={`Qual ${nomeDoDia} do mês`}
              valor={String(r.semanaDoMes) as '1' | '2' | '3' | '4' | '-1'}
              aoMudar={(v) => mudar({ semanaDoMes: Number(v) as SemanaDoMes })}
              segmentos={[
                { valor: '1', rotulo: '1ª' },
                { valor: '2', rotulo: '2ª' },
                { valor: '3', rotulo: '3ª' },
                { valor: '4', rotulo: '4ª' },
                { valor: '-1', rotulo: 'Última' },
              ]}
            />
          ) : null}
        </>
      ) : null}
      {r.repeticao !== 'nao' ? (
        <>
          <Campo
            rotulo="Repete até (opcional)"
            value={r.fim}
            onChangeText={(v) => mudar({ fim: v })}
            erro={erroDoFim ?? null}
            ajuda="Em branco, repete sem data para acabar. As datas são criadas com 6 meses de antecedência."
            exemplo="20/12/2026"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          {regra ? (
            <View
              accessible
              accessibilityLabel={`${descreverRegra(regra, hora ?? undefined)}. Próximas datas: ${previa.map((d) => formatarDataPorExtenso(d)).join('; ')}`}
              style={{ gap: ESPACO.x1 }}
            >
              <Texto variante="corpoForte">{descreverRegra(regra, hora ?? undefined)}</Texto>
              <Texto variante="apoio" cor="textoSuave">
                Próximas datas:{' '}
                {previa.length
                  ? previa.map((d) => formatarDataPorExtenso(d, false)).join('; ')
                  : 'nenhuma com essa regra.'}
              </Texto>
            </View>
          ) : (
            <Texto variante="apoio" cor="textoSuave">
              Preencha a data para ver as próximas ocorrências.
            </Texto>
          )}
        </>
      ) : null}
    </View>
  )
}
