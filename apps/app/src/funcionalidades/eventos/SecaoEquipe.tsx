import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { Avatar } from '@/ui/Avatar'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Linha } from '@/ui/Linha'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'

import { usePode } from '../comunidade/permissoes'
import { COR_DO_ESTADO_DA_ATRIBUICAO, NOME_DO_ESTADO_DA_ATRIBUICAO } from './nomes'

/** Equipe do evento como um todo (atribuições sem etapa): apoio, recepção, som. */
export function SecaoEquipe({ evento }: { evento: DetalheDoEvento }) {
  const pode = usePode()
  const atribuir = pode('escala', 'atribuir')
  const geral = evento.atribuicoes.filter((a) => a.etapaId === null)
  if (!atribuir && geral.length === 0) return null
  return (
    <Cartao titulo="Equipe do evento" icone="escalas">
      {geral.length === 0 ? (
        <Texto variante="apoio" cor="textoSuave">
          Ninguém escalado para o evento como um todo. Quem cuida de uma etapa aparece na
          programação.
        </Texto>
      ) : (
        <View style={{ gap: ESPACO.x1 }}>
          {geral.map((a) => (
            <Linha
              key={a.id}
              inicio={<Avatar nome={a.nome} tamanho="P" decorativo />}
              titulo={a.nome}
              descricao={a.funcao}
              extra={
                <Selo
                  texto={NOME_DO_ESTADO_DA_ATRIBUICAO[a.estado]}
                  cor={COR_DO_ESTADO_DA_ATRIBUICAO[a.estado]}
                />
              }
            />
          ))}
        </View>
      )}
      {atribuir ? (
        <Botao
          titulo="Escalar pessoas para o evento"
          icone="convidar"
          variante="secundario"
          aoPressionar={() =>
            router.push({
              pathname: '/evento/[eventoId]/etapa/[etapaId]',
              params: { eventoId: evento.id, etapaId: 'geral' },
            })
          }
        />
      ) : null}
    </Cartao>
  )
}
