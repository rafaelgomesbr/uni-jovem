import { ESPACO } from '@uj/tokens'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import { mensagemDoErro } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Interruptor } from '@/ui/Interruptor'
import { useConfirmarDescarte, useTravaDeEnvio, voltarOu } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { SemComunidade } from '../navegacao/SemComunidade'
import { useCriarSugestao } from './consultas'

/** TC-08.v1: o que o anonimato garante e o que não garante. */
export const TEXTO_DO_ANONIMATO =
  'Ninguém da comunidade, nem organizadores e administradores, verá quem enviou. O sistema guarda a autoria para segurança (por exemplo, em caso de abuso), sem mostrar em nenhuma tela; quem administra o servidor tem capacidade técnica de consultá-la.'

/**
 * Rota `/sugestoes/nova` (3.7.2): Título, a ideia (multilinha) e o
 * interruptor de anonimato com o TC-08 por extenso; "Enviar sugestão" na
 * barra de ação.
 */
export function TelaNovaSugestao() {
  const { comunidadeAtiva } = useSessao()
  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo="Sugerir uma ideia">
        <SemComunidade oQue="a nova sugestão" />
      </Tela>
    )
  }
  return <Formulario comunidadeId={comunidadeAtiva.id} />
}

function Formulario({ comunidadeId }: { comunidadeId: string }) {
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [anonima, setAnonima] = useState(false)
  const [erros, setErros] = useState<{ titulo?: string; texto?: string }>({})
  const criar = useCriarSugestao(comunidadeId)
  const trava = useTravaDeEnvio()
  const liberar = useConfirmarDescarte(!!titulo.trim() || !!texto.trim())

  function enviar() {
    const novos: typeof erros = {}
    if (titulo.trim().length < 2) novos.titulo = 'Dê um título à sugestão.'
    if (!texto.trim()) novos.texto = 'Escreva a sua sugestão.'
    setErros(novos)
    if (novos.titulo || novos.texto) return
    if (!trava.pegar()) return
    criar.mutate(
      { titulo: titulo.trim(), texto: texto.trim(), anonima },
      {
        onSuccess: () => {
          mostrarToast({ texto: 'Sugestão enviada' })
          liberar()
          voltarOu('/sugestoes')
        },
        onError: trava.soltar,
      },
    )
  }

  return (
    <Tela
      pilha
      titulo="Sugerir uma ideia"
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Enviar sugestão"
            icone="publicar"
            tamanho="grande"
            carregando={criar.isPending}
            aoPressionar={enviar}
          />
        </BarraDeAcao>
      }
    >
      <CartaoDeVidro opaco intervalo={ESPACO.e16}>
        <Campo
          rotulo="Título"
          value={titulo}
          onChangeText={setTitulo}
          erro={erros.titulo ?? null}
          maxLength={120}
        />
        <Campo
          rotulo="Sua sugestão"
          value={texto}
          onChangeText={setTexto}
          erro={erros.texto ?? null}
          multiline
          maxLength={4000}
          mostrarContador
        />
      </CartaoDeVidro>
      <CartaoDeVidro sobrancelha="Quem vê que foi você" opaco comecaComTitulo>
        <Interruptor
          rotulo="Enviar como anônima"
          ligado={anonima}
          aoMudar={setAnonima}
          descricao={
            anonima
              ? 'A sugestão vai aparecer como "Anônima" para todos, inclusive para a liderança. Só você a vê como sua.'
              : 'Seu nome aparece para quem organiza a comunidade.'
          }
        />
        <Texto variante="legenda" cor="textoSuave">
          {TEXTO_DO_ANONIMATO}
        </Texto>
      </CartaoDeVidro>
      {criar.error ? (
        <Aviso tipo="erro" titulo="Não deu para enviar a sugestão" anunciar>
          {mensagemDoErro(criar.error)}
        </Aviso>
      ) : null}
    </Tela>
  )
}
