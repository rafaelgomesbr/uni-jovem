import { ALTURA, ESPACO, MARCA_DA_APPLE, MARCA_DO_GOOGLE, RAIO } from '@uj/tokens'
import { ActivityIndicator, Pressable, View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { useAnelDeFoco } from './foco'
import { LogoDaApple } from './LogoDaApple'
import { LogoDoGoogle } from './LogoDoGoogle'
import { Texto } from './Texto'
import { useTema } from './tema'

export type MarcaDeAcesso = 'apple' | 'google'

interface Aparencia {
  fundo: string
  fundoPressionado: string
  texto: string
  textoInativo: string
  borda: string
}

/** Cores fixas de cada marca (não seguem a paleta do tema); a Apple troca com o claro e o escuro. */
function aparenciaDaMarca(marca: MarcaDeAcesso, escuro: boolean): Aparencia {
  if (marca === 'google') {
    const g = MARCA_DO_GOOGLE
    return {
      fundo: g.fundo,
      fundoPressionado: g.pressionado,
      texto: g.texto,
      textoInativo: g.textoInativo,
      borda: g.borda,
    }
  }
  const a = escuro ? MARCA_DA_APPLE.escuro : MARCA_DA_APPLE.claro
  return {
    fundo: a.fundo,
    fundoPressionado: a.pressionado,
    texto: a.texto,
    textoInativo: a.textoInativo,
    // Na versão preta a borda some; na branca, o fundo escuro do tema já a separa.
    borda: a.fundo,
  }
}

export interface PropsDoBotaoDeAcessoRapido {
  marca: MarcaDeAcesso
  /** O texto é sempre o do botão ("Continuar com a Apple"): é também o nome para o leitor de tela. */
  titulo: string
  carregando?: boolean
  inativo?: boolean
  /** Por que está inativo (lido pelo leitor de tela e mostrado embaixo). */
  motivo?: string
  aoPressionar: () => void
}

/**
 * Acesso rápido grande (Apple e Google): 56 de altura, raio 14, logotipo
 * oficial à esquerda do texto e as cores fixas da marca. O texto fica em
 * português; as regras de marca aceitam o rótulo localizado desde que o
 * logotipo e as proporções sejam mantidos. Carregando, o indicador troca o
 * logotipo e o botão continua do mesmo tamanho.
 */
export function BotaoDeAcessoRapido({
  marca,
  titulo,
  carregando = false,
  inativo = false,
  motivo,
  aoPressionar,
}: PropsDoBotaoDeAcessoRapido) {
  const { cores, escuro } = useTema()
  const { reduzirMovimento, aumentarContraste } = usePreferenciasDeAcessibilidade()
  const anel = useAnelDeFoco(cores.foco)
  const a = aparenciaDaMarca(marca, escuro)
  const bloqueado = inativo || carregando
  const mostrarMotivo = !!motivo && inativo && !carregando
  const corDoTexto = inativo && !carregando ? a.textoInativo : a.texto
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={titulo}
        {...(mostrarMotivo ? { accessibilityHint: motivo } : {})}
        aria-disabled={bloqueado}
        aria-busy={carregando}
        disabled={bloqueado}
        onPress={aoPressionar}
        onFocus={anel.onFocus}
        onBlur={anel.onBlur}
        style={({ pressed }) => [
          {
            minHeight: ALTURA.controleAlto,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: ESPACO.e12,
            paddingHorizontal: ESPACO.e20,
            paddingVertical: ESPACO.e8,
            borderRadius: RAIO.controle,
            borderWidth: aumentarContraste ? 2 : 1,
            borderColor: aumentarContraste ? a.texto : a.borda,
            backgroundColor: pressed ? a.fundoPressionado : a.fundo,
            transform: [{ scale: pressed && !bloqueado && !reduzirMovimento ? 0.98 : 1 }],
          },
          anel.estilo,
        ]}
      >
        {carregando ? (
          <ActivityIndicator
            color={a.texto}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ) : marca === 'apple' ? (
          <LogoDaApple cor={corDoTexto} />
        ) : (
          <LogoDoGoogle />
        )}
        <Texto variante="botao" style={{ color: corDoTexto, flexShrink: 1 }} centralizado>
          {titulo}
        </Texto>
      </Pressable>
      {mostrarMotivo ? (
        <Texto variante="legenda" cor="textoSuave" style={{ marginTop: ESPACO.e6 }}>
          {motivo}
        </Texto>
      ) : null}
    </View>
  )
}
