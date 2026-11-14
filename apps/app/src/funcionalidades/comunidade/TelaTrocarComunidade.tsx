import { NOME_DO_PAPEL } from '@uj/dominio'
import { router } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Tela } from '@/ui/Tela'

import { NOME_DO_ESTADO_DA_COMUNIDADE } from './nomes'

/** Seletor explícito da comunidade ativa. */
export function TelaTrocarComunidade() {
  const { comunidades, comunidadeAtiva, trocarComunidade } = useSessao()

  return (
    <Tela
      cabecalhoNativo
      titulo="Trocar de comunidade"
      descricao="O que você vê e faz no app vale para a comunidade escolhida."
    >
      <Cartao>
        {comunidades.length === 0 ? (
          <EstadoVazio
            icone="comunidade"
            titulo="Nenhuma comunidade"
            descricao="Quando você aceitar um convite, a comunidade aparece aqui."
          />
        ) : (
          <GrupoDeOpcoes
            rotulo="Suas comunidades"
            valor={comunidadeAtiva?.id ?? null}
            opcoes={comunidades.map((c) => ({
              valor: c.id,
              rotulo: c.nome,
              descricao: [
                NOME_DO_PAPEL[c.papel],
                c.estado !== 'ativa' ? NOME_DO_ESTADO_DA_COMUNIDADE[c.estado] : null,
              ]
                .filter(Boolean)
                .join(' · '),
            }))}
            aoMudar={async (id) => {
              await trocarComunidade(id)
              if (router.canGoBack()) router.back()
              else router.replace('/')
            }}
          />
        )}
      </Cartao>
    </Tela>
  )
}
