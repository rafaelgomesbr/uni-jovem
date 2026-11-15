import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Texto } from '@/ui/Texto'

import { usePode } from '../comunidade/permissoes'
import { LinkPublico } from '../inscricoes/LinkPublico'
import { MinhaInscricao } from '../inscricoes/MinhaInscricao'
import { podeIrAoVivo } from './regras'

interface Props {
  evento: DetalheDoEvento
  comunidadeId: string
}

/** No dia: acompanhar ao vivo, inscrições, check-in e o link público. */
export function SecaoParticipacao({ evento, comunidadeId }: Props) {
  const pode = usePode()
  const conduz = pode('ao_vivo', 'conduzir')
  const verLista = pode('inscricao', 'ler_lista')
  const registrar = pode('presenca', 'registrar')
  const params = { eventoId: evento.id }
  const aoVivo = podeIrAoVivo(evento.status)

  return (
    <>
      <Cartao titulo="Participação" icone="inscricoes">
        <View style={{ gap: ESPACO.x2 }}>
          <Botao
            titulo={conduz ? 'Conduzir ao vivo' : 'Acompanhar ao vivo'}
            icone="aoVivo"
            variante="secundario"
            desabilitado={!aoVivo}
            motivo="O ao vivo fica disponível quando o evento for publicado."
            aoPressionar={() => router.push({ pathname: '/evento/[eventoId]/ao-vivo', params })}
          />
          {verLista ? (
            <Botao
              titulo="Inscrições"
              icone="inscricoes"
              variante="secundario"
              aoPressionar={() =>
                router.push({ pathname: '/evento/[eventoId]/inscricoes', params })
              }
            />
          ) : null}
          {registrar ? (
            <Botao
              titulo="Check-in de presença"
              icone="qr"
              variante="secundario"
              aoPressionar={() => router.push({ pathname: '/evento/[eventoId]/checkin', params })}
            />
          ) : null}
        </View>
        <MinhaInscricao evento={evento} comunidadeId={comunidadeId} />
        {evento.visibilidade === 'interna' && verLista ? (
          <Texto variante="apoio" cor="textoSuave">
            Evento interno: só quem participa da comunidade se inscreve, pelo app. Para ter uma
            página aberta, mude a visibilidade para pública.
          </Texto>
        ) : null}
      </Cartao>
      {evento.visibilidade === 'publica' && evento.status === 'publicado' ? (
        <LinkPublico idPublico={evento.idPublico} titulo={evento.titulo} />
      ) : null}
    </>
  )
}
