import { ESPACO } from '@uj/tokens'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { mensagemDoErro } from '@/servicos/erros'
import {
  dataDoInstante,
  dataValidaOuNula,
  hojeNoFuso,
  instanteDeDataEHora,
} from '@/utilidades/datas'
import { Acordeao } from '@/ui/Acordeao'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CampoDeData } from '@/ui/CampoDeMomento'
import { Cartao } from '@/ui/Cartao'
import { Interruptor } from '@/ui/Interruptor'
import { useConfirmarDescarte, useTravaDeEnvio, voltarOu } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { frasePraDesfazer, mostrarDesfazer, useSegundosDoDesfazer } from '@/ui/ToastComDesfazer'

import { useEstaOnline } from '../offline/ProvedorOffline'
import { useFusoDaComunidade } from '../comunidade/consultas'
import { SemComunidade } from '../navegacao/SemComunidade'
import { rotuloDePublicar, useCriarAviso, usePessoasAAvisar, type DadosDoAviso } from './consultas'

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

/**
 * Título e texto sempre à vista; o resto ("Mostrar até" e, no aviso novo, "Fixar no topo")
 * fica em "Mais opções", fechado: dois campos e um botão bastam para a maioria dos avisos
 * (UX, fluxo g). O seletor de data é nativo: nada é digitado.
 */
export function CamposDoAviso({
  valores,
  aoMudar,
  erros,
  fuso,
  maisOpcoes,
}: {
  valores: ValoresDoFormulario
  aoMudar: (v: ValoresDoFormulario) => void
  erros: Partial<Record<keyof ValoresDoFormulario, string>>
  fuso: string
  /** Outros controles de "Mais opções" (o interruptor de fixar, só no aviso novo). */
  maisOpcoes?: ReactNode
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
      <Acordeao
        recuo={0}
        rotuloRecolhido="Mais opções. Recolhido, toque para ver."
        rotuloAberto="Mais opções. Aberto, toque para recolher."
        cabecalho={() => <Texto variante="tituloItem">Mais opções</Texto>}
      >
        <View style={{ gap: ESPACO.e16, paddingTop: ESPACO.e8 }}>
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
          {maisOpcoes}
        </View>
      </Acordeao>
      {/* O erro do dia escolhido não pode ficar escondido com "Mais opções" fechado. */}
      {erros.ate ? (
        <Aviso tipo="erro" titulo="Mostrar até" anunciar>
          {erros.ate}
        </Aviso>
      ) : null}
    </>
  )
}

/**
 * Rota `/avisos/novo` (D70, fluxo g): Título e Texto; "Mais opções" fechado (Mostrar até e
 * Fixar no topo). A barra de ação tem "Guardar rascunho" (ninguém é avisado) e "Publicar e
 * avisar N pessoas". Publicar avisa gente, então o envio **espera 10 s** com "Desfazer":
 * a tela fica como está (nada se perde), o botão diz "Publicando..." e só ao fim a chamada
 * sai. Sem internet, o botão fica desabilitado com o motivo e o texto fica guardado só na
 * tela. Agendar para depois fica de fora: a API não tem data de publicação.
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
  const online = useEstaOnline()
  const aAvisar = usePessoasAAvisar(comunidadeId)
  const segundosDoDesfazer = useSegundosDoDesfazer()
  const [valores, setValores] = useState(() => valoresIniciais(null, fuso))
  const [fixado, setFixado] = useState(false)
  const [erros, setErros] = useState<Partial<Record<keyof ValoresDoFormulario, string>>>({})
  // O aviso já foi "publicado" na tela e espera a contagem do Desfazer.
  const [esperando, setEsperando] = useState(false)
  const criar = useCriarAviso(comunidadeId)
  const trava = useTravaDeEnvio()
  const temConteudo = !!valores.titulo.trim() || !!valores.texto.trim() || !!valores.ate || fixado
  // Quem saiu da tela durante a espera quis publicar: não pergunta se quer descartar.
  const liberar = useConfirmarDescarte(temConteudo && !esperando)

  function enviar(publicar: boolean, dados: Omit<DadosDoAviso, 'fixado'>) {
    // Um aviso por envio: o segundo toque, antes da resposta, não cria outro (com push de novo).
    if (!trava.pegar()) return
    criar.mutate(
      { ...dados, fixado: publicar && fixado, publicar },
      {
        onSuccess: () => {
          mostrarToast({
            texto: publicar
              ? aAvisar
                ? `Publicado. ${aAvisar} ${aAvisar === 1 ? 'pessoa avisada' : 'pessoas avisadas'}.`
                : 'Aviso publicado.'
              : 'Rascunho guardado',
          })
          liberar()
          voltarOu('/avisos')
        },
        onError: () => {
          trava.soltar()
          setEsperando(false)
        },
      },
    )
  }

  function salvar(publicar: boolean) {
    const r = lerFormulario(valores, fuso)
    if ('erros' in r) {
      setErros(r.erros)
      return
    }
    setErros({})
    if (!publicar) {
      enviar(false, r.dados)
      return
    }
    setEsperando(true)
    mostrarDesfazer({
      texto: aAvisar
        ? `Publicando e avisando ${aAvisar} ${aAvisar === 1 ? 'pessoa' : 'pessoas'}.`
        : 'Publicando o aviso.',
      // Só aqui a chamada sai: se o app for encerrado antes, nada foi publicado nem avisado.
      aoConfirmar: () => enviar(true, r.dados),
      aoDesfazer: () => setEsperando(false),
    })
  }

  const ocupado = criar.isPending || esperando
  return (
    <Tela
      pilha
      titulo="Novo aviso"
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Guardar rascunho"
            variante="secundario"
            tamanho="grande"
            carregando={criar.isPending && criar.variables?.publicar === false}
            desabilitado={ocupado}
            aoPressionar={() => salvar(false)}
          />
          <Botao
            titulo={esperando && !criar.isPending ? 'Publicando…' : rotuloDePublicar(aAvisar)}
            tamanho="grande"
            carregando={criar.isPending && criar.variables?.publicar === true}
            desabilitado={ocupado || !online}
            {...(online ? {} : { motivo: 'Precisa de internet para avisar as pessoas.' })}
            aoPressionar={() => salvar(true)}
            dica={`Membros veem o aviso e recebem notificação, se tiverem ligado. ${frasePraDesfazer(segundosDoDesfazer)}`}
          />
        </BarraDeAcao>
      }
    >
      <Cartao variante="plano" style={{ gap: ESPACO.e16 }}>
        <CamposDoAviso
          valores={valores}
          aoMudar={setValores}
          erros={erros}
          fuso={fuso}
          maisOpcoes={
            <Interruptor
              rotulo="Fixar no topo"
              ligado={fixado}
              aoMudar={setFixado}
              descricao={
                fixado
                  ? 'Ligado: aparece primeiro no mural, no Início e na lista. Só vale ao publicar.'
                  : 'Desligado: entra na ordem de publicação.'
              }
            />
          }
        />
      </Cartao>
      {criar.error ? (
        <Aviso tipo="erro" titulo="Não deu para publicar" anunciar>
          {`${mensagemDoErro(criar.error)} Seu texto continua aqui. Tente de novo.`}
        </Aviso>
      ) : null}
    </Tela>
  )
}
