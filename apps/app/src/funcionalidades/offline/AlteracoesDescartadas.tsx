import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { copiarTexto } from '@/utilidades/compartilhar'
import { formatarDataEHora } from '@/utilidades/formatos'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Texto } from '@/ui/Texto'

import { dispensarDescarte, useDescarte, type MotivoDoDescarte } from './descartadas'

const TITULO: Readonly<Record<MotivoDoDescarte, string>> = {
  sessao: 'Alterações apagadas ao sair da conta',
  revogado: 'Seu acesso a uma comunidade terminou',
  vencido: 'O prazo de uso sem internet venceu',
  saiu: 'Você saiu de uma comunidade',
}

/**
 * Mostra o que não chegou ao servidor e saiu do aparelho junto com os dados
 * locais. A lista só existe na memória: some ao tocar "Entendi" ou ao fechar o app.
 */
export function AlteracoesDescartadas() {
  const descarte = useDescarte()
  const [copiado, setCopiado] = useState(false)
  if (!descarte) return null

  const linhas = descarte.itens.map((i) => ({
    // Lista fixa (não reordena): hora + texto identificam a alteração.
    chave: `${i.criadaEm}|${i.descricao}`,
    texto: `${i.descricao} (feita em ${formatarDataEHora(i.criadaEm)})${i.mensagem ? `: ${i.mensagem}` : ''}`,
  }))

  return (
    <Cartao>
      <Aviso tipo="alerta" titulo={TITULO[descarte.motivo]} anunciar>
        {descarte.itens.length === 1
          ? 'Esta alteração não chegou ao servidor e foi apagada deste aparelho. Copie se precisar refazer.'
          : `Estas ${descarte.itens.length} alterações não chegaram ao servidor e foram apagadas deste aparelho. Copie se precisar refazer.`}
      </Aviso>
      <View style={{ gap: ESPACO.e4 }}>
        {linhas.map((l) => (
          <Texto key={l.chave} variante="corpo">
            • {l.texto}
          </Texto>
        ))}
      </View>
      {copiado ? (
        <Aviso tipo="sucesso" anunciar>
          Lista copiada.
        </Aviso>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
        <Botao
          titulo="Copiar a lista"
          icone="copiar"
          variante="secundario"
          larguraTotal={false}
          aoPressionar={() =>
            void copiarTexto(linhas.map((l) => l.texto).join('\n')).then(setCopiado)
          }
        />
        <Botao
          titulo="Entendi"
          variante="terciario"
          larguraTotal={false}
          rotuloAcessivel="Entendi, fechar este aviso"
          aoPressionar={dispensarDescarte}
        />
      </View>
    </Cartao>
  )
}
