import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { Denuncia, EstadoDaDenuncia, RecursoDenunciavel } from '@/servicos/contratoDosModulos'
import { formatarDataEHora } from '@/utilidades/formatos'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Segmentos } from '@/ui/Segmentos'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'

import { usePode } from '../comunidade/permissoes'
import { naComunidade } from '../eventos/consultas'
import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
import { NOME_DO_MOTIVO } from './BotaoDenunciar'

const NOME_DO_RECURSO: Readonly<Record<RecursoDenunciavel, string>> = {
  pedido_oracao: 'Pedido de oração',
  sugestao: 'Sugestão',
  aviso: 'Aviso',
}

const NOME_DO_ESTADO: Readonly<Record<EstadoDaDenuncia, string>> = {
  aberta: 'Abertas',
  procedente: 'Procedentes',
  improcedente: 'Improcedentes',
}

/** Rota `/denuncias`: fila da administração (quem denunciou não aparece). */
export function TelaDenuncias() {
  const pode = usePode()
  return (
    <TelaDaComunidade
      oQue="as denúncias"
      titulo="Denúncias"
      descricao="Conteúdos que alguém da comunidade apontou como problema. Quem denunciou não aparece."
    >
      {(c) =>
        pode('denuncia', 'ler') ? (
          <Fila comunidadeId={c.id} />
        ) : (
          <Aviso tipo="alerta" titulo="Só a administração">
            A fila de denúncias fica com os administradores da comunidade.
          </Aviso>
        )
      }
    </TelaDaComunidade>
  )
}

function Fila({ comunidadeId }: { comunidadeId: string }) {
  const [estado, setEstado] = useState<EstadoDaDenuncia>('aberta')
  const lista = useQuery({
    queryKey: CHAVES.denuncias(comunidadeId, estado),
    queryFn: () =>
      api
        .get<{ denuncias: Denuncia[] }>(`${naComunidade(comunidadeId)}/denuncias?estado=${estado}`)
        .then((r) => r.denuncias),
  })
  return (
    <>
      <Segmentos
        rotulo="Situação"
        valor={estado}
        aoMudar={setEstado}
        segmentos={(Object.keys(NOME_DO_ESTADO) as EstadoDaDenuncia[]).map((v) => ({
          valor: v,
          rotulo: NOME_DO_ESTADO[v],
        }))}
      />
      {lista.isPending ? (
        <Carregando texto="Carregando as denúncias" />
      ) : lista.error ? (
        <AvisoDeErro erro={lista.error} aoTentarDeNovo={() => void lista.refetch()} />
      ) : lista.data.length === 0 ? (
        <Cartao>
          <EstadoVazio
            icone="denuncia"
            titulo={estado === 'aberta' ? 'Nenhuma denúncia aberta' : 'Nada por aqui'}
            descricao="Quando alguém denunciar um aviso, uma sugestão ou um pedido de oração público, aparece aqui."
            acao={{
              titulo: 'Ver os avisos',
              icone: 'aviso',
              aoPressionar: () => router.push('/avisos'),
            }}
          />
        </Cartao>
      ) : (
        lista.data.map((d) => <ItemDaFila key={d.id} comunidadeId={comunidadeId} denuncia={d} />)
      )}
    </>
  )
}

function ItemDaFila({ comunidadeId, denuncia: d }: { comunidadeId: string; denuncia: Denuncia }) {
  const consultas = useQueryClient()
  const [decisao, setDecisao] = useState<'procedente' | 'improcedente' | null>(null)
  const [resolucao, setResolucao] = useState('')
  const [retirar, setRetirar] = useState(false)
  const resolver = useMutation({
    mutationFn: () =>
      api.patch(`${naComunidade(comunidadeId)}/denuncias/${d.id}`, {
        estado: decisao,
        resolucao: resolucao.trim() || null,
        retirarConteudo: decisao === 'procedente' && retirar,
      }),
    onSuccess: () =>
      Promise.all([
        consultas.invalidateQueries({ queryKey: ['c', comunidadeId, 'denuncias'] }),
        consultas.invalidateQueries({ queryKey: CHAVES.avisos(comunidadeId) }),
        consultas.invalidateQueries({ queryKey: CHAVES.sugestoes(comunidadeId) }),
      ]),
  })
  const abrir =
    d.recursoTipo === 'aviso'
      ? () => router.push({ pathname: '/avisos/[avisoId]', params: { avisoId: d.recursoId } })
      : d.recursoTipo === 'sugestao'
        ? () =>
            router.push({
              pathname: '/sugestoes/[sugestaoId]',
              params: { sugestaoId: d.recursoId },
            })
        : null

  return (
    <Cartao>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
        <Selo texto={NOME_DO_RECURSO[d.recursoTipo]} />
        <Selo texto={NOME_DO_MOTIVO[d.motivo]} cor="alerta" />
        {d.conteudoRetirado ? <Selo texto="Conteúdo retirado" cor="erro" /> : null}
      </View>
      <Texto variante="legenda" cor="textoSuave">
        Recebida em {formatarDataEHora(d.criadoEm)}
      </Texto>
      {d.detalhe ? <Texto>{d.detalhe}</Texto> : null}
      {d.resolucao ? <Texto variante="corpo">Resolução: {d.resolucao}</Texto> : null}
      {abrir ? (
        <Botao titulo="Ver o conteúdo" icone="mostrar" variante="secundario" aoPressionar={abrir} />
      ) : (
        <Texto variante="legenda" cor="textoSuave">
          Pedidos de oração só abrem para quem pode lê-los. Se for da comunidade, ele está na tela
          Oração.
        </Texto>
      )}
      {d.estado === 'aberta' ? (
        <>
          <GrupoDeOpcoes
            rotulo="Decisão"
            valor={decisao}
            aoMudar={setDecisao}
            opcoes={[
              {
                valor: 'procedente',
                rotulo: 'Procedente',
                descricao: 'O conteúdo tem mesmo um problema.',
              },
              {
                valor: 'improcedente',
                rotulo: 'Improcedente',
                descricao: 'Está tudo certo com o conteúdo.',
              },
            ]}
          />
          {decisao === 'procedente' ? (
            <CaixaDeMarcar
              rotulo="Retirar o conteúdo"
              descricao="Some para todos. Quem escreveu não é avisado automaticamente."
              marcada={retirar}
              aoMudar={setRetirar}
            />
          ) : null}
          <Campo
            rotulo="Anotação (opcional)"
            value={resolucao}
            onChangeText={setResolucao}
            multiline
            maxLength={500}
          />
          {resolver.error ? <AvisoDeErro erro={resolver.error} /> : null}
          <Botao
            titulo="Registrar decisão"
            desabilitado={decisao === null}
            motivo="Escolha procedente ou improcedente."
            carregando={resolver.isPending}
            aoPressionar={() => resolver.mutate()}
          />
        </>
      ) : null}
    </Cartao>
  )
}
