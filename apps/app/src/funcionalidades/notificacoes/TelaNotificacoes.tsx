import { NOME_DO_TIPO_DE_NOTIFICACAO, type TipoDeNotificacao } from '@uj/dominio'
import { router } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Linha } from '@/ui/Linha'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import {
  usePreferenciasDaComunidade,
  usePreferenciasDaConta,
  useSalvarPreferenciasDaComunidade,
} from './consultas'
import { PermissaoDoSistema } from './PermissaoDoSistema'

const DESCRICAO_DO_TIPO: Readonly<Record<TipoDeNotificacao, string>> = {
  eventos: 'Evento novo ou publicado.',
  escalas: 'Quando escalarem você.',
  inscricoes: 'Sua inscrição confirmada ou saindo da lista de espera.',
  tarefas: 'Tarefas que forem suas.',
  substituicoes: 'Pedidos de substituição que você pode assumir.',
  alteracoes_importantes: 'Evento cancelado ou adiado.',
  avisos: 'Aviso novo da organização.',
}

/** Rota `/notificacoes`: estado do sistema e preferências por tipo e por comunidade. */
export function TelaNotificacoes() {
  const { comunidades, comunidadeAtiva } = useSessao()
  const [escolhida, setEscolhida] = useState<string | null>(
    comunidadeAtiva?.id ?? comunidades[0]?.id ?? null,
  )
  const conta = usePreferenciasDaConta()
  const versiculo = conta.data?.versiculo

  return (
    <Tela
      cabecalhoNativo
      titulo="Notificações"
      descricao="O que o app avisa e em quais comunidades. A permissão do aparelho é separada."
    >
      <Cartao titulo="Neste aparelho" icone="aparelho">
        <PermissaoDoSistema ligadoNoApp />
      </Cartao>

      <Cartao titulo="Por comunidade" icone="comunidade">
        {comunidades.length === 0 ? (
          <Texto variante="apoio" cor="textoSuave">
            Quando você entrar numa comunidade, escolha aqui o que ela pode avisar.
          </Texto>
        ) : (
          <>
            {comunidades.length > 1 ? (
              <GrupoDeOpcoes
                rotulo="Comunidade"
                valor={escolhida}
                aoMudar={setEscolhida}
                opcoes={comunidades.map((c) => ({ valor: c.id, rotulo: c.nome }))}
              />
            ) : null}
            {escolhida ? (
              <PreferenciasDaComunidade
                key={escolhida}
                comunidadeId={escolhida}
                nome={comunidades.find((c) => c.id === escolhida)?.nome ?? ''}
              />
            ) : null}
          </>
        )}
      </Cartao>

      <Cartao titulo="Versículo do dia" icone="versiculo">
        <Linha
          titulo="Versículo do dia"
          descricao={
            versiculo
              ? versiculo.ativo
                ? `Ligado, às ${versiculo.hora}. Vale para todas as suas comunidades.`
                : 'Desligado.'
              : 'Ligar, desligar e escolher o horário.'
          }
          aoPressionar={() => router.push('/versiculo')}
        />
      </Cartao>
    </Tela>
  )
}

function PreferenciasDaComunidade({ comunidadeId, nome }: { comunidadeId: string; nome: string }) {
  const prefs = usePreferenciasDaComunidade(comunidadeId)
  const salvar = useSalvarPreferenciasDaComunidade(comunidadeId)
  if (prefs.isPending) return <Carregando texto="Carregando as preferências" />
  if (prefs.error) {
    return <AvisoDeErro erro={prefs.error} aoTentarDeNovo={() => void prefs.refetch()} />
  }
  const { todas, tipos } = prefs.data
  return (
    <>
      <CaixaDeMarcar
        rotulo={`Receber notificações de ${nome}`}
        descricao={todas ? 'Ligado: escolha os tipos abaixo.' : 'Desligado: nada desta comunidade.'}
        marcada={todas}
        desabilitada={salvar.isPending}
        aoMudar={(v) => salvar.mutate({ todas: v })}
      />
      {tipos.map((t) => (
        <CaixaDeMarcar
          key={t.tipo}
          rotulo={NOME_DO_TIPO_DE_NOTIFICACAO[t.tipo]}
          descricao={
            todas ? DESCRICAO_DO_TIPO[t.tipo] : 'Ligue as notificações da comunidade para escolher.'
          }
          marcada={todas && t.ativo}
          desabilitada={!todas || salvar.isPending}
          aoMudar={(v) => salvar.mutate({ tipos: { [t.tipo]: v } })}
        />
      ))}
      {salvar.error ? <AvisoDeErro erro={salvar.error} /> : null}
    </>
  )
}
