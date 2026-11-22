import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { abrirAjustes } from '@/servicos/notificacoesDoSistema'
import { Avatar } from '@/ui/Avatar'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { parametro } from '@/utilidades/parametros'
import { primeiroNome } from '@/utilidades/formatos'

import { pedirPermissaoEmContexto, usePermissaoDoSistema } from '../notificacoes/permissao'

export const AVISOS_LIGADOS = 'Avisos ligados.'
export const FALHA_AO_LIGAR_OS_AVISOS =
  'Não deu para ligar os avisos. Você pode ligar depois em Perfil, Notificações.'

interface PropsDasBoasVindas {
  /** O nome da comunidade em que a pessoa acabou de entrar. */
  comunidade: string
  cor?: string | undefined
  /** Quem criou a comunidade: a única ação é montar o primeiro encontro. */
  lider?: boolean
}

/**
 * Boas-vindas (UX v3, fluxo a e auditoria de 21/11, seção 8): um degrau ANTES do Início, uma só vez
 * por entrada (código, link, convite ou pedido aceito). Uma ação principal: o valor do app (ser
 * avisado de encontro e convocação) depende da permissão de notificação, que o sistema só pergunta
 * uma vez, então ela é pedida agora, depois de explicar. "Agora não" leva ao Início do mesmo
 * jeito. Sem termo nem formulário: o consentimento já foi dado na entrada.
 *
 * Para quem já liga os avisos o botão vira "Ver o próximo encontro"; no sistema que bloqueou, vira
 * "Abrir os ajustes"; na web (sem notificação), "Ir para o Início".
 */
export function BoasVindas({ comunidade, cor, lider = false }: PropsDasBoasVindas) {
  const { conta } = useSessao()
  const permissao = usePermissaoDoSistema()
  const [pedindo, setPedindo] = useState(false)
  const nome = primeiroNome(conta?.nome)

  async function ligar() {
    setPedindo(true)
    try {
      const resultado = await pedirPermissaoEmContexto()
      mostrarToast(
        resultado === 'concedida'
          ? { texto: AVISOS_LIGADOS }
          : { texto: FALHA_AO_LIGAR_OS_AVISOS, tipo: 'erro' },
      )
    } finally {
      setPedindo(false)
    }
    router.replace('/')
  }

  const principal = lider
    ? { titulo: 'Criar o encontro do sábado', aoPressionar: () => router.replace('/evento/novo') }
    : permissao === 'concedida'
      ? { titulo: 'Ver o próximo encontro', aoPressionar: () => router.replace('/') }
      : permissao === 'indisponivel'
        ? { titulo: 'Ir para o Início', aoPressionar: () => router.replace('/') }
        : permissao === 'negada'
          ? { titulo: 'Abrir os ajustes', aoPressionar: () => void abrirAjustes() }
          : { titulo: 'Ligar os avisos', aoPressionar: () => void ligar() }
  const comAgoraNao = !lider && permissao !== 'concedida' && permissao !== 'indisponivel'

  return (
    <Tela pilha semVoltar titulo={nome ? `Tudo pronto, ${nome}.` : 'Tudo pronto.'} momento="dia">
      <Cartao
        variante="momento"
        momento="dia"
        etiqueta="Bem-vindo"
        titulo={`Você entrou em ${comunidade}.`}
        acoes={
          <View style={{ gap: ESPACO.e8 }}>
            <Botao
              titulo={principal.titulo}
              tamanho="grande"
              larguraTotal
              carregando={pedindo}
              aoPressionar={principal.aoPressionar}
            />
            {comAgoraNao ? (
              <Botao
                titulo="Agora não"
                variante="terciario"
                aoPressionar={() => router.replace('/')}
              />
            ) : null}
          </View>
        }
      >
        <View style={{ gap: ESPACO.e12 }}>
          <Avatar nome={comunidade} {...(cor ? { cor } : {})} lado={56} decorativo />
          <Texto variante="corpo" cor="textoSuave">
            Quando a liderança marcar um encontro ou chamar você para servir, a gente avisa pelo
            celular.
          </Texto>
        </View>
      </Cartao>
    </Tela>
  )
}

/** Rota `/boas-vindas`: o nome da comunidade vem no parâmetro `comunidade`; sem ele, a ativa. */
export function TelaBoasVindas() {
  const { comunidadeAtiva } = useSessao()
  const parametros = useLocalSearchParams<{
    comunidade?: string | string[]
    lider?: string | string[]
  }>()
  const nome = parametro(parametros.comunidade) ?? comunidadeAtiva?.nome ?? 'a sua comunidade'
  return (
    <BoasVindas
      comunidade={nome}
      cor={comunidadeAtiva?.nome === nome ? comunidadeAtiva.cor : undefined}
      lider={parametro(parametros.lider) === '1'}
    />
  )
}
