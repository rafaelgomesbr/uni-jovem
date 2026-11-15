import { router } from 'expo-router'

import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Texto } from '@/ui/Texto'

import { useProgressoDaMissao } from './missao'

/**
 * Convite discreto no Início para o mapa da missão. Nunca abre sozinho;
 * some quando a pessoa conclui ou pula (e continua no Perfil para rever).
 */
export function CartaoDaMissao() {
  const { progresso, salvar } = useProgressoDaMissao()
  if (!progresso || progresso.estado === 'concluido' || progresso.estado === 'pulado') return null
  const continuar = progresso.estado === 'em_andamento' || progresso.estado === 'pausado'
  return (
    <Cartao titulo="Mapa da missão" icone="missao">
      <Texto variante="apoio">
        {continuar
          ? 'Você parou no meio do passeio. Continue de onde parou quando quiser.'
          : 'Um passeio de poucos minutos pelo app, com exemplos que não mudam nada de verdade.'}
      </Texto>
      <Botao
        titulo={continuar ? 'Continuar o mapa' : 'Começar o mapa'}
        icone="missao"
        variante="secundario"
        aoPressionar={() => router.push('/missao')}
      />
      <Botao
        titulo="Agora não"
        variante="discreto"
        dica="O mapa fica no Perfil para quando quiser."
        aoPressionar={() => salvar({ ...progresso, estado: 'pulado' })}
      />
    </Cartao>
  )
}
