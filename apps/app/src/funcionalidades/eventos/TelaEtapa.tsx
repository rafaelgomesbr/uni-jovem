import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { Atribuicao, DetalheDoEvento, Etapa } from '@/servicos/contratoDosEventos'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { MenuDeAcoes } from '@/ui/FolhaNaTela'
import { Lista } from '@/ui/LinhaDeLista'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import { formatarDuracao, formatarHora } from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'
import { voltarOu } from '@/ui/navegacao'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { naComunidade, useEvento, useInvalidarEventos } from './consultas'
import { AVISO_DE_RASCUNHO, FolhaDeConvocar, MenuDaPessoaConvocada } from './Convocacao'
import { EQUIPE_GERAL, linhaDaPessoaEscalada } from './SecaoEquipe'

export { EQUIPE_GERAL }

/**
 * Rota `/evento/[eventoId]/etapa/[etapaId]` (3.4.4, "Etapa e equipe"): o
 * cartão "DETALHES" (nome, duração e descrição) com "Salvar" na barra, e o
 * cartão lista "CONVOCADOS" com "Convocar pessoa". Com `etapaId = geral`, os
 * convocados do evento todo.
 */
export function TelaEtapa() {
  const { comunidadeAtiva } = useSessao()
  const params = useLocalSearchParams<{ eventoId: string; etapaId: string }>()
  const eventoId = parametro(params.eventoId)
  const etapaId = parametro(params.etapaId)
  const evento = useEvento(comunidadeAtiva?.id ?? null, eventoId)

  if (!comunidadeAtiva || !eventoId || !etapaId) {
    return (
      <Tela pilha>
        <SemComunidade oQue="o encontro" />
      </Tela>
    )
  }
  if (evento.isPending) {
    return (
      <Tela pilha>
        <Esqueleto rotulo="Carregando a etapa">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Tela>
    )
  }
  if (evento.error) {
    return (
      <Tela pilha>
        <ErroDaTela erro={evento.error} aoTentarDeNovo={() => void evento.refetch()} />
      </Tela>
    )
  }
  const etapa = etapaId === EQUIPE_GERAL ? null : evento.data.etapas.find((e) => e.id === etapaId)
  if (etapa === undefined) {
    return (
      <Tela pilha>
        <EstadoVazio
          icone="etapas"
          titulo="Etapa não encontrada"
          descricao="Ela pode ter sido removida por outra pessoa."
          acao={{
            titulo: 'Voltar para o encontro',
            aoPressionar: () => voltarOu('/agenda'),
          }}
        />
      </Tela>
    )
  }
  return (
    <EtapaEEquipe
      key={etapa ? `${etapa.id}-${etapa.versao}` : EQUIPE_GERAL}
      etapa={etapa}
      evento={evento.data}
      comunidadeId={comunidadeAtiva.id}
    />
  )
}

function EtapaEEquipe({
  etapa,
  evento,
  comunidadeId,
}: {
  etapa: Etapa | null
  evento: DetalheDoEvento
  comunidadeId: string
}) {
  const pode = usePode()
  const invalidar = useInvalidarEventos(comunidadeId)
  const gerenciar = !!etapa && pode('etapa', 'gerenciar')
  const [titulo, setTitulo] = useState(etapa?.titulo ?? '')
  const [duracao, setDuracao] = useState(etapa ? String(etapa.duracaoMin) : '')
  const [descricao, setDescricao] = useState(etapa?.descricao ?? '')
  const [erros, setErros] = useState<{ titulo?: string; duracao?: string }>({})
  const [menu, setMenu] = useState(false)
  const base = etapa ? `${naComunidade(comunidadeId)}/eventos/${evento.id}/etapas/${etapa.id}` : ''

  const salvar = useMutation({
    mutationFn: (corpo: object) => api.patch(base, { versao: etapa?.versao, ...corpo }),
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
      voltarOu({ pathname: '/evento/[eventoId]', params: { eventoId: evento.id } })
    },
  })

  async function pedirRemocao() {
    if (!etapa) return
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

  const algumErro = !!(erros.titulo || erros.duracao)
  return (
    <Tela
      pilha
      titulo={etapa ? etapa.titulo : 'Encontro todo'}
      descricao={
        etapa
          ? `${evento.titulo} · das ${formatarHora(etapa.inicioPrevisto, evento.fuso)} às ${formatarHora(etapa.fimPrevisto, evento.fuso)}`
          : `Equipe de ${evento.titulo}`
      }
      {...(gerenciar
        ? {
            acoes: (
              <BotaoIcone
                icone="maisAcoes"
                rotulo="Mais ações"
                circular
                aoPressionar={() => setMenu(true)}
              />
            ),
            barraDeAcao: (
              <BarraDeAcao>
                <Botao
                  titulo="Salvar"
                  rotuloAcessivel="Salvar a etapa"
                  tamanho="grande"
                  carregando={salvar.isPending}
                  aoPressionar={enviar}
                />
              </BarraDeAcao>
            ),
          }
        : {})}
    >
      {salvar.error ? <AvisoDeFalha erro={salvar.error} titulo="A etapa não foi salva" /> : null}
      {remover.error ? (
        <AvisoDeFalha erro={remover.error} titulo="A etapa não foi removida" />
      ) : null}
      {gerenciar ? (
        <CartaoDeVidro sobrancelha="Detalhes" opaco intervalo={ESPACO.e16}>
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
        </CartaoDeVidro>
      ) : etapa ? (
        <CartaoDeVidro sobrancelha="Detalhes">
          <Texto variante="corpo">{`${formatarDuracao(etapa.duracaoMin)}${etapa.descricao ? `. ${etapa.descricao}` : ''}`}</Texto>
        </CartaoDeVidro>
      ) : null}
      <Equipe evento={evento} etapa={etapa} comunidadeId={comunidadeId} />
      {gerenciar ? (
        <MenuDeAcoes
          aberto={menu}
          titulo="Mais ações"
          aoFechar={() => setMenu(false)}
          acoes={[
            {
              titulo: 'Remover etapa',
              icone: 'excluir',
              descricao: 'As etapas seguintes sobem de posição',
              destrutiva: true,
              aoPressionar: () => void pedirRemocao(),
            },
          ]}
        />
      ) : null}
    </Tela>
  )
}

function Equipe({
  evento,
  etapa,
  comunidadeId,
}: {
  evento: DetalheDoEvento
  etapa: Etapa | null
  comunidadeId: string
}) {
  const pode = usePode()
  const [convocando, setConvocando] = useState(false)
  const [escolhida, setEscolhida] = useState<Atribuicao | null>(null)
  const atribuicoes = evento.atribuicoes.filter((a) => a.etapaId === (etapa?.id ?? null))
  const atribuir = pode('escala', 'atribuir')

  const convocar = atribuir ? (
    <Botao
      titulo="Convocar pessoa"
      icone="adicionar"
      variante="terciario"
      alinhado
      aoPressionar={() => setConvocando(true)}
    />
  ) : undefined

  return (
    <>
      {atribuir && evento.status === 'rascunho' ? (
        <Aviso tipo="info">{AVISO_DE_RASCUNHO}</Aviso>
      ) : null}
      {atribuicoes.length ? (
        <CartaoDeVidro sobrancelha="Convocados" lista {...(convocar ? { acoes: convocar } : {})}>
          <Lista>
            {atribuicoes.map((a) =>
              linhaDaPessoaEscalada(a, atribuir ? () => setEscolhida(a) : undefined),
            )}
          </Lista>
        </CartaoDeVidro>
      ) : (
        <CartaoDeVidro sobrancelha="Convocados" {...(convocar ? { acoes: convocar } : {})}>
          <Texto variante="corpo" cor="textoSuave">
            Ninguém convocado ainda.
          </Texto>
        </CartaoDeVidro>
      )}
      {atribuir ? (
        <>
          <FolhaDeConvocar
            evento={evento}
            etapa={etapa}
            comunidadeId={comunidadeId}
            aberta={convocando}
            aoFechar={() => setConvocando(false)}
          />
          <MenuDaPessoaConvocada
            evento={evento}
            comunidadeId={comunidadeId}
            escolhida={escolhida}
            aoFechar={() => setEscolhida(null)}
          />
        </>
      ) : null}
    </>
  )
}
