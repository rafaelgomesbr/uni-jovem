import { useEffect, useState } from 'react'

import { NOME_DO_APP } from '@/constantes'
import { gravarPreferenciaLocal, lerPreferenciaLocal } from '@/estado/preferenciaLocal'

/**
 * Trava de idade no aparelho (TC-01.v2): depois de alguém responder "Tenho
 * menos de 16 anos", o mesmo aparelho só volta ao cadastro 24 horas depois,
 * para a pessoa não voltar na hora e escolher outra resposta. A marca é só o
 * instante, guardado no aparelho: sem dado pessoal e nada no servidor.
 */

const CHAVE = 'uj.cadastro.menor-de-16-em'
export const DURACAO_DA_TRAVA_MS = 24 * 60 * 60 * 1000

export const MENSAGEM_DA_TRAVA = `Para ter uma conta no ${NOME_DO_APP} é preciso ter 16 anos ou mais.`

export async function marcarMenorDe16(agora = Date.now()): Promise<void> {
  await gravarPreferenciaLocal(CHAVE, agora)
}

export async function cadastroTravado(agora = Date.now()): Promise<boolean> {
  const marca = await lerPreferenciaLocal<number>(CHAVE)
  return typeof marca === 'number' && agora - marca < DURACAO_DA_TRAVA_MS
}

/**
 * `null` enquanto confere, depois `true` ou `false`. Lida uma vez, ao abrir a
 * tela: quem marca "menos de 16" agora vê a mensagem do próprio passo, e a
 * trava vale para a próxima vez que abrir o cadastro.
 */
export function useCadastroTravado(): boolean | null {
  const [travado, setTravado] = useState<boolean | null>(null)
  useEffect(() => {
    let vivo = true
    void cadastroTravado().then((t) => {
      if (vivo) setTravado(t)
    })
    return () => {
      vivo = false
    }
  }, [])
  return travado
}

/** Tira a trava (testes; e, se um dia houver, o suporte a pedido do responsável). */
export async function apagarTravaDeIdade(): Promise<void> {
  await gravarPreferenciaLocal(CHAVE, null)
}
