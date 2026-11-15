/**
 * Catálogo de componentes (D0): cada componente de `src/ui` em todos os
 * estados, nos dois temas e com o inverso, para a captura em 390×844 e a
 * conferência com a folha de componentes (quadros 01a a 01d). Rota de
 * desenvolvimento: `/_catalogo` só carrega este arquivo com `__DEV__`.
 */
import type { NomeDoTema } from '@uj/tokens'
import { ESPACO, RITMO } from '@uj/tokens'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { Avatar } from '@/ui/Avatar'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { BarraDeProgresso } from '@/ui/BarraDeProgresso'
import { Botao, BotaoIcone, ParDeBotoes, type VarianteDoBotao } from '@/ui/Botao'
import { CabecalhoDeTela } from '@/ui/CabecalhoDeTela'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo, CampoDeBusca } from '@/ui/Campo'
import { CampoDeData, CampoDeHora } from '@/ui/CampoDeMomento'
import { CartaoDeDestaque, LinhaDeHorario, ListaDeHorarios } from '@/ui/CartaoDeDestaque'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { BlocoDeEsqueleto, CartaoDeEsqueleto, LinhasDeEsqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Interruptor } from '@/ui/Interruptor'
import { LinhaDeLista, Lista, RECUO_DA_LISTA } from '@/ui/LinhaDeLista'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { Numeros } from '@/ui/Numeros'
import { LinhaDePilulas, PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { Secao } from '@/ui/Secao'
import { Segmentos } from '@/ui/Segmentos'
import { StatusDoCabecalho } from '@/ui/StatusDoCabecalho'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { ProvedorDeTemaForcado, ProvedorDeTemaInverso, useTema } from '@/ui/tema'

const nada = () => {}

const VARIANTES: readonly VarianteDoBotao[] = [
  'primario',
  'secundario',
  'terciario',
  'destrutivo',
  'destrutivoCheio',
]

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

function Botoes() {
  return (
    <>
      {VARIANTES.map((v) => (
        <Grupo key={v} titulo={`Botão ${v}`}>
          <Linha>
            <Botao titulo="Normal" variante={v} aoPressionar={nada} tamanho="grande" />
            <Botao
              titulo="Pressionado"
              variante={v}
              aoPressionar={nada}
              tamanho="grande"
              estadoDeVitrine="pressionado"
            />
          </Linha>
          <Linha>
            <Botao
              titulo="Foco"
              variante={v}
              aoPressionar={nada}
              tamanho="grande"
              estadoDeVitrine="foco"
            />
            <Botao
              titulo="Desabilitado"
              variante={v}
              aoPressionar={nada}
              tamanho="grande"
              desabilitado
            />
          </Linha>
          <Linha>
            <Botao
              titulo="Carregando"
              variante={v}
              aoPressionar={nada}
              tamanho="grande"
              carregando
            />
            <Botao titulo="Médio" variante={v} aoPressionar={nada} icone="adicionar" />
          </Linha>
        </Grupo>
      ))}
      <Grupo titulo="Só ícone e par">
        <Linha>
          <BotaoIcone icone="voltar" rotulo="Voltar" circular aoPressionar={nada} />
          <BotaoIcone icone="maisAcoes" rotulo="Mais ações" aoPressionar={nada} />
          <BotaoIcone icone="adicionar" rotulo="Adicionar" aoPressionar={nada} />
          <BotaoIcone icone="descer" rotulo="Descer" desabilitado aoPressionar={nada} />
        </Linha>
        <ParDeBotoes>
          <Botao titulo="Confirmar" aoPressionar={nada} />
          <Botao titulo="Pedir substituição" variante="secundario" aoPressionar={nada} />
        </ParDeBotoes>
        <Botao
          titulo="Enviar código"
          tamanho="grande"
          larguraTotal
          desabilitado
          motivo="Aceite os termos para continuar."
          aoPressionar={nada}
        />
      </Grupo>
      <Grupo titulo="Alternável e alto (Ao vivo)">
        <Linha>
          <Botao
            titulo="Estou orando"
            icone="oracao"
            variante="secundario"
            marcado={false}
            aoPressionar={nada}
          />
          <Botao titulo="Orando" icone="check" variante="secundario" marcado aoPressionar={nada} />
        </Linha>
        <Linha>
          <BotaoIcone icone="etapaAnterior" rotulo="Voltar etapa" lado={56} aoPressionar={nada} />
          <Botao titulo="Avançar etapa" tamanho="alto" style={{ flex: 1 }} aoPressionar={nada} />
          <BotaoIcone icone="pausar" rotulo="Pausar" lado={56} aoPressionar={nada} />
        </Linha>
      </Grupo>
    </>
  )
}

function Campos() {
  const [data, setData] = useState<string | null>('2026-11-21')
  const [hora, setHora] = useState<string | null>('16:00')
  const [busca, setBusca] = useState('')
  return (
    <Grupo titulo="Campos">
      <CartaoDeVidro intervalo={ESPACO.e16}>
        <Campo rotulo="Título" exemplo="Sábado Jovem" ajuda="Aparece na agenda e no convite." />
        <Campo rotulo="Nome" value="Ana Lima" onChangeText={nada} />
        <Campo
          rotulo="E-mail"
          value="ana.lima@email.com"
          onChangeText={nada}
          estadoDeVitrine="foco"
          ajuda="Usamos só para avisos da comunidade."
        />
        <Campo rotulo="Hora de início" value="16h" onChangeText={nada} erro="Use o formato 16:00" />
        <Campo
          rotulo="Comunidade"
          value="Jovens Central"
          onChangeText={nada}
          desabilitado
          ajuda="Definida pelo convite."
        />
        <Campo rotulo="Código do convite" value="A1B2C3" onChangeText={nada} somenteLeitura />
        <Campo rotulo="Senha" senha value="segredo123" onChangeText={nada} />
        <Campo rotulo="Duração" value="60" onChangeText={nada} sufixo="min" validando />
        <Campo rotulo="Descrição" opcional multiline exemplo="O que vai acontecer" />
        <Campo rotulo="Código de 6 números" codigo value="123456" onChangeText={nada} />
        <Campo rotulo="Seu pedido" leitura maxLength={2000} mostrarContador value="" />
        <Campo
          rotulo="Código de entrada"
          value="XYZ"
          onChangeText={nada}
          erro="Use 10 letras e números, como aparece abaixo do QR."
          botao={<Botao titulo="Marcar" tamanho="grande" aoPressionar={nada} />}
        />
        <CampoDeBusca rotulo="Buscar pelo nome" valor={busca} aoMudar={setBusca} />
        <View style={{ flexDirection: 'row', gap: ESPACO.e12 }}>
          <View style={{ flex: 1.4 }}>
            <CampoDeData rotulo="Data" valor={data} aoMudar={setData} />
          </View>
          <View style={{ flex: 1 }}>
            <CampoDeHora rotulo="Hora" valor={hora} aoMudar={setHora} />
          </View>
        </View>
      </CartaoDeVidro>
    </Grupo>
  )
}

function Selecao() {
  const [modo, setModo] = useState<'mes' | 'semana' | 'lista'>('mes')
  const [filtros, setFiltros] = useState<string[]>(['proximos'])
  const [opcao, setOpcao] = useState<'salao' | 'praca'>('salao')
  const [marcada, setMarcada] = useState(true)
  const [ligado, setLigado] = useState(true)
  return (
    <>
      <Grupo titulo="Segmentos e pílulas de filtro">
        <Segmentos
          rotulo="Modo"
          valor={modo}
          aoMudar={setModo}
          segmentos={[
            { valor: 'mes', rotulo: 'Mês' },
            { valor: 'semana', rotulo: 'Semana' },
            { valor: 'lista', rotulo: 'Lista' },
          ]}
        />
        <PilulasDeFiltro
          rotulo="Filtrar"
          multipla
          selecionadas={filtros}
          aoMudar={setFiltros}
          pilulas={[
            { valor: 'proximos', rotulo: 'Próximos' },
            { valor: 'passados', rotulo: 'Passados' },
            { valor: 'rascunhos', rotulo: 'Rascunhos', contagem: 2 },
            { valor: 'cancelados', rotulo: 'Cancelados' },
          ]}
        />
        <LinhaDePilulas>
          <PilulasDeFiltro
            rotulo="Período"
            selecionadas={['proximos']}
            aoMudar={nada}
            pilulas={[
              { valor: 'proximos', rotulo: 'Próximos' },
              { valor: 'passados', rotulo: 'Passados' },
            ]}
          />
          <PilulasDeFiltro
            rotulo="Situação"
            opcional
            selecionadas={[]}
            aoMudar={nada}
            pilulas={[
              { valor: 'publicado', rotulo: 'Publicados' },
              { valor: 'cancelados', rotulo: 'Cancelados' },
            ]}
          />
        </LinhaDePilulas>
      </Grupo>
      <Grupo titulo="Chips de estado">
        <Linha>
          <Chip texto="Rascunho" tom="neutro" />
          <Chip texto="Na igreja" tom="quente" />
          <Chip texto="Confirmada" tom="sucesso" />
          <Chip texto="Pendente" tom="alerta" />
          <Chip texto="Cancelado" tom="erro" />
          <Chip texto="Organizador" tom="info" />
          <Chip texto="Ao vivo" tom="quente" ponto />
          <Chip texto="Presente" tom="sucesso" icone="check" />
          <Chip texto="Fixado" tom="quente" icone="fixar" />
        </Linha>
      </Grupo>
      <ListaDeOpcoes
        rotulo="Lista de opções"
        valor={opcao}
        aoMudar={setOpcao}
        opcoes={[
          { valor: 'salao', rotulo: 'Salão principal', descricao: 'Local interno' },
          { valor: 'praca', rotulo: 'Praça da Matriz', descricao: 'Rua das Flores, 120, Centro' },
        ]}
      />
      <Grupo titulo="Caixa de marcar e interruptor">
        <CartaoDeVidro intervalo={0}>
          <CaixaDeMarcar
            rotulo="Comprar o brinde"
            descricao="Ana · até sexta, 27/11"
            marcada={marcada}
            aoMudar={setMarcada}
          />
          <CaixaDeMarcar rotulo="Imprimir a lição" marcada={false} aoMudar={nada} desabilitada />
          <Interruptor
            rotulo="Versículo do dia"
            descricao={ligado ? 'Ligado, todos os dias às 07:00' : 'Desligado'}
            ligado={ligado}
            aoMudar={setLigado}
          />
          <Interruptor
            rotulo="Lista de espera"
            descricao="Defina as vagas primeiro"
            ligado={false}
            aoMudar={nada}
            desabilitado
          />
        </CartaoDeVidro>
      </Grupo>
    </>
  )
}

function ListasECartoes() {
  return (
    <>
      <Grupo titulo="Linha de lista">
        <CartaoDeVidro lista>
          <Lista>
            <LinhaDeLista
              icone="sino"
              titulo="Notificações"
              descricao="Eventos, escalas e avisos"
              aoPressionar={nada}
            />
            <LinhaDeLista
              icone="relogio"
              titulo="Versículo do dia"
              valor="07:00"
              aoPressionar={nada}
            />
            <LinhaDeLista
              avatar={{ nome: 'Bruno Costa' }}
              titulo="Bruno Costa"
              extra={<Chip texto="Organizador" tom="info" />}
              aoPressionar={nada}
            />
            <LinhaDeLista
              data={{ dia: '21', mes: 'sáb' }}
              titulo="Sábado Jovem"
              descricao="16:00 · 60 min · Salão principal"
              aoPressionar={nada}
            />
            <LinhaDeLista icone="documento" titulo="Termos de Uso" externo aoPressionar={nada} />
            <LinhaDeLista
              icone="sair"
              titulo="Sair deste aparelho"
              destrutivo
              aoPressionar={nada}
            />
          </Lista>
        </CartaoDeVidro>
        <CartaoDeVidro lista>
          <Lista>
            <LinhaDeLista hora="16:00" titulo="Boas-vindas" descricao="Concluída em 6 min" />
            <LinhaDeLista
              hora="16:05"
              titulo="Louvor"
              descricao="15 min · Com Ana (violão)"
              atual
              extra={<Chip texto="Agora" tom="neutro" />}
            />
            <LinhaDeLista hora="16:20" titulo="Oração intercessora" descricao="10 min" />
          </Lista>
        </CartaoDeVidro>
        <CartaoDeVidro lista sobrancelha="Tarefas">
          <Lista recuo={RECUO_DA_LISTA.caixa}>
            <CaixaDeMarcar
              rotulo="Comprar o brinde"
              descricao="Ana · até sexta, 27/11"
              marcada={false}
              aoMudar={nada}
            />
            <CaixaDeMarcar
              rotulo="Imprimir a lição"
              descricao="Felipe · feito em 18/11"
              marcada
              aoMudar={nada}
            />
          </Lista>
        </CartaoDeVidro>
        <BarraDeProgresso
          fracao={2 / 7}
          rotulo="2 de 7 etapas concluídas"
          cor="primaria"
          trilho="tonal"
        />
        <CartaoDeVidro sobrancelha="Visão geral">
          <Numeros
            itens={[
              { numero: 3, rotulo: 'comunidades' },
              { numero: 48, rotulo: 'pessoas ativas' },
              { numero: 0, rotulo: 'sem administrador' },
            ]}
          />
        </CartaoDeVidro>
      </Grupo>
      <Grupo titulo="Cartões">
        <CartaoDeVidro sobrancelha="Versículo do dia" intervalo={ESPACO.e8}>
          <Texto variante="leitura">
            É pelas bondades do SENHOR que não somos consumidos, porque suas misericórdias não têm
            fim.
          </Texto>
          <Texto variante="legenda" cor="textoSuave">
            Lamentações 3:22 · BLIVRE
          </Texto>
        </CartaoDeVidro>
        <CartaoDeDestaque
          meta="Sábado · 16:00 · 60 min"
          chip={<Chip texto="Na igreja" tom="quente" />}
          titulo="Sábado Jovem"
          aoPressionar={nada}
        >
          <ListaDeHorarios>
            <LinhaDeHorario hora="16:00" titulo="Boas-vindas" />
            <LinhaDeHorario hora="16:05" titulo="Louvor" marcador="Você" />
            <LinhaDeHorario hora="16:20" titulo="Oração intercessora" />
            <LinhaDeHorario hora="+4" titulo="etapas" suave />
          </ListaDeHorarios>
        </CartaoDeDestaque>
        <CartaoDeVidro
          sobrancelha="Sua escala"
          comecaComTitulo
          acoes={
            <ParDeBotoes>
              <Botao titulo="Confirmar" aoPressionar={nada} />
              <Botao titulo="Pedir substituição" variante="secundario" aoPressionar={nada} />
            </ParDeBotoes>
          }
        >
          <View>
            <Texto variante="tituloItem">Louvor · violão</Texto>
            <Texto variante="legenda" cor="textoSuave">
              Sábado, 21/11 · 16:05 às 16:20
            </Texto>
          </View>
        </CartaoDeVidro>
        <EstadoVazio
          icone="agenda"
          titulo="Nenhuma programação ainda"
          descricao="Comece pelo Sábado padrão: as 7 etapas já vêm prontas e você ajusta depois."
          acao={{ titulo: 'Novo Sábado padrão', aoPressionar: nada }}
        />
      </Grupo>
      <Grupo titulo="Avisos e toast">
        <Aviso
          tipo="info"
          titulo="Alguém precisa de substituição"
          acao={{ titulo: 'Ver pedidos', aoPressionar: nada }}
        >
          Bruno pediu troca no Louvor de sábado.
        </Aviso>
        <Aviso tipo="sucesso" titulo="Escala confirmada">
          Você está no Louvor, sábado às 16:05.
        </Aviso>
        <Aviso tipo="alerta" titulo="Sem conexão: o Início volta quando a internet voltar">
          O que foi preparado neste aparelho continua aqui.
        </Aviso>
        <Aviso
          tipo="erro"
          titulo="Não deu para salvar"
          acao={{ titulo: 'Tentar de novo', aoPressionar: nada }}
        >
          Confira a internet e tente de novo. Nada do que você escreveu se perdeu.
        </Aviso>
        <Botao
          titulo="Mostrar um toast"
          variante="secundario"
          aoPressionar={() =>
            mostrarToast({
              texto: 'Presença de Ana registrada',
              acao: { titulo: 'Desfazer', aoPressionar: nada },
            })
          }
        />
      </Grupo>
      <Grupo titulo="Avatar, status e esqueleto">
        <Linha>
          <Avatar nome="Ana Lima" tamanho="aba" proprio anel="inativo" decorativo />
          <Avatar nome="Ana Lima" tamanho="aba" proprio anel="ativo" decorativo />
          <Avatar nome="Jovens Central" tamanho="pilula" proprio decorativo />
          <Avatar nome="Bruno Costa" tamanho="linha" decorativo />
          <Avatar nome="Jovens Vila Nova" tamanho="comunidade" cor="#15803D" decorativo />
          <Avatar nome="Ana Lima" tamanho="perfil" proprio anel="perfil" decorativo />
        </Linha>
        <Linha>
          <StatusDoCabecalho
            icone="check"
            cor="sucesso"
            texto="Sincronizado 14:32"
            rotulo="Sincronizado"
          />
          <StatusDoCabecalho
            icone="relogio"
            cor="alerta"
            texto="3 pendentes"
            rotulo="3 pendentes"
          />
        </Linha>
        <View style={{ gap: ESPACO.e12 }}>
          <BlocoDeEsqueleto circulo altura={40} />
          <LinhasDeEsqueleto />
          <CartaoDeEsqueleto titulo />
        </View>
      </Grupo>
      <Grupo titulo="Cabeçalhos">
        <CartaoDeVidro>
          <CabecalhoDeTela
            tipo="pilha"
            titulo="Sábado Jovem"
            subtitulo="Sábado, 28 de nov. · 16:00"
          />
        </CartaoDeVidro>
        <CartaoDeVidro>
          <CabecalhoDeTela
            tipo="pilha"
            semVoltar
            titulo="Seus dados"
            passos={{ atual: 2, total: 3 }}
          />
        </CartaoDeVidro>
        <CartaoDeVidro>
          <CabecalhoDeTela tipo="folha" titulo="Trocar de comunidade" aoFechar={nada} />
        </CartaoDeVidro>
        <CartaoDeVidro>
          <CabecalhoDeTela
            tipo="pilha"
            modal
            titulo="Nova programação"
            abaixoDoTitulo={<Chip texto="Rascunho" tom="neutro" />}
          />
        </CartaoDeVidro>
      </Grupo>
    </>
  )
}

function Conteudo({ tema, aoTrocar }: { tema: NomeDoTema; aoTrocar: (t: NomeDoTema) => void }) {
  const { cores } = useTema()
  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <Tela
        pilha
        titulo="Catálogo"
        descricao="Componentes do design system em todos os estados."
        barraDeAcao={
          <BarraDeAcao>
            <BotaoIcone icone="maisAcoes" rotulo="Mais ações" lado={48} aoPressionar={nada} />
            <Botao titulo="Publicar" tamanho="grande" aoPressionar={nada} />
          </BarraDeAcao>
        }
      >
        <Segmentos
          rotulo="Tema"
          valor={tema}
          aoMudar={aoTrocar}
          segmentos={[
            { valor: 'escuro', rotulo: 'Escuro' },
            { valor: 'claro', rotulo: 'Claro' },
          ]}
        />
        <Botoes />
        <Campos />
        <Selecao />
        <ListasECartoes />
        <Grupo titulo="Inverso (cartão de destaque e toast)">
          <ProvedorDeTemaInverso>
            <View style={{ gap: ESPACO.e8 }}>
              <Botao titulo="Primário no inverso" aoPressionar={nada} />
              <Chip texto="Na igreja" tom="quente" />
            </View>
          </ProvedorDeTemaInverso>
        </Grupo>
      </Tela>
    </View>
  )
}

/** O catálogo nos dois temas: o segmento do topo troca entre escuro e claro. */
export function Catalogo() {
  const [tema, setTema] = useState<NomeDoTema>('escuro')
  return (
    <ProvedorDeTemaForcado nome={tema}>
      <Conteudo tema={tema} aoTrocar={setTema} />
    </ProvedorDeTemaForcado>
  )
}
