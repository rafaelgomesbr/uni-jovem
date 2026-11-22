import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { mensagemDoErro } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Campo } from '@/ui/Campo'

import { conferirPdfEscolhido, seletorDePdf, type PdfConferido } from '../pdf/seletorDePdf'
import { CampoDeCifra } from './CampoDeCifra'
import { CampoDeLinks } from './CampoDeLinks'
import { CampoDePdf, MENSAGEM_DE_CONFIRMAR_O_PDF } from './CampoDePdf'
import { escreverLinhas, lerLinhas } from './links'
import {
  CAMPO_DA_CONFIRMACAO,
  exigeConfirmarDireitos,
  montarCorpo,
  TIPOS_DE_CONTEUDO,
  type DefinicaoDoTipo,
} from './tipos'

export type Valores = Record<string, string>

/**
 * Os campos de um conteúdo, da definição (`tipos.ts`): a cifra com o aviso de direitos, os links do
 * Drive e do YouTube, e os demais como campo de texto. É a MESMA peça da Biblioteca (música nova e
 * edição) e da folha "Cadastrar nova música" do repertório: uma regra só.
 */
export function Formulario({
  def,
  valores,
  aoMudar,
  erros,
  cifraSalva = null,
  somente,
}: {
  /** Só estes campos (a folha do repertório pede o essencial); sem isto, todos. */
  somente?: readonly string[]
  def: DefinicaoDoTipo
  valores: Valores
  aoMudar: (v: Valores) => void
  erros: Record<string, string>
  /** A cifra como está salva (nula na criação): só a que mudou pede a confirmação de direitos. */
  cifraSalva?: string | null
}) {
  return (
    <>
      {def.campos
        .filter((c) => !somente || somente.includes(c.campo))
        .map((c) =>
          c.formato === 'cifra' ? (
            <CampoDeCifra
              key={c.campo}
              rotulo={c.rotulo}
              valor={valores[c.campo] ?? ''}
              aoMudar={(t) => aoMudar({ ...valores, [c.campo]: t })}
              erro={erros[c.campo] ?? null}
              pedeConfirmacao={exigeConfirmarDireitos(def, valores, cifraSalva)}
              confirmada={valores[CAMPO_DA_CONFIRMACAO] === 'sim'}
              aoConfirmar={(sim) =>
                aoMudar({ ...valores, [CAMPO_DA_CONFIRMACAO]: sim ? 'sim' : 'nao' })
              }
              erroDaConfirmacao={erros[CAMPO_DA_CONFIRMACAO] ?? null}
            />
          ) : c.formato === 'links' ? (
            <CampoDeLinks
              key={c.campo}
              rotulo={c.rotulo}
              linhas={lerLinhas(valores[c.campo])}
              aoMudar={(linhas) => aoMudar({ ...valores, [c.campo]: escreverLinhas(linhas) })}
              erros={erros}
            />
          ) : (
            <Campo
              key={c.campo}
              rotulo={c.rotulo}
              opcional={!c.obrigatorio}
              value={valores[c.campo] ?? ''}
              onChangeText={(t) => aoMudar({ ...valores, [c.campo]: t })}
              erro={erros[c.campo] ?? null}
              {...(c.ajuda ? { ajuda: c.ajuda } : {})}
              multiline={!!c.multilinha}
              {...(c.formato === 'numero'
                ? { inputMode: 'numeric' as const, sufixo: c.unidade ?? 'min' }
                : {})}
              {...(c.formato === 'duracao' ? { exemplo: '3:45' } : {})}
              {...(c.formato === 'tom' ? { autoCapitalize: 'characters' as const } : {})}
              {...(c.formato === 'link'
                ? { inputMode: 'url' as const, autoCapitalize: 'none' as const }
                : {})}
              maxLength={c.formato === 'numero' ? 3 : c.max}
            />
          ),
        )}
    </>
  )
}

/**
 * Confere o aviso de direitos autorais: cifra nova ou mudada só salva com a
 * confirmação marcada. Devolve o erro para o formulário e o que a API espera.
 */
export function conferirDireitos(
  def: DefinicaoDoTipo,
  valores: Valores,
  cifraSalva: string | null,
): { erros: Record<string, string> } | { corpo: { direitosConfirmados?: true } } {
  if (!exigeConfirmarDireitos(def, valores, cifraSalva)) return { corpo: {} }
  if (valores[CAMPO_DA_CONFIRMACAO] !== 'sim') {
    return {
      erros: {
        [CAMPO_DA_CONFIRMACAO]: 'Confirme os direitos de uso para salvar a letra e a cifra.',
      },
    }
  }
  return { corpo: { direitosConfirmados: true } }
}

export function Erro({ titulo, erro }: { titulo: string; erro: unknown }) {
  return (
    <Aviso tipo="erro" titulo={titulo} anunciar>
      {mensagemDoErro(erro)}
    </Aviso>
  )
}

/**
 * Escolhe o arquivo, confere (tamanho e tipo) e devolve o PDF lido, ou a mensagem humana do que
 * deu errado. `null` sem mensagem: a pessoa cancelou a escolha.
 */
export async function escolherEConferirPdf(): Promise<
  { pdf: PdfConferido } | { erro: string } | null
> {
  const arquivo = await seletorDePdf.escolher()
  if (!arquivo) return null
  const r = await conferirPdfEscolhido(arquivo)
  return r.ok ? { pdf: r.pdf } : { erro: r.mensagem }
}

/**
 * O estado do formulário de MÚSICA NOVA (a tela "Nova música" da Biblioteca e a folha "Cadastrar
 * nova música" do repertório do encontro): os campos, os erros, o PDF escolhido (que só vai depois
 * de a música existir) e o `preparar`, que valida tudo e devolve o corpo para a API.
 */
export function useFormularioDeMusica(tituloInicial = '') {
  const def = TIPOS_DE_CONTEUDO.musicas
  const [valores, setValores] = useState<Valores>(tituloInicial ? { titulo: tituloInicial } : {})
  const [erros, setErros] = useState<Record<string, string>>({})
  // O PDF escolhido espera a música ser salva (só então ela tem um id para receber o arquivo).
  const [pdf, setPdf] = useState<PdfConferido | null>(null)
  const [erroDoPdf, setErroDoPdf] = useState<string | null>(null)

  async function escolherPdf() {
    setErroDoPdf(null)
    const r = await escolherEConferirPdf()
    if (!r) return
    if ('erro' in r) setErroDoPdf(r.erro)
    else setPdf(r.pdf)
  }

  function removerPdf() {
    setPdf(null)
    setErroDoPdf(null)
  }

  /** Começa de novo (a folha do repertório reabre o formulário, com o título da busca já escrito). */
  function reiniciar(titulo = '') {
    setValores(titulo ? { titulo } : {})
    setErros({})
    setPdf(null)
    setErroDoPdf(null)
  }

  /**
   * Valida o que a pessoa preencheu e devolve o corpo para a API (sem os campos vazios), ou `null`
   * deixando os erros em palavras na tela. O PDF pede o mesmo aceite de direitos da cifra em texto.
   */
  function preparar(): Record<string, unknown> | null {
    const r = montarCorpo(def, valores)
    const direitos = conferirDireitos(def, valores, null)
    const direitosDoPdf: Record<string, string> =
      pdf && valores[CAMPO_DA_CONFIRMACAO] !== 'sim'
        ? { [CAMPO_DA_CONFIRMACAO]: MENSAGEM_DE_CONFIRMAR_O_PDF }
        : {}
    if ('erros' in r || 'erros' in direitos || Object.keys(direitosDoPdf).length) {
      setErros({
        ...('erros' in r ? r.erros : {}),
        ...('erros' in direitos ? direitos.erros : {}),
        ...direitosDoPdf,
      })
      return null
    }
    setErros({})
    // Na criação, vazio não vai: a API só recebe o que foi preenchido.
    return {
      ...Object.fromEntries(
        Object.entries(r.corpo).filter(([, v]) => v !== null && !(Array.isArray(v) && !v.length)),
      ),
      ...direitos.corpo,
    }
  }

  return {
    def,
    valores,
    setValores,
    erros,
    setErros,
    pdf,
    erroDoPdf,
    escolherPdf,
    removerPdf,
    reiniciar,
    preparar,
  }
}

/** O essencial para cadastrar uma música sem sair do que se está fazendo (D80). */
export const CAMPOS_DA_FOLHA = ['titulo', 'artista', 'tom', 'links', 'cifra'] as const

export type FormularioDeMusica = ReturnType<typeof useFormularioDeMusica>

/** Os campos da música nova: o cartão com o formulário e, abaixo, o PDF (escolhido, ainda sem salvar). */
export function CamposDaMusicaNova({
  form,
  enviandoPdf = false,
  resumido = false,
}: {
  form: FormularioDeMusica
  enviandoPdf?: boolean
  /** Na folha do repertório: só título, artista, tom, links e cifra, sem o cartão em volta. */
  resumido?: boolean
}) {
  const { def, valores, setValores, erros, setErros, pdf, erroDoPdf } = form
  return (
    <>
      {resumido ? (
        <View style={{ gap: ESPACO.e16 }}>
          <Formulario
            def={def}
            valores={valores}
            aoMudar={setValores}
            erros={erros}
            somente={CAMPOS_DA_FOLHA}
          />
        </View>
      ) : (
        <CartaoDeVidro opaco intervalo={ESPACO.e16}>
          <Formulario def={def} valores={valores} aoMudar={setValores} erros={erros} />
        </CartaoDeVidro>
      )}
      <CampoDePdf
        atual={null}
        escolhido={pdf ? { nome: pdf.nome, tamanho: pdf.bytes.length } : null}
        ocupado={enviandoPdf ? 'enviando' : null}
        erro={erroDoPdf}
        confirmada={valores[CAMPO_DA_CONFIRMACAO] === 'sim'}
        aoConfirmar={(sim) =>
          setValores({ ...valores, [CAMPO_DA_CONFIRMACAO]: sim ? 'sim' : 'nao' })
        }
        erroDaConfirmacao={erros[CAMPO_DA_CONFIRMACAO] ?? null}
        aoSemAceite={() =>
          setErros({ ...erros, [CAMPO_DA_CONFIRMACAO]: MENSAGEM_DE_CONFIRMAR_O_PDF })
        }
        avisoJaNaTela={(valores['cifra'] ?? '').trim() !== ''}
        caixaJaNaTela={exigeConfirmarDireitos(def, valores, null)}
        aoEscolher={() => void form.escolherPdf()}
        aoRemover={form.removerPdf}
      />
    </>
  )
}
