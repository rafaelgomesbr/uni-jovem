import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { falarQuando, formatarDuracao, formatarHora, formatarQuando } from '@/utilidades/datas'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Texto } from '@/ui/Texto'

import { usePode } from '../comunidade/permissoes'
import { NOME_DO_STATUS, TOM_DO_STATUS } from '../eventos/nomes'
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
      <CabecalhoLocal evento={evento} />
      <Aviso tipo="alerta" titulo="Sem conexão: cópia deste aparelho">
        {`Esta é a programação preparada (atualizada às ${horaNoAparelho(guardado.baixadoEm)}). Marcar tarefas, checklists e presença funciona e vai para o servidor quando a internet voltar. Editar, escalar e mudar o status exigem conexão.`}
      </Aviso>
      <CartaoDeVidro sobrancelha="No dia">
        <View style={{ gap: ESPACO.e8 }}>
          <Botao
            titulo={conduz ? 'Conduzir ao vivo (só neste aparelho)' : 'Ver o andamento guardado'}
            icone="aoVivo"
            variante="secundario"
            larguraTotal
            desabilitado={!podeIrAoVivo(evento.status)}
            motivo="O ao vivo fica disponível quando o evento for publicado."
            aoPressionar={() => router.push({ pathname: '/evento/[eventoId]/ao-vivo', params })}
          />
          {pode('presenca', 'registrar') && guardado.pacote.checkin ? (
            <Botao
              titulo="Check-in de presença"
              icone="qr"
              variante="secundario"
              larguraTotal
              aoPressionar={() => router.push({ pathname: '/evento/[eventoId]/checkin', params })}
            />
          ) : null}
          {pode('evento', 'editar') ? (
            <Botao
              titulo="Editar a programação"
              icone="editar"
              variante="secundario"
              larguraTotal
              desabilitado
              motivo={MENSAGEM_EXIGE_CONEXAO}
              aoPressionar={() => undefined}
            />
          ) : null}
        </View>
        <MinhaInscricao evento={evento} comunidadeId={comunidadeId} />
      </CartaoDeVidro>
      <ProgramacaoLocal evento={evento} />
      <SecaoTarefas evento={evento} comunidadeId={comunidadeId} local={local} />
      <SecaoMateriais evento={evento} comunidadeId={comunidadeId} local={local} />
      <SecaoChecklist evento={evento} comunidadeId={comunidadeId} local={local} />
      <CartaoOfflineDoEvento eventoId={evento.id} titulo={evento.titulo} />
    </>
  )
}

/** Título da programação (a moldura sem rede não tem cabeçalho próprio), chips e quando e onde. */
function CabecalhoLocal({ evento }: { evento: DetalheDoEvento }) {
  const tom = TOM_DO_STATUS[evento.status]
  return (
    <>
      <View style={{ gap: ESPACO.e8 }}>
        <Texto variante="tituloTela">{evento.titulo}</Texto>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
          {tom ? <Chip texto={NOME_DO_STATUS[evento.status]} tom={tom} /> : null}
          <Chip texto="Neste aparelho" tom="neutro" icone="guardadoNoAparelho" />
        </View>
        {evento.motivoStatus ? (
          <Texto variante="corpo" cor="textoSuave">
            Motivo: {evento.motivoStatus}
          </Texto>
        ) : null}
      </View>
      <CartaoDeVidro lista>
        <Lista>
          <LinhaDeLista
            icone="relogio"
            titulo={formatarQuando(evento.inicio, evento.fuso)}
            descricao={`Duração prevista: ${formatarDuracao(evento.duracaoMin)} · ${evento.categoria}`}
            rotuloAcessivel={`${falarQuando(evento.inicio, evento.fuso)}. Duração prevista: ${formatarDuracao(evento.duracaoMin)}. Categoria: ${evento.categoria}`}
          />
          <LinhaDeLista
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
        </Lista>
      </CartaoDeVidro>
      {evento.descricao ? (
        <CartaoDeVidro>
          <Texto variante="leitura">{evento.descricao}</Texto>
        </CartaoDeVidro>
      ) : null}
      {evento.informacoesUteis ? (
        <CartaoDeVidro sobrancelha="Informações úteis">
          <Texto variante="leitura">{evento.informacoesUteis}</Texto>
        </CartaoDeVidro>
      ) : null}
    </>
  )
}

function ProgramacaoLocal({ evento }: { evento: DetalheDoEvento }) {
  const geral = evento.atribuicoes.filter((a) => a.etapaId === null)
  return (
    <>
      <Secao titulo="Programação">
        {evento.etapas.length === 0 ? (
          <Texto variante="corpo" cor="textoSuave">
            Nenhuma etapa cadastrada.
          </Texto>
        ) : (
          <CartaoDeVidro lista>
            <Lista>
              {evento.etapas.map((e) => {
                const equipe = evento.atribuicoes
                  .filter((a) => a.etapaId === e.id)
                  .map((a) => `${a.nome} (${a.funcao})`)
                return (
                  <LinhaDeLista
                    key={e.id}
                    titulo={e.titulo}
                    valor={formatarHora(e.inicioPrevisto, evento.fuso)}
                    descricao={[
                      formatarDuracao(e.duracaoMin),
                      equipe.length ? `Equipe: ${equipe.join(', ')}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                )
              })}
            </Lista>
          </CartaoDeVidro>
        )}
      </Secao>
      {geral.length ? (
        <Secao titulo="Equipe do evento">
          <CartaoDeVidro lista>
            <Lista>
              {geral.map((a) => (
                <LinhaDeLista
                  key={a.id}
                  avatar={{ nome: a.nome }}
                  titulo={a.nome}
                  descricao={a.funcao}
                />
              ))}
            </Lista>
          </CartaoDeVidro>
        </Secao>
      ) : null}
    </>
  )
}
