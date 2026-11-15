import { mensagemDoErro, SemConexao } from '@/servicos/erros'

import { Aviso } from './Aviso'
import { EstadoVazio } from './EstadoVazio'
import { useAnunciar } from './useAnunciar'

interface PropsDoAvisoDeFalha {
  /** Erro de qualquer origem; a mensagem humana vem de `mensagemDoErro`. */
  erro?: unknown
  /** Texto próprio, no lugar da mensagem do erro. */
  mensagem?: string
  titulo?: string
  aoTentarDeNovo?: () => void
}

/**
 * Falha de uma ação ou de um bloco da tela (seção 2.12.23): o `Aviso` de
 * erro com título específico, a mensagem em linguagem humana e, quando dá,
 * o terciário "Tentar de novo". Sem conexão vira alerta. Sempre anunciado
 * (o papel `alert` não fala no iOS). Erro que pede ação não vai em toast.
 */
export function AvisoDeFalha({ erro, mensagem, titulo, aoTentarDeNovo }: PropsDoAvisoDeFalha) {
  const semConexao = erro instanceof SemConexao
  return (
    <Aviso
      tipo={semConexao ? 'alerta' : 'erro'}
      titulo={titulo ?? (semConexao ? 'Sem conexão' : 'Não deu certo')}
      anunciar
      {...(aoTentarDeNovo
        ? { acao: { titulo: 'Tentar de novo', aoPressionar: aoTentarDeNovo } }
        : {})}
    >
      {mensagem ?? mensagemDoErro(erro)}
    </Aviso>
  )
}

interface PropsDoErroDaTela {
  erro: unknown
  /** Título próprio ("A programação não abriu"). */
  titulo?: string
  /** Completa "Não deu para carregar ..." ("a agenda", "as suas escalas"), quando não há título. */
  oQue?: string
  aoTentarDeNovo: () => void
}

/**
 * Erro de tela inteira (2.12.23): um estado vazio com o ícone de erro e o
 * primário "Tentar de novo", no lugar do conteúdo que não carregou. Sem
 * internet é alerta, não erro: o título diz isso. Anunciado ao aparecer.
 */
export function ErroDaTela({ erro, titulo, oQue, aoTentarDeNovo }: PropsDoErroDaTela) {
  const semConexao = erro instanceof SemConexao
  const tituloFinal =
    titulo ??
    (semConexao ? 'Sem conexão' : oQue ? `Não deu para carregar ${oQue}` : 'Não deu para abrir')
  const descricao = mensagemDoErro(erro)
  useAnunciar(`${tituloFinal}. ${descricao}`)
  return (
    <EstadoVazio
      icone={semConexao ? 'semConexao' : 'erro'}
      titulo={tituloFinal}
      descricao={descricao}
      acao={{ titulo: 'Tentar de novo', icone: 'sincronizar', aoPressionar: aoTentarDeNovo }}
    />
  )
}
