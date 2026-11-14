import { useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type {
  CodigosDeRecuperacao as RespostaDeCodigos,
  ConfiguracaoDoAutenticador,
} from '@/servicos/contrato'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { Tela } from '@/ui/Tela'

import { CodigosDeRecuperacao } from '../autenticacao/CodigosDeRecuperacao'
import { ConfigurarAutenticador } from '../autenticacao/ConfigurarAutenticador'

export function TelaAtivar2fa() {
  const consultas = useQueryClient()
  const [senhaAtual, setSenhaAtual] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const iniciar = useMutation({
    mutationFn: () => api.post<ConfiguracaoDoAutenticador>('/api/auth/2fa/iniciar', { senhaAtual }),
    onSuccess: () => setSenhaAtual(''),
  })
  const confirmar = useMutation({
    mutationFn: () =>
      api.post<RespostaDeCodigos>('/api/auth/2fa/confirmar', { codigo: codigo.trim() }),
    onSuccess: () => consultas.invalidateQueries({ queryKey: CHAVES.eu }),
  })

  if (confirmar.data) {
    return (
      <Tela cabecalhoNativo titulo="Verificação ligada">
        <CodigosDeRecuperacao
          codigos={confirmar.data.codigosDeRecuperacao}
          rotuloDeConcluir="Voltar ao perfil"
          aoConcluir={() => router.back()}
        />
      </Tela>
    )
  }

  if (!iniciar.data) {
    return (
      <Tela
        cabecalhoNativo
        titulo="Verificação em duas etapas"
        descricao="Além da senha, um código do app autenticador passa a ser pedido ao entrar. Primeiro, confirme sua senha."
      >
        <Cartao>
          <Campo
            rotulo="Senha atual"
            senha
            value={senhaAtual}
            onChangeText={setSenhaAtual}
            erro={erro}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
          />
          {iniciar.error ? <AvisoDeErro erro={iniciar.error} /> : null}
          <Botao
            titulo="Continuar"
            carregando={iniciar.isPending}
            aoPressionar={() => {
              setErro(senhaAtual ? null : 'Informe sua senha atual.')
              if (senhaAtual) iniciar.mutate()
            }}
          />
        </Cartao>
      </Tela>
    )
  }

  function enviar() {
    const ok = /^\d{6}$/.test(codigo.trim())
    setErro(ok ? null : 'Digite os 6 números que aparecem no app autenticador.')
    if (ok) confirmar.mutate()
  }

  return (
    <Tela cabecalhoNativo titulo="Verificação em duas etapas">
      <ConfigurarAutenticador uri={iniciar.data.uri} segredo={iniciar.data.segredo} />
      <Cartao titulo="Confirme o código" icone="confirmado">
        <Campo
          rotulo="Código do app autenticador"
          value={codigo}
          onChangeText={setCodigo}
          erro={erro}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          onSubmitEditing={enviar}
        />
        {confirmar.error ? <AvisoDeErro erro={confirmar.error} /> : null}
        <Botao
          titulo="Ligar a verificação"
          aoPressionar={enviar}
          carregando={confirmar.isPending}
        />
      </Cartao>
    </Tela>
  )
}
