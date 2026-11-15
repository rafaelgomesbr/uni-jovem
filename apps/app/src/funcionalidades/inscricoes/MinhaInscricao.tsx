import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { DetalheDoEvento, MinhaInscricao as Inscricao } from '@/servicos/contratoDosEventos'
import { confirmar } from '@/utilidades/confirmar'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CodigoQR } from '@/ui/CodigoQR'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'

import { usePode } from '../comunidade/permissoes'
import { naComunidade, useInvalidarEventos } from '../eventos/consultas'
import { EXPLICACAO_SEM_INSCRICAO, motivoSemInscricao } from '../eventos/regras'
import { COR_DO_ESTADO_DA_INSCRICAO, formatarCodigo, NOME_DO_ESTADO_DA_INSCRICAO } from './nomes'

interface Props {
  evento: DetalheDoEvento
  comunidadeId: string
}

/**
 * Inscrição da própria pessoa. A API não tem leitura de "minha inscrição":
 * inscrever é idempotente (devolve a que já existe), então o mesmo botão
 * serve para se inscrever e para ver o código de entrada de novo.
 */
export function MinhaInscricao({ evento, comunidadeId }: Props) {
  const pode = usePode()
  const consultas = useQueryClient()
  const invalidar = useInvalidarEventos(comunidadeId)
  const chave = CHAVES.minhaInscricao(comunidadeId, evento.id)
  // Só lê o que veio da última resposta; quem preenche é a mutação.
  const minha = useQuery<Inscricao | null>({
    queryKey: chave,
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
  }).data

  const inscrever = useMutation({
    mutationFn: () =>
      api.post<Inscricao>(`${naComunidade(comunidadeId)}/eventos/${evento.id}/inscricoes/eu`),
    onSuccess: (r) => consultas.setQueryData(chave, r),
  })
  const cancelar = useMutation({
    mutationFn: (id: string) => api.post(`${naComunidade(comunidadeId)}/inscricoes/${id}/cancelar`),
    onSuccess: async () => {
      consultas.setQueryData(chave, null)
      await invalidar(evento.id)
    },
  })

  if (!pode('inscricao', 'inscrever_se', { proprio: true })) return null
  const motivo = motivoSemInscricao(evento)
  const ativa = minha && minha.estado !== 'cancelada' ? minha : null

  async function pedirCancelamento(id: string) {
    const ok = await confirmar({
      titulo: 'Cancelar sua inscrição?',
      mensagem:
        'Sua vaga fica livre para outra pessoa. Você pode se inscrever de novo enquanto houver vaga.',
      confirmar: 'Cancelar inscrição',
      destrutivo: true,
    })
    if (ok) cancelar.mutate(id)
  }

  if (ativa) {
    return (
      <View style={{ gap: ESPACO.x3 }}>
        <Selo
          texto={`Sua inscrição: ${NOME_DO_ESTADO_DA_INSCRICAO[ativa.estado]}`}
          cor={COR_DO_ESTADO_DA_INSCRICAO[ativa.estado]}
        />
        {ativa.estado === 'espera' ? (
          <Texto variante="apoio">
            Você está na lista de espera. Se abrir uma vaga, sua inscrição é confirmada sozinha.
          </Texto>
        ) : null}
        <Texto variante="apoio" cor="textoSuave">
          Na entrada, mostre o QR ou diga o código.
        </Texto>
        <CodigoQR
          valor={ativa.codigo_checkin}
          rotulo={`QR do seu código de entrada, ${ativa.codigo_checkin.split('').join(' ')}`}
        />
        <Texto variante="subtitulo" centralizado selectable accessibilityRole="text">
          {formatarCodigo(ativa.codigo_checkin)}
        </Texto>
        {cancelar.error ? <AvisoDeErro erro={cancelar.error} /> : null}
        <Botao
          titulo="Cancelar minha inscrição"
          variante="perigo"
          carregando={cancelar.isPending}
          aoPressionar={() => void pedirCancelamento(ativa.inscricao_id)}
        />
      </View>
    )
  }

  return (
    <View style={{ gap: ESPACO.x2 }}>
      {inscrever.error ? <AvisoDeErro erro={inscrever.error} /> : null}
      <Botao
        titulo="Inscrever-me"
        icone="inscricoes"
        carregando={inscrever.isPending}
        desabilitado={motivo !== null}
        {...(motivo ? { motivo: EXPLICACAO_SEM_INSCRICAO[motivo] } : {})}
        dica="Se você já se inscreveu, mostra a sua inscrição sem duplicar."
        aoPressionar={() => inscrever.mutate()}
      />
    </View>
  )
}
