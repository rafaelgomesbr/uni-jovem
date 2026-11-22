import {
  agruparBanda,
  ehEtapaDeLouvor,
  FUNCOES_PARA_CONVOCAR_NO_LOUVOR,
  resumoDaBanda,
} from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'

import type { Atribuicao, DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { Aviso } from '@/ui/Aviso'
import { BarraDeProgresso } from '@/ui/BarraDeProgresso'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Icone } from '@/ui/Icone'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { formatarHora } from '@/utilidades/datas'

import { usePode } from '../comunidade/permissoes'
import { useEstaOnline } from '../offline/ProvedorOffline'
import { BotaoAvisarABanda } from '../repertorio/BotaoAvisarABanda'
import { AVISO_DE_RASCUNHO, FolhaDeConvocar, MenuDaPessoaConvocada } from './Convocacao'
import { useConvocadosEmEspera } from './convocadosOtimistas'
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

const TEXTO_DO_ESTADO: Readonly<Record<Atribuicao['estado'], string>> = {
  confirmada: 'Aceitou',
  pendente: 'Aguardando resposta',
  recusada: 'Não pode ir',
  substituicao_pedida: 'Pediu troca',
}

/**
 * Pessoa convocada: avatar de 40, nome, função e o chip da resposta. Devolve
 * a própria `LinhaDeLista` (com a chave), para a `Lista` recuar o separador.
 */
export function linhaDaPessoaEscalada(atribuicao: Atribuicao, aoPressionar?: () => void) {
  return (
    <LinhaDeLista
      key={atribuicao.id}
      avatar={{ nome: atribuicao.nome }}
      titulo={atribuicao.nome}
      descricao={atribuicao.funcao}
      extra={<ChipDaResposta estado={atribuicao.estado} />}
      rotuloAcessivel={`${atribuicao.nome}, ${atribuicao.funcao}. Convocação: ${TEXTO_DO_ESTADO[atribuicao.estado]}`}
      {...(aoPressionar ? { aoPressionar, semSeta: true } : {})}
    />
  )
}

/**
 * Convocados (D69, seção 3.5): o resumo "9 de 11 responderam", quem falta e "Falta: bateria",
 * o botão "Lembrar os N" (um lembrete genérico a quem não respondeu, com Desfazer de 10 s), os
 * blocos de quem serve (o Louvor por função, os outros por etapa) e "Convocar pessoas", que
 * abre a folha de várias pessoas de uma vez. No rascunho, um aviso lembra que ninguém recebe
 * nada antes de publicar.
 */
export function SecaoEquipe({
  evento,
  comunidadeId,
  lembrete,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
  /** O lembrete a quem não respondeu (o mesmo botão que a barra do encontro usa). */
  lembrete: LembreteDoEncontro
}) {
  const { cores } = useTema()
  const pode = usePode()
  const online = useEstaOnline()
  const atribuir = pode('escala', 'atribuir')
  const emEspera = useConvocadosEmEspera(evento.id)
  const [folha, setFolha] = useState<{
    etapaId: string | null
    funcao: string | null
    aberta: boolean
    chave: number
  }>({ etapaId: null, funcao: null, aberta: false, chave: 0 })
  const [escolhida, setEscolhida] = useState<Atribuicao | null>(null)

  // As pessoas na espera do Desfazer entram como "aguardando": o bloco já mostra o que a pessoa fez.
  const todas: Atribuicao[] = [
    ...evento.atribuicoes,
    ...emEspera.map((c) => ({
      id: c.chave,
      etapaId: c.etapaId,
      vinculoId: c.vinculoId,
      funcao: c.funcao,
      estado: 'pendente' as const,
      nome: c.nome,
    })),
  ]
  const respostas = contarRespostas(todas)
  const grupos = [
    { id: EQUIPE_GERAL, titulo: 'Para o encontro inteiro', etapaId: null as string | null },
    ...evento.etapas.map((e) => ({
      id: e.id,
      titulo: `${formatarHora(e.inicioPrevisto, evento.fuso)} · ${e.titulo}`,
      etapaId: e.id as string | null,
    })),
  ]
  const louvor = evento.etapas.find((e) => ehEtapaDeLouvor(e.titulo))
  const faltaNaBanda = louvor
    ? resumoDaBanda(todas.filter((a) => a.etapaId === louvor.id)).faltam
    : []

  const abrirFolha = (etapaId: string | null, funcao: string | null = null) =>
    setFolha((f) => ({ etapaId, funcao, aberta: true, chave: f.chave + 1 }))
  const etapaDaFolha = evento.etapas.find((e) => e.id === folha.etapaId) ?? null

  const semConvocados = todas.length === 0

  return (
    <>
      {atribuir && evento.status === 'rascunho' ? (
        <Aviso tipo="info">{AVISO_DE_RASCUNHO}</Aviso>
      ) : null}

      {semConvocados ? (
        atribuir ? (
          <EstadoVazio
            icone="escalas"
            titulo="Ninguém convocado ainda."
            descricao="Convoque quem vai servir neste encontro."
            acao={{
              titulo: 'Convocar pessoas',
              icone: 'adicionar',
              aoPressionar: () => abrirFolha(null),
            }}
          />
        ) : (
          <Texto variante="corpo" cor="textoSuave">
            Ninguém convocado ainda.
          </Texto>
        )
      ) : (
        <CartaoDeVidro>
          <View style={{ gap: ESPACO.e8 }}>
            <Texto variante="tituloItem">
              {`${respostas.responderam} de ${respostas.convocados} responderam`}
            </Texto>
            <BarraDeProgresso
              fracao={respostas.convocados ? respostas.responderam / respostas.convocados : 0}
              rotulo={`${respostas.responderam} de ${respostas.convocados} responderam`}
              trilho="tonal"
            />
            {respostas.pendentes > 0 ? (
              <Texto variante="meta" cor="textoSuave">
                {`Faltam: ${juntarNomes(respostas.nomesPendentes)}`}
              </Texto>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
                <Chip situacao="aceitou" texto="Todos responderam" />
              </View>
            )}
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
                      ? 'Enviando em 10 s'
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
            {atribuir && faltaNaBanda.length > 0 && respostas.pendentes === 0 && louvor ? (
              <Botao
                titulo={`Convocar ${faltaNaBanda[0]!.toLowerCase()}`}
                tamanho="medio"
                variante="secundario"
                aoPressionar={() => abrirFolha(louvor.id, faltaNaBanda[0])}
              />
            ) : null}
          </View>
        </CartaoDeVidro>
      )}

      {grupos.map((g) => {
        const pessoas = todas.filter((a) => a.etapaId === g.etapaId)
        const etapaDoGrupo = evento.etapas.find((e) => e.id === g.id)
        // Só o que tem gente aparece; o Louvor fica sempre (é onde a banda se monta).
        const ehLouvor = !!etapaDoGrupo && ehEtapaDeLouvor(etapaDoGrupo.titulo)
        if (pessoas.length === 0 && !(atribuir && ehLouvor && !semConvocados)) return null
        const acoes = atribuir ? (
          <Botao
            titulo="Convocar"
            icone="adicionar"
            variante="terciario"
            alinhado
            rotuloAcessivel={`Convocar: ${g.etapaId ? g.titulo : 'para o encontro inteiro'}`}
            aoPressionar={() => abrirFolha(g.etapaId)}
          />
        ) : undefined
        if (etapaDoGrupo && ehLouvor) {
          return (
            <GrupoDoLouvor
              key={g.id}
              titulo={g.titulo}
              pessoas={pessoas}
              acao={acoes}
              evento={evento}
              comunidadeId={comunidadeId}
              aoEscolher={atribuir ? setEscolhida : undefined}
              aoConvocarFuncao={atribuir ? (f) => abrirFolha(etapaDoGrupo.id, f) : undefined}
            />
          )
        }
        return pessoas.length ? (
          <CartaoDeVidro key={g.id} lista sobrancelha={g.titulo} {...(acoes ? { acoes } : {})}>
            <Lista>
              {pessoas.map((a) =>
                linhaDaPessoaEscalada(
                  a,
                  atribuir && !a.id.startsWith('espera-') ? () => setEscolhida(a) : undefined,
                ),
              )}
            </Lista>
          </CartaoDeVidro>
        ) : (
          <CartaoDeVidro key={g.id} sobrancelha={g.titulo} {...(acoes ? { acoes } : {})}>
            <Texto variante="corpo" cor="textoSuave">
              Ninguém convocado ainda.
            </Texto>
          </CartaoDeVidro>
        )
      })}

      {atribuir && !semConvocados ? (
        <Botao
          titulo="Convocar pessoas"
          icone="adicionar"
          tamanho="grande"
          larguraTotal
          desabilitado={!online}
          {...(!online ? { motivo: 'Precisa de internet para avisar as pessoas.' } : {})}
          aoPressionar={() => abrirFolha(null)}
        />
      ) : null}

      {atribuir ? (
        <>
          <FolhaDeConvocar
            key={folha.chave}
            evento={evento}
            etapa={etapaDaFolha}
            comunidadeId={comunidadeId}
            aberta={folha.aberta}
            funcaoInicial={folha.funcao}
            escolherEtapa={folha.etapaId === null && folha.funcao === null}
            aoFechar={() => setFolha((f) => ({ ...f, aberta: false }))}
          />
          <MenuDaPessoaConvocada
            evento={evento}
            comunidadeId={comunidadeId}
            escolhida={escolhida}
            aoFechar={() => setEscolhida(null)}
          />
        </>
      ) : null}
    </>
  )
}

/**
 * Convocados da etapa do Louvor (D61): um bloco por função da banda (Vocal,
 * Violão, Guitarra...), o resumo "5 de 7 aceitaram. Falta: bateria" e o
 * "Avisar a banda". Quem convoca vê também as funções da banda ainda sem ninguém, cada uma
 * com o seu "Convocar".
 */
function GrupoDoLouvor({
  titulo,
  pessoas,
  acao,
  evento,
  comunidadeId,
  aoEscolher,
  aoConvocarFuncao,
}: {
  titulo: string
  pessoas: Atribuicao[]
  acao: ReactNode
  evento: DetalheDoEvento
  comunidadeId: string
  aoEscolher: ((a: Atribuicao) => void) | undefined
  aoConvocarFuncao: ((funcao: string) => void) | undefined
}) {
  const resumo = resumoDaBanda(pessoas)
  const blocos = agruparBanda(pessoas).filter((g) => g.pessoas.length > 0)
  const semNinguem = FUNCOES_PARA_CONVOCAR_NO_LOUVOR.filter(
    (f) => !blocos.some((g) => g.funcao === f),
  )
  return (
    <Secao titulo={titulo} {...(acao ? { acao } : {})}>
      {pessoas.length === 0 ? (
        <CartaoDeVidro>
          <Texto variante="corpo" cor="textoSuave">
            Ninguém convocado ainda.
          </Texto>
        </CartaoDeVidro>
      ) : (
        <>
          {resumo.faltam.length > 0 ? (
            <Aviso tipo="alerta" titulo={resumo.texto} />
          ) : (
            <Texto variante="corpo">{resumo.texto}</Texto>
          )}
          {blocos.map((b) => (
            <CartaoDeVidro key={b.funcao} lista sobrancelha={`${b.funcao} · ${b.pessoas.length}`}>
              <Lista>
                {b.pessoas.map((a) =>
                  linhaDaPessoaEscalada(
                    a,
                    aoEscolher && !a.id.startsWith('espera-') ? () => aoEscolher(a) : undefined,
                  ),
                )}
              </Lista>
            </CartaoDeVidro>
          ))}
          {aoConvocarFuncao && semNinguem.length > 0 ? (
            <CartaoDeVidro sobrancelha="Ninguém convocado">
              <Lista>
                {semNinguem.map((f) => (
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
                        aoPressionar={() => aoConvocarFuncao(f)}
                      />
                    }
                  />
                ))}
              </Lista>
            </CartaoDeVidro>
          ) : null}
        </>
      )}
      {aoEscolher ? (
        <View style={{ flexDirection: 'row' }}>
          <BotaoAvisarABanda
            comunidadeId={comunidadeId}
            eventoId={evento.id}
            publicado={evento.status === 'publicado'}
          />
        </View>
      ) : null}
    </Secao>
  )
}
