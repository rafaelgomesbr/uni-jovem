import { View } from 'react-native'

import type { ResumoDoEvento } from '@/servicos/contratoDosEventos'
import { DIAS_CURTOS, diaDaSemana, somarDias, type DataLocal } from '@/utilidades/datas'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'

import { CALENDARIO } from './medidas'
import { CelulaDoDia } from './VistaDoMes'

interface Props {
  inicio: DataLocal
  hoje: DataLocal
  selecionado: DataLocal
  porDia: Map<DataLocal, ResumoDoEvento[]>
  aoEscolher: (dia: DataLocal) => void
}

/**
 * Semana (3.3.2): faixa de 7 dias num cartão de vidro, cada dia numa célula
 * de 44 × 64 com o dia da semana, o número em `tituloItem` e os pontos.
 * Hoje e o escolhido seguem o mês. A lista do dia escolhido vem abaixo.
 */
export function VistaDaSemana({ inicio, hoje, selecionado, porDia, aoEscolher }: Props) {
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i))
  return (
    <CartaoDeVidro>
      <View style={{ flexDirection: 'row' }}>
        {dias.map((dia) => (
          <CelulaDoDia
            key={dia}
            dia={dia}
            numero={Number(dia.slice(8, 10))}
            eventos={porDia.get(dia)?.length ?? 0}
            hoje={hoje}
            escolhido={dia === selecionado}
            doMes
            altura={CALENDARIO.alturaDaSemana}
            aoEscolher={aoEscolher}
            diaDaSemana={DIAS_CURTOS[diaDaSemana(dia)]}
          />
        ))}
      </View>
    </CartaoDeVidro>
  )
}
