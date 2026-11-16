import type { Paleta } from '@uj/tokens'
import { router } from 'expo-router'

import type { NomeDoIcone } from '@/ui/Icone'
import { IndicadorDeConexao } from '@/ui/IndicadorDeConexao'
import { StatusDoCabecalho } from '@/ui/StatusDoCabecalho'
import { useAnunciar } from '@/ui/useAnunciar'

import { contar, horaNoAparelho } from './formatos'
import { useOffline, type Offline } from './ProvedorOffline'

export interface SinalDaSincronizacao {
  /** Até 22 caracteres: cabe na linha da pílula (seção 2.12.15). */
  texto: string
  /** O que o leitor de tela ouve, com o detalhe que não cabe no texto. */
  falado: string
  icone: NomeDoIcone
  cor: keyof Paleta
  tentarDeNovo: boolean
}

type Entrada = Pick<
  Offline,
  | 'online'
  | 'fase'
  | 'pendentes'
  | 'rejeitadas'
  | 'conflitos'
  | 'ultimaSincronizacao'
  | 'temParticao'
>

/**
 * O que o status diz, em ordem de urgência (tabela da 2.12.15). Sempre texto
 * e ícone: a cor só reforça. Só aparece com pendência, conflito, falha ou sem
 * conexão (D57); com tudo enviado, `null`.
 */
export function sinalDaSincronizacao(o: Entrada): SinalDaSincronizacao | null {
  const pendentes = contar(o.pendentes, 'alteração pendente', 'alterações pendentes')
  if (!o.online) {
    return {
      texto: 'Sem conexão',
      falado: o.pendentes
        ? `Sem conexão. ${pendentes}`
        : o.ultimaSincronizacao
          ? `Sem conexão. Sincronizado às ${horaNoAparelho(o.ultimaSincronizacao)}`
          : 'Sem conexão',
      icone: 'semConexao',
      cor: 'alerta',
      tentarDeNovo: false,
    }
  }
  // Sincronizando só aparece quando há o que enviar: a atualização de rotina fica quieta.
  if (o.fase === 'sincronizando' && o.pendentes) {
    return {
      texto: 'Sincronizando',
      falado: 'Sincronizando',
      icone: 'sincronizar',
      cor: 'destaque',
      tentarDeNovo: false,
    }
  }
  if (o.conflitos) {
    const texto = contar(o.conflitos, 'conflito', 'conflitos')
    return {
      texto,
      falado: `${texto} a resolver`,
      icone: 'erro',
      cor: 'alerta',
      tentarDeNovo: false,
    }
  }
  if (o.fase === 'falha') {
    return {
      texto: 'Falha. Tentar de novo',
      falado: 'A sincronização falhou. Tentar de novo',
      icone: 'erro',
      cor: 'erro',
      tentarDeNovo: true,
    }
  }
  if (o.rejeitadas) {
    return {
      texto: contar(o.rejeitadas, 'recusada', 'recusadas'),
      falado: contar(o.rejeitadas, 'alteração recusada', 'alterações recusadas'),
      icone: 'erro',
      cor: 'alerta',
      tentarDeNovo: false,
    }
  }
  if (o.pendentes) {
    return {
      texto: contar(o.pendentes, 'pendente', 'pendentes'),
      falado: pendentes,
      icone: 'relogio',
      cor: 'alerta',
      tentarDeNovo: false,
    }
  }
  // Tudo enviado: nada a dizer (D57). "Sincronizado" não diz nada a quem não sabe o que é.
  return null
}

/**
 * Status da sincronização na linha da pílula (sem conexão, pendentes,
 * enviando, falha e conflitos). O toque abre Uso sem internet;
 * na falha, tenta de novo. Na web (sem modo offline), só o "Sem conexão".
 */
export function IndicadorDeSincronizacao() {
  const offline = useOffline()
  const online = offline.online
  const disponivel = offline.disponivel

  // O status visual não é anunciado sozinho: avisa o leitor de tela quando a rede cai.
  // Sem modo offline, quem anuncia é o `IndicadorDeConexao` (um aviso só).
  useAnunciar(!online && disponivel ? 'Sem conexão com a internet' : null)

  if (!offline.disponivel) return <IndicadorDeConexao />
  const sinal = sinalDaSincronizacao(offline)
  if (!sinal) return null

  return (
    <StatusDoCabecalho
      icone={sinal.icone}
      cor={sinal.cor}
      texto={sinal.texto}
      rotulo={sinal.tentarDeNovo ? sinal.falado : `${sinal.falado}. Abrir Uso sem internet.`}
      aoPressionar={
        sinal.tentarDeNovo
          ? () => void offline.sincronizarAgora()
          : () => router.push('/pendencias')
      }
    />
  )
}
