import { TelaAgenda } from '@/funcionalidades/agenda/TelaAgenda'
import { EmbrulhoDaAba } from '@/funcionalidades/navegacao/EmbrulhoDaAba'

export default function AbaAgenda() {
  return (
    <EmbrulhoDaAba>
      <TelaAgenda />
    </EmbrulhoDaAba>
  )
}
