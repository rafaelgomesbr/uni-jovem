import { ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import { Pressable, View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ComunidadeDaPlataforma } from '@/servicos/contrato'
import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Icone } from '@/ui/Icone'
import { Linha } from '@/ui/Linha'
import { Secao } from '@/ui/Secao'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { MarcaDaComunidade } from '../comunidade/Identidade'
import { CHIP_DO_ESTADO_DA_COMUNIDADE, NOME_DO_ESTADO_DA_COMUNIDADE } from '../comunidade/nomes'
import { CabecalhoDeTela, CartaoDeDestaque, Chip, Chips, TelaPropria } from '../comunidade/visual'
import { useComunidadesDaPlataforma } from './consultas'
import { exigeProvaDeSegundoFator, ProvaDeSegundoFator } from './ProvaDeSegundoFator'

function pessoas(n: number): string {
  return `${n} ${n === 1 ? 'pessoa ativa' : 'pessoas ativas'}`
}

/** Plataforma do Criador: criar comunidade e cuidar do ciclo de vida de cada uma. */
export function TelaPlataforma() {
  const { conta } = useSessao()
  const comunidades = useComunidadesDaPlataforma()

  if (!conta?.criador) {
    return (
      <TelaPropria>
        <Cartao>
          <EstadoVazio
            icone="seguranca"
            titulo="Área do Criador"
            descricao="Só quem criou a plataforma acessa esta área."
            acao={{ titulo: 'Voltar', aoPressionar: () => router.back() }}
          />
        </Cartao>
      </TelaPropria>
    )
  }

  return (
    <TelaPropria>
      <CabecalhoDeTela
        sobrancelha="Área do Criador"
        titulo="Plataforma"
        descricao="Todas as comunidades do app. Cada ação aqui pede o código do autenticador e fica na auditoria."
      />

      <CartaoDeDestaque
        sobrancelha="Nova comunidade"
        titulo="Criar comunidade"
        descricao="Nome, cor, fuso e quem administra. Você mesmo pode ser o administrador."
      >
        <Botao
          titulo="Criar comunidade"
          icone="adicionar"
          aoPressionar={() => router.push('/plataforma/nova')}
        />
      </CartaoDeDestaque>

      <Secao titulo={comunidades.data ? `Comunidades (${comunidades.data.length})` : 'Comunidades'}>
        {exigeProvaDeSegundoFator(comunidades.error) ? (
          <ProvaDeSegundoFator
            motivo="Para ver as comunidades da plataforma"
            aoConfirmar={() => void comunidades.refetch()}
          />
        ) : comunidades.isPending ? (
          <Cartao>
            <Carregando texto="Carregando as comunidades" />
          </Cartao>
        ) : comunidades.error ? (
          <Cartao>
            <AvisoDeErro
              erro={comunidades.error}
              aoTentarDeNovo={() => void comunidades.refetch()}
            />
          </Cartao>
        ) : comunidades.data.length === 0 ? (
          <Cartao>
            <EstadoVazio
              icone="plataforma"
              titulo="Nenhuma comunidade ainda"
              descricao="Crie a primeira e entre como administrador, ou mande o convite para quem vai cuidar dela."
              acao={{
                titulo: 'Criar a primeira comunidade',
                icone: 'adicionar',
                variante: 'primario',
                aoPressionar: () => router.push('/plataforma/nova'),
              }}
            />
          </Cartao>
        ) : (
          <View style={{ gap: ESPACO.e12 }}>
            {comunidades.data.map((c) => (
              <CartaoDaComunidade key={c.id} comunidade={c} />
            ))}
          </View>
        )}
      </Secao>

      <Secao titulo="Propriedade">
        <Cartao>
          <Linha
            icone="chave"
            titulo="Transferir a propriedade da plataforma"
            descricao="Passar o papel de Criador para outra conta, com espera de 72 horas."
            aoPressionar={() => router.push('/plataforma/transferencia')}
          />
        </Cartao>
      </Secao>
    </TelaPropria>
  )
}

function CartaoDaComunidade({ comunidade: c }: { comunidade: ComunidadeDaPlataforma }) {
  const { cores, elevacao } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const estado = NOME_DO_ESTADO_DA_COMUNIDADE[c.estado]
  const semAdmin = c.adminsAtivos === 0
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${c.nome}. ${estado}. ${pessoas(c.membrosAtivos)}.${
        semAdmin ? ' Sem administrador.' : ''
      } Abrir`}
      onPress={() =>
        router.push({ pathname: '/plataforma/[comunidadeId]', params: { comunidadeId: c.id } })
      }
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: ESPACO.e12,
        padding: ESPACO.e16,
        borderRadius: RAIO.cartao,
        backgroundColor: pressed ? cores.pressionado : cores.superficie,
        borderWidth: aumentarContraste ? 2 : 1,
        borderColor: aumentarContraste ? cores.texto : cores.separador,
        boxShadow: aumentarContraste ? elevacao.nenhuma : elevacao.cartao,
      })}
    >
      <MarcaDaComunidade cor={c.cor} tamanho={44} />
      <View style={{ flex: 1, gap: ESPACO.e4 }}>
        <Texto variante="tituloItem">{c.nome}</Texto>
        <Chips>
          <Chip
            texto={estado}
            icone={CHIP_DO_ESTADO_DA_COMUNIDADE[c.estado].icone}
            tom={CHIP_DO_ESTADO_DA_COMUNIDADE[c.estado].tom}
          />
          <Chip texto={pessoas(c.membrosAtivos)} icone="comunidade" />
          {semAdmin ? <Chip texto="Sem administrador" icone="erro" tom="alerta" /> : null}
        </Chips>
      </View>
      <Icone nome="avancar" cor={cores.textoSuave} tamanho={18} />
    </Pressable>
  )
}
