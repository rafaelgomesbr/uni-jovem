import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { Redirect } from 'expo-router'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import { useSessao } from '@/estado/sessao'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { IconeDoApp } from '@/ui/IconeDoApp'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { mensagemDaBiometria } from './mensagens'

/**
 * Oferta do Face ID (3.1.3), uma vez, logo depois de entrar com senha ou
 * provedor: cartão "ENTRAR MAIS RÁPIDO" com "Agora não" (secundário) e
 * "Ligar" (primário). "Agora não" não volta a perguntar; dá para ligar
 * depois em Perfil, Segurança.
 */
export function TelaOfertaDeBiometria() {
  const sessao = useSessao()
  const { biometria } = sessao
  const ligar = useMutation({ mutationFn: () => sessao.ligarBiometria() })
  const dispensar = useMutation({ mutationFn: () => sessao.dispensarOfertaDeBiometria() })

  if (sessao.estado === 'anonimo') return <Redirect href="/entrar" />
  // Ligou ou dispensou: segue para o app.
  if (sessao.estado === 'autenticado' && !biometria.oferecer) return <Redirect href="/" />

  return (
    <Tela semCabecalho>
      <View>
        <IconeDoApp />
        <Texto variante="display" style={{ marginTop: ESPACO.e16 }}>
          {NOME_DO_APP}
        </Texto>
      </View>
      <CartaoDeVidro
        sobrancelha="Entrar mais rápido"
        comecaComTitulo
        acoes={
          <ParDeBotoes>
            <Botao
              titulo="Agora não"
              variante="secundario"
              carregando={dispensar.isPending}
              desabilitado={ligar.isPending}
              aoPressionar={() => dispensar.mutate()}
            />
            <Botao
              titulo="Ligar"
              rotuloAcessivel={`Usar ${biometria.nome}`}
              carregando={ligar.isPending}
              desabilitado={dispensar.isPending}
              aoPressionar={() => ligar.mutate()}
            />
          </ParDeBotoes>
        }
      >
        <Texto variante="tituloItem">Usar o {biometria.nome} neste aparelho</Texto>
        <Texto variante="corpo" cor="textoSuave">
          A sua sessão guardada aqui só abre com o seu rosto ou a sua digital. A senha continua
          valendo como alternativa.
        </Texto>
      </CartaoDeVidro>
      {ligar.error ? (
        <AvisoDeErro mensagem={mensagemDaBiometria(ligar.error, biometria.nome)} />
      ) : null}
    </Tela>
  )
}
