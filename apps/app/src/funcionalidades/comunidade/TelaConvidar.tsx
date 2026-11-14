import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NOME_DO_PAPEL, PAPEIS, podeConcederPapel, type Papel } from '@uj/dominio'
import { router } from 'expo-router'
import { useState } from 'react'

import { NOME_DO_APP } from '@/constantes'
import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ConviteCriado } from '@/servicos/contrato'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Tela } from '@/ui/Tela'

import { LinkCompartilhavel } from './LinkCompartilhavel'
import { usePode } from './permissoes'

const DESCRICAO_DO_PAPEL: Readonly<Record<Papel, string>> = {
  admin: 'Configura a comunidade, convida pessoas e altera papéis.',
  organizador: 'Monta eventos, programações, escalas e tarefas.',
  membro: 'Participa, vê a agenda, confirma escalas e faz inscrições.',
}

const VALIDADES = [
  { valor: '1', rotulo: '1 dia' },
  { valor: '3', rotulo: '3 dias' },
  { valor: '7', rotulo: '7 dias', descricao: 'O máximo permitido' },
] as const

export function TelaConvidar() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const consultas = useQueryClient()
  const [papel, setPapel] = useState<Papel>('membro')
  const [validade, setValidade] = useState<'1' | '3' | '7'>('7')
  const [email, setEmail] = useState('')
  const [enviarPorEmail, setEnviarPorEmail] = useState(true)

  const criar = useMutation({
    mutationFn: () =>
      api.post<ConviteCriado>(`/api/v1/c/${comunidadeAtiva?.id}/convites`, {
        papel,
        validadeDias: Number(validade),
        ...(email.trim() ? { email: email.trim(), enviarPorEmail } : {}),
      }),
    onSuccess: () =>
      comunidadeAtiva &&
      consultas.invalidateQueries({ queryKey: CHAVES.convites(comunidadeAtiva.id) }),
  })

  if (!comunidadeAtiva || !pode('convite', 'criar')) {
    return (
      <Tela cabecalhoNativo>
        <EstadoVazio
          icone="seguranca"
          titulo="Convites são criados pela administração"
          descricao="Só quem administra a comunidade pode convidar pessoas. Fale com um administrador."
          acao={{ titulo: 'Voltar', aoPressionar: () => router.back() }}
        />
      </Tela>
    )
  }

  if (criar.data) {
    return (
      <Tela cabecalhoNativo titulo="Convite criado">
        <LinkCompartilhavel
          titulo={`Convite para ${comunidadeAtiva.nome} (${NOME_DO_PAPEL[papel]})`}
          link={criar.data.link}
          expiraEm={criar.data.expiraEm}
          mensagem={`Você foi convidado para participar de ${comunidadeAtiva.nome} no ${NOME_DO_APP}. Abra o link para aceitar:`}
        />
        <Botao
          titulo="Criar outro convite"
          variante="secundario"
          aoPressionar={() => {
            criar.reset()
            setEmail('')
          }}
        />
      </Tela>
    )
  }

  const opcoes = PAPEIS.map((p) => ({
    valor: p,
    rotulo: NOME_DO_PAPEL[p],
    descricao: DESCRICAO_DO_PAPEL[p],
    desabilitada: !podeConcederPapel(comunidadeAtiva.papel, p),
  }))

  return (
    <Tela
      cabecalhoNativo
      titulo={`Convidar para ${comunidadeAtiva.nome}`}
      descricao="O convite gera um link de uso único. Quem abrir cria a conta (ou usa a que já tem) e entra com o papel escolhido."
    >
      <Cartao>
        <GrupoDeOpcoes rotulo="Papel" opcoes={opcoes} valor={papel} aoMudar={setPapel} />
        <GrupoDeOpcoes
          rotulo="Validade do link"
          opcoes={VALIDADES}
          valor={validade}
          aoMudar={setValidade}
        />
        <Campo
          rotulo="E-mail de quem vai receber (opcional)"
          ajuda="Com e-mail, só essa pessoa consegue usar o convite."
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
        />
        {email.trim() ? (
          <CaixaDeMarcar
            rotulo="Enviar o convite também por e-mail"
            marcada={enviarPorEmail}
            aoMudar={setEnviarPorEmail}
          />
        ) : null}
        {criar.error ? <AvisoDeErro erro={criar.error} /> : null}
        <Botao
          titulo={`Criar convite para ${comunidadeAtiva.nome}`}
          icone="convidar"
          aoPressionar={() => criar.mutate()}
          carregando={criar.isPending}
        />
      </Cartao>
    </Tela>
  )
}
