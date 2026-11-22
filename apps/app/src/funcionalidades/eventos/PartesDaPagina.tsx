import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import type { Atribuicao, DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { Aviso } from '@/ui/Aviso'
import { Avatar } from '@/ui/Avatar'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Texto } from '@/ui/Texto'
import { abrirLink } from '@/utilidades/compartilhar'
import {
  dataDoInstante,
  falarQuando,
  formatarDataPorExtenso,
  formatarDuracao,
  formatarHora,
} from '@/utilidades/datas'
import { linkDoMapa } from '@/utilidades/mapas'

import { primeiraMaiuscula } from '../agenda/semanas'
import { useMeuVinculo } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { MinhaInscricao } from '../inscricoes/MinhaInscricao'
import { pessoasDistintas } from './Convocacao'
import { SecaoAnexos, SecaoChecklist, SecaoNotas } from './SecaoChecklist'
import { SecaoMateriais, SecaoTarefas } from './SecaoTarefas'

/** O aviso de encontro cancelado ou adiado, com o motivo (vale para todos). */
export function AvisoDeStatus({ evento }: { evento: DetalheDoEvento }) {
  if (evento.status !== 'cancelado' && evento.status !== 'adiado') return null
  return (
    <Aviso
      tipo="alerta"
      titulo={evento.status === 'cancelado' ? 'Encontro cancelado' : 'Encontro adiado'}
    >
      {evento.motivoStatus ? `Motivo: ${evento.motivoStatus}` : 'Sem motivo informado.'}
    </Aviso>
  )
}

/**
 * "Quando e onde" (D69): o dia por extenso, o horário com a duração, o local com a referência e o
 * "Como chegar" (abre o mapa do sistema; sem endereço, o botão não aparece e o texto diz "a definir").
 */
export function QuandoEOnde({ evento }: { evento: DetalheDoEvento }) {
  const dia = dataDoInstante(evento.inicio, evento.fuso)
  const fim = new Date(Date.parse(evento.inicio) + evento.duracaoMin * 60_000).toISOString()
  const mapa = evento.local ? linkDoMapa(evento.local) : null
  const apoioDoLocal = evento.local
    ? [evento.local.tipo === 'interno' ? null : evento.local.endereco, evento.local.referencia]
        .filter(Boolean)
        .join(' · ')
    : 'A organização ainda vai definir.'
  return (
    <Secao titulo="Quando e onde">
      <CartaoDeVidro>
        <View
          accessible
          accessibilityLabel={`${falarQuando(evento.inicio, evento.fuso)}, até ${formatarHora(fim, evento.fuso)}. Duração prevista de ${formatarDuracao(evento.duracaoMin)}`}
          style={{ gap: ESPACO.e4 }}
        >
          <Texto variante="tituloItem">
            {primeiraMaiuscula(formatarDataPorExtenso(dia, false))}
          </Texto>
          <Texto variante="meta" cor="textoSuave" tabular>
            {`${formatarHora(evento.inicio, evento.fuso)} às ${formatarHora(fim, evento.fuso)} · ${formatarDuracao(evento.duracaoMin)}`}
          </Texto>
        </View>
        <View style={{ gap: ESPACO.e4 }}>
          <Texto variante="tituloItem">{evento.local?.nome ?? 'Local a definir'}</Texto>
          {apoioDoLocal ? (
            <Texto variante="meta" cor="textoSuave">
              {apoioDoLocal}
            </Texto>
          ) : null}
        </View>
        {mapa && evento.local ? (
          <View style={{ alignItems: 'flex-start' }}>
            <Botao
              titulo="Como chegar"
              icone="local"
              variante="secundario"
              rotuloAcessivel={`Como chegar: ${evento.local.nome}`}
              aoPressionar={() => void abrirLink(mapa)}
            />
          </View>
        ) : null}
      </CartaoDeVidro>
    </Secao>
  )
}

/**
 * O roteiro enxuto da página do membro (D69): as três primeiras etapas, "você" na que é dele e
 * "Ver tudo, 7 etapas". Sem roteiro, a frase diz o que aconteceu (e a organização monta na aba Roteiro).
 */
export function RoteiroEnxuto({ evento }: { evento: DetalheDoEvento }) {
  const eu = useMeuVinculo()
  const [tudo, setTudo] = useState(false)
  const minhasEtapas = new Set(
    evento.atribuicoes
      .filter((a) => a.vinculoId === eu && a.estado !== 'recusada')
      .map((a) => a.etapaId),
  )
  const n = evento.etapas.length
  const mostradas = tudo ? evento.etapas : evento.etapas.slice(0, 3)
  return (
    <Secao titulo="Roteiro">
      {n === 0 ? (
        <CartaoDeVidro>
          <Texto variante="corpo" cor="textoSuave">
            O roteiro ainda não foi montado.
          </Texto>
        </CartaoDeVidro>
      ) : (
        <CartaoDeVidro lista>
          <Lista>
            {mostradas.map((e) => (
              <LinhaDeLista
                key={e.id}
                hora={formatarHora(e.inicioPrevisto, evento.fuso)}
                titulo={e.titulo}
                descricao={formatarDuracao(e.duracaoMin)}
                {...(minhasEtapas.has(e.id) ? { extra: <Chip texto="você" tom="quente" /> } : {})}
                rotuloAcessivel={`${formatarHora(e.inicioPrevisto, evento.fuso)}, ${e.titulo}, ${formatarDuracao(e.duracaoMin)}${minhasEtapas.has(e.id) ? ', é a sua parte' : ''}`}
              />
            ))}
          </Lista>
          {n > 3 ? (
            <View style={{ paddingHorizontal: ESPACO.e16, paddingBottom: ESPACO.e8 }}>
              <Botao
                titulo={tudo ? 'Ver menos' : `Ver tudo, ${n} etapas`}
                variante="terciario"
                alinhado
                aoPressionar={() => setTudo((t) => !t)}
              />
            </View>
          ) : null}
        </CartaoDeVidro>
      )}
    </Secao>
  )
}

/** "Quem serve (9)": os avatares e "Ver todos", que abre a lista com a função de cada um. */
export function QuemServe({ evento }: { evento: DetalheDoEvento }) {
  const [todos, setTodos] = useState(false)
  const ativas = evento.atribuicoes.filter((a) => a.estado !== 'recusada')
  const total = pessoasDistintas(evento.atribuicoes)
  if (total === 0) return null
  const unicas: Atribuicao[] = []
  for (const a of ativas) if (!unicas.some((u) => u.vinculoId === a.vinculoId)) unicas.push(a)
  const primeiras = unicas.slice(0, 5)
  return (
    <Secao titulo={`Quem serve (${total})`}>
      <CartaoDeVidro>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8, flexWrap: 'wrap' }}
        >
          <View style={{ flexDirection: 'row' }} accessibilityElementsHidden>
            {primeiras.map((a) => (
              <View key={a.vinculoId} style={{ marginRight: -ESPACO.e8 }}>
                <Avatar nome={a.nome} lado={36} decorativo />
              </View>
            ))}
          </View>
          {total > primeiras.length ? (
            <Texto variante="meta" cor="textoSuave" style={{ marginLeft: ESPACO.e12 }}>
              {`+${total - primeiras.length}`}
            </Texto>
          ) : null}
          <View style={{ flex: 1 }} />
          <Botao
            titulo={todos ? 'Ver menos' : 'Ver todos'}
            variante="terciario"
            aoPressionar={() => setTodos((t) => !t)}
          />
        </View>
        {todos ? (
          <Lista>
            {ativas.map((a) => (
              <LinhaDeLista
                key={a.id}
                avatar={{ nome: a.nome }}
                titulo={a.nome}
                descricao={a.funcao}
                semSeta
              />
            ))}
          </Lista>
        ) : null}
      </CartaoDeVidro>
    </Secao>
  )
}

/** A inscrição da própria pessoa: o cartão com o QR ou o "Inscrever-me", mais as vagas. */
export function InscricaoDoMembro({
  evento,
  comunidadeId,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
}) {
  const pode = usePode()
  if (!pode('inscricao', 'inscrever_se', { proprio: true })) return null
  if (evento.status !== 'publicado') return null
  const vagas = [
    evento.capacidade ? `${evento.capacidade} vagas` : 'Sem limite de vagas',
    evento.capacidade && evento.listaDeEspera ? 'lista de espera' : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Secao titulo="Inscrição">
      <CartaoDeVidro>
        <Texto variante="meta" cor="textoSuave">
          {`Inscrição: ${vagas}`}
        </Texto>
        <MinhaInscricao evento={evento} comunidadeId={comunidadeId} secundario />
      </CartaoDeVidro>
    </Secao>
  )
}

/** "Sobre o encontro": a descrição e as informações úteis. */
export function SobreOEncontro({ evento }: { evento: DetalheDoEvento }) {
  if (!evento.descricao && !evento.informacoesUteis) return null
  return (
    <Secao titulo="Sobre o encontro">
      <CartaoDeVidro>
        {evento.descricao ? <Texto variante="leitura">{evento.descricao}</Texto> : null}
        {evento.informacoesUteis ? (
          <>
            {evento.descricao ? (
              <Texto variante="sobrancelha" style={{ marginTop: ESPACO.e4 }}>
                Informações úteis
              </Texto>
            ) : null}
            <Texto variante="leitura">{evento.informacoesUteis}</Texto>
          </>
        ) : null}
      </CartaoDeVidro>
    </Secao>
  )
}

/** Há tarefas, materiais, checklist ou anexos a mostrar? */
export function temPreparacao(evento: DetalheDoEvento): boolean {
  return (
    evento.tarefas.length +
      evento.materiais.length +
      evento.checklist.length +
      evento.anexos.length >
    0
  )
}

/** "Preparação" (só se tiver algo, ou para quem organiza): tarefas, materiais, checklist, notas e anexos. */
export function Preparacao({
  evento,
  comunidadeId,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
}) {
  return (
    <View style={{ gap: ESPACO.e16 }}>
      <SecaoTarefas evento={evento} comunidadeId={comunidadeId} />
      <SecaoMateriais evento={evento} comunidadeId={comunidadeId} />
      <SecaoChecklist evento={evento} comunidadeId={comunidadeId} />
      <SecaoNotas evento={evento} comunidadeId={comunidadeId} />
      <SecaoAnexos evento={evento} comunidadeId={comunidadeId} />
    </View>
  )
}
