import { ehEtapaDeLouvor, resumoDaBanda } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { Acordeao } from '@/ui/Acordeao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Icone } from '@/ui/Icone'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { formatarHora } from '@/utilidades/datas'

import { usePode } from '../comunidade/permissoes'
import { useInscricoes } from '../inscricoes/consultas'
import { usePacoteDoEvento } from '../offline/ProvedorOffline'
import { CartaoDoRepertorioNoEncontro } from '../repertorio/CartaoDoRepertorioNoEncontro'
import { contarRespostas, juntarNomes } from './respostas'
import { faseDoEncontro, podeIrAoVivo } from './regras'
import { AvisoDeStatus, Preparacao, QuandoEOnde, SobreOEncontro } from './PartesDaPagina'

/** "9 de 11 responderam. Faltam: Bruno e Camila. Falta: bateria.": a linha dos Convocados no Resumo. */
function resumoDosConvocadosDoEncontro(evento: DetalheDoEvento): string {
  const r = contarRespostas(evento.atribuicoes)
  if (r.convocados === 0) return 'Ninguém convocado ainda.'
  const louvor = evento.etapas.find((e) => ehEtapaDeLouvor(e.titulo))
  const faltam = louvor
    ? resumoDaBanda(evento.atribuicoes.filter((a) => a.etapaId === louvor.id)).faltam
    : []
  return [
    `${r.responderam} de ${r.convocados} responderam.`,
    r.pendentes > 0 ? `Faltam: ${juntarNomes(r.nomesPendentes)}.` : 'Todos responderam.',
    faltam.length > 0 ? `Falta: ${faltam.map((f) => f.toLowerCase()).join(', ')}.` : null,
  ]
    .filter(Boolean)
    .join(' ')
}

/** "3 tarefas, 1 atrasada": o que a Preparação diz fechada. */
export function resumoDaPreparacao(evento: DetalheDoEvento, agora: Date = new Date()): string {
  const abertas = evento.tarefas.filter((t) => !t.concluidaEm)
  const atrasadas = abertas.filter((t) => t.prazo && new Date(t.prazo).getTime() < agora.getTime())
  const partes = [
    evento.tarefas.length > 0
      ? `${evento.tarefas.length} ${evento.tarefas.length === 1 ? 'tarefa' : 'tarefas'}`
      : null,
    atrasadas.length > 0
      ? `${atrasadas.length} ${atrasadas.length === 1 ? 'atrasada' : 'atrasadas'}`
      : null,
    evento.materiais.length > 0
      ? `${evento.materiais.length} ${evento.materiais.length === 1 ? 'material' : 'materiais'}`
      : null,
  ].filter(Boolean)
  return partes.length > 0 ? partes.join(', ') : 'Checklist, notas e anexos'
}

/** A linha "Inscrições: 12 de 60", só para quem pode ler a lista (o número vem da lista). */
function LinhaDeInscricoes({
  evento,
  comunidadeId,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
}) {
  const lista = useInscricoes(comunidadeId, evento.id)
  const confirmadas = lista.data?.contagem.confirmadas
  const texto =
    confirmadas === undefined
      ? 'Inscrições'
      : evento.capacidade
        ? `Inscrições: ${confirmadas} de ${evento.capacidade}`
        : `Inscrições: ${confirmadas}`
  return (
    <LinhaDeLista
      icone="inscricoes"
      titulo={texto}
      aoPressionar={() =>
        router.push({ pathname: '/evento/[eventoId]/inscricoes', params: { eventoId: evento.id } })
      }
    />
  )
}

/**
 * A aba Resumo da organização (D69, seção 3.4): quando e onde com "Como chegar", os Convocados
 * ("9 de 11 responderam. Faltam: ..."), o Louvor ("Montar o repertório"), o Check-in (de 2 h antes
 * até o fim), as Inscrições e a Preparação dobrada. Cada linha leva ao lugar onde se resolve.
 */
export function ResumoDoEncontro({
  evento,
  comunidadeId,
  aoVerConvocados,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
  aoVerConvocados: () => void
}) {
  const { cores } = useTema()
  const pode = usePode()
  const guardado = usePacoteDoEvento(evento.id).data ?? null
  const fase = faseDoEncontro(evento)
  const registraPresenca = pode('presenca', 'registrar') && podeIrAoVivo(evento.status)
  const noPeriodoDoCheckin = fase === 'checkin' || fase === 'acontecendo'
  const params = { eventoId: evento.id }
  return (
    <>
      <AvisoDeStatus evento={evento} />
      <QuandoEOnde evento={evento} />
      <CartaoDeVidro lista>
        <Lista>
          <LinhaDeLista
            icone="escalas"
            titulo="Convocados"
            descricao={resumoDosConvocadosDoEncontro(evento)}
            linhasDaDescricao={0}
            aoPressionar={aoVerConvocados}
          />
          {registraPresenca && noPeriodoDoCheckin ? (
            <LinhaDeLista
              icone="qr"
              titulo="Check-in"
              descricao="Marque quem chegou, pelo nome ou pelo QR"
              aoPressionar={() => router.push({ pathname: '/evento/[eventoId]/checkin', params })}
            />
          ) : null}
          {pode('inscricao', 'ler_lista') ? (
            <LinhaDeInscricoes evento={evento} comunidadeId={comunidadeId} />
          ) : null}
        </Lista>
      </CartaoDeVidro>
      <CartaoDoRepertorioNoEncontro evento={evento} comunidadeId={comunidadeId} />
      {guardado ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
          <Icone nome="confirmado" cor={cores.sucesso} tamanho={18} />
          <Texto variante="meta" cor="textoSuave">
            {`Baixado para usar sem internet às ${formatarHora(guardado.baixadoEm, evento.fuso)}`}
          </Texto>
        </View>
      ) : null}
      <Acordeao
        chave={`preparacao-${evento.id}`}
        cabecalho={() => (
          <View style={{ flex: 1, gap: ESPACO.e4 }}>
            <Texto variante="tituloItem">Preparação</Texto>
            <Texto variante="meta" cor="textoSuave">
              {resumoDaPreparacao(evento)}
            </Texto>
          </View>
        )}
        rotuloRecolhido={`Preparação: ${resumoDaPreparacao(evento)}. Recolhido.`}
        rotuloAberto="Preparação. Aberto."
      >
        <Preparacao evento={evento} comunidadeId={comunidadeId} />
      </Acordeao>
      <SobreOEncontro evento={evento} />
    </>
  )
}
