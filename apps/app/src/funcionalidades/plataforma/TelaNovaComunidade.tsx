import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { NOME_DO_APP } from '@/constantes'
import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { ComunidadeCriada } from '@/servicos/contrato'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Tela } from '@/ui/Tela'

import { IdentidadeDaComunidade } from '../comunidade/Identidade'
import { LinkCompartilhavel } from '../comunidade/LinkCompartilhavel'
import { exigeProvaDeSegundoFator, ProvaDeSegundoFator } from './ProvaDeSegundoFator'

const CORES = [
  { valor: '#5B4BDB', rotulo: 'Índigo' },
  { valor: '#C2410C', rotulo: 'Coral' },
  { valor: '#15803D', rotulo: 'Verde' },
  { valor: '#1D4ED8', rotulo: 'Azul' },
  { valor: '#7E22CE', rotulo: 'Roxo' },
  { valor: '#B45309', rotulo: 'Âmbar' },
] as const

type Cor = (typeof CORES)[number]['valor']

export function TelaNovaComunidade() {
  const consultas = useQueryClient()
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState<Cor>('#5B4BDB')
  const [emailDoAdmin, setEmailDoAdmin] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const criar = useMutation({
    mutationFn: () =>
      api.post<ComunidadeCriada>('/api/v1/plataforma/comunidades', {
        nome: nome.trim(),
        cor,
        ...(emailDoAdmin.trim() ? { emailDoAdmin: emailDoAdmin.trim() } : {}),
      }),
    onSuccess: () => consultas.invalidateQueries({ queryKey: CHAVES.plataforma }),
  })

  function enviar() {
    const ok = nome.trim().length >= 2
    setErro(ok ? null : 'O nome precisa ter pelo menos 2 letras.')
    if (ok) criar.mutate()
  }

  if (criar.data) {
    return (
      <Tela cabecalhoNativo titulo="Comunidade criada">
        <LinkCompartilhavel
          titulo={`Convite do primeiro administrador de ${nome.trim()}`}
          link={criar.data.conviteDoPrimeiroAdmin.link}
          expiraEm={criar.data.conviteDoPrimeiroAdmin.expiraEm}
          mensagem={`Você foi convidado para administrar ${nome.trim()} no ${NOME_DO_APP}. Abra o link para aceitar:`}
        />
      </Tela>
    )
  }

  return (
    <Tela cabecalhoNativo titulo="Criar comunidade">
      {exigeProvaDeSegundoFator(criar.error) ? (
        <ProvaDeSegundoFator aoConfirmar={() => criar.mutate()} />
      ) : null}
      <Cartao>
        <Campo
          rotulo="Nome da comunidade"
          value={nome}
          onChangeText={setNome}
          erro={erro}
          autoCapitalize="words"
          maxLength={80}
        />
        <GrupoDeOpcoes rotulo="Cor" opcoes={CORES} valor={cor} aoMudar={setCor} />
        {nome.trim() ? (
          <IdentidadeDaComunidade nome={nome.trim()} cor={cor} detalhe="Prévia" />
        ) : null}
        <Campo
          rotulo="E-mail de quem vai administrar (opcional)"
          ajuda="Com e-mail, só essa pessoa consegue usar o convite de administrador."
          value={emailDoAdmin}
          onChangeText={setEmailDoAdmin}
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
        />
        {criar.error && !exigeProvaDeSegundoFator(criar.error) ? (
          <AvisoDeErro erro={criar.error} />
        ) : null}
        <Botao
          titulo={nome.trim() ? `Criar ${nome.trim()}` : 'Criar comunidade'}
          icone="adicionar"
          aoPressionar={enviar}
          carregando={criar.isPending}
        />
      </Cartao>
    </Tela>
  )
}
