import { duracaoTotal } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { RespostaDeCopiarEncontro } from '@/servicos/contratoV3'
import { Acordeao } from '@/ui/Acordeao'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { CampoDeData, CampoDeHora } from '@/ui/CampoDeMomento'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDoMomento } from '@/ui/CartaoDoMomento'
import { Chip } from '@/ui/Chip'
import { BlocoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { LinhaDeLista, Lista, RECUO_DA_LISTA } from '@/ui/LinhaDeLista'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { Sol } from '@/ui/Sol'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'
import { mostrarToast } from '@/ui/Toast'
import { desfazerAgora, mostrarDesfazer, useRestanteDoDesfazer } from '@/ui/ToastComDesfazer'
import { confirmar } from '@/utilidades/confirmar'
import {
  dataDoInstante,
  formatarDuracao,
  formatarHora,
  hojeNoFuso,
  somarDias,
} from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'

import { dataCurtaDoDia, dataCurtaDoEncontro } from '../agenda/semanas'
import { CabecalhoDeAcordeao } from '../comunidade/CabecalhoDeAcordeao'
import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { textoDePublicado } from './BarraDoEvento'
import {
  equipeDoRascunho,
  escolhaDeData,
  fraseDoRascunho,
  tituloDaConferencia,
} from './conferencia'
import {
  avisoDeDataOcupada,
  naComunidade,
  perguntaDeDataOcupada,
  useAnterioresParaCopiar,
  useCopiarEncontro,
  useEncontrosNoDia,
  useEvento,
  useInvalidarEventos,
} from './consultas'
import { FolhaDeConvocar, pessoasDistintas, quantasPessoas } from './Convocacao'
import { RoteiroDoEncontro } from './SecaoEtapas'
import {
  esquecerProvisorio,
  limparProvisoriosAbandonados,
  registrarProvisorio,
} from './rascunhosProvisorios'

const TITULO = 'Igual ao último encontro'

interface Escolhas {
  data?: string
  hora?: string
  incluirMusicas: boolean
}

/**
 * Rota `/evento/igual-ao-ultimo?origem=`: "Igual ao último encontro" e "Marcar o próximo encontro"
 * (D66, D69, D78). Uma tela só, sem ir para outra: o app copia o último encontro (um rascunho, sem
 * avisar ninguém) e mostra, de cima para baixo, o cartão do encontro novo, a pergunta "Quando?" com
 * as datas sugeridas e "Outra data", o Roteiro e a Banda e equipe como acordeões (abrem e fecham ali
 * mesmo) e "Levar as músicas também". Salvar rascunho e Publicar flutuam acima da barra de abas. A
 * data padrão é o próximo dia da semana do encontro anterior a partir de hoje; se já existe encontro
 * nesse dia, a tela avisa e publicar pergunta "Criar outro mesmo assim?". O título acompanha o dia
 * ("Sábado" copiado para um domingo vira "Domingo"; um título escrito pela pessoa nunca muda).
 * Publicar tem Desfazer: o botão diz "Publicando em 9 s" e, no fim, "Publicado. 9 pessoas foram
 * avisadas." (D74). Sem encontro anterior, a tela oferece o Encontro padrão ou o Em branco.
 */
export function TelaIgualAoUltimo() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const origem = parametro(useLocalSearchParams<{ origem?: string }>().origem)
  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo={TITULO}>
        <SemComunidade oQue="os encontros" />
      </Tela>
    )
  }
  if (!pode('evento', 'criar')) {
    return (
      <Tela pilha titulo={TITULO}>
        <Aviso tipo="info" titulo="Só a organização marca encontros">
          Fale com quem organiza a sua comunidade para marcar o próximo encontro.
        </Aviso>
      </Tela>
    )
  }
  return <Conferencia comunidadeId={comunidadeAtiva.id} origemPedida={origem} />
}

function Conferencia({
  comunidadeId,
  origemPedida,
}: {
  comunidadeId: string
  origemPedida: string | null
}) {
  const invalidar = useInvalidarEventos(comunidadeId)
  const anteriores = useAnterioresParaCopiar(comunidadeId, origemPedida === null)
  const copiar = useCopiarEncontro(comunidadeId)
  const [origem, setOrigem] = useState<string | null>(origemPedida)
  const [escolhas, setEscolhas] = useState<Escolhas>({ incluirMusicas: false })
  const [rascunho, setRascunho] = useState<RespostaDeCopiarEncontro | null>(null)
  const [sugerida, setSugerida] = useState<string | null>(null)
  const [outraData, setOutraData] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const restante = useRestanteDoDesfazer()
  const fusoDaComunidade = useFusoDaComunidade()
  const [convocar, setConvocar] = useState<{
    aberta: boolean
    funcao: string
    etapaId: string | null
    chave: number
  }>({ aberta: false, funcao: '', etapaId: null, chave: 0 })
  const evento = useEvento(comunidadeId, rascunho?.id ?? null)
  const montada = useRef(true)
  const iniciou = useRef(false)

  // Quem sai da tela sem "Salvar rascunho" nem "Publicar" não quis o encontro: o rascunho que a
  // abertura criou sairia solto na Agenda ("Rascunhos (8)" nas capturas de 22/11/2026). O que
  // foi salvo ou está na espera de 10 s da publicação fica.
  const manter = useRef(false)
  const rascunhoAtual = useRef<string | null>(null)
  const comunidade = useRef(comunidadeId)
  const invalidarAoSair = useRef(invalidar)
  useEffect(() => {
    rascunhoAtual.current = rascunho?.id ?? null
    comunidade.current = comunidadeId
    invalidarAoSair.current = invalidar
  })

  // A tela pode ser deixada antes da contagem: depois disso, nada de navegar por ela.
  useEffect(() => {
    montada.current = true
    return () => {
      montada.current = false
      const id = rascunhoAtual.current
      if (!id || manter.current) return
      api
        .delete(`${naComunidade(comunidade.current)}/eventos/${id}`)
        .then(() => esquecerProvisorio(id))
        .catch(() => null)
        .then(() => invalidarAoSair.current())
        .catch(() => null)
    }
  }, [])

  // O que sobrou de uma vez em que o app ou a aba fecharam no meio: rascunhos soltos na Agenda.
  useEffect(() => {
    void limparProvisoriosAbandonados(comunidadeId, (id) =>
      api.delete(`${naComunidade(comunidadeId)}/eventos/${id}`),
    ).then((n) => (n > 0 ? invalidarAoSair.current() : undefined))
  }, [comunidadeId])

  const opcoes = anteriores.data?.opcoes ?? []
  const origemEfetiva = origem ?? opcoes[0]?.eventoId ?? null

  function refazer(parcial: Partial<Escolhas> & { origem?: string }) {
    const { origem: novaOrigem, ...resto } = parcial
    const proximas = { ...escolhas, ...resto }
    const alvo = novaOrigem ?? origemEfetiva
    if (!alvo) return
    setEscolhas(proximas)
    setOrigem(alvo)
    copiar.mutate(
      {
        origem: alvo,
        ...(proximas.data ? { data: proximas.data } : {}),
        ...(proximas.hora ? { hora: proximas.hora } : {}),
        incluirMusicas: proximas.incluirMusicas,
        rascunhoAnterior: rascunho?.id ?? null,
      },
      {
        onSuccess: (r) => {
          setRascunho(r)
          setSugerida((s) => s ?? dataDoInstante(r.inicio, r.fuso))
          // Anota que este rascunho ainda não foi mantido: se o app fechar, a próxima abertura o apaga.
          void registrarProvisorio(comunidadeId, r.id)
        },
      },
    )
  }

  // Começar é sincronizar com o servidor: ao saber de onde copiar, a primeira cópia já nasce.
  const comecar = useEffectEvent(() => refazer({}))
  useEffect(() => {
    if (iniciou.current || !origemEfetiva) return
    iniciou.current = true
    comecar()
  }, [origemEfetiva])

  const dataAtual = rascunho ? dataDoInstante(rascunho.inicio, rascunho.fuso) : null
  const depois = sugerida ? somarDias(sugerida, 7) : null
  const escolhida = escolhaDeData({ aberta: outraData, dataAtual, sugerida, depois })

  // Já existe encontro nesse dia? A pessoa fica sabendo antes de publicar (D74).
  const noMesmoDia = useEncontrosNoDia(
    comunidadeId,
    dataAtual,
    rascunho?.fuso ?? fusoDaComunidade,
    rascunho?.id ?? null,
  )

  const detalhe = evento.data ?? null
  const equipe = rascunho ? equipeDoRascunho(detalhe, rascunho.resumo) : []
  const pessoas = detalhe
    ? pessoasDistintas(detalhe.atribuicoes)
    : (rascunho?.resumo.convocados.pessoas ?? 0)
  const indisponiveis = (rascunho?.resumo.indisponiveis ?? []).filter(
    (i) => !detalhe || detalhe.atribuicoes.some((a) => a.vinculoId === i.vinculoId),
  )

  async function trocar(i: { vinculoId: string; funcao: string }) {
    if (!detalhe) return
    const dela = detalhe.atribuicoes.filter((a) => a.vinculoId === i.vinculoId)
    // Rascunho ninguém recebeu: tirar a pessoa agora não avisa ninguém.
    await Promise.all(
      dela.map((a) =>
        api.delete(`${naComunidade(comunidadeId)}/eventos/${detalhe.id}/atribuicoes/${a.id}`),
      ),
    ).catch(() => null)
    await invalidar(detalhe.id)
    setConvocar((c) => ({
      aberta: true,
      funcao: i.funcao,
      etapaId: dela[0]?.etapaId ?? null,
      chave: c.chave + 1,
    }))
  }

  function irParaOEncontro(avisadas?: number) {
    if (!rascunho || !montada.current) return
    router.replace({
      pathname: '/evento/[eventoId]',
      params: {
        eventoId: rascunho.id,
        ...(avisadas !== undefined ? { publicado: String(avisadas) } : {}),
      },
    })
  }

  function salvarRascunho() {
    manter.current = true
    if (rascunho) void esquecerProvisorio(rascunho.id)
    mostrarToast({ texto: 'Rascunho salvo. Ninguém foi avisado.' })
    irParaOEncontro()
  }

  async function publicar() {
    if (!rascunho) return
    // Já existe encontro nesse dia: a pergunta vem ANTES de a contagem começar.
    if (noMesmoDia.length > 0) {
      const ok = await confirmar({
        titulo: 'Já existe um encontro neste dia',
        mensagem: perguntaDeDataOcupada(noMesmoDia),
        confirmar: 'Criar outro mesmo assim',
      })
      if (!ok) return
    }
    const id = rascunho.id
    const n = pessoas
    setPublicando(true)
    // Durante a contagem a publicação é de quem pediu: sair da tela não pode apagar o rascunho.
    manter.current = true
    mostrarDesfazer({
      texto: n > 0 ? `Publicando e avisando ${quantasPessoas(n)}.` : 'Publicando o encontro.',
      textoDaFalha:
        'Não deu para publicar. Nada foi enviado nem ninguém foi avisado. O rascunho continua salvo. Toque em Tentar de novo.',
      aoDesfazer: () => {
        manter.current = false
        setPublicando(false)
      },
      aoFalhar: () => setPublicando(false),
      // Sai ao fim da contagem, ao sair da tela ou do app, e de novo se a rede falhar (D74).
      aoConfirmar: async () => {
        setPublicando(true)
        await api.post(`${naComunidade(comunidadeId)}/eventos/${id}/status`, {
          status: 'publicado',
        })
        void esquecerProvisorio(id)
        await invalidar(id)
        mostrarToast({ texto: textoDePublicado(n) })
        setPublicando(false)
        irParaOEncontro(n)
      },
    })
  }

  const ocupada = copiar.isPending

  // ------------------------------------------------------------------ estados da tela
  if (!origemEfetiva && anteriores.isPending) {
    return (
      <Tela pilha titulo={TITULO}>
        <Esqueleto rotulo="Procurando o último encontro">
          <BlocoDeEsqueleto altura={160} />
          <BlocoDeEsqueleto altura={120} />
        </Esqueleto>
      </Tela>
    )
  }
  if (!origemEfetiva && anteriores.error) {
    return (
      <Tela pilha titulo={TITULO}>
        <ErroDaTela
          erro={anteriores.error}
          titulo="Não deu para procurar o último encontro"
          aoTentarDeNovo={() => void anteriores.refetch()}
        />
      </Tela>
    )
  }
  if (!origemEfetiva) {
    // Primeira vez: nada para copiar. O Encontro padrão traz o roteiro de sempre.
    return (
      <Tela pilha titulo="Marcar o próximo encontro">
        <View style={{ alignItems: 'center' }}>
          <Sol pose="escondido" lado={96} />
        </View>
        <EstadoVazio
          icone="agenda"
          titulo="Ainda não há um encontro para copiar."
          descricao="Depois do primeiro encontro, o app copia o roteiro e a equipe para você. Por enquanto, comece pelo Encontro padrão: o roteiro de sempre já vem pronto."
          acao={{
            titulo: 'Usar o Encontro padrão',
            aoPressionar: () =>
              router.replace({ pathname: '/evento/novo', params: { modelo: 'sabado_padrao' } }),
          }}
          acaoSecundaria={{
            titulo: 'Começar em branco',
            aoPressionar: () => router.replace('/evento/novo'),
          }}
        />
      </Tela>
    )
  }
  if (!rascunho) {
    return (
      <Tela pilha titulo={TITULO}>
        {copiar.error ? (
          <AvisoDeFalha
            erro={copiar.error}
            titulo="Não deu para copiar o encontro"
            aoTentarDeNovo={() => refazer({})}
          />
        ) : (
          <Esqueleto rotulo="Copiando o último encontro">
            <BlocoDeEsqueleto altura={190} />
            <BlocoDeEsqueleto altura={120} />
            <BlocoDeEsqueleto altura={96} />
          </Esqueleto>
        )}
      </Tela>
    )
  }

  const resumo = rascunho.resumo
  const hora = formatarHora(rascunho.inicio, rascunho.fuso)
  const titulo = tituloDaConferencia(detalhe, resumo.origem.titulo, dataAtual)
  // Estado único e honesto: durante a contagem o botão é o Desfazer e o cabeçalho diz que ainda não saiu.
  const rotuloDoPublicar = publicando
    ? restante !== null
      ? `Publicando em ${restante} s · Desfazer`
      : 'Publicando...'
    : 'Publicar'
  const etiquetaDoCabecalho = publicando
    ? restante !== null
      ? `Publicando em ${restante} s`
      : 'Publicando...'
    : 'Rascunho'
  // O roteiro da conferência acompanha o que a pessoa muda ali (adicionar, tirar, mudar a duração).
  const nEtapas = detalhe?.etapas.length ?? resumo.etapas
  const minutos = detalhe ? duracaoTotal(detalhe.etapas) : resumo.duracaoTotalMin
  const tituloDoRoteiro = `Roteiro: ${nEtapas} ${nEtapas === 1 ? 'etapa' : 'etapas'}, ${formatarDuracao(minutos)}`

  return (
    <Tela
      pilha
      titulo={TITULO}
      barraDeAcao={
        <BarraDeAcao solta>
          {publicando ? null : (
            <Botao
              titulo="Salvar rascunho"
              variante="secundario"
              tamanho="grande"
              desabilitado={ocupada}
              aoPressionar={salvarRascunho}
            />
          )}
          <Botao
            titulo={rotuloDoPublicar}
            tamanho="grande"
            {...(publicando ? { icone: 'relogio' as const } : {})}
            desabilitado={ocupada || (publicando && restante === null)}
            aoPressionar={publicando ? desfazerAgora : () => void publicar()}
          />
        </BarraDeAcao>
      }
    >
      {copiar.error ? (
        <AvisoDeFalha
          erro={copiar.error}
          titulo="Não deu para mudar a cópia"
          aoTentarDeNovo={() => refazer({})}
        />
      ) : null}

      <CartaoDoMomento
        momento="longe"
        etiqueta={etiquetaDoCabecalho}
        titulo={titulo}
        meta={`${dataCurtaDoEncontro(rascunho.inicio, rascunho.fuso)} · ${hora}${detalhe?.local ? ` · ${detalhe.local.nome}` : ''}`}
      >
        <Texto variante="legenda" cor="textoSuave" style={{ marginTop: ESPACO.e8 }}>
          {publicando ? 'Ninguém foi avisado ainda.' : fraseDoRascunho(pessoas)}
        </Texto>
      </CartaoDoMomento>

      {noMesmoDia.length > 0 ? (
        <Aviso tipo="alerta" titulo="Já existe encontro neste dia">
          {`${avisoDeDataOcupada(noMesmoDia)} Se publicar este também, a Agenda terá os dois.`}
        </Aviso>
      ) : null}

      {opcoes.length > 1 && origemPedida === null ? (
        <ListaDeOpcoes
          rotulo="Copiar de"
          valor={origemEfetiva}
          aoMudar={(v) => refazer({ origem: v })}
          opcoes={opcoes.map((o) => ({
            valor: o.eventoId,
            rotulo: o.titulo,
            descricao: dataCurtaDoEncontro(o.inicio, o.fuso),
          }))}
        />
      ) : null}

      <ListaDeOpcoes
        rotulo="Quando?"
        valor={escolhida}
        aoMudar={(v) => {
          if (ocupada) return
          if (v === 'sugerida' && sugerida) {
            setOutraData(false)
            refazer({ data: sugerida })
          } else if (v === 'depois' && depois) {
            setOutraData(false)
            refazer({ data: depois })
          } else if (v === 'outra') setOutraData(true)
        }}
        opcoes={[
          {
            valor: 'sugerida',
            rotulo: sugerida ? dataCurtaDoDia(sugerida) : 'Data sugerida',
            descricao: 'O próximo, no mesmo dia da semana',
          },
          {
            valor: 'depois',
            rotulo: depois ? dataCurtaDoDia(depois) : 'Uma semana depois',
            descricao: 'Uma semana depois',
          },
          { valor: 'outra', rotulo: 'Outra data', descricao: 'Escolher o dia e a hora' },
        ]}
      />
      {escolhida === 'outra' ? (
        <CartaoDeVidro opaco>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e12 }}>
            <View style={{ flex: 1.4 }}>
              <CampoDeData
                rotulo="Data"
                valor={dataAtual}
                aoMudar={(d) => refazer({ data: d })}
                minimo={hojeNoFuso(rascunho.fuso)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <CampoDeHora rotulo="Hora" valor={hora} aoMudar={(h) => refazer({ hora: h })} />
            </View>
          </View>
        </CartaoDeVidro>
      ) : null}
      {ocupada ? (
        <TextoAnunciado variante="legenda" cor="textoSuave">
          Atualizando a cópia...
        </TextoAnunciado>
      ) : null}

      <CartaoDeVidro lista>
        <Acordeao
          recuo={RECUO_DA_LISTA.texto}
          rotuloRecolhido={`${tituloDoRoteiro}. Recolhido, toque para ver e mudar as etapas.`}
          rotuloAberto="Roteiro. Aberto, toque para recolher."
          cabecalho={() => <CabecalhoDeAcordeao icone="etapas" titulo={tituloDoRoteiro} />}
        >
          {detalhe && detalhe.etapas.length > 0 ? (
            <RoteiroDoEncontro evento={detalhe} comunidadeId={comunidadeId} />
          ) : (
            <TextoDoAcordeao>
              {detalhe ? 'O último encontro não tinha etapas.' : 'Carregando as etapas...'}
            </TextoDoAcordeao>
          )}
        </Acordeao>
      </CartaoDeVidro>

      <CartaoDeVidro lista>
        <Acordeao
          recuo={RECUO_DA_LISTA.texto}
          rotuloRecolhido={`Banda e equipe: ${quantasPessoas(pessoas)}${indisponiveis.length ? `, ${indisponiveis.length} avisou que não pode` : ''}. Recolhido, toque para ver quem volta.`}
          rotuloAberto="Banda e equipe. Aberto, toque para recolher."
          cabecalho={() => (
            <CabecalhoDeAcordeao
              icone="escalas"
              titulo={`Banda e equipe: ${quantasPessoas(pessoas)}`}
              {...(indisponiveis.length > 0
                ? {
                    extra: (
                      <Chip
                        situacao="naoPode"
                        texto={`${indisponiveis.length} não ${indisponiveis.length === 1 ? 'pode' : 'podem'}`}
                      />
                    ),
                  }
                : {})}
            />
          )}
        >
          {equipe.length > 0 ? (
            <Lista>
              {equipe.map((p) => {
                const naoPode = indisponiveis.find(
                  (i) => i.vinculoId === p.vinculoId && i.funcao === p.funcao,
                )
                const funcao = p.onde ? `${p.funcao} · ${p.onde}` : p.funcao
                return (
                  <LinhaDeLista
                    key={p.chave}
                    avatar={{ nome: p.nome }}
                    titulo={p.nome}
                    descricao={naoPode ? `Avisou que não pode neste dia. ${funcao}` : funcao}
                    linhasDaDescricao={0}
                    {...(naoPode
                      ? {
                          extra: (
                            <Botao
                              titulo="Trocar"
                              tamanho="compacto"
                              variante="secundario"
                              desabilitado={!detalhe || ocupada}
                              rotuloAcessivel={`Trocar ${p.nome}: ${p.funcao}`}
                              aoPressionar={() => void trocar(naoPode)}
                            />
                          ),
                        }
                      : {})}
                  />
                )
              })}
            </Lista>
          ) : (
            <TextoDoAcordeao>
              Ninguém estava convocado no último encontro. Você escolhe quem vai depois de salvar.
            </TextoDoAcordeao>
          )}
          <TextoDoAcordeao>
            {resumo.naoCopiados > 0
              ? `${resumo.naoCopiados} ${resumo.naoCopiados === 1 ? 'pessoa saiu' : 'pessoas saíram'} da comunidade e não ${resumo.naoCopiados === 1 ? 'foi copiada' : 'foram copiadas'}. `
              : ''}
            {equipe.length > 0 ? 'Todos voltam como "aguardando resposta".' : ''}
          </TextoDoAcordeao>
        </Acordeao>
      </CartaoDeVidro>

      {resumo.musicas.naOrigem > 0 ? (
        <CartaoDeVidro opaco>
          <CaixaDeMarcar
            rotulo="Levar as músicas também"
            descricao={`${resumo.musicas.naOrigem} ${resumo.musicas.naOrigem === 1 ? 'música' : 'músicas'} no último encontro. As músicas mudam toda semana: só vão se você pedir.`}
            marcada={escolhas.incluirMusicas}
            aoMudar={(v) => {
              if (!ocupada) refazer({ incluirMusicas: v })
            }}
          />
        </CartaoDeVidro>
      ) : null}

      {detalhe ? (
        <FolhaDeConvocar
          key={convocar.chave}
          evento={detalhe}
          etapa={detalhe.etapas.find((e) => e.id === convocar.etapaId) ?? null}
          comunidadeId={comunidadeId}
          aberta={convocar.aberta}
          funcaoInicial={convocar.funcao || null}
          aoFechar={() => setConvocar((c) => ({ ...c, aberta: false }))}
        />
      ) : null}
    </Tela>
  )
}

/** Frase solta dentro de um acordeão: alinhada ao texto das linhas (18 de recuo). */
function TextoDoAcordeao({ children }: { children: string | string[] }) {
  const texto = Array.isArray(children) ? children.join('').trim() : children
  if (!texto) return null
  return (
    <View style={{ paddingHorizontal: RECUO_DA_LISTA.texto, paddingBottom: ESPACO.e12 }}>
      <Texto variante="legenda" cor="textoSuave">
        {texto}
      </Texto>
    </View>
  )
}
