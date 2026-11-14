import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Linha } from '@/ui/Linha'
import { Tela } from '@/ui/Tela'

import { NOME_DO_ESTADO_DA_COMUNIDADE } from '../comunidade/nomes'
import { useComunidadesDaPlataforma } from './consultas'
import { exigeProvaDeSegundoFator, ProvaDeSegundoFator } from './ProvaDeSegundoFator'

export function TelaPlataforma() {
  const { conta } = useSessao()
  const comunidades = useComunidadesDaPlataforma()

  if (!conta?.criador) {
    return (
      <Tela cabecalhoNativo>
        <EstadoVazio
          icone="seguranca"
          titulo="Área do Criador"
          descricao="Só quem criou a plataforma acessa esta área."
          acao={{ titulo: 'Voltar', aoPressionar: () => router.back() }}
        />
      </Tela>
    )
  }

  return (
    <Tela
      cabecalhoNativo
      titulo="Plataforma"
      descricao="Comunidades da plataforma. Ações aqui são registradas na auditoria."
    >
      {exigeProvaDeSegundoFator(comunidades.error) ? (
        <ProvaDeSegundoFator aoConfirmar={() => void comunidades.refetch()} />
      ) : (
        <>
          <Botao
            titulo="Criar comunidade"
            icone="adicionar"
            aoPressionar={() => router.push('/plataforma/nova')}
          />
          <Cartao titulo="Comunidades" icone="plataforma">
            {comunidades.isPending ? (
              <Carregando texto="Carregando as comunidades" />
            ) : comunidades.error ? (
              <AvisoDeErro
                erro={comunidades.error}
                aoTentarDeNovo={() => void comunidades.refetch()}
              />
            ) : comunidades.data.length === 0 ? (
              <EstadoVazio
                icone="plataforma"
                titulo="Nenhuma comunidade ainda"
                descricao="Crie a primeira e mande o convite para quem vai administrá-la."
              />
            ) : (
              <View style={{ gap: ESPACO.x1 }}>
                {comunidades.data.map((c) => (
                  <Linha
                    key={c.id}
                    titulo={c.nome}
                    descricao={[
                      NOME_DO_ESTADO_DA_COMUNIDADE[c.estado],
                      `${c.membrosAtivos} ${c.membrosAtivos === 1 ? 'pessoa ativa' : 'pessoas ativas'}`,
                      c.adminsAtivos === 0 ? 'sem administrador' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    aoPressionar={() =>
                      router.push({
                        pathname: '/plataforma/[comunidadeId]',
                        params: { comunidadeId: c.id },
                      })
                    }
                  />
                ))}
              </View>
            )}
          </Cartao>
        </>
      )}
    </Tela>
  )
}
