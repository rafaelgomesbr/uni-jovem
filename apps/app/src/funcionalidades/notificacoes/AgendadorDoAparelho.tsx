import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

import { registrarAoEncerrarSessao } from '@/estado/aoEncerrarSessao'
import { api } from '@/servicos/api'
import {
  agendarVersiculos,
  cancelarVersiculos,
  configurarApresentacao,
  tokenDoAparelho,
} from '@/servicos/notificacoesDoSistema'

import { fusoAtual, planejarVersiculos } from '../versiculo/plano'
import { usePreferenciasDaConta } from './consultas'
import { usePermissaoDoSistema } from './permissao'

// A preferência é da conta: ao sair, este aparelho para de mostrar o versículo dela.
registrarAoEncerrarSessao(() => cancelarVersiculos())

function diaLocal(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/**
 * Sem interface: mantém o aparelho em dia com a conta.
 * - Reagenda os próximos 30 versículos ao abrir o app, quando a preferência
 *   ou a permissão mudam, e ao voltar ao app com outro fuso ou em outro dia.
 * - Registra o token nativo de push na API quando há permissão (a cada
 *   abertura: o token pode mudar e o registro é idempotente).
 * Na web, as funções do sistema não fazem nada.
 */
export function AgendadorDoAparelho() {
  const preferencias = usePreferenciasDaConta()
  const permissao = usePermissaoDoSistema()
  const [marca, setMarca] = useState(() => ({ fuso: fusoAtual(), dia: diaLocal() }))
  const tokenEnviado = useRef(false)
  const versiculo = preferencias.data?.versiculo

  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return
      const agora = { fuso: fusoAtual(), dia: diaLocal() }
      setMarca((antes) => (antes.fuso === agora.fuso && antes.dia === agora.dia ? antes : agora))
    })
    return () => assinatura.remove()
  }, [])

  const ativo = versiculo?.ativo
  const hora = versiculo?.hora
  useEffect(() => {
    if (ativo === undefined || hora === undefined || permissao === null) return
    configurarApresentacao()
    agendarVersiculos(ativo ? planejarVersiculos(new Date(), hora) : []).catch(() => {
      // Falha do sistema ao agendar: tenta de novo na próxima abertura.
    })
  }, [ativo, hora, permissao, marca])

  useEffect(() => {
    if (permissao !== 'concedida' || tokenEnviado.current) return
    tokenEnviado.current = true
    void (async () => {
      const t = await tokenDoAparelho()
      if (!t) return
      try {
        await api.put('/api/v1/eu/notificacoes/aparelho', t)
      } catch {
        // Sem rede agora: tenta de novo na próxima abertura do app.
        tokenEnviado.current = false
      }
    })()
  }, [permissao])

  return null
}
