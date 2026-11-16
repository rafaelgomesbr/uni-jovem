import { ALTURA, RAIO } from '@uj/tokens'
import { useState } from 'react'

import { NOME_DO_APP } from '@/constantes'
import { abrirAjustes, NOTIFICACOES_DISPONIVEIS } from '@/servicos/notificacoesDoSistema'
import { Aviso } from '@/ui/Aviso'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { BlocoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { LinhaDeLista } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'

import { pedirPermissaoEmContexto, usePermissaoDoSistema } from './permissao'

/** TC-09.v1: explicação antes do diálogo do sistema. */
export const EXPLICACAO_DAS_NOTIFICACOES = [
  'Avisamos quando você for escalado, quando um encontro mudar ou for cancelado, quando pedirem substituição e quando sair um aviso da sua comunidade. Com o versículo do dia ligado, ele chega no horário que você escolher.',
  'Na tela bloqueada, assuntos pessoais aparecem com texto genérico. Pedidos de oração nunca viram notificação.',
  'Você escolhe os tipos e as comunidades em Perfil, Ajustes de notificação.',
]

/**
 * Permissão do SISTEMA, separada da preferência no app ("NESTE APARELHO",
 * 3.6.6). Cada estado é um bloco próprio, para ficar logo abaixo da
 * sobrancelha:
 * - permitida: linha com o chip "Permitidas";
 * - bloqueada: aviso de alerta com o terciário "Abrir os ajustes";
 * - ainda não perguntada: a explicação primeiro e o diálogo do sistema só
 *   depois de "Ativar" (TC-09).
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
  if (estado === null) {
    return (
      <Esqueleto rotulo="Conferindo as notificações do aparelho">
        <BlocoDeEsqueleto altura={ALTURA.linha} raio={RAIO.cartao} />
      </Esqueleto>
    )
  }

  if (estado === 'concedida') {
    return (
      <CartaoDeVidro lista>
        <LinhaDeLista
          icone="sino"
          titulo="Permitidas no sistema"
          descricao={
            ligadoNoApp
              ? 'Ligado no app e permitido no aparelho: as notificações chegam.'
              : 'O aparelho permite, mas você desligou no app.'
          }
          extra={<Chip texto="Permitidas" tom="sucesso" icone="check" />}
        />
      </CartaoDeVidro>
    )
  }

  if (estado === 'negada') {
    return (
      <Aviso
        tipo="alerta"
        titulo={
          ligadoNoApp
            ? 'Ligado no app, bloqueado no sistema'
            : 'As notificações estão bloqueadas nos ajustes do aparelho'
        }
        acao={{
          titulo: 'Abrir os ajustes',
          rotuloAcessivel: 'Abrir os Ajustes do aparelho',
          aoPressionar: () => void abrirAjustes(),
        }}
      >
        <Texto variante="legenda">
          {`O aparelho não deixa o ${NOME_DO_APP} notificar. Para receber, permita nos ajustes do aparelho. Enquanto isso, tudo aparece no Início.`}
        </Texto>
      </Aviso>
    )
  }

  // Ainda não perguntado: explicação primeiro, diálogo do sistema só depois de "Ativar".
  if (adiado) {
    return (
      <CartaoDeVidro
        acoes={
          <Botao
            titulo="Ativar notificações"
            variante="secundario"
            aoPressionar={() => setAdiado(false)}
          />
        }
      >
        <Texto variante="corpo" cor="textoSuave">
          Tudo bem. Nada se perde: tudo aparece no Início. Você pode ativar quando quiser.
        </Texto>
      </CartaoDeVidro>
    )
  }
  return (
    <CartaoDeVidro
      acoes={
        <ParDeBotoes>
          <Botao
            titulo="Ativar"
            carregando={pedindo}
            dica="Abre o pedido de permissão do aparelho."
            aoPressionar={() => {
              setPedindo(true)
              void pedirPermissaoEmContexto().finally(() => setPedindo(false))
            }}
          />
          <Botao titulo="Agora não" variante="terciario" aoPressionar={() => setAdiado(true)} />
        </ParDeBotoes>
      }
    >
      <Texto variante="tituloItem">Quer ser avisado?</Texto>
      {EXPLICACAO_DAS_NOTIFICACOES.map((t) => (
        <Texto key={t} variante="corpo" cor="textoSuave">
          {t}
        </Texto>
      ))}
    </CartaoDeVidro>
  )
}
