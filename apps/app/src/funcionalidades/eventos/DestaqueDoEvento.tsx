import { router } from 'expo-router'

import type { Atribuicao, DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { AvisoDeFalha } from '@/ui/Falha'
import { dataDoInstante, formatarDuracao, formatarHora, hojeNoFuso } from '@/utilidades/datas'

import { useMeuVinculo } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { confirmarQueNaoPodeIr, useResponderEscala } from '../escalas/consultas'
import { MinhaInscricao } from '../inscricoes/MinhaInscricao'
import { CHIP_DO_ESTADO_DA_ATRIBUICAO } from './nomes'
import { podeIrAoVivo } from './regras'

/** O evento é hoje, no fuso dele? */
export function ehHoje(evento: Pick<DetalheDoEvento, 'inicio' | 'fuso'>, agora = new Date()) {
  return dataDoInstante(evento.inicio, evento.fuso) === hojeNoFuso(evento.fuso, agora)
}

/** Organização no dia: o ao vivo é a ação principal da tela. */
export function useAoVivoNoDia(evento: DetalheDoEvento): boolean {
  const pode = usePode()
  return pode('ao_vivo', 'conduzir') && podeIrAoVivo(evento.status) && ehHoje(evento)
}

/** A escala da própria pessoa neste evento (a recusada não conta). */
function useMinhaAtribuicao(evento: DetalheDoEvento): Atribuicao | null {
  const eu = useMeuVinculo()
  return evento.atribuicoes.find((a) => a.vinculoId === eu && a.estado !== 'recusada') ?? null
}

/**
 * Qual cartão ocupa o lugar do destaque: a participação de quem está
 * escalado, o ao vivo da organização no dia ou, sem nenhum desses, a
 * inscrição da própria pessoa ("SUA ENTRADA" quando inscrita).
 */
export function useTipoDeDestaque(evento: DetalheDoEvento): 'participacao' | 'aoVivo' | 'entrada' {
  const minha = useMinhaAtribuicao(evento)
  const noDia = useAoVivoNoDia(evento)
  return minha ? 'participacao' : noDia ? 'aoVivo' : 'entrada'
}

/**
 * A inscrição rebaixada: quando o destaque é a participação ou o ao vivo, a
 * entrada vira um cartão de vidro (no máximo um destaque por tela, 2.12.10).
 * A `MinhaInscricao` entra só com o conteúdo dentro do cartão, e o
 * "Inscrever-me" como secundário: o primário é o do destaque ou o da barra.
 */
export function InscricaoRebaixada({
  evento,
  comunidadeId,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
}) {
  const pode = usePode()
  if (!pode('inscricao', 'inscrever_se', { proprio: true })) return null
  return (
    <CartaoDeVidro>
      <MinhaInscricao evento={evento} comunidadeId={comunidadeId} secundario />
    </CartaoDeVidro>
  )
}

function primeiraMaiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1)
}

/**
 * Cartão de destaque do detalhe (3.4.2, item 3), um só por tela:
 * - escalado: "SUA PARTICIPAÇÃO", com a função e Confirmar ou Pedir substituição;
 * - organização no dia: "AO VIVO", tocável, que abre o ao vivo;
 * - nenhum desses: a inscrição da própria pessoa, que inscrita vira "SUA ENTRADA".
 */
export function DestaqueDoEvento({
  evento,
  comunidadeId,
  inscricaoSecundaria = false,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
  /** A barra de ação já tem o primário ("Editar", "Publicar"): o "Inscrever-me" vira secundário. */
  inscricaoSecundaria?: boolean
}) {
  const minha = useMinhaAtribuicao(evento)
  const tipo = useTipoDeDestaque(evento)

  if (tipo === 'participacao' && minha) {
    return <SuaParticipacao evento={evento} atribuicao={minha} comunidadeId={comunidadeId} />
  }
  if (tipo === 'entrada') {
    return (
      <MinhaInscricao
        evento={evento}
        comunidadeId={comunidadeId}
        secundario={inscricaoSecundaria}
      />
    )
  }
  const params = { eventoId: evento.id }
  const quando = `Hoje, às ${formatarHora(evento.inicio, evento.fuso)}`
  const etapas = evento.etapas.length
  return (
    <CartaoDeDestaque
      sobrancelha="Ao vivo"
      titulo={quando}
      descricao={`${etapas === 1 ? '1 etapa' : `${etapas} etapas`} · ${formatarDuracao(evento.duracaoMin)}. Toque para conduzir o andamento.`}
      rotuloAcessivel={`Abrir ao vivo. ${quando}`}
      aoPressionar={() => router.push({ pathname: '/evento/[eventoId]/ao-vivo', params })}
    />
  )
}

function SuaParticipacao({
  evento,
  atribuicao,
  comunidadeId,
}: {
  evento: DetalheDoEvento
  atribuicao: Atribuicao
  comunidadeId: string
}) {
  const responder = useResponderEscala(comunidadeId)
  const etapa = evento.etapas.find((e) => e.id === atribuicao.etapaId) ?? null
  const inicio = etapa?.inicioPrevisto ?? evento.inicio
  const duracao = etapa?.duracaoMin ?? evento.duracaoMin
  const onde = etapa ? etapa.titulo : 'Para o encontro inteiro'
  const chip = CHIP_DO_ESTADO_DA_ATRIBUICAO[atribuicao.estado]
  const funcao = primeiraMaiuscula(atribuicao.funcao)

  // Pendente tem só duas saídas, "Aceitar" e "Não posso ir" (D62); "Pedir substituição" é de quem já aceitou.
  async function naoPossoIr() {
    if (await confirmarQueNaoPodeIr()) {
      responder.mutate({ atribuicaoId: atribuicao.id, resposta: 'recusar' })
    }
  }

  const pedirSubstituicao = (
    <Botao
      titulo="Pedir substituição"
      variante="secundario"
      rotuloAcessivel={`Pedir substituição: ${funcao} em ${onde}`}
      aoPressionar={() =>
        router.push({
          pathname: '/escalas/substituicao/[atribuicaoId]',
          params: { atribuicaoId: atribuicao.id },
        })
      }
    />
  )

  return (
    <>
      <CartaoDeDestaque
        sobrancelha="Sua participação"
        meta={`${onde} · ${formatarHora(inicio, evento.fuso)} · ${formatarDuracao(duracao)}`}
        chip={<Chip texto={chip.texto} tom={chip.tom} />}
        titulo={funcao}
        {...(atribuicao.estado === 'substituicao_pedida'
          ? { descricao: 'Você pediu substituição. Quem assumir aparece aqui.' }
          : {})}
        {...(atribuicao.estado === 'pendente'
          ? {
              acoes: (
                <ParDeBotoes>
                  <Botao
                    titulo="Aceitar"
                    rotuloAcessivel={`Aceitar: ${funcao} em ${onde}`}
                    carregando={responder.isPending}
                    aoPressionar={() =>
                      responder.mutate({ atribuicaoId: atribuicao.id, resposta: 'confirmar' })
                    }
                  />
                  <Botao
                    titulo="Não posso ir"
                    variante="secundario"
                    rotuloAcessivel={`Não posso ir: avisar a organização sobre ${funcao} em ${onde}`}
                    carregando={responder.isPending}
                    aoPressionar={() => void naoPossoIr()}
                  />
                </ParDeBotoes>
              ),
            }
          : atribuicao.estado === 'confirmada'
            ? { acoes: pedirSubstituicao }
            : {})}
      />
      {responder.error ? <AvisoDeFalha erro={responder.error} /> : null}
    </>
  )
}
