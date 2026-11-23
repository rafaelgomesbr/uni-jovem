import { CATEGORIAS_SUGERIDAS } from '@uj/dominio'
import { ESPACO, RITMO } from '@uj/tokens'
import { useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react'
import { type TextInput, useWindowDimensions, View } from 'react-native'

import type { Local, TipoDeLocal } from '@/servicos/contratoDosEventos'
import { Aparecer } from '@/ui/Aparecer'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CampoDeData, CampoDeHora } from '@/ui/CampoDeMomento'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha } from '@/ui/Falha'
import { FolhaNaTela } from '@/ui/FolhaNaTela'
import { Interruptor } from '@/ui/Interruptor'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { Secao } from '@/ui/Secao'
import { Segmentos } from '@/ui/Segmentos'
import { Texto } from '@/ui/Texto'

import { useLocais } from './consultas'
import {
  LOCAL_NOVO,
  type ErrosDoRascunho,
  type NovoLocal,
  type RascunhoDoEvento,
} from './formulario'
import { DESCRICAO_DA_VISIBILIDADE, NOME_DA_VISIBILIDADE } from './nomes'

export interface CamposVisiveis {
  data: boolean
  /** Visibilidade, vagas e informações úteis. */
  inscricoes: boolean
  /** Lista de espera e prazo de inscrição (só existem por ocorrência, não na série). */
  prazoEEspera: boolean
}

type NoDoCampo = ComponentRef<typeof TextInput>

/** Campos de texto que recebem o foco quando são o primeiro erro. */
export interface RefsDosCampos {
  titulo: RefObject<NoDoCampo | null>
  categoria: RefObject<NoDoCampo | null>
  duracao: RefObject<NoDoCampo | null>
  capacidade: RefObject<NoDoCampo | null>
}

export function useRefsDosCampos(): RefsDosCampos {
  // Cada hook numa linha própria, nunca dentro do objeto: o React Compiler
  // memoizava o objeto inteiro e pulava os quatro `useRef` a partir do segundo
  // render. A ordem dos hooks mudava e o app fechava em "Nova programação".
  const titulo = useRef<NoDoCampo>(null)
  const categoria = useRef<NoDoCampo>(null)
  const duracao = useRef<NoDoCampo>(null)
  const capacidade = useRef<NoDoCampo>(null)
  return { titulo, categoria, duracao, capacidade }
}

/** Leva o foco ao primeiro campo de texto com erro, na ordem da tela. */
export function focarPrimeiroErro(erros: ErrosDoRascunho, refs: RefsDosCampos) {
  const ordem = ['titulo', 'categoria', 'duracao', 'capacidade'] as const
  const primeiro = ordem.find((c) => erros[c])
  if (primeiro) refs[primeiro].current?.focus()
}

/** "Faltam 2 campos" (3.4.3): o resumo do topo. */
export function resumoDosErros(quantos: number): string | null {
  if (!quantos) return null
  return quantos === 1 ? 'Falta 1 campo' : `Faltam ${quantos} campos`
}

const DURACOES = ['30', '60', '90', '120'] as const

interface Props {
  comunidadeId: string
  rascunho: RascunhoDoEvento
  mudar: <K extends keyof RascunhoDoEvento>(campo: K, valor: RascunhoDoEvento[K]) => void
  erros: ErrosDoRascunho
  visiveis?: CamposVisiveis
  ajudaDaDuracao?: string
  refs?: RefsDosCampos
  /** Ocorrência de série editada como série: leva à tela da série para mudar o dia. */
  aoAbrirSerie?: () => void
  /**
   * Formulário curto (D69): só título, data, hora e local à vista; o resto (categoria,
   * descrição, duração, quem vê, vagas, informações úteis e o `extraNasOpcoes`) fica dobrado em
   * "Mais opções", que abre sozinho quando um campo escondido tem erro.
   */
  simples?: boolean
  /**
   * Dentro da seção "Dados do encontro" do Resumo (com `simples`): sem os títulos "O essencial" e
   * "Onde" (a seção já diz do que se trata) e com os campos essenciais num cartão só, sem cartão
   * dentro de cartão. Fora dela (tela de novo encontro, rota `/editar`) o desenho é o de sempre.
   */
  naSecao?: boolean
  /** O que mais entra em "Mais opções" (a repetição, no novo encontro). */
  extraNasOpcoes?: ReactNode
  /** Abre "Mais opções" por um erro que mora fora dos campos (o fim da repetição). */
  abrirOpcoes?: boolean
  /**
   * Novo encontro (D78): no lugar da data e hora lado a lado, o bloco "Quando?" que a tela monta
   * (calendário de vários dias e hora). Vem ANTES do título, que depende do dia escolhido.
   */
  quando?: ReactNode
  /** O título como a tela o controla (acompanha o dia até a pessoa escrever): valor, ajuda e exemplo. */
  titulo?: {
    valor: string
    aoMudar: (v: string) => void
    exemplo?: string
    ajuda?: string
  }
}

function descreverLocal(l: Pick<Local, 'tipo' | 'endereco'>): string {
  return l.tipo === 'interno' ? 'Local interno' : (l.endereco ?? 'Local externo')
}

/**
 * Campos de criar e editar programação (3.4.3 e quadro 07): grupos com a
 * sobrancelha fora do cartão; data e hora pelos seletores nativos, lado a
 * lado (1,4 para 1); duração com sufixo e pílulas; o local numa lista de
 * opções com "Cadastrar outro local" numa folha; quem vê em segmentos.
 */
export function CamposDoEvento({
  comunidadeId,
  rascunho: r,
  mudar,
  erros,
  visiveis = { data: true, inscricoes: true, prazoEEspera: true },
  ajudaDaDuracao,
  refs,
  aoAbrirSerie,
  simples = false,
  naSecao = false,
  extraNasOpcoes,
  abrirOpcoes = false,
  quando,
  titulo: tituloDaTela,
}: Props) {
  const [opcoesAbertas, setOpcoesAbertas] = useState(false)
  // "Data | Hora" lado a lado só enquanto cabem: com fonte a 150% ou mais do sistema, "28/11/2026"
  // quebrava no meio do número e "16:00" virava "16:…" (emulador, 23/11/2026). Aí, um embaixo do outro.
  const { fontScale } = useWindowDimensions()
  const empilhar = fontScale >= 1.5
  const parDeCampos = {
    flexDirection: empilhar ? 'column' : 'row',
    alignItems: empilhar ? 'stretch' : 'flex-start',
    gap: ESPACO.e12,
  } as const
  const lado = empilhar ? undefined : ({ flex: 1 } as const)
  const sugestoes = CATEGORIAS_SUGERIDAS.slice(0, 8)
  const comVagas = !!r.capacidade.trim()
  const erroDeQuando = !!(erros.data || erros.hora)
  const erroDoPrazo = !!(erros.inscricaoData || erros.inscricaoHora)

  // O que cada bloco mostra é o mesmo nos dois modos; só muda onde ele fica.
  const blocoDoTitulo = (
    <Campo
      ref={refs?.titulo}
      rotulo="Título"
      value={tituloDaTela?.valor ?? r.titulo}
      onChangeText={tituloDaTela?.aoMudar ?? ((v) => mudar('titulo', v))}
      erro={erros.titulo ?? null}
      exemplo={tituloDaTela?.exemplo ?? 'Encontro de jovens'}
      {...(tituloDaTela?.ajuda ? { ajuda: tituloDaTela.ajuda } : {})}
      maxLength={120}
    />
  )
  const blocoDaData = visiveis.data ? (
    <View style={parDeCampos}>
      <View style={lado}>
        <CampoDeData
          rotulo="Data"
          valor={r.data || null}
          aoMudar={(v) => mudar('data', v)}
          erro={erros.data ?? null}
          reservarApoio={erroDeQuando}
        />
      </View>
      <View style={lado}>
        <CampoDeHora
          rotulo="Hora"
          valor={r.hora || null}
          aoMudar={(v) => mudar('hora', v)}
          erro={erros.hora ?? null}
          reservarApoio={erroDeQuando}
        />
      </View>
    </View>
  ) : (
    <>
      <View style={{ gap: ESPACO.e4, alignItems: 'flex-start' }}>
        <Texto variante="corpo" cor="textoSuave">
          O dia de cada data vem da regra da repetição. Para mudar o dia da semana, use a repetição.
        </Texto>
        {aoAbrirSerie ? (
          <Botao
            titulo="Abrir a repetição"
            variante="terciario"
            alinhado
            aoPressionar={aoAbrirSerie}
          />
        ) : null}
      </View>
      <CampoDeHora
        rotulo="Hora"
        valor={r.hora || null}
        aoMudar={(v) => mudar('hora', v)}
        erro={erros.hora ?? null}
      />
    </>
  )
  const blocoDaCategoria = (
    <View style={{ gap: ESPACO.e8 }}>
      <Campo
        ref={refs?.categoria}
        rotulo="Categoria"
        value={r.categoria}
        onChangeText={(v) => mudar('categoria', v)}
        erro={erros.categoria ?? null}
        maxLength={60}
      />
      <PilulasDeFiltro
        rotulo="Sugestões de categoria"
        sangrar={false}
        pilulas={sugestoes.map((c) => ({ valor: c, rotulo: c }))}
        selecionadas={sugestoes.filter((c) => c === r.categoria.trim())}
        aoMudar={(v) => {
          if (v[0]) mudar('categoria', v[0])
        }}
      />
    </View>
  )
  const blocoDaDescricao = (
    <Campo
      rotulo="Descrição"
      opcional
      value={r.descricao}
      onChangeText={(v) => mudar('descricao', v)}
      exemplo="Louvor, estudo da lição e um lanche no fim."
      multiline
      maxLength={5000}
      mostrarContador
    />
  )
  const blocoDaDuracao = (
    <View style={{ gap: ESPACO.e8 }}>
      <Campo
        ref={refs?.duracao}
        rotulo="Duração"
        value={r.duracao}
        onChangeText={(v) => mudar('duracao', v.replace(/\D/g, ''))}
        erro={erros.duracao ?? null}
        {...(ajudaDaDuracao ? { ajuda: ajudaDaDuracao } : {})}
        sufixo="min"
        keyboardType="number-pad"
        maxLength={4}
      />
      <PilulasDeFiltro
        rotulo="Durações comuns"
        sangrar={false}
        pilulas={DURACOES.map((d) => ({ valor: d, rotulo: `${d} min` }))}
        selecionadas={DURACOES.filter((d) => d === r.duracao.trim())}
        aoMudar={(v) => {
          if (v[0]) mudar('duracao', v[0])
        }}
      />
    </View>
  )
  const blocoDoLocal = (
    <ListaDeLocais
      comunidadeId={comunidadeId}
      rascunho={r}
      mudar={mudar}
      erros={erros}
      semCartao={naSecao}
    />
  )
  const blocoDasInscricoes = visiveis.inscricoes ? (
    <>
      <Secao titulo="Quem vê e inscrições">
        <CartaoDeVidro opaco intervalo={ESPACO.e16}>
          <View style={{ gap: ESPACO.e8 }}>
            <Segmentos
              rotulo="Quem vê"
              valor={r.visibilidade}
              aoMudar={(v) => mudar('visibilidade', v)}
              segmentos={(['interna', 'publica'] as const).map((v) => ({
                valor: v,
                rotulo: NOME_DA_VISIBILIDADE[v],
              }))}
            />
            <Texto variante="legenda" cor="textoSuave">
              {DESCRICAO_DA_VISIBILIDADE[r.visibilidade]}
            </Texto>
          </View>
          <View style={{ flexDirection: 'row', gap: ESPACO.e12 }}>
            <View style={{ flex: 1 }}>
              <Campo
                ref={refs?.capacidade}
                rotulo="Vagas"
                opcional
                value={r.capacidade}
                onChangeText={(v) => mudar('capacidade', v.replace(/\D/g, ''))}
                erro={erros.capacidade ?? null}
                exemplo="30"
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
            <View style={{ flex: 1 }} />
          </View>
          {visiveis.prazoEEspera ? (
            <>
              <Interruptor
                rotulo="Lista de espera"
                descricao={
                  !comVagas
                    ? 'Defina as vagas primeiro'
                    : r.listaDeEspera
                      ? 'Ligada: quando as vagas acabam, a fila sobe sozinha'
                      : 'Desligada'
                }
                ligado={r.listaDeEspera && comVagas}
                desabilitado={!comVagas}
                aoMudar={(v) => mudar('listaDeEspera', v)}
              />
              <View style={parDeCampos}>
                <View style={lado}>
                  <CampoDeData
                    rotulo="Inscrições até"
                    opcional
                    valor={r.inscricaoData || null}
                    aoMudar={(v) => mudar('inscricaoData', v)}
                    erro={erros.inscricaoData ?? null}
                    reservarApoio={erroDoPrazo}
                    {...(r.data ? { maximo: r.data } : {})}
                  />
                </View>
                <View style={lado}>
                  <CampoDeHora
                    rotulo="Hora do prazo"
                    opcional
                    valor={r.inscricaoHora || null}
                    aoMudar={(v) => mudar('inscricaoHora', v)}
                    erro={erros.inscricaoHora ?? null}
                    reservarApoio={erroDoPrazo}
                  />
                </View>
              </View>
              {r.inscricaoData || r.inscricaoHora ? (
                <Botao
                  titulo="Tirar o prazo"
                  variante="terciario"
                  alinhado
                  dica="As inscrições ficam abertas até o início."
                  aoPressionar={() => {
                    mudar('inscricaoData', '')
                    mudar('inscricaoHora', '')
                  }}
                />
              ) : (
                <Texto variante="legenda" cor="textoSuave">
                  Sem prazo, as inscrições ficam abertas até o início.
                </Texto>
              )}
            </>
          ) : null}
        </CartaoDeVidro>
      </Secao>

      <Secao titulo="Informações úteis">
        <CartaoDeVidro opaco>
          <Campo
            rotulo="Para quem vai"
            opcional
            value={r.informacoesUteis}
            onChangeText={(v) => mudar('informacoesUteis', v)}
            exemplo="Traga a Bíblia e um agasalho."
            ajuda="Aparece também na página pública."
            multiline
            maxLength={5000}
          />
        </CartaoDeVidro>
      </Secao>
    </>
  ) : null

  if (simples) {
    // Um erro em campo escondido abre "Mais opções" sozinho: o campo com erro nunca fica fora da vista.
    const erroEscondido = !!(
      erros.categoria ||
      erros.duracao ||
      erros.capacidade ||
      erros.inscricaoData ||
      erros.inscricaoHora
    )
    const aberto = opcoesAbertas || erroEscondido || abrirOpcoes
    return (
      <>
        {quando ? (
          <>
            <Secao titulo="Quando?">
              <CartaoDeVidro opaco intervalo={ESPACO.e16}>
                {quando}
              </CartaoDeVidro>
            </Secao>
            <Secao titulo="Título">
              <CartaoDeVidro opaco>{blocoDoTitulo}</CartaoDeVidro>
            </Secao>
          </>
        ) : naSecao ? (
          // Um cartão só, sem sobrancelhas: o que o encontro tem de essencial, em ordem.
          <CartaoDeVidro opaco intervalo={RITMO.entreCampos}>
            {blocoDoTitulo}
            {blocoDaData}
            {blocoDoLocal}
          </CartaoDeVidro>
        ) : (
          <Secao titulo="O essencial">
            <CartaoDeVidro opaco intervalo={ESPACO.e16}>
              {blocoDoTitulo}
              {blocoDaData}
            </CartaoDeVidro>
          </Secao>
        )}
        {naSecao ? null : <Secao titulo="Onde">{blocoDoLocal}</Secao>}
        <View style={{ gap: ESPACO.e12 }}>
          <View style={{ alignItems: 'flex-start' }}>
            <Botao
              titulo="Mais opções"
              icone={aberto ? 'fechar' : 'abrirLista'}
              variante="terciario"
              alinhado
              marcado={aberto}
              dica="Categoria, descrição, duração, quem vê, vagas e repetição."
              aoPressionar={() => setOpcoesAbertas((a) => !a)}
            />
          </View>
          {aberto ? (
            <Aparecer style={{ gap: RITMO.entreSecoes }}>
              <Secao titulo="O que é">
                <CartaoDeVidro opaco intervalo={ESPACO.e16}>
                  {blocoDaCategoria}
                  {blocoDaDescricao}
                </CartaoDeVidro>
              </Secao>
              <Secao titulo="Duração">
                <CartaoDeVidro opaco intervalo={ESPACO.e16}>
                  {blocoDaDuracao}
                </CartaoDeVidro>
              </Secao>
              {blocoDasInscricoes}
              {extraNasOpcoes}
            </Aparecer>
          ) : null}
        </View>
      </>
    )
  }

  return (
    <>
      <Secao titulo="O que é">
        <CartaoDeVidro opaco intervalo={ESPACO.e16}>
          {blocoDoTitulo}
          {blocoDaCategoria}
          {blocoDaDescricao}
        </CartaoDeVidro>
      </Secao>

      <Secao titulo="Quando">
        <CartaoDeVidro opaco intervalo={ESPACO.e16}>
          {blocoDaData}
          {blocoDaDuracao}
        </CartaoDeVidro>
      </Secao>

      <Secao titulo="Onde">{blocoDoLocal}</Secao>

      {blocoDasInscricoes}
    </>
  )
}

/**
 * "ONDE" (quadro 07): a lista de opções de locais e, por último, "Cadastrar
 * outro local", que abre uma folha. O local novo é criado junto com a
 * programação, ao salvar (a mesma chamada de antes).
 */
function ListaDeLocais({
  comunidadeId,
  rascunho: r,
  mudar,
  erros,
  semCartao = false,
}: {
  comunidadeId: string
  rascunho: RascunhoDoEvento
  mudar: Props['mudar']
  erros: ErrosDoRascunho
  /** O cartão de fora já existe (a seção "Dados do encontro"): a lista não abre outro dentro dele. */
  semCartao?: boolean
}) {
  const locais = useLocais(comunidadeId)
  const [cadastrando, setCadastrando] = useState(false)

  if (locais.isPending) {
    return (
      <Esqueleto rotulo="Carregando os locais">
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }

  const opcoes = [
    { valor: '', rotulo: 'A definir', descricao: 'Escolha o lugar depois' },
    ...(locais.data ?? [])
      .filter((l) => !l.arquivado || l.id === r.local)
      .map((l) => ({ valor: l.id, rotulo: l.nome, descricao: descreverLocal(l) })),
    ...(r.local === LOCAL_NOVO
      ? [
          {
            valor: LOCAL_NOVO,
            rotulo: r.novoLocal.nome.trim() || 'Local novo',
            descricao: `${descreverLocal({ tipo: r.novoLocal.tipo, endereco: r.novoLocal.endereco.trim() || null })} · salvo com o encontro`,
          },
        ]
      : []),
  ]

  const lista = (
    <>
      <ListaDeOpcoes
        rotulo="Local"
        valor={r.local ?? ''}
        aoMudar={(v) => mudar('local', v === '' ? null : v)}
        opcoes={opcoes}
      />
      <Botao
        titulo="Cadastrar outro local"
        icone="adicionar"
        variante="terciario"
        alinhado
        dica="Abre uma folha com nome, tipo e endereço."
        aoPressionar={() => setCadastrando(true)}
      />
    </>
  )

  return (
    <>
      {locais.error ? (
        <AvisoDeFalha
          erro={locais.error}
          titulo="Os locais não carregaram"
          aoTentarDeNovo={() => void locais.refetch()}
        />
      ) : null}
      {erros.novoLocal ? (
        <AvisoDeFalha mensagem={erros.novoLocal} titulo="Confira o local novo" />
      ) : null}
      {semCartao ? (
        <View style={{ gap: ESPACO.e8 }}>{lista}</View>
      ) : (
        <CartaoDeVidro opaco intervalo={ESPACO.e8}>
          {lista}
        </CartaoDeVidro>
      )}
      <FolhaDoLocalNovo
        aberta={cadastrando}
        inicial={r.novoLocal}
        aoFechar={() => setCadastrando(false)}
        aoSalvar={(l) => {
          mudar('novoLocal', l)
          mudar('local', LOCAL_NOVO)
          setCadastrando(false)
        }}
      />
    </>
  )
}

/** Folha "Cadastrar outro local": Nome, Interno ou Externo, Endereço e Referência. */
function FolhaDoLocalNovo({
  aberta,
  inicial,
  aoFechar,
  aoSalvar,
}: {
  aberta: boolean
  inicial: NovoLocal
  aoFechar: () => void
  aoSalvar: (l: NovoLocal) => void
}) {
  const [nome, setNome] = useState(inicial.nome)
  const [tipo, setTipo] = useState<TipoDeLocal>(inicial.tipo)
  const [endereco, setEndereco] = useState(inicial.endereco)
  const [referencia, setReferencia] = useState(inicial.referencia)
  const [erros, setErros] = useState<{ nome?: string; endereco?: string }>({})

  function salvar() {
    const novos = {
      ...(nome.trim().length >= 2 ? {} : { nome: 'Dê um nome ao local.' }),
      ...(tipo === 'externo' && !endereco.trim()
        ? { endereco: 'Local externo precisa de endereço.' }
        : {}),
    }
    setErros(novos)
    if (Object.keys(novos).length) return
    aoSalvar({ nome, tipo, endereco, referencia })
  }

  return (
    <FolhaNaTela aberta={aberta} titulo="Cadastrar outro local" aoFechar={aoFechar}>
      <Campo
        rotulo="Nome"
        value={nome}
        onChangeText={setNome}
        erro={erros.nome ?? null}
        exemplo="Salão da igreja"
        maxLength={120}
      />
      <Segmentos
        rotulo="Tipo de local"
        valor={tipo}
        aoMudar={setTipo}
        segmentos={[
          { valor: 'interno', rotulo: 'Interno' },
          { valor: 'externo', rotulo: 'Externo' },
        ]}
      />
      <Campo
        rotulo="Endereço"
        opcional={tipo === 'interno'}
        value={endereco}
        onChangeText={setEndereco}
        erro={erros.endereco ?? null}
        ajuda="O Abrir no mapa usa este endereço."
        maxLength={300}
      />
      <Campo
        rotulo="Referência"
        opcional
        value={referencia}
        onChangeText={setReferencia}
        exemplo="Portão lateral"
        maxLength={300}
      />
      <Botao titulo="Salvar local" tamanho="grande" larguraTotal aoPressionar={salvar} />
    </FolhaNaTela>
  )
}
