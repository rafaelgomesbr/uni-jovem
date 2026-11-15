import { NOME_DO_TIPO_DE_NOTIFICACAO, type TipoDeNotificacao } from '@uj/dominio'
import { router } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha } from '@/ui/Falha'
import { Interruptor } from '@/ui/Interruptor'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'

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

/**
 * Rota `/notificacoes` (3.6.6): "NESTE APARELHO" (a permissão do sistema),
 * "POR COMUNIDADE" (pílulas com os nomes, quando há mais de uma, e o cartão
 * de interruptores: o principal primeiro e um por tipo) e "VERSÍCULO" (o
 * horário e o atalho para a tela dele).
 */
export function TelaNotificacoes() {
  const { comunidades, comunidadeAtiva } = useSessao()
  // Só a escolha explícita é estado; sem ela, vale a comunidade em uso (derivada a cada render).
  const [escolhaFeita, setEscolhida] = useState<string | null>(null)
  const escolhida =
    (escolhaFeita && comunidades.some((c) => c.id === escolhaFeita) ? escolhaFeita : null) ??
    comunidadeAtiva?.id ??
    comunidades[0]?.id ??
    null
  const conta = usePreferenciasDaConta()
  const versiculo = conta.data?.versiculo

  return (
    <Tela pilha titulo="Notificações">
      <Secao titulo="Neste aparelho">
        <PermissaoDoSistema ligadoNoApp />
      </Secao>

      <Secao titulo="Por comunidade">
        {comunidades.length === 0 ? (
          <EstadoVazio
            icone="pessoas"
            titulo="Nenhuma comunidade ainda"
            descricao="Quando você entrar numa comunidade, escolha aqui o que ela pode avisar."
            acao={{
              titulo: 'Colar link de convite',
              icone: 'link',
              variante: 'secundario',
              aoPressionar: () => router.push('/entrar-com-convite'),
            }}
          />
        ) : (
          <>
            {comunidades.length > 1 ? (
              <PilulasDeFiltro
                rotulo="Comunidade"
                pilulas={comunidades.map((c) => ({ valor: c.id, rotulo: c.nome }))}
                selecionadas={escolhida ? [escolhida] : []}
                aoMudar={(v) => {
                  if (v[0]) setEscolhida(v[0])
                }}
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
      </Secao>

      <Secao titulo="Versículo">
        <CartaoDeVidro lista>
          <LinhaDeLista
            icone="versiculo"
            titulo="Versículo do dia"
            descricao={
              versiculo
                ? versiculo.ativo
                  ? 'Ligado. Vale para todas as suas comunidades.'
                  : 'Desligado.'
                : 'Ligar, desligar e escolher o horário.'
            }
            {...(versiculo?.ativo ? { valor: versiculo.hora } : {})}
            rotuloAcessivel={`Versículo do dia. ${
              versiculo ? (versiculo.ativo ? `Ligado, às ${versiculo.hora}` : 'Desligado') : ''
            }`}
            dica="Abre o horário e a notificação do versículo."
            aoPressionar={() => router.push('/versiculo')}
          />
        </CartaoDeVidro>
      </Secao>
    </Tela>
  )
}

/**
 * Interruptores de uma comunidade: o principal ("Receber de Jovens Centro")
 * e, abaixo, um por tipo com a descrição. Com o principal desligado, os
 * tipos ficam desabilitados e dizem por quê.
 */
function PreferenciasDaComunidade({ comunidadeId, nome }: { comunidadeId: string; nome: string }) {
  const prefs = usePreferenciasDaComunidade(comunidadeId)
  const salvar = useSalvarPreferenciasDaComunidade(comunidadeId)
  if (prefs.isPending) {
    return (
      <Esqueleto rotulo="Carregando as preferências">
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (prefs.error) {
    return (
      <AvisoDeFalha
        erro={prefs.error}
        titulo="Não deu para carregar as preferências"
        aoTentarDeNovo={() => void prefs.refetch()}
      />
    )
  }
  const { todas, tipos } = prefs.data
  const principal = `Receber de ${nome}`
  return (
    <>
      <CartaoDeVidro intervalo={0}>
        <Lista>
          <Interruptor
            rotulo={principal}
            descricao={
              todas ? 'Ligado: escolha os tipos abaixo.' : 'Desligado: nada desta comunidade.'
            }
            ligado={todas}
            desabilitado={salvar.isPending}
            aoMudar={(v) => salvar.mutate({ todas: v })}
          />
          {tipos.map((t) => (
            <Interruptor
              key={t.tipo}
              rotulo={NOME_DO_TIPO_DE_NOTIFICACAO[t.tipo]}
              descricao={todas ? DESCRICAO_DO_TIPO[t.tipo] : `Ligue "${principal}" para escolher.`}
              ligado={todas && t.ativo}
              desabilitado={!todas || salvar.isPending}
              aoMudar={(v) => salvar.mutate({ tipos: { [t.tipo]: v } })}
            />
          ))}
        </Lista>
      </CartaoDeVidro>
      {salvar.error ? <AvisoDeFalha erro={salvar.error} /> : null}
    </>
  )
}
