import { useQuery } from '@tanstack/react-query'
import { NOME_DO_PAPEL, type Papel } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ConsultaDeConvite, SituacaoDoConvite } from '@/servicos/contrato'
import { useTokenDoFragmento } from '@/utilidades/fragmento'
import { Avatar } from '@/ui/Avatar'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { AceitarComConta } from './AceitarComConta'
import { CadastroPorConvite } from './CadastroPorConvite'
import { lerConviteEmEspera } from './conviteEmEspera'

const SITUACAO: Readonly<Record<Exclude<SituacaoDoConvite, 'valido'>, [string, string]>> = {
  expirado: ['Este convite venceu', 'Peça um convite novo a quem administra a comunidade.'],
  revogado: ['Este convite foi cancelado', 'Peça um convite novo a quem administra a comunidade.'],
  usado: ['Este convite já foi usado', 'Cada convite vale para uma pessoa. Peça um convite novo.'],
  indisponivel: [
    'Convite indisponível',
    'A comunidade deste convite não está recebendo pessoas agora.',
  ],
  inexistente: [
    'Convite não encontrado',
    'Confira se o link chegou inteiro. Se continuar, peça um convite novo.',
  ],
}

interface PropsDoCartaoDoConvite {
  comunidade: { nome: string; cor: string }
  papel: Papel
  emailDestinoMascarado?: string | null
}

/**
 * O convite em destaque (3.1.2): avatar da comunidade de 56 à esquerda; à
 * direita, "Você foi convidado para", o nome em 24/28 e o chip do papel; e,
 * se houver, o e-mail a que o convite se destina.
 */
export function CartaoDoConvite({
  comunidade,
  papel,
  emailDestinoMascarado,
}: PropsDoCartaoDoConvite) {
  const nomeDoPapel = NOME_DO_PAPEL[papel]
  return (
    <CartaoDeDestaque>
      <View
        accessible
        accessibilityLabel={`Você foi convidado para ${comunidade.nome}, como ${nomeDoPapel}.${emailDestinoMascarado ? ` Convite para ${emailDestinoMascarado}.` : ''}`}
        style={{ gap: ESPACO.e12 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e16 }}>
          <Avatar nome={comunidade.nome} cor={comunidade.cor} tamanho="comunidade" decorativo />
          <View style={{ flex: 1, gap: ESPACO.e4 }}>
            <Texto variante="rotulo" cor="textoSuave">
              Você foi convidado para
            </Texto>
            <Texto variante="tituloCartao" accessibilityRole="text">
              {comunidade.nome}
            </Texto>
            <Chip texto={nomeDoPapel} tom={papel === 'admin' ? 'quente' : 'neutro'} />
          </View>
        </View>
        {emailDestinoMascarado ? (
          <Texto variante="legenda" cor="textoSuave">
            Convite para {emailDestinoMascarado}
          </Texto>
        ) : null}
      </View>
    </CartaoDeDestaque>
  )
}

/**
 * Convite (3.1.2): Aurora total e cabeçalho de pilha sem voltar (o link é a
 * entrada; com sessão aberta, o voltar aparece). Convite inválido vira estado
 * vazio em tela inteira com o primário "Ir para entrar".
 */
export function TelaConvite() {
  const tokenDoLink = useTokenDoFragmento()
  const [tokenGuardado] = useState(lerConviteEmEspera)
  const token = tokenDoLink ?? tokenGuardado
  const sessao = useSessao()
  const conectado = sessao.estado === 'autenticado'

  const consulta = useQuery({
    queryKey: ['convite', token],
    queryFn: () =>
      api.post<ConsultaDeConvite>('/api/auth/convite/consultar', { token }, { autenticado: false }),
    enabled: token !== null,
    staleTime: Infinity,
  })

  const sair = {
    titulo: conectado ? 'Ir para o Início' : 'Ir para entrar',
    aoPressionar: () => router.replace(conectado ? '/' : '/entrar'),
  }

  if (!token) {
    return (
      <Tela pilha semVoltar={!conectado} aurora={1}>
        <EstadoVazio
          icone="link"
          titulo="Link de convite incompleto"
          descricao="Abra de novo o link que você recebeu. Ele precisa chegar inteiro, do começo ao fim."
          telaInteira
          acao={sair}
        />
      </Tela>
    )
  }

  if (consulta.isPending) {
    return (
      <Tela pilha semVoltar={!conectado} aurora={1}>
        <Esqueleto rotulo="Abrindo o convite">
          <CartaoDeEsqueleto titulo />
        </Esqueleto>
      </Tela>
    )
  }

  if (consulta.error) {
    return (
      <Tela pilha semVoltar={!conectado} aurora={1}>
        <AvisoDeErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />
      </Tela>
    )
  }

  const convite = consulta.data
  if (convite.situacao !== 'valido' || !convite.comunidade || !convite.papel) {
    const [titulo, descricao] =
      SITUACAO[convite.situacao === 'valido' ? 'inexistente' : convite.situacao]
    return (
      <Tela pilha semVoltar={!conectado} aurora={1}>
        <EstadoVazio icone="link" titulo={titulo} descricao={descricao} telaInteira acao={sair} />
      </Tela>
    )
  }

  const cartao = (
    <CartaoDoConvite
      comunidade={convite.comunidade}
      papel={convite.papel}
      emailDestinoMascarado={convite.emailDestinoMascarado ?? null}
    />
  )
  return conectado ? (
    <AceitarComConta
      token={token}
      comunidade={convite.comunidade.nome}
      papel={NOME_DO_PAPEL[convite.papel]}
      cartaoDoConvite={cartao}
    />
  ) : (
    <CadastroPorConvite
      token={token}
      comunidade={convite.comunidade.nome}
      cartaoDoConvite={cartao}
    />
  )
}
