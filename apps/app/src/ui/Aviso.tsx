import { ESPACO, RAIO, type Paleta } from '@uj/tokens'
import type { ReactNode } from 'react'
import { View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Botao } from './Botao'
import { Icone, type NomeDoIcone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'
import { useAnunciar } from './useAnunciar'

export type TipoDeAviso = 'info' | 'sucesso' | 'alerta' | 'erro'

const APARENCIA: Readonly<
  Record<TipoDeAviso, { cor: keyof Paleta; fundo: keyof Paleta; icone: NomeDoIcone }>
> = {
  info: { cor: 'info', fundo: 'infoFundo', icone: 'avisoInfo' },
  sucesso: { cor: 'sucesso', fundo: 'sucessoFundo', icone: 'avisoSucesso' },
  alerta: { cor: 'alerta', fundo: 'alertaFundo', icone: 'avisoAlerta' },
  erro: { cor: 'erro', fundo: 'erroFundo', icone: 'avisoErro' },
}

export interface PropsDoAviso {
  tipo?: TipoDeAviso
  /** Título específico ("Sem conexão: o Início volta quando a internet voltar"), nunca "Atenção". */
  titulo?: string
  children?: ReactNode
  /** Terciário abaixo do texto ("Tentar de novo", "Ver pedidos"). */
  acao?: { titulo: string; aoPressionar: () => void; rotuloAcessivel?: string }
  /** Anuncia ao leitor de tela quando aparece. Erro sempre anuncia. */
  anunciar?: boolean
}

/**
 * Aviso (seção 2.12.23): raio 14, padding 14 por 16, fundo do tipo e sem
 * borda (borda de 2 na cor do tipo com "Aumentar contraste"). Ícone de 18 na
 * cor do tipo, alinhado ao topo; título e texto em `texto`. O ícone e o
 * título dizem o tipo: a cor só reforça.
 *
 * Só vira um elemento único para o leitor de tela quando o conteúdo é texto:
 * com botões dentro, cada um precisa continuar alcançável no VoiceOver.
 */
export function Aviso({ tipo = 'info', titulo, children, acao, anunciar = false }: PropsDoAviso) {
  const { cores, solido } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const a = APARENCIA[tipo]
  const soTexto = !acao && (children === undefined || typeof children === 'string')
  const falado = [titulo, typeof children === 'string' ? children : null].filter(Boolean).join('. ')
  // Com texto, o papel `alert` já fala na web; com botões dentro, não há alerta e a web anuncia.
  useAnunciar(anunciar || tipo === 'erro' ? falado : null, { naWeb: !soTexto })
  return (
    <View
      {...(soTexto
        ? {
            accessible: true,
            accessibilityRole: anunciar || tipo === 'erro' ? ('alert' as const) : ('text' as const),
          }
        : {})}
      style={{
        flexDirection: 'row',
        gap: ESPACO.e12,
        paddingVertical: ESPACO.e14,
        paddingHorizontal: ESPACO.e16,
        borderRadius: RAIO.controle,
        backgroundColor: solido(cores[a.fundo]),
        borderWidth: aumentarContraste ? 2 : 0,
        borderColor: aumentarContraste ? cores[a.cor] : 'transparent',
        alignSelf: 'stretch',
      }}
    >
      <View style={{ paddingTop: 2 }}>
        <Icone nome={a.icone} cor={cores[a.cor]} tamanho={18} />
      </View>
      <View style={{ flex: 1 }}>
        {titulo ? <Texto variante="tituloItem">{titulo}</Texto> : null}
        {typeof children === 'string' ? <Texto variante="legenda">{children}</Texto> : children}
        {acao ? (
          <View style={{ marginTop: 2, marginBottom: -10 }}>
            <Botao
              titulo={acao.titulo}
              variante="terciario"
              alinhado
              aoPressionar={acao.aoPressionar}
              {...(acao.rotuloAcessivel ? { rotuloAcessivel: acao.rotuloAcessivel } : {})}
            />
          </View>
        ) : null}
      </View>
    </View>
  )
}
