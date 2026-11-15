import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { api } from '@/servicos/api'
import type { DetalheDoEvento, Material, Tarefa } from '@/servicos/contratoDosEventos'
import {
  formatarDataLocal,
  dataDoInstante,
  instanteDeDataEHora,
  lerDataDigitada,
} from '@/utilidades/datas'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { Expansivel } from '@/ui/Expansivel'
import { Texto } from '@/ui/Texto'

import { useMeuVinculo } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { SeletorDePessoa } from '../comunidade/SeletorDePessoa'
import { useMudancaNoEvento, useRemocaoNoEvento } from './mutacoes'

interface Props {
  evento: DetalheDoEvento
  comunidadeId: string
}

const MOTIVO_SO_RESPONSAVEL = 'Só quem é responsável ou a organização marca este item.'

function descricaoDaTarefa(t: Tarefa, fuso: string): string {
  return [
    t.responsavelNome ? `Responsável: ${t.responsavelNome}` : 'Sem responsável',
    t.prazo ? `prazo ${formatarDataLocal(dataDoInstante(t.prazo, fuso))}` : null,
    t.concluidaEm ? 'concluída' : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Tarefas do evento. A própria pessoa conclui as suas; a organização gerencia todas. */
export function SecaoTarefas({ evento, comunidadeId }: Props) {
  const pode = usePode()
  const eu = useMeuVinculo()
  const gerenciar = pode('tarefa', 'gerenciar')
  const concluir = useMudancaNoEvento(
    comunidadeId,
    evento.id,
    (base, v: { id: string; concluida: boolean }) =>
      api.patch(`${base}/tarefas/${v.id}`, { concluida: v.concluida }),
  )
  const remover = useRemocaoNoEvento(comunidadeId, evento.id)
  if (!gerenciar && evento.tarefas.length === 0) return null

  return (
    <Cartao titulo="Tarefas" icone="tarefas">
      {evento.tarefas.length === 0 ? (
        <Texto variante="apoio" cor="textoSuave">
          Nenhuma tarefa ainda. Divida o que precisa ser feito antes do encontro.
        </Texto>
      ) : (
        <View style={{ gap: ESPACO.x2 }}>
          {evento.tarefas.map((t) => {
            const podeMarcar = pode('tarefa', 'concluir', {
              proprio: eu !== null && t.responsavelVinculoId === eu,
            })
            return (
              <View key={t.id} style={{ gap: ESPACO.x1 }}>
                <CaixaDeMarcar
                  rotulo={t.titulo}
                  descricao={`${descricaoDaTarefa(t, evento.fuso)}${podeMarcar ? '' : `. ${MOTIVO_SO_RESPONSAVEL}`}`}
                  marcada={t.concluidaEm !== null}
                  desabilitada={!podeMarcar || concluir.isPending}
                  aoMudar={(marcada) => concluir.mutate({ id: t.id, concluida: marcada })}
                />
                {gerenciar ? (
                  <Botao
                    titulo="Remover"
                    variante="discreto"
                    icone="excluir"
                    larguraTotal={false}
                    rotuloAcessivel={`Remover a tarefa ${t.titulo}`}
                    aoPressionar={() => void remover.pedir(`tarefas/${t.id}`, 'esta tarefa')}
                  />
                ) : null}
              </View>
            )
          })}
        </View>
      )}
      {(concluir.error ?? remover.error) ? (
        <AvisoDeErro erro={concluir.error ?? remover.error} />
      ) : null}
      {gerenciar ? <NovaTarefa evento={evento} comunidadeId={comunidadeId} /> : null}
    </Cartao>
  )
}

function NovaTarefa({ evento, comunidadeId }: Props) {
  const [titulo, setTitulo] = useState('')
  const [prazo, setPrazo] = useState('')
  const [responsavel, setResponsavel] = useState<string | null>(null)
  const [erros, setErros] = useState<{ titulo?: string; prazo?: string }>({})
  const criar = useMudancaNoEvento(comunidadeId, evento.id, (base, corpo: object) =>
    api.post(`${base}/tarefas`, corpo),
  )

  return (
    <Expansivel titulo="Adicionar tarefa">
      {(fechar) => (
        <>
          <Campo
            rotulo="O que precisa ser feito"
            value={titulo}
            onChangeText={setTitulo}
            erro={erros.titulo ?? null}
            exemplo="Comprar o brinde"
            maxLength={200}
          />
          <Campo
            rotulo="Prazo (opcional)"
            value={prazo}
            onChangeText={setPrazo}
            erro={erros.prazo ?? null}
            ajuda="Dia no formato DD/MM/AAAA."
            exemplo="14/11/2026"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          <SeletorDePessoa
            comunidadeId={comunidadeId}
            rotulo="Responsável"
            valor={responsavel}
            aoMudar={setResponsavel}
            permitirNinguem
          />
          {criar.error ? <AvisoDeErro erro={criar.error} /> : null}
          <Botao
            titulo="Salvar tarefa"
            carregando={criar.isPending}
            aoPressionar={() => {
              const data = prazo.trim() ? lerDataDigitada(prazo) : null
              const novos = {
                ...(titulo.trim().length >= 2 ? {} : { titulo: 'Descreva a tarefa.' }),
                ...(prazo.trim() && !data ? { prazo: 'Use uma data real, como 14/11/2026.' } : {}),
              }
              setErros(novos)
              if (Object.keys(novos).length) return
              criar.mutate(
                {
                  titulo: titulo.trim(),
                  responsavelVinculoId: responsavel,
                  // Prazo é o fim do dia, no fuso do evento.
                  prazo: data ? instanteDeDataEHora(data, '23:59', evento.fuso) : null,
                },
                {
                  onSuccess: () => {
                    setTitulo('')
                    setPrazo('')
                    setResponsavel(null)
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

/** Materiais: qualquer pessoa marca "providenciado"; a organização cadastra. */
export function SecaoMateriais({ evento, comunidadeId }: Props) {
  const pode = usePode()
  const gerenciar = pode('material', 'gerenciar')
  const marcar = useMudancaNoEvento(
    comunidadeId,
    evento.id,
    (base, v: { id: string; providenciado: boolean }) =>
      api.patch(`${base}/materiais/${v.id}`, { providenciado: v.providenciado }),
  )
  const remover = useRemocaoNoEvento(comunidadeId, evento.id)
  if (!gerenciar && evento.materiais.length === 0) return null

  const descrever = (m: Material) =>
    [
      m.quantidade ? `Quantidade: ${m.quantidade}` : null,
      m.responsavelNome ? `com ${m.responsavelNome}` : null,
      m.providenciadoEm ? 'providenciado' : 'a providenciar',
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <Cartao titulo="Materiais" icone="material">
      {evento.materiais.length === 0 ? (
        <Texto variante="apoio" cor="textoSuave">
          Nenhum material listado. Anote o que precisa estar no lugar (som, cabos, lanche).
        </Texto>
      ) : (
        <View style={{ gap: ESPACO.x2 }}>
          {evento.materiais.map((m) => (
            <View key={m.id} style={{ gap: ESPACO.x1 }}>
              <CaixaDeMarcar
                rotulo={m.nome}
                descricao={descrever(m)}
                marcada={m.providenciadoEm !== null}
                desabilitada={marcar.isPending}
                aoMudar={(marcada) => marcar.mutate({ id: m.id, providenciado: marcada })}
              />
              {gerenciar ? (
                <Botao
                  titulo="Remover"
                  variante="discreto"
                  icone="excluir"
                  larguraTotal={false}
                  rotuloAcessivel={`Remover o material ${m.nome}`}
                  aoPressionar={() => void remover.pedir(`materiais/${m.id}`, 'este material')}
                />
              ) : null}
            </View>
          ))}
        </View>
      )}
      {(marcar.error ?? remover.error) ? (
        <AvisoDeErro erro={marcar.error ?? remover.error} />
      ) : null}
      {gerenciar ? <NovoMaterial evento={evento} comunidadeId={comunidadeId} /> : null}
    </Cartao>
  )
}

function NovoMaterial({ evento, comunidadeId }: Props) {
  const [nome, setNome] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [responsavel, setResponsavel] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const criar = useMudancaNoEvento(comunidadeId, evento.id, (base, corpo: object) =>
    api.post(`${base}/materiais`, corpo),
  )
  return (
    <Expansivel titulo="Adicionar material">
      {(fechar) => (
        <>
          <Campo
            rotulo="Material"
            value={nome}
            onChangeText={setNome}
            erro={erro}
            exemplo="Caixa de som"
            maxLength={200}
          />
          <Campo
            rotulo="Quantidade (opcional)"
            value={quantidade}
            onChangeText={setQuantidade}
            exemplo="2 unidades"
            maxLength={60}
          />
          <SeletorDePessoa
            comunidadeId={comunidadeId}
            rotulo="Quem providencia"
            valor={responsavel}
            aoMudar={setResponsavel}
            permitirNinguem
          />
          {criar.error ? <AvisoDeErro erro={criar.error} /> : null}
          <Botao
            titulo="Salvar material"
            carregando={criar.isPending}
            aoPressionar={() => {
              if (!nome.trim()) {
                setErro('Diga qual é o material.')
                return
              }
              setErro(null)
              criar.mutate(
                {
                  nome: nome.trim(),
                  quantidade: quantidade.trim() || null,
                  responsavelVinculoId: responsavel,
                },
                {
                  onSuccess: () => {
                    setNome('')
                    setQuantidade('')
                    setResponsavel(null)
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
