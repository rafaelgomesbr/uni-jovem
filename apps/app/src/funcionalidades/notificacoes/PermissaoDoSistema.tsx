import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { abrirAjustes, NOTIFICACOES_DISPONIVEIS } from '@/servicos/notificacoesDoSistema'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Linha } from '@/ui/Linha'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'

import { pedirPermissaoEmContexto, usePermissaoDoSistema } from './permissao'

/** TC-09.v1: explicação antes do diálogo do sistema. */
export const EXPLICACAO_DAS_NOTIFICACOES = [
  'Avisamos quando você for escalado, quando um evento mudar ou for cancelado, quando pedirem substituição e quando sair um aviso da sua comunidade. Com o versículo do dia ligado, ele chega no horário que você escolher.',
  'Na tela bloqueada, assuntos pessoais aparecem com texto genérico. Pedidos de oração nunca viram notificação.',
  'Você escolhe os tipos e as comunidades em Perfil, Notificações.',
]

/**
 * Estado da permissão do sistema, separado da preferência no app. Quando
 * ainda não foi perguntado, explica o benefício e só então chama o sistema.
 * `ligadoNoApp` mostra a diferença "ligado no app, bloqueado no sistema".
 */
export function PermissaoDoSistema({ ligadoNoApp }: { ligadoNoApp: boolean }) {
  const estado = usePermissaoDoSistema()
  const [adiado, setAdiado] = useState(false)
  const [pedindo, setPedindo] = useState(false)

  if (!NOTIFICACOES_DISPONIVEIS || estado === 'indisponivel') {
    return (
      <Aviso tipo="info" titulo="Sem notificações aqui">
        Na web não há notificações. Avisos, escalas e o versículo do dia aparecem no Início; no
        celular, o app avisa você.
      </Aviso>
    )
  }
  if (estado === null) return <Carregando texto="Conferindo as notificações do aparelho" />

  if (estado === 'concedida') {
    return (
      <Linha
        icone="sino"
        titulo="Permitidas no sistema"
        descricao={
          ligadoNoApp
            ? 'Ligado no app e permitido no aparelho: as notificações chegam.'
            : 'O aparelho permite, mas você desligou no app.'
        }
        extra={<Selo texto="Permitidas" cor="sucesso" />}
      />
    )
  }

  if (estado === 'negada') {
    return (
      <View style={{ gap: ESPACO.e8 }}>
        <Linha
          icone="sinoDesligado"
          titulo={ligadoNoApp ? 'Ligado no app, bloqueado no sistema' : 'Bloqueadas no sistema'}
          descricao="O aparelho não deixa o Uni Jovem notificar. Para receber, permita nos Ajustes do aparelho. Enquanto isso, tudo aparece no Início."
          extra={<Selo texto="Bloqueadas" cor="alerta" />}
        />
        <Botao
          titulo="Abrir os Ajustes do aparelho"
          icone="ajustes"
          variante="secundario"
          aoPressionar={() => void abrirAjustes()}
        />
      </View>
    )
  }

  // Ainda não perguntado: explicação primeiro, diálogo do sistema só depois de "Ativar".
  if (adiado) {
    return (
      <View style={{ gap: ESPACO.e8 }}>
        <Texto variante="legenda" cor="textoSuave">
          Tudo bem. Nada se perde: tudo aparece no Início. Você pode ativar quando quiser.
        </Texto>
        <Botao
          titulo="Ativar notificações"
          icone="sino"
          variante="secundario"
          aoPressionar={() => setAdiado(false)}
        />
      </View>
    )
  }
  return (
    <View style={{ gap: ESPACO.e8 }}>
      <Texto variante="tituloItem">Quer ser avisado?</Texto>
      {EXPLICACAO_DAS_NOTIFICACOES.map((t) => (
        <Texto key={t} variante="corpo">
          {t}
        </Texto>
      ))}
      <Botao
        titulo="Ativar"
        icone="sino"
        carregando={pedindo}
        aoPressionar={() => {
          setPedindo(true)
          void pedirPermissaoEmContexto().finally(() => setPedindo(false))
        }}
      />
      <Botao titulo="Agora não" variante="terciario" aoPressionar={() => setAdiado(true)} />
    </View>
  )
}
