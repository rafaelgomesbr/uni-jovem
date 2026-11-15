import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { Conta } from '@/servicos/contrato'
import { normalizarWhatsApp } from '@/utilidades/formatos'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { Linha } from '@/ui/Linha'
import { Tela } from '@/ui/Tela'

/** Rota `/editar-perfil`: nome e WhatsApp. O e-mail é o da entrada e não muda aqui. */
export function TelaEditarPerfil() {
  const { conta } = useSessao()
  return (
    <Tela cabecalhoNativo titulo="Dados pessoais">
      <Stack.Screen options={{ title: 'Editar perfil' }} />
      {conta ? <DadosDaConta conta={conta} /> : null}
    </Tela>
  )
}

export function DadosDaConta({ conta }: { conta: Conta }) {
  const consultas = useQueryClient()
  const [nome, setNome] = useState(conta.nome)
  const [whatsapp, setWhatsapp] = useState(conta.whatsapp ?? '')
  const [erros, setErros] = useState<{ nome?: string; whatsapp?: string }>({})

  const salvar = useMutation({
    mutationFn: (corpo: { nome?: string; whatsapp?: string | null }) =>
      api.patch('/api/v1/eu', corpo),
    onSuccess: () => consultas.invalidateQueries({ queryKey: CHAVES.eu }),
  })

  // Vazio remove o WhatsApp; preenchido precisa virar o formato +55...
  const whatsappNormalizado = whatsapp.trim() ? normalizarWhatsApp(whatsapp) : null
  const whatsappInvalido = whatsapp.trim() !== '' && !whatsappNormalizado
  const mudouNome = nome.trim() !== conta.nome
  const mudouWhatsapp = whatsappInvalido || whatsappNormalizado !== conta.whatsapp

  function enviar() {
    const novos: { nome?: string; whatsapp?: string } = {}
    if (!nome.trim()) novos.nome = 'Informe seu nome.'
    if (whatsappInvalido) {
      novos.whatsapp = 'Informe o WhatsApp com DDD, por exemplo (11) 91234-5678.'
    }
    setErros(novos)
    if (novos.nome || novos.whatsapp) return
    salvar.mutate({
      ...(mudouNome ? { nome: nome.trim() } : {}),
      ...(mudouWhatsapp ? { whatsapp: whatsappNormalizado } : {}),
    })
  }

  return (
    <>
      <Cartao titulo="Seus dados" icone="perfil">
        <Campo
          rotulo="Nome"
          value={nome}
          onChangeText={setNome}
          erro={erros.nome ?? null}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
        />
        <Campo
          rotulo="WhatsApp"
          ajuda="Com DDD. Deixe em branco para remover."
          exemplo="(11) 91234-5678"
          value={whatsapp}
          onChangeText={setWhatsapp}
          erro={erros.whatsapp ?? null}
          keyboardType="phone-pad"
          inputMode="tel"
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
        {salvar.error ? <AvisoDeErro erro={salvar.error} /> : null}
        {salvar.isSuccess && !mudouNome && !mudouWhatsapp ? (
          <Aviso tipo="sucesso" anunciar>
            Dados salvos.
          </Aviso>
        ) : null}
        <Botao
          titulo="Salvar dados"
          aoPressionar={enviar}
          carregando={salvar.isPending}
          desabilitado={!mudouNome && !mudouWhatsapp}
          motivo="Altere o nome ou o WhatsApp para salvar."
        />
      </Cartao>
      <Cartao>
        <Linha
          icone="email"
          titulo="E-mail"
          descricao={`${conta.email}. É o e-mail com que você entra; não muda por aqui.`}
        />
      </Cartao>
    </>
  )
}
