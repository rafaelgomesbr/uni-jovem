import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type {
  CodigosDeRecuperacao as RespostaDeCodigos,
  ConfiguracaoDoAutenticador,
} from '@/servicos/contrato'
import { mensagemDoErro } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Tela } from '@/ui/Tela'

import { CodigosDeRecuperacao } from '../autenticacao/CodigosDeRecuperacao'
import { ConfigurarAutenticador } from '../autenticacao/ConfigurarAutenticador'

const TOTAL_DE_PASSOS = 3

function ErroDaAcao({ erro }: { erro: unknown }) {
  return (
    <Aviso tipo="erro" titulo="Não deu certo" anunciar>
      {mensagemDoErro(erro)}
    </Aviso>
  )
}

/**
 * Ligar a verificação em duas etapas (3.6.5), no mesmo padrão em 3 passos do
 * primeiro acesso: confirmar a senha, cadastrar o autenticador e digitar o
 * código, e guardar os códigos de recuperação.
 */
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
      <Tela pilha passos={{ atual: 3, total: TOTAL_DE_PASSOS }} titulo="Verificação ligada">
        <CodigosDeRecuperacao
          codigos={confirmar.data.codigosDeRecuperacao}
          rotuloDeConcluir="Voltar ao perfil"
          aoConcluir={() => router.back()}
        />
      </Tela>
    )
  }

  if (!iniciar.data) {
    const continuar = () => {
      setErro(senhaAtual ? null : 'Informe sua senha atual.')
      if (senhaAtual) iniciar.mutate()
    }
    return (
      <Tela
        pilha
        passos={{ atual: 1, total: TOTAL_DE_PASSOS }}
        titulo="Verificação em duas etapas"
        descricao="Além da senha, um código do app autenticador passa a ser pedido ao entrar. Primeiro, confirme sua senha."
        barraDeAcao={
          <BarraDeAcao>
            <Botao
              titulo="Continuar"
              tamanho="grande"
              carregando={iniciar.isPending}
              aoPressionar={continuar}
            />
          </BarraDeAcao>
        }
      >
        <CartaoDeVidro opaco>
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
            onSubmitEditing={continuar}
          />
        </CartaoDeVidro>
        {iniciar.error ? <ErroDaAcao erro={iniciar.error} /> : null}
      </Tela>
    )
  }

  function enviar() {
    const ok = /^\d{6}$/.test(codigo.trim())
    setErro(ok ? null : 'Digite os 6 números que aparecem no app autenticador.')
    if (ok) confirmar.mutate()
  }

  return (
    <Tela
      pilha
      passos={{ atual: 2, total: TOTAL_DE_PASSOS }}
      titulo="Autenticador"
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Ligar a verificação"
            tamanho="grande"
            aoPressionar={enviar}
            carregando={confirmar.isPending}
          />
        </BarraDeAcao>
      }
    >
      <ConfigurarAutenticador uri={iniciar.data.uri} segredo={iniciar.data.segredo} />
      <CartaoDeVidro sobrancelha="Confirme o código" opaco intervalo={ESPACO.e16}>
        <Campo
          rotulo="Código do app autenticador"
          value={codigo}
          onChangeText={setCodigo}
          erro={erro}
          codigo
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          onSubmitEditing={enviar}
        />
      </CartaoDeVidro>
      {confirmar.error ? <ErroDaAcao erro={confirmar.error} /> : null}
    </Tela>
  )
}
