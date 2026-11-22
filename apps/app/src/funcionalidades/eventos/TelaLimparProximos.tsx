import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { ehErroDaApi } from '@/servicos/erros'
import type { ModoDeLimpeza, ResultadoDaLimpeza } from '@/servicos/contratoDaExclusao'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { voltarOu } from '@/ui/navegacao'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useEstaOnline } from '../offline/ProvedorOffline'
import {
  consequenciaDaLimpeza,
  detalheDosEncontros,
  encontrosAfetados,
  MOTIVO_PADRAO_DA_LIMPEZA,
  quantosEncontros,
  useLimparProximos,
  useResumoDosProximos,
} from './limparProximos'

const TITULO = 'Limpar próximos encontros'

/** O que cada modo faz, em palavras de quem nunca viu o sistema. "Apagar sem avisar" é o padrão (limpar testes). */
const OPCOES: readonly { valor: ModoDeLimpeza; rotulo: string; descricao: string }[] = [
  {
    valor: 'apagar',
    rotulo: 'Apagar sem avisar ninguém',
    descricao: 'Para limpar testes. Os encontros somem e ninguém recebe aviso.',
  },
  {
    valor: 'cancelar_e_avisar',
    rotulo: 'Cancelar e avisar as pessoas',
    descricao: 'Quem participa recebe o aviso de cancelamento.',
  },
]

function frasesDoResultado(r: ResultadoDaLimpeza): { titulo: string; texto: string } {
  if (r.modo === 'apagar') {
    return r.apagados === 0
      ? { titulo: 'Não havia nada para limpar', texto: 'A agenda já estava sem encontros futuros.' }
      : {
          titulo: `${quantosEncontros(r.apagados)} ${r.apagados === 1 ? 'apagado' : 'apagados'}`,
          texto: 'Ninguém foi avisado.',
        }
  }
  const partes = [
    r.apagados > 0
      ? `${quantosEncontros(r.apagados)} ${r.apagados === 1 ? 'apagado' : 'apagados'} (rascunhos)`
      : null,
    r.cancelados > 0
      ? `${quantosEncontros(r.cancelados)} ${r.cancelados === 1 ? 'cancelado' : 'cancelados'}`
      : null,
  ].filter((p): p is string => p !== null)
  return {
    titulo: partes.length ? 'Agenda limpa' : 'Não havia nada para limpar',
    texto: partes.length
      ? `${partes.join(' e ')}. ${
          r.pessoasAvisadas > 0
            ? `${r.pessoasAvisadas} ${r.pessoasAvisadas === 1 ? 'pessoa foi avisada' : 'pessoas foram avisadas'}.`
            : 'Ninguém precisou ser avisado.'
        }`
      : 'A agenda já estava sem encontros futuros.',
  }
}

/**
 * Rota `/limpar-proximos-encontros` (D77): tira de uma vez todos os encontros que ainda não
 * começaram, útil para limpar dados de teste. Em DOIS passos claros, sem digitar nada: (1) o
 * que há (quantos encontros e quantas pessoas seriam avisadas) e a escolha entre "Apagar sem
 * avisar ninguém" (o padrão, para testes) e "Cancelar e avisar as pessoas"; (2) a confirmação, com
 * o botão vermelho dizendo exatamente o que acontece. Apagar de verdade é irreversível e a tela
 * diz isso antes e depois. Os três estados do carregamento têm tela (carregando, erro e vazio).
 */
export function TelaLimparProximos() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const online = useEstaOnline()
  const permitido = pode('evento', 'limpar_proximos')
  const resumo = useResumoDosProximos(comunidadeAtiva?.id ?? null, permitido)
  const limpar = useLimparProximos(comunidadeAtiva?.id ?? '')
  const [modo, setModo] = useState<ModoDeLimpeza>('apagar')
  const [etapa, setEtapa] = useState<'escolher' | 'confirmar'>('escolher')
  const [motivo, setMotivo] = useState(MOTIVO_PADRAO_DA_LIMPEZA)
  const [erroDoMotivo, setErroDoMotivo] = useState<string | null>(null)
  const [feito, setFeito] = useState<ResultadoDaLimpeza | null>(null)
  const [agendaMudou, setAgendaMudou] = useState(false)

  if (feito) {
    const frases = frasesDoResultado(feito)
    return (
      <Tela pilha titulo={TITULO} descricao={comunidadeAtiva?.nome}>
        <Aviso tipo="sucesso" titulo={frases.titulo} anunciar>
          {frases.texto}
        </Aviso>
        <Botao
          titulo="Voltar para a Comunidade"
          tamanho="grande"
          aoPressionar={() => voltarOu('/comunidade')}
        />
      </Tela>
    )
  }
  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo={TITULO}>
        <SemComunidade oQue="a agenda" />
      </Tela>
    )
  }
  if (!permitido) {
    return (
      <Tela pilha titulo={TITULO} descricao={comunidadeAtiva.nome}>
        <EstadoVazio
          icone="seguranca"
          titulo="Só a organização limpa a agenda"
          descricao="Se há encontros que precisam sair da agenda, fale com quem organiza a comunidade."
          acao={{ titulo: 'Voltar para a Comunidade', aoPressionar: () => voltarOu('/comunidade') }}
        />
      </Tela>
    )
  }
  if (resumo.isPending) {
    return (
      <Tela pilha titulo={TITULO} descricao={comunidadeAtiva.nome}>
        <Esqueleto rotulo="Contando os encontros que ainda não começaram">
          <CartaoDeEsqueleto />
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Tela>
    )
  }
  if (resumo.error) {
    return (
      <Tela pilha titulo={TITULO} descricao={comunidadeAtiva.nome}>
        <ErroDaTela erro={resumo.error} aoTentarDeNovo={() => void resumo.refetch()} />
      </Tela>
    )
  }
  const r = resumo.data
  if (r.total === 0) {
    return (
      <Tela pilha titulo={TITULO} descricao={comunidadeAtiva.nome}>
        <EstadoVazio
          icone="calendario"
          titulo="Não há encontros para limpar"
          descricao="Todos os encontros desta comunidade já começaram ou já passaram. Aqui só entram os que ainda vão acontecer."
          acao={{ titulo: 'Voltar para a Comunidade', aoPressionar: () => voltarOu('/comunidade') }}
        />
      </Tela>
    )
  }

  const afetados = encontrosAfetados(r, modo)
  const motivoLimpo = motivo.trim()

  function continuar() {
    if (modo === 'cancelar_e_avisar' && motivoLimpo.length < 3) {
      setErroDoMotivo('Escreva o motivo: ele vai para quem recebe o aviso.')
      return
    }
    setErroDoMotivo(null)
    setAgendaMudou(false)
    limpar.reset()
    setEtapa('confirmar')
  }

  function confirmar() {
    limpar.mutate(
      {
        modo,
        totalEsperado: r.total,
        ...(modo === 'cancelar_e_avisar' ? { motivo: motivoLimpo } : {}),
      },
      {
        onSuccess: (resultado) => {
          mostrarToast({ texto: 'Agenda limpa.' })
          setFeito(resultado)
        },
        onError: (erro) => {
          // Alguém mexeu na agenda enquanto a pessoa decidia: os números mudaram, e confirmar
          // outros números que ela não viu seria o erro. Volta ao primeiro passo com os novos.
          if (ehErroDaApi(erro, 'agenda_mudou')) {
            setAgendaMudou(true)
            setEtapa('escolher')
            void resumo.refetch()
          }
        },
      },
    )
  }

  if (etapa === 'confirmar') {
    const apagando = modo === 'apagar'
    return (
      <Tela
        pilha
        titulo="Confirme a limpeza"
        descricao={comunidadeAtiva.nome}
        barraDeAcao={
          <BarraDeAcao solta>
            <Botao
              titulo="Mudar a escolha"
              variante="secundario"
              tamanho="grande"
              desabilitado={limpar.isPending}
              aoPressionar={() => setEtapa('escolher')}
            />
            <Botao
              titulo={
                apagando
                  ? `Apagar ${quantosEncontros(afetados)} para sempre`
                  : `Cancelar e avisar até ${r.pessoasAAvisar} ${r.pessoasAAvisar === 1 ? 'pessoa' : 'pessoas'}`
              }
              variante="destrutivoCheio"
              tamanho="grande"
              carregando={limpar.isPending}
              desabilitado={!online}
              {...(online ? {} : { motivo: 'Precisa de internet para limpar a agenda.' })}
              aoPressionar={confirmar}
            />
          </BarraDeAcao>
        }
      >
        <Aviso tipo="erro" titulo="Isto não se desfaz" anunciar>
          {consequenciaDaLimpeza(r, modo)}
        </Aviso>
        <CartaoDeVidro opaco intervalo={ESPACO.e8} sobrancelha="O que vai acontecer">
          <Texto variante="tituloItem">
            {apagando
              ? `Apagar ${quantosEncontros(afetados)}, sem avisar ninguém`
              : `Cancelar e avisar as pessoas (${quantosEncontros(afetados)})`}
          </Texto>
          <Texto variante="corpo" cor="textoSuave">
            {detalheDosEncontros(r)}.
          </Texto>
          {apagando ? null : (
            <Texto variante="corpo" cor="textoSuave">
              {`Motivo do aviso: ${motivoLimpo}`}
            </Texto>
          )}
        </CartaoDeVidro>
        {limpar.error && !ehErroDaApi(limpar.error, 'agenda_mudou') ? (
          <AvisoDeFalha erro={limpar.error} titulo="A agenda não foi limpa" />
        ) : null}
      </Tela>
    )
  }

  return (
    <Tela
      pilha
      titulo={TITULO}
      descricao={comunidadeAtiva.nome}
      barraDeAcao={
        <BarraDeAcao solta>
          <Botao
            titulo="Cancelar"
            variante="secundario"
            tamanho="grande"
            aoPressionar={() => voltarOu('/comunidade')}
          />
          <Botao titulo="Continuar" tamanho="grande" aoPressionar={continuar} />
        </BarraDeAcao>
      }
    >
      {agendaMudou ? (
        <Aviso tipo="alerta" titulo="A agenda mudou enquanto você decidia" anunciar>
          Os números abaixo são os de agora. Confira e confirme de novo.
        </Aviso>
      ) : null}
      <CartaoDeVidro opaco intervalo={ESPACO.e8} sobrancelha="O que ainda não começou">
        <Texto variante="tituloItem">{`${quantosEncontros(r.total)} na agenda`}</Texto>
        <Texto variante="corpo" cor="textoSuave">
          {`${detalheDosEncontros(r)}.`}
        </Texto>
        <Texto variante="corpo" cor="textoSuave">
          {r.pessoasAAvisar > 0
            ? `Se você cancelar e avisar, até ${r.pessoasAAvisar} ${r.pessoasAAvisar === 1 ? 'pessoa recebe' : 'pessoas recebem'} o aviso.`
            : 'Nenhuma pessoa precisaria ser avisada.'}
        </Texto>
      </CartaoDeVidro>
      <ListaDeOpcoes rotulo="O que fazer" valor={modo} aoMudar={setModo} opcoes={OPCOES} />
      <Aviso tipo="alerta" titulo="Isto não se desfaz">
        {consequenciaDaLimpeza(r, modo)}
      </Aviso>
      {modo === 'cancelar_e_avisar' ? (
        <CartaoDeVidro opaco intervalo={ESPACO.e16}>
          <Campo
            rotulo="Motivo do aviso"
            value={motivo}
            onChangeText={setMotivo}
            erro={erroDoMotivo}
            ajuda="Escreva como você diria para quem vinha."
            multiline
            maxLength={500}
          />
        </CartaoDeVidro>
      ) : null}
      {r.repeticoesAtivas > 0 ? (
        <View>
          <Aviso tipo="info" titulo="Há encontros que se repetem">
            {`${r.repeticoesAtivas} ${r.repeticoesAtivas === 1 ? 'repetição continua ativa e vai' : 'repetições continuam ativas e vão'} criar encontros novos mais para a frente. Para parar, abra o encontro que se repete e encerre a repetição.`}
          </Aviso>
        </View>
      ) : null}
    </Tela>
  )
}
