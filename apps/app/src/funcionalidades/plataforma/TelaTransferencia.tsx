import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { confirmar } from '@/utilidades/confirmar'
import { formatarDataEHora } from '@/utilidades/formatos'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { useAcaoDePlataforma } from './acaoDePlataforma'
import { PedidoDeCodigo } from './ProvaDeSegundoFator'

/** Resposta de `GET /api/v1/eu/transferencia` (a API ainda não está no contrato comum). */
interface Transferencia {
  id: string
  deConta: string
  paraConta: string
  paraNome: string
  criadoEm: string
  efetivaApos: string
  aceitaEm: string | null
}

type Acao = 'aceitar' | 'cancelar' | 'concluir'

const CHAVE = [...CHAVES.eu, 'transferencia'] as const
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Transferência da propriedade da plataforma: o Criador inicia, o destino
 * aceita com o código do autenticador, há 72 h de espera (cancelável pelos
 * dois) e o Criador conclui. Cada passo vai para a auditoria.
 */
export function TelaTransferencia() {
  const { conta } = useSessao()
  const consultas = useQueryClient()
  const [email, setEmail] = useState('')
  const [erroDoEmail, setErroDoEmail] = useState<string | null>(null)
  // Momento em que a tela abriu: basta para saber se a espera de 72 h já passou.
  const [agora] = useState(Date.now)

  const aberta = useQuery({
    queryKey: CHAVE,
    queryFn: () =>
      api
        .get<{ transferencia: Transferencia | null }>('/api/v1/eu/transferencia')
        .then((r) => r.transferencia),
  })

  const atualizar = () => consultas.invalidateQueries({ queryKey: CHAVE })

  const iniciar = useAcaoDePlataforma<unknown, string>({
    mutationFn: (destino) => api.post('/api/v1/plataforma/transferencia', { email: destino }),
    onSuccess: async () => {
      setEmail('')
      mostrarToast({ texto: 'Transferência iniciada. Agora a outra conta precisa aceitar.' })
      await atualizar()
    },
  })

  const agir = useAcaoDePlataforma<unknown, Acao>({
    mutationFn: (acao) => api.post(`/api/v1/eu/transferencia/${acao}`),
    onSuccess: async (_r, acao) => {
      mostrarToast({
        texto:
          acao === 'aceitar'
            ? 'Você aceitou. A transferência pode ser concluída depois das 72 horas de espera.'
            : acao === 'cancelar'
              ? 'Transferência cancelada.'
              : 'Transferência concluída. A outra conta agora é a Criadora da plataforma.',
      })
      await Promise.all([atualizar(), consultas.invalidateQueries({ queryKey: CHAVES.eu })])
    },
  })

  async function pedir(acao: Acao, titulo: string, mensagem: string, rotulo: string) {
    const ok = await confirmar({
      titulo,
      mensagem,
      confirmar: rotulo,
      destrutivo: acao !== 'aceitar',
    })
    if (ok) agir.executar(acao)
  }

  async function comecar() {
    const destino = email.trim().toLowerCase()
    if (!EMAIL.test(destino)) {
      setErroDoEmail('Confira o e-mail: ele precisa ter o formato nome@exemplo.com.')
      return
    }
    setErroDoEmail(null)
    const ok = await confirmar({
      titulo: 'Iniciar a transferência?',
      mensagem: `A conta ${destino} vai poder aceitar ser a Criadora da plataforma. Depois do aceite, há 72 horas de espera antes de concluir.`,
      confirmar: 'Iniciar transferência',
      destrutivo: true,
    })
    if (ok) iniciar.executar(destino)
  }

  const t = aberta.data ?? null
  const souDestino = t !== null && t.paraConta === conta?.id
  const prazoPassou = t !== null && Date.parse(t.efetivaApos) <= agora

  return (
    <Tela
      pilha
      titulo="Transferir propriedade"
      descricao="O papel de Criador é único: aceite com o código do autenticador e 72 horas de espera, que qualquer um dos dois pode cancelar."
    >
      {iniciar.erro ? (
        <AvisoDeFalha erro={iniciar.erro} titulo="A transferência não começou" />
      ) : null}
      {agir.erro ? <AvisoDeFalha erro={agir.erro} titulo="A transferência não mudou" /> : null}

      {aberta.isPending ? (
        <Esqueleto rotulo="Procurando transferência em aberto">
          <CartaoDeEsqueleto />
        </Esqueleto>
      ) : aberta.error ? (
        <ErroDaTela erro={aberta.error} aoTentarDeNovo={() => void aberta.refetch()} />
      ) : t ? (
        <CartaoDeVidro
          sobrancelha={souDestino ? 'Transferência para você' : `Para ${t.paraNome}`}
          acoes={
            <View style={{ gap: ESPACO.e8 }}>
              {souDestino && !t.aceitaEm ? (
                <Botao
                  titulo="Aceitar"
                  rotuloAcessivel="Aceitar ser a Criadora da plataforma"
                  larguraTotal
                  carregando={agir.executando && agir.variaveis === 'aceitar'}
                  aoPressionar={() =>
                    void pedir(
                      'aceitar',
                      'Aceitar a transferência?',
                      'Você passa a ter o poder de plataforma depois das 72 horas de espera, quando a transferência for concluída.',
                      'Aceitar',
                    )
                  }
                />
              ) : null}
              {!souDestino && conta?.criador ? (
                <Botao
                  titulo="Concluir a transferência"
                  larguraTotal
                  desabilitado={!t.aceitaEm || !prazoPassou}
                  motivo={
                    !t.aceitaEm
                      ? 'A outra conta ainda não aceitou.'
                      : `Disponível a partir de ${formatarDataEHora(t.efetivaApos)}.`
                  }
                  carregando={agir.executando && agir.variaveis === 'concluir'}
                  aoPressionar={() =>
                    void pedir(
                      'concluir',
                      'Concluir a transferência?',
                      `${t.paraNome} passa a ser a Criadora da plataforma e você deixa de ter o poder de plataforma.`,
                      'Concluir',
                    )
                  }
                />
              ) : null}
              <Botao
                titulo={souDestino ? 'Recusar' : 'Cancelar a transferência'}
                variante="destrutivo"
                larguraTotal
                carregando={agir.executando && agir.variaveis === 'cancelar'}
                aoPressionar={() =>
                  void pedir(
                    'cancelar',
                    souDestino ? 'Recusar a transferência?' : 'Cancelar a transferência?',
                    'Nada muda: o papel de Criador continua com quem tem hoje.',
                    souDestino ? 'Recusar' : 'Cancelar transferência',
                  )
                }
              />
            </View>
          }
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
            <Chip
              texto={t.aceitaEm ? 'Aceita' : 'Sem aceite'}
              tom={t.aceitaEm ? 'sucesso' : 'alerta'}
            />
            <Chip
              texto={prazoPassou ? 'Espera cumprida' : 'Em espera'}
              tom={prazoPassou ? 'sucesso' : 'neutro'}
            />
          </View>
          <Texto variante="legenda" cor="textoSuave">
            {`Iniciada em ${formatarDataEHora(t.criadoEm)}. Pode ser concluída a partir de ${formatarDataEHora(t.efetivaApos)}${t.aceitaEm ? `; aceita em ${formatarDataEHora(t.aceitaEm)}.` : ', depois do aceite.'}`}
          </Texto>
        </CartaoDeVidro>
      ) : conta?.criador ? (
        <CartaoDeVidro
          sobrancelha="Iniciar transferência"
          opaco
          acoes={
            <Botao
              titulo="Iniciar transferência"
              variante="destrutivo"
              larguraTotal
              carregando={iniciar.executando}
              aoPressionar={() => void comecar()}
            />
          }
        >
          <Texto variante="corpo" cor="textoSuave">
            A conta de destino precisa existir, estar ativa e ter a verificação em duas etapas
            ligada.
          </Texto>
          <Campo
            rotulo="E-mail da conta de destino"
            value={email}
            onChangeText={setEmail}
            erro={erroDoEmail}
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
          />
        </CartaoDeVidro>
      ) : (
        <EstadoVazio
          icone="chave"
          titulo="Nenhuma transferência para você"
          descricao="Quando o Criador iniciar uma transferência para a sua conta, ela aparece aqui."
          acao={{ titulo: 'Voltar', variante: 'secundario', aoPressionar: () => router.back() }}
        />
      )}

      <PedidoDeCodigo prova={iniciar.prova} motivo="Para iniciar a transferência" />
      <PedidoDeCodigo prova={agir.prova} motivo="Para continuar a transferência" />
    </Tela>
  )
}
