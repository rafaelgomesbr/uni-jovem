/**
 * Catálogo da fundação da direção A "Aurora Viva" (D65 e D67): o sol nas cinco poses, os
 * cartões, a linha de lista, os chips por situação, o esqueleto, o toast com Desfazer, o
 * deslizar para responder, a folha, a barra de abas flutuante, as primitivas de movimento e
 * os ícones. Nos dois temas (o segmento do topo do catálogo troca) e com o momento escolhido
 * movendo a luz de fundo da própria tela. Só desenvolvimento.
 */
import {
  MOMENTOS_EM_ORDEM,
  NOME_DA_POSE,
  POSES_DO_SOL_EM_ORDEM,
  BARRA_DE_ABAS,
  ESPACO,
  RAIO,
  RITMO,
  type MomentoDoDia,
  type PoseDoSol,
} from '@uj/tokens'
import { useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { definirAbaAtiva, useAbaAtiva } from '@/ui/abaAtiva'
import { Avatar } from '@/ui/Avatar'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { CartaoDoMomento } from '@/ui/CartaoDoMomento'
import { Chip, SITUACOES_DO_CHIP, type SituacaoDoChip } from '@/ui/Chip'
import { DeslizarParaResponder } from '@/ui/DeslizarParaResponder'
import { BlocoDeEsqueleto, EsqueletoDoMomento, Esqueleto, LinhaDeEsqueleto } from '@/ui/Esqueleto'
import { AlcaDaFolha, FolhaNaTela } from '@/ui/FolhaNaTela'
import { Icone, type NomeDoIcone } from '@/ui/Icone'
import { ItemDaBarraDeAbas } from '@/ui/ItemDaBarraDeAbas'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { PilulaDaAba, RECUO_DA_BARRA } from '@/ui/PilulaDaAba'
import { EntradaEmCascata, TransicaoDeAba, usePressionar } from '@/ui/primitivasDeMovimento'
import { Secao } from '@/ui/Secao'
import { Segmentos } from '@/ui/Segmentos'
import { Sol } from '@/ui/Sol'
import { Texto } from '@/ui/Texto'
import { sombra, useTema } from '@/ui/tema'
import { mostrarDesfazer } from '@/ui/ToastComDesfazer'
import { Vidro } from '@/ui/Vidro'

const nada = () => {}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Secao titulo={titulo}>
      <View style={{ gap: RITMO.entreItens }}>{children}</View>
    </Secao>
  )
}

function Linha({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: ESPACO.e8 }}>
      {children}
    </View>
  )
}

const SITUACOES = Object.keys(SITUACOES_DO_CHIP) as SituacaoDoChip[]

const ROTULO_DO_MOMENTO: Record<MomentoDoDia, string> = {
  longe: 'Longe',
  vespera: 'Véspera',
  dia: 'No dia',
  agora: 'Agora',
  fim: 'Terminou',
}

/** As cinco poses lado a lado, com o nome de cada uma, e o sol que sobe ao tocar. */
function PosesDoSol() {
  const [pose, setPose] = useState<PoseDoSol>('escondido')
  return (
    <>
      <Grupo titulo="O sol nascendo: as cinco poses">
        <Linha>
          {POSES_DO_SOL_EM_ORDEM.map((p) => (
            <View key={p} style={{ alignItems: 'center', gap: ESPACO.e4, width: 104 }}>
              <Sol pose={p} lado={96} />
              <Texto variante="legenda" cor="textoSuave" centralizado>
                {NOME_DA_POSE[p]}
              </Texto>
            </View>
          ))}
        </Linha>
      </Grupo>
      <Grupo titulo="Sol: troca de pose (600 ms) e tamanhos">
        <Linha>
          <Sol pose={pose} lado={120} />
          <View style={{ gap: ESPACO.e8, flex: 1, minWidth: 160 }}>
            <Texto variante="corpo">Pose: {NOME_DA_POSE[pose]}</Texto>
            <Botao
              titulo="Subir o sol"
              variante="secundario"
              tamanho="medio"
              aoPressionar={() =>
                setPose((p) => POSES_DO_SOL_EM_ORDEM[(POSES_DO_SOL_EM_ORDEM.indexOf(p) + 1) % 5]!)
              }
            />
          </View>
        </Linha>
        <Linha>
          <Sol pose="pleno" lado={72} />
          <Sol pose="pleno" lado={32} halo={false} />
          <Sol pose="pleno" lado={30} halo={false} />
          <Sol pose="radiante" lado={48} alternativa="Sol radiante" />
          <Sol de="escondido" pose="pleno" lado={56} />
        </Linha>
      </Grupo>
    </>
  )
}

/** Cartão do momento em cada estado do UX, mais os outros cartões. */
function Cartoes({
  momento,
  aoMudarMomento,
}: {
  momento: MomentoDoDia
  aoMudarMomento: (m: MomentoDoDia) => void
}) {
  return (
    <>
      <Grupo titulo="Momento: o sol e a luz de fundo falam juntos">
        <Segmentos
          rotulo="Momento do encontro"
          valor={momento}
          aoMudar={aoMudarMomento}
          segmentos={MOMENTOS_EM_ORDEM.map((m) => ({ valor: m, rotulo: ROTULO_DO_MOMENTO[m] }))}
        />
        <CartaoDoMomento
          momento={momento}
          etiqueta={momento === 'agora' ? 'Acontecendo agora' : 'Próximo encontro'}
          aoVivo={momento === 'agora'}
          titulo="Sábado Jovem"
          meta="Sáb., 28 de nov. · 16:00 · Salão da igreja"
          acoes={
            <ParDeBotoes>
              <Botao titulo="Não posso ir" variante="secundario" aoPressionar={nada} />
              <Botao titulo="Aceitar" aoPressionar={nada} />
            </ParDeBotoes>
          }
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8, flexWrap: 'wrap' }}
          >
            <Texto variante="rotulo">Sua parte: Louvor · Vocal</Texto>
            <Chip situacao="aguardando" texto="Aguardando sua resposta" />
          </View>
        </CartaoDoMomento>
      </Grupo>
      <Grupo titulo="Cartão do momento: confirmado e sem sol (vazio)">
        <CartaoDoMomento
          pose="pleno"
          etiqueta="Próximo encontro"
          titulo="Sábado Jovem"
          meta="Hoje · 16:00"
          acoes={<Botao titulo="Ver o encontro" aoPressionar={nada} />}
        >
          <Linha>
            <Texto variante="rotulo">Sua parte: Recepção</Texto>
            <Chip situacao="aceitou" aparecer="confirmado" />
          </Linha>
        </CartaoDoMomento>
        <CartaoDoMomento
          semSol
          pose="escondido"
          titulo="Ainda não há encontro marcado."
          meta="Quando a liderança marcar o próximo, ele aparece aqui."
        />
      </Grupo>
      <Grupo titulo="Cartão: tinta, plano">
        <Cartao sobrancelha="Tinta violeta" titulo="Cartão de conteúdo">
          <Texto variante="corpo" cor="textoSuave">
            Sem desfoque, com o fio de luz no topo. No claro, branco com sombra.
          </Texto>
        </Cartao>
        <Cartao variante="plano">
          <Texto variante="tituloItem">Cartão plano</Texto>
          <Texto variante="corpo" cor="textoSuave">
            Opaco, sem sombra nem realce. Para folha e formulário.
          </Texto>
        </Cartao>
      </Grupo>
    </>
  )
}

function Linhas() {
  const [presentes, setPresentes] = useState<Record<string, boolean>>({ Bruno: true })
  const nomes = ['Ana Ribeiro', 'Bruno Tavares', 'Camila Nunes']
  return (
    <>
      <Grupo titulo="Linha de lista: 56 pt, ladrilho quente, estados">
        <Cartao lista>
          <Lista>
            <LinhaDeLista
              icone="agenda"
              titulo="Agenda"
              descricao="Próximos encontros"
              aoPressionar={nada}
            />
            <LinhaDeLista
              icone="coracao"
              titulo="Pedidos de oração"
              extra={<Chip situacao="novo" texto="3 novos" />}
              aoPressionar={nada}
            />
            <LinhaDeLista icone="sugestao" titulo="Marcada" marcada aoPressionar={nada} />
            <LinhaDeLista
              icone="convidar"
              titulo="Pedro Lima"
              descricao="Já convocado"
              desabilitada
              aoPressionar={nada}
            />
          </Lista>
        </Cartao>
      </Grupo>
      <Grupo titulo="Linha do check-in: 72 pt, avatar de 44, a linha inteira é o alvo">
        <Cartao lista>
          <Lista>
            {nomes.map((n) => {
              const chegou = presentes[n.split(' ')[0]!] ?? false
              return (
                <LinhaDeLista
                  key={n}
                  variante="checkin"
                  avatar={{ nome: n }}
                  titulo={n}
                  descricao={n.startsWith('Ana') ? 'Inscrita' : 'Convocada'}
                  rotuloAcessivel={`${n}. ${chegou ? 'Presente' : 'Ainda não chegou'}`}
                  marcada={chegou}
                  semSeta
                  extra={
                    chegou ? (
                      <Chip situacao="aceitou" texto="Presente" aparecer="presente" />
                    ) : (
                      <Chip texto="Chegou" tom="neutro" />
                    )
                  }
                  aoPressionar={() => setPresentes((p) => ({ ...p, [n.split(' ')[0]!]: !chegou }))}
                />
              )
            })}
          </Lista>
        </Cartao>
      </Grupo>
    </>
  )
}

function Chips() {
  return (
    <Grupo titulo="Chip: situações (sempre texto e ícone junto da cor)">
      <Linha>
        {SITUACOES.map((s) => (
          <Chip key={s} situacao={s} />
        ))}
      </Linha>
      <Linha>
        <Chip tom="quente" texto="Aberto ao público" />
        <Chip tom="neutro" texto="Última versão: hoje, 14:32" icone="relogio" />
        <Chip tom="erro" texto="Não deu" icone="avisoAlerta" />
      </Linha>
    </Grupo>
  )
}

function Esqueletos() {
  return (
    <Grupo titulo="Esqueleto: a forma final, depois de 300 ms">
      <EsqueletoDoMomento />
      <Cartao lista>
        <LinhaDeEsqueleto altura={72} />
        <LinhaDeEsqueleto altura={64} />
      </Cartao>
      <Esqueleto rotulo="Carregando a agenda">
        <BlocoDeEsqueleto altura={64} raio={RAIO.cartao} />
        <BlocoDeEsqueleto altura={64} raio={RAIO.cartao} />
      </Esqueleto>
    </Grupo>
  )
}

function Toasts() {
  const [log, setLog] = useState('Nada enviado ainda.')
  return (
    <Grupo titulo="Toast com Desfazer: 5 s, o envio só sai ao fim">
      <Texto variante="legenda" cor="textoSuave">
        {log}
      </Texto>
      <Linha>
        <Botao
          titulo="Publicar e avisar 11 pessoas"
          variante="secundario"
          tamanho="medio"
          aoPressionar={() => {
            setLog('Aguardando: nada foi enviado.')
            mostrarDesfazer({
              texto: 'Publicando e avisando 11 pessoas.',
              aoConfirmar: () => setLog('Enviado: as 11 pessoas foram avisadas.'),
              aoDesfazer: () => setLog('Desfeito: nada foi enviado.'),
            })
          }}
        />
        <Botao
          titulo="Falha de ação"
          variante="terciario"
          tamanho="medio"
          aoPressionar={() =>
            mostrarDesfazer({
              texto: 'Não deu para registrar sua resposta.',
              rotuloDoBotao: 'Tentar de novo',
              segundos: 6,
              aoConfirmar: nada,
              aoDesfazer: () => setLog('Tentando de novo...'),
            })
          }
        />
      </Linha>
    </Grupo>
  )
}

function Deslizar() {
  const [resposta, setResposta] = useState('Sem resposta ainda.')
  return (
    <Grupo titulo="Deslizar para responder (nunca o único caminho)">
      <Texto variante="legenda" cor="textoSuave">
        {resposta}
      </Texto>
      <DeslizarParaResponder
        titulo="Louvor, sábado 28"
        descricao="Sáb., 28 de nov. · 16:00"
        extra={<Chip situacao="aguardando" texto="Aguardando sua resposta" />}
        aoAceitar={() => setResposta('Aceitou o Louvor.')}
        aoRecusar={() => setResposta('Avisou que não pode ir.')}
      />
      <DeslizarParaResponder
        titulo="Recepção, sábado 5 de dez."
        descricao="Sáb., 5 de dez. · 16:00"
        desabilitado
        motivo="Precisa de internet para responder."
        aoAceitar={nada}
        aoRecusar={nada}
      />
    </Grupo>
  )
}

function Folhas() {
  const [aberta, setAberta] = useState(false)
  return (
    <Grupo titulo="Folha: alça, cantos de 28, vidro de 30">
      <View style={{ position: 'relative' }}>
        <Cartao>
          <AlcaDaFolha />
          <Texto variante="legenda" cor="textoSuave" centralizado>
            A alça, sozinha
          </Texto>
        </Cartao>
      </View>
      <Botao
        titulo="Abrir a folha"
        variante="secundario"
        tamanho="medio"
        aoPressionar={() => setAberta(true)}
      />
      <FolhaNaTela aberta={aberta} titulo="Trocar de comunidade" aoFechar={() => setAberta(false)}>
        <Lista>
          <LinhaDeLista
            avatar={{ nome: 'Jovens Esperança', cor: '#C2410C' }}
            titulo="Jovens Esperança"
            descricao="15 pessoas"
            marcada
            aoPressionar={nada}
          />
          <LinhaDeLista
            avatar={{ nome: 'Juventude Betel', cor: '#5B4BDB' }}
            titulo="Juventude Betel"
            descricao="9 pessoas"
            aoPressionar={nada}
          />
        </Lista>
      </FolhaNaTela>
    </Grupo>
  )
}

/** A cápsula da barra de abas, montada com as mesmas peças do app, e a aba que desliza. */
function BarraDeAbasDemo() {
  const { elevacao } = useTema()
  const ativa = useAbaAtiva()
  const abas = [
    { rotulo: 'Início', icone: 'sol' as const },
    { rotulo: 'Agenda', icone: 'agenda' as const },
    { rotulo: 'Comunidade', icone: 'pessoas' as const },
    { rotulo: 'Perfil', icone: 'perfil' as const },
  ]
  return (
    <Grupo titulo="Barra de abas flutuante: cápsula de 68, pílula que desliza">
      <View style={{ height: BARRA_DE_ABAS.altura, flexDirection: 'row', padding: RECUO_DA_BARRA }}>
        <Vidro
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              borderRadius: RAIO.barraFlutuante,
            },
            sombra(elevacao.flutuante),
          ]}
        />
        <PilulaDaAba quantidade={abas.length} />
        {abas.map((a, i) => (
          <ItemDaBarraDeAbas
            key={a.rotulo}
            rotulo={a.rotulo}
            icone={a.icone}
            ativo={ativa === i}
            onPress={() => definirAbaAtiva(i)}
          />
        ))}
      </View>
    </Grupo>
  )
}

function Cascata() {
  const [rodada, setRodada] = useState(0)
  const [aba, setAba] = useState(true)
  const toque = usePressionar()
  return (
    <Grupo titulo="Movimento: cascata, pressionar e troca de aba">
      <Botao
        titulo="Repetir a cascata"
        variante="secundario"
        tamanho="medio"
        aoPressionar={() => setRodada((r) => r + 1)}
      />
      <View key={rodada} style={{ gap: ESPACO.e8 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <EntradaEmCascata key={i} ordem={i}>
            <Cartao variante="plano" style={{ padding: ESPACO.e12 }}>
              <Texto variante="rotulo">Bloco {i + 1}</Texto>
            </Cartao>
          </EntradaEmCascata>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pressionar"
        {...toque.propsDoPressable}
        onPress={nada}
      >
        <Animated.View
          style={[
            toque.estilo,
            {
              minHeight: 48,
              borderRadius: RAIO.pilula,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Texto variante="botao">Segure para ver o 0,98</Texto>
        </Animated.View>
      </Pressable>
      <Botao
        titulo="Trocar de aba (dissolve)"
        variante="terciario"
        tamanho="medio"
        aoPressionar={() => setAba((a) => !a)}
      />
      <TransicaoDeAba ativa={aba} style={{ flex: 0 }}>
        <Texto variante="corpo" cor="textoSuave">
          {aba ? 'Aba em primeiro plano.' : 'Aba em segundo plano (dissolvida).'}
        </Texto>
      </TransicaoDeAba>
    </Grupo>
  )
}

const ICONES_DA_DIRECAO: readonly NomeDoIcone[] = [
  'sol',
  'agenda',
  'pessoas',
  'perfil',
  'sino',
  'voltar',
  'avancar',
  'abrirLista',
  'check',
  'confirmadoCirculo',
  'fechar',
  'maisAcoes',
  'relogio',
  'local',
  'avisoAlerta',
  'musica',
  'compartilhar',
  'qr',
  'buscar',
  'semConexao',
  'cadeado',
  'pausar',
  'iniciar',
  'etapaAnterior',
  'aviso',
  'versiculo',
  'sugestao',
  'seguranca',
  'ajuda',
  'sair',
  'coracao',
  'convidar',
  'ajustes',
  'fixar',
]

function Icones() {
  const { cores } = useTema()
  return (
    <Grupo titulo="Ícones: traço de 2, pontas redondas, grade de 24">
      <Linha>
        {ICONES_DA_DIRECAO.map((n) => (
          <View
            key={n}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icone nome={n} cor={cores.destaque} tamanho={22} />
          </View>
        ))}
      </Linha>
      <Linha>
        <Avatar nome="Ana Lima" tamanho="linha" decorativo />
        <Avatar nome="Bruno Costa" tamanho="checkin" decorativo />
      </Linha>
    </Grupo>
  )
}

/** Tudo o que a fundação trouxe. O `momento` também move a luz da `Tela` que hospeda o catálogo. */
export function Fundacao({
  momento,
  aoMudarMomento,
}: {
  momento: MomentoDoDia
  aoMudarMomento: (m: MomentoDoDia) => void
}) {
  return (
    <>
      <PosesDoSol />
      <Cartoes momento={momento} aoMudarMomento={aoMudarMomento} />
      <Linhas />
      <Chips />
      <Esqueletos />
      <Toasts />
      <Deslizar />
      <Folhas />
      <BarraDeAbasDemo />
      <Cascata />
      <Icones />
    </>
  )
}
