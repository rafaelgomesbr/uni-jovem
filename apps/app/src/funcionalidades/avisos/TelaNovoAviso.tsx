import { router } from 'expo-router'
import { useState } from 'react'

import {
  dataDoInstante,
  formatarDataLocal,
  instanteDeDataEHora,
  lerDataDigitada,
} from '@/utilidades/datas'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
import { useCriarAviso, type DadosDoAviso } from './consultas'

interface ValoresDoFormulario {
  titulo: string
  texto: string
  /** Data digitada (DD/MM/AAAA) ou vazio. */
  ate: string
}

export function valoresIniciais(
  aviso: { titulo: string; texto: string; visivelAte: string | null } | null,
  fuso: string,
): ValoresDoFormulario {
  return {
    titulo: aviso?.titulo ?? '',
    texto: aviso?.texto ?? '',
    ate: aviso?.visivelAte ? formatarDataLocal(dataDoInstante(aviso.visivelAte, fuso)) : '',
  }
}

/** Valida e converte; devolve os erros por campo ou os dados prontos para a API. */
export function lerFormulario(
  v: ValoresDoFormulario,
  fuso: string,
):
  | { erros: Partial<Record<keyof ValoresDoFormulario, string>> }
  | { dados: Omit<DadosDoAviso, 'fixado'> } {
  const erros: Partial<Record<keyof ValoresDoFormulario, string>> = {}
  if (v.titulo.trim().length < 2) erros.titulo = 'Dê um título ao aviso.'
  if (!v.texto.trim()) erros.texto = 'Escreva o aviso.'
  const data = v.ate.trim() ? lerDataDigitada(v.ate) : null
  if (v.ate.trim() && !data) erros.ate = 'Use o formato DD/MM/AAAA, por exemplo 30/11/2026.'
  if (Object.keys(erros).length) return { erros }
  return {
    dados: {
      titulo: v.titulo.trim(),
      texto: v.texto.trim(),
      // Vale até o fim do dia escolhido, no fuso da comunidade.
      visivelAte: data ? instanteDeDataEHora(data, '23:59', fuso) : null,
    },
  }
}

export function CamposDoAviso({
  valores,
  aoMudar,
  erros,
}: {
  valores: ValoresDoFormulario
  aoMudar: (v: ValoresDoFormulario) => void
  erros: Partial<Record<keyof ValoresDoFormulario, string>>
}) {
  return (
    <>
      <Campo
        rotulo="Título"
        value={valores.titulo}
        onChangeText={(titulo) => aoMudar({ ...valores, titulo })}
        erro={erros.titulo ?? null}
        maxLength={120}
      />
      <Campo
        rotulo="Texto do aviso"
        value={valores.texto}
        onChangeText={(texto) => aoMudar({ ...valores, texto })}
        erro={erros.texto ?? null}
        multiline
        maxLength={5000}
      />
      <Campo
        rotulo="Mostrar até (opcional)"
        ajuda="Depois deste dia o aviso sai do ar sozinho. Em branco: fica até você despublicar."
        exemplo="30/11/2026"
        value={valores.ate}
        onChangeText={(ate) => aoMudar({ ...valores, ate })}
        erro={erros.ate ?? null}
        inputMode="numeric"
      />
    </>
  )
}

/** Rota `/avisos/novo`. */
export function TelaNovoAviso() {
  return (
    <TelaDaComunidade oQue="o novo aviso" titulo="Novo aviso">
      {(c) => <Formulario comunidadeId={c.id} />}
    </TelaDaComunidade>
  )
}

function Formulario({ comunidadeId }: { comunidadeId: string }) {
  const fuso = useFusoDaComunidade()
  const [valores, setValores] = useState(() => valoresIniciais(null, fuso))
  const [fixado, setFixado] = useState(false)
  const [erros, setErros] = useState<Partial<Record<keyof ValoresDoFormulario, string>>>({})
  const criar = useCriarAviso(comunidadeId)

  function salvar(publicar: boolean) {
    const r = lerFormulario(valores, fuso)
    if ('erros' in r) {
      setErros(r.erros)
      return
    }
    setErros({})
    criar.mutate(
      { ...r.dados, fixado: publicar && fixado, publicar },
      { onSuccess: () => router.back() },
    )
  }

  return (
    <>
      <Cartao>
        <CamposDoAviso valores={valores} aoMudar={setValores} erros={erros} />
        <CaixaDeMarcar
          rotulo="Fixar no topo"
          descricao="Aviso fixado aparece primeiro no Início e na lista. Só vale ao publicar."
          marcada={fixado}
          aoMudar={setFixado}
        />
      </Cartao>
      {criar.error ? <AvisoDeErro erro={criar.error} /> : null}
      <Botao
        titulo="Publicar agora"
        icone="publicar"
        carregando={criar.isPending && criar.variables?.publicar === true}
        desabilitado={criar.isPending}
        aoPressionar={() => salvar(true)}
        dica="Membros veem o aviso e recebem notificação, se tiverem ligado."
      />
      <Botao
        titulo="Guardar como rascunho"
        variante="secundario"
        carregando={criar.isPending && criar.variables?.publicar === false}
        desabilitado={criar.isPending}
        aoPressionar={() => salvar(false)}
      />
    </>
  )
}
