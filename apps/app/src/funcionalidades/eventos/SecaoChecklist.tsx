import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { api } from '@/servicos/api'
import type { DetalheDoEvento, TipoDeChecklist } from '@/servicos/contratoDosEventos'
import { abrirLink } from '@/utilidades/compartilhar'
import { formatarQuando } from '@/utilidades/datas'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { Expansivel } from '@/ui/Expansivel'
import { Linha } from '@/ui/Linha'
import { Segmentos } from '@/ui/Segmentos'
import { Texto } from '@/ui/Texto'

import { useMeuVinculo } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { useMarcarNoEvento } from '../offline/acoes'
import { MENSAGEM_EXIGE_CONEXAO } from '../offline/mensagens'
import type { ModoLocal } from '../offline/vistaLocal'
import { useMudancaNoEvento, useRemocaoNoEvento } from './mutacoes'
import { NOME_DO_CHECKLIST } from './nomes'

interface Props {
  evento: DetalheDoEvento
  comunidadeId: string
}

const TIPOS: readonly TipoDeChecklist[] = ['preparacao', 'encerramento']

/** Checklists de preparação e de encerramento, com quem marcou. */
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
  const marcar = useMarcarNoEvento(comunidadeId, evento.id, 'checklist', {
    local: local !== undefined,
    eu,
  })
  const remover = useRemocaoNoEvento(comunidadeId, evento.id)
  if (!gerenciar && evento.checklist.length === 0) return null

  return (
    <Cartao titulo="Checklists" icone="confirmado">
      {TIPOS.map((tipo) => {
        const itens = evento.checklist.filter((i) => i.tipo === tipo)
        const feitos = itens.filter((i) => i.marcadoEm).length
        return (
          <View key={tipo} style={{ gap: ESPACO.x2 }}>
            <Texto variante="corpoForte" accessibilityRole="header">
              {NOME_DO_CHECKLIST[tipo]} ({feitos} de {itens.length})
            </Texto>
            {itens.length === 0 ? (
              <Texto variante="apoio" cor="textoSuave">
                Nenhum item de {NOME_DO_CHECKLIST[tipo].toLowerCase()}.
              </Texto>
            ) : (
              itens.map((item) => {
                const podeMarcar = pode('checklist', 'marcar', {
                  proprio: eu !== null && item.responsavelVinculoId === eu,
                })
                const descricao = [
                  item.responsavelNome ? `Responsável: ${item.responsavelNome}` : null,
                  podeMarcar ? null : 'Só quem é responsável ou a organização marca este item',
                  local?.pendentes.has(item.id)
                    ? 'Pendente de envio: feito neste aparelho, vai quando a internet voltar'
                    : null,
                ]
                  .filter(Boolean)
                  .join('. ')
                return (
                  <View key={item.id} style={{ gap: ESPACO.x1 }}>
                    <CaixaDeMarcar
                      rotulo={item.texto}
                      {...(descricao ? { descricao } : {})}
                      marcada={item.marcadoEm !== null}
                      desabilitada={!podeMarcar || marcar.isPending}
                      aoMudar={(marcado) =>
                        marcar.mutate({ id: item.id, valor: marcado, rotulo: item.texto })
                      }
                    />
                    {gerenciar && !local ? (
                      <Botao
                        titulo="Remover"
                        variante="discreto"
                        icone="excluir"
                        larguraTotal={false}
                        rotuloAcessivel={`Remover o item ${item.texto}`}
                        aoPressionar={() =>
                          void remover.pedir(`checklist/${item.id}`, 'este item do checklist')
                        }
                      />
                    ) : null}
                  </View>
                )
              })
            )}
          </View>
        )
      })}
      {(marcar.error ?? remover.error) ? (
        <AvisoDeErro erro={marcar.error ?? remover.error} />
      ) : null}
      {gerenciar && !local ? <NovoItem evento={evento} comunidadeId={comunidadeId} /> : null}
      {gerenciar && local ? (
        <Botao
          titulo="Adicionar item ao checklist"
          icone="adicionar"
          variante="secundario"
          desabilitado
          motivo={`${MENSAGEM_EXIGE_CONEXAO} Sem internet, dá para marcar e desmarcar.`}
          aoPressionar={() => undefined}
        />
      ) : null}
    </Cartao>
  )
}

function NovoItem({ evento, comunidadeId }: Props) {
  const [tipo, setTipo] = useState<TipoDeChecklist>('preparacao')
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const criar = useMudancaNoEvento(comunidadeId, evento.id, (base, corpo: object) =>
    api.post(`${base}/checklist`, corpo),
  )
  return (
    <Expansivel titulo="Adicionar item ao checklist">
      {(fechar) => (
        <>
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
          {criar.error ? <AvisoDeErro erro={criar.error} /> : null}
          <Botao
            titulo="Salvar item"
            carregando={criar.isPending}
            aoPressionar={() => {
              if (!texto.trim()) {
                setErro('Escreva o item.')
                return
              }
              setErro(null)
              criar.mutate(
                { tipo, texto: texto.trim() },
                {
                  onSuccess: () => {
                    setTexto('')
                    fechar()
                  },
                },
              )
            }}
          />
        </>
      )}
    </Expansivel>
  )
}

/** Notas internas: só a organização lê e escreve. */
export function SecaoNotas({ evento, comunidadeId }: Props) {
  const pode = usePode()
  const [texto, setTexto] = useState('')
  const criar = useMudancaNoEvento(comunidadeId, evento.id, (base, corpo: object) =>
    api.post(`${base}/notas`, corpo),
  )
  const remover = useRemocaoNoEvento(comunidadeId, evento.id)
  if (!pode('nota_interna', 'ler')) return null
  const gerenciar = pode('nota_interna', 'gerenciar')

  return (
    <Cartao titulo="Notas internas" icone="nota">
      <Texto variante="apoio" cor="textoSuave">
        Só a organização vê estas notas. Membros não têm acesso.
      </Texto>
      {evento.notas.length === 0 ? (
        <Texto variante="apoio" cor="textoSuave">
          Nenhuma nota ainda.
        </Texto>
      ) : (
        evento.notas.map((n) => (
          <View key={n.id} style={{ gap: ESPACO.x1 }}>
            <Texto>{n.texto}</Texto>
            <Texto variante="apoio" cor="textoSuave">
              Em {formatarQuando(n.criadoEm, evento.fuso)}
            </Texto>
            {gerenciar ? (
              <Botao
                titulo="Remover"
                variante="discreto"
                icone="excluir"
                larguraTotal={false}
                rotuloAcessivel="Remover esta nota"
                aoPressionar={() => void remover.pedir(`notas/${n.id}`, 'esta nota')}
              />
            ) : null}
          </View>
        ))
      )}
      {remover.error ? <AvisoDeErro erro={remover.error} /> : null}
      {gerenciar ? (
        <>
          <Campo
            rotulo="Nova nota"
            value={texto}
            onChangeText={setTexto}
            multiline
            maxLength={5000}
          />
          {criar.error ? <AvisoDeErro erro={criar.error} /> : null}
          <Botao
            titulo="Salvar nota"
            variante="secundario"
            carregando={criar.isPending}
            desabilitado={!texto.trim()}
            motivo="Escreva a nota primeiro."
            aoPressionar={() =>
              criar.mutate({ texto: texto.trim() }, { onSuccess: () => setTexto('') })
            }
          />
        </>
      ) : null}
    </Cartao>
  )
}

/** Anexos por link (https). Envio de arquivo fica para depois. */
export function SecaoAnexos({ evento, comunidadeId }: Props) {
  const pode = usePode()
  const gerenciar = pode('anexo', 'gerenciar')
  const [titulo, setTitulo] = useState('')
  const [url, setUrl] = useState('')
  const [erros, setErros] = useState<{ titulo?: string; url?: string }>({})
  const criar = useMudancaNoEvento(comunidadeId, evento.id, (base, corpo: object) =>
    api.post(`${base}/anexos`, corpo),
  )
  const remover = useRemocaoNoEvento(comunidadeId, evento.id)
  if (!gerenciar && evento.anexos.length === 0) return null

  return (
    <Cartao titulo="Anexos e links" icone="link">
      {evento.anexos.length === 0 ? (
        <Texto variante="apoio" cor="textoSuave">
          Nenhum link ainda. Coloque aqui a letra das músicas, a lição ou o roteiro.
        </Texto>
      ) : (
        evento.anexos.map((a) => (
          <View key={a.id} style={{ gap: ESPACO.x1 }}>
            <Linha
              icone="link"
              titulo={a.titulo}
              descricao={a.url}
              rotuloAcessivel={`Abrir o link ${a.titulo}`}
              aoPressionar={() => void abrirLink(a.url)}
            />
            {gerenciar ? (
              <Botao
                titulo="Remover"
                variante="discreto"
                icone="excluir"
                larguraTotal={false}
                rotuloAcessivel={`Remover o link ${a.titulo}`}
                aoPressionar={() => void remover.pedir(`anexos/${a.id}`, 'este link')}
              />
            ) : null}
          </View>
        ))
      )}
      {remover.error ? <AvisoDeErro erro={remover.error} /> : null}
      {gerenciar ? (
        <Expansivel titulo="Adicionar link">
          {(fechar) => (
            <>
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
              {criar.error ? <AvisoDeErro erro={criar.error} /> : null}
              <Botao
                titulo="Salvar link"
                carregando={criar.isPending}
                aoPressionar={() => {
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
                        setTitulo('')
                        setUrl('')
                        fechar()
                      },
                    },
                  )
                }}
              />
            </>
          )}
        </Expansivel>
      ) : null}
    </Cartao>
  )
}
