import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'

import type { ComunidadeEncontrada } from '@/servicos/contrato'
import { Botao } from '@/ui/Botao'
import { Campo, CampoDeBusca } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { ErroDaTela } from '@/ui/Falha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { logoDaEncontrada, MINIMO_DA_BUSCA, useBuscaDeComunidades } from './consultas'
import { VazioComSol } from './VazioComSol'

/** Selo "Verificada": ícone e texto, nunca só a cor. */
export function SeloVerificada() {
  return <Chip texto="Verificada" tom="sucesso" icone="confirmado" />
}

/**
 * "Procurar minha comunidade" (ADR 0007): nome (mínimo de 3 letras) e cidade
 * opcional; a busca roda quando a pessoa toca em "Procurar" ou no teclado.
 * Só aparecem comunidades que escolheram aparecer na busca. Resultado: logo,
 * nome, cidade e o selo "Verificada"; tocar abre a comunidade.
 */
export function TelaProcurarComunidade() {
  const [nome, setNome] = useState('')
  const [cidade, setCidade] = useState('')
  const [pedida, setPedida] = useState<{ q: string; cidade: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const busca = useBuscaDeComunidades(pedida?.q ?? '', pedida?.cidade ?? '')

  function procurar() {
    const q = nome.trim()
    if (q.length < MINIMO_DA_BUSCA) {
      setErro(`Digite pelo menos ${MINIMO_DA_BUSCA} letras do nome.`)
      return
    }
    setErro(null)
    setPedida({ q, cidade: cidade.trim() })
  }

  return (
    <Tela
      pilha
      titulo="Procurar comunidade"
      descricao="Busque pelo nome da igreja ou do grupo. A cidade ajuda quando há nomes parecidos."
    >
      <CartaoDeVidro opaco intervalo={ESPACO.e16}>
        <CampoDeBusca
          rotulo="Nome da comunidade"
          rotuloVisivel
          valor={nome}
          aoMudar={(v) => {
            setNome(v)
            if (erro) setErro(null)
          }}
          erro={erro}
          autoCapitalize="words"
          onSubmitEditing={procurar}
        />
        <Campo
          rotulo="Cidade"
          opcional
          exemplo="Campinas"
          value={cidade}
          onChangeText={setCidade}
          autoCapitalize="words"
          returnKeyType="search"
          onSubmitEditing={procurar}
        />
        <Botao
          titulo="Procurar"
          icone="buscar"
          larguraTotal
          carregando={busca.isFetching}
          aoPressionar={procurar}
        />
      </CartaoDeVidro>
      <Resultados
        pedida={pedida !== null}
        busca={busca}
        aoTentarDeNovo={() => void busca.refetch()}
      />
    </Tela>
  )
}

function Resultados({
  pedida,
  busca,
  aoTentarDeNovo,
}: {
  pedida: boolean
  busca: ReturnType<typeof useBuscaDeComunidades>
  aoTentarDeNovo: () => void
}) {
  if (!pedida) {
    return (
      <Texto variante="corpo" cor="textoSuave">
        Só aparecem as comunidades que escolheram aparecer na busca. Se a sua não aparecer, peça o
        código para alguém da liderança.
      </Texto>
    )
  }
  if (busca.isPending) {
    return (
      <Esqueleto rotulo="Procurando comunidades">
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (busca.error) {
    return (
      <ErroDaTela
        erro={busca.error}
        titulo="A busca não funcionou"
        aoTentarDeNovo={aoTentarDeNovo}
      />
    )
  }
  if (busca.data.length === 0) {
    return (
      <VazioComSol
        anunciar
        titulo="Nenhuma comunidade com esse nome"
        descricao="Confira a grafia ou tire a cidade. Algumas comunidades preferem não aparecer na busca: peça o código para a liderança."
        acao={{
          titulo: 'Tenho um código',
          variante: 'secundario',
          aoPressionar: () => router.replace('/tenho-um-codigo'),
        }}
      />
    )
  }
  return (
    <CartaoDeVidro
      sobrancelha={busca.data.length === 1 ? '1 encontrada' : `${busca.data.length} encontradas`}
      lista
    >
      <Lista>{busca.data.map(linha)}</Lista>
    </CartaoDeVidro>
  )
}

function linha(c: ComunidadeEncontrada) {
  const logo = logoDaEncontrada(c)
  return (
    <LinhaDeLista
      key={c.idPublico}
      avatar={{ nome: c.nome, cor: c.cor, dados: { foto: logo } }}
      titulo={c.nome}
      {...(c.cidade ? { descricao: c.cidade } : {})}
      {...(c.verificada ? { extra: <SeloVerificada /> } : {})}
      rotuloAcessivel={`${c.nome}${c.cidade ? `, ${c.cidade}` : ''}${c.verificada ? ', verificada' : ''}. Abrir`}
      aoPressionar={() =>
        router.push({
          pathname: '/comunidade-encontrada/[idPublico]',
          params: { idPublico: c.idPublico },
        })
      }
    />
  )
}
