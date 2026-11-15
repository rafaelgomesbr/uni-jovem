import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import type { PedidoDeOracao } from '@/servicos/contratoDosModulos'
import { confirmar } from '@/utilidades/confirmar'
import { primeiroNome } from '@/utilidades/formatos'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { Texto } from '@/ui/Texto'

import { AvisoDeFalha } from '../agenda/ErroAoCarregar'
import { BotaoDenunciar } from '../denuncias/BotaoDenunciar'
import { BotaoEstouOrando } from './BotaoEstouOrando'
import { useEstouOrando, useExcluirPedido, useMarcarRespondido } from './consultas'
import { FolhaDeAcoes, type AcaoDaFolha } from './FolhaDeAcoes'
import { NOME_DA_VISIBILIDADE } from './visibilidade'

/** Linhas do texto na lista antes do "Ler tudo" (3.7.1). */
const LINHAS_NA_LISTA = 6
/** Texto que certamente passa de 6 linhas: o "Ler tudo" aparece mesmo sem medir. */
const TEXTO_LONGO = 280

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "12 nov", no fuso do aparelho. */
function diaCurto(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MESES[d.getMonth()]}`
}

/** "Seu pedido" ou "Pedido de Bruno Lima": a base dos rótulos falados. */
export function autorDoPedido(p: PedidoDeOracao): string {
  return p.minha ? 'Seu pedido' : `Pedido de ${p.autorNome ?? 'uma pessoa'}`
}

/** "5 pessoas orando", "Você e mais 2 orando", "Ninguém orando ainda". */
export function quantosOrando(p: PedidoDeOracao): string {
  const { total, euEstouOrando } = p.orando
  if (total === 0) return 'Ninguém orando ainda'
  if (euEstouOrando && total === 1) return 'Você está orando'
  if (euEstouOrando) return `Você e mais ${total - 1} orando`
  return `${total} ${total === 1 ? 'pessoa orando' : 'pessoas orando'}`
}

/** Pedido de outra pessoa, visível à comunidade: o único que pode ser denunciado. */
export function podeDenunciar(p: PedidoDeOracao): boolean {
  return !p.minha && p.visibilidade === 'comunidade'
}

/**
 * Ações do pedido, para a folha "Mais ações" (3.7.1): do próprio, marcar
 * como respondido, editar ou mudar quem vê e excluir (em vermelho, por
 * último); do de outra pessoa na comunidade, denunciar. Isso tira os quatro
 * botões largos do cartão.
 */
export function MaisAcoesDoPedido({
  pedido,
  comunidadeId,
  aberta,
  aoFechar,
  aoExcluir,
  aoBloquear,
}: {
  pedido: PedidoDeOracao
  comunidadeId: string
  aberta: boolean
  aoFechar: () => void
  aoExcluir?: () => void
  /** Depois de bloquear a pessoa, o pedido some (no detalhe, a tela volta). */
  aoBloquear?: () => void
}) {
  const respondido = useMarcarRespondido(comunidadeId)
  const excluir = useExcluirPedido(comunidadeId)
  const autor = autorDoPedido(pedido).toLowerCase()

  async function pedirExclusao() {
    const ok = await confirmar({
      titulo: 'Excluir este pedido?',
      mensagem: 'O pedido some para todos que podiam ler. Não dá para desfazer.',
      confirmar: 'Excluir pedido',
      destrutivo: true,
    })
    if (ok) excluir.mutate(pedido.id, { onSuccess: aoExcluir })
  }

  const acoes: AcaoDaFolha[] = pedido.minha
    ? [
        {
          titulo: pedido.respondidoEm ? 'Desmarcar respondido' : 'Marcar como respondido',
          icone: 'confirmado',
          aoPressionar: () =>
            respondido.mutate({ id: pedido.id, respondido: !pedido.respondidoEm }),
        },
        {
          titulo: 'Editar ou mudar quem vê',
          icone: 'editar',
          aoPressionar: () =>
            router.push({
              pathname: '/oracao/[pedidoId]',
              params: { pedidoId: pedido.id, editar: '1' },
            }),
        },
        {
          titulo: 'Excluir pedido',
          icone: 'excluir',
          destrutiva: true,
          aoPressionar: pedirExclusao,
        },
      ]
    : []

  return (
    <>
      {(respondido.error ?? excluir.error) ? (
        <AvisoDeFalha erro={respondido.error ?? excluir.error} />
      ) : null}
      <FolhaDeAcoes titulo="Mais ações" aberta={aberta} aoFechar={aoFechar} acoes={acoes}>
        {podeDenunciar(pedido) ? (
          <BotaoDenunciar
            comunidadeId={comunidadeId}
            recursoTipo="pedido_oracao"
            recursoId={pedido.id}
            descricao={`o ${autor}`}
            {...(aoBloquear ? { aoBloquear } : {})}
          />
        ) : null}
      </FolhaDeAcoes>
    </>
  )
}

/**
 * Um pedido de oração (3.7.1): cartão de vidro com a sobrancelha "PEDIDO DE
 * ANA · 12 NOV" (ou "SEU PEDIDO"), à direita o chip de quem vê e o de
 * respondido; o texto em `leitura` (até 6 linhas, com "Ler tudo"); e a
 * linha de ação com "Estou orando", quantos estão orando e "Mais ações".
 * `completo` (no detalhe) mostra o texto inteiro e deixa a ação para a barra.
 */
export function CartaoDoPedido({
  pedido,
  comunidadeId,
  completo = false,
}: {
  pedido: PedidoDeOracao
  comunidadeId: string
  completo?: boolean
}) {
  const orar = useEstouOrando(comunidadeId)
  const [folhaAberta, setFolhaAberta] = useState(false)
  const [linhas, setLinhas] = useState(0)
  const autor = autorDoPedido(pedido)
  const quem = pedido.minha
    ? 'Seu pedido'
    : `Pedido de ${primeiroNome(pedido.autorNome) || 'uma pessoa'}`
  const texto = pedido.texto ?? 'Não foi possível mostrar o texto deste pedido.'
  const longo = !completo && (linhas >= LINHAS_NA_LISTA || texto.length > TEXTO_LONGO)
  const temMaisAcoes = pedido.minha || podeDenunciar(pedido)
  const abrir = () =>
    router.push({ pathname: '/oracao/[pedidoId]', params: { pedidoId: pedido.id } })

  return (
    <CartaoDeVidro
      sobrancelha={`${quem} · ${diaCurto(pedido.criadoEm)}`}
      extra={
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: ESPACO.e4,
            flexShrink: 1,
          }}
        >
          <View
            accessible
            accessibilityLabel={`Quem vê: ${NOME_DA_VISIBILIDADE[pedido.visibilidade]}`}
          >
            <Chip texto={NOME_DA_VISIBILIDADE[pedido.visibilidade]} tom="neutro" />
          </View>
          {pedido.respondidoEm ? <Chip texto="Respondido" tom="sucesso" icone="check" /> : null}
        </View>
      }
      {...(completo
        ? {}
        : {
            acoes: (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12 }}>
                <BotaoEstouOrando
                  orando={pedido.orando.euEstouOrando}
                  rotuloAcessivel={
                    pedido.orando.euEstouOrando
                      ? `Deixar de marcar que estou orando pelo ${autor.toLowerCase()}`
                      : `Estou orando pelo ${autor.toLowerCase()}`
                  }
                  carregando={orar.isPending}
                  aoPressionar={() =>
                    orar.mutate({ id: pedido.id, orando: !pedido.orando.euEstouOrando })
                  }
                />
                <Texto variante="legenda" cor="textoSuave" style={{ flex: 1 }}>
                  {quantosOrando(pedido)}
                </Texto>
                {temMaisAcoes ? (
                  <BotaoIcone
                    icone="maisAcoes"
                    rotulo={`Mais ações do ${autor.toLowerCase()}`}
                    aoPressionar={() => setFolhaAberta(true)}
                  />
                ) : null}
              </View>
            ),
          })}
    >
      <Texto
        variante="leitura"
        selectable
        {...(completo ? {} : { numberOfLines: LINHAS_NA_LISTA })}
        onTextLayout={(e) => setLinhas(e.nativeEvent.lines.length)}
      >
        {texto}
      </Texto>
      {longo ? (
        <Botao
          titulo="Ler tudo"
          variante="terciario"
          alinhado
          rotuloAcessivel={`Ler tudo: ${autor.toLowerCase()}`}
          aoPressionar={abrir}
        />
      ) : null}
      {pedido.minha && completo ? (
        <Texto variante="legenda" cor="textoSuave">
          {pedido.quemVe}
        </Texto>
      ) : null}
      {orar.error ? <AvisoDeFalha erro={orar.error} /> : null}
      {completo ? null : (
        <MaisAcoesDoPedido
          pedido={pedido}
          comunidadeId={comunidadeId}
          aberta={folhaAberta}
          aoFechar={() => setFolhaAberta(false)}
        />
      )}
    </CartaoDeVidro>
  )
}
