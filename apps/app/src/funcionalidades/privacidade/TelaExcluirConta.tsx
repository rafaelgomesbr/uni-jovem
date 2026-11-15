import { useMutation } from '@tanstack/react-query'
import { ALTURA, ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import { ehErroDaApi, mensagemDoErro } from '@/servicos/erros'
import { confirmar } from '@/utilidades/confirmar'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Icone } from '@/ui/Icone'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

/** TC-13.v1. */
export const CONSEQUENCIAS_DA_EXCLUSAO = [
  'Você sai de todas as comunidades e é desconectado de todos os aparelhos.',
  'Seus pedidos de oração e sua disponibilidade são apagados.',
  'Seu nome, e-mail, WhatsApp e senha são apagados. Onde você aparecia (escalas passadas, presenças, sugestões, avisos), passa a aparecer "Pessoa removida". Os números da comunidade continuam.',
  'Cópias de segurança com seus dados se apagam sozinhas em até cerca de 100 dias.',
]

interface ComunidadeSemAdmin {
  id: string
  nome: string
}

/**
 * Rota `/excluir-conta` (3.7.8; Apple 5.1.1(v): excluir dentro do app). "O
 * QUE ACONTECE" em linhas com o ladrilho de erro, o terciário para baixar uma
 * cópia antes, "CONFIRME QUE É VOCÊ" com Senha e Código (cada um com o próprio
 * erro) e, na barra de ação, "Cancelar" e "Excluir minha conta" (destrutivo
 * cheio). A confirmação final continua nativa.
 */
export function TelaExcluirConta() {
  const { conta, sair, trocarComunidade } = useSessao()
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  // Um erro por campo: a falta da senha aparece na senha; a do código, no código.
  const [erros, setErros] = useState<{ senha?: string; codigo?: string }>({})
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
    const novos: { senha?: string; codigo?: string } = {}
    if (!senha) novos.senha = 'Digite sua senha para confirmar que é você.'
    if (conta?.doisFatores && !codigo.trim()) {
      novos.codigo = 'Digite também o código do app autenticador.'
    }
    setErros(novos)
    if (novos.senha || novos.codigo) return
    const ok = await confirmar({
      titulo: 'Excluir sua conta?',
      mensagem: `Isso não pode ser desfeito.\n\n${CONSEQUENCIAS_DA_EXCLUSAO.join('\n')}`,
      confirmar: 'Excluir minha conta',
      destrutivo: true,
    })
    if (ok) excluir.mutate()
  }

  return (
    <Tela
      pilha
      titulo="Excluir sua conta?"
      descricao="Isso não pode ser desfeito."
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Cancelar"
            variante="secundario"
            tamanho="grande"
            desabilitado={excluir.isPending}
            aoPressionar={() => router.back()}
          />
          <Botao
            titulo="Excluir minha conta"
            variante="destrutivoCheio"
            tamanho="grande"
            carregando={excluir.isPending}
            aoPressionar={() => void pedir()}
          />
        </BarraDeAcao>
      }
    >
      <Secao titulo="O que acontece">
        <CartaoDeVidro opaco>
          {CONSEQUENCIAS_DA_EXCLUSAO.map((t) => (
            <Consequencia key={t} texto={t} />
          ))}
        </CartaoDeVidro>
      </Secao>
      <Botao
        titulo="Antes, baixe uma cópia dos seus dados"
        icone="baixar"
        variante="terciario"
        alinhado
        aoPressionar={() => router.push('/privacidade')}
      />

      <CartaoDeVidro sobrancelha="Confirme que é você" opaco intervalo={ESPACO.e16}>
        <Campo
          rotulo="Senha"
          senha
          value={senha}
          onChangeText={setSenha}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          erro={erros.senha ?? null}
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
            erro={erros.codigo ?? null}
          />
        ) : null}
      </CartaoDeVidro>

      {unicoAdmin ? (
        <Aviso tipo="alerta" titulo="Antes, nomeie outra pessoa administradora" anunciar>
          <View style={{ gap: ESPACO.e8 }}>
            <Texto variante="legenda">{mensagemDoErro(excluir.error)}</Texto>
            {unicoAdmin.map((c) => (
              <Botao
                key={c.id}
                titulo={`Abrir os membros de ${c.nome}`}
                variante="terciario"
                alinhado
                aoPressionar={() => {
                  void trocarComunidade(c.id).then(() => router.push('/comunidade'))
                }}
              />
            ))}
          </View>
        </Aviso>
      ) : excluir.error ? (
        <Aviso tipo="erro" titulo="Não deu para excluir a conta" anunciar>
          {mensagemDoErro(excluir.error)}
        </Aviso>
      ) : null}
    </Tela>
  )
}

/**
 * Uma consequência (3.7.8): ladrilho de 32 no fundo de erro com o ícone de
 * "x", no lugar do marcador de lista, e o texto em `corpo` (o ícone é forma,
 * o texto diz tudo).
 */
function Consequencia({ texto }: { texto: string }) {
  const { cores, solido } = useTema()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e12 }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: ALTURA.ladrilho,
          height: ALTURA.ladrilho,
          borderRadius: RAIO.celula,
          backgroundColor: solido(cores.erroFundo),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icone nome="cancelar" cor={cores.erro} tamanho={18} />
      </View>
      <Texto variante="corpo" style={{ flex: 1 }}>
        {texto}
      </Texto>
    </View>
  )
}
