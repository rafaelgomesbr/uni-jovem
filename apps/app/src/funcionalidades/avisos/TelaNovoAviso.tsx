import { ESPACO } from '@uj/tokens'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import { mensagemDoErro } from '@/servicos/erros'
import {
  dataDoInstante,
  dataValidaOuNula,
  hojeNoFuso,
  instanteDeDataEHora,
} from '@/utilidades/datas'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CampoDeData } from '@/ui/CampoDeMomento'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Interruptor } from '@/ui/Interruptor'
import { useConfirmarDescarte, useTravaDeEnvio, voltarOu } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { mostrarToast } from '@/ui/Toast'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useCriarAviso, type DadosDoAviso } from './consultas'

interface ValoresDoFormulario {
  titulo: string
  texto: string
  /** Último dia no ar (`AAAA-MM-DD`, escolhido no seletor) ou vazio. */
  ate: string
}

export function valoresIniciais(
  aviso: { titulo: string; texto: string; visivelAte: string | null } | null,
  fuso: string,
): ValoresDoFormulario {
  return {
    titulo: aviso?.titulo ?? '',
    texto: aviso?.texto ?? '',
    ate: aviso?.visivelAte ? dataDoInstante(aviso.visivelAte, fuso) : '',
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
  const data = v.ate ? dataValidaOuNula(v.ate) : null
  if (v.ate && !data) erros.ate = 'Escolha o dia de novo no calendário.'
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

/** Título, texto e o último dia no ar (seletor de data nativo; nada é digitado). */
export function CamposDoAviso({
  valores,
  aoMudar,
  erros,
  fuso,
}: {
  valores: ValoresDoFormulario
  aoMudar: (v: ValoresDoFormulario) => void
  erros: Partial<Record<keyof ValoresDoFormulario, string>>
  fuso: string
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
        mostrarContador
      />
      <CampoDeData
        rotulo="Mostrar até"
        opcional
        ajuda="Depois deste dia o aviso sai do ar sozinho. Sem data, fica até você tirar do ar."
        valor={valores.ate || null}
        minimo={hojeNoFuso(fuso)}
        aoMudar={(ate) => aoMudar({ ...valores, ate })}
        erro={erros.ate ?? null}
      />
      {valores.ate ? (
        <Botao
          titulo="Sem data final"
          variante="terciario"
          alinhado
          aoPressionar={() => aoMudar({ ...valores, ate: '' })}
        />
      ) : null}
    </>
  )
}

/**
 * Rota `/avisos/novo` (3.7.4): Título, Texto, "Mostrar até" com seletor e o
 * interruptor "Fixar no topo"; a barra de ação tem "Guardar como rascunho" e
 * "Publicar agora".
 */
export function TelaNovoAviso() {
  const { comunidadeAtiva } = useSessao()
  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo="Novo aviso">
        <SemComunidade oQue="o novo aviso" />
      </Tela>
    )
  }
  return <Formulario comunidadeId={comunidadeAtiva.id} />
}

function Formulario({ comunidadeId }: { comunidadeId: string }) {
  const fuso = useFusoDaComunidade()
  const [valores, setValores] = useState(() => valoresIniciais(null, fuso))
  const [fixado, setFixado] = useState(false)
  const [erros, setErros] = useState<Partial<Record<keyof ValoresDoFormulario, string>>>({})
  const criar = useCriarAviso(comunidadeId)
  const trava = useTravaDeEnvio()
  const liberar = useConfirmarDescarte(
    !!valores.titulo.trim() || !!valores.texto.trim() || !!valores.ate || fixado,
  )

  function salvar(publicar: boolean) {
    const r = lerFormulario(valores, fuso)
    if ('erros' in r) {
      setErros(r.erros)
      return
    }
    setErros({})
    // Um aviso por envio: o segundo toque, antes da resposta, não cria outro (com push de novo).
    if (!trava.pegar()) return
    criar.mutate(
      { ...r.dados, fixado: publicar && fixado, publicar },
      {
        onSuccess: () => {
          mostrarToast({ texto: publicar ? 'Aviso publicado' : 'Rascunho guardado' })
          liberar()
          voltarOu('/avisos')
        },
        onError: trava.soltar,
      },
    )
  }

  return (
    <Tela
      pilha
      titulo="Novo aviso"
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Guardar como rascunho"
            variante="secundario"
            tamanho="grande"
            carregando={criar.isPending && criar.variables?.publicar === false}
            desabilitado={criar.isPending}
            aoPressionar={() => salvar(false)}
          />
          <Botao
            titulo="Publicar agora"
            tamanho="grande"
            carregando={criar.isPending && criar.variables?.publicar === true}
            desabilitado={criar.isPending}
            aoPressionar={() => salvar(true)}
            dica="Membros veem o aviso e recebem notificação, se tiverem ligado."
          />
        </BarraDeAcao>
      }
    >
      <CartaoDeVidro opaco intervalo={ESPACO.e16}>
        <CamposDoAviso valores={valores} aoMudar={setValores} erros={erros} fuso={fuso} />
      </CartaoDeVidro>
      <CartaoDeVidro opaco>
        <Interruptor
          rotulo="Fixar no topo"
          ligado={fixado}
          aoMudar={setFixado}
          descricao={
            fixado
              ? 'Ligado: aparece primeiro no Início e na lista. Só vale ao publicar.'
              : 'Desligado: entra na ordem de publicação.'
          }
        />
      </CartaoDeVidro>
      {criar.error ? (
        <Aviso tipo="erro" titulo="Não deu para salvar o aviso" anunciar>
          {mensagemDoErro(criar.error)}
        </Aviso>
      ) : null}
    </Tela>
  )
}
