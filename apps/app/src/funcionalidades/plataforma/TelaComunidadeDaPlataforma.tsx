import { useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { ComunidadeDaPlataforma, ConviteCriado, EstadoDaComunidade } from '@/servicos/contrato'
import { Avatar } from '@/ui/Avatar'
import { Aviso } from '@/ui/Aviso'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { depoisDeFechar, FolhaNaTela, MenuDeAcoes } from '@/ui/FolhaNaTela'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Tela } from '@/ui/Tela'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import { formatarData } from '@/utilidades/formatos'

import { LinkCompartilhavel } from '../comunidade/LinkCompartilhavel'
import {
  CHIP_DO_ESTADO_DA_COMUNIDADE,
  NOME_CURTO_DO_ESTADO_DA_COMUNIDADE,
  NOME_DO_ESTADO_DA_COMUNIDADE,
} from '../comunidade/nomes'
import { useAcaoDePlataforma } from './acaoDePlataforma'
import { useComunidadesDaPlataforma } from './consultas'
import {
  exigeProvaDeSegundoFator,
  PedidoDeCodigo,
  ProvaDeSegundoFator,
} from './ProvaDeSegundoFator'

const MINIMO_DO_MOTIVO = 10
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Mudanca {
  estado: EstadoDaComunidade
  confirmacaoNome?: string
  /** O que aparece quando dá certo. */
  feito: string
}

export function TelaComunidadeDaPlataforma() {
  const { comunidadeId } = useLocalSearchParams<{ comunidadeId: string }>()
  const comunidades = useComunidadesDaPlataforma()
  const comunidade = comunidades.data?.find((c) => c.id === comunidadeId)

  if (exigeProvaDeSegundoFator(comunidades.error)) {
    return (
      <Tela pilha titulo="Comunidade">
        <ProvaDeSegundoFator
          motivo="Para abrir a comunidade"
          aoConfirmar={() => void comunidades.refetch()}
        />
      </Tela>
    )
  }
  if (comunidades.isPending) {
    return (
      <Tela pilha titulo="Comunidade">
        <Esqueleto rotulo="Carregando a comunidade">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Tela>
    )
  }
  if (comunidades.error) {
    return (
      <Tela pilha titulo="Comunidade">
        <ErroDaTela erro={comunidades.error} aoTentarDeNovo={() => void comunidades.refetch()} />
      </Tela>
    )
  }
  if (!comunidade) {
    return (
      <Tela pilha titulo="Comunidade">
        <EstadoVazio
          icone="plataforma"
          titulo="Comunidade não encontrada"
          descricao="Ela pode ter sido excluída."
          acao={{ titulo: 'Voltar para a Plataforma', aoPressionar: () => router.back() }}
        />
      </Tela>
    )
  }
  return <CicloDeVida comunidade={comunidade} />
}

/**
 * Comunidade da plataforma (3.6.3): a identidade, os números em cartão
 * lista e "Mais ações" numa folha (Suspender, Reativar, Nomear
 * administrador, Arquivar e, por último, "Agendar exclusão" em vermelho).
 * Cada ação pede confirmação e o código do autenticador.
 */
function CicloDeVida({ comunidade }: { comunidade: ComunidadeDaPlataforma }) {
  const consultas = useQueryClient()
  const [menu, setMenu] = useState(false)
  const [folha, setFolha] = useState<'exclusao' | 'intervencao' | null>(null)
  const nome = comunidade.nome

  const mudar = useAcaoDePlataforma<unknown, Mudanca>({
    mutationFn: ({ estado, confirmacaoNome }) =>
      api.patch(`/api/v1/plataforma/comunidades/${comunidade.id}/estado`, {
        estado,
        ...(confirmacaoNome ? { confirmacaoNome } : {}),
      }),
    onSuccess: async (_r, m) => {
      mostrarToast({ texto: m.feito })
      await consultas.invalidateQueries({ queryKey: CHAVES.plataforma })
    },
  })

  async function pedir(m: Mudanca, titulo: string, mensagem: string, rotulo: string) {
    const ok = await confirmar({ titulo, mensagem, confirmar: rotulo, destrutivo: true })
    if (ok) mudar.executar(m)
  }

  const ativa = comunidade.estado === 'ativa'
  const semAdmin = comunidade.adminsAtivos === 0
  const estado = NOME_CURTO_DO_ESTADO_DA_COMUNIDADE[comunidade.estado]

  return (
    <Tela
      pilha
      titulo={nome}
      descricao="Plataforma"
      acoes={
        <BotaoIcone
          icone="maisAcoes"
          rotulo="Mais ações"
          circular
          aoPressionar={() => setMenu(true)}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e16 }}>
        <Avatar nome={nome} cor={comunidade.cor} tamanho="comunidade" decorativo />
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
          <Chip texto={estado} tom={CHIP_DO_ESTADO_DA_COMUNIDADE[comunidade.estado].tom} />
          {semAdmin ? <Chip texto="Sem admin" tom="alerta" /> : null}
        </View>
      </View>

      {comunidade.exclusaoAgendadaPara ? (
        <Aviso tipo="alerta" titulo="Exclusão agendada">
          {`Os dados serão apagados em ${formatarData(comunidade.exclusaoAgendadaPara)}. Até lá, dá para cancelar reativando a comunidade, em Mais ações.`}
        </Aviso>
      ) : null}
      {mudar.erro ? <AvisoDeFalha erro={mudar.erro} titulo="A situação não mudou" /> : null}

      <CartaoDeVidro sobrancelha="Em números" lista>
        <Lista>
          <LinhaDeLista
            icone="pessoas"
            titulo="Pessoas ativas"
            valor={String(comunidade.membrosAtivos)}
          />
          <LinhaDeLista
            icone="chave"
            titulo="Na administração"
            {...(semAdmin
              ? { extra: <Chip texto="Sem admin" tom="alerta" /> }
              : { valor: String(comunidade.adminsAtivos) })}
          />
          <LinhaDeLista
            icone="plataforma"
            titulo="Situação"
            descricao={NOME_DO_ESTADO_DA_COMUNIDADE[comunidade.estado]}
          />
        </Lista>
      </CartaoDeVidro>

      <Intervencao
        comunidade={comunidade}
        aberta={folha === 'intervencao'}
        aoFechar={() => setFolha(null)}
      />

      <FolhaNaTela
        aberta={folha === 'exclusao'}
        titulo="Agendar exclusão"
        aoFechar={() => setFolha(null)}
      >
        <AgendarExclusao
          nome={nome}
          executando={mudar.executando && mudar.variaveis?.estado === 'exclusao_agendada'}
          aoConfirmar={(confirmacaoNome) => {
            // A folha sai antes: a confirmação e o pedido do código abrem por cima da tela.
            setFolha(null)
            depoisDeFechar(
              () =>
                void pedir(
                  {
                    estado: 'exclusao_agendada',
                    confirmacaoNome,
                    feito: `Exclusão de ${nome} agendada para daqui a 30 dias.`,
                  },
                  `Agendar a exclusão de ${nome}?`,
                  'Os dados serão apagados em 30 dias. Até lá, dá para cancelar reativando.',
                  'Agendar exclusão',
                ),
            )
          }}
        />
      </FolhaNaTela>

      <MenuDeAcoes
        aberto={menu}
        titulo="Mais ações"
        aoFechar={() => setMenu(false)}
        acoes={[
          ativa && {
            titulo: 'Suspender',
            icone: 'pausar',
            descricao: 'Todo mundo consulta, ninguém altera',
            aoPressionar: () =>
              void pedir(
                { estado: 'suspensa', feito: `${nome} foi suspensa.` },
                `Suspender ${nome}?`,
                'A comunidade fica somente leitura e para de enviar notificações. Dá para reativar depois.',
                'Suspender',
              ),
          },
          !ativa && {
            titulo:
              comunidade.estado === 'exclusao_agendada'
                ? 'Cancelar a exclusão e reativar'
                : 'Reativar',
            icone: 'repetir',
            aoPressionar: () =>
              void pedir(
                { estado: 'ativa', feito: `${nome} está ativa de novo.` },
                `Reativar ${nome}?`,
                comunidade.estado === 'exclusao_agendada'
                  ? 'A exclusão é cancelada e a comunidade volta a funcionar normalmente.'
                  : 'A comunidade volta a funcionar normalmente para todos.',
                'Reativar',
              ),
          },
          {
            titulo: 'Nomear administrador',
            icone: 'convidar',
            descricao: 'Convite de administrador, com motivo na auditoria',
            aoPressionar: () => setFolha('intervencao'),
          },
          ativa && {
            titulo: 'Arquivar',
            icone: 'guardadoNoAparelho',
            descricao: 'Some para os membros; só a exportação continua',
            aoPressionar: () =>
              void pedir(
                { estado: 'arquivada', feito: `${nome} foi arquivada.` },
                `Arquivar ${nome}?`,
                'A comunidade some para os membros; só a exportação continua disponível. Dá para reativar depois.',
                'Arquivar',
              ),
          },
          comunidade.estado !== 'exclusao_agendada' && {
            titulo: 'Agendar exclusão',
            icone: 'excluir',
            descricao: 'Os dados são apagados depois de 30 dias',
            destrutiva: true,
            aoPressionar: () => setFolha('exclusao'),
          },
        ]}
      />

      <PedidoDeCodigo prova={mudar.prova} motivo="Para mudar a situação da comunidade" />
    </Tela>
  )
}

/** Folha "Agendar exclusão": digitar o nome libera o destrutivo cheio. */
function AgendarExclusao({
  nome,
  executando,
  aoConfirmar,
}: {
  nome: string
  executando: boolean
  aoConfirmar: (confirmacaoNome: string) => void
}) {
  const [digitado, setDigitado] = useState('')
  const confere = digitado.trim() === nome
  return (
    <>
      <Aviso tipo="alerta" titulo="Depois de 30 dias, não dá para voltar">
        {`Todos os dados de ${nome} são apagados. Uma exportação é gerada antes para a administração. Até lá, dá para cancelar.`}
      </Aviso>
      <Campo
        rotulo={`Para confirmar, digite o nome: ${nome}`}
        value={digitado}
        onChangeText={setDigitado}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
      />
      <Botao
        titulo="Agendar exclusão"
        rotuloAcessivel={`Agendar exclusão de ${nome}`}
        tamanho="grande"
        variante="destrutivoCheio"
        larguraTotal
        desabilitado={!confere}
        motivo="Digite o nome exato da comunidade para liberar."
        carregando={executando}
        aoPressionar={() => aoConfirmar(digitado.trim())}
      />
    </>
  )
}

interface PedidoDeIntervencao {
  email: string | null
  motivo: string
}

/**
 * Intervenção: convite de administrador numa comunidade (ex.: ficou sem
 * admin), numa folha. Motivo obrigatório; fica na auditoria da comunidade.
 * O link aparece no cartão de destaque da tela.
 */
function Intervencao({
  comunidade,
  aberta,
  aoFechar,
}: {
  comunidade: ComunidadeDaPlataforma
  aberta: boolean
  aoFechar: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [email, setEmail] = useState('')
  const [erroDoMotivo, setErroDoMotivo] = useState<string | null>(null)
  const [erroDoEmail, setErroDoEmail] = useState<string | null>(null)

  const convidar = useAcaoDePlataforma<ConviteCriado, PedidoDeIntervencao>({
    mutationFn: (p) =>
      api.post<ConviteCriado>(`/api/v1/plataforma/comunidades/${comunidade.id}/convites`, {
        motivo: p.motivo,
        ...(p.email ? { email: p.email } : {}),
      }),
  })

  function enviar() {
    const m = motivo.trim()
    const e = email.trim().toLowerCase()
    const motivoOk = m.length >= MINIMO_DO_MOTIVO
    const emailOk = !e || EMAIL.test(e)
    setErroDoMotivo(
      motivoOk ? null : `Explique o motivo (pelo menos ${MINIMO_DO_MOTIVO} caracteres).`,
    )
    setErroDoEmail(emailOk ? null : 'Confira o e-mail: ele precisa ter o formato nome@exemplo.com.')
    if (!motivoOk || !emailOk) return
    // A folha sai antes: o pedido do código e o link aparecem por cima da tela.
    aoFechar()
    depoisDeFechar(() => convidar.executar({ motivo: m, email: e || null }))
  }

  return (
    <>
      {convidar.erro ? (
        <AvisoDeFalha erro={convidar.erro} titulo="O convite não foi gerado" />
      ) : null}
      {convidar.dados ? (
        <>
          <LinkCompartilhavel
            titulo={`Convite de administrador de ${comunidade.nome}`}
            papel="Administrador"
            link={convidar.dados.link}
            expiraEm={convidar.dados.expiraEm}
            emailDestino={convidar.variaveis?.email ?? null}
            mostrarQr
            mensagem={`Você foi convidado para administrar ${comunidade.nome} no ${NOME_DO_APP}. Abra o link para aceitar:`}
          />
          <Botao
            titulo="Fazer outra intervenção"
            variante="terciario"
            alinhado
            aoPressionar={() => {
              convidar.reiniciar()
              setMotivo('')
              setEmail('')
            }}
          />
        </>
      ) : null}
      <FolhaNaTela aberta={aberta} titulo="Nomear administrador" aoFechar={aoFechar}>
        <Campo
          rotulo="Motivo da intervenção"
          ajuda="Fica registrado na auditoria da comunidade."
          value={motivo}
          onChangeText={setMotivo}
          erro={erroDoMotivo}
          multiline
          maxLength={500}
        />
        <Campo
          rotulo="E-mail de quem vai administrar"
          opcional
          ajuda="Com e-mail, só essa pessoa consegue usar o convite."
          value={email}
          onChangeText={setEmail}
          erro={erroDoEmail}
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
        />
        <Botao
          titulo="Gerar convite"
          rotuloAcessivel="Gerar convite de administrador"
          tamanho="grande"
          larguraTotal
          carregando={convidar.executando}
          aoPressionar={enviar}
        />
      </FolhaNaTela>
      <PedidoDeCodigo prova={convidar.prova} motivo="Para intervir na comunidade" />
    </>
  )
}
