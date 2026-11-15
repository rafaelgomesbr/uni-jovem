import { NOME_DO_PAPEL } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ComunidadeDoVinculo, Membro } from '@/servicos/contrato'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Linha } from '@/ui/Linha'
import { Secao } from '@/ui/Secao'

import { TelaDoApp } from '../navegacao/TelaDoApp'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useMembros } from './consultas'
import { MarcaDaComunidade } from './Identidade'
import { LinhaDoMembro } from './LinhaDoMembro'
import { CHIP_DO_ESTADO_DA_COMUNIDADE, CHIP_DO_PAPEL, NOME_DO_ESTADO_DA_COMUNIDADE } from './nomes'
import { usePode } from './permissoes'
import { useSairDaComunidade } from './sairDaComunidade'
import { SecaoConvites } from './SecaoConvites'
import { CartaoDeDestaque, Chip, Chips } from './visual'

/**
 * Aba Equipe (rota `/comunidade`): pessoas, convites e configurações da
 * comunidade ativa. Cada bloco só aparece para quem pode usá-lo (mesma
 * matriz da API, que decide de verdade).
 */
export function TelaComunidade() {
  const { comunidadeAtiva } = useSessao()
  if (!comunidadeAtiva) {
    return (
      <TelaDoApp titulo="Equipe">
        <SemComunidade />
      </TelaDoApp>
    )
  }
  return <Equipe comunidade={comunidadeAtiva} />
}

function Equipe({ comunidade }: { comunidade: ComunidadeDoVinculo }) {
  const pode = usePode()
  const { conta, comunidades } = useSessao()
  const ativa = comunidade.estado === 'ativa'
  const podeConvidar = pode('convite', 'criar')
  const sair = useSairDaComunidade(comunidade)

  return (
    <TelaDoApp
      titulo="Equipe"
      descricao="Quem participa da comunidade, com que papel, e os convites para chegar mais gente."
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12 }}>
        <MarcaDaComunidade cor={comunidade.cor} tamanho={40} />
        <Chips>
          <Chip
            texto={`Você: ${NOME_DO_PAPEL[comunidade.papel]}`}
            icone={CHIP_DO_PAPEL[comunidade.papel].icone}
            tom={CHIP_DO_PAPEL[comunidade.papel].tom}
          />
          <Chip
            texto={NOME_DO_ESTADO_DA_COMUNIDADE[comunidade.estado]}
            icone={CHIP_DO_ESTADO_DA_COMUNIDADE[comunidade.estado].icone}
            tom={CHIP_DO_ESTADO_DA_COMUNIDADE[comunidade.estado].tom}
          />
          {comunidade.designacoes.includes('equipe_oracao') ? (
            <Chip texto="Equipe de oração" icone="oracao" />
          ) : null}
        </Chips>
      </View>

      {!ativa ? (
        <Aviso tipo="alerta" titulo="Comunidade sem alterações por enquanto">
          {comunidade.estado === 'suspensa'
            ? 'Esta comunidade está suspensa: dá para consultar, mas não convidar nem mudar papéis.'
            : 'Esta comunidade não está ativa. Fale com o Criador da plataforma se precisar reativá-la.'}
        </Aviso>
      ) : null}

      {podeConvidar && ativa ? (
        <CartaoDeDestaque
          sobrancelha="Convites"
          titulo="Convidar pessoas"
          descricao="Gere um link de uso único com o papel certo e mande pelo WhatsApp, ou mostre o QR."
        >
          <Botao
            titulo="Convidar pessoas"
            icone="convidar"
            rotuloAcessivel={`Convidar pessoas para ${comunidade.nome}`}
            aoPressionar={() => router.push('/convidar')}
          />
        </CartaoDeDestaque>
      ) : null}

      <Membros comunidade={comunidade} podeAlterar={ativa} />

      {pode('convite', 'listar') ? (
        <SecaoConvites comunidade={comunidade} podeAlterar={ativa && podeConvidar} />
      ) : null}

      <Secao titulo="Comunidade">
        <Cartao>
          {pode('comunidade', 'configurar') && ativa ? (
            <Linha
              icone="ajustes"
              titulo="Configurações da comunidade"
              descricao="Nome, cor e fuso horário."
              aoPressionar={() => router.push('/configurar-comunidade')}
            />
          ) : null}
          {comunidades.length > 1 ? (
            <Linha
              icone="trocar"
              titulo="Trocar de comunidade"
              descricao={`Você participa de ${comunidades.length} comunidades.`}
              aoPressionar={() => router.push('/trocar-comunidade')}
            />
          ) : null}
          <Linha
            icone="link"
            titulo="Entrar em outra comunidade"
            descricao="Cole o link ou o código de um convite."
            aoPressionar={() => router.push('/entrar-com-convite')}
          />
          {conta?.criador ? (
            <Linha
              icone="plataforma"
              titulo="Plataforma do Criador"
              descricao="Criar e cuidar das comunidades."
              aoPressionar={() => router.push('/plataforma')}
            />
          ) : null}
        </Cartao>
      </Secao>

      {conta?.criador ? (
        <Botao
          titulo="Criar comunidade"
          icone="adicionar"
          variante="secundario"
          aoPressionar={() => router.push('/plataforma/nova')}
        />
      ) : null}

      <Secao titulo="Sair">
        <Cartao>
          {sair.erro ? <AvisoDeErro erro={sair.erro} /> : null}
          <Linha
            icone="sair"
            destrutivo
            titulo={`Sair de ${comunidade.nome}`}
            descricao="Apaga só o seu vínculo com esta comunidade. Sua conta continua existindo."
            aoPressionar={() => void sair.pedirParaSair()}
            semSeta
          />
          {sair.saindo ? <Carregando texto="Saindo da comunidade" /> : null}
        </Cartao>
      </Secao>
    </TelaDoApp>
  )
}

function Membros({
  comunidade,
  podeAlterar,
}: {
  comunidade: ComunidadeDoVinculo
  podeAlterar: boolean
}) {
  const pode = usePode()
  const { conta } = useSessao()
  const membros = useMembros(comunidade.id)
  const podeEditar =
    podeAlterar &&
    (pode('vinculo', 'alterar_papel') ||
      pode('vinculo', 'desativar') ||
      pode('vinculo', 'designar_equipe_oracao'))
  const verContato = pode('vinculo', 'ver_contato')

  const ativos = membros.data?.filter((m) => m.estado === 'ativo') ?? []
  const fora = membros.data?.filter((m) => m.estado !== 'ativo') ?? []

  function linha(membro: Membro) {
    const ehVoce = membro.contaId === conta?.id
    // Ninguém mexe no próprio vínculo nem no do Criador (a API recusa os dois).
    const editavel = podeEditar && !ehVoce && !membro.criador
    return (
      <LinhaDoMembro
        key={membro.vinculoId}
        membro={membro}
        ehVoce={ehVoce}
        mostrarContato={verContato}
        {...(editavel
          ? {
              aoPressionar: () =>
                router.push({
                  pathname: '/membro/[vinculoId]',
                  params: { vinculoId: membro.vinculoId },
                }),
            }
          : {})}
      />
    )
  }

  return (
    <>
      <Secao
        titulo={membros.data ? `Membros (${ativos.length})` : 'Membros'}
        {...(podeEditar && ativos.length > 1
          ? { rodape: 'Toque numa pessoa para mudar o papel, desativar ou remover.' }
          : {})}
      >
        <Cartao>
          {membros.isPending ? (
            <Carregando texto="Carregando as pessoas" />
          ) : membros.error ? (
            <AvisoDeErro erro={membros.error} aoTentarDeNovo={() => void membros.refetch()} />
          ) : ativos.length <= 1 && fora.length === 0 ? (
            <>
              {ativos.map(linha)}
              <EstadoVazio
                icone="convidar"
                titulo="Por enquanto, só você"
                descricao={
                  pode('convite', 'criar')
                    ? 'Convide as pessoas da liderança para começar.'
                    : 'Quando a administração convidar mais gente, as pessoas aparecem aqui.'
                }
                {...(pode('convite', 'criar') && podeAlterar
                  ? {
                      acao: {
                        titulo: 'Convidar pessoas',
                        icone: 'convidar' as const,
                        aoPressionar: () => router.push('/convidar'),
                      },
                    }
                  : {})}
              />
            </>
          ) : (
            <View>{ativos.map(linha)}</View>
          )}
        </Cartao>
      </Secao>
      {fora.length ? (
        <Secao
          titulo={`Desativados e removidos (${fora.length})`}
          rodape="Desativado pode ser reativado. Removido só volta com um convite novo."
        >
          <Cartao>
            <View>{fora.map(linha)}</View>
          </Cartao>
        </Secao>
      ) : null}
    </>
  )
}
