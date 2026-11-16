import { router } from 'expo-router'

import { NOME_DO_APP } from '@/constantes'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'

import { MissoesDeConfiguracao } from '../onboarding/MissoesDeConfiguracao'
import { abrirDocumento } from '../privacidade/TelaPrivacidade'
import { versaoDoApp } from './TelaPerfil'

/**
 * "Ajuda e sobre" (quadro 04): o mapa da missão, a tradução da Bíblia, o
 * suporte e os documentos (abrem no navegador, com `arrow.up.right`), os
 * primeiros passos e a versão do app.
 */
export function TelaAjuda() {
  return (
    <Tela pilha titulo="Ajuda e sobre">
      <CartaoDeVidro lista>
        <Lista>
          <LinhaDeLista
            icone="missao"
            titulo="Primeiros passos"
            descricao="O passeio pelo app, com exemplos que não mudam nada de verdade."
            aoPressionar={() => router.push({ pathname: '/missao', params: { rever: '1' } })}
          />
          <LinhaDeLista
            icone="versiculo"
            titulo="Sobre a tradução da Bíblia"
            descricao="De onde vêm os versículos e a licença de uso."
            aoPressionar={() => router.push('/versiculo/traducao')}
          />
          <LinhaDeLista
            icone="ajuda"
            titulo="Suporte"
            descricao="Dúvidas e problemas"
            externo
            aoPressionar={() => void abrirDocumento('/suporte')}
          />
          <LinhaDeLista
            icone="documento"
            titulo="Termos de Uso"
            externo
            aoPressionar={() => void abrirDocumento('/termos')}
          />
          <LinhaDeLista
            icone="seguranca"
            titulo="Política de Privacidade"
            externo
            aoPressionar={() => void abrirDocumento('/privacidade')}
          />
          <LinhaDeLista
            icone="info"
            titulo="Versão do app"
            valor={versaoDoApp()}
            rotuloAcessivel={`Versão do ${NOME_DO_APP}: ${versaoDoApp()}`}
          />
        </Lista>
      </CartaoDeVidro>
      <Secao titulo="Deixe tudo pronto">
        <CartaoDeVidro>
          <MissoesDeConfiguracao />
        </CartaoDeVidro>
      </Secao>
    </Tela>
  )
}
