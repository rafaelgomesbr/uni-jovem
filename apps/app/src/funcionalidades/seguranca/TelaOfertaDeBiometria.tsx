import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { Redirect } from 'expo-router'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Icone } from '@/ui/Icone'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { mensagemDaBiometria } from './mensagens'

/**
 * Logo depois de entrar com senha ou provedor: "Usar Face ID para entrar?".
 * Uma pergunta só; "Agora não" não volta a perguntar (dá para ligar depois em
 * Perfil, Segurança).
 */
export function TelaOfertaDeBiometria() {
  const sessao = useSessao()
  const { cores } = useTema()
  const { biometria } = sessao
  const ligar = useMutation({ mutationFn: () => sessao.ligarBiometria() })
  const dispensar = useMutation({ mutationFn: () => sessao.dispensarOfertaDeBiometria() })

  if (sessao.estado === 'anonimo') return <Redirect href="/entrar" />
  // Ligou ou dispensou: segue para o app.
  if (sessao.estado === 'autenticado' && !biometria.oferecer) return <Redirect href="/" />

  return (
    <Tela>
      <View style={{ alignItems: 'center', gap: ESPACO.x4, paddingTop: ESPACO.x10 }}>
        <Icone nome="seguranca" cor={cores.destaque} tamanho={56} />
        <Texto variante="titulo" centralizado>
          Usar {biometria.nome} para entrar?
        </Texto>
        <Texto cor="textoSuave" centralizado>
          Com o {biometria.nome} ligado, a sua sessão guardada neste aparelho só abre com o seu
          rosto ou a sua digital. A senha continua valendo como alternativa.
        </Texto>
      </View>
      <Cartao>
        {ligar.error ? (
          <AvisoDeErro mensagem={mensagemDaBiometria(ligar.error, biometria.nome)} />
        ) : null}
        <Botao
          titulo={`Usar ${biometria.nome}`}
          icone="seguranca"
          carregando={ligar.isPending}
          desabilitado={dispensar.isPending}
          aoPressionar={() => ligar.mutate()}
        />
        <Botao
          titulo="Agora não"
          variante="discreto"
          carregando={dispensar.isPending}
          desabilitado={ligar.isPending}
          aoPressionar={() => dispensar.mutate()}
        />
      </Cartao>
    </Tela>
  )
}
