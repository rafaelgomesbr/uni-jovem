import { ESPACO, RAIO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { Inscricao } from '@/servicos/contratoDosEventos'
import { confirmar } from '@/utilidades/confirmar'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Segmentos } from '@/ui/Segmentos'
import { Selo } from '@/ui/Selo'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { usePode } from '../comunidade/permissoes'
import { useEvento } from '../eventos/consultas'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useCancelarInscricao, useInscricoes } from './consultas'
import { LinkPublico } from './LinkPublico'
import { COR_DO_ESTADO_DA_INSCRICAO, NOME_DO_ESTADO_DA_INSCRICAO } from './nomes'

export type FiltroDeInscricao = 'todas' | 'confirmada' | 'espera' | 'cancelada' | 'presentes'

export function filtrarInscricoes(lista: readonly Inscricao[], filtro: FiltroDeInscricao) {
  if (filtro === 'todas') return [...lista]
  if (filtro === 'presentes') return lista.filter((i) => i.presente)
  return lista.filter((i) => i.estado === filtro)
}

/** Rota `/evento/[eventoId]/inscricoes`: lista interna, contagens e link público. */
export function TelaInscricoes() {
  const { comunidadeAtiva } = useSessao()
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
  const pode = usePode()
  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela cabecalhoNativo>
        <SemComunidade oQue="as inscrições" />
      </Tela>
    )
  }
  if (!pode('inscricao', 'ler_lista')) {
    return (
      <Tela cabecalhoNativo titulo="Inscrições">
        <Aviso tipo="info" titulo="Só a organização vê a lista">
          A lista de inscritos tem dados de contato e fica só com quem organiza.
        </Aviso>
      </Tela>
    )
  }
  return <Inscricoes comunidadeId={comunidadeAtiva.id} eventoId={eventoId} />
}

function Contagem({ numero, rotulo }: { numero: number; rotulo: string }) {
  const { cores } = useTema()
  return (
    <View
      accessible
      accessibilityLabel={`${numero} ${rotulo}`}
      style={{
        flexGrow: 1,
        minWidth: 96,
        padding: ESPACO.x3,
        borderRadius: RAIO.medio,
        borderWidth: 1,
        borderColor: cores.borda,
        backgroundColor: cores.superficie,
        gap: 2,
      }}
    >
      <Texto variante="titulo" accessibilityRole="text">
        {numero}
      </Texto>
      <Texto variante="apoio" cor="textoSuave">
        {rotulo}
      </Texto>
    </View>
  )
}

function Inscricoes({ comunidadeId, eventoId }: { comunidadeId: string; eventoId: string }) {
  const pode = usePode()
  const evento = useEvento(comunidadeId, eventoId)
  const lista = useInscricoes(comunidadeId, eventoId)
  const cancelar = useCancelarInscricao(comunidadeId, eventoId)
  const [filtro, setFiltro] = useState<FiltroDeInscricao>('todas')

  async function pedirCancelamento(i: Inscricao) {
    const ok = await confirmar({
      titulo: `Cancelar a inscrição de ${i.nome}?`,
      mensagem: 'A vaga fica livre; se houver lista de espera, a primeira pessoa da fila sobe.',
      confirmar: 'Cancelar inscrição',
      destrutivo: true,
    })
    if (ok) cancelar.mutate(i.id)
  }

  const e = evento.data
  return (
    <Tela cabecalhoNativo titulo="Inscrições" {...(e ? { descricao: e.titulo } : {})}>
      {lista.isPending ? (
        <Carregando texto="Carregando as inscrições" />
      ) : lista.error ? (
        <AvisoDeErro erro={lista.error} aoTentarDeNovo={() => void lista.refetch()} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
            <Contagem
              numero={lista.data.contagem.confirmadas}
              rotulo={e?.capacidade ? `confirmadas de ${e.capacidade} vagas` : 'confirmadas'}
            />
            <Contagem numero={lista.data.contagem.espera} rotulo="na lista de espera" />
            <Contagem numero={lista.data.contagem.presentes} rotulo="presentes" />
          </View>
          {pode('presenca', 'registrar') ? (
            <Botao
              titulo="Fazer check-in"
              icone="qr"
              aoPressionar={() =>
                router.push({ pathname: '/evento/[eventoId]/checkin', params: { eventoId } })
              }
            />
          ) : null}
          <Segmentos
            rotulo="Mostrar"
            valor={filtro}
            aoMudar={setFiltro}
            segmentos={[
              { valor: 'todas', rotulo: 'Todas' },
              { valor: 'confirmada', rotulo: 'Confirmadas' },
              { valor: 'espera', rotulo: 'Espera' },
              { valor: 'cancelada', rotulo: 'Canceladas' },
              { valor: 'presentes', rotulo: 'Presentes' },
            ]}
          />
          {cancelar.error ? <AvisoDeErro erro={cancelar.error} /> : null}
          <ListaFiltrada
            inscricoes={filtrarInscricoes(lista.data.inscricoes, filtro)}
            vazioTotal={lista.data.inscricoes.length === 0}
            aoCancelar={pode('inscricao', 'gerenciar') ? pedirCancelamento : null}
            publica={e?.visibilidade === 'publica'}
          />
        </>
      )}
      {e && e.visibilidade === 'publica' && e.status === 'publicado' ? (
        <LinkPublico idPublico={e.idPublico} titulo={e.titulo} />
      ) : null}
    </Tela>
  )
}

function ListaFiltrada({
  inscricoes,
  vazioTotal,
  aoCancelar,
  publica,
}: {
  inscricoes: Inscricao[]
  vazioTotal: boolean
  aoCancelar: ((i: Inscricao) => void) | null
  publica: boolean
}) {
  if (inscricoes.length === 0) {
    return (
      <Cartao>
        <EstadoVazio
          icone="inscricoes"
          titulo={vazioTotal ? 'Ninguém se inscreveu ainda' : 'Ninguém nesta situação'}
          descricao={
            vazioTotal
              ? publica
                ? 'Compartilhe o link da página pública abaixo para receber inscrições.'
                : 'Membros se inscrevem pelo app, na página do evento.'
              : 'Escolha outra opção em Mostrar.'
          }
        />
      </Cartao>
    )
  }
  return (
    <Cartao>
      <View style={{ gap: ESPACO.x3 }}>
        {inscricoes.map((i) => {
          const contato = [i.telefone, i.email].filter(Boolean).join(' · ')
          return (
            <View key={i.id} style={{ gap: ESPACO.x1 }}>
              <Texto variante="corpoForte">{i.nome}</Texto>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
                <Selo
                  texto={NOME_DO_ESTADO_DA_INSCRICAO[i.estado]}
                  cor={COR_DO_ESTADO_DA_INSCRICAO[i.estado]}
                />
                {i.presente ? <Selo texto="Presente" cor="sucesso" /> : null}
                <Selo texto={i.origem === 'membro' ? 'Membro' : 'Página pública'} />
              </View>
              {contato ? (
                <Texto variante="apoio" cor="textoSuave" selectable>
                  {contato}
                </Texto>
              ) : null}
              {aoCancelar && i.estado !== 'cancelada' ? (
                <Botao
                  titulo="Cancelar inscrição"
                  variante="discreto"
                  larguraTotal={false}
                  rotuloAcessivel={`Cancelar a inscrição de ${i.nome}`}
                  aoPressionar={() => aoCancelar(i)}
                />
              ) : null}
            </View>
          )
        })}
      </View>
    </Cartao>
  )
}
