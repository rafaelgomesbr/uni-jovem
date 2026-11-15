import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { abrirLink } from '@/utilidades/compartilhar'
import {
  dataDoInstante,
  diaDaSemana,
  falarQuando,
  formatarDataPorExtenso,
  formatarDuracao,
  formatarHora,
  formatarQuando,
  NOMES_DOS_DIAS,
} from '@/utilidades/datas'
import { linkDoMapa } from '@/utilidades/mapas'

import { usePode } from '../comunidade/permissoes'
import { InscricaoRebaixada, useAoVivoNoDia, useTipoDeDestaque } from './DestaqueDoEvento'
import { ChipDoStatus } from './LinhaDoEvento'
import { NOME_DA_VISIBILIDADE } from './nomes'
import { podeIrAoVivo } from './regras'

const MESES_CURTOS = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'maio',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.',
] as const

function primeiraMaiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1)
}

/** "Sábado, 15 de nov. · 16:00 · 60 min" (3.4.2, item 2). */
export function metaDoEvento(evento: Pick<DetalheDoEvento, 'inicio' | 'fuso' | 'duracaoMin'>) {
  const dia = dataDoInstante(evento.inicio, evento.fuso)
  const nomeDoDia = primeiraMaiuscula(NOMES_DOS_DIAS[diaDaSemana(dia)] ?? '')
  const mes = MESES_CURTOS[Number(dia.slice(5, 7)) - 1] ?? ''
  return `${nomeDoDia}, ${Number(dia.slice(8, 10))} de ${mes} · ${formatarHora(evento.inicio, evento.fuso)} · ${formatarDuracao(evento.duracaoMin)}`
}

/**
 * Logo abaixo do título: a meta em `corpo` suave e a linha de chips
 * (situação, se não estiver publicado; Interna ou Pública; Série). O título
 * é o da tela; o cabeçalho põe este bloco a 8 dele (quadro 03).
 */
export function MetaDoEvento({ evento, extra }: { evento: DetalheDoEvento; extra?: string }) {
  return (
    <View style={{ gap: ESPACO.e8 }}>
      <Texto
        variante="corpo"
        cor="textoSuave"
        tabular
        accessibilityLabel={`${falarQuando(evento.inicio, evento.fuso)}, duração de ${formatarDuracao(evento.duracaoMin)}`}
      >
        {metaDoEvento(evento)}
      </Texto>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
        <ChipDoStatus status={evento.status} />
        <Chip
          texto={NOME_DA_VISIBILIDADE[evento.visibilidade]}
          tom={evento.visibilidade === 'publica' ? 'info' : 'neutro'}
        />
        {evento.serieId ? <Chip texto="Série" tom="neutro" icone="repetir" /> : null}
        {extra ? <Chip texto={extra} tom="alerta" /> : null}
      </View>
    </View>
  )
}

/**
 * Visão geral (3.4.2, item 5): o aviso de cancelado ou adiado, a inscrição
 * da própria pessoa quando o destaque é outro, "QUANDO E ONDE" em cartão
 * lista (com Inscrições, Check-in e o ao vivo) e "SOBRE".
 */
export function VisaoGeralDoEvento({
  evento,
  comunidadeId,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
}) {
  const pode = usePode()
  const noDia = useAoVivoNoDia(evento)
  const tipoDeDestaque = useTipoDeDestaque(evento)
  const verLista = pode('inscricao', 'ler_lista')
  const conduz = pode('ao_vivo', 'conduzir')
  const registraPresenca = pode('presenca', 'registrar') && podeIrAoVivo(evento.status)
  const params = { eventoId: evento.id }
  const dia = dataDoInstante(evento.inicio, evento.fuso)
  const fim = new Date(Date.parse(evento.inicio) + evento.duracaoMin * 60_000).toISOString()
  const mapa = evento.local ? linkDoMapa(evento.local) : null
  const vagas = [
    evento.capacidade ? `${evento.capacidade} vagas` : 'Sem limite de vagas',
    evento.capacidade && evento.listaDeEspera ? 'lista de espera' : null,
    evento.inscricaoAte ? `até ${formatarQuando(evento.inscricaoAte, evento.fuso)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const descricaoDoLocal = evento.local
    ? [
        evento.local.tipo === 'interno' ? 'Local interno' : evento.local.endereco,
        evento.local.referencia,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'A organização ainda vai definir.'

  return (
    <>
      {evento.status === 'cancelado' || evento.status === 'adiado' ? (
        <Aviso
          tipo="alerta"
          titulo={evento.status === 'cancelado' ? 'Evento cancelado' : 'Evento adiado'}
        >
          {evento.motivoStatus ? `Motivo: ${evento.motivoStatus}` : 'Sem motivo informado.'}
        </Aviso>
      ) : null}

      {tipoDeDestaque === 'entrada' ? null : (
        <InscricaoRebaixada evento={evento} comunidadeId={comunidadeId} />
      )}

      <CartaoDeVidro sobrancelha="Quando e onde" lista>
        <Lista>
          <LinhaDeLista
            icone="relogio"
            titulo={primeiraMaiuscula(formatarDataPorExtenso(dia, false))}
            descricao={`${formatarHora(evento.inicio, evento.fuso)} às ${formatarHora(fim, evento.fuso)} · ${formatarDuracao(evento.duracaoMin)}`}
            rotuloAcessivel={`${falarQuando(evento.inicio, evento.fuso)}, até ${formatarHora(fim, evento.fuso)}. Duração prevista de ${formatarDuracao(evento.duracaoMin)}`}
          />
          <LinhaDeLista
            icone="local"
            titulo={evento.local?.nome ?? 'Local a definir'}
            descricao={descricaoDoLocal}
            {...(mapa && evento.local
              ? {
                  extra: (
                    <Botao
                      titulo="Abrir no mapa"
                      variante="terciario"
                      rotuloAcessivel={`Abrir no mapa: ${evento.local.nome}`}
                      aoPressionar={() => void abrirLink(mapa)}
                    />
                  ),
                }
              : {})}
          />
          <LinhaDeLista
            icone="inscricoes"
            titulo="Inscrições"
            descricao={vagas}
            {...(verLista
              ? {
                  rotuloAcessivel: `Inscrições. ${vagas}. Abrir a lista`,
                  aoPressionar: () =>
                    router.push({ pathname: '/evento/[eventoId]/inscricoes', params }),
                }
              : {})}
          />
          {/* Ao lado de Inscrições: o check-in não fica só atrás do "Mais" (U-04). */}
          {registraPresenca ? (
            <LinhaDeLista
              icone="qr"
              titulo="Check-in"
              descricao="Marque quem chegou, pelo nome ou pelo QR"
              rotuloAcessivel="Check-in de presença. Marque quem chegou, pelo nome ou pelo QR"
              aoPressionar={() => router.push({ pathname: '/evento/[eventoId]/checkin', params })}
            />
          ) : null}
          {podeIrAoVivo(evento.status) && !noDia ? (
            <LinhaDeLista
              icone="aoVivo"
              titulo={conduz ? 'Conduzir ao vivo' : 'Acompanhar ao vivo'}
              descricao="O andamento da programação, etapa por etapa"
              aoPressionar={() => router.push({ pathname: '/evento/[eventoId]/ao-vivo', params })}
            />
          ) : null}
        </Lista>
      </CartaoDeVidro>

      {evento.descricao || evento.informacoesUteis ? (
        <CartaoDeVidro sobrancelha={evento.descricao ? 'Sobre' : 'Informações úteis'}>
          {evento.descricao ? <Texto variante="leitura">{evento.descricao}</Texto> : null}
          {evento.descricao && evento.informacoesUteis ? (
            <Texto variante="sobrancelha" style={{ marginTop: ESPACO.e4 }}>
              Informações úteis
            </Texto>
          ) : null}
          {evento.informacoesUteis ? (
            <Texto variante="leitura">{evento.informacoesUteis}</Texto>
          ) : null}
        </CartaoDeVidro>
      ) : null}
    </>
  )
}
