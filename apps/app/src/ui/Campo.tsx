/* eslint-disable no-restricted-syntax -- opacidade aqui é a camada animada do anel, do Limpar e da mensagem, não estado (D64) */
import {
  ALTURA,
  BORDA,
  ESPACO,
  HALO_DE_FOCO,
  MOVIMENTO_DOS_CONTROLES,
  RAIO,
  RITMO_DE_ACESSO,
  TIPO,
} from '@uj/tokens'
import { useEffect, useId, useState, type ComponentRef, type ReactNode, type Ref } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Abalar } from './Abalar'
import { ContextoDoBotaoEncaixado } from './Botao'
import { comOpacidade } from './cor'
import { FAMILIA } from './fontes'
import { Icone, type NomeDoIcone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'
import { useAnunciar } from './useAnunciar'
import { soNaWeb } from './web'

/** Estado visual da caixa (tabela de estados de 3.2 de `docs/design/controles-v2.md`). */
export type EstadoDaCaixa =
  'normal' | 'foco' | 'erro' | 'sucesso' | 'desabilitado' | 'somenteLeitura'

// A curva nasce no uso, não na importação: o campo é importado por quase todo o app.
const saida = () => Easing.out(Easing.quad)

/**
 * Fundo, borda e medida da caixa em cada estado (D64): caixa de 56 e raio 16,
 * fundo um degrau acima do cartão, borda neutra de 1 pt a 3:1 ou mais. O foco e
 * o erro ganham o anel de 2 pt em camada (`AnelDoCampo`), que não desloca o
 * texto: a espessura da borda não muda de um estado para o outro.
 * `alturaMinima` e `alturaMaxima` valem para a área de texto.
 */
export function useEstiloDaCaixa(
  estado: EstadoDaCaixa,
  multilinha = false,
  alturaMinima?: number,
  alturaMaxima?: number,
): ViewStyle {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const base: ViewStyle = {
    minHeight: alturaMinima ?? (multilinha ? ALTURA.areaDeTexto.padrao.min : ALTURA.campo),
    ...(alturaMaxima ? { maxHeight: alturaMaxima } : {}),
    borderRadius: RAIO.campo,
    flexDirection: 'row',
    alignItems: multilinha ? 'flex-start' : 'center',
    borderWidth: aumentarContraste ? BORDA.contraste : BORDA.fina,
  }
  // O fundo é opaco e igual dentro e fora do cartão: sobre os brilhos da Aurora ele protege a leitura.
  const opaco = cores.campoFundo
  switch (estado) {
    case 'foco':
      return { ...base, backgroundColor: opaco, borderColor: cores.foco }
    case 'erro':
      return { ...base, backgroundColor: opaco, borderColor: cores.erro }
    case 'sucesso':
      return { ...base, backgroundColor: opaco, borderColor: cores.sucesso }
    case 'desabilitado':
      return {
        ...base,
        backgroundColor: cores.campoDesabilitado,
        borderColor: aumentarContraste ? cores.textoSuave : 'transparent',
      }
    case 'somenteLeitura':
      return {
        ...base,
        backgroundColor: 'transparent',
        borderColor: aumentarContraste ? cores.texto : cores.tonalBorda,
      }
    case 'normal':
      return {
        ...base,
        backgroundColor: opaco,
        borderColor: aumentarContraste ? cores.texto : cores.campoBorda,
      }
  }
}

/** A camada do anel: 1 pt além da borda de cada lado, com o raio da caixa, sobre ela. */
const CAMADA_DO_ANEL = {
  position: 'absolute',
  top: -BORDA.fina,
  left: -BORDA.fina,
  right: -BORDA.fina,
  bottom: -BORDA.fina,
  borderRadius: RAIO.campo,
  borderWidth: BORDA.anel,
} as const

interface PropsDoAnelDoCampo {
  /** Foco do campo (ou o seletor aberto, na data e na hora). */
  ativo: boolean
  /** Erro (ou `invalido`): o anel de erro é permanente e vale sobre o de foco. */
  comErro: boolean
  testID?: string | undefined
}

/**
 * Anel de foco e de erro do campo (D64), em camadas que só mudam de `opacity`:
 * o texto não se desloca. Foco: anel de 2 pt coral mais halo de 4 pt, que
 * entram em 160 ms e saem em 120 (0 com "Reduzir movimento"). Erro: anel de 2 pt
 * permanente; com foco e erro juntos vale o de erro e o halo vira `erroFundo`.
 */
export function AnelDoCampo({ ativo, comErro, testID }: PropsDoAnelDoCampo) {
  const { cores } = useTema()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const foco = useSharedValue(ativo ? 1 : 0)
  useEffect(() => {
    foco.set(
      withTiming(ativo ? 1 : 0, {
        duration: reduzirMovimento
          ? 0
          : ativo
            ? MOVIMENTO_DOS_CONTROLES.foco
            : MOVIMENTO_DOS_CONTROLES.focoSaida,
        easing: saida(),
        reduceMotion: ReduceMotion.Never,
      }),
    )
  }, [ativo, reduzirMovimento, foco])
  const estiloDoFoco = useAnimatedStyle(() => ({ opacity: foco.value }))
  return (
    <>
      <Animated.View
        pointerEvents="none"
        {...(testID ? { testID: `${testID}-anel` } : {})}
        style={[
          CAMADA_DO_ANEL,
          {
            borderColor: comErro ? cores.erro : cores.foco,
            boxShadow: `0px 0px 0px ${HALO_DE_FOCO}px ${comErro ? cores.erroFundo : cores.focoHalo}`,
          },
          estiloDoFoco,
        ]}
      />
      {comErro ? (
        <View
          pointerEvents="none"
          {...(testID ? { testID: `${testID}-anel-de-erro` } : {})}
          style={[CAMADA_DO_ANEL, { borderColor: cores.erro }]}
        />
      ) : null}
    </>
  )
}

/** Uma mensagem de apoio aparece subindo 4 pt e dissolvendo em 200 ms (só dissolve com Reduzir movimento). */
function Aparece({ children }: { children: ReactNode }) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const progresso = useSharedValue(0)
  useEffect(() => {
    progresso.set(
      withTiming(1, {
        duration: reduzirMovimento
          ? MOVIMENTO_DOS_CONTROLES.mensagemDeErroReduzida
          : MOVIMENTO_DOS_CONTROLES.mensagemDeErro,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.Never,
      }),
    )
  }, [progresso, reduzirMovimento])
  const estilo = useAnimatedStyle(() => ({
    opacity: progresso.value,
    transform: [
      {
        translateY: reduzirMovimento
          ? 0
          : (1 - progresso.value) * MOVIMENTO_DOS_CONTROLES.deslocamentoDaMensagem,
      },
    ],
  }))
  return <Animated.View style={[{ flex: 1 }, estilo]}>{children}</Animated.View>
}

/** Contador de caracteres: normal; a partir de 90% do limite, peso 600 e alerta; no limite, erro. */
export interface ContadorDoCampo {
  atual: number
  limite: number
}

function nivelDoContador({ atual, limite }: ContadorDoCampo): 'normal' | 'perto' | 'limite' {
  if (atual >= limite) return 'limite'
  return atual >= limite * 0.9 ? 'perto' : 'normal'
}

interface PropsDoBlocoDoCampo {
  rotulo: string
  /** "(opcional)" no próprio rótulo, em 400. */
  opcional?: boolean
  /** Some só da vista (busca): o rótulo continua sendo o nome acessível. */
  rotuloOculto?: boolean
  idDoRotulo: string
  ajuda?: string | undefined
  erro?: string | null | undefined
  /** Frase de sucesso ("Nome disponível"), no lugar da ajuda. */
  sucesso?: string | undefined
  /** Apoio vivo quando não há erro (o status da senha, "7 de 10 caracteres"). */
  apoio?: string | null | undefined
  idDaAjuda: string
  idDoErro: string
  contador?: ContadorDoCampo | undefined
  /** Reserva a linha de apoio mesmo vazia (campos lado a lado, para a próxima linha alinhar). */
  reservarApoio?: boolean
  /** À direita do rótulo, na mesma linha ("Esqueci a senha"). */
  aoLado?: ReactNode
  /**
   * Fenda da entrada: 6 mais 20 sempre reservados embaixo, para o erro não empurrar o botão
   * (a tela de acesso cabe sem rolar em 375 x 667).
   */
  fenda?: boolean
  children: ReactNode
}

/**
 * Rótulo, caixa e uma linha de apoio, todos com a borda esquerda em x=0:
 * rótulo (20), 8, caixa (56), 8, apoio (20). O rótulo vem em `texto` 600; a
 * ajuda, em `textoSuave` 400: a hierarquia é de cor e de peso. O erro tem sempre
 * ícone em `erro` e frase em `texto`, em qualquer superfície.
 */
export function BlocoDoCampo({
  rotulo,
  opcional,
  rotuloOculto,
  idDoRotulo,
  ajuda,
  erro,
  sucesso,
  apoio,
  idDaAjuda,
  idDoErro,
  contador,
  reservarApoio,
  aoLado,
  fenda = false,
  children,
}: PropsDoBlocoDoCampo) {
  const { cores } = useTema()
  const nivel = contador ? nivelDoContador(contador) : 'normal'
  const temApoio = !!(erro || sucesso || apoio || ajuda || contador)
  return (
    // 4 de folga embaixo: com o intervalo de 12 a 16 das telas, o próximo campo fica a 16 a 20 (o rótulo
    // fica a 8 da própria caixa, então o olho sabe a quem ele pertence). A fenda da entrada já tem a dela.
    <View style={{ alignSelf: 'stretch', marginBottom: fenda ? 0 : ESPACO.e4 }}>
      {rotuloOculto && !aoLado ? null : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            columnGap: ESPACO.e12,
            marginBottom: ESPACO.e8,
          }}
        >
          {rotuloOculto ? (
            <View />
          ) : (
            <Texto variante="rotulo" cor="texto" nativeID={idDoRotulo}>
              {rotulo}
              {opcional ? (
                <Texto variante="rotulo" peso="regular" cor="textoSuave">
                  {' (opcional)'}
                </Texto>
              ) : null}
            </Texto>
          )}
          {aoLado}
        </View>
      )}
      {children}
      {temApoio || reservarApoio || fenda ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: ESPACO.e8,
            marginTop: fenda ? ESPACO.e6 : ESPACO.e8,
            minHeight: fenda ? RITMO_DE_ACESSO.fendaDeErro - ESPACO.e6 : TIPO.legenda.altura,
            justifyContent: 'flex-start',
          }}
        >
          <View style={{ flex: 1, flexDirection: 'row' }}>
            {erro ? (
              <Aparece key={erro}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e6 }}>
                  <View style={{ height: TIPO.meta.altura, justifyContent: 'center' }}>
                    <Icone nome="erroDeCampo" cor={cores.erro} tamanho={16} />
                  </View>
                  {/* Frase em `texto`, ícone em `erro`: sobre o pico da Aurora o `erro` não passa AA. */}
                  <Texto variante="meta" peso="forte" nativeID={idDoErro} style={{ flex: 1 }}>
                    {erro}
                  </Texto>
                </View>
              </Aparece>
            ) : sucesso ? (
              <Aparece key={sucesso}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e6 }}>
                  <View style={{ height: TIPO.meta.altura, justifyContent: 'center' }}>
                    <Icone nome="avisoSucesso" cor={cores.sucesso} tamanho={16} />
                  </View>
                  <Texto variante="meta" peso="forte" style={{ flex: 1 }}>
                    {sucesso}
                  </Texto>
                </View>
              </Aparece>
            ) : apoio ? (
              <Texto
                variante="meta"
                cor="textoSuave"
                accessibilityLiveRegion="polite"
                style={{ flex: 1 }}
              >
                {apoio}
              </Texto>
            ) : ajuda ? (
              <Texto
                variante="legenda"
                cor="textoSuave"
                nativeID={idDaAjuda}
                importantForAccessibility="no"
                style={{ flex: 1 }}
              >
                {ajuda}
              </Texto>
            ) : null}
          </View>
          {contador ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e4 }}>
              {nivel !== 'normal' ? (
                <Icone
                  nome={nivel === 'limite' ? 'erroDeCampo' : 'avisoAlerta'}
                  cor={nivel === 'limite' ? cores.erro : cores.alerta}
                  tamanho={14}
                />
              ) : null}
              <Texto
                variante="legenda"
                cor={nivel === 'normal' ? 'textoSuave' : 'texto'}
                peso={nivel === 'normal' ? 'regular' : 'forte'}
                tabular
                accessibilityLabel={`${contador.atual} de ${contador.limite} caracteres${
                  nivel === 'limite' ? ', limite atingido' : ''
                }`}
              >
                {`${contador.atual}/${contador.limite}`}
              </Texto>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

export interface PropsDoCampo extends Omit<
  TextInputProps,
  'style' | 'secureTextEntry' | 'accessibilityLabel' | 'placeholder' | 'editable'
> {
  /** Sempre visível acima do campo: placeholder não substitui rótulo. */
  rotulo: string
  opcional?: boolean
  erro?: string | null
  /**
   * Inválido sem mensagem própria (o erro é do formulário inteiro, mostrado em
   * outro lugar): o campo ganha o anel de erro, o ícone e o `aria-invalid`.
   */
  invalido?: boolean
  /** Frase de sucesso ("Nome disponível"): borda e check em `sucesso`, no lugar da ajuda. */
  sucesso?: string
  /** Orientação curta abaixo do campo. Some quando há erro (o erro diz como corrigir). */
  ajuda?: string
  /** Apoio vivo abaixo do campo quando não há erro (o status da senha, "7 de 10 caracteres"). */
  apoio?: string | null
  /**
   * Nome para o leitor de tela quando o rótulo visível é curto fora do
   * contexto ("Nome" no cartão "Chegou sem inscrição" vira "Nome de quem chegou").
   */
  rotuloAcessivel?: string
  /** Campo de senha, com "Mostrar" e "Ocultar" em texto ao lado do olho. */
  senha?: boolean
  /** Só exemplo ("ana@exemplo.com"), nunca instrução. */
  exemplo?: string
  /**
   * Data ou hora digitada (legado: as telas novas usam `CampoDeData` e
   * `CampoDeHora`). O formato vai na ajuda.
   */
  formato?: 'data' | 'hora'
  desabilitado?: boolean
  somenteLeitura?: boolean
  /** Não edita, mas nada muda no desenho (enviando: o botão já diz que está enviando). */
  semEdicao?: boolean
  /** Conferindo o valor (ex.: disponibilidade): indicador de 16 à direita. */
  validando?: boolean
  /** Texto à esquerda do valor, dentro da caixa ("R$", "+55"). */
  prefixo?: string
  /** Texto curto à direita ("min"). */
  sufixo?: string
  /** Ícone de 20 à esquerda: diz "o que é" (busca, calendário, relógio, cadeado). */
  icone?: NomeDoIcone
  /** Ação só ícone à direita (limpar). */
  acao?: { icone: NomeDoIcone; rotulo: string; aoPressionar: () => void }
  /** Botão "Limpar" à direita enquanto há texto. */
  limpavel?: boolean
  /** Código de 6 dígitos: algarismos largos e espaçados. */
  codigo?: boolean
  /**
   * Texto longo de quem escreve (pedido de oração, 3.7.1): área de texto em
   * `leitura` 17/26, de 5 a 10 linhas, o mesmo papel em que o texto vai ser lido.
   */
  leitura?: boolean
  /**
   * Área de texto que cresce com o conteúdo, de `min` a `max` linhas (3 a 8 por
   * padrão, 5 a 10 em `leitura`); passando do máximo, rola por dentro.
   */
  linhas?: { min: number; max: number }
  /**
   * Campo e botão na mesma linha: o botão assume a altura da caixa (56) e o
   * raio do campo; o rótulo fica sobre o campo e a ajuda ou o erro abaixo da linha inteira.
   */
  botao?: ReactNode
  /** Contador de caracteres à direita da linha de apoio (precisa de `maxLength`). */
  mostrarContador?: boolean
  rotuloOculto?: boolean
  reservarApoio?: boolean
  /** À direita do rótulo, na mesma linha ("Esqueci a senha"). */
  aoLado?: ReactNode
  /** Cada vez que sobe, o campo balança 5 pt (erro ao enviar). Sem a prop, não há balanço. */
  disparoDeErro?: number
  /** Reserva a fenda de 26 embaixo (a entrada: o erro não empurra o botão). */
  fenda?: boolean
  /** Só o catálogo: desenha o foco sem teclado. */
  estadoDeVitrine?: 'foco'
  ref?: Ref<ComponentRef<typeof TextInput>>
}

/** Linhas da área de texto: mínimo e máximo, com a entrelinha do papel. */
function medidasDaAreaDeTexto(leitura: boolean, linhas?: { min: number; max: number }) {
  const padrao = leitura ? ALTURA.areaDeTexto.leitura : ALTURA.areaDeTexto.padrao
  const preenchimento = 2 * ESPACO.e16 + 2 * BORDA.fina
  return {
    linha: padrao.linha,
    min: linhas ? linhas.min * padrao.linha + preenchimento : padrao.min,
    max: linhas ? linhas.max * padrao.linha + preenchimento : padrao.max,
  }
}

export function Campo({
  rotulo,
  rotuloAcessivel,
  opcional,
  erro,
  invalido = false,
  sucesso,
  ajuda: ajudaDoCampo,
  apoio,
  senha = false,
  exemplo,
  formato,
  desabilitado = false,
  somenteLeitura = false,
  semEdicao = false,
  validando = false,
  prefixo,
  sufixo,
  icone,
  acao,
  limpavel = false,
  codigo = false,
  leitura = false,
  linhas,
  botao,
  mostrarContador = false,
  rotuloOculto = false,
  reservarApoio,
  aoLado,
  disparoDeErro,
  fenda = false,
  estadoDeVitrine,
  multiline: multilinhaPedido,
  onFocus,
  onBlur,
  ref,
  ...resto
}: PropsDoCampo) {
  const { cores } = useTema()
  const id = useId()
  const multiline = multilinhaPedido || leitura
  const nomeAcessivel = rotuloAcessivel ?? rotulo
  const [focado, setFocado] = useState(false)
  const [visivel, setVisivel] = useState(false)
  const ajudaDoFormato =
    formato === 'data' ? 'Formato DD/MM/AAAA.' : formato === 'hora' ? 'Formato HH:MM.' : null
  const ajuda = [ajudaDoFormato, ajudaDoCampo].filter(Boolean).join(' ') || undefined
  const idDoRotulo = `rotulo-${id}`
  const idDaAjuda = `ajuda-${id}`
  const idDoErro = `erro-${id}`
  const comErro = !!erro || invalido
  const descricao = erro ? `Erro: ${erro}` : invalido ? 'Valor inválido' : (ajuda ?? '')
  const texto = resto.value ?? ''
  const contador: ContadorDoCampo | undefined =
    mostrarContador && resto.maxLength
      ? { atual: texto.length, limite: resto.maxLength }
      : undefined
  // No iOS a região viva não fala: o erro novo é anunciado (nas três plataformas).
  useAnunciar(erro ? `${nomeAcessivel}: ${erro}` : null)

  const estado: EstadoDaCaixa = desabilitado
    ? 'desabilitado'
    : somenteLeitura
      ? 'somenteLeitura'
      : comErro
        ? 'erro'
        : sucesso
          ? 'sucesso'
          : focado || estadoDeVitrine === 'foco'
            ? 'foco'
            : 'normal'
  const area = medidasDaAreaDeTexto(leitura, linhas)
  const estiloDaCaixa = useEstiloDaCaixa(
    estado,
    !!multiline,
    multiline ? area.min : undefined,
    multiline ? area.max : undefined,
  )
  const mostrarLimpar = limpavel && !!texto && !desabilitado && !somenteLeitura
  const temAcao = !!acao
  const icones = {
    erro: comErro && !temAcao && !mostrarLimpar,
    sucesso: !!sucesso && !comErro,
    cadeado: somenteLeitura && !desabilitado,
  }
  const temAdorno =
    validando ||
    !!sufixo ||
    mostrarLimpar ||
    senha ||
    temAcao ||
    icones.erro ||
    icones.sucesso ||
    icones.cadeado

  const caixa = (
    <View
      style={estiloDaCaixa}
      {...(resto.testID ? { testID: `${resto.testID}-caixa` } : {})}
      {...soNaWeb({ dataSet: { campoCaixa: estado } })}
    >
      {icone ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: ESPACO.e16,
            top: multiline ? ESPACO.e16 : 0,
            bottom: multiline ? undefined : 0,
            justifyContent: 'center',
          }}
        >
          <Icone nome={icone} cor={cores.textoSuave} tamanho={20} />
        </View>
      ) : null}
      {prefixo ? (
        <Texto
          variante="meta"
          cor="textoSuave"
          importantForAccessibility="no"
          style={{
            paddingLeft: icone ? 48 : ESPACO.e16,
            alignSelf: multiline ? 'flex-start' : 'center',
            paddingTop: multiline ? ESPACO.e16 : 0,
          }}
        >
          {prefixo}
        </Texto>
      ) : null}
      <TextInput
        ref={ref}
        accessibilityLabel={nomeAcessivel}
        {...(rotuloOculto || rotuloAcessivel ? {} : { accessibilityLabelledBy: idDoRotulo })}
        accessibilityHint={descricao || undefined}
        aria-disabled={desabilitado}
        {...soNaWeb({
          dataSet: { campo: '' },
          'aria-describedby': (erro ? idDoErro : ajuda ? idDaAjuda : undefined) || undefined,
          'aria-invalid': comErro ? true : undefined,
        })}
        placeholder={exemplo}
        placeholderTextColor={cores.campoExemplo}
        selectionColor={cores.primaria}
        cursorColor={cores.primaria}
        secureTextEntry={senha && !visivel}
        editable={!desabilitado && !somenteLeitura && !semEdicao}
        selectTextOnFocus={somenteLeitura}
        multiline={multiline}
        {...(resto.autoComplete || resto.textContentType
          ? { importantForAutofill: 'yes' as const }
          : {})}
        {...resto}
        onFocus={(e) => {
          setFocado(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocado(false)
          onBlur?.(e)
        }}
        style={[
          {
            flex: 1,
            // `minWidth: 0` deixa a entrada encolher: na web ela nasce com ~170 de largura e empurrava o "Mostrar" para fora.
            minWidth: 0,
            alignSelf: 'stretch',
            minHeight: multiline ? area.min - 2 * BORDA.fina : ALTURA.campo - 2 * BORDA.fina,
            ...(multiline ? { maxHeight: area.max - 2 * BORDA.fina } : {}),
            paddingLeft: prefixo ? ESPACO.e8 : icone ? 48 : ESPACO.e16,
            paddingRight: temAdorno ? ESPACO.e8 : ESPACO.e16,
            paddingVertical: multiline ? ESPACO.e16 : 0,
            color: desabilitado ? comOpacidade(cores.textoSuave, 0.6) : cores.texto,
            fontFamily: codigo ? FAMILIA.textoForte : FAMILIA.texto,
            // 16 evita o zoom automático do Safari ao focar o campo.
            fontSize: codigo
              ? TIPO.codigo.tamanho
              : leitura
                ? TIPO.leitura.tamanho
                : TIPO.campo.tamanho,
            ...(multiline
              ? {
                  lineHeight: leitura ? TIPO.leitura.altura : TIPO.campo.altura,
                  textAlignVertical: 'top' as const,
                }
              : {}),
            ...(codigo ? { letterSpacing: 8, fontVariant: ['tabular-nums' as const] } : {}),
          },
          // Na web a área de texto cresce com o conteúdo (onde o navegador sabe; senão, rola por dentro).
          Platform.OS === 'web'
            ? { outlineWidth: 0, ...(multiline ? ({ fieldSizing: 'content' } as object) : {}) }
            : null,
        ]}
      />
      {temAdorno ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: ESPACO.e4,
            alignSelf: multiline ? 'flex-start' : 'center',
            paddingRight: senha || mostrarLimpar || temAcao ? ESPACO.e6 : ESPACO.e16,
            paddingTop: multiline ? ESPACO.e8 : 0,
          }}
        >
          {validando ? <ActivityIndicator size="small" color={cores.textoSuave} /> : null}
          {sufixo ? (
            <Texto variante="meta" cor="textoSuave" importantForAccessibility="no">
              {sufixo}
            </Texto>
          ) : null}
          {mostrarLimpar ? (
            <AcaoDoCampo
              icone="limpar"
              rotulo={`Limpar ${rotulo}`}
              aoPressionar={() => resto.onChangeText?.('')}
            />
          ) : null}
          {senha ? (
            <BotaoDeSenha visivel={visivel} aoAlternar={() => setVisivel((v) => !v)} />
          ) : null}
          {acao ? (
            <AcaoDoCampo icone={acao.icone} rotulo={acao.rotulo} aoPressionar={acao.aoPressionar} />
          ) : null}
          {icones.erro ? <Icone nome="erroDeCampo" cor={cores.erro} tamanho={20} /> : null}
          {icones.sucesso ? <Icone nome="avisoSucesso" cor={cores.sucesso} tamanho={20} /> : null}
          {icones.cadeado ? <Icone nome="cadeado" cor={cores.textoSuave} tamanho={18} /> : null}
        </View>
      ) : null}
      {estado === 'desabilitado' || estado === 'somenteLeitura' ? null : (
        <AnelDoCampo
          ativo={focado || estadoDeVitrine === 'foco'}
          comErro={comErro}
          testID={resto.testID}
        />
      )}
    </View>
  )

  const comBalanco =
    disparoDeErro === undefined ? caixa : <Abalar disparo={disparoDeErro}>{caixa}</Abalar>

  return (
    <BlocoDoCampo
      rotulo={rotulo}
      opcional={opcional}
      rotuloOculto={rotuloOculto}
      idDoRotulo={idDoRotulo}
      ajuda={ajuda}
      erro={erro}
      sucesso={sucesso}
      apoio={apoio}
      idDaAjuda={idDaAjuda}
      idDoErro={idDoErro}
      contador={contador}
      reservarApoio={reservarApoio}
      aoLado={aoLado}
      fenda={fenda}
    >
      {botao ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: ESPACO.e12 }}>
          <View style={{ flex: 1 }}>{comBalanco}</View>
          <ContextoDoBotaoEncaixado.Provider value>{botao}</ContextoDoBotaoEncaixado.Provider>
        </View>
      ) : (
        comBalanco
      )}
    </BlocoDoCampo>
  )
}

/**
 * Botão da senha: o olho mais a palavra ("Mostrar" e "Ocultar"), na cor de
 * destaque, com alvo de 44 de altura. O olho sozinho não diz o que faz.
 */
function BotaoDeSenha({ visivel, aoAlternar }: { visivel: boolean; aoAlternar: () => void }) {
  const { cores } = useTema()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visivel ? 'Ocultar senha' : 'Mostrar senha'}
      onPress={aoAlternar}
      hitSlop={ESPACO.e4}
      style={({ pressed }) => ({
        minWidth: ALTURA.iconeSo,
        minHeight: ALTURA.iconeSo,
        paddingHorizontal: ESPACO.e10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ESPACO.e6,
        borderRadius: RAIO.pilula,
        backgroundColor: pressed ? cores.quenteFundo : 'transparent',
      })}
    >
      <Icone nome={visivel ? 'ocultar' : 'mostrar'} cor={cores.destaque} tamanho={18} />
      <Texto variante="rotulo" cor="destaque" importantForAccessibility="no">
        {visivel ? 'Ocultar' : 'Mostrar'}
      </Texto>
    </Pressable>
  )
}

/** Só ícone de 44×44 na borda direita da caixa (limpar), que entra em 120 ms. */
function AcaoDoCampo({
  icone,
  rotulo,
  aoPressionar,
}: {
  icone: NomeDoIcone
  rotulo: string
  aoPressionar: () => void
}) {
  const { cores } = useTema()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const entrada = useSharedValue(0)
  useEffect(() => {
    entrada.set(
      withTiming(1, {
        duration: reduzirMovimento ? 0 : MOVIMENTO_DOS_CONTROLES.limpar,
        reduceMotion: ReduceMotion.Never,
      }),
    )
  }, [entrada, reduzirMovimento])
  const estilo = useAnimatedStyle(() => ({ opacity: entrada.value }))
  return (
    <Animated.View style={estilo}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={rotulo}
        onPress={aoPressionar}
        style={({ pressed }) => ({
          width: ALTURA.iconeSo,
          height: ALTURA.iconeSo,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: RAIO.pilula,
          backgroundColor: pressed ? cores.botaoTonal : 'transparent',
        })}
      >
        <Icone nome={icone} cor={cores.textoSuave} tamanho={18} />
      </Pressable>
    </Animated.View>
  )
}

interface PropsDoCampoDeBusca extends Omit<
  PropsDoCampo,
  'icone' | 'acao' | 'senha' | 'rotuloOculto' | 'value' | 'onChangeText' | 'exemplo'
> {
  valor: string
  aoMudar: (valor: string) => void
  /** Rótulo visível acima do campo. Padrão: só o exemplo dentro da caixa (o rótulo vira o nome acessível). */
  rotuloVisivel?: boolean
}

/**
 * Campo de busca: a mesma caixa de 56 e raio 16 (não é cápsula, para não
 * parecer botão), lupa à esquerda e "Limpar a busca" à direita quando há texto.
 */
export function CampoDeBusca({
  rotulo,
  valor,
  aoMudar,
  rotuloVisivel = false,
  ...resto
}: PropsDoCampoDeBusca) {
  return (
    <Campo
      rotulo={rotulo}
      rotuloOculto={!rotuloVisivel}
      exemplo={rotulo}
      icone="buscar"
      value={valor}
      onChangeText={aoMudar}
      returnKeyType="search"
      autoCorrect={false}
      {...(valor
        ? { acao: { icone: 'limpar', rotulo: 'Limpar a busca', aoPressionar: () => aoMudar('') } }
        : {})}
      {...resto}
    />
  )
}
