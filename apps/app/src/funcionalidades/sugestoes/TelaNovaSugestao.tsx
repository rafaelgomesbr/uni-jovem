import { router } from 'expo-router'
import { useState } from 'react'

import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { Texto } from '@/ui/Texto'

import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
import { useCriarSugestao } from './consultas'

/** TC-08.v1: o que o anonimato garante e o que não garante. */
export const TEXTO_DO_ANONIMATO =
  'Ninguém da comunidade, nem organizadores e administradores, verá quem enviou. O sistema guarda a autoria para segurança (por exemplo, em caso de abuso), sem mostrar em nenhuma tela; quem administra o servidor tem capacidade técnica de consultá-la.'

/** Rota `/sugestoes/nova`. */
export function TelaNovaSugestao() {
  return (
    <TelaDaComunidade oQue="a nova sugestão" titulo="Nova sugestão">
      {(c) => <Formulario comunidadeId={c.id} />}
    </TelaDaComunidade>
  )
}

function Formulario({ comunidadeId }: { comunidadeId: string }) {
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [anonima, setAnonima] = useState(false)
  const [erros, setErros] = useState<{ titulo?: string; texto?: string }>({})
  const criar = useCriarSugestao(comunidadeId)

  function enviar() {
    const novos: typeof erros = {}
    if (titulo.trim().length < 2) novos.titulo = 'Dê um título à sugestão.'
    if (!texto.trim()) novos.texto = 'Escreva a sua sugestão.'
    setErros(novos)
    if (novos.titulo || novos.texto) return
    criar.mutate(
      { titulo: titulo.trim(), texto: texto.trim(), anonima },
      { onSuccess: () => router.back() },
    )
  }

  return (
    <>
      <Cartao>
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
        />
      </Cartao>
      <Cartao titulo="Quem vê que foi você" icone="anonimo">
        <CaixaDeMarcar
          rotulo="Enviar como anônima"
          descricao={TEXTO_DO_ANONIMATO}
          marcada={anonima}
          aoMudar={setAnonima}
        />
        <Texto variante="legenda" cor="textoSuave">
          {anonima
            ? 'A sugestão vai aparecer como "Anônima" para todos, inclusive para a liderança. Só você a vê como sua.'
            : 'Seu nome aparece para quem organiza a comunidade.'}
        </Texto>
      </Cartao>
      {criar.error ? <AvisoDeErro erro={criar.error} /> : null}
      <Botao
        titulo="Enviar sugestão"
        icone="publicar"
        carregando={criar.isPending}
        aoPressionar={enviar}
      />
    </>
  )
}
