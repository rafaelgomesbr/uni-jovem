import { CATEGORIAS_SUGERIDAS } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import type { Local } from '@/servicos/contratoDosEventos'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Segmentos } from '@/ui/Segmentos'
import { Texto } from '@/ui/Texto'

import { useLocais } from './consultas'
import { LOCAL_NOVO, type ErrosDoRascunho, type RascunhoDoEvento } from './formulario'
import { DESCRICAO_DA_VISIBILIDADE, NOME_DA_VISIBILIDADE } from './nomes'

export interface CamposVisiveis {
  data: boolean
  /** Visibilidade, vagas e informações úteis. */
  inscricoes: boolean
  /** Lista de espera e prazo de inscrição (só existem por ocorrência, não na série). */
  prazoEEspera: boolean
}

interface Props {
  comunidadeId: string
  rascunho: RascunhoDoEvento
  mudar: <K extends keyof RascunhoDoEvento>(campo: K, valor: RascunhoDoEvento[K]) => void
  erros: ErrosDoRascunho
  visiveis?: CamposVisiveis
  ajudaDaDuracao?: string
}

function descreverLocal(l: Local): string {
  return l.tipo === 'interno' ? 'Local interno' : (l.endereco ?? 'Local externo')
}

/** Campos comuns de criar e editar evento. Rótulo sempre visível; erro com ícone e texto. */
export function CamposDoEvento({
  comunidadeId,
  rascunho: r,
  mudar,
  erros,
  visiveis = { data: true, inscricoes: true, prazoEEspera: true },
  ajudaDaDuracao,
}: Props) {
  const locais = useLocais(comunidadeId)
  const sugestoes = CATEGORIAS_SUGERIDAS.filter((c) => c !== r.categoria).slice(0, 6)

  return (
    <>
      <Cartao titulo="O que é">
        <Campo
          rotulo="Título"
          value={r.titulo}
          onChangeText={(v) => mudar('titulo', v)}
          erro={erros.titulo ?? null}
          exemplo="Sábado com a juventude"
          maxLength={120}
        />
        <Campo
          rotulo="Categoria"
          value={r.categoria}
          onChangeText={(v) => mudar('categoria', v)}
          erro={erros.categoria ?? null}
          ajuda="Escolha uma sugestão abaixo ou escreva outra."
          maxLength={60}
        />
        <View
          accessibilityLabel="Sugestões de categoria"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}
        >
          {sugestoes.map((c) => (
            <Botao
              key={c}
              titulo={c}
              variante="secundario"
              larguraTotal={false}
              rotuloAcessivel={`Usar a categoria ${c}`}
              aoPressionar={() => mudar('categoria', c)}
            />
          ))}
        </View>
        <Campo
          rotulo="Descrição (opcional)"
          value={r.descricao}
          onChangeText={(v) => mudar('descricao', v)}
          multiline
          maxLength={5000}
        />
      </Cartao>

      <Cartao titulo="Quando" icone="relogio">
        {visiveis.data ? (
          <Campo
            rotulo="Data"
            value={r.data}
            onChangeText={(v) => mudar('data', v)}
            erro={erros.data ?? null}
            ajuda="Formato DD/MM/AAAA."
            exemplo="15/11/2026"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        ) : (
          <Texto variante="apoio" cor="textoSuave">
            O dia de cada ocorrência vem da regra da série. Para mudar o dia da semana, use a tela
            da série.
          </Texto>
        )}
        <Campo
          rotulo="Hora de início"
          value={r.hora}
          onChangeText={(v) => mudar('hora', v)}
          erro={erros.hora ?? null}
          ajuda="Formato HH:MM, no horário da comunidade."
          exemplo="16:00"
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
        <Campo
          rotulo="Duração em minutos"
          value={r.duracao}
          onChangeText={(v) => mudar('duracao', v)}
          erro={erros.duracao ?? null}
          {...(ajudaDaDuracao ? { ajuda: ajudaDaDuracao } : {})}
          keyboardType="number-pad"
          maxLength={4}
        />
      </Cartao>

      <Cartao titulo="Onde" icone="local">
        {locais.isPending ? (
          <Carregando texto="Carregando os locais" />
        ) : locais.error ? (
          <AvisoDeErro erro={locais.error} aoTentarDeNovo={() => void locais.refetch()} />
        ) : (
          <GrupoDeOpcoes
            rotulo="Local"
            valor={r.local ?? ''}
            aoMudar={(v) => mudar('local', v === '' ? null : v)}
            opcoes={[
              { valor: '', rotulo: 'A definir' },
              ...locais.data
                .filter((l) => !l.arquivado || l.id === r.local)
                .map((l) => ({ valor: l.id, rotulo: l.nome, descricao: descreverLocal(l) })),
              {
                valor: LOCAL_NOVO,
                rotulo: 'Cadastrar outro local',
                descricao: 'Fica salvo para os próximos eventos.',
              },
            ]}
          />
        )}
        {r.local === LOCAL_NOVO ? (
          <View style={{ gap: ESPACO.x3 }}>
            <Campo
              rotulo="Nome do local"
              value={r.novoLocal.nome}
              onChangeText={(v) => mudar('novoLocal', { ...r.novoLocal, nome: v })}
              erro={erros.novoLocal ?? null}
              exemplo="Salão da igreja"
              maxLength={120}
            />
            <Segmentos
              rotulo="Tipo de local"
              valor={r.novoLocal.tipo}
              aoMudar={(v) => mudar('novoLocal', { ...r.novoLocal, tipo: v })}
              segmentos={[
                { valor: 'interno', rotulo: 'Interno (da igreja)' },
                { valor: 'externo', rotulo: 'Externo (outro endereço)' },
              ]}
            />
            <Campo
              rotulo={r.novoLocal.tipo === 'externo' ? 'Endereço' : 'Endereço (opcional)'}
              value={r.novoLocal.endereco}
              onChangeText={(v) => mudar('novoLocal', { ...r.novoLocal, endereco: v })}
              ajuda="O botão Abrir no app de mapas usa este endereço."
              maxLength={300}
            />
            <Campo
              rotulo="Ponto de referência (opcional)"
              value={r.novoLocal.referencia}
              onChangeText={(v) => mudar('novoLocal', { ...r.novoLocal, referencia: v })}
              maxLength={300}
            />
          </View>
        ) : null}
      </Cartao>

      {visiveis.inscricoes ? (
        <Cartao titulo="Quem vê e inscrições" icone="inscricoes">
          <GrupoDeOpcoes
            rotulo="Visibilidade"
            valor={r.visibilidade}
            aoMudar={(v) => mudar('visibilidade', v)}
            opcoes={(['interna', 'publica'] as const).map((v) => ({
              valor: v,
              rotulo: NOME_DA_VISIBILIDADE[v],
              descricao: DESCRICAO_DA_VISIBILIDADE[v],
            }))}
          />
          <Campo
            rotulo="Vagas (opcional)"
            value={r.capacidade}
            onChangeText={(v) => mudar('capacidade', v)}
            erro={erros.capacidade ?? null}
            ajuda="Em branco, sem limite de vagas."
            keyboardType="number-pad"
            maxLength={6}
          />
          {visiveis.prazoEEspera ? (
            <>
              <CaixaDeMarcar
                rotulo="Lista de espera"
                descricao={
                  r.capacidade.trim()
                    ? 'Quando as vagas acabam, novas inscrições entram na fila e sobem sozinhas se alguém cancelar.'
                    : 'Só vale com número de vagas.'
                }
                marcada={r.listaDeEspera && !!r.capacidade.trim()}
                desabilitada={!r.capacidade.trim()}
                aoMudar={(v) => mudar('listaDeEspera', v)}
              />
              <Campo
                rotulo="Inscrições até o dia (opcional)"
                value={r.inscricaoData}
                onChangeText={(v) => mudar('inscricaoData', v)}
                erro={erros.inscricaoData ?? null}
                ajuda="Em branco, as inscrições ficam abertas até o início."
                exemplo="14/11/2026"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
              <Campo
                rotulo="Inscrições até a hora (opcional)"
                value={r.inscricaoHora}
                onChangeText={(v) => mudar('inscricaoHora', v)}
                erro={erros.inscricaoHora ?? null}
                ajuda="Em branco, vale até 23:59 do dia escolhido."
                exemplo="23:59"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </>
          ) : null}
          <Campo
            rotulo="Informações úteis (opcional)"
            value={r.informacoesUteis}
            onChangeText={(v) => mudar('informacoesUteis', v)}
            ajuda="O que levar, roupa, estacionamento. Aparece também na página pública."
            multiline
            maxLength={5000}
          />
        </Cartao>
      ) : null}
    </>
  )
}
