import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { STATUS_DA_SUGESTAO, type StatusDaSugestao } from '@/servicos/contratoDosModulos'
import { formatarData } from '@/utilidades/formatos'
import { Chip } from '@/ui/Chip'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Esqueleto, LinhaDeEsqueleto } from '@/ui/Esqueleto'
import { ErroDaTela } from '@/ui/Falha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { Tela } from '@/ui/Tela'

import { usePode } from '../comunidade/permissoes'
import { VazioComSol } from '../comunidade/VazioComSol'
import { SemComunidade } from '../navegacao/SemComunidade'
import { NOME_DO_STATUS, TOM_DO_STATUS, useSugestoes } from './consultas'

type Filtro = StatusDaSugestao | 'todas'

const novaSugestao = () => router.push('/sugestoes/nova')

/**
 * Rota `/sugestoes` (3.7.2): título com "+", pílulas por situação para quem
 * modera e um cartão lista com o título, a data e o chip da situação (mais
 * "Anônima", quando é).
 */
export function TelaSugestoes() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const modera = pode('sugestao', 'moderar')
  return (
    <Tela
      pilha
      titulo="Sugestões"
      descricao={
        modera
          ? 'Ideias da comunidade. Mude a situação e responda para quem sugeriu saber o que aconteceu.'
          : 'Suas ideias para a comunidade e as respostas da organização.'
      }
      {...(comunidadeAtiva
        ? {
            acoes: (
              <Botao
                titulo="Sugerir uma ideia"
                icone="sugestao"
                variante="secundario"
                aoPressionar={novaSugestao}
              />
            ),
          }
        : {})}
    >
      {comunidadeAtiva ? (
        <ListaDeSugestoes comunidadeId={comunidadeAtiva.id} modera={modera} />
      ) : (
        <SemComunidade oQue="as sugestões" />
      )}
    </Tela>
  )
}

function ListaDeSugestoes({ comunidadeId, modera }: { comunidadeId: string; modera: boolean }) {
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const sugestoes = useSugestoes(comunidadeId, filtro === 'todas' ? null : filtro)

  return (
    <>
      {modera ? (
        <PilulasDeFiltro
          rotulo="Filtrar por situação"
          selecionadas={[filtro]}
          aoMudar={(v) => setFiltro(v[0] ?? 'todas')}
          pilulas={[
            { valor: 'todas', rotulo: 'Todas' },
            ...STATUS_DA_SUGESTAO.map((s) => ({ valor: s, rotulo: NOME_DO_STATUS[s] })),
          ]}
        />
      ) : null}
      {sugestoes.isPending ? (
        <Esqueleto rotulo="Carregando as sugestões">
          <LinhaDeEsqueleto altura={72} />
          <LinhaDeEsqueleto altura={72} />
          <LinhaDeEsqueleto altura={72} />
        </Esqueleto>
      ) : sugestoes.error ? (
        <ErroDaTela
          erro={sugestoes.error}
          oQue="as sugestões"
          aoTentarDeNovo={() => void sugestoes.refetch()}
        />
      ) : sugestoes.data.length === 0 ? (
        <VazioComSol
          titulo="Nenhuma sugestão por aqui."
          descricao={
            modera
              ? 'Quando alguém da comunidade sugerir algo, aparece aqui para você analisar.'
              : 'Tem uma ideia para os encontros? Mande para a organização; dá para enviar sem mostrar seu nome.'
          }
          acao={{ titulo: 'Sugerir uma ideia', icone: 'sugestao', aoPressionar: novaSugestao }}
        />
      ) : (
        <Cartao lista>
          <Lista>
            {sugestoes.data.map((s) => {
              const quem = s.minha
                ? 'Sua sugestão'
                : s.anonima
                  ? 'Anônima'
                  : (s.autorNome ?? 'Pessoa')
              const descricao = [quem, formatarData(s.criadoEm), s.resposta ? 'Respondida' : null]
                .filter(Boolean)
                .join(' · ')
              return (
                <LinhaDeLista
                  key={s.id}
                  icone="sugestao"
                  titulo={s.titulo}
                  descricao={descricao}
                  rotuloAcessivel={[
                    s.titulo,
                    descricao,
                    NOME_DO_STATUS[s.status],
                    s.anonima && s.minha ? 'Enviada sem nome' : null,
                  ]
                    .filter(Boolean)
                    .join('. ')}
                  extra={
                    <View style={{ alignItems: 'flex-end', gap: ESPACO.e4 }}>
                      <Chip texto={NOME_DO_STATUS[s.status]} tom={TOM_DO_STATUS[s.status]} />
                      {s.anonima && s.minha ? <Chip texto="Anônima" tom="neutro" /> : null}
                    </View>
                  }
                  aoPressionar={() =>
                    router.push({
                      pathname: '/sugestoes/[sugestaoId]',
                      params: { sugestaoId: s.id },
                    })
                  }
                />
              )
            })}
          </Lista>
        </Cartao>
      )}
    </>
  )
}
