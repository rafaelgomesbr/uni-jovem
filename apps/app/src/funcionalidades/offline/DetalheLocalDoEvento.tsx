import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { falarQuando, formatarDuracao, formatarHora, formatarQuando } from '@/utilidades/datas'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Linha } from '@/ui/Linha'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'

import { usePode } from '../comunidade/permissoes'
import { COR_DO_STATUS, NOME_DO_STATUS } from '../eventos/nomes'
import { podeIrAoVivo } from '../eventos/regras'
import { SecaoChecklist } from '../eventos/SecaoChecklist'
import { SecaoMateriais, SecaoTarefas } from '../eventos/SecaoTarefas'
import { MinhaInscricao } from '../inscricoes/MinhaInscricao'
import { CartaoOfflineDoEvento } from './CartaoOfflineDoEvento'
import { horaNoAparelho } from './formatos'
import { MENSAGEM_EXIGE_CONEXAO } from './mensagens'
import { useOffline } from './ProvedorOffline'
import type { PacoteGuardado } from './tipos'
import { vistaDoPacote, type ModoLocal } from './vistaLocal'

/**
 * O evento sem conexão, a partir da cópia preparada neste aparelho. Mostra o
 * que dá para fazer sem internet e deixa desabilitado, com explicação, o que
 * exige conexão (editar, escalar, mudar o status).
 */
export function DetalheLocalDoEvento({
  comunidadeId,
  guardado,
}: {
  comunidadeId: string
  guardado: PacoteGuardado
}) {
  const offline = useOffline()
  const pode = usePode()
  const { evento, pendentes } = vistaDoPacote(guardado.pacote, offline.operacoes)
  const local: ModoLocal = { eu: guardado.pacote.vinculoId, pendentes }
  const params = { eventoId: evento.id }
  const conduz = pode('ao_vivo', 'conduzir')

  return (
    <>
      <Aviso tipo="alerta" titulo="Sem conexão: cópia deste aparelho">
        {`Esta é a programação preparada (atualizada às ${horaNoAparelho(guardado.baixadoEm)}). Marcar tarefas, checklists e presença funciona e vai para o servidor quando a internet voltar. Editar, escalar e mudar o status exigem conexão.`}
      </Aviso>
      <CabecalhoLocal evento={evento} />
      <Cartao titulo="No dia" icone="aoVivo">
        <View style={{ gap: ESPACO.x2 }}>
          <Botao
            titulo={conduz ? 'Conduzir ao vivo (só neste aparelho)' : 'Ver o andamento guardado'}
            icone="aoVivo"
            variante="secundario"
            desabilitado={!podeIrAoVivo(evento.status)}
            motivo="O ao vivo fica disponível quando o evento for publicado."
            aoPressionar={() => router.push({ pathname: '/evento/[eventoId]/ao-vivo', params })}
          />
          {pode('presenca', 'registrar') && guardado.pacote.checkin ? (
            <Botao
              titulo="Check-in de presença"
              icone="qr"
              variante="secundario"
              aoPressionar={() => router.push({ pathname: '/evento/[eventoId]/checkin', params })}
            />
          ) : null}
          {pode('evento', 'editar') ? (
            <Botao
              titulo="Editar a programação"
              icone="editar"
              variante="secundario"
              desabilitado
              motivo={MENSAGEM_EXIGE_CONEXAO}
              aoPressionar={() => undefined}
            />
          ) : null}
        </View>
        <MinhaInscricao evento={evento} comunidadeId={comunidadeId} />
      </Cartao>
      <ProgramacaoLocal evento={evento} />
      <SecaoTarefas evento={evento} comunidadeId={comunidadeId} local={local} />
      <SecaoMateriais evento={evento} comunidadeId={comunidadeId} local={local} />
      <SecaoChecklist evento={evento} comunidadeId={comunidadeId} local={local} />
      <CartaoOfflineDoEvento eventoId={evento.id} titulo={evento.titulo} />
    </>
  )
}

function CabecalhoLocal({ evento }: { evento: DetalheDoEvento }) {
  return (
    <Cartao>
      <Texto variante="titulo">{evento.titulo}</Texto>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
        <Selo texto={NOME_DO_STATUS[evento.status]} cor={COR_DO_STATUS[evento.status]} />
        <Selo texto="Guardado neste aparelho" />
      </View>
      {evento.motivoStatus ? <Texto>Motivo: {evento.motivoStatus}</Texto> : null}
      <Linha
        icone="relogio"
        titulo={formatarQuando(evento.inicio, evento.fuso)}
        descricao={`Duração prevista: ${formatarDuracao(evento.duracaoMin)} · ${evento.categoria}`}
        rotuloAcessivel={`${falarQuando(evento.inicio, evento.fuso)}. Duração prevista: ${formatarDuracao(evento.duracaoMin)}. Categoria: ${evento.categoria}`}
      />
      <Linha
        icone="local"
        titulo={evento.local?.nome ?? 'Local a definir'}
        {...(evento.local
          ? {
              descricao:
                [
                  evento.local.tipo === 'interno' ? 'Local interno' : evento.local.endereco,
                  evento.local.referencia,
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined,
            }
          : {})}
      />
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

function ProgramacaoLocal({ evento }: { evento: DetalheDoEvento }) {
  const geral = evento.atribuicoes.filter((a) => a.etapaId === null)
  return (
    <Cartao titulo="Programação" icone="etapas">
      {evento.etapas.length === 0 ? (
        <Texto variante="apoio" cor="textoSuave">
          Nenhuma etapa cadastrada.
        </Texto>
      ) : (
        evento.etapas.map((e) => {
          const equipe = evento.atribuicoes
            .filter((a) => a.etapaId === e.id)
            .map((a) => `${a.nome} (${a.funcao})`)
          return (
            <Linha
              key={e.id}
              titulo={e.titulo}
              descricao={[
                `${formatarHora(e.inicioPrevisto, evento.fuso)} · ${formatarDuracao(e.duracaoMin)}`,
                equipe.length ? `Equipe: ${equipe.join(', ')}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          )
        })
      )}
      {geral.length ? (
        <View style={{ gap: ESPACO.x1 }}>
          <Texto variante="corpoForte">Equipe do evento</Texto>
          {geral.map((a) => (
            <Linha key={a.id} titulo={a.nome} descricao={a.funcao} />
          ))}
        </View>
      ) : null}
    </Cartao>
  )
}
