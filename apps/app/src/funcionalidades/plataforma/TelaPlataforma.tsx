import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { CampoDeBusca } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { formatarData } from '@/utilidades/formatos'

import {
  CHIP_DO_ESTADO_DA_COMUNIDADE,
  NOME_CURTO_DO_ESTADO_DA_COMUNIDADE,
} from '../comunidade/nomes'
import {
  useListaDaPlataforma,
  type ComunidadeNaPlataforma,
  type FiltroDaPlataforma,
} from './consultas'
import { VazioComSol } from '../entrada/VazioComSol'
import { exigeProvaDeSegundoFator, ProvaDeSegundoFator } from './ProvaDeSegundoFator'

/** Espera de digitação antes de buscar na API. */
const ESPERA_DA_BUSCA_MS = 400

const FILTROS = [
  { valor: 'nova' as const, rotulo: 'Novas' },
  { valor: 'verificada' as const, rotulo: 'Verificadas' },
  { valor: 'todas' as const, rotulo: 'Todas' },
]

function pessoas(n: number): string {
  return `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`
}

function denuncias(n: number): string {
  return `${n} ${n === 1 ? 'denúncia' : 'denúncias'}`
}

/** O texto que a pessoa digitou, só depois de uma pausa (sincroniza com um temporizador). */
function useValorComPausa(valor: string, ms: number): string {
  const [atrasado, setAtrasado] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return atrasado
}

/**
 * Plataforma do Criador (3.6.3 e ADR 0007): as pílulas "Novas",
 * "Verificadas" e "Todas", a busca por nome ou cidade, a lista paginada e o
 * "+" no cabeçalho para criar. Cada linha: nome, cidade, quem criou, pessoas,
 * denúncias abertas e a data. Quando a API pede a prova do segundo fator, o
 * destaque é o pedido do código.
 */
export function TelaPlataforma() {
  const { conta } = useSessao()
  const [filtro, setFiltro] = useState<FiltroDaPlataforma>('nova')
  const [busca, setBusca] = useState('')
  const termo = useValorComPausa(busca.trim(), ESPERA_DA_BUSCA_MS)
  const lista = useListaDaPlataforma(filtro, termo)

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

  const comunidades = lista.data?.pages.flatMap((p) => p.comunidades) ?? []
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
      <PilulasDeFiltro
        rotulo="Mostrar comunidades"
        pilulas={FILTROS}
        selecionadas={[filtro]}
        aoMudar={([v]) => {
          if (v) setFiltro(v)
        }}
        sangrar
      />
      <CampoDeBusca rotulo="Buscar por nome ou cidade" valor={busca} aoMudar={setBusca} />

      {exigeProvaDeSegundoFator(lista.error) ? (
        <ProvaDeSegundoFator
          motivo="Para ver as comunidades da plataforma"
          aoConfirmar={() => void lista.refetch()}
        />
      ) : lista.isPending ? (
        <Esqueleto rotulo="Carregando as comunidades">
          <CartaoDeEsqueleto />
          <CartaoDeEsqueleto />
        </Esqueleto>
      ) : lista.error && comunidades.length === 0 ? (
        <ErroDaTela
          erro={lista.error}
          titulo="As comunidades não abriram"
          aoTentarDeNovo={() => void lista.refetch()}
        />
      ) : comunidades.length === 0 ? (
        <Vazio filtro={filtro} buscando={termo.length > 0} aoLimpar={() => setBusca('')} />
      ) : (
        <Secao titulo="Comunidades">
          <CartaoDeVidro lista>
            <Lista>{comunidades.map(linhaDaComunidade)}</Lista>
          </CartaoDeVidro>
          {lista.isFetchNextPageError ? (
            <AvisoDeFalha erro={lista.error} titulo="As próximas não carregaram" />
          ) : null}
          {lista.hasNextPage ? (
            <View style={{ marginTop: ESPACO.e12 }}>
              <Botao
                titulo="Mostrar mais"
                variante="secundario"
                larguraTotal
                carregando={lista.isFetchingNextPage}
                aoPressionar={() => void lista.fetchNextPage()}
              />
            </View>
          ) : null}
        </Secao>
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

function Vazio({
  filtro,
  buscando,
  aoLimpar,
}: {
  filtro: FiltroDaPlataforma
  buscando: boolean
  aoLimpar: () => void
}) {
  if (buscando) {
    return (
      <VazioComSol
        titulo="Nenhuma comunidade com esse nome"
        descricao="Confira a grafia ou busque pela cidade."
        acao={{ titulo: 'Limpar a busca', variante: 'secundario', aoPressionar: aoLimpar }}
      />
    )
  }
  if (filtro === 'nova') {
    return (
      <VazioComSol
        pose="pleno"
        titulo="Nenhuma comunidade esperando verificação"
        descricao="Quando alguém criar uma comunidade, ela aparece aqui até você verificar."
        acao={{
          titulo: 'Criar comunidade',
          variante: 'secundario',
          aoPressionar: () => router.push('/plataforma/nova'),
        }}
      />
    )
  }
  return (
    <VazioComSol
      titulo={
        filtro === 'verificada' ? 'Nenhuma comunidade verificada' : 'Nenhuma comunidade ainda'
      }
      descricao="Crie uma comunidade e entre como administrador, ou mande o convite para quem vai cuidar dela."
      acao={{ titulo: 'Criar comunidade', aoPressionar: () => router.push('/plataforma/nova') }}
    />
  )
}

/**
 * Comunidade: avatar na cor dela, nome, "cidade · pessoas · criada em" e
 * quem criou; à direita, os chips (Verificada, denúncias, situação).
 */
function linhaDaComunidade(c: ComunidadeNaPlataforma) {
  const estado = NOME_CURTO_DO_ESTADO_DA_COMUNIDADE[c.estado]
  const ativa = c.estado === 'ativa'
  const verificada = c.verificacao === 'verificada'
  const abertas = c.denunciasAbertas ?? 0
  const primeira = [
    c.cidade,
    pessoas(c.membrosAtivos),
    c.criadoEm ? `criada em ${formatarData(c.criadoEm)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const quem = c.criador
    ? `Por ${c.criador.nome}${c.criador.email ? ` (${c.criador.email})` : ''}`
    : null
  const descricao = quem ? `${primeira}\n${quem}` : primeira
  return (
    <LinhaDeLista
      key={c.id}
      avatar={{ nome: c.nome, cor: c.cor }}
      titulo={c.nome}
      descricao={descricao}
      linhasDaDescricao={3}
      extra={
        <View style={{ alignItems: 'flex-end', gap: ESPACO.e4 }}>
          {verificada ? <Chip texto="Verificada" tom="sucesso" icone="confirmado" /> : null}
          {c.verificacao === 'nova' ? <Chip texto="Nova" tom="neutro" /> : null}
          {abertas > 0 ? <Chip texto={denuncias(abertas)} tom="alerta" icone="denuncia" /> : null}
          {c.adminsAtivos === 0 ? <Chip texto="Sem admin" tom="alerta" /> : null}
          {ativa ? null : <Chip texto={estado} tom={CHIP_DO_ESTADO_DA_COMUNIDADE[c.estado].tom} />}
        </View>
      }
      rotuloAcessivel={`${c.nome}. ${descricao.replace('\n', '. ')}.${verificada ? ' Verificada.' : c.verificacao === 'nova' ? ' Nova.' : ''}${abertas ? ` ${denuncias(abertas)} abertas.` : ''}${ativa ? '' : ` ${estado}.`} Abrir`}
      aoPressionar={() =>
        router.push({ pathname: '/plataforma/[comunidadeId]', params: { comunidadeId: c.id } })
      }
    />
  )
}
