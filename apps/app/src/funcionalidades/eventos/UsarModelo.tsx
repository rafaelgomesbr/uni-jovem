import { useMutation } from '@tanstack/react-query'
import { duracaoTotal, MODELOS_EMBUTIDOS } from '@uj/dominio'
import { useState, type ReactNode } from 'react'

import { api } from '@/servicos/api'
import { AvisoDeFalha } from '@/ui/Falha'
import { type AcaoDoMenu, MenuDeAcoes } from '@/ui/FolhaNaTela'
import { mostrarToast } from '@/ui/Toast'
import { formatarDuracao } from '@/utilidades/datas'

import { usePode } from '../comunidade/permissoes'
import { naComunidade, useInvalidarEventos, useModelos } from './consultas'

/**
 * "Usar um modelo" (D81): o roteiro do encontro novo nasce vazio e a pessoa escolhe como montá-lo.
 * Esta é a segunda porta ("Começar do zero" é a primeira): uma lista com os modelos do app e, para
 * quem pode ler, os da comunidade. Tocar num modelo monta o roteiro na hora; as etapas continuam
 * todas editáveis. O app nunca aplica um modelo sem a pessoa escolher.
 */
export function useUsarModelo(evento: { id: string }, comunidadeId: string) {
  const pode = usePode()
  const invalidar = useInvalidarEventos(comunidadeId)
  const [aberta, setAberta] = useState(false)
  const modelos = useModelos(comunidadeId, pode('modelo', 'ler') && aberta)
  const aplicar = useMutation({
    mutationFn: ({ chave }: { chave: string; nome: string }) =>
      api.post(`${naComunidade(comunidadeId)}/eventos/${evento.id}/etapas/modelo`, {
        modelo: chave,
      }),
    onSuccess: (_resposta, { nome }) => {
      mostrarToast({ texto: `Roteiro montado: ${nome}. Ajuste as etapas como quiser.` })
    },
    // Com sucesso ou não (409: o roteiro já tinha etapas), a tela mostra o que o servidor tem.
    onSettled: () => invalidar(evento.id),
  })

  const doApp: AcaoDoMenu[] = MODELOS_EMBUTIDOS.map((m) => ({
    titulo: m.nome,
    icone: 'etapas',
    descricao: `${m.etapas.length} etapas, ${formatarDuracao(duracaoTotal(m.etapas))}`,
    aoPressionar: () => aplicar.mutate({ chave: m.chave, nome: m.nome }),
  }))
  const daComunidade: AcaoDoMenu[] = (modelos.data?.daComunidade ?? []).map((m) => ({
    titulo: m.nome,
    icone: 'modelo',
    descricao: `Da comunidade. ${m.etapas.length} etapas, ${formatarDuracao(duracaoTotal(m.etapas))}`,
    aoPressionar: () => aplicar.mutate({ chave: m.id, nome: m.nome }),
  }))

  const folha: ReactNode = (
    <>
      <MenuDeAcoes
        aberto={aberta}
        titulo="Usar um modelo"
        acoes={[...doApp, ...daComunidade]}
        aoFechar={() => setAberta(false)}
      />
      {aplicar.error ? (
        <AvisoDeFalha erro={aplicar.error} titulo="O roteiro não foi montado" />
      ) : null}
    </>
  )

  return { abrir: () => setAberta(true), folha, montando: aplicar.isPending }
}
