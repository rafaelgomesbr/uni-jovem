import { router } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import type { Membro } from '@/servicos/contrato'
import { Cartao } from '@/ui/Cartao'
import { CampoDeBusca } from '@/ui/Campo'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { ErroDaTela } from '@/ui/Falha'
import { Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'

import { SemComunidade } from '../navegacao/SemComunidade'
import { useMembros } from './consultas'
import { linhaDoMembro } from './LinhaDoMembro'
import { usePode } from './permissoes'
import { VazioComSol } from './VazioComSol'

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Rota `/pessoas`: a lista inteira da comunidade, aberta pela linha "Pessoas" do mural
 * (D70). Busca pelo nome, quem saiu ou foi desativado no fim, e o toque abre a pessoa
 * para quem pode mudar papel ou desativar. Era um segmento da aba; virou tela porque o
 * mural é curto.
 */
export function TelaPessoas() {
  const { comunidadeAtiva } = useSessao()
  return (
    <Tela pilha titulo="Pessoas">
      {comunidadeAtiva ? (
        <Pessoas
          comunidadeId={comunidadeAtiva.id}
          podeAlterar={comunidadeAtiva.estado === 'ativa'}
        />
      ) : (
        <SemComunidade oQue="as pessoas" />
      )}
    </Tela>
  )
}

function Pessoas({ comunidadeId, podeAlterar }: { comunidadeId: string; podeAlterar: boolean }) {
  const membros = useMembros(comunidadeId)
  const pode = usePode()
  const { conta } = useSessao()
  const [busca, setBusca] = useState('')
  const podeEditar =
    podeAlterar &&
    (pode('vinculo', 'alterar_papel') ||
      pode('vinculo', 'desativar') ||
      pode('vinculo', 'designar_equipe_oracao'))

  if (membros.isPending) {
    return (
      <Esqueleto rotulo="Carregando as pessoas">
        <CartaoDeEsqueleto />
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (membros.error) {
    return (
      <ErroDaTela
        erro={membros.error}
        titulo="As pessoas não carregaram"
        aoTentarDeNovo={() => void membros.refetch()}
      />
    )
  }

  const termo = semAcento(busca.trim())
  const casa = (m: Membro) => !termo || semAcento(m.nome).includes(termo)
  const ativos = membros.data.filter((m) => m.estado === 'ativo')
  const fora = membros.data.filter((m) => m.estado !== 'ativo')

  function linha(membro: Membro) {
    const ehVoce = membro.contaId === conta?.id
    // Ninguém mexe no próprio vínculo nem no do Criador (a API recusa os dois).
    const editavel = podeEditar && !ehVoce && !membro.criador
    return linhaDoMembro({
      comunidadeId,
      membro,
      ehVoce,
      ...(editavel
        ? {
            aoPressionar: () =>
              router.push({
                pathname: '/membro/[vinculoId]',
                params: { vinculoId: membro.vinculoId },
              }),
          }
        : {}),
    })
  }

  if (ativos.length <= 1 && fora.length === 0) {
    const convida = pode('convite', 'criar') && podeAlterar
    return (
      <>
        <Cartao lista>
          <Lista>{ativos.map(linha)}</Lista>
        </Cartao>
        <VazioComSol
          titulo="Por enquanto, só você."
          descricao={
            convida
              ? 'Convide o grupo para o Uni Jovem.'
              : 'Quando a liderança convidar mais gente, as pessoas aparecem aqui.'
          }
          {...(convida
            ? {
                acao: {
                  titulo: 'Convidar',
                  icone: 'convidar' as const,
                  aoPressionar: () => router.push('/convidar'),
                },
              }
            : {})}
        />
      </>
    )
  }

  const ativosVisiveis = ativos.filter(casa)
  const foraVisiveis = fora.filter(casa)
  return (
    <>
      <CampoDeBusca rotulo="Buscar pelo nome" valor={busca} aoMudar={setBusca} />
      {ativosVisiveis.length + foraVisiveis.length === 0 ? (
        <EstadoVazio
          icone="buscar"
          titulo="Ninguém com esse nome"
          descricao="Confira a grafia ou busque por outra parte do nome."
          acao={{
            titulo: 'Limpar a busca',
            variante: 'secundario',
            aoPressionar: () => setBusca(''),
          }}
        />
      ) : null}
      {ativosVisiveis.length ? (
        <Cartao lista>
          <Lista>{ativosVisiveis.map(linha)}</Lista>
        </Cartao>
      ) : null}
      {foraVisiveis.length ? (
        <Secao
          titulo="Desativados e removidos"
          rodape="Desativado pode ser reativado. Removido só volta com um convite novo."
        >
          <Cartao lista>
            <Lista>{foraVisiveis.map(linha)}</Lista>
          </Cartao>
        </Secao>
      ) : null}
    </>
  )
}
