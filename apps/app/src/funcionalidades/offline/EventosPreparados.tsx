import { router } from 'expo-router'

import { formatarQuando } from '@/utilidades/datas'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'

import { diaEMesNoAparelho } from './formatos'
import { useOffline } from './ProvedorOffline'

/** Sem conexão, o Início mostra o que está guardado neste aparelho para abrir na hora. */
export function EventosPreparados() {
  const offline = useOffline()
  if (!offline.disponivel || !offline.pacotes.length) return null
  return (
    <Secao
      titulo="Preparados para usar sem internet"
      rodape="Abrem mesmo sem conexão. O que você marcar vai para o servidor quando a internet voltar."
    >
      <CartaoDeVidro lista>
        <Lista>
          {offline.pacotes.map((p) => (
            <LinhaDeLista
              key={p.eventoId}
              icone="guardadoNoAparelho"
              titulo={p.titulo}
              descricao={`${formatarQuando(p.inicio, p.fuso)} · válido até ${diaEMesNoAparelho(offline.validoAte ?? p.validoAte)}`}
              aoPressionar={() =>
                router.push({ pathname: '/evento/[eventoId]', params: { eventoId: p.eventoId } })
              }
            />
          ))}
        </Lista>
      </CartaoDeVidro>
    </Secao>
  )
}
