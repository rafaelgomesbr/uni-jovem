import { ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import type { ReactElement, ReactNode } from 'react'
import { View } from 'react-native'

import type { EventoDoMomento } from '@/servicos/contratoV3'
import { Botao } from '@/ui/Botao'
import { Icone, type NomeDoIcone } from '@/ui/Icone'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { abrirLink } from '@/utilidades/compartilhar'
import { linkDoMapa } from '@/utilidades/mapas'

import type { AcaoDoMomento } from './momento'

/** O motivo escrito de um botão desabilitado (cadeado e texto: cor nunca é o único sinal). */
export function LinhaDoMotivo({ texto }: { texto: string }) {
  const { cores } = useTema()
  return (
    <View
      testID="motivo-do-botao"
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e8 }}
    >
      <Icone nome="cadeado" cor={cores.textoSuave} tamanho={16} />
      <Texto variante="legenda" cor="textoSuave" style={{ flex: 1 }}>
        {texto}
      </Texto>
    </View>
  )
}

/**
 * Uma frase de atenção dentro do cartão (relógio e texto, num fundo âmbar próprio): para as
 * frases longas que o chip de uma linha cortaria ("Você ainda não respondeu. Dá tempo de avisar
 * a liderança.").
 */
export function AvisoDeEspera({
  texto,
  icone = 'relogio',
}: {
  texto: string
  icone?: NomeDoIcone
}) {
  const { cores, solido } = useTema()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: ESPACO.e8,
        paddingHorizontal: ESPACO.e12,
        paddingVertical: ESPACO.e8,
        borderRadius: RAIO.celula,
        backgroundColor: solido(cores.alertaFundo),
      }}
    >
      <Icone nome={icone} cor={cores.alerta} tamanho={16} />
      <Texto variante="chip" style={{ flex: 1, color: cores.alerta }}>
        {texto}
      </Texto>
    </View>
  )
}

/** "Bruno", "Bruno e Camila", "Bruno, Camila e Davi": a lista falada, com "e mais N" se cortou. */
export function listarNomes(nomes: readonly string[], totalReal = nomes.length): string {
  const primeiros = nomes.map((n) => n.split(' ')[0] ?? n)
  const resto = totalReal - primeiros.length
  if (resto > 0) return `${primeiros.join(', ')} e mais ${resto}`
  if (primeiros.length <= 1) return primeiros[0] ?? ''
  return `${primeiros.slice(0, -1).join(', ')} e ${primeiros.at(-1)}`
}

/** "1 pessoa", "11 pessoas". */
export function pessoas(n: number): string {
  return `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`
}

/**
 * O que o botão do repertório diz (D73): quem toca "Abrir o repertório" (o dele, com a cifra e o
 * Modo palco); quem não toca "Ver o repertório" (a lista e a banda, só leitura); a organização, sem
 * músicas ainda, "Montar o repertório".
 */
export function rotuloDoRepertorio(o: { toco: boolean; musicas: number; organiza: boolean }) {
  if (o.toco) return 'Abrir o repertório'
  if (o.musicas === 0 && o.organiza) return 'Montar o repertório'
  return 'Ver o repertório'
}

/** Para onde cada botão comum do cartão leva (o mesmo para o membro e para o líder). */
export function useDestinosDoEncontro(
  evento: { id: string; local?: EventoDoMomento['local'] },
  repertorio: { toco: boolean; musicas: number; organiza: boolean } = {
    toco: false,
    musicas: 0,
    organiza: false,
  },
) {
  const alvo = { eventoId: evento.id }
  const abrirEncontro = () => router.push({ pathname: '/evento/[eventoId]', params: alvo })
  return {
    abrirEncontro,
    verConvocados: () =>
      router.push({
        pathname: '/evento/[eventoId]',
        params: { ...alvo, aba: 'convocados' },
      }),
    /** Abre o mapa do sistema; sem endereço (local interno), abre o encontro na linha "Onde". */
    comoChegar: () => {
      const link = evento.local ? linkDoMapa(evento.local) : null
      if (link) void abrirLink(link)
      else abrirEncontro()
    },
    temMapa: !!evento.local && linkDoMapa(evento.local) !== null,
    editar: () => router.push({ pathname: '/evento/[eventoId]/editar', params: alvo }),
    checkin: () => router.push({ pathname: '/evento/[eventoId]/checkin', params: alvo }),
    aoVivo: () => router.push({ pathname: '/evento/[eventoId]/ao-vivo', params: alvo }),
    /**
     * Quem toca abre o repertório dele; os demais, a lista do encontro em leitura (D73): ninguém
     * esbarra em "você não está no louvor".
     */
    repertorio: () =>
      repertorio.toco
        ? router.push('/meu-repertorio')
        : router.push({ pathname: '/evento/[eventoId]/repertorio', params: alvo }),
    rotuloDoRepertorio: rotuloDoRepertorio(repertorio),
    /** A conferência "Igual ao último encontro" (ela mesma oferece o modelo padrão ou o zero, sem anterior). */
    marcarProximo: () => router.push('/evento/igual-ao-ultimo'),
  }
}

export type DestinosDoEncontro = ReturnType<typeof useDestinosDoEncontro>

/**
 * Os botões que não guardam estado (só levam a uma tela). Devolve `null` para as ações que a
 * tela do cartão trata por conta própria (aceitar, publicar, lembrar...). `comoLink`: o caminho
 * secundário do cartão (D75), só texto com 48 de altura, para o cartão ter UMA ação em destaque.
 */
export function botaoComum(
  acao: AcaoDoMomento,
  principal: boolean,
  evento: { titulo: string },
  destinos: DestinosDoEncontro,
  comoLink = false,
): ReactElement | null {
  const variante = principal ? 'primario' : comoLink ? 'terciario' : 'secundario'
  const aparencia = comoLink && !principal ? { alinhado: true as const } : {}
  switch (acao) {
    case 'ver':
      return (
        <Botao
          key={acao}
          titulo="Ver o encontro"
          variante={variante}
          {...aparencia}
          aoPressionar={destinos.abrirEncontro}
        />
      )
    case 'verProximo':
      return (
        <Botao
          key={acao}
          titulo="Ver o próximo encontro"
          variante={variante}
          {...aparencia}
          aoPressionar={destinos.abrirEncontro}
        />
      )
    case 'inscrever':
      // A inscrição (com a vaga, a espera e o QR de entrada) se conclui na tela do encontro.
      return (
        <Botao
          key={acao}
          titulo="Inscrever-me"
          variante={variante}
          {...aparencia}
          aoPressionar={destinos.abrirEncontro}
        />
      )
    case 'comoChegar':
      return (
        <Botao
          key={acao}
          titulo="Como chegar"
          variante={variante}
          {...aparencia}
          icone="local"
          rotuloAcessivel={`Como chegar a ${evento.titulo}`}
          aoPressionar={destinos.comoChegar}
        />
      )
    case 'repertorio':
      return (
        <Botao
          key={acao}
          titulo={destinos.rotuloDoRepertorio}
          variante={variante}
          {...aparencia}
          icone="musica"
          rotuloAcessivel={`${destinos.rotuloDoRepertorio}: ${evento.titulo}`}
          aoPressionar={destinos.repertorio}
        />
      )
    case 'aoVivo':
      return (
        <Botao
          key={acao}
          titulo={principal ? 'Acompanhar ao vivo' : 'Abrir ao vivo'}
          variante={variante}
          {...aparencia}
          aoPressionar={destinos.aoVivo}
        />
      )
    case 'conduzir':
      return (
        <Botao
          key={acao}
          titulo="Conduzir ao vivo"
          variante={variante}
          {...aparencia}
          aoPressionar={destinos.aoVivo}
        />
      )
    case 'checkin':
      return (
        <Botao
          key={acao}
          titulo="Marcar quem chegou"
          variante={variante}
          {...aparencia}
          aoPressionar={destinos.checkin}
        />
      )
    case 'verConvocados':
      return (
        <Botao
          key={acao}
          titulo="Ver quem vai"
          variante={variante}
          {...aparencia}
          aoPressionar={destinos.verConvocados}
        />
      )
    case 'editar':
      return <Botao key={acao} titulo="Editar" variante={variante} aoPressionar={destinos.editar} />
    case 'marcarProximo':
      return (
        <Botao
          key={acao}
          titulo="Marcar o próximo encontro"
          variante={variante}
          {...aparencia}
          aoPressionar={destinos.marcarProximo}
        />
      )
    default:
      return null
  }
}

/** O par de botões do cartão (ou o botão sozinho): secundário à esquerda, primário à direita. */
export function ordenarBotoes(
  primario: ReactElement | null,
  secundario: ReactElement | null,
): ReactNode[] {
  return [secundario, primario].filter((b): b is ReactElement => b !== null)
}
