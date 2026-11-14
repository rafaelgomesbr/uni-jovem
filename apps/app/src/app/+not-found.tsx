import { router } from 'expo-router'

import { EstadoVazio } from '@/ui/EstadoVazio'
import { Tela } from '@/ui/Tela'

export default function NaoEncontrado() {
  return (
    <Tela cabecalhoNativo>
      <EstadoVazio
        icone="erro"
        titulo="Página não encontrada"
        descricao="O endereço pode estar incompleto ou a página mudou de lugar."
        acao={{ titulo: 'Ir para o início', aoPressionar: () => router.replace('/') }}
      />
    </Tela>
  )
}
