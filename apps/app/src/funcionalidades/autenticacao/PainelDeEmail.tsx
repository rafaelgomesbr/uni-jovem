import {
  ESPACO,
  LADO_DO_SOL,
  LARGURA_DA_COLUNA_DE_ACESSO,
  RITMO,
  RITMO_DE_ACESSO,
} from '@uj/tokens'
import type { ComponentRef, Ref } from 'react'
import type { TextInput } from 'react-native'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BotaoDeAcesso } from '@/ui/BotaoDeAcesso'
import { CampoDeAcesso } from '@/ui/CampoDeAcesso'
import type { NoDeTexto, NoDeView } from '@/ui/foco'
import { Icone } from '@/ui/Icone'
import { LinkDeAcesso } from '@/ui/LinkDeAcesso'
import { MarcaDoSol } from '@/ui/MarcaDoSol'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { FaseDoPainel } from '@/ui/TrocaDePainel'
import { useAnunciar } from '@/ui/useAnunciar'
import { soNaWeb } from '@/ui/web'

import type { ErroDaEntrada } from './erroDaEntrada'

export interface ErrosDoPainel {
  email?: string
  senha?: string
}

interface PropsDoPainelDeEmail {
  email: string
  senha: string
  aoMudarEmail: (texto: string) => void
  aoMudarSenha: (texto: string) => void
  /** Erro por campo (ao sair do campo ou ao enviar vazio): ícone mais texto abaixo do campo. */
  erros: ErrosDoPainel
  /** Sobe a cada envio com erro: os campos balançam 5 pt (nunca ao sair do campo). */
  disparoDeErro: number
  /** Erro do envio (credencial, rede, muitas tentativas): acima do botão, com a ação certa. */
  erroGeral: ErroDaEntrada | null
  /** Quantas vezes seguidas a senha falhou: na segunda, "Esqueci a senha" vira botão. */
  falhasDeSenha: number
  carregando: boolean
  /** Demorou mais de 10 s: "Ainda entrando...". */
  demorando: boolean
  sucesso: boolean
  /** Título visível (o teclado muito alto o tira) e ritmo do painel. */
  tituloVisivel: boolean
  ritmo: 'confortavel' | 'compacto'
  aoSairDoEmail: () => void
  aoIrParaSenha: () => void
  aoEnviar: () => void
  aoVoltar: () => void
  aoEsquecerSenha: () => void
  aoCriarConta: () => void
  aoTentarDeNovo: () => void
  refDoTitulo: Ref<NoDeTexto>
  refDoEmail: Ref<ComponentRef<typeof TextInput>>
  refDaSenha: Ref<ComponentRef<typeof TextInput>>
  refDoVoltar?: Ref<NoDeView>
  /** Aviso fixo de "Sem internet" no alto. */
  semConexao: boolean
}

/**
 * `entrada.email`: o painel ancorado no topo, por cima dos acessos (D63).
 * E-mail e senha ficam juntos, no mesmo painel, para o chaveiro do sistema
 * ligar o par e sugerir o preenchimento; depois de preencher, o botão não
 * envia sozinho. O teclado não empurra nada: o painel termina acima dele e,
 * só se o erro ocupar duas linhas ou a fonte for grande, a rolagem liga.
 */
export function PainelDeEmail({
  email,
  senha,
  aoMudarEmail,
  aoMudarSenha,
  erros,
  disparoDeErro,
  erroGeral,
  falhasDeSenha,
  carregando,
  demorando,
  sucesso,
  tituloVisivel,
  ritmo,
  aoSairDoEmail,
  aoIrParaSenha,
  aoEnviar,
  aoVoltar,
  aoEsquecerSenha,
  aoCriarConta,
  aoTentarDeNovo,
  refDoTitulo,
  refDoEmail,
  refDaSenha,
  refDoVoltar,
  semConexao,
}: PropsDoPainelDeEmail) {
  const { cores } = useTema()
  const margens = useSafeAreaInsets()
  useAnunciar(erroGeral ? `${erroGeral.titulo} ${erroGeral.detalhe}`.trim() : null)

  const intervalo =
    ritmo === 'confortavel'
      ? RITMO_DE_ACESSO.tituloParaCampoConfortavel
      : RITMO_DE_ACESSO.tituloParaCampoCompacto
  const rotuloDoBotao = sucesso
    ? 'Entrar'
    : carregando
      ? demorando
        ? 'Ainda entrando...'
        : 'Entrando...'
      : 'Entrar'

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      bounces={false}
      overScrollMode="never"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        alignItems: 'center',
        paddingTop: margens.top + RITMO.topoDaTela,
        paddingBottom: margens.bottom + ESPACO.e24,
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: LARGURA_DA_COLUNA_DE_ACESSO,
          paddingHorizontal: RITMO.margemDaTela,
        }}
      >
        {semConexao ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: ESPACO.e8,
              marginBottom: ESPACO.e8,
            }}
          >
            <Icone nome="semConexao" cor={cores.alerta} tamanho={18} />
            <Texto variante="meta" peso="forte" accessibilityRole="alert" style={{ flex: 1 }}>
              Sem internet. Para entrar, o aparelho precisa estar conectado.
            </Texto>
          </View>
        ) : null}

        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <LinkDeAcesso
            ref={refDoVoltar}
            rotulo="Outras formas de entrar"
            aoPressionar={aoVoltar}
            tamanho="linha"
          >
            <Icone nome="voltar" cor={cores.destaque} tamanho={18} peso="forte" />
            <Texto variante="botao" cor="destaque">
              Outras formas de entrar
            </Texto>
          </LinkDeAcesso>
          <FaseDoPainel tipo="entra" de={0.6}>
            <MarcaDoSol lado={LADO_DO_SOL.mini} etapa="estatica" halo={false} />
          </FaseDoPainel>
        </View>

        {tituloVisivel ? (
          <Texto variante="tituloTela" ref={refDoTitulo} {...soNaWeb({ tabIndex: -1 })}>
            Entrar com e-mail
          </Texto>
        ) : null}

        <View style={{ marginTop: intervalo }}>
          <CampoDeAcesso
            ref={refDoEmail}
            rotulo="E-mail"
            value={email}
            onChangeText={aoMudarEmail}
            onBlur={aoSairDoEmail}
            erro={erros.email ?? null}
            invalido={erroGeral?.tipo === 'credencial'}
            disparoDeErro={disparoDeErro}
            somenteLeitura={carregando}
            exemplo="nome@exemplo.com"
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={aoIrParaSenha}
          />
          <CampoDeAcesso
            ref={refDaSenha}
            rotulo="Senha"
            senha
            value={senha}
            onChangeText={aoMudarSenha}
            erro={erros.senha ?? null}
            invalido={erroGeral?.tipo === 'credencial'}
            disparoDeErro={disparoDeErro}
            somenteLeitura={carregando}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={aoEnviar}
            aoLado={
              <LinkDeAcesso rotulo="Esqueci a senha" aoPressionar={aoEsquecerSenha} tamanho="linha">
                <Texto variante="botao" cor="destaque">
                  Esqueci a senha
                </Texto>
              </LinkDeAcesso>
            }
          />
        </View>

        {erroGeral ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: ESPACO.e8,
              marginBottom: ESPACO.e12,
            }}
          >
            <View style={{ height: ESPACO.e20, justifyContent: 'center' }}>
              <Icone nome="erroDeCampo" cor={cores.erro} tamanho={18} />
            </View>
            {/* A ação fica na mesma coluna do texto: o olho lê a mensagem e já vê o que fazer. */}
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              <Texto variante="meta" accessibilityRole="alert">
                <Texto variante="meta" peso="forte">
                  {erroGeral.titulo}
                </Texto>
                {erroGeral.detalhe ? ` ${erroGeral.detalhe}` : ''}
              </Texto>
              {erroGeral.tipo === 'rede' ? (
                <View style={{ marginLeft: -ESPACO.e8 }}>
                  <LinkDeAcesso
                    rotulo="Tentar de novo"
                    aoPressionar={aoTentarDeNovo}
                    tamanho="curto"
                  >
                    <Texto variante="botao" cor="destaque">
                      Tentar de novo
                    </Texto>
                  </LinkDeAcesso>
                </View>
              ) : erroGeral.tipo === 'credencial' && falhasDeSenha < 2 ? (
                <View style={{ marginLeft: -ESPACO.e8 }}>
                  <LinkDeAcesso
                    rotulo="Esqueci a senha"
                    aoPressionar={aoEsquecerSenha}
                    tamanho="curto"
                  >
                    <Texto variante="botao" cor="destaque">
                      Esqueci a senha
                    </Texto>
                  </LinkDeAcesso>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        <BotaoDeAcesso
          marca="acao"
          nivel="primario"
          titulo={rotuloDoBotao}
          carregando={carregando}
          sucesso={sucesso}
          aoPressionar={aoEnviar}
        />

        {erroGeral?.tipo === 'credencial' && falhasDeSenha >= 2 ? (
          <View style={{ marginTop: ESPACO.e12 }}>
            <BotaoDeAcesso
              marca="acao"
              nivel="secundario"
              titulo="Esqueci a senha"
              aoPressionar={aoEsquecerSenha}
            />
          </View>
        ) : null}

        <View style={{ marginTop: ESPACO.e12 }}>
          <LinkDeAcesso
            tamanho="rodape"
            rotulo="Não tem conta? Criar conta"
            aoPressionar={aoCriarConta}
            desabilitado={carregando}
          >
            <Texto variante="meta" cor="textoSuave">
              Não tem conta?
            </Texto>
            <Texto variante="botao" cor="destaque">
              Criar conta
            </Texto>
          </LinkDeAcesso>
        </View>
      </View>
    </ScrollView>
  )
}
