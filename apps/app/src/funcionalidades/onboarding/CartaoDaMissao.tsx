import { router } from 'expo-router'

import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Texto } from '@/ui/Texto'

import { useProgressoDaMissao } from './missao'

/** O mapa ainda está para fazer (nem concluído nem pulado)? */
export function useMissaoPendente(): boolean {
  const { progresso } = useProgressoDaMissao()
  return !!progresso && progresso.estado !== 'concluido' && progresso.estado !== 'pulado'
}

/**
 * "MAPA DA MISSÃO" compacto no Início (3.2.1): nunca abre sozinho; some
 * quando a pessoa conclui ou pula (e continua no Perfil para rever).
 */
export function CartaoDaMissao() {
  const { progresso, salvar } = useProgressoDaMissao()
  if (!progresso || progresso.estado === 'concluido' || progresso.estado === 'pulado') return null
  const continuar = progresso.estado === 'em_andamento' || progresso.estado === 'pausado'
  return (
    <CartaoDeVidro
      sobrancelha="Mapa da missão"
      acoes={
        <ParDeBotoes>
          <Botao
            titulo={continuar ? 'Continuar' : 'Começar'}
            variante="secundario"
            rotuloAcessivel={continuar ? 'Continuar o mapa da missão' : 'Começar o mapa da missão'}
            aoPressionar={() => router.push('/missao')}
          />
          <Botao
            titulo="Agora não"
            variante="terciario"
            dica="O mapa fica no Perfil para quando quiser."
            aoPressionar={() => salvar({ ...progresso, estado: 'pulado' })}
          />
        </ParDeBotoes>
      }
    >
      <Texto variante="corpo">
        {continuar
          ? 'Você parou no meio do passeio. Continue de onde parou quando quiser.'
          : 'Um passeio de poucos minutos pelo app, com exemplos que não mudam nada de verdade.'}
      </Texto>
    </CartaoDeVidro>
  )
}
