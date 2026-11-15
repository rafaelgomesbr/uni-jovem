import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { api } from '@/servicos/api'
import type { MotivoDaDenuncia, RecursoDenunciavel } from '@/servicos/contratoDosModulos'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Expansivel } from '@/ui/Expansivel'
import { GrupoDeOpcoes, type Opcao } from '@/ui/GrupoDeOpcoes'
import { Texto } from '@/ui/Texto'

import { naComunidade } from '../eventos/consultas'

export const NOME_DO_MOTIVO: Readonly<Record<MotivoDaDenuncia, string>> = {
  ofensivo: 'Ofensivo ou desrespeitoso',
  dados_de_terceiros: 'Expõe dados de outra pessoa',
  spam: 'Propaganda ou repetido',
  risco: 'Alguém pode estar em risco',
  outro: 'Outro motivo',
}

const OPCOES: readonly Opcao<MotivoDaDenuncia>[] = (
  Object.keys(NOME_DO_MOTIVO) as MotivoDaDenuncia[]
).map((valor) => ({ valor, rotulo: NOME_DO_MOTIVO[valor] }))

interface Props {
  comunidadeId: string
  recursoTipo: RecursoDenunciavel
  recursoId: string
  /** Para o leitor de tela saber o que está sendo denunciado (ex.: "o aviso Reunião"). */
  descricao: string
}

/**
 * Denunciar conteúdo (Apple 1.2): motivo e detalhe opcional. Quem denunciou
 * não aparece para a administração; a API confere se a pessoa vê o conteúdo.
 */
export function BotaoDenunciar({ comunidadeId, recursoTipo, recursoId, descricao }: Props) {
  const [motivo, setMotivo] = useState<MotivoDaDenuncia | null>(null)
  const [detalhe, setDetalhe] = useState('')
  const enviar = useMutation({
    mutationFn: () =>
      api.post<{ id: string; mensagem: string }>(`${naComunidade(comunidadeId)}/denuncias`, {
        recursoTipo,
        recursoId,
        motivo,
        ...(detalhe.trim() ? { detalhe: detalhe.trim() } : {}),
      }),
    // O detalhe pode citar o conteúdo: não fica guardado depois do envio.
    gcTime: 0,
  })

  if (enviar.isSuccess) {
    return (
      <Aviso tipo="sucesso" anunciar>
        {enviar.data.mensagem}
      </Aviso>
    )
  }

  return (
    <Expansivel titulo="Denunciar" icone="denuncia">
      {() => (
        <>
          <Texto variante="apoio" cor="textoSuave">
            A administração da comunidade vai analisar {descricao}. Ela não vê quem denunciou.
          </Texto>
          <GrupoDeOpcoes
            rotulo="Qual é o problema?"
            opcoes={OPCOES}
            valor={motivo}
            aoMudar={setMotivo}
          />
          <Campo
            rotulo="Quer explicar? (opcional)"
            value={detalhe}
            onChangeText={setDetalhe}
            multiline
            maxLength={500}
          />
          {enviar.error ? <AvisoDeErro erro={enviar.error} /> : null}
          <Botao
            titulo="Enviar denúncia"
            variante="perigo"
            desabilitado={motivo === null}
            motivo="Escolha o motivo para enviar."
            carregando={enviar.isPending}
            aoPressionar={() => enviar.mutate()}
          />
        </>
      )}
    </Expansivel>
  )
}
