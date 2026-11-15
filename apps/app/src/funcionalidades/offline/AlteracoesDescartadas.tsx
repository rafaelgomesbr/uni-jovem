import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { copiarTexto } from '@/utilidades/compartilhar'
import { formatarDataEHora } from '@/utilidades/formatos'
import { Aviso } from '@/ui/Aviso'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

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
  if (!descarte) return null

  const linhas = descarte.itens.map((i) => ({
    // Lista fixa (não reordena): hora + texto identificam a alteração.
    chave: `${i.criadaEm}|${i.descricao}`,
    texto: `${i.descricao} (feita em ${formatarDataEHora(i.criadaEm)})${i.mensagem ? `: ${i.mensagem}` : ''}`,
  }))

  // Um aviso de alerta só (nada de caixa dentro de cartão): o texto, a lista e as duas ações.
  return (
    <Aviso tipo="alerta" titulo={TITULO[descarte.motivo]} anunciar>
      <View style={{ gap: ESPACO.e8 }}>
        <Texto variante="legenda">
          {descarte.itens.length === 1
            ? 'Esta alteração não chegou ao servidor e foi apagada deste aparelho. Copie se precisar refazer.'
            : `Estas ${descarte.itens.length} alterações não chegaram ao servidor e foram apagadas deste aparelho. Copie se precisar refazer.`}
        </Texto>
        <View style={{ gap: ESPACO.e4 }}>
          {linhas.map((l) => (
            <Texto key={l.chave} variante="legenda">
              • {l.texto}
            </Texto>
          ))}
        </View>
        <ParDeBotoes>
          <Botao
            titulo="Copiar a lista"
            variante="secundario"
            aoPressionar={() =>
              void copiarTexto(linhas.map((l) => l.texto).join('\n')).then((ok) => {
                if (ok) mostrarToast({ texto: 'Lista copiada' })
              })
            }
          />
          <Botao
            titulo="Entendi"
            variante="terciario"
            rotuloAcessivel="Entendi, fechar este aviso"
            aoPressionar={dispensarDescarte}
          />
        </ParDeBotoes>
      </View>
    </Aviso>
  )
}
