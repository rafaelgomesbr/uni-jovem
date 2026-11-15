import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import type { Musica, TipoDeConteudo } from '@/servicos/contratoDosModulos'
import { abrirLink } from '@/utilidades/compartilhar'
import { confirmar } from '@/utilidades/confirmar'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'

import { usePode } from '../comunidade/permissoes'
import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
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
  type DefinicaoDoTipo,
} from './tipos'

/** Rotas `/conteudos/[tipo]/[itemId]` e `/conteudos/[tipo]/novo`. */
export function TelaConteudo({ novo = false }: { novo?: boolean }) {
  const params = useLocalSearchParams<{ tipo: string; itemId?: string }>()
  const tipo = parametro(params.tipo)
  const itemId = novo ? null : parametro(params.itemId)
  return (
    <TelaDaComunidade oQue="o conteúdo">
      {(c) =>
        ehTipoDeConteudo(tipo) ? (
          novo ? (
            <Novo comunidadeId={c.id} def={TIPOS_DE_CONTEUDO[tipo]} />
          ) : itemId ? (
            <Item comunidadeId={c.id} def={TIPOS_DE_CONTEUDO[tipo]} itemId={itemId} />
          ) : null
        ) : (
          <Aviso tipo="alerta" titulo="Conteúdo não encontrado">
            Volte para a lista de conteúdos e escolha de novo.
          </Aviso>
        )
      }
    </TelaDaComunidade>
  )
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
          rotulo={c.obrigatorio ? c.rotulo : `${c.rotulo} (opcional)`}
          value={valores[c.campo] ?? ''}
          onChangeText={(t) => aoMudar({ ...valores, [c.campo]: t })}
          erro={erros[c.campo] ?? null}
          {...(c.ajuda ? { ajuda: c.ajuda } : {})}
          multiline={!!c.multilinha}
          {...(c.formato === 'numero' ? { inputMode: 'numeric' as const } : {})}
          {...(c.formato === 'link'
            ? { inputMode: 'url' as const, autoCapitalize: 'none' as const }
            : {})}
          maxLength={c.formato === 'numero' ? 3 : c.max}
        />
      ))}
    </>
  )
}

function Novo({ comunidadeId, def }: { comunidadeId: string; def: DefinicaoDoTipo }) {
  const pode = usePode()
  const [valores, setValores] = useState<Valores>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const criar = useCriarConteudo(comunidadeId, def.tipo)
  if (!pode('conteudo', 'gerenciar')) {
    return (
      <Aviso tipo="alerta" titulo="Só a organização cadastra">
        Organizadores e administradores cadastram conteúdos. Você pode consultar a lista.
      </Aviso>
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
      onSuccess: (novo) =>
        router.replace({
          pathname: '/conteudos/[tipo]/[itemId]',
          params: { tipo: def.tipo, itemId: novo.id },
        }),
    })
  }

  return (
    <>
      <Texto variante="titulo">
        Nov{def.artigo} {def.singular}
      </Texto>
      <Cartao>
        <Formulario def={def} valores={valores} aoMudar={setValores} erros={erros} />
      </Cartao>
      {def.tipo === 'musicas' ? (
        <Texto variante="apoio" cor="textoSuave">
          Depois de salvar, você escolhe quem toca esta música.
        </Texto>
      ) : null}
      {criar.error ? <AvisoDeErro erro={criar.error} /> : null}
      <Botao titulo="Salvar" carregando={criar.isPending} aoPressionar={salvar} />
    </>
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
  if (item.isPending) return <Carregando texto={`Carregando ${def.artigo} ${def.singular}`} />
  if (item.error) {
    return <AvisoDeErro erro={item.error} aoTentarDeNovo={() => void item.refetch()} />
  }
  const registro = item.data as unknown as Record<string, unknown>
  const gerencia = pode('conteudo', 'gerenciar')
  return (
    <>
      <View style={{ gap: ESPACO.x2 }}>
        <Texto variante="titulo">{String(registro[def.principal] ?? '')}</Texto>
        {estaArquivado(def, registro) ? <Selo texto={def.arquivo.selo} /> : null}
      </View>
      {gerencia ? (
        <Edicao key={item.data.versao} comunidadeId={comunidadeId} def={def} registro={registro} />
      ) : (
        <Leitura def={def} registro={registro} />
      )}
      {def.tipo === 'musicas' ? (
        <QuemToca
          comunidadeId={comunidadeId}
          musica={item.data as unknown as Musica}
          gerencia={gerencia}
        />
      ) : null}
    </>
  )
}

function Leitura({ def, registro }: { def: DefinicaoDoTipo; registro: Record<string, unknown> }) {
  const preenchidos = def.campos.filter(
    (c) => c.campo !== def.principal && textoDoCampo(registro[c.campo]),
  )
  return (
    <Cartao>
      {preenchidos.length === 0 ? (
        <Texto variante="apoio" cor="textoSuave">
          Sem mais detalhes cadastrados.
        </Texto>
      ) : (
        preenchidos.map((c) => (
          <View key={c.campo} style={{ gap: ESPACO.x1 }}>
            <Texto variante="rotulo" cor="textoSuave">
              {c.rotulo.toUpperCase()}
            </Texto>
            {c.formato === 'link' ? (
              <Botao
                titulo="Abrir o link"
                icone="link"
                variante="secundario"
                larguraTotal={false}
                rotuloAcessivel={`Abrir o link: ${textoDoCampo(registro[c.campo])}`}
                aoPressionar={() => void abrirLink(textoDoCampo(registro[c.campo]))}
              />
            ) : (
              <Texto selectable>
                {textoDoCampo(registro[c.campo])}
                {c.formato === 'numero' ? ' min' : ''}
              </Texto>
            )}
          </View>
        ))
      )}
    </Cartao>
  )
}

function Edicao({
  comunidadeId,
  def,
  registro,
}: {
  comunidadeId: string
  def: DefinicaoDoTipo
  registro: Record<string, unknown>
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

  function salvar() {
    const r = montarCorpo(def, valores)
    if ('erros' in r) {
      setErros(r.erros)
      return
    }
    setErros({})
    editar.mutate({ id, versao, corpo: r.corpo })
  }

  function alternarArquivo() {
    const corpo =
      def.arquivo.campo === 'arquivada' ? { arquivada: !arquivado } : { ativo: arquivado }
    editar.mutate({ id, versao, corpo })
  }

  async function pedirExclusao() {
    const ok = await confirmar({
      titulo: `Excluir ${nome}?`,
      mensagem: `${def.artigo === 'a' ? 'A' : 'O'} ${def.singular} some da lista para todos. Se só não for mais usad${def.artigo}, prefira "${def.arquivo.arquivarRotulo.toLowerCase()}".`,
      confirmar: 'Excluir',
      destrutivo: true,
    })
    if (ok) excluir.mutate(id, { onSuccess: () => router.back() })
  }

  return (
    <>
      <Cartao titulo="Editar" icone="editar">
        <Formulario def={def} valores={valores} aoMudar={setValores} erros={erros} />
        {editar.error ? <AvisoDeErro erro={editar.error} /> : null}
        <Botao titulo="Salvar alterações" carregando={editar.isPending} aoPressionar={salvar} />
      </Cartao>
      <Botao
        titulo={arquivado ? def.arquivo.reativarRotulo : def.arquivo.arquivarRotulo}
        icone={arquivado ? 'confirmado' : 'material'}
        variante="secundario"
        carregando={editar.isPending}
        aoPressionar={alternarArquivo}
      />
      {excluir.error ? <AvisoDeErro erro={excluir.error} /> : null}
      <Botao
        titulo="Excluir"
        icone="excluir"
        variante="perigo"
        carregando={excluir.isPending}
        rotuloAcessivel={`Excluir ${nome}`}
        aoPressionar={() => void pedirExclusao()}
      />
    </>
  )
}

/** Quem toca a música: leitura para membros; organização marca os músicos. */
function QuemToca({
  comunidadeId,
  musica,
  gerencia,
}: {
  comunidadeId: string
  musica: Musica
  gerencia: boolean
}) {
  const musicos = useConteudos(comunidadeId, 'musicos' satisfies TipoDeConteudo, gerencia)
  const [marcados, setMarcados] = useState<string[]>(() => musica.musicos.map((m) => m.id))
  const definir = useDefinirMusicos(comunidadeId)
  const mudou =
    marcados.length !== musica.musicos.length ||
    marcados.some((id) => !musica.musicos.some((m) => m.id === id))

  if (!gerencia) {
    return (
      <Cartao titulo="Quem toca" icone="pessoa">
        <Texto>
          {musica.musicos.length
            ? musica.musicos.map((m) => m.nome).join(', ')
            : 'Ninguém marcado para tocar esta música ainda.'}
        </Texto>
      </Cartao>
    )
  }
  return (
    <Cartao titulo="Quem toca" icone="pessoa">
      {musicos.isPending ? (
        <Carregando texto="Carregando os músicos" />
      ) : musicos.error ? (
        <AvisoDeErro erro={musicos.error} aoTentarDeNovo={() => void musicos.refetch()} />
      ) : musicos.data.length === 0 ? (
        <>
          <Texto variante="apoio" cor="textoSuave">
            Cadastre os músicos da comunidade para marcar quem toca.
          </Texto>
          <Botao
            titulo="Adicionar músico"
            icone="adicionar"
            variante="secundario"
            aoPressionar={() =>
              router.push({ pathname: '/conteudos/[tipo]/novo', params: { tipo: 'musicos' } })
            }
          />
        </>
      ) : (
        <>
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
          {definir.error ? <AvisoDeErro erro={definir.error} /> : null}
          <Botao
            titulo="Salvar quem toca"
            variante="secundario"
            desabilitado={!mudou}
            motivo="Marque ou desmarque alguém para salvar."
            carregando={definir.isPending}
            aoPressionar={() => definir.mutate({ musicaId: musica.id, musicoIds: marcados })}
          />
        </>
      )}
    </Cartao>
  )
}
