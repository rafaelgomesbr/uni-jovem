import { useMutation, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { ComunidadeDaPlataforma, EstadoDaComunidade } from '@/servicos/contrato'
import { confirmar } from '@/utilidades/confirmar'
import { formatarData } from '@/utilidades/formatos'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Selo } from '@/ui/Selo'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { IdentidadeDaComunidade } from '../comunidade/Identidade'
import { COR_DO_ESTADO_DA_COMUNIDADE, NOME_DO_ESTADO_DA_COMUNIDADE } from '../comunidade/nomes'
import { useComunidadesDaPlataforma } from './consultas'
import { exigeProvaDeSegundoFator, ProvaDeSegundoFator } from './ProvaDeSegundoFator'

interface Mudanca {
  estado: EstadoDaComunidade
  confirmacaoNome?: string
}

export function TelaComunidadeDaPlataforma() {
  const { comunidadeId } = useLocalSearchParams<{ comunidadeId: string }>()
  const comunidades = useComunidadesDaPlataforma()
  const comunidade = comunidades.data?.find((c) => c.id === comunidadeId)

  if (comunidades.isPending) {
    return (
      <Tela cabecalhoNativo>
        <Carregando />
      </Tela>
    )
  }
  if (exigeProvaDeSegundoFator(comunidades.error)) {
    return (
      <Tela cabecalhoNativo>
        <ProvaDeSegundoFator aoConfirmar={() => void comunidades.refetch()} />
      </Tela>
    )
  }
  if (comunidades.error) {
    return (
      <Tela cabecalhoNativo>
        <AvisoDeErro erro={comunidades.error} aoTentarDeNovo={() => void comunidades.refetch()} />
      </Tela>
    )
  }
  if (!comunidade) {
    return (
      <Tela cabecalhoNativo>
        <EstadoVazio
          icone="plataforma"
          titulo="Comunidade não encontrada"
          descricao="Ela pode ter sido excluída."
          acao={{ titulo: 'Voltar', aoPressionar: () => router.back() }}
        />
      </Tela>
    )
  }
  return <CicloDeVida comunidade={comunidade} />
}

function CicloDeVida({ comunidade }: { comunidade: ComunidadeDaPlataforma }) {
  const consultas = useQueryClient()
  const [nomeDigitado, setNomeDigitado] = useState('')
  const [pendente, setPendente] = useState<Mudanca | null>(null)

  const mudar = useMutation({
    mutationFn: (mudanca: Mudanca) =>
      api.patch(`/api/v1/plataforma/comunidades/${comunidade.id}/estado`, mudanca),
    onMutate: (mudanca) => setPendente(mudanca),
    onSuccess: async () => {
      setPendente(null)
      setNomeDigitado('')
      await consultas.invalidateQueries({ queryKey: CHAVES.plataforma })
    },
  })

  async function pedir(mudanca: Mudanca, titulo: string, mensagem: string, rotulo: string) {
    const ok = await confirmar({ titulo, mensagem, confirmar: rotulo, destrutivo: true })
    if (ok) mudar.mutate(mudanca)
  }

  const nome = comunidade.nome
  const nomeConfere = nomeDigitado.trim() === nome
  const precisaProva = exigeProvaDeSegundoFator(mudar.error)

  return (
    <Tela cabecalhoNativo titulo={nome}>
      <Cartao>
        <IdentidadeDaComunidade
          nome={nome}
          cor={comunidade.cor}
          detalhe={`${comunidade.membrosAtivos} pessoas ativas, ${comunidade.adminsAtivos} na administração`}
        />
        <Selo
          texto={NOME_DO_ESTADO_DA_COMUNIDADE[comunidade.estado]}
          cor={COR_DO_ESTADO_DA_COMUNIDADE[comunidade.estado]}
        />
        {comunidade.exclusaoAgendadaPara ? (
          <Texto variante="apoio">
            Os dados serão apagados em {formatarData(comunidade.exclusaoAgendadaPara)}. Até lá, dá
            para cancelar reativando a comunidade.
          </Texto>
        ) : null}
      </Cartao>

      {precisaProva && pendente ? (
        <ProvaDeSegundoFator aoConfirmar={() => mudar.mutate(pendente)} />
      ) : null}
      {mudar.error && !precisaProva ? <AvisoDeErro erro={mudar.error} /> : null}

      <Cartao titulo="Situação" icone="plataforma">
        {comunidade.estado === 'ativa' ? (
          <>
            <Botao
              titulo={`Suspender ${nome}`}
              variante="secundario"
              carregando={mudar.isPending && pendente?.estado === 'suspensa'}
              aoPressionar={() =>
                void pedir(
                  { estado: 'suspensa' },
                  `Suspender ${nome}?`,
                  'A comunidade fica somente leitura e para de enviar notificações. Dá para reativar depois.',
                  `Suspender ${nome}`,
                )
              }
            />
            <Botao
              titulo={`Arquivar ${nome}`}
              variante="secundario"
              carregando={mudar.isPending && pendente?.estado === 'arquivada'}
              aoPressionar={() =>
                void pedir(
                  { estado: 'arquivada' },
                  `Arquivar ${nome}?`,
                  'A comunidade some para os membros; só a exportação continua disponível.',
                  `Arquivar ${nome}`,
                )
              }
            />
          </>
        ) : (
          <Botao
            titulo={
              comunidade.estado === 'exclusao_agendada'
                ? `Cancelar a exclusão e reativar ${nome}`
                : `Reativar ${nome}`
            }
            carregando={mudar.isPending && pendente?.estado === 'ativa'}
            aoPressionar={() => mudar.mutate({ estado: 'ativa' })}
          />
        )}
      </Cartao>

      {comunidade.estado !== 'exclusao_agendada' ? (
        <Cartao titulo="Agendar exclusão" icone="excluir">
          <Texto variante="apoio">
            Depois de 30 dias de carência, todos os dados de {nome} são apagados. Uma exportação é
            gerada antes para a administração.
          </Texto>
          <Campo
            rotulo={`Para confirmar, digite o nome: ${nome}`}
            value={nomeDigitado}
            onChangeText={setNomeDigitado}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
          />
          <Botao
            titulo={`Agendar exclusão de ${nome}`}
            variante="perigo"
            icone="excluir"
            desabilitado={!nomeConfere}
            motivo="Digite o nome exato da comunidade para liberar."
            carregando={mudar.isPending && pendente?.estado === 'exclusao_agendada'}
            aoPressionar={() =>
              void pedir(
                { estado: 'exclusao_agendada', confirmacaoNome: nomeDigitado.trim() },
                `Agendar a exclusão de ${nome}?`,
                'Os dados serão apagados em 30 dias. Até lá, dá para cancelar.',
                `Agendar exclusão de ${nome}`,
              )
            }
          />
        </Cartao>
      ) : null}
    </Tela>
  )
}
