import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { abrirLink } from '@/utilidades/compartilhar'
import { falarQuando, formatarDuracao, formatarQuando } from '@/utilidades/datas'
import { linkDoMapa } from '@/utilidades/mapas'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
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
    <Cartao>
      <Texto variante="titulo">{evento.titulo}</Texto>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
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
        rotuloAcessivel={`${falarQuando(evento.inicio, evento.fuso)}. Duração prevista: ${formatarDuracao(evento.duracaoMin)}. Categoria: ${evento.categoria}`}
      />
      {evento.local ? (
        <View style={{ gap: ESPACO.x2 }}>
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
              rotuloAcessivel={`Abrir ${evento.local.nome} no app de mapas`}
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
        <View style={{ gap: ESPACO.x1 }}>
          <Texto variante="corpoForte">Informações úteis</Texto>
          <Texto>{evento.informacoesUteis}</Texto>
        </View>
      ) : null}
    </Cartao>
  )
}
