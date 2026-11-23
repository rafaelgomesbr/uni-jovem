import { useMutation, useQueryClient } from '@tanstack/react-query'
import { duracaoTotal, MODELO_SABADO_PADRAO, rotuloCurtoDoDia } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { Visibilidade } from '@/servicos/contratoDosEventos'
import { Acordeao } from '@/ui/Acordeao'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { CampoDeHora } from '@/ui/CampoDeMomento'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha } from '@/ui/Falha'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { useConfirmarDescarte, useTravaDeEnvio } from '@/ui/navegacao'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Icone } from '@/ui/Icone'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'
import { useTema } from '@/ui/tema'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import {
  dataValidaOuNula,
  formatarDuracao,
  hojeNoFuso,
  instanteDeDataEHora,
  lerDataDigitada,
  type DataLocal,
} from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { CalendarioDeVariosDias } from './CalendarioDeVariosDias'
import {
  CamposDoEvento,
  focarPrimeiroErro,
  resumoDosErros,
  useRefsDosCampos,
} from './CamposDoEvento'
import {
  avisoDeDataOcupada,
  avisoDeDiasOcupados,
  naComunidade,
  perguntaDeDataOcupada,
  useEncontrosNosDias,
  useInvalidarEventos,
  useModelos,
} from './consultas'
import { EditorDeRegra } from './EditorDeRegra'
import { dataJaPassou } from './regras'
import {
  LOCAL_NOVO,
  rascunhoVazio,
  regraDoRascunho,
  regraVazia,
  validarRascunho,
  type ErrosDoRascunho,
  type EventoValidado,
  type RascunhoDoEvento,
} from './formulario'
import {
  ajudaDoTituloEmBranco,
  alternarDia,
  emOrdem,
  horaDoDia,
  quantosComHoraDiferente,
  resumoDosDias,
  sugestaoDeTitulo,
} from './variosDias'

/** Parâmetro da folha "Novo encontro" para escolher um modelo antes. */
const ESCOLHER_MODELO = 'escolher'

/**
 * Sem modelo, categoria e duração são obrigatórias, mas ficam em "Mais opções" (D69: o formulário
 * curto é título, data, hora e local). Os padrões deixam o caminho curto de pé; o modelo escolhido
 * troca os dois pelos dele.
 */
const CATEGORIA_PADRAO = 'Encontro'
const DURACAO_PADRAO = '60'

/** Rota `/evento/novo?modelo=...`: criar evento avulso, vários dias de uma vez ou série. */
export function TelaNovoEvento() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const params = useLocalSearchParams<{ modelo?: string; data?: string }>()
  const modelo = parametro(params.modelo)
  // "Nova programação neste dia" (Agenda): a data já vem escolhida.
  const data = dataValidaOuNula(parametro(params.data))
  if (!comunidadeAtiva) {
    return (
      <Tela pilha>
        <SemComunidade oQue="os encontros" />
      </Tela>
    )
  }
  if (!pode('evento', 'criar')) {
    return (
      <Tela pilha titulo="Novo encontro">
        <Aviso tipo="info" titulo="Só a organização cria encontros">
          Fale com quem organiza a sua comunidade para montar um encontro.
        </Aviso>
      </Tela>
    )
  }
  return (
    <NovoEvento comunidadeId={comunidadeAtiva.id} modeloInicial={modelo ?? ''} dataInicial={data} />
  )
}

interface Corpo {
  titulo: string
  categoria: string
  descricao: string | null
  localId: string | null
  visibilidade: Visibilidade
  capacidade: number | null
  informacoesUteis: string | null
  duracaoMin?: number
  modelo?: string
}

/** O que a criação precisa além dos dados do formulário. */
interface PedidoDeCriacao {
  dados: EventoValidado
  publicar: boolean
  /** Os dias escolhidos, com a hora de cada um. Um só = encontro avulso (ou série). */
  dias: { data: DataLocal; hora: string }[]
  /** Só o título que a pessoa escreveu; sem ele, cada dia leva o próprio nome ("Domingo"). */
  tituloEscrito: string | null
}

function NovoEvento({
  comunidadeId,
  modeloInicial,
  dataInicial,
}: {
  comunidadeId: string
  modeloInicial: string
  dataInicial: DataLocal | null
}) {
  const pode = usePode()
  const { cores } = useTema()
  const fuso = useFusoDaComunidade()
  const invalidar = useInvalidarEventos(comunidadeId)
  const consultas = useQueryClient()
  const refs = useRefsDosCampos()
  const escolherModelo = modeloInicial === ESCOLHER_MODELO && pode('modelo', 'ler')
  const modelos = useModelos(comunidadeId, pode('modelo', 'ler'))
  const [modelo, setModelo] = useState(modeloInicial === ESCOLHER_MODELO ? '' : modeloInicial)
  const [rascunhoInicial] = useState<RascunhoDoEvento>(() => {
    const r = rascunhoVazio()
    if (modeloInicial !== 'sabado_padrao') {
      return { ...r, categoria: CATEGORIA_PADRAO, duracao: DURACAO_PADRAO }
    }
    // Encontro padrão: sem dia fixo (o modelo não impõe sábado, D78), mas já com a hora de sempre.
    return { ...r, categoria: MODELO_SABADO_PADRAO.categoria, hora: '16:00' }
  })
  const [rascunho, setRascunho] = useState<RascunhoDoEvento>(rascunhoInicial)
  const [diasIniciais] = useState<DataLocal[]>(() => (dataInicial ? [dataInicial] : []))
  const [dias, setDias] = useState<DataLocal[]>(diasIniciais)
  const [horasDiferentes, setHorasDiferentes] = useState<Record<string, string>>({})
  // O título acompanha o dia escolhido até a pessoa escrever o dela (D78).
  const [tituloEscrito, setTituloEscrito] = useState(false)
  const [regra, setRegra] = useState(regraVazia)
  const trava = useTravaDeEnvio()
  // Uma programação inteira montada e um "Voltar" por engano: pergunta antes de perder (A5).
  const liberar = useConfirmarDescarte(
    JSON.stringify(rascunho) !== JSON.stringify(rascunhoInicial) ||
      JSON.stringify(regra) !== JSON.stringify(regraVazia()) ||
      JSON.stringify(dias) !== JSON.stringify(diasIniciais) ||
      Object.keys(horasDiferentes).length > 0,
  )
  const [erros, setErros] = useState<ErrosDoRascunho>({})
  const [erroDoFim, setErroDoFim] = useState<string | null>(null)

  const varios = dias.length > 1
  const ehSerie = !varios && regra.repeticao !== 'nao'
  const primeira = dias[0] ?? null
  // Já existe encontro em algum desses dias? A pessoa fica sabendo antes de criar outro por cima (D74).
  const ocupados = useEncontrosNosDias(comunidadeId, ehSerie ? [] : dias, fuso)
  const mudar = <K extends keyof RascunhoDoEvento>(campo: K, valor: RascunhoDoEvento[K]) =>
    setRascunho((r) => ({ ...r, [campo]: valor }))

  const embutidos = modelos.data?.embutidos ?? []
  const daComunidade = modelos.data?.daComunidade ?? []
  const etapasDoModelo =
    embutidos.find((m) => m.chave === modelo)?.etapas ??
    daComunidade.find((m) => m.id === modelo)?.etapas ??
    null

  // O título que a tela mostra: o que a pessoa escreveu ou, enquanto ela não escreveu, o nome do dia.
  // Com vários dias sem título escrito, o campo fica vazio e cada encontro leva o nome do seu dia.
  const sugestao = sugestaoDeTitulo(dias)
  const valorDoTitulo = tituloEscrito ? rascunho.titulo : varios ? '' : sugestao
  const tituloEfetivo = rascunho.titulo.trim() && tituloEscrito ? rascunho.titulo.trim() : null

  function trocarModelo(valor: string) {
    setModelo(valor)
    const m =
      embutidos.find((x) => x.chave === valor) ?? daComunidade.find((x) => x.id === valor) ?? null
    setRascunho((r) =>
      m
        ? {
            ...r,
            // O título não vem do modelo: o nome do modelo não é o nome do encontro (D78).
            categoria: !r.categoria || r.categoria === CATEGORIA_PADRAO ? m.categoria : r.categoria,
            // Com modelo, a duração em branco é a soma das etapas dele.
            duracao: r.duracao === DURACAO_PADRAO ? '' : r.duracao,
          }
        : {
            ...r,
            categoria: r.categoria || CATEGORIA_PADRAO,
            duracao: r.duracao || DURACAO_PADRAO,
          },
    )
  }

  function definirDias(novos: DataLocal[]) {
    const ordem = emOrdem(novos)
    setDias(ordem)
    // Dia que saiu perde a hora própria; a repetição só vale para um dia.
    setHorasDiferentes((h) =>
      Object.fromEntries(Object.entries(h).filter(([d]) => ordem.includes(d))),
    )
    if (ordem.length > 1) setRegra(regraVazia())
  }

  const salvar = useMutation({
    mutationFn: async ({
      dados,
      publicar,
      dias: escolhidos,
      tituloEscrito: escrito,
    }: PedidoDeCriacao) => {
      const base = naComunidade(comunidadeId)
      let localId = dados.local
      if (localId === LOCAL_NOVO) {
        const l = rascunho.novoLocal
        const novo = await api.post<{ id: string }>(`${base}/locais`, {
          nome: l.nome.trim(),
          tipo: l.tipo,
          endereco: l.endereco.trim() || null,
          referencia: l.referencia.trim() || null,
        })
        localId = novo.id
        // Se o passo seguinte falhar, tentar de novo não cadastra o local duas vezes.
        setRascunho((r) => ({ ...r, local: novo.id }))
        await consultas.invalidateQueries({ queryKey: CHAVES.locais(comunidadeId) })
      }
      const semTitulo: Omit<Corpo, 'titulo'> = {
        categoria: dados.categoria,
        descricao: dados.descricao,
        localId,
        visibilidade: dados.visibilidade,
        capacidade: dados.capacidade,
        informacoesUteis: dados.informacoesUteis,
        ...(dados.duracaoMin !== undefined ? { duracaoMin: dados.duracaoMin } : {}),
        ...(modelo ? { modelo } : {}),
      }
      const corpo: Corpo = { ...semTitulo, titulo: dados.titulo }
      // Vários dias: um encontro por dia, todos de uma vez, tudo ou nada (D78).
      if (escolhidos.length > 1) {
        const r = await api.post<{ eventos: { id: string }[] }>(`${base}/eventos/em-lote`, {
          ...semTitulo,
          ...(escrito ? { titulo: escrito } : {}),
          publicar,
          dias: escolhidos,
        })
        return { tipo: 'lote' as const, quantos: r.eventos.length }
      }
      const { regra: regraDaSerie } = regraDoRascunho(regra, dados.data)
      if (regraDaSerie) {
        const fim = regra.fim.trim() ? lerDataDigitada(regra.fim) : null
        const r = await api.post<{ id: string; ocorrencias: number }>(`${base}/series`, {
          ...corpo,
          regra: regraDaSerie,
          horaLocal: dados.hora,
          inicioEm: dados.data,
          fimEm: fim,
          publicar,
        })
        return { tipo: 'serie' as const, id: r.id }
      }
      const r = await api.post<{ id: string }>(`${base}/eventos`, {
        ...corpo,
        inicio: dados.inicio,
        listaDeEspera: dados.listaDeEspera,
        inscricaoAte: dados.inscricaoAte,
      })
      if (publicar) await api.post(`${base}/eventos/${r.id}/status`, { status: 'publicado' })
      return { tipo: 'evento' as const, id: r.id }
    },
    onSuccess: async (r) => {
      await invalidar()
      liberar()
      if (r.tipo === 'lote') {
        mostrarToast({
          texto: `${r.quantos} encontros criados: ${dias.map(rotuloCurtoDoDia).join(', ')}.`,
        })
        router.replace({ pathname: '/agenda', params: { vista: 'lista' } })
      } else if (r.tipo === 'serie')
        router.replace({ pathname: '/serie/[serieId]', params: { serieId: r.id } })
      else router.replace({ pathname: '/evento/[eventoId]', params: { eventoId: r.id } })
    },
    onError: trava.soltar,
  })

  async function enviar(publicar: boolean) {
    // O título nunca vai vazio: sem o da pessoa, o nome do dia (D78).
    const { erros: novos, dados } = validarRascunho(
      { ...rascunho, titulo: tituloEfetivo ?? sugestao, data: primeira ?? '' },
      { fuso, duracaoOpcional: !!modelo },
    )
    const fimInvalido = regra.repeticao !== 'nao' && regra.fim.trim() && !lerDataDigitada(regra.fim)
    setErroDoFim(fimInvalido ? 'Escolha o dia em que a repetição acaba.' : null)
    setErros(novos)
    focarPrimeiroErro(novos, refs)
    if (!dados || fimInvalido) return
    const horas = dias.map((d) => ({ data: d, hora: horaDoDia(d, horasDiferentes, dados.hora) }))
    if (publicar && horas.some((h) => dataJaPassou(instanteDeDataEHora(h.data, h.hora, fuso)))) {
      const ok = await confirmar({
        titulo: 'Esta data já passou',
        mensagem:
          'O início marcado é anterior a agora: confira o dia e o ano. Publicado, o encontro aparece para todos da comunidade.',
        confirmar: 'Publicar mesmo assim',
      })
      if (!ok) return
    }
    if (ocupados.length > 0) {
      const ok = await confirmar({
        titulo: varios ? 'Já existe encontro nesses dias' : 'Já existe um encontro neste dia',
        mensagem: varios
          ? `${avisoDeDiasOcupados(ocupados)} Criar outros mesmo assim?`
          : perguntaDeDataOcupada(ocupados),
        confirmar: varios ? 'Criar outros mesmo assim' : 'Criar outro mesmo assim',
      })
      if (!ok) return
    }
    // Uma programação por envio: o segundo toque, antes da resposta, não cria outra.
    if (!trava.pegar()) return
    salvar.mutate({ dados, publicar, dias: horas, tituloEscrito: tituloEfetivo })
  }

  const resumo = resumoDosErros(Object.keys(erros).length + (erroDoFim ? 1 : 0))
  const diferentes = quantosComHoraDiferente(dias, horasDiferentes, rascunho.hora)

  const quando = (
    <>
      <CalendarioDeVariosDias
        selecionados={dias}
        aoAlternar={(d) => definirDias(alternarDia(dias, d))}
        aoDefinir={definirDias}
        hoje={hojeNoFuso(fuso)}
      />
      <TextoAnunciado soMudancas variante="corpo" peso="medio">
        {resumoDosDias(dias)}
      </TextoAnunciado>
      {erros.data ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
          <Icone nome="erroDeCampo" cor={cores.erro} tamanho={16} />
          <Texto variante="legenda" style={{ flex: 1 }}>
            Escolha pelo menos um dia no calendário.
          </Texto>
        </View>
      ) : null}
      <CampoDeHora
        rotulo={varios ? 'Hora (a mesma em todos)' : 'Hora'}
        valor={rascunho.hora || null}
        aoMudar={(v) => mudar('hora', v)}
        erro={erros.hora ?? null}
      />
      {varios ? (
        <Acordeao
          rotuloRecolhido={`Horários diferentes${diferentes ? `, ${diferentes} com hora própria` : ''}. Recolhido, toque para ajustar.`}
          rotuloAberto="Horários diferentes. Aberto, toque para recolher."
          cabecalho={() => (
            <Texto variante="tituloItem">
              {diferentes ? `Horários diferentes (${diferentes})` : 'Horários diferentes'}
            </Texto>
          )}
        >
          <View style={{ gap: ESPACO.e12 }}>
            {dias.map((d) => (
              <CampoDeHora
                key={d}
                rotulo={resumoDosDias([d])}
                valor={horaDoDia(d, horasDiferentes, rascunho.hora) || null}
                aoMudar={(v) => setHorasDiferentes((h) => ({ ...h, [d]: v }))}
              />
            ))}
          </View>
        </Acordeao>
      ) : null}
    </>
  )

  return (
    <Tela
      pilha
      titulo="Novo encontro"
      barraDeAcao={
        <BarraDeAcao solta>
          <Botao
            titulo="Salvar rascunho"
            variante="secundario"
            tamanho="grande"
            dica={
              ehSerie
                ? 'Cria a repetição com as datas em rascunho. Só a organização vê.'
                : 'Só a organização vê rascunhos.'
            }
            carregando={salvar.isPending && !salvar.variables?.publicar}
            desabilitado={salvar.isPending}
            aoPressionar={() => void enviar(false)}
          />
          <Botao
            titulo="Publicar"
            tamanho="grande"
            dica={
              ehSerie
                ? 'Cria a repetição e publica as datas. Todos da comunidade passam a ver.'
                : varios
                  ? 'Cria os encontros e publica. Todos da comunidade passam a ver.'
                  : 'Todos da comunidade passam a ver.'
            }
            carregando={salvar.isPending && !!salvar.variables?.publicar}
            desabilitado={salvar.isPending}
            aoPressionar={() => void enviar(true)}
          />
        </BarraDeAcao>
      }
    >
      {resumo ? (
        <AvisoDeFalha titulo={resumo} mensagem="As mensagens estão junto de cada campo." />
      ) : null}
      {salvar.error ? <AvisoDeFalha erro={salvar.error} titulo="O encontro não foi salvo" /> : null}
      {ocupados.length > 0 ? (
        <Aviso
          tipo="alerta"
          titulo={varios ? 'Já existe encontro nesses dias' : 'Já existe encontro neste dia'}
        >
          {varios
            ? `${avisoDeDiasOcupados(ocupados)} Se criar estes também, a Agenda terá os dois.`
            : `${avisoDeDataOcupada(ocupados)} Se criar este também, a Agenda terá os dois.`}
        </Aviso>
      ) : null}

      {escolherModelo ? (
        <Secao titulo="Começar de">
          {modelos.isPending ? (
            <Esqueleto rotulo="Carregando os modelos">
              <CartaoDeEsqueleto />
            </Esqueleto>
          ) : modelos.error ? (
            <AvisoDeFalha
              erro={modelos.error}
              titulo="Os modelos não carregaram"
              aoTentarDeNovo={() => void modelos.refetch()}
            />
          ) : (
            <CartaoDeVidro opaco>
              <ListaDeOpcoes
                rotulo="Modelo"
                valor={modelo}
                aoMudar={trocarModelo}
                opcoes={[
                  { valor: '', rotulo: 'Em branco', descricao: 'Você monta as etapas depois.' },
                  ...embutidos.map((m) => ({
                    valor: m.chave,
                    rotulo: m.nome,
                    descricao: `${m.etapas.length} etapas, ${formatarDuracao(duracaoTotal(m.etapas))}.`,
                  })),
                  ...daComunidade.map((m) => ({
                    valor: m.id,
                    rotulo: m.nome,
                    descricao: `Da comunidade. ${m.etapas.length} etapas, ${formatarDuracao(duracaoTotal(m.etapas))}.`,
                  })),
                ]}
              />
            </CartaoDeVidro>
          )}
        </Secao>
      ) : null}

      <CamposDoEvento
        comunidadeId={comunidadeId}
        rascunho={rascunho}
        mudar={mudar}
        erros={erros}
        refs={refs}
        simples
        quando={quando}
        titulo={{
          valor: valorDoTitulo,
          aoMudar: (v) => {
            mudar('titulo', v)
            setTituloEscrito(true)
          },
          exemplo: sugestao,
          ajuda: ajudaDoTituloEmBranco(dias),
        }}
        abrirOpcoes={!!erroDoFim}
        visiveis={{ data: true, inscricoes: true, prazoEEspera: !ehSerie && !varios }}
        extraNasOpcoes={
          <>
            <Secao titulo="Repetição">
              <CartaoDeVidro opaco intervalo={ESPACO.e16}>
                {varios ? (
                  <Texto variante="corpo" cor="textoSuave">
                    A repetição vale para um dia só. Deixe só um dia marcado para repetir toda
                    semana.
                  </Texto>
                ) : (
                  <EditorDeRegra
                    regra={regra}
                    aoMudar={setRegra}
                    primeira={primeira}
                    hora={rascunho.hora || null}
                    erroDoFim={erroDoFim}
                  />
                )}
              </CartaoDeVidro>
            </Secao>
            {ehSerie ? (
              <Aviso tipo="info" titulo="Encontros que se repetem">
                Cada data vira um encontro próprio, que você pode editar sozinho depois. Prazo e
                lista de espera valem por data e são ajustados em cada uma.
              </Aviso>
            ) : null}
            {varios ? (
              <Aviso tipo="info" titulo="Encontros independentes">
                Cada dia vira um encontro próprio, que você edita sozinho depois. Prazo de inscrição
                e lista de espera são ajustados em cada um.
              </Aviso>
            ) : null}
          </>
        }
        {...(etapasDoModelo
          ? {
              ajudaDaDuracao: `Em branco, usa a soma das etapas do modelo (${formatarDuracao(duracaoTotal(etapasDoModelo))}).`,
            }
          : {})}
      />
    </Tela>
  )
}
