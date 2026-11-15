import { useQueryClient } from '@tanstack/react-query'
import { NOME_DO_PAPEL } from '@uj/dominio'
import { ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import { Pressable, View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import type { ComunidadeDoVinculo } from '@/servicos/contrato'
import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Icone } from '@/ui/Icone'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { MarcaDaComunidade } from './Identidade'
import { CHIP_DO_ESTADO_DA_COMUNIDADE, CHIP_DO_PAPEL, NOME_DO_ESTADO_DA_COMUNIDADE } from './nomes'
import { CabecalhoDeTela, Chip, Chips, TelaPropria } from './visual'

/** Seletor explícito da comunidade ativa, com a identidade e o papel em cada uma. */
export function TelaTrocarComunidade() {
  const { comunidades, comunidadeAtiva, trocarComunidade, conta } = useSessao()
  const consultas = useQueryClient()

  async function escolher(id: string) {
    await trocarComunidade(id)
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }

  return (
    <TelaPropria>
      <CabecalhoDeTela
        sobrancelha="Suas comunidades"
        titulo="Trocar de comunidade"
        descricao="O que você vê e faz no app vale para a comunidade escolhida."
      />
      {comunidades.length === 0 ? (
        <Cartao>
          <EstadoVazio
            icone="comunidade"
            titulo="Nenhuma comunidade ainda"
            descricao="Quando você aceitar um convite, a comunidade aparece aqui."
            acao={{
              titulo: 'Verificar de novo',
              icone: 'sincronizar',
              aoPressionar: () => void consultas.invalidateQueries({ queryKey: CHAVES.eu }),
            }}
          />
        </Cartao>
      ) : (
        <View
          accessibilityRole="radiogroup"
          aria-label="Suas comunidades"
          style={{ gap: ESPACO.e12 }}
        >
          {comunidades.map((c) => (
            <OpcaoDeComunidade
              key={c.id}
              comunidade={c}
              ativa={c.id === comunidadeAtiva?.id}
              aoEscolher={() => void escolher(c.id)}
            />
          ))}
        </View>
      )}
      <Botao
        titulo="Entrar com um convite"
        icone="link"
        variante="secundario"
        aoPressionar={() => router.push('/entrar-com-convite')}
      />
      {conta?.criador ? (
        <Botao
          titulo="Criar comunidade"
          icone="adicionar"
          variante="terciario"
          aoPressionar={() => router.push('/plataforma/nova')}
        />
      ) : null}
    </TelaPropria>
  )
}

function OpcaoDeComunidade({
  comunidade,
  ativa,
  aoEscolher,
}: {
  comunidade: ComunidadeDoVinculo
  ativa: boolean
  aoEscolher: () => void
}) {
  const { cores, elevacao } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const papel = NOME_DO_PAPEL[comunidade.papel]
  const estado = NOME_DO_ESTADO_DA_COMUNIDADE[comunidade.estado]
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: ativa }}
      aria-checked={ativa}
      accessibilityLabel={`${comunidade.nome}. Seu papel: ${papel}.${
        comunidade.estado !== 'ativa' ? ` ${estado}.` : ''
      }${ativa ? ' Comunidade ativa agora.' : ''}`}
      onPress={aoEscolher}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: ESPACO.e12,
        padding: ESPACO.e16,
        borderRadius: RAIO.cartao,
        backgroundColor: pressed || ativa ? cores.pressionado : cores.superficie,
        // Escolhida: contorno grosso na cor de destaque, marca e texto (nunca só cor).
        borderWidth: ativa || aumentarContraste ? 2 : 1,
        borderColor: ativa ? cores.destaque : aumentarContraste ? cores.texto : cores.separador,
        boxShadow: aumentarContraste ? elevacao.nenhuma : elevacao.cartao,
      })}
    >
      <MarcaDaComunidade cor={comunidade.cor} tamanho={48} />
      <View style={{ flex: 1, gap: ESPACO.e4 }}>
        <Texto variante="tituloItem">{comunidade.nome}</Texto>
        <Chips>
          <Chip
            texto={papel}
            icone={CHIP_DO_PAPEL[comunidade.papel].icone}
            tom={CHIP_DO_PAPEL[comunidade.papel].tom}
          />
          {comunidade.estado !== 'ativa' ? (
            <Chip
              texto={estado}
              icone={CHIP_DO_ESTADO_DA_COMUNIDADE[comunidade.estado].icone}
              tom={CHIP_DO_ESTADO_DA_COMUNIDADE[comunidade.estado].tom}
            />
          ) : null}
          {ativa ? <Chip texto="Ativa agora" icone="confirmado" tom="destaque" /> : null}
        </Chips>
      </View>
      <Icone
        nome={ativa ? 'confirmado' : 'pendente'}
        cor={ativa ? cores.destaque : cores.textoSuave}
        tamanho={24}
      />
    </Pressable>
  )
}
