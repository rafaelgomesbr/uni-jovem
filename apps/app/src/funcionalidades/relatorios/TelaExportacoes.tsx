import { useMutation } from '@tanstack/react-query'
import { BORDA, ESPACO } from '@uj/tokens'
import { Fragment, useState } from 'react'
import { Platform, View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import {
  TIPOS_DE_EXPORTACAO,
  type Exportacao,
  type TipoDeExportacao,
} from '@/servicos/contratoDosModulos'
import { mensagemDoErro, SemConexao } from '@/servicos/erros'
import { confirmar } from '@/utilidades/confirmar'
import { hojeNoFuso } from '@/utilidades/datas'
import { formatarData, formatarDataEHora } from '@/utilidades/formatos'
import { salvarArquivo } from '@/utilidades/salvarArquivo'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import {
  baixarCsv,
  tokenDe,
  useExcluirExportacao,
  useExportacoes,
  useGerarExportacao,
  useTokensDeExportacao,
} from './consultas'
import { periodoDosUltimos, SeletorDePeriodo, type Periodo } from './SeletorDePeriodo'

export const NOME_DA_EXPORTACAO: Readonly<Record<TipoDeExportacao, string>> = {
  presenca: 'Presença',
  inscricoes: 'Inscrições',
  escalas: 'Convocações',
  membros: 'Membros',
}

const DESCRICAO: Readonly<Record<TipoDeExportacao, string>> = {
  presenca: 'Quem esteve em cada encontro do período.',
  inscricoes: 'Inscrições por encontro, com situação e presença.',
  escalas: 'Quem foi convocado, a situação e as substituições.',
  membros: 'Pessoas da comunidade, papel e desde quando participam.',
}

const TITULO = 'Exportar CSV'

/**
 * Rota `/relatorios/exportacoes` (3.7.5): o tipo de arquivo numa lista de
 * opções, o período, o aviso de que o arquivo expira em 24 h, "Gerar arquivo"
 * na barra de ação e as exportações recentes num cartão.
 */
export function TelaExportacoes() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo={TITULO}>
        <SemComunidade oQue="as exportações" />
      </Tela>
    )
  }
  if (!pode('exportacao', 'sem_contatos')) {
    return (
      <Tela pilha titulo={TITULO}>
        <Aviso tipo="alerta" titulo="Exportação é da organização">
          Só organizadores e administradores exportam dados da comunidade.
        </Aviso>
      </Tela>
    )
  }
  return (
    <Exportacoes
      comunidadeId={comunidadeAtiva.id}
      comContatosPermitido={pode('exportacao', 'com_contatos')}
    />
  )
}

function Exportacoes({
  comunidadeId,
  comContatosPermitido,
}: {
  comunidadeId: string
  comContatosPermitido: boolean
}) {
  const fuso = useFusoDaComunidade()
  const hoje = hojeNoFuso(fuso)
  const [tipo, setTipo] = useState<TipoDeExportacao>('presenca')
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDosUltimos(90, hoje))
  const [comContatos, setComContatos] = useState(false)
  const gerar = useGerarExportacao(comunidadeId)
  const lista = useExportacoes(comunidadeId)
  useTokensDeExportacao()

  return (
    <Tela
      pilha
      titulo={TITULO}
      descricao="Cada exportação fica registrada."
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Gerar arquivo"
            tamanho="grande"
            carregando={gerar.isPending}
            aoPressionar={() =>
              gerar.mutate({
                tipo,
                comContatos: comContatosPermitido && comContatos,
                ...(tipo !== 'membros' ? { de: periodo.de, ate: periodo.ate } : {}),
              })
            }
          />
        </BarraDeAcao>
      }
    >
      <ListaDeOpcoes
        rotulo="O que exportar"
        valor={tipo}
        aoMudar={setTipo}
        opcoes={TIPOS_DE_EXPORTACAO.map((t) => ({
          valor: t,
          rotulo: NOME_DA_EXPORTACAO[t],
          descricao: DESCRICAO[t],
        }))}
      />
      {tipo !== 'membros' ? (
        <Secao titulo="Período">
          <SeletorDePeriodo hoje={hoje} periodo={periodo} aoMudar={setPeriodo} />
        </Secao>
      ) : null}
      {comContatosPermitido ? (
        <CartaoDeVidro opaco>
          <CaixaDeMarcar
            rotulo="Incluir e-mail e telefone"
            descricao="Só para administradores. Use apenas para falar com as pessoas sobre a comunidade e apague o arquivo depois."
            marcada={comContatos}
            aoMudar={setComContatos}
          />
        </CartaoDeVidro>
      ) : (
        <Texto variante="legenda" cor="textoSuave">
          O arquivo sai sem e-mail e telefone. Exportar contatos é só para administradores.
        </Texto>
      )}
      <Aviso tipo="info" titulo="O arquivo expira em 24 h">
        Fica disponível só para você. Depois disso, gere outro.
      </Aviso>
      {gerar.error ? (
        <Aviso tipo="erro" titulo="Não deu para gerar o arquivo" anunciar>
          {mensagemDoErro(gerar.error)}
        </Aviso>
      ) : null}
      {gerar.isSuccess ? (
        <Aviso tipo="sucesso" anunciar>
          {`Arquivo pronto: ${gerar.data.linhas} ${gerar.data.linhas === 1 ? 'linha' : 'linhas'}. Baixe na lista abaixo até ${formatarDataEHora(gerar.data.expiraEm)}.`}
        </Aviso>
      ) : null}

      <Secao titulo="Minhas exportações">
        {lista.isPending ? (
          <Esqueleto rotulo="Carregando as exportações">
            <CartaoDeEsqueleto />
          </Esqueleto>
        ) : lista.error ? (
          <EstadoVazio
            icone={lista.error instanceof SemConexao ? 'semConexao' : 'erro'}
            titulo="Não deu para carregar as exportações"
            descricao={mensagemDoErro(lista.error)}
            acao={{ titulo: 'Tentar de novo', aoPressionar: () => void lista.refetch() }}
          />
        ) : lista.data.length === 0 ? (
          <EstadoVazio
            icone="documento"
            titulo="Nenhuma exportação válida"
            descricao="Os arquivos que você gerar nas últimas 24 horas aparecem aqui."
          />
        ) : (
          <ListaDeExportacoes comunidadeId={comunidadeId} exportacoes={lista.data} />
        )}
      </Secao>
    </Tela>
  )
}

function ListaDeExportacoes({
  comunidadeId,
  exportacoes,
}: {
  comunidadeId: string
  exportacoes: readonly Exportacao[]
}) {
  const { cores } = useTema()
  return (
    <CartaoDeVidro intervalo={ESPACO.e12}>
      {exportacoes.map((e, i) => (
        <Fragment key={e.id}>
          {i > 0 ? <View style={{ height: BORDA.fina, backgroundColor: cores.separador }} /> : null}
          <LinhaDaExportacao comunidadeId={comunidadeId} exportacao={e} />
        </Fragment>
      ))}
    </CartaoDeVidro>
  )
}

function LinhaDaExportacao({
  comunidadeId,
  exportacao: e,
}: {
  comunidadeId: string
  exportacao: Exportacao
}) {
  const excluir = useExcluirExportacao(comunidadeId)
  const baixar = useMutation({
    mutationFn: async () =>
      salvarArquivo(e.nomeArquivo, await baixarCsv(comunidadeId, e.id), 'csv'),
    // O resultado é o CSV: não fica em cache.
    gcTime: 0,
  })
  const temToken = tokenDe(e.id) !== undefined

  async function pedirExclusao() {
    const ok = await confirmar({
      titulo: 'Apagar esta exportação?',
      mensagem:
        'O arquivo deixa de existir no servidor. Cópias que você já baixou continuam com você.',
      confirmar: 'Apagar',
      destrutivo: true,
    })
    if (ok) excluir.mutate(e.id)
  }

  const erro = baixar.error ?? excluir.error
  return (
    <View style={{ gap: ESPACO.e8 }}>
      <View style={{ gap: ESPACO.e4 }}>
        <Texto variante="tituloItem">{e.nomeArquivo}</Texto>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
          {temToken ? <Chip texto="Pronta" tom="sucesso" icone="check" /> : null}
          <Chip texto={NOME_DA_EXPORTACAO[e.tipo]} tom="neutro" />
          {e.comContatos ? <Chip texto="Com contatos" tom="alerta" /> : null}
        </View>
        <Texto variante="meta" cor="textoSuave">
          {[
            `${e.linhas} ${e.linhas === 1 ? 'linha' : 'linhas'}`,
            e.filtros.de && e.filtros.ate
              ? `de ${formatarData(`${e.filtros.de}T12:00:00Z`)} a ${formatarData(`${e.filtros.ate}T12:00:00Z`)}`
              : null,
            `disponível até ${formatarDataEHora(e.expiraEm)}`,
            e.downloads ? `baixado ${e.downloads} ${e.downloads === 1 ? 'vez' : 'vezes'}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Texto>
        {temToken ? null : (
          <Texto variante="legenda" cor="textoSuave">
            O código para baixar fica só na memória do app, da geração até você fechar o app ou sair
            da conta; ele nunca é gravado no aparelho. Para baixar de novo, gere outra exportação.
          </Texto>
        )}
      </View>
      {erro ? (
        <Aviso tipo="erro" titulo="Não deu certo" anunciar>
          {mensagemDoErro(erro)}
        </Aviso>
      ) : null}
      <ParDeBotoes>
        {temToken ? (
          <Botao
            titulo={Platform.OS === 'web' ? 'Baixar' : 'Baixar e compartilhar'}
            variante="secundario"
            rotuloAcessivel={`Baixar ${e.nomeArquivo}`}
            carregando={baixar.isPending}
            aoPressionar={() => baixar.mutate()}
          />
        ) : null}
        <Botao
          titulo="Apagar"
          variante="destrutivo"
          rotuloAcessivel={`Apagar ${e.nomeArquivo}`}
          carregando={excluir.isPending}
          aoPressionar={() => void pedirExclusao()}
        />
      </ParDeBotoes>
    </View>
  )
}
