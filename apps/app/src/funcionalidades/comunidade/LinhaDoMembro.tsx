import { NOME_DO_PAPEL } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import type { Membro } from '@/servicos/contrato'
import { Chip } from '@/ui/Chip'
import { LinhaDeLista } from '@/ui/LinhaDeLista'

import { fotoDoMembro } from '../perfil/imagens'
import { CHIP_DO_ESTADO_DO_VINCULO, CHIP_DO_PAPEL, NOME_DO_ESTADO_DO_VINCULO } from './nomes'

interface Props {
  /** Para o endereço da foto (a API só serve a quem tem vínculo ativo na comunidade). */
  comunidadeId: string
  membro: Membro
  ehVoce: boolean
  aoPressionar?: () => void
}

/**
 * Pessoa da equipe (quadro 08a): avatar de 40, o nome ("Ana Lima (você)") e,
 * à direita, o chip do papel, o chip "Oração" quando houver e o chevron se
 * a linha abre a pessoa. E-mail e WhatsApp ficam só no detalhe. Devolve a
 * própria `LinhaDeLista` (com a chave), para a `Lista` recuar o separador.
 */
export function linhaDoMembro({ comunidadeId, membro, ehVoce, aoPressionar }: Props) {
  const oracao = membro.designacoes.includes('equipe_oracao')
  const nome = ehVoce ? `${membro.nome} (você)` : membro.nome
  const papel = NOME_DO_PAPEL[membro.papel]
  const falado = [
    nome,
    papel,
    membro.estado !== 'ativo' ? NOME_DO_ESTADO_DO_VINCULO[membro.estado] : null,
    oracao ? 'Equipe de oração' : null,
    membro.criador ? 'Criador da plataforma' : null,
  ]
    .filter(Boolean)
    .join('. ')

  return (
    <LinhaDeLista
      key={membro.vinculoId}
      avatar={{
        nome: membro.nome,
        dados: { ...(membro.avatar ?? {}), foto: fotoDoMembro(comunidadeId, membro) },
      }}
      titulo={nome}
      extra={
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: ESPACO.e4,
            flexShrink: 1,
          }}
        >
          <Chip texto={papel} tom={CHIP_DO_PAPEL[membro.papel].tom} />
          {membro.estado !== 'ativo' ? (
            <Chip
              texto={NOME_DO_ESTADO_DO_VINCULO[membro.estado]}
              tom={CHIP_DO_ESTADO_DO_VINCULO[membro.estado].tom}
            />
          ) : null}
          {oracao ? <Chip texto="Oração" tom="quente" /> : null}
        </View>
      }
      rotuloAcessivel={aoPressionar ? `${falado}. Abrir para mudar papel ou situação` : falado}
      {...(aoPressionar ? { aoPressionar } : {})}
    />
  )
}
