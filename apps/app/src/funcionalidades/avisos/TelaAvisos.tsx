import { ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import { Pressable, View } from 'react-native'

import type { Aviso } from '@/servicos/contratoDosModulos'
import { formatarData } from '@/utilidades/formatos'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Icone } from '@/ui/Icone'
import { ALVO } from '@/ui/medidas'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { usePode } from '../comunidade/permissoes'
import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
import { NOME_DO_ESTADO, useAvisos } from './consultas'

/** Rota `/avisos`. */
export function TelaAvisos() {
  const pode = usePode()
  const publica = pode('aviso', 'publicar')
  return (
    <TelaDaComunidade
      oQue="os avisos"
      titulo="Avisos"
      descricao={
        publica
          ? 'Escreva, publique, fixe no topo ou tire do ar. Rascunhos só a organização vê.'
          : 'Recados da organização da comunidade. Os fixados ficam no topo.'
      }
    >
      {(c) => <Lista comunidadeId={c.id} publica={publica} />}
    </TelaDaComunidade>
  )
}

function Lista({ comunidadeId, publica }: { comunidadeId: string; publica: boolean }) {
  const avisos = useAvisos(comunidadeId)
  return (
    <>
      {publica ? (
        <Botao
          titulo="Novo aviso"
          icone="adicionar"
          aoPressionar={() => router.push('/avisos/novo')}
        />
      ) : null}
      {avisos.isPending ? (
        <Carregando texto="Carregando os avisos" />
      ) : avisos.error ? (
        <AvisoDeErro erro={avisos.error} aoTentarDeNovo={() => void avisos.refetch()} />
      ) : avisos.data.length === 0 ? (
        <Cartao>
          <EstadoVazio
            icone="aviso"
            titulo="Nenhum aviso por enquanto"
            descricao={
              publica
                ? 'Escreva o primeiro aviso; ele pode ficar como rascunho até você publicar.'
                : 'Quando a organização publicar um aviso, ele aparece aqui e no Início.'
            }
            acao={
              publica
                ? {
                    titulo: 'Novo aviso',
                    icone: 'adicionar',
                    aoPressionar: () => router.push('/avisos/novo'),
                  }
                : {
                    titulo: 'Voltar ao Início',
                    icone: 'inicio',
                    aoPressionar: () => router.push('/'),
                  }
            }
          />
        </Cartao>
      ) : (
        avisos.data.map((a) => <ResumoDoAviso key={a.id} aviso={a} mostrarEstado={publica} />)
      )}
    </>
  )
}

export function ResumoDoAviso({
  aviso,
  mostrarEstado,
}: {
  aviso: Pick<Aviso, 'id' | 'titulo' | 'texto' | 'fixado' | 'publicadoEm'> &
    Partial<Pick<Aviso, 'estado'>>
  mostrarEstado: boolean
}) {
  const { cores } = useTema()
  const partes = [
    aviso.fixado ? 'Fixado' : null,
    mostrarEstado && aviso.estado ? NOME_DO_ESTADO[aviso.estado] : null,
    aviso.publicadoEm ? `publicado em ${formatarData(aviso.publicadoEm)}` : null,
  ].filter(Boolean)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${aviso.titulo}. ${partes.join(', ')}`}
      onPress={() => router.push({ pathname: '/avisos/[avisoId]', params: { avisoId: aviso.id } })}
      style={({ pressed }) => ({
        minHeight: ALVO,
        gap: ESPACO.e8,
        padding: ESPACO.e12,
        borderRadius: RAIO.controle,
        borderWidth: aviso.fixado ? 2 : 1,
        borderColor: aviso.fixado ? cores.destaque : cores.campoBorda,
        backgroundColor: cores.superficie,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
        {aviso.fixado ? <Icone nome="fixar" cor={cores.destaque} tamanho={18} /> : null}
        <Texto variante="tituloItem" style={{ flex: 1 }}>
          {aviso.titulo}
        </Texto>
        <Icone nome="avancar" cor={cores.textoSuave} tamanho={18} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
        {aviso.fixado ? <Selo texto="Fixado" cor="destaque" /> : null}
        {mostrarEstado && aviso.estado && aviso.estado !== 'publicado' ? (
          <Selo texto={NOME_DO_ESTADO[aviso.estado]} cor="alerta" />
        ) : null}
      </View>
      <Texto variante="corpo" numberOfLines={3}>
        {aviso.texto}
      </Texto>
      {aviso.publicadoEm ? (
        <Texto variante="legenda" cor="textoSuave">
          Publicado em {formatarData(aviso.publicadoEm)}
        </Texto>
      ) : null}
    </Pressable>
  )
}
