import { FUNCOES_PARA_CONVOCAR_NO_LOUVOR, resumoDaBanda, semAcento } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { useEffect, useEffectEvent, useState } from 'react'
import { View } from 'react-native'

import type { Atribuicao, DetalheDoEvento, Etapa } from '@/servicos/contratoDosEventos'
import { Aviso } from '@/ui/Aviso'
import { BarraDeProgresso } from '@/ui/BarraDeProgresso'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { MenuDeAcoes } from '@/ui/FolhaNaTela'
import { Icone } from '@/ui/Icone'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { usePode } from '../comunidade/permissoes'
import { useEstaOnline } from '../offline/ProvedorOffline'
import { BotaoAvisarABanda } from '../repertorio/BotaoAvisarABanda'
import { AVISO_DE_RASCUNHO, FolhaDeConvocar, useTirarDaConvocacao } from './Convocacao'
import { useConvocadosEmEspera, useRemovidasEmEspera } from './convocadosOtimistas'
import {
  descricaoDosPapeis,
  montarQuemVai,
  primeiroNome,
  type PessoaNaLista,
} from './listaDeQuemVai'
import { contarRespostas, juntarNomes } from './respostas'
import type { LembreteDoEncontro } from './useLembrete'

/** Valor do parâmetro de etapa para a equipe do evento como um todo (sem etapa). */
export const EQUIPE_GERAL = 'geral'

/** O chip da resposta da pessoa: palavra, ícone e cor juntos (a cor nunca é o único sinal). */
export function ChipDaResposta({ estado }: { estado: Atribuicao['estado'] }) {
  if (estado === 'confirmada') return <Chip situacao="aceitou" texto="Aceitou" />
  if (estado === 'pendente') return <Chip situacao="aguardando" texto="Aguardando" />
  if (estado === 'recusada') return <Chip situacao="naoPode" texto="Não pode ir" />
  return <Chip texto="Pediu troca" tom="info" icone="trocar" />
}

/**
 * A linha da pessoa em "Quem vai" (D74): o nome, o que ela faz (todos os papéis, juntos), a
 * situação e, para quem convoca, o botão "Tirar" com texto na própria linha. Quem ainda está na
 * espera do Desfazer mostra "A enviar": o servidor ainda não sabe dela e ninguém foi avisado.
 */
export function LinhaDaPessoaNaEquipe({
  pessoa,
  aoTirar,
}: {
  pessoa: PessoaNaLista
  aoTirar: (() => void) | undefined
}) {
  return (
    <LinhaDeLista
      key={pessoa.vinculoId}
      avatar={{ nome: pessoa.nome }}
      titulo={pessoa.nome}
      descricao={descricaoDosPapeis(pessoa)}
      linhasDaDescricao={0}
      extra={
        <View style={{ alignItems: 'flex-end', gap: ESPACO.e8 }}>
          {pessoa.emEspera ? (
            <Chip texto="A enviar" tom="neutro" icone="relogio" />
          ) : (
            <ChipDaResposta estado={pessoa.estado} />
          )}
          {aoTirar && !pessoa.emEspera ? (
            <Botao
              titulo="Tirar"
              tamanho="compacto"
              variante="secundario"
              rotuloAcessivel={`Tirar ${pessoa.nome} da convocação`}
              aoPressionar={aoTirar}
            />
          ) : null}
        </View>
      }
    />
  )
}

/** Tira a pessoa: direto se ela tem um papel só; com a escolha de qual, se tem mais de um. */
function useTirarPessoa(evento: DetalheDoEvento, comunidadeId: string) {
  const tirar = useTirarDaConvocacao(evento, comunidadeId)
  const [escolhida, setEscolhida] = useState<PessoaNaLista | null>(null)
  return {
    escolhida,
    fechar: () => setEscolhida(null),
    tirar,
    pedir: (pessoa: PessoaNaLista) =>
      pessoa.papeis.length === 1 ? tirar(pessoa, pessoa.papeis) : setEscolhida(pessoa),
  }
}

/** O que a rota pede para abrir já na folha de convocar. */
export interface PedidoDeConvocacao {
  funcao: string
  /** O bloco do roteiro: o id da etapa ou o nome dela ("louvor"). */
  bloco: string | null
}

/** A etapa que o `bloco` da rota nomeia (por id ou pelo nome, sem acento nem caixa). */
export function etapaDoBloco(
  evento: Pick<DetalheDoEvento, 'etapas'>,
  bloco: string | null,
): Etapa | null {
  if (!bloco) return null
  const alvo = semAcento(bloco)
  return evento.etapas.find((e) => e.id === bloco || semAcento(e.titulo) === alvo) ?? null
}

/**
 * Quem vai (D74, antes "Convocados"): UMA lista do encontro. No alto, "N de M responderam", quem
 * falta, "Falta: bateria" e "Lembrar os N" (um lembrete a quem não respondeu, com Desfazer). Depois,
 * a banda e a equipe: cada pessoa aparece uma vez por seção, com todos os papéis e a situação na
 * mesma linha, e o botão "Tirar". Embaixo, "Convocar pessoas": escolher o papel, marcar quem, e a
 * folha diz o que acontece e a quem. No rascunho, um aviso lembra que ninguém recebe nada antes de
 * publicar.
 */
export function QuemVai({
  evento,
  comunidadeId,
  lembrete,
  convocarInicial = null,
  aoUsarPedido,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
  /** O lembrete a quem não respondeu (o mesmo botão que a barra do encontro usa). */
  lembrete: LembreteDoEncontro
  /**
   * "Convocar bateria" do Início (D78): a rota traz `?funcao=Bateria&bloco=louvor` e a folha abre
   * JÁ no papel, no bloco certo. Só vale na abertura da tela.
   */
  convocarInicial?: PedidoDeConvocacao | null
  /** A folha já abriu pelo pedido: quem guarda o pedido o esquece. */
  aoUsarPedido?: () => void
}) {
  const { cores } = useTema()
  const pode = usePode()
  const online = useEstaOnline()
  const atribuir = pode('escala', 'atribuir')
  const emEspera = useConvocadosEmEspera(evento.id)
  const removidas = useRemovidasEmEspera()
  const saida = useTirarPessoa(evento, comunidadeId)
  const [folha, setFolha] = useState<{
    funcao: string | null
    /** Abre sem papel escolhido ("Convocar para a banda": a pessoa escolhe qual). */
    semPapel: boolean
    /** O bloco do roteiro de onde veio o pedido (só o link do Início traz). */
    etapa: Etapa | null
    aberta: boolean
    chave: number
  }>(() => ({
    funcao: convocarInicial?.funcao ?? null,
    semPapel: false,
    etapa: etapaDoBloco(evento, convocarInicial?.bloco ?? null),
    aberta: convocarInicial !== null,
    chave: 0,
  }))

  // Quem tirou e ainda espera o Desfazer já não aparece; quem foi convocado e ainda espera, sim.
  const doServidor = evento.atribuicoes.filter((a) => !removidas.has(a.id))
  const todas = [
    ...doServidor.map((a) => ({ ...a, emEspera: false })),
    ...emEspera.map((c) => ({
      id: c.chave,
      etapaId: c.etapaId,
      vinculoId: c.vinculoId,
      funcao: c.funcao,
      estado: 'pendente' as const,
      nome: c.nome,
      emEspera: true,
    })),
  ]
  // As contas de quem respondeu só contam quem o servidor já conhece (quem espera ainda não foi avisado).
  const respostas = contarRespostas(doServidor)
  const { banda, equipe } = montarQuemVai(todas, evento.etapas)
  const faltaNaBanda = resumoDaBanda(
    banda.flatMap((p) => p.papeis.map((x) => ({ funcao: x.funcao, estado: x.estado }))),
  ).faltam
  const semNinguemNaBanda = FUNCOES_PARA_CONVOCAR_NO_LOUVOR.filter(
    (f) => !faltaNaBanda.includes(f) && !banda.some((p) => p.papeis.some((x) => x.funcao === f)),
  )
  const semConvocados = todas.length === 0

  const abrirFolha = (funcao: string | null = null, semPapel = false) =>
    setFolha((f) => ({ funcao, semPapel, etapa: null, aberta: true, chave: f.chave + 1 }))
  // O pedido já foi atendido ao montar (estado inicial da folha): avisa quem o guarda.
  const usarPedido = useEffectEvent(() => {
    if (convocarInicial) aoUsarPedido?.()
  })
  useEffect(() => {
    usarPedido()
  }, [])
  const pedirParaTirar = atribuir ? saida.pedir : undefined
  const quemSai = saida.escolhida
  // Mais de um papel: a pessoa escolhe de qual tirar, ou de todos.
  const acoesDeTirar = quemSai
    ? [
        ...quemSai.papeis.map((papel) => ({
          titulo: `Tirar de ${papel.rotulo}`,
          icone: 'excluir' as const,
          destrutiva: true,
          aoPressionar: () => saida.tirar(quemSai, [papel]),
        })),
        {
          titulo: `Tirar de tudo (${quemSai.papeis.length} papéis)`,
          icone: 'excluir' as const,
          destrutiva: true,
          aoPressionar: () => saida.tirar(quemSai, quemSai.papeis),
        },
      ]
    : []

  return (
    <>
      {atribuir && evento.status === 'rascunho' ? (
        <Aviso tipo="info">{AVISO_DE_RASCUNHO}</Aviso>
      ) : null}

      {semConvocados ? (
        atribuir ? (
          <EstadoVazio
            icone="escalas"
            titulo="Ninguém vai ainda."
            descricao="Convoque quem vai servir neste encontro."
            acao={{
              titulo: 'Convocar pessoas',
              icone: 'adicionar',
              aoPressionar: () => abrirFolha(),
            }}
          />
        ) : (
          <Texto variante="corpo" cor="textoSuave">
            Ninguém foi convocado ainda.
          </Texto>
        )
      ) : (
        <CartaoDeVidro>
          <View style={{ gap: ESPACO.e8 }}>
            {/* Uma vez só: com todos respondidos o título vira "Todos responderam" com o check. */}
            {respostas.pendentes === 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
                <Icone nome="confirmado" cor={cores.sucesso} tamanho={20} />
                <Texto variante="tituloItem">Todos responderam</Texto>
              </View>
            ) : (
              <Texto variante="tituloItem">
                {`${respostas.responderam} de ${respostas.convocados} responderam`}
              </Texto>
            )}
            <BarraDeProgresso
              fracao={respostas.convocados ? respostas.responderam / respostas.convocados : 0}
              rotulo={`${respostas.responderam} de ${respostas.convocados} responderam`}
              trilho="tonal"
            />
            {respostas.pendentes > 0 ? (
              <Texto variante="meta" cor="textoSuave">
                {`Faltam: ${juntarNomes(respostas.nomesPendentes)}`}
              </Texto>
            ) : null}
            {faltaNaBanda.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
                <Icone nome="avisoAlerta" cor={cores.alerta} tamanho={16} />
                <Texto variante="meta">{`Falta: ${faltaNaBanda.map((f) => f.toLowerCase()).join(', ')}`}</Texto>
              </View>
            ) : null}
            {atribuir && lembrete.disponivel ? (
              lembrete.estado.fase === 'enviado' ? (
                <View style={{ gap: ESPACO.e8, alignItems: 'flex-start' }}>
                  <Chip situacao="aceitou" texto="Lembrete enviado" />
                  <Texto variante="meta" cor="textoSuave">
                    {lembrete.estado.texto}
                  </Texto>
                </View>
              ) : (
                <Botao
                  titulo={
                    lembrete.estado.fase === 'esperando'
                      ? lembrete.rotuloEnviando
                      : `Lembrar ${respostas.pendentes === 1 ? 'o 1' : `os ${respostas.pendentes}`}`
                  }
                  icone="sino"
                  tamanho="medio"
                  variante="secundario"
                  desabilitado={lembrete.estado.fase === 'esperando' || !online}
                  {...(!online ? { motivo: 'Precisa de internet para avisar as pessoas.' } : {})}
                  rotuloAcessivel={`Lembrar quem não respondeu: ${juntarNomes(respostas.nomesPendentes)}`}
                  aoPressionar={lembrete.pedir}
                />
              )
            ) : null}
            {atribuir && faltaNaBanda.length > 0 && respostas.pendentes === 0 ? (
              <Botao
                titulo={`Convocar ${faltaNaBanda[0]!.toLowerCase()}`}
                tamanho="medio"
                variante="secundario"
                aoPressionar={() => abrirFolha(faltaNaBanda[0])}
              />
            ) : null}
          </View>
        </CartaoDeVidro>
      )}

      {!semConvocados && (banda.length > 0 || atribuir) ? (
        <Secao
          titulo="Banda"
          {...(atribuir
            ? {
                acao: (
                  <Botao
                    titulo="Convocar para a banda"
                    icone="adicionar"
                    variante="terciario"
                    alinhado
                    aoPressionar={() => abrirFolha(null, true)}
                  />
                ),
              }
            : {})}
        >
          {banda.length > 0 ? (
            <CartaoDeVidro lista>
              <Lista>
                {banda.map((p) => (
                  <LinhaDaPessoaNaEquipe
                    key={p.vinculoId}
                    pessoa={p}
                    aoTirar={pedirParaTirar ? () => pedirParaTirar(p) : undefined}
                  />
                ))}
              </Lista>
            </CartaoDeVidro>
          ) : (
            <CartaoDeVidro>
              <Texto variante="corpo" cor="textoSuave">
                Ninguém na banda ainda.
              </Texto>
            </CartaoDeVidro>
          )}
          {atribuir && semNinguemNaBanda.length > 0 ? (
            <CartaoDeVidro lista sobrancelha="Sem ninguém ainda">
              <Lista>
                {semNinguemNaBanda.map((f) => (
                  <LinhaDeLista
                    key={f}
                    titulo={f}
                    descricao="Ninguém"
                    extra={
                      <Botao
                        titulo="Convocar"
                        tamanho="compacto"
                        variante="secundario"
                        rotuloAcessivel={`Convocar para ${f}`}
                        aoPressionar={() => abrirFolha(f)}
                      />
                    }
                  />
                ))}
              </Lista>
            </CartaoDeVidro>
          ) : null}
          {atribuir && banda.length > 0 ? (
            <View style={{ flexDirection: 'row' }}>
              <BotaoAvisarABanda
                comunidadeId={comunidadeId}
                eventoId={evento.id}
                publicado={evento.status === 'publicado'}
              />
            </View>
          ) : null}
        </Secao>
      ) : null}

      {equipe.length > 0 ? (
        <Secao titulo="Equipe">
          <CartaoDeVidro lista>
            <Lista>
              {equipe.map((p) => (
                <LinhaDaPessoaNaEquipe
                  key={p.vinculoId}
                  pessoa={p}
                  aoTirar={pedirParaTirar ? () => pedirParaTirar(p) : undefined}
                />
              ))}
            </Lista>
          </CartaoDeVidro>
        </Secao>
      ) : null}

      {atribuir && !semConvocados ? (
        <Botao
          titulo="Convocar pessoas"
          icone="adicionar"
          tamanho="grande"
          larguraTotal
          desabilitado={!online}
          {...(!online ? { motivo: 'Precisa de internet para avisar as pessoas.' } : {})}
          aoPressionar={() => abrirFolha()}
        />
      ) : null}

      {atribuir ? (
        <>
          <FolhaDeConvocar
            key={folha.chave}
            evento={evento}
            etapa={folha.etapa}
            comunidadeId={comunidadeId}
            aberta={folha.aberta}
            funcaoInicial={folha.funcao}
            semPapelInicial={folha.semPapel}
            aoFechar={() => setFolha((f) => ({ ...f, aberta: false }))}
          />
          <MenuDeAcoes
            aberto={saida.escolhida !== null}
            titulo={
              saida.escolhida ? `Tirar ${primeiroNome(saida.escolhida.nome)} de quê?` : 'Tirar'
            }
            aoFechar={saida.fechar}
            acoes={acoesDeTirar}
          />
        </>
      ) : null}
    </>
  )
}
