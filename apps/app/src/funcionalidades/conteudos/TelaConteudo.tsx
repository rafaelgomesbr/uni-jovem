import { detectarFormato } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import type { ResumoDoPdf } from '@/servicos/contratoDoPdf'
import type { Musica, TipoDeConteudo } from '@/servicos/contratoDosModulos'
import { mensagemDoErro, SemConexao } from '@/servicos/erros'
import { abrirLink } from '@/utilidades/compartilhar'
import { confirmar } from '@/utilidades/confirmar'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { Esqueleto, LinhaDeEsqueleto, LinhasDeEsqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { ErroDaTela } from '@/ui/Falha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { voltarOu } from '@/ui/navegacao'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { CartaoDoPdf } from '../pdf/CartaoDoPdf'
import { conferirPdfEscolhido, seletorDePdf, type PdfConferido } from '../pdf/seletorDePdf'
import { LeitorDeCifra } from '../repertorio/LeitorDeCifra'
import { CampoDeCifra } from './CampoDeCifra'
import { CampoDePdf, MENSAGEM_DE_CONFIRMAR_O_PDF } from './CampoDePdf'
import {
  useAnexarPdf,
  useConteudo,
  useConteudos,
  useCriarConteudo,
  useDefinirMusicos,
  useEditarConteudo,
  useExcluirConteudo,
  useRemoverPdf,
} from './consultas'
import {
  CAMPO_DA_CONFIRMACAO,
  ehTipoDeConteudo,
  estaArquivado,
  exigeConfirmarDireitos,
  montarCorpo,
  textoDoCampo,
  textoParaMostrar,
  TIPOS_DE_CONTEUDO,
  type DefinicaoDeCampo,
  type DefinicaoDoTipo,
} from './tipos'

/** Rotas `/conteudos/[tipo]/[itemId]` e `/conteudos/[tipo]/novo`. */
export function TelaConteudo({ novo = false }: { novo?: boolean }) {
  const params = useLocalSearchParams<{ tipo: string; itemId?: string }>()
  const tipo = parametro(params.tipo)
  const itemId = novo ? null : parametro(params.itemId)
  const { comunidadeAtiva } = useSessao()
  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo="Biblioteca">
        <SemComunidade oQue="a biblioteca" />
      </Tela>
    )
  }
  if (!ehTipoDeConteudo(tipo)) {
    return (
      <Tela pilha titulo="Biblioteca">
        <EstadoVazio
          icone="erro"
          titulo="Não encontramos isto"
          descricao="Pode ter sido removido. Volte para a Biblioteca e escolha de novo."
          acao={{ titulo: 'Ver a Biblioteca', aoPressionar: () => router.replace('/conteudos') }}
        />
      </Tela>
    )
  }
  const def = TIPOS_DE_CONTEUDO[tipo]
  if (novo) return <Novo comunidadeId={comunidadeAtiva.id} def={def} />
  if (!itemId)
    return (
      <Tela pilha titulo="Biblioteca">
        {null}
      </Tela>
    )
  return <Item comunidadeId={comunidadeAtiva.id} def={def} itemId={itemId} />
}

type Valores = Record<string, string>

function Formulario({
  def,
  valores,
  aoMudar,
  erros,
  cifraSalva = null,
}: {
  def: DefinicaoDoTipo
  valores: Valores
  aoMudar: (v: Valores) => void
  erros: Record<string, string>
  /** A cifra como está salva (nula na criação): só a que mudou pede a confirmação de direitos. */
  cifraSalva?: string | null
}) {
  return (
    <>
      {def.campos.map((c) =>
        c.formato === 'cifra' ? (
          <CampoDeCifra
            key={c.campo}
            rotulo={c.rotulo}
            valor={valores[c.campo] ?? ''}
            aoMudar={(t) => aoMudar({ ...valores, [c.campo]: t })}
            erro={erros[c.campo] ?? null}
            pedeConfirmacao={exigeConfirmarDireitos(def, valores, cifraSalva)}
            confirmada={valores[CAMPO_DA_CONFIRMACAO] === 'sim'}
            aoConfirmar={(sim) =>
              aoMudar({ ...valores, [CAMPO_DA_CONFIRMACAO]: sim ? 'sim' : 'nao' })
            }
            erroDaConfirmacao={erros[CAMPO_DA_CONFIRMACAO] ?? null}
          />
        ) : (
          <Campo
            key={c.campo}
            rotulo={c.rotulo}
            opcional={!c.obrigatorio}
            value={valores[c.campo] ?? ''}
            onChangeText={(t) => aoMudar({ ...valores, [c.campo]: t })}
            erro={erros[c.campo] ?? null}
            {...(c.ajuda ? { ajuda: c.ajuda } : {})}
            multiline={!!c.multilinha}
            {...(c.formato === 'numero'
              ? { inputMode: 'numeric' as const, sufixo: c.unidade ?? 'min' }
              : {})}
            {...(c.formato === 'duracao' ? { exemplo: '3:45' } : {})}
            {...(c.formato === 'tom' ? { autoCapitalize: 'characters' as const } : {})}
            {...(c.formato === 'link'
              ? { inputMode: 'url' as const, autoCapitalize: 'none' as const }
              : {})}
            maxLength={c.formato === 'numero' ? 3 : c.max}
          />
        ),
      )}
    </>
  )
}

/**
 * Confere o aviso de direitos autorais: cifra nova ou mudada só salva com a
 * confirmação marcada. Devolve o erro para o formulário e o que a API espera.
 */
function conferirDireitos(
  def: DefinicaoDoTipo,
  valores: Valores,
  cifraSalva: string | null,
): { erros: Record<string, string> } | { corpo: { direitosConfirmados?: true } } {
  if (!exigeConfirmarDireitos(def, valores, cifraSalva)) return { corpo: {} }
  if (valores[CAMPO_DA_CONFIRMACAO] !== 'sim') {
    return {
      erros: {
        [CAMPO_DA_CONFIRMACAO]: 'Confirme os direitos de uso para salvar a letra e a cifra.',
      },
    }
  }
  return { corpo: { direitosConfirmados: true } }
}

function Erro({ titulo, erro }: { titulo: string; erro: unknown }) {
  return (
    <Aviso tipo="erro" titulo={titulo} anunciar>
      {mensagemDoErro(erro)}
    </Aviso>
  )
}

/**
 * Escolhe o arquivo, confere (tamanho e tipo) e devolve o PDF lido, ou a mensagem humana do que
 * deu errado. `null` sem mensagem: a pessoa cancelou a escolha.
 */
async function escolherEConferirPdf(): Promise<{ pdf: PdfConferido } | { erro: string } | null> {
  const arquivo = await seletorDePdf.escolher()
  if (!arquivo) return null
  const r = await conferirPdfEscolhido(arquivo)
  return r.ok ? { pdf: r.pdf } : { erro: r.mensagem }
}

function Novo({ comunidadeId, def }: { comunidadeId: string; def: DefinicaoDoTipo }) {
  const pode = usePode()
  const [valores, setValores] = useState<Valores>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  // O PDF escolhido espera a música ser salva (só então ela tem um id para receber o arquivo).
  const [pdf, setPdf] = useState<PdfConferido | null>(null)
  const [erroDoPdf, setErroDoPdf] = useState<string | null>(null)
  const criar = useCriarConteudo(comunidadeId, def.tipo)
  const anexar = useAnexarPdf(comunidadeId)
  const titulo = `Nov${def.artigo} ${def.singular}`
  if (!pode('conteudo', 'gerenciar')) {
    return (
      <Tela pilha titulo={titulo}>
        <Aviso tipo="alerta" titulo="Só a organização cadastra">
          Organizadores e administradores cadastram conteúdos. Você pode consultar a lista.
        </Aviso>
      </Tela>
    )
  }

  async function escolherPdf() {
    setErroDoPdf(null)
    const r = await escolherEConferirPdf()
    if (!r) return
    if ('erro' in r) setErroDoPdf(r.erro)
    else setPdf(r.pdf)
  }

  function salvar() {
    const r = montarCorpo(def, valores)
    const direitos = conferirDireitos(def, valores, null)
    // O PDF pede o mesmo aceite de direitos da cifra em texto.
    const direitosDoPdf: Record<string, string> =
      pdf && valores[CAMPO_DA_CONFIRMACAO] !== 'sim'
        ? { [CAMPO_DA_CONFIRMACAO]: MENSAGEM_DE_CONFIRMAR_O_PDF }
        : {}
    if ('erros' in r || 'erros' in direitos || Object.keys(direitosDoPdf).length) {
      setErros({
        ...('erros' in r ? r.erros : {}),
        ...('erros' in direitos ? direitos.erros : {}),
        ...direitosDoPdf,
      })
      return
    }
    setErros({})
    // Na criação, vazio não vai: a API só recebe o que foi preenchido.
    const corpo = {
      ...Object.fromEntries(
        Object.entries(r.corpo).filter(([, v]) => v !== null && !(Array.isArray(v) && !v.length)),
      ),
      ...direitos.corpo,
    }
    void criarEAnexar(corpo)
  }

  /** Cria e, se houve PDF escolhido, anexa a ele a música recém-criada (que só agora tem um id). */
  async function criarEAnexar(corpo: Record<string, unknown>) {
    let criado: { id: string }
    try {
      criado = await criar.mutateAsync(corpo)
    } catch {
      return // `criar.error` mostra o motivo na tela.
    }
    let texto = `${def.artigo === 'a' ? 'Nova' : 'Novo'} ${def.singular} salv${def.artigo}`
    if (pdf) {
      try {
        await anexar.mutateAsync({ musicaId: criado.id, pdf })
      } catch {
        // A música já existe: não se perde o trabalho. A pessoa anexa de novo na edição.
        texto = 'A música foi salva, mas o PDF não foi anexado. Abra a música e anexe de novo.'
      }
    }
    mostrarToast({ texto })
    router.replace({
      pathname: '/conteudos/[tipo]/[itemId]',
      params: { tipo: def.tipo, itemId: criado.id },
    })
  }

  return (
    <Tela
      pilha
      titulo={titulo}
      {...(def.tipo === 'musicas'
        ? { descricao: 'Depois de salvar, você escolhe quem toca esta música.' }
        : {})}
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Salvar"
            tamanho="grande"
            carregando={criar.isPending || anexar.isPending}
            aoPressionar={salvar}
          />
        </BarraDeAcao>
      }
    >
      <CartaoDeVidro opaco intervalo={ESPACO.e16}>
        <Formulario def={def} valores={valores} aoMudar={setValores} erros={erros} />
      </CartaoDeVidro>
      {def.tipo === 'musicas' ? (
        <CampoDePdf
          atual={null}
          escolhido={pdf ? { nome: pdf.nome, tamanho: pdf.bytes.length } : null}
          ocupado={anexar.isPending ? 'enviando' : null}
          erro={erroDoPdf}
          confirmada={valores[CAMPO_DA_CONFIRMACAO] === 'sim'}
          aoConfirmar={(sim) =>
            setValores({ ...valores, [CAMPO_DA_CONFIRMACAO]: sim ? 'sim' : 'nao' })
          }
          erroDaConfirmacao={erros[CAMPO_DA_CONFIRMACAO] ?? null}
          aoSemAceite={() =>
            setErros({ ...erros, [CAMPO_DA_CONFIRMACAO]: MENSAGEM_DE_CONFIRMAR_O_PDF })
          }
          avisoJaNaTela={(valores['cifra'] ?? '').trim() !== ''}
          caixaJaNaTela={exigeConfirmarDireitos(def, valores, null)}
          aoEscolher={() => void escolherPdf()}
          aoRemover={() => {
            setPdf(null)
            setErroDoPdf(null)
          }}
        />
      ) : null}
      {criar.error ? <Erro titulo="Não deu para salvar" erro={criar.error} /> : null}
    </Tela>
  )
}

function Item({
  comunidadeId,
  def,
  itemId,
}: {
  comunidadeId: string
  def: DefinicaoDoTipo
  itemId: string
}) {
  const pode = usePode()
  const item = useConteudo(comunidadeId, def.tipo, itemId)
  const [editando, setEditando] = useState(false)
  if (item.isPending) {
    return (
      <Tela pilha titulo={def.plural}>
        <Esqueleto rotulo={`Carregando ${def.artigo} ${def.singular}`}>
          <LinhaDeEsqueleto altura={88} />
          <LinhaDeEsqueleto altura={56} />
          <LinhaDeEsqueleto altura={56} />
        </Esqueleto>
      </Tela>
    )
  }
  if (item.error) {
    return (
      <Tela pilha titulo={def.plural}>
        <ErroDaTela
          erro={item.error}
          titulo={`Não deu para abrir ${def.artigo} ${def.singular}`}
          aoTentarDeNovo={() => void item.refetch()}
        />
      </Tela>
    )
  }
  const registro = item.data as unknown as Record<string, unknown>
  const gerencia = pode('conteudo', 'gerenciar')
  if (gerencia && editando) {
    return (
      <Edicao
        comunidadeId={comunidadeId}
        def={def}
        registro={registro}
        aoTerminar={() => setEditando(false)}
      />
    )
  }
  const musica = def.tipo === 'musicas' ? (item.data as unknown as Musica) : null
  return (
    <Tela
      pilha
      titulo={String(registro[def.principal] ?? '')}
      {...(gerencia
        ? {
            barraDeAcao: (
              <BarraDeAcao>
                <Botao
                  titulo="Editar"
                  icone="editar"
                  tamanho="grande"
                  rotuloAcessivel={`Editar ${def.artigo} ${def.singular}`}
                  aoPressionar={() => setEditando(true)}
                />
              </BarraDeAcao>
            ),
          }
        : {})}
    >
      {estaArquivado(def, registro) ? <Chip texto={def.arquivo.selo} tom="neutro" /> : null}
      {/* Quem gerencia escolhe os músicos no cartão próprio; para os demais, é uma linha dos detalhes. */}
      <Leitura
        comunidadeId={comunidadeId}
        def={def}
        registro={registro}
        musica={gerencia ? null : musica}
      />
      {musica && gerencia ? <QuemToca comunidadeId={comunidadeId} musica={musica} /> : null}
    </Tela>
  )
}

/** Campo curto o bastante para ir como valor à direita da linha ("G", "45 min"). */
const ehCurto = (c: DefinicaoDeCampo) =>
  c.formato === 'numero' || c.formato === 'duracao' || c.max <= 12

/**
 * Leitura (3.7.3): cartão lista "Detalhes" (campos curtos, o link com
 * `arrow.up.right` e quem toca) e um cartão por texto longo, em `leitura`.
 */
function Leitura({
  comunidadeId,
  def,
  registro,
  musica,
}: {
  comunidadeId: string
  def: DefinicaoDoTipo
  registro: Record<string, unknown>
  /** Música lida por quem não gerencia: "Quem toca" entra como linha dos detalhes. */
  musica: Musica | null
}) {
  const preenchidos = def.campos.filter(
    (c) => c.campo !== def.principal && textoParaMostrar(c, registro[c.campo]),
  )
  const detalhes = preenchidos.filter((c) => !c.multilinha)
  const textos = preenchidos.filter((c) => c.multilinha)
  const quemToca = musica
  // PDF anexado (D76): primeiro na tela, porque é o que o músico abre. A cifra em texto, se houver,
  // vem logo abaixo: as duas opções ficam à mão.
  const pdf =
    def.tipo === 'musicas' ? ((registro['pdf'] as ResumoDoPdf | null | undefined) ?? null) : null
  const cartaoDoPdf = pdf ? (
    <CartaoDoPdf
      comunidadeId={comunidadeId}
      musicaId={String(registro['id'])}
      titulo={String(registro[def.principal] ?? '')}
      pdf={pdf}
    />
  ) : null

  if (!preenchidos.length && !quemToca) {
    if (cartaoDoPdf) return cartaoDoPdf
    return (
      <Texto variante="corpo" cor="textoSuave">
        Sem mais detalhes cadastrados.
      </Texto>
    )
  }

  return (
    <>
      {cartaoDoPdf}
      {detalhes.length || quemToca ? (
        <Secao titulo="Detalhes">
          <CartaoDeVidro lista>
            <Lista>
              {detalhes.map((c) => {
                const texto = textoParaMostrar(c, registro[c.campo])
                if (c.formato === 'link') {
                  return (
                    <LinhaDeLista
                      key={c.campo}
                      icone="link"
                      titulo="Abrir o link"
                      descricao={texto}
                      externo
                      rotuloAcessivel={`Abrir o link: ${texto}`}
                      aoPressionar={() => void abrirLink(texto)}
                    />
                  )
                }
                const comUnidade = c.formato === 'numero' ? `${texto} ${c.unidade ?? 'min'}` : texto
                return ehCurto(c) ? (
                  <LinhaDeLista key={c.campo} titulo={c.rotulo} valor={comUnidade} />
                ) : (
                  <LinhaDeLista key={c.campo} titulo={c.rotulo} descricao={comUnidade} />
                )
              })}
              {quemToca ? (
                <LinhaDeLista
                  key="quem-toca"
                  icone="pessoa"
                  titulo="Quem toca"
                  descricao={
                    quemToca.musicos.length
                      ? quemToca.musicos.map((m) => m.nome).join(', ')
                      : 'Ninguém marcado para tocar esta música ainda.'
                  }
                />
              ) : null}
            </Lista>
          </CartaoDeVidro>
        </Secao>
      ) : null}
      {textos.map((c) =>
        // Cifra em ChordPro: leitor com tom, capotraste e letra grande. O resto, texto simples.
        c.formato === 'cifra' && detectarFormato(textoDoCampo(registro[c.campo])) === 'chordpro' ? (
          <LeitorDeCifra
            key={c.campo}
            cifra={textoDoCampo(registro[c.campo])}
            tomOriginal={textoDoCampo(registro['tom']) || null}
          />
        ) : (
          <CartaoDeVidro key={c.campo} sobrancelha={c.rotulo}>
            <Texto variante="leitura" selectable>
              {textoDoCampo(registro[c.campo])}
            </Texto>
          </CartaoDeVidro>
        ),
      )}
    </>
  )
}

/**
 * Edição: o formulário num cartão opaco, "Cancelar" e "Salvar alterações" na
 * barra de ação, e arquivar e excluir isolados num cartão lista.
 */
function Edicao({
  comunidadeId,
  def,
  registro,
  aoTerminar,
}: {
  comunidadeId: string
  def: DefinicaoDoTipo
  registro: Record<string, unknown>
  aoTerminar: () => void
}) {
  const [valores, setValores] = useState<Valores>(() =>
    Object.fromEntries(def.campos.map((c) => [c.campo, textoParaMostrar(c, registro[c.campo])])),
  )
  const cifraSalva = def.tipo === 'musicas' ? textoDoCampo(registro['cifra']) : null
  const [erros, setErros] = useState<Record<string, string>>({})
  const editar = useEditarConteudo(comunidadeId, def.tipo)
  const excluir = useExcluirConteudo(comunidadeId, def.tipo)
  const anexar = useAnexarPdf(comunidadeId)
  const removerPdf = useRemoverPdf(comunidadeId)
  const [erroDoPdf, setErroDoPdf] = useState<string | null>(null)
  const pdfAtual =
    def.tipo === 'musicas' ? ((registro['pdf'] as ResumoDoPdf | null | undefined) ?? null) : null
  const id = String(registro['id'])
  const versao = Number(registro['versao'])
  const arquivado = estaArquivado(def, registro)
  const nome = String(registro[def.principal] ?? '')
  // Arquivar e salvar usam a mesma mutação: o corpo diz qual das duas está em curso.
  const alternando =
    editar.isPending && !!editar.variables && def.arquivo.campo in editar.variables.corpo

  function salvar() {
    const r = montarCorpo(def, valores)
    const direitos = conferirDireitos(def, valores, cifraSalva)
    if ('erros' in r || 'erros' in direitos) {
      setErros({ ...('erros' in r ? r.erros : {}), ...('erros' in direitos ? direitos.erros : {}) })
      return
    }
    setErros({})
    editar.mutate(
      { id, versao, corpo: { ...r.corpo, ...direitos.corpo } },
      {
        onSuccess: () => {
          mostrarToast({ texto: 'Alterações salvas' })
          aoTerminar()
        },
      },
    )
  }

  /** Anexar e trocar o PDF são ações à parte do "Salvar alterações": valem na hora, com o aceite. */
  async function escolherPdf() {
    setErroDoPdf(null)
    const r = await escolherEConferirPdf()
    if (!r) return
    if ('erro' in r) {
      setErroDoPdf(r.erro)
      return
    }
    anexar.mutate(
      { musicaId: id, pdf: r.pdf },
      {
        onSuccess: () => mostrarToast({ texto: pdfAtual ? 'PDF trocado' : 'PDF anexado' }),
        onError: (e) => setErroDoPdf(mensagemDoErro(e)),
      },
    )
  }

  async function pedirRemocaoDoPdf() {
    setErroDoPdf(null)
    const ok = await confirmar({
      titulo: 'Remover o PDF?',
      mensagem:
        'O PDF sai desta música para toda a comunidade. A cifra em texto continua, se houver. Para voltar a ter o PDF, será preciso anexá-lo de novo.',
      confirmar: 'Remover o PDF',
      destrutivo: true,
    })
    if (!ok) return
    removerPdf.mutate(id, {
      onSuccess: () => mostrarToast({ texto: 'PDF removido' }),
      onError: (e) => setErroDoPdf(mensagemDoErro(e)),
    })
  }

  function alternarArquivo() {
    const corpo =
      def.arquivo.campo === 'arquivada' ? { arquivada: !arquivado } : { ativo: arquivado }
    editar.mutate(
      { id, versao, corpo },
      {
        onSuccess: () =>
          mostrarToast({
            texto: arquivado
              ? 'De volta à lista'
              : `Marcad${def.artigo} como ${def.arquivo.selo.toLowerCase()}`,
          }),
      },
    )
  }

  async function pedirExclusao() {
    const ok = await confirmar({
      titulo: `Excluir ${nome}?`,
      mensagem: `${def.artigo === 'a' ? 'A' : 'O'} ${def.singular} some da lista para todos. Se só não for mais usad${def.artigo}, prefira "${def.arquivo.arquivarRotulo.toLowerCase()}".`,
      confirmar: 'Excluir',
      destrutivo: true,
    })
    if (ok) excluir.mutate(id, { onSuccess: () => voltarOu('/conteudos') })
  }

  return (
    <Tela
      pilha
      titulo={nome}
      descricao={`Editando ${def.artigo} ${def.singular}`}
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Cancelar"
            variante="secundario"
            tamanho="grande"
            desabilitado={editar.isPending}
            aoPressionar={aoTerminar}
          />
          <Botao
            titulo="Salvar alterações"
            tamanho="grande"
            carregando={editar.isPending && !alternando}
            aoPressionar={salvar}
          />
        </BarraDeAcao>
      }
    >
      <CartaoDeVidro opaco intervalo={ESPACO.e16}>
        <Formulario
          def={def}
          valores={valores}
          aoMudar={setValores}
          erros={erros}
          cifraSalva={cifraSalva}
        />
      </CartaoDeVidro>
      {def.tipo === 'musicas' ? (
        <CampoDePdf
          atual={pdfAtual}
          escolhido={null}
          ocupado={anexar.isPending ? 'enviando' : removerPdf.isPending ? 'removendo' : null}
          erro={erroDoPdf}
          confirmada={valores[CAMPO_DA_CONFIRMACAO] === 'sim'}
          aoConfirmar={(sim) =>
            setValores({ ...valores, [CAMPO_DA_CONFIRMACAO]: sim ? 'sim' : 'nao' })
          }
          erroDaConfirmacao={erros[CAMPO_DA_CONFIRMACAO] ?? null}
          aoSemAceite={() =>
            setErros({ ...erros, [CAMPO_DA_CONFIRMACAO]: MENSAGEM_DE_CONFIRMAR_O_PDF })
          }
          avisoJaNaTela={(valores['cifra'] ?? '').trim() !== ''}
          caixaJaNaTela={exigeConfirmarDireitos(def, valores, cifraSalva)}
          aoEscolher={() => void escolherPdf()}
          aoRemover={() => void pedirRemocaoDoPdf()}
        />
      ) : null}
      {editar.error ? <Erro titulo="Não deu para salvar" erro={editar.error} /> : null}
      {excluir.error ? <Erro titulo="Não deu para excluir" erro={excluir.error} /> : null}
      <CartaoDeVidro lista opaco>
        <Lista>
          <LinhaDeLista
            icone={arquivado ? 'confirmado' : 'material'}
            titulo={arquivado ? def.arquivo.reativarRotulo : def.arquivo.arquivarRotulo}
            semSeta
            aoPressionar={editar.isPending ? undefined : alternarArquivo}
          />
          <LinhaDeLista
            icone="excluir"
            titulo="Excluir"
            destrutivo
            rotuloAcessivel={`Excluir ${nome}`}
            aoPressionar={excluir.isPending ? undefined : () => void pedirExclusao()}
          />
        </Lista>
      </CartaoDeVidro>
    </Tela>
  )
}

/** Quem toca a música: a organização marca os músicos cadastrados e salva. */
function QuemToca({ comunidadeId, musica }: { comunidadeId: string; musica: Musica }) {
  const musicos = useConteudos(comunidadeId, 'musicos' satisfies TipoDeConteudo)
  const [marcados, setMarcados] = useState<string[]>(() => musica.musicos.map((m) => m.id))
  const definir = useDefinirMusicos(comunidadeId)
  const mudou =
    marcados.length !== musica.musicos.length ||
    marcados.some((id) => !musica.musicos.some((m) => m.id === id))

  if (musicos.isPending) {
    return (
      <Esqueleto rotulo="Carregando os músicos">
        <LinhasDeEsqueleto />
      </Esqueleto>
    )
  }
  if (musicos.error) {
    return (
      <Aviso
        tipo={musicos.error instanceof SemConexao ? 'alerta' : 'erro'}
        titulo="Não deu para carregar os músicos"
        anunciar
        acao={{ titulo: 'Tentar de novo', aoPressionar: () => void musicos.refetch() }}
      >
        {mensagemDoErro(musicos.error)}
      </Aviso>
    )
  }
  if (musicos.data.length === 0) {
    return (
      <EstadoVazio
        icone="pessoa"
        titulo="Quem toca"
        descricao="Cadastre os músicos da comunidade para marcar quem toca esta música."
        acao={{
          titulo: 'Adicionar músico',
          icone: 'adicionar',
          variante: 'secundario',
          aoPressionar: () =>
            router.push({ pathname: '/conteudos/[tipo]/novo', params: { tipo: 'musicos' } }),
        }}
      />
    )
  }
  return (
    <CartaoDeVidro
      sobrancelha="Quem toca"
      opaco
      intervalo={0}
      acoes={
        <Botao
          titulo="Salvar quem toca"
          variante="secundario"
          desabilitado={!mudou}
          motivo="Marque ou desmarque alguém para salvar."
          carregando={definir.isPending}
          aoPressionar={() =>
            definir.mutate(
              { musicaId: musica.id, musicoIds: marcados },
              { onSuccess: () => mostrarToast({ texto: 'Quem toca foi salvo' }) },
            )
          }
        />
      }
    >
      {musicos.data.map((m) => (
        <CaixaDeMarcar
          key={m.id}
          rotulo={m.nome}
          {...(m.instrumentos?.length ? { descricao: m.instrumentos.join(', ') } : {})}
          marcada={marcados.includes(m.id)}
          aoMudar={(sim) =>
            setMarcados((atual) => (sim ? [...atual, m.id] : atual.filter((x) => x !== m.id)))
          }
        />
      ))}
      {definir.error ? <Erro titulo="Não deu para salvar quem toca" erro={definir.error} /> : null}
    </CartaoDeVidro>
  )
}
