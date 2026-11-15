import { useMutation } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import { formatarQuando } from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { useFusoDaComunidade, useMeuVinculo } from '../comunidade/consultas'
import { SeletorDePessoa } from '../comunidade/SeletorDePessoa'
import { naComunidade } from '../eventos/consultas'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useInvalidarEscalas, useMinhasEscalas } from './consultas'

type Para = 'aberta' | 'pessoa'

/** Rota `/escalas/substituicao/[atribuicaoId]`: aberto à equipe ou para uma pessoa. */
export function TelaPedirSubstituicao() {
  const { comunidadeAtiva } = useSessao()
  const atribuicaoId = parametro(useLocalSearchParams<{ atribuicaoId: string }>().atribuicaoId)
  if (!comunidadeAtiva || !atribuicaoId) {
    return (
      <Tela cabecalhoNativo>
        <SemComunidade oQue="as suas escalas" />
      </Tela>
    )
  }
  return <PedirSubstituicao comunidadeId={comunidadeAtiva.id} atribuicaoId={atribuicaoId} />
}

function PedirSubstituicao({
  comunidadeId,
  atribuicaoId,
}: {
  comunidadeId: string
  atribuicaoId: string
}) {
  const fuso = useFusoDaComunidade()
  const eu = useMeuVinculo()
  const escalas = useMinhasEscalas(comunidadeId)
  const escala = escalas.data?.find((e) => e.id === atribuicaoId)
  const invalidar = useInvalidarEscalas(comunidadeId)
  const [para, setPara] = useState<Para>('aberta')
  const [pessoa, setPessoa] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const pedir = useMutation({
    mutationFn: () =>
      api.post(`${naComunidade(comunidadeId)}/atribuicoes/${atribuicaoId}/substituicao`, {
        motivo: motivo.trim() || null,
        paraVinculoId: para === 'pessoa' ? pessoa : null,
      }),
    onSuccess: async () => {
      await invalidar()
      router.back()
    },
  })

  return (
    <Tela cabecalhoNativo titulo="Pedir substituição">
      {escala ? (
        <Cartao>
          <Texto variante="corpoForte">{escala.eventoTitulo}</Texto>
          <Texto variante="apoio" cor="textoSuave">
            {[escala.etapaTitulo, escala.funcao, formatarQuando(escala.eventoInicio, fuso)]
              .filter(Boolean)
              .join(' · ')}
          </Texto>
        </Cartao>
      ) : null}
      <Cartao>
        <Texto variante="apoio" cor="textoSuave">
          Você continua na escala até alguém assumir. Quem assume fica registrado no seu lugar.
        </Texto>
        <GrupoDeOpcoes
          rotulo="Para quem"
          valor={para}
          aoMudar={setPara}
          opcoes={[
            {
              valor: 'aberta',
              rotulo: 'Aberto à equipe',
              descricao: 'Qualquer pessoa da comunidade pode assumir.',
            },
            {
              valor: 'pessoa',
              rotulo: 'Para uma pessoa',
              descricao: 'Só a pessoa escolhida pode assumir.',
            },
          ]}
        />
        {para === 'pessoa' ? (
          <SeletorDePessoa
            comunidadeId={comunidadeId}
            rotulo="Pessoa"
            valor={pessoa}
            aoMudar={setPessoa}
            excluir={eu ? [eu] : []}
          />
        ) : null}
        <Campo
          rotulo="Motivo (opcional)"
          value={motivo}
          onChangeText={setMotivo}
          multiline
          maxLength={500}
        />
        {erro ? <AvisoDeErro titulo="Falta escolher" mensagem={erro} /> : null}
        {pedir.error ? <AvisoDeErro erro={pedir.error} /> : null}
        <Botao
          titulo="Pedir substituição"
          icone="trocar"
          carregando={pedir.isPending}
          aoPressionar={() => {
            if (para === 'pessoa' && !pessoa) {
              setErro('Escolha para quem vai o pedido, ou deixe aberto à equipe.')
              return
            }
            setErro(null)
            pedir.mutate()
          }}
        />
      </Cartao>
    </Tela>
  )
}
