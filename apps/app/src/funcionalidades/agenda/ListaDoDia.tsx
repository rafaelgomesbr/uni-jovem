import type { StatusDoEvento } from '@uj/dominio'
import { ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import type { ResumoDoEvento } from '@/servicos/contratoDosEventos'
import {
  formatarDataPorExtenso,
  formatarDuracao,
  formatarHora,
  type DataLocal,
} from '@/utilidades/datas'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip, type TomDoChip } from '@/ui/Chip'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { FolhaNovaProgramacao } from '../eventos/FolhaNovaProgramacao'
import { rotuloFaladoDoEvento } from '../eventos/LinhaDoEvento'
import { NOME_DO_STATUS } from '../eventos/nomes'
import { contarEventos } from './calendario'

/** Chip da situação (mapa da 2.12.12). "Publicado" não ganha chip. */
export const TOM_DO_STATUS: Readonly<Record<StatusDoEvento, TomDoChip>> = {
  rascunho: 'neutro',
  publicado: 'neutro',
  adiado: 'alerta',
  cancelado: 'erro',
  encerrado: 'neutro',
}

export function abrirEvento(id: string) {
  router.push({ pathname: '/evento/[eventoId]', params: { eventoId: id } })
}

export function abrirDia(data: DataLocal) {
  router.push({ pathname: '/agenda/[data]', params: { data } })
}

/** "sábado, 15 de novembro" (com o ano só quando não é o ano de hoje). */
export function nomeDoDia(dia: DataLocal, hoje: DataLocal): string {
  return formatarDataPorExtenso(dia, dia.slice(0, 4) !== hoje.slice(0, 4))
}

/**
 * Linha de evento da agenda (quadro 06): a hora em coluna de 44 (600,
 * `tabular-nums`), 12, o título e "90 min · Sala 2", o chip quando não está
 * publicado e o chevron. O leitor de tela ouve tudo numa frase só.
 */
export function LinhaDoEventoNaAgenda({ evento }: { evento: ResumoDoEvento }) {
  return (
    <LinhaDeLista
      hora={formatarHora(evento.inicio, evento.fuso)}
      titulo={evento.titulo}
      descricao={[formatarDuracao(evento.duracaoMin), evento.localNome].filter(Boolean).join(' · ')}
      {...(evento.status !== 'publicado'
        ? {
            extra: (
              <Chip texto={NOME_DO_STATUS[evento.status]} tom={TOM_DO_STATUS[evento.status]} />
            ),
          }
        : {})}
      rotuloAcessivel={rotuloFaladoDoEvento(evento, evento.fuso)}
      dica="Abre a programação."
      aoPressionar={() => abrirEvento(evento.id)}
    />
  )
}

/**
 * Sobrancelha de um dia, fora do cartão (24 acima, 8 abaixo). Hoje vem com
 * um ponto coral e "Hoje" escrito: a cor nunca é o único sinal.
 */
export function SobrancelhaDoDia({
  dia,
  hoje,
  quantidade,
}: {
  dia: DataLocal
  hoje: DataLocal
  quantidade: number
}) {
  const { cores } = useTema()
  const ehHoje = dia === hoje
  const texto = `${ehHoje ? 'Hoje, ' : ''}${nomeDoDia(dia, hoje)}`
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8, marginTop: ESPACO.e8 }}
    >
      {ehHoje ? (
        <View
          style={{
            width: ESPACO.e8,
            height: ESPACO.e8,
            borderRadius: RAIO.pilula,
            backgroundColor: cores.destaque,
          }}
        />
      ) : null}
      <Texto
        variante="sobrancelha"
        cor={ehHoje ? 'destaque' : 'textoSuave'}
        accessibilityLabel={`${formatarDataPorExtenso(dia)}${ehHoje ? ', hoje' : ''}, ${contarEventos(quantidade)}`}
        style={{ flex: 1 }}
      >
        {texto}
      </Texto>
    </View>
  )
}

/**
 * O dia escolhido (3.3.1, itens 5 e 6): cartão lista com as linhas de
 * evento e, no fim, o terciário "Ver a linha do tempo do dia". Sem nada
 * marcado, uma linha "Nada marcado" e, para quem cria, "Nova programação
 * neste dia", que abre a mesma folha de Programas (Sábado padrão, Em branco,
 * A partir de um modelo) com a data do dia.
 */
export function CartaoDoDia({
  dia,
  eventos,
  podeCriar,
  comLinhaDoTempo = true,
}: {
  dia: DataLocal
  eventos: readonly ResumoDoEvento[]
  podeCriar: boolean
  /** Na vista de lista (3.3.3) o cartão traz só as linhas de evento. */
  comLinhaDoTempo?: boolean
}) {
  const [folhaAberta, setFolhaAberta] = useState(false)
  if (eventos.length === 0) {
    return (
      <CartaoDeVidro
        {...(podeCriar
          ? {
              acoes: (
                <Botao
                  titulo="Nova programação neste dia"
                  icone="adicionar"
                  variante="terciario"
                  alinhado
                  rotuloAcessivel={`Nova programação em ${formatarDataPorExtenso(dia)}`}
                  aoPressionar={() => setFolhaAberta(true)}
                />
              ),
            }
          : {})}
      >
        <Texto variante="corpo" cor="textoSuave">
          Nada marcado
        </Texto>
        {podeCriar ? (
          <FolhaNovaProgramacao
            aberta={folhaAberta}
            aoFechar={() => setFolhaAberta(false)}
            data={dia}
          />
        ) : null}
      </CartaoDeVidro>
    )
  }
  return (
    <CartaoDeVidro
      lista
      {...(comLinhaDoTempo
        ? {
            acoes: (
              <Botao
                titulo="Ver a linha do tempo do dia"
                variante="terciario"
                alinhado
                rotuloAcessivel={`Ver a linha do tempo de ${formatarDataPorExtenso(dia)}`}
                aoPressionar={() => abrirDia(dia)}
              />
            ),
          }
        : {})}
    >
      <Lista>
        {eventos.map((e) => (
          <LinhaDoEventoNaAgenda key={e.id} evento={e} />
        ))}
      </Lista>
    </CartaoDeVidro>
  )
}
