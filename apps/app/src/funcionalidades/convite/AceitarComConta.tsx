import { useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useRef, useState, type ReactNode } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { FaixaEtaria } from '@/servicos/contratoDosModulos'
import { ehErroDaApi, mensagemDoErro } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { focar, type NoDeView } from '@/ui/foco'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import {
  ConsentimentoDeFe,
  MenorDe16,
  motivoDoConsentimento,
  PerguntaDeIdade,
} from './Consentimentos'
import { descartarConviteEmEspera } from './conviteEmEspera'

interface Props {
  token: string
  comunidade: string
  papel: string
  /** O convite em destaque, no topo. */
  cartaoDoConvite?: ReactNode
}

/** Erros da API que a tela resolve pedindo o que falta, em vez de só mostrar. */
const PEDE_IDADE = 'faixa_etaria_necessaria'
const PEDE_RESPONSAVEL = 'responsavel_necessario'
const JA_PARTICIPA = 'ja_participa'

/**
 * Erros que encerram o convite para esta conta: não adianta tocar de novo.
 * A tela troca o formulário por um estado claro, com a mensagem da API.
 */
const TITULO_DO_FIM: Readonly<Record<string, string>> = {
  convite_indisponivel: 'Este convite não vale mais',
  convite_de_outro_email: 'Este convite é para outro e-mail',
  conta_inativa: 'Sua conta não está ativa',
}

/**
 * Conta existente e conectada: confirma a entrada na comunidade do convite,
 * com o consentimento sobre a fé desta comunidade (TC-03). A idade (TC-01) só
 * é pedida se a conta ainda não declarou: a API avisa com `faixa_etaria_necessaria`.
 *
 * O botão "Entrar na comunidade" fica sempre ativo: tocar sem marcar mostra o
 * que falta junto da caixa e leva o foco até ela. Toda resposta de erro vira
 * aviso em linguagem humana, acima dos botões, nunca um toque sem efeito.
 */
export function AceitarComConta({ token, comunidade, papel, cartaoDoConvite }: Props) {
  const { conta } = useSessao()
  const consultas = useQueryClient()
  const [fe, setFe] = useState(false)
  const [precisaIdade, setPrecisaIdade] = useState(false)
  const [faixa, setFaixa] = useState<FaixaEtaria | null>(null)
  const [precisaResponsavel, setPrecisaResponsavel] = useState(false)
  const [responsavel, setResponsavel] = useState(false)
  // Tocou em entrar com algo faltando: a partir daí, o que falta aparece junto do campo.
  const [tentou, setTentou] = useState(false)
  const refDaFe = useRef<NoDeView>(null)
  const refDoResponsavel = useRef<NoDeView>(null)
  const pedirResponsavel = precisaResponsavel || faixa === '16_17'

  const aceitar = useMutation({
    mutationFn: () =>
      api.post<{ vinculoId: string }>('/api/auth/convite/aceitar', {
        token,
        consentimentoFe: fe,
        ...(precisaIdade && faixa ? { faixaEtaria: faixa } : {}),
        responsavelCiente: pedirResponsavel && responsavel,
      }),
    onSuccess: async () => {
      descartarConviteEmEspera()
      await consultas.invalidateQueries({ queryKey: CHAVES.eu })
    },
    onError: (erro) => {
      if (ehErroDaApi(erro, PEDE_IDADE)) setPrecisaIdade(true)
      if (ehErroDaApi(erro, PEDE_RESPONSAVEL)) {
        // A caixa do responsável aparece já com o aviso do que falta.
        setPrecisaResponsavel(true)
        setTentou(true)
      }
      // A sessão já sabe das comunidades da conta: a tela "já participa" usa a lista nova.
      if (ehErroDaApi(erro, JA_PARTICIPA)) void consultas.invalidateQueries({ queryKey: CHAVES.eu })
    },
  })

  if (aceitar.isSuccess) {
    return (
      <Tela pilha aurora={1} titulo="Pronto">
        <CartaoDeDestaque
          titulo={comunidade}
          descricao={`Agora você participa de ${comunidade} como ${papel}.`}
          acoes={<Botao titulo="Ir para o Início" aoPressionar={() => router.replace('/')} />}
        />
      </Tela>
    )
  }

  if (ehErroDaApi(aceitar.error, JA_PARTICIPA)) {
    return <JaParticipa comunidade={comunidade} />
  }

  const erroFinal = aceitar.error
  if (erroFinal && ehErroDaApi(erroFinal) && TITULO_DO_FIM[erroFinal.codigo]) {
    return (
      <Tela pilha aurora={1}>
        <EstadoVazio
          icone="link"
          titulo={TITULO_DO_FIM[erroFinal.codigo]!}
          descricao={mensagemDoErro(erroFinal)}
          telaInteira
          acao={{ titulo: 'Ir para o Início', aoPressionar: () => sair() }}
        />
      </Tela>
    )
  }

  const menor = precisaIdade && faixa === 'menos_16'
  const faltaIdade = precisaIdade && faixa === null
  const motivo = faltaIdade
    ? 'Responda quantos anos você tem.'
    : motivoDoConsentimento(fe, pedirResponsavel, responsavel)
  // Cada caixa mostra só o que falta nela (a idade tem o aviso próprio).
  const erroDaFe = tentou && !fe ? motivoDoConsentimento(false, false, false) : null
  const erroDoResponsavel =
    tentou && pedirResponsavel && !responsavel ? motivoDoConsentimento(true, true, false) : null
  // O pedido do que falta já aparece junto do campo; o erro da API, só quando for outro.
  const erroParaMostrar =
    aceitar.error &&
    !ehErroDaApi(aceitar.error, PEDE_IDADE) &&
    !ehErroDaApi(aceitar.error, PEDE_RESPONSAVEL)
      ? aceitar.error
      : null

  function entrar() {
    if (motivo) {
      setTentou(true)
      if (!faltaIdade) focar(!fe ? refDaFe : refDoResponsavel)
      return
    }
    aceitar.mutate()
  }

  return (
    <Tela
      pilha
      aurora={1}
      titulo="Você recebeu um convite"
      {...(conta ? { descricao: `Você está conectado como ${conta.email}.` } : {})}
      {...(menor
        ? {}
        : {
            barraDeAcao: (
              <BarraDeAcao
                aviso={
                  erroParaMostrar ? (
                    <Aviso tipo="erro" titulo="Não deu para entrar na comunidade" anunciar>
                      {mensagemDoErro(erroParaMostrar)}
                    </Aviso>
                  ) : null
                }
              >
                <Botao
                  titulo="Agora não"
                  variante="secundario"
                  tamanho="grande"
                  aoPressionar={() => sair()}
                />
                <Botao
                  titulo="Entrar na comunidade"
                  tamanho="grande"
                  rotuloAcessivel={`Entrar em ${comunidade} como ${papel}`}
                  aoPressionar={entrar}
                  carregando={aceitar.isPending}
                />
              </BarraDeAcao>
            ),
          })}
    >
      {cartaoDoConvite}
      {precisaIdade ? (
        <>
          <Texto variante="corpo">
            Antes de entrar na comunidade, informe a sua faixa de idade.
          </Texto>
          <PerguntaDeIdade valor={faixa} aoMudar={setFaixa} />
          {tentou && faltaIdade ? (
            <Aviso tipo="erro" titulo="Falta a sua idade" anunciar>
              Escolha uma das opções acima para entrar na comunidade.
            </Aviso>
          ) : null}
        </>
      ) : null}
      {menor ? (
        <MenorDe16 />
      ) : (
        <CartaoDeVidro>
          <ConsentimentoDeFe
            comunidade={comunidade}
            marcada={fe}
            aoMudar={setFe}
            pedirResponsavel={pedirResponsavel}
            responsavel={responsavel}
            aoMudarResponsavel={setResponsavel}
            erro={erroDaFe}
            erroDoResponsavel={erroDoResponsavel}
            refDaConcordancia={refDaFe}
            refDoResponsavel={refDoResponsavel}
          />
        </CartaoDeVidro>
      )}
    </Tela>
  )
}

function sair() {
  descartarConviteEmEspera()
  router.replace('/')
}

/**
 * A conta já participa da comunidade do convite: nada de consentimento nem de
 * aceite. Um estado claro e o atalho para abrir a comunidade (troca para ela e
 * vai ao Início). Sem a comunidade na lista da sessão, o atalho é o Início.
 */
export function JaParticipa({
  comunidade,
  comunidadeId,
}: {
  comunidade: string
  comunidadeId?: string | null
}) {
  const { comunidades, trocarComunidade } = useSessao()
  const id = comunidadeId ?? unicaComNome(comunidades, comunidade)?.id ?? null

  async function abrir() {
    if (id) await trocarComunidade(id)
    sair()
  }

  return (
    <Tela pilha aurora={1}>
      <EstadoVazio
        icone="confirmado"
        titulo={`Você já faz parte de ${comunidade}`}
        descricao="Este convite não precisa ser usado: a sua conta já participa desta comunidade."
        telaInteira
        acao={
          id
            ? { titulo: `Abrir ${comunidade}`, aoPressionar: () => void abrir() }
            : { titulo: 'Ir para o Início', aoPressionar: () => sair() }
        }
      />
    </Tela>
  )
}

/** A comunidade da sessão com este nome, se for uma só (nome repetido não decide nada). */
export function unicaComNome<T extends { nome: string }>(lista: readonly T[], nome: string) {
  const achadas = lista.filter((c) => c.nome === nome)
  return achadas.length === 1 ? achadas[0]! : null
}
