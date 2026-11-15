import type { DiaDaSemana } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { CampoDeData } from '@/ui/CampoDeMomento'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { Segmentos } from '@/ui/Segmentos'
import { Texto } from '@/ui/Texto'
import {
  diaDaSemana,
  formatarDataPorExtenso,
  lerDataDigitada,
  NOMES_DOS_DIAS,
  type DataLocal,
} from '@/utilidades/datas'

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

/** "Segunda-feira" vira "Segunda": cabe na pílula e continua claro para o leitor de tela. */
function nomeCurtoDoDia(d: DiaDaSemana): string {
  const nome = NOMES_DOS_DIAS[d].replace('-feira', '')
  return nome.charAt(0).toLocaleUpperCase('pt-BR') + nome.slice(1)
}

/**
 * Regra de repetição semanal ou mensal, com a prévia das próximas datas.
 * Fica dentro de um cartão de formulário: segmentos para a frequência,
 * pílulas para os dias e o "Repete até" pelo seletor de data.
 */
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
    <View style={{ gap: ESPACO.e16 }}>
      <Segmentos
        rotulo="Repetição"
        valor={r.repeticao}
        aoMudar={(v) => mudar({ repeticao: v })}
        segmentos={repeticoes}
      />
      {r.repeticao === 'semanal' ? (
        <>
          <View style={{ gap: ESPACO.e8 }}>
            <Texto variante="rotulo" cor="textoSuave">
              Dias da semana
            </Texto>
            <PilulasDeFiltro
              rotulo="Dias da semana"
              multipla
              sangrar={false}
              pilulas={ORDEM_DOS_DIAS.map((d) => ({
                valor: String(d) as `${DiaDaSemana}`,
                rotulo: nomeCurtoDoDia(d),
              }))}
              selecionadas={r.diasDaSemana.map((d) => String(d) as `${DiaDaSemana}`)}
              aoMudar={(v) =>
                mudar({ diasDaSemana: v.map((d) => Number(d) as DiaDaSemana).sort() })
              }
            />
            <Texto variante="legenda" cor="textoSuave">
              {`Sem marcar nenhum, vale o dia da data escolhida (${nomeDoDia}).`}
            </Texto>
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
          <ListaDeOpcoes
            rotulo="Em que dia do mês"
            valor={r.modoMensal}
            aoMudar={(v) => mudar({ modoMensal: v })}
            opcoes={[
              {
                valor: 'dia_do_mes',
                rotulo: primeira
                  ? `Sempre no dia ${Number(primeira.slice(8, 10))}`
                  : 'No mesmo dia',
                descricao: 'Mês sem esse dia (como 31) fica sem encontro.',
              },
              {
                valor: 'semana_do_mes',
                rotulo: `Num(a) ${nomeDoDia} do mês`,
                descricao: 'Escolha qual logo abaixo.',
              },
            ]}
          />
          {r.modoMensal === 'semana_do_mes' ? (
            <View style={{ gap: ESPACO.e8 }}>
              <Texto variante="rotulo" cor="textoSuave">
                {`Qual ${nomeDoDia} do mês`}
              </Texto>
              <PilulasDeFiltro
                rotulo={`Qual ${nomeDoDia} do mês`}
                sangrar={false}
                pilulas={[
                  { valor: '1', rotulo: '1ª' },
                  { valor: '2', rotulo: '2ª' },
                  { valor: '3', rotulo: '3ª' },
                  { valor: '4', rotulo: '4ª' },
                  { valor: '-1', rotulo: 'Última' },
                ]}
                selecionadas={[String(r.semanaDoMes) as '1' | '2' | '3' | '4' | '-1']}
                aoMudar={(v) => {
                  if (v[0]) mudar({ semanaDoMes: Number(v[0]) as SemanaDoMes })
                }}
              />
            </View>
          ) : null}
        </>
      ) : null}
      {r.repeticao !== 'nao' ? (
        <>
          <CampoDeData
            rotulo="Repete até"
            opcional
            valor={r.fim.trim() || null}
            aoMudar={(v) => mudar({ fim: v })}
            erro={erroDoFim ?? null}
            ajuda="Em branco, repete sem data para acabar. As datas são criadas com 6 meses de antecedência."
            {...(primeira ? { minimo: primeira } : {})}
          />
          {regra ? (
            <View
              accessible
              accessibilityLabel={`${descreverRegra(regra, hora ?? undefined)}. Próximas datas: ${previa.map((d) => formatarDataPorExtenso(d)).join('; ')}`}
              style={{ gap: ESPACO.e4 }}
            >
              <Texto variante="tituloItem">{descreverRegra(regra, hora ?? undefined)}</Texto>
              <Texto variante="meta" cor="textoSuave">
                {`Próximas datas: ${
                  previa.length
                    ? previa.map((d) => formatarDataPorExtenso(d, false)).join('; ')
                    : 'nenhuma com essa regra.'
                }`}
              </Texto>
            </View>
          ) : (
            <Texto variante="legenda" cor="textoSuave">
              Escolha a data para ver as próximas ocorrências.
            </Texto>
          )}
        </>
      ) : null}
    </View>
  )
}
