import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'

import { useSessao } from '@/estado/sessao'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Tela } from '@/ui/Tela'
import { parametro } from '@/utilidades/parametros'

import { guardarDestino } from '../autenticacao/destinoDepoisDeEntrar'
import { lerCodigoDaComunidade } from './consultas'

/**
 * Rota do link do código da comunidade: `/entrar/<codigo>` (D58), o mesmo
 * endereço do link universal, do App Link e do esquema do app. Só encaminha,
 * nunca envia o código sozinho:
 *
 * - com sessão: abre "Tenho um código" com o campo preenchido (a pessoa ainda
 *   confirma o consentimento e toca no botão);
 * - sem sessão: guarda este endereço como destino depois de entrar e vai para
 *   o login. Entrando ou criando a conta, o app volta aqui e segue adiante;
 * - código fora do formato: tela com saída, sem laço.
 *
 * `/entrar` sem segmento continua sendo o login (`(publico)/entrar`).
 */
export function TelaLinkDoCodigo() {
  const { estado } = useSessao()
  const parametros = useLocalSearchParams<{ codigo?: string | string[] }>()
  const bruto = parametro(parametros.codigo)
  const codigo = bruto ? lerCodigoDaComunidade(bruto) : null
  const anonimo = estado === 'anonimo'

  // O destino guardado é o sistema externo aqui (memória do módulo de navegação).
  useEffect(() => {
    if (anonimo && codigo) guardarDestino(`/entrar/${codigo}`)
  }, [anonimo, codigo])

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
  if (anonimo) return <Redirect href="/entrar" />
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
