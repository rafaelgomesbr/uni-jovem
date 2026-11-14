import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { Aparelho } from '@/servicos/contrato'
import { confirmar } from '@/utilidades/confirmar'
import { formatarDataEHora } from '@/utilidades/formatos'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Linha } from '@/ui/Linha'
import { Selo } from '@/ui/Selo'
import { Tela } from '@/ui/Tela'

const NOME_DA_PLATAFORMA = { ios: 'iPhone ou iPad', android: 'Android', web: 'Navegador' } as const

function nome(aparelho: Aparelho): string {
  return aparelho.aparelho ?? NOME_DA_PLATAFORMA[aparelho.plataforma]
}

export function TelaAparelhos() {
  const consultas = useQueryClient()
  const aparelhos = useQuery({
    queryKey: CHAVES.aparelhos,
    queryFn: () =>
      api.get<{ aparelhos: Aparelho[] }>('/api/v1/eu/aparelhos').then((r) => r.aparelhos),
  })
  const revogar = useMutation({
    mutationFn: (aparelho: Aparelho) => api.delete(`/api/v1/eu/aparelhos/${aparelho.id}`),
    onSuccess: () => consultas.invalidateQueries({ queryKey: CHAVES.aparelhos }),
  })

  async function pedirRevogacao(aparelho: Aparelho) {
    const ok = await confirmar({
      titulo: `Desconectar ${nome(aparelho)}?`,
      mensagem: 'A conta sai desse aparelho. Para voltar, será preciso entrar de novo com a senha.',
      confirmar: 'Desconectar',
      destrutivo: true,
    })
    if (ok) revogar.mutate(aparelho)
  }

  return (
    <Tela
      cabecalhoNativo
      titulo="Aparelhos conectados"
      descricao="Se algum aparelho não for seu, desconecte e troque a senha."
    >
      <Cartao>
        {aparelhos.isPending ? (
          <Carregando texto="Carregando os aparelhos" />
        ) : aparelhos.error ? (
          <AvisoDeErro erro={aparelhos.error} aoTentarDeNovo={() => void aparelhos.refetch()} />
        ) : aparelhos.data.length === 0 ? (
          <EstadoVazio
            icone="aparelho"
            titulo="Nenhum aparelho"
            descricao="Nenhuma sessão aberta além desta."
          />
        ) : (
          <View style={{ gap: ESPACO.x2 }}>
            {revogar.error ? <AvisoDeErro erro={revogar.error} /> : null}
            {aparelhos.data.map((aparelho) => (
              <Linha
                key={aparelho.id}
                icone={aparelho.plataforma === 'web' ? 'computador' : 'aparelho'}
                titulo={nome(aparelho)}
                descricao={`Último uso: ${formatarDataEHora(aparelho.ultimoUso)}`}
                extra={
                  aparelho.atual ? (
                    <Selo texto="Este aparelho" cor="sucesso" />
                  ) : (
                    <Botao
                      titulo="Desconectar"
                      variante="perigo"
                      larguraTotal={false}
                      rotuloAcessivel={`Desconectar ${nome(aparelho)}`}
                      carregando={revogar.isPending && revogar.variables?.id === aparelho.id}
                      aoPressionar={() => void pedirRevogacao(aparelho)}
                    />
                  )
                }
              />
            ))}
          </View>
        )}
      </Cartao>
    </Tela>
  )
}
