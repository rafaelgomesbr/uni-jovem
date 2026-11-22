import { formatarData } from '@/utilidades/formatos'

const DIA_MS = 86_400_000

/**
 * "hoje", "ontem", "há 2 dias", "há 3 semanas" e, passado um mês e meio, a data
 * escrita. Conta dias corridos (24 h), não de calendário: basta para "há 2 dias" num mural.
 * O tempo de referência entra como argumento para o teste não depender do relógio.
 */
export function dataRelativa(iso: string, agora: Date = new Date()): string {
  const quando = new Date(iso)
  if (Number.isNaN(quando.getTime())) return ''
  const dias = Math.floor((agora.getTime() - quando.getTime()) / DIA_MS)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 14) return `há ${dias} dias`
  if (dias < 45) return `há ${Math.floor(dias / 7)} semanas`
  return formatarData(iso)
}
