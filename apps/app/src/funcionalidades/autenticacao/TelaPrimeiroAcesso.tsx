import { useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'

import { NOME_DO_APP } from '@/constantes'
import { api } from '@/servicos/api'
import type {
  CodigosDeRecuperacao as RespostaDeCodigos,
  ConfiguracaoDoAutenticador,
} from '@/servicos/contrato'
import { ehErroDaApi } from '@/servicos/erros'
import { useTokenDoFragmento } from '@/utilidades/fragmento'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { CodigosDeRecuperacao } from './CodigosDeRecuperacao'
import { ConfigurarAutenticador } from './ConfigurarAutenticador'
import { problemaDaSenha } from './politicaDeSenha'
import { RegrasDaSenha } from './RegrasDaSenha'

/** Primeiro acesso do Criador: senha + autenticador obrigatório + códigos de recuperação. */
export function TelaPrimeiroAcesso() {
  const token = useTokenDoFragmento()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erroDaSenha, setErroDaSenha] = useState<string | null>(null)
  const [erroDoCodigo, setErroDoCodigo] = useState<string | null>(null)

  const iniciar = useMutation({
    mutationFn: () =>
      api.post<ConfiguracaoDoAutenticador>(
        '/api/auth/primeiro-acesso/iniciar',
        { token },
        { autenticado: false },
      ),
  })
  const concluir = useMutation({
    mutationFn: () =>
      api.post<RespostaDeCodigos>(
        '/api/auth/primeiro-acesso/concluir',
        { token, senha, codigo: codigo.trim() },
        { autenticado: false },
      ),
  })

  if (!token) {
    return (
      <Tela cabecalhoNativo>
        <EstadoVazio
          icone="link"
          titulo="Link incompleto"
          descricao="Abra de novo o link gerado no servidor. Ele vale por 30 minutos e só pode ser usado uma vez."
        />
      </Tela>
    )
  }

  if (concluir.data) {
    return (
      <Tela cabecalhoNativo titulo="Tudo pronto">
        <CodigosDeRecuperacao
          codigos={concluir.data.codigosDeRecuperacao}
          rotuloDeConcluir="Ir para entrar"
          aoConcluir={() => router.replace('/entrar')}
        />
      </Tela>
    )
  }

  function enviar() {
    const problema = problemaDaSenha(senha, confirmacao)
    setErroDaSenha(problema)
    const codigoOk = /^\d{6}$/.test(codigo.trim())
    setErroDoCodigo(codigoOk ? null : 'Digite os 6 números que aparecem no app autenticador.')
    if (!problema && codigoOk) concluir.mutate()
  }

  const senhaFraca = ehErroDaApi(concluir.error, 'senha_fraca') ? concluir.error.mensagem : null

  return (
    <Tela
      cabecalhoNativo
      titulo="Primeiro acesso"
      descricao={`Você vai criar a conta de quem administra a plataforma ${NOME_DO_APP}. Ela exige verificação em duas etapas.`}
    >
      {!iniciar.data ? (
        <Cartao titulo="Antes de começar" icone="seguranca">
          <Texto variante="apoio">
            Tenha em mãos um app autenticador no celular. No próximo passo você vai cadastrar o{' '}
            {NOME_DO_APP} nele e criar sua senha.
          </Texto>
          {iniciar.error ? <AvisoDeErro erro={iniciar.error} /> : null}
          <Botao
            titulo="Começar"
            aoPressionar={() => iniciar.mutate()}
            carregando={iniciar.isPending}
          />
        </Cartao>
      ) : (
        <>
          <ConfigurarAutenticador uri={iniciar.data.uri} segredo={iniciar.data.segredo} />
          <Cartao titulo="Crie sua senha" icone="chave">
            <RegrasDaSenha senha={senha} />
            <Campo
              rotulo="Senha"
              senha
              value={senha}
              onChangeText={setSenha}
              erro={erroDaSenha ?? senhaFraca}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <Campo
              rotulo="Repita a senha"
              senha
              value={confirmacao}
              onChangeText={setConfirmacao}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <Campo
              rotulo="Código do app autenticador"
              value={codigo}
              onChangeText={setCodigo}
              erro={erroDoCodigo}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              onSubmitEditing={enviar}
            />
            {concluir.error && !senhaFraca ? <AvisoDeErro erro={concluir.error} /> : null}
            <Botao titulo="Concluir" aoPressionar={enviar} carregando={concluir.isPending} />
          </Cartao>
        </>
      )}
    </Tela>
  )
}
