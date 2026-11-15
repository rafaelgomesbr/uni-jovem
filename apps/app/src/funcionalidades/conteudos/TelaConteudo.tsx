import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
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
import { CartaoDeEsqueleto, Esqueleto, LinhasDeEsqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { voltarOu } from '@/ui/navegacao'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import {
  useConteudo,
  useConteudos,
  useCriarConteudo,
  useDefinirMusicos,
  useEditarConteudo,
  useExcluirConteudo,
} from './consultas'
import {
  ehTipoDeConteudo,
  estaArquivado,
  montarCorpo,
  textoDoCampo,
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
      <Tela pilha titulo="Conteúdo">
        <SemComunidade oQue="o conteúdo" />
      </Tela>
    )
  }
  if (!ehTipoDeConteudo(tipo)) {
    return (
      <Tela pilha titulo="Conteúdo">
        <EstadoVazio
          icone="erro"
          titulo="Conteúdo não encontrado"
          descricao="Volte para a lista de conteúdos e escolha de novo."
          acao={{ titulo: 'Ver conteúdos', aoPressionar: () => router.replace('/conteudos') }}
        />
      </Tela>
    )
  }
  const def = TIPOS_DE_CONTEUDO[tipo]
  if (novo) return <Novo comunidadeId={comunidadeAtiva.id} def={def} />
  if (!itemId)
    return (
      <Tela pilha titulo="Conteúdo">
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
}: {
  def: DefinicaoDoTipo
  valores: Valores
  aoMudar: (v: Valores) => void
  erros: Record<string, string>
}) {
  return (
    <>
      {def.campos.map((c) => (
        <Campo
          key={c.campo}
          rotulo={c.rotulo}
          opcional={!c.obrigatorio}
          value={valores[c.campo] ?? ''}
          onChangeText={(t) => aoMudar({ ...valores, [c.campo]: t })}
          erro={erros[c.campo] ?? null}
          {...(c.ajuda ? { ajuda: c.ajuda } : {})}
          multiline={!!c.multilinha}
          {...(c.formato === 'numero' ? { inputMode: 'numeric' as const, sufixo: 'min' } : {})}
          {...(c.formato === 'link'
            ? { inputMode: 'url' as const, autoCapitalize: 'none' as const }
            : {})}
          maxLength={c.formato === 'numero' ? 3 : c.max}
        />
      ))}
    </>
  )
}

function Erro({ titulo, erro }: { titulo: string; erro: unknown }) {
  return (
    <Aviso tipo="erro" titulo={titulo} anunciar>
      {mensagemDoErro(erro)}
    </Aviso>
  )
}

function Novo({ comunidadeId, def }: { comunidadeId: string; def: DefinicaoDoTipo }) {
  const pode = usePode()
  const [valores, setValores] = useState<Valores>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const criar = useCriarConteudo(comunidadeId, def.tipo)
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
      {...(def.tipo === 'musicas'
        ? { descricao: 'Depois de salvar, você escolhe quem toca esta música.' }
        : {})}
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
          <CartaoDeEsqueleto titulo />
        </Esqueleto>
      </Tela>
    )
  }
  if (item.error) {
    return (
      <Tela pilha titulo={def.plural}>
        <EstadoVazio
          icone={item.error instanceof SemConexao ? 'semConexao' : 'erro'}
          titulo={`Não deu para abrir ${def.artigo} ${def.singular}`}
          descricao={mensagemDoErro(item.error)}
          acao={{ titulo: 'Tentar de novo', aoPressionar: () => void item.refetch() }}
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
      <Leitura def={def} registro={registro} musica={gerencia ? null : musica} />
      {musica && gerencia ? <QuemToca comunidadeId={comunidadeId} musica={musica} /> : null}
    </Tela>
  )
}

/** Campo curto o bastante para ir como valor à direita da linha ("G", "45 min"). */
const ehCurto = (c: DefinicaoDeCampo) => c.formato === 'numero' || c.max <= 12

/**
 * Leitura (3.7.3): cartão lista "Detalhes" (campos curtos, o link com
 * `arrow.up.right` e quem toca) e um cartão por texto longo, em `leitura`.
 */
function Leitura({
  def,
  registro,
  musica,
}: {
  def: DefinicaoDoTipo
  registro: Record<string, unknown>
  /** Música lida por quem não gerencia: "Quem toca" entra como linha dos detalhes. */
  musica: Musica | null
}) {
  const preenchidos = def.campos.filter(
    (c) => c.campo !== def.principal && textoDoCampo(registro[c.campo]),
  )
  const detalhes = preenchidos.filter((c) => !c.multilinha)
  const textos = preenchidos.filter((c) => c.multilinha)
  const quemToca = musica

  if (!preenchidos.length && !quemToca) {
    return (
      <Texto variante="corpo" cor="textoSuave">
        Sem mais detalhes cadastrados.
      </Texto>
    )
  }

  return (
    <>
      {detalhes.length || quemToca ? (
        <Secao titulo="Detalhes">
          <CartaoDeVidro lista>
            <Lista>
              {detalhes.map((c) => {
                const texto = textoDoCampo(registro[c.campo])
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
                const comUnidade = c.formato === 'numero' ? `${texto} min` : texto
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
      {textos.map((c) => (
        <CartaoDeVidro key={c.campo} sobrancelha={c.rotulo}>
          <Texto variante="leitura" selectable>
            {textoDoCampo(registro[c.campo])}
          </Texto>
        </CartaoDeVidro>
      ))}
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
    Object.fromEntries(def.campos.map((c) => [c.campo, textoDoCampo(registro[c.campo])])),
  )
  const [erros, setErros] = useState<Record<string, string>>({})
  const editar = useEditarConteudo(comunidadeId, def.tipo)
  const excluir = useExcluirConteudo(comunidadeId, def.tipo)
  const id = String(registro['id'])
  const versao = Number(registro['versao'])
  const arquivado = estaArquivado(def, registro)
  const nome = String(registro[def.principal] ?? '')
  // Arquivar e salvar usam a mesma mutação: o corpo diz qual das duas está em curso.
  const alternando =
    editar.isPending && !!editar.variables && def.arquivo.campo in editar.variables.corpo

  function salvar() {
    const r = montarCorpo(def, valores)
    if ('erros' in r) {
      setErros(r.erros)
      return
    }
    setErros({})
    editar.mutate(
      { id, versao, corpo: r.corpo },
      {
        onSuccess: () => {
          mostrarToast({ texto: 'Alterações salvas' })
          aoTerminar()
        },
      },
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
        <Formulario def={def} valores={valores} aoMudar={setValores} erros={erros} />
      </CartaoDeVidro>
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
