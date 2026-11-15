import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NOME_DO_PAPEL } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { ComunidadeDoVinculo, ConviteDaComunidade } from '@/servicos/contrato'
import { confirmar } from '@/utilidades/confirmar'
import { formatarData } from '@/utilidades/formatos'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Secao } from '@/ui/Secao'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'

import { useConvites } from './consultas'
import { CHIP_DA_SITUACAO_DO_CONVITE, CHIP_DO_PAPEL, NOME_DA_SITUACAO_DO_CONVITE } from './nomes'
import { Chip, Chips } from './visual'

/** Quantos convites já encerrados (usados, vencidos, revogados) aparecem. */
const ENCERRADOS_VISIVEIS = 10

function convidarDeNovo(convite: ConviteDaComunidade) {
  router.push({
    pathname: '/convidar',
    params: {
      papel: convite.papel,
      ...(convite.emailDestino ? { email: convite.emailDestino } : {}),
    },
  })
}

/** Convites da comunidade: pendentes primeiro, com revogar e convidar de novo. */
export function SecaoConvites({
  comunidade,
  podeAlterar,
}: {
  comunidade: ComunidadeDoVinculo
  /** Comunidade suspensa: só consulta. */
  podeAlterar: boolean
}) {
  const convites = useConvites(comunidade.id, true)
  const consultas = useQueryClient()
  const [aviso, setAviso] = useState<string | null>(null)
  const [verTodos, setVerTodos] = useState(false)
  const revogar = useMutation({
    mutationFn: (convite: ConviteDaComunidade) =>
      api.post(`/api/v1/c/${comunidade.id}/convites/${convite.id}/revogar`),
    onSuccess: async () => {
      setAviso('Convite revogado. O link deixou de funcionar.')
      await consultas.invalidateQueries({ queryKey: CHAVES.convites(comunidade.id) })
    },
  })

  async function pedirRevogacao(convite: ConviteDaComunidade) {
    setAviso(null)
    const ok = await confirmar({
      titulo: 'Revogar este convite?',
      mensagem: `O link deixa de funcionar e ninguém mais entra em ${comunidade.nome} por ele. Dá para criar outro depois.`,
      confirmar: 'Revogar convite',
      destrutivo: true,
    })
    if (ok) revogar.mutate(convite)
  }

  const pendentes = convites.data?.filter((c) => c.situacao === 'valido') ?? []
  const encerrados = convites.data?.filter((c) => c.situacao !== 'valido') ?? []
  const encerradosVisiveis = verTodos ? encerrados : encerrados.slice(0, ENCERRADOS_VISIVEIS)

  return (
    <Secao
      titulo={pendentes.length ? `Convites (${pendentes.length} pendentes)` : 'Convites'}
      rodape="Por segurança, o link só aparece quando o convite é criado. Perdeu o link? Revogue e convide de novo."
    >
      <Cartao>
        {convites.isPending ? (
          <Carregando texto="Carregando os convites" />
        ) : convites.error ? (
          <AvisoDeErro erro={convites.error} aoTentarDeNovo={() => void convites.refetch()} />
        ) : convites.data.length === 0 ? (
          <EstadoVazio
            icone="convidar"
            titulo="Ainda não há convites"
            descricao="Convide a primeira pessoa. Cada convite gera um link que vale para uma pessoa."
            {...(podeAlterar
              ? {
                  acao: {
                    titulo: 'Convidar a primeira pessoa',
                    icone: 'convidar' as const,
                    variante: 'primario' as const,
                    aoPressionar: () => router.push('/convidar'),
                  },
                }
              : {})}
          />
        ) : (
          <View style={{ gap: ESPACO.x4 }}>
            {revogar.error ? <AvisoDeErro erro={revogar.error} /> : null}
            {aviso ? <TextoAnunciado variante="apoio">{aviso}</TextoAnunciado> : null}
            {[...pendentes, ...encerradosVisiveis].map((convite) => (
              <ItemDoConvite
                key={convite.id}
                convite={convite}
                podeAlterar={podeAlterar}
                revogando={revogar.isPending && revogar.variables?.id === convite.id}
                aoRevogar={() => void pedirRevogacao(convite)}
              />
            ))}
            {!verTodos && encerrados.length > ENCERRADOS_VISIVEIS ? (
              <Botao
                titulo={`Ver os ${encerrados.length - ENCERRADOS_VISIVEIS} convites mais antigos`}
                variante="terciario"
                aoPressionar={() => setVerTodos(true)}
              />
            ) : null}
          </View>
        )}
      </Cartao>
    </Secao>
  )
}

function ItemDoConvite({
  convite,
  podeAlterar,
  revogando,
  aoRevogar,
}: {
  convite: ConviteDaComunidade
  podeAlterar: boolean
  revogando: boolean
  aoRevogar: () => void
}) {
  const situacao = NOME_DA_SITUACAO_DO_CONVITE[convite.situacao]
  const papel = NOME_DO_PAPEL[convite.papel]
  const para = convite.emailDestino ? `Para ${convite.emailDestino}` : 'Link aberto, sem e-mail'
  const datas =
    convite.situacao === 'valido'
      ? `Criado em ${formatarData(convite.criadoEm)} · vale até ${formatarData(convite.expiraEm)}`
      : `Criado em ${formatarData(convite.criadoEm)}`
  const resumo = `Convite de ${papel}. ${situacao}. ${para}. ${datas}`

  return (
    <View style={{ gap: ESPACO.x2 }}>
      <View accessible accessibilityLabel={resumo} style={{ gap: ESPACO.x1 }}>
        <Chips>
          <Chip
            texto={situacao}
            icone={CHIP_DA_SITUACAO_DO_CONVITE[convite.situacao].icone}
            tom={CHIP_DA_SITUACAO_DO_CONVITE[convite.situacao].tom}
          />
          <Chip
            texto={papel}
            icone={CHIP_DO_PAPEL[convite.papel].icone}
            tom={CHIP_DO_PAPEL[convite.papel].tom}
          />
        </Chips>
        <Texto variante="corpoForte">{para}</Texto>
        <Texto variante="apoio" cor="textoSuave">
          {datas}
        </Texto>
      </View>
      {podeAlterar ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
          {convite.situacao === 'valido' ? (
            <Botao
              titulo="Revogar"
              icone="cancelar"
              variante="perigo"
              larguraTotal={false}
              rotuloAcessivel={`Revogar convite de ${papel}. ${para}`}
              aoPressionar={aoRevogar}
              carregando={revogando}
            />
          ) : null}
          {convite.situacao !== 'usado' ? (
            <Botao
              titulo="Convidar de novo"
              icone="repetir"
              variante="secundario"
              larguraTotal={false}
              rotuloAcessivel={`Criar um convite novo de ${papel}. ${para}`}
              aoPressionar={() => convidarDeNovo(convite)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
