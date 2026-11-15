import { useMutation } from '@tanstack/react-query'
import { ALTURA, ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useRef, useState, type ComponentRef } from 'react'
import { type TextInput, View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ListaDeCheckin, Presenca } from '@/servicos/contratoDosEventos'
import { SemConexao } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { Campo, CampoDeBusca } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha } from '@/ui/Falha'
import { MenuDeAcoes } from '@/ui/FolhaNaTela'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { useAnunciar } from '@/ui/useAnunciar'
import { parametro } from '@/utilidades/parametros'

import { usePode } from '../comunidade/permissoes'
import { useEvento } from '../eventos/consultas'
import { SemComunidade } from '../navegacao/SemComunidade'
import { horaNoAparelho } from '../offline/formatos'
import { MENSAGEM_SEM_PREPARO } from '../offline/mensagens'
import { useOffline, usePacoteDoEvento } from '../offline/ProvedorOffline'
import { listaDeCheckinLocal } from '../offline/vistaLocal'
import {
  useDesfazerPresenca,
  useListaDeCheckin,
  useMarcarPresenca,
  usePresencas,
  type AlvoDaPresenca,
  type PedidoDePresenca,
} from './consultas'
import { codigoDeEntradaValido } from './nomes'

export interface PessoaDoCheckin {
  chave: string
  nome: string
  detalhe: string
  presente: boolean
  alvo: AlvoDaPresenca
  inscricaoId: string | null
  vinculoId: string | null
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Inscritos e membros sem inscrição numa lista só, sem repetir quem é as duas coisas. */
export function montarListaDeCheckin(lista: ListaDeCheckin): PessoaDoCheckin[] {
  const inscritos: PessoaDoCheckin[] = lista.inscritos.map((i) => ({
    chave: `i-${i.inscricaoId}`,
    nome: i.nome,
    detalhe: [i.estado === 'espera' ? 'Lista de espera' : 'Inscrição confirmada', i.telefone]
      .filter(Boolean)
      .join(' · '),
    presente: i.presente,
    alvo: { inscricaoId: i.inscricaoId },
    inscricaoId: i.inscricaoId,
    vinculoId: i.vinculoId,
  }))
  const jaInscritos = new Set(lista.inscritos.map((i) => i.vinculoId).filter(Boolean))
  const membros: PessoaDoCheckin[] = lista.membros
    .filter((m) => !jaInscritos.has(m.vinculoId))
    .map((m) => ({
      chave: `m-${m.vinculoId}`,
      nome: m.nome,
      detalhe: 'Membro sem inscrição',
      presente: m.presente,
      alvo: { vinculoId: m.vinculoId },
      inscricaoId: null,
      vinculoId: m.vinculoId,
    }))
  return [...inscritos, ...membros].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function filtrarPorNome(pessoas: readonly PessoaDoCheckin[], busca: string) {
  const termo = semAcento(busca.trim())
  return termo ? pessoas.filter((p) => semAcento(p.nome).includes(termo)) : [...pessoas]
}

export function presencaDe(pessoa: PessoaDoCheckin, presencas: readonly Presenca[]) {
  return (
    presencas.find(
      (p) =>
        (pessoa.inscricaoId !== null && p.inscricaoId === pessoa.inscricaoId) ||
        (pessoa.vinculoId !== null && p.vinculoId === pessoa.vinculoId),
    ) ?? null
  )
}

const MAXIMO_SEM_BUSCA = 40

/**
 * Rota `/evento/[eventoId]/checkin`. O caminho principal não depende de
 * câmera: buscar o nome e tocar em "Marcar". O QR é um atalho.
 */
export function TelaCheckin() {
  const { comunidadeAtiva } = useSessao()
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
  const pode = usePode()
  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela pilha titulo="Check-in">
        <SemComunidade oQue="o check-in" />
      </Tela>
    )
  }
  if (!pode('presenca', 'registrar')) {
    return (
      <Tela pilha titulo="Check-in">
        <Aviso tipo="info" titulo="Só a organização registra presença">
          Na entrada, mostre o seu código para quem está fazendo o check-in.
        </Aviso>
      </Tela>
    )
  }
  return <Checkin comunidadeId={comunidadeAtiva.id} eventoId={eventoId} />
}

/**
 * Check-in (3.5.2): o contador, a busca com o "Ler QR" ao lado, o cartão
 * lista de pessoas ("Marcar" ou o chip "Presente") e os cartões "PELO
 * CÓDIGO" e "CHEGOU SEM INSCRIÇÃO", cada um com campo e botão de 48 na mesma
 * linha. Confirmações em toast, com "Desfazer"; sem conexão, a presença fica
 * anotada no aparelho e a confirmação aparece na tela.
 */
function Checkin({ comunidadeId, eventoId }: { comunidadeId: string; eventoId: string }) {
  const evento = useEvento(comunidadeId, eventoId)
  const lista = useListaDeCheckin(comunidadeId, eventoId)
  const presencas = usePresencas(comunidadeId, eventoId)
  const marcar = useMarcarPresenca(comunidadeId, eventoId)
  const desfazer = useDesfazerPresenca(comunidadeId, eventoId)
  const [busca, setBusca] = useState('')
  const [codigo, setCodigo] = useState('')
  const [avulso, setAvulso] = useState('')
  const [erroDoCodigo, setErroDoCodigo] = useState<string | null>(null)
  const [erroDoAvulso, setErroDoAvulso] = useState<string | null>(null)
  const [anotada, setAnotada] = useState<string | null>(null)
  const [escolhida, setEscolhida] = useState<PessoaDoCheckin | null>(null)
  const campoDoAvulso = useRef<ComponentRef<typeof TextInput>>(null)
  const offline = useOffline()
  const guardado = usePacoteDoEvento(eventoId).data ?? null
  const listaLocal = guardado ? listaDeCheckinLocal(guardado.pacote, offline.operacoes) : null
  const pausada = lista.isPending && lista.fetchStatus === 'paused'
  const semRede = !offline.online || pausada || lista.error instanceof SemConexao
  // Sem conexão e com o evento preparado: a lista do aparelho; a presença entra na fila.
  const usarLocal = semRede && listaLocal !== null
  const marcarLocal = useMarcarPresencaNoAparelho(eventoId, guardado?.pacote.vinculoId ?? null)

  // Quem foi marcado neste aparelho e ainda não chegou ao servidor.
  const naFila = new Set(
    offline.operacoes
      .filter(
        (o) =>
          o.tipo === 'presenca.registrar' && o.eventoId === eventoId && o.estado === 'pendente',
      )
      .flatMap((o) => {
        const d = o.dados as Partial<Record<'inscricaoId' | 'vinculoId', string>>
        return [d.inscricaoId, d.vinculoId].filter((v): v is string => !!v)
      }),
  )

  function desfazerPresenca(presencaId: string, nome: string) {
    desfazer.mutate(
      { presencaId, nome },
      { onSuccess: () => mostrarToast({ texto: `Presença de ${nome} desfeita.`, tipo: 'info' }) },
    )
  }

  function registrar(alvo: AlvoDaPresenca, nome: string) {
    setAnotada(null)
    if (usarLocal) {
      // Sem conexão a confirmação fica na tela: ela explica quando a presença vai.
      marcarLocal.mutate(
        { alvo, origem: 'manual', nome },
        {
          onSuccess: (r) =>
            setAnotada(
              r.situacao === 'repetida'
                ? `${nome} já estava anotado neste aparelho.`
                : `Presença de ${nome} anotada neste aparelho. Vai para o servidor quando a internet voltar.`,
            ),
        },
      )
      return
    }
    marcar.mutate(
      { alvo, origem: 'manual', nome },
      {
        onSuccess: (r) =>
          mostrarToast(
            r.jaRegistrada
              ? { texto: `${nome} já estava com presença.`, tipo: 'info' }
              : {
                  texto: `Presença de ${nome} registrada.`,
                  acao: { titulo: 'Desfazer', aoPressionar: () => desfazerPresenca(r.id, nome) },
                },
          ),
      },
    )
  }

  const dadosDaLista = usarLocal ? listaLocal : lista.data
  const pessoas = dadosDaLista ? montarListaDeCheckin(dadosDaLista) : []
  const filtradas = filtrarPorNome(pessoas, busca)
  const visiveis = busca.trim() ? filtradas : filtradas.slice(0, MAXIMO_SEM_BUSCA)
  const presentes = usarLocal
    ? pessoas.filter((p) => p.presente).length
    : (presencas.data?.total ?? pessoas.filter((p) => p.presente).length)
  const inscritos = dadosDaLista?.inscritos.length ?? 0
  const erro = marcar.error ?? desfazer.error ?? marcarLocal.error
  const frase = inscritos
    ? `${presentes === 1 ? 'presente' : 'presentes'} de ${inscritos} ${inscritos === 1 ? 'inscrito' : 'inscritos'}`
    : presentes === 1
      ? 'presente'
      : 'presentes'
  // O número muda a cada marcação: o leitor de tela ouve a contagem nova.
  useAnunciar(`${presentes} ${frase}`, { soMudancas: true })

  function marcarPeloCodigo() {
    const valido = codigoDeEntradaValido(codigo)
    if (!valido) {
      setErroDoCodigo('O código tem 10 letras (A a F) e números.')
      return
    }
    setErroDoCodigo(null)
    const dono = dadosDaLista?.inscritos.find((i) => i.codigo === valido)
    registrar({ codigo: valido }, dono?.nome ?? 'quem tem este código')
    setCodigo('')
  }

  function registrarAvulso() {
    if (!avulso.trim()) {
      setErroDoAvulso('Escreva o nome de quem chegou.')
      return
    }
    setErroDoAvulso(null)
    registrar({ nomeAvulso: avulso.trim() }, avulso.trim())
    setAvulso('')
  }

  const presencaEscolhida =
    escolhida && !usarLocal ? presencaDe(escolhida, presencas.data?.presencas ?? []) : null

  return (
    <Tela pilha titulo="Check-in" {...(evento.data ? { descricao: evento.data.titulo } : {})}>
      <View
        accessible
        accessibilityLabel={`${presentes} ${frase}`}
        style={{ flexDirection: 'row', alignItems: 'baseline', gap: ESPACO.e8 }}
      >
        <Texto variante="numero" accessibilityRole="text">
          {String(presentes)}
        </Texto>
        <Texto variante="corpo" cor="textoSuave" style={{ flexShrink: 1 }}>
          {frase}
        </Texto>
      </View>

      {usarLocal && listaLocal ? (
        <Aviso tipo="alerta" titulo="Sem conexão: lista deste aparelho">
          {`Lista preparada às ${horaNoAparelho(listaLocal.geradoEm)}. As presenças ficam anotadas aqui e vão para o servidor quando a internet voltar, sem duplicar. Desfazer uma presença exige conexão.`}
        </Aviso>
      ) : null}
      {anotada ? (
        <Aviso tipo="sucesso" anunciar>
          {anotada}
        </Aviso>
      ) : null}
      {erro ? <AvisoDeFalha erro={erro} titulo="A presença não mudou" /> : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e12 }}>
        <View style={{ flex: 1 }}>
          <CampoDeBusca rotulo="Buscar pelo nome" valor={busca} aoMudar={setBusca} />
        </View>
        <BotaoIcone
          icone="qr"
          rotulo="Ler QR"
          dica="Abre a câmera para ler o QR de entrada."
          lado={ALTURA.controle}
          aoPressionar={() =>
            router.push({ pathname: '/evento/[eventoId]/ler-qr', params: { eventoId } })
          }
        />
      </View>

      {usarLocal ? null : semRede && !lista.data ? (
        <Aviso tipo="alerta" titulo="Sem conexão">
          {MENSAGEM_SEM_PREPARO}
        </Aviso>
      ) : lista.isPending ? (
        <Esqueleto rotulo="Carregando a lista de entrada">
          <CartaoDeEsqueleto />
          <CartaoDeEsqueleto />
        </Esqueleto>
      ) : lista.error ? (
        <AvisoDeFalha
          erro={lista.error}
          titulo="A lista de entrada não abriu"
          aoTentarDeNovo={() => void lista.refetch()}
        />
      ) : null}
      {(usarLocal || lista.data) && visiveis.length === 0 ? (
        <EstadoVazio
          icone="buscar"
          titulo={pessoas.length ? 'Ninguém com esse nome' : 'Lista vazia'}
          descricao={
            pessoas.length
              ? 'Confira a grafia ou registre abaixo quem chegou sem inscrição.'
              : 'Ninguém inscrito e nenhum membro ativo. Registre abaixo quem chegou.'
          }
          acao={
            pessoas.length
              ? {
                  titulo: 'Limpar a busca',
                  variante: 'secundario',
                  aoPressionar: () => setBusca(''),
                }
              : {
                  titulo: 'Registrar quem chegou',
                  variante: 'secundario',
                  aoPressionar: () => campoDoAvulso.current?.focus(),
                }
          }
        />
      ) : (usarLocal || lista.data) && visiveis.length > 0 ? (
        <>
          {!busca.trim() && filtradas.length > MAXIMO_SEM_BUSCA ? (
            <Texto variante="legenda" cor="textoSuave">
              {`Mostrando ${MAXIMO_SEM_BUSCA} de ${filtradas.length}. Busque pelo nome para achar as demais.`}
            </Texto>
          ) : null}
          <CartaoDeVidro lista>
            <Lista>
              {visiveis.map((p) => {
                const local =
                  usarLocal &&
                  p.presente &&
                  ((p.inscricaoId !== null && naFila.has(p.inscricaoId)) ||
                    (p.vinculoId !== null && naFila.has(p.vinculoId)))
                return (
                  <LinhaDeLista
                    key={p.chave}
                    avatar={{ nome: p.nome }}
                    titulo={p.nome}
                    descricao={p.detalhe}
                    {...(p.presente
                      ? {
                          extra: (
                            <View style={{ alignItems: 'flex-end', gap: ESPACO.e4 }}>
                              <Chip texto="Presente" tom="sucesso" icone="check" />
                              {local ? <Chip texto="Neste aparelho" tom="alerta" /> : null}
                            </View>
                          ),
                          semSeta: true,
                          rotuloAcessivel: `${p.nome}. ${p.detalhe}. Presente${local ? ', anotada neste aparelho' : ''}. Abrir opções`,
                          aoPressionar: () => setEscolhida(p),
                        }
                      : {
                          extra: (
                            <Botao
                              titulo="Marcar"
                              variante="secundario"
                              rotuloAcessivel={`Marcar presença: ${p.nome}`}
                              carregando={
                                (marcar.isPending && marcar.variables?.nome === p.nome) ||
                                (marcarLocal.isPending && marcarLocal.variables?.nome === p.nome)
                              }
                              aoPressionar={() => registrar(p.alvo, p.nome)}
                            />
                          ),
                        })}
                  />
                )
              })}
            </Lista>
          </CartaoDeVidro>
        </>
      ) : null}

      <CartaoDeVidro sobrancelha="Pelo código" opaco>
        <Campo
          rotulo="Código de entrada"
          value={codigo}
          onChangeText={setCodigo}
          erro={erroDoCodigo}
          ajuda="10 letras e números, como aparece abaixo do QR."
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          onSubmitEditing={marcarPeloCodigo}
          botao={
            <Botao
              titulo="Marcar"
              tamanho="grande"
              rotuloAcessivel="Marcar presença pelo código"
              carregando={marcar.isPending && 'codigo' in (marcar.variables?.alvo ?? {})}
              aoPressionar={marcarPeloCodigo}
            />
          }
        />
      </CartaoDeVidro>

      <CartaoDeVidro sobrancelha="Chegou sem inscrição" opaco>
        <Campo
          ref={campoDoAvulso}
          rotulo="Nome"
          rotuloAcessivel="Nome de quem chegou"
          value={avulso}
          onChangeText={setAvulso}
          erro={erroDoAvulso}
          ajuda="Para visitantes sem inscrição e sem conta: só o nome."
          autoCapitalize="words"
          maxLength={120}
          onSubmitEditing={registrarAvulso}
          botao={
            <Botao
              titulo="Registrar"
              tamanho="grande"
              rotuloAcessivel="Registrar presença sem inscrição"
              aoPressionar={registrarAvulso}
            />
          }
        />
      </CartaoDeVidro>

      <MenuDeAcoes
        aberto={escolhida !== null}
        titulo={escolhida?.nome ?? 'Presença'}
        aoFechar={() => setEscolhida(null)}
        acoes={
          escolhida
            ? [
                {
                  titulo: 'Desfazer presença',
                  icone: 'cancelar',
                  destrutiva: true,
                  motivo: usarLocal
                    ? 'Desfazer presença exige conexão com a internet.'
                    : presencaEscolhida
                      ? null
                      : 'O registro de presença ainda está carregando.',
                  aoPressionar: () => {
                    if (presencaEscolhida) desfazerPresenca(presencaEscolhida.id, escolhida.nome)
                  },
                },
              ]
            : []
        }
      />
    </Tela>
  )
}

/**
 * Presença sem conexão: entra na fila deste aparelho com chave própria. A
 * mesma pessoa marcada de novo não vira outra operação (e o servidor também une).
 */
export function useMarcarPresencaNoAparelho(eventoId: string, vinculoId: string | null) {
  const offline = useOffline()
  return useMutation({
    mutationFn: ({ alvo, nome }: PedidoDePresenca) =>
      offline.registrar(
        {
          tipo: 'presenca.registrar',
          dados: { eventoId, ocorridaEm: new Date().toISOString(), ...alvo },
          eventoId,
          descricao: `Presença de ${nome}`,
          contexto: { nome },
        },
        { vinculoId },
      ),
    networkMode: 'always',
  })
}
