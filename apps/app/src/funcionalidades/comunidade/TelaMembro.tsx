import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NOME_DO_PAPEL, PAPEIS, podeConcederPapel, type Papel } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ComunidadeDoVinculo, Membro } from '@/servicos/contrato'
import { ehErroDaApi } from '@/servicos/erros'
import { Avatar } from '@/ui/Avatar'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { Interruptor } from '@/ui/Interruptor'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { abrirLink, copiarTexto } from '@/utilidades/compartilhar'
import { confirmar } from '@/utilidades/confirmar'
import { formatarData } from '@/utilidades/formatos'
import { voltarOu } from '@/ui/navegacao'

import { SemComunidade } from '../navegacao/SemComunidade'
import { fotoDoMembro } from '../perfil/imagens'
import { useMembros } from './consultas'
import {
  CHIP_DO_ESTADO_DO_VINCULO,
  CHIP_DO_PAPEL,
  DESCRICAO_DO_PAPEL,
  NOME_DO_ESTADO_DO_VINCULO,
} from './nomes'
import { usePode } from './permissoes'

export function TelaMembro() {
  const { vinculoId } = useLocalSearchParams<{ vinculoId: string }>()
  const { comunidadeAtiva } = useSessao()
  const membros = useMembros(comunidadeAtiva?.id ?? null)
  const membro = membros.data?.find((m) => m.vinculoId === vinculoId)

  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo="Pessoa">
        <SemComunidade oQue="as pessoas" />
      </Tela>
    )
  }
  if (membros.isPending) {
    return (
      <Tela pilha titulo="Pessoa">
        <Esqueleto rotulo="Carregando a pessoa">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Tela>
    )
  }
  if (membros.error) {
    return (
      <Tela pilha titulo="Pessoa">
        <ErroDaTela erro={membros.error} aoTentarDeNovo={() => void membros.refetch()} />
      </Tela>
    )
  }
  if (!membro) {
    return (
      <Tela pilha titulo="Pessoa">
        <EstadoVazio
          icone="comunidade"
          titulo="Pessoa não encontrada"
          descricao="Ela pode ter saído da comunidade."
          acao={{ titulo: 'Voltar para a Equipe', aoPressionar: () => voltarOu('/comunidade') }}
        />
      </Tela>
    )
  }
  return <EditarMembro membro={membro} comunidade={comunidadeAtiva} />
}

interface Alteracao {
  corpo: { papel?: Papel; estado?: Membro['estado']; equipeDeOracao?: boolean }
  /** O que aparece (e é anunciado) quando dá certo. */
  feito: string
}

/**
 * Detalhe da pessoa (3.6.1): avatar de 72 com o papel em chip, "CONTATO"
 * com copiar e abrir o WhatsApp, "PAPEL" em lista de opções, o interruptor
 * "Equipe de oração", a situação com "Remover da comunidade" em vermelho e
 * "Salvar" (o papel) na barra.
 */
function EditarMembro({ membro, comunidade }: { membro: Membro; comunidade: ComunidadeDoVinculo }) {
  const pode = usePode()
  const { conta } = useSessao()
  const consultas = useQueryClient()
  const [papel, setPapel] = useState<Papel>(membro.papel)
  const nome = membro.nome
  const ehVoce = membro.contaId === conta?.id

  const alterar = useMutation({
    mutationFn: (a: Alteracao) =>
      api.patch(`/api/v1/c/${comunidade.id}/membros/${membro.vinculoId}`, a.corpo),
    onSuccess: async (_r, a) => {
      mostrarToast({ texto: a.feito })
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
    pode('vinculo', 'alterar_papel') &&
    !ehVoce &&
    podeConcederPapel(comunidade.papel, membro.papel) &&
    membro.estado === 'ativo'
  const verContato = pode('vinculo', 'ver_contato')
  const ultimoAdmin = ehErroDaApi(alterar.error, 'ultimo_admin')
  const oracao = membro.designacoes.includes('equipe_oracao')
  const whatsapp = membro.whatsapp?.replace(/\D/g, '') ?? ''

  function salvarPapel() {
    void pedir(
      { corpo: { papel }, feito: `${nome} agora é ${NOME_DO_PAPEL[papel]}.` },
      `Mudar o papel de ${nome}?`,
      `${nome} passa de ${NOME_DO_PAPEL[membro.papel]} para ${NOME_DO_PAPEL[papel]} em ${comunidade.nome}.`,
      `Tornar ${NOME_DO_PAPEL[papel]}`,
      false,
    )
  }

  return (
    <Tela
      pilha
      titulo={nome}
      descricao={`Na comunidade desde ${formatarData(membro.desde)}`}
      {...(podeMudarPapel
        ? {
            barraDeAcao: (
              <BarraDeAcao>
                <Botao
                  titulo="Salvar"
                  rotuloAcessivel="Salvar papel"
                  tamanho="grande"
                  desabilitado={papel === membro.papel}
                  motivo="Escolha um papel diferente do atual."
                  carregando={alterar.isPending && alterar.variables?.corpo.papel !== undefined}
                  aoPressionar={salvarPapel}
                />
              </BarraDeAcao>
            ),
          }
        : {})}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e16 }}>
        <Avatar
          nome={nome}
          avatar={membro.avatar ?? null}
          foto={fotoDoMembro(comunidade.id, membro)}
          tamanho="perfil"
          decorativo
        />
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
          <Chip texto={NOME_DO_PAPEL[membro.papel]} tom={CHIP_DO_PAPEL[membro.papel].tom} />
          {membro.estado !== 'ativo' ? (
            <Chip
              texto={NOME_DO_ESTADO_DO_VINCULO[membro.estado]}
              tom={CHIP_DO_ESTADO_DO_VINCULO[membro.estado].tom}
            />
          ) : null}
          {oracao ? <Chip texto="Oração" tom="quente" /> : null}
        </View>
      </View>

      {ultimoAdmin ? (
        <Aviso tipo="alerta" titulo="A comunidade precisa de um administrador" anunciar>
          {`${nome} é a única pessoa administradora ativa de ${comunidade.nome}. Antes de mudar o papel ou tirar essa pessoa, torne outra pessoa administradora.`}
        </Aviso>
      ) : alterar.error ? (
        <AvisoDeFalha erro={alterar.error} titulo="A mudança não foi salva" />
      ) : null}

      {verContato && (membro.email || membro.whatsapp) ? (
        <CartaoDeVidro sobrancelha="Contato" lista>
          <Lista>
            {membro.email ? (
              <LinhaDeLista
                icone="email"
                titulo={membro.email}
                extra={
                  <BotaoIcone
                    icone="copiar"
                    rotulo="Copiar o e-mail"
                    aoPressionar={async () => {
                      const ok = await copiarTexto(membro.email!)
                      mostrarToast(
                        ok
                          ? { texto: 'E-mail copiado.' }
                          : { texto: 'Não foi possível copiar.', tipo: 'erro' },
                      )
                    }}
                  />
                }
              />
            ) : null}
            {membro.whatsapp ? (
              <LinhaDeLista
                icone="aparelho"
                titulo={membro.whatsapp}
                descricao="WhatsApp"
                extra={
                  <BotaoIcone
                    icone="externo"
                    rotulo="Abrir o WhatsApp"
                    aoPressionar={() => void abrirLink(`https://wa.me/${whatsapp}`)}
                  />
                }
              />
            ) : null}
          </Lista>
        </CartaoDeVidro>
      ) : null}

      {podeMudarPapel ? (
        <ListaDeOpcoes
          rotulo="Papel"
          valor={papel}
          aoMudar={setPapel}
          opcoes={PAPEIS.map((p) => {
            const permitido = podeConcederPapel(comunidade.papel, p)
            return {
              valor: p,
              rotulo: NOME_DO_PAPEL[p],
              descricao: permitido
                ? DESCRICAO_DO_PAPEL[p]
                : 'Acima do seu papel: você só concede papéis até o seu nível.',
              desabilitada: !permitido,
            }
          })}
        />
      ) : null}

      {pode('vinculo', 'designar_equipe_oracao') && membro.estado === 'ativo' ? (
        <CartaoDeVidro opaco>
          <Interruptor
            rotulo="Equipe de oração"
            descricao={
              oracao
                ? 'Ligado: vê os pedidos enviados para a equipe'
                : "Desligado. Pedidos de 'Somente eu' nunca aparecem para a equipe"
            }
            ligado={oracao}
            desabilitado={alterar.isPending}
            aoMudar={(ligado) =>
              alterar.mutate({
                corpo: { equipeDeOracao: ligado },
                feito: ligado
                  ? `${nome} entrou na equipe de oração.`
                  : `${nome} saiu da equipe de oração.`,
              })
            }
          />
        </CartaoDeVidro>
      ) : null}

      {pode('vinculo', 'desativar') ? (
        <Secao
          titulo="Situação"
          rodape="A comunidade sempre precisa de pelo menos uma pessoa administradora ativa."
        >
          <CartaoDeVidro lista opaco>
            <Lista>
              {membro.estado === 'ativo' ? (
                <LinhaDeLista
                  icone="pausar"
                  titulo={`Desativar ${nome}`}
                  descricao="Tira o acesso; dá para reativar depois"
                  semSeta
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
              ) : (
                <LinhaDeLista
                  icone="repetir"
                  titulo={`Reativar ${nome}`}
                  descricao={
                    membro.estado === 'desativado'
                      ? 'Devolve o acesso com o mesmo papel'
                      : 'Se a reativação for recusada, mande um convite novo'
                  }
                  semSeta
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
              )}
              {pode('vinculo', 'remover') && membro.estado !== 'removido' ? (
                <LinhaDeLista
                  icone="excluir"
                  titulo="Remover da comunidade"
                  destrutivo
                  dica="Para voltar, a pessoa vai precisar de um convite novo."
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
            </Lista>
          </CartaoDeVidro>
        </Secao>
      ) : (
        <Texto variante="legenda" cor="textoSuave">
          A comunidade sempre precisa de pelo menos uma pessoa administradora ativa.
        </Texto>
      )}
    </Tela>
  )
}
