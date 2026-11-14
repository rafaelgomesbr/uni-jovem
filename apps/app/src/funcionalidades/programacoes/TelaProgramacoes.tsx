import { router } from 'expo-router'

import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'

import { TelaDoApp } from '../navegacao/TelaDoApp'

export function TelaProgramacoes() {
  return (
    <TelaDoApp titulo="Programações">
      <Cartao>
        <EstadoVazio
          icone="programacoes"
          titulo="As programações ainda estão a caminho"
          descricao="Em breve você vai montar aqui a programação de cada encontro, com etapas, responsáveis e horários. Enquanto isso, deixe seu perfil em dia."
          acao={{
            titulo: 'Abrir meu perfil',
            icone: 'perfil',
            aoPressionar: () => router.push('/perfil'),
          }}
        />
      </Cartao>
    </TelaDoApp>
  )
}
