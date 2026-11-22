import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router, Stack } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { Conta } from '@/servicos/contrato'
import { mensagemDoErro } from '@/servicos/erros'
import { normalizarWhatsApp } from '@/utilidades/formatos'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { LinhaDeLista } from '@/ui/LinhaDeLista'
import { Tela } from '@/ui/Tela'
import { mostrarToast } from '@/ui/Toast'

import { EscolhaDeImagem } from './EscolhaDeImagem'
import { fotoDaConta, useFotoDePerfil } from './imagens'

/**
 * Rota `/editar-perfil` ("Seus dados", 3.6.4): a foto de perfil (D33), nome e
 * WhatsApp com "Salvar dados" na barra de ação, e o e-mail, que é o da
 * entrada e não muda aqui.
 */
export function TelaEditarPerfil() {
  const { conta } = useSessao()
  if (!conta)
    return (
      <Tela pilha titulo="Editar perfil">
        {null}
      </Tela>
    )
  return <DadosDaConta conta={conta} />
}

export function DadosDaConta({ conta }: { conta: Conta }) {
  const consultas = useQueryClient()
  const [nome, setNome] = useState(conta.nome)
  const [whatsapp, setWhatsapp] = useState(conta.whatsapp ?? '')
  const [erros, setErros] = useState<{ nome?: string; whatsapp?: string }>({})
  const foto = useFotoDePerfil()

  const salvar = useMutation({
    mutationFn: (corpo: { nome?: string; whatsapp?: string | null }) =>
      api.patch('/api/v1/eu', corpo),
    onSuccess: () => {
      mostrarToast({ texto: 'Dados salvos' })
      return consultas.invalidateQueries({ queryKey: CHAVES.eu })
    },
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
    <Tela
      pilha
      titulo="Editar perfil"
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Salvar dados"
            tamanho="grande"
            aoPressionar={enviar}
            carregando={salvar.isPending}
            desabilitado={!mudouNome && !mudouWhatsapp}
            motivo="Altere o nome ou o WhatsApp para salvar."
          />
        </BarraDeAcao>
      }
    >
      <Stack.Screen options={{ title: 'Editar perfil' }} />
      <EscolhaDeImagem
        nome={conta.nome}
        foto={fotoDaConta(conta)}
        avatar={conta.avatar ?? null}
        proprio
        mutacoes={foto}
        textos={{
          titulo: 'Foto de perfil',
          descricao: 'Aparece para as pessoas das suas comunidades.',
          remover: 'Remover foto',
          perguntaDeRemover: 'Remover a foto?',
          consequenciaDeRemover: 'No lugar dela volta o seu avatar de ícone e cor.',
          trocada: 'Foto atualizada',
          removida: 'Foto removida',
        }}
        alternativa={{
          titulo: 'Usar ícone e cor',
          aoPressionar: () => router.push('/escolher-avatar'),
        }}
      />
      <CartaoDeVidro sobrancelha="Seus dados" opaco intervalo={ESPACO.e16}>
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
          opcional
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
        {salvar.error ? (
          <Aviso tipo="erro" titulo="Não deu para salvar" anunciar>
            {mensagemDoErro(salvar.error)}
          </Aviso>
        ) : null}
      </CartaoDeVidro>
      <CartaoDeVidro lista>
        <LinhaDeLista
          icone="email"
          titulo="E-mail"
          descricao={`${conta.email}. É o e-mail com que você entra; não muda por aqui.`}
        />
      </CartaoDeVidro>
    </Tela>
  )
}
