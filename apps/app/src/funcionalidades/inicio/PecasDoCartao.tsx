import { ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import type { ReactElement, ReactNode } from 'react'
import { View } from 'react-native'

import type { EventoDoMomento } from '@/servicos/contratoV3'
import { Botao } from '@/ui/Botao'
import { Chip } from '@/ui/Chip'
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

/**
 * O selo de um alerta curto do cartão ("Sem músicas", "Falta: bateria"): ícone e palavras, num
 * fundo âmbar próprio. Substitui a frase solta "O repertório está vazio." (D79): o cartão fica com
 * UMA linha do que importa e o alerta vira um sinal pequeno, não mais uma linha de texto.
 */
export function SeloDoCartao({ texto }: { texto: string }) {
  return <Chip tom="alerta" icone="avisoAlerta" texto={texto} />
}

/** "1 de 3 encontros hoje": a posição do cartão entre os encontros do mesmo dia, para o leitor de tela. */
export function textoDaPosicao(p: { indice: number; total: number }): string {
  return `Encontro ${p.indice} de ${p.total} do dia`
}

/**
 * O que acompanha a etiqueta de tempo no alto do cartão (D79): "1 de 3" quando o dia tem mais de
 * um encontro, e "Última versão: hoje, 14:32" sem internet. Quebra para a linha de baixo, nunca
 * para fora do cartão.
 */
export function ChipsDoTopo({
  posicao,
  versaoSalva,
}: {
  posicao: { indice: number; total: number } | null
  versaoSalva: string | null
}) {
  if (!posicao && !versaoSalva) return null
  return (
    <>
      {posicao ? <Chip tom="neutro" texto={`${posicao.indice} de ${posicao.total}`} /> : null}
      {versaoSalva ? <Chip tom="neutro" texto={`Última versão: ${versaoSalva}`} /> : null}
    </>
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
    /**
     * "Convocar bateria": abre Quem vai já na função da banda (`funcao` e `bloco`, que a tela do
     * encontro entende para abrir a folha de convocar escolhida).
     */
    convocarFuncao: (funcao: string) =>
      router.push({
        pathname: '/evento/[eventoId]',
        params: { ...alvo, aba: 'convocados', funcao, bloco: 'Louvor' },
      }),
    /** Abre o mapa do sistema; sem endereço (local interno), abre o encontro na linha "Onde". */
    comoChegar: () => {
      const link = evento.local ? linkDoMapa(evento.local) : null
      if (link) void abrirLink(link)
      else abrirEncontro()
    },
    temMapa: !!evento.local && linkDoMapa(evento.local) !== null,
    /** Abre o encontro com "Dados do encontro" já aberto: editar é dentro do encontro, não numa tela à parte. */
    editar: () => router.push({ pathname: '/evento/[eventoId]', params: { ...alvo, editar: '1' } }),
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
    /** O encontro novo do zero (sem roteiro): copiar o último é um atalho dentro dessa tela, nunca o padrão. */
    marcarProximo: () => router.push('/evento/novo'),
  }
}

export type DestinosDoEncontro = ReturnType<typeof useDestinosDoEncontro>

/**
 * Os botões que não guardam estado (só levam a uma tela). Devolve `null` para as ações que a
 * tela do cartão trata por conta própria (aceitar, publicar, lembrar...). O caminho secundário do
 * cartão (D79) é um botão de verdade (`secundario`, com ícone quando ajuda a reconhecer), nunca
 * texto solto: o dono não via que "Ver quem vai" era botão.
 */
export function botaoComum(
  acao: AcaoDoMomento,
  principal: boolean,
  evento: { titulo: string },
  destinos: DestinosDoEncontro,
): ReactElement | null {
  const variante = principal ? 'primario' : 'secundario'
  switch (acao) {
    case 'ver':
      return (
        <Botao
          key={acao}
          titulo="Ver o encontro"
          variante={variante}
          icone="calendario"
          aoPressionar={destinos.abrirEncontro}
        />
      )
    case 'verProximo':
      return (
        <Botao
          key={acao}
          titulo="Ver o próximo encontro"
          variante={variante}
          icone="calendario"
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
          aoPressionar={destinos.abrirEncontro}
        />
      )
    case 'comoChegar':
      return (
        <Botao
          key={acao}
          titulo="Como chegar"
          variante={variante}
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
          aoPressionar={destinos.aoVivo}
        />
      )
    case 'conduzir':
      return (
        <Botao
          key={acao}
          titulo="Conduzir ao vivo"
          variante={variante}
          aoPressionar={destinos.aoVivo}
        />
      )
    case 'checkin':
      return (
        <Botao
          key={acao}
          titulo="Marcar quem chegou"
          variante={variante}
          icone="check"
          aoPressionar={destinos.checkin}
        />
      )
    case 'verConvocados':
      return (
        <Botao
          key={acao}
          titulo="Ver quem vai"
          variante={variante}
          icone="pessoas"
          aoPressionar={destinos.verConvocados}
        />
      )
    case 'marcarProximo':
      return (
        <Botao
          key={acao}
          titulo="Marcar o próximo encontro"
          variante={variante}
          aoPressionar={destinos.marcarProximo}
        />
      )
    default:
      return null
  }
}

/**
 * Os botões do cartão na ordem que `ParDeBotoes` espera (secundário primeiro; ao empilhar, ele
 * põe o primário em cima).
 */
export function ordenarBotoes(
  primario: ReactElement | null,
  secundario: ReactElement | null,
): ReactNode[] {
  return [secundario, primario].filter((b): b is ReactElement => b !== null)
}
