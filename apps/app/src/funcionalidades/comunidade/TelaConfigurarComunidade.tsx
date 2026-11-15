import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ComunidadeDoVinculo, DetalheDaComunidade } from '@/servicos/contrato'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { mostrarToast } from '@/ui/Toast'

import { SemComunidade } from '../navegacao/SemComunidade'
import { logoDaComunidade } from '../perfil/imagens'
import { useDetalheDaComunidade } from './consultas'
import { opcoesDeFuso } from './fusos'
import { EditorDoLogotipo, IdentidadeDaComunidade } from './Identidade'
import { usePode } from './permissoes'
import { COR_PADRAO, ehCorDaLista, SeletorDeCor, type CorDaComunidade } from './SeletorDeCor'

/** Nome, cor e fuso da comunidade ativa (só para quem pode configurar). */
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
          descricao="Se algo precisa mudar no nome, na cor ou no fuso, fale com uma pessoa administradora."
          acao={{ titulo: 'Voltar para a Equipe', aoPressionar: () => router.back() }}
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
  const [erroDoNome, setErroDoNome] = useState<string | null>(null)

  const nomeLimpo = nome.trim()
  const mudancas = {
    ...(nomeLimpo !== detalhe.nome ? { nome: nomeLimpo } : {}),
    ...(cor !== detalhe.cor ? { cor } : {}),
    ...(fuso !== detalhe.fuso ? { fuso } : {}),
  }
  const mudou = Object.keys(mudancas).length > 0

  const salvar = useMutation({
    mutationFn: () => api.patch(`/api/v1/c/${detalhe.id}`, mudancas),
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
      <CartaoDeVidro opaco>
        <Campo
          rotulo="Nome da comunidade"
          value={nome}
          onChangeText={setNome}
          erro={erroDoNome}
          autoCapitalize="words"
          maxLength={80}
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
        rodape="Agenda e programações seguem o fuso do lugar dos encontros."
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
    </Tela>
  )
}
