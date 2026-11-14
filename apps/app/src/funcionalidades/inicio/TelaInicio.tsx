import { router } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { primeiroNome } from '@/utilidades/formatos'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Texto } from '@/ui/Texto'

import { usePode } from '../comunidade/permissoes'
import { TelaDoApp } from '../navegacao/TelaDoApp'

function saudacao(agora = new Date()): string {
  const hora = agora.getHours()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function TelaInicio() {
  const { conta, comunidades, comunidadeAtiva } = useSessao()
  const pode = usePode()
  const nome = primeiroNome(conta?.nome)

  return (
    <TelaDoApp titulo={nome ? `${saudacao()}, ${nome}!` : `${saudacao()}!`}>
      {comunidades.length === 0 ? (
        <Cartao>
          <EstadoVazio
            icone="comunidade"
            titulo="Você ainda não participa de uma comunidade"
            descricao="Peça um convite a quem administra a sua comunidade. Quando você abrir o link, ela aparece aqui."
          />
        </Cartao>
      ) : !comunidadeAtiva ? (
        <Cartao>
          <EstadoVazio
            icone="trocar"
            titulo="Escolha uma comunidade"
            descricao="Você participa de mais de uma. Escolha em qual quer trabalhar agora; dá para trocar a qualquer momento pelo topo da tela."
            acao={{
              titulo: 'Escolher comunidade',
              aoPressionar: () => router.push('/trocar-comunidade'),
            }}
          />
        </Cartao>
      ) : (
        <>
          <Texto cor="textoSuave">Isto é o que está acontecendo em {comunidadeAtiva.nome}.</Texto>
          <Cartao titulo="Próximos eventos" icone="eventos">
            <EstadoVazio
              icone="eventos"
              titulo="Nenhum evento por enquanto"
              descricao="A agenda de eventos chega numa das próximas versões do app. Quando chegar, os próximos encontros aparecem aqui."
              {...(pode('convite', 'criar')
                ? {
                    acao: {
                      titulo: `Convidar pessoas para ${comunidadeAtiva.nome}`,
                      icone: 'convidar' as const,
                      aoPressionar: () => router.push('/convidar'),
                    },
                  }
                : {})}
            />
          </Cartao>
          <Cartao titulo="Suas escalas" icone="escalas">
            <EstadoVazio
              icone="escalas"
              titulo="Nenhuma escala para você"
              descricao="As escalas chegam numa das próximas versões. Você vai poder confirmar ou pedir substituição por aqui."
            />
          </Cartao>
          <Cartao titulo="Tarefas" icone="tarefas">
            <EstadoVazio
              icone="tarefas"
              titulo="Nenhuma tarefa pendente"
              descricao="As tarefas dos eventos chegam numa das próximas versões. O que for seu aparece aqui."
            />
          </Cartao>
        </>
      )}
    </TelaDoApp>
  )
}
