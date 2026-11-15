import { describe, expect, it } from 'vitest'

import {
  contraste,
  CORES_DO_AVATAR,
  corDoAvatarPeloNome,
  ehCorDoAvatar,
  ehIconeDoAvatar,
  ICONES_DO_AVATAR,
  iniciaisDoNome,
  MINIMO,
  NOME_DO_ICONE_DO_AVATAR,
  NOMES_DAS_CORES_DO_AVATAR,
} from '../src/index.ts'

describe('avatar', () => {
  it('ícone e iniciais passam AA de texto sobre cada cor da paleta', () => {
    const falhas = Object.entries(CORES_DO_AVATAR)
      .map(([nome, cor]) => ({ nome, razao: Number(contraste(cor.frente, cor.fundo).toFixed(2)) }))
      .filter((c) => c.razao < MINIMO.texto)
    expect(falhas).toEqual([])
  })

  it('todo ícone tem nome legível e a lista não repete', () => {
    expect(new Set(ICONES_DO_AVATAR).size).toBe(ICONES_DO_AVATAR.length)
    for (const icone of ICONES_DO_AVATAR) expect(NOME_DO_ICONE_DO_AVATAR[icone]).toBeTruthy()
  })

  it('reconhece só nomes da lista fechada', () => {
    expect(ehIconeDoAvatar('nascer')).toBe(true)
    expect(ehIconeDoAvatar('caveira')).toBe(false)
    expect(ehIconeDoAvatar(null)).toBe(false)
    expect(ehCorDoAvatar('aurora')).toBe(true)
    expect(ehCorDoAvatar('toString')).toBe(false)
  })

  it('cor pelo nome é estável e sempre da paleta', () => {
    expect(corDoAvatarPeloNome('Ana Souza')).toBe(corDoAvatarPeloNome('  ana souza '))
    for (const nome of ['Ana', 'Bruno Lima', 'Çeci', '', 'José da Silva']) {
      expect(NOMES_DAS_CORES_DO_AVATAR).toContain(corDoAvatarPeloNome(nome))
    }
  })

  it('iniciais: primeiro e último nome, acentos preservados', () => {
    expect(iniciaisDoNome('Ana Souza Lima')).toBe('AL')
    expect(iniciaisDoNome('élida')).toBe('É')
    expect(iniciaisDoNome('  ')).toBe('?')
    expect(iniciaisDoNome('Pessoa removida')).toBe('PR')
  })
})
