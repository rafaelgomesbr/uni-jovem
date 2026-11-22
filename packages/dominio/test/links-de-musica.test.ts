/* eslint-disable no-script-url -- os casos de teste incluem javascript: de propósito: a regra tem de recusá-lo */
import { describe, expect, it } from 'vitest'
import {
  conferirLinkDeMusica,
  linksAbriveisDaMusica,
  resumoDosLinksDaMusica,
  textoDeAbrirLink,
  tipoDoLinkDeMusica,
} from '../src/index.ts'
import { LINKS_ACEITOS, LINKS_RECUSADOS } from './casos-de-links.ts'

describe('links da música (D80)', () => {
  it.each(LINKS_ACEITOS)('aceita %s como %s', (url, tipo) => {
    expect(conferirLinkDeMusica(url)).toEqual({ ok: true, tipo })
    expect(tipoDoLinkDeMusica(url)).toBe(tipo)
  })

  it.each(LINKS_RECUSADOS)('recusa %j', (url) => {
    const r = conferirLinkDeMusica(url)
    expect(r.ok).toBe(false)
    expect(tipoDoLinkDeMusica(url)).toBeNull()
  })

  it('o motivo da recusa vem em palavras, sem termo técnico', () => {
    const motivo = (url: string) => {
      const r = conferirLinkDeMusica(url)
      return r.ok ? '' : r.motivo
    }
    expect(motivo('http://youtu.be/x')).toMatch(/começar com https/)
    expect(motivo('javascript:alert(1)')).toMatch(/começar com https/)
    expect(motivo('https://exemplo.test/x')).toMatch(/Google Drive ou do YouTube/)
    expect(motivo('https://a:b@youtu.be/x')).toMatch(/usuário e senha/)
    expect(motivo('https://youtu.be/a b')).toMatch(/espaços/)
    expect(motivo(`https://youtu.be/${'a'.repeat(2100)}`)).toMatch(/muito longo/)
  })

  it('o texto do botão diz onde o link abre', () => {
    expect(textoDeAbrirLink('youtube')).toBe('Abrir no YouTube')
    expect(textoDeAbrirLink('drive')).toBe('Abrir no Drive')
  })

  it('o resumo em texto das linhas de lista', () => {
    expect(resumoDosLinksDaMusica(undefined)).toBe('')
    expect(resumoDosLinksDaMusica([])).toBe('')
    expect(resumoDosLinksDaMusica([{ url: 'https://youtu.be/a' }])).toBe('YouTube')
    expect(resumoDosLinksDaMusica([{ url: 'https://drive.google.com/a' }])).toBe('Drive')
    expect(
      resumoDosLinksDaMusica([
        { url: 'https://drive.google.com/a' },
        { url: 'https://youtu.be/a' },
        { url: 'https://youtu.be/b' },
      ]),
    ).toBe('YouTube e Drive')
  })

  it('só abre o que passa na regra, mesmo vindo de fora', () => {
    const abriveis = linksAbriveisDaMusica([
      { url: 'javascript:alert(1)' },
      { url: ' https://youtu.be/ok ', rotulo: 'Versão ao vivo' },
      { url: 'https://exemplo.test/x' },
    ])
    expect(abriveis).toEqual([
      { url: 'https://youtu.be/ok', rotulo: 'Versão ao vivo', tipo: 'youtube' },
    ])
    expect(linksAbriveisDaMusica(null)).toEqual([])
  })
})
