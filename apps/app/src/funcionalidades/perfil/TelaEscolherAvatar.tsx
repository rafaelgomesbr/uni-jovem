import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ALTURA,
  BORDA,
  CORES_DO_AVATAR,
  corDoAvatarPeloNome,
  ESPACO,
  ehCorDoAvatar,
  ehIconeDoAvatar,
  ICONES_DO_AVATAR,
  NOME_DO_ICONE_DO_AVATAR,
  NOMES_DAS_CORES_DO_AVATAR,
  TAMANHO_DO_AVATAR,
  type IconeDoAvatar,
  type NomeDaCorDoAvatar,
} from '@uj/tokens'
import { router, Stack } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import { useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { AvatarDaConta, Conta } from '@/servicos/contrato'
import { mensagemDoErro } from '@/servicos/erros'
import { Avatar, SIMBOLO_DO_AVATAR } from '@/ui/Avatar'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { ALFA_DESABILITADO, comOpacidade } from '@/ui/cor'
import { Icone } from '@/ui/Icone'
import { ALVO } from '@/ui/medidas'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { mostrarToast } from '@/ui/Toast'
import { voltarOu } from '@/ui/navegacao'

import { fotoDaConta } from './imagens'

/** Lado de cada opção da grade: o avatar da linha (40) mais folga, acima do alvo mínimo. */
const LADO = Math.max(ALVO, TAMANHO_DO_AVATAR.linha + ESPACO.e12)

/**
 * Rota `/escolher-avatar`: o avatar de ícone e cor (D31), alternativa à foto
 * (D33). Prévia ao vivo, grade de ícones e de cores e "Salvar avatar" na barra
 * de ação.
 */
export function TelaEscolherAvatar() {
  const { conta } = useSessao()
  if (!conta)
    return (
      <Tela pilha titulo="Escolher avatar">
        {null}
      </Tela>
    )
  return <EscolhaDoAvatar conta={conta} />
}

function EscolhaDoAvatar({ conta }: { conta: Conta }) {
  const consultas = useQueryClient()
  const atual = conta.avatar ?? null
  const temFoto = fotoDaConta(conta) !== null
  const [icone, setIcone] = useState<IconeDoAvatar | null>(
    ehIconeDoAvatar(atual?.icone) ? atual.icone : null,
  )
  const [cor, setCor] = useState<NomeDaCorDoAvatar>(
    ehCorDoAvatar(atual?.cor) ? atual.cor : corDoAvatarPeloNome(conta.nome),
  )
  // Sem ícone, a API guarda "nenhum avatar" (iniciais com a cor derivada do nome).
  const escolha: AvatarDaConta | null = icone ? { icone, cor } : null
  const mudou =
    (escolha?.icone ?? null) !== (atual?.icone ?? null) ||
    (escolha !== null && escolha.cor !== atual?.cor)

  const salvar = useMutation({
    mutationFn: (corpo: AvatarDaConta | null) =>
      api.put('/api/v1/eu/avatar', corpo ?? { icone: null, cor: null }),
    onSuccess: async () => {
      await consultas.invalidateQueries({ queryKey: CHAVES.eu })
      mostrarToast({ texto: 'Avatar salvo' })
      voltarOu('/perfil')
    },
  })

  return (
    <Tela
      pilha
      titulo="Escolher avatar"
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Cancelar"
            variante="secundario"
            tamanho="grande"
            aoPressionar={() => voltarOu('/perfil')}
          />
          <Botao
            titulo="Salvar avatar"
            tamanho="grande"
            carregando={salvar.isPending}
            desabilitado={!mudou}
            motivo="Escolha outro ícone ou outra cor para salvar."
            aoPressionar={() => salvar.mutate(escolha)}
          />
        </BarraDeAcao>
      }
    >
      <Stack.Screen options={{ title: 'Avatar' }} />
      {temFoto ? (
        <Aviso
          tipo="info"
          titulo="Você está usando uma foto"
          acao={{ titulo: 'Trocar a foto', aoPressionar: () => router.push('/editar-perfil') }}
        >
          O ícone e a cor aparecem para as pessoas quando você remove a foto.
        </Aviso>
      ) : null}
      <CartaoDeVidro>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e16 }}>
          <Avatar nome={conta.nome} avatar={escolha} tamanho="perfil" />
          <View style={{ flex: 1, minWidth: 0, gap: ESPACO.e4 }}>
            <Texto variante="tituloItem" accessibilityRole="text">
              {conta.nome}
            </Texto>
            <Texto variante="legenda" cor="textoSuave">
              É assim que as pessoas das suas comunidades veem você: na lista de pessoas, nas
              escalas, no check-in e em quem está orando.
            </Texto>
          </View>
        </View>
      </CartaoDeVidro>

      <CartaoDeVidro sobrancelha="Ícone">
        <Grade rotulo="Ícone do avatar">
          <Opcao
            rotulo="Iniciais, sem ícone"
            marcada={icone === null}
            aoEscolher={() => setIcone(null)}
            fundo={CORES_DO_AVATAR[corDoAvatarPeloNome(conta.nome)].fundo}
          >
            <Avatar nome={conta.nome} tamanho="linha" decorativo />
          </Opcao>
          {ICONES_DO_AVATAR.map((nome) => (
            <Opcao
              key={nome}
              rotulo={NOME_DO_ICONE_DO_AVATAR[nome]}
              marcada={icone === nome}
              aoEscolher={() => setIcone(nome)}
              fundo={CORES_DO_AVATAR[cor].fundo}
            >
              <SymbolView
                name={SIMBOLO_DO_AVATAR[nome]}
                tintColor={CORES_DO_AVATAR[cor].frente}
                size={ESPACO.e24}
                accessible={false}
              />
            </Opcao>
          ))}
        </Grade>
      </CartaoDeVidro>

      <CartaoDeVidro sobrancelha="Cor">
        {icone === null ? (
          <Texto variante="legenda" cor="textoSuave">
            Com as iniciais, a cor vem do seu nome. Escolha um ícone para trocar.
          </Texto>
        ) : null}
        <Grade rotulo="Cor do avatar">
          {NOMES_DAS_CORES_DO_AVATAR.map((nome) => (
            <Opcao
              key={nome}
              rotulo={CORES_DO_AVATAR[nome].nome}
              marcada={icone !== null && cor === nome}
              desabilitada={icone === null}
              aoEscolher={() => setCor(nome)}
              fundo={CORES_DO_AVATAR[nome].fundo}
            >
              {null}
            </Opcao>
          ))}
        </Grade>
      </CartaoDeVidro>

      {salvar.error ? (
        <Aviso tipo="erro" titulo="Não deu para salvar o avatar" anunciar>
          {mensagemDoErro(salvar.error)}
        </Aviso>
      ) : null}
    </Tela>
  )
}

function Grade({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <View
      accessibilityRole="radiogroup"
      aria-label={rotulo}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e12 }}
    >
      {children}
    </View>
  )
}

interface PropsDaOpcao {
  rotulo: string
  marcada: boolean
  desabilitada?: boolean
  aoEscolher: () => void
  fundo: string
  children: ReactNode
}

/**
 * Uma opção da grade (papel `radio`). A escolhida tem anel em destaque e uma
 * marca de confirmação: forma, não só cor. Desabilitada, a cor fica a 40%.
 */
function Opcao({
  rotulo,
  marcada,
  desabilitada = false,
  aoEscolher,
  fundo,
  children,
}: PropsDaOpcao) {
  const { cores } = useTema()
  return (
    <Pressable
      accessibilityRole="radio"
      aria-label={rotulo}
      aria-checked={marcada}
      aria-disabled={desabilitada}
      disabled={desabilitada}
      onPress={aoEscolher}
      style={({ pressed }) => ({
        width: LADO,
        height: LADO,
        borderRadius: LADO / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: desabilitada ? comOpacidade(fundo, ALFA_DESABILITADO) : fundo,
        borderWidth: BORDA.contraste,
        borderColor: marcada ? cores.destaque : pressed ? cores.campoBorda : 'transparent',
      })}
    >
      {children}
      {marcada ? (
        <View
          style={{
            position: 'absolute',
            right: -ESPACO.e4,
            bottom: -ESPACO.e4,
            width: ALTURA.chip,
            height: ALTURA.chip,
            borderRadius: ALTURA.chip / 2,
            backgroundColor: cores.destaque,
            borderWidth: BORDA.contraste,
            borderColor: cores.superficie,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icone nome="check" cor={cores.superficie} tamanho={14} peso="forte" />
        </View>
      ) : null}
    </Pressable>
  )
}
