import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { Local, TipoDeLocal } from '@/servicos/contratoDosEventos'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { MenuDeAcoes } from '@/ui/FolhaNaTela'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Segmentos } from '@/ui/Segmentos'
import { Tela } from '@/ui/Tela'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import { parametro } from '@/utilidades/parametros'
import { voltarOu } from '@/ui/navegacao'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { naComunidade, useInvalidarEventos, useLocais } from './consultas'

/** Parâmetro da rota `/locais/[localId]` para cadastrar um local. */
const LOCAL_NOVO = 'novo'

function descrever(l: Local): string {
  return [l.tipo === 'interno' ? 'Local interno' : (l.endereco ?? 'Local externo'), l.referencia]
    .filter(Boolean)
    .join(' · ')
}

const SO_A_ORGANIZACAO = (
  <Aviso tipo="info" titulo="Só a organização cuida dos locais">
    Organizadores e administradores cadastram e arquivam os locais.
  </Aviso>
)

/** Rota `/locais` (3.4.6): cartão lista com o "+" no cabeçalho. */
export function TelaLocais() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const podeCuidar = pode('evento', 'editar')
  return (
    <Tela
      pilha
      titulo="Locais"
      descricao="Onde os encontros acontecem. Arquivar tira o local da escolha sem mexer nos encontros antigos."
      {...(comunidadeAtiva && podeCuidar
        ? {
            acoes: (
              <BotaoIcone
                icone="adicionar"
                rotulo="Cadastrar local"
                circular
                aoPressionar={() =>
                  router.push({ pathname: '/locais/[localId]', params: { localId: LOCAL_NOVO } })
                }
              />
            ),
          }
        : {})}
    >
      {!comunidadeAtiva ? (
        <SemComunidade oQue="os locais" />
      ) : podeCuidar ? (
        <ListaDeLocais comunidadeId={comunidadeAtiva.id} />
      ) : (
        SO_A_ORGANIZACAO
      )}
    </Tela>
  )
}

function ListaDeLocais({ comunidadeId }: { comunidadeId: string }) {
  const locais = useLocais(comunidadeId)
  if (locais.isPending) {
    return (
      <Esqueleto rotulo="Carregando os locais">
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (locais.error) {
    return <ErroDaTela erro={locais.error} aoTentarDeNovo={() => void locais.refetch()} />
  }
  if (locais.data.length === 0) {
    return (
      <EstadoVazio
        icone="local"
        titulo="Nenhum local cadastrado"
        descricao="Cadastre o salão da igreja e os lugares que vocês usam: eles aparecem ao montar um encontro."
        acao={{
          titulo: 'Cadastrar local',
          icone: 'adicionar',
          aoPressionar: () =>
            router.push({ pathname: '/locais/[localId]', params: { localId: LOCAL_NOVO } }),
        }}
      />
    )
  }
  return (
    <CartaoDeVidro lista>
      <Lista>
        {locais.data.map((l) => (
          <LinhaDeLista
            key={l.id}
            icone="local"
            titulo={l.nome}
            descricao={descrever(l)}
            {...(l.arquivado ? { extra: <Chip texto="Arquivado" tom="neutro" /> } : {})}
            aoPressionar={() =>
              router.push({ pathname: '/locais/[localId]', params: { localId: l.id } })
            }
          />
        ))}
      </Lista>
    </CartaoDeVidro>
  )
}

/** Rota `/locais/[localId]`: editar nome, endereço e referência; arquivar fica em "Mais ações". */
export function TelaLocal() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const localId = parametro(useLocalSearchParams<{ localId: string }>().localId)
  if (!comunidadeAtiva || !localId) {
    return (
      <Tela pilha titulo="Local">
        <SemComunidade oQue="o local" />
      </Tela>
    )
  }
  if (!pode('evento', 'editar')) {
    return (
      <Tela pilha titulo="Local">
        {SO_A_ORGANIZACAO}
      </Tela>
    )
  }
  if (localId === LOCAL_NOVO) return <Formulario comunidadeId={comunidadeAtiva.id} local={null} />
  return <EditarLocal comunidadeId={comunidadeAtiva.id} localId={localId} />
}

function EditarLocal({ comunidadeId, localId }: { comunidadeId: string; localId: string }) {
  const locais = useLocais(comunidadeId)
  const local = locais.data?.find((l) => l.id === localId)
  if (locais.isPending) {
    return (
      <Tela pilha titulo="Local">
        <Esqueleto rotulo="Carregando o local">
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Tela>
    )
  }
  if (locais.error) {
    return (
      <Tela pilha titulo="Local">
        <ErroDaTela erro={locais.error} aoTentarDeNovo={() => void locais.refetch()} />
      </Tela>
    )
  }
  if (!local) {
    return (
      <Tela pilha titulo="Local">
        <EstadoVazio
          icone="local"
          titulo="Local não encontrado"
          descricao="Ele pode ter sido removido por outra pessoa."
          acao={{ titulo: 'Ver os locais', aoPressionar: () => router.replace('/locais') }}
        />
      </Tela>
    )
  }
  return (
    <Formulario
      key={`${local.id}-${local.versao ?? 0}`}
      comunidadeId={comunidadeId}
      local={local}
    />
  )
}

/** Formulário de pilha com barra de ação (3.4.6); `local` nulo cadastra um novo. */
function Formulario({ comunidadeId, local }: { comunidadeId: string; local: Local | null }) {
  const consultas = useQueryClient()
  const invalidarEventos = useInvalidarEventos(comunidadeId)
  const [nome, setNome] = useState(local?.nome ?? '')
  const [tipo, setTipo] = useState<TipoDeLocal>(local?.tipo ?? 'interno')
  const [endereco, setEndereco] = useState(local?.endereco ?? '')
  const [referencia, setReferencia] = useState(local?.referencia ?? '')
  const [erros, setErros] = useState<{ nome?: string; endereco?: string }>({})
  const [menu, setMenu] = useState(false)
  const base = `${naComunidade(comunidadeId)}/locais`

  const atualizar = () =>
    Promise.all([
      consultas.invalidateQueries({ queryKey: CHAVES.locais(comunidadeId) }),
      invalidarEventos(),
    ])
  const salvar = useMutation({
    mutationFn: (corpo: Record<string, unknown>) =>
      local ? api.patch(`${base}/${local.id}`, corpo) : api.post(base, corpo),
    onSuccess: async (_r, corpo) => {
      await atualizar()
      if ('arquivado' in corpo) {
        mostrarToast({ texto: corpo.arquivado ? 'Local arquivado.' : 'Local de volta à escolha.' })
        return
      }
      mostrarToast({ texto: local ? 'Local salvo.' : 'Local cadastrado.' })
      if (!local) voltarOu('/locais')
    },
  })

  function enviar() {
    const novos = {
      ...(nome.trim().length >= 2 ? {} : { nome: 'Informe o nome do local.' }),
      ...((local?.tipo ?? tipo) === 'externo' && !endereco.trim()
        ? { endereco: 'Local externo precisa de endereço.' }
        : {}),
    }
    setErros(novos)
    if (Object.keys(novos).length) return
    salvar.mutate({
      nome: nome.trim(),
      ...(local ? {} : { tipo }),
      endereco: endereco.trim() || null,
      referencia: referencia.trim() || null,
    })
  }

  async function alternarArquivo() {
    if (!local) return
    if (!local.arquivado) {
      const ok = await confirmar({
        titulo: `Arquivar ${local.nome}?`,
        mensagem:
          'Ele deixa de aparecer na escolha de local de novos encontros. Os que já usam continuam iguais.',
        confirmar: 'Arquivar',
      })
      if (!ok) return
    }
    salvar.mutate({ arquivado: !local.arquivado })
  }

  const tipoAtual = local?.tipo ?? tipo
  return (
    <Tela
      pilha
      titulo={local ? local.nome : 'Cadastrar local'}
      {...(local
        ? {
            descricao: local.tipo === 'interno' ? 'Local interno' : 'Local externo',
            acoes: (
              <BotaoIcone
                icone="maisAcoes"
                rotulo="Mais ações"
                circular
                aoPressionar={() => setMenu(true)}
              />
            ),
          }
        : {})}
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo={local ? 'Salvar' : 'Cadastrar local'}
            tamanho="grande"
            carregando={salvar.isPending}
            aoPressionar={enviar}
          />
        </BarraDeAcao>
      }
    >
      {local?.arquivado ? (
        <Aviso tipo="info" titulo="Local arquivado">
          Ele não aparece na escolha de novos encontros. Para voltar, use Mais ações.
        </Aviso>
      ) : null}
      {salvar.error ? <AvisoDeFalha erro={salvar.error} titulo="O local não foi salvo" /> : null}
      <CartaoDeVidro opaco intervalo={ESPACO.e16}>
        <Campo
          rotulo="Nome"
          value={nome}
          onChangeText={setNome}
          erro={erros.nome ?? null}
          exemplo="Salão da igreja"
          maxLength={120}
        />
        {local ? null : (
          <Segmentos
            rotulo="Tipo de local"
            valor={tipo}
            aoMudar={setTipo}
            segmentos={[
              { valor: 'interno', rotulo: 'Interno' },
              { valor: 'externo', rotulo: 'Externo' },
            ]}
          />
        )}
        <Campo
          rotulo="Endereço"
          opcional={tipoAtual === 'interno'}
          value={endereco}
          onChangeText={setEndereco}
          erro={erros.endereco ?? null}
          ajuda="O Abrir no mapa usa este endereço."
          maxLength={300}
        />
        <Campo
          rotulo="Referência"
          opcional
          ajuda="Por exemplo: salão do segundo andar, portão lateral."
          value={referencia}
          onChangeText={setReferencia}
          maxLength={300}
        />
      </CartaoDeVidro>
      {local ? (
        <MenuDeAcoes
          aberto={menu}
          titulo="Mais ações"
          aoFechar={() => setMenu(false)}
          acoes={[
            {
              titulo: local.arquivado ? 'Tirar do arquivo' : 'Arquivar local',
              icone: local.arquivado ? 'confirmado' : 'material',
              descricao: local.arquivado
                ? 'Volta a aparecer na escolha de local'
                : 'Sai da escolha de local; os encontros antigos não mudam',
              aoPressionar: () => void alternarArquivo(),
            },
          ]}
        />
      ) : null}
    </Tela>
  )
}
