import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { abrirLink } from '@/utilidades/compartilhar'
import { falarQuando, formatarDuracao, formatarQuando } from '@/utilidades/datas'
import { linkDoMapa } from '@/utilidades/mapas'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { CartaoDestaque } from '@/ui/Cartao'
import { Chip } from '@/ui/Chip'
import { Linha } from '@/ui/Linha'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'

import { COR_DO_STATUS, NOME_DA_VISIBILIDADE, NOME_DO_STATUS } from './nomes'

/** Quem, quando, onde: o essencial do evento, igual para todos os papéis. */
export function CabecalhoDoEvento({ evento }: { evento: DetalheDoEvento }) {
  const mapa = evento.local ? linkDoMapa(evento.local) : null
  const vagas = [
    evento.capacidade ? `${evento.capacidade} vagas` : 'Sem limite de vagas',
    evento.capacidade && evento.listaDeEspera ? 'com lista de espera' : null,
    evento.inscricaoAte
      ? `inscrições até ${formatarQuando(evento.inscricaoAte, evento.fuso)}`
      : null,
  ].filter(Boolean)

  return (
    // O item principal da tela: cartão de destaque (claro no tema escuro), como no Início.
    <CartaoDestaque>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: ESPACO.e8,
        }}
      >
        <Texto variante="tituloItem" cor="textoSuave" tabular style={{ fontSize: 13 }}>
          {formatarQuando(evento.inicio, evento.fuso)} · {formatarDuracao(evento.duracaoMin)}
        </Texto>
        <Chip texto={evento.categoria} />
      </View>
      <Texto variante="tituloTela" style={{ fontSize: 24, lineHeight: 28 }}>
        {evento.titulo}
      </Texto>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
        <Selo texto={NOME_DO_STATUS[evento.status]} cor={COR_DO_STATUS[evento.status]} />
        <Selo texto={`Visibilidade: ${NOME_DA_VISIBILIDADE[evento.visibilidade]}`} />
        {evento.serieId ? <Selo texto="Faz parte de uma série" /> : null}
      </View>
      {evento.status === 'cancelado' || evento.status === 'adiado' ? (
        <Aviso
          tipo="alerta"
          titulo={evento.status === 'cancelado' ? 'Evento cancelado' : 'Evento adiado'}
        >
          {evento.motivoStatus ? `Motivo: ${evento.motivoStatus}` : 'Sem motivo informado.'}
        </Aviso>
      ) : null}
      <Linha
        icone="relogio"
        titulo={formatarQuando(evento.inicio, evento.fuso)}
        descricao={`Duração prevista: ${formatarDuracao(evento.duracaoMin)} · ${evento.categoria}`}
        rotuloAcessivel={`${formatarQuando(evento.inicio, evento.fuso)} (${falarQuando(evento.inicio, evento.fuso)}). Duração prevista: ${formatarDuracao(evento.duracaoMin)}. Categoria: ${evento.categoria}`}
      />
      {evento.local ? (
        <View style={{ gap: ESPACO.e8 }}>
          <Linha
            icone="local"
            titulo={evento.local.nome}
            descricao={
              [
                evento.local.tipo === 'interno' ? 'Local interno' : evento.local.endereco,
                evento.local.referencia,
              ]
                .filter(Boolean)
                .join(' · ') || undefined
            }
          />
          {mapa ? (
            <Botao
              titulo="Abrir no app de mapas"
              icone="mapa"
              variante="secundario"
              larguraTotal={false}
              rotuloAcessivel={`Abrir no app de mapas: ${evento.local.nome}`}
              aoPressionar={() => void abrirLink(mapa)}
            />
          ) : null}
        </View>
      ) : (
        <Linha icone="local" titulo="Local a definir" />
      )}
      <Linha icone="inscricoes" titulo="Inscrições" descricao={vagas.join(' · ')} />
      {evento.descricao ? <Texto>{evento.descricao}</Texto> : null}
      {evento.informacoesUteis ? (
        <View style={{ gap: ESPACO.e4 }}>
          <Texto variante="tituloItem">Informações úteis</Texto>
          <Texto>{evento.informacoesUteis}</Texto>
        </View>
      ) : null}
    </CartaoDestaque>
  )
}
