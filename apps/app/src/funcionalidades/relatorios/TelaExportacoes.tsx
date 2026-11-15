import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { Platform, View } from 'react-native'

import {
  TIPOS_DE_EXPORTACAO,
  type Exportacao,
  type TipoDeExportacao,
} from '@/servicos/contratoDosModulos'
import { confirmar } from '@/utilidades/confirmar'
import { hojeNoFuso } from '@/utilidades/datas'
import { formatarData, formatarDataEHora } from '@/utilidades/formatos'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
import {
  baixarCsv,
  tokenDe,
  useExcluirExportacao,
  useExportacoes,
  useGerarExportacao,
  useTokensDeExportacao,
} from './consultas'
import { salvarArquivo } from '@/utilidades/salvarArquivo'
import { periodoDosUltimos, SeletorDePeriodo, type Periodo } from './SeletorDePeriodo'

export const NOME_DA_EXPORTACAO: Readonly<Record<TipoDeExportacao, string>> = {
  presenca: 'Presença',
  inscricoes: 'Inscrições',
  escalas: 'Escalas',
  membros: 'Membros',
}

const DESCRICAO: Readonly<Record<TipoDeExportacao, string>> = {
  presenca: 'Quem esteve em cada evento do período.',
  inscricoes: 'Inscrições por evento, com situação e presença.',
  escalas: 'Quem foi escalado, a situação e as substituições.',
  membros: 'Pessoas da comunidade, papel e desde quando participam.',
}

/** Rota `/relatorios/exportacoes`. */
export function TelaExportacoes() {
  const pode = usePode()
  return (
    <TelaDaComunidade
      oQue="as exportações"
      titulo="Exportar CSV"
      descricao="O arquivo fica disponível por 24 horas e só para você. Cada exportação fica registrada."
    >
      {(c) =>
        pode('exportacao', 'sem_contatos') ? (
          <Exportacoes
            comunidadeId={c.id}
            comContatosPermitido={pode('exportacao', 'com_contatos')}
          />
        ) : (
          <Aviso tipo="alerta" titulo="Exportação é da organização">
            Só organizadores e administradores exportam dados da comunidade.
          </Aviso>
        )
      }
    </TelaDaComunidade>
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
    <>
      <Cartao titulo="Nova exportação" icone="baixar">
        <GrupoDeOpcoes
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
          <SeletorDePeriodo hoje={hoje} periodo={periodo} aoMudar={setPeriodo} />
        ) : null}
        {comContatosPermitido ? (
          <CaixaDeMarcar
            rotulo="Incluir e-mail e telefone"
            descricao="Só para administradores. Use apenas para falar com as pessoas sobre a comunidade e apague o arquivo depois."
            marcada={comContatos}
            aoMudar={setComContatos}
          />
        ) : (
          <Texto variante="apoio" cor="textoSuave">
            O arquivo sai sem e-mail e telefone. Exportar contatos é só para administradores.
          </Texto>
        )}
        {gerar.error ? <AvisoDeErro erro={gerar.error} /> : null}
        {gerar.isSuccess ? (
          <Aviso tipo="sucesso" anunciar>
            {`Arquivo pronto: ${gerar.data.linhas} ${gerar.data.linhas === 1 ? 'linha' : 'linhas'}. Baixe na lista abaixo até ${formatarDataEHora(gerar.data.expiraEm)}.`}
          </Aviso>
        ) : null}
        <Botao
          titulo="Gerar arquivo"
          carregando={gerar.isPending}
          aoPressionar={() =>
            gerar.mutate({
              tipo,
              comContatos: comContatosPermitido && comContatos,
              ...(tipo !== 'membros' ? { de: periodo.de, ate: periodo.ate } : {}),
            })
          }
        />
      </Cartao>

      <Cartao titulo="Minhas exportações" icone="documento">
        {lista.isPending ? (
          <Carregando texto="Carregando as exportações" />
        ) : lista.error ? (
          <AvisoDeErro erro={lista.error} aoTentarDeNovo={() => void lista.refetch()} />
        ) : lista.data.length === 0 ? (
          <EstadoVazio
            icone="documento"
            titulo="Nenhuma exportação válida"
            descricao="Os arquivos que você gerar nas últimas 24 horas aparecem aqui."
          />
        ) : (
          lista.data.map((e) => (
            <LinhaDaExportacao key={e.id} comunidadeId={comunidadeId} exportacao={e} />
          ))
        )}
      </Cartao>
    </>
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

  return (
    <View style={{ gap: ESPACO.x2, paddingVertical: ESPACO.x2 }}>
      <Texto variante="corpoForte">{e.nomeArquivo}</Texto>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
        <Selo texto={NOME_DA_EXPORTACAO[e.tipo]} />
        {e.comContatos ? <Selo texto="Com contatos" cor="alerta" /> : null}
      </View>
      <Texto variante="apoio" cor="textoSuave">
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
      {temToken ? (
        <Botao
          titulo={Platform.OS === 'web' ? 'Baixar' : 'Baixar e compartilhar'}
          icone="baixar"
          variante="secundario"
          rotuloAcessivel={`Baixar ${e.nomeArquivo}`}
          carregando={baixar.isPending}
          aoPressionar={() => baixar.mutate()}
        />
      ) : (
        <Texto variante="apoio" cor="textoSuave">
          O código para baixar fica só na memória do app, da geração até você fechar o app ou sair
          da conta; ele nunca é gravado no aparelho. Para baixar de novo, gere outra exportação.
        </Texto>
      )}
      {baixar.error ? <AvisoDeErro erro={baixar.error} /> : null}
      {excluir.error ? <AvisoDeErro erro={excluir.error} /> : null}
      <Botao
        titulo="Apagar"
        icone="excluir"
        variante="discreto"
        larguraTotal={false}
        rotuloAcessivel={`Apagar ${e.nomeArquivo}`}
        carregando={excluir.isPending}
        aoPressionar={() => void pedirExclusao()}
      />
    </View>
  )
}
