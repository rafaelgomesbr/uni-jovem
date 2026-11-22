import { detectarFormato, linksAbriveisDaMusica, type LinkDaMusica } from '@uj/dominio'
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
import { LeitorDeCifra } from '../repertorio/LeitorDeCifra'
import { CampoDePdf, MENSAGEM_DE_CONFIRMAR_O_PDF } from './CampoDePdf'
import {
  CamposDaMusicaNova,
  conferirDireitos,
  Erro,
  escolherEConferirPdf,
  Formulario,
  useFormularioDeMusica,
  type Valores,
} from './FormularioDeConteudo'
import { LinksDaMusica } from './LinksDaMusica'
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

function Novo({ comunidadeId, def }: { comunidadeId: string; def: DefinicaoDoTipo }) {
  // Música tem PDF e links, e o formulário é o mesmo da folha do repertório; os outros tipos, não.
  return def.tipo === 'musicas' ? (
    <NovaMusica comunidadeId={comunidadeId} def={def} />
  ) : (
    <NovoConteudo comunidadeId={comunidadeId} def={def} />
  )
}

function SoAOrganizacaoCadastra({ titulo }: { titulo: string }) {
  return (
    <Tela pilha titulo={titulo}>
      <Aviso tipo="alerta" titulo="Só a organização cadastra">
        Organizadores e administradores cadastram conteúdos. Você pode consultar a lista.
      </Aviso>
    </Tela>
  )
}

function NovoConteudo({ comunidadeId, def }: { comunidadeId: string; def: DefinicaoDoTipo }) {
  const pode = usePode()
  const [valores, setValores] = useState<Valores>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const criar = useCriarConteudo(comunidadeId, def.tipo)
  const titulo = `Nov${def.artigo} ${def.singular}`
  if (!pode('conteudo', 'gerenciar')) return <SoAOrganizacaoCadastra titulo={titulo} />

  function salvar() {
    const r = montarCorpo(def, valores)
    if ('erros' in r) {
      setErros(r.erros)
      return
    }
    setErros({})
    // Na criação, vazio não vai: a API só recebe o que foi preenchido.
    const corpo = Object.fromEntries(
      Object.entries(r.corpo).filter(([, v]) => v !== null && !(Array.isArray(v) && !v.length)),
    )
    criar.mutate(corpo, {
      onSuccess: (criado) => {
        mostrarToast({
          texto: `${def.artigo === 'a' ? 'Nova' : 'Novo'} ${def.singular} salv${def.artigo}`,
        })
        router.replace({
          pathname: '/conteudos/[tipo]/[itemId]',
          params: { tipo: def.tipo, itemId: criado.id },
        })
      },
    })
  }

  return (
    <Tela
      pilha
      titulo={titulo}
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Salvar"
            tamanho="grande"
            carregando={criar.isPending}
            aoPressionar={salvar}
          />
        </BarraDeAcao>
      }
    >
      <CartaoDeVidro opaco intervalo={ESPACO.e16}>
        <Formulario def={def} valores={valores} aoMudar={setValores} erros={erros} />
      </CartaoDeVidro>
      {criar.error ? <Erro titulo="Não deu para salvar" erro={criar.error} /> : null}
    </Tela>
  )
}

function NovaMusica({ comunidadeId, def }: { comunidadeId: string; def: DefinicaoDoTipo }) {
  const pode = usePode()
  const form = useFormularioDeMusica()
  const criar = useCriarConteudo(comunidadeId, def.tipo)
  const anexar = useAnexarPdf(comunidadeId)
  const titulo = `Nov${def.artigo} ${def.singular}`
  if (!pode('conteudo', 'gerenciar')) return <SoAOrganizacaoCadastra titulo={titulo} />

  function salvar() {
    const corpo = form.preparar()
    if (corpo) void criarEAnexar(corpo)
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
    if (form.pdf) {
      try {
        await anexar.mutateAsync({ musicaId: criado.id, pdf: form.pdf })
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
      descricao="Depois de salvar, você escolhe quem toca esta música."
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
      <CamposDaMusicaNova form={form} enviandoPdf={anexar.isPending} />
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
  // Os links têm a seção própria, com os botões "Abrir no YouTube" e "Abrir no Drive" (D80).
  const preenchidos = def.campos.filter(
    (c) =>
      c.campo !== def.principal && c.formato !== 'links' && textoParaMostrar(c, registro[c.campo]),
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

  const links =
    def.tipo === 'musicas' ? (registro['links'] as LinkDaMusica[] | undefined) : undefined
  const cartaoDosLinks =
    linksAbriveisDaMusica(links).length > 0 ? (
      <CartaoDeVidro sobrancelha="Links">
        <LinksDaMusica links={links} musica={String(registro[def.principal] ?? '')} />
      </CartaoDeVidro>
    ) : null
  // O link único de antes (qualquer endereço https): só leitura, até a organização apagá-lo na edição.
  const linkAntigo =
    def.tipo === 'musicas' && typeof registro['link'] === 'string' ? registro['link'] : ''

  if (!preenchidos.length && !quemToca && !linkAntigo) {
    if (cartaoDoPdf || cartaoDosLinks) {
      return (
        <>
          {cartaoDoPdf}
          {cartaoDosLinks}
        </>
      )
    }
    return (
      <Texto variante="corpo" cor="textoSuave">
        Sem mais detalhes cadastrados.
      </Texto>
    )
  }

  return (
    <>
      {cartaoDoPdf}
      {cartaoDosLinks}
      {detalhes.length || quemToca || linkAntigo ? (
        <Secao titulo="Detalhes">
          <CartaoDeVidro lista>
            <Lista>
              {detalhes.map((c) => {
                const texto = textoParaMostrar(c, registro[c.campo])
                const comUnidade = c.formato === 'numero' ? `${texto} ${c.unidade ?? 'min'}` : texto
                return ehCurto(c) ? (
                  <LinhaDeLista key={c.campo} titulo={c.rotulo} valor={comUnidade} />
                ) : (
                  <LinhaDeLista key={c.campo} titulo={c.rotulo} descricao={comUnidade} />
                )
              })}
              {linkAntigo ? (
                <LinhaDeLista
                  key="link-antigo"
                  icone="link"
                  titulo="Abrir o link antigo"
                  descricao={linkAntigo}
                  externo
                  rotuloAcessivel={`Abrir o link antigo: ${linkAntigo}`}
                  aoPressionar={() => void abrirLink(linkAntigo)}
                />
              ) : null}
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
  const linkAntigo =
    def.tipo === 'musicas' && typeof registro['link'] === 'string' ? registro['link'] : ''
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

  /** O link único de antes (qualquer https) só sai por aqui: os links novos moram em "Links". */
  function removerLinkAntigo() {
    editar.mutate(
      { id, versao, corpo: { link: null } },
      { onSuccess: () => mostrarToast({ texto: 'Link antigo removido' }) },
    )
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
      {linkAntigo ? (
        <CartaoDeVidro opaco sobrancelha="Link antigo" intervalo={ESPACO.e12}>
          <Texto variante="corpo">{linkAntigo}</Texto>
          <Texto variante="meta" cor="textoSuave">
            Esta música tem um link de antes dos links do Drive e do YouTube. Ele continua aqui só
            para ler. Remova quando quiser.
          </Texto>
          <Botao
            titulo="Remover o link antigo"
            icone="excluir"
            variante="secundario"
            tamanho="medio"
            desabilitado={editar.isPending}
            aoPressionar={removerLinkAntigo}
          />
        </CartaoDeVidro>
      ) : null}
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
