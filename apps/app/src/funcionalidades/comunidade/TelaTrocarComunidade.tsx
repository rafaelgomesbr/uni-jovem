import { useQueryClient } from '@tanstack/react-query'
import { NOME_DO_PAPEL } from '@uj/dominio'
import { ALTURA, BORDA, ESPACO, RAIO, TAMANHO_DO_AVATAR } from '@uj/tokens'
import { router } from 'expo-router'
import { Fragment } from 'react'
import { Pressable, View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import type { ComunidadeDoVinculo } from '@/servicos/contrato'
import { Avatar } from '@/ui/Avatar'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha } from '@/ui/Falha'
import { Folha } from '@/ui/Folha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Radio } from '@/ui/ListaDeOpcoes'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { mostrarToast } from '@/ui/Toast'
import { voltarOu } from '@/ui/navegacao'

import { useEstaOnline } from '../offline/ProvedorOffline'
import { logoDaComunidade } from '../perfil/imagens'
import { CHIP_DO_ESTADO_DA_COMUNIDADE, NOME_DO_ESTADO_DA_COMUNIDADE } from './nomes'
import { useComunidadesEmExclusao, useDesfazerExclusao } from './consultas'
import { dataDoApagamento } from './dataDoApagamento'
import { useSairDaComunidade } from './sairDaComunidade'

/** Fecha a folha: volta para quem abriu ou, aberta por link, para o Início. */
function fechar() {
  voltarOu('/')
}

/**
 * Folha "Trocar de comunidade" (3.7.9): lista de opções com o avatar de 40
 * (logotipo ou iniciais na cor) no lugar do rádio, que fica à direita; o anel
 * do avatar e o rádio marcado mostram a atual. O toque troca, fecha a folha e
 * confirma com o toast "Agora em ...". Entrar em outra, criar e sair da atual também moram
 * aqui (D70): a linha "Comunidades" do Perfil abre esta folha.
 */
export function TelaTrocarComunidade() {
  const { comunidades, comunidadeAtiva, trocarComunidade, conta } = useSessao()
  const consultas = useQueryClient()
  const sair = useSairDaComunidade(comunidadeAtiva)

  async function escolher(c: ComunidadeDoVinculo) {
    const jaEra = c.id === comunidadeAtiva?.id
    await trocarComunidade(c.id)
    fechar()
    if (!jaEra) mostrarToast({ texto: `Agora em ${c.nome}` })
  }

  // Sem `flex: 1` na raiz: a folha nativa tem a altura do conteúdo (`opcoesDaFolha`). O fundo vem
  // do `contentStyle` da rota.
  return (
    <Folha titulo="Trocar de comunidade" aoFechar={fechar}>
      <Texto variante="corpo" cor="textoSuave">
        O que você vê e faz no app vale para a comunidade escolhida.
      </Texto>
      {comunidades.length === 0 ? (
        <EstadoVazio
          icone="comunidade"
          titulo="Nenhuma comunidade ainda"
          descricao="Quando você aceitar um convite, a comunidade aparece aqui."
          acao={{
            titulo: 'Verificar de novo',
            icone: 'sincronizar',
            aoPressionar: () => void consultas.invalidateQueries({ queryKey: CHAVES.eu }),
          }}
        />
      ) : (
        // Cartão com o padding de 18 dele: o texto das linhas fica na coluna do cartão (x=38).
        <CartaoDeVidro opaco intervalo={0} style={{ paddingVertical: ESPACO.e4 }}>
          <View accessibilityRole="radiogroup" aria-label="Suas comunidades">
            {comunidades.map((c, i) => (
              <Fragment key={c.id}>
                {i > 0 ? <Separador /> : null}
                <OpcaoDeComunidade
                  comunidade={c}
                  ativa={c.id === comunidadeAtiva?.id}
                  aoEscolher={() => void escolher(c)}
                />
              </Fragment>
            ))}
          </View>
        </CartaoDeVidro>
      )}
      <CartaoDeVidro lista opaco>
        <Lista>
          <LinhaDeLista
            icone="link"
            titulo="Entrar em outra comunidade"
            descricao="Código, convite ou busca pelo nome."
            aoPressionar={() => router.push('/comece-por-aqui')}
          />
          <LinhaDeLista
            icone="adicionar"
            titulo="Criar comunidade"
            descricao={
              conta?.criador
                ? 'Pela Plataforma, com o convite para quem vai administrar.'
                : 'Você vira o administrador.'
            }
            aoPressionar={() =>
              router.push(conta?.criador ? '/plataforma/nova' : '/criar-comunidade')
            }
          />
        </Lista>
      </CartaoDeVidro>
      {sair.erro ? <AvisoDeFalha erro={sair.erro} titulo="Você continua na comunidade" /> : null}
      <ComunidadesEmExclusao />
      {comunidadeAtiva ? (
        <CartaoDeVidro lista opaco>
          <LinhaDeLista
            icone="sair"
            titulo={`Sair de ${comunidadeAtiva.nome}`}
            {...(sair.saindo ? { descricao: 'Saindo da comunidade' } : {})}
            destrutivo
            dica="Apaga só o seu vínculo com esta comunidade. Sua conta continua existindo."
            {...(sair.saindo ? {} : { aoPressionar: () => void sair.pedirParaSair() })}
          />
        </CartaoDeVidro>
      ) : null}
    </Folha>
  )
}

/**
 * As comunidades que a pessoa (administradora) mandou excluir e que ainda estão nos 30 dias de
 * carência (D77): cada uma diz quando será apagada de vez e tem "Desfazer a exclusão". Sem
 * nenhuma, a seção nem aparece; erro de rede não atrapalha o resto da folha (só some a seção).
 */
function ComunidadesEmExclusao() {
  const lista = useComunidadesEmExclusao()
  const desfazer = useDesfazerExclusao()
  const online = useEstaOnline()
  const comunidades = lista.data ?? []
  if (comunidades.length === 0) return null
  return (
    <View style={{ gap: ESPACO.e8 }}>
      <Texto variante="sobrancelha">Em exclusão</Texto>
      <CartaoDeVidro opaco intervalo={ESPACO.e16}>
        {comunidades.map((c) => (
          <View key={c.id} style={{ gap: ESPACO.e8 }}>
            <Texto variante="tituloItem">{c.nome}</Texto>
            <Texto variante="corpo" cor="textoSuave">
              {`Será apagada de vez em ${dataDoApagamento(c.apagadaEm)}. Até lá, ninguém consegue usá-la.`}
            </Texto>
            <Botao
              titulo="Desfazer a exclusão"
              rotuloAcessivel={`Desfazer a exclusão de ${c.nome}`}
              variante="secundario"
              tamanho="medio"
              carregando={desfazer.isPending && desfazer.variables === c.id}
              desabilitado={!online || desfazer.isPending}
              {...(online ? {} : { motivo: 'Precisa de internet para desfazer.' })}
              aoPressionar={() =>
                desfazer.mutate(c.id, {
                  onSuccess: () => {
                    mostrarToast({ texto: `${c.nome} voltou ao normal.` })
                    void lista.refetch()
                  },
                })
              }
            />
          </View>
        ))}
        {desfazer.error ? (
          <AvisoDeFalha erro={desfazer.error} titulo="A exclusão não foi desfeita" />
        ) : null}
      </CartaoDeVidro>
    </View>
  )
}

/** Separador de 1 recuado até o texto (avatar de 40 + 12), como nas linhas de pessoa. */
function Separador() {
  const { cores } = useTema()
  return (
    <View
      style={{
        height: BORDA.fina,
        marginLeft: TAMANHO_DO_AVATAR.linha + ESPACO.e12,
        backgroundColor: cores.separador,
      }}
    />
  )
}

function OpcaoDeComunidade({
  comunidade,
  ativa,
  aoEscolher,
}: {
  comunidade: ComunidadeDoVinculo
  ativa: boolean
  aoEscolher: () => void
}) {
  const { cores } = useTema()
  const papel = NOME_DO_PAPEL[comunidade.papel]
  const estado = NOME_DO_ESTADO_DA_COMUNIDADE[comunidade.estado]
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={ativa}
      accessibilityLabel={`${comunidade.nome}. Seu papel: ${papel}.${
        comunidade.estado !== 'ativa' ? ` ${estado}.` : ''
      }${ativa ? ' Comunidade ativa agora.' : ''}`}
      onPress={aoEscolher}
      style={({ pressed }) => ({
        minHeight: ALTURA.linha,
        flexDirection: 'row',
        alignItems: 'center',
        gap: ESPACO.e12,
        paddingVertical: ESPACO.e8,
        // O pressionado sangra 12 para fora da coluna, como a linha de pessoa.
        marginHorizontal: -ESPACO.e12,
        paddingHorizontal: ESPACO.e12,
        borderRadius: RAIO.controle,
        backgroundColor: pressed ? cores.pressionado : 'transparent',
      })}
    >
      <Avatar
        nome={comunidade.nome}
        cor={comunidade.cor}
        foto={logoDaComunidade(comunidade)}
        tamanho="linha"
        {...(ativa ? { anel: 'ativo' as const } : {})}
        decorativo
      />
      <View style={{ flex: 1, gap: ESPACO.e4 }}>
        <Texto variante="tituloItem">{comunidade.nome}</Texto>
        <Texto variante="meta" cor="textoSuave">
          {ativa ? `${papel} · em uso agora` : papel}
        </Texto>
        {comunidade.estado !== 'ativa' ? (
          <Chip
            texto={estado}
            icone={CHIP_DO_ESTADO_DA_COMUNIDADE[comunidade.estado].icone}
            tom={CHIP_DO_ESTADO_DA_COMUNIDADE[comunidade.estado].tom}
          />
        ) : null}
      </View>
      <Radio marcado={ativa} />
    </Pressable>
  )
}
