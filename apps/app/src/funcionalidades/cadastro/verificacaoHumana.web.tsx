import { createElement, useEffect, useRef, useState } from 'react'

import { api } from '@/servicos/api'
import { ErroLocal } from '@/servicos/erros'
import { Texto } from '@/ui/Texto'

interface Turnstile {
  render(elemento: HTMLElement, opcoes: Record<string, unknown>): string
  reset(id: string): void
  remove(id: string): void
  ready(aoCarregar: () => void): void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

let carregamento: Promise<Turnstile> | undefined

function carregar(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  carregamento ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script')
    const limite = setTimeout(() => reject(new Error('Verificação indisponível')), 20_000)
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => {
      clearTimeout(limite)
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('Verificação indisponível'))
    }
    script.onerror = () => {
      clearTimeout(limite)
      reject(new Error('Verificação indisponível'))
    }
    document.head.appendChild(script)
  }).catch((erro: unknown) => {
    carregamento = undefined
    throw erro
  })
  return carregamento
}

/** Um token novo por envio, inclusive ao reenviar o código ou corrigir os dados. */
export function useVerificacaoHumana() {
  // O recipiente é estado, não ref: o desafio aparece só na tela "Falta pouco" (D63), depois da
  // configuração já ter chegado, e o efeito precisa rodar quando o elemento nasce.
  const [recipiente, setRecipiente] = useState<HTMLDivElement | null>(null)
  const widget = useRef<{ api: Turnstile; id: string } | null>(null)
  const token = useRef<string | undefined>(undefined)
  const [configuracao, setConfiguracao] = useState<{ turnstileChaveDoSite: string | null }>()
  const [falha, setFalha] = useState(false)

  useEffect(() => {
    const controle = new AbortController()
    void api
      .pedir<{ turnstileChaveDoSite: string | null }>('/api/auth/cadastro/configuracao', {
        autenticado: false,
        sinal: controle.signal,
      })
      .then(setConfiguracao)
      .catch(() => {
        if (!controle.signal.aborted) setFalha(true)
      })
    return () => controle.abort()
  }, [])

  useEffect(() => {
    const chave = configuracao?.turnstileChaveDoSite
    if (!chave || !recipiente) return
    let ativo = true
    void carregar()
      .then((turnstile) => {
        turnstile.ready(() => {
          if (!ativo) return
          const id = turnstile.render(recipiente, {
            sitekey: chave,
            language: 'pt-br',
            theme: 'auto',
            callback: (valor: string) => {
              token.current = valor
              setFalha(false)
            },
            'expired-callback': () => {
              token.current = undefined
            },
            'error-callback': () => {
              token.current = undefined
              setFalha(true)
            },
          })
          widget.current = { api: turnstile, id }
        })
      })
      .catch(() => {
        if (ativo) setFalha(true)
      })
    return () => {
      ativo = false
      if (widget.current) widget.current.api.remove(widget.current.id)
      widget.current = null
      token.current = undefined
    }
  }, [configuracao, recipiente])

  return {
    elemento: (
      <>
        {createElement('div', { ref: setRecipiente, 'aria-label': 'Verificação de segurança' })}
        {falha ? (
          <Texto variante="corpo">
            Não foi possível carregar a verificação de segurança. Recarregue a página.
          </Texto>
        ) : null}
      </>
    ),
    obterToken: (): string | undefined => {
      if (!configuracao || (configuracao.turnstileChaveDoSite && !token.current)) {
        throw new ErroLocal('Aguarde a verificação de segurança antes de enviar o código.')
      }
      return token.current
    },
    reiniciar: () => {
      token.current = undefined
      if (widget.current) widget.current.api.reset(widget.current.id)
    },
  }
}
