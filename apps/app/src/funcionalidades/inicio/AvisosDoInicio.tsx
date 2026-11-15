import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import type { AvisoDoInicio } from '@/servicos/contratoDosModulos'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'

import { ResumoDoAviso } from '../avisos/TelaAvisos'

/** Avisos publicados no Início: a API já manda os fixados primeiro (até 5). */
export function AvisosDoInicio({
  avisos,
  podePublicar,
}: {
  avisos: readonly AvisoDoInicio[]
  podePublicar: boolean
}) {
  return (
    <Cartao titulo="Avisos" icone="aviso">
      {avisos.length === 0 ? (
        <EstadoVazio
          icone="aviso"
          titulo="Nenhum aviso por enquanto"
          descricao={
            podePublicar
              ? 'Publique um recado para a comunidade; dá para fixar no topo.'
              : 'Quando a organização publicar um aviso, ele aparece aqui.'
          }
          acao={
            podePublicar
              ? {
                  titulo: 'Novo aviso',
                  icone: 'adicionar',
                  aoPressionar: () => router.push('/avisos/novo'),
                }
              : {
                  titulo: 'Ver os avisos',
                  icone: 'aviso',
                  aoPressionar: () => router.push('/avisos'),
                }
          }
        />
      ) : (
        <View style={{ gap: ESPACO.x2 }}>
          {avisos.slice(0, 3).map((a) => (
            <ResumoDoAviso key={a.id} aviso={a} mostrarEstado={false} />
          ))}
          <Botao
            titulo={
              avisos.length > 3 ? `Ver todos os avisos (${avisos.length})` : 'Ver todos os avisos'
            }
            variante="discreto"
            larguraTotal={false}
            aoPressionar={() => router.push('/avisos')}
          />
        </View>
      )}
    </Cartao>
  )
}
