import DateTimePicker from '@expo/ui/community/datetime-picker'
import { ESPACO, TIPO } from '@uj/tokens'
import { useId, useState } from 'react'
import { Platform, Pressable, View } from 'react-native'

import { Botao } from './Botao'
import { AnelDoCampo, BlocoDoCampo, useEstiloDaCaixa, type EstadoDaCaixa } from './Campo'
import { comOpacidade } from './cor'
import { FolhaNaTela } from './FolhaNaTela'
import { Icone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'
import {
  deDate,
  formatarMomento,
  paraDate,
  type PropsDoCampoDeMomento,
  type TipoDeMomento,
} from './momento'
import { useAnunciar } from './useAnunciar'

export { deDate, formatarMomento, paraDate }
export type { PropsDoCampoDeMomento, TipoDeMomento }

/**
 * Campo de data ou hora (D64): a caixa do Campo, tocável, com o ícone de
 * calendário ou relógio à esquerda (esquerda diz "o que é"), o valor em 16/22 ou
 * "Escolher data" em `campoExemplo`, e o anel de foco ligado enquanto o seletor
 * está aberto. O toque abre o seletor nativo do `@expo/ui`:
 * no iOS, o calendário (data) ou a roda (hora) numa folha da largura da tela,
 * com "Pronto"; no Android, o diálogo do Material 3. Nada é digitado.
 */
export function CampoDeMomento({
  tipo,
  rotulo,
  valor,
  aoMudar,
  erro,
  ajuda,
  opcional,
  desabilitado = false,
  minimo,
  maximo,
  reservarApoio,
}: PropsDoCampoDeMomento & { tipo: TipoDeMomento }) {
  const { cores, escuro } = useTema()
  const id = useId()
  const [aberto, setAberto] = useState(false)
  const formatado = formatarMomento(tipo, valor)
  const ios = Platform.OS === 'ios'
  useAnunciar(erro ? `${rotulo}: ${erro}` : null)

  const estado: EstadoDaCaixa = desabilitado
    ? 'desabilitado'
    : erro
      ? 'erro'
      : aberto
        ? 'foco'
        : 'normal'
  const estiloDaCaixa = useEstiloDaCaixa(estado)
  const corDoValor = desabilitado
    ? comOpacidade(cores.textoSuave, 0.6)
    : formatado
      ? cores.texto
      : cores.campoExemplo

  const escolher = (d: Date) => aoMudar(deDate(tipo, d))
  const limites = {
    ...(minimo ? { minimumDate: paraDate('data', minimo) } : {}),
    ...(maximo ? { maximumDate: paraDate('data', maximo) } : {}),
  }

  return (
    <BlocoDoCampo
      rotulo={rotulo}
      opcional={opcional}
      idDoRotulo={`rotulo-${id}`}
      ajuda={ajuda}
      erro={erro}
      idDaAjuda={`ajuda-${id}`}
      idDoErro={`erro-${id}`}
      reservarApoio={reservarApoio}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${rotulo}: ${formatado ?? (tipo === 'data' ? 'nenhuma data escolhida' : 'nenhum horário escolhido')}`}
        accessibilityHint={
          erro
            ? `Erro: ${erro}`
            : tipo === 'data'
              ? 'Abre o calendário para escolher a data.'
              : 'Abre o seletor de horário.'
        }
        aria-disabled={desabilitado}
        {...(ios ? { 'aria-expanded': aberto } : {})}
        disabled={desabilitado}
        onPress={() => setAberto((a) => !a)}
        style={estiloDaCaixa}
      >
        <View style={{ paddingLeft: ESPACO.e16 }}>
          <Icone
            nome={tipo === 'data' ? 'calendario' : 'relogio'}
            cor={desabilitado ? corDoValor : cores.textoSuave}
            tamanho={20}
          />
        </View>
        <Texto
          variante="corpo"
          tabular={tipo === 'hora'}
          style={{
            flex: 1,
            paddingLeft: ESPACO.e12,
            paddingRight: ESPACO.e16,
            fontSize: TIPO.campo.tamanho,
            lineHeight: TIPO.campo.altura,
            color: corDoValor,
          }}
          numberOfLines={1}
        >
          {formatado ?? (tipo === 'data' ? 'Escolher data' : 'Escolher horário')}
        </Texto>
        {desabilitado ? null : (
          <AnelDoCampo ativo={aberto} comErro={!!erro} testID={`momento-${tipo}`} />
        )}
      </Pressable>
      {ios ? (
        // O seletor nativo do iOS só mede a altura; a largura vem do pai. Dentro de
        // uma meia coluna ("Data | Hora") o calendário saía cortado e a roda sumia
        // (largura 0, expo/expo#46904). Na folha, ele tem a largura da tela.
        <FolhaNaTela
          aberta={aberto}
          titulo={tipo === 'data' ? 'Escolher a data' : 'Escolher o horário'}
          aoFechar={() => setAberto(false)}
        >
          <DateTimePicker
            value={paraDate(tipo, valor)}
            mode={tipo === 'data' ? 'date' : 'time'}
            display={tipo === 'data' ? 'inline' : 'spinner'}
            locale="pt_BR"
            accentColor={cores.primaria}
            themeVariant={escuro ? 'dark' : 'light'}
            onValueChange={(_, d) => escolher(d)}
            style={{ alignSelf: 'stretch' }}
            {...limites}
          />
          <Botao titulo="Pronto" aoPressionar={() => setAberto(false)} />
        </FolhaNaTela>
      ) : null}
      {aberto && Platform.OS === 'android' ? (
        <DateTimePicker
          value={paraDate(tipo, valor)}
          mode={tipo === 'data' ? 'date' : 'time'}
          presentation="dialog"
          is24Hour
          accentColor={cores.primaria}
          themeVariant={escuro ? 'dark' : 'light'}
          positiveButton={{ label: 'Escolher' }}
          negativeButton={{ label: 'Cancelar' }}
          onValueChange={(_, d) => {
            setAberto(false)
            escolher(d)
          }}
          onDismiss={() => setAberto(false)}
          {...limites}
        />
      ) : null}
    </BlocoDoCampo>
  )
}

/** Campo de data (`AAAA-MM-DD`) com seletor nativo. */
export function CampoDeData(props: PropsDoCampoDeMomento) {
  return <CampoDeMomento tipo="data" {...props} />
}

/** Campo de hora (`HH:MM`) com seletor nativo. */
export function CampoDeHora(props: PropsDoCampoDeMomento) {
  return <CampoDeMomento tipo="hora" {...props} />
}
