import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'

import { CartaoDeDestaque } from './visual'

/**
 * Sem comunidade ativa: os caminhos para começar. O Criador cria a primeira
 * comunidade; qualquer pessoa entra numa com o link ou o código do convite.
 * Pensado para ser usado também no aviso de "sem comunidade" das outras abas.
 */
export function AtalhosParaComecar() {
  const { conta, comunidades } = useSessao()
  const consultas = useQueryClient()

  if (conta?.criador) {
    return (
      <CartaoDeDestaque
        sobrancelha="Área do Criador"
        titulo="Criar comunidade"
        descricao={
          comunidades.length
            ? 'Crie mais uma comunidade, ou escolha uma das suas para continuar.'
            : 'Você ainda não participa de nenhuma comunidade. Crie a primeira e entre nela como administrador.'
        }
      >
        <Botao
          titulo="Criar comunidade"
          icone="adicionar"
          aoPressionar={() => router.push('/plataforma/nova')}
        />
        {comunidades.length ? (
          <Botao
            titulo="Escolher comunidade"
            icone="trocar"
            variante="secundario"
            aoPressionar={() => router.push('/trocar-comunidade')}
          />
        ) : null}
        <Botao
          titulo="Entrar com um convite"
          icone="link"
          variante="secundario"
          aoPressionar={() => router.push('/entrar-com-convite')}
        />
        <Botao
          titulo="Abrir a Plataforma"
          icone="plataforma"
          variante="terciario"
          aoPressionar={() => router.push('/plataforma')}
        />
      </CartaoDeDestaque>
    )
  }

  if (comunidades.length) {
    return (
      <Cartao>
        <EstadoVazio
          icone="trocar"
          titulo="Escolha uma comunidade"
          descricao="Você participa de mais de uma. Escolha qual quer ver agora; dá para trocar a qualquer momento."
          acao={{
            titulo: 'Escolher comunidade',
            icone: 'trocar',
            variante: 'primario',
            aoPressionar: () => router.push('/trocar-comunidade'),
          }}
        />
        <Botao
          titulo="Entrar com um convite"
          icone="link"
          variante="terciario"
          style={{ alignSelf: 'center' }}
          larguraTotal={false}
          aoPressionar={() => router.push('/entrar-com-convite')}
        />
      </Cartao>
    )
  }

  return (
    <Cartao>
      <EstadoVazio
        icone="link"
        titulo="Você ainda não participa de uma comunidade"
        descricao="Recebeu um convite? Cole o link ou o código para entrar. Se ainda não recebeu, peça a quem administra a sua comunidade."
        acao={{
          titulo: 'Entrar com um convite',
          icone: 'link',
          variante: 'primario',
          aoPressionar: () => router.push('/entrar-com-convite'),
        }}
      />
      <Botao
        titulo="Verificar de novo"
        icone="sincronizar"
        variante="terciario"
        style={{ alignSelf: 'center' }}
        larguraTotal={false}
        aoPressionar={() => void consultas.invalidateQueries({ queryKey: CHAVES.eu })}
      />
    </Cartao>
  )
}
