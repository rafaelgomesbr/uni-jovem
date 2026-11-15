import { useState } from 'react'

import { api } from '@/servicos/api'
import type { DetalheDoEvento, Material, Tarefa } from '@/servicos/contratoDosEventos'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo } from '@/ui/Campo'
import { CampoDeData } from '@/ui/CampoDeMomento'
import { mostrarToast } from '@/ui/Toast'
import {
  dataDoInstante,
  DIAS_CURTOS,
  diaDaSemana,
  instanteDeDataEHora,
  type DataLocal,
} from '@/utilidades/datas'

import { useMeuVinculo } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { SeletorDePessoa } from '../comunidade/SeletorDePessoa'
import { useMarcarNoEvento } from '../offline/acoes'
import { MENSAGEM_EXIGE_CONEXAO } from '../offline/mensagens'
import type { ModoLocal } from '../offline/vistaLocal'
import { CartaoDePreparacao, ComRemover } from './CartaoDePreparacao'
import { AvisoDeFalha } from './Falha'
import { FolhaNaTela } from './FolhaNaTela'
import { useMudancaNoEvento, useRemocaoNoEvento } from './mutacoes'

interface Props {
  evento: DetalheDoEvento
  comunidadeId: string
}

interface PropsDaSecao extends Props {
  /** Cópia preparada, sem conexão: só marcar; criar e remover exigem internet. */
  local?: ModoLocal
}

const PENDENTE = 'Pendente de envio: feito neste aparelho, vai quando a internet voltar'

const MOTIVO_SO_RESPONSAVEL = 'Só a pessoa responsável ou a organização marca'

/** "sex, 27/11" (o ano fica de fora: o prazo é sempre perto do evento). */
export function diaCurto(iso: string, fuso: string): string {
  const dia = dataDoInstante(iso, fuso)
  return `${DIAS_CURTOS[diaDaSemana(dia)]}, ${dia.slice(8, 10)}/${dia.slice(5, 7)}`
}

/** "Ana Souza · até sex, 27/11" ou "Ana Souza · feito em sáb, 21/11" (quadro 03b). */
export function descreverTarefa(t: Tarefa, fuso: string): string {
  return [
    t.responsavelNome ?? 'Sem responsável',
    t.concluidaEm
      ? `feito em ${diaCurto(t.concluidaEm, fuso)}`
      : t.prazo
        ? `até ${diaCurto(t.prazo, fuso)}`
        : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Tarefas do evento. A própria pessoa conclui as suas; a organização gerencia todas. */
export function SecaoTarefas({ evento, comunidadeId, local }: PropsDaSecao) {
  const pode = usePode()
  const euOnline = useMeuVinculo()
  const eu = local ? local.eu : euOnline
  const gerenciar = pode('tarefa', 'gerenciar')
  const [nova, setNova] = useState(false)
  const concluir = useMarcarNoEvento(comunidadeId, evento.id, 'tarefa', {
    local: local !== undefined,
    eu,
  })
  const remover = useRemocaoNoEvento(comunidadeId, evento.id)
  if (!gerenciar && evento.tarefas.length === 0) return null

  return (
    <>
      <CartaoDePreparacao
        sobrancelha="Tarefas"
        vazio="Nenhuma tarefa ainda. Divida o que precisa ser feito antes do encontro."
        erro={concluir.error ?? remover.error}
        editavel={gerenciar && !local}
        adicionar={
          gerenciar
            ? local
              ? {
                  titulo: 'Adicionar tarefa',
                  aoPressionar: () => undefined,
                  motivo: `${MENSAGEM_EXIGE_CONEXAO} Sem internet, dá para concluir e reabrir.`,
                }
              : { titulo: 'Adicionar tarefa', aoPressionar: () => setNova(true) }
            : null
        }
        itens={evento.tarefas.map((t) => {
          const podeMarcar = pode('tarefa', 'concluir', {
            proprio: eu !== null && t.responsavelVinculoId === eu,
          })
          const descricao = [
            descreverTarefa(t, evento.fuso),
            podeMarcar ? null : MOTIVO_SO_RESPONSAVEL,
            local?.pendentes.has(t.id) ? PENDENTE : null,
          ]
            .filter(Boolean)
            .join('. ')
          return {
            chave: t.id,
            no: (editando: boolean) => (
              <ComRemover
                editando={editando}
                rotulo={`Remover a tarefa ${t.titulo}`}
                aoRemover={() => void remover.pedir(`tarefas/${t.id}`, 'esta tarefa')}
              >
                <CaixaDeMarcar
                  rotulo={t.titulo}
                  descricao={descricao}
                  marcada={t.concluidaEm !== null}
                  desabilitada={!podeMarcar || concluir.isPending}
                  aoMudar={(marcada) =>
                    concluir.mutate({ id: t.id, valor: marcada, rotulo: t.titulo })
                  }
                />
              </ComRemover>
            ),
          }
        })}
      />
      {gerenciar && !local ? (
        <NovaTarefa
          evento={evento}
          comunidadeId={comunidadeId}
          aberta={nova}
          aoFechar={() => setNova(false)}
        />
      ) : null}
    </>
  )
}

function NovaTarefa({
  evento,
  comunidadeId,
  aberta,
  aoFechar,
}: Props & { aberta: boolean; aoFechar: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [prazo, setPrazo] = useState<DataLocal | null>(null)
  const [responsavel, setResponsavel] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const criar = useMudancaNoEvento(comunidadeId, evento.id, (base, corpo: object) =>
    api.post(`${base}/tarefas`, corpo),
  )

  function salvar() {
    if (titulo.trim().length < 2) {
      setErro('Descreva a tarefa.')
      return
    }
    setErro(null)
    criar.mutate(
      {
        titulo: titulo.trim(),
        responsavelVinculoId: responsavel,
        // Prazo é o fim do dia, no fuso do evento.
        prazo: prazo ? instanteDeDataEHora(prazo, '23:59', evento.fuso) : null,
      },
      {
        onSuccess: () => {
          mostrarToast({ texto: 'Tarefa adicionada.' })
          setTitulo('')
          setPrazo(null)
          setResponsavel(null)
          aoFechar()
        },
      },
    )
  }

  return (
    <FolhaNaTela aberta={aberta} titulo="Adicionar tarefa" aoFechar={aoFechar}>
      <Campo
        rotulo="O que precisa ser feito"
        value={titulo}
        onChangeText={setTitulo}
        erro={erro}
        exemplo="Comprar o brinde"
        maxLength={200}
      />
      <CampoDeData
        rotulo="Prazo"
        opcional
        valor={prazo}
        aoMudar={(v) => setPrazo(v as DataLocal)}
        ajuda="Vale até o fim do dia escolhido."
      />
      <SeletorDePessoa
        comunidadeId={comunidadeId}
        rotulo="Responsável"
        valor={responsavel}
        aoMudar={setResponsavel}
        permitirNinguem
      />
      {criar.error ? <AvisoDeFalha erro={criar.error} titulo="A tarefa não foi salva" /> : null}
      <Botao
        titulo="Salvar tarefa"
        tamanho="grande"
        larguraTotal
        carregando={criar.isPending}
        aoPressionar={salvar}
      />
    </FolhaNaTela>
  )
}

/** Materiais: qualquer pessoa marca "providenciado"; a organização cadastra. */
export function SecaoMateriais({ evento, comunidadeId, local }: PropsDaSecao) {
  const pode = usePode()
  const gerenciar = pode('material', 'gerenciar')
  const [novo, setNovo] = useState(false)
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
      m.quantidade,
      m.responsavelNome ? `com ${m.responsavelNome}` : null,
      m.providenciadoEm ? 'providenciado' : 'a providenciar',
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <>
      <CartaoDePreparacao
        sobrancelha="Materiais"
        vazio="Nenhum material listado. Anote o que precisa estar no lugar: som, cabos, lanche."
        erro={marcar.error ?? remover.error}
        editavel={gerenciar && !local}
        adicionar={
          gerenciar && !local
            ? { titulo: 'Adicionar material', aoPressionar: () => setNovo(true) }
            : null
        }
        itens={evento.materiais.map((m) => ({
          chave: m.id,
          no: (editando: boolean) => (
            <ComRemover
              editando={editando}
              rotulo={`Remover o material ${m.nome}`}
              aoRemover={() => void remover.pedir(`materiais/${m.id}`, 'este material')}
            >
              <CaixaDeMarcar
                rotulo={m.nome}
                descricao={`${descrever(m)}${local ? `. ${MENSAGEM_EXIGE_CONEXAO}` : ''}`}
                marcada={m.providenciadoEm !== null}
                desabilitada={marcar.isPending || local !== undefined}
                aoMudar={(marcada) => marcar.mutate({ id: m.id, providenciado: marcada })}
              />
            </ComRemover>
          ),
        }))}
      />
      {gerenciar && !local ? (
        <NovoMaterial
          evento={evento}
          comunidadeId={comunidadeId}
          aberta={novo}
          aoFechar={() => setNovo(false)}
        />
      ) : null}
    </>
  )
}

function NovoMaterial({
  evento,
  comunidadeId,
  aberta,
  aoFechar,
}: Props & { aberta: boolean; aoFechar: () => void }) {
  const [nome, setNome] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [responsavel, setResponsavel] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const criar = useMudancaNoEvento(comunidadeId, evento.id, (base, corpo: object) =>
    api.post(`${base}/materiais`, corpo),
  )

  function salvar() {
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
          mostrarToast({ texto: 'Material adicionado.' })
          setNome('')
          setQuantidade('')
          setResponsavel(null)
          aoFechar()
        },
      },
    )
  }

  return (
    <FolhaNaTela aberta={aberta} titulo="Adicionar material" aoFechar={aoFechar}>
      <Campo
        rotulo="Material"
        value={nome}
        onChangeText={setNome}
        erro={erro}
        exemplo="Caixa de som"
        maxLength={200}
      />
      <Campo
        rotulo="Quantidade"
        opcional
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
      {criar.error ? <AvisoDeFalha erro={criar.error} titulo="O material não foi salvo" /> : null}
      <Botao
        titulo="Salvar material"
        tamanho="grande"
        larguraTotal
        carregando={criar.isPending}
        aoPressionar={salvar}
      />
    </FolhaNaTela>
  )
}
