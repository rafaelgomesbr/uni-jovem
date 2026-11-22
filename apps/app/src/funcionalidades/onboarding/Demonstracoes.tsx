import type { VisibilidadeDeOracao } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { Botao } from '@/ui/Botao'
import { BotoesDeOrdem } from '@/ui/BotoesDeOrdem'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Chip } from '@/ui/Chip'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'

import { explicarVisibilidade, NOME_DA_VISIBILIDADE } from '../oracao/visibilidade'
import type { Demonstracao } from './missao'

/**
 * Demonstrações com dados de exemplo, só no estado desta tela. Nenhuma delas
 * recebe o cliente da API: não há como gravar dado real daqui.
 */
export function DemonstracaoDaEtapa({ demo }: { demo: Demonstracao }) {
  switch (demo) {
    case 'evento':
      return <DemoEvento />
    case 'escala':
      return <DemoEscala />
    case 'oracao':
      return <DemoOracao />
    case 'aoVivo':
      return <DemoAoVivo />
    case 'checkin':
      return <DemoCheckin />
    case 'aviso':
      return <DemoAviso />
    case 'convite':
      return <DemoConvite />
    case null:
      return null
  }
}

/** Conteúdo da demonstração; o chip "Exemplo" fica no cartão de destaque em volta. */
function Exemplo({ children }: { children: ReactNode }) {
  return <View style={{ gap: ESPACO.e12 }}>{children}</View>
}

function DemoEvento() {
  const [etapas, setEtapas] = useState(['Boas-vindas', 'Louvor', 'Estudo da lição', 'Encerramento'])
  const mover = (i: number, d: -1 | 1) =>
    setEtapas((lista) => {
      const nova = [...lista]
      const [item] = nova.splice(i, 1)
      nova.splice(i + d, 0, item!)
      return nova
    })
  return (
    <Exemplo>
      <Texto variante="tituloItem">Sábado de exemplo, às 16:00</Texto>
      {etapas.map((e, i) => (
        <View key={e} style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
          <Texto style={{ flex: 1 }}>
            {i + 1}. {e}
          </Texto>
          <BotoesDeOrdem
            nome={e}
            posicao={i}
            total={etapas.length}
            aoSubir={() => mover(i, -1)}
            aoDescer={() => mover(i, 1)}
          />
        </View>
      ))}
    </Exemplo>
  )
}

function DemoEscala() {
  const [resposta, setResposta] = useState<'pendente' | 'confirmada' | 'recusada'>('pendente')
  return (
    <Exemplo>
      <Texto>Louvor · integrante · Sábado de exemplo</Texto>
      <TextoAnunciado soMudancas variante="corpo">
        {resposta === 'pendente'
          ? 'Aguardando a sua resposta.'
          : resposta === 'confirmada'
            ? 'Você aceitou. Na vida real, a organização vê na hora.'
            : 'Você avisou que não pode ir. Na vida real, a organização recebe o aviso para chamar outra pessoa.'}
      </TextoAnunciado>
      <Botao
        titulo="Aceitar a convocação de exemplo"
        variante="secundario"
        aoPressionar={() => setResposta('confirmada')}
      />
      <Botao
        titulo="Não posso ir (exemplo)"
        variante="terciario"
        aoPressionar={() => setResposta('recusada')}
      />
    </Exemplo>
  )
}

function DemoOracao() {
  const [v, setV] = useState<VisibilidadeDeOracao>('somente_eu')
  const contagem = { equipe: 3, comunidade: 24 }
  return (
    <Exemplo>
      <ListaDeOpcoes
        rotulo="Quem vê o pedido de exemplo"
        valor={v}
        aoMudar={setV}
        opcoes={(Object.keys(NOME_DA_VISIBILIDADE) as VisibilidadeDeOracao[]).map((valor) => ({
          valor,
          rotulo: NOME_DA_VISIBILIDADE[valor],
        }))}
      />
      <TextoAnunciado soMudancas variante="corpo">
        {explicarVisibilidade(v, 'comunidade de exemplo', contagem)}
      </TextoAnunciado>
    </Exemplo>
  )
}

function DemoAoVivo() {
  const etapas = ['Boas-vindas', 'Louvor', 'Estudo da lição', 'Encerramento']
  const [atual, setAtual] = useState(0)
  return (
    <Exemplo>
      <Texto variante="sobrancelha" accessibilityRole="text">
        Agora
      </Texto>
      <TextoAnunciado soMudancas variante="tituloCartao">
        {etapas[atual]}
      </TextoAnunciado>
      <Texto variante="corpo">
        Etapa {atual + 1} de {etapas.length}
        {atual + 1 < etapas.length ? `. Depois: ${etapas[atual + 1]}` : '. É a última.'}
      </Texto>
      <Botao
        titulo="Avançar etapa (exemplo)"
        icone="proximaEtapa"
        variante="secundario"
        desabilitado={atual + 1 >= etapas.length}
        motivo="Esta já é a última etapa do exemplo."
        aoPressionar={() => setAtual((a) => Math.min(a + 1, etapas.length - 1))}
      />
    </Exemplo>
  )
}

function DemoCheckin() {
  const [presentes, setPresentes] = useState<string[]>([])
  const nomes = ['Pessoa de exemplo 1', 'Pessoa de exemplo 2', 'Pessoa de exemplo 3']
  return (
    <Exemplo>
      {nomes.map((n) => (
        <CaixaDeMarcar
          key={n}
          rotulo={`Chegou: ${n}`}
          marcada={presentes.includes(n)}
          aoMudar={(sim) => setPresentes((p) => (sim ? [...p, n] : p.filter((x) => x !== n)))}
        />
      ))}
      <Texto variante="corpo" tabular>
        {presentes.length} de {nomes.length} presentes
      </Texto>
    </Exemplo>
  )
}

function DemoAviso() {
  const [fixado, setFixado] = useState(false)
  return (
    <Exemplo>
      <Texto variante="tituloItem">Aviso de exemplo: ensaio na sexta</Texto>
      {fixado ? <Chip texto="Fixado" tom="quente" icone="fixar" /> : null}
      <Texto variante="corpo">Quem toca, chegue às 19:00. Traga a cifra impressa.</Texto>
      <Botao
        titulo={fixado ? 'Desafixar o aviso de exemplo' : 'Fixar o aviso de exemplo'}
        icone="fixar"
        variante="secundario"
        aoPressionar={() => setFixado((f) => !f)}
      />
    </Exemplo>
  )
}

function DemoConvite() {
  const [papel, setPapel] = useState<'membro' | 'organizador' | 'admin'>('membro')
  return (
    <Exemplo>
      <ListaDeOpcoes
        rotulo="Papel do convite de exemplo"
        valor={papel}
        aoMudar={setPapel}
        opcoes={[
          { valor: 'membro', rotulo: 'Membro' },
          { valor: 'organizador', rotulo: 'Organizador' },
          { valor: 'admin', rotulo: 'Administrador' },
        ]}
      />
      <Texto variante="corpo">
        Na vida real, o app gera um link de uso único para a pessoa entrar como{' '}
        {papel === 'admin' ? 'administrador' : papel}. Aqui nenhum link é criado.
      </Texto>
    </Exemplo>
  )
}
