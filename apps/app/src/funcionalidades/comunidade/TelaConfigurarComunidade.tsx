import { useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { DetalheDaComunidade } from '@/servicos/contrato'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'

import { SemComunidade } from '../navegacao/SemComunidade'
import { useDetalheDaComunidade } from './consultas'
import { opcoesDeFuso } from './fusos'
import { IdentidadeDaComunidade } from './Identidade'
import { usePode } from './permissoes'
import { COR_PADRAO, ehCorDaLista, SeletorDeCor, type CorDaComunidade } from './SeletorDeCor'
import { CabecalhoDeTela, TelaPropria } from './visual'

/** Nome, cor e fuso da comunidade ativa (só para quem pode configurar). */
export function TelaConfigurarComunidade() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const detalhe = useDetalheDaComunidade(comunidadeAtiva?.id ?? null)

  if (!comunidadeAtiva) {
    return (
      <TelaPropria>
        <SemComunidade oQue="as configurações" />
      </TelaPropria>
    )
  }
  if (!pode('comunidade', 'configurar')) {
    return (
      <TelaPropria>
        <CabecalhoDeTela sobrancelha={comunidadeAtiva.nome} titulo="Configurações" />
        <Cartao>
          <EstadoVazio
            icone="seguranca"
            titulo="Só a administração configura a comunidade"
            descricao="Se algo precisa mudar no nome, na cor ou no fuso, fale com uma pessoa administradora."
            acao={{ titulo: 'Voltar', aoPressionar: () => router.back() }}
          />
        </Cartao>
      </TelaPropria>
    )
  }
  if (detalhe.isPending) {
    return (
      <TelaPropria>
        <Carregando texto="Carregando as configurações" />
      </TelaPropria>
    )
  }
  if (detalhe.error) {
    return (
      <TelaPropria>
        <AvisoDeErro erro={detalhe.error} aoTentarDeNovo={() => void detalhe.refetch()} />
      </TelaPropria>
    )
  }
  return <Formulario detalhe={detalhe.data} />
}

function Formulario({ detalhe }: { detalhe: DetalheDaComunidade }) {
  const consultas = useQueryClient()
  const [nome, setNome] = useState(detalhe.nome)
  const [cor, setCor] = useState<CorDaComunidade>(
    ehCorDaLista(detalhe.cor) ? detalhe.cor : COR_PADRAO,
  )
  const [fuso, setFuso] = useState(detalhe.fuso)
  const [erroDoNome, setErroDoNome] = useState<string | null>(null)

  const nomeLimpo = nome.trim()
  const mudancas = {
    ...(nomeLimpo !== detalhe.nome ? { nome: nomeLimpo } : {}),
    ...(cor !== detalhe.cor ? { cor } : {}),
    ...(fuso !== detalhe.fuso ? { fuso } : {}),
  }
  const mudou = Object.keys(mudancas).length > 0

  const salvar = useMutation({
    mutationFn: () => api.patch(`/api/v1/c/${detalhe.id}`, mudancas),
    onSuccess: async () => {
      await Promise.all([
        consultas.invalidateQueries({ queryKey: CHAVES.comunidade(detalhe.id) }),
        // Nome e cor aparecem no cabeçalho e no seletor, que vêm de `/eu`.
        consultas.invalidateQueries({ queryKey: CHAVES.eu }),
      ])
    },
  })

  function enviar() {
    if (nomeLimpo.length < 2) {
      setErroDoNome('O nome precisa ter pelo menos 2 letras.')
      return
    }
    setErroDoNome(null)
    salvar.mutate()
  }

  return (
    <TelaPropria>
      <CabecalhoDeTela
        sobrancelha={detalhe.nome}
        titulo="Configurações"
        descricao="O que todo mundo da comunidade vê: nome, cor e o fuso dos horários."
      />
      <Cartao titulo="Identidade" icone="comunidade">
        <Campo
          rotulo="Nome da comunidade"
          value={nome}
          onChangeText={setNome}
          erro={erroDoNome}
          autoCapitalize="words"
          maxLength={80}
        />
        <SeletorDeCor valor={cor} aoMudar={setCor} />
        <IdentidadeDaComunidade nome={nomeLimpo || detalhe.nome} cor={cor} detalhe="Prévia" />
      </Cartao>
      <Cartao
        titulo="Fuso horário"
        icone="relogio"
        descricao="Agenda e programações seguem o fuso do lugar dos encontros."
      >
        <GrupoDeOpcoes
          rotulo="Fuso"
          valor={fuso}
          aoMudar={setFuso}
          opcoes={opcoesDeFuso(detalhe.fuso)}
        />
      </Cartao>
      {salvar.isSuccess && !mudou ? (
        <Aviso tipo="sucesso" anunciar>
          Configurações salvas.
        </Aviso>
      ) : null}
      {salvar.error ? <AvisoDeErro erro={salvar.error} /> : null}
      <Botao
        titulo="Salvar configurações"
        rotuloAcessivel={`Salvar configurações de ${detalhe.nome}`}
        icone="confirmado"
        desabilitado={!mudou}
        motivo="Nada foi alterado ainda."
        carregando={salvar.isPending}
        aoPressionar={enviar}
      />
    </TelaPropria>
  )
}
