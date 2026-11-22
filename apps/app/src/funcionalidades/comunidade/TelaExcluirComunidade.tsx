import { DIAS_DE_CARENCIA_DA_EXCLUSAO_DA_COMUNIDADE } from '@uj/dominio'
import { ALTURA, ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ResultadoDoPedidoDeExclusao } from '@/servicos/contratoDaExclusao'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha } from '@/ui/Falha'
import { Icone } from '@/ui/Icone'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { mostrarToast } from '@/ui/Toast'
import { voltarOu } from '@/ui/navegacao'

import { SemComunidade } from '../navegacao/SemComunidade'
import { useEstaOnline } from '../offline/ProvedorOffline'
import { useDesfazerExclusao, useDetalheDaComunidade, useExcluirComunidade } from './consultas'
import { dataDoApagamento } from './dataDoApagamento'
import { usePode } from './permissoes'

const TITULO = 'Excluir esta comunidade?'

/** O que some, em palavras de quem nunca viu o sistema (a política de privacidade diz o mesmo). */
function oQueSome(pessoas: number | null): readonly string[] {
  return [
    'Todos os encontros, com convocações, repertório, inscrições e presenças.',
    pessoas !== null
      ? `O vínculo de ${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'} com a comunidade.`
      : 'O vínculo de todas as pessoas com a comunidade.',
    'Avisos, pedidos de oração e sugestões.',
    'Músicas, cifras e PDFs da Biblioteca.',
    'O logotipo e os arquivos da comunidade.',
  ]
}

/**
 * Rota `/excluir-comunidade` (D77, ADR 0009): a administração exclui a PRÓPRIA comunidade, em dois
 * passos claros, sem digitar nada (o nome vem escrito na tela): (1) o que some, o que NÃO some (as
 * contas das pessoas) e a carência de 30 dias; (2) a confirmação, com o nome da comunidade e o botão
 * vermelho "Excluir para sempre". Não apaga na hora: a comunidade fica "em exclusão" por 30 dias
 * (some das listas, ninguém a usa) e só a administração desfaz, aqui mesmo ou em Perfil, Comunidades.
 * Depois dos 30 dias a rotina de retenção apaga de vez.
 */
export function TelaExcluirComunidade() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const online = useEstaOnline()
  const detalhe = useDetalheDaComunidade(comunidadeAtiva?.id ?? null)
  const excluir = useExcluirComunidade(comunidadeAtiva?.id ?? '')
  const [etapa, setEtapa] = useState<'entender' | 'confirmar'>('entender')
  // Guardado: depois do pedido a comunidade sai da sessão e a tela precisa continuar a mostrar o resultado.
  const [feito, setFeito] = useState<{
    id: string
    nome: string
    resultado: ResultadoDoPedidoDeExclusao
  } | null>(null)

  if (feito) return <Resultado feito={feito} />
  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo={TITULO}>
        <SemComunidade oQue="a comunidade" />
      </Tela>
    )
  }
  if (!pode('comunidade', 'excluir')) {
    return (
      <Tela pilha titulo={TITULO} descricao={comunidadeAtiva.nome}>
        <EstadoVazio
          icone="seguranca"
          titulo="Só a administração exclui a comunidade"
          descricao="Se esta comunidade precisa acabar, fale com uma pessoa administradora."
          acao={{ titulo: 'Voltar', aoPressionar: () => voltarOu('/comunidade') }}
        />
      </Tela>
    )
  }
  if (comunidadeAtiva.estado !== 'ativa') {
    return (
      <Tela pilha titulo={TITULO} descricao={comunidadeAtiva.nome}>
        <Aviso tipo="info" titulo="Esta comunidade não está ativa">
          Só uma comunidade ativa pode ser excluída por aqui.
        </Aviso>
      </Tela>
    )
  }

  const pessoas = detalhe.data?.uso?.membrosAtivos ?? null
  const nome = comunidadeAtiva.nome
  const semInternet = online ? {} : { motivo: 'Precisa de internet para excluir a comunidade.' }

  function pedir() {
    excluir.mutate(nome, {
      onSuccess: (resultado) => {
        mostrarToast({ texto: 'A comunidade foi marcada para exclusão.' })
        setFeito({ id: comunidadeAtiva!.id, nome, resultado })
      },
    })
  }

  if (etapa === 'confirmar') {
    return (
      <Tela
        pilha
        titulo="Confirme a exclusão"
        descricao={nome}
        barraDeAcao={
          <BarraDeAcao>
            <Botao
              titulo="Não excluir"
              variante="secundario"
              tamanho="grande"
              desabilitado={excluir.isPending}
              aoPressionar={() => voltarOu('/configurar-comunidade')}
            />
            <Botao
              titulo="Excluir para sempre"
              variante="destrutivoCheio"
              tamanho="grande"
              carregando={excluir.isPending}
              desabilitado={!online}
              {...semInternet}
              aoPressionar={pedir}
            />
          </BarraDeAcao>
        }
      >
        <Aviso tipo="erro" titulo="Você vai excluir esta comunidade" anunciar>
          {`Depois de ${DIAS_DE_CARENCIA_DA_EXCLUSAO_DA_COMUNIDADE} dias ela é apagada de vez e não volta.`}
        </Aviso>
        <CartaoDeVidro opaco intervalo={ESPACO.e8} sobrancelha="Comunidade que será excluída">
          <Texto variante="tituloCartao">{nome}</Texto>
          <Texto variante="corpo" cor="textoSuave">
            {pessoas !== null
              ? `${pessoas} ${pessoas === 1 ? 'pessoa participa' : 'pessoas participam'} dela. Todas recebem um aviso e perdem o acesso agora.`
              : 'Todas as pessoas recebem um aviso e perdem o acesso agora.'}
          </Texto>
        </CartaoDeVidro>
        {excluir.error ? (
          <AvisoDeFalha erro={excluir.error} titulo="A comunidade não foi excluída" />
        ) : null}
      </Tela>
    )
  }

  return (
    <Tela
      pilha
      titulo={TITULO}
      descricao={nome}
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Cancelar"
            variante="secundario"
            tamanho="grande"
            aoPressionar={() => voltarOu('/configurar-comunidade')}
          />
          <Botao titulo="Continuar" tamanho="grande" aoPressionar={() => setEtapa('confirmar')} />
        </BarraDeAcao>
      }
    >
      <Secao titulo="O que some">
        <CartaoDeVidro opaco>
          {oQueSome(pessoas).map((t) => (
            <Linha key={t} texto={t} tom="erro" />
          ))}
        </CartaoDeVidro>
      </Secao>
      <Secao titulo="O que continua">
        <CartaoDeVidro opaco>
          <Linha
            texto="As contas das pessoas não são apagadas: só o vínculo com esta comunidade. Cada pessoa continua podendo usar as outras comunidades."
            tom="sucesso"
          />
        </CartaoDeVidro>
      </Secao>
      <Secao titulo="Quanto tempo leva">
        <CartaoDeVidro opaco intervalo={ESPACO.e8}>
          <Texto variante="corpo">
            {`Por ${DIAS_DE_CARENCIA_DA_EXCLUSAO_DA_COMUNIDADE} dias a comunidade fica "em exclusão": some das listas e ninguém consegue usá-la. Neste prazo só a administração pode desfazer, em Perfil, Comunidades. Depois, ela é apagada de vez e não volta.`}
          </Texto>
          <Texto variante="corpo">
            As outras pessoas recebem um aviso de que a comunidade foi marcada para exclusão.
          </Texto>
        </CartaoDeVidro>
      </Secao>
    </Tela>
  )
}

/** Depois do pedido: quando será apagada e o "Desfazer a exclusão" ali mesmo, à mão. */
function Resultado({
  feito,
}: {
  feito: { id: string; nome: string; resultado: ResultadoDoPedidoDeExclusao }
}) {
  const online = useEstaOnline()
  const desfazer = useDesfazerExclusao()
  const quando = dataDoApagamento(feito.resultado.apagadaEm)
  return (
    <Tela pilha semVoltar titulo="Comunidade em exclusão" descricao={feito.nome}>
      <Aviso tipo="sucesso" titulo={`Será apagada em ${quando}`} anunciar>
        {`${feito.nome} já não aparece para ninguém. Até ${quando} você pode desfazer. Depois dessa data ela é apagada de vez.`}
      </Aviso>
      {desfazer.error ? (
        <AvisoDeFalha erro={desfazer.error} titulo="A exclusão não foi desfeita" />
      ) : null}
      <Botao
        titulo="Desfazer a exclusão"
        variante="secundario"
        tamanho="grande"
        carregando={desfazer.isPending}
        desabilitado={!online}
        {...(online ? {} : { motivo: 'Precisa de internet para desfazer.' })}
        aoPressionar={() =>
          desfazer.mutate(feito.id, {
            onSuccess: () => {
              mostrarToast({ texto: `${feito.nome} voltou ao normal.` })
              router.replace('/')
            },
          })
        }
      />
      <Botao titulo="Ir para o Início" tamanho="grande" aoPressionar={() => router.replace('/')} />
    </Tela>
  )
}

/** Uma linha com o ladrilho de 32 (forma e ícone, nunca só cor) e o texto em `corpo`. */
function Linha({ texto, tom }: { texto: string; tom: 'erro' | 'sucesso' }) {
  const { cores, solido } = useTema()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e12 }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: ALTURA.ladrilho,
          height: ALTURA.ladrilho,
          borderRadius: RAIO.celula,
          backgroundColor: solido(tom === 'erro' ? cores.erroFundo : cores.sucessoFundo),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icone
          nome={tom === 'erro' ? 'cancelar' : 'confirmado'}
          cor={tom === 'erro' ? cores.erro : cores.sucesso}
          tamanho={18}
        />
      </View>
      <Texto variante="corpo" style={{ flex: 1 }}>
        {texto}
      </Texto>
    </View>
  )
}
