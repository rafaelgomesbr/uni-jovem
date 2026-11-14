import { useQuery } from '@tanstack/react-query'
import { NOME_DO_PAPEL } from '@uj/dominio'
import { router } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ConsultaDeConvite, SituacaoDoConvite } from '@/servicos/contrato'
import { useTokenDoFragmento } from '@/utilidades/fragmento'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { IdentidadeDaComunidade } from '../comunidade/Identidade'
import { AceitarComConta } from './AceitarComConta'
import { CadastroPorConvite } from './CadastroPorConvite'
import { lerConviteEmEspera } from './conviteEmEspera'

const SITUACAO: Readonly<Record<Exclude<SituacaoDoConvite, 'valido'>, [string, string]>> = {
  expirado: ['Este convite venceu', 'Peça um convite novo a quem administra a comunidade.'],
  revogado: ['Este convite foi cancelado', 'Peça um convite novo a quem administra a comunidade.'],
  usado: ['Este convite já foi usado', 'Cada convite vale para uma pessoa. Peça um convite novo.'],
  indisponivel: [
    'Convite indisponível',
    'A comunidade deste convite não está recebendo pessoas agora.',
  ],
  inexistente: [
    'Convite não encontrado',
    'Confira se o link chegou inteiro. Se continuar, peça um convite novo.',
  ],
}

export function TelaConvite() {
  const tokenDoLink = useTokenDoFragmento()
  const [tokenGuardado] = useState(lerConviteEmEspera)
  const token = tokenDoLink ?? tokenGuardado
  const sessao = useSessao()

  const consulta = useQuery({
    queryKey: ['convite', token],
    queryFn: () =>
      api.post<ConsultaDeConvite>('/api/auth/convite/consultar', { token }, { autenticado: false }),
    enabled: token !== null,
    staleTime: Infinity,
  })

  if (!token) {
    return (
      <Tela cabecalhoNativo>
        <EstadoVazio
          icone="link"
          titulo="Link de convite incompleto"
          descricao="Abra de novo o link que você recebeu. Ele precisa chegar inteiro, do começo ao fim."
        />
      </Tela>
    )
  }

  if (consulta.isPending) {
    return (
      <Tela cabecalhoNativo>
        <Carregando texto="Abrindo o convite" />
      </Tela>
    )
  }

  if (consulta.error) {
    return (
      <Tela cabecalhoNativo>
        <AvisoDeErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />
      </Tela>
    )
  }

  const convite = consulta.data
  if (convite.situacao !== 'valido' || !convite.comunidade || !convite.papel) {
    const [titulo, descricao] =
      SITUACAO[convite.situacao === 'valido' ? 'inexistente' : convite.situacao]
    return (
      <Tela cabecalhoNativo>
        <EstadoVazio
          icone="erro"
          titulo={titulo}
          descricao={descricao}
          acao={{
            titulo: sessao.estado === 'autenticado' ? 'Ir para o início' : 'Ir para entrar',
            aoPressionar: () => router.replace(sessao.estado === 'autenticado' ? '/' : '/entrar'),
          }}
        />
      </Tela>
    )
  }

  const papel = NOME_DO_PAPEL[convite.papel]
  return (
    <Tela cabecalhoNativo titulo="Você recebeu um convite">
      <Cartao>
        <IdentidadeDaComunidade
          nome={convite.comunidade.nome}
          cor={convite.comunidade.cor}
          detalhe={`Papel: ${papel}`}
        />
        <Texto>
          Você foi convidado para participar de {convite.comunidade.nome} como {papel}.
        </Texto>
        {convite.emailDestinoMascarado ? (
          <Texto variante="apoio" cor="textoSuave">
            Este convite é para o e-mail {convite.emailDestinoMascarado}.
          </Texto>
        ) : null}
      </Cartao>
      {sessao.estado === 'autenticado' ? (
        <AceitarComConta token={token} comunidade={convite.comunidade.nome} papel={papel} />
      ) : (
        <CadastroPorConvite token={token} comunidade={convite.comunidade.nome} />
      )}
    </Tela>
  )
}
