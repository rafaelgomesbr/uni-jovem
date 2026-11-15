import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
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
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Tela } from '@/ui/Tela'

import { CodigosDeRecuperacao } from './CodigosDeRecuperacao'
import { ConfigurarAutenticador } from './ConfigurarAutenticador'
import { problemaDaSenha } from './politicaDeSenha'
import { RegrasDaSenha } from './RegrasDaSenha'

const TOTAL_DE_PASSOS = 3

/**
 * Primeiro acesso do Criador (3.1.2), em 3 passos com o cabeçalho de passos:
 * 1. Começar (aviso sobre o autenticador); 2. Autenticador (QR e chave);
 * 3. Senha e código. No fim, os códigos de recuperação.
 */
export function TelaPrimeiroAcesso() {
  const token = useTokenDoFragmento()
  const [passo, setPasso] = useState<1 | 2 | 3>(1)
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
    onSuccess: () => setPasso(2),
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
      <Tela pilha semVoltar aurora={1}>
        <EstadoVazio
          icone="link"
          titulo="Link incompleto"
          descricao="Abra de novo o link gerado no servidor. Ele vale por 30 minutos e só pode ser usado uma vez."
          telaInteira
          acao={{ titulo: 'Ir para entrar', aoPressionar: () => router.replace('/entrar') }}
        />
      </Tela>
    )
  }

  if (concluir.data) {
    return (
      <Tela pilha semVoltar aurora={1} titulo="Tudo pronto">
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
  const atual = iniciar.data ? passo : 1
  const titulos = { 1: 'Primeiro acesso', 2: 'Autenticador', 3: 'Senha e código' } as const

  const barra =
    atual === 1 ? (
      <BarraDeAcao>
        <Botao
          titulo="Começar"
          tamanho="grande"
          aoPressionar={() => iniciar.mutate()}
          carregando={iniciar.isPending}
        />
      </BarraDeAcao>
    ) : atual === 2 ? (
      <BarraDeAcao>
        <Botao titulo="Continuar" tamanho="grande" aoPressionar={() => setPasso(3)} />
      </BarraDeAcao>
    ) : (
      <BarraDeAcao>
        <Botao
          titulo="Ver o QR de novo"
          variante="secundario"
          tamanho="grande"
          aoPressionar={() => setPasso(2)}
        />
        <Botao
          titulo="Concluir"
          tamanho="grande"
          aoPressionar={enviar}
          carregando={concluir.isPending}
        />
      </BarraDeAcao>
    )

  return (
    <Tela
      pilha
      semVoltar
      aurora={1}
      passos={{ atual, total: TOTAL_DE_PASSOS }}
      titulo={titulos[atual]}
      {...(atual === 1
        ? {
            descricao: `Você vai criar a conta de quem administra a plataforma ${NOME_DO_APP}. Ela exige verificação em duas etapas.`,
          }
        : {})}
      barraDeAcao={barra}
    >
      {atual === 1 ? (
        <>
          <Aviso tipo="info" titulo="Tenha um app autenticador à mão">
            {`No próximo passo você cadastra o ${NOME_DO_APP} num app como o Google Authenticator ou o app Senhas do iPhone. Ele gera o código de 6 números que protege a conta.`}
          </Aviso>
          {iniciar.error ? <AvisoDeErro erro={iniciar.error} /> : null}
        </>
      ) : atual === 2 && iniciar.data ? (
        <ConfigurarAutenticador uri={iniciar.data.uri} segredo={iniciar.data.segredo} />
      ) : (
        <CartaoDeVidro intervalo={ESPACO.e16}>
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
            codigo
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            onSubmitEditing={enviar}
          />
          {concluir.error && !senhaFraca ? <AvisoDeErro erro={concluir.error} /> : null}
        </CartaoDeVidro>
      )}
    </Tela>
  )
}
