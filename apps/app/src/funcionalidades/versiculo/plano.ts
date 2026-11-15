import { proximosVersiculos } from '@uj/conteudo'

/** Quantos dias o aparelho deixa agendados (o iOS aceita até 64 pendentes). */
export const DIAS_AGENDADOS = 30

/** Prefixo dos identificadores: só estas notificações são canceladas ao reagendar. */
export const PREFIXO = 'uj-versiculo-'

export interface VersiculoAgendado {
  id: string
  quando: Date
  titulo: string
  corpo: string
}

function dois(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * Os próximos `DIAS_AGENDADOS` versículos no horário escolhido, no fuso do
 * aparelho. Se o horário de hoje já passou, começa amanhã. Função pura: o
 * mesmo `agora` gera sempre o mesmo plano (é o que os testes conferem).
 */
export function planejarVersiculos(
  agora: Date,
  hora: string,
  quantidade = DIAS_AGENDADOS,
): VersiculoAgendado[] {
  const [h, m] = hora.split(':').map(Number) as [number, number]
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, m)
  const inicio = hoje.getTime() > agora.getTime() ? hoje : new Date(hoje.getTime() + 86_400_000)
  return proximosVersiculos(inicio, quantidade).map(({ data, versiculo }) => {
    const quando = new Date(data.getFullYear(), data.getMonth(), data.getDate(), h, m)
    return {
      id: `${PREFIXO}${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`,
      quando,
      titulo: `Versículo do dia: ${versiculo.referencia}`,
      corpo: versiculo.texto,
    }
  })
}

/** Fuso do aparelho agora (muda quando a pessoa viaja). */
export function fusoAtual(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'desconhecido'
  } catch {
    return 'desconhecido'
  }
}
