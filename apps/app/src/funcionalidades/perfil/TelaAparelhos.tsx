import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { Aparelho } from '@/servicos/contrato'
import { mensagemDoErro, SemConexao } from '@/servicos/erros'
import { confirmar } from '@/utilidades/confirmar'
import { formatarDataEHora } from '@/utilidades/formatos'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Tela } from '@/ui/Tela'
import { mostrarToast } from '@/ui/Toast'

const NOME_DA_PLATAFORMA = { ios: 'iPhone ou iPad', android: 'Android', web: 'Navegador' } as const

function nome(aparelho: Aparelho): string {
  return aparelho.aparelho ?? NOME_DA_PLATAFORMA[aparelho.plataforma]
}

/**
 * Aparelhos conectados (3.6.5): cartão lista com o ladrilho do tipo de
 * aparelho, o nome, quando foi visto e, à direita, o chip "Este aparelho" ou
 * o destrutivo "Desconectar" (com confirmação nativa).
 */
export function TelaAparelhos() {
  const consultas = useQueryClient()
  const aparelhos = useQuery({
    queryKey: CHAVES.aparelhos,
    queryFn: () =>
      api.get<{ aparelhos: Aparelho[] }>('/api/v1/eu/aparelhos').then((r) => r.aparelhos),
  })
  const revogar = useMutation({
    mutationFn: (aparelho: Aparelho) => api.delete(`/api/v1/eu/aparelhos/${aparelho.id}`),
    onSuccess: (_r, aparelho) => {
      mostrarToast({ texto: `${nome(aparelho)} desconectado` })
      return consultas.invalidateQueries({ queryKey: CHAVES.aparelhos })
    },
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
      pilha
      titulo="Aparelhos conectados"
      descricao="Se algum aparelho não for seu, desconecte e troque a senha."
    >
      {aparelhos.isPending ? (
        <Esqueleto rotulo="Carregando os aparelhos">
          <CartaoDeEsqueleto />
        </Esqueleto>
      ) : aparelhos.error ? (
        <EstadoVazio
          icone={aparelhos.error instanceof SemConexao ? 'semConexao' : 'erro'}
          titulo="Não deu para carregar os aparelhos"
          descricao={mensagemDoErro(aparelhos.error)}
          acao={{ titulo: 'Tentar de novo', aoPressionar: () => void aparelhos.refetch() }}
        />
      ) : aparelhos.data.length === 0 ? (
        <EstadoVazio
          icone="aparelho"
          titulo="Nenhum aparelho"
          descricao="Nenhuma sessão aberta além desta."
          acao={{
            titulo: 'Verificar de novo',
            icone: 'sincronizar',
            variante: 'secundario',
            aoPressionar: () => void aparelhos.refetch(),
          }}
        />
      ) : (
        <>
          {revogar.error ? (
            <Aviso tipo="erro" titulo="Não deu para desconectar" anunciar>
              {mensagemDoErro(revogar.error)}
            </Aviso>
          ) : null}
          <CartaoDeVidro lista opaco>
            <Lista>
              {aparelhos.data.map((aparelho) => (
                <LinhaDeLista
                  key={aparelho.id}
                  icone={aparelho.plataforma === 'web' ? 'computador' : 'aparelho'}
                  titulo={nome(aparelho)}
                  descricao={`Visto em ${formatarDataEHora(aparelho.ultimoUso)}`}
                  extra={
                    aparelho.atual ? (
                      <Chip texto="Este aparelho" tom="quente" />
                    ) : (
                      <Botao
                        titulo="Desconectar"
                        variante="destrutivo"
                        rotuloAcessivel={`Desconectar ${nome(aparelho)}`}
                        carregando={revogar.isPending && revogar.variables?.id === aparelho.id}
                        aoPressionar={() => void pedirRevogacao(aparelho)}
                      />
                    )
                  }
                />
              ))}
            </Lista>
          </CartaoDeVidro>
        </>
      )}
    </Tela>
  )
}
