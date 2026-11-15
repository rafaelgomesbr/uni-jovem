import { ALTURA, ESPACO, RAIO, TIPO } from '@uj/tokens'
import { useId, useState, type ComponentRef, type ReactNode, type Ref } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'

import { FAMILIA } from './fontes'
import { Icone, type NomeDoIcone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'
import { useAnunciar } from './useAnunciar'
import { soNaWeb } from './web'

/** Estado visual da caixa (tabela de estados da 2.12.2). */
export type EstadoDaCaixa = 'normal' | 'foco' | 'erro' | 'desabilitado' | 'somenteLeitura'

/**
 * Borda, anel interno e fundo da caixa em cada estado: o foco não desloca o
 * texto. `alturaMinima` muda a altura do multilinha (160 no texto longo).
 */
export function useEstiloDaCaixa(
  estado: EstadoDaCaixa,
  multilinha = false,
  alturaMinima?: number,
): ViewStyle {
  const { cores, solido } = useTema()
  const base: ViewStyle = {
    minHeight: alturaMinima ?? (multilinha ? ALTURA.multilinha : ALTURA.controle),
    borderRadius: RAIO.controle,
    flexDirection: 'row',
    alignItems: multilinha ? 'flex-start' : 'center',
  }
  switch (estado) {
    case 'foco':
      return {
        ...base,
        backgroundColor: cores.campoFundo,
        borderWidth: 1,
        borderColor: cores.foco,
        boxShadow: `inset 0px 0px 0px 1px ${cores.foco}`,
      }
    case 'erro':
      return {
        ...base,
        backgroundColor: cores.campoFundo,
        borderWidth: 1,
        borderColor: cores.erro,
        boxShadow: `inset 0px 0px 0px 1px ${cores.erro}`,
      }
    case 'desabilitado':
      return {
        ...base,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: cores.tonalBorda,
      }
    case 'somenteLeitura':
      return {
        ...base,
        backgroundColor: solido(cores.tonal),
        borderWidth: 1,
        borderColor: 'transparent',
      }
    case 'normal':
      return {
        ...base,
        backgroundColor: cores.campoFundo,
        borderWidth: 1,
        borderColor: cores.campoBorda,
      }
  }
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
  idDaAjuda: string
  idDoErro: string
  contador?: string | undefined
  /** Reserva a linha de apoio mesmo vazia (campos lado a lado, para a próxima linha alinhar). */
  reservarApoio?: boolean
  children: ReactNode
}

/**
 * Rótulo, caixa e uma linha de apoio, todos com a borda esquerda em x=0:
 * 20 + 8 + 48 + 6 + 18 = 100 com ajuda; 76 sem.
 */
export function BlocoDoCampo({
  rotulo,
  opcional,
  rotuloOculto,
  idDoRotulo,
  ajuda,
  erro,
  idDaAjuda,
  idDoErro,
  contador,
  reservarApoio,
  children,
}: PropsDoBlocoDoCampo) {
  const { cores, superficie } = useTema()
  // No cartão translúcido, o texto em `erro` não passa AA no pico da Aurora: ícone na cor, texto em `texto`.
  const corDoErro = superficie === 'translucida' ? 'texto' : 'erro'
  const temApoio = !!(erro || ajuda || contador)
  return (
    <View style={{ alignSelf: 'stretch' }}>
      {rotuloOculto ? null : (
        <Texto
          variante="rotulo"
          cor="textoSuave"
          nativeID={idDoRotulo}
          style={{ marginBottom: ESPACO.e8 }}
        >
          {rotulo}
          {opcional ? (
            <Texto variante="rotulo" peso="regular" cor="textoSuave">
              {' (opcional)'}
            </Texto>
          ) : null}
        </Texto>
      )}
      {children}
      {temApoio || reservarApoio ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: ESPACO.e8,
            marginTop: ESPACO.e6,
            minHeight: 18,
          }}
        >
          <View style={{ flex: 1 }}>
            {erro ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e6 }}>
                <View style={{ height: 20, justifyContent: 'center' }}>
                  <Icone nome="erroDeCampo" cor={cores.erro} tamanho={16} />
                </View>
                {/* O erro é o que a pessoa precisa ler para seguir: 15, não 13 (U-09). */}
                <Texto
                  variante="meta"
                  peso="forte"
                  cor={corDoErro}
                  nativeID={idDoErro}
                  style={{ flex: 1 }}
                >
                  {erro}
                </Texto>
              </View>
            ) : ajuda ? (
              <Texto
                variante="legenda"
                cor="textoSuave"
                nativeID={idDaAjuda}
                importantForAccessibility="no"
              >
                {ajuda}
              </Texto>
            ) : null}
          </View>
          {contador ? (
            <Texto variante="legenda" cor="textoSuave" tabular importantForAccessibility="no">
              {contador}
            </Texto>
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
  /** Orientação curta abaixo do campo. Some quando há erro (o erro diz como corrigir). */
  ajuda?: string
  /**
   * Nome para o leitor de tela quando o rótulo visível é curto fora do
   * contexto ("Nome" no cartão "Chegou sem inscrição" vira "Nome de quem chegou").
   */
  rotuloAcessivel?: string
  /** Campo de senha, com o botão "Mostrar senha". */
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
  /** Conferindo o valor (ex.: disponibilidade): indicador de 16 à direita. */
  validando?: boolean
  /** Texto curto à direita ("min"). */
  sufixo?: string
  /** Ícone de 18 à esquerda (busca). */
  icone?: NomeDoIcone
  /** Ação só ícone à direita (limpar). */
  acao?: { icone: NomeDoIcone; rotulo: string; aoPressionar: () => void }
  /** Código de 6 dígitos: algarismos largos e espaçados. */
  codigo?: boolean
  /**
   * Texto longo de quem escreve (pedido de oração, 3.7.1): multilinha de 160
   * em `leitura` 17/26, o mesmo papel em que o texto vai ser lido.
   */
  leitura?: boolean
  /**
   * Campo e botão na mesma linha (2.12.2): os dois com 48, alinhados pela
   * base; o rótulo fica sobre o campo e a ajuda ou o erro abaixo da linha inteira.
   */
  botao?: ReactNode
  /** Contador de caracteres à direita da linha de apoio (precisa de `maxLength`). */
  mostrarContador?: boolean
  rotuloOculto?: boolean
  reservarApoio?: boolean
  /** Só o catálogo: desenha o foco sem teclado. */
  estadoDeVitrine?: 'foco'
  ref?: Ref<ComponentRef<typeof TextInput>>
}

export function Campo({
  rotulo,
  rotuloAcessivel,
  opcional,
  erro,
  ajuda: ajudaDoCampo,
  senha = false,
  exemplo,
  formato,
  desabilitado = false,
  somenteLeitura = false,
  validando = false,
  sufixo,
  icone,
  acao,
  codigo = false,
  leitura = false,
  botao,
  mostrarContador = false,
  rotuloOculto = false,
  reservarApoio,
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
  const descricao = erro ? `Erro: ${erro}` : (ajuda ?? '')
  const contador =
    mostrarContador && resto.maxLength
      ? `${(resto.value ?? '').length}/${resto.maxLength}`
      : undefined
  // No iOS a região viva não fala: o erro novo é anunciado (nas três plataformas).
  useAnunciar(erro ? `${nomeAcessivel}: ${erro}` : null)

  const estado: EstadoDaCaixa = desabilitado
    ? 'desabilitado'
    : somenteLeitura
      ? 'somenteLeitura'
      : erro
        ? 'erro'
        : focado || estadoDeVitrine === 'foco'
          ? 'foco'
          : 'normal'
  const alturaMinima = leitura ? ALTURA.multilinhaLonga : undefined
  const estiloDaCaixa = useEstiloDaCaixa(estado, !!multiline, alturaMinima)
  const temAcaoDireita = senha || !!acao

  const caixa = (
    <View style={estiloDaCaixa} {...(resto.testID ? { testID: `${resto.testID}-caixa` } : {})}>
      {icone ? (
        <View
          style={{ position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center' }}
        >
          <Icone nome={icone} cor={cores.textoSuave} tamanho={18} />
        </View>
      ) : null}
      <TextInput
        ref={ref}
        accessibilityLabel={nomeAcessivel}
        {...(rotuloOculto || rotuloAcessivel ? {} : { accessibilityLabelledBy: idDoRotulo })}
        accessibilityHint={descricao || undefined}
        aria-disabled={desabilitado}
        {...soNaWeb({
          'aria-describedby': (erro ? idDoErro : ajuda ? idDaAjuda : undefined) || undefined,
          'aria-invalid': erro ? true : undefined,
        })}
        placeholder={exemplo}
        placeholderTextColor={cores.textoSuave}
        secureTextEntry={senha && !visivel}
        editable={!desabilitado && !somenteLeitura}
        selectTextOnFocus={somenteLeitura}
        multiline={multiline}
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
            alignSelf: 'stretch',
            minHeight: alturaMinima ?? (multiline ? ALTURA.multilinha : ALTURA.controle - 2),
            paddingLeft: icone ? 40 : ESPACO.e16,
            paddingRight: temAcaoDireita ? 48 : sufixo || validando ? ESPACO.e8 : ESPACO.e16,
            paddingVertical: multiline ? 13 : 0,
            color: desabilitado ? cores.textoSuave : cores.texto,
            fontFamily: codigo ? FAMILIA.textoForte : FAMILIA.texto,
            // 16 evita o zoom automático do Safari ao focar o campo.
            fontSize: codigo ? TIPO.codigo.tamanho : leitura ? TIPO.leitura.tamanho : 16,
            ...(multiline
              ? {
                  lineHeight: leitura ? TIPO.leitura.altura : 22,
                  textAlignVertical: 'top' as const,
                }
              : {}),
            ...(codigo ? { letterSpacing: 8, fontVariant: ['tabular-nums' as const] } : {}),
          },
          Platform.OS === 'web' ? { outlineWidth: 0 } : null,
        ]}
      />
      {validando ? (
        <View style={{ paddingRight: sufixo ? ESPACO.e8 : ESPACO.e16 }}>
          <ActivityIndicator size="small" color={cores.textoSuave} />
        </View>
      ) : null}
      {sufixo ? (
        <Texto
          variante="legenda"
          cor="textoSuave"
          style={{ paddingRight: ESPACO.e16 }}
          importantForAccessibility="no"
        >
          {sufixo}
        </Texto>
      ) : null}
      {temAcaoDireita ? (
        <AcaoDoCampo
          icone={senha ? (visivel ? 'ocultar' : 'mostrar') : acao!.icone}
          rotulo={senha ? (visivel ? 'Ocultar senha' : 'Mostrar senha') : acao!.rotulo}
          aoPressionar={senha ? () => setVisivel((v) => !v) : acao!.aoPressionar}
        />
      ) : null}
    </View>
  )

  return (
    <BlocoDoCampo
      rotulo={rotulo}
      opcional={opcional}
      rotuloOculto={rotuloOculto}
      idDoRotulo={idDoRotulo}
      ajuda={ajuda}
      erro={erro}
      idDaAjuda={idDaAjuda}
      idDoErro={idDoErro}
      contador={contador}
      reservarApoio={reservarApoio}
    >
      {botao ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: ESPACO.e12 }}>
          <View style={{ flex: 1 }}>{caixa}</View>
          {botao}
        </View>
      ) : (
        caixa
      )}
    </BlocoDoCampo>
  )
}

/** Só ícone de 44×44 a 2 da borda direita da caixa (mostrar senha, limpar). */
function AcaoDoCampo({
  icone,
  rotulo,
  aoPressionar,
}: {
  icone: NomeDoIcone
  rotulo: string
  aoPressionar: () => void
}) {
  const { cores, solido } = useTema()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={aoPressionar}
      style={({ pressed }) => ({
        position: 'absolute',
        right: 2,
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: RAIO.controle - 2,
        backgroundColor: pressed ? solido(cores.pressionado) : 'transparent',
      })}
    >
      <Icone nome={icone} cor={cores.textoSuave} tamanho={18} />
    </Pressable>
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

/** Campo de busca de 48 com ícone à esquerda e "Limpar" à direita quando há texto. */
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
