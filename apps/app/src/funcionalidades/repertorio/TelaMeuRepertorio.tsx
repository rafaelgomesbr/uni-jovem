import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { Aviso } from '@/ui/Aviso'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Chip } from '@/ui/Chip'
import { EntradaEmCascata } from '@/ui/primitivasDeMovimento'
import { Esqueleto, LinhaDeEsqueleto } from '@/ui/Esqueleto'
import { ErroDaTela } from '@/ui/Falha'
import { LARGURA_DA_HORA, LinhaDeLista, Lista, RECUO_DA_LISTA } from '@/ui/LinhaDeLista'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { formatarQuando } from '@/utilidades/datas'
import { momentoDoEncontro } from '@/utilidades/momentoDoEncontro'

import { estadoEfetivo, useRespostasOtimistas } from '../escalas/respostasOtimistas'
import { useResponderComDesfazer } from '../escalas/consultas'
import { useInicio } from '../inicio/consultas'
import { VazioComSol } from '../inscricoes/VazioComSol'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useEstaOnline } from '../offline/ProvedorOffline'
import { RepertorioDoEncontroPorId } from './TelaRepertorioDoEncontro'
import { descricaoDaMusica, textoDaParte } from './rotulosDoRepertorio'
import { UsoSemInternet } from './UsoSemInternet'
import {
  useEncontrosParaTocar,
  type EncontroParaTocar,
  type MusicaParaTocar,
} from './useEncontrosParaTocar'

/** O tom em que a pessoa toca: o tom do dia, ou o original quando ninguém definiu outro. */
export function tomDoItem(item: Pick<MusicaParaTocar, 'tomDoDia' | 'tomOriginal'>): string | null {
  return item.tomDoDia ?? item.tomOriginal
}

const caminhoDaCifra = '/meu-repertorio/[eventoId]/[itemId]' as const

/** Abre a música na leitura ou, com `palco`, direto no Modo palco. */
function abrirMusica(eventoId: string, itemId: string, palco = false) {
  router.push({
    pathname: caminhoDaCifra,
    params: { eventoId, itemId, ...(palco ? { palco: '1' } : {}) },
  })
}

/**
 * Rota `/meu-repertorio` (D61, visual A em D71): a tela do músico. Só o que a pessoa toca nos
 * próximos encontros, no tom do dia, com a cifra a um toque e o Modo palco a outro. Com a cópia
 * guardada no aparelho, abre e funciona sem internet. Nada de menu do resto do app no caminho.
 *
 * Quem não toca (D73) não esbarra em "você não está no louvor": o repertório é de toda a
 * comunidade, e a rota abre o "Repertório do encontro" do próximo encontro, em leitura.
 */
export function TelaMeuRepertorio() {
  const { comunidadeAtiva } = useSessao()
  const situacao = useEncontrosParaTocar(comunidadeAtiva?.id ?? null)

  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo="Meu repertório">
        <SemComunidade oQue="o seu repertório" />
      </Tela>
    )
  }

  // Quem não toca: o repertório do próximo encontro, só para ler (a lista, o tom do dia e a banda).
  if (situacao.tipo === 'pronto' && situacao.encontros.length === 0) {
    return <RepertorioDoProximoEncontro comunidadeId={comunidadeAtiva.id} />
  }

  const primeiro = situacao.tipo === 'pronto' ? situacao.encontros[0] : undefined
  const momento = primeiro
    ? momentoDoEncontro(primeiro.evento.inicio, primeiro.evento.fuso)
    : 'longe'

  return (
    <Tela
      pilha
      titulo="Meu repertório"
      descricao="As músicas que você toca, no tom do dia."
      momento={momento}
    >
      {situacao.tipo === 'carregando' ? (
        <Esqueleto rotulo="Carregando o seu repertório">
          <LinhaDeEsqueleto altura={72} />
          <LinhaDeEsqueleto altura={72} />
          <LinhaDeEsqueleto altura={72} />
          <LinhaDeEsqueleto altura={72} />
        </Esqueleto>
      ) : situacao.tipo === 'erro' ? (
        <ErroDaTela
          erro={situacao.erro}
          titulo="Não deu para carregar o repertório."
          aoTentarDeNovo={situacao.tentarDeNovo}
        />
      ) : situacao.tipo === 'sem_copia' ? (
        <VazioComSol
          titulo="Este repertório ainda não está no seu aparelho."
          descricao="Conecte-se à internet para ver as músicas e baixar as cifras."
          acao={{ titulo: 'Tentar de novo', aoPressionar: situacao.tentarDeNovo }}
        />
      ) : situacao.encontros.length === 0 ? null : (
        <>
          {situacao.origem === 'aparelho' ? (
            <Aviso tipo="info" titulo="Sem internet">
              Mostrando o que está guardado neste aparelho. A cifra e o Modo palco abrem
              normalmente.
            </Aviso>
          ) : null}
          {situacao.encontros.map((e, i) => (
            <EntradaEmCascata key={e.evento.id} ordem={Math.min(i + 1, 4)}>
              <Encontro
                encontro={e}
                comunidadeId={comunidadeAtiva.id}
                primeiro={i === 0}
                dadosDaRede={situacao.origem === 'rede'}
              />
            </EntradaEmCascata>
          ))}
        </>
      )}
    </Tela>
  )
}

/** O próximo encontro da comunidade, para quem não toca: o do cartão do Início, ou o primeiro da lista. */
function RepertorioDoProximoEncontro({ comunidadeId }: { comunidadeId: string }) {
  const inicio = useInicio(comunidadeId)
  const proximo = inicio.data?.momento?.evento?.id ?? inicio.data?.proximosEventos[0]?.id ?? null

  if (inicio.isPending) {
    return (
      <Tela pilha titulo="Repertório">
        <Esqueleto rotulo="Carregando o repertório">
          <LinhaDeEsqueleto altura={72} />
          <LinhaDeEsqueleto altura={72} />
          <LinhaDeEsqueleto altura={72} />
        </Esqueleto>
      </Tela>
    )
  }
  if (inicio.error && !inicio.data) {
    return (
      <Tela pilha titulo="Repertório">
        <ErroDaTela
          erro={inicio.error}
          titulo="Não deu para carregar o repertório."
          aoTentarDeNovo={() => void inicio.refetch()}
        />
      </Tela>
    )
  }
  if (!proximo) {
    return (
      <Tela pilha titulo="Repertório">
        <VazioComSol
          titulo="Ainda não há encontro marcado."
          descricao="Quando a liderança marcar o próximo, o repertório dele aparece aqui."
        />
      </Tela>
    )
  }
  return <RepertorioDoEncontroPorId eventoId={proximo} />
}

function Encontro({
  encontro,
  comunidadeId,
  primeiro,
  dadosDaRede,
}: {
  encontro: EncontroParaTocar
  comunidadeId: string
  primeiro: boolean
  dadosDaRede: boolean
}) {
  const responder = useResponderComDesfazer(comunidadeId)
  const otimistas = useRespostasOtimistas()
  const online = useEstaOnline()
  const { evento, itens } = encontro

  // A resposta em espera (os 10 s do Desfazer) vale mais que a do servidor.
  const partes = encontro.partes.map((p) => ({
    ...p,
    estado: p.atribuicaoId ? estadoEfetivo(p.atribuicaoId, p.estado, otimistas) : p.estado,
  }))
  const pendente = dadosDaRede
    ? partes.find((p) => p.estado === 'pendente' && p.atribuicaoId)
    : null
  const recusada = partes.length > 0 && partes.every((p) => p.estado === 'recusada')
  const funcoes = partes.filter((p) => p.estado !== 'recusada').map((p) => p.funcao)
  const quando = formatarQuando(evento.inicio, evento.fuso)

  const parte = pendente
    ? {
        atribuicaoId: pendente.atribuicaoId!,
        eventoInicio: evento.inicio,
        fuso: evento.fuso,
        funcao: pendente.funcao,
        etapaTitulo: null,
      }
    : null

  const chips = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
      <Chip
        tom="quente"
        texto={textoDaParte(funcoes.length ? funcoes : partes.map((p) => p.funcao))}
      />
      {pendente ? (
        <Chip situacao="aguardando" texto="Aguardando sua resposta" />
      ) : recusada ? (
        <Chip tom="neutro" texto="Você avisou que não pode" />
      ) : partes.some((p) => p.estado === 'confirmada') ? (
        <Chip situacao="aceitou" texto="Aceitou" />
      ) : null}
      {encontro.baixado ? <Chip situacao="aceitou" texto="Baixado para usar sem internet" /> : null}
    </View>
  )

  const respostas = parte ? (
    <ParDeBotoes larguraMinima={150}>
      <Botao
        titulo="Não posso ir"
        variante="secundario"
        rotuloAcessivel={`Não posso ir: avisar a organização sobre ${evento.titulo}`}
        desabilitado={!online}
        motivo="Precisa de internet para responder."
        aoPressionar={() => responder.recusar(parte)}
      />
      <Botao
        titulo="Aceitar"
        rotuloAcessivel={`Aceitar a convocação em ${evento.titulo}, ${parte.funcao}`}
        desabilitado={!online}
        motivo="Precisa de internet para responder."
        aoPressionar={() => responder.aceitar(parte)}
      />
    </ParDeBotoes>
  ) : itens.length > 0 && !recusada ? (
    <Botao
      titulo="Modo palco"
      icone="musica"
      tamanho="grande"
      larguraTotal
      rotuloAcessivel={`Abrir o Modo palco com ${itens[0]!.titulo}`}
      aoPressionar={() => abrirMusica(evento.id, itens[0]!.id, true)}
    />
  ) : null

  const lista =
    itens.length === 0 ? (
      <Texto variante="corpo" cor="textoSuave">
        O repertório ainda não foi montado. Assim que a liderança montar, você recebe um aviso.
      </Texto>
    ) : (
      <Cartao lista>
        <Lista recuo={RECUO_DA_LISTA.hora}>
          {itens.map((item, i) => {
            const descricao = descricaoDaMusica({ ...item, temPdf: Boolean(item.pdf) })
            return (
              <LinhaDeLista
                key={item.id}
                variante="checkin"
                inicio={
                  <View style={{ width: LARGURA_DA_HORA, alignItems: 'center' }}>
                    <Texto variante="codigo" cor="destaque" accessibilityRole="text">
                      {String(i + 1)}
                    </Texto>
                  </View>
                }
                titulo={item.titulo}
                descricao={descricao}
                rotuloAcessivel={`Música ${i + 1} de ${itens.length}: ${item.titulo}. ${descricao}. Abrir a cifra${item.pdf ? ' e o PDF' : ''}.`}
                aoPressionar={() => abrirMusica(evento.id, item.id)}
              />
            )
          })}
        </Lista>
      </Cartao>
    )

  return (
    <View style={{ gap: ESPACO.e16 }}>
      {primeiro ? (
        <Cartao
          variante="momento"
          momento={momentoDoEncontro(evento.inicio, evento.fuso)}
          etiqueta="Próximo encontro"
          titulo={evento.titulo}
          meta={quando}
          {...(respostas ? { acoes: respostas } : {})}
        >
          {chips}
        </Cartao>
      ) : (
        <View style={{ gap: ESPACO.e8 }}>
          <Texto variante="sobrancelha" nivel={2}>
            {`Depois: ${evento.titulo}`}
          </Texto>
          <Texto variante="meta" cor="textoSuave">
            {quando}
          </Texto>
          {chips}
          {parte ? respostas : null}
        </View>
      )}
      {lista}
      {primeiro ? <UsoSemInternet eventoId={evento.id} /> : null}
    </View>
  )
}
