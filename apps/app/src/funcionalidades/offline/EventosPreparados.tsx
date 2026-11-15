import { router } from 'expo-router'

import { formatarQuando } from '@/utilidades/datas'
import { Cartao } from '@/ui/Cartao'
import { Linha } from '@/ui/Linha'
import { Texto } from '@/ui/Texto'

import { diaEMesNoAparelho } from './formatos'
import { useOffline } from './ProvedorOffline'

/** Sem conexão, o Início mostra o que está guardado neste aparelho para abrir na hora. */
export function EventosPreparados() {
  const offline = useOffline()
  if (!offline.disponivel || !offline.pacotes.length) return null
  return (
    <Cartao titulo="Preparados para usar sem internet" icone="guardadoNoAparelho">
      <Texto variante="legenda" cor="textoSuave">
        Abrem mesmo sem conexão. O que você marcar vai para o servidor quando a internet voltar.
      </Texto>
      {offline.pacotes.map((p) => (
        <Linha
          key={p.eventoId}
          titulo={p.titulo}
          descricao={`${formatarQuando(p.inicio, p.fuso)} · válido até ${diaEMesNoAparelho(offline.validoAte ?? p.validoAte)}`}
          aoPressionar={() =>
            router.push({ pathname: '/evento/[eventoId]', params: { eventoId: p.eventoId } })
          }
        />
      ))}
    </Cartao>
  )
}
