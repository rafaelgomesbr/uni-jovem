import { router } from 'expo-router'

import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'

import { TelaDoApp } from '../navegacao/TelaDoApp'

export function TelaAgenda() {
  return (
    <TelaDoApp titulo="Agenda">
      <Cartao>
        <EstadoVazio
          icone="agenda"
          titulo="A agenda ainda está a caminho"
          descricao="Em breve você vai ver aqui os eventos do mês, da semana e a linha do tempo de cada dia. Por enquanto, confira quem participa da comunidade."
          acao={{
            titulo: 'Ver a comunidade',
            icone: 'comunidade',
            aoPressionar: () => router.push('/comunidade'),
          }}
        />
      </Cartao>
    </TelaDoApp>
  )
}
