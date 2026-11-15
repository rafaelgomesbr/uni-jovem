import { QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'

import { criarClienteDeConsulta, ligarGerentesDoReactQuery } from '@/estado/clienteDeConsulta'
import { ProvedorDeSessao, useSessao } from '@/estado/sessao'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { DialogoDeConfirmacao } from '@/ui/DialogoDeConfirmacao'
import { EstilosDaWeb } from '@/ui/EstilosDaWeb'
import { useOpcoesDaPilha } from '@/funcionalidades/navegacao/opcoesDaPilha'
import { ProvedorOffline } from '@/funcionalidades/offline/ProvedorOffline'
import { ARQUIVOS_DE_FONTE } from '@/ui/fontes'
import { Tela } from '@/ui/Tela'
import { useTema } from '@/ui/tema'

// A abertura fica na tela até as fontes carregarem e a sessão salva ser conferida.
void SplashScreen.preventAutoHideAsync()

export default function LayoutRaiz() {
  const [clienteDeConsulta] = useState(criarClienteDeConsulta)
  const [fontesCarregadas, erroDeFonte] = useFonts(ARQUIVOS_DE_FONTE)

  // Liga o React Query à rede e ao primeiro plano do aparelho.
  useEffect(() => ligarGerentesDoReactQuery(), [])

  return (
    <QueryClientProvider client={clienteDeConsulta}>
      <ProvedorDeSessao>
        {/* Camada offline (F13): fica acima da navegação para sobreviver à troca de conta. */}
        <ProvedorOffline>
          {/* Sem a fonte, o app segue com a do sistema: melhor que travar na abertura. */}
          <Navegacao fontesProntas={fontesCarregadas || erroDeFonte !== null} />
        </ProvedorOffline>
      </ProvedorDeSessao>
    </QueryClientProvider>
  )
}

function Navegacao({ fontesProntas }: { fontesProntas: boolean }) {
  const sessao = useSessao()
  const { cores, escuro } = useTema()
  const opcoesDaPilha = useOpcoesDaPilha()
  const pronto = fontesProntas && (sessao.pronto || sessao.falhaAoIniciar !== null)

  useEffect(() => {
    if (pronto) SplashScreen.hide()
  }, [pronto])

  if (!pronto) return null

  const base = escuro ? DarkTheme : DefaultTheme
  const tema: Theme = {
    ...base,
    colors: {
      primary: cores.destaque,
      background: cores.fundo,
      card: cores.superficie,
      text: cores.texto,
      border: cores.borda,
      notification: cores.primaria,
    },
  }

  if (!sessao.pronto && sessao.falhaAoIniciar) {
    return (
      <ThemeProvider value={tema}>
        <EstilosDaWeb />
        <Tela titulo="Não foi possível abrir">
          <AvisoDeErro erro={sessao.falhaAoIniciar} aoTentarDeNovo={sessao.tentarDeNovo} />
        </Tela>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider value={tema}>
      <StatusBar style={escuro ? 'light' : 'dark'} />
      <EstilosDaWeb />
      <Stack screenOptions={{ ...opcoesDaPilha, headerShown: false }}>
        <Stack.Screen name="(autenticado)" />
        <Stack.Screen name="(publico)" />
        <Stack.Screen name="convite" options={{ title: 'Convite' }} />
        <Stack.Screen name="redefinir-senha" options={{ title: 'Senha nova' }} />
        <Stack.Screen name="primeiro-acesso" options={{ title: 'Primeiro acesso' }} />
        <Stack.Screen name="+not-found" options={{ title: 'Não encontrado' }} />
      </Stack>
      {/* Confirmações da web (no celular, o diálogo é o do sistema). */}
      <DialogoDeConfirmacao />
    </ThemeProvider>
  )
}
