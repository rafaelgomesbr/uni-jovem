import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ComunidadeDoVinculo, DetalheDaComunidade, ModoDeEntrada } from '@/servicos/contrato'
import { NOME_DO_APP } from '@/constantes'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { Interruptor } from '@/ui/Interruptor'
import { LinhaDeLista } from '@/ui/LinhaDeLista'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { useConfirmarDescarte, useTravaDeEnvio, voltarOu } from '@/ui/navegacao'

import { MODOS_DE_ENTRADA } from '../entrada/consultas'
import { SemComunidade } from '../navegacao/SemComunidade'
import { logoDaComunidade } from '../perfil/imagens'
import { AvisoDeComunidadeNova } from './ComunidadeNova'
import { useDetalheDaComunidade } from './consultas'
import { opcoesDeFuso } from './fusos'
import { EditorDoLogotipo, IdentidadeDaComunidade } from './Identidade'
import { usePode } from './permissoes'
import { COR_PADRAO, ehCorDaLista, SeletorDeCor, type CorDaComunidade } from './SeletorDeCor'

/**
 * Configurações da comunidade ativa (só admin): logotipo, nome, cidade, cor,
 * quem pode entrar (ADR 0007), "Aparecer na busca" e o fuso.
 */
export function TelaConfigurarComunidade() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const detalhe = useDetalheDaComunidade(comunidadeAtiva?.id ?? null)

  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo="Configurações">
        <SemComunidade oQue="as configurações" />
      </Tela>
    )
  }
  if (!pode('comunidade', 'configurar')) {
    return (
      <Tela pilha titulo="Configurações" descricao={comunidadeAtiva.nome}>
        <EstadoVazio
          icone="seguranca"
          titulo="Só a administração configura a comunidade"
          descricao="Se algo precisa mudar no nome, na cor, na entrada ou no fuso, fale com uma pessoa administradora."
          acao={{ titulo: 'Voltar para a Comunidade', aoPressionar: () => voltarOu('/comunidade') }}
        />
      </Tela>
    )
  }
  if (detalhe.isPending) {
    return (
      <Tela pilha titulo="Configurações">
        <Esqueleto rotulo="Carregando as configurações">
          <CartaoDeEsqueleto />
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Tela>
    )
  }
  if (detalhe.error) {
    return (
      <Tela pilha titulo="Configurações">
        <ErroDaTela erro={detalhe.error} aoTentarDeNovo={() => void detalhe.refetch()} />
      </Tela>
    )
  }
  return <Formulario detalhe={detalhe.data} comunidade={comunidadeAtiva} />
}

/**
 * O que todo mundo da comunidade vê: o logotipo (só admin troca), o nome, a
 * cor em amostras com a prévia e o fuso dos horários. "Salvar" na barra.
 */
function Formulario({
  detalhe,
  comunidade,
}: {
  detalhe: DetalheDaComunidade
  /** O vínculo traz a versão do logotipo (D33), que volta nova de `/eu` depois da troca. */
  comunidade: ComunidadeDoVinculo
}) {
  const consultas = useQueryClient()
  const [nome, setNome] = useState(detalhe.nome)
  const [cor, setCor] = useState<CorDaComunidade>(
    ehCorDaLista(detalhe.cor) ? detalhe.cor : COR_PADRAO,
  )
  const [fuso, setFuso] = useState(detalhe.fuso)
  const [cidade, setCidade] = useState(detalhe.cidade ?? '')
  const [modo, setModo] = useState<ModoDeEntrada | null>(detalhe.modoEntrada ?? null)
  const [encontravel, setEncontravel] = useState(detalhe.encontravel ?? false)
  const [erroDoNome, setErroDoNome] = useState<string | null>(null)
  const trava = useTravaDeEnvio()

  const nomeLimpo = nome.trim()
  const cidadeLimpa = cidade.trim()
  const mudancas = {
    ...(nomeLimpo !== detalhe.nome ? { nome: nomeLimpo } : {}),
    ...(cor !== detalhe.cor ? { cor } : {}),
    ...(fuso !== detalhe.fuso ? { fuso } : {}),
    ...(cidadeLimpa !== (detalhe.cidade ?? '') ? { cidade: cidadeLimpa || null } : {}),
    ...(modo !== null && modo !== detalhe.modoEntrada ? { modoEntrada: modo } : {}),
    ...(detalhe.encontravel !== undefined && encontravel !== detalhe.encontravel
      ? { encontravel }
      : {}),
  }
  const mudou = Object.keys(mudancas).length > 0
  // Sem o "Descartar?" depois de salvar: o detalhe volta com os valores novos.
  useConfirmarDescarte(mudou)

  const salvar = useMutation({
    mutationFn: () => api.patch(`/api/v1/c/${detalhe.id}`, mudancas),
    onSettled: () => trava.soltar(),
    onSuccess: async () => {
      mostrarToast({ texto: 'Configurações salvas.' })
      await Promise.all([
        consultas.invalidateQueries({ queryKey: CHAVES.comunidade(detalhe.id) }),
        // Nome e cor aparecem no cabeçalho e no seletor, que vêm de `/eu`.
        consultas.invalidateQueries({ queryKey: CHAVES.eu }),
      ])
    },
  })

  function enviar() {
    if (nomeLimpo.length < 2) {
      setErroDoNome('O nome precisa ter pelo menos 2 letras.')
      return
    }
    setErroDoNome(null)
    if (!trava.pegar()) return
    salvar.mutate()
  }

  return (
    <Tela
      pilha
      titulo="Configurações"
      descricao={detalhe.nome}
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Salvar"
            rotuloAcessivel={`Salvar configurações de ${detalhe.nome}`}
            tamanho="grande"
            desabilitado={!mudou}
            motivo="Nada foi alterado ainda."
            carregando={salvar.isPending}
            aoPressionar={enviar}
          />
        </BarraDeAcao>
      }
    >
      {salvar.error ? (
        <AvisoDeFalha erro={salvar.error} titulo="As configurações não foram salvas" />
      ) : null}
      <EditorDoLogotipo
        comunidade={{
          id: detalhe.id,
          nome: detalhe.nome,
          cor: detalhe.cor,
          ...(comunidade.temLogo !== undefined ? { temLogo: comunidade.temLogo } : {}),
          ...(comunidade.logoVersao !== undefined ? { logoVersao: comunidade.logoVersao } : {}),
        }}
      />
      <AvisoDeComunidadeNova detalhe={detalhe} />
      <CartaoDeVidro opaco intervalo={ESPACO.e16}>
        <Campo
          rotulo="Nome da comunidade"
          value={nome}
          onChangeText={setNome}
          erro={erroDoNome}
          autoCapitalize="words"
          maxLength={80}
        />
        <Campo
          rotulo="Cidade"
          opcional
          exemplo="Campinas"
          ajuda="Aparece na busca, junto do nome."
          value={cidade}
          onChangeText={setCidade}
          autoCapitalize="words"
          maxLength={80}
        />
      </CartaoDeVidro>
      {detalhe.modoEntrada !== undefined ? (
        <Secao titulo="Quem pode entrar">
          <ListaDeOpcoes
            rotulo="Modo de entrada"
            valor={modo}
            aoMudar={setModo}
            opcoes={MODOS_DE_ENTRADA}
          />
        </Secao>
      ) : null}
      {detalhe.encontravel !== undefined ? (
        <CartaoDeVidro opaco intervalo={ESPACO.e8}>
          <Interruptor rotulo="Aparecer na busca" ligado={encontravel} aoMudar={setEncontravel} />
          {/* TC-18.v1, palavra por palavra. */}
          <Texto variante="meta" cor="textoSuave">
            {`Ligado, quem tem conta no ${NOME_DO_APP} encontra esta comunidade pelo nome e pela cidade, e vê nome, cidade, cor, logotipo e se ela é verificada. Ninguém vê, pela busca, quem participa nem quantas pessoas há. Quem encontrar pode pedir para entrar, e você ou os organizadores decidem.`}
          </Texto>
          {encontravel && !cidadeLimpa ? (
            <Aviso tipo="alerta" titulo="Falta a cidade">
              Informe a cidade para as pessoas acharem a comunidade certa.
            </Aviso>
          ) : null}
        </CartaoDeVidro>
      ) : null}
      <CartaoDeVidro lista>
        <LinhaDeLista
          icone="qr"
          titulo="Código da comunidade"
          descricao="O código, o QR e o envio pelo WhatsApp"
          aoPressionar={() => router.push('/codigo-da-comunidade')}
        />
      </CartaoDeVidro>
      <Secao titulo="Cor">
        <CartaoDeVidro opaco>
          <SeletorDeCor valor={cor} aoMudar={setCor} />
        </CartaoDeVidro>
      </Secao>
      <Secao titulo="Prévia">
        <CartaoDeVidro>
          <IdentidadeDaComunidade
            nome={nomeLimpo || detalhe.nome}
            cor={cor}
            detalhe="Como a comunidade aparece para todos"
            logo={logoDaComunidade(comunidade)}
          />
        </CartaoDeVidro>
      </Secao>
      <Secao
        titulo="Fuso horário"
        rodape="A agenda e os horários seguem o fuso do lugar dos encontros."
      >
        <CartaoDeVidro opaco intervalo={ESPACO.e8}>
          <ListaDeOpcoes
            rotulo="Fuso"
            valor={fuso}
            aoMudar={setFuso}
            opcoes={opcoesDeFuso(detalhe.fuso)}
          />
        </CartaoDeVidro>
      </Secao>
      <ZonaDeCuidado ativa={detalhe.estado === 'ativa'} />
    </Tela>
  )
}

/**
 * O que apaga coisas, separado do resto e no fim (D77): "Limpar próximos encontros" (organização)
 * e "Excluir esta comunidade" (só a administração, com 30 dias para desfazer). Cada uma abre a
 * própria tela de confirmação em dois passos; nada aqui apaga com um toque.
 */
function ZonaDeCuidado({ ativa }: { ativa: boolean }) {
  const pode = usePode()
  const limpar = pode('evento', 'limpar_proximos') && ativa
  const excluir = pode('comunidade', 'excluir') && ativa
  if (!limpar && !excluir) return null
  return (
    <Secao
      titulo="Cuidado: apaga dados"
      rodape="Cada uma pede duas confirmações antes de apagar qualquer coisa."
    >
      <CartaoDeVidro lista>
        {limpar ? (
          <LinhaDeLista
            icone="excluir"
            titulo="Limpar próximos encontros"
            descricao="Apaga ou cancela todos os encontros que ainda não começaram."
            aoPressionar={() => router.push('/limpar-proximos-encontros')}
          />
        ) : null}
        {excluir ? (
          <LinhaDeLista
            icone="excluir"
            titulo="Excluir esta comunidade"
            descricao="Some para todos agora e é apagada de vez em 30 dias."
            destrutivo
            aoPressionar={() => router.push('/excluir-comunidade')}
          />
        ) : null}
      </CartaoDeVidro>
    </Secao>
  )
}
