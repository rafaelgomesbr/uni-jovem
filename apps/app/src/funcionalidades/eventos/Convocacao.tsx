import { useMutation } from '@tanstack/react-query'
import { ehEtapaDeLouvor, FUNCOES_DA_BANDA, type FuncaoDaBanda } from '@uj/dominio'
import { useState } from 'react'

import { api } from '@/servicos/api'
import type {
  Atribuicao,
  DetalheDoEvento,
  EstadoDaAtribuicao,
  Etapa,
} from '@/servicos/contratoDosEventos'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { AvisoDeFalha } from '@/ui/Falha'
import { FolhaNaTela, MenuDeAcoes } from '@/ui/FolhaNaTela'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { Segmentos } from '@/ui/Segmentos'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import { dataDoInstante } from '@/utilidades/datas'

import { usePode } from '../comunidade/permissoes'
import { SeletorDePessoa } from '../comunidade/SeletorDePessoa'
import { useDisponibilidade } from '../escalas/consultas'
import { naComunidade, useInvalidarEventos } from './consultas'

/**
 * Convocação (D54): a organização convoca, a pessoa aceita ou avisa que não
 * pode ir. Na API e no banco continua sendo "atribuição" e "escala"; só a
 * interface fala em convocação.
 */

/** Aviso fixo dos Convocados enquanto o encontro é rascunho (membro não vê rascunho). */
export const AVISO_DE_RASCUNHO = 'Rascunho: ninguém recebe a convocação até você publicar.'

/**
 * O toast depois de convocar diz o que de fato aconteceu: só o encontro
 * publicado e futuro dispara o aviso no celular (0011 e 0023).
 */
export function textoDepoisDeConvocar(evento: Pick<DetalheDoEvento, 'status' | 'inicio'>): string {
  if (evento.status === 'rascunho') {
    return 'Salvo. A pessoa recebe a convocação quando você publicar.'
  }
  if (evento.status === 'publicado' && new Date(evento.inicio).getTime() > Date.now()) {
    return 'Convocação enviada. A resposta aparece aqui.'
  }
  return 'Convocação salva. A resposta aparece aqui.'
}

const PARTES_DO_RESUMO: readonly {
  estado: EstadoDaAtribuicao
  um: string
  varios: string
}[] = [
  { estado: 'confirmada', um: 'aceitou', varios: 'aceitaram' },
  { estado: 'pendente', um: 'aguardando', varios: 'aguardando' },
  { estado: 'recusada', um: 'não pode ir', varios: 'não podem ir' },
  { estado: 'substituicao_pedida', um: 'pediu troca', varios: 'pediram troca' },
]

/**
 * "5 convocados: 3 aceitaram, 1 aguardando, 1 não pode ir". Só as partes com
 * alguém; nulo quando ninguém foi convocado.
 */
export function resumoDosConvocados(atribuicoes: readonly Pick<Atribuicao, 'estado'>[]) {
  const total = atribuicoes.length
  if (total === 0) return null
  const partes = PARTES_DO_RESUMO.map(({ estado, um, varios }) => {
    const n = atribuicoes.filter((a) => a.estado === estado).length
    return n > 0 ? `${n} ${n === 1 ? um : varios}` : null
  }).filter((p): p is string => p !== null)
  return `${total} ${total === 1 ? 'convocado' : 'convocados'}: ${partes.join(', ')}`
}

type Funcao = 'responsável' | 'integrante' | 'outra'

/**
 * Folha "Convocar pessoa": a função, a busca e a lista com quem avisou que não
 * pode naquele dia. Quem já está convocado no mesmo grupo (etapa ou evento
 * todo) aparece desabilitado, com "Já convocado".
 */
export function FolhaDeConvocar({
  evento,
  etapa,
  comunidadeId,
  aberta,
  aoFechar,
}: {
  evento: DetalheDoEvento
  etapa: Etapa | null
  comunidadeId: string
  aberta: boolean
  aoFechar: () => void
}) {
  const pode = usePode()
  const invalidar = useInvalidarEventos(comunidadeId)
  const [pessoa, setPessoa] = useState<string | null>(null)
  const [funcao, setFuncao] = useState<Funcao>(etapa ? 'responsável' : 'integrante')
  const [outra, setOutra] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  // Etapa do Louvor (D61): a função vem da lista padrão da banda, não de texto livre.
  const louvor = etapa !== null && ehEtapaDeLouvor(etapa.titulo)
  const [funcaoDaBanda, setFuncaoDaBanda] = useState<FuncaoDaBanda | null>(null)
  const dia = dataDoInstante(evento.inicio, evento.fuso)
  const disponibilidade = useDisponibilidade(comunidadeId, dia, dia, pode('disponibilidade', 'ler'))
  const indisponiveis = new Map(
    (disponibilidade.data ?? [])
      .filter((d) => !d.disponivel)
      .map((d) => [d.vinculo_id, d.observacao]),
  )
  const jaConvocados = new Set(
    evento.atribuicoes.filter((a) => a.etapaId === (etapa?.id ?? null)).map((a) => a.vinculoId),
  )
  const adicionar = useMutation({
    mutationFn: (corpo: object) =>
      api.post(`${naComunidade(comunidadeId)}/eventos/${evento.id}/atribuicoes`, corpo),
    onSuccess: () => invalidar(evento.id),
  })

  function enviar() {
    const pedeNome = louvor ? funcaoDaBanda === 'Outro' : funcao === 'outra'
    const nomeDaFuncao = pedeNome ? outra.trim() : louvor ? (funcaoDaBanda ?? '') : funcao
    if (louvor && !funcaoDaBanda) return setErro('Escolha a função na banda.')
    if (!pessoa) return setErro('Escolha a pessoa.')
    if (nomeDaFuncao.length < 2) return setErro('Diga qual é a função.')
    setErro(null)
    adicionar.mutate(
      { vinculoId: pessoa, etapaId: etapa?.id ?? null, funcao: nomeDaFuncao },
      {
        onSuccess: () => {
          mostrarToast({ texto: textoDepoisDeConvocar(evento) })
          setPessoa(null)
          setOutra('')
          aoFechar()
        },
      },
    )
  }

  return (
    <FolhaNaTela aberta={aberta} titulo="Convocar pessoa" aoFechar={aoFechar}>
      {louvor ? (
        <ListaDeOpcoes
          rotulo="Função na banda"
          valor={funcaoDaBanda}
          aoMudar={setFuncaoDaBanda}
          opcoes={FUNCOES_DA_BANDA.map((f) => ({ valor: f, rotulo: f }))}
        />
      ) : (
        <Segmentos
          rotulo="Função"
          valor={funcao}
          aoMudar={setFuncao}
          segmentos={[
            { valor: 'responsável', rotulo: 'Quem conduz' },
            { valor: 'integrante', rotulo: 'Quem ajuda' },
            { valor: 'outra', rotulo: 'Outra função' },
          ]}
        />
      )}
      {louvor ? (
        funcaoDaBanda === 'Outro' ? (
          <Campo
            rotulo="Nome da função"
            value={outra}
            onChangeText={setOutra}
            exemplo="Regência, percussão, backing"
            maxLength={60}
          />
        ) : null
      ) : funcao === 'outra' ? (
        <Campo
          rotulo="Nome da função"
          value={outra}
          onChangeText={setOutra}
          exemplo="Som, recepção, fotografia"
          maxLength={60}
        />
      ) : null}
      <SeletorDePessoa
        comunidadeId={comunidadeId}
        rotulo="Escolha a pessoa"
        valor={pessoa}
        aoMudar={setPessoa}
        motivoDesabilitada={(p) => (jaConvocados.has(p.vinculoId) ? 'Já convocado' : undefined)}
        observacao={(p) =>
          indisponiveis.has(p.vinculoId)
            ? `Avisou que não pode neste dia${indisponiveis.get(p.vinculoId) ? `: ${indisponiveis.get(p.vinculoId)}` : ''}`
            : undefined
        }
      />
      {erro ? <AvisoDeFalha mensagem={erro} titulo="Falta escolher" /> : null}
      {adicionar.error ? (
        <AvisoDeFalha erro={adicionar.error} titulo="A pessoa não foi convocada" />
      ) : null}
      <Botao
        titulo="Convocar"
        tamanho="grande"
        larguraTotal
        carregando={adicionar.isPending}
        aoPressionar={enviar}
      />
    </FolhaNaTela>
  )
}

/**
 * Menu de uma pessoa convocada (para quem convoca): "Tirar da convocação",
 * com confirmação. Aberto ao tocar na linha da pessoa.
 */
export function MenuDaPessoaConvocada({
  evento,
  comunidadeId,
  escolhida,
  aoFechar,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
  escolhida: Atribuicao | null
  aoFechar: () => void
}) {
  const invalidar = useInvalidarEventos(comunidadeId)
  const remover = useMutation({
    mutationFn: (id: string) =>
      api.delete(`${naComunidade(comunidadeId)}/eventos/${evento.id}/atribuicoes/${id}`),
    onSuccess: async () => {
      mostrarToast({ texto: 'A pessoa saiu da convocação.' })
      await invalidar(evento.id)
    },
  })

  async function pedirRemocao(a: Atribuicao) {
    const ok = await confirmar({
      titulo: `Tirar ${a.nome} da convocação?`,
      mensagem: 'A pessoa deixa de ver esta convocação entre as suas.',
      confirmar: 'Tirar da convocação',
      destrutivo: true,
    })
    if (ok) remover.mutate(a.id)
  }

  return (
    <>
      {remover.error ? <AvisoDeFalha erro={remover.error} titulo="A convocação não mudou" /> : null}
      <MenuDeAcoes
        aberto={escolhida !== null}
        titulo={escolhida?.nome ?? 'Pessoa'}
        aoFechar={aoFechar}
        acoes={
          escolhida
            ? [
                {
                  titulo: 'Tirar da convocação',
                  icone: 'excluir',
                  descricao: escolhida.funcao,
                  destrutiva: true,
                  aoPressionar: () => void pedirRemocao(escolhida),
                },
              ]
            : []
        }
      />
    </>
  )
}
