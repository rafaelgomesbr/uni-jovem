import { onlineManager, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'

import { criarClienteDaApi } from '@/servicos/api'
import { mensagemDoErro, MENSAGEM_SEM_CONEXAO, SemConexao } from '@/servicos/erros'
import { armazenamentoEmMemoria, esperar } from '@/testes/dubles'

import { criarClienteDeConsulta } from '../clienteDeConsulta'

/**
 * A1 da auditoria de qualidade (15/11/2026): publicar sem rede deixava o botão
 * girando para sempre e o POST (com push para a comunidade) saía sozinho
 * quando a rede voltava. Agora falha na hora, com a mensagem humana.
 */
function montar() {
  const semRede = jest.fn(async () => {
    throw new TypeError('Network request failed')
  })
  const cliente = criarClienteDaApi({
    baseUrl: '',
    plataforma: 'ios',
    armazenamento: armazenamentoEmMemoria(),
    fetch: semRede as unknown as typeof fetch,
  })
  const consultas = criarClienteDeConsulta()

  /** Uma tela mínima de "Publicar aviso", como as do app: botão e erro por `mensagemDoErro`. */
  function TelaDePublicar() {
    const publicar = useMutation({
      mutationFn: () =>
        cliente.post('/api/v1/c/com-1/avisos', { titulo: 'Culto', texto: 'Sábado às 19h' }),
    })
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: publicar.isPending }}
          onPress={() => publicar.mutate()}
        >
          <Text>{publicar.isPending ? 'Publicando…' : 'Publicar agora'}</Text>
        </Pressable>
        {publicar.isError ? <Text>{mensagemDoErro(publicar.error)}</Text> : null}
        {publicar.isPaused ? <Text>Pausado</Text> : null}
      </>
    )
  }

  return {
    semRede,
    consultas,
    /** Sessão aberta antes de a rede cair (o caso da auditoria). */
    entrar: () => cliente.abrirSessao({ segundoFator: false, acesso: 'acesso' }),
    tela: (
      <QueryClientProvider client={consultas}>
        <TelaDePublicar />
      </QueryClientProvider>
    ),
  }
}

describe('mutação sem rede (A1)', () => {
  beforeEach(() => onlineManager.setOnline(false))
  afterEach(() => onlineManager.setOnline(true))

  test('falha na hora com "Sem conexão", libera o botão e nada sai quando a rede volta', async () => {
    const { semRede, consultas, tela, entrar } = montar()
    await entrar()
    await render(tela)
    await act(async () => fireEvent.press(screen.getByText('Publicar agora')))

    expect(await screen.findByText(MENSAGEM_SEM_CONEXAO)).toBeTruthy()
    expect(screen.getByText('Publicar agora')).toBeTruthy()
    expect(screen.queryByText('Pausado')).toBeNull()
    expect(semRede).toHaveBeenCalledTimes(1)

    const [mutacao] = consultas.getMutationCache().getAll()
    expect(mutacao?.state.error).toBeInstanceOf(SemConexao)

    // A rede volta: nenhum envio atrasado, sem a pessoa saber.
    await act(async () => {
      onlineManager.setOnline(true)
      await esperar(50)
    })
    expect(semRede).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(consultas.isMutating()).toBe(0))
    consultas.clear()
  })

  test('o padrão vale para toda mutação do cliente do app', () => {
    const consultas = criarClienteDeConsulta()
    expect(consultas.getDefaultOptions().mutations).toMatchObject({
      networkMode: 'always',
      retry: false,
    })
    // As consultas continuam pausando sem rede (mostram o que já está no cache).
    expect(consultas.getDefaultOptions().queries?.networkMode).toBeUndefined()
  })
})
