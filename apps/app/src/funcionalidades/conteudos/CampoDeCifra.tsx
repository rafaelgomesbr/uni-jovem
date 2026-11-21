import { converterParaChordPro, detectarFormato, lerCifra } from '@uj/dominio'
import { ESPACO, RAIO, TEMAS } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo } from '@/ui/Campo'
import { Chip } from '@/ui/Chip'
import { Texto } from '@/ui/Texto'
import { ProvedorDeTemaForcado } from '@/ui/tema'

import { CifraNaTela } from '../repertorio/CifraNaTela'
import { AVISO_DE_DIREITOS, TEXTO_DA_CONFIRMACAO_DE_DIREITOS } from './tipos'

interface Props {
  rotulo: string
  valor: string
  aoMudar: (valor: string) => void
  erro: string | null
  /** A cifra é nova ou mudou: pede a confirmação do aviso de direitos. */
  pedeConfirmacao: boolean
  confirmada: boolean
  aoConfirmar: (confirmada: boolean) => void
  erroDaConfirmacao: string | null
}

const DICA_DE_CHORDPRO =
  'Escreva o acorde entre colchetes, colado na sílaba onde ele muda: [G]Sobre a rocha eu [D]firmo. Ou cole a cifra com os acordes sobre a letra e toque em Converter.'

/**
 * Campo da cifra da música (D61): a dica do formato ChordPro, o formato
 * reconhecido, "Converter cifra colada" (que troca o texto e deixa a
 * pré-visualização à vista antes de salvar), a pré-visualização e o aviso de
 * direitos autorais com a confirmação que a API exige ao salvar.
 */
export function CampoDeCifra({
  rotulo,
  valor,
  aoMudar,
  erro,
  pedeConfirmacao,
  confirmada,
  aoConfirmar,
  erroDaConfirmacao,
}: Props) {
  const [previa, setPrevia] = useState(false)
  const [convertidos, setConvertidos] = useState<number | null>(null)
  const texto = valor.trim()
  const formato = detectarFormato(valor)

  function converter() {
    const r = converterParaChordPro(valor)
    aoMudar(r.texto)
    setConvertidos(r.convertido ? r.acordes : 0)
    // A prévia abre sozinha: a pessoa vê o resultado antes de salvar.
    setPrevia(true)
  }

  return (
    <View style={{ gap: ESPACO.e12 }}>
      <Campo
        rotulo={rotulo}
        opcional
        value={valor}
        onChangeText={(t) => {
          setConvertidos(null)
          aoMudar(t)
        }}
        erro={erro}
        ajuda={DICA_DE_CHORDPRO}
        multiline
        maxLength={20000}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {texto ? (
        <>
          {formato === 'chordpro' ? (
            <View style={{ flexDirection: 'row' }}>
              <Chip texto="ChordPro: o tom e o capotraste funcionam" tom="sucesso" icone="check" />
            </View>
          ) : formato === 'acordes_sobre_letra' ? (
            <Aviso
              tipo="info"
              titulo="Parece uma cifra com os acordes sobre a letra"
              acao={{ titulo: 'Converter cifra colada', aoPressionar: converter }}
            >
              Convertida para ChordPro, o tom e o capotraste passam a funcionar. Você confere o
              resultado antes de salvar.
            </Aviso>
          ) : (
            <Aviso tipo="alerta" titulo="Sem acordes reconhecidos">
              Será guardado como texto: o tom e o capotraste não vão mudar os acordes. Para
              transpor, escreva os acordes entre colchetes.
            </Aviso>
          )}
          {convertidos !== null ? (
            <Aviso tipo="sucesso" titulo="Convertida">
              {convertidos > 0
                ? `${convertidos} acordes foram colocados sobre a letra. Confira a pré-visualização.`
                : 'Nada foi convertido: o texto ficou como estava.'}
            </Aviso>
          ) : null}
          <Botao
            titulo={previa ? 'Esconder a pré-visualização' : 'Ver como vai aparecer'}
            variante="terciario"
            alinhado
            expandido={previa}
            aoPressionar={() => setPrevia((p) => !p)}
          />
          {previa ? <PreVisualizacao texto={valor} chordpro={formato === 'chordpro'} /> : null}
          <Aviso tipo="info" titulo="Direitos autorais">
            {AVISO_DE_DIREITOS}
          </Aviso>
          {pedeConfirmacao ? (
            <CaixaDeMarcar
              rotulo={TEXTO_DA_CONFIRMACAO_DE_DIREITOS}
              marcada={confirmada}
              aoMudar={aoConfirmar}
              erro={erroDaConfirmacao}
            />
          ) : null}
        </>
      ) : null}
    </View>
  )
}

function PreVisualizacao({ texto, chordpro }: { texto: string; chordpro: boolean }) {
  return (
    <ProvedorDeTemaForcado nome="escuro">
      <View
        accessibilityLabel="Pré-visualização da cifra"
        style={{
          backgroundColor: TEMAS.escuro.base.fundo,
          borderRadius: RAIO.cartao,
          padding: ESPACO.e16,
        }}
      >
        {chordpro ? (
          <CifraNaTela linhas={lerCifra(texto)} tamanho={18} />
        ) : (
          <Texto variante="leitura" selectable>
            {texto}
          </Texto>
        )}
      </View>
    </ProvedorDeTemaForcado>
  )
}
