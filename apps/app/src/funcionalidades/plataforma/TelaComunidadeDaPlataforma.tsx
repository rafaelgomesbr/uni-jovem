import { useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { ComunidadeDaPlataforma, ConviteCriado, EstadoDaComunidade } from '@/servicos/contrato'
import { confirmar } from '@/utilidades/confirmar'
import { formatarData } from '@/utilidades/formatos'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Texto } from '@/ui/Texto'

import { MarcaDaComunidade } from '../comunidade/Identidade'
import { LinkCompartilhavel } from '../comunidade/LinkCompartilhavel'
import { CHIP_DO_ESTADO_DA_COMUNIDADE, NOME_DO_ESTADO_DA_COMUNIDADE } from '../comunidade/nomes'
import { CabecalhoDeTela, Chip, Chips, TelaPropria } from '../comunidade/visual'
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
      <TelaPropria>
        <CabecalhoDeTela sobrancelha="Plataforma" titulo="Comunidade" />
        <ProvaDeSegundoFator
          motivo="Para abrir a comunidade"
          aoConfirmar={() => void comunidades.refetch()}
        />
      </TelaPropria>
    )
  }
  if (comunidades.isPending) {
    return (
      <TelaPropria>
        <Carregando texto="Carregando a comunidade" />
      </TelaPropria>
    )
  }
  if (comunidades.error) {
    return (
      <TelaPropria>
        <AvisoDeErro erro={comunidades.error} aoTentarDeNovo={() => void comunidades.refetch()} />
      </TelaPropria>
    )
  }
  if (!comunidade) {
    return (
      <TelaPropria>
        <Cartao>
          <EstadoVazio
            icone="plataforma"
            titulo="Comunidade não encontrada"
            descricao="Ela pode ter sido excluída."
            acao={{ titulo: 'Voltar para a Plataforma', aoPressionar: () => router.back() }}
          />
        </Cartao>
      </TelaPropria>
    )
  }
  return <CicloDeVida comunidade={comunidade} />
}

function CicloDeVida({ comunidade }: { comunidade: ComunidadeDaPlataforma }) {
  const consultas = useQueryClient()
  const [nomeDigitado, setNomeDigitado] = useState('')
  const [feito, setFeito] = useState<string | null>(null)
  const nome = comunidade.nome

  const mudar = useAcaoDePlataforma<unknown, Mudanca>({
    mutationFn: ({ estado, confirmacaoNome }) =>
      api.patch(`/api/v1/plataforma/comunidades/${comunidade.id}/estado`, {
        estado,
        ...(confirmacaoNome ? { confirmacaoNome } : {}),
      }),
    onSuccess: async (_r, m) => {
      setFeito(m.feito)
      setNomeDigitado('')
      await consultas.invalidateQueries({ queryKey: CHAVES.plataforma })
    },
  })

  async function pedir(m: Mudanca, titulo: string, mensagem: string, rotulo: string) {
    setFeito(null)
    const ok = await confirmar({ titulo, mensagem, confirmar: rotulo, destrutivo: true })
    if (ok) mudar.executar(m)
  }

  const nomeConfere = nomeDigitado.trim() === nome
  const executando = (estado: EstadoDaComunidade) =>
    mudar.executando && mudar.variaveis?.estado === estado
  const estado = NOME_DO_ESTADO_DA_COMUNIDADE[comunidade.estado]

  return (
    <TelaPropria>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e16 }}>
        <MarcaDaComunidade cor={comunidade.cor} tamanho={56} />
        <View style={{ flex: 1 }}>
          <CabecalhoDeTela sobrancelha="Plataforma" titulo={nome} />
        </View>
      </View>
      <Chips>
        <Chip
          texto={estado}
          icone={CHIP_DO_ESTADO_DA_COMUNIDADE[comunidade.estado].icone}
          tom={CHIP_DO_ESTADO_DA_COMUNIDADE[comunidade.estado].tom}
        />
        <Chip
          texto={`${comunidade.membrosAtivos} ${comunidade.membrosAtivos === 1 ? 'pessoa ativa' : 'pessoas ativas'}`}
          icone="comunidade"
        />
        <Chip
          texto={
            comunidade.adminsAtivos === 0
              ? 'Sem administrador'
              : `${comunidade.adminsAtivos} na administração`
          }
          icone="chave"
          tom={comunidade.adminsAtivos === 0 ? 'alerta' : 'neutro'}
        />
      </Chips>

      {comunidade.exclusaoAgendadaPara ? (
        <Aviso tipo="alerta" titulo="Exclusão agendada">
          {`Os dados serão apagados em ${formatarData(comunidade.exclusaoAgendadaPara)}. Até lá, dá para cancelar reativando a comunidade.`}
        </Aviso>
      ) : null}
      {feito ? (
        <Aviso tipo="sucesso" anunciar>
          {feito}
        </Aviso>
      ) : null}
      {mudar.erro ? <AvisoDeErro erro={mudar.erro} /> : null}

      <Cartao titulo="Situação" icone="plataforma" descricao={`Agora: ${estado}.`}>
        {comunidade.estado === 'ativa' ? (
          <>
            <Texto variante="legenda" cor="textoSuave">
              Suspensa: todo mundo consulta, ninguém altera, e as notificações param. Arquivada:
              some para os membros; só a exportação continua.
            </Texto>
            <Botao
              titulo={`Suspender ${nome}`}
              icone="pausar"
              variante="secundario"
              carregando={executando('suspensa')}
              aoPressionar={() =>
                void pedir(
                  { estado: 'suspensa', feito: `${nome} foi suspensa.` },
                  `Suspender ${nome}?`,
                  'A comunidade fica somente leitura e para de enviar notificações. Dá para reativar depois.',
                  'Suspender',
                )
              }
            />
            <Botao
              titulo={`Arquivar ${nome}`}
              icone="guardadoNoAparelho"
              variante="secundario"
              carregando={executando('arquivada')}
              aoPressionar={() =>
                void pedir(
                  { estado: 'arquivada', feito: `${nome} foi arquivada.` },
                  `Arquivar ${nome}?`,
                  'A comunidade some para os membros; só a exportação continua disponível. Dá para reativar depois.',
                  'Arquivar',
                )
              }
            />
          </>
        ) : (
          <Botao
            titulo={
              comunidade.estado === 'exclusao_agendada'
                ? `Cancelar a exclusão e reativar ${nome}`
                : `Reativar ${nome}`
            }
            icone="repetir"
            carregando={executando('ativa')}
            aoPressionar={() =>
              void pedir(
                { estado: 'ativa', feito: `${nome} está ativa de novo.` },
                `Reativar ${nome}?`,
                comunidade.estado === 'exclusao_agendada'
                  ? 'A exclusão é cancelada e a comunidade volta a funcionar normalmente.'
                  : 'A comunidade volta a funcionar normalmente para todos.',
                'Reativar',
              )
            }
          />
        )}
      </Cartao>

      <IntervencaoDeAdmin comunidade={comunidade} />

      {comunidade.estado !== 'exclusao_agendada' ? (
        <Cartao titulo="Agendar exclusão" icone="excluir">
          <Texto variante="corpo">
            Depois de 30 dias de carência, todos os dados de {nome} são apagados. Uma exportação é
            gerada antes para a administração. Até lá, dá para cancelar.
          </Texto>
          <Campo
            rotulo={`Para confirmar, digite o nome: ${nome}`}
            value={nomeDigitado}
            onChangeText={setNomeDigitado}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
          />
          <Botao
            titulo={`Agendar exclusão de ${nome}`}
            variante="destrutivo"
            icone="excluir"
            desabilitado={!nomeConfere}
            motivo="Digite o nome exato da comunidade para liberar."
            carregando={executando('exclusao_agendada')}
            aoPressionar={() =>
              void pedir(
                {
                  estado: 'exclusao_agendada',
                  confirmacaoNome: nomeDigitado.trim(),
                  feito: `Exclusão de ${nome} agendada para daqui a 30 dias.`,
                },
                `Agendar a exclusão de ${nome}?`,
                'Os dados serão apagados em 30 dias. Até lá, dá para cancelar reativando.',
                'Agendar exclusão',
              )
            }
          />
        </Cartao>
      ) : null}

      <PedidoDeCodigo prova={mudar.prova} motivo="Para mudar a situação da comunidade" />
    </TelaPropria>
  )
}

interface PedidoDeIntervencao {
  email: string | null
  motivo: string
}

/**
 * Intervenção: convite de administrador numa comunidade (ex.: ficou sem
 * admin). Motivo obrigatório; fica na auditoria da comunidade.
 */
function IntervencaoDeAdmin({ comunidade }: { comunidade: ComunidadeDaPlataforma }) {
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
    if (motivoOk && emailOk) convidar.executar({ motivo: m, email: e || null })
  }

  if (convidar.dados) {
    return (
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
          aoPressionar={() => {
            convidar.reiniciar()
            setMotivo('')
            setEmail('')
          }}
        />
      </>
    )
  }

  return (
    <Cartao
      titulo="Nomear administrador (intervenção)"
      icone="chave"
      descricao="Gera um convite de administrador. Use quando a comunidade ficou sem quem a administre."
    >
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
        rotulo="E-mail de quem vai administrar (opcional)"
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
      {convidar.erro ? <AvisoDeErro erro={convidar.erro} /> : null}
      <Botao
        titulo="Gerar convite de administrador"
        icone="convidar"
        variante="secundario"
        carregando={convidar.executando}
        aoPressionar={enviar}
      />
      <PedidoDeCodigo prova={convidar.prova} motivo="Para intervir na comunidade" />
    </Cartao>
  )
}
