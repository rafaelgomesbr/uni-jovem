import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { Inscricao } from '@/servicos/contratoDosEventos'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { BarraDeProgresso } from '@/ui/BarraDeProgresso'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Chip } from '@/ui/Chip'
import { Esqueleto, LinhaDeEsqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { MenuDeAcoes } from '@/ui/FolhaNaTela'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { voltarOu } from '@/ui/navegacao'
import { Numeros } from '@/ui/Numeros'
import { PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { EntradaEmCascata } from '@/ui/primitivasDeMovimento'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import { parametro } from '@/utilidades/parametros'

import { usePode } from '../comunidade/permissoes'
import { useEvento } from '../eventos/consultas'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useCancelarInscricao, useInscricoes } from './consultas'
import { LinkPublico } from './LinkPublico'
import { NOME_DO_ESTADO_DA_INSCRICAO } from './nomes'
import { VazioComSol } from './VazioComSol'

export type FiltroDeInscricao = 'todas' | 'confirmada' | 'espera' | 'cancelada' | 'presentes'

export function filtrarInscricoes(lista: readonly Inscricao[], filtro: FiltroDeInscricao) {
  if (filtro === 'todas') return [...lista]
  if (filtro === 'presentes') return lista.filter((i) => i.presente)
  return lista.filter((i) => i.estado === filtro)
}

/** Rota `/evento/[eventoId]/inscricoes`: vagas, espera, a lista interna e o link público. */
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

/**
 * Inscrições no visual A (D71): o cartão de vagas com o número grande ("12 de 60 vagas"), a barra
 * e a lista de espera; os filtros; e a lista em linhas de 56 pt com a situação em chip (texto e
 * ícone, nunca só cor). Quem organiza abre as opções de uma inscrição com um toque.
 */
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
                  titulo="Marcar quem chegou"
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
          <LinhaDeEsqueleto altura={88} />
          <LinhaDeEsqueleto altura={56} />
          <LinhaDeEsqueleto altura={56} />
          <LinhaDeEsqueleto altura={56} />
        </Esqueleto>
      ) : lista.error ? (
        <ErroDaTela
          erro={lista.error}
          titulo="Não deu para carregar as inscrições."
          aoTentarDeNovo={() => void lista.refetch()}
        />
      ) : (
        <>
          <EntradaEmCascata ordem={1}>
            <Vagas
              confirmadas={lista.data.contagem.confirmadas}
              espera={lista.data.contagem.espera}
              presentes={lista.data.contagem.presentes}
              capacidade={e?.capacidade ?? null}
              listaDeEspera={e?.listaDeEspera ?? false}
            />
          </EntradaEmCascata>
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
            idPublico={e?.idPublico ?? null}
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

/**
 * O cartão das vagas: "12 de 60 vagas" em número grande e a barra. Sem limite de vagas, só a
 * contagem. A lista de espera e os presentes ficam em números ao lado, lidos de uma vez.
 */
function Vagas({
  confirmadas,
  espera,
  presentes,
  capacidade,
  listaDeEspera,
}: {
  confirmadas: number
  espera: number
  presentes: number
  capacidade: number | null
  listaDeEspera: boolean
}) {
  const cheio = capacidade !== null && confirmadas >= capacidade
  const falado =
    capacidade !== null
      ? `${confirmadas} de ${capacidade} vagas preenchidas`
      : `${confirmadas} ${confirmadas === 1 ? 'inscrição confirmada' : 'inscrições confirmadas'}`
  return (
    <Cartao
      sobrancelha="Vagas"
      extra={cheio ? <Chip situacao="aguardando" texto="Esgotadas" /> : undefined}
    >
      <View accessible accessibilityLabel={falado} style={{ gap: ESPACO.e8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            columnGap: ESPACO.e8,
          }}
        >
          <Texto variante="contador" accessibilityRole="text">
            {String(confirmadas)}
          </Texto>
          <Texto variante="tituloItem" accessibilityRole="text">
            {capacidade !== null
              ? `de ${capacidade} vagas`
              : confirmadas === 1
                ? 'confirmada'
                : 'confirmadas'}
          </Texto>
        </View>
        {capacidade !== null ? (
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <BarraDeProgresso
              fracao={capacidade ? confirmadas / capacidade : 0}
              rotulo={`Vagas preenchidas: ${confirmadas} de ${capacidade}`}
              cor="primaria"
              trilho="tonal"
            />
          </View>
        ) : null}
      </View>
      <Numeros
        itens={[
          { numero: espera, rotulo: 'na lista de espera' },
          { numero: presentes, rotulo: 'presentes' },
        ]}
      />
      {cheio && !listaDeEspera ? (
        <Texto variante="legenda" cor="textoSuave">
          As vagas acabaram e o encontro não tem lista de espera.
        </Texto>
      ) : null}
    </Cartao>
  )
}

function ListaFiltrada({
  inscricoes,
  vazioTotal,
  aoEscolher,
  publica,
  idPublico,
  aoMostrarTodas,
}: {
  inscricoes: Inscricao[]
  vazioTotal: boolean
  aoMostrarTodas: () => void
  aoEscolher: ((i: Inscricao) => void) | null
  publica: boolean
  idPublico: string | null
}) {
  if (inscricoes.length === 0) {
    return vazioTotal ? (
      <VazioComSol
        titulo="Ninguém se inscreveu ainda."
        descricao={
          publica && idPublico
            ? 'Compartilhe o link da página pública, logo abaixo, para receber inscrições.'
            : 'Membros se inscrevem pelo app, na página do encontro.'
        }
        acao={{ titulo: 'Voltar para o encontro', aoPressionar: () => voltarOu('/agenda') }}
      />
    ) : (
      <Cartao>
        <Texto variante="tituloItem">Ninguém nesta situação.</Texto>
        <Texto variante="corpo" cor="textoSuave">
          Escolha outra opção em Mostrar.
        </Texto>
        <View style={{ flexDirection: 'row' }}>
          <Botao
            titulo="Mostrar todas"
            variante="secundario"
            tamanho="medio"
            aoPressionar={aoMostrarTodas}
          />
        </View>
      </Cartao>
    )
  }
  return (
    <Cartao lista>
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
                    {...(i.estado === 'confirmada'
                      ? { situacao: 'aceitou' as const }
                      : i.estado === 'espera'
                        ? { situacao: 'aguardando' as const }
                        : { tom: 'neutro' as const })}
                    texto={NOME_DO_ESTADO_DA_INSCRICAO[i.estado]}
                  />
                  {i.presente ? <Chip situacao="aceitou" texto="Presente" /> : null}
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
    </Cartao>
  )
}
