import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NOME_DO_PAPEL, PAPEIS, podeConcederPapel, type Papel } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ComunidadeDoVinculo, Membro } from '@/servicos/contrato'
import { ehErroDaApi } from '@/servicos/erros'
import { confirmar } from '@/utilidades/confirmar'
import { formatarData } from '@/utilidades/formatos'
import { Avatar } from '@/ui/Avatar'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'

import { SemComunidade } from '../navegacao/SemComunidade'
import { useMembros } from './consultas'
import {
  CHIP_DO_ESTADO_DO_VINCULO,
  DESCRICAO_DO_PAPEL,
  CHIP_DO_PAPEL,
  NOME_DO_ESTADO_DO_VINCULO,
} from './nomes'
import { usePode } from './permissoes'
import { CabecalhoDeTela, Chip, Chips, TelaPropria } from './visual'

export function TelaMembro() {
  const { vinculoId } = useLocalSearchParams<{ vinculoId: string }>()
  const { comunidadeAtiva } = useSessao()
  const membros = useMembros(comunidadeAtiva?.id ?? null)
  const membro = membros.data?.find((m) => m.vinculoId === vinculoId)

  if (!comunidadeAtiva) {
    return (
      <TelaPropria>
        <SemComunidade oQue="as pessoas" />
      </TelaPropria>
    )
  }
  if (membros.isPending) {
    return (
      <TelaPropria>
        <Carregando texto="Carregando a pessoa" />
      </TelaPropria>
    )
  }
  if (membros.error) {
    return (
      <TelaPropria>
        <AvisoDeErro erro={membros.error} aoTentarDeNovo={() => void membros.refetch()} />
      </TelaPropria>
    )
  }
  if (!membro) {
    return (
      <TelaPropria>
        <Cartao>
          <EstadoVazio
            icone="comunidade"
            titulo="Pessoa não encontrada"
            descricao="Ela pode ter saído da comunidade."
            acao={{ titulo: 'Voltar para a Equipe', aoPressionar: () => router.back() }}
          />
        </Cartao>
      </TelaPropria>
    )
  }
  return <EditarMembro membro={membro} comunidade={comunidadeAtiva} />
}

interface Alteracao {
  corpo: { papel?: Papel; estado?: Membro['estado']; equipeDeOracao?: boolean }
  /** O que aparece (e é anunciado) quando dá certo. */
  feito: string
}

function EditarMembro({ membro, comunidade }: { membro: Membro; comunidade: ComunidadeDoVinculo }) {
  const pode = usePode()
  const { conta } = useSessao()
  const consultas = useQueryClient()
  const [papel, setPapel] = useState<Papel>(membro.papel)
  const [feito, setFeito] = useState<string | null>(null)
  const nome = membro.nome
  const ehVoce = membro.contaId === conta?.id

  const alterar = useMutation({
    mutationFn: (a: Alteracao) =>
      api.patch(`/api/v1/c/${comunidade.id}/membros/${membro.vinculoId}`, a.corpo),
    onMutate: () => setFeito(null),
    onSuccess: async (_r, a) => {
      setFeito(a.feito)
      await consultas.invalidateQueries({ queryKey: CHAVES.membros(comunidade.id) })
    },
  })

  async function pedir(
    a: Alteracao,
    titulo: string,
    mensagem: string,
    rotulo: string,
    destrutivo: boolean,
  ) {
    const ok = await confirmar({ titulo, mensagem, confirmar: rotulo, destrutivo })
    if (ok) alterar.mutate(a)
  }

  // Só os papéis que eu posso conceder; se o papel atual dela está acima, nem mostro.
  const podeMudarPapel =
    pode('vinculo', 'alterar_papel') && !ehVoce && podeConcederPapel(comunidade.papel, membro.papel)
  const papeisPossiveis = PAPEIS.filter((p) => podeConcederPapel(comunidade.papel, p))
  const contato = pode('vinculo', 'ver_contato')
    ? [membro.email, membro.whatsapp].filter((c): c is string => Boolean(c))
    : []
  const ultimoAdmin = ehErroDaApi(alterar.error, 'ultimo_admin')

  return (
    <TelaPropria>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e16 }}>
        <Avatar nome={nome} avatar={membro.avatar ?? null} tamanho="perfil" decorativo />
        <View style={{ flex: 1 }}>
          <CabecalhoDeTela sobrancelha={comunidade.nome} titulo={nome} />
        </View>
      </View>
      <Chips>
        <Chip
          texto={NOME_DO_PAPEL[membro.papel]}
          icone={CHIP_DO_PAPEL[membro.papel].icone}
          tom={CHIP_DO_PAPEL[membro.papel].tom}
        />
        <Chip
          texto={NOME_DO_ESTADO_DO_VINCULO[membro.estado]}
          icone={CHIP_DO_ESTADO_DO_VINCULO[membro.estado].icone}
          tom={CHIP_DO_ESTADO_DO_VINCULO[membro.estado].tom}
        />
        {membro.designacoes.includes('equipe_oracao') ? (
          <Chip texto="Equipe de oração" icone="oracao" />
        ) : null}
      </Chips>
      <Texto variante="legenda" cor="textoSuave">
        Na comunidade desde {formatarData(membro.desde)}.
        {contato.length ? ` Contato: ${contato.join(' · ')}` : ''}
      </Texto>

      {feito ? (
        <Aviso tipo="sucesso" anunciar>
          {feito}
        </Aviso>
      ) : null}
      {ultimoAdmin ? (
        <Aviso tipo="alerta" titulo="A comunidade precisa de um administrador" anunciar>
          {`${nome} é a única pessoa administradora ativa de ${comunidade.nome}. Antes de mudar o papel ou tirar essa pessoa, torne outra pessoa administradora.`}
        </Aviso>
      ) : alterar.error ? (
        <AvisoDeErro erro={alterar.error} />
      ) : null}

      {podeMudarPapel && membro.estado === 'ativo' ? (
        <Cartao titulo="Papel" icone="chave" descricao="Você só concede papéis até o seu nível.">
          <GrupoDeOpcoes
            rotulo={`Papel de ${nome}`}
            valor={papel}
            aoMudar={setPapel}
            opcoes={papeisPossiveis.map((p) => ({
              valor: p,
              rotulo: NOME_DO_PAPEL[p],
              descricao: DESCRICAO_DO_PAPEL[p],
            }))}
          />
          <Botao
            titulo="Salvar papel"
            desabilitado={papel === membro.papel}
            motivo="Escolha um papel diferente do atual."
            carregando={alterar.isPending && alterar.variables?.corpo.papel !== undefined}
            aoPressionar={() =>
              void pedir(
                { corpo: { papel }, feito: `${nome} agora é ${NOME_DO_PAPEL[papel]}.` },
                `Mudar o papel de ${nome}?`,
                `${nome} passa de ${NOME_DO_PAPEL[membro.papel]} para ${NOME_DO_PAPEL[papel]} em ${comunidade.nome}.`,
                `Tornar ${NOME_DO_PAPEL[papel]}`,
                false,
              )
            }
          />
        </Cartao>
      ) : null}

      {pode('vinculo', 'designar_equipe_oracao') && membro.estado === 'ativo' ? (
        <Cartao titulo="Equipe de oração" icone="oracao">
          <CaixaDeMarcar
            rotulo="Faz parte da equipe de oração"
            descricao="Vê os pedidos enviados para a equipe. Pedidos de 'Somente eu' continuam só da pessoa."
            marcada={membro.designacoes.includes('equipe_oracao')}
            aoMudar={(marcada) =>
              alterar.mutate({
                corpo: { equipeDeOracao: marcada },
                feito: marcada
                  ? `${nome} entrou na equipe de oração.`
                  : `${nome} saiu da equipe de oração.`,
              })
            }
          />
        </Cartao>
      ) : null}

      {pode('vinculo', 'desativar') ? (
        <Cartao titulo="Situação" icone="pessoa">
          {membro.estado === 'ativo' ? (
            <>
              <Texto variante="legenda" cor="textoSuave">
                Desativar tira o acesso, mas dá para reativar depois.
              </Texto>
              <Botao
                titulo={`Desativar ${nome}`}
                icone="pausar"
                variante="secundario"
                carregando={alterar.isPending && alterar.variables?.corpo.estado === 'desativado'}
                aoPressionar={() =>
                  void pedir(
                    { corpo: { estado: 'desativado' }, feito: `${nome} foi desativado.` },
                    `Desativar ${nome}?`,
                    `${nome} perde o acesso a ${comunidade.nome} até ser reativado.`,
                    'Desativar',
                    true,
                  )
                }
              />
            </>
          ) : (
            <>
              <Texto variante="legenda" cor="textoSuave">
                {membro.estado === 'desativado'
                  ? 'Reativar devolve o acesso com o mesmo papel.'
                  : 'Pessoa removida. Se a reativação for recusada, mande um convite novo.'}
              </Texto>
              <Botao
                titulo={`Reativar ${nome}`}
                icone="repetir"
                carregando={alterar.isPending && alterar.variables?.corpo.estado === 'ativo'}
                aoPressionar={() =>
                  void pedir(
                    { corpo: { estado: 'ativo' }, feito: `${nome} foi reativado.` },
                    `Reativar ${nome}?`,
                    `${nome} volta a ter acesso a ${comunidade.nome} como ${NOME_DO_PAPEL[membro.papel]}.`,
                    'Reativar',
                    false,
                  )
                }
              />
            </>
          )}
          {pode('vinculo', 'remover') && membro.estado !== 'removido' ? (
            <Botao
              titulo={`Remover ${nome} da comunidade`}
              icone="excluir"
              variante="destrutivo"
              carregando={alterar.isPending && alterar.variables?.corpo.estado === 'removido'}
              aoPressionar={() =>
                void pedir(
                  { corpo: { estado: 'removido' }, feito: `${nome} foi removido.` },
                  `Remover ${nome} de ${comunidade.nome}?`,
                  'A pessoa perde o acesso. Para voltar, vai precisar de um convite novo.',
                  'Remover',
                  true,
                )
              }
            />
          ) : null}
        </Cartao>
      ) : null}

      {feito ? (
        <TextoAnunciado variante="legenda" cor="textoSuave">
          As mudanças já valem para {nome}.
        </TextoAnunciado>
      ) : null}
      <Texto variante="legenda" cor="textoSuave">
        A comunidade sempre precisa de pelo menos uma pessoa administradora ativa.
      </Texto>
    </TelaPropria>
  )
}
