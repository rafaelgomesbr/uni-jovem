import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ComunidadeDaPlataforma } from '@/servicos/contrato'
import { BotaoIcone } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'

import {
  CHIP_DO_ESTADO_DA_COMUNIDADE,
  NOME_CURTO_DO_ESTADO_DA_COMUNIDADE,
} from '../comunidade/nomes'
import { ErroDaTela } from '../eventos/Falha'
import { Numeros } from '../eventos/Numeros'
import { useComunidadesDaPlataforma } from './consultas'
import { exigeProvaDeSegundoFator, ProvaDeSegundoFator } from './ProvaDeSegundoFator'

function pessoas(n: number): string {
  return `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`
}

/**
 * Plataforma do Criador (3.6.3): "VISÃO GERAL" com três números, o cartão
 * lista "COMUNIDADES" e o "+" no cabeçalho para criar. Quando a API pede a
 * prova do segundo fator, o destaque é o pedido do código.
 */
export function TelaPlataforma() {
  const { conta } = useSessao()
  const comunidades = useComunidadesDaPlataforma()

  if (!conta?.criador) {
    return (
      <Tela pilha titulo="Plataforma">
        <EstadoVazio
          icone="seguranca"
          titulo="Área do Criador"
          descricao="Só quem criou a plataforma acessa esta área."
          acao={{ titulo: 'Voltar para o início', aoPressionar: () => router.replace('/') }}
        />
      </Tela>
    )
  }

  const lista = comunidades.data ?? []
  return (
    <Tela
      pilha
      titulo="Plataforma"
      descricao="Ações aqui ficam registradas na auditoria"
      acoes={
        <BotaoIcone
          icone="adicionar"
          rotulo="Criar comunidade"
          circular
          aoPressionar={() => router.push('/plataforma/nova')}
        />
      }
    >
      {exigeProvaDeSegundoFator(comunidades.error) ? (
        <ProvaDeSegundoFator
          motivo="Para ver as comunidades da plataforma"
          aoConfirmar={() => void comunidades.refetch()}
        />
      ) : comunidades.isPending ? (
        <Esqueleto rotulo="Carregando as comunidades">
          <CartaoDeEsqueleto />
          <CartaoDeEsqueleto />
        </Esqueleto>
      ) : comunidades.error ? (
        <ErroDaTela
          erro={comunidades.error}
          titulo="As comunidades não abriram"
          aoTentarDeNovo={() => void comunidades.refetch()}
        />
      ) : (
        <>
          <CartaoDeVidro sobrancelha="Visão geral">
            <Numeros
              itens={[
                { numero: lista.length, rotulo: lista.length === 1 ? 'comunidade' : 'comunidades' },
                {
                  numero: lista.reduce((s, c) => s + c.membrosAtivos, 0),
                  rotulo: 'pessoas ativas',
                },
                {
                  numero: lista.filter((c) => c.adminsAtivos === 0).length,
                  rotulo: 'sem administrador',
                },
              ]}
            />
          </CartaoDeVidro>
          {lista.length === 0 ? (
            <EstadoVazio
              icone="plataforma"
              titulo="Nenhuma comunidade ainda"
              descricao="Crie a primeira e entre como administrador, ou mande o convite para quem vai cuidar dela."
              acao={{
                titulo: 'Criar a primeira comunidade',
                icone: 'adicionar',
                aoPressionar: () => router.push('/plataforma/nova'),
              }}
            />
          ) : (
            <Secao titulo="Comunidades">
              <CartaoDeVidro lista>
                <Lista>{lista.map(linhaDaComunidade)}</Lista>
              </CartaoDeVidro>
            </Secao>
          )}
        </>
      )}

      <Secao titulo="Propriedade">
        <CartaoDeVidro lista>
          <LinhaDeLista
            icone="chave"
            titulo="Transferir a propriedade"
            descricao="Passar o papel de Criador para outra conta, com espera de 72 horas"
            aoPressionar={() => router.push('/plataforma/transferencia')}
          />
        </CartaoDeVidro>
      </Secao>
    </Tela>
  )
}

/** Comunidade: avatar de 40 na cor dela, nome, quantas pessoas e os chips de situação. */
function linhaDaComunidade(c: ComunidadeDaPlataforma) {
  const estado = NOME_CURTO_DO_ESTADO_DA_COMUNIDADE[c.estado]
  const semAdmin = c.adminsAtivos === 0
  return (
    <LinhaDeLista
      key={c.id}
      avatar={{ nome: c.nome, cor: c.cor }}
      titulo={c.nome}
      descricao={pessoas(c.membrosAtivos)}
      extra={
        <View style={{ alignItems: 'flex-end', gap: ESPACO.e4 }}>
          <Chip texto={estado} tom={CHIP_DO_ESTADO_DA_COMUNIDADE[c.estado].tom} />
          {semAdmin ? <Chip texto="Sem admin" tom="alerta" /> : null}
        </View>
      }
      rotuloAcessivel={`${c.nome}. ${estado}. ${pessoas(c.membrosAtivos)}.${semAdmin ? ' Sem administrador.' : ''} Abrir`}
      aoPressionar={() =>
        router.push({ pathname: '/plataforma/[comunidadeId]', params: { comunidadeId: c.id } })
      }
    />
  )
}
