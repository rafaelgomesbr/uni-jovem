import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NOME_DO_PAPEL } from '@uj/dominio'
import { router } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { ComunidadeDoVinculo, ConviteDaComunidade } from '@/servicos/contrato'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import { formatarData } from '@/utilidades/formatos'

import { AvisoDeFalha, ErroDaTela } from '../eventos/Falha'
import { MenuDeAcoes } from '../eventos/FolhaNaTela'
import { useConvites } from './consultas'
import { CHIP_DA_SITUACAO_DO_CONVITE, NOME_DA_SITUACAO_DO_CONVITE } from './nomes'

/** Quantos convites já encerrados (usados, vencidos, cancelados) aparecem. */
const ENCERRADOS_VISIVEIS = 10

const DIA_MS = 24 * 60 * 60 * 1000

function convidarDeNovo(convite: ConviteDaComunidade) {
  router.push({
    pathname: '/convidar',
    params: {
      papel: convite.papel,
      ...(convite.emailDestino ? { email: convite.emailDestino } : {}),
    },
  })
}

/** "vence amanhã", "vence em 3 dias" (quadro 08b). */
function quandoVence(expiraEm: string, agora = Date.now()): string {
  const dias = Math.ceil((Date.parse(expiraEm) - agora) / DIA_MS)
  if (dias <= 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  return `vence em ${dias} dias`
}

/** "Para gabi@email.com · vence em 3 dias", "Link aberto · venceu em 12/11/2026". */
export function descreverConvite(c: ConviteDaComunidade, agora = Date.now()): string {
  const para = c.emailDestino ? `Para ${c.emailDestino}` : 'Link aberto'
  const quando =
    c.situacao === 'valido'
      ? quandoVence(c.expiraEm, agora)
      : c.situacao === 'expirado'
        ? `venceu em ${formatarData(c.expiraEm)}`
        : `criado em ${formatarData(c.criadoEm)}`
  return `${para} · ${quando}`
}

/**
 * Convites (3.6.1, item 5, e quadro 08b): cartão lista com o ladrilho de
 * link, o papel no título, para quem e até quando na legenda e a situação em
 * chip. Tocar abre a folha com "Convidar de novo" e "Cancelar convite". O
 * link não volta a aparecer: a API guarda só o HMAC do token.
 */
export function SecaoConvites({
  comunidade,
  podeAlterar,
}: {
  comunidade: ComunidadeDoVinculo
  /** Comunidade suspensa: só consulta. */
  podeAlterar: boolean
}) {
  const convites = useConvites(comunidade.id, true)
  const consultas = useQueryClient()
  const [verTodos, setVerTodos] = useState(false)
  const [escolhido, setEscolhido] = useState<ConviteDaComunidade | null>(null)
  // Momento em que a lista abriu: basta para dizer quantos dias faltam.
  const [agora] = useState(Date.now)
  const revogar = useMutation({
    mutationFn: (convite: ConviteDaComunidade) =>
      api.post(`/api/v1/c/${comunidade.id}/convites/${convite.id}/revogar`),
    onSuccess: async () => {
      mostrarToast({ texto: 'Convite cancelado. O link deixou de funcionar.' })
      await consultas.invalidateQueries({ queryKey: CHAVES.convites(comunidade.id) })
    },
  })

  async function pedirCancelamento(convite: ConviteDaComunidade) {
    const ok = await confirmar({
      titulo: 'Cancelar este convite?',
      mensagem: `O link deixa de funcionar e ninguém mais entra em ${comunidade.nome} por ele. Dá para criar outro depois.`,
      confirmar: 'Cancelar convite',
      destrutivo: true,
    })
    if (ok) revogar.mutate(convite)
  }

  if (convites.isPending) {
    return (
      <Esqueleto rotulo="Carregando os convites">
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (convites.error) {
    return (
      <ErroDaTela
        erro={convites.error}
        titulo="Os convites não carregaram"
        aoTentarDeNovo={() => void convites.refetch()}
      />
    )
  }
  if (convites.data.length === 0) {
    return (
      <EstadoVazio
        icone="convidar"
        titulo="Ainda não há convites"
        descricao={
          podeAlterar
            ? 'Convide a primeira pessoa. Cada convite gera um link que vale para uma pessoa.'
            : 'Com a comunidade sem alterações, não dá para convidar agora.'
        }
        {...(podeAlterar
          ? {
              acao: {
                titulo: 'Convidar a primeira pessoa',
                icone: 'link' as const,
                variante: 'secundario' as const,
                aoPressionar: () => router.push('/convidar'),
              },
            }
          : {})}
      />
    )
  }

  const validos = convites.data.filter((c) => c.situacao === 'valido')
  const encerrados = convites.data.filter((c) => c.situacao !== 'valido')
  const encerradosVisiveis = verTodos ? encerrados : encerrados.slice(0, ENCERRADOS_VISIVEIS)

  return (
    <>
      {revogar.error ? (
        <AvisoDeFalha erro={revogar.error} titulo="O convite não foi cancelado" />
      ) : null}
      <CartaoDeVidro
        lista
        {...(!verTodos && encerrados.length > ENCERRADOS_VISIVEIS
          ? {
              acoes: (
                <Botao
                  titulo={`Ver os ${encerrados.length - ENCERRADOS_VISIVEIS} mais antigos`}
                  variante="terciario"
                  alinhado
                  aoPressionar={() => setVerTodos(true)}
                />
              ),
            }
          : {})}
      >
        <Lista>
          {[...validos, ...encerradosVisiveis].map((c) => {
            const papel = NOME_DO_PAPEL[c.papel]
            const situacao = NOME_DA_SITUACAO_DO_CONVITE[c.situacao]
            const descricao = descreverConvite(c, agora)
            const temAcoes = podeAlterar && c.situacao !== 'usado'
            return (
              <LinhaDeLista
                key={c.id}
                icone="link"
                titulo={papel}
                descricao={descricao}
                extra={<Chip texto={situacao} tom={CHIP_DA_SITUACAO_DO_CONVITE[c.situacao].tom} />}
                rotuloAcessivel={`Convite de ${papel}. ${situacao}. ${descricao}${temAcoes ? '. Abrir opções' : ''}`}
                {...(temAcoes ? { semSeta: true, aoPressionar: () => setEscolhido(c) } : {})}
              />
            )
          })}
        </Lista>
      </CartaoDeVidro>
      <Texto variante="legenda" cor="textoSuave">
        Por segurança, o link só aparece quando o convite é criado. Perdeu o link? Cancele e convide
        de novo.
      </Texto>
      <MenuDeAcoes
        aberto={escolhido !== null}
        titulo={escolhido ? `Convite de ${NOME_DO_PAPEL[escolhido.papel]}` : 'Convite'}
        aoFechar={() => setEscolhido(null)}
        acoes={
          escolhido
            ? [
                {
                  titulo: 'Convidar de novo',
                  icone: 'repetir',
                  descricao: 'Um link novo, com o mesmo papel e e-mail',
                  navega: true,
                  aoPressionar: () => convidarDeNovo(escolhido),
                },
                escolhido.situacao === 'valido' && {
                  titulo: 'Cancelar convite',
                  icone: 'cancelar',
                  descricao: 'O link deixa de funcionar',
                  destrutiva: true,
                  aoPressionar: () => void pedirCancelamento(escolhido),
                },
              ]
            : []
        }
      />
    </>
  )
}
