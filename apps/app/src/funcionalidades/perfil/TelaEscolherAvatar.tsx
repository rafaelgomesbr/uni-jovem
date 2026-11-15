import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CORES_DO_AVATAR,
  corDoAvatarPeloNome,
  ESPACO,
  ehCorDoAvatar,
  ehIconeDoAvatar,
  ICONES_DO_AVATAR,
  NOME_DO_ICONE_DO_AVATAR,
  NOMES_DAS_CORES_DO_AVATAR,
  RITMO,
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
import { Avatar, SIMBOLO_DO_AVATAR } from '@/ui/Avatar'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Icone } from '@/ui/Icone'
import { ALVO } from '@/ui/medidas'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

/** Lado de cada opção da grade: acima do alvo mínimo, para o toque ser folgado. */
const LADO = Math.max(ALVO, 52)

/** Rota `/escolher-avatar`: grade de ícones e de cores, prévia ao vivo e salvar. */
export function TelaEscolherAvatar() {
  const { conta } = useSessao()
  return (
    <Tela cabecalhoNativo titulo="Escolher avatar">
      <Stack.Screen options={{ title: 'Avatar' }} />
      {conta ? <EscolhaDoAvatar conta={conta} /> : null}
    </Tela>
  )
}

function EscolhaDoAvatar({ conta }: { conta: Conta }) {
  const consultas = useQueryClient()
  const atual = conta.avatar ?? null
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
      if (router.canGoBack()) router.back()
    },
  })

  return (
    <>
      <Cartao>
        <View style={{ alignItems: 'center', gap: ESPACO.x3, paddingVertical: ESPACO.x2 }}>
          <Avatar nome={conta.nome} avatar={escolha} tamanho="G" />
          <Texto variante="subtitulo" centralizado accessibilityRole="text">
            {conta.nome}
          </Texto>
          <Texto variante="apoio" cor="textoSuave" centralizado>
            É assim que as pessoas das suas comunidades veem você: na lista de pessoas, nas escalas,
            no check-in e em quem está orando.
          </Texto>
        </View>
      </Cartao>

      <Cartao titulo="Ícone" icone="celebrar">
        <Grade rotulo="Ícone do avatar">
          <Opcao
            rotulo="Iniciais, sem ícone"
            marcada={icone === null}
            aoEscolher={() => setIcone(null)}
            fundo={CORES_DO_AVATAR[corDoAvatarPeloNome(conta.nome)].fundo}
          >
            <Avatar nome={conta.nome} tamanho="M" decorativo />
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
                size={24}
                accessible={false}
              />
            </Opcao>
          ))}
        </Grade>
      </Cartao>

      <Cartao
        titulo="Cor"
        icone="ajustes"
        {...(icone === null
          ? { descricao: 'Com as iniciais, a cor vem do seu nome. Escolha um ícone para trocar.' }
          : {})}
      >
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
      </Cartao>

      {salvar.error ? <AvisoDeErro erro={salvar.error} /> : null}
      {salvar.isSuccess && !router.canGoBack() ? (
        <Aviso tipo="sucesso" anunciar>
          Avatar salvo.
        </Aviso>
      ) : null}
      <View style={{ gap: RITMO.entreBotoes }}>
        <Botao
          titulo="Salvar avatar"
          icone="confirmado"
          carregando={salvar.isPending}
          desabilitado={!mudou}
          motivo="Escolha outro ícone ou outra cor para salvar."
          aoPressionar={() => salvar.mutate(escolha)}
        />
        <Botao
          titulo="Cancelar"
          variante="terciario"
          aoPressionar={() => (router.canGoBack() ? router.back() : router.replace('/perfil'))}
        />
      </View>
    </>
  )
}

function Grade({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <View
      accessibilityRole="radiogroup"
      aria-label={rotulo}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x3 }}
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
 * marca de confirmação: forma, não só cor.
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
        backgroundColor: fundo,
        borderWidth: 3,
        borderColor: marcada ? cores.destaque : pressed ? cores.borda : 'transparent',
        opacity: desabilitada ? 0.4 : 1,
      })}
    >
      {children}
      {marcada ? (
        <View
          style={{
            position: 'absolute',
            right: -4,
            bottom: -4,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: cores.destaque,
            borderWidth: 2,
            borderColor: cores.superficie,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icone nome="confirmado" cor={cores.superficie} tamanho={14} />
        </View>
      ) : null}
    </Pressable>
  )
}
