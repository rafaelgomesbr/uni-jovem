import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { DetalheDoEvento, MinhaInscricao as Inscricao } from '@/servicos/contratoDosEventos'
import { SemConexao } from '@/servicos/erros'
import { confirmar } from '@/utilidades/confirmar'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CodigoQR } from '@/ui/CodigoQR'
import { useFocoAoMudar } from '@/ui/foco'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'
import { soNaWeb } from '@/ui/web'

import { useMeuVinculo } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { naComunidade, useInvalidarEventos } from '../eventos/consultas'
import { useOffline, usePacoteDoEvento } from '../offline/ProvedorOffline'
import { EXPLICACAO_SEM_INSCRICAO, motivoSemInscricao } from '../eventos/regras'
import { COR_DO_ESTADO_DA_INSCRICAO, formatarCodigo, NOME_DO_ESTADO_DA_INSCRICAO } from './nomes'

interface Props {
  evento: DetalheDoEvento
  comunidadeId: string
}

/**
 * Inscrição da própria pessoa. A API não tem leitura de "minha inscrição":
 * inscrever é idempotente (devolve a que já existe), então o mesmo botão
 * serve para se inscrever e para ver o código de entrada de novo.
 */
export function MinhaInscricao({ evento, comunidadeId }: Props) {
  const pode = usePode()
  const consultas = useQueryClient()
  const invalidar = useInvalidarEventos(comunidadeId)
  const chave = CHAVES.minhaInscricao(comunidadeId, evento.id)
  // Só lê o que veio da última resposta; quem preenche é a mutação.
  const minha = useQuery<Inscricao | null>({
    queryKey: chave,
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
  }).data

  const offline = useOffline()
  const euOnline = useMeuVinculo()
  const vinculoDoPacote = usePacoteDoEvento(evento.id).data?.pacote.vinculoId ?? null
  // Intenção registrada sem internet: "pendente, vaga não garantida" até o servidor confirmar.
  const intencao =
    offline.operacoes.find((o) => o.tipo === 'inscricao.intencao' && o.eventoId === evento.id) ??
    null

  async function guardarIntencao(): Promise<null> {
    await offline.registrar(
      {
        tipo: 'inscricao.intencao',
        dados: { eventoId: evento.id },
        eventoId: evento.id,
        descricao: `Inscrição em "${evento.titulo}"`,
      },
      { vinculoId: euOnline ?? vinculoDoPacote },
    )
    return null
  }

  const inscrever = useMutation({
    mutationFn: async (): Promise<Inscricao | null> => {
      if (!offline.online && offline.disponivel) return guardarIntencao()
      try {
        return await api.post<Inscricao>(
          `${naComunidade(comunidadeId)}/eventos/${evento.id}/inscricoes/eu`,
        )
      } catch (erro) {
        if (erro instanceof SemConexao && offline.disponivel) return guardarIntencao()
        throw erro
      }
    },
    // Sem rede ela ainda roda: guarda a intenção neste aparelho.
    networkMode: 'always',
    onSuccess: (r) => {
      if (r) consultas.setQueryData(chave, r)
      // O Início lista as próprias inscrições (`GET /inscricoes/eu`).
      void consultas.invalidateQueries({ queryKey: CHAVES.minhasInscricoes(comunidadeId) })
    },
  })
  const cancelar = useMutation({
    mutationFn: (id: string) => api.post(`${naComunidade(comunidadeId)}/inscricoes/${id}/cancelar`),
    onSuccess: async () => {
      consultas.setQueryData(chave, null)
      void consultas.invalidateQueries({ queryKey: CHAVES.minhasInscricoes(comunidadeId) })
      await invalidar(evento.id)
    },
  })

  const motivo = motivoSemInscricao(evento)
  const ativa = minha && minha.estado !== 'cancelada' ? minha : null
  // Inscrever e cancelar trocam o bloco (o botão tocado some): o foco vai para o bloco novo.
  const { alvo: focoRef, pedirFoco } = useFocoAoMudar(
    ativa ? 'ativa' : intencao?.estado === 'pendente' ? 'pendente' : 'livre',
  )

  if (!pode('inscricao', 'inscrever_se', { proprio: true })) return null

  async function pedirCancelamento(id: string) {
    const ok = await confirmar({
      titulo: 'Cancelar sua inscrição?',
      mensagem:
        'Sua vaga fica livre para outra pessoa. Você pode se inscrever de novo enquanto houver vaga.',
      confirmar: 'Cancelar inscrição',
      destrutivo: true,
    })
    if (!ok) return
    pedirFoco()
    cancelar.mutate(id)
  }

  if (ativa) {
    return (
      <View style={{ gap: ESPACO.e12 }}>
        <View ref={focoRef} accessible {...soNaWeb({ tabIndex: -1 })}>
          <Selo
            texto={`Sua inscrição: ${NOME_DO_ESTADO_DA_INSCRICAO[ativa.estado]}`}
            cor={COR_DO_ESTADO_DA_INSCRICAO[ativa.estado]}
          />
        </View>
        {ativa.estado === 'espera' ? (
          <Texto variante="corpo">
            Você está na lista de espera. Se abrir uma vaga, sua inscrição é confirmada sozinha.
          </Texto>
        ) : null}
        <Texto variante="legenda" cor="textoSuave">
          Na entrada, mostre o QR ou diga o código.
        </Texto>
        <CodigoQR
          valor={ativa.codigoCheckin}
          rotulo={`QR do seu código de entrada, ${ativa.codigoCheckin.split('').join(' ')}`}
        />
        <Texto variante="tituloItem" centralizado selectable accessibilityRole="text">
          {formatarCodigo(ativa.codigoCheckin)}
        </Texto>
        {cancelar.error ? <AvisoDeErro erro={cancelar.error} /> : null}
        <Botao
          titulo="Cancelar minha inscrição"
          variante="destrutivo"
          carregando={cancelar.isPending}
          aoPressionar={() => void pedirCancelamento(ativa.inscricaoId)}
        />
      </View>
    )
  }

  if (intencao?.estado === 'pendente') {
    return (
      <View style={{ gap: ESPACO.e8 }}>
        <View ref={focoRef} accessible {...soNaWeb({ tabIndex: -1 })}>
          <Selo texto="Pendente: vaga não garantida" cor="alerta" />
        </View>
        <Texto variante="corpo">
          Sua inscrição foi anotada neste aparelho, sem internet. A vaga só fica garantida quando o
          servidor confirmar, assim que a conexão voltar.
        </Texto>
      </View>
    )
  }

  return (
    <View style={{ gap: ESPACO.e8 }}>
      {intencao ? (
        <Aviso tipo="alerta" titulo="A inscrição feita sem internet não entrou">
          {`${intencao.mensagem ?? 'O servidor não confirmou a vaga.'} Veja em Pendências.`}
        </Aviso>
      ) : null}
      {inscrever.error ? <AvisoDeErro erro={inscrever.error} /> : null}
      {!offline.online && offline.disponivel && motivo === null ? (
        <Texto variante="corpo">
          Sem internet: a inscrição fica anotada neste aparelho e a vaga só é garantida quando o
          servidor confirmar.
        </Texto>
      ) : null}
      <Botao
        ref={focoRef}
        titulo="Inscrever-me"
        icone="inscricoes"
        carregando={inscrever.isPending}
        desabilitado={motivo !== null}
        {...(motivo ? { motivo: EXPLICACAO_SEM_INSCRICAO[motivo] } : {})}
        dica="Se você já se inscreveu, mostra a sua inscrição sem duplicar."
        aoPressionar={() => {
          pedirFoco()
          inscrever.mutate()
        }}
      />
    </View>
  )
}
