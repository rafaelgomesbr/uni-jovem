import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { api } from '@/servicos/api'
import type { DetalheDoEvento, TipoDeChecklist } from '@/servicos/contratoDosEventos'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo } from '@/ui/Campo'
import { AvisoDeFalha } from '@/ui/Falha'
import { FolhaNaTela } from '@/ui/FolhaNaTela'
import { LinhaDeLista } from '@/ui/LinhaDeLista'
import { Segmentos } from '@/ui/Segmentos'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { abrirLink } from '@/utilidades/compartilhar'
import { formatarQuando } from '@/utilidades/datas'

import { useMeuVinculo } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { useMarcarNoEvento } from '../offline/acoes'
import { MENSAGEM_EXIGE_CONEXAO } from '../offline/mensagens'
import type { ModoLocal } from '../offline/vistaLocal'
import { CartaoDePreparacao, ComRemover, type ItemDaPreparacao } from './CartaoDePreparacao'
import { useMudancaNoEvento, useRemocaoNoEvento } from './mutacoes'
import { NOME_DO_CHECKLIST } from './nomes'

interface Props {
  evento: DetalheDoEvento
  comunidadeId: string
}

const TIPOS: readonly TipoDeChecklist[] = ['preparacao', 'encerramento']

/** Checklists de preparação e de encerramento, num cartão só, com quem marcou. */
export function SecaoChecklist({
  evento,
  comunidadeId,
  local,
}: Props & {
  /** Cópia preparada, sem conexão: só marcar; criar e remover exigem internet. */
  local?: ModoLocal
}) {
  const pode = usePode()
  const euOnline = useMeuVinculo()
  const eu = local ? local.eu : euOnline
  const gerenciar = pode('checklist', 'gerenciar')
  const [novo, setNovo] = useState(false)
  const marcar = useMarcarNoEvento(comunidadeId, evento.id, 'checklist', {
    local: local !== undefined,
    eu,
  })
  const remover = useRemocaoNoEvento(comunidadeId, evento.id)
  if (!gerenciar && evento.checklist.length === 0) return null

  // Os dois tipos só ganham um rótulo de grupo quando aparecem juntos.
  const tiposComItens = TIPOS.filter((t) => evento.checklist.some((i) => i.tipo === t))
  const itens: ItemDaPreparacao[] = TIPOS.flatMap((tipo) => {
    const doTipo = evento.checklist.filter((i) => i.tipo === tipo)
    const feitos = doTipo.filter((i) => i.marcadoEm).length
    return doTipo.map((item, n) => {
      const podeMarcar = pode('checklist', 'marcar', {
        proprio: eu !== null && item.responsavelVinculoId === eu,
      })
      const descricao = [
        item.responsavelNome,
        podeMarcar ? null : 'Só a pessoa responsável ou a organização marca',
        local?.pendentes.has(item.id)
          ? 'Pendente de envio: feito neste aparelho, vai quando a internet voltar'
          : null,
      ]
        .filter(Boolean)
        .join('. ')
      return {
        chave: item.id,
        no: (editando: boolean) => (
          <View>
            {n === 0 && tiposComItens.length > 1 ? (
              <Texto
                variante="rotulo"
                cor="textoSuave"
                accessibilityRole="header"
                style={{ paddingTop: ESPACO.e8 }}
              >
                {`${NOME_DO_CHECKLIST[tipo]} · ${feitos} de ${doTipo.length}`}
              </Texto>
            ) : null}
            <ComRemover
              editando={editando}
              rotulo={`Remover o item ${item.texto}`}
              aoRemover={() => void remover.pedir(`checklist/${item.id}`, 'este item do checklist')}
            >
              <CaixaDeMarcar
                rotulo={item.texto}
                {...(descricao ? { descricao } : {})}
                marcada={item.marcadoEm !== null}
                desabilitada={!podeMarcar || marcar.isPending}
                aoMudar={(marcado) =>
                  marcar.mutate({ id: item.id, valor: marcado, rotulo: item.texto })
                }
              />
            </ComRemover>
          </View>
        ),
      }
    })
  })

  return (
    <>
      <CartaoDePreparacao
        sobrancelha="Checklist"
        vazio="Nenhum item ainda. Liste o que precisa estar pronto e o que fazer no fim."
        erro={marcar.error ?? remover.error}
        editavel={gerenciar && !local}
        adicionar={
          gerenciar
            ? local
              ? {
                  titulo: 'Adicionar item',
                  aoPressionar: () => undefined,
                  motivo: `${MENSAGEM_EXIGE_CONEXAO} Sem internet, dá para marcar e desmarcar.`,
                }
              : { titulo: 'Adicionar item', aoPressionar: () => setNovo(true) }
            : null
        }
        itens={itens}
      />
      {gerenciar && !local ? (
        <NovoItem
          evento={evento}
          comunidadeId={comunidadeId}
          aberta={novo}
          aoFechar={() => setNovo(false)}
        />
      ) : null}
    </>
  )
}

function NovoItem({
  evento,
  comunidadeId,
  aberta,
  aoFechar,
}: Props & { aberta: boolean; aoFechar: () => void }) {
  const [tipo, setTipo] = useState<TipoDeChecklist>('preparacao')
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const criar = useMudancaNoEvento(comunidadeId, evento.id, (base, corpo: object) =>
    api.post(`${base}/checklist`, corpo),
  )

  function salvar() {
    if (!texto.trim()) {
      setErro('Escreva o item.')
      return
    }
    setErro(null)
    criar.mutate(
      { tipo, texto: texto.trim() },
      {
        onSuccess: () => {
          mostrarToast({ texto: 'Item adicionado ao checklist.' })
          setTexto('')
          aoFechar()
        },
      },
    )
  }

  return (
    <FolhaNaTela aberta={aberta} titulo="Adicionar item" aoFechar={aoFechar}>
      <Segmentos
        rotulo="Checklist"
        valor={tipo}
        aoMudar={setTipo}
        segmentos={TIPOS.map((t) => ({ valor: t, rotulo: NOME_DO_CHECKLIST[t] }))}
      />
      <Campo
        rotulo="Item"
        value={texto}
        onChangeText={setTexto}
        erro={erro}
        exemplo="Testar os microfones"
        maxLength={300}
      />
      {criar.error ? <AvisoDeFalha erro={criar.error} titulo="O item não foi salvo" /> : null}
      <Botao
        titulo="Salvar item"
        tamanho="grande"
        larguraTotal
        carregando={criar.isPending}
        aoPressionar={salvar}
      />
    </FolhaNaTela>
  )
}

/** Notas internas: só a organização lê e escreve. */
export function SecaoNotas({ evento, comunidadeId }: Props) {
  const pode = usePode()
  const [nova, setNova] = useState(false)
  const remover = useRemocaoNoEvento(comunidadeId, evento.id)
  if (!pode('nota_interna', 'ler')) return null
  const gerenciar = pode('nota_interna', 'gerenciar')

  return (
    <>
      <CartaoDePreparacao
        sobrancelha="Notas internas"
        apoio="Só a organização vê estas notas."
        tipo="texto"
        vazio="Nenhuma nota ainda."
        erro={remover.error}
        editavel={gerenciar}
        adicionar={
          gerenciar ? { titulo: 'Adicionar nota', aoPressionar: () => setNova(true) } : null
        }
        itens={evento.notas.map((n) => ({
          chave: n.id,
          no: (editando: boolean) => (
            <ComRemover
              editando={editando}
              rotulo="Remover esta nota"
              aoRemover={() => void remover.pedir(`notas/${n.id}`, 'esta nota')}
            >
              <View style={{ paddingVertical: ESPACO.e12 }}>
                <Texto variante="corpo">{n.texto}</Texto>
                <Texto variante="meta" cor="textoSuave">
                  {`Em ${formatarQuando(n.criadoEm, evento.fuso)}`}
                </Texto>
              </View>
            </ComRemover>
          ),
        }))}
      />
      {gerenciar ? (
        <NovaNota
          evento={evento}
          comunidadeId={comunidadeId}
          aberta={nova}
          aoFechar={() => setNova(false)}
        />
      ) : null}
    </>
  )
}

function NovaNota({
  evento,
  comunidadeId,
  aberta,
  aoFechar,
}: Props & { aberta: boolean; aoFechar: () => void }) {
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const criar = useMudancaNoEvento(comunidadeId, evento.id, (base, corpo: object) =>
    api.post(`${base}/notas`, corpo),
  )
  return (
    <FolhaNaTela aberta={aberta} titulo="Adicionar nota" aoFechar={aoFechar}>
      <Campo
        rotulo="Nota"
        ajuda="Só a organização vê."
        value={texto}
        onChangeText={setTexto}
        erro={erro}
        multiline
        maxLength={5000}
      />
      {criar.error ? <AvisoDeFalha erro={criar.error} titulo="A nota não foi salva" /> : null}
      <Botao
        titulo="Salvar nota"
        tamanho="grande"
        larguraTotal
        carregando={criar.isPending}
        aoPressionar={() => {
          if (!texto.trim()) {
            setErro('Escreva a nota primeiro.')
            return
          }
          setErro(null)
          criar.mutate(
            { texto: texto.trim() },
            {
              onSuccess: () => {
                mostrarToast({ texto: 'Nota salva.' })
                setTexto('')
                aoFechar()
              },
            },
          )
        }}
      />
    </FolhaNaTela>
  )
}

/** Anexos por link (https). Envio de arquivo fica para depois. */
export function SecaoAnexos({ evento, comunidadeId }: Props) {
  const pode = usePode()
  const gerenciar = pode('anexo', 'gerenciar')
  const [novo, setNovo] = useState(false)
  const remover = useRemocaoNoEvento(comunidadeId, evento.id)
  if (!gerenciar && evento.anexos.length === 0) return null

  return (
    <>
      <CartaoDePreparacao
        sobrancelha="Anexos"
        tipo="lista"
        vazio="Nenhum link ainda. Coloque aqui a letra das músicas, a lição ou o roteiro."
        erro={remover.error}
        editavel={gerenciar}
        adicionar={
          gerenciar ? { titulo: 'Adicionar link', aoPressionar: () => setNovo(true) } : null
        }
        itens={evento.anexos.map((a) => ({
          chave: a.id,
          no: (editando: boolean) => (
            <LinhaDeLista
              key={a.id}
              icone="link"
              titulo={a.titulo}
              descricao={a.url}
              linhasDaDescricao={1}
              {...(editando
                ? {
                    extra: (
                      <BotaoIcone
                        icone="excluir"
                        rotulo={`Remover o link ${a.titulo}`}
                        aoPressionar={() => void remover.pedir(`anexos/${a.id}`, 'este link')}
                      />
                    ),
                  }
                : {
                    externo: true,
                    rotuloAcessivel: `Abrir o link ${a.titulo}`,
                    aoPressionar: () => void abrirLink(a.url),
                  })}
            />
          ),
        }))}
      />
      {gerenciar ? (
        <NovoAnexo
          evento={evento}
          comunidadeId={comunidadeId}
          aberta={novo}
          aoFechar={() => setNovo(false)}
        />
      ) : null}
    </>
  )
}

function NovoAnexo({
  evento,
  comunidadeId,
  aberta,
  aoFechar,
}: Props & { aberta: boolean; aoFechar: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [url, setUrl] = useState('')
  const [erros, setErros] = useState<{ titulo?: string; url?: string }>({})
  const criar = useMudancaNoEvento(comunidadeId, evento.id, (base, corpo: object) =>
    api.post(`${base}/anexos`, corpo),
  )

  function salvar() {
    const novos = {
      ...(titulo.trim() ? {} : { titulo: 'Dê um título ao link.' }),
      ...(/^https:\/\/\S+\.\S+/.test(url.trim())
        ? {}
        : { url: 'Use um link completo que comece com https://.' }),
    }
    setErros(novos)
    if (Object.keys(novos).length) return
    criar.mutate(
      { titulo: titulo.trim(), url: url.trim() },
      {
        onSuccess: () => {
          mostrarToast({ texto: 'Link adicionado.' })
          setTitulo('')
          setUrl('')
          aoFechar()
        },
      },
    )
  }

  return (
    <FolhaNaTela aberta={aberta} titulo="Adicionar link" aoFechar={aoFechar}>
      <Campo
        rotulo="Título"
        value={titulo}
        onChangeText={setTitulo}
        erro={erros.titulo ?? null}
        exemplo="Letras do louvor"
        maxLength={120}
      />
      <Campo
        rotulo="Link"
        value={url}
        onChangeText={setUrl}
        erro={erros.url ?? null}
        ajuda="Precisa começar com https://."
        exemplo="https://"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        maxLength={2000}
      />
      {criar.error ? <AvisoDeFalha erro={criar.error} titulo="O link não foi salvo" /> : null}
      <Botao
        titulo="Salvar link"
        tamanho="grande"
        larguraTotal
        carregando={criar.isPending}
        aoPressionar={salvar}
      />
    </FolhaNaTela>
  )
}
