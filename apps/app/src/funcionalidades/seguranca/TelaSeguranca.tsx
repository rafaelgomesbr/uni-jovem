import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { Platform, View } from 'react-native'

import { useSessao, type CredencialDoProvedor } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ContaConectada, Provedor, RespostaProvedores } from '@/servicos/contrato'
import { mensagemDoErro, SemConexao } from '@/servicos/erros'
import { confirmar } from '@/utilidades/confirmar'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { Esqueleto, LinhasDeEsqueleto } from '@/ui/Esqueleto'
import { Interruptor } from '@/ui/Interruptor'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

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
 * Perfil, Segurança (3.6.5): Face ID deste aparelho (interruptor), contas do
 * Google e da Apple conectadas, verificação em duas etapas (cartão de
 * destaque "RECOMENDADO" quando desligada) e aparelhos conectados.
 */
export function TelaSeguranca() {
  const { conta } = useSessao()
  if (!conta) return null
  return (
    <Tela
      pilha
      titulo="Segurança"
      descricao="Como você entra no Uni Jovem e onde a sua conta está aberta."
    >
      {conta.doisFatores ? null : (
        <CartaoDeDestaque
          sobrancelha="Recomendado"
          titulo="Ligue a verificação em duas etapas"
          descricao="Além da senha, um código do app autenticador passa a ser pedido ao entrar. Recomendado para quem administra uma comunidade."
          acoes={
            <Botao
              titulo="Ligar"
              icone="seguranca"
              rotuloAcessivel="Ligar a verificação em duas etapas"
              aoPressionar={() => router.push('/ativar-2fa')}
            />
          }
        />
      )}
      <SecaoBiometria />
      <SecaoContasConectadas />
      {conta.doisFatores ? (
        <Secao titulo="Verificação em duas etapas">
          <CartaoDeVidro lista>
            <LinhaDeLista
              icone="chave"
              titulo="App autenticador"
              descricao={
                conta.criador
                  ? 'Ligada. Como Criador, o código é pedido nas ações da plataforma, não ao entrar.'
                  : 'Ligada: o código do app autenticador é pedido ao entrar.'
              }
              extra={<Chip texto="Ligada" tom="sucesso" />}
            />
          </CartaoDeVidro>
        </Secao>
      ) : null}
      <Secao titulo="Aparelhos">
        <CartaoDeVidro lista>
          <LinhaDeLista
            icone="aparelho"
            titulo="Aparelhos conectados"
            descricao="Veja onde sua conta está aberta e desconecte o que não reconhecer."
            aoPressionar={() => router.push('/aparelhos')}
          />
        </CartaoDeVidro>
      </Secao>
    </Tela>
  )
}

/**
 * Face ID ou digital (3.6.5): linha de interruptor com o estado escrito
 * ("Ligado", "Desligado"); a explicação vem abaixo do cartão.
 */
function SecaoBiometria() {
  const sessao = useSessao()
  const { biometria } = sessao
  const mudar = useMutation({
    mutationFn: (ligar: boolean) => (ligar ? sessao.ligarBiometria() : sessao.desligarBiometria()),
  })

  if (Platform.OS === 'web') return null
  const nome = biometria.nome === 'biometria' ? 'Biometria' : biometria.nome

  return (
    <Secao
      titulo={nome}
      {...(biometria.disponivel
        ? {
            rodape: biometria.ligada
              ? 'A sessão guardada neste aparelho só abre com o seu rosto ou a sua digital.'
              : 'O app abre sem pedir o rosto ou a digital.',
          }
        : {})}
    >
      {biometria.disponivel ? (
        <CartaoDeVidro opaco>
          <Interruptor
            rotulo={`Entrar com ${biometria.nome}`}
            ligado={biometria.ligada}
            desabilitado={mudar.isPending}
            aoMudar={(valor) => mudar.mutate(valor)}
          />
          {mudar.error ? (
            <Aviso tipo="erro" titulo="Não deu certo" anunciar>
              {mensagemDaBiometria(mudar.error, biometria.nome)}
            </Aviso>
          ) : null}
        </CartaoDeVidro>
      ) : (
        <Aviso tipo="info" titulo={`Sem ${nome} neste aparelho`}>
          Este aparelho não tem rosto ou digital cadastrados. Cadastre nos Ajustes do aparelho para
          usar a biometria no Uni Jovem.
        </Aviso>
      )}
    </Secao>
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
      <Secao titulo="Contas conectadas">
        <Esqueleto rotulo="Carregando as contas conectadas">
          <LinhasDeEsqueleto linhas={2} />
        </Esqueleto>
      </Secao>
    )
  }
  if (provedores.error) {
    return (
      <Secao titulo="Contas conectadas">
        <Aviso
          tipo={provedores.error instanceof SemConexao ? 'alerta' : 'erro'}
          titulo="Não deu para carregar as contas conectadas"
          anunciar
          acao={{ titulo: 'Tentar de novo', aoPressionar: () => void provedores.refetch() }}
        >
          {mensagemDoErro(provedores.error)}
        </Aviso>
      </Secao>
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
    <Secao
      titulo="Contas conectadas"
      rodape="Entre com a conta do Google ou da Apple em vez de digitar a senha."
    >
      <CartaoDeVidro opaco>
        {visiveis.length === 0 ? (
          <Texto variante="corpo" cor="textoSuave">
            Nenhuma entrada com Google ou Apple está disponível neste aparelho.
          </Texto>
        ) : null}
        {desconectar.error ? <ErroDaAcao erro={desconectar.error} /> : null}
        <Lista>
          {visiveis.map((provedor) => {
            const conectada = conectadas.get(provedor)
            return (
              <LinhaDeLista
                key={provedor}
                icone="link"
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
                      variante="destrutivo"
                      rotuloAcessivel={`Desconectar a conta ${NOME[provedor]}`}
                      carregando={desconectar.isPending && desconectar.variables === provedor}
                      aoPressionar={() => void pedirDesconexao(provedor)}
                    />
                  ) : conectando !== provedor ? (
                    <Botao
                      titulo="Conectar"
                      variante="secundario"
                      rotuloAcessivel={`Conectar a conta ${NOME[provedor]}`}
                      aoPressionar={() => {
                        conectar.reset()
                        setFalhaDoProvedor(null)
                        setConectando(provedor)
                      }}
                    />
                  ) : undefined
                }
              />
            )
          })}
        </Lista>
        {conectando && !conectadas.has(conectando) ? (
          <View style={{ gap: ESPACO.e12 }}>
            <Campo
              rotulo="Senha atual"
              ajuda={`Para conectar a conta ${NOME[conectando]}, confirme que é você.`}
              senha
              value={senhaAtual}
              onChangeText={setSenhaAtual}
              erro={erroDaSenha}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
            />
            {conectar.error ? <ErroDaAcao erro={conectar.error} /> : null}
            {falhaDoProvedor ? (
              <Aviso tipo="erro" titulo="Não deu para conectar" anunciar>
                {falhaDoProvedor}
              </Aviso>
            ) : null}
            {conectando === 'apple' ? (
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
              variante="terciario"
              alinhado
              aoPressionar={() => {
                setConectando(null)
                setSenhaAtual('')
                setErroDaSenha(null)
              }}
            />
          </View>
        ) : null}
      </CartaoDeVidro>
    </Secao>
  )
}

function ErroDaAcao({ erro }: { erro: unknown }) {
  return (
    <Aviso tipo="erro" titulo="Não deu certo" anunciar>
      {mensagemDoErro(erro)}
    </Aviso>
  )
}
