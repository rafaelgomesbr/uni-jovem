import { useMutation } from '@tanstack/react-query'
import { ESPACO, RAIO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ListaDeCheckin, Presenca } from '@/servicos/contratoDosEventos'
import { SemConexao } from '@/servicos/erros'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Selo } from '@/ui/Selo'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { usePode } from '../comunidade/permissoes'
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
 * câmera: buscar o nome e tocar em "Marcar presença". O QR é um atalho.
 */
export function TelaCheckin() {
  const { comunidadeAtiva } = useSessao()
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
  const pode = usePode()
  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela cabecalhoNativo>
        <SemComunidade oQue="o check-in" />
      </Tela>
    )
  }
  if (!pode('presenca', 'registrar')) {
    return (
      <Tela cabecalhoNativo titulo="Check-in">
        <Aviso tipo="info" titulo="Só a organização registra presença">
          Na entrada, mostre o seu código para quem está fazendo o check-in.
        </Aviso>
      </Tela>
    )
  }
  return <Checkin comunidadeId={comunidadeAtiva.id} eventoId={eventoId} />
}

function Checkin({ comunidadeId, eventoId }: { comunidadeId: string; eventoId: string }) {
  const { cores } = useTema()
  const lista = useListaDeCheckin(comunidadeId, eventoId)
  const presencas = usePresencas(comunidadeId, eventoId)
  const marcar = useMarcarPresenca(comunidadeId, eventoId)
  const desfazer = useDesfazerPresenca(comunidadeId, eventoId)
  const [busca, setBusca] = useState('')
  const [codigo, setCodigo] = useState('')
  const [avulso, setAvulso] = useState('')
  const [erroDoCodigo, setErroDoCodigo] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const offline = useOffline()
  const guardado = usePacoteDoEvento(eventoId).data ?? null
  const listaLocal = guardado ? listaDeCheckinLocal(guardado.pacote, offline.operacoes) : null
  const pausada = lista.isPending && lista.fetchStatus === 'paused'
  const semRede = !offline.online || pausada || lista.error instanceof SemConexao
  // Sem conexão e com o evento preparado: a lista do aparelho; a presença entra na fila.
  const usarLocal = semRede && listaLocal !== null
  const marcarLocal = useMarcarPresencaNoAparelho(eventoId, guardado?.pacote.vinculoId ?? null)

  function registrar(alvo: AlvoDaPresenca, nome: string) {
    setAviso(null)
    if (usarLocal) {
      marcarLocal.mutate(
        { alvo, origem: 'manual', nome },
        {
          onSuccess: (r) =>
            setAviso(
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
          setAviso(
            r.jaRegistrada ? `${nome} já estava com presença.` : `Presença de ${nome} registrada.`,
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
  const erro = marcar.error ?? desfazer.error ?? marcarLocal.error

  return (
    <Tela cabecalhoNativo titulo="Check-in">
      <Texto accessibilityLiveRegion="polite" variante="corpoForte">
        {presentes === 1 ? '1 presença registrada' : `${presentes} presenças registradas`}
      </Texto>
      {aviso ? (
        <Aviso tipo="sucesso" anunciar>
          {aviso}
        </Aviso>
      ) : null}
      {erro ? <AvisoDeErro erro={erro} /> : null}
      {usarLocal && listaLocal ? (
        <Aviso tipo="alerta" titulo="Sem conexão: lista deste aparelho">
          {`Lista preparada às ${horaNoAparelho(listaLocal.geradoEm)}. As presenças ficam anotadas aqui e vão para o servidor quando a internet voltar, sem duplicar. Desfazer uma presença exige conexão.`}
        </Aviso>
      ) : null}

      <Cartao titulo="Pela câmera" icone="qr">
        <Botao
          titulo="Ler QR com a câmera"
          icone="qr"
          aoPressionar={() =>
            router.push({ pathname: '/evento/[eventoId]/ler-qr', params: { eventoId } })
          }
        />
        <Campo
          rotulo="Ou digite o código de entrada"
          value={codigo}
          onChangeText={setCodigo}
          erro={erroDoCodigo}
          ajuda="10 letras e números, como aparece abaixo do QR."
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
        />
        <Botao
          titulo="Marcar presença pelo código"
          variante="secundario"
          carregando={marcar.isPending && 'codigo' in (marcar.variables?.alvo ?? {})}
          aoPressionar={() => {
            const valido = codigoDeEntradaValido(codigo)
            if (!valido) {
              setErroDoCodigo('O código tem 10 letras (A a F) e números.')
              return
            }
            setErroDoCodigo(null)
            const dono = dadosDaLista?.inscritos.find((i) => i.codigo === valido)
            registrar({ codigo: valido }, dono?.nome ?? 'quem tem este código')
            setCodigo('')
          }}
        />
      </Cartao>

      <Cartao titulo="Pela lista" icone="buscar">
        <Campo
          rotulo="Buscar pelo nome"
          value={busca}
          onChangeText={setBusca}
          exemplo="Digite parte do nome"
          autoCorrect={false}
        />
        {usarLocal ? null : semRede && !lista.data ? (
          <Aviso tipo="alerta" titulo="Sem conexão">
            {MENSAGEM_SEM_PREPARO}
          </Aviso>
        ) : lista.isPending ? (
          <Carregando texto="Carregando a lista de entrada" />
        ) : lista.error ? (
          <AvisoDeErro erro={lista.error} aoTentarDeNovo={() => void lista.refetch()} />
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
          />
        ) : (usarLocal || lista.data) && visiveis.length > 0 ? (
          <View style={{ gap: ESPACO.x2 }}>
            {!busca.trim() && filtradas.length > MAXIMO_SEM_BUSCA ? (
              <Texto variante="apoio" cor="textoSuave">
                Mostrando {MAXIMO_SEM_BUSCA} de {filtradas.length}. Busque pelo nome para achar as
                demais.
              </Texto>
            ) : null}
            {visiveis.map((p) => {
              const presenca = p.presente ? presencaDe(p, presencas.data?.presencas ?? []) : null
              return (
                <View
                  key={p.chave}
                  style={{
                    gap: ESPACO.x2,
                    padding: ESPACO.x3,
                    borderRadius: RAIO.medio,
                    borderWidth: p.presente ? 2 : 1,
                    borderColor: p.presente ? cores.sucesso : cores.borda,
                  }}
                >
                  <View style={{ gap: 2 }}>
                    <Texto variante="corpoForte">{p.nome}</Texto>
                    <Texto variante="apoio" cor="textoSuave">
                      {p.detalhe}
                    </Texto>
                    {p.presente ? <Selo texto="Presente" cor="sucesso" /> : null}
                  </View>
                  {p.presente ? (
                    <Botao
                      titulo="Desfazer presença"
                      variante="secundario"
                      larguraTotal={false}
                      rotuloAcessivel={`Desfazer a presença de ${p.nome}`}
                      desabilitado={usarLocal || !presenca}
                      motivo={
                        usarLocal
                          ? 'Desfazer presença exige conexão com a internet.'
                          : 'Carregando o registro de presença.'
                      }
                      carregando={
                        desfazer.isPending && desfazer.variables?.presencaId === presenca?.id
                      }
                      aoPressionar={() => {
                        if (!presenca) return
                        setAviso(null)
                        desfazer.mutate(
                          { presencaId: presenca.id, nome: p.nome },
                          { onSuccess: () => setAviso(`Presença de ${p.nome} desfeita.`) },
                        )
                      }}
                    />
                  ) : (
                    <Botao
                      titulo="Marcar presença"
                      icone="confirmado"
                      larguraTotal={false}
                      rotuloAcessivel={`Marcar presença de ${p.nome}`}
                      carregando={
                        (marcar.isPending && marcar.variables?.nome === p.nome) ||
                        (marcarLocal.isPending && marcarLocal.variables?.nome === p.nome)
                      }
                      aoPressionar={() => registrar(p.alvo, p.nome)}
                    />
                  )}
                </View>
              )
            })}
          </View>
        ) : null}
      </Cartao>

      <Cartao titulo="Chegou sem inscrição" icone="adicionar">
        <Texto variante="apoio" cor="textoSuave">
          Para visitantes sem inscrição e sem conta: registre só o nome.
        </Texto>
        <Campo
          rotulo="Nome de quem chegou"
          value={avulso}
          onChangeText={setAvulso}
          autoCapitalize="words"
          maxLength={120}
        />
        <Botao
          titulo="Registrar presença"
          variante="secundario"
          desabilitado={!avulso.trim()}
          motivo="Escreva o nome primeiro."
          aoPressionar={() => {
            registrar({ nomeAvulso: avulso.trim() }, avulso.trim())
            setAvulso('')
          }}
        />
      </Cartao>
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
