import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import type { ComunidadeDoVinculo } from '@/servicos/contrato'
import { AvisoDeFalha } from '@/ui/Falha'
import { formatarData } from '@/utilidades/formatos'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { Cartao } from '@/ui/Cartao'
import { LinhaDeLista, Lista, RECUO_DA_LISTA } from '@/ui/LinhaDeLista'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { VazioComSol } from '../entrada/VazioComSol'
import { SemComunidade } from '../navegacao/SemComunidade'
import { bloquearPessoa, useBloqueios, useDesbloquear, type PessoaBloqueada } from './bloqueios'

/**
 * Rota `/bloqueados`: as pessoas que EU bloqueei na comunidade ativa, com
 * desbloquear. Nunca mostra quem me bloqueou (a API nem tem essa resposta).
 */
export function TelaPessoasBloqueadas() {
  const { comunidadeAtiva } = useSessao()
  return (
    <Tela pilha titulo="Pessoas bloqueadas" descricao="Só você vê esta lista. Ninguém é avisado.">
      {comunidadeAtiva ? (
        <ListaDeBloqueios comunidade={comunidadeAtiva} />
      ) : (
        <SemComunidade oQue="as pessoas bloqueadas" />
      )}
    </Tela>
  )
}

function ListaDeBloqueios({ comunidade }: { comunidade: ComunidadeDoVinculo }) {
  const lista = useBloqueios(comunidade.id)
  if (lista.isPending) {
    return (
      <Esqueleto rotulo="Carregando as pessoas bloqueadas">
        <CartaoDeEsqueleto titulo />
      </Esqueleto>
    )
  }
  if (lista.error) {
    return <AvisoDeFalha erro={lista.error} aoTentarDeNovo={() => void lista.refetch()} />
  }
  if (lista.data.length === 0) {
    return (
      <VazioComSol
        titulo="Ninguém bloqueado"
        descricao={`Para bloquear alguém em ${comunidade.nome}, abra um pedido de oração, uma sugestão ou um aviso dessa pessoa e toque em "Bloquear esta pessoa".`}
        acao={{ titulo: 'Ver pedidos de oração', aoPressionar: () => router.push('/oracao') }}
      />
    )
  }
  return (
    <>
      <Cartao>
        <Texto variante="corpo" cor="textoSuave">
          {`Em ${comunidade.nome}, você não vê os pedidos de oração nem as sugestões com nome destas pessoas. Avisos e encontros continuam aparecendo, e o papel de ninguém muda.`}
        </Texto>
      </Cartao>
      <CartaoDeVidro lista>
        {/* O separador começa no texto, depois do avatar de 40, como na aba Comunidade. */}
        <Lista recuo={RECUO_DA_LISTA.avatar}>
          {lista.data.map((p) => (
            <LinhaDaPessoa key={p.id} comunidadeId={comunidade.id} pessoa={p} />
          ))}
        </Lista>
      </CartaoDeVidro>
    </>
  )
}

function LinhaDaPessoa({
  comunidadeId,
  pessoa,
}: {
  comunidadeId: string
  pessoa: PessoaBloqueada
}) {
  const consultas = useQueryClient()
  const desbloquear = useDesbloquear(comunidadeId)

  async function refazer(vinculoId: string) {
    try {
      await bloquearPessoa(consultas, comunidadeId, { vinculoId })
      mostrarToast({ texto: `Bloqueio de ${pessoa.nome} refeito.`, tipo: 'info' })
    } catch {
      mostrarToast({
        texto: 'Não deu para bloquear de novo. Abra algo que a pessoa escreveu e tente por lá.',
        tipo: 'erro',
      })
    }
  }

  // Desfazer em vez de "tem certeza?" (UX v3, P5): desbloquear é reversível e a pessoa nem é avisada.
  function pedir() {
    const vinculoId = pessoa.vinculoId
    desbloquear.mutate(pessoa.id, {
      onSuccess: () =>
        mostrarToast({
          texto: `Bloqueio de ${pessoa.nome} desfeito.`,
          // Bloquear de novo pelo vínculo: a linha já saiu da lista.
          ...(vinculoId
            ? {
                acao: { titulo: 'Desfazer', aoPressionar: () => void refazer(vinculoId) },
              }
            : {}),
        }),
    })
  }

  return (
    <>
      <LinhaDeLista
        avatar={{ nome: pessoa.nome, dados: pessoa.avatar }}
        titulo={pessoa.nome}
        descricao={`Bloqueio em ${formatarData(pessoa.bloqueadoEm)}`}
        extra={
          <Botao
            titulo="Desbloquear"
            variante="secundario"
            tamanho="medio"
            carregando={desbloquear.isPending}
            rotuloAcessivel={`Desbloquear ${pessoa.nome}`}
            aoPressionar={pedir}
          />
        }
      />
      {desbloquear.error ? (
        <AvisoDeFalha erro={desbloquear.error} titulo="Não deu para desbloquear" />
      ) : null}
    </>
  )
}
