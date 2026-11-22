import { useMutation } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import { AvisoDeFalha } from '@/ui/Falha'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { useTravaDeEnvio, voltarOu } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { useFusoDaComunidade, useMeuVinculo } from '../comunidade/consultas'
import { SeletorDePessoa } from '../comunidade/SeletorDePessoa'
import { naComunidade } from '../eventos/consultas'
import { dataCurtaDoEncontro, nomeDaParte } from '../agenda/semanas'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useInvalidarEscalas, useMinhasEscalas } from './consultas'

type Para = 'aberta' | 'pessoa'

/** Rota `/escalas/substituicao/[atribuicaoId]`: "Preciso de alguém no meu lugar" (D69). */
export function TelaPedirSubstituicao() {
  const { comunidadeAtiva } = useSessao()
  const atribuicaoId = parametro(useLocalSearchParams<{ atribuicaoId: string }>().atribuicaoId)
  if (!comunidadeAtiva || !atribuicaoId) {
    return (
      <Tela pilha modal titulo="Preciso de alguém no meu lugar">
        <SemComunidade oQue="a sua parte" />
      </Tela>
    )
  }
  return <PedirSubstituicao comunidadeId={comunidadeAtiva.id} atribuicaoId={atribuicaoId} />
}

/**
 * "Preciso de alguém no meu lugar" (D69, seção 3.4): a parte em questão, as duas opções
 * ("Qualquer pessoa da comunidade" ou "Escolher uma pessoa", com a busca), o motivo opcional e
 * "Enviar pedido". Só existe depois de aceitar. Depois de enviar, o toast diz que a pessoa
 * continua na parte até alguém assumir: voltar calado deixava a pessoa sem saber se o pedido
 * saiu (U-12).
 */
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
  const trava = useTravaDeEnvio()

  const pedir = useMutation({
    mutationFn: () =>
      api.post(`${naComunidade(comunidadeId)}/atribuicoes/${atribuicaoId}/substituicao`, {
        motivo: motivo.trim() || null,
        paraVinculoId: para === 'pessoa' ? pessoa : null,
      }),
    onSuccess: async () => {
      mostrarToast({
        texto: 'Pedido enviado. Você continua na sua parte até alguém assumir.',
      })
      await invalidar()
      voltarOu('/agenda')
    },
    onError: trava.soltar,
  })

  function enviar() {
    if (para === 'pessoa' && !pessoa) {
      setErro('Escolha para quem vai o pedido, ou deixe para qualquer pessoa da comunidade.')
      return
    }
    setErro(null)
    if (trava.pegar()) pedir.mutate()
  }

  return (
    <Tela
      pilha
      modal
      titulo="Preciso de alguém no meu lugar"
      descricao="Você continua na sua parte até alguém assumir. Quem assumir fica no seu lugar."
      barraDeAcao={
        <BarraDeAcao solta>
          <Botao
            titulo="Enviar pedido"
            tamanho="grande"
            carregando={pedir.isPending}
            aoPressionar={enviar}
          />
        </BarraDeAcao>
      }
    >
      {escala ? (
        <CartaoDeVidro
          sobrancelha={`${dataCurtaDoEncontro(escala.eventoInicio, fuso)}`}
          comecaComTitulo
        >
          <Texto variante="tituloItem">{nomeDaParte(escala)}</Texto>
          <Texto variante="meta" cor="textoSuave">
            {escala.eventoTitulo}
          </Texto>
        </CartaoDeVidro>
      ) : null}
      <ListaDeOpcoes
        rotulo="Para quem"
        valor={para}
        aoMudar={(v) => {
          setPara(v)
          setErro(null)
        }}
        opcoes={[
          {
            valor: 'aberta',
            rotulo: 'Qualquer pessoa da comunidade',
            descricao: 'Quem puder primeiro assume o seu lugar.',
          },
          {
            valor: 'pessoa',
            rotulo: 'Escolher uma pessoa',
            descricao: 'Só a pessoa escolhida pode assumir.',
          },
        ]}
      />
      {para === 'pessoa' ? (
        <CartaoDeVidro opaco>
          <SeletorDePessoa
            comunidadeId={comunidadeId}
            rotulo="Pessoa"
            valor={pessoa}
            aoMudar={(v) => {
              setPessoa(v)
              setErro(null)
            }}
            excluir={eu ? [eu] : []}
          />
        </CartaoDeVidro>
      ) : null}
      <CartaoDeVidro opaco>
        <Campo
          rotulo="Motivo"
          opcional
          ajuda="Quem pode assumir lê esta mensagem."
          value={motivo}
          onChangeText={setMotivo}
          multiline
          maxLength={500}
          mostrarContador
        />
      </CartaoDeVidro>
      {erro ? (
        <Aviso tipo="erro" titulo="Falta escolher" anunciar>
          {erro}
        </Aviso>
      ) : null}
      {pedir.error ? <AvisoDeFalha erro={pedir.error} /> : null}
    </Tela>
  )
}
