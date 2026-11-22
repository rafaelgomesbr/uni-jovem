import { useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Platform } from 'react-native'

import { api } from '@/servicos/api'
import { origemPublica } from '@/servicos/enderecos'
import { mensagemDoErro } from '@/servicos/erros'
import { abrirLink } from '@/utilidades/compartilhar'
import { salvarArquivo } from '@/utilidades/salvarArquivo'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

/** TC-14.v1, adaptado: a API gera o arquivo na hora e ele vem direto para você. */
export const TEXTO_DA_EXPORTACAO =
  'Vamos gerar um arquivo com os seus dados: conta, comunidades, escalas, inscrições, presenças, seus pedidos de oração e suas sugestões. Só você pode gerar o seu. Guarde-o com cuidado: ele contém seus pedidos de oração sem cifragem.'

export const DOCUMENTOS = [
  { caminho: '/privacidade', titulo: 'Política de Privacidade', icone: 'seguranca' },
  { caminho: '/termos', titulo: 'Termos de Uso', icone: 'documento' },
  { caminho: '/suporte', titulo: 'Suporte', icone: 'ajuda' },
] as const

export function abrirDocumento(caminho: string) {
  return abrirLink(`${origemPublica()}${caminho}`)
}

/**
 * Rota `/privacidade` (3.7.8): cartão "SEUS DADOS" com a exportação (chip
 * "Preparando" enquanto o arquivo é gerado), os documentos com
 * `arrow.up.right` e a linha destrutiva "Excluir minha conta".
 */
export function TelaPrivacidade() {
  const exportar = useMutation({
    mutationFn: async () =>
      salvarArquivo(
        'meus-dados-uni-jovem.json',
        await api.pedir<string>('/api/v1/eu/exportar', { formato: 'texto' }),
        'json',
      ),
    // O resultado tem pedidos de oração em claro: nada fica em cache.
    gcTime: 0,
  })

  return (
    <Tela pilha titulo="Privacidade e dados">
      <CartaoDeVidro
        sobrancelha="Seus dados"
        {...(exportar.isPending ? { extra: <Chip texto="Preparando" tom="info" /> } : {})}
        acoes={
          <Botao
            titulo="Gerar arquivo"
            icone="baixar"
            variante="secundario"
            dica="Exportar meus dados num arquivo."
            carregando={exportar.isPending}
            aoPressionar={() => exportar.mutate()}
          />
        }
      >
        <Texto variante="corpo">{TEXTO_DA_EXPORTACAO}</Texto>
        {exportar.isPending ? (
          <Aviso tipo="info">Preparando o arquivo. Pode levar alguns segundos.</Aviso>
        ) : null}
        {exportar.error ? (
          <Aviso tipo="erro" titulo="Não deu para gerar o arquivo" anunciar>
            {mensagemDoErro(exportar.error)}
          </Aviso>
        ) : null}
        {exportar.isSuccess ? (
          <Aviso tipo="sucesso" anunciar>
            {Platform.OS === 'web'
              ? 'Arquivo baixado: meus-dados-uni-jovem.json.'
              : 'Arquivo pronto. Escolha onde guardar na folha de compartilhamento.'}
          </Aviso>
        ) : null}
      </CartaoDeVidro>

      <Secao titulo="Convivência">
        <CartaoDeVidro lista>
          <LinhaDeLista
            icone="pessoas"
            titulo="Pessoas bloqueadas"
            descricao="Veja quem você bloqueou e desbloqueie quando quiser."
            aoPressionar={() => router.push('/bloqueados')}
          />
        </CartaoDeVidro>
      </Secao>

      <Secao titulo="Documentos">
        <CartaoDeVidro lista>
          <Lista>
            {DOCUMENTOS.map((d) => (
              <LinhaDeLista
                key={d.caminho}
                icone={d.icone}
                titulo={d.titulo}
                descricao="Abre no navegador."
                externo
                aoPressionar={() => void abrirDocumento(d.caminho)}
              />
            ))}
          </Lista>
        </CartaoDeVidro>
      </Secao>

      <CartaoDeVidro lista opaco>
        <LinhaDeLista
          icone="excluir"
          titulo="Excluir minha conta"
          descricao="Apaga sua conta e sai de todas as comunidades. Pede sua senha."
          rotuloAcessivel="Excluir minha conta"
          dica="Apaga sua conta e sai de todas as comunidades. Pede sua senha."
          destrutivo
          aoPressionar={() => router.push('/excluir-conta')}
        />
      </CartaoDeVidro>
    </Tela>
  )
}
