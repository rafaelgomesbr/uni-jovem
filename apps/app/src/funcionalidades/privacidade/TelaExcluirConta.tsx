import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import { ehErroDaApi, mensagemDoErro } from '@/servicos/erros'
import { confirmar } from '@/utilidades/confirmar'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

/** TC-13.v1. */
export const CONSEQUENCIAS_DA_EXCLUSAO = [
  'Você sai de todas as comunidades e é desconectado de todos os aparelhos.',
  'Seus pedidos de oração e sua disponibilidade são apagados.',
  'Seu nome, e-mail, WhatsApp e senha são apagados. Onde você aparecia (escalas passadas, presenças, sugestões, avisos), passa a aparecer "Pessoa removida". Os números da comunidade continuam.',
  'Cópias de segurança cifradas com seus dados se apagam sozinhas em até 100 dias.',
]

interface ComunidadeSemAdmin {
  id: string
  nome: string
}

/** Rota `/excluir-conta` (Apple 5.1.1(v): excluir dentro do app). */
export function TelaExcluirConta() {
  const { conta, sair, trocarComunidade } = useSessao()
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const excluir = useMutation({
    mutationFn: () =>
      api.post('/api/v1/eu/excluir-conta', {
        senha,
        ...(codigo.trim() ? { codigo: codigo.trim() } : {}),
      }),
    gcTime: 0,
    onSuccess: async () => {
      // A conta já não existe: encerra a sessão local e volta para Entrar.
      await sair()
      router.replace('/entrar')
    },
  })

  const unicoAdmin = ehErroDaApi(excluir.error, 'unico_admin')
    ? ((excluir.error.extra['comunidades'] as ComunidadeSemAdmin[] | undefined) ?? [])
    : null

  async function pedir() {
    if (!senha) {
      setErro('Digite sua senha para confirmar que é você.')
      return
    }
    if (conta?.doisFatores && !codigo.trim()) {
      setErro('Digite também o código do app autenticador.')
      return
    }
    setErro(null)
    const ok = await confirmar({
      titulo: 'Excluir sua conta?',
      mensagem: `Isso não pode ser desfeito.\n\n${CONSEQUENCIAS_DA_EXCLUSAO.join('\n')}`,
      confirmar: 'Excluir minha conta',
      destrutivo: true,
    })
    if (ok) excluir.mutate()
  }

  return (
    <Tela cabecalhoNativo titulo="Excluir sua conta?" descricao="Isso não pode ser desfeito.">
      <Cartao>
        {CONSEQUENCIAS_DA_EXCLUSAO.map((t) => (
          <Texto key={t}>{`• ${t}`}</Texto>
        ))}
        <Botao
          titulo="Antes, baixe uma cópia dos seus dados"
          icone="baixar"
          variante="discreto"
          larguraTotal={false}
          aoPressionar={() => router.push('/privacidade')}
        />
      </Cartao>

      <Cartao titulo="Confirme que é você" icone="seguranca">
        <Campo
          rotulo="Senha"
          senha
          value={senha}
          onChangeText={setSenha}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          erro={!conta?.doisFatores ? erro : null}
        />
        {conta?.doisFatores ? (
          <Campo
            rotulo="Código do app autenticador"
            ajuda="Ou um dos seus códigos de recuperação."
            value={codigo}
            onChangeText={setCodigo}
            autoCapitalize="none"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={12}
            erro={erro}
          />
        ) : null}
        {unicoAdmin ? (
          <Aviso tipo="alerta" titulo="Antes, nomeie outra pessoa administradora" anunciar>
            <View style={{ gap: ESPACO.x2 }}>
              <Texto variante="apoio">{mensagemDoErro(excluir.error)}</Texto>
              {unicoAdmin.map((c) => (
                <Botao
                  key={c.id}
                  titulo={`Abrir os membros de ${c.nome}`}
                  icone="comunidade"
                  variante="secundario"
                  aoPressionar={() => {
                    void trocarComunidade(c.id).then(() => router.push('/comunidade'))
                  }}
                />
              ))}
            </View>
          </Aviso>
        ) : excluir.error ? (
          <AvisoDeErro erro={excluir.error} />
        ) : null}
        <Botao
          titulo="Excluir minha conta"
          icone="excluir"
          variante="perigo"
          carregando={excluir.isPending}
          aoPressionar={() => void pedir()}
        />
        <Botao titulo="Cancelar" variante="discreto" aoPressionar={() => router.back()} />
      </Cartao>
    </Tela>
  )
}
