import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { RespostaDeCopiarEncontro } from '@/servicos/contratoV3'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { CampoDeData, CampoDeHora } from '@/ui/CampoDeMomento'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDoMomento } from '@/ui/CartaoDoMomento'
import { BlocoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { Secao } from '@/ui/Secao'
import { Sol } from '@/ui/Sol'
import { Tela } from '@/ui/Tela'
import { TextoAnunciado } from '@/ui/TextoAnunciado'
import { mostrarToast } from '@/ui/Toast'
import { mostrarDesfazer } from '@/ui/ToastComDesfazer'
import {
  dataDoInstante,
  formatarDuracao,
  formatarHora,
  hojeNoFuso,
  somarDias,
} from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'

import { dataCurtaDoDia, dataCurtaDoEncontro } from '../agenda/semanas'
import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import {
  naComunidade,
  useAnterioresParaCopiar,
  useCopiarEncontro,
  useEvento,
  useInvalidarEventos,
} from './consultas'
import { FolhaDeConvocar, pessoasDistintas, quantasPessoas } from './Convocacao'

interface Escolhas {
  data?: string
  hora?: string
  incluirMusicas: boolean
}

/**
 * Rota `/evento/igual-ao-ultimo?origem=`: "Igual ao último sábado" e "Marcar o próximo sábado"
 * (D66, D69, fluxo (d) do documento de UX). Abre já na CONFERÊNCIA: o app copia o último encontro
 * (um rascunho, sem avisar ninguém) e mostra o que foi copiado, quem não está disponível naquela
 * data e a opção de levar as músicas. Publicar é o botão do líder, com Desfazer de 10 s: nunca
 * o app publica sozinho. Sem encontro anterior, a tela oferece o Sábado padrão ou o Em branco.
 */
export function TelaIgualAoUltimo() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const origem = parametro(useLocalSearchParams<{ origem?: string }>().origem)
  if (!comunidadeAtiva) {
    return (
      <Tela pilha modal titulo="Igual ao último sábado">
        <SemComunidade oQue="os encontros" />
      </Tela>
    )
  }
  if (!pode('evento', 'criar')) {
    return (
      <Tela pilha modal titulo="Igual ao último sábado">
        <Aviso tipo="info" titulo="Só a organização marca encontros">
          Fale com quem organiza a sua comunidade para marcar o próximo sábado.
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
  const [erroAoPublicar, setErroAoPublicar] = useState<unknown>(null)
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

  // A tela pode ser deixada antes dos 10 s: depois disso, nada de navegar por ela.
  useEffect(() => {
    montada.current = true
    return () => {
      montada.current = false
      const id = rascunhoAtual.current
      if (!id || manter.current) return
      api
        .delete(`${naComunidade(comunidade.current)}/eventos/${id}`)
        .catch(() => null)
        .then(() => invalidarAoSair.current())
        .catch(() => null)
    }
  }, [])

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
  const pilulaAtual =
    outraData || (dataAtual && dataAtual !== sugerida && dataAtual !== depois)
      ? 'outra'
      : dataAtual === depois
        ? 'depois'
        : 'sugerida'

  const detalhe = evento.data ?? null
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

  function irParaOEncontro() {
    if (!rascunho || !montada.current) return
    router.replace({ pathname: '/evento/[eventoId]', params: { eventoId: rascunho.id } })
  }

  function salvarRascunho() {
    manter.current = true
    mostrarToast({ texto: 'Rascunho salvo. Ninguém foi avisado.' })
    irParaOEncontro()
  }

  function publicar() {
    if (!rascunho) return
    const id = rascunho.id
    const n = pessoas
    setErroAoPublicar(null)
    setPublicando(true)
    // Durante os 10 s a publicação é de quem pediu: sair da tela não pode apagar o rascunho.
    manter.current = true
    mostrarDesfazer({
      texto: n > 0 ? `Publicando e avisando ${quantasPessoas(n)}.` : 'Publicando o encontro.',
      aoDesfazer: () => {
        manter.current = false
        setPublicando(false)
      },
      aoConfirmar: () => {
        api
          .post(`${naComunidade(comunidadeId)}/eventos/${id}/status`, { status: 'publicado' })
          .then(async () => {
            mostrarToast({
              texto:
                n > 0
                  ? `Publicado. ${quantasPessoas(n)} ${n === 1 ? 'avisada' : 'avisadas'}.`
                  : 'Encontro publicado.',
            })
            await invalidar(id)
            irParaOEncontro()
          })
          .catch((erro: unknown) => {
            setErroAoPublicar(erro)
            setPublicando(false)
          })
      },
    })
  }

  const ocupada = copiar.isPending

  // ------------------------------------------------------------------ estados da tela
  if (!origemEfetiva && anteriores.isPending) {
    return (
      <Tela pilha modal titulo="Igual ao último sábado">
        <Esqueleto rotulo="Procurando o último encontro">
          <BlocoDeEsqueleto altura={160} />
          <BlocoDeEsqueleto altura={120} />
        </Esqueleto>
      </Tela>
    )
  }
  if (!origemEfetiva && anteriores.error) {
    return (
      <Tela pilha modal titulo="Igual ao último sábado">
        <ErroDaTela
          erro={anteriores.error}
          titulo="Não deu para procurar o último encontro"
          aoTentarDeNovo={() => void anteriores.refetch()}
        />
      </Tela>
    )
  }
  if (!origemEfetiva) {
    // Primeira vez: nada para copiar. O Sábado padrão traz o roteiro de sempre.
    return (
      <Tela pilha modal titulo="Marcar o próximo sábado">
        <View style={{ alignItems: 'center' }}>
          <Sol pose="escondido" lado={96} />
        </View>
        <EstadoVazio
          icone="agenda"
          titulo="Ainda não há um encontro para copiar."
          descricao="Depois do primeiro sábado, o app copia o roteiro e a equipe para você. Por enquanto, comece pelo Sábado padrão: o roteiro de sempre já vem pronto."
          acao={{
            titulo: 'Usar o Sábado padrão',
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
      <Tela pilha modal titulo="Igual ao último sábado">
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
  const rotuloDoPublicar = publicando
    ? 'Publicado'
    : pessoas > 0
      ? `Publicar e avisar ${quantasPessoas(pessoas)}`
      : 'Publicar'

  return (
    <Tela
      pilha
      modal
      titulo="Igual ao último sábado"
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Salvar rascunho"
            variante="secundario"
            tamanho="grande"
            desabilitado={ocupada || publicando}
            aoPressionar={salvarRascunho}
          />
          <Botao
            titulo={rotuloDoPublicar}
            tamanho="grande"
            {...(publicando ? { icone: 'check' as const } : {})}
            desabilitado={ocupada || publicando}
            aoPressionar={publicar}
          />
        </BarraDeAcao>
      }
    >
      {erroAoPublicar ? (
        <AvisoDeFalha erro={erroAoPublicar} titulo="O encontro não foi publicado" />
      ) : null}
      {copiar.error ? (
        <AvisoDeFalha
          erro={copiar.error}
          titulo="Não deu para mudar a cópia"
          aoTentarDeNovo={() => refazer({})}
        />
      ) : null}

      <CartaoDoMomento
        momento="longe"
        etiqueta="Rascunho · ninguém foi avisado"
        titulo={resumo.origem.titulo}
        meta={`${dataCurtaDoEncontro(rascunho.inicio, rascunho.fuso)} · ${hora}${detalhe?.local ? ` · ${detalhe.local.nome}` : ''}`}
      />

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

      <Secao titulo="Quando">
        <CartaoDeVidro opaco>
          <PilulasDeFiltro
            rotulo="Data do encontro"
            sangrar={false}
            pilulas={[
              {
                valor: 'sugerida',
                rotulo: sugerida ? dataCurtaDoDia(sugerida) : 'Data sugerida',
              },
              { valor: 'depois', rotulo: depois ? dataCurtaDoDia(depois) : 'Uma semana depois' },
              { valor: 'outra', rotulo: 'Outra data' },
            ]}
            selecionadas={[pilulaAtual]}
            aoMudar={(v) => {
              if (ocupada) return
              if (v[0] === 'sugerida' && sugerida) {
                setOutraData(false)
                refazer({ data: sugerida })
              } else if (v[0] === 'depois' && depois) {
                setOutraData(false)
                refazer({ data: depois })
              } else if (v[0] === 'outra') setOutraData(true)
            }}
          />
          {pilulaAtual === 'outra' ? (
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
          ) : null}
          {ocupada ? (
            <TextoAnunciado variante="legenda" cor="textoSuave">
              Atualizando a cópia...
            </TextoAnunciado>
          ) : null}
        </CartaoDeVidro>
      </Secao>

      <CartaoDeVidro lista>
        <Lista>
          <LinhaDeLista
            icone="etapas"
            titulo={`Roteiro: ${resumo.etapas} ${resumo.etapas === 1 ? 'etapa' : 'etapas'}, ${formatarDuracao(resumo.duracaoTotalMin)}`}
            aoPressionar={() =>
              router.push({ pathname: '/evento/[eventoId]', params: { eventoId: rascunho.id } })
            }
            dica="Abre o encontro copiado."
          />
          <LinhaDeLista
            icone="escalas"
            titulo={`Banda e equipe: ${quantasPessoas(pessoas)}`}
            descricao={
              resumo.naoCopiados > 0
                ? `${resumo.naoCopiados} ${resumo.naoCopiados === 1 ? 'pessoa saiu' : 'pessoas saíram'} da comunidade e não ${resumo.naoCopiados === 1 ? 'foi copiada' : 'foram copiadas'}.`
                : 'Todos voltam como "aguardando resposta".'
            }
            linhasDaDescricao={0}
          />
          {indisponiveis.map((i) => (
            <LinhaDeLista
              key={`${i.vinculoId}-${i.funcao}`}
              icone="avisoAlerta"
              titulo={`${i.nome.split(' ')[0]} avisou que não pode neste dia.`}
              descricao={i.funcao}
              linhasDaDescricao={0}
              extra={
                <Botao
                  titulo="Trocar"
                  tamanho="compacto"
                  variante="secundario"
                  desabilitado={!detalhe || ocupada}
                  rotuloAcessivel={`Trocar ${i.nome}: ${i.funcao}`}
                  aoPressionar={() => void trocar(i)}
                />
              }
            />
          ))}
        </Lista>
      </CartaoDeVidro>

      {resumo.musicas.naOrigem > 0 ? (
        <CartaoDeVidro opaco>
          <CaixaDeMarcar
            rotulo="Levar as músicas também"
            descricao={`${resumo.musicas.naOrigem} ${resumo.musicas.naOrigem === 1 ? 'música' : 'músicas'} no último sábado. As músicas mudam toda semana: só vão se você pedir.`}
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
