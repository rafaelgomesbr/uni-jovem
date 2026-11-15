import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { STATUS_DA_SUGESTAO, type StatusDaSugestao } from '@/servicos/contratoDosModulos'
import { formatarData } from '@/utilidades/formatos'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Linha } from '@/ui/Linha'
import { Segmentos } from '@/ui/Segmentos'
import { Selo } from '@/ui/Selo'

import { usePode } from '../comunidade/permissoes'
import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
import { NOME_DO_STATUS, useSugestoes } from './consultas'

type Filtro = StatusDaSugestao | 'todas'

/** Rota `/sugestoes`. */
export function TelaSugestoes() {
  const pode = usePode()
  const modera = pode('sugestao', 'moderar')
  return (
    <TelaDaComunidade
      oQue="as sugestões"
      titulo="Sugestões"
      descricao={
        modera
          ? 'Ideias da comunidade. Mude o status e responda para quem sugeriu saber o que aconteceu.'
          : 'Suas ideias para a comunidade e as respostas da organização.'
      }
    >
      {(c) => <Lista comunidadeId={c.id} modera={modera} />}
    </TelaDaComunidade>
  )
}

function Lista({ comunidadeId, modera }: { comunidadeId: string; modera: boolean }) {
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const sugestoes = useSugestoes(comunidadeId, filtro === 'todas' ? null : filtro)

  return (
    <>
      <Botao
        titulo="Nova sugestão"
        icone="adicionar"
        aoPressionar={() => router.push('/sugestoes/nova')}
      />
      {modera ? (
        <Segmentos
          rotulo="Status"
          valor={filtro}
          aoMudar={setFiltro}
          segmentos={[
            { valor: 'todas', rotulo: 'Todas' },
            ...STATUS_DA_SUGESTAO.map((s) => ({ valor: s, rotulo: NOME_DO_STATUS[s] })),
          ]}
        />
      ) : null}
      {sugestoes.isPending ? (
        <Carregando texto="Carregando as sugestões" />
      ) : sugestoes.error ? (
        <AvisoDeErro erro={sugestoes.error} aoTentarDeNovo={() => void sugestoes.refetch()} />
      ) : sugestoes.data.length === 0 ? (
        <Cartao>
          <EstadoVazio
            icone="sugestao"
            titulo="Nenhuma sugestão por aqui"
            descricao={
              modera
                ? 'Quando alguém da comunidade sugerir algo, aparece aqui para você analisar.'
                : 'Tem uma ideia para os encontros? Mande para a organização; dá para enviar sem mostrar seu nome.'
            }
            acao={{
              titulo: 'Nova sugestão',
              icone: 'adicionar',
              aoPressionar: () => router.push('/sugestoes/nova'),
            }}
          />
        </Cartao>
      ) : (
        <Cartao>
          {sugestoes.data.map((s) => (
            <View key={s.id} style={{ gap: ESPACO.e4 }}>
              <Linha
                titulo={s.titulo}
                descricao={[
                  s.minha ? 'Sua sugestão' : s.anonima ? 'Anônima' : (s.autorNome ?? 'Pessoa'),
                  formatarData(s.criadoEm),
                  NOME_DO_STATUS[s.status],
                  s.resposta ? 'Respondida' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                extra={<Selo texto={NOME_DO_STATUS[s.status]} cor={corDoStatus(s.status)} />}
                aoPressionar={() =>
                  router.push({ pathname: '/sugestoes/[sugestaoId]', params: { sugestaoId: s.id } })
                }
              />
            </View>
          ))}
        </Cartao>
      )}
    </>
  )
}

export function corDoStatus(s: StatusDaSugestao) {
  return s === 'aceita'
    ? 'sucesso'
    : s === 'recusada'
      ? 'erro'
      : s === 'em_analise'
        ? 'alerta'
        : 'textoSuave'
}
