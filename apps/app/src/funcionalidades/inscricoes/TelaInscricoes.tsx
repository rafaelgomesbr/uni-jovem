import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { Inscricao } from '@/servicos/contratoDosEventos'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { Tela } from '@/ui/Tela'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import { parametro } from '@/utilidades/parametros'

import { usePode } from '../comunidade/permissoes'
import { useEvento } from '../eventos/consultas'
import { AvisoDeFalha, ErroDaTela } from '../eventos/Falha'
import { MenuDeAcoes } from '../eventos/FolhaNaTela'
import { Numeros } from '../eventos/Numeros'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useCancelarInscricao, useInscricoes } from './consultas'
import { LinkPublico } from './LinkPublico'
import { NOME_DO_ESTADO_DA_INSCRICAO, TOM_DO_ESTADO_DA_INSCRICAO } from './nomes'

export type FiltroDeInscricao = 'todas' | 'confirmada' | 'espera' | 'cancelada' | 'presentes'

export function filtrarInscricoes(lista: readonly Inscricao[], filtro: FiltroDeInscricao) {
  if (filtro === 'todas') return [...lista]
  if (filtro === 'presentes') return lista.filter((i) => i.presente)
  return lista.filter((i) => i.estado === filtro)
}

/** Rota `/evento/[eventoId]/inscricoes`: contagens, a lista interna e o link público. */
export function TelaInscricoes() {
  const { comunidadeAtiva } = useSessao()
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
  const pode = usePode()
  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela pilha titulo="Inscrições">
        <SemComunidade oQue="as inscrições" />
      </Tela>
    )
  }
  if (!pode('inscricao', 'ler_lista')) {
    return (
      <Tela pilha titulo="Inscrições">
        <Aviso tipo="info" titulo="Só a organização vê a lista">
          A lista de inscritos tem dados de contato e fica só com quem organiza.
        </Aviso>
      </Tela>
    )
  }
  return <Inscricoes comunidadeId={comunidadeAtiva.id} eventoId={eventoId} />
}

function Inscricoes({ comunidadeId, eventoId }: { comunidadeId: string; eventoId: string }) {
  const pode = usePode()
  const evento = useEvento(comunidadeId, eventoId)
  const lista = useInscricoes(comunidadeId, eventoId)
  const cancelar = useCancelarInscricao(comunidadeId, eventoId)
  const [filtro, setFiltro] = useState<FiltroDeInscricao>('todas')
  const [escolhida, setEscolhida] = useState<Inscricao | null>(null)
  const gerencia = pode('inscricao', 'gerenciar')

  async function pedirCancelamento(i: Inscricao) {
    const ok = await confirmar({
      titulo: `Cancelar a inscrição de ${i.nome}?`,
      mensagem: 'A vaga fica livre; se houver lista de espera, a primeira pessoa da fila sobe.',
      confirmar: 'Cancelar inscrição',
      destrutivo: true,
    })
    if (ok)
      cancelar.mutate(i.id, {
        onSuccess: () => mostrarToast({ texto: `Inscrição de ${i.nome} cancelada.` }),
      })
  }

  const e = evento.data
  return (
    <Tela
      pilha
      titulo="Inscrições"
      {...(e ? { descricao: e.titulo } : {})}
      {...(pode('presenca', 'registrar')
        ? {
            barraDeAcao: (
              <BarraDeAcao>
                <Botao
                  titulo="Fazer check-in"
                  tamanho="grande"
                  icone="qr"
                  aoPressionar={() =>
                    router.push({ pathname: '/evento/[eventoId]/checkin', params: { eventoId } })
                  }
                />
              </BarraDeAcao>
            ),
          }
        : {})}
    >
      {lista.isPending ? (
        <Esqueleto rotulo="Carregando as inscrições">
          <CartaoDeEsqueleto />
          <CartaoDeEsqueleto titulo />
        </Esqueleto>
      ) : lista.error ? (
        <ErroDaTela
          erro={lista.error}
          titulo="As inscrições não abriram"
          aoTentarDeNovo={() => void lista.refetch()}
        />
      ) : (
        <>
          <CartaoDeVidro sobrancelha="Visão geral">
            <Numeros
              itens={[
                {
                  numero: lista.data.contagem.confirmadas,
                  rotulo: e?.capacidade ? `confirmadas de ${e.capacidade} vagas` : 'confirmadas',
                },
                { numero: lista.data.contagem.espera, rotulo: 'na lista de espera' },
                { numero: lista.data.contagem.presentes, rotulo: 'presentes' },
              ]}
            />
          </CartaoDeVidro>
          <PilulasDeFiltro
            rotulo="Mostrar"
            selecionadas={[filtro]}
            aoMudar={(v) => {
              if (v[0]) setFiltro(v[0])
            }}
            pilulas={[
              { valor: 'todas', rotulo: 'Todas' },
              { valor: 'confirmada', rotulo: 'Confirmadas' },
              { valor: 'espera', rotulo: 'Espera' },
              { valor: 'cancelada', rotulo: 'Canceladas' },
              { valor: 'presentes', rotulo: 'Presentes' },
            ]}
          />
          {cancelar.error ? (
            <AvisoDeFalha erro={cancelar.error} titulo="A inscrição não foi cancelada" />
          ) : null}
          <ListaFiltrada
            inscricoes={filtrarInscricoes(lista.data.inscricoes, filtro)}
            vazioTotal={lista.data.inscricoes.length === 0}
            aoMostrarTodas={() => setFiltro('todas')}
            aoEscolher={gerencia ? setEscolhida : null}
            publica={e?.visibilidade === 'publica'}
          />
        </>
      )}
      {e && e.visibilidade === 'publica' && e.status === 'publicado' ? (
        <LinkPublico idPublico={e.idPublico} titulo={e.titulo} />
      ) : null}
      <MenuDeAcoes
        aberto={escolhida !== null}
        titulo={escolhida?.nome ?? 'Inscrição'}
        aoFechar={() => setEscolhida(null)}
        acoes={
          escolhida && escolhida.estado !== 'cancelada'
            ? [
                {
                  titulo: 'Cancelar inscrição',
                  icone: 'cancelar',
                  descricao: 'A vaga fica livre para a fila',
                  destrutiva: true,
                  aoPressionar: () => void pedirCancelamento(escolhida),
                },
              ]
            : []
        }
      />
    </Tela>
  )
}

function ListaFiltrada({
  inscricoes,
  vazioTotal,
  aoEscolher,
  publica,
  aoMostrarTodas,
}: {
  inscricoes: Inscricao[]
  vazioTotal: boolean
  aoMostrarTodas: () => void
  aoEscolher: ((i: Inscricao) => void) | null
  publica: boolean
}) {
  if (inscricoes.length === 0) {
    return (
      <EstadoVazio
        icone="inscricoes"
        titulo={vazioTotal ? 'Ninguém se inscreveu ainda' : 'Ninguém nesta situação'}
        descricao={
          vazioTotal
            ? publica
              ? 'Compartilhe o link da página pública, logo abaixo, para receber inscrições.'
              : 'Membros se inscrevem pelo app, na página do evento.'
            : 'Escolha outra opção em Mostrar.'
        }
        acao={
          vazioTotal
            ? {
                titulo: 'Voltar para a programação',
                variante: 'secundario',
                aoPressionar: () => router.back(),
              }
            : { titulo: 'Mostrar todas', variante: 'secundario', aoPressionar: aoMostrarTodas }
        }
      />
    )
  }
  return (
    <CartaoDeVidro lista>
      <Lista>
        {inscricoes.map((i) => {
          const contato = [i.telefone, i.email].filter(Boolean).join(' · ')
          const origem = i.origem === 'membro' ? 'Membro' : 'Página pública'
          const descricao = [origem, contato].filter(Boolean).join(' · ')
          const podeCancelar = !!aoEscolher && i.estado !== 'cancelada'
          return (
            <LinhaDeLista
              key={i.id}
              avatar={{ nome: i.nome }}
              titulo={i.nome}
              descricao={descricao}
              extra={
                <View style={{ alignItems: 'flex-end', gap: ESPACO.e4 }}>
                  <Chip
                    texto={NOME_DO_ESTADO_DA_INSCRICAO[i.estado]}
                    tom={TOM_DO_ESTADO_DA_INSCRICAO[i.estado]}
                  />
                  {i.presente ? <Chip texto="Presente" tom="sucesso" icone="check" /> : null}
                </View>
              }
              {...(podeCancelar
                ? {
                    semSeta: true,
                    rotuloAcessivel: `${i.nome}. ${NOME_DO_ESTADO_DA_INSCRICAO[i.estado]}${i.presente ? ', presente' : ''}. ${descricao}. Abrir opções`,
                    aoPressionar: () => aoEscolher(i),
                  }
                : {})}
            />
          )
        })}
      </Lista>
    </CartaoDeVidro>
  )
}
