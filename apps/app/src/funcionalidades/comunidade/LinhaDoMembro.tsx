import { NOME_DO_PAPEL } from '@uj/dominio'
import { ALTURA, ESPACO, RAIO } from '@uj/tokens'
import { Pressable, View } from 'react-native'

import type { Membro } from '@/servicos/contrato'
import { Avatar } from '@/ui/Avatar'
import { Icone } from '@/ui/Icone'
import { ALVO } from '@/ui/medidas'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { CHIP_DO_ESTADO_DO_VINCULO, CHIP_DO_PAPEL, NOME_DO_ESTADO_DO_VINCULO } from './nomes'
import { Chip, Chips } from './visual'

interface Props {
  membro: Membro
  ehVoce: boolean
  /** Contatos só aparecem para quem pode vê-los (a API também os omite para os demais). */
  mostrarContato: boolean
  aoPressionar?: () => void
}

/** Pessoa da equipe: avatar, nome, chips de papel e situação e, para quem pode, o contato. */
export function LinhaDoMembro({ membro, ehVoce, mostrarContato, aoPressionar }: Props) {
  const { cores } = useTema()
  const oracao = membro.designacoes.includes('equipe_oracao')
  const contato = mostrarContato
    ? [membro.email, membro.whatsapp].filter((c): c is string => Boolean(c))
    : []
  const nome = ehVoce ? `${membro.nome} (você)` : membro.nome
  const partes = [
    nome,
    NOME_DO_PAPEL[membro.papel],
    membro.estado !== 'ativo' ? NOME_DO_ESTADO_DO_VINCULO[membro.estado] : null,
    oracao ? 'Equipe de oração' : null,
    membro.criador ? 'Criador da plataforma' : null,
    ...contato,
  ].filter(Boolean)

  const conteudo = (
    <>
      <Avatar nome={membro.nome} avatar={membro.avatar ?? null} decorativo />
      <View style={{ flex: 1, gap: ESPACO.e4 }}>
        <Texto variante="tituloItem">{nome}</Texto>
        <Chips>
          <Chip
            texto={NOME_DO_PAPEL[membro.papel]}
            icone={CHIP_DO_PAPEL[membro.papel].icone}
            tom={CHIP_DO_PAPEL[membro.papel].tom}
          />
          {membro.estado !== 'ativo' ? (
            <Chip
              texto={NOME_DO_ESTADO_DO_VINCULO[membro.estado]}
              icone={CHIP_DO_ESTADO_DO_VINCULO[membro.estado].icone}
              tom={CHIP_DO_ESTADO_DO_VINCULO[membro.estado].tom}
            />
          ) : null}
          {oracao ? <Chip texto="Equipe de oração" icone="oracao" /> : null}
          {membro.criador ? <Chip texto="Criador" icone="plataforma" /> : null}
        </Chips>
        {contato.length ? (
          <Texto variante="legenda" cor="textoSuave" selectable>
            {contato.join(' · ')}
          </Texto>
        ) : null}
      </View>
      {aoPressionar ? <Icone nome="avancar" cor={cores.textoSuave} tamanho={18} /> : null}
    </>
  )

  const estilo = {
    minHeight: Math.max(ALVO, ALTURA.linha),
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: ESPACO.e12,
    paddingVertical: ESPACO.e12,
    marginHorizontal: -ESPACO.e12,
    paddingHorizontal: ESPACO.e12,
    borderRadius: RAIO.controle,
  }

  if (!aoPressionar) {
    return (
      <View accessible accessibilityLabel={partes.join('. ')} style={estilo}>
        {conteudo}
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${partes.join('. ')}. Abrir para mudar papel ou situação`}
      onPress={aoPressionar}
      style={({ pressed }) => [
        estilo,
        { backgroundColor: pressed ? cores.pressionado : 'transparent' },
      ]}
    >
      {conteudo}
    </Pressable>
  )
}
