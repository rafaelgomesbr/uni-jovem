import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NOME_DO_PAPEL } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ComunidadeDoVinculo, ConviteDaComunidade } from '@/servicos/contrato'
import { confirmar } from '@/utilidades/confirmar'
import { formatarData } from '@/utilidades/formatos'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Linha } from '@/ui/Linha'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'

import { TelaDoApp } from '../navegacao/TelaDoApp'
import { mensagemDePendencias } from '../offline/avisoAntesDeApagar'
import { useOffline } from '../offline/ProvedorOffline'
import { useConvites, useMembros } from './consultas'
import { IdentidadeDaComunidade } from './Identidade'
import {
  COR_DO_ESTADO_DA_COMUNIDADE,
  NOME_DA_SITUACAO_DO_CONVITE,
  NOME_DO_ESTADO_DA_COMUNIDADE,
  NOME_DO_ESTADO_DO_VINCULO,
} from './nomes'
import { usePode } from './permissoes'

export function TelaComunidade() {
  const { comunidadeAtiva, comunidades } = useSessao()

  if (!comunidadeAtiva) {
    return (
      <TelaDoApp titulo="Comunidade">
        <Cartao>
          <EstadoVazio
            icone="comunidade"
            titulo={comunidades.length ? 'Escolha uma comunidade' : 'Nenhuma comunidade'}
            descricao={
              comunidades.length
                ? 'Escolha a comunidade para ver as pessoas e os convites dela.'
                : 'Quando você aceitar um convite, a comunidade aparece aqui.'
            }
            {...(comunidades.length
              ? {
                  acao: {
                    titulo: 'Escolher comunidade',
                    aoPressionar: () => router.push('/trocar-comunidade'),
                  },
                }
              : {})}
          />
        </Cartao>
      </TelaDoApp>
    )
  }

  return <DetalheDaComunidade comunidade={comunidadeAtiva} />
}

function DetalheDaComunidade({ comunidade }: { comunidade: ComunidadeDoVinculo }) {
  const pode = usePode()
  const consultas = useQueryClient()
  const podeConvidar = pode('convite', 'listar')

  const offline = useOffline()
  const sair = useMutation({
    mutationFn: () => api.post(`/api/v1/c/${comunidade.id}/sair`),
    onSuccess: async () => {
      // Fora da comunidade, a partição dela sai do aparelho.
      await offline.apagarComunidade(comunidade.id)
      await consultas.invalidateQueries({ queryKey: CHAVES.eu })
      router.replace('/')
    },
  })

  async function pedirParaSair() {
    const naoEnviadas = await offline.naoEnviadas(comunidade.id)
    const ok = await confirmar({
      titulo: `Sair de ${comunidade.nome}?`,
      mensagem: `Você deixa de ver a agenda e as programações desta comunidade. Para voltar, vai precisar de um convite novo.${
        naoEnviadas.length
          ? `

${mensagemDePendencias(naoEnviadas)}`
          : ''
      }`,
      confirmar: `Sair de ${comunidade.nome}`,
      destrutivo: true,
    })
    if (ok) sair.mutate()
  }

  return (
    <TelaDoApp titulo="Comunidade">
      <Cartao>
        <IdentidadeDaComunidade
          nome={comunidade.nome}
          cor={comunidade.cor}
          detalhe={`Seu papel: ${NOME_DO_PAPEL[comunidade.papel]}`}
        />
        <Selo
          texto={NOME_DO_ESTADO_DA_COMUNIDADE[comunidade.estado]}
          cor={COR_DO_ESTADO_DA_COMUNIDADE[comunidade.estado]}
        />
        {comunidade.designacoes.includes('equipe_oracao') ? (
          <Texto variante="apoio" cor="textoSuave">
            Você faz parte da equipe de oração.
          </Texto>
        ) : null}
      </Cartao>

      {podeConvidar ? <Convites comunidade={comunidade} /> : null}
      <Membros comunidade={comunidade} />

      <Cartao titulo="Sair da comunidade" icone="sair">
        <Texto variante="apoio" cor="textoSuave">
          Sair apaga o seu vínculo com {comunidade.nome}. Sua conta continua existindo.
        </Texto>
        {sair.error ? <AvisoDeErro erro={sair.error} /> : null}
        <Botao
          titulo={`Sair de ${comunidade.nome}`}
          variante="perigo"
          icone="sair"
          aoPressionar={() => void pedirParaSair()}
          carregando={sair.isPending}
        />
      </Cartao>
    </TelaDoApp>
  )
}

function Membros({ comunidade }: { comunidade: ComunidadeDoVinculo }) {
  const pode = usePode()
  const membros = useMembros(comunidade.id)
  const podeAlterar = pode('vinculo', 'alterar_papel')
  const { conta } = useSessao()

  return (
    <Cartao titulo="Pessoas" icone="comunidade">
      {membros.isPending ? (
        <Carregando texto="Carregando as pessoas" />
      ) : membros.error ? (
        <AvisoDeErro erro={membros.error} aoTentarDeNovo={() => void membros.refetch()} />
      ) : membros.data.length === 0 ? (
        <EstadoVazio
          icone="convidar"
          titulo="Ninguém por aqui ainda"
          descricao="Convide as pessoas da liderança para começar."
        />
      ) : (
        <View style={{ gap: ESPACO.x1 }}>
          {membros.data.map((membro) => {
            const detalhes = [
              NOME_DO_PAPEL[membro.papel],
              membro.estado !== 'ativo' ? NOME_DO_ESTADO_DO_VINCULO[membro.estado] : null,
              membro.designacoes.includes('equipe_oracao') ? 'Equipe de oração' : null,
              membro.criador ? 'Criador da plataforma' : null,
              membro.email,
              membro.whatsapp,
            ].filter(Boolean)
            const ehVoce = membro.contaId === conta?.id
            const editavel = podeAlterar && !ehVoce && !membro.criador
            return (
              <Linha
                key={membro.vinculoId}
                titulo={ehVoce ? `${membro.nome} (você)` : membro.nome}
                descricao={detalhes.join(' · ')}
                {...(editavel
                  ? {
                      aoPressionar: () =>
                        router.push({
                          pathname: '/membro/[vinculoId]',
                          params: { vinculoId: membro.vinculoId },
                        }),
                      rotuloAcessivel: `Alterar ${membro.nome}. ${detalhes.join(', ')}`,
                    }
                  : {})}
              />
            )
          })}
        </View>
      )}
    </Cartao>
  )
}

function Convites({ comunidade }: { comunidade: ComunidadeDoVinculo }) {
  const convites = useConvites(comunidade.id, true)
  const consultas = useQueryClient()
  const revogar = useMutation({
    mutationFn: (convite: ConviteDaComunidade) =>
      api.post(`/api/v1/c/${comunidade.id}/convites/${convite.id}/revogar`),
    onSuccess: () => consultas.invalidateQueries({ queryKey: CHAVES.convites(comunidade.id) }),
  })

  async function pedirRevogacao(convite: ConviteDaComunidade) {
    const ok = await confirmar({
      titulo: 'Cancelar este convite?',
      mensagem: `O link deixa de funcionar e ninguém mais entra em ${comunidade.nome} por ele.`,
      confirmar: 'Cancelar convite',
      destrutivo: true,
    })
    if (ok) revogar.mutate(convite)
  }

  const validos = convites.data?.filter((c) => c.situacao === 'valido') ?? []
  const outros = convites.data?.filter((c) => c.situacao !== 'valido').slice(0, 10) ?? []

  return (
    <Cartao titulo="Convites" icone="convidar">
      <Botao
        titulo={`Convidar para ${comunidade.nome}`}
        icone="adicionar"
        aoPressionar={() => router.push('/convidar')}
      />
      {convites.isPending ? (
        <Carregando texto="Carregando os convites" />
      ) : convites.error ? (
        <AvisoDeErro erro={convites.error} aoTentarDeNovo={() => void convites.refetch()} />
      ) : convites.data.length === 0 ? (
        <Texto variante="apoio" cor="textoSuave">
          Nenhum convite criado ainda. Cada convite gera um link que vale para uma pessoa.
        </Texto>
      ) : (
        <View style={{ gap: ESPACO.x2 }}>
          {revogar.error ? <AvisoDeErro erro={revogar.error} /> : null}
          {[...validos, ...outros].map((convite) => {
            const descricao = [
              convite.emailDestino ? `Para ${convite.emailDestino}` : 'Link aberto',
              convite.situacao === 'valido'
                ? `vale até ${formatarData(convite.expiraEm)}`
                : `criado em ${formatarData(convite.criadoEm)}`,
            ].join(' · ')
            return (
              <Linha
                key={convite.id}
                titulo={NOME_DO_PAPEL[convite.papel]}
                descricao={descricao}
                extra={
                  convite.situacao === 'valido' ? (
                    <Botao
                      titulo="Cancelar"
                      variante="perigo"
                      larguraTotal={false}
                      rotuloAcessivel={`Cancelar convite de ${NOME_DO_PAPEL[convite.papel]}. ${descricao}`}
                      aoPressionar={() => void pedirRevogacao(convite)}
                      carregando={revogar.isPending && revogar.variables?.id === convite.id}
                    />
                  ) : (
                    <Selo texto={NOME_DA_SITUACAO_DO_CONVITE[convite.situacao]} />
                  )
                }
              />
            )
          })}
        </View>
      )}
    </Cartao>
  )
}
