import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { mensagemDoErro } from '@/servicos/erros'
import { Botao } from '@/ui/Botao'
import { CampoDeBusca } from '@/ui/Campo'
import { Chip } from '@/ui/Chip'
import { Esqueleto, LinhaDeEsqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha } from '@/ui/Falha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { CamposDaMusicaNova, Erro, useFormularioDeMusica } from '../conteudos/FormularioDeConteudo'
import { useAnexarPdf, useConteudos } from '../conteudos/consultas'
import { VazioComSol } from '../inscricoes/VazioComSol'
import { FolhaComRodape } from './FolhaComRodape'
import { useAdicionarMusicas, useCadastrarMusicaNoRepertorio } from './consultas'

/** Busca sem acento e sem caixa. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')
}

/** Até onde o título digitado na busca aparece no botão ("Cadastrar “Oceanos”"). */
const LIMITE_DO_TITULO_NO_BOTAO = 40

export const TEXTO_DO_BOTAO_DE_CADASTRAR = 'Cadastrar nova música'
export const TEXTO_DE_SALVAR_E_ADICIONAR = 'Salvar na biblioteca e adicionar ao repertório'
export const TEXTO_DA_BIBLIOTECA =
  'Toda música cadastrada fica na biblioteca da comunidade, para usar de novo nos próximos encontros. Para tirá-la só deste repertório, use "Tirar do repertório" na linha da música.'

/** `Cadastrar “Oceanos”`: o botão da busca que não achou, com o título cortado se for longo. */
export function rotuloDeCadastrarDaBusca(titulo: string): string {
  const t = titulo.trim()
  const curto =
    t.length > LIMITE_DO_TITULO_NO_BOTAO ? `${t.slice(0, LIMITE_DO_TITULO_NO_BOTAO)}…` : t
  return `Cadastrar “${curto}”`
}

interface Props {
  aberta: boolean
  aoFechar: () => void
  comunidadeId: string
  eventoId: string
  /** Músicas que já estão no repertório (não aparecem para marcar de novo). */
  jaNoRepertorio: ReadonlySet<string>
}

/**
 * "Adicionar músicas" ao repertório do encontro (D80). Duas telas na MESMA folha, sem voltas:
 *
 * 1. ESCOLHER: no alto, SEMPRE, "Cadastrar nova música" (ou `Cadastrar “texto”` quando a busca não
 *    achou nada com esse título); depois a busca e a lista da biblioteca para marcar várias. O
 *    botão que conclui ("Adicionar 3 músicas") fica FIXO embaixo, fora da rolagem. Com a biblioteca
 *    toda usada, a folha diz "Todas as músicas já estão aqui. Quer cadastrar uma nova?" com o botão.
 * 2. CADASTRAR: o formulário curto da Biblioteca (título, artista, tom, links do Drive e do YouTube,
 *    cifra e PDF, com o aceite de direitos só quando há cifra ou PDF), e "Salvar na biblioteca e
 *    adicionar ao repertório" cria a música E a põe neste repertório numa ação só. Toda música fica
 *    na biblioteca (o repertório guarda uma referência a ela), e a folha explica isso.
 */
export function FolhaDeAdicionarMusicas({
  aberta,
  aoFechar,
  comunidadeId,
  eventoId,
  jaNoRepertorio,
}: Props) {
  const musicas = useConteudos(comunidadeId, 'musicas', aberta)
  const adicionar = useAdicionarMusicas(comunidadeId, eventoId)
  const cadastrar = useCadastrarMusicaNoRepertorio(comunidadeId, eventoId)
  const anexar = useAnexarPdf(comunidadeId)
  const form = useFormularioDeMusica()
  const [cadastrando, setCadastrando] = useState(false)
  const [busca, setBusca] = useState('')
  const [marcadas, setMarcadas] = useState<readonly string[]>([])
  const termo = normalizar(busca.trim())

  const todas = musicas.data ?? []
  const disponiveis = todas.filter(
    (m) =>
      !m.arquivada &&
      !jaNoRepertorio.has(m.id) &&
      (!termo || normalizar(`${m.titulo} ${m.artista ?? ''}`).includes(termo)),
  )
  // Busca sem uma música com este título (nem as que já estão no repertório): vira "Cadastrar “texto”".
  const tituloDaBusca =
    termo && !todas.some((m) => normalizar(m.titulo) === termo) ? busca.trim().slice(0, 120) : ''
  const bibliotecaVazia = !musicas.isPending && !musicas.error && todas.length === 0
  const tudoUsado =
    !musicas.isPending && !musicas.error && todas.length > 0 && !termo && disponiveis.length === 0

  function alternar(id: string) {
    setMarcadas((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]))
  }

  function fechar() {
    setBusca('')
    setMarcadas([])
    setCadastrando(false)
    form.reiniciar()
    aoFechar()
  }

  function abrirCadastro(titulo: string) {
    form.reiniciar(titulo)
    setCadastrando(true)
  }

  function confirmar() {
    adicionar.mutate(marcadas, {
      onSuccess: (n) => {
        mostrarToast({
          texto:
            n === 1
              ? 'Música adicionada ao repertório.'
              : `${n} músicas adicionadas ao repertório.`,
        })
        fechar()
      },
    })
  }

  /** Cria a música e a põe no repertório numa chamada; o PDF, que vai como arquivo, vai em seguida. */
  async function salvarENesteRepertorio() {
    const corpo = form.preparar()
    if (!corpo) return
    let criada: { musicaId: string }
    try {
      criada = await cadastrar.mutateAsync(corpo)
    } catch {
      return // `cadastrar.error` mostra o motivo na tela.
    }
    const titulo = String(corpo['titulo'] ?? '')
    let texto = `“${titulo}” entrou na biblioteca e neste repertório.`
    if (form.pdf) {
      try {
        await anexar.mutateAsync({ musicaId: criada.musicaId, pdf: form.pdf })
      } catch {
        // A música já está salva e no repertório: não se perde o trabalho. O PDF se anexa depois.
        texto = `“${titulo}” entrou no repertório, mas o PDF não foi anexado. Abra a música na biblioteca e anexe de novo.`
      }
    }
    mostrarToast({ texto })
    fechar()
  }

  const entraram = (adicionar.error as { entraram?: number } | null)?.entraram ?? 0
  const ocupadoCadastrando = cadastrar.isPending || anexar.isPending

  const rodape = cadastrando ? (
    <Botao
      titulo={TEXTO_DE_SALVAR_E_ADICIONAR}
      tamanho="grande"
      larguraTotal
      carregando={ocupadoCadastrando}
      aoPressionar={() => void salvarENesteRepertorio()}
    />
  ) : disponiveis.length > 0 ? (
    <Botao
      titulo={
        marcadas.length === 0
          ? 'Marque as músicas'
          : `Adicionar ${marcadas.length} ${marcadas.length === 1 ? 'música' : 'músicas'}`
      }
      tamanho="grande"
      larguraTotal
      desabilitado={marcadas.length === 0}
      carregando={adicionar.isPending}
      aoPressionar={confirmar}
    />
  ) : undefined

  return (
    <FolhaComRodape
      aberta={aberta}
      titulo={cadastrando ? 'Nova música' : 'Adicionar músicas'}
      aoFechar={fechar}
      {...(rodape ? { rodape } : {})}
    >
      {cadastrando ? (
        <View style={{ gap: ESPACO.e16 }}>
          <Botao
            titulo="Voltar à lista"
            icone="voltar"
            variante="terciario"
            alinhado
            desabilitado={ocupadoCadastrando}
            aoPressionar={() => setCadastrando(false)}
          />
          <Texto variante="corpo" cor="textoSuave">
            Ela entra na biblioteca da comunidade e no fim deste repertório, de uma vez só.
          </Texto>
          <CamposDaMusicaNova form={form} enviandoPdf={anexar.isPending} resumido />
          {cadastrar.error ? <Erro titulo="A música não foi salva" erro={cadastrar.error} /> : null}
          <Texto variante="legenda" cor="textoSuave">
            {TEXTO_DA_BIBLIOTECA}
          </Texto>
        </View>
      ) : (
        <>
          <View style={{ gap: ESPACO.e8 }}>
            {tudoUsado ? (
              <Texto variante="corpo">
                Todas as músicas já estão aqui. Quer cadastrar uma nova?
              </Texto>
            ) : bibliotecaVazia ? (
              <Texto variante="corpo">
                A biblioteca ainda não tem músicas. Cadastre a primeira: ela entra na biblioteca e
                neste repertório.
              </Texto>
            ) : null}
            <Botao
              titulo={
                tituloDaBusca
                  ? rotuloDeCadastrarDaBusca(tituloDaBusca)
                  : TEXTO_DO_BOTAO_DE_CADASTRAR
              }
              rotuloAcessivel={
                tituloDaBusca ? `Cadastrar a música ${tituloDaBusca}` : TEXTO_DO_BOTAO_DE_CADASTRAR
              }
              icone="adicionar"
              tamanho="grande"
              larguraTotal
              variante={
                tudoUsado || bibliotecaVazia || disponiveis.length === 0 ? 'primario' : 'secundario'
              }
              aoPressionar={() => abrirCadastro(tituloDaBusca)}
            />
            {!tudoUsado && !bibliotecaVazia && !tituloDaBusca ? (
              <Texto variante="legenda" cor="textoSuave">
                Não achou a música? Cadastre aqui: ela entra na biblioteca e neste repertório.
              </Texto>
            ) : null}
          </View>

          {musicas.isPending ? (
            <Esqueleto rotulo="Carregando as músicas">
              <LinhaDeEsqueleto altura={56} />
              <LinhaDeEsqueleto altura={56} />
            </Esqueleto>
          ) : musicas.error ? (
            <VazioComSol
              titulo="Não deu para carregar as músicas"
              descricao={mensagemDoErro(musicas.error)}
              acao={{ titulo: 'Tentar de novo', aoPressionar: () => void musicas.refetch() }}
            />
          ) : todas.length > 0 ? (
            <>
              <CampoDeBusca rotulo="Buscar na biblioteca" valor={busca} aoMudar={setBusca} />
              {adicionar.error ? (
                <AvisoDeFalha
                  erro={adicionar.error}
                  titulo={
                    entraram > 0
                      ? `Só ${entraram} ${entraram === 1 ? 'música entrou' : 'músicas entraram'}`
                      : 'A música não entrou'
                  }
                />
              ) : null}
              {disponiveis.length === 0 ? (
                termo ? (
                  <Texto variante="corpo" cor="textoSuave">
                    Nenhuma música com essa busca. As que já estão no repertório não aparecem.
                  </Texto>
                ) : null
              ) : (
                <Lista>
                  {disponiveis.map((m) => {
                    const marcada = marcadas.includes(m.id)
                    const descricao = [
                      m.tom ? `Tom ${m.tom}` : null,
                      m.artista ? `de ${m.artista}` : null,
                      m.temCifra === false && !m.temPdf ? 'Sem cifra' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                    return (
                      <LinhaDeLista
                        key={m.id}
                        icone="musica"
                        titulo={m.titulo}
                        {...(descricao ? { descricao } : {})}
                        marcada={marcada}
                        semSeta
                        extra={marcada ? <Chip situacao="aceitou" texto="Marcada" /> : undefined}
                        rotuloAcessivel={`${m.titulo}${descricao ? `. ${descricao}` : ''}. ${marcada ? 'Marcada' : 'Não marcada'}. Toque para ${marcada ? 'desmarcar' : 'marcar'}.`}
                        aoPressionar={() => alternar(m.id)}
                      />
                    )
                  })}
                </Lista>
              )}
            </>
          ) : null}
        </>
      )}
    </FolhaComRodape>
  )
}
