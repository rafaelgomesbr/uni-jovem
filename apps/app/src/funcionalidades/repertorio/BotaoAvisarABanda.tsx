import type { TamanhoDoBotao, VarianteDoBotao } from '@/ui/Botao'
import { Botao } from '@/ui/Botao'
import { AvisoDeFalha } from '@/ui/Falha'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'

import { usePode } from '../comunidade/permissoes'
import { useAvisarABanda } from './consultas'

/**
 * "Avisar a banda" (D61): manda às pessoas convocadas ao louvor um aviso de que
 * o repertório foi atualizado. O aviso não diz quais músicas. Só quem convoca
 * vê o botão; ele fica desligado, com o motivo, enquanto o encontro não está
 * publicado. Mostra a quantas pessoas o aviso saiu (quem desligou os avisos ou
 * já foi avisado na última hora não conta).
 */
export function BotaoAvisarABanda({
  comunidadeId,
  eventoId,
  publicado,
  variante = 'secundario',
  tamanho = 'medio',
}: {
  comunidadeId: string
  eventoId: string
  publicado: boolean
  variante?: VarianteDoBotao
  tamanho?: TamanhoDoBotao
}) {
  const pode = usePode()
  const avisar = useAvisarABanda(comunidadeId, eventoId)
  if (!pode('escala', 'atribuir')) return null

  async function avisarABanda() {
    const ok = await confirmar({
      titulo: 'Avisar a banda?',
      mensagem:
        'As pessoas convocadas ao louvor recebem um aviso de que o repertório foi atualizado. O aviso não diz quais músicas.',
      confirmar: 'Avisar a banda',
    })
    if (!ok) return
    avisar.mutate(undefined, {
      onSuccess: (r) =>
        mostrarToast({
          texto:
            r.convocadas === 0
              ? 'Ninguém foi convocado ao louvor ainda. Convoque a banda no encontro.'
              : r.avisadas > 0
                ? `Aviso enviado a ${r.avisadas} ${r.avisadas === 1 ? 'pessoa' : 'pessoas'} da banda.`
                : 'Ninguém novo para avisar agora: a banda já foi avisada há pouco, ou desligou os avisos.',
        }),
    })
  }

  return (
    <>
      {avisar.error ? <AvisoDeFalha erro={avisar.error} titulo="A banda não foi avisada" /> : null}
      <Botao
        titulo="Avisar a banda"
        variante={variante}
        tamanho={tamanho}
        carregando={avisar.isPending}
        {...(publicado
          ? {}
          : { desabilitado: true, motivo: 'Publique o encontro para avisar a banda.' })}
        aoPressionar={() => void avisarABanda()}
      />
    </>
  )
}
