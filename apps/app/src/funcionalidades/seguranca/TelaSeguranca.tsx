import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { Platform, Switch, View } from 'react-native'

import { useSessao, type CredencialDoProvedor } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ContaConectada, Provedor, RespostaProvedores } from '@/servicos/contrato'
import { confirmar } from '@/utilidades/confirmar'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { Linha } from '@/ui/Linha'
import { Selo } from '@/ui/Selo'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import {
  BotaoApple,
  pedirCredencialDaApple,
  useAppleDisponivel,
} from '../autenticacao/provedores/BotaoApple'
import { BotaoGoogle } from '../autenticacao/provedores/BotaoGoogle'
import { googleConfigurado } from '../autenticacao/provedores/configuracao'
import { mensagemDaBiometria } from './mensagens'

const NOME: Record<Provedor, string> = { google: 'Google', apple: 'Apple' }
const CHAVE_PROVEDORES = ['eu', 'provedores'] as const

/**
 * Perfil, Segurança: biometria deste aparelho, contas do Google e da Apple
 * conectadas, verificação em duas etapas e aparelhos conectados.
 */
export function TelaSeguranca() {
  const { conta } = useSessao()
  if (!conta) return null
  return (
    <Tela
      cabecalhoNativo
      titulo="Segurança"
      descricao="Como você entra no Uni Jovem e onde a sua conta está aberta."
    >
      <SecaoBiometria />
      <SecaoContasConectadas />
      <Cartao titulo="Verificação em duas etapas" icone="chave">
        <Linha
          titulo="App autenticador"
          descricao={
            conta.doisFatores
              ? conta.criador
                ? 'Ligada. Como Criador, o código é pedido nas ações da plataforma, não ao entrar.'
                : 'Ligada: o código do app autenticador é pedido ao entrar.'
              : 'Desligada. Recomendado para quem administra uma comunidade.'
          }
          extra={
            <Selo
              texto={conta.doisFatores ? 'Ligada' : 'Desligada'}
              cor={conta.doisFatores ? 'sucesso' : 'alerta'}
            />
          }
        />
        {!conta.doisFatores ? (
          <Botao
            titulo="Ligar a verificação em duas etapas"
            icone="seguranca"
            variante="secundario"
            aoPressionar={() => router.push('/ativar-2fa')}
          />
        ) : null}
      </Cartao>
      <Cartao titulo="Aparelhos" icone="aparelho">
        <Linha
          titulo="Aparelhos conectados"
          descricao="Veja onde sua conta está aberta e desconecte o que não reconhecer."
          icone="aparelho"
          aoPressionar={() => router.push('/aparelhos')}
        />
      </Cartao>
    </Tela>
  )
}

function SecaoBiometria() {
  const sessao = useSessao()
  const { cores } = useTema()
  const { biometria } = sessao
  const mudar = useMutation({
    mutationFn: (ligar: boolean) => (ligar ? sessao.ligarBiometria() : sessao.desligarBiometria()),
  })

  if (Platform.OS === 'web') return null
  const titulo = `Entrar com ${biometria.nome}`

  return (
    <Cartao
      titulo={biometria.nome === 'biometria' ? 'Biometria' : biometria.nome}
      icone="seguranca"
    >
      {biometria.disponivel ? (
        <>
          <Linha
            titulo={titulo}
            descricao={
              biometria.ligada
                ? 'Ligado: a sessão guardada neste aparelho só abre com o seu rosto ou a sua digital.'
                : 'Desligado: o app abre sem pedir o rosto ou a digital.'
            }
            extra={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.x2 }}>
                <Selo
                  texto={biometria.ligada ? 'Ligado' : 'Desligado'}
                  cor={biometria.ligada ? 'sucesso' : 'textoSuave'}
                />
                <Switch
                  accessibilityLabel={titulo}
                  accessibilityHint="Liga ou desliga o pedido de biometria ao abrir o app."
                  value={biometria.ligada}
                  disabled={mudar.isPending}
                  onValueChange={(valor) => mudar.mutate(valor)}
                  trackColor={{ true: cores.sucesso, false: cores.borda }}
                />
              </View>
            }
          />
          {mudar.error ? (
            <AvisoDeErro mensagem={mensagemDaBiometria(mudar.error, biometria.nome)} />
          ) : null}
        </>
      ) : (
        <Texto variante="apoio" cor="textoSuave">
          Este aparelho não tem rosto ou digital cadastrados. Cadastre nos Ajustes do aparelho para
          usar a biometria no Uni Jovem.
        </Texto>
      )}
    </Cartao>
  )
}

function SecaoContasConectadas() {
  const consultas = useQueryClient()
  const appleDisponivel = useAppleDisponivel()
  const [conectando, setConectando] = useState<Provedor | null>(null)
  const [senhaAtual, setSenhaAtual] = useState('')
  const [erroDaSenha, setErroDaSenha] = useState<string | null>(null)
  const [falhaDoProvedor, setFalhaDoProvedor] = useState<string | null>(null)

  const provedores = useQuery({
    queryKey: CHAVE_PROVEDORES,
    queryFn: () => api.get<RespostaProvedores>('/api/v1/eu/provedores'),
  })
  const atualizar = () => consultas.invalidateQueries({ queryKey: CHAVE_PROVEDORES })

  const conectar = useMutation({
    mutationFn: async (pedido: { provedor: Provedor; credencial: CredencialDoProvedor | null }) => {
      let credencial = pedido.credencial
      if (pedido.provedor === 'apple') credencial = await pedirCredencialDaApple()
      if (!credencial) return null
      return api.post<ContaConectada>(`/api/v1/eu/provedores/${pedido.provedor}`, {
        ...credencial,
        senhaAtual,
      })
    },
    onSuccess: (r) => {
      if (!r) return
      setConectando(null)
      setSenhaAtual('')
      void atualizar()
    },
  })
  const desconectar = useMutation({
    mutationFn: (provedor: Provedor) => api.delete(`/api/v1/eu/provedores/${provedor}`),
    onSuccess: () => void atualizar(),
  })

  function iniciar(provedor: Provedor, credencial: CredencialDoProvedor | null) {
    if (!senhaAtual) {
      setErroDaSenha('Informe a sua senha atual para conectar.')
      return
    }
    setErroDaSenha(null)
    setFalhaDoProvedor(null)
    conectar.mutate({ provedor, credencial })
  }

  async function pedirDesconexao(provedor: Provedor) {
    const ok = await confirmar({
      titulo: `Desconectar a conta ${NOME[provedor]}?`,
      mensagem: `Você não vai mais poder entrar com ${NOME[provedor]}. E-mail e senha continuam valendo.`,
      confirmar: 'Desconectar',
      destrutivo: true,
    })
    if (ok) desconectar.mutate(provedor)
  }

  if (provedores.isPending) {
    return (
      <Cartao titulo="Contas conectadas" icone="link">
        <Carregando texto="Carregando as contas conectadas" />
      </Cartao>
    )
  }
  if (provedores.error) {
    return (
      <Cartao titulo="Contas conectadas" icone="link">
        <AvisoDeErro erro={provedores.error} aoTentarDeNovo={() => void provedores.refetch()} />
      </Cartao>
    )
  }

  const conectadas = new Map(provedores.data.provedores.map((p) => [p.provedor, p]))
  const daPlataforma: Record<Provedor, boolean> = {
    google: googleConfigurado(),
    apple: appleDisponivel,
  }
  // Conectar só onde a API e este aparelho sabem; desconectar, em qualquer aparelho.
  const visiveis = (['apple', 'google'] as const).filter(
    (p) => conectadas.has(p) || (provedores.data.disponiveis.includes(p) && daPlataforma[p]),
  )

  return (
    <Cartao titulo="Contas conectadas" icone="link">
      <Texto variante="apoio" cor="textoSuave">
        Entre com a conta do Google ou da Apple em vez de digitar a senha.
      </Texto>
      {visiveis.length === 0 ? (
        <Texto variante="apoio" cor="textoSuave">
          Nenhuma entrada com Google ou Apple está disponível neste aparelho.
        </Texto>
      ) : null}
      {desconectar.error ? <AvisoDeErro erro={desconectar.error} /> : null}
      {visiveis.map((provedor) => {
        const conectada = conectadas.get(provedor)
        return (
          <View key={provedor} style={{ gap: ESPACO.x2 }}>
            <Linha
              titulo={NOME[provedor]}
              descricao={
                conectada
                  ? conectada.email
                    ? `Conectada: ${conectada.email}`
                    : 'Conectada'
                  : 'Não conectada'
              }
              extra={
                conectada ? (
                  <Botao
                    titulo="Desconectar"
                    variante="perigo"
                    larguraTotal={false}
                    rotuloAcessivel={`Desconectar a conta ${NOME[provedor]}`}
                    carregando={desconectar.isPending && desconectar.variables === provedor}
                    aoPressionar={() => void pedirDesconexao(provedor)}
                  />
                ) : conectando !== provedor ? (
                  <Botao
                    titulo="Conectar"
                    variante="secundario"
                    larguraTotal={false}
                    rotuloAcessivel={`Conectar a conta ${NOME[provedor]}`}
                    aoPressionar={() => {
                      conectar.reset()
                      setFalhaDoProvedor(null)
                      setConectando(provedor)
                    }}
                  />
                ) : null
              }
            />
            {!conectada && conectando === provedor ? (
              <View style={{ gap: ESPACO.x3 }}>
                <Campo
                  rotulo="Senha atual"
                  ajuda={`Para conectar a conta ${NOME[provedor]}, confirme que é você.`}
                  senha
                  value={senhaAtual}
                  onChangeText={setSenhaAtual}
                  erro={erroDaSenha}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  textContentType="password"
                />
                {conectar.error ? <AvisoDeErro erro={conectar.error} /> : null}
                {falhaDoProvedor ? <AvisoDeErro mensagem={falhaDoProvedor} /> : null}
                {provedor === 'apple' ? (
                  <BotaoApple
                    tipo="continuar"
                    carregando={conectar.isPending}
                    aoPressionar={() => iniciar('apple', null)}
                  />
                ) : (
                  <BotaoGoogle
                    titulo="Conectar com Google"
                    carregando={conectar.isPending}
                    desabilitado={!senhaAtual}
                    motivo="Informe a senha atual primeiro."
                    aoObterToken={(idToken) => iniciar('google', { idToken })}
                    aoFalhar={setFalhaDoProvedor}
                  />
                )}
                <Botao
                  titulo="Cancelar"
                  variante="discreto"
                  aoPressionar={() => {
                    setConectando(null)
                    setSenhaAtual('')
                    setErroDaSenha(null)
                  }}
                />
              </View>
            ) : null}
          </View>
        )
      })}
    </Cartao>
  )
}
