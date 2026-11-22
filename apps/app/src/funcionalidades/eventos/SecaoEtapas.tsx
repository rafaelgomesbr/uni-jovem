import { useMutation, useQueryClient } from '@tanstack/react-query'
import { duracaoTotal } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { DetalheDoEvento, Etapa } from '@/servicos/contratoDosEventos'
import { Acordeao } from '@/ui/Acordeao'
import { anunciar } from '@/ui/anunciar'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { BotoesDeOrdem, mover } from '@/ui/BotoesDeOrdem'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha } from '@/ui/Falha'
import { FolhaNaTela } from '@/ui/FolhaNaTela'
import { LARGURA_DA_HORA, Lista, RECUO_DA_LISTA } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import { formatarDuracao, formatarHora } from '@/utilidades/datas'

import { usePode } from '../comunidade/permissoes'
import { naComunidade, useInvalidarEventos } from './consultas'
import { FolhaDeConvocar, useTirarDaConvocacao } from './Convocacao'
import { useConvocadosEmEspera, useRemovidasEmEspera } from './convocadosOtimistas'
import { montarQuemVai, type PessoaNaLista } from './listaDeQuemVai'
import { LinhaDaPessoaNaEquipe } from './QuemVai'
import { reordenarEtapas } from './regras'

interface Props {
  evento: DetalheDoEvento
  comunidadeId: string
  /** Estado vazio de quem não monta etapas: volta para o resumo. */
  aoVerVisaoGeral: () => void
}

/**
 * Roteiro (D78): cada etapa é um ACORDEÃO na própria aba, sem abrir outra tela. Fechada, mostra a
 * hora, o nome e "15 min · Com Ana, Bruno". Aberta, mostra a descrição e quem cuida; quem organiza
 * edita ali mesmo (nome, duração e descrição, "Salvar etapa"), sobe e desce a etapa, chama e tira
 * gente e tem o botão de texto "Remover etapa". No fim, o total e "Adicionar etapa".
 */
export function SecaoEtapas({ evento, comunidadeId, aoVerVisaoGeral }: Props) {
  const pode = usePode()
  const gerenciar = pode('etapa', 'gerenciar')
  const [adicionando, setAdicionando] = useState(false)
  const base = `${naComunidade(comunidadeId)}/eventos/${evento.id}`
  const invalidar = useInvalidarEventos(comunidadeId)
  const folha = gerenciar ? (
    <NovaEtapa
      aberta={adicionando}
      aoFechar={() => setAdicionando(false)}
      base={base}
      aoCriar={() => invalidar(evento.id)}
    />
  ) : null

  if (evento.etapas.length === 0) {
    return (
      <>
        <EstadoVazio
          icone="etapas"
          titulo="O roteiro ainda não foi montado."
          descricao={
            gerenciar
              ? 'Monte o roteiro com as etapas do encontro, cada uma com a sua duração.'
              : 'Quando a organização montar, ele aparece aqui.'
          }
          acao={
            gerenciar
              ? {
                  titulo: 'Adicionar etapa',
                  icone: 'adicionar',
                  aoPressionar: () => setAdicionando(true),
                }
              : {
                  titulo: 'Ver o resumo',
                  variante: 'secundario',
                  aoPressionar: aoVerVisaoGeral,
                }
          }
        />
        {folha}
      </>
    )
  }

  return (
    <>
      <CartaoDeVidro lista>
        <RoteiroDoEncontro
          evento={evento}
          comunidadeId={comunidadeId}
          aoAdicionar={() => setAdicionando(true)}
        />
      </CartaoDeVidro>
      {folha}
    </>
  )
}

/**
 * As etapas como acordeões, dentro de um cartão lista (aqui ou dentro do acordeão "Roteiro" da
 * conferência). Sozinho, sem cartão: quem o usa põe a moldura.
 */
export function RoteiroDoEncontro({
  evento,
  comunidadeId,
  aoAdicionar,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
  /** Sem ele, a conferência usa o "Adicionar etapa" do próprio roteiro. */
  aoAdicionar?: () => void
}) {
  const pode = usePode()
  const consultas = useQueryClient()
  const invalidar = useInvalidarEventos(comunidadeId)
  const gerenciar = pode('etapa', 'gerenciar')
  const [adicionandoAqui, setAdicionandoAqui] = useState(false)
  const chave = CHAVES.evento(comunidadeId, evento.id)
  const base = `${naComunidade(comunidadeId)}/eventos/${evento.id}`

  const reordenar = useMutation({
    mutationFn: (ids: string[]) => api.put(`${base}/etapas/ordem`, { ids }),
    onMutate: async (ids) => {
      await consultas.cancelQueries({ queryKey: chave })
      const anterior = consultas.getQueryData<DetalheDoEvento>(chave)
      if (anterior) consultas.setQueryData(chave, reordenarEtapas(anterior, ids))
      return { anterior }
    },
    onError: (_erro, _ids, contexto) => {
      if (contexto?.anterior) consultas.setQueryData(chave, contexto.anterior)
    },
    onSettled: () => invalidar(evento.id),
  })

  function moverEtapa(de: number, para: number) {
    const etapa = evento.etapas[de]
    if (!etapa) return
    const ids = mover(
      evento.etapas.map((e) => e.id),
      de,
      para,
    )
    reordenar.mutate(ids)
    anunciar(`${etapa.titulo} agora é a etapa ${para + 1} de ${ids.length}.`)
  }

  const total = duracaoTotal(evento.etapas)
  const passou = evento.etapas.length > 0 && total > evento.duracaoMin
  const adicionar = aoAdicionar ?? (() => setAdicionandoAqui(true))

  return (
    <View>
      {reordenar.error ? <AvisoDeFalha erro={reordenar.error} titulo="A ordem não mudou" /> : null}
      {evento.etapas.map((etapa, i) => (
        <View key={etapa.id}>
          {i > 0 ? <Divisor /> : null}
          <EtapaEmAcordeao
            etapa={etapa}
            evento={evento}
            comunidadeId={comunidadeId}
            posicao={i}
            gerenciar={gerenciar}
            aoMover={moverEtapa}
          />
        </View>
      ))}
      <View style={{ paddingHorizontal: RECUO_DA_LISTA.texto, paddingVertical: ESPACO.e12 }}>
        <Texto variante="meta" cor="textoSuave" tabular>
          {`Total ${formatarDuracao(total)} de ${formatarDuracao(evento.duracaoMin)} previstos`}
        </Texto>
        {gerenciar ? (
          <View style={{ alignItems: 'flex-start' }}>
            <Botao
              titulo="Adicionar etapa"
              icone="adicionar"
              variante="terciario"
              alinhado
              aoPressionar={adicionar}
            />
          </View>
        ) : null}
      </View>
      {passou ? (
        <View style={{ paddingHorizontal: RECUO_DA_LISTA.texto, paddingBottom: ESPACO.e12 }}>
          <Aviso tipo="alerta" titulo="As etapas passam da duração">
            {`Somam ${formatarDuracao(total)}, mais que os ${formatarDuracao(evento.duracaoMin)} previstos. Ajuste as etapas ou a duração do encontro.`}
          </Aviso>
        </View>
      ) : null}
      {gerenciar && !aoAdicionar ? (
        <NovaEtapa
          aberta={adicionandoAqui}
          aoFechar={() => setAdicionandoAqui(false)}
          base={base}
          aoCriar={() => invalidar(evento.id)}
        />
      ) : null}
    </View>
  )
}

function Divisor() {
  const { cores } = useTema()
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        marginLeft: RECUO_DA_LISTA.texto,
        backgroundColor: cores.separador,
      }}
    />
  )
}

/** Uma etapa: o cabeçalho sempre à vista e, aberta, o que dá para ver e fazer ali mesmo. */
function EtapaEmAcordeao({
  etapa,
  evento,
  comunidadeId,
  posicao,
  gerenciar,
  aoMover,
}: {
  etapa: Etapa
  evento: DetalheDoEvento
  comunidadeId: string
  posicao: number
  gerenciar: boolean
  aoMover: (de: number, para: number) => void
}) {
  const quantas = evento.etapas.length
  const pessoas = evento.atribuicoes.filter((a) => a.etapaId === etapa.id)
  const hora = formatarHora(etapa.inicioPrevisto, evento.fuso)
  const horario = `${hora} a ${formatarHora(etapa.fimPrevisto, evento.fuso)}`
  const nomes = pessoas.map((p) => p.nome.split(' ')[0]).join(', ')
  const quem = pessoas.map((p) => `${p.nome} (${p.funcao})`).join(', ')
  const resumo = `${formatarDuracao(etapa.duracaoMin)} · ${nomes ? `Com ${nomes}` : 'Ninguém convocado'}`
  const falado = `Etapa ${posicao + 1} de ${quantas}: ${etapa.titulo}. Das ${horario}, ${formatarDuracao(etapa.duracaoMin)}.${quem ? ` Com ${quem}.` : ' Ninguém convocado.'}`
  return (
    <Acordeao
      recuo={RECUO_DA_LISTA.texto}
      rotuloRecolhido={`${falado} Recolhida, toque para ver.`}
      rotuloAberto={`${etapa.titulo}. Aberta, toque para recolher.`}
      cabecalho={() => (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e12 }}>
          <View style={{ minWidth: LARGURA_DA_HORA }}>
            <Texto variante="lista" tabular>
              {hora}
            </Texto>
          </View>
          <View style={{ flex: 1 }}>
            <Texto variante="tituloItem">{etapa.titulo}</Texto>
            <Texto variante="meta" cor="textoSuave">
              {resumo}
            </Texto>
          </View>
        </View>
      )}
    >
      <CorpoDaEtapa
        key={`${etapa.id}-${etapa.versao}`}
        etapa={etapa}
        evento={evento}
        comunidadeId={comunidadeId}
        posicao={posicao}
        gerenciar={gerenciar}
        aoMover={aoMover}
      />
    </Acordeao>
  )
}

function CorpoDaEtapa({
  etapa,
  evento,
  comunidadeId,
  posicao,
  gerenciar,
  aoMover,
}: {
  etapa: Etapa
  evento: DetalheDoEvento
  comunidadeId: string
  posicao: number
  gerenciar: boolean
  aoMover: (de: number, para: number) => void
}) {
  const pode = usePode()
  const invalidar = useInvalidarEventos(comunidadeId)
  const atribuir = pode('escala', 'atribuir')
  const [titulo, setTitulo] = useState(etapa.titulo)
  const [duracao, setDuracao] = useState(String(etapa.duracaoMin))
  const [descricao, setDescricao] = useState(etapa.descricao ?? '')
  const [erros, setErros] = useState<{ titulo?: string; duracao?: string }>({})
  const [convocando, setConvocando] = useState(false)
  const tirar = useTirarDaConvocacao(evento, comunidadeId)
  const emEspera = useConvocadosEmEspera(evento.id)
  const removidas = useRemovidasEmEspera()
  const base = `${naComunidade(comunidadeId)}/eventos/${evento.id}/etapas/${etapa.id}`

  const salvar = useMutation({
    mutationFn: (corpo: object) => api.patch(base, { versao: etapa.versao, ...corpo }),
    onSuccess: async () => {
      mostrarToast({ texto: 'Etapa salva.' })
      await invalidar(evento.id)
    },
  })
  const remover = useMutation({
    mutationFn: () => api.delete(base),
    onSuccess: async () => {
      mostrarToast({ texto: 'Etapa removida.' })
      await invalidar(evento.id)
    },
  })

  async function pedirRemocao() {
    const ok = await confirmar({
      titulo: `Remover a etapa ${etapa.titulo}?`,
      mensagem: 'As etapas seguintes sobem de posição e os horários são recalculados.',
      confirmar: 'Remover etapa',
      destrutivo: true,
    })
    if (ok) remover.mutate()
  }

  function enviar() {
    const minutos = Number(duracao)
    const novos = {
      ...(titulo.trim() ? {} : { titulo: 'Dê um nome à etapa.' }),
      ...(Number.isInteger(minutos) && minutos >= 1 && minutos <= 600
        ? {}
        : { duracao: 'Use de 1 a 600 minutos.' }),
    }
    setErros(novos)
    if (Object.keys(novos).length) return
    salvar.mutate({
      titulo: titulo.trim(),
      duracaoMin: minutos,
      descricao: descricao.trim() || null,
    })
  }

  const daEtapa = [
    ...evento.atribuicoes
      .filter((a) => !removidas.has(a.id))
      .map((a) => ({ ...a, emEspera: false })),
    ...emEspera.map((c) => ({
      id: c.chave,
      etapaId: c.etapaId,
      vinculoId: c.vinculoId,
      funcao: c.funcao,
      estado: 'pendente' as const,
      nome: c.nome,
      emEspera: true,
    })),
  ].filter((a) => a.etapaId === etapa.id)
  const { banda, equipe } = montarQuemVai(daEtapa, evento.etapas)
  const pessoas: PessoaNaLista[] = [...banda, ...equipe]
  const algumErro = !!(erros.titulo || erros.duracao)
  const mudou =
    titulo.trim() !== etapa.titulo ||
    Number(duracao) !== etapa.duracaoMin ||
    (descricao.trim() || null) !== (etapa.descricao ?? null)

  return (
    <View
      style={{
        paddingHorizontal: RECUO_DA_LISTA.texto,
        paddingBottom: ESPACO.e16,
        gap: ESPACO.e12,
      }}
    >
      {salvar.error ? <AvisoDeFalha erro={salvar.error} titulo="A etapa não foi salva" /> : null}
      {remover.error ? (
        <AvisoDeFalha erro={remover.error} titulo="A etapa não foi removida" />
      ) : null}

      {gerenciar ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e12 }}>
            <View style={{ flex: 2 }}>
              <Campo
                rotulo="Nome da etapa"
                value={titulo}
                onChangeText={setTitulo}
                erro={erros.titulo ?? null}
                maxLength={120}
                reservarApoio={algumErro}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Campo
                rotulo="Duração"
                value={duracao}
                onChangeText={(v) => setDuracao(v.replace(/\D/g, ''))}
                erro={erros.duracao ?? null}
                sufixo="min"
                keyboardType="number-pad"
                maxLength={3}
                reservarApoio={algumErro}
              />
            </View>
          </View>
          <Campo
            rotulo="Descrição"
            opcional
            value={descricao}
            onChangeText={setDescricao}
            multiline
            maxLength={2000}
          />
          <View style={{ alignItems: 'flex-start' }}>
            <Botao
              titulo="Salvar etapa"
              tamanho="compacto"
              variante="secundario"
              desabilitado={!mudou}
              carregando={salvar.isPending}
              rotuloAcessivel={`Salvar a etapa ${etapa.titulo}`}
              aoPressionar={enviar}
            />
          </View>
        </>
      ) : etapa.descricao ? (
        <Texto variante="corpo">{etapa.descricao}</Texto>
      ) : null}

      <Texto variante="rotulo" cor="textoSuave">
        Quem cuida
      </Texto>
      {pessoas.length ? (
        <Lista>
          {pessoas.map((p) => (
            <LinhaDaPessoaNaEquipe
              key={p.vinculoId}
              pessoa={p}
              aoTirar={atribuir ? () => tirar(p, p.papeis) : undefined}
            />
          ))}
        </Lista>
      ) : (
        <Texto variante="corpo" cor="textoSuave">
          Ninguém foi convocado ainda.
        </Texto>
      )}
      {atribuir ? (
        <View style={{ alignItems: 'flex-start' }}>
          <Botao
            titulo="Chamar alguém"
            icone="adicionar"
            variante="terciario"
            alinhado
            rotuloAcessivel={`Chamar alguém para ${etapa.titulo}`}
            aoPressionar={() => setConvocando(true)}
          />
        </View>
      ) : null}

      {gerenciar ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12 }}>
          <BotoesDeOrdem
            nome={etapa.titulo}
            posicao={posicao}
            total={evento.etapas.length}
            aoSubir={() => aoMover(posicao, posicao - 1)}
            aoDescer={() => aoMover(posicao, posicao + 1)}
          />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Botao
              titulo="Remover etapa"
              variante="destrutivo"
              tamanho="compacto"
              rotuloAcessivel={`Remover a etapa ${etapa.titulo}`}
              carregando={remover.isPending}
              aoPressionar={() => void pedirRemocao()}
            />
          </View>
        </View>
      ) : null}

      {atribuir ? (
        <FolhaDeConvocar
          evento={evento}
          etapa={etapa}
          comunidadeId={comunidadeId}
          aberta={convocando}
          aoFechar={() => setConvocando(false)}
        />
      ) : null}
    </View>
  )
}

/** "Adicionar etapa" numa folha: Nome e Duração lado a lado (2 para 1) e "Salvar etapa". */
function NovaEtapa({
  aberta,
  aoFechar,
  base,
  aoCriar,
}: {
  aberta: boolean
  aoFechar: () => void
  base: string
  aoCriar: () => Promise<void>
}) {
  const [titulo, setTitulo] = useState('')
  const [duracao, setDuracao] = useState('10')
  const [erros, setErros] = useState<{ titulo?: string; duracao?: string }>({})
  const criar = useMutation({
    mutationFn: (corpo: { titulo: string; duracaoMin: number }) =>
      api.post(`${base}/etapas`, corpo),
    onSuccess: aoCriar,
  })

  function salvar() {
    const minutos = Number(duracao)
    const novos = {
      ...(titulo.trim() ? {} : { titulo: 'Dê um nome à etapa.' }),
      ...(Number.isInteger(minutos) && minutos >= 1 && minutos <= 600
        ? {}
        : { duracao: 'Use de 1 a 600 minutos.' }),
    }
    setErros(novos)
    if (Object.keys(novos).length) return
    criar.mutate(
      { titulo: titulo.trim(), duracaoMin: minutos },
      {
        onSuccess: () => {
          mostrarToast({ texto: `Etapa ${titulo.trim()} adicionada.` })
          setTitulo('')
          setDuracao('10')
          aoFechar()
        },
      },
    )
  }

  const algumErro = !!(erros.titulo || erros.duracao)
  return (
    <FolhaNaTela aberta={aberta} titulo="Adicionar etapa" aoFechar={aoFechar}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e12 }}>
        <View style={{ flex: 2 }}>
          <Campo
            rotulo="Nome da etapa"
            value={titulo}
            onChangeText={setTitulo}
            erro={erros.titulo ?? null}
            exemplo="Louvor"
            maxLength={120}
            reservarApoio={algumErro}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Campo
            rotulo="Duração"
            value={duracao}
            onChangeText={setDuracao}
            erro={erros.duracao ?? null}
            sufixo="min"
            keyboardType="number-pad"
            maxLength={3}
            reservarApoio={algumErro}
          />
        </View>
      </View>
      {criar.error ? <AvisoDeFalha erro={criar.error} titulo="A etapa não foi salva" /> : null}
      <Botao
        titulo="Salvar etapa"
        tamanho="grande"
        larguraTotal
        carregando={criar.isPending}
        aoPressionar={salvar}
      />
    </FolhaNaTela>
  )
}
