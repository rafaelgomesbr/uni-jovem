import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'

import { useSessao } from '@/estado/sessao'
import { Botao } from '@/ui/Botao'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { parametro } from '@/utilidades/parametros'

import { esquecerDestino, guardarDestino } from '../autenticacao/destinoDepoisDeEntrar'
import { lerCodigoDaComunidade, tipoDoErroDaPrevia, usePreviaDoCodigo } from './consultas'
import { BlocoDaPrevia } from './TelaTenhoUmCodigo'

/**
 * Rota do link do código da comunidade: `/entrar/<codigo>` (D58), o mesmo
 * endereço do link universal, do App Link e do esquema do app. Nunca envia o
 * código sozinho:
 *
 * - com sessão: abre "Tenho um código" com o campo preenchido (a pessoa ainda
 *   confirma o consentimento e toca no botão, depois de ver a prévia);
 * - sem sessão: mostra a PRÉVIA PÚBLICA ("Você foi convidado para ...") antes de
 *   pedir qualquer coisa, guarda este endereço como destino e leva ao login.
 *   Entrando ou criando a conta, o app volta aqui e segue adiante;
 * - código fora do formato: tela com saída, sem laço.
 *
 * `/entrar` sem segmento continua sendo o login (`(publico)/entrar`).
 */
export function TelaLinkDoCodigo() {
  const { estado } = useSessao()
  const parametros = useLocalSearchParams<{ codigo?: string | string[] }>()
  const bruto = parametro(parametros.codigo)
  const codigo = bruto ? lerCodigoDaComunidade(bruto) : null

  if (!codigo) {
    return (
      <Tela pilha semVoltar titulo="Código não reconhecido">
        <EstadoVazio
          icone="erro"
          titulo="Este link não tem um código válido"
          descricao="O código tem 8 letras e números, como ABCD 2345. Confira o link com quem compartilhou ou digite o código no app."
          acao={{ titulo: 'Voltar ao início', aoPressionar: () => router.replace('/') }}
          telaInteira
        />
      </Tela>
    )
  }
  if (estado === 'anonimo') return <ConviteDoLink codigo={codigo} />
  if (estado === 'carregando') {
    return (
      <Tela rolar={false}>
        <Esqueleto rotulo="Abrindo o link">
          <CartaoDeEsqueleto titulo />
        </Esqueleto>
      </Tela>
    )
  }
  return <Redirect href={{ pathname: '/tenho-um-codigo', params: { codigo } }} />
}

/**
 * Quem ainda não tem conta vê a comunidade antes de gastar tempo com o login. O código inválido,
 * trocado ou de comunidade que não entra por código dá a mesma resposta (sem enumeração) e não
 * guarda destino; o limite de consultas e a falta de internet não impedem de seguir.
 */
function ConviteDoLink({ codigo }: { codigo: string }) {
  const previa = usePreviaDoCodigo(codigo)
  const tipoDoErro = previa.error ? tipoDoErroDaPrevia(previa.error) : null
  const recusado = tipoDoErro === 'nao_encontrado'

  // O destino guardado é o sistema externo aqui (memória do módulo de navegação).
  useEffect(() => {
    if (recusado) esquecerDestino()
    else guardarDestino(`/entrar/${codigo}`)
  }, [recusado, codigo])

  return (
    <Tela pilha semVoltar titulo={recusado ? 'Código não encontrado' : 'Você recebeu um convite'}>
      <BlocoDaPrevia
        carregando={previa.isPending}
        comunidade={previa.data?.comunidade ?? null}
        tipoDoErro={tipoDoErro}
        aoTentarDeNovo={() => void previa.refetch()}
        semSaida
        semTitulo
      />
      {recusado ? null : (
        <Texto variante="corpo" cor="textoSuave">
          Entre ou crie a sua conta para participar. O código fica guardado até você voltar.
        </Texto>
      )}
      <Botao
        titulo={recusado ? 'Ir para o login' : 'Entrar ou criar conta'}
        tamanho="grande"
        larguraTotal
        aoPressionar={() => router.push('/entrar')}
      />
    </Tela>
  )
}
